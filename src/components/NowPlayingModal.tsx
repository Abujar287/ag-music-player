import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ListMusic,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Moon,
  MoreVertical,
  Disc3,
  Edit3,
  ListPlus,
  BellRing,
  Share2,
  Trash2,
  Folder,
  GripVertical,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import { RepeatMode, SleepTimerState, Track } from '../types/music';
import { formatTime } from '../utils/formatters';
import { CoverImage } from './CoverImage';
import { SeekBar } from './SeekBar';

interface NowPlayingModalProps {
  open: boolean;
  onClose: () => void;
  track: Track | null;
  isPlaying: boolean;
  positionSec: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  sleepTimer: SleepTimerState;
  queue: Track[];
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (sec: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: (trackId: string) => void;
  onOpenSleepTimer: () => void;
  onOpenEditTag: (track: Track) => void;
  onOpenAddToPlaylist: (track: Track) => void;
  onSetRingtone: (track: Track) => void;
  onShareTrack: (track: Track) => void;
  onDeleteTrack: (track: Track) => void;
  onSelectQueueTrack: (track: Track) => void;
  onReorderQueue: (fromIdx: number, toIdx: number) => void;
  backHandlerRef?: React.MutableRefObject<(() => boolean) | null>;
}

export const NowPlayingModal: React.FC<NowPlayingModalProps> = ({
  open,
  onClose,
  track,
  isPlaying,
  positionSec,
  shuffle,
  repeatMode,
  sleepTimer,
  queue,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onOpenSleepTimer,
  onOpenEditTag,
  onOpenAddToPlaylist,
  onSetRingtone,
  onShareTrack,
  onDeleteTrack,
  onSelectQueueTrack,
  onReorderQueue,
  backHandlerRef,
}) => {
  const [showQueueSheet, setShowQueueSheet] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [scrubPreviewSec, setScrubPreviewSec] = useState<number | null>(null);

  useEffect(() => {
    if (!backHandlerRef) return;
    if (!open) {
      backHandlerRef.current = null;
      return;
    }
    backHandlerRef.current = () => {
      if (showQueueSheet) {
        setShowQueueSheet(false);
        return true;
      }
      if (showMoreMenu) {
        setShowMoreMenu(false);
        return true;
      }
      return false;
    };
    return () => {
      backHandlerRef.current = null;
    };
  }, [backHandlerRef, open, showQueueSheet, showMoreMenu]);

  useEffect(() => {
    if (!open) {
      setShowQueueSheet(false);
      setShowMoreMenu(false);
      setScrubPreviewSec(null);
    }
  }, [open]);

  if (!open || !track) return null;

  const displayedPosSec = scrubPreviewSec !== null ? scrubPreviewSec : positionSec;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F8F7F4] dark:bg-[#0B0B0D] text-[#111114] dark:text-[#F5F3EE]">
      {/* Top Header */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/5 dark:border-white/5 shrink-0">
        <button
          onClick={onClose}
          aria-label="Minimize Now Playing"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Center Marquee Scrolling Song Title */}
        <div className="flex-1 min-w-0 overflow-hidden text-center">
          <div className="relative overflow-hidden whitespace-nowrap">
            <div className="marquee-track">
              <span className="text-sm font-semibold tracking-wide px-6">{track.title}</span>
              <span className="text-sm font-semibold tracking-wide px-6" aria-hidden="true">
                {track.title}
              </span>
            </div>
          </div>
          <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] truncate">
            {track.artist} · {track.album}
          </p>
        </div>

        <button
          onClick={() => setShowQueueSheet(true)}
          aria-label="Open Queue and Folder Location"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
        >
          <ListMusic className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-evenly px-6 py-4 max-w-xl mx-auto w-full overflow-y-auto">
        {/* Artwork or 16:9 Video Visual Stage */}
        <div className="relative flex items-center justify-center my-2 w-full">
          {track.mediaType === 'video' ? (
            <div className="w-full max-w-md aspect-video rounded-2xl overflow-hidden border border-[var(--accent)]/40 bg-[#141417] shadow-2xl relative flex items-center justify-center">
              <CoverImage
                src={track.coverUrl}
                alt={track.title}
                className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}
                fallback={<Disc3 className="w-16 h-16 text-[var(--accent)] opacity-80" />}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30 pointer-events-none" />
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/70 text-[11px] font-semibold text-[var(--accent)]">
                {isPlaying ? 'Playing Video' : 'Video Paused'}
              </span>
            </div>
          ) : (
            <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full p-2 border-2 border-[var(--accent)]/40 shadow-2xl bg-[#141417] flex items-center justify-center">
              <CoverImage
                src={track.coverUrl}
                alt={track.album}
                className={`w-full h-full rounded-full object-cover ${isPlaying ? 'animate-vinyl' : 'animate-vinyl-paused'}`}
                fallback={
                  <div className={`w-full h-full rounded-full bg-[#1C1C21] flex flex-col items-center justify-center ${isPlaying ? 'animate-vinyl' : 'animate-vinyl-paused'}`}>
                    <Disc3 className="w-24 h-24 text-[var(--accent)] opacity-80" />
                  </div>
                }
              />
            </div>
          )}
        </div>

        {/* Track Title & Folder Metadata */}
        <div className="w-full text-center space-y-1">
          <h2 className="text-lg sm:text-xl font-bold truncate">{track.title}</h2>
          <p className="text-sm text-[#6B675E] dark:text-[#9E9A90] truncate">
            {track.artist} · {track.genre}
          </p>
        </div>

