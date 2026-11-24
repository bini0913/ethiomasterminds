import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock3, Target, Trophy, CheckCircle2, XCircle, BookOpen, GraduationCap, Loader2, RotateCcw, ChevronLeft, ChevronRight, CircleHelp, ShieldCheck, Flag } from "lucide-react";
import { toast } from "sonner";
import { getAcademicProfile, normalizeGrade, normalizeSubject, resolveAcademicGrade, subjectsMatch } from "@/lib/academicProfile";

const isSafeHttpUrl = (value: string | null | undefined) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

type ExamState = "setup" | "running" | "results";
type SourceQuiz = { id: string; title: string; description?: string; subject: string; grade: number; difficulty?: string; time_limit?: number | null; exam_type?: string; source_kind?: "past_paper" | "topic_practice" | "generated_practice" | "teacher_authored"; source_name?: string | null; source_year?: number | null; source_url?: string | null; source_verification_status?: "unverified" | "needs_review" | "verified" | "permission_confirmed"; questionCount: number };
type EntrancePaperReference = { id: string; subject: string; ethiopian_year: number; gregorian_year: number; source_name: string; source_url: string; source_status: string; notes?: string };
type ExamQuestion = { id: string; quiz_id?: string; subject?: string; sourceKind: "past_paper" | "topic_practice" | "generated_practice" | "teacher_authored"; sourceTitle: string; sourceVerificationStatus?: SourceQuiz["source_verification_status"]; sourceName?: string | null; sourceYear?: number | null; question_text: string; options: string[]; correct_answer?: string; explanation?: string; topic?: string };
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
  if (Array.isArray(row.options)) {
    const parsed = row.options
      .filter((item: unknown) => typeof item === "string" && item.trim())
      .map((item: string) => item.trim());
    if (parsed.length) return parsed;
  }
  return [row.option_a, row.option_b, row.option_c, row.option_d]
    .filter((item) => typeof item === "string" && item.trim())
    .map((item: string) => item.trim());
}

const prettySubject = (subject: string) => subject === "math" ? "Mathematics" : subject.replace(/\b\w/g, (letter) => letter.toUpperCase());

