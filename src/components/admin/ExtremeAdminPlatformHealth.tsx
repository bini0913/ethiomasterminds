import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BellRing, CalendarClock, Database, HardDrive, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ServiceCheck = { status?: string; detail?: string; checked_at?: string; backup_count?: number; latest_backup_at?: string | null };
type Incident = {
  id: string; title: string; description: string; severity: string; status: string;
  affected_service: string; source: string; created_at: string; updated_at: string;
  resolved_at: string | null; resolution_note: string | null;
};
type MaintenanceWindow = {
  id: string; title: string; description: string; affected_services: string[];
  starts_at: string; ends_at: string; status: string;
};
type HealthReport = {
  generated_at: string;
  storage_buckets: Array<{ bucket_id: string; bucket_name: string; object_count: number; bytes_used: number }>;
  notification_delivery_24h: Array<{ kind: string; delivery_status: string; delivery_reason: string | null; events: number; attempted: number; accepted: number; failures: number }>;
  provider_failure_codes_24h: Array<{ code: string; failures: number }>;
  recent_snapshots: Array<{ id: number; checked_at: string; overall_status: string; checks: Record<string, ServiceCheck> }>;
  incidents: Incident[];
  incident_summary: { active: number; critical_active: number };
  maintenance_windows: MaintenanceWindow[];
};

