import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useCompetitiveSystem } from "@/hooks/useCompetitiveSystem";
import { getTierStyle, rankScore } from "@/lib/competitionData";
import { Flame, Sword, Trophy, UserRoundPlus } from "lucide-react";

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { rankedUsers, selfId, following, followUser, unfollowUser, myProfile, updatePrivacy } = useCompetitiveSystem();

  const profile = useMemo(() => rankedUsers.find((u) => u.id === userId), [rankedUsers, userId]);
  const profileRank = useMemo(() => rankedUsers.findIndex((u) => u.id === userId) + 1, [rankedUsers, userId]);
  const followersCount = useMemo(() => rankedUsers.filter((u) => u.id !== profile?.id).length + (following.includes(profile?.id ?? "") ? 1 : 0), [following, profile?.id, rankedUsers]);
  const isSelf = profile?.id === selfId;
  const isFollowing = following.includes(profile?.id ?? "");

  if (!profile) {
    return <div className="p-8">Profile not found.</div>;
  }

  const xpIntoLevel = profile.xp % 220;
  const progress = (xpIntoLevel / 220) * 100;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
          <Button onClick={() => navigate("/multiplayer")} className="gap-2"><Sword className="h-4 w-4" />Challenge to Match</Button>
        </header>

        <Card>
          <CardContent className="grid gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
            <img src={profile.avatarUrl} alt={profile.username} className="h-28 w-28 rounded-full border-4 border-primary/30" />
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">{profile.username}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`bg-gradient-to-r ${getTierStyle(profile.rankTier)}`}>{profile.rankTier}</Badge>
                <Badge variant="secondary">Rank #{profileRank}</Badge>
                <Badge variant="outline">Level {profile.level}</Badge>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>XP Progress</span>
                  <span>{xpIntoLevel}/220</span>
                </div>
                <motion.div initial={{ width: 0 }} animate={{ width: "100%" }}>
                  <Progress value={progress} />
                </motion.div>
              </div>
            </div>
            {!isSelf && (
              <Button
                variant={isFollowing ? "secondary" : "default"}
                className="gap-2"
                onClick={() => (isFollowing ? unfollowUser(profile.id) : followUser(profile.id))}
              >
                <UserRoundPlus className="h-4 w-4" />
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Stats</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">Total XP</p><p className="text-xl font-bold">{profile.xp.toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Streak</p><p className="text-xl font-bold inline-flex items-center gap-1"><Flame className="h-4 w-4 text-orange-500" />{profile.streak}</p></div>
              <div><p className="text-xs text-muted-foreground">Accuracy</p><p className="text-xl font-bold">{profile.stats.accuracy}%</p></div>
              <div><p className="text-xs text-muted-foreground">Matches</p><p className="text-xl font-bold">{profile.stats.matchesPlayed}</p></div>
              <div><p className="text-xs text-muted-foreground">Wins / Losses</p><p className="text-xl font-bold">{profile.stats.wins}/{profile.stats.losses}</p></div>
              <div><p className="text-xs text-muted-foreground">Contributions</p><p className="text-xl font-bold">{profile.stats.contributions}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Social</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>Followers: <strong>{followersCount}</strong></p>
              <p>Following: <strong>{following.length}</strong></p>
              <p>Power score: <strong>{Math.round(rankScore(profile))}</strong></p>
              <Separator />
              <p className="text-xs text-muted-foreground">Notifications</p>
              <p className="text-sm">🔔 Rank increases, new followers, and badges are shown in-app instantly.</p>
              {isSelf && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Public profile</span>
                      <Switch checked={myProfile?.isPublic ?? true} onCheckedChange={(v) => updatePrivacy(v, myProfile?.hideStats ?? false)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Hide stats</span>
                      <Switch checked={myProfile?.hideStats ?? false} onCheckedChange={(v) => updatePrivacy(myProfile?.isPublic ?? true, v)} />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Learning Insights</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Strong:</strong> {profile.insights.strongSubjects.join(", ")}</p>
              <p><strong>Weak:</strong> {profile.insights.weakSubjects.join(", ")}</p>
              <p><strong>Recommended:</strong> {profile.insights.recommendedTopics.join(", ")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Achievements</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {profile.achievements.map((achievement) => (
                <motion.div whileHover={{ x: 4 }} key={achievement.id} className="rounded-md border p-2">
                  <p className="font-medium">{achievement.icon} {achievement.badgeName}</p>
                  <p className="text-xs text-muted-foreground">{achievement.title} • {achievement.dateEarned}</p>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {profile.activities.map((item) => (
                <div key={item.id} className="rounded-md border p-2">
                  <p>{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                </div>
              ))}
              <Button variant="outline" className="w-full gap-2" onClick={() => navigate('/multiplayer')}>
                <Trophy className="h-4 w-4" /> Challenge Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default UserProfilePage;
