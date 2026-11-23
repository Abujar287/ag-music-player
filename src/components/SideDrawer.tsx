import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Palette,
  Sliders,
  LayoutGrid,
  Settings as SettingsIcon,
  RefreshCw,
  Check,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Disc3,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Sparkles,
  FolderSearch,
  Info,
} from 'lucide-react';
import {
  ACCENT_OPTIONS,
  APP_VERSION_TAG,
  EQ_FREQUENCIES,
  EQ_PRESETS,
  LOGO_IMAGE_URL,
  SCENIC_THEMES,
} from '../data/defaultLibrary';
import { AppSettings, EqualizerState, EqPresetId, Track } from '../types/music';
import { formatTime } from '../utils/formatters';
import { CoverImage } from './CoverImage';
import { ScenicBackdrop } from './ScenicBackdrop';

export type DrawerSection = 'menu' | 'theme' | 'equalizer' | 'widget' | 'settings';

interface SideDrawerProps {
  open: boolean;
  initialSection?: DrawerSection;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  equalizer: EqualizerState;
  onUpdateEqualizer: (next: EqualizerState) => void;
  onCheckUpdate: () => void;
  currentTrack: Track | null;
  positionSec?: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRescanLibrary?: () => void;
}

const MENU_LIST: Array<{
  id: Exclude<DrawerSection, 'menu'>;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'theme',
    label: 'Appearance & Themes',
    subtitle: 'Dark, OLED Black, Dynamic Accent & previews',
    icon: Palette,
  },
  {
    id: 'equalizer',
    label: 'Equalizer',
    subtitle: '5-band DSP curve, presets & bass boost',
    icon: Sliders,
  },
  {
    id: 'widget',
    label: 'Home Screen Widget',
    subtitle: '2×2 & 4×2 widget styles',
    icon: LayoutGrid,
  },
  {
    id: 'settings',
    label: 'Settings',
    subtitle: 'Audio, playback, library & about',
    icon: SettingsIcon,
  },
];

const SCENIC_ACCENT_MAP: Record<string, string> = {
  midnight_gold: 'gold',
  obsidian_dark: 'violet',
  oled_black: 'cyan',
  aurora_gradient: 'cyan',
  dynamic_tint: 'violet',
};

const DISPLAY_EQ_PRESETS: EqPresetId[] = [
  'flat',
  'bass_boost',
  'vocal',
  'rock',
  'electronic',
  'custom',
];

function buildSmoothCurvePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

interface VerticalEqSliderProps {
  freq: string;
  db: number;
  disabled: boolean;
  onChange: (nextDb: number) => void;
}

const VerticalEqSlider: React.FC<VerticalEqSliderProps> = ({
  freq,
  db,
  disabled,
  onChange,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const updateFromClientY = (clientY: number) => {
    const el = trackRef.current;
    if (!el || disabled) return;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return;
    const ratio = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
    const nextDb = Math.round(ratio * 24 - 12);
    if (nextDb !== db) {
      onChange(nextDb);
    }
  };

  const percent = ((db + 12) / 24) * 100;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <span
        className={`text-[11px] font-mono-tabular font-semibold ${
          disabled ? 'text-white/40' : 'text-[var(--accent)]'
        }`}
      >
        {db > 0 ? `+${db}` : db}
      </span>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${freq} band`}
        aria-valuemin={-12}
        aria-valuemax={12}
        aria-valuenow={db}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            onChange(Math.min(12, db + 1));
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            onChange(Math.max(-12, db - 1));
          }
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientY(e.clientY);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          updateFromClientY(e.clientY);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        className={`relative h-32 w-9 flex items-center justify-center touch-none ${
          disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {/* Rail */}
        <div className="relative w-1.5 h-full rounded-full bg-white/12 overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75"
            style={{
              height: `${percent}%`,
              backgroundColor: 'var(--accent)',
            }}
          />
        </div>
        {/* Zero tick */}
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-px bg-white/20 pointer-events-none" />
        {/* Thumb */}
        <div
          className="absolute w-4 h-4 rounded-full bg-white border-2 border-[var(--accent)] shadow pointer-events-none transition-all duration-75"
          style={{
            bottom: `calc(${percent}% - 8px)`,
          }}
        />
      </div>

      <span className="text-[11px] font-mono-tabular text-white/65">{freq}</span>
    </div>
  );
};

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

const ToggleSwitchRow: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  icon,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="w-full min-h-[52px] px-3.5 py-2.5 flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-left transition-colors"
  >
    <div className="min-w-0 pr-2">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-medium text-white truncate">{label}</p>
      </div>
      {description && <p className="text-xs text-white/60 mt-0.5 leading-snug">{description}</p>}
    </div>
    <span
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-[var(--accent)]' : 'bg-white/20'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </span>
  </button>
);

