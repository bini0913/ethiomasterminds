import React from "react";
import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Brain, Target, Calendar, BarChart3, GraduationCap, TrendingUp, ArrowRight, Settings2 } from "lucide-react";
import { getAcademicProfile, normalizeGrade } from "@/lib/academicProfile";

const features = [
  { title: "Academic Prep", description: "Practice by subject and exam goal.", icon: Target, path: "/academic/exam" },
  { title: "Flashcards", description: "Active recall with spaced review.", icon: BookOpen, path: "/academic/flashcards" },
  { title: "Topic Coverage", description: "See what you have mastered and what is next.", icon: BarChart3, path: "/academic/topics" },
  { title: "Study Planner", description: "Build daily and weekly study habits.", icon: Calendar, path: "/academic/planner" },
  { title: "Academic Insights", description: "Understand your accuracy, streaks and weak areas.", icon: TrendingUp, path: "/academic/insights" },
];

const AcademicMode: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const p = await getAcademicProfile(user.id).catch(() => null);
      if (!p) {
        navigate("/academic/setup", { replace: true });
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const plans = await supabase.from("study_plans").select("id,completed").eq("user_id", user.id).eq("scheduled_date", today);
      if (cancelled) return;
      setProfile(p);
      setTodayCount(plans.data?.length || 0);
      setTodayCompleted(plans.data?.filter((x) => x.completed).length || 0);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, navigate]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Preparing your Academic Prep…</div>;

  const grade = normalizeGrade(profile.grade, normalizeGrade(user?.grade, 9));
  const goal = profile.study_goal_detail || ({
    class: "School / Class",
    ministry_exam: "Ministry Exam",
    university_entrance: "University Entrance",
    national_exam: "National / Regional Exam",
    custom: "Custom goal",
  } as Record<string, string>)[profile.study_goal] || "Study goal";
  const progress = todayCount ? Math.round((todayCompleted / todayCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-2.5"><GraduationCap className="h-6 w-6 text-primary" /></div>
            <div className="min-w-0"><h1 className="truncate text-xl font-bold">Academic Prep</h1><p className="text-sm text-muted-foreground">Grade {grade} • {goal}</p></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/academic/setup")}><Settings2 className="mr-2 h-4 w-4" />Edit setup</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 pb-24">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your preparation profile</p>
                <h2 className="mt-1 text-lg font-bold">{profile.curriculum === "oromia" ? "Oromia Curriculum" : "Addis Ababa Curriculum"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{(profile.subjects || []).join(" • ")}{profile.book_title ? ` • ${profile.book_title}` : ""}</p>
              </div>
              <div className="rounded-xl border bg-background px-4 py-3 text-sm"><p className="text-muted-foreground">Today's plan</p><p className="font-bold">{todayCompleted}/{todayCount} complete</p></div>
            </div>
            {todayCount > 0 && <Progress value={progress} className="mt-4 h-2" />}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return <Card key={feature.path} className="group cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg" onClick={() => navigate(feature.path)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-primary/10 p-2.5"><Icon className="h-5 w-5 text-primary" /></div><ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" /></div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3><p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>;
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Subjects</p><p className="mt-1 text-2xl font-bold">{profile.subjects?.length || 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Study goal</p><p className="mt-1 font-semibold">{goal}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Grade level</p><p className="mt-1 text-2xl font-bold">{grade}</p></CardContent></Card>
        </div>

        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><Brain className="h-5 w-5 text-primary" /><div><p className="font-semibold">Personalized preparation</p><p className="text-sm text-muted-foreground">Academic Prep uses your saved grade, curriculum, subjects and goal across the study tools. AI Tutor remains separate.</p></div><Badge className="ml-auto hidden sm:inline-flex">Profile-aware</Badge></div></CardContent></Card>
      </main>
    </div>
  );
};

export default AcademicMode;
