import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { useLearningDNA } from "@/hooks/useLearningDNA";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, BrainCircuit, CalendarDays, CheckCircle2, Clock3, GraduationCap, Library, Loader2, Target, Timer, TrendingUp } from "lucide-react";

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};


const UpperDesktopDashboard: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Array<{subject:string;topic:string;accuracy:number}>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let alive = true;
    supabase.from("topic_progress").select("subject,topic,accuracy_percentage,questions_attempted").eq("user_id", user.id)
      .then(({data}) => {
        if (!alive) return;
        setTopics((data || []).filter((r:any) => r.topic && Number(r.questions_attempted)>0)
          .map((r:any) => ({subject:String(r.subject || "General"),topic:String(r.topic),accuracy:Number(r.accuracy_percentage)||0}))
          .sort((x,y)=>x.accuracy-y.accuracy).slice(0,6));
        setLoading(false);
      }).catch(()=>{ if(alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.id]);
  const xp = Number((user as any)?.xp) || 0;
  const streak = Number((user as any)?.streak ?? (user as any)?.dayStreak);
  const nav = [
    ["Home", "⌂", "/home"], ["Drills", "ϟ", "/quiz"], ["Question bank", "▤", "/academic/entrance-papers"],
    ["Mock tests", "▣", "/academic/exam"], ["Study plan", "▦", "/academic/planner"], ["Vocabulary", "✣", "/academic/flashcards"],
    ["Courses", "▰", "/library"], ["Classroom", "♙", "/study-mode"], ["Leaderboard", "▥", "/leaderboard"],
    ["AI tutor", "♧", "/ai-tutor"], ["Discord", "☻", "/friends"]
  ] as const;
  const schedule = [
    {kind:"Drill", title:"Text Structure and Purpose", color:"pink", path:"/quiz"},
    {kind:"Vocabulary", title:"Review your due flashcards", color:"orange", path:"/academic/flashcards"},
    {kind:"Quiz", title:"Practice your selected exam subjects", color:"blue", path:"/academic/exam"}
  ];
  return <div className="mm-exact-desktop">
    <aside className="mm-exact-sidebar">
      <div className="mm-exact-brand"><span className="mm-exact-logo">◉</span><strong>{user?.name?.split(/\\s+/)[0] || "Master Minds"}</strong><span className="mm-exact-collapse">«</span></div>
      <nav>{nav.map(([label,icon,path],i)=><button key={label} data-active={i===0} onClick={()=>navigate(path)}><span>{icon}</span>{label}</button>)}</nav>
      <button className="mm-exact-settings" onClick={()=>navigate("/settings")}>⬡ <span>Settings &amp; more</span></button>
    </aside>
    <section className="mm-exact-main">
      <header className="mm-exact-top"><span className="mm-exact-pill">🔷 {xp.toLocaleString()}</span><div><span className="mm-exact-pill">🔥 {Number.isFinite(streak) && streak>0 ? streak : "—"}</span><button aria-label="Notifications" onClick={()=>navigate("/notifications")}>♧</button></div></header>
      <div className="mm-exact-grid">
        <div className="mm-exact-primary">
          <div className="mm-exact-topcards">
            <section className="mm-exact-card mm-exact-score"><div className="mm-exact-card-title">Target score <button aria-label="Edit target score" onClick={()=>navigate("/academic/setup")}>↗</button></div><strong>—</strong><small>Set your target in Academic Preparation</small><div className="mm-exact-scorebar mm-exact-scorebar-empty" aria-label="Target score not configured"><span /></div><div className="mm-exact-scorefoot">No verified score data recorded yet.</div><button className="mm-exact-link" onClick={()=>navigate("/academic/insights")}>View academic insights</button></section>
            <section className="mm-exact-card mm-exact-radar"><div className="mm-exact-card-title">Progress radar <span>R&amp;W&nbsp;&nbsp; Math</span></div><div className="mm-exact-radar-body"><svg viewBox="0 0 200 160" role="img" aria-label="Progress radar based on recorded topic performance"><g fill="none" stroke="#eadcf9" strokeWidth="1">{[25,45,65].map(r=><polygon key={r} points={`100,${80-r} ${100+r*.95},${80-r*.3} ${100+r*.6},${80+r*.8} ${100-r*.6},${80+r*.8} ${100-r*.95},${80-r*.3}`} />)}<path d="M100 15V145 M35 60L165 100 M35 100L165 60" /></g><polygon points={topics.length ? topics.slice(0,5).map((t,i)=>{const ang=(-90+i*72)*Math.PI/180; const r=20+Math.min(1,t.accuracy/100)*45; return `${100+Math.cos(ang)*r},${80+Math.sin(ang)*r}`}).join(" ") : ""} fill="#a855f7" fillOpacity=".18" stroke="#a855f7" strokeWidth="2"/></svg><div className="mm-exact-radar-labels"><span>Recorded topics</span><span>{loading?"Loading…":topics.length ? `${topics.length} tracked` : "No data yet"}</span></div></div></section>
          </div>
          <section className="mm-exact-card mm-exact-schedule"><div className="mm-exact-card-title">Quick starts <button aria-label="Open study planner" onClick={()=>navigate("/academic/planner")}>↗</button></div>{schedule.map(s=><button className={`mm-exact-task ${s.color}`} key={s.kind} onClick={()=>navigate(s.path)}><small>{s.kind}</small><strong>{s.title}</strong></button>)}</section>
          <section className="mm-exact-card mm-exact-performance"><div className="mm-exact-card-title">Topic performance <button onClick={()=>navigate("/academic/topics")}>View all ↗</button></div>{loading?<p>Loading saved topic performance…</p>:topics.length?<div className="mm-exact-topicgrid">{topics.map(t=><button key={t.subject+t.topic} onClick={()=>navigate("/academic/topics")}><strong>{t.topic}</strong><span>{t.subject}</span><b>{t.accuracy}%</b><i><em style={{width:`${Math.max(0,Math.min(100,t.accuracy))}%`}} /></i></button>)}</div>:<p>No topic results recorded yet. Complete practice to build your performance view.</p>}</section>
        </div>
        <aside className="mm-exact-right">
          <section className="mm-exact-card mm-exact-streak"><div className="mm-exact-big">🔥 {Number.isFinite(streak)&&streak>0?streak:"—"}</div><small>Day streak</small><div className="mm-exact-week">{["MO","TU","WE","TH","FR","SA","SU"].map(d=><span key={d}>{d}</span>)}</div><button className="mm-exact-link" onClick={()=>navigate("/study-mode")}>Start today's study session</button></section>
          <section className="mm-exact-card mm-exact-xp"><div className="mm-exact-big blue">🔷 {xp.toLocaleString()}</div><small>XP (Experience Points)</small><div className="mm-exact-rank"><span>Your ranking</span><strong>—</strong><span>Ranking appears when leaderboard data is available.</span></div><button className="mm-exact-outline" onClick={()=>navigate("/leaderboard")}>See full leaderboard</button></section>
          <section className="mm-exact-card mm-exact-countdown"><div className="mm-exact-calendar">🗓️</div><strong>Exam countdown</strong><p>No exam date set</p><button className="mm-exact-outline" onClick={()=>navigate("/academic/setup")}>Set exam details</button></section>
        </aside>
      </div>
    </section>
  </div>;
};

