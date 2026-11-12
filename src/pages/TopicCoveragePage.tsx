import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, CheckCircle, Lock, Star, Trophy, BookOpen, LibraryBig, GraduationCap } from "lucide-react";
import { getAcademicProfile, normalizeSubject } from "@/lib/academicProfile";
import { loadBookAnalyses } from "@/lib/bookAnalysis";
import SkillTree from "@/components/academic/SkillTree";

interface TopicData {
  subject: string;
  topic: string;
  accuracy_percentage: number;
  completion_percentage: number;
  questions_attempted: number;
  questions_correct: number;
}



const labelFor = (value: string) => value.replace(/\b\w/g, (m) => m.toUpperCase());

const TopicCoveragePage: React.FC = () => {
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";
  const navigate = useNavigate();
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [profileSubjects, setProfileSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooks, setSelectedBooks] = useState<Array<{id:string;title:string;author:string;subject:string;description:string}>>([]);
  const [bookUnits, setBookUnits] = useState<Record<string, { units: string[]; pageCount: number; method: string; message?: string }>>({});

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
      let cachedAnalysis: typeof bookUnits = {};
      try { const savedAnalysis = localStorage.getItem("masterminds:book-analysis:" + user.id); if (savedAnalysis) cachedAnalysis = JSON.parse(savedAnalysis); } catch { /* ignore invalid cached analysis */ }
      try {
        const persistedAnalysis = await loadBookAnalyses(user.id);
        if (!cancelled) {
          const mergedAnalysis = { ...cachedAnalysis, ...persistedAnalysis };
          setBookUnits(mergedAnalysis);
          localStorage.setItem("masterminds:book-analysis:" + user.id, JSON.stringify(mergedAnalysis));
        }
      } catch (analysisError) {
        console.warn("Could not load account textbook analysis; using this device's cache.", analysisError);
        if (!cancelled) setBookUnits(cachedAnalysis);
      }
      setTopics((progressRes.data || []) as TopicData[]);
      let bookIds = Array.from(new Set([...(profileRes?.book_ids || []), ...(profileRes?.book_id ? [profileRes.book_id] : [])]));
      try { const selected = localStorage.getItem("masterminds:study-plan-books:" + user.id); if (selected !== null) bookIds = JSON.parse(selected) as string[]; } catch { /* keep Academic Prep selection */ }
      if (bookIds.length) {
        const { data: books, error: booksError } = await supabase.from("library_books").select("id,title,author,subject,description").in("id", bookIds);
        if (booksError) console.warn("Could not load selected Library books for Topic Coverage", booksError);
        if (!cancelled) setSelectedBooks((books || []) as Array<{id:string;title:string;author:string;subject:string;description:string}>);
      }
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
    // Coverage contains only units extracted from selected book analyses and topics
    // the learner has actually practised. Generic suggestions must not inflate mastery.
    const bookDerived = selectedBooks
      .filter((book) => normalizeSubject(book.subject) === normalized)
      .flatMap((book) => (bookUnits[book.id]?.units || []).map((unit) => unit.trim()))
      .filter(Boolean);
    const observed = topics
      .filter((item) => normalizeSubject(item.subject) === normalized && item.topic?.trim())
      .sort((a, b) => (Number(a.accuracy_percentage) || 0) - (Number(b.accuracy_percentage) || 0))
      .map((item) => item.topic.trim());
    return Array.from(new Set([...bookDerived, ...observed]));
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
    return { mastered, active, total: path.length, pct: path.length ? Math.round((mastered / path.length) * 100) : 0 };
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading your learning paths…</div>;

  if (!selectedSubject) {
    const total = subjects.reduce((sum, s) => sum + subjectProgress(s).total, 0);
    const mastered = subjects.reduce((sum, s) => sum + subjectProgress(s).mastered, 0);
    return (
      <div className={upperStudent ? "tier-upper min-h-screen bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom))]" : "min-h-screen bg-background"}>
        <header className={upperStudent ? "px-4 pt-5" : "sticky top-0 z-50 border-b bg-background/95 backdrop-blur px-4 py-3"}>
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            {!upperStudent && <Button variant="ghost" size="icon" onClick={() => navigate("/academic")}><ArrowLeft className="h-5 w-5" /></Button>}
            <div><h1 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Topic Coverage</h1><p className="text-xs text-muted-foreground">Book-based units when available; otherwise suggested learning paths</p></div>
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
    <div className={upperStudent ? "tier-upper min-h-screen bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom))]" : "min-h-screen bg-background"}>
      <header className={upperStudent ? "px-4 pt-5" : "sticky top-0 z-50 border-b bg-background/95 backdrop-blur px-4 py-3"}>
        <div className="mx-auto flex max-w-4xl items-center gap-3"><Button variant="ghost" size="icon" aria-label="All subjects" onClick={() => setSelectedSubject(null)}><ArrowLeft className="h-5 w-5" /></Button><div className="flex-1"><h1 className="font-bold">{labelFor(selectedSubject)}</h1><p className="text-xs text-muted-foreground">{progress.mastered}/{progress.total} mastered</p></div><Badge>{progress.pct}%</Badge></div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5 pb-24">
        <Progress value={progress.pct} className="mb-5 h-2" />
        <Card className="mb-5 border-primary/20"><CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3"><LibraryBig className="h-5 w-5 text-primary mt-0.5"/><div className="flex-1"><h2 className="font-semibold">Read and learn from your selected books</h2><p className="text-sm text-muted-foreground">When PDF analysis is available, coverage follows the selected book’s extracted headings or page ranges. Otherwise, suggested learning paths are shown separately and are not verified textbook chapters.</p></div></div>
          {selectedBooks.length ? <div className="space-y-2">{selectedBooks.map(book=><div key={book.id} className="rounded-lg border p-3 flex items-center gap-3"><BookOpen className="h-4 w-4 shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{book.title}</p><p className="text-xs text-muted-foreground">{book.author} · {labelFor(book.subject)}</p></div><Button size="sm" variant="outline" onClick={()=>navigate("/library")}>Open Library</Button></div>)}</div> : <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">No selected books were found in Academic Prep. You can still study topic pathways and practice questions, or select books in Academic Prep.</div>}
          {selectedBooks.some((book) => (bookUnits[book.id]?.units || []).length > 0) && <div className="space-y-3 rounded-xl border p-3"><div><h3 className="font-semibold">Units from your selected book PDFs</h3><p className="text-xs text-muted-foreground">These are extracted PDF headings or page ranges, not generic topic suggestions. Page ranges are identified when reliable headings could not be extracted.</p></div>{selectedBooks.map((book) => { const analysis = bookUnits[book.id]; if (!analysis?.units?.length) return null; return <div key={book.id} className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{book.title}</p><Badge variant="outline">{analysis.method === "headings" ? "PDF headings" : analysis.method === "page-ranges" ? "PDF page ranges" : "Estimated"}</Badge></div>{analysis.units.map((unit, index) => <div key={book.id + unit + index} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2"><span className="min-w-0 flex-1 text-sm">{index + 1}. {unit}</span><Button size="sm" variant="outline" onClick={() => navigate(`/quiz?subject=${encodeURIComponent(normalizeSubject(book.subject))}&topic=${encodeURIComponent(unit)}`)}>Find practice</Button></div>)}</div>; })}</div>}
          <div className="flex flex-wrap gap-2"><Button onClick={()=>navigate("/library")}><BookOpen className="mr-2 h-4 w-4"/>Read in Library</Button><Button variant="outline" onClick={()=>navigate(`/quiz?subject=${encodeURIComponent(selectedSubject)}&topic=${encodeURIComponent(path[0] || "")}`)}><GraduationCap className="mr-2 h-4 w-4"/>Practice questions</Button></div>
        </CardContent></Card>
        <div className="space-y-3">
          {path.length === 0 ? <Card><CardContent className="space-y-3 p-6 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground"/><h2 className="font-semibold">No verified units yet</h2><p className="text-sm text-muted-foreground">Topic Coverage will show units extracted from your selected book analysis and topics you have actually practised. Select or analyze a book, or complete a topic practice, to build your real coverage map. Suggested topics are not counted as covered units.</p><div className="flex flex-col justify-center gap-2 sm:flex-row"><Button onClick={()=>navigate("/library")}><BookOpen className="mr-2 h-4 w-4"/>Choose a book</Button><Button variant="outline" onClick={()=>navigate("/academic/setup")}>Academic Prep setup</Button></div></CardContent></Card> : <SkillTree onPractice={(topic)=>navigate(`/quiz?subject=${encodeURIComponent(selectedSubject)}&topic=${encodeURIComponent(topic)}`)} nodes={path.map((topic, index) => { const st = getStatus(selectedSubject, topic); return { topic, status: st.status, accuracy: st.accuracy, attempted: st.attempted, unlocked: index === 0 || getStatus(selectedSubject, path[index - 1]).status !== "new" }; })} />}
        </div>
      </main>
    </div>
  );
};

export default TopicCoveragePage;
