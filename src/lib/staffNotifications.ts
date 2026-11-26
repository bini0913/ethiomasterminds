import { supabase } from "@/integrations/supabase/client";

export type RemoteNotification = {
  sourceId: string;
  kind: "teacher_announcement" | "admin_announcement" | "quiz_assignment";
  data?: Record<string, string>;
};

export type RemoteNotificationSummary = {
  inboxRecorded: boolean;
  inboxEventsRecorded: number;
  requestedEvents: number;
  sentDevices: number;
  attemptedDevices: number;
  failedDevices: number;
  skippedPreferences: number;
  noEligibleDevices: number;
};

type SingleNotificationResult = Omit<RemoteNotificationSummary, "inboxEventsRecorded" | "requestedEvents" | "inboxRecorded"> & {
  inboxRecorded: boolean;
};

async function sendRemoteNotification(notification: RemoteNotification): Promise<SingleNotificationResult> {
  const { data, error } = await supabase.functions.invoke("send-push-notification", {
    body: {
      event_id: notification.sourceId,
      kind: notification.kind,
      data: notification.data ?? {},
    },
  });

  let errorPayload: Record<string, unknown> = {};
  if (error) {
    console.error("Remote notification delivery error:", error);
    const response = (error as unknown as { context?: Response }).context;
    if (response && typeof response.clone === "function") {
      try {
        errorPayload = await response.clone().json() as Record<string, unknown>;
      } catch {
        // Some network failures do not include a JSON response body.
      }
    }
  }

  const payload = (data ?? errorPayload) as Record<string, unknown>;
  const failures = Array.isArray(payload.failures) ? payload.failures.length : 0;
  return {
    inboxRecorded: payload.event_recorded === true || payload.inbox_recorded === true,
    sentDevices: Number(payload.sent ?? 0),
    attemptedDevices: Number(payload.attempted ?? 0),
    failedDevices: failures,
    skippedPreferences: Number(payload.skipped_preferences ?? 0),
    noEligibleDevices: Number(payload.no_eligible_devices ?? 0),
  };
}

export async function sendRemoteNotifications(
  notifications: RemoteNotification[],
): Promise<RemoteNotificationSummary> {
  if (!notifications.length) {
    return {
      inboxRecorded: false,
      inboxEventsRecorded: 0,
      requestedEvents: 0,
      sentDevices: 0,
      attemptedDevices: 0,
      failedDevices: 0,
      skippedPreferences: 0,
      noEligibleDevices: 0,
    };
  }

  const results = await Promise.all(notifications.map(sendRemoteNotification));
  const inboxEventsRecorded = results.filter((result) => result.inboxRecorded).length;
  return {
    inboxRecorded: inboxEventsRecorded === notifications.length,
    inboxEventsRecorded,
    requestedEvents: notifications.length,
    sentDevices: results.reduce((sum, result) => sum + result.sentDevices, 0),
    attemptedDevices: results.reduce((sum, result) => sum + result.attemptedDevices, 0),
    failedDevices: results.reduce((sum, result) => sum + result.failedDevices, 0),
    skippedPreferences: results.reduce((sum, result) => sum + result.skippedPreferences, 0),
    noEligibleDevices: results.reduce((sum, result) => sum + result.noEligibleDevices, 0),
  };
}
