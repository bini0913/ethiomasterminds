import { db } from "@/integrations/untypedClient";
import { safeStorage } from "@/lib/safeStorage";
import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/integrations/supabase/client";

const PREF_KEY = "master_minds_notification_preferences_v1";
const DAILY_REMINDER_ID = 7101;

export type NotificationPreferences = {
  enabled: boolean;
  dailyReminders: boolean;
  achievements: boolean;
  social: boolean;
  gameInvites: boolean;
  newContent: boolean;
  streaks: boolean;
  studyReminders: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  reminderHour: number;
};

export type LearningReminderContext = {
  displayName?: string | null;
  streakDays?: number;
  weakSubject?: string | null;
  minutesToStudy?: number;
  lastStudiedAt?: string | null;
};

const defaults: NotificationPreferences = {
  enabled: true,
  dailyReminders: true,
  achievements: true,
  social: true,
  gameInvites: true,
  newContent: true,
  streaks: true,
  studyReminders: true,
  quietHoursEnabled: false,
  quietStart: "21:00",
  quietEnd: "07:00",
  reminderHour: 18,
};

const isNative = () => Capacitor.isNativePlatform();
const isAndroid = () => Capacitor.getPlatform() === "android";

function normalizePreferences(value: Partial<NotificationPreferences> | null | undefined): NotificationPreferences {
  const merged = { ...defaults, ...(value ?? {}) };
  merged.reminderHour = Number.isFinite(Number(merged.reminderHour))
    ? Math.min(23, Math.max(0, Math.round(Number(merged.reminderHour))))
    : defaults.reminderHour;
  merged.quietStart = /^([01]\d|2[0-3]):[0-5]\d$/.test(merged.quietStart) ? merged.quietStart : defaults.quietStart;
  merged.quietEnd = /^([01]\d|2[0-3]):[0-5]\d$/.test(merged.quietEnd) ? merged.quietEnd : defaults.quietEnd;
  return merged;
}

export function getStoredNotificationPreferences(): NotificationPreferences {
  try {
    const raw = safeStorage.getItem(PREF_KEY);
    return normalizePreferences(raw ? JSON.parse(raw) : defaults);
  } catch {
    return defaults;
  }
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await db
    .from("notification_preferences" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("Could not load notification preferences.");
  const mapped = normalizePreferences(data ? {
    enabled: data.enabled,
    dailyReminders: data.daily_reminders,
    achievements: data.achievements,
    social: data.social,
    gameInvites: data.game_invites,
    newContent: data.new_content,
    streaks: data.streaks,
    studyReminders: data.study_reminders,
    quietHoursEnabled: data.quiet_hours_enabled,
    quietStart: String(data.quiet_start ?? defaults.quietStart).slice(0, 5),
    quietEnd: String(data.quiet_end ?? defaults.quietEnd).slice(0, 5),
    reminderHour: data.reminder_hour,
  } : defaults);

  safeStorage.setItem(PREF_KEY, JSON.stringify(mapped));
  return mapped;
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
): Promise<void> {
  const safe = normalizePreferences(preferences);
  const { error } = await db.from("notification_preferences" as any).upsert({
    user_id: userId,
    enabled: safe.enabled,
    daily_reminders: safe.dailyReminders,
    achievements: safe.achievements,
    social: safe.social,
    game_invites: safe.gameInvites,
    new_content: safe.newContent,
    streaks: safe.streaks,
    study_reminders: safe.studyReminders,
    quiet_hours_enabled: safe.quietHoursEnabled,
    quiet_start: safe.quietStart,
    quiet_end: safe.quietEnd,
    reminder_hour: safe.reminderHour,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Your notification settings could not be saved. Please try again.");

  // Update local state only after the server confirms persistence.
  safeStorage.setItem(PREF_KEY, JSON.stringify(safe));
  await scheduleDailyLearningReminder(safe);
}

export async function ensureNotificationChannel(): Promise<void> {
  if (!isAndroid()) return;
  await LocalNotifications.createChannel({
    id: "master_minds_default",
    name: "Master Minds",
    description: "Learning reminders, achievements and social updates",
    importance: 4,
    visibility: 1,
    sound: "default",
    vibration: true,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const current = await PushNotifications.checkPermissions();
  if (current.receive !== "granted") {
    const requested = await PushNotifications.requestPermissions();
    if (requested.receive !== "granted") return false;
  }

  if (isAndroid()) {
    const local = await LocalNotifications.checkPermissions();
    if (local.display !== "granted") {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== "granted") return false;
    }
  }
  return true;
}

declare global {
  interface Window {
    firebase?: any;
    __masterMindsWebPushMessageListener?: boolean;
  }
}

const firebaseWebConfig = () => {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  const vapidKey = env.VITE_FIREBASE_VAPID_KEY;
  return Object.values(config).every(Boolean) && vapidKey ? { config, vapidKey } : null;
};

async function loadFirebaseCompatScript(fileName: string): Promise<void> {
  const id = `master-minds-${fileName.replace(/[^a-z0-9]/gi, "-")}`;
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === "true") return;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Firebase web SDK failed to load")), { once: true });
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = `https://www.gstatic.com/firebasejs/10.14.1/${fileName}`;
    script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error("Firebase web SDK failed to load"));
    document.head.appendChild(script);
  });
}

