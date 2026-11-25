package com.ag.musicplayer.data

import android.net.Uri

data class Track(
    val id: Long,
    val title: String,
    val artist: String,
    val album: String,
    val genre: String,
    val folderPath: String,
    val folder: String = folderPath,
    val mediaType: String = "audio",
    val filePath: String,
    val contentUri: Uri,
    val albumArtUri: Uri?,
    val durationMs: Long,
    val sizeBytes: Long,
    val dateAddedMs: Long = 0L,
    val isFavorite: Boolean = false
)

data class Playlist(
    val id: String,
    val name: String,
    val trackIds: List<Long> = emptyList(),
    val createdAt: Long = System.currentTimeMillis()
)

enum class RepeatMode {
    OFF, ONE, ALL
}

enum class EqPreset(val label: String, val bandsMb: List<Int>) {
    NORMAL("Normal", listOf(0, 0, 0, 0, 0)),
    BASS_BOOST("Bass Boost", listOf(600, 350, 0, 100, 200)),
    ROCK("Rock", listOf(450, 200, -150, 300, 450)),
    POP("Pop", listOf(-100, 250, 400, 200, -100)),
    CLASSICAL("Classical", listOf(350, 200, -100, 250, 350)),
    CUSTOM("Custom", listOf(0, 0, 0, 0, 0))
}

data class AppSettings(
    val isDarkMode: Boolean = true,
    val accentHex: Long = 0xFFD4AF37,
    val autoSyncPermission: Boolean = true,
    val filterShortClips: Boolean = true,
    val minDurationSec: Int = 30,
    val minSizeKb: Int = 500,
    val hiddenFolders: Set<String> = emptySet(),
    val gaplessPlayback: Boolean = true,
    val crossfadeSeconds: Int = 3,
    val fadeOnPause: Boolean = true,
    val headsetAutoPlay: Boolean = true,
    val headsetAutoPause: Boolean = true,
    val lockScreenArt: Boolean = true,
    val notificationControls: Boolean = true
)
