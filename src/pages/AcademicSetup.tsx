import { db } from "@/integrations/untypedClient";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, BookOpen, Check, GraduationCap, Library, Target } from "lucide-react";
import { toast } from "sonner";
import { resolveAcademicGrade } from "@/lib/academicProfile";

type Goal = "class" | "ministry_exam" | "university_entrance" | "national_exam" | "entrance_exam" | "exit_exam" | "mock_exam" | "past_papers" | "custom";
type Curriculum = "oromia" | "addis_ababa";

type BookOption = {
  id: string;
  title: string;
  author?: string | null;
  subject?: string | null;
  grade_level?: number | null;
};

const upperGoalOptions: Array<{ value: Goal; title: string; description: string }> = [
  { value: "class", title: "Class exams & coursework", description: "Stay on top of lessons, assignments and school exams." },
  { value: "entrance_exam", title: "Entrance exams", description: "Prepare for university and other entrance exams." },
  { value: "exit_exam", title: "Grade 12 exit exam", description: "Prepare systematically for the Grade 12 exit exam." },
  { value: "mock_exam", title: "Mock exams", description: "Practise under timed, exam-like conditions." },
  { value: "past_papers", title: "Past papers", description: "Practise previous papers and review mistakes." },
  { value: "custom", title: "Another goal", description: "Tell Master Minds what you are preparing for." },
];
const middleGoalOptions: Array<{ value: Goal; title: string; description: string }> = [
  { value: "class", title: "School / Class", description: "Keep up with my current classes and assignments." },
  { value: "ministry_exam", title: "Ministry Exam", description: "Prepare for a national or regional Ministry examination." },
  { value: "university_entrance", title: "University Entrance", description: "Prepare for university entrance and competitive exams." },
  { value: "national_exam", title: "National / Regional Exam", description: "Build a structured revision plan for an upcoming exam." },
  { value: "custom", title: "Something else", description: "Tell Master Minds what you are preparing for." },
];

const subjectsByBand: Record<"middle" | "high", string[]> = {
  middle: ["Mathematics", "English", "Amharic", "Afaan Oromo", "General Science", "Social Studies", "Civics", "ICT"],
  high: ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Amharic", "Afaan Oromo", "Geography", "History", "Economics", "Civics", "ICT"],
};

const curriculumOptions: Array<{ value: Curriculum; title: string; description: string }> = [
  { value: "oromia", title: "Oromia Curriculum", description: "I study under the Oromia regional curriculum." },
  { value: "addis_ababa", title: "Addis Ababa Curriculum", description: "I study under the Addis Ababa curriculum." },
];

