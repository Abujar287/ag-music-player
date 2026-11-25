import React from 'react';
import { Check } from 'lucide-react';
import { CLASSIC_THEMES } from '../data/defaultLibrary';

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
  const activeClassic = CLASSIC_THEMES.find((t) => t.id === currentThemeId);

  return (
    <div className={`w-full space-y-3 ${className}`}>
      {activeClassic && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-xs font-medium text-white/60">Active Theme</span>
          <span className="text-xs font-semibold text-white/90 truncate max-w-[180px]">
            {activeClassic.label}
          </span>
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Classic Themes"
        className="grid grid-cols-5 sm:grid-cols-6 gap-2.5"
      >
        {CLASSIC_THEMES.map((swatch) => {
          const isActive = currentThemeId === swatch.id;
          const swatchStyle: React.CSSProperties = swatch.isSplit
            ? {
                backgroundImage: `linear-gradient(180deg, ${swatch.topHex} 50%, ${swatch.bottomHex} 50%)`,
              }
            : {
                backgroundColor: swatch.topHex,
              };
          const isLightSwatch = swatch.id === 'classic_cool_mist';

          return (
            <button
              key={swatch.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={swatch.label}
              title={swatch.label}
              onClick={() => onSelectTheme(swatch.id)}
              style={swatchStyle}
              className={`group relative aspect-square w-full rounded-xl transition-all duration-150 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                isActive
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0A0D18] scale-[1.06] shadow-lg'
                  : isLightSwatch
                    ? 'border border-black/15 hover:scale-[1.04]'
                    : 'border border-white/15 hover:border-white/40 hover:scale-[1.04]'
              }`}
            >
              {isActive && (
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center shadow-md ${
                    isLightSwatch
                      ? 'bg-[#111622] text-white'
                      : 'bg-black/55 text-white border border-white/40'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
