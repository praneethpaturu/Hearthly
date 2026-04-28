package com.hearthly.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.*
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebViewAssetLoader

/**
 * Standalone WebView host: loads the Hearthly web app from APK assets,
 * served through WebViewAssetLoader as https://appassets.androidplatform.net/
 * so localStorage, IndexedDB, and other origin-restricted APIs work cleanly.
 *
 * No backend, no network — every state mutation runs in JS inside the WebView.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var refresh: SwipeRefreshLayout
    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.web)
        refresh = findViewById(R.id.refresh)
        refresh.setOnRefreshListener { web.reload() }
        // Only allow pull-to-refresh when scrolled to the top — otherwise
        // pulling down inside scrollable content would keep firing the
        // refresh loader (the bug the user reported).
        web.viewTreeObserver.addOnScrollChangedListener {
            refresh.isEnabled = web.scrollY == 0
        }
        refresh.setColorSchemeColors(0xFF6366F1.toInt(), 0xFFF59E0B.toInt(), 0xFF14B8A6.toInt())

        // Runtime location permission — needed for the WebView geolocation
        // bridge to actually return coordinates.
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                100
            )
        }

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = "$userAgentString HearthlyApp/1.1"
        }

        WebView.setWebContentsDebuggingEnabled(true)

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(req.url)

            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val url = req.url.toString()
                val host = req.url.host ?: return false
                if (host == "appassets.androidplatform.net") return false
                openExternal(url)
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                refresh.isRefreshing = false
            }

            override fun onReceivedError(
                view: WebView, req: WebResourceRequest, err: WebResourceError
            ) {
                refresh.isRefreshing = false
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(req: PermissionRequest) { req.grant(req.resources) }
            override fun onGeolocationPermissionsShowPrompt(
                origin: String, callback: GeolocationPermissions.Callback
            ) {
                // Grant immediately — the OS-level permission was requested in onCreate;
                // if the user denied it, getCurrentPosition will still error gracefully.
                callback.invoke(origin, true, false)
            }
        }

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        else web.loadUrl("https://appassets.androidplatform.net/login.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack()
                else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        })
    }

    private fun openExternal(url: String) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }
}
