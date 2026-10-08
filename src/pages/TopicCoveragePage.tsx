import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, CheckCircle, Lock, Star, Trophy, BookOpen } from "lucide-react";
import { getAcademicProfile, normalizeSubject } from "@/lib/academicProfile";

interface TopicData {
  subject: string;
  topic: string;
  accuracy_percentage: number;
  completion_percentage: number;
  questions_attempted: number;
  questions_correct: number;
}

const COMMON_PATHS: Record<string, string[]> = {
  math: ["Numbers & Operations", "Algebra", "Linear Equations", "Quadratic Equations", "Functions", "Trigonometry", "Statistics", "Calculus"],
  science: ["Scientific Method", "Mechanics", "Energy", "Waves", "Electricity", "Atomic Structure", "Chemistry", "Biology"],
  physics: ["Mechanics", "Energy", "Waves", "Electricity", "Magnetism", "Thermodynamics", "Modern Physics"],
  chemistry: ["Atomic Structure", "Chemical Bonding", "Stoichiometry", "Acids & Bases", "Organic Chemistry", "Equilibrium", "Electrochemistry"],
  biology: ["Cells", "Genetics", "Evolution", "Human Biology", "Ecology", "Plant Biology", "Microbiology"],
  english: ["Grammar", "Vocabulary", "Reading Comprehension", "Writing", "Literature", "Critical Analysis", "Research Writing"],
  history: ["Ancient History", "Medieval History", "Modern Ethiopia", "World History", "African History", "Civics & Governance"],
  geography: ["Maps & Location", "Physical Geography", "Climate", "Population", "Resources", "Ethiopian Geography"],
  economics: ["Basic Economics", "Demand & Supply", "Markets", "National Income", "Development", "International Trade"],
  civics: ["Citizenship", "Constitution", "Rights & Duties", "Governance", "Democracy", "Ethiopian Institutions"],
  ict: ["Digital Basics", "Computer Systems", "Networks", "Data", "Programming", "Digital Safety"],
};

const labelFor = (value: string) => value.replace(/\b\w/g, (m) => m.toUpperCase());

