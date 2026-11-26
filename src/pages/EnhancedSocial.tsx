import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Compass, Flame, MessageCircle, Plus, Target, Users, UsersRound } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SocialFeedView from "@/components/social/SocialFeedView";
import SocialChallenges from "@/components/social/SocialChallenges";
import CreatePostModal from "@/components/social/CreatePostModal";
import CommunityFrame from "@/components/community/CommunityFrame";

const feedTabs = [
  { id: "explore", label: "Explore", icon: Compass, helper: "Fresh ideas from the network" },
  { id: "following", label: "Following", icon: Users, helper: "People you choose to learn with" },
  { id: "trending", label: "Trending", icon: Flame, helper: "Conversations gaining momentum" },
  { id: "study", label: "Study", icon: BookOpen, helper: "Questions, notes, and practice" },
  { id: "challenges", label: "Challenges", icon: Target, helper: "Small wins you can complete today" },
] as const;

type FeedTab = (typeof feedTabs)[number]["id"];

const EnhancedSocial: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FeedTab>("explore");
  const [showCreatePost, setShowCreatePost] = useState(false);
  const active = feedTabs.find((tab) => tab.id === activeTab) || feedTabs[0];
  const ActiveIcon = active.icon;

  return (
    <CommunityFrame title="Community" eyebrow="Learn together" description="Explore useful ideas, study conversations, and challenges from the Master Minds network.">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <section className="glass rounded-[1.75rem] p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-primary"><UsersRound className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-[0.18em]">The learning room</p></div><h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">What are students learning today?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Share something useful, ask for help, or find a conversation that gives your next study session a little more momentum.</p></div><div className="flex shrink-0 gap-2"><Button onClick={() => setShowCreatePost(true)}><Plus className="mr-1.5 h-4 w-4" /> Share update</Button><Button variant="outline" onClick={() => navigate("/friends")}><Users className="mr-1.5 h-4 w-4" /> Friends</Button></div></div>
          </section>

          <section className="sticky top-[116px] z-30 rounded-2xl border border-border/70 bg-background/85 p-1.5 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/70" aria-label="Community feed filters">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FeedTab)}><TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0 scrollbar-hide">{feedTabs.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id} className="min-h-10 shrink-0 gap-2 rounded-xl px-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><Icon className="h-4 w-4" />{label}</TabsTrigger>)}</TabsList></Tabs>
          </section>

          <div className="flex items-center gap-3 px-1"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><ActiveIcon className="h-4 w-4" /></div><div><h3 className="font-semibold">{active.label}</h3><p className="text-xs text-muted-foreground">{active.helper}</p></div><Badge variant="outline" className="ml-auto hidden rounded-full sm:inline-flex">Live view</Badge></div>
          {activeTab === "challenges" ? <SocialChallenges /> : <SocialFeedView mode={activeTab} />}
        </div>

        <aside className="hidden space-y-4 xl:block"><Card className="glass border-primary/20"><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">A better feed</p><h3 className="mt-2 font-display text-xl font-bold">Make learning social.</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Ask a clear question, celebrate progress, and share resources your classmates can actually use.</p><Button className="mt-5 w-full" onClick={() => setShowCreatePost(true)}>Share progress <Plus className="ml-2 h-4 w-4" /></Button></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Try another view</h3><Badge variant="outline" className="rounded-full">5 lanes</Badge></div><div className="mt-3 space-y-2">{feedTabs.filter((tab) => tab.id !== activeTab).slice(0, 3).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveTab(id)} className="flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm transition hover:border-primary/40 hover:bg-muted/40"><Icon className="h-4 w-4 text-primary" /><span className="flex-1">{label}</span><span className="text-muted-foreground">→</span></button>)}</div></CardContent></Card><Card className="border-amber-500/20 bg-amber-500/5"><CardContent className="p-5"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-amber-600" /><h3 className="font-semibold">Need a study partner?</h3></div><p className="mt-2 text-sm leading-6 text-muted-foreground">Find a friend, start a chat, or invite someone to a multiplayer round.</p><Button variant="outline" className="mt-4 w-full" onClick={() => navigate("/chat")}><MessageCircle className="mr-2 h-4 w-4" /> Open messages</Button></CardContent></Card></aside>
      </div>
      <Button onClick={() => setShowCreatePost(true)} className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-5 z-40 h-12 w-12 rounded-full p-0 shadow-lg shadow-primary/25 md:bottom-6" size="icon" aria-label="Create a post"><Plus className="h-5 w-5" /></Button>
      {showCreatePost && <CreatePostModal onClose={() => setShowCreatePost(false)} />}
    </CommunityFrame>
  );
};

export default EnhancedSocial;
