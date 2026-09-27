import React from "react";
import { Link } from "react-router-dom";
import { Settings, Star } from "lucide-react";
import { toast } from "sonner";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";

const videos = [
  { title: "Animals", emoji: "🦁", subject: "Nature", color: "bg-warning" },
  { title: "Numbers", emoji: "🔢", subject: "Math", color: "bg-primary" },
  { title: "Letters", emoji: "🔤", subject: "Words", color: "bg-accent" },
  { title: "Space", emoji: "🚀", subject: "Science", color: "bg-success" },
];

const games = [
  { title: "Match!", emoji: "🧩", color: "bg-accent" },
  { title: "Count!", emoji: "🍎", color: "bg-warning" },
  { title: "Find!", emoji: "🔎", color: "bg-primary" },
  { title: "Draw!", emoji: "🎨", color: "bg-success" },
];

const showComingSoon = (activity: string) => {
  toast(`${activity} is coming soon!`, { description: "Check back for more fun." });
};

const EarlyTierHome: React.FC = () => {
  const { user } = useUser();
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-primary/10 via-background to-warning/10 pb-8">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="flex min-h-16 items-center gap-3 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary text-3xl shadow-lg shadow-primary/20" aria-hidden="true">🧠</span>
            <span>
              <span className="block font-display text-lg font-bold text-foreground">Master Minds</span>
              <span className="block text-sm font-semibold text-primary">Let&apos;s play!</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle className="h-14 w-14 rounded-2xl" />
            <Link to={profilePath} aria-label="Open your profile" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <AvatarRenderer avatar={user?.avatar} avatarConfig={user?.avatarConfig} size="md" className="h-14 w-14 text-2xl ring-2 ring-primary/30" />
            </Link>
            <Link to="/settings" aria-label="Settings" className="flex h-14 w-14 items-center justify-center rounded-2xl text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Settings className="h-7 w-7" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <section className="rounded-[2rem] bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/20 sm:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-bold">Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋</p>
              <h1 className="mt-1 text-3xl sm:text-4xl">What sounds fun?</h1>
            </div>
            <span className="text-6xl" aria-hidden="true">🌈</span>
          </div>
          <div className="mt-5 flex gap-1" aria-label="Three earned stars">
            {[0, 1, 2].map((star) => <Star key={star} className="h-7 w-7 fill-current text-warning" />)}
          </div>
        </section>

        <nav aria-label="Play areas" className="mt-5 grid grid-cols-2 gap-3">
          <a href="#videos" className="flex min-h-16 items-center justify-center rounded-3xl bg-accent px-4 text-lg font-display font-bold text-accent-foreground shadow-sm transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">📺 Videos</a>
          <a href="#games" className="flex min-h-16 items-center justify-center rounded-3xl bg-success px-4 text-lg font-display font-bold text-success-foreground shadow-sm transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">🎮 Games</a>
        </nav>

        <section id="videos" className="scroll-mt-24 pt-9" aria-labelledby="videos-heading">
          <div className="flex items-center justify-between">
            <h2 id="videos-heading" className="text-2xl">📺 Videos</h2>
            <span className="text-2xl" aria-hidden="true">✨</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {videos.map((video) => (
              <Button key={video.title} variant="outline" onClick={() => showComingSoon(video.title)} className="h-auto min-h-40 flex-col rounded-[1.75rem] border-2 border-border bg-card p-3 text-card-foreground shadow-sm transition hover:-translate-y-1 hover:border-primary/60 hover:bg-card">
                <span className={`flex h-20 w-full items-center justify-center rounded-2xl text-5xl ${video.color}`} aria-hidden="true">{video.emoji}</span>
                <span className="mt-3 font-display text-base font-bold">{video.title}</span>
                <span className="text-xs font-semibold text-muted-foreground">{video.subject}</span>
              </Button>
            ))}
          </div>
        </section>

        <section id="games" className="scroll-mt-24 pt-10" aria-labelledby="games-heading">
          <div className="flex items-center justify-between">
            <h2 id="games-heading" className="text-2xl">🎮 Games</h2>
            <span className="text-2xl" aria-hidden="true">⭐</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {games.map((game) => (
              <Button key={game.title} onClick={() => showComingSoon(game.title)} className={`h-auto min-h-36 flex-col rounded-[1.75rem] p-4 text-primary-foreground shadow-lg transition hover:-translate-y-1 hover:brightness-110 ${game.color}`}>
                <span className="text-5xl" aria-hidden="true">{game.emoji}</span>
                <span className="mt-3 font-display text-lg font-bold">{game.title}</span>
              </Button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default EarlyTierHome;
