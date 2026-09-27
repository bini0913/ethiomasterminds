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

    const { data, error: queryError } = await supabase
      .from("early_activity_progress")
      .select("activity_id,skill,attempts,correct_answers,completions,xp_earned,coins_earned,last_played_at")
      .eq("user_id", user.id)
      .order("last_played_at", { ascending: false });

    if (queryError) {
      console.error("Early progress load failed:", queryError);
      setError(queryError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as EarlyProgressRow[]);
    }

    setIsLoading(false);
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
