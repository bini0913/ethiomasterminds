import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Users, ClipboardCheck, GraduationCap, CalendarCheck,
  ShieldCheck, Megaphone, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import SchoolBulkStudentEnrollment from "@/components/school/SchoolBulkStudentEnrollment";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton,
} from "@/components/school/SchoolPortalPrimitives";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "enrollment", label: "Student Enrollment", icon: Users },
  { id: "assessments", label: "Assessment Review", icon: ClipboardCheck },
  { id: "results", label: "Results & Publishing", icon: GraduationCap },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "behavior", label: "Behavior Review", icon: ShieldCheck },
  { id: "announcements", label: "Announcements", icon: Megaphone },
];

export default function SchoolAdminPortal() {
  const { activeSchool, activeMembership } = useSchoolPortal();
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [sections, setSections] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [behaviorReports, setBehaviorReports] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const db = supabase as any;
  const schoolId = activeSchool?.id;

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const results = await Promise.all([
      db.from("school_memberships")
        .select("id,user_id,school_role,status,grade_label,section_id,school_username,created_at")
        .eq("school_id", schoolId).order("created_at", { ascending: false }),
      db.from("school_sections")
        .select("id,academic_year_id,grade_label,section_name")
        .eq("school_id", schoolId).order("grade_label"),
      db.from("school_terms")
        .select("id,name,term_number,academic_year_id,starts_on,ends_on")
        .eq("school_id", schoolId).order("term_number"),
      db.from("school_assessments")
        .select("id,title,subject_name,section_id,term_id,max_score,status,created_at,review_feedback")
        .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_attendance_sessions")
        .select("id,section_id,attendance_date,status,submitted_at,created_at")
        .eq("school_id", schoolId).order("attendance_date", { ascending: false }).limit(60),
      db.from("school_behavior_reports")
        .select("id,student_membership_id,section_id,report_type,severity,description,status,created_at,review_note")
        .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_announcements")
        .select("id,title,audience_type,grade_label,section_id,status,created_at,review_feedback")
        .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
    ]);

    const failed = results.find((result: any) => result.error);
    if (failed?.error) {
      toast.error(failed.error.message || "Could not load school administration records.");
      setLoading(false);
      return;
    }

    const [membersRes, sectionsRes, termsRes, assessmentsRes, attendanceRes, behaviorRes, announcementsRes] = results;
    const nextMembers = membersRes.data ?? [];
    setMembers(nextMembers);
    setSections(sectionsRes.data ?? []);
    setTerms(termsRes.data ?? []);
    setAssessments(assessmentsRes.data ?? []);
    setAttendanceSessions(attendanceRes.data ?? []);
    setBehaviorReports(behaviorRes.data ?? []);
    setAnnouncements(announcementsRes.data ?? []);

    const userIds = [...new Set(nextMembers.map((member: any) => member.user_id))];
    if (userIds.length) {
      const { data: profileRows, error: profileError } = await db.from("profiles")
        .select("id,name,username").in("id", userIds);
      if (profileError) toast.error("Some school member names could not be loaded.");
      setProfiles(Object.fromEntries((profileRows ?? []).map((profile: any) => [profile.id, profile])));
    } else {
      setProfiles({});
    }

    setSelectedTermId((current) => current || termsRes.data?.[0]?.id || "");
    setLoading(false);
  }, [schoolId, db]);

  useEffect(() => { void load(); }, [load]);

  const activeMembers = members.filter((member) => member.status === "active");
  const students = activeMembers.filter((member) => member.school_role === "student");
  const teachers = activeMembers.filter((member) => member.school_role === "teacher");
  const parents = activeMembers.filter((member) => member.school_role === "parent");
  const pendingAssessments = assessments.filter((item) => item.status === "submitted");
  const pendingBehavior = behaviorReports.filter((item) => item.status === "pending");
  const pendingAnnouncements = announcements.filter((item) => item.status === "pending");

  const memberName = (membershipId: string) => {
    const member = members.find((item) => item.id === membershipId);
    return member ? (profiles[member.user_id]?.name || member.school_username || "School member") : "Unknown member";
  };
  const sectionLabel = (sectionId: string | null) => {
    const section = sections.find((item) => item.id === sectionId);
    return section ? `${section.grade_label} ${section.section_name}` : "—";
  };

  const runRpc = async (rpc: string, args: Record<string, unknown>, success: string, id?: string) => {
    setBusyId(id || rpc);
    const { data, error } = await db.rpc(rpc, args);
    setBusyId(null);
    if (error) {
      toast.error(error.message || "The operation could not be completed.");
      return null;
    }
    toast.success(success);
    await load();
    return data;
  };

  const reviewAssessment = (id: string, approved: boolean) =>
    runRpc("school_review_assessment", {
      p_assessment_id: id, p_approve: approved, p_feedback: null,
    }, approved ? "Assessment approved and marks verified." : "Assessment returned to the teacher.", id);

  const reviewBehavior = (id: string, approved: boolean) =>
    runRpc("school_review_behavior_report", {
      p_report_id: id, p_approve: approved, p_review_note: null,
    }, approved ? "Behavior report approved." : "Behavior report rejected.", id);

  const reviewAnnouncement = (id: string, approved: boolean) =>
    runRpc("school_review_announcement", {
      p_announcement_id: id, p_approved: approved, p_feedback: null,
    }, approved ? "Announcement published." : "Announcement rejected.", id);

  const renderOverview = () => (
    <div className="space-y-6">
      <SchoolPageHeading title="School administration" description="Daily academic operations, enrollment, assessment approval, attendance oversight, and parent communication." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Enrolled students" value={students.length} detail="Active school memberships" icon={Users} />
        <SchoolMetric label="Teachers" value={teachers.length} detail="Active teaching accounts" icon={GraduationCap} />
        <SchoolMetric label="Pending assessments" value={pendingAssessments.length} detail="Awaiting Admin verification" icon={ClipboardCheck} />
        <SchoolMetric label="Pending behavior reports" value={pendingBehavior.length} detail="Awaiting review" icon={ShieldCheck} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Items requiring attention">
          <div className="space-y-3 text-sm">
            <button type="button" onClick={() => setPage("assessments")} className="flex w-full items-center justify-between rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50">
              <span className="font-medium text-slate-700">Assessment approvals</span><span className="font-semibold tabular-nums text-slate-900">{pendingAssessments.length}</span>
            </button>
            <button type="button" onClick={() => setPage("behavior")} className="flex w-full items-center justify-between rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50">
              <span className="font-medium text-slate-700">Behavior reports</span><span className="font-semibold tabular-nums text-slate-900">{pendingBehavior.length}</span>
            </button>
            <button type="button" onClick={() => setPage("announcements")} className="flex w-full items-center justify-between rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50">
              <span className="font-medium text-slate-700">Announcement approvals</span><span className="font-semibold tabular-nums text-slate-900">{pendingAnnouncements.length}</span>
            </button>
          </div>
        </SchoolPanel>
        <SchoolPanel title="School structure" description="Live enrollment by grade">
          {students.length ? <div className="space-y-3">{Object.entries(students.reduce((totals: Record<string, number>, student: any) => {
            const grade = student.grade_label || "Unassigned";
            totals[grade] = (totals[grade] || 0) + 1;
            return totals;
          }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([grade, count]) => (
            <div key={grade} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-medium text-slate-700">{grade}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Number(count) / Math.max(1, students.length) * 100)}%` }} /></div>
              <span className="w-8 text-right text-sm tabular-nums text-slate-600">{count}</span>
            </div>
          ))}</div> : <SchoolEmptyState title="No enrolled students" description="Student enrollment totals appear here after school accounts are created." />}
        </SchoolPanel>
      </div>
    </div>
  );

  const renderAssessments = () => (
    <div className="space-y-4">
      <SchoolPageHeading title="Assessment review" description="Verify teacher-created assessments and submitted marks before they become official." />
      <SchoolPanel title="Assessments" description="Only submitted assessments can be approved or rejected.">
        {assessments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Assessment</th><th className="pb-2">Class</th><th className="pb-2">Subject</th><th className="pb-2">Maximum</th><th className="pb-2">Status</th><th className="pb-2">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{assessments.map((item) => <tr key={item.id}>
            <td className="py-3"><p className="font-medium text-slate-800">{item.title}</p><p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</p></td>
            <td className="py-3 text-slate-600">{sectionLabel(item.section_id)}</td><td className="py-3 text-slate-600">{item.subject_name}</td>
            <td className="py-3 tabular-nums text-slate-600">{item.max_score}</td><td className="py-3"><SchoolStatus value={item.status} /></td>
            <td className="py-3"><div className="flex gap-2">{item.status === "submitted" ? <>
              <SchoolPrimaryButton disabled={busyId === item.id} onClick={() => void reviewAssessment(item.id, true)}>Approve</SchoolPrimaryButton>
              <SchoolSecondaryButton disabled={busyId === item.id} onClick={() => void reviewAssessment(item.id, false)}>Reject</SchoolSecondaryButton>
            </> : <span className="text-xs text-slate-400">No action</span>}</div></td>
          </tr>)}</tbody>
        </table></div> : <SchoolEmptyState title="No assessments yet" description="Teacher-created assessments will appear here when submitted for review." />}
      </SchoolPanel>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-4">
      <SchoolPageHeading title="Results and publishing" description="Calculate official term results and publish them to linked students and parents." />
      <SchoolPanel title="Term result workflow">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 space-y-1.5"><span className="text-xs font-semibold text-slate-600">Academic term</span>
            <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={selectedTermId} onChange={(event) => setSelectedTermId(event.target.value)}>
              <option value="">Choose term</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name} · Term {term.term_number}</option>)}
            </select>
          </label>
          <SchoolPrimaryButton disabled={!selectedTermId || busyId === "school_calculate_term_results"} onClick={() => void runRpc("school_calculate_term_results", { p_term_id: selectedTermId }, "Term results calculated.", "school_calculate_term_results")}>Calculate results</SchoolPrimaryButton>
          <SchoolSecondaryButton disabled={!selectedTermId || busyId === "school_publish_term_results"} onClick={() => void runRpc("school_publish_term_results", { p_term_id: selectedTermId }, "Official results published.", "school_publish_term_results")}>Publish results</SchoolSecondaryButton>
        </div>
        <p className="mt-3 text-xs text-slate-500">The database checks grading weights, missing marks, and incomplete subjects before publishing. Published results trigger parent notifications.</p>
      </SchoolPanel>
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-4">
      <SchoolPageHeading title="Attendance oversight" description="Review submitted attendance sessions recorded by assigned homeroom teachers." />
      <SchoolPanel title="Recent attendance sessions">
        {attendanceSessions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Date</th><th className="pb-2">Section</th><th className="pb-2">Status</th><th className="pb-2">Submitted</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{attendanceSessions.map((session) => <tr key={session.id}><td className="py-3">{session.attendance_date}</td><td className="py-3">{sectionLabel(session.section_id)}</td><td className="py-3"><SchoolStatus value={session.status} /></td><td className="py-3 text-slate-500">{session.submitted_at ? new Date(session.submitted_at).toLocaleString() : "—"}</td></tr>)}</tbody>
        </table></div> : <SchoolEmptyState title="No attendance sessions" description="Homeroom teachers' attendance submissions will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderBehavior = () => (
    <div className="space-y-4">
      <SchoolPageHeading title="Behavior review" description="Review reports submitted by teachers and homeroom staff. Approved reports notify linked parents." />
      <SchoolPanel title="Behavior reports">
        {behaviorReports.length ? <div className="space-y-3">{behaviorReports.map((report) => <div key={report.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{memberName(report.student_membership_id)} · {report.report_type}</p><p className="mt-1 text-xs text-slate-500">{sectionLabel(report.section_id)} · {report.severity} · {new Date(report.created_at).toLocaleString()}</p></div><SchoolStatus value={report.status} /></div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{report.description}</p>
          {report.status === "pending" && <div className="mt-3 flex flex-wrap gap-2"><SchoolPrimaryButton disabled={busyId === report.id} onClick={() => void reviewBehavior(report.id, true)}>Approve</SchoolPrimaryButton><SchoolSecondaryButton disabled={busyId === report.id} onClick={() => void reviewBehavior(report.id, false)}>Reject</SchoolSecondaryButton></div>}
          {report.review_note && <p className="mt-2 text-xs text-slate-500">Review note: {report.review_note}</p>}
        </div>)}</div> : <SchoolEmptyState title="No behavior reports" description="Teacher-submitted behavior reports will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderAnnouncements = () => (
    <div className="space-y-4">
      <SchoolPageHeading title="Announcements" description="Review announcements submitted by teachers before they are sent to their intended school audience." />
      <SchoolPanel title="School announcements">
        {announcements.length ? <div className="space-y-3">{announcements.map((announcement) => <div key={announcement.id} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{announcement.title}</p><p className="mt-1 text-xs capitalize text-slate-500">{announcement.audience_type}{announcement.grade_label ? ` · ${announcement.grade_label}` : ""}{announcement.section_id ? ` · ${sectionLabel(announcement.section_id)}` : ""}</p></div><SchoolStatus value={announcement.status} /></div>
          {announcement.status === "pending" && <div className="mt-3 flex flex-wrap gap-2"><SchoolPrimaryButton disabled={busyId === announcement.id} onClick={() => void reviewAnnouncement(announcement.id, true)}>Publish</SchoolPrimaryButton><SchoolSecondaryButton disabled={busyId === announcement.id} onClick={() => void reviewAnnouncement(announcement.id, false)}>Reject</SchoolSecondaryButton></div>}
          {announcement.review_feedback && <p className="mt-2 text-xs text-slate-500">Feedback: {announcement.review_feedback}</p>}
        </div>)}</div> : <SchoolEmptyState title="No announcements" description="School announcements will appear here." />}
      </SchoolPanel>
    </div>
  );

  const content = ({
    overview: renderOverview,
    enrollment: () => <div className="space-y-4"><SchoolPageHeading title="Student enrollment" description="Create school student accounts and link parent accounts through the trusted provisioning service." /><SchoolBulkStudentEnrollment schoolId={schoolId || ""} sections={sections} parents={parents} memberName={memberName} onCreated={load} /></div>,
    assessments: renderAssessments,
    results: renderResults,
    attendance: renderAttendance,
    behavior: renderBehavior,
    announcements: renderAnnouncements,
  } as Record<string, () => React.ReactNode>)[page]?.() ?? renderOverview();

  return <SchoolPortalShell role="admin" title="School Admin Portal" navItems={navItems} activeItem={page} onNavigate={setPage} headerActions={<span className="hidden text-xs font-medium text-slate-500 sm:inline">{loading ? "Updating…" : `${activeMembers.length} active members`}</span>}>{content}</SchoolPortalShell>;
}
