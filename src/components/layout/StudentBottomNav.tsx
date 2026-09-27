import React from "react";
import { useNavigate,useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home,Gamepad2,Globe2,Trophy,Gift,BookOpen,User,Swords } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";

const StudentBottomNav:React.FC=()=>{
 const navigate=useNavigate(),location=useLocation(),{user}=useUser();
 const profilePath=user?.id?"/profile/"+user.id:"/settings";
 const early=getUserTier(user?.grade)==="early";
 const items=early?[
  {icon:Home,label:"Home",path:"/",match:["/"]},
  {icon:Gamepad2,label:"Play",path:"/early-games",match:["/early-games"]},
  {icon:Globe2,label:"Discover",path:"/early-discover",match:["/early-discover","/early-videos","/early-explore"]},
  {icon:Trophy,label:"Ranks",path:"/leaderboard",match:["/leaderboard"]},
  {icon:Gift,label:"Rewards",path:"/store",match:["/store"]},
 ]:[
  {icon:Home,label:"Home",path:"/",match:["/"]},
  {icon:BookOpen,label:"Study",path:"/quiz",match:["/quiz","/study-mode","/library","/ai-tutor","/academic","/revision"]},
  {icon:Swords,label:"Play",path:"/lobby",match:["/lobby","/multiplayer","/tournaments"]},
  {icon:Trophy,label:"Ranks",path:"/leaderboard",match:["/leaderboard"]},
  {icon:User,label:"Profile",path:profilePath,match:["/profile/","/friends","/store","/settings","/enhanced-settings","/avatar-creator"]},
 ];
 const active=(paths:string[])=>paths.some(p=>p==="/" ? location.pathname==="/" : location.pathname.startsWith(p));
 return <div data-guide="bottom-nav" className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/95 pb-safe backdrop-blur-xl">
  <nav aria-label="Primary" className="mx-auto flex h-16 max-w-lg items-center justify-around px-1 sm:h-[68px]">
   {items.map(item=>{const Icon=item.icon,is=active(item.match);return <motion.button key={item.label} type="button" onClick={()=>navigate(item.path)} whileTap={{scale:.94}} className={`flex min-w-14 min-h-12 flex-1 max-w-24 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${is?"bg-primary/10 text-primary":"text-muted-foreground hover:text-foreground"}`} aria-current={is?"page":undefined}><Icon className={`h-5 w-5 ${is?"stroke-[2.5]":""}`} aria-hidden="true"/><span className="text-[10px] font-semibold">{item.label}</span></motion.button>})}
  </nav>
 </div>;
};
export default StudentBottomNav;