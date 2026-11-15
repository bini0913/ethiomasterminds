import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Users, School, BookOpen, UserCog, Wallet, ClipboardList,
  FileBarChart, Settings, RefreshCw, CheckCircle2, Copy, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField,
  schoolInputClass, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "accounts", label: "People & Accounts", icon: Users },
  { id: "structure", label: "School Structure", icon: School },
  { id: "assignments", label: "Teacher Assignments", icon: UserCog },
  { id: "finance", label: "Fees & Finance", icon: Wallet },
  { id: "tasks", label: "Staff Tasks", icon: ClipboardList },
  { id: "evaluations", label: "Staff Evaluations", icon: CheckCircle2 },
  { id: "requests", label: "Change Requests", icon: Settings },
  { id: "reports", label: "Reports", icon: FileBarChart },
];

type AccountRole = "admin" | "teacher" | "finance" | "parent" | "student";

export default function SchoolManagerPortal() {
  const { activeSchool, activeMembership, refresh: refreshSchoolContext } = useSchoolPortal();
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
  const [tasks, setTasks] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [createdCredentials, setCreatedCredentials] = useState<any[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [accountRole, setAccountRole] = useState<AccountRole>("admin");
  const [accountName, setAccountName] = useState("");
  const [accountSectionId, setAccountSectionId] = useState("");
  const [accountAge, setAccountAge] = useState("12");
  const [accountSubject, setAccountSubject] = useState("");
  const [accountAssignmentKind, setAccountAssignmentKind] = useState<"subject" | "homeroom">("subject");
  const [parentMembershipIds, setParentMembershipIds] = useState<string[]>([]);
  const [studentMembershipIds, setStudentMembershipIds] = useState<string[]>([]);

  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [sectionYearId, setSectionYearId] = useState("");
  const [sectionGrade, setSectionGrade] = useState("Grade 9");
  const [sectionName, setSectionName] = useState("A");
  const [subjectYearId, setSubjectYearId] = useState("");
  const [subjectGrade, setSubjectGrade] = useState("Grade 9");
  const [subjectName, setSubjectName] = useState("");

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
      feesRes, invoicesRes, tasksRes, evaluationsRes, requestsRes,
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
    ]);

    const firstError = [membershipsRes, yearsRes, sectionsRes, subjectsRes, assignmentsRes, feesRes, invoicesRes, tasksRes, evaluationsRes, requestsRes].find((result) => result.error)?.error;
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

    const userIds = [...new Set(nextMembers.map((membership: any) => membership.user_id))];
    if (userIds.length) {
      const { data: profileRows, error: profileError } = await db.from("profiles").select("id,name,username,age,grade").in("id", userIds);
      if (profileError) toast.error("Some profile names could not be loaded");
      setProfiles(Object.fromEntries((profileRows ?? []).map((profile: any) => [profile.id, profile])));
    } else {
      setProfiles({});
    }

    if (!sectionYearId && yearsRes.data?.length) setSectionYearId(yearsRes.data.find((year: any) => year.is_current)?.id ?? yearsRes.data[0].id);
    if (!subjectYearId && yearsRes.data?.length) setSubjectYearId(yearsRes.data.find((year: any) => year.is_current)?.id ?? yearsRes.data[0].id);
    if (!feeYearId && yearsRes.data?.length) setFeeYearId(yearsRes.data.find((year: any) => year.is_current)?.id ?? yearsRes.data[0].id);
    setLoading(false);
  }, [schoolId, db, sectionYearId, subjectYearId, feeYearId]);

  useEffect(() => { void load(); }, [load]);

  const activeMembers = members.filter((member) => member.status === "active");
  const students = activeMembers.filter((member) => member.school_role === "student");
  const teachers = activeMembers.filter((member) => member.school_role === "teacher");
  const parents = activeMembers.filter((member) => member.school_role === "parent");
  const staff = activeMembers.filter((member) => ["admin", "teacher", "finance"].includes(member.school_role));
  const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);

  const memberName = (membershipId: string) => {
    const membership = members.find((item) => item.id === membershipId);
    return membership ? (profiles[membership.user_id]?.name || membership.school_username || "School member") : "Unknown member";
  };
  const sectionLabel = (sectionId: string) => {
    const section = sections.find((item) => item.id === sectionId);
    return section ? `${section.grade_label} ${section.section_name}` : "—";
  };

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setCreatedCredentials([]);
    if (!accountName.trim()) return setFormError("Enter the person's full name.");
    const account: any = { name: accountName.trim() };
    if (accountRole === "student") {
      if (!accountSectionId || !Number.isInteger(Number(accountAge))) return setFormError("Choose a section and enter a valid age.");
      const section = sections.find((item) => item.id === accountSectionId);
      if (!section) return setFormError("Selected section is no longer available.");
      account.grade_label = section.grade_label;
      account.age = Number(accountAge);
      account.section_id = accountSectionId;
      account.parent_membership_ids = parentMembershipIds;
    }
    if (accountRole === "parent") account.student_membership_ids = studentMembershipIds;
    if (accountRole === "teacher") {
      if (!assignSectionId || (accountAssignmentKind === "subject" && !accountSubject)) return setFormError("Choose a section and subject for the teacher.");
      account.assignments = [{
        section_id: assignSectionId,
        subject_name: assignKind === "homeroom" ? "Homeroom" : assignSubject,
        assignment_kind: assignKind,
      }];
    }

    const { data, error } = await supabase.functions.invoke("school-provision-account", {
      body: { action: "create_accounts", school_id: schoolId, role: accountRole, accounts: [account] },
    });
    if (error || !data?.created?.length) {
      setFormError(data?.failed?.[0]?.message || error?.message || "Account could not be created.");
      return;
    }
    setCreatedCredentials(data.created);
    setAccountName("");
    setParentMembershipIds([]);
    setStudentMembershipIds([]);
    toast.success("School account created. Copy the initial credentials and deliver them privately.");
    await load();
  };

  const addAcademicYear = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!yearName.trim() || !yearStart || !yearEnd) return toast.error("Complete the academic year details.");
    if (yearEnd < yearStart) return toast.error("Academic year end date must follow its start date.");
    const { error } = await db.from("school_academic_years").insert({
      school_id: schoolId, name: yearName.trim(), starts_on: yearStart, ends_on: yearEnd,
    });
    if (error) return toast.error(error.message);
    setYearName(""); setYearStart(""); setYearEnd("");
    toast.success("Academic year created.");
    await load();
  };

  const addSection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sectionYearId || !sectionGrade.trim() || !sectionName.trim()) return toast.error("Complete the section details.");
    const { error } = await db.from("school_sections").insert({
      school_id: schoolId, academic_year_id: sectionYearId,
      grade_label: sectionGrade.trim(), section_name: sectionName.trim(),
    });
    if (error) return toast.error(error.message);
    setSectionName("A");
    toast.success("Section created.");
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

  const addFeeStructure = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!feeYearId || !feeGrade.trim() || !feeName.trim() || Number(feeAmount) <= 0) return toast.error("Enter a valid fee structure.");
    const { error } = await db.from("school_fee_structures").insert({
      school_id: schoolId, academic_year_id: feeYearId, grade_label: feeGrade.trim(),
      fee_name: feeName.trim(), amount: Number(feeAmount), currency: feeCurrency,
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
    if (!evaluationTargetId || !evaluationNotes.trim()) return toast.error("Choose a staff member and add evaluation notes.");
    const { error } = await db.from("school_staff_evaluations").insert({
      school_id: schoolId, target_membership_id: evaluationTargetId,
      reviewer_membership_id: activeMembership?.id, evaluation_type: "staff_performance",
      rating: Number(evaluationRating), period_start: evaluationStart || null,
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
        <SchoolMetric label="Outstanding fees" value={`ETB ${outstanding.toLocaleString()}`} detail={`${invoices.filter((invoice) => invoice.balance > 0).length} unpaid or partial invoices`} icon={Wallet} />
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
      <SchoolPageHeading title="People & accounts" description="Create school accounts and review each person's assigned school role." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SchoolPanel title="Create school account" description="Initial credentials are shown once. Deliver them privately.">
          <form onSubmit={createAccount} className="space-y-3">
            <SchoolField label="Account role">
              <select className={schoolSelectClass} value={accountRole} onChange={(event) => setAccountRole(event.target.value as AccountRole)}>
                <option value="admin">School Admin</option><option value="teacher">Teacher</option><option value="finance">Finance</option><option value="parent">Parent</option><option value="student">Student</option>
              </select>
            </SchoolField>
            <SchoolField label="Full name"><input className={schoolInputClass} value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Full name" /></SchoolField>
            {accountRole === "student" && <>
              <SchoolField label="Class section"><select className={schoolSelectClass} value={accountSectionId} onChange={(event) => setAccountSectionId(event.target.value)}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
              <SchoolField label="Age at enrollment"><input type="number" min="3" max="120" className={schoolInputClass} value={accountAge} onChange={(event) => setAccountAge(event.target.value)} /></SchoolField>
              <SchoolField label="Link parent accounts"><select multiple className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-2 text-sm" value={parentMembershipIds} onChange={(event) => setParentMembershipIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>{parents.map((parent) => <option key={parent.id} value={parent.id}>{memberName(parent.id)}</option>)}</select></SchoolField>
            </>}
            {accountRole === "parent" && <SchoolField label="Link children"><select multiple className="min-h-24 w-full rounded-md border border-slate-200 bg-white p-2 text-sm" value={studentMembershipIds} onChange={(event) => setStudentMembershipIds(Array.from(event.target.selectedOptions).map((option) => option.value))}>{students.map((student) => <option key={student.id} value={student.id}>{memberName(student.id)} · {student.grade_label || "Student"}</option>)}</select></SchoolField>}
            {accountRole === "teacher" && <>
              <SchoolField label="Assigned section"><select className={schoolSelectClass} value={assignSectionId} onChange={(event) => setAssignSectionId(event.target.value)}><option value="">Choose section</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
              <SchoolField label="Assignment type"><select className={schoolSelectClass} value={accountAssignmentKind} onChange={(event) => setAccountAssignmentKind(event.target.value as "subject" | "homeroom")}><option value="subject">Subject teacher</option><option value="homeroom">Homeroom teacher</option></select></SchoolField>
              {accountAssignmentKind === "subject" && <SchoolField label="Subject"><select className={schoolSelectClass} value={accountSubject} onChange={(event) => setAccountSubject(event.target.value)}><option value="">Choose subject</option>{subjects.filter((subject) => subject.active && sections.find((section) => section.id === assignSectionId)?.grade_label === subject.grade_label).map((subject) => <option key={subject.id} value={subject.subject_name}>{subject.subject_name}</option>)}</select></SchoolField>}
            </>}
            {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            <SchoolPrimaryButton type="submit">Create account</SchoolPrimaryButton>
          </form>
          {createdCredentials.length > 0 && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-emerald-900">Initial credentials</p><button onClick={() => void copyCredentials()} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><Copy className="h-3.5 w-3.5" />Copy</button></div>
            <p className="mt-1 text-xs text-emerald-800">Copy these now and deliver them privately. They are not stored here for later retrieval.</p>
            <div className="mt-3 space-y-2">{createdCredentials.map((item, index) => <div key={index} className="rounded-md border border-emerald-200 bg-white p-2 text-xs"><p><span className="font-semibold">Username:</span> {item.username}</p><p className="mt-1 break-all"><span className="font-semibold">Initial password:</span> {item.initial_password}</p></div>)}</div>
          </div>}
        </SchoolPanel>
        <SchoolPanel title="School accounts" description={`${members.length} total school memberships`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="pb-2 font-semibold">Person</th><th className="pb-2 font-semibold">Role</th><th className="pb-2 font-semibold">Grade / section</th><th className="pb-2 font-semibold">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{members.map((member) => <tr key={member.id}><td className="py-3"><p className="font-medium text-slate-800">{memberName(member.id)}</p><p className="mt-0.5 text-xs text-slate-500">{member.school_username}</p></td><td className="py-3 capitalize text-slate-600">{member.school_role}</td><td className="py-3 text-slate-600">{member.grade_label ? `${member.grade_label} · ${sectionLabel(member.section_id)}` : "—"}</td><td className="py-3"><SchoolStatus value={member.status} /></td></tr>)}</tbody>
            </table>
          </div>
        </SchoolPanel>
      </div>
    </div>
  );

  const renderStructure = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School structure" description="Configure academic years, sections, and the subject catalog used for teacher assignments." />
      <div className="grid gap-4 xl:grid-cols-3">
        <SchoolPanel title="Academic year">
          <form onSubmit={addAcademicYear} className="space-y-3">
            <SchoolField label="Academic year name"><input className={schoolInputClass} value={yearName} onChange={(event) => setYearName(event.target.value)} placeholder="2026/2027" /></SchoolField>
            <SchoolField label="Start date"><input type="date" className={schoolInputClass} value={yearStart} onChange={(event) => setYearStart(event.target.value)} /></SchoolField>
            <SchoolField label="End date"><input type="date" className={schoolInputClass} value={yearEnd} onChange={(event) => setYearEnd(event.target.value)} /></SchoolField>
            <SchoolPrimaryButton type="submit">Add academic year</SchoolPrimaryButton>
          </form>
        </SchoolPanel>
        <SchoolPanel title="Create section">
          <form onSubmit={addSection} className="space-y-3">
            <SchoolField label="Academic year"><select className={schoolSelectClass} value={sectionYearId} onChange={(event) => setSectionYearId(event.target.value)}><option value="">Choose year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
            <SchoolField label="Grade"><input className={schoolInputClass} value={sectionGrade} onChange={(event) => setSectionGrade(event.target.value)} placeholder="Grade 9" /></SchoolField>
            <SchoolField label="Section"><input className={schoolInputClass} value={sectionName} onChange={(event) => setSectionName(event.target.value)} placeholder="A" /></SchoolField>
            <SchoolPrimaryButton type="submit">Add section</SchoolPrimaryButton>
          </form>
        </SchoolPanel>
        <SchoolPanel title="Add subject">
          <form onSubmit={addSubject} className="space-y-3">
            <SchoolField label="Academic year"><select className={schoolSelectClass} value={subjectYearId} onChange={(event) => setSubjectYearId(event.target.value)}><option value="">Choose year</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></SchoolField>
            <SchoolField label="Grade"><input className={schoolInputClass} value={subjectGrade} onChange={(event) => setSubjectGrade(event.target.value)} placeholder="Grade 9" /></SchoolField>
            <SchoolField label="Subject name"><input className={schoolInputClass} value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Mathematics" /></SchoolField>
            <SchoolPrimaryButton type="submit">Add subject</SchoolPrimaryButton>
          </form>
        </SchoolPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SchoolPanel title="Academic years"><div className="space-y-2">{years.map((year) => <div key={year.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 p-3"><div><p className="text-sm font-medium text-slate-800">{year.name}</p><p className="text-xs text-slate-500">{year.starts_on} – {year.ends_on}</p></div>{year.is_current && <SchoolStatus value="active" />}</div>)}{!years.length && <SchoolEmptyState title="No years yet" description="Add the first academic year." />}</div></SchoolPanel>
        <SchoolPanel title="Sections"><div className="space-y-2">{sections.map((section) => <div key={section.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3"><p className="text-sm font-medium text-slate-800">{section.grade_label} {section.section_name}</p><span className="text-xs text-slate-500">{years.find((year) => year.id === section.academic_year_id)?.name || "Academic year"}</span></div>)}{!sections.length && <SchoolEmptyState title="No sections yet" description="Create sections for the current year." />}</div></SchoolPanel>
        <SchoolPanel title="Subjects"><div className="space-y-2">{subjects.map((subject) => <div key={subject.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3"><div><p className="text-sm font-medium text-slate-800">{subject.subject_name}</p><p className="text-xs text-slate-500">{subject.grade_label}</p></div><SchoolStatus value={subject.active ? "active" : "deactivated"} /></div>)}{!subjects.length && <SchoolEmptyState title="No subjects yet" description="Add subjects by grade and academic year." />}</div></SchoolPanel>
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
          {assignKind === "subject" && <SchoolField label="Subject"><select className={schoolSelectClass} value={assignSubject} onChange={(event) => setAssignSubject(event.target.value)}><option value="">Choose subject</option>{subjects.filter((subject) => subject.active && subject.grade_label === sections.find((section) => section.id === assignSectionId)?.grade_label).map((subject) => <option key={subject.id} value={subject.subject_name}>{subject.subject_name}</option>)}</select></SchoolField>}
          <div className="md:col-span-2 xl:col-span-4"><SchoolPrimaryButton type="submit">Save assignment</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Current assignments">
        {assignments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Teacher</th><th className="pb-2">Section</th><th className="pb-2">Subject / responsibility</th><th className="pb-2">Type</th></tr></thead><tbody className="divide-y divide-slate-100">{assignments.map((assignment) => <tr key={assignment.id}><td className="py-3 font-medium text-slate-800">{memberName(assignment.teacher_membership_id)}</td><td className="py-3 text-slate-600">{sectionLabel(assignment.section_id)}</td><td className="py-3 text-slate-600">{assignment.subject_name}</td><td className="py-3 capitalize text-slate-600">{assignment.assignment_kind}</td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No teacher assignments" description="Create assignments after teachers, sections, and subjects have been added." />}
      </SchoolPanel>
    </div>
  );

  const renderFinance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School fees & finance" description="Configure fee structures and oversee invoices, payments, and outstanding balances. Daily payment processing belongs to the School Finance team." />
      <div className="grid gap-3 sm:grid-cols-3"><SchoolMetric label="Fee structures" value={feeStructures.length} detail="Configured school fees" icon={Wallet} /><SchoolMetric label="Invoices" value={invoices.length} detail="Generated by Finance" icon={ClipboardList} /><SchoolMetric label="Outstanding balance" value={`ETB ${outstanding.toLocaleString()}`} detail="Unpaid and partial invoices" icon={Wallet} /></div>
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
      <SchoolPanel title="Outstanding invoices" description="Read-only oversight for the Manager.">
        {invoices.filter((invoice) => Number(invoice.balance) > 0).length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Invoice</th><th className="pb-2">Student</th><th className="pb-2">Amount</th><th className="pb-2">Balance</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.filter((invoice) => Number(invoice.balance) > 0).map((invoice) => <tr key={invoice.id}><td className="py-3 font-medium text-slate-800">{invoice.invoice_number}</td><td className="py-3 text-slate-600">{memberName(invoice.student_membership_id)}</td><td className="py-3 text-slate-600">{invoice.currency} {Number(invoice.amount).toLocaleString()}</td><td className="py-3 font-medium text-slate-800">{invoice.currency} {Number(invoice.balance).toLocaleString()}</td><td className="py-3"><SchoolStatus value={invoice.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No outstanding invoices" description="Finance-generated invoices with balances will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Staff tasks & follow-ups" description="Assign follow-up work to Admins, teachers, and Finance. Staff submit their work; you can verify it or request corrections." />
      <SchoolPanel title="Assign a task">
        <form onSubmit={createTask} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SchoolField label="Assign to"><select className={schoolSelectClass} value={taskTargetId} onChange={(event) => setTaskTargetId(event.target.value)}><option value="">Choose staff member</option>{staff.map((member) => <option key={member.id} value={member.id}>{memberName(member.id)} · {member.school_role}</option>)}</select></SchoolField>
          <SchoolField label="Task type"><select className={schoolSelectClass} value={taskType} onChange={(event) => setTaskType(event.target.value)}><option value="follow_up">Follow-up</option><option value="oversight">Oversight</option><option value="academic">Academic</option><option value="finance">Finance</option></select></SchoolField>
          <SchoolField label="Priority"><select className={schoolSelectClass} value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></SchoolField>
          <SchoolField label="Due date"><input type="date" className={schoolInputClass} value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} /></SchoolField>
          <SchoolField label="Task title"><input className={schoolInputClass} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} /></SchoolField>
          <SchoolField label="Description"><input className={schoolInputClass} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-4"><SchoolPrimaryButton type="submit">Assign task</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="School task register">
        {tasks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Task</th><th className="pb-2">Assigned to</th><th className="pb-2">Type</th><th className="pb-2">Due</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{tasks.map((task) => <tr key={task.id}><td className="py-3 font-medium text-slate-800">{task.title}</td><td className="py-3 text-slate-600">{memberName(task.assigned_to_membership_id)}</td><td className="py-3 capitalize text-slate-600">{task.task_type}</td><td className="py-3 text-slate-600">{task.due_date || "—"}</td><td className="py-3"><SchoolStatus value={task.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No tasks assigned" description="Use the form above to assign the first follow-up." />}
      </SchoolPanel>
    </div>
  );

  const renderEvaluations = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Staff evaluations" description="Record staff performance evaluations. School Admins evaluate teachers' academic work separately." />
      <SchoolPanel title="Record staff performance evaluation">
        <form onSubmit={createEvaluation} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SchoolField label="Staff member"><select className={schoolSelectClass} value={evaluationTargetId} onChange={(event) => setEvaluationTargetId(event.target.value)}><option value="">Choose staff member</option>{staff.map((member) => <option key={member.id} value={member.id}>{memberName(member.id)} · {member.school_role}</option>)}</select></SchoolField>
          <SchoolField label="Rating (1–5)"><select className={schoolSelectClass} value={evaluationRating} onChange={(event) => setEvaluationRating(event.target.value)}><option value="1">1 — Needs improvement</option><option value="2">2 — Developing</option><option value="3">3 — Meets expectations</option><option value="4">4 — Strong</option><option value="5">5 — Excellent</option></select></SchoolField>
          <SchoolField label="Period start"><input type="date" className={schoolInputClass} value={evaluationStart} onChange={(event) => setEvaluationStart(event.target.value)} /></SchoolField>
          <SchoolField label="Period end"><input type="date" className={schoolInputClass} value={evaluationEnd} onChange={(event) => setEvaluationEnd(event.target.value)} /></SchoolField>
          <SchoolField label="Evaluation notes"><input className={schoolInputClass} value={evaluationNotes} onChange={(event) => setEvaluationNotes(event.target.value)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-4"><SchoolPrimaryButton type="submit">Save evaluation</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Evaluation history">
        {evaluations.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Staff member</th><th className="pb-2">Type</th><th className="pb-2">Rating</th><th className="pb-2">Date</th></tr></thead><tbody className="divide-y divide-slate-100">{evaluations.map((item) => <tr key={item.id}><td className="py-3 font-medium text-slate-800">{memberName(item.target_membership_id)}</td><td className="py-3 capitalize text-slate-600">{item.evaluation_type.replace("_", " ")}</td><td className="py-3 tabular-nums text-slate-700">{item.rating}/5</td><td className="py-3 text-slate-500">{new Date(item.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No evaluations recorded" description="Completed staff evaluations will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderRequests = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Staff responsibility requests" description="Request role or assignment changes. The Super Admin reviews requests; this portal never changes staff permissions directly." />
      <SchoolPanel title="Submit a change request">
        <form onSubmit={createChangeRequest} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SchoolField label="Staff member"><select className={schoolSelectClass} value={requestTargetId} onChange={(event) => setRequestTargetId(event.target.value)}><option value="">Choose staff member</option>{staff.map((member) => <option key={member.id} value={member.id}>{memberName(member.id)} · {member.school_role}</option>)}</select></SchoolField>
          <SchoolField label="Request type"><select className={schoolSelectClass} value={requestType} onChange={(event) => setRequestType(event.target.value)}><option value="responsibility_change">Responsibility change</option><option value="assignment_change">Assignment change</option><option value="role_change">Role change</option></select></SchoolField>
          {requestType === "role_change" && <SchoolField label="Requested role"><select className={schoolSelectClass} value={requestedRole} onChange={(event) => setRequestedRole(event.target.value)}><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="finance">Finance</option></select></SchoolField>}
          <SchoolField label="Requested details (JSON)"><input className={schoolInputClass} value={requestDetails} onChange={(event) => setRequestDetails(event.target.value)} placeholder='{"new_section":"Grade 8A"}' /></SchoolField>
          <SchoolField label="Reason"><input className={schoolInputClass} value={requestReason} onChange={(event) => setRequestReason(event.target.value)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-4"><SchoolPrimaryButton type="submit">Send to Super Admin</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Submitted requests">
        {changeRequests.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Staff member</th><th className="pb-2">Request</th><th className="pb-2">Reason</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{changeRequests.map((item) => <tr key={item.id}><td className="py-3 font-medium text-slate-800">{memberName(item.target_membership_id)}</td><td className="py-3 capitalize text-slate-600">{item.request_type.replace("_", " ")}</td><td className="py-3 text-slate-600">{item.reason}</td><td className="py-3"><SchoolStatus value={item.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No change requests" description="Requests submitted to the Super Admin will appear here." />}
      </SchoolPanel>
    </div>
  );

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
        {students.length ? <div className="space-y-3">{Object.entries(students.reduce((acc: Record<string, number>, student) => { const grade = student.grade_label || "Unassigned"; acc[grade] = (acc[grade] || 0) + 1; return acc; }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([grade, count]) => <div key={grade} className="flex items-center gap-3"><span className="w-28 shrink-0 text-sm font-medium text-slate-700">{grade}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, (Number(count) / Math.max(1, students.length)) * 100)}%` }} /></div><span className="w-8 text-right text-sm tabular-nums text-slate-600">{count}</span></div>)}</div> : <SchoolEmptyState title="No student enrollment data" description="Student enrollment totals will appear when accounts are created." />}
      </SchoolPanel>
    </div>
  );

  let content: React.ReactNode;
  switch (page) {
    case "accounts": content = renderAccounts(); break;
    case "structure": content = renderStructure(); break;
    case "assignments": content = renderAssignments(); break;
    case "finance": content = renderFinance(); break;
    case "tasks": content = renderTasks(); break;
    case "evaluations": content = renderEvaluations(); break;
    case "requests": content = renderRequests(); break;
    case "reports": content = renderReports(); break;
    default: content = renderOverview();
  }

  return (
    <SchoolPortalShell role="manager" title="School Manager" navItems={navItems} activeItem={page} onNavigate={setPage}>
      {loading && <div className="mb-4 text-xs text-slate-500">Refreshing school records…</div>}
      {content}
    </SchoolPortalShell>
  );
}
