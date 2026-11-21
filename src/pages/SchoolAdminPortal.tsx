import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Users, UserCog, ClipboardCheck, CalendarCheck, ShieldCheck,
  BookOpen, Megaphone, MessageSquare, ClipboardList, FileBarChart, RefreshCw,
  Check, X, Plus, Send, Calculator, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import SchoolBulkStudentEnrollment from "@/components/school/SchoolBulkStudentEnrollment";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField,
  schoolInputClass, schoolSelectClass, schoolTextareaClass,
} from "@/components/school/SchoolPortalPrimitives";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "students", label: "Students & Parents", icon: Users },
  { id: "teachers", label: "Teachers", icon: UserCog },
  { id: "assessments", label: "Assessments & Marks", icon: ClipboardCheck },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "behavior", label: "Behavior", icon: ShieldCheck },
  { id: "content", label: "Content Review", icon: BookOpen },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "tasks", label: "Teacher Tasks", icon: ClipboardList },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "finance", label: "Finance Follow-ups", icon: Wallet },
  { id: "staff-oversight", label: "Staff Oversight", icon: UserCog },
];

export default function SchoolAdminPortal() {
  const { activeSchool, activeMembership } = useSchoolPortal();
  const db = supabase as any;
  const schoolId = activeSchool?.id;
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [sections, setSections] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [homeworkAssignments, setHomeworkAssignments] = useState<any[]>([]);
  const [financeFollowups, setFinanceFollowups] = useState<any[]>([]);
  const [staffConductReports, setStaffConductReports] = useState<any[]>([]);
  const [assignmentRecommendations, setAssignmentRecommendations] = useState<any[]>([]);
  const [disciplinaryRecommendations, setDisciplinaryRecommendations] = useState<any[]>([]);
  const [disciplineStudentId, setDisciplineStudentId] = useState("");
  const [disciplineReason, setDisciplineReason] = useState("");
  const [disciplineRecommendation, setDisciplineRecommendation] = useState("");
  const [financeResolutionNotes, setFinanceResolutionNotes] = useState<Record<string, string>>({});
  const [suspensionReasonByTeacher, setSuspensionReasonByTeacher] = useState<Record<string, string>>({});
  const [conductTeacherId, setConductTeacherId] = useState("");
  const [conductType, setConductType] = useState("quality_concern");
  const [conductSeverity, setConductSeverity] = useState("medium");
  const [conductDescription, setConductDescription] = useState("");
  const [recommendTeacherId, setRecommendTeacherId] = useState("");
  const [recommendationType, setRecommendationType] = useState("change_assignment");
  const [recommendCurrentAssignmentId, setRecommendCurrentAssignmentId] = useState("");
  const [recommendSectionId, setRecommendSectionId] = useState("");
  const [recommendSubject, setRecommendSubject] = useState("");
  const [recommendKind, setRecommendKind] = useState("subject");
  const [recommendReason, setRecommendReason] = useState("");
  const [marks, setMarks] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [behaviorReports, setBehaviorReports] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({});
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementAudience, setAnnouncementAudience] = useState("school");
  const [announcementGrade, setAnnouncementGrade] = useState("");
  const [announcementSection, setAnnouncementSection] = useState("");
  const [newConversationStudent, setNewConversationStudent] = useState("");
  const [newConversationSection, setNewConversationSection] = useState("");
  const [newConversationParticipants, setNewConversationParticipants] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [taskTargetId, setTaskTargetId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [staffAccountRole, setStaffAccountRole] = useState<"parent" | "teacher">("parent");
  const [staffAccountName, setStaffAccountName] = useState("");
  const [staffAccountStudents, setStaffAccountStudents] = useState<string[]>([]);
  const [staffAccountSection, setStaffAccountSection] = useState("");
  const [staffAccountSubject, setStaffAccountSubject] = useState("");
  const [staffAccountKind, setStaffAccountKind] = useState<"subject" | "homeroom">("subject");
  const [linkParentId, setLinkParentId] = useState("");
  const [linkStudentIds, setLinkStudentIds] = useState<string[]>([]);
  const [placementByStudent, setPlacementByStudent] = useState<Record<string, string>>({});
  const [createdCredentials, setCreatedCredentials] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [
      membersRes, sectionsRes, assignmentsRes, subjectsRes, termsRes, assessmentsRes, homeworkRes, marksRes,
      sessionsRes, attendanceRes, behaviorRes, quizzesRes, booksRes,
      announcementsRes, tasksRes, conversationsRes, financeFollowupsRes, staffConductRes, assignmentRecommendationsRes, disciplinaryRes,
    ] = await Promise.all([
      db.from("school_memberships").select("id,user_id,school_role,status,grade_label,section_id,student_number,school_username,age_at_enrollment,end_reason,ended_at,question_submission_suspended,question_submission_suspension_reason").eq("school_id", schoolId).order("created_at", { ascending: false }),
      db.from("school_sections").select("id,academic_year_id,grade_label,section_name,homeroom_teacher_id").eq("school_id", schoolId).order("grade_label"),
      db.from("school_teacher_assignments").select("id,teacher_membership_id,section_id,subject_name,assignment_kind").eq("school_id", schoolId),
      db.from("school_subjects").select("id,academic_year_id,grade_label,subject_name,active").eq("school_id", schoolId).eq("active", true).order("grade_label"),
      db.from("school_terms").select("id,academic_year_id,name,term_number,starts_on,ends_on").eq("school_id", schoolId).order("term_number"),
      db.from("school_assessments").select("id,title,subject_name,section_id,term_id,status,created_by_membership_id,review_feedback,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_homework_assignments").select("id,title,section_id,teacher_membership_id,subject_name,instructions,due_at,status,review_feedback,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200),
      db.from("school_student_marks").select("id,assessment_id,student_membership_id,score,status,teacher_note").eq("school_id", schoolId).limit(500),
      db.from("school_attendance_sessions").select("id,section_id,attendance_date,status,recorded_by_membership_id").eq("school_id", schoolId).order("attendance_date", { ascending: false }).limit(100),
      db.from("school_attendance_records").select("id,session_id,student_membership_id,attendance_status").eq("school_id", schoolId).limit(1000),
      db.from("school_behavior_reports").select("id,student_membership_id,section_id,reported_by_membership_id,report_type,severity,description,status,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("quizzes").select("id,title,subject,grade,school_section_id,school_review_status,created_by").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("library_books").select("id,title,subject,grade,school_section_id,school_review_status,uploader_id").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_announcements").select("id,title,body,audience_type,grade_label,section_id,status,created_by_membership_id,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_staff_tasks").select("id,title,assigned_to_membership_id,status,due_date,priority,task_type,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_conversations").select("id,conversation_type,section_id,student_membership_id,subject_name,last_message_at,created_at").eq("school_id", schoolId).order("last_message_at", { ascending: false }).limit(100),
      db.from("school_finance_followups").select("id,invoice_id,student_membership_id,submitted_by_membership_id,note,status,reviewed_at,resolution_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_staff_conduct_reports").select("id,target_teacher_membership_id,submitted_by_membership_id,report_type,severity,description,status,manager_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_teacher_assignment_recommendations").select("id,teacher_membership_id,submitted_by_membership_id,current_assignment_id,recommendation_type,requested_section_id,requested_subject_name,requested_assignment_kind,reason,status,manager_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_disciplinary_recommendations").select("id,target_membership_id,target_kind,submitted_by_membership_id,reason,recommendation,status,decision_note,created_at").eq("school_id", schoolId).eq("target_kind", "student").order("created_at", { ascending: false }).limit(100),
    ]);
    const error = [membersRes, sectionsRes, assignmentsRes, subjectsRes, termsRes, assessmentsRes, homeworkRes, marksRes, sessionsRes, attendanceRes, behaviorRes, quizzesRes, booksRes, announcementsRes, tasksRes, conversationsRes, financeFollowupsRes, staffConductRes, assignmentRecommendationsRes, disciplinaryRes].find((result) => result.error)?.error;
    if (error) {
      toast.error(error.message || "School records could not be loaded.");
      setLoading(false);
      return;
    }
    const nextMembers = membersRes.data ?? [];
    setMembers(nextMembers);
    setSections(sectionsRes.data ?? []);
    setTeacherAssignments(assignmentsRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);
    setTerms(termsRes.data ?? []);
    setAssessments(assessmentsRes.data ?? []);
    setHomeworkAssignments(homeworkRes.data ?? []);
    setMarks(marksRes.data ?? []);
    setAttendanceSessions(sessionsRes.data ?? []);
    setAttendanceRecords(attendanceRes.data ?? []);
    setBehaviorReports(behaviorRes.data ?? []);
    setQuizzes(quizzesRes.data ?? []);
    setBooks(booksRes.data ?? []);
    setAnnouncements(announcementsRes.data ?? []);
    setTasks(tasksRes.data ?? []);
    setConversations(conversationsRes.data ?? []);
    setFinanceFollowups(financeFollowupsRes.data ?? []);
    setStaffConductReports(staffConductRes.data ?? []);
    setAssignmentRecommendations(assignmentRecommendationsRes.data ?? []);
    setDisciplinaryRecommendations(disciplinaryRes.data ?? []);
    if (!selectedTermId && termsRes.data?.length) setSelectedTermId(termsRes.data[0].id);
    const userIds = [...new Set(nextMembers.map((member: any) => member.user_id))];
    if (userIds.length) {
      const { data: profileRows } = await db.from("profiles").select("id,name,username,age,grade").in("id", userIds);
      setProfiles(Object.fromEntries((profileRows ?? []).map((profile: any) => [profile.id, profile])));
    }
    setLoading(false);
  }, [schoolId, db, selectedTermId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedConversationId || !schoolId) { setMessages([]); return; }
    let cancelled = false;
    const loadMessages = async () => {
      const { data, error } = await db.from("school_messages").select("id,body,sender_membership_id,created_at").eq("school_id", schoolId).eq("conversation_id", selectedConversationId).order("created_at", { ascending: true });
      if (!cancelled) {
        if (error) toast.error(error.message);
        else setMessages(data ?? []);
      }
    };
    void loadMessages();
    return () => { cancelled = true; };
  }, [selectedConversationId, schoolId, db]);

  const activeMembers = members.filter((member) => member.status === "active");
  const allStudents = members.filter((member) => member.school_role === "student");
  const students = activeMembers.filter((member) => member.school_role === "student");
  const teachers = activeMembers.filter((member) => member.school_role === "teacher");
  const parents = activeMembers.filter((member) => member.school_role === "parent");
  const memberName = (id: string) => {
    const member = members.find((item) => item.id === id);
    return member ? (profiles[member.user_id]?.name || member.school_username || "School member") : "Unknown member";
  };
  const sectionLabel = (id: string | null) => {
    const section = sections.find((item) => item.id === id);
    return section ? `${section.grade_label} ${section.section_name}` : "—";
  };
  const pendingAssessments = assessments.filter((item) => item.status === "submitted");
  const pendingHomework = homeworkAssignments.filter((item) => item.status === "pending");
  const pendingBehaviors = behaviorReports.filter((item) => item.status === "pending");
  const pendingQuizzes = quizzes.filter((item) => item.school_review_status === "pending");
  const pendingBooks = books.filter((item) => item.school_review_status === "pending");
  const pendingAnnouncements = announcements.filter((item) => item.status === "pending");
  const pendingContentCount = pendingQuizzes.length + pendingBooks.length + pendingAnnouncements.length;
  const today = new Date().toLocaleDateString("en-CA");
  const todaySessions = attendanceSessions.filter((session) => session.attendance_date === today);

  const changeStudentPlacement = async (student: any) => {
    const nextSection = sections.find((section) => section.id === placementByStudent[student.id]);
    if (!nextSection) return toast.error("Choose the new class section.");
    const { error } = await db.from("school_memberships").update({ grade_label: nextSection.grade_label, section_id: nextSection.id }).eq("id", student.id).eq("school_id", schoolId);
    if (error) return toast.error(error.message);
    toast.success("Student class placement updated. Their Student ID and account remain unchanged.");
    await load();
  };

  const endStudentEnrollment = async (student: any, action: "transfer_student" | "graduate_student") => {
    const label = action === "transfer_student" ? "transfer this student out" : "mark this student as graduated";
    if (!window.confirm(`Are you sure you want to ${label}? Historical school records will remain archived.`)) return;
    const { error } = await supabase.functions.invoke("school-provision-account", { body: { action, membership_id: student.id, reason: action === "transfer_student" ? "Transferred to another school" : "Graduated" } });
    if (error) return toast.error(error.message);
    toast.success(action === "transfer_student" ? "Student enrollment deactivated and records archived." : "Student marked as graduated and records archived.");
    await load();
  };

  const linkExistingParent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!linkParentId || !linkStudentIds.length) return toast.error("Choose a parent and at least one student.");
    const { data, error } = await supabase.functions.invoke("school-provision-account", { body: { action: "link_parent_students", parent_membership_id: linkParentId, student_membership_ids: linkStudentIds } });
    if (error) return toast.error(error.message);
    toast.success(`Parent linked to ${data?.linked ?? linkStudentIds.length} student(s).`);
    setLinkParentId(""); setLinkStudentIds([]);
    await load();
  };

  const reviewAssessment = async (id: string, approve: boolean) => {
    const { error } = await db.rpc("school_review_assessment", { p_assessment_id: id, p_approve: approve, p_feedback: reviewFeedback[id] || null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Assessment and submitted marks approved." : "Assessment returned to the teacher.");
    await load();
  };
  const reviewQuiz = async (id: string, approve: boolean) => {
    const { error } = await db.rpc("school_review_quiz", { p_quiz_id: id, p_approved: approve, p_feedback: reviewFeedback[id] || null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Quiz approved." : "Quiz rejected.");
    await load();
  };
  const reviewBook = async (id: string, approve: boolean) => {
    const { error } = await db.rpc("school_review_library_book", { p_book_id: id, p_approved: approve, p_feedback: reviewFeedback[id] || null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Library resource approved." : "Library resource rejected.");
    await load();
  };
  const submitStudentDisciplinaryRecommendation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!disciplineStudentId || !disciplineReason.trim() || !disciplineRecommendation.trim()) return toast.error("Choose a student and provide the reason and recommendation.");
    const { error } = await db.from("school_disciplinary_recommendations").insert({
      school_id: schoolId, target_membership_id: disciplineStudentId, target_kind: "student",
      submitted_by_membership_id: activeMembership?.id, reason: disciplineReason.trim(),
      recommendation: disciplineRecommendation.trim(), status: "pending",
    });
    if (error) return toast.error(error.message);
    setDisciplineReason(""); setDisciplineRecommendation("");
    toast.success("Student disciplinary recommendation submitted to the School Manager for review.");
    await load();
  };

  const submitStaffConductReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!conductTeacherId || !conductDescription.trim()) return toast.error("Choose a teacher and describe the concern.");
    const { error } = await db.rpc("school_submit_staff_conduct_report", {
      p_teacher_membership_id: conductTeacherId, p_report_type: conductType,
      p_severity: conductSeverity, p_description: conductDescription.trim(),
    });
    if (error) return toast.error(error.message);
    setConductDescription("");
    toast.success("Staff conduct report submitted confidentially to the School Manager.");
    await load();
  };

  const submitAssignmentRecommendation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recommendTeacherId || !recommendReason.trim()) return toast.error("Choose a teacher and explain the recommendation.");
    if (["remove_assignment", "change_assignment"].includes(recommendationType) && !recommendCurrentAssignmentId) return toast.error("Choose the current assignment.");
    if (["add_assignment", "change_assignment"].includes(recommendationType) && (!recommendSectionId || (recommendKind === "subject" && !recommendSubject))) return toast.error("Choose the requested section and subject.");
    const { error } = await db.rpc("school_submit_teacher_assignment_recommendation", {
      p_teacher_membership_id: recommendTeacherId,
      p_recommendation_type: recommendationType,
      p_current_assignment_id: recommendCurrentAssignmentId || null,
      p_requested_section_id: recommendSectionId || null,
      p_requested_subject_name: recommendKind === "homeroom" ? "Homeroom" : recommendSubject || null,
      p_requested_assignment_kind: ["add_assignment", "change_assignment"].includes(recommendationType) ? recommendKind : null,
      p_reason: recommendReason.trim(),
    });
    if (error) return toast.error(error.message);
    setRecommendReason("");
    toast.success("Teacher assignment recommendation sent to the School Manager.");
    await load();
  };

  const setTeacherQuestionSuspension = async (teacher: any, suspended: boolean) => {
    const reason = suspensionReasonByTeacher[teacher.id]?.trim();
    if (suspended && !reason) return toast.error("Enter a reason for suspending question submissions.");
    const { error } = await db.rpc("school_set_teacher_question_suspension", {
      p_teacher_membership_id: teacher.id, p_suspended: suspended, p_reason: suspended ? reason : null,
    });
    if (error) return toast.error(error.message);
    setSuspensionReasonByTeacher((current) => ({ ...current, [teacher.id]: "" }));
    toast.success(suspended ? "Question submissions suspended. The teacher account remains active." : "Question submissions restored.");
    await load();
  };
  const resolveFinanceFollowup = async (id: string) => {
    const { error } = await db.rpc("school_resolve_finance_followup", { p_followup_id: id, p_note: financeResolutionNotes[id] || null });
    if (error) return toast.error(error.message);
    toast.success("Finance follow-up marked resolved.");
    await load();
  };
  const reviewHomework = async (id: string, approve: boolean) => {
    const { error } = await db.rpc("school_review_homework", { p_homework_id: id, p_approved: approve, p_feedback: reviewFeedback[id] || null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Homework approved for student access." : "Homework returned to the teacher.");
    await load();
  };
  const reviewAnnouncement = async (id: string, approve: boolean) => {
    const { error } = await db.rpc("school_review_announcement", { p_announcement_id: id, p_approved: approve, p_feedback: reviewFeedback[id] || null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Announcement published." : "Announcement rejected.");
    await load();
  };
  const reviewBehavior = async (id: string, approve: boolean) => {
    const { error } = await db.rpc("school_review_behavior_report", { p_report_id: id, p_approve: approve, p_note: reviewFeedback[id] || null });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Behavior report approved." : "Behavior report rejected.");
    await load();
  };

  const calculateResults = async () => {
    if (!selectedTermId) return toast.error("Choose a term first.");
    const { error } = await db.rpc("school_calculate_term_results", { p_term_id: selectedTermId });
    if (error) return toast.error(error.message);
    toast.success("Term averages and ranks calculated. Review them before publishing.");
    await load();
  };
  const publishResults = async () => {
    if (!selectedTermId) return toast.error("Choose a term first.");
    const { error } = await db.rpc("school_publish_term_results", { p_term_id: selectedTermId });
    if (error) return toast.error(error.message);
    toast.success("Official term results published to student and parent portals.");
    await load();
  };

  const createAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) return toast.error("Enter an announcement title and message.");
    if (announcementAudience === "grade" && !announcementGrade.trim()) return toast.error("Choose a grade.");
    if (announcementAudience === "section" && !announcementSection) return toast.error("Choose a section.");
    const section = sections.find((item) => item.id === announcementSection);
    const { error } = await db.from("school_announcements").insert({
      school_id: schoolId,
      title: announcementTitle.trim(),
      body: announcementBody.trim(),
      audience_type: announcementAudience,
      grade_label: announcementAudience === "grade" ? announcementGrade : announcementAudience === "section" ? section?.grade_label : null,
      section_id: announcementAudience === "section" ? announcementSection : null,
      created_by_membership_id: activeMembership?.id,
      status: "published",
    });
    if (error) return toast.error(error.message);
    setAnnouncementTitle(""); setAnnouncementBody("");
    toast.success("Announcement published to the selected audience.");
    await load();
  };

  const createConversation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newConversationSection) {
      const { data, error } = await db.rpc("school_create_conversation", {
        p_school_id: schoolId, p_conversation_type: "class", p_section_id: newConversationSection,
        p_participant_membership_ids: [], p_subject_name: null,
      });
      if (error) return toast.error(error.message);
      setSelectedConversationId(data);
      setNewConversationSection("");
      toast.success("Class conversation created.");
      await load();
      return;
    }
    if (!newConversationStudent || !newConversationParticipants.length) return toast.error("Choose a student and at least one parent, teacher, or Admin participant.");
    const participantIds = [...new Set([activeMembership?.id, ...newConversationParticipants].filter(Boolean))] as string[];
    const { data, error } = await db.rpc("school_create_conversation", {
      p_school_id: schoolId, p_conversation_type: "direct",
      p_student_membership_id: newConversationStudent,
      p_participant_membership_ids: participantIds,
      p_subject_name: null,
    });
    if (error) return toast.error(error.message);
    setSelectedConversationId(data);
    setNewConversationStudent(""); setNewConversationParticipants([]);
    toast.success("Direct conversation created.");
    await load();
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedConversationId || !newMessage.trim()) return;
    const { error } = await db.from("school_messages").insert({
      school_id: schoolId, conversation_id: selectedConversationId,
      sender_membership_id: activeMembership?.id, body: newMessage.trim(),
    });
    if (error) return toast.error(error.message);
    setNewMessage("");
    const { data } = await db.from("school_messages").select("id,body,sender_membership_id,created_at").eq("school_id", schoolId).eq("conversation_id", selectedConversationId).order("created_at", { ascending: true });
    setMessages(data ?? []);
    await load();
  };

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskTargetId || !taskTitle.trim()) return toast.error("Choose a teacher and enter the task title.");
    const { error } = await db.from("school_staff_tasks").insert({
      school_id: schoolId, assigned_to_membership_id: taskTargetId,
      assigned_by_membership_id: activeMembership?.id, task_type: "academic",
      title: taskTitle.trim(), description: taskDescription.trim() || null,
      due_date: taskDueDate || null, priority: "normal",
    });
    if (error) return toast.error(error.message);
    setTaskTitle(""); setTaskDescription(""); setTaskDueDate("");
    toast.success("Academic task assigned to teacher.");
    await load();
  };

  const createParentOrTeacher = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!staffAccountName.trim()) return toast.error("Enter the account holder's full name.");
    const account: any = { name: staffAccountName.trim() };
    if (staffAccountRole === "parent") account.student_membership_ids = staffAccountStudents;
    else {
      if (!staffAccountSection || (staffAccountKind === "subject" && !staffAccountSubject)) return toast.error("Choose the teacher's section and subject.");
      account.assignments = [{
        section_id: staffAccountSection,
        subject_name: staffAccountKind === "homeroom" ? "Homeroom" : staffAccountSubject,
        assignment_kind: staffAccountKind,
      }];
    }
    setCreatedCredentials([]);
    const { data, error } = await supabase.functions.invoke("school-provision-account", {
      body: { action: "create_accounts", school_id: schoolId, role: staffAccountRole, accounts: [account] },
    });
    if (error || !data?.created?.length) return toast.error(data?.failed?.[0]?.message || error?.message || "Account could not be created.");
    setCreatedCredentials(data.created);
    setStaffAccountName(""); setStaffAccountStudents([]);
    toast.success("Account created. Deliver its initial credentials privately.");
    await load();
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <SchoolPageHeading title="School administration" description="Academic operations, student support, content quality, and official result publication." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Students" value={students.length} detail="Active school enrollments" icon={Users} />
        <SchoolMetric label="Teachers" value={teachers.length} detail="Active teaching accounts" icon={UserCog} />
        <SchoolMetric label="Assessments awaiting review" value={pendingAssessments.length} detail="Teacher-submitted marks included" icon={ClipboardCheck} />
        <SchoolMetric label="Content awaiting review" value={pendingContentCount} detail="Quizzes, books, and announcements" icon={BookOpen} />
        <SchoolMetric label="Behavior reports pending" value={pendingBehaviors.length} detail="Awaiting school review" icon={ShieldCheck} />
        <SchoolMetric label="Attendance sessions today" value={todaySessions.length} detail="Recorded by homeroom teachers" icon={CalendarCheck} />
        <SchoolMetric label="Parent accounts" value={parents.length} detail="Linked parent memberships" icon={Users} />
        <SchoolMetric label="Open teacher tasks" value={tasks.filter((task) => ["open", "in_progress", "submitted", "returned"].includes(task.status)).length} detail="Academic follow-up work" icon={ClipboardList} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Needs your review" description="Workflows requiring School Admin action">
          <div className="space-y-3">
            {[["Assessments and marks", pendingAssessments.length, "assessments"], ["Quizzes", pendingQuizzes.length, "content"], ["Library resources", pendingBooks.length, "content"], ["Announcements", pendingAnnouncements.length, "announcements"], ["Behavior reports", pendingBehaviors.length, "behavior"]].map(([label, count, target]) => <button key={String(label)} onClick={() => setPage(String(target))} className="flex w-full items-center justify-between rounded-md border border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"><span className="text-sm font-medium text-slate-700">{label}</span><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-700">{count}</span></button>)}
          </div>
        </SchoolPanel>
        <SchoolPanel title="Recent school announcements" description="Published school communications">
          {announcements.filter((item) => item.status === "published").slice(0, 5).length ? <div className="divide-y divide-slate-100">{announcements.filter((item) => item.status === "published").slice(0, 5).map((item) => <div key={item.id} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-medium text-slate-800">{item.title}</p><p className="mt-1 text-xs capitalize text-slate-500">{item.audience_type} · {new Date(item.created_at).toLocaleDateString()}</p></div>)}</div> : <SchoolEmptyState title="No published announcements" description="Publish a school announcement to notify parents and students." />}
        </SchoolPanel>
      </div>
    </div>
  );

  const renderStudents = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Students & parents" description="Enroll students in bulk, create parent accounts, and keep family links accurate." />
      <SchoolBulkStudentEnrollment schoolId={schoolId!} sections={sections} parents={parents} memberName={memberName} onCreated={load} />
      <SchoolPanel title="Link an existing parent account to students" description="A parent can be linked to multiple children.">
        <form onSubmit={linkExistingParent} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Parent account"><select className={schoolSelectClass} value={linkParentId} onChange={(event) => setLinkParentId(event.target.value)}><option value="">Choose parent</option>{parents.map((parent) => <option key={parent.id} value={parent.id}>{memberName(parent.id)}</option>)}</select></SchoolField>
          <SchoolField label="Children"><select multiple className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-2 text-sm" value={linkStudentIds} onChange={(event) => setLinkStudentIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>{students.map((student) => <option key={student.id} value={student.id}>{memberName(student.id)} · {student.grade_label}</option>)}</select></SchoolField>
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit">Save parent-child links</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <SchoolPanel title="Student register">
          {allStudents.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Student ID</th><th className="pb-2">Class</th><th className="pb-2">Status</th><th className="pb-2">Placement</th><th className="pb-2">Enrollment</th></tr></thead><tbody className="divide-y divide-slate-100">{allStudents.map((student) => <tr key={student.id}><td className="py-3 font-medium text-slate-800">{memberName(student.id)}<p className="mt-0.5 text-xs text-slate-500">{student.school_username}</p></td><td className="py-3 text-slate-600">{student.student_number ?? "—"}</td><td className="py-3 text-slate-600">{sectionLabel(student.section_id)}</td><td className="py-3"><SchoolStatus value={student.end_reason === "transferred" ? "transferred" : student.status === "deactivated" && student.end_reason === "graduated" ? "graduated" : student.status} /></td><td className="py-3">{student.status === "active" ? <div className="flex min-w-[220px] gap-2"><select className={schoolSelectClass} value={placementByStudent[student.id] || student.section_id || ""} onChange={(event) => setPlacementByStudent((current) => ({ ...current, [student.id]: event.target.value }))}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select><button type="button" onClick={() => void changeStudentPlacement(student)} className="rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Move</button></div> : <span className="text-xs text-slate-400">Archived</span>}</td><td className="py-3">{student.status === "active" ? <div className="flex gap-2"><button type="button" onClick={() => void endStudentEnrollment(student, "transfer_student")} className="text-xs font-semibold text-amber-700 hover:underline">Transfer out</button><button type="button" onClick={() => void endStudentEnrollment(student, "graduate_student")} className="text-xs font-semibold text-slate-600 hover:underline">Graduate</button></div> : <span className="text-xs text-slate-400">{student.ended_at ? new Date(student.ended_at).toLocaleDateString() : "—"}</span>}</td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No students enrolled" description="Use bulk enrollment to add students to the school." />}
        </SchoolPanel>
        <SchoolPanel title="Create parent or teacher account" description="Parent accounts are linked to their children. Teacher accounts need an initial class assignment.">
          <form onSubmit={createParentOrTeacher} className="space-y-3">
            <SchoolField label="Account type"><select className={schoolSelectClass} value={staffAccountRole} onChange={(event) => setStaffAccountRole(event.target.value as "parent" | "teacher")}><option value="parent">Parent</option><option value="teacher">Teacher</option></select></SchoolField>
            <SchoolField label="Full name"><input className={schoolInputClass} value={staffAccountName} onChange={(event) => setStaffAccountName(event.target.value)} /></SchoolField>
            {staffAccountRole === "parent" ? <SchoolField label="Link children"><select multiple className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-2 text-sm" value={staffAccountStudents} onChange={(event) => setStaffAccountStudents(Array.from(event.target.selectedOptions).map((option) => option.value))}>{students.map((student) => <option key={student.id} value={student.id}>{memberName(student.id)} · {student.grade_label}</option>)}</select></SchoolField> : <>
              <SchoolField label="Section"><select className={schoolSelectClass} value={staffAccountSection} onChange={(event) => setStaffAccountSection(event.target.value)}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
              <SchoolField label="Assignment type"><select className={schoolSelectClass} value={staffAccountKind} onChange={(event) => setStaffAccountKind(event.target.value as "subject" | "homeroom")}><option value="subject">Subject teacher</option><option value="homeroom">Homeroom teacher</option></select></SchoolField>
              {staffAccountKind === "subject" && <SchoolField label="Subject"><select className={schoolSelectClass} value={staffAccountSubject} onChange={(event) => setStaffAccountSubject(event.target.value)}><option value="">Choose subject</option>{subjects.filter((subject) => subject.grade_label === sections.find((section) => section.id === staffAccountSection)?.grade_label && subject.academic_year_id === sections.find((section) => section.id === staffAccountSection)?.academic_year_id).map((subject) => <option key={subject.id} value={subject.subject_name}>{subject.subject_name}</option>)}</select></SchoolField>}
            </>}
            <SchoolPrimaryButton type="submit">Create account</SchoolPrimaryButton>
          </form>
          {createdCredentials.length > 0 && <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs"><p className="font-semibold text-emerald-900">Initial credentials</p>{createdCredentials.map((item, index) => <div key={index} className="mt-2 rounded border border-emerald-200 bg-white p-2"><p>Username: {item.username}</p><p className="break-all">Initial password: {item.initial_password}</p></div>)}</div>}
        </SchoolPanel>
      </div>
    </div>
  );

  const renderTeachers = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Teacher records" description="Review teaching assignments, homeroom responsibilities, and teacher workload." />
      <SchoolPanel title="Teachers and assignments">
        {teachers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Teacher</th><th className="pb-2">Assignments</th><th className="pb-2">Sections</th><th className="pb-2">Account</th><th className="pb-2">Question submissions</th></tr></thead><tbody className="divide-y divide-slate-100">{teachers.map((teacher) => { const assigned = teacherAssignments.filter((assignment) => assignment.teacher_membership_id === teacher.id); const count = assigned.length; const assignedSections = [...new Set(assigned.map((assignment) => sectionLabel(assignment.section_id)))].join(", "); return <tr key={teacher.id}><td className="py-3 font-medium text-slate-800">{memberName(teacher.id)}</td><td className="py-3 text-slate-600">{count}</td><td className="py-3 text-slate-600">{assignedSections || "No assignments"}</td><td className="py-3"><SchoolStatus value={teacher.status} /></td><td className="py-3"><div className="min-w-[230px] space-y-2">{teacher.question_submission_suspended ? <p className="text-xs text-amber-700">Suspended: {teacher.question_submission_suspension_reason}</p> : <p className="text-xs text-emerald-700">Active</p>}{!teacher.question_submission_suspended && <input className={schoolInputClass} value={suspensionReasonByTeacher[teacher.id] || ""} onChange={(event) => setSuspensionReasonByTeacher((current) => ({ ...current, [teacher.id]: event.target.value }))} placeholder="Reason to suspend (required)" />}<button type="button" onClick={() => void setTeacherQuestionSuspension(teacher, !teacher.question_submission_suspended)} className="text-xs font-semibold text-blue-700 hover:underline">{teacher.question_submission_suspended ? "Restore submissions" : "Suspend question submissions"}</button></div></td></tr>; })}</tbody></table></div> : <SchoolEmptyState title="No teachers yet" description="Create teacher accounts and assign their classes." />}
      </SchoolPanel>
      <SchoolPanel title="Teacher assignment register">
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Teacher</th><th className="pb-2">Class</th><th className="pb-2">Subject / role</th><th className="pb-2">Assignment</th></tr></thead><tbody className="divide-y divide-slate-100">{teachers.flatMap((teacher) => teacherAssignments.filter((assignment) => assignment.teacher_membership_id === teacher.id).map((assignment: any) => <tr key={assignment.id}><td className="py-3 font-medium text-slate-800">{memberName(teacher.id)}</td><td className="py-3 text-slate-600">{sectionLabel(assignment.section_id)}</td><td className="py-3 text-slate-600">{assignment.subject_name}</td><td className="py-3 capitalize text-slate-600">{assignment.assignment_kind}</td></tr>))}</tbody></table></div>
      </SchoolPanel>
    </div>
  );

  const renderAssessments = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Assessments, marks & results" description="Review teacher-submitted assessments and marks, calculate averages and ranks, then publish official results." />
      <SchoolPanel title="Assessment review queue" description="Approving an assessment also approves its submitted marks. Rejection returns the work to the teacher.">
        {pendingAssessments.length ? <div className="space-y-3">{pendingAssessments.map((assessment) => <div key={assessment.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{assessment.title}</p><p className="mt-1 text-xs text-slate-500">{assessment.subject_name} · {sectionLabel(assessment.section_id)} · {memberName(assessment.created_by_membership_id)}</p><p className="mt-1 text-xs text-slate-500">{marks.filter((mark) => mark.assessment_id === assessment.id).length} marks entered</p></div><SchoolStatus value={assessment.status} /></div><textarea className={schoolTextareaClass + " mt-3"} value={reviewFeedback[assessment.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [assessment.id]: event.target.value }))} placeholder="Review feedback (optional)" /><div className="mt-3 flex flex-wrap gap-2"><SchoolPrimaryButton onClick={() => void reviewAssessment(assessment.id, true)}><Check className="mr-2 h-4 w-4" />Approve marks</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewAssessment(assessment.id, false)}><X className="mr-2 h-4 w-4" />Return to teacher</SchoolSecondaryButton></div></div>)}</div> : <SchoolEmptyState title="No assessments awaiting review" description="Submitted assessments and their marks will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Calculate and publish official results" description="Only approved marks are included in the official term calculation.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full max-w-sm"><SchoolField label="Academic term"><select className={schoolSelectClass} value={selectedTermId} onChange={(event) => setSelectedTermId(event.target.value)}><option value="">Choose term</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></SchoolField></div>
          <SchoolPrimaryButton onClick={() => void calculateResults()} disabled={!selectedTermId}><Calculator className="mr-2 h-4 w-4" />Calculate averages & ranks</SchoolPrimaryButton>
          <SchoolSecondaryButton onClick={() => void publishResults()} disabled={!selectedTermId}><Check className="mr-2 h-4 w-4" />Publish official results</SchoolSecondaryButton>
        </div>
      </SchoolPanel>
      <SchoolPanel title="Recent assessment records">
        {assessments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Assessment</th><th className="pb-2">Class</th><th className="pb-2">Teacher</th><th className="pb-2">Marks</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{assessments.map((assessment) => <tr key={assessment.id}><td className="py-3 font-medium text-slate-800">{assessment.title}</td><td className="py-3 text-slate-600">{sectionLabel(assessment.section_id)}</td><td className="py-3 text-slate-600">{memberName(assessment.created_by_membership_id)}</td><td className="py-3 tabular-nums text-slate-600">{marks.filter((mark) => mark.assessment_id === assessment.id).length}</td><td className="py-3"><SchoolStatus value={assessment.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No assessments created" description="Teacher-created assessments will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Attendance oversight" description="Daily attendance is recorded by the assigned homeroom teacher. Admin monitors records and parent notifications." />
      <div className="grid gap-3 sm:grid-cols-3"><SchoolMetric label="Sessions today" value={todaySessions.length} detail={today} icon={CalendarCheck} /><SchoolMetric label="Absences recorded" value={attendanceRecords.filter((record) => record.attendance_status === "absent").length} detail="Across loaded attendance records" icon={Users} /><SchoolMetric label="Late arrivals" value={attendanceRecords.filter((record) => record.attendance_status === "late").length} detail="Across loaded attendance records" icon={CalendarCheck} /></div>
      <SchoolPanel title="Recent attendance sessions">
        {attendanceSessions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Date</th><th className="pb-2">Section</th><th className="pb-2">Homeroom teacher</th><th className="pb-2">Records</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{attendanceSessions.map((session) => <tr key={session.id}><td className="py-3 text-slate-700">{session.attendance_date}</td><td className="py-3 text-slate-600">{sectionLabel(session.section_id)}</td><td className="py-3 text-slate-600">{memberName(session.recorded_by_membership_id)}</td><td className="py-3 tabular-nums text-slate-600">{attendanceRecords.filter((record) => record.session_id === session.id).length}</td><td className="py-3"><SchoolStatus value={session.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No attendance sessions yet" description="Homeroom teachers' daily records will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderBehavior = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Student behavior oversight" description="Teachers submit reports, homeroom teachers manage the overall record, and Admin oversees quality and parent communication." />
      <SchoolPanel title="Recommend student disciplinary action">
        <form onSubmit={submitStudentDisciplinaryRecommendation} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Student"><select className={schoolSelectClass} value={disciplineStudentId} onChange={(event) => setDisciplineStudentId(event.target.value)}><option value="">Choose student</option>{students.map((student) => <option key={student.id} value={student.id}>{memberName(student.id)} · {sectionLabel(student.section_id)}</option>)}</select></SchoolField>
          <SchoolField label="Reason"><input className={schoolInputClass} value={disciplineReason} onChange={(event) => setDisciplineReason(event.target.value)} /></SchoolField>
          <div className="md:col-span-2"><SchoolField label="Recommended action"><textarea className={schoolTextareaClass} value={disciplineRecommendation} onChange={(event) => setDisciplineRecommendation(event.target.value)} /></SchoolField></div>
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit">Send recommendation to Manager</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Student disciplinary recommendations submitted">
        {disciplinaryRecommendations.length ? <div className="space-y-2">{disciplinaryRecommendations.map((item) => <div key={item.id} className="rounded-md border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{memberName(item.target_membership_id)}</p><SchoolStatus value={item.status} /></div><p className="mt-1 text-xs text-slate-600">{item.reason}</p><p className="mt-1 text-xs text-slate-600">Recommendation: {item.recommendation}</p>{item.decision_note && <p className="mt-1 text-xs text-emerald-700">Manager decision: {item.decision_note}</p>}</div>)}</div> : <SchoolEmptyState title="No recommendations submitted" description="Student disciplinary recommendations will be reviewed by the School Manager." />}
      </SchoolPanel>
      <SchoolPanel title="Pending behavior reports">
        {pendingBehaviors.length ? <div className="space-y-3">{pendingBehaviors.map((report) => <div key={report.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{memberName(report.student_membership_id)} · {report.report_type}</p><p className="mt-1 text-xs text-slate-500">{sectionLabel(report.section_id)} · Reported by {memberName(report.reported_by_membership_id)} · {report.severity} severity</p><p className="mt-2 text-sm text-slate-700">{report.description}</p></div><SchoolStatus value={report.status} /></div><textarea className={schoolTextareaClass + " mt-3"} value={reviewFeedback[report.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Review note (optional)" /><div className="mt-3 flex flex-wrap gap-2"><SchoolPrimaryButton onClick={() => void reviewBehavior(report.id, true)}><Check className="mr-2 h-4 w-4" />Approve report</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewBehavior(report.id, false)}><X className="mr-2 h-4 w-4" />Reject report</SchoolSecondaryButton></div></div>)}</div> : <SchoolEmptyState title="No pending behavior reports" description="Teacher-submitted reports awaiting review will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Behavior report history">
        {behaviorReports.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Class</th><th className="pb-2">Type</th><th className="pb-2">Reported by</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{behaviorReports.map((report) => <tr key={report.id}><td className="py-3 font-medium text-slate-800">{memberName(report.student_membership_id)}</td><td className="py-3 text-slate-600">{sectionLabel(report.section_id)}</td><td className="py-3 capitalize text-slate-600">{report.report_type}</td><td className="py-3 text-slate-600">{memberName(report.reported_by_membership_id)}</td><td className="py-3"><SchoolStatus value={report.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No behavior reports" description="Approved and pending reports appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderContent = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Content review" description="Approve teacher-created quizzes and library resources before students can access them." />
      <SchoolPanel title="Pending homework assignments">
        {pendingHomework.length ? <div className="space-y-3">{pendingHomework.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subject_name} · {sectionLabel(item.section_id)} · {memberName(item.teacher_membership_id)}</p><p className="mt-1 text-xs text-slate-500">Due {item.due_at ? new Date(item.due_at).toLocaleString() : "No due date"}</p></div><SchoolStatus value={item.status} /></div><textarea className={schoolTextareaClass + " mt-3"} value={reviewFeedback[item.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Review feedback (optional)" /><div className="mt-3 flex gap-2"><SchoolPrimaryButton onClick={() => void reviewHomework(item.id, true)}><Check className="mr-2 h-4 w-4" />Approve</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewHomework(item.id, false)}><X className="mr-2 h-4 w-4" />Return</SchoolSecondaryButton></div></div>)}</div> : <SchoolEmptyState title="No homework awaiting review" description="Teacher-submitted homework will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Pending quizzes">
        {pendingQuizzes.length ? <div className="space-y-3">{pendingQuizzes.map((quiz) => <div key={quiz.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{quiz.title}</p><p className="mt-1 text-xs text-slate-500">{quiz.subject} · {quiz.grade} · {sectionLabel(quiz.school_section_id)}</p></div><SchoolStatus value={quiz.school_review_status} /></div><textarea className={schoolTextareaClass + " mt-3"} value={reviewFeedback[quiz.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [quiz.id]: event.target.value }))} placeholder="Review feedback (optional)" /><div className="mt-3 flex gap-2"><SchoolPrimaryButton onClick={() => void reviewQuiz(quiz.id, true)}><Check className="mr-2 h-4 w-4" />Approve</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewQuiz(quiz.id, false)}><X className="mr-2 h-4 w-4" />Reject</SchoolSecondaryButton></div></div>)}</div> : <SchoolEmptyState title="No quizzes awaiting review" description="Submitted teacher quizzes will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Pending announcements">
        {pendingAnnouncements.length ? <div className="space-y-3">{pendingAnnouncements.map((announcement) => <div key={announcement.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{announcement.title}</p><p className="mt-1 text-xs capitalize text-slate-500">{announcement.audience_type} · {announcement.grade_label || sectionLabel(announcement.section_id)}</p></div><SchoolStatus value={announcement.status} /></div><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{announcement.body}</p><textarea className={schoolTextareaClass + " mt-3"} value={reviewFeedback[announcement.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [announcement.id]: event.target.value }))} placeholder="Review feedback (optional)" /><div className="mt-3 flex gap-2"><SchoolPrimaryButton onClick={() => void reviewAnnouncement(announcement.id, true)}><Check className="mr-2 h-4 w-4" />Publish</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewAnnouncement(announcement.id, false)}><X className="mr-2 h-4 w-4" />Reject</SchoolSecondaryButton></div></div>)}</div> : <SchoolEmptyState title="No announcements awaiting review" description="Teacher-submitted announcements will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Pending library resources">
        {pendingBooks.length ? <div className="space-y-3">{pendingBooks.map((book) => <div key={book.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{book.title}</p><p className="mt-1 text-xs text-slate-500">{book.subject} · {book.grade} · {sectionLabel(book.school_section_id)}</p></div><SchoolStatus value={book.school_review_status} /></div><textarea className={schoolTextareaClass + " mt-3"} value={reviewFeedback[book.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [book.id]: event.target.value }))} placeholder="Review feedback (optional)" /><div className="mt-3 flex gap-2"><SchoolPrimaryButton onClick={() => void reviewBook(book.id, true)}><Check className="mr-2 h-4 w-4" />Approve</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewBook(book.id, false)}><X className="mr-2 h-4 w-4" />Reject</SchoolSecondaryButton></div></div>)}</div> : <SchoolEmptyState title="No resources awaiting review" description="Submitted textbooks, notes, and PDFs will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderAnnouncements = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School announcements" description="Publish school-wide, grade, section, parent, or student announcements. Parents receive notifications for relevant announcements." />
      <SchoolPanel title="Publish announcement">
        <form onSubmit={createAnnouncement} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Title"><input className={schoolInputClass} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} /></SchoolField>
          <SchoolField label="Audience"><select className={schoolSelectClass} value={announcementAudience} onChange={(event) => setAnnouncementAudience(event.target.value)}><option value="school">Entire school</option><option value="grade">Specific grade</option><option value="section">Specific section</option><option value="parents">All parents</option><option value="students">All students</option><option value="staff">School staff</option></select></SchoolField>
          {announcementAudience === "grade" && <SchoolField label="Grade"><input className={schoolInputClass} value={announcementGrade} onChange={(event) => setAnnouncementGrade(event.target.value)} placeholder="Grade 9" /></SchoolField>}
          {announcementAudience === "section" && <SchoolField label="Section"><select className={schoolSelectClass} value={announcementSection} onChange={(event) => setAnnouncementSection(event.target.value)}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>}
          <div className="md:col-span-2"><SchoolField label="Message"><textarea className={schoolTextareaClass} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} rows={4} /></SchoolField></div>
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit"><Send className="mr-2 h-4 w-4" />Publish announcement</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Announcement register">
        {announcements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Title</th><th className="pb-2">Audience</th><th className="pb-2">Created</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{announcements.map((item) => <tr key={item.id}><td className="py-3 font-medium text-slate-800">{item.title}</td><td className="py-3 capitalize text-slate-600">{item.audience_type}</td><td className="py-3 text-slate-500">{new Date(item.created_at).toLocaleDateString()}</td><td className="py-3"><SchoolStatus value={item.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No announcements" description="Create the first school announcement." />}
      </SchoolPanel>
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School messages" description="Create direct conversations with a student, their parent, and assigned teachers, or create a class thread." />
      <SchoolPanel title="Start a conversation">
        <form onSubmit={createConversation} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Class conversation (optional)"><select className={schoolSelectClass} value={newConversationSection} onChange={(event) => { setNewConversationSection(event.target.value); if (event.target.value) setNewConversationStudent(""); }}><option value="">No class conversation</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
          {!newConversationSection && <>
            <SchoolField label="Student"><select className={schoolSelectClass} value={newConversationStudent} onChange={(event) => setNewConversationStudent(event.target.value)}><option value="">Choose student</option>{students.map((student) => <option key={student.id} value={student.id}>{memberName(student.id)} · {student.grade_label}</option>)}</select></SchoolField>
            <SchoolField label="Participants"><select multiple className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-2 text-sm" value={newConversationParticipants} onChange={(event) => setNewConversationParticipants(Array.from(event.target.selectedOptions).map((option) => option.value))}>{[...teachers, ...parents, ...activeMembers.filter((member) => member.school_role === "admin")].map((member) => <option key={member.id} value={member.id}>{memberName(member.id)} · {member.school_role}</option>)}</select></SchoolField>
          </>}
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit"><Plus className="mr-2 h-4 w-4" />Create conversation</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <div className="grid gap-4 xl:grid-cols-[minmax(250px,0.75fr)_minmax(0,1.25fr)]">
        <SchoolPanel title="Conversations">
          {conversations.length ? <div className="space-y-1">{conversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={["w-full rounded-md border px-3 py-2.5 text-left", selectedConversationId === conversation.id ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-slate-50"].join(" ")}><p className="text-sm font-medium text-slate-800">{conversation.conversation_type === "class" ? `Class · ${sectionLabel(conversation.section_id)}` : memberName(conversation.student_membership_id)}</p><p className="mt-1 text-xs text-slate-500">{conversation.subject_name || "School conversation"}</p></button>)}</div> : <SchoolEmptyState title="No conversations" description="Create a direct or class conversation to start messaging." />}
        </SchoolPanel>
        <SchoolPanel title="Messages">
          {selectedConversationId ? <>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">{messages.map((message) => <div key={message.id} className={["max-w-[85%] rounded-lg px-3 py-2 text-sm", message.sender_membership_id === activeMembership?.id ? "ml-auto bg-blue-600 text-white" : "bg-slate-100 text-slate-800"].join(" ")}><p>{message.body}</p><p className={["mt-1 text-[10px]", message.sender_membership_id === activeMembership?.id ? "text-blue-100" : "text-slate-500"].join(" ")}>{memberName(message.sender_membership_id)} · {new Date(message.created_at).toLocaleString()}</p></div>)}</div>
            <form onSubmit={sendMessage} className="mt-4 flex gap-2"><input className={schoolInputClass} value={newMessage} onChange={(event) => setNewMessage(event.target.value)} placeholder="Write a school message…" /><SchoolPrimaryButton type="submit"><Send className="h-4 w-4" /></SchoolPrimaryButton></form>
          </> : <SchoolEmptyState title="Select a conversation" description="Choose a conversation to read and send messages." />}
        </SchoolPanel>
      </div>
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Teacher academic tasks" description="Assign academic follow-up work to teachers and track completion." />
      <SchoolPanel title="Assign academic task">
        <form onSubmit={createTask} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SchoolField label="Teacher"><select className={schoolSelectClass} value={taskTargetId} onChange={(event) => setTaskTargetId(event.target.value)}><option value="">Choose teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{memberName(teacher.id)}</option>)}</select></SchoolField>
          <SchoolField label="Task title"><input className={schoolInputClass} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} /></SchoolField>
          <SchoolField label="Due date"><input type="date" className={schoolInputClass} value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} /></SchoolField>
          <SchoolField label="Description"><input className={schoolInputClass} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-4"><SchoolPrimaryButton type="submit">Assign task</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Task register">
        {tasks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Task</th><th className="pb-2">Teacher</th><th className="pb-2">Due</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{tasks.map((task) => <tr key={task.id}><td className="py-3 font-medium text-slate-800">{task.title}</td><td className="py-3 text-slate-600">{memberName(task.assigned_to_membership_id)}</td><td className="py-3 text-slate-600">{task.due_date || "—"}</td><td className="py-3"><SchoolStatus value={task.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No tasks assigned" description="Assign academic tasks to teachers above." />}
      </SchoolPanel>
    </div>
  );

  const renderStaffOversight = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Staff oversight" description="Submit confidential teacher conduct reports and recommend assignment changes to the School Manager." />
      <SchoolPanel title="Report teacher misconduct or academic irregularity">
        <form onSubmit={submitStaffConductReport} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Teacher"><select className={schoolSelectClass} value={conductTeacherId} onChange={(event) => setConductTeacherId(event.target.value)}><option value="">Choose teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{memberName(teacher.id)}</option>)}</select></SchoolField>
          <SchoolField label="Report type"><select className={schoolSelectClass} value={conductType} onChange={(event) => setConductType(event.target.value)}><option value="quality_concern">Repeated content quality concern</option><option value="academic_irregularity">Academic irregularity</option><option value="misconduct">Misconduct</option><option value="professional_conduct">Professional conduct</option><option value="other">Other</option></select></SchoolField>
          <SchoolField label="Severity"><select className={schoolSelectClass} value={conductSeverity} onChange={(event) => setConductSeverity(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></SchoolField>
          <div className="md:col-span-2"><SchoolField label="Details"><textarea className={schoolTextareaClass} value={conductDescription} onChange={(event) => setConductDescription(event.target.value)} /></SchoolField></div>
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit">Send confidential report to Manager</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Recommend teacher assignment change">
        <form onSubmit={submitAssignmentRecommendation} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SchoolField label="Teacher"><select className={schoolSelectClass} value={recommendTeacherId} onChange={(event) => { setRecommendTeacherId(event.target.value); setRecommendCurrentAssignmentId(""); }}><option value="">Choose teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{memberName(teacher.id)}</option>)}</select></SchoolField>
          <SchoolField label="Recommendation"><select className={schoolSelectClass} value={recommendationType} onChange={(event) => setRecommendationType(event.target.value)}><option value="add_assignment">Add assignment</option><option value="remove_assignment">Remove assignment</option><option value="change_assignment">Change assignment</option></select></SchoolField>
          {["remove_assignment", "change_assignment"].includes(recommendationType) && <SchoolField label="Current assignment"><select className={schoolSelectClass} value={recommendCurrentAssignmentId} onChange={(event) => setRecommendCurrentAssignmentId(event.target.value)}><option value="">Choose current assignment</option>{teacherAssignments.filter((assignment) => assignment.teacher_membership_id === recommendTeacherId).map((assignment) => <option key={assignment.id} value={assignment.id}>{sectionLabel(assignment.section_id)} · {assignment.subject_name} · {assignment.assignment_kind}</option>)}</select></SchoolField>}
          {["add_assignment", "change_assignment"].includes(recommendationType) && <>
            <SchoolField label="Requested section"><select className={schoolSelectClass} value={recommendSectionId} onChange={(event) => setRecommendSectionId(event.target.value)}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField>
            <SchoolField label="Assignment type"><select className={schoolSelectClass} value={recommendKind} onChange={(event) => setRecommendKind(event.target.value)}><option value="subject">Subject</option><option value="homeroom">Homeroom</option></select></SchoolField>
            {recommendKind === "subject" && <SchoolField label="Subject"><select className={schoolSelectClass} value={recommendSubject} onChange={(event) => setRecommendSubject(event.target.value)}><option value="">Choose subject</option>{subjects.filter((subject) => subject.active && subject.grade_label === sections.find((section) => section.id === recommendSectionId)?.grade_label && subject.academic_year_id === sections.find((section) => section.id === recommendSectionId)?.academic_year_id).map((subject) => <option key={subject.id} value={subject.subject_name}>{subject.subject_name}</option>)}</select></SchoolField>}
          </>}
          <div className="md:col-span-2 xl:col-span-3"><SchoolField label="Reason"><textarea className={schoolTextareaClass} value={recommendReason} onChange={(event) => setRecommendReason(event.target.value)} /></SchoolField></div>
          <div className="md:col-span-2 xl:col-span-3"><SchoolPrimaryButton type="submit">Send recommendation to Manager</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Conduct reports you submitted">
        {staffConductReports.length ? <div className="space-y-2">{staffConductReports.map((report) => <div key={report.id} className="rounded-md border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{memberName(report.target_teacher_membership_id)} · {report.report_type.replace(/_/g, " ")}</p><SchoolStatus value={report.status} /></div><p className="mt-1 text-xs text-slate-600">{report.description}</p>{report.manager_note && <p className="mt-1 text-xs text-emerald-700">Manager note: {report.manager_note}</p>}</div>)}</div> : <SchoolEmptyState title="No conduct reports submitted" description="Reports are visible to the School Manager." />}
      </SchoolPanel>
      <SchoolPanel title="Assignment recommendations">
        {assignmentRecommendations.length ? <div className="space-y-2">{assignmentRecommendations.map((item) => <div key={item.id} className="rounded-md border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{memberName(item.teacher_membership_id)} · {item.recommendation_type.replace(/_/g, " ")}</p><SchoolStatus value={item.status} /></div><p className="mt-1 text-xs text-slate-600">{item.reason}</p>{item.manager_note && <p className="mt-1 text-xs text-emerald-700">Manager note: {item.manager_note}</p>}</div>)}</div> : <SchoolEmptyState title="No assignment recommendations" description="Recommendations will be reviewed by the School Manager." />}
      </SchoolPanel>
    </div>
  );

  const renderFinance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Finance follow-ups" description="Review unpaid invoice reports submitted by the School Finance team and record the school's resolution." />
      <SchoolPanel title="Reported unpaid invoices">
        {financeFollowups.length ? <div className="space-y-3">{financeFollowups.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{memberName(item.student_membership_id)} · {item.invoice_id}</p><p className="mt-1 text-xs text-slate-500">Reported by {memberName(item.submitted_by_membership_id)} · {new Date(item.created_at).toLocaleString()}</p><p className="mt-2 text-sm text-slate-700">{item.note}</p></div><SchoolStatus value={item.status} /></div>{item.status !== "resolved" ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input className={schoolInputClass} value={financeResolutionNotes[item.id] || ""} onChange={(event) => setFinanceResolutionNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Resolution note (optional)" /><SchoolPrimaryButton onClick={() => void resolveFinanceFollowup(item.id)}>Mark resolved</SchoolPrimaryButton></div> : item.resolution_note && <p className="mt-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">Resolution: {item.resolution_note}</p>}</div>)}</div> : <SchoolEmptyState title="No finance follow-ups" description="Unpaid invoice reports from Finance will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Academic and student reports" description="School-wide reports based on approved academic records and published results." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Approved assessments" value={assessments.filter((item) => item.status === "approved" || item.status === "published").length} detail="Teacher submissions reviewed" icon={ClipboardCheck} />
        <SchoolMetric label="Approved marks" value={marks.filter((item) => item.status === "approved").length} detail="Eligible for official calculations" icon={Check} />
        <SchoolMetric label="Attendance records" value={attendanceRecords.length} detail="Loaded school attendance" icon={CalendarCheck} />
        <SchoolMetric label="Behavior reports" value={behaviorReports.length} detail="Approved and pending reports" icon={ShieldCheck} />
      </div>
      <SchoolPanel title="Attendance by status">
        <div className="grid gap-3 sm:grid-cols-4">{["present", "absent", "late", "excused"].map((status) => <div key={status} className="rounded-md border border-slate-100 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{status}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{attendanceRecords.filter((record) => record.attendance_status === status).length}</p></div>)}</div>
      </SchoolPanel>
    </div>
  );

  let content: React.ReactNode;
  switch (page) {
    case "students": content = renderStudents(); break;
    case "teachers": content = renderTeachers(); break;
    case "assessments": content = renderAssessments(); break;
    case "attendance": content = renderAttendance(); break;
    case "behavior": content = renderBehavior(); break;
    case "content": content = renderContent(); break;
    case "announcements": content = renderAnnouncements(); break;
    case "messages": content = renderMessages(); break;
    case "tasks": content = renderTasks(); break;
    case "reports": content = renderReports(); break;
    case "finance": content = renderFinance(); break;
    case "staff-oversight": content = renderStaffOversight(); break;
    default: content = renderOverview();
  }

  return (
    <SchoolPortalShell role="admin" roleLabelOverride="Main Director" title="Main Director" navItems={navItems} activeItem={page} onNavigate={setPage}>
      {loading && <div className="mb-4 text-xs text-slate-500">Refreshing school records…</div>}
      {content}
    </SchoolPortalShell>
  );
}
