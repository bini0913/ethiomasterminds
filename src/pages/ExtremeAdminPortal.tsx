import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpRight, Building2, CheckCircle2, Clock3,
  Crown, FileText, Gauge, Lock, Plus, Search,
  Settings2, Shield, ShieldAlert, Users, UserCog, Wallet, XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser, UserRole } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import AdminCommandCenterShell from "@/components/admin/AdminCommandCenterShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type AccountStatus = "active" | "suspended" | "banned" | "purged";
type PortalUser = {
  id: string;
  name: string;
  username: string | null;
  grade: string | null;
  role: UserRole;
  account_status: AccountStatus;
  created_at: string;
};
type PortalSchool = {
  id: string;
  name: string;
  school_code: string;
  status: "active" | "suspended" | "closed";
  created_at: string;
  managers: number;
  admins: number;
  teachers: number;
  students: number;
  parents: number;
  finance_staff: number;
};
type DeletionRequest = {
  id: string;
  user_id: string | null;
  requested_email: string;
  requested_username: string | null;
  source: string;
  requester_note: string | null;
  status: "pending" | "in_review" | "completed" | "rejected";
  requested_at: string;
  resolution_note: string | null;
};
type CurrencyTotal = { currency: string; collected?: number; outstanding?: number };
type ExecutiveMetrics = {
  registered_users?: number;
  active_accounts?: number;
  registered_today?: number;
  registered_7d?: number;
  registered_30d?: number;
  schools_created_7d?: number;
  schools_created_30d?: number;
  daily_active_users?: number;
  weekly_active_users?: number;
  monthly_active_users?: number;
  daily_active_students?: number;
  weekly_active_students?: number;
  monthly_active_students?: number;
  recently_active_10m?: number;
  schools_total?: number;
  schools_active?: number;
  schools_suspended?: number;
  schools_closed?: number;
  students?: number;
  teachers?: number;
  parents?: number;
  staff?: number;
  super_admins?: number;
  extreme_admins?: number;
  active_platform_authorities?: number;
  active_managers?: number;
  suspended_users?: number;
  banned_users?: number;
  audit_events_24h?: number;
  audit_events_total?: number;
  school_fee_payments_confirmed?: number;
  notification_devices_enabled?: number;
  notification_inbox_events_24h?: number;
  notification_fcm_accepted_24h?: number;
  notification_failed_24h?: number;
  notification_skipped_24h?: number;
  study_call_rooms_24h?: number;
  storage_buckets_configured?: number;
  school_invoices_total?: number;
  school_invoices_outstanding?: number;
  school_fee_collected_by_currency?: CurrencyTotal[];
  school_fee_collected_month_by_currency?: CurrencyTotal[];
  school_fee_collected_year_by_currency?: CurrencyTotal[];
  school_fee_outstanding_by_currency?: CurrencyTotal[];
  metrics_generated_at?: string;
};

const PAGE_SIZE = 50;
const ROLE_OPTIONS: UserRole[] = ["student", "teacher", "admin", "manager", "finance", "parent"];
const formatNumber = (value: unknown) => Number(value || 0).toLocaleString();
const formatMoney = (value: unknown, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));

