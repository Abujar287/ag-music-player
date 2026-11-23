export type LibraryTab = 'tracks' | 'albums' | 'artists' | 'genres' | 'videos' | 'folders';

export type RepeatMode = 'off' | 'one' | 'all';

export type EqPresetId = 'normal' | 'bass_boost' | 'rock' | 'pop' | 'classical' | 'custom';

export interface AccentOption {
  id: string;
  label: string;
  hex: string;
  hoverHex: string;
  fgHex: string;
  softRgba: string;
}

export interface SynthProfile {
  bpm: number;
  rootHz: number;
  chords: number[][];
  waveform: OscillatorType;
  brightnessHz: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  folder: string;
  mediaType?: 'audio' | 'video';
  durationSec: number;
  sizeKb: number;
  coverUrl: string | null;
  audioUrl?: string; // Object URL for imported local audio files
  contentUri?: string;
  filePath?: string;
  nativeArtUri?: string;
  isLocalImport?: boolean;
  isFavorite: boolean;
  synthProfile?: SynthProfile;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface EqualizerState {
  enabled: boolean;
  preset: EqPresetId;
  bands: [number, number, number, number, number]; // dB (-12 to +12) at 60Hz, 230Hz, 910Hz, 3.6kHz, 14kHz
  virtualizer: number; // 0 to 100
}

export interface AppSettings {
  themeMode: 'dark' | 'light';
  accentId: string;
  autoSyncPermission: boolean;
  filterShortClips: boolean;
  minDurationSec: number;
  minSizeKb: number;
  hiddenFolders: string[];
  gaplessPlayback: boolean;
  crossfadeSec: number;
  fadeOnPause: boolean;
  headsetAutoPlay: boolean;
  headsetAutoPause: boolean;
  lockScreenArt: boolean;
  notificationControls: boolean;
}

export interface SleepTimerState {
  active: boolean;
  mode: '15m' | '30m' | '45m' | '60m' | 'end_of_track' | 'custom' | null;
  remainingSec: number;
}

export interface GitHubReleaseInfo {
  tagName: string;
  version: string;
  name: string;
  body: string;
  apkName: string;
  apkUrl: string;
  apkSizeBytes: number;
  publishedAt: string;
  isSimulated?: boolean;
}

export type UpdateFlowState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up_to_date'; currentVersion: string; note?: string }
  | { status: 'available'; release: GitHubReleaseInfo }
  | { status: 'downloading'; release: GitHubReleaseInfo; progress: number; downloadedBytes: number; totalBytes: number }
  | { status: 'ready_to_install'; release: GitHubReleaseInfo; blobUrl?: string }
  | { status: 'error'; message: string };
