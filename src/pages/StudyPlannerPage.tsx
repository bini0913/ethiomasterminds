import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, Plus, Check, X, Sparkles, Brain, Loader2, Wand2, BookOpen, Clock3, Target } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { getAcademicProfile, normalizeGrade, normalizeSubject } from "@/lib/academicProfile";
import { getPdfPublicUrl } from "@/lib/libraryApi";

interface StudyPlan {
  id: string;
  subject: string;
  topic: string;
  scheduled_date: string;
  completed: boolean;
  priority: string;
  notes: string | null;
}

const StudyPlannerPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newSubject, setNewSubject] = useState("math");
  const [newTopic, setNewTopic] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newPriority, setNewPriority] = useState("medium");
  const [subjects, setSubjects] = useState<string[]>(["math", "science", "english", "history"]);
  const [academicContext, setAcademicContext] = useState<{ grade: number; curriculum: string; goal: string; book: string } | null>(null);
  const [availableBooks, setAvailableBooks] = useState<Array<{id:string;title:string;subject:string;pdf_path:string}>>([]);
  const [selectedBooks, setSelectedBooks] = useState<Array<{id:string;title:string;subject:string;pdf_path:string}>>([]);
  const [bookAnalysis, setBookAnalysis] = useState<Record<string, { units: string[]; pageCount: number; method: "headings" | "page-ranges" | "estimated"; message?: string }>>({});
  const [isAnalyzingBooks, setIsAnalyzingBooks] = useState(false);
  const [planSettings, setPlanSettings] = useState({ sessionsPerDay: 2, daysPerWeek: 5, minutesPerSession: 40, finishDays: 30, unitsPerBook: 12 });
  const [showPlanSettings, setShowPlanSettings] = useState(false);

  const fetchPlans = useCallback(async () => {
    const auth = await supabase.auth.getUser();
    if (!user || !auth.data.user?.id) return;
    const weekStart = format(startOfWeek(new Date()), "yyyy-MM-dd");
    const weekEnd = format(addDays(startOfWeek(new Date()), 89), "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", auth.data.user.id)
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd)
      .order("scheduled_date");

    if (error) { console.error(error); toast.error("Failed to load study plans"); }
    if (data) setPlans(data);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { if (user) fetchPlans(); }, [fetchPlans, user]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getAcademicProfile(user.id);
        if (!profile || cancelled) return;
        setSubjects(profile.subjects.map(normalizeSubject));
        setNewSubject(normalizeSubject(profile.subjects[0] || "math"));

        const selectedBookIds = Array.from(new Set([
          ...(profile.book_ids || []),
          ...(profile.book_id ? [profile.book_id] : []),
        ]));
        let selectedBookTitles: string[] = [];
        if (selectedBookIds.length) {
          const { data: books, error } = await supabase
            .from("library_books")
            .select("id,title,author,subject,pdf_path")
            .in("id", selectedBookIds);
          if (!error && books) {
            selectedBookTitles = books.map((book: any) =>
              [book.title, book.author, book.subject].filter(Boolean).join(" — ")
            );
            setSelectedBooks(books.map((book: any) => ({ id: book.id, title: String(book.title || "Untitled book"), subject: normalizeSubject(String(book.subject || profile.subjects[0] || "general")), pdf_path: String(book.pdf_path || "") })));
          }
        }
        if (cancelled) return;
        const resourceContext = Array.from(new Set([
          ...selectedBookTitles,
          ...(profile.book_title ? [profile.book_title] : []),
        ]));
        try {
          const saved = localStorage.getItem(`masterminds:study-plan-settings:${user.id}`);
          if (saved) setPlanSettings((current) => ({ ...current, ...JSON.parse(saved) }));
        } catch { /* use defaults when local settings are unavailable */ }
        setAcademicContext({
          grade: normalizeGrade(profile.grade, normalizeGrade(user.grade, 5)),
          curriculum: profile.curriculum,
          goal: [profile.study_goal, profile.study_goal_detail].filter(Boolean).join(" — "),
          book: resourceContext.join("; ") || "Not specified",
        });
      } catch (error) {
        console.error("Academic planner profile context failed:", error);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.grade]);

  const addPlan = async () => {
    const auth = await supabase.auth.getUser();
    if (!user || !auth.data.user?.id || !newTopic.trim()) {
      toast.error("Please enter a topic"); return;
    }
    const { error } = await supabase.from("study_plans").insert({
      user_id: auth.data.user.id,
      subject: newSubject,
      topic: newTopic.trim(),
      scheduled_date: newDate,
      priority: newPriority,
    });
    if (error) { toast.error("Failed to add plan"); return; }
    toast.success("Study plan added!");
    setShowAdd(false);
    setNewTopic("");
    fetchPlans();
  };

  const toggleComplete = async (plan: StudyPlan) => {
    const { error } = await supabase.from("study_plans").update({ completed: !plan.completed }).eq("id", plan.id);
    if (error) { toast.error("Failed to update"); return; }
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, completed: !p.completed } : p));

    if (!plan.completed && user) {
      supabase.rpc("add_xp", { p_user_id: user.id, p_amount: 10 });
      toast.success("+10 XP for completing a study task!");
    }
  };

  const deletePlan = async (id: string) => {
    await supabase.from("study_plans").delete().eq("id", id);
    fetchPlans();
  };

  const analyzeSelectedBookPdfs = async () => {
    if (!selectedBooks.length) { toast.error("Select books in Academic Prep first."); return; }
    setIsAnalyzingBooks(true);
    try {
      const pdfjs = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs" as any);
      (pdfjs as any).GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs";
      const next: typeof bookAnalysis = {};
      for (const book of selectedBooks) {
        if (!book.pdf_path) {
          next[book.id] = { units: [], pageCount: 0, method: "estimated", message: "No PDF file is attached to this library record." };
          continue;
        }
        try {
          const response = await fetch(getPdfPublicUrl(book.pdf_path));
          if (!response.ok) throw new Error("PDF download failed (" + response.status + ").");
          const bytes = await response.arrayBuffer();
          const pdf = await (pdfjs as any).getDocument({ data: bytes }).promise;
          const headings: string[] = [];
          const pagesToInspect = Math.min(Number(pdf.numPages) || 0, 120);
          for (let pageNo = 1; pageNo <= pagesToInspect; pageNo++) {
            const page = await pdf.getPage(pageNo);
            const textContent = await page.getTextContent();
            const lines = (textContent.items || []).map((item: any) => String(item.str || "").trim()).filter(Boolean);
            for (const line of lines) {
              const normalized = line.replace(/\s+/g, " ").trim();
              if (normalized.length < 4 || normalized.length > 110) continue;
              if (/^(chapter|unit|lesson|module|topic|section)\s+([0-9ivxlcdm]+|[a-z])([.:\s-]|$)/i.test(normalized) ||
                  /^\d+(?:\.\d+){0,2}[.)]?\s+[A-Z][^.!?]{3,90}$/.test(normalized)) {
                const heading = normalized.replace(/\s+/g, " ");
                if (!headings.some((existing) => existing.toLowerCase() === heading.toLowerCase())) headings.push(heading);
              }
            }
          }
          if (headings.length >= 3) {
            next[book.id] = { units: headings.slice(0, 200), pageCount: Number(pdf.numPages) || pagesToInspect, method: "headings" };
          } else if (Number(pdf.numPages) > 0) {
            const pageCount = Number(pdf.numPages);
            const chunkSize = Math.max(1, Math.ceil(pageCount / Math.min(40, Math.max(1, planSettings.unitsPerBook))));
            const ranges: string[] = [];
            for (let start = 1; start <= pageCount && ranges.length < 200; start += chunkSize) {
              ranges.push("Pages " + start + "–" + Math.min(pageCount, start + chunkSize - 1));
            }
            next[book.id] = { units: ranges, pageCount, method: "page-ranges", message: "No reliable chapter headings found in the text layer; page ranges are used instead." };
          } else {
            next[book.id] = { units: [], pageCount: 0, method: "estimated", message: "This PDF has no readable pages." };
          }
          if (typeof pdf.destroy === "function") await pdf.destroy();
        } catch (error) {
          next[book.id] = { units: [], pageCount: 0, method: "estimated", message: error instanceof Error ? error.message : "Could not read this PDF." };
        }
      }
      setBookAnalysis((current) => ({ ...current, ...next }));
      const headingCount = Object.values(next).filter((item) => item.method === "headings").length;
      const rangeCount = Object.values(next).filter((item) => item.method === "page-ranges").length;
      toast.success("Analyzed " + selectedBooks.length + " books: " + headingCount + " with extracted headings, " + rangeCount + " using page ranges.");
    } catch (error) {
      console.error("Selected book PDF analysis failed:", error);
      toast.error("PDF analysis could not start. Check the connection and try again.");
    } finally {
      setIsAnalyzingBooks(false);
    }
  };

  const savePlanSettings = () => {
    if (!user?.id) return;
    localStorage.setItem(`masterminds:study-plan-settings:${user.id}`, JSON.stringify(planSettings));
    setShowPlanSettings(false);
    toast.success("Study schedule preferences saved on this device.");
  };

  const generateBookCompletionPlan = async () => {
    if (!user?.id) return;
    if (!selectedBooks.length) { toast.error("Select at least one book in Academic Prep first."); return; }
    const finishDays = Math.max(1, Math.min(365, planSettings.finishDays));
    const sessionsPerWeek = Math.max(1, Math.min(7, planSettings.daysPerWeek)) * Math.max(1, Math.min(4, planSettings.sessionsPerDay));
    const capacity = Math.ceil(finishDays / 7) * sessionsPerWeek;
    const unitsByBook = selectedBooks.map((book) => ({ book, units: bookAnalysis[book.id]?.units?.length ? bookAnalysis[book.id].units : Array.from({ length: Math.max(1, planSettings.unitsPerBook) }, (_, index) => "Estimated study unit " + (index + 1)) }));
    const totalUnits = unitsByBook.reduce((total, item) => total + item.units.length, 0);
    const requiredSessions = totalUnits * 3;
    if (capacity < requiredSessions) { toast.error("This deadline fits about " + capacity + " sessions, but finishing all books with reading, practice, and review needs " + requiredSessions + ". Increase finish days or sessions per day."); return; }
    const tasks: Array<{subject:string;topic:string;scheduled_date:string;priority:string;notes:string;user_id:string}> = [];
    const phases = ["Read and make notes", "Practice questions and correct mistakes", "Review and self-test"];
    let sessionIndex = 0;
    for (let day = 0; day < finishDays && sessionIndex < requiredSessions; day++) {
      const date = addDays(new Date(), day);
      const activeDay = date.getDay() === 0 ? 7 : date.getDay();
      if (activeDay > planSettings.daysPerWeek) continue;
      for (let session = 0; session < planSettings.sessionsPerDay && sessionIndex < requiredSessions; session++) {
        const unitOrdinal = Math.floor(sessionIndex / 3);
        let unitsBefore = 0;
        let selected = unitsByBook[0];
        for (const item of unitsByBook) {
          if (unitOrdinal < unitsBefore + item.units.length) { selected = item; break; }
          unitsBefore += item.units.length;
        }
        const unitLabel = selected.units[Math.max(0, unitOrdinal - unitsBefore)] || "Estimated study unit";
        const book = selected.book;
        const phase = phases[sessionIndex % 3];
        const sourceMethod = bookAnalysis[book.id]?.method || "estimated";
        const sourceNote = sourceMethod === "headings" ? "Unit label extracted from the PDF text layer; check it against the original book." : sourceMethod === "page-ranges" ? "Unit is a page range generated from the PDF page count." : "Unit name is an estimate because this PDF could not be analyzed."; 
        tasks.push({ user_id: user.id, subject: book.subject || subjects[0] || "general", topic: book.title + " — " + unitLabel + ": " + phase, scheduled_date: format(date, "yyyy-MM-dd"), priority: sessionIndex % 3 === 2 ? "high" : "medium", notes: "Book-completion plan · " + planSettings.minutesPerSession + " min session. " + sourceNote });
        sessionIndex++;
      }
    }
    if (sessionIndex < requiredSessions) { toast.error("The selected schedule cannot fit every reading, practice, and review session. Increase finish days or sessions per day."); return; }
    setIsGenerating(true);
    try {
      const { error } = await supabase.from("study_plans").insert(tasks);
      if (error) throw error;
      localStorage.setItem("masterminds:study-plan-settings:" + user.id, JSON.stringify(planSettings));
      toast.success("Created " + tasks.length + " study sessions across " + selectedBooks.length + " selected books.");
      setShowPlanSettings(false);
      await fetchPlans();
    } catch (error) { console.error(error); toast.error("Could not save the book completion plan."); }
    finally { setIsGenerating(false); }
  };
  const generateAIPlan = async () => {
    if (!user) return;
    setIsGenerating(true);

    try {
      // Fetch weak areas from analytics and topic progress
      const [analyticsRes, topicRes] = await Promise.all([
        supabase.from("analytics").select("subject, accuracy, total_questions_attempted").eq("user_id", user.id),
        supabase.from("topic_progress").select("subject, topic, accuracy_percentage, questions_attempted").eq("user_id", user.id).order("accuracy_percentage", { ascending: true }).limit(20),
      ]);

      const weakTopics = (topicRes.data || []).filter(t => t.accuracy_percentage < 70 && subjects.some(subject => normalizeSubject(subject) === normalizeSubject(t.subject)));
      const analytics = analyticsRes.data || [];

      // Call AI edge function
      const { data: aiData, error: aiError } = await supabase.functions.invoke("ai-study-planner", {
        body: {
          weakTopics,
          analytics,
          grade: String(academicContext?.grade || normalizeGrade(user.grade, 12)),
          curriculum: academicContext?.curriculum,
          studyGoal: academicContext?.goal,
          book: academicContext?.book,
          subjects,
          existingPlans: plans.map(p => ({ subject: p.subject, topic: p.topic, scheduled_date: p.scheduled_date })),
        },
      });

      if (aiError) throw aiError;

      const allowedSubjects = new Set(subjects.map(normalizeSubject));
      const existingKeys = new Set(plans.map((p) => `${normalizeSubject(p.subject)}::${p.topic.trim().toLowerCase()}`));
      const suggestions: Array<{ subject: string; topic: string; priority: string; day_offset: number; notes: string }> = (aiData?.suggestions || []).filter((item: any) =>
        item && typeof item.subject === "string" && typeof item.topic === "string" &&
        allowedSubjects.has(normalizeSubject(item.subject)) &&
        !existingKeys.has(`${normalizeSubject(item.subject)}::${item.topic.trim().toLowerCase()}`)
      );

      if (suggestions.length === 0) {
        // Fallback: generate based on weak topics
        const fallbackPlans = generateFallbackPlan(weakTopics, analytics);
        await insertPlans(fallbackPlans);
      } else {
        const auth = await supabase.auth.getUser();
        if (!auth.data.user?.id) return;
        const today = new Date();
        const inserts = suggestions.map((s) => ({
          user_id: auth.data.user!.id,
          subject: s.subject,
          topic: s.topic,
          scheduled_date: format(addDays(today, s.day_offset || 0), "yyyy-MM-dd"),
          priority: s.priority || "medium",
          notes: s.notes || "AI recommended",
        }));
        await supabase.from("study_plans").insert(inserts);
        toast.success(`✨ AI generated ${inserts.length} study tasks!`);
        fetchPlans();
      }
    } catch (e) {
      console.error("AI planner error:", e);
      // Fallback to smart generation
      const [topicRes, analyticsRes] = await Promise.all([
        supabase.from("topic_progress").select("*").eq("user_id", user.id).order("accuracy_percentage", { ascending: true }).limit(10),
        supabase.from("analytics").select("*").eq("user_id", user.id),
      ]);
      const fallbackPlans = generateFallbackPlan((topicRes.data || []).filter(t => subjects.some(subject => normalizeSubject(subject) === normalizeSubject(t.subject))), analyticsRes.data || []);
      await insertPlans(fallbackPlans);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFallbackPlan = (weakTopics: any[], analytics: any[]) => {
    const plans: Array<{ subject: string; topic: string; priority: string; day_offset: number; notes: string }> = [];
    const today = new Date();

    // Identify weak subjects
    const subjectAccuracy: Record<string, number> = {};
    analytics.forEach(a => { subjectAccuracy[a.subject] = a.accuracy || 0; });

    // Add weak topics first
    weakTopics.slice(0, 5).forEach((t, i) => {
      plans.push({
        subject: t.subject,
        topic: `Review: ${t.topic} (${Math.round(t.accuracy_percentage)}% accuracy)`,
        priority: t.accuracy_percentage < 40 ? "high" : "medium",
        day_offset: i,
        notes: "Focus on understanding core concepts",
      });
    });

    // Fill remaining days with subject rotation
    const allSubjects = subjects.length ? subjects : ["math", "science", "english", "history"];
    for (let i = plans.length; i < 7; i++) {
      const subj = allSubjects[i % allSubjects.length];
      plans.push({
        subject: subj,
        topic: `Practice ${subj} problems`,
        priority: (subjectAccuracy[subj] || 50) < 60 ? "high" : "low",
        day_offset: i,
        notes: "Daily practice session",
      });
    }

    return plans;
  };

  const insertPlans = async (generatedPlans: Array<{ subject: string; topic: string; priority: string; day_offset: number; notes: string }>) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id) return;
    const today = new Date();
    const inserts = generatedPlans.map((p) => ({
      user_id: auth.data.user!.id,
      subject: p.subject,
      topic: p.topic,
      scheduled_date: format(addDays(today, p.day_offset), "yyyy-MM-dd"),
      priority: p.priority,
      notes: p.notes,
    }));
    await supabase.from("study_plans").insert(inserts);
    toast.success(`📚 Generated ${inserts.length} study tasks based on your weak areas!`);
    fetchPlans();
  };

  const todayPlans = plans.filter(p => isSameDay(new Date(p.scheduled_date), new Date()));
  const completedToday = todayPlans.filter(p => p.completed).length;

  const grouped = plans.reduce<Record<string, StudyPlan[]>>((acc, p) => {
    (acc[p.scheduled_date] = acc[p.scheduled_date] || []).push(p);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-amber-700 to-orange-700 px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/academic")} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5" /> AI Study Planner
            </h1>
            <p className="text-xs text-white/60">Today: {completedToday}/{todayPlans.length} completed</p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* AI Generate Button */}
      <div className="px-4 py-4 max-w-4xl mx-auto">
        <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="h-12" onClick={() => setShowPlanSettings((open) => !open)}><BookOpen className="h-4 w-4 mr-2" /> Plan all selected books</Button>
        <Button
          className="h-12 bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700"
          onClick={generateAIPlan}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Analyzing your weak areas...</>
          ) : (
            <><Wand2 className="h-5 w-5 mr-2" /> Generate AI Study Plan</>
          )}
        </Button>
        </div>
        {showPlanSettings && <Card className="mt-3"><CardContent className="p-4 space-y-4">
          <div><h3 className="font-semibold">Finish your selected books</h3><p className="text-sm text-muted-foreground">Analyze readable PDF text for chapter/unit headings first. If headings cannot be extracted, the planner uses page ranges or clearly marked estimates.</p></div>
          <div className="space-y-2"><Button type="button" variant="outline" onClick={analyzeSelectedBookPdfs} disabled={isAnalyzingBooks}>{isAnalyzingBooks ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BookOpen className="mr-2 h-4 w-4"/>}Analyze selected book PDFs</Button>{selectedBooks.map((book) => { const analysis = bookAnalysis[book.id]; return <div key={book.id} className="rounded border p-2 text-sm"><p className="font-medium">{book.title}</p><p className="text-xs text-muted-foreground">{!analysis ? "Not analyzed yet" : analysis.method === "headings" ? analysis.units.length + " headings extracted from PDF text · " + analysis.pageCount + " pages" : analysis.method === "page-ranges" ? analysis.units.length + " page ranges · " + analysis.pageCount + " pages" : "Using estimated units"}{analysis?.message ? " · " + analysis.message : ""}</p></div>; })}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-sm">Sessions/day<Input type="number" min={1} max={4} value={planSettings.sessionsPerDay} onChange={e=>setPlanSettings(p=>({...p,sessionsPerDay:Math.max(1,Math.min(4,Number(e.target.value)||1))}))}/></label>
            <label className="text-sm">Days/week<Input type="number" min={1} max={7} value={planSettings.daysPerWeek} onChange={e=>setPlanSettings(p=>({...p,daysPerWeek:Math.max(1,Math.min(7,Number(e.target.value)||1))}))}/></label>
            <label className="text-sm">Minutes/session<Input type="number" min={10} max={240} step={5} value={planSettings.minutesPerSession} onChange={e=>setPlanSettings(p=>({...p,minutesPerSession:Math.max(10,Math.min(240,Number(e.target.value)||10))}))}/></label>
            <label className="text-sm">Finish in (days)<Input type="number" min={1} max={365} value={planSettings.finishDays} onChange={e=>setPlanSettings(p=>({...p,finishDays:Math.max(1,Math.min(365,Number(e.target.value)||1))}))}/></label>
          </div>
          <label className="block text-sm">Fallback estimated units per book <Input type="number" min={1} max={200} value={planSettings.unitsPerBook} onChange={e=>setPlanSettings(p=>({...p,unitsPerBook:Math.max(1,Math.min(200,Number(e.target.value)||1))}))}/><span className="text-xs text-muted-foreground">Used only when a PDF has no usable text or no attached PDF. Analyzed headings/page ranges override this fallback.</span></label>
          <div className="rounded-lg bg-muted p-3 text-sm"><p className="font-medium">{selectedBooks.length} selected books · {selectedBooks.reduce((sum, book) => sum + (bookAnalysis[book.id]?.units?.length || planSettings.unitsPerBook), 0)} units</p><p className="text-muted-foreground">{planSettings.sessionsPerDay} sessions/day × {planSettings.daysPerWeek} days/week × {planSettings.minutesPerSession} min. Planned finish target: {format(addDays(new Date(),planSettings.finishDays),"PPP")}.</p></div>
          <div className="flex gap-2"><Button className="flex-1" onClick={generateBookCompletionPlan} disabled={isGenerating}>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Target className="mr-2 h-4 w-4"/>}Generate book schedule</Button><Button variant="outline" onClick={savePlanSettings}>Save preferences</Button></div>
        </CardContent></Card>}
        <p className="text-xs text-center text-muted-foreground mt-1">AI weak-topic recommendations and a separate book-completion schedule are available. Book sections are estimates until you match them to each book’s contents.</p>
      </div>

      {/* Today's Progress */}
      {todayPlans.length > 0 && (
        <div className="px-4 max-w-4xl mx-auto mb-4">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Today's Goals
                </h3>
                <Badge variant={completedToday === todayPlans.length ? "default" : "secondary"}>
                  {completedToday}/{todayPlans.length}
                </Badge>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <motion.div
                  className="bg-primary h-2.5 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${todayPlans.length > 0 ? (completedToday / todayPlans.length) * 100 : 0}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Plan Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-4 max-w-4xl mx-auto mb-4">
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Select value={newSubject} onValueChange={setNewSubject}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Topic (e.g., Algebra)" value={newTopic} onChange={e => setNewTopic(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={addPlan} className="flex-1">Add Plan</Button>
                  <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plans by Date */}
      <div className="px-4 pb-24 max-w-4xl mx-auto space-y-4">
        {Object.keys(grouped).length === 0 ? (
          <Card className="bg-card/80">
            <CardContent className="p-8 text-center">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold mb-1">No study plans yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Use AI to generate a personalized plan or add tasks manually</p>
              <div className="flex gap-2 justify-center">
                <Button onClick={generateAIPlan} disabled={isGenerating} className="bg-gradient-to-r from-violet-600 to-purple-600">
                  <Wand2 className="h-4 w-4 mr-1" /> AI Generate
                </Button>
                <Button variant="outline" onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Manual
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                {isSameDay(new Date(date), new Date()) ? "📍 Today" : format(new Date(date), "EEE, MMM d")}
                <Badge variant="outline" className="text-xs">{items.filter(p => p.completed).length}/{items.length}</Badge>
              </h3>
              <div className="space-y-2">
                {items.map(plan => (
                  <motion.div key={plan.id} layout>
                    <Card className={`bg-card/80 border-border/50 transition-all ${plan.completed ? "opacity-60" : ""}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 rounded-full shrink-0 ${plan.completed ? "bg-green-500/20 text-green-600" : "bg-secondary"}`}
                          onClick={() => toggleComplete(plan)}
                        >
                          {plan.completed ? <Check className="h-4 w-4" /> : <div className="w-4 h-4 rounded-full border-2" />}
                        </Button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${plan.completed ? "line-through text-muted-foreground" : ""}`}>{plan.topic}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground capitalize">{plan.subject}</span>
                            {plan.notes && <span className="text-xs text-primary/70">• {plan.notes}</span>}
                          </div>
                        </div>
                        <Badge variant={plan.priority === "high" ? "destructive" : plan.priority === "medium" ? "secondary" : "outline"} className="text-xs shrink-0">
                          {plan.priority}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deletePlan(plan.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudyPlannerPage;