async function registerWebPushNotifications(requestPermission: boolean): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return false;
  const firebaseSetup = firebaseWebConfig();
  if (!firebaseSetup) {
    console.warn("Web push is not configured: Firebase web app values and the VAPID public key are required.");
    return false;
  }

  let permission = Notification.permission;
  if (permission === "default" && requestPermission) permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  try {
    await loadFirebaseCompatScript("firebase-app-compat.js");
    await loadFirebaseCompatScript("firebase-messaging-compat.js");
    const firebase = window.firebase;
    if (!firebase?.messaging) return false;
    if (firebase.apps.length === 0) firebase.initializeApp(firebaseSetup.config);
    if (firebase.messaging.isSupported && !(await firebase.messaging.isSupported())) return false;

    const workerUrl = new URL("/firebase-messaging-sw.js", window.location.origin);
    Object.entries(firebaseSetup.config).forEach(([key, value]) => {
      if (value) workerUrl.searchParams.set(key, value);
    });
    const serviceWorkerRegistration = await navigator.serviceWorker.register(workerUrl.toString(), { scope: "/" });
    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: firebaseSetup.vapidKey,
      serviceWorkerRegistration,
    });
    if (!token) return false;

    const { error } = await db.rpc("upsert_notification_device" as any, {
      p_token: token,
      p_platform: "web",
      p_app_version: "web",
      p_enabled: true,
    });
    if (error) throw error;

    if (!window.__masterMindsWebPushMessageListener) {
      messaging.onMessage((payload: unknown) => {
        window.dispatchEvent(new CustomEvent("master-minds-notification", { detail: payload }));
      });
      window.__masterMindsWebPushMessageListener = true;
    }
    return true;
  } catch (error) {
    console.warn("Web push registration could not finish:", error);
    return false;
  }
}

// Keep delivery/action listeners for the lifetime of the app. The registration
// event is short-lived, but pushNotificationReceived and
// pushNotificationActionPerformed must remain attached after a token is saved.
let nativePushEventListenersReady: Promise<void> | null = null;
let nativeRegistrationInFlight: Promise<boolean> | null = null;

async function ensureNativePushEventListeners(): Promise<void> {
  if (!nativePushEventListenersReady) {
    nativePushEventListenersReady = (async () => {
      await PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
        window.dispatchEvent(new CustomEvent("master-minds-notification", { detail: notification }));
      });
      await PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
        const route = typeof action.notification.data?.route === "string" ? action.notification.data.route : null;
        if (route) window.dispatchEvent(new CustomEvent("master-minds-notification-route", { detail: route }));
      });
    })().catch((error) => {
      nativePushEventListenersReady = null;
      throw error;
    });
  }
  await nativePushEventListenersReady;
}

