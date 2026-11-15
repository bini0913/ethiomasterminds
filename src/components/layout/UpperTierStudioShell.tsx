import React, { useState } from "react";
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
  const closeDrawer=()=>setDrawerOpen(false);
  const signOut=async()=>{await logout();navigate("/",{replace:true});};
  const fullBleed=location.pathname==="/chat";
  return <div className="tier-upper min-h-screen bg-background text-foreground">
    <aside className="glass-nav-dock fixed inset-y-3 left-3 z-40 hidden w-64 flex-col overflow-hidden rounded-[28px] md:flex"><UpperTierSidebar onSignOut={signOut}/></aside>
    {drawerOpen&&<div className="fixed inset-0 z-[70] md:hidden"><button type="button" aria-label="Close navigation" onClick={closeDrawer} className="absolute inset-0 bg-slate-950/45"/><aside className="glass-nav-dock relative flex h-full w-[min(20rem,88vw)] flex-col overflow-hidden rounded-r-[28px]"><UpperTierSidebar onNavigate={closeDrawer} onSignOut={signOut}/></aside></div>}
    <div className="min-h-screen md:pl-[284px]">
      <UpperTierTopbar onOpenMenu={()=>setDrawerOpen(true)}/>
      <main className={fullBleed?"w-full pb-0":"mx-auto w-full max-w-[1600px] px-3 py-4 pb-28 sm:px-5 sm:py-6 md:px-6 md:pb-8 lg:px-8"}>
        {children}
      </main>
    </div>
    <UpperTierMobileDock/>
  </div>;
}
