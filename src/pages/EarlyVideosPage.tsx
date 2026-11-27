import { db } from "@/integrations/untypedClient";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, PlayCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { toEarlyGrade, getGradeProfile } from "@/features/early/engine/gradeProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type VideoResource = {
  id: string; title: string; description: string | null; subject: string | null;
  grade_min: number; grade_max: number; provider: string | null; url: string; icon: string | null; fallback_url?: string | null; status?: string;
};

const shelves = [
  { id: "math", title: "Math Lab", icon: "🔢", subject: "math" },
  { id: "reading", title: "Read & Grow", icon: "📚", subject: "reading" },
  { id: "science", title: "Science Safari", icon: "🔬", subject: "science" },
  { id: "creative", title: "Creative Time", icon: "🎨", subject: "creative" },
] as const;

const youtubeEmbed = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    const allowedYouTubeHost = ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host);
    const shortHost = host === "youtu.be";
    const rawId = allowedYouTubeHost ? parsed.searchParams.get("v") : shortHost ? parsed.pathname.split("/").filter(Boolean)[0] : null;
    // Accept only canonical YouTube hosts and valid video IDs; never embed arbitrary URLs.
    return rawId && /^[A-Za-z0-9_-]{11}$/.test(rawId)
      ? `https://www.youtube-nocookie.com/embed/${rawId}?rel=0`
      : null;
  } catch { return null; }
  return null;
};

export default function EarlyVideosPage() {
  const nav = useNavigate();
  const { user } = useUser();
  const grade = toEarlyGrade(user?.grade);
  const profile = getGradeProfile(grade);
  const [active, setActive] = useState<(typeof shelves)[number]["id"]>("math");
  const [resources, setResources] = useState<VideoResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState(false);
  const [savingWatched, setSavingWatched] = useState<Set<string>>(new Set());
  const shelf = useMemo(() => shelves.find((s) => s.id === active) ?? shelves[0], [active]);

  const loadResources = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await db.from("early_video_resources")
        .select("id,title,description,subject,grade_min,grade_max,provider,url,icon,fallback_url,status")
        .eq("active", true).eq("status", "approved").lte("grade_min", grade).gte("grade_max", grade).order("title");
      if (error) throw error;
      if (!isActive()) return;
      setResources((data ?? []) as VideoResource[]);

      if (user?.id) {
        const { data: views, error: viewsError } = await db.from("early_video_views").select("video_id,completed").eq("user_id", user.id);
        if (viewsError) throw viewsError;
        if (!isActive()) return;
        setWatched(new Set((views ?? []).filter((x: any) => x.completed).map((x: any) => x.video_id)));
      } else {
        setWatched(new Set());
      }
    } catch (error) {
      console.error("Early video library load failed:", error);
      if (isActive()) {
        setLoadError(true);
        setResources([]);
      }
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [grade, user?.id]);

  useEffect(() => {
    let mounted = true;
    void loadResources(() => mounted);
    return () => { mounted = false; };
  }, [loadResources]);

  const visible = useMemo(() => resources.filter((item) => !item.subject || item.subject.toLowerCase() === shelf.subject), [resources, shelf.subject]);

  return <div className="min-h-screen bg-background px-4 pb-24">
    <header className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/")} aria-label="Back"><ArrowLeft /></Button>
        <div className="min-w-0 flex-1"><p className="truncate font-display text-xl font-bold">Videos & Stories</p><p className="truncate text-xs text-muted-foreground">{profile.label} • reviewed learning shelf</p></div>
        <PlayCircle className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
      </div>
    </header>
    <main className="mx-auto max-w-4xl space-y-5 py-6">
      <section className="rounded-[2rem] bg-primary/10 p-6 sm:p-8">
        <div className="flex items-center gap-3"><span className="text-4xl" aria-hidden="true">🎬</span><div><p className="font-semibold text-primary">Watch • Wonder • Learn</p><h1 className="text-3xl font-display font-bold">Videos for {profile.label}</h1></div></div>
        <p className="mt-3 text-sm text-muted-foreground">Only approved resources are shown. YouTube videos play inside this library; resources without an embeddable video are clearly marked and cannot be counted as watched.</p>
      </section>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {shelves.map((item) => <button key={item.id} type="button" onClick={() => setActive(item.id)} aria-pressed={active === item.id} className={`min-h-20 rounded-2xl border p-3 text-left font-semibold transition ${active === item.id ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"}`}><span className="text-2xl" aria-hidden="true">{item.icon}</span><span className="mt-1 block text-sm">{item.title}</span></button>)}
      </div>
      {loading ? <Card><CardContent className="p-6 text-center text-sm text-muted-foreground" role="status">Loading reviewed resources…</CardContent></Card> :
        loadError ? <Card><CardContent className="space-y-3 p-6 text-center"><p className="font-semibold">We couldn’t load the video library.</p><p className="text-sm text-muted-foreground">Check your connection and try again.</p><Button variant="outline" onClick={() => { void loadResources(); }}>Try again</Button></CardContent></Card> :
        visible.length === 0 ? <Card><CardContent className="space-y-3 p-6 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground" /><p className="font-semibold">More resources are coming soon.</p><p className="text-sm text-muted-foreground">This shelf is safe by default: unpublished or unreviewed resources are not shown.</p></CardContent></Card> :
        <div className="grid gap-4 sm:grid-cols-2">{visible.map((item) => {
          const embed = youtubeEmbed(item.url);
          return <Card key={item.id} className="overflow-hidden rounded-[1.75rem]">
            {embed ? <div className="aspect-video bg-black"><iframe title={item.title} src={embed} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> :
              <div className="flex aspect-video items-center justify-center bg-muted/50 p-6 text-center"><div><div className="text-4xl" aria-hidden="true">{item.icon || "🎬"}</div><p className="mt-2 text-sm font-semibold">{item.provider || "Master Minds resource"}</p><p className="mt-2 text-xs text-muted-foreground">An embeddable video is not configured yet. This item cannot be marked watched.</p></div></div>}
            <CardContent className="space-y-3 p-5"><div className="flex flex-wrap gap-2"><Badge variant="secondary">{profile.label}</Badge>{item.provider && <Badge variant="outline">{item.provider}</Badge>}</div><h2 className="font-display text-xl font-bold">{item.title}</h2>{item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}{embed && <div className="grid gap-2"><Button variant={watched.has(item.id) ? "secondary" : "default"} disabled={!user?.id || watched.has(item.id) || savingWatched.has(item.id)} className="min-h-11 w-full" onClick={async () => {
            if (!user?.id || savingWatched.has(item.id) || watched.has(item.id)) return;
            setSavingWatched((current) => new Set(current).add(item.id));
            const { error } = await db.from("early_video_views").upsert({ user_id: user.id, video_id: item.id, seconds_watched: 0, completed: true, updated_at: new Date().toISOString() }, { onConflict: "user_id,video_id" });
            setSavingWatched((current) => { const next = new Set(current); next.delete(item.id); return next; });
            if (error) { toast.error("Could not save watched progress. Please try again."); return; }
            setWatched((current) => new Set(current).add(item.id));
            toast.success("Watched progress saved.");
          }}><CheckCircle2 className="mr-2 h-4 w-4" />{savingWatched.has(item.id) ? "Saving…" : watched.has(item.id) ? "Watched ✓" : "I watched it"}</Button></div>}</CardContent>
          </Card>;
        })}</div>}
      <Button variant="outline" className="min-h-12 w-full" onClick={() => nav("/early-explore")}><Sparkles className="mr-2 h-4 w-4" />Continue to Explore</Button>
    </main>
  </div>;
}
