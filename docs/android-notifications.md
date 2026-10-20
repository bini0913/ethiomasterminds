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
- Supabase Edge Function send-push-notification for server-side FCM delivery.
- Authenticated notification-action Edge Function verifies the signed-in recipient and applies social actions server-side.
- Data-only FCM delivery so Android can render the native action buttons while the app is backgrounded or closed.
- Notification delivery event logging.

## Android runtime permission behavior

| Capability | How the permission is requested | Expected behavior |
| --- | --- | --- |
| Push and local notifications | src/lib/notifications.ts calls Capacitor Push Notifications and Local Notifications permission APIs after the user is authenticated and notifications are enabled. | Android 13+ displays the system notification permission prompt. If denied, push registration must not be treated as successful. |
| Camera for Study Mode | Capacitor's Android BridgeWebChromeClient handles WebView VIDEO_CAPTURE requests and asks Android for CAMERA. | Prompt only when a page actually requests camera access; the web app must also request camera access and handle denial/device-not-found states. |
| Microphone for Study Mode | Capacitor's BridgeWebChromeClient handles WebView AUDIO_CAPTURE requests and asks for RECORD_AUDIO and MODIFY_AUDIO_SETTINGS. | Prompt when audio capture is requested; denial should leave the rest of the app usable. |
| Photo/file selection | Capacitor's WebView file chooser launches Android's system picker. Camera capture is handled separately when the page explicitly requests capture. | Use the picker-granted URI; do not request broad photo/video library access just to select a file. |
| Location | Capacitor's WebView geolocation handler can request coarse/fine location if a page invokes browser geolocation. | Only invoke this from a user-visible feature that genuinely needs location. |
| Contacts | The manifest declaration alone does not prompt for or grant contacts access. | No contacts runtime prompt is wired because no current contacts feature was found in this permission audit. Add a feature-specific flow before using contacts. |
| Vibration | Declared as a normal Android permission. | No runtime dialog is required. |

Do not replace Capacitor's BridgeWebChromeClient with a custom WebChromeClient in MainActivity: it already handles WebView media, file chooser, and geolocation permission callbacks. Replacing it could break file uploads, camera capture, or other WebView behavior.

The manifest intentionally omits READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, and READ_MEDIA_VISUAL_USER_SELECTED; the standard system picker is the preferred path for selecting files. Add media-library permissions only if a specific feature must browse the user's entire library and has a matching runtime flow.

## Required Firebase setup for real push delivery

The Android app needs the Firebase configuration file from the Firebase project used for Master Minds:

android/app/google-services.json

Do not commit a service-account private key.

The Supabase Edge Function also needs the Firebase service-account JSON stored as a Supabase secret named:

FCM_SERVICE_ACCOUNT_JSON

The service account must have permission to send Firebase Cloud Messaging messages for the same Firebase project used by the Android app.

The Android application ID is:

com.biniam.masterminds

## Testing

Without Firebase configuration, the web build and local Android reminder layer can still build, but remote FCM push registration/delivery is not production-ready.

After adding the Firebase Android configuration and configuring the existing FCM_SERVICE_ACCOUNT_JSON Supabase secret, build and install a fresh APK on Android 13+; grant notification permission, then verify the device appears in notification_devices.

## Runtime permission test checklist

Run these checks on a real Android device after installing the new APK. CI compilation alone cannot verify OS permission dialogs or camera hardware.

1. Fresh install on Android 13+: sign in, keep notifications enabled, confirm the notification prompt appears, grant it, and verify a device token is registered.
2. Deny notifications: verify the app remains usable and no successful push registration is reported. Then enable notifications in Android system settings and retry registration from the app.
3. Study Mode: start a call and confirm camera and microphone prompts appear only when requested; grant both and verify local preview/audio, then repeat with each permission denied.
4. File upload/avatar selection: open the system picker, select a file, and verify the app can read the selected URI without a broad media-library permission prompt.
5. Location: verify no location prompt appears during ordinary navigation; only test the prompt if a real feature explicitly requests geolocation.
6. Notifications while backgrounded/closed: send a friend request, a message, and a Study Mode call; test Accept/Decline/Reply actions with two accounts and confirm each action is processed only once.

## Action behavior and verification

- Notification actions launch the app and are processed using the current Supabase user session; actions are rejected if the session is missing, the recipient does not match, or the request has already been handled.
- Accepting a call updates the participant invitation and opens Study Mode to join the room.
- Inline message replies are inserted into the existing messages table and sent through the same verified push-notification flow.
- Test with two separate accounts on physical Android devices (or one physical device and one emulator): send a friend request, send a message and reply from the shade, and place a Study Mode call. Repeat with the recipient app backgrounded and fully closed. Also verify declined/expired invitations cannot be reused.
- A native Android rebuild is required for notification-shade action buttons. Web/Windows builds do not provide Android notification actions.
