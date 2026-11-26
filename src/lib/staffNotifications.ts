import { supabase } from "@/integrations/supabase/client";

export type RemoteNotification = {
  sourceId: string;
  kind: "teacher_announcement" | "admin_announcement" | "quiz_assignment";
  data?: Record<string, string>;
};

export async function sendRemoteNotification(notification: RemoteNotification): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("send-push-notification", {
    body: {
      event_id: notification.sourceId,
      kind: notification.kind,
      data: notification.data ?? {},
    },
  });

  if (error) {
    console.error("Remote notification error:", error);
    return false;
  }

  return Number(data?.sent ?? 0) > 0;
}

export async function sendRemoteNotifications(
  notifications: RemoteNotification[],
): Promise<number> {
  if (!notifications.length) return 0;
  const results = await Promise.all(notifications.map(sendRemoteNotification));
  return results.filter(Boolean).length;
}
