import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Users, School, BookOpen, UserCog, Wallet, ClipboardList,
  FileBarChart, Settings, RefreshCw, CheckCircle2, Copy, AlertCircle, Scale, Percent, GraduationCap, Search, FileClock, UsersRound, CalendarDays, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import SchoolManagerAcademicWorkspace from "@/components/school/SchoolManagerAcademicWorkspace";
import SchoolCurriculumWorkspace from "@/components/school/SchoolCurriculumWorkspace";
import SchoolManagerAttendanceWorkspace from "@/components/school/SchoolManagerAttendanceWorkspace";
import SchoolManagerTimetableCalendarWorkspace from "@/components/school/SchoolManagerTimetableCalendarWorkspace";
import SchoolManagerParentCommunicationsWorkspace from "@/components/school/SchoolManagerParentCommunicationsWorkspace";
import SchoolManagerStaffSupportWorkspace from "@/components/school/SchoolManagerStaffSupportWorkspace";
import SchoolManagerContentGovernanceWorkspace from "@/components/school/SchoolManagerContentGovernanceWorkspace";
import SchoolManagerStudentProfile from "@/components/school/SchoolManagerStudentProfile";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField,
  schoolInputClass, schoolSelectClass, schoolTextareaClass,
} from "@/components/school/SchoolPortalPrimitives";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "Command center" },
  { id: "students", label: "Student Directory", icon: GraduationCap, group: "People & school" },
  { id: "accounts", label: "People & Accounts", icon: Users, group: "People & school" },
  { id: "staff", label: "Staff Directory", icon: UsersRound, group: "People & school" },
  { id: "assignments", label: "Teacher Assignments", icon: UserCog, group: "People & school" },
  { id: "leadership", label: "Leadership Team", icon: UserCog, group: "People & school" },
  { id: "structure", label: "School Structure", icon: School, group: "Academic management" },
  { id: "academics", label: "Academic Management", icon: BookOpen, group: "Academic management" },
  { id: "curriculum", label: "Curriculum & Support", icon: BookOpen, group: "Academic management" },
  { id: "grading", label: "Grading & Policies", icon: Scale, group: "Academic management" },
  { id: "attendance", label: "Attendance", icon: CalendarDays, group: "Daily operations" },
  { id: "timetable", label: "Timetable & Calendar", icon: CalendarDays, group: "Daily operations" },
  { id: "communications", label: "Parent Communication", icon: MessageSquare, group: "Daily operations" },
  { id: "staff-support", label: "Staff & Student Support", icon: ClipboardList, group: "Daily operations" },
  { id: "content-governance", label: "Content Governance", icon: BookOpen, group: "Daily operations" },
  { id: "finance", label: "Fees & Finance", icon: Wallet, group: "Finance & insights" },
  { id: "reports", label: "Reports & Analytics", icon: FileBarChart, group: "Finance & insights" },
  { id: "audit", label: "School Audit", icon: FileClock, group: "Administration" },
  { id: "settings", label: "Manager Settings", icon: Settings, group: "Administration" },
];
type AccountRole = "finance" | "parent" | "student";
type LeadershipPosition = "" | "vice_director" | "kg_director" | "elementary_director" | "middle_school_director" | "high_school_director" | "academic_director" | "hr_director";

const STANDARD_ETHIOPIAN_GRADE_LABELS = [
  "Nursery", "KG 1", "KG 2",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
  "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
];

