import { supabase } from "@/integrations/supabase/client";

export type AcademicProfile = {
  user_id: string;
  grade: number;
  study_goal: string;
  study_goal_detail: string | null;
  curriculum: "oromia" | "addis_ababa";
  subjects: string[];
  book_id: string | null;
  book_title: string | null;
};

export function normalizeGrade(value: string | number | null | undefined, fallback = 5) {
  const match = String(value ?? "").match(/\d{1,2}/);
  const grade = match ? Number(match[0]) : fallback;
  return Math.min(12, Math.max(5, grade));
}

export function normalizeSubject(value: string) {
  const key = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    mathematics: "math",
    math: "math",
    physics: "physics",
    chemistry: "chemistry",
    biology: "biology",
    english: "english",
    amharic: "amharic",
    "afaan oromo": "afaan oromo",
    "general science": "science",
    science: "science",
    "social studies": "social studies",
    civics: "civics",
    ict: "ict",
    geography: "geography",
    history: "history",
    economics: "economics",
  };
  return aliases[key] || key;
}

export async function getAcademicProfile(userId: string) {
  const { data, error } = await supabase
    .from("academic_profiles")
    .select("user_id,grade,study_goal,study_goal_detail,curriculum,subjects,book_id,book_title")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as AcademicProfile | null;
}
