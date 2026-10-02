import { useEffect, useState } from "react";
import { ArrowLeft, Coins, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import EarlyCollectibleCard from "@/features/early/components/EarlyCollectibleCard";
type Item={id:string;name:string;description:string;icon:string;rarity:string;set_name:string;price_coins:number};
export default function EarlyCollectionPage(){
 const nav=useNavigate(); const {user}=useUser(); const [items,setItems]=useState<Item[]>([]); const [owned,setOwned]=useState<Set<string>>(new Set()); const [coins,setCoins]=useState(0); const [busy,setBusy]=useState<string|null>(null);
 const load=async()=>{if(!user?.id)return;const [a,b,c]=await Promise.all([supabase.from("early_collectibles").select("id,name,description,icon,rarity,set_name,price_coins").eq("active",true).order("price_coins"),supabase.from("early_user_collection").select("collectible_id").eq("user_id",user.id),supabase.from("user_currency").select("coins").eq("user_id",user.id).maybeSingle()]);setItems((a.data??[]) as Item[]);setOwned(new Set((b.data??[]).map((x:any)=>x.collectible_id)));setCoins(c.data?.coins??0);};
 useEffect(()=>{void load()},[user?.id]);
 const buy=async(id:string)=>{setBusy(id);const {error}=await (supabase as any).rpc("purchase_early_item",{p_item_id:id});if(error)toast.error(error.message.includes("Not enough")?"You need more coins.":"Could not add that collectible.");else{toast.success("✨ Treasure unlocked!");await load()}setBusy(null)};
 return <div className="min-h-screen bg-background px-4 pb-24">
  <header className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center gap-3"><button className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" onClick={()=>nav("/")} aria-label="Back"><ArrowLeft/></button><div className="flex-1"><p className="font-display text-xl font-bold">Treasure Collection</p><p className="text-xs text-muted-foreground">Your little museum of wins</p></div><Badge variant="secondary" className="px-3 py-2"><Coins className="mr-1 h-4 w-4"/>{coins}</Badge></div></header>
  <main className="mx-auto max-w-5xl space-y-5 py-6">
   <section className="overflow-hidden rounded-[2rem] bg-primary/10 p-5 sm:p-7"><div className="flex items-center gap-3"><div className="rounded-2xl bg-background p-3 text-3xl">🏛️</div><div><p className="font-semibold text-primary">Collection Book</p><h1 className="text-3xl font-display font-bold">Build your treasure shelf</h1><p className="mt-1 text-sm text-muted-foreground">{owned.size} of {items.length} treasures unlocked. Every activity can help you earn more.</p></div></div></section>
   <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary"/>3D-style collectible display</div>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map(i=><EarlyCollectibleCard key={i.id} item={i} owned={owned.has(i.id)} locked={!owned.has(i.id)} busy={busy===i.id} onBuy={owned.has(i.id)?undefined:()=>buy(i.id)}/>)}</div>
  </main>
 </div>;
}