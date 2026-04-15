import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, AlertTriangle, RefreshCw, Trash2, UserCog, Coins, Shield, Lock } from 'lucide-react';
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

type AccountStatus = 'active' | 'suspended' | 'banned' | 'purged';

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

type SecurityConfig = {
  allowed_ips: string[];
  require_2fa: boolean;
};

const SECRET_PATH = '/root-control-portal-9xA7';

const ExtremeAdminPortal: React.FC = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [dashboard, setDashboard] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, boolean>>({});

  const [targetUserId, setTargetUserId] = useState('');
  const [targetRole, setTargetRole] = useState<UserRole>('student');
  const [status, setStatus] = useState<AccountStatus>('active');
  const [statusReason, setStatusReason] = useState('');
  const [xpDelta, setXpDelta] = useState('0');
  const [coinDelta, setCoinDelta] = useState('0');
  const [messageId, setMessageId] = useState('');
  const [postId, setPostId] = useState('');
  const [bookId, setBookId] = useState('');

  const [requestIp, setRequestIp] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [allowIpsInput, setAllowIpsInput] = useState('');
  const [require2FA, setRequire2FA] = useState(false);
  const [securityCodeInput, setSecurityCodeInput] = useState('');

  const isExtremeAdmin = user?.role === 'extreme_admin';

  const availableRoles = useMemo<UserRole[]>(
    () => ['student', 'teacher', 'admin', 'manager', 'extreme_admin'],
    [],
  );

  const refreshAll = async () => {
    if (!isExtremeAdmin) return;
    setLoading(true);
    try {
      const [{ data: dashboardData, error: dashboardError }, { data: userData, error: usersError }, { data: logData, error: logsError }, { data: settingsData, error: settingsError }, { data: securityData, error: securityError }] = await Promise.all([
        supabase.rpc('extreme_admin_get_dashboard'),
        supabase.rpc('extreme_admin_list_users', { p_limit: 300 }),
        supabase.rpc('extreme_admin_get_audit_logs', { p_limit: 100 }),
        supabase.rpc('extreme_admin_get_settings'),
        supabase.rpc('extreme_admin_get_security'),
      ]);

      if (dashboardError || usersError || logsError || settingsError || securityError) {
        throw dashboardError || usersError || logsError || settingsError || securityError;
      }

      setDashboard((dashboardData as Record<string, number>) || {});
      setUsers((userData as PortalUser[]) || []);
      setLogs(logData || []);

      const mappedSettings = (settingsData || []).reduce((acc: Record<string, boolean>, row: any) => {
        acc[row.setting_key] = row.setting_value === true;
        return acc;
      }, {});
      setSettings(mappedSettings);

      const security = (securityData as SecurityConfig[] | null)?.[0] || null;
      setAllowIpsInput((security?.allowed_ips || []).join(', '));
      setRequire2FA(Boolean(security?.require_2fa));
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

  const verifyAccess = async () => {
    const { error } = await supabase.rpc('extreme_admin_check_access', {
      p_request_ip: requestIp || null,
      p_two_factor_code: twoFactorCode || null,
    });

    if (error) {
      toast.error(error.message || 'Verification failed');
      return;
    }

    toast.success('Access verified. All control actions are enabled.');
  };

  const saveSecurity = async () => {
    const allowIps = allowIpsInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const { error } = await supabase.rpc('extreme_admin_configure_security', {
      p_allowed_ips: allowIps,
      p_require_2fa: require2FA,
      p_two_factor_code: securityCodeInput || null,
    });

    if (error) {
      toast.error(error.message || 'Could not save security settings');
      return;
    }

    toast.success('Security settings updated');
    setSecurityCodeInput('');
    refreshAll();
  };

  const setRole = async () => {
    const { error } = await supabase.rpc('extreme_admin_update_user_role', {
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
    const { error } = await supabase.rpc('extreme_admin_set_user_status', {
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
    const { error } = await supabase.rpc('extreme_admin_adjust_economy', {
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
    const { error } = await supabase.rpc('extreme_admin_delete_message', { p_message_id: messageId });
    if (error) return toast.error(error.message || 'Failed to delete message');
    toast.success('Message deleted');
    setMessageId('');
    refreshAll();
  };

  const deletePost = async () => {
    const { error } = await supabase.rpc('extreme_admin_delete_social_post', { p_post_id: postId });
    if (error) return toast.error(error.message || 'Failed to delete post');
    toast.success('Post deleted');
    setPostId('');
    refreshAll();
  };

  const deleteBook = async () => {
    const { error } = await supabase.rpc('extreme_admin_delete_library_book', { p_book_id: bookId });
    if (error) return toast.error(error.message || 'Failed to delete book');
    toast.success('Book deleted');
    setBookId('');
    refreshAll();
  };

  const purgeUserData = async () => {
    const { error } = await supabase.rpc('extreme_admin_purge_user_data', { p_user_id: targetUserId });
    if (error) return toast.error(error.message || 'Failed to purge user data');
    toast.success('User platform data purged');
    refreshAll();
  };

  const updateSetting = async (key: string, value: boolean) => {
    const { error } = await supabase.rpc('extreme_admin_set_setting', {
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

  if (!isExtremeAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <Card className="w-full max-w-xl bg-zinc-950 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <Lock className="h-5 w-5" /> Access Denied
            </CardTitle>
            <CardDescription className="text-zinc-400">
              This route is hidden and only available to the Extreme Admin owner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">Secret path: {SECRET_PATH}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="bg-zinc-950 border-red-900/70 text-zinc-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <ShieldAlert className="h-5 w-5" /> Extreme Admin Access — All actions are permanent
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Hidden root portal with full control across users, economy, chats, content, and system controls.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={refreshAll} variant="secondary" className="bg-zinc-800 text-zinc-100">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          {loading && <p className="text-sm text-zinc-400">Syncing secure data...</p>}
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="economy">Economy</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="system">System Settings</TabsTrigger>
            <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-100 flex items-center gap-2"><UserCog className="h-4 w-4" />User Control</CardTitle>
                <CardDescription>Role changes, suspension, bans, and account data purge.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label>Target user ID</Label>
                  <Input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder="UUID" className="bg-zinc-900 border-zinc-700" />

                  <Label>Role</Label>
                  <Select value={targetRole} onValueChange={(value) => setTargetRole(value as UserRole)}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Button onClick={setRole} className="w-full">Update Role</Button>
                </div>

                <div className="space-y-3">
                  <Label>Account status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as AccountStatus)}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="suspended">suspended</SelectItem>
                      <SelectItem value="banned">banned</SelectItem>
                      <SelectItem value="purged">purged</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)} placeholder="Reason" className="bg-zinc-900 border-zinc-700" />
                  <Button onClick={setUserStatus} variant="secondary" className="w-full">Apply Status</Button>
                  <Button onClick={purgeUserData} variant="destructive" className="w-full"><Trash2 className="h-4 w-4 mr-2" />Purge User Data</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <CardTitle>All Users ({users.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-auto">
                {users.map((item) => (
                  <div key={item.id} className="text-xs border border-zinc-800 rounded p-2 bg-zinc-900/70 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.name} ({item.username || 'no-username'})</div>
                      <div className="text-zinc-400">{item.id}</div>
                    </div>
                    <div className="text-right">
                      <div>{item.role} · {item.account_status}</div>
                      <div className="text-zinc-400">XP {item.xp} · Coins {item.coins}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="economy" className="space-y-4">
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Coins className="h-4 w-4" />XP & Currency Control</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-3">
                <Input value={xpDelta} onChange={(e) => setXpDelta(e.target.value)} placeholder="XP delta (e.g. 250 or -50)" className="bg-zinc-900 border-zinc-700" />
                <Input value={coinDelta} onChange={(e) => setCoinDelta(e.target.value)} placeholder="Coin delta (e.g. 100 or -25)" className="bg-zinc-900 border-zinc-700" />
                <div className="flex gap-2">
                  <Button onClick={() => adjustEconomy(false)} className="flex-1">Apply</Button>
                  <Button onClick={() => adjustEconomy(true)} variant="destructive" className="flex-1">Reset</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <CardTitle>Content Control</CardTitle>
                <CardDescription>Delete social posts and library books by ID.</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Input value={postId} onChange={(e) => setPostId(e.target.value)} placeholder="Social post ID" className="bg-zinc-900 border-zinc-700" />
                  <Button variant="destructive" onClick={deletePost} className="w-full">Delete Post</Button>
                </div>
                <div className="space-y-2">
                  <Input value={bookId} onChange={(e) => setBookId(e.target.value)} placeholder="Library book ID" className="bg-zinc-900 border-zinc-700" />
                  <Button variant="destructive" onClick={deleteBook} className="w-full">Delete Book</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chats" className="space-y-4">
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <CardTitle>Chat Control</CardTitle>
                <CardDescription>Delete messages and monitor high-level message volume from dashboard stats.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input value={messageId} onChange={(e) => setMessageId(e.target.value)} placeholder="Message ID" className="bg-zinc-900 border-zinc-700" />
                <Button variant="destructive" onClick={deleteMessage} className="w-full">Delete Message</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />Feature + Platform Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {['feature_social_enabled', 'feature_ai_enabled', 'feature_xp_enabled', 'leaderboard_enabled', 'grades_enabled'].map((key) => (
                  <div key={key} className="flex items-center justify-between border border-zinc-800 rounded p-3 bg-zinc-900/70">
                    <span className="text-sm">{key}</span>
                    <Switch checked={Boolean(settings[key])} onCheckedChange={(value) => updateSetting(key, value)} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <CardTitle>Security Layer (IP + 2FA)</CardTitle>
                <CardDescription>Backend-enforced verification for root access actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <Input value={requestIp} onChange={(e) => setRequestIp(e.target.value)} placeholder="Current request IP (for verification)" className="bg-zinc-900 border-zinc-700" />
                  <Input value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="2FA code" className="bg-zinc-900 border-zinc-700" />
                </div>
                <Button onClick={verifyAccess}>Verify Access</Button>
                <hr className="border-zinc-800" />
                <Input value={allowIpsInput} onChange={(e) => setAllowIpsInput(e.target.value)} placeholder="Allowed IPs (comma separated)" className="bg-zinc-900 border-zinc-700" />
                <div className="flex items-center gap-2">
                  <Switch checked={require2FA} onCheckedChange={setRequire2FA} />
                  <Label>Require 2FA code</Label>
                </div>
                <Input value={securityCodeInput} onChange={(e) => setSecurityCodeInput(e.target.value)} placeholder="New 2FA code (leave empty to keep existing)" className="bg-zinc-900 border-zinc-700" />
                <Button onClick={saveSecurity}>Save Security Settings</Button>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <CardTitle>System Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(dashboard).map(([key, value]) => (
                  <div key={key} className="rounded border border-zinc-800 bg-zinc-900/70 p-3">
                    <div className="text-xs text-zinc-400">{key}</div>
                    <div className="text-xl font-semibold">{value}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <CardTitle>Action Logs</CardTitle>
                <CardDescription className="text-zinc-400">Who, what, and when for every root action.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[32rem] overflow-auto">
                {logs.map((log) => (
                  <div key={log.id} className="border border-zinc-800 rounded p-3 bg-zinc-900/70 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">{log.action}</span>
                      <span className="text-zinc-500">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-zinc-400">actor: {log.actor_name || log.actor_id}</div>
                    <div className="text-zinc-400">target: {log.target_type} / {log.target_id || 'n/a'}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-xs text-amber-300/90 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Keep this route secret. It is intentionally not linked in the app UI.
        </div>
      </div>
    </div>
  );
};

export default ExtremeAdminPortal;
