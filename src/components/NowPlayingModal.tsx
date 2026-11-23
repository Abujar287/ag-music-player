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
  User,
  FileAudio,
} from 'lucide-react';
import { RepeatMode, SleepTimerState, Track } from '../types/music';
import { formatTime } from '../utils/formatters';
import { CoverImage } from './CoverImage';
import { ScenicBackdrop } from './ScenicBackdrop';
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
  onGoToAlbum: (track: Track) => void;
  onGoToArtist: (track: Track) => void;
  onOpenSongInfo: (track: Track) => void;
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
  onGoToAlbum,
  onGoToArtist,
  onOpenSongInfo,
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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#061329] text-white overflow-hidden">
      <ScenicBackdrop className="absolute inset-0 z-0" />

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-black/10 backdrop-blur-md shrink-0">
        <button
          onClick={onClose}
          aria-label="Minimize Now Playing"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Clean Static Track Title */}
        <div className="flex-1 min-w-0 text-center px-2">
          <p className="text-sm font-semibold text-white truncate">{track.title}</p>
          <p className="text-xs text-white/65 truncate">
            {track.artist} · {track.album}
          </p>
        </div>

        <button
          onClick={() => setShowQueueSheet(true)}
          aria-label="Open Queue and Folder Location"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <ListMusic className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-evenly px-6 py-4 max-w-xl mx-auto w-full overflow-y-auto">
        {/* Vinyl Artwork Stage */}
        <div className="relative flex items-center justify-center my-2 w-full">
          <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full p-2 border-2 border-[var(--accent)]/45 shadow-2xl bg-[#071836]/80 flex items-center justify-center">
            <CoverImage
              src={track.coverUrl}
              alt={track.album}
              className={`w-full h-full rounded-full object-cover ${isPlaying ? 'animate-vinyl' : 'animate-vinyl-paused'}`}
              fallback={
                <div className={`w-full h-full rounded-full bg-[#0A2044] flex flex-col items-center justify-center ${isPlaying ? 'animate-vinyl' : 'animate-vinyl-paused'}`}>
                  <Disc3 className="w-24 h-24 text-[var(--accent)] opacity-85" />
                </div>
              }
            />
          </div>
        </div>

        {/* Track Title & Folder Metadata */}
        <div className="w-full text-center space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-white truncate">{track.title}</h2>
          <p className="text-sm text-white/70 truncate">
            {track.artist} · {track.genre}
          </p>
        </div>

        {/* 1st Row: Favorite, Sleep Timer, 3-Dot More Options */}
        <div className="w-full max-w-sm flex items-center justify-around py-1.5 border-y border-white/15 relative">
          <button
            onClick={() => onToggleFavorite(track.id)}
            className={`min-h-[44px] px-4 flex items-center gap-2 rounded-xl text-xs font-medium transition-colors ${
              track.isFavorite ? 'text-[var(--accent)]' : 'text-white/75 hover:bg-white/10'
            }`}
          >
            <Heart className={`w-5 h-5 ${track.isFavorite ? 'fill-current' : ''}`} />
            <span>Favorite</span>
          </button>

          <button
            onClick={onOpenSleepTimer}
            className={`min-h-[44px] px-4 flex items-center gap-2 rounded-xl text-xs font-medium transition-colors ${
              sleepTimer.active ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-white/75 hover:bg-white/10'
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white/75 hover:bg-white/10 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
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
          <div className="flex items-center justify-between text-xs font-mono-tabular text-white/70">
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
              shuffle ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-white/75 hover:bg-white/10'
            }`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            onClick={onPrev}
            aria-label="Previous Track"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
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
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          <button
            onClick={onCycleRepeat}
            aria-label={`Repeat Mode: ${repeatMode}`}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors ${
              repeatMode !== 'off'
                ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                : 'text-white/75 hover:bg-white/10'
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
          <div className="relative z-10 w-full max-w-2xl max-h-[78vh] flex flex-col rounded-t-3xl bg-[#071836]/95 backdrop-blur-xl text-white border-t border-white/15 shadow-2xl">
            <div className="w-10 h-1.5 bg-white/25 rounded-full mx-auto my-3" />
            <div className="flex items-center justify-between px-5 pb-3 border-b border-white/15">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-white">Up Next Queue</h3>
                <p className="text-xs text-white/70 flex items-center gap-1.5 truncate font-mono-tabular">
                  <Folder className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                  <span>{track.folder}</span>
                </p>
              </div>
              <button
                onClick={() => setShowQueueSheet(false)}
                aria-label="Close Queue"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/10 px-3 py-2">
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
                      isCurrent ? 'bg-[var(--accent-soft)]' : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="cursor-grab text-white/60 p-1">
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <button
                      onClick={() => onSelectQueueTrack(qTrack)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className={`text-sm font-medium truncate ${isCurrent ? 'text-[var(--accent)] font-semibold' : 'text-white'}`}>
                        {qTrack.title}
                      </p>
                      <p className="text-xs text-white/70 truncate">
                        {qTrack.artist} · {formatTime(qTrack.durationSec)}
                      </p>
                    </button>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        disabled={idx === 0}
                        onClick={() => onReorderQueue(idx, idx - 1)}
                        aria-label="Move up"
                        className="p-1.5 rounded-lg disabled:opacity-25 hover:bg-white/10"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === queue.length - 1}
                        onClick={() => onReorderQueue(idx, idx + 1)}
                        aria-label="Move down"
                        className="p-1.5 rounded-lg disabled:opacity-25 hover:bg-white/10"
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

      {/* Three-Dot Overflow Menu (Frosted-Glass Action Bottom Sheet) */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMoreMenu(false)}
          />
          <div className="relative z-10 w-full max-w-md max-h-[86vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0A0B14]/92 backdrop-blur-2xl text-white border border-white/10 shadow-2xl p-4 pb-6 space-y-3">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto sm:hidden" />

            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <CoverImage
                src={track.coverUrl}
                alt={track.album}
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/15"
                fallback={
                  <div className="w-12 h-12 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center shrink-0">
                    <Disc3 className="w-6 h-6 text-[var(--accent)]" />
                  </div>
                }
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{track.title}</p>
                <p className="text-xs text-white/65 truncate">
                  {track.artist} · {track.album}
                </p>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                aria-label="Close options"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-white/80 hover:text-white hover:bg-white/10 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-sm font-medium">
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenAddToPlaylist(track);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <ListPlus className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Add to Playlist</span>
              </button>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onGoToAlbum(track);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <Disc3 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Go to Album</span>
              </button>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onGoToArtist(track);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <User className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Go to Artist</span>
              </button>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenSleepTimer();
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <Moon className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Sleep Timer</span>
              </button>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onShareTrack(track);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <Share2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Share</span>
              </button>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenSongInfo(track);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <FileAudio className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Song Info</span>
              </button>

              <div className="my-2 border-t border-white/10" />

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenEditTag(track);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white/80 transition-colors"
              >
                <Edit3 className="w-4 h-4 text-white/60 shrink-0" />
                <span>Edit Audio Tags</span>
              </button>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onSetRingtone(track);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white/80 transition-colors"
              >
                <BellRing className="w-4 h-4 text-white/60 shrink-0" />
                <span>Set as Ringtone</span>
              </button>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onDeleteTrack(track);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl flex items-center gap-3.5 hover:bg-rose-500/15 text-rose-400 text-left transition-colors"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Delete from Device</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