const AcademicSetup: React.FC = () => {
  const { user, session } = useUser();
  const navigate = useNavigate();
  const gradeFromUser = Number((user?.grade || "").match(/\d+/)?.[0] || 9);

  const [step, setStep] = useState(gradeFromUser >= 9 ? 2 : 1);
  const [grade, setGrade] = useState(Math.min(12, Math.max(5, gradeFromUser)));
  const [goal, setGoal] = useState<Goal>("class");
  const [goalDetail, setGoalDetail] = useState("");
  const [curriculum, setCurriculum] = useState<Curriculum>("oromia");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [books, setBooks] = useState<BookOption[]>([]);
  const [bookId, setBookId] = useState("");
  const [bookIds, setBookIds] = useState<string[]>([]);
  const [bookTitle, setBookTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const band = grade <= 8 ? "middle" : "high";
  const academicLabel = grade >= 9 ? "Academic Prep" : "Academic Mode";
  const subjectOptions = subjectsByBand[band];
  const activeGoalOptions = band === "high" ? upperGoalOptions : middleGoalOptions;
  const totalSteps = band === "high" ? 4 : 5;

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    const loadProfile = async () => {
      try {
        const { data, error } = await db
          .from("academic_profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (error) throw error;

        if (!cancelled && data) {
          // The main authenticated profile owns the learner's grade band.
          // Older academic setup rows remain useful fallback data, but must not
          // render Grade 9 inside a Grade 12 workspace.
          const savedGrade = resolveAcademicGrade(user?.grade, data.grade, 9);
          setGrade(savedGrade);
          setStep(savedGrade >= 9 ? 2 : 1);
          if (savedGrade >= 9) setStep((current) => current === 1 ? 2 : current);
          setGoal(data.study_goal as Goal);
          setGoalDetail(data.study_goal_detail || "");
          setCurriculum(data.curriculum as Curriculum);
          setSubjects(data.subjects || []);
          setBookId(data.book_id || "");
          setBookIds(Array.isArray(data.book_ids) ? data.book_ids : (data.book_id ? [data.book_id] : []));
          setBookTitle(data.book_title || "");
        }
      } catch (error) {
        console.error("Academic setup profile load failed:", error);
        if (!cancelled) toast.error("Your academic setup could not be loaded. Please retry.");
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };
    loadProfile();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadBooks = async () => {
      try {
        const { data, error } = await db
          .from("library_books")
          .select("id,title,author,subject,grade_level")
          .eq("status", "approved")
          .eq("grade_level", grade)
          .order("title")
          .limit(100);
        if (error) throw error;
        if (!cancelled) setBooks((data || []) as BookOption[]);
      } catch (error) {
        console.error("Academic setup book list load failed:", error);
        if (!cancelled) setBooks([]);
      }
    };
    void loadBooks();
    return () => { cancelled = true; };
  }, [grade]);

  useEffect(() => {
    setSubjects((current) => current.filter((subject) => subjectOptions.includes(subject)));
  }, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = useMemo(() => (step / totalSteps) * 100, [step, totalSteps]);

  const applyStreamPreset = (track: "natural" | "social") => {
    const natural = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Civics"];
    const social = ["Mathematics", "History", "Geography", "Economics", "English", "Civics"];
    const allowed = new Set(subjectOptions);
    setSubjects((track === "natural" ? natural : social).filter((subject) => allowed.has(subject)));
  };

  const toggleSubject = (subject: string) => {
    setSubjects((current) => current.includes(subject)
      ? current.filter((item) => item !== subject)
      : [...current, subject]);
  };

  const next = () => {
    if (band === "middle" && step === 1 && !grade) return toast.error("Choose your grade.");
    if (step === 2 && !goal) return toast.error("Choose what you are studying for.");
    if (band === "middle" && step === 3 && !curriculum) return toast.error("Choose your curriculum.");
    if (step === (band === "high" ? 3 : 4) && subjects.length === 0) return toast.error("Choose at least one subject.");
    if (step === totalSteps && !bookTitle.trim() && bookIds.length === 0 && !bookId) return toast.error("Choose at least one Library resource or enter a book title.");
    setStep((current) => Math.min(totalSteps, current + 1));
  };

  const save = async () => {
    if (!session?.user?.id) return;
    if (subjects.length === 0) return toast.error("Choose at least one subject.");
    if (!bookTitle.trim() && bookIds.length === 0 && !bookId) return toast.error("Choose at least one Library resource or enter a book title.");

    setLoading(true);
    const selectedBooks = books.filter((book) => bookIds.includes(book.id));
    const selectedBook = books.find((book) => book.id === bookId) || selectedBooks[0];
    const { error } = await db
      .from("academic_profiles")
      .upsert({
        user_id: session.user.id,
        grade,
        study_goal: goal,
        study_goal_detail: goalDetail.trim() || null,
        curriculum,
        subjects,
        book_ids: bookIds,
        book_id: bookIds[0] || bookId || null,
        book_title: selectedBooks.length ? selectedBooks.map((book) => book.title).join(", ") : (selectedBook?.title || bookTitle).trim(),
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    setLoading(false);

    if (error) {
      console.error("Academic setup save failed:", error);
      toast.error(`We couldn't save your ${academicLabel} setup. Please try again.`);
      return;
    }

    toast.success(`${academicLabel} is ready for you.`);
    navigate("/academic", { replace: true });
  };

  if (loadingProfile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading your {academicLabel} setup…</div>;
  }

  const selectedBook = books.find((book) => book.id === bookId);

  return (
    <div className={grade >= 9 ? "tier-upper min-h-screen bg-background px-4 py-6 pb-24 text-foreground" : "tier-middle min-h-screen bg-slate-50/80 px-4 py-6 pb-24 text-slate-950"}>
      <div className="mx-auto w-full max-w-2xl">
        <div className={grade >= 9 ? "mb-5 flex items-center gap-3" : "mb-6 flex items-start gap-3"}>
          <Button variant="ghost" size="icon" onClick={() => (step === 1 || (band === "high" && step === 2)) ? navigate("/academic") : setStep((current) => current - 1)} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <GraduationCap className={grade >= 9 ? "h-5 w-5 text-primary" : "h-5 w-5 text-sky-600"} />
              <h1 className="text-xl font-bold">Set up {academicLabel}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">We use your saved grade and learning activity to tailor your study path, goals, subjects and Library resources.</p>
          </div>
        </div>

        {band === "middle" && <div className="mb-5 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm shadow-sky-100/70">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-600">Your study profile</p><p className="mt-1 text-sm font-semibold">Step {step} of {totalSteps}</p></div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{Math.round(progress)}% ready</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-100"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div>
        </div>}

        <div className={grade >= 9 ? "mb-6 h-2 overflow-hidden rounded-full bg-muted" : "hidden"}>
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {band === "middle" && step === 1 && (
          <Card className="border-sky-200 bg-white shadow-sm shadow-sky-100/70">
            <CardHeader>
              <CardTitle>What grade are you in?</CardTitle>
              <p className="text-sm text-muted-foreground">This controls the level and curriculum content we prepare for you.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => index + 5).map((value) => (
                <Button key={value} variant={grade === value ? "default" : "outline"} className={grade === value ? "h-14 bg-sky-600 text-white hover:bg-sky-700" : "h-14 border-sky-200 bg-white hover:border-sky-400 hover:bg-sky-50"} onClick={() => setGrade(value)}>
                  Grade {value}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className={grade >= 9 ? undefined : "border-sky-200 bg-white shadow-sm shadow-sky-100/70"}>
            <CardHeader>
              <CardTitle>What are you studying for?</CardTitle>
              <p className="text-sm text-muted-foreground">This changes the balance between daily learning, revision and exam practice.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeGoalOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => setGoal(option.value)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${goal === option.value ? (grade >= 9 ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-sky-500 bg-sky-50 ring-1 ring-sky-500") : (grade >= 9 ? "border-border hover:bg-muted/50" : "border-slate-200 hover:border-sky-300 hover:bg-sky-50/60")}`}>
                  <div className="flex items-start gap-3">
                    <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div><p className="font-semibold">{option.title}</p><p className="mt-1 text-sm text-muted-foreground">{option.description}</p></div>
                  </div>
                </button>
              ))}
              {goal === "custom" && (
                <input value={goalDetail} onChange={(event) => setGoalDetail(event.target.value)}
                  placeholder="e.g. Grade 12 school final exam" className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
              )}
            </CardContent>
          </Card>
        )}

        {band === "middle" && step === 3 && (
          <Card className="border-sky-200 bg-white shadow-sm shadow-sky-100/70">
            <CardHeader>
              <CardTitle>Which curriculum do you study?</CardTitle>
              <p className="text-sm text-muted-foreground">Master Minds will use this to choose the right learning path.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {curriculumOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => setCurriculum(option.value)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${curriculum === option.value ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500" : "border-slate-200 hover:border-sky-300 hover:bg-sky-50/60"}`}>
                  <div className="flex items-start gap-3">
                    <Library className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div><p className="font-semibold">{option.title}</p><p className="mt-1 text-sm text-muted-foreground">{option.description}</p></div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {step === (band === "high" ? 3 : 4) && (
          <Card className={grade >= 9 ? undefined : "border-sky-200 bg-white shadow-sm shadow-sky-100/70"}>
            <CardHeader>
              <CardTitle>What subjects are you studying?</CardTitle>
              <p className="text-sm text-muted-foreground">Choose all subjects you want Academic Prep to support.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {band === "high" && grade >= 11 && (
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row">
                  <Button type="button" variant="outline" className="flex-1 justify-start" onClick={() => applyStreamPreset("natural")}>Natural Science Track</Button>
                  <Button type="button" variant="outline" className="flex-1 justify-start" onClick={() => applyStreamPreset("social")}>Social Science Track</Button>
                </div>
              )}
              {subjectOptions.map((subject) => (
                <button key={subject} type="button" onClick={() => toggleSubject(subject)}
                  className={`flex min-h-12 items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm transition ${subjects.includes(subject) ? (grade >= 9 ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-500") : (grade >= 9 ? "border-border hover:bg-muted/50" : "border-slate-200 hover:border-sky-300 hover:bg-sky-50/60")}`}>
                  <span>{subject}</span>
                  {subjects.includes(subject) && <Check className="h-4 w-4" />}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {step === totalSteps && (
          <Card className={grade >= 9 ? undefined : "border-sky-200 bg-white shadow-sm shadow-sky-100/70"}>
            <CardHeader>
              <CardTitle>Which Library books and resources do you use?</CardTitle>
              <p className="text-sm text-muted-foreground">Select as many approved Library books as you use. These resources guide revision and recommendations.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {books.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Master Minds library</label>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">
                    {books.map((book) => {
                      const checked = bookIds.includes(book.id);
                      return <label key={book.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted/50">
                        <input type="checkbox" checked={checked} onChange={() => {
                          setBookIds((current) => checked ? current.filter((id) => id !== book.id) : [...current, book.id]);
                          setBookId("");
                          setBookTitle("");
                        }} className="mt-1 h-4 w-4 accent-primary" />
                        <span className="min-w-0"><span className="block font-medium">{book.title}</span><span className="text-xs text-muted-foreground">{[book.author, book.subject, book.grade_level ? "Grade " + book.grade_level : ""].filter(Boolean).join(" · ")}</span></span>
                      </label>;
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-dashed p-4">
                <div className="mb-2 flex items-center gap-2 font-medium"><BookOpen className="h-4 w-4 text-primary" /> My textbook</div>
                <input value={bookId ? selectedBook?.title || "" : bookTitle}
                  onChange={(event) => { setBookId(""); setBookTitle(event.target.value); }}
                  placeholder="Enter the exact book / textbook name"
                  className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
                {books.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No approved resources are listed for your grade yet, so you can enter a textbook name.</p>}
              {bookIds.length > 0 && <p className="mt-2 text-sm text-primary">{bookIds.length} Library resource{bookIds.length === 1 ? "" : "s"} selected</p>}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-5 flex justify-end">
          {step < totalSteps ? (
            <Button onClick={next} size="lg" className={grade >= 9 ? undefined : "bg-sky-600 text-white shadow-lg shadow-sky-500/20 hover:bg-sky-700"}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
          ) : (
            <Button onClick={save} disabled={loading} size="lg" className={grade >= 9 ? undefined : "bg-sky-600 text-white shadow-lg shadow-sky-500/20 hover:bg-sky-700"}>{loading ? "Saving…" : "Finish setup"} <Check className="ml-2 h-4 w-4" /></Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcademicSetup;
