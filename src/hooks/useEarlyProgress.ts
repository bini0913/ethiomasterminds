import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";

export type EarlyProgressRow = {
  activity_id: string;
  skill: string;
  attempts: number;
  correct_answers: number;
  completions: number;
  xp_earned: number;
  coins_earned: number;
  last_played_at: string | null;
};

export function useEarlyProgress() {
  const { user } = useUser();
  const [rows, setRows] = useState<EarlyProgressRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("early_activity_attempts")
        .select("activity_id,skill,correct,xp_earned,coins_earned,created_at")
        .eq("user_id", user.id)
        .not("question_id", "is", null)
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;

      const grouped = new Map<string, EarlyProgressRow>();
      for (const attempt of data ?? []) {
        const existing = grouped.get(attempt.activity_id) ?? {
          activity_id: attempt.activity_id,
          skill: attempt.skill,
          attempts: 0,
          correct_answers: 0,
          completions: 0,
          xp_earned: 0,
          coins_earned: 0,
          last_played_at: attempt.created_at,
        };
        existing.attempts += 1;
        existing.correct_answers += attempt.correct ? 1 : 0;
        existing.xp_earned += Number(attempt.xp_earned ?? 0);
        existing.coins_earned += Number(attempt.coins_earned ?? 0);
        if (!existing.last_played_at || attempt.created_at > existing.last_played_at) {
          existing.last_played_at = attempt.created_at;
        }
        grouped.set(attempt.activity_id, existing);
      }
      setRows([...grouped.values()].sort((a, b) =>
        (b.last_played_at ?? "").localeCompare(a.last_played_at ?? "")
      ));
    } catch (loadError) {
      console.error("Early progress load failed:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Could not load learning progress.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const summary = useMemo(() => {
    const attempts = rows.reduce((sum, row) => sum + row.attempts, 0);
    const correct = rows.reduce((sum, row) => sum + row.correct_answers, 0);
    const completions = rows.reduce((sum, row) => sum + row.completions, 0);
    const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
    const skills = Array.from(new Set(rows.map(row => row.skill))).filter(Boolean);

    return { attempts, correct, completions, accuracy, skills };
  }, [rows]);

  return { rows, summary, isLoading, error, reload };
}
