import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import BackButton from "@/components/ui/BackButton";
import { toast } from "sonner";
import {
  Banknote, BarChart3, CalendarDays, CircleDollarSign, FileText, Plus,
  Receipt, RefreshCw, Search, ShieldCheck, TrendingDown, TrendingUp, Wallet
} from "lucide-react";

type Account = { id: string; name: string; account_type: string; currency: string; current_balance: number; active: boolean };
type Category = { id: string; name: string; category_type: "income" | "expense" };
type Invoice = {
  id: string; invoice_number: string; student_id: string; student_name?: string;
  description: string; currency: string; subtotal: number; discount: number; total: number;
  amount_paid: number; due_date: string | null; status: string; created_at: string;
};
type Transaction = {
  id: string; account_id: string; account_name?: string; category_id: string | null;
  direction: "inflow" | "outflow"; amount: number; currency: string;
  description: string; occurred_at: string; status: string;
};
type Budget = { id: string; name: string; amount: number; period_start: string; period_end: string; category_id: string | null };

const db = supabase as any;

const FinancePortal: React.FC = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string | null; grade: string | null }>>([]);
  const [search, setSearch] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [reversal, setReversal] = useState<Transaction | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [invoiceForm, setInvoiceForm] = useState({
    student_id: "", description: "Tuition & Fees", subtotal: "", discount: "", due_date: "", notes: ""
  });
  const [accountForm, setAccountForm] = useState({ name: "", account_type: "cash", currency: "ETB", opening_balance: "0" });
  const [budgetForm, setBudgetForm] = useState({ name: "", category_id: "", amount: "", period_start: "", period_end: "" });
  const [paymentForm, setPaymentForm] = useState({ account_id: "", amount: "", method: "cash", reference: "", notes: "" });
  const [transactionForm, setTransactionForm] = useState({ account_id: "", category_id: "", direction: "outflow", amount: "", description: "", occurred_at: "" });
  const [transferForm, setTransferForm] = useState({ from_account_id: "", to_account_id: "", amount: "", description: "Internal transfer" });
  const [reversalReason, setReversalReason] = useState("");

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      await db.rpc("finance_sync_overdue_invoices");
      const [{ data: a }, { data: c }, { data: i }, { data: t }, { data: b }, { data: s }, { data: al }] = await Promise.all([
        db.from("finance_accounts").select("id,name,account_type,currency,current_balance,active").order("name"),
        db.from("finance_categories").select("id,name,category_type").eq("active", true).order("category_type").order("name"),
        db.from("finance_invoices").select("id,invoice_number,student_id,description,currency,subtotal,discount,total,amount_paid,due_date,status,created_at").order("created_at", { ascending: false }).limit(200),
        db.from("finance_transactions").select("id,account_id,category_id,direction,amount,currency,description,occurred_at,status").order("occurred_at", { ascending: false }).limit(200),
        db.from("finance_budgets").select("id,name,amount,period_start,period_end,category_id").order("period_start", { ascending: false }).limit(100),
        db.from("profiles").select("id,name,grade").order("name").limit(500),
        db.from("finance_audit_log").select("id,actor_id,action,entity_type,entity_id,details,created_at").order("created_at",{ascending:false}).limit(300),
      ]);
      if (a) setAccounts(a);
      if (c) setCategories(c);
      if (s) setStudents(s);
      const names = new Map((s || []).map((x: any) => [x.id, x.name || "Student"]));
      setInvoices((i || []).map((x: any) => ({ ...x, student_name: names.get(x.student_id) || "Student" })));
      const accountNames = new Map((a || []).map((x: any) => [x.id, x.name]));
      setTransactions((t || []).map((x: any) => ({ ...x, account_name: accountNames.get(x.account_id) || "Account" })));
      if (b) setBudgets(b);
      if (al) setAuditLogs(al);
    } catch (error) {
      console.error(error);
      toast.error("Finance data could not be loaded");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => {
    const receivables = invoices.reduce((sum, x) => sum + Math.max(0, Number(x.total) - Number(x.amount_paid)), 0);
    const income = transactions.filter(x => x.direction === "inflow" && x.status === "posted").reduce((sum, x) => sum + Number(x.amount), 0);
    const expenses = transactions.filter(x => x.direction === "outflow" && x.status === "posted").reduce((sum, x) => sum + Number(x.amount), 0);
    const overdue = invoices.filter(x => x.status !== "paid" && x.status !== "cancelled" && x.due_date && new Date(x.due_date) < new Date()).length;
    return { receivables, income, expenses, net: income - expenses, overdue };
  }, [invoices, transactions]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(x => [x.invoice_number, x.student_name, x.description, x.status].some(v => String(v || "").toLowerCase().includes(q)));
  }, [invoices, search]);

  const createInvoice = async () => {
    if (!user?.id || !invoiceForm.student_id || !invoiceForm.description.trim()) return toast.error("Student and description are required");
    const subtotal = Number(invoiceForm.subtotal);
    const discount = Number(invoiceForm.discount || 0);
    if (!Number.isFinite(subtotal) || subtotal < 0 || discount < 0 || discount > subtotal) return toast.error("Check the invoice amounts");
    const invoiceNumber = `MM-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`;
    const { error } = await db.from("finance_invoices").insert({
      invoice_number: invoiceNumber, student_id: invoiceForm.student_id, description: invoiceForm.description,
      currency: "ETB", subtotal, discount, total: subtotal - discount, due_date: invoiceForm.due_date || null,
      status: "issued", notes: invoiceForm.notes || null, created_by: user.id
    });
    if (error) return toast.error(error.message);
    await db.from("finance_audit_log").insert({ actor_id: user.id, action: "create_invoice", entity_type: "invoice", details: { invoice_number: invoiceNumber } });
    toast.success(`Invoice ${invoiceNumber} created`);
    setInvoiceOpen(false);
    setInvoiceForm({ student_id: "", description: "Tuition & Fees", subtotal: "", discount: "", due_date: "", notes: "" });
    load(true);
  };

  const recordPayment = async () => {
    if (!paymentInvoice) return;
    const amount = Number(paymentForm.amount);
    if (!paymentForm.account_id) return toast.error("Select the receiving account");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid payment amount");
    const { error } = await db.rpc("finance_record_payment", {
      p_invoice_id: paymentInvoice.id, p_account_id: paymentForm.account_id, p_amount: amount, p_method: paymentForm.method,
      p_reference: paymentForm.reference || null, p_notes: paymentForm.notes || null
    });
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    setPaymentInvoice(null);
    setPaymentForm({ account_id: "", amount: "", method: "cash", reference: "", notes: "" });
    load(true);
  };

  const createAccount = async () => {
    if (!accountForm.name.trim()) return toast.error("Account name is required");
    const opening = Number(accountForm.opening_balance || 0);
    if (!Number.isFinite(opening)) return toast.error("Opening balance is invalid");
    const { error } = await db.from("finance_accounts").insert({
      name: accountForm.name, account_type: accountForm.account_type, currency: accountForm.currency,
      opening_balance: opening, current_balance: opening
    });
    if (error) return toast.error(error.message);
    toast.success("Finance account created");
    setAccountOpen(false);
    setAccountForm({ name: "", account_type: "cash", currency: "ETB", opening_balance: "0" });
    load(true);
  };

  const recordTransaction = async () => {
    const amount = Number(transactionForm.amount);
    if (!transactionForm.account_id || !transactionForm.description.trim()) return toast.error("Account and description are required");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount");
    const account = accounts.find(a => a.id === transactionForm.account_id);
    const { error } = await db.rpc("finance_record_transaction", {
      p_account_id: transactionForm.account_id,
      p_category_id: transactionForm.category_id || null,
      p_direction: transactionForm.direction,
      p_amount: amount,
      p_currency: account?.currency || "ETB",
      p_description: transactionForm.description.trim(),
      p_occurred_at: transactionForm.occurred_at ? new Date(transactionForm.occurred_at).toISOString() : new Date().toISOString()
    });
    if (error) return toast.error(error.message);
    toast.success("Transaction posted");
    setTransactionOpen(false);
    setTransactionForm({account_id:"",category_id:"",direction:"outflow",amount:"",description:"",occurred_at:""});
    load(true);
  };

  const transferFunds = async () => {
    const amount = Number(transferForm.amount);
    if (!transferForm.from_account_id || !transferForm.to_account_id) return toast.error("Choose both accounts");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount");
    const { error } = await db.rpc("finance_transfer", {
      p_from_account_id: transferForm.from_account_id,
      p_to_account_id: transferForm.to_account_id,
      p_amount: amount,
      p_description: transferForm.description.trim()
    });
    if (error) return toast.error(error.message);
    toast.success("Transfer completed");
    setTransferOpen(false);
    setTransferForm({from_account_id:"",to_account_id:"",amount:"",description:"Internal transfer"});
    load(true);
  };

  const reverseTransaction = async () => {
    if (!reversal || !reversalReason.trim()) return toast.error("A reversal reason is required");
    const { error } = await db.rpc("finance_reverse_transaction", {
      p_transaction_id: reversal.id,
      p_reason: reversalReason.trim()
    });
    if (error) return toast.error(error.message);
    toast.success("Transaction reversed with an audit trail");
    setReversal(null);
    setReversalReason("");
    load(true);
  };

  const createBudget = async () => {
    if (!user?.id || !budgetForm.name || !budgetForm.amount || !budgetForm.period_start || !budgetForm.period_end) return toast.error("Complete the budget fields");
    const { error } = await db.from("finance_budgets").insert({
      name: budgetForm.name, category_id: budgetForm.category_id || null, amount: Number(budgetForm.amount),
      period_start: budgetForm.period_start, period_end: budgetForm.period_end, created_by: user.id
    });
    if (error) return toast.error(error.message);
    toast.success("Budget created");
    setBudgetOpen(false);
    setBudgetForm({ name: "", category_id: "", amount: "", period_start: "", period_end: "" });
    load(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading Finance Portal…</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operations</p>
              <h1 className="text-2xl font-bold flex items-center gap-2"><CircleDollarSign className="h-6 w-6" /> Finance Portal</h1>
              <p className="text-sm text-muted-foreground">Invoices, collections, cash flow, budgets and financial audit history.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />Refresh</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            ["Outstanding", `ETB ${metrics.receivables.toLocaleString()}`, Receipt],
            ["Income", `ETB ${metrics.income.toLocaleString()}`, TrendingUp],
            ["Expenses", `ETB ${metrics.expenses.toLocaleString()}`, TrendingDown],
            ["Net cash flow", `ETB ${metrics.net.toLocaleString()}`, Wallet],
            ["Overdue invoices", metrics.overdue, FileText],
          ].map(([label, value, Icon]: any) => (
            <Card key={label as string}><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold mt-1">{typeof value === "number" && label !== "Overdue invoices" ? "ETB " + value.toLocaleString() : value}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></div></CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="overview">Dashboard</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="transactions">Ledger</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card><CardHeader><CardTitle>Account balances</CardTitle></CardHeader><CardContent className="space-y-3">
                {accounts.map(a => <div key={a.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground capitalize">{a.account_type} • {a.currency}</p></div><p className="font-semibold">{Number(a.current_balance).toLocaleString()} {a.currency}</p></div>)}
                {!accounts.length && <p className="text-sm text-muted-foreground">No finance accounts yet.</p>}
              </CardContent></Card>
              <Card><CardHeader><CardTitle>Collection status</CardTitle></CardHeader><CardContent className="space-y-3">
                {[
                  ["Paid", invoices.filter(x => x.status === "paid").length, "bg-emerald-500"],
                  ["Partial", invoices.filter(x => x.status === "partial").length, "bg-amber-500"],
                  ["Issued", invoices.filter(x => x.status === "issued").length, "bg-blue-500"],
                  ["Overdue", metrics.overdue, "bg-red-500"],
                ].map(([label, count, dot]) => <div key={label as string} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${dot}`} />{label}</span><Badge variant="secondary">{count}</Badge></div>)}
              </CardContent></Card>
            </div>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Finance controls</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-lg border p-3"><p className="font-medium">Role restricted</p><p className="text-muted-foreground">Dedicated Finance staff plus Admin, Manager and Super Admin oversight.</p></div>
              <div className="rounded-lg border p-3"><p className="font-medium">Payment guardrails</p><p className="text-muted-foreground">Payments cannot exceed an invoice balance and require an active cash/bank account.</p></div>
              <div className="rounded-lg border p-3"><p className="font-medium">Audit trail</p><p className="text-muted-foreground">Invoice creation and payment events are recorded for review.</p></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-5">
            <Card><CardContent className="p-4 flex flex-wrap gap-3 justify-between">
              <div className="relative w-full max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search invoice, student, status…" value={search} onChange={e => setSearch(e.target.value)} /></div>
              <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Create invoice</Button></DialogTrigger><DialogContent>
                <DialogHeader><DialogTitle>Create student invoice</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Student</Label><Select value={invoiceForm.student_id} onValueChange={v => setInvoiceForm(p => ({...p, student_id:v}))}><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name || "Student"}{s.grade ? ` • Grade ${s.grade}` : ""}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Description</Label><Input value={invoiceForm.description} onChange={e => setInvoiceForm(p=>({...p,description:e.target.value}))} /></div>
                  <div className="grid grid-cols-2 gap-3"><div><Label>Subtotal (ETB)</Label><Input type="number" min="0" value={invoiceForm.subtotal} onChange={e=>setInvoiceForm(p=>({...p,subtotal:e.target.value}))}/></div><div><Label>Discount</Label><Input type="number" min="0" value={invoiceForm.discount} onChange={e=>setInvoiceForm(p=>({...p,discount:e.target.value}))}/></div></div>
                  <div><Label>Due date</Label><Input type="date" value={invoiceForm.due_date} onChange={e=>setInvoiceForm(p=>({...p,due_date:e.target.value}))}/></div>
                  <div><Label>Notes</Label><Textarea value={invoiceForm.notes} onChange={e=>setInvoiceForm(p=>({...p,notes:e.target.value}))}/></div>
                  <Button className="w-full" onClick={createInvoice}>Create invoice</Button>
                </div>
              </DialogContent></Dialog>
            </CardContent></Card>
            <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Invoice</th><th className="p-3">Student</th><th className="p-3">Total</th><th className="p-3">Paid</th><th className="p-3">Balance</th><th className="p-3">Due</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{filteredInvoices.map(i => <tr key={i.id} className="border-b last:border-0"><td className="p-3 font-medium">{i.invoice_number}</td><td className="p-3">{i.student_name}</td><td className="p-3">{Number(i.total).toLocaleString()} {i.currency}</td><td className="p-3">{Number(i.amount_paid).toLocaleString()}</td><td className="p-3 font-semibold">{Math.max(0, Number(i.total)-Number(i.amount_paid)).toLocaleString()}</td><td className="p-3">{i.due_date || "—"}</td><td className="p-3"><Badge variant={i.status==="paid"?"default":"secondary"} className="capitalize">{i.status}</Badge></td><td className="p-3">{i.status!=="paid" && i.status!=="cancelled" && <Button size="sm" onClick={()=>{setPaymentInvoice(i);setPaymentForm({account_id:"",amount:String(Math.max(0,Number(i.total)-Number(i.amount_paid))),method:"cash",reference:"",notes:""})}}>Record payment</Button>}</td></tr>)}</tbody></table>{!filteredInvoices.length && <p className="p-6 text-sm text-muted-foreground">No invoices found.</p>}</CardContent></Card>
            {paymentInvoice && <Dialog open onOpenChange={open=>!open&&setPaymentInvoice(null)}><DialogContent><DialogHeader><DialogTitle>Record payment • {paymentInvoice.invoice_number}</DialogTitle></DialogHeader><div className="space-y-3"><p className="text-sm text-muted-foreground">Remaining balance: {Math.max(0,Number(paymentInvoice.total)-Number(paymentInvoice.amount_paid)).toLocaleString()} {paymentInvoice.currency}</p><div><Label>Receiving account</Label><Select value={paymentForm.account_id} onValueChange={v=>setPaymentForm(p=>({...p,account_id:v}))}><SelectTrigger><SelectValue placeholder="Select cash, bank or mobile-money account"/></SelectTrigger><SelectContent>{accounts.filter(a=>a.active&&["cash","bank","mobile_money"].includes(a.account_type)).map(a=><SelectItem key={a.id} value={a.id}>{a.name} · {a.currency}</SelectItem>)}</SelectContent></Select></div><div><Label>Amount</Label><Input type="number" min="0.01" value={paymentForm.amount} onChange={e=>setPaymentForm(p=>({...p,amount:e.target.value}))}/></div><div><Label>Method</Label><Select value={paymentForm.method} onValueChange={v=>setPaymentForm(p=>({...p,method:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["cash","bank_transfer","mobile_money","card","other"].map(v=><SelectItem key={v} value={v}>{v.replace("_"," ")}</SelectItem>)}</SelectContent></Select></div><div><Label>Reference</Label><Input value={paymentForm.reference} onChange={e=>setPaymentForm(p=>({...p,reference:e.target.value}))}/></div><div><Label>Notes</Label><Textarea value={paymentForm.notes} onChange={e=>setPaymentForm(p=>({...p,notes:e.target.value}))}/></div><Button className="w-full" onClick={recordPayment}>Confirm payment</Button></div></DialogContent></Dialog>}
          </TabsContent>

          <TabsContent value="transactions" className="space-y-5">
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setTransferOpen(true)}>Transfer funds</Button><Button onClick={()=>setTransactionOpen(true)}><Plus className="h-4 w-4 mr-2"/>Post transaction</Button></div>
            <Card><CardHeader><CardTitle>Ledger</CardTitle></CardHeader><CardContent><ScrollArea className="h-[520px]"><div className="space-y-2">{transactions.map(t=><div key={t.id} className="rounded-lg border p-3 flex items-center justify-between gap-3"><div><p className="font-medium">{t.description}</p><p className="text-xs text-muted-foreground">{t.account_name} • {new Date(t.occurred_at).toLocaleString()} • {t.status}</p></div><div className="flex items-center gap-2"><p className={`font-semibold ${t.direction==="inflow"?"text-emerald-600":"text-red-600"}`}>{t.direction==="inflow"?"+":"-"}{Number(t.amount).toLocaleString()} {t.currency}</p></div></div>)}{!transactions.length&&<p className="text-sm text-muted-foreground">No posted transactions yet.</p>}</div></ScrollArea></CardContent></Card>
          </TabsContent>

          <TabsContent value="budgets" className="space-y-5">
            <div className="flex justify-end"><Dialog open={budgetOpen} onOpenChange={setBudgetOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2"/>Create budget</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create budget</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Name</Label><Input value={budgetForm.name} onChange={e=>setBudgetForm(p=>({...p,name:e.target.value}))}/></div><div><Label>Category</Label><Select value={budgetForm.category_id} onValueChange={v=>setBudgetForm(p=>({...p,category_id:v}))}><SelectTrigger><SelectValue placeholder="Optional category"/></SelectTrigger><SelectContent>{categories.filter(c=>c.category_type==="expense").map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Amount (ETB)</Label><Input type="number" min="0" value={budgetForm.amount} onChange={e=>setBudgetForm(p=>({...p,amount:e.target.value}))}/></div><div className="grid grid-cols-2 gap-3"><div><Label>Start</Label><Input type="date" value={budgetForm.period_start} onChange={e=>setBudgetForm(p=>({...p,period_start:e.target.value}))}/></div><div><Label>End</Label><Input type="date" value={budgetForm.period_end} onChange={e=>setBudgetForm(p=>({...p,period_end:e.target.value}))}/></div></div><Button className="w-full" onClick={createBudget}>Save budget</Button></div></DialogContent></Dialog></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{budgets.map(b=><Card key={b.id}><CardHeader><CardTitle className="text-base">{b.name}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">ETB {Number(b.amount).toLocaleString()}</p><p className="text-xs text-muted-foreground mt-1">{b.period_start} → {b.period_end}</p></CardContent></Card>)}{!budgets.length&&<p className="text-sm text-muted-foreground">No budgets created yet.</p>}</div>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-5">
            <div className="flex justify-end"><Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2"/>Add account</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add finance account</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Name</Label><Input value={accountForm.name} onChange={e=>setAccountForm(p=>({...p,name:e.target.value}))}/></div><div><Label>Type</Label><Select value={accountForm.account_type} onValueChange={v=>setAccountForm(p=>({...p,account_type:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["cash","bank","mobile_money","receivable","other"].map(v=><SelectItem key={v} value={v}>{v.replace("_"," ")}</SelectItem>)}</SelectContent></Select></div><div><Label>Currency</Label><Input value={accountForm.currency} onChange={e=>setAccountForm(p=>({...p,currency:e.target.value.toUpperCase()}))}/></div><div><Label>Opening balance</Label><Input type="number" value={accountForm.opening_balance} onChange={e=>setAccountForm(p=>({...p,opening_balance:e.target.value}))}/></div><Button className="w-full" onClick={createAccount}>Create account</Button></div></DialogContent></Dialog></div>
            <div className="grid gap-4 md:grid-cols-2">{accounts.map(a=><Card key={a.id}><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="font-semibold">{a.name}</p><p className="text-sm text-muted-foreground capitalize">{a.account_type} • {a.currency}</p></div><Banknote className="h-6 w-6"/></div><p className="text-3xl font-bold mt-4">{Number(a.current_balance).toLocaleString()} <span className="text-sm font-normal">{a.currency}</span></p></CardContent></Card>)}</div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-5">
            <Card><CardHeader><CardTitle>Payment history</CardTitle></CardHeader><CardContent><div className="space-y-2">{invoices.filter(i=>i.amount_paid>0).map(i=><div key={i.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{i.invoice_number}</p><p className="text-xs text-muted-foreground">{i.student_name} · {i.status}</p></div><p className="font-semibold">ETB {Number(i.amount_paid).toLocaleString()}</p></div>)}{!invoices.some(i=>i.amount_paid>0)&&<p className="text-sm text-muted-foreground">No payments recorded yet.</p>}</div></CardContent></Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardTitle>Income</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">ETB {metrics.income.toLocaleString()}</p></CardContent></Card><Card><CardHeader><CardTitle>Expenses</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">ETB {metrics.expenses.toLocaleString()}</p></CardContent></Card><Card><CardHeader><CardTitle>Net cash flow</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">ETB {metrics.net.toLocaleString()}</p></CardContent></Card></div>
            <Card><CardHeader><CardTitle>Collection performance</CardTitle></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Collected</p><p className="text-xl font-bold">ETB {metrics.paid.toLocaleString()}</p></div><div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Outstanding</p><p className="text-xl font-bold">ETB {metrics.receivables.toLocaleString()}</p></div><div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Overdue invoices</p><p className="text-xl font-bold">{metrics.overdue}</p></div></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-5">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/> Finance audit trail</CardTitle></CardHeader><CardContent><ScrollArea className="h-[500px]"><div className="space-y-2">{auditLogs.map(a=><div key={a.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><p className="font-medium capitalize">{String(a.action).replaceAll("_"," ")}</p><p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p></div><p className="text-xs text-muted-foreground">{a.entity_type}{a.entity_id ? " · "+a.entity_id : ""}</p>{a.details&&<pre className="mt-2 overflow-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(a.details,null,2)}</pre>}</div>)}{!auditLogs.length&&<p className="text-sm text-muted-foreground">No audit events yet.</p>}</div></ScrollArea></CardContent></Card>
          </TabsContent>
        </Tabs>

        <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}><DialogContent><DialogHeader><DialogTitle>Post income or expense</DialogTitle></DialogHeader><div className="space-y-3"><div className="grid grid-cols-2 gap-2"><Button variant={transactionForm.direction==="inflow"?"default":"outline"} onClick={()=>setTransactionForm(p=>({...p,direction:"inflow"}))}>Income</Button><Button variant={transactionForm.direction==="outflow"?"default":"outline"} onClick={()=>setTransactionForm(p=>({...p,direction:"outflow"}))}>Expense</Button></div><div><Label>Account</Label><Select value={transactionForm.account_id} onValueChange={v=>setTransactionForm(p=>({...p,account_id:v}))}><SelectTrigger><SelectValue placeholder="Select account"/></SelectTrigger><SelectContent>{accounts.filter(a=>a.active).map(a=><SelectItem key={a.id} value={a.id}>{a.name} · {a.currency}</SelectItem>)}</SelectContent></Select></div><div><Label>Category</Label><Select value={transactionForm.category_id} onValueChange={v=>setTransactionForm(p=>({...p,category_id:v}))}><SelectTrigger><SelectValue placeholder="Select category"/></SelectTrigger><SelectContent>{categories.filter(c=>c.category_type===(transactionForm.direction==="inflow"?"income":"expense")).map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Amount</Label><Input type="number" min="0.01" value={transactionForm.amount} onChange={e=>setTransactionForm(p=>({...p,amount:e.target.value}))}/></div><div><Label>Description</Label><Input value={transactionForm.description} onChange={e=>setTransactionForm(p=>({...p,description:e.target.value}))}/></div><Button className="w-full" onClick={recordTransaction}>Post transaction</Button></div></DialogContent></Dialog>

        <Dialog open={transferOpen} onOpenChange={setTransferOpen}><DialogContent><DialogHeader><DialogTitle>Transfer between accounts</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>From</Label><Select value={transferForm.from_account_id} onValueChange={v=>setTransferForm(p=>({...p,from_account_id:v}))}><SelectTrigger><SelectValue placeholder="Source account"/></SelectTrigger><SelectContent>{accounts.filter(a=>a.active).map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div><div><Label>To</Label><Select value={transferForm.to_account_id} onValueChange={v=>setTransferForm(p=>({...p,to_account_id:v}))}><SelectTrigger><SelectValue placeholder="Destination account"/></SelectTrigger><SelectContent>{accounts.filter(a=>a.active).map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Amount</Label><Input type="number" min="0.01" value={transferForm.amount} onChange={e=>setTransferForm(p=>({...p,amount:e.target.value}))}/></div><div><Label>Reason</Label><Input value={transferForm.description} onChange={e=>setTransferForm(p=>({...p,description:e.target.value}))}/></div><Button className="w-full" onClick={transferFunds}>Complete transfer</Button></div></DialogContent></Dialog>

        <Dialog open={!!reversal} onOpenChange={open=>{if(!open){setReversal(null);setReversalReason("")}}}><DialogContent><DialogHeader><DialogTitle>Reverse transaction</DialogTitle></DialogHeader><div className="space-y-3"><p className="text-sm text-muted-foreground">The original transaction stays in the ledger and is marked voided. A correcting entry is created.</p><Textarea placeholder="Reason for reversal" value={reversalReason} onChange={e=>setReversalReason(e.target.value)}/><Button variant="destructive" className="w-full" onClick={reverseTransaction}>Confirm reversal</Button></div></DialogContent></Dialog>
        </Tabs>
      </div>
    </div>
  );
};

export default FinancePortal;
