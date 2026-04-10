import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Flame, Trophy, Users, Globe, CalendarClock } from "lucide-react";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchFollowing, fetchLeaderboardUsers, rankScore, tierFromUser, tierStyle, type LeaderboardUser } from "@/lib/leaderboardApi";

type LeaderboardTab = "global" | "grade" | "friends" | "weekly";

const rowStyles = {
  1: "border-yellow-500/50 bg-yellow-500/10",
  2: "border-slate-400/50 bg-slate-400/10",
  3: "border-amber-700/50 bg-amber-700/10",
};

const Leaderboard = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("global");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = async () => {
    setLoading(true);
    const rows = await fetchLeaderboardUsers();
    setUsers(rows);
    setLoading(false);
  };

  const loadFollowing = async () => {
    if (!user?.id) return;
    const ids = await fetchFollowing(user.id);
    setFollowing(ids);
  };

  useEffect(() => {
    loadLeaderboard();
    loadFollowing();

    const channel = supabase
      .channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadLeaderboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "question_attempts" }, loadLeaderboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_streaks" }, loadLeaderboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "followers" }, loadFollowing)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const rankedUsers = useMemo(() => [...users].sort((a, b) => rankScore(b) - rankScore(a)), [users]);

  const leaderboardData = useMemo(() => {
    if (activeTab === "friends") {
      return rankedUsers.filter((row) => following.includes(row.id) || row.id === user?.id);
    }

    if (activeTab === "grade") {
      return selectedGrade === "all" ? rankedUsers : rankedUsers.filter((row) => row.grade === Number(selectedGrade));
    }

    if (activeTab === "weekly") {
      return [...users].sort((a, b) => b.weeklyScore - a.weeklyScore);
    }

    return rankedUsers;
  }, [activeTab, following, rankedUsers, selectedGrade, user?.id, users]);

  const withRank = leaderboardData.map((entry, index) => ({
    ...entry,
    rankPos: index + 1,
    score: activeTab === "weekly" ? entry.weeklyScore : rankScore(entry),
    tier: tierFromUser(entry),
  }));

  const topThree = withRank.slice(0, 3);
  const rest = withRank.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/5 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Live database rankings only • no demo accounts</p>
            <h1 className="text-3xl font-bold tracking-tight">Master Minds Leaderboard</h1>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>Back to home</Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" /> Dynamic Ranking Arena
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeaderboardTab)}>
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="global" className="gap-2"><Globe className="h-4 w-4" />Global</TabsTrigger>
                <TabsTrigger value="grade" className="gap-2"><Users className="h-4 w-4" />Grade</TabsTrigger>
                <TabsTrigger value="friends" className="gap-2"><Users className="h-4 w-4" />Friends</TabsTrigger>
                <TabsTrigger value="weekly" className="gap-2"><CalendarClock className="h-4 w-4" />Weekly</TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "grade" && (
              <div className="w-40">
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All grades</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
                      <SelectItem key={grade} value={`${grade}`}>Grade {grade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {loading ? <p className="text-sm text-muted-foreground">Loading leaderboard…</p> : null}

            <div className="grid gap-4 md:grid-cols-3">
              {topThree.map((entry, index) => (
                <motion.button
                  layout
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/profile/${entry.id}`)}
                  key={entry.id}
                  className={`rounded-xl border p-4 text-left transition ${rowStyles[(index + 1) as 1 | 2 | 3]}`}
                >
                  <p className="text-xs">{index === 0 ? "🥇 Gold" : index === 1 ? "🥈 Silver" : "🥉 Bronze"}</p>
                  <AvatarRenderer avatar={entry.avatar ?? undefined} avatarConfig={entry.avatarConfig as any} size="lg" className="my-2" />
                  <h3 className="font-semibold">{entry.username}</h3>
                  <p className="text-sm text-muted-foreground">Level {entry.level} • Grade {entry.grade ?? "-"}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge className={`bg-gradient-to-r ${tierStyle(entry.tier)}`}>{entry.tier}</Badge>
                    <span className="font-bold">#{entry.rankPos}</span>
                  </div>
                  <p className="mt-2 text-sm">{Math.round(entry.score).toLocaleString()} pts</p>
                </motion.button>
              ))}
            </div>

            <ScrollArea className="h-[420px] rounded-lg border p-2">
              <AnimatePresence>
                {rest.map((entry) => (
                  <motion.button
                    layout
                    key={`${activeTab}-${entry.id}`}
                    onClick={() => navigate(`/profile/${entry.id}`)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left"
                  >
                    <span className="w-6 text-center font-semibold text-muted-foreground">#{entry.rankPos}</span>
                    <AvatarRenderer avatar={entry.avatar ?? undefined} avatarConfig={entry.avatarConfig as any} size="md" />
                    <div className="flex-1">
                      <p className="font-medium">{entry.username}</p>
                      <p className="text-xs text-muted-foreground">Level {entry.level} • XP {entry.xp.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{Math.round(entry.score).toLocaleString()} pts</p>
                      <p className="inline-flex items-center gap-1 text-xs text-orange-500"><Flame className="h-3 w-3" />{entry.streak}</p>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Leaderboard;
