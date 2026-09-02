package local.telealien.appusage

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Notification
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.IBinder
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import kotlin.concurrent.thread

class UsageMonitorService : Service() {
    @Volatile private var running = false
    private var lastEventTime = 0L
    private var lastPackage = ""

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createChannel()
        startForeground(1, Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_recent_history).setContentTitle("TeleAlien activity monitor").setContentText("Recording foreground app changes locally").setOngoing(true).build())
        if (!running) { running = true; thread(name = "telealien-usage-monitor") { monitor() } }
        return START_STICKY
    }

    override fun onDestroy() { running = false; super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null

    private fun monitor() {
        while (running) {
            latestForegroundEvent()?.let { (packageName, timestamp) ->
                if (packageName != this@UsageMonitorService.packageName && (packageName != lastPackage || timestamp > lastEventTime)) {
                    lastPackage = packageName; lastEventTime = timestamp; postActivity(packageName, timestamp)
                }
            }
            Thread.sleep(15_000)
        }
    }

    private fun latestForegroundEvent(): Pair<String, Long>? {
        val manager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val events = manager.queryEvents(System.currentTimeMillis() - 90_000, System.currentTimeMillis())
        val event = UsageEvents.Event(); var latest: Pair<String, Long>? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND && event.packageName != this.packageName) latest = event.packageName to event.timeStamp
        }
        return latest
    }

    private fun postActivity(packageName: String, timestamp: Long) {
        val token = getSharedPreferences("settings", MODE_PRIVATE).getString("activity_token", "") ?: ""
        if (token.isBlank()) return
        try {
            val connection = URL("http://127.0.0.1:4319/activity").openConnection() as HttpURLConnection
            connection.requestMethod = "POST"; connection.setRequestProperty("Authorization", "Bearer $token"); connection.setRequestProperty("Content-Type", "application/json"); connection.doOutput = true
            connection.connectTimeout = 5_000; connection.readTimeout = 5_000
            connection.outputStream.bufferedWriter().use { it.write("{\"packageName\":\"${json(packageName)}\",\"appName\":\"${json(appLabel(packageName))}\",\"at\":\"${Instant.ofEpochMilli(timestamp)}\"}") }
            connection.inputStream.close(); connection.disconnect()
        } catch (_: Exception) { }
    }

    private fun json(value: String) = value.replace("\\", "\\\\").replace("\"", "\\\"")
    private fun appLabel(packageName: String): String = try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(packageName, 0)).toString() } catch (_: Exception) { packageName }
    private fun createChannel() { (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(NotificationChannel(CHANNEL, "TeleAlien activity monitoring", NotificationManager.IMPORTANCE_LOW)) }
    companion object { const val CHANNEL = "telealien_activity" }
}
