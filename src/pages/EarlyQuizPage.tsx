import React, { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleHelp, Sparkles, Trophy, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useEarlyReward } from "@/hooks/useEarlyReward";
import { useEarlyProgress } from "@/hooks/useEarlyProgress";
import { getUserTier } from "@/lib/getUserTier";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Q = { prompt: string; options: string[]; answer: string; subject: string };

const sets: Record<string, Q[]> = {
  k: [
    { prompt: "Which one is a fruit?", options: ["🍎", "🚗", "🐶", "⭐"], answer: "🍎", subject: "Nature" },
    { prompt: "How many dots? • • •", options: ["2", "3", "4", "5"], answer: "3", subject: "Numbers" },
    { prompt: "Which letter starts SUN?", options: ["S", "M", "T", "B"], answer: "S", subject: "Letters" },
    { prompt: "What animal says meow?", options: ["🐱", "🐶", "🐮", "🦁"], answer: "🐱", subject: "Nature" },
    { prompt: "Which shape has 3 sides?", options: ["Circle", "Triangle", "Square", "Star"], answer: "Triangle", subject: "Shapes" },
    { prompt: "What comes after 4?", options: ["3", "5", "6", "8"], answer: "5", subject: "Numbers" },
    { prompt: "Which is the color of grass?", options: ["Green", "Purple", "Black", "Pink"], answer: "Green", subject: "Colors" },
    { prompt: "Which letter comes first in CAT?", options: ["C", "A", "T", "B"], answer: "C", subject: "Letters" },
    { prompt: "Which one can fly?", options: ["🐦", "🐟", "🐢", "🐄"], answer: "🐦", subject: "Nature" },
    { prompt: "How many sides does a square have?", options: ["3", "4", "5", "6"], answer: "4", subject: "Shapes" },
  ],
  g1: [
    { prompt: "What is 3 + 4?", options: ["6", "7", "8", "9"], answer: "7", subject: "Math" },
    { prompt: "Which word rhymes with CAT?", options: ["DOG", "HAT", "SUN", "PEN"], answer: "HAT", subject: "Reading" },
    { prompt: "Which is a living thing?", options: ["Tree", "Chair", "Ball", "Cup"], answer: "Tree", subject: "Science" },
    { prompt: "What comes after 19?", options: ["18", "20", "21", "29"], answer: "20", subject: "Math" },
    { prompt: "Which word names an animal?", options: ["Run", "Blue", "Tiger", "Happy"], answer: "Tiger", subject: "Reading" },
    { prompt: "What is 8 - 3?", options: ["4", "5", "6", "7"], answer: "5", subject: "Math" },
    { prompt: "Which is a solid?", options: ["Rock", "Water", "Air", "Steam"], answer: "Rock", subject: "Science" },
    { prompt: "Which word is spelled correctly?", options: ["Bok", "Book", "Booc", "Bokke"], answer: "Book", subject: "Reading" },
    { prompt: "What number is greater?", options: ["6", "9", "4", "2"], answer: "9", subject: "Math" },
    { prompt: "Which animal lives in water?", options: ["Fish", "Lion", "Horse", "Chicken"], answer: "Fish", subject: "Science" },
  ],
  g3: [
    { prompt: "What is 6 × 4?", options: ["18", "20", "24", "28"], answer: "24", subject: "Math" },
    { prompt: "Which word is a noun?", options: ["Quickly", "Garden", "Run", "Bright"], answer: "Garden", subject: "Reading" },
    { prompt: "Water freezes at what temperature in °C?", options: ["0", "10", "50", "100"], answer: "0", subject: "Science" },
    { prompt: "What is 45 ÷ 5?", options: ["7", "8", "9", "10"], answer: "9", subject: "Math" },
    { prompt: "Which planet do we live on?", options: ["Mars", "Earth", "Jupiter", "Venus"], answer: "Earth", subject: "Science" },
    { prompt: "What is 7 × 8?", options: ["48", "54", "56", "64"], answer: "56", subject: "Math" },
    { prompt: "Which sentence is correct?", options: ["She run fast.", "She runs fast.", "She running fast.", "She runned fast."], answer: "She runs fast.", subject: "Reading" },
    { prompt: "Which is a renewable resource?", options: ["Sunlight", "Coal", "Oil", "Gas"], answer: "Sunlight", subject: "Science" },
    { prompt: "What is 100 - 37?", options: ["53", "63", "67", "73"], answer: "63", subject: "Math" },
    { prompt: "Which word means the opposite of 'hot'?", options: ["Warm", "Cold", "Dry", "Bright"], answer: "Cold", subject: "Reading" },
  ],
};

