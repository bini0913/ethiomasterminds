import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, UserCog, CalendarCheck, ClipboardCheck,
  ClipboardList, FileBarChart, RefreshCw, ShieldCheck, Network, PanelsTopLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import { useSchoolLeadership } from "@/components/school/SchoolLeadershipGate";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import AcademicDirectorPortal from "@/pages/AcademicDirectorPortal";
import HRDirectorPortal from "@/pages/HRDirectorPortal";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
} from "@/components/school/SchoolPortalPrimitives";

const positionLabels: Record<string, string> = {
  academic_director: "Academic Director",
  hr_director: "HR Director / Business Manager",
  vice_director: "Vice Director",
  kg_director: "KG Director",
  elementary_director: "Elementary Director",
  middle_school_director: "Middle School Director",
  high_school_director: "High School Director",
  team_leader: "Team Leader",
};

type LeadershipPage = "overview" | "students" | "staff" | "attendance" | "academics" | "discipline" | "tasks" | "reports" | "leadership" | "sections" | "people";

export default function SchoolLeadershipPortal() {
  const { appointment } = useSchoolLeadership();
  if (appointment.position === "main_director") return <div className="mx-auto max-w-2xl p-8"><div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-semibold text-amber-900">This legacy school appointment is no longer used.</p><p className="mt-2 text-sm text-amber-800">Please contact the School Manager to receive the correct current school responsibility.</p></div></div>;
  if (appointment.position === "academic_director") return <AcademicDirectorPortal />;
  if (appointment.position === "hr_director") return <HRDirectorPortal />;
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
  const divisionDetails: Record<string, { coverage: string; grades: string }> = {
    kg: { coverage: "Nursery through KG 2", grades: "Nursery, KG 1 and KG 2" },
    elementary: { coverage: "Grades 1–6", grades: "Grades 1, 2, 3, 4, 5 and 6" },
    middle_school: { coverage: "Grades 7–8", grades: "Grades 7 and 8" },
    high_school: { coverage: "Grades 9–12", grades: "Grades 9, 10, 11 and 12" },
  };
  const isDivisionDirector = ["kg_director", "elementary_director", "middle_school_director", "high_school_director"].includes(appointment.position);
  const divisionInfo = appointment.division_scope ? divisionDetails[appointment.division_scope] : null;
  const divisionFocusCopy: Record<string, { heading: string; description: string; supportingText: string }> = {
    kg: {
      heading: "Early learning and care",
      description: `${activeSchool?.name || "School"} · KG Division · Nursery through KG 2. Coordinate early-learning groups, staff, attendance and student support within the grades mapped to your division.`,
      supportingText: "Use the school's configured Nursery, KG 1 and KG 2 labels. Counts below come only from live school records visible to your appointment.",
    },
    elementary: {
      heading: "Foundational learning",
      description: `${activeSchool?.name || "School"} · Elementary Division · Grades 1–6. Monitor foundational learning, classroom coverage, attendance and assessment progress across your mapped grades.`,
      supportingText: "Review actual class sections, assessment submissions and homework records for the elementary grades configured by the School Manager.",
    },
    middle_school: {
      heading: "Middle school progress",
      description: `${activeSchool?.name || "School"} · Middle School Division · Grades 7–8. Coordinate the middle-school team and monitor attendance, student support and subject assessment progress.`,
      supportingText: "Keep oversight focused on the school's mapped Grade 7 and Grade 8 sections and their real teaching and assessment records.",
    },
    high_school: {
      heading: "Secondary academic progress",
      description: `${activeSchool?.name || "School"} · High School Division · Grades 9–12. Monitor subject assessment progress, submitted results, attendance and teacher follow-through across your mapped grades.`,
      supportingText: "Use actual assessment, homework and mark records for Grades 9–12. Result visibility and review actions depend on the permissions granted by the School Manager.",
    },
  };
  const scopeLabel = appointment.position === "team_leader"
    ? (appointment.team_name || "Assigned team")
    : appointment.division_scope
      ? appointment.division_scope.replace(/_/g, " ")
      : "Whole school";

  const navItems: SchoolNavItem[] = useMemo(() => {
    const items: SchoolNavItem[] = [{ id: "overview", label: "Overview", icon: LayoutDashboard }];
    if (can("view_students")) items.push({ id: "students", label: "Students", icon: Users });
    if (can("view_staff")) items.push({ id: "staff", label: "Staff & Teachers", icon: UserCog });
    if (can("view_attendance") || can("review_attendance")) items.push({ id: "attendance", label: "Attendance", icon: CalendarCheck });
    if (can("view_academics") || can("review_assessments") || can("review_results") || can("view_curriculum")) {
      items.push({ id: "academics", label: "Academic Oversight", icon: ClipboardCheck });
    }
    if (can("view_discipline") || can("review_discipline")) items.push({ id: "discipline", label: "Student Support", icon: ShieldCheck });
    if (can("manage_team_tasks") || can("assign_team_tasks")) {
      items.push({ id: "tasks", label: "Team Tasks", icon: ClipboardList });
    }
    if (can("view_reports")) items.push({ id: "reports", label: "Reports", icon: FileBarChart });
    if (isDivisionDirector && can("view_staff")) items.push({ id: "leadership", label: "Division Leadership", icon: Network });
    if (isDivisionDirector && can("view_staff")) items.push({ id: "people", label: "Team & Teachers", icon: UserCog });
    if (isDivisionDirector) items.push({ id: "sections", label: "Class Sections", icon: PanelsTopLeft });
    return items;
  }, [appointment.permissions, isDivisionDirector]);

  const [page, setPage] = useState<LeadershipPage>("overview");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [divisionStaffName, setDivisionStaffName] = useState("");
  const [divisionStaffKind, setDivisionStaffKind] = useState<"teacher" | "team_leader">("teacher");
  const [divisionStaffSectionId, setDivisionStaffSectionId] = useState("");
  const [divisionStaffAssignmentKind, setDivisionStaffAssignmentKind] = useState<"subject" | "homeroom">("subject");
  const [divisionStaffSubject, setDivisionStaffSubject] = useState("");
  const [divisionStaffTeamName, setDivisionStaffTeamName] = useState("");
  const [divisionStaffTeamLeaderAppointmentId, setDivisionStaffTeamLeaderAppointmentId] = useState("");
  const [divisionStaffCredentials, setDivisionStaffCredentials] = useState<any>(null);
  const [divisionStaffCreating, setDivisionStaffCreating] = useState(false);
  const [divisionStaffError, setDivisionStaffError] = useState<string | null>(null);
  const [sectionAcademicYearId, setSectionAcademicYearId] = useState("");
  const [sectionGradeLabel, setSectionGradeLabel] = useState("");
  const [sectionCount, setSectionCount] = useState(1);
  const [sectionNamesText, setSectionNamesText] = useState("A");

  useEffect(() => {
    if (!sectionAcademicYearId || !sectionGradeLabel) return;
    const existingNames = sections
      .filter((section) => section.academic_year_id === sectionAcademicYearId && section.grade_label === sectionGradeLabel)
      .map((section) => section.section_name);
    if (existingNames.length) {
      setSectionCount(existingNames.length);
      setSectionNamesText(existingNames.join(", "));
    } else {
      setSectionCount(1);
      setSectionNamesText("A");
    }
  }, [sectionAcademicYearId, sectionGradeLabel, sections]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, { status: string; note: string; reason: string }>>({});
  const [assessments, setAssessments] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [behaviorReports, setBehaviorReports] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [divisionAppointments, setDivisionAppointments] = useState<any[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<any[]>([]);
  const [divisionGradeMappings, setDivisionGradeMappings] = useState<any[]>([]);
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({});
  const [taskTargetId, setTaskTargetId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    setLoadError(null);
    const requests: Record<string, Promise<any>> = {};
    if (can("view_students") || can("view_staff") || can("view_academics") || can("review_results") || can("manage_team_tasks") || can("assign_team_tasks")) {
      requests.members = db.from("school_memberships")
        .select("id,user_id,school_role,status,grade_label,section_id,school_username")
        .eq("school_id", schoolId)
        .eq("status", "active")
        .order("created_at", { ascending: false });
    }
    if (isDivisionDirector || can("view_students") || can("view_curriculum") || can("view_academics") || can("review_assessments") || can("review_results") || can("view_attendance") || can("review_attendance") || can("view_discipline") || can("review_discipline")) {
      requests.sections = db.from("school_sections")
        .select("id,academic_year_id,grade_label,section_name")
        .eq("school_id", schoolId)
        .order("grade_label");
    }
    if (can("view_attendance") || can("review_attendance")) {
      requests.sessions = db.from("school_attendance_sessions")
        .select("id,section_id,attendance_date,status")
        .eq("school_id", schoolId)
        .order("attendance_date", { ascending: false })
        .limit(100);
      requests.attendance = db.from("school_attendance_records")
        .select("id,session_id,student_membership_id,attendance_status,note")
        .eq("school_id", schoolId)
        .limit(1000);
    }
    if (can("view_academics") || can("review_assessments") || can("review_results")) {
      requests.assessments = db.from("school_assessments")
        .select("id,title,subject_name,section_id,status,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(100);
    }
    if (can("view_academics") || can("review_assessments")) {
      requests.homework = db.from("school_homework_assignments")
        .select("id,title,section_id,subject_name,due_at,status,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(100);
    }
    if (can("review_results")) {
      requests.marks = db.from("school_student_marks")
        .select("id,assessment_id,student_membership_id,score,status,teacher_note")
        .eq("school_id", schoolId)
        .limit(500);
    }
    if (isDivisionDirector) {
      requests.academicYears = db.from("school_academic_years")
        .select("id,name,is_current,starts_on,ends_on")
        .eq("school_id", schoolId)
        .eq("is_current", true)
        .order("starts_on", { ascending: false });
      requests.divisionGradeMappings = db.from("school_division_grade_mappings")
        .select("id,grade_label")
        .eq("school_id", schoolId)
        .eq("division_scope", appointment.division_scope)
        .order("grade_label");
      requests.subjects = db.from("school_subjects")
        .select("id,academic_year_id,grade_label,subject_name,active")
        .eq("school_id", schoolId)
        .eq("active", true)
        .order("grade_label");
      if (can("view_staff")) {
        requests.divisionAppointments = db.from("school_leadership_appointments")
          .select("id,membership_id,position,division_scope,team_name,status,start_date,end_date")
          .eq("school_id", schoolId)
          .eq("division_scope", appointment.division_scope)
          .in("position", ["vice_director", "team_leader"])
          .eq("status", "active")
          .order("position");
        requests.teamAssignments = db.from("school_leadership_team_members")
          .select("id,appointment_id,membership_id")
          .eq("school_id", schoolId);
      }
    }
    if (can("view_discipline") || can("review_discipline")) {
      requests.behavior = db.from("school_behavior_reports")
        .select("id,student_membership_id,section_id,report_type,severity,description,status,created_at")
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
    if (results.subjects) setSubjects(results.subjects.data ?? []);
    if (results.academicYears) {
      const currentYears = results.academicYears.data ?? [];
      setAcademicYears(currentYears);
      if (currentYears[0] && !currentYears.some((year: any) => year.id === sectionAcademicYearId)) setSectionAcademicYearId(currentYears[0].id);
    }
    if (results.sessions) setAttendanceSessions(results.sessions.data ?? []);
    if (results.attendance) setAttendanceRecords(results.attendance.data ?? []);
    if (results.assessments) setAssessments(results.assessments.data ?? []);
    if (results.homework) setHomework(results.homework.data ?? []);
    if (results.tasks) setTasks(results.tasks.data ?? []);
    if (results.behavior) setBehaviorReports(results.behavior.data ?? []);
    if (results.marks) setMarks(results.marks.data ?? []);
    if (results.divisionAppointments) setDivisionAppointments(results.divisionAppointments.data ?? []);
    if (results.teamAssignments) setTeamAssignments(results.teamAssignments.data ?? []);
    if (results.divisionGradeMappings) {
      const mappings = results.divisionGradeMappings.data ?? [];
      setDivisionGradeMappings(mappings);
      if (!sectionGradeLabel && mappings[0]) setSectionGradeLabel(mappings[0].grade_label);
      else if (sectionGradeLabel && !mappings.some((mapping: any) => mapping.grade_label === sectionGradeLabel)) setSectionGradeLabel(mappings[0]?.grade_label ?? "");
    }

    const userIds = [...new Set((results.members?.data ?? []).map((member: any) => member.user_id))];
    if (userIds.length) {
      const { data, error } = await db.from("profiles").select("id,name,username").in("id", userIds);
      if (!error) setProfiles(Object.fromEntries((data ?? []).map((profile: any) => [profile.id, profile])));
    }
    setLoading(false);
  };

  const createDivisionStaff = async (event: React.FormEvent) => {
    event.preventDefault(); setDivisionStaffError(null); setDivisionStaffCredentials(null);
    const section = sections.find((item) => item.id === divisionStaffSectionId);
    if (!divisionStaffName.trim()) return setDivisionStaffError("Enter the person’s full name.");
    if (divisionStaffKind === "teacher" && (!section || !divisionGradeMappings.some((mapping) => mapping.grade_label === section.grade_label))) return setDivisionStaffError("Choose a class section in your division.");
    if (divisionStaffKind === "teacher" && divisionStaffAssignmentKind === "subject" && !divisionStaffSubject) return setDivisionStaffError("Choose the subject this person will teach.");
    if (divisionStaffKind === "team_leader" && !divisionStaffTeamName.trim()) return setDivisionStaffError("Enter the team name.");
    setDivisionStaffCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("school-provision-account", { body: { action: "create_division_staff", school_id: schoolId, position: divisionStaffKind, name: divisionStaffName.trim(), section_id: divisionStaffKind === "teacher" ? section?.id : null, assignment_kind: divisionStaffKind === "teacher" ? divisionStaffAssignmentKind : null, subject_name: divisionStaffAssignmentKind === "homeroom" ? "Homeroom" : divisionStaffSubject, team_name: divisionStaffKind === "team_leader" ? divisionStaffTeamName.trim() : null, team_leader_appointment_id: divisionStaffKind === "teacher" ? (divisionStaffTeamLeaderAppointmentId || null) : null } });
      if (error || data?.error || !data?.created?.membership_id) return setDivisionStaffError(data?.error || error?.message || "The account could not be created.");
      setDivisionStaffCredentials(data.created); setDivisionStaffName(""); setDivisionStaffTeamName(""); setDivisionStaffSubject(""); setDivisionStaffTeamLeaderAppointmentId("");
      toast.success(divisionStaffKind === "team_leader" ? "Team Leader account created." : "Teacher account created."); await load();
    } catch (error: any) { setDivisionStaffError(error?.message || "The account could not be created."); }
    finally { setDivisionStaffCreating(false); }
  };

  const renderDivisionPeople = () => {
    const currentYearId = academicYears[0]?.id;
    const divisionSections = sections.filter((section) => divisionGradeMappings.some((mapping) => mapping.grade_label === section.grade_label) && (!currentYearId || section.academic_year_id === currentYearId));
    const leaderMembershipIds = new Set(divisionTeamLeaders.map((leader) => leader.membership_id));
    const divisionTeachers = members.filter((member) => member.school_role === "teacher" && !leaderMembershipIds.has(member.id));
    return <div className="space-y-5">
      <SchoolPageHeading title="Team & teachers" description={`Create the Team Leaders and Teachers who work in your ${divisionInfo?.coverage || scopeLabel} division.`} />
      <SchoolPanel title="Create a team member" description="Create a Team Leader with a team name, or a Teacher with a class and subject assignment. Login details appear once.">
        <form onSubmit={createDivisionStaff} className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">Account type<select value={divisionStaffKind} onChange={(event) => setDivisionStaffKind(event.target.value as "teacher" | "team_leader")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="teacher">Teacher</option><option value="team_leader">Team Leader</option></select></label>
          <label className="text-xs font-medium text-slate-600">Full name<input required value={divisionStaffName} onChange={(event) => setDivisionStaffName(event.target.value)} placeholder="Enter full name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800" /></label>
          {divisionStaffKind === "teacher" && !divisionSections.length && <p className="md:col-span-2 text-xs text-amber-700">Create your class sections first to add Teachers. You can still create a Team Leader now.</p>}
          {divisionStaffKind === "teacher" && <>
            <label className="text-xs font-medium text-slate-600">Class section<select required value={divisionStaffSectionId} onChange={(event) => { setDivisionStaffSectionId(event.target.value); setDivisionStaffSubject(""); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="">Choose a class</option>{divisionSections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} · {section.section_name}</option>)}</select></label>
            <label className="text-xs font-medium text-slate-600">Assignment<select value={divisionStaffAssignmentKind} onChange={(event) => setDivisionStaffAssignmentKind(event.target.value as "subject" | "homeroom")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="subject">Subject teacher</option><option value="homeroom">Homeroom teacher</option></select></label>
            {divisionStaffAssignmentKind === "subject" && <label className="text-xs font-medium text-slate-600">Subject<select required value={divisionStaffSubject} onChange={(event) => setDivisionStaffSubject(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="">Choose a subject</option>{subjects.filter((subject) => subject.grade_label === divisionSections.find((section) => section.id === divisionStaffSectionId)?.grade_label && subject.academic_year_id === currentYearId).map((subject) => <option key={subject.id} value={subject.subject_name}>{subject.subject_name}</option>)}</select></label>}
            <label className="text-xs font-medium text-slate-600">Team Leader (optional)<select value={divisionStaffTeamLeaderAppointmentId} onChange={(event) => setDivisionStaffTeamLeaderAppointmentId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"><option value="">No Team Leader assignment</option>{divisionTeamLeaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.team_name || "Team"} · {memberName(leader.membership_id)}</option>)}</select></label>
          </>}
          {divisionStaffKind === "team_leader" && <label className="text-xs font-medium text-slate-600">Team name<input required value={divisionStaffTeamName} onChange={(event) => setDivisionStaffTeamName(event.target.value)} placeholder="e.g. Grade 4 Team" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800" /></label>}
          {divisionStaffError && <p role="alert" className="md:col-span-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{divisionStaffError}</p>}
          <div className="md:col-span-2"><button disabled={divisionStaffCreating || (divisionStaffKind === "teacher" && !divisionSections.length)} type="submit" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{divisionStaffCreating ? "Creating account…" : `Create ${divisionStaffKind === "team_leader" ? "Team Leader" : "Teacher"}`}</button></div>
        </form>
        {divisionStaffCredentials && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-900">Account created — save these login details</p><div className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><p>Username: <strong>{divisionStaffCredentials.username}</strong></p><p>Temporary password: <strong>{divisionStaffCredentials.initial_password}</strong></p></div><p className="mt-2 text-xs text-emerald-800">Share these details privately. The person must change the temporary password after signing in. They are shown only once.</p></div>}
      </SchoolPanel>
      <SchoolPanel title="People in your division"><div className="divide-y divide-slate-100">{divisionTeamLeaders.map((leader) => <div key={leader.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{memberName(leader.membership_id)}</p><p className="text-xs text-slate-500">Team Leader · {leader.team_name || "Team"}</p></div><SchoolStatus value={leader.status} /></div>)}{divisionTeachers.map((teacher) => <div key={teacher.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{memberName(teacher.id)}</p><p className="text-xs text-slate-500">Teacher · {teacher.school_username}</p></div><SchoolStatus value={teacher.status} /></div>)}{!divisionTeamLeaders.length && !divisionTeachers.length && <SchoolEmptyState title="No team members yet" description="Create the first Teacher or Team Leader above." />}</div></SchoolPanel>
    </div>;
  };

  const createDivisionSections = async (event: React.FormEvent) => {
    event.preventDefault();
    const names = sectionNamesText.split(",").map((name) => name.trim()).filter(Boolean);
    if (!schoolId || !sectionAcademicYearId || !sectionGradeLabel) return toast.error("Choose the current academic year and one of your mapped grades.");
    if (names.length !== sectionCount) return toast.error(`Enter exactly ${sectionCount} section names, separated by commas.`);
    if (new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length) return toast.error("Section names must be unique.");
    const { data, error } = await db.rpc("school_division_director_create_sections", {
      p_school_id: schoolId,
      p_academic_year_id: sectionAcademicYearId,
      p_grade_label: sectionGradeLabel,
      p_section_names: names,
    });
    if (error) return toast.error(error.message || "The class sections could not be created.");
    toast.success(`${Number(data ?? 0)} new class section(s) created. Existing sections were kept.`);
    await load();
  };

  const reviewAttendance = async (recordId: string, currentStatus: string, currentNote: string | null) => {
    const draft = attendanceDrafts[recordId] || { status: currentStatus, note: currentNote || "", reason: "" };
    if (!draft.reason.trim()) return toast.error("Enter a reason for this attendance correction.");
    const { error } = await db.rpc("school_leadership_correct_attendance", {
      p_record_id: recordId,
      p_attendance_status: draft.status,
      p_note: draft.note,
      p_reason: draft.reason.trim(),
    });
    if (error) return toast.error(error.message || "Attendance correction was rejected.");
    toast.success("Attendance corrected and added to the leadership audit history.");
    setAttendanceDrafts((current) => {
      const next = { ...current };
      delete next[recordId];
      return next;
    });
    await load();
  };

  const reviewAssessment = async (assessmentId: string, approve: boolean) => {
    const { error } = await db.rpc("school_review_assessment", {
      p_assessment_id: assessmentId,
      p_approve: approve,
      p_feedback: reviewFeedback[assessmentId] || null,
    });
    if (error) return toast.error(error.message || "Assessment review failed.");
    toast.success(approve ? "Assessment and submitted marks approved." : "Assessment returned to the teacher.");
    await load();
  };

  const reviewHomework = async (homeworkId: string, approve: boolean) => {
    const { error } = await db.rpc("school_review_homework", {
      p_homework_id: homeworkId,
      p_approved: approve,
      p_feedback: reviewFeedback[homeworkId] || null,
    });
    if (error) return toast.error(error.message || "Homework review failed.");
    toast.success(approve ? "Homework approved." : "Homework returned to the teacher.");
    await load();
  };

  const reviewBehavior = async (reportId: string, approve: boolean) => {
    const { error } = await db.rpc("school_review_behavior_report", {
      p_report_id: reportId,
      p_approve: approve,
      p_review_note: reviewFeedback[reportId] || null,
    });
    if (error) return toast.error(error.message || "Student support review failed.");
    toast.success(approve ? "Behavior report approved." : "Behavior report rejected.");
    await load();
  };

  const reviewTeamTask = async (taskId: string, status: "verified" | "returned") => {
    const { error } = await db.from("school_staff_tasks")
      .update({ status })
      .eq("id", taskId)
      .eq("school_id", schoolId);
    if (error) return toast.error(error.message || "Task review failed.");
    toast.success(status === "verified" ? "Task verified." : "Task returned to the assigned teacher.");
    await load();
  };

  const createTeamTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskTargetId || !taskTitle.trim()) return toast.error("Choose a teacher and enter a task title.");
    const { error } = await db.from("school_staff_tasks").insert({
      school_id: schoolId,
      assigned_to_membership_id: taskTargetId,
      assigned_by_membership_id: membership.id,
      task_type: "academic",
      title: taskTitle.trim(),
      description: taskDescription.trim() || null,
      due_date: taskDueDate || null,
      priority: "normal",
    });
    if (error) return toast.error(error.message || "Task could not be assigned. Check that the teacher is in your assigned scope.");
    setTaskTargetId("");
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
    toast.success("Task assigned within your authorized leadership scope.");
    await load();
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
  const divisionViceDirector = divisionAppointments.find((item) => item.position === "vice_director");
  const divisionTeamLeaders = divisionAppointments.filter((item) => item.position === "team_leader");

  const renderClassSections = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Class sections" description={`Set the number of classes and name each section for grades in your ${divisionInfo?.coverage || scopeLabel} division.`} />
      <SchoolPanel title="Create class sections" description="Set the total number and names of sections for each grade assigned to your division. Existing sections must remain in your submitted list; the system never removes or moves students from a class.">
        {divisionGradeMappings.length && academicYears.length ? (
          <form onSubmit={createDivisionSections} className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">Academic year
              <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800" value={sectionAcademicYearId} onChange={(event) => setSectionAcademicYearId(event.target.value)}>
                {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">Grade
              <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800" value={sectionGradeLabel} onChange={(event) => setSectionGradeLabel(event.target.value)}>
                {divisionGradeMappings.map((mapping) => <option key={mapping.id} value={mapping.grade_label}>{mapping.grade_label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">Number of classes
              <input type="number" min={1} max={30} step={1} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800" value={sectionCount} onChange={(event) => { const count = Math.max(sections.filter((section) => section.academic_year_id === sectionAcademicYearId && section.grade_label === sectionGradeLabel).length, Math.min(30, Number(event.target.value) || 1)); const names = sectionNamesText.split(",").map((name) => name.trim()).filter(Boolean); while (names.length < count) { const index = names.length; const candidate = index < 26 ? String.fromCharCode(65 + index) : `A${index - 25}`; names.push(candidate); } setSectionCount(Math.min(30, count)); setSectionNamesText(names.slice(0, count).join(", ")); }} />
            </label>
            <label className="block text-xs font-medium text-slate-600">Section names (comma-separated)
              <input type="text" maxLength={400} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800" value={sectionNamesText} onChange={(event) => setSectionNamesText(event.target.value)} placeholder="A, B, C" />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <p className="text-xs leading-5 text-slate-500">Enter exactly {sectionCount} unique names. Existing sections are prefilled automatically; include all of them when adding new sections. Existing student and teacher links are never moved.</p>
              <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Create sections</button>
            </div>
          </form>
        ) : (
          <SchoolEmptyState title={!divisionGradeMappings.length ? "No grades mapped to this division" : "No current academic year"} description={!divisionGradeMappings.length ? "Ask the School Manager to map the grades belonging to your division before creating classes." : "Ask the School Manager to activate the academic year before creating class sections."} />
        )}
      </SchoolPanel>
      <SchoolPanel title="Sections in your division" description="Only sections belonging to your mapped grades are shown here.">
        <div className="space-y-3">
          {divisionGradeMappings.map((mapping) => {
            const gradeSections = sections.filter((section) => section.grade_label === mapping.grade_label && (!sectionAcademicYearId || section.academic_year_id === sectionAcademicYearId));
            return <div key={mapping.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{mapping.grade_label}</p><span className="text-xs text-slate-500">{gradeSections.length} {gradeSections.length === 1 ? "class" : "classes"}</span></div>
              <div className="mt-2 flex flex-wrap gap-2">{gradeSections.map((section) => <span key={section.id} className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{section.section_name}</span>)}</div>
              {!gradeSections.length && <p className="mt-2 text-xs text-slate-500">No classes configured for this grade yet.</p>}
            </div>;
          })}
        </div>
      </SchoolPanel>
    </div>
  );

  const renderDivisionLeadership = () => (
    <div className="space-y-5">
      <SchoolPageHeading
        title="Division leadership"
        description={`${title} · ${divisionInfo?.coverage || scopeLabel}. Review the leadership team and staff assignments within your division.`}
      />
      <SchoolPanel title="Division responsibility" description="This workspace is limited to the division assigned by the School Manager.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><p className="text-xs text-slate-500">Division</p><p className="mt-1 text-sm font-semibold capitalize text-slate-900">{appointment.division_scope?.replace(/_/g, " ")}</p></div>
          <div><p className="text-xs text-slate-500">Expected grade coverage</p><p className="mt-1 text-sm font-semibold text-slate-900">{divisionInfo?.grades || "School-configured grades"}</p></div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Actual school grade labels mapped to this division</p>
          {divisionGradeMappings.length
            ? <div className="flex flex-wrap gap-2">{divisionGradeMappings.map((mapping) => <span key={mapping.id} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">{mapping.grade_label}</span>)}</div>
            : <SchoolEmptyState title="No grades mapped yet" description="Ask the School Manager to map the school's configured grade labels to this division. No grade records are invented here." />}
        </div>
      </SchoolPanel>
      <SchoolPanel title="Leadership reporting line" description="The Division Director oversees the full division. The Vice Director and Team Leaders work under the Director's direction.">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Division Director</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{memberName(membership.id)}</p>
            <p className="mt-1 text-xs text-slate-600">You · {divisionInfo?.coverage || scopeLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vice Director</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{divisionViceDirector ? memberName(divisionViceDirector.membership_id) : "Position vacant"}</p>
            <p className="mt-1 text-xs text-slate-500">{divisionViceDirector ? "Active appointment" : "The School Manager can appoint an existing staff member."}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team Leaders</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{divisionTeamLeaders.length}</p>
            <p className="mt-1 text-xs text-slate-500">Active team leadership appointments</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {divisionTeamLeaders.map((leader) => {
            const assigned = teamAssignments.filter((item) => item.appointment_id === leader.id);
            return (
              <div key={leader.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{memberName(leader.membership_id)}</p>
                  <p className="mt-1 text-xs text-slate-500">{leader.team_name || "Assigned team"} · {assigned.length} assigned staff</p>
                </div>
                <SchoolStatus value={leader.status} />
              </div>
            );
          })}
          {!divisionTeamLeaders.length && <SchoolEmptyState title="No Team Leaders appointed" description="Team Leader appointments for this division will appear here when assigned by the School Manager." />}
        </div>
      </SchoolPanel>
      <SchoolPanel title="Division oversight boundaries">
        <p className="text-sm leading-6 text-slate-600">You oversee students, teachers, the Vice Director and Team Leaders within this division, subject to your granted permissions. The School Manager retains authority to appoint, suspend, replace and change leadership permissions. Cross-division academic policy remains under the Academic Director.</p>
      </SchoolPanel>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-5">
      <SchoolPageHeading
        title={isDivisionDirector ? `${title} · ${divisionInfo?.coverage || scopeLabel}` : title}
        description={isDivisionDirector
          ? divisionFocusCopy[appointment.division_scope || "elementary"].description
          : `${activeSchool?.name || "School"} · ${scopeLabel} · Your appointment is limited to its assigned permissions and school scope.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {can("view_students") && <SchoolMetric label="Students in scope" value={activeStudents.length} detail="Active student memberships visible to your appointment" icon={Users} />}
        {can("view_staff") && <SchoolMetric label="Staff in scope" value={activeStaff.length} detail="Active staff memberships visible to your appointment" icon={UserCog} />}
        {(can("view_attendance") || can("review_attendance")) && <SchoolMetric label="Today's attendance sessions" value={todaySessions.length} detail="Sessions in your authorized scope" icon={CalendarCheck} />}
        {(can("view_academics") || can("review_assessments")) && <SchoolMetric label="Pending assessments" value={pendingAssessments.length} detail="Submissions awaiting academic review" icon={ClipboardCheck} />}
        {(can("manage_team_tasks") || can("assign_team_tasks")) && <SchoolMetric label="Team tasks" value={tasks.length} detail="Tasks visible to your assigned team or division" icon={ClipboardList} />}
      </div>
      {isDivisionDirector && (
        <SchoolPanel
          title={divisionFocusCopy[appointment.division_scope || "elementary"].heading}
          description={divisionFocusCopy[appointment.division_scope || "elementary"].supportingText}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">Mapped grades</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{divisionGradeMappings.length}</p>
              <p className="mt-1 text-xs text-slate-500">{divisionGradeMappings.map((mapping) => mapping.grade_label).join(" · ") || "No grade mappings configured"}</p>
            </div>
            {(can("view_students") || can("view_curriculum") || can("view_academics")) && (
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs text-slate-500">Visible class sections</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{sections.length}</p>
                <p className="mt-1 text-xs text-slate-500">Configured sections in your division scope</p>
              </div>
            )}
            {(can("view_academics") || can("review_assessments")) && (
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs text-slate-500">Assessment submissions</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{assessments.length}</p>
                <p className="mt-1 text-xs text-slate-500">{pendingAssessments.length} awaiting review</p>
              </div>
            )}
            {(can("view_academics") || can("review_assessments")) && (
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs text-slate-500">Homework assignments</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{homework.length}</p>
                <p className="mt-1 text-xs text-slate-500">Existing assignments in the mapped grades</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {can("view_students") && <button onClick={() => setPage("students")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Student directory</button>}
            {can("view_staff") && <button onClick={() => setPage("staff")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Staff directory</button>}
            {(can("view_attendance") || can("review_attendance")) && <button onClick={() => setPage("attendance")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Attendance oversight</button>}
            {(can("view_academics") || can("review_assessments") || can("review_results")) && <button onClick={() => setPage("academics")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Academic oversight</button>}
            {(can("assign_team_tasks") || can("manage_team_tasks")) && <button onClick={() => setPage("tasks")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Team tasks</button>}
          </div>
        </SchoolPanel>
      )}
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
      {isDivisionDirector && can("view_staff") && <div>{renderDivisionLeadership()}</div>}
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
      {can("review_attendance") && <SchoolPanel title="Attendance corrections" description="Corrections require a reason and are written to the leadership audit history.">
        {attendanceRecords.length ? <div className="space-y-3">{attendanceRecords.slice(0, 50).map((record) => {
          const session = attendanceSessions.find((item) => item.id === record.session_id);
          const draft = attendanceDrafts[record.id] || { status: record.attendance_status, note: record.note || "", reason: "" };
          return <div key={record.id} className="rounded-lg border border-slate-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800">{memberName(record.student_membership_id)}</p><p className="mt-1 text-xs text-slate-500">{session?.attendance_date || "—"} · {sectionName(session?.section_id || null)}</p></div><SchoolStatus value={record.attendance_status} /></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">Attendance status<select value={draft.status} onChange={(event) => setAttendanceDrafts((current) => ({ ...current, [record.id]: { ...draft, status: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></label>
              <label className="text-xs font-medium text-slate-600">Attendance note<input value={draft.note} onChange={(event) => setAttendanceDrafts((current) => ({ ...current, [record.id]: { ...draft, note: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Optional note" /></label>
              <label className="text-xs font-medium text-slate-600 sm:col-span-2">Reason for correction<input value={draft.reason} onChange={(event) => setAttendanceDrafts((current) => ({ ...current, [record.id]: { ...draft, reason: event.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Required — explain why the original record is being corrected" /></label>
            </div>
            <div className="mt-3"><button onClick={() => void reviewAttendance(record.id, record.attendance_status, record.note)} disabled={draft.status === record.attendance_status && draft.note === (record.note || "")} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Save correction</button></div>
          </div>;
        })}</div> : <SchoolEmptyState title="No attendance records to correct" description="Records will appear here after teachers submit attendance." />}
      </SchoolPanel>}
    </div>
  );

  const renderAcademics = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Academic oversight" description="Assessment and homework progress within your authorized school scope." />
      <SchoolPanel title="Assessment submissions">
        {assessments.length ? <div className="space-y-2">{assessments.map((item) => <div key={item.id} className="rounded-lg border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject_name} · {sectionName(item.section_id)}</p></div><SchoolStatus value={item.status} /></div>{can("review_assessments") && item.status === "submitted" && <div className="mt-3 flex flex-col gap-2"><input value={reviewFeedback[item.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Optional review feedback" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /><div className="flex flex-wrap gap-2"><button onClick={() => void reviewAssessment(item.id, true)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Approve assessment</button><button onClick={() => void reviewAssessment(item.id, false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Return to teacher</button></div></div>}</div>)}</div> : <SchoolEmptyState title="No assessments in scope" description="Teacher assessment submissions will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Homework oversight">
        {homework.length ? <div className="space-y-2">{homework.map((item) => <div key={item.id} className="rounded-lg border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject_name} · {sectionName(item.section_id)} · Due {item.due_at ? new Date(item.due_at).toLocaleDateString() : "—"}</p></div><SchoolStatus value={item.status} /></div>{can("review_assessments") && item.status === "pending" && <div className="mt-3 flex flex-col gap-2"><input value={reviewFeedback[item.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Optional review feedback" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /><div className="flex flex-wrap gap-2"><button onClick={() => void reviewHomework(item.id, true)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Approve homework</button><button onClick={() => void reviewHomework(item.id, false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Return to teacher</button></div></div>}</div>)}</div> : <SchoolEmptyState title="No homework records in scope" description="Homework assignments will appear here." />}
      </SchoolPanel>
      {can("review_results") && <SchoolPanel title="Marks and results oversight" description="Marks visible to your appointment. Official calculation and publication remain with the authorized school administration workflow.">
        {marks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Assessment</th><th className="pb-2">Class</th><th className="pb-2">Score</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{marks.map((mark) => { const student = members.find((item) => item.id === mark.student_membership_id); const assessment = assessments.find((item) => item.id === mark.assessment_id); return <tr key={mark.id}><td className="py-3 font-medium text-slate-800">{memberName(mark.student_membership_id)}</td><td className="py-3 text-slate-600">{assessment?.title || "Assessment"}</td><td className="py-3 text-slate-600">{student?.grade_label || "—"}</td><td className="py-3 tabular-nums text-slate-700">{mark.score ?? "—"}</td><td className="py-3"><SchoolStatus value={mark.status} /></td></tr>; })}</tbody></table></div> : <SchoolEmptyState title="No marks available" description="Teacher-entered marks will appear here when records are available within your scope." />}
      </SchoolPanel>}

    </div>
  );

  const renderTasks = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Team tasks" description="Work assigned to staff members within your leadership team or division." />
      {can("assign_team_tasks") && <SchoolPanel title="Assign a team task">
        <form onSubmit={createTeamTask} className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">Teacher in your scope
            <select required value={taskTargetId} onChange={(event) => setTaskTargetId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">Choose teacher</option>{members.filter((member) => member.school_role === "teacher").map((member) => <option key={member.id} value={member.id}>{memberName(member.id)}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">Due date
            <input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600 sm:col-span-2">Task title
            <input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="e.g. Submit the weekly lesson coverage report" />
          </label>
          <label className="text-xs font-medium text-slate-600 sm:col-span-2">Instructions
            <textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2"><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Assign task</button></div>
        </form>
      </SchoolPanel>}
      <SchoolPanel title="Task register">
        {tasks.length ? <div className="space-y-2">{tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><div><p className="text-sm font-semibold text-slate-800">{task.title}</p><p className="mt-1 text-xs text-slate-500">{memberName(task.assigned_to_membership_id)} · Due {task.due_date || "Not set"}</p></div><div className="flex flex-wrap items-center gap-2"><SchoolStatus value={task.status} />{can("assign_team_tasks") && task.status === "submitted" && <><button onClick={() => void reviewTeamTask(task.id, "verified")} className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white">Verify</button><button onClick={() => void reviewTeamTask(task.id, "returned")} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700">Return</button></>}</div></div>)}</div> : <SchoolEmptyState title="No team tasks" description="Tasks assigned within your scope will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderDiscipline = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Student support" description="Behavior and student-support reports within your appointed scope." />
      <SchoolPanel title="Behavior reports">
        {behaviorReports.length ? <div className="space-y-3">{behaviorReports.map((report) => <div key={report.id} className="rounded-lg border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{memberName(report.student_membership_id)} · {report.report_type}</p><SchoolStatus value={report.status} /></div><p className="mt-1 text-xs text-slate-500">{sectionName(report.section_id)} · {report.severity} severity · {new Date(report.created_at).toLocaleDateString()}</p><p className="mt-2 text-sm text-slate-700">{report.description}</p>{can("review_discipline") && report.status === "pending" && <div className="mt-3 space-y-2"><input value={reviewFeedback[report.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Optional review note" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /><div className="flex flex-wrap gap-2"><button onClick={() => void reviewBehavior(report.id, true)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Approve report</button><button onClick={() => void reviewBehavior(report.id, false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Reject report</button></div></div>}</div>)}</div> : <SchoolEmptyState title="No student support reports" description="Teacher-submitted behavior reports will appear here." />}
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
    case "attendance": content = can("view_attendance") || can("review_attendance") ? renderAttendance() : renderOverview(); break;
    case "academics": content = can("view_academics") || can("review_assessments") || can("review_results") || can("view_curriculum") ? renderAcademics() : renderOverview(); break;
    case "discipline": content = can("view_discipline") || can("review_discipline") ? renderDiscipline() : renderOverview(); break;
    case "tasks": content = can("manage_team_tasks") || can("assign_team_tasks") ? renderTasks() : renderOverview(); break;
    case "reports": content = can("view_reports") ? renderReports() : renderOverview(); break;
    case "leadership": content = isDivisionDirector && can("view_staff") ? renderDivisionLeadership() : renderOverview(); break;
    case "people": content = isDivisionDirector && can("view_staff") ? renderDivisionPeople() : renderOverview(); break;
    case "sections": content = isDivisionDirector ? renderClassSections() : renderOverview(); break;
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
