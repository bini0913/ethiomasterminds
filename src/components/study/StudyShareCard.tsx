import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Share2 } from "lucide-react";

type StudyShareCardProps = {
  name: string;
  level: number;
  todayMinutes: number;
  weekMinutes: number;
  streakDays: number;
  className?: string;
};

const W = 1080;
const H = 1920;

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawStory = (canvas: HTMLCanvasElement, props: StudyShareCardProps) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background: deep navy → royal blue gradient with glow orbs.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1026");
  bg.addColorStop(0.55, "#16215c");
  bg.addColorStop(1, "#0b1026");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const orb = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  orb(W * 0.85, H * 0.12, 420, "rgba(99,102,241,0.5)");
  orb(W * 0.1, H * 0.75, 460, "rgba(34,211,238,0.35)");
  orb(W * 0.9, H * 0.9, 380, "rgba(244,114,182,0.3)");

  // Brand
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 44px 'Space Grotesk', sans-serif";
  ctx.fillText("MASTER MINDS", W / 2, 190);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 30px 'DM Sans', sans-serif";
  ctx.fillText("ethiomasterminds.lovable.app", W / 2, 245);

  // Headline
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 92px 'Space Grotesk', sans-serif";
  ctx.fillText("I studied", W / 2, 560);
  ctx.font = "800 200px 'Space Grotesk', sans-serif";
  const hours = props.todayMinutes >= 60 ? `${(props.todayMinutes / 60).toFixed(1)}h` : `${props.todayMinutes}m`;
  ctx.fillText(hours, W / 2, 780);
  ctx.font = "800 92px 'Space Grotesk', sans-serif";
  ctx.fillText("today 🎯", W / 2, 920);

  // Stats cards
  const stats = [
    { label: "THIS WEEK", value: `${(props.weekMinutes / 60).toFixed(1)}h` },
    { label: "STREAK", value: `${props.streakDays} 🔥` },
    { label: "LEVEL", value: `${props.level}` },
  ];
  const cardW = 300;
  const gap = 30;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;
  stats.forEach((stat, i) => {
    const x = startX + i * (cardW + gap);
    const y = 1080;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, x, y, cardW, 220, 32);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 64px 'Space Grotesk', sans-serif";
    ctx.fillText(stat.value, x + cardW / 2, y + 110);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 26px 'DM Sans', sans-serif";
    ctx.fillText(stat.label, x + cardW / 2, y + 170);
  });

  // Name + CTA
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 48px 'DM Sans', sans-serif";
  ctx.fillText(`— ${props.name} —`, W / 2, 1520);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "500 34px 'DM Sans', sans-serif";
  ctx.fillText("Join me on Master Minds and beat my streak!", W / 2, 1600);
};

const StudyShareCard: React.FC<StudyShareCardProps> = (props) => {
  const [busy, setBusy] = useState(false);

  const generate = async (): Promise<Blob | null> => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    try {
      await document.fonts.ready;
    } catch {
      // fonts are decorative; continue with fallbacks
    }
    drawStory(canvas, props);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  };

  const onShare = async () => {
    setBusy(true);
    try {
      const blob = await generate();
      if (!blob) throw new Error("Could not create image");
      const file = new File([blob], "master-minds-study-story.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Master Minds study progress" });
        toast.success("Shared! Post it to your story 🎉");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "master-minds-study-story.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Story image downloaded — post it to Instagram or TikTok!");
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") toast.error("Could not create the share image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={() => void onShare()} disabled={busy} variant="secondary" className={props.className}>
      {navigator.canShare?.({ files: [] as File[] }) ? <Share2 className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
      {busy ? "Creating…" : "Share my progress"}
    </Button>
  );
};

export default StudyShareCard;
