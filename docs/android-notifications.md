# Master Minds Android notifications

## What is implemented

- Capacitor Android push notification registration.
- Android 13+ notification permission request.
- Persistent device-token registration in Supabase.
- Per-user notification preferences.
- Daily local learning reminder.
- Android notification channel.
- Notification tap routing through an app route.
- Native Android notification actions for friend-request Accept/Decline, Study Mode call Answer/Decline, and direct-message inline Reply.
- Supabase Edge Function `send-push-notification` for server-side FCM delivery.
- Authenticated `notification-action` Edge Function verifies the signed-in recipient and applies social actions server-side.
- Data-only FCM delivery so Android can render the native action buttons while the app is backgrounded or closed.
- Notification delivery event logging.

## Required Firebase setup for real push delivery

The Android app needs the Firebase configuration file from the Firebase project used for Master Minds:

`android/app/google-services.json`

Do not commit a service-account private key.

The Supabase Edge Function also needs the Firebase service-account JSON stored as a Supabase secret named:

`FCM_SERVICE_ACCOUNT_JSON`

The service account must have permission to send Firebase Cloud Messaging messages for the same Firebase project used by the Android app.

The Android application ID is:

`com.biniam.masterminds`

## Testing

Without Firebase configuration, the web build and local Android reminder layer can still build, but remote FCM push registration/delivery is not production-ready.

After adding the Firebase Android configuration and configuring the existing `FCM_SERVICE_ACCOUNT_JSON` Supabase secret, build and install a fresh APK on Android 13+; grant notification permission, then verify the device appears in `notification_devices`.

## Action behavior and verification

- Notification actions launch the app and are processed using the current Supabase user session; actions are rejected if the session is missing, the recipient does not match, or the request has already been handled.
- Accepting a call updates the participant invitation and opens Study Mode to join the room.
- Inline message replies are inserted into the existing `messages` table and sent through the same verified push-notification flow.
- Test with two separate accounts on physical Android devices (or one physical device and one emulator): send a friend request, send a message and reply from the shade, and place a Study Mode call. Repeat with the recipient app backgrounded and fully closed. Also verify declined/expired invitations cannot be reused.
- A native Android rebuild is required for notification-shade action buttons. Web/Windows builds do not provide Android notification actions.
