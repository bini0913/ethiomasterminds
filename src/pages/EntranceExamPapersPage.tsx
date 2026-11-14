import { db } from "@/integrations/untypedClient";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { normalizeSubject } from "@/lib/academicProfile";

const isSafeHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

type Paper = {
  id: string; subject: string; ethiopian_year: number; gregorian_year: number;
  stream: string; source_name: string; source_url: string; source_status: string; notes: string;
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
    (async () => {
      const { data, error: queryError } = await db
        .from("entrance_exam_papers")
        .select("id,subject,ethiopian_year,gregorian_year,stream,source_name,source_url,source_status,notes")
        .eq("grade_level", 12)
        .order("gregorian_year", { ascending: false })
        .order("subject", { ascending: true });
      if (!active) return;
      if (queryError) setError("The past-paper catalog is not available yet. Apply the database migration and reload this page.");
      else setPapers((data ?? []) as Paper[]);
      const { data: quizzes } = await db.from("quizzes").select("id,subject,grade,is_approved").eq("is_approved", true);
      const grade12Quizzes = (quizzes || []).filter((quiz: any) => Number(quiz.grade) === 12);
      if (grade12Quizzes.length) {
        const { data: questions } = await db.from("questions").select("quiz_id,question_text,options,option_a,option_b,option_c,option_d,correct_answer").in("quiz_id", grade12Quizzes.map((quiz: any) => quiz.id));
        const quizById = new Map<string, string>(grade12Quizzes.map((quiz: any) => [String(quiz.id), normalizeSubject(String(quiz.subject || ""))] as [string, string]));
        const available = new Set<string>();
        (questions || []).forEach((question: any) => {
          const options = Array.isArray(question.options) ? question.options : [question.option_a, question.option_b, question.option_c, question.option_d].filter(Boolean);
          if (question.question_text && question.correct_answer != null && options.length >= 2) {
            const subjectName = quizById.get(question.quiz_id);
            if (subjectName) available.add(subjectName);
          }
        });
        if (active) setPracticeSubjects(Array.from(available));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const subjects = useMemo(() => [...new Set(papers.map(p => p.subject))].sort(), [papers]);
  const years = useMemo(() => [...new Set(papers.map(p => p.gregorian_year))].sort((a,b) => b-a), [papers]);
  const filtered = useMemo(() => papers.filter(p => {
    const q = search.trim().toLowerCase();
    return (subject === "all" || p.subject === subject)
      && (stream === "all" || p.stream.toLowerCase().includes(stream))
      && (ecYear === "all" || String(p.ethiopian_year) === ecYear)
      && (year === "all" || String(p.gregorian_year) === year)
      && (!q || [p.subject, p.source_name, p.stream, String(p.gregorian_year), String(p.ethiopian_year)].some(v => v.toLowerCase().includes(q)));
  }), [papers, search, subject, year, stream, ecYear]);

  return <main className="tier-upper mx-auto w-full max-w-6xl space-y-6 p-4 pb-24 md:p-8">
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" aria-label="Back to Academic Mode" onClick={() => navigate("/academic")}><ArrowLeft className="h-5 w-5" /></Button>
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Academic Prep / Question Bank</p><h1 className="text-2xl font-bold md:text-3xl">University entrance past papers</h1></div>
    </div>
    <Card><CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subject or year" className="pl-9"/></div>
      <select value={subject} onChange={e => setSubject(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All subjects</option>{subjects.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <select aria-label="Stream" value={stream} onChange={e => setStream(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm"><option value="all">All streams</option><option value="natural">Natural Science</option><option value="social">Social Science</option></select>
      <select aria-label="Ethiopian academic year" value={ecYear} onChange={e => setEcYear(e.target.value)} className="h-10 rounded-md border border-border bg-card px-3 text-sm"><option value="all">All E.C. years</option>{[2016,2015,2014,2013,2012].map(y=><option key={y} value={String(y)}>{y} E.C.</option>)}</select>
      <select value={year} onChange={e => setYear(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All years</option>{years.map(y=><option key={y} value={String(y)}>{y} G.C.</option>)}</select>
    </CardContent></Card>
    <div className="flex flex-wrap gap-2" aria-label="Quick Ethiopian year filters">
      <Button size="sm" variant={ecYear === "all" ? "default" : "outline"} onClick={() => setEcYear("all")}>All years</Button>
      {[2016, 2015, 2014, 2013, 2012].map((y) => <Button key={y} size="sm" variant={ecYear === String(y) ? "default" : "outline"} onClick={() => setEcYear(String(y))}>{y} E.C.</Button>)}
    </div>
    <div className="flex items-start gap-3 rounded-lg border p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><p>These entries are a source-linked catalog, not copied question text. Open the source to view/download papers and check the answer key. The catalog only marks source metadata; it does not certify every answer as official.</p></div>
    {loading ? <p className="py-10 text-center text-muted-foreground">Loading past papers…</p> : error ? <Card><CardContent className="p-6 text-sm">{error}</CardContent></Card> : filtered.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No catalog entries match those filters.</CardContent></Card> :
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(p=><Card key={p.id} className="h-full"><CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5"/></div><Badge variant="secondary">{p.gregorian_year} G.C.</Badge></div>
        <div><h2 className="font-semibold">{p.subject}</h2><p className="text-sm text-muted-foreground">{p.ethiopian_year} E.C. · Grade 12 entrance exam</p><p className="mt-1 text-xs text-muted-foreground">{p.stream}</p></div>
        <p className="flex-1 text-xs text-muted-foreground">{p.notes}</p>
        <div className="flex flex-wrap items-center gap-2"><Badge variant={["verified", "permission_confirmed", "source_verified"].includes(String(p.source_status || "").toLowerCase()) ? "default" : "outline"}>{["verified", "permission_confirmed", "source_verified"].includes(String(p.source_status || "").toLowerCase()) ? "Source verified" : "Verification pending"}</Badge><Badge variant="outline">{p.stream || "Stream not specified"}</Badge></div>
        <p className="text-xs font-medium">{p.source_name}</p>
        {practiceSubjects.includes(normalizeSubject(p.subject)) && <Button variant="outline" className="w-full" onClick={() => navigate("/academic/exam", { state: { subject: p.subject } })}>Practice in Exam Mode</Button>}
        <Button className="w-full" disabled={!isSafeHttpUrl(p.source_url)} onClick={() => { if (isSafeHttpUrl(p.source_url)) window.open(p.source_url, "_blank", "noopener,noreferrer"); }} >{isSafeHttpUrl(p.source_url) ? "Open source archive" : "Source link unavailable"} <ExternalLink className="ml-2 h-4 w-4"/></Button>
      </CardContent></Card>)}</div>}
  </main>;
};
export default EntranceExamPapersPage;
