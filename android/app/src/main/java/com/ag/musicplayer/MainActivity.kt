package com.ag.musicplayer

import android.Manifest
import android.content.ComponentName
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.ag.musicplayer.audio.MusicPlaybackService
import com.ag.musicplayer.data.AppSettings
import com.ag.musicplayer.data.MediaScanner
import com.ag.musicplayer.data.Track
import com.ag.musicplayer.ui.AgMusicApp
import com.ag.musicplayer.updater.GitHubUpdateManager
import com.google.common.util.concurrent.MoreExecutors

class MainActivity : ComponentActivity() {

    private lateinit var updateManager: GitHubUpdateManager
    private lateinit var mediaScanner: MediaScanner
    private var tracksState by mutableStateOf<List<Track>>(emptyList())

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants.values.any { it }
        if (granted) {
            tracksState = mediaScanner.scanLocalAudio(AppSettings())
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        updateManager = GitHubUpdateManager(this)
        mediaScanner = MediaScanner(this)

        requestRuntimePermissions()

        val sessionToken = SessionToken(this, ComponentName(this, MusicPlaybackService::class.java))
        val controllerFuture = MediaController.Builder(this, sessionToken).buildAsync()

        setContent {
            var mediaController by remember { mutableStateOf<MediaController?>(null) }

            LaunchedEffect(Unit) {
                controllerFuture.addListener(
                    { mediaController = controllerFuture.get() },
                    MoreExecutors.directExecutor()
                )
                tracksState = mediaScanner.scanLocalAudio(AppSettings())
            }

            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFFD4AF37),
                    background = Color(0xFF0B0B0D),
                    surface = Color(0xFF141417),
                    onPrimary = Color(0xFF0B0B0D),
                    onBackground = Color(0xFFF5F3EE),
                    onSurface = Color(0xFFF5F3EE)
                )
            ) {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xFF0B0B0D))
                ) {
                    AgMusicApp(
                        tracks = tracksState,
                        mediaController = mediaController,
                        updateManager = updateManager,
                        mediaScanner = mediaScanner,
                        onRescan = { settings -> tracksState = mediaScanner.scanLocalAudio(settings) }
                    )
                }
            }
        }
    }

    private fun requestRuntimePermissions() {
        val perms = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.READ_MEDIA_AUDIO)
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            perms.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
        permissionLauncher.launch(perms.toTypedArray())
    }
}
