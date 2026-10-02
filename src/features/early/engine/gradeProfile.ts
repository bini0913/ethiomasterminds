/** Numeric early grade: 0 = KG, 1-4 = Grade 1-4. Everything grade-specific reads from here. */
export type EarlyGrade = 0 | 1 | 2 | 3 | 4;

export interface GradeProfile {
  grade: EarlyGrade;
  label: string;
  /** Questions per quiz session. */
  sessionLength: number;
  /** Answer choices shown. */
  choices: number;
  /** Hints allowed per session. */
  hints: number;
  /** Seconds per question for timed modes (0 = untimed). */
  timerSeconds: number;
  /** Largest number used in generated math. */
  numberMax: number;
  /** Prompt style: short (pictures, few words) or full sentences. */
  readingLoad: "picture" | "short" | "full";
  narrated: boolean;
}

const PROFILES: Record<EarlyGrade, GradeProfile> = {
  0: { grade: 0, label: "KG", sessionLength: 6, choices: 3, hints: 3, timerSeconds: 0, numberMax: 10, readingLoad: "picture", narrated: true },
  1: { grade: 1, label: "Grade 1", sessionLength: 8, choices: 4, hints: 3, timerSeconds: 0, numberMax: 20, readingLoad: "short", narrated: true },
  2: { grade: 2, label: "Grade 2", sessionLength: 10, choices: 4, hints: 2, timerSeconds: 30, numberMax: 100, readingLoad: "short", narrated: false },
  3: { grade: 3, label: "Grade 3", sessionLength: 10, choices: 4, hints: 2, timerSeconds: 25, numberMax: 1000, readingLoad: "full", narrated: false },
  4: { grade: 4, label: "Grade 4", sessionLength: 12, choices: 4, hints: 1, timerSeconds: 20, numberMax: 10000, readingLoad: "full", narrated: false },
};

export function toEarlyGrade(grade: string | null | undefined): EarlyGrade {
  const g = String(grade ?? "").trim().toLowerCase();
  if (!g || /^(k|kg|kindergarten|pre-?k)$/.test(g)) return 0;
  const m = /^(?:grade\s*)?(\d{1,2})\+?$/.exec(g);
  const n = m ? Number(m[1]) : 0;
  return (n <= 0 ? 0 : n >= 4 ? 4 : n) as EarlyGrade;
}

export function getGradeProfile(grade: EarlyGrade): GradeProfile {
  return PROFILES[grade];
}
