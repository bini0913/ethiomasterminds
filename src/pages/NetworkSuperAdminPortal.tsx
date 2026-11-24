import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Building2, CheckCircle2, DollarSign, FileClock, Loader2, Plus, RefreshCw, Search, Settings2, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type School = { id: string; name: string; school_code: string; status: string; created_at: string; manager_count: number; student_count: number };
type Person = { id: string; name: string; username: string | null; school_id: string; school_name: string; school_code: string; school_role: string; membership_status: string; account_status: string; created_at: string };
type Audit = { id: string; actor_name: string | null; action: string; target_type: string | null; target_id: string | null; metadata: Record<string, unknown>; created_at: string };
type Alert = { kind: string; severity: string; title: string; detail: string; school_id: string; created_at: string };
type JsonRecord = Record<string, number | string | null | undefined>;
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

export default function NetworkSuperAdminPortal() {
  const { user } = useUser();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<JsonRecord>({});
  const [schools, setSchools] = useState<School[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [finance, setFinance] = useState<JsonRecord>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [analytics, setAnalytics] = useState<JsonRecord>({});
  const [selectedSchool, setSelectedSchool] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(0);
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [managerName, setManagerName] = useState("");
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [networkName, setNetworkName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
    const [summary, directory, financeRes, settings, alertsRes] = await Promise.all([
      rpc("super_admin_get_network_dashboard"),
      rpc("super_admin_list_network_schools", { p_search: search.trim() || null, p_limit: 100, p_offset: 0 }),
      rpc("super_admin_get_network_finance"),
      rpc("super_admin_get_network_settings"),
      rpc("super_admin_get_network_alerts"),
    ]);
    const error = summary.error || directory.error || financeRes.error || settings.error || alertsRes.error;
    if (error) toast.error(error.message || "Unable to load network operations");
    else {
      setDashboard((summary.data || {}) as JsonRecord);
      setSchools((directory.data || []) as School[]);
      setFinance((financeRes.data || {}) as JsonRecord);
      setAlerts((alertsRes.data || []) as Alert[]);
      const setting = (settings.data || [])[0];
      if (setting) { setNetworkName(setting.name || ""); }
    }
    } catch (error: unknown) {
      console.error("[Master Minds] NetworkSuperAdminPortal.tsx data load failed", error);
      toast.error(error instanceof Error ? error.message : "This workspace could not load its records. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadPeople = useCallback(async () => {
    const response = await rpc("super_admin_list_network_people", {
      p_school_id: selectedSchool || null, p_role: role === "all" ? null : role,
      p_search: search.trim() || null, p_limit: 50, p_offset: page * 50,
    });
    if (response.error) toast.error(response.error.message); else setPeople((response.data || []) as Person[]);
  }, [page, role, search, selectedSchool]);

  const loadAudit = useCallback(async () => {
    const response = await rpc("super_admin_get_network_audit_logs", { p_limit: 100, p_offset: 0 });
    if (response.error) toast.error(response.error.message); else setAudit((response.data || []) as Audit[]);
  }, []);

  useEffect(() => { if (user?.role === "super_admin") void loadCore(); }, [loadCore, user?.role]);
  useEffect(() => { if (user?.role === "super_admin" && tab === "people") void loadPeople(); }, [loadPeople, tab, user?.role]);
  useEffect(() => { if (user?.role === "super_admin" && tab === "audit") void loadAudit(); }, [loadAudit, tab, user?.role]);
  useEffect(() => { if (!selectedSchool && schools[0]) setSelectedSchool(schools[0].id); }, [schools, selectedSchool]);

  const school = useMemo(() => schools.find((item) => item.id === selectedSchool), [schools, selectedSchool]);
  const loadAnalytics = async (schoolId: string) => {
    setSelectedSchool(schoolId);
    const response = await rpc("super_admin_get_school_analytics", { p_school_id: schoolId });
    if (response.error) toast.error(response.error.message); else setAnalytics((response.data || {}) as JsonRecord);
  };

  const registerSchool = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setCredentials(null);
    const response = await supabase.functions.invoke("school-provision-account", { body: { action: "create_school", school: { name: schoolName.trim(), school_code: schoolCode.trim().toUpperCase() }, manager: { name: managerName.trim() } } });
    setSaving(false);
    if (response.error || response.data?.error) { toast.error(response.data?.error || response.error?.message || "School registration failed"); return; }
    setCredentials({ username: response.data.manager.username, password: response.data.manager.initial_password });
    setSchoolName(""); setSchoolCode(""); setManagerName(""); toast.success("School registered and Manager provisioned"); await loadCore();
  };

  const createManager = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selectedSchool) return toast.error("Choose a school first"); setSaving(true);
    const response = await supabase.functions.invoke("school-provision-account", { body: { action: "create_accounts", school_id: selectedSchool, role: "manager", accounts: [{ name: managerName.trim() }] } });
    setSaving(false);
    if (response.error || response.data?.error || !response.data?.created?.length) { toast.error(response.data?.error || response.data?.failed?.[0]?.message || "Manager provisioning failed"); return; }
    setCredentials({ username: response.data.created[0].username, password: response.data.created[0].initial_password }); setManagerName(""); toast.success("School Manager account provisioned"); await loadCore();
  };

  const setMembershipStatus = async (person: Person, status: string) => {
    const response = await rpc("super_admin_set_school_membership_status", { p_membership_id: person.id, p_status: status, p_reason: "Super Admin network operations" });
    if (response.error) toast.error(response.error.message); else { toast.success(`Membership ${status}`); await loadPeople(); }
  };

  const saveNetworkName = async (event: React.FormEvent) => {
    event.preventDefault(); const response = await rpc("super_admin_update_network_name", { p_name: networkName });
    if (response.error) toast.error(response.error.message); else { toast.success("Network settings saved"); await loadCore(); }
  };

  if (user?.role !== "super_admin") return null;
  return <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2 text-blue-700"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-wider">Super Admin</span></div><h1 className="mt-1 text-3xl font-bold text-slate-950">{String(dashboard.network_name || "School Network")}</h1><p className="mt-1 text-slate-600">Network operations, school oversight, and onboarding.</p></div><Button variant="outline" onClick={() => void loadCore()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></header>
    <Tabs value={tab} onValueChange={(next) => { setTab(next); setPage(0); }}><TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7"><TabsTrigger value="overview"><Activity className="mr-2 h-4 w-4" />Overview</TabsTrigger><TabsTrigger value="schools"><Building2 className="mr-2 h-4 w-4" />Schools</TabsTrigger><TabsTrigger value="people"><Users className="mr-2 h-4 w-4" />People</TabsTrigger><TabsTrigger value="analytics"><BarChart3 className="mr-2 h-4 w-4" />Analytics</TabsTrigger><TabsTrigger value="finance"><DollarSign className="mr-2 h-4 w-4" />Finance</TabsTrigger><TabsTrigger value="audit"><FileClock className="mr-2 h-4 w-4" />Audit</TabsTrigger><TabsTrigger value="settings"><Settings2 className="mr-2 h-4 w-4" />Settings</TabsTrigger></TabsList>
      <TabsContent value="overview" className="space-y-6"><MetricGrid items={[["Schools", dashboard.schools], ["Active schools", dashboard.active_schools], ["Managers", dashboard.managers], ["Students", dashboard.enrolled_students]]} />{alerts.length > 0 && <Card><CardHeader><CardTitle>Operational alerts</CardTitle><CardDescription>Live items requiring network attention.</CardDescription></CardHeader><CardContent className="space-y-3">{alerts.map((alert) => <div key={`${alert.kind}-${alert.school_id}-${alert.created_at}`} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium">{alert.title}</p><Badge variant={alert.severity === "warning" ? "destructive" : "secondary"}>{alert.severity}</Badge></div><p className="mt-1 text-sm text-slate-600">{alert.detail}</p></div>)}</CardContent></Card>}<Card><CardHeader><CardTitle>Network school comparison</CardTitle><CardDescription>Counts are derived from active school memberships.</CardDescription></CardHeader><CardContent><SchoolTable schools={schools} onAnalytics={(id) => { setTab("analytics"); void loadAnalytics(id); }} onStatus={async (s, status) => { const r = await rpc("super_admin_set_school_status", { p_school_id: s.id, p_status: status, p_reason: "Super Admin network operations" }); if (r.error) toast.error(r.error.message); else { toast.success(`School ${status}`); await loadCore(); } }} /></CardContent></Card></TabsContent>
      <TabsContent value="schools" className="grid gap-6 lg:grid-cols-[380px_1fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Register school</CardTitle><CardDescription>Creates a school in this network and provisions its initial Manager through the secure account service.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={registerSchool}><Input placeholder="School name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required minLength={2} maxLength={160} /><Input placeholder="Unique code" value={schoolCode} onChange={(e) => setSchoolCode(e.target.value.toUpperCase())} required pattern="[A-Z0-9]{2,8}" /><Input placeholder="Initial Manager name" value={managerName} onChange={(e) => setManagerName(e.target.value)} required minLength={2} /><Button className="w-full" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Register and provision</Button></form>{credentials && <CredentialBox credentials={credentials} />}</CardContent></Card><Card><CardHeader><CardTitle>School configuration and status</CardTitle><CardDescription>Search, compare, inspect analytics, and suspend or restore school access.</CardDescription></CardHeader><CardContent><SchoolTable schools={schools} onAnalytics={(id) => { setTab("analytics"); void loadAnalytics(id); }} onStatus={async (s, status) => { const r = await rpc("super_admin_set_school_status", { p_school_id: s.id, p_status: status, p_reason: "Super Admin network operations" }); if (r.error) toast.error(r.error.message); else { toast.success(`School ${status}`); await loadCore(); } }} /></CardContent></Card></TabsContent>
      <TabsContent value="people" className="space-y-4"><Card><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle>Network people and staff</CardTitle><CardDescription>Only users with a membership in this network are returned.</CardDescription></div><div className="flex flex-wrap gap-2"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search people or school" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></div><Select value={role} onValueChange={(v) => { setRole(v); setPage(0); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="manager">Managers</SelectItem><SelectItem value="admin">Admins</SelectItem><SelectItem value="teacher">Teachers</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="parent">Parents</SelectItem><SelectItem value="student">Students</SelectItem></SelectContent></Select></div></div></CardHeader><CardContent><div className="mb-3 flex flex-wrap gap-2"><Button size="sm" variant={selectedSchool ? "outline" : "secondary"} onClick={() => { setSelectedSchool(""); setPage(0); }}>All schools</Button>{schools.map((item) => <Button key={item.id} size="sm" variant={selectedSchool === item.id ? "secondary" : "outline"} onClick={() => { setSelectedSchool(item.id); setPage(0); }}>{item.school_code}</Button>)}</div><PeopleTable people={people} onStatus={setMembershipStatus} /><div className="mt-4 flex justify-end gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={people.length < 50} onClick={() => setPage((p) => p + 1)}>Next</Button></div></CardContent></Card></TabsContent>
      <TabsContent value="analytics" className="space-y-4"><Card><CardHeader><CardTitle>School performance and academic analytics</CardTitle><CardDescription>Scores, attendance, results, behavior, enrollment, and finance are read from school records.</CardDescription></CardHeader><CardContent><Select value={selectedSchool} onValueChange={(id) => void loadAnalytics(id)}><SelectTrigger className="max-w-md"><SelectValue placeholder="Choose a school" /></SelectTrigger><SelectContent>{schools.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.school_code}</SelectItem>)}</SelectContent></Select>{school && <p className="mt-3 text-sm text-slate-500">Showing: {school.name}</p>}</CardContent></Card><MetricGrid items={[["Students", analytics.students], ["Teachers", analytics.teachers], ["Average score", analytics.average_score], ["Attendance rate %", analytics.attendance_rate], ["Published results", analytics.published_results], ["Pending behavior", analytics.pending_behavior_reports], ["Outstanding balance", analytics.outstanding_balance], ["Invoices", analytics.invoice_count]]} /></TabsContent>
      <TabsContent value="finance" className="space-y-4"><MetricGrid items={[["Invoices", finance.invoice_count], ["Invoiced amount", finance.invoiced_amount], ["Paid amount", finance.paid_amount], ["Outstanding balance", finance.outstanding_balance], ["Confirmed payments", finance.confirmed_payments], ["Pending follow-ups", finance.pending_followups]]} /><Card><CardHeader><CardTitle>Financial oversight</CardTitle><CardDescription>Network totals from school invoices, payments, and finance follow-ups. Payment mutations remain with school Finance workflows.</CardDescription></CardHeader></Card></TabsContent>
      <TabsContent value="audit"><Card><CardHeader><CardTitle>Network audit history</CardTitle><CardDescription>Administrative changes affecting this network and its schools.</CardDescription></CardHeader><CardContent><AuditTable rows={audit} /></CardContent></Card></TabsContent>
      <TabsContent value="settings" className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Network configuration</CardTitle><CardDescription>Changes are protected by the Super Admin RPC and written to the audit log.</CardDescription></CardHeader><CardContent><form className="flex gap-2" onSubmit={saveNetworkName}><Input value={networkName} onChange={(e) => setNetworkName(e.target.value)} minLength={2} maxLength={160} required /><Button>Save</Button></form></CardContent></Card><Card><CardHeader><CardTitle>School Manager onboarding</CardTitle><CardDescription>Only the network Super Admin can provision School Managers for an existing active school. Other school roles are appointed inside the school.</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={createManager}><Select value={selectedSchool} onValueChange={setSelectedSchool}><SelectTrigger><SelectValue placeholder="Choose school" /></SelectTrigger><SelectContent>{schools.filter((item) => item.status === "active").map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.school_code}</SelectItem>)}</SelectContent></Select><Input placeholder="Full name" value={managerName} onChange={(e) => setManagerName(e.target.value)} required minLength={2} /><Button disabled={saving}>Provision Manager</Button></form>{credentials && <CredentialBox credentials={credentials} />}</CardContent></Card></TabsContent>
    </Tabs>
  </div></main>;
}

