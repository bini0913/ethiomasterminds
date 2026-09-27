import React from "react";
import { ArrowLeft, BookOpen, Code2, HeartHandshake, Lightbulb, Palette, Rocket, Shapes } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const areas = [
  { title: "Read & Listen", description: "Stories, letters, sounds, and read-aloud activities.", icon: BookOpen, href: "https://www.khanacademy.org/kids/ela", source: "Khan Academy Kids" },
  { title: "Math & Thinking", description: "Counting, shapes, patterns, and early problem solving.", icon: Shapes, href: "https://www.khanacademy.org/kids", source: "Khan Academy Kids" },
  { title: "Science Safari", description: "Animals, nature, science, and curious questions.", icon: Lightbulb, href: "https://www.pbs.org/parents/lets-play-games", source: "PBS KIDS" },
  { title: "Create & Draw", description: "Make stories, pictures, characters, and playful creations.", icon: Palette, href: "https://www.scratchjr.org/", source: "ScratchJr" },
  { title: "Coding & Logic", description: "Beginner-friendly sequencing and creative coding.", icon: Code2, href: "https://www.scratchjr.org/", source: "ScratchJr" },
  { title: "Feelings & Kindness", description: "Explore emotions, friendship, and social learning.", icon: HeartHandshake, href: "https://www.pbs.org/parents/lets-play-games", source: "PBS KIDS" },
];

export default function EarlyExplorePage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background px-4 pb-24">
      <header className="-mx-4 sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to Early home"><ArrowLeft /></Button>
          <div className="flex-1">
            <p className="font-display text-lg font-bold">Explore</p>
            <p className="text-xs text-muted-foreground">More ways to learn and create.</p>
          </div>
          <Rocket className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 py-6">
        <section className="rounded-[2rem] bg-primary/10 p-6 sm:p-8">
          <p className="font-semibold text-primary">Discover • Create • Grow</p>
          <h1 className="mt-1 text-3xl font-display font-bold">Choose an adventure</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">These curated resources add extra learning experiences while the Master Minds content library grows.</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          {areas.map(({ title, description, icon: Icon, href, source }) => (
            <Card key={title} className="rounded-[1.75rem]">
              <CardContent className="space-y-4 p-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-7 w-7" /></div>
                <div>
                  <h2 className="font-display text-xl font-bold">{title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                <p className="text-xs font-semibold text-muted-foreground">Curated source: {source}</p>
                <a href={href} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="min-h-11 w-full">Explore resource</Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
