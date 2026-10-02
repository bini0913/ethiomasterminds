import { useMemo, useState } from "react";
import { ArrowLeft, PlayCircle, Sparkles, BookOpen, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { toEarlyGrade, getGradeProfile } from "@/features/early/engine/gradeProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const shelves = [
  { id: "math", title: "Math Lab", icon: "🔢", q: ["early math counting for kindergarten", "grade 1 addition subtraction for kids", "grade 2 multiplication math for kids", "grade 3 multiplication division math for kids", "grade 4 fractions multiplication math for kids"] },
  { id: "reading", title: "Read & Grow", icon: "📚", q: ["phonics letter sounds for kindergarten", "grade 1 reading phonics", "grade 2 reading comprehension for kids", "grade 3 grammar reading for kids", "grade 4 vocabulary grammar for kids"] },
  { id: "science", title: "Science Safari", icon: "🔬", q: ["science animals for kindergarten", "grade 1 science plants animals", "grade 2 science earth space for kids", "grade 3 science ecosystems for kids", "grade 4 science energy matter for kids"] },
  { id: "world", title: "World Explorer", icon: "🌍", q: ["world geography for young children", "grade 1 geography for kids", "grade 2 geography continents for kids", "grade 3 Ethiopia geography for kids", "grade 4 world geography Ethiopia for kids"] },
];

export default function EarlyVideosPage() {
  const nav = useNavigate();
  const { user } = useUser();
  const grade = toEarlyGrade(user?.grade);
  const profile = getGradeProfile(grade);
  const [active, setActive] = useState(shelves[0].id);
  const shelf = shelves.find((s) => s.id === active) ?? shelves[0];
  const query = useMemo(() => encodeURIComponent(shelf.q[grade]), [shelf, grade]);

  return <div className="min-h-screen bg-background px-4 pb-24">
    <header className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center gap-3"><Button variant="ghost" size="icon" onClick={() => nav("/")} aria-label="Back"><ArrowLeft /></Button><div className="flex-1"><p className="font-display text-xl font-bold">Videos & Stories</p><p className="text-xs text-muted-foreground">{profile.label} • curated learning shelf</p></div><PlayCircle className="h-6 w-6 text-primary" /></div></header>
    <main className="mx-auto max-w-4xl space-y-5 py-6">
      <section className="rounded-[2rem] bg-primary/10 p-6 sm:p-8"><div className="flex items-center gap-3"><span className="text-4xl">🎬</span><div><p className="font-semibold text-primary">Watch • Wonder • Learn</p><h1 className="text-3xl font-display font-bold">Videos made for {profile.label}</h1></div></div><p className="mt-3 text-sm text-muted-foreground">Videos stay inside Master Minds. The shelf changes with the learner's grade.</p></section>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{shelves.map((s) => <button key={s.id} onClick={() => setActive(s.id)} className={`rounded-2xl border p-3 text-left font-semibold ${active === s.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}><span className="text-2xl">{s.icon}</span><span className="mt-1 block text-sm">{s.title}</span></button>)}</div>
      <Card className="overflow-hidden rounded-[2rem]"><div className="aspect-video w-full bg-black"><iframe title={`${shelf.title} for ${profile.label}`} src={`https://www.youtube-nocookie.com/embed?listType=search&list=${query}&rel=0`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><CardContent className="space-y-3 p-5"><div className="flex items-center gap-2"><Badge variant="secondary">{profile.label}</Badge><Badge variant="outline">{shelf.title}</Badge></div><h2 className="font-display text-xl font-bold">Keep exploring</h2><p className="text-sm text-muted-foreground">Master Minds embeds the player here. Admin-reviewed video IDs can replace search discovery for the final child-safe production library.</p><div className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="h-4 w-4" />Use short sessions and discuss what was learned.</div></CardContent></Card>
      <Card><CardContent className="flex gap-3 p-4"><BookOpen className="h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">Search results can change over time, so the final production library should use reviewed resources.</p></CardContent></Card>
      <Button variant="outline" className="min-h-12 w-full" onClick={() => nav("/early-explore")}><Sparkles className="mr-2 h-4 w-4" />Continue to Explore</Button>
    </main>
  </div>;
}