function MetricGrid({ items }: { items: Array<[string, unknown]> }) { return <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{items.map(([label, metric]) => <Card key={label}><CardContent className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{metric == null ? "—" : String(metric)}</p></CardContent></Card>)}</section>; }
function CredentialBox({ credentials }: { credentials: { username: string; password: string } }) { return <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />One-time credentials</div><p className="mt-2">Username: <strong>{credentials.username}</strong></p><p>Password: <strong>{credentials.password}</strong></p><p className="mt-2 text-xs">The Manager must change the password at first sign-in.</p></div>; }
function SchoolTable({ schools, onAnalytics, onStatus }: { schools: School[]; onAnalytics: (id: string) => void; onStatus: (school: School, status: string) => void }) { return schools.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">School</th><th className="p-2">Code</th><th className="p-2">Managers</th><th className="p-2">Students</th><th className="p-2">Status</th><th className="p-2 text-right">Actions</th></tr></thead><tbody className="divide-y">{schools.map((item) => <tr key={item.id}><td className="p-2 font-medium">{item.name}</td><td className="p-2 font-mono">{item.school_code}</td><td className="p-2">{item.manager_count}</td><td className="p-2">{item.student_count}</td><td className="p-2"><Badge variant={item.status === "active" ? "secondary" : "destructive"}>{item.status}</Badge></td><td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={() => onAnalytics(item.id)}>Analytics</Button>{item.status === "active" ? <Button size="sm" variant="outline" onClick={() => onStatus(item, "suspended")}>Suspend</Button> : <Button size="sm" variant="outline" onClick={() => onStatus(item, "active")}>Restore</Button>}</td></tr>)}</tbody></table></div> : <p className="py-10 text-center text-slate-500">No schools match the current network.</p>; }
function PeopleTable({ people, onStatus }: { people: Person[]; onStatus: (person: Person, status: string) => void }) { return people.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">Person</th><th className="p-2">School</th><th className="p-2">Role</th><th className="p-2">Status</th><th className="p-2 text-right">Actions</th></tr></thead><tbody className="divide-y">{people.map((item) => <tr key={item.id}><td className="p-2"><p className="font-medium">{item.name}</p><p className="text-xs text-slate-500">@{item.username || "—"}</p></td><td className="p-2">{item.school_name} · {item.school_code}</td><td className="p-2 capitalize">{item.school_role}</td><td className="p-2"><Badge variant={item.membership_status === "active" ? "secondary" : "destructive"}>{item.membership_status}</Badge></td><td className="p-2 text-right">{item.membership_status === "active" ? <Button size="sm" variant="outline" onClick={() => onStatus(item, "suspended")}>Suspend membership</Button> : <Button size="sm" variant="outline" onClick={() => onStatus(item, "active")}>Restore membership</Button>}</td></tr>)}</tbody></table></div> : <p className="py-10 text-center text-slate-500">No network members match the current filters.</p>; }
function AuditTable({ rows }: { rows: Audit[] }) { return rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">Time</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Target</th><th className="p-2">Details</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id}><td className="p-2 text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</td><td className="p-2">{row.actor_name || "System"}</td><td className="p-2 font-medium">{row.action}</td><td className="p-2">{row.target_type || "—"}</td><td className="max-w-[320px] truncate p-2 text-xs text-slate-500">{JSON.stringify(row.metadata || {})}</td></tr>)}</tbody></table></div> : <p className="py-10 text-center text-slate-500">No network audit events found.</p>; }
