import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock3, Target, Trophy, CheckCircle2, XCircle, BookOpen, GraduationCap, Loader2, RotateCcw, ChevronLeft, ChevronRight, CircleHelp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getAcademicProfile, normalizeGrade, normalizeSubject, subjectsMatch } from "@/lib/academicProfile";

type ExamState = "setup" | "running" | "results";
type SourceQuiz = { id: string; title: string; description?: string; subject: string; grade: number; difficulty?: string; time_limit?: number | null; questionCount: number };
type ExamQuestion = { id: string; question_text: string; options: string[]; correct_answer: string; explanation?: string; topic?: string };

function answerText(answer: unknown, options: string[]) {
  const value = String(answer ?? "").trim();
  if (options.includes(value)) return value;
  const letter = value.toUpperCase().match(/^(?:OPTION\s*)?([A-D])(?:[.)])?$/)?.[1];
  if (letter) return options["ABCD".indexOf(letter)] ?? value;
  const index = Number(value);
  if (Number.isInteger(index) && index >= 0 && index < options.length) return options[index];
  return value;
}

function parseOptions(row: any): string[] {
  if (Array.isArray(row.options)) return row.options.filter((item: unknown) => typeof item === "string" && item.trim()).map((item: string) => item.trim());
  return [row.option_a, row.option_b, row.option_c, row.option_d].filter((item) => typeof item === "string" && item.trim());
}

const prettySubject = (subject: string) => subject === "math" ? "Mathematics" : subject.replace(/\b\w/g, (letter) => letter.toUpperCase());

