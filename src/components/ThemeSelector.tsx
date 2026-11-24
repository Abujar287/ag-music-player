import React from 'react';
import { Check } from 'lucide-react';

export interface ThemeOption {
  id: string;
  name: string;
  colorDot: string;
  previewBg: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    name: 'Light',
    colorDot: '#F59E0B',
    previewBg: 'bg-[#F8F7F4] text-[#111114]',
  },
  {
    id: 'obsidian_dark',
    name: 'Dark',
    colorDot: '#8B5CF6',
    previewBg: 'bg-[#0D0D14] text-white',
  },
  {
    id: 'oled_black',
    name: 'AMOLED',
    colorDot: '#22D3EE',
    previewBg: 'bg-black text-white',
  },
  {
    id: 'deep_forest',
    name: 'Deep Forest',
    colorDot: '#10B981',
    previewBg: 'bg-[#062418] text-emerald-100',
  },
  {
    id: 'midnight_gold',
    name: 'Midnight Blue',
    colorDot: '#F5C542',
    previewBg: 'bg-[#061430] text-blue-100',
  },
];

interface ThemeSelectorProps {
  currentThemeId: string;
  onSelectTheme: (themeId: string) => void;
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentThemeId,
  onSelectTheme,
  className = '',
}: ThemeSelectorProps) => {
  return (
    <div className={`w-full ${className}`}>
      {/* Compact 2-column or horizontal flex wrap grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEME_OPTIONS.map((theme) => {
          const isActive = currentThemeId === theme.id || (theme.id === 'obsidian_dark' && !currentThemeId);
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelectTheme(theme.id)}
              className={`group relative flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all duration-200 ${theme.previewBg} ${
                isActive
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 shadow-md scale-[1.02]'
                  : 'border-white/10 hover:border-white/25 hover:scale-[1.01] opacity-90 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-4 h-4 rounded-full shrink-0 shadow-sm border border-white/20"
                  style={{ backgroundColor: theme.colorDot }}
                />
                <span className="text-sm font-semibold truncate tracking-tight">{theme.name}</span>
              </div>

              {isActive && (
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
