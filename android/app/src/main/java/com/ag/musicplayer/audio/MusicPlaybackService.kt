package com.ag.musicplayer.audio

import android.app.PendingIntent
import android.content.Intent
import android.media.audiofx.Equalizer
import android.media.audiofx.Virtualizer
import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.ag.musicplayer.MainActivity
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

class MusicPlaybackService : MediaSessionService() {

    companion object {
        const val CMD_APPLY_EQ = "com.ag.musicplayer.APPLY_EQ"
        const val EXTRA_EQ_ENABLED = "eq_enabled"
        const val EXTRA_EQ_BANDS_MB = "eq_bands_mb"
        const val EXTRA_VIRTUALIZER = "eq_virtualizer"
    }

    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    private var equalizer: Equalizer? = null
    private var virtualizer: Virtualizer? = null

    private var eqEnabled: Boolean = true
    private var eqBandsMb: IntArray = intArrayOf(0, 0, 0, 0, 0)
    private var virtualizerStrength: Int = 350

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

        val callback = object : MediaSession.Callback {
            override fun onConnect(
                session: MediaSession,
                controller: MediaSession.ControllerInfo
            ): MediaSession.ConnectionResult {
                val sessionCommands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
                    .add(SessionCommand(CMD_APPLY_EQ, Bundle.EMPTY))
                    .build()
                return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                    .setAvailableSessionCommands(sessionCommands)
                    .build()
            }

            override fun onCustomCommand(
                session: MediaSession,
                controller: MediaSession.ControllerInfo,
                customCommand: SessionCommand,
                args: Bundle
            ): ListenableFuture<SessionResult> {
                if (customCommand.customAction == CMD_APPLY_EQ) {
                    eqEnabled = args.getBoolean(EXTRA_EQ_ENABLED, true)
                    eqBandsMb = args.getIntArray(EXTRA_EQ_BANDS_MB) ?: intArrayOf(0, 0, 0, 0, 0)
                    virtualizerStrength = args.getInt(EXTRA_VIRTUALIZER, 350)
                    applyCurrentEffects()
                }
                return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
            }
        }

        mediaSession = MediaSession.Builder(this, exoPlayer)
            .setSessionActivity(pendingIntent)
            .setCallback(callback)
            .build()

        player = exoPlayer
    }

    private fun initAudioEffects(audioSessionId: Int) {
        try {
            equalizer?.release()
            virtualizer?.release()
            equalizer = Equalizer(0, audioSessionId)
            virtualizer = Virtualizer(0, audioSessionId)
            applyCurrentEffects()
        } catch (_: Exception) {
            // Device hardware equalizer unavailable
        }
    }

    private fun applyCurrentEffects() {
        try {
            equalizer?.let { eq ->
                eq.enabled = eqEnabled
                val count = eq.numberOfBands.toInt()
                val range = eq.bandLevelRange
                for (i in 0 until minOf(count, eqBandsMb.size)) {
                    val clamped = eqBandsMb[i].coerceIn(range[0].toInt(), range[1].toInt()).toShort()
                    eq.setBandLevel(i.toShort(), clamped)
                }
            }
            virtualizer?.let { virt ->
                virt.enabled = eqEnabled && virtualizerStrength > 0
                if (virt.strengthSupported) {
                    virt.setStrength(virtualizerStrength.coerceIn(0, 1000).toShort())
                }
            }
        } catch (_: Exception) {
            // Ignore effect errors on unsupported devices
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
