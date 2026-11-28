import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ClipboardCheck, Clock3, FileQuestion, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SchoolEmptyState, SchoolField, SchoolMetric, SchoolPageHeading, SchoolPanel, SchoolStatus,
  SchoolSecondaryButton, schoolInputClass, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";

type Props = { schoolId?: string; members: any[]; profiles: Record<string, any>; sections: any[] };
type QuizItem = {
  id: string; title: string; subject: string; grade: string | null; school_section_id: string | null;
  created_at: string; created_by: string; school_teacher_membership_id: string | null;
  school_review_status: string | null; school_review_feedback: string | null;
  source_kind: string; source_name: string | null; source_year: number | null; source_verification_status: string;
};
type BookItem = {
  id: string; title: string; author: string; subject: string; grade_level: number | null;
  school_grade_label: string | null; school_section_id: string | null; status: string;
  school_review_status: string | null; uploader_id: string; school_teacher_membership_id: string | null;
  created_at: string; book_category: string;
};
type ReviewEvent = {
  id: string; school_id: string; content_type: string; content_id: string;
  submitted_by_membership_id: string; reviewed_by_membership_id: string;
  review_status: string; feedback: string | null; created_at: string;
};
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";
const statusOf = (value?: string | null) => value || "unknown";

export default function SchoolManagerContentGovernanceWorkspace({ schoolId, members, profiles, sections }: Props) {
  const db = supabase as any;
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"queue" | "library" | "history">("queue");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!schoolId) {
      setQuizzes([]); setBooks([]); setEvents([]); setLoading(false); setError("");
      return;
    }
    setLoading(true); setError("");
    try {
      const [quizResult, bookResult, eventResult] = await Promise.all([
        db.from("quizzes")
          .select("id,title,subject,grade,school_section_id,created_at,created_by,school_teacher_membership_id,school_review_status,school_review_feedback,source_kind,source_name,source_year,source_verification_status")
          .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1500),
        db.from("library_books")
          .select("id,title,author,subject,grade_level,school_grade_label,school_section_id,status,school_review_status,uploader_id,school_teacher_membership_id,created_at,book_category")
          .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1500),
        db.from("school_content_review_events")
          .select("id,school_id,content_type,content_id,submitted_by_membership_id,reviewed_by_membership_id,review_status,feedback,created_at")
          .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(1000),
      ]);
      if (requestId !== requestSequence.current) return;
      const failures = [
        quizResult.error && "Quiz records: " + quizResult.error.message,
        bookResult.error && "Library records: " + bookResult.error.message,
        eventResult.error && "Review history: " + eventResult.error.message,
      ].filter(Boolean);
      if (failures.length) throw new Error(failures.join(" · "));
      setQuizzes((quizResult.data || []) as QuizItem[]);
      setBooks((bookResult.data || []) as BookItem[]);
      setEvents((eventResult.data || []) as ReviewEvent[]);
    } catch (cause) {
      if (requestId === requestSequence.current) setError(cause instanceof Error ? cause.message : "Content governance records could not be loaded.");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [db, schoolId]);

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);

  const memberName = useCallback((id?: string | null) => {
    if (!id) return "Unknown contributor";
    const member = members.find((item) => item.id === id);
    if (!member) return "School member";
    const profile = profiles[member.user_id] || {};
    return profile.name || profile.full_name || profile.username || member.school_username || "School member";
  }, [members, profiles]);
  const sectionName = (id?: string | null) => {
    const section = sections.find((item) => item.id === id);
    return section ? section.grade_label + " · " + section.section_name : "—";
  };
  const quizGrade = useCallback((item: QuizItem) => item.grade || (sections.find((section) => section.id === item.school_section_id)?.grade_label ?? "—"), [sections]);
  const bookGrade = useCallback((item: BookItem) => item.school_grade_label || (item.grade_level ? "Grade " + item.grade_level : "—"), []);
  const pendingQuizzes = quizzes.filter((item) => item.school_review_status === "pending");
  const pendingBooks = books.filter((item) => item.school_review_status === "pending");
  const approvedCount = quizzes.filter((item) => item.school_review_status === "approved").length
    + books.filter((item) => item.school_review_status === "approved").length;
  const verifiedQuizSources = quizzes.filter((item) => item.source_verification_status === "verified").length;
  const filteredQueue = useMemo(() => {
    const rows = [
      ...quizzes.map((item) => ({
        id: item.id, kind: "quiz", title: item.title, subject: item.subject, grade: quizGrade(item),
        sectionId: item.school_section_id, status: statusOf(item.school_review_status), createdAt: item.created_at,
        submittedBy: memberName(item.school_teacher_membership_id), detail: item.source_name || item.source_kind,
        verification: item.source_verification_status, feedback: item.school_review_feedback,
      })),
      ...books.map((item) => ({
        id: item.id, kind: "library_book", title: item.title, subject: item.subject, grade: bookGrade(item),
        sectionId: item.school_section_id, status: statusOf(item.school_review_status), createdAt: item.created_at,
        submittedBy: memberName(item.school_teacher_membership_id), detail: item.author + " · " + item.book_category,
        verification: "not_applicable", feedback: null,
      })),
    ];
    return rows.filter((item) =>
      (typeFilter === "all" || item.kind === typeFilter)
      && (statusFilter === "all" || item.status === statusFilter)
      && (gradeFilter === "all" || item.grade === gradeFilter)
      && (!search || (item.title + " " + item.subject + " " + item.grade + " " + item.detail).toLowerCase().includes(search.toLowerCase()))
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [quizzes, books, typeFilter, statusFilter, gradeFilter, search, memberName, quizGrade, bookGrade]);
  const gradeOptions = Array.from(new Set([
    ...quizzes.map(quizGrade), ...books.map(bookGrade),
  ].filter((value) => value && value !== "—"))).sort((a, b) => a.localeCompare(b));
  const history = events.filter((item) =>
    !search || (item.content_type + " " + item.review_status + " " + (item.feedback || "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <SchoolPageHeading
        title="Content governance"
        description="Monitor school-submitted quizzes and library resources, their approval status, source verification metadata, and the immutable review history. Approval remains with authorized appointed academic leaders."
        action={<SchoolSecondaryButton onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh content</SchoolSecondaryButton>}
      />
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Pending quizzes" value={pendingQuizzes.length} detail="Awaiting authorized academic review" icon={FileQuestion} />
        <SchoolMetric label="Pending library items" value={pendingBooks.length} detail="Awaiting authorized academic review" icon={BookOpen} />
        <SchoolMetric label="Approved resources" value={approvedCount} detail="Quizzes and library items" icon={ShieldCheck} />
        <SchoolMetric label="Verified quiz sources" value={verifiedQuizSources} detail={quizzes.length - verifiedQuizSources + " quizzes need source verification"} icon={ClipboardCheck} />
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(["queue", "library", "history"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} aria-pressed={tab === item}
            className={"rounded-lg px-4 py-2 text-sm font-semibold transition-colors " + (tab === item ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>
            {item === "queue" ? "Review queue" : item === "library" ? "Resource catalog" : "Review history"}
          </button>
        ))}
      </div>
      {tab !== "history" && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolField label="Search content"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className={schoolInputClass + " pl-9"} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, subject, grade or source" /></div></SchoolField>
        <SchoolField label="Content type"><select className={schoolSelectClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All content</option><option value="quiz">Quizzes</option><option value="library_book">Library resources</option></select></SchoolField>
        <SchoolField label="Review status"><select className={schoolSelectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="draft">Draft</option></select></SchoolField>
        <SchoolField label="Grade"><select className={schoolSelectClass} value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option value="all">All grades</option>{gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></SchoolField>
      </div>}
      {tab === "queue" && <SchoolPanel title="School content review queue" description="This is an oversight queue. The Manager can monitor submissions and follow-up status; approval and rejection are performed through the appointed academic leader workflow.">
        {filteredQueue.length ? <div className="space-y-3">{filteredQueue.map((item) => (
          <article key={item.kind + ":" + item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{item.title}</h3><SchoolStatus value={item.status} /></div><p className="mt-1 text-sm text-slate-600">{item.subject} · {item.grade} · {item.kind === "quiz" ? "Quiz" : "Library resource"}</p></div>
              {item.kind === "quiz" && <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (item.verification === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>Source: {item.verification.replace(/_/g, " ")}</span>}
            </div>
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3"><span>Submitted by {item.submittedBy}</span><span>Section {sectionName(item.sectionId)}</span><span>Submitted {dateTime(item.createdAt)}</span></div>
            <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
            {item.feedback && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Review feedback: {item.feedback}</p>}
            {item.status === "pending" && <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Pending decisions must be made by an appointed academic leader with the appropriate review permission. This workspace does not bypass that approval boundary.</p>}
          </article>
        ))}</div> : <SchoolEmptyState title="No matching school content" description="Pending submissions and existing school resources will appear here when available." />}
      </SchoolPanel>}
      {tab === "library" && <SchoolPanel title="School resource catalog" description="Review the current lifecycle state of school-submitted resources. Only resources visible under this Manager session's school-scoped access are shown.">
        {filteredQueue.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Resource</th><th className="px-3 py-3">Grade / section</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Submitted</th></tr></thead><tbody>{filteredQueue.map((item) => <tr key={item.kind + ":" + item.id} className="border-b border-slate-100"><td className="px-3 py-3"><p className="font-medium text-slate-900">{item.title}</p><p className="text-xs text-slate-500">{item.subject} · {item.kind === "quiz" ? "Quiz" : "Library"}</p></td><td className="px-3 py-3">{item.grade}<p className="text-xs text-slate-500">{sectionName(item.sectionId)}</p></td><td className="px-3 py-3"><SchoolStatus value={item.status}/></td><td className="px-3 py-3 text-xs text-slate-500">{dateTime(item.createdAt)}</td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No resources match these filters" description="Try another content type, grade, or review status." />}
      </SchoolPanel>}
      {tab === "history" && <SchoolPanel title="Content review history" description="Decisions are recorded by the existing guarded review RPCs. This view is read-only and displays only events permitted by school-level row security.">
        <div className="mb-4"><SchoolField label="Search review history"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className={schoolInputClass + " pl-9"} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search type, outcome or feedback" /></div></SchoolField></div>
        {history.length ? <div className="space-y-3">{history.map((item) => (
          <article key={item.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold capitalize text-slate-900">{item.content_type.replace(/_/g, " ")}</p><SchoolStatus value={item.review_status}/></div>
            <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-3"><span>Submitted by {memberName(item.submitted_by_membership_id)}</span><span>Reviewed by {memberName(item.reviewed_by_membership_id)}</span><span>{dateTime(item.created_at)}</span></div>
            {item.feedback && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.feedback}</p>}
          </article>
        ))}</div> : <SchoolEmptyState title="No review decisions recorded" description="Authorized quiz and library review decisions will appear here after they are recorded." />}
      </SchoolPanel>}
      <p className="flex items-start gap-2 text-xs text-slate-500"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />No content is approved, rejected, edited, or published from this oversight page. All decisions remain server-authorized and audited by the existing academic review functions.</p>
    </div>
  );
}
