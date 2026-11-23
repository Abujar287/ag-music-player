import { AccentOption, AppSettings, EqualizerState, EqPresetId, Playlist, Track } from '../types/music';

export const APP_VERSION = '1.0.1';
export const APP_VERSION_TAG = `V-${APP_VERSION}`;
export const GITHUB_REPO = 'Abujar287/ag-music-player';
export const GITHUB_LATEST_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export const LOGO_IMAGE_URL = './src/assets/images/ag_music_player_logo_1795412483987.jpg';

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: 'gold',
    label: 'Metallic Gold',
    hex: '#D4AF37',
    hoverHex: '#E5C158',
    fgHex: '#0B0B0D',
    softRgba: 'rgba(212, 175, 55, 0.14)',
  },
  {
    id: 'amber',
    label: 'Warm Amber',
    hex: '#F59E0B',
    hoverHex: '#FBBF24',
    fgHex: '#0B0B0D',
    softRgba: 'rgba(245, 158, 11, 0.14)',
  },
  {
    id: 'crimson',
    label: 'Studio Crimson',
    hex: '#E11D48',
    hoverHex: '#F43F5E',
    fgHex: '#FFFFFF',
    softRgba: 'rgba(225, 29, 72, 0.14)',
  },
  {
    id: 'emerald',
    label: 'Jade Emerald',
    hex: '#10B981',
    hoverHex: '#34D399',
    fgHex: '#062016',
    softRgba: 'rgba(16, 185, 129, 0.14)',
  },
  {
    id: 'violet',
    label: 'Royal Violet',
    hex: '#8B5CF6',
    hoverHex: '#A78BFA',
    fgHex: '#FFFFFF',
    softRgba: 'rgba(139, 92, 246, 0.14)',
  },
];

export const EQ_PRESETS: Record<EqPresetId, { label: string; bands: [number, number, number, number, number] }> = {
  normal: { label: 'Normal', bands: [0, 0, 0, 0, 0] },
  bass_boost: { label: 'Bass Boost', bands: [7, 4, 0, 1, 2] },
  rock: { label: 'Rock', bands: [5, 2, -2, 3, 5] },
  pop: { label: 'Pop', bands: [-1, 3, 5, 2, -1] },
  classical: { label: 'Classical', bands: [4, 2, -1, 3, 4] },
  custom: { label: 'Custom', bands: [2, 1, 0, 2, 3] },
};

export const EQ_FREQUENCIES = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];

export const DEFAULT_EQUALIZER: EqualizerState = {
  enabled: true,
  preset: 'normal',
  bands: [0, 0, 0, 0, 0],
  virtualizer: 35,
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'dark',
  accentId: 'gold',
  autoSyncPermission: true,
  filterShortClips: true,
  minDurationSec: 30,
  minSizeKb: 500,
  hiddenFolders: [],
  gaplessPlayback: true,
  crossfadeSec: 3,
  fadeOnPause: true,
  headsetAutoPlay: true,
  headsetAutoPause: true,
  lockScreenArt: true,
  notificationControls: true,
};

export const DEFAULT_TRACKS: Track[] = [];

export const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-favorites',
    name: 'Late Night Vinyl',
    trackIds: ['trk-obsidian-1', 'trk-nocturne-1', 'trk-golden-1'],
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'pl-focus',
    name: 'Deep Studio Focus',
    trackIds: ['trk-golden-1', 'trk-desert-1', 'trk-obsidian-2'],
    createdAt: Date.now() - 86400000,
  },
];
