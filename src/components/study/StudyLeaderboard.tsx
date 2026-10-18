import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, CalendarDays, Check, Clock3, Copy, Download, ExternalLink, Loader2, RefreshCw, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";

type Period = "day" | "week" | "month" | "all";
type LeaderboardRow = {
  user_id: string;
  name: string;
  total_minutes: number;
  focus_sessions: number;
  updated_at: string | null;
};

const db = supabase as any;
const periodLabels: Record<Period, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
  all: "All time",
};

function getRange(period: Period) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  if (period === "day") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start.setHours(0, 0, 0, 0);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  } else if (period === "month") {
    start.setHours(0, 0, 0, 0);
    start.setDate(1);
  } else {
    start.setTime(0);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatStudyTime(value: number) {
  const minutes = Math.max(0, Number(value) || 0);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function createStoryImage(period: string, minutes: number, rank: number | null, displayName: string) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Your device cannot create a story image."));
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(0.52, "#312e81");
    gradient.addColorStop(1, "#0e7490");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(120 + i * 145, 260 + (i % 3) * 230, 90 + (i % 2) * 35, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? "#a5f3fc" : "#c4b5fd";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.fillStyle = "#a5f3fc";
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillText("MASTER MINDS • STUDY MODE", 540, 390);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 78px system-ui, sans-serif";
    ctx.fillText("My study progress", 540, 540);
    ctx.fillStyle = "#c4b5fd";
    ctx.font = "600 42px system-ui, sans-serif";
    ctx.fillText(period, 540, 625);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 132px system-ui, sans-serif";
    ctx.fillText(formatStudyTime(minutes), 540, 880);
    ctx.fillStyle = "#a5f3fc";
    ctx.font = "600 42px system-ui, sans-serif";
    ctx.fillText(displayName.slice(0, 32), 540, 1010);
    if (rank !== null) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 54px system-ui, sans-serif";
      ctx.fillText(`Leaderboard rank #${rank}`, 540, 1130);
    }
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "500 34px system-ui, sans-serif";
    ctx.fillText("Small focus sessions add up.", 540, 1370);
    ctx.fillText("Keep learning. Keep growing.", 540, 1425);
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.font = "500 28px system-ui, sans-serif";
    ctx.fillText("Track your focus • Celebrate your progress", 540, 1770);
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create story image.")), "image/png");
  });
}

