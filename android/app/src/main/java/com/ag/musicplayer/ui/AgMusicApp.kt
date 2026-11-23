package com.ag.musicplayer.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.session.MediaController
import com.ag.musicplayer.BuildConfig
import com.ag.musicplayer.data.AppSettings
import com.ag.musicplayer.data.MediaScanner
import com.ag.musicplayer.data.Track
import com.ag.musicplayer.updater.GitHubUpdateManager
import com.ag.musicplayer.updater.UpdateState
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AgMusicApp(
    tracks: List<Track>,
    mediaController: MediaController?,
    updateManager: GitHubUpdateManager,
    mediaScanner: MediaScanner,
    onRescan: (AppSettings) -> Unit
) {
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val updateState by updateManager.state.collectAsState()

    var activeTab by remember { mutableStateOf("tracks") }
    var currentTrack by remember { mutableStateOf<Track?>(null) }
    var isPlaying by remember { mutableStateOf(false) }
    var showNowPlaying by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }
    var drawerSection by remember { mutableStateOf("menu") }

    // Filtering states
    var selectedFolder by remember { mutableStateOf<String?>(null) }
    var selectedAlbum by remember { mutableStateOf<String?>(null) }
    var selectedArtist by remember { mutableStateOf<String?>(null) }
    var selectedGenre by remember { mutableStateOf<String?>(null) }

    // Playback state extras
    var isShuffle by remember { mutableStateOf(false) }
    var repeatMode by remember { mutableStateOf("off") } // off, all, one
    var isFavorite by remember { mutableStateOf(false) }
    var positionSec by remember { mutableStateOf(0f) }
    var showQueueSheet by remember { mutableStateOf(false) }

    val audioTracks = remember(tracks, searchQuery) {
        tracks.filter { it.mediaType != "video" && (searchQuery.isBlank() || it.title.contains(searchQuery, true) || it.artist.contains(searchQuery, true)) }
    }
    val videos = remember(tracks, searchQuery) {
        tracks.filter { it.mediaType == "video" && (searchQuery.isBlank() || it.title.contains(searchQuery, true)) }
    }

    val albums = remember(tracks) {
        tracks.groupBy { it.album }.entries.map { entry ->
            Triple(entry.key, entry.value.firstOrNull()?.artist ?: "Unknown", entry.value.size)
        }
    }
    val artists = remember(tracks) {
        tracks.groupBy { it.artist }.entries.map { entry ->
            Pair(entry.key, entry.value.size)
        }
    }
    val genres = remember(tracks) {
        tracks.groupBy { it.genre }.entries.map { entry ->
            Pair(entry.key, entry.value.size)
        }
    }
    val folders = remember(tracks) {
        tracks.groupBy { it.folder }.entries.map { entry ->
            Pair(entry.key, entry.value.size)
        }
    }

    // Filtered track list for the active view
    val displayedTracks = remember(audioTracks, activeTab, selectedFolder, selectedAlbum, selectedArtist, selectedGenre) {
        when (activeTab) {
            "tracks" -> audioTracks
            "folders" -> if (selectedFolder != null) audioTracks.filter { it.folder == selectedFolder } else emptyList()
            "albums" -> if (selectedAlbum != null) audioTracks.filter { it.album == selectedAlbum } else emptyList()
            "artists" -> if (selectedArtist != null) audioTracks.filter { it.artist == selectedArtist } else emptyList()
            "genres" -> if (selectedGenre != null) audioTracks.filter { it.genre == selectedGenre } else emptyList()
            else -> audioTracks
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color(0xFF141417),
                drawerContentColor = Color(0xFFF5F3EE)
            ) {
                Column(modifier = Modifier.fillMaxHeight().padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "AG Music Player",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFD4AF37)
                            )
                            Text(
                                text = "Music Player · V-${BuildConfig.VERSION_NAME}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF9E9A90)
                            )
                        }
                        IconButton(onClick = { scope.launch { drawerState.close() } }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFFF5F3EE))
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp), color = Color(0xFF27272C))

                    if (drawerSection != "menu") {
                        TextButton(
                            onClick = { drawerSection = "menu" },
                            modifier = Modifier.padding(bottom = 8.dp)
                        ) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = null, tint = Color(0xFFD4AF37))
                            Spacer(Modifier.width(4.dp))
                            Text("Back to Menu", color = Color(0xFFD4AF37))
                        }
                    }

                    if (drawerSection == "menu") {
                        Column(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            NavigationDrawerItem(
                                label = { Text("Theme Settings") },
                                selected = false,
                                onClick = { drawerSection = "theme" },
                                icon = { Icon(Icons.Default.Palette, contentDescription = null, tint = Color(0xFFD4AF37)) }
                            )
                            NavigationDrawerItem(
                                label = { Text("5-Band Equalizer") },
                                selected = false,
                                onClick = { drawerSection = "equalizer" },
                                icon = { Icon(Icons.Default.Tune, contentDescription = null, tint = Color(0xFFD4AF37)) }
                            )
                            NavigationDrawerItem(
                                label = { Text("Home Screen Widgets") },
                                selected = false,
                                onClick = { drawerSection = "widget" },
                                icon = { Icon(Icons.Default.GridOn, contentDescription = null, tint = Color(0xFFD4AF37)) }
                            )
                            NavigationDrawerItem(
                                label = { Text("Audio Settings") },
                                selected = false,
                                onClick = { drawerSection = "settings" },
                                icon = { Icon(Icons.Default.Settings, contentDescription = null, tint = Color(0xFFD4AF37)) }
                            )
                        }
                    } else if (drawerSection == "theme") {
                        Column(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Appearance", fontWeight = FontWeight.Bold, color = Color(0xFFD4AF37))
                            Text("Dark Obsidian & Metallic Gold Theme Active", color = Color(0xFF9E9A90))
                        }
                    } else if (drawerSection == "equalizer") {
                        Column(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Equalizer Presets", fontWeight = FontWeight.Bold, color = Color(0xFFD4AF37))
                            Text("Normal, Bass Boost, Rock, Pop, Classical (DSP Active)", color = Color(0xFF9E9A90))
                        }
                    } else if (drawerSection == "widget") {
                        Column(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Widgets Preview", fontWeight = FontWeight.Bold, color = Color(0xFFD4AF37))
                            Text("4x1 Compact and 4x2 Card Player Widgets available on Android Launcher.", color = Color(0xFF9E9A90), style = MaterialTheme.typography.bodySmall)
                        }
                    } else {
                        Column(modifier = Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Audio Settings", fontWeight = FontWeight.Bold, color = Color(0xFFD4AF37))
                            Text("Gapless playback, Crossfade, Auto-Sync enabled.", color = Color(0xFF9E9A90), style = MaterialTheme.typography.bodySmall)
                        }
                    }

                    HorizontalDivider(color = Color(0xFF27272C))
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = { scope.launch { updateManager.checkForUpdates() } },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4AF37), contentColor = Color(0xFF0B0B0D))
                    ) {
                        Icon(Icons.Default.SystemUpdate, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Check Update (V-${BuildConfig.VERSION_NAME})", fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        if (isSearching) {
                            OutlinedTextField(
                                value = searchQuery,
                                onValueChange = { searchQuery = it },
                                placeholder = { Text("Search tracks, albums, artists...") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                        } else {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("AG Music Player", fontWeight = FontWeight.Bold)
                            }
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu")
                        }
                    },
                    actions = {
                        IconButton(onClick = { isSearching = !isSearching; if (!isSearching) searchQuery = "" }) {
                            Icon(if (isSearching) Icons.Default.Close else Icons.Default.Search, contentDescription = "Search")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color(0xFF0B0B0D),
                        titleContentColor = Color(0xFFF5F3EE),
                        navigationIconContentColor = Color(0xFFF5F3EE),
                        actionIconContentColor = Color(0xFFF5F3EE)
                    )
                )
            },
            bottomBar = {
                currentTrack?.let { track ->
                    Surface(
                        color = Color(0xFF141417),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showNowPlaying = true }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(track.title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFFF5F3EE))
                                Text("${track.artist} · ${track.album}", style = MaterialTheme.typography.bodySmall, color = Color(0xFF9E9A90), maxLines = 1)
                            }
                            IconButton(
                                onClick = {
                                    if (isPlaying) mediaController?.pause() else mediaController?.play()
                                    isPlaying = !isPlaying
                                },
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFFD4AF37))
                            ) {
                                Icon(
                                    if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                    contentDescription = "Play/Pause",
                                    tint = Color(0xFF0B0B0D)
                                )
                            }
                        }
                    }
                }
            },
            containerColor = Color(0xFF0B0B0D)
        ) { padding ->
            Column(modifier = Modifier.padding(padding).fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                // 2 Rows x 3 Columns Category Grid
                val categories = listOf(
                    Triple("tracks", "Tracks", audioTracks.size),
                    Triple("albums", "Albums", albums.size),
                    Triple("artists", "Artists", artists.size),
                    Triple("genres", "Genres", genres.size),
                    Triple("videos", "Videos", videos.size),
                    Triple("folders", "Folders", folders.size)
                )

                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.height(200.dp)
                ) {
                    items(categories) { cat ->
                        val selected = activeTab == cat.first
                        Surface(
                            onClick = {
                                activeTab = cat.first
                                if (cat.first == "folders") selectedFolder = null
                                if (cat.first == "albums") selectedAlbum = null
                                if (cat.first == "artists") selectedArtist = null
                                if (cat.first == "genres") selectedGenre = null
                            },
                            color = if (selected) Color(0xFF2A2410) else Color(0xFF141417),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, if (selected) Color(0xFFD4AF37) else Color(0xFF27272C)),
                            modifier = Modifier.height(90.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp).fillMaxSize(),
                                verticalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(cat.third.toString(), style = MaterialTheme.typography.bodySmall, color = Color(0xFFD4AF37), fontWeight = FontWeight.Bold)
                                Text(cat.second, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = Color(0xFFF5F3EE))
                            }
                        }
                    }
                }

                HorizontalDivider(color = Color(0xFF27272C))

                // Breadcrumb header if inside a subfolder/album/artist/genre
                if (activeTab == "folders" && selectedFolder != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextButton(onClick = { selectedFolder = null }) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = null, tint = Color(0xFFD4AF37))
                            Spacer(Modifier.width(4.dp))
                            Text("Back to Folders", color = Color(0xFFD4AF37), fontWeight = FontWeight.Bold)
                        }
                        Text("• $selectedFolder", style = MaterialTheme.typography.bodyMedium, color = Color(0xFF9E9A90), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                } else if (activeTab == "albums" && selectedAlbum != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextButton(onClick = { selectedAlbum = null }) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = null, tint = Color(0xFFD4AF37))
                            Spacer(Modifier.width(4.dp))
                            Text("Back to Albums", color = Color(0xFFD4AF37), fontWeight = FontWeight.Bold)
                        }
                        Text("• $selectedAlbum", style = MaterialTheme.typography.bodyMedium, color = Color(0xFF9E9A90), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                } else if (activeTab == "artists" && selectedArtist != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextButton(onClick = { selectedArtist = null }) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = null, tint = Color(0xFFD4AF37))
                            Spacer(Modifier.width(4.dp))
                            Text("Back to Artists", color = Color(0xFFD4AF37), fontWeight = FontWeight.Bold)
                        }
                        Text("• $selectedArtist", style = MaterialTheme.typography.bodyMedium, color = Color(0xFF9E9A90), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                } else if (activeTab == "genres" && selectedGenre != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextButton(onClick = { selectedGenre = null }) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = null, tint = Color(0xFFD4AF37))
                            Spacer(Modifier.width(4.dp))
                            Text("Back to Genres", color = Color(0xFFD4AF37), fontWeight = FontWeight.Bold)
                        }
                        Text("• $selectedGenre", style = MaterialTheme.typography.bodyMedium, color = Color(0xFF9E9A90), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }

                // List content based on activeTab and selection
                LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (activeTab == "tracks") {
                        items(audioTracks, key = { it.id }) { track ->
                            ListItem(
                                headlineContent = { Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFFF5F3EE)) },
                                supportingContent = { Text("${track.artist} · ${track.album}", maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFF9E9A90)) },
                                trailingContent = {
                                    IconButton(onClick = { mediaScanner.shareTrack(track) }) {
                                        Icon(Icons.Default.MoreVert, contentDescription = "Options", tint = Color(0xFF9E9A90))
                                    }
                                },
                                modifier = Modifier.clickable {
                                    currentTrack = track
                                    isPlaying = true
                                    val item = MediaItem.Builder()
                                        .setUri(track.contentUri)
                                        .setMediaMetadata(
                                            MediaMetadata.Builder()
                                                .setTitle(track.title)
                                                .setArtist(track.artist)
                                                .setAlbumTitle(track.album)
                                                .build()
                                        )
                                        .build()
                                    mediaController?.setMediaItem(item)
                                    mediaController?.prepare()
                                    mediaController?.play()
                                },
                                colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                            )
                        }
                    } else if (activeTab == "folders") {
                        if (selectedFolder == null) {
                            items(folders) { folder ->
                                ListItem(
                                    headlineContent = { Text(folder.first, fontWeight = FontWeight.Bold, color = Color(0xFFF5F3EE)) },
                                    supportingContent = { Text("${folder.second} audio files", color = Color(0xFF9E9A90)) },
                                    leadingContent = { Icon(Icons.Default.Folder, contentDescription = null, tint = Color(0xFFD4AF37)) },
                                    trailingContent = { Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color(0xFF9E9A90)) },
                                    modifier = Modifier.clickable { selectedFolder = folder.first },
                                    colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                                )
                            }
                        } else {
                            val folderTracks = audioTracks.filter { it.folder == selectedFolder }
                            items(folderTracks, key = { it.id }) { track ->
                                ListItem(
                                    headlineContent = { Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFFF5F3EE)) },
                                    supportingContent = { Text("${track.artist} · ${track.album}", maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFF9E9A90)) },
                                    modifier = Modifier.clickable {
                                        currentTrack = track
                                        isPlaying = true
                                        val item = MediaItem.Builder()
                                            .setUri(track.contentUri)
                                            .setMediaMetadata(
                                                MediaMetadata.Builder()
                                                    .setTitle(track.title)
                                                    .setArtist(track.artist)
                                                    .setAlbumTitle(track.album)
                                                    .build()
                                            )
                                            .build()
                                        mediaController?.setMediaItem(item)
                                        mediaController?.prepare()
                                        mediaController?.play()
                                    },
                                    colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                                )
                            }
                        }
                    } else if (activeTab == "albums") {
                        if (selectedAlbum == null) {
                            items(albums) { alb ->
                                ListItem(
                                    headlineContent = { Text(alb.first, fontWeight = FontWeight.Bold, color = Color(0xFFF5F3EE)) },
                                    supportingContent = { Text("Artist: ${alb.second} · ${alb.third} tracks", color = Color(0xFF9E9A90)) },
                                    leadingContent = { Icon(Icons.Default.Album, contentDescription = null, tint = Color(0xFFD4AF37)) },
                                    trailingContent = { Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color(0xFF9E9A90)) },
                                    modifier = Modifier.clickable { selectedAlbum = alb.first },
                                    colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                                )
                            }
                        } else {
                            val albumTracks = audioTracks.filter { it.album == selectedAlbum }
                            items(albumTracks, key = { it.id }) { track ->
                                ListItem(
                                    headlineContent = { Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFFF5F3EE)) },
                                    supportingContent = { Text("${track.artist}", maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFF9E9A90)) },
                                    modifier = Modifier.clickable {
                                        currentTrack = track
                                        isPlaying = true
                                        val item = MediaItem.Builder().setUri(track.contentUri).build()
                                        mediaController?.setMediaItem(item)
                                        mediaController?.prepare()
                                        mediaController?.play()
                                    },
                                    colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                                )
                            }
                        }
                    } else if (activeTab == "artists") {
                        if (selectedArtist == null) {
                            items(artists) { art ->
                                ListItem(
                                    headlineContent = { Text(art.first, fontWeight = FontWeight.Bold, color = Color(0xFFF5F3EE)) },
                                    supportingContent = { Text("${art.second} tracks", color = Color(0xFF9E9A90)) },
                                    leadingContent = { Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFFD4AF37)) },
                                    trailingContent = { Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color(0xFF9E9A90)) },
                                    modifier = Modifier.clickable { selectedArtist = art.first },
                                    colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                                )
                            }
                        } else {
                            val artistTracks = audioTracks.filter { it.artist == selectedArtist }
                            items(artistTracks, key = { it.id }) { track ->
                                ListItem(
                                    headlineContent = { Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFFF5F3EE)) },
                                    supportingContent = { Text("${track.album}", maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFF9E9A90)) },
                                    modifier = Modifier.clickable {
                                        currentTrack = track
                                        isPlaying = true
                                        val item = MediaItem.Builder().setUri(track.contentUri).build()
                                        mediaController?.setMediaItem(item)
                                        mediaController?.prepare()
                                        mediaController?.play()
                                    },
                                    colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                                )
                            }
                        }
                    } else if (activeTab == "genres") {
                        if (selectedGenre == null) {
                            items(genres) { gen ->
                                ListItem(
                                    headlineContent = { Text(gen.first, fontWeight = FontWeight.Bold, color = Color(0xFFF5F3EE)) },
                                    supportingContent = { Text("${gen.second} tracks", color = Color(0xFF9E9A90)) },
                                    leadingContent = { Icon(Icons.Default.Category, contentDescription = null, tint = Color(0xFFD4AF37)) },
                                    trailingContent = { Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color(0xFF9E9A90)) },
                                    modifier = Modifier.clickable { selectedGenre = gen.first },
                                    colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                                )
                            }
                        } else {
                            val genreTracks = audioTracks.filter { it.genre == selectedGenre }
                            items(genreTracks, key = { it.id }) { track ->
                                ListItem(
                                    headlineContent = { Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFFF5F3EE)) },
                                    supportingContent = { Text("${track.artist} · ${track.album}", maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color(0xFF9E9A90)) },
                                    modifier = Modifier.clickable {
                                        currentTrack = track
                                        isPlaying = true
                                        val item = MediaItem.Builder().setUri(track.contentUri).build()
                                        mediaController?.setMediaItem(item)
                                        mediaController?.prepare()
                                        mediaController?.play()
                                    },
                                    colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                                )
                            }
                        }
                    } else if (activeTab == "videos") {
                        items(videos, key = { it.id }) { vid ->
                            ListItem(
                                headlineContent = { Text(vid.title, maxLines = 1, color = Color(0xFFF5F3EE)) },
                                supportingContent = { Text("Music Video · ${vid.artist}", color = Color(0xFF9E9A90)) },
                                trailingContent = { Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Color(0xFFD4AF37)) },
                                modifier = Modifier.clickable {
                                    currentTrack = vid
                                    isPlaying = true
                                    val item = MediaItem.Builder().setUri(vid.contentUri).build()
                                    mediaController?.setMediaItem(item)
                                    mediaController?.prepare()
                                    mediaController?.play()
                                },
                                colors = ListItemDefaults.colors(containerColor = Color(0xFF141417))
                            )
                        }
                    }
                }
            }
        }
    }

    // Gorgeous Now Playing Bottom Sheet matching Web Preview
    if (showNowPlaying && currentTrack != null) {
        ModalBottomSheet(
            onDismissRequest = { showNowPlaying = false },
            containerColor = Color(0xFF141417)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Top Header inside sheet
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { showNowPlaying = false }) {
                        Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Minimize", tint = Color(0xFFF5F3EE))
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                        Text(
                            text = currentTrack!!.title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = Color(0xFFF5F3EE)
                        )
                        Text(
                            text = "${currentTrack!!.artist} · ${currentTrack!!.album}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF9E9A90),
                            maxLines = 1
                        )
                    }
                    IconButton(onClick = { showQueueSheet = true }) {
                        Icon(Icons.Default.QueueMusic, contentDescription = "Queue", tint = Color(0xFFD4AF37))
                    }
                }

                // Vinyl artwork stage
                Box(
                    modifier = Modifier
                        .size(220.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF0B0B0D))
                        .border(2.dp, Color(0xFFD4AF37).copy(alpha = 0.5f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.DiscFull,
                        contentDescription = null,
                        modifier = Modifier.size(120.dp),
                        tint = Color(0xFFD4AF37)
                    )
                }

                // 1st Row: Favorite, Sleep Timer, Options
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = { isFavorite = !isFavorite }) {
                        Icon(
                            if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = null,
                            tint = Color(0xFFD4AF37)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text("Favorite", color = Color(0xFFF5F3EE))
                    }
                    TextButton(onClick = { /* Sleep timer toggle */ }) {
                        Icon(Icons.Default.Bedtime, contentDescription = null, tint = Color(0xFFD4AF37))
                        Spacer(Modifier.width(4.dp))
                        Text("Sleep Timer", color = Color(0xFFF5F3EE))
                    }
                    IconButton(onClick = { mediaScanner.shareTrack(currentTrack!!) }) {
                        Icon(Icons.Default.Share, contentDescription = "Share", tint = Color(0xFF9E9A90))
                    }
                }

                // 2nd Row: Duration Seek Bar
                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Slider(
                        value = positionSec,
                        onValueChange = { positionSec = it },
                        valueRange = 0f..(if (currentTrack!!.durationMs > 0) (currentTrack!!.durationMs / 1000f) else 100f),
                        colors = SliderDefaults.colors(
                            thumbColor = Color(0xFFD4AF37),
                            activeTrackColor = Color(0xFFD4AF37),
                            inactiveTrackColor = Color(0xFF27272C)
                        )
                    )
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${positionSec.toInt()}s", style = MaterialTheme.typography.bodySmall, color = Color(0xFF9E9A90))
                        Text("${(currentTrack!!.durationMs / 1000f).toInt()}s", style = MaterialTheme.typography.bodySmall, color = Color(0xFF9E9A90))
                    }
                }

                // 3rd Row: Shuffle, Prev, Play/Pause, Next, Repeat
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { isShuffle = !isShuffle }) {
                        Icon(
                            Icons.Default.Shuffle,
                            contentDescription = "Shuffle",
                            tint = if (isShuffle) Color(0xFFD4AF37) else Color(0xFF9E9A90)
                        )
                    }

                    IconButton(onClick = {
                        val currIdx = audioTracks.indexOfFirst { it.id == currentTrack?.id }
                        if (currIdx > 0) {
                            currentTrack = audioTracks[currIdx - 1]
                            mediaController?.setMediaItem(MediaItem.fromUri(currentTrack!!.contentUri))
                            mediaController?.prepare()
                            mediaController?.play()
                        }
                    }) {
                        Icon(Icons.Default.SkipPrevious, contentDescription = "Previous", tint = Color(0xFFF5F3EE))
                    }

                    // Prominent Highlighted Play/Pause Button
                    IconButton(
                        onClick = {
                            if (isPlaying) mediaController?.pause() else mediaController?.play()
                            isPlaying = !isPlaying
                        },
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(Color(0xFFD4AF37))
                    ) {
                        Icon(
                            if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = "Play/Pause",
                            tint = Color(0xFF0B0B0D),
                            modifier = Modifier.size(36.dp)
                        )
                    }

                    IconButton(onClick = {
                        val currIdx = audioTracks.indexOfFirst { it.id == currentTrack?.id }
                        if (currIdx >= 0 && currIdx < audioTracks.size - 1) {
                            currentTrack = audioTracks[currIdx + 1]
                            mediaController?.setMediaItem(MediaItem.fromUri(currentTrack!!.contentUri))
                            mediaController?.prepare()
                            mediaController?.play()
                        }
                    }) {
                        Icon(Icons.Default.SkipNext, contentDescription = "Next", tint = Color(0xFFF5F3EE))
                    }

                    IconButton(onClick = {
                        repeatMode = when (repeatMode) {
                            "off" -> "all"
                            "all" -> "one"
                            else -> "off"
                        }
                    }) {
                        Icon(
                            Icons.Default.Repeat,
                            contentDescription = "Repeat",
                            tint = if (repeatMode != "off") Color(0xFFD4AF37) else Color(0xFF9E9A90)
                        )
                    }
                }
            }
        }
    }

    // Queue Sheet Modal
    if (showQueueSheet && currentTrack != null) {
        ModalBottomSheet(
            onDismissRequest = { showQueueSheet = false },
            containerColor = Color(0xFF141417)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(24.dp).heightIn(max = 400.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Up Next Queue (${audioTracks.size} tracks)", fontWeight = FontWeight.Bold, color = Color(0xFFD4AF37))
                    IconButton(onClick = { showQueueSheet = false }) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFFF5F3EE))
                    }
                }
                HorizontalDivider(color = Color(0xFF27272C))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(audioTracks, key = { it.id }) { t ->
                        val isCurrent = t.id == currentTrack?.id
                        ListItem(
                            headlineContent = { Text(t.title, color = if (isCurrent) Color(0xFFD4AF37) else Color(0xFFF5F3EE), fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal) },
                            supportingContent = { Text(t.artist, color = Color(0xFF9E9A90)) },
                            modifier = Modifier.clickable {
                                currentTrack = t
                                isPlaying = true
                                mediaController?.setMediaItem(MediaItem.fromUri(t.contentUri))
                                mediaController?.prepare()
                                mediaController?.play()
                            },
                            colors = ListItemDefaults.colors(containerColor = Color(0xFF1C1C21))
                        )
                    }
                }
            }
        }
    }

    // GitHub In-App Auto-Updater Modal
    when (val state = updateState) {
        is UpdateState.Checking -> {
            AlertDialog(
                onDismissRequest = {},
                title = { Text("Checking GitHub Releases...") },
                text = { LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Color(0xFFD4AF37)) },
                confirmButton = {}
            )
        }
        is UpdateState.UpToDate -> {
            AlertDialog(
                onDismissRequest = { updateManager.dismiss() },
                title = { Text("You are on the latest version") },
                text = { Text("Installed version ${state.currentVersion} matches the latest release on Abujar287/ag-music-player.") },
                confirmButton = {
                    TextButton(onClick = { updateManager.dismiss() }) { Text("OK") }
                }
            )
        }
        is UpdateState.UpdateAvailable -> {
            AlertDialog(
                onDismissRequest = { updateManager.dismiss() },
                title = { Text("Update Available: ${state.release.tagName}") },
                text = {
                    Column {
                        Text(state.release.releaseNotes, style = MaterialTheme.typography.bodySmall)
                        Spacer(Modifier.height(8.dp))
                        Text("Asset: ${state.release.apkAssetName}", color = Color(0xFFD4AF37))
                    }
                },
                confirmButton = {
                    Button(
                        onClick = { scope.launch { updateManager.downloadAndInstall(state.release) } },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4AF37), contentColor = Color(0xFF0B0B0D))
                    ) { Text("Update Now") }
                },
                dismissButton = {
                    TextButton(onClick = { updateManager.dismiss() }) { Text("Later") }
                }
            )
        }
        is UpdateState.Downloading -> {
            AlertDialog(
                onDismissRequest = {},
                title = { Text("Downloading ${state.release.tagName}...") },
                text = {
                    Column {
                        LinearProgressIndicator(
                            progress = { state.progressPercent / 100f },
                            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
                            color = Color(0xFFD4AF37)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("${state.progressPercent}% downloaded to 0/Download via DownloadManager", color = Color(0xFF9E9A90))
                    }
                },
                confirmButton = {}
            )
        }
        is UpdateState.ReadyToInstall -> {
            AlertDialog(
                onDismissRequest = { updateManager.dismiss() },
                title = { Text("Download Complete (100%)") },
                text = { Text("Tap Install / Update to replace the installed app while preserving your playlists and settings.") },
                confirmButton = {
                    Button(
                        onClick = { updateManager.triggerApkInstall(state.apkFile, state.apkUri) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4AF37), contentColor = Color(0xFF0B0B0D))
                    ) { Text("Install / Update") }
                }
            )
        }
        is UpdateState.Error -> {
            AlertDialog(
                onDismissRequest = { updateManager.dismiss() },
                title = { Text("Update Check Failed") },
                text = { Text(state.message) },
                confirmButton = {
                    TextButton(onClick = { updateManager.dismiss() }) { Text("Close") }
                }
            )
        }
        UpdateState.Idle -> Unit
    }
}
