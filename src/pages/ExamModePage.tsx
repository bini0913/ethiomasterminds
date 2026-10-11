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
type SourceQuiz = { id: string; title: string; description?: string; subject: string; grade: number; difficulty?: string; time_limit?: number | null; exam_type?: string; questionCount: number };
type ExamQuestion = { id: string; quiz_id?: string; subject?: string; sourceKind: "past_paper" | "topic_practice"; sourceTitle: string; question_text: string; options: string[]; correct_answer: string; explanation?: string; topic?: string };
function goalRelevance(quiz: SourceQuiz, goal: string): number {
  const text = `${quiz.title} ${quiz.description || ""} ${quiz.difficulty || ""} ${(quiz.exam_type || "general").replace(/[_-]+/g, " ")}`.toLowerCase();
  const target = goal.toLowerCase().replace(/[_-]+/g, " ");
  const groups: Array<{ terms: string[]; keywords: string[] }> = [
    { terms: ["exit", "grade 12", "national exam", "school leaving"], keywords: ["exit exam", "grade 12", "school leaving", "national exam", "matriculation"] },
    { terms: ["university entrance", "entrance exam", "college entrance"], keywords: ["entrance", "university", "college", "admission"] },
    { terms: ["past paper", "past papers", "mock exam", "mock test"], keywords: ["past paper", "past exam", "mock", "practice paper"] },
    { terms: ["school", "class", "coursework", "class exam"], keywords: ["school", "class exam", "coursework", "unit test", "chapter test"] },
  ];
  const group = groups.find((item) => item.terms.some((term) => target.includes(term)));
  if (!group) return 0;
  return group.keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
}


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
  const [subject, setSubject] = useState("all_selected");
  const [examTypeFilter, setExamTypeFilter] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(30);
  const [, setSourceQuizId] = useState("");
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
        setSubject("all_selected");
        setGoal([profile?.study_goal || "School / Class", profile?.study_goal_detail || ""].filter(Boolean).join(" "));

        // Academic Prep and regular Quizzes share the same approved quizzes + linked question bank.
        const { data: quizRows, error: quizError } = await supabase
          .from("quizzes")
          .select("id,title,description,subject,grade,difficulty,time_limit,exam_type")
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
          .select("id,quiz_id,question_text,options,option_a,option_b,option_c,option_d,correct_answer,explanation,order_index,topic")
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
          .sort((a: SourceQuiz, b: SourceQuiz) => goalRelevance(b, [profile?.study_goal || "", profile?.study_goal_detail || ""].join(" ")) - goalRelevance(a, [profile?.study_goal || "", profile?.study_goal_detail || ""].join(" ")) || b.questionCount - a.questionCount || a.title.localeCompare(b.title));
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

  const subjectQuizzes = useMemo(() => sourceQuizzes.filter((quiz) => (subject === "all_selected" || subjectsMatch(subject, quiz.subject)) && (examTypeFilter === "mixed" || (examTypeFilter === "past_paper" ? quiz.exam_type === "past_paper" : quiz.exam_type !== "past_paper"))).sort((a, b) => goalRelevance(b, goal) - goalRelevance(a, goal) || b.questionCount - a.questionCount || a.title.localeCompare(b.title)), [sourceQuizzes, subject, goal, examTypeFilter]);
  const selectedQuiz = useMemo(() => subjectQuizzes[0] || null, [subjectQuizzes]);
  const currentQuestion = questions[currentQ];
  const unansweredCount = questions.length - Object.keys(answers).length;

  useEffect(() => {
    if (!subjectQuizzes.length) setSourceQuizId("");
    else setSourceQuizId(subjectQuizzes[0].id);
  }, [subjectQuizzes]);

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
        exam_type: examTypeFilter === "mixed" ? "mixed_practice" : selectedQuiz.exam_type || "general",
        subject: subject === "all_selected" ? "mixed" : selectedQuiz.subject,
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
        // Feed the same topic_progress data used by Topic Coverage, the Study Planner,
        // and Academic Insights so exam practice improves future recommendations.
        const byTopic = new Map<string, { attempted: number; correct: number }>();
        details.forEach(({ q, correct: isCorrect }) => {
          const topic = (q.topic || "General").trim() || "General";
          const key = `${q.subject || selectedQuiz.subject}::${topic.toLocaleLowerCase()}`;
          const current = byTopic.get(key) || { attempted: 0, correct: 0 };
          current.attempted += 1;
          if (isCorrect) current.correct += 1;
          byTopic.set(key, current);
        });

        for (const [topicKey, counts] of byTopic) {
          const matchedQuestion = details.find(({ q }) => `${q.subject || selectedQuiz.subject}::${(q.topic || "General").trim().toLocaleLowerCase()}` === topicKey)?.q;
          const topic = matchedQuestion?.topic?.trim() || "General";
          const progressSubject = matchedQuestion?.subject || selectedQuiz.subject;
          const { data: existing, error: lookupError } = await supabase
            .from("topic_progress")
            .select("id,questions_attempted,questions_correct")
            .eq("user_id", user.id)
            .eq("subject", progressSubject)
            .ilike("topic", topic)
            .maybeSingle();
          if (lookupError) {
            console.error("Could not load topic progress for exam result:", lookupError);
            continue;
          }

          const previousAttempted = Number(existing?.questions_attempted || 0);
          const previousCorrect = Number(existing?.questions_correct || 0);
          const questionsAttempted = previousAttempted + counts.attempted;
          const questionsCorrect = previousCorrect + counts.correct;
          const progressUpdate = {
            user_id: user.id,
            subject: progressSubject,
            topic,
            questions_attempted: questionsAttempted,
            questions_correct: questionsCorrect,
            accuracy_percentage: questionsAttempted ? Math.round((questionsCorrect / questionsAttempted) * 100) : 0,
            completion_percentage: Math.min(100, Math.round((questionsAttempted / 5) * 100)),
          };
          const { error: progressError } = existing
            ? await supabase.from("topic_progress").update(progressUpdate).eq("id", existing.id)
            : await supabase.from("topic_progress").insert(progressUpdate);
          if (progressError) console.error("Could not save topic progress for exam result:", progressError);
        }

        if (correct > 0) {
          const { error: xpError } = await supabase.rpc("add_xp", { p_user_id: user.id, p_amount: correct * 5 });
          if (xpError) console.error("Exam XP award failed:", xpError);
        }
        await refreshProfile?.();
        toast.success("Exam result saved. Topic mastery is being updated for your study recommendations.");
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
    if (!user?.id || !subjectQuizzes.length) {
      toast.error("No approved questions are available for this setup yet.");
      return;
    }
    setIsStarting(true);
    try {
      const { data, error } = await supabase
        .from("questions")
        .select("id,quiz_id,question_text,options,option_a,option_b,option_c,option_d,correct_answer,explanation,order_index,topic")
        .in("quiz_id", subjectQuizzes.map((quiz) => quiz.id))
        .order("order_index", { ascending: true });
      if (error) throw error;
      const quizById = new Map(subjectQuizzes.map((quiz) => [quiz.id, quiz]));
      const parsed = (data || []).map((row: any) => {
        const options = parseOptions(row);
        const quiz = quizById.get(row.quiz_id);
        const sourceKind = quiz?.exam_type === "past_paper" ? "past_paper" as const : "topic_practice" as const;
        return {
          id: row.id,
          quiz_id: row.quiz_id,
          subject: quiz?.subject || "general",
          sourceKind,
          sourceTitle: quiz?.title || "Approved quiz bank",
          question_text: String(row.question_text || ""),
          options,
          correct_answer: answerText(row.correct_answer, options),
          explanation: row.explanation || undefined,
          topic: row.topic || undefined,
        };
      }).filter((question: ExamQuestion) => question.question_text && question.options.length >= 2 && question.options.includes(question.correct_answer));
      if (!parsed.length) {
        toast.error("This approved quiz doesn't have usable questions yet.");
        return;
      }
      const pastPaperPool = parsed.filter((question: ExamQuestion) => question.sourceKind === "past_paper");
      const topicPool = parsed.filter((question: ExamQuestion) => question.sourceKind === "topic_practice" && Boolean(question.topic));
      const pool = examTypeFilter === "past_paper" ? pastPaperPool : examTypeFilter === "topic_practice" ? topicPool : [...pastPaperPool, ...topicPool];
      if (!pool.length) {
        toast.error(examTypeFilter === "past_paper" ? "No approved quiz sets are classified as past papers for this scope." : "No usable topic-tagged questions are available for this scope yet.");
        return;
      }
      if ((examTypeFilter === "mixed" || examTypeFilter === "mock_exam") && (!pastPaperPool.length || !topicPool.length)) toast.info(!pastPaperPool.length ? "No past-paper-classified sets are available; this session will use topic-tagged practice only." : "No topic-tagged questions are available; this session will use past-paper-classified questions only.");
      const count = Math.min(questionCount, pool.length);
      const shuffledPast = [...pastPaperPool].sort(() => Math.random() - 0.5);
      const shuffledTopics = [...topicPool].sort(() => Math.random() - 0.5);
      const selected: ExamQuestion[] = [];
      if (examTypeFilter === "mixed" || examTypeFilter === "mock_exam") {
        while (selected.length < count && (shuffledPast.length || shuffledTopics.length)) {
          if (shuffledPast.length && (selected.length % 2 === 0 || !shuffledTopics.length)) selected.push(shuffledPast.shift()!);
          else if (shuffledTopics.length) selected.push(shuffledTopics.shift()!);
        }
      } else selected.push(...[...pool].sort(() => Math.random() - 0.5).slice(0, count));
      if (pool.length < questionCount) toast.info(`This setup has ${pool.length} usable questions, so your practice will use all ${pool.length}.`);
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
        <Header title="Exam practice" subtitle="Build a configurable practice set across your selected subjects." />
        <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:py-10">
          <section className="space-y-5">
            <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary"><GraduationCap className="h-7 w-7" /></div>
                <div><p className="text-sm font-semibold text-primary">Your exam workspace</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{examTypeFilter === "mock_exam" ? "Simulate an exam session." : "Prepare with purpose."}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Choose mixed practice or a timed mock exam across your saved subjects. Mock exams use available approved quiz-bank questions and topic practice; they are not presented as official national exam papers.</p></div>
              </div>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><label className="text-sm font-medium">Subject scope</label><Select value={subject} onValueChange={setSubject}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all_selected">All selected subjects</SelectItem>{profileSubjects.map((value) => <SelectItem key={value} value={value}>{prettySubject(value)}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">Question source</label><Select value={examTypeFilter} onValueChange={setExamTypeFilter}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mixed">Mixed: past-paper sets + topic questions</SelectItem><SelectItem value="mock_exam">Mock exam: timed mixed assessment</SelectItem><SelectItem value="past_paper">Past-paper-classified sets only</SelectItem><SelectItem value="topic_practice">Topic-tagged questions only</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">Question bank</label><div className="flex h-12 items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">{isLoadingBank ? "Checking available questions…" : `${subjectQuizzes.length} approved sets · ${subjectQuizzes.reduce((sum, quiz) => sum + quiz.questionCount, 0)} available questions`}</div></div>
                <div className="space-y-2"><label className="text-sm font-medium">Question count</label><Select value={String(questionCount)} onValueChange={(value) => setQuestionCount(Number(value))}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{[10,20,30,50].map((count) => <SelectItem key={count} value={String(count)}>{count} questions</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">Time limit</label><Select value={String(timeLimit)} onValueChange={(value) => setTimeLimit(Number(value))}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{[15,30,45,60].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} minutes</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-primary" /><div><p className="font-semibold">{isLoadingBank ? "Checking your question bank…" : subjectQuizzes.length ? `${subjectQuizzes.length} matching approved sets` : "No matching question sets yet"}</p><p className="text-sm text-muted-foreground">{isLoadingBank ? "Loading approved content" : `${subjectQuizzes.reduce((sum, quiz) => sum + quiz.questionCount, 0)} questions across ${subject === "all_selected" ? "all selected subjects" : prettySubject(subject)}`}</p></div></div>
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
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur"><div className="mx-auto max-w-4xl px-4 py-4 sm:px-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{examTypeFilter === "mock_exam" ? "Mock exam" : "Timed practice"}</p><h1 className="font-bold sm:text-lg">{selectedQuiz?.title || "Exam mode"}</h1></div><div className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono font-semibold tabular-nums ${timeCritical ? "border-destructive/40 bg-destructive/10 text-destructive" : "bg-card"}`}><Clock3 className="h-4 w-4" />{formatTime(timeLeft)}</div></div><div className="mt-4 flex items-center justify-between text-sm text-muted-foreground"><span>Question {currentQ + 1} of {questions.length}</span><span>{Object.keys(answers).length} answered · {unansweredCount} remaining</span></div><Progress value={((currentQ + 1) / questions.length) * 100} className="mt-2 h-2" /></div></header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10"><Card className="rounded-3xl shadow-sm"><CardContent className="p-5 sm:p-8"><div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><CircleHelp className="h-4 w-4 text-primary" />{currentQuestion.topic || prettySubject(currentQuestion.subject || subject)}<Badge variant="outline">{currentQuestion.sourceKind === "past_paper" ? "Past-paper-classified set · approved" : "Topic practice · approved quiz bank"}</Badge></div><h2 className="mt-4 text-xl font-semibold leading-8 sm:text-2xl">{currentQuestion.question_text}</h2><div className="mt-6 grid gap-3">{currentQuestion.options.map((option, index) => {const selected = answers[currentQ] === option; return <button key={`${currentQuestion.id}-${index}`} type="button" onClick={() => setAnswers((previous) => ({ ...previous, [currentQ]: option }))} className={`flex min-h-14 items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background hover:bg-muted/60"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{String.fromCharCode(65 + index)}</span><span className="pt-0.5 text-sm leading-6">{option}</span></button>;})}</div></CardContent></Card><div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><Button variant="outline" className="sm:min-w-32" disabled={currentQ === 0} onClick={() => setCurrentQ((index) => index - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><div className="flex gap-3"><Button variant="outline" onClick={() => setCurrentQ((index) => Math.min(questions.length - 1, index + 1))} disabled={currentQ === questions.length - 1}>Skip <ChevronRight className="ml-1 h-4 w-4" /></Button><Button className="flex-1 sm:min-w-36" onClick={() => currentQ < questions.length - 1 ? setCurrentQ((index) => index + 1) : void submitExam()}>{currentQ < questions.length - 1 ? <>Next question <ChevronRight className="ml-1 h-4 w-4" /></> : "Submit exam"}</Button></div></div><p className="mt-4 text-center text-xs text-muted-foreground">Your answers are not revealed until you submit the exam.</p></main>
    </div>
  );
};

export default ExamModePage;
