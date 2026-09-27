import React, { useMemo } from "react";
import { ArrowLeft, Brain, CheckCircle2, Target, Trophy } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEarlyProgress } from "@/hooks/useEarlyProgress";
import { useEarlyAchievements } from "@/hooks/useEarlyAchievements";

const label = (value:string) => value.replace(/-/g," ").replace(/\b\w/g, m => m.toUpperCase());

const EarlyProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const { rows, summary, isLoading, error } = useEarlyProgress();
  const { items: achievements } = useEarlyAchievements();

  const skills = useMemo(() => {
    const grouped = new Map<string,{attempts:number;correct:number;completions:number}>();
    rows.forEach(row => {
      const current = grouped.get(row.skill) ?? {attempts:0,correct:0,completions:0};
      current.attempts += row.attempts;
      current.correct += row.correct_answers;
      current.completions += row.completions;
      grouped.set(row.skill,current);
    });
    return [...grouped.entries()].map(([skill,value]) => ({
      skill,
      ...value,
      accuracy:value.attempts ? Math.round(value.correct/value.attempts*100) : 0,
    })).sort((a,b)=>b.accuracy-a.accuracy);
  }, [rows]);

  return <div className="min-h-screen bg-background px-4 pb-24">
    <header className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <Button variant="ghost" size="icon" onClick={()=>navigate("/")} aria-label="Back"><ArrowLeft /></Button>
        <div><p className="font-display text-xl font-bold">My Learning</p><p className="text-xs text-muted-foreground">See the skills you are growing</p></div>
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-5 py-6">
      <section className="rounded-[2rem] bg-primary p-6 text-primary-foreground">
        <div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/15"><Brain className="h-7 w-7"/></div><div><p className="text-sm opacity-90">Learning progress</p><h1 className="text-3xl font-display font-bold">Keep growing!</h1></div></div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Skills" value={String(summary.skills.length)} />
          <Stat label="Tries" value={String(summary.attempts)} />
          <Stat label="Accuracy" value={summary.attempts ? `${summary.accuracy}%` : "—"} />
        </div>
      </section>
      {isLoading && <Card><CardContent className="p-6 text-center text-muted-foreground">Loading your progress…</CardContent></Card>}
      {!isLoading && error && <Card><CardContent className="p-6 text-center"><p className="font-semibold">Progress is not available yet.</p><p className="mt-1 text-sm text-muted-foreground">Finish an activity after the Early progress update is installed.</p></CardContent></Card>}
      {!isLoading && !error && !skills.length && <Card className="rounded-[1.75rem]"><CardContent className="space-y-4 p-6 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><Target className="h-8 w-8 text-primary"/></div><h2 className="text-xl font-display font-bold">Your first skill is waiting</h2><p className="text-sm text-muted-foreground">Play a game or take a quiz and Master Minds will start tracking what you practise.</p><Button asChild><Link to="/early-games">Play a game</Link></Button></CardContent></Card>}
      <section className="space-y-3"><h2 className="font-display text-2xl font-bold">Achievements</h2><div className="grid gap-3 sm:grid-cols-2">{achievements.map(a=><Card key={a.id} className="rounded-[1.5rem]"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="text-3xl">{a.icon}</div><div className="min-w-0 flex-1"><h3 className="font-display font-bold">{a.name}</h3><p className="text-xs text-muted-foreground">{a.description}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{width:`${Math.min(100,Math.round(a.progress/a.requirement_value*100))}%`}} /></div></div><Badge variant={a.completed?"default":"secondary"}>{a.completed?"Done":`${a.progress}/${a.requirement_value}`}</Badge></div></CardContent></Card>)}</div></section>
      <div className="space-y-3">{skills.map(skill=><Card key={skill.skill} className="rounded-[1.5rem]"><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold">{label(skill.skill)}</h2><p className="text-sm text-muted-foreground">{skill.attempts} tries • {skill.completions} completed</p></div><Badge variant={skill.accuracy>=80?"default":"secondary"}>{skill.accuracy}%</Badge></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${skill.accuracy}%`}} /></div><div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">{skill.accuracy>=80?<><Trophy className="h-4 w-4 text-warning"/>Growing strong</>:<><CheckCircle2 className="h-4 w-4"/>Keep practising</>}</div></CardContent></Card>)}</div>
    </main>
  </div>;
};

const Stat=({label,value}:{label:string;value:string})=><div className="rounded-2xl bg-primary-foreground/15 p-3 text-center"><p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p><p className="mt-1 font-display text-lg font-bold">{value}</p></div>;
export default EarlyProgressPage;
