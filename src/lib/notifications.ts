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
    const raw = localStorage.getItem(PREF_KEY);
    return normalizePreferences(raw ? JSON.parse(raw) : defaults);
  } catch {
    return defaults;
  }
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
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

  localStorage.setItem(PREF_KEY, JSON.stringify(mapped));
  return mapped;
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
): Promise<void> {
  const safe = normalizePreferences(preferences);
  const { error } = await supabase.from("notification_preferences" as any).upsert({
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
  localStorage.setItem(PREF_KEY, JSON.stringify(safe));
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

export async function registerForPushNotifications(userId: string): Promise<boolean> {
  if (!isNative()) return false;
  await ensureNotificationChannel();
  if (!(await requestNotificationPermission())) return false;

  return new Promise((resolve) => {
    let settled = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      void Promise.all(listeners.map((listener) => listener.remove().catch(() => undefined)));
      resolve(value);
    };

    const timeout = window.setTimeout(() => finish(false), 15000);
    void (async () => {
      try {
        listeners.push(await PushNotifications.addListener("registration", async (token: Token) => {
          try {
            const { error } = await supabase.rpc("upsert_notification_device" as any, {
              p_token: token.value,
              p_platform: Capacitor.getPlatform(),
              p_app_version: "1.0.0",
              p_enabled: true,
            });
            finish(!error);
          } catch {
            finish(false);
          }
        }));
        listeners.push(await PushNotifications.addListener("registrationError", () => finish(false)));
        listeners.push(await PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
          window.dispatchEvent(new CustomEvent("master-minds-notification", { detail: notification }));
        }));
        listeners.push(await PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
          const route = typeof action.notification.data?.route === "string" ? action.notification.data.route : null;
          if (route) window.dispatchEvent(new CustomEvent("master-minds-notification-route", { detail: route }));
        }));
        await PushNotifications.register();
      } catch {
        finish(false);
      }
    })();
  });
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  if (!isNative()) return;
  const { data, error } = await supabase
    .from("notification_devices" as any)
    .select("token")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (error) throw new Error("Could not load registered notification devices.");
  for (const row of data ?? []) {
    const { error: disableError } = await supabase.rpc("disable_notification_device" as any, { p_token: row.token });
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
