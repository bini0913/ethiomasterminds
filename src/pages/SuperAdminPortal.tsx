import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Coins, Eye, Lock, MessageSquare, RefreshCw, Search, Settings2, Shield, Trash2, UserCog, Users } from "lucide-react";
import { useUser, UserRole } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/ui/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type RootUser = { id:string; name:string; username:string|null; grade:string|null; xp:number; level:number; role:UserRole; account_status:string; coins:number; created_at:string; };
type ChatRow = { id:string; channel:string; sender_id:string; sender_name:string|null; receiver_id:string|null; receiver_name:string|null; content:string; created_at:string; metadata:Record<string, unknown>; };
type AuditRow = { id:string; actor_id:string; actor_name:string|null; action:string; target_type:string|null; target_id:string|null; metadata:Record<string,unknown>; created_at:string; };

const SuperAdminPortal: React.FC = () => {
  const { user } = useUser();
  const [loading,setLoading]=useState(true);
  const [stats,setStats]=useState<Record<string,number>>({});
  const [users,setUsers]=useState<RootUser[]>([]);
  const [chats,setChats]=useState<ChatRow[]>([]);
  const [logs,setLogs]=useState<AuditRow[]>([]);
  const [userSearch,setUserSearch]=useState("");
  const [chatSearch,setChatSearch]=useState("");
  const [targetUser,setTargetUser]=useState<RootUser|null>(null);
  const [role,setRole]=useState<UserRole>("student");
  const [status,setStatus]=useState("active");
  const [xpDelta,setXpDelta]=useState("0");
  const [coinDelta,setCoinDelta]=useState("0");
  const [settings,setSettings]=useState<Record<string,boolean>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard,userRows,logRows,settingRows] = await Promise.all([
        supabase.rpc("extreme_admin_get_dashboard" as any),
        supabase.rpc("extreme_admin_list_users" as any,{p_search:userSearch.trim()||null,p_role:null,p_limit:300,p_offset:0}),
        supabase.rpc("extreme_admin_get_audit_logs" as any,{p_limit:120}),
        supabase.rpc("extreme_admin_get_settings" as any),
      ]);
      if(dashboard.error) throw dashboard.error;
      if(userRows.error) throw userRows.error;
      if(logRows.error) throw logRows.error;
      if(settingRows.error) throw settingRows.error;
      setStats((dashboard.data as Record<string,number>)||{});
      setUsers((userRows.data as RootUser[])||[]);
      setLogs((logRows.data as AuditRow[])||[]);
      setSettings(((settingRows.data||[]) as Array<{setting_key:string;setting_value:boolean}>).reduce<Record<string,boolean>>((acc,row)=>{acc[row.setting_key]=row.setting_value===true;return acc;},{}));
    } catch(error:any) {
      toast.error(error.message||"Unable to load Super Admin controls");
    } finally { setLoading(false); }
  },[userSearch]);

  useEffect(()=>{ if(user?.role==="extreme_admin") refresh(); },[refresh,user?.role]);

  const loadChats = async () => {
    const {data,error}=await supabase.rpc("extreme_admin_get_chat_archive" as any,{p_search:chatSearch.trim()||null,p_limit:300,p_offset:0});
    if(error) return toast.error(error.message||"Unable to load chat archive");
    setChats((data as ChatRow[])||[]);
  };

  const chooseUser=(person:RootUser)=>{setTargetUser(person);setRole(person.role);setStatus(person.account_status);};

  const updateRole=async()=>{
    if(!targetUser) return;
    const {error}=await supabase.rpc("extreme_admin_update_user_role" as any,{p_user_id:targetUser.id,p_role:role});
    if(error) return toast.error(error.message||"Role update failed");
    toast.success("Role updated"); refresh();
  };

  const updateStatus=async()=>{
    if(!targetUser) return;
    if(status!=="active" && !window.confirm("This changes account access. Continue?")) return;
    const {error}=await supabase.rpc("extreme_admin_set_user_status" as any,{p_user_id:targetUser.id,p_status:status,p_reason:"Super Admin control center"});
    if(error) return toast.error(error.message||"Status update failed");
    toast.success("Account status updated"); refresh();
  };

  const adjustEconomy=async(reset=false)=>{
    if(!targetUser) return;
    if(reset && !window.confirm("Reset this user's XP, season XP, coins and gems?")) return;
    const {error}=await supabase.rpc("extreme_admin_adjust_economy" as any,{p_user_id:targetUser.id,p_xp_delta:Number(xpDelta)||0,p_coin_delta:Number(coinDelta)||0,p_reset_progress:reset});
    if(error) return toast.error(error.message||"Economy update failed");
    toast.success(reset?"Progress reset":"Economy updated"); refresh();
  };

  const deleteMessage=async(id:string)=>{
    if(!window.confirm("Delete this direct message permanently?")) return;
    const {error}=await supabase.rpc("extreme_admin_delete_message" as any,{p_message_id:id});
    if(error) return toast.error(error.message||"Message deletion failed");
    toast.success("Message deleted"); loadChats();
  };

  const toggleSetting=async(key:string,value:boolean)=>{
    const {error}=await supabase.rpc("extreme_admin_set_setting" as any,{p_key:key,p_value:value});
    if(error) return toast.error(error.message||"Setting update failed");
    setSettings(prev=>({...prev,[key]:value}));
  };

  const cards=[
    ["Users",stats.total_users||0,Users],["Students",stats.students||0,Users],["Teachers",stats.teachers||0,UserCog],
    ["Managers",stats.managers||0,Shield],["Admins",stats.admins||0,Shield],["Messages",stats.messages||0,MessageSquare],
    ["AI chats",stats.ai_conversations||0,Eye],["Reports",stats.pending_reports||0,AlertTriangle],
  ] as const;

  const roleOptions:UserRole[]=["student","teacher","manager","admin","extreme_admin"];

  if(user?.role!=="extreme_admin") return <div className="min-h-screen bg-background flex items-center justify-center p-6"><Card className="max-w-lg"><CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5"/>Super Admin only</CardTitle><CardDescription>This control center is protected by the database role, not just the UI.</CardDescription></CardHeader></Card>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><BackButton/><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-destructive">Restricted</p><h1 className="text-2xl font-bold">Super Admin Control Center</h1><p className="text-sm text-muted-foreground">Full platform administration with audited access to private operational data.</p></div></div>
          <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={"mr-2 h-4 w-4 "+(loading?"animate-spin":"")}/>Refresh</Button>
        </div>

        <Card className="mb-5 border-destructive/30 bg-destructive/5"><CardContent className="flex items-start gap-3 p-4"><Shield className="mt-0.5 h-5 w-5 text-destructive"/><div><p className="font-semibold">High-privilege mode</p><p className="text-sm text-muted-foreground">User changes and deletions are protected by server-side role checks. Opening the chat archive creates an audit-log entry.</p></div></CardContent></Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{cards.map(([label,value,Icon])=><Card key={label}><CardContent className="p-4"><Icon className="mb-2 h-4 w-4 text-primary"/><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>)}</div>

        <Tabs defaultValue="users" className="mt-5">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5"><TabsTrigger value="users">Users</TabsTrigger><TabsTrigger value="chats">All Chats</TabsTrigger><TabsTrigger value="content">Content</TabsTrigger><TabsTrigger value="system">System</TabsTrigger><TabsTrigger value="audit">Audit</TabsTrigger></TabsList>

          <TabsContent value="users" className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
            <Card><CardHeader><CardTitle>All platform users</CardTitle><CardDescription>Assign student, teacher, manager, admin or Super Admin roles.</CardDescription><div className="relative pt-2"><Search className="absolute left-3 top-4 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="Search users..."/></div></CardHeader><CardContent className="space-y-2">{users.map(person=><button key={person.id} onClick={()=>chooseUser(person)} className={"w-full rounded-xl border p-3 text-left transition hover:border-primary/50 "+(targetUser?.id===person.id?"border-primary bg-primary/5":"border-border/70")}><div className="flex items-center justify-between gap-3"><span className="font-medium">{person.name}</span><Badge>{person.role}</Badge></div><p className="text-xs text-muted-foreground">@{person.username||"unknown"} · {person.account_status} · XP {person.xp} · Coins {person.coins}</p></button>)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5"/>Selected user</CardTitle><CardDescription>{targetUser?targetUser.name:"Select a user"}</CardDescription></CardHeader><CardContent className="space-y-4">{targetUser?<><div className="grid grid-cols-2 gap-2"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={role} onChange={e=>setRole(e.target.value as UserRole)}>{roleOptions.map(item=><option key={item} value={item}>{item}</option>)}</select><Button onClick={updateRole}>Save role</Button></div><div className="grid grid-cols-2 gap-2"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={e=>setStatus(e.target.value)}><option>active</option><option>suspended</option><option>banned</option><option>purged</option></select><Button variant="outline" onClick={updateStatus}>Apply status</Button></div><div className="grid grid-cols-2 gap-2"><Input value={xpDelta} onChange={e=>setXpDelta(e.target.value)} placeholder="XP delta"/><Input value={coinDelta} onChange={e=>setCoinDelta(e.target.value)} placeholder="Coin delta"/></div><div className="grid grid-cols-2 gap-2"><Button onClick={()=>adjustEconomy(false)}><Coins className="mr-2 h-4 w-4"/>Apply</Button><Button variant="destructive" onClick={()=>adjustEconomy(true)}><Trash2 className="mr-2 h-4 w-4"/>Reset</Button></div></>:<p className="text-sm text-muted-foreground">Choose a user from the list.</p>}</CardContent></Card>
          </TabsContent>

          <TabsContent value="chats" className="mt-4">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/>Complete chat archive</CardTitle><CardDescription>Direct, group, parent, multiplayer, lobby and AI Tutor conversations. Read access is audit logged.</CardDescription><div className="flex gap-2 pt-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" value={chatSearch} onChange={e=>setChatSearch(e.target.value)} placeholder="Search message text or user..."/></div><Button onClick={loadChats}><Eye className="mr-2 h-4 w-4"/>Load archive</Button></div></CardHeader><CardContent className="space-y-2">{chats.map(chat=><div key={chat.id+chat.channel} className="rounded-xl border border-border/70 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant="secondary">{chat.channel}</Badge><span className="text-sm font-medium">{chat.sender_name||chat.sender_id}</span>{chat.receiver_name&&<><span className="text-muted-foreground">→</span><span className="text-sm">{chat.receiver_name}</span></>}</div><span className="text-xs text-muted-foreground">{new Date(chat.created_at).toLocaleString()}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{chat.content}</p>{chat.channel==="direct"&&<Button size="sm" variant="ghost" className="mt-2 text-destructive" onClick={()=>deleteMessage(chat.id)}><Trash2 className="mr-1 h-4 w-4"/>Delete</Button>}</div>)}{!chats.length&&<div className="py-12 text-center text-sm text-muted-foreground">No archive loaded yet.</div>}</CardContent></Card>
          </TabsContent>

          <TabsContent value="content" className="mt-4 grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Content overview</CardTitle><CardDescription>High-level platform content counts.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3">{[["Posts",stats.posts],["Books",stats.books],["Reports",stats.reports],["Pending reports",stats.pending_reports]].map(([label,value])=><div key={String(label)} className="rounded-xl border p-4"><p className="text-2xl font-bold">{value||0}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5"/>Operational snapshot</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>Group messages: {stats.group_messages||0}</p><p>Multiplayer chat: {stats.room_messages||0}</p><p>Lobby messages: {stats.lobby_messages||0}</p><p>Active users in last 10 minutes: {stats.active_users_10m||0}</p></CardContent></Card></TabsContent>

          <TabsContent value="system" className="mt-4"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5"/>Platform switches</CardTitle><CardDescription>These settings are stored server-side and changes are audit logged.</CardDescription></CardHeader><CardContent className="space-y-3">{["feature_social_enabled","feature_ai_enabled","feature_xp_enabled","leaderboard_enabled","grades_enabled"].map(key=><div key={key} className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-medium">{key.replaceAll("_"," ")}</p><p className="text-xs text-muted-foreground">Global feature flag</p></div><Switch checked={Boolean(settings[key])} onCheckedChange={value=>toggleSetting(key,value)}/></div>)}</CardContent></Card></TabsContent>

          <TabsContent value="audit" className="mt-4"><Card><CardHeader><CardTitle>Security audit trail</CardTitle><CardDescription>High-privilege actions and private-data access events.</CardDescription></CardHeader><CardContent className="space-y-2">{logs.map(log=><div key={log.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge>{log.action}</Badge><span className="text-sm">{log.actor_name||log.actor_id}</span></div><span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span></div><p className="mt-1 text-xs text-muted-foreground">{log.target_type||"system"}{log.target_id?" · "+log.target_id:""}</p></div>)}</CardContent></Card></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdminPortal;
