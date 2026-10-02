import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Flame, Gamepad2, Heart, Timer, Trophy, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useEarlyReward } from "@/hooks/useEarlyReward";
import { useEarlyProgress } from "@/hooks/useEarlyProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGradeProfile, toEarlyGrade } from "@/features/early/engine/gradeProfile";
import { GAME_CATALOG, gradeGameRounds, type GameKind } from "@/features/early/games/gameEngine";

function gradeName(grade: number) {
  if (grade === 0) return "Foundation";
  if (grade === 1) return "Explorer";
  if (grade === 2) return "Builder";
  if (grade === 3) return "Solver";
  return "Master";
}

export default function EarlyGamesPage() {
  const nav = useNavigate();
  const { user } = useUser();
  const reward = useEarlyReward();
  const { rows } = useEarlyProgress();
  const grade = toEarlyGrade(user?.grade);
  const profile = getGradeProfile(grade);

  const [game, setGame] = useState<GameKind | null>(null);
  const [rounds, setRounds] = useState(() => gradeGameRounds("number", grade));
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState(false);

  const plays = useMemo(() => Object.fromEntries(rows.map((row) => [row.activity_id, row.completions])), [rows]);

  const difficultyFor = (id: GameKind) => {
    const row = rows.find((item) => item.activity_id === `early-game-${id}`);
    if (!row || row.attempts < 5) return Math.min(5, grade + 1);
    const accuracy = row.correct_answers / Math.max(1, row.attempts);
    if (accuracy >= 0.9) return Math.min(5, 3 + Math.floor(row.attempts / 10));
    if (accuracy < 0.65) return 1;
    return 2;
  };

  const timerFor = (difficulty: number) => {
    if (profile.timerSeconds <= 0) return 0;
    return Math.max(10, profile.timerSeconds + 8 - difficulty * 2);
  };

  const startGame = (id: GameKind) => {
    const difficulty = difficultyFor(id);
    setGame(id);
    setRounds(gradeGameRounds(id, grade, Math.max(6, profile.sessionLength), difficulty));
    setRound(0);
    setScore(0);
    setStreak(0);
    setLives(3);
    setSelected(null);
    setFinished(false);
    setSeconds(timerFor(difficulty));
  };

  const current = rounds[round];

  useEffect(() => {
    if (!game || finished || !current || selected || seconds <= 0) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setSelected("__TIMEOUT__");
          setLives((value) => Math.max(0, value - 1));
          setStreak(0);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [game, finished, current, selected, seconds]);

  const choose = async (value: string) => {
    if (!current || selected || !game) return;

    setSelected(value);
    const correct = value === current.answer;

    if (correct) {
      setScore((value) => value + 1);
      setStreak((value) => value + 1);
      await reward("gameCorrect", {
        activityId: `early-game-${game}`,
        skill: current.skill,
        completed: round === rounds.length - 1,
      });
    } else {
      setLives((value) => Math.max(0, value - 1));
      setStreak(0);
    }
  };

  const nextRound = () => {
    if (round >= rounds.length - 1 || lives <= 0) {
      setFinished(true);
      return;
    }

    setRound((value) => value + 1);
    setSelected(null);
    setSeconds(timerFor(difficultyFor(game!)));
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-background px-4 pb-24">
        <header className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" onClick={() => nav("/")} aria-label="Back">
              <ArrowLeft />
            </button>
            <div className="flex-1">
              <p className="font-display text-xl font-bold">Play Lab</p>
              <p className="text-xs text-muted-foreground">{profile.label} • {gradeName(grade)} level</p>
            </div>
            <Gamepad2 className="text-primary" />
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-5 py-5">
          <section className="rounded-[2rem] bg-gradient-to-br from-primary/15 via-accent/10 to-warning/10 p-5 sm:p-8">
            <div className="text-5xl">🎮🧠🚀</div>
            <p className="mt-2 font-semibold text-primary">Games that grow with you</p>
            <h1 className="text-3xl font-display font-bold">Your challenge is personal</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              KG builds foundations. Grades 1–4 get richer reasoning, bigger numbers, more choices and faster challenges as their mastery grows.
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {GAME_CATALOG.filter((item) => grade >= item.minGrade).map((item) => {
              const level = Math.min(5, 1 + Math.floor((plays[`early-game-${item.id}`] || 0) / 2));
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => startGame(item.id)}
                  className="group min-h-48 rounded-[1.75rem] border bg-card p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg active:scale-[.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl transition group-hover:scale-110">
                      {item.icon}
                    </div>
                    <span className="text-xs font-bold text-primary">LV {level}</span>
                  </div>
                  <h2 className="mt-3 font-display text-lg font-bold">{item.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Zap className="h-3 w-3 text-warning" />
                    {plays[`early-game-${item.id}`] || 0} plays • adapts to you
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  if (finished) {
    const percentage = Math.round((score / Math.max(1, rounds.length)) * 100);
    const title = percentage >= 80 ? "Mission complete!" : percentage >= 50 ? "Great adventure!" : "Keep exploring!";

    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <main className="mx-auto max-w-xl">
          <Card className="rounded-[2rem] text-center">
            <CardContent className="space-y-5 p-7">
              <div className="text-6xl">{percentage >= 80 ? "🏆" : percentage >= 50 ? "🌟" : "💪"}</div>
              <h1 className="text-3xl font-display font-bold">{title}</h1>
              <p className="text-muted-foreground">{score} of {rounds.length} missions solved</p>
              <div className="h-4 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentage}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="min-h-12 rounded-2xl bg-primary font-bold text-primary-foreground" onClick={() => startGame(game)}>
                  Play again
                </button>
                <button type="button" className="min-h-12 rounded-2xl border font-bold" onClick={() => setGame(null)}>
                  Choose game
                </button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-32">
      <header className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" onClick={() => setGame(null)} aria-label="Back to games">
            <ArrowLeft />
          </button>
          <div className="flex-1">
            <p className="font-display font-bold">{GAME_CATALOG.find((item) => item.id === game)?.title}</p>
            <p className="text-xs text-muted-foreground">Round {round + 1}/{rounds.length} • {profile.label}</p>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary"><Heart className="mr-1 h-3 w-3" />{lives}</Badge>
            <Badge variant="secondary"><Flame className="mr-1 h-3 w-3" />{streak}</Badge>
            <Badge>{score}</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 py-5">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(round / rounds.length) * 100}%` }} />
        </div>

        {profile.timerSeconds > 0 && (
          <div className={`flex items-center justify-center gap-2 rounded-2xl p-2 text-sm font-bold ${seconds <= 5 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            <Timer className="h-4 w-4" />
            {seconds}s challenge timer
          </div>
        )}

        {current && (
          <Card className="overflow-hidden rounded-[2rem]">
            <CardContent className="space-y-5 p-5 sm:p-8">
              <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center">
                <div className="mb-3 text-5xl">{current.visual || "🎯"}</div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Mission • {gradeName(grade)}</p>
                <h1 className="mt-2 text-2xl font-display font-bold">{current.prompt}</h1>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {current.options.map((option, index) => {
                  const correct = option === current.answer;
                  const chosen = selected === option;
                  let className = "border-border bg-card hover:border-primary/50";
                  if (selected) className = correct ? "border-success bg-success/10" : "opacity-45";
                  if (chosen && !correct) className = "border-destructive bg-destructive/10";

                  return (
                    <button
                      key={`${option}-${index}`}
                      type="button"
                      disabled={!!selected}
                      onClick={() => void choose(option)}
                      className={`min-h-20 rounded-3xl border-2 border-b-4 px-4 text-left text-lg font-bold transition active:translate-y-0.5 ${className}`}
                    >
                      {String.fromCharCode(65 + index)}. {option}
                    </button>
                  );
                })}
              </div>

              {selected && (
                <div className={`rounded-3xl p-4 text-center font-semibold ${selected === current.answer ? "bg-success/15 text-success" : "bg-warning/15"}`}>
                  {selected === current.answer ? "🎉 Brilliant! Keep that streak going!" : selected === "__TIMEOUT__" ? `⏰ Time is up — the answer was ${current.answer}.` : `💡 Good try! ${current.explain}`}
                </div>
              )}

              {selected && (
                <button type="button" onClick={nextRound} className="min-h-12 w-full rounded-2xl bg-primary font-bold text-primary-foreground">
                  {round >= rounds.length - 1 || lives <= 0 ? "See results" : "Next mission →"}
                </button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Trophy className="h-4 w-4" />
          Build skills, earn XP and unlock treasures.
        </div>
      </main>
    </div>
  );
}