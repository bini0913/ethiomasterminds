import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, BookOpen, ClipboardCheck, Layers, Users, CalendarDays,
  RefreshCw, GraduationCap, Network, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import { useSchoolLeadership } from "@/components/school/SchoolLeadershipGate";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton,
} from "@/components/school/SchoolPortalPrimitives";

type Page = "overview" | "divisions" | "assessments" | "curriculum" | "leadership";

const divisions = [
  { id: "kg", label: "KG", coverage: "Nursery through KG 2" },
  { id: "elementary", label: "Elementary", coverage: "Grades 1–6" },
  { id: "middle_school", label: "Middle School", coverage: "Grades 7–8" },
  { id: "high_school", label: "High School", coverage: "Grades 9–12" },
] as const;

const divisionLabel = (value: string | null) =>
  divisions.find((division) => division.id === value)?.label || "Unmapped";

export default function AcademicDirectorPortal() {
  const { activeSchool } = useSchoolPortal();
  const { appointment, membership } = useSchoolLeadership();
  const db = supabase as any;
  const schoolId = activeSchool?.id;
  const permissions = useMemo(() => new Set(appointment.permissions || []), [appointment.permissions]);
  const can = (permission: string) => permissions.has(permission);

  const [page, setPage] = useState<Page>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [assessments, setAssessments] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    const requests: Record<string, Promise<any>> = {
      mappings: db.from("school_division_grade_mappings")
        .select("id,division_scope,grade_label")
        .eq("school_id", schoolId)
        .order("grade_label"),
    };
    if (can("view_students") || can("view_staff")) {
      requests.members = db.from("school_memberships")
        .select("id,user_id,school_role,status,grade_label,section_id,school_username")
        .eq("school_id", schoolId)
        .eq("status", "active");
    }
    if (can("view_students") || can("view_curriculum") || can("view_academics") || can("review_assessments") || can("review_results") || can("view_attendance")) {
      requests.sections = db.from("school_sections")
        .select("id,grade_label,section_name")
        .eq("school_id", schoolId)
        .order("grade_label");
    }
    if (can("view_academics") || can("review_assessments")) {
      requests.assessments = db.from("school_assessments")
        .select("id,title,subject_name,section_id,status,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(500);
      requests.homework = db.from("school_homework_assignments")
        .select("id,title,section_id,subject_name,due_at,status,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(500);
    }
    if (can("review_results")) {
      requests.marks = db.from("school_student_marks")
        .select("id,assessment_id,student_membership_id,score,status")
        .eq("school_id", schoolId)
        .limit(2000);
    }
    if (can("view_attendance")) {
      requests.attendanceSessions = db.from("school_attendance_sessions")
        .select("id,section_id,attendance_date,status")
        .eq("school_id", schoolId)
        .order("attendance_date", { ascending: false })
        .limit(500);
      requests.attendanceRecords = db.from("school_attendance_records")
        .select("id,session_id,attendance_status")
        .eq("school_id", schoolId)
        .limit(5000);
    }
    if (can("view_staff")) {
      requests.leaders = db.from("school_leadership_appointments")
        .select("id,membership_id,position,division_scope,team_name,status,start_date,end_date")
        .eq("school_id", schoolId)
        .in("position", ["kg_director", "elementary_director", "middle_school_director", "high_school_director", "vice_director", "team_leader"])
        .eq("status", "active")
        .order("position");
    }

    const entries = await Promise.all(Object.entries(requests).map(async ([key, request]) => [key, await request] as const));
    const results = Object.fromEntries(entries) as Record<string, any>;
    const failed = Object.entries(results).find(([, result]) => result.error);
    if (failed) {
      setError(failed[1].error.message || "Academic records could not be loaded.");
      setLoading(false);
      return;
    }
    if (results.mappings) setMappings(results.mappings.data ?? []);
    if (results.sections) setSections(results.sections.data ?? []);
    if (results.members) setMembers(results.members.data ?? []);
    if (results.assessments) setAssessments(results.assessments.data ?? []);
    if (results.homework) setHomework(results.homework.data ?? []);
    if (results.marks) setMarks(results.marks.data ?? []);
    if (results.attendanceSessions) setAttendanceSessions(results.attendanceSessions.data ?? []);
    if (results.attendanceRecords) setAttendanceRecords(results.attendanceRecords.data ?? []);
    if (results.leaders) setLeaders(results.leaders.data ?? []);

    const userIds = [...new Set((results.members?.data ?? []).map((item: any) => item.user_id))];
    if (userIds.length) {
      const { data, error: profileError } = await db.from("profiles").select("id,name,username").in("id", userIds);
      if (!profileError) setProfiles(Object.fromEntries((data ?? []).map((profile: any) => [profile.id, profile])));
    }
    setLoading(false);
  }, [schoolId, appointment.id, appointment.permissions]);

  useEffect(() => { void load(); }, [load]);

  const gradeDivision = useMemo(() => new Map(mappings.map((item) => [item.grade_label, item.division_scope])), [mappings]);
  const memberName = (membershipId: string) => {
    const member = members.find((item) => item.id === membershipId);
    return member ? profiles[member.user_id]?.name || member.school_username || "School member" : "School member";
  };
  const section = (sectionId: string | null) => sections.find((item) => item.id === sectionId);
  const sectionDivision = (sectionId: string | null) => {
    const row = section(sectionId);
    return row ? gradeDivision.get(row.grade_label) || null : null;
  };
  const students = members.filter((item) => item.school_role === "student");
  const teachers = members.filter((item) => item.school_role === "teacher");
  const pendingAssessments = assessments.filter((item) => item.status === "submitted");
  const pendingHomework = homework.filter((item) => item.status === "pending");

  const reviewAssessment = async (id: string, approve: boolean) => {
    const { error: rpcError } = await db.rpc("school_review_assessment", {
      p_assessment_id: id,
      p_approve: approve,
      p_feedback: feedback[id] || null,
    });
    if (rpcError) return toast.error(rpcError.message || "Assessment review failed.");
    toast.success(approve ? "Assessment and submitted marks approved." : "Assessment returned to the teacher.");
    await load();
  };
  const reviewHomework = async (id: string, approve: boolean) => {
    const { error: rpcError } = await db.rpc("school_review_homework", {
      p_homework_id: id,
      p_approved: approve,
      p_feedback: feedback[id] || null,
    });
    if (rpcError) return toast.error(rpcError.message || "Homework review failed.");
    toast.success(approve ? "Homework approved." : "Homework returned to the teacher.");
    await load();
  };

  const navItems: SchoolNavItem[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    ...(can("view_academics") || can("review_assessments") || can("review_results") ? [{ id: "assessments", label: "Academic Oversight", icon: ClipboardCheck }] : []),
    ...(can("view_curriculum") ? [{ id: "curriculum", label: "Curriculum & Coverage", icon: BookOpen }] : []),
    ...(can("view_students") || can("view_staff") ? [{ id: "divisions", label: "Division Performance", icon: Layers }] : []),
    ...(can("view_staff") ? [{ id: "leadership", label: "Division Directors", icon: Network }] : []),
  ];

  const divisionStats = divisions.map((division) => {
    const gradeLabels = new Set(mappings.filter((item) => item.division_scope === division.id).map((item) => item.grade_label));
    const divisionStudents = students.filter((item) => gradeLabels.has(item.grade_label));
    const divisionTeachers = teachers.filter((item) =>
      gradeLabels.has(item.grade_label) || (item.school_role === "teacher" && !item.grade_label && false)
    );
    const divisionAssessments = assessments.filter((item) => sectionDivision(item.section_id) === division.id);
    const divisionHomework = homework.filter((item) => sectionDivision(item.section_id) === division.id);
    const divisionMarks = marks.filter((mark) => {
      const assessment = assessments.find((item) => item.id === mark.assessment_id);
      return assessment && sectionDivision(assessment.section_id) === division.id;
    });
    const divisionSessions = attendanceSessions.filter((item) => sectionDivision(item.section_id) === division.id);
    return {
      ...division,
      gradeLabels: [...gradeLabels],
      students: divisionStudents.length,
      teachers: divisionTeachers.length,
      assessments: divisionAssessments.length,
      homework: divisionHomework.length,
      approvedMarks: divisionMarks.filter((item) => item.status === "approved").length,
      pendingReviews: divisionAssessments.filter((item) => item.status === "submitted").length + divisionHomework.filter((item) => item.status === "pending").length,
      attendanceSessions: divisionSessions.length,
    };
  });

  const renderOverview = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Academic Director" description="School-wide academic leadership across KG, Elementary, Middle School and High School." action={<SchoolSecondaryButton onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      {!mappings.length && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No grade-to-division mappings are configured yet. Academic records remain governed by the school's actual mappings; ask the School Manager to complete them before relying on cross-division comparisons.</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-slate-500">Loading school academic records…</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {can("view_students") && <SchoolMetric label="Students in scope" value={students.length} detail="Active memberships in mapped grades" icon={Users} />}
        {can("view_staff") && <SchoolMetric label="Teachers in scope" value={teachers.length} detail="Visible under academic staff permissions" icon={GraduationCap} />}
        {can("review_assessments") && <SchoolMetric label="Pending academic reviews" value={pendingAssessments.length + pendingHomework.length} detail="Submitted assessments and pending homework" icon={ClipboardCheck} />}
        {can("view_attendance") && <SchoolMetric label="Attendance sessions" value={attendanceSessions.length} detail={`${attendanceRecords.length} visible attendance records`} icon={CalendarDays} />}
      </div>
      <SchoolPanel title="Four-division academic overview" description="Counts are calculated from records visible under this appointment and the school's configured grade mappings.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {divisionStats.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500">{item.coverage}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {can("view_students") && <div><p className="text-lg font-semibold tabular-nums">{item.students}</p><p className="text-[11px] text-slate-500">Students</p></div>}
                {can("review_assessments") && <div><p className="text-lg font-semibold tabular-nums">{item.pendingReviews}</p><p className="text-[11px] text-slate-500">Pending reviews</p></div>}
                {can("view_academics") && <div><p className="text-lg font-semibold tabular-nums">{item.assessments}</p><p className="text-[11px] text-slate-500">Assessments</p></div>}
                {can("view_attendance") && <div><p className="text-lg font-semibold tabular-nums">{item.attendanceSessions}</p><p className="text-[11px] text-slate-500">Attendance sessions</p></div>}
              </div>
              <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">{item.gradeLabels.length ? item.gradeLabels.join(" · ") : "No grades mapped"}</p>
            </div>
          ))}
        </div>
      </SchoolPanel>
      <SchoolPanel title="Academic Director's responsibilities" description="Coordinate the four Division Directors and maintain consistent learning standards across the school.">
        <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li className="rounded-md bg-slate-50 p-3">Review curriculum coverage and academic progress across all mapped grades.</li>
          <li className="rounded-md bg-slate-50 p-3">Review submitted assessments, homework and examination results where permission is granted.</li>
          <li className="rounded-md bg-slate-50 p-3">Coordinate KG, Elementary, Middle School and High School Directors.</li>
          <li className="rounded-md bg-slate-50 p-3">Report school-wide academic issues and recommendations to the School Manager.</li>
        </ul>
      </SchoolPanel>
    </div>
  );

  const renderDivisions = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Division performance" description="Compare academic activity across the four divisions without mixing their underlying grade scopes." />
      <div className="grid gap-3 xl:grid-cols-2">
        {divisionStats.map((item) => (
          <SchoolPanel key={item.id} title={item.label} description={item.coverage}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {can("view_students") && <SchoolMetric label="Students" value={item.students} icon={Users} />}
              {can("view_staff") && <SchoolMetric label="Teachers" value={item.teachers} icon={GraduationCap} />}
              {can("view_academics") && <SchoolMetric label="Assessments" value={item.assessments} icon={ClipboardCheck} />}
              {can("view_academics") && <SchoolMetric label="Homework" value={item.homework} icon={BookOpen} />}
              {can("review_results") && <SchoolMetric label="Approved marks" value={item.approvedMarks} icon={CheckCircle2} />}
              {can("review_assessments") && <SchoolMetric label="Pending reviews" value={item.pendingReviews} icon={CalendarDays} />}
            </div>
            <p className="mt-3 text-xs text-slate-500">Mapped grades: {item.gradeLabels.length ? item.gradeLabels.join(", ") : "None configured"}</p>
          </SchoolPanel>
        ))}
      </div>
    </div>
  );

  const renderAssessments = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Academic oversight" description="Review academic work submitted by teachers across the four mapped divisions." />
      {can("review_assessments") && (
        <>
          <SchoolPanel title="Submitted assessments" description="Approving an assessment also approves its submitted marks through the existing guarded review workflow.">
            {pendingAssessments.length ? <div className="space-y-3">{pendingAssessments.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject_name} · {section(item.section_id)?.grade_label || "Unmapped grade"} · {divisionLabel(sectionDivision(item.section_id))}</p></div><SchoolStatus value={item.status} /></div>
                <input value={feedback[item.id] || ""} onChange={(event) => setFeedback((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Optional review feedback" className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
                <div className="mt-3 flex flex-wrap gap-2"><SchoolPrimaryButton onClick={() => void reviewAssessment(item.id, true)}>Approve assessment</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewAssessment(item.id, false)}>Return to teacher</SchoolSecondaryButton></div>
              </div>
            ))}</div> : <SchoolEmptyState title="No submitted assessments" description="Submitted teacher assessments will appear here when they are within your appointment scope." />}
          </SchoolPanel>
          <SchoolPanel title="Pending homework" description="Review homework assignments and return them to teachers with feedback when needed.">
            {pendingHomework.length ? <div className="space-y-3">{pendingHomework.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject_name} · {section(item.section_id)?.grade_label || "Unmapped grade"} · {divisionLabel(sectionDivision(item.section_id))}</p></div><SchoolStatus value={item.status} /></div>
                <input value={feedback[item.id] || ""} onChange={(event) => setFeedback((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Optional review feedback" className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
                <div className="mt-3 flex flex-wrap gap-2"><SchoolPrimaryButton onClick={() => void reviewHomework(item.id, true)}>Approve homework</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewHomework(item.id, false)}>Return to teacher</SchoolSecondaryButton></div>
              </div>
            ))}</div> : <SchoolEmptyState title="No pending homework" description="Homework awaiting academic review will appear here." />}
          </SchoolPanel>
        </>
      )}
      {can("review_results") && <SchoolPanel title="Examination results" description="Read-only visibility of marks already entered in the school assessment workflow.">
        {marks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Assessment</th><th className="pb-2">Division</th><th className="pb-2">Student</th><th className="pb-2">Score</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{marks.slice(0, 300).map((mark) => { const assessment = assessments.find((item) => item.id === mark.assessment_id); const student = members.find((item) => item.id === mark.student_membership_id); return <tr key={mark.id}><td className="py-2">{assessment?.title || "Assessment"}</td><td className="py-2">{divisionLabel(sectionDivision(assessment?.section_id || null))}</td><td className="py-2">{student ? memberName(student.id) : "Student"}</td><td className="py-2 tabular-nums">{mark.score ?? "—"}</td><td className="py-2"><SchoolStatus value={mark.status} /></td></tr>; })}</tbody></table></div> : <SchoolEmptyState title="No examination marks available" description="Marks will appear here when teachers submit them and your appointment has result-review access." />}
      </SchoolPanel>}
    </div>
  );

  const renderCurriculum = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Curriculum and grade coverage" description="Use the school's own grade-to-division mapping and section records. Unmapped grades are not assigned to a division automatically." />
      <SchoolPanel title="Configured grade coverage" description="These mappings are managed by the School Manager.">
        {mappings.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{divisions.map((division) => {
          const grades = mappings.filter((item) => item.division_scope === division.id);
          return <div key={division.id} className="rounded-lg border border-slate-200 p-3"><p className="text-sm font-semibold">{division.label}</p><p className="mt-1 text-xs text-slate-500">{division.coverage}</p><div className="mt-3 flex flex-wrap gap-1.5">{grades.length ? grades.map((grade) => <span key={grade.id} className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">{grade.grade_label}</span>) : <span className="text-xs text-slate-500">No grades mapped</span>}</div></div>;
        })}</div> : <SchoolEmptyState title="No grade mappings configured" description="Ask the School Manager to map the school's actual grade labels to the four divisions." />}
      </SchoolPanel>
      <SchoolPanel title="Section coverage" description="Sections visible through your academic permissions.">
        {sections.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Grade</th><th className="pb-2">Section</th><th className="pb-2">Division</th></tr></thead><tbody className="divide-y divide-slate-100">{sections.map((item) => <tr key={item.id}><td className="py-2">{item.grade_label}</td><td className="py-2">{item.section_name}</td><td className="py-2">{divisionLabel(gradeDivision.get(item.grade_label) || null)}</td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No sections visible" description="Sections appear when they are configured and your appointment has curriculum or student visibility." />}
      </SchoolPanel>
    </div>
  );

  const renderLeadership = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Division Directors" description="Coordinate the appointed Directors responsible for each division. Appointment and permission changes remain with the School Manager." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {divisions.map((division) => {
          const director = leaders.find((item) => item.position === `${division.id === "middle_school" ? "middle_school" : division.id}_director` && item.division_scope === division.id);
          const vice = leaders.find((item) => item.position === "vice_director" && item.division_scope === division.id);
          return <SchoolPanel key={division.id} title={division.label} description={division.coverage}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Division Director</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{director ? memberName(director.membership_id) : "Position vacant"}</p>
            <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vice Director</p><p className="mt-1 text-sm font-semibold text-slate-900">{vice ? memberName(vice.membership_id) : "Position vacant"}</p></div>
            <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team Leaders</p>{leaders.filter((item) => item.position === "team_leader" && item.division_scope === division.id).map((item) => <p key={item.id} className="mt-1 text-sm text-slate-700">{memberName(item.membership_id)} · {item.team_name}</p>)}</div>
          </SchoolPanel>;
        })}
      </div>
    </div>
  );

  const content = page === "overview" ? renderOverview()
    : page === "divisions" ? renderDivisions()
      : page === "assessments" ? renderAssessments()
        : page === "curriculum" ? renderCurriculum()
          : renderLeadership();

  return <SchoolPortalShell role={membership.school_role} roleLabelOverride="Academic Director" title="Academic Director Portal" navItems={navItems} activeItem={page} onNavigate={(id) => setPage(id as Page)}>
    {content}
  </SchoolPortalShell>;
}
