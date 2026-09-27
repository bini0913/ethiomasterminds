package com.biniam.masterminds;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('nativeBackButton'));",
                null
            );
        } else {
            super.onBackPressed();
        }
    }
}
