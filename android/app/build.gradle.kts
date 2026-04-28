plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.hearthly.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.hearthly.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "1.1"
    }

    // The Node demo's public/ folder is used directly as the asset source —
    // no copy step, no drift between desktop and APK builds.
    sourceSets {
        getByName("main") {
            assets.srcDirs("src/main/assets", "../../public")
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            // ALL debug builds use the debug keystore that ships with the SDK,
            // so the APK installs without manual signing.
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug") // demo only
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
