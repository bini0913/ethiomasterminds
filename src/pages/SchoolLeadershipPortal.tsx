import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, UserCog, CalendarCheck, ClipboardCheck,
  ClipboardList, FileBarChart, RefreshCw, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import { useSchoolLeadership } from "@/components/school/SchoolLeadershipGate";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import SchoolAdminPortal from "@/pages/SchoolAdminPortal";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
} from "@/components/school/SchoolPortalPrimitives";

const positionLabels: Record<string, string> = {
  main_director: "Main Director",
  vice_director: "Vice Director",
  kg_director: "KG Director",
  elementary_director: "Elementary Director",
  middle_school_director: "Middle School Director",
  high_school_director: "High School Director",
  team_leader: "Team Leader",
};

type LeadershipPage = "overview" | "students" | "staff" | "attendance" | "academics" | "tasks" | "reports";

export default function SchoolLeadershipPortal() {
  const { appointment } = useSchoolLeadership();
  if (appointment.position === "main_director") return <SchoolAdminPortal />;
  return <ScopedLeadershipWorkspace />;
}

function ScopedLeadershipWorkspace() {
  const { activeSchool } = useSchoolPortal();
  const { appointment, membership } = useSchoolLeadership();
  const db = supabase as any;
  const schoolId = activeSchool?.id;
  const permissions = useMemo(() => new Set(appointment.permissions || []), [appointment.permissions]);
  const can = (permission: string) => permissions.has(permission);
  const title = positionLabels[appointment.position] || "School Leader";
  const scopeLabel = appointment.position === "team_leader"
    ? (appointment.team_name || "Assigned team")
    : appointment.division_scope
      ? appointment.division_scope.replace(/_/g, " ")
      : "Whole school";

  const navItems: SchoolNavItem[] = useMemo(() => {
    const items: SchoolNavItem[] = [{ id: "overview", label: "Overview", icon: LayoutDashboard }];
    if (can("view_students")) items.push({ id: "students", label: "Students", icon: Users });
    if (can("view_staff")) items.push({ id: "staff", label: "Staff & Teachers", icon: UserCog });
    if (can("view_attendance")) items.push({ id: "attendance", label: "Attendance", icon: CalendarCheck });
    if (can("view_academics") || can("review_assessments") || can("review_results") || can("view_curriculum")) {
      items.push({ id: "academics", label: "Academic Oversight", icon: ClipboardCheck });
    }
    if (can("manage_team_tasks") || can("assign_team_tasks")) {
      items.push({ id: "tasks", label: "Team Tasks", icon: ClipboardList });
    }
    if (can("view_reports")) items.push({ id: "reports", label: "Reports", icon: FileBarChart });
    return items;
  }, [appointment.permissions]);

  const [page, setPage] = useState<LeadershipPage>("overview");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [sections, setSections] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    setLoadError(null);
    const requests: Record<string, Promise<any>> = {};
    if (can("view_students") || can("view_staff")) {
      requests.members = db.from("school_memberships")
        .select("id,user_id,school_role,status,grade_label,section_id,school_username")
        .eq("school_id", schoolId)
        .eq("status", "active")
        .order("created_at", { ascending: false });
    }
    if (can("view_students") || can("view_curriculum") || can("view_academics") || can("review_assessments")) {
      requests.sections = db.from("school_sections")
        .select("id,grade_label,section_name")
        .eq("school_id", schoolId)
        .order("grade_label");
    }
    if (can("view_attendance")) {
      requests.sessions = db.from("school_attendance_sessions")
        .select("id,section_id,attendance_date,status")
        .eq("school_id", schoolId)
        .order("attendance_date", { ascending: false })
        .limit(100);
      requests.attendance = db.from("school_attendance_records")
        .select("id,session_id,student_membership_id,attendance_status")
        .eq("school_id", schoolId)
        .limit(1000);
    }
    if (can("view_academics") || can("review_assessments") || can("review_results")) {
      requests.assessments = db.from("school_assessments")
        .select("id,title,subject_name,section_id,status,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(100);
      requests.homework = db.from("school_homework_assignments")
        .select("id,title,section_id,subject_name,due_at,status,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(100);
    }
    if (can("manage_team_tasks") || can("assign_team_tasks")) {
      requests.tasks = db.from("school_staff_tasks")
        .select("id,title,assigned_to_membership_id,status,due_date,priority,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(100);
    }

    const entries = await Promise.all(Object.entries(requests).map(async ([key, request]) => [key, await request] as const));
    const results = Object.fromEntries(entries) as Record<string, any>;
    const failed = Object.values(results).find((result) => result.error);
    if (failed?.error) {
      setLoadError(failed.error.message || "Some school records could not be loaded.");
      setLoading(false);
      return;
    }
    if (results.members) setMembers(results.members.data ?? []);
    if (results.sections) setSections(results.sections.data ?? []);
    if (results.sessions) setAttendanceSessions(results.sessions.data ?? []);
    if (results.attendance) setAttendanceRecords(results.attendance.data ?? []);
    if (results.assessments) setAssessments(results.assessments.data ?? []);
    if (results.homework) setHomework(results.homework.data ?? []);
    if (results.tasks) setTasks(results.tasks.data ?? []);

    const userIds = [...new Set((results.members?.data ?? []).map((member: any) => member.user_id))];
    if (userIds.length) {
      const { data, error } = await db.from("profiles").select("id,name,username").in("id", userIds);
      if (!error) setProfiles(Object.fromEntries((data ?? []).map((profile: any) => [profile.id, profile])));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [schoolId, appointment.id]);

  const memberName = (memberId: string) => {
    const item = members.find((member) => member.id === memberId);
    return item ? profiles[item.user_id]?.name || item.school_username || "School member" : "School member";
  };
  const sectionName = (sectionId: string | null) => {
    const section = sections.find((item) => item.id === sectionId);
    return section ? `${section.grade_label} · ${section.section_name}` : "—";
  };
  const activeStudents = members.filter((member) => member.school_role === "student");
  const activeStaff = members.filter((member) => ["teacher", "admin", "finance"].includes(member.school_role));
  const pendingAssessments = assessments.filter((item) => item.status === "submitted");
  const today = new Date().toLocaleDateString("en-CA");
  const todaySessions = attendanceSessions.filter((session) => session.attendance_date === today);

  const renderOverview = () => (
    <div className="space-y-5">
      <SchoolPageHeading title={title} description={`${activeSchool?.name || "School"} · ${scopeLabel} · Your appointment is limited to its assigned permissions and school scope.`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {can("view_students") && <SchoolMetric label="Students in scope" value={activeStudents.length} detail="Active student memberships visible to your appointment" icon={Users} />}
        {can("view_staff") && <SchoolMetric label="Staff in scope" value={activeStaff.length} detail="Active staff memberships visible to your appointment" icon={UserCog} />}
        {can("view_attendance") && <SchoolMetric label="Today's attendance sessions" value={todaySessions.length} detail="Sessions in your authorized scope" icon={CalendarCheck} />}
        {(can("view_academics") || can("review_assessments")) && <SchoolMetric label="Pending assessments" value={pendingAssessments.length} detail="Submissions awaiting academic review" icon={ClipboardCheck} />}
        {(can("manage_team_tasks") || can("assign_team_tasks")) && <SchoolMetric label="Team tasks" value={tasks.length} detail="Tasks visible to your assigned team or division" icon={ClipboardList} />}
      </div>
      <SchoolPanel title="Leadership appointment">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-slate-500">Position</p><p className="mt-1 text-sm font-semibold capitalize text-slate-900">{title}</p></div>
          <div><p className="text-xs text-slate-500">Scope</p><p className="mt-1 text-sm font-semibold capitalize text-slate-900">{scopeLabel}</p></div>
          <div><p className="text-xs text-slate-500">Start date</p><p className="mt-1 text-sm font-medium text-slate-800">{appointment.start_date}</p></div>
          <div><p className="text-xs text-slate-500">End date</p><p className="mt-1 text-sm font-medium text-slate-800">{appointment.end_date || "No scheduled end date"}</p></div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Granted permissions</p>
          <div className="flex flex-wrap gap-2">{(appointment.permissions || []).map((permission) => <span key={permission} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{permission.replace(/_/g, " ")}</span>)}</div>
        </div>
      </SchoolPanel>
      <SchoolPanel title="Scope and access">
        <p className="text-sm leading-6 text-slate-600">Your workspace only displays records the school database authorizes for this appointment. Division Directors are restricted to their mapped grades. Team Leaders are restricted to their assigned team and linked sections. The School Manager controls appointments and permissions.</p>
      </SchoolPanel>
    </div>
  );

  const renderStudents = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Students" description={`Student records visible within your ${scopeLabel} appointment.`} />
      <SchoolPanel title="Student directory">
        {activeStudents.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Grade</th><th className="pb-2">Section</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{activeStudents.map((student) => <tr key={student.id}><td className="py-3 font-medium text-slate-800">{memberName(student.id)}</td><td className="py-3 text-slate-600">{student.grade_label || "—"}</td><td className="py-3 text-slate-600">{sectionName(student.section_id)}</td><td className="py-3"><SchoolStatus value={student.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No students in this scope" description="Student records will appear when they are assigned to grades or sections within your authorized scope." />}
      </SchoolPanel>
    </div>
  );

  const renderStaff = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Staff and teachers" description="Staff memberships visible to your division or assigned Team Leader scope." />
      <SchoolPanel title="Staff directory">
        {activeStaff.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Name</th><th className="pb-2">School role</th><th className="pb-2">Grade</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{activeStaff.map((member) => <tr key={member.id}><td className="py-3 font-medium text-slate-800">{memberName(member.id)}</td><td className="py-3 capitalize text-slate-600">{member.school_role}</td><td className="py-3 text-slate-600">{member.grade_label || "—"}</td><td className="py-3"><SchoolStatus value={member.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No staff in this scope" description="Staff assignments within your authorized scope will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Attendance oversight" description="Attendance sessions and records from the grades or team your appointment covers." />
      <div className="grid gap-3 sm:grid-cols-4">{["present", "absent", "late", "excused"].map((status) => <SchoolMetric key={status} label={status} value={attendanceRecords.filter((record) => record.attendance_status === status).length} detail="Visible attendance records" icon={CalendarCheck} />)}</div>
      <SchoolPanel title="Recent attendance sessions">
        {attendanceSessions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Date</th><th className="pb-2">Section</th><th className="pb-2">Records</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{attendanceSessions.map((session) => <tr key={session.id}><td className="py-3 text-slate-700">{session.attendance_date}</td><td className="py-3 text-slate-600">{sectionName(session.section_id)}</td><td className="py-3 text-slate-600">{attendanceRecords.filter((record) => record.session_id === session.id).length}</td><td className="py-3"><SchoolStatus value={session.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No attendance sessions" description="Attendance records will appear here when teachers submit them." />}
      </SchoolPanel>
    </div>
  );

  const renderAcademics = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Academic oversight" description="Assessment and homework progress within your authorized school scope." />
      <SchoolPanel title="Assessment submissions">
        {assessments.length ? <div className="space-y-2">{assessments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject_name} · {sectionName(item.section_id)}</p></div><SchoolStatus value={item.status} /></div>)}</div> : <SchoolEmptyState title="No assessments in scope" description="Teacher assessment submissions will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Homework oversight">
        {homework.length ? <div className="space-y-2">{homework.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject_name} · {sectionName(item.section_id)} · Due {item.due_at ? new Date(item.due_at).toLocaleDateString() : "—"}</p></div><SchoolStatus value={item.status} /></div>)}</div> : <SchoolEmptyState title="No homework records in scope" description="Homework assignments will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Team tasks" description="Work assigned to staff members within your leadership team or division." />
      <SchoolPanel title="Task register">
        {tasks.length ? <div className="space-y-2">{tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-semibold text-slate-800">{task.title}</p><p className="mt-1 text-xs text-slate-500">{memberName(task.assigned_to_membership_id)} · Due {task.due_date || "Not set"}</p></div><SchoolStatus value={task.status} /></div>)}</div> : <SchoolEmptyState title="No team tasks" description="Tasks assigned within your scope will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Reports" description="Operational indicators calculated from records visible to your appointment." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {can("view_students") && <SchoolMetric label="Students" value={activeStudents.length} detail="Visible active students" icon={Users} />}
        {can("view_staff") && <SchoolMetric label="Staff" value={activeStaff.length} detail="Visible active staff" icon={UserCog} />}
        {can("view_attendance") && <SchoolMetric label="Attendance records" value={attendanceRecords.length} detail="Visible records" icon={CalendarCheck} />}
        {(can("view_academics") || can("review_assessments")) && <SchoolMetric label="Assessments" value={assessments.length} detail="Visible submissions" icon={ClipboardCheck} />}
      </div>
      <SchoolPanel title="Reporting boundary"><p className="text-sm leading-6 text-slate-600">These figures are scoped to the records your appointment can read. They are not school-wide totals unless your appointment covers the whole school.</p></SchoolPanel>
    </div>
  );

  let content: React.ReactNode;
  switch (page) {
    case "students": content = can("view_students") ? renderStudents() : renderOverview(); break;
    case "staff": content = can("view_staff") ? renderStaff() : renderOverview(); break;
    case "attendance": content = can("view_attendance") ? renderAttendance() : renderOverview(); break;
    case "academics": content = can("view_academics") || can("review_assessments") || can("review_results") || can("view_curriculum") ? renderAcademics() : renderOverview(); break;
    case "tasks": content = can("manage_team_tasks") || can("assign_team_tasks") ? renderTasks() : renderOverview(); break;
    case "reports": content = can("view_reports") ? renderReports() : renderOverview(); break;
    default: content = renderOverview();
  }

  return (
    <SchoolPortalShell
      role={membership.school_role}
      roleLabelOverride={title}
      title={title}
      navItems={navItems}
      activeItem={page}
      onNavigate={(next) => setPage(next as LeadershipPage)}
      headerActions={<button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button>}
    >
      {loading && <div className="mb-3 text-xs text-slate-500">Refreshing authorized school records…</div>}
      {loadError && <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{loadError}</div>}
      {content}
      <div className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Read access is enforced by school-level row policies. This workspace does not grant permissions beyond the appointment issued by the School Manager.</div>
    </SchoolPortalShell>
  );
}
