import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Store, Coins, Gem, Trophy, Gift, RefreshCcw, Sparkles } from 'lucide-react';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import AvatarStore from '@/components/store/AvatarStore';
import { toast } from 'sonner';

const xpTiers = [
  { xp: 100, coins: 10 },
  { xp: 500, coins: 60 },
  { xp: 1000, coins: 150 },
];

const StorePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { coins, gems, dailyStreak, convertXpToCoins, claimDailyReward, addCoins, refreshCurrency } = useCurrency();
  const [convertingXp, setConvertingXp] = React.useState<number | null>(null);
  const [claimingDaily, setClaimingDaily] = React.useState(false);
  const [spinning, setSpinning] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user) return null;

  const handleConvert = async (xpAmount: number) => {
    setConvertingXp(xpAmount);
    const success = await convertXpToCoins(xpAmount);
    if (success) {
      const reward = xpTiers.find((tier) => tier.xp === xpAmount)?.coins ?? 0;
      toast.success(`Converted ${xpAmount} XP → ${reward} Coins`);
    } else {
      toast.error('XP conversion failed. Ensure you have enough XP.');
    }
    setConvertingXp(null);
  };

  const handleClaimDaily = async () => {
    setClaimingDaily(true);
    const success = await claimDailyReward();
    if (success) {
      toast.success('Daily reward claimed!');
      await refreshCurrency();
    } else {
      toast.error('Daily reward already claimed or unavailable right now.');
    }
    setClaimingDaily(false);
  };

  const handleLuckySpin = async () => {
    if (spinning) return;
    setSpinning(true);
    const rewards = [15, 25, 40, 70, 120];
    const reward = rewards[Math.floor(Math.random() * rewards.length)];

    const success = await addCoins(reward, 'lucky_spin');
    if (success) {
      toast.success(`🎰 Lucky Spin! You won ${reward} coins.`);
    } else {
      toast.error('Lucky spin failed. Try again.');
    }

    setSpinning(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AnimatedBackground variant="minimal" showIcons={false} />

      <div className="relative z-10">
        <header className="glass border-b border-border/50 sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <BackButton to="/" />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-display font-bold text-foreground">Master Minds Economy</h1>
                  <p className="text-xs text-muted-foreground">Earn, convert, spend, transfer, and build your prestige.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-lg border bg-card/70 px-3 py-1 text-sm flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-500" /> {coins.toLocaleString()}
                </div>
                <div className="rounded-lg border bg-card/70 px-3 py-1 text-sm flex items-center gap-2">
                  <Gem className="h-4 w-4 text-purple-500" /> {gems.toLocaleString()}
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                  <Home className="h-4 w-4 mr-2" />
                  Menu
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">XP → Coins</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {xpTiers.map((tier) => (
                  <Button
                    key={tier.xp}
                    size="sm"
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => handleConvert(tier.xp)}
                    disabled={convertingXp !== null}
                  >
                    <span>{tier.xp} XP</span>
                    <span>→ {tier.coins} Coins</span>
                  </Button>
                ))}
                <p className="text-[11px] text-muted-foreground">Use “Convert XP to Coins” to trade progress for spending power.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily & Weekly Bonus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">🔥 Current streak: <strong>{dailyStreak}</strong> day(s)</p>
                <Button size="sm" className="w-full" onClick={handleClaimDaily} disabled={claimingDaily}>
                  <Gift className="h-4 w-4 mr-2" />
                  {claimingDaily ? 'Claiming...' : 'Claim Daily Reward'}
                </Button>
                <p className="text-[11px] text-muted-foreground">Weekly leaderboard winners receive bonus coin drops every cycle.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Missions & Earnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>✅ Quiz completion rewards</p>
                <p>✅ Multiplayer win bonuses</p>
                <p>✅ Study mode streak payouts</p>
                <p>✅ Social likes/content rewards</p>
                <p className="text-[11px] text-muted-foreground">Anti-abuse rules enforce fair earning and transfer safety.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lucky Spin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button size="sm" className="w-full" onClick={handleLuckySpin} disabled={spinning}>
                  {spinning ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {spinning ? 'Spinning...' : 'Spin for Coins'}
                </Button>
                <div className="text-[11px] text-muted-foreground">Daily-style spin rewards help keep students engaged.</div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4 text-sm grid gap-2 md:grid-cols-3">
              <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Transfer rules: friends only, min 10, max 500/day.</div>
              <div className="flex items-center gap-2"><Coins className="h-4 w-4 text-yellow-500" /> Coins: spendable for cosmetics and status upgrades.</div>
              <div className="flex items-center gap-2"><Gem className="h-4 w-4 text-purple-500" /> Gems: premium currency for elite cosmetics.</div>
            </CardContent>
          </Card>

          <AvatarStore />
        </main>
      </div>
    </div>
  );
};

export default StorePage;
