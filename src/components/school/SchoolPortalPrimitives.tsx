import React from "react";
import { LucideIcon } from "lucide-react";

export function SchoolPageHeading({
  title, description, action,
}: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SchoolMetric({
  label, value, detail, icon: Icon,
}: { label: string; value: string | number; detail?: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
          {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
        </div>
        <div className="rounded-md bg-blue-50 p-2 text-blue-700"><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  );
}

export function SchoolPanel({
  title, description, action, children, className = "",
}: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={["rounded-lg border border-slate-200 bg-white", className].join(" ")}>
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SchoolStatus({ value }: { value: string }) {
  const key = value.toLowerCase();
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700",
    approved: "bg-emerald-50 text-emerald-700",
    published: "bg-emerald-50 text-emerald-700",
    paid: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-800",
    partial: "bg-amber-50 text-amber-800",
    suspended: "bg-amber-50 text-amber-800",
    rejected: "bg-red-50 text-red-700",
    unpaid: "bg-red-50 text-red-700",
    deactivated: "bg-slate-100 text-slate-600",
    transferred: "bg-slate-100 text-slate-600",
    graduated: "bg-slate-100 text-slate-600",
    draft: "bg-slate-100 text-slate-600",
  };
  return <span className={["inline-flex rounded-md px-2 py-1 text-[11px] font-semibold capitalize", styles[key] || "bg-slate-100 text-slate-600"].join(" ")}>{value.replace(/_/g, " ")}</span>;
}

export function SchoolEmptyState({
  title, description,
}: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function SchoolPrimaryButton({
  children, onClick, disabled, type = "button",
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SchoolSecondaryButton({
  children, onClick, disabled, type = "button",
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SchoolField({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const schoolInputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
export const schoolTextareaClass = "min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
export const schoolSelectClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
