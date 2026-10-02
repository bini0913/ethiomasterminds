import { useMemo, useState } from "react";
import { ArrowLeft, Brain, Check, Lightbulb, Rocket, Search, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { toEarlyGrade, getGradeProfile } from "@/features/early/engine/gradeProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const areas = [
  { id: "animals", title: "Animal Kingdom", icon: "🦁", desc: "Habitats, animal clues, food chains and amazing adaptations.", min: 0 },
  { id: "space", title: "Space Mission", icon: "🚀", desc: "Planets, stars, the Moon and big questions about space.", min: 1 },
  { id: "body", title: "Amazing Body", icon: "🫀", desc: "Senses, organs, movement and how our bodies work.", min: 1 },
  { id: "ethiopia", title: "Ethiopia & the World", icon: "🇪🇹", desc: "Places, people, culture, landmarks and geography.", min: 0 },
  { id: "art", title: "Art Studio", icon: "🎨", desc: "Colours, patterns, shapes and creative challenges.", min: 0 },
  { id: "music", title: "Music Room", icon: "🎵", desc: "Rhythm, instruments, sound and musical patterns.", min: 0 },
  { id: "how", title: "How Things Work", icon: "⚙️", desc: "Simple machines, everyday science and curious explanations.", min: 2 },
  { id: "puzzles", title: "Puzzle Planet", icon: "🧩", desc: "Logic, patterns, memory and mini brain challenges.", min: 0 },
  { id: "stories", title: "Story Corner", icon: "📖", desc: "Short reading prompts and imagination starters.", min: 0 },
  { id: "kindness", title: "Kindness Lab", icon: "💛", desc: "Friendship, feelings, teamwork and thoughtful choices.", min: 0 },
  { id: "maps", title: "Map Makers", icon: "🗺️", desc: "Continents, directions and places near and far.", min: 2 },
  { id: "invent", title: "Inventor Garage", icon: "💡", desc: "Design, build and explain your own ideas.", min: 3 },
];
const topics = [
  { title: "Why do birds have feathers?", body: "Feathers help birds stay warm, protect their bodies and, for many birds, help them fly.", question: "Name one job feathers can do.", answer: "Keep a bird warm, protect it, or help it fly." },
  { title: "Why does a shadow change?", body: "A shadow changes when the position of the light or the object changes.", question: "What can make a shadow move?", answer: "Moving the light or the object." },
  { title: "How do plants make food?", body: "Leaves use sunlight, water and carbon dioxide to make food for the plant.", question: "What provides the energy?", answer: "Sunlight." },
  { title: "Where is Ethiopia?", body: "Ethiopia is in the Horn of Africa, in the eastern part of the African continent.", question: "Which continent is Ethiopia in?", answer: "Africa." },
];

export default function EarlyExplorePage() {
  const nav = useNavigate();
  const { user } = useUser();
  const grade = toEarlyGrade(user?.grade);
  const profile = getGradeProfile(grade);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const visible = useMemo(() => areas.filter((a) => grade >= a.min && a.title.toLowerCase().includes(search.toLowerCase())), [grade, search]);
  const current = topics[topic % topics.length];

  const next = () => { setRevealed(false); setTopic((x) => x + 1); };

  return <div className="min-h-screen bg-background px-4 pb-24">
    <header className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" onClick={() => nav("/")} aria-label="Back"><ArrowLeft /></button>
        <div className="min-w-0 flex-1"><p className="truncate font-display text-xl font-bold">Explore</p><p className="truncate text-xs text-muted-foreground">{profile.label} • Master Minds resource hub</p></div>
        <Rocket className="h-6 w-6 text-primary" aria-hidden="true" />
      </div>
    </header>
    <main className="mx-auto max-w-4xl space-y-6 py-6">
      <section className="rounded-[2rem] bg-primary/10 p-6 sm:p-8"><p className="font-semibold text-primary">Learn inside Master Minds</p><h1 className="mt-1 text-3xl font-display font-bold">Choose your next adventure</h1><p className="mt-2 text-muted-foreground">Pick a topic, learn something, then try a mini challenge.</p></section>
      <div className="relative"><Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" aria-hidden="true" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topics..." aria-label="Search Explore topics" className="min-h-12 rounded-2xl pl-10" /></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{visible.map((a) => <button key={a.id} type="button" onClick={() => { setTopic(areas.findIndex((x) => x.id === a.id)); setRevealed(false); }} className="min-h-44 rounded-[1.75rem] border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-1 active:scale-[.98]"><div className="text-4xl" aria-hidden="true">{a.icon}</div><h2 className="mt-3 font-display font-bold">{a.title}</h2><p className="mt-1 text-xs text-muted-foreground">{a.desc}</p><Badge variant="secondary" className="mt-3">{a.min === 0 ? "All early grades" : `From Grade ${a.min}`}</Badge></button>)}</div>
      <Card className="rounded-[2rem]"><CardContent className="space-y-4 p-5 sm:p-7">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/15"><Lightbulb className="h-6 w-6 text-warning" /></div><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Learn → Think → Answer</p><h2 className="font-display text-2xl font-bold">{current.title}</h2></div></div>
        <p className="leading-7 text-muted-foreground">{current.body}</p>
        <div className="rounded-2xl bg-muted/50 p-4"><p className="font-semibold">{current.question}</p>{revealed ? <p role="status" className="mt-2 flex items-start gap-2 text-sm font-semibold text-success"><Check className="mt-0.5 h-4 w-4 shrink-0" />{current.answer}</p> : <p className="mt-2 text-sm text-muted-foreground">Think first, then reveal the answer.</p>}</div>
        {!revealed ? <Button className="min-h-11 rounded-2xl" onClick={() => setRevealed(true)}>Reveal answer</Button> : <Button variant="outline" className="min-h-11 rounded-2xl" onClick={next}>Next discovery →</Button>}
      </CardContent></Card>
      <div className="grid grid-cols-2 gap-3"><Card><CardContent className="p-4"><Star className="h-5 w-5 text-warning" /><p className="mt-2 font-bold">Curious streak</p><p className="text-xs text-muted-foreground">Keep discovering every day.</p></CardContent></Card><Card><CardContent className="p-4"><Brain className="h-5 w-5 text-primary" /><p className="mt-2 font-bold">Brain builder</p><p className="text-xs text-muted-foreground">Try a game after each topic.</p></CardContent></Card></div>
    </main>
  </div>;
}
