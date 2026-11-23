package com.ag.musicplayer

import android.Manifest
import android.app.Activity
import android.app.RecoverableSecurityException
import android.content.ComponentName
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.util.Log
import android.util.Size
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionToken
import com.ag.musicplayer.audio.MusicPlaybackService
import com.ag.musicplayer.data.AppSettings
import com.ag.musicplayer.data.MediaScanner
import com.ag.musicplayer.data.Track
import com.ag.musicplayer.updater.GitHubUpdateManager
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var updateManager: GitHubUpdateManager
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var mediaController: MediaController? = null
    private var progressJob: Job? = null
    private var pendingPlayAction: (() -> Unit)? = null
    private var currentPlayingUri: Uri? = null
    private var isPageReady = false
    @Volatile
    private var hasScannedThisSession = false

    private var pendingDeleteTrackId: String? = null
    private var pendingDeleteUri: Uri? = null
    private var pendingDeleteFilePath: String? = null
    private var pendingDeleteIsCreateRequest: Boolean = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        if (hasAudioPermission()) {
            scanLocalAudioAndNotify(isManual = false)
        }
    }

    private val deleteLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        val trackId = pendingDeleteTrackId
        val uri = pendingDeleteUri
        val filePath = pendingDeleteFilePath
        val isCreateRequest = pendingDeleteIsCreateRequest
        pendingDeleteTrackId = null
        pendingDeleteUri = null
        pendingDeleteFilePath = null
        pendingDeleteIsCreateRequest = false

        if (trackId == null) return@registerForActivityResult

        if (result.resultCode == Activity.RESULT_OK) {
            lifecycleScope.launch(Dispatchers.IO) {
                var deleted = isCreateRequest
                if (!isCreateRequest && uri != null) {
                    try {
                        deleted = contentResolver.delete(uri, null, null) > 0
                    } catch (_: Exception) {
                        deleted = false
                    }
                }
                if (!deleted && !filePath.isNullOrBlank()) {
                    try {
                        val file = File(filePath)
                        if (file.exists()) {
                            deleted = file.delete()
                        }
                    } catch (_: Exception) {}
                }
                withContext(Dispatchers.Main) {
                    if (deleted) {
                        if (uri != null && currentPlayingUri == uri) {
                            mediaController?.stop()
                            mediaController?.clearMediaItems()
                            currentPlayingUri = null
                        }
                        notifyTrackDeleted(trackId, true, null)
                    } else {
                        notifyTrackDeleted(trackId, false, "Could not delete audio file from storage")
                    }
                }
            }
        } else {
            notifyTrackDeleted(trackId, false, "Delete permission cancelled")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        updateManager = GitHubUpdateManager(this)

        initMediaController()

        if (!hasAudioPermission()) {
            requestRuntimePermissions()
        }

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                allowFileAccessFromFileURLs = true
                allowUniversalAccessFromFileURLs = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                setSupportZoom(false)
            }
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    isPageReady = true
                    if (hasAudioPermission() && !hasScannedThisSession) {
                        scanLocalAudioAndNotify(isManual = false)
                    }
                }

                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    val url = request?.url?.toString() ?: return super.shouldInterceptRequest(view, request)
                    if (url.startsWith("https://ag-media.local/albumart/")) {
                        return serveAlbumArt(url)
                    }
                    return super.shouldInterceptRequest(view, request)
                }

                override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                    if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            context.startActivity(intent)
                        } catch (_: Exception) {}
                        return true
                    }
                    return false
                }

                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    super.onReceivedError(view, request, error)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request?.isForMainFrame == true) {
                        Log.e("WebViewError", "Failed to load URL: ${request.url} Error: ${error?.description}")
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                    consoleMessage?.let {
                        Log.d("WebViewConsole", "${it.message()} -- Line ${it.lineNumber()} of ${it.sourceId()}")
                    }
                    return true
                }
            }
            addJavascriptInterface(WebAppInterface(this@MainActivity, updateManager), "AndroidBridge")
            loadUrl("file:///android_asset/index.html")
        }

        setContentView(webView)
    }

    override fun onResume() {
        super.onResume()
        if (isPageReady && hasAudioPermission() && !hasScannedThisSession) {
            scanLocalAudioAndNotify(isManual = false)
        }
    }

    private fun initMediaController() {
        val sessionToken = SessionToken(this, ComponentName(this, MusicPlaybackService::class.java))
        val future = MediaController.Builder(this, sessionToken).buildAsync()
        controllerFuture = future
        future.addListener({
            try {
                val controller = future.get()
                mediaController = controller
                controller.addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        val posSec = controller.currentPosition / 1000.0
                        evalJs("window.__agNativeCallbacks?.onStateChange?.($isPlaying, $posSec);")
                        if (isPlaying) {
                            startProgressPolling()
                        } else {
                            progressJob?.cancel()
                        }
                    }

                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_ENDED) {
                            progressJob?.cancel()
                            evalJs("window.__agNativeCallbacks?.onEnded?.();")
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        Log.e("AGPlayer", "ExoPlayer error: ${error.message}", error)
                        val msg = JSONObject.quote(error.message ?: "Audio playback error")
                        evalJs("window.__agNativeCallbacks?.onError?.($msg);")
                    }
                })
                pendingPlayAction?.invoke()
                pendingPlayAction = null
            } catch (e: Exception) {
                Log.e("AGPlayer", "Failed to connect MediaController", e)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun startProgressPolling() {
        progressJob?.cancel()
        progressJob = lifecycleScope.launch {
            while (isActive) {
                val controller = mediaController
                if (controller != null && controller.isPlaying) {
                    val posSec = controller.currentPosition / 1000.0
                    evalJs("window.__agNativeCallbacks?.onProgress?.($posSec);")
                }
                delay(250L)
            }
        }
    }

    private fun evalJs(script: String) {
        if (!::webView.isInitialized) return
        webView.post {
            webView.evaluateJavascript(script, null)
        }
    }

    fun hasAudioPermission(): Boolean {
        val perm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_AUDIO
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }
        return ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED
    }

    fun requestRuntimePermissions() {
        val perms = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.READ_MEDIA_AUDIO)
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            perms.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }
        permissionLauncher.launch(perms.toTypedArray())
    }

    fun scanLocalAudioAndNotify(isManual: Boolean) {
        if (!hasAudioPermission()) return
        hasScannedThisSession = true
        lifecycleScope.launch(Dispatchers.IO) {
            val jsonStr = buildTracksJson()
            withContext(Dispatchers.Main) {
                evalJs("window.__agOnDeviceTracks?.($jsonStr, $isManual);")
            }
        }
    }

    fun buildTracksJson(): String {
        if (!hasAudioPermission()) return "[]"
        val scanner = MediaScanner(this)
        val tracks: List<Track> = scanner.scanLocalAudio(AppSettings(filterShortClips = false))
        val jsonArray = JSONArray()
        for (i in 0 until tracks.size) {
            val track = tracks[i]
            val albumId = track.albumArtUri?.lastPathSegment ?: ""
            val webCoverUrl = if (albumId.isNotEmpty()) {
                "https://ag-media.local/albumart/${track.id}/$albumId"
            } else {
                ""
            }
            val obj = JSONObject().apply {
                put("id", "device-${track.id}")
                put("title", track.title)
                put("artist", track.artist)
                put("album", track.album)
                put("genre", track.genre)
                put("folderPath", track.folderPath)
                put("folder", track.folder)
                put("filePath", track.filePath)
                put("contentUri", track.contentUri.toString())
                put("nativeArtUri", track.albumArtUri?.toString() ?: "")
                put("coverUrl", webCoverUrl)
                put("durationSec", track.durationMs / 1000)
                put("sizeKb", track.sizeBytes / 1024)
                put("mediaType", "audio")
                put("isLocalImport", true)
            }
            jsonArray.put(obj)
        }
        return jsonArray.toString()
    }

    private fun serveAlbumArt(url: String): WebResourceResponse {
        val empty404 = {
            WebResourceResponse(
                "text/plain",
                "utf-8",
                404,
                "Not Found",
                emptyMap(),
                ByteArrayInputStream(ByteArray(0))
            )
        }
        try {
            val segments = Uri.parse(url).pathSegments
            val trackId = segments.getOrNull(1)?.toLongOrNull()
            val albumId = segments.getOrNull(2)?.toLongOrNull()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && trackId != null) {
                try {
                    val contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, trackId)
                    val bitmap = contentResolver.loadThumbnail(contentUri, Size(512, 512), null)
                    val out = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
                    bitmap.recycle()
                    return WebResourceResponse("image/jpeg", "binary", ByteArrayInputStream(out.toByteArray()))
                } catch (_: Exception) {}
            }

            if (albumId != null) {
                val artUri = ContentUris.withAppendedId(
                    Uri.parse("content://media/external/audio/albumart"),
                    albumId
                )
                contentResolver.openInputStream(artUri)?.use { stream ->
                    val bytes = stream.readBytes()
                    return WebResourceResponse("image/jpeg", "binary", ByteArrayInputStream(bytes))
                }
            }
        } catch (_: Exception) {}
        return empty404()
    }

    fun playNativeTrack(
        uriStr: String,
        title: String,
        artist: String,
        album: String,
        artUriStr: String,
        startSec: Double
    ) {
        val action = {
            val controller = mediaController
            if (controller != null) {
                val mediaUri = if (uriStr.startsWith("/")) {
                    Uri.fromFile(File(uriStr))
                } else {
                    Uri.parse(uriStr)
                }
                currentPlayingUri = mediaUri
                val metaBuilder = MediaMetadata.Builder()
                    .setTitle(title)
                    .setArtist(artist)
                    .setAlbumTitle(album)
                if (artUriStr.isNotBlank() && artUriStr.startsWith("content://")) {
                    metaBuilder.setArtworkUri(Uri.parse(artUriStr))
                }
                val item = MediaItem.Builder()
                    .setUri(mediaUri)
                    .setMediaMetadata(metaBuilder.build())
                    .build()
                controller.setMediaItem(item)
                controller.prepare()
                if (startSec > 0.0) {
                    controller.seekTo((startSec * 1000.0).toLong())
                }
                controller.play()
            }
        }

        runOnUiThread {
            if (mediaController != null) {
                action()
            } else {
                pendingPlayAction = action
            }
        }
    }

    fun pauseNativeTrack() {
        runOnUiThread {
            mediaController?.pause()
        }
    }

    fun resumeNativeTrack() {
        runOnUiThread {
            mediaController?.play()
        }
    }

    fun seekNativeTrack(sec: Double) {
        runOnUiThread {
            mediaController?.seekTo((sec * 1000.0).toLong())
        }
    }

    fun applyNativeEqualizer(enabled: Boolean, bandsDb: IntArray, virtualizerPct: Int) {
        runOnUiThread {
            val controller = mediaController ?: return@runOnUiThread
            val bandsMb = bandsDb.map { it * 100 }.toIntArray()
            val args = Bundle().apply {
                putBoolean(MusicPlaybackService.EXTRA_EQ_ENABLED, enabled)
                putIntArray(MusicPlaybackService.EXTRA_EQ_BANDS_MB, bandsMb)
                putInt(MusicPlaybackService.EXTRA_VIRTUALIZER, virtualizerPct * 10)
            }
            controller.sendCustomCommand(
                SessionCommand(MusicPlaybackService.CMD_APPLY_EQ, Bundle.EMPTY),
                args
            )
        }
    }

    fun deleteDeviceTrack(trackId: String, contentUriStr: String, filePath: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            val uri = contentUriStr.takeIf { it.isNotBlank() }?.let { Uri.parse(it) }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && uri != null) {
                    val deletePendingIntent = MediaStore.createDeleteRequest(contentResolver, listOf(uri))
                    withContext(Dispatchers.Main) {
                        pendingDeleteTrackId = trackId
                        pendingDeleteUri = uri
                        pendingDeleteFilePath = filePath
                        pendingDeleteIsCreateRequest = true
                        deleteLauncher.launch(
                            IntentSenderRequest.Builder(deletePendingIntent.intentSender).build()
                        )
                    }
                    return@launch
                }

                var deleted = false
                if (uri != null) {
                    try {
                        deleted = contentResolver.delete(uri, null, null) > 0
                    } catch (securityEx: SecurityException) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && securityEx is RecoverableSecurityException) {
                            withContext(Dispatchers.Main) {
                                pendingDeleteTrackId = trackId
                                pendingDeleteUri = uri
                                pendingDeleteFilePath = filePath
                                pendingDeleteIsCreateRequest = false
                                deleteLauncher.launch(
                                    IntentSenderRequest.Builder(securityEx.userAction.actionIntent.intentSender).build()
                                )
                            }
                            return@launch
                        }
                        throw securityEx
                    }
                }

                if (!deleted && filePath.isNotBlank()) {
                    val file = File(filePath)
                    if (file.exists()) {
                        deleted = file.delete()
                    }
                }

                withContext(Dispatchers.Main) {
                    if (deleted) {
                        if (uri != null && currentPlayingUri == uri) {
                            mediaController?.stop()
                            mediaController?.clearMediaItems()
                            currentPlayingUri = null
                        }
                        notifyTrackDeleted(trackId, true, null)
                    } else {
                        notifyTrackDeleted(trackId, false, "Unable to delete file from storage")
                    }
                }
            } catch (e: Exception) {
                Log.e("AGPlayer", "Failed to delete track: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    notifyTrackDeleted(trackId, false, e.localizedMessage ?: "Delete failed")
                }
            }
        }
    }

    private fun notifyTrackDeleted(trackId: String, success: Boolean, errorMsg: String?) {
        val quotedId = JSONObject.quote(trackId)
        val quotedErr = if (errorMsg != null) JSONObject.quote(errorMsg) else "null"
        evalJs("window.__agOnTrackDeleted?.($quotedId, $success, $quotedErr);")
    }

    override fun onDestroy() {
        progressJob?.cancel()
        controllerFuture?.let { MediaController.releaseFuture(it) }
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}

