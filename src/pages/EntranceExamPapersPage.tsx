import { db } from "@/integrations/untypedClient";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, FileText, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { normalizeSubject } from "@/lib/academicProfile";

const isSafeHttpUrl = (value: string | null | undefined) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

type Paper = {
  id: string;
  subject: string;
  ethiopian_year: number | null;
  gregorian_year: number | null;
  stream: string | null;
  source_name: string | null;
  source_url: string | null;
  source_status: string | null;
  notes: string | null;
};

const EntranceExamPapersPage: React.FC = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [subject, setSubject] = useState("all");
  const [stream, setStream] = useState("all");
  const [ecYear, setEcYear] = useState("all");
  const [practiceSubjects, setPracticeSubjects] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      try {
        const { data, error: queryError } = await db
          .from("entrance_exam_papers")
          .select("id,subject,ethiopian_year,gregorian_year,stream,source_name,source_url,source_status,notes")
          .eq("grade_level", 12)
          .order("gregorian_year", { ascending: false })
          .order("subject", { ascending: true });

        if (!active) return;
        if (queryError) {
          setError("The past-paper catalog is not available yet. Please try again later.");
        } else {
          setPapers((data ?? []) as Paper[]);
        }

        // Practice availability is derived from the real approved quiz bank.
        // A failure here must not make the independently loaded paper catalog unusable.
        const { data: quizzes, error: quizError } = await db
          .from("quizzes")
          .select("id,subject,grade,is_approved")
          .eq("is_approved", true);

        if (quizError) {
          console.warn("Entrance-paper practice availability could not be loaded:", quizError);
          return;
        }

        const grade12Quizzes = (quizzes || []).filter((quiz: any) => Number(quiz.grade) === 12);
        if (!grade12Quizzes.length) return;

        const { data: questions, error: questionError } = await db
          .from("questions")
          .select("quiz_id,question_text,options,option_a,option_b,option_c,option_d,correct_answer")
          .in("quiz_id", grade12Quizzes.map((quiz: any) => quiz.id));

        if (questionError) {
          console.warn("Entrance-paper practice questions could not be checked:", questionError);
          return;
        }

        const quizById = new Map<string, string>(
          grade12Quizzes.map((quiz: any) => [String(quiz.id), normalizeSubject(String(quiz.subject || ""))] as [string, string])
        );
        const available = new Set<string>();

        (questions || []).forEach((question: any) => {
          const storedOptions = Array.isArray(question.options) ? question.options : [];
          const options = storedOptions.length
            ? storedOptions
            : [question.option_a, question.option_b, question.option_c, question.option_d].filter(Boolean);
          if (question.question_text && question.correct_answer != null && options.length >= 2) {
            const subjectName = quizById.get(String(question.quiz_id));
            if (subjectName) available.add(subjectName);
          }
        });

        if (active) setPracticeSubjects(Array.from(available));
      } catch (loadError) {
        console.error("Entrance-paper catalog load failed:", loadError);
        if (active) setError("We couldn't load the past-paper catalog. Please retry.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  const subjects = useMemo(() => [...new Set(papers.map((paper) => paper.subject).filter(Boolean))].sort(), [papers]);
  const years = useMemo(
    () => [...new Set(papers.map((paper) => paper.gregorian_year).filter((value): value is number => value != null))].sort((a, b) => b - a),
    [papers]
  );

  const filtered = useMemo(() => papers.filter((paper) => {
    const query = search.trim().toLowerCase();
    const paperStream = String(paper.stream || "").toLowerCase();
    const searchFields = [
      paper.subject || "",
      paper.source_name || "",
      paper.stream || "",
      String(paper.gregorian_year ?? ""),
      String(paper.ethiopian_year ?? ""),
    ];
    return (subject === "all" || paper.subject === subject)
      && (stream === "all" || paperStream.includes(stream))
      && (ecYear === "all" || String(paper.ethiopian_year ?? "") === ecYear)
      && (year === "all" || String(paper.gregorian_year ?? "") === year)
      && (!query || searchFields.some((value) => value.toLowerCase().includes(query)));
  }), [papers, search, subject, year, stream, ecYear]);

  return <main className="tier-upper mx-auto w-full max-w-6xl space-y-6 p-4 pb-24 md:p-8">
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" aria-label="Back to Academic Mode" onClick={() => navigate("/academic")}><ArrowLeft className="h-5 w-5" /></Button>
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Academic Prep / Question Bank</p><h1 className="text-2xl font-bold md:text-3xl">University entrance past papers</h1></div>
    </div>
    <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search subject or year" className="pl-9"/></div>
      <select aria-label="Subject" value={subject} onChange={event => setSubject(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All subjects</option>{subjects.map(item=><option key={item} value={item}>{item}</option>)}</select>
      <select aria-label="Stream" value={stream} onChange={event => setStream(event.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm"><option value="all">All streams</option><option value="natural">Natural Science</option><option value="social">Social Science</option></select>
      <select aria-label="Ethiopian academic year" value={ecYear} onChange={event => setEcYear(event.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm"><option value="all">All E.C. years</option>{[2016,2015,2014,2013,2012].map(value=><option key={value} value={String(value)}>{value} E.C.</option>)}</select>
      <select aria-label="Gregorian year" value={year} onChange={event => setYear(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All years</option>{years.map(value=><option key={value} value={String(value)}>{value} G.C.</option>)}</select>
    </CardContent></Card>
    <div className="flex flex-wrap gap-2" aria-label="Quick Ethiopian year filters">
      <Button size="sm" variant={ecYear === "all" ? "default" : "outline"} onClick={() => setEcYear("all")}>All years</Button>
      {[2016, 2015, 2014, 2013, 2012].map(value => <Button key={value} size="sm" variant={ecYear === String(value) ? "default" : "outline"} onClick={() => setEcYear(String(value))}>{value} E.C.</Button>)}
    </div>
    <div className="flex items-start gap-3 rounded-lg border p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><p>These entries are a source-linked catalog, not copied question text. Open the source to view or download papers and check the answer key. The catalog records source metadata; it does not certify every answer as official.</p></div>
    {loading ? <p className="py-10 text-center text-muted-foreground">Loading past papers…</p> : error ? <Card><CardContent className="p-6 text-sm">{error}</CardContent></Card> : filtered.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No catalog entries match those filters.</CardContent></Card> :
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(paper => {
        const status = String(paper.source_status || "").toLowerCase();
        const sourceVerified = ["verified", "source_verified"].includes(status);
        return <Card key={paper.id} className="h-full"><CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5"/></div><Badge variant="secondary">{paper.gregorian_year ? `${paper.gregorian_year} G.C.` : "Year unavailable"}</Badge></div>
          <div><h2 className="font-semibold">{paper.subject}</h2><p className="text-sm text-muted-foreground">{paper.ethiopian_year ? `${paper.ethiopian_year} E.C.` : "E.C. year unavailable"} · Grade 12 entrance exam</p><p className="mt-1 text-xs text-muted-foreground">{paper.stream || "Stream not specified"}</p></div>
          <p className="flex-1 text-xs text-muted-foreground">{paper.notes || "No additional source notes."}</p>
          <div className="flex flex-wrap items-center gap-2"><Badge variant={sourceVerified ? "default" : "outline"}>{sourceVerified ? "Source verified" : status === "permission_confirmed" ? "Permission confirmed" : "Verification pending"}</Badge><Badge variant="outline">{paper.stream || "Stream not specified"}</Badge></div>
          <p className="text-xs font-medium">{paper.source_name || "Source name unavailable"}</p>
          {practiceSubjects.includes(normalizeSubject(paper.subject)) && <Button variant="outline" className="w-full" onClick={() => navigate("/academic/exam", { state: { subject: paper.subject } })}>Practice in Exam Mode</Button>}
          <Button className="w-full" disabled={!isSafeHttpUrl(paper.source_url)} onClick={() => { if (isSafeHttpUrl(paper.source_url)) window.open(paper.source_url!, "_blank", "noopener,noreferrer"); }}>{isSafeHttpUrl(paper.source_url) ? "Open source archive" : "Source link unavailable"} <ExternalLink className="ml-2 h-4 w-4"/></Button>
        </CardContent></Card>;
      })}</div>}
  </main>;
};

export default EntranceExamPapersPage;
