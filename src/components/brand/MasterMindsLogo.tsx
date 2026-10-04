import React from "react";

type LogoVariant = "light" | "dark" | "mono";
type LogoLayout = "horizontal" | "stacked" | "symbol";

interface MasterMindsLogoProps {
  variant?: LogoVariant;
  layout?: LogoLayout;
  className?: string;
  symbolClassName?: string;
  showTagline?: boolean;
  "aria-label"?: string;
}

const COLORS = { navy: "#0A1526", electric: "#0055FF", cyan: "#00E5FF", white: "#FFFFFF" };

export default function MasterMindsLogo({
  variant = "dark",
  layout = "horizontal",
  className = "",
  symbolClassName = "",
  showTagline = false,
  "aria-label": ariaLabel = "Master Minds",
}: MasterMindsLogoProps) {
  const markStroke = variant === "light" ? COLORS.white : variant === "mono" ? "currentColor" : COLORS.navy;
  const textColor = variant === "light" ? COLORS.white : variant === "mono" ? "currentColor" : COLORS.navy;
  const taglineColor = variant === "light" ? COLORS.cyan : variant === "mono" ? "currentColor" : COLORS.electric;
  const gradientId = "master-minds-gradient-" + variant;

  const symbol = (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={symbolClassName} fill="none">
      <defs>
        <linearGradient id={gradientId} x1="5" y1="65" x2="95" y2="65" gradientUnits="userSpaceOnUse">
          <stop stopColor={COLORS.cyan} />
          <stop offset="1" stopColor={COLORS.electric} />
        </linearGradient>
      </defs>
      <path d="M5 65 A48 48 0 0 1 95 65" stroke={variant === "mono" ? "currentColor" : "url(#" + gradientId + ")"} strokeWidth="10" strokeLinecap="round" />
      <path d="M18 85 L35 28 L50 58 L65 28 L82 85" stroke={markStroke} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (layout === "symbol") return <span className={"inline-flex " + className} aria-label={ariaLabel}>{symbol}</span>;

  return (
    <div className={(layout === "stacked" ? "flex flex-col" : "flex flex-row") + " items-center " + (layout === "stacked" ? "gap-3" : "gap-4") + " " + className} aria-label={ariaLabel} role="img">
      {symbol}
      <div className={(layout === "stacked" ? "text-center" : "text-left") + " leading-none"}>
        <div className="font-bold tracking-[-0.06em]" style={{ color: textColor, fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif" }}>MASTER</div>
        <div className="font-light tracking-[0.08em]" style={{ color: textColor, fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif" }}>MINDS</div>
        {showTagline && <div className="mt-3 text-[0.6rem] font-medium uppercase tracking-[0.24em]" style={{ color: taglineColor }}>Better minds. A brighter future.</div>}
      </div>
    </div>
  );
}
