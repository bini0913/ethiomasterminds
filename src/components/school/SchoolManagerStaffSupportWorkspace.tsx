import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, FileText, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  SchoolEmptyState, SchoolField, SchoolMetric, SchoolPageHeading, SchoolPanel, SchoolPrimaryButton, SchoolSecondaryButton, SchoolStatus,
  schoolInputClass, schoolSelectClass, schoolTextareaClass,
} from "@/components/school/SchoolPortalPrimitives";

type Member = {
  id: string;
  user_id: string;
  school_role: string;
  status: string;
  school_username?: string | null;
};

type Props = {
  schoolId?: string;
  activeMembershipId?: string;
  members: Member[];
  profiles: Record<string, { name?: string; username?: string }>;
};

type WorkspaceTab = "tasks" | "staff" | "student-support" | "escalations";

const db = supabase as any;

export default function SchoolManagerStaffSupportWorkspace({ schoolId, activeMembershipId, members, profiles }: Props) {
  const [tab, setTab] = useState<WorkspaceTab>("tasks");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [conductReports, setConductReports] = useState<any[]>([]);
  const [behaviorReports, setBehaviorReports] = useState<any[]>([]);
  const [disciplineRecommendations, setDisciplineRecommendations] = useState<any[]>([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatus, setTaskStatus] = useState("all");
  const [taskAssignee, setTaskAssignee] = useState("all");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskType, setNewTaskType] = useState("follow_up");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [evaluationTarget, setEvaluationTarget] = useState("");
  const [evaluationRating, setEvaluationRating] = useState("3");
  const [evaluationNotes, setEvaluationNotes] = useState("");
  const [evaluationStart, setEvaluationStart] = useState("");
  const [evaluationEnd, setEvaluationEnd] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [requestTarget, setRequestTarget] = useState("");
  const [requestType, setRequestType] = useState("responsibility_change");
  const [requestedRole, setRequestedRole] = useState("teacher");
  const [requestDetails, setRequestDetails] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [disciplineTarget, setDisciplineTarget] = useState("");
  const [disciplineReason, setDisciplineReason] = useState("");
  const [disciplineRecommendation, setDisciplineRecommendation] = useState("");

  const staff = useMemo(
    () => members.filter((member) => member.status === "active" && ["admin", "teacher", "finance"].includes(member.school_role)),
    [members],
  );
  const memberName = useCallback((membershipId: string | null | undefined) => {
    const member = members.find((item) => item.id === membershipId);
    if (!member) return "Unknown school member";
    return profiles[member.user_id]?.name || (profiles[member.user_id]?.username ? "@" + profiles[member.user_id].username : member.school_username || member.school_role);
  }, [members, profiles]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.all([
        db.from("school_staff_tasks").select("id,title,description,assigned_to_membership_id,assigned_by_membership_id,task_type,priority,status,due_date,response,submitted_at,verified_by_membership_id,verified_at,created_at,updated_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(150),
        db.from("school_staff_task_comments").select("id,task_id,author_membership_id,body,created_at").eq("school_id", schoolId).order("created_at", { ascending: true }).limit(500),
        db.from("school_staff_evaluations").select("id,target_membership_id,reviewer_membership_id,evaluation_type,rating,period_start,period_end,notes,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
        db.from("school_staff_change_requests").select("id,target_membership_id,requester_membership_id,request_type,requested_role,requested_details,reason,status,reviewed_by_user_id,reviewed_at,review_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
        db.from("school_staff_conduct_reports").select("id,target_teacher_membership_id,submitted_by_membership_id,report_type,severity,description,status,reviewed_by_membership_id,reviewed_at,manager_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
        db.from("school_behavior_reports").select("id,student_membership_id,section_id,reported_by_membership_id,report_type,severity,description,status,reviewed_by,reviewed_at,review_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(150),
        db.from("school_disciplinary_recommendations").select("id,target_membership_id,target_kind,submitted_by_membership_id,reason,recommendation,status,reviewed_by_membership_id,reviewed_at,decision_note,created_at").eq("school_id", schoolId).eq("target_kind", "student").order("created_at", { ascending: false }).limit(100),
      ]);
      const [taskRes, commentRes, evaluationRes, requestRes, conductRes, behaviorRes, disciplineRes] = results;
      const failures = results.filter((result) => result.error);
      if (failures.length === results.length) throw failures[0].error;
      setTasks(taskRes.data ?? []);
      setComments(commentRes.data ?? []);
      setEvaluations(evaluationRes.data ?? []);
      setChangeRequests(requestRes.data ?? []);
      setConductReports(conductRes.data ?? []);
      setBehaviorReports(behaviorRes.data ?? []);
      setDisciplineRecommendations(disciplineRes.data ?? []);
      if (failures.length) setLoadError("Some accountability records are unavailable for this Manager session. Available records are shown; refresh after checking the relevant school permissions.");
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : "School accountability records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !activeMembershipId || !newTaskAssignee || newTaskTitle.trim().length < 2) {
      toast.error("Choose an active staff member and enter a task title.");
      return;
    }
    setSavingId("new-task");
    const { error } = await db.from("school_staff_tasks").insert({
      school_id: schoolId,
      assigned_to_membership_id: newTaskAssignee,
      assigned_by_membership_id: activeMembershipId,
      task_type: newTaskType,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || null,
      priority: newTaskPriority,
      due_date: newTaskDueDate || null,
    });
    setSavingId(null);
    if (error) return toast.error(error.message || "Task could not be assigned.");
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskDueDate("");
    toast.success("Staff task assigned.");
    await load();
  };

  const updateTaskStatus = async (task: any, status: "verified" | "returned" | "cancelled") => {
    if (!schoolId || !task?.id) return;
    if (status === "returned" && !commentDrafts[task.id]?.trim()) {
      toast.error("Add a comment explaining what needs attention before returning this task.");
      return;
    }
    if (status === "returned" && !(await addComment(task.id))) return;
    setSavingId(task.id);
    const { error } = await db.from("school_staff_tasks").update({ status }).eq("id", task.id).eq("school_id", schoolId);
    setSavingId(null);
    if (error) return toast.error(error.message || "Task status could not be updated.");
    toast.success(status === "verified" ? "Task verified." : status === "returned" ? "Task returned to its assignee." : "Task cancelled.");
    await load();
  };

  const addComment = async (taskId: string): Promise<boolean> => {
    const body = commentDrafts[taskId]?.trim();
    if (!schoolId || !activeMembershipId || !body) return false;
    const { error } = await db.from("school_staff_task_comments").insert({
      school_id: schoolId, task_id: taskId, author_membership_id: activeMembershipId, body,
    });
    if (error) {
      toast.error(error.message || "Task comment could not be saved.");
      return false;
    }
    setCommentDrafts((current) => ({ ...current, [taskId]: "" }));
    return true;
  };

  const createEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    const rating = Number(evaluationRating);
    if (!schoolId || !activeMembershipId || !evaluationTarget || !evaluationNotes.trim()) {
      toast.error("Choose a staff member and enter evaluation notes.");
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      toast.error("Choose a rating from 1 to 5.");
      return;
    }
    if (evaluationStart && evaluationEnd && evaluationEnd < evaluationStart) {
      toast.error("Evaluation period end must not be before its start.");
      return;
    }
    const { error } = await db.from("school_staff_evaluations").insert({
      school_id: schoolId, target_membership_id: evaluationTarget, reviewer_membership_id: activeMembershipId,
      evaluation_type: "staff_performance", rating, period_start: evaluationStart || null,
      period_end: evaluationEnd || null, notes: evaluationNotes.trim(),
    });
    if (error) return toast.error(error.message || "Evaluation could not be saved.");
    setEvaluationNotes("");
    toast.success("Staff evaluation recorded.");
    await load();
  };

  const reviewConduct = async (report: any, status: "reviewed" | "resolved" | "dismissed") => {
    setSavingId(report.id);
    const { error } = await db.rpc("school_review_staff_conduct_report", {
      p_report_id: report.id, p_status: status, p_note: reviewNotes[report.id]?.trim() || null,
    });
    setSavingId(null);
    if (error) return toast.error(error.message || "Staff conduct report could not be reviewed.");
    toast.success("Staff conduct report updated.");
    await load();
  };

  const reviewStudentRecommendation = async (item: any, accept: boolean) => {
    setSavingId(item.id);
    const { error } = await db.rpc("school_review_disciplinary_recommendation", {
      p_recommendation_id: item.id, p_accept: accept, p_note: reviewNotes[item.id]?.trim() || null,
    });
    setSavingId(null);
    if (error) return toast.error(error.message || "Student-support recommendation could not be reviewed.");
    toast.success(accept ? "Student-support recommendation accepted." : "Student-support recommendation rejected.");
    await load();
  };

  const submitManagerChangeRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !activeMembershipId || !requestTarget || !requestReason.trim()) {
      toast.error("Choose a staff member and explain the requested change.");
      return;
    }
    let details: Record<string, unknown> = {};
    try {
      const parsed = requestDetails.trim() ? JSON.parse(requestDetails) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Details must be a JSON object.");
      details = parsed;
    } catch {
      toast.error("Requested details must be a valid JSON object.");
      return;
    }
    const { error } = await db.from("school_staff_change_requests").insert({
      school_id: schoolId,
      target_membership_id: requestTarget,
      requester_membership_id: activeMembershipId,
      request_type: requestType,
      requested_role: requestType === "role_change" ? requestedRole : null,
      requested_details: details,
      reason: requestReason.trim(),
    });
    if (error) return toast.error(error.message || "The change request could not be submitted.");
    setRequestReason("");
    setRequestDetails("");
    toast.success("Change request sent to network administration for review.");
    await load();
  };

  const submitStaffDisciplineRecommendation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !activeMembershipId || !disciplineTarget || !disciplineReason.trim() || !disciplineRecommendation.trim()) {
      toast.error("Choose a staff member and provide both the reason and recommendation.");
      return;
    }
    const { error } = await db.from("school_disciplinary_recommendations").insert({
      school_id: schoolId,
      target_membership_id: disciplineTarget,
      target_kind: "staff",
      submitted_by_membership_id: activeMembershipId,
      reason: disciplineReason.trim(),
      recommendation: disciplineRecommendation.trim(),
      status: "pending",
    });
    if (error) return toast.error(error.message || "The staff recommendation could not be submitted.");
    setDisciplineReason("");
    setDisciplineRecommendation("");
    toast.success("Staff disciplinary recommendation sent to Super Admin for review.");
    await load();
  };

  const visibleTasks = tasks.filter((task) => {
    const query = taskSearch.trim().toLowerCase();
    const matchesText = !query || [task.title, task.description, memberName(task.assigned_to_membership_id), task.task_type].filter(Boolean).join(" ").toLowerCase().includes(query);
    return matchesText && (taskStatus === "all" || task.status === taskStatus)
      && (taskAssignee === "all" || task.assigned_to_membership_id === taskAssignee);
  });
  const pendingTaskCount = tasks.filter((task) => ["open", "in_progress", "submitted", "returned"].includes(task.status)).length;
  const pendingConduct = conductReports.filter((report) => ["pending", "reviewed"].includes(report.status)).length;
  const pendingStudentSupport = disciplineRecommendations.filter((item) => item.status === "pending").length;

  const renderTasks = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Staff task operations" description="Assign follow-ups, track submissions, discuss work, and verify or return tasks using the existing school task permissions." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Tracked tasks" value={tasks.length} detail="Latest 150 school tasks" icon={ClipboardList} />
        <SchoolMetric label="Awaiting action" value={pendingTaskCount} detail="Open, active, submitted, or returned" icon={AlertCircle} />
        <SchoolMetric label="Submitted" value={tasks.filter((task) => task.status === "submitted").length} detail="Ready for manager verification" icon={CheckCircle2} />
        <SchoolMetric label="Verified" value={tasks.filter((task) => task.status === "verified").length} detail="Completed and verified" icon={ShieldCheck} />
      </div>
      <SchoolPanel title="Assign a staff task" description="Tasks can be assigned to active Admin, Teacher, or Finance memberships. The database validates the assignment and permitted task type.">
        <form onSubmit={createTask} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SchoolField label="Assignee"><select className={schoolSelectClass} value={newTaskAssignee} onChange={(event) => setNewTaskAssignee(event.target.value)}><option value="">Choose staff member</option>{staff.map((member) => <option key={member.id} value={member.id}>{memberName(member.id)} · {member.school_role}</option>)}</select></SchoolField>
          <SchoolField label="Task type"><select className={schoolSelectClass} value={newTaskType} onChange={(event) => setNewTaskType(event.target.value)}><option value="follow_up">Follow-up</option><option value="oversight">Oversight</option><option value="academic">Academic</option><option value="finance">Finance</option></select></SchoolField>
          <SchoolField label="Priority"><select className={schoolSelectClass} value={newTaskPriority} onChange={(event) => setNewTaskPriority(event.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></SchoolField>
          <SchoolField label="Due date"><input type="date" className={schoolInputClass} value={newTaskDueDate} onChange={(event) => setNewTaskDueDate(event.target.value)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-2"><SchoolField label="Task title"><input className={schoolInputClass} maxLength={180} value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} required /></SchoolField></div>
          <div className="md:col-span-2"><SchoolField label="Instructions"><textarea className={schoolTextareaClass} maxLength={3000} rows={2} value={newTaskDescription} onChange={(event) => setNewTaskDescription(event.target.value)} /></SchoolField></div>
          <div className="md:col-span-2 xl:col-span-4"><SchoolPrimaryButton type="submit" disabled={savingId === "new-task"}>{savingId === "new-task" ? "Assigning…" : "Assign task"}</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Task register" description="Staff members start and submit their own tasks. The authorized task assigner verifies, returns, or cancels them.">
        <div className="grid gap-3 sm:grid-cols-3">
          <input className={schoolInputClass} value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Search task or assignee…" aria-label="Search staff tasks" />
          <select className={schoolSelectClass} value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)} aria-label="Filter task status"><option value="all">All statuses</option>{["open","in_progress","submitted","verified","returned","cancelled"].map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select>
          <select className={schoolSelectClass} value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)} aria-label="Filter task assignee"><option value="all">All staff</option>{staff.map((member) => <option key={member.id} value={member.id}>{memberName(member.id)}</option>)}</select>
        </div>
        <div className="mt-4 space-y-3">
          {visibleTasks.length ? visibleTasks.map((task) => {
            const taskComments = comments.filter((comment) => comment.task_id === task.id);
            return <article key={task.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{task.title}</p><p className="mt-1 text-xs text-slate-500">{memberName(task.assigned_to_membership_id)} · {task.task_type.replace(/_/g, " ")} · {task.priority} priority</p></div>
                <SchoolStatus value={task.status} />
              </div>
              {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>}
              <p className="mt-2 text-xs text-slate-500">Due {task.due_date || "No due date"} · Assigned {new Date(task.created_at).toLocaleDateString()}{task.submitted_at ? " · Submitted " + new Date(task.submitted_at).toLocaleString() : ""}{task.verified_at ? " · Verified " + new Date(task.verified_at).toLocaleString() : ""}</p>
              {task.response && <div className="mt-2 rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-600">Staff response</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{task.response}</p></div>}
              {taskComments.length > 0 && <div className="mt-3 space-y-2">{taskComments.map((comment) => <div key={comment.id} className="rounded-md bg-slate-50 px-3 py-2"><p className="text-xs font-semibold text-slate-600">{memberName(comment.author_membership_id)} · {new Date(comment.created_at).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p></div>)}</div>}
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"><textarea className={schoolTextareaClass} rows={2} maxLength={2000} placeholder="Add a task note or feedback…" value={commentDrafts[task.id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [task.id]: event.target.value }))} /><SchoolSecondaryButton onClick={() => void addComment(task.id)} disabled={!commentDrafts[task.id]?.trim()}>Add note</SchoolSecondaryButton></div>
              {task.status === "submitted" && <div className="mt-3 flex flex-wrap gap-2"><SchoolPrimaryButton onClick={() => void updateTaskStatus(task, "verified")} disabled={savingId === task.id}>Verify completion</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void updateTaskStatus(task, "returned")} disabled={savingId === task.id}>Return with feedback</SchoolSecondaryButton></div>}
              {["open","in_progress","returned"].includes(task.status) && <div className="mt-3"><SchoolSecondaryButton onClick={() => void updateTaskStatus(task, "cancelled")} disabled={savingId === task.id}>Cancel task</SchoolSecondaryButton></div>}
            </article>;
          }) : <SchoolEmptyState title="No matching staff tasks" description="Create a task above or change the current filters." />}
        </div>
      </SchoolPanel>
    </div>
  );

  const renderStaff = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Staff accountability" description="Record structured staff evaluations, review school conduct reports, and track change requests routed to network administration." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Evaluations" value={evaluations.length} detail="Latest 100 records" icon={CheckCircle2} />
        <SchoolMetric label="Conduct reports" value={conductReports.length} detail={pendingConduct + " awaiting follow-up"} icon={AlertCircle} />
        <SchoolMetric label="Change requests" value={changeRequests.length} detail={changeRequests.filter((item) => item.status === "pending").length + " pending network review"} icon={FileText} />
        <SchoolMetric label="Active staff" value={staff.length} detail="School memberships" icon={Users} />
      </div>
      <SchoolPanel title="Record a staff evaluation" description="Evaluations are dated records, not automatic employment decisions or public performance rankings.">
        <form onSubmit={createEvaluation} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SchoolField label="Staff member"><select className={schoolSelectClass} value={evaluationTarget} onChange={(event) => setEvaluationTarget(event.target.value)}><option value="">Choose staff</option>{staff.map((member) => <option key={member.id} value={member.id}>{memberName(member.id)} · {member.school_role}</option>)}</select></SchoolField>
          <SchoolField label="Rating (1–5)"><select className={schoolSelectClass} value={evaluationRating} onChange={(event) => setEvaluationRating(event.target.value)}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}</select></SchoolField>
          <SchoolField label="Period start"><input type="date" className={schoolInputClass} value={evaluationStart} onChange={(event) => setEvaluationStart(event.target.value)} /></SchoolField>
          <SchoolField label="Period end"><input type="date" className={schoolInputClass} value={evaluationEnd} onChange={(event) => setEvaluationEnd(event.target.value)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-5"><SchoolField label="Evidence and notes"><textarea className={schoolTextareaClass} rows={3} maxLength={5000} value={evaluationNotes} onChange={(event) => setEvaluationNotes(event.target.value)} required /></SchoolField></div>
          <div className="md:col-span-2 xl:col-span-5"><SchoolPrimaryButton type="submit">Save evaluation</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Staff evaluation history">
        {evaluations.length ? <div className="divide-y divide-slate-100">{evaluations.map((item) => <div key={item.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{memberName(item.target_membership_id)} · {item.rating}/5</p><span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span></div><p className="mt-1 text-xs text-slate-500">Reviewed by {memberName(item.reviewer_membership_id)} · {item.period_start || "No start"} to {item.period_end || "No end"}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.notes}</p></div>)}</div> : <SchoolEmptyState title="No staff evaluations yet" description="A record will appear here after an authorized reviewer saves one." />}
      </SchoolPanel>
      <SchoolPanel title="Staff conduct reports" description="Manager review is recorded through the existing guarded RPC. Staff disciplinary recommendations remain with Super Admin.">
        {conductReports.length ? <div className="space-y-3">{conductReports.map((report) => <article key={report.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{memberName(report.target_teacher_membership_id)} · {report.report_type.replace(/_/g, " ")}</p><SchoolStatus value={report.status} /></div><p className="mt-1 text-xs text-slate-500">{report.severity} severity · Submitted by {memberName(report.submitted_by_membership_id)} · {new Date(report.created_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{report.description}</p>{report.status !== "resolved" && report.status !== "dismissed" && <><textarea className={schoolTextareaClass + " mt-3"} rows={2} maxLength={2000} placeholder="Manager review note…" value={reviewNotes[report.id] || ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [report.id]: event.target.value }))} /><div className="mt-2 flex flex-wrap gap-2"><SchoolSecondaryButton onClick={() => void reviewConduct(report, "reviewed")} disabled={savingId === report.id}>Mark reviewed</SchoolSecondaryButton><SchoolPrimaryButton onClick={() => void reviewConduct(report, "resolved")} disabled={savingId === report.id}>Resolve</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewConduct(report, "dismissed")} disabled={savingId === report.id}>Dismiss</SchoolSecondaryButton></div></>}</article>)}</div> : <SchoolEmptyState title="No staff conduct reports" description="Reports submitted through the authorized school workflow will appear here." />}
      </SchoolPanel>
      <SchoolPanel title="Staff change requests" description="These requests are routed to network administration. The School Manager can monitor their status but cannot approve a network-level role or account change.">
        {changeRequests.length ? <div className="divide-y divide-slate-100">{changeRequests.map((item) => <div key={item.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{item.request_type.replace(/_/g, " ")} · {memberName(item.target_membership_id)}</p><SchoolStatus value={item.status} /></div><p className="mt-1 text-xs text-slate-500">Requested by {memberName(item.requester_membership_id)} · {new Date(item.created_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.reason}</p>{item.requested_role && <p className="mt-1 text-xs text-slate-500">Requested role: {item.requested_role}</p>}{item.review_note && <p className="mt-1 text-xs text-slate-600">Network review: {item.review_note}</p>}</div>)}</div> : <SchoolEmptyState title="No staff change requests" description="Requests submitted by school staff will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderStudentSupport = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Student support & safeguarding oversight" description="Monitor school behavior reports and review student disciplinary recommendations. Report approval stays with the assigned homeroom teacher, School Admin, or appointed leader with review permission." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SchoolMetric label="Behavior reports" value={behaviorReports.length} detail="School-scoped reports" icon={FileText} />
        <SchoolMetric label="Pending behavior review" value={behaviorReports.filter((item) => item.status === "pending").length} detail="Awaiting authorized reviewer" icon={AlertCircle} />
        <SchoolMetric label="Student recommendations" value={pendingStudentSupport} detail="Awaiting School Manager decision" icon={ShieldCheck} />
      </div>
      <SchoolPanel title="Behavior report monitoring" description="This is a monitoring queue. The Manager does not override the report's assigned review authority.">
        {behaviorReports.length ? <div className="space-y-3">{behaviorReports.map((report) => <article key={report.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{memberName(report.student_membership_id)} · {report.report_type.replace(/_/g, " ")}</p><SchoolStatus value={report.status} /></div><p className="mt-1 text-xs text-slate-500">{report.severity} severity · {memberName(report.reported_by_membership_id)} · {new Date(report.created_at).toLocaleString()}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{report.description}</p>{report.review_note && <p className="mt-2 text-xs text-slate-600">Reviewer note: {report.review_note}</p>}{report.status === "pending" && <p className="mt-2 text-xs font-medium text-amber-800">Awaiting the authorized homeroom, School Admin, or appointed-leader reviewer.</p>}</article>)}</div> : <SchoolEmptyState title="No behavior reports" description="No behavior reports are currently visible for this school." />}
      </SchoolPanel>
      <SchoolPanel title="Student disciplinary recommendations" description="Only student-targeted recommendations are shown here. Staff-targeted recommendations remain under Super Admin review.">
        {disciplineRecommendations.length ? <div className="space-y-3">{disciplineRecommendations.map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{memberName(item.target_membership_id)}</p><SchoolStatus value={item.status} /></div><p className="mt-1 text-xs text-slate-500">Submitted by {memberName(item.submitted_by_membership_id)} · {new Date(item.created_at).toLocaleString()}</p><p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Reason:</span> {item.reason}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700"><span className="font-semibold">Recommendation:</span> {item.recommendation}</p>{item.decision_note && <p className="mt-2 text-xs text-slate-600">Decision note: {item.decision_note}</p>}{item.status === "pending" && <><textarea className={schoolTextareaClass + " mt-3"} rows={2} maxLength={2000} placeholder="Decision note (optional)…" value={reviewNotes[item.id] || ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))} /><div className="mt-2 flex flex-wrap gap-2"><SchoolPrimaryButton onClick={() => void reviewStudentRecommendation(item, true)} disabled={savingId === item.id}>Accept recommendation</SchoolPrimaryButton><SchoolSecondaryButton onClick={() => void reviewStudentRecommendation(item, false)} disabled={savingId === item.id}>Reject recommendation</SchoolSecondaryButton></div></>}</article>)}</div> : <SchoolEmptyState title="No student disciplinary recommendations" description="Recommendations submitted through the authorized school workflow will appear here." />}
      </SchoolPanel>
    </div>
  );

  return (
    <div className="space-y-5">
      {loadError && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{loadError}</div>}
      {loading && <p className="text-xs text-slate-500">Refreshing staff and student-support records…</p>}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Staff and student support workspaces">
        <button type="button" role="tab" aria-selected={tab === "tasks"} onClick={() => setTab("tasks")} className={tab === "tasks" ? "rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"}>Staff tasks</button>
        <button type="button" role="tab" aria-selected={tab === "staff"} onClick={() => setTab("staff")} className={tab === "staff" ? "rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"}>Staff accountability</button>
        <button type="button" role="tab" aria-selected={tab === "student-support"} onClick={() => setTab("student-support")} className={tab === "student-support" ? "rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"}>Student support</button>
      </div>
      {tab === "tasks" ? renderTasks() : tab === "staff" ? renderStaff() : renderStudentSupport()}
    </div>
  );
}
