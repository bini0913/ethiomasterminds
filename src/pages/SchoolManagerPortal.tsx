import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Users, School, BookOpen, UserCog, Wallet, ClipboardList,
  FileBarChart, Settings, RefreshCw, CheckCircle2, Copy, AlertCircle, Scale, Percent,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField,
  schoolInputClass, schoolSelectClass, schoolTextareaClass,
} from "@/components/school/SchoolPortalPrimitives";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "accounts", label: "People & Accounts", icon: Users },
  { id: "structure", label: "School Structure", icon: School },
  { id: "assignments", label: "Teacher Assignments", icon: UserCog },
  { id: "grading", label: "Grading & Policies", icon: Scale },
  { id: "finance", label: "Fees & Finance", icon: Wallet },
  { id: "tasks", label: "Staff Tasks", icon: ClipboardList },
  { id: "evaluations", label: "Staff Evaluations", icon: CheckCircle2 },
  { id: "requests", label: "Change Requests", icon: Settings },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "discipline", label: "Disciplinary Reviews", icon: Scale },
  { id: "leadership", label: "Leadership Team", icon: UserCog },
];

type AccountRole = "admin" | "teacher" | "finance" | "parent" | "student";
type LeadershipPosition = "" | "main_director" | "vice_director" | "kg_director" | "elementary_director" | "middle_school_director" | "high_school_director" | "academic_director" | "hr_director" | "team_leader";

