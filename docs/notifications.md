# Notification delivery configuration

Master Minds uses the existing Supabase project and Firebase Cloud Messaging project for notification delivery.

## Browser push

Configure these public web-app values in the Vercel project and local development environment:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

The Firebase values above and the VAPID public key are intended for browser use. Do not put Firebase service-account JSON, private keys, or Supabase service-role keys in any `VITE_*` variable.

The browser registers `/firebase-messaging-sw.js`, obtains an FCM token, and stores it through the authenticated `upsert_notification_device` RPC. Users must grant browser notification permission. If permission is denied or the web configuration is absent, the in-app inbox remains available but browser push cannot be registered.

## Server delivery

The existing Supabase Edge Function `send-push-notification` continues to use server-side `FCM_SERVICE_ACCOUNT_JSON` and Supabase service-role credentials. Keep these secrets configured in Supabase Edge Function secrets only. Never expose them to the web client.

## Verification boundary

A successful FCM API response means FCM accepted the message; it does not prove the operating system displayed it. Verify browser and Android display behavior with separate test accounts and real devices/browsers.
