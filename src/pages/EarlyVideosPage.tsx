import React from "react";
import { ArrowLeft, ExternalLink, PlayCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const resources = [
  { title:"Math Adventures", description:"Counting, shapes, patterns, and early math practice.", icon:"🔢", href:"https://www.khanacademy.org/kids", source:"Khan Academy Kids" },
  { title:"Reading & Stories", description:"Letters, sounds, words, stories, and read-aloud learning.", icon:"📚", href:"https://www.khanacademy.org/kids/ela", source:"Khan Academy Kids" },
  { title:"Science & Nature", description:"Curiosity-led science, animals, nature, and discovery.", icon:"🌱", href:"https://www.pbs.org/parents/lets-play-games", source:"PBS KIDS" },
  { title:"Creative Time", description:"Stories, art, movement, and playful learning ideas.", icon:"🎨", href:"https://www.khanacademy.org/kids", source:"Khan Academy Kids" },
];

const EarlyVideosPage: React.FC = () => {
  const navigate=useNavigate();
  return <div className="min-h-screen bg-background px-4 pb-24"><header className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center justify-between"><Button variant="ghost" size="icon" onClick={()=>navigate("/")} aria-label="Back"><ArrowLeft/></Button><div className="flex items-center gap-2"><PlayCircle className="h-6 w-6 text-accent"/><h1 className="font-display text-xl font-bold">Videos & Stories</h1></div><Sparkles className="h-5 w-5 text-warning"/></div></header><main className="mx-auto max-w-4xl space-y-6 py-6"><section className="rounded-[2rem] bg-accent/15 p-6 sm:p-8"><p className="font-semibold text-accent">Watch • Wonder • Learn</p><h2 className="mt-1 text-3xl font-display font-bold">Pick something to explore</h2><p className="mt-2 text-muted-foreground">Master Minds keeps this shelf curated around early learning.</p></section><div className="grid gap-4 sm:grid-cols-2">{items.map((item)=><Card key={item.title} className="overflow-hidden rounded-[1.75rem]"><div className="flex h-28 items-center justify-center bg-primary/10 text-6xl">{item.icon}</div><CardContent className="space-y-3 p-5"><h3 className="text-xl font-display font-bold">{item.title}</h3><p className="text-sm text-muted-foreground">{item.description}</p><p className="text-xs font-semibold text-muted-foreground">Curated source: {item.source}</p><Button className="w-full" onClick={()=>window.open(item.href,"_blank","noopener,noreferrer")}>Watch & explore <ExternalLink className="ml-2 h-4 w-4"/></Button></CardContent></Card>)}</div><p className="text-center text-xs text-muted-foreground">This curated shelf is managed by Master Minds and currently opens official learning sources. Watched progress can be added when in-app video hosting is introduced.</p></main></div>;
};
export default EarlyVideosPage;
