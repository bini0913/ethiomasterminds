import React,{useEffect,useState}from"react";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

type Item={id:string;activity_id:string;title:string;description:string;subject:string;skill:string;difficulty:number;route:string;icon:string;active:boolean};
export default function EarlyContentAdminPage(){
 const nav=useNavigate();const [items,setItems]=useState<Item[]>([]);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState<string|null>(null);
 const load=async()=>{const {data}=await supabase.from("early_content_items").select("*").order("subject").order("title");setItems((data??[]) as Item[]);setLoading(false)};
 useEffect(()=>{void load()},[]);
 const update=async(item:Item)=>{setSaving(item.id);const {error}=await supabase.from("early_content_items").update({title:item.title,description:item.description,subject:item.subject,skill:item.skill,difficulty:item.difficulty,icon:item.icon,active:item.active}).eq("id",item.id);if(!error)setItems(x=>x.map(i=>i.id===item.id?item:i));setSaving(null)};
 return <div className="min-h-screen bg-background px-4 pb-12"><header className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center gap-3"><Button variant="ghost" size="icon" onClick={()=>nav("/admin")}><ArrowLeft/></Button><div><h1 className="font-display text-xl font-bold">Early Content</h1><p className="text-xs text-muted-foreground">Manage the KG–4 activity catalog</p></div></div></header><main className="mx-auto max-w-4xl space-y-4 py-6">{loading?<p>Loading…</p>:items.map(item=><Card key={item.id}><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{item.icon} {item.title}</span><Badge variant={item.active?"default":"secondary"}>{item.active?"Active":"Hidden"}</Badge></CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><Input value={item.title} onChange={e=>setItems(x=>x.map(i=>i.id===item.id?{...i,title:e.target.value}:i))}/><Input value={item.skill} onChange={e=>setItems(x=>x.map(i=>i.id===item.id?{...i,skill:e.target.value}:i))}/><Input value={item.subject} onChange={e=>setItems(x=>x.map(i=>i.id===item.id?{...i,subject:e.target.value}:i))}/><Input type="number" min={1} max={3} value={item.difficulty} onChange={e=>setItems(x=>x.map(i=>i.id===item.id?{...i,difficulty:Number(e.target.value)}:i))}/><Input value={item.description} onChange={e=>setItems(x=>x.map(i=>i.id===item.id?{...i,description:e.target.value}:i))}/><div className="flex gap-2"><Button onClick={()=>setItems(x=>x.map(i=>i.id===item.id?{...i,active:!i.active}:i))} variant="outline">{item.active?"Hide":"Activate"}</Button><Button onClick={()=>update(item)} disabled={saving===item.id}><Save className="mr-2 h-4 w-4"/>{saving===item.id?"Saving…":"Save"}</Button></div></CardContent></Card>)}</main></div>;
}
