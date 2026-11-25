package com.ag.musicplayer.updater

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
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
    data class ReadyToInstall(val release: GitHubRelease, val apkUri: Uri?, val apkFile: File?) : UpdateState
    data class Error(val message: String) : UpdateState
}

class GitHubUpdateManager(private val context: Context) {

    companion object {
        const val LATEST_RELEASE_API =
            "https://api.github.com/repos/Abujar287/ag-music-player/releases/latest"
        private const val MAX_PENDING_WAIT_TICKS = 360 // ~90 seconds before reporting pending timeout
        private const val POLL_INTERVAL_MS = 250L
    }

    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = _state.asStateFlow()

    private val downloadManager =
        context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    private var lastApkFile: File? = null
    private var lastApkUri: Uri? = null
    private var pendingInstallFile: File? = null
    private var pendingInstallUri: Uri? = null
    @Volatile
    private var activeDownloadId: Long = -1L

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

    private fun sanitizeApkFilename(rawName: String, tagName: String): String {
        var clean = rawName.trim()
            .replace(Regex("[\\\\/:*?\"<>|]"), "-")
            .removeSuffix(".tmp")
            .removeSuffix(".download")
            .removeSuffix(".part")
            .trim()
        if (clean.isBlank()) {
            clean = "AG-Music-Player-${tagName.ifBlank { "update" }}"
        }
        if (!clean.endsWith(".apk", ignoreCase = true)) {
            clean = "$clean.apk"
        }
        return clean
    }

    private fun buildUniqueApkFilename(baseName: String): String {
        val dotIndex = baseName.lastIndexOf('.')
        val stem = if (dotIndex > 0) baseName.substring(0, dotIndex) else baseName
        val ext = if (dotIndex > 0) baseName.substring(dotIndex) else ".apk"
        return "$stem-${System.currentTimeMillis() / 1000}$ext"
    }

