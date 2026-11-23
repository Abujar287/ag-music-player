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
                        UpdateState.Error("GitHub API returned HTTP $responseCode")
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
        val targetFile = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            release.apkAssetName
        )
        if (targetFile.exists()) {
            targetFile.delete()
        }

        val request = DownloadManager.Request(Uri.parse(release.apkDownloadUrl)).apply {
            setTitle(release.apkAssetName)
            setDescription("Downloading AG Music Player ${release.tagName}")
            setMimeType("application/vnd.android.package-archive")
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, release.apkAssetName)
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
        }

        val downloadId = downloadManager.enqueue(request)
        _state.value = UpdateState.Downloading(release, 0, 0L, release.apkSizeBytes)

        withContext(Dispatchers.IO) {
            var downloading = true
            while (downloading) {
                val query = DownloadManager.Query().setFilterById(downloadId)
                val cursor: Cursor? = downloadManager.query(query)
                if (cursor != null && cursor.moveToFirst()) {
                    val statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                    val downloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                    val totalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)

                    val status = if (statusIdx >= 0) cursor.getInt(statusIdx) else DownloadManager.STATUS_FAILED
                    val downloaded = if (downloadedIdx >= 0) cursor.getLong(downloadedIdx) else 0L
                    val total = if (totalIdx >= 0) cursor.getLong(totalIdx) else release.apkSizeBytes

                    val percent = if (total > 0) ((downloaded * 100L) / total).toInt().coerceIn(0, 100) else 0

                    when (status) {
                        DownloadManager.STATUS_SUCCESSFUL -> {
                            downloading = false
                            _state.value = UpdateState.ReadyToInstall(release, targetFile)
                            withContext(Dispatchers.Main) {
                                triggerApkInstall(targetFile)
                            }
                        }
                        DownloadManager.STATUS_FAILED -> {
                            downloading = false
                            _state.value = UpdateState.Error("APK download failed in DownloadManager.")
                        }
                        else -> {
                            _state.value = UpdateState.Downloading(release, percent, downloaded, total)
                        }
                    }
                }
                cursor?.close()
                if (downloading) delay(250L)
            }
        }
    }

    fun triggerApkInstall(apkFile: File) {
        if (!context.packageManager.canRequestPackageInstalls()) {
            val permissionIntent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(permissionIntent)
            return
        }

        val apkUri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            apkFile
        )

        val installIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(apkUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(installIntent)
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
