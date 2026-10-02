import { useEffect } from "react";
import { useUser } from "@/context/UserContext";
import {
  getStoredNotificationPreferences,
  loadNotificationPreferences,
  registerForPushNotifications,
  scheduleDailyLearningReminder,
} from "@/lib/notifications";

export default function NotificationBootstrap() {
  const { user, isAuthenticated } = useUser();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let cancelled = false;

    const start = async () => {
      const preferences = await loadNotificationPreferences(user.id);
      if (cancelled) return;
      if (preferences.enabled) {
        await registerForPushNotifications(user.id);
        await scheduleDailyLearningReminder(preferences);
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  void getStoredNotificationPreferences;
  return null;
}
