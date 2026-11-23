package com.ag.musicplayer.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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

    var selectedTab by remember { mutableIntStateOf(0) }
    var currentTrack by remember { mutableStateOf<Track?>(null) }
    var isPlaying by remember { mutableStateOf(false) }
    var showNowPlaying by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }

    val tabs = listOf("Tracks", "Albums", "Artists", "Folders", "Genres")

    val filteredTracks = remember(tracks, searchQuery) {
        if (searchQuery.isBlank()) tracks
        else tracks.filter {
            it.title.contains(searchQuery, ignoreCase = true) ||
                it.artist.contains(searchQuery, ignoreCase = true) ||
                it.album.contains(searchQuery, ignoreCase = true)
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
                    Text(
                        text = "AG Music Player",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFD4AF37)
                    )
                    Text(
                        text = "Offline-First Audio Studio",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF9E9A90)
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp), color = Color(0xFF27272C))
                    NavigationDrawerItem(
                        label = { Text("Rescan Music Library") },
                        selected = false,
                        onClick = {
                            onRescan(AppSettings())
                            scope.launch { drawerState.close() }
                        },
                        icon = { Icon(Icons.Default.Refresh, contentDescription = null) }
                    )
                    Spacer(modifier = Modifier.weight(1f))
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
                            Text("AG Music Player", fontWeight = FontWeight.Bold)
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
                                Text(track.title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(track.artist, style = MaterialTheme.typography.bodySmall, color = Color(0xFF9E9A90), maxLines = 1)
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
            Column(modifier = Modifier.padding(padding).fillMaxSize()) {
                ScrollableTabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color(0xFF0B0B0D),
                    contentColor = Color(0xFFD4AF37)
                ) {
                    tabs.forEachIndexed { index, title ->
                        Tab(
                            selected = selectedTab == index,
                            onClick = { selectedTab = index },
                            text = { Text(title) }
                        )
                    }
                }

                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(filteredTracks, key = { it.id }) { track ->
                        ListItem(
                            headlineContent = { Text(track.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                            supportingContent = { Text("${track.artist} · ${track.album}", maxLines = 1, overflow = TextOverflow.Ellipsis) },
                            trailingContent = {
                                IconButton(onClick = { mediaScanner.shareTrack(track) }) {
                                    Icon(Icons.Default.MoreVert, contentDescription = "Options")
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
                            colors = ListItemDefaults.colors(containerColor = Color(0xFF0B0B0D))
                        )
                    }
                }
            }
        }
    }

    if (showNowPlaying && currentTrack != null) {
        ModalBottomSheet(
            onDismissRequest = { showNowPlaying = false },
            containerColor = Color(0xFF141417)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = currentTrack!!.title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.basicMarquee()
                )
                Spacer(Modifier.height(6.dp))
                Text(currentTrack!!.artist, color = Color(0xFF9E9A90))
                Spacer(Modifier.height(24.dp))
                IconButton(
                    onClick = {
                        if (isPlaying) mediaController?.pause() else mediaController?.play()
                        isPlaying = !isPlaying
                    },
                    modifier = Modifier
                        .size(64.dp)
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
                Spacer(Modifier.height(24.dp))
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
                        Text("${state.progressPercent}% downloaded to System Downloads")
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
                        onClick = { updateManager.triggerApkInstall(state.apkFile) },
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