        {/* 1st Row: Favorite, Sleep Timer, 3-Dot More Options */}
        <div className="w-full max-w-sm flex items-center justify-around py-1.5 border-y border-black/10 dark:border-white/10 relative">
          <button
            onClick={() => onToggleFavorite(track.id)}
            className={`min-h-[44px] px-4 flex items-center gap-2 rounded-xl text-xs font-medium transition-colors ${
              track.isFavorite ? 'text-[var(--accent)]' : 'text-[#6B675E] dark:text-[#9E9A90] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Heart className={`w-5 h-5 ${track.isFavorite ? 'fill-current' : ''}`} />
            <span>Favorite</span>
          </button>

          <button
            onClick={onOpenSleepTimer}
            className={`min-h-[44px] px-4 flex items-center gap-2 rounded-xl text-xs font-medium transition-colors ${
              sleepTimer.active ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-[#6B675E] dark:text-[#9E9A90] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Moon className="w-5 h-5" />
            <span>
              {sleepTimer.active
                ? sleepTimer.mode === 'end_of_track'
                  ? 'Track End'
                  : formatTime(sleepTimer.remainingSec)
                : 'Sleep Timer'}
            </span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              aria-label="More Options"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#6B675E] dark:text-[#9E9A90] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl bg-white dark:bg-[#19191E] border border-black/10 dark:border-white/10 shadow-2xl py-1.5 text-sm">
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenEditTag(track);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 text-left"
                  >
                    <Edit3 className="w-4 h-4 text-[var(--accent)]" />
                    <span>Edit Tag / Info</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onOpenAddToPlaylist(track);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 text-left"
                  >
                    <ListPlus className="w-4 h-4 text-[var(--accent)]" />
                    <span>Add to Playlist</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onSetRingtone(track);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 text-left"
                  >
                    <BellRing className="w-4 h-4 text-[var(--accent)]" />
                    <span>Set as Ringtone</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onShareTrack(track);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 text-left"
                  >
                    <Share2 className="w-4 h-4 text-[var(--accent)]" />
                    <span>Share Audio File</span>
                  </button>
                  <div className="my-1 border-t border-black/10 dark:border-white/10" />
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onDeleteTrack(track);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-rose-500/10 text-rose-500 text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete from Device</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 2nd Row: Duration / Smooth Interactive Seek Bar */}
        <div className="w-full space-y-1">
          <SeekBar
            positionSec={positionSec}
            durationSec={track.durationSec}
            onSeek={onSeek}
            onPreviewChange={setScrubPreviewSec}
            ariaLabel="Seek audio position"
          />
          <div className="flex items-center justify-between text-xs font-mono-tabular text-[#6B675E] dark:text-[#9E9A90]">
            <span>{formatTime(displayedPosSec)}</span>
            <span>{formatTime(track.durationSec)}</span>
          </div>
        </div>

        {/* 3rd Row: Shuffle, Previous, Play/Pause, Next, Repeat */}
        <div className="w-full flex items-center justify-between max-w-sm">
          <button
            onClick={onToggleShuffle}
            aria-label="Toggle Shuffle"
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors ${
              shuffle ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-[#6B675E] dark:text-[#9E9A90] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            onClick={onPrev}
            aria-label="Previous Track"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          {/* Prominent Highlighted Play/Pause CTA */}
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-16 h-16 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] flex items-center justify-center shadow-xl transition-transform active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onNext}
            aria-label="Next Track"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          <button
            onClick={onCycleRepeat}
            aria-label={`Repeat Mode: ${repeatMode}`}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors ${
              repeatMode !== 'off'
                ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                : 'text-[#6B675E] dark:text-[#9E9A90] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Queue & Folder Location Bottom Sheet */}
      {showQueueSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowQueueSheet(false)}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[78vh] flex flex-col rounded-t-3xl bg-[#F8F7F4] dark:bg-[#141417] border-t border-black/10 dark:border-white/10 shadow-2xl">
            <div className="w-10 h-1.5 bg-black/20 dark:bg-white/20 rounded-full mx-auto my-3" />
            <div className="flex items-center justify-between px-5 pb-3 border-b border-black/10 dark:border-white/10">
              <div className="min-w-0">
                <h3 className="text-base font-bold">Up Next Queue</h3>
                <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] flex items-center gap-1.5 truncate font-mono-tabular">
                  <Folder className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                  <span>{track.folder}</span>
                </p>
              </div>
              <button
                onClick={() => setShowQueueSheet(false)}
                aria-label="Close Queue"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 px-3 py-2">
              {queue.map((qTrack, idx) => {
                const isCurrent = qTrack.id === track.id;
                return (
                  <div
                    key={qTrack.id}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== idx) {
                        onReorderQueue(dragIdx, idx);
                      }
                      setDragIdx(null);
                    }}
                    className={`flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors ${
                      isCurrent ? 'bg-[var(--accent-soft)]' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="cursor-grab text-[#6B675E] dark:text-[#9E9A90] p-1">
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <button
                      onClick={() => onSelectQueueTrack(qTrack)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className={`text-sm font-medium truncate ${isCurrent ? 'text-[var(--accent)] font-semibold' : ''}`}>
                        {qTrack.title}
                      </p>
                      <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] truncate">
                        {qTrack.artist} · {formatTime(qTrack.durationSec)}
                      </p>
                    </button>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        disabled={idx === 0}
                        onClick={() => onReorderQueue(idx, idx - 1)}
                        aria-label="Move up"
                        className="p-1.5 rounded-lg disabled:opacity-25 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === queue.length - 1}
                        onClick={() => onReorderQueue(idx, idx + 1)}
                        aria-label="Move down"
                        className="p-1.5 rounded-lg disabled:opacity-25 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