const subjectSkills: Record<string, string[]> = {
  math: ["number sense", "shapes", "patterns", "math"],
  reading: ["vocabulary", "phonics", "reading"],
  science: ["animals", "science"],
  nature: ["animals", "general-knowledge"],
  numbers: ["number sense", "math"],
  letters: ["phonics", "vocabulary"],
  shapes: ["shapes"],
  colors: ["classification", "general-knowledge"],
};

const EarlyQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const reward = useEarlyReward();
  const { rows } = useEarlyProgress();

  const grade = String(user?.grade || "").trim().toLowerCase();
  const earlyTier = getUserTier(user?.grade);
  const gradeMatch = /^(?:grade\s*)?(\d{1,2})\+?$/.exec(grade);
  const numericGrade = gradeMatch ? Number(gradeMatch[1]) : 0;
  const key = earlyTier === "early" ? (numericGrade <= 0 ? "k" : numericGrade <= 2 ? "g1" : "g3") : "k";

  const questions = useMemo(() => {
    const base = sets[key] ?? sets.k;
    const skillStats = new Map<string, { attempts: number; correct: number }>();

    rows.forEach((row) => {
      skillStats.set(row.skill, {
        attempts: row.attempts,
        correct: row.correct_answers,
      });
    });

    const weakness = (subject: string) => {
      const skills = subjectSkills[subject.toLowerCase()] ?? [];
      const stats = skills
        .map((skill) => skillStats.get(skill))
        .filter(Boolean) as { attempts: number; correct: number }[];

      if (!stats.length) return 0;
      const attempts = stats.reduce((sum, s) => sum + s.attempts, 0);
      const correct = stats.reduce((sum, s) => sum + s.correct, 0);
      return attempts === 0 ? 0.5 : 1 - correct / attempts;
    };

    return [...base].sort((a, b) => weakness(b.subject) - weakness(a.subject));
  }, [key, rows]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const current = questions[index];

  const choose = async (value: string) => {
    if (selected || !current) return;
    setSelected(value);

    const correct = value === current.answer;
    if (correct) {
      setScore((s) => s + 1);
      await reward("quizCorrect", {
        activityId: `quiz-${current.subject.toLowerCase()}`,
        skill: subjectSkills[current.subject.toLowerCase()]?.[0] ?? "general",
        completed: index === questions.length - 1,
      });
    }

    window.setTimeout(() => {
      if (index === questions.length - 1) {
        setDone(true);
      } else {
        setIndex((i) => i + 1);
        setSelected(null);
      }
    }, 700);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-24">
        <div className="mx-auto max-w-xl">
          <Card className="rounded-[2rem] text-center">
            <CardContent className="space-y-5 p-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-4xl">🏆</div>
              <Badge variant="secondary">{score} / {questions.length} correct</Badge>
              <h1 className="text-3xl font-display font-bold">You did it!</h1>
              <p className="text-muted-foreground">You earned rewards for practising.</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => { setIndex(0); setScore(0); setDone(false); setSelected(null); }}>
                  <Sparkles className="mr-2 h-4 w-4" />Play again
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>Home</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-5 pb-24">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back"><ArrowLeft /></Button>
          <div className="flex items-center gap-2"><CircleHelp className="h-6 w-6 text-primary" /><span className="font-display font-bold">Quick Quiz</span></div>
          <Badge variant="secondary">{index + 1}/{questions.length}</Badge>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
        </div>

        <Card className="rounded-[2rem]">
          <CardContent className="space-y-6 p-5 sm:p-8">
            <div>
              <Badge variant="outline">{current.subject}</Badge>
              <h1 className="mt-4 text-3xl font-display font-bold leading-tight">{current.prompt}</h1>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {current.options.map((option) => (
                <Button
                  key={option}
                  variant="outline"
                  onClick={() => void choose(option)}
                  className={`min-h-20 rounded-3xl text-lg font-bold ${selected === option ? (option === current.answer ? "border-success bg-success/10 text-success" : "border-destructive bg-destructive/10 text-destructive") : ""}`}
                >
                  {selected === option ? (option === current.answer ? <CheckCircle2 className="mr-2 h-5 w-5" /> : <XCircle className="mr-2 h-5 w-5" />) : null}
                  {option}
                </Button>
              ))}
            </div>

            {selected && (
              <p className="text-center font-semibold" role="status">
                {selected === current.answer ? "Great job!" : "Keep going — the next one is yours!"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EarlyQuizPage;