const UpperStudentDashboard: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { learningData, isLoading, error, reload } = useLearningDNA(user?.id);
  const [weakTopics, setWeakTopics] = useState<Array<{ subject: string; topic: string; accuracy: number }>>([]);
  const [dueFlashcards, setDueFlashcards] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(true);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setReviewLoading(true);
      const [topicsRes, cardsRes] = await Promise.all([
        supabase.from("topic_progress").select("subject,topic,accuracy_percentage,questions_attempted").eq("user_id", user.id),
        supabase.from("user_flashcard_progress").select("flashcard_id,next_review_date").eq("user_id", user.id).lte("next_review_date", new Date().toISOString()),
      ]);
      if (cancelled) return;
      const weak = (topicsRes.data || []).filter((row: any) => row.topic && Number(row.questions_attempted) > 0).map((row: any) => ({ subject: String(row.subject || "General"), topic: String(row.topic), accuracy: Number(row.accuracy_percentage) || 0 })).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);
      setWeakTopics(weak);
      setDueFlashcards(cardsRes.data?.length || 0);
      setReviewLoading(false);
    })().catch(() => { if (!cancelled) setReviewLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const topicCount = Object.keys(learningData?.topicMastery ?? {}).length;
  const attemptCount = learningData?.totalAttempts ?? 0;

  const actions = [
    { title: "Exam preparation", description: "Continue exam practice and entrance-paper preparation.", label: "Open Exam Hub", path: "/academic/exam", icon: Target },
    { title: "Focus Studio", description: "Start a focused session or join your study room.", label: "Start studying", path: "/study-mode", icon: Timer },
    { title: "Topic coverage", description: "Review topics and identify what needs more practice.", label: "View topics", path: "/academic/topics", icon: TrendingUp },
    { title: "Flashcards", description: "Use active recall to strengthen what you have learned.", label: "Review cards", path: "/academic/flashcards", icon: BrainCircuit },
    { title: "Study planner", description: "Organize the next steps in your study schedule.", label: "Open planner", path: "/academic/planner", icon: CalendarDays },
    { title: "Digital library", description: "Return to your learning resources and textbooks.", label: "Open library", path: "/library", icon: Library },
  ];

  const xp = Number((user as any)?.xp) || 0;
  const level = Number((user as any)?.level) || 1;
  const xpIntoLevel = xp % 1000;
  const xpPercent = Math.min(100, Math.round((xpIntoLevel / 1000) * 100));
  const avatarUrl = (user as any)?.avatar as string | undefined;
  const initial = (firstName || "M").charAt(0).toUpperCase();

  return <><UpperDesktopDashboard /><main className="upper-mobile-dashboard upper-tier-studio mx-auto w-full max-w-[1440px] space-y-6 px-4 py-5 pb-28 sm:px-6 sm:py-7 lg:px-8 lg:pb-8">
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(520px circle at 85% -10%, hsl(var(--primary) / .22), transparent 60%), radial-gradient(420px circle at -5% 110%, hsl(var(--accent) / .14), transparent 55%)" }} />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,.6fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">MASTER MINDS SECONDARY · GRADES 9–12</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-16 w-16 rounded-2xl border border-border object-cover shadow-[var(--shadow-card)] sm:h-20 sm:w-20" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-[var(--shadow-card)] sm:h-20 sm:w-20 sm:text-3xl">{initial}</div>
              )}
              <span className="absolute -bottom-2 -right-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground shadow">Lv {level}</span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl sm:text-3xl">{firstName ? `${greeting()}, ${firstName}` : "Your Academic Studio"}</h1>
              <div className="mt-2 max-w-md">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground"><span>{xp.toLocaleString()} XP</span><span>Level {level + 1} at {((level) * 1000).toLocaleString()} XP</span></div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${xpPercent}%` }} /></div>
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">A focused space for exam preparation, independent study, and steady progress. Pick one useful next step and get started.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => navigate("/study-mode")} className="min-h-11 shadow-[0_3px_0_hsl(var(--primary-hover))] transition-transform active:translate-y-[3px] active:shadow-none"><Timer className="mr-2 h-4 w-4"/>Start Study Mode</Button>
            <Button variant="outline" onClick={() => navigate("/academic")} className="min-h-11"><GraduationCap className="mr-2 h-4 w-4"/>Academic Preparation</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <Clock3 className="h-5 w-5 text-primary"/>
            <p className="mt-3 text-2xl font-bold tabular-nums">{isLoading ? "—" : attemptCount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Recorded attempts</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <BookOpen className="h-5 w-5 text-primary"/>
            <p className="mt-3 text-2xl font-bold tabular-nums">{isLoading ? "—" : topicCount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Topics tracked</p>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="daily-workout-title" className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,.6fr)]">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Daily entrance workout</p>
        <h2 id="daily-workout-title" className="mt-2 text-xl font-bold sm:text-2xl">Ten focused questions. One useful step forward.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Start a 10-question practice session using the subjects in your Academic Prep setup. Questions are labelled by source in Exam Mode.</p>
        <Button className="mt-4 min-h-11" onClick={() => navigate("/academic/exam", { state: { workoutQuestionCount: 10 } })}><Target className="mr-2 h-4 w-4"/>Start Today's Workout (10 Questions)<ArrowRight className="ml-2 h-4 w-4"/></Button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Academic calendar</p>
        <p className="mt-2 text-lg font-bold">2017 E.C.</p>
        <p className="text-sm text-muted-foreground">2024/25 G.C.</p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Ethiopian calendar labels are used in the entrance-paper archive to avoid mixing E.C. and G.C. exam years.</p>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,.75fr)]" aria-label="Study momentum and review priorities">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Spaced repetition</p><h2 className="mt-1 text-lg font-bold">Weakness radar</h2></div><Badge variant="outline">{reviewLoading ? "Checking…" : `${dueFlashcards} cards due`}</Badge></div>
        {reviewLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading saved topic and flashcard progress…</p> : weakTopics.length ? <div className="mt-4 space-y-3">{weakTopics.map((topic) => <div key={topic.subject + topic.topic} className="flex items-center gap-3 rounded-xl border border-border p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{topic.topic}</p><p className="text-xs text-muted-foreground">{topic.subject} · {topic.accuracy}% recorded accuracy</p></div><Button size="sm" variant="outline" onClick={() => navigate("/academic/topics")}>Review</Button></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">No topic weaknesses are recorded yet. Complete a practice session to build your review priorities.</p>}
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate("/academic/flashcards")}>Review due cards <ArrowRight className="ml-2 h-4 w-4"/></Button><Button variant="ghost" onClick={() => navigate("/academic/topics")}>Topic Coverage</Button></div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Study momentum</p><h2 className="mt-1 text-lg font-bold">Make time to focus</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Start a focus session and keep your study activity connected to your saved learning record.</p><Button className="mt-4 min-h-11 w-full" onClick={() => navigate("/study-mode")}><Timer className="mr-2 h-4 w-4"/>Open Focus Studio</Button><p className="mt-3 text-xs text-muted-foreground">Weekly focus hours and streaks are shown only when the account has verified session records.</p></div>
    </section>

    <section aria-labelledby="daily-workspace-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="daily-workspace-title" className="text-xl font-bold">Your workspace</h2><p className="mt-1 text-sm text-muted-foreground">Direct access to the tools you use most.</p></div>
        <Button variant="ghost" onClick={() => navigate("/learning-dna")} className="min-h-11">Learning DNA <ArrowRight className="ml-2 h-4 w-4"/></Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map(({title,description,label,path,icon:Icon}) => <Card key={path} className="min-w-0 transition-colors hover:border-primary/40">
          <CardContent className="flex h-full flex-col p-5">
            <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></span>
            <h3 className="text-base font-bold">{title}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{description}</p>
            <Button variant="outline" className="mt-4 min-h-11 w-full justify-between" onClick={() => navigate(path)}>{label}<ArrowRight className="h-4 w-4"/></Button>
          </CardContent>
        </Card>)}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5"/></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">Your learning record</h2>
          {isLoading ? <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading your saved learning activity…</p> :
            error ? <><p className="mt-1 text-sm text-muted-foreground">Your learning record could not be loaded right now.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void reload()}>Try again</Button></> :
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{attemptCount || topicCount ? `Your account currently has ${attemptCount} recorded attempts across ${topicCount} tracked topics.` : "Your saved progress will appear here as you complete study activity."} Open Learning DNA for the detailed view.</p>}
        </div>
        <Button variant="ghost" size="icon" aria-label="Open Learning DNA" onClick={() => navigate("/learning-dna")}><ArrowRight className="h-5 w-5"/></Button>
      </div>
    </section>
  </main></>;
};

export default UpperStudentDashboard;
