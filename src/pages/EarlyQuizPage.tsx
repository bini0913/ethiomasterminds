import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Lightbulb, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useEarlyReward } from "@/hooks/useEarlyReward";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGradeProfile, toEarlyGrade } from "@/features/early/engine/gradeProfile";
import { freshnessOrder, readExposure, recordExposure, shuffle } from "@/features/early/engine/exposure";
import { generateMath, QUIZ_BANK, QUIZ_SUBJECTS, type QuizItem, type QuizSubject } from "@/features/early/content/quizBank";
import { FeedbackOverlay } from "@/features/early/feedback/FeedbackOverlay";

type Pick = QuizSubject | "Mix";

const EarlyQuizPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const reward = useEarlyReward();
  const grade = toEarlyGrade(user?.grade);
  const profile = getGradeProfile(grade);

  const [subject, setSubject] = useState<Pick | null>(null);
  const [questions, setQuestions] = useState<QuizItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(profile.hints);
  const [hidden, setHidden] = useState<string[]>([]);
  const [done, setDone] = useState(false);\n  const [secondsLeft, setSecondsLeft] = useState(profile.timerSeconds);

  const counts = useMemo(() => Object.fromEntries(QUIZ_SUBJECTS.map((s) => [s.id, s.id === "Math" ? "∞" : QUIZ_BANK.filter((q) => q.subject === s.id && grade >= q.gradeMin && grade <= q.gradeMax).length])), [grade]);

  const build = useCallback((pick: Pick): QuizItem[] => {
    const store = readExposure(user?.id, "quiz");
    const subjects = pick === "Mix" ? QUIZ_SUBJECTS.map((s) => s.id) : [pick];
    const pool: QuizItem[] = [];
    subjects.forEach((s) => {
      if (s === "Math") {
        const n = pick === "Mix" ? 3 : profile.sessionLength;
        for (let i = 0; i < n; i++) pool.push(generateMath(grade, profile.choices));
      } else {
        // Prefer exact grade, then one grade below as warm-up.
        const fit = QUIZ_BANK.filter((q) => q.subject === s && grade >= q.gradeMin && grade <= q.gradeMax);
        pool.push(...freshnessOrder(fit, store));
      }
    });
    const ordered = pick === "Mix" ? freshnessOrder(pool, store) : pool;
    return ordered.slice(0, profile.sessionLength).sort((a, b) => a.difficulty - b.difficulty).map((q) => {
      // Trim choices to the grade's choice count while keeping the answer.
      const others = shuffle(q.options.filter((o) => o !== q.answer)).slice(0, profile.choices - 1);
      return { ...q, options: shuffle([q.answer, ...others]) };
    });
  }, [grade, profile, user?.id]);

  const start = (pick: Pick) => {
    setSubject(pick); setQuestions(build(pick)); setIndex(0); setScore(0); setStreak(0);
    setSelected(null); setDone(false); setHintsLeft(profile.hints); setHidden([]);
  };

  const current = questions[index];
  const skillFor = (q: QuizItem) => QUIZ_SUBJECTS.find((s) => s.id === q.subject)?.skill ?? "general";

  const choose = (value: string) => {
    if (selected || !current) return;
    setSelected(value);
    const correct = value === current.answer;
    recordExposure(user?.id, "quiz", current.id, correct);
    if (correct) {
      setScore((s) => s + 1); setStreak((s) => s + 1);
      void reward("quizCorrect", { activityId: `early-quiz-${current.subject.toLowerCase()}`, skill: skillFor(current), completed: index === questions.length - 1 });
    } else setStreak(0);
  };

  const next = () => {
    if (index >= questions.length - 1) { setDone(true); return; }
    setIndex((i) => i + 1); setSelected(null); setHidden([]);
  };

  const useHint = () => {
    if (!current || hintsLeft <= 0 || selected) return;
    const wrong = current.options.filter((o) => o !== current.answer && !hidden.includes(o));
    if (wrong.length <= 1) return;
    setHidden((h) => [...h, wrong[Math.floor(Math.random() * wrong.length)]]);
    setHintsLeft((n) => n - 1);
  };

  const Header = ({ right }: { right?: React.ReactNode }) => (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="icon" onClick={() => (subject && !done ? setSubject(null) : navigate("/"))} aria-label="Back"><ArrowLeft /></Button>
      <span className="font-display font-bold">Quiz • {profile.label}</span>
      <div className="min-w-10 text-right">{right}</div>
    </div>
  );

  if (!subject) {
    return (
      <div className="min-h-screen bg-background px-4 py-5 pb-24">
        <div className="mx-auto max-w-2xl space-y-5">
          <Header />
          <div>
            <h1 className="font-display text-3xl font-bold">Pick a quiz</h1>
            <p className="text-muted-foreground">Questions are made for {profile.label}. Wrong answers teach you the trick!</p>
          </div>
          <Button size="lg" onClick={() => start("Mix")} className="min-h-20 w-full rounded-3xl text-xl font-bold"><Sparkles className="mr-2" />Mixed challenge</Button>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUIZ_SUBJECTS.map((s) => (
              <button key={s.id} onClick={() => start(s.id)} disabled={counts[s.id] === 0} className="min-h-32 rounded-3xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-1 active:scale-[.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="text-4xl" aria-hidden="true">{s.icon}</div>
                <p className="mt-2 font-display text-lg font-bold">{s.id}</p>
                <p className="text-xs text-muted-foreground">{counts[s.id]} questions</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((score / Math.max(questions.length, 1)) * 100);
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-24">
        <div className="mx-auto max-w-xl">
          <Card className="rounded-[2rem] text-center">
            <CardContent className="space-y-5 p-8">
              <div className="early-pop mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success/15 text-5xl">{pct >= 80 ? "🏆" : pct >= 50 ? "🌟" : "💪"}</div>
              <div className="text-3xl" aria-label={`${pct >= 80 ? 3 : pct >= 50 ? 2 : 1} stars`}>{"⭐".repeat(pct >= 80 ? 3 : pct >= 50 ? 2 : 1)}</div>
              <h1 className="font-display text-3xl font-bold">{pct >= 80 ? "Superstar!" : pct >= 50 ? "Great work!" : "You're learning!"}</h1>
              <Badge variant="secondary" className="text-base">{score} / {questions.length} correct</Badge>
              <div className="flex gap-3">
                <Button className="flex-1 min-h-12" onClick={() => start(subject)}><Sparkles className="mr-2 h-4 w-4" />Play again</Button>
                <Button variant="outline" className="flex-1 min-h-12" onClick={() => setSubject(null)}>New quiz</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-5 pb-48">
      <div className="mx-auto max-w-2xl space-y-5">
        <Header right={<Badge variant="secondary">{index + 1}/{questions.length}</Badge>} />
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="outline">{current.subject}</Badge>
          {streak >= 2 && <span className="early-pop text-sm font-bold text-warning">🔥 {streak} in a row!</span>}
        </div>
        <h1 className="font-display text-3xl font-bold leading-tight">{current.prompt}</h1>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {current.options.map((option, i) => {
            const isPicked = selected === option, isAnswer = option === current.answer;
            const tone = selected ? (isAnswer ? "border-success bg-success/10 text-success early-pop" : isPicked ? "border-destructive bg-destructive/10 text-destructive early-shake" : "opacity-60") : "";
            return (
              <button key={option} disabled={!!selected || hidden.includes(option)} onClick={() => choose(option)}
                className={`flex min-h-20 items-center gap-3 rounded-3xl border-2 border-b-4 border-border bg-card px-4 text-left text-lg font-bold transition active:translate-y-0.5 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${hidden.includes(option) ? "invisible" : ""} ${tone}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-current text-sm">{String.fromCharCode(65 + i)}</span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
        {!selected && hintsLeft > 0 && current.options.length > 2 && (
          <Button variant="ghost" onClick={useHint} className="min-h-12"><Lightbulb className="mr-2 h-5 w-5 text-warning" />Use a hint ({hintsLeft} left)</Button>
        )}
      </div>
      {selected && <FeedbackOverlay state={selected === current.answer ? "correct" : "wrong"} answer={selected === "__TIMEOUT__" ? `Time! The answer was ${current.answer}` : current.answer} explain={selected === "__TIMEOUT__" ? "The timer ended. Take a breath and try the next one." : current.explain} onNext={next} />}
    </div>
  );
};

export default EarlyQuizPage;
