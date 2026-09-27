import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Brain, CheckCircle2, RotateCcw, Sparkles, Star, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";

type GameId = "memory" | "number" | "word" | "pattern" | "shape" | "science";

const gameList = [
  { id: "memory" as GameId, title: "Memory Match", subtitle: "Remember and match pairs", icon: "🧠", skill: "Memory" },
  { id: "number" as GameId, title: "Number Garden", subtitle: "Pick the number that solves it", icon: "🌱", skill: "Math" },
  { id: "word" as GameId, title: "Word Builder", subtitle: "Complete the word", icon: "🔤", skill: "Reading" },
  { id: "pattern" as GameId, title: "Pattern Detective", subtitle: "Find what comes next", icon: "🔎", skill: "Logic" },
  { id: "shape" as GameId, title: "Shape Safari", subtitle: "Find the matching shape", icon: "🔷", skill: "Shapes" },
  { id: "science" as GameId, title: "Science Sort", subtitle: "Sort the world around you", icon: "🌍", skill: "Science" },
];

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

const EarlyGamesPage: React.FC = () => {
  const { user } = useUser();
  const { refreshCurrency } = useCurrency();
  const [selected, setSelected] = useState<GameId | null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const grade = Number(user?.grade || 1);
  const ageBand = grade <= 1 ? "starter" : grade <= 2 ? "beginner" : "growing";

  const awardXp = async (amount: number) => {
    if (!user?.id) return;
    const key = `early-game-xp:${user.id}:${selected}:${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) return;
    await (supabase as any).rpc("add_xp", { p_user_id: user.id, p_amount: amount }).catch(() => undefined);
    localStorage.setItem(key, "1");
    await refreshCurrency();
  };

  const question = useMemo(() => {
    if (!selected) return null;
    if (selected === "number") {
      const a = grade <= 1 ? 2 : grade <= 2 ? 5 : 8;
      const b = grade <= 1 ? 3 : grade <= 2 ? 4 : 7;
      const correct = a + b;
      return { prompt: `What is ${a} + ${b}?`, options: shuffle([correct, correct + 1, Math.max(1, correct - 1), correct + 2]).map(String), correct: String(correct) };
    }
    if (selected === "word") {
      const words = grade <= 1 ? [{ word: "CAT", missing: "A", options: ["A", "O", "E"] }, { word: "SUN", missing: "U", options: ["A", "U", "I"] }] : [{ word: "PLANT", missing: "A", options: ["A", "E", "I"] }, { word: "TRAIN", missing: "R", options: ["R", "T", "N"] }];
      const item = words[round % words.length];
      return { prompt: `Which letter completes ${item.word.replace(item.missing, "_")}?`, options: shuffle(item.options), correct: item.missing };
    }
    if (selected === "pattern") {
      const patterns = grade <= 1 ? [{ p: "🔴 🔵 🔴 🔵 ?", options: ["🔴", "🟢", "🟡"], correct: "🔴" }, { p: "⭐ 🌙 ⭐ 🌙 ?", options: ["⭐", "☀️", "🌈"], correct: "⭐" }] : [{ p: "2, 4, 6, ?", options: ["7", "8", "9"], correct: "8" }, { p: "5, 10, 15, ?", options: ["18", "20", "25"], correct: "20" }];
      return patterns[round % patterns.length];
    }
    if (selected === "shape") {
      const items = grade <= 1 ? [{ prompt: "Find the circle", options: ["🔺", "⚪", "⬛"], correct: "⚪" }, { prompt: "Find the triangle", options: ["🟦", "🔺", "⚪"], correct: "🔺" }] : [{ prompt: "Find the rectangle", options: ["⚪", "▭", "🔺"], correct: "▭" }, { prompt: "Find the square", options: ["⬛", "⚪", "🔺"], correct: "⬛" }];
      return items[round % items.length];
    }
    if (selected === "science") {
      const items = [{ prompt: "Which one is a living thing?", options: ["🌳", "🪨", "⚽"], correct: "🌳" }, { prompt: "Which one can fly?", options: ["🐟", "🐦", "🐢"], correct: "🐦" }];
      return items[round % items.length];
    }
    const symbols = ["🐶", "🐱", "🐸", "🦊"];
    const pair = shuffle(symbols).slice(0, 2);
    return { prompt: "Find the matching pair", options: shuffle([pair[0], pair[0], pair[1], pair[1]]), correct: pair[0] };
  }, [selected, grade, round]);

  const choose = async (value: string) => {
    if (!question) return;
    const correct = value === question.correct;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      setScore((s) => s + 1);
      await awardXp(5);
    }
    window.setTimeout(() => {
      setFeedback(null);
      setRound((r) => r + 1);
    }, 650);
  };

  if (!selected) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link to="/" aria-label="Back home"><Button variant="ghost" size="icon"><ArrowLeft /></Button></Link>
            <div className="text-center"><p className="font-display font-bold">Master Minds Play</p><p className="text-xs text-muted-foreground">Short games that help you learn</p></div>
            <Badge variant="secondary"><Star className="mr-1 h-3.5 w-3.5" /> {score}</Badge>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">
          <section className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg">
            <div className="flex items-center gap-3"><Brain className="h-8 w-8" /><div><h1 className="text-2xl font-display font-bold">Choose a game</h1><p className="mt-1 text-sm text-primary-foreground/80">Play for a few minutes, learn a skill, earn XP.</p></div></div>
          </section>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            {gameList.map((game) => (
              <button key={game.id} onClick={() => { setSelected(game.id); setScore(0); setRound(0); }} className="rounded-3xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-4xl">{game.icon}</span>
                <p className="mt-3 font-display font-bold">{game.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{game.subtitle}</p>
                <Badge variant="outline" className="mt-3">{game.skill}</Badge>
              </button>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">Designed as short, simple activities with immediate feedback and age-appropriate interaction.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Choose another game"><ArrowLeft /></Button>
          <Badge variant="secondary"><Trophy className="mr-1 h-3.5 w-3.5" /> {score} points</Badge>
          <Button variant="ghost" size="icon" onClick={() => { setScore(0); setRound(0); setFeedback(null); }} aria-label="Restart"><RotateCcw /></Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Card className="overflow-hidden rounded-3xl">
          <CardHeader className="bg-primary/10 text-center">
            <Badge variant="outline" className="mx-auto w-fit">{gameList.find((g) => g.id === selected)?.skill}</Badge>
            <CardTitle className="text-2xl">{gameList.find((g) => g.id === selected)?.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-5 sm:p-8">
            <div className="min-h-32 rounded-3xl bg-muted/50 p-6 text-center">
              <p className="text-xl font-display font-bold sm:text-2xl">{question?.prompt}</p>
              {selected === "memory" ? <p className="mt-3 text-sm text-muted-foreground">Tap the animal that matches the highlighted animal.</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(question?.options || []).map((option, index) => (
                <Button key={`${option}-${index}`} variant="outline" onClick={() => choose(option)} className="min-h-20 rounded-2xl text-2xl sm:text-3xl" disabled={!!feedback}>
                  {option}
                </Button>
              ))}
            </div>
            {feedback && <div className={`rounded-2xl p-4 text-center font-bold ${feedback === "correct" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{feedback === "correct" ? <><CheckCircle2 className="mx-auto mb-1 h-7 w-7" />Great job!</> : <><XCircle className="mx-auto mb-1 h-7 w-7" />Try the next one!</>}</div>}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4" /> Level: {ageBand}</div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EarlyGamesPage;
