import {
  AccentOption,
  AppSettings,
  ClassicThemeOption,
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

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function makeSolidClassicTheme(
  id: string,
  label: string,
  hex: string,
  fgHex: string,
  backdropHex: string
): ClassicThemeOption {
  const [ar, ag, ab] = hexToRgbTuple(hex);
  const [br, bg, bb] = hexToRgbTuple(backdropHex);
  return {
    id,
    label,
    subtitle: 'Classic solid theme',
    topHex: hex,
    isSplit: false,
    fromRgba: `rgba(${br}, ${bg}, ${bb}, 0.84)`,
    viaRgba: `rgba(${br}, ${bg}, ${bb}, 0.88)`,
    toRgba: `rgba(${Math.max(0, br - 10)}, ${Math.max(0, bg - 10)}, ${Math.max(0, bb - 10)}, 0.96)`,
    surfaceRgba: `rgba(${Math.min(255, br + 16)}, ${Math.min(255, bg + 16)}, ${Math.min(255, bb + 16)}, 0.62)`,
    accentHex: hex,
    accentHoverHex: hex,
    accentFgHex: fgHex,
    accentSoftRgba: `rgba(${ar}, ${ag}, ${ab}, 0.2)`,
    previewGradient: hex,
    cardBgHex: backdropHex,
  };
}

function makeSplitClassicTheme(
  id: string,
  label: string,
  topHex: string,
  bottomHex: string,
  fgHex: string
): ClassicThemeOption {
  const [ar, ag, ab] = hexToRgbTuple(topHex);
  const [br, bg, bb] = hexToRgbTuple(bottomHex);
  return {
    id,
    label,
    subtitle: 'Classic split theme',
    topHex,
    bottomHex,
    isSplit: true,
    fromRgba: `rgba(${br}, ${bg}, ${bb}, 0.88)`,
    viaRgba: `rgba(${br}, ${bg}, ${bb}, 0.92)`,
    toRgba: `rgba(${Math.max(0, br - 8)}, ${Math.max(0, bg - 8)}, ${Math.max(0, bb - 8)}, 0.98)`,
    surfaceRgba: `rgba(${Math.min(255, br + 14)}, ${Math.min(255, bg + 14)}, ${Math.min(255, bb + 14)}, 0.72)`,
    accentHex: topHex,
    accentHoverHex: topHex,
    accentFgHex: fgHex,
    accentSoftRgba: `rgba(${ar}, ${ag}, ${ab}, 0.18)`,
    previewGradient: `linear-gradient(180deg, ${topHex} 50%, ${bottomHex} 50%)`,
    cardBgHex: bottomHex,
  };
}

export const CLASSIC_THEMES: ClassicThemeOption[] = [
  // Row 1 — Solid swatches
  makeSolidClassicTheme('classic_coral_red', 'Coral Red', '#F6644F', '#FFFFFF', '#3B1612'),
  makeSolidClassicTheme('classic_warm_peach', 'Warm Peach', '#FF9955', '#18110B', '#3A2112'),
  makeSolidClassicTheme('classic_sunny_amber', 'Sunny Amber', '#FFC72C', '#181408', '#33280B'),
  makeSolidClassicTheme('classic_cocoa_brown', 'Cocoa Brown', '#8C4E37', '#FFFFFF', '#2B1812'),
  makeSolidClassicTheme('classic_chartreuse_lime', 'Chartreuse Lime', '#C4D600', '#141706', '#252909'),
  makeSolidClassicTheme('classic_fresh_lime', 'Fresh Lime', '#8CE043', '#101A09', '#1B2D0F'),

  // Row 2 — Solid swatches
  makeSolidClassicTheme('classic_leaf_green', 'Leaf Green', '#32C759', '#091A0E', '#0E2E17'),
  makeSolidClassicTheme('classic_emerald_teal', 'Emerald Teal', '#10B981', '#FFFFFF', '#092B20'),
  makeSolidClassicTheme('classic_sky_cyan', 'Sky Cyan', '#47B8F5', '#091824', '#0F2A3E'),
  makeSolidClassicTheme('classic_cerulean_blue', 'Cerulean Blue', '#4A89DC', '#FFFFFF', '#10223B'),
  makeSolidClassicTheme('classic_royal_indigo', 'Royal Indigo', '#4B6EF5', '#FFFFFF', '#121B40'),
  makeSolidClassicTheme('classic_soft_violet', 'Soft Violet', '#9B6EF3', '#FFFFFF', '#21153B'),

  // Row 3 — Solid & Split swatches
  makeSolidClassicTheme('classic_orchid_magenta', 'Orchid Magenta', '#DA62E8', '#FFFFFF', '#321338'),
  makeSolidClassicTheme('classic_rose_pink', 'Rose Pink', '#FF4D94', '#FFFFFF', '#381022'),
  makeSolidClassicTheme('classic_cool_mist', 'Cool Mist', '#E2E6EC', '#111622', '#262C38'),
  makeSplitClassicTheme('classic_coral_dark_split', 'Coral Dark Split', '#F6644F', '#252830', '#FFFFFF'),
  makeSplitClassicTheme('classic_peach_dark_split', 'Peach Dark Split', '#FF9955', '#252830', '#18110B'),
  makeSplitClassicTheme('classic_amber_dark_split', 'Amber Dark Split', '#FFC72C', '#2A2D2B', '#181408'),

  // Row 4 — Split swatches
  makeSplitClassicTheme('classic_cocoa_dark_split', 'Cocoa Dark Split', '#8C4E37', '#1E242B', '#FFFFFF'),
  makeSplitClassicTheme('classic_lime_dark_split', 'Lime Dark Split', '#C4D600', '#252B25', '#141706'),
  makeSplitClassicTheme('classic_fresh_lime_dark_split', 'Fresh Lime Dark Split', '#8CE043', '#232B26', '#101A09'),
  makeSplitClassicTheme('classic_leaf_green_dark_split', 'Leaf Green Dark Split', '#32C759', '#1D2E2A', '#091A0E'),
  makeSplitClassicTheme('classic_emerald_dark_split', 'Emerald Dark Split', '#10B981', '#172E2C', '#FFFFFF'),
  makeSplitClassicTheme('classic_sky_cyan_dark_split', 'Sky Cyan Dark Split', '#47B8F5', '#172A3A', '#091824'),

  // Row 5 — Split swatches
  makeSplitClassicTheme('classic_cerulean_dark_split', 'Cerulean Dark Split', '#4A89DC', '#17283E', '#FFFFFF'),
  makeSplitClassicTheme('classic_royal_indigo_dark_split', 'Royal Indigo Dark Split', '#4B6EF5', '#18223D', '#FFFFFF'),
  makeSplitClassicTheme('classic_violet_dark_split', 'Violet Dark Split', '#9B6EF3', '#241E3B', '#FFFFFF'),
  makeSplitClassicTheme('classic_orchid_dark_split', 'Orchid Dark Split', '#DA62E8', '#2F1D38', '#FFFFFF'),
  makeSplitClassicTheme('classic_rose_pink_dark_split', 'Rose Pink Dark Split', '#FF4D94', '#331D2B', '#FFFFFF'),
  makeSplitClassicTheme('classic_berry_plum_split', 'Berry Plum Split', '#E84A8A', '#262133', '#FFFFFF'),

  // Row 6 — Split swatch
  makeSplitClassicTheme('classic_deep_berry_split', 'Deep Berry Split', '#E54886', '#241F31', '#FFFFFF'),
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

export const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-recent-played',
    name: 'Recent Played',
    trackIds: [],
    createdAt: 1,
    systemType: 'recent_played',
  },
  {
    id: 'pl-favourite',
    name: 'Favourite',
    trackIds: [],
    createdAt: 2,
    systemType: 'favourite',
  },
  {
    id: 'pl-most-played',
    name: 'Most Played',
    trackIds: [],
    createdAt: 3,
    systemType: 'most_played',
  },
  {
    id: 'pl-recent-added',
    name: 'Recent Added',
    trackIds: [],
    createdAt: 4,
    systemType: 'recent_added',
  },
];
