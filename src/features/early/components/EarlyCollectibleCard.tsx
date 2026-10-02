import React from "react";

export type CollectibleVisual = { icon: string; accent?: string; glow?: string };

export default function EarlyCollectibleCard({ item, owned, locked=false, onBuy, busy=false }: {
  item: { id:string; name:string; description:string; icon:string; rarity:string; set_name?:string; price_coins:number };
  owned: boolean; locked?: boolean; onBuy?:()=>void; busy?:boolean;
}) {
  return <div className={`relative overflow-hidden rounded-[1.5rem] border bg-card p-3 shadow-sm transition hover:-translate-y-1 ${owned ? "border-primary/30" : "border-border"}`}>
    <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/10 blur-xl" />
    <div className={`mx-auto flex h-28 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 via-card to-accent/10 [transform:perspective(500px)_rotateX(5deg)] ${!owned && locked ? "grayscale opacity-40" : ""}`}>
      <div className="text-6xl drop-shadow-[0_12px_10px_rgba(0,0,0,.18)] [transform:translateZ(22px)_rotate(-5deg)]">{locked ? "🔒" : item.icon}</div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-2">
      <h3 className="font-display font-bold">{item.name}</h3>
      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">{item.rarity}</span>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
    {item.set_name && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.set_name}</p>}
    {owned ? <div className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-center text-xs font-bold text-success">✨ In your collection</div> :
      onBuy && <button disabled={busy} onClick={onBuy} className="mt-3 min-h-10 w-full rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? "Unlocking…" : `🪙 ${item.price_coins} coins`}</button>}
  </div>;
}