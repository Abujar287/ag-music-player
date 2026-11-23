import { EqualizerState, SynthProfile, Track } from '../types/music';

const BAND_FREQS = [60, 230, 910, 3600, 14000];

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

  private synthInterval: number | null = null;
  private synthActiveNodes: AudioNode[] = [];
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

  public setCallbacks(onTick: (posSec: number) => void, onEnded: () => void) {
    this.onTickCallback = onTick;
    this.onEndedCallback = onEnded;
  }

  public setFadeOnPause(enabled: boolean) {
    this.fadeOnPause = enabled;
  }

  private ensureGraph() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

    // MediaElement for imported local audio files
    this.mediaElement = new Audio();
    this.mediaElement.crossOrigin = 'anonymous';
    this.mediaElement.addEventListener('ended', () => {
      this.stopTimers();
      this.isPlaying = false;
      this.onEndedCallback?.();
    });
    this.mediaSourceNode = this.ctx.createMediaElementSource(this.mediaElement);
    this.mediaSourceNode.connect(this.filters[0]);
  }

  public updateEqualizer(eq: EqualizerState) {
    this.eqState = eq;
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
    this.ensureGraph();
    if (this.ctx!.state === 'suspended') {
      await this.ctx!.resume();
    }

    this.stopCurrentSource();
    this.currentTrack = track;
    this.positionSec = startSec;
    this.isPlaying = true;

    const now = this.ctx!.currentTime;
    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(now);
      if (this.fadeOnPause) {
        this.masterGain.gain.setValueAtTime(0.01, now);
        this.masterGain.gain.linearRampToValueAtTime(0.85, now + 0.25);
      } else {
        this.masterGain.gain.setValueAtTime(0.85, now);
      }
    }

    if (track.audioUrl && this.mediaElement) {
      this.mediaElement.src = track.audioUrl;
      this.mediaElement.currentTime = startSec;
      await this.mediaElement.play().catch(() => {});
      this.startProgressLoop(true);
    } else {
      this.startSynthPlayback(track.synthProfile || {
        bpm: 86,
        rootHz: 110,
        chords: [[220, 261.63, 329.63]],
        waveform: 'sine',
        brightnessHz: 1400,
      });
      this.startProgressLoop(false);
    }
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.stopTimers();

    if (this.ctx && this.masterGain && this.fadeOnPause) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.001, now + 0.18);
      window.setTimeout(() => {
        if (!this.isPlaying) {
          this.mediaElement?.pause();
          this.stopSynthNodes();
        }
      }, 190);
    } else {
      this.mediaElement?.pause();
      this.stopSynthNodes();
    }
  }

  public async resume() {
    if (!this.currentTrack) return;
    await this.playTrack(this.currentTrack, this.positionSec);
  }

  public seekTo(sec: number) {
    if (!this.currentTrack) return;
    const clamped = Math.max(0, Math.min(sec, this.currentTrack.durationSec));
    this.positionSec = clamped;
    if (this.currentTrack.audioUrl && this.mediaElement) {
      this.mediaElement.currentTime = clamped;
    }
    this.onTickCallback?.(clamped);
  }

  private startSynthPlayback(profile: SynthProfile) {
    if (!this.ctx || this.filters.length === 0) return;

    const beatMs = (60 / profile.bpm) * 1000 * 2; // chord changes every 2 beats
    let step = Math.floor(this.positionSec / (beatMs / 1000));

    const playStep = () => {
      if (!this.ctx || !this.isPlaying) return;
      const now = this.ctx.currentTime;
      const chord = profile.chords[step % profile.chords.length];
      const dur = beatMs / 1000;

      // Sub-bass root pulse
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(chord[0] / 2, now);
      bassGain.gain.setValueAtTime(0.001, now);
      bassGain.gain.linearRampToValueAtTime(0.18, now + 0.08);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.95);
      bassOsc.connect(bassGain);
      bassGain.connect(this.filters[0]);
      bassOsc.start(now);
      bassOsc.stop(now + dur);

      // Warm polyphonic chord pad + gentle shimmer arpeggio
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(profile.brightnessHz, now);
      lowpass.connect(this.filters[0]);

      chord.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = profile.waveform;
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime((idx - 1.5) * 4, now);

        const attackOffset = idx * 0.12;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.055, now + 0.18 + attackOffset);
        g.gain.exponentialRampToValueAtTime(0.0008, now + dur * 1.15);

        osc.connect(g);
        g.connect(lowpass);
        osc.start(now + attackOffset * 0.4);
        osc.stop(now + dur * 1.2);
        this.synthActiveNodes.push(osc);
      });

      step++;
    };

    playStep();
    this.synthInterval = window.setInterval(playStep, beatMs);
  }

  private startProgressLoop(useMediaElement: boolean) {
    this.stopProgressTimer();
    this.progressTimer = window.setInterval(() => {
      if (!this.isPlaying || !this.currentTrack) return;
      if (useMediaElement && this.mediaElement) {
        this.positionSec = this.mediaElement.currentTime;
      } else {
        this.positionSec += 0.25;
        if (this.positionSec >= this.currentTrack.durationSec) {
          this.positionSec = 0;
          this.stopTimers();
          this.isPlaying = false;
          this.onTickCallback?.(0);
          this.onEndedCallback?.();
          return;
        }
      }
      this.onTickCallback?.(this.positionSec);
    }, 250);
  }

  private stopCurrentSource() {
    this.stopTimers();
    this.stopSynthNodes();
    if (this.mediaElement) {
      this.mediaElement.pause();
    }
  }

  private stopSynthNodes() {
    if (this.synthInterval !== null) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.synthActiveNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // already stopped
      }
    });
    this.synthActiveNodes = [];
  }

  private stopProgressTimer() {
    if (this.progressTimer !== null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private stopTimers() {
    if (this.synthInterval !== null) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.stopProgressTimer();
  }

  public destroy() {
    this.stopCurrentSource();
    this.ctx?.close();
    this.ctx = null;
  }
}

export const audioEngine = new AGMusicAudioEngine();