const ExamModePage: React.FC = () => {
  const { user, refreshProfile } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";
  const navigate = useNavigate();
  const location = useLocation();
  const requestedSubject = typeof location.state?.subject === "string" && location.state.subject.trim()
    ? normalizeSubject(location.state.subject)
    : null;
  const [examState, setExamState] = useState<ExamState>("setup");
  const [subject, setSubject] = useState("all_selected");
  const [examTypeFilter, setExamTypeFilter] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(20);
  useEffect(() => {
    if (location.state?.workoutQuestionCount === 10) {
      setQuestionCount(10);
      setExamTypeFilter("mixed");
    }
    if (typeof location.state?.subject === "string" && location.state.subject.trim()) {
      setSubject(normalizeSubject(location.state.subject));
    }
  }, [location.state]);
  const [timeLimit, setTimeLimit] = useState(30);
  const [, setSourceQuizId] = useState("");
  const [sourceQuizzes, setSourceQuizzes] = useState<SourceQuiz[]>([]);
  const [entrancePaperReferences, setEntrancePaperReferences] = useState<EntrancePaperReference[]>([]);
  const [entrancePaperLoadState, setEntrancePaperLoadState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoadingBank, setIsLoadingBank] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<{ correct: number; total: number; elapsedSeconds: number; details: Array<{ q: ExamQuestion; answer: string; correct: boolean }>; xpAwarded: number | null; persistenceStatus: "pending" | "saved" | "partial" | "failed" } | null>(null);
  const [profileSubjects, setProfileSubjects] = useState<string[]>([]);
  const [bankSubjects, setBankSubjects] = useState<string[]>([]);
  const [bankLoadError, setBankLoadError] = useState<string | null>(null);
  const [bankReload, setBankReload] = useState(0);
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
      setBankLoadError(null);
      try {
        const profile = await getAcademicProfile(user.id);
        if (cancelled) return;
        const activeGrade = resolveAcademicGrade(user.grade, profile?.grade, 9);
        const allowed = (profile?.subjects?.length ? profile.subjects : []).map(normalizeSubject);
        setGrade(activeGrade);
        setProfileSubjects(allowed);
        // Preserve a subject selected from the entrance-paper catalog after the
        // asynchronous profile load; otherwise the route state is overwritten.
        setSubject(requestedSubject || "all_selected");
        setGoal([profile?.study_goal || "School / Class", profile?.study_goal_detail || ""].filter(Boolean).join(" "));

        // Academic Prep and regular Quizzes share the same approved quizzes + linked question bank.
        const { data: quizRows, error: quizError } = await supabase
          .from("quizzes")
          .select("id,title,description,subject,grade,difficulty,time_limit,exam_type,source_kind,source_name,source_year,source_url,source_verification_status")
          .eq("is_approved", true);
        if (quizError) throw quizError;
        const gradeQuizzes = (quizRows || []).filter((quiz: any) => normalizeGrade(quiz.grade, activeGrade) === activeGrade);
        // Keep the complete grade bank available for the subject selector, but
        // "All selected subjects" must be scoped to the learner's saved subjects
        // whenever at least one of those subjects has approved questions.
        const matching = gradeQuizzes;
        setBankSubjects(Array.from(new Set(matching.map((quiz: any) => normalizeSubject(quiz.subject || "")).filter(Boolean))).sort());
        if (!matching.length) {
          setSourceQuizzes([]);
          setSourceQuizId("");
          return;
        }
        const { data: questionRows, error: questionError } = await (supabase as any).rpc("get_student_question_bank", {
          p_quiz_ids: matching.map((quiz: any) => quiz.id),
        });
        if (questionError) throw questionError;
        const countByQuiz = new Map<string, number>();
        (questionRows || []).forEach((row: any) => {
          const options = parseOptions(row);
          if (row.question_text && options.length >= 2) {
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
        if (!cancelled) {
          setBankLoadError(error instanceof Error ? error.message : "The approved quiz bank request failed.");
          toast.error("We couldn't load the approved quiz bank. Please retry.");
        }
      } finally {
        if (!cancelled) setIsLoadingBank(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.grade, bankReload, requestedSubject]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // External archive links only; these are not imported questions or verified answer keys.
        const { data, error } = await (supabase as any)
          .from("entrance_exam_papers")
          .select("id,subject,ethiopian_year,gregorian_year,source_name,source_url,source_status,notes")
          .eq("grade_level", 12)
          .eq("exam_type", "university_entrance")
          .gte("gregorian_year", 2013)
          .order("gregorian_year", { ascending: false })
          .order("subject", { ascending: true });
        if (error) throw error;
        if (cancelled) return;
        const uniqueReferences = new Map<string, EntrancePaperReference>();
        ((data || []) as EntrancePaperReference[]).forEach((entry) => {
          const key = `${entry.ethiopian_year}:${entry.subject.toLowerCase()}`;
          if (!uniqueReferences.has(key)) uniqueReferences.set(key, entry);
        });
        setEntrancePaperReferences(Array.from(uniqueReferences.values()));
        setEntrancePaperLoadState("ready");
      } catch (error) {
        console.warn("Entrance-paper reference catalog unavailable:", error);
        if (!cancelled) setEntrancePaperLoadState("unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasSelectedSubjectQuizzes = sourceQuizzes.some((quiz) =>
    profileSubjects.some((profileSubject) => subjectsMatch(profileSubject, quiz.subject))
  );
  const subjectQuizzes = useMemo(() => {
    return sourceQuizzes.filter((quiz) => {
      const matchesSubject = subject === "all_selected"
        ? (!hasSelectedSubjectQuizzes || profileSubjects.some((profileSubject) => subjectsMatch(profileSubject, quiz.subject)))
        : subjectsMatch(subject, quiz.subject);
      const sourceKind = quiz.source_kind || (quiz.exam_type === "past_paper" ? "past_paper" : "topic_practice");
      const matchesSource = examTypeFilter === "mixed"
        || (examTypeFilter === "past_paper" ? sourceKind === "past_paper" : sourceKind !== "past_paper");
      return matchesSubject && matchesSource;
    }).sort((a, b) => goalRelevance(b, goal) - goalRelevance(a, goal) || b.questionCount - a.questionCount || a.title.localeCompare(b.title));
  }, [sourceQuizzes, profileSubjects, subject, goal, examTypeFilter, hasSelectedSubjectQuizzes]);
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
    try {
    const details = questions.map((q, index) => ({
      q,
      answer: answers[index] || "",
      correct: false,
    }));
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    setResults({ correct: 0, total: questions.length, elapsedSeconds, details, xpAwarded: null, persistenceStatus: "pending" });
    setExamState("results");
    if (user?.id && selectedQuiz?.id) {
      // Each source quiz is submitted separately, with the exact question subset
      // presented in this exam. The database grades it, saves mastery evidence,
      // and awards XP only through the protected reward-claim RPC.
      const grouped = new Map<string, typeof details>();
      for (const item of details) {
        if (!item.q.quiz_id) continue;
        const group = grouped.get(item.q.quiz_id) || [];
        group.push(item);
        grouped.set(item.q.quiz_id, group);
      }

      let savedGroups = 0;
      let rewardTotal = 0;
      let rewardFailures = 0;

      for (const [quizId, quizDetails] of grouped) {
        const submissionId = crypto.randomUUID();
        const secureAnswers: Record<string, string> = {};
        for (const item of quizDetails) {
          if (item.answer) secureAnswers[item.q.id] = item.answer;
        }

        try {
          const { data: submitData, error: submitError } = await (supabase as any).rpc("submit_exam_result_secure", {
            p_quiz_id: quizId,
            p_question_ids: quizDetails.map(({ q }) => q.id),
            p_answers: secureAnswers,
            p_time_taken: elapsedSeconds,
            p_submission_id: submissionId,
            p_exam_type: examTypeFilter === "mixed" ? "mixed_practice" : examTypeFilter,
            p_subject: quizDetails[0]?.q.subject || selectedQuiz.subject,
          });
          if (submitError) throw submitError;
          savedGroups += 1;

          const { data: reviewData, error: reviewError } = await (supabase as any).rpc("get_exam_submission_review", {
            p_submission_id: submissionId,
          });
          if (reviewError) throw reviewError;
          const reviewById = new Map<string, { answer: string; correct_answer: string; explanation?: string }>((reviewData?.review || []).map((entry: any) => [String(entry.question_id), entry]));
          setResults((current) => {
            if (!current) return current;
            const nextDetails = current.details.map((detail) => {
              const review = reviewById.get(detail.q.id);
              return review ? {
                ...detail,
                correct: answerText(review.answer, detail.q.options) === answerText(review.correct_answer, detail.q.options),
                q: { ...detail.q, explanation: review.explanation || detail.q.explanation, correct_answer: review.correct_answer },
              } : detail;
            });
            const correct = Number(reviewData?.correct_answers ?? submitData?.correct_answers ?? nextDetails.filter((item) => item.correct).length);
            return { ...current, details: nextDetails, correct };
          });

          try {
            const { data: rewardData, error: rewardError } = await (supabase as any).rpc("claim_quiz_reward", {
              p_submission_id: submissionId,
            });
            if (rewardError) throw rewardError;
            rewardTotal += Number(rewardData?.xp_awarded ?? 0);
          } catch (rewardError) {
            rewardFailures += 1;
            console.error("Exam reward claim failed:", rewardError);
          }
        } catch (saveError) {
          console.error("Could not securely save an exam source group:", quizId, saveError);
        }
      }

      if (savedGroups > 0) {
        await refreshProfile?.();
        const persistenceStatus = savedGroups === grouped.size && rewardFailures === 0 ? "saved" : "partial";
        setResults((current) => current ? { ...current, xpAwarded: rewardTotal, persistenceStatus } : current);
        if (persistenceStatus === "saved") {
          toast.success(`Exam result saved · ${rewardTotal} XP awarded`);
        } else {
          toast.warning(`Your result was saved for ${savedGroups} of ${grouped.size} quiz sources. Some progress or rewards may need retrying.`);
        }
      } else {
        setResults((current) => current ? { ...current, xpAwarded: 0, persistenceStatus: "failed" } : current);
        toast.error("Your result is shown, but could not be securely saved. Your progress and XP were not changed.");
      }
    } else {
      setResults((current) => current ? { ...current, xpAwarded: 0, persistenceStatus: "failed" } : current);
      toast.error("Your result is shown, but it has no valid account or quiz source to save against.");
    }
    } catch (error) {
      console.error("Unexpected Exam Mode submission error:", error);
      setResults((current) => current ? { ...current, xpAwarded: 0, persistenceStatus: "failed" } : current);
      toast.error("Your result is visible, but saving it failed. Please check your connection.");
    } finally {
      setIsSaving(false);
    }
  }, [examState, questions, answers, user?.id, selectedQuiz?.id, selectedQuiz?.subject, examTypeFilter, refreshProfile]);
  submitExamRef.current = () => { void submitExam(); };

  useEffect(() => {
    if (examState !== "running" || !upperStudent) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName || "")) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (/^[1-4]$/.test(key) || /^[a-d]$/.test(key)) {
        const optionIndex = /^[1-4]$/.test(key) ? Number(key) - 1 : "abcd".indexOf(key);
        if (optionIndex < (currentQuestion?.options.length || 0)) {
          event.preventDefault();
          const option = currentQuestion.options[optionIndex];
          setAnswers((previous) => ({ ...previous, [currentQ]: option }));
        }
        return;
      }
      if (key === "arrowleft") {
        event.preventDefault();
        setCurrentQ((index) => Math.max(0, index - 1));
      } else if (key === "arrowright") {
        event.preventDefault();
        setCurrentQ((index) => Math.min(questions.length - 1, index + 1));
      } else if (key === "enter") {
        event.preventDefault();
        void submitExamRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [examState, currentQ, currentQuestion, questions.length, upperStudent]);



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
      const { data, error } = await (supabase as any).rpc("get_student_question_bank", {
        p_quiz_ids: subjectQuizzes.map((quiz) => quiz.id),
      });
      if (error) throw error;
      const quizById = new Map(subjectQuizzes.map((quiz) => [quiz.id, quiz]));
      const parsed = (data || []).map((row: any) => {
        const options = parseOptions(row);
        const quiz = quizById.get(row.quiz_id);
        const sourceKind = quiz?.source_kind || (quiz?.exam_type === "past_paper" ? "past_paper" : "topic_practice");
        return {
          id: row.id,
          quiz_id: row.quiz_id,
          subject: quiz?.subject || "general",
          sourceKind,
          sourceTitle: quiz?.title || "Approved quiz bank",
          sourceVerificationStatus: quiz?.source_verification_status,
          sourceName: quiz?.source_name,
          sourceYear: quiz?.source_year,
          question_text: String(row.question_text || ""),
          options,
          explanation: row.explanation || undefined,
          topic: row.topic || undefined,
        };
      }).filter((question: ExamQuestion) => question.question_text && question.options.length >= 2);
      if (!parsed.length) {
        toast.error("This approved quiz doesn't have usable questions yet.");
        return;
      }
      const pastPaperPool = parsed.filter((question: ExamQuestion) => question.sourceKind === "past_paper");
      const topicPool = parsed.filter((question: ExamQuestion) => question.sourceKind !== "past_paper" && Boolean(question.topic));
      const pool = examTypeFilter === "past_paper" ? pastPaperPool : examTypeFilter === "topic_practice" ? topicPool : [...pastPaperPool, ...topicPool];
      if (!pool.length) {
        toast.error(examTypeFilter === "past_paper" ? "No approved quiz sets tagged as past papers are available for this scope." : "No usable topic-tagged questions are available for this scope yet.");
        return;
      }
      if ((examTypeFilter === "mixed" || examTypeFilter === "mock_exam") && (!pastPaperPool.length || !topicPool.length)) toast.info(!pastPaperPool.length ? "No quiz sets tagged as past papers are available; this session will use topic-tagged practice only." : "No topic-tagged questions are available; this session will use questions from quiz sets tagged as past papers only.");
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
      setFlagged({});
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
    setFlagged({});
    setCurrentQ(0);
    setExamState("setup");
  };

  const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <header className={upperStudent ? "" : "border-b bg-background/95 backdrop-blur"}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        {!upperStudent && <Button variant="outline" size="icon" aria-label="Back to Academic Prep" onClick={() => navigate("/academic")}><ArrowLeft className="h-4 w-4" /></Button>}
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Minds · Grade {grade}</p><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>
        <Badge variant="outline" className="hidden sm:flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Approved quiz bank</Badge>
      </div>
    </header>
  );

  if (examState === "setup") {
    const bankQuestionCount = subjectQuizzes.reduce((sum, quiz) => sum + quiz.questionCount, 0);
    const recommendedMinutes = Math.max(15, Math.ceil(Math.max(questionCount, 1) * 1.5));
    return (
      <div className={upperStudent ? "tier-upper min-h-screen bg-[#07101f] pb-24 text-white" : "min-h-screen bg-muted/30"}>
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,.16),transparent_30rem),radial-gradient(circle_at_92%_10%,rgba(99,102,241,.14),transparent_32rem)]" />
        <Header title="Exam command center" subtitle="Turn your next practice session into a smarter performance." />
        <main className="relative mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
          <section className="space-y-5"><div className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-cyan-500/15 via-card/80 to-violet-500/10 p-5 shadow-2xl shadow-cyan-950/25 sm:p-8"><div className="flex items-start justify-between gap-4"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100"><Target className="h-3.5 w-3.5"/> MISSION CONTROL</div><h2 className="max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">Practice with a plan. Leave with a signal.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">Configure the pressure, choose your question mix, and get an honest read on what you know.</p></div><div className="hidden h-16 w-16 shrink-0 place-items-center rounded-3xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200 sm:grid"><GraduationCap className="h-8 w-8"/></div></div><div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3"><div className="rounded-2xl border border-white/10 bg-black/15 p-3"><p className="text-xl font-black text-cyan-200">{bankQuestionCount}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">Questions ready</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-3"><p className="text-xl font-black text-violet-200">{subjectQuizzes.length}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">Approved sets</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-3"><p className="text-xl font-black text-amber-200">{recommendedMinutes}m</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">Suggested pace</p></div></div></div>
          <Card className="border-white/10 bg-white/[0.055] shadow-2xl shadow-black/10 backdrop-blur"><CardContent className="p-5 sm:p-7"><div className="mb-6 flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300/80">Build your session</p><h3 className="mt-1 text-xl font-black">Choose your challenge</h3></div><Badge className="border-emerald-300/20 bg-emerald-400/10 text-emerald-200"><ShieldCheck className="mr-1 h-3.5 w-3.5"/>Secure bank</Badge></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject scope</label><Select value={subject} onValueChange={setSubject}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all_selected">{sourceQuizzes.some((quiz) => profileSubjects.some((profileSubject) => subjectsMatch(profileSubject, quiz.subject))) ? "All selected subjects" : "All available Grade " + grade + " subjects"}</SelectItem>{Array.from(new Set([...profileSubjects, ...bankSubjects])).map((value) => <SelectItem key={value} value={value}>{prettySubject(value)}{!profileSubjects.some((profileSubject) => subjectsMatch(profileSubject, value)) ? " · bank" : ""}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Session type</label><Select value={examTypeFilter} onValueChange={setExamTypeFilter}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mixed">Mixed practice</SelectItem><SelectItem value="mock_exam">Mock exam</SelectItem><SelectItem value="past_paper">Past-paper tagged</SelectItem><SelectItem value="topic_practice">Topic practice</SelectItem></SelectContent></Select></div><div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Question count</label><Select value={String(questionCount)} onValueChange={(value) => setQuestionCount(Number(value))}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{[10,20,30,50].map((count) => <SelectItem key={count} value={String(count)}>{count} questions</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Time limit</label><Select value={String(timeLimit)} onValueChange={(value) => setTimeLimit(Number(value))}><SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{[15,30,45,60].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} minutes</SelectItem>)}</SelectContent></Select></div></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><BookOpen className="h-5 w-5"/></div><div><p className="font-bold">{isLoadingBank ? "Checking your bank…" : subjectQuizzes.length ? `${subjectQuizzes.length} matching approved sets` : "No matching sets yet"}</p><p className="text-xs text-muted-foreground">{isLoadingBank ? "Loading approved content" : `${bankQuestionCount} usable questions in this scope`}</p></div></div><Badge variant="outline" className="hidden sm:flex">{goal}</Badge></div></div><Button className="mt-5 h-13 w-full rounded-xl bg-cyan-400 text-base font-black text-slate-950 hover:bg-cyan-300" onClick={startExam} disabled={isLoadingBank || isStarting || !selectedQuiz}>{isStarting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Preparing your session…</> : <><Target className="mr-2 h-4 w-4"/>Launch exam session</>}</Button>{!isLoadingBank && bankLoadError && <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><p className="font-medium">The question bank could not be loaded.</p><Button className="mt-2" variant="outline" size="sm" onClick={() => setBankReload((value) => value + 1)}>Retry question bank</Button></div>}{!isLoadingBank && !bankLoadError && !sourceQuizzes.length && <p className="mt-3 text-sm text-muted-foreground">No approved Grade {grade} quizzes with usable questions are available yet.</p>}</CardContent></Card></section>
          <aside className="space-y-4"><Card className="border-white/10 bg-white/[0.045] shadow-xl"><CardContent className="p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300/80">Your exam advantage</p><h3 className="mt-1 text-xl font-black">A calm, deliberate attempt beats a rushed one.</h3><div className="mt-5 space-y-4">{[{icon: ShieldCheck,title:"Trusted question flow",text:"Only approved quiz-bank questions enter your session."},{icon: Clock3,title:"Pressure you control",text:"Set a pace that challenges you without turning practice into noise."},{icon: Trophy,title:"Progress that counts",text:"Your score, mastery evidence, and eligible XP are saved securely."}].map((item) => <div key={item.title} className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><item.icon className="h-4 w-4"/></div><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{item.text}</p></div></div>)}</div></CardContent></Card><Card className="border-white/10 bg-white/[0.035] shadow-none"><CardContent className="p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><GraduationCap className="h-5 w-5"/></div><div><p className="text-sm font-bold">Study profile</p><p className="text-xs text-muted-foreground">Grade {grade} · {profileSubjects.map(prettySubject).join(", ") || "Subjects not set"}</p></div></div><Button variant="link" className="mt-3 h-auto p-0 text-cyan-200" onClick={() => navigate("/academic/setup")}>Update preparation settings <ChevronRight className="ml-1 h-4 w-4"/></Button></CardContent></Card></aside>
        </main>
      </div>
    );
  }

  if (examState === "results" && results) {
    const percent = results.total ? Math.round((results.correct / results.total) * 100) : 0;
    const answered = results.details.filter(d => d.answer).length;
    const reviewCount = results.details.filter(d => !d.correct).length;
    return (
      <div className={upperStudent ? "tier-upper min-h-screen bg-[#07101f] pb-24 text-white" : "min-h-screen bg-muted/30"}><div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,.16),transparent_32rem)]"/><Header title="Performance debrief" subtitle={examTypeFilter === "mixed" ? "Mixed exam practice" : selectedQuiz?.title || "Your completed practice"}/><main className="relative mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"><section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-cyan-500/15 via-card/80 to-violet-500/10 p-6 text-center shadow-2xl shadow-cyan-950/25 sm:p-10"><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200"><Trophy className="h-8 w-8"/></div><p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Session complete</p><h2 className="mt-2 text-6xl font-black tracking-tight sm:text-7xl">{percent}%</h2><p className="mt-2 text-white/60">{results.correct} correct out of {results.total} questions</p><div className="mx-auto mt-6 max-w-sm"><Progress value={percent} className="h-3 bg-white/10"/></div><div className="mx-auto mt-7 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-white/45">Answered</p><p className="mt-1 text-2xl font-black">{answered}/{results.total}</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-white/45">Accuracy</p><p className="mt-1 text-2xl font-black">{answered ? Math.round(results.correct / answered * 100) : 0}%</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-white/45">Time used</p><p className="mt-1 text-2xl font-black">{Math.floor(results.elapsedSeconds / 60)}m</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs text-white/45">XP earned</p><p className="mt-1 text-2xl font-black">{results.xpAwarded === null ? "—" : `+${results.xpAwarded}`}</p></div></div><div className="mt-6 flex flex-wrap justify-center gap-2"><Badge className="border-white/15 bg-white/10 text-white">{percent >= 80 ? "Strong result" : percent >= 60 ? "Good progress" : "Keep building confidence"}</Badge><Badge className="border-white/15 bg-white/10 text-white">{isSaving ? "Saving progress…" : results.persistenceStatus === "saved" ? "Saved to progress" : results.persistenceStatus === "partial" ? "Partially saved" : results.persistenceStatus === "failed" ? "Not saved" : "Awaiting save"}</Badge></div><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button className="rounded-xl bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300" onClick={resetExam}><RotateCcw className="mr-2 h-4 w-4"/>Try another exam</Button><Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate("/academic/insights")}>View academic insights</Button></div></section>{upperStudent && <div className="rounded-2xl border border-violet-300/15 bg-violet-400/[0.07] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Turn mistakes into your next advantage</p><p className="mt-1 text-sm text-white/55">{reviewCount ? `${reviewCount} questions are ready for a deeper review.` : "You cleared every question in this session."}</p></div>{reviewCount > 0 && <Button className="rounded-xl" onClick={() => { const context = results.details.filter(d => !d.correct).map((d, i) => "Mistake " + (i + 1) + ": " + d.q.question_text + " | My answer: " + (d.answer || "Not answered") + " | Correct answer: " + answerText(d.q.correct_answer, d.q.options) + " | Explanation: " + (d.q.explanation || "Not provided")).join("\n"); navigate("/ai-tutor?context=" + encodeURIComponent("Please explain these exam mistakes step by step:\n" + context)); }}>Send to AI Tutor</Button>}</div></div>}<section className="space-y-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300/80">The debrief</p><h3 className="mt-1 text-2xl font-black">Review every decision</h3><p className="mt-1 text-sm text-white/55">A result is useful when you can see exactly what to repeat and what to repair.</p></div>{results.details.map((detail, index) => <Card key={detail.q.id} className="border-white/10 bg-white/[0.045] shadow-lg"><CardContent className="flex gap-3 p-4 sm:p-5"><div className={`mt-0.5 rounded-full p-1.5 ${detail.correct ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{detail.correct ? <CheckCircle2 className="h-4 w-4"/> : <XCircle className="h-4 w-4"/>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="font-bold leading-6">{index + 1}. {detail.q.question_text}</p><Badge className="shrink-0 border-white/10 bg-white/5 text-white/70">{detail.correct ? "Correct" : "Review"}</Badge></div>{!detail.correct && <p className="mt-2 text-sm text-white/55">Your answer: <span className="text-white">{detail.answer || "Not answered"}</span></p>}<p className="mt-1 text-sm">Correct answer: <span className="font-bold text-emerald-300">{answerText(detail.q.correct_answer, detail.q.options)}</span></p>{detail.q.explanation && <p className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-sm leading-5 text-white/60">{detail.q.explanation}</p>}</div></CardContent></Card>)}</section></main></div>
    );
  }

  if (!currentQuestion) return <div className="flex min-h-screen items-center justify-center gap-3"><Loader2 className="h-6 w-6 animate-spin text-cyan-300"/>Preparing your exam…</div>;
  const timeCritical = timeLeft <= 60;
  const timeWarning = timeLeft <= 300 && timeLeft > 60;
  const answeredPercent = questions.length ? Math.round((Object.keys(answers).length / questions.length) * 100) : 0;
  return (
    <div className={upperStudent ? "tier-upper min-h-screen bg-[#07101f] pb-24 text-white" : "min-h-screen bg-muted/30"}><div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,.12),transparent_28rem),radial-gradient(circle_at_90%_15%,rgba(99,102,241,.12),transparent_28rem)]"/><header className="sticky top-0 z-30 border-b border-white/10 bg-[#07101f]/90 backdrop-blur-xl"><div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">{examTypeFilter === "mock_exam" ? "Mock exam" : "Timed practice"} · Grade {grade}</p><h1 className="truncate text-base font-black sm:text-xl">{examTypeFilter === "mixed" ? "Mixed exam practice" : selectedQuiz?.title || "Exam mode"}</h1></div><div className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 font-mono font-black tabular-nums ${timeCritical ? "border-red-300/40 bg-red-500/10 text-red-200 animate-pulse" : timeWarning ? "border-amber-300/30 bg-amber-400/10 text-amber-200" : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"}`}><Clock3 className="h-4 w-4"/>{formatTime(timeLeft)}</div></div><div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/55"><span>Question {currentQ + 1} of {questions.length}</span><span>{Object.keys(answers).length} answered · {unansweredCount} remaining</span></div><Progress value={((currentQ + 1) / questions.length) * 100} className="mt-2 h-2 bg-white/10"/></div></header><main className="relative mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 sm:py-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-8"><div className="min-w-0"><Card className="mb-4 border-white/10 bg-white/[0.045] shadow-xl"><CardContent className="p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.14em] text-white/50">Question map</p><p className="text-xs text-cyan-200">{answeredPercent}% answered · {Object.keys(flagged).length} flagged</p></div><div className="grid grid-cols-5 gap-2 sm:grid-cols-10">{questions.map((question, index) => <button key={question.id} type="button" onClick={() => setCurrentQ(index)} aria-label={`Go to question ${index + 1}${flagged[index] ? ", flagged" : ""}`} className={`relative grid h-9 place-items-center rounded-xl border text-xs font-black transition ${currentQ === index ? "border-cyan-300 bg-cyan-400 text-slate-950" : answers[index] ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-black/10 text-white/45 hover:border-cyan-300/50"}`}>{index + 1}{flagged[index] && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-300"/>}</button>)}</div></CardContent></Card><Card className="overflow-hidden border-white/10 bg-white/[0.055] shadow-2xl shadow-cyan-950/20"><CardContent className="p-5 sm:p-8"><div className="flex flex-wrap items-center gap-2 text-sm text-white/55"><CircleHelp className="h-4 w-4 text-cyan-300"/>{currentQuestion.topic || prettySubject(currentQuestion.subject || subject)}<Badge className="border-white/10 bg-white/5 text-white/65">{currentQuestion.sourceKind === "past_paper" ? `Past-paper tagged · ${currentQuestion.sourceVerificationStatus === "verified" ? "verified" : "source-aware"}` : currentQuestion.sourceKind === "generated_practice" ? "Generated practice" : currentQuestion.sourceKind === "teacher_authored" ? "Teacher-authored" : "Topic practice"}</Badge>{currentQuestion.sourceName && <span className="text-xs text-white/40">{currentQuestion.sourceName}{currentQuestion.sourceYear ? ` · ${currentQuestion.sourceYear}` : ""}</span>}</div><div className="mt-4 flex justify-end"><Button type="button" size="sm" variant={flagged[currentQ] ? "default" : "outline"} className="rounded-xl border-white/15 bg-white/5" onClick={() => setFlagged((previous) => ({ ...previous, [currentQ]: !previous[currentQ] }))}><Flag className="mr-2 h-4 w-4"/>{flagged[currentQ] ? "Flagged for review" : "Flag for review"}</Button></div><h2 className="mx-auto mt-6 max-w-4xl text-2xl font-black leading-tight tracking-tight sm:text-4xl">{currentQuestion.question_text}</h2><div className="mt-8 grid gap-3">{currentQuestion.options.map((option, index) => { const selected = answers[currentQ] === option; return <button key={`${currentQuestion.id}-${index}`} type="button" onClick={() => setAnswers((previous) => ({ ...previous, [currentQ]: option }))} className={`group flex min-h-16 items-start gap-4 rounded-2xl border-2 p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-h-20 sm:p-5 ${selected ? "border-cyan-300 bg-cyan-400/10 text-cyan-50 shadow-lg shadow-cyan-950/20" : "border-white/10 bg-black/10 text-white/80 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-400/[0.06]"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${selected ? "border-cyan-300 bg-cyan-400 text-slate-950" : "border-white/15 bg-white/5 text-white/50 group-hover:border-cyan-300/50 group-hover:text-cyan-200"}`}>{String.fromCharCode(65 + index)}</span><span className="pt-1 text-sm leading-6 sm:text-base">{option}</span></button>; })}</div></CardContent></Card><div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 sm:min-w-32" disabled={currentQ === 0} onClick={() => setCurrentQ((index) => index - 1)}><ChevronLeft className="mr-1 h-4 w-4"/>Previous</Button><div className="flex gap-3"><Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => setCurrentQ((index) => Math.min(questions.length - 1, index + 1))} disabled={currentQ === questions.length - 1}>Skip <ChevronRight className="ml-1 h-4 w-4"/></Button><Button className="flex-1 rounded-xl bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300 sm:min-w-36" onClick={() => currentQ < questions.length - 1 ? setCurrentQ((index) => index + 1) : void submitExam()}>{currentQ < questions.length - 1 ? <>Next question <ChevronRight className="ml-1 h-4 w-4"/></> : "Submit exam"}</Button></div></div><p className="mt-4 text-center text-xs text-white/40">Your answers are private until you submit. Use A–D or 1–4 keys to answer quickly.</p></div><aside className="hidden space-y-4 lg:block"><Card className="sticky top-28 border-white/10 bg-white/[0.045] shadow-xl"><CardContent className="p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Session pulse</p><div className="mt-4 space-y-4"><div><div className="flex justify-between text-xs text-white/50"><span>Answered</span><span>{answeredPercent}%</span></div><Progress value={answeredPercent} className="mt-2 h-2 bg-white/10"/></div><div className="rounded-2xl border border-white/10 bg-black/10 p-3"><p className="text-xs text-white/45">Current focus</p><p className="mt-1 font-bold">{currentQuestion.topic || prettySubject(currentQuestion.subject || subject)}</p></div><div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-3 text-sm text-amber-100/75"><p className="font-bold text-amber-100">Exam tactic</p><p className="mt-1 leading-5">Flag uncertainty, keep moving, and return with a clearer mind.</p></div></div></CardContent></Card></aside></main></div>
  );
};

export default ExamModePage;
