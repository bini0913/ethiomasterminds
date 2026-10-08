import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, GraduationCap, RotateCcw, Trophy, XCircle } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useQuiz, Question, Quiz } from "@/context/QuizContext";
import { getAcademicProfile, normalizeGrade, normalizeSubject, subjectsMatch } from "@/lib/academicProfile";
import { recordAcademicProgress } from "@/lib/academicProgress";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type ExamState = "setup" | "running" | "results";
type ExamQuestion = Question & { sourceQuizId: string; sourceQuizTitle: string };

const difficultyOrder: Record<string, string[]> = {
  Easy: ["Easy", "Medium", "Hard", "Extreme"],
  Medium: ["Medium", "Easy", "Hard", "Extreme"],
  Hard: ["Hard", "Medium", "Extreme", "Easy"],
  Extreme: ["Extreme", "Hard", "Medium", "Easy"],
};

const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const ExamModePage: React.FC = () => {
  const { user } = useUser();
  const { quizzes, loading: quizzesLoading } = useQuiz();
  const navigate = useNavigate();
  const [examState, setExamState] = useState<ExamState>("setup");
  const [grade, setGrade] = useState(normalizeGrade(user?.grade, 9));
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState("math");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(35);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState<{ correct: number; total: number; details: Array<{ q: ExamQuestion; answer: string; correct: boolean }> } | null>(null);
  const [saving, setSaving] = useState(false);
  const submitted = useRef(false);
  const startedAt = useRef(Date.now());
  const questionTimes = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user?.id) return;
    getAcademicProfile(user.id).then(async (profile) => {
      const nextGrade = normalizeGrade(profile?.grade, normalizeGrade(user.grade, 9));
      const nextSubjects = (profile?.subjects || []).map(normalizeSubject);
      setGrade(nextGrade);
      setSubjects(nextSubjects);
      if (nextSubjects.length) setSubject(nextSubjects[0]);

      const { data } = await supabase.from("quiz_results")
        .select("correct_answers,total_questions")
        .eq("student_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(8);
      const total = (data || []).reduce((n, row) => n + Number(row.total_questions || 0), 0);
      const correct = (data || []).reduce((n, row) => n + Number(row.correct_answers || 0), 0);
      const accuracy = total ? correct / total * 100 : 65;
      setDifficulty(accuracy >= 85 ? "Hard" : accuracy >= 70 ? "Medium" : "Easy");
    }).catch(() => {});
  }, [user?.id, user?.grade]);

  useEffect(() => {
    if (examState !== "running") return;
    const id = window.setInterval(() => setTimeLeft((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [examState]);

  useEffect(() => {
    if (examState === "running" && timeLeft === 0) submitExam();
  }, [examState, timeLeft]);

  const subjectQuizzes = useMemo(() => quizzes.filter((quiz) =>
    quiz.grade === grade && subjects.some((s) => subjectsMatch(s, quiz.subject)) && subjectsMatch(subject, quiz.subject)
  ), [quizzes, grade, subjects, subject]);

  const availableQuestions = useMemo(() => subjectQuizzes.reduce((n, q) => n + q.questions.length, 0), [subjectQuizzes]);

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const buildExam = (count: number) => {
    const grouped = new Map<string, Quiz[]>();
    (difficultyOrder[difficulty] || difficultyOrder.Medium).forEach((d) => grouped.set(d, []));
    subjectQuizzes.forEach((quiz) => {
      const key = label(quiz.difficulty);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(quiz);
    });

    const pool: ExamQuestion[] = [];
    const seen = new Set<string>();
    for (const level of difficultyOrder[difficulty] || difficultyOrder.Medium) {
      const source = [...(grouped.get(level) || [])].sort(() => Math.random() - 0.5);
      for (const quiz of source) {
        for (const question of [...quiz.questions].sort(() => Math.random() - 0.5)) {
          if (seen.has(question.id)) continue;
          seen.add(question.id);
          pool.push({ ...question, sourceQuizId: quiz.id, sourceQuizTitle: quiz.title });
        }
      }
    }
    return pool.slice(0, count);
  };

  const startExam = () => {
    if (!subjectQuizzes.length) {
      toast.error(`No approved Grade ${grade} content is available for this subject yet.`);
      return;
    }
    const count = Math.min(questionCount, availableQuestions);
    if (count < 10) {
      toast.error("At least 10 approved questions are required to start an exam.");
      return;
    }
    if (count < questionCount) toast.info(`Using ${count} questions, the current approved content limit.`);

    const exam = buildExam(count);
    if (!exam.length) return toast.error("We couldn't build this exam from the approved quiz bank.");

    setQuestions(exam);
    setQuestionCount(exam.length);
    setTimeLeft(Math.max(600, Math.round(timeLimit * 60 * (exam.length / Math.max(questionCount, 1)))));
    setAnswers({});
    setCurrent(0);
    setResults(null);
    questionTimes.current = {};
    submitted.current = false;
    startedAt.current = Date.now();
    setExamState("running");
  };

  const chooseAnswer = (answer: string) => {
    const q = questions[current];
    if (!q) return;
    questionTimes.current[q.id] = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    setAnswers((prev) => ({ ...prev, [q.id]: answer }));
  };

  const submitExam = async () => {
    if (submitted.current || !questions.length) return;
    submitted.current = true;
    setSaving(true);

    const details = questions.map((q) => {
      const answer = answers[q.id] || "";
      return { q, answer, correct: answer === q.correctAnswer };
    });
    const correct = details.filter((x) => x.correct).length;
    const score = Math.round(correct / questions.length * 100);
    const totalTime = Object.values(questionTimes.current).reduce((a, b) => a + b, 0);
    const xp = correct * 5;

    setResults({ correct, total: questions.length, details });
    setExamState("results");

    if (user?.id) {
      try {
        const { error } = await supabase.from("quiz_results").insert({
          quiz_id: details[0].q.sourceQuizId,
          student_id: user.id,
          score,
          total_questions: questions.length,
          correct_answers: correct,
          time_taken: totalTime,
          xp_earned: xp,
          completed_at: new Date().toISOString(),
          answers: Object.fromEntries(details.map((x) => [x.q.id, { answer: x.answer, correct: x.correct, source_quiz_id: x.q.sourceQuizId }])),
        });
        if (error) console.error("Exam result save failed:", error);

        const { error: attemptsError } = await supabase.from("question_attempts").insert(details.map((x) => ({
          user_id: user.id,
          question_id: x.q.id,
          quiz_id: x.q.sourceQuizId,
          selected_answer: x.answer || "no_answer",
          is_correct: x.correct,
          time_taken_seconds: questionTimes.current[x.q.id] || 0,
          attempt_number: 1,
        })));
        if (attemptsError) console.error("Exam attempts save failed:", attemptsError);

        await recordAcademicProgress({ userId: user.id, subject, correct, total: questions.length, timeSeconds: totalTime });
        await supabase.rpc("update_user_streak", { p_user_id: user.id });
        if (xp) await supabase.rpc("add_xp", { p_user_id: user.id, p_amount: xp });
      } catch (error) {
        console.error("Exam persistence failed:", error);
        toast.error("The exam finished, but some progress could not be saved.");
      }
    }
    setSaving(false);
  };

  if (quizzesLoading || !subjects.length) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center"><div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" /><p className="text-sm text-muted-foreground">Loading your academic question bank…</p></div>
    </div>
  );

  if (examState === "setup") return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background"><div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/academic")}><ArrowLeft className="h-5 w-5" /></Button>
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Grade {grade}</p><h1 className="text-xl font-bold">Exam Mode</h1></div>
      </div></header>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-24">
        <Card><CardContent className="p-6 sm:p-8">
          <Badge variant="secondary">Same content as Quiz</Badge>
          <h2 className="mt-3 text-2xl font-bold">Build a real practice exam</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Every question is taken from the approved Grade {grade} quiz bank. Your recent accuracy controls the difficulty mix, so Academic Prep and normal Quiz always share the same source content.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Subject pool</p><p className="mt-1 text-2xl font-bold">{availableQuestions}</p><p className="text-xs text-muted-foreground">approved questions</p></div>
            <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Adaptive level</p><p className="mt-1 text-2xl font-bold">{difficulty}</p><p className="text-xs text-muted-foreground">from recent results</p></div>
            <div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Data connection</p><p className="mt-1 text-2xl font-bold">Live</p><p className="text-xs text-muted-foreground">results + progress</p></div>
          </div>
        </CardContent></Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="p-5"><p className="text-sm font-medium">Subject</p><Select value={subject} onValueChange={setSubject}><SelectTrigger className="mt-3"><SelectValue /></SelectTrigger><SelectContent>{subjects.map((s) => <SelectItem key={s} value={s}>{s === "math" ? "Mathematics" : s.replace(/\b\w/g, (m) => m.toUpperCase())}</SelectItem>)}</SelectContent></Select></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm font-medium">Questions</p><Select value={String(questionCount)} onValueChange={(v) => setQuestionCount(Number(v))}><SelectTrigger className="mt-3"><SelectValue /></SelectTrigger><SelectContent>{[10,20,30,40].map((n) => <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>)}</SelectContent></Select></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm font-medium">Time</p><Select value={String(timeLimit)} onValueChange={(v) => setTimeLimit(Number(v))}><SelectTrigger className="mt-3"><SelectValue /></SelectTrigger><SelectContent>{[20,35,50,65].map((n) => <SelectItem key={n} value={String(n)}>{n} minutes</SelectItem>)}</SelectContent></Select></CardContent></Card>
        </div>

        <Card className="border-primary/20 bg-primary/5"><CardContent className="p-5 flex gap-3"><GraduationCap className="h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">Fully connected preparation</p><p className="mt-1 text-sm text-muted-foreground">Exam answers are saved against their real question and source quiz IDs, then sent into Academic Insights, subject progress, streaks and XP.</p></div></CardContent></Card>
        <Button className="h-12 w-full text-base" onClick={startExam}>Start Grade {grade} {subject === "math" ? "Mathematics" : subject} Exam</Button>
      </main>
    </div>
  );

  if (examState === "results" && results) {
    const pct = Math.round(results.correct / results.total * 100);
    return (
      <div className="min-h-screen bg-muted/20">
        <header className="border-b bg-background"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4"><div className="flex items-center gap-3"><Trophy className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Grade {grade} • {subject}</p><h1 className="font-bold">Exam results</h1></div></div><Button variant="outline" onClick={() => setExamState("setup")}><RotateCcw className="mr-2 h-4 w-4" />New exam</Button></div></header>
        <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 pb-24">
          <Card><CardContent className="p-7 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary"><Trophy className="h-10 w-10" /></div><p className="mt-5 text-5xl font-bold">{pct}%</p><p className="mt-1 text-muted-foreground">{results.correct} of {results.total} correct</p><Badge className="mt-4">{pct >= 85 ? "Excellent" : pct >= 70 ? "Strong progress" : "Keep practicing"}</Badge>{saving && <p className="mt-3 text-xs text-muted-foreground">Saving progress…</p>}</CardContent></Card>
          <Card><CardContent className="p-4 sm:p-6"><h2 className="font-semibold">Review your exam</h2><p className="mb-4 text-sm text-muted-foreground">These are the same approved questions used by normal Quiz.</p><div className="space-y-2">{results.details.map((x, i) => <div key={x.q.id} className="rounded-xl border p-4"><div className="flex gap-3">{x.correct ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" /> : <XCircle className="h-5 w-5 shrink-0 text-destructive" />}<div><p className="text-sm font-medium">{i + 1}. {x.q.text}</p><p className="mt-2 text-xs text-muted-foreground">Your answer: <span className="font-medium text-foreground">{x.answer || "No answer"}</span></p>{!x.correct && <p className="mt-1 text-xs text-muted-foreground">Correct: <span className="font-medium text-green-600">{x.q.correctAnswer}</span></p>}{x.q.explanation && <p className="mt-2 text-xs leading-5 text-muted-foreground">{x.q.explanation}</p>}</div></div></div>)}</div></CardContent></Card>
        </main>
      </div>
    );
  }

  const q = questions[current];
  if (!q) return null;
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur"><div className="mx-auto max-w-4xl px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{subject} • Grade {grade}</p><p className="font-semibold">Question {current + 1} of {questions.length}</p></div><div className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono font-semibold ${timeLeft <= 60 ? "border-destructive/40 text-destructive" : ""}`}><Clock3 className="h-4 w-4" />{formatTime(timeLeft)}</div></div><Progress value={(current + 1) / questions.length * 100} className="mt-3 h-1.5" /></div></header>
      <main className="mx-auto max-w-2xl px-4 py-6 pb-24"><Card><CardContent className="p-5 sm:p-7"><div className="mb-5 flex flex-wrap gap-2"><Badge variant="secondary">{q.difficulty}</Badge><Badge variant="outline">{q.sourceQuizTitle}</Badge></div><h2 className="text-lg font-semibold leading-7 sm:text-xl">{q.text}</h2><div className="mt-6 space-y-3">{q.options.map((option, i) => { const selected = answers[q.id] === option; return <button key={q.id + i} type="button" onClick={() => chooseAnswer(option)} className={`w-full rounded-xl border p-4 text-left text-sm transition ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}><span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold">{String.fromCharCode(65 + i)}</span>{option}</button>; })}</div></CardContent></Card><div className="mt-4 flex items-center justify-between gap-3"><Button variant="outline" disabled={current === 0} onClick={() => { setCurrent((v) => v - 1); startedAt.current = Date.now(); }}>Previous</Button>{current < questions.length - 1 ? <Button onClick={() => { setCurrent((v) => v + 1); startedAt.current = Date.now(); }}>Next</Button> : <Button onClick={submitExam} disabled={saving}>Submit exam</Button>}</div></main>
    </div>
  );
};

export default ExamModePage;