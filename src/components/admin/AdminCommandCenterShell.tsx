import type React from "react";
import { Menu, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type AdminNavItem = { key: string; label: string; description?: string; icon: React.ElementType };

type AdminCommandCenterShellProps = {
  roleLabel: string;
  eyebrow?: string;
  title: string;
  description: string;
  activeKey: string;
  navItems: AdminNavItem[];
  onNavigate: (key: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
};

const Navigation = ({ items, activeKey, onNavigate, compact = false }: { items: AdminNavItem[]; activeKey: string; onNavigate: (key: string) => void; compact?: boolean }) => (
  <nav aria-label="Administration sections" className={cn("space-y-1", compact && "grid gap-1")}> 
    {items.map(({ key, label, description, icon: Icon }) => (
      <button
        key={key}
        type="button"
        aria-current={activeKey === key ? "page" : undefined}
        onClick={() => onNavigate(key)}
        className={cn(
          "group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          activeKey === key ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white",
          compact && "min-h-12 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950",
          compact && activeKey === key && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{label}</span>
          {description && <span className={cn("mt-0.5 block truncate text-[11px]", activeKey === key && !compact ? "text-primary-foreground/70" : compact ? "text-slate-500" : "text-slate-400")}>{description}</span>}
        </span>
      </button>
    ))}
  </nav>
);

export default function AdminCommandCenterShell({ roleLabel, eyebrow = "Master Minds administration", title, description, activeKey, navItems, onNavigate, onRefresh, refreshing, children }: AdminCommandCenterShellProps) {
  const handleNavigate = (key: string) => onNavigate(key);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-[#081a33] px-4 py-5 text-white shadow-xl lg:flex">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20 ring-1 ring-blue-300/30"><ShieldCheck className="h-5 w-5 text-cyan-300" /></div>
          <div className="min-w-0"><p className="truncate font-display text-base font-bold">Master Minds</p><p className="truncate text-xs text-slate-400">{roleLabel} workspace</p></div>
        </div>
        <div className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Command center</div>
        <div className="flex-1 overflow-y-auto"><Navigation items={navItems} activeKey={activeKey} onNavigate={handleNavigate} /></div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300"><p className="font-semibold text-white">Protected workspace</p><p className="mt-1 leading-relaxed">Privileged changes remain server-authorized and auditable.</p></div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[4.5rem] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet>
                <SheetTrigger asChild><Button variant="outline" size="icon" className="h-10 w-10 lg:hidden" aria-label="Open administration navigation"><Menu className="h-4 w-4" /></Button></SheetTrigger>
                <SheetContent side="left" className="w-[min(88vw,22rem)] bg-white p-0 text-slate-950">
                  <SheetHeader className="border-b border-slate-200 px-5 py-5 text-left"><SheetTitle>Administration</SheetTitle><SheetDescription>Choose a workspace section.</SheetDescription></SheetHeader>
                  <div className="p-4"><Navigation items={navItems} activeKey={activeKey} onNavigate={handleNavigate} compact /><SheetClose className="sr-only">Close navigation</SheetClose></div>
                </SheetContent>
              </Sheet>
              <div className="min-w-0"><p className="hidden text-[11px] font-bold uppercase tracking-[.16em] text-primary sm:block">{eyebrow}</p><h1 className="truncate font-display text-xl font-bold sm:text-2xl">{title}</h1><p className="hidden max-w-2xl truncate text-sm text-slate-500 md:block">{description}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:inline-flex">{roleLabel}</span>{onRefresh && <Button variant="outline" onClick={onRefresh} disabled={refreshing} className="h-10"><RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} /><span className="hidden sm:inline">Refresh</span></Button>}</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
