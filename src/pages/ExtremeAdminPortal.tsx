import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, AlertTriangle, RefreshCw, UserCog, Coins, Shield, Lock, Building2, Crown, Users } from 'lucide-react';
import { useUser, UserRole } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type AccountStatus = 'active' | 'suspended' | 'banned';

type PortalUser = {
  id: string;
  name: string;
  username: string | null;
  grade: string | null;
  xp: number;
  level: number;
  role: UserRole;
  coins: number;
  account_status: AccountStatus;
  created_at: string;
};

type PortalSchool = {
  id: string; name: string; school_code: string;
  status: 'active' | 'suspended' | 'closed'; created_at: string; created_by: string;
  managers: number; admins: number; teachers: number; students: number; parents: number; finance_staff: number;
};

const ExtremeAdminPortal: React.FC = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [dashboard, setDashboard] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [securitySummary, setSecuritySummary] = useState<Record<string, number>>({});
  const [schools, setSchools] = useState<PortalSchool[]>([]);

  const [targetUserId, setTargetUserId] = useState('');
  const [targetRole, setTargetRole] = useState<UserRole>('student');
  const [status, setStatus] = useState<AccountStatus>('active');
  const [statusReason, setStatusReason] = useState('');
  const [xpDelta, setXpDelta] = useState('0');
  const [coinDelta, setCoinDelta] = useState('0');
  const [messageId, setMessageId] = useState('');
  const [postId, setPostId] = useState('');
  const [bookId, setBookId] = useState('');

  const isExtremeAdmin = user?.role === 'extreme_admin';
  const currentSuperAdmin = users.find((item) => item.role === 'super_admin') || null;

  const availableRoles = useMemo<UserRole[]>(
    () => ['student', 'teacher', 'admin', 'manager', 'finance', 'parent'],
    [],
  );

  const refreshAll = async () => {
    if (!isExtremeAdmin) return;
    setLoading(true);
    try {
      const [{ data: dashboardData, error: dashboardError }, { data: userData, error: usersError }, { data: logData, error: logsError }, { data: settingsData, error: settingsError }, { data: securityData, error: securityError }, { data: schoolData, error: schoolsError }] = await Promise.all([
        supabase.rpc('extreme_admin_get_dashboard' as any),
        supabase.rpc('extreme_admin_list_users' as any, { p_limit: 300 }),
        supabase.rpc('extreme_admin_get_audit_logs' as any, { p_limit: 100 }),
        supabase.rpc('extreme_admin_get_settings' as any),
        supabase.rpc('extreme_admin_get_security' as any),
        supabase.rpc('extreme_admin_list_schools' as any),
      ]);

      if (dashboardError || usersError || logsError || settingsError || securityError || schoolsError) {
        throw dashboardError || usersError || logsError || settingsError || securityError || schoolsError;
      }

      setDashboard((dashboardData as Record<string, number>) || {});
      setUsers(((userData as unknown) as PortalUser[]) || []);
      setLogs((logData as any) || []);
      setSchools((schoolData as PortalSchool[]) || []);
      setSecuritySummary((securityData as Record<string, number>) || {});

      const mappedSettings = (settingsData || []).reduce((acc: Record<string, boolean>, row: any) => {
        acc[row.setting_key] = row.setting_value === true;
        return acc;
      }, {});
      setSettings(mappedSettings);
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh root control data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isExtremeAdmin]);

  const setSuperAdminAccount = async (enabled: boolean, userId = targetUserId) => {
    if (!userId) return toast.error('Choose an account first');
    const selected = users.find((item) => item.id === userId);
    if (enabled && selected?.role === 'extreme_admin') return toast.error('The Extreme Admin account cannot also be the Super Admin');
    const action = enabled ? 'assign or replace the single Super Admin' : 'revoke Super Admin access';
    if (!window.confirm(`Are you sure you want to ${action}?`)) return;
    const { error } = await supabase.rpc('extreme_admin_set_super_admin' as any, {
      p_user_id: userId, p_enabled: enabled, p_reason: statusReason.trim() || null,
    });
    if (error) return toast.error(error.message || 'Super Admin access could not be updated');
    toast.success(enabled ? 'Super Admin account updated' : 'Super Admin access revoked');
    await refreshAll();
  };

  const changeSchoolStatus = async (school: PortalSchool) => {
    const nextStatus = school.status === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`${nextStatus === 'suspended' ? 'Suspend' : 'Reactivate'} ${school.name}? School data will be preserved.`)) return;
    const { error } = await supabase.rpc('extreme_admin_set_school_status' as any, {
      p_school_id: school.id, p_status: nextStatus, p_reason: statusReason.trim() || null,
    });
    if (error) return toast.error(error.message || 'School status could not be updated');
    toast.success(`${school.name} is now ${nextStatus}`);
    await refreshAll();
  };

  const setRole = async () => {
    const { error } = await supabase.rpc('extreme_admin_update_user_role' as any, {
      p_user_id: targetUserId,
      p_role: targetRole,
    });

    if (error) {
      toast.error(error.message || 'Failed to update role');
      return;
    }

    toast.success('Role updated');
    refreshAll();
  };

  const setUserStatus = async () => {
    const { error } = await supabase.rpc('extreme_admin_set_user_status' as any, {
      p_user_id: targetUserId,
      p_status: status,
      p_reason: statusReason || null,
    });

    if (error) {
      toast.error(error.message || 'Failed to set account status');
      return;
    }

    toast.success('User status updated');
    refreshAll();
  };

  const adjustEconomy = async (reset = false) => {
    const { error } = await supabase.rpc('extreme_admin_adjust_economy' as any, {
      p_user_id: targetUserId,
      p_xp_delta: Number(xpDelta) || 0,
      p_coin_delta: Number(coinDelta) || 0,
      p_reset_progress: reset,
    });

    if (error) {
      toast.error(error.message || 'Failed to adjust economy');
      return;
    }

    toast.success(reset ? 'Progress reset' : 'Economy updated');
    refreshAll();
  };

  const deleteMessage = async () => {
    const { error } = await supabase.rpc('extreme_admin_delete_message' as any, { p_message_id: messageId });
    if (error) return toast.error(error.message || 'Failed to delete message');
    toast.success('Message deleted');
    setMessageId('');
    refreshAll();
  };

  const deletePost = async () => {
    const { error } = await supabase.rpc('extreme_admin_delete_social_post' as any, { p_post_id: postId });
    if (error) return toast.error(error.message || 'Failed to delete post');
    toast.success('Post deleted');
    setPostId('');
    refreshAll();
  };

  const deleteBook = async () => {
    const { error } = await supabase.rpc('extreme_admin_delete_library_book' as any, { p_book_id: bookId });
    if (error) return toast.error(error.message || 'Failed to delete book');
    toast.success('Book deleted');
    setBookId('');
    refreshAll();
  };

  const updateSetting = async (key: string, value: boolean) => {
    const { error } = await supabase.rpc('extreme_admin_set_setting' as any, {
      p_key: key,
      p_value: value,
    });

    if (error) {
      toast.error(error.message || `Failed to update ${key}`);
      return;
    }

    setSettings((prev) => ({ ...prev, [key]: value }));
    toast.success(`${key} updated`);
  };

  const overviewMetrics = [
    { label: 'Accounts', value: dashboard.total_users ?? 0, Icon: Users },
    { label: 'Schools', value: dashboard.schools ?? 0, Icon: Building2 },
    { label: 'Students', value: dashboard.students ?? 0, Icon: Users },
    { label: 'Teachers', value: dashboard.teachers ?? 0, Icon: UserCog },
    { label: 'Super Admin', value: dashboard.super_admins ?? 0, Icon: Crown },
    { label: 'Online now', value: dashboard.active_users_10m ?? 0, Icon: Shield },
  ];

  if (!isExtremeAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
        <Card className="w-full max-w-xl bg-white border-slate-200 text-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Lock className="h-5 w-5" /> Access Denied
            </CardTitle>
            <CardDescription className="text-slate-600">
              This route is hidden and only available to the Extreme Admin owner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">This workspace is restricted to the single Extreme Admin account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="bg-white border-slate-200 text-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <ShieldAlert className="h-5 w-5" /> Extreme Admin · Global platform control
            </CardTitle>
            <CardDescription className="text-slate-600">
              Global oversight of the Super Admin, every school, individual accounts, platform settings, and audited operations.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={refreshAll} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {loading && <p className="text-sm text-slate-500">Syncing live platform data...</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {overviewMetrics.map(({ label, value, Icon }) => (
            <Card key={label} className="border-slate-200 bg-white">
              <CardContent className="flex items-center justify-between gap-2 p-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{Number(value).toLocaleString()}</p>
                </div>
                <Icon className="h-5 w-5 text-blue-700" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="bg-white border border-slate-200 flex h-auto flex-wrap">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="super-admin">Super Admin</TabsTrigger>
            <TabsTrigger value="schools">Schools</TabsTrigger>
            <TabsTrigger value="economy">Economy</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="system">System Settings</TabsTrigger>
            <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="super-admin" className="space-y-4">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-600" />Single Super Admin account</CardTitle>
                <CardDescription>There can be only one Super Admin. This account manages the one school network and does not receive global platform authority.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentSuperAdmin ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{currentSuperAdmin.name}</p>
                    <p className="mt-1 text-xs text-slate-600">@{currentSuperAdmin.username || 'no-username'} · {currentSuperAdmin.account_status}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{currentSuperAdmin.id}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No Super Admin account is currently assigned.</div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Choose account to assign or replace Super Admin</Label>
                    <Select value={targetUserId} onValueChange={setTargetUserId}>
                      <SelectTrigger><SelectValue placeholder="Select an existing account" /></SelectTrigger>
                      <SelectContent>
                        {users.filter((item) => item.role !== 'extreme_admin').map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.name} · @{item.username || 'no-username'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason for audit history</Label>
                    <Textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Why is this account being assigned or changed?" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void setSuperAdminAccount(true)} disabled={!targetUserId}>Assign / replace Super Admin</Button>
                  {currentSuperAdmin && <Button variant="destructive" onClick={() => void setSuperAdminAccount(false, currentSuperAdmin.id)}>Revoke current Super Admin</Button>}
                </div>
                <p className="text-xs text-slate-500">Replacing the account revokes the previous Super Admin role and records the change. It does not delete either user's account or school records.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schools" className="space-y-4">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Global school oversight</CardTitle>
                <CardDescription>Every school in the single network. Suspension preserves school data and membership history.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {schools.length ? schools.map((school) => (
                  <div key={school.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{school.name} <span className="ml-2 font-mono text-xs text-slate-500">{school.school_code}</span></p>
                      <p className="mt-1 text-xs text-slate-600">{school.students} students · {school.teachers} teachers · {school.managers} Managers · {school.admins} Admins · {school.parents} parents · {school.finance_staff} finance</p>
                      <p className="mt-1 text-xs text-slate-500">Created {new Date(school.created_at).toLocaleDateString()} · {school.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={school.status === 'active' ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800' : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800'}>{school.status}</span>
                      <Button size="sm" variant={school.status === 'active' ? 'destructive' : 'outline'} onClick={() => void changeSchoolStatus(school)}>{school.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>
                    </div>
                  </div>
                )) : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No schools are registered yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2"><UserCog className="h-4 w-4" />User Control</CardTitle>
                <CardDescription>Manage ordinary platform roles and account access. Extreme Admin and Super Admin are controlled separately.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label>Target user ID</Label>
                  <Input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder="UUID" className="bg-white border-slate-200" />

                  <Label>Role</Label>
                  <Select value={targetRole} onValueChange={(value) => setTargetRole(value as UserRole)}>
                    <SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Button onClick={setRole} className="w-full">Update Role</Button>
                </div>

                <div className="space-y-3">
                  <Label>Account status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as AccountStatus)}>
                    <SelectTrigger className="bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="suspended">suspended</SelectItem>
                      <SelectItem value="banned">banned</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Reason" className="bg-slate-50 border-slate-200" />
                  <Button onClick={setUserStatus} variant="secondary" className="w-full">Apply Status</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle>All Users ({users.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-auto">
                {users.map((item) => (
                  <div key={item.id} className="text-xs border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.name} ({item.username || 'no-username'})</div>
                      <div className="text-slate-600">{item.id}</div>
                    </div>
                    <div className="text-right">
                      <div>{item.role} · {item.account_status}</div>
                      <div className="text-slate-600">XP {item.xp} · Coins {item.coins}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="economy" className="space-y-4">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Coins className="h-4 w-4" />XP & Currency Control</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-3">
                <Input value={xpDelta} onChange={(e) => setXpDelta(e.target.value)} placeholder="XP delta (e.g. 250 or -50)" className="bg-slate-50 border-slate-200" />
                <Input value={coinDelta} onChange={(e) => setCoinDelta(e.target.value)} placeholder="Coin delta (e.g. 100 or -25)" className="bg-slate-50 border-slate-200" />
                <div className="flex gap-2">
                  <Button onClick={() => adjustEconomy(false)} className="flex-1">Apply</Button>
                  <Button onClick={() => adjustEconomy(true)} variant="destructive" className="flex-1">Reset</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle>Content Control</CardTitle>
                <CardDescription>Delete social posts and library books by ID.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Input value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="Social post ID" className="bg-slate-50 border-slate-200" />
                  <Button variant="destructive" onClick={deletePost} className="w-full">Delete Post</Button>
                </div>
                <div className="space-y-2">
                  <Input value={bookId} onChange={(e) => setBookId(e.target.value)} placeholder="Library book ID" className="bg-slate-50 border-slate-200" />
                  <Button variant="destructive" onClick={deleteBook} className="w-full">Delete Book</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chats" className="space-y-4">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle>Chat Control</CardTitle>
                <CardDescription>Delete messages and monitor high-level message volume from dashboard stats.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input value={messageId} onChange={(e) => setMessageId(e.target.value)} placeholder="Message ID" className="bg-slate-50 border-slate-200" />
                <Button variant="destructive" onClick={deleteMessage} className="w-full">Delete Message</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />Feature + Platform Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {['feature_social_enabled', 'feature_ai_enabled', 'feature_xp_enabled', 'leaderboard_enabled', 'grades_enabled'].map((key) => (
                  <div key={key} className="flex items-center justify-between border border-slate-200 rounded p-3 bg-slate-50">
                    <span className="text-sm">{key}</span>
                    <Switch checked={Boolean(settings[key])} onCheckedChange={(value) => updateSetting(key, value)} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />Security and access snapshot</CardTitle>
                <CardDescription>Live metrics from the protected database function. This page does not pretend that client-entered IP addresses or unverified 2FA settings enforce security.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Audit events', securitySummary.audit_events ?? 0],
                  ['Active platform admins', securitySummary.active_admins ?? 0],
                  ['Active Managers', securitySummary.active_managers ?? 0],
                  ['Suspended accounts', securitySummary.suspended_users ?? 0],
                  ['Banned accounts', securitySummary.banned_users ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{Number(value).toLocaleString()}</p>
                  </div>
                ))}
              </CardContent>

            </Card>

            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle>System Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(dashboard).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-600">{key}</div>
                    <div className="text-xl font-semibold">{value}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle>Action Logs</CardTitle>
                <CardDescription className="text-slate-600">Who, what, and when for every root action.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[32rem] overflow-auto">
                {logs.map((log) => (
                  <div key={log.id} className="border border-slate-200 rounded p-3 bg-slate-50 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">{log.action}</span>
                      <span className="text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-slate-600">actor: {log.actor_name || log.actor_id}</div>
                    <div className="text-slate-600">target: {log.target_type} / {log.target_id || 'n/a'}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-amber-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          This workspace is intentionally restricted to the single Extreme Admin account.
        </div>
      </div>
    </div>
  );
};

export default ExtremeAdminPortal;
