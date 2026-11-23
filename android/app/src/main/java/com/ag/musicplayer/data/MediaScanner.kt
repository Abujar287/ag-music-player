package com.ag.musicplayer.data

import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File

class MediaScanner(private val context: Context) {

    fun scanLocalAudio(settings: AppSettings): List<Track> {
        val tracks = mutableListOf<Track>()
        val projectionList = mutableListOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DISPLAY_NAME
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            projectionList.add(MediaStore.Audio.Media.RELATIVE_PATH)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            projectionList.add(MediaStore.Audio.Media.GENRE)
        }

        val selection = buildString {
            append("(${MediaStore.Audio.Media.IS_MUSIC} != 0 OR ")
            append("${MediaStore.Audio.Media.MIME_TYPE} LIKE 'audio/%' OR ")
            append("${MediaStore.Audio.Media.MIME_TYPE} = 'application/ogg')")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                append(" AND ${MediaStore.Audio.Media.IS_PENDING} = 0")
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                append(" AND ${MediaStore.Audio.Media.IS_TRASHED} = 0")
            }
        }
        val sortOrder = "${MediaStore.Audio.Media.TITLE} ASC"

        context.contentResolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            projectionList.toTypedArray(),
            selection,
            null,
            sortOrder
        )?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
            val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
            val albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
            val dataCol = cursor.getColumnIndex(MediaStore.Audio.Media.DATA)
            val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
            val displayNameCol = cursor.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME)
            val relPathCol = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                cursor.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH)
            } else -1
            val genreCol = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                cursor.getColumnIndex(MediaStore.Audio.Media.GENRE)
            } else -1

            while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                val durationMs = cursor.getLong(durationCol)
                val sizeBytes = cursor.getLong(sizeCol)
                if (sizeBytes <= 0L) continue

                val rawData = if (dataCol >= 0) cursor.getString(dataCol) else null
                val relPath = if (relPathCol >= 0) cursor.getString(relPathCol) else null
                val displayName = if (displayNameCol >= 0) cursor.getString(displayNameCol) else null

                val filePath = rawData ?: buildString {
                    append("/storage/emulated/0/")
                    append(relPath ?: "Music/")
                    append(displayName ?: "track_$id")
                }

                val folderPath = if (!rawData.isNullOrBlank()) {
                    File(rawData).parent ?: "/Music"
                } else if (!relPath.isNullOrBlank()) {
                    "/" + relPath.trimEnd('/')
                } else {
                    "/Music"
                }

                if (settings.filterShortClips) {
                    if (durationMs < settings.minDurationSec * 1000L || sizeBytes < settings.minSizeKb * 1024L) {
                        continue
                    }
                }
                if (settings.hiddenFolders.contains(folderPath)) continue

                val albumId = cursor.getLong(albumIdCol)
                val contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
                val albumArtUri = if (albumId > 0L) {
                    ContentUris.withAppendedId(
                        Uri.parse("content://media/external/audio/albumart"),
                        albumId
                    )
                } else null

                val rawTitle = cursor.getString(titleCol)?.takeIf { it.isNotBlank() }
                    ?: displayName?.substringBeforeLast('.')
                    ?: "Unknown Title"
                val rawArtist = cursor.getString(artistCol)?.takeIf { it.isNotBlank() && it != "<unknown>" }
                    ?: "Unknown Artist"
                val rawAlbum = cursor.getString(albumCol)?.takeIf { it.isNotBlank() && it != "<unknown>" }
                    ?: "Unknown Album"
                val rawGenre = if (genreCol >= 0) {
                    cursor.getString(genreCol)?.takeIf { it.isNotBlank() } ?: "Local Audio"
                } else {
                    "Local Audio"
                }

                tracks.add(
                    Track(
                        id = id,
                        title = rawTitle,
                        artist = rawArtist,
                        album = rawAlbum,
                        genre = rawGenre,
                        folderPath = folderPath,
                        filePath = filePath,
                        contentUri = contentUri,
                        albumArtUri = albumArtUri,
                        durationMs = durationMs,
                        sizeBytes = sizeBytes
                    )
                )
            }
        }
        return tracks
    }

    fun shareTrack(track: Track) {
        val file = File(track.filePath)
        val uri = if (file.exists()) {
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        } else {
            track.contentUri
        }
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "audio/*"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(Intent.createChooser(shareIntent, "Share ${track.title}"))
    }

    fun setAsRingtone(track: Track): Boolean {
        if (!Settings.System.canWrite(context)) {
            val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            return false
        }
        RingtoneManager.setActualDefaultRingtoneUri(
            context,
            RingtoneManager.TYPE_RINGTONE,
            track.contentUri
        )
        return true
    }
}
