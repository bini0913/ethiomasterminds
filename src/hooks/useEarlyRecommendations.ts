import { useMemo } from "react";
import { useEarlyProgress } from "./useEarlyProgress";

export type EarlyRecommendation = {
  activityId:string; title:string; description:string; skill:string; route:string; icon:string; reason:string;
};

const catalog:EarlyRecommendation[]=[
 {activityId:"number-quest",title:"Number Quest",description:"Build number sense with quick challenges.",skill:"number sense",route:"/early-games",icon:"🔢",reason:"Practise numbers"},
 {activityId:"word-match",title:"Word Match",description:"Connect pictures with early words.",skill:"vocabulary",route:"/early-games",icon:"🔤",reason:"Practise reading"},
 {activityId:"shape-hunt",title:"Shape Hunt",description:"Find shapes and build spatial thinking.",skill:"shapes",route:"/early-games",icon:"🔷",reason:"Practise shapes"},
 {activityId:"pattern-builder",title:"Pattern Builder",description:"Predict what comes next.",skill:"patterns",route:"/early-games",icon:"🧩",reason:"Practise patterns"},
 {activityId:"animal-detective",title:"Animal Detective",description:"Solve science clues about animals.",skill:"animals",route:"/early-games",icon:"🔎",reason:"Explore science"},
 {activityId:"word-builder",title:"Word Builder",description:"Practise sounds and spelling.",skill:"phonics",route:"/early-games",icon:"🧱",reason:"Practise phonics"},
 {activityId:"coding-robot",title:"Coding Robot",description:"Build simple command sequences.",skill:"sequencing",route:"/early-games",icon:"🤖",reason:"Try coding"},
];

export function useEarlyRecommendations(){
 const {rows}=useEarlyProgress();
 return useMemo(()=>{
   const scored=catalog.map(item=>{
     const matches=rows.filter(r=>r.skill===item.skill);
     const attempts=matches.reduce((n,r)=>n+r.attempts,0);
     const correct=matches.reduce((n,r)=>n+r.correct_answers,0);
     const accuracy=attempts?correct/attempts:0;
     const score=attempts===0?100:(1-accuracy)*100+Math.max(0,10-attempts);
     return {...item,score,reason:attempts===0?"New skill":accuracy<.8?"Keep practising":item.reason};
   });
   return scored.sort((a,b)=>b.score-a.score).slice(0,3);
 },[rows]);
}
