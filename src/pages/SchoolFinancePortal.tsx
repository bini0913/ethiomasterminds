import React, { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard, Wallet, Receipt, CreditCard, Bell, FileBarChart,
  RefreshCw, Plus, Send, RotateCcw, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolPortal } from "@/context/SchoolPortalContext";
import SchoolPortalShell, { SchoolNavItem } from "@/components/school/SchoolPortalShell";
import SchoolLeadershipShortcut from "@/components/school/SchoolLeadershipShortcut";
import {
  SchoolPageHeading, SchoolMetric, SchoolPanel, SchoolStatus, SchoolEmptyState,
  SchoolPrimaryButton, SchoolSecondaryButton, SchoolField,
  schoolInputClass, schoolSelectClass,
} from "@/components/school/SchoolPortalPrimitives";

const navItems: SchoolNavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "fees", label: "Fee Structures", icon: Wallet },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "payments", label: "Payments & Receipts", icon: CreditCard },
  { id: "followups", label: "Unpaid Follow-ups", icon: ClipboardList },
  { id: "reports", label: "Finance Reports", icon: FileBarChart },
];

export default function SchoolFinancePortal() {
  const { activeSchool, activeMembership } = useSchoolPortal();
  const db = supabase as any;
  const schoolId = activeSchool?.id;
  const [page, setPage] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [fees, setFees] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [sections, setSections] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);

  const [generateFeeId, setGenerateFeeId] = useState("");
  const [generateSectionId, setGenerateSectionId] = useState("");
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [reminderInvoiceId, setReminderInvoiceId] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [followupInvoiceId, setFollowupInvoiceId] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [reverseReason, setReverseReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
    const [
      feesRes, invoicesRes, paymentsRes, followupsRes, membersRes,
      sectionsRes, yearsRes, auditRes,
    ] = await Promise.all([
      db.from("school_fee_structures").select("id,academic_year_id,grade_label,fee_name,description,amount,currency,due_date,is_mandatory,active,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }),
      db.from("school_student_invoices").select("id,fee_structure_id,student_membership_id,invoice_number,description,amount,paid_amount,balance,currency,due_date,status,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(500),
      db.from("school_fee_payments").select("id,invoice_id,amount,payment_method,reference,receipt_number,status,reversal_reason,received_at").eq("school_id", schoolId).order("received_at", { ascending: false }).limit(500),
      db.from("school_finance_followups").select("id,invoice_id,student_membership_id,submitted_by_membership_id,note,status,reviewed_at,resolution_note,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200),
      db.from("school_memberships").select("id,user_id,school_role,status,grade_label,section_id,school_username").eq("school_id", schoolId).in("school_role", ["student", "parent", "admin", "teacher", "finance"]),
      db.from("school_sections").select("id,academic_year_id,grade_label,section_name").eq("school_id", schoolId),
      db.from("school_academic_years").select("id,name,is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
      db.from("school_finance_audit_events").select("id,entity_type,entity_id,event_type,details,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(100),
    ]);
    const error = [feesRes, invoicesRes, paymentsRes, followupsRes, membersRes, sectionsRes, yearsRes, auditRes].find((result) => result.error)?.error;
    if (error) {
      toast.error(error.message || "Finance records could not be loaded.");
      setLoading(false);
      return;
    }
    setFees(feesRes.data ?? []);
    setInvoices(invoicesRes.data ?? []);
    setPayments(paymentsRes.data ?? []);
    setFollowups(followupsRes.data ?? []);
    setMembers(membersRes.data ?? []);
    setSections(sectionsRes.data ?? []);
    setYears(yearsRes.data ?? []);
    setAuditEvents(auditRes.data ?? []);
    const userIds = [...new Set((membersRes.data ?? []).map((member: any) => member.user_id))];
    if (userIds.length) {
      const { data: profileRows, error: profileError } = await db.from("profiles").select("id,name,username").in("id", userIds);
      if (profileError) toast.error(profileError.message);
      setProfiles(Object.fromEntries((profileRows ?? []).map((profile: any) => [profile.id, profile])));
    }
    } catch (error: unknown) {
      console.error("[Master Minds] SchoolFinancePortal.tsx data load failed", error);
      toast.error(error instanceof Error ? error.message : "This workspace could not load its records. Please retry.");
    } finally {
      setLoading(false);
    }
    setLoading(false);
  }, [schoolId, db]);

  useEffect(() => { void load(); }, [load]);

  const memberName = (membershipId: string) => {
    const member = members.find((item) => item.id === membershipId);
    return member ? profiles[member.user_id]?.name || member.school_username || "School member" : "School member";
  };
  const invoiceFor = (invoiceId: string) => invoices.find((invoice) => invoice.id === invoiceId);
  const outstandingInvoices = invoices.filter((invoice) => Number(invoice.balance) > 0);
  const outstandingByCurrency = outstandingInvoices.reduce((totals: Record<string, number>, invoice) => {
    const currency = invoice.currency || "ETB";
    totals[currency] = (totals[currency] || 0) + Number(invoice.balance || 0);
    return totals;
  }, {});
  const outstandingSummary = Object.entries(outstandingByCurrency).map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`).join(" · ") || "0";
  const confirmedPayments = payments.filter((payment) => payment.status === "confirmed");
  const confirmedTotal = confirmedPayments.reduce((totals: Record<string, number>, payment) => {
    const currency = invoiceFor(payment.invoice_id)?.currency || "ETB";
    totals[currency] = (totals[currency] || 0) + Number(payment.amount || 0);
    return totals;
  }, {});
  const confirmedSummary = Object.entries(confirmedTotal).map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`).join(" · ") || "0";

  const generateInvoices = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!generateFeeId) return toast.error("Choose a fee structure.");
    const { data, error } = await db.rpc("school_generate_student_invoices", {
      p_fee_structure_id: generateFeeId,
      p_section_id: generateSectionId || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0} invoice(s) generated. Existing invoices were not duplicated.`);
    await load();
  };

  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentInvoiceId || Number(paymentAmount) <= 0) return toast.error("Choose an invoice and enter a valid payment amount.");
    const invoice = invoiceFor(paymentInvoiceId);
    if (!invoice || Number(paymentAmount) > Number(invoice.balance)) return toast.error("Payment cannot exceed the outstanding invoice balance.");
    const { error } = await db.rpc("school_record_fee_payment", {
      p_invoice_id: paymentInvoiceId,
      p_amount: Number(paymentAmount),
      p_payment_method: paymentMethod,
      p_reference: paymentReference || null,
    });
    if (error) return toast.error(error.message);
    setPaymentAmount(""); setPaymentReference("");
    toast.success("Payment recorded. A receipt number was generated and the parent was notified.");
    await load();
  };

  const sendReminder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reminderInvoiceId) return toast.error("Choose an outstanding invoice.");
    const { data, error } = await db.rpc("school_send_fee_reminder", {
      p_invoice_id: reminderInvoiceId,
      p_message: reminderMessage || null,
    });
    if (error) return toast.error(error.message);
    setReminderMessage("");
    toast.success(`Payment reminder sent to ${data ?? 0} linked parent account(s).`);
    await load();
  };

  const reportUnpaid = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!followupInvoiceId || !followupNote.trim()) return toast.error("Choose an invoice and explain why Manager follow-up is needed.");
    const { error } = await db.rpc("school_report_unpaid_invoice_to_admin", {
      p_invoice_id: followupInvoiceId, p_note: followupNote.trim(),
    });
    if (error) return toast.error(error.message);
    setFollowupNote("");
    toast.success("Unpaid invoice reported to the School Manager.");
    await load();
  };

  const reversePayment = async (payment: any) => {
    const reason = reverseReason[payment.id]?.trim();
    if (!reason) return toast.error("Enter a reason before reversing a payment.");
    if (!window.confirm(`Reverse receipt ${payment.receipt_number}? This will update the invoice ledger and preserve an audit record.`)) return;
    const { error } = await db.rpc("school_reverse_fee_payment", { p_payment_id: payment.id, p_reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Payment reversed and invoice balance recalculated.");
    await load();
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <SchoolPageHeading title="School finance overview" description="Daily payment processing, invoice tracking, receipts, and unpaid follow-ups." action={<SchoolSecondaryButton onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</SchoolSecondaryButton>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Outstanding balance" value={outstandingSummary} detail={`${outstandingInvoices.length} unpaid or partial invoices`} icon={Wallet} />
        <SchoolMetric label="Confirmed payments" value={confirmedSummary} detail={`${confirmedPayments.length} confirmed receipts`} icon={CreditCard} />
        <SchoolMetric label="Invoices issued" value={invoices.length} detail="School invoice ledger" icon={Receipt} />
        <SchoolMetric label="Unpaid follow-ups" value={followups.filter((item) => item.status !== "resolved").length} detail="Reported to School Manager" icon={ClipboardList} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SchoolPanel title="Recent payments">
          {payments.length ? <div className="divide-y divide-slate-100">{payments.slice(0, 6).map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-semibold text-slate-800">{payment.receipt_number}</p><p className="mt-1 text-xs text-slate-500">{invoiceFor(payment.invoice_id)?.invoice_number || "Invoice"} · {new Date(payment.received_at).toLocaleDateString()}</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-800">{invoiceFor(payment.invoice_id)?.currency || ""} {Number(payment.amount).toLocaleString()}</p><SchoolStatus value={payment.status} /></div></div>)}</div> : <SchoolEmptyState title="No payments recorded" description="Confirmed school payments will appear here." />}
        </SchoolPanel>
        <SchoolPanel title="Outstanding invoices">
          {outstandingInvoices.length ? <div className="divide-y divide-slate-100">{outstandingInvoices.slice(0, 6).map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-semibold text-slate-800">{invoice.invoice_number}</p><p className="mt-1 text-xs text-slate-500">{memberName(invoice.student_membership_id)} · {invoice.description}</p></div><div className="text-right"><p className="text-sm font-semibold text-slate-800">{invoice.currency} {Number(invoice.balance).toLocaleString()}</p><SchoolStatus value={invoice.status} /></div></div>)}</div> : <SchoolEmptyState title="No outstanding balances" description="All generated invoices are paid." />}
        </SchoolPanel>
      </div>
    </div>
  );

  const renderFees = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Fee structures" description="School Managers configure fee rules. Finance generates invoices from active fee structures." />
      <SchoolPanel title="Generate student invoices">
        <form onSubmit={generateInvoices} className="grid gap-3 md:grid-cols-3">
          <SchoolField label="Fee structure"><select className={schoolSelectClass} value={generateFeeId} onChange={(event) => setGenerateFeeId(event.target.value)}><option value="">Choose fee structure</option>{fees.filter((fee) => fee.active).map((fee) => <option key={fee.id} value={fee.id}>{fee.fee_name} · {fee.grade_label} · {fee.currency} {Number(fee.amount).toLocaleString()}</option>)}</select></SchoolField>
          <SchoolField label="Optional section"><select className={schoolSelectClass} value={generateSectionId} onChange={(event) => setGenerateSectionId(event.target.value)}><option value="">All sections in grade</option>{sections.filter((section) => { const fee = fees.find((item) => item.id === generateFeeId); return !fee || (section.grade_label === fee.grade_label && section.academic_year_id === fee.academic_year_id); }).map((section) => <option key={section.id} value={section.id}>{section.grade_label} {section.section_name}</option>)}</select></SchoolField>
          <div className="flex items-end"><SchoolPrimaryButton type="submit"><Plus className="mr-2 h-4 w-4" />Generate invoices</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Configured fee structures">
        {fees.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Fee</th><th className="pb-2">Grade</th><th className="pb-2">Academic year</th><th className="pb-2">Amount</th><th className="pb-2">Due</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{fees.map((fee) => <tr key={fee.id}><td className="py-3 font-medium text-slate-800">{fee.fee_name}</td><td className="py-3 text-slate-600">{fee.grade_label}</td><td className="py-3 text-slate-600">{years.find((year) => year.id === fee.academic_year_id)?.name || "—"}</td><td className="py-3 text-slate-600">{fee.currency} {Number(fee.amount).toLocaleString()}</td><td className="py-3 text-slate-600">{fee.due_date || "—"}</td><td className="py-3"><SchoolStatus value={fee.active ? "active" : "inactive"} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No fee structures configured" description="Ask the School Manager to configure fee structures." />}
      </SchoolPanel>
    </div>
  );

  const renderInvoices = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Invoices & parent reminders" description="Track every invoice and send reminders to linked parent accounts." />
      <SchoolPanel title="Send payment reminder">
        <form onSubmit={sendReminder} className="grid gap-3 md:grid-cols-3">
          <SchoolField label="Outstanding invoice"><select className={schoolSelectClass} value={reminderInvoiceId} onChange={(event) => setReminderInvoiceId(event.target.value)}><option value="">Choose invoice</option>{outstandingInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {memberName(invoice.student_membership_id)} · {invoice.currency} {Number(invoice.balance).toLocaleString()}</option>)}</select></SchoolField>
          <SchoolField label="Optional message"><input className={schoolInputClass} value={reminderMessage} onChange={(event) => setReminderMessage(event.target.value)} placeholder="Payment reminder…" /></SchoolField>
          <div className="flex items-end"><SchoolPrimaryButton type="submit"><Send className="mr-2 h-4 w-4" />Send reminder</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Invoice register">
        {invoices.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Invoice</th><th className="pb-2">Student</th><th className="pb-2">Description</th><th className="pb-2">Amount</th><th className="pb-2">Paid</th><th className="pb-2">Balance</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.map((invoice) => <tr key={invoice.id}><td className="py-3 font-medium text-slate-800">{invoice.invoice_number}</td><td className="py-3 text-slate-600">{memberName(invoice.student_membership_id)}</td><td className="py-3 text-slate-600">{invoice.description}</td><td className="py-3 text-slate-600">{invoice.currency} {Number(invoice.amount).toLocaleString()}</td><td className="py-3 text-slate-600">{invoice.currency} {Number(invoice.paid_amount).toLocaleString()}</td><td className="py-3 font-medium text-slate-800">{invoice.currency} {Number(invoice.balance).toLocaleString()}</td><td className="py-3"><SchoolStatus value={invoice.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No invoices generated" description="Generate invoices from active fee structures." />}
      </SchoolPanel>
    </div>
  );

  const renderPayments = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Payments & receipts" description="Record verified payments, issue receipts, and preserve the payment audit trail." />
      <SchoolPanel title="Record payment">
        <form onSubmit={recordPayment} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SchoolField label="Invoice"><select className={schoolSelectClass} value={paymentInvoiceId} onChange={(event) => setPaymentInvoiceId(event.target.value)}><option value="">Choose invoice</option>{outstandingInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {invoice.currency} {Number(invoice.balance).toLocaleString()}</option>)}</select></SchoolField>
          <SchoolField label="Payment amount"><input type="number" min="0.01" step="0.01" className={schoolInputClass} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></SchoolField>
          <SchoolField label="Payment method"><select className={schoolSelectClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="other">Other</option></select></SchoolField>
          <SchoolField label="Reference (optional)"><input className={schoolInputClass} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></SchoolField>
          <div className="md:col-span-2 xl:col-span-4"><SchoolPrimaryButton type="submit">Record payment & issue receipt</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Payment ledger">
        {payments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Receipt</th><th className="pb-2">Invoice</th><th className="pb-2">Student</th><th className="pb-2">Amount</th><th className="pb-2">Method</th><th className="pb-2">Date</th><th className="pb-2">Status / reversal</th></tr></thead><tbody className="divide-y divide-slate-100">{payments.map((payment) => <tr key={payment.id}><td className="py-3 font-medium text-slate-800">{payment.receipt_number}</td><td className="py-3 text-slate-600">{invoiceFor(payment.invoice_id)?.invoice_number}</td><td className="py-3 text-slate-600">{memberName(invoiceFor(payment.invoice_id)?.student_membership_id)}</td><td className="py-3 text-slate-600">{invoiceFor(payment.invoice_id)?.currency} {Number(payment.amount).toLocaleString()}</td><td className="py-3 capitalize text-slate-600">{payment.payment_method.replace("_", " ")}</td><td className="py-3 text-slate-600">{new Date(payment.received_at).toLocaleDateString()}</td><td className="py-3"><SchoolStatus value={payment.status} />{payment.status === "confirmed" && <div className="mt-2 min-w-[180px] space-y-1"><input className={schoolInputClass} placeholder="Reversal reason" value={reverseReason[payment.id] || ""} onChange={(event) => setReverseReason((current) => ({ ...current, [payment.id]: event.target.value }))} /><button type="button" onClick={() => void reversePayment(payment)} className="inline-flex items-center text-xs font-semibold text-red-700 hover:underline"><RotateCcw className="mr-1 h-3 w-3" />Reverse payment</button></div>}{payment.reversal_reason && <p className="mt-1 text-xs text-slate-500">{payment.reversal_reason}</p>}</td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No payment records" description="Payments recorded by Finance will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderFollowups = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Unpaid invoice follow-ups" description="Report unpaid invoices to School Manager so they can address student or family follow-up." />
      <SchoolPanel title="Report an unpaid invoice">
        <form onSubmit={reportUnpaid} className="grid gap-3 md:grid-cols-2">
          <SchoolField label="Invoice"><select className={schoolSelectClass} value={followupInvoiceId} onChange={(event) => setFollowupInvoiceId(event.target.value)}><option value="">Choose invoice</option>{outstandingInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {memberName(invoice.student_membership_id)}</option>)}</select></SchoolField>
          <SchoolField label="Reason for Manager follow-up"><input className={schoolInputClass} value={followupNote} onChange={(event) => setFollowupNote(event.target.value)} placeholder="Explain the follow-up needed" /></SchoolField>
          <div className="md:col-span-2"><SchoolPrimaryButton type="submit">Report to School Manager</SchoolPrimaryButton></div>
        </form>
      </SchoolPanel>
      <SchoolPanel title="Follow-up history">
        {followups.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500"><th className="pb-2">Invoice</th><th className="pb-2">Student</th><th className="pb-2">Reported by</th><th className="pb-2">Note</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{followups.map((item) => <tr key={item.id}><td className="py-3 font-medium text-slate-800">{invoiceFor(item.invoice_id)?.invoice_number}</td><td className="py-3 text-slate-600">{memberName(item.student_membership_id)}</td><td className="py-3 text-slate-600">{memberName(item.submitted_by_membership_id)}</td><td className="py-3 text-slate-600">{item.note}</td><td className="py-3"><SchoolStatus value={item.status} /></td></tr>)}</tbody></table></div> : <SchoolEmptyState title="No follow-ups reported" description="Reports sent to the School Manager will appear here." />}
      </SchoolPanel>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-5">
      <SchoolPageHeading title="Finance reports" description="Live summaries from the school invoice and payment ledger." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SchoolMetric label="Fee structures" value={fees.length} detail="Configured by School Manager" icon={Wallet} />
        <SchoolMetric label="Outstanding invoices" value={outstandingInvoices.length} detail="Unpaid or partial" icon={Receipt} />
        <SchoolMetric label="Confirmed receipts" value={confirmedPayments.length} detail="Payment ledger entries" icon={CreditCard} />
        <SchoolMetric label="Reversed payments" value={payments.filter((payment) => payment.status === "reversed").length} detail="Preserved with reasons" icon={RotateCcw} />
      </div>
      <SchoolPanel title="Recent finance audit events">
        {auditEvents.length ? <div className="divide-y divide-slate-100">{auditEvents.slice(0, 30).map((event) => <div key={event.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="text-sm font-medium text-slate-800">{event.event_type.replace(/_/g, " ")}</p><p className="mt-1 text-xs text-slate-500">{event.entity_type} · {new Date(event.created_at).toLocaleString()}</p></div><SchoolStatus value={event.entity_type} /></div>)}</div> : <SchoolEmptyState title="No audit events" description="Invoice and payment activity will be recorded here." />}
      </SchoolPanel>
    </div>
  );

  let content: React.ReactNode;
  switch (page) {
    case "fees": content = renderFees(); break;
    case "invoices": content = renderInvoices(); break;
    case "payments": content = renderPayments(); break;
    case "followups": content = renderFollowups(); break;
    case "reports": content = renderReports(); break;
    default: content = renderOverview();
  }

  return (
    <SchoolPortalShell role="finance" title="School Finance" navItems={navItems} activeItem={page} onNavigate={setPage} headerActions={<SchoolLeadershipShortcut />}>
      {loading && <div className="mb-4 text-xs text-slate-500">Refreshing school finance records…</div>}
      {content}
    </SchoolPortalShell>
  );
}
