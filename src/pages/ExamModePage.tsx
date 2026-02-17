import React, { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Target, AlertTriangle, Trophy, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

type ExamState = "setup" | "running" | "results";

const ExamModePage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [examState, setExamState] = useState<ExamState>("setup");
  const [subject, setSubject] = useState("math");
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(30); // minutes
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState<{ correct: number; total: number; details: Array<{ q: Question; answer: string; correct: boolean }> } | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (examState !== "running" || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { submitExam(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [examState, timeLeft]);

  const startExam = async () => {
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id")
      .eq("subject", subject)
      .eq("is_approved", true);

    if (!quizzes || quizzes.length === 0) {
      toast.error("No approved quizzes found for this subject");
      return;
    }

    const quizIds = quizzes.map(q => q.id);
    const { data: questionsData } = await supabase
      .from("questions")
      .select("*")
      .in("quiz_id", quizIds);

    if (!questionsData || questionsData.length < 5) {
      toast.error("Not enough questions available");
      return;
    }

    // Shuffle and pick
    const shuffled = questionsData.sort(() => Math.random() - 0.5).slice(0, questionCount);
    const parsed = shuffled.map(q => ({
      id: q.id,
      question_text: q.question_text,
      options: (q.options as string[]) || [],
      correct_answer: q.correct_answer,
      explanation: q.explanation || undefined,
    }));

    setQuestions(parsed);
    setTimeLeft(timeLimit * 60);
    setAnswers({});
    setCurrentQ(0);
    setExamState("running");
  };

  const submitExam = useCallback(() => {
    clearInterval(timerRef.current);
    let correct = 0;
    const details = questions.map((q, i) => {
      const userAnswer = answers[i] || "";
      const isCorrect = userAnswer === q.correct_answer;
      if (isCorrect) correct++;
      return { q, answer: userAnswer, correct: isCorrect };
    });
    setResults({ correct, total: questions.length, details });
    setExamState("results");

    // Save results
    if (user) {
      supabase.from("quiz_results").insert({
        quiz_id: questions[0]?.id || "exam",
        student_id: user.id,
        score: Math.round((correct / questions.length) * 100),
        total_questions: questions.length,
        correct_answers: correct,
        time_taken: timeLimit * 60 - timeLeft,
        xp_earned: correct * 5,
      }).then(() => {
        supabase.rpc("add_xp", { p_user_id: user.id, p_amount: correct * 5 });
      });
    }
  }, [answers, questions, user, timeLeft, timeLimit]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Setup screen
  if (examState === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <header className="sticky top-0 z-50 bg-gradient-to-r from-red-700 to-rose-700 px-4 py-3 shadow-xl">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate("/academic")} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Target className="h-5 w-5" /> Exam Mode
            </h1>
          </div>
        </header>

        <div className="px-4 py-6 max-w-md mx-auto space-y-4">
          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-bold text-lg">Configure Your Exam</h2>

              <div>
                <label className="text-sm font-medium mb-1 block">Subject</label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="math">Mathematics</SelectItem>
                    <SelectItem value="science">Science</SelectItem>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="history">History</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Questions</label>
                <Select value={String(questionCount)} onValueChange={v => setQuestionCount(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 questions</SelectItem>
                    <SelectItem value="20">20 questions</SelectItem>
                    <SelectItem value="30">30 questions</SelectItem>
                    <SelectItem value="50">50 questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Time Limit</label>
                <Select value={String(timeLimit)} onValueChange={v => setTimeLimit(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={startExam} className="w-full h-12 text-base bg-gradient-to-r from-red-600 to-rose-600">
                Start Exam
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Results screen
  if (examState === "results" && results) {
    const pct = Math.round((results.correct / results.total) * 100);
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <header className="sticky top-0 z-50 bg-gradient-to-r from-red-700 to-rose-700 px-4 py-3 shadow-xl">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => setExamState("setup")} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold text-white">Exam Results</h1>
          </div>
        </header>

        <div className="px-4 py-6 max-w-md mx-auto space-y-4">
          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-6 text-center">
              <Trophy className={`h-16 w-16 mx-auto mb-4 ${pct >= 80 ? "text-yellow-500" : pct >= 50 ? "text-primary" : "text-muted-foreground"}`} />
              <h2 className="text-3xl font-bold">{pct}%</h2>
              <p className="text-muted-foreground">{results.correct}/{results.total} correct</p>
              <Badge className="mt-2">{pct >= 80 ? "Excellent!" : pct >= 60 ? "Good Job" : "Keep Practicing"}</Badge>
            </CardContent>
          </Card>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.details.map((d, i) => (
              <Card key={i} className={`border-l-4 ${d.correct ? "border-l-green-500" : "border-l-red-500"} bg-card/80`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    {d.correct ? <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm">{d.q.question_text}</p>
                      {!d.correct && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Correct: <span className="text-green-600 font-medium">{d.q.correct_answer}</span>
                          {d.answer && <> • Your answer: <span className="text-red-600">{d.answer}</span></>}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button className="w-full" onClick={() => setExamState("setup")}>Try Another Exam</Button>
        </div>
      </div>
    );
  }

  // Running exam
  const question = questions[currentQ];
  if (!question) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Timer Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-red-700 to-rose-700 px-4 py-3 shadow-xl">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">Q {currentQ + 1}/{questions.length}</span>
          </div>
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${timeLeft < 60 ? "bg-red-900 animate-pulse" : "bg-white/10"}`}>
            <Clock className="h-4 w-4 text-white" />
            <span className="text-white font-mono font-bold">{formatTime(timeLeft)}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={submitExam} className="text-xs">
            Submit
          </Button>
        </div>
      </header>

      <div className="px-4 py-2 max-w-4xl mx-auto w-full">
        <Progress value={((currentQ + 1) / questions.length) * 100} className="h-1" />
      </div>

      {/* Question */}
      <div className="flex-1 px-4 py-4 max-w-md mx-auto w-full">
        <Card className="bg-card/80 border-border/50 mb-4">
          <CardContent className="p-5">
            <p className="text-base font-medium">{question.question_text}</p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <motion.div key={i} whileTap={{ scale: 0.98 }}>
              <Button
                variant={answers[currentQ] === opt ? "default" : "outline"}
                className="w-full justify-start h-auto py-3 px-4 text-left text-sm"
                onClick={() => setAnswers(prev => ({ ...prev, [currentQ]: opt }))}
              >
                <span className="font-semibold mr-2 text-xs">{String.fromCharCode(65 + i)}.</span>
                {opt}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 pb-6 max-w-md mx-auto w-full flex gap-3">
        <Button variant="outline" className="flex-1" disabled={currentQ === 0} onClick={() => setCurrentQ(i => i - 1)}>
          Previous
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            if (currentQ < questions.length - 1) setCurrentQ(i => i + 1);
            else submitExam();
          }}
        >
          {currentQ < questions.length - 1 ? "Next" : "Submit"}
        </Button>
      </div>
    </div>
  );
};

export default ExamModePage;
