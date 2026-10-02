import { useEffect, useState } from "react";
import { ArrowLeft, Check, Globe2, Lightbulb, Sparkles, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/context/UserContext";
import { useEarlyReward } from "@/hooks/useEarlyReward";
import { getGradeProfile, toEarlyGrade } from "@/features/early/engine/gradeProfile";

const facts = [
  ["🌍","Our Amazing Planet","Earth is the planet we call home. Most of its surface is covered by water.","What covers most of Earth?",["Water","Sand","Clouds","Snow"],"Water"],
  ["🐝","Bee Builders","Bees help plants make seeds by moving pollen from flower to flower.","What do bees help plants move?",["Pollen","Rocks","Rain","Snow"],"Pollen"],
  ["🌈","Rainbow Science","A rainbow appears when sunlight interacts with tiny water droplets in the air.","What helps make a rainbow?",["Sunlight and water","Moonlight and sand","Snow and wind","Fire and rocks"],"Sunlight and water"],
  ["🚀","Space Explorer","The Sun is a star. Earth travels around the Sun.","What is the Sun?",["A star","A planet","A moon","A cloud"],"A star"],
  ["🐙","Ocean Wonder","Octopuses have eight arms and are clever animals that live in the ocean.","How many arms does an octopus have?",["Eight","Six","Ten","Four"],"Eight"],
  ["🌱","Tiny Seed, Big Plant","Plants need things such as light and water to grow.","What helps many plants grow?",["Light and water","Plastic and smoke","Only rocks","Only darkness"],"Light and water"],
  ["🦒","Animal Superpowers","A giraffe's long neck helps it reach leaves high in trees.","What can a giraffe reach?",["High leaves","Deep ocean","The Moon","Underground caves"],"High leaves"],
  ["🌋","Earth's Fire","Volcanoes can release hot melted rock called lava.","What can come from a volcano?",["Lava","Ice cream","Snow","Rainbows"],"Lava"],
] as const;

const speak = (text: string) => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1.15;
  window.speechSynthesis.speak(u);
};

export default function EarlyDiscoverPage() {
  const nav = useNavigate();
  const { user } = useUser();
  const reward = useEarlyReward();
  const profile = getGradeProfile(toEarlyGrade(user?.grade));
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState("");
  const [correct, setCorrect] = useState(false);
  const [rewarded, setRewarded] = useState<boolean | null>(null);
  const [seen, setSeen] = useState<number[]>([]);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem("master-minds-early-discover-seen") || "[]"); if (Array.isArray(saved)) setSeen(saved.filter((x) => Number.isInteger(x))); } catch {} }, []);
  const f = facts[i];
  const answer = f[5];

  const choose = async (value: string) => {
    if (selected) return;
    setSelected(value);
    const ok = value === answer;
    setCorrect(ok);
    if (ok) {
      const saved = await reward("discoverCorrect", { activityId: "early-discover", skill: "general-knowledge" });
      setRewarded(saved);
    } else setRewarded(null);
    speak(ok ? "Excellent! You discovered something new!" : "Nice try! Let's learn it together.");
  };

  const next = () => {
    const nextSeen = Array.from(new Set([...seen, i]));
    const remaining = facts.map((_, index) => index).filter((index) => !nextSeen.includes(index));
    const nextIndex = remaining[0] ?? ((i + 1) % facts.length);
    const normalizedSeen = remaining.length ? nextSeen : [];
    setSeen(normalizedSeen);
    try { localStorage.setItem("master-minds-early-discover-seen", JSON.stringify(normalizedSeen)); } catch {}
    setSelected(""); setCorrect(false); setRewarded(null); setI(nextIndex);
  };

  return <div className="min-h-screen bg-background pb-24">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/")} aria-label="Back"><ArrowLeft /></Button>
        <div className="min-w-0 flex-1"><p className="truncate font-display text-lg font-bold">Discover</p><p className="truncate text-xs text-muted-foreground">{profile.label} • tiny facts, big curiosity</p></div>
        <Badge variant="secondary"><Sparkles className="mr-1 h-3.5 w-3.5" />{i + 1}/{facts.length}</Badge>
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <section className="rounded-[2rem] bg-accent/15 p-6 sm:p-8">
        <div className="flex items-center gap-3"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-background text-4xl">{f[0]}</div><div><p className="font-semibold text-accent">Discovery of the day</p><h1 className="text-2xl font-display font-bold">{f[1]}</h1></div></div>
        <p className="mt-5 text-lg leading-8">{f[2]}</p>
        <Button variant="outline" className="mt-4 min-h-11" onClick={() => speak(f[2])}><Volume2 className="mr-2 h-4 w-4" />Listen</Button>
      </section>
      <Card className="rounded-[2rem]"><CardContent className="p-5 sm:p-7">
        <div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-warning" /><p className="font-display font-bold">Curiosity challenge</p></div>
        <h2 className="mt-3 text-xl font-bold">{f[3]}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">{f[4].map((o) => <Button key={o} variant={selected ? (o === answer ? "default" : "outline") : "outline"} disabled={!!selected} onClick={() => choose(o)} className={`min-h-16 rounded-2xl text-sm font-bold ${selected && o === answer ? "bg-success text-success-foreground" : ""}`}>{selected && o === answer ? <Check className="mr-2 h-4 w-4" /> : null}{o}</Button>)}</div>
        {selected && <div role="status" aria-live="polite" className={`mt-5 rounded-2xl p-4 text-center font-bold ${correct ? "bg-success/15 text-success" : "bg-warning/15 text-foreground"}`}>{correct ? (rewarded === false ? "⚠️ Correct! Your reward could not be saved." : "🎉 Excellent discovery! +5 XP") : "💡 Great try! Now you know the answer."}</div>}
        {selected && <Button className="mt-4 min-h-12 w-full rounded-2xl" onClick={next}>Discover another fact →</Button>}
      </CardContent></Card>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Globe2 className="h-4 w-4" />Science • animals • space • nature • our world</div>
    </main>
  </div>;
}
