import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCircle2, Clock3, Gamepad2, Gift, MessageCircle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import BackButton from "@/components/ui/BackButton";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import {
  type NotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferences,
  registerForPushNotifications,
  scheduleDailyLearningReminder,
  cancelDailyLearningReminder,
  unregisterPushNotifications,
} from "@/lib/notifications";
import { toast } from "sonner";
import { getUserTier } from "@/lib/getUserTier";

const items: Array<{ key: keyof NotificationPreferences; label: string; description: string; icon: typeof Bell }> = [
  { key: "dailyReminders", label: "Daily learning reminders", description: "A gentle reminder to keep learning.", icon: Clock3 },
  { key: "studyReminders", label: "Study reminders", description: "Reminders for planned study sessions.", icon: Bell },
  { key: "achievements", label: "Achievements & rewards", description: "Celebrate badges, XP and rewards.", icon: Trophy },
  { key: "social", label: "Friends & social", description: "Friend activity and social updates.", icon: MessageCircle },
  { key: "gameInvites", label: "Game invitations", description: "Know when someone invites you to play.", icon: Gamepad2 },
  { key: "newContent", label: "New learning content", description: "New quizzes, videos and activities.", icon: Gift },
  { key: "streaks", label: "Streaks", description: "Protect your learning streak.", icon: CheckCircle2 },
];

export default function NotificationSettingsPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const upperStudent = getUserTier(user?.grade) === "upper";
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [registeringDevice, setRegisteringDevice] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoadError(false);
    try {
      setPrefs(await loadNotificationPreferences(user.id));
    } catch {
      setLoadError(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) void load();
  }, [load, user?.id]);

  // Keep this screen current when preferences are changed from another device
  // or another signed-in session. The user_id filter and RLS both scope updates.
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const channel = supabase
      .channel(`notification-preferences-page-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notification_preferences",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        if (active) void load();
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [load, user?.id]);

  const update = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user?.id || !prefs) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    // Start the browser permission prompt from the user gesture before network awaits.
    const registrationPromise = key === "enabled" && value
      ? registerForPushNotifications(user.id, true)
      : null;
    setPrefs(next);
    setSaving(true);
    let pushRegistrationUnavailable = false;
    try {
      await saveNotificationPreferences(user.id, next);
      if (key === "enabled") {
        if (value) {
          const registered = await registrationPromise;
          await scheduleDailyLearningReminder(next);
          if (!registered) pushRegistrationUnavailable = true;
        } else {
          await unregisterPushNotifications(user.id);
          await cancelDailyLearningReminder();
        }
      }
      if (key === "dailyReminders") {
        if (value && next.enabled) await scheduleDailyLearningReminder(next);
        else await cancelDailyLearningReminder();
      }
      if (pushRegistrationUnavailable) {
        toast.info("Preferences saved, but this device could not be registered for push. Check notification permission and Firebase web configuration; your in-app inbox remains available.");
      } else {
        toast.success("Notification settings saved.");
      }
    } catch {
      setPrefs(previous);
      toast.error("Could not save notification settings. Your previous choices were restored.");
    } finally {
      setSaving(false);
    }
  };

  const registerThisDevice = async () => {
    if (!user?.id || !prefs.enabled || registeringDevice) return;
    setRegisteringDevice(true);
    try {
      const registered = await registerForPushNotifications(user.id, true);
      if (registered) {
        toast.success("This device is registered for notifications.");
      } else {
        toast.info("Your in-app inbox is available, but this device could not be registered for push. Check notification permission and Firebase web configuration.");
      }
    } catch {
      toast.error("Could not register this device for push notifications.");
    } finally {
      setRegisteringDevice(false);
    }
  };

  if (!prefs) {
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-background p-6 text-center" role="status" aria-live="polite">
        {loadError ? <>
          <p className="font-semibold text-foreground">Notification settings couldn’t be loaded.</p>
          <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button variant="outline" onClick={() => void load()}>Try again</Button>
        </> : <p className="text-sm text-muted-foreground">Loading notification settings…</p>}
      </main>
    );
  }

  return (
    <div className={upperStudent ? "tier-upper min-h-screen bg-background text-foreground" : "min-h-screen bg-background"}>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <BackButton />
          <div>
            <h1 className="font-semibold">Notifications</h1>
            <p className="text-xs text-muted-foreground">Choose what Master Minds can send you</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/notifications")}>View inbox</Button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 p-4 pb-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Push notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div><Label htmlFor="all-notifications">Enable notifications</Label><p className="text-sm text-muted-foreground">Allow Master Minds to send alerts to this device.</p></div>
              <Switch id="all-notifications" checked={prefs.enabled} onCheckedChange={(v) => void update("enabled", v)} disabled={saving} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">This device</p>
                <p className="text-sm text-muted-foreground">Register this browser or Android device to receive push alerts.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void registerThisDevice()} disabled={!prefs.enabled || saving || registeringDevice}>
                <Bell className="mr-2 h-4 w-4" />{registeringDevice ? "Registering…" : "Set up this device"}
              </Button>
            </div>
            {!prefs.enabled && <p className="text-sm text-muted-foreground">Notifications are paused. Turn them on before registering this device.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>What you receive</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {items.map((item) => {
              const Icon = item.icon;
              return <div key={item.key} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                <div className="flex min-w-0 items-center gap-3"><Icon className="h-5 w-5 shrink-0 text-primary" /><div><Label htmlFor={String(item.key)}>{item.label}</Label><p className="text-sm text-muted-foreground">{item.description}</p></div></div>
                <Switch id={String(item.key)} checked={Boolean(prefs[item.key])} onCheckedChange={(v) => void update(item.key, v)} disabled={!prefs.enabled || saving} />
              </div>;
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Daily reminder time</CardTitle></CardHeader>
          <CardContent>
            <input
              type="time"
              value={String(prefs.reminderHour).padStart(2, "0") + ":00"}
              onChange={async (e) => {
                if (!user?.id || saving) return;
                const previous = prefs;
                const hour = Number(e.target.value.split(":")[0]);
                const next = { ...prefs, reminderHour: hour };
                setPrefs(next);
                setSaving(true);
                try {
                  await saveNotificationPreferences(user.id, next);
                  if (next.enabled && next.dailyReminders) await scheduleDailyLearningReminder(next);
                  toast.success("Reminder time updated.");
                } catch {
                  setPrefs(previous);
                  toast.error("Could not save the reminder time. Your previous time was restored.");
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              aria-label="Daily learning reminder time"
              className="h-11 w-full rounded-xl border bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
