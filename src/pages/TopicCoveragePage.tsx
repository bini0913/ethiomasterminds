import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star, Trophy, BookOpen, LibraryBig, GraduationCap } from "lucide-react";
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedBooks, setSelectedBooks] = useState<Array<{id:string;title:string;author:string;subject:string;description:string}>>([]);
  const [bookUnits, setBookUnits] = useState<Record<string, { units: string[]; pageCount: number; method: string; message?: string }>>({});

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const progressQuery = upperStudent
        ? (supabase as any).from("upper_student_topic_progress").select("subject,topic,accuracy_percentage,questions_attempted,correct_answers,last_practiced_at").eq("user_id", user.id)
        : supabase.from("topic_progress").select("*").eq("user_id", user.id);
      const [profileRes, progressRes] = await Promise.all([
        getAcademicProfile(user.id),
        progressQuery,
      ]);
      if (progressRes.error) throw progressRes.error;
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
      const observedTopics = upperStudent
        ? (progressRes.data || []).map((row: any) => ({
            ...row,
            questions_correct: Number(row.correct_answers) || 0,
          }))
        : (progressRes.data || []);
      setTopics(observedTopics as TopicData[]);
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
  }, [user?.id, refreshKey]);

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    if (!user?.id) {
      return () => {
        window.removeEventListener("focus", refresh);
        document.removeEventListener("visibilitychange", refresh);
      };
    }

    const channel = supabase
      .channel(`topic-coverage-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: upperStudent ? "upper_student_topic_progress" : "topic_progress", filter: `user_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "academic_book_analyses", filter: `user_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "library_books" }, refresh)
      .subscribe();

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, upperStudent]);

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
    if (!match) return { status: "new" as const, accuracy: 0, completion: 0, attempted: 0 };
    if (Number(match.accuracy_percentage) >= 80 && match.questions_attempted >= 5)
      return { status: "mastered" as const, accuracy: Number(match.accuracy_percentage), completion: Number(match.completion_percentage) || Number(match.accuracy_percentage), attempted: match.questions_attempted };
    return { status: "progress" as const, accuracy: Number(match.accuracy_percentage), completion: Number(match.completion_percentage) || Number(match.accuracy_percentage), attempted: match.questions_attempted };
  };

  const subjectProgress = (subject: string) => {
    const path = getPath(subject);
    const mastered = path.filter((topic) => getStatus(subject, topic).status === "mastered").length;
    const active = path.filter((topic) => getStatus(subject, topic).attempted > 0).length;
    const coveragePct = path.length ? Math.round(path.reduce((sum, topic) => sum + getStatus(subject, topic).completion, 0) / path.length) : 0;
    return { mastered, active, total: path.length, pct: path.length ? Math.round((mastered / path.length) * 100) : 0, coveragePct };
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading your learning paths…</div>;

  const activeSubject = selectedSubject && subjects.includes(selectedSubject) ? selectedSubject : subjects[0] || null;
  const overallTotal = subjects.reduce((sum, s) => sum + subjectProgress(s).total, 0);
  const overallMastered = subjects.reduce((sum, s) => sum + subjectProgress(s).mastered, 0);
  const path = activeSubject ? getPath(activeSubject) : [];
  const progress = activeSubject ? subjectProgress(activeSubject) : { mastered: 0, active: 0, total: 0, pct: 0, coveragePct: 0 };
  const practice = (topic?: string) => activeSubject && navigate(`/quiz?subject=${encodeURIComponent(activeSubject)}${topic ? `&topic=${encodeURIComponent(topic)}` : ""}`);
  const focusTopic = path.map((topic) => ({ topic, status: getStatus(activeSubject || "", topic) })).filter(({ status }) => status.status !== "mastered").sort((a, b) => a.status.accuracy - b.status.accuracy)[0]?.topic;
  const overallCoverage = subjects.length ? Math.round(subjects.reduce((sum, subject) => sum + subjectProgress(subject).coveragePct, 0) / subjects.length) : 0;
  const subjectBooks = activeSubject ? selectedBooks.filter((b) => normalizeSubject(b.subject) === normalizeSubject(activeSubject)) : [];

  return (
    <div className={`${upperStudent ? "tier-upper " : "tier-middle "}min-h-screen bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom))]`}>
      <div className={upperStudent ? "sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur" : "sticky top-14 z-30 border-b border-sky-100 bg-white/95 backdrop-blur"}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {!upperStudent && <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate("/academic")}><ArrowLeft className="h-5 w-5" /></Button>}
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {subjects.map((s) => {
              const sp = subjectProgress(s); const on = s === activeSubject;
              return <button key={s} type="button" onClick={() => setSelectedSubject(s)} aria-pressed={on}
                className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 border-b-4 px-4 py-2 text-sm font-bold transition active:translate-y-0.5 active:border-b-2 ${on ? "border-primary bg-primary/10 text-primary" : upperStudent ? "border-border bg-card text-muted-foreground hover:text-foreground" : "border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-700"}`}>
                {labelFor(s)}<span className="text-xs opacity-70">{sp.pct}%</span></button>;
            })}
          </div>
          <div className={upperStudent ? "hidden items-center gap-1.5 rounded-2xl border-2 border-border bg-card px-3 py-2 text-sm font-bold sm:flex" : "hidden items-center gap-1.5 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700 sm:flex"}><Trophy className="h-4 w-4 text-accent" />{overallMastered}/{overallTotal}</div>
        </div>
      </div>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {!activeSubject ? (
            <Card><CardContent className="p-8 text-center"><BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-semibold">Choose your subjects first</p><Button className="mt-4" onClick={() => navigate("/academic/setup")}>Edit Academic Prep</Button></CardContent></Card>
          ) : (
            <>
              <div className={upperStudent ? "mb-6 rounded-3xl border-2 border-b-[6px] border-primary/40 bg-primary p-5 text-primary-foreground" : "mb-6 rounded-[2rem] border border-sky-200/70 bg-gradient-to-br from-sky-600 via-cyan-600 to-sky-700 p-5 text-white shadow-lg shadow-sky-900/10"}>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">Your path</p>
                <h1 className="text-2xl font-extrabold">{labelFor(activeSubject)}</h1>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-primary-foreground/20"><div className="h-full rounded-full bg-primary-foreground transition-all" style={{ width: `${progress.coveragePct}%` }} /></div>
                  <span className="text-sm font-bold">{progress.coveragePct}% coverage</span>
                </div>
              </div>
              {path.length === 0 ? (
                <Card><CardContent className="space-y-3 p-6 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground"/><h2 className="font-semibold">Your path is empty</h2><p className="text-sm text-muted-foreground">Pick a book for this subject or start a subject-level practice set to build your path.</p><div className="flex flex-col justify-center gap-2 sm:flex-row"><Button onClick={()=>navigate("/library")}><BookOpen className="mr-2 h-4 w-4"/>Choose a book</Button><Button variant="outline" onClick={()=>practice()}><GraduationCap className="mr-2 h-4 w-4"/>Practice subject</Button></div></CardContent></Card>
              ) : (
                <SkillTree key={activeSubject} onPractice={practice} nodes={path.map((topic, index) => { const st = getStatus(activeSubject, topic); return { topic, status: st.status, accuracy: st.accuracy, attempted: st.attempted, unlocked: index === 0 || getStatus(activeSubject, path[index - 1]).status !== "new" }; })} />
              )}
            </>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <Card className={upperStudent ? undefined : "border-slate-200/80 bg-white shadow-sm"}><CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-2 font-bold"><Star className="h-4 w-4 text-accent" /> Overall mastery</p>
            <Progress value={overallCoverage} className="h-3" />
            <p className="text-xs text-muted-foreground">{overallCoverage}% average coverage · {overallMastered} of {overallTotal} topics mastered across {subjects.length} subjects</p>
          </CardContent></Card>
          {activeSubject && <Card className={upperStudent ? undefined : "border-slate-200/80 bg-white shadow-sm"}><CardContent className="space-y-2 p-4">
            <p className="flex items-center gap-2 font-bold"><LibraryBig className="h-4 w-4 text-primary" /> Books</p>
            {subjectBooks.length ? subjectBooks.map((b) => <button key={b.id} type="button" onClick={() => navigate("/library")} className="flex w-full items-center gap-2 rounded-xl border border-border p-2 text-left text-sm hover:bg-muted"><BookOpen className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{b.title}</span></button>)
              : <p className="text-xs text-muted-foreground">No book picked for this subject.</p>}
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/library")}>Open Library</Button>
          </CardContent></Card>}
        </aside>
      </main>
    </div>
  );
};

export default TopicCoveragePage;
