import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { useTier } from "@/context/TierContext";
import { Home, Trophy, User, BookOpen, Brain, Gamepad2, Sparkles, Store } from "lucide-react";

const UPPER_STUDY_PATHS = ["/quiz", "/study-mode", "/library", "/academic", "/revision", "/ai-tutor"];
const UPPER_PROFILE_PATHS = ["/profile", "/settings", "/enhanced-settings", "/friends", "/store", "/avatar-creator"];

const StudentBottomNav: React.FC = () => {
  const navigate=useNavigate(), location=useLocation(), {user}=useUser(), tier=useTier();
  if(tier==="upper"){
    const items=[{icon:Home,label:"Home",path:"/",active:["/"]},{icon:BookOpen,label:"Study",path:"/study-mode",active:UPPER_STUDY_PATHS},{icon:Brain,label:"Learning DNA",path:"/learning-dna",active:["/learning-dna"]},{icon:User,label:"Profile",path:"/profile",active:UPPER_PROFILE_PATHS}];
    const active=(paths:string[])=>paths.some(p=>p==="/" ? location.pathname==="/" : location.pathname===p||location.pathname.startsWith(`${p}/`));
    return <NavShell count={4}>{items.map(item=><NavItem key={item.path} {...item} active={active(item.active)} onClick={()=>navigate(item.path)}/>)}</NavShell>;
  }
  if(tier==="early"){
    const profilePath=user?.id?`/profile/${user.id}`:"/settings";
    const items=[{icon:Home,label:"Home",path:"/",active:["/"]},{icon:Gamepad2,label:"Play",path:"/early-games",active:["/early-games"]},{icon:Sparkles,label:"Quiz",path:"/early-quiz",active:["/early-quiz"]},{icon:Trophy,label:"Ranks",path:"/leaderboard",active:["/leaderboard"]},{icon:Store,label:"Store",path:"/store",active:["/store"]}];
    const active=(paths:string[])=>paths.some(p=>p==="/" ? location.pathname==="/" : location.pathname===p||location.pathname.startsWith(`${p}/`));
    return <NavShell count={5}>{items.map(item=><NavItem key={item.path} {...item} active={active(item.active)} onClick={()=>navigate(item.path)}/>)}</NavShell>;
  }
  const profilePath=user?.id?`/profile/${user.id}`:"/settings";
  const items=[{icon:Home,label:"Home",path:"/",active:[pathOr(profilePath)]},{icon:Sparkles,label:"Quiz",path:"/quiz",active:["/quiz"]},{icon:Gamepad2,label:"Lobby",path:"/lobby",active:["/lobby"]},{icon:Trophy,label:"Ranks",path:"/leaderboard",active:["/leaderboard"]},{icon:User,label:"Profile",path:profilePath,active:["/profile","/settings"]}];
  const active=(paths:string[])=>paths.some(p=>p==="/" ? location.pathname==="/" : location.pathname===p||location.pathname.startsWith(`${p}/`));
  return <NavShell count={5}>{items.map(item=><NavItem key={item.path} {...item} active={active(item.active)} onClick={()=>navigate(item.path)}/>)}</NavShell>;
};
const pathOr=(p:string)=>p;
const NavShell:React.FC<{count:number;children:React.ReactNode}>=({count,children})=><div data-guide="bottom-nav" className="bottom-safe-area fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 md:bg-background/90 md:backdrop-blur"><nav aria-label="Primary navigation" className={`mx-auto grid h-16 max-w-lg items-stretch px-2 grid-cols-${count}`}>{children}</nav></div>;
const NavItem:React.FC<any>=({icon:Icon,label,active,onClick})=><motion.button onClick={onClick} whileTap={{scale:.96}} aria-current={active?"page":undefined} className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active?"bg-primary/10 text-primary":"text-muted-foreground hover:text-foreground"}`}><Icon className={`h-5 w-5 ${active?"stroke-[2.5]":""}`} aria-hidden="true"/><span>{label}</span></motion.button>;
export default StudentBottomNav;
