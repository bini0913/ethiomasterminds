import { createContext, useContext, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { Bell, ChevronRight, MoreHorizontal, Search, Sparkles } from "lucide-react";

export const NavCtx = createContext<(id: string) => void>(() => {});
export const useGo = () => useContext(NavCtx);

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>{children}</div>;
}

const btn = {
  primary: "bg-primary text-primary-foreground shadow-glow hover:brightness-110",
  secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
  outline: "border bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  gold: "bg-goldgrad text-navy shadow-card hover:brightness-105",
  danger: "bg-destructive text-destructive-foreground hover:brightness-110",
};
export function Btn({
  v = "primary", className, children, size = "md", ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> & { v?: keyof typeof btn; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4 text-sm";
  return (
    <Button variant="ghost" type="button" {...props} className={cn("inline-flex items-center justify-center gap-2 whitespace-normal rounded-xl font-semibold transition-all active:scale-[.98]", s, btn[v], className)}>
      {children}
    </Button>
  );
}

const tones = {
  blue: "bg-primary-soft text-primary",
  green: "bg-success-soft text-success",
  gold: "bg-gold-soft text-gold",
  coral: "bg-coral-soft text-coral",
  violet: "bg-violet-soft text-violet",
  gray: "bg-muted text-muted-foreground",
};
export type Tone = keyof typeof tones;
export function Pill({ tone = "blue", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

const barTone = { blue: "bg-primary", green: "bg-success", gold: "bg-gold", coral: "bg-coral", violet: "bg-violet", gray: "bg-muted-foreground" };
export function Bar({ value, tone = "blue", className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full", barTone[tone])} style={{ width: `${value}%` }} />
    </div>
  );
}

export function Av({ name, tone = "blue", size = 36 }: { name: string; tone?: Tone; size?: number }) {
  const ini = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full font-bold", tones[tone])} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {ini}
    </div>
  );
}

export function IconBox({ icon: I, tone = "blue", size = 40 }: { icon: LucideIcon; tone?: Tone; size?: number }) {
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-xl", tones[tone])} style={{ width: size, height: size }}>
      <I style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

export function Stat({ label, value, delta, icon, tone = "blue" }: { label: string; value: string; delta?: string; icon: LucideIcon; tone?: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {delta && <p className="mt-0.5 text-xs font-semibold text-success">{delta}</p>}
        </div>
        <IconBox icon={icon} tone={tone} size={36} />
      </div>
    </Card>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-sm font-bold tracking-tight">{title}</h3>
      {action}
    </div>
  );
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-primary-foreground shadow-glow">
        <Sparkles className="h-4 w-4" />
      </div>
      <span className={cn("font-display text-lg font-semibold", light ? "text-navy-foreground" : "text-foreground")}>Master Minds</span>
    </div>
  );
}

export type NavItem = { id: string; label: string; icon: LucideIcon };

/** In-mockup application shell (sidebar + topbar) used by most app pages. */
export function AppFrame({ nav, active, title, subtitle, children, role = "Student", actions, mobileMore }: {
  nav: NavItem[]; active: string; title: string; subtitle?: string; children: ReactNode; role?: string; actions?: ReactNode; mobileMore?: NavItem[];
}) {
  const go = useGo();
  const [moreOpen, setMoreOpen] = useState(false);
  const mobilePrimary = nav.slice(0, 4);
  const mobileOverflow = mobileMore ?? nav.slice(4);
  return (
    <div className="flex min-h-[760px] bg-canvas">
      <aside className="hidden w-56 shrink-0 flex-col bg-navy p-4 @3xl:flex">
        <Logo light />
        <p className="mt-1 pl-10 text-[10px] uppercase tracking-widest text-navy-muted">{role}</p>
        <nav className="mt-6 space-y-1">
          {nav.map((n) => (
            <Button variant="ghost" key={n.id + n.label} onClick={() => go(n.id)}
              className={cn("flex h-auto w-full justify-start items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                n.id === active ? "bg-primary text-primary-foreground shadow-glow" : "text-navy-muted hover:bg-navy-2 hover:text-navy-foreground")}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Button>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b bg-card px-3 py-3 sm:gap-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="hidden items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground @2xl:flex">
            <Search className="h-3.5 w-3.5" /> Search anything…
          </div>
          {actions && <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div>}
          <Button variant="ghost" size="icon" title="Notifications" aria-label="Notifications" onClick={() => go("notifications")} className="relative shrink-0 grid h-9 w-9 place-items-center rounded-xl hover:bg-muted">
            <Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-coral" />
          </Button>
          <Button variant="ghost" size="icon" title="Profile" aria-label="Profile" onClick={() => go("profile")}><Av name="Amara Tesfaye" /></Button>
        </header>
        <main className="flex-1 p-3 pb-5 sm:p-5">{children}</main>
        <nav aria-label="Mobile app navigation" className="sticky bottom-0 z-40 flex items-stretch justify-around border-t bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_-20px_rgba(15,23,42,.45)] backdrop-blur @3xl:hidden">
          {mobilePrimary.map((n) => (
            <Button variant="ghost" key={n.id + n.label} onClick={() => { setMoreOpen(false); go(n.id); }} aria-current={n.id === active ? "page" : undefined} className={cn("flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold", n.id === active ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
              <n.icon className="h-[18px] w-[18px]" /> <span className="max-w-full truncate">{n.label}</span>
            </Button>
          ))}
          {mobileOverflow.length > 0 && <div className="relative flex min-w-0 flex-1 justify-center">
            <Button variant="ghost" aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen((open) => !open)} className={cn("flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold", moreOpen || mobileOverflow.some((n) => n.id === active) ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
              <MoreHorizontal className="h-[18px] w-[18px]" /><span>More</span>
            </Button>
            {moreOpen && <div id="mobile-more-menu" className="absolute bottom-[calc(100%+0.75rem)] right-0 z-50 max-h-[min(65vh,28rem)] w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border bg-card p-2 shadow-xl" aria-label="More destinations">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">More destinations</p>
              {mobileOverflow.map((n) => <button key={n.id + n.label} onClick={() => { setMoreOpen(false); go(n.id); }} aria-current={n.id === active ? "page" : undefined} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", n.id === active && "bg-primary/10 text-primary")}><n.icon className="h-4 w-4 shrink-0"/><span className="min-w-0 flex-1">{n.label}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground"/></button>)}
            </div>}
          </div>}
        </nav>
      </div>
    </div>
  );
}
