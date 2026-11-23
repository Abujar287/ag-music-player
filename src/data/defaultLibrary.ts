import {
  AccentOption,
  AppSettings,
  EqualizerState,
  EqPresetId,
  Playlist,
  ScenicThemeOption,
  Track,
} from '../types/music';

export const APP_VERSION = '1.0.1';
export const APP_VERSION_TAG = `V-${APP_VERSION}`;
export const GITHUB_REPO = 'Abujar287/ag-music-player';
export const GITHUB_LATEST_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export const LOGO_IMAGE_URL = './src/assets/images/ag_music_player_logo_1795412483987.jpg';

export const SCENIC_THEMES: ScenicThemeOption[] = [
  {
    id: 'midnight_gold',
    label: 'Midnight Sapphire',
    subtitle: 'Deep scenic blue & golden yellow',
    fromRgba: 'rgba(7, 24, 54, 0.65)',
    viaRgba: 'rgba(9, 31, 68, 0.72)',
    toRgba: 'rgba(5, 16, 36, 0.92)',
    surfaceRgba: 'rgba(11, 33, 69, 0.52)',
    accentHex: '#F5C542',
    accentHoverHex: '#FFD666',
    accentFgHex: '#071836',
    accentSoftRgba: 'rgba(245, 197, 66, 0.16)',
    previewGradient: 'linear-gradient(135deg, #0B2552 0%, #071836 60%, #051024 100%)',
    cardBgHex: '#081B3B',
  },
  {
    id: 'obsidian_dark',
    label: 'Obsidian Dark',
    subtitle: 'Obsidian glass & electric violet',
    fromRgba: 'rgba(10, 10, 16, 0.88)',
    viaRgba: 'rgba(13, 13, 22, 0.92)',
    toRgba: 'rgba(8, 8, 14, 0.97)',
    surfaceRgba: 'rgba(22, 22, 34, 0.72)',
    accentHex: '#8B5CF6',
    accentHoverHex: '#A78BFA',
    accentFgHex: '#FFFFFF',
    accentSoftRgba: 'rgba(139, 92, 246, 0.18)',
    previewGradient: 'linear-gradient(135deg, #171526 0%, #0D0D14 60%, #08080E 100%)',
    cardBgHex: '#0D0D14',
  },
  {
    id: 'oled_black',
    label: 'OLED Pure Black',
    subtitle: 'True pitch black & luminous cyan',
    fromRgba: 'rgba(0, 0, 0, 0.96)',
    viaRgba: 'rgba(0, 0, 0, 0.98)',
    toRgba: 'rgba(0, 0, 0, 1)',
    surfaceRgba: 'rgba(16, 16, 22, 0.86)',
    accentHex: '#22D3EE',
    accentHoverHex: '#67E8F9',
    accentFgHex: '#041C24',
    accentSoftRgba: 'rgba(34, 211, 238, 0.16)',
    previewGradient: 'linear-gradient(135deg, #0B0E14 0%, #000000 65%, #000000 100%)',
    cardBgHex: '#000000',
  },
  {
    id: 'aurora_gradient',
    label: 'Aurora Gradient',
    subtitle: 'Nocturnal violet-cyan aurora mesh',
    fromRgba: 'rgba(14, 20, 48, 0.76)',
    viaRgba: 'rgba(10, 28, 52, 0.82)',
    toRgba: 'rgba(7, 16, 36, 0.94)',
    surfaceRgba: 'rgba(18, 34, 66, 0.58)',
    accentHex: '#22D3EE',
    accentHoverHex: '#67E8F9',
    accentFgHex: '#041E2E',
    accentSoftRgba: 'rgba(34, 211, 238, 0.16)',
    previewGradient: 'linear-gradient(135deg, #312E81 0%, #0E3A5C 55%, #071A2F 100%)',
    cardBgHex: '#0E2442',
  },
  {
    id: 'dynamic_tint',
    label: 'Dynamic Album Tint',
    subtitle: 'Adaptive tone synced to track artwork',
    fromRgba: 'rgba(19, 17, 46, 0.78)',
    viaRgba: 'rgba(14, 20, 44, 0.84)',
    toRgba: 'rgba(8, 10, 26, 0.95)',
    surfaceRgba: 'rgba(28, 25, 68, 0.62)',
    accentHex: '#A78BFA',
    accentHoverHex: '#C4B5FD',
    accentFgHex: '#120C28',
    accentSoftRgba: 'rgba(167, 139, 250, 0.18)',
    previewGradient: 'linear-gradient(135deg, #4C1D95 0%, #1E1B4B 55%, #090D1E 100%)',
    cardBgHex: '#151436',
  },
];

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: 'violet',
    label: 'Electric Violet',
    hex: '#8B5CF6',
    hoverHex: '#A78BFA',
    fgHex: '#FFFFFF',
    softRgba: 'rgba(139, 92, 246, 0.18)',
  },
  {
    id: 'cyan',
    label: 'Electric Cyan',
    hex: '#22D3EE',
    hoverHex: '#67E8F9',
    fgHex: '#041E2E',
    softRgba: 'rgba(34, 211, 238, 0.16)',
  },
  {
    id: 'gold',
    label: 'Golden Yellow',
    hex: '#F5C542',
    hoverHex: '#FFD666',
    fgHex: '#071836',
    softRgba: 'rgba(245, 197, 66, 0.16)',
  },
  {
    id: 'emerald',
    label: 'Aurora Mint',
    hex: '#34D399',
    hoverHex: '#6EE7B7',
    fgHex: '#041F1A',
    softRgba: 'rgba(52, 211, 153, 0.16)',
  },
  {
    id: 'crimson',
    label: 'Coral Rose',
    hex: '#FB7185',
    hoverHex: '#FDA4AF',
    fgHex: '#1F0812',
    softRgba: 'rgba(251, 113, 133, 0.16)',
  },
];

export const EQ_PRESETS: Record<EqPresetId, { label: string; bands: [number, number, number, number, number] }> = {
  flat: { label: 'Flat', bands: [0, 0, 0, 0, 0] },
  normal: { label: 'Normal', bands: [0, 0, 0, 0, 0] },
  bass_boost: { label: 'Bass Boost', bands: [8, 5, 1, 0, 2] },
  vocal: { label: 'Vocal', bands: [-2, 1, 5, 4, 1] },
  rock: { label: 'Rock', bands: [5, 2, -2, 3, 6] },
  electronic: { label: 'Electronic', bands: [6, 3, -1, 4, 5] },
  pop: { label: 'Pop', bands: [-1, 3, 5, 2, -1] },
  classical: { label: 'Classical', bands: [4, 2, -1, 3, 4] },
  custom: { label: 'Custom', bands: [3, 1, 0, 2, 4] },
};

export const EQ_FREQUENCIES = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];

export const DEFAULT_EQUALIZER: EqualizerState = {
  enabled: true,
  preset: 'flat',
  bands: [0, 0, 0, 0, 0],
  virtualizer: 35,
  bassBoost: 40,
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'dark',
  accentId: 'gold',
  scenicThemeId: 'midnight_gold',
  autoTheme: false,
  audioQuality: 'lossless',
  widgetStyle: 'frosted',
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

export const DEFAULT_PLAYLISTS: Playlist[] = [];
