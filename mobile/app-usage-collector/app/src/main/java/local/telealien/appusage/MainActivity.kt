package local.telealien.appusage

import android.Manifest
import android.app.Activity
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Process
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val status = TextView(this)
        val tokenInput = EditText(this).apply { hint = "TeleAlien activity token"; setText(getSharedPreferences("settings", MODE_PRIVATE).getString("activity_token", "")) }
        val grantUsage = Button(this).apply { text = "Open Usage Access settings" }
        val start = Button(this).apply { text = "Start monitoring" }
        val stop = Button(this).apply { text = "Stop monitoring" }
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(48, 48, 48, 48); addView(status); addView(tokenInput); addView(grantUsage); addView(start); addView(stop) }
        setContentView(layout)

        fun refresh() { status.text = if (hasUsageAccess()) "Usage Access: granted" else "Usage Access: required" }
        refresh()
        grantUsage.setOnClickListener { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)) }
        start.setOnClickListener {
            if (!hasUsageAccess()) { startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)); return@setOnClickListener }
            val token = tokenInput.text.toString().trim()
            if (token.isBlank()) { status.text = "Activity token is required"; return@setOnClickListener }
            getSharedPreferences("settings", MODE_PRIVATE).edit().putString("activity_token", token).apply()
            if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
            }
            startForegroundService(Intent(this, UsageMonitorService::class.java))
        }
        stop.setOnClickListener { stopService(Intent(this, UsageMonitorService::class.java)) }
    }

    private fun hasUsageAccess(): Boolean {
        val manager = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        return manager.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName) == AppOpsManager.MODE_ALLOWED
    }
}
