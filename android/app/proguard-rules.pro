-keep class com.ag.musicplayer.updater.** { *; }
-keep class com.ag.musicplayer.data.** { *; }
-keep class com.ag.musicplayer.audio.** { *; }
-keep class com.ag.musicplayer.WebAppInterface { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*
-dontwarn org.json.**