const MetricCard = ({ label, value, detail, icon: Icon, tone = "blue" }: {
  label: string; value: unknown; detail?: string; icon: React.ElementType;
  tone?: "blue" | "green" | "amber" | "navy";
}) => {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    navy: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums tracking-tight text-slate-950 sm:text-3xl">{formatNumber(value)}</p>
            {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
          </div>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const SectionHeading = ({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) => (
  <div className="mb-5">
    <p className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-700">{eyebrow}</p>
    <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>
  </div>
);

const ExtremeAdminPortal: React.FC = () => {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const isExtremeAdmin = user?.role === "extreme_admin";

  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<ExecutiveMetrics>({});
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState("all");
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [schools, setSchools] = useState<PortalSchool[]>([]);
  const [superAdminUsers, setSuperAdminUsers] = useState<PortalUser[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, boolean | number>>({});
  const [serviceHealth, setServiceHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [statusReason, setStatusReason] = useState("");
  const [schoolActionReason, setSchoolActionReason] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetRole, setTargetRole] = useState<UserRole>("student");
  const [targetStatus, setTargetStatus] = useState<AccountStatus>("active");
  const [aiDailyLimit, setAiDailyLimit] = useState("50");

  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [managerName, setManagerName] = useState("");
  const [createSchoolOpen, setCreateSchoolOpen] = useState(false);
  const [createSchoolLoading, setCreateSchoolLoading] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountRole, setNewAccountRole] = useState("finance");
  const [newAccountGrade, setNewAccountGrade] = useState("");
  const [newAccountAge, setNewAccountAge] = useState("");
  const [newAccountSectionId, setNewAccountSectionId] = useState("");
  const [parentStudentMembershipIds, setParentStudentMembershipIds] = useState("");
  const [createAccountLoading, setCreateAccountLoading] = useState(false);
  const [existingAccountUsername, setExistingAccountUsername] = useState("");
  const [existingAccountRole, setExistingAccountRole] = useState("finance");
  const [existingParentStudentMembershipIds, setExistingParentStudentMembershipIds] = useState("");
  const [existingAccountReason, setExistingAccountReason] = useState("");
  const [assignExistingLoading, setAssignExistingLoading] = useState(false);
  const [provisioningResult, setProvisioningResult] = useState<any>(null);

  const [privacyNote, setPrivacyNote] = useState("");
  const [externalDeletionEmail, setExternalDeletionEmail] = useState("");
  const [externalDeletionUsername, setExternalDeletionUsername] = useState("");
  const [externalDeletionNote, setExternalDeletionNote] = useState("");
  const [privacyPreflight, setPrivacyPreflight] = useState<Record<string, any>>({});
  const [privacyLoadingId, setPrivacyLoadingId] = useState<string | null>(null);

  const currentSuperAdmin = superAdminUsers[0] || null;

  const loadUsers = useCallback(async (reset = true, offsetOverride = 0) => {
    if (!isExtremeAdmin) return;
    setUsersLoading(true);
    const offset = reset ? 0 : offsetOverride;
    const { data, error } = await supabase.rpc("extreme_admin_list_users" as any, {
      p_search: directorySearch.trim() || null,
      p_role: directoryRoleFilter === "all" ? null : directoryRoleFilter,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    setUsersLoading(false);
    if (error) {
      toast.error(error.message || "Could not load platform accounts");
      return;
    }
    const rows = (data as PortalUser[]) || [];
    setUsers((current) => reset ? rows : [...current, ...rows]);
    setHasMoreUsers(rows.length === PAGE_SIZE);
  }, [isExtremeAdmin, directorySearch, directoryRoleFilter]);

  const refreshAll = useCallback(async () => {
    if (!isExtremeAdmin) return;
    setLoading(true);
    try {
      const [
        metricsResult, schoolsResult, superAdminResult, logsResult,
        settingsResult, deletionResult,
      ] = await Promise.all([
        supabase.rpc("extreme_admin_get_executive_metrics" as any),
        supabase.rpc("extreme_admin_list_schools" as any),
        supabase.rpc("extreme_admin_list_users" as any, { p_role: "super_admin", p_limit: 1, p_offset: 0 }),
        supabase.rpc("extreme_admin_get_audit_logs" as any, { p_limit: 100 }),
        supabase.rpc("extreme_admin_get_settings" as any),
        supabase.rpc("extreme_admin_list_account_deletion_requests" as any, { p_status: null, p_limit: 100 }),
      ]);
      const failure = metricsResult.error || schoolsResult.error || superAdminResult.error ||
        logsResult.error || settingsResult.error || deletionResult.error;
      if (failure) throw failure;

      setMetrics((metricsResult.data as ExecutiveMetrics) || {});
      setSchools((schoolsResult.data as PortalSchool[]) || []);
      setSuperAdminUsers((superAdminResult.data as PortalUser[]) || []);
      setLogs((logsResult.data as any[]) || []);
      setDeletionRequests((deletionResult.data as DeletionRequest[]) || []);
      const mapped = ((settingsResult.data as any[]) || []).reduce((result, row) => {
        result[row.setting_key] = typeof row.setting_value === "number" ? row.setting_value : row.setting_value === true;
        return result;
      }, {} as Record<string, boolean | number>);
      setSettings(mapped);
      setAiDailyLimit(String(typeof mapped.max_ai_requests_per_day === "number" ? mapped.max_ai_requests_per_day : 50));
    } catch (error: any) {
      toast.error(error?.message || "Executive platform data could not be refreshed");
    } finally {
      setLoading(false);
    }
  }, [isExtremeAdmin]);

  useEffect(() => {
    if (!isExtremeAdmin) return;
    void refreshAll();
  }, [isExtremeAdmin, user?.id, refreshAll]);

  useEffect(() => {
    if (!isExtremeAdmin) return;
    void loadUsers(true);
  }, [isExtremeAdmin, user?.id, directorySearch, directoryRoleFilter, loadUsers]);

  const selectedUser = users.find((item) => item.id === targetUserId);

  const updateUserRole = async () => {
    if (!targetUserId) return toast.error("Select an account first");
    if (selectedUser?.role === "extreme_admin" || selectedUser?.role === "super_admin") {
      return toast.error("Platform owner roles are managed in the dedicated authority controls");
    }
    if (!statusReason.trim()) return toast.error("Enter a reason for the role change");
    const { error } = await supabase.rpc("extreme_admin_set_role" as any, {
      p_user_id: targetUserId,
      p_role: targetRole,
      p_reason: statusReason.trim(),
    });
    if (error) return toast.error(error.message || "Role could not be updated");
    toast.success("Account role updated");
    setStatusReason("");
    await refreshAll();
    await loadUsers(true);
  };

  const updateUserStatus = async () => {
    if (!targetUserId) return toast.error("Select an account first");
    if (selectedUser?.role === "extreme_admin") return toast.error("The Extreme Admin owner account cannot be changed through general status controls");
    if (selectedUser?.role === "super_admin" && targetStatus !== "active") return toast.error("Revoke Super Admin authority before suspending or banning that account");
    if (!statusReason.trim()) return toast.error("Enter a reason for the account status change");
    const { error } = await supabase.rpc("extreme_admin_set_user_status" as any, {
      p_user_id: targetUserId,
      p_status: targetStatus,
      p_reason: statusReason.trim(),
    });
    if (error) return toast.error(error.message || "Account status could not be updated");
    toast.success("Account status updated");
    setStatusReason("");
    await refreshAll();
    await loadUsers(true);
  };

  const setSuperAdminAccount = async (enabled: boolean, userId = targetUserId) => {
    if (!userId) return toast.error("Choose an account first");
    const selected = users.find((item) => item.id === userId);
    if (enabled && selected?.role === "extreme_admin") return toast.error("The Extreme Admin cannot also be Super Admin");
    if (!statusReason.trim()) return toast.error("Enter a reason for this authority change");
    const action = enabled ? "assign or replace the single Super Admin" : "revoke Super Admin access";
    if (!window.confirm(`Confirm: ${action}?`)) return;
    const { error } = await supabase.rpc("extreme_admin_set_super_admin" as any, {
      p_user_id: userId, p_enabled: enabled, p_reason: statusReason.trim(),
    });
    if (error) return toast.error(error.message || "Super Admin authority could not be updated");
    toast.success(enabled ? "Super Admin assigned" : "Super Admin revoked");
    setStatusReason("");
    await refreshAll();
    await loadUsers(true);
  };

  const changeSchoolStatus = async (school: PortalSchool) => {
    if (school.status === "closed") return toast.error("Closed schools require a separate reopening review.");
    const nextStatus = school.status === "active" ? "suspended" : "active";
    if (!schoolActionReason.trim()) return toast.error("Enter a reason for this school status change");
    if (!window.confirm(`${nextStatus === "suspended" ? "Suspend" : "Reactivate"} ${school.name}? School records will be preserved.`)) return;
    const { error } = await supabase.rpc("extreme_admin_set_school_status" as any, {
      p_school_id: school.id, p_status: nextStatus, p_reason: schoolActionReason.trim(),
    });
    if (error) return toast.error(error.message || "School status could not be changed");
    toast.success(`${school.name} is now ${nextStatus}`);
    setSchoolActionReason("");
    await refreshAll();
  };

  const createSchool = async () => {
    if (schoolName.trim().length < 2 || !/^[A-Z0-9]{2,8}$/.test(schoolCode.trim().toUpperCase()) || managerName.trim().length < 2) {
      return toast.error("Enter a valid school name, 2–8 character school code, and Manager name");
    }
    setCreateSchoolLoading(true);
    const { data, error } = await supabase.functions.invoke("school-provision-account", {
      body: {
        action: "create_school",
        school: { name: schoolName.trim(), school_code: schoolCode.trim().toUpperCase() },
        manager: { name: managerName.trim() },
      },
    });
    setCreateSchoolLoading(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "School could not be created");
    setProvisioningResult({ kind: "school", data });
    setSchoolName("");
    setSchoolCode("");
    setManagerName("");
    setCreateSchoolOpen(false);
    toast.success("School and initial Manager account created");
    await refreshAll();
    await loadUsers(true);
  };

  const createSchoolAccount = async () => {
    if (!selectedSchoolId || newAccountName.trim().length < 2) return toast.error("Choose a school and enter the account holder's name");
    if (newAccountRole === "student" && (!newAccountGrade.trim() || !newAccountAge.trim() || !newAccountSectionId.trim())) {
      return toast.error("Student accounts require grade, age, and a valid section ID");
    }
    if (newAccountRole === "parent" && !parentStudentMembershipIds.trim()) {
      return toast.error("Parent accounts need a pa-prefixed username and at least one enrolled student");
    }
    const account: Record<string, unknown> = { name: newAccountName.trim() };
    if (newAccountRole === "student") {
      account.grade_label = newAccountGrade.trim();
      account.age = Number(newAccountAge);
      account.section_id = newAccountSectionId.trim();
    }
    if (newAccountRole === "parent") {
      account.student_membership_ids = parentStudentMembershipIds.split(",").map((id) => id.trim()).filter(Boolean);
    }
    setCreateAccountLoading(true);
    const { data, error } = await supabase.functions.invoke("school-provision-account", {
      body: { action: "create_accounts", school_id: selectedSchoolId, role: newAccountRole, accounts: [account] },
    });
    setCreateAccountLoading(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Account could not be created");
    setProvisioningResult({ kind: "accounts", data });
    setNewAccountName("");
    setNewAccountGrade("");
    setNewAccountAge("");
    setNewAccountSectionId("");
    setParentStudentMembershipIds("");
    if ((data?.created || []).length) toast.success("School account created");
    if ((data?.failed || []).length) toast.error(data.failed[0]?.message || "Account creation was partially unsuccessful");
    await refreshAll();
    await loadUsers(true);
  };

  const assignExistingAccount = async () => {
    if (!selectedSchoolId || !existingAccountUsername.trim()) return toast.error("Choose a school and enter the existing username");
    if (!existingAccountReason.trim()) return toast.error("Enter a reason for assigning this account");
    if (existingAccountRole === "parent" && !existingParentStudentMembershipIds.trim()) return toast.error("A parent must be linked to at least one enrolled student");
    setAssignExistingLoading(true);
    const { data, error } = await supabase.functions.invoke("school-provision-account", {
      body: {
        action: "attach_existing_account",
        school_id: selectedSchoolId,
        username: existingAccountUsername.trim(),
        role: existingAccountRole,
        reason: existingAccountReason.trim(),
        student_membership_ids: existingAccountRole === "parent"
          ? existingParentStudentMembershipIds.split(",").map((id) => id.trim()).filter(Boolean)
          : [],
      },
    });
    setAssignExistingLoading(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Existing account could not be assigned");
    setProvisioningResult({ kind: "assigned", data });
    setExistingAccountUsername("");
    if (data?.audit_recorded === false) toast.error(data.warning || "Account assigned, but audit review is required");
    else toast.success("Existing account assigned to the school");
    await refreshAll();
    await loadUsers(true);
  };

  const updateSetting = async (key: string, value: boolean) => {
    const { error } = await supabase.rpc("admin_set_setting" as any, { p_key: key, p_value: value });
    if (error) return toast.error(error.message || `Could not update ${key}`);
    setSettings((current) => ({ ...current, [key]: value }));
    toast.success("Platform setting updated");
  };

  const updateAiLimit = async () => {
    const limit = Number(aiDailyLimit);
    if (!Number.isInteger(limit) || limit < 0 || limit > 300) return toast.error("Enter a whole number between 0 and 300");
    const { error } = await supabase.rpc("admin_set_setting" as any, { p_key: "max_ai_requests_per_day", p_value: limit });
    if (error) return toast.error(error.message || "AI daily limit could not be updated");
    setSettings((current) => ({ ...current, max_ai_requests_per_day: limit }));
    toast.success("AI request limit updated");
  };

  const runServiceHealthChecks = async () => {
    setHealthLoading(true);
    const { data, error } = await supabase.functions.invoke("extreme-admin-health-check", { body: {} });
    setHealthLoading(false);
    if (error || data?.error) return toast.error(data?.error || error?.message || "Service health checks could not run");
    setServiceHealth(data);
    toast.success("Service connectivity checks completed");
  };

  const createExternalDeletionRequest = async () => {
    if (!externalDeletionEmail.trim()) return toast.error("Enter the account email from the request");
    if (!externalDeletionNote.trim()) return toast.error("Record how the external request was received and verified");
    const { error } = await supabase.rpc("extreme_admin_create_external_deletion_request" as any, {
      p_email: externalDeletionEmail.trim(),
      p_username: externalDeletionUsername.trim() || null,
      p_note: externalDeletionNote.trim(),
    });
    if (error) return toast.error(error.message || "External deletion request could not be recorded");
    setExternalDeletionEmail("");
    setExternalDeletionUsername("");
    setExternalDeletionNote("");
    toast.success("External deletion request recorded");
    await refreshAll();
  };

  const runDeletionPreflight = async (request: DeletionRequest) => {
    setPrivacyLoadingId(request.id);
    const { data, error } = await supabase.rpc("extreme_admin_preflight_account_deletion" as any, { p_request_id: request.id });
    setPrivacyLoadingId(null);
    if (error) return toast.error(error.message || "Deletion preflight failed");
    setPrivacyPreflight((current) => ({ ...current, [request.id]: data }));
    toast.success("Read-only deletion preflight completed");
  };

  const updateDeletionRequest = async (request: DeletionRequest, nextStatus: "in_review" | "completed" | "rejected") => {
    if (!privacyNote.trim()) return toast.error("A documented review or resolution note is required");
    if (nextStatus === "completed" && request.user_id) {
      return toast.error("Complete the supported Auth deletion workflow first, then update this request");
    }
    const { error } = await supabase.rpc("extreme_admin_update_account_deletion_request" as any, {
      p_request_id: request.id, p_status: nextStatus, p_note: privacyNote.trim(),
    });
    if (error) return toast.error(error.message || "Privacy request could not be updated");
    setPrivacyNote("");
    toast.success(`Privacy request marked ${nextStatus.replace("_", " ")}`);
    await refreshAll();
  };

  const collectedTotals = metrics.school_fee_collected_by_currency || [];
  const monthlyCollectedTotals = metrics.school_fee_collected_month_by_currency || [];
  const yearlyCollectedTotals = metrics.school_fee_collected_year_by_currency || [];
  const outstandingTotals = metrics.school_fee_outstanding_by_currency || [];
  const navItems = useMemo(() => [
    { key: "overview", label: "Executive overview", description: "Growth, usage and business pulse", section: "Executive", icon: Gauge },
    { key: "users", label: "Accounts & access", description: "Create, search and assign accounts", section: "Executive", icon: Users },
    { key: "super-admin", label: "Super Admin", description: "Single network authority", section: "Executive", icon: Crown },
    { key: "schools", label: "School network", description: "School inventory and ownership", section: "Executive", icon: Building2 },
    { key: "finance", label: "Money & growth", description: "Verified collections and balances", section: "Business intelligence", icon: Wallet },
    { key: "operations", label: "Platform controls", description: "Global settings and security", section: "Platform operations", icon: Settings2 },
    { key: "privacy", label: "Privacy requests", description: "Account deletion oversight", section: "Platform operations", icon: ShieldAlert },
    { key: "audit", label: "Audit history", description: "Privileged action traceability", section: "Platform operations", icon: FileText },
  ], []);

  if (!isExtremeAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-slate-900">
        <Card className="w-full max-w-lg border-slate-200 bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700"><Lock className="h-5 w-5" /> Access denied</CardTitle>
            <CardDescription>This owner workspace is restricted to the single Extreme Admin account.</CardDescription>
          </CardHeader>
          <CardContent><p className="text-sm text-slate-500">The server independently checks Extreme Admin authority for every privileged operation.</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminCommandCenterShell
      roleLabel="Extreme Admin"
      eyebrow="Master Minds · Platform ownership"
      title="Executive control center"
      description="Platform-wide people, schools, business performance and operational assurance."
      activeKey={activeTab}
      navItems={navItems}
      onNavigate={setActiveTab}
      onRefresh={() => void refreshAll()}
      refreshing={loading}
      onLogout={async () => { await logout(); navigate("/", { replace: true }); }}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl bg-[#0b1f3a] p-5 text-white shadow-sm sm:p-7">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[.2em] text-blue-200">Owner dashboard · Part 1</p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">Your platform, at a glance.</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">A decision-ready view of registered accounts, real activity, school growth, verified school-fee collections and platform controls.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-300">Recently active · last 10 minutes</p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-bold tabular-nums"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />{formatNumber(metrics.recently_active_10m)}</p>
              </div>
            </div>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-bold text-slate-900">Platform reach</h3><p className="text-xs text-slate-500">Registered accounts are not the same as active users.</p></div>
              <span className="text-[11px] text-slate-400">Live database metrics</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="All registered users" value={metrics.registered_users} detail={`+${formatNumber(metrics.registered_today)} today`} icon={Users} tone="blue" />
              <MetricCard label="Active accounts" value={metrics.active_accounts} detail="Accounts currently marked active" icon={CheckCircle2} tone="green" />
              <MetricCard label="Daily active users" value={metrics.daily_active_users} detail="Unique accounts seen since Ethiopia day start" icon={Activity} tone="green" />
              <MetricCard label="Weekly active users" value={metrics.weekly_active_users} detail="Unique accounts seen in 7 days" icon={Activity} tone="blue" />
              <MetricCard label="Monthly active users" value={metrics.monthly_active_users} detail="Unique accounts seen in 30 days" icon={Activity} tone="navy" />
            </div>
          </section>

          <section>
            <div className="mb-3"><h3 className="text-sm font-bold text-slate-900">Student activity</h3><p className="text-xs text-slate-500">Unique student accounts with a recorded last-seen timestamp in each period.</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Students active today" value={metrics.daily_active_students} detail="Ethiopia calendar day" icon={Activity} tone="green" />
              <MetricCard label="Students active · 7 days" value={metrics.weekly_active_students} detail="Rolling seven-day window" icon={Activity} tone="blue" />
              <MetricCard label="Students active · 30 days" value={metrics.monthly_active_students} detail="Rolling 30-day window" icon={Activity} tone="navy" />
            </div>
          </section>

          <section>
            <div className="mb-3"><h3 className="text-sm font-bold text-slate-900">School network</h3><p className="text-xs text-slate-500">Schools and platform roles are counted from current records.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total schools" value={metrics.schools_total} detail={`${formatNumber(metrics.schools_active)} active`} icon={Building2} tone="blue" />
              <MetricCard label="Students" value={metrics.students} detail="Unique student accounts" icon={Users} tone="green" />
              <MetricCard label="Teachers & staff" value={metrics.staff} detail={`${formatNumber(metrics.teachers)} teachers`} icon={UserCog} tone="navy" />
              <MetricCard label="Parents" value={metrics.parents} detail="Unique parent accounts" icon={Users} tone="amber" />
            </div>
          </section>

          <section>
            <div className="mb-3"><h3 className="text-sm font-bold text-slate-900">Platform authority</h3><p className="text-xs text-slate-500">The database enforces one account for each top-level authority role.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Extreme Admin owners" value={metrics.extreme_admins} detail="Global platform authority · singleton" icon={Shield} tone="navy" />
              <MetricCard label="Super Admins" value={metrics.super_admins} detail="School network authority · singleton" icon={Crown} tone="amber" />
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader><CardTitle className="text-base">Growth snapshot</CardTitle><CardDescription>New account registrations from profile creation timestamps.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                {[
                  { label: "Today", value: metrics.registered_today, icon: ArrowUpRight },
                  { label: "Last 7 days", value: metrics.registered_7d, icon: Activity },
                  { label: "Last 30 days", value: metrics.registered_30d, icon: ArrowUpRight },
                  { label: "New schools · 7 days", value: metrics.schools_created_7d, icon: Building2 },
                  { label: "New schools · 30 days", value: metrics.schools_created_30d, icon: Building2 },
                ].map((item) => <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><item.icon className="h-4 w-4 text-blue-700" /><p className="mt-3 text-xl font-bold tabular-nums text-slate-950">{formatNumber(item.value)}</p><p className="mt-1 text-xs text-slate-500">{item.label}</p></div>)}
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader><CardTitle className="text-base">Platform assurance</CardTitle><CardDescription>Operational signals from protected database records.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm text-slate-600">Audit events · 24 hours</span><strong className="tabular-nums text-slate-950">{formatNumber(metrics.audit_events_24h)}</strong></div>
                <div className="flex items-center justify-between"><span className="text-sm text-slate-600">Suspended schools</span><strong className="tabular-nums text-slate-950">{formatNumber(metrics.schools_suspended)}</strong></div>
                <div className="flex items-center justify-between"><span className="text-sm text-slate-600">Closed schools</span><strong className="tabular-nums text-slate-950">{formatNumber(metrics.schools_closed)}</strong></div>
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800"><Shield className="h-4 w-4 shrink-0" />Privileged actions remain server-authorized and auditable.</div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader><CardTitle className="text-base">Business snapshot</CardTitle><CardDescription>Confirmed school-fee payments only. This is not a claim about all platform revenue.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Collected</p>{collectedTotals.length ? collectedTotals.map((row) => <div key={row.currency} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0"><span className="text-sm text-slate-600">{row.currency} confirmed receipts</span><strong className="tabular-nums text-slate-950">{formatMoney(row.collected, row.currency)}</strong></div>) : <p className="text-sm text-slate-500">No confirmed school-fee receipts recorded.</p>}</div>
              <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Outstanding invoices</p>{outstandingTotals.length ? outstandingTotals.map((row) => <div key={row.currency} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0"><span className="text-sm text-slate-600">{row.currency} unpaid balance</span><strong className="tabular-nums text-slate-950">{formatMoney(row.outstanding, row.currency)}</strong></div>) : <p className="text-sm text-slate-500">No outstanding invoice balances.</p>}</div>
            </CardContent>
          </Card>
          <p className="text-[11px] text-slate-400">Metrics generated {metrics.metrics_generated_at ? new Date(metrics.metrics_generated_at).toLocaleString() : "when the executive metrics RPC is available"}.</p>
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-6">
          <SectionHeading eyebrow="Executive · People & access" title="Accounts and access" description="Search the complete account directory, provision school accounts through the existing secure provisioning service, and apply audited role or status changes." />
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4 text-blue-700" />Account directory</CardTitle><CardDescription>Search by name, username or UUID using the protected paginated directory. The displayed role is the effective role resolved from platform authority and active school membership.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
                <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadUsers(true); }} placeholder="Search name, username or account ID" />
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}><SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem>{ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}<SelectItem value="super_admin">Super Admin</SelectItem></SelectContent></Select>
                <Button onClick={() => { setDirectorySearch(userSearch.trim()); setDirectoryRoleFilter(userRoleFilter); if (directorySearch === userSearch.trim() && directoryRoleFilter === userRoleFilter) void loadUsers(true); }} disabled={usersLoading}><Search className="mr-2 h-4 w-4" />Search accounts</Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Action</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((account) => <tr key={account.id} className="hover:bg-slate-50/80"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{account.name}</p><p className="text-xs text-slate-500">@{account.username || "no-username"} · {account.id.slice(0, 8)}…</p></td><td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{account.role}</span></td><td className="px-4 py-3"><span className={account.account_status === "active" ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800" : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"}>{account.account_status}</span></td><td className="px-4 py-3 text-xs text-slate-500">{new Date(account.created_at).toLocaleDateString()}</td><td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => { setTargetUserId(account.id); setTargetRole(account.role === "super_admin" || account.role === "extreme_admin" ? "student" : account.role); setTargetStatus(account.account_status); }}>Manage</Button></td></tr>)}
                    {!users.length && !usersLoading && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">No matching accounts found.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{formatNumber(users.length)} accounts loaded in this result set.</p>{hasMoreUsers && <Button variant="outline" onClick={() => void loadUsers(false, users.length)} disabled={usersLoading}>{usersLoading ? "Loading…" : "Load more accounts"}</Button>}</div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader><CardTitle className="text-base">Update account access</CardTitle><CardDescription>Changes are checked by privileged database functions and recorded in the admin audit log.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1"><Label>Selected account ID</Label><Input value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} placeholder="Select from the directory" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Global role</Label><Select value={targetRole} onValueChange={(value) => setTargetRole(value as UserRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>Account status</Label><Select value={targetStatus} onValueChange={(value) => setTargetStatus(value as AccountStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="banned">Banned</SelectItem><SelectItem value="purged" disabled>Purged · locked</SelectItem></SelectContent></Select></div>
                </div>
                <div className="space-y-1"><Label>Required audit reason</Label><Textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="Explain why this access change is necessary" rows={3} /></div>
                <div className="flex flex-wrap gap-2"><Button onClick={() => void updateUserRole()} disabled={!targetUserId || !statusReason.trim()}>Update role</Button><Button variant="outline" onClick={() => void updateUserStatus()} disabled={!targetUserId || !statusReason.trim()}>Update status</Button></div>
                <p className="text-xs text-slate-500">This changes the account's global role only. Active school membership continues to determine the school portal role; use the School Manager's dedicated workflows for school staff and learner role changes. Extreme Admin and Super Admin authority is protected separately.</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4 text-blue-700" />Create and assign a school account</CardTitle><CardDescription>Uses the existing school-provision-account Edge Function. Credentials are generated by the server and shown only in this result.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1"><Label>School</Label><Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}><SelectTrigger><SelectValue placeholder="Choose a school" /></SelectTrigger><SelectContent>{schools.filter((school) => school.status === "active").map((school) => <SelectItem key={school.id} value={school.id}>{school.name} · {school.school_code}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>School role</Label><Select value={newAccountRole} onValueChange={setNewAccountRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="finance">Finance</SelectItem><SelectItem value="parent">Parent</SelectItem><SelectItem value="student">Student</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label>Full name</Label><Input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} placeholder="Account holder's full name" /></div>
                {newAccountRole === "student" && <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1"><Label>Grade</Label><Input value={newAccountGrade} onChange={(event) => setNewAccountGrade(event.target.value)} placeholder="e.g. Grade 7" /></div><div className="space-y-1"><Label>Age</Label><Input type="number" min="3" max="120" value={newAccountAge} onChange={(event) => setNewAccountAge(event.target.value)} placeholder="Age" /></div><div className="space-y-1"><Label>Section ID</Label><Input value={newAccountSectionId} onChange={(event) => setNewAccountSectionId(event.target.value)} placeholder="Section UUID" /></div></div>}
                {newAccountRole === "parent" && <div className="space-y-1"><Label>Student membership IDs (required)</Label><Input value={parentStudentMembershipIds} onChange={(event) => setParentStudentMembershipIds(event.target.value)} placeholder="Comma-separated membership IDs" /></div>}
                <Button className="w-full" onClick={() => void createSchoolAccount()} disabled={createAccountLoading || !selectedSchoolId || !newAccountName.trim()}>{createAccountLoading ? "Creating account…" : "Create school account"}</Button>
              </CardContent>
            </Card>
          </div>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader><CardTitle className="text-base">Assign an existing account</CardTitle><CardDescription>Attach an existing platform account as Finance or Parent. Parent usernames must begin with pa and be linked to at least one enrolled student; student enrollment and teacher assignment follow their dedicated school workflows.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <div className="space-y-1"><Label>Existing username</Label><Input value={existingAccountUsername} onChange={(event) => setExistingAccountUsername(event.target.value)} placeholder="Exact username" /></div>
              <div className="space-y-1"><Label>School role</Label><Select value={existingAccountRole} onValueChange={setExistingAccountRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="finance">Finance</SelectItem><SelectItem value="parent">Parent</SelectItem></SelectContent></Select></div>
              {existingAccountRole === "parent" && <div className="space-y-1 md:col-span-4"><Label>Student membership IDs (required for Parent)</Label><Input value={existingParentStudentMembershipIds} onChange={(event) => setExistingParentStudentMembershipIds(event.target.value)} placeholder="Comma-separated enrolled student membership IDs" /></div>}
              <div className="space-y-1"><Label>Assignment reason</Label><Input value={existingAccountReason} onChange={(event) => setExistingAccountReason(event.target.value)} placeholder="Required audit reason" /></div>
              <div className="space-y-1"><Label>Selected school</Label><p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{schools.find((school) => school.id === selectedSchoolId)?.name || "Choose a school above"}</p></div>
              <Button onClick={() => void assignExistingAccount()} disabled={assignExistingLoading || !selectedSchoolId || !existingAccountUsername.trim() || !existingAccountReason.trim()}>{assignExistingLoading ? "Assigning…" : "Assign account"}</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "super-admin" && (
        <div className="space-y-5">
          <SectionHeading eyebrow="Executive · Platform authority" title="Single Super Admin" description="The Extreme Admin is the only global platform owner. The separate Super Admin manages the single Master Minds school network." />
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Crown className="h-5 w-5 text-amber-600" />Current network authority</CardTitle><CardDescription>Database unique indexes enforce one Super Admin account and prevent the same account from holding both platform roles.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {currentSuperAdmin ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-semibold text-slate-950">{currentSuperAdmin.name}</p><p className="mt-1 text-xs text-slate-600">@{currentSuperAdmin.username || "no-username"} · {currentSuperAdmin.account_status}</p><p className="mt-1 break-all font-mono text-[11px] text-slate-500">{currentSuperAdmin.id}</p></div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No Super Admin is currently assigned.</div>}
              <div className="space-y-1"><Label>Target account</Label><Input value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} placeholder="Select an account in Accounts & access or paste its UUID" /></div>
              <div className="space-y-1"><Label>Reason</Label><Textarea value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="Document why the network authority is changing" /></div>
              <div className="flex flex-wrap gap-2"><Button onClick={() => void setSuperAdminAccount(true)} disabled={!targetUserId || !statusReason.trim()}>Assign / replace Super Admin</Button>{currentSuperAdmin && <Button variant="destructive" onClick={() => void setSuperAdminAccount(false, currentSuperAdmin.id)} disabled={!statusReason.trim()}>Revoke current Super Admin</Button>}</div>
              <p className="text-xs text-slate-500">Replacing the Super Admin revokes the previous role, preserves the account and school records, and writes an audit event.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "schools" && (
        <div className="space-y-5">
          <SectionHeading eyebrow="Executive · Network oversight" title="School network" description="Global school inventory, school status controls and secure provisioning. The current architecture intentionally has one school network and one Super Admin." />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"><div className="flex items-center gap-2 text-sm text-blue-900"><Building2 className="h-4 w-4" />All schools currently belong to the single Master Minds network.</div><Button onClick={() => setCreateSchoolOpen((open) => !open)}><Plus className="mr-2 h-4 w-4" />Register school</Button></div>
          {createSchoolOpen && <Card className="border-blue-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Register a school and provision its Manager</CardTitle><CardDescription>The existing provisioning service creates the school, generates the Manager account, and rolls back the school if account provisioning fails.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><div className="space-y-1"><Label>School name</Label><Input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="School name" /></div><div className="space-y-1"><Label>School code</Label><Input value={schoolCode} onChange={(event) => setSchoolCode(event.target.value.toUpperCase())} placeholder="2–8 letters or numbers" maxLength={8} /></div><div className="space-y-1"><Label>Initial Manager name</Label><Input value={managerName} onChange={(event) => setManagerName(event.target.value)} placeholder="Manager full name" /></div><div className="flex gap-2 md:col-span-3"><Button onClick={() => void createSchool()} disabled={createSchoolLoading}>{createSchoolLoading ? "Registering…" : "Create school & Manager"}</Button><Button variant="outline" onClick={() => setCreateSchoolOpen(false)}>Cancel</Button></div></CardContent></Card>}
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">School status change reason</CardTitle><CardDescription>A reason is required and recorded whenever a school is suspended or reactivated.</CardDescription></CardHeader><CardContent><Textarea value={schoolActionReason} onChange={(event) => setSchoolActionReason(event.target.value)} placeholder="Explain the operational reason for this school status change" rows={2} /></CardContent></Card>
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Registered schools ({formatNumber(schools.length)})</CardTitle><CardDescription>Membership totals include active memberships only. School suspension preserves records.</CardDescription></CardHeader><CardContent className="space-y-3">{schools.map((school) => <div key={school.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{school.name}</p><span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{school.school_code}</span><span className={school.status === "active" ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800" : "rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"}>{school.status}</span></div><p className="mt-2 text-xs text-slate-500">{formatNumber(school.students)} students · {formatNumber(school.teachers)} teachers · {formatNumber(school.managers)} managers · {formatNumber(school.parents)} parents · {formatNumber(school.finance_staff)} finance</p><p className="mt-1 text-[11px] text-slate-400">Registered {new Date(school.created_at).toLocaleDateString()} · {school.id}</p></div><Button size="sm" variant={school.status === "active" ? "destructive" : "outline"} onClick={() => void changeSchoolStatus(school)} disabled={school.status === "closed"}>{school.status === "active" ? "Suspend school" : school.status === "suspended" ? "Reactivate school" : "Closed · review required"}</Button></div>)}{!schools.length && <p className="py-8 text-center text-sm text-slate-500">No schools registered.</p>}</CardContent></Card>
          <p className="text-xs text-slate-500">Network transfers are not exposed as a button because the database currently enforces exactly one network row. A cross-network transfer would require a deliberate multi-network architecture change; this control center will not pretend a transfer is possible.</p>
        </div>
      )}

      {activeTab === "finance" && (
        <div className="space-y-5">
          <SectionHeading eyebrow="Business intelligence" title="Money & growth" description="Financial figures are presented only where the source records establish collection or outstanding balances. Unpaid invoices and virtual coins are never counted as revenue." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Confirmed school payments" value={metrics.school_fee_payments_confirmed} detail="Reversed payments excluded" icon={CheckCircle2} tone="green" /><MetricCard label="School invoices" value={metrics.school_invoices_total} detail="All invoice records" icon={FileText} tone="blue" /><MetricCard label="Outstanding invoices" value={metrics.school_invoices_outstanding} detail="Invoices with balance above zero" icon={Clock3} tone="amber" /><MetricCard label="Monthly active users" value={metrics.monthly_active_users} detail="Unique users seen in 30 days" icon={Activity} tone="navy" /></div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Confirmed collections · Month to date</CardTitle><CardDescription>Payments received since the start of the current Ethiopia calendar month.</CardDescription></CardHeader><CardContent>{monthlyCollectedTotals.length ? monthlyCollectedTotals.map((row) => <div key={row.currency} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"><span className="text-sm text-slate-600">{row.currency}</span><strong className="text-lg tabular-nums text-slate-950">{formatMoney(row.collected, row.currency)}</strong></div>) : <p className="text-sm text-slate-500">No confirmed collections this month.</p>}</CardContent></Card>
            <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Confirmed collections · Year to date</CardTitle><CardDescription>Payments received since the start of the current Ethiopia calendar year.</CardDescription></CardHeader><CardContent>{yearlyCollectedTotals.length ? yearlyCollectedTotals.map((row) => <div key={row.currency} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"><span className="text-sm text-slate-600">{row.currency}</span><strong className="text-lg tabular-nums text-slate-950">{formatMoney(row.collected, row.currency)}</strong></div>) : <p className="text-sm text-slate-500">No confirmed collections this year.</p>}</CardContent></Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-2"><Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Confirmed collections</CardTitle><CardDescription>School fee payments with status = confirmed, grouped by currency.</CardDescription></CardHeader><CardContent>{collectedTotals.length ? collectedTotals.map((row) => <div key={row.currency} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"><span className="text-sm text-slate-600">{row.currency}</span><strong className="text-lg tabular-nums text-slate-950">{formatMoney(row.collected, row.currency)}</strong></div>) : <p className="text-sm text-slate-500">No confirmed collections recorded.</p>}</CardContent></Card><Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Outstanding balances</CardTitle><CardDescription>Current positive invoice balances, grouped by currency.</CardDescription></CardHeader><CardContent>{outstandingTotals.length ? outstandingTotals.map((row) => <div key={row.currency} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"><span className="text-sm text-slate-600">{row.currency}</span><strong className="text-lg tabular-nums text-slate-950">{formatMoney(row.outstanding, row.currency)}</strong></div>) : <p className="text-sm text-slate-500">No outstanding balances recorded.</p>}</CardContent></Card></div>
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Growth indicators</CardTitle><CardDescription>Account creation and product activity, measured separately.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{[{ label: "New accounts · 7 days", value: metrics.registered_7d }, { label: "New accounts · 30 days", value: metrics.registered_30d }, { label: "Daily active users", value: metrics.daily_active_users }].map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-bold tabular-nums text-slate-950">{formatNumber(item.value)}</p><p className="mt-1 text-xs text-slate-500">{item.label}</p></div>)}</CardContent></Card>
        </div>
      )}

      {activeTab === "operations" && (
        <div className="space-y-5">
          <SectionHeading eyebrow="Platform operations" title="Global controls & security" description="Manage existing platform feature switches, review security indicators, and set the AI request limit. Each change is sent to the existing protected settings RPC." />
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Platform feature controls</CardTitle><CardDescription>These settings affect platform-wide behavior where the consuming feature already honors the setting.</CardDescription></CardHeader><CardContent className="divide-y divide-slate-100">{[{ key: "feature_social_enabled", label: "Social features", description: "Allow the social feature surface." }, { key: "feature_ai_enabled", label: "AI features", description: "Allow AI-powered learning features." }, { key: "feature_xp_enabled", label: "XP and progression", description: "Enable XP progression." }, { key: "leaderboard_enabled", label: "Leaderboards", description: "Enable ranking surfaces." }, { key: "grades_enabled", label: "Grade experiences", description: "Enable grade-based learning experiences." }].map((setting) => <div key={setting.key} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-semibold text-slate-900">{setting.label}</p><p className="mt-0.5 text-xs text-slate-500">{setting.description}</p></div><Switch checked={settings[setting.key] === true} onCheckedChange={(checked) => void updateSetting(setting.key, checked)} /></div>)}</CardContent></Card>
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">AI daily request limit</CardTitle><CardDescription>Existing per-user daily limit, constrained to 0–300 requests.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="w-full max-w-xs space-y-1"><Label>Maximum requests per user per day</Label><Input type="number" min="0" max="300" value={aiDailyLimit} onChange={(event) => setAiDailyLimit(event.target.value)} /></div><Button onClick={() => void updateAiLimit()}>Save limit</Button></CardContent></Card>
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-blue-700" />Security snapshot</CardTitle><CardDescription>Only database-backed indicators are shown. This is not a claim that client-side IP or 2FA settings enforce access.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["Audit events", metrics.audit_events_total ?? 0], ["Active top-level authorities", metrics.active_platform_authorities ?? 0], ["Active school managers", metrics.active_managers ?? 0], ["Suspended accounts", metrics.suspended_users ?? 0], ["Banned accounts", metrics.banned_users ?? 0]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{formatNumber(value)}</p></div>)}</CardContent></Card>
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-blue-700" />External service connectivity</CardTitle><CardDescription>Server-side checks for Supabase access, Firebase Messaging credentials and LiveKit RoomService reachability. No test push or call is sent.</CardDescription></div><Button variant="outline" onClick={() => void runServiceHealthChecks()} disabled={healthLoading}>{healthLoading ? "Checking…" : "Run health checks"}</Button></CardHeader><CardContent>{serviceHealth ? <div className="space-y-3">{[["Supabase database", serviceHealth.database], ["Firebase Messaging", serviceHealth.firebase_messaging], ["LiveKit", serviceHealth.livekit]].map(([label, check]: [string, any]) => <div key={label} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{label}</p><p className="mt-1 text-xs text-slate-500">{check?.detail || "No status returned"}</p></div><span className={check?.status === "healthy" ? "w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800" : check?.status === "degraded" ? "w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800" : "w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"}>{check?.status || "unknown"}</span></div>)}<p className="text-[11px] text-slate-400">Checked {serviceHealth.checked_at ? new Date(serviceHealth.checked_at).toLocaleString() : "just now"}</p></div> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Run a server-side check to see whether these integrations are configured and reachable. Results are not inferred from frontend settings.</p>}</CardContent></Card>
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-blue-700" />Platform operations signals</CardTitle><CardDescription>Database-backed configuration and activity indicators from the current platform.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Enabled push devices", metrics.notification_devices_enabled], ["FCM accepted events · 24h", metrics.notification_fcm_accepted_24h], ["Push failures · 24h", metrics.notification_failed_24h], ["Push skipped · 24h", metrics.notification_skipped_24h], ["Inbox events · 24h", metrics.notification_inbox_events_24h], ["Study call rooms · 24h", metrics.study_call_rooms_24h], ["Storage buckets", metrics.storage_buckets_configured], ["Database metrics RPC", metrics.metrics_generated_at ? "Available" : "Unknown"]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{typeof value === "string" ? value : formatNumber(value)}</p></div>)}</CardContent><div className="border-t border-slate-100 px-6 py-3 text-xs text-amber-800">FCM acceptance means Firebase accepted at least one send for that inbox event; it does not guarantee device display. LiveKit room counts are activity records, not a provider reachability test. External uptime probes remain a separate Part 1 task.</div></Card>
        </div>
      )}

      {activeTab === "privacy" && (
        <div className="space-y-5">
          <SectionHeading eyebrow="Platform operations" title="Privacy & account requests" description="Review account deletion requests with an explicit preflight. The portal does not bypass the supported Auth deletion and retention workflow." />
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Record an external deletion request</CardTitle><CardDescription>For requests received outside the app. Record the account email and verification context before adding it to the protected queue.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><div className="space-y-1"><Label>Account email</Label><Input type="email" value={externalDeletionEmail} onChange={(event) => setExternalDeletionEmail(event.target.value)} placeholder="Account email" /></div><div className="space-y-1"><Label>Username (optional)</Label><Input value={externalDeletionUsername} onChange={(event) => setExternalDeletionUsername(event.target.value)} placeholder="Account username" /></div><div className="space-y-1"><Label>Verification note</Label><Input value={externalDeletionNote} onChange={(event) => setExternalDeletionNote(event.target.value)} placeholder="How was the request verified?" /></div><div className="md:col-span-3"><Button onClick={() => void createExternalDeletionRequest()} disabled={!externalDeletionEmail.trim() || !externalDeletionNote.trim()}>Record request</Button></div></CardContent></Card>
          <div className="space-y-3">{deletionRequests.map((request) => <Card key={request.id} className="border-slate-200 bg-white shadow-sm"><CardContent className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{request.requested_email}</p><p className="mt-1 text-xs text-slate-500">@{request.requested_username || "no-username"} · {request.source} · {new Date(request.requested_at).toLocaleString()}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{request.status}</span></div>{request.requester_note && <p className="text-sm text-slate-600">{request.requester_note}</p>}<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void runDeletionPreflight(request)} disabled={privacyLoadingId === request.id}>{privacyLoadingId === request.id ? "Checking…" : "Run read-only preflight"}</Button>{request.status !== "completed" && request.status !== "rejected" && <><Button size="sm" variant="outline" onClick={() => void updateDeletionRequest(request, "in_review")}>Mark in review</Button><Button size="sm" variant="destructive" onClick={() => void updateDeletionRequest(request, "rejected")}>Reject</Button>{!request.user_id && <Button size="sm" onClick={() => void updateDeletionRequest(request, "completed")}>Mark completed</Button>}</>}</div>{privacyPreflight[request.id] && <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] text-slate-100">{JSON.stringify(privacyPreflight[request.id], null, 2)}</pre>}</CardContent></Card>)}{!deletionRequests.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No account deletion requests are currently listed.</div>}</div>
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Review note</CardTitle><CardDescription>A documented reason is required before changing a request's status.</CardDescription></CardHeader><CardContent><Textarea value={privacyNote} onChange={(event) => setPrivacyNote(event.target.value)} placeholder="Record identity verification, guardian authority where relevant, retention review and resolution" rows={3} /></CardContent></Card>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="space-y-5">
          <SectionHeading eyebrow="Platform operations" title="Audit history" description="Recent privileged actions from the existing admin audit log. This history is not fabricated from UI interactions." />
          <Card className="border-slate-200 bg-white shadow-sm"><CardHeader><CardTitle className="text-base">Latest 100 audit events</CardTitle><CardDescription>Actor, action, target and timestamp.</CardDescription></CardHeader><CardContent className="space-y-2">{logs.map((log) => <div key={log.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{log.action}</p><time className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</time></div><p className="mt-1 text-xs text-slate-600">Actor: {log.actor_name || log.actor_id || "Unknown"}</p><p className="mt-1 break-all text-[11px] text-slate-500">Target: {log.target_type || "—"} / {log.target_id || "—"}</p>{log.details && <details className="mt-2"><summary className="cursor-pointer text-xs font-medium text-blue-700">View event details</summary><pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">{JSON.stringify(log.details, null, 2)}</pre></details>}</div>)}{!logs.length && <p className="py-8 text-center text-sm text-slate-500">No audit events were returned.</p>}</CardContent></Card>
        </div>
      )}

      {provisioningResult && (
        <div className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-6">
          <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Provisioning result</p><p className="mt-1 text-xs text-slate-500">Initial credentials are shown once here. Share them securely with the account holder and require a password change.</p></div><Button size="icon" variant="ghost" onClick={() => setProvisioningResult(null)} aria-label="Dismiss credentials"><XCircle className="h-4 w-4" /></Button></div>
          {provisioningResult.kind === "school" ? <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700"><p>School: <strong>{provisioningResult.data?.school?.name}</strong></p><p className={provisioningResult.data?.school?.audit_recorded === false ? "mt-1 text-red-700" : "mt-1 text-emerald-700"}>School audit: {provisioningResult.data?.school?.audit_recorded === false ? provisioningResult.data?.school?.audit_warning || "Review required" : "Recorded"}</p><p>Manager username: <strong>{provisioningResult.data?.manager?.username}</strong></p><p>Initial password: <strong className="select-all font-mono">{provisioningResult.data?.manager?.initial_password}</strong></p><p className={provisioningResult.data?.manager?.audit_recorded === false ? "mt-1 text-red-700" : "mt-1 text-emerald-700"}>Audit: {provisioningResult.data?.manager?.audit_recorded === false ? provisioningResult.data?.manager?.audit_warning || "Review required" : "Recorded"}</p></div> : provisioningResult.kind === "assigned" ? <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700"><p>Username: <strong>{provisioningResult.data?.username}</strong></p><p>School role: <strong>{provisioningResult.data?.role}</strong></p><p>Membership ID: <strong className="font-mono">{provisioningResult.data?.membership_id}</strong></p></div> : <div className="mt-3 space-y-2">{(provisioningResult.data?.created || []).map((account: any, index: number) => <div key={account.membership_id || index} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700"><p>Username: <strong>{account.username}</strong> · Role: {account.role}{account.student_id ? ` · Student ID: ${account.student_id}` : ""}</p>{account.grade && <p>Grade: {account.grade} · Age: {account.age_at_enrollment}</p>}<p>Initial password: <strong className="select-all font-mono">{account.initial_password}</strong></p><p className={account.audit_recorded === false ? "mt-1 text-red-700" : "mt-1 text-emerald-700"}>Audit: {account.audit_recorded === false ? account.audit_warning || "Review required" : "Recorded"}</p></div>)}{(provisioningResult.data?.failed || []).map((failure: any) => <p key={failure.index} className="text-xs text-red-700">Account {failure.index + 1}: {failure.message}</p>)}</div>}
        </div>
      )}
    </AdminCommandCenterShell>
  );
};

export default ExtremeAdminPortal;
