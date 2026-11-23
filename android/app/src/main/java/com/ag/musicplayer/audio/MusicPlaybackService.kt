package com.ag.musicplayer.audio

import android.app.PendingIntent
import android.content.Intent
import android.media.audiofx.Equalizer
import android.media.audiofx.Virtualizer
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.ag.musicplayer.MainActivity

class MusicPlaybackService : MediaSessionService() {

    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    private var equalizer: Equalizer? = null
    private var virtualizer: Virtualizer? = null

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()

        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()

        val exoPlayer = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true) // Auto-pause on headset/Bluetooth disconnect
            .build()

        exoPlayer.addListener(object : Player.Listener {
            override fun onAudioSessionIdChanged(audioSessionId: Int) {
                if (audioSessionId != C.AUDIO_SESSION_ID_UNSET) {
                    initAudioEffects(audioSessionId)
                }
            }
        })

        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        mediaSession = MediaSession.Builder(this, exoPlayer)
            .setSessionActivity(pendingIntent)
            .build()

        player = exoPlayer
    }

    private fun initAudioEffects(audioSessionId: Int) {
        try {
            equalizer?.release()
            virtualizer?.release()
            equalizer = Equalizer(0, audioSessionId).apply { enabled = true }
            virtualizer = Virtualizer(0, audioSessionId).apply { enabled = true }
        } catch (_: Exception) {
            // Device hardware equalizer unavailable
        }
    }

    fun applyEqualizerBands(bandsMb: List<Int>, virtualizerStrength: Int) {
        equalizer?.let { eq ->
            val count = eq.numberOfBands.toInt()
            for (i in 0 until minOf(count, bandsMb.size)) {
                val range = eq.bandLevelRange
                val clamped = bandsMb[i].coerceIn(range[0].toInt(), range[1].toInt()).toShort()
                eq.setBandLevel(i.toShort(), clamped)
            }
        }
        virtualizer?.let { virt ->
            if (virt.strengthSupported) {
                virt.setStrength(virtualizerStrength.coerceIn(0, 1000).toShort())
            }
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val currentPlayer = mediaSession?.player
        if (currentPlayer == null || !currentPlayer.playWhenReady || currentPlayer.mediaItemCount == 0) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        equalizer?.release()
        virtualizer?.release()
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }
}
