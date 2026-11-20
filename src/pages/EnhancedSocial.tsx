import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Compass, Users, Flame, BookOpen, Target, Plus, UsersRound, MessageCircle, Bookmark, Sparkles, ArrowUpRight } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import SocialFeedView from '@/components/social/SocialFeedView';
import SocialChallenges from '@/components/social/SocialChallenges';
import EnhancedChatSystem from '@/components/chat/EnhancedChatSystem';
import CreatePostModal from '@/components/social/CreatePostModal';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getUserTier } from '@/lib/getUserTier';

const feedTabs = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'following', label: 'Following', icon: Users },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'challenges', label: 'Challenges', icon: Target },
] as const;

type FeedTab = (typeof feedTabs)[number]['id'];

const EnhancedSocial: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";
  const [activeTab, setActiveTab] = useState<FeedTab>('explore');
  const [showCreatePost, setShowCreatePost] = useState(false);

  return (
    <div className={upperStudent ? "tier-upper min-h-screen bg-background text-foreground" : "min-h-screen bg-background"}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton to="/social" />
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound className="h-5 w-5" /></div>
            <div><h1 className="text-lg font-bold text-foreground tracking-tight">Community</h1><p className="text-[11px] text-muted-foreground">Learn, share and challenge each other</p></div>
          </div>
        </div>
      </header>

      {/* Tab Navigation — horizontal scroll */}
      <div className="sticky top-[57px] z-40 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-2xl mx-auto">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FeedTab)}>
            <TabsList className="w-full justify-start gap-0 bg-transparent h-auto p-0 rounded-none overflow-x-auto scrollbar-hide">
              {feedTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={`flex-shrink-0 rounded-none border-b-2 px-4 py-3 text-sm font-medium transition-colors data-[state=active]:shadow-none ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-1.5" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto grid max-w-6xl gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0"><section className="mx-4 mt-4 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-cyan-500/10 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Community</p><h2 className="mt-1 text-lg font-bold sm:text-xl">What are students learning today?</h2><p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">Explore ideas, study posts, challenges and conversations from the Master Minds community.</p></div><Button variant="outline" size="sm" onClick={() => navigate("/friends")} className="shrink-0"><Users className="mr-1.5 h-4 w-4" /> Friends</Button></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => setShowCreatePost(true)}><Plus className="mr-1.5 h-4 w-4" /> Share an update</Button><Button size="sm" variant="ghost" onClick={() => navigate("/chat")}><MessageCircle className="mr-1.5 h-4 w-4" /> Open messages</Button></div></section>
          {activeTab === 'explore' && <SocialFeedView mode="explore" />}
          {activeTab === 'following' && <SocialFeedView mode="following" />}
          {activeTab === 'trending' && <SocialFeedView mode="trending" />}
          {activeTab === 'study' && <SocialFeedView mode="study" />}
          {activeTab === 'challenges' && <SocialChallenges />}
        </div>
        <aside className="hidden space-y-4 lg:block lg:pt-4"><Card className="border-primary/20 bg-primary/[0.05]"><CardContent className="p-5"><div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-[0.16em]">Community guide</p></div><h3 className="mt-3 font-bold">Make learning social</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Ask a clear question, celebrate progress, and share useful resources your classmates can try.</p><Button className="mt-4 w-full" onClick={() => setShowCreatePost(true)}>Share progress <ArrowUpRight className="ml-2 h-4 w-4" /></Button></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Explore more</h3><Badge variant="outline">Live</Badge></div><div className="mt-3 space-y-2"><button type="button" onClick={() => setActiveTab('study')} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition hover:border-primary/40"><BookOpen className="h-4 w-4 text-primary" /><span className="flex-1">Study posts</span><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /></button><button type="button" onClick={() => setActiveTab('trending')} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition hover:border-primary/40"><Flame className="h-4 w-4 text-orange-500" /><span className="flex-1">Trending now</span><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /></button><button type="button" onClick={() => setActiveTab('following')} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition hover:border-primary/40"><Bookmark className="h-4 w-4 text-primary" /><span className="flex-1">People you follow</span><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /></button></div></CardContent></Card></aside>
      </main>

      {/* Floating Create Post Button */}
      <Button
        onClick={() => setShowCreatePost(true)}
        className="fixed bottom-20 right-6 z-50 h-14 w-14 rounded-full p-0 shadow-lg shadow-primary/30 md:bottom-6"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {showCreatePost && (
        <CreatePostModal onClose={() => setShowCreatePost(false)} />
      )}
    </div>
  );
};

export default EnhancedSocial;
