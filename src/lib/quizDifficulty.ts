export type QuizDifficulty = "Easy" | "Medium" | "Hard" | "Extreme";

const difficultyOrder: QuizDifficulty[] = ["Easy", "Medium", "Hard", "Extreme"];

export const xpPerCorrectByDifficulty: Record<QuizDifficulty, number> = {
  Easy: 2,
  Medium: 4,
  Hard: 6,
  Extreme: 8,
};

export const penaltyPerWrongByDifficulty: Record<QuizDifficulty, number> = {
  Easy: 0,
  Medium: 0,
  Hard: 2,
  Extreme: 3,
};

export const difficultyFromLevel = (level: number): QuizDifficulty => {
  if (level >= 21) return "Extreme";
  if (level >= 11) return "Hard";
  if (level >= 6) return "Medium";
  return "Easy";
};

export const normalizeDifficulty = (difficulty?: string | null): QuizDifficulty => {
  switch ((difficulty || "").toLowerCase()) {
    case "easy":
      return "Easy";
    case "hard":
      return "Hard";
    case "extreme":
      return "Extreme";
    case "medium":
    default:
      return "Medium";
  }
};

export const adjustDifficulty = (difficulty: QuizDifficulty, offset: number): QuizDifficulty => {
  const currentIndex = difficultyOrder.indexOf(difficulty);
  const nextIndex = Math.min(difficultyOrder.length - 1, Math.max(0, currentIndex + offset));
  return difficultyOrder[nextIndex];
};

export const calculateQuizXP = (difficulty: QuizDifficulty, correctAnswers: number, wrongAnswers: number) => {
  const xp = correctAnswers * xpPerCorrectByDifficulty[difficulty];
  const penalty = wrongAnswers * penaltyPerWrongByDifficulty[difficulty];
  return Math.max(0, xp - penalty);
};
