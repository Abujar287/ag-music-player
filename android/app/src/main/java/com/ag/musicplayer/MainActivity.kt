package com.ag.musicplayer

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import com.ag.musicplayer.data.AppSettings
import com.ag.musicplayer.data.MediaScanner
import com.ag.musicplayer.data.Track
import com.ag.musicplayer.updater.GitHubUpdateManager
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var updateManager: GitHubUpdateManager

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        updateManager = GitHubUpdateManager(this)
        requestRuntimePermissions()

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
    fun getLocalAudioTracksJson(): String {
        val scanner = MediaScanner(activity)
        val tracks: List<Track> = scanner.scanLocalAudio(AppSettings())
        val jsonArray = org.json.JSONArray()
        for (i in 0 until tracks.size) {
            val track = tracks[i]
            val obj = org.json.JSONObject().apply {
                put("id", "device-${track.id}")
                put("title", track.title)
                put("artist", track.artist)
                put("album", track.album)
                put("genre", track.genre)
                put("folderPath", track.folderPath)
                put("folder", track.folder)
                put("filePath", track.filePath)
                put("contentUri", track.contentUri.toString())
                put("coverUrl", track.albumArtUri?.toString() ?: "")
                put("durationSec", track.durationMs / 1000)
                put("sizeKb", track.sizeBytes / 1024)
                put("mediaType", "audio")
                put("isLocalImport", true)
            }
            jsonArray.put(obj)
        }
        return jsonArray.toString()
    }
}
