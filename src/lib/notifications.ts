import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token, type PushNotificationSchema, type ActionPerformed } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/integrations/supabase/client";

const PREF_KEY = "master_minds_notification_preferences_v1";

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

export function getStoredNotificationPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data } = await supabase
    .from("notification_preferences" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const mapped: NotificationPreferences = data
    ? {
        enabled: data.enabled,
        dailyReminders: data.daily_reminders,
        achievements: data.achievements,
        social: data.social,
        gameInvites: data.game_invites,
        newContent: data.new_content,
        streaks: data.streaks,
        studyReminders: data.study_reminders,
        quietHoursEnabled: data.quiet_hours_enabled,
        quietStart: String(data.quiet_start).slice(0, 5),
        quietEnd: String(data.quiet_end).slice(0, 5),
        reminderHour: data.reminder_hour,
      }
    : defaults;

  localStorage.setItem(PREF_KEY, JSON.stringify(mapped));
  return mapped;
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
): Promise<void> {
  localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
  await supabase.from("notification_preferences" as any).upsert({
    user_id: userId,
    enabled: preferences.enabled,
    daily_reminders: preferences.dailyReminders,
    achievements: preferences.achievements,
    social: preferences.social,
    game_invites: preferences.gameInvites,
    new_content: preferences.newContent,
    streaks: preferences.streaks,
    study_reminders: preferences.studyReminders,
    quiet_hours_enabled: preferences.quietHoursEnabled,
    quiet_start: preferences.quietStart,
    quiet_end: preferences.quietEnd,
    reminder_hour: preferences.reminderHour,
    updated_at: new Date().toISOString(),
  });
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
  const allowed = await requestNotificationPermission();
  if (!allowed) return false;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const timeout = window.setTimeout(() => finish(false), 15000);

    void PushNotifications.addListener("registration", async (token: Token) => {
      window.clearTimeout(timeout);
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
    });

    void PushNotifications.addListener("registrationError", () => {
      window.clearTimeout(timeout);
      finish(false);
    });

    void PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
      window.dispatchEvent(new CustomEvent("master-minds-notification", { detail: notification }));
    });

    void PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
      const route = typeof action.notification.data?.route === "string" ? action.notification.data.route : null;
      if (route) window.dispatchEvent(new CustomEvent("master-minds-notification-route", { detail: route }));
    });

    void PushNotifications.register().catch(() => {
      window.clearTimeout(timeout);
      finish(false);
    });
  });
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  if (!isNative()) return;
  const { data } = await supabase
    .from("notification_devices" as any)
    .select("token")
    .eq("user_id", userId)
    .eq("enabled", true);
  for (const row of data ?? []) {
    await supabase.rpc("disable_notification_device" as any, { p_token: row.token });
  }
}

export async function scheduleDailyLearningReminder(preferences: NotificationPreferences): Promise<void> {
  if (!isAndroid() || !preferences.enabled || !preferences.dailyReminders) return;

  await LocalNotifications.cancel({ notifications: [{ id: 7101 }] });
  const [hour] = [preferences.reminderHour];

  await LocalNotifications.schedule({
    notifications: [{
      id: 7101,
      title: "Ready for Master Minds? 🧠",
      body: "A quick learning session today can keep your streak going!",
      schedule: { on: { hour, minute: 0 }, repeats: true },
      extra: { route: "/" },
      smallIcon: "ic_stat_master_minds",
    }],
  });
}

export async function cancelDailyLearningReminder(): Promise<void> {
  if (!isAndroid()) return;
  await LocalNotifications.cancel({ notifications: [{ id: 7101 }] });
}
