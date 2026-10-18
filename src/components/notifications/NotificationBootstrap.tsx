import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import {
  getStoredNotificationPreferences,
  loadNotificationPreferences,
  registerForPushNotifications,
  scheduleDailyLearningReminder,
} from "@/lib/notifications";

type NativeNotificationAction = {
  actionId?: string;
  action?: string;
  route?: string;
  request_id?: string;
  message_id?: string;
  room_id?: string;
  reply?: string;
};

declare global {
  interface Window {
    __handleMasterMindsNotificationAction?: (payload: string | NativeNotificationAction) => boolean;
    __masterMindsPendingStudyCallRoom?: string;
  }
}

const handledActionIds = new Set<string>();

export default function NotificationBootstrap() {
  const { user, isAuthenticated } = useUser();

  useEffect(() => {
    // MainActivity retries until this handler exists, so notification taps and
    // RemoteInput replies are not lost while the WebView/React app is starting.
    window.__handleMasterMindsNotificationAction = (input) => {
      let action: NativeNotificationAction;
      try {
        action = typeof input === "string" ? JSON.parse(input) as NativeNotificationAction : input;
      } catch {
        return true;
      }
      const actionId = action.actionId || [action.action, action.request_id, action.message_id, action.room_id].join(":");
      if (handledActionIds.has(actionId)) return true;
      handledActionIds.add(actionId);

      void (async () => {
        if (action.action === "open") {
          if (action.route?.startsWith("/")) {
            window.dispatchEvent(new CustomEvent("master-minds-notification-route", { detail: action.route }));
          }
          return;
        }

        const payload: Record<string, string> = {};
        if (action.action) payload.action = action.action;
        if (action.request_id) payload.request_id = action.request_id;
        if (action.message_id) payload.message_id = action.message_id;
        if (action.room_id) payload.room_id = action.room_id;
        if (action.reply) payload.reply = action.reply;

        const { data, error } = await supabase.functions.invoke("notification-action", { body: payload });
        if (error || data?.error || !data?.ok) {
          toast.error(data?.error || error?.message || "Could not process notification action. Open Master Minds and try again.");
          return;
        }

        if (action.action === "friend_accept" || action.action === "friend_decline") {
          toast.success(action.action === "friend_accept" ? "Friend request accepted." : "Friend request declined.");
          window.dispatchEvent(new CustomEvent("master-minds-notification-route", { detail: "/friends" }));
        } else if (action.action === "call_accept" && data.room_id) {
          window.__masterMindsPendingStudyCallRoom = data.room_id;
          window.dispatchEvent(new CustomEvent("master-minds-notification-route", { detail: "/study-mode" }));
          window.dispatchEvent(new CustomEvent("master-minds-study-call-accepted", { detail: data.room_id }));
        } else if (action.action === "call_decline") {
          toast.info("Study call declined.");
        } else if (action.action === "message_reply") {
          toast.success("Reply sent.");
          window.dispatchEvent(new CustomEvent("master-minds-notification-route", { detail: "/friends" }));
        }
      })().catch(() => toast.error("Could not process notification action."));
      return true;
    };

    return () => {
      delete window.__handleMasterMindsNotificationAction;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let cancelled = false;
    const start = async () => {
      try {
        const preferences = await loadNotificationPreferences(user.id);
        if (cancelled) return;
        if (preferences.enabled) {
          await registerForPushNotifications(user.id);
          await scheduleDailyLearningReminder(preferences);
        }
      } catch (error) {
        console.warn("Notification setup could not finish:", error);
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
