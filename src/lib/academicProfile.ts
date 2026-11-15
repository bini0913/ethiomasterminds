import { db } from "@/integrations/untypedClient";
import { supabase } from "@/integrations/supabase/client";

export type AcademicProfile = {
  user_id: string;
  grade: number;
  study_goal: string;
  study_goal_detail: string | null;
  curriculum: "oromia" | "addis_ababa";
  subjects: string[];
  book_id: string | null;
  book_ids?: string[];
  book_title: string | null;
};

export function normalizeGrade(value: string | number | null | undefined, fallback = 5) {
  const match = String(value ?? "").match(/\d{1,2}/);
  const grade = match ? Number(match[0]) : fallback;
  return Math.min(12, Math.max(5, grade));
}

/** The authenticated profile owns the learner's grade band; setup data is fallback data. */
export function resolveAcademicGrade(
  userGrade: string | number | null | undefined,
  academicGrade: string | number | null | undefined,
  fallback = 5,
) {
  return normalizeGrade(userGrade ?? academicGrade, fallback);
}

export function normalizeSubject(value: string) {
  const key = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    mathematics: "math",
    maths: "math",
    math: "math",
    physics: "physics",
    chemistry: "chemistry",
    biology: "biology",
    english: "english",
    amharic: "amharic",
    "afaan oromo": "afaan oromo",
    "general science": "science",
    "science (physics/chemistry/biology)": "science",
    science: "science",
    "social studies": "social studies",
    civics: "civics",
    ict: "ict",
    geography: "geography",
    history: "history",
    economics: "economics",
    "history & civics": "history",
  };
  return aliases[key] || key;
}

export function subjectsMatch(profileSubject: string, contentSubject: string) {
  return normalizeSubject(profileSubject) === normalizeSubject(contentSubject);
}

export async function getAcademicProfile(userId: string) {
  const { data, error } = await db
    .from("academic_profiles")
    .select("user_id,grade,study_goal,study_goal_detail,curriculum,subjects,book_id,book_ids,book_title")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as AcademicProfile | null;
}
