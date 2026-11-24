import React, { useEffect, useRef, useState } from 'react';
import {
  MoreVertical,
  RefreshCw,
  Sliders,
  Moon,
  Settings as SettingsIcon,
  Palette,
  LayoutGrid,
  CloudUpload,
  HardDrive,
  Info,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppSettings } from '../types/music';

interface HeaderDropdownMenuProps {
  settings: AppSettings;
  onScanAudio: () => void;
  onOpenEqualizer: () => void;
  onOpenSleepTimer: () => void;
  onOpenPlaybackSettings: () => void;
  onOpenTheme: () => void;
  onOpenWidget: () => void;
  onBackupRestore: () => void;
  onStorageCache: () => void;
  onOpenAbout: () => void;
  sleepTimerActive: boolean;
  sleepTimerRemaining?: string;
}

export const HeaderDropdownMenu: React.FC<HeaderDropdownMenuProps> = ({
  settings,
  onScanAudio,
  onOpenEqualizer,
  onOpenSleepTimer,
  onOpenPlaybackSettings,
  onOpenTheme,
  onOpenWidget,
  onBackupRestore,
  onStorageCache,
  onOpenAbout,
  sleepTimerActive,
  sleepTimerRemaining,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeThemeLabel =
    settings.scenicThemeId === 'obsidian_dark'
      ? 'Dark'
      : settings.scenicThemeId === 'oled_black'
        ? 'OLED'
        : settings.scenicThemeId === 'midnight_gold'
          ? 'Gold'
          : 'Dynamic';

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open options menu"
        aria-expanded={isOpen}
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none"
      >
        <span className="absolute inset-0 rounded-xl bg-white/0 hover:bg-white/10 active:scale-95 transition-all" />
        <MoreVertical className="w-5 h-5 text-white/90 relative z-10" />
      </button>

      {/* Dropdown Menu Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 mt-2 w-72 sm:w-80 rounded-[16px] bg-[#0A0D18]/95 backdrop-blur-2xl border border-white/12 shadow-[0_12px_40px_rgba(0,0,0,0.6)] py-2 text-white z-50 overflow-hidden"
          >
            {/* Group 1: Library Actions */}
            <div className="px-1.5 py-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onScanAudio();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4 text-[var(--accent)] group-hover:rotate-180 transition-transform duration-500" />
                  </div>
                  <span>Scan Audio</span>
                </div>
                <span className="text-[11px] text-white/45 font-mono-tabular">Local</span>
              </button>
            </div>

            <div className="h-px bg-white/10 my-1 mx-2" />

            {/* Group 2: Audio & Playback */}
            <div className="px-1.5 py-1 space-y-0.5">
              <div className="px-3 py-1 text-[11px] font-semibold text-white/45 tracking-wider uppercase">
                Audio & Playback
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenEqualizer();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <Sliders className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <span>Audio & Equalizer</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/35" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSleepTimer();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <Moon className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <span>Sleep Timer</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    sleepTimerActive
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'bg-white/10 text-white/60'
                  }`}
                >
                  {sleepTimerActive ? sleepTimerRemaining || 'Active' : 'Off'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenPlaybackSettings();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <SettingsIcon className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <span>Playback Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/35" />
              </button>
            </div>

            <div className="h-px bg-white/10 my-1 mx-2" />

            {/* Group 3: Personalization */}
            <div className="px-1.5 py-1 space-y-0.5">
              <div className="px-3 py-1 text-[11px] font-semibold text-white/45 tracking-wider uppercase">
                Personalization
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenTheme();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <Palette className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <span>Theme</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white/80">
                  {activeThemeLabel}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenWidget();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <LayoutGrid className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <span>Widget</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/35" />
              </button>
            </div>

            <div className="h-px bg-white/10 my-1 mx-2" />

            {/* Group 4: System & Info */}
            <div className="px-1.5 py-1 space-y-0.5">
              <div className="px-3 py-1 text-[11px] font-semibold text-white/45 tracking-wider uppercase">
                System & Info
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onBackupRestore();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <CloudUpload className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <span>Backup & Restore</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/35" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onStorageCache();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <HardDrive className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <span>Storage & Cache</span>
                </div>
                <span className="text-[11px] text-white/50 font-mono-tabular">Optimized</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAbout();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <Info className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <span>About</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/35" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
