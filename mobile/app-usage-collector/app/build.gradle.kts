plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "local.telealien.appusage"
    compileSdk = 35
    defaultConfig { applicationId = "local.telealien.appusage"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "0.1.0" }
}
