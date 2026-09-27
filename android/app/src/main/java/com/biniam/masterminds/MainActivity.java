package com.biniam.masterminds;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) {
                    finish();
                    return;
                }

                String url = webView.getUrl();
                String path = url == null ? "/" : Uri.parse(url).getPath();
                boolean atHome = path == null || path.isEmpty() || "/".equals(path);

                if (!atHome) {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('nativeBackButton'));",
                        null
                    );
                } else {
                    finish();
                }
            }
        });
    }
}