class WebAppInterface(private val activity: MainActivity, private val updateManager: GitHubUpdateManager) {
    @JavascriptInterface
    fun checkForUpdates() {
        activity.lifecycleScope.launch {
            updateManager.checkForUpdates()
        }
    }

    @JavascriptInterface
    fun getVersionName(): String {
        return BuildConfig.VERSION_NAME
    }

    @JavascriptInterface
    fun hasAudioPermission(): Boolean {
        return activity.hasAudioPermission()
    }

    @JavascriptInterface
    fun requestPermissionAndScan() {
        activity.runOnUiThread {
            if (activity.hasAudioPermission()) {
                activity.scanLocalAudioAndNotify(isManual = true)
            } else {
                activity.requestRuntimePermissions()
            }
        }
    }

    @JavascriptInterface
    fun scanLocalAudioAsync(isManual: Boolean) {
        activity.scanLocalAudioAndNotify(isManual)
    }

    @JavascriptInterface
    fun getLocalAudioTracksJson(): String {
        return activity.buildTracksJson()
    }

    @JavascriptInterface
    fun playTrack(
        uri: String,
        title: String,
        artist: String,
        album: String,
        artUri: String,
        startSec: Double
    ) {
        activity.playNativeTrack(uri, title, artist, album, artUri, startSec)
    }

    @JavascriptInterface
    fun pauseTrack() {
        activity.pauseNativeTrack()
    }

    @JavascriptInterface
    fun resumeTrack() {
        activity.resumeNativeTrack()
    }

    @JavascriptInterface
    fun seekTo(sec: Double) {
        activity.seekNativeTrack(sec)
    }

    @JavascriptInterface
    fun updateEqualizer(enabled: Boolean, bandsJson: String, virtualizer: Int) {
        try {
            val arr = JSONArray(bandsJson)
            val bands = IntArray(arr.length()) { i -> arr.optInt(i, 0) }
            activity.applyNativeEqualizer(enabled, bands, virtualizer)
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun deleteDeviceTrack(trackId: String, contentUri: String, filePath: String) {
        activity.deleteDeviceTrack(trackId, contentUri, filePath)
    }
}
