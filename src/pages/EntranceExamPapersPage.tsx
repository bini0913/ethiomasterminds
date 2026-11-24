import { db } from "@/integrations/untypedClient";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, FileText, Search, ShieldCheck, Sparkles, SlidersHorizontal, ArrowUpRight, CalendarDays, Target, CheckCircle2 } from "lucide-react";
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

const sourceStatusLabel = (value: string | null | undefined) => {
  const status = String(value || "").toLowerCase();
  if (["verified", "source_verified", "verified_metadata"].includes(status)) return "Source verified";
  if (status === "permission_confirmed") return "Permission confirmed";
  return "Verification pending";
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

        // Practice availability is derived from approved quiz metadata only.
        // Never load question answer keys for a catalog page.
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

        const available = grade12Quizzes
          .map((quiz: any) => normalizeSubject(String(quiz.subject || "")))
          .filter(Boolean);
        if (active) setPracticeSubjects(Array.from(new Set(available)));
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
  const ecYears = useMemo(
    () => [...new Set(papers.map((paper) => paper.ethiopian_year).filter((value): value is number => value != null))].sort((a, b) => b - a),
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

  const verifiedCount = papers.filter((paper) => ["verified", "source_verified", "verified_metadata"].includes(String(paper.source_status || "").toLowerCase())).length;
  const subjectCount = subjects.length;
  const activeFilterCount = [search.trim(), year !== "all" ? year : "", subject !== "all" ? subject : "", stream !== "all" ? stream : "", ecYear !== "all" ? ecYear : ""].filter(Boolean).length;

  return <main className="tier-upper min-h-screen bg-[#07101f] pb-24 text-white">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,.18),transparent_30rem),radial-gradient(circle_at_92%_10%,rgba(99,102,241,.2),transparent_34rem)]" />
    <div className="relative mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="shrink-0 rounded-xl text-white/70 hover:bg-white/10 hover:text-white" aria-label="Back to Academic Mode" onClick={() => navigate("/academic")}><ArrowLeft className="h-5 w-5" /></Button><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">Academic Prep / Archive</p><h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">Entrance exam vault</h1></div></div>
        <Button variant="outline" className="hidden rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 sm:flex" onClick={() => navigate("/academic/exam", { state: { subject: subject !== "all" ? subject : undefined } })}><Target className="mr-2 h-4 w-4 text-cyan-300" />Practice mode</Button>
      </header>

      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-cyan-500/15 via-white/[0.045] to-indigo-500/15 p-5 shadow-2xl shadow-cyan-950/30 sm:p-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-100"><Sparkles className="h-3.5 w-3.5" /> BUILD YOUR ADVANTAGE</div><h2 className="max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">Past papers are not just archives. They are your competitive edge.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">Find official-source references by year and subject, then turn the gaps you discover into a focused practice session.</p><div className="mt-6 flex flex-wrap gap-3"><Button className="rounded-xl bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300" onClick={() => document.getElementById("paper-filters")?.scrollIntoView({ behavior: "smooth" })}>Explore the vault <ArrowUpRight className="ml-2 h-4 w-4" /></Button><Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 sm:hidden" onClick={() => navigate("/academic/exam")}>Start practice</Button></div></div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3"><div className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4"><p className="text-2xl font-black text-cyan-200">{papers.length}</p><p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">Papers indexed</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4"><p className="text-2xl font-black text-emerald-300">{verifiedCount}</p><p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">Source verified</p></div><div className="rounded-2xl border border-white/10 bg-black/15 p-3 sm:p-4"><p className="text-2xl font-black text-violet-200">{subjectCount}</p><p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">Subjects</p></div></div>
        </div>
      </section>

      <section id="paper-filters" className="scroll-mt-6 space-y-3"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300/80">Find your target</p><h2 className="mt-1 text-xl font-black">Search the archive</h2></div><div className="flex items-center gap-2 text-xs text-white/45"><SlidersHorizontal className="h-4 w-4" />{activeFilterCount ? `${activeFilterCount} filters active` : "Browse all papers"}</div></div><Card className="border-white/10 bg-white/[0.055] shadow-xl shadow-black/10 backdrop-blur"><CardContent className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]"><div className="relative sm:col-span-2 lg:col-span-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/50"/><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search subject, year, or source" className="h-11 border-white/10 bg-black/15 pl-9 text-white placeholder:text-white/35"/></div><select aria-label="Subject" value={subject} onChange={event => setSubject(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#101b2f] px-3 text-sm text-white"><option value="all">All subjects</option>{subjects.map(item=><option key={item} value={item}>{item}</option>)}</select><select aria-label="Stream" value={stream} onChange={event => setStream(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#101b2f] px-3 text-sm text-white"><option value="all">All streams</option><option value="natural">Natural Science</option><option value="social">Social Science</option></select><select aria-label="Ethiopian academic year" value={ecYear} onChange={event => setEcYear(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#101b2f] px-3 text-sm text-white"><option value="all">All E.C. years</option>{ecYears.map(value=><option key={value} value={String(value)}>{value} E.C.</option>)}</select><select aria-label="Gregorian year" value={year} onChange={event => setYear(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#101b2f] px-3 text-sm text-white"><option value="all">All years</option>{years.map(value=><option key={value} value={String(value)}>{value} G.C.</option>)}</select></CardContent></Card><div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Quick Ethiopian year filters"><span className="shrink-0 text-xs font-bold uppercase tracking-wider text-white/40">Quick years</span><Button size="sm" className="shrink-0 rounded-full" variant={ecYear === "all" ? "default" : "outline"} onClick={() => setEcYear("all")}>All</Button>{ecYears.slice(0, 5).map(value => <Button key={value} size="sm" className="shrink-0 rounded-full border-white/15 bg-white/5" variant={ecYear === String(value) ? "default" : "outline"} onClick={() => setEcYear(String(value))}>{value} E.C.</Button>)}</div></section>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-4 text-sm text-amber-100/75"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"/><p><span className="font-bold text-amber-100">Source-aware by design.</span> These are linked archive references, not copied question text or certified answer keys. Always confirm the paper version and official marking guidance before treating a source as authoritative.</p></div>
      {loading ? <Card className="border-white/10 bg-white/[0.045]"><CardContent className="flex min-h-48 items-center justify-center gap-3 p-8 text-white/60"><Sparkles className="h-5 w-5 animate-pulse text-cyan-300" />Loading the exam vault…</CardContent></Card> : error ? <Card className="border-red-300/20 bg-red-500/10"><CardContent className="p-6 text-sm text-red-100">{error}</CardContent></Card> : filtered.length === 0 ? <Card className="border-white/10 bg-white/[0.045]"><CardContent className="p-12 text-center"><FileText className="mx-auto h-10 w-10 text-white/25"/><p className="mt-3 font-bold">No papers match this search</p><p className="mt-1 text-sm text-white/50">Try clearing a filter or searching a different subject.</p></CardContent></Card> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(paper => { const status = String(paper.source_status || "").toLowerCase(); const sourceVerified = ["verified", "source_verified", "verified_metadata"].includes(status); return <Card key={paper.id} className="group h-full overflow-hidden border-white/10 bg-white/[0.045] shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.07]"><CardContent className="flex h-full flex-col gap-4 p-5"><div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200"><FileText className="h-5 w-5"/></div><Badge className="border-white/10 bg-white/10 text-white/70">{paper.gregorian_year ? `${paper.gregorian_year} G.C.` : "Year unavailable"}</Badge></div><div><h2 className="text-lg font-black">{paper.subject}</h2><p className="mt-1 text-sm text-white/55">{paper.ethiopian_year ? `${paper.ethiopian_year} E.C.` : "E.C. year unavailable"} · Grade 12 entrance exam</p><p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/60"><CalendarDays className="h-3.5 w-3.5" />{paper.stream || "Stream not specified"}</p></div><p className="flex-1 text-sm leading-5 text-white/55">{paper.notes || "A source-linked paper reference ready for your revision workflow."}</p><div className="flex flex-wrap items-center gap-2"><Badge className={sourceVerified ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-white/15 bg-white/5 text-white/60"}>{sourceStatusLabel(paper.source_status)}</Badge><span className="truncate text-xs font-semibold text-white/55">{paper.source_name || "Source unavailable"}</span></div>{practiceSubjects.includes(normalizeSubject(paper.subject)) && <Button variant="outline" className="w-full rounded-xl border-cyan-300/20 bg-cyan-400/5 text-cyan-100 hover:bg-cyan-400/15" onClick={() => navigate("/academic/exam", { state: { subject: paper.subject } })}><Target className="mr-2 h-4 w-4"/>Practice this subject</Button>}<Button className="w-full rounded-xl bg-white text-slate-950 hover:bg-cyan-100" disabled={!isSafeHttpUrl(paper.source_url)} onClick={() => { if (isSafeHttpUrl(paper.source_url)) window.open(paper.source_url!, "_blank", "noopener,noreferrer"); }}>{isSafeHttpUrl(paper.source_url) ? "Open source archive" : "Source link unavailable"}<ExternalLink className="ml-2 h-4 w-4"/></Button></CardContent></Card>; })}</div>}
      <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/55 sm:grid-cols-3"><div className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300"/><p><span className="font-bold text-white">Source-linked.</span> Open the original archive instead of relying on copied content.</p></div><div className="flex gap-3"><Target className="h-5 w-5 shrink-0 text-cyan-300"/><p><span className="font-bold text-white">Practice-ready.</span> Jump into a focused exam session when a subject bank is available.</p></div><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-violet-300"/><p><span className="font-bold text-white">Transparent.</span> Verification status is visible on every paper.</p></div></section>
    </div>
  </main>;
};

export default EntranceExamPapersPage;
