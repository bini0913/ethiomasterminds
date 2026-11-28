import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Award, BookOpen, CalendarCheck, Clock3, CreditCard, GraduationCap, RefreshCw, TrendingUp, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SchoolEmptyState, SchoolPageHeading, SchoolPanel, SchoolSecondaryButton, SchoolStatus } from "@/components/school/SchoolPortalPrimitives";

type Props = {
  schoolId?: string;
  student: any;
  profile: Record<string, any>;
  sectionLabel: string;
  terms: any[];
  onBack: () => void;
};
type ResultRow = {
  id: string; term_id: string; subject_name: string; average_score: number | null;
  letter_grade: string | null; rank_position: number | null; status: string;
  calculated_at: string | null; published_at: string | null;
};
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString() : "—";
const numberLabel = (value: unknown) => value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function SchoolManagerStudentProfile({ schoolId, student, profile, sectionLabel, terms, onBack }: Props) {
  const db = supabase as any;
  const [results, setResults] = useState<ResultRow[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<Record<string, any>>({});
  const [attendance, setAttendance] = useState<any[]>([]);
  const [attendanceDates, setAttendanceDates] = useState<Record<string, string>>({});
  const [invoices, setInvoices] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"academic" | "attendance" | "homework" | "finance" | "history">("academic");

  const load = useCallback(async () => {
    if (!schoolId || !student?.id) return;
    setLoading(true);
    setErrors([]);
    const queries = await Promise.all([
      db.from("school_term_results").select("id,term_id,subject_name,average_score,letter_grade,rank_position,status,calculated_at,published_at").eq("school_id", schoolId).eq("student_membership_id", student.id).order("calculated_at", { ascending: false }).limit(100),
      db.from("school_student_marks").select("id,assessment_id,score,status,teacher_note,created_at").eq("school_id", schoolId).eq("student_membership_id", student.id).order("created_at", { ascending: false }).limit(100),
      db.from("school_attendance_records").select("id,session_id,attendance_status,note,created_at").eq("school_id", schoolId).eq("student_membership_id", student.id).order("created_at", { ascending: false }).limit(180),
      db.from("school_student_invoices").select("id,invoice_number,description,amount,paid_amount,balance,currency,due_date,status,created_at").eq("school_id", schoolId).eq("student_membership_id", student.id).order("created_at", { ascending: false }).limit(100),
      db.from("school_homework_submissions").select("id,homework_id,status,grade,feedback,submitted_at,graded_at").eq("school_id", schoolId).eq("student_membership_id", student.id).order("submitted_at", { ascending: false }).limit(100),
      db.from("school_record_events").select("id,event_type,details,created_at").eq("school_id", schoolId).eq("membership_id", student.id).order("created_at", { ascending: false }).limit(100),
    ]);
    const labels = ["Published term results", "Assessment marks", "Attendance records", "Student invoices", "Homework submissions", "Enrollment history"];
    const failures = queries.flatMap((result, index) => result.error ? [labels[index] + ": " + result.error.message] : []);
    setResults((queries[0].data || []) as ResultRow[]);
    setMarks(queries[1].data || []);
    setAttendance(queries[2].data || []);
    setInvoices(queries[3].data || []);
    setHomework(queries[4].data || []);
    setHistory(queries[5].data || []);
    if (failures.length) setErrors(failures);

    const assessmentIds = [...new Set((queries[1].data || []).map((item: any) => item.assessment_id).filter(Boolean))];
    if (assessmentIds.length) {
      const { data, error } = await db.from("school_assessments").select("id,title,subject_name,max_score,term_id,due_at").eq("school_id", schoolId).in("id", assessmentIds);
      if (error) setErrors((current) => [...current, "Assessment details: " + error.message]);
      setAssessments(Object.fromEntries((data || []).map((item: any) => [item.id, item])));
    } else setAssessments({});

    const sessionIds = [...new Set((queries[2].data || []).map((item: any) => item.session_id).filter(Boolean))];
    if (sessionIds.length) {
      const { data, error } = await db.from("school_attendance_sessions").select("id,attendance_date,status").eq("school_id", schoolId).in("id", sessionIds);
      if (error) setErrors((current) => [...current, "Attendance dates: " + error.message]);
      setAttendanceDates(Object.fromEntries((data || []).map((item: any) => [item.id, item.attendance_date])));
    } else setAttendanceDates({});
    setLoading(false);
  }, [db, schoolId, student?.id]);

  useEffect(() => { void load(); }, [load]);

  const publishedResults = useMemo(() => results.filter((item) => Boolean(item.published_at) && item.rank_position !== null), [results]);
  const latestRank = publishedResults[0];
  const attendanceCounts = attendance.reduce((acc: Record<string, number>, item) => {
    const key = String(item.attendance_status || "unmarked").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const attendanceMarked = attendance.length;
  const attendancePresent = (attendanceCounts.present || 0) + (attendanceCounts.late || 0);
  const attendanceRate = attendanceMarked ? Math.round((attendancePresent / attendanceMarked) * 100) : null;
  const latestAverage = publishedResults.length ? Number(publishedResults[0].average_score || 0) : null;
  const balanceByCurrency = invoices.reduce((acc: Record<string, number>, invoice) => {
    const currency = invoice.currency || "ETB";
    acc[currency] = (acc[currency] || 0) + Number(invoice.balance || 0);
    return acc;
  }, {});
  const termName = (id: string) => terms.find((term) => term.id === id)?.name || "Term record";
  const studentName = profile.name || profile.full_name || profile.username || student.school_username || "Student";

  return (
    <div className="space-y-5">
      <SchoolPageHeading title="Student profile" description="A school-scoped view of this student's academic, attendance, enrollment, and fee records." action={<SchoolSecondaryButton onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Back to directory</SchoolSecondaryButton>} />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#10294B] to-[#1D4F91] px-5 py-6 text-white sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15"><UserRound className="h-7 w-7" /></div>
              <div className="min-w-0"><h2 className="truncate text-xl font-bold">{studentName}</h2><p className="mt-1 text-sm text-blue-100">{profile.username ? "@" + profile.username : student.school_username || "No username"} · {student.grade_label || profile.grade || "Grade not assigned"} · {sectionLabel}</p></div>
            </div>
            <SchoolStatus value={student.status} />
          </div>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-blue-100">School student ID</p><p className="mt-1 font-semibold">{student.student_number || "Not assigned"}</p></div>
            <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-blue-100">School username</p><p className="mt-1 font-semibold">{student.school_username || "Not assigned"}</p></div>
            <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-blue-100">Enrollment started</p><p className="mt-1 font-semibold">{dateLabel(student.joined_at || student.created_at)}</p></div>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Award className="h-4 w-4" />Published academic rank</div><p className="mt-2 text-2xl font-bold text-slate-900">{latestRank ? "#" + latestRank.rank_position : "—"}</p><p className="mt-1 text-xs text-slate-500">{latestRank ? termName(latestRank.term_id) + " · " + latestRank.subject_name : "No published rank available"}</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><TrendingUp className="h-4 w-4" />Latest published average</div><p className="mt-2 text-2xl font-bold text-slate-900">{latestAverage === null ? "—" : numberLabel(latestAverage) + "%"}</p><p className="mt-1 text-xs text-slate-500">Published term result only</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><CalendarCheck className="h-4 w-4" />Attendance rate</div><p className="mt-2 text-2xl font-bold text-slate-900">{attendanceRate === null ? "—" : attendanceRate + "%"}</p><p className="mt-1 text-xs text-slate-500">{attendanceMarked} recorded attendance entries</p></div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-medium text-slate-500"><CreditCard className="h-4 w-4" />Outstanding fees</div><p className="mt-2 text-lg font-bold text-slate-900">{Object.keys(balanceByCurrency).length ? Object.entries(balanceByCurrency).map(([currency, amount]) => currency + " " + amount.toLocaleString()).join(" · ") : "No invoices"}</p><p className="mt-1 text-xs text-slate-500">Balances kept separate by currency</p></div>
        </div>
      </section>
      {errors.length > 0 && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Some student records could not be loaded.</p><ul className="mt-1 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {([
          ["academic", "Academic record"], ["attendance", "Attendance"], ["homework", "Homework"], ["finance", "Fees"], ["history", "Enrollment history"],
        ] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key} className={"rounded-lg px-4 py-2 text-sm font-semibold " + (tab === key ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>{label}</button>)}
      </div>
      {tab === "academic" && <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Published term results" description="Academic ranks are shown only when the result has been published by the school's authorized workflow.">
          {publishedResults.length ? <div className="space-y-2">{publishedResults.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.subject_name}</p><p className="mt-1 text-xs text-slate-500">{termName(item.term_id)} · {dateLabel(item.published_at)}</p></div><div className="text-right"><p className="font-bold text-slate-900">{numberLabel(item.average_score)}%</p><p className="text-xs text-slate-500">Rank #{item.rank_position} · {item.letter_grade || "No letter"}</p></div></div>)}</div> : <SchoolEmptyState title="No published academic results" description="Published term results and class ranks will appear here once the school releases them." />}
        </SchoolPanel>
        <SchoolPanel title="Assessment marks" description="Individual marks recorded by teachers. An empty list does not imply missing or failed work.">
          {marks.length ? <div className="space-y-2">{marks.map((item) => { const assessment = assessments[item.assessment_id]; return <div key={item.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-800">{assessment?.title || "Assessment"}</p><SchoolStatus value={item.status || "recorded"} /></div><p className="mt-1 text-sm text-slate-600">{assessment?.subject_name || "Subject not recorded"} · Score {numberLabel(item.score)}{assessment?.max_score ? " / " + numberLabel(assessment.max_score) : ""}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(item.created_at)}{item.teacher_note ? " · " + item.teacher_note : ""}</p></div>; })}</div> : <SchoolEmptyState title="No assessment marks recorded" description="Marks entered by teachers will appear here." />}
        </SchoolPanel>
      </div>}
      {tab === "attendance" && <SchoolPanel title="Attendance history" description="Present and late entries count as attended; excused absences remain separately identified.">
        {attendance.length ? <div className="space-y-2">{attendance.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div><p className="text-sm font-semibold text-slate-800">{dateLabel(attendanceDates[item.session_id] || item.created_at)}</p>{item.note && <p className="mt-1 text-xs text-slate-500">{item.note}</p>}</div><SchoolStatus value={item.attendance_status} /></div>)}</div> : <SchoolEmptyState title="No attendance records" description="Attendance entries recorded for this student will appear here." />}
      </SchoolPanel>}
      {tab === "homework" && <SchoolPanel title="Homework submissions" description="Submission status, recorded grades, and teacher feedback. Submission text and private attachments are not exposed in this summary.">
        {homework.length ? <div className="space-y-2">{homework.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">Homework submission</p><SchoolStatus value={item.status || "submitted"} /></div><p className="mt-1 text-xs text-slate-500">Submitted {dateLabel(item.submitted_at)} · Graded {dateLabel(item.graded_at)} · Grade {numberLabel(item.grade)}</p>{item.feedback && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.feedback}</p>}</div>)}</div> : <SchoolEmptyState title="No homework submissions" description="Student submissions will appear here when recorded." />}
      </SchoolPanel>}
      {tab === "finance" && <SchoolPanel title="Student invoices" description="Amounts and balances are shown in their original currencies.">
        {invoices.length ? <div className="space-y-2">{invoices.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div><p className="text-sm font-semibold text-slate-800">{item.invoice_number || item.description || "Invoice"}</p><p className="mt-1 text-xs text-slate-500">Due {dateLabel(item.due_date)} · {item.currency || "ETB"} {numberLabel(item.amount)} · Paid {numberLabel(item.paid_amount)}</p></div><div className="text-right"><SchoolStatus value={item.status || "unpaid"} /><p className="mt-1 text-sm font-semibold text-slate-900">Balance {item.currency || "ETB"} {numberLabel(item.balance)}</p></div></div>)}</div> : <SchoolEmptyState title="No student invoices" description="Invoices linked to this student membership will appear here." />}
      </SchoolPanel>}
      {tab === "history" && <SchoolPanel title="Enrollment and membership history" description="Lifecycle events are retained so previous placements and enrollment exits can be reviewed.">
        {history.length ? <div className="space-y-2">{history.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold capitalize text-slate-800">{String(item.event_type).replace(/_/g, " ")}</p><span className="text-xs text-slate-500">{dateLabel(item.created_at)}</span></div><pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-600">{JSON.stringify(item.details || {}, null, 2)}</pre></div>)}</div> : <SchoolEmptyState title="No lifecycle events" description="Recorded enrollment and placement changes will appear here." />}
      </SchoolPanel>}
      <div className="flex justify-end"><SchoolSecondaryButton onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{loading ? "Refreshing…" : "Refresh student records"}</SchoolSecondaryButton></div>
      <p className="text-xs text-slate-400"><BookOpen className="mr-1 inline h-3.5 w-3.5" />Student records are read-only in this profile. Enrollment changes and other authorized actions remain in the directory and their dedicated workflows.</p>
    </div>
  );
}