const bytesLabel = (value: number) => {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / Math.pow(1024, index)).toFixed(index > 1 ? 2 : 1)} ${units[index]}`;
};
const numberLabel = (value: number) => Number(value || 0).toLocaleString();
const statusTone = (status?: string) => status === "healthy" || status === "resolved" || status === "completed"
  ? "bg-emerald-50 text-emerald-800"
  : status === "degraded" || status === "critical" || status === "high" || status === "open" || status === "investigating"
    ? "bg-amber-50 text-amber-800"
    : "bg-slate-100 text-slate-700";
const pretty = (value: string) => value.replace(/_/g, " ");

const ExtremeAdminPlatformHealth: React.FC = () => {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [checks, setChecks] = useState<Record<string, ServiceCheck> | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("medium");
  const [incidentService, setIncidentService] = useState("platform");
  const [incidentSaving, setIncidentSaving] = useState(false);
  const [incidentReasons, setIncidentReasons] = useState<Record<string, string>>({});
  const [incidentStatuses, setIncidentStatuses] = useState<Record<string, string>>({});
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");
  const [maintenanceServices, setMaintenanceServices] = useState("platform");
  const [maintenanceStart, setMaintenanceStart] = useState("");
  const [maintenanceEnd, setMaintenanceEnd] = useState("");
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceReasons, setMaintenanceReasons] = useState<Record<string, string>>({});
  const [maintenanceStatuses, setMaintenanceStatuses] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("extreme_admin_get_platform_health" as any);
    setLoading(false);
    if (error) {
      toast.error(error.message || "Platform health data could not be loaded");
      return;
    }
    setReport(data as HealthReport);
    const latest = (data as HealthReport)?.recent_snapshots?.[0];
    if (latest?.checks) setChecks(latest.checks);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runChecks = async () => {
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("extreme-admin-health-check", { body: {} });
    setChecking(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Platform health checks could not run");
      return;
    }
    setChecks(data.checks || data);
    await load();
    if (data.snapshot_recorded === false) toast.warning("Checks completed, but the history snapshot could not be saved.");
    else toast.success("Service checks completed and recorded.");
  };

  const createIncident = async () => {
    if (incidentTitle.trim().length < 3 || incidentDescription.trim().length < 3) return toast.error("Add an incident title and description.");
    setIncidentSaving(true);
    const { error } = await supabase.rpc("extreme_admin_create_platform_incident" as any, {
      p_title: incidentTitle.trim(), p_description: incidentDescription.trim(),
      p_severity: incidentSeverity, p_affected_service: incidentService.trim(),
    });
    setIncidentSaving(false);
    if (error) return toast.error(error.message || "Incident could not be recorded");
    setIncidentTitle(""); setIncidentDescription("");
    toast.success("Incident recorded in the platform audit trail.");
    await load();
  };

  const updateIncident = async (incident: Incident) => {
    const reason = incidentReasons[incident.id]?.trim();
    if (!reason) return toast.error("Add a reason for this incident update.");
    const nextStatus = incidentStatuses[incident.id] || incident.status;
    const { error } = await supabase.rpc("extreme_admin_update_platform_incident" as any, {
      p_incident_id: incident.id, p_status: nextStatus, p_reason: reason,
    });
    if (error) return toast.error(error.message || "Incident could not be updated");
    setIncidentReasons((current) => ({ ...current, [incident.id]: "" }));
    toast.success("Incident updated and audited.");
    await load();
  };

  const createMaintenance = async () => {
    if (maintenanceTitle.trim().length < 3 || maintenanceDescription.trim().length < 3 || !maintenanceStart || !maintenanceEnd) {
      return toast.error("Complete the maintenance details and time window.");
    }
    const start = new Date(maintenanceStart);
    const end = new Date(maintenanceEnd);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      return toast.error("Maintenance end must be later than its start.");
    }
    const services = [...new Set(maintenanceServices.split(",").map((value) => value.trim()).filter(Boolean))];
    setMaintenanceSaving(true);
    const { error } = await supabase.rpc("extreme_admin_create_maintenance_window" as any, {
      p_title: maintenanceTitle.trim(), p_description: maintenanceDescription.trim(),
      p_affected_services: services, p_starts_at: start.toISOString(), p_ends_at: end.toISOString(),
    });
    setMaintenanceSaving(false);
    if (error) return toast.error(error.message || "Maintenance window could not be saved");
    setMaintenanceTitle(""); setMaintenanceDescription(""); setMaintenanceStart(""); setMaintenanceEnd("");
    toast.success("Maintenance window scheduled and audited.");
    await load();
  };

  const updateMaintenance = async (window: MaintenanceWindow) => {
    const reason = maintenanceReasons[window.id]?.trim();
    if (!reason) return toast.error("Add a reason for this maintenance update.");
    const nextStatus = maintenanceStatuses[window.id] || window.status;
    const { error } = await supabase.rpc("extreme_admin_update_maintenance_window" as any, {
      p_window_id: window.id, p_status: nextStatus, p_reason: reason,
    });
    if (error) return toast.error(error.message || "Maintenance window could not be updated");
    setMaintenanceReasons((current) => ({ ...current, [window.id]: "" }));
    toast.success("Maintenance status updated and audited.");
    await load();
  };

  const storageTotal = useMemo(() => (report?.storage_buckets || []).reduce((sum, bucket) => sum + Number(bucket.bytes_used || 0), 0), [report]);
  const currentChecks = checks || report?.recent_snapshots?.[0]?.checks || {};
  const serviceRows = [
    ["Supabase database", currentChecks.database],
    ["Firebase Messaging", currentChecks.firebase_messaging],
    ["LiveKit", currentChecks.livekit],
    ["Supabase backups", currentChecks.backups],
  ] as Array<[string, ServiceCheck | undefined]>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-700">Part 3 · Platform assurance</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">System health & resilience</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Live connectivity checks, storage and notification diagnostics, incident history, and planned maintenance. Unavailable provider data is shown as unavailable—not guessed.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh data</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">Active incidents</p><p className="mt-1 text-2xl font-bold tabular-nums">{numberLabel(report?.incident_summary?.active || 0)}</p></CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">Critical incidents</p><p className="mt-1 text-2xl font-bold tabular-nums">{numberLabel(report?.incident_summary?.critical_active || 0)}</p></CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">Storage used · object metadata</p><p className="mt-1 text-2xl font-bold tabular-nums">{bytesLabel(storageTotal)}</p></CardContent></Card>
        <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">Health snapshots</p><p className="mt-1 text-2xl font-bold tabular-nums">{numberLabel(report?.recent_snapshots?.length || 0)}</p></CardContent></Card>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-blue-700" />External service checks</CardTitle><CardDescription>Checks database access, Firebase Messaging authorization and LiveKit RoomService. Backup inventory is checked only when a scoped Supabase Management API token is configured. No test push or call is sent.</CardDescription></div>
          <Button onClick={() => void runChecks()} disabled={checking}><RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />{checking ? "Checking…" : "Run health checks"}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {serviceRows.map(([label, check]) => <div key={label} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{label}</p><p className="mt-1 text-xs text-slate-500">{check?.detail || "No check has been recorded yet."}</p>{check?.backup_count !== undefined && <p className="mt-1 text-xs text-slate-500">Available backups: {numberLabel(check.backup_count)}{check.latest_backup_at ? ` · latest ${new Date(check.latest_backup_at).toLocaleString()}` : ""}</p>}</div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(check?.status)}`}>{check?.status || "not checked"}</span></div>)}
          <p className="text-[11px] text-slate-400">Latest snapshot: {report?.recent_snapshots?.[0]?.checked_at ? new Date(report.recent_snapshots[0].checked_at).toLocaleString() : "No saved health check yet"}</p>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><HardDrive className="h-4 w-4 text-blue-700" />Storage usage</CardTitle><CardDescription>Calculated from existing Storage object metadata. This is not the provider's billed GB-hour usage.</CardDescription></CardHeader>
          <CardContent className="space-y-3">{(report?.storage_buckets || []).map((bucket) => <div key={bucket.bucket_id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{bucket.bucket_name}</p><p className="text-sm font-semibold tabular-nums">{bytesLabel(Number(bucket.bytes_used || 0))}</p></div><p className="mt-1 text-xs text-slate-500">{numberLabel(Number(bucket.object_count || 0))} objects</p></div>)}{!report?.storage_buckets?.length && <p className="text-sm text-slate-500">No storage bucket data available.</p>}</CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-blue-700" />Notification delivery · last 24 hours</CardTitle><CardDescription>Aggregated from existing inbox delivery metadata; accepted sends do not guarantee device display.</CardDescription></CardHeader>
          <CardContent className="space-y-2">{(report?.notification_delivery_24h || []).map((item, index) => <div key={`${item.kind}-${item.delivery_status}-${index}`} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{pretty(item.kind)} · {pretty(item.delivery_status)}</p><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(item.delivery_status === "failed" ? "degraded" : item.delivery_status)}`}>{numberLabel(item.events)} events</span></div><p className="mt-1 text-xs text-slate-500">{numberLabel(item.accepted)} accepted / {numberLabel(item.attempted)} attempted · {numberLabel(item.failures)} failures{item.delivery_reason ? ` · ${pretty(item.delivery_reason)}` : ""}</p></div>)}{report?.provider_failure_codes_24h?.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Provider rejection codes · last 24 hours</p><p className="mt-1 text-xs text-amber-800">{report.provider_failure_codes_24h.map((item) => `${item.code} (${numberLabel(item.failures)})`).join(" · ")}</p></div> : null}{!report?.notification_delivery_24h?.length && <p className="text-sm text-slate-500">No notification delivery events in the last 24 hours.</p>}</CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-blue-700" />Incident register</CardTitle><CardDescription>Record operational incidents and keep every status change reasoned and auditable. Provider logs are not silently represented as incidents.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div className="space-y-1"><Label>Incident title</Label><Input value={incidentTitle} onChange={(event) => setIncidentTitle(event.target.value)} maxLength={180} placeholder="Short incident title" /></div>
            <div className="space-y-1"><Label>Affected service</Label><Input value={incidentService} onChange={(event) => setIncidentService(event.target.value)} maxLength={80} placeholder="e.g. Supabase, Firebase, LiveKit" /></div>
            <div className="space-y-1"><Label>Severity</Label><Select value={incidentSeverity} onValueChange={setIncidentSeverity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
            <div className="space-y-1 md:col-span-2"><Label>Description</Label><Textarea value={incidentDescription} onChange={(event) => setIncidentDescription(event.target.value)} rows={3} maxLength={4000} placeholder="Impact, observed behavior and evidence (do not include secrets or personal data)." /></div>
            <div className="md:col-span-2"><Button onClick={() => void createIncident()} disabled={incidentSaving}><Plus className="mr-2 h-4 w-4" />{incidentSaving ? "Recording…" : "Record incident"}</Button></div>
          </div>
          {(report?.incidents || []).map((incident) => <div key={incident.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{incident.title}</p><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(incident.severity)}`}>{incident.severity}</span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(incident.status)}`}>{pretty(incident.status)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{incident.description}</p><p className="mt-2 text-xs text-slate-400">{incident.affected_service} · {incident.source} · {new Date(incident.created_at).toLocaleString()}</p>{incident.status !== "resolved" && incident.status !== "closed" && <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_auto]"><Input value={incidentReasons[incident.id] || ""} onChange={(event) => setIncidentReasons((current) => ({ ...current, [incident.id]: event.target.value }))} placeholder="Required update reason" aria-label={`Incident update reason ${incident.id}`} /><Select value={incidentStatuses[incident.id] || incident.status} onValueChange={(value) => setIncidentStatuses((current) => ({ ...current, [incident.id]: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="investigating">Investigating</SelectItem><SelectItem value="monitoring">Monitoring</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select><Button size="sm" onClick={() => void updateIncident(incident)}>Save update</Button></div>}{incident.resolution_note && <p className="mt-2 text-xs text-slate-500">Latest note: {incident.resolution_note}</p>}</div>)}
          {!report?.incidents?.length && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No incidents have been recorded.</p>}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-blue-700" />Maintenance windows</CardTitle><CardDescription>Plan and track maintenance notices. Scheduling here does not automatically change infrastructure or take the platform offline.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div className="space-y-1"><Label>Maintenance title</Label><Input value={maintenanceTitle} onChange={(event) => setMaintenanceTitle(event.target.value)} maxLength={180} /></div>
            <div className="space-y-1"><Label>Affected services (comma-separated)</Label><Input value={maintenanceServices} onChange={(event) => setMaintenanceServices(event.target.value)} placeholder="platform, Supabase, Firebase" /></div>
            <div className="space-y-1"><Label>Starts</Label><Input type="datetime-local" value={maintenanceStart} onChange={(event) => setMaintenanceStart(event.target.value)} /></div>
            <div className="space-y-1"><Label>Ends</Label><Input type="datetime-local" value={maintenanceEnd} onChange={(event) => setMaintenanceEnd(event.target.value)} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Maintenance details</Label><Textarea value={maintenanceDescription} onChange={(event) => setMaintenanceDescription(event.target.value)} rows={2} maxLength={2000} /></div>
            <div className="md:col-span-2"><Button onClick={() => void createMaintenance()} disabled={maintenanceSaving}><Plus className="mr-2 h-4 w-4" />{maintenanceSaving ? "Scheduling…" : "Schedule maintenance"}</Button></div>
          </div>
          {(report?.maintenance_windows || []).map((window) => <div key={window.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-950">{window.title}</p><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(window.status)}`}>{pretty(window.status)}</span></div><p className="mt-1 text-sm text-slate-600">{window.description}</p><p className="mt-2 text-xs text-slate-400">{window.affected_services.join(", ")} · {new Date(window.starts_at).toLocaleString()} – {new Date(window.ends_at).toLocaleString()}</p>{window.status !== "completed" && window.status !== "cancelled" && <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_auto]"><Input value={maintenanceReasons[window.id] || ""} onChange={(event) => setMaintenanceReasons((current) => ({ ...current, [window.id]: event.target.value }))} placeholder="Required update reason" aria-label={`Maintenance update reason ${window.id}`} /><Select value={maintenanceStatuses[window.id] || window.status} onValueChange={(value) => setMaintenanceStatuses((current) => ({ ...current, [window.id]: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select><Button size="sm" onClick={() => void updateMaintenance(window)}>Save update</Button></div>}</div>)}
          {!report?.maintenance_windows?.length && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No maintenance windows are scheduled.</p>}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-blue-700" />Health history</CardTitle><CardDescription>Saved results from explicit server-side checks. A snapshot is not continuous uptime monitoring.</CardDescription></CardHeader>
        <CardContent className="space-y-2">{(report?.recent_snapshots || []).map((snapshot) => <div key={snapshot.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-900">{new Date(snapshot.checked_at).toLocaleString()}</p><p className="text-xs text-slate-500">{Object.entries(snapshot.checks || {}).map(([key, value]) => `${pretty(key)}: ${value.status || "unknown"}`).join(" · ")}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(snapshot.overall_status)}`}>{snapshot.overall_status}</span></div>)}{!report?.recent_snapshots?.length && <p className="text-sm text-slate-500">No health snapshots have been saved.</p>}</CardContent>
      </Card>
      {loading && <p className="text-xs text-slate-400">Refreshing platform operations data…</p>}
    </div>
  );
};

export default ExtremeAdminPlatformHealth;