export const SideDrawer: React.FC<SideDrawerProps> = ({
  open,
  initialSection = 'menu',
  onClose,
  settings,
  onUpdateSettings,
  equalizer,
  onUpdateEqualizer,
  onCheckUpdate,
  currentTrack,
  positionSec = 0,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onRescanLibrary,
}) => {
  const [activeSection, setActiveSection] = useState<DrawerSection>(initialSection);

  useEffect(() => {
    if (open) {
      setActiveSection(initialSection);
    }
  }, [open, initialSection]);

  const dynamicVersion = React.useMemo(() => {
    try {
      const bridge = (window as unknown as { AndroidBridge?: { getVersionName?: () => string } })
        .AndroidBridge;
      if (bridge && typeof bridge.getVersionName === 'function') {
        return `V-${bridge.getVersionName()}`;
      }
    } catch {
      // ignore
    }
    return APP_VERSION_TAG;
  }, []);

  if (!open) return null;

  const handleClose = () => {
    setActiveSection('menu');
    onClose();
  };

  const handleSelectScenicTheme = (scenicThemeId: string) => {
    const mappedAccent = SCENIC_ACCENT_MAP[scenicThemeId];
    onUpdateSettings({
      scenicThemeId,
      ...(mappedAccent ? { accentId: mappedAccent } : {}),
    });
  };

  const handlePresetClick = (presetId: EqPresetId) => {
    const presetBands = EQ_PRESETS[presetId].bands;
    onUpdateEqualizer({
      ...equalizer,
      enabled: true,
      preset: presetId,
      bands: [...presetBands] as [number, number, number, number, number],
    });
  };

  const handleBandChange = (index: number, val: number) => {
    const nextBands = [...equalizer.bands] as [number, number, number, number, number];
    nextBands[index] = val;
    onUpdateEqualizer({
      ...equalizer,
      enabled: true,
      preset: 'custom',
      bands: nextBands,
    });
  };

  const activeMenuMeta = MENU_LIST.find((m) => m.id === activeSection);
  const currentScenicId = settings.scenicThemeId ?? 'midnight_gold';
  const currentThemeObj =
    SCENIC_THEMES.find((t) => t.id === currentScenicId) ?? SCENIC_THEMES[0];
  const currentWidgetStyle = settings.widgetStyle ?? 'frosted';
  const currentAudioQuality = settings.audioQuality ?? 'lossless';
  const bassBoostValue = equalizer.bassBoost ?? 40;

  const progressRatio =
    currentTrack && currentTrack.durationSec > 0
      ? Math.min(100, Math.max(0, (positionSec / currentTrack.durationSec) * 100))
      : 42;

  const eqPoints = equalizer.bands.map((db, idx) => ({
    x: 24 + idx * 63,
    y: 55 - (db / 12) * 38,
  }));
  const eqCurveD = buildSmoothCurvePath(eqPoints);
  const eqAreaD = `${eqCurveD} L ${eqPoints[eqPoints.length - 1].x} 102 L ${eqPoints[0].x} 102 Z`;

  const widgetContainerClass =
    currentWidgetStyle === 'obsidian'
      ? 'bg-[#08090F]/95 border border-white/10'
      : currentWidgetStyle === 'vibrant'
        ? 'bg-[var(--accent-soft)] backdrop-blur-2xl border border-[var(--accent)]/35'
        : 'bg-white/[0.08] backdrop-blur-2xl border border-white/15';

  return (
    <div className="fixed inset-0 z-[60] flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside className="relative z-10 flex h-full w-full max-w-[380px] flex-col bg-[#080A12] text-white border-r border-white/10 shadow-2xl overflow-hidden">
        <ScenicBackdrop className="absolute inset-0 z-0" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={LOGO_IMAGE_URL}
              alt="AG Music Player emblem"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover border border-[var(--accent)]/60 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">
                AG Music Player
              </h2>
              <p className="text-xs text-white/60 truncate">{dynamicVersion}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close menu"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-view Back Bar */}
        {activeSection !== 'menu' && (
          <div className="relative z-10 px-3 py-2 border-b border-white/10 bg-white/[0.04] backdrop-blur-md flex items-center gap-2">
            <button
              onClick={() => setActiveSection('menu')}
              className="min-h-[40px] px-2.5 rounded-xl hover:bg-white/10 flex items-center gap-1.5 text-sm font-semibold text-white"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--accent)]" />
              <span>Menu</span>
            </button>
            <span className="text-xs text-white/45">/</span>
            <span className="text-sm font-semibold text-white">{activeMenuMeta?.label}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* MAIN DRAWER MENU */}
          {activeSection === 'menu' && (
            <nav aria-label="Drawer Menu" className="space-y-2">
              {MENU_LIST.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className="w-full min-h-[62px] px-3.5 py-3 flex items-center gap-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-white/65 truncate">{item.subtitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/60 shrink-0" />
                  </button>
                );
              })}
            </nav>
          )}

          {/* THEME CUSTOMIZATION SCREEN */}
          {activeSection === 'theme' && (
            <div className="space-y-6 pb-4">
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Theme Presets</h3>
                      <p className="text-[11px] text-white/60">Tap to instantly apply & preview</p>
                    </div>
                  </div>
                </div>

                {/* Live Mini-Player Preview Cards */}
                <div className="grid grid-cols-1 gap-3">
                  {SCENIC_THEMES.map((theme) => {
                    const selected = currentScenicId === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => handleSelectScenicTheme(theme.id)}
                        className={`w-full p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                          selected
                            ? 'border-[var(--accent)] bg-white/[0.09] shadow-[0_0_24px_rgba(245,197,66,0.15)] ring-1 ring-[var(--accent)]'
                            : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/20'
                        }`}
                      >
                        {selected && (
                          <div
                            className="absolute top-0 right-0 w-24 h-24 pointer-events-none opacity-20 rounded-bl-full"
                            style={{ background: theme.accentHex }}
                          />
                        )}
                        <div className="flex items-center justify-between mb-3 relative z-10">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate flex items-center gap-2">
                              <span>{theme.label}</span>
                              {selected && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--accent)] text-[var(--accent-fg)]">
                                  Active
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-white/60 truncate mt-0.5">{theme.subtitle}</p>
                          </div>
                          {selected && (
                            <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center shrink-0 shadow-md">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>

                        {/* Embedded Live Mini-Player Preview */}
                        <div
                          className="rounded-xl p-3 border border-white/12 space-y-2.5 relative z-10 shadow-inner"
                          style={{ background: theme.previewGradient }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-white/20 shadow-sm"
                              style={{ backgroundColor: theme.accentSoftRgba }}
                            >
                              <Disc3 className="w-4 h-4" style={{ color: theme.accentHex }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {currentTrack?.title ?? 'Midnight Resonance'}
                              </p>
                              <p className="text-[10px] text-white/65 truncate">
                                {currentTrack?.artist ?? 'AG Audio Engine'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center shadow"
                                style={{
                                  backgroundColor: theme.accentHex,
                                  color: theme.accentFgHex,
                                }}
                              >
                                <Play className="w-3 h-3 fill-current ml-0.5" />
                              </span>
                            </div>
                          </div>
                          <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: '62%',
                                backgroundColor: theme.accentHex,
                              }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color Swatches */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Accent Hue</h3>
                  <span className="text-[11px] text-white/60">Global UI highlight</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                  {ACCENT_OPTIONS.map((opt) => {
                    const selected = settings.accentId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onUpdateSettings({ accentId: opt.id })}
                        aria-label={opt.label}
                        title={opt.label}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
                          selected
                            ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0A0C16]'
                            : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: opt.hex }}
                      >
                        {selected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System / Auto-Theme Toggle */}
              <div className="space-y-2 pt-3 border-t border-white/10">
                <ToggleSwitchRow
                  checked={Boolean(settings.autoTheme)}
                  onChange={(next) => onUpdateSettings({ autoTheme: next })}
                  label="System / Auto Theme"
                  description="Match theme brightness with device system mode"
                />
              </div>
            </div>
          )}

          {/* EQUALIZER (EQ) SCREEN */}
          {activeSection === 'equalizer' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">5-Band Equalizer</h3>
                  <p className="text-xs text-white/65">Frequency response & DSP</p>
                </div>
                <button
                  onClick={() => onUpdateEqualizer({ ...equalizer, enabled: !equalizer.enabled })}
                  className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold transition-colors ${
                    equalizer.enabled
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm'
                      : 'bg-white/10 text-white/70'
                  }`}
                >
                  {equalizer.enabled ? 'Active' : 'Bypassed'}
                </button>
              </div>

              {/* Real-Time Frequency Curve Graph (Single Accent Color) */}
              <div className="p-3 rounded-2xl bg-black/35 backdrop-blur-xl border border-white/10">
                <div className="flex items-center justify-between text-[11px] font-mono-tabular text-white/55 mb-1 px-1">
                  <span>+12 dB</span>
                  <span>0 dB</span>
                  <span>-12 dB</span>
                </div>
                <svg
                  viewBox="0 0 300 110"
                  className={`w-full h-28 overflow-visible transition-opacity ${
                    equalizer.enabled ? 'opacity-100' : 'opacity-40'
                  }`}
                  aria-label="Real-time frequency response curve"
                >
                  <line x1="12" y1="17" x2="288" y2="17" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <line x1="12" y1="55" x2="288" y2="55" stroke="rgba(255,255,255,0.18)" />
                  <line x1="12" y1="93" x2="288" y2="93" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />

                  <path d={eqAreaD} fill="var(--accent-soft)" />
                  <path
                    d={eqCurveD}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {eqPoints.map((pt, idx) => (
                    <circle
                      key={EQ_FREQUENCIES[idx]}
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="#FFFFFF"
                      stroke="var(--accent)"
                      strokeWidth="2"
                    />
                  ))}
                </svg>
              </div>

              {/* Interactive Vertical Frequency Sliders */}
              <div className="p-3.5 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10">
                <div className="grid grid-cols-5 gap-1">
                  {EQ_FREQUENCIES.map((freq, idx) => (
                    <VerticalEqSlider
                      key={freq}
                      freq={freq}
                      db={equalizer.bands[idx]}
                      disabled={!equalizer.enabled}
                      onChange={(val) => handleBandChange(idx, val)}
                    />
                  ))}
                </div>
              </div>

              {/* Preset Buttons */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-white/65">Presets</p>
                <div className="grid grid-cols-3 gap-2">
                  {DISPLAY_EQ_PRESETS.map((presetKey) => {
                    const active =
                      equalizer.preset === presetKey ||
                      (presetKey === 'flat' && equalizer.preset === 'normal');
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => handlePresetClick(presetKey)}
                        className={`min-h-[38px] px-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                          active
                            ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)] font-semibold'
                            : 'bg-white/[0.05] text-white/80 border border-white/10 hover:bg-white/[0.1]'
                        }`}
                      >
                        {EQ_PRESETS[presetKey].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bass Boost & Stereo Virtualizer */}
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Bass Boost</span>
                    <span className="font-mono-tabular text-[var(--accent)] font-semibold">
                      {bassBoostValue}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={bassBoostValue}
                    disabled={!equalizer.enabled}
                    onChange={(e) => {
                      const nextBass = Number(e.target.value);
                      const nextBands = [...equalizer.bands] as [number, number, number, number, number];
                      nextBands[0] = Math.round((nextBass / 100) * 10);
                      onUpdateEqualizer({
                        ...equalizer,
                        bassBoost: nextBass,
                        bands: nextBands,
                        preset: 'custom',
                      });
                    }}
                    className="ag-slider w-full bg-white/15 rounded-full h-1.5"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Stereo Virtualizer</span>
                    <span className="font-mono-tabular text-[var(--accent)] font-semibold">
                      {equalizer.virtualizer}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={equalizer.virtualizer}
                    disabled={!equalizer.enabled}
                    onChange={(e) =>
                      onUpdateEqualizer({ ...equalizer, virtualizer: Number(e.target.value) })
                    }
                    className="ag-slider w-full bg-white/15 rounded-full h-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* HOME SCREEN WIDGET SHOWCASE */}
          {activeSection === 'widget' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white">Home Screen Widget</h3>
                <p className="text-xs text-white/65 mt-0.5">
                  2×2 compact & 4×2 wide widget styles
                </p>
              </div>

              {/* Widget Style Selector */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/[0.05] border border-white/10">
                {(
                  [
                    { id: 'frosted', label: 'Frosted' },
                    { id: 'obsidian', label: 'Obsidian' },
                    { id: 'vibrant', label: 'Accent' },
                  ] as const
                ).map((styleOpt) => (
                  <button
                    key={styleOpt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ widgetStyle: styleOpt.id })}
                    className={`min-h-[34px] rounded-lg text-xs font-medium transition-colors ${
                      currentWidgetStyle === styleOpt.id
                        ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                        : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {styleOpt.label}
                  </button>
                ))}
              </div>

              {/* Compact 2x2 Widget Card */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-white/70">2 × 2 Compact Widget</span>
                <div className="flex justify-start">
                  <div
                    className={`w-[210px] aspect-square p-3.5 rounded-3xl flex flex-col justify-between shadow-2xl ${widgetContainerClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <CoverImage
                        src={currentTrack?.coverUrl}
                        alt={currentTrack?.title ?? 'Album art'}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/15"
                        fallback={
                          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                            <Disc3 className="w-6 h-6 text-[var(--accent)]" />
                          </div>
                        }
                      />
                      <span className="text-[10px] font-mono-tabular text-[var(--accent)]">AG</span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-bold text-white truncate">
                        {currentTrack?.title ?? 'Midnight Resonance'}
                      </p>
                      <p className="text-[11px] text-white/65 truncate">
                        {currentTrack?.artist ?? 'AG Music Player'}
                      </p>
                      <div className="h-1 w-full rounded-full bg-white/15 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${progressRatio}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        onClick={onPrev}
                        aria-label="2x2 Widget previous"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={onTogglePlay}
                        aria-label="2x2 Widget play pause"
                        className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center shadow"
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={onNext}
                        aria-label="2x2 Widget next"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wide 4x2 Widget Card */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-white/70">4 × 2 Studio Widget</span>
                <div className={`p-4 rounded-3xl text-white space-y-3 shadow-2xl ${widgetContainerClass}`}>
                  <div className="flex items-center gap-3.5">
                    <CoverImage
                      src={currentTrack?.coverUrl}
                      alt={currentTrack?.title ?? 'Album art'}
                      className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-white/15"
                      fallback={
                        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                          <Disc3 className="w-7 h-7 text-[var(--accent)]" />
                        </div>
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate">
                        {currentTrack?.title ?? 'Midnight Resonance'}
                      </p>
                      <p className="text-xs text-white/70 truncate mt-0.5">
                        {currentTrack
                          ? `${currentTrack.artist} · ${currentTrack.album}`
                          : 'AG Music Player'}
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${progressRatio}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono-tabular text-white/55">
                          <span>{formatTime(positionSec)}</span>
                          <span>{formatTime(currentTrack?.durationSec ?? 218)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-[11px] font-medium text-white/65">Home Widget</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={onPrev}
                        className="p-2 rounded-lg hover:bg-white/10"
                        aria-label="4x2 Widget previous"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={onTogglePlay}
                        className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold flex items-center gap-1.5"
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{isPlaying ? 'Pause' : 'Play'}</span>
                      </button>
                      <button
                        onClick={onNext}
                        className="p-2 rounded-lg hover:bg-white/10"
                        aria-label="4x2 Widget next"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS SCREEN (Zero Duplication with 3-Dot Track Menu) */}
          {activeSection === 'settings' && (
            <div className="space-y-6">
              {/* 1. Appearance & Themes */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-[var(--accent)] tracking-wide">
                  Appearance & Themes
                </h3>

                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10">
                  {[
                    { id: 'obsidian_dark', label: 'Dark' },
                    { id: 'oled_black', label: 'OLED Black' },
                    { id: 'dynamic_tint', label: 'Dynamic' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectScenicTheme(opt.id)}
                      className={`min-h-[34px] rounded-lg text-xs font-medium transition-colors ${
                        currentScenicId === opt.id
                          ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                          : 'text-white/75 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSection('theme')}
                  className="w-full min-h-[52px] px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Palette className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">All Themes & Swatches</p>
                      <p className="text-xs text-white/60 truncate">{currentThemeObj.label}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/60 shrink-0" />
                </button>
              </div>

              {/* 2. Audio & Equalizer */}
              <div className="space-y-2.5 pt-3 border-t border-white/10">
                <h3 className="text-xs font-semibold text-[var(--accent)] tracking-wide">
                  Audio & Equalizer
                </h3>

                <button
                  type="button"
                  onClick={() => setActiveSection('equalizer')}
                  className="w-full min-h-[52px] px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Sliders className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">Equalizer & Presets</p>
                      <p className="text-xs text-white/60">
                        {equalizer.enabled
                          ? EQ_PRESETS[equalizer.preset]?.label ?? 'Custom'
                          : 'Bypassed'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/60 shrink-0" />
                </button>

                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-white">Crossfade</span>
                    <span className="font-mono-tabular text-xs text-[var(--accent)] font-semibold">
                      {settings.crossfadeSec}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    step={1}
                    value={settings.crossfadeSec}
                    onChange={(e) => onUpdateSettings({ crossfadeSec: Number(e.target.value) })}
                    className="ag-slider w-full bg-white/15 rounded-full h-1.5"
                  />
                </div>

                <ToggleSwitchRow
                  checked={settings.gaplessPlayback}
                  onChange={(next) => onUpdateSettings({ gaplessPlayback: next })}
                  label="Gapless Playback"
                  description="Seamless transitions between album tracks"
                />

                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-white">Audio Quality</span>
                    <span className="text-xs font-mono-tabular text-white/60 capitalize">
                      {currentAudioQuality}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'lossless', label: 'Lossless' },
                        { id: 'high', label: '320 kbps' },
                        { id: 'balanced', label: 'Balanced' },
                      ] as const
                    ).map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => onUpdateSettings({ audioQuality: q.id })}
                        className={`min-h-[34px] rounded-lg text-xs font-medium transition-colors ${
                          currentAudioQuality === q.id
                            ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold'
                            : 'bg-white/[0.06] text-white/75 hover:bg-white/[0.12]'
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Home Screen Widget */}
              <div className="space-y-2.5 pt-3 border-t border-white/10">
                <h3 className="text-xs font-semibold text-[var(--accent)] tracking-wide">
                  Home Screen Widget
                </h3>

                <button
                  type="button"
                  onClick={() => setActiveSection('widget')}
                  className="w-full min-h-[52px] px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <LayoutGrid className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">Widget Style (2×2 & 4×2)</p>
                      <p className="text-xs text-white/60 capitalize">{currentWidgetStyle}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/60 shrink-0" />
                </button>
              </div>

              {/* 4. Playback & Library */}
              <div className="space-y-2.5 pt-3 border-t border-white/10">
                <h3 className="text-xs font-semibold text-[var(--accent)] tracking-wide">
                  Playback & Library
                </h3>

                <ToggleSwitchRow
                  checked={settings.headsetAutoPlay}
                  onChange={(next) => onUpdateSettings({ headsetAutoPlay: next })}
                  label="Auto-Play"
                  description="Resume playback when headphones or Bluetooth connect"
                />

                {onRescanLibrary && (
                  <button
                    type="button"
                    onClick={onRescanLibrary}
                    className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-between text-sm font-medium text-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FolderSearch className="w-4 h-4 text-[var(--accent)] shrink-0" />
                      <span>Scan Library</span>
                    </div>
                    <RefreshCw className="w-4 h-4 text-white/60" />
                  </button>
                )}

                <ToggleSwitchRow
                  checked={settings.autoSyncPermission}
                  onChange={(next) => onUpdateSettings({ autoSyncPermission: next })}
                  label="Auto-Sync Device Audio"
                  description="Keep library synced with device storage"
                  icon={<ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0" />}
                />

                <ToggleSwitchRow
                  checked={settings.filterShortClips}
                  onChange={(next) => onUpdateSettings({ filterShortClips: next })}
                  label="Filter Short Clips"
                  description="Hide audio under 30s or 500KB"
                />
              </div>

              {/* 5. About */}
              <div className="space-y-2.5 pt-3 border-t border-white/10">
                <h3 className="text-xs font-semibold text-[var(--accent)] tracking-wide">
                  About
                </h3>

                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Info className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">AG Music Player</p>
                      <p className="text-xs text-white/60 font-mono-tabular">{dynamicVersion}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onCheckUpdate}
                    className="min-h-[36px] px-3 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold hover:bg-white/15 transition-colors whitespace-nowrap"
                  >
                    Updates
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pinned Footer: Check Update Button */}
        <div className="relative z-10 p-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
          <button
            onClick={onCheckUpdate}
            className="w-full min-h-[48px] px-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold text-sm flex items-center justify-between transition-colors shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4" />
              <span>Check Update</span>
            </div>
            <div className="flex items-center gap-1 font-mono-tabular text-xs opacity-90">
              <span>{dynamicVersion}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </aside>
    </div>
  );
};
