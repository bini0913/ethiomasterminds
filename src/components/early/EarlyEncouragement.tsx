import React,{useEffect,useState}from"react";
import{Bell,Sparkles,Volume2}from"lucide-react";

const messages=[
 ["🌟","You're doing great!","Every little step helps your brain grow."],
 ["🚀","Amazing explorer!","What will you discover next?"],
 ["🧠","Brain power!","You kept trying — that's how we learn."],
 ["🎉","Fantastic work!","A new challenge is waiting for you."],
 ["💛","Keep going!","Learning can be fun, one small adventure at a time."]
];

export default function EarlyEncouragement(){
 const[i,setI]=useState(0),[open,setOpen]=useState(false),[notify,setNotify]=useState(()=>localStorage.getItem("early-notifications")!=="off");
 useEffect(()=>{const id=window.setInterval(()=>setI(x=>(x+1)%messages.length),30000);return()=>window.clearInterval(id)},[]);
 const[m,t,d]=messages[i];
 const speak=()=>{"speechSynthesis"in window&&(speechSynthesis.cancel(),speechSynthesis.speak(new SpeechSynthesisUtterance(t)))};
 const enableNotifications=async()=>{
   if(!("Notification"in window)){setNotify(true);localStorage.setItem("early-notifications","on");return}
   const permission=Notification.permission==="granted"? "granted":await Notification.requestPermission();
   if(permission==="granted"){setNotify(true);localStorage.setItem("early-notifications","on");new Notification(t,{body:d})}
 };
 const disableNotifications=()=>{setNotify(false);localStorage.setItem("early-notifications","off")};
 return <div className="fixed right-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-40">
  <button aria-label="Open encouragement" onClick={()=>setOpen(v=>!v)} className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Bell className="h-5 w-5 text-primary"/><span className="absolute right-0 top-0 h-3 w-3 animate-pulse rounded-full bg-warning"/></button>
  {open&&<div role="status" aria-live="polite" className="mt-2 w-[min(21rem,calc(100vw-1.5rem))] rounded-3xl border border-border bg-background p-4 shadow-xl animate-in slide-in-from-top-2 duration-200">
   <div className="flex gap-3"><div className="text-3xl">{m}</div><div className="flex-1"><p className="font-display font-bold">{t}</p><p className="mt-1 text-sm text-muted-foreground">{d}</p></div><Sparkles className="h-5 w-5 shrink-0 text-warning"/></div>
   <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={speak} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary/10 text-sm font-bold text-primary"><Volume2 className="h-4 w-4"/>Hear it</button><button onClick={()=>setOpen(false)} className="min-h-10 rounded-xl px-4 text-sm font-semibold text-muted-foreground">Close</button></div>
   <button onClick={notify?disableNotifications:enableNotifications} className="mt-2 min-h-10 w-full rounded-xl border border-border text-xs font-semibold">{notify?"Notifications on":"Turn on encouragement notifications"}</button>
   {notify&&<p className="mt-2 text-[11px] text-muted-foreground">Browser notifications work while supported by the device. Native Android push requires Firebase/FCM setup.</p>}
  </div>}
 </div>
}