const TopicCoveragePage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [profileSubjects, setProfileSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const [profileRes, progressRes] = await Promise.all([
        getAcademicProfile(user.id),
        supabase.from("topic_progress").select("*").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setProfileSubjects((profileRes?.subjects || []).map(normalizeSubject));
      setTopics((progressRes.data || []) as TopicData[]);
      setIsLoading(false);
    })().catch((error) => {
      console.error(error);
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const subjects = useMemo(() => {
    const fromProfile = profileSubjects;
    const fromProgress = topics.map((t) => normalizeSubject(t.subject));
    return Array.from(new Set([...fromProfile, ...fromProgress])).filter(Boolean);
  }, [profileSubjects, topics]);

  const getPath = (subject: string) => {
    const normalized = normalizeSubject(subject);
    return COMMON_PATHS[normalized] || [
      "Foundations", "Core Concepts", "Key Terms", "Practice", "Applications", "Advanced Concepts", "Revision", "Exam Practice",
    ];
  };

  const getStatus = (subject: string, topicName: string) => {
    const match = topics.find((t) =>
      normalizeSubject(t.subject) === normalizeSubject(subject) &&
      t.topic.trim().toLowerCase() === topicName.trim().toLowerCase()
    );
    if (!match) return { status: "new" as const, accuracy: 0, attempted: 0 };
    if (Number(match.accuracy_percentage) >= 80 && match.questions_attempted >= 5)
      return { status: "mastered" as const, accuracy: Number(match.accuracy_percentage), attempted: match.questions_attempted };
    return { status: "progress" as const, accuracy: Number(match.accuracy_percentage), attempted: match.questions_attempted };
  };

  const subjectProgress = (subject: string) => {
    const path = getPath(subject);
    const mastered = path.filter((topic) => getStatus(subject, topic).status === "mastered").length;
    const active = path.filter((topic) => getStatus(subject, topic).attempted > 0).length;
    return { mastered, active, total: path.length, pct: Math.round((mastered / path.length) * 100) };
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading your learning paths…</div>;

  if (!selectedSubject) {
    const total = subjects.reduce((sum, s) => sum + subjectProgress(s).total, 0);
    const mastered = subjects.reduce((sum, s) => sum + subjectProgress(s).mastered, 0);
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/academic")}><ArrowLeft className="h-5 w-5" /></Button>
            <div><h1 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Topic Coverage</h1><p className="text-xs text-muted-foreground">Your personalized Grade-level mastery paths</p></div>
          </div>
        </header>
        <main className="mx-auto max-w-4xl space-y-4 px-4 py-5 pb-24">
          <Card className="border-primary/20 bg-primary/5"><CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-3"><Trophy className="h-6 w-6 text-primary" /></div>
            <div className="flex-1"><p className="font-semibold">Overall mastery</p><p className="text-sm text-muted-foreground">{mastered} of {total} topics mastered</p></div>
            <div className="text-right"><p className="text-xl font-bold">{total ? Math.round(mastered / total * 100) : 0}%</p><p className="text-xs text-muted-foreground">Complete</p></div>
          </CardContent></Card>
          {subjects.length === 0 ? (
            <Card><CardContent className="p-8 text-center"><BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-semibold">Choose your subjects first</p><Button className="mt-4" onClick={() => navigate("/academic/setup")}>Edit Academic Prep</Button></CardContent></Card>
          ) : subjects.map((subject, i) => {
            const p = subjectProgress(subject);
            return <motion.div key={subject} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*.05}}>
              <Card className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => setSelectedSubject(subject)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{labelFor(subject)}</p><p className="text-xs text-muted-foreground">{p.mastered}/{p.total} mastered • {p.active} started</p></div><Badge variant={p.pct >= 80 ? "default" : "secondary"}>{p.pct}%</Badge></div>
                  <Progress value={p.pct} className="mt-3 h-2" />
                </CardContent>
              </Card>
            </motion.div>;
          })}
        </main>
      </div>
    );
  }

  const path = getPath(selectedSubject);
  const progress = subjectProgress(selectedSubject);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-3"><Button variant="ghost" size="icon" onClick={() => setSelectedSubject(null)}><ArrowLeft className="h-5 w-5" /></Button><div className="flex-1"><h1 className="font-bold">{labelFor(selectedSubject)}</h1><p className="text-xs text-muted-foreground">{progress.mastered}/{progress.total} mastered</p></div><Badge>{progress.pct}%</Badge></div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5 pb-24">
        <Progress value={progress.pct} className="mb-5 h-2" />
        <div className="space-y-3">
          {path.map((topic, index) => {
            const status = getStatus(selectedSubject, topic);
            const unlocked = index === 0 || getStatus(selectedSubject, path[index - 1]).status !== "new";
            return <motion.div key={topic} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:index*.04}}>
              <Card className={!unlocked ? "opacity-50" : "cursor-pointer hover:shadow-md"} onClick={() => unlocked && navigate(`/quiz?subject=${encodeURIComponent(selectedSubject)}&topic=${encodeURIComponent(topic)}`)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${status.status === "mastered" ? "bg-green-500/10 text-green-600" : unlocked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {status.status === "mastered" ? <CheckCircle className="h-5 w-5" /> : unlocked ? <Star className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{index + 1}. {topic}</p>{status.attempted > 0 && <p className="text-xs text-muted-foreground">{status.attempted} questions • {Math.round(status.accuracy)}% accuracy</p>}</div>
                  {unlocked && status.status !== "mastered" && <Button size="sm" variant="outline"><BookOpen className="mr-1 h-3 w-3" />Practice</Button>}
                </CardContent>
              </Card>
            </motion.div>;
          })}
        </div>
      </main>
    </div>
  );
};

export default TopicCoveragePage;
