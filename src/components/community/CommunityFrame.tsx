import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass, MessageCircle, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useFriends } from "@/context/FriendsContext";
import { useUser } from "@/context/UserContext";

interface CommunityFrameProps {
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  showMetrics?: boolean;
}

const CommunityFrame: React.FC<CommunityFrameProps> = ({
  title,
  eyebrow = "Connect",
  description,
  children,
  className,
  showMetrics = true,
}) => {
  const location = useLocation();
  const { user } = useUser();
  const { friends, onlineFriends, friendRequests, messages } = useFriends();
  const unread = messages.filter((message) => message.receiver === user?.id && !message.read).length;
  const requests = friendRequests.filter((request) => request.receiver.id === user?.id && request.status === "pending").length;
  const routes = [
    { to: "/social", label: "Overview", icon: Sparkles },
    { to: "/social/community", label: "Community", icon: Compass },
    { to: "/friends", label: "Friends", icon: Users, badge: requests || undefined },
    { to: "/chat", label: "Messages", icon: MessageCircle, badge: unread || undefined },
  ];

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
              <h1 className="truncate font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
              {description && <p className="mt-0.5 hidden max-w-2xl truncate text-sm text-muted-foreground sm:block">{description}</p>}
            </div>
            {showMetrics && (
              <div className="hidden items-center gap-2 sm:flex">
                <Badge variant="outline" className="rounded-full px-3 py-1">{friends.length} friends</Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">{onlineFriends.length} online</Badge>
                {unread > 0 && <Badge className="rounded-full px-3 py-1">{unread} unread</Badge>}
              </div>
            )}
          </div>
          <nav aria-label="Connect navigation" className="flex max-w-full gap-1 overflow-x-auto scrollbar-hide">
            {routes.map(({ to, label, icon: Icon, badge }) => {
              const active = location.pathname === to || (to !== "/social" && location.pathname.startsWith(`${to}/`));
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                  {badge ? <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-primary-foreground/20" : "bg-destructive text-destructive-foreground")}>{badge}</span> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-10">{children}</main>
    </div>
  );
};

export default CommunityFrame;
