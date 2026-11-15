import React, { useState, useEffect, useCallback } from "react";
import { safeStorage } from "@/lib/safeStorage";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";
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
import { getAcademicProfile, normalizeGrade, normalizeSubject, resolveAcademicGrade } from "@/lib/academicProfile";
import { getPdfPublicUrl } from "@/lib/libraryApi";
import { loadBookAnalyses, saveBookAnalyses } from "@/lib/bookAnalysis";

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
  const upperStudent = getUserTier(user?.grade) === "upper";
  const topicProgressSource = upperStudent ? (supabase as any) : supabase;
  const topicProgressTable = upperStudent ? "upper_student_topic_progress" : "topic_progress";
  const navigate = useNavigate();
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newPriority, setNewPriority] = useState("medium");
  const [subjects, setSubjects] = useState<string[]>([]);
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
        const savedSubjects = Array.isArray(profile.subjects) ? profile.subjects.map(normalizeSubject).filter(Boolean) : [];
        setSubjects(savedSubjects);
        setNewSubject(savedSubjects[0] || "");

        const selectedBookIds = Array.from(new Set([...(profile.book_ids || []), ...(profile.book_id ? [profile.book_id] : [])]));
        const { data: books, error: booksError } = await supabase.from("library_books").select("id,title,author,subject,pdf_path").limit(500);
        if (booksError) throw booksError;
        const normalizedBooks = (books || []).map((book: any) => ({ id: String(book.id), title: String(book.title || "Untitled book"), subject: normalizeSubject(String(book.subject || profile.subjects[0] || "general")), pdf_path: String(book.pdf_path || "") }));
        const selectedIds = selectedBookIds.length ? selectedBookIds : normalizedBooks.filter((book) => profile.subjects.some((subject: string) => normalizeSubject(subject) === book.subject)).map((book) => book.id);
        setAvailableBooks(normalizedBooks);
        const selected = normalizedBooks.filter((book) => selectedIds.includes(book.id));
        setSelectedBooks(selected);
        const selectedBookTitles = selected.map((book) => book.title + " — " + book.subject);
        let cachedAnalysis: typeof bookAnalysis = {};
        try { const savedAnalysis = safeStorage.getItem("masterminds:book-analysis:" + user.id); if (savedAnalysis) cachedAnalysis = JSON.parse(savedAnalysis); } catch { /* ignore invalid cached analysis */ }
        try {
          const persistedAnalysis = await loadBookAnalyses(user.id);
          if (!cancelled) {
            const mergedAnalysis = { ...cachedAnalysis, ...persistedAnalysis };
            setBookAnalysis(mergedAnalysis);
            safeStorage.setItem("masterminds:book-analysis:" + user.id, JSON.stringify(mergedAnalysis));
          }
        } catch (analysisError) {
          console.warn("Could not load saved textbook analysis from Supabase; using this device's cache.", analysisError);
          if (!cancelled) setBookAnalysis(cachedAnalysis);
        }
        if (cancelled) return;
        const resourceContext = Array.from(new Set([
          ...selectedBookTitles,
          ...(profile.book_title ? [profile.book_title] : []),
        ]));
        try {
          const saved = safeStorage.getItem(`masterminds:study-plan-settings:${user.id}`);
          if (saved) setPlanSettings((current) => ({ ...current, ...JSON.parse(saved) }));
        } catch { /* use defaults when local settings are unavailable */ }
        setAcademicContext({
          grade: resolveAcademicGrade(user.grade, profile.grade, 5),
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
    if (!subjects.length) {
      toast.error("Choose your study subjects in Academic Prep before adding a task.");
      return;
    }
    if (!user || !auth.data.user?.id || !newTopic.trim() || !newSubject) {
      toast.error("Choose a subject and enter a topic.");
      return;
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

    if (!plan.completed) {
      // Completing a planner item records study activity; it does not mint XP.
      // XP is awarded only by the server-authoritative reward workflows.
      toast.success("Study task completed.");
    }
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("study_plans").delete().eq("id", id);
    if (error) {
      console.error("Could not delete study plan:", error);
      toast.error("The study task could not be deleted. Please retry.");
      return;
    }
    setPlans((previous) => previous.filter((plan) => plan.id !== id));
    toast.success("Study task deleted.");
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
              const looksLikeHeading = /^(chapter|unit|lesson|module|topic|section)\s+([0-9ivxlcdm]+|[a-z])([.:\s-]|$)/i.test(normalized) ||
                /^\d+(?:\.\d+){0,2}[.)]?\s+[A-Z][^.!?]{3,90}$/.test(normalized);
              const isFragment = /^(section|chapter|unit|lesson|module)\s+\d+(?:\.\d+)*$/i.test(normalized) ||
                /^\d+(?:\.\d+){1,3}[.)]?$/i.test(normalized) ||
                /^(contents|table of contents|learning objectives|review questions|references|bibliography|answer key)$/i.test(normalized);
              if (looksLikeHeading && !isFragment) {
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
      const merged = { ...bookAnalysis, ...next };
      setBookAnalysis(merged);
      if (user?.id) {
        safeStorage.setItem("masterminds:book-analysis:" + user.id, JSON.stringify(merged));
        try {
          await saveBookAnalyses(user.id, next);
        } catch (persistError) {
          console.error("Textbook analysis was cached locally but could not be synced to the account.", persistError);
          toast.error("Analysis is saved on this device, but account sync failed. Please retry after checking your connection.");
        }
      }
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

  const toggleBookSelection = (bookId: string, checked: boolean) => {
    setSelectedBooks((current) => {
      const next = checked ? [...current.filter((book) => book.id !== bookId), ...availableBooks.filter((book) => book.id === bookId)] : current.filter((book) => book.id !== bookId);
      if (user?.id) safeStorage.setItem("masterminds:study-plan-books:" + user.id, JSON.stringify(next.map((book) => book.id)));
      return next;
    });
  };

  const savePlanSettings = () => {
    if (!user?.id) return;
    safeStorage.setItem(`masterminds:study-plan-settings:${user.id}`, JSON.stringify(planSettings));
    setShowPlanSettings(false);
    toast.success("Study schedule preferences saved on this device.");
  };

  const generateBookCompletionPlan = async () => {
    if (!user?.id) return;
    if (!selectedBooks.length) { toast.error("Select at least one book in Academic Prep first."); return; }
    const finishDays = Math.max(1, Math.min(365, planSettings.finishDays));
    const sessionsPerWeek = Math.max(1, Math.min(7, planSettings.daysPerWeek)) * Math.max(1, Math.min(4, planSettings.sessionsPerDay));
    // Count the actual eligible calendar days. A rounded-up number of weeks can
    // overstate capacity near a deadline and make the warning disagree with the schedule.
    const eligibleDays = Array.from({ length: finishDays }, (_, day) => {
      const date = addDays(new Date(), day);
      const weekday = date.getDay() === 0 ? 7 : date.getDay();
      return weekday <= Math.max(1, Math.min(7, planSettings.daysPerWeek));
    }).filter(Boolean).length;
    const capacity = eligibleDays * Math.max(1, Math.min(4, planSettings.sessionsPerDay));
    const unitsByBook = selectedBooks.map((book) => ({
      book,
      units: Array.isArray(bookAnalysis[book.id]?.units) ? bookAnalysis[book.id].units.filter((unit) => typeof unit === "string" && unit.trim()) : [],
    }));
    const unanalyzedBooks = unitsByBook.filter((item) => item.units.length === 0);
    if (unanalyzedBooks.length) {
      toast.error("Analyze the selected textbooks in the Library before generating a book-completion schedule. Estimated placeholder units are not used.");
      return;
    }
    const totalUnits = unitsByBook.reduce((total, item) => total + item.units.length, 0);
    const requiredSessions = totalUnits * 3;
    if (capacity < requiredSessions) { toast.error("This deadline fits about " + capacity + " sessions, but finishing all books with reading, practice, and review needs " + requiredSessions + ". Increase finish days or sessions per day."); return; }
    const tasks: Array<{subject:string;topic:string;scheduled_date:string;priority:string;notes:string;user_id:string}> = [];
    const phases = ["Read and make notes", "Practice questions and correct mistakes", "Review and self-test"];
    let sessionIndex = 0;
    for (let day = 0; day < finishDays && sessionIndex < requiredSessions; day++) {
      const date = addDays(new Date(), day);
      const activeDay = date.getDay() === 0 ? 7 : date.getDay();
      if (activeDay > Math.max(1, Math.min(7, planSettings.daysPerWeek))) continue;
      for (let session = 0; session < planSettings.sessionsPerDay && sessionIndex < requiredSessions; session++) {
        const unitOrdinal = Math.floor(sessionIndex / 3);
        let unitsBefore = 0;
        let selected = unitsByBook[0];
        for (const item of unitsByBook) {
          if (unitOrdinal < unitsBefore + item.units.length) { selected = item; break; }
          unitsBefore += item.units.length;
        }
        const unitLabel = selected.units[Math.max(0, unitOrdinal - unitsBefore)];
        const book = selected.book;
        const phase = phases[sessionIndex % 3];
        const sourceMethod = bookAnalysis[book.id]?.method || "headings";
        const sourceNote = sourceMethod === "page-ranges" ? "Unit is a page range generated from the PDF page count." : "Unit label extracted from the PDF text layer; check it against the original book."; 
        tasks.push({ user_id: user.id, subject: book.subject || subjects[0] || "general", topic: book.title + " — " + unitLabel + ": " + phase, scheduled_date: format(date, "yyyy-MM-dd"), priority: sessionIndex % 3 === 2 ? "high" : "medium", notes: "Book-completion plan · " + planSettings.minutesPerSession + " min session. " + sourceNote });
        sessionIndex++;
      }
    }
    if (sessionIndex < requiredSessions) { toast.error("The selected schedule cannot fit every reading, practice, and review session. Increase finish days or sessions per day."); return; }
    setIsGenerating(true);
    try {
      const { error } = await supabase.from("study_plans").insert(tasks);
      if (error) throw error;
      safeStorage.setItem("masterminds:study-plan-settings:" + user.id, JSON.stringify(planSettings));
      toast.success("Created " + tasks.length + " study sessions across " + selectedBooks.length + " selected books.");
      setShowPlanSettings(false);
      await fetchPlans();
    } catch (error) { console.error(error); toast.error("Could not save the book completion plan."); }
    finally { setIsGenerating(false); }
  };
  const generateAIPlan = async () => {
    if (!user) return;
    if (!subjects.length) {
      toast.error("Choose your study subjects in Academic Prep before generating a plan.");
      return;
    }
    setIsGenerating(true);

    try {
      // Fetch weak areas from analytics and topic progress
      const [analyticsRes, topicRes] = await Promise.all([
        supabase.from("analytics").select("subject, accuracy, total_questions_attempted").eq("user_id", user.id),
        topicProgressSource.from(topicProgressTable).select("subject, topic, accuracy_percentage, questions_attempted").eq("user_id", user.id).order("accuracy_percentage", { ascending: true }).limit(20),
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
        const { error: insertError } = await supabase.from("study_plans").insert(inserts);
        if (insertError) throw insertError;
        toast.success(`AI generated ${inserts.length} study tasks from your saved study profile.`);
        await fetchPlans();
      }
    } catch (e) {
      console.error("AI planner error:", e);
      // Fallback to smart generation
      const [topicRes, analyticsRes] = await Promise.all([
        topicProgressSource.from(topicProgressTable).select("*").eq("user_id", user.id).order("accuracy_percentage", { ascending: true }).limit(10),
        supabase.from("analytics").select("*").eq("user_id", user.id),
      ]);
      const fallbackPlans = generateFallbackPlan((topicRes.data || []).filter(t => subjects.some(subject => normalizeSubject(subject) === normalizeSubject(t.subject))), analyticsRes.data || []);
      await insertPlans(fallbackPlans);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFallbackPlan = (weakTopics: any[], _analytics: any[]) => {
    // Fallback recommendations must be grounded in topics the learner has
    // actually attempted. Never invent generic subjects or placeholder tasks.
    return weakTopics
      .filter((topic) =>
        topic &&
        typeof topic.subject === "string" &&
        typeof topic.topic === "string" &&
        Number.isFinite(Number(topic.accuracy_percentage)) &&
        subjects.some((subject) => normalizeSubject(subject) === normalizeSubject(topic.subject))
      )
      .slice(0, 7)
      .map((topic, index) => ({
        subject: topic.subject,
        topic: `Review: ${topic.topic} (${Math.round(Number(topic.accuracy_percentage))}% accuracy)`,
        priority: Number(topic.accuracy_percentage) < 40 ? "high" : "medium",
        day_offset: index,
        notes: "Recommended from your recorded topic practice.",
      }));
  };

  const insertPlans = async (generatedPlans: Array<{ subject: string; topic: string; priority: string; day_offset: number; notes: string }>) => {
    if (!generatedPlans.length) {
      toast.info("There are no recorded weak topics to recommend yet. Complete some practice first.");
      return;
    }
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
    const { error } = await supabase.from("study_plans").insert(inserts);
    if (error) {
      console.error("Could not save generated study plan:", error);
      toast.error("The study plan could not be saved. Please retry.");
      return;
    }
    toast.success(`Generated ${inserts.length} study tasks from your learning data.`);
    fetchPlans();
  };

  const unanalyzedSelectedBookCount = selectedBooks.filter((book) => !bookAnalysis[book.id]?.units?.length).length;
  const bookPlanUnitCount = selectedBooks.reduce((sum, book) => sum + (bookAnalysis[book.id]?.units?.length || 0), 0);
  const bookPlanRequiredSessions = bookPlanUnitCount * 3;
  const bookPlanEligibleDays = Array.from({ length: Math.max(1, Math.min(365, planSettings.finishDays)) }, (_, day) => {
    const date = addDays(new Date(), day);
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    return weekday <= Math.max(1, Math.min(7, planSettings.daysPerWeek));
  }).filter(Boolean).length;
  const bookPlanCapacity = bookPlanEligibleDays * Math.max(1, Math.min(4, planSettings.sessionsPerDay));
  const bookPlanFeasible = selectedBooks.length > 0 && unanalyzedSelectedBookCount === 0 && bookPlanCapacity >= bookPlanRequiredSessions;
  const bookPlanMinimumDays = Math.ceil(bookPlanRequiredSessions / Math.max(1, Math.min(4, planSettings.sessionsPerDay)) * 7 / Math.max(1, Math.min(7, planSettings.daysPerWeek)));
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
    <div className={upperStudent ? "tier-upper min-h-screen bg-background text-foreground pb-[calc(6rem+env(safe-area-inset-bottom))]" : "min-h-screen bg-gradient-to-br from-background via-background to-primary/5"}>
      <header className={upperStudent ? "sticky top-0 z-50 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl" : "sticky top-0 z-50 bg-gradient-to-r from-amber-700 to-orange-700 px-4 py-3 shadow-xl"}>
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/academic")} className={upperStudent ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "text-white hover:bg-white/10"}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className={upperStudent ? "flex items-center gap-2 text-lg font-bold text-foreground" : "flex items-center gap-2 text-lg font-bold text-white"}>
              <Calendar className="h-5 w-5" /> AI Study Planner
            </h1>
            <p className="text-xs text-muted-foreground">Today: {completedToday}/{todayPlans.length} completed</p>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" disabled={!subjects.length} onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {!subjects.length && (
        <div className="mx-auto max-w-4xl px-4 pt-4">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Set up your study subjects first</p>
                <p className="mt-1 text-sm text-muted-foreground">The planner only recommends work based on your saved subjects and recorded practice. It won't invent a subject list.</p>
              </div>
              <Button onClick={() => navigate("/academic/setup")}>Choose subjects</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Generate Button */}
      <div className="px-4 py-4 max-w-4xl mx-auto">
        <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="h-12" onClick={() => setShowPlanSettings((open) => !open)}><BookOpen className="h-4 w-4 mr-2" /> Plan all selected books</Button>
        <Button
          className={upperStudent ? "h-12" : "h-12 bg-gradient-to-r from-primary to-accent text-white hover:from-primary hover:to-accent"}
          onClick={generateAIPlan}
          disabled={isGenerating || !subjects.length}
        >
          {isGenerating ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Analyzing your weak areas...</>
          ) : (
            <><Wand2 className="h-5 w-5 mr-2" /> Generate AI Study Plan</>
          )}
        </Button>
        </div>
        {showPlanSettings && <Card className="mt-3"><CardContent className="p-4 space-y-4">
          <div><h3 className="font-semibold">Finish your selected books</h3><p className="text-sm text-muted-foreground">Analyze selected PDFs first. The planner schedules only extracted headings or page ranges; it will not invent textbook units.</p></div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">Choose which books to finish</p><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { const next = availableBooks.filter((book) => !subjects.length || subjects.some((subject) => normalizeSubject(subject) === book.subject)); setSelectedBooks(next); if (user?.id) safeStorage.setItem("masterminds:study-plan-books:" + user.id, JSON.stringify(next.map((book) => book.id))); }}>Select all matching subjects</Button><Button type="button" size="sm" variant="ghost" onClick={() => { setSelectedBooks([]); if (user?.id) safeStorage.setItem("masterminds:study-plan-books:" + user.id, "[]"); }}>Clear</Button></div></div>
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border p-3">{availableBooks.length ? availableBooks.map((book) => <label key={book.id} className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={selectedBooks.some((item) => item.id === book.id)} onChange={(event) => toggleBookSelection(book.id, event.target.checked)} /><span className="min-w-0 flex-1"><span className="font-medium">{book.title}</span><span className="block text-xs text-muted-foreground">{book.subject}{book.pdf_path ? " · PDF attached" : " · No PDF attached"}</span></span></label>) : <p className="text-sm text-muted-foreground">No library books are available to select.</p>}</div>
          </div>
          <div className="space-y-2"><Button type="button" variant="outline" onClick={analyzeSelectedBookPdfs} disabled={isAnalyzingBooks}>{isAnalyzingBooks ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BookOpen className="mr-2 h-4 w-4"/>}Analyze selected book PDFs</Button>{selectedBooks.map((book) => { const analysis = bookAnalysis[book.id]; return <div key={book.id} className="rounded border p-2 text-sm"><p className="font-medium">{book.title}</p><p className="text-xs text-muted-foreground">{!analysis ? "Not analyzed yet" : analysis.method === "headings" ? analysis.units.length + " headings extracted from PDF text · " + analysis.pageCount + " pages" : analysis.method === "page-ranges" ? analysis.units.length + " page ranges · " + analysis.pageCount + " pages" : "No reliable units extracted yet"}{analysis?.message ? " · " + analysis.message : ""}</p></div>; })}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-sm">Sessions/day<Input type="number" min={1} max={4} value={planSettings.sessionsPerDay} onChange={e=>setPlanSettings(p=>({...p,sessionsPerDay:Math.max(1,Math.min(4,Number(e.target.value)||1))}))}/></label>
            <label className="text-sm">Days/week<Input type="number" min={1} max={7} value={planSettings.daysPerWeek} onChange={e=>setPlanSettings(p=>({...p,daysPerWeek:Math.max(1,Math.min(7,Number(e.target.value)||1))}))}/></label>
            <label className="text-sm">Minutes/session<Input type="number" min={10} max={240} step={5} value={planSettings.minutesPerSession} onChange={e=>setPlanSettings(p=>({...p,minutesPerSession:Math.max(10,Math.min(240,Number(e.target.value)||10))}))}/></label>
            <label className="text-sm">Finish in (days)<Input type="number" min={1} max={365} value={planSettings.finishDays} onChange={e=>setPlanSettings(p=>({...p,finishDays:Math.max(1,Math.min(365,Number(e.target.value)||1))}))}/></label>
          </div>
          <label className="block text-sm">Target analysis sections per PDF <Input type="number" min={1} max={200} value={planSettings.unitsPerBook} onChange={e=>setPlanSettings(p=>({...p,unitsPerBook:Math.max(1,Math.min(200,Number(e.target.value)||1))}))}/><span className="text-xs text-muted-foreground">Controls how a selected PDF is divided during analysis. The generated schedule uses only units actually extracted from your selected books.</span></label>
          <div className="rounded-lg bg-muted p-3 text-sm"><p className="font-medium">{selectedBooks.length} selected books · {bookPlanUnitCount} units · {bookPlanRequiredSessions} reading/practice/review sessions needed</p><p className="text-muted-foreground">{planSettings.sessionsPerDay} sessions/day × {planSettings.daysPerWeek} days/week × {planSettings.minutesPerSession} min. Planned finish target: {format(addDays(new Date(),planSettings.finishDays),"PPP")}.</p><p className="mt-1 text-muted-foreground">This deadline fits about {bookPlanCapacity} sessions across eligible days.</p>{selectedBooks.length > 0 && unanalyzedSelectedBookCount > 0 && <p role="status" className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 font-medium text-amber-900 dark:text-amber-200">{unanalyzedSelectedBookCount} selected book{unanalyzedSelectedBookCount === 1 ? " needs" : "s need"} analysis before a real study schedule can be generated.</p>}{selectedBooks.length > 0 && unanalyzedSelectedBookCount === 0 && !bookPlanFeasible && <p role="status" className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 font-medium text-amber-900 dark:text-amber-200">This schedule cannot fit all analyzed book units yet. Add more finish days or sessions per day. At the current pace, plan for roughly {bookPlanMinimumDays} calendar days; the exact minimum can vary with the starting weekday.</p>}{selectedBooks.length === 0 && <p className="mt-2 text-muted-foreground">Select at least one book to calculate a completion schedule.</p>}</div>
          <div className="flex gap-2"><Button className="flex-1" onClick={generateBookCompletionPlan} disabled={isGenerating || !bookPlanFeasible}>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Target className="mr-2 h-4 w-4"/>}Generate book schedule</Button><Button variant="outline" onClick={savePlanSettings}>Save preferences</Button></div>
        </CardContent></Card>}
        <p className="text-xs text-center text-muted-foreground mt-1">AI weak-topic recommendations and a separate book-completion schedule are available. Book schedules use only units extracted from the selected books.</p>
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
                <Button onClick={generateAIPlan} disabled={isGenerating} className="bg-gradient-to-r from-primary to-accent">
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
