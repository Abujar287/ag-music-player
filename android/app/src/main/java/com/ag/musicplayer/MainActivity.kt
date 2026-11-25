package com.ag.musicplayer

import android.Manifest
import android.app.Activity
import android.app.RecoverableSecurityException
import android.content.ClipData
import android.content.ComponentName
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import androidx.core.content.FileProvider
import android.os.Build
import android.os.Bundle
import android.os.Environment
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
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.C
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
import com.ag.musicplayer.updater.GitHubRelease
import com.ag.musicplayer.updater.GitHubUpdateManager
import com.ag.musicplayer.updater.UpdateState
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
    private var pendingUpdateRelease: GitHubRelease? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        if (hasAudioPermission()) {
            scanLocalAudioAndNotify(isManual = false)
        }
    }

    private val writeStorageLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val release = pendingUpdateRelease
        pendingUpdateRelease = null
        if (release != null) {
            if (granted) {
                lifecycleScope.launch {
                    updateManager.downloadAndInstall(release)
                }
            } else {
                val qMsg = JSONObject.quote("Storage permission is required to save update APK to 0/Download.")
                evalJs("window.__agUpdateCallbacks?.onError?.($qMsg);")
            }
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

        lifecycleScope.launch {
            updateManager.state.collect { state ->
                when (state) {
                    is UpdateState.Downloading -> {
                        evalJs(
                            "window.__agUpdateCallbacks?.onProgress?.(${state.progressPercent}, ${state.bytesDownloaded}, ${state.totalBytes});"
                        )
                    }
                    is UpdateState.ReadyToInstall -> {
                        evalJs("window.__agUpdateCallbacks?.onReady?.();")
                    }
                    is UpdateState.Error -> {
                        val qMsg = JSONObject.quote(state.message)
                        evalJs("window.__agUpdateCallbacks?.onError?.($qMsg);")
                    }
                    else -> {}
                }
            }
        }

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
                allowUniversalAccessFromFileURLs = false
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
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

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (!::webView.isInitialized) {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                    return
                }
                webView.evaluateJavascript(
                    "(function(){ try { return !!(window.__agHandleBackButton && window.__agHandleBackButton()); } catch(e) { return false; } })()"
                ) { result ->
                    if (result?.trim() == "true") {
                        return@evaluateJavascript
                    }
                    if (webView.canGoBack()) {
                        webView.goBack()
                        return@evaluateJavascript
                    }
                    if (mediaController?.isPlaying == true) {
                        moveTaskToBack(true)
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                    }
                }
            }
        })
    }

    override fun onResume() {
        super.onResume()
        if (::updateManager.isInitialized) {
            updateManager.resumePendingInstall()
        }
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
                        val posSec = controller.currentPosition.coerceAtLeast(0L) / 1000.0
                        val durMs = controller.duration
                        val durSec = if (durMs != C.TIME_UNSET && durMs > 0L) durMs / 1000.0 else 0.0
                        evalJs("window.__agNativeCallbacks?.onStateChange?.($isPlaying, $posSec, $durSec);")
                        if (isPlaying) {
                            startProgressPolling()
                        } else {
                            progressJob?.cancel()
                        }
                    }

                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_READY) {
                            val posSec = controller.currentPosition.coerceAtLeast(0L) / 1000.0
                            val durMs = controller.duration
                            val durSec = if (durMs != C.TIME_UNSET && durMs > 0L) durMs / 1000.0 else 0.0
                            evalJs("window.__agNativeCallbacks?.onProgress?.($posSec, $durSec);")
                        } else if (playbackState == Player.STATE_ENDED) {
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
                    val posSec = controller.currentPosition.coerceAtLeast(0L) / 1000.0
                    val durMs = controller.duration
                    val durSec = if (durMs != C.TIME_UNSET && durMs > 0L) durMs / 1000.0 else 0.0
                    evalJs("window.__agNativeCallbacks?.onProgress?.($posSec, $durSec);")
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
                val startMs = if (startSec > 0.0) (startSec * 1000.0).toLong() else 0L
                controller.setMediaItem(item, startMs)
                controller.prepare()
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
            val controller = mediaController ?: return@runOnUiThread
            val durMs = controller.duration
            val targetMs = (sec * 1000.0).toLong().let { ms ->
                if (durMs != C.TIME_UNSET && durMs > 0L) ms.coerceIn(0L, durMs) else ms.coerceAtLeast(0L)
            }
            controller.seekTo(targetMs)
            val durSec = if (durMs != C.TIME_UNSET && durMs > 0L) durMs / 1000.0 else 0.0
            evalJs("window.__agNativeCallbacks?.onProgress?.(${targetMs / 1000.0}, $durSec);")
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

    fun shareDeviceTrack(title: String, artist: String, contentUriStr: String, filePath: String): Boolean {
        return try {
            val parsedContentUri = contentUriStr.takeIf { it.isNotBlank() }?.let {
                runCatching { Uri.parse(it) }.getOrNull()
            }?.takeIf { it.scheme == "content" }
            val file = filePath.takeIf { it.isNotBlank() }?.let { File(it) }?.takeIf { it.exists() }
            val fileProviderUri = file?.let {
                runCatching {
                    FileProvider.getUriForFile(this, "${packageName}.fileprovider", it)
                }.getOrNull()
            }
            val shareUri = parsedContentUri ?: fileProviderUri

            if (shareUri != null) {
                val detectedMime = contentResolver.getType(shareUri) ?: "audio/*"
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = detectedMime
                    putExtra(Intent.EXTRA_STREAM, shareUri)
                    putExtra(Intent.EXTRA_SUBJECT, title)
                    clipData = ClipData.newUri(contentResolver, title.ifBlank { "Audio" }, shareUri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                val chooser = Intent.createChooser(shareIntent, "Share ${title.ifBlank { "Audio" }}").apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(chooser)
                true
            } else {
                sharePlainText(title, "Listening to \"$title\" by $artist on AG Music Player")
            }
        } catch (e: Exception) {
            Log.e("AGPlayer", "Failed to share audio track: ${e.message}", e)
            false
        }
    }

    fun sharePlainText(title: String, text: String): Boolean {
        return try {
            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_TEXT, text)
            }
            val chooser = Intent.createChooser(sendIntent, "Share ${title.ifBlank { "AG Music Player" }}").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(chooser)
            true
        } catch (e: Exception) {
            Log.e("AGPlayer", "Failed to share text: ${e.message}", e)
            false
        }
    }

    fun findInstalledIdmPackage(): String? {
        val candidates = listOf(
            "idm.internet.download.manager.plus",
            "idm.internet.download.manager",
            "idm.internet.download.manager.adm.like"
        )
        for (pkg in candidates) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    packageManager.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0L))
                } else {
                    @Suppress("DEPRECATION")
                    packageManager.getPackageInfo(pkg, 0)
                }
                return pkg
            } catch (_: Exception) {}
        }
        return null
    }

    fun launchUpdateInIdm(apkUrl: String, apkName: String): Boolean {
        val pkg = findInstalledIdmPackage() ?: return false
        val parsedUri = Uri.parse(apkUrl)
        val cleanName = apkName.trim()
            .replace(Regex("[\\\\/:*?\"<>|]"), "-")
            .removeSuffix(".tmp")
            .removeSuffix(".download")
            .let { if (it.endsWith(".apk", ignoreCase = true)) it else "${it.ifBlank { "AG-Music-Player" }}.apk" }
        @Suppress("DEPRECATION")
        val publicDownloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath
        val intents = listOf(
            Intent(Intent.ACTION_VIEW, parsedUri).apply {
                setPackage(pkg)
                putExtra("extra_filename", cleanName)
                putExtra("android.intent.extra.TITLE", cleanName)
                putExtra("extra_path", publicDownloadDir)
                putExtra("download_path", publicDownloadDir)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
            Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(parsedUri, "application/vnd.android.package-archive")
                setPackage(pkg)
                putExtra("extra_filename", cleanName)
                putExtra("extra_path", publicDownloadDir)
                putExtra("download_path", publicDownloadDir)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            },
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, apkUrl)
                putExtra(Intent.EXTRA_SUBJECT, cleanName)
                putExtra("extra_filename", cleanName)
                putExtra("extra_path", publicDownloadDir)
                putExtra("download_path", publicDownloadDir)
                setPackage(pkg)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
        for (intent in intents) {
            try {
                if (intent.resolveActivity(packageManager) != null) {
                    startActivity(intent)
                    return true
                }
            } catch (_: Exception) {}
        }
        return false
    }

    fun openUpdateUrlInChooser(apkUrl: String) {
        try {
            val viewIntent = Intent(Intent.ACTION_VIEW, Uri.parse(apkUrl)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val chooser = Intent.createChooser(viewIntent, "Download APK with").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(chooser)
        } catch (_: Exception) {}
    }

    fun startDownloadManagerUpdate(release: GitHubRelease) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            pendingUpdateRelease = release
            runOnUiThread {
                writeStorageLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
            return
        }
        lifecycleScope.launch {
            updateManager.downloadAndInstall(release)
        }
    }

    override fun onDestroy() {
        progressJob?.cancel()
        controllerFuture?.let { MediaController.releaseFuture(it) }
        super.onDestroy()
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
    fun getVersionCode(): Int {
        return BuildConfig.VERSION_CODE
    }

    @JavascriptInterface
    fun hasIdmInstalled(): Boolean {
        return activity.findInstalledIdmPackage() != null
    }

    @JavascriptInterface
    fun launchUpdateInIdm(apkUrl: String, apkName: String): Boolean {
        return activity.launchUpdateInIdm(apkUrl, apkName)
    }

    @JavascriptInterface
    fun openUpdateUrlInChooser(apkUrl: String) {
        activity.runOnUiThread {
            activity.openUpdateUrlInChooser(apkUrl)
        }
    }

    @JavascriptInterface
    fun startInAppApkDownload(apkUrl: String, apkName: String, tagName: String, apkSizeBytes: Long) {
        val release = GitHubRelease(
            tagName = tagName,
            versionName = tagName.removePrefix("V-").removePrefix("v"),
            releaseNotes = "",
            apkAssetName = apkName,
            apkDownloadUrl = apkUrl,
            apkSizeBytes = apkSizeBytes
        )
        activity.startDownloadManagerUpdate(release)
    }

    @JavascriptInterface
    fun installDownloadedApk(): Boolean {
        return updateManager.retryInstallLastApk()
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

    @JavascriptInterface
    fun shareTrack(title: String, artist: String, contentUri: String, filePath: String): Boolean {
        activity.runOnUiThread {
            activity.shareDeviceTrack(title, artist, contentUri, filePath)
        }
        return true
    }

    @JavascriptInterface
    fun shareText(title: String, text: String): Boolean {
        activity.runOnUiThread {
            activity.sharePlainText(title, text)
        }
        return true
    }
}
