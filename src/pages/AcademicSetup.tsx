import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, BookOpen, Check, GraduationCap, Library, Target } from "lucide-react";
import { toast } from "sonner";

type Goal = "class" | "ministry_exam" | "university_entrance" | "national_exam" | "custom";
type Curriculum = "oromia" | "addis_ababa";

type BookOption = {
  id: string;
  title: string;
  author?: string | null;
  subject?: string | null;
  grade_level?: number | null;
};

const goalOptions: Array<{ value: Goal; title: string; description: string }> = [
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

  const [step, setStep] = useState(1);
  const [grade, setGrade] = useState(Math.min(12, Math.max(5, gradeFromUser)));
  const [goal, setGoal] = useState<Goal>("class");
  const [goalDetail, setGoalDetail] = useState("");
  const [curriculum, setCurriculum] = useState<Curriculum>("oromia");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [books, setBooks] = useState<BookOption[]>([]);
  const [bookId, setBookId] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const band = grade <= 8 ? "middle" : "high";
  const academicLabel = grade >= 9 ? "Academic Prep" : "Academic Mode";
  const subjectOptions = subjectsByBand[band];

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("academic_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!cancelled && data) {
        setGrade(data.grade);
        setGoal(data.study_goal as Goal);
        setGoalDetail(data.study_goal_detail || "");
        setCurriculum(data.curriculum as Curriculum);
        setSubjects(data.subjects || []);
        setBookId(data.book_id || "");
        setBookTitle(data.book_title || "");
      }
      if (!cancelled) setLoadingProfile(false);
    };
    loadProfile();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    const loadBooks = async () => {
      const { data } = await supabase
        .from("library_books")
        .select("id,title,author,subject,grade_level")
        .eq("status", "approved")
        .eq("grade_level", grade)
        .order("title")
        .limit(100);
      setBooks((data || []) as BookOption[]);
    };
    loadBooks();
  }, [grade]);

  useEffect(() => {
    setSubjects((current) => current.filter((subject) => subjectOptions.includes(subject)));
  }, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = useMemo(() => (step / 5) * 100, [step]);

  const toggleSubject = (subject: string) => {
    setSubjects((current) => current.includes(subject)
      ? current.filter((item) => item !== subject)
      : [...current, subject]);
  };

  const next = () => {
    if (step === 1 && !grade) return toast.error("Choose your grade.");
    if (step === 2 && !goal) return toast.error("Choose what you are studying for.");
    if (step === 3 && !curriculum) return toast.error("Choose your curriculum.");
    if (step === 4 && subjects.length === 0) return toast.error("Choose at least one subject.");
    if (step === 5 && !bookTitle.trim() && !bookId) return toast.error("Choose a book or enter your book title.");
    setStep((current) => Math.min(5, current + 1));
  };

  const save = async () => {
    if (!session?.user?.id) return;
    if (subjects.length === 0) return toast.error("Choose at least one subject.");
    if (!bookTitle.trim() && !bookId) return toast.error("Choose a book or enter your book title.");

    setLoading(true);
    const selectedBook = books.find((book) => book.id === bookId);
    const { error } = await supabase
      .from("academic_profiles")
      .upsert({
        user_id: session.user.id,
        grade,
        study_goal: goal,
        study_goal_detail: goalDetail.trim() || null,
        curriculum,
        subjects,
        book_id: bookId || null,
        book_title: (selectedBook?.title || bookTitle).trim(),
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
    <div className="min-h-screen bg-background px-4 py-6 pb-24">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => step === 1 ? navigate("/academic") : setStep((current) => current - 1)} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Set up {academicLabel}</h1>
            </div>
            <p className="text-sm text-muted-foreground">We will use these answers to personalize your study experience for your grade, goal, curriculum, subjects, and textbook.</p>
          </div>
        </div>

        <div className="mb-6 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>What grade are you in?</CardTitle>
              <p className="text-sm text-muted-foreground">This controls the level and curriculum content we prepare for you.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => index + 5).map((value) => (
                <Button key={value} variant={grade === value ? "default" : "outline"} className="h-14" onClick={() => setGrade(value)}>
                  Grade {value}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>What are you studying for?</CardTitle>
              <p className="text-sm text-muted-foreground">This changes the balance between daily learning, revision and exam practice.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {goalOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => setGoal(option.value)}
                  className={`w-full rounded-xl border p-4 text-left transition ${goal === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}>
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

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Which curriculum do you study?</CardTitle>
              <p className="text-sm text-muted-foreground">Master Minds will use this to choose the right learning path.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {curriculumOptions.map((option) => (
                <button key={option.value} type="button" onClick={() => setCurriculum(option.value)}
                  className={`w-full rounded-xl border p-4 text-left transition ${curriculum === option.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}>
                  <div className="flex items-start gap-3">
                    <Library className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div><p className="font-semibold">{option.title}</p><p className="mt-1 text-sm text-muted-foreground">{option.description}</p></div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>What subjects are you studying?</CardTitle>
              <p className="text-sm text-muted-foreground">Choose everything you want Academic Mode to prepare for.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {subjectOptions.map((subject) => (
                <button key={subject} type="button" onClick={() => toggleSubject(subject)}
                  className={`flex min-h-12 items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${subjects.includes(subject) ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-border hover:bg-muted/50"}`}>
                  <span>{subject}</span>
                  {subjects.includes(subject) && <Check className="h-4 w-4" />}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle>Which book do you study from?</CardTitle>
              <p className="text-sm text-muted-foreground">Use an approved Master Minds book when available, or enter the exact textbook you use at school.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {books.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Master Minds library</label>
                  <select value={bookId} onChange={(event) => { setBookId(event.target.value); if (event.target.value) setBookTitle(""); }}
                    className="w-full rounded-xl border bg-background px-4 py-3">
                    <option value="">Select a textbook</option>
                    {books.map((book) => <option key={book.id} value={book.id}>{book.title}{book.author ? ` — ${book.author}` : ""}</option>)}
                  </select>
                </div>
              )}

              <div className="rounded-xl border border-dashed p-4">
                <div className="mb-2 flex items-center gap-2 font-medium"><BookOpen className="h-4 w-4 text-primary" /> My textbook</div>
                <input value={bookId ? selectedBook?.title || "" : bookTitle}
                  onChange={(event) => { setBookId(""); setBookTitle(event.target.value); }}
                  placeholder="Enter the exact book / textbook name"
                  className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
                {books.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No approved textbook is in the Master Minds library yet, so you can enter your book now. We can connect it to the library later.</p>}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-5 flex justify-end">
          {step < 5 ? (
            <Button onClick={next} size="lg">Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
          ) : (
            <Button onClick={save} disabled={loading} size="lg">{loading ? "Saving…" : "Finish setup"} <Check className="ml-2 h-4 w-4" /></Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcademicSetup;
