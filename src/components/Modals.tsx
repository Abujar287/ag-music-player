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
  FolderDown,
  Smartphone,
} from 'lucide-react';
import {
  APP_VERSION_TAG,
  GITHUB_REPO,
} from '../data/defaultLibrary';
import {
  Playlist,
  SleepTimerState,
  Track,
  UpdateFlowState,
} from '../types/music';
import { formatBytes } from '../utils/formatters';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#F8F7F4] dark:bg-[#141417] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">
            {mode === 'create' ? 'Create New Playlist' : 'Rename Playlist'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
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
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/15 dark:border-white/15 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#F8F7F4] dark:bg-[#141417] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <h3 className="text-base font-bold">Add to Playlist</h3>
            <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] truncate">{track.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {playlists.length === 0 ? (
            <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] py-4 text-center">
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
                  className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{pl.name}</p>
                    <p className="text-xs text-[#6B675E] dark:text-[#9E9A90]">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#F8F7F4] dark:bg-[#141417] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Edit Tag / Audio Info</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
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
                className="w-16 h-16 rounded-xl object-cover border border-black/15 dark:border-white/15 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                <Disc3 className="w-7 h-7 text-[var(--accent)]" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="px-3 py-2 rounded-xl border border-black/15 dark:border-white/15 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
                <ImagePlus className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Change Cover</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverPick} />
              </label>
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => setCoverUrl(null)}
                  className="px-3 py-2 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10"
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
              <label className="text-xs font-medium text-[#6B675E] dark:text-[#9E9A90]">
                {field.label}
              </label>
              <input
                type="text"
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/15 dark:border-white/15 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#F8F7F4] dark:bg-[#141417] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold">Sleep Timer</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
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
              className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                sleepTimer.active && sleepTimer.mode === item.mode
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-2">
          <label className="text-xs font-medium text-[#6B675E] dark:text-[#9E9A90]">
            Custom Duration (minutes)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={240}
              value={customMin}
              onChange={(e) => setCustomMin(Math.max(1, Number(e.target.value)))}
              className="flex-1 px-3 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/15 dark:border-white/15 text-sm font-mono-tabular"
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
            className="w-full py-2.5 rounded-xl border border-rose-500/30 text-rose-500 text-xs font-semibold hover:bg-rose-500/10"
          >
            Turn Off Active Timer
          </button>
        )}
      </div>
    </div>
  );
};

/* 5. GitHub In-App Auto-Updater Modal */
interface UpdateModalProps {
  state: UpdateFlowState;
  onClose: () => void;
  onStartDownload: () => void;
  onSimulateUpdate: () => void;
  onTriggerInstall: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  state,
  onClose,
  onStartDownload,
  onSimulateUpdate,
  onTriggerInstall,
}) => {
  if (state.status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={state.status === 'downloading' ? undefined : onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#F8F7F4] dark:bg-[#141417] border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4">
        {state.status === 'checking' && (
          <div className="py-6 flex flex-col items-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[var(--accent)] animate-spin" />
            <h3 className="text-base font-bold">Checking GitHub Releases...</h3>
            <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] font-mono-tabular">
              api.github.com/repos/{GITHUB_REPO}/releases/latest
            </p>
          </div>
        )}

        {state.status === 'up_to_date' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <h3 className="text-base font-bold">You are on the latest version</h3>
                  <p className="text-xs text-[#6B675E] dark:text-[#9E9A90]">
                    Installed: <span className="font-mono-tabular">{state.currentVersion}</span>
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>
            {state.note && (
              <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] leading-relaxed">
                {state.note}
              </p>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10">
              <button
                onClick={onSimulateUpdate}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Preview V-1.0.2 Update Flow
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {state.status === 'available' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-mono-tabular text-[var(--accent)] font-semibold">
                  {state.release.tagName} · {formatBytes(state.release.apkSizeBytes)}
                </p>
                <h3 className="text-lg font-bold mt-0.5">Update Available</h3>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 max-h-40 overflow-y-auto text-xs space-y-1.5">
              <p className="font-semibold">Release Notes — {state.release.apkName}</p>
              <p className="text-[#6B675E] dark:text-[#9E9A90] whitespace-pre-line">
                {state.release.body}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
              >
                Later
              </button>
              <button
                onClick={onStartDownload}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Update Now</span>
              </button>
            </div>
          </div>
        )}

        {state.status === 'downloading' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <FolderDown className="w-6 h-6 text-[var(--accent)] shrink-0" />
              <div className="min-w-0">
                <h3 className="text-base font-bold truncate">Downloading {state.release.tagName}</h3>
                <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] font-mono-tabular truncate">
                  {state.release.apkName}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="w-full h-2.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-150"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-[#6B675E] dark:text-[#9E9A90]">
                  DownloadManager · /Downloads/
                </span>
                <span className="font-semibold text-[var(--accent)]">{state.progress}%</span>
              </div>
            </div>
          </div>
        )}

        {state.status === 'ready_to_install' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-6 h-6 text-[var(--accent)] shrink-0" />
                <div>
                  <h3 className="text-base font-bold">Download Complete (100%)</h3>
                  <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] font-mono-tabular">
                    {state.release.apkName}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#6B675E] dark:text-[#9E9A90] leading-relaxed">
              Saved to System Downloads. Installing replaces {APP_VERSION_TAG} via FileProvider while preserving all your playlists, favorites, and settings.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
              <button
                onClick={onTriggerInstall}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold"
              >
                Install / Update
              </button>
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
                <div>
                  <h3 className="text-base font-bold">Update Check Issue</h3>
                  <p className="text-xs text-[#6B675E] dark:text-[#9E9A90]">{state.message}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10">
              <button
                onClick={onSimulateUpdate}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Preview V-1.0.2 Update Flow
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-black/10 dark:bg-white/10 text-xs font-semibold"
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
