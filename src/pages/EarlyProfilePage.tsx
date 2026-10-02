import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Sparkles, Star, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import EarlyCollectibleCard from "@/features/early/components/EarlyCollectibleCard";
export default function EarlyProfilePage(){
 const nav=useNavigate();const {user}=useUser();const [summary,setSummary]=useState<any>({});const [items,setItems]=useState<any[]>([]);const [owned,setOwned]=useState<Set<string>>(new Set());
 useEffect(()=>{if(!user?.id)return;(async()=>{const [{data:s},{data:i},{data:o}]=await Promise.all([(supabase as any).rpc("get_early_profile_summary",{p_user_id:user.id}),supabase.from("early_collectibles").select("id,name,description,icon,rarity,set_name,price_coins").eq("active",true).order("price_coins"),supabase.from("early_user_collection").select("collectible_id").eq("user_id",user.id)]);setSummary(s??{});setItems(i??[]);setOwned(new Set((o??[]).map((x:any)=>x.collectible_id)));})()},[user?.id]);
 const collection=items.filter(i=>owned.has(i.id));
 return <div className="min-h-screen bg-background px-4 pb-24">
  <header className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center gap-3"><button className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" onClick={()=>nav("/")} aria-label="Back"><ArrowLeft/></button><div className="flex-1"><p className="font-display text-lg font-bold">My Profile</p><p className="text-xs text-muted-foreground">Small profile, big adventure</p></div><Button size="sm" variant="outline" onClick={()=>nav("/early-collection")}>Collection</Button></div></header>
  <main className="mx-auto max-w-4xl space-y-4 py-5">
   <section className="rounded-[2rem] border bg-card p-4 shadow-sm sm:p-5"><div className="flex items-center gap-3"><div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-primary/10 text-5xl shadow-inner">{user?.avatar||"🧑‍🚀"}<span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">Lv {summary.level??1}</span></div><div className="min-w-0"><p className="text-xs font-semibold text-primary">EARLY LEARNER</p><h1 className="truncate text-2xl font-display font-bold">{user?.name||user?.username||"Learner"} 👋</h1><p className="text-sm text-muted-foreground">{user?.grade||"KG"} • Keep growing!</p></div></div>
    <div className="mt-4 grid grid-cols-4 gap-2">{[[Sparkles,"XP",summary.xp??0],[Trophy,"Level",summary.level??1],[Star,"Stars",summary.stars??0],[BookOpen,"Found",summary.discovered??0]].map(([I,l,v]:any)=><div key={l} className="rounded-2xl bg-muted/60 p-2.5 text-center"><I className="mx-auto h-4 w-4 text-primary"/><p className="mt-1 text-[10px] text-muted-foreground">{l}</p><p className="text-base font-display font-bold">{Number(v).toLocaleString()}</p></div>)}</div>
   </section>
   <div className="grid grid-cols-2 gap-3"><Button className="min-h-11" onClick={()=>nav("/early-progress")}>My progress</Button><Button variant="outline" className="min-h-11" onClick={()=>nav("/early-ranks")}>My rank</Button></div>
   <section className="rounded-[2rem] bg-primary/10 p-4 sm:p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">My treasures</p><h2 className="font-display text-xl font-bold">{collection.length} collected</h2></div><Button size="sm" variant="ghost" onClick={()=>nav("/early-collection")}>See all →</Button></div>{collection.length?<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{collection.slice(0,4).map(i=><EarlyCollectibleCard key={i.id} item={i} owned/>)}</div>:<p className="mt-2 text-sm text-muted-foreground">Play, discover and learn to earn your first treasure.</p>}</section>
  </main>
 </div>;
}