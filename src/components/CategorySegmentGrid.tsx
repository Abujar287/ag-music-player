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
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: idx * 0.035,
                ease: EASE_OUT_EXPO,
              }}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="group relative min-h-[144px] sm:min-h-[164px] px-2 sm:px-4 py-5 rounded-2xl border-0 bg-transparent hover:bg-white/[0.06] flex flex-col items-center justify-center text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <div className="mb-3 flex items-center justify-center">
                <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-[var(--accent)] transition-transform duration-150 group-hover:scale-110" />
              </div>
              <span className="text-base sm:text-lg font-bold text-white tracking-tight truncate max-w-full whitespace-nowrap">
                {tile.label}
              </span>
              <span className="mt-1 text-sm sm:text-base font-medium font-mono-tabular tabular-nums text-white/80">
                {tile.count}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
