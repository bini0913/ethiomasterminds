export type RankTierName =
  | "BRONZE"
  | "SILVER"
  | "DIAMOND"
  | "ROOKIE"
  | "SMART"
  | "GENIUS"
  | "ACHIEVER"
  | "MASTER"
  | "MASTER MIND";

export interface RankTierConfig {
  name: RankTierName;
  minLevel: number;
  maxLevel: number | null;
  colorClass: string;
  glowClass: string;
  icon: string;
}

export const RANK_TIERS: RankTierConfig[] = [
  { name: "BRONZE", minLevel: 1, maxLevel: 2, colorClass: "from-amber-700 to-orange-900 text-white", glowClass: "shadow-[0_0_6px_rgba(146,64,14,0.35)]", icon: "🟤" },
  { name: "SILVER", minLevel: 3, maxLevel: 4, colorClass: "from-slate-300 to-slate-500 text-white", glowClass: "shadow-[0_0_8px_rgba(148,163,184,0.4)]", icon: "⚪" },
  { name: "DIAMOND", minLevel: 5, maxLevel: 6, colorClass: "from-blue-400 to-cyan-500 text-white", glowClass: "shadow-[0_0_10px_rgba(56,189,248,0.45)]", icon: "🔷" },
  { name: "ROOKIE", minLevel: 7, maxLevel: 8, colorClass: "from-green-400 to-emerald-600 text-white", glowClass: "shadow-[0_0_11px_rgba(16,185,129,0.45)]", icon: "🟢" },
  { name: "SMART", minLevel: 9, maxLevel: 12, colorClass: "from-cyan-400 to-teal-500 text-white", glowClass: "shadow-[0_0_13px_rgba(45,212,191,0.45)]", icon: "🧠" },
  { name: "GENIUS", minLevel: 13, maxLevel: 19, colorClass: "from-violet-500 to-purple-700 text-white", glowClass: "shadow-[0_0_16px_rgba(139,92,246,0.5)]", icon: "🧬" },
  { name: "ACHIEVER", minLevel: 20, maxLevel: 24, colorClass: "from-yellow-400 to-amber-500 text-black", glowClass: "shadow-[0_0_18px_rgba(250,204,21,0.55)]", icon: "🟡" },
  { name: "MASTER", minLevel: 25, maxLevel: 29, colorClass: "from-orange-500 to-red-600 text-white", glowClass: "shadow-[0_0_21px_rgba(249,115,22,0.6)]", icon: "🔥" },
  { name: "MASTER MIND", minLevel: 30, maxLevel: null, colorClass: "from-fuchsia-500 to-purple-500 text-white", glowClass: "shadow-[0_0_28px_rgba(217,70,239,0.75)]", icon: "👑" },
];

export const getRankTierByLevel = (level: number): RankTierConfig => {
  return RANK_TIERS.find((tier) => level >= tier.minLevel && (tier.maxLevel === null || level <= tier.maxLevel)) ?? RANK_TIERS[0];
};

export const getNextRankTier = (level: number): RankTierConfig | null => {
  const current = getRankTierByLevel(level);
  const currentIndex = RANK_TIERS.findIndex((tier) => tier.name === current.name);
  return currentIndex >= 0 && currentIndex < RANK_TIERS.length - 1 ? RANK_TIERS[currentIndex + 1] : null;
};

export const getXpProgressInLevel = (xp: number, perLevel = 220) => {
  const progressInLevel = xp % perLevel;
  return {
    current: progressInLevel,
    max: perLevel,
    percentage: (progressInLevel / perLevel) * 100,
  };
};

export const playRankUpTone = () => {
  const audioContext = new window.AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(783.99, audioContext.currentTime + 0.25);

  gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.4);
};
