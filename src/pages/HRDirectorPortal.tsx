import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, ClipboardList, Award, Wallet, RefreshCw, Search,
  TrendingUp, UserCheck, Clock3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import { useSchoolLeadership } from "@/components/school/SchoolLeadershipGate";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField, schoolInputClass,
} from "@/components/school/SchoolPortalPrimitives";

type Page = "overview" | "staff" | "performance" | "finance";
const db = supabase as any;
const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "staff", label: "Staff Directory", icon: Users },
  { id: "performance", label: "Staff Performance", icon: Award },
  { id: "finance", label: "Finance Overview", icon: Wallet },
];

export default function HRDirectorPortal() {
  const { activeSchool } = useSchoolPortal();
  const { appointment } = useSchoolLeadership();
  const navigate = useNavigate();
  const schoolId = activeSchool?.id;
  const permissions = useMemo(() => new Set(appointment.permissions || []), [appointment.permissions]);
  const can = (permission: string) => permissions.has(permission);
  const [page, setPage] = useState<Page>("overview");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [tasks, setTasks] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setLoadError(null);
    try {
    const requests: Record<string, Promise<any>> = {
      staff: db.from("school_memberships")
        .select("id,user_id,school_role,status,school_username,grade_label,section_id,created_at")
        .eq("school_id", schoolId)
        .in("school_role", ["admin", "teacher", "finance"])
        .in("status", ["active", "suspended"])
        .order("created_at", { ascending: false }),
    };
    if (can("manage_team_tasks")) {
      requests.tasks = db.from("school_staff_tasks")
        .select("id,title,task_type,priority,status,due_date,assigned_to_membership_id,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(200);
    }
    if (can("view_staff_evaluations")) {
      requests.evaluations = db.from("school_staff_evaluations")
        .select("id,target_membership_id,evaluation_type,rating,period_start,period_end,notes,created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(200);
    }
    if (can("view_finance_summary")) {
      requests.invoices = db.from("school_student_invoices")
        .select("id,amount,paid_amount,balance,currency,due_date,status")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(1000);
      requests.payments = db.from("school_fee_payments")
        .select("id,invoice_id,amount,status,received_at")
        .eq("school_id", schoolId)
        .eq("status", "confirmed")
        .order("received_at", { ascending: false })
        .limit(1000);
    }
    const entries = await Promise.all(Object.entries(requests).map(async ([key, request]) => [key, await request] as const));
    const results = Object.fromEntries(entries) as Record<string, any>;
    const failed = Object.entries(results).find(([, result]) => result.error);
    if (failed) {
      setLoadError(failed[1].error.message || "School records could not be loaded.");
      setLoading(false);
      return;
    }
    const staffRows = results.staff.data ?? [];
    setStaff(staffRows);
    setTasks(results.tasks?.data ?? []);
    setEvaluations(results.evaluations?.data ?? []);
    setInvoices(results.invoices?.data ?? []);
    setPayments(results.payments?.data ?? []);
    const userIds = [...new Set(staffRows.map((member: any) => member.user_id))];
    if (userIds.length) {
      const { data, error } = await db.from("profiles").select("id,name,username").in("id", userIds);
      if (error) {
        setLoadError(error.message || "Staff names could not be loaded.");
      } else {
        setProfiles(Object.fromEntries((data ?? []).map((profile: any) => [profile.id, profile])));
      }
    } else {
      setProfiles({});
    }
    } catch (error: unknown) {
      console.error("[Master Minds] HRDirectorPortal.tsx data load failed", error);
      setLoadError(error instanceof Error ? error.message : "School records could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [schoolId, appointment.permissions]);

  useEffect(() => { void load(); }, [load]);

  const staffName = (membershipId: string) => {
    const member = staff.find((item) => item.id === membershipId);
    return member ? profiles[member.user_id]?.name || member.school_username || "School staff member" : "School staff member";
  };
  const activeStaff = staff.filter((member) => member.status === "active");
  const suspendedStaff = staff.filter((member) => member.status === "suspended");
  const overdueInvoices = invoices.filter((invoice) => Number(invoice.balance) > 0 && invoice.due_date && new Date(invoice.due_date) < new Date());
  const byCurrency = (rows: any[], field: string) => rows.reduce((totals: Record<string, number>, row) => {
    const currency = row.currency || "ETB";
    totals[currency] = (totals[currency] || 0) + Number(row[field] || 0);
    return totals;
  }, {});
  const outstanding = byCurrency(invoices.filter((invoice) => Number(invoice.balance) > 0), "balance");
  const invoiceCurrency = new Map(invoices.map((invoice) => [invoice.id, invoice.currency || "ETB"]));
  const received = payments.reduce((totals: Record<string, number>, payment) => {
    const currency = invoiceCurrency.get(payment.invoice_id) || "ETB";
    totals[currency] = (totals[currency] || 0) + Number(payment.amount || 0);
    return totals;
  }, {});
  const moneySummary = (values: Record<string, number>) => Object.entries(values).map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`).join(" · ") || "0";
  const filteredStaff = staff.filter((member) => {
    const name = staffName(member.id).toLowerCase();
    const q = search.trim().toLowerCase();
    return !q || [name, member.school_username, member.school_role, member.grade_label].some((value) => String(value || "").toLowerCase().includes(q));
  });
  const pendingTasks = tasks.filter((task) => ["open", "in_progress", "submitted", "returned"].includes(task.status));

  const renderOverview = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="HR & business operations" description="School-wide staff oversight and finance visibility. Staff appointments and account changes remain under the School Manager." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Active staff" value={activeStaff.length} detail="Admin, teacher and finance memberships" icon={Users} />
        <SchoolMetric label="Suspended staff" value={suspendedStaff.length} detail="Existing school memberships" icon={UserCheck} />
        <SchoolMetric label="Open staff tasks" value={pendingTasks.length} detail="Assigned and tracked through existing workflows" icon={ClipboardList} />
        <SchoolMetric label="Staff evaluations" value={evaluations.length} detail="Recorded evaluation entries" icon={Award} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Staff snapshot" description="Current school membership records">
          <div className="space-y-3">
            {["admin", "teacher", "finance"].map((role) => {
              const count = activeStaff.filter((member) => member.school_role === role).length;
              return <div key={role} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"><span className="text-sm capitalize text-slate-700">{role === "admin" ? "Main Director account" : role === "finance" ? "Finance staff" : "Teachers"}</span><span className="text-sm font-semibold tabular-nums text-slate-900">{count}</span></div>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <SchoolPrimaryButton onClick={() => setPage("staff")}>Open staff directory</SchoolPrimaryButton>
            <SchoolSecondaryButton onClick={() => setPage("performance")}>Review performance</SchoolSecondaryButton>
          </div>
        </SchoolPanel>
        <SchoolPanel title="Finance snapshot" description="Read-only totals from this school's actual invoices and confirmed payments">
          {can("view_finance_summary") ? (
            <div className="space-y-3">
              <div><p className="text-xs text-slate-500">Outstanding invoices</p><p className="mt-1 text-lg font-semibold text-slate-900">{moneySummary(outstanding)}</p></div>
              <div><p className="text-xs text-slate-500">Confirmed payments received</p><p className="mt-1 text-lg font-semibold text-slate-900">{moneySummary(received)}</p></div>
              <div><p className="text-xs text-slate-500">Overdue invoices</p><p className="mt-1 text-lg font-semibold text-slate-900">{overdueInvoices.length}</p></div>
              <SchoolSecondaryButton onClick={() => setPage("finance")}>View finance overview</SchoolSecondaryButton>
            </div>
          ) : <SchoolEmptyState title="Finance summary not granted" description="Ask the School Manager to update this appointment's permissions." />}
        </SchoolPanel>
      </div>
      {loadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>}
    </div>
  );

  const renderStaff = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Staff directory" description="School staff memberships, account status and profile details." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <SchoolField label="Search staff">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className={`${schoolInputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, username, role or grade" /></div>
      </SchoolField>
      <SchoolPanel title={`Staff members · ${filteredStaff.length}`} description="Only staff memberships in the active school are shown">
        {filteredStaff.length ? <div className="divide-y divide-slate-100">
          {filteredStaff.map((member) => <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div><p className="text-sm font-semibold text-slate-900">{staffName(member.id)}</p><p className="mt-1 text-xs text-slate-500">{member.school_username ? `@${member.school_username}` : "No school username"} · {member.school_role}{member.grade_label ? ` · ${member.grade_label}` : ""}</p></div>
            <div className="flex items-center gap-2"><SchoolStatus value={member.status} /><span className="text-xs text-slate-400">Membership added {new Date(member.created_at).toLocaleDateString()}</span></div>
          </div>)}
        </div> : <SchoolEmptyState title="No matching staff" description="Try another search or check that staff memberships have been created for this school." />}
      </SchoolPanel>
    </div>
  );

  const renderPerformance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Staff performance & tasks" description="Review existing evaluations and monitor assigned staff tasks. This workspace does not change staff roles or appointments." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <SchoolPanel title="Staff evaluations" description="Recorded ratings and reviewer notes">
        {can("view_staff_evaluations") && evaluations.length ? <div className="divide-y divide-slate-100">{evaluations.map((item) => <div key={item.id} className="py-3 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-slate-900">{staffName(item.target_membership_id)}</p><p className="mt-1 text-xs capitalize text-slate-500">{item.evaluation_type.replace(/_/g, " ")} · {item.period_start || "Period not specified"} to {item.period_end || "present"}</p></div><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">{item.rating}/5</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.notes}</p></div>)}</div> : <SchoolEmptyState title="No staff evaluations" description="Evaluation records will appear here when they exist in the school's staff evaluation workflow." />}
      </SchoolPanel>
      <SchoolPanel title="Staff tasks" description="Existing task assignments and completion status">
        {can("manage_team_tasks") && tasks.length ? <div className="divide-y divide-slate-100">{tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-semibold text-slate-900">{task.title}</p><p className="mt-1 text-xs text-slate-500">{staffName(task.assigned_to_membership_id)} · {task.task_type} · {task.due_date || "No due date"}</p></div><div className="flex items-center gap-2"><SchoolStatus value={task.priority} /><SchoolStatus value={task.status} /></div></div>)}</div> : <SchoolEmptyState title="No staff tasks" description="Staff task assignments will appear here when the school uses the existing task workflow." />}
      </SchoolPanel>
    </div>
  );

  const renderFinance = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Finance overview" description="Read-only school finance summary. Transaction entry, fee setup, receipts and reversals stay in the existing School Finance workspace." action={<SchoolSecondaryButton onClick={() => navigate("/school/finance")}>Open Finance Operations <TrendingUp className="ml-2 h-4 w-4" /></SchoolSecondaryButton>} />
      {can("view_finance_summary") ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SchoolMetric label="Outstanding balance" value={moneySummary(outstanding)} detail="Across unpaid school invoices" icon={Wallet} />
        <SchoolMetric label="Confirmed payments" value={moneySummary(received)} detail="Recorded school fee payments" icon={TrendingUp} />
        <SchoolMetric label="Overdue invoices" value={overdueInvoices.length} detail="Invoices past their due date" icon={Clock3} />
      </div> : <SchoolEmptyState title="Finance summary not granted" description="Ask the School Manager to grant finance-summary access." />}
      <SchoolPanel title="Finance operations" description="Use the existing school-scoped ledger for fee structures, invoices, payments, receipts, reversals and reports">
        <SchoolPrimaryButton onClick={() => navigate("/school/finance")}>Open School Finance</SchoolPrimaryButton>
      </SchoolPanel>
    </div>
  );

  let content: React.ReactNode;
  if (page === "staff") content = renderStaff();
  else if (page === "performance") content = renderPerformance();
  else if (page === "finance") content = renderFinance();
  else content = renderOverview();

  return (
    <SchoolPortalShell
      role="finance"
      title="HR Director / Business Manager"
      navItems={navItems.filter((item) => item.id !== "performance" || can("view_staff_evaluations") || can("manage_team_tasks")).filter((item) => item.id !== "finance" || can("view_finance_summary"))}
      activeItem={page}
      onNavigate={(next) => setPage(next as Page)}
      headerActions={<SchoolSecondaryButton onClick={() => navigate("/school/finance")}>Finance operations</SchoolSecondaryButton>}
    >
      {loading && <div className="mb-3 text-xs text-slate-500">Refreshing school records…</div>}
      {content}
    </SchoolPortalShell>
  );
}
