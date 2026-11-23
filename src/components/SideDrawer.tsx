import React, { useState } from 'react';
import {
  X,
  Palette,
  Sliders,
  LayoutGrid,
  Settings as SettingsIcon,
  RefreshCw,
  Sun,
  Moon,
  Check,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Disc3,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
} from 'lucide-react';
import {
  ACCENT_OPTIONS,
  APP_VERSION_TAG,
  EQ_FREQUENCIES,
  EQ_PRESETS,
  LOGO_IMAGE_URL,
} from '../data/defaultLibrary';
import { AppSettings, EqualizerState, EqPresetId, Track } from '../types/music';
import { CoverImage } from './CoverImage';

type DrawerSection = 'menu' | 'theme' | 'equalizer' | 'widget' | 'settings';

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  equalizer: EqualizerState;
  onUpdateEqualizer: (next: EqualizerState) => void;
  onCheckUpdate: () => void;
  currentTrack: Track | null;
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
    label: 'Theme',
    subtitle: 'Dark / Light mode & accent colors',
    icon: Palette,
  },
  {
    id: 'equalizer',
    label: 'Equalizer',
    subtitle: '5-band audio EQ presets & virtualizer',
    icon: Sliders,
  },
  {
    id: 'widget',
    label: 'Widget',
    subtitle: 'Home screen music widget previews',
    icon: LayoutGrid,
  },
  {
    id: 'settings',
    label: 'Settings',
    subtitle: 'Auto-sync, playback & lock screen controls',
    icon: SettingsIcon,
  },
];

