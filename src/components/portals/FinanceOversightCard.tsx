import { db } from "@/integrations/untypedClient";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CircleDollarSign, ArrowUpRight, RefreshCw } from "lucide-react";

type FinanceSummary = {
  open_invoices: number;
  outstanding_amount: number;
  overdue_invoices: number;
  payments_last_30_days: number;
};

const money = (value: number) => `ETB ${Number(value || 0).toLocaleString()}`;

export default function FinanceOversightCard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.rpc("get_finance_oversight_summary");
    if (error) {
      console.error("Finance oversight summary unavailable:", error);
      setUnavailable(true);
      setSummary(null);
    } else {
      setUnavailable(false);
      setSummary((Array.isArray(data) ? data[0] : data) as FinanceSummary | null);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="h-5 w-5 text-blue-600 dark:text-cyan-300" /> Finance oversight</CardTitle>
          <CardDescription>School-fee health shared with the Finance Portal</CardDescription>
        </div>
        <Button variant="ghost" size="icon" aria-label="Refresh finance summary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading finance summary…</p>
        ) : unavailable || !summary ? (
          <p className="text-sm text-muted-foreground">Finance summary is unavailable. Check the workflow migration and staff permissions.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Open invoices</p><p className="mt-1 text-xl font-bold">{summary.open_invoices}</p></div>
              <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Outstanding</p><p className="mt-1 text-base font-bold">{money(summary.outstanding_amount)}</p></div>
              <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Overdue</p><p className="mt-1 text-xl font-bold">{summary.overdue_invoices}</p></div>
              <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs text-muted-foreground">Payments · 30 days</p><p className="mt-1 text-base font-bold">{money(summary.payments_last_30_days)}</p></div>
            </div>
            {summary.overdue_invoices > 0 && <Badge variant="destructive">{summary.overdue_invoices} overdue invoice(s) need follow-up</Badge>}
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">Summary only — transaction details remain inside Finance.</p>
          <Button size="sm" onClick={() => navigate("/finance")}>Open Finance Portal <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
