import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, MessageCircle, Search, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import ReportButton from "@/components/social/ReportButton";
import BlockUserButton from "@/components/social/BlockUserButton";
import { useFriends, FriendRequest } from "@/context/FriendsContext";
import { useUser, UserProfile } from "@/context/UserContext";
import CommunityFrame from "@/components/community/CommunityFrame";
import { getUserTier } from "@/lib/getUserTier";

const Friends: React.FC = () => {
  const { user } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";
  const {
    friends,
    friendRequests,
    outgoingRequests,
    messages,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    searchUsers,
    onlineFriends,
    friendPresence,
    refreshFriends,
    isPendingRequest,
  } = useFriends();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("friends");
  const [friendSearch, setFriendSearch] = useState("");
  const [addFriendSearch, setAddFriendSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const searchSequenceRef = useRef(0);

  const pendingRequests = friendRequests.filter(
    (request) => request.status === "pending" && request.receiver.id === user?.id,
  );
  const sentRequests = outgoingRequests.filter(
    (request) => request.status === "pending" && request.sender.id === user?.id,
  );

  // Keep old notification links working while directing all conversation UI to /chat.
  const requestedFriendId = searchParams.get("friend");
  useEffect(() => {
    if (!requestedFriendId || loading) return;
    navigate(`/chat?friend=${encodeURIComponent(requestedFriendId)}`, { replace: true });
  }, [loading, navigate, requestedFriendId]);

  useEffect(() => {
    const sequence = ++searchSequenceRef.current;
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    const query = addFriendSearch.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        setSearchError(null);
        const results = await searchUsers(query);
        if (sequence !== searchSequenceRef.current) return;
        const friendIds = new Set(friends.map((friend) => friend.id));
        setSearchResults(results.filter((result) => !friendIds.has(result.id)));
      } catch (error) {
        if (sequence !== searchSequenceRef.current) return;
        setSearchResults([]);
        setSearchError(error instanceof Error && error.message
          ? error.message
          : "We could not search for students. Please try again.");
      } finally {
        if (sequence === searchSequenceRef.current) setSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
      if (sequence === searchSequenceRef.current) searchSequenceRef.current += 1;
    };
  }, [addFriendSearch, friends, searchUsers]);

  const friendCards = useMemo(() => {
    const query = friendSearch.trim().toLowerCase();
    return friends
      .filter((friend) => `${friend.name} ${friend.username || ""}`.toLowerCase().includes(query))
      .map((friend) => {
        const conversation = messages
          .filter((message) =>
            (message.sender === user?.id && message.receiver === friend.id) ||
            (message.sender === friend.id && message.receiver === user?.id),
          )
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return {
          friend,
          lastMessage: conversation[conversation.length - 1],
          unreadCount: conversation.filter((message) => message.sender === friend.id && !message.read).length,
          online: onlineFriends.some((onlineFriend) => onlineFriend.id === friend.id),
        };
      })
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        const aTime = a.lastMessage?.timestamp.getTime() || 0;
        const bTime = b.lastMessage?.timestamp.getTime() || 0;
        if (aTime !== bTime) return bTime - aTime;
        return a.friend.name.localeCompare(b.friend.name);
      });
  }, [friendSearch, friends, messages, onlineFriends, user?.id]);

  const handleAddFriend = async (target: UserProfile) => {
    await sendFriendRequest(target.id);
  };

  const formatTime = (date?: Date) => date
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

  const getLastSeen = (friendId: string) => {
    const lastSeen = friendPresence[friendId]?.lastSeen;
    if (!lastSeen) return "Last seen unavailable";
    const elapsed = Date.now() - new Date(lastSeen).getTime();
    if (elapsed < 60_000) return "Active just now";
    if (elapsed < 3_600_000) return `Active ${Math.floor(elapsed / 60_000)}m ago`;
    if (elapsed < 86_400_000) return `Active ${Math.floor(elapsed / 3_600_000)}h ago`;
    return `Last seen ${new Date(lastSeen).toLocaleDateString([], { month: "short", day: "numeric" })}`;
  };

  return (
    <CommunityFrame
      title="Friends"
      eyebrow="Your people"
      description="Manage your connections here. All conversations now live together in Messages."
      className={upperStudent ? "tier-upper" : undefined}
    >
      <div className="mx-auto w-full max-w-5xl px-3 pb-28 pt-2 sm:px-5 md:pb-8">
        <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
            <div><h2 className="font-semibold">Your network</h2><p className="text-sm text-muted-foreground">{friends.length} friends · {onlineFriends.length} active now</p></div>
          </div>
          <Button type="button" onClick={() => navigate("/chat")} className="rounded-full"><MessageCircle className="mr-2 h-4 w-4" />Open messages</Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 grid h-12 w-full max-w-lg grid-cols-3 rounded-xl bg-muted/70 p-1">
            <TabsTrigger value="friends" className="rounded-lg">Friends <span className="ml-1.5 text-xs text-muted-foreground">{friends.length}</span></TabsTrigger>
            <TabsTrigger value="requests" className="rounded-lg">Requests{pendingRequests.length + sentRequests.length > 0 && <Badge className="ml-1.5 h-5 min-w-5 rounded-full px-1.5">{pendingRequests.length + sentRequests.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="find" className="rounded-lg"><UserPlus className="mr-1.5 h-4 w-4" />Find people</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="mt-0">
            <label className="relative mb-3 block max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={friendSearch} onChange={(event) => setFriendSearch(event.target.value)} placeholder="Search friends" aria-label="Search friends" className="h-11 rounded-xl bg-card pl-9" />
            </label>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {loading ? <LoadingRows /> : friendCards.length > 0 ? friendCards.map(({ friend, lastMessage, unreadCount, online }) => (
                <div key={friend.id} className="flex min-h-[86px] items-center gap-3 border-b border-border/70 px-3 py-3 last:border-b-0 sm:px-4">
                  <span className="relative shrink-0"><AvatarRenderer avatar={friend.avatar} size="md" className="h-12 w-12" />{online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500" aria-label="Online" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{friend.name}</p>{unreadCount > 0 && <Badge className="h-5 rounded-full px-1.5 text-[10px]">{unreadCount} new</Badge>}</div>
                    <p className="truncate text-xs text-muted-foreground">{friend.username ? `@${friend.username}` : `Level ${friend.level} · ${friend.xp} XP`}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{lastMessage ? `${lastMessage.sender === user?.id ? "You: " : ""}${lastMessage.content}` : online ? "Active now" : getLastSeen(friend.id)}</p>
                  </div>
                  <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{formatTime(lastMessage?.timestamp)}</span>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => navigate(`/chat?friend=${encodeURIComponent(friend.id)}`)}><MessageCircle className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Message</span><span className="sm:hidden">Chat</span></Button>
                  <ReportButton reportedType="user" reportedId={friend.id} size="icon" />
                  <BlockUserButton userId={friend.id} displayName={friend.name} onBlocked={() => void refreshFriends()} />
                </div>
              )) : <EmptyState title={friendSearch ? "No friends match that search" : "No friends yet"} description={friendSearch ? "Try another name or username." : "Find classmates and send a request to grow your network."} actionLabel={friendSearch ? undefined : "Find people"} onAction={friendSearch ? undefined : () => setActiveTab("find")} />}
            </div>
          </TabsContent>

          <TabsContent value="requests" className="mt-0">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">Received</h3><p className="text-xs text-muted-foreground">People who want to connect</p></div>
                {pendingRequests.length > 0 ? pendingRequests.map((request) => <FriendRequestRow key={request.id} request={request} onAccept={acceptFriendRequest} onDecline={declineFriendRequest} />) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No incoming requests.</p>}
              </section>
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">Sent</h3><p className="text-xs text-muted-foreground">Requests waiting for a reply</p></div>
                {sentRequests.length > 0 ? sentRequests.map((request) => <SentRequestRow key={request.id} request={request} />) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">No pending sent requests.</p>}
              </section>
            </div>
          </TabsContent>

          <TabsContent value="find" className="mt-0">
            <section className="max-w-3xl rounded-2xl border border-border bg-card p-4 sm:p-5">
              <h3 className="font-semibold">Find people</h3><p className="mt-1 text-sm text-muted-foreground">Search by name or username to send a friend request.</p>
              <label className="relative mt-4 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input autoComplete="off" value={addFriendSearch} onChange={(event) => setAddFriendSearch(event.target.value)} placeholder="Search name or username" aria-label="Search people by name or username" className="h-11 rounded-xl pl-9" /></label>
              <div className="mt-4 divide-y divide-border">
                {searching ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />Searching students…</div> : searchError ? <p className="py-5 text-sm text-destructive">{searchError}</p> : searchResults.length > 0 ? searchResults.map((result) => (
                  <div key={result.id} className="flex min-h-[72px] items-center gap-3 py-3">
                    <AvatarRenderer avatar={result.avatar} size="sm" className="h-11 w-11" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{result.name}</p><p className="truncate text-xs text-muted-foreground">{result.username ? `@${result.username}` : `Level ${result.level}`}</p></div>
                    {isPendingRequest(result.id) ? <Badge variant="secondary" className="rounded-full">Pending</Badge> : <Button type="button" size="sm" className="rounded-full" onClick={() => void handleAddFriend(result)}><UserPlus className="mr-1.5 h-4 w-4" />Add friend</Button>}
                  </div>
                )) : addFriendSearch.trim().length >= 2 ? <p className="py-8 text-center text-sm text-muted-foreground">No students found for “{addFriendSearch.trim()}”.</p> : <p className="py-8 text-center text-sm text-muted-foreground">Enter at least two characters to search.</p>}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </CommunityFrame>
  );
};

const LoadingRows = () => <div className="space-y-1 p-4" aria-label="Loading friends">{[0, 1, 2].map((item) => <div key={item} className="flex animate-pulse items-center gap-3 py-3"><span className="h-12 w-12 rounded-full bg-muted" /><span className="flex-1 space-y-2"><span className="block h-3 w-1/3 rounded bg-muted" /><span className="block h-3 w-1/2 rounded bg-muted" /></span></div>)}</div>;

const EmptyState = ({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) => (
  <div className="flex flex-col items-center px-5 py-12 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><Users className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>{actionLabel && onAction && <Button type="button" variant="link" className="mt-2" onClick={onAction}>{actionLabel}</Button>}</div>
);

const FriendRequestRow = ({ request, onAccept, onDecline }: { request: FriendRequest; onAccept: (id: string) => void | Promise<void>; onDecline: (id: string) => void | Promise<void> }) => (
  <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"><AvatarRenderer avatar={request.sender.avatar} size="sm" className="h-11 w-11" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{request.sender.name}</p><p className="text-xs text-muted-foreground">Level {request.sender.level} · {request.sender.xp} XP</p></div><Button type="button" size="icon" aria-label={`Accept request from ${request.sender.name}`} title="Accept" onClick={() => void onAccept(request.id)} className="h-9 w-9 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"><Check className="h-4 w-4" /></Button><Button type="button" size="icon" variant="outline" aria-label={`Decline request from ${request.sender.name}`} title="Decline" onClick={() => void onDecline(request.id)} className="h-9 w-9 rounded-full"><X className="h-4 w-4" /></Button></div>
);

const SentRequestRow = ({ request }: { request: FriendRequest }) => (
  <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"><AvatarRenderer avatar={request.receiver.avatar} size="sm" className="h-11 w-11" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{request.receiver.name}</p><p className="truncate text-xs text-muted-foreground">{request.receiver.username ? `@${request.receiver.username}` : "Waiting for a reply"}</p></div><Badge variant="secondary" className="rounded-full">Pending</Badge></div>
);

export default Friends;
