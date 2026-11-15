import { useLocation, useNavigate } from "react-router-dom";
import { Home, BookOpen, Target, Trophy, Bot } from "lucide-react";
const items = [
  { label:"Home",to:"/",icon:Home },
  { label:"Learn",to:"/academic",icon:BookOpen },
  { label:"Practice",to:"/quiz",icon:Target },
  { label:"Rank",to:"/leaderboard",icon:Trophy },
  { label:"AI Tutor",to:"/ai-tutor",icon:Bot },
];
function isActive(path:string,to:string){if(to==="/")return path==="/";return path===to||path.startsWith(to+"/");}
export default function UpperTierMobileDock(){
 const location=useLocation();const navigate=useNavigate();
 return <nav aria-label="Primary mobile navigation" className="glass-nav-dock fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 mx-auto flex max-w-md items-center justify-around gap-1 rounded-full px-2 py-2 md:hidden">
  {items.map(item=>{const Icon=item.icon;const active=isActive(location.pathname,item.to);return <button key={item.to} type="button" onClick={()=>navigate(item.to)} aria-current={active?"page":undefined} className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-1 py-1 text-[10px] font-bold transition-all duration-200 active:scale-95 ${active?"glass-pill-active":"text-muted-foreground hover:bg-muted/60"}`}><Icon className="h-[18px] w-[18px]"/><span className="max-w-full truncate">{item.label}</span></button>;})}
 </nav>;
}
