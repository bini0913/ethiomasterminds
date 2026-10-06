import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, Compass, UserPlus, MessageCircle, Sparkles, ArrowRight, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFriends } from "@/context/FriendsContext";
import { useUser } from "@/context/UserContext";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import BackButton from "@/components/ui/BackButton";

const SocialHub: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { friends, friendRequests, messages, onlineFriends } = useFriends();
  const unread = messages.filter((message) => message.receiver === user?.id && !message.read).length;
  const incomingRequests = friendRequests.filter((request) => request.receiver.id === user?.id && request.status === "pending").length;
  const destinations = [
    { title: "Friends", description: "Connect with classmates, chat privately, send requests, and see who is online.", icon: Users, path: "/friends", stat: friends.length + " friend" + (friends.length === 1 ? "" : "s"), secondary: onlineFriends.length + " online now", accent: "from-primary/15 to-primary/5" },
    { title: "Community", description: "Explore student posts, study ideas, challenges, trends, and learning conversations.", icon: Compass, path: "/social/community", stat: "Explore the community", secondary: "Posts • Study • Challenges", accent: "from-cyan-500/15 to-primary/5" },
  ];
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <BackButton />
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0"><h1 className="text-lg font-bold">Social</h1><p className="text-xs text-muted-foreground">Connect, learn and grow together</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-cyan-500/10 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl"><Badge variant="secondary" className="mb-3">Your Social Space</Badge><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Learn with people who are on the same journey.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Choose where you want to go. Keep private conversations and friendships in Friends, and discover the wider Master Minds community in Community.</p></div>
            {user && <div className="hidden shrink-0 sm:block"><AvatarRenderer avatar={user.avatar} size="lg" /></div>}
          </div>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          {destinations.map((item, index) => {
            const Icon = item.icon; const isFriends = item.path === "/friends";
            return <motion.div key={item.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
              <Card className="group h-full overflow-hidden border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"><CardContent className="flex h-full flex-col p-5">
                <div className={"mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br " + item.accent + " text-primary"}><Icon className="h-7 w-7" /></div>
                <div className="flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-xl font-bold">{item.title}</h3>{isFriends && incomingRequests > 0 && <Badge>{incomingRequests} request{incomingRequests === 1 ? "" : "s"}</Badge>}</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p><div className="mt-4 flex flex-wrap gap-2 text-xs"><Badge variant="outline">{item.stat}</Badge><Badge variant="outline">{item.secondary}</Badge></div>
                </div>
                <Button className="mt-6 w-full justify-between" onClick={() => navigate(item.path)}>Open {item.title}<ArrowRight className="h-4 w-4" /></Button>
              </CardContent></Card>
            </motion.div>;
          })}
        </div>
        <section className="grid grid-cols-3 gap-2 sm:gap-3">
          <button onClick={() => navigate("/friends")} className="rounded-2xl border bg-card p-4 text-left transition hover:border-primary/30 hover:bg-muted/40"><UserPlus className="h-5 w-5 text-primary" /><p className="mt-2 text-sm font-semibold">Find people</p><p className="text-xs text-muted-foreground">Add friends</p></button>
          <button onClick={() => navigate("/friends?tab=messages")} className="rounded-2xl border bg-card p-4 text-left transition hover:border-primary/30 hover:bg-muted/40"><MessageCircle className="h-5 w-5 text-primary" /><p className="mt-2 text-sm font-semibold">Messages</p><p className="text-xs text-muted-foreground">{unread ? unread + " unread" : "All caught up"}</p></button>
          <button onClick={() => navigate("/social/community")} className="rounded-2xl border bg-card p-4 text-left transition hover:border-primary/30 hover:bg-muted/40"><Circle className="h-5 w-5 text-primary" /><p className="mt-2 text-sm font-semibold">Discover</p><p className="text-xs text-muted-foreground">See what is new</p></button>
        </section>
      </main>
    </div>
  );
};

export default SocialHub;