import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SchoolEmptyState, SchoolField, SchoolMetric, SchoolPageHeading, SchoolPanel, SchoolStatus,
  SchoolSecondaryButton, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";

type Props = {
  schoolId?: string;
  sections: any[];
  years: any[];
  members: any[];
  profiles: Record<string, any>;
};

type SessionRow = {
  id: string;
  school_id: string;
  section_id: string;
  attendance_date: string;
  recorded_by_membership_id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
};

type AttendanceRow = {
  id: string;
  school_id: string;
  session_id: string;
  student_membership_id: string;
  attendance_status: "present" | "absent" | "late" | "excused";
  note: string | null;
  recorded_by_membership_id: string;
  created_at: string;
  updated_at: string;
};

const dateLabel = (value?: string | null) => value
  ? new Date(value + (value.length === 10 ? "T00:00:00" : "")).toLocaleDateString()
  : "—";

export default function SchoolManagerAttendanceWorkspace({ schoolId, sections, years, members, profiles }: Props) {
  const db = supabase as any;
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!schoolId) {
      setSessions([]);
      setRecords([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [sessionResult, recordResult] = await Promise.all([
        db.from("school_attendance_sessions")
          .select("id,school_id,section_id,attendance_date,recorded_by_membership_id,status,submitted_at,created_at")
          .eq("school_id", schoolId)
          .order("attendance_date", { ascending: false })
          .limit(1000),
        db.from("school_attendance_records")
          .select("id,school_id,session_id,student_membership_id,attendance_status,note,recorded_by_membership_id,created_at,updated_at")
          .eq("school_id", schoolId)
          .order("updated_at", { ascending: false })
          .limit(5000),
      ]);
      if (requestId !== requestSequence.current) return;
      if (sessionResult.error) throw new Error("Attendance sessions: " + sessionResult.error.message);
      if (recordResult.error) throw new Error("Attendance records: " + recordResult.error.message);
      const nextSessions = (sessionResult.data || []) as SessionRow[];
      setSessions(nextSessions);
      setRecords((recordResult.data || []) as AttendanceRow[]);
      setSelectedSessionId((current) => current && nextSessions.some((row) => row.id === current)
        ? current
        : nextSessions[0]?.id || null);
    } catch (cause) {
      if (requestId === requestSequence.current) {
        setError(cause instanceof Error ? cause.message : "Attendance records could not be loaded.");
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [db, schoolId]);

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const sectionById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);
  const recordGroups = useMemo(() => {
    const grouped = new Map<string, AttendanceRow[]>();
    records.forEach((record) => {
      const current = grouped.get(record.session_id) || [];
      current.push(record);
      grouped.set(record.session_id, current);
    });
    return grouped;
  }, [records]);

  const filteredSessions = useMemo(() => sessions.filter((session) => {
    const section = sectionById.get(session.section_id);
    const yearMatch = yearFilter === "all" || section?.academic_year_id === yearFilter;
    const gradeMatch = gradeFilter === "all" || section?.grade_label === gradeFilter;
    const sectionMatch = sectionFilter === "all" || session.section_id === sectionFilter;
    const statusMatch = statusFilter === "all" || session.status === statusFilter;
    const fromMatch = !dateFrom || session.attendance_date >= dateFrom;
    const toMatch = !dateTo || session.attendance_date <= dateTo;
    return yearMatch && gradeMatch && sectionMatch && statusMatch && fromMatch && toMatch;
  }), [sessions, sectionById, yearFilter, gradeFilter, sectionFilter, statusFilter, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const visibleIds = new Set(filteredSessions.map((session) => session.id));
    const visibleRecords = records.filter((record) => visibleIds.has(record.session_id));
    return {
      sessions: filteredSessions.length,
      submitted: filteredSessions.filter((session) => session.status === "submitted").length,
      open: filteredSessions.filter((session) => session.status === "open").length,
      absent: visibleRecords.filter((record) => record.attendance_status === "absent").length,
      late: visibleRecords.filter((record) => record.attendance_status === "late").length,
      excused: visibleRecords.filter((record) => record.attendance_status === "excused").length,
      present: visibleRecords.filter((record) => record.attendance_status === "present").length,
    };
  }, [filteredSessions, records]);

  const selectedSession = filteredSessions.find((session) => session.id === selectedSessionId)
    || filteredSessions[0] || null;
  const selectedRecords = selectedSession ? (recordGroups.get(selectedSession.id) || []) : [];
  const selectedSection = selectedSession ? sectionById.get(selectedSession.section_id) : null;
  const roster = selectedSession ? members.filter((member) =>
    member.school_role === "student"
    && member.section_id === selectedSession.section_id
    && ["active", "suspended"].includes(member.status)
  ) : [];
  const markedIds = new Set(selectedRecords.map((record) => record.student_membership_id));
  const missingStudents = roster.filter((student) => !markedIds.has(student.id));
  const recordCounts = {
    present: selectedRecords.filter((record) => record.attendance_status === "present").length,
    absent: selectedRecords.filter((record) => record.attendance_status === "absent").length,
    late: selectedRecords.filter((record) => record.attendance_status === "late").length,
    excused: selectedRecords.filter((record) => record.attendance_status === "excused").length,
  };
  const gradeOptions = [...new Set(sections.map((section) => section.grade_label).filter(Boolean))].sort();

  const personName = (membershipId: string) => {
    const member = memberById.get(membershipId);
    const profile = member ? profiles[member.user_id] || {} : {};
    return profile.name || member?.school_username || member?.student_number || "School member";
  };

  return (
    <div className="space-y-5">
      <SchoolPageHeading
        title="Attendance & daily operations"
        description="Monitor homeroom attendance submissions, absences, lateness, excused records, and students not yet marked. Corrections remain restricted to appointed leaders with review permission."
        action={<SchoolSecondaryButton onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh attendance</SchoolSecondaryButton>}
      />
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Attendance sessions" value={summary.sessions} detail="Within selected filters" icon={CalendarDays} />
        <SchoolMetric label="Submitted sessions" value={summary.submitted} detail="Submitted by homeroom teachers" icon={CheckCircle2} />
        <SchoolMetric label="Open sessions" value={summary.open} detail="Awaiting teacher submission" icon={Clock3} />
        <SchoolMetric label="Recorded absences" value={summary.absent} detail="Not the same as unmarked students" icon={AlertTriangle} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Present" value={summary.present} detail="Recorded present" icon={Users} />
        <SchoolMetric label="Late" value={summary.late} detail="Recorded late" icon={Clock3} />
        <SchoolMetric label="Excused" value={summary.excused} detail="Recorded excused" icon={CheckCircle2} />
        <SchoolMetric label="Not marked in selected session" value={missingStudents.length} detail="Compared with current section roster" icon={AlertTriangle} />
      </div>
      <SchoolPanel title="Filter attendance" description="All records are scoped to the active school. Filters affect the session list and summary totals.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SchoolField label="Academic year">
            <select className={schoolSelectClass} value={yearFilter} onChange={(event) => { setYearFilter(event.target.value); setSectionFilter("all"); }}>
              <option value="all">All academic years</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </SchoolField>
          <SchoolField label="Grade">
            <select className={schoolSelectClass} value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value); setSectionFilter("all"); }}>
              <option value="all">All grades</option>
              {gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
            </select>
          </SchoolField>
          <SchoolField label="Section">
            <select className={schoolSelectClass} value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
              <option value="all">All sections</option>
              {sections.filter((section) => (yearFilter === "all" || section.academic_year_id === yearFilter) && (gradeFilter === "all" || section.grade_label === gradeFilter)).map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}
            </select>
          </SchoolField>
          <SchoolField label="Session status">
            <select className={schoolSelectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option><option value="open">Open</option><option value="submitted">Submitted</option>
            </select>
          </SchoolField>
          <SchoolField label="From date"><input type="date" className={schoolSelectClass} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></SchoolField>
          <SchoolField label="To date"><input type="date" className={schoolSelectClass} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></SchoolField>
        </div>
      </SchoolPanel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <SchoolPanel title="Attendance sessions" description={loading ? "Refreshing school attendance…" : "Select a session to inspect its recorded attendance."}>
          {filteredSessions.length ? <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {filteredSessions.map((session) => {
              const section = sectionById.get(session.section_id);
              const rows = recordGroups.get(session.id) || [];
              const isSelected = selectedSession?.id === session.id;
              return <button key={session.id} type="button" onClick={() => setSelectedSessionId(session.id)} aria-pressed={isSelected} className={"w-full rounded-lg border p-3 text-left transition " + (isSelected ? "border-blue-300 bg-blue-50/60" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{section?.grade_label || "Grade"} {section?.section_name || "Section"}</span>
                  <SchoolStatus value={session.status} />
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <span>{dateLabel(session.attendance_date)} · {rows.length} marked</span>
                  <span>{rows.filter((row) => row.attendance_status === "absent").length} absent · {rows.filter((row) => row.attendance_status === "late").length} late</span>
                </div>
              </button>;
            })}
          </div> : <SchoolEmptyState title={loading ? "Loading attendance" : "No attendance sessions found"} description={loading ? "School attendance sessions are being loaded." : "Sessions recorded by homeroom teachers will appear here. Adjust filters if needed."} />}
        </SchoolPanel>
        <SchoolPanel title="Session details" description={selectedSession ? selectedSection ? selectedSection.grade_label + " " + selectedSection.section_name + " · " + dateLabel(selectedSession.attendance_date) : dateLabel(selectedSession.attendance_date) : "Choose a session from the list."}>
          {selectedSession ? <>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["present", "absent", "late", "excused"] as const).map((status) => <div key={status} className="rounded-md border border-slate-100 p-3"><p className="text-xs capitalize text-slate-500">{status}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{recordCounts[status]}</p></div>)}
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Session record</p>
              <p className="mt-2 text-sm text-slate-700">Status: <span className="font-medium capitalize">{selectedSession.status}</span></p>
              <p className="mt-1 text-sm text-slate-700">Recorded by: <span className="font-medium">{personName(selectedSession.recorded_by_membership_id)}</span></p>
              <p className="mt-1 text-sm text-slate-700">Submitted: <span className="font-medium">{selectedSession.submitted_at ? new Date(selectedSession.submitted_at).toLocaleString() : "Not submitted"}</span></p>
              <p className="mt-1 text-sm text-slate-700">Marked students: <span className="font-medium">{selectedRecords.length} / {roster.length}</span></p>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-sm font-semibold text-slate-800">Students not yet marked ({missingStudents.length})</p>
              {missingStudents.length ? <div className="mt-2 divide-y divide-slate-100">{missingStudents.map((student) => <div key={student.id} className="py-2 text-sm text-slate-700">{personName(student.id)} <span className="ml-1 text-xs text-slate-400">{student.student_number || student.school_username || ""}</span></div>)}</div> : <p className="mt-2 text-xs text-slate-500">Every current active or suspended student in this section has an attendance record.</p>}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-sm font-semibold text-slate-800">Attendance exceptions</p>
              {selectedRecords.filter((record) => record.attendance_status !== "present").length ? <div className="mt-2 divide-y divide-slate-100">{selectedRecords.filter((record) => record.attendance_status !== "present").map((record) => <div key={record.id} className="flex flex-wrap items-start justify-between gap-2 py-2"><div><p className="text-sm font-medium text-slate-800">{personName(record.student_membership_id)}</p>{record.note && <p className="mt-1 text-xs text-slate-500">{record.note}</p>}</div><SchoolStatus value={record.attendance_status} /></div>)}</div> : <p className="mt-2 text-xs text-slate-500">No absent, late, or excused records in this session.</p>}
            </div>
            <p className="mt-4 rounded-md border border-blue-100 bg-blue-50/60 p-3 text-xs leading-5 text-blue-900">This is a Manager oversight view. It does not edit teacher-submitted attendance. Corrections require an active leadership appointment with the appropriate attendance-review permission and a recorded reason.</p>
          </> : <SchoolEmptyState title="No session selected" description="Choose an attendance session to review its details." />}
        </SchoolPanel>
      </div>
    </div>
  );
}
