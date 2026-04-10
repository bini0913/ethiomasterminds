export type RankTier = "Bronze" | "Silver" | "Gold" | "Diamond" | "Master" | "Legend";

export interface UserStats {
  accuracy: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  contributions: number;
}

export interface LearningInsight {
  strongSubjects: string[];
  weakSubjects: string[];
  recommendedTopics: string[];
}

export interface Achievement {
  id: string;
  badgeName: string;
  title: string;
  icon: string;
  dateEarned: string;
}

export interface ActivityItem {
  id: string;
  type: "match" | "achievement" | "content";
  description: string;
  timestamp: string;
}

export interface CompetitiveUser {
  id: string;
  username: string;
  avatarUrl: string;
  grade: number;
  xp: number;
  level: number;
  streak: number;
  rankTier: RankTier;
  weeklyXp: number;
  isPublic: boolean;
  hideStats: boolean;
  stats: UserStats;
  insights: LearningInsight;
  achievements: Achievement[];
  activities: ActivityItem[];
}

const names = [
  "Alex Nova",
  "Maya Quill",
  "Noah Blaze",
  "Sena Orbit",
  "Liam Zenith",
  "Ava Pulse",
  "Eden Cipher",
  "Mika Atlas",
  "Ruth Pixel",
  "Eli Quest",
  "Nia Bloom",
  "Ivy Spark",
  "Leo Drift",
  "Zoe Echo",
  "Kai Rune",
  "Milo Stride",
  "Aria Flux",
  "Tobi Crest",
];

const topics = ["Algebra", "Geometry", "Biology", "Chemistry", "Reading", "History", "Physics", "Coding"];

const rankFromScore = (xp: number, accuracy: number, performance: number, contributions: number): RankTier => {
  const weighted = xp + accuracy * 20 + performance * 50 + contributions * 3;
  if (weighted >= 9800) return "Legend";
  if (weighted >= 7800) return "Master";
  if (weighted >= 6200) return "Diamond";
  if (weighted >= 4400) return "Gold";
  if (weighted >= 2600) return "Silver";
  return "Bronze";
};

export const createSeedUsers = (): CompetitiveUser[] => {
  return names.map((username, index) => {
    const xp = 1200 + (names.length - index) * 320;
    const level = Math.floor(xp / 220);
    const wins = 22 + (names.length - index) * 3;
    const losses = 5 + index;
    const accuracy = Math.max(72, 98 - index);
    const contributions = 50 + (names.length - index) * 8;
    const perf = wins / Math.max(1, wins + losses);

    return {
      id: `player-${index + 1}`,
      username,
      avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(username)}`,
      grade: (index % 12) + 1,
      xp,
      level,
      streak: 5 + (index % 14),
      rankTier: rankFromScore(xp, accuracy, perf, contributions),
      weeklyXp: 60 + (names.length - index) * 28,
      isPublic: true,
      hideStats: false,
      stats: {
        accuracy,
        matchesPlayed: wins + losses,
        wins,
        losses,
        contributions,
      },
      insights: {
        strongSubjects: [topics[index % topics.length], topics[(index + 2) % topics.length]],
        weakSubjects: [topics[(index + 3) % topics.length]],
        recommendedTopics: [topics[(index + 4) % topics.length], topics[(index + 5) % topics.length]],
      },
      achievements: [
        {
          id: `ach-${index}-1`,
          badgeName: "Precision Pro",
          title: "Quiz Master",
          icon: "🎯",
          dateEarned: "2026-04-02",
        },
        {
          id: `ach-${index}-2`,
          badgeName: "Streak Hero",
          title: "Top Performer",
          icon: "🔥",
          dateEarned: "2026-04-06",
        },
      ],
      activities: [
        { id: `act-${index}-1`, type: "match", description: "Won ranked math duel", timestamp: "2h ago" },
        { id: `act-${index}-2`, type: "achievement", description: "Unlocked Precision Pro", timestamp: "1d ago" },
        { id: `act-${index}-3`, type: "content", description: "Uploaded Algebra note set", timestamp: "3d ago" },
      ],
    };
  });
};

export const getTierStyle = (tier: RankTier) => {
  switch (tier) {
    case "Legend":
      return "from-fuchsia-500 to-amber-300 text-white shadow-[0_0_25px_rgba(217,70,239,0.55)]";
    case "Master":
      return "from-violet-500 to-indigo-500 text-white shadow-[0_0_18px_rgba(99,102,241,0.45)]";
    case "Diamond":
      return "from-cyan-500 to-sky-500 text-white shadow-[0_0_18px_rgba(14,165,233,0.45)]";
    case "Gold":
      return "from-yellow-500 to-amber-500 text-white shadow-[0_0_18px_rgba(245,158,11,0.45)]";
    case "Silver":
      return "from-slate-300 to-slate-500 text-white shadow-[0_0_15px_rgba(148,163,184,0.4)]";
    default:
      return "from-amber-700 to-orange-900 text-white shadow-[0_0_15px_rgba(146,64,14,0.35)]";
  }
};

export const rankScore = (user: CompetitiveUser) => {
  const perf = user.stats.wins / Math.max(1, user.stats.matchesPlayed);
  return user.xp + user.stats.accuracy * 15 + perf * 300 + user.stats.contributions * 2;
};
