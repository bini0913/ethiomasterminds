package com.biniam.masterminds;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String REPLY_KEY = "master_minds_inline_reply";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null) { finish(); return; }
                String url = webView.getUrl();
                String path = url == null ? "/" : UriPath.path(url);
                boolean atHome = path == null || path.isEmpty() || "/".equals(path);
                if (!atHome) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('nativeBackButton'));", null);
                else finish();
            }
        });
        dispatchNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchNotificationIntent(intent);
    }

    private void dispatchNotificationIntent(@Nullable Intent intent) {
        if (intent == null || !intent.hasExtra("mm_notification_action")) return;
        String action = intent.getStringExtra("mm_notification_action");
        String kind = intent.getStringExtra("mm_notification_kind");
        String route = intent.getStringExtra("mm_notification_route");
        String requestId = intent.getStringExtra("mm_request_id");
        String messageId = intent.getStringExtra("mm_message_id");
        String roomId = intent.getStringExtra("mm_room_id");
        Bundle results = MasterMindsMessagingService.remoteInputResults(intent);
        String reply = results == null ? null : results.getCharSequence(REPLY_KEY) == null ? null
                : results.getCharSequence(REPLY_KEY).toString();

        try {
            JSONObject payload = new JSONObject();
            payload.put("actionId", action + ":" + (requestId != null ? requestId : messageId != null ? messageId : roomId) + ":" + System.currentTimeMillis());
            payload.put("action", action);
            if (kind != null) payload.put("kind", kind);
            if (route != null) payload.put("route", route);
            if (requestId != null) payload.put("request_id", requestId);
            if (messageId != null) payload.put("message_id", messageId);
            if (roomId != null) payload.put("room_id", roomId);
            if (reply != null) payload.put("reply", reply);
            final String scriptPayload = payload.toString();

            // A notification action can cold-start the activity before Capacitor has
            // attached its Bridge/WebView. Keep retrying until the bridge and the
            // React notification handler are ready instead of silently dropping it.
            final Handler mainHandler = new Handler(Looper.getMainLooper());
            mainHandler.postDelayed(new Runnable() {
                int attempts = 0;

                private void retry() {
                    if (attempts++ < 30) mainHandler.postDelayed(this, 400);
                }

                @Override
                public void run() {
                    WebView webView = getBridge() == null ? null : getBridge().getWebView();
                    if (webView == null) {
                        retry();
                        return;
                    }
                    webView.evaluateJavascript(
                        "(function(){if(typeof window.__handleMasterMindsNotificationAction==='function'){window.__handleMasterMindsNotificationAction(" +
                        JSONObject.quote(scriptPayload) + ");return true;}return false;})()",
                        value -> {
                            if (!"true".equals(value)) retry();
                        });
                }
            }, 700);
        } catch (Exception ignored) {
            // Never log notification reply text or user identifiers.
        }
        intent.removeExtra("mm_notification_action");
    }
}
class UriPath {
    static String path(String url) {
        try { return android.net.Uri.parse(url).getPath(); }
        catch (Exception ignored) { return "/"; }
    }
}
