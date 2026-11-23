import React, { useEffect, useState } from 'react';
import {
  X,
  Moon,
  Download,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ImagePlus,
  Disc3,
  Trash2,
  FileAudio,
  Edit3,
  Folder,
} from 'lucide-react';
import {
  Playlist,
  SleepTimerState,
  Track,
  UpdateFlowState,
} from '../types/music';
import { formatBytes, formatTime } from '../utils/formatters';

/* 1. Create / Rename Playlist Modal */
interface PlaylistModalProps {
  open: boolean;
  initialName?: string;
  mode: 'create' | 'rename';
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  open,
  initialName = '',
  mode,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(initialName);
  useEffect(() => setName(initialName), [initialName, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#0B0D16]/95 backdrop-blur-2xl text-white border border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">
            {mode === 'create' ? 'Create New Playlist' : 'Rename Playlist'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              onSubmit(name.trim());
              onClose();
            }
          }}
          className="space-y-4"
        >
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.07] border border-white/15 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold"
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 2. Add Track to Playlist Modal */
interface AddToPlaylistModalProps {
  track: Track | null;
  playlists: Playlist[];
  onClose: () => void;
  onSelectPlaylist: (playlistId: string, trackId: string) => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  track,
  playlists,
  onClose,
  onSelectPlaylist,
}) => {
  if (!track) return null;
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#0B0D16]/95 backdrop-blur-2xl text-white border border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <h3 className="text-base font-bold text-white">Add to Playlist</h3>
            <p className="text-xs text-white/70 truncate">{track.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {playlists.length === 0 ? (
            <p className="text-xs text-white/70 py-4 text-center">
              No playlists created yet.
            </p>
          ) : (
            playlists.map((pl) => {
              const alreadyIn = pl.trackIds.includes(track.id);
              return (
                <button
                  key={pl.id}
                  onClick={() => {
                    onSelectPlaylist(pl.id, track.id);
                    onClose();
                  }}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-between text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{pl.name}</p>
                    <p className="text-xs text-white/70">
                      {pl.trackIds.length} tracks
                    </p>
                  </div>
                  {alreadyIn && (
                    <span className="text-xs font-medium text-[var(--accent)]">Added</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* 3. Edit Tag / Info Modal */
interface EditTagModalProps {
  track: Track | null;
  onClose: () => void;
  onSave: (trackId: string, patch: Partial<Track>) => void;
}

export const EditTagModal: React.FC<EditTagModalProps> = ({ track, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (track) {
      setTitle(track.title);
      setArtist(track.artist);
      setAlbum(track.album);
      setGenre(track.genre);
      setCoverUrl(track.coverUrl);
    }
  }, [track]);

  if (!track) return null;

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#0B0D16]/95 backdrop-blur-2xl text-white border border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Edit Tag / Audio Info</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(track.id, {
              title: title.trim() || track.title,
              artist: artist.trim() || track.artist,
              album: album.trim() || track.album,
              genre: genre.trim() || track.genre,
              coverUrl,
            });
            onClose();
          }}
          className="space-y-3"
        >
          <div className="flex items-center gap-4">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Cover preview"
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border border-white/20 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Disc3 className="w-7 h-7 text-[var(--accent)]" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="px-3 py-2 rounded-xl bg-white/10 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer hover:bg-white/15">
                <ImagePlus className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Change Cover</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverPick} />
              </label>
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => setCoverUrl(null)}
                  className="px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/15"
                >
                  Remove Art
                </button>
              )}
            </div>
          </div>

          {[
            { label: 'Song Title', value: title, set: setTitle },
            { label: 'Artist Name', value: artist, set: setArtist },
            { label: 'Album Name', value: album, set: setAlbum },
            { label: 'Genre', value: genre, set: setGenre },
          ].map((field) => (
            <div key={field.label} className="space-y-1">
              <label className="text-xs font-medium text-white/70">
                {field.label}
              </label>
              <input
                type="text"
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold"
            >
              Save Tags
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 4. Sleep Timer Modal */
interface SleepTimerModalProps {
  open: boolean;
  sleepTimer: SleepTimerState;
  onClose: () => void;
  onSetTimer: (mode: SleepTimerState['mode'], customMinutes?: number) => void;
  onClearTimer: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({
  open,
  sleepTimer,
  onClose,
  onSetTimer,
  onClearTimer,
}) => {
  const [customMin, setCustomMin] = useState(20);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#0B0D16]/95 backdrop-blur-2xl text-white border border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-white">Sleep Timer</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { mode: '15m', label: '15 min' },
              { mode: '30m', label: '30 min' },
              { mode: '45m', label: '45 min' },
              { mode: '60m', label: '60 min' },
              { mode: 'end_of_track', label: 'End of Track' },
            ] as const
          ).map((item) => (
            <button
              key={item.mode}
              onClick={() => {
                onSetTimer(item.mode);
                onClose();
              }}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold transition-colors ${
                sleepTimer.active && sleepTimer.mode === item.mode
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]'
                  : 'bg-white/[0.07] text-white hover:bg-white/[0.14]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="pt-2 border-t border-white/10 space-y-2">
          <label className="text-xs font-medium text-white/70">
            Custom Duration (minutes)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={240}
              value={customMin}
              onChange={(e) => setCustomMin(Math.max(1, Number(e.target.value)))}
              className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white font-mono-tabular"
            />
            <button
              onClick={() => {
                onSetTimer('custom', customMin);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold"
            >
              Start
            </button>
          </div>
        </div>

        {sleepTimer.active && (
          <button
            onClick={() => {
              onClearTimer();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-rose-500/15 text-rose-400 text-xs font-semibold hover:bg-rose-500/25"
          >
            Turn Off Active Timer
          </button>
        )}
      </div>
    </div>
  );
};

/* 5. Minimal In-App Auto-Updater Modal */
interface UpdateModalProps {
  state: UpdateFlowState;
  onClose: () => void;
  onDownload: () => void;
  onTriggerInstall: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  state,
  onClose,
  onDownload,
  onTriggerInstall,
}) => {
  if (state.status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={state.status === 'downloading' ? undefined : onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-[#071836]/95 backdrop-blur-xl text-white border border-white/15 p-6 shadow-2xl">
        {state.status === 'checking' && (
          <div className="py-4 flex flex-col items-center text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-[var(--accent)] animate-spin" />
            <h3 className="text-base font-bold text-white">Checking for updates...</h3>
          </div>
        )}

        {state.status === 'up_to_date' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">App is up to date</h3>
                <p className="text-xs text-white/70">
                  Current Version:{' '}
                  <span className="font-mono-tabular font-semibold text-white">{state.currentVersion}</span>
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {state.status === 'available' && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold tracking-tight text-white">Update Available Now</h3>

            <div className="space-y-1.5 text-sm">
              <p className="text-white/70">
                Current Version:{' '}
                <span className="font-mono-tabular font-semibold text-white">
                  {state.currentVersionTag}
                </span>
              </p>
              <p className="text-white/70">
                New Version:{' '}
                <span className="font-mono-tabular font-semibold text-[var(--accent)]">
                  v{state.release.version}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-white/80 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="min-h-[44px] px-5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
        )}

        {state.status === 'downloading' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold tracking-tight text-white">Downloading Update</h3>

            <div className="space-y-1.5 text-sm">
              <p className="text-white/70">
                Current Version:{' '}
                <span className="font-mono-tabular font-semibold text-white">
                  {state.currentVersionTag}
                </span>
              </p>
              <p className="text-white/70">
                New Version:{' '}
                <span className="font-mono-tabular font-semibold text-[var(--accent)]">
                  v{state.release.version}
                </span>
              </p>
              <p className="text-xs text-white/70 truncate">
                Saving via DownloadManager → <span className="font-mono-tabular">0/Download/{state.release.apkName}</span>
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <div className="w-full h-2.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-150"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-white/70">
                  {formatBytes(state.downloadedBytes)} / {formatBytes(state.totalBytes)}
                </span>
                <span className="font-semibold text-[var(--accent)]">{state.progress}%</span>
              </div>
            </div>
          </div>
        )}

        {state.status === 'ready_to_install' && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold tracking-tight text-white">Update Ready to Install</h3>

            <div className="space-y-1.5 text-sm">
              <p className="text-white/70">
                New Version:{' '}
                <span className="font-mono-tabular font-semibold text-[var(--accent)]">
                  v{state.release.version}
                </span>
              </p>
              <p className="text-xs text-white/70 truncate">
                Saved to <span className="font-mono-tabular">0/Download/{state.release.apkName}</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-white/80 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onTriggerInstall}
                className="min-h-[44px] px-5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-xs font-semibold transition-colors"
              >
                Install
              </button>
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Update Failed</h3>
                <p className="text-xs text-white/70">{state.message}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] px-5 rounded-xl bg-white/10 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* 6. Delete File Confirmation Popup */
interface DeleteConfirmModalProps {
  track: Track | null;
  onCancel: () => void;
  onConfirmDelete: (track: Track) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  track,
  onCancel,
  onConfirmDelete,
}) => {
  if (!track) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-[#0B0D16]/95 backdrop-blur-2xl text-white border border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-rose-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">Are you sure you want to delete this file?</h3>
            <p className="text-xs text-white/70 mt-1 truncate">
              {track.title} · {track.artist}
            </p>
          </div>
        </div>

        <p className="text-xs text-white/70 leading-relaxed">
          This will permanently remove the audio file from your device storage and library list.
        </p>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-white/80 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirmDelete(track)}
            className="min-h-[44px] px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

/* 7. Song Info / Lyrics Modal */
interface SongInfoModalProps {
  track: Track | null;
  onClose: () => void;
  onEditTags: (track: Track) => void;
}

export const SongInfoModal: React.FC<SongInfoModalProps> = ({
  track,
  onClose,
  onEditTags,
}) => {
  if (!track) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-[#0B0D16]/95 backdrop-blur-2xl text-white border border-white/10 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
              <FileAudio className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white truncate">Song Info & Lyrics</h3>
              <p className="text-xs text-white/65 truncate">{track.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close song info"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          {[
            { label: 'Title', value: track.title },
            { label: 'Artist', value: track.artist },
            { label: 'Album', value: track.album },
            { label: 'Genre', value: track.genre },
            { label: 'Duration', value: formatTime(track.durationSec), mono: true },
            { label: 'File Size', value: formatBytes(track.sizeKb * 1024), mono: true },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 py-1.5 border-b border-white/[0.06]"
            >
              <span className="text-white/60">{row.label}</span>
              <span
                className={`text-right text-white font-medium truncate max-w-[230px] ${
                  row.mono ? 'font-mono-tabular' : ''
                }`}
              >
                {row.value}
              </span>
            </div>
          ))}
          <div className="pt-1 space-y-1">
            <span className="text-white/60 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Storage Path</span>
            </span>
            <p className="text-white/85 font-mono-tabular break-all bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2">
              {track.filePath || track.folder || 'Internal Audio Storage'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
          <p className="text-xs font-semibold text-white">Synced Lyrics</p>
          <p className="text-xs text-white/65 leading-relaxed">
            No embedded LRC lyrics found inside this audio file. Local metadata and artwork can be customized using Edit Tags.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 rounded-xl text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onEditTags(track);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Tags</span>
          </button>
        </div>
      </div>
    </div>
  );
};
