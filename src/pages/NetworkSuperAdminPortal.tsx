import React, { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type School = { id: string; name: string; school_code: string; status: string; created_at: string; manager_count: number; student_count: number };
type Dashboard = { network_name?: string; schools?: number; active_schools?: number; suspended_schools?: number; closed_schools?: number; managers?: number; enrolled_students?: number };

export default function NetworkSuperAdminPortal() {
  const { user } = useUser();
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [schools, setSchools] = useState<School[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [managerName, setManagerName] = useState("");
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [summary, directory] = await Promise.all([
      supabase.rpc("super_admin_get_network_dashboard" as any),
      supabase.rpc("super_admin_list_network_schools" as any, { p_search: search.trim() || null, p_limit: 100, p_offset: 0 }),
    ]);
    if (summary.error || directory.error) toast.error(summary.error?.message || directory.error?.message || "Unable to load school network");
    else { setDashboard((summary.data || {}) as Dashboard); setSchools((directory.data || []) as School[]); }
    setLoading(false);
  }, [search]);

  useEffect(() => { if (user?.role === "super_admin") void load(); }, [load, user?.role]);

  const registerSchool = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setCredentials(null);
    const { data, error } = await supabase.functions.invoke("school-provision-account", { body: {
      action: "create_school",
      school: { name: name.trim(), school_code: code.trim().toUpperCase() },
      manager: { name: managerName.trim() },
    }});
    setSaving(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "School registration failed"); return; }
    setCredentials({ username: data.manager.username, password: data.manager.initial_password });
    setName(""); setCode(""); setManagerName("");
    toast.success("School registered and initial Manager provisioned");
    await load();
  };

  const setStatus = async (school: School, status: string) => {
    const { error } = await supabase.rpc("super_admin_set_school_status" as any, { p_school_id: school.id, p_status: status });
    if (error) toast.error(error.message); else { toast.success(`School ${status}`); await load(); }
  };

  if (user?.role !== "super_admin") return null;
  return <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><div className="flex items-center gap-2 text-blue-700"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold uppercase tracking-wider">Super Admin</span></div><h1 className="mt-1 text-3xl font-bold text-slate-950">{dashboard.network_name || "School Network"}</h1><p className="mt-1 text-slate-600">Manage the school network without accessing Extreme Admin controls.</p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[
        ["Schools", dashboard.schools], ["Active", dashboard.active_schools], ["Suspended", dashboard.suspended_schools], ["Managers", dashboard.managers], ["Students", dashboard.enrolled_students],
      ].map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value ?? "—"}</p></CardContent></Card>)}</section>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Register school</CardTitle><CardDescription>Creates the school and securely provisions one initial Manager account.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={registerSchool}><Input placeholder="School name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={160} /><Input placeholder="Unique code (2–8 letters/numbers)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} required pattern="[A-Z0-9]{2,8}" /><Input placeholder="Initial Manager full name" value={managerName} onChange={e => setManagerName(e.target.value)} required minLength={2} maxLength={160} /><Button className="w-full" disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{saving ? "Provisioning…" : "Register school"}</Button></form>{credentials && <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Save these one-time credentials</div><p className="mt-2">Username: <strong>{credentials.username}</strong></p><p>Password: <strong>{credentials.password}</strong></p><p className="mt-2 text-xs">The Manager must change the password on first sign-in.</p></div>}</CardContent></Card>
        <Card><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle>School directory</CardTitle><CardDescription>Only schools in the current Master Minds network are shown.</CardDescription></div><Input className="md:max-w-xs" placeholder="Search schools or code" value={search} onChange={e => setSearch(e.target.value)} /></div></CardHeader><CardContent>{loading ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div> : schools.length === 0 ? <p className="py-12 text-center text-slate-500">No schools match this search.</p> : <div className="space-y-3">{schools.map(school => <div key={school.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><div className="rounded-lg bg-blue-50 p-2 text-blue-700"><Building2 className="h-5 w-5" /></div><div><p className="font-semibold text-slate-950">{school.name}</p><p className="text-sm text-slate-500">{school.school_code} · Registered {new Date(school.created_at).toLocaleDateString()}</p><div className="mt-2 flex gap-2"><Badge variant={school.status === "active" ? "secondary" : "destructive"}>{school.status}</Badge><span className="flex items-center gap-1 text-xs text-slate-500"><Users className="h-3 w-3" />{school.manager_count} managers · {school.student_count} students</span></div></div></div><div className="flex gap-2">{school.status !== "active" && <Button size="sm" variant="outline" onClick={() => void setStatus(school, "active")}>Reactivate</Button>}{school.status === "active" && <Button size="sm" variant="outline" onClick={() => void setStatus(school, "suspended")}>Suspend</Button>}</div></div>)}</div>}</CardContent></Card>
      </div>
    </div>
  </main>;
}
