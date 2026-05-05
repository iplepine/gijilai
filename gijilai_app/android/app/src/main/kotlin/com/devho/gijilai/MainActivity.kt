package com.devho.gijilai

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognizerIntent
import androidx.activity.enableEdgeToEdge
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    companion object {
        private const val PERMISSIONS_CHANNEL = "com.devho.gijilai/permissions"
        private const val MICROPHONE_PERMISSION_REQUEST_CODE = 9401
        private const val VOICE_INPUT_REQUEST_CODE = 9402
    }

    private var microphonePermissionResult: MethodChannel.Result? = null
    private var voiceInputResult: MethodChannel.Result? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            PERMISSIONS_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "requestMicrophone" -> requestMicrophonePermission(result)
                "startVoiceInput" -> startVoiceInput(call.argument<String>("languageTag"), result)
                else -> result.notImplemented()
            }
        }
    }

    private fun requestMicrophonePermission(result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        ) {
            result.success(true)
            return
        }

        if (microphonePermissionResult != null) {
            result.error(
                "permission_request_in_progress",
                "A microphone permission request is already active.",
                null,
            )
            return
        }

        microphonePermissionResult = result
        requestPermissions(
            arrayOf(Manifest.permission.RECORD_AUDIO),
            MICROPHONE_PERMISSION_REQUEST_CODE,
        )
    }

    private fun startVoiceInput(languageTag: String?, result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
        ) {
            result.error(
                "microphone_permission_denied",
                "Microphone permission has not been granted.",
                null,
            )
            return
        }

        if (voiceInputResult != null) {
            result.error(
                "voice_input_in_progress",
                "A voice input request is already active.",
                null,
            )
            return
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag ?: "ko-KR")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        voiceInputResult = result
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, VOICE_INPUT_REQUEST_CODE)
        } catch (_: ActivityNotFoundException) {
            voiceInputResult = null
            result.error(
                "speech_recognizer_unavailable",
                "No speech recognizer is available on this device.",
                null,
            )
        } catch (e: Exception) {
            voiceInputResult = null
            result.error("voice_input_failed", e.message, null)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        if (requestCode == MICROPHONE_PERMISSION_REQUEST_CODE) {
            val granted = grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED
            microphonePermissionResult?.success(granted)
            microphonePermissionResult = null
            return
        }

        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    }

    @Deprecated("Deprecated in Android API, retained for Flutter embedding compatibility.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == VOICE_INPUT_REQUEST_CODE) {
            val pendingResult = voiceInputResult
            voiceInputResult = null

            if (pendingResult == null) return

            if (resultCode == Activity.RESULT_OK) {
                val transcript = data
                    ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                    ?.firstOrNull()
                    .orEmpty()
                pendingResult.success(
                    mapOf(
                        "status" to "ok",
                        "transcript" to transcript,
                    ),
                )
            } else {
                pendingResult.success(mapOf("status" to "cancelled"))
            }
            return
        }

        super.onActivityResult(requestCode, resultCode, data)
    }
}
