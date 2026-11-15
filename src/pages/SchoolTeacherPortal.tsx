import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, School, ClipboardCheck, BookOpen, Library, CalendarCheck,
  ShieldCheck, MessageSquare, ClipboardList, BarChart3, Plus, Send, Check,
  RefreshCw, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField,
  schoolInputClass, schoolSelectClass, schoolTextareaClass,
} from "@/components/school/SchoolPortalPrimitives";
import { createBook } from "@/lib/libraryApi";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "classes", label: "My Classes", icon: School },
  { id: "assessments", label: "Assessments & Marks", icon: ClipboardCheck },
  { id: "quizzes", label: "Questions & Quizzes", icon: BookOpen },
  { id: "homework", label: "Homework", icon: ClipboardList },
  { id: "library", label: "Textbooks & Notes", icon: Library },
  { id: "attendance", label: "Homeroom Attendance", icon: CalendarCheck },
  { id: "behavior", label: "Behavior Reports", icon: ShieldCheck },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "tasks", label: "Assigned Tasks", icon: ClipboardList },
  { id: "progress", label: "Student Progress", icon: BarChart3 },
];

type QuizQuestionDraft = {
  key: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
  points: string;
};

let questionKey = 1;
const blankQuestion = (): QuizQuestionDraft => ({
  key: questionKey++, question_text: "", option_a: "", option_b: "",
  option_c: "", option_d: "", correct_answer: "", explanation: "", points: "10",
});

