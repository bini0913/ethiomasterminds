import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, BookOpen, ClipboardCheck, MessageSquare, Megaphone,
  RefreshCw, Users, CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField, schoolInputClass,
  schoolSelectClass, schoolTextareaClass,
} from "@/components/school/SchoolPortalPrimitives";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "classes", label: "My Classes", icon: Users },
  { id: "assessments", label: "Assessments & Marks", icon: ClipboardCheck },
  { id: "attendance", label: "Homeroom Attendance", icon: CalendarCheck },
  { id: "behavior", label: "Behavior Reports", icon: MessageSquare },
  { id: "announcements", label: "Class Announcements", icon: Megaphone },
];

export default function SchoolTeacherPortal() {
  const { activeSchool, activeMembership } = useSchoolPortal();
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [terms, setTerms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [behaviorReports, setBehaviorReports] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [markDrafts, setMarkDrafts] = useState<Record<string, string>>({});
  const [assessmentSectionId, setAssessmentSectionId] = useState("");
  const [assessmentSubject, setAssessmentSubject] = useState("");
  const [assessmentTermId, setAssessmentTermId] = useState("");
  const [assessmentCategoryId, setAssessmentCategoryId] = useState("");
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentInstructions, setAssessmentInstructions] = useState("");
  const [assessmentMaxScore, setAssessmentMaxScore] = useState("100");
  const [assessmentDueAt, setAssessmentDueAt] = useState("");
  const [behaviorStudentId, setBehaviorStudentId] = useState("");
  const [behaviorType, setBehaviorType] = useState("positive");
  const [behaviorSeverity, setBehaviorSeverity] = useState("low");
  const [behaviorDescription, setBehaviorDescription] = useState("");
  const [announcementSectionId, setAnnouncementSectionId] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [attendanceSectionId, setAttendanceSectionId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceSession, setAttendanceSession] = useState<any | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, string>>({});
  const db = supabase as any;
  const schoolId = activeSchool?.id;
  const teacherMembershipId = activeMembership?.id;

  const load = useCallback(async () => {
    if (!schoolId || !teacherMembershipId) return;
    setLoading(true);
    const assignmentRes = await db.from("school_teacher_assignments")
      .select("id,section_id,subject_name,assignment_kind")
      .eq("school_id", schoolId)
      .eq("teacher_membership_id", teacherMembershipId);
    if (assignmentRes.error) {
      toast.error(assignmentRes.error.message || "Could not load teacher assignments.");
      setLoading(false);
      return;
    }
    const nextAssignments = assignmentRes.data ?? [];
    setAssignments(nextAssignments);
    const sectionIds = [...new Set(nextAssignments.map((item: any) => item.section_id))];
    if (!sectionIds.length) {
      setSections([]); setStudents([]); setTerms([]); setCategories([]);
      setAssessments([]); setMarks([]); setAnnouncements([]); setBehaviorReports([]);
      setProfiles({}); setLoading(false); return;
    }

    const [sectionsRes, studentsRes, termsRes, assessmentsRes, announcementsRes, behaviorRes] = await Promise.all([
      db.from("school_sections").select("id,academic_year_id,grade_label,section_name")
        .eq("school_id", schoolId).in("id", sectionIds),
      db.from("school_memberships").select("id,user_id,grade_label,section_id,school_username,status")
        .eq("school_id", schoolId).eq("school_role", "student")
        .in("status", ["active", "suspended"]).in("section_id", sectionIds),
      db.from("school_terms").select("id,name,term_number,academic_year_id,starts_on,ends_on")
        .eq("school_id", schoolId),
      db.from("school_assessments")
        .select("id,title,section_id,subject_name,term_id,category_id,max_score,status,created_at,review_feedback")
        .eq("school_id", schoolId).eq("created_by_membership_id", teacherMembershipId)
        .order("created_at", { ascending: false }).limit(100),
      db.from("school_announcements")
        .select("id,title,body,section_id,status,created_at,review_feedback")
        .eq("school_id", schoolId).eq("created_by_membership_id", teacherMembershipId)
        .order("created_at", { ascending: false }).limit(100),
      db.from("school_behavior_reports")
        .select("id,student_membership_id,section_id,report_type,severity,description,status,created_at,review_note")
        .eq("school_id", schoolId).eq("reported_by_membership_id", teacherMembershipId)
        .order("created_at", { ascending: false }).limit(100),
    ]);
    const failed = [sectionsRes, studentsRes, termsRes, assessmentsRes, announcementsRes, behaviorRes].find((result: any) => result.error);
    if (failed?.error) {
      toast.error(failed.error.message || "Could not load assigned class records.");
      setLoading(false);
      return;
    }
    setSections(sectionsRes.data ?? []);
    setStudents(studentsRes.data ?? []);
    setTerms(termsRes.data ?? []);
    setAssessments(assessmentsRes.data ?? []);
    setAnnouncements(announcementsRes.data ?? []);
    setBehaviorReports(behaviorRes.data ?? []);

    const yearIds = [...new Set((sectionsRes.data ?? []).map((section: any) => section.academic_year_id))];
    const [categoryRes, markRes] = await Promise.all([
      yearIds.length ? db.from("school_assessment_categories")
        .select("id,academic_year_id,grade_label,category_key,category_name,weight_percent")
        .eq("school_id", schoolId).in("academic_year_id", yearIds) : Promise.resolve({ data: [], error: null }),
      assessmentsRes.data?.length ? db.from("school_student_marks")
        .select("id,assessment_id,student_membership_id,score,status,teacher_note")
        .eq("school_id", schoolId).in("assessment_id", assessmentsRes.data.map((item: any) => item.id)) : Promise.resolve({ data: [], error: null }),
    ]);
    if (categoryRes.error || markRes.error) toast.error("Some assessment details could not be loaded.");
    setCategories(categoryRes.data ?? []);
    setMarks(markRes.data ?? []);

    const userIds = [...new Set((studentsRes.data ?? []).map((student: any) => student.user_id))];
    if (userIds.length) {
      const { data: profileRows, error: profileError } = await db.from("profiles")
        .select("id,name,username").in("id", userIds);
      if (profileError) toast.error("Some student names could not be loaded.");
      setProfiles(Object.fromEntries((profileRows ?? []).map((profile: any) => [profile.id, profile])));
    } else setProfiles({});

    const nextSectionId = sectionIds.includes(assessmentSectionId) ? assessmentSectionId : sectionIds[0];
    const nextSection = (sectionsRes.data ?? []).find((section: any) => section.id === nextSectionId);
    const nextSectionTerms = (termsRes.data ?? []).filter((term: any) => term.academic_year_id === nextSection?.academic_year_id);
    setAssessmentSectionId(nextSectionId);
    setAnnouncementSectionId((current) => sectionIds.includes(current) ? current : sectionIds[0]);
    const homeroomSectionIds = nextAssignments.filter((item: any) => item.assignment_kind === "homeroom").map((item: any) => item.section_id);
    setAttendanceSectionId((current) => homeroomSectionIds.includes(current) ? current : homeroomSectionIds[0] || "");
    setAssessmentTermId((current) => nextSectionTerms.some((term: any) => term.id === current) ? current : nextSectionTerms[0]?.id || "");
    setSelectedAssessmentId((current) => assessmentsRes.data?.some((item: any) => item.id === current) ? current : assessmentsRes.data?.[0]?.id || "");
    setLoading(false);
  }, [schoolId, teacherMembershipId, db]);

  useEffect(() => { void load(); }, [load]);

  const loadAttendanceSession = useCallback(async () => {
    if (!schoolId || !attendanceSectionId) {
      setAttendanceSession(null);
      setAttendanceRecords([]);
      setAttendanceDrafts({});
      return;
    }
    const { data: session, error } = await db.from("school_attendance_sessions")
      .select("id,section_id,attendance_date,status,submitted_at")
      .eq("school_id", schoolId).eq("section_id", attendanceSectionId)
      .eq("attendance_date", attendanceDate).maybeSingle();
    if (error) return toast.error(error.message || "Could not load attendance session.");
    setAttendanceSession(session ?? null);
    if (session) {
      const { data, error: recordsError } = await db.from("school_attendance_records")
        .select("id,student_membership_id,attendance_status,note")
        .eq("school_id", schoolId).eq("session_id", session.id);
      if (recordsError) return toast.error(recordsError.message || "Could not load attendance records.");
      const rows = data ?? [];
      setAttendanceRecords(rows);
      setAttendanceDrafts(Object.fromEntries(rows.map((record: any) => [record.student_membership_id, record.attendance_status])));
    } else {
      setAttendanceRecords([]);
      setAttendanceDrafts(Object.fromEntries(students.filter((student) => student.section_id === attendanceSectionId).map((student) => [student.id, "present"])));
    }
  }, [schoolId, attendanceSectionId, attendanceDate, students, db]);

  useEffect(() => {
    if (page === "attendance") void loadAttendanceSession();
  }, [page, loadAttendanceSession]);

  const activeSections = useMemo(() => sections.filter((section) => assignments.some((assignment) => assignment.section_id === section.id)), [sections, assignments]);
  const subjectAssignments = assignments.filter((item) => item.assignment_kind === "subject");
  const homeroomAssignments = assignments.filter((item) => item.assignment_kind === "homeroom");
  const pendingAssessments = assessments.filter((item) => ["draft", "rejected"].includes(item.status));
  const selectedAssessment = assessments.find((item) => item.id === selectedAssessmentId);
  const selectedAssessmentStudents = selectedAssessment ? students.filter((student) => student.section_id === selectedAssessment.section_id) : [];

  const sectionLabel = (id: string) => {
    const section = sections.find((item) => item.id === id);
    return section ? `${section.grade_label} ${section.section_name}` : "—";
  };
  const studentName = (student: any) => profiles[student.user_id]?.name || student.school_username || "Student";

  const createAssessment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !teacherMembershipId || !assessmentSectionId || !assessmentSubject || !assessmentTermId || !assessmentCategoryId || !assessmentTitle.trim() || Number(assessmentMaxScore) <= 0) {
      return toast.error("Complete all required assessment details.");
    }
    const section = sections.find((item) => item.id === assessmentSectionId);
    if (!section) return toast.error("Selected section is unavailable.");
    setBusy(true);
    const { error } = await db.from("school_assessments").insert({
      school_id: schoolId, academic_year_id: section.academic_year_id,
      term_id: assessmentTermId, section_id: assessmentSectionId,
      category_id: assessmentCategoryId, subject_name: assessmentSubject,
      title: assessmentTitle.trim(), instructions: assessmentInstructions.trim() || null,
      max_score: Number(assessmentMaxScore), due_at: assessmentDueAt || null,
      created_by_membership_id: teacherMembershipId, status: "draft",
    });
    setBusy(false);
    if (error) return toast.error(error.message || "Assessment could not be created.");
    setAssessmentTitle(""); setAssessmentInstructions(""); setAssessmentDueAt("");
    toast.success("Assessment created. Enter marks and submit it for Admin review.");
    await load();
  };

  const saveMarks = async () => {
    if (!selectedAssessment || !teacherMembershipId || !schoolId) return;
    const entries = selectedAssessmentStudents.filter((student) => markDrafts[student.id] !== undefined && markDrafts[student.id] !== "");
    if (!entries.length) return toast.error("Enter at least one student score.");
    for (const student of entries) {
      const score = Number(markDrafts[student.id]);
      if (!Number.isFinite(score) || score < 0 || score > Number(selectedAssessment.max_score)) {
        return toast.error(`Enter a score between 0 and ${selectedAssessment.max_score} for each student.`);
      }
    }
    setBusy(true);
    for (const student of entries) {
      const existing = marks.find((mark) => mark.assessment_id === selectedAssessment.id && mark.student_membership_id === student.id);
      const result = existing
        ? await db.from("school_student_marks").update({ score: Number(markDrafts[student.id]) }).eq("id", existing.id)
        : await db.from("school_student_marks").insert({
            school_id: schoolId, assessment_id: selectedAssessment.id,
            student_membership_id: student.id, score: Number(markDrafts[student.id]),
            status: "draft", entered_by_membership_id: teacherMembershipId,
          });
      if (result.error) {
        setBusy(false);
        return toast.error(result.error.message || `Could not save mark for ${studentName(student)}.`);
      }
    }
    setBusy(false);
    toast.success(`Saved ${entries.length} student mark(s).`);
    await load();
  };

  const submitAssessment = async (id: string) => {
    setBusy(true);
    const { error } = await db.rpc("school_submit_assessment", { p_assessment_id: id });
    setBusy(false);
    if (error) return toast.error(error.message || "Assessment could not be submitted.");
    toast.success("Assessment and marks submitted to the School Admin.");
    await load();
  };

  const saveAttendance = async () => {
    if (!schoolId || !teacherMembershipId || !attendanceSectionId) return null;
    const sectionStudents = students.filter((student) => student.section_id === attendanceSectionId);
    if (!sectionStudents.length) {
      toast.error("There are no enrolled students in this homeroom section.");
      return null;
    }
    setBusy(true);
    let session = attendanceSession;
    if (!session) {
      const { data, error } = await db.from("school_attendance_sessions").insert({
        school_id: schoolId, section_id: attendanceSectionId, attendance_date: attendanceDate,
        recorded_by_membership_id: teacherMembershipId, status: "open",
      }).select("id,section_id,attendance_date,status,submitted_at").single();
      if (error || !data) {
        setBusy(false);
        toast.error(error?.message || "Attendance session could not be created.");
        return null;
      }
      session = data;
      setAttendanceSession(data);
    }
    if (session.status !== "open") {
      setBusy(false);
      toast.error("This attendance session has already been submitted and is locked.");
      return null;
    }
    for (const student of sectionStudents) {
      const attendanceStatus = attendanceDrafts[student.id] || "present";
      const existing = attendanceRecords.find((record) => record.student_membership_id === student.id);
      const result = existing
        ? await db.from("school_attendance_records").update({ attendance_status: attendanceStatus }).eq("id", existing.id)
        : await db.from("school_attendance_records").insert({
            school_id: schoolId, session_id: session.id, student_membership_id: student.id,
            attendance_status: attendanceStatus, recorded_by_membership_id: teacherMembershipId,
          });
      if (result.error) {
        setBusy(false);
        toast.error(result.error.message || "An attendance record could not be saved.");
        return null;
      }
    }
    setBusy(false);
    await loadAttendanceSession();
    toast.success("Attendance saved.");
    return session.id as string;
  };

  const submitAttendance = async () => {
    const sessionId = await saveAttendance();
    if (!sessionId) return;
    setBusy(true);
    const { error } = await db.from("school_attendance_sessions")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", sessionId).eq("status", "open");
    setBusy(false);
    if (error) return toast.error(error.message || "Attendance could not be submitted.");
    toast.success("Attendance submitted. Linked parents will be notified.");
    await loadAttendanceSession();
  };

  const createBehaviorReport = async (event: React.FormEvent) => {
    event.preventDefault();
    const student = students.find((item) => item.id === behaviorStudentId);
    if (!schoolId || !teacherMembershipId || !student || behaviorDescription.trim().length < 3) return toast.error("Choose an assigned student and enter a report description.");
    setBusy(true);
    const { error } = await db.from("school_behavior_reports").insert({
      school_id: schoolId, student_membership_id: student.id, section_id: student.section_id,
      reported_by_membership_id: teacherMembershipId, report_type: behaviorType,
      severity: behaviorSeverity, description: behaviorDescription.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message || "Behavior report could not be submitted.");
    setBehaviorDescription("");
    toast.success("Behavior report submitted for review.");
    await load();
  };

  const createAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !teacherMembershipId || !announcementSectionId || announcementTitle.trim().length < 2 || !announcementBody.trim()) {
      return toast.error("Choose an assigned section and complete the announcement.");
    }
    setBusy(true);
    const { data, error } = await db.from("school_announcements").insert({
      school_id: schoolId, title: announcementTitle.trim(), body: announcementBody.trim(),
      audience_type: "section", grade_label: sections.find((item) => item.id === announcementSectionId)?.grade_label,
      section_id: announcementSectionId, created_by_membership_id: teacherMembershipId, status: "draft",
    }).select("id").single();
    setBusy(false);
    if (error || !data) return toast.error(error?.message || "Announcement could not be created.");
    const submit = await db.rpc("school_submit_announcement", { p_announcement_id: data.id });
    if (submit.error) return toast.error(submit.error.message || "Announcement was saved but could not be submitted.");
    setAnnouncementTitle(""); setAnnouncementBody("");
    toast.success("Announcement submitted to the School Admin for approval.");
    await load();
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <SchoolPageHeading title="Teacher workspace" description="Your assigned classes, assessments, student marks, and class communication." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Assigned sections" value={activeSections.length} detail="Classes assigned to you" icon={Users} />
        <SchoolMetric label="Subject assignments" value={subjectAssignments.length} detail="Subjects you teach" icon={BookOpen} />
        <SchoolMetric label="Pending assessments" value={pendingAssessments.length} detail="Draft or returned for correction" icon={ClipboardCheck} />
        <SchoolMetric label="Students" value={students.length} detail="Across assigned sections" icon={Users} />
      </div>
      <SchoolPanel title="Your assigned classes">
        {activeSections.length ? <div className="divide-y divide-slate-100">{activeSections.map((section) => <div key={section.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-semibold text-slate-800">{sectionLabel(section.id)}</p><p className="mt-1 text-xs text-slate-500">{assignments.filter((item) => item.section_id === section.id).map((item) => item.assignment_kind === "homeroom" ? "Homeroom" : item.subject_name).join(" · ")}</p></div><span className="text-xs text-slate-500">{students.filter((student) => student.section_id === section.id).length} students</span></div>)}</div> : <SchoolEmptyState title="No class assignments" description="Your School Manager must assign your sections and subjects before you can access class records." />}
      </SchoolPanel>
    </div>
  );

  const renderClasses = () => (
    <div className="space-y-4">
      <SchoolPageHeading title="My classes" description="Only sections assigned to your teacher membership are shown." />
      {activeSections.length ? activeSections.map((section) => <SchoolPanel key={section.id} title={sectionLabel(section.id)} description={assignments.filter((item) => item.section_id === section.id).map((item) => item.assignment_kind === "homeroom" ? "Homeroom teacher" : item.subject_name).join(" · ")}>
        <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">School username</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{students.filter((student) => student.section_id === section.id).map((student) => <tr key={student.id}><td className="py-2.5 font-medium text-slate-800">{studentName(student)}</td><td className="py-2.5 text-slate-500">{student.school_username}</td><td className="py-2.5"><SchoolStatus value={student.status} /></td></tr>)}</tbody></table></div>
      </SchoolPanel>) : <SchoolEmptyState title="No assigned classes" description="Ask the School Manager to assign your teaching sections." />}
    </div>
  );

  const renderAssessments = () => {
    const selectedSection = sections.find((section) => section.id === assessmentSectionId);
    const availableSubjects = subjectAssignments.filter((assignment) => assignment.section_id === assessmentSectionId);
    const availableTerms = terms.filter((term) => term.academic_year_id === selectedSection?.academic_year_id);
    const availableCategories = categories.filter((category) => category.academic_year_id === selectedSection?.academic_year_id && category.grade_label === selectedSection?.grade_label);
    return <div className="space-y-4">
      <SchoolPageHeading title="Assessments and marks" description="Create assessments for your assigned subjects, enter marks, and submit them to the School Admin for verification." />
      <SchoolPanel title="Create assessment">
        <form onSubmit={createAssessment} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SchoolField label="Assigned section"><select className={schoolSelectClass} value={assessmentSectionId} onChange={(event) => { const nextId = event.target.value; const nextSection = sections.find((section) => section.id === nextId); setAssessmentSectionId(nextId); setAssessmentSubject(""); setAssessmentCategoryId(""); setAssessmentTermId(terms.find((term) => term.academic_year_id === nextSection?.academic_year_id)?.id || ""); }}><option value="">Choose section</option>{activeSections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField>
          <SchoolField label="Subject"><select className={schoolSelectClass} value={assessmentSubject} onChange={(event) => setAssessmentSubject(event.target.value)}><option value="">Choose assigned subject</option>{availableSubjects.map((item) => <option key={item.id} value={item.subject_name}>{item.subject_name}</option>)}</select></SchoolField>
          <SchoolField label="Term"><select className={schoolSelectClass} value={assessmentTermId} onChange={(event) => setAssessmentTermId(event.target.value)}><option value="">Choose term</option>{availableTerms.map((term) => <option key={term.id} value={term.id}>{term.name} · Term {term.term_number}</option>)}</select></SchoolField>
          <SchoolField label="Assessment category"><select className={schoolSelectClass} value={assessmentCategoryId} onChange={(event) => setAssessmentCategoryId(event.target.value)}><option value="">Choose category</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.category_name} ({category.weight_percent}%)</option>)}</select></SchoolField>
          <SchoolField label="Assessment title"><input className={schoolInputClass} value={assessmentTitle} onChange={(event) => setAssessmentTitle(event.target.value)} placeholder="Unit test" /></SchoolField>
          <SchoolField label="Maximum score"><input type="number" min="1" step="0.01" className={schoolInputClass} value={assessmentMaxScore} onChange={(event) => setAssessmentMaxScore(event.target.value)} /></SchoolField>
          <SchoolField label="Due date"><input type="datetime-local" className={schoolInputClass} value={assessmentDueAt} onChange={(event) => setAssessmentDueAt(event.target.value)} /></SchoolField>
          <div className="sm:col-span-2 xl:col-span-3"><SchoolField label="Instructions"><textarea className={schoolTextareaClass} value={assessmentInstructions} onChange={(event) => setAssessmentInstructions(event.target.value)} placeholder="Optional instructions for students" /></SchoolField></div>
          <div className="sm:col-span-2 xl:col-span-3"><SchoolPrimaryButton type="submit" disabled={busy || !subjectAssignments.length}>Create assessment</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Your assessments" description="Only your own assessments are listed here.">
        {assessments.length ? <div className="space-y-2">{assessments.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedAssessmentId(item.id); setMarkDrafts(Object.fromEntries(marks.filter((mark) => mark.assessment_id === item.id).map((mark) => [mark.student_membership_id, String(mark.score)]))); }} className={["flex w-full flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-left", selectedAssessmentId === item.id ? "border-blue-300 bg-blue-50/60" : "border-slate-200 hover:bg-slate-50"].join(" ")}><span><span className="block text-sm font-semibold text-slate-800">{item.title}</span><span className="mt-1 block text-xs text-slate-500">{sectionLabel(item.section_id)} · {item.subject_name}</span></span><SchoolStatus value={item.status} /></button>)}</div> : <SchoolEmptyState title="No assessments yet" description="Create your first assessment above." />}
      </SchoolPanel>
      {selectedAssessment && <SchoolPanel title={`Enter marks · ${selectedAssessment.title}`} description={`${sectionLabel(selectedAssessment.section_id)} · Maximum score ${selectedAssessment.max_score}`}>
        {selectedAssessment.status === "draft" || selectedAssessment.status === "rejected" ? <>
          {selectedAssessmentStudents.length ? <div className="space-y-3"><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Score / {selectedAssessment.max_score}</th><th className="pb-2">Saved status</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedAssessmentStudents.map((student) => { const mark = marks.find((item) => item.assessment_id === selectedAssessment.id && item.student_membership_id === student.id); return <tr key={student.id}><td className="py-2.5 font-medium text-slate-800">{studentName(student)}</td><td className="py-2.5"><input aria-label={`Score for ${studentName(student)}`} type="number" min="0" max={selectedAssessment.max_score} step="0.01" className="h-9 w-32 rounded-md border border-slate-200 px-2 text-sm" value={markDrafts[student.id] ?? (mark ? String(mark.score) : "")} onChange={(event) => setMarkDrafts((current) => ({ ...current, [student.id]: event.target.value }))} /></td><td className="py-2.5">{mark ? <SchoolStatus value={mark.status} /> : <span className="text-xs text-slate-400">Not entered</span>}</td></tr>; })}</tbody></table></div><div className="flex flex-wrap gap-2"><SchoolPrimaryButton disabled={busy} onClick={() => void saveMarks()}>Save marks</SchoolPrimaryButton><SchoolSecondaryButton disabled={busy || !marks.some((mark) => mark.assessment_id === selectedAssessment.id)} onClick={() => void submitAssessment(selectedAssessment.id)}>Submit for Admin review</SchoolSecondaryButton></div></div> : <SchoolEmptyState title="No students in this section" description="Students will appear after enrollment is completed." />}
        </> : <p className="text-sm text-slate-600">This assessment has been submitted. Marks are locked while the School Admin reviews it.</p>}
      </SchoolPanel>}
    </div>;
  };

  const renderAttendance = () => {
    const homeroomSections = activeSections.filter((section) => homeroomAssignments.some((assignment) => assignment.section_id === section.id));
    const sectionStudents = students.filter((student) => student.section_id === attendanceSectionId);
    const locked = attendanceSession && attendanceSession.status !== "open";
    return <div className="space-y-4">
      <SchoolPageHeading title="Homeroom attendance" description="Record daily attendance for your assigned homeroom section. Parents are notified after submission." />
      <SchoolPanel title="Attendance session">
        <div className="grid gap-3 sm:grid-cols-2">
          <SchoolField label="Homeroom section"><select className={schoolSelectClass} value={attendanceSectionId} onChange={(event) => setAttendanceSectionId(event.target.value)}><option value="">Choose section</option>{homeroomSections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField>
          <SchoolField label="Attendance date"><input type="date" className={schoolInputClass} value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></SchoolField>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">{attendanceSession ? <SchoolStatus value={attendanceSession.status} /> : <span className="text-xs text-slate-500">No session created for this date yet</span>}<SchoolSecondaryButton onClick={() => void loadAttendanceSession()}><RefreshCw className="mr-2 h-4 w-4" />Reload</SchoolSecondaryButton></div>
      </SchoolPanel>
      <SchoolPanel title="Student attendance" description="Every student starts as Present. Change individual statuses before saving or submitting.">
        {sectionStudents.length ? <>
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Attendance status</th></tr></thead><tbody className="divide-y divide-slate-100">{sectionStudents.map((student) => <tr key={student.id}><td className="py-2.5 font-medium text-slate-800">{studentName(student)}</td><td className="py-2.5"><select disabled={Boolean(locked)} className="h-9 w-40 rounded-md border border-slate-200 bg-white px-2 text-sm disabled:bg-slate-100" value={attendanceDrafts[student.id] || "present"} onChange={(event) => setAttendanceDrafts((current) => ({ ...current, [student.id]: event.target.value }))}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></td></tr>)}</tbody></table></div>
          {!locked && <div className="mt-4 flex flex-wrap gap-2"><SchoolPrimaryButton disabled={busy} onClick={() => void saveAttendance()}>Save attendance</SchoolPrimaryButton><SchoolSecondaryButton disabled={busy} onClick={() => void submitAttendance()}>Submit and notify parents</SchoolSecondaryButton></div>}
          {locked && <p className="mt-3 text-sm text-slate-600">This session is submitted. Attendance is locked and parent notifications have been sent.</p>}
        </> : <SchoolEmptyState title="No students in this section" description="Students will appear after enrollment is completed." />}
      </SchoolPanel>
    </div>;
  };

  const renderBehavior = () => (
    <div className="space-y-4">
      <SchoolPageHeading title="Behavior reports" description="Submit a positive note or concern for a student in one of your assigned sections." />
      <SchoolPanel title="Submit behavior report">
        <form onSubmit={createBehaviorReport} className="grid gap-3 sm:grid-cols-2">
          <SchoolField label="Assigned student"><select className={schoolSelectClass} value={behaviorStudentId} onChange={(event) => setBehaviorStudentId(event.target.value)}><option value="">Choose student</option>{students.map((student) => <option key={student.id} value={student.id}>{studentName(student)} · {sectionLabel(student.section_id)}</option>)}</select></SchoolField>
          <SchoolField label="Report type"><select className={schoolSelectClass} value={behaviorType} onChange={(event) => setBehaviorType(event.target.value)}><option value="positive">Positive</option><option value="concern">Concern</option><option value="incident">Incident</option></select></SchoolField>
          <SchoolField label="Severity"><select className={schoolSelectClass} value={behaviorSeverity} onChange={(event) => setBehaviorSeverity(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></SchoolField>
          <div className="sm:col-span-2"><SchoolField label="Description"><textarea className={schoolTextareaClass} value={behaviorDescription} onChange={(event) => setBehaviorDescription(event.target.value)} placeholder="Describe the behavior factually and respectfully." /></SchoolField></div>
          <div className="sm:col-span-2"><SchoolPrimaryButton type="submit" disabled={busy || !students.length}>Submit report</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Your submitted reports">
        {behaviorReports.length ? <div className="space-y-2">{behaviorReports.map((report) => <div key={report.id} className="rounded-md border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{studentName(students.find((student) => student.id === report.student_membership_id) || {})} · {report.report_type}</p><SchoolStatus value={report.status} /></div><p className="mt-1 text-xs text-slate-500">{sectionLabel(report.section_id)} · {report.severity}</p><p className="mt-2 text-sm text-slate-700">{report.description}</p></div>)}</div> : <SchoolEmptyState title="No behavior reports" description="Reports you submit will appear here with their review status." />}
      </SchoolPanel>
    </div>
  );

  const renderAnnouncements = () => (
    <div className="space-y-4">
      <SchoolPageHeading title="Class announcements" description="Create a draft for an assigned section and submit it to the School Admin for approval." />
      <SchoolPanel title="Create announcement">
        <form onSubmit={createAnnouncement} className="space-y-3">
          <SchoolField label="Assigned section"><select className={schoolSelectClass} value={announcementSectionId} onChange={(event) => setAnnouncementSectionId(event.target.value)}><option value="">Choose section</option>{activeSections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField>
          <SchoolField label="Title"><input className={schoolInputClass} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Class announcement" /></SchoolField>
          <SchoolField label="Message"><textarea className={schoolTextareaClass} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="Write the announcement for your assigned section." /></SchoolField>
          <SchoolPrimaryButton type="submit" disabled={busy || !activeSections.length}>Submit for approval</SchoolPrimaryButton>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Your announcements">
        {announcements.length ? <div className="space-y-2">{announcements.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{item.title}</p><SchoolStatus value={item.status} /></div><p className="mt-1 text-xs text-slate-500">{sectionLabel(item.section_id)}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>{item.review_feedback && <p className="mt-2 text-xs text-slate-500">Admin feedback: {item.review_feedback}</p>}</div>)}</div> : <SchoolEmptyState title="No announcements" description="Your submitted class announcements will appear here." />}
      </SchoolPanel>
    </div>
  );

  const content = ({
    overview: renderOverview,
    classes: renderClasses,
    assessments: renderAssessments,
    attendance: renderAttendance,
    behavior: renderBehavior,
    announcements: renderAnnouncements,
  } as Record<string, () => React.ReactNode>)[page]?.() ?? renderOverview();

  const visibleNavItems = homeroomAssignments.length ? navItems : navItems.filter((item) => item.id !== "attendance");

  return <SchoolPortalShell role="teacher" title="Teacher Portal" navItems={visibleNavItems} activeItem={page} onNavigate={setPage} headerActions={<span className="hidden text-xs font-medium text-slate-500 sm:inline">{loading ? "Updating…" : `${students.length} assigned students`}</span>}>{content}</SchoolPortalShell>;
}
