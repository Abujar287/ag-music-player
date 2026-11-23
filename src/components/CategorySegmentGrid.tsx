import React from 'react';
import { motion } from 'motion/react';
import { Disc3, Folder, Heart, Music2, Tag, User } from 'lucide-react';
import { LibraryTab } from '../types/music';

interface CategorySegmentGridProps {
  activeTab: LibraryTab | null;
  hasDrillFilter: boolean;
  counts: {
    tracks: number;
    albums: number;
    artists: number;
    genres: number;
    folders: number;
    favorites: number;
  };
  onSelectTab: (tab: LibraryTab) => void;
}

interface GridTileConfig {
  id: LibraryTab;
  label: string;
  count: number;
  icon: React.FC<{ className?: string }>;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const CategorySegmentGrid: React.FC<CategorySegmentGridProps> = ({
  activeTab,
  hasDrillFilter,
  counts,
  onSelectTab,
}) => {
  const tiles: GridTileConfig[] = [
    { id: 'tracks', label: 'Tracks', count: counts.tracks, icon: Music2 },
    { id: 'albums', label: 'Albums', count: counts.albums, icon: Disc3 },
    { id: 'artists', label: 'Artists', count: counts.artists, icon: User },
    { id: 'genres', label: 'Genres', count: counts.genres, icon: Tag },
    { id: 'folders', label: 'Folders', count: counts.folders, icon: Folder },
    { id: 'favorites', label: 'Favorites', count: counts.favorites, icon: Heart },
  ];

  return (
    <nav aria-label="Music Library Categories">
      <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
        {tiles.map((tile, idx) => {
          const Icon = tile.icon;
          const active = activeTab === tile.id && !hasDrillFilter;
          return (
            <motion.button
              key={tile.id}
              type="button"
              onClick={() => onSelectTab(tile.id)}
              aria-label={`${tile.label} (${tile.count})`}
              aria-pressed={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.2,
                delay: idx * 0.025,
                ease: EASE_OUT_EXPO,
              }}
              whileTap={{ scale: 0.96 }}
              className="group min-h-[124px] sm:min-h-[144px] px-2 sm:px-3 py-4 rounded-2xl border-0 bg-transparent hover:bg-white/[0.06] active:bg-white/[0.08] flex flex-col items-center justify-center text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <div className="mb-2.5 flex items-center justify-center">
                <Icon className="w-9 h-9 sm:w-11 sm:h-11 text-[var(--accent)] transition-transform duration-150 group-hover:scale-105" />
              </div>
              <span className="text-sm sm:text-base font-semibold text-white truncate max-w-full whitespace-nowrap">
                {tile.label}
              </span>
              <span className="mt-0.5 text-xs sm:text-sm font-normal font-mono-tabular tabular-nums text-white/70">
                {tile.count}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
