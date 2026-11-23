import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu,
  Search,
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Plus,
  MoreVertical,
  Disc3,
  Heart,
  Folder,
  Music2,
  User,
  Tag,
  Share2,
  Edit3,
  Trash2,
  ListPlus,
  BellRing,
  Moon,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ListMusic,
  ShieldCheck,
  RefreshCw,
  FileAudio,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { audioEngine } from './audio/AudioEngine';
import { CategorySegmentGrid } from './components/CategorySegmentGrid';
import {
  AddToPlaylistModal,
  EditTagModal,
  PlaylistModal,
  SleepTimerModal,
  SongInfoModal,
  UpdateModal,
  DeleteConfirmModal,
} from './components/Modals';
import { NowPlayingModal } from './components/NowPlayingModal';
import { ScenicBackdrop } from './components/ScenicBackdrop';
import { DrawerSection, SideDrawer } from './components/SideDrawer';
import { CoverImage } from './components/CoverImage';
import { SeekBar } from './components/SeekBar';
import {
  ACCENT_OPTIONS,
  APP_VERSION,
  DEFAULT_EQUALIZER,
  DEFAULT_PLAYLISTS,
  DEFAULT_SETTINGS,
  DEFAULT_TRACKS,
  GITHUB_LATEST_API,
  SCENIC_THEMES,
} from './data/defaultLibrary';
import {
  AppSettings,
  EqualizerState,
  GitHubReleaseInfo,
  LibraryTab,
  Playlist,
  RepeatMode,
  SleepTimerState,
  Track,
  UpdateFlowState,
} from './types/music';
import { formatTime, isRemoteVersionNewer } from './utils/formatters';

const STORAGE_KEYS = {
  tracks: 'ag_music_tracks_v1',
  playlists: 'ag_music_playlists_v1',
  settings: 'ag_music_settings_v1',
  equalizer: 'ag_music_equalizer_v1',
};

function getTrackFileName(track: Track): string {
  const raw = track.filePath || track.audioUrl || '';
  if (!raw) return '';
  const clean = raw.split('?')[0];
  const segments = clean.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || '';
}

function matchesSearchQuery(track: Track, rawQuery: string): boolean {
  const trimmed = rawQuery.trim().toLowerCase();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const fileName = getTrackFileName(track);
  const haystack = [
    track.title,
    fileName,
    track.filePath ?? '',
    track.folder,
    track.artist,
    track.album,
    track.genre,
  ]
    .join(' ')
    .toLowerCase();
  return tokens.every((tok) => haystack.includes(tok));
}

function loadInitialTracks(): Track[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tracks);
    if (raw) {
      const parsed = JSON.parse(raw) as Track[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((t) => !t.audioUrl?.startsWith('blob:') && !t.id.startsWith('trk-'));
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_TRACKS;
}

function loadInitialPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.playlists);
    if (raw) {
      const parsed = JSON.parse(raw) as Playlist[];
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (pl) =>
            !(
              (pl.id === 'pl-favorites' || pl.id === 'pl-focus') &&
              Array.isArray(pl.trackIds) &&
              pl.trackIds.every((id) => id.startsWith('trk-'))
            )
        );
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_PLAYLISTS;
}

function loadInitialSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function loadInitialEqualizer(): EqualizerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.equalizer);
    if (raw) return { ...DEFAULT_EQUALIZER, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_EQUALIZER;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(loadInitialTracks);
  const [playlists, setPlaylists] = useState<Playlist[]>(loadInitialPlaylists);
  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const [equalizer, setEqualizer] = useState<EqualizerState>(loadInitialEqualizer);

  const [activeTab, setActiveTab] = useState<LibraryTab | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState<DrawerSection>('menu');
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);

  // Drill-down filter for Albums, Artists, Folders, Genres, or Playlist
  const [drillFilter, setDrillFilter] = useState<{
    type: 'album' | 'artist' | 'folder' | 'genre' | 'playlist';
    value: string;
    label: string;
  } | null>(null);

  // Playback state
  const [queue, setQueue] = useState<Track[]>(() =>
    loadInitialTracks().filter((t) => t.durationSec >= 30)
  );
  const [currentTrackId, setCurrentTrackId] = useState<string>(
    () => loadInitialTracks()[0]?.id ?? ''
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>({
    active: false,
    mode: null,
    remainingSec: 0,
  });

  // Menus & Modals
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [menuPlaylist, setMenuPlaylist] = useState<Playlist | null>(null);
  const [playlistModal, setPlaylistModal] = useState<{
    open: boolean;
    mode: 'create' | 'rename';
    playlistId?: string;
    initialName?: string;
  }>({ open: false, mode: 'create' });
  const [editTagTrack, setEditTagTrack] = useState<Track | null>(null);
  const [songInfoTrack, setSongInfoTrack] = useState<Track | null>(null);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<Track | null>(null);
  const [sleepTimerOpen, setSleepTimerOpen] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateFlowState>({ status: 'idle' });
  const [pendingDeleteTrack, setPendingDeleteTrack] = useState<Track | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [desktopScrubSec, setDesktopScrubSec] = useState<number | null>(null);

  const pullStartYRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const tracksRef = useRef<Track[]>(tracks);
  const currentTrackIdRef = useRef<string>(currentTrackId);
  const nowPlayingBackRef = useRef<(() => boolean) | null>(null);
  const backHandlerRef = useRef<() => boolean>(() => false);
  const activeUpdateReleaseRef = useRef<{ release: GitHubReleaseInfo; currentVersionTag: string } | null>(null);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    currentTrackIdRef.current = currentTrackId;
  }, [currentTrackId]);

  backHandlerRef.current = () => {
    if (updateState.status !== 'idle') {
      if (updateState.status !== 'downloading') {
        setUpdateState({ status: 'idle' });
      }
      return true;
    }
    if (pendingDeleteTrack) {
      setPendingDeleteTrack(null);
      return true;
    }
    if (sleepTimerOpen) {
      setSleepTimerOpen(false);
      return true;
    }
    if (songInfoTrack) {
      setSongInfoTrack(null);
      return true;
    }
    if (editTagTrack) {
      setEditTagTrack(null);
      return true;
    }
    if (addToPlaylistTrack) {
      setAddToPlaylistTrack(null);
      return true;
    }
    if (playlistModal.open) {
      setPlaylistModal({ open: false, mode: 'create' });
      return true;
    }
    if (menuTrack) {
      setMenuTrack(null);
      return true;
    }
    if (menuPlaylist) {
      setMenuPlaylist(null);
      return true;
    }
    if (nowPlayingOpen) {
      if (nowPlayingBackRef.current?.()) {
        return true;
      }
      setNowPlayingOpen(false);
      return true;
    }
    if (drawerOpen) {
      setDrawerOpen(false);
      return true;
    }
    if (searchOpen) {
      setSearchOpen(false);
      setSearchQuery('');
      return true;
    }
    if (drillFilter) {
      setDrillFilter(null);
      return true;
    }
    if (activeTab !== null) {
      setActiveTab(null);
      return true;
    }
    return false;
  };

  useEffect(() => {
    const win = window as unknown as {
      __agHandleBackButton?: () => boolean;
    };
    win.__agHandleBackButton = () => backHandlerRef.current();
    return () => {
      delete win.__agHandleBackButton;
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const applyScannedTracks = useCallback(
    (incoming: Track[], isManual = false) => {
      if (!Array.isArray(incoming)) return;
      setTracks((prev) => {
        const favMap = new Map(prev.map((t) => [t.id, t.isFavorite]));
        const merged = incoming.map((t) => ({
          ...t,
          isFavorite: favMap.get(t.id) ?? Boolean(t.isFavorite),
        }));

        const changed =
          prev.length !== merged.length ||
          prev.some(
            (t, idx) =>
              t.id !== merged[idx]?.id ||
              t.contentUri !== merged[idx]?.contentUri ||
              t.title !== merged[idx]?.title
          );

        if (!changed && prev.length > 0) {
          return prev;
        }
        return merged;
      });

      setQueue((prevQueue) => {
        if (prevQueue.length > 0) return prevQueue;
        const filtered = settings.filterShortClips
          ? incoming.filter(
              (t) => t.durationSec >= settings.minDurationSec && t.sizeKb >= settings.minSizeKb
            )
          : incoming;
        return filtered.length > 0 ? filtered : incoming;
      });
      setCurrentTrackId((prevId) => prevId || incoming[0]?.id || '');

      if (isManual) {
        showToast(
          incoming.length > 0
            ? `Refreshed library (${incoming.length} audio files)`
            : 'No audio files found on device'
        );
      }
    },
    [settings.filterShortClips, settings.minDurationSec, settings.minSizeKb, showToast]
  );

  const scanDeviceStorage = useCallback(
    (isManual = false) => {
      try {
        const bridge = (window as unknown as {
          AndroidBridge?: {
            scanLocalAudioAsync?: (manual: boolean) => void;
            requestPermissionAndScan?: () => void;
            getLocalAudioTracksJson?: () => string;
          };
        }).AndroidBridge;

        if (bridge && typeof bridge.scanLocalAudioAsync === 'function') {
          bridge.scanLocalAudioAsync(isManual);
          return;
        }

        if (bridge && typeof bridge.getLocalAudioTracksJson === 'function') {
          const jsonStr = bridge.getLocalAudioTracksJson();
          const parsed = JSON.parse(jsonStr) as Track[];
          if (Array.isArray(parsed)) {
            applyScannedTracks(parsed, isManual);
          }
        }
      } catch (e) {
        console.error('Failed to scan device audio:', e);
      }
    },
    [applyScannedTracks]
  );

  useEffect(() => {
    const win = window as unknown as {
      __agOnDeviceTracks?: (incoming: Track[], isManual?: boolean) => void;
      __agOnTrackDeleted?: (trackId: string, success: boolean, errorMsg?: string | null) => void;
      __agUpdateCallbacks?: {
        onProgress?: (percent: number, downloadedBytes: number, totalBytes: number) => void;
        onReady?: () => void;
        onError?: (msg: string) => void;
      };
    };
    win.__agOnDeviceTracks = (incoming: Track[], isManual = false) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      setIsRefreshing(false);
      applyScannedTracks(incoming, isManual);
    };
    win.__agOnTrackDeleted = (trackId: string, success: boolean, errorMsg?: string | null) => {
      if (!success) {
        showToast(errorMsg || 'Unable to delete audio file from storage');
        return;
      }
      const deletedTrack = tracksRef.current.find((t) => t.id === trackId);
      if (trackId === currentTrackIdRef.current) {
        audioEngine.pause();
        setIsPlaying(false);
        setPositionSec(0);
      }
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      setQueue((prev) => prev.filter((t) => t.id !== trackId));
      setPlaylists((prev) =>
        prev.map((pl) => ({ ...pl, trackIds: pl.trackIds.filter((id) => id !== trackId) }))
      );
      showToast(
        deletedTrack
          ? `Deleted "${deletedTrack.title}" from device`
          : 'Audio file deleted from device'
      );
    };
    win.__agUpdateCallbacks = {
      onProgress: (percent: number, downloadedBytes: number, totalBytes: number) => {
        const ctx = activeUpdateReleaseRef.current;
        if (!ctx) return;
        setUpdateState({
          status: 'downloading',
          release: ctx.release,
          currentVersionTag: ctx.currentVersionTag,
          progress: percent,
          downloadedBytes,
          totalBytes: totalBytes > 0 ? totalBytes : ctx.release.apkSizeBytes,
        });
      },
      onReady: () => {
        const ctx = activeUpdateReleaseRef.current;
        if (!ctx) return;
        setUpdateState({
          status: 'ready_to_install',
          release: ctx.release,
          currentVersionTag: ctx.currentVersionTag,
        });
      },
      onError: (msg: string) => {
        setUpdateState({ status: 'error', message: msg });
      },
    };

    scanDeviceStorage(false);
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      delete win.__agOnDeviceTracks;
      delete win.__agOnTrackDeleted;
      delete win.__agUpdateCallbacks;
    };
  }, [applyScannedTracks, scanDeviceStorage, showToast]);

  const handlePullRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const bridge = (window as unknown as {
      AndroidBridge?: {
        hasAudioPermission?: () => boolean;
        requestPermissionAndScan?: () => void;
        scanLocalAudioAsync?: (manual: boolean) => void;
      };
    }).AndroidBridge;

    if (bridge && typeof bridge.scanLocalAudioAsync === 'function') {
      if (typeof bridge.hasAudioPermission === 'function' && !bridge.hasAudioPermission()) {
        bridge.requestPermissionAndScan?.();
        refreshTimerRef.current = window.setTimeout(() => setIsRefreshing(false), 1200);
        return;
      }
      bridge.scanLocalAudioAsync(true);
      refreshTimerRef.current = window.setTimeout(() => setIsRefreshing(false), 3500);
    } else {
      scanDeviceStorage(true);
      refreshTimerRef.current = window.setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [isRefreshing, scanDeviceStorage]);

  // Persist state (cache device tracks locally so opening the app shows songs immediately)
  useEffect(() => {
    try {
      const serializable = tracks.filter((t) => !t.audioUrl?.startsWith('blob:'));
      localStorage.setItem(STORAGE_KEYS.tracks, JSON.stringify(serializable));
    } catch {
      // ignore quota errors
    }
  }, [tracks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.playlists, JSON.stringify(playlists));
    } catch {
      // ignore
    }
  }, [playlists]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.equalizer, JSON.stringify(equalizer));
    } catch {
      // ignore
    }
  }, [equalizer]);

  // Apply Dark/Light theme and Accent CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (settings.themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const scenic =
      SCENIC_THEMES.find((s) => s.id === (settings.scenicThemeId ?? 'midnight_gold')) ??
      SCENIC_THEMES[0];
    root.style.setProperty('--scenic-from', scenic.fromRgba);
    root.style.setProperty('--scenic-via', scenic.viaRgba);
    root.style.setProperty('--scenic-to', scenic.toRgba);
    root.style.setProperty('--scenic-surface', scenic.surfaceRgba);

    const accent = ACCENT_OPTIONS.find((a) => a.id === settings.accentId);
    root.style.setProperty('--accent', accent?.hex ?? scenic.accentHex);
    root.style.setProperty('--accent-hover', accent?.hoverHex ?? scenic.accentHoverHex);
    root.style.setProperty('--accent-fg', accent?.fgHex ?? scenic.accentFgHex);
    root.style.setProperty('--accent-soft', accent?.softRgba ?? scenic.accentSoftRgba);
  }, [settings.themeMode, settings.accentId, settings.scenicThemeId]);

  // Sync Equalizer & Fade settings to Web Audio Engine
  useEffect(() => {
    audioEngine.updateEqualizer(equalizer);
  }, [equalizer]);

  useEffect(() => {
    audioEngine.setFadeOnPause(settings.fadeOnPause);
  }, [settings.fadeOnPause]);

  // Filtered tracks respecting auto-sync permission, short-clip filter, hidden folders, and file/metadata search
  const visibleTracks = useMemo(() => {
    if (!settings.autoSyncPermission) return [];
    return tracks.filter((t) => {
      if (settings.filterShortClips) {
        if (t.durationSec < settings.minDurationSec || t.sizeKb < settings.minSizeKb) {
          return false;
        }
      }
      if (settings.hiddenFolders.includes(t.folder)) return false;
      return matchesSearchQuery(t, searchQuery);
    });
  }, [
    tracks,
    settings.autoSyncPermission,
    settings.filterShortClips,
    settings.minDurationSec,
    settings.minSizeKb,
    settings.hiddenFolders,
    searchQuery,
  ]);

  const audioTracks = useMemo(
    () => visibleTracks.filter((t) => t.mediaType !== 'video'),
    [visibleTracks]
  );

  const favoriteTracks = useMemo(
    () => audioTracks.filter((t) => t.isFavorite),
    [audioTracks]
  );

  const currentTrack = useMemo(() => {
    return (
      tracks.find((t) => t.id === currentTrackId) ??
      visibleTracks[0] ??
      tracks[0] ??
      null
    );
  }, [tracks, visibleTracks, currentTrackId]);

  // Grouped views
  const albums = useMemo(() => {
    const map = new Map<
      string,
      { name: string; artist: string; coverUrl: string | null; count: number }
    >();
    audioTracks.forEach((t) => {
      const existing = map.get(t.album);
      if (existing) {
        existing.count += 1;
        if (!existing.coverUrl && t.coverUrl) existing.coverUrl = t.coverUrl;
      } else {
        map.set(t.album, { name: t.album, artist: t.artist, coverUrl: t.coverUrl, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [audioTracks]);

  const artists = useMemo(() => {
    const map = new Map<
      string,
      { name: string; trackCount: number; albums: Set<string>; coverUrl: string | null }
    >();
    audioTracks.forEach((t) => {
      const existing = map.get(t.artist);
      if (existing) {
        existing.trackCount += 1;
        existing.albums.add(t.album);
        if (!existing.coverUrl && t.coverUrl) existing.coverUrl = t.coverUrl;
      } else {
        map.set(t.artist, {
          name: t.artist,
          trackCount: 1,
          albums: new Set([t.album]),
          coverUrl: t.coverUrl,
        });
      }
    });
    return Array.from(map.values());
  }, [audioTracks]);

  const folders = useMemo(() => {
    const map = new Map<string, number>();
    audioTracks.forEach((t) => {
      map.set(t.folder, (map.get(t.folder) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([path, count]) => {
      const segments = path.split('/').filter(Boolean);
      const name = segments[segments.length - 1] || path;
      return { name, path, count };
    });
  }, [audioTracks]);

  const genres = useMemo(() => {
    const map = new Map<string, number>();
    audioTracks.forEach((t) => {
      map.set(t.genre, (map.get(t.genre) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [audioTracks]);

  const drillTracks = useMemo(() => {
    if (!drillFilter) return [];
    if (drillFilter.type === 'album')
      return audioTracks.filter((t) => t.album === drillFilter.value);
    if (drillFilter.type === 'artist')
      return audioTracks.filter((t) => t.artist === drillFilter.value);
    if (drillFilter.type === 'folder')
      return audioTracks.filter((t) => t.folder === drillFilter.value);
    if (drillFilter.type === 'genre')
      return audioTracks.filter((t) => t.genre === drillFilter.value);
    if (drillFilter.type === 'playlist') {
      const pl = playlists.find((p) => p.id === drillFilter.value);
      if (!pl) return [];
      return pl.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is Track => Boolean(t && matchesSearchQuery(t, searchQuery)));
    }
    return [];
  }, [drillFilter, audioTracks, playlists, tracks, searchQuery]);

  // Playback handlers
  const playTrack = useCallback(
    async (track: Track, customQueue?: Track[]) => {
      if (customQueue && customQueue.length > 0) {
        setQueue(customQueue);
      } else if (!queue.some((q) => q.id === track.id)) {
        setQueue((prev) => [track, ...prev]);
      }
      setCurrentTrackId(track.id);
      setPositionSec(0);
      setIsPlaying(true);
      await audioEngine.playTrack(track, 0);
    },
    [queue]
  );

  const handleTogglePlay = useCallback(async () => {
    if (!currentTrack) return;
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (audioEngine.isTrackLoaded(currentTrack.id)) {
        await audioEngine.resume();
      } else {
        await audioEngine.playTrack(currentTrack, positionSec);
      }
    }
  }, [currentTrack, isPlaying, positionSec]);

  const handleNext = useCallback(
    async (autoAdvance = false) => {
      if (queue.length === 0 || !currentTrack) return;

      if (autoAdvance && sleepTimer.active && sleepTimer.mode === 'end_of_track') {
        audioEngine.pause();
        setIsPlaying(false);
        setSleepTimer({ active: false, mode: null, remainingSec: 0 });
        showToast('Sleep timer paused playback at end of track');
        return;
      }

      if (autoAdvance && repeatMode === 'one') {
        setPositionSec(0);
        setIsPlaying(true);
        await audioEngine.playTrack(currentTrack, 0);
        return;
      }

      const idx = queue.findIndex((t) => t.id === currentTrack.id);
      let nextIdx = idx + 1;

      if (shuffle && queue.length > 1) {
        do {
          nextIdx = Math.floor(Math.random() * queue.length);
        } while (nextIdx === idx);
      } else if (nextIdx >= queue.length) {
        if (repeatMode === 'all' || !autoAdvance) {
          nextIdx = 0;
        } else {
          setIsPlaying(false);
          setPositionSec(0);
          return;
        }
      }

      const nextTrack = queue[nextIdx];
      if (nextTrack) {
        setCurrentTrackId(nextTrack.id);
        setPositionSec(0);
        setIsPlaying(true);
        await audioEngine.playTrack(nextTrack, 0);
      }
    },
    [queue, currentTrack, repeatMode, shuffle, sleepTimer, showToast]
  );

  const handlePrev = useCallback(async () => {
    if (queue.length === 0 || !currentTrack) return;
    if (positionSec > 4) {
      setPositionSec(0);
      audioEngine.seekTo(0);
      return;
    }
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = idx <= 0 ? queue.length - 1 : idx - 1;
    const prevTrack = queue[prevIdx];
    if (prevTrack) {
      setCurrentTrackId(prevTrack.id);
      setPositionSec(0);
      setIsPlaying(true);
      await audioEngine.playTrack(prevTrack, 0);
    }
  }, [queue, currentTrack, positionSec]);

  // Wire audio engine callbacks (including native audio focus / duration / state updates)
  useEffect(() => {
    audioEngine.setCallbacks(
      (pos) => setPositionSec(pos),
      () => {
        void handleNext(true);
      },
      (playing) => setIsPlaying(playing),
      (errMsg) => showToast(errMsg),
      (durSec) => {
        const rounded = Math.round(durSec);
        const activeId = currentTrackIdRef.current;
        if (!activeId || rounded <= 0) return;
        setTracks((prev) =>
          prev.some((t) => t.id === activeId && (t.durationSec <= 0 || Math.abs(t.durationSec - rounded) >= 2))
            ? prev.map((t) => (t.id === activeId ? { ...t, durationSec: rounded } : t))
            : prev
        );
        setQueue((prev) =>
          prev.some((t) => t.id === activeId && (t.durationSec <= 0 || Math.abs(t.durationSec - rounded) >= 2))
            ? prev.map((t) => (t.id === activeId ? { ...t, durationSec: rounded } : t))
            : prev
        );
      }
    );
  }, [handleNext, showToast]);

  // Wire MediaSession API for Lock Screen & Notification controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    if (!settings.notificationControls) {
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork:
        settings.lockScreenArt && currentTrack.coverUrl
          ? [{ src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [],
    });
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    navigator.mediaSession.setActionHandler('play', () => void handleTogglePlay());
    navigator.mediaSession.setActionHandler('pause', () => void handleTogglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => void handlePrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => void handleNext(false));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        audioEngine.seekTo(details.seekTime);
        setPositionSec(details.seekTime);
      }
    });
  }, [
    currentTrack,
    isPlaying,
    settings.lockScreenArt,
    settings.notificationControls,
    handleTogglePlay,
    handlePrev,
    handleNext,
  ]);

  // Sleep timer countdown
  useEffect(() => {
    if (!sleepTimer.active || sleepTimer.mode === 'end_of_track') return;
    const id = window.setInterval(() => {
      setSleepTimer((prev) => {
        if (!prev.active) return prev;
        if (prev.remainingSec <= 1) {
          audioEngine.pause();
          setIsPlaying(false);
          showToast('Sleep timer ended — playback paused');
          return { active: false, mode: null, remainingSec: 0 };
        }
        return { ...prev, remainingSec: prev.remainingSec - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [sleepTimer.active, sleepTimer.mode, showToast]);

  // Track actions
  const toggleFavorite = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t))
    );
  };

  const handleSaveTrackTags = (trackId: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...patch } : t)));
    setQueue((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...patch } : t)));
    showToast('Audio tags updated');
  };

  const handleDeleteTrack = (track: Track) => {
    setPendingDeleteTrack(track);
  };

  const executeDeleteTrack = (track: Track) => {
    setPendingDeleteTrack(null);
    const bridge = (window as unknown as {
      AndroidBridge?: {
        deleteDeviceTrack?: (trackId: string, contentUri: string, filePath: string) => void;
      };
    }).AndroidBridge;

    if (
      bridge &&
      typeof bridge.deleteDeviceTrack === 'function' &&
      (track.contentUri || track.filePath)
    ) {
      bridge.deleteDeviceTrack(track.id, track.contentUri ?? '', track.filePath ?? '');
      return;
    }

    if (track.id === currentTrack?.id) {
      audioEngine.pause();
      setIsPlaying(false);
    }
    setTracks((prev) => prev.filter((t) => t.id !== track.id));
    setQueue((prev) => prev.filter((t) => t.id !== track.id));
    setPlaylists((prev) =>
      prev.map((pl) => ({ ...pl, trackIds: pl.trackIds.filter((id) => id !== track.id) }))
    );
    showToast(`Deleted "${track.title}" from library`);
  };

  const copyTextWithFallback = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to legacy copy
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }, []);

  const handleShareTrack = async (track: Track) => {
    const bridge = (window as unknown as {
      AndroidBridge?: {
        shareTrack?: (title: string, artist: string, contentUri: string, filePath: string) => boolean;
      };
    }).AndroidBridge;

    if (bridge && typeof bridge.shareTrack === 'function') {
      bridge.shareTrack(track.title, track.artist, track.contentUri ?? '', track.filePath ?? '');
      return;
    }

    const shareText = `Listening to "${track.title}" by ${track.artist} on AG Music Player`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: track.title, text: shareText });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }
    const copied = await copyTextWithFallback(shareText);
    showToast(
      copied
        ? `Share details copied for "${track.title}"`
        : `Share is only available on Android or HTTPS browser`
    );
  };

  const handleSetRingtone = (track: Track) => {
    showToast(`"${track.title}" configured as Android ringtone (WRITE_SETTINGS)`);
  };

  // Playlist actions
  const handleCreateOrRenamePlaylist = (name: string) => {
    if (playlistModal.mode === 'create') {
      const next: Playlist = {
        id: `pl-${Date.now()}`,
        name,
        trackIds: [],
        createdAt: Date.now(),
      };
      setPlaylists((prev) => [next, ...prev]);
      showToast(`Created playlist "${name}"`);
    } else if (playlistModal.playlistId) {
      setPlaylists((prev) =>
        prev.map((pl) => (pl.id === playlistModal.playlistId ? { ...pl, name } : pl))
      );
      showToast(`Renamed playlist to "${name}"`);
    }
  };

  const handleAddTrackToPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        if (pl.trackIds.includes(trackId)) return pl;
        return { ...pl, trackIds: [...pl.trackIds, trackId] };
      })
    );
    showToast('Added track to playlist');
  };

  const handlePlayPlaylist = (pl: Playlist) => {
    const plTracks = pl.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is Track => Boolean(t));
    if (plTracks.length === 0) {
      showToast('This playlist has no tracks yet');
      return;
    }
    void playTrack(plTracks[0], plTracks);
  };

  const handleSharePlaylist = async (pl: Playlist) => {
    const names = pl.trackIds
      .map((id) => tracks.find((t) => t.id === id)?.title)
      .filter(Boolean)
      .join(', ');
    const text = `AG Music Player Playlist "${pl.name}": ${names || 'Empty playlist'}`;

    const bridge = (window as unknown as {
      AndroidBridge?: {
        shareText?: (title: string, text: string) => boolean;
      };
    }).AndroidBridge;

    if (bridge && typeof bridge.shareText === 'function') {
      bridge.shareText(pl.name, text);
      return;
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: pl.name, text });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }
    const copied = await copyTextWithFallback(text);
    showToast(
      copied
        ? `Playlist "${pl.name}" copied to clipboard`
        : `Unable to open share dialog`
    );
  };

  const handleDeletePlaylist = (pl: Playlist) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
    if (drillFilter?.type === 'playlist' && drillFilter.value === pl.id) {
      setDrillFilter(null);
    }
    showToast(`Deleted playlist "${pl.name}"`);
  };

  const getInstalledVersionInfo = useCallback(() => {
    const bridge = (window as unknown as {
      AndroidBridge?: {
        getVersionName?: () => string;
        getVersionCode?: () => number;
      };
    }).AndroidBridge;

    const rawVersionName =
      bridge && typeof bridge.getVersionName === 'function'
        ? bridge.getVersionName() || APP_VERSION
        : APP_VERSION;
    const cleanVersion = rawVersionName.replace(/^[Vv]-?/, '').trim() || APP_VERSION;
    const versionCode =
      bridge && typeof bridge.getVersionCode === 'function'
        ? bridge.getVersionCode()
        : undefined;

    return {
      versionName: cleanVersion,
      versionTag: `v${cleanVersion}`,
      versionCode,
    };
  }, []);

  // GitHub In-App Auto-Updater
  const handleCheckUpdate = async () => {
    setUpdateState({ status: 'checking' });
    const installed = getInstalledVersionInfo();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);

    try {
      const res = await fetch(GITHUB_LATEST_API, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });

      if (res.status === 404) {
        setUpdateState({
          status: 'up_to_date',
          currentVersion: installed.versionTag,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(`Unable to check updates (HTTP ${res.status}).`);
      }

      const json = await res.json();
      const tagName: string = json.tag_name || installed.versionTag;
      const assets: Array<{ name: string; browser_download_url: string; size: number }> =
        Array.isArray(json.assets) ? json.assets : [];
      const apkAsset = assets.find((a) => a.name.toLowerCase().endsWith('.apk')) ?? assets[0];

      if (isRemoteVersionNewer(tagName, installed.versionName, installed.versionCode)) {
        if (!apkAsset || !apkAsset.browser_download_url) {
          throw new Error('New version found, but APK file is not ready yet.');
        }
        const release: GitHubReleaseInfo = {
          tagName,
          version: tagName.replace(/^[Vv]-?/, '').trim(),
          name: json.name || `AG Music Player ${tagName}`,
          body: json.body || '',
          apkName: apkAsset.name,
          apkUrl: apkAsset.browser_download_url,
          apkSizeBytes: apkAsset.size || 0,
          publishedAt: json.published_at || new Date().toISOString(),
        };
        activeUpdateReleaseRef.current = {
          release,
          currentVersionTag: installed.versionTag,
        };
        setUpdateState({
          status: 'available',
          release,
          currentVersionTag: installed.versionTag,
        });
      } else {
        setUpdateState({
          status: 'up_to_date',
          currentVersion: installed.versionTag,
        });
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      setUpdateState({
        status: 'error',
        message: isAbort
          ? 'Connection timed out. Please check your internet connection.'
          : err instanceof Error
            ? err.message
            : 'Unable to check for updates right now.',
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const handleStartDownload = () => {
    if (updateState.status !== 'available') return;
    const { release, currentVersionTag } = updateState;
    activeUpdateReleaseRef.current = { release, currentVersionTag };

    const bridge = (window as unknown as {
      AndroidBridge?: {
        startInAppApkDownload?: (
          apkUrl: string,
          apkName: string,
          tagName: string,
          apkSizeBytes: number
        ) => void;
      };
    }).AndroidBridge;

    if (bridge && typeof bridge.startInAppApkDownload === 'function') {
      setUpdateState({
        status: 'downloading',
        release,
        currentVersionTag,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: release.apkSizeBytes,
      });
      bridge.startInAppApkDownload(
        release.apkUrl,
        release.apkName,
        release.tagName,
        release.apkSizeBytes
      );
      return;
    }

    // Browser preview fallback
    const link = document.createElement('a');
    link.href = release.apkUrl;
    link.download = release.apkName;
    link.rel = 'noopener noreferrer';
    link.click();
    setUpdateState({ status: 'idle' });
    showToast(`Downloading ${release.apkName}`);
  };

  const handleTriggerInstall = () => {
    if (updateState.status !== 'ready_to_install') return;
    const bridge = (window as unknown as {
      AndroidBridge?: {
        installDownloadedApk?: () => boolean;
      };
    }).AndroidBridge;

    if (bridge && typeof bridge.installDownloadedApk === 'function') {
      const ok = bridge.installDownloadedApk();
      if (!ok) {
        setUpdateState({
          status: 'error',
          message: 'Unable to locate the downloaded APK file.',
        });
        return;
      }
    }
    setUpdateState({ status: 'idle' });
  };

  // Queue reordering
  const handleReorderQueue = (fromIdx: number, toIdx: number) => {
    setQueue((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const renderTrackRow = (track: Track, showFileSubtitle = false) => {
    const active = currentTrack?.id === track.id;
    const fileName = getTrackFileName(track);
    return (
      <div
        key={track.id}
        className={`relative flex items-center gap-3 px-2.5 py-2 rounded-xl border-0 transition-colors ${
          active ? 'bg-[var(--accent-soft)]' : 'hover:bg-white/[0.07]'
        }`}
      >
        <button
          onClick={() => void playTrack(track, drillFilter ? drillTracks : audioTracks)}
          className="flex flex-1 items-center gap-3 min-w-0 text-left min-h-[44px]"
        >
          <CoverImage
            src={track.coverUrl}
            alt={track.album}
            className="w-11 h-11 rounded-xl object-cover shrink-0"
            fallback={
              <div className="w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0">
                <Disc3
                  className={`w-5 h-5 ${active ? 'text-[var(--accent)]' : 'text-[var(--accent)]/85'}`}
                />
              </div>
            }
          />

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${active ? 'text-[var(--accent)]' : 'text-white'}`}>
              {track.title}
            </p>
            <p className="text-xs text-white/65 truncate">
              {showFileSubtitle && fileName
                ? `${fileName} · ${track.artist}`
                : `${track.artist} · ${track.album}`}
            </p>
          </div>

          <span className="text-xs font-mono-tabular tabular-nums text-white/65 shrink-0">
            {formatTime(track.durationSec)}
          </span>
        </button>

        {/* 3-dot quick action */}
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuTrack(track)}
            aria-label={`Options for ${track.title}`}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen flex flex-col bg-[#061329] text-white overflow-x-hidden">
      {/* Shared Scenic Background across every screen */}
      <ScenicBackdrop />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-transparent border-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeTab !== null || drillFilter ? (
              <button
                onClick={() => {
                  if (drillFilter) {
                    setDrillFilter(null);
                  } else {
                    setActiveTab(null);
                  }
                }}
                aria-label="Go Back"
                className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setDrawerSection('menu');
                  setDrawerOpen(true);
                }}
                aria-label="Open Navigation Menu"
                className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {!searchOpen && (
              <h1 className="text-base sm:text-lg font-semibold text-white truncate whitespace-nowrap">
                {drillFilter
                  ? drillFilter.label
                  : activeTab === 'tracks'
                    ? 'Tracks'
                    : activeTab === 'albums'
                      ? 'Albums'
                      : activeTab === 'artists'
                        ? 'Artists'
                        : activeTab === 'genres'
                          ? 'Genres'
                          : activeTab === 'folders'
                            ? 'Folders'
                            : activeTab === 'favorites'
                              ? 'Favorites'
                              : 'AG Music Player'}
              </h1>
            )}
          </div>

          {searchOpen ? (
            <div className="flex-1 flex items-center gap-2 max-w-xl">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-white/55 absolute left-3 pointer-events-none" />
                <input
                  type="search"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files, songs, folders..."
                  aria-label="Search audio files"
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-[var(--accent)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search text"
                    className="absolute right-2 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
                aria-label="Close Search"
                className="min-h-[44px] px-2.5 flex items-center justify-center rounded-xl text-xs font-medium text-white/85 hover:text-white hover:bg-white/10 shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search Music Library"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Workspace (with Pull-to-Refresh gesture support) */}
      <main
        onTouchStart={(e) => {
          const modalOpen =
            drawerOpen ||
            nowPlayingOpen ||
            Boolean(editTagTrack) ||
            Boolean(addToPlaylistTrack) ||
            Boolean(pendingDeleteTrack) ||
            sleepTimerOpen ||
            playlistModal.open ||
            updateState.status !== 'idle';
          if (modalOpen || isRefreshing) return;
          const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
          if (scrollTop <= 2 && e.touches.length === 1) {
            pullStartYRef.current = e.touches[0].clientY;
          }
        }}
        onTouchMove={(e) => {
          if (pullStartYRef.current === null || isRefreshing) return;
          const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
          if (scrollTop > 2) {
            pullStartYRef.current = null;
            setPullDistance(0);
            return;
          }
          const deltaY = e.touches[0].clientY - pullStartYRef.current;
          if (deltaY > 8) {
            setPullDistance(Math.min(84, (deltaY - 8) * 0.45));
          } else if (deltaY < 0) {
            pullStartYRef.current = null;
            setPullDistance(0);
          }
        }}
        onTouchEnd={() => {
          if (pullStartYRef.current === null) return;
          const shouldRefresh = pullDistance >= 52 && !isRefreshing;
          pullStartYRef.current = null;
          setPullDistance(0);
          if (shouldRefresh) {
            handlePullRefresh();
          }
        }}
        onTouchCancel={() => {
          pullStartYRef.current = null;
          setPullDistance(0);
        }}
        className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-28 lg:pb-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left/Primary Column: Pull-to-Refresh + 3x2 Category Grid + Active Library + List Section */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {(pullDistance > 0 || isRefreshing) && (
            <div
              className="flex items-center justify-center gap-2.5 overflow-hidden transition-all duration-150 text-xs font-medium text-[var(--accent)]"
              style={{
                height: isRefreshing ? 40 : Math.max(28, Math.round(pullDistance * 0.55)),
                opacity: isRefreshing ? 1 : Math.min(1, pullDistance / 36),
              }}
            >
              <RefreshCw
                className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
                style={
                  !isRefreshing
                    ? { transform: `rotate(${Math.round(pullDistance * 3.5)}deg)` }
                    : undefined
                }
              />
              <span>
                {isRefreshing
                  ? 'Scanning device audio...'
                  : pullDistance >= 52
                    ? 'Release to refresh audio files'
                    : 'Pull down to refresh'}
              </span>
            </div>
          )}

          {/* Auto-Sync Permission Banner (only shown if permission disabled) */}
          {!settings.autoSyncPermission && (
            <div className="p-4 rounded-2xl bg-[var(--scenic-surface,rgba(11,33,69,0.52))] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Audio Permission Required</p>
                  <p className="text-xs text-white/70">
                    Grant audio storage permission to automatically sync all songs on your device.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSettings((prev) => ({ ...prev, autoSyncPermission: true }));
                  showToast('Audio permission granted — library synced');
                }}
                className="min-h-[44px] px-4 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold whitespace-nowrap shrink-0"
              >
                Allow & Sync
              </button>
            </div>
          )}

          {/* SEARCH FILES OR ENTRY PAGE OR DEDICATED CATEGORY PAGE */}
          {searchQuery.trim().length > 0 ? (
            <section aria-label="Search Files" className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-medium text-white/70">
                  Matching Files ({audioTracks.length})
                </p>
                {audioTracks.length > 0 && (
                  <button
                    onClick={() => void playTrack(audioTracks[0], audioTracks)}
                    className="min-h-[34px] px-3.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play All</span>
                  </button>
                )}
              </div>
              {audioTracks.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FileAudio className="w-9 h-9 mx-auto text-white/40" />
                  <p className="text-sm font-medium text-white">No matching audio files</p>
                  <p className="text-xs text-white/60">
                    Try another file name, song title, artist, or folder name.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">{audioTracks.map((t) => renderTrackRow(t, true))}</div>
              )}
            </section>
          ) : activeTab === null && !drillFilter ? (
            <>
              {/* 3x2 Grid Section */}
              <CategorySegmentGrid
                activeTab={activeTab}
                hasDrillFilter={Boolean(drillFilter)}
                counts={{
                  tracks: audioTracks.length,
                  albums: albums.length,
                  artists: artists.length,
                  genres: genres.length,
                  folders: folders.length,
                  favorites: favoriteTracks.length,
                }}
                onSelectTab={(tab) => {
                  setActiveTab(tab);
                  setDrillFilter(null);
                }}
              />

              {/* List Section (Playlists - borderless items over uniform background) */}
              <section id="playlists-list-section" className="pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-base font-semibold text-white">Playlists</h2>
                    <span className="text-xs font-mono-tabular tabular-nums text-white/65">
                      ({playlists.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPlaylistModal({ open: true, mode: 'create' })}
                      aria-label="Create New Playlist"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[var(--accent)] hover:bg-white/10 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (playlists.length > 0) {
                          setDrillFilter({
                            type: 'playlist',
                            value: playlists[0].id,
                            label: playlists[0].name,
                          });
                        } else {
                          setPlaylistModal({ open: true, mode: 'create' });
                        }
                      }}
                      aria-label="Open Playlists"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-white/75 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  {playlists.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setPlaylistModal({ open: true, mode: 'create' })}
                      className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl border-0 bg-transparent hover:bg-white/[0.06] text-left transition-colors"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0">
                        <Plus className="w-5 h-5 text-[var(--accent)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">No playlists yet</p>
                        <p className="text-xs text-white/65 truncate">Tap + to create a playlist</p>
                      </div>
                    </button>
                  ) : (
                    playlists.map((pl) => (
                      <div
                        key={pl.id}
                        className="relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border-0 bg-transparent hover:bg-white/[0.06] transition-colors"
                      >
                        <button
                          onClick={() =>
                            setDrillFilter({ type: 'playlist', value: pl.id, label: pl.name })
                          }
                          className="flex flex-1 items-center gap-3 min-w-0 text-left min-h-[44px]"
                        >
                          <div className="w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0">
                            <ListMusic className="w-5 h-5 text-[var(--accent)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{pl.name}</p>
                            <p className="text-xs text-white/65">
                              {pl.trackIds.length} {pl.trackIds.length === 1 ? 'track' : 'tracks'}
                            </p>
                          </div>
                        </button>

                        <div className="relative shrink-0">
                          <button
                            onClick={() => setMenuPlaylist(pl)}
                            aria-label={`Playlist options for ${pl.name}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : (
            <section aria-label="Category Page" className="space-y-3.5">
              {/* Page Sub-Header Bar (Count + Play All) */}
              <div className="flex items-center justify-between gap-4 pb-1 px-1">
                <p className="text-xs font-mono-tabular text-white/70">
                  {drillFilter
                    ? `${drillTracks.length} track${drillTracks.length === 1 ? '' : 's'}`
                    : activeTab === 'tracks'
                      ? `${audioTracks.length} track${audioTracks.length === 1 ? '' : 's'}`
                      : activeTab === 'albums'
                        ? `${albums.length} album${albums.length === 1 ? '' : 's'}`
                        : activeTab === 'artists'
                          ? `${artists.length} artist${artists.length === 1 ? '' : 's'}`
                          : activeTab === 'folders'
                            ? `${folders.length} folder${folders.length === 1 ? '' : 's'}`
                            : activeTab === 'favorites'
                              ? `${favoriteTracks.length} favorite${favoriteTracks.length === 1 ? '' : 's'}`
                              : `${genres.length} genre${genres.length === 1 ? '' : 's'}`}
                </p>

                {((drillFilter && drillTracks.length > 0) ||
                  (!drillFilter && activeTab === 'tracks' && audioTracks.length > 0) ||
                  (!drillFilter && activeTab === 'favorites' && favoriteTracks.length > 0)) && (
                  <button
                    onClick={() => {
                      const list = drillFilter
                        ? drillTracks
                        : activeTab === 'favorites'
                          ? favoriteTracks
                          : audioTracks;
                      if (list.length > 0) void playTrack(list[0], list);
                    }}
                    className="min-h-[36px] px-4 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold flex items-center gap-1.5 shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play All</span>
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={drillFilter ? `drill-${drillFilter.type}-${drillFilter.value}` : activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
                  {drillFilter ? (
                    <div className="space-y-1">
                      {drillTracks.length === 0 ? (
                        <p className="py-12 text-center text-sm text-white/65">
                          No tracks in this selection.
                        </p>
                      ) : (
                        drillTracks.map((t) => renderTrackRow(t))
                      )}
                    </div>
                  ) : activeTab === 'tracks' ? (
                    <div className="space-y-1">
                      {audioTracks.length === 0 ? (
                        <div className="py-12 text-center space-y-4">
                          <Music2 className="w-11 h-11 mx-auto text-[var(--accent)] opacity-90" />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-white">No audio tracks found</p>
                            <p className="text-xs text-white/65 max-w-xs mx-auto">
                              Grant storage permission and scan your device storage for MP3, WAV, M4A, FLAC, and AAC files.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSettings((prev) => ({ ...prev, autoSyncPermission: true }));
                              const bridge = (window as unknown as {
                                AndroidBridge?: { requestPermissionAndScan?: () => void };
                              }).AndroidBridge;
                              if (bridge && typeof bridge.requestPermissionAndScan === 'function') {
                                bridge.requestPermissionAndScan();
                              } else {
                                scanDeviceStorage(true);
                              }
                            }}
                            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold shadow-lg active:scale-95 transition-transform"
                          >
                            Rescan / Grant Permission
                          </button>
                        </div>
                      ) : (
                        audioTracks.map((t) => renderTrackRow(t))
                      )}
                    </div>
                  ) : activeTab === 'albums' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                      {albums.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-sm text-white/65">
                          No albums found.
                        </div>
                      ) : (
                        albums.map((alb) => (
                          <button
                            key={alb.name}
                            onClick={() =>
                              setDrillFilter({ type: 'album', value: alb.name, label: alb.name })
                            }
                            style={{ backgroundColor: 'var(--scenic-surface, rgba(11, 33, 69, 0.52))' }}
                            className="group text-left rounded-2xl border-0 backdrop-blur-md p-3 hover:bg-white/[0.12] transition-colors"
                          >
                            <div className="aspect-square rounded-xl overflow-hidden bg-white/10 mb-2.5">
                              <CoverImage
                                src={alb.coverUrl}
                                alt={alb.name}
                                className="w-full h-full object-cover"
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Disc3 className="w-10 h-10 text-[var(--accent)] opacity-80" />
                                  </div>
                                }
                              />
                            </div>
                            <p className="text-sm font-semibold text-white truncate">{alb.name}</p>
                            <p className="text-xs text-white/65 truncate">
                              {alb.artist} · {alb.count} tracks
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  ) : activeTab === 'artists' ? (
                    <div className="space-y-1">
                      {artists.length === 0 ? (
                        <div className="py-12 text-center text-sm text-white/65">
                          No artists found.
                        </div>
                      ) : (
                        artists.map((art) => (
                          <button
                            key={art.name}
                            onClick={() =>
                              setDrillFilter({ type: 'artist', value: art.name, label: art.name })
                            }
                            className="w-full px-3 py-2.5 flex items-center gap-3.5 hover:bg-white/[0.07] rounded-xl border-0 text-left min-h-[56px]"
                          >
                            <CoverImage
                              src={art.coverUrl}
                              alt={art.name}
                              className="w-11 h-11 rounded-full object-cover shrink-0"
                              fallback={
                                <div className="w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0">
                                  <User className="w-5 h-5 text-[var(--accent)]" />
                                </div>
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{art.name}</p>
                              <p className="text-xs text-white/65">
                                {art.albums.size} album{art.albums.size === 1 ? '' : 's'} ·{' '}
                                {art.trackCount} tracks
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  ) : activeTab === 'folders' ? (
                    <div className="space-y-1">
                      {folders.length === 0 ? (
                        <div className="py-12 text-center text-sm text-white/65">
                          No folders found.
                        </div>
                      ) : (
                        folders.map((fld) => (
                          <button
                            key={fld.path}
                            onClick={() =>
                              setDrillFilter({ type: 'folder', value: fld.path, label: fld.name })
                            }
                            className="w-full px-3 py-2.5 flex items-center gap-3.5 hover:bg-white/[0.07] rounded-xl border-0 text-left min-h-[56px]"
                          >
                            <div className="w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0">
                              <Folder className="w-5 h-5 text-[var(--accent)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{fld.name}</p>
                            </div>
                            <span className="text-xs font-mono-tabular text-white/65 shrink-0">
                              {fld.count} {fld.count === 1 ? 'track' : 'tracks'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : activeTab === 'favorites' ? (
                    <div className="space-y-1">
                      {favoriteTracks.length === 0 ? (
                        <div className="py-12 text-center space-y-2">
                          <Heart className="w-10 h-10 mx-auto text-[var(--accent)] opacity-80" />
                          <p className="text-sm font-semibold text-white">No favorite tracks yet</p>
                          <p className="text-xs text-white/65">
                            Tap the heart icon on any track to keep it here.
                          </p>
                        </div>
                      ) : (
                        favoriteTracks.map((t) => renderTrackRow(t))
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {genres.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-sm text-white/70">
                          No genres found.
                        </div>
                      ) : (
                        genres.map((g) => (
                          <button
                            key={g.name}
                            onClick={() =>
                              setDrillFilter({ type: 'genre', value: g.name, label: g.name })
                            }
                            style={{ backgroundColor: 'var(--scenic-surface, rgba(11, 33, 69, 0.52))' }}
                            className="p-4 rounded-2xl border-0 backdrop-blur-md hover:bg-white/[0.12] text-left space-y-2 transition-colors"
                          >
                            <Tag className="w-5 h-5 text-[var(--accent)]" />
                            <div>
                              <p className="text-sm font-semibold text-white truncate">{g.name}</p>
                              <p className="text-xs text-white/70">
                                {g.count} track{g.count === 1 ? '' : 's'}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </section>
          )}
        </div>

        {/* Desktop Right Column: Live Now Playing Studio Deck */}
        {currentTrack && (
          <aside className="hidden lg:flex lg:col-span-5 xl:col-span-4 sticky top-20 flex-col rounded-3xl bg-black/25 backdrop-blur-xl border border-white/10 p-6 space-y-5 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                Now Playing
              </span>
              <button
                onClick={() => setNowPlayingOpen(true)}
                className="px-3 py-1.5 rounded-xl hover:bg-white/10 text-xs font-medium text-white flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Full Player</span>
              </button>
            </div>

            {/* Circular Artwork */}
            <div className="flex justify-center py-2">
              <div
                onClick={() => setNowPlayingOpen(true)}
                className="w-52 h-52 rounded-full p-1.5 border-2 border-[var(--accent)]/45 bg-black/30 cursor-pointer shadow-2xl"
              >
                <CoverImage
                  src={currentTrack.coverUrl}
                  alt={currentTrack.album}
                  className={`w-full h-full rounded-full object-cover ${isPlaying ? 'animate-vinyl' : 'animate-vinyl-paused'}`}
                  fallback={
                    <div
                      className={`w-full h-full rounded-full bg-white/[0.06] flex items-center justify-center ${isPlaying ? 'animate-vinyl' : 'animate-vinyl-paused'}`}
                    >
                      <Disc3 className="w-20 h-20 text-[var(--accent)]" />
                    </div>
                  }
                />
              </div>
            </div>

            {/* Clean Static Track Title */}
            <div className="text-center space-y-1 px-2">
              <p className="text-base font-semibold text-white truncate">{currentTrack.title}</p>
              <p className="text-xs text-white/65 truncate">
                {currentTrack.artist} · {currentTrack.album}
              </p>
            </div>

            {/* 1st Row: Favorite, Sleep Timer, 3-Dot Expand */}
            <div className="flex items-center justify-around py-2 border-y border-white/15 text-xs">
              <button
                onClick={() => toggleFavorite(currentTrack.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
                  currentTrack.isFavorite ? 'text-[var(--accent)]' : 'text-white/75'
                }`}
              >
                <Heart className={`w-4 h-4 ${currentTrack.isFavorite ? 'fill-current' : ''}`} />
                <span>Favorite</span>
              </button>
              <button
                onClick={() => setSleepTimerOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
                  sleepTimer.active ? 'text-[var(--accent)]' : 'text-white/75'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>
                  {sleepTimer.active
                    ? sleepTimer.mode === 'end_of_track'
                      ? 'End of Track'
                      : formatTime(sleepTimer.remainingSec)
                    : 'Sleep Timer'}
                </span>
              </button>
              <button
                onClick={() => setNowPlayingOpen(true)}
                aria-label="More Options"
                className="p-2 rounded-lg text-white/75 hover:bg-white/10"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            {/* 2nd Row: Duration Seek Bar */}
            <div className="space-y-1">
              <SeekBar
                positionSec={positionSec}
                durationSec={currentTrack.durationSec}
                onSeek={(val) => {
                  audioEngine.seekTo(val);
                  setPositionSec(val);
                }}
                onPreviewChange={setDesktopScrubSec}
                ariaLabel="Seek track"
              />
              <div className="flex justify-between text-[11px] font-mono-tabular text-white/70">
                <span>{formatTime(desktopScrubSec !== null ? desktopScrubSec : positionSec)}</span>
                <span>{formatTime(currentTrack.durationSec)}</span>
              </div>
            </div>

            {/* 3rd Row: Play / Pause Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShuffle((s) => !s)}
                aria-label="Shuffle"
                className={`p-2.5 rounded-xl transition-colors ${
                  shuffle ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-white/75'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                onClick={() => void handlePrev()}
                aria-label="Previous"
                className="p-2.5 rounded-xl text-white hover:bg-white/10"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button
                onClick={() => void handleTogglePlay()}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-14 h-14 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>
              <button
                onClick={() => void handleNext(false)}
                aria-label="Next"
                className="p-2.5 rounded-xl text-white hover:bg-white/10"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
              <button
                onClick={() =>
                  setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
                }
                aria-label="Repeat"
                className={`p-2.5 rounded-xl transition-colors ${
                  repeatMode !== 'off' ? 'text-[var(--accent)] bg-[var(--accent-soft)]' : 'text-white/75'
                }`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>
          </aside>
        )}
      </main>

      {/* Mobile Persistent Bottom Mini-Player */}
      {currentTrack && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/35 backdrop-blur-xl text-white">
          <SeekBar
            variant="mini"
            positionSec={positionSec}
            durationSec={currentTrack.durationSec}
            onSeek={(val) => {
              audioEngine.seekTo(val);
              setPositionSec(val);
            }}
            ariaLabel="Seek track in mini player"
          />
          <div className="px-4 py-2 flex items-center gap-3">
            <button
              onClick={() => setNowPlayingOpen(true)}
              className="flex flex-1 items-center gap-3 min-w-0 text-left min-h-[44px]"
            >
              <CoverImage
                src={currentTrack.coverUrl}
                alt={currentTrack.album}
                className="w-11 h-11 rounded-full object-cover shrink-0 border border-[var(--accent)]/50"
                fallback={
                  <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <Disc3 className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-white/70 truncate">
                  {currentTrack.artist}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => void handleTogglePlay()}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-11 h-11 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center shadow-md"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
              <button
                onClick={() => void handleNext(false)}
                aria-label="Next track"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white hover:bg-white/10"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side Drawer */}
      <SideDrawer
        open={drawerOpen}
        initialSection={drawerSection}
        onClose={() => setDrawerOpen(false)}
        settings={settings}
        onUpdateSettings={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
        equalizer={equalizer}
        onUpdateEqualizer={setEqualizer}
        onCheckUpdate={() => {
          setDrawerOpen(false);
          void handleCheckUpdate();
        }}
        currentTrack={currentTrack}
        positionSec={positionSec}
        isPlaying={isPlaying}
        onTogglePlay={() => void handleTogglePlay()}
        onNext={() => void handleNext(false)}
        onPrev={() => void handlePrev()}
        onRescanLibrary={() => {
          const bridge = (window as unknown as {
            AndroidBridge?: { requestPermissionAndScan?: () => void };
          }).AndroidBridge;
          if (bridge && typeof bridge.requestPermissionAndScan === 'function') {
            bridge.requestPermissionAndScan();
          } else {
            scanDeviceStorage(true);
          }
        }}
      />

      {/* Full-Screen Now Playing Screen */}
      <NowPlayingModal
        open={nowPlayingOpen}
        onClose={() => setNowPlayingOpen(false)}
        track={currentTrack}
        isPlaying={isPlaying}
        positionSec={positionSec}
        shuffle={shuffle}
        repeatMode={repeatMode}
        sleepTimer={sleepTimer}
        queue={queue}
        onTogglePlay={() => void handleTogglePlay()}
        onPrev={() => void handlePrev()}
        onNext={() => void handleNext(false)}
        onSeek={(sec) => {
          audioEngine.seekTo(sec);
          setPositionSec(sec);
        }}
        onToggleShuffle={() => setShuffle((s) => !s)}
        onCycleRepeat={() =>
          setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
        }
        onToggleFavorite={toggleFavorite}
        onOpenSleepTimer={() => setSleepTimerOpen(true)}
        onGoToAlbum={(t) => {
          setNowPlayingOpen(false);
          setActiveTab('albums');
          setDrillFilter({ type: 'album', value: t.album, label: t.album });
        }}
        onGoToArtist={(t) => {
          setNowPlayingOpen(false);
          setActiveTab('artists');
          setDrillFilter({ type: 'artist', value: t.artist, label: t.artist });
        }}
        onOpenSongInfo={(t) => setSongInfoTrack(t)}
        onOpenEditTag={(t) => setEditTagTrack(t)}
        onOpenAddToPlaylist={(t) => setAddToPlaylistTrack(t)}
        onSetRingtone={handleSetRingtone}
        onShareTrack={(t) => void handleShareTrack(t)}
        onDeleteTrack={handleDeleteTrack}
        onSelectQueueTrack={(t) => void playTrack(t)}
        onReorderQueue={handleReorderQueue}
        backHandlerRef={nowPlayingBackRef}
      />

      {/* Modals */}
      <PlaylistModal
        open={playlistModal.open}
        mode={playlistModal.mode}
        initialName={playlistModal.initialName}
        onClose={() => setPlaylistModal({ open: false, mode: 'create' })}
        onSubmit={handleCreateOrRenamePlaylist}
      />

      <AddToPlaylistModal
        track={addToPlaylistTrack}
        playlists={playlists}
        onClose={() => setAddToPlaylistTrack(null)}
        onSelectPlaylist={handleAddTrackToPlaylist}
      />

      <EditTagModal
        track={editTagTrack}
        onClose={() => setEditTagTrack(null)}
        onSave={handleSaveTrackTags}
      />

      <SongInfoModal
        track={songInfoTrack}
        onClose={() => setSongInfoTrack(null)}
        onEditTags={(t) => setEditTagTrack(t)}
      />

      <SleepTimerModal
        open={sleepTimerOpen}
        sleepTimer={sleepTimer}
        onClose={() => setSleepTimerOpen(false)}
        onSetTimer={(mode, customMinutes) => {
          if (mode === 'end_of_track') {
            setSleepTimer({ active: true, mode, remainingSec: 0 });
            showToast('Playback will stop after current track');
            return;
          }
          const mins =
            mode === '15m'
              ? 15
              : mode === '30m'
                ? 30
                : mode === '45m'
                  ? 45
                  : mode === '60m'
                    ? 60
                    : customMinutes ?? 20;
          setSleepTimer({ active: true, mode, remainingSec: mins * 60 });
          showToast(`Sleep timer set for ${mins} minutes`);
        }}
        onClearTimer={() => {
          setSleepTimer({ active: false, mode: null, remainingSec: 0 });
          showToast('Sleep timer turned off');
        }}
      />

      <UpdateModal
        state={updateState}
        onClose={() => setUpdateState({ status: 'idle' })}
        onDownload={handleStartDownload}
        onTriggerInstall={handleTriggerInstall}
      />

      <DeleteConfirmModal
        track={pendingDeleteTrack}
        onCancel={() => setPendingDeleteTrack(null)}
        onConfirmDelete={executeDeleteTrack}
      />

      {/* Full-Visibility Track 3-Dot Action Sheet */}
      {menuTrack && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMenuTrack(null)}
          />
          <div className="relative z-10 w-full max-w-md max-h-[86vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0A0B14]/92 backdrop-blur-2xl text-white border border-white/10 shadow-2xl p-4 pb-6 space-y-3">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto sm:hidden" />
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <CoverImage
                src={menuTrack.coverUrl}
                alt={menuTrack.album}
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-white/15"
                fallback={
                  <div className="w-12 h-12 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center shrink-0">
                    <Disc3 className="w-6 h-6 text-[var(--accent)]" />
                  </div>
                }
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{menuTrack.title}</p>
                <p className="text-xs text-white/65 truncate">
                  {menuTrack.artist} · {menuTrack.album} · {formatTime(menuTrack.durationSec)}
                </p>
              </div>
              <button
                onClick={() => setMenuTrack(null)}
                aria-label="Close options"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-white/80 hover:text-white hover:bg-white/10 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-sm font-medium">
              <button
                onClick={() => {
                  const target = menuTrack;
                  setMenuTrack(null);
                  toggleFavorite(target.id);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <Heart
                  className={`w-4 h-4 shrink-0 ${
                    menuTrack.isFavorite ? 'fill-current text-[var(--accent)]' : 'text-[var(--accent)]'
                  }`}
                />
                <span>{menuTrack.isFavorite ? 'Remove Favorite' : 'Add to Favorite'}</span>
              </button>
              <button
                onClick={() => {
                  const target = menuTrack;
                  setMenuTrack(null);
                  setAddToPlaylistTrack(target);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <ListPlus className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Add to Playlist</span>
              </button>
              <button
                onClick={() => {
                  const target = menuTrack;
                  setMenuTrack(null);
                  setActiveTab('albums');
                  setDrillFilter({ type: 'album', value: target.album, label: target.album });
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <Disc3 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Go to Album</span>
              </button>
              <button
                onClick={() => {
                  const target = menuTrack;
                  setMenuTrack(null);
                  setActiveTab('artists');
                  setDrillFilter({ type: 'artist', value: target.artist, label: target.artist });
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <User className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Go to Artist</span>
              </button>
              <button
                onClick={() => {
                  setMenuTrack(null);
                  setSleepTimerOpen(true);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <Moon className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Sleep Timer</span>
              </button>
              <button
                onClick={() => {
                  const target = menuTrack;
                  setMenuTrack(null);
                  void handleShareTrack(target);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <Share2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Share</span>
              </button>
              <button
                onClick={() => {
                  const target = menuTrack;
                  setMenuTrack(null);
                  setSongInfoTrack(target);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white transition-colors"
              >
                <FileAudio className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Song Info</span>
              </button>
              <div className="my-2 border-t border-white/10" />
              <button
                onClick={() => {
                  const target = menuTrack;
                  setMenuTrack(null);
                  setEditTagTrack(target);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white/85 transition-colors"
              >
                <Edit3 className="w-4 h-4 text-white/65 shrink-0" />
                <span>Edit Audio Tags</span>
              </button>
              <button
                onClick={() => {
                  const target = menuTrack;
                  setMenuTrack(null);
                  handleSetRingtone(target);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl flex items-center gap-3.5 hover:bg-white/[0.08] text-left text-white/85 transition-colors"
              >
                <BellRing className="w-4 h-4 text-white/65 shrink-0" />
                <span>Set as Ringtone</span>
              </button>
              <button
                onClick={() => {
                  const target = menuTrack;
                  setMenuTrack(null);
                  handleDeleteTrack(target);
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

      {/* Full-Visibility Playlist 3-Dot Action Sheet */}
      {menuPlaylist && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setMenuPlaylist(null)}
          />
          <div className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-[#071836]/95 backdrop-blur-xl text-white border border-white/15 shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/15">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{menuPlaylist.name}</p>
                <p className="text-xs text-white/70">
                  {menuPlaylist.trackIds.length} track{menuPlaylist.trackIds.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                onClick={() => setMenuPlaylist(null)}
                aria-label="Close playlist options"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-white hover:bg-white/10 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-sm font-medium">
              <button
                onClick={() => {
                  const target = menuPlaylist;
                  setMenuPlaylist(null);
                  handlePlayPlaylist(target);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 hover:bg-white/10 text-left text-white"
              >
                <Play className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Play Playlist</span>
              </button>
              <button
                onClick={() => {
                  const target = menuPlaylist;
                  setMenuPlaylist(null);
                  void handleSharePlaylist(target);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 hover:bg-white/10 text-left text-white"
              >
                <Share2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Share Playlist</span>
              </button>
              <button
                onClick={() => {
                  const target = menuPlaylist;
                  setMenuPlaylist(null);
                  setPlaylistModal({
                    open: true,
                    mode: 'rename',
                    playlistId: target.id,
                    initialName: target.name,
                  });
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 hover:bg-white/10 text-left text-white"
              >
                <Edit3 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span>Rename / Edit</span>
              </button>
              <div className="my-1.5 border-t border-white/15" />
              <button
                onClick={() => {
                  const target = menuPlaylist;
                  setMenuPlaylist(null);
                  handleDeletePlaylist(target);
                }}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 hover:bg-rose-500/15 text-rose-400 text-left"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Remove / Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#071836]/95 backdrop-blur-md text-white border border-[var(--accent)]/40 text-xs font-medium shadow-2xl pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
    </MotionConfig>
  );
}
