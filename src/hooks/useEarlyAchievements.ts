import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEarlyProgress } from "./useEarlyProgress";
import { toast } from "sonner";
import { useEarlyReward } from "./useEarlyReward";

export type EarlyAchievement={id:string;key:string;name:string;description:string;icon:string;requirement_type:string;requirement_value:number;reward_xp:number;reward_coins:number;progress:number;completed:boolean;};

export function useEarlyAchievements(){
 const {summary,rows}=useEarlyProgress(); const reward=useEarlyReward(); const [items,setItems]=useState<EarlyAchievement[]>([]); const [loading,setLoading]=useState(true);
 const evaluate=useCallback(async()=>{
   const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
   const [{data:defs,error:dErr},{data:mine,error:mErr}]=await Promise.all([
     supabase.from("early_achievements").select("*").eq("active",true),
     supabase.from("early_user_achievements").select("*").eq("user_id",user.id)
   ]);
   if(dErr||mErr){setLoading(false);return;}
   const xp=rows.reduce((n,r)=>n+r.xp_earned,0);
   const math=rows.filter(r=>["number sense","shapes","patterns"].includes(r.skill)).reduce((n,r)=>n+r.attempts,0);
   const reading=rows.filter(r=>["vocabulary","phonics"].includes(r.skill)).reduce((n,r)=>n+r.attempts,0);
   const science=rows.filter(r=>r.skill==="animals").reduce((n,r)=>n+r.attempts,0);
   const coding=rows.filter(r=>r.skill==="sequencing").reduce((n,r)=>n+r.attempts,0);
   const values:Record<string,number>={completions:summary.completions,math_attempts:math,reading_attempts:reading,science_attempts:science,coding_attempts:coding,accuracy_80:summary.attempts>=10&&summary.accuracy>=80?10:summary.attempts,xp_earned:xp};
   const next=(defs??[]).map((d:any)=>{
     const current=values[d.requirement_type]??0; const old=(mine??[]).find((x:any)=>x.achievement_id===d.id);
     return {...d,progress:Math.min(current,d.requirement_value),completed:old?.completed||current>=d.requirement_value};
   });
   setItems(next);setLoading(false);
   for(const d of defs??[]){
     const current=values[d.requirement_type]??0; const old=(mine??[]).find((x:any)=>x.achievement_id===d.id);
     if(current>=d.requirement_value && !old?.completed){
       await reward("discoverCorrect",{activityId:`achievement-${d.key}`,skill:"achievement",completed:true,xpOverride:d.reward_xp,coinsOverride:d.reward_coins});
       await supabase.from("early_user_achievements").upsert({user_id:user.id,achievement_id:d.id,progress:d.requirement_value,completed:true,unlocked_at:new Date().toISOString()},{onConflict:"user_id,achievement_id"});
       toast.success(`${d.icon} ${d.name} unlocked!`,{description:`${d.description} +${d.reward_xp} XP`});
     } else {
       await supabase.from("early_user_achievements").upsert({user_id:user.id,achievement_id:d.id,progress:Math.min(current,d.requirement_value),completed:false},{onConflict:"user_id,achievement_id"});
     }
   }
 },[rows,summary,reward]);
 useEffect(()=>{void evaluate()},[evaluate]);
 const completed=useMemo(()=>items.filter(x=>x.completed),[items]);
 return {items,completed,loading,reload:evaluate};
}
