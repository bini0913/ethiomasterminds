import { supabase } from "@/integrations/supabase/client";

export type RemoteNotification = {
  userId: string;
  kind: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendRemoteNotification(notification: RemoteNotification): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return false;

  const { data, error } = await supabase.functions.invoke("send-push-notification", {
    body: {
      user_id: notification.userId,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      data: notification.data ?? {},
    },
    headers: { Authorization: `Bearer ${token}` },
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