export default function StudyLeaderboard() {
  const { user } = useUser();
  const [period, setPeriod] = useState<Period>("day");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const range = useMemo(() => getRange(period), [period]);

  const loadLeaderboard = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await db.rpc("get_study_period_leaderboard", {
      p_start_at: range.start,
      p_end_at: range.end,
      p_limit: 50,
    });
    if (error) {
      console.error("Study leaderboard load failed", error);
      toast.error("Could not load the Study Mode leaderboard. Please refresh and try again.");
      setRows([]);
    } else {
      setRows((data ?? []) as LeaderboardRow[]);
    }
    setLoading(false);
  }, [user?.id, range.start, range.end]);

  useEffect(() => { void loadLeaderboard(); }, [loadLeaderboard]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`study-leaderboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions" }, () => void loadLeaderboard())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, loadLeaderboard]);

  const mine = rows.find((row) => row.user_id === user?.id);
  const myRank = mine ? rows.findIndex((row) => row.user_id === user?.id) + 1 : null;
  const caption = mine
    ? `I studied ${formatStudyTime(mine.total_minutes)} ${periodLabels[period].toLowerCase()} in Master Minds Study Mode${myRank ? ` and ranked #${myRank}` : ""}! 📚✨`
    : `I'm building my study streak in Master Minds Study Mode! 📚✨`;

  const shareText = async () => {
    const text = `${caption} ${window.location.origin}/study-mode`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    try {
      if (nav.share) await nav.share({ title: "My Master Minds study progress", text, url: `${window.location.origin}/study-mode` });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success("Study score copied. You can paste it into a message.");
      } else {
        throw new Error("Sharing is not available on this device.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Could not share your score.");
    }
  };

  const postToSocial = async () => {
    if (!user?.id) return;
    setPosting(true);
    try {
      const { error } = await supabase.from("social_posts").insert({
        author_id: user.id,
        content: caption,
        image_url: null,
        post_type: "post",
      });
      if (error) throw error;
      toast.success("Your study score was posted to Master Minds Social.");
    } catch (error) {
      console.error("Study score post failed", error);
      toast.error("Could not post to Social. Check your connection and try again.");
    } finally {
      setPosting(false);
    }
  };

  const shareStory = async () => {
    setSharing(true);
    try {
      const blob = await createStoryImage(periodLabels[period], mine?.total_minutes ?? 0, myRank, user?.name?.trim() || mine?.name || "Student");
      const file = new File([blob], "master-minds-study-story.png", { type: "image/png" });
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "My Master Minds study progress", text: caption });
        toast.success("Choose Instagram, WhatsApp, or another supported app in the share sheet.");
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        toast.success("Story image downloaded. Open Instagram or another social app and add it to your Story.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Could not create your story image.");
    } finally {
      setSharing(false);
    }
  };

  const copyScore = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Study score copied.");
    } catch {
      await shareText();
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 text-white">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-white"><Trophy className="h-5 w-5 text-amber-300" /> Study Leaderboard</CardTitle>
            <p className="mt-1 text-sm text-white/60">Compare focused study time and celebrate your progress.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadLeaderboard()} disabled={loading} aria-label="Refresh leaderboard">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label="Leaderboard time period">
          {(["day", "week", "month", "all"] as Period[]).map((item) => (
            <Button key={item} size="sm" variant={period === item ? "default" : "outline"} onClick={() => setPeriod(item)} role="tab" aria-selected={period === item} className="min-h-10">
              {item === "all" ? <Trophy className="h-4 w-4 mr-1" /> : <CalendarDays className="h-4 w-4 mr-1" />}
              {periodLabels[item]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-white/65">Your {periodLabels[period].toLowerCase()} result</p>
              <p className="text-2xl font-bold">{formatStudyTime(mine?.total_minutes ?? 0)}</p>
              <p className="text-xs text-white/60">{mine ? `${mine.focus_sessions} completed focus sessions` : "Finish a focus session to appear on the leaderboard."}</p>
            </div>
            {myRank ? <Badge className="bg-amber-400/15 text-amber-200 border border-amber-300/20">Rank #{myRank}</Badge> : <Badge variant="secondary">Not ranked yet</Badge>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void shareText()}><Share2 className="h-4 w-4 mr-1" />Share score</Button>
            <Button size="sm" variant="secondary" onClick={() => void postToSocial()} disabled={posting}>
              {posting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1" />}Post to Social
            </Button>
            <Button size="sm" variant="outline" onClick={() => void shareStory()} disabled={sharing}>
              {sharing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}Create Story
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void copyScore()}><Copy className="h-4 w-4 mr-1" />Copy</Button>
          </div>
          <p className="mt-2 text-xs text-white/55">Story sharing uses your device’s share sheet when supported; otherwise it downloads a vertical image for Instagram Stories and other apps. Master Minds cannot publish directly to third-party Stories.</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>{periodLabels[period]} rankings</span>
            <span>{rows.length} students</span>
          </div>
          {loading && rows.length === 0 && <div className="py-8 text-center text-sm text-white/60"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading leaderboard…</div>}
          {!loading && rows.length === 0 && <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-white/60"><Award className="mx-auto mb-2 h-6 w-6" />No completed focus sessions in this period yet. Start studying to be the first!</div>}
          {rows.map((row, index) => (
            <div key={row.user_id} className={`flex items-center gap-3 rounded-lg border p-3 ${row.user_id === user?.id ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/10 bg-white/5"}`}>
              <div className="w-7 shrink-0 text-center font-bold text-white/70">{index < 3 ? ["🥇", "🥈", "🥉"][index] : `#${index + 1}`}</div>
              <Avatar className="h-9 w-9"><AvatarFallback className="bg-white/10 text-white">{row.name?.trim()?.charAt(0)?.toUpperCase() || "S"}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}{row.user_id === user?.id ? " (You)" : ""}</p>
                <p className="text-xs text-white/55">{row.focus_sessions} focus sessions</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">{formatStudyTime(row.total_minutes)}</p>
                {row.user_id === user?.id && <Check className="ml-auto h-4 w-4 text-cyan-300" />}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
