import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useFriends } from '@/context/FriendsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Store, Coins, Gem, Gift, RefreshCcw, Sparkles, ArrowLeftRight, Wallet, Send, ShieldCheck } from 'lucide-react';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import AvatarStore from '@/components/store/AvatarStore';
import InventoryPanel from '@/components/store/InventoryPanel';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

const xpTiers = [
  { xp: 100, coins: 10 },
  { xp: 500, coins: 60 },
  { xp: 1000, coins: 150 },
];

type TransactionRow = {
  id: string;
  amount: number;
  type: string;
  source: string | null;
  created_at: string;
  sender_id: string | null;
  receiver_id: string | null;
};

const StorePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { friends } = useFriends();
  const {
    xp,
    coins,
    gems,
    dailyStreak,
    convertXpToCoins,
    convertCoinsToGems,
    convertCoinsToXp,
    claimDailyReward,
    transferCoins,
    luckySpin,
    refreshCurrency,
  } = useCurrency();

  const [activeTab, setActiveTab] = React.useState('store');
  const [convertingXp, setConvertingXp] = React.useState<number | null>(null);
  const [coinToGemInput, setCoinToGemInput] = React.useState('100');
  const [xpExchangeInput, setXpExchangeInput] = React.useState('100');
  const [coinsToXpInput, setCoinsToXpInput] = React.useState('10');
  const [claimingDaily, setClaimingDaily] = React.useState(false);
  const [spinning, setSpinning] = React.useState(false);
  const [transactions, setTransactions] = React.useState<TransactionRow[]>([]);
  const [transferFriendId, setTransferFriendId] = React.useState('');
  const [transferSearch, setTransferSearch] = React.useState('');
  const [transferAmount, setTransferAmount] = React.useState('10');
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  const loadTransactions = React.useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await (supabase as any)
      .from('transactions')
      .select('id, amount, type, source, created_at, sender_id, receiver_id')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      console.error('Failed to load transactions', error);
      return;
    }

    setTransactions((data || []) as TransactionRow[]);
  }, [user?.id]);

  React.useEffect(() => {
    void loadTransactions();
  }, [loadTransactions, activeTab]);

  if (!user) return null;

  const filteredFriends = friends.filter((friend) => {
    if (!transferSearch.trim()) return true;
    return friend.name.toLowerCase().includes(transferSearch.toLowerCase()) || friend.username.toLowerCase().includes(transferSearch.toLowerCase());
  });

  const selectedFriend = friends.find((friend) => friend.id === transferFriendId);
  const coinToGemValue = Number(coinToGemInput) || 0;
  const estimatedGems = Math.floor(coinToGemValue / 100);

  const handleConvertXp = async (xpAmount: number) => {
    if (!Number.isFinite(xpAmount) || xpAmount < 100) {
      toast.error('Minimum XP exchange is 100.');
      return;
    }

    setConvertingXp(xpAmount);
    const success = await convertXpToCoins(xpAmount);
    if (success) {
      const reward = xpTiers.find((tier) => tier.xp === xpAmount)?.coins ?? Math.floor(xpAmount / 10);
      toast.success(`Converted ${xpAmount} XP → ${reward} Coins`);
      await loadTransactions();
    } else {
      toast.error('XP conversion failed. Ensure you have enough XP.');
    }
    setConvertingXp(null);
  };

  const handleCoinToGem = async () => {
    if (coinToGemValue < 100) {
      toast.error('Minimum coin-to-gem conversion is 100 coins.');
      return;
    }
    const success = await convertCoinsToGems(coinToGemValue);
    if (!success) {
      toast.error('Conversion failed.');
      return;
    }
    toast.success(`Converted ${coinToGemValue} Coins → ${estimatedGems} Gems`);
    await loadTransactions();
  };

  const handleClaimDaily = async () => {
    setClaimingDaily(true);
    const success = await claimDailyReward();
    if (success) {
      toast.success('Daily reward claimed!');
      await Promise.all([refreshCurrency(), loadTransactions()]);
    } else {
      toast.error('Daily reward already claimed or unavailable right now.');
    }
    setClaimingDaily(false);
  };

  const handleLuckySpin = async () => {
    if (spinning) return;
    setSpinning(true);
    const result = await luckySpin();

    if (result.success) {
      toast.success('🎰 Lucky spin complete. Reward added to your wallet.');
      await loadTransactions();
    } else {
      toast.error(result.message ?? 'Spin unavailable right now.');
    }

    setSpinning(false);
  };

  const handleTransfer = async () => {
    const amount = Number(transferAmount);

    if (!transferFriendId) {
      toast.error('Please select a friend.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 10) {
      toast.error('Minimum transfer is 10 coins.');
      return;
    }

    const success = await transferCoins(transferFriendId, amount);
    if (!success) {
      toast.error('Transfer failed. Check balance and limits.');
      return;
    }

    toast.success('Transfer Successful ✅');
    setConfirmOpen(false);
    setTransferAmount('10');
    await Promise.all([refreshCurrency(), loadTransactions()]);
  };

  const transferPreview = Number(transferAmount) || 0;

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
                  <h1 className="text-lg font-display font-bold text-foreground">Master Minds Economy Hub</h1>
                  <p className="text-xs text-muted-foreground">Store, exchange, wallet tracking, and friend transfer in one place.</p>
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
              <TabsTrigger value="store">🛍️ Store</TabsTrigger>
              <TabsTrigger value="exchange">💱 Exchange</TabsTrigger>
              <TabsTrigger value="wallet">💳 Wallet</TabsTrigger>
              <TabsTrigger value="transfer">🤝 Transfer</TabsTrigger>
              <TabsTrigger value="inventory">🎒 Inventory</TabsTrigger>
            </TabsList>

            <TabsContent value="store" className="space-y-4">
              <AvatarStore onQuickNavigate={(tab) => setActiveTab(tab)} />
            </TabsContent>

            <TabsContent value="exchange" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">XP → Coins</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">Current XP: <strong>{xp.toLocaleString()}</strong></p>
                    <p className="text-xs text-muted-foreground">Rate: 100 XP = 10 Coins • Daily XP exchange cap enabled server-side.</p>
                    <Input
                      type="number"
                      min={100}
                      step={100}
                      value={xpExchangeInput}
                      onChange={(e) => setXpExchangeInput(e.target.value)}
                      placeholder="Enter XP amount"
                    />
                    <div className="text-sm">
                      You receive: <strong>{Math.floor((Number(xpExchangeInput) || 0) / 10)}</strong> coins
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => handleConvertXp(Number(xpExchangeInput) || 0)}
                      disabled={convertingXp !== null}
                    >
                      <ArrowLeftRight className="h-4 w-4 mr-2" /> Exchange
                    </Button>
                    <div className="grid gap-2">
                      {xpTiers.map((tier) => (
                        <Button
                          key={tier.xp}
                          size="sm"
                          variant="outline"
                          className="w-full justify-between"
                          onClick={() => handleConvertXp(tier.xp)}
                          disabled={convertingXp !== null}
                        >
                          <span>{tier.xp} XP</span>
                          <span>→ {tier.coins} Coins</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Coins → Gems (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">Rate: 100 coins = 1 gem</p>
                    <Input type="number" min={100} value={coinToGemInput} onChange={(e) => setCoinToGemInput(e.target.value)} />
                    <div className="text-sm">You receive: <strong>{estimatedGems}</strong> gems</div>
                    <Button className="w-full" onClick={handleCoinToGem}>
                      <ArrowLeftRight className="h-4 w-4 mr-2" /> Convert
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Coins → XP (Optional, Limited)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">Rate: 1 coin = 10 XP • Daily cap applied.</p>
                    <Input type="number" min={10} value={coinsToXpInput} onChange={(e) => setCoinsToXpInput(e.target.value)} />
                    <div className="text-sm">You receive: <strong>{(Number(coinsToXpInput) || 0) * 10}</strong> XP</div>
                    <Button
                      className="w-full"
                      onClick={async () => {
                        const amount = Number(coinsToXpInput) || 0;
                        if (amount < 10) {
                          toast.error('Minimum coins to exchange is 10.');
                          return;
                        }
                        const success = await convertCoinsToXp(amount);
                        if (!success) {
                          toast.error('Coins to XP exchange failed.');
                          return;
                        }
                        toast.success(`Converted ${amount} Coins → ${amount * 10} XP`);
                        await loadTransactions();
                      }}
                    >
                      <ArrowLeftRight className="h-4 w-4 mr-2" /> Exchange
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Daily Reward</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">🔥 Current streak: <strong>{dailyStreak}</strong> day(s)</p>
                    <Button size="sm" className="w-full" onClick={handleClaimDaily} disabled={claimingDaily}>
                      <Gift className="h-4 w-4 mr-2" />
                      {claimingDaily ? 'Claiming...' : 'Claim Daily Reward'}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Lucky Spin</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Button size="sm" className="w-full" onClick={handleLuckySpin} disabled={spinning}>
                      {spinning ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      {spinning ? 'Spinning...' : 'Spin (Daily)'}
                    </Button>
                    <p className="text-xs text-muted-foreground">Rewards include coins, gems, or random items.</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="wallet">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader><CardTitle className="text-base">XP</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold">🎯 {xp.toLocaleString()}</CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Coins</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold">💰 {coins.toLocaleString()}</CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Gems</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold">💎 {gems.toLocaleString()}</CardContent>
                </Card>
              </div>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-72 pr-3">
                    <div className="space-y-2">
                      {transactions.length === 0 && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
                      {transactions.map((tx) => (
                        <div key={tx.id} className="rounded-md border p-3 text-sm flex items-center justify-between">
                          <div>
                            <p className="font-medium capitalize">{tx.type} {tx.source ? `• ${tx.source}` : ''}</p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                          </div>
                          <p className="font-semibold">{tx.amount}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transfer" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Send Coins to Friends</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">Rules: minimum 10 coins, max 500/day, friends only, no self-transfer.</p>
                  <div className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Abuse protection + negative amount checks active
                  </div>
                  <p className="text-sm">Your balance: <strong>{coins.toLocaleString()}</strong> coins</p>

                  <Input placeholder="Search friend..." value={transferSearch} onChange={(e) => setTransferSearch(e.target.value)} />

                  <ScrollArea className="h-40 border rounded-md p-2">
                    <div className="space-y-2">
                      {filteredFriends.map((friend) => (
                        <button
                          key={friend.id}
                          onClick={() => setTransferFriendId(friend.id)}
                          className={`w-full text-left rounded-md border p-2 transition ${transferFriendId === friend.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}
                        >
                          <p className="font-medium">{friend.name}</p>
                          <p className="text-xs text-muted-foreground">@{friend.username || 'student'}</p>
                        </button>
                      ))}
                      {filteredFriends.length === 0 && <p className="text-sm text-muted-foreground">No friends found.</p>}
                    </div>
                  </ScrollArea>

                  <Input type="number" min={10} value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="Enter amount" />

                  <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={!transferFriendId}>
                    Confirm Transfer
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="inventory" className="space-y-4">
              <InventoryPanel />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Coin Transfer</DialogTitle>
            <DialogDescription>
              Send {transferPreview} coins to {selectedFriend?.name ?? 'selected friend'}?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/20 p-3 text-sm space-y-1">
            <p>Current balance: <strong>{coins}</strong></p>
            <p>After transfer: <strong>{Math.max(0, coins - transferPreview)}</strong></p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer}>Send Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorePage;
