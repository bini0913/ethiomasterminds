package com.biniam.masterminds;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class MasterMindsMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "master_minds_default";
    private static final String REPLY_KEY = "master_minds_inline_reply";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> data = message.getData();
        String kind = data.get("kind");
        String title = message.getNotification() != null ? message.getNotification().getTitle() : data.get("title");
        String body = message.getNotification() != null ? message.getNotification().getBody() : data.get("body");
        if (title == null || title.trim().isEmpty()) title = "Master Minds";
        if (body == null) body = "";

        ensureChannel();
        int notificationId = (data.get("message_id") != null ? data.get("message_id")
                : data.get("request_id") != null ? data.get("request_id")
                : data.get("room_id") != null ? data.get("room_id") : String.valueOf(System.currentTimeMillis())).hashCode();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getResources().getIdentifier("ic_stat_master_minds", "drawable", getPackageName()) != 0
                        ? getResources().getIdentifier("ic_stat_master_minds", "drawable", getPackageName())
                        : getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setColor(Color.rgb(16, 185, 129))
                .setContentIntent(actionIntent(data, "open", false));

        if ("friend_request".equals(kind) && data.get("request_id") != null) {
            builder.addAction(0, "Accept", actionIntent(data, "friend_accept", false));
            builder.addAction(0, "Decline", actionIntent(data, "friend_decline", false));
        } else if ("study_call_invite".equals(kind) && data.get("room_id") != null) {
            builder.setCategory(NotificationCompat.CATEGORY_CALL)
                    .addAction(0, "Answer", actionIntent(data, "call_accept", false))
                    .addAction(0, "Decline", actionIntent(data, "call_decline", false));
        } else if ("direct_message".equals(kind) && data.get("message_id") != null) {
            Intent replyIntent = actionIntent(data, "message_reply", true).getIntentSender() == null
                    ? new Intent(this, MainActivity.class) : new Intent(this, MainActivity.class);
            fillActionIntent(replyIntent, data, "message_reply");
            PendingIntent replyPending = PendingIntent.getActivity(this, requestCode(data, "message_reply"), replyIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            RemoteInput remoteInput = new RemoteInput.Builder(REPLY_KEY).setLabel("Reply to your friend").build();
            builder.addAction(new NotificationCompat.Action.Builder(0, "Reply", replyPending)
                    .addRemoteInput(remoteInput)
                    .setAllowGeneratedReplies(true)
                    .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
                    .build());
        }

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(notificationId, builder.build());
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Master Minds",
                        NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Learning reminders and social notifications");
                manager.createNotificationChannel(channel);
            }
        }
    }

    private PendingIntent actionIntent(Map<String, String> data, String action, boolean mutable) {
        Intent intent = new Intent(this, MainActivity.class);
        fillActionIntent(intent, data, action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (mutable ? PendingIntent.FLAG_MUTABLE : PendingIntent.FLAG_IMMUTABLE);
        return PendingIntent.getActivity(this, requestCode(data, action), intent, flags);
    }

    private void fillActionIntent(Intent intent, Map<String, String> data, String action) {
        intent.setAction("com.biniam.masterminds.NOTIFICATION_ACTION." + action + "." + System.currentTimeMillis());
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("mm_notification_action", action);
        intent.putExtra("mm_notification_kind", data.get("kind"));
        intent.putExtra("mm_notification_route", data.get("route"));
        intent.putExtra("mm_request_id", data.get("request_id"));
        intent.putExtra("mm_message_id", data.get("message_id"));
        intent.putExtra("mm_room_id", data.get("room_id"));
    }

    private int requestCode(Map<String, String> data, String action) {
        String key = data.get("message_id") != null ? data.get("message_id")
                : data.get("request_id") != null ? data.get("request_id") : data.get("room_id");
        return ((key == null ? "master-minds" : key) + ":" + action).hashCode();
    }

    @Override
    public void onNewToken(String token) {
        // Capacitor's registration flow obtains the token on sign-in and stores it in Supabase.
        // Do not log tokens or credentials here.
        super.onNewToken(token);
    }

    public static Bundle remoteInputResults(Intent intent) {
        return RemoteInput.getResultsFromIntent(intent);
    }

    public static String replyKey() { return REPLY_KEY; }
}