    private fun enqueueDownloadManagerRequest(
        release: GitHubRelease,
        targetFileName: String
    ): Long {
        val encodedUrl = release.apkDownloadUrl.trim().replace(" ", "%20")
        val request = DownloadManager.Request(Uri.parse(encodedUrl)).apply {
            setTitle(targetFileName)
            setDescription("Downloading AG Music Player ${release.tagName} to 0/Download")
            setMimeType("application/vnd.android.package-archive")
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            // Saves directly into primary shared storage: 0/Download/<targetFileName>
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, targetFileName)
            addRequestHeader("User-Agent", "AG-Music-Player-Android")
            addRequestHeader("Accept", "application/vnd.android.package-archive, application/octet-stream, */*")
            setAllowedNetworkTypes(
                DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE
            )
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
            setRequiresCharging(false)
            setRequiresDeviceIdle(false)
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                @Suppress("DEPRECATION")
                allowScanningByMediaScanner()
                @Suppress("DEPRECATION")
                setVisibleInDownloadsUi(true)
            }
        }
        return downloadManager.enqueue(request)
    }

    suspend fun downloadAndInstall(release: GitHubRelease) {
        val safeName = sanitizeApkFilename(release.apkAssetName, release.tagName)
        @Suppress("DEPRECATION")
        val publicDownloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)

        lastApkFile = null
        lastApkUri = null
        _state.value = UpdateState.Downloading(release, 0, 0L, release.apkSizeBytes)

        withContext(Dispatchers.IO) {
            if (activeDownloadId >= 0L) {
                try {
                    downloadManager.remove(activeDownloadId)
                } catch (_: Exception) {}
                activeDownloadId = -1L
            }

            var targetFileName = safeName
            var retriedCollision = false

            while (true) {
                val expectedPublicFile = File(publicDownloadDir, targetFileName)
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    try {
                        if (!publicDownloadDir.exists()) publicDownloadDir.mkdirs()
                        if (expectedPublicFile.exists()) expectedPublicFile.delete()
                    } catch (_: Exception) {}
                }

                val downloadId = try {
                    enqueueDownloadManagerRequest(release, targetFileName)
                } catch (e: Exception) {
                    if (!retriedCollision) {
                        retriedCollision = true
                        targetFileName = buildUniqueApkFilename(safeName)
                        continue
                    }
                    _state.value = UpdateState.Error(
                        e.localizedMessage ?: "Android DownloadManager could not start APK download into 0/Download."
                    )
                    return@withContext
                }

                activeDownloadId = downloadId
                var downloading = true
                var pendingTicks = 0
                var shouldRetryUniqueName = false

                while (downloading && activeDownloadId == downloadId) {
                    var cursor: Cursor? = null
                    try {
                        val query = DownloadManager.Query().setFilterById(downloadId)
                        cursor = downloadManager.query(query)
                        if (cursor != null && cursor.moveToFirst()) {
                            val statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                            val reasonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON)
                            val downloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                            val totalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
                            val localUriIdx = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)

                            val status = if (statusIdx >= 0) cursor.getInt(statusIdx) else DownloadManager.STATUS_FAILED
                            val reason = if (reasonIdx >= 0) cursor.getInt(reasonIdx) else 0
                            val downloaded = if (downloadedIdx >= 0) cursor.getLong(downloadedIdx).coerceAtLeast(0L) else 0L
                            val rawTotal = if (totalIdx >= 0) cursor.getLong(totalIdx) else -1L
                            val total = if (rawTotal > 0L) rawTotal else release.apkSizeBytes
                            val percent = if (total > 0L) {
                                ((downloaded * 100L) / total).toInt().coerceIn(0, 99)
                            } else 0

                            when (status) {
                                DownloadManager.STATUS_SUCCESSFUL -> {
                                    downloading = false
                                    activeDownloadId = -1L

                                    val dmContentUri = try {
                                        downloadManager.getUriForDownloadedFile(downloadId)
                                    } catch (_: Exception) {
                                        null
                                    }

                                    val localUriStr = if (localUriIdx >= 0) cursor.getString(localUriIdx) else null
                                    val parsedLocalUri = localUriStr?.let { runCatching { Uri.parse(it) }.getOrNull() }
                                    val localFile = if (parsedLocalUri?.scheme == "file") {
                                        parsedLocalUri.path?.let { File(it) }?.takeIf { it.exists() && it.length() > 0L }
                                    } else {
                                        null
                                    }
                                    val resolvedFile = localFile
                                        ?: expectedPublicFile.takeIf { it.exists() && it.length() > 0L }

                                    if (resolvedFile == null && dmContentUri == null) {
                                        _state.value = UpdateState.Error(
                                            "Download completed in DownloadManager, but APK could not be located in 0/Download."
                                        )
                                        return@withContext
                                    }

                                    resolvedFile?.let { file ->
                                        scanPublicDownloadFile(file.absolutePath)
                                    }

                                    val finalBytes = resolvedFile?.length()
                                        ?: if (downloaded > 0L) downloaded else total
                                    lastApkFile = resolvedFile
                                    lastApkUri = dmContentUri

                                    _state.value = UpdateState.Downloading(release, 100, finalBytes, finalBytes)
                                    _state.value = UpdateState.ReadyToInstall(release, dmContentUri, resolvedFile)
                                    withContext(Dispatchers.Main) {
                                        triggerApkInstall(resolvedFile, dmContentUri)
                                    }
                                    return@withContext
                                }

                                DownloadManager.STATUS_FAILED -> {
                                    downloading = false
                                    activeDownloadId = -1L
                                    try {
                                        downloadManager.remove(downloadId)
                                    } catch (_: Exception) {}

                                    if (reason == DownloadManager.ERROR_FILE_ALREADY_EXISTS && !retriedCollision) {
                                        retriedCollision = true
                                        targetFileName = buildUniqueApkFilename(safeName)
                                        shouldRetryUniqueName = true
                                    } else {
                                        _state.value = UpdateState.Error(describeDownloadFailure(reason))
                                        return@withContext
                                    }
                                }

                                DownloadManager.STATUS_PAUSED -> {
                                    pendingTicks++
                                    if (pendingTicks > MAX_PENDING_WAIT_TICKS && downloaded == 0L) {
                                        downloading = false
                                        activeDownloadId = -1L
                                        try {
                                            downloadManager.remove(downloadId)
                                        } catch (_: Exception) {}
                                        _state.value = UpdateState.Error(describePausedTimeout(reason))
                                        return@withContext
                                    }
                                    _state.value = UpdateState.Downloading(release, percent, downloaded, total)
                                }

                                DownloadManager.STATUS_PENDING -> {
                                    pendingTicks++
                                    if (pendingTicks > MAX_PENDING_WAIT_TICKS && downloaded == 0L) {
                                        downloading = false
                                        activeDownloadId = -1L
                                        try {
                                            downloadManager.remove(downloadId)
                                        } catch (_: Exception) {}
                                        _state.value = UpdateState.Error(
                                            "Android DownloadManager timed out waiting to start the download."
                                        )
                                        return@withContext
                                    }
                                    _state.value = UpdateState.Downloading(release, percent, downloaded, total)
                                }

                                DownloadManager.STATUS_RUNNING -> {
                                    pendingTicks = 0
                                    _state.value = UpdateState.Downloading(release, percent, downloaded, total)
                                }
                            }
                        } else {
                            pendingTicks++
                            if (pendingTicks > 40) {
                                downloading = false
                                activeDownloadId = -1L
                                _state.value = UpdateState.Error("Download was cancelled or removed from DownloadManager.")
                                return@withContext
                            }
                        }
                    } catch (e: Exception) {
                        downloading = false
                        activeDownloadId = -1L
                        _state.value = UpdateState.Error(
                            e.localizedMessage ?: "Error monitoring Android DownloadManager."
                        )
                        return@withContext
                    } finally {
                        cursor?.close()
                    }
                    if (downloading) delay(POLL_INTERVAL_MS)
                }

                if (!shouldRetryUniqueName) {
                    return@withContext
                }
            }
        }
    }

    private fun describeDownloadFailure(reason: Int): String {
        return when (reason) {
            DownloadManager.ERROR_INSUFFICIENT_SPACE ->
                "Not enough free space to save APK in 0/Download."
            DownloadManager.ERROR_FILE_ALREADY_EXISTS ->
                "An APK with the same name already exists in 0/Download."
            DownloadManager.ERROR_CANNOT_RESUME ->
                "DownloadManager could not resume the download. Please try again."
            DownloadManager.ERROR_TOO_MANY_REDIRECTS ->
                "Too many redirects while downloading APK via DownloadManager."
            DownloadManager.ERROR_DEVICE_NOT_FOUND ->
                "External storage (0/Download) is not available."
            DownloadManager.ERROR_HTTP_DATA_ERROR ->
                "Network data error while downloading APK via DownloadManager."
            DownloadManager.ERROR_UNHANDLED_HTTP_CODE ->
                "DownloadManager received an unexpected server response."
            in 400..599 ->
                "DownloadManager failed with HTTP $reason."
            else ->
                "Android DownloadManager failed to download APK (error $reason)."
        }
    }

    private fun describePausedTimeout(reason: Int): String {
        return when (reason) {
            DownloadManager.PAUSED_WAITING_FOR_NETWORK ->
                "DownloadManager is waiting for an active network connection."
            DownloadManager.PAUSED_QUEUED_FOR_WIFI ->
                "DownloadManager is waiting for Wi-Fi connection."
            else ->
                "DownloadManager paused too long while downloading APK (reason $reason)."
        }
    }

    private fun scanPublicDownloadFile(filePath: String) {
        try {
            MediaScannerConnection.scanFile(
                context,
                arrayOf(filePath),
                arrayOf("application/vnd.android.package-archive"),
                null
            )
        } catch (_: Exception) {}
    }

    fun retryInstallLastApk(): Boolean {
        val file = lastApkFile?.takeIf { it.exists() }
        val uri = lastApkUri
        if (file == null && uri == null) return false
        triggerApkInstall(file, uri)
        return true
    }

    fun resumePendingInstall() {
        val file = pendingInstallFile
        val uri = pendingInstallUri
        if (file == null && uri == null) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()) {
            pendingInstallFile = null
            pendingInstallUri = null
            launchInstallerIntent(file, uri)
        }
    }

    fun triggerApkInstall(apkFile: File?, apkUri: Uri? = null) {
        if ((apkFile == null || !apkFile.exists()) && apkUri == null) {
            _state.value = UpdateState.Error("Downloaded APK file not found.")
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            pendingInstallFile = null
            pendingInstallUri = null
            try {
                val downloadsIntent = Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(downloadsIntent)
            } catch (_: Exception) {
                _state.value = UpdateState.Error("Update downloaded to Downloads folder. Tap the APK there to install.")
            }
            return
        }
        pendingInstallFile = null
        pendingInstallUri = null
        launchInstallerIntent(apkFile, apkUri)
    }

    private fun launchInstallerIntent(apkFile: File?, apkUri: Uri?) {
        try {
            val installUri: Uri = when {
                Build.VERSION.SDK_INT < Build.VERSION_CODES.N && apkFile != null && apkFile.exists() ->
                    Uri.fromFile(apkFile)
                apkUri != null -> apkUri
                apkFile != null && apkFile.exists() -> FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    apkFile
                )
                else -> throw IllegalStateException("Downloaded APK file not found.")
            }

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(installUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
            }
            context.startActivity(installIntent)
        } catch (e: Exception) {
            if (apkUri != null && apkFile != null && apkFile.exists()) {
                try {
                    val fallbackUri = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
                        Uri.fromFile(apkFile)
                    } else {
                        FileProvider.getUriForFile(
                            context,
                            "${context.packageName}.fileprovider",
                            apkFile
                        )
                    }
                    val fallbackIntent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(fallbackUri, "application/vnd.android.package-archive")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
                    }
                    context.startActivity(fallbackIntent)
                    return
                } catch (_: Exception) {}
            }
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
