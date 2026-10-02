# Master Minds Android notifications

## What is implemented

- Capacitor Android push notification registration.
- Android 13+ notification permission request.
- Persistent device-token registration in Supabase.
- Per-user notification preferences.
- Daily local learning reminder.
- Android notification channel.
- Notification tap routing through an app route.
- Supabase Edge Function `send-push-notification` for server-side FCM delivery.
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

After adding the Firebase Android configuration, build the APK and install it on Android 13+; grant notifications when prompted, then verify the device appears in `notification_devices`.
