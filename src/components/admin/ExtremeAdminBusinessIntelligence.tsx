import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Download, RefreshCw, Wallet, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type MoneyRow = { currency: string; collected?: number; outstanding?: number; balance?: number; paid?: number };
type BIData = {
  generated_at: string;
  days: number;
  platform_finance: {
    active_accounts: number;
    account_balances: { currency: string; balance: number }[];
    invoice_count: number;
    payment_records: number;
    paid_amount_by_currency: { currency: string; paid: number }[];
    transaction_records: number;
    ledger_statuses: { status: string; direction: string; records: number }[];
    receivables_by_currency: MoneyRow[];
  };
  school_finance: {
    invoice_count: number;
    confirmed_payment_count: number;
    outstanding_invoice_count: number;
    collections_by_currency: MoneyRow[];
    outstanding_by_currency: MoneyRow[];
    by_school: { school_id: string; school_name: string; school_code: string; invoice_count: number; outstanding_invoice_count: number; outstanding_by_currency: { currency: string; amount: number }[]; collections_by_currency: { currency: string; amount: number }[] }[];
    payment_methods: { method: string; currency: string; collected: number; payments: number }[];
    daily_collections: { day: string; currency: string; collected: number }[];
  };
  growth: {
    registrations_by_day: { day: string; registrations: number }[];
    student_activity_by_day: { day: string; active_students: number; questions: number; correct: number; quizzes: number; xp: number }[];
    study_sessions_by_day: { day: string; sessions: number; duration_units: number }[];
    activity_summary: { active_students: number; repeat_active_students: number; active_days_total: number; questions: number; correct: number; quizzes: number; xp: number };
  };
};
const number = (v: unknown) => Number(v || 0).toLocaleString();
const money = (v: unknown, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(v || 0)); }
  catch { return `${currency} ${Number(v || 0).toLocaleString()}`; }
};
const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <Card className="border-slate-200 bg-white shadow-sm">
    <CardHeader><CardTitle className="text-base">{title}</CardTitle>{note && <CardDescription>{note}</CardDescription>}</CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
const Metric = ({ title, value, detail, icon: Icon }: { title: string; value: unknown; detail: string; icon: React.ElementType }) => (
  <Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{number(value)}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><Icon className="h-5 w-5 text-blue-700" /></div>
  </CardContent></Card>
);
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const downloadCsv = (rows: unknown[][], filename: string) => {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
};

