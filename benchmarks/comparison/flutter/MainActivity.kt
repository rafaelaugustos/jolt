package dev.jolt.comparison.jolt_comparison

import android.os.SystemClock
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "dev.jolt.comparison")
            .setMethodCallHandler { call, result ->
                if (call.method == "blockUi") {
                    // No task queue: this handler runs on the Android main thread.
                    val deadline = SystemClock.elapsedRealtimeNanos() + 300_000_000L
                    while (SystemClock.elapsedRealtimeNanos() < deadline) { }
                    result.success(null)
                } else result.notImplemented()
            }
    }
}