export default function SchoolTeacherPortal() {
  const { user } = useUser();
  const { activeSchool, activeMembership } = useSchoolPortal();
  const db = supabase as any;
  const schoolId = activeSchool?.id;
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [behaviorReports, setBehaviorReports] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);

  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentSectionId, setAssessmentSectionId] = useState("");
  const [assessmentSubject, setAssessmentSubject] = useState("");
  const [assessmentTermId, setAssessmentTermId] = useState("");
  const [assessmentCategoryId, setAssessmentCategoryId] = useState("");
  const [assessmentMaxScore, setAssessmentMaxScore] = useState("100");
  const [assessmentDueAt, setAssessmentDueAt] = useState("");
  const [assessmentInstructions, setAssessmentInstructions] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [markValues, setMarkValues] = useState<Record<string, string>>({});
  const [markNotes, setMarkNotes] = useState<Record<string, string>>({});

  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [quizSectionId, setQuizSectionId] = useState("");
  const [quizSubject, setQuizSubject] = useState("");
  const [quizDifficulty, setQuizDifficulty] = useState("medium");
  const [quizTimeLimit, setQuizTimeLimit] = useState("20");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>([blankQuestion()]);

  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [homeworkInstructions, setHomeworkInstructions] = useState("");
  const [homeworkSectionId, setHomeworkSectionId] = useState("");
  const [homeworkSubject, setHomeworkSubject] = useState("");
  const [homeworkDueAt, setHomeworkDueAt] = useState("");
  const [selectedHomeworkId, setSelectedHomeworkId] = useState("");
  const [gradeValues, setGradeValues] = useState<Record<string, string>>({});
  const [gradeFeedback, setGradeFeedback] = useState<Record<string, string>>({});

  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookDescription, setBookDescription] = useState("");
  const [bookSectionId, setBookSectionId] = useState("");
  const [bookSubject, setBookSubject] = useState("");
  const [bookType, setBookType] = useState<"textbook" | "notes" | "practice" | "reference">("textbook");
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [bookUploading, setBookUploading] = useState(false);

  const [attendanceSectionId, setAttendanceSectionId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [attendanceValues, setAttendanceValues] = useState<Record<string, string>>({});
  const [attendanceNotes, setAttendanceNotes] = useState<Record<string, string>>({});

  const [behaviorStudentId, setBehaviorStudentId] = useState("");
  const [behaviorType, setBehaviorType] = useState("positive");
  const [behaviorSeverity, setBehaviorSeverity] = useState("low");
  const [behaviorDescription, setBehaviorDescription] = useState("");

  const [messageStudentId, setMessageStudentId] = useState("");
  const [messageParticipants, setMessageParticipants] = useState<string[]>([]);
  const [parentContacts, setParentContacts] = useState<any[]>([]);
  const [messageSectionId, setMessageSectionId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [taskResponseById, setTaskResponseById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!schoolId || !activeMembership?.id) return;
    setLoading(true);
    const [
      assignmentsRes, sectionsRes, subjectsRes, termsRes, categoriesRes,
      membersRes, assessmentsRes, marksRes, homeworkRes, sessionsRes,
      behaviorRes, quizzesRes, booksRes, tasksRes, conversationsRes,
    ] = await Promise.all([
      db.from("school_teacher_assignments").select("id,section_id,subject_name,assignment_kind").eq("school_id", schoolId).eq("teacher_membership_id", activeMembership.id),
      db.from("school_sections").select("id,academic_year_id,grade_label,section_name,homeroom_teacher_id").eq("school_id", schoolId),
      db.from("school_subjects").select("id,academic_year_id,grade_label,subject_name,active").eq("school_id", schoolId).eq("active", true),
      db.from("school_terms").select("id,academic_year_id,name,term_number,starts_on,ends_on").eq("school_id", schoolId).order("term_number"),
      db.from("school_assessment_categories").select("id,academic_year_id,grade_label,category_name,category_key,weight_percent").eq("school_id", schoolId),
      db.from("school_memberships").select("id,user_id,school_role,status,grade_label,section_id,school_username,student_number").eq("school_id", schoolId).eq("school_role", "student"),
      db.from("school_assessments").select("id,title,section_id,subject_name,term_id,category_id,max_score,status,review_feedback,created_at").eq("school_id", schoolId).eq("created_by_membership_id", activeMembership.id).order("created_at", { ascending: false }),
      db.from("school_student_marks").select("id,assessment_id,student_membership_id,score,status,teacher_note").eq("school_id", schoolId).eq("entered_by_membership_id", activeMembership.id),
      db.from("school_homework_assignments").select("id,title,section_id,subject_name,due_at,status,review_feedback,created_at").eq("school_id", schoolId).eq("teacher_membership_id", activeMembership.id).order("created_at", { ascending: false }),
      db.from("school_attendance_sessions").select("id,section_id,attendance_date,status,submitted_at").eq("school_id", schoolId).eq("recorded_by_membership_id", activeMembership.id).order("attendance_date", { ascending: false }).limit(60),
      db.from("school_behavior_reports").select("id,student_membership_id,section_id,report_type,severity,description,status,created_at").eq("school_id", schoolId).eq("reported_by_membership_id", activeMembership.id).order("created_at", { ascending: false }).limit(100),
      db.from("quizzes").select("id,title,subject,grade,school_section_id,school_review_status,created_at").eq("school_id", schoolId).eq("school_teacher_membership_id", activeMembership.id).order("created_at", { ascending: false }),
      db.from("library_books").select("id,title,subject,grade,school_section_id,school_review_status,status,pdf_path").eq("school_id", schoolId).eq("uploader_id", user?.id),
      db.from("school_staff_tasks").select("id,title,description,status,due_date,priority,task_type,response,assigned_by_membership_id").eq("school_id", schoolId).eq("assigned_to_membership_id", activeMembership.id).order("created_at", { ascending: false }),
      db.from("school_conversations").select("id,conversation_type,section_id,student_membership_id,subject_name,last_message_at").eq("school_id", schoolId).order("last_message_at", { ascending: false }).limit(100),
    ]);
    const error = [assignmentsRes, sectionsRes, subjectsRes, termsRes, categoriesRes, membersRes, assessmentsRes, marksRes, homeworkRes, sessionsRes, behaviorRes, quizzesRes, booksRes, tasksRes, conversationsRes].find((result) => result.error)?.error;
    if (error) {
      toast.error(error.message || "Teacher workspace could not be loaded.");
      setLoading(false);
      return;
    }
    setAssignments(assignmentsRes.data ?? []);
    setSections(sectionsRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);
    setTerms(termsRes.data ?? []);
    setCategories(categoriesRes.data ?? []);
    setMembers(membersRes.data ?? []);
    setAssessments(assessmentsRes.data ?? []);
    setMarks(marksRes.data ?? []);
    setHomework(homeworkRes.data ?? []);
    setAttendanceSessions(sessionsRes.data ?? []);
    setBehaviorReports(behaviorRes.data ?? []);
    setQuizzes(quizzesRes.data ?? []);
    setBooks(booksRes.data ?? []);
    setTasks(tasksRes.data ?? []);
    setConversations(conversationsRes.data ?? []);
    if (!assessmentTermId && termsRes.data?.length) setAssessmentTermId(termsRes.data[0].id);
    const userIds = [...new Set((membersRes.data ?? []).map((member: any) => member.user_id))];
    if (user?.id) userIds.push(user.id);
    if (userIds.length) {
      const { data: profileRows } = await db.from("profiles").select("id,name,username").in("id", [...new Set(userIds)]);
      setProfiles(Object.fromEntries((profileRows ?? []).map((profile: any) => [profile.id, profile])));
    }
    const sectionIds = [...new Set((assignmentsRes.data ?? []).map((assignment: any) => assignment.section_id))];
    if (sectionIds.length) {
      const homeworkIds = (homeworkRes.data ?? []).map((item: any) => item.id);
      if (homeworkIds.length) {
        const { data: submissionRows, error: submissionError } = await db.from("school_homework_submissions").select("id,homework_id,student_membership_id,response_text,attachment_path,status,grade,feedback,submitted_at").in("homework_id", homeworkIds);
        if (submissionError) toast.error(submissionError.message);
        setSubmissions(submissionRows ?? []);
      } else setSubmissions([]);
      const sessionIds = (sessionsRes.data ?? []).map((session: any) => session.id);
      if (sessionIds.length) {
        const { data: recordRows, error: recordError } = await db.from("school_attendance_records").select("id,session_id,student_membership_id,attendance_status,note").in("session_id", sessionIds);
        if (recordError) toast.error(recordError.message);
        setAttendanceRecords(recordRows ?? []);
      } else setAttendanceRecords([]);
    } else {
      setSubmissions([]);
      setAttendanceRecords([]);
    }
    setLoading(false);
  }, [schoolId, activeMembership?.id, user?.id, db, assessmentTermId]);

  useEffect(() => { void load(); }, [load]);

  const assignedSectionIds = useMemo(() => [...new Set(assignments.map((assignment) => assignment.section_id))], [assignments]);
  const assignedSections = sections.filter((section) => assignedSectionIds.includes(section.id));
  const homeroomSectionIds = useMemo(() => [...new Set(assignments.filter((assignment) => assignment.assignment_kind === "homeroom").map((assignment) => assignment.section_id))], [assignments]);
  const homeroomSections = sections.filter((section) => homeroomSectionIds.includes(section.id));
  const assignedStudents = members.filter((member) => member.status === "active" && assignedSectionIds.includes(member.section_id));
  const memberName = (membershipId: string) => {
    const member = members.find((item) => item.id === membershipId);
    if (member) return profiles[member.user_id]?.name || member.school_username || "Student";
    return parentContacts.find((parent) => parent.parent_membership_id === membershipId)?.parent_name || "School member";
  };
  const sectionLabel = (sectionId: string | null) => {
    const section = sections.find((item) => item.id === sectionId);
    return section ? `${section.grade_label} ${section.section_name}` : "—";
  };
  const subjectsForSection = (sectionId: string) => {
    const section = sections.find((item) => item.id === sectionId);
    return subjects.filter((subject) => subject.grade_label === section?.grade_label && subject.academic_year_id === section?.academic_year_id);
  };
  const assignmentsForSection = (sectionId: string) => assignments.filter((assignment) => assignment.section_id === sectionId);
  const pendingAssessmentCount = assessments.filter((item) => ["draft", "rejected"].includes(item.status)).length;
  const pendingHomeworkCount = homework.filter((item) => ["draft", "rejected", "pending"].includes(item.status)).length;
  const pendingQuizCount = quizzes.filter((item) => ["draft", "rejected", "pending"].includes(item.school_review_status)).length;

  const createAssessment = async (event: React.FormEvent) => {
    event.preventDefault();
    const section = sections.find((item) => item.id === assessmentSectionId);
    if (!section || !assessmentTitle.trim() || !assessmentSubject || !assessmentTermId || !assessmentCategoryId || Number(assessmentMaxScore) <= 0) return toast.error("Complete all assessment details.");
    const { data, error } = await db.from("school_assessments").insert({
      school_id: schoolId, academic_year_id: section.academic_year_id, term_id: assessmentTermId,
      section_id: section.id, category_id: assessmentCategoryId, subject_name: assessmentSubject,
      title: assessmentTitle.trim(), instructions: assessmentInstructions.trim() || null,
      max_score: Number(assessmentMaxScore), due_at: assessmentDueAt || null,
      created_by_membership_id: activeMembership?.id, status: "draft",
    }).select("id").single();
    if (error) return toast.error(error.message);
    setSelectedAssessmentId(data.id);
    setAssessmentTitle(""); setAssessmentInstructions(""); setAssessmentDueAt("");
    toast.success("Assessment draft created. Enter student marks below.");
    await load();
  };

  const saveMarks = async () => {
    const assessment = assessments.find((item) => item.id === selectedAssessmentId);
    if (!assessment) return toast.error("Choose an assessment first.");
    const students = assignedStudents.filter((student) => student.section_id === assessment.section_id);
    const rows = students.filter((student) => markValues[student.id] !== undefined && markValues[student.id] !== "").map((student) => ({
      school_id: schoolId, assessment_id: assessment.id, student_membership_id: student.id,
      score: Number(markValues[student.id]), entered_by_membership_id: activeMembership?.id,
      status: "draft", teacher_note: markNotes[student.id] || null,
    }));
    if (!rows.length) return toast.error("Enter at least one student's mark.");
    if (rows.some((row) => !Number.isFinite(row.score) || row.score < 0 || row.score > Number(assessment.max_score))) return toast.error("Marks must be between 0 and the assessment maximum.");
    const { error } = await db.from("school_student_marks").upsert(rows, { onConflict: "assessment_id,student_membership_id" });
    if (error) return toast.error(error.message);
    toast.success("Draft marks saved.");
    await load();
  };

  const submitAssessment = async () => {
    if (!selectedAssessmentId) return toast.error("Choose an assessment first.");
    const { error } = await db.rpc("school_submit_assessment", { p_assessment_id: selectedAssessmentId });
    if (error) return toast.error(error.message);
    toast.success("Assessment and marks submitted to the School Admin for review.");
    await load();
  };

  const addQuestionRow = () => setQuizQuestions((current) => current.length < 40 ? [...current, blankQuestion()] : current);
  const updateQuestion = (key: number, patch: Partial<QuizQuestionDraft>) => setQuizQuestions((current) => current.map((question) => question.key === key ? { ...question, ...patch } : question));
  const createQuiz = async (event: React.FormEvent) => {
    event.preventDefault();
    if (activeMembership?.question_submission_suspended) return toast.error(activeMembership.question_submission_suspension_reason || "Question submissions are temporarily suspended by the School Admin.");
    const section = sections.find((item) => item.id === quizSectionId);
    const assigned = assignmentsForSection(quizSectionId).some((assignment) => assignment.assignment_kind === "subject" && assignment.subject_name === quizSubject);
    if (!section || !assigned || !quizTitle.trim() || !quizQuestions.length) return toast.error("Choose an assigned subject and complete the quiz title.");
    if (quizQuestions.some((question) => !question.question_text.trim() || !question.option_a.trim() || !question.option_b.trim() || !question.correct_answer)) return toast.error("Every question needs text, at least two options, and a correct answer.");
    const { data: quiz, error: quizError } = await db.from("quizzes").insert({
      title: quizTitle.trim(), description: quizDescription.trim(), subject: quizSubject,
      grade: section.grade_label, difficulty: quizDifficulty, time_limit: Number(quizTimeLimit) || 20,
      created_by: user?.id, is_approved: false, is_public: false,
      school_id: schoolId, school_section_id: section.id,
      school_teacher_membership_id: activeMembership?.id, school_review_status: "draft",
    }).select("id").single();
    if (quizError || !quiz) return toast.error(quizError?.message || "Quiz draft could not be created.");
    const questionRows = quizQuestions.map((question, index) => {
      const options = [question.option_a, question.option_b, question.option_c, question.option_d].filter((option) => option.trim());
      return {
        quiz_id: quiz.id, question_text: question.question_text.trim(), options,
        correct_answer: question.correct_answer, question_type: "Multiple Choice",
        points: Number(question.points) || 10, order_index: index,
        explanation: question.explanation.trim() || null,
      };
    });
    const { error: questionError } = await db.from("questions").insert(questionRows);
    if (questionError) {
      toast.error("Quiz draft was created, but its questions could not be saved: " + questionError.message);
      return;
    }
    const { error: submitError } = await db.rpc("school_submit_quiz", { p_quiz_id: quiz.id });
    if (submitError) return toast.error(submitError.message);
    setQuizTitle(""); setQuizDescription(""); setQuizQuestions([blankQuestion()]);
    toast.success("Quiz submitted to the School Admin for approval.");
    await load();
  };

  const createHomework = async (event: React.FormEvent) => {
    event.preventDefault();
    const section = sections.find((item) => item.id === homeworkSectionId);
    if (!section || !homeworkTitle.trim() || !homeworkInstructions.trim() || !homeworkSubject) return toast.error("Complete the homework details.");
    const { data, error } = await db.from("school_homework_assignments").insert({
      school_id: schoolId, section_id: section.id, teacher_membership_id: activeMembership?.id,
      subject_name: homeworkSubject, title: homeworkTitle.trim(), instructions: homeworkInstructions.trim(),
      due_at: homeworkDueAt || null, status: "draft",
    }).select("id").single();
    if (error || !data) return toast.error(error?.message || "Homework draft could not be created.");
    const { error: submitError } = await db.rpc("school_submit_homework", { p_homework_id: data.id });
    if (submitError) return toast.error(submitError.message);
    setHomeworkTitle(""); setHomeworkInstructions(""); setHomeworkDueAt("");
    toast.success("Homework submitted for School Admin approval.");
    await load();
  };

  const gradeSubmission = async (submission: any) => {
    const gradeText = gradeValues[submission.id] ?? (submission.grade === null || submission.grade === undefined ? "" : String(submission.grade));
    if (gradeText === undefined) return toast.error("Enter a grade, or clear the field to return the work for corrections.");
    const grade = gradeText.trim() === "" ? null : Number(gradeText);
    if (grade !== null && (!Number.isFinite(grade) || grade < 0)) return toast.error("Enter a valid non-negative grade.");
    const { error } = await db.from("school_homework_submissions").update({
      grade, feedback: gradeFeedback[submission.id] || null,
    }).eq("id", submission.id);
    if (error) return toast.error(error.message);
    toast.success("Homework feedback saved.");
    await load();
  };

  const uploadLibraryBook = async (event: React.FormEvent) => {
    event.preventDefault();
    const section = sections.find((item) => item.id === bookSectionId);
    if (!section || !bookTitle.trim() || !bookSubject || !bookFile || !user?.id) return toast.error("Complete the resource details and choose a PDF.");
    setBookUploading(true);
    try {
      await createBook({
        title: bookTitle.trim(), author: bookAuthor.trim() || user.name,
        subject: bookSubject, description: bookDescription.trim(),
        gradeLevel: Number(String(section.grade_label).match(/\d+/)?.[0] || 0) || null,
        type: bookType, bookCategory: "academic", pdfFile: bookFile,
        uploaderId: user.id, uploaderRole: "teacher",
        schoolSubmission: { schoolId: schoolId!, sectionId: section.id },
      });
      toast.success("Resource uploaded and sent to the School Admin for approval.");
      setBookTitle(""); setBookAuthor(""); setBookDescription(""); setBookFile(null);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Library resource upload failed.");
    } finally {
      setBookUploading(false);
    }
  };

  const recordAttendance = async (event: React.FormEvent) => {
    event.preventDefault();
    const section = sections.find((item) => item.id === attendanceSectionId);
    if (!section || !homeroomSectionIds.includes(section.id)) return toast.error("Only your assigned homeroom section can record daily attendance.");
    const students = assignedStudents.filter((student) => student.section_id === section.id);
    if (!students.length) return toast.error("No active students are enrolled in this section.");
    const { data: existingSession, error: existingError } = await db.from("school_attendance_sessions")
      .select("id,status")
      .eq("school_id", schoolId).eq("section_id", section.id).eq("attendance_date", attendanceDate)
      .maybeSingle();
    if (existingError) return toast.error(existingError.message);
    if (existingSession && existingSession.status !== "open") return toast.error("Attendance has already been submitted or locked for this section and date.");
    let sessionId = existingSession?.id;
    if (!sessionId) {
      const { data: sessionRow, error: sessionError } = await db.from("school_attendance_sessions").insert({
        school_id: schoolId, section_id: section.id, attendance_date: attendanceDate,
        recorded_by_membership_id: activeMembership?.id, status: "open",
      }).select("id").single();
      if (sessionError || !sessionRow) return toast.error(sessionError?.message || "Attendance session could not be created.");
      sessionId = sessionRow.id;
    }
    const rows = students.map((student) => ({
      school_id: schoolId, session_id: sessionId, student_membership_id: student.id,
      attendance_status: attendanceValues[student.id] || "present",
      note: attendanceNotes[student.id] || null,
    }));
    const { error: recordsError } = await db.from("school_attendance_records").upsert(rows, { onConflict: "session_id,student_membership_id" });
    if (recordsError) return toast.error("Attendance records could not be saved: " + recordsError.message);
    const { error: submitError } = await db.from("school_attendance_sessions").update({ status: "submitted" }).eq("id", sessionId);
    if (submitError) return toast.error(submitError.message);
    toast.success("Attendance submitted. Parents of linked students will receive updates.");
    setAttendanceValues({}); setAttendanceNotes({});
    await load();
  };

  const createBehaviorReport = async (event: React.FormEvent) => {
    event.preventDefault();
    const student = members.find((member) => member.id === behaviorStudentId);
    if (!student || !behaviorDescription.trim()) return toast.error("Choose a student and describe the behavior.");
    const { error } = await db.from("school_behavior_reports").insert({
      school_id: schoolId, student_membership_id: student.id, section_id: student.section_id,
      reported_by_membership_id: activeMembership?.id, report_type: behaviorType,
      severity: behaviorSeverity, description: behaviorDescription.trim(), status: "pending",
    });
    if (error) return toast.error(error.message);
    setBehaviorDescription("");
    toast.success("Behavior report submitted to the homeroom teacher for review.");
    await load();
  };

  const createConversation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (messageSectionId) {
      const { data, error } = await db.rpc("school_create_conversation", {
        p_school_id: schoolId, p_conversation_type: "class", p_section_id: messageSectionId,
        p_participant_membership_ids: [], p_subject_name: null,
      });
      if (error) return toast.error(error.message);
      setSelectedConversationId(data); setMessageSectionId("");
      toast.success("Class conversation created.");
      await load();
      return;
    }
    if (!messageStudentId) return toast.error("Choose a student.");
    const { data, error } = await db.rpc("school_create_conversation", {
      p_school_id: schoolId, p_conversation_type: "direct",
      p_student_membership_id: messageStudentId,
      p_participant_membership_ids: [...new Set([activeMembership?.id, ...messageParticipants].filter(Boolean))],
      p_subject_name: null,
    });
    if (error) return toast.error(error.message);
    setSelectedConversationId(data); setMessageStudentId(""); setMessageParticipants([]);
    toast.success("Direct conversation created.");
    await load();
  };

  useEffect(() => {
    if (!messageStudentId) { setParentContacts([]); setMessageParticipants([]); return; }
    let cancelled = false;
    const loadParentContacts = async () => {
      const { data, error } = await db.rpc("school_teacher_parent_contacts", { p_student_membership_id: messageStudentId });
      if (cancelled) return;
      if (error) {
        setParentContacts([]);
        toast.error(error.message);
      } else setParentContacts(data ?? []);
    };
    void loadParentContacts();
    return () => { cancelled = true; };
  }, [messageStudentId, db]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedConversationId || !messageDraft.trim()) return;
    const { error } = await db.from("school_messages").insert({
      school_id: schoolId, conversation_id: selectedConversationId,
      sender_membership_id: activeMembership?.id, body: messageDraft.trim(),
    });
    if (error) return toast.error(error.message);
    setMessageDraft("");
    const { data } = await db.from("school_messages").select("id,body,sender_membership_id,created_at").eq("school_id", schoolId).eq("conversation_id", selectedConversationId).order("created_at", { ascending: true });
    setMessages(data ?? []);
  };

  const updateTask = async (task: any, status: "in_progress" | "submitted") => {
    const { error } = await db.from("school_staff_tasks").update({ status, response: taskResponseById[task.id] ?? task.response ?? null }).eq("id", task.id);
    if (error) return toast.error(error.message);
    setTaskResponseById((current) => ({ ...current, [task.id]: "" }));
    toast.success(status === "submitted" ? "Task submitted for review." : "Task marked in progress.");
    await load();
  };

  useEffect(() => {
    if (!selectedConversationId || !schoolId) { setMessages([]); return; }
    let cancelled = false;
    const fetchMessages = async () => {
      const { data, error } = await db.from("school_messages").select("id,body,sender_membership_id,created_at").eq("school_id", schoolId).eq("conversation_id", selectedConversationId).order("created_at", { ascending: true });
      if (!cancelled) {
        if (error) toast.error(error.message);
        else setMessages(data ?? []);
      }
    };
    void fetchMessages();
    return () => { cancelled = true; };
  }, [selectedConversationId, schoolId, db]);

  const renderOverview = () => (
    <div className="space-y-6">
      <SchoolPageHeading title="Teacher workspace" description="Your assigned classes, academic work, student support, and school communications." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Assigned sections" value={assignedSections.length} detail="Classes you are responsible for" icon={School} />
        <SchoolMetric label="Active students" value={assignedStudents.length} detail="Students in your assigned sections" icon={School} />
        <SchoolMetric label="Assessments" value={assessments.length} detail="Your assessment records" icon={ClipboardCheck} />
        <SchoolMetric label="Homework awaiting review" value={pendingHomeworkCount} detail="Draft, returned, or pending approval" icon={ClipboardList} />
        <SchoolMetric label="Quizzes awaiting approval" value={pendingQuizCount} detail="Your quiz submissions" icon={BookOpen} />
        <SchoolMetric label="Homeroom sections" value={homeroomSections.length} detail="Sections where you record daily attendance" icon={CalendarCheck} />
        <SchoolMetric label="Behavior reports" value={behaviorReports.length} detail="Reports you have submitted" icon={ShieldCheck} />
        <SchoolMetric label="Assigned tasks" value={tasks.filter((task) => !["verified", "cancelled"].includes(task.status)).length} detail="School follow-up work" icon={ClipboardList} />
      </div>
      <SchoolPanel title="Your class responsibilities">
        {assignments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Section</th><th className="pb-2">Subject / role</th><th className="pb-2">Assignment</th></tr></thead><tbody className="divide-y divide-slate-100">{assignments.map((assignment) => <tr key={assignment.id}><td className="py-3 font-medium text-slate-800">{sectionLabel(assignment.section_id)}</td><td className="py-3 text-slate-600">{assignment.subject_name}</td><td className="py-3 capitalize text-slate-600">{assignment.assignment_kind}</td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No class assignments" description="The School Manager or Admin must assign your subjects and sections before you can access class records." />}
      </SchoolPanel>
    </div>
  );

  const renderClasses = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="My classes" description="Only students in your assigned sections are included in your class records." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{assignedSections.map((section) => <SchoolPanel key={section.id} title={sectionLabel(section.id)} description={`${assignedStudents.filter((student) => student.section_id === section.id).length} active students`}><div className="space-y-2">{assignmentsForSection(section.id).map((assignment) => <div key={assignment.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"><span className="text-sm text-slate-700">{assignment.subject_name}</span><SchoolStatus value={assignment.assignment_kind} /></div>)}</div></SchoolPanel>)}</div>
      {!assignedSections.length && <SchoolEmptyState title="No assigned classes" description="Your class list will appear after the School Manager assigns your sections." />}
    </div>
  );

  const renderAssessments = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Assessments & marks" description="Create class activities, tests, and exam assessments. Save marks as drafts, then submit the assessment to the School Admin for verification." />
      <SchoolPanel title="Create assessment">
        <form onSubmit={createAssessment} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SchoolField label="Assessment title"><input className={schoolInputClass} value={assessmentTitle} onChange={(event) => setAssessmentTitle(event.target.value)} placeholder="Chapter 1 test" /></SchoolField>
          <SchoolField label="Assigned section"><select className={schoolSelectClass} value={assessmentSectionId} onChange={(event) => setAssessmentSectionId(event.target.value)}><option value="">Choose section</option>{assignedSections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField>
          <SchoolField label="Assigned subject"><select className={schoolSelectClass} value={assessmentSubject} onChange={(event) => setAssessmentSubject(event.target.value)}><option value="">Choose subject</option>{assignmentsForSection(assessmentSectionId).filter((assignment) => assignment.assignment_kind === "subject").map((assignment) => <option key={assignment.id} value={assignment.subject_name}>{assignment.subject_name}</option>)}</select></SchoolField>
          <SchoolField label="Term"><select className={schoolSelectClass} value={assessmentTermId} onChange={(event) => setAssessmentTermId(event.target.value)}><option value="">Choose term</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></SchoolField>
          <SchoolField label="Assessment category"><select className={schoolSelectClass} value={assessmentCategoryId} onChange={(event) => setAssessmentCategoryId(event.target.value)}><option value="">Choose category</option>{categories.filter((category) => category.grade_label === sections.find((section) => section.id === assessmentSectionId)?.grade_label && category.academic_year_id === sections.find((section) => section.id === assessmentSectionId)?.academic_year_id).map((category) => <option key={category.id} value={category.id}>{category.category_name} · {category.weight_percent}%</option>)}</select></SchoolField>
          <SchoolField label="Maximum score"><input type="number" min="1" step="0.5" className={schoolInputClass} value={assessmentMaxScore} onChange={(event) => setAssessmentMaxScore(event.target.value)} /></SchoolField>
          <SchoolField label="Due date"><input type="datetime-local" className={schoolInputClass} value={assessmentDueAt} onChange={(event) => setAssessmentDueAt(event.target.value)} /></SchoolField>
          <SchoolField label="Instructions"><input className={schoolInputClass} value={assessmentInstructions} onChange={(event) => setAssessmentInstructions(event.target.value)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-4"><SchoolPrimaryButton type="submit">Create assessment draft</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Enter student marks" description="Choose one of your draft or rejected assessments, enter scores, and save.">
        <div className="mb-4 max-w-md"><SchoolField label="Assessment"><select className={schoolSelectClass} value={selectedAssessmentId} onChange={(event) => setSelectedAssessmentId(event.target.value)}><option value="">Choose assessment</option>{assessments.filter((item) => ["draft", "rejected"].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{item.title} · {sectionLabel(item.section_id)}</option>)}</select></SchoolField></div>
        {selectedAssessmentId ? <div className="space-y-3">{assignedStudents.filter((student) => student.section_id === assessments.find((item) => item.id === selectedAssessmentId)?.section_id).map((student) => <div key={student.id} className="grid gap-2 rounded-md border border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)] sm:items-center"><div><p className="text-sm font-medium text-slate-800">{memberName(student.id)}</p><p className="text-xs text-slate-500">{student.school_username}</p></div><SchoolField label="Score"><input type="number" min="0" max={assessments.find((item) => item.id === selectedAssessmentId)?.max_score || 100} step="0.5" className={schoolInputClass} value={markValues[student.id] ?? marks.find((mark) => mark.assessment_id === selectedAssessmentId && mark.student_membership_id === student.id)?.score ?? ""} onChange={(event) => setMarkValues((current) => ({ ...current, [student.id]: event.target.value }))} /></SchoolField><SchoolField label="Teacher note"><input className={schoolInputClass} value={markNotes[student.id] ?? ""} onChange={(event) => setMarkNotes((current) => ({ ...current, [student.id]: event.target.value }))} /></SchoolField></div>)}
          <div className="flex flex-wrap gap-2"><SchoolPrimaryButton onClick={() => void saveMarks()}>Save draft marks</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void submitAssessment()}>Submit for Admin review</SchoolSecondaryButton></div>
        </div> : <SchoolEmptyState title="Choose an assessment" description="Student mark entry will appear after you select a draft or rejected assessment." />}
      </SchoolPanel>
      <SchoolPanel title="Your assessment records">
        {assessments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Assessment</th><th className="pb-2">Class</th><th className="pb-2">Subject</th><th className="pb-2">Marks</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{assessments.map((item) => <tr key={item.id}><td className="py-3 font-medium text-slate-800">{item.title}</td><td className="py-3 text-slate-600">{sectionLabel(item.section_id)}</td><td className="py-3 text-slate-600">{item.subject_name}</td><td className="py-3 tabular-nums text-slate-600">{marks.filter((mark) => mark.assessment_id === item.id).length}</td><td className="py-3"><SchoolStatus value={item.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No assessments yet" description="Create your first assessment above." />}
      </SchoolPanel>
    </div>
  );

  const renderQuizzes = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Questions & quizzes" description="Create original questions for your assigned subjects. Every school quiz is reviewed by the School Admin before students can access it." />
      <SchoolPanel title="Create quiz and questions">
        {activeMembership?.question_submission_suspended && <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Question submissions are temporarily suspended by the School Admin. Your teacher account and other portal features remain active. Reason: {activeMembership.question_submission_suspension_reason}</div>}
        <form onSubmit={createQuiz} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SchoolField label="Quiz title"><input className={schoolInputClass} value={quizTitle} onChange={(event) => setQuizTitle(event.target.value)} /></SchoolField>
            <SchoolField label="Assigned section"><select className={schoolSelectClass} value={quizSectionId} onChange={(event) => setQuizSectionId(event.target.value)}><option value="">Choose section</option>{assignedSections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField>
            <SchoolField label="Subject"><select className={schoolSelectClass} value={quizSubject} onChange={(event) => setQuizSubject(event.target.value)}><option value="">Choose subject</option>{assignmentsForSection(quizSectionId).filter((assignment) => assignment.assignment_kind === "subject").map((assignment) => <option key={assignment.id} value={assignment.subject_name}>{assignment.subject_name}</option>)}</select></SchoolField>
            <SchoolField label="Difficulty"><select className={schoolSelectClass} value={quizDifficulty} onChange={(event) => setQuizDifficulty(event.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="extreme">Extreme</option></select></SchoolField>
            <SchoolField label="Time limit (minutes)"><input type="number" min="1" className={schoolInputClass} value={quizTimeLimit} onChange={(event) => setQuizTimeLimit(event.target.value)} /></SchoolField>
            <SchoolField label="Description"><input className={schoolInputClass} value={quizDescription} onChange={(event) => setQuizDescription(event.target.value)} /></SchoolField>
          </div>
          <div className="space-y-3">
            {quizQuestions.map((question, index) => <div key={question.key} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {index + 1}</p>{quizQuestions.length > 1 && <button type="button" onClick={() => setQuizQuestions((current) => current.filter((item) => item.key !== question.key))} className="text-xs font-semibold text-red-600">Remove</button>}</div>
              <SchoolField label="Question text"><textarea className={schoolTextareaClass} value={question.question_text} onChange={(event) => updateQuestion(question.key, { question_text: event.target.value })} /></SchoolField>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {(["option_a", "option_b", "option_c", "option_d"] as const).map((key) => <SchoolField key={key} label={key.replace("option_", "Option ").toUpperCase()}><input className={schoolInputClass} value={question[key]} onChange={(event) => updateQuestion(question.key, { [key]: event.target.value })} /></SchoolField>)}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <SchoolField label="Correct answer"><select className={schoolSelectClass} value={question.correct_answer} onChange={(event) => updateQuestion(question.key, { correct_answer: event.target.value })}><option value="">Choose correct option</option>{[question.option_a, question.option_b, question.option_c, question.option_d].filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}</select></SchoolField>
                <SchoolField label="Points"><input type="number" min="1" className={schoolInputClass} value={question.points} onChange={(event) => updateQuestion(question.key, { points: event.target.value })} /></SchoolField>
                <SchoolField label="Explanation"><input className={schoolInputClass} value={question.explanation} onChange={(event) => updateQuestion(question.key, { explanation: event.target.value })} /></SchoolField>
              </div>
            </div>)}
          </div>
          <div className="flex flex-wrap gap-2"><SchoolSecondaryButton onClick={addQuestionRow} disabled={quizQuestions.length >= 40}><Plus className="mr-2 h-4 w-4" />Add question</SchoolSecondaryButton><SchoolPrimaryButton type="submit" disabled={Boolean(activeMembership?.question_submission_suspended)}>Submit quiz for Admin approval</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Your submitted quizzes">
        {quizzes.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Quiz</th><th className="pb-2">Class</th><th className="pb-2">Subject</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{quizzes.map((quiz) => <tr key={quiz.id}><td className="py-3 font-medium text-slate-800">{quiz.title}</td><td className="py-3 text-slate-600">{sectionLabel(quiz.school_section_id)}</td><td className="py-3 text-slate-600">{quiz.subject}</td><td className="py-3"><SchoolStatus value={quiz.school_review_status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No quizzes created" description="Create a quiz for one of your assigned subjects." />}
      </SchoolPanel>
    </div>
  );

  const renderHomework = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Homework & assignments" description="Create homework for your assigned sections. School Admin approves it before students and parents can see it." />
      <SchoolPanel title="Create homework">
        <form onSubmit={createHomework} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Title"><input className={schoolInputClass} value={homeworkTitle} onChange={(event) => setHomeworkTitle(event.target.value)} /></SchoolField>
          <SchoolField label="Section"><select className={schoolSelectClass} value={homeworkSectionId} onChange={(event) => setHomeworkSectionId(event.target.value)}><option value="">Choose section</option>{assignedSections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField>
          <SchoolField label="Subject"><select className={schoolSelectClass} value={homeworkSubject} onChange={(event) => setHomeworkSubject(event.target.value)}><option value="">Choose subject</option>{assignmentsForSection(homeworkSectionId).filter((assignment) => assignment.assignment_kind === "subject").map((assignment) => <option key={assignment.id} value={assignment.subject_name}>{assignment.subject_name}</option>)}</select></SchoolField>
          <SchoolField label="Due date"><input type="datetime-local" className={schoolInputClass} value={homeworkDueAt} onChange={(event) => setHomeworkDueAt(event.target.value)} /></SchoolField>
          <div className="md:col-span-2"><SchoolField label="Instructions"><textarea className={schoolTextareaClass} rows={4} value={homeworkInstructions} onChange={(event) => setHomeworkInstructions(event.target.value)} /></SchoolField></div>
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit">Submit homework for approval</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Your homework">
        {homework.length ? <div className="space-y-3">{homework.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{sectionLabel(item.section_id)} · {item.subject_name} · Due {item.due_at ? new Date(item.due_at).toLocaleString() : "No due date"}</p></div><SchoolStatus value={item.status} /></div>{item.review_feedback && <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">Admin feedback: {item.review_feedback}</p>}<button type="button" onClick={() => setSelectedHomeworkId(item.id)} className="mt-3 text-xs font-semibold text-blue-700 hover:underline">View student submissions ({submissions.filter((submission) => submission.homework_id === item.id).length})</button></div>)}</div> : <SchoolEmptyState title="No homework assignments" description="Create homework above." />}
      </SchoolPanel>
      {selectedHomeworkId && <SchoolPanel title="Student submissions" action={<button type="button" onClick={() => setSelectedHomeworkId("")} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Close</button>}>
        {submissions.filter((submission) => submission.homework_id === selectedHomeworkId).length ? <div className="space-y-3">{submissions.filter((submission) => submission.homework_id === selectedHomeworkId).map((submission) => <div key={submission.id} className="rounded-md border border-slate-100 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-800">{memberName(submission.student_membership_id)}</p><SchoolStatus value={submission.status} /></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{submission.response_text || "No written response"}</p>{submission.attachment_path && <p className="mt-1 text-xs text-slate-500">Attachment: {submission.attachment_path}</p>}<div className="mt-3 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_auto]"><input type="number" min="0" className={schoolInputClass} placeholder="Grade" value={gradeValues[submission.id] ?? submission.grade ?? ""} onChange={(event) => setGradeValues((current) => ({ ...current, [submission.id]: event.target.value }))} /><input className={schoolInputClass} placeholder="Feedback" value={gradeFeedback[submission.id] ?? submission.feedback ?? ""} onChange={(event) => setGradeFeedback((current) => ({ ...current, [submission.id]: event.target.value }))} /><SchoolSecondaryButton onClick={() => void gradeSubmission(submission)}>Save feedback</SchoolSecondaryButton></div></div>)}</div> : <SchoolEmptyState title="No submissions yet" description="Student submissions appear after homework is approved." />}
      </SchoolPanel>}
    </div>
  );

  const renderLibrary = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Textbooks, notes & resources" description="Upload PDFs for your assigned subject and section. Resources remain unavailable to students until the School Admin approves them." />
      <SchoolPanel title="Upload learning resource">
        <form onSubmit={uploadLibraryBook} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SchoolField label="Resource title"><input className={schoolInputClass} value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} /></SchoolField>
          <SchoolField label="Author"><input className={schoolInputClass} value={bookAuthor} onChange={(event) => setBookAuthor(event.target.value)} /></SchoolField>
          <SchoolField label="Assigned section"><select className={schoolSelectClass} value={bookSectionId} onChange={(event) => setBookSectionId(event.target.value)}><option value="">Choose section</option>{assignedSections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField>
          <SchoolField label="Subject"><select className={schoolSelectClass} value={bookSubject} onChange={(event) => setBookSubject(event.target.value)}><option value="">Choose subject</option>{assignmentsForSection(bookSectionId).filter((assignment) => assignment.assignment_kind === "subject").map((assignment) => <option key={assignment.id} value={assignment.subject_name}>{assignment.subject_name}</option>)}</select></SchoolField>
          <SchoolField label="Resource type"><select className={schoolSelectClass} value={bookType} onChange={(event) => setBookType(event.target.value as typeof bookType)}><option value="textbook">Textbook</option><option value="notes">Notes</option><option value="practice">Practice</option><option value="reference">Reference</option></select></SchoolField>
          <SchoolField label="PDF file"><input type="file" accept="application/pdf,.pdf" className={schoolInputClass + " py-2"} onChange={(event) => setBookFile(event.target.files?.[0] ?? null)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-3"><SchoolField label="Description"><textarea className={schoolTextareaClass} value={bookDescription} onChange={(event) => setBookDescription(event.target.value)} /></SchoolField></div>
          <div className="md:col-span-2 xl:col-span-3"><SchoolPrimaryButton type="submit" disabled={bookUploading}><Upload className="mr-2 h-4 w-4" />{bookUploading ? "Uploading…" : "Upload for Admin approval"}</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Your submitted resources">
        {books.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Resource</th><th className="pb-2">Class</th><th className="pb-2">Subject</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{books.map((book) => <tr key={book.id}><td className="py-3 font-medium text-slate-800">{book.title}</td><td className="py-3 text-slate-600">{sectionLabel(book.school_section_id)}</td><td className="py-3 text-slate-600">{book.subject}</td><td className="py-3"><SchoolStatus value={book.school_review_status || book.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No resources uploaded" description="Upload textbooks, notes, and learning PDFs for your assigned classes." />}
      </SchoolPanel>
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Homeroom attendance" description="Daily attendance can only be recorded for sections where you are the assigned homeroom teacher." />
      <SchoolPanel title="Record daily attendance">
        {!homeroomSections.length ? <SchoolEmptyState title="No homeroom section assigned" description="You can record attendance after the School Manager assigns you as a homeroom teacher." /> : <form onSubmit={recordAttendance} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2"><SchoolField label="Homeroom section"><select className={schoolSelectClass} value={attendanceSectionId} onChange={(event) => setAttendanceSectionId(event.target.value)}><option value="">Choose homeroom section</option>{homeroomSections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField><SchoolField label="Attendance date"><input type="date" className={schoolInputClass} value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></SchoolField></div>
          {assignedStudents.filter((student) => student.section_id === attendanceSectionId).map((student) => <div key={student.id} className="grid gap-2 rounded-md border border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)] sm:items-center"><p className="text-sm font-medium text-slate-800">{memberName(student.id)}</p><select className={schoolSelectClass} value={attendanceValues[student.id] || "present"} onChange={(event) => setAttendanceValues((current) => ({ ...current, [student.id]: event.target.value }))}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select><input className={schoolInputClass} placeholder="Optional note" value={attendanceNotes[student.id] || ""} onChange={(event) => setAttendanceNotes((current) => ({ ...current, [student.id]: event.target.value }))} /></div>)}
          <SchoolPrimaryButton type="submit" disabled={!attendanceSectionId}>Submit attendance</SchoolPrimaryButton>
        </form>}
      </SchoolPanel>
      <SchoolPanel title="Attendance history">
        {attendanceSessions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Date</th><th className="pb-2">Section</th><th className="pb-2">Records</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{attendanceSessions.map((session) => <tr key={session.id}><td className="py-3 text-slate-700">{session.attendance_date}</td><td className="py-3 text-slate-600">{sectionLabel(session.section_id)}</td><td className="py-3 tabular-nums text-slate-600">{attendanceRecords.filter((record) => record.session_id === session.id).length}</td><td className="py-3"><SchoolStatus value={session.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No attendance records" description="Submitted homeroom attendance sessions will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderBehavior = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Student behavior reports" description="Submit observations about students you teach. Their homeroom teacher reviews and manages the overall behavior record." />
      <SchoolPanel title="Submit behavior report">
        <form onSubmit={createBehaviorReport} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Student"><select className={schoolSelectClass} value={behaviorStudentId} onChange={(event) => setBehaviorStudentId(event.target.value)}><option value="">Choose student</option>{assignedStudents.map((student) => <option key={student.id} value={student.id}>{memberName(student.id)} · {sectionLabel(student.section_id)}</option>)}</select></SchoolField>
          <SchoolField label="Report type"><select className={schoolSelectClass} value={behaviorType} onChange={(event) => setBehaviorType(event.target.value)}><option value="positive">Positive behavior</option><option value="concern">Behavior concern</option><option value="incident">Incident</option><option value="academic_integrity">Academic integrity</option></select></SchoolField>
          <SchoolField label="Severity"><select className={schoolSelectClass} value={behaviorSeverity} onChange={(event) => setBehaviorSeverity(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></SchoolField>
          <div className="md:col-span-2"><SchoolField label="Description"><textarea className={schoolTextareaClass} value={behaviorDescription} onChange={(event) => setBehaviorDescription(event.target.value)} /></SchoolField></div>
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit">Submit to homeroom teacher</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Reports you submitted">
        {behaviorReports.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Class</th><th className="pb-2">Type</th><th className="pb-2">Severity</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{behaviorReports.map((report) => <tr key={report.id}><td className="py-3 font-medium text-slate-800">{memberName(report.student_membership_id)}</td><td className="py-3 text-slate-600">{sectionLabel(report.section_id)}</td><td className="py-3 capitalize text-slate-600">{report.report_type}</td><td className="py-3 capitalize text-slate-600">{report.severity}</td><td className="py-3"><SchoolStatus value={report.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No behavior reports" description="Your submitted reports will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Class and parent communication" description="Create a class thread or direct conversation with a student and their parent." />
      <SchoolPanel title="Start conversation">
        <form onSubmit={createConversation} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Class thread (optional)"><select className={schoolSelectClass} value={messageSectionId} onChange={(event) => setMessageSectionId(event.target.value)}><option value="">No class thread</option>{assignedSections.map((section) => <option key={section.id} value={section.id}>{sectionLabel(section.id)}</option>)}</select></SchoolField>
          {!messageSectionId && <>
            <SchoolField label="Student"><select className={schoolSelectClass} value={messageStudentId} onChange={(event) => setMessageStudentId(event.target.value)}><option value="">Choose student</option>{assignedStudents.map((student) => <option key={student.id} value={student.id}>{memberName(student.id)}</option>)}</select></SchoolField>
            <SchoolField label="Linked parent contacts"><select multiple className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-2 text-sm" value={messageParticipants} onChange={(event) => setMessageParticipants(Array.from(event.target.selectedOptions).map((option) => option.value))}>{parentContacts.map((parent) => <option key={parent.parent_membership_id} value={parent.parent_membership_id}>{parent.parent_name}</option>)}</select></SchoolField>
          </>}
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit"><Plus className="mr-2 h-4 w-4" />Create conversation</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <div className="grid gap-4 xl:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
        <SchoolPanel title="Conversations">{conversations.length ? <div className="space-y-1">{conversations.map((conversation) => <button key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={["w-full rounded-md border px-3 py-2.5 text-left", selectedConversationId === conversation.id ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-slate-50"].join(" ")}><p className="text-sm font-medium text-slate-800">{conversation.conversation_type === "class" ? `Class · ${sectionLabel(conversation.section_id)}` : memberName(conversation.student_membership_id)}</p><p className="mt-1 text-xs text-slate-500">{conversation.subject_name || "School conversation"}</p></button>)}</div> : <SchoolEmptyState title="No conversations" description="Create a class thread or direct conversation." />}</SchoolPanel>
        <SchoolPanel title="Messages">{selectedConversationId ? <><div className="max-h-[420px] space-y-3 overflow-y-auto">{messages.map((message) => <div key={message.id} className={["max-w-[85%] rounded-lg px-3 py-2 text-sm", message.sender_membership_id === activeMembership?.id ? "ml-auto bg-blue-600 text-white" : "bg-slate-100 text-slate-800"].join(" ")}><p>{message.body}</p><p className="mt-1 text-[10px] opacity-70">{memberName(message.sender_membership_id)} · {new Date(message.created_at).toLocaleString()}</p></div>)}</div><form onSubmit={sendMessage} className="mt-4 flex gap-2"><input className={schoolInputClass} value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Write a message…" /><SchoolPrimaryButton type="submit"><Send className="h-4 w-4" /></SchoolPrimaryButton></form></> : <SchoolEmptyState title="Select a conversation" description="Choose a conversation to read and reply." />}</SchoolPanel>
      </div>
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Assigned tasks" description="Complete follow-up tasks assigned by the School Manager or Admin, and submit your work for review." />
      <SchoolPanel title="Your task list">
        {tasks.length ? <div className="space-y-3">{tasks.map((task) => <div key={task.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.task_type} · {task.priority} priority · {task.due_date ? `Due ${task.due_date}` : "No due date"}</p><p className="mt-2 text-sm text-slate-700">{task.description}</p></div><SchoolStatus value={task.status} /></div><textarea className={schoolTextareaClass + " mt-3"} value={taskResponseById[task.id] ?? task.response ?? ""} onChange={(event) => setTaskResponseById((current) => ({ ...current, [task.id]: event.target.value }))} placeholder="Describe your work or response" /><div className="mt-3 flex gap-2"><SchoolSecondaryButton onClick={() => void updateTask(task, "in_progress")}>Mark in progress</SchoolSecondaryButton><SchoolPrimaryButton onClick={() => void updateTask(task, "submitted")}>Submit for review</SchoolPrimaryButton></div></div>)}</div> : <SchoolEmptyState title="No assigned tasks" description="Tasks assigned to you will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderProgress = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Student progress" description="View progress records only for students in your assigned classes." />
      <SchoolPanel title="Assigned student register">
        {assignedStudents.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Student</th><th className="pb-2">Class</th><th className="pb-2">Approved marks</th><th className="pb-2">Homework submitted</th></tr></thead><tbody className="divide-y divide-slate-100">{assignedStudents.map((student) => <tr key={student.id}><td className="py-3 font-medium text-slate-800">{memberName(student.id)}</td><td className="py-3 text-slate-600">{sectionLabel(student.section_id)}</td><td className="py-3 tabular-nums text-slate-600">{marks.filter((mark) => mark.student_membership_id === student.id && mark.status === "approved").length}</td><td className="py-3 tabular-nums text-slate-600">{submissions.filter((submission) => submission.student_membership_id === student.id).length}</td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No assigned students" description="Student progress appears after your class assignments are configured." />}
      </SchoolPanel>
    </div>
  );

  let content: React.ReactNode;
  switch (page) {
    case "classes": content = renderClasses(); break;
    case "assessments": content = renderAssessments(); break;
    case "quizzes": content = renderQuizzes(); break;
    case "homework": content = renderHomework(); break;
    case "library": content = renderLibrary(); break;
    case "attendance": content = renderAttendance(); break;
    case "behavior": content = renderBehavior(); break;
    case "messages": content = renderMessages(); break;
    case "tasks": content = renderTasks(); break;
    case "progress": content = renderProgress(); break;
    default: content = renderOverview();
  }

  return (
    <SchoolPortalShell role="teacher" title="Teacher Portal" navItems={navItems} activeItem={page} onNavigate={setPage}>
      {loading && <div className="mb-4 text-xs text-slate-500">Refreshing assigned school records…</div>}
      {content}
    </SchoolPortalShell>
  );
}
