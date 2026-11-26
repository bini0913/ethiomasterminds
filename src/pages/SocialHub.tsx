import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Compass, MessageCircle, Sparkles, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useFriends } from "@/context/FriendsContext";
import { useUser } from "@/context/UserContext";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import CommunityFrame from "@/components/community/CommunityFrame";

const SocialHub: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { friends, friendRequests, messages, onlineFriends } = useFriends();
  const unread = messages.filter((message) => message.receiver === user?.id && !message.read).length;
  const requests = friendRequests.filter((request) => request.receiver.id === user?.id && request.status === "pending").length;
  const destinations = [
    { title: "Community", description: "Find useful ideas, study wins, questions, and challenges from other learners.", icon: Compass, path: "/social/community", eyebrow: "Explore", stat: "Live student feed", tone: "from-primary/18 to-cyan-500/8" },
    { title: "Friends", description: "Keep up with your people, respond to requests, and start a focused conversation.", icon: Users, path: "/friends", eyebrow: "Your people", stat: `${friends.length} connected`, tone: "from-violet-500/16 to-primary/8" },
    { title: "Messages", description: "Continue a private or group conversation, share a quiz, or join a room.", icon: MessageCircle, path: "/chat", eyebrow: "Stay in sync", stat: unread ? `${unread} unread` : "All caught up", tone: "from-amber-500/16 to-primary/8" },
  ];

  return (
    <CommunityFrame title="Your learning network" description="Find your people, share useful progress, and keep learning together.">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-cyan-500/10 p-5 shadow-sm sm:p-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="mb-4 rounded-full">Connect with purpose</Badge>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">Study better together.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Ask a clear question, celebrate a small win, and find the next conversation that helps you move forward.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="rounded-full">{friends.length} friends</Badge>
                <Badge variant="outline" className="rounded-full">{onlineFriends.length} online now</Badge>
                {requests > 0 && <Badge className="rounded-full">{requests} request{requests === 1 ? "" : "s"} waiting</Badge>}
              </div>
            </div>
            {user && <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-border/70 bg-background/45 p-3 backdrop-blur sm:flex"><AvatarRenderer avatar={user.avatar} size="lg" /><div><p className="text-sm font-semibold">Ready to connect?</p><p className="text-xs text-muted-foreground">Your network is waiting.</p></div></div>}
          </div>
        </section>

        <section aria-labelledby="connect-destinations">
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Choose a lane</p><h2 id="connect-destinations" className="mt-1 font-display text-2xl font-bold">What do you need right now?</h2></div><Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate("/social/community")}>Browse all <ArrowUpRight className="ml-2 h-4 w-4" /></Button></div>
          <div className="grid gap-4 lg:grid-cols-3">
            {destinations.map((item, index) => { const Icon = item.icon; return <motion.div key={item.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}><Card className="group h-full overflow-hidden border-border/70 bg-card/75 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg"><CardContent className="flex h-full flex-col p-5 sm:p-6"><div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.tone} text-primary`}><Icon className="h-6 w-6" /></div><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{item.eyebrow}</p><h3 className="mt-1 font-display text-2xl font-bold">{item.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{item.description}</p><div className="mt-5 flex items-center justify-between gap-3"><Badge variant="outline" className="rounded-full">{item.stat}</Badge><Button size="sm" onClick={() => navigate(item.path)}>Open <ArrowUpRight className="ml-1.5 h-4 w-4" /></Button></div></CardContent></Card></motion.div>; })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <button type="button" onClick={() => navigate("/friends?tab=add")} className="glass group rounded-2xl p-4 text-left transition hover:border-primary/35"><UserPlus className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">Find people</p><p className="mt-1 text-xs text-muted-foreground">Search by name or username.</p></button>
          <button type="button" onClick={() => navigate("/friends?tab=messages")} className="glass group rounded-2xl p-4 text-left transition hover:border-primary/35"><MessageCircle className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">Pick up a chat</p><p className="mt-1 text-xs text-muted-foreground">{unread ? `${unread} conversation${unread === 1 ? "" : "s"} need your attention.` : "Your inbox is clear."}</p></button>
          <button type="button" onClick={() => navigate("/social/community")} className="glass group rounded-2xl p-4 text-left transition hover:border-primary/35"><Sparkles className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">See what is new</p><p className="mt-1 text-xs text-muted-foreground">Explore posts, study ideas, and challenges.</p></button>
        </section>
      </div>
    </CommunityFrame>
  );
};

export default SocialHub;
