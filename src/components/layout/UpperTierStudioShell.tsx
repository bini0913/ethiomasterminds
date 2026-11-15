import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UpperTierSidebar from "@/components/upper-tier/UpperTierSidebar";
import UpperTierTopbar from "@/components/upper-tier/UpperTierTopbar";
import UpperTierMobileDock from "@/components/upper-tier/UpperTierMobileDock";
import { useUser } from "@/context/UserContext";

export default function UpperTierStudioShell({ children }: { children: React.ReactNode }) {
  const { logout } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen,setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeDrawer=useCallback(()=>setDrawerOpen(false),[]);
  const signOut=async()=>{await logout();navigate("/",{replace:true});};
  const fullBleed=location.pathname==="/chat";
  useEffect(() => {
    if (!drawerOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const drawer = drawerRef.current;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) || []).filter(element => element.offsetParent !== null);
    drawer?.querySelector<HTMLElement>("[data-drawer-close]")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawer?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawer?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [drawerOpen, closeDrawer]);
  return <div className="mm-studio-upper min-h-screen bg-background text-foreground">
    <div className="tier-upper min-h-screen bg-background text-foreground">
      <aside className="upper-tier-sidebar fixed inset-y-0 left-0 z-40 hidden w-[244px] flex-col overflow-hidden md:flex"><UpperTierSidebar onSignOut={signOut}/></aside>
      {drawerOpen&&<div className="fixed inset-0 z-[70] md:hidden"><button type="button" aria-label="Close navigation" onClick={closeDrawer} className="absolute inset-0 bg-slate-950/45"/><aside ref={drawerRef} role="dialog" aria-modal="true" aria-label="Grades 9 to 12 navigation" className="upper-tier-sidebar relative flex h-full w-[min(20rem,88vw)] flex-col overflow-hidden rounded-r-2xl"><UpperTierSidebar onNavigate={closeDrawer} onSignOut={signOut}/></aside></div>}
      <div className="min-h-screen md:pl-[244px]">
        <UpperTierTopbar onOpenMenu={()=>setDrawerOpen(true)}/>
        <main className={fullBleed?"w-full pb-0":"mx-auto w-full max-w-[1600px] px-3 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 md:px-6 md:pb-8 lg:px-8"}>
          {children}
        </main>
      </div>
      <UpperTierMobileDock/>
    </div>
  </div>;
}
