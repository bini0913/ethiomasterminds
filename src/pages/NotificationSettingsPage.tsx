import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock3, Gamepad2, Gift, MessageCircle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import BackButton from "@/components/ui/BackButton";
import { useUser } from "@/context/UserContext";
import {
  type NotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferences,
  registerForPushNotifications,
  scheduleDailyLearningReminder,
  cancelDailyLearningReminder,
} from "@/lib/notifications";
import { toast } from "sonner";

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
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) void loadNotificationPreferences(user.id).then(setPrefs);
  }, [user?.id]);

  const update = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user?.id || !prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    try {
      await saveNotificationPreferences(user.id, next);
      if (key === "enabled") {
        if (value) {
          await registerForPushNotifications(user.id);
          await scheduleDailyLearningReminder(next);
        } else {
          await cancelDailyLearningReminder();
        }
      }
      if (key === "dailyReminders") {
        if (value && next.enabled) await scheduleDailyLearningReminder(next);
        else await cancelDailyLearningReminder();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return <div className="min-h-screen bg-background p-6 text-muted-foreground">Loading notification settings…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <BackButton />
          <div>
            <h1 className="font-semibold">Notifications</h1>
            <p className="text-xs text-muted-foreground">Choose what Master Minds can send you</p>
          </div>
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
            {!prefs.enabled && <p className="text-sm text-muted-foreground">Notifications are paused. You can turn them back on anytime.</p>}
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
                if (!user?.id) return;
                const hour = Number(e.target.value.split(":")[0]);
                const next = { ...prefs, reminderHour: hour };
                setPrefs(next);
                await saveNotificationPreferences(user.id, next);
                if (next.enabled && next.dailyReminders) await scheduleDailyLearningReminder(next);
                toast.success("Reminder time updated");
              }}
              className="h-11 w-full rounded-xl border bg-background px-3"
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
