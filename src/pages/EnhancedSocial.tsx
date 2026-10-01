import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Compass, Users, Flame, BookOpen, Target, Plus, UserPlus } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import SocialFeedView from '@/components/social/SocialFeedView';
import SocialChallenges from '@/components/social/SocialChallenges';
import EnhancedChatSystem from '@/components/chat/EnhancedChatSystem';
import CreatePostModal from '@/components/social/CreatePostModal';
import { useUser } from '@/context/UserContext';
import { Button } from '@/components/ui/button';

const feedTabs = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'following', label: 'Following', icon: Users },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'challenges', label: 'Challenges', icon: Target },
] as const;

type FeedTab = (typeof feedTabs)[number]['id'];

const EnhancedSocial: React.FC = () => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<FeedTab>('explore');
  const [showCreatePost, setShowCreatePost] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-lg font-bold text-foreground tracking-tight">Community</h1>
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
      <main className="max-w-2xl mx-auto pb-24">
        {activeTab === 'explore' && <SocialFeedView mode="explore" />}
        {activeTab === 'following' && <SocialFeedView mode="following" />}
        {activeTab === 'trending' && <SocialFeedView mode="trending" />}
        {activeTab === 'study' && <SocialFeedView mode="study" />}
        {activeTab === 'challenges' && <SocialChallenges />}
      </main>

      {/* Floating Create Post Button */}
      <Button
        onClick={() => setShowCreatePost(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/30 p-0"
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
