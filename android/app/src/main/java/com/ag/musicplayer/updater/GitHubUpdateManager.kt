package com.ag.musicplayer.updater

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import com.ag.musicplayer.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class GitHubRelease(
    val tagName: String,
    val versionName: String,
    val releaseNotes: String,
    val apkAssetName: String,
    val apkDownloadUrl: String,
    val apkSizeBytes: Long
)

sealed interface UpdateState {
    data object Idle : UpdateState
    data object Checking : UpdateState
    data class UpToDate(val currentVersion: String) : UpdateState
    data class UpdateAvailable(val release: GitHubRelease) : UpdateState
    data class Downloading(
        val release: GitHubRelease,
        val progressPercent: Int,
        val bytesDownloaded: Long,
        val totalBytes: Long
    ) : UpdateState
    data class ReadyToInstall(val release: GitHubRelease, val apkFile: File) : UpdateState
    data class Error(val message: String) : UpdateState
}

class GitHubUpdateManager(private val context: Context) {

    companion object {
        const val LATEST_RELEASE_API =
            "https://api.github.com/repos/Abujar287/ag-music-player/releases/latest"
    }

    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = _state.asStateFlow()

    private val downloadManager =
        context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private var lastApkFile: File? = null
    private var pendingInstallFile: File? = null