const ExamModePage: React.FC = () => {
  const { user, refreshProfile } = useUser();
  const navigate = useNavigate();
  const [examState, setExamState] = useState<ExamState>("setup");
  const [subject, setSubject] = useState("math");
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(30);
  const [sourceQuizId, setSourceQuizId] = useState("");
  const [sourceQuizzes, setSourceQuizzes] = useState<SourceQuiz[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoadingBank, setIsLoadingBank] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<{ correct: number; total: number; details: Array<{ q: ExamQuestion; answer: string; correct: boolean }> } | null>(null);
  const [profileSubjects, setProfileSubjects] = useState<string[]>([]);
  const [grade, setGrade] = useState(9);
  const [goal, setGoal] = useState("School / Class");
  const startedAtRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const submitExamRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setIsLoadingBank(true);
      try {
        const profile = await getAcademicProfile(user.id);
        if (cancelled) return;
        const activeGrade = normalizeGrade(profile?.grade ?? user.grade, 9);
        const allowed = (profile?.subjects?.length ? profile.subjects : ["math", "science", "english", "history"]).map(normalizeSubject);
        setGrade(activeGrade);
        setProfileSubjects(allowed);
        setSubject((current) => allowed.includes(current) ? current : allowed[0] || "math");
        setGoal(profile?.study_goal_detail || profile?.study_goal || "School / Class");

        // Academic Prep and regular Quizzes share the same approved quizzes + linked question bank.
        const { data: quizRows, error: quizError } = await supabase
          .from("quizzes")
          .select("id,title,description,subject,grade,difficulty,time_limit")
          .eq("is_approved", true);
        if (quizError) throw quizError;
        const matching = (quizRows || []).filter((quiz: any) =>
          normalizeGrade(quiz.grade, activeGrade) === activeGrade &&
          allowed.some((profileSubject) => subjectsMatch(profileSubject, quiz.subject || ""))
        );
        if (!matching.length) {
          setSourceQuizzes([]);
          setSourceQuizId("");
          return;
        }
        const { data: questionRows, error: questionError } = await supabase
          .from("questions")
          .select("id,quiz_id,question_text,options,option_a,option_b,option_c,option_d,correct_answer,explanation,order_index")
          .in("quiz_id", matching.map((quiz: any) => quiz.id))
          .order("order_index", { ascending: true });
        if (questionError) throw questionError;
        const countByQuiz = new Map<string, number>();
        (questionRows || []).forEach((row: any) => {
          const options = parseOptions(row);
          if (row.question_text && options.length >= 2 && row.correct_answer != null) {
            countByQuiz.set(row.quiz_id, (countByQuiz.get(row.quiz_id) || 0) + 1);
          }
        });
        const available = matching
          .map((quiz: any) => ({ ...quiz, subject: normalizeSubject(quiz.subject || ""), grade: activeGrade, questionCount: countByQuiz.get(quiz.id) || 0 }))
          .filter((quiz: SourceQuiz) => quiz.questionCount > 0)
          .sort((a: SourceQuiz, b: SourceQuiz) => b.questionCount - a.questionCount || a.title.localeCompare(b.title));
        if (cancelled) return;
        setSourceQuizzes(available);
        setSourceQuizId((current) => available.some((quiz) => quiz.id === current) ? current : available[0]?.id || "");
      } catch (error) {
        console.error("Academic exam bank load failed:", error);
        if (!cancelled) toast.error("We couldn't load the approved quiz bank. Please try again.");
      } finally {
        if (!cancelled) setIsLoadingBank(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.grade]);

  const subjectQuizzes = useMemo(() => sourceQuizzes.filter((quiz) => subjectsMatch(subject, quiz.subject)), [sourceQuizzes, subject]);
  const selectedQuiz = useMemo(() => subjectQuizzes.find((quiz) => quiz.id === sourceQuizId) || subjectQuizzes[0] || null, [subjectQuizzes, sourceQuizId]);
  const currentQuestion = questions[currentQ];
  const unansweredCount = questions.length - Object.keys(answers).length;

  useEffect(() => {
    if (!subjectQuizzes.length) {
      setSourceQuizId("");
      return;
    }
    if (!subjectQuizzes.some((quiz) => quiz.id === sourceQuizId)) setSourceQuizId(subjectQuizzes[0].id);
  }, [subjectQuizzes, sourceQuizId]);

  const submitExam = useCallback(async () => {
    if (examState !== "running" || submittedRef.current || !questions.length) return;
    submittedRef.current = true;
    setIsSaving(true);
    const details = questions.map((q, index) => ({
      q,
      answer: answers[index] || "",
      correct: answerText(answers[index], q.options) === answerText(q.correct_answer, q.options),
    }));
    const correct = details.filter((item) => item.correct).length;
    setResults({ correct, total: questions.length, details });
    setExamState("results");
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    if (user?.id && selectedQuiz?.id) {
      const { error } = await supabase.from("quiz_results").insert({
        quiz_id: selectedQuiz.id,
        student_id: user.id,
        score: Math.round((correct / questions.length) * 100),
        total_questions: questions.length,
        correct_answers: correct,
        time_taken: elapsedSeconds,
        xp_earned: correct * 5,
      });
      if (error) {
        console.error("Could not save exam result:", error);
        toast.error("Your result is shown, but couldn't be saved to your progress. Please try again later.");
      } else {
        if (correct > 0) {
          const { error: xpError } = await supabase.rpc("add_xp", { p_user_id: user.id, p_amount: correct * 5 });
          if (xpError) console.error("Exam XP award failed:", xpError);
        }
        await refreshProfile?.();
        toast.success("Exam result saved to your academic progress.");
      }
    }
    setIsSaving(false);
  }, [examState, questions, answers, user?.id, selectedQuiz?.id, refreshProfile]);
  submitExamRef.current = () => { void submitExam(); };

  useEffect(() => {
    if (examState !== "running") return;
    const timer = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          window.setTimeout(() => submitExamRef.current(), 0);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examState]);

  const startExam = async () => {
    if (!user?.id || !selectedQuiz) {
      toast.error("Choose a subject and an approved question set first.");
      return;
    }
    setIsStarting(true);
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("id,quiz_id,question_text,options,option_a,option_b,option_c,option_d,correct_answer,explanation,order_index")
        .eq("quiz_id", selectedQuiz.id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      const parsed = (data || []).map((row: any) => {
        const options = parseOptions(row);
        return {
          id: row.id,
          question_text: String(row.question_text || ""),
          options,
          correct_answer: answerText(row.correct_answer, options),
          explanation: row.explanation || undefined,
          topic: row.topic || "General",
        };
      }).filter((question: ExamQuestion) => question.question_text && question.options.length >= 2 && question.options.includes(question.correct_answer));
      if (!parsed.length) {
        toast.error("This approved quiz doesn't have usable questions yet.");
        return;
      }
      const count = Math.min(questionCount, parsed.length);
      const selected = [...parsed].sort(() => Math.random() - 0.5).slice(0, count);
      if (parsed.length < questionCount) toast.info(`This quiz has ${parsed.length} usable questions, so your exam will use all ${parsed.length}.`);
      setQuestions(selected);
      setAnswers({});
      setCurrentQ(0);
      setResults(null);
      submittedRef.current = false;
      setTimeLeft(Math.max(60, Math.round(timeLimit * 60 * (count / questionCount))));
      startedAtRef.current = Date.now();
      setExamState("running");
    } catch (error) {
      console.error("Unable to start Academic Prep exam:", error);
      toast.error("Couldn't start this exam. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const resetExam = () => {
    submittedRef.current = false;
    setResults(null);
    setQuestions([]);
    setAnswers({});
    setCurrentQ(0);
    setExamState("setup");
  };

  const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <header className="border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <Button variant="outline" size="icon" aria-label="Back to Academic Prep" onClick={() => navigate("/academic")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Minds · Grade {grade}</p><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>
        <Badge variant="outline" className="hidden sm:flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Approved quiz bank</Badge>
      </div>
    </header>
  );

  if (examState === "setup") {
    return (
      <div className="min-h-screen bg-muted/30">
        <Header title="Exam practice" subtitle="Practice with the same approved questions used in Quizzes." />
        <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:py-10">
          <section className="space-y-5">
            <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary"><GraduationCap className="h-7 w-7" /></div>
                <div><p className="text-sm font-semibold text-primary">Your exam workspace</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Prepare with purpose.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Questions come from approved Grade {grade} quizzes, so your exam practice, curriculum subjects and regular quiz content stay aligned.</p></div>
              </div>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><label className="text-sm font-medium">Subject</label><Select value={subject} onValueChange={setSubject}><SelectTrigger className="h-12"><SelectValue placeholder="Choose subject" /></SelectTrigger><SelectContent>{profileSubjects.map((value) => <SelectItem key={value} value={value}>{prettySubject(value)}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">Approved quiz set</label><Select value={selectedQuiz?.id || ""} onValueChange={setSourceQuizId} disabled={!subjectQuizzes.length}><SelectTrigger className="h-12"><SelectValue placeholder="Choose quiz set" /></SelectTrigger><SelectContent>{subjectQuizzes.map((quiz) => <SelectItem key={quiz.id} value={quiz.id}>{quiz.title} · {quiz.questionCount} Q</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">Question count</label><Select value={String(questionCount)} onValueChange={(value) => setQuestionCount(Number(value))}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{[10,20,30,50].map((count) => <SelectItem key={count} value={String(count)}>{count} questions</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">Time limit</label><Select value={String(timeLimit)} onValueChange={(value) => setTimeLimit(Number(value))}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{[15,30,45,60].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} minutes</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-primary" /><div><p className="font-semibold">{isLoadingBank ? "Checking your question bank…" : selectedQuiz ? selectedQuiz.title : "No matching quiz set yet"}</p><p className="text-sm text-muted-foreground">{isLoadingBank ? "Loading approved content" : selectedQuiz ? `${selectedQuiz.questionCount} usable questions · ${prettySubject(selectedQuiz.subject)} · Grade ${grade}` : "Try another subject or ask your teacher to publish an approved quiz."}</p></div></div>
                <Badge variant="secondary">{goal}</Badge>
              </div>
              <Button className="mt-6 h-12 w-full text-base" onClick={startExam} disabled={isLoadingBank || isStarting || !selectedQuiz}>{isStarting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing exam…</> : <><Target className="mr-2 h-4 w-4" />Start exam</>}</Button>
              {!isLoadingBank && !sourceQuizzes.length && <p className="mt-3 text-sm text-muted-foreground">No approved Grade {grade} quizzes with usable questions match your saved subjects yet. The exam will become available when matching quizzes are approved and published.</p>}
            </div>
          </section>
          <aside className="space-y-4">
            <Card className="rounded-3xl"><CardContent className="p-6"><h3 className="font-semibold">What to expect</h3><div className="mt-4 space-y-4">{[{icon: ShieldCheck,title:"Real quiz content",text:"Only questions linked to approved quizzes are included."},{icon: Clock3,title:"Timed practice",text:"Move between questions and submit when you're ready."},{icon: Trophy,title:"Progress that counts",text:"Your score and XP are saved after submission."}].map((item) => <div key={item.title} className="flex gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><item.icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-sm leading-5 text-muted-foreground">{item.text}</p></div></div>)}</div></CardContent></Card>
            <Card className="rounded-3xl border-dashed bg-transparent shadow-none"><CardContent className="p-5"><p className="text-sm font-semibold">Your study profile</p><p className="mt-1 text-sm text-muted-foreground">Grade {grade} · {profileSubjects.map(prettySubject).join(", ") || "Subjects not set"}</p><Button variant="link" className="mt-2 h-auto p-0" onClick={() => navigate("/academic/setup")}>Update preparation settings <ChevronRight className="ml-1 h-4 w-4" /></Button></CardContent></Card>
          </aside>
        </main>
      </div>
    );
  }

  if (examState === "results" && results) {
    const percent = results.total ? Math.round((results.correct / results.total) * 100) : 0;
    return (
      <div className="min-h-screen bg-muted/30">
        <Header title="Exam review" subtitle={selectedQuiz?.title || "Your completed practice"} />
        <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
          <Card className="overflow-hidden rounded-3xl"><div className="h-2 bg-primary" /><CardContent className="p-6 text-center sm:p-10"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Trophy className="h-8 w-8" /></div><p className="mt-4 text-sm font-semibold text-primary">Exam completed</p><h2 className="mt-1 text-5xl font-bold tracking-tight">{percent}%</h2><p className="mt-2 text-muted-foreground">{results.correct} correct out of {results.total} questions</p><div className="mx-auto mt-5 max-w-sm"><Progress value={percent} className="h-2.5" /></div><div className="mt-5 flex flex-wrap justify-center gap-2"><Badge variant="secondary">{percent >= 80 ? "Strong result" : percent >= 60 ? "Good progress" : "Keep building confidence"}</Badge><Badge variant="outline">+{results.correct * 5} potential XP</Badge>{isSaving && <Badge variant="outline">Saving progress…</Badge>}</div><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={resetExam}><RotateCcw className="mr-2 h-4 w-4" />Try another exam</Button><Button variant="outline" onClick={() => navigate("/academic/insights")}>View academic insights</Button></div></CardContent></Card>
          <div className="space-y-3"><div><h3 className="text-lg font-bold">Answer review</h3><p className="text-sm text-muted-foreground">Review each response and explanation where one is available.</p></div>{results.details.map((detail, index) => <Card key={detail.q.id} className="rounded-2xl"><CardContent className="flex gap-3 p-4 sm:p-5"><div className={`mt-0.5 rounded-full p-1.5 ${detail.correct ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>{detail.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="font-medium leading-6">{index + 1}. {detail.q.question_text}</p><Badge variant="outline">{detail.correct ? "Correct" : "Review"}</Badge></div>{!detail.correct && <p className="mt-2 text-sm text-muted-foreground">Your answer: <span className="text-foreground">{detail.answer || "Not answered"}</span></p>}<p className="mt-1 text-sm">Correct answer: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{answerText(detail.q.correct_answer, detail.q.options)}</span></p>{detail.q.explanation && <p className="mt-2 rounded-xl bg-muted/60 p-3 text-sm leading-5 text-muted-foreground">{detail.q.explanation}</p>}</div></CardContent></Card>)}</div>
        </main>
      </div>
    );
  }

  if (!currentQuestion) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const timeCritical = timeLeft <= 60;
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur"><div className="mx-auto max-w-4xl px-4 py-4 sm:px-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Timed practice</p><h1 className="font-bold sm:text-lg">{selectedQuiz?.title || "Exam mode"}</h1></div><div className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono font-semibold tabular-nums ${timeCritical ? "border-destructive/40 bg-destructive/10 text-destructive" : "bg-card"}`}><Clock3 className="h-4 w-4" />{formatTime(timeLeft)}</div></div><div className="mt-4 flex items-center justify-between text-sm text-muted-foreground"><span>Question {currentQ + 1} of {questions.length}</span><span>{Object.keys(answers).length} answered · {unansweredCount} remaining</span></div><Progress value={((currentQ + 1) / questions.length) * 100} className="mt-2 h-2" /></div></header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10"><Card className="rounded-3xl shadow-sm"><CardContent className="p-5 sm:p-8"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CircleHelp className="h-4 w-4 text-primary" />{currentQuestion.topic || prettySubject(subject)}</div><h2 className="mt-4 text-xl font-semibold leading-8 sm:text-2xl">{currentQuestion.question_text}</h2><div className="mt-6 grid gap-3">{currentQuestion.options.map((option, index) => {const selected = answers[currentQ] === option; return <button key={`${currentQuestion.id}-${index}`} type="button" onClick={() => setAnswers((previous) => ({ ...previous, [currentQ]: option }))} className={`flex min-h-14 items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background hover:bg-muted/60"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{String.fromCharCode(65 + index)}</span><span className="pt-0.5 text-sm leading-6">{option}</span></button>;})}</div></CardContent></Card><div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><Button variant="outline" className="sm:min-w-32" disabled={currentQ === 0} onClick={() => setCurrentQ((index) => index - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><div className="flex gap-3"><Button variant="outline" onClick={() => setCurrentQ((index) => Math.min(questions.length - 1, index + 1))} disabled={currentQ === questions.length - 1}>Skip <ChevronRight className="ml-1 h-4 w-4" /></Button><Button className="flex-1 sm:min-w-36" onClick={() => currentQ < questions.length - 1 ? setCurrentQ((index) => index + 1) : void submitExam()}>{currentQ < questions.length - 1 ? <>Next question <ChevronRight className="ml-1 h-4 w-4" /></> : "Submit exam"}</Button></div></div><p className="mt-4 text-center text-xs text-muted-foreground">Your answers are not revealed until you submit the exam.</p></main>
    </div>
  );
};

export default ExamModePage;