const ExtremeAdminBusinessIntelligence: React.FC<{ schools: { id: string; name: string; school_code: string }[] }> = ({ schools }) => {
  const [days, setDays] = useState("30");
  const [schoolId, setSchoolId] = useState("all");
  const [data, setData] = useState<BIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const report = await supabase.rpc("extreme_admin_get_business_intelligence" as any, { p_days: Number(days), p_school_id: schoolId === "all" ? null : schoolId });
    if (report.error) { setData(null); setError(report.error.message || "Business intelligence could not be loaded"); setLoading(false); return; }
    setData(report.data as BIData);
    setLoading(false);
  }, [days, schoolId]);

  useEffect(() => { void load(); }, [load]);

  const exportRows = useMemo(() => {
    if (!data) return [];
    const rows: unknown[][] = [["section", "date_or_school", "metric", "currency", "value", "detail"]];
    data.school_finance.collections_by_currency.forEach((r) => rows.push(["school collections", "all time", "confirmed collections", r.currency, r.collected, "Confirmed payments only"]));
    data.school_finance.outstanding_by_currency.forEach((r) => rows.push(["school receivables", "current", "outstanding invoice balance", r.currency, r.outstanding, "Positive invoice balance"]));
    data.platform_finance.account_balances.forEach((r) => rows.push(["platform finance", "current", "account balance", r.currency, r.balance, "Existing finance account balance; not revenue"]));
    data.platform_finance.paid_amount_by_currency.forEach((r) => rows.push(["platform finance", "all time", "recorded invoice payments", r.currency, r.paid, "Payment records with paid_at"]));
    data.school_finance.by_school.forEach((s) => {
      s.collections_by_currency.forEach((r) => rows.push(["school collections", s.school_name, "confirmed collections", r.currency, r.amount, s.school_code]));
      s.outstanding_by_currency.forEach((r) => rows.push(["school receivables", s.school_name, "outstanding", r.currency, r.amount, s.school_code]));
    });
    data.school_finance.payment_methods.forEach((r) => rows.push(["school collections", "all time", "payment method", r.currency, r.collected, `${r.method}; ${r.payments} payments`]));
    data.school_finance.daily_collections.forEach((r) => rows.push(["school collections", r.day, "daily confirmed collections", r.currency, r.collected, "Confirmed payments only"]));
    data.growth.registrations_by_day.forEach((r) => rows.push(["growth", r.day, "new registrations", "", r.registrations, "Profile creation date"]));
    data.growth.student_activity_by_day.forEach((r) => rows.push(["usage", r.day, "active students", "", r.active_students, `${r.questions} questions; ${r.quizzes} quizzes; ${r.xp} XP`]));
    data.growth.study_sessions_by_day.forEach((r) => rows.push(["usage", r.day, "study sessions", "", r.sessions, `${r.duration_units} recorded duration units`]));
    return rows;
  }, [data]);

  const repeatRate = data?.growth.activity_summary.active_students
    ? data.growth.activity_summary.repeat_active_students / data.growth.activity_summary.active_students * 100 : null;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-2xl bg-[#0b1f3a] p-5 text-white sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-200">Part 2 · Money, growth & intelligence</p><h2 className="mt-2 text-2xl font-bold">Business performance</h2><p className="mt-1 max-w-2xl text-sm text-slate-300">Separate platform finance from school-fee collections. All values come from existing records; currencies remain separate.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => downloadCsv(exportRows, `master-minds-business-intelligence-${days}d.csv`)} disabled={!data || !exportRows.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="w-full sm:w-48"><label className="mb-1 block text-xs font-semibold text-slate-600">Activity window</label><Select value={days} onValueChange={setDays}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select></div>
      <div className="w-full sm:w-72"><label className="mb-1 block text-xs font-semibold text-slate-600">School finance filter</label><Select value={schoolId} onValueChange={setSchoolId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All schools</SelectItem>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.school_code}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {loading && !data && <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading verified business data…</div>}
    {data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Confirmed school payments" value={data.school_finance.confirmed_payment_count} detail="Verified payment records · not a cross-currency sum" icon={Wallet} />
        <Metric title="Outstanding school invoices" value={data.school_finance.outstanding_invoice_count} detail={`${number(data.school_finance.invoice_count)} invoices in scope`} icon={FileText} />
        <Metric title="New registrations" value={data.growth.registrations_by_day.reduce((n, r) => n + Number(r.registrations), 0)} detail={`Last ${days} days · profile creation`} icon={Users} />
        <Metric title="Active students" value={data.growth.activity_summary.active_students} detail={`Last ${days} days · recorded daily learning activity`} icon={Activity} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Platform finance" note="A separate platform-level ledger. Account balances and payment records are not represented as school-fee income.">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Active finance accounts</p><p className="mt-1 text-xl font-bold">{number(data.platform_finance.active_accounts)}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Ledger transactions</p><p className="mt-1 text-xl font-bold">{number(data.platform_finance.transaction_records)}</p></div></div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current account balances</p>
            {data.platform_finance.account_balances.length ? data.platform_finance.account_balances.map((r) => <div key={r.currency} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{r.currency}</span><strong>{money(r.balance, r.currency)}</strong></div>) : <p className="text-sm text-slate-500">No active platform finance accounts.</p>}
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Platform receivables</p>
            {data.platform_finance.receivables_by_currency.length ? data.platform_finance.receivables_by_currency.map((r) => <div key={r.currency} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{r.currency}</span><strong>{money(r.outstanding, r.currency)}</strong></div>) : <p className="text-sm text-slate-500">No unpaid platform finance invoices.</p>}
            <p className="pt-2 text-xs text-slate-500">{number(data.platform_finance.invoice_count)} invoices · {number(data.platform_finance.payment_records)} payment records. No platform revenue is inferred from balances.</p>
          </div>
        </Section>
        <Section title="School collections & receivables" note="Only payments marked confirmed are counted. Positive invoice balances remain receivables, not revenue.">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmed collections by currency</p>
            {data.school_finance.collections_by_currency.length ? data.school_finance.collections_by_currency.map((r) => <div key={r.currency} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{r.currency}</span><strong>{money(r.collected, r.currency)}</strong></div>) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No confirmed school-fee payments recorded yet.</p>}
            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Outstanding by currency</p>
            {data.school_finance.outstanding_by_currency.length ? data.school_finance.outstanding_by_currency.map((r) => <div key={r.currency} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{r.currency}</span><strong>{money(r.outstanding, r.currency)}</strong></div>) : <p className="text-sm text-slate-500">No outstanding balances.</p>}
          </div>
        </Section>
      </div>
      <Section title="Collections by school" note="Each school's collection and outstanding balance is shown separately by currency.">
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">School</th><th className="px-3 py-2">Invoices</th><th className="px-3 py-2">Open invoices</th><th className="px-3 py-2">Confirmed collections</th><th className="px-3 py-2">Outstanding</th></tr></thead><tbody className="divide-y divide-slate-100">{data.school_finance.by_school.map((s) => <tr key={s.school_id}><td className="px-3 py-3"><p className="font-semibold">{s.school_name}</p><p className="text-xs text-slate-500">{s.school_code}</p></td><td className="px-3 py-3">{number(s.invoice_count)}</td><td className="px-3 py-3">{number(s.outstanding_invoice_count)}</td><td className="px-3 py-3">{s.collections_by_currency.length ? s.collections_by_currency.map((r) => <div key={r.currency}>{money(r.amount, r.currency)}</div>) : "—"}</td><td className="px-3 py-3">{s.outstanding_by_currency.length ? s.outstanding_by_currency.map((r) => <div key={r.currency}>{money(r.amount, r.currency)}</div>) : "—"}</td></tr>)}{!data.school_finance.by_school.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No schools in this filter.</td></tr>}</tbody></table></div>
      </Section>
      <div className="grid gap-4 xl:grid-cols-2">
      <Section title={\`Daily confirmed collections · \${days} days\`} note="Daily totals are kept separate by currency and include confirmed payments only.">
        {data.school_finance.daily_collections.length ? <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Currency</th><th className="px-3 py-2 text-right">Collected</th></tr></thead><tbody className="divide-y divide-slate-100">{data.school_finance.daily_collections.map((r) => <tr key={\`\${r.day}-\${r.currency}\`}><td className="px-3 py-2">{r.day}</td><td className="px-3 py-2">{r.currency}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{money(r.collected, r.currency)}</td></tr>)}</tbody></table></div> : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No confirmed collections in this date window.</p>}
      </Section>
        <Section title="Payment methods" note="Confirmed school payments, grouped by recorded method and currency.">
          {data.school_finance.payment_methods.length ? <div className="space-y-2">{data.school_finance.payment_methods.map((r) => <div key={r.method + r.currency} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{r.method} · {r.currency} <span className="text-xs text-slate-500">({number(r.payments)} payments)</span></span><strong>{money(r.collected, r.currency)}</strong></div>)}</div> : <p className="text-sm text-slate-500">No confirmed payment method records yet.</p>}
        </Section>
        <Section title="Growth & engagement" note="Historical student learning activity is sourced from the daily activity ledger, not inferred from current presence snapshots.">
          <div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Repeat-active students</p><p className="mt-1 text-xl font-bold">{number(data.growth.activity_summary.repeat_active_students)}</p><p className="text-xs text-slate-500">2+ active days in period</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Repeat-active share</p><p className="mt-1 text-xl font-bold">{repeatRate === null ? "—" : `${repeatRate.toFixed(1)}%`}</p><p className="text-xs text-slate-500">Of active students; not cohort retention</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Questions answered</p><p className="mt-1 text-xl font-bold">{number(data.growth.activity_summary.questions)}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Quizzes completed</p><p className="mt-1 text-xl font-bold">{number(data.growth.activity_summary.quizzes)}</p></div></div>
        </Section>
      </div>
      <Section title={`Daily growth & learning · ${days} days`} note="Missing dates are displayed as zero only for chart context; no activity is fabricated.">
        <div className="space-y-2">{Array.from({ length: Number(days) }, (_, i) => {
          const day = new Date(); day.setDate(day.getDate() - (Number(days) - 1 - i));
          const key = day.toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" });
          const registration = data.growth.registrations_by_day.find((r) => r.day === key)?.registrations || 0;
          const activity = data.growth.student_activity_by_day.find((r) => r.day === key);
          const sessions = data.growth.study_sessions_by_day.find((r) => r.day === key);
          const max = Math.max(1, ...data.growth.registrations_by_day.map((r) => r.registrations), ...data.growth.student_activity_by_day.map((r) => r.active_students));
          return <div key={key} className="grid grid-cols-[76px_1fr_auto] items-center gap-3 text-xs"><span className="text-slate-500">{key.slice(5)}</span><div className="space-y-1"><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${registration / max * 100}%` }} /></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(activity?.active_students || 0) / max * 100}%` }} /></div></div><span className="tabular-nums text-slate-600">{registration} signups · {activity?.active_students || 0} active · {sessions?.sessions || 0} sessions</span></div>;
        })}</div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span>Blue: new registrations</span><span>Green: active students from daily learning activity</span></div>
      </Section>
      <p className="text-[11px] text-slate-400">Generated {new Date(data.generated_at).toLocaleString()} · All amounts preserve source currency · No demo values or cross-currency totals.</p>
    </>}
  </div>;
};

export default ExtremeAdminBusinessIntelligence;
