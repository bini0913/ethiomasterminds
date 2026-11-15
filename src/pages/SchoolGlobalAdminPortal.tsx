import React, { useCallback, useEffect, useState } from "react";
import { Building2, LayoutDashboard, Plus, ShieldCheck, Users, RefreshCw, KeyRound, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField,
  schoolInputClass, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "schools", label: "Schools", icon: Building2 },
  { id: "managers", label: "School Managers", icon: Users },
  { id: "credentials", label: "Generated Credentials", icon: KeyRound },
];

export default function SchoolGlobalAdminPortal() {
  const db = supabase as any;
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [firstManagerName, setFirstManagerName] = useState("");
  const [managerSchoolId, setManagerSchoolId] = useState("");
  const [additionalManagerName, setAdditionalManagerName] = useState("");
  const [credentials, setCredentials] = useState<any[]>([]);
  const [credentialContext, setCredentialContext] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [schoolsRes, membershipsRes, invoicesRes] = await Promise.all([
      db.from("schools").select("id,name,school_code,status,created_at").order("created_at", { ascending: false }),
      db.from("school_memberships").select("id,school_id,user_id,school_role,status,school_username").order("created_at", { ascending: false }),
      db.from("school_student_invoices").select("school_id,balance,currency,status"),
    ]);
    const error = [schoolsRes, membershipsRes, invoicesRes].find((result) => result.error)?.error;
    if (error) {
      toast.error(error.message || "School network records could not be loaded.");
      setLoading(false);
      return;
    }
    setSchools(schoolsRes.data ?? []);
    setMemberships(membershipsRes.data ?? []);
    setInvoices(invoicesRes.data ?? []);
    const managerUserIds = [...new Set((membershipsRes.data ?? []).filter((membership: any) => membership.school_role === "manager").map((membership: any) => membership.user_id))];
    if (managerUserIds.length) {
      const { data: profileRows, error: profileError } = await db.from("profiles").select("id,name,username").in("id", managerUserIds);
      if (profileError) toast.error(profileError.message);
      setProfiles(Object.fromEntries((profileRows ?? []).map((profile: any) => [profile.id, profile])));
    } else setProfiles({});
    if (!managerSchoolId && schoolsRes.data?.length) setManagerSchoolId(schoolsRes.data[0].id);
    setLoading(false);
  }, [db, managerSchoolId]);

  useEffect(() => { void load(); }, [load]);

  const schoolStats = (schoolId: string) => {
    const schoolMembers = memberships.filter((membership) => membership.school_id === schoolId);
    const schoolInvoices = invoices.filter((invoice) => invoice.school_id === schoolId);
    const outstanding = schoolInvoices.filter((invoice) => Number(invoice.balance) > 0).reduce((total, invoice) => total + Number(invoice.balance || 0), 0);
    return {
      managers: schoolMembers.filter((membership) => membership.school_role === "manager" && membership.status === "active").length,
      students: schoolMembers.filter((membership) => membership.school_role === "student" && membership.status === "active").length,
      teachers: schoolMembers.filter((membership) => membership.school_role === "teacher" && membership.status === "active").length,
      parents: schoolMembers.filter((membership) => membership.school_role === "parent" && membership.status === "active").length,
      invoices: schoolInvoices.length,
      outstanding,
    };
  };

  const createSchool = async (event: React.FormEvent) => {
    event.preventDefault();
    if (schoolName.trim().length < 2 || !/^[A-Za-z0-9]{2,8}$/.test(schoolCode.trim()) || firstManagerName.trim().length < 2) {
      return toast.error("Enter a school name, a 2–8 character school code, and the first Manager's name.");
    }
    const { data, error } = await supabase.functions.invoke("school-provision-account", {
      body: {
        action: "create_school",
        school: { name: schoolName.trim(), school_code: schoolCode.trim().toUpperCase() },
        manager: { name: firstManagerName.trim() },
      },
    });
    if (error || data?.error) return toast.error(data?.error || error?.message || "School could not be created.");
    setCredentials([{
      role: "School Manager", name: firstManagerName.trim(),
      username: data.manager.username, initial_password: data.manager.initial_password,
      school_name: data.school.name, must_change_password: true,
    }]);
    setCredentialContext(`Initial Manager credentials for ${data.school.name}`);
    setSchoolName(""); setSchoolCode(""); setFirstManagerName("");
    toast.success("School and its first Manager account created.");
    setPage("credentials");
    await load();
  };

  const createAdditionalManager = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!managerSchoolId || additionalManagerName.trim().length < 2) return toast.error("Choose a school and enter the Manager's name.");
    const { data, error } = await supabase.functions.invoke("school-provision-account", {
      body: {
        action: "create_accounts", school_id: managerSchoolId, role: "manager",
        accounts: [{ name: additionalManagerName.trim() }],
      },
    });
    if (error || data?.error || !data?.created?.length) return toast.error(data?.error || data?.failed?.[0]?.message || error?.message || "Manager account could not be created.");
    const created = data.created[0];
    const school = schools.find((item) => item.id === managerSchoolId);
    setCredentials([{
      role: "School Manager", name: additionalManagerName.trim(),
      username: created.username, initial_password: created.initial_password,
      school_name: school?.name || "Selected school", must_change_password: true,
    }]);
    setCredentialContext(`Initial Manager credentials for ${school?.name || "selected school"}`);
    setAdditionalManagerName("");
    toast.success("Additional School Manager account created.");
    setPage("credentials");
    await load();
  };

  const changeSchoolStatus = async (school: any) => {
    const nextStatus = school.status === "active" ? "suspended" : "active";
    if (!window.confirm(`${nextStatus === "suspended" ? "Suspend" : "Reactivate"} ${school.name}? This changes school access for all its members.`)) return;
    const { error } = await db.from("schools").update({ status: nextStatus }).eq("id", school.id);
    if (error) return toast.error(error.message);
    toast.success(`${school.name} is now ${nextStatus}.`);
    await load();
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <SchoolPageHeading title="School network overview" description="Global oversight of schools, their Managers, enrollment, and school finance activity." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Schools" value={schools.length} detail="Registered school tenants" icon={Building2} />
        <SchoolMetric label="Active schools" value={schools.filter((school) => school.status === "active").length} detail="Currently enabled" icon={ShieldCheck} />
        <SchoolMetric label="School Managers" value={memberships.filter((membership) => membership.school_role === "manager" && membership.status === "active").length} detail="Active school-level authorities" icon={Users} />
        <SchoolMetric label="Enrolled students" value={memberships.filter((membership) => membership.school_role === "student" && membership.status === "active").length} detail="Across all schools" icon={Users} />
      </div>
      <SchoolPanel title="School network">
        {schools.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">School</th><th className="pb-2">Code</th><th className="pb-2">Managers</th><th className="pb-2">Students</th><th className="pb-2">Teachers</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{schools.map((school) => { const stats = schoolStats(school.id); return <tr key={school.id}><td className="py-3 font-semibold text-slate-800">{school.name}</td><td className="py-3 font-mono text-slate-600">{school.school_code}</td><td className="py-3 tabular-nums text-slate-600">{stats.managers}</td><td className="py-3 tabular-nums text-slate-600">{stats.students}</td><td className="py-3 tabular-nums text-slate-600">{stats.teachers}</td><td className="py-3"><SchoolStatus value={school.status} /></td></tr>; })}</tbody></table></div> : <SchoolEmptyState title="No schools created" description="Create the first school and its Manager account from the Schools page." />}
      </SchoolPanel>
    </div>
  );

  const renderSchools = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Create and manage schools" description="Creating a school also provisions its first Manager account. School codes are unique and are used in school student usernames." />
      <SchoolPanel title="Create school and first Manager">
        <form onSubmit={createSchool} className="grid gap-3 md:grid-cols-3">
          <SchoolField label="School name"><input className={schoolInputClass} value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Boriyad School" /></SchoolField>
          <SchoolField label="School code"><input className={schoolInputClass} value={schoolCode} onChange={(event) => setSchoolCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} placeholder="BRO" /></SchoolField>
          <SchoolField label="First Manager's full name"><input className={schoolInputClass} value={firstManagerName} onChange={(event) => setFirstManagerName(event.target.value)} placeholder="Manager name" /></SchoolField>
          <div className="md:col-span-3"><SchoolPrimaryButton type="submit"><Plus className="mr-2 h-4 w-4" />Create school and Manager</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Registered schools">
        {schools.length ? <div className="space-y-3">{schools.map((school) => <div key={school.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><p className="text-sm font-semibold text-slate-800">{school.name} <span className="ml-2 font-mono text-xs text-slate-500">{school.school_code}</span></p><p className="mt-1 text-xs text-slate-500">{schoolStats(school.id).students} students · {schoolStats(school.id).teachers} teachers · {schoolStats(school.id).managers} Managers</p></div><div className="flex items-center gap-2"><SchoolStatus value={school.status} /><SchoolSecondaryButton onClick={() => void changeSchoolStatus(school)}>{school.status === "active" ? <><PauseCircle className="mr-2 h-4 w-4" />Suspend</> : <><PlayCircle className="mr-2 h-4 w-4" />Reactivate</>}</SchoolSecondaryButton></div></div>)}</div> : <SchoolEmptyState title="No schools yet" description="Create a school above." />}
      </SchoolPanel>
    </div>
  );

  const renderManagers = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="School Managers" description="Create additional Manager accounts for existing schools. Only the Super Admin can provision or authorize Managers." />
      <SchoolPanel title="Create additional Manager">
        <form onSubmit={createAdditionalManager} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="School"><select className={schoolSelectClass} value={managerSchoolId} onChange={(event) => setManagerSchoolId(event.target.value)}><option value="">Choose school</option>{schools.filter((school) => school.status === "active").map((school) => <option key={school.id} value={school.id}>{school.name} · {school.school_code}</option>)}</select></SchoolField>
          <SchoolField label="Manager full name"><input className={schoolInputClass} value={additionalManagerName} onChange={(event) => setAdditionalManagerName(event.target.value)} /></SchoolField>
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit">Create Manager account</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Current Managers">
        {memberships.filter((membership) => membership.school_role === "manager").length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Manager</th><th className="pb-2">Username</th><th className="pb-2">School</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{memberships.filter((membership) => membership.school_role === "manager").map((manager) => <tr key={manager.id}><td className="py-3 font-medium text-slate-800">{profiles[manager.user_id]?.name || "Manager"}</td><td className="py-3 font-mono text-xs text-slate-600">{manager.school_username || profiles[manager.user_id]?.username || "—"}</td><td className="py-3 text-slate-600">{schools.find((school) => school.id === manager.school_id)?.name || "—"}</td><td className="py-3"><SchoolStatus value={manager.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No Managers yet" description="Create a school or add a Manager account above." />}
      </SchoolPanel>
    </div>
  );

  const renderCredentials = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Generated Manager credentials" description="Initial credentials are shown only in this restricted Super Admin view. Give them privately to the Manager; they must change the password at first sign-in." />
      {credentials.length ? <SchoolPanel title={credentialContext} description="Copy and deliver these credentials privately. They are not written into school reports.">
        <div className="space-y-3">{credentials.map((credential, index) => <div key={index} className="rounded-lg border border-slate-200 p-3"><p className="text-sm font-semibold text-slate-800">{credential.name} · {credential.school_name}</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Username</p><p className="font-mono text-sm text-slate-800">{credential.username}</p></div><div><p className="text-xs text-slate-500">Initial password</p><p className="font-mono text-sm text-slate-800">{credential.initial_password}</p></div></div><p className="mt-2 text-xs text-amber-700">Must change password at first sign-in.</p><div className="mt-2 flex flex-wrap gap-2"><SchoolSecondaryButton onClick={() => void navigator.clipboard.writeText(`Username: ${credential.username}\nInitial password: ${credential.initial_password}`)}>Copy credentials</SchoolSecondaryButton></div></div>)}</div>
        <div className="mt-3"><SchoolSecondaryButton onClick={() => { setCredentials([]); setCredentialContext(""); }}>Clear credentials from this screen</SchoolSecondaryButton></div>
      </SchoolPanel> : <SchoolEmptyState title="No credentials to display" description="Credentials appear here immediately after you create a school Manager." />}
    </div>
  );

  let content: React.ReactNode;
  switch (page) {
    case "schools": content = renderSchools(); break;
    case "managers": content = renderManagers(); break;
    case "credentials": content = renderCredentials(); break;
    default: content = renderOverview();
  }

  return (
    <SchoolPortalShell role="super_admin" title="Super Admin · Schools" navItems={navItems} activeItem={page} onNavigate={setPage}>
      {loading && <div className="mb-4 text-xs text-slate-500">Refreshing global school records…</div>}
      {content}
    </SchoolPortalShell>
  );
}