export default function SchoolManagerPortal() {
  const { activeSchool, activeMembership } = useSchoolPortal();
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [years, setYears] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [financeFollowups, setFinanceFollowups] = useState<any[]>([]);
  const [disciplinaryRecommendations, setDisciplinaryRecommendations] = useState<any[]>([]);
  const [staffConductReports, setStaffConductReports] = useState<any[]>([]);
  const [assignmentRecommendations, setAssignmentRecommendations] = useState<any[]>([]);
  const [managerReviewNotes, setManagerReviewNotes] = useState<Record<string, string>>({});
  const [staffDisciplineTargetId, setStaffDisciplineTargetId] = useState("");
  const [staffDisciplineReason, setStaffDisciplineReason] = useState("");
  const [staffDisciplineRecommendation, setStaffDisciplineRecommendation] = useState("");
  const [disciplineReviewNotes, setDisciplineReviewNotes] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [gradingCategories, setGradingCategories] = useState<any[]>([]);
  const [gradingPolicies, setGradingPolicies] = useState<any[]>([]);
  const [gradeScales, setGradeScales] = useState<any[]>([]);
  const [policySettings, setPolicySettings] = useState<any>(null);
  const [createdCredentials, setCreatedCredentials] = useState<any[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [leadershipAppointments, setLeadershipAppointments] = useState<any[]>([]);
  const [leadershipActionEvents, setLeadershipActionEvents] = useState<any[]>([]);
  const [leadershipError, setLeadershipError] = useState<string | null>(null);
  const [leaderTargetId, setLeaderTargetId] = useState("");
  const [leaderPosition, setLeaderPosition] = useState("kg_director");
  const [leaderDivision, setLeaderDivision] = useState("kg");
  const [leaderTeamName, setLeaderTeamName] = useState("");
  const [leaderStartDate, setLeaderStartDate] = useState("");
  const [leaderEndDate, setLeaderEndDate] = useState("");
  const [leaderPermissions, setLeaderPermissions] = useState<string[]>([
    "view_students", "view_staff", "view_attendance", "review_attendance",
    "view_academics", "review_assessments", "review_results", "view_curriculum",
    "manage_team_tasks", "assign_team_tasks", "view_reports",
    "view_discipline", "review_discipline", "view_finance_summary",
  ]);
  const [leadershipActionReason, setLeadershipActionReason] = useState("");
  const [divisionMappings, setDivisionMappings] = useState<any[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<any[]>([]);
  const [mappingGrade, setMappingGrade] = useState("");
  const [mappingDivision, setMappingDivision] = useState("kg");
  const [teamAppointmentId, setTeamAppointmentId] = useState("");
  const [teamMemberId, setTeamMemberId] = useState("");
  const [leadershipAuditEvents, setLeadershipAuditEvents] = useState<any[]>([]);
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, string[]>>({});
  const [leadershipPermissionReason, setLeadershipPermissionReason] = useState("");

  const [accountRole, setAccountRole] = useState<AccountRole>("parent");
  const [accountLeadershipPosition, setAccountLeadershipPosition] = useState<LeadershipPosition>("");
  const [accountLeadershipDivision, setAccountLeadershipDivision] = useState("kg");
  const [accountLeadershipTeam, setAccountLeadershipTeam] = useState("");
  const [accountName, setAccountName] = useState("");
  const [existingTeacherUsername, setExistingTeacherUsername] = useState("");
  const [linkingExistingTeacher, setLinkingExistingTeacher] = useState(false);
  const [accountSectionId, setAccountSectionId] = useState("");
  const [accountAge, setAccountAge] = useState("12");
  const [accountSubject, setAccountSubject] = useState("");
  const [accountAssignmentKind, setAccountAssignmentKind] = useState<"subject" | "homeroom">("subject");
  const [parentMembershipIds, setParentMembershipIds] = useState<string[]>([]);
  const [studentMembershipIds, setStudentMembershipIds] = useState<string[]>([]);

  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [yearIsCurrent, setYearIsCurrent] = useState(true);
  const [subjectYearId, setSubjectYearId] = useState("");
  const [subjectGrade, setSubjectGrade] = useState("Grade 9");
  const [subjectName, setSubjectName] = useState("");
  const [gradingYearId, setGradingYearId] = useState("");
  const [gradingGradeLabel, setGradingGradeLabel] = useState("Grade 9");
  const [passMark, setPassMark] = useState("50");
  const [rankScope, setRankScope] = useState("section");
  const [missingMarkRule, setMissingMarkRule] = useState("incomplete");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryWeight, setNewCategoryWeight] = useState("0");
  const [newScaleMin, setNewScaleMin] = useState("0");
  const [newScaleMax, setNewScaleMax] = useState("100");
  const [newScaleLetter, setNewScaleLetter] = useState("");
  const [newScaleDescription, setNewScaleDescription] = useState("");

  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignSectionId, setAssignSectionId] = useState("");
  const [assignSubject, setAssignSubject] = useState("");
  const [assignKind, setAssignKind] = useState<"subject" | "homeroom">("subject");

  const [feeYearId, setFeeYearId] = useState("");
  const [feeGrade, setFeeGrade] = useState("Grade 9");
  const [feeName, setFeeName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeCurrency, setFeeCurrency] = useState("ETB");
  const [feeDueDate, setFeeDueDate] = useState("");

  const [taskTargetId, setTaskTargetId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskType, setTaskType] = useState("follow_up");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");

  const [evaluationTargetId, setEvaluationTargetId] = useState("");
  const [evaluationRating, setEvaluationRating] = useState("3");
  const [evaluationNotes, setEvaluationNotes] = useState("");
  const [evaluationStart, setEvaluationStart] = useState("");
  const [evaluationEnd, setEvaluationEnd] = useState("");

  const [requestTargetId, setRequestTargetId] = useState("");
  const [requestType, setRequestType] = useState("responsibility_change");
  const [requestedRole, setRequestedRole] = useState("teacher");
  const [requestDetails, setRequestDetails] = useState("");
  const [requestReason, setRequestReason] = useState("");

  const db = supabase as any;
  const schoolId = activeSchool?.id;

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [
      membershipsRes, yearsRes, sectionsRes, subjectsRes, assignmentsRes,
      feesRes, invoicesRes, tasksRes, evaluationsRes, requestsRes, categoriesRes, gradingPoliciesRes, gradeScalesRes, policySettingsRes, financeFollowupsRes, disciplinaryRes, staffConductRes, assignmentRecommendationsRes,
    ] = await Promise.all([
      db.from("school_memberships").select("id,user_id,school_role,status,grade_label,section_id,student_number,school_username,age_at_enrollment,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }),
      db.from("school_academic_years").select("id,name,starts_on,ends_on,is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
      db.from("school_sections").select("id,academic_year_id,grade_label,section_name,homeroom_teacher_id").eq("school_id", schoolId).order("grade_label"),
      db.from("school_subjects").select("id,academic_year_id,grade_label,subject_name,active").eq("school_id", schoolId).order("grade_label"),
      db.from("school_teacher_assignments").select("id,teacher_membership_id,section_id,subject_name,assignment_kind").eq("school_id", schoolId),
      db.from("school_fee_structures").select("id,academic_year_id,grade_label,fee_name,amount,currency,due_date,active").eq("school_id", schoolId).order("created_at", { ascending: false }),
      db.from("school_student_invoices").select("id,invoice_number,student_membership_id,amount,paid_amount,balance,status,due_date,currency").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_staff_tasks").select("id,title,assigned_to_membership_id,assigned_by_membership_id,status,due_date,priority,task_type,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_staff_evaluations").select("id,target_membership_id,evaluation_type,rating,period_start,period_end,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(50),
      db.from("school_staff_change_requests").select("id,target_membership_id,request_type,status,reason,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(50),
      db.from("school_assessment_categories").select("id,academic_year_id,grade_label,category_key,category_name,weight_percent,required").eq("school_id", schoolId).order("grade_label"),
      db.from("school_grading_policies").select("id,academic_year_id,grade_label,pass_mark,rank_scope,missing_mark_rule").eq("school_id", schoolId),
      db.from("school_grade_scales").select("id,grade_label,minimum_score,maximum_score,letter_grade,description").eq("school_id", schoolId).order("grade_label"),
      db.from("school_policy_settings").select("school_id,attendance_notifications_enabled,behavior_notifications_enabled,report_card_notifications_enabled,absence_review_threshold").eq("school_id", schoolId).maybeSingle(),
      db.from("school_finance_followups").select("id,invoice_id,student_membership_id,submitted_by_membership_id,note,status,reviewed_at,resolution_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_disciplinary_recommendations").select("id,target_membership_id,target_kind,submitted_by_membership_id,reason,recommendation,status,decision_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_staff_conduct_reports").select("id,target_teacher_membership_id,submitted_by_membership_id,report_type,severity,description,status,manager_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_teacher_assignment_recommendations").select("id,teacher_membership_id,submitted_by_membership_id,current_assignment_id,recommendation_type,requested_section_id,requested_subject_name,requested_assignment_kind,reason,status,manager_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
    ]);

    const firstError = [membershipsRes, yearsRes, sectionsRes, subjectsRes, assignmentsRes, feesRes, invoicesRes, tasksRes, evaluationsRes, requestsRes, categoriesRes, gradingPoliciesRes, gradeScalesRes, policySettingsRes, financeFollowupsRes, disciplinaryRes, staffConductRes, assignmentRecommendationsRes].find((result) => result.error)?.error;
    if (firstError) {
      toast.error(firstError.message || "Could not load school records");
      setLoading(false);
      return;
    }

    const nextMembers = membershipsRes.data ?? [];
    setMembers(nextMembers);
    setYears(yearsRes.data ?? []);
    setSections(sectionsRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);
    setAssignments(assignmentsRes.data ?? []);
    setFeeStructures(feesRes.data ?? []);
    setInvoices(invoicesRes.data ?? []);
    setTasks(tasksRes.data ?? []);
    setEvaluations(evaluationsRes.data ?? []);
    setChangeRequests(requestsRes.data ?? []);
    setGradingCategories(categoriesRes.data ?? []);
    setGradingPolicies(gradingPoliciesRes.data ?? []);
    setGradeScales(gradeScalesRes.data ?? []);
    setPolicySettings(policySettingsRes.data ?? null);
    setFinanceFollowups(financeFollowupsRes.data ?? []);
    setDisciplinaryRecommendations(disciplinaryRes.data ?? []);
    setStaffConductReports(staffConductRes.data ?? []);
    setAssignmentRecommendations(assignmentRecommendationsRes.data ?? []);

    const userIds = [...new Set(nextMembers.map((membership: any) => membership.user_id))];
    if (userIds.length) {
      const { data: profileRows, error: profileError } = await db.from("profiles").select("id,name,username,age,grade").in("id", userIds);
      if (profileError) toast.error("Some profile names could not be loaded");
      setProfiles(Object.fromEntries((profileRows ?? []).map((profile: any) => [profile.id, profile])));
    } else {
      setProfiles({});
    }

    if (!subjectYearId && yearsRes.data?.length) setSubjectYearId(yearsRes.data.find((year: any) => year.is_current)?.id ?? yearsRes.data[0].id);
    if (!feeYearId && yearsRes.data?.length) setFeeYearId(yearsRes.data.find((year: any) => year.is_current)?.id ?? yearsRes.data[0].id);
    if (!gradingYearId && yearsRes.data?.length) setGradingYearId(yearsRes.data.find((year: any) => year.is_current)?.id ?? yearsRes.data[0].id);
    if (sectionsRes.data?.length && gradingGradeLabel === "Grade 9" && !sectionsRes.data.some((section: any) => section.grade_label === "Grade 9")) setGradingGradeLabel(sectionsRes.data[0].grade_label);
    setLoading(false);
  }, [schoolId, db, subjectYearId, feeYearId, gradingYearId, gradingGradeLabel]);

  useEffect(() => {
    const hasActiveAdmin = members.some((member) => member.school_role === "admin" && member.status === "active");
    if (hasActiveAdmin && accountRole === "admin") setAccountRole("teacher");
  }, [members, accountRole]);
  useEffect(() => { void load(); }, [load]);

  const loadLeadership = useCallback(async () => {
    if (!schoolId) return;
    const [appointmentsRes, mappingsRes, teamMembersRes, auditRes, actionEventsRes] = await Promise.all([
      db.from("school_leadership_appointments")
        .select("id,membership_id,position,division_scope,team_name,permissions,status,start_date,end_date,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
      db.from("school_division_grade_mappings")
        .select("id,division_scope,grade_label")
        .eq("school_id", schoolId)
        .order("grade_label"),
      db.from("school_leadership_team_members")
        .select("id,appointment_id,membership_id,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
      db.from("school_leadership_audit_events")
        .select("id,appointment_id,actor_user_id,event_type,reason,created_at,after_state")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("school_leadership_action_events")
        .select("id,appointment_id,actor_user_id,action_type,target_table,target_id,reason,created_at,before_state,after_state")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const loadError = appointmentsRes.error || mappingsRes.error || teamMembersRes.error || auditRes.error;
    if (loadError) {
      setLeadershipError("Leadership management is waiting for its database migration. Existing school operations remain available.");
      setLeadershipAppointments([]);
      setDivisionMappings([]);
      setTeamAssignments([]);
      setLeadershipAuditEvents([]);
      setLeadershipActionEvents([]);
      return;
    }
    setLeadershipError(null);
    setLeadershipAppointments(appointmentsRes.data ?? []);
    setDivisionMappings(mappingsRes.data ?? []);
    setTeamAssignments(teamMembersRes.data ?? []);
    setLeadershipAuditEvents(auditRes.data ?? []);
    setLeadershipActionEvents(actionEventsRes.error ? [] : (actionEventsRes.data ?? []));
  }, [schoolId, db]);

  useEffect(() => { void loadLeadership(); }, [loadLeadership]);

  const appointLeader = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leaderTargetId) return toast.error("Choose an active school staff member.");
    const divisionByPosition: Record<string, string> = { kg_director: "kg", elementary_director: "elementary", middle_school_director: "middle_school", high_school_director: "high_school" };
    const division = leaderPosition === "vice_director" ? leaderDivision : divisionByPosition[leaderPosition] || null;
    const { error } = await db.rpc("school_appoint_leader", {
      p_target_membership_id: leaderTargetId,
      p_position: leaderPosition,
      p_division_scope: division,
      p_team_name: leaderPosition === "team_leader" ? leaderTeamName.trim() : null,
      p_permissions: leaderPermissions,
      p_start_date: leaderStartDate || new Date().toISOString().slice(0, 10),
      p_end_date: leaderEndDate || null,
    });
    if (error) return toast.error(error.message || "The leadership appointment could not be saved.");
    toast.success("Leadership appointment created and recorded.");
    setLeaderTargetId("");
    setLeaderTeamName("");
    setLeaderStartDate("");
    setLeaderEndDate("");
    await loadLeadership();
  };

  const saveDivisionMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !mappingGrade) return toast.error("Choose a grade to map.");
    const { error } = await db.rpc("school_set_division_grade_mapping", {
      p_school_id: schoolId,
      p_grade_label: mappingGrade,
      p_division_scope: mappingDivision,
    });
    if (error) return toast.error(error.message || "The division mapping could not be saved.");
    toast.success("Grade mapped to its school division.");
    await loadLeadership();
  };

  const removeDivisionMapping = async (gradeLabel: string) => {
    if (!schoolId) return;
    const { error } = await db.rpc("school_set_division_grade_mapping", {
      p_school_id: schoolId,
      p_grade_label: gradeLabel,
      p_division_scope: null,
    });
    if (error) return toast.error(error.message || "The division mapping could not be removed.");
    toast.success("Grade division mapping removed.");
    await loadLeadership();
  };

  const saveTeamMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamAppointmentId || !teamMemberId) return toast.error("Choose a Team Leader and a staff member.");
    const { error } = await db.rpc("school_assign_leadership_team_member", {
      p_appointment_id: teamAppointmentId,
      p_target_membership_id: teamMemberId,
      p_assign: true,
    });
    if (error) return toast.error(error.message || "The team member could not be assigned.");
    toast.success("Staff member added to the Team Leader's assigned team.");
    setTeamMemberId("");
    await loadLeadership();
  };

  const removeTeamMember = async (appointmentId: string, membershipId: string) => {
    const { error } = await db.rpc("school_assign_leadership_team_member", {
      p_appointment_id: appointmentId,
      p_target_membership_id: membershipId,
      p_assign: false,
    });
    if (error) return toast.error(error.message || "The team member could not be removed.");
    toast.success("Team assignment removed.");
    await loadLeadership();
  };

  const updateLeaderPermissions = async (appointmentId: string, permissions: string[]) => {
    if (!leadershipPermissionReason.trim()) {
      return toast.error("Enter a reason for changing leadership permissions.");
    }
    const { error } = await db.rpc("school_update_leadership_permissions", {
      p_appointment_id: appointmentId,
      p_permissions: permissions,
      p_reason: leadershipPermissionReason.trim(),
    });
    if (error) return toast.error(error.message || "Leadership permissions could not be updated.");
    toast.success("Leadership permissions updated and audited.");
    setLeadershipPermissionReason("");
    setPermissionDrafts((current) => {
      const next = { ...current };
      delete next[appointmentId];
      return next;
    });
    await loadLeadership();
  };

  const updateLeaderAppointment = async (appointmentId: string, status: "active" | "suspended" | "ended") => {
    if (status !== "active" && !leadershipActionReason.trim()) {
      return toast.error("Enter a reason before suspending or ending an appointment.");
    }
    const { error } = await db.rpc("school_update_leadership_appointment", {
      p_appointment_id: appointmentId,
      p_status: status,
      p_end_date: status === "ended" ? new Date().toISOString().slice(0, 10) : null,
      p_reason: leadershipActionReason.trim() || null,
    });
    if (error) return toast.error(error.message || "The appointment could not be updated.");
    toast.success(status === "ended" ? "Appointment ended; its history was retained." : status === "suspended" ? "Appointment suspended." : "Appointment reactivated.");
    setLeadershipActionReason("");
    await loadLeadership();
  };

  const activeMembers = members.filter((member) => member.status === "active");
  const students = activeMembers.filter((member) => member.school_role === "student");
  const teachers = activeMembers.filter((member) => member.school_role === "teacher");
  const parents = activeMembers.filter((member) => member.school_role === "parent");
  const staff = activeMembers.filter((member) => ["admin", "teacher", "finance"].includes(member.school_role));
  const outstandingByCurrency = invoices.reduce((totals: Record<string, number>, invoice) => { const currency = invoice.currency || "ETB"; totals[currency] = (totals[currency] || 0) + Number(invoice.balance || 0); return totals; }, {});
  const outstandingSummary = Object.entries(outstandingByCurrency).map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`).join(" · ") || "0";

  const memberName = (membershipId: string) => {
    const membership = members.find((item) => item.id === membershipId);
    return membership ? (profiles[membership.user_id]?.name || membership.school_username || "School member") : "Unknown member";
  };
  const sectionLabel = (sectionId: string | null | undefined) => {
    const section = sections.find((item) => item.id === sectionId);
    return section ? `${section.grade_label} ${section.section_name}` : "—";
  };
  const membershipRoleLabel = (member: any) => {
    const appointment = leadershipAppointments.find((item) => item.membership_id === member.id && item.status === "active");
    if (appointment) {
      const labels: Record<string, string> = {
        
        vice_director: "Vice Director",
        kg_director: "KG Director",
        elementary_director: "Elementary Director",
        middle_school_director: "Middle School Director",
        high_school_director: "High School Director",
        academic_director: "Academic Director",
        hr_director: "HR Director / Business Manager",
        
      };
      return labels[appointment.position] || appointment.position;
    }
    return member.school_role === "admin" ? "Legacy admin account" : member.school_role;
  };


  const attachExistingTeacher = async (event: React.FormEvent) => {
    event.preventDefault();
    const username = existingTeacherUsername.trim().toLowerCase();
    if (!username) return toast.error("Enter the username of an existing Master Minds account.");
    setLinkingExistingTeacher(true);
    try {
      const { data, error } = await supabase.functions.invoke("school-provision-account", {
        body: { action: "attach_existing_teacher", school_id: schoolId, username },
      });
      if (error || data?.error || !data?.membership_id) {
        return toast.error(data?.error || error?.message || "The existing teacher account could not be linked.");
      }
      setExistingTeacherUsername("");
      toast.success("Existing account linked as a school teacher. Assign sections and subjects in Teacher Assignments.");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "The existing teacher account could not be linked.");
    } finally {
      setLinkingExistingTeacher(false);
    }
  };

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setCreatedCredentials([]);
    if (!accountName.trim()) return setFormError("Enter the person's full name.");
    const account: any = { name: accountName.trim() };
    const provisionRole: "teacher" | "finance" | "parent" | "student" = accountLeadershipPosition === "hr_director" ? "finance" : accountLeadershipPosition ? "teacher" : accountRole;
    if (accountRole === "student") {
      const age = Number(accountAge);
      if (!accountSectionId || !Number.isInteger(age) || age < 3 || age > 120) {
        return setFormError("Choose a section and enter an age from 3 to 120.");
      }
      const section = sections.find((item) => item.id === accountSectionId);
      if (!section) return setFormError("Selected section is no longer available.");
      account.grade_label = section.grade_label;
      account.age = Number(accountAge);
      account.section_id = accountSectionId;
      account.parent_membership_ids = parentMembershipIds;
    }
    if (accountRole === "parent") account.student_membership_ids = studentMembershipIds;
    const { data, error } = await supabase.functions.invoke("school-provision-account", {
      body: { action: "create_accounts", school_id: schoolId, role: provisionRole, accounts: [account] },
    });
    if (error || !data?.created?.length) {
      setFormError(data?.failed?.[0]?.message || error?.message || "Account could not be created.");
      return;
    }
    setCreatedCredentials(data.created);
    let appointmentWarning = "";
    if (accountLeadershipPosition && data.created[0]?.membership_id) {
      const position = accountLeadershipPosition;
      const divisionByPosition: Record<string, string> = { kg_director: "kg", elementary_director: "elementary", middle_school_director: "middle_school", high_school_director: "high_school" };
      const division = position === "vice_director" ? accountLeadershipDivision : divisionByPosition[position] || null;
      const hrPermissions = ["view_staff", "view_staff_evaluations", "manage_team_tasks", "view_reports", "view_finance_summary", "manage_meetings"];
      const academicPermissions = ["view_students", "view_staff", "view_attendance", "view_academics", "review_assessments", "review_results", "view_curriculum", "view_reports", "publish_announcements", "manage_meetings"];
      const standardPermissions = ["view_students", "view_staff", "view_attendance", "review_attendance", "view_academics", "review_assessments", "review_results", "view_curriculum", "manage_team_tasks", "assign_team_tasks", "view_reports"];
      const { error: appointmentError } = await db.rpc("school_appoint_leader", {
        p_target_membership_id: data.created[0].membership_id,
        p_position: position,
        p_division_scope: division,
        p_team_name: position === "team_leader" ? accountLeadershipTeam.trim() : null,
        p_permissions: position === "hr_director" ? hrPermissions : position === "academic_director" ? academicPermissions : standardPermissions,
        p_start_date: new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" }),
        p_end_date: null,
      });
      if (appointmentError) appointmentWarning = "Account created, but leadership appointment failed: " + appointmentError.message + ". Use Leadership Team to appoint this account.";
    }
    setAccountName("");
    setParentMembershipIds([]);
    setStudentMembershipIds([]);
    if (appointmentWarning) { setFormError(appointmentWarning); toast.error("Account created; leadership appointment needs attention."); }
    else toast.success(accountLeadershipPosition ? "Account and leadership appointment created. Copy the initial credentials and deliver them privately." : "School account created. Copy the initial credentials and deliver them privately.");
    setAccountLeadershipPosition("");
    await Promise.all([load(), loadLeadership()]);
  };

  const addAcademicYear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!yearName.trim() || !yearStart || !yearEnd) return toast.error("Complete the academic year details.");
    if (yearEnd < yearStart) return toast.error("Academic year end date must follow its start date.");
    const { data: createdYear, error } = await db.from("school_academic_years").insert({
      school_id: schoolId, name: yearName.trim(), starts_on: yearStart, ends_on: yearEnd, is_current: false,
    }).select("id").single();
    if (error || !createdYear) return toast.error(error?.message || "Academic year could not be created.");
    let currentYearUpdated = !yearIsCurrent;
    if (yearIsCurrent) {
      const { error: currentError } = await db.rpc("school_set_current_academic_year", { p_academic_year_id: createdYear.id });
      currentYearUpdated = !currentError;
      if (currentError) {
        toast.error("Academic year was created, but could not be set as current: " + currentError.message);
      }
    }
    setYearName(""); setYearStart(""); setYearEnd(""); setYearIsCurrent(false);
    if (currentYearUpdated && yearIsCurrent) toast.success("Academic year created and set as current.");
    else if (!yearIsCurrent) toast.success("Academic year created.");
    else toast.info("Academic year was created. Refresh the page after resolving the current-year setting.");
    await load();
  };

  const setCurrentYear = async (yearId: string) => {
    const { error } = await db.rpc("school_set_current_academic_year", { p_academic_year_id: yearId });
    if (error) return toast.error(error.message);
    toast.success("Current academic year updated.");
    await load();
  };

  const addSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subjectYearId || !subjectGrade.trim() || !subjectName.trim()) return toast.error("Complete the subject details.");
    const { error } = await db.from("school_subjects").insert({
      school_id: schoolId, academic_year_id: subjectYearId,
      grade_label: subjectGrade.trim(), subject_name: subjectName.trim(),
    });
    if (error) return toast.error(error.message);
    setSubjectName("");
    toast.success("Subject added to the school catalog.");
    await load();
  };

  const addAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignTeacherId || !assignSectionId || (assignKind === "subject" && !assignSubject)) return toast.error("Complete the teacher assignment.");
    const { error } = await db.from("school_teacher_assignments").insert({
      school_id: schoolId,
      teacher_membership_id: assignTeacherId,
      section_id: assignSectionId,
      subject_name: assignKind === "homeroom" ? "Homeroom" : assignSubject,
      assignment_kind: assignKind,
      created_by: activeMembership?.id ? members.find((m) => m.id === activeMembership.id)?.user_id : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Teacher assignment saved.");
    await load();
  };

  const selectedGradingCategories = gradingCategories.filter((category) => category.academic_year_id === gradingYearId && category.grade_label === gradingGradeLabel);
  const selectedGradingPolicy = gradingPolicies.find((policy) => policy.academic_year_id === gradingYearId && policy.grade_label === gradingGradeLabel);
  const selectedGradeScales = gradeScales.filter((scale) => scale.grade_label === gradingGradeLabel);
  const categoryWeightTotal = selectedGradingCategories.reduce((total, category) => total + Number(category.weight_percent || 0), 0);

  const seedGradingDefaults = async () => {
    if (!gradingYearId || !gradingGradeLabel.trim()) return toast.error("Choose an academic year and grade.");
    const { error } = await db.rpc("school_seed_default_grading_categories", {
      p_school_id: schoolId, p_academic_year_id: gradingYearId, p_grade_label: gradingGradeLabel.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Default grading categories created: Class Activities 10%, Tests 30%, Final Examination 60%.");
    await load();
  };

  const saveCategory = async (category: any) => {
    const weight = Number(category.weight_percent);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100 || !category.category_name.trim()) return toast.error("Enter a valid category name and weight from 0 to 100.");
    const { error } = await db.from("school_assessment_categories").update({
      category_name: category.category_name.trim(), weight_percent: weight, required: Boolean(category.required),
    }).eq("id", category.id);
    if (error) return toast.error(error.message);
    toast.success("Assessment category updated.");
    await load();
  };

  const addGradingCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!gradingYearId || !gradingGradeLabel.trim() || !newCategoryName.trim()) return toast.error("Complete the new category details.");
    const weight = Number(newCategoryWeight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) return toast.error("Enter a category weight from 0 to 100.");
    const categoryKey = newCategoryName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!categoryKey) return toast.error("Category name must contain letters or numbers.");
    const { error } = await db.from("school_assessment_categories").insert({
      school_id: schoolId, academic_year_id: gradingYearId, grade_label: gradingGradeLabel.trim(),
      category_key: categoryKey, category_name: newCategoryName.trim(), weight_percent: Number(newCategoryWeight), required: true,
    });
    if (error) return toast.error(error.message);
    setNewCategoryName(""); setNewCategoryWeight("0");
    toast.success("Grading category added.");
    await load();
  };

  const saveGradingPolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!gradingYearId || !gradingGradeLabel.trim()) return toast.error("Choose an academic year and grade.");
    const validatedPassMark = Number(passMark);
    if (!Number.isFinite(validatedPassMark) || validatedPassMark < 0 || validatedPassMark > 100) {
      return toast.error("Pass mark must be a number from 0 to 100.");
    }
    const { error } = await db.from("school_grading_policies").upsert({
      school_id: schoolId, academic_year_id: gradingYearId, grade_label: gradingGradeLabel.trim(),
      pass_mark: validatedPassMark, rank_scope: rankScope, missing_mark_rule: missingMarkRule,
      updated_by: members.find((member) => member.id === activeMembership?.id)?.user_id,
    }, { onConflict: "school_id,academic_year_id,grade_label" });
    if (error) return toast.error(error.message);
    toast.success("Grading policy saved.");
    await load();
  };

  const addGradeScale = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!gradingGradeLabel.trim() || !newScaleLetter.trim()) return toast.error("Enter the grade and letter scale.");
    const min = Number(newScaleMin), max = Number(newScaleMax);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) return toast.error("Enter a valid score range from 0 to 100.");
    const overlaps = selectedGradeScales.some((scale) => min <= Number(scale.maximum_score) && max >= Number(scale.minimum_score));
    if (overlaps) return toast.error("This score range overlaps an existing grade scale.");
    const { error } = await db.from("school_grade_scales").insert({
      school_id: schoolId, grade_label: gradingGradeLabel.trim(), minimum_score: min, maximum_score: max,
      letter_grade: newScaleLetter.trim(), description: newScaleDescription.trim() || null,
    });
    if (error) return toast.error(error.message);
    setNewScaleLetter(""); setNewScaleDescription("");
    toast.success("Grade scale added.");
    await load();
  };

  const savePolicySettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!policySettings) return toast.error("School policy settings are not available.");
    const absenceThreshold = Number(policySettings.absence_review_threshold);
    if (!Number.isInteger(absenceThreshold) || absenceThreshold < 1 || absenceThreshold > 60) {
      return toast.error("The absence review threshold must be a whole number from 1 to 60.");
    }
    const { error } = await db.from("school_policy_settings").update({
      attendance_notifications_enabled: policySettings.attendance_notifications_enabled,
      behavior_notifications_enabled: policySettings.behavior_notifications_enabled,
      report_card_notifications_enabled: policySettings.report_card_notifications_enabled,
      absence_review_threshold: absenceThreshold,
      updated_by: members.find((member) => member.id === activeMembership?.id)?.user_id,
      updated_at: new Date().toISOString(),
    }).eq("school_id", schoolId);
    if (error) return toast.error(error.message);
    toast.success("School notification and attendance settings saved.");
    await load();
  };

  const reviewStaffConductReport = async (report: any, status: "reviewed" | "resolved" | "dismissed") => {
    const { error } = await db.rpc("school_review_staff_conduct_report", {
      p_report_id: report.id, p_status: status, p_note: managerReviewNotes[report.id] || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Staff conduct report updated.");
    await load();
  };

  const reviewAssignmentRecommendation = async (recommendation: any, accept: boolean) => {
    const { error } = await db.rpc("school_review_teacher_assignment_recommendation", {
      p_recommendation_id: recommendation.id, p_accept: accept, p_note: managerReviewNotes[recommendation.id] || null,
    });
    if (error) return toast.error(error.message);
    toast.success(accept ? "Recommendation accepted. Apply the assignment in Teacher Assignments." : "Recommendation declined.");
    await load();
  };

  const deleteTeacherAssignment = async (assignment: any) => {
    if (!window.confirm("Remove this teacher assignment? Existing academic records will remain unchanged.")) return;
    const { error } = await db.from("school_teacher_assignments").delete().eq("id", assignment.id);
    if (error) return toast.error(error.message);
    toast.success("Teacher assignment removed.");
    await load();
  };

  const submitStaffDisciplineRecommendation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!staffDisciplineTargetId || !staffDisciplineReason.trim() || !staffDisciplineRecommendation.trim()) return toast.error("Choose a staff member and provide the reason and recommendation.");
    const { error } = await db.from("school_disciplinary_recommendations").insert({
      school_id: schoolId, target_membership_id: staffDisciplineTargetId, target_kind: "staff",
      submitted_by_membership_id: activeMembership?.id, reason: staffDisciplineReason.trim(),
      recommendation: staffDisciplineRecommendation.trim(), status: "pending",
    });
    if (error) return toast.error(error.message);
    setStaffDisciplineReason(""); setStaffDisciplineRecommendation("");
    toast.success("Staff disciplinary recommendation submitted to the Super Admin.");
    await load();
  };

  const reviewStudentDisciplineRecommendation = async (item: any, accept: boolean) => {
    const { error } = await db.rpc("school_review_disciplinary_recommendation", {
      p_recommendation_id: item.id, p_accept: accept, p_note: disciplineReviewNotes[item.id] || null,
    });
    if (error) return toast.error(error.message);
    toast.success(accept ? "Student disciplinary recommendation accepted." : "Student disciplinary recommendation rejected.");
    await load();
  };

  const resolveFinanceFollowup = async (followupId: string) => {
    const { error } = await db.rpc("school_resolve_finance_followup", { p_followup_id: followupId, p_note: "Reviewed by School Manager." });
    if (error) return toast.error(error.message);
    toast.success("Finance follow-up marked resolved.");
    await load();
  };

  const addFeeStructure = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(feeAmount);
    if (!feeYearId || !feeGrade.trim() || !feeName.trim() || !Number.isFinite(amount) || amount <= 0) {
      return toast.error("Choose an academic year and enter a fee name and a valid amount greater than zero.");
    }
    const { error } = await db.from("school_fee_structures").insert({
      school_id: schoolId, academic_year_id: feeYearId, grade_label: feeGrade.trim(),
      fee_name: feeName.trim(), amount, currency: feeCurrency,
      due_date: feeDueDate || null,
      created_by: members.find((m) => m.id === activeMembership?.id)?.user_id,
    });
    if (error) return toast.error(error.message);
    setFeeName(""); setFeeAmount(""); setFeeDueDate("");
    toast.success("Fee structure created. Finance can now generate student invoices.");
    await load();
  };

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskTargetId || !taskTitle.trim()) return toast.error("Choose a staff member and enter a task title.");
    const { error } = await db.from("school_staff_tasks").insert({
      school_id: schoolId, assigned_to_membership_id: taskTargetId,
      assigned_by_membership_id: activeMembership?.id,
      task_type: taskType, title: taskTitle.trim(), description: taskDescription.trim() || null,
      due_date: taskDueDate || null, priority: taskPriority,
    });
    if (error) return toast.error(error.message);
    setTaskTitle(""); setTaskDescription(""); setTaskDueDate("");
    toast.success("Follow-up task assigned.");
    await load();
  };

  const createEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    const rating = Number(evaluationRating);
    if (!evaluationTargetId || !evaluationNotes.trim()) return toast.error("Choose a staff member and add evaluation notes.");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return toast.error("Evaluation rating must be from 1 to 5.");
    if (evaluationStart && evaluationEnd && evaluationEnd < evaluationStart) return toast.error("Evaluation end date must not be before its start date.");
    const { error } = await db.from("school_staff_evaluations").insert({
      school_id: schoolId, target_membership_id: evaluationTargetId,
      reviewer_membership_id: activeMembership?.id, evaluation_type: "staff_performance",
      rating, period_start: evaluationStart || null,
      period_end: evaluationEnd || null, notes: evaluationNotes.trim(),
    });
    if (error) return toast.error(error.message);
    setEvaluationNotes("");
    toast.success("Staff evaluation saved.");
    await load();
  };

  const createChangeRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestTargetId || !requestReason.trim()) return toast.error("Choose a staff member and explain the request.");
    let details: any = {};
    try { details = requestDetails.trim() ? JSON.parse(requestDetails) : {}; }
    catch { return toast.error("Requested details must be valid JSON."); }
    const { error } = await db.from("school_staff_change_requests").insert({
      school_id: schoolId, target_membership_id: requestTargetId,
      requester_membership_id: activeMembership?.id, request_type: requestType,
      requested_role: requestType === "role_change" ? requestedRole : null,
      requested_details: details, reason: requestReason.trim(),
    });
    if (error) return toast.error(error.message);
    setRequestReason(""); setRequestDetails("");
    toast.success("Change request sent to the Super Admin for review.");
    await load();
  };

  const copyCredentials = async () => {
    const text = createdCredentials.map((item) => `${item.username}\t${item.initial_password}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Credentials copied. Deliver them privately.");
    } catch {
      toast.error("Clipboard access is unavailable. Copy the credentials from the list.");
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <SchoolPageHeading title="School overview" description="A live view of enrollment, staffing, academic structure, and school finance." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Enrolled students" value={students.length} detail="Active school memberships" icon={Users} />
        <SchoolMetric label="Teachers" value={teachers.length} detail="Active teaching accounts" icon={UserCog} />
        <SchoolMetric label="Parents" value={parents.length} detail="Active parent accounts" icon={Users} />
        <SchoolMetric label="School sections" value={sections.length} detail="Across configured academic years" icon={School} />
        <SchoolMetric label="Subjects" value={subjects.filter((subject) => subject.active).length} detail="Active subject catalog entries" icon={BookOpen} />
        <SchoolMetric label="Teacher assignments" value={assignments.length} detail="Subject and homeroom assignments" icon={UserCog} />
        <SchoolMetric label="Outstanding fees" value={outstandingSummary} detail={`${invoices.filter((invoice) => invoice.balance > 0).length} unpaid or partial invoices`} icon={Wallet} />
        <SchoolMetric label="Open staff tasks" value={tasks.filter((task) => ["open", "in_progress", "submitted", "returned"].includes(task.status)).length} detail="Follow-ups awaiting completion or review" icon={ClipboardList} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Academic years" description="Current and previous school years">
          {years.length ? <div className="divide-y divide-slate-100">{years.map((year) => <div key={year.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium text-slate-800">{year.name}</p><p className="mt-0.5 text-xs text-slate-500">{year.starts_on} – {year.ends_on}</p></div>{year.is_current && <SchoolStatus value="active" />}</div>)}</div> : <SchoolEmptyState title="No academic year configured" description="Create the school's first academic year under School Structure." />}
        </SchoolPanel>
        <SchoolPanel title="Recent staff tasks" description="Follow-up work across school roles">
          {tasks.length ? <div className="divide-y divide-slate-100">{tasks.slice(0, 5).map((task) => <div key={task.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{task.title}</p><p className="mt-0.5 text-xs text-slate-500">Assigned to {memberName(task.assigned_to_membership_id)}{task.due_date ? ` · Due ${task.due_date}` : ""}</p></div><SchoolStatus value={task.status} /></div>)}</div> : <SchoolEmptyState title="No staff tasks yet" description="Assign follow-up work to Admins, teachers, or Finance staff." />}
        </SchoolPanel>
      </div>
    </div>
  );

  const renderAccounts = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="People & accounts" description="Create Director and Vice Director accounts, plus parent and student logins. Division Directors create Team Leader and Teacher accounts for their divisions." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SchoolPanel title="Create an account" description="Choose a Director role, parent, or student. Login details are shown once after creation.">
          <form onSubmit={createAccount} className="space-y-3">
            <SchoolField label="Account type">
              <select className={schoolSelectClass} value={accountLeadershipPosition ? "leadership" : accountRole} onChange={(event) => { if (event.target.value === "leadership") { setAccountLeadershipPosition("kg_director"); } else { setAccountLeadershipPosition(""); setAccountRole(event.target.value as AccountRole); } }}>
               <option value="leadership">Director / Vice Director</option><option value="finance">Finance staff</option><option value="parent">Parent</option><option value="student">Student</option>
             </select>
              </SchoolField>
              <SchoolField label="Leadership position">
                <select
                  className={schoolSelectClass}
                  value={leaderPosition}
                  onChange={(event) => {
                    const nextPosition = event.target.value;
                    setLeaderPosition(nextPosition);
                    if (nextPosition === "hr_director") {
                      setLeaderPermissions(["view_staff", "view_staff_evaluations", "manage_team_tasks", "view_reports", "view_finance_summary"]);
                    } else if (nextPosition === "academic_director") {
                      setLeaderPermissions(["view_students", "view_staff", "view_attendance", "view_academics", "review_assessments", "review_results", "view_curriculum", "view_reports"]);
                    } else if (nextPosition === "vice_director") {
                      setLeaderPermissions(["view_students", "view_staff", "view_attendance", "view_academics", "view_curriculum", "view_reports", "manage_team_tasks"]);
                    } else if (nextPosition === "team_leader") {
                      setLeaderPermissions(["view_staff", "view_attendance", "view_academics", "view_curriculum", "manage_team_tasks", "assign_team_tasks", "view_reports"]);
                    } else {
                      setLeaderPermissions([
                        "view_students", "view_staff", "view_attendance", "review_attendance",
                        "view_academics", "review_assessments", "review_results", "view_curriculum",
                        "view_discipline", "review_discipline", "view_reports",
                        "manage_team_tasks", "assign_team_tasks",
                      ]);
                    }
                  }}
                >
                  <option value="academic_director">Academic Director</option>
                  <option value="hr_director">HR Director / Business Manager</option>
                  <option value="vice_director">Vice Director</option>
                  <option value="kg_director">KG Director</option>
                  <option value="elementary_director">Elementary Director</option>
                  <option value="middle_school_director">Middle School Director</option>
                  <option value="high_school_director">High School Director</option>
                </select>
              </SchoolField>
              {leaderPosition === "vice_director" && (
                <SchoolField label="Division">
                  <select className={schoolSelectClass} value={leaderDivision} onChange={(event) => setLeaderDivision(event.target.value)}>
                    <option value="kg">KG</option>
                    <option value="elementary">Elementary</option>
                    <option value="middle_school">Middle School</option>
                    <option value="high_school">High School</option>
                  </select>
                </SchoolField>
              )}
                            <SchoolField label="Appointment starts"><input type="date" className={schoolInputClass} value={leaderStartDate} onChange={(event) => setLeaderStartDate(event.target.value)} /></SchoolField>
              <SchoolField label="Appointment ends (optional)"><input type="date" className={schoolInputClass} value={leaderEndDate} onChange={(event) => setLeaderEndDate(event.target.value)} /></SchoolField>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Granted responsibilities</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {visiblePermissionOptions.map(([permission, label]) => (
                  <label key={permission} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={leaderPermissions.includes(permission)}
                      onChange={(event) => setLeaderPermissions((current) => event.target.checked ? [...current, permission] : current.filter((item) => item !== permission))}
                      className="mt-0.5"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <SchoolPrimaryButton type="submit" disabled={!staff.length}>Create appointment</SchoolPrimaryButton>
          </form>
        </SchoolPanel>
        <SchoolPanel title="Grade-to-division mapping" description="Configure how this school groups its actual grade labels. These mappings are school-specific and are not hardcoded by Master Minds.">
          <form onSubmit={saveDivisionMapping} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <SchoolField label="School grade">
              <select className={schoolSelectClass} value={mappingGrade} onChange={(event) => setMappingGrade(event.target.value)} required>
                <option value="">Choose a configured grade</option>
                {[...new Set(sections.map((section) => section.grade_label))].sort((a, b) => a.localeCompare(b)).map((grade) => <option key={grade} value={grade}>{grade}</option>)}
              </select>
            </SchoolField>
            <SchoolField label="Division">
              <select className={schoolSelectClass} value={mappingDivision} onChange={(event) => setMappingDivision(event.target.value)}>
                <option value="kg">KG</option>
                <option value="elementary">Elementary</option>
                <option value="middle_school">Middle School</option>
                <option value="high_school">High School</option>
              </select>
            </SchoolField>
            <SchoolPrimaryButton type="submit">Save mapping</SchoolPrimaryButton>
          </form>
          <div className="mt-4 space-y-2">
            {divisionMappings.length ? divisionMappings.map((mapping) => (
              <div key={mapping.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2">
                <span className="text-sm font-medium text-slate-800">{mapping.grade_label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs capitalize text-slate-500">{mapping.division_scope.replace(/_/g, " ")}</span>
                  <SchoolSecondaryButton onClick={() => void removeDivisionMapping(mapping.grade_label)}>Remove</SchoolSecondaryButton>
                </div>
              </div>
            )) : <SchoolEmptyState title="No division mappings configured" description="Map each grade used by this school to KG, Elementary, Middle School, or High School." />}
          </div>
        </SchoolPanel>
        <SchoolPanel title="Team membership assignments" description="Assign existing school staff to each Team Leader. Team membership does not create accounts or change school roles.">
          <form onSubmit={saveTeamMember} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <SchoolField label="Team Leader">
              <select className={schoolSelectClass} value={teamAppointmentId} onChange={(event) => setTeamAppointmentId(event.target.value)} required>
                <option value="">Choose Team Leader</option>
                {leadershipAppointments.filter((item) => item.position === "team_leader" && item.status === "active").map((item) => <option key={item.id} value={item.id}>{memberName(item.membership_id)} · {item.team_name}</option>)}
              </select>
            </SchoolField>
            <SchoolField label="Staff member">
              <select className={schoolSelectClass} value={teamMemberId} onChange={(event) => setTeamMemberId(event.target.value)} required>
                <option value="">Choose active staff</option>
                {staff.map((member) => <option key={member.id} value={member.id}>{memberName(member.id)} · {member.school_role}</option>)}
              </select>
            </SchoolField>
            <SchoolPrimaryButton type="submit">Assign to team</SchoolPrimaryButton>
          </form>
          <div className="mt-4 space-y-3">
            {leadershipAppointments.filter((item) => item.position === "team_leader").map((leader) => {
              const assigned = teamAssignments.filter((item) => item.appointment_id === leader.id);
              return (
                <div key={leader.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{memberName(leader.membership_id)} · {leader.team_name}</p>
                    <SchoolStatus value={leader.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assigned.length ? assigned.map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">
                        {memberName(item.membership_id)}
                        <button type="button" onClick={() => void removeTeamMember(leader.id, item.membership_id)} className="font-semibold text-rose-600" aria-label={"Remove " + memberName(item.membership_id)}>×</button>
                      </span>
                    )) : <span className="text-xs text-slate-500">No staff assigned to this team yet.</span>}
                  </div>
                </div>
              );
            })}
            {!leadershipAppointments.some((item) => item.position === "team_leader") && <SchoolEmptyState title="No Team Leaders appointed" description="Appoint a Team Leader above before assigning staff to a team." />}
          </div>
        </SchoolPanel>
        <SchoolPanel title="Leadership appointments" description="Suspending or ending an appointment preserves its history. A replacement is appointed as a new record.">
          <div className="mb-3">
            <SchoolField label="Reason for suspension or ending">
              <input className={schoolInputClass} value={leadershipActionReason} onChange={(event) => setLeadershipActionReason(event.target.value)} placeholder="Required when suspending or ending an appointment" />
            </SchoolField>
          </div>
          {leadershipAppointments.length ? (
            <div className="space-y-3">
              {leadershipAppointments.map((appointment) => (
                <div key={appointment.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{memberName(appointment.membership_id)} · {positionLabel(appointment.position)}</p>
                      <p className="mt-1 text-xs text-slate-500">{divisionLabel(appointment.division_scope)}{appointment.team_name ? " · " + appointment.team_name : ""} · {appointment.start_date}{appointment.end_date ? " – " + appointment.end_date : ""}</p>
                      <p className="mt-2 text-xs text-slate-600">Permissions: {appointment.permissions?.length ? appointment.permissions.join(", ").replace(/_/g, " ") : "No additional permissions assigned"}</p>
                    </div>
                    <SchoolStatus value={appointment.status} />
                  </div>
                  {appointment.position === "main_director" ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">The Main Director uses the existing full School Admin authority. Suspend or end this appointment to revoke access; individual permission editing is not available for this position.</p> : <details className="mt-3 rounded-lg border border-slate-100 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-blue-700">Manage permissions</summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {permissionOptions.map(([permission, label]) => {
                        const currentPermissions = permissionDrafts[appointment.id] ?? appointment.permissions ?? [];
                        return (
                          <label key={permission} className="flex items-start gap-2 rounded-md border border-slate-100 p-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={currentPermissions.includes(permission)}
                              onChange={(event) => setPermissionDrafts((current) => ({
                                ...current,
                                [appointment.id]: event.target.checked
                                  ? [...currentPermissions, permission]
                                  : currentPermissions.filter((item) => item !== permission),
                              }))}
                              className="mt-0.5"
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        className={schoolInputClass}
                        value={leadershipPermissionReason}
                        onChange={(event) => setLeadershipPermissionReason(event.target.value)}
                        placeholder="Reason for this permission change"
                      />
                      <SchoolSecondaryButton onClick={() => void updateLeaderPermissions(appointment.id, permissionDrafts[appointment.id] ?? appointment.permissions ?? [])}>Save permissions</SchoolSecondaryButton>
                    </div>
                  </details>}
                  {appointment.status !== "ended" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {appointment.status === "active"
                        ? <SchoolSecondaryButton onClick={() => void updateLeaderAppointment(appointment.id, "suspended")}>Suspend appointment</SchoolSecondaryButton>
                        : <SchoolSecondaryButton onClick={() => void updateLeaderAppointment(appointment.id, "active")}>Reactivate appointment</SchoolSecondaryButton>}
                      <SchoolPrimaryButton onClick={() => void updateLeaderAppointment(appointment.id, "ended")}>End appointment</SchoolPrimaryButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : <SchoolEmptyState title="No leadership appointments yet" description="Appoint the Main Director, Vice Director, division directors, and team leaders above." />}
          {vacancies.length > 0 && <p className="mt-4 text-xs text-slate-500">Vacant positions: {vacancies.map(([, label]) => label).join(", ")}.</p>}
        </SchoolPanel>
        <SchoolPanel title="Leadership activity history" description="Appointment and permission changes are recorded by the database.">
          {leadershipAuditEvents.length ? (
            <div className="space-y-2">
              {leadershipAuditEvents.slice(0, 30).map((event) => (
                <div key={event.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {event.event_type === "appointed" ? "Leadership appointment created" : "Leadership appointment updated"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {profiles[event.actor_user_id]?.name || "School Manager"} · {event.reason || "No additional reason"}
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-slate-500">{new Date(event.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : <SchoolEmptyState title="No leadership changes recorded" description="Appointments and permission changes will appear here." />}
        </SchoolPanel>
        <SchoolPanel title="Leadership operational audit" description="Attendance corrections and other leadership actions are recorded with their reason and before/after values.">
          {leadershipActionEvents.length ? (
            <div className="space-y-2">
              {leadershipActionEvents.slice(0, 30).map((event) => (
                <div key={event.id} className="border-b border-slate-100 py-2 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium capitalize text-slate-800">{event.action_type.replace(/_/g, " ")}</p>
                    <span className="text-xs tabular-nums text-slate-500">{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{profiles[event.actor_user_id]?.name || "School leader"} · {event.reason}</p>
                  {event.target_table === "school_attendance_records" && <p className="mt-1 text-xs text-slate-500">Attendance: {event.before_state?.attendance_status || "—"} → {event.after_state?.attendance_status || "—"}</p>}
                  {event.target_table === "school_staff_tasks" && <p className="mt-1 text-xs text-slate-500">Task: {event.after_state?.title || "Staff task"} · Status: {event.after_state?.status || "created"}</p>}
                </div>
              ))}
            </div>
          ) : <SchoolEmptyState title="No operational leadership actions" description="Attendance corrections and leadership task actions will appear here." />}
        </SchoolPanel>
      </div>
    );
  };

  const renderReports = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School reports" description="Live operational records available to the School Manager." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Active staff" value={staff.length} detail="Admin, Teacher, and Finance" icon={Users} />
        <SchoolMetric label="Suspended accounts" value={members.filter((member) => member.status === "suspended").length} detail="School memberships" icon={AlertCircle} />
        <SchoolMetric label="Published fee structures" value={feeStructures.filter((fee) => fee.active).length} detail="Active fee rules" icon={Wallet} />
        <SchoolMetric label="Evaluations" value={evaluations.length} detail="Recorded staff reviews" icon={CheckCircle2} />
      </div>
      <SchoolPanel title="Enrollment by grade">
        {students.length ? <div className="space-y-3">{Object.entries(students.reduce((acc: Record<string, number>, student) => { const grade = student.grade_label || "Unassigned"; acc[grade] = (acc[grade] || 0) + 1; return acc; }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([grade, count]) => <div key={grade} className="flex items-center gap-3"><span className="w-28 shrink-0 text-sm font-medium text-slate-700">{grade}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, (Number(count) / Math.max(1, students.length)) * 100)}%` }} /></div><span className="w-8 text-right text-sm tabular-nums text-slate-600">{Number(count)}</span></div>)}</div> : <SchoolEmptyState title="No student enrollment data" description="Student enrollment totals will appear when accounts are created." />}
      </SchoolPanel>
    </div>
  );

  let content: React.ReactNode;
  switch (page) {
    case "accounts": content = renderAccounts(); break;
    case "structure": content = renderStructure(); break;
    case "assignments": content = renderAssignments(); break;
    case "grading": content = renderGrading(); break;
    case "finance": content = renderFinance(); break;
    case "tasks": content = renderTasks(); break;
    case "evaluations": content = renderEvaluations(); break;
    case "requests": content = renderRequests(); break;
    case "reports": content = renderReports(); break;
    case "discipline": content = renderDiscipline(); break;
    case "leadership": content = renderLeadership(); break;
    default: content = renderOverview();
  }

  return (
    <SchoolPortalShell role="manager" title="School Manager" navItems={navItems} activeItem={page} onNavigate={setPage}>
      {loading && <div className="mb-4 text-xs text-slate-500">Refreshing school records…</div>}
      {content}
    </SchoolPortalShell>
  );
}