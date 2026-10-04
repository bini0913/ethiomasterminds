import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, BookOpen, Brain, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Flashcard {
  id: string;
  subject: string;
  topic: string;
  question: string;
  answer: string;
  difficulty: string;
}

interface FlashcardProgress {
  flashcard_id: string;
  status: string;
  next_review_date: string;
  repetition_count: number;
  ease_factor: number;
  interval_days: number;
}

const FlashcardsPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [progress, setProgress] = useState<Record<string, FlashcardProgress>>({});
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [studyMode, setStudyMode] = useState<"browse" | "review">("browse");
  const [subjects, setSubjects] = useState<string[]>([]);

  const gradeNum = parseInt(user?.grade || "5");

  const fetchData = useCallback(async () => {
    const auth = await supabase.auth.getUser();
    if (!user || !auth.data.user?.id) return;
    setIsLoading(true);

    const [cardsRes, progressRes] = await Promise.all([
      supabase
        .from("flashcards")
        .select("*")
        .lte("grade_level", gradeNum),
      supabase.from("user_flashcard_progress").select("*").eq("user_id", auth.data.user.id),
    ]);

    if (cardsRes.error) {
      console.error(cardsRes.error);
      toast.error("Failed to load flashcards");
    }

    if (cardsRes.data) {
      setFlashcards(cardsRes.data);
      setSubjects(Array.from(new Set<string>((cardsRes.data as any[]).map((card) => String(card.subject ?? "General")))).sort());
    }
    if (progressRes.error) {
      console.error(progressRes.error);
      toast.error("Failed to load flashcard progress");
    }

    if (progressRes.data) {
      const map: Record<string, FlashcardProgress> = {};
      progressRes.data.forEach((p: any) => { map[p.flashcard_id] = p; });
      setProgress(map);
    }
    setIsLoading(false);
  }, [gradeNum, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`flashcards-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flashcards' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_flashcard_progress', filter: `user_id=eq.${user.id}` }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, user?.id]);

  const filteredCards = selectedSubject
    ? flashcards.filter(f => f.subject === selectedSubject)
    : flashcards;

  const dueCards = filteredCards.filter(f => {
    const p = progress[f.id];
    if (!p) return true; // new cards
    return new Date(p.next_review_date) <= new Date();
  });

  const reviewCards = studyMode === "review" ? dueCards : filteredCards;
  const currentCard = reviewCards[currentIndex];

  const getStatusCounts = () => {
    const counts = { new: 0, learning: 0, review: 0, mastered: 0 };
    filteredCards.forEach(f => {
      const p = progress[f.id];
      if (!p) { counts.new++; return; }
      counts[p.status as keyof typeof counts]++;
    });
    return counts;
  };

  const handleDifficulty = async (level: "easy" | "medium" | "hard") => {
    if (!user || !currentCard) return;

    const existing = progress[currentCard.id];
    const ease = existing?.ease_factor || 2.5;
    const reps = existing?.repetition_count || 0;
    const interval = existing?.interval_days || 0;

    let newEase = ease;
    let newInterval = interval;
    let newStatus = "learning";

    if (level === "easy") {
      newEase = Math.min(ease + 0.15, 3.0);
      newInterval = interval === 0 ? 1 : Math.round(interval * newEase);
      newStatus = newInterval >= 21 ? "mastered" : newInterval >= 3 ? "review" : "learning";
    } else if (level === "medium") {
      newInterval = interval === 0 ? 1 : Math.round(interval * 1.2);
      newStatus = newInterval >= 21 ? "mastered" : newInterval >= 3 ? "review" : "learning";
    } else {
      newEase = Math.max(ease - 0.2, 1.3);
      newInterval = 0;
      newStatus = "learning";
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + Math.max(newInterval, 1));

    const upsertData = {
      user_id: user.id,
      flashcard_id: currentCard.id,
      status: newStatus,
      next_review_date: nextReview.toISOString(),
      repetition_count: reps + 1,
      ease_factor: newEase,
      interval_days: newInterval,
      last_reviewed_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_flashcard_progress")
      .upsert(upsertData, { onConflict: "user_id,flashcard_id" });

    if (error) {
      toast.error("Failed to save progress");
      console.error(error);
      return;
    }

    setProgress(prev => ({ ...prev, [currentCard.id]: upsertData as any }));
    setIsFlipped(false);

    if (currentIndex < reviewCards.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      toast.success("Session complete! 🎉");
      setSelectedSubject(null);
      setCurrentIndex(0);
    }
  };

  const statusCounts = getStatusCounts();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Subject selection view
  if (!selectedSubject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700 to-indigo-700 px-4 py-3 shadow-xl">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate("/academic")} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5" /> Flashcards
              </h1>
              <p className="text-xs text-white/60">{flashcards.length} cards • {dueCards.length} due for review</p>
            </div>
          </div>
        </header>

        {/* Stats */}
        <div className="px-4 py-4 max-w-4xl mx-auto">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "New", count: statusCounts.new, color: "bg-blue-500" },
              { label: "Learning", count: statusCounts.learning, color: "bg-yellow-500" },
              { label: "Review", count: statusCounts.review, color: "bg-orange-500" },
              { label: "Mastered", count: statusCounts.mastered, color: "bg-green-500" },
            ].map(s => (
              <Card key={s.label} className="bg-card/80 border-border/50">
                <CardContent className="p-3 text-center">
                  <div className={`w-3 h-3 rounded-full ${s.color} mx-auto mb-1`} />
                  <p className="text-lg font-bold">{s.count}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Due Review Button */}
        {dueCards.length > 0 && (
          <div className="px-4 max-w-4xl mx-auto mb-4">
            <Button
              className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground h-12 text-base"
              onClick={() => { setStudyMode("review"); setSelectedSubject("all"); setCurrentIndex(0); }}
            >
              <Brain className="h-5 w-5 mr-2" />
              Review {dueCards.length} Due Cards
            </Button>
          </div>
        )}

        {/* Subject List */}
        <div className="px-4 pb-24 max-w-4xl mx-auto space-y-3">
          {subjects.map(subject => {
            const subjectCards = flashcards.filter(f => f.subject === subject);
            const masteredCount = subjectCards.filter(f => progress[f.id]?.status === "mastered").length;
            const pct = subjectCards.length > 0 ? (masteredCount / subjectCards.length) * 100 : 0;

            return (
              <Card
                key={subject}
                className="cursor-pointer hover:shadow-lg transition-all border-border/50 bg-card/80"
                onClick={() => { setSelectedSubject(subject); setStudyMode("browse"); setCurrentIndex(0); }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold capitalize">{subject}</h3>
                    <p className="text-xs text-muted-foreground">{subjectCards.length} cards • {masteredCount} mastered</p>
                    <Progress value={pct} className="h-1.5 mt-2" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Study view
  if (!currentCard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Sparkles className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-xl font-bold mb-2">All caught up!</h2>
        <p className="text-muted-foreground mb-4 text-center">No cards to review right now. Come back later!</p>
        <Button onClick={() => { setSelectedSubject(null); setCurrentIndex(0); }}>Back to Subjects</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700 to-indigo-700 px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedSubject(null); setCurrentIndex(0); setIsFlipped(false); }} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white capitalize">{selectedSubject === "all" ? "Review" : selectedSubject}</h1>
            <p className="text-xs text-white/60">{currentIndex + 1} / {reviewCards.length}</p>
          </div>
          <Badge variant="outline" className="text-white border-white/30 capitalize text-xs">
            {currentCard.topic}
          </Badge>
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-4 py-2 max-w-4xl mx-auto w-full">
        <Progress value={((currentIndex + 1) / reviewCards.length) * 100} className="h-1.5" />
      </div>

      {/* Flashcard */}
      <div className="flex-1 flex items-center justify-center px-4 py-4">
        <motion.div
          className="w-full max-w-md cursor-pointer perspective-1000"
          onClick={() => setIsFlipped(!isFlipped)}
          whileTap={{ scale: 0.98 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isFlipped ? "back" : "front"}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -90, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className={`min-h-[280px] flex flex-col justify-center border-2 ${isFlipped ? "border-green-500/30 bg-green-50/5" : "border-primary/20 bg-card"}`}>
                <CardContent className="p-8 text-center">
                  <Badge variant="secondary" className="mb-4 text-xs">
                    {isFlipped ? "Answer" : "Question"}
                  </Badge>
                  <p className="text-lg font-medium leading-relaxed">
                    {isFlipped ? currentCard.answer : currentCard.question}
                  </p>
                  {!isFlipped && (
                    <p className="text-xs text-muted-foreground mt-6">Tap to reveal answer</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Difficulty Buttons */}
      {isFlipped && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="px-4 pb-8 max-w-md mx-auto w-full"
        >
          <p className="text-center text-sm text-muted-foreground mb-3">How well did you know this?</p>
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={() => handleDifficulty("hard")}
            >
              <span className="text-lg">😓</span>
              <span className="text-xs">Hard</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 border-yellow-300 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
              onClick={() => handleDifficulty("medium")}
            >
              <span className="text-lg">🤔</span>
              <span className="text-xs">Medium</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col gap-1 border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
              onClick={() => handleDifficulty("easy")}
            >
              <span className="text-lg">😎</span>
              <span className="text-xs">Easy</span>
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default FlashcardsPage;
