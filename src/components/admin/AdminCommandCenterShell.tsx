import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, LogOut, Menu, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type AdminNavItem = {
  key: string;
  label: string;
  description?: string;
  section?: string;
  icon: React.ElementType;
};

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
  onLogout?: () => Promise<void> | void;
  children: React.ReactNode;
};

const Navigation = ({
  items,
  activeKey,
  onNavigate,
  compact = false,
}: {
  items: AdminNavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  compact?: boolean;
}) => {
  const groups = items.reduce<Array<{ label: string; items: AdminNavItem[] }>>((result, item) => {
    const label = item.section || "Workspace";
    const group = result.find((candidate) => candidate.label === label);
    if (group) group.items.push(item);
    else result.push({ label, items: [item] });
    return result;
  }, []);

  return (
    <nav aria-label="Administration sections" className={cn("space-y-5", compact && "space-y-4")}>
      {groups.map((group) => (
        <div key={group.label}>
          <p className={cn("mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em]", compact ? "text-slate-400" : "text-slate-500")}>
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map(({ key, label, description, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-current={activeKey === key ? "page" : undefined}
                onClick={() => onNavigate(key)}
                className={cn(
                  "group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  activeKey === key ? "bg-[#2f63df] text-white shadow-md shadow-blue-950/20" : "text-slate-300 hover:bg-white/10 hover:text-white",
                  compact && "min-h-12 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                  compact && activeKey === key && "bg-[#2f63df] text-white hover:bg-[#2f63df] hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{label}</span>
                  {description && (
                    <span className={cn(
                      "mt-0.5 block truncate text-[11px]",
                      activeKey === key && !compact ? "text-primary-foreground/70" : compact ? "text-slate-500" : "text-slate-400",
                    )}>
                      {description}
                    </span>
                  )}
                </span>
                <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60", activeKey === key && "opacity-70")} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
};

export default function AdminCommandCenterShell({
  roleLabel,
  eyebrow = "Master Minds administration",
  title,
  description,
  activeKey,
  navItems,
  onNavigate,
  onRefresh,
  refreshing,
  onLogout,
  children,
}: AdminCommandCenterShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const activeItem = useMemo(() => navItems.find((item) => item.key === activeKey), [activeKey, navItems]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setNavigationOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleLogout = async () => {
    if (!onLogout || logoutPending) return;
    setLogoutPending(true);
    try {
      await onLogout();
    } finally {
      setLogoutPending(false);
    }
  };

  const handleNavigate = (key: string) => {
    onNavigate(key);
    setNavigationOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-[#081a33] px-4 py-5 text-white shadow-xl lg:flex">
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/20 ring-1 ring-blue-300/30">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold">Master Minds</p>
            <p className="truncate text-xs text-slate-400">{roleLabel} control plane</p>
          </div>
        </div>
        <div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/5 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-200">Owner access</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">One protected place for platform-wide decisions.</p>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          <Navigation items={navItems} activeKey={activeKey} onNavigate={onNavigate} />
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          <p className="font-semibold text-white">Protected workspace</p>
          <p className="mt-1 leading-relaxed">Privileged changes remain server-authorized and auditable.</p>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[4.5rem] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 lg:hidden" aria-label="Open administration navigation" aria-keyshortcuts="Control+K Meta+K">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[min(88vw,22rem)] bg-white p-0 text-slate-950">
                  <SheetHeader className="border-b border-slate-200 px-5 py-5 text-left">
                    <SheetTitle>Administration</SheetTitle>
                    <SheetDescription>Choose a workspace section.</SheetDescription>
                  </SheetHeader>
                  <div className="p-4">
                    <Navigation items={navItems} activeKey={activeKey} onNavigate={handleNavigate} compact />
                    {onLogout && (
                      <Button variant="outline" onClick={() => void handleLogout()} disabled={logoutPending} className="mt-5 w-full justify-start gap-2">
                        <LogOut className="h-4 w-4" />
                        {logoutPending ? "Signing out…" : "Log out"}
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="hidden text-[11px] font-bold uppercase tracking-[.16em] text-primary sm:block">{eyebrow}</p>
                  <span className="hidden truncate rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 sm:inline-flex">{activeItem?.label || "Workspace"}</span>
                </div>
                <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{title}</h1>
                <p className="hidden max-w-2xl truncate text-sm text-slate-500 md:block">{activeItem?.description || description}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">Protected</span>
              <span className="hidden text-[11px] text-slate-400 md:inline">⌘K</span>
              {onRefresh && (
                <Button variant="outline" onClick={onRefresh} disabled={refreshing} className="h-10">
                  <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              )}
              {onLogout && (
                <Button variant="ghost" onClick={() => void handleLogout()} disabled={logoutPending} className="h-10 gap-2 text-slate-600 hover:bg-red-50 hover:text-red-700">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{logoutPending ? "Signing out…" : "Log out"}</span>
                </Button>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