    suspend fun checkForUpdates() {
        _state.value = UpdateState.Checking
        withContext(Dispatchers.IO) {
            try {
                val connection = (URL(LATEST_RELEASE_API).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 10_000
                    readTimeout = 10_000
                    setRequestProperty("Accept", "application/vnd.github+json")
                    setRequestProperty("User-Agent", "AG-Music-Player-Android")
                }

                val responseCode = connection.responseCode
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    _state.value = if (responseCode == HttpURLConnection.HTTP_NOT_FOUND) {
                        UpdateState.UpToDate("V-${BuildConfig.VERSION_NAME}")
                    } else {
                        UpdateState.Error("Unable to check for updates (HTTP $responseCode).")
                    }
                    return@withContext
                }

                val body = connection.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val tagName = json.optString("tag_name", "V-1.0.1")
                val remoteVersion = tagName.removePrefix("V-").removePrefix("v")
                val releaseNotes = json.optString("body", "Performance improvements and bug fixes.")

                val assets = json.optJSONArray("assets")
                var apkName = ""
                var apkUrl = ""
                var apkSize = 0L

                if (assets != null) {
                    for (i in 0 until assets.length()) {
                        val asset = assets.getJSONObject(i)
                        val name = asset.optString("name", "")
                        if (name.endsWith(".apk", ignoreCase = true)) {
                            apkName = name
                            apkUrl = asset.optString("browser_download_url", "")
                            apkSize = asset.optLong("size", 0L)
                            break
                        }
                    }
                }

                if (isRemoteNewer(remoteVersion, BuildConfig.VERSION_NAME) && apkUrl.isNotBlank()) {
                    _state.value = UpdateState.UpdateAvailable(
                        GitHubRelease(
                            tagName = tagName,
                            versionName = remoteVersion,
                            releaseNotes = releaseNotes,
                            apkAssetName = apkName,
                            apkDownloadUrl = apkUrl,
                            apkSizeBytes = apkSize
                        )
                    )
                } else {
                    _state.value = UpdateState.UpToDate("V-${BuildConfig.VERSION_NAME}")
                }
            } catch (e: Exception) {
                _state.value = UpdateState.Error(e.localizedMessage ?: "Failed to check for updates")
            }
        }
    }

    suspend fun downloadAndInstall(release: GitHubRelease) {
        val downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs()
        }
        val safeName = release.apkAssetName.ifBlank { "AG-Music-Player-${release.tagName}.apk" }
        val targetFile = File(downloadsDir, safeName)
        if (targetFile.exists()) {
            targetFile.delete()
        }
        lastApkFile = targetFile
        _state.value = UpdateState.Downloading(release, 0, 0L, release.apkSizeBytes)

        withContext(Dispatchers.IO) {
            var useDirectFallback = false
            var downloadId = -1L

            try {
                val request = DownloadManager.Request(Uri.parse(release.apkDownloadUrl)).apply {
                    setTitle(safeName)
                    setDescription("Downloading AG Music Player ${release.tagName}")
                    setMimeType("application/vnd.android.package-archive")
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, safeName)
                    setAllowedOverMetered(true)
                    setAllowedOverRoaming(true)
                }
                downloadId = downloadManager.enqueue(request)
            } catch (_: Exception) {
                useDirectFallback = true
            }

            if (!useDirectFallback && downloadId >= 0L) {
                var downloading = true
                var pendingTicks = 0
                while (downloading) {
                    var cursor: Cursor? = null
                    try {
                        val query = DownloadManager.Query().setFilterById(downloadId)
                        cursor = downloadManager.query(query)
                        if (cursor != null && cursor.moveToFirst()) {
                            val statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                            val downloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                            val totalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)

                            val status = if (statusIdx >= 0) cursor.getInt(statusIdx) else DownloadManager.STATUS_FAILED
                            val downloaded = if (downloadedIdx >= 0) cursor.getLong(downloadedIdx) else 0L
                            val rawTotal = if (totalIdx >= 0) cursor.getLong(totalIdx) else -1L
                            val total = if (rawTotal > 0L) rawTotal else release.apkSizeBytes
                            val percent = if (total > 0L) ((downloaded * 100L) / total).toInt().coerceIn(0, 100) else 0

                            when (status) {
                                DownloadManager.STATUS_SUCCESSFUL -> {
                                    downloading = false
                                    if (!targetFile.exists() || targetFile.length() <= 0L) {
                                        try {
                                            downloadManager.openDownloadedFile(downloadId)?.use { pfd ->
                                                java.io.FileInputStream(pfd.fileDescriptor).use { input ->
                                                    targetFile.outputStream().use { output ->
                                                        input.copyTo(output)
                                                    }
                                                }
                                            }
                                        } catch (_: Exception) {}
                                    }
                                    if (!targetFile.exists() || targetFile.length() <= 0L) {
                                        useDirectFallback = true
                                        break
                                    }
                                    val finalBytes = targetFile.length()
                                    _state.value = UpdateState.Downloading(release, 100, finalBytes, finalBytes)
                                    _state.value = UpdateState.ReadyToInstall(release, targetFile)
                                    withContext(Dispatchers.Main) {
                                        triggerApkInstall(targetFile)
                                    }
                                    return@withContext
                                }
                                DownloadManager.STATUS_FAILED -> {
                                    downloading = false
                                    useDirectFallback = true
                                }
                                else -> {
                                    if (downloaded == 0L && status == DownloadManager.STATUS_PENDING) {
                                        pendingTicks++
                                        if (pendingTicks > 40) {
                                            downloading = false
                                            useDirectFallback = true
                                        }
                                    } else {
                                        pendingTicks = 0
                                    }
                                    _state.value = UpdateState.Downloading(release, percent, downloaded, total)
                                }
                            }
                        } else {
                            pendingTicks++
                            if (pendingTicks > 15) {
                                downloading = false
                                useDirectFallback = true
                            }
                        }
                    } catch (_: Exception) {
                        downloading = false
                        useDirectFallback = true
                    } finally {
                        cursor?.close()
                    }
                    if (downloading) delay(220L)
                }

                if (useDirectFallback) {
                    try {
                        downloadManager.remove(downloadId)
                    } catch (_: Exception) {}
                }
            }

            if (useDirectFallback) {
                directHttpDownload(release, targetFile)
            }
        }
    }

    private suspend fun directHttpDownload(release: GitHubRelease, targetFile: File) {
        try {
            if (targetFile.exists()) {
                targetFile.delete()
            }
            var currentUrl = release.apkDownloadUrl
            var connection: HttpURLConnection? = null
            var redirects = 0

            while (redirects < 6) {
                val conn = (URL(currentUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    instanceFollowRedirects = false
                    connectTimeout = 15_000
                    readTimeout = 30_000
                    setRequestProperty("User-Agent", "AG-Music-Player-Android")
                }
                val code = conn.responseCode
                if (code in 300..399) {
                    val loc = conn.getHeaderField("Location")
                    conn.disconnect()
                    if (loc.isNullOrBlank()) {
                        throw IllegalStateException("Empty redirect location (HTTP $code)")
                    }
                    currentUrl = URL(URL(currentUrl), loc).toString()
                    redirects++
                } else {
                    connection = conn
                    break
                }
            }

            val conn = connection ?: throw IllegalStateException("Too many redirects while downloading APK.")
            try {
                val code = conn.responseCode
                if (code !in 200..299) {
                    throw IllegalStateException("Download failed (HTTP $code).")
                }

                val contentLength = conn.contentLengthLong
                val totalBytes = if (contentLength > 0L) contentLength else release.apkSizeBytes
                var downloadedBytes = 0L
                var lastEmitTime = 0L

                conn.inputStream.use { input ->
                    targetFile.outputStream().use { output ->
                        val buffer = ByteArray(16 * 1024)
                        while (true) {
                            val read = input.read(buffer)
                            if (read == -1) break
                            output.write(buffer, 0, read)
                            downloadedBytes += read

                            val now = System.currentTimeMillis()
                            if (now - lastEmitTime >= 150L) {
                                lastEmitTime = now
                                val percent = if (totalBytes > 0L) {
                                    ((downloadedBytes * 100L) / totalBytes).toInt().coerceIn(0, 99)
                                } else 0
                                _state.value = UpdateState.Downloading(
                                    release,
                                    percent,
                                    downloadedBytes,
                                    totalBytes
                                )
                            }
                        }
                        output.flush()
                    }
                }

                val finalSize = if (targetFile.length() > 0L) targetFile.length() else downloadedBytes
                _state.value = UpdateState.Downloading(release, 100, finalSize, finalSize)
                _state.value = UpdateState.ReadyToInstall(release, targetFile)
                withContext(Dispatchers.Main) {
                    triggerApkInstall(targetFile)
                }
            } finally {
                conn.disconnect()
            }
        } catch (e: Exception) {
            if (targetFile.exists()) {
                targetFile.delete()
            }
            _state.value = UpdateState.Error(e.localizedMessage ?: "Failed to download update APK.")
        }
    }

    fun retryInstallLastApk(): Boolean {
        val file = lastApkFile ?: return false
        if (!file.exists()) return false
        triggerApkInstall(file)
        return true
    }

    fun resumePendingInstall() {
        val file = pendingInstallFile ?: return
        if (context.packageManager.canRequestPackageInstalls() && file.exists()) {
            pendingInstallFile = null
            launchInstallerIntent(file)
        }
    }

    fun triggerApkInstall(apkFile: File) {
        if (!apkFile.exists()) {
            _state.value = UpdateState.Error("Downloaded APK file not found.")
            return
        }
        if (!context.packageManager.canRequestPackageInstalls()) {
            pendingInstallFile = apkFile
            try {
                val permissionIntent = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${context.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(permissionIntent)
            } catch (_: Exception) {
                _state.value = UpdateState.Error("Enable 'Install unknown apps' permission in Settings.")
            }
            return
        }
        pendingInstallFile = null
        launchInstallerIntent(apkFile)
    }

    private fun launchInstallerIntent(apkFile: File) {
        try {
            val apkUri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
            }
            context.startActivity(installIntent)
        } catch (e: Exception) {
            _state.value = UpdateState.Error(e.localizedMessage ?: "Unable to launch package installer.")
        }
    }

    fun dismiss() {
        _state.value = UpdateState.Idle
    }

    private fun isRemoteNewer(remote: String, local: String): Boolean {
        val rParts = remote.split(".").map { it.toIntOrNull() ?: 0 }
        val lParts = local.split(".").map { it.toIntOrNull() ?: 0 }
        val maxLen = maxOf(rParts.size, lParts.size)
        for (i in 0 until maxLen) {
            val r = rParts.getOrElse(i) { 0 }
            val l = lParts.getOrElse(i) { 0 }
            if (r > l) return true
            if (r < l) return false
        }
        return false
    }
}
