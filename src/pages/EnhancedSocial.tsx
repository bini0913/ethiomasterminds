import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Compass, LifeBuoy } from 'lucide-react';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import EnhancedSocialFeed from '@/components/social/EnhancedSocialFeed';
import EnhancedChatSystem from '@/components/chat/EnhancedChatSystem';
import SocialSupportHub from '@/components/social/SocialSupportHub';
import { useUser } from '@/context/UserContext';

const EnhancedSocial: React.FC = () => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('feed');

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