export const SideDrawer: React.FC<SideDrawerProps> = ({
  open,
  onClose,
  settings,
  onUpdateSettings,
  equalizer,
  onUpdateEqualizer,
  onCheckUpdate,
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onRescanLibrary,
}) => {
  const [activeSection, setActiveSection] = useState<DrawerSection>('menu');

  const dynamicVersion = React.useMemo(() => {
    try {
      const bridge = (window as any).AndroidBridge;
      if (bridge && typeof bridge.getVersionName === 'function') {
        return `V-${bridge.getVersionName()}`;
      }
    } catch {}
    return APP_VERSION_TAG;
  }, []);

  if (!open) return null;

  const handleClose = () => {
    setActiveSection('menu');
    onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside className="relative z-10 flex h-full w-full max-w-[360px] flex-col bg-[#F8F7F4] dark:bg-[#111114] text-[#111114] dark:text-[#F5F3EE] border-r border-black/10 dark:border-white/10 shadow-2xl">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={LOGO_IMAGE_URL}
              alt="AG Music Player emblem"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover border border-[var(--accent)]/60 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold tracking-wide truncate">
                AG Music Player
              </h2>
              <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] truncate">
                Music Player · {dynamicVersion}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close menu"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-view Back Bar */}
        {activeSection !== 'menu' && (
          <div className="px-3 py-2 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center gap-2">
            <button
              onClick={() => setActiveSection('menu')}
              className="min-h-[40px] px-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 text-sm font-semibold"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--accent)]" />
              <span>Menu</span>
            </button>
            <span className="text-xs text-[#6B675E] dark:text-[#9E9A90]">/</span>
            <span className="text-sm font-semibold">{activeMenuMeta?.label}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* LIST-WISE MAIN DRAWER MENU */}
          {activeSection === 'menu' && (
            <nav aria-label="Drawer Menu" className="divide-y divide-black/5 dark:divide-white/5">
              {MENU_LIST.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className="w-full min-h-[60px] px-3 py-3 flex items-center gap-3.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] truncate">
                        {item.subtitle}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#6B675E] dark:text-[#9E9A90] shrink-0" />
                  </button>
                );
              })}
            </nav>
          )}

          {/* THEME SECTION */}
          {activeSection === 'theme' && (
            <div className="space-y-6 px-1">
              <div>
                <h3 className="text-sm font-semibold mb-3">Appearance Mode</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => onUpdateSettings({ themeMode: 'dark' })}
                    className={`w-full min-h-[48px] px-4 flex items-center justify-between rounded-xl border text-sm font-medium transition-all ${
                      settings.themeMode === 'dark'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Moon className="w-4 h-4" />
                      <span>Dark Mode</span>
                    </div>
                    {settings.themeMode === 'dark' && <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ themeMode: 'light' })}
                    className={`w-full min-h-[48px] px-4 flex items-center justify-between rounded-xl border text-sm font-medium transition-all ${
                      settings.themeMode === 'light'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Sun className="w-4 h-4" />
                      <span>Light Mode</span>
                    </div>
                    {settings.themeMode === 'light' && <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Accent Color</h3>
                <div className="space-y-2">
                  {ACCENT_OPTIONS.map((opt) => {
                    const selected = settings.accentId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => onUpdateSettings({ accentId: opt.id })}
                        className={`w-full min-h-[48px] px-3.5 flex items-center justify-between rounded-xl border transition-all ${
                          selected
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                            : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-5 h-5 rounded-full border border-black/20 dark:border-white/20"
                            style={{ backgroundColor: opt.hex }}
                          />
                          <span className="text-sm font-medium">{opt.label}</span>
                        </div>
                        {selected && <Check className="w-4 h-4 text-[var(--accent)]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* EQUALIZER SECTION */}
          {activeSection === 'equalizer' && (
            <div className="space-y-5 px-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">5-Band Audio Equalizer</h3>
                  <p className="text-xs text-[#6B675E] dark:text-[#9E9A90]">
                    Real-time Web Audio DSP filter bank
                  </p>
                </div>
                <button
                  onClick={() => onUpdateEqualizer({ ...equalizer, enabled: !equalizer.enabled })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    equalizer.enabled
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'bg-black/10 dark:bg-white/10 text-[#6B675E] dark:text-[#9E9A90]'
                  }`}
                >
                  {equalizer.enabled ? 'Active' : 'Bypassed'}
                </button>
              </div>

              {/* Presets list */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#6B675E] dark:text-[#9E9A90]">Presets</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(EQ_PRESETS) as EqPresetId[]).map((presetKey) => {
                    const active = equalizer.preset === presetKey;
                    return (
                      <button
                        key={presetKey}
                        onClick={() => handlePresetClick(presetKey)}
                        className={`min-h-[38px] px-3 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                            : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        {EQ_PRESETS[presetKey].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5-Band Sliders */}
              <div className="p-4 rounded-2xl bg-black/[0.04] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 space-y-4">
                {EQ_FREQUENCIES.map((freq, idx) => {
                  const db = equalizer.bands[idx];
                  return (
                    <div key={freq} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-tabular font-medium">{freq}</span>
                        <span className="font-mono-tabular text-[var(--accent)]">
                          {db > 0 ? `+${db}` : db} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={db}
                        disabled={!equalizer.enabled}
                        onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                        className="ag-slider w-full bg-black/15 dark:bg-white/15 rounded-full h-1.5"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Virtualizer */}
              <div className="p-4 rounded-2xl bg-black/[0.04] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">Stereo Virtualizer</span>
                  <span className="font-mono-tabular text-[var(--accent)]">{equalizer.virtualizer}%</span>
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
                  className="ag-slider w-full bg-black/15 dark:bg-white/15 rounded-full h-1.5"
                />
              </div>
            </div>
          )}

          {/* WIDGET PREVIEW SECTION */}
          {activeSection === 'widget' && (
            <div className="space-y-5 px-1">
              <div>
                <h3 className="text-sm font-semibold">Home Screen Widgets</h3>
                <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] mt-1">
                  Interactive preview of AG Music Player Android home screen widgets.
                </p>
              </div>

              {/* 4x1 Compact Widget Preview */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-[#6B675E] dark:text-[#9E9A90]">
                  4 × 1 Compact Bar Widget
                </span>
                <div className="p-3 rounded-2xl bg-[#16161A] text-[#F5F3EE] border border-white/10 flex items-center gap-3 shadow-lg">
                  <CoverImage
                    src={currentTrack?.coverUrl}
                    alt={currentTrack?.title ?? 'Album art'}
                    className="w-11 h-11 rounded-xl object-cover shrink-0"
                    fallback={
                      <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                        <Disc3 className="w-5 h-5 text-[var(--accent)]" />
                      </div>
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {currentTrack?.title ?? 'Obsidian Echoes'}
                    </p>
                    <p className="text-[11px] text-[#9E9A90] truncate">
                      {currentTrack?.artist ?? 'Kaelen Vance'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={onPrev}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Widget previous"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={onTogglePlay}
                      className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center"
                      aria-label="Widget play pause"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <button
                      onClick={onNext}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label="Widget next"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 4x2 Expanded Widget Preview */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-[#6B675E] dark:text-[#9E9A90]">
                  4 × 2 Studio Card Widget
                </span>
                <div className="p-4 rounded-2xl bg-[#16161A] text-[#F5F3EE] border border-white/10 space-y-3 shadow-lg">
                  <div className="flex items-center gap-3.5">
                    <CoverImage
                      src={currentTrack?.coverUrl}
                      alt={currentTrack?.title ?? 'Album art'}
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                      fallback={
                        <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          <Disc3 className="w-7 h-7 text-[var(--accent)]" />
                        </div>
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {currentTrack?.title ?? 'Obsidian Echoes'}
                      </p>
                      <p className="text-xs text-[#9E9A90] truncate">
                        {currentTrack?.artist ?? 'Kaelen Vance'} · {currentTrack?.album ?? 'Obsidian Echoes'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-[11px] font-display text-[var(--accent)]">AG Music Player</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onPrev}
                        className="p-2 rounded-lg hover:bg-white/10"
                        aria-label="Card widget previous"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={onTogglePlay}
                        className="px-4 py-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold flex items-center gap-1.5"
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{isPlaying ? 'Pause' : 'Play'}</span>
                      </button>
                      <button
                        onClick={onNext}
                        className="p-2 rounded-lg hover:bg-white/10"
                        aria-label="Card widget next"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS SECTION */}
          {activeSection === 'settings' && (
            <div className="space-y-6 px-1">
              {/* Auto-Sync Audio Library */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B675E] dark:text-[#9E9A90]">
                  Music Library Auto-Sync
                </h3>

                <label className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10 cursor-pointer">
                  <div className="pr-3">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0" />
                      <p className="text-sm font-medium">Auto-Sync Device Audio</p>
                    </div>
                    <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] mt-0.5">
                      Automatically scan local tracks once media permission is granted
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoSyncPermission}
                    onChange={(e) => onUpdateSettings({ autoSyncPermission: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10 cursor-pointer">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Filter short audio clips</p>
                    <p className="text-xs text-[#6B675E] dark:text-[#9E9A90]">
                      Hide audio under 30s or 500KB
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.filterShortClips}
                    onChange={(e) => onUpdateSettings({ filterShortClips: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]"
                  />
                </label>

                {onRescanLibrary && (
                  <button
                    onClick={onRescanLibrary}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 hover:border-[var(--accent)]/60 flex items-center justify-between text-sm font-medium transition-colors"
                  >
                    <span>Refresh / Rescan Device Audio</span>
                    <RefreshCw className="w-4 h-4 text-[var(--accent)]" />
                  </button>
                )}
              </div>

              {/* Audio & Playback */}
              <div className="space-y-3 pt-2 border-t border-black/10 dark:border-white/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B675E] dark:text-[#9E9A90]">
                  Audio & Playback
                </h3>

                {[
                  {
                    key: 'gaplessPlayback' as const,
                    title: 'Gapless playback',
                    desc: 'Seamless transitions between album tracks',
                  },
                  {
                    key: 'fadeOnPause' as const,
                    title: 'Fade-in / out on pause',
                    desc: 'Smooth volume ramp on play & pause',
                  },
                  {
                    key: 'headsetAutoPlay' as const,
                    title: 'Headset / Bluetooth auto-play',
                    desc: 'Resume playback when audio device connects',
                  },
                  {
                    key: 'headsetAutoPause' as const,
                    title: 'Headset / Bluetooth auto-pause',
                    desc: 'Pause immediately when disconnected',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10 cursor-pointer"
                  >
                    <div className="pr-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-[#6B675E] dark:text-[#9E9A90]">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings[item.key]}
                      onChange={(e) => onUpdateSettings({ [item.key]: e.target.checked })}
                      className="w-4 h-4 accent-[var(--accent)]"
                    />
                  </label>
                ))}

                <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Crossfade duration</span>
                    <span className="font-mono-tabular text-xs text-[var(--accent)]">
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
                    className="ag-slider w-full bg-black/15 dark:bg-white/15 rounded-full h-1.5"
                  />
                </div>
              </div>

              {/* Lock Screen & Notification */}
              <div className="space-y-3 pt-2 border-t border-black/10 dark:border-white/10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B675E] dark:text-[#9E9A90]">
                  Lock Screen & Notification
                </h3>
                <label className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10 cursor-pointer">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Lock screen album art</p>
                    <p className="text-xs text-[#6B675E] dark:text-[#9E9A90]">
                      Show cover art via MediaSession API
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.lockScreenArt}
                    onChange={(e) => onUpdateSettings({ lockScreenArt: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]"
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10 cursor-pointer">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Notification controls</p>
                    <p className="text-xs text-[#6B675E] dark:text-[#9E9A90]">
                      Persistent playback & download notifications
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notificationControls}
                    onChange={(e) => onUpdateSettings({ notificationControls: e.target.checked })}
                    className="w-4 h-4 accent-[var(--accent)]"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Pinned Footer: Check Update Button */}
        <div className="p-4 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
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
