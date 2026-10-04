import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bell, CheckCircle2, ChevronRight, MessageSquare, RefreshCw, Search, Shield, ShieldCheck, UserCog, Users, XCircle } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/ui/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ManagerUser = { id: string; name: string; username: string | null; grade: string | null; xp: number; level: number; role: string; account_status: string; created_at: string; };
type Report = { id: string; reason: string; description: string | null; status: string; reporter_id: string; reported_id: string; created_at: string; };

const ManagerControlCenter: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<ManagerUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard, people, reportRows] = await Promise.all([
        supabase.rpc("manager_get_dashboard" as any),
        supabase.rpc("manager_list_users" as any, { p_search: search.trim() || null, p_role: null, p_limit: 150, p_offset: 0 }),
        supabase.from("reports").select("id,reason,description,status,reporter_id,reported_id,created_at").order("created_at", { ascending: false }).limit(80),
      ]);
      if (dashboard.error) throw dashboard.error;
      if (people.error) throw people.error;
      setStats((dashboard.data as Record<string, number>) || {});
      setUsers((people.data as ManagerUser[]) || []);
      setReports((reportRows.data as Report[]) || []);
    } catch (error: any) {
      toast.error(error.message || "Unable to load manager controls");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const studentCount = useMemo(() => users.filter((u) => u.role === "student").length, [users]);
  const teacherCount = useMemo(() => users.filter((u) => u.role === "teacher").length, [users]);
  const pendingReports = useMemo(() => reports.filter((r) => r.status === "pending").length, [reports]);

  const moderateStudent = async (id: string, status: "active" | "suspended" | "banned") => {
    const { error } = await supabase.rpc("manager_set_student_status" as any, { p_user_id: id, p_status: status, p_reason: "Manager moderation action" });
    if (error) return toast.error(error.message || "Action failed");
    toast.success("Student marked " + status);
    load();
  };

  const resolveReport = async (id: string, status: "resolved" | "dismissed") => {
    const { error } = await supabase.from("reports").update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message || "Could not update report");
    toast.success("Report " + status);
    load();
  };

  const sendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim() || !user?.id) {
      toast.error("Add a title and message first");
      return;
    }
    const { error } = await supabase.from("announcements").insert({ author_id: user.id, title: announcementTitle.trim(), content: announcementBody.trim(), target_type: "global", target_id: null });
    if (error) return toast.error(error.message || "Announcement failed");
    toast.success("Announcement published");
    setAnnouncementTitle(""); setAnnouncementBody("");
  };

  const statCards = [
    ["Students", stats.total_students ?? studentCount, Users],
    ["Teachers", stats.total_teachers ?? teacherCount, UserCog],
    ["Active now", stats.active_users_10m ?? 0, Activity],
    ["Reports", stats.pending_reports ?? pendingReports, AlertTriangle],
    ["Messages", stats.total_messages ?? 0, MessageSquare],
    ["Groups", stats.total_groups ?? 0, Users],
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Operations</p>
              <h1 className="text-2xl font-bold tracking-tight">Manager Control Center</h1>
              <p className="text-sm text-muted-foreground">Run day-to-day platform operations without Super Admin powers.</p>
            </div>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 " + (loading ? "animate-spin" : "")} />Refresh</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {statCards.map(([label, value, Icon]) => (
            <Card key={label} className="border-border/70 bg-card/80">
              <CardContent className="p-4"><Icon className="mb-3 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="people" className="mt-5">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-4">
            <TabsTrigger value="people">People</TabsTrigger><TabsTrigger value="moderation">Moderation</TabsTrigger><TabsTrigger value="broadcast">Broadcast</TabsTrigger><TabsTrigger value="tools">Tools</TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Students & Teachers</CardTitle>
                <CardDescription>Search users and manage student account status. Private conversations are not exposed to managers.</CardDescription>
                <div className="relative pt-2"><Search className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or username..." /></div>
              </CardHeader>
              <CardContent className="space-y-2">
                {users.map((person) => (
                  <div key={person.id} className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{person.name}</span><Badge variant="secondary">{person.role}</Badge><Badge variant={person.account_status === "active" ? "outline" : "destructive"}>{person.account_status}</Badge></div>
                      <p className="truncate text-xs text-muted-foreground">@{person.username || "unknown"} · {person.grade || "No grade"} · Level {person.level} · {person.xp} XP</p>
                    </div>
                    {person.role === "student" && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => moderateStudent(person.id, "active")}><CheckCircle2 className="mr-1 h-4 w-4" />Active</Button><Button size="sm" variant="outline" onClick={() => moderateStudent(person.id, "suspended")}>Suspend</Button><Button size="sm" variant="destructive" onClick={() => moderateStudent(person.id, "banned")}>Ban</Button></div>}
                  </div>
                ))}
                {!users.length && <p className="py-8 text-center text-sm text-muted-foreground">No users found.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="moderation" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Moderation Queue</CardTitle><CardDescription>Review reported content and keep the community healthy.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge>{report.status}</Badge><span className="font-medium">{report.reason}</span></div><span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString()}</span></div>
                    {report.description && <p className="mt-2 text-sm text-muted-foreground">{report.description}</p>}
                    {report.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => resolveReport(report.id, "resolved")}><CheckCircle2 className="mr-1 h-4 w-4" />Resolve</Button><Button size="sm" variant="outline" onClick={() => resolveReport(report.id, "dismissed")}><XCircle className="mr-1 h-4 w-4" />Dismiss</Button></div>}
                  </div>
                ))}
                {!reports.length && <div className="py-10 text-center text-sm text-muted-foreground">No moderation reports.</div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="broadcast" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Platform Announcement</CardTitle><CardDescription>Publish an operational announcement to the platform.</CardDescription></CardHeader>
              <CardContent className="space-y-3"><Input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} placeholder="Announcement title" /><Textarea value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} placeholder="Write the message..." rows={6} /><Button onClick={sendAnnouncement}><Bell className="mr-2 h-4 w-4" />Publish announcement</Button></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="mt-4 grid gap-4 md:grid-cols-2">
            <Card className="cursor-pointer transition hover:border-primary/50" onClick={() => navigate("/manager-dashboard")}><CardHeader><CardTitle className="flex items-center justify-between">Advanced Manager Tools <ChevronRight className="h-5 w-5" /></CardTitle><CardDescription>Tournament controls, resources, analytics and existing manager operations.</CardDescription></CardHeader></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Role boundary</CardTitle><CardDescription>Managers can operate the platform, but cannot assign Super Admin/Admin roles or inspect private chats.</CardDescription></CardHeader></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ManagerControlCenter;
