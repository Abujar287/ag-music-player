import { EqualizerState, Track } from '../types/music';

const BAND_FREQS = [60, 230, 910, 3600, 14000];

interface AndroidAudioBridge {
  playTrack?: (
    uri: string,
    title: string,
    artist: string,
    album: string,
    artUri: string,
    startSec: number
  ) => void;
  pauseTrack?: () => void;
  resumeTrack?: () => void;
  seekTo?: (sec: number) => void;
  updateEqualizer?: (enabled: boolean, bandsJson: string, virtualizer: number) => void;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidAudioBridge & Record<string, unknown>;
    __agNativeCallbacks?: {
      onProgress?: (posSec: number) => void;
      onStateChange?: (isPlaying: boolean, posSec?: number) => void;
      onEnded?: () => void;
      onError?: (msg: string) => void;
    };
  }
}

export class AGMusicAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private virtualizerDelayL: DelayNode | null = null;
  private virtualizerDelayR: DelayNode | null = null;
  private virtualizerGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private mediaElement: HTMLAudioElement | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;

  private currentTrack: Track | null = null;
  private isPlaying = false;
  private positionSec = 0;
  private progressTimer: number | null = null;
  private eqState: EqualizerState = {
    enabled: true,
    preset: 'normal',
    bands: [0, 0, 0, 0, 0],
    virtualizer: 35,
  };
  private fadeOnPause = true;

  private onTickCallback: ((posSec: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private onStateChangeCallback: ((playing: boolean) => void) | null = null;
  private onErrorCallback: ((message: string) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.__agNativeCallbacks = {
        onProgress: (posSec: number) => {
          this.positionSec = posSec;
          this.onTickCallback?.(posSec);
        },
        onStateChange: (playing: boolean, posSec?: number) => {
          this.isPlaying = playing;
          if (typeof posSec === 'number' && !Number.isNaN(posSec)) {
            this.positionSec = posSec;
            this.onTickCallback?.(posSec);
          }
          this.onStateChangeCallback?.(playing);
        },
        onEnded: () => {
          this.isPlaying = false;
          this.positionSec = 0;
          this.onEndedCallback?.();
        },
        onError: (msg: string) => {
          this.isPlaying = false;
          this.onStateChangeCallback?.(false);
          this.onErrorCallback?.(msg);
        },
      };
    }
  }

  private hasNativeBridge(): boolean {
    return typeof window !== 'undefined' && typeof window.AndroidBridge?.playTrack === 'function';
  }

  public setCallbacks(
    onTick: (posSec: number) => void,
    onEnded: () => void,
    onStateChange?: (playing: boolean) => void,
    onError?: (message: string) => void
  ) {
    this.onTickCallback = onTick;
    this.onEndedCallback = onEnded;
    this.onStateChangeCallback = onStateChange ?? null;
    this.onErrorCallback = onError ?? null;
  }

  public setFadeOnPause(enabled: boolean) {
    this.fadeOnPause = enabled;
  }

  public isTrackLoaded(trackId: string): boolean {
    return this.currentTrack?.id === trackId;
  }

  private ensureWebMediaElement() {
    if (this.mediaElement) return;
    this.mediaElement = new Audio();
    this.mediaElement.preload = 'auto';
    this.mediaElement.addEventListener('ended', () => {
      this.stopProgressTimer();
      this.isPlaying = false;
      this.onEndedCallback?.();
    });
    this.mediaElement.addEventListener('pause', () => {
      if (this.isPlaying && this.mediaElement?.ended === false) {
        this.isPlaying = false;
        this.stopProgressTimer();
        this.onStateChangeCallback?.(false);
      }
    });
    this.mediaElement.addEventListener('play', () => {
      if (!this.isPlaying) {
        this.isPlaying = true;
        this.onStateChangeCallback?.(true);
      }
    });
  }

  private ensureWebAudioGraph() {
    this.ensureWebMediaElement();
    if (this.ctx) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;

    // 5-band Equalizer chain
    this.filters = BAND_FREQS.map((freq, idx) => {
      const filter = this.ctx!.createBiquadFilter();
      filter.frequency.value = freq;
      filter.type = idx === 0 ? 'lowshelf' : idx === BAND_FREQS.length - 1 ? 'highshelf' : 'peaking';
      filter.Q.value = 1.1;
      filter.gain.value = this.eqState.enabled ? this.eqState.bands[idx] : 0;
      return filter;
    });

    for (let i = 0; i < this.filters.length - 1; i++) {
      this.filters[i].connect(this.filters[i + 1]);
    }

    // Virtualizer stereo widening stage
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1;
    this.virtualizerGain = this.ctx.createGain();
    this.virtualizerGain.gain.value = (this.eqState.virtualizer / 100) * 0.25;

    this.virtualizerDelayL = this.ctx.createDelay(0.05);
    this.virtualizerDelayL.delayTime.value = 0.012;
    this.virtualizerDelayR = this.ctx.createDelay(0.05);
    this.virtualizerDelayR.delayTime.value = 0.019;

    const merger = this.ctx.createChannelMerger(2);
    const lastFilter = this.filters[this.filters.length - 1];

    lastFilter.connect(this.dryGain);
    this.dryGain.connect(this.masterGain);

    lastFilter.connect(this.virtualizerDelayL);
    lastFilter.connect(this.virtualizerDelayR);
    this.virtualizerDelayL.connect(merger, 0, 0);
    this.virtualizerDelayR.connect(merger, 0, 1);
    merger.connect(this.virtualizerGain);
    this.virtualizerGain.connect(this.masterGain);

    this.masterGain.connect(this.ctx.destination);

    if (this.mediaElement && !this.mediaSourceNode) {
      try {
        this.mediaSourceNode = this.ctx.createMediaElementSource(this.mediaElement);
        this.mediaSourceNode.connect(this.filters[0]);
      } catch (err) {
        console.warn('Web Audio EQ source attach skipped:', err);
      }
    }
  }

  public updateEqualizer(eq: EqualizerState) {
    this.eqState = eq;
    if (this.hasNativeBridge()) {
      try {
        window.AndroidBridge?.updateEqualizer?.(
          eq.enabled,
          JSON.stringify(eq.bands),
          eq.virtualizer
        );
      } catch (err) {
        console.error('Native EQ update error:', err);
      }
      return;
    }

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.filters.forEach((f, idx) => {
      const target = eq.enabled ? eq.bands[idx] : 0;
      f.gain.setTargetAtTime(target, now, 0.03);
    });
    if (this.virtualizerGain) {
      const virtTarget = eq.enabled ? (eq.virtualizer / 100) * 0.28 : 0;
      this.virtualizerGain.gain.setTargetAtTime(virtTarget, now, 0.03);
    }
  }

  public async playTrack(track: Track, startSec = 0) {
    this.currentTrack = track;
    this.positionSec = startSec;

    // 1. Native Android Media3 ExoPlayer path (clean hardware decoding + audio focus)
    if (this.hasNativeBridge()) {
      const nativeUri = track.contentUri || track.filePath || track.audioUrl || '';
      if (!nativeUri) {
        this.isPlaying = false;
        this.onStateChangeCallback?.(false);
        this.onErrorCallback?.('No playable audio URI found for this track.');
        return;
      }
      this.isPlaying = true;
      window.AndroidBridge!.playTrack!(
        nativeUri,
        track.title,
        track.artist,
        track.album,
        track.nativeArtUri || '',
        startSec
      );
      this.updateEqualizer(this.eqState);
      return;
    }

    // 2. Web Browser path
    const sourceUri = track.audioUrl || track.contentUri || track.filePath;
    if (!sourceUri) {
      this.isPlaying = false;
      this.onStateChangeCallback?.(false);
      this.onErrorCallback?.('Audio file source is unavailable in web preview.');
      return;
    }

    this.ensureWebAudioGraph();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }

    this.stopWebPlayback();
    this.isPlaying = true;

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      if (this.fadeOnPause) {
        this.masterGain.gain.setValueAtTime(0.01, now);
        this.masterGain.gain.linearRampToValueAtTime(0.85, now + 0.2);
      } else {
        this.masterGain.gain.setValueAtTime(0.85, now);
      }
    }

    if (this.mediaElement) {
      // Only set crossOrigin for remote HTTP/HTTPS streams; never for blob:/file: URLs
      if (sourceUri.startsWith('http://') || sourceUri.startsWith('https://')) {
        this.mediaElement.crossOrigin = 'anonymous';
      } else {
        this.mediaElement.removeAttribute('crossorigin');
      }
      this.mediaElement.src = sourceUri;
      this.mediaElement.currentTime = startSec;
      try {
        await this.mediaElement.play();
        this.startProgressLoop();
      } catch (err) {
        console.error('Audio playback error:', err);
        this.isPlaying = false;
        this.onStateChangeCallback?.(false);
        this.onErrorCallback?.('Unable to decode or play this audio file.');
      }
    }
  }

  public pause() {
    this.isPlaying = false;
    this.stopProgressTimer();

    if (this.hasNativeBridge()) {
      window.AndroidBridge?.pauseTrack?.();
      return;
    }

    if (this.ctx && this.masterGain && this.fadeOnPause) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.001, now + 0.16);
      window.setTimeout(() => {
        if (!this.isPlaying) {
          this.mediaElement?.pause();
        }
      }, 175);
    } else {
      this.mediaElement?.pause();
    }
  }

  public async resume() {
    if (!this.currentTrack) return;
    if (this.hasNativeBridge()) {
      this.isPlaying = true;
      window.AndroidBridge?.resumeTrack?.();
      return;
    }
    await this.playTrack(this.currentTrack, this.positionSec);
  }

  public seekTo(sec: number) {
    if (!this.currentTrack) return;
    const clamped = Math.max(0, Math.min(sec, Math.max(1, this.currentTrack.durationSec)));
    this.positionSec = clamped;

    if (this.hasNativeBridge()) {
      window.AndroidBridge?.seekTo?.(clamped);
      this.onTickCallback?.(clamped);
      return;
    }

    if (this.mediaElement && this.mediaElement.src) {
      this.mediaElement.currentTime = clamped;
    }
    this.onTickCallback?.(clamped);
  }

  private startProgressLoop() {
    this.stopProgressTimer();
    this.progressTimer = window.setInterval(() => {
      if (!this.isPlaying || !this.currentTrack || !this.mediaElement) return;
      this.positionSec = this.mediaElement.currentTime;
      this.onTickCallback?.(this.positionSec);
    }, 250);
  }

  private stopWebPlayback() {
    this.stopProgressTimer();
    if (this.mediaElement) {
      this.mediaElement.pause();
    }
  }

  private stopProgressTimer() {
    if (this.progressTimer !== null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  public destroy() {
    this.stopWebPlayback();
    this.ctx?.close();
    this.ctx = null;
  }
}

export const audioEngine = new AGMusicAudioEngine();