export default function SchoolManagerPortal() {
  const { activeSchool, activeMembership } = useSchoolPortal();
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [years, setYears] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [termYearId, setTermYearId] = useState("");
  const [termName, setTermName] = useState("");
  const [termNumber, setTermNumber] = useState("1");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [yearEdit, setYearEdit] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [financeFollowups, setFinanceFollowups] = useState<any[]>([]);
  const [disciplinaryRecommendations, setDisciplinaryRecommendations] = useState<any[]>([]);
  const [assignmentRecommendations, setAssignmentRecommendations] = useState<any[]>([]);
  const [managerReviewNotes, setManagerReviewNotes] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [gradingCategories, setGradingCategories] = useState<any[]>([]);
  const [gradingPolicies, setGradingPolicies] = useState<any[]>([]);
  const [gradeScales, setGradeScales] = useState<any[]>([]);
  const [policySettings, setPolicySettings] = useState<any>(null);
  const [createdCredentials, setCreatedCredentials] = useState<any[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [reportGradeFilter, setReportGradeFilter] = useState("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");
  const [studentActionId, setStudentActionId] = useState<string | null>(null);
  const [studentActionStatus, setStudentActionStatus] = useState<"transferred" | "graduated" | "deactivated" | "">("");
  const [studentActionReason, setStudentActionReason] = useState("");
  const [studentActionLoading, setStudentActionLoading] = useState(false);
  const [studentPlacementId, setStudentPlacementId] = useState<string | null>(null);
  const [studentPlacementSectionId, setStudentPlacementSectionId] = useState("");
  const [studentPlacementLoading, setStudentPlacementLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState("all");
  const [staffStatusFilter, setStaffStatusFilter] = useState("all");
  const [recordEvents, setRecordEvents] = useState<any[]>([]);
  const [structureEvents, setStructureEvents] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditError, setAuditError] = useState<string | null>(null);

  const [leadershipAppointments, setLeadershipAppointments] = useState<any[]>([]);
  const [leadershipActionEvents, setLeadershipActionEvents] = useState<any[]>([]);
  const [leadershipError, setLeadershipError] = useState<string | null>(null);
  const [convertingLegacyMembershipId, setConvertingLegacyMembershipId] = useState<string | null>(null);
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




  const db = supabase as any;
  const schoolId = activeSchool?.id;

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
    const [
      membershipsRes, yearsRes, termsRes, sectionsRes, subjectsRes, assignmentsRes,
      feesRes, invoicesRes, tasksRes, evaluationsRes, requestsRes, categoriesRes, gradingPoliciesRes, gradeScalesRes, policySettingsRes, financeFollowupsRes, disciplinaryRes, assignmentRecommendationsRes,
    ] = await Promise.all([
      db.from("school_memberships").select("id,user_id,school_role,status,grade_label,section_id,student_number,school_username,age_at_enrollment,end_reason,ended_at,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }),
      db.from("school_academic_years").select("id,name,starts_on,ends_on,is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
      db.from("school_terms").select("id,academic_year_id,name,term_number,starts_on,ends_on,created_at").eq("school_id", schoolId).order("term_number"),
      db.from("school_sections").select("id,academic_year_id,grade_label,section_name,homeroom_teacher_id").eq("school_id", schoolId).order("grade_label"),
      db.from("school_subjects").select("id,academic_year_id,grade_label,subject_name,active").eq("school_id", schoolId).order("grade_label"),
      db.from("school_teacher_assignments").select("id,teacher_membership_id,section_id,subject_name,assignment_kind").eq("school_id", schoolId),
      db.from("school_fee_structures").select("id,academic_year_id,grade_label,fee_name,amount,currency,due_date,active").eq("school_id", schoolId).order("created_at", { ascending: false }),
      db.from("school_student_invoices").select("id,invoice_number,student_membership_id,amount,paid_amount,balance,status,due_date,currency").eq("school_id", schoolId).order("created_at", { ascending: false }).range(0, 499),
      db.from("school_staff_tasks").select("id,title,assigned_to_membership_id,assigned_by_membership_id,status,due_date,priority,task_type,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_staff_evaluations").select("id,target_membership_id,evaluation_type,rating,period_start,period_end,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(50),
      db.from("school_staff_change_requests").select("id,target_membership_id,request_type,status,reason,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(50),
      db.from("school_assessment_categories").select("id,academic_year_id,grade_label,category_key,category_name,weight_percent,required").eq("school_id", schoolId).order("grade_label"),
      db.from("school_grading_policies").select("id,academic_year_id,grade_label,pass_mark,rank_scope,missing_mark_rule").eq("school_id", schoolId),
      db.from("school_grade_scales").select("id,grade_label,minimum_score,maximum_score,letter_grade,description").eq("school_id", schoolId).order("grade_label"),
      db.from("school_policy_settings").select("school_id,attendance_notifications_enabled,behavior_notifications_enabled,report_card_notifications_enabled,absence_review_threshold").eq("school_id", schoolId).maybeSingle(),
      db.from("school_finance_followups").select("id,invoice_id,student_membership_id,submitted_by_membership_id,note,status,reviewed_at,resolution_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_disciplinary_recommendations").select("id,target_membership_id,target_kind,submitted_by_membership_id,reason,recommendation,status,decision_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_teacher_assignment_recommendations").select("id,teacher_membership_id,submitted_by_membership_id,current_assignment_id,recommendation_type,requested_section_id,requested_subject_name,requested_assignment_kind,reason,status,manager_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
    ]);

    // Load the complete school invoice ledger in bounded pages. Finance totals must not silently
    // represent only the newest 100 invoices on schools with larger ledgers.
    const allInvoices = [...(invoicesRes.data ?? [])];
    for (let offset = 500; (invoicesRes.data?.length ?? 0) === 500; offset += 500) {
      const { data: invoicePage, error: invoicePageError } = await db
        .from("school_student_invoices")
        .select("id,invoice_number,student_membership_id,amount,paid_amount,balance,status,due_date,currency")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .range(offset, offset + 499);
      if (invoicePageError) {
        toast.error(invoicePageError.message || "The complete school invoice ledger could not be loaded.");
        setLoading(false);
        return;
      }
      allInvoices.push(...(invoicePage ?? []));
      if ((invoicePage ?? []).length < 500) break;
    }

    const firstError = [membershipsRes, yearsRes, termsRes, sectionsRes, subjectsRes, assignmentsRes, feesRes, invoicesRes, tasksRes, evaluationsRes, requestsRes, categoriesRes, gradingPoliciesRes, gradeScalesRes, policySettingsRes, financeFollowupsRes, disciplinaryRes, assignmentRecommendationsRes].find((result) => result.error)?.error;
    if (firstError) {
      toast.error(firstError.message || "Could not load school records");
      setLoading(false);
      return;
    }

    const nextMembers = membershipsRes.data ?? [];
    setMembers(nextMembers);
    setYears(yearsRes.data ?? []);
    setTerms(termsRes.data ?? []);
    setTermYearId((current) => current || yearsRes.data?.find((year: any) => year.is_current)?.id || yearsRes.data?.[0]?.id || "");
    setSections(sectionsRes.data ?? []);
    setSubjects(subjectsRes.data ?? []);
    setAssignments(assignmentsRes.data ?? []);
    setFeeStructures(feesRes.data ?? []);
    setInvoices(allInvoices);
    setTasks(tasksRes.data ?? []);
    setEvaluations(evaluationsRes.data ?? []);
    setChangeRequests(requestsRes.data ?? []);
    setGradingCategories(categoriesRes.data ?? []);
    setGradingPolicies(gradingPoliciesRes.data ?? []);
    setGradeScales(gradeScalesRes.data ?? []);
    setPolicySettings(policySettingsRes.data ?? null);
    setFinanceFollowups(financeFollowupsRes.data ?? []);
    setDisciplinaryRecommendations(disciplinaryRes.data ?? []);
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
    } catch (error: unknown) {
      console.error("[Master Minds] SchoolManagerPortal.tsx data load failed", error);
      toast.error(error instanceof Error ? error.message : "This workspace could not load its records. Please retry.");
    } finally {
      setLoading(false);
    }
    setLoading(false);
  }, [schoolId, db, subjectYearId, feeYearId, gradingYearId, gradingGradeLabel]);

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
    setLeadershipAppointments((appointmentsRes.data ?? []).filter((item: any) => item.position !== "main_director"));
    setDivisionMappings(mappingsRes.data ?? []);
    setTeamAssignments(teamMembersRes.data ?? []);
    setLeadershipAuditEvents(auditRes.data ?? []);
    setLeadershipActionEvents(actionEventsRes.error ? [] : (actionEventsRes.data ?? []));
  }, [schoolId, db]);

  useEffect(() => { void loadLeadership(); }, [loadLeadership]);

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

  const initializeStandardEthiopianGradeMappings = async () => {
    if (!schoolId) return;
    const { data, error } = await db.rpc("school_initialize_default_ethiopian_grade_mappings", {
      p_school_id: schoolId,
    });
    if (error) return toast.error(error.message || "The standard grade structure could not be applied.");
    const added = Number(data ?? 0);
    toast.success(added > 0
      ? `Added ${added} standard Ethiopian grade mappings.`
      : "The standard Ethiopian grade mappings are already configured.");
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

  const loadManagerAudit = useCallback(async () => {
    if (!schoolId) return;
    const [recordRes, structureRes] = await Promise.all([
      db.from("school_record_events")
        .select("id,membership_id,event_type,details,actor_id,created_at")
        .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
      db.from("school_leadership_structure_events")
        .select("id,actor_user_id,event_type,details,created_at")
        .eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
    ]);
    if (recordRes.error && structureRes.error) {
      setAuditError("School audit history could not be loaded. Check your manager access and try again.");
      setRecordEvents([]);
      setStructureEvents([]);
      return;
    }
    setAuditError(recordRes.error || structureRes.error ? "Some audit categories are unavailable; the available records are still shown." : null);
    setRecordEvents(recordRes.data ?? []);
    setStructureEvents(structureRes.data ?? []);
  }, [schoolId, db]);

  useEffect(() => { void loadManagerAudit(); }, [loadManagerAudit]);

  const activeMembers = members.filter((member) => member.status === "active");
  const students = activeMembers.filter((member) => member.school_role === "student");
  const appointedLeaderMembershipIds = new Set(leadershipAppointments.filter((appointment) => appointment.status === "active").map((appointment) => appointment.membership_id));
  const teachers = activeMembers.filter((member) => member.school_role === "teacher" && !appointedLeaderMembershipIds.has(member.id));
  const parents = activeMembers.filter((member) => member.school_role === "parent");
  const staff = activeMembers.filter((member) => ["teacher", "finance"].includes(member.school_role));
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
        team_leader: "Team Leader",
      };
      return labels[appointment.position] || appointment.position;
    }
    return member.school_role === "admin" ? "Retired role · needs reassignment" : member.school_role;
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

  const convertLegacyAdminToHrDirector = async (membership: any) => {
    const personName = memberName(membership.id);
    const reason = `Retired the legacy School Admin designation for ${personName} and appointed HR Director / Business Manager.`;
    if (!window.confirm(`Convert ${personName} to HR Director / Business Manager? Their old designation will end and their existing account will be retained.`)) return;
    setConvertingLegacyMembershipId(membership.id);
    const { error } = await db.rpc("school_convert_legacy_admin_to_hr_director", {
      p_target_membership_id: membership.id,
      p_reason: reason,
    });
    if (error) {
      toast.error(error.message || "The legacy membership could not be converted.");
      setConvertingLegacyMembershipId(null);
      return;
    }
    toast.success(`${personName} is now HR Director / Business Manager.`);
    setConvertingLegacyMembershipId(null);
    await Promise.all([load(), loadLeadership()]);
  };

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setCreatedCredentials([]);
    if (!accountName.trim()) return setFormError("Enter the person's full name.");
    const account: any = { name: accountName.trim() };
    const directorDivisionByPosition: Record<string, string> = { kg_director: "kg", elementary_director: "elementary", middle_school_director: "middle_school", high_school_director: "high_school" };
    if (accountLeadershipPosition) {
      account.leadership_position = accountLeadershipPosition;
      account.division_scope = accountLeadershipPosition === "vice_director" ? accountLeadershipDivision : directorDivisionByPosition[accountLeadershipPosition] || null;
    }
    const provisionRole: "teacher" | "finance" | "parent" | "student" = accountLeadershipPosition === "hr_director" ? "finance" : accountLeadershipPosition ? "teacher" : accountRole;
    if (!accountLeadershipPosition && accountRole === "student") {
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
    if (!accountLeadershipPosition && accountRole === "parent") account.student_membership_ids = studentMembershipIds;
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
        p_team_name: null,
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

  const beginYearEdit = (year: any) => setYearEdit({
    id: year.id, name: year.name, starts_on: year.starts_on, ends_on: year.ends_on,
  });

  const saveAcademicYear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!yearEdit || !schoolId) return;
    const name = String(yearEdit.name || "").trim();
    const startsOn = String(yearEdit.starts_on || "");
    const endsOn = String(yearEdit.ends_on || "");
    if (!name || !startsOn || !endsOn || endsOn < startsOn) {
      return toast.error("Enter a name and a valid academic-year date range.");
    }
    if (terms.some((term) => term.academic_year_id === yearEdit.id && (term.starts_on < startsOn || term.ends_on > endsOn))) {
      return toast.error("The new academic-year dates must contain every existing term.");
    }
    const { error } = await db.from("school_academic_years")
      .update({ name, starts_on: startsOn, ends_on: endsOn })
      .eq("id", yearEdit.id).eq("school_id", schoolId);
    if (error) return toast.error(error.message || "Academic year could not be updated.");
    setYearEdit(null);
    toast.success("Academic year details updated.");
    await load();
  };

  const beginTermEdit = (term: any) => {
    setEditingTermId(term.id);
    setTermYearId(term.academic_year_id);
    setTermName(term.name);
    setTermNumber(String(term.term_number));
    setTermStart(term.starts_on);
    setTermEnd(term.ends_on);
  };

  const resetTermForm = () => {
    setEditingTermId(null);
    setTermName("");
    setTermNumber("1");
    setTermStart("");
    setTermEnd("");
  };

  const saveTerm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !termYearId) return toast.error("Choose the academic year for this term.");
    const academicYear = years.find((year) => year.id === termYearId);
    const name = termName.trim();
    const number = Number(termNumber);
    if (!academicYear || !name || name.length > 80 || !Number.isInteger(number) || number < 1) {
      return toast.error("Enter a term name and a positive whole-number term number.");
    }
    if (!termStart || !termEnd || termEnd < termStart || termStart < academicYear.starts_on || termEnd > academicYear.ends_on) {
      return toast.error("Term dates must be valid and fall within the selected academic year.");
    }
    const duplicateNumber = terms.some((term) => term.academic_year_id === termYearId
      && Number(term.term_number) === number && term.id !== editingTermId);
    if (duplicateNumber) return toast.error("That term number is already used in this academic year.");
    const overlaps = terms.some((term) => term.academic_year_id === termYearId && term.id !== editingTermId
      && termStart <= term.ends_on && termEnd >= term.starts_on);
    if (overlaps) return toast.error("Term dates cannot overlap another term in the same academic year.");
    const payload = { name, term_number: number, starts_on: termStart, ends_on: termEnd, academic_year_id: termYearId };
    const result = editingTermId
      ? await db.from("school_terms").update(payload).eq("id", editingTermId).eq("school_id", schoolId)
      : await db.from("school_terms").insert({ ...payload, school_id: schoolId, academic_year_id: termYearId });
    if (result.error) return toast.error(result.error.message || "Term could not be saved.");
    toast.success(editingTermId ? "Academic term updated." : "Academic term created.");
    resetTermForm();
    await load();
  };

  const toggleSubjectActive = async (subject: any) => {
    if (!schoolId) return;
    const { error } = await db.from("school_subjects")
      .update({ active: !subject.active, updated_at: new Date().toISOString() })
      .eq("id", subject.id).eq("school_id", schoolId);
    if (error) return toast.error(error.message || "Subject status could not be changed.");
    toast.success(subject.active ? "Subject archived for new assignments." : "Subject reactivated.");
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




  const copyCredentials = async () => {
    const text = createdCredentials.map((item) => `${item.username}\t${item.initial_password}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Credentials copied. Deliver them privately.");
    } catch {
      toast.error("Clipboard access is unavailable. Copy the credentials from the list.");
    }
  };

  const completeStudentLifecycleAction = async () => {
    if (!schoolId || !studentActionId || !studentActionStatus) return;
    const reason = studentActionReason.trim();
    if (reason.length < 5) {
      toast.error("Enter a reason of at least 5 characters before updating this student record.");
      return;
    }
    setStudentActionLoading(true);
    try {
      const { data, error } = await db.rpc("school_deactivate_student_membership", {
        p_membership_id: studentActionId,
        p_status: studentActionStatus,
        p_reason: reason,
      });
      if (error) throw error;
      if (data !== true) throw new Error("The student record was not updated. Please refresh and try again.");
      toast.success(
        studentActionStatus === "transferred" ? "Student marked as transferred."
          : studentActionStatus === "graduated" ? "Student marked as graduated."
          : "Student enrollment deactivated."
      );
      setStudentActionId(null);
      setStudentActionStatus("");
      setStudentActionReason("");
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update the student record.");
    } finally {
      setStudentActionLoading(false);
    }
  };

  const saveStudentPlacement = async () => {
    if (!schoolId || !studentPlacementId || !studentPlacementSectionId) {
      return toast.error("Choose the student's new section.");
    }
    const student = members.find((member) => member.id === studentPlacementId && member.school_role === "student");
    const section = sections.find((item) => item.id === studentPlacementSectionId);
    if (!student || !section || !["active", "suspended"].includes(student.status)) {
      return toast.error("This student or destination section is no longer available.");
    }
    if (student.section_id === section.id && student.grade_label === section.grade_label) {
      return toast.info("The student is already placed in this section.");
    }
    setStudentPlacementLoading(true);
    try {
      const { error } = await db.from("school_memberships")
        .update({ section_id: section.id, grade_label: section.grade_label })
        .eq("id", student.id).eq("school_id", schoolId).eq("school_role", "student");
      if (error) throw error;
      toast.success("Student placement updated. Grade and section history are retained by the database.");
      setStudentPlacementId(null);
      setStudentPlacementSectionId("");
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Student placement could not be updated.");
    } finally {
      setStudentPlacementLoading(false);
    }
  };

  const renderStudents = () => {
    const allStudents = members.filter((member) => member.school_role === "student");
    const normalizedSearch = studentSearch.trim().toLowerCase();
    const visibleStudents = allStudents.filter((student) => {
      const profile = profiles[student.user_id] ?? {};
      const searchable = [profile.name, profile.username, student.school_username, student.student_number, student.grade_label, sectionLabel(student.section_id), student.id, student.user_id]
        .filter(Boolean).join(" ").toLowerCase();
      return (studentStatusFilter === "all" || student.status === studentStatusFilter)
        && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
    const selectedStudent = allStudents.find((student) => student.id === selectedStudentId);
    if (selectedStudent) {
      const selectedProfile = profiles[selectedStudent.user_id] ?? {};
      return <SchoolManagerStudentProfile schoolId={schoolId} student={selectedStudent} profile={selectedProfile} sectionLabel={sectionLabel(selectedStudent.section_id)} terms={terms} onBack={() => setSelectedStudentId(null)} />;
    }
    return (
      <div className="space-y-5">
        <SchoolPageHeading
          title="Student directory"
          description="Find any student by name, username, assigned school ID, student number, or record ID. Open one profile for academic results, published rank, attendance, homework, fees, and enrollment history."
          action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SchoolMetric label="All student records" value={allStudents.length} detail="Including previous enrollments" icon={GraduationCap} />
          <SchoolMetric label="Active enrollment" value={allStudents.filter((student) => student.status === "active").length} detail="Currently enrolled" icon={Users} />
          <SchoolMetric label="Transferred" value={allStudents.filter((student) => student.status === "transferred").length} detail="Exited to another school" icon={School} />
          <SchoolMetric label="Graduated" value={allStudents.filter((student) => student.status === "graduated").length} detail="Completed school enrollment" icon={CheckCircle2} />
        </div>
        <SchoolPanel title="Find a student" description="Search by student name, username, school ID, student number, grade, section, or record ID.">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={schoolInputClass + " pl-9"} value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search name, school ID, student number, username or record ID…" aria-label="Search student records" />
            </label>
            <select className={schoolSelectClass} value={studentStatusFilter} onChange={(event) => setStudentStatusFilter(event.target.value)} aria-label="Filter students by enrollment status">
              <option value="all">All enrollment statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="transferred">Transferred</option>
              <option value="graduated">Graduated</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>{visibleStudents.length} of {allStudents.length} student records</span>
            <span>School-scoped records</span>
          </div>
          {visibleStudents.length ? (
            <div className="mt-3 divide-y divide-slate-100">
              {visibleStudents.map((student) => {
                const profile = profiles[student.user_id] ?? {};
                const actionOpen = studentActionId === student.id;
                const placementOpen = studentPlacementId === student.id;
                const canManagePlacement = ["active", "suspended"].includes(student.status);
                const canExit = canManagePlacement;
                return (
                  <div key={student.id} className="py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{profile.name || student.school_username || "Student account"}</p>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {profile.username ? "@" + profile.username : student.school_username || "No username"}
                          {student.student_number ? " · " + student.student_number : ""}
                          {" · "}{student.grade_label || "Grade not assigned"}
                          {" · "}{sectionLabel(student.section_id)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">Enrolled {student.created_at ? new Date(student.created_at).toLocaleDateString() : "date unavailable"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SchoolStatus value={student.status} />
                        <SchoolSecondaryButton onClick={() => setSelectedStudentId(student.id)}>Open profile</SchoolSecondaryButton>
                        {canManagePlacement && <SchoolSecondaryButton onClick={() => {
                          setStudentPlacementId(placementOpen ? null : student.id);
                          setStudentPlacementSectionId(student.section_id || "");
                        }}>{placementOpen ? "Close placement" : "Change placement"}</SchoolSecondaryButton>}
                        {canExit && <SchoolSecondaryButton onClick={() => {
                          setStudentActionId(actionOpen ? null : student.id);
                          setStudentActionStatus("");
                          setStudentActionReason("");
                        }}>{actionOpen ? "Close exit form" : "Record student exit"}</SchoolSecondaryButton>}
                      </div>
                    </div>
                    {placementOpen && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                        <p className="text-sm font-semibold text-slate-900">Change grade or section placement</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">Choose a section in this school. The student's grade is taken from the selected section; database triggers preserve the previous section history and record grade changes.</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <SchoolField label="New section">
                            <select className={schoolSelectClass} value={studentPlacementSectionId} onChange={(event) => setStudentPlacementSectionId(event.target.value)}>
                              <option value="">Choose destination section</option>
                              {sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name} · {years.find((year) => year.id === section.academic_year_id)?.name || "Academic year"}</option>)}
                            </select>
                          </SchoolField>
                          <div className="flex gap-2">
                            <SchoolSecondaryButton onClick={() => { setStudentPlacementId(null); setStudentPlacementSectionId(""); }}>Cancel</SchoolSecondaryButton>
                            <SchoolPrimaryButton onClick={() => void saveStudentPlacement()} disabled={studentPlacementLoading || !studentPlacementSectionId}>{studentPlacementLoading ? "Saving…" : "Save placement"}</SchoolPrimaryButton>
                          </div>
                        </div>
                      </div>
                    )}
                    {actionOpen && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                        <p className="text-sm font-semibold text-slate-900">Record an enrollment exit</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">This closes the student's active school enrollment, ends active parent links where applicable, and preserves the membership and section history. It does not delete the student's account.</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                          <SchoolField label="Exit type">
                            <select className={schoolSelectClass} value={studentActionStatus} onChange={(event) => setStudentActionStatus(event.target.value as typeof studentActionStatus)}>
                              <option value="">Choose exit type</option>
                              <option value="transferred">Transferred to another school</option>
                              <option value="graduated">Graduated</option>
                              <option value="deactivated">Other / deactivated</option>
                            </select>
                          </SchoolField>
                          <SchoolField label="Reason (required)">
                            <input className={schoolInputClass} value={studentActionReason} onChange={(event) => setStudentActionReason(event.target.value)} minLength={5} maxLength={500} placeholder="Record the reason for this enrollment change" />
                          </SchoolField>
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <SchoolSecondaryButton onClick={() => { setStudentActionId(null); setStudentActionStatus(""); setStudentActionReason(""); }}>Cancel</SchoolSecondaryButton>
                          <SchoolPrimaryButton onClick={() => void completeStudentLifecycleAction()} disabled={studentActionLoading || !studentActionStatus || studentActionReason.trim().length < 5}>{studentActionLoading ? "Saving…" : "Confirm student exit"}</SchoolPrimaryButton>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <SchoolEmptyState title={allStudents.length ? "No matching students" : "No student records yet"} description={allStudents.length ? "Try a different search term or enrollment status." : "Student accounts enrolled in this school will appear here."} />}
        </SchoolPanel>
      </div>
    );
  };

  const renderOverview = () => {
    const gradeCounts = students.reduce((acc: Record<string, number>, student) => {
      const grade = student.grade_label || "Unassigned";
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});
    const gradeData = (Object.entries(gradeCounts) as [string, number][]).map(([grade, count]) => ({ grade, students: count })).sort((a, b) => a.grade.localeCompare(b.grade));
    const attentionItems = [
      ...tasks.filter((task) => ["returned", "submitted", "open", "in_progress"].includes(task.status)).slice(0, 3).map((task) => ({
        id: task.id, title: task.title, detail: "Staff task · " + memberName(task.assigned_to_membership_id), status: task.status, page: "staff-support",
      })),
      ...changeRequests.filter((request) => ["pending", "submitted", "under_review"].includes(request.status)).slice(0, 2).map((request) => ({
        id: request.id, title: "Staff change request", detail: memberName(request.target_membership_id) + " · " + request.request_type, status: request.status, page: "staff-support",
      })),
      ...disciplinaryRecommendations.filter((item) => item.target_kind === "student" && ["pending", "submitted", "under_review"].includes(item.status)).slice(0, 2).map((item) => ({
        id: item.id, title: "Student support recommendation", detail: memberName(item.target_membership_id), status: item.status, page: "staff-support",
      })),
    ];
    const openTaskCount = tasks.filter((task) => ["open", "in_progress", "submitted", "returned"].includes(task.status)).length;
    const pendingRequestCount = changeRequests.filter((request) => ["pending", "submitted", "under_review"].includes(request.status)).length;
    const unassignedStudents = students.filter((student) => !student.section_id).length;
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl bg-[#10294B] text-white shadow-sm">
          <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">School command center</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Good day. Here's what needs your attention.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Manage the school from one place. Start with priority work, find any student, or jump directly to the workflow you need.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPage("students")} className="inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-[#10294B] hover:bg-blue-50"><Search className="mr-2 h-4 w-4" />Find a student</button>
                <button type="button" onClick={() => setPage("attendance")} className="inline-flex min-h-10 items-center rounded-lg border border-white/25 px-4 text-sm font-semibold text-white hover:bg-white/10">Review attendance</button>
                <button type="button" onClick={() => setPage("reports")} className="inline-flex min-h-10 items-center rounded-lg border border-white/25 px-4 text-sm font-semibold text-white hover:bg-white/10">View reports</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 self-end">
              <div className="rounded-xl border border-white/10 bg-white/10 p-4"><p className="text-xs text-blue-100">Active students</p><p className="mt-2 text-3xl font-bold tabular-nums">{students.length}</p><p className="mt-1 text-xs text-blue-100">{unassignedStudents} without a section</p></div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-4"><p className="text-xs text-blue-100">Active staff</p><p className="mt-2 text-3xl font-bold tabular-nums">{staff.length}</p><p className="mt-1 text-xs text-blue-100">{teachers.length} teachers</p></div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-4"><p className="text-xs text-blue-100">Open follow-ups</p><p className="mt-2 text-3xl font-bold tabular-nums">{openTaskCount}</p><p className="mt-1 text-xs text-blue-100">Staff tasks to track</p></div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-4"><p className="text-xs text-blue-100">Requests to review</p><p className="mt-2 text-3xl font-bold tabular-nums">{pendingRequestCount}</p><p className="mt-1 text-xs text-blue-100">Staff change requests</p></div>
            </div>
          </div>
        </section>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
          <SchoolPanel title="Priority work" description="A short list of open work from the records already available to your Manager account." action={<SchoolSecondaryButton onClick={() => setPage("staff-support")}>Open staff & student support</SchoolSecondaryButton>}>
            {attentionItems.length ? <div className="space-y-2">{attentionItems.slice(0, 6).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div><div className="flex items-center gap-2"><SchoolStatus value={item.status} /><SchoolSecondaryButton onClick={() => setPage(item.page)}>Review</SchoolSecondaryButton></div></div>)}</div> : <SchoolEmptyState title="No pending staff or student follow-ups" description="New tasks and review requests will appear here when they are recorded." />}
          </SchoolPanel>
          <SchoolPanel title="School setup checklist" description="A quick way to spot missing foundations.">
            <div className="space-y-3">
              {[
                { label: "Academic year configured", done: years.length > 0, action: "structure" },
                { label: "Sections created", done: sections.length > 0, action: "structure" },
                { label: "Subjects configured", done: subjects.some((subject) => subject.active), action: "structure" },
                { label: "Teachers assigned", done: assignments.length > 0, action: "assignments" },
                { label: "Students placed in sections", done: students.length > 0 && unassignedStudents === 0, action: "students" },
              ].map((item) => <button key={item.label} type="button" onClick={() => setPage(item.action)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-50"><span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full " + (item.done ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{item.done ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}</span><span className="flex-1 text-sm text-slate-700">{item.label}</span><span className="text-xs font-semibold text-blue-700">{item.done ? "Done" : "Set up"}</span></button>)}
            </div>
          </SchoolPanel>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <SchoolPanel title="Enrollment by grade" description="Live active school memberships. Select a grade in Reports for the detailed roster." action={<SchoolSecondaryButton onClick={() => setPage("reports")}>Explore reports</SchoolSecondaryButton>}>
            {gradeData.length ? <div className="space-y-3">{gradeData.slice(0, 8).map((item) => <div key={item.grade} className="flex items-center gap-3"><span className="w-28 shrink-0 truncate text-sm font-medium text-slate-700">{item.grade}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: (item.students / Math.max(1, students.length) * 100) + "%" }} /></div><span className="w-8 text-right text-sm font-semibold tabular-nums text-slate-700">{item.students}</span></div>)}</div> : <SchoolEmptyState title="No active student enrollment" description="Students will appear after enrollment records are created." />}
          </SchoolPanel>
          <SchoolPanel title="Recent staff activity" description="The latest follow-up work recorded in this school.">
            {tasks.length ? <div className="space-y-2">{tasks.slice(0, 5).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{task.title}</p><p className="mt-1 text-xs text-slate-500">{memberName(task.assigned_to_membership_id)}{task.due_date ? " · Due " + task.due_date : ""}</p></div><SchoolStatus value={task.status} /></div>)}</div> : <SchoolEmptyState title="No staff tasks yet" description="Create a follow-up task from Staff & Student Support when work needs an owner." />}
          </SchoolPanel>
        </div>
      </div>
    );
  };

  const renderAccounts = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="People & accounts" description="Create Director and Vice Director accounts, plus parent and student logins. Division Directors create Team Leader and Teacher accounts for their divisions." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SchoolPanel title="Create an account" description="Choose a Director role, parent, or student. Login details are shown once after creation.">
          <form onSubmit={createAccount} className="space-y-3">
            <SchoolField label="Account type">
              <select className={schoolSelectClass} value={accountLeadershipPosition ? "leadership" : accountRole} onChange={(event) => { if (event.target.value === "leadership") setAccountLeadershipPosition("kg_director"); else { setAccountLeadershipPosition(""); setAccountRole(event.target.value as AccountRole); } }}>
                  <option value="leadership">Director / Vice Director</option><option value="finance">Finance staff</option><option value="parent">Parent</option><option value="student">Student</option>
                </select>
            </SchoolField>
            {accountLeadershipPosition && <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <SchoolField label="Leadership position">
                <select className={schoolSelectClass} value={accountLeadershipPosition} onChange={(event) => setAccountLeadershipPosition(event.target.value as LeadershipPosition)}>
                  <option value="">Choose position</option><option value="kg_director">KG Division Director</option><option value="elementary_director">Elementary Division Director</option><option value="middle_school_director">Middle School Division Director</option><option value="high_school_director">High School Division Director</option><option value="vice_director">Vice Director</option><option value="academic_director">Academic Director</option><option value="hr_director">HR Director / Business Manager</option>
                </select>
              </SchoolField>
              {accountLeadershipPosition === "vice_director" && <SchoolField label="Division"><select className={schoolSelectClass} value={accountLeadershipDivision} onChange={(event) => setAccountLeadershipDivision(event.target.value)}><option value="kg">KG</option><option value="elementary">Elementary</option><option value="middle_school">Middle School</option><option value="high_school">High School</option></select></SchoolField>}
                            <p className="text-xs leading-5 text-slate-600">Create a real login for this Director or Vice Director. The leadership appointment is recorded automatically.</p>
            </div>}
            <SchoolField label="Full name"><input className={schoolInputClass} value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Full name" /></SchoolField>
            {accountRole === "student" && <>
              <SchoolField label="Class section"><select className={schoolSelectClass} value={accountSectionId} onChange={(event) => setAccountSectionId(event.target.value)}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
              <SchoolField label="Age at enrollment"><input type="number" min="3" max="120" className={schoolInputClass} value={accountAge} onChange={(event) => setAccountAge(event.target.value)} /></SchoolField>
              <SchoolField label="Link parent accounts"><select multiple className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-2 text-sm" value={parentMembershipIds} onChange={(event) => setParentMembershipIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>{parents.map((parent) => <option key={parent.id} value={parent.id}>{memberName(parent.id)}</option>)}</select></SchoolField>
            </>}
            {accountRole === "parent" && <SchoolField label="Link children"><select multiple className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-2 text-sm" value={studentMembershipIds} onChange={(event) => setStudentMembershipIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>{students.map((student) => <option key={student.id} value={student.id}>{memberName(student.id)} · {student.grade_label || "Student"}</option>)}</select></SchoolField>}
            {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            <SchoolPrimaryButton type="submit">Create account</SchoolPrimaryButton>
          </form>
          {createdCredentials.length > 0 && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-emerald-900">Initial login credentials</p><button onClick={() => void copyCredentials()} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><Copy className="h-3.5 w-3.5" />Copy</button></div>
            <p className="mt-1 text-xs text-emerald-800">Copy these now and deliver them privately. The user must change the temporary password after signing in. Credentials are shown only once.</p>
            <div className="mt-3 space-y-2">{createdCredentials.map((item, index) => <div key={index} className="rounded-md border border-emerald-200 bg-white p-2 text-xs"><p><span className="font-semibold">Username:</span> {item.username}</p><p className="mt-1 break-all"><span className="font-semibold">Initial password:</span> {item.initial_password}</p></div>)}</div>
          </div>}
        </SchoolPanel>
        <SchoolPanel title="School accounts" description={`${members.length} school memberships. Existing retired staff records can be reassigned to current leadership roles.`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="pb-2 font-semibold">Person</th><th className="pb-2 font-semibold">Role</th><th className="pb-2 font-semibold">Grade / section</th><th className="pb-2 font-semibold">Status</th><th className="pb-2 font-semibold">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{members.map((member) => <tr key={member.id}><td className="py-3"><p className="font-medium text-slate-800">{memberName(member.id)}</p><p className="mt-0.5 text-xs text-slate-500">{member.school_username}</p></td><td className="py-3 text-slate-600">{membershipRoleLabel(member)}</td><td className="py-3 text-slate-600">{member.grade_label ? `${member.grade_label} · ${sectionLabel(member.section_id)}` : "—"}</td><td className="py-3"><SchoolStatus value={member.status} /></td><td className="py-3">{member.school_role === "admin" && member.status === "suspended" && member.end_reason === "Legacy School Admin role retired; awaiting Manager reassignment." ? <button type="button" disabled={convertingLegacyMembershipId === member.id} onClick={() => void convertLegacyAdminToHrDirector(member)} className="rounded-md border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">{convertingLegacyMembershipId === member.id ? "Converting…" : "Appoint HR Director"}</button> : <span className="text-xs text-slate-400">—</span>}</td></tr>)}</tbody>
            </table>
          </div>
        </SchoolPanel>
      </div>

    </div>
  );

  const renderStructure = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School structure" description="Manage academic years, terms, and the subject catalog. Division Directors create class sections within their authorized grades." />
      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Academic year" description="Create a school year and optionally make it the current year.">
          <form onSubmit={addAcademicYear} className="space-y-3">
            <SchoolField label="Academic year name"><input className={schoolInputClass} value={yearName} onChange={(event) => setYearName(event.target.value)} placeholder="2026/2027" maxLength={80} required /></SchoolField>
            <div className="grid gap-3 sm:grid-cols-2">
              <SchoolField label="Start date"><input type="date" className={schoolInputClass} value={yearStart} onChange={(event) => setYearStart(event.target.value)} required /></SchoolField>
              <SchoolField label="End date"><input type="date" className={schoolInputClass} value={yearEnd} onChange={(event) => setYearEnd(event.target.value)} required /></SchoolField>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={yearIsCurrent} onChange={(event) => setYearIsCurrent(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" /> Set as current academic year</label>
            <SchoolPrimaryButton type="submit">Add academic year</SchoolPrimaryButton>
          </form>
        </SchoolPanel>
        <SchoolPanel title="Subject catalog" description="Subjects are scoped to an academic year and grade. Archiving preserves existing historical references.">
          <form onSubmit={addSubject} className="space-y-3">
            <SchoolField label="Academic year"><select className={schoolSelectClass} value={subjectYearId} onChange={(event) => setSubjectYearId(event.target.value)} required><option value="">Choose year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
            <SchoolField label="Grade"><input className={schoolInputClass} value={subjectGrade} onChange={(event) => setSubjectGrade(event.target.value)} placeholder="Grade 9" maxLength={80} required /></SchoolField>
            <SchoolField label="Subject name"><input className={schoolInputClass} value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Mathematics" maxLength={120} required /></SchoolField>
            <SchoolPrimaryButton type="submit">Add subject</SchoolPrimaryButton>
          </form>
        </SchoolPanel>
      </div>
      <SchoolPanel title={editingTermId ? "Edit academic term" : "Academic terms"} description="Terms must fall within their academic year, use a unique number, and not overlap another term.">
        <form onSubmit={saveTerm} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SchoolField label="Academic year"><select className={schoolSelectClass} value={termYearId} onChange={(event) => setTermYearId(event.target.value)} required><option value="">Choose year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
          <SchoolField label="Term name"><input className={schoolInputClass} value={termName} onChange={(event) => setTermName(event.target.value)} placeholder="Term 1" maxLength={80} required /></SchoolField>
          <SchoolField label="Term number"><input type="number" min="1" step="1" className={schoolInputClass} value={termNumber} onChange={(event) => setTermNumber(event.target.value)} required /></SchoolField>
          <SchoolField label="Start date"><input type="date" className={schoolInputClass} value={termStart} onChange={(event) => setTermStart(event.target.value)} required /></SchoolField>
          <SchoolField label="End date"><input type="date" className={schoolInputClass} value={termEnd} onChange={(event) => setTermEnd(event.target.value)} required /></SchoolField>
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-5">
            <SchoolPrimaryButton type="submit">{editingTermId ? "Save term changes" : "Create term"}</SchoolPrimaryButton>
            {editingTermId && <SchoolSecondaryButton onClick={resetTermForm}>Cancel edit</SchoolSecondaryButton>}
          </div>
        </form>
        <div className="mt-4 divide-y divide-slate-100">
          {terms.map((term) => (
            <div key={term.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{term.name} · Term {term.term_number}</p>
                <p className="mt-1 text-xs text-slate-500">{years.find((year) => year.id === term.academic_year_id)?.name || "Academic year"} · {term.starts_on} – {term.ends_on}</p>
              </div>
              <SchoolSecondaryButton onClick={() => beginTermEdit(term)}>Edit term</SchoolSecondaryButton>
            </div>
          ))}
          {!terms.length && <div className="py-3"><SchoolEmptyState title="No academic terms configured" description="Add the school's first term for an academic year." /></div>}
        </div>
      </SchoolPanel>
      <div className="grid gap-4 xl:grid-cols-3">
        <SchoolPanel title="Academic years">
          <div className="space-y-2">
            {years.map((year) => (
              <div key={year.id} className="rounded-md border border-slate-100 p-3">
                {yearEdit?.id === year.id ? (
                  <form onSubmit={saveAcademicYear} className="space-y-2">
                    <SchoolField label="Year name"><input className={schoolInputClass} value={yearEdit.name} onChange={(event) => setYearEdit((current: any) => ({ ...current, name: event.target.value }))} maxLength={80} required /></SchoolField>
                    <div className="grid grid-cols-2 gap-2">
                      <SchoolField label="Start"><input type="date" className={schoolInputClass} value={yearEdit.starts_on} onChange={(event) => setYearEdit((current: any) => ({ ...current, starts_on: event.target.value }))} required /></SchoolField>
                      <SchoolField label="End"><input type="date" className={schoolInputClass} value={yearEdit.ends_on} onChange={(event) => setYearEdit((current: any) => ({ ...current, ends_on: event.target.value }))} required /></SchoolField>
                    </div>
                    <div className="flex gap-2"><SchoolPrimaryButton type="submit">Save</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => setYearEdit(null)}>Cancel</SchoolSecondaryButton></div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="text-sm font-medium text-slate-800">{year.name}</p><p className="text-xs text-slate-500">{year.starts_on} – {year.ends_on}</p></div>
                    <div className="flex items-center gap-2">
                      {year.is_current ? <SchoolStatus value="active" /> : <SchoolSecondaryButton onClick={() => void setCurrentYear(year.id)}>Set current</SchoolSecondaryButton>}
                      <SchoolSecondaryButton onClick={() => beginYearEdit(year)}>Edit</SchoolSecondaryButton>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!years.length && <SchoolEmptyState title="No years yet" description="Add the first academic year." />}
          </div>
        </SchoolPanel>
        <SchoolPanel title="Sections" description="Section creation is delegated to the assigned Division Directors. Managers can oversee section placement and staffing.">
          <div className="space-y-2">
            {sections.map((section) => {
              const enrolledCount = students.filter((student) => student.section_id === section.id).length;
              const division = divisionMappings.find((mapping) => mapping.grade_label === section.grade_label)?.division_scope;
              return <div key={section.id} className="rounded-md border border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{section.grade_label} {section.section_name}</p><SchoolStatus value={division ? "mapped" : "unmapped"} /></div>
                <p className="mt-1 text-xs text-slate-500">{years.find((year) => year.id === section.academic_year_id)?.name || "Academic year"} · {enrolledCount} active students</p>
                <p className="mt-1 text-xs text-slate-500">Homeroom: {section.homeroom_teacher_id ? memberName(section.homeroom_teacher_id) : "Not assigned"}</p>
              </div>;
            })}
            {!sections.length && <SchoolEmptyState title="No sections yet" description="Map grades to divisions in Leadership Team, then the relevant Division Director can create sections." />}
          </div>
        </SchoolPanel>
        <SchoolPanel title="Subjects">
          <div className="space-y-2">
            {subjects.map((subject) => <div key={subject.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 p-3">
              <div><p className="text-sm font-medium text-slate-800">{subject.subject_name}</p><p className="text-xs text-slate-500">{subject.grade_label} · {years.find((year) => year.id === subject.academic_year_id)?.name || "Academic year"}</p></div>
              <div className="flex items-center gap-2"><SchoolStatus value={subject.active ? "active" : "deactivated"} /><SchoolSecondaryButton onClick={() => void toggleSubjectActive(subject)}>{subject.active ? "Archive" : "Reactivate"}</SchoolSecondaryButton></div>
            </div>)}
            {!subjects.length && <SchoolEmptyState title="No subjects yet" description="Add subjects by grade and academic year." />}
          </div>
        </SchoolPanel>
      </div>
    </div>
  );

  const renderAssignments = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Teacher assignments" description="Assign teachers to subjects, grades, sections, and homeroom responsibilities." />
      <SchoolPanel title="Create assignment">
        <form onSubmit={addAssignment} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SchoolField label="Teacher"><select className={schoolSelectClass} value={assignTeacherId} onChange={(event) => setAssignTeacherId(event.target.value)}><option value="">Choose teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{memberName(teacher.id)}</option>)}</select></SchoolField>
          <SchoolField label="Section"><select className={schoolSelectClass} value={assignSectionId} onChange={(event) => setAssignSectionId(event.target.value)}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
          <SchoolField label="Assignment type"><select className={schoolSelectClass} value={assignKind} onChange={(event) => setAssignKind(event.target.value as "subject" | "homeroom")}><option value="subject">Subject teacher</option><option value="homeroom">Homeroom teacher</option></select></SchoolField>
          {assignKind === "subject" && <SchoolField label="Subject"><select className={schoolSelectClass} value={assignSubject} onChange={(event) => setAssignSubject(event.target.value)}><option value="">Choose subject</option>{subjects.filter((subject) => subject.active && subject.grade_label === sections.find((section) => section.id === assignSectionId)?.grade_label && subject.academic_year_id === sections.find((section) => section.id === assignSectionId)?.academic_year_id).map((subject) => <option key={subject.id} value={subject.subject_name}>{subject.subject_name}</option>)}</select></SchoolField>}
          <div className="md:col-span-2 xl:col-span-4"><SchoolPrimaryButton type="submit">Save assignment</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Current assignments">
        {assignments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Teacher</th><th className="pb-2">Section</th><th className="pb-2">Subject / responsibility</th><th className="pb-2">Type</th><th className="pb-2">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{assignments.map((assignment) => <tr key={assignment.id}><td className="py-3 font-medium text-slate-800">{memberName(assignment.teacher_membership_id)}</td><td className="py-3 text-slate-600">{sectionLabel(assignment.section_id)}</td><td className="py-3 text-slate-600">{assignment.subject_name}</td><td className="py-3 capitalize text-slate-600">{assignment.assignment_kind}</td><td className="py-3"><button type="button" onClick={() => void deleteTeacherAssignment(assignment)} className="text-xs font-semibold text-red-700 hover:underline">Remove</button></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No teacher assignments" description="Create assignments after teachers, sections, and subjects have been added." />}
      </SchoolPanel>
      <SchoolPanel title="Teacher assignment recommendations" description="Review assignment requests submitted through the authorized teacher workflow. Accepting a recommendation records the decision; the actual assignment is still made above.">
        {assignmentRecommendations.length ? <div className="space-y-3">{assignmentRecommendations.map((recommendation) => <article key={recommendation.id} className="rounded-xl border border-slate-100 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{memberName(recommendation.teacher_membership_id)} · {String(recommendation.recommendation_type).replace(/_/g, " ")}</p><SchoolStatus value={recommendation.status} /></div>
          <p className="mt-1 text-xs text-slate-500">Submitted by {memberName(recommendation.submitted_by_membership_id)} · {new Date(recommendation.created_at).toLocaleString()}</p>
          <p className="mt-2 text-sm text-slate-700">{recommendation.reason}</p>
          <p className="mt-1 text-xs text-slate-500">Requested section: {sectionLabel(recommendation.requested_section_id)} · Subject: {recommendation.requested_subject_name || "Not specified"} · Type: {recommendation.requested_assignment_kind || "Not specified"}</p>
          {recommendation.status === "pending" && <><textarea className={schoolTextareaClass + " mt-3"} rows={2} maxLength={2000} value={managerReviewNotes[recommendation.id] || ""} onChange={(event) => setManagerReviewNotes((current) => ({ ...current, [recommendation.id]: event.target.value }))} placeholder="Manager decision note (optional)…" /><div className="mt-2 flex flex-wrap gap-2"><SchoolPrimaryButton onClick={() => void reviewAssignmentRecommendation(recommendation, true)}>Accept recommendation</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewAssignmentRecommendation(recommendation, false)}>Decline recommendation</SchoolSecondaryButton></div></>}
          {recommendation.manager_note && <p className="mt-2 text-xs text-slate-600">Manager note: {recommendation.manager_note}</p>}
        </article>)}</div> : <SchoolEmptyState title="No assignment recommendations" description="Teacher-submitted assignment recommendations will appear here for review." />}
      </SchoolPanel>
    </div>
  );

  const renderStaffDirectory = () => {
    const staffMembers = members.filter((member) => ["teacher", "finance", "admin"].includes(member.school_role));
    const normalizedSearch = staffSearch.trim().toLowerCase();
    const visibleStaff = staffMembers.filter((member) => {
      const profile = profiles[member.user_id] ?? {};
      const appointment = leadershipAppointments.find((item) => item.membership_id === member.id && item.status === "active");
      const assignmentSummary = assignments.filter((item) => item.teacher_membership_id === member.id)
        .map((item) => `${sectionLabel(item.section_id)} ${item.subject_name}`).join(" ");
      const searchable = [profile.name, profile.username, member.school_username, member.school_role, appointment?.position, assignmentSummary]
        .filter(Boolean).join(" ").toLowerCase();
      return (staffRoleFilter === "all" || member.school_role === staffRoleFilter)
        && (staffStatusFilter === "all" || (staffStatusFilter === "active" ? member.status === "active" : member.status !== "active"))
        && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
    return (
      <div className="space-y-5">
        <SchoolPageHeading title="Staff directory" description="Review school staff memberships, leadership appointments, and teaching assignments. Account creation and existing-account linking remain in People & Accounts." action={<SchoolSecondaryButton onClick={() => setPage("accounts")}>Onboard staff</SchoolSecondaryButton>} />
        <div className="grid gap-3 sm:grid-cols-3">
          <SchoolMetric label="Staff memberships" value={staffMembers.length} detail="Teachers, Finance, and legacy Admin records" icon={UsersRound} />
          <SchoolMetric label="Active staff" value={staffMembers.filter((member) => member.status === "active").length} detail="Active school memberships" icon={CheckCircle2} />
          <SchoolMetric label="Teacher assignments" value={assignments.length} detail="Subject and homeroom assignments" icon={UserCog} />
        </div>
        <SchoolPanel title="Find staff" description="Search by name, username, role, leadership position, subject, or section.">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_190px]">
            <input className={schoolInputClass} value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} placeholder="Search staff…" aria-label="Search school staff" />
            <select className={schoolSelectClass} value={staffRoleFilter} onChange={(event) => setStaffRoleFilter(event.target.value)} aria-label="Filter staff by role">
              <option value="all">All staff roles</option><option value="teacher">Teachers</option><option value="finance">Finance</option><option value="admin">Legacy Admin</option>
            </select>
            <select className={schoolSelectClass} value={staffStatusFilter} onChange={(event) => setStaffStatusFilter(event.target.value)} aria-label="Filter staff by membership status">
              <option value="all">All membership statuses</option><option value="active">Active</option><option value="inactive">Inactive / suspended</option>
            </select>
          </div>
          <p className="mt-3 text-xs text-slate-500">{visibleStaff.length} of {staffMembers.length} staff memberships</p>
          {visibleStaff.length ? <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Staff member</th><th className="pb-2">Role / leadership</th><th className="pb-2">Assignments</th><th className="pb-2">Status</th><th className="pb-2">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStaff.map((member) => {
                  const appointment = leadershipAppointments.find((item) => item.membership_id === member.id && item.status === "active");
                  const memberAssignments = assignments.filter((item) => item.teacher_membership_id === member.id);
                  return <tr key={member.id}>
                    <td className="py-3"><p className="font-semibold text-slate-800">{memberName(member.id)}</p><p className="mt-1 text-xs text-slate-500">{profiles[member.user_id]?.username ? "@" + profiles[member.user_id].username : member.school_username || "No username"}</p></td>
                    <td className="py-3"><p className="capitalize text-slate-700">{member.school_role === "admin" ? "Legacy Admin" : member.school_role}</p>{appointment && <p className="mt-1 text-xs text-blue-700">{appointment.position.replace(/_/g, " ")}{appointment.division_scope ? " · " + appointment.division_scope.replace(/_/g, " ") : ""}</p>}</td>
                    <td className="py-3 text-slate-600">{member.school_role === "teacher" ? memberAssignments.length : "—"}</td>
                    <td className="py-3"><SchoolStatus value={member.status} /></td>
                    <td className="py-3"><SchoolSecondaryButton onClick={() => setPage("assignments")} disabled={member.school_role !== "teacher"}>Assignments</SchoolSecondaryButton></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div> : <SchoolEmptyState title="No matching staff" description="Change the search or filters, or onboard a new staff member." />}
        </SchoolPanel>
      </div>
    );
  };

  const renderManagerSettings = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Manager settings" description="Manage school-level operating policies while preserving network-controlled identity and platform access boundaries." />
      <SchoolPanel title="School identity" description="These fields are managed by the school network and are read-only in the School Manager portal.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-slate-100 p-3"><p className="text-xs font-semibold uppercase text-slate-500">School name</p><p className="mt-1 text-sm font-semibold text-slate-800">{activeSchool?.name || "Unavailable"}</p></div>
          <div className="rounded-md border border-slate-100 p-3"><p className="text-xs font-semibold uppercase text-slate-500">School code</p><p className="mt-1 text-sm font-semibold text-slate-800">{activeSchool?.school_code || "Unavailable"}</p></div>
        </div>
        <p className="mt-3 text-xs text-slate-500">For school name, code, network assignment, or school lifecycle changes, submit the request through the authorized network administration workflow.</p>
      </SchoolPanel>
      <SchoolPanel title="Attendance and parent notification policies" description="Attendance and behavior remain separate from academic marks by default. These settings control notifications and the absence review threshold.">
        {policySettings ? <form onSubmit={savePolicySettings} className="space-y-3">
          <label className="flex items-center gap-3 rounded-md border border-slate-100 p-3 text-sm text-slate-700"><input type="checkbox" checked={Boolean(policySettings.attendance_notifications_enabled)} onChange={(event) => setPolicySettings((current: any) => ({ ...current, attendance_notifications_enabled: event.target.checked }))} />Send automatic parent notifications when homeroom attendance is submitted</label>
          <label className="flex items-center gap-3 rounded-md border border-slate-100 p-3 text-sm text-slate-700"><input type="checkbox" checked={Boolean(policySettings.behavior_notifications_enabled)} onChange={(event) => setPolicySettings((current: any) => ({ ...current, behavior_notifications_enabled: event.target.checked }))} />Notify parents after a behavior report is approved</label>
          <label className="flex items-center gap-3 rounded-md border border-slate-100 p-3 text-sm text-slate-700"><input type="checkbox" checked={Boolean(policySettings.report_card_notifications_enabled)} onChange={(event) => setPolicySettings((current: any) => ({ ...current, report_card_notifications_enabled: event.target.checked }))} />Notify parents when official report cards are published</label>
          <SchoolField label="Absences requiring School Manager review"><input type="number" min="1" max="60" className={schoolInputClass} value={policySettings.absence_review_threshold} onChange={(event) => setPolicySettings((current: any) => ({ ...current, absence_review_threshold: event.target.value }))} /></SchoolField>
          <SchoolPrimaryButton type="submit">Save school policies</SchoolPrimaryButton>
        </form> : <SchoolEmptyState title="Policy settings unavailable" description="The school's policy settings row has not been created." />}
      </SchoolPanel>
      <SchoolPanel title="Manager authority and access" description="School Manager access is limited by the authenticated school membership and database policies.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-slate-100 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Your school role</p><p className="mt-1 text-sm font-semibold text-slate-800">{activeMembership?.school_role || "Unavailable"}</p></div>
          <div className="rounded-md border border-slate-100 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Membership status</p><div className="mt-1"><SchoolStatus value={activeMembership?.status || "unknown"} /></div></div>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
          <li>Manager actions are restricted to this school; cross-school network controls remain with Super Admin.</li>
          <li>Student exits preserve accounts and enrollment history and require a reason.</li>
          <li>Leadership permissions and appointments use audited database workflows.</li>
          <li>Class-section creation remains delegated to Division Directors after grade mapping.</li>
        </ul>
      </SchoolPanel>

    </div>
  );

  const renderSchoolAudit = () => {
    const combined = [
      ...recordEvents.map((event) => ({ ...event, source: "Student / staff record", actor: event.actor_id, searchable: JSON.stringify(event.details || {}) + " " + event.event_type + " " + memberName(event.membership_id) })),
      ...structureEvents.map((event) => ({ ...event, source: "School structure", actor: event.actor_user_id, searchable: JSON.stringify(event.details || {}) + " " + event.event_type })),
      ...leadershipAuditEvents.map((event) => ({ ...event, source: "Leadership appointment", actor: event.actor_user_id, details: { reason: event.reason, after_state: event.after_state }, searchable: JSON.stringify(event.after_state || {}) + " " + (event.reason || "") + " " + event.event_type })),
      ...leadershipActionEvents.map((event) => ({ ...event, event_type: event.action_type, source: "Leadership operation", actor: event.actor_user_id, details: { reason: event.reason, before_state: event.before_state, after_state: event.after_state }, searchable: JSON.stringify(event.before_state || {}) + " " + JSON.stringify(event.after_state || {}) + " " + (event.reason || "") + " " + event.action_type })),
    ].filter((event) => !auditSearch.trim() || event.searchable.toLowerCase().includes(auditSearch.trim().toLowerCase()))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return (
      <div className="space-y-5">
        <SchoolPageHeading title="School audit history" description="Review the latest 100 records per available event stream for student lifecycle, grade-division mapping, leadership appointments, and leadership operations." action={<SchoolSecondaryButton onClick={() => void loadManagerAudit()}><RefreshCw className="mr-2 h-4 w-4" />Refresh audit</SchoolSecondaryButton>} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SchoolMetric label="Record lifecycle events" value={recordEvents.length} detail="Enrollment and membership history" icon={Users} /><SchoolMetric label="Structure events" value={structureEvents.length} detail="Grade and division changes" icon={CalendarDays} /><SchoolMetric label="Leadership appointments" value={leadershipAuditEvents.length} detail="Appointment and permission changes" icon={UserCog} /><SchoolMetric label="Leadership operations" value={leadershipActionEvents.length} detail="Audited school-leadership actions" icon={FileClock} /></div>
        {auditError && <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{auditError}</div>}
        <SchoolPanel title="Audit events" description="Events are read-only. Sensitive actions remain recorded by the database.">
          <input className={schoolInputClass} value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Search event type, member, or event details…" aria-label="Search school audit events" />
          {combined.length ? <div className="mt-3 divide-y divide-slate-100">
            {combined.map((event) => <div key={event.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold capitalize text-slate-800">{event.event_type.replace(/_/g, " ")}</p><SchoolStatus value={event.source === "School structure" ? "structure" : "record"} /></div>
                <p className="mt-1 text-xs text-slate-500">{event.source}{event.membership_id ? " · " + memberName(event.membership_id) : ""} · By {profiles[event.actor]?.name || "School Manager"}</p>
                <p className="mt-1 break-words text-xs text-slate-600">{JSON.stringify(event.details || {})}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">{new Date(event.created_at).toLocaleString()}</span>
            </div>)}
          </div> : <SchoolEmptyState title="No matching audit events" description="Events will appear here when school lifecycle or structure changes are recorded." />}
        </SchoolPanel>
      </div>
    );
  };

  useEffect(() => {
    const policy = gradingPolicies.find((item) => item.academic_year_id === gradingYearId && item.grade_label === gradingGradeLabel);
    setPassMark(String(policy?.pass_mark ?? 50));
    setRankScope(policy?.rank_scope ?? "section");
    setMissingMarkRule(policy?.missing_mark_rule ?? "incomplete");
  }, [gradingYearId, gradingGradeLabel, gradingPolicies]);

  const renderGrading = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Grading & school policies" description="Configure each grade's assessment weights, pass mark, ranking scope, and grade scale." />
      <SchoolPanel title="Select academic year and grade">
        <div className="grid gap-3 sm:grid-cols-2">
          <SchoolField label="Academic year"><select className={schoolSelectClass} value={gradingYearId} onChange={(event) => setGradingYearId(event.target.value)}><option value="">Choose year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.is_current ? " · Current" : ""}</option>)}</select></SchoolField>
          <SchoolField label="Grade"><select className={schoolSelectClass} value={gradingGradeLabel} onChange={(event) => setGradingGradeLabel(event.target.value)}>{[...new Set(sections.map((section) => section.grade_label))].sort().map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></SchoolField>
        </div>
      </SchoolPanel>
      <SchoolPanel title="Assessment categories and weights" description="The default grading model is Class Activities 10%, Tests 30%, and Final Examination 60%. The total must equal 100% before term results can be calculated.">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-700">Current total: <span className={categoryWeightTotal === 100 ? "text-emerald-700" : "text-amber-700"}>{categoryWeightTotal.toFixed(2)}%</span></p><SchoolSecondaryButton onClick={() => void seedGradingDefaults()} disabled={!gradingYearId || !gradingGradeLabel}>Seed default 10/30/60 categories</SchoolSecondaryButton></div>
        {selectedGradingCategories.length ? <div className="space-y-2">{selectedGradingCategories.map((category) => <div key={category.id} className="grid gap-2 rounded-md border border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_120px_100px_auto] sm:items-end"><SchoolField label="Category name"><input className={schoolInputClass} value={category.category_name} onChange={(event) => setGradingCategories((current) => current.map((item) => item.id === category.id ? { ...item, category_name: event.target.value } : item))} /></SchoolField><SchoolField label="Weight (%)"><input type="number" min="0" max="100" step="0.01" className={schoolInputClass} value={category.weight_percent} onChange={(event) => setGradingCategories((current) => current.map((item) => item.id === category.id ? { ...item, weight_percent: event.target.value } : item))} /></SchoolField><label className="flex min-h-10 items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={Boolean(category.required)} onChange={(event) => setGradingCategories((current) => current.map((item) => item.id === category.id ? { ...item, required: event.target.checked } : item))} />Required</label><SchoolSecondaryButton onClick={() => void saveCategory(category)}>Save</SchoolSecondaryButton></div>)}</div> : <SchoolEmptyState title="No grading categories configured" description="Seed the default 10/30/60 categories or add your own." />}
        <form onSubmit={addGradingCategory} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end"><SchoolField label="New category"><input className={schoolInputClass} value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Project work" /></SchoolField><SchoolField label="Weight (%)"><input type="number" min="0" max="100" step="0.01" className={schoolInputClass} value={newCategoryWeight} onChange={(event) => setNewCategoryWeight(event.target.value)} /></SchoolField><SchoolPrimaryButton type="submit">Add category</SchoolPrimaryButton></form>
      </SchoolPanel>
      <SchoolPanel title="Grading and ranking policy">
        <form onSubmit={saveGradingPolicy} className="grid gap-3 md:grid-cols-3">
          <SchoolField label="Pass mark (%)"><input type="number" min="0" max="100" step="0.5" className={schoolInputClass} value={passMark} onChange={(event) => setPassMark(event.target.value)} /></SchoolField>
          <SchoolField label="Ranking scope"><select className={schoolSelectClass} value={rankScope} onChange={(event) => setRankScope(event.target.value)}><option value="section">Within each section</option><option value="grade">Across the whole grade</option></select></SchoolField>
          <SchoolField label="Missing mark rule"><select className={schoolSelectClass} value={missingMarkRule} onChange={(event) => setMissingMarkRule(event.target.value)}><option value="incomplete">Mark term incomplete</option><option value="zero">Treat missing mark as zero</option></select></SchoolField>
          <div className="md:col-span-3"><SchoolPrimaryButton type="submit">Save grading policy</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Grade scale" description="Define non-overlapping percentage ranges for the selected grade.">
        <div className="mb-3 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Letter</th><th className="pb-2">Minimum</th><th className="pb-2">Maximum</th><th className="pb-2">Description</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedGradeScales.map((scale) => <tr key={scale.id}><td className="py-2 font-semibold text-slate-800">{scale.letter_grade}</td><td className="py-2 text-slate-600">{scale.minimum_score}%</td><td className="py-2 text-slate-600">{scale.maximum_score}%</td><td className="py-2 text-slate-600">{scale.description || "—"}</td></tr>)}</tbody></table></div>
        <form onSubmit={addGradeScale} className="grid gap-2 sm:grid-cols-5 sm:items-end"><SchoolField label="Letter"><input className={schoolInputClass} value={newScaleLetter} onChange={(event) => setNewScaleLetter(event.target.value)} placeholder="A" /></SchoolField><SchoolField label="Minimum %"><input type="number" min="0" max="100" className={schoolInputClass} value={newScaleMin} onChange={(event) => setNewScaleMin(event.target.value)} /></SchoolField><SchoolField label="Maximum %"><input type="number" min="0" max="100" className={schoolInputClass} value={newScaleMax} onChange={(event) => setNewScaleMax(event.target.value)} /></SchoolField><SchoolField label="Description"><input className={schoolInputClass} value={newScaleDescription} onChange={(event) => setNewScaleDescription(event.target.value)} /></SchoolField><SchoolPrimaryButton type="submit">Add scale</SchoolPrimaryButton></form>
      </SchoolPanel>

    </div>
  );

  const renderFinance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School fees & finance" description="Configure fee structures and oversee invoices, payments, and outstanding balances. Daily payment processing belongs to the School Finance team." />
      <div className="grid gap-3 sm:grid-cols-3"><SchoolMetric label="Fee structures" value={feeStructures.length} detail="Configured school fees" icon={Wallet} /><SchoolMetric label="Invoices" value={invoices.length} detail="Generated by Finance" icon={ClipboardList} /><SchoolMetric label="Outstanding balance" value={outstandingSummary} detail="Unpaid and partial invoices" icon={Wallet} /></div>
      <SchoolPanel title="Create fee structure" description="Manager configures the fee; Finance generates invoices for enrolled students.">
        <form onSubmit={addFeeStructure} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SchoolField label="Academic year"><select className={schoolSelectClass} value={feeYearId} onChange={(event) => setFeeYearId(event.target.value)}><option value="">Choose year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
          <SchoolField label="Grade"><input className={schoolInputClass} value={feeGrade} onChange={(event) => setFeeGrade(event.target.value)} /></SchoolField>
          <SchoolField label="Fee name"><input className={schoolInputClass} value={feeName} onChange={(event) => setFeeName(event.target.value)} placeholder="Tuition fee" /></SchoolField>
          <SchoolField label="Amount"><input type="number" min="0.01" step="0.01" className={schoolInputClass} value={feeAmount} onChange={(event) => setFeeAmount(event.target.value)} /></SchoolField>
          <SchoolField label="Currency"><select className={schoolSelectClass} value={feeCurrency} onChange={(event) => setFeeCurrency(event.target.value)}><option value="ETB">ETB</option><option value="USD">USD</option></select></SchoolField>
          <SchoolField label="Due date"><input type="date" className={schoolInputClass} value={feeDueDate} onChange={(event) => setFeeDueDate(event.target.value)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-5"><SchoolPrimaryButton type="submit">Save fee structure</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Finance follow-ups from Finance staff" description="Review unpaid invoice reports and confirm that the school has addressed them.">
        {financeFollowups.length ? <div className="space-y-3">{financeFollowups.map((item) => <div key={item.id} className="rounded-md border border-slate-100 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{memberName(item.student_membership_id)} · Invoice {item.invoice_id}</p><SchoolStatus value={item.status} /></div><p className="mt-1 text-xs text-slate-600">{item.note}</p>{item.status !== "resolved" && <div className="mt-2"><SchoolSecondaryButton onClick={() => void resolveFinanceFollowup(item.id)}>Mark resolved</SchoolSecondaryButton></div>}{item.resolution_note && <p className="mt-2 text-xs text-emerald-700">{item.resolution_note}</p>}</div>)}</div> : <SchoolEmptyState title="No finance follow-ups" description="Reports from the School Finance team will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Outstanding invoices" description="Read-only oversight for the Manager.">
        {invoices.filter((invoice) => Number(invoice.balance) > 0).length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Invoice</th><th className="pb-2">Student</th><th className="pb-2">Amount</th><th className="pb-2">Balance</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.filter((invoice) => Number(invoice.balance) > 0).map((invoice) => <tr key={invoice.id}><td className="py-3 font-medium text-slate-800">{invoice.invoice_number}</td><td className="py-3 text-slate-600">{memberName(invoice.student_membership_id)}</td><td className="py-3 text-slate-600">{invoice.currency} {Number(invoice.amount).toLocaleString()}</td><td className="py-3 font-medium text-slate-800">{invoice.currency} {Number(invoice.balance).toLocaleString()}</td><td className="py-3"><SchoolStatus value={invoice.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No outstanding invoices" description="Finance-generated invoices with balances will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderLeadership = () => {
    const fixedPositions = [
      ["academic_director", "Academic Director", null],
      ["hr_director", "HR Director / Business Manager", null],
      ["vice_director", "KG Vice Director", "kg"],
      ["vice_director", "Elementary Vice Director", "elementary"],
      ["vice_director", "Middle School Vice Director", "middle_school"],
      ["vice_director", "High School Vice Director", "high_school"],
      ["kg_director", "KG Director", "kg"],
      ["elementary_director", "Elementary Director", "elementary"],
      ["middle_school_director", "Middle School Director", "middle_school"],
      ["high_school_director", "High School Director", "high_school"],
    ] as const;
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
    const divisionLabels: Record<string, string> = {
      kg: "KG",
      elementary: "Elementary",
      middle_school: "Middle School",
      high_school: "High School",
    };
    const positionLabel = (position: string) => positionLabels[position] || position.replace(/_/g, " ");
    const divisionLabel = (division: string | null) => divisionLabels[division || ""] || "School-wide";
    const permissionOptions = [
      ["view_students", "View assigned students"],
      ["view_staff", "View assigned staff"],
      ["view_attendance", "View attendance"],
      ["review_attendance", "Review attendance"],
      ["view_academics", "View academic progress"],
      ["review_assessments", "Review assessments"],
      ["review_results", "Review examination results"],
      ["view_curriculum", "View curriculum coverage"],
      ["manage_team_tasks", "Manage assigned team tasks"],
      ["assign_team_tasks", "Assign team tasks"],
      ["view_reports", "View assigned reports"],
      ["view_discipline", "View student-support records"],
      ["review_discipline", "Review student-support reports"],
      ["view_finance_summary", "View finance summaries"],
      ["view_staff_evaluations", "View staff evaluations"],
    ] as const;
    const activeAppointment = (position: string, division: string | null) =>
      leadershipAppointments.find((item) => item.status === "active" && item.position === position && (division === null || item.division_scope === division));
    return (
      <div className="space-y-5">
        <SchoolPageHeading
          title="School leadership team"
          description="Review the Director and Vice Director appointments for your school. Create new accounts in People & Accounts."
        />
        {leadershipError && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{leadershipError}</div>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {fixedPositions.map(([position, label, division]) => {
            const appointment = activeAppointment(position, division);
            return (
              <div key={`${position}-${division || "school"}`} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <SchoolStatus value={appointment ? "appointed" : "vacant"} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{appointment ? memberName(appointment.membership_id) : "No active appointment"}</p>
                <p className="mt-1 text-xs text-slate-500">{division ? divisionLabel(division) : "School-wide responsibility"}</p>
              </div>
            );
          })}
        </div>
        <SchoolPanel title="Grade-to-division mapping" description="Map grades before class sections are created. Division Directors can create sections only after their grades are mapped.">
          <div className="mb-3 flex justify-end">
            <SchoolSecondaryButton onClick={() => void initializeStandardEthiopianGradeMappings()}>
              Use standard Ethiopian grade structure
            </SchoolSecondaryButton>
          </div>
          <form onSubmit={saveDivisionMapping} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <SchoolField label="School grade">
              <input
                className={schoolInputClass}
                value={mappingGrade}
                onChange={(event) => setMappingGrade(event.target.value)}
                placeholder="Choose or enter a grade label"
                list="school-grade-label-options"
                maxLength={80}
                required
              />
              <datalist id="school-grade-label-options">
                {[...new Set([
                  ...STANDARD_ETHIOPIAN_GRADE_LABELS,
                  ...sections.map((section) => section.grade_label),
                  ...divisionMappings.map((mapping) => mapping.grade_label),
                ])].map((grade) => <option key={grade} value={grade} />)}
              </datalist>
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
            )) : <SchoolEmptyState title="No division mappings configured" description="Use the standard Ethiopian grade structure or map the school's own grade labels. Class sections can be created by Directors after mapping." />}
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
                  <details className="mt-3 rounded-lg border border-slate-100 p-3">
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
                  </details>
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
          ) : <SchoolEmptyState title="No leadership appointments yet" description="Create Director and Vice Director accounts in People & Accounts above." />}
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

  const renderReports = () => {
    const gradeCounts = students.reduce((acc: Record<string, number>, student) => {
      const grade = student.grade_label || "Unassigned";
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});
    const enrollmentData = (Object.entries(gradeCounts) as [string, number][]).map(([grade, count]) => ({ grade, students: count })).sort((a, b) => a.grade.localeCompare(b.grade));
    const staffData = [
      { name: "Teachers", value: teachers.length },
      { name: "Finance", value: activeMembers.filter((member) => member.school_role === "finance").length },
      { name: "School admins", value: activeMembers.filter((member) => member.school_role === "admin").length },
    ].filter((item) => item.value > 0);
    const selectedStudents = reportGradeFilter === "all" ? [] : students.filter((student) => (student.grade_label || "Unassigned") === reportGradeFilter);
    const activeInvoices = invoices.filter((invoice) => Number(invoice.balance || 0) > 0);
    const balancesByCurrency = activeInvoices.reduce((acc: Record<string, number>, invoice) => {
      const currency = invoice.currency || "ETB";
      acc[currency] = (acc[currency] || 0) + Number(invoice.balance || 0);
      return acc;
    }, {});
    return (
      <div className="space-y-5">
        <SchoolPageHeading title="Reports & analytics" description="Explore live school enrollment, staffing, and finance records. Select chart elements to drill into the underlying school records." action={<SchoolSecondaryButton onClick={() => { setReportGradeFilter("all"); void load(); }}><RefreshCw className="mr-2 h-4 w-4" />Refresh reports</SchoolSecondaryButton>} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div><p className="text-xs text-slate-500">Active enrollment</p><p className="text-xl font-bold text-slate-900">{students.length}</p></div>
          <div className="h-9 w-px bg-slate-200" />
          <div><p className="text-xs text-slate-500">Active staff</p><p className="text-xl font-bold text-slate-900">{staff.length}</p></div>
          <div className="h-9 w-px bg-slate-200" />
          <div><p className="text-xs text-slate-500">Suspended memberships</p><p className="text-xl font-bold text-slate-900">{members.filter((member) => member.status === "suspended").length}</p></div>
          <div className="h-9 w-px bg-slate-200" />
          <div><p className="text-xs text-slate-500">Recorded evaluations</p><p className="text-xl font-bold text-slate-900">{evaluations.length}</p></div>
          <div className="h-9 w-px bg-slate-200" />
          <div><p className="text-xs text-slate-500">Active fee structures</p><p className="text-xl font-bold text-slate-900">{feeStructures.filter((fee) => fee.active).length}</p></div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
          <SchoolPanel title="Enrollment distribution" description="Choose a bar to open the students in that grade.">
            {enrollmentData.length ? <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={enrollmentData} margin={{ top: 12, right: 12, bottom: 12, left: 0 }} onClick={(event: any) => { const grade = event?.activePayload?.[0]?.payload?.grade; if (grade) setReportGradeFilter(String(grade)); }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="grade" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={58} /><YAxis allowDecimals={false} width={32} /><Tooltip cursor={{ fill: "#eff6ff" }} /><Bar dataKey="students" name="Students" fill="#2563eb" radius={[7, 7, 0, 0]} cursor="pointer" /></BarChart></ResponsiveContainer></div> : <SchoolEmptyState title="No enrollment data yet" description="The chart will populate from active school student memberships." />}
          </SchoolPanel>
          <SchoolPanel title="Staff composition" description="Active school memberships by staff role.">
            {staffData.length ? <div className="h-[260px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={staffData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} innerRadius={52} paddingAngle={3}>{staffData.map((entry, index) => <Cell key={entry.name} fill={["#1d4ed8", "#0f766e", "#d97706"][index % 3]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="flex flex-wrap justify-center gap-4 text-xs text-slate-600">{staffData.map((item) => <span key={item.name}>{item.name}: <strong>{item.value}</strong></span>)}</div></div> : <SchoolEmptyState title="No active staff records" description="Staff role distribution will appear when staff memberships are active." />}
          </SchoolPanel>
        </div>
        {reportGradeFilter !== "all" && <SchoolPanel title={reportGradeFilter + " student roster"} description={selectedStudents.length + " active student records. Use a student profile for academic rank, attendance, marks, homework, and fee details."} action={<div className="flex gap-2"><SchoolSecondaryButton onClick={() => setReportGradeFilter("all")}>Clear filter</SchoolSecondaryButton><SchoolSecondaryButton onClick={() => setPage("students")}>Open directory</SchoolSecondaryButton></div>}>
          {selectedStudents.length ? <div className="grid gap-2 sm:grid-cols-2">{selectedStudents.map((student) => <button key={student.id} type="button" onClick={() => { setSelectedStudentId(student.id); setPage("students"); }} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-left hover:border-blue-200 hover:bg-blue-50/40"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{profiles[student.user_id]?.name || student.school_username || "Student"}</span><span className="mt-1 block text-xs text-slate-500">ID {student.student_number || "not assigned"} · {sectionLabel(student.section_id)}</span></span><GraduationCap className="h-5 w-5 shrink-0 text-blue-700" /></button>)}</div> : <SchoolEmptyState title="No active students in this grade" description="Choose another grade in the chart." />}
        </SchoolPanel>}
        <div className="grid gap-4 md:grid-cols-2">
          <SchoolPanel title="Outstanding balances" description="Open invoice balances, grouped by currency so unlike currencies are never combined.">
            {Object.keys(balancesByCurrency).length ? <div className="space-y-3">{(Object.entries(balancesByCurrency) as [string, number][]).map(([currency, amount]) => <div key={currency} className="flex items-center justify-between rounded-lg bg-slate-50 p-3"><span className="text-sm font-medium text-slate-700">{currency}</span><span className="text-lg font-bold tabular-nums text-slate-900">{amount.toLocaleString()}</span></div>)}</div> : <SchoolEmptyState title="No outstanding invoice balances" description="Unpaid and partial invoices will appear here when recorded." />}
          </SchoolPanel>
          <SchoolPanel title="Explore a workflow" description="Reports are linked to the operational pages where the underlying records are managed.">
            <div className="grid gap-2 sm:grid-cols-2">{[{ label: "Attendance", page: "attendance" }, { label: "Academic results", page: "academics" }, { label: "Fees & finance", page: "finance" }, { label: "Staff support", page: "staff-support" }].map((item) => <button key={item.page} type="button" onClick={() => setPage(item.page)} className="rounded-lg border border-slate-200 px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50/40">{item.label}<span className="mt-1 block text-xs font-normal text-slate-500">Open workflow →</span></button>)}</div>
          </SchoolPanel>
        </div>
      </div>
    );
  };

  let content: React.ReactNode;
  switch (page) {
    case "accounts": content = renderAccounts(); break;
    case "students": content = renderStudents(); break;
    case "staff": content = renderStaffDirectory(); break;
    case "assignments": content = renderAssignments(); break;
    case "audit": content = renderSchoolAudit(); break;
    case "settings": content = renderManagerSettings(); break;
    case "structure": content = renderStructure(); break;
    case "academics": content = <SchoolManagerAcademicWorkspace schoolId={schoolId} years={years} terms={terms} sections={sections} subjects={subjects} assignments={assignments} categories={gradingCategories} gradingPolicies={gradingPolicies} members={members} profiles={profiles} />; break;
    case "curriculum": content = <SchoolCurriculumWorkspace mode="manager" schoolId={schoolId} years={years} sections={sections} subjects={subjects} assignments={assignments} members={members} profiles={profiles} />; break;
    case "attendance": content = <SchoolManagerAttendanceWorkspace schoolId={schoolId} years={years} sections={sections} members={members} profiles={profiles} />; break;
    case "timetable": content = <SchoolManagerTimetableCalendarWorkspace schoolId={schoolId} years={years} sections={sections} assignments={assignments} members={members} profiles={profiles} />; break;
    case "communications": content = <SchoolManagerParentCommunicationsWorkspace schoolId={schoolId} members={members} profiles={profiles} sections={sections} />; break;
    case "staff-support": content = <SchoolManagerStaffSupportWorkspace schoolId={schoolId} activeMembershipId={activeMembership?.id} members={members} profiles={profiles} />; break;
    case "content-governance": content = <SchoolManagerContentGovernanceWorkspace schoolId={schoolId} members={members} profiles={profiles} sections={sections} />; break;
    case "grading": content = renderGrading(); break;
    case "finance": content = renderFinance(); break;
    case "reports": content = renderReports(); break;
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