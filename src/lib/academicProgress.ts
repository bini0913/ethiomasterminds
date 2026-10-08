import { supabase } from "@/integrations/supabase/client";
import { normalizeSubject } from "@/lib/academicProfile";

type AcademicProgressInput = {
  userId: string;
  subject: string;
  correct: number;
  total: number;
  timeSeconds?: number;
  topic?: string;
};

export async function recordAcademicProgress({
  userId,
  subject,
  correct,
  total,
  timeSeconds = 0,
  topic = "General",
}: AcademicProgressInput) {
  if (!userId || total <= 0) return;

  const normalizedSubject = normalizeSubject(subject);
  const { data: existing, error: readError } = await supabase
    .from("topic_progress")
    .select("id,questions_attempted,questions_correct")
    .eq("user_id", userId)
    .eq("subject", normalizedSubject)
    .eq("topic", topic)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    console.error("Academic progress read failed:", readError);
    return;
  }

  const attempted = Number(existing?.questions_attempted || 0) + total;
  const correctTotal = Number(existing?.questions_correct || 0) + correct;
  const accuracy = attempted > 0 ? (correctTotal / attempted) * 100 : 0;
  const completion = Math.min(100, Math.round((attempted / 5) * 100));

  const payload = {
    user_id: userId,
    subject: normalizedSubject,
    topic,
    questions_attempted: attempted,
    questions_correct: correctTotal,
    accuracy_percentage: Math.round(accuracy * 10) / 10,
    completion_percentage: completion,
    last_practiced: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const result = existing?.id
    ? await supabase.from("topic_progress").update(payload).eq("id", existing.id)
    : await supabase.from("topic_progress").insert(payload);

  if (result.error) {
    console.error("Academic progress save failed:", result.error);
  }

  const averageTime = timeSeconds > 0 ? timeSeconds / total : 0;
  await supabase.rpc("update_analytics", {
    p_user_id: userId,
    p_subject: normalizedSubject,
    p_correct: correct,
    p_total: total,
    p_avg_time: averageTime,
  });
}
