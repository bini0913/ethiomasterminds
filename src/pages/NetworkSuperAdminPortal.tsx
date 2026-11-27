import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, Building2, CheckCircle2, ClipboardCopy,
  DollarSign, Download, FileClock, FileDown, Loader2, Plus, RefreshCw, RotateCcw,
  Search, Settings2, ShieldCheck, Users, UserPlus, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import AdminCommandCenterShell from "@/components/admin/AdminCommandCenterShell";

type School = { id: string; name: string; school_code: string; status: string; created_at: string; manager_count: number; student_count: number };
type Person = { id: string; name: string; username: string | null; school_id: string; school_name: string; school_code: string; school_role: string; membership_status: string; account_status: string; created_at: string };
type Audit = { id: string; actor_name: string | null; action: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown>; created_at: string };
type Alert = { kind: string; severity: string; title: string; detail: string; school_id: string; created_at: string };
type JsonRecord = Record<string, any>;
type Credentials = { username: string; password: string; warning?: string };
type PendingChange =
  | { kind: "school"; target: School; status: string }
  | { kind: "membership"; target: Person; status: string };
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);
const staffRoles = new Set(["manager", "teacher", "finance"]);
const accessHoldRoles = new Set(["parent", "student"]);

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";
const money = (amount: unknown, currency: string) => `${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

export default function NetworkSuperAdminPortal() {
  const { user, logout } = useUser();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [coreError, setCoreError] = useState("");
  const [schoolDirectoryError, setSchoolDirectoryError] = useState("");
  const [financeError, setFinanceError] = useState("");
  const [alertsError, setAlertsError] = useState("");
  const [dashboard, setDashboard] = useState<JsonRecord>({});
  const [schools, setSchools] = useState<School[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState("");
  const [audit, setAudit] = useState<Audit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditPage, setAuditPage] = useState(0);
  const [auditSearch, setAuditSearch] = useState("");
  const [finance, setFinance] = useState<JsonRecord>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [analytics, setAnalytics] = useState<JsonRecord>({});
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const analyticsRequest = useRef(0);
  const [analyticsSchoolId, setAnalyticsSchoolId] = useState("");
  const [peopleSchoolId, setPeopleSchoolId] = useState("");
  const [managerSchoolId, setManagerSchoolId] = useState("");
  const [assignmentSchoolId, setAssignmentSchoolId] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(0);
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [managerName, setManagerName] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [credentialContext, setCredentialContext] = useState<"registration" | "manager" | null>(null);
  const [networkName, setNetworkName] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignmentUsername, setAssignmentUsername] = useState("");
  const [assignmentRole, setAssignmentRole] = useState("manager");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [parentStudentUsernames, setParentStudentUsernames] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [changeSaving, setChangeSaving] = useState(false);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setCoreError("");
    setSchoolDirectoryError("");
    setFinanceError("");
    setAlertsError("");
    try {
      const [summary, directory, financeRes, settings, alertsRes] = await Promise.all([
        rpc("super_admin_get_network_dashboard"),
        rpc("super_admin_list_network_schools", { p_search: null, p_limit: 500, p_offset: 0 }),
        rpc("super_admin_get_network_finance"),
        rpc("super_admin_get_network_settings"),
        rpc("super_admin_get_network_alerts"),
      ]);
      if (summary.error) {
        setCoreError(summary.error.message || "Network overview could not be loaded.");
        setDashboard({});
      } else setDashboard((summary.data || {}) as JsonRecord);
      if (directory.error) {
        setSchoolDirectoryError(directory.error.message || "School directory could not be loaded.");
        setSchools([]);
      } else setSchools((directory.data || []) as School[]);
      if (financeRes.error) {
        setFinanceError(financeRes.error.message || "Network finance could not be loaded.");
        setFinance({});
      } else setFinance((financeRes.data || {}) as JsonRecord);
      if (settings.error) {
        toast.error(`Network settings: ${settings.error.message}`);
        setNetworkName("");
      } else {
        const setting = (settings.data || [])[0];
        if (setting) setNetworkName(setting.name || "");
      }
      if (alertsRes.error) {
        setAlertsError(alertsRes.error.message || "Network alerts could not be loaded.");
        setAlerts([]);
      } else setAlerts((alertsRes.data || []) as Alert[]);
    } catch (error: unknown) {
      console.error("[Master Minds] NetworkSuperAdminPortal.tsx data load failed", error);
      setCoreError(error instanceof Error ? error.message : "This workspace could not load its records. Please retry.");
      setDashboard({});
      setSchools([]);
      setFinance({});
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPeople = useCallback(async () => {
    setPeopleLoading(true);
    setPeopleError("");
    try {
      const response = await rpc("super_admin_list_network_people", {
        p_school_id: peopleSchoolId || null,
        p_role: role === "all" ? null : role,
        p_search: peopleSearch.trim() || null,
        p_limit: 50,
        p_offset: page * 50,
      });
      if (response.error) {
        setPeopleError(response.error.message || "The network directory could not be loaded.");
        setPeople([]);
      } else setPeople((response.data || []) as Person[]);
    } catch (error: unknown) {
      setPeopleError(error instanceof Error ? error.message : "The network directory could not be loaded.");
      setPeople([]);
    } finally {
      setPeopleLoading(false);
    }
  }, [page, peopleSearch, peopleSchoolId, role]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError("");
    try {
      const response = await rpc("super_admin_get_network_audit_logs", { p_limit: 50, p_offset: auditPage * 50 });
      if (response.error) {
        setAuditError(response.error.message || "Audit history could not be loaded.");
        setAudit([]);
      } else setAudit((response.data || []) as Audit[]);
    } catch (error: unknown) {
      setAuditError(error instanceof Error ? error.message : "Audit history could not be loaded.");
      setAudit([]);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage]);

  useEffect(() => { if (user?.role === "super_admin") void loadCore(); }, [loadCore, user?.role]);
  useEffect(() => {
    if (user?.role !== "super_admin" || tab !== "people") return;
    const timer = window.setTimeout(() => void loadPeople(), 250);
    return () => window.clearTimeout(timer);
  }, [loadPeople, tab, user?.role]);
  useEffect(() => { if (user?.role === "super_admin" && tab === "audit") void loadAudit(); }, [loadAudit, tab, user?.role]);

  const analyticsSchool = useMemo(() => schools.find((item) => item.id === analyticsSchoolId), [schools, analyticsSchoolId]);
  const filteredSchools = useMemo(() => {
    const query = schoolSearch.trim().toLowerCase();
    return query ? schools.filter((item) => item.name.toLowerCase().includes(query) || item.school_code.toLowerCase().includes(query)) : schools;
  }, [schools, schoolSearch]);

  const navItems = [
    { key: "overview", label: "Overview", description: "Network pulse", section: "Network", icon: Activity },
    { key: "schools", label: "Schools", description: "Register and oversee", section: "Network", icon: Building2 },
    { key: "people", label: "People", description: "Staff and memberships", section: "Network", icon: Users },
    { key: "analytics", label: "Analytics", description: "School performance", section: "Insights", icon: BarChart3 },
    { key: "finance", label: "Finance", description: "Read-only oversight", section: "Insights", icon: DollarSign },
    { key: "audit", label: "Audit history", description: "Recorded changes", section: "Governance", icon: FileClock },
    { key: "settings", label: "Settings", description: "Network identity", section: "Governance", icon: Settings2 },
  ];

  const loadAnalytics = async (schoolId: string) => {
    const requestId = ++analyticsRequest.current;
    setAnalyticsSchoolId(schoolId);
    setAnalytics({});
    setAnalyticsError("");
    if (!schoolId) { setAnalyticsLoading(false); return; }
    setAnalyticsLoading(true);
    try {
      const response = await rpc("super_admin_get_school_analytics", { p_school_id: schoolId });
      if (requestId !== analyticsRequest.current) return;
      if (response.error) setAnalyticsError(response.error.message || "School analytics could not be loaded.");
      else setAnalytics((response.data || {}) as JsonRecord);
    } catch (error: unknown) {
      if (requestId === analyticsRequest.current) setAnalyticsError(error instanceof Error ? error.message : "School analytics could not be loaded.");
    } finally {
      if (requestId === analyticsRequest.current) setAnalyticsLoading(false);
    }
  };

  const requestSchoolStatus = (item: School, status: string) => {
    setChangeReason("");
    setPendingChange({ kind: "school", target: item, status });
  };

  const requestMembershipStatus = (person: Person, status: string) => {
    if (person.school_role === "admin") {
      toast.error("Legacy School Admin memberships are retired. Use the School Manager leadership appointment workflow.");
      return;
    }
    if (!staffRoles.has(person.school_role) && !accessHoldRoles.has(person.school_role)) {
      toast.error("This membership is managed through the school's leadership or enrollment workflow.");
      return;
    }
    if (accessHoldRoles.has(person.school_role) && !["active", "suspended"].includes(person.membership_status)) {
      toast.error("Transferred, graduated, or deactivated memberships must be handled through school enrollment workflows.");
      return;
    }
    if (accessHoldRoles.has(person.school_role) && !["active", "suspended"].includes(status)) {
      toast.error("Network authority may only suspend or restore Parent and Student access.");
      return;
    }
    setChangeReason("");
    setPendingChange({ kind: "membership", target: person, status });
  };

  const confirmStatusChange = async () => {
    if (!pendingChange || changeReason.trim().length < 8) return;
    setChangeSaving(true);
    try {
      const response = pendingChange.kind === "school"
        ? await rpc("super_admin_set_school_status", {
            p_school_id: pendingChange.target.id,
            p_status: pendingChange.status,
            p_reason: changeReason.trim(),
          })
        : await rpc("super_admin_set_school_membership_status", {
            p_membership_id: pendingChange.target.id,
            p_status: pendingChange.status,
            p_reason: changeReason.trim(),
          });
      if (response.error || response.data !== true) {
        toast.error(response.error?.message || "The status change was rejected.");
        return;
      }
      toast.success(pendingChange.kind === "school" ? "School status updated." : "Staff membership updated.");
      const changedKind = pendingChange.kind;
      setPendingChange(null);
      setChangeReason("");
      await Promise.all([loadCore(), loadAudit()]);
      if (changedKind === "membership") await loadPeople();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "The status change could not be completed.");
    } finally {
      setChangeSaving(false);
    }
  };

  const registerSchool = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setCredentials(null);
    setCredentialContext(null);
    try {
      const response = await supabase.functions.invoke("school-provision-account", {
        body: {
          action: "create_school",
          school: { name: schoolName.trim(), school_code: schoolCode.trim().toUpperCase() },
          manager: { name: managerName.trim() },
        },
      });
      if (response.error || response.data?.error) {
        toast.error(response.data?.error || response.error?.message || "School registration failed.");
        return;
      }
      const manager = response.data?.manager;
      if (!manager?.username || !manager?.initial_password) {
        toast.error("The school was created, but the Manager credentials were not returned. Review the audit history before retrying.");
        await loadCore();
        return;
      }
      setCredentials({
        username: manager.username,
        password: manager.initial_password,
        warning: manager.audit_warning || response.data?.school?.audit_warning,
      });
      setCredentialContext("registration");
      setSchoolName("");
      setSchoolCode("");
      setManagerName("");
      toast.success("School registered and its initial Manager was provisioned.");
      if (manager.audit_warning || response.data?.school?.audit_warning) toast.warning("The account was created, but an audit warning needs review.");
      await Promise.all([loadCore(), loadAudit()]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "School registration failed.");
    } finally {
      setSaving(false);
    }
  };

  const createManager = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!managerSchoolId) return toast.error("Choose a school first.");
    setSaving(true);
    setCredentials(null);
    setCredentialContext(null);
    try {
      const response = await supabase.functions.invoke("school-provision-account", {
        body: { action: "create_accounts", school_id: managerSchoolId, role: "manager", accounts: [{ name: managerName.trim() }] },
      });
      if (response.error || response.data?.error || !response.data?.created?.length) {
        toast.error(response.data?.error || response.data?.failed?.[0]?.message || response.error?.message || "Manager provisioning failed.");
        return;
      }
      const created = response.data.created[0];
      setCredentials({ username: created.username, password: created.initial_password, warning: created.audit_warning });
      setCredentialContext("manager");
      setManagerName("");
      toast.success("School Manager account provisioned.");
      if (created.audit_warning) toast.warning(created.audit_warning);
      await Promise.all([loadCore(), loadAudit()]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Manager provisioning failed.");
    } finally {
      setSaving(false);
    }
  };

  const assignExistingAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignmentSchoolId) return toast.error("Choose an active school.");
    if (assignmentReason.trim().length < 8) return toast.error("Enter a clear assignment reason (at least 8 characters).");
    const studentUsernames = parentStudentUsernames.split(/[\n,;]+/).map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (assignmentRole === "parent" && studentUsernames.length === 0) return toast.error("Add at least one enrolled student username for the Parent account.");
    setAssignmentSaving(true);
    setCredentials(null);
    setCredentialContext(null);
    try {
      const response = await supabase.functions.invoke("school-provision-account", {
        body: {
          action: "attach_existing_account",
          school_id: assignmentSchoolId,
          username: assignmentUsername.trim().toLowerCase(),
          role: assignmentRole,
          reason: assignmentReason.trim(),
          ...(assignmentRole === "parent" ? { student_usernames: studentUsernames } : {}),
        },
      });
      if (response.error || response.data?.error) {
        toast.error(response.data?.error || response.error?.message || "Existing account assignment failed.");
        return;
      }
      toast.success(`Existing account assigned as ${assignmentRole}.`);
      if (response.data?.warning) toast.warning(response.data.warning);
      setAssignmentUsername("");
      setAssignmentReason("");
      setParentStudentUsernames("");
      await Promise.all([loadCore(), loadAudit()]);
      if (tab === "people") await loadPeople();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Existing account assignment failed.");
    } finally {
      setAssignmentSaving(false);
    }
  };

  const saveNetworkName = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await rpc("super_admin_update_network_name", { p_name: networkName.trim() });
      if (response.error) toast.error(response.error.message || "Network settings could not be saved.");
      else {
        toast.success("Network name saved.");
        await Promise.all([loadCore(), loadAudit()]);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Network settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const refreshWorkspace = async () => {
    await loadCore();
    if (tab === "people") await loadPeople();
    if (tab === "audit") await loadAudit();
  };

  const exportFinance = () => {
    const rows: unknown[][] = [];
    (finance.recent_invoices || []).forEach((item: JsonRecord) => rows.push([
      "invoice", item.school_name, item.invoice_number, item.status, item.currency, item.amount, item.paid_amount, item.balance, item.due_date, item.created_at,
    ]));
    (finance.recent_payments || []).forEach((item: JsonRecord) => rows.push([
      "payment", item.school_name, item.invoice_number, item.status, item.currency, item.amount, "", "", item.receipt_number, item.received_at,
    ]));
    (finance.pending_followup_records || []).forEach((item: JsonRecord) => rows.push([
      "finance_followup", item.school_name, item.invoice_number, item.status, "", "", "", "", item.followup_id, item.created_at,
    ]));
    downloadCsv("master-minds-network-finance.csv", ["record_type", "school", "invoice", "status", "currency", "amount", "paid_amount", "balance", "reference_or_due_date", "recorded_at"], rows);
  };

  const exportAudit = () => downloadCsv(
    "master-minds-network-audit.csv",
    ["created_at", "actor", "action", "target_type", "target_id", "metadata"],
    filteredAudit.map((row) => [row.created_at, row.actor_name || "System", row.action, row.target_type, row.target_id, JSON.stringify(row.metadata || {})]),
  );

  const filteredAudit = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    return query ? audit.filter((row) => [row.actor_name, row.action, row.target_type, row.target_id, JSON.stringify(row.metadata || {})].join(" ").toLowerCase().includes(query)) : audit;
  }, [audit, auditSearch]);

  if (user?.role !== "super_admin") return null;

  return (
    <>
      <AdminCommandCenterShell
        roleLabel="Super Admin"
        title={String(dashboard.network_name || "School Network")}
        description="Network operations, school oversight, and onboarding."
        activeKey={tab}
        navItems={navItems}
        onNavigate={(next) => { setTab(next); setPage(0); }}
        onRefresh={() => void refreshWorkspace()}
        refreshing={loading || peopleLoading || auditLoading}
        onLogout={logout}
        accessLabel="Network authority"
        accessDescription="Manage your assigned schools and school leadership. Platform-wide controls remain with Extreme Admin."
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="font-semibold text-slate-900">Network command center</p><p className="text-sm text-slate-500">One network · {schools.length} loaded school record(s) · live records only</p></div>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Network-scoped access</Badge>
        </div>

        <div className="space-y-6">

          {tab === "overview" && <section className="space-y-6">
            {coreError && <ErrorPanel message={coreError} onRetry={() => void loadCore()} />}
            <MetricGrid items={[
              ["Schools", dashboard.schools],
              ["Active schools", dashboard.active_schools],
              ["Suspended schools", dashboard.suspended_schools],
              ["Schools without an active Manager", dashboard.schools_without_active_manager],
              ["Manager memberships", dashboard.managers],
              ["Legacy Admin memberships", dashboard.admins],
              ["Teacher memberships", dashboard.teachers],
              ["Finance memberships", dashboard.finance_staff],
              ["Parent memberships", dashboard.parents],
              ["Active student memberships", dashboard.active_students],
              ["Enrolled student memberships", dashboard.enrolled_students],
              ["Active staff memberships", dashboard.active_staff],
            ]} />
            <Card>
              <CardHeader><CardTitle>Network alerts</CardTitle><CardDescription>School-level operational signals. Student identities and private report details are not exposed here.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {alertsError ? <ErrorPanel message={alertsError} onRetry={() => void loadCore()} /> : alerts.length ? alerts.map((alert) => (
                  <div key={`${alert.kind}-${alert.school_id}-${alert.created_at}`} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${alert.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}><AlertTriangle className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{alert.title}</p><Badge variant={alert.severity === "warning" ? "destructive" : "secondary"}>{alert.severity}</Badge></div><p className="mt-1 text-sm text-slate-600">{alert.detail}</p><p className="mt-1 text-xs text-slate-400">{formatDate(alert.created_at)}</p></div>
                    <Button size="sm" variant="ghost" onClick={() => { setTab(alert.kind === "finance_followup" ? "finance" : "schools"); }}>Review</Button>
                  </div>
                )) : <EmptyState title="No active network alerts" detail="There are no suspended schools, missing active Managers, pending finance follow-ups, or pending behavior reports in the current network." />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Network school directory</CardTitle><CardDescription>Compare enrollment and school leadership, inspect analytics, or review a school's access status.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search schools by name or code" value={schoolSearch} onChange={(event) => setSchoolSearch(event.target.value)} /></div>
                {schoolDirectoryError ? <ErrorPanel message={schoolDirectoryError} onRetry={() => void loadCore()} /> : <SchoolTable schools={filteredSchools} onAnalytics={(id) => { setTab("analytics"); void loadAnalytics(id); }} onStatus={requestSchoolStatus} />}
              </CardContent>
            </Card>
          </section>}

          {tab === "schools" && <section className="space-y-6">
            <div className="grid gap-5 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Register a school</CardTitle><CardDescription>Creates a school in this network and provisions its initial School Manager through the secured account service.</CardDescription></CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={registerSchool}>
                    <label className="block text-sm font-medium text-slate-700">School name<Input className="mt-1" placeholder="Enter registered school name" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} required minLength={2} maxLength={160} /></label>
                    <label className="block text-sm font-medium text-slate-700">School code<Input className="mt-1 uppercase" placeholder="e.g. MM01" value={schoolCode} onChange={(event) => setSchoolCode(event.target.value.toUpperCase())} required pattern="[A-Z0-9]{2,8}" /></label>
                    <label className="block text-sm font-medium text-slate-700">Initial Manager full name<Input className="mt-1" placeholder="Enter Manager's full name" value={managerName} onChange={(event) => setManagerName(event.target.value)} required minLength={2} maxLength={160} /></label>
                    <Button className="w-full" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Register school and provision Manager</Button>
                  </form>
                  {credentials && credentialContext === "registration" && <CredentialBox credentials={credentials} onDismiss={() => { setCredentials(null); setCredentialContext(null); }} />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Assign an existing account</CardTitle><CardDescription>Attach an active existing account to an active school as Manager, Finance, or Parent. Global platform roles cannot be assigned to a school.</CardDescription></CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={assignExistingAccount}>
                    <label className="block text-sm font-medium text-slate-700">School<Select value={assignmentSchoolId} onValueChange={setAssignmentSchoolId}><SelectTrigger className="mt-1"><SelectValue placeholder="Choose an active school" /></SelectTrigger><SelectContent>{schools.filter((item) => item.status === "active").map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.school_code}</SelectItem>)}</SelectContent></Select></label>
                    <label className="block text-sm font-medium text-slate-700">Existing username<Input className="mt-1" placeholder="Enter exact username" value={assignmentUsername} onChange={(event) => setAssignmentUsername(event.target.value)} required minLength={3} maxLength={64} /></label>
                    <label className="block text-sm font-medium text-slate-700">School role<Select value={assignmentRole} onValueChange={setAssignmentRole}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manager">School Manager</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="parent">Parent</SelectItem></SelectContent></Select></label>
                    {assignmentRole === "parent" && <label className="block text-sm font-medium text-slate-700">Enrolled student usernames<Textarea className="mt-1" placeholder="One username per line (or comma-separated)" value={parentStudentUsernames} onChange={(event) => setParentStudentUsernames(event.target.value)} required rows={3} /><span className="mt-1 block text-xs font-normal text-slate-500">Every student must already be actively enrolled in the selected school.</span></label>}
                    <label className="block text-sm font-medium text-slate-700">Assignment reason<Textarea className="mt-1" placeholder="Record why this account is being attached to the school" value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} required minLength={8} rows={2} /></label>
                    <Button className="w-full" disabled={assignmentSaving || !schools.some((item) => item.id === assignmentSchoolId && item.status === "active")}>{assignmentSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}Assign existing account</Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>School directory and access</CardTitle><CardDescription>Suspension pauses school access. Closure is a separate status and must be deliberately reopened.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search schools by name or code" value={schoolSearch} onChange={(event) => setSchoolSearch(event.target.value)} /></div>
                {schoolDirectoryError ? <ErrorPanel message={schoolDirectoryError} onRetry={() => void loadCore()} /> : <SchoolTable schools={filteredSchools} onAnalytics={(id) => { setTab("analytics"); void loadAnalytics(id); }} onStatus={requestSchoolStatus} />}
              </CardContent>
            </Card>
          </section>}

          {tab === "people" && <section>
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div><CardTitle>People and school memberships</CardTitle><CardDescription>Network directory. Global account status is separate from a person's membership in one school.</CardDescription></div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search people or school" value={peopleSearch} onChange={(event) => { setPeopleSearch(event.target.value); setPage(0); }} /></div>
                    <Select value={role} onValueChange={(value) => { setRole(value); setPage(0); }}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="manager">Managers</SelectItem><SelectItem value="admin">Admins</SelectItem><SelectItem value="teacher">Teachers</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="parent">Parents</SelectItem><SelectItem value="student">Students</SelectItem></SelectContent></Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 max-w-sm"><Select value={peopleSchoolId || "all"} onValueChange={(value) => { setPeopleSchoolId(value === "all" ? "" : value); setPage(0); }}><SelectTrigger aria-label="Filter people by school"><SelectValue placeholder="All schools" /></SelectTrigger><SelectContent><SelectItem value="all">All schools</SelectItem>{schools.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.school_code}</SelectItem>)}</SelectContent></Select></div>
                {peopleError ? <ErrorPanel message={peopleError} onRetry={() => void loadPeople()} /> : peopleLoading ? <LoadingState label="Loading network memberships…" /> : <PeopleTable people={people} onStatus={requestMembershipStatus} />}
                <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Page {page + 1} · 50 records per page</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page === 0 || peopleLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button><Button size="sm" variant="outline" disabled={people.length < 50 || peopleLoading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
              </CardContent>
            </Card>
          </section>}

          {tab === "analytics" && <section className="space-y-4">
            <Card><CardHeader><CardTitle>School performance</CardTitle><CardDescription>Aggregated school-level academic and operational indicators. This is oversight, not a replacement for the school's academic workflows.</CardDescription></CardHeader><CardContent><Select value={analyticsSchoolId} onValueChange={(id) => void loadAnalytics(id)}><SelectTrigger className="max-w-xl"><SelectValue placeholder="Choose a school to inspect" /></SelectTrigger><SelectContent>{schools.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.school_code}</SelectItem>)}</SelectContent></Select><p className="mt-3 text-sm text-slate-500">{analyticsLoading ? "Loading school analytics…" : analyticsSchool ? `Showing live indicators for ${analyticsSchool.name}` : "Choose a school to view its analytics."}</p></CardContent></Card>
            {analyticsError && <ErrorPanel message={analyticsError} onRetry={() => void loadAnalytics(analyticsSchoolId)} />}
            {analyticsLoading ? <LoadingState label="Loading school performance…" /> : analyticsError ? null : analyticsSchoolId && Object.keys(analytics).length > 0 ? <>
              <MetricGrid items={[
                ["Student memberships", analytics.students], ["Teacher memberships", analytics.teachers], ["Manager memberships", analytics.managers],
                ["Legacy Admin memberships", analytics.admins], ["Finance memberships", analytics.finance_staff], ["Parent memberships", analytics.parents],
                ["Average term score", analytics.average_score == null ? "—" : `${analytics.average_score}%`],
                ["Attendance rate", analytics.attendance_rate == null ? "—" : `${analytics.attendance_rate}%`],
                ["Attendance records", analytics.attendance_records], ["Published results", analytics.published_results],
                ["Pending behavior reports", analytics.pending_behavior_reports], ["Invoices", analytics.invoice_count],
                ["Confirmed invoice payments", analytics.payment_count],
              ]} />
              <Card><CardHeader><CardTitle>Outstanding balances by currency</CardTitle><CardDescription>Only invoice balances are shown. Different currencies are never combined.</CardDescription></CardHeader><CardContent className="space-y-2">{(analytics.outstanding_by_currency || []).length ? analytics.outstanding_by_currency.map((item: JsonRecord) => <div key={item.currency} className="flex items-center justify-between rounded-lg border p-3"><span className="font-medium">{item.currency}</span><span className="tabular-nums font-semibold">{money(item.outstanding_balance, item.currency)}</span></div>) : <EmptyState title="No outstanding balances" detail="No positive invoice balances are recorded for this school." />}</CardContent></Card>
            </> : <EmptyState title="Select a school" detail="School-level metrics appear here after a school is selected. Empty source data is shown as empty, never replaced with sample values." />}
          </section>}

          {tab === "finance" && <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Network finance oversight</h2><p className="text-sm text-slate-500">Read-only visibility. Invoice creation, payment confirmation, reversals, and follow-up resolution remain in school Finance workflows.</p></div><Button variant="outline" onClick={exportFinance} disabled={Boolean(financeError)}><Download className="mr-2 h-4 w-4" />Export recent finance CSV</Button></div>
            {financeError ? <ErrorPanel message={financeError} onRetry={() => void loadCore()} /> : <>
            <MetricGrid items={[["School invoices", finance.invoice_count], ["Confirmed payments", finance.confirmed_payments], ["Pending follow-ups", finance.pending_followups], ["Overdue invoices", finance.overdue_invoice_count]]} />
            <Card><CardHeader><CardTitle>Network totals by currency</CardTitle><CardDescription>Invoice totals and confirmed invoice-linked payments are grouped by the invoice currency.</CardDescription></CardHeader><CardContent className="space-y-3">{(finance.currency_totals || []).length ? finance.currency_totals.map((item: JsonRecord) => <div key={item.currency} className="rounded-xl border p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{item.currency}</h3><Badge variant="secondary">{item.invoice_count} invoices</Badge></div><div className="grid gap-3 sm:grid-cols-3"><FinanceMetric label="Invoiced" amount={item.invoiced_amount} currency={item.currency} /><FinanceMetric label="Confirmed paid" amount={item.paid_amount} currency={item.currency} /><FinanceMetric label="Outstanding" amount={item.outstanding_balance} currency={item.currency} /></div></div>) : <EmptyState title="No school invoices yet" detail="No school-fee invoices have been recorded in this network." />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Overdue invoices by currency</CardTitle><CardDescription>Positive invoice balances past their due date, based on the recorded invoice due date.</CardDescription></CardHeader><CardContent>{(finance.overdue_by_currency || []).length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{finance.overdue_by_currency.map((item: JsonRecord) => <div key={item.currency} className="rounded-lg border p-3"><p className="text-xs text-slate-500">{item.currency} · {item.invoice_count} invoices</p><p className="mt-1 text-lg font-semibold tabular-nums">{money(item.outstanding_balance, item.currency)}</p></div>)}</div> : <EmptyState title="No overdue balances" detail="There are no positive invoice balances past their due dates." />}</CardContent></Card>
            <div className="grid gap-5 xl:grid-cols-2">
              <RecordTable title="Recent school invoices" description="Latest 50 invoice records across the network." headers={["School", "Invoice", "Status / due", "Amount / balance"]} rows={(finance.recent_invoices || []).map((item: JsonRecord) => [<span className="font-medium">{item.school_name}</span>, item.invoice_number, <span>{item.status}<br /><span className="text-xs text-slate-500">{item.due_date || "No due date"}</span></span>, <span className="whitespace-nowrap text-right">{money(item.amount, item.currency)}<br /><span className="text-xs text-slate-500">Balance {money(item.balance, item.currency)}</span></span>])} empty="No school invoices are available." />
              <RecordTable title="Recent school payments" description="Payments linked to an invoice, including their recorded status." headers={["School / invoice", "Receipt", "Method / status", "Amount"]} rows={(finance.recent_payments || []).map((item: JsonRecord) => [<span className="font-medium">{item.school_name}<br /><span className="text-xs text-slate-500">{item.invoice_number}</span></span>, item.receipt_number, <span>{item.payment_method}<br /><span className="text-xs text-slate-500">{item.status} · {formatDate(item.received_at)}</span></span>, <span className="whitespace-nowrap text-right">{money(item.amount, item.currency)}</span>])} empty="No invoice-linked school payments are available." />
            </div>
            <Card><CardHeader><CardTitle>Pending finance follow-ups</CardTitle><CardDescription>Review queue visibility only. The school Finance team owns resolution and payment changes.</CardDescription></CardHeader><CardContent>{(finance.pending_followup_records || []).length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">School</th><th className="p-2">Invoice</th><th className="p-2">Created</th><th className="p-2">Status</th></tr></thead><tbody className="divide-y">{finance.pending_followup_records.map((item: JsonRecord) => <tr key={item.followup_id}><td className="p-2 font-medium">{item.school_name} · {item.school_code}</td><td className="p-2">{item.invoice_number}</td><td className="p-2 text-xs text-slate-500">{formatDate(item.created_at)}</td><td className="p-2"><Badge variant="secondary">{item.status}</Badge></td></tr>)}</tbody></table></div> : <EmptyState title="No pending finance follow-ups" detail="There are no network finance follow-up items awaiting school-level review." />}</CardContent></Card>
            </>}
          </section>}

          {tab === "audit" && <section>
            <Card><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle>Network audit history</CardTitle><CardDescription>Recorded administrative changes affecting this network and its schools.</CardDescription></div><Button variant="outline" onClick={exportAudit} disabled={!filteredAudit.length}><FileDown className="mr-2 h-4 w-4" />Export visible page</Button></div></CardHeader><CardContent className="space-y-4">
              <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Filter this page by actor, action, target, or details" value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} /></div>
              {auditError ? <ErrorPanel message={auditError} onRetry={() => void loadAudit()} /> : auditLoading ? <LoadingState label="Loading audit history…" /> : <AuditTable rows={filteredAudit} />}
              <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Page {auditPage + 1} · 50 records per page</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={auditPage === 0 || auditLoading} onClick={() => setAuditPage((value) => Math.max(0, value - 1))}>Previous</Button><Button size="sm" variant="outline" disabled={audit.length < 50 || auditLoading} onClick={() => setAuditPage((value) => value + 1)}>Next</Button></div></div>
            </CardContent></Card>
          </section>}

          {tab === "settings" && <section className="grid gap-5 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Network identity</CardTitle><CardDescription>Updates the singleton network display name. The change is recorded in the administrative audit history.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={saveNetworkName}><label className="block text-sm font-medium text-slate-700">Network name<Input className="mt-1" value={networkName} onChange={(event) => setNetworkName(event.target.value)} minLength={2} maxLength={160} required /></label><Button disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save network name</Button></form></CardContent></Card>
            <Card><CardHeader><CardTitle>School Manager onboarding</CardTitle><CardDescription>Provision a Manager for an existing active school. Other day-to-day school roles remain under the school's management workflow.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={createManager}><label className="block text-sm font-medium text-slate-700">Active school<Select value={managerSchoolId} onValueChange={setManagerSchoolId}><SelectTrigger className="mt-1"><SelectValue placeholder="Choose a school" /></SelectTrigger><SelectContent>{schools.filter((item) => item.status === "active").map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.school_code}</SelectItem>)}</SelectContent></Select></label><label className="block text-sm font-medium text-slate-700">Manager full name<Input className="mt-1" placeholder="Enter full name" value={managerName} onChange={(event) => setManagerName(event.target.value)} required minLength={2} maxLength={160} /></label><Button disabled={saving || !managerSchoolId}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}Provision School Manager</Button></form>{credentials && credentialContext === "manager" && <CredentialBox credentials={credentials} onDismiss={() => { setCredentials(null); setCredentialContext(null); }} />}</CardContent></Card>
            <Card className="xl:col-span-2"><CardHeader><CardTitle>Authority boundaries</CardTitle><CardDescription>These boundaries keep network administration safe and prevent overlap with platform-owner and school-level responsibilities.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><Boundary title="Network authority" detail="Manage network identity, school registration and status, school leadership assignments, network reporting, and network audit visibility." /><Boundary title="School-owned workflows" detail="Daily teaching, attendance entry, student enrollment, academic calendars, invoices, payment confirmation, and school-level follow-up resolution remain in their respective school portals." /><Boundary title="Extreme Admin authority" detail="Platform-wide accounts, global security controls, platform finance, infrastructure health, and cross-network operations remain with Extreme Admin." /></CardContent></Card>
          </section>}
        </div>
      </AdminCommandCenterShell>

      <Dialog open={Boolean(pendingChange)} onOpenChange={(open) => { if (!open && !changeSaving) { setPendingChange(null); setChangeReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm {pendingChange?.kind === "school" ? "school" : "membership"} status change</DialogTitle><DialogDescription>{pendingChange ? `Change ${pendingChange.kind === "school" ? (pendingChange.target as School).name : (pendingChange.target as Person).name} to “${pendingChange.status}”. This action is network-scoped, requires a reason, and will be written to the audit history.` : ""}</DialogDescription></DialogHeader>
          <label className="block text-sm font-medium text-slate-700">Reason for this change<Textarea className="mt-1" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Explain the operational reason (minimum 8 characters)" rows={4} minLength={8} required /></label>
          <DialogFooter><Button variant="outline" disabled={changeSaving} onClick={() => setPendingChange(null)}>Cancel</Button><Button disabled={changeSaving || changeReason.trim().length < 8} onClick={() => void confirmStatusChange()}>{changeSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirm change</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MetricGrid({ items }: { items: Array<[string, unknown]> }) {
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(([label, metric]) => <Card key={label}><CardContent className="p-4 sm:p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{metric == null ? "—" : String(metric)}</p></CardContent></Card>)}</section>;
}

function FinanceMetric({ label, amount, currency }: { label: string; amount: unknown; currency: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{money(amount, currency)}</p></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center"><p className="font-semibold text-slate-800">{title}</p><p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">{detail}</p></div>;
}

function LoadingState({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{message}</span><Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>;
}

function CredentialBox({ credentials, onDismiss }: { credentials: Credentials; onDismiss: () => void }) {
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Clipboard access is unavailable in this browser. Copy the credential manually.");
    }
  };
  return <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
    <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />One-time Manager credentials</div><Button size="icon" variant="ghost" className="h-8 w-8" onClick={onDismiss} aria-label="Dismiss credentials"><X className="h-4 w-4" /></Button></div>
    <div className="mt-3 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><p>Username: <strong className="font-mono">{credentials.username}</strong></p><Button size="sm" variant="outline" onClick={() => void copy(credentials.username, "Username")}><ClipboardCopy className="mr-1 h-3.5 w-3.5" />Copy</Button></div><div className="flex flex-wrap items-center justify-between gap-2"><p>Password: <strong className="font-mono">{credentials.password}</strong></p><Button size="sm" variant="outline" onClick={() => void copy(credentials.password, "Password")}><ClipboardCopy className="mr-1 h-3.5 w-3.5" />Copy</Button></div></div>
    <p className="mt-3 text-xs">Share these once through a secure channel. The Manager must change the password at first sign-in. Dismiss this panel after securely recording the credentials.</p>
    {credentials.warning && <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">{credentials.warning}</p>}
  </div>;
}

function SchoolTable({ schools, onAnalytics, onStatus }: { schools: School[]; onAnalytics: (id: string) => void; onStatus: (school: School, status: string) => void }) {
  if (!schools.length) return <EmptyState title="No schools found" detail="No school records match this search in the current network." />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50"><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">School</th><th className="p-3">Code</th><th className="p-3">Managers</th><th className="p-3">Students</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{schools.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="p-3 font-medium">{item.name}</td><td className="p-3 font-mono text-xs">{item.school_code}</td><td className="p-3 tabular-nums">{item.manager_count}</td><td className="p-3 tabular-nums">{item.student_count}</td><td className="p-3"><Badge variant={item.status === "active" ? "secondary" : item.status === "suspended" ? "destructive" : "outline"}>{item.status}</Badge></td><td className="p-3"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => onAnalytics(item.id)}>Analytics</Button>{item.status === "active" && <><Button size="sm" variant="outline" onClick={() => onStatus(item, "suspended")}>Suspend</Button><Button size="sm" variant="outline" onClick={() => onStatus(item, "closed")}>Close</Button></>}{item.status === "suspended" && <><Button size="sm" variant="outline" onClick={() => onStatus(item, "active")}><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore</Button><Button size="sm" variant="outline" onClick={() => onStatus(item, "closed")}>Close</Button></>}{item.status === "closed" && <Button size="sm" variant="outline" onClick={() => onStatus(item, "active")}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reopen</Button>}</div></td></tr>)}</tbody></table></div>;
}

function PeopleTable({ people, onStatus }: { people: Person[]; onStatus: (person: Person, status: string) => void }) {
  if (!people.length) return <EmptyState title="No network memberships found" detail="Try another school, role, or search term. The current filters do not match any network membership." />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[940px] text-left text-sm"><thead className="bg-slate-50"><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Person</th><th className="p-3">School</th><th className="p-3">Role</th><th className="p-3">Account</th><th className="p-3">Membership</th><th className="p-3 text-right">Membership actions</th></tr></thead><tbody className="divide-y divide-slate-100">{people.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="p-3"><p className="font-medium">{item.name}</p><p className="text-xs text-slate-500">@{item.username || "—"}</p></td><td className="p-3">{item.school_name}<p className="text-xs text-slate-500">{item.school_code}</p></td><td className="p-3 capitalize">{item.school_role}</td><td className="p-3"><Badge variant={item.account_status === "active" ? "secondary" : "destructive"}>{item.account_status || "unknown"}</Badge></td><td className="p-3"><Badge variant={item.membership_status === "active" ? "secondary" : item.membership_status === "suspended" ? "destructive" : "outline"}>{item.membership_status}</Badge></td><td className="p-3 text-right">{item.school_role === "admin" ? <span className="text-xs text-slate-400">Legacy Admin role — use School Manager leadership workflow</span> : staffRoles.has(item.school_role) ? <div className="flex justify-end gap-1">{item.membership_status === "active" && <><Button size="sm" variant="outline" onClick={() => onStatus(item, "suspended")}>Suspend</Button><Button size="sm" variant="outline" onClick={() => onStatus(item, "deactivated")}>Deactivate</Button></>}{item.membership_status === "suspended" && <><Button size="sm" variant="outline" onClick={() => onStatus(item, "active")}>Restore</Button><Button size="sm" variant="outline" onClick={() => onStatus(item, "deactivated")}>Deactivate</Button></>}{item.membership_status === "deactivated" && <Button size="sm" variant="outline" onClick={() => onStatus(item, "active")}>Reactivate</Button>}</div> : accessHoldRoles.has(item.school_role) && item.membership_status === "active" ? <Button size="sm" variant="outline" onClick={() => onStatus(item, "suspended")}>Suspend access</Button> : accessHoldRoles.has(item.school_role) && item.membership_status === "suspended" ? <Button size="sm" variant="outline" onClick={() => onStatus(item, "active")}>Restore access</Button> : <span className="text-xs text-slate-400">School-owned enrollment status</span>}</td></tr>)}</tbody></table></div>;
}

function AuditTable({ rows }: { rows: Audit[] }) {
  if (!rows.length) return <EmptyState title="No audit events on this page" detail="No recorded network changes match this page and filter." />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50"><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Time</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Details</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="whitespace-nowrap p-3 text-xs text-slate-500">{formatDate(row.created_at)}</td><td className="p-3">{row.actor_name || "System"}</td><td className="p-3 font-medium">{row.action}</td><td className="p-3">{row.target_type || "—"}</td><td className="max-w-[360px] whitespace-normal break-words p-3 text-xs text-slate-500">{JSON.stringify(row.metadata || {})}</td></tr>)}</tbody></table></div>;
}

function RecordTable({ title, description, headers, rows, empty }: { title: string; description: string; headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500">{headers.map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="p-2 align-top">{cell}</td>)}</tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-slate-500">{empty}</p>}</CardContent></Card>;
}

function Boundary({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">{title}</p><p className="mt-1 text-sm leading-relaxed text-slate-600">{detail}</p></div>;
}