async function registerNativePushNotifications(userId: string): Promise<boolean> {
  await ensureNotificationChannel();
  if (!(await requestNotificationPermission())) return false;

  // Device registration is user-scoped by auth.uid() in the existing RPC.
  // Confirm the active session matches the caller before registering a token.
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== userId) return false;

  try {
    await ensureNativePushEventListeners();
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    let settled = false;
    let registrationListener: { remove: () => Promise<void> } | null = null;
    let registrationErrorListener: { remove: () => Promise<void> } | null = null;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      void Promise.all([
        registrationListener?.remove().catch(() => undefined),
        registrationErrorListener?.remove().catch(() => undefined),
      ]);
      resolve(value);
    };

    const timeout = window.setTimeout(() => finish(false), 20000);
    void (async () => {
      try {
        registrationListener = await PushNotifications.addListener("registration", async (token: Token) => {
          try {
            const { error } = await db.rpc("upsert_notification_device" as any, {
              p_token: token.value,
              p_platform: "android",
              p_app_version: "1.0.0",
              p_enabled: true,
            });
            finish(!error);
          } catch {
            finish(false);
          }
        });
        registrationErrorListener = await PushNotifications.addListener("registrationError", () => finish(false));
        await PushNotifications.register();
      } catch {
        finish(false);
      }
    })();
  });
}

export async function registerForPushNotifications(userId: string, requestBrowserPermission = false): Promise<boolean> {
  if (!isNative()) return registerWebPushNotifications(requestBrowserPermission);
  if (nativeRegistrationInFlight) return nativeRegistrationInFlight;

  nativeRegistrationInFlight = registerNativePushNotifications(userId);
  try {
    return await nativeRegistrationInFlight;
  } finally {
    nativeRegistrationInFlight = null;
  }
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  const { data, error } = await db
    .from("notification_devices" as any)
    .select("token")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (error) throw new Error("Could not load registered notification devices.");
  for (const row of data ?? []) {
    const { error: disableError } = await db.rpc("disable_notification_device" as any, { p_token: row.token });
    if (disableError) throw new Error("Could not disable a notification device.");
  }
}

function minuteOfDay(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function isWithinQuietHours(minute: number, start: number, end: number): boolean {
  if (start === end) return true;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

function reminderCopy(context: LearningReminderContext = {}): { title: string; body: string } {
  const name = context.displayName?.trim();
  const greeting = name ? `${name}, ` : "";
  if (context.weakSubject?.trim()) {
    return { title: "A small step makes progress 🧠", body: `${greeting}spend ${Math.max(5, Math.min(30, context.minutesToStudy ?? 10))} minutes reviewing ${context.weakSubject.trim()} today.` };
  }
  if ((context.streakDays ?? 0) >= 3) {
    return { title: `${context.streakDays}-day learning streak! 🔥`, body: `${greeting}keep your momentum with one short quiz today.` };
  }
  if (context.lastStudiedAt && Date.now() - new Date(context.lastStudiedAt).getTime() > 48 * 60 * 60 * 1000) {
    return { title: "Let's restart your learning rhythm 🌱", body: `${greeting}one quick lesson is enough to get moving again.` };
  }
  return { title: "Ready for Master Minds? 🧠", body: `${greeting}a short learning session today can build your skills and keep your streak going.` };
}

export async function scheduleDailyLearningReminder(
  preferences: NotificationPreferences,
  context: LearningReminderContext = {},
): Promise<void> {
  if (!isAndroid()) return;
  await ensureNotificationChannel();
  // Always cancel first so disabling reminders cannot leave an old repeating notification active.
  await LocalNotifications.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] });
  if (!preferences.enabled || !preferences.dailyReminders) return;

  const safe = normalizePreferences(preferences);
  let hour = safe.reminderHour;
  if (safe.quietHoursEnabled) {
    const start = minuteOfDay(safe.quietStart);
    const end = minuteOfDay(safe.quietEnd);
    const target = hour * 60;
    if (isWithinQuietHours(target, start, end)) hour = Math.floor(end / 60);
  }

  const copy = reminderCopy(context);
  await LocalNotifications.schedule({
    notifications: [{
      id: DAILY_REMINDER_ID,
      title: copy.title,
      body: copy.body,
      schedule: { on: { hour, minute: 0 }, repeats: true, allowWhileIdle: true },
      extra: { route: "/", kind: "daily_learning_reminder" },
      channelId: "master_minds_default",
      smallIcon: "ic_stat_master_minds",
    }],
  });
}

export async function cancelDailyLearningReminder(): Promise<void> {
  if (!isAndroid()) return;
  await LocalNotifications.cancel({ notifications: [{ id: DAILY_REMINDER_ID }] });
}
