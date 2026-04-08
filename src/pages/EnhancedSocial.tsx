import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Compass, LifeBuoy, MessageSquare, Sparkles, WandSparkles } from 'lucide-react';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import EnhancedSocialFeed from '@/components/social/EnhancedSocialFeed';
import EnhancedChatSystem from '@/components/chat/EnhancedChatSystem';
import SocialSupportHub from '@/components/social/SocialSupportHub';
import { useUser } from '@/context/UserContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const EnhancedSocial: React.FC = () => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('feed');

  const quickActions = [
    {
      id: 'feed',
      title: 'Share an update',
      subtitle: 'Post wins, ideas, and class highlights',
      icon: Compass,
    },
    {
      id: 'groups',
      title: 'Jump into chat',
      subtitle: 'Collaborate with peers in real time',
      icon: MessageSquare,
    },
    {
      id: 'support',
      title: 'Get support fast',
      subtitle: 'Report issues and vote on feature ideas',
      icon: LifeBuoy,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <BackButton />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Compass className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Social Hub</h1>
            <p className="text-sm text-muted-foreground">Connect with your community</p>
          </div>
        </div>
      </header>

      <div className="container max-w-6xl mx-auto py-6 px-4 relative z-10">
        <Card className="mb-6 border-border/60 bg-card/70 backdrop-blur-sm">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Welcome back{user?.name ? `, ${user.name}` : ''}</p>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Your social space, upgraded
                </h2>
                <p className="text-sm text-muted-foreground">Use quick actions below to jump directly into the experience you need.</p>
              </div>
              <Button variant="outline" className="gap-2" onClick={() => setActiveTab('support')}>
                <WandSparkles className="h-4 w-4" />
                Open feature voting
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => setActiveTab(action.id)}
                    className={`text-left rounded-xl border px-4 py-3 transition-all ${activeTab === action.id ? 'border-primary bg-primary/10' : 'border-border/60 bg-background/40 hover:bg-muted/40'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4" />
                      <span className="font-medium text-sm">{action.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{action.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-xl mx-auto grid-cols-3">
            <TabsTrigger value="feed" className="gap-2">
              <Compass className="h-4 w-4" />
              Feed
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Users className="h-4 w-4" />
              Groups
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <LifeBuoy className="h-4 w-4" />
              Support
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed">
            <EnhancedSocialFeed />
          </TabsContent>

          <TabsContent value="groups">
            <div className="flex justify-center">
              <EnhancedChatSystem 
                currentUserId={user?.id || 'guest'} 
                currentUserName={user?.name || 'Guest'}
              />
            </div>
          </TabsContent>

          <TabsContent value="support">
            <SocialSupportHub />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EnhancedSocial;
