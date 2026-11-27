import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CircleUserRound,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Smile,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import BackButton from "@/components/ui/BackButton";
import { useUser, UserProfile } from "@/context/UserContext";
import { useFriends, Message as DirectMessage } from "@/context/FriendsContext";
import { supabase } from "@/integrations/supabase/client";
import { getUserTier } from "@/lib/getUserTier";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatRoom {
  id: string;
  name: string;
  group_type: string;
  avatar_url?: string | null;
  created_by: string;
  lastMessage?: string;
  lastMessageTime?: string;
  memberCount: number;
}

interface ChatMember {
  id: string;
  user_id: string;
  role: string;
  name: string;
  avatar: string;
  level: number;
}

interface GroupMessage {
  id: string;
  sender_id: string;
  content: string;
  message_type: string;
  attachment_url?: string | null;
  reply_to_id?: string | null;
  created_at: string;
  senderName: string;
  senderAvatar: string;
  replyTo?: { content: string; senderName: string };
}

interface ProfileSummary {
  name: string;
  avatar: string;
  level: number;
}

type InboxSection = "direct" | "groups";

const blockedPhrases = ["kill yourself", "hate you"];

const formatTime = (value?: string | Date) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatLastSeen = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last active status unavailable";
  const elapsed = Math.max(0, Date.now() - date.getTime());
  if (elapsed < 60_000) return "Last active just now";
  if (elapsed < 3_600_000) return `Last active ${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `Last active ${Math.floor(elapsed / 3_600_000)}h ago`;
  if (elapsed < 172_800_000) return "Last active yesterday";
  return `Last active ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
};

const Chat: React.FC = () => {
  const { user, isLoading } = useUser();
  const upperStudent = getUserTier(user?.grade) === "upper";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    friends,
    messages: directMessages,
    sendMessage: sendDirectMessage,
    markMessageAsRead,
    onlineFriends,
    friendPresence,
    loading: friendsLoading,
  } = useFriends();

  const [section, setSection] = useState<InboxSection>("direct");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [newMessageSearch, setNewMessageSearch] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showFindGroup, setShowFindGroup] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("group");
  const [groupQuery, setGroupQuery] = useState("");
  const [groupResults, setGroupResults] = useState<ChatRoom[]>([]);
  const [roomLoadError, setRoomLoadError] = useState(false);
  const [groupMessagesError, setGroupMessagesError] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [profileCache, setProfileCache] = useState<Record<string, ProfileSummary>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationListReturnFocusRef = useRef<HTMLButtonElement>(null);
  const conversationSearchRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimersRef = useRef<Record<string, number>>({});
  const profileCacheRef = useRef(profileCache);
  const markReadRef = useRef(markMessageAsRead);
  const groupSearchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    profileCacheRef.current = profileCache;
  }, [profileCache]);

  useEffect(() => {
    markReadRef.current = markMessageAsRead;
  }, [markMessageAsRead]);

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.id === selectedFriendId) ?? null,
    [friends, selectedFriendId],
  );

  const getDirectConversation = useCallback((friendId: string) => {
    if (!user?.id) return [];
    return directMessages
      .filter((message) =>
        (message.sender === user.id && message.receiver === friendId) ||
        (message.sender === friendId && message.receiver === user.id),
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [directMessages, user?.id]);

  const directThreads = useMemo(() => friends.map((friend) => {
    const conversation = getDirectConversation(friend.id);
    const lastMessage = conversation[conversation.length - 1];
    const unreadCount = conversation.filter((message) =>
      message.sender === friend.id && message.receiver === user?.id && !message.read,
    ).length;
    return { friend, lastMessage, unreadCount };
  }).sort((a, b) => {
    const aTime = a.lastMessage?.timestamp.getTime() ?? 0;
    const bTime = b.lastMessage?.timestamp.getTime() ?? 0;
    if (aTime !== bTime) return bTime - aTime;
    const aOnline = onlineFriends.some((friend) => friend.id === a.friend.id);
    const bOnline = onlineFriends.some((friend) => friend.id === b.friend.id);
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return a.friend.name.localeCompare(b.friend.name);
  }), [friends, getDirectConversation, onlineFriends, user?.id]);

  const activeDirectMessages = useMemo(
    () => selectedFriend ? getDirectConversation(selectedFriend.id) : [],
    [getDirectConversation, selectedFriend],
  );

  const filteredDirectThreads = directThreads.filter(({ friend }) =>
    `${friend.name} ${friend.username || ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const filteredNewMessageFriends = friends.filter((friend) =>
    `${friend.name} ${friend.username || ""}`.toLowerCase().includes(newMessageSearch.trim().toLowerCase()),
  );

  const loadRooms = useCallback(async () => {
    setRoomLoadError(false);
    if (!user?.id) {
      setRooms([]);
      setLoadingRooms(false);
      return;
    }
    setLoadingRooms(true);
    try {
      const { data: memberships, error: membershipsError } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .eq("user_id", user.id);
      if (membershipsError) throw membershipsError;

      const groupIds = [...new Set((memberships || []).map((membership) => membership.group_id))];
      if (groupIds.length === 0) {
        setRooms([]);
        return;
      }

      const { data: groups, error: groupsError } = await supabase
        .from("chat_groups")
        .select("id, name, group_type, avatar_url, created_by, updated_at")
        .in("id", groupIds)
        .order("updated_at", { ascending: false });
      if (groupsError) throw groupsError;

      const roomList = await Promise.all((groups || []).map(async (group) => {
        const [{ data: lastMessage }, { count: memberCount }] = await Promise.all([
          supabase.from("group_messages")
            .select("content, created_at")
            .eq("group_id", group.id)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase.from("chat_group_members")
            .select("id", { count: "exact", head: true })
            .eq("group_id", group.id),
        ]);
        return {
          id: group.id,
          name: group.name,
          group_type: group.group_type,
          avatar_url: group.avatar_url,
          created_by: group.created_by,
          lastMessage: lastMessage?.[0]?.content,
          lastMessageTime: lastMessage?.[0]?.created_at,
          memberCount: memberCount || 0,
        } satisfies ChatRoom;
      }));
      setRooms(roomList);
    } catch (error) {
      console.error("Error loading chat rooms:", error);
      setRoomLoadError(true);
    } finally {
      setLoadingRooms(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const fetchProfiles = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    const missingIds = uniqueIds.filter((id) => !profileCacheRef.current[id]);
    let nextCache = profileCacheRef.current;
    if (missingIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, avatar, level")
        .in("id", missingIds);
      if (error) throw error;
      const newProfiles = Object.fromEntries((data || []).map((profile) => [profile.id, {
        name: profile.name || "Student",
        avatar: profile.avatar || "👤",
        level: profile.level || 1,
      } satisfies ProfileSummary]));
      nextCache = { ...profileCacheRef.current, ...newProfiles };
      profileCacheRef.current = nextCache;
      setProfileCache(nextCache);
    }
    return nextCache;
  }, []);

  const loadGroupMessages = useCallback(async (roomId: string) => {
    setLoadingMessages(true);
    setGroupMessagesError(false);
    try {
      const { data, error } = await supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", roomId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;

      const rows = data || [];
      const replyIds = [...new Set(rows.filter((message) => message.reply_to_id).map((message) => message.reply_to_id!))];
      let replyRows: Array<{ id: string; content: string; sender_id: string }> = [];
      if (replyIds.length > 0) {
        const { data: replies, error: repliesError } = await supabase
          .from("group_messages")
          .select("id, content, sender_id")
          .in("id", replyIds);
        if (repliesError) throw repliesError;
        replyRows = replies || [];
      }
      const profiles = await fetchProfiles([
        ...rows.map((message) => message.sender_id),
        ...replyRows.map((message) => message.sender_id),
      ]);
      const repliesById = Object.fromEntries(replyRows.map((message) => [message.id, message]));
      setGroupMessages(rows.map((message) => {
        const sender = profiles[message.sender_id] || { name: "Student", avatar: "👤", level: 1 };
        const reply = message.reply_to_id ? repliesById[message.reply_to_id] : undefined;
        const replySender = reply ? profiles[reply.sender_id] : undefined;
        return {
          id: message.id,
          sender_id: message.sender_id,
          content: message.content,
          message_type: message.message_type,
          attachment_url: message.attachment_url,
          reply_to_id: message.reply_to_id,
          created_at: message.created_at,
          senderName: sender.name,
          senderAvatar: sender.avatar,
          replyTo: reply ? { content: reply.content, senderName: replySender?.name || "Student" } : undefined,
        };
      }));
    } catch (error) {
      console.error("Error loading messages:", error);
      setGroupMessagesError(true);
      setGroupMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [fetchProfiles]);

  const loadMembers = useCallback(async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from("chat_group_members")
        .select("id, user_id, role")
        .eq("group_id", roomId);
      if (error) throw error;
      const memberRows = data || [];
      const profiles = await fetchProfiles(memberRows.map((member) => member.user_id));
      setMembers(memberRows.map((member) => {
        const profile = profiles[member.user_id] || { name: "Student", avatar: "👤", level: 1 };
        return { id: member.id, user_id: member.user_id, role: member.role, ...profile };
      }));
    } catch (error) {
      console.error("Error loading chat members:", error);
      setMembers([]);
    }
  }, [fetchProfiles]);

  const selectFriend = (friend: UserProfile) => {
    setSection("direct");
    setSelectedFriendId(friend.id);
    setActiveRoom(null);
    setMobileChatOpen(true);
    setDraft("");
    setReplyTo(null);
    setSearchParams({ friend: friend.id });
    directMessages
      .filter((message) => message.sender === friend.id && message.receiver === user?.id && !message.read)
      .forEach((message) => markReadRef.current(message.id));
  };

  const selectRoom = (room: ChatRoom) => {
    setSection("groups");
    setActiveRoom(room);
    setSelectedFriendId(null);
    setMobileChatOpen(true);
    setDraft("");
    setReplyTo(null);
    setSearchParams({ room: room.id });
    void loadGroupMessages(room.id);
    void loadMembers(room.id);
  };

  const friendQuery = searchParams.get("friend");
  const roomQuery = searchParams.get("room");

  useEffect(() => {
    if (!friendQuery) return;
    const friend = friends.find((candidate) => candidate.id === friendQuery);
    if (friend) {
      setSection("direct");
      setSelectedFriendId(friend.id);
      setActiveRoom(null);
      setMobileChatOpen(true);
    }
  }, [friendQuery, friends]);

  useEffect(() => {
    if (!roomQuery) return;
    const room = rooms.find((candidate) => candidate.id === roomQuery);
    if (room) {
      setSection("groups");
      setActiveRoom(room);
      setSelectedFriendId(null);
      setMobileChatOpen(true);
      void loadGroupMessages(room.id);
      void loadMembers(room.id);
    }
  }, [roomQuery, rooms, loadGroupMessages, loadMembers]);

  useEffect(() => {
    if (!selectedFriendId || !user?.id) return;
    directMessages
      .filter((message) => message.sender === selectedFriendId && message.receiver === user.id && !message.read)
      .forEach((message) => markReadRef.current(message.id));
  }, [directMessages, selectedFriendId, user?.id]);

  useEffect(() => {
    if (!activeRoom) return;
    let disposed = false;
    const typingChannel = supabase.channel(`typing-${activeRoom.id}`, {
      config: { broadcast: { self: false } },
    });
    typingChannel.on("broadcast", { event: "typing" }, (event) => {
      const userId = event.payload?.userId as string | undefined;
      const name = event.payload?.userName as string | undefined;
      if (!userId || userId === user?.id) return;
      setTypingUsers((current) => ({ ...current, [userId]: name || "Someone" }));
      const previousTimer = typingTimersRef.current[userId];
      if (previousTimer) window.clearTimeout(previousTimer);
      typingTimersRef.current[userId] = window.setTimeout(() => {
        setTypingUsers((current) => {
          const next = { ...current };
          delete next[userId];
          return next;
        });
      }, 2200);
    }).subscribe();
    typingChannelRef.current = typingChannel;

    const messageChannel = supabase.channel(`messages-${activeRoom.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "group_messages",
        filter: `group_id=eq.${activeRoom.id}`,
      }, async (event) => {
        const row = event.new as {
          id: string;
          sender_id: string;
          content: string;
          message_type: string;
          attachment_url?: string | null;
          reply_to_id?: string | null;
          created_at: string;
        };
        const profiles = await fetchProfiles([row.sender_id]);
        if (disposed) return;
        const sender = profiles[row.sender_id] || { name: "Student", avatar: "👤", level: 1 };
        setGroupMessages((current) => current.some((message) => message.id === row.id) ? current : [
          ...current,
          {
            ...row,
            senderName: sender.name,
            senderAvatar: sender.avatar,
          },
        ]);
        setRooms((current) => current.map((room) => room.id === activeRoom.id
          ? { ...room, lastMessage: row.content, lastMessageTime: row.created_at }
          : room));
      })
      .subscribe();

    return () => {
      disposed = true;
      Object.values(typingTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      typingTimersRef.current = {};
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
      supabase.removeChannel(messageChannel);
      typingChannelRef.current = null;
      setTypingUsers({});
    };
  }, [activeRoom, fetchProfiles, user?.id]);

  const activeGroupTypingText = useMemo(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return "";
    return names.length === 1 ? `${names[0]} is typing…` : `${names[0]} and others are typing…`;
  }, [typingUsers]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeDirectMessages, groupMessages, activeRoom, selectedFriend]);

  useEffect(() => {
    if (!selectedFriendId && !activeRoom) return;
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "44px";
      textarea.scrollTop = textarea.scrollHeight;
      textarea.focus({ preventScroll: true });
    }
  }, [selectedFriendId, activeRoom]);

  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "44px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 176 ? "auto" : "hidden";
  }, [draft]);

  useEffect(() => {
    if (!mobileChatOpen && (selectedFriendId || activeRoom)) {
      const selectedConversation = conversationListReturnFocusRef.current;
      if (selectedConversation?.isConnected) selectedConversation.focus();
      else conversationSearchRef.current?.focus();
    }
  }, [activeRoom, mobileChatOpen, selectedFriendId]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (value.trim() && typingChannelRef.current && user) {
      void typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user.id, userName: user.name || "Student" },
      });
    }
  };

  const sendGroupMessage = useCallback(async () => {
    if (!user?.id || !activeRoom || !draft.trim() || sending) return;
    const content = draft.trim();
    if (blockedPhrases.some((phrase) => content.toLowerCase().includes(phrase))) {
      toast.error("Message blocked by safety filter.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("group_messages").insert({
      group_id: activeRoom.id,
      sender_id: user.id,
      content,
      message_type: "text",
      reply_to_id: replyTo?.id || null,
    });
    if (error) {
      toast.error("Message could not be sent. Please try again.");
      setSending(false);
      return;
    }
    setDraft("");
    setReplyTo(null);
    setSending(false);
    await supabase.from("chat_groups").update({ updated_at: new Date().toISOString() }).eq("id", activeRoom.id);
  }, [activeRoom, draft, replyTo, sending, user?.id]);

  const sendCurrentMessage = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    if (selectedFriend) {
      setSending(true);
      const sent = await sendDirectMessage(selectedFriend.id, content);
      if (sent) setDraft("");
      setSending(false);
      return;
    }
    await sendGroupMessage();
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendCurrentMessage();
    }
  };

  const createGroup = async () => {
    if (!user?.id || !newGroupName.trim()) return;
    try {
      const { data, error } = await supabase.from("chat_groups").insert({
        name: newGroupName.trim(),
        group_type: newGroupType,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      const { error: memberError } = await supabase.from("chat_group_members").insert({
        group_id: data.id,
        user_id: user.id,
        role: "owner",
      });
      if (memberError) throw memberError;
      toast.success("Group created");
      setNewGroupName("");
      setShowCreateGroup(false);
      await loadRooms();
      const createdRoom: ChatRoom = {
        id: data.id,
        name: data.name,
        group_type: data.group_type,
        avatar_url: data.avatar_url,
        created_by: data.created_by,
        memberCount: 1,
      };
      selectRoom(createdRoom);
    } catch (error) {
      console.error("Could not create group:", error);
      toast.error("Could not create this group");
    }
  };

  const searchGroups = async (query: string) => {
    setGroupQuery(query);
    if (groupSearchTimerRef.current) window.clearTimeout(groupSearchTimerRef.current);
    if (query.trim().length < 2) {
      setGroupResults([]);
      return;
    }
    groupSearchTimerRef.current = window.setTimeout(async () => {
      const { data, error } = await supabase.from("chat_groups")
        .select("id, name, group_type, avatar_url, created_by")
        .or("group_type.eq.public,group_type.eq.class")
        .ilike("name", `%${query.trim()}%`)
        .limit(10);
      if (error) {
        toast.error("Could not search groups");
        return;
      }
      setGroupResults((data || []).map((group) => ({ ...group, memberCount: 0 })));
    }, 250);
  };

  const joinGroup = async (room: ChatRoom) => {
    if (!user?.id) return;
    const { error } = await supabase.from("chat_group_members").insert({
      group_id: room.id,
      user_id: user.id,
      role: "member",
    });
    if (error?.code === "23505") {
      toast.info("You are already in this group");
      await loadRooms();
      setShowFindGroup(false);
      return;
    }
    if (error) {
      toast.error("Could not join this group");
      return;
    }
    toast.success("Joined group");
    await loadRooms();
    setShowFindGroup(false);
    selectRoom(room);
  };

  const selectDirectFromModal = (friend: UserProfile) => {
    setShowNewMessage(false);
    selectFriend(friend);
  };

  const hasActiveConversation = Boolean(selectedFriend || activeRoom);
  const listIsLoading = section === "direct" ? friendsLoading : loadingRooms;
  const isOnline = (friendId: string) => onlineFriends.some((friend) => friend.id === friendId);
  const activeRoomMembers = members;
  const activeGroupTitle = activeRoom?.name || "Group chat";
  const activeDirectPresence = selectedFriend ? friendPresence[selectedFriend.id] : undefined;
  const lastSeenLabel = activeDirectPresence?.lastSeen
    ? formatLastSeen(activeDirectPresence.lastSeen)
    : "Last active status unavailable";
  const pageHeight = upperStudent
    ? "h-[calc(100dvh-8.25rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-4.25rem)]"
    : "h-[calc(100dvh-10.5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-6rem)]";

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Loading messages" /></div>;
  }

  return (
    <main className={cn("mx-auto flex w-full max-w-[1440px] flex-col px-0 pb-0 sm:px-3 md:px-6", pageHeight)}>
      <section className="flex min-h-0 flex-1 overflow-hidden border-y border-border bg-card md:rounded-2xl md:border md:shadow-sm">
        <aside className={cn(
          "min-h-0 w-full flex-col border-r border-border bg-background md:flex md:w-[350px] md:shrink-0 lg:w-[380px]",
          mobileChatOpen ? "hidden md:flex" : "flex",
        )} aria-label="Conversations">
          <div className="border-b border-border px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Inbox</p>
                <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight">Messages</h1>
              </div>
              <div className="flex items-center gap-1">
                {section === "groups" && <>
                  <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Find a group" title="Find a group" onClick={() => setShowFindGroup(true)}>
                    <Search className="h-5 w-5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Create a group" title="Create a group" onClick={() => setShowCreateGroup(true)}>
                    <Users className="h-5 w-5" />
                  </Button>
                </>}
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="New message" title="New message" onClick={() => setShowNewMessage(true)}>
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="mt-4 flex rounded-xl bg-muted/70 p-1" role="group" aria-label="Conversation type">
              <button type="button" aria-pressed={section === "direct"} onClick={() => { setSection("direct"); setSearch(""); }} className={cn("min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", section === "direct" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                Direct
              </button>
              <button type="button" aria-pressed={section === "groups"} onClick={() => { setSection("groups"); setSearch(""); }} className={cn("min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", section === "groups" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                Groups
              </button>
            </div>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input ref={conversationSearchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={section === "direct" ? "Search people" : "Search groups"} aria-label={section === "direct" ? "Search direct messages" : "Search groups"} className="h-10 rounded-xl border-0 bg-muted/60 pl-9 focus-visible:ring-1" />
            </label>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {listIsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading conversations" /></div>
            ) : section === "direct" ? (
              filteredDirectThreads.length > 0 ? (
                <div className="p-2">
                  {filteredDirectThreads.map(({ friend, lastMessage, unreadCount }) => {
                    const selected = selectedFriendId === friend.id;
                    const online = isOnline(friend.id);
                    return (
                      <button key={friend.id} ref={selected ? conversationListReturnFocusRef : undefined} type="button" onClick={() => selectFriend(friend)} aria-current={selected ? "true" : undefined} className={cn("flex min-h-[76px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "bg-primary/10 hover:bg-primary/10")}>
                        <span className="relative shrink-0">
                          <AvatarRenderer avatar={friend.avatar} size="md" className="h-12 w-12" />
                          {online && <><span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" aria-hidden="true" /><span className="sr-only">Online</span></>}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">{friend.name}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{lastMessage ? formatTime(lastMessage.timestamp) : ""}</span>
                          </span>
                          <span className="mt-1 flex items-center justify-between gap-2">
                            <span className={cn("truncate text-xs", unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                              {lastMessage ? `${lastMessage.sender === user?.id ? "You: " : ""}${lastMessage.content}` : "Start a conversation"}
                            </span>
                            {unreadCount > 0 && <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">{unreadCount}</Badge>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyInbox title={search ? "No people found" : "No conversations yet"} description={search ? "Try another name or username." : "Choose a friend and send a message to get started."} actionLabel={search ? undefined : "New message"} onAction={search ? undefined : () => setShowNewMessage(true)} />
              )
            ) : roomLoadError ? (
              <div role="alert" className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
                <p className="text-sm font-semibold">Group chats couldn’t load</p>
                <p className="mt-1 text-xs text-muted-foreground">Your groups are still here. Check your connection and try again.</p>
                <Button type="button" variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => void loadRooms()}>Try again</Button>
              </div>
            ) : filteredRooms.length > 0 ? (
              <div className="p-2">
                {filteredRooms.map((room) => {
                  const selected = activeRoom?.id === room.id;
                  return (
                  <button key={room.id} ref={selected ? conversationListReturnFocusRef : undefined} type="button" onClick={() => selectRoom(room)} aria-current={selected ? "true" : undefined} className={cn("flex min-h-[76px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "bg-primary/10 hover:bg-primary/10")}>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                        {room.avatar_url ? <img src={room.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{room.name}</span><span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(room.lastMessageTime)}</span></span>
                        <span className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-xs text-muted-foreground">{room.lastMessage || `${room.memberCount} members`}</span><span className="shrink-0 text-[10px] capitalize text-muted-foreground">{room.group_type}</span></span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyInbox title={search ? "No groups found" : "No group chats yet"} description={search ? "Try another group name." : "Create a group or find one that is open to join."} actionLabel={search ? undefined : "Create a group"} onAction={search ? undefined : () => setShowCreateGroup(true)} />
            )}
          </ScrollArea>
          <div className="border-t border-border px-4 py-3 text-center text-[11px] text-muted-foreground">Messages stay in your existing Master Minds chats.</div>
        </aside>

        <section className={cn("min-h-0 min-w-0 flex-1 flex-col bg-background", mobileChatOpen ? "flex" : "hidden md:flex")} aria-label="Conversation">
          {hasActiveConversation ? (
            <>
              <header className="flex min-h-[68px] items-center gap-3 border-b border-border px-3 py-2.5 sm:px-5">
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full md:hidden" aria-label="Back to conversations" onClick={() => setMobileChatOpen(false)}><ArrowLeft className="h-5 w-5" /></Button>
                {selectedFriend ? (
                  <AvatarRenderer avatar={selectedFriend.avatar} size="sm" className="h-10 w-10 shrink-0" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Users className="h-5 w-5" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selectedFriend?.name || activeGroupTitle}</p>
                  <p className="truncate text-xs text-muted-foreground">{selectedFriend ? (isOnline(selectedFriend.id) ? "Active now" : lastSeenLabel) : `${activeRoom?.memberCount ?? 0} members · ${activeRoom?.group_type || "group"}`}</p>
                </div>
                {activeRoom && <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Show group members" title="Group members" onClick={() => setShowMembers(true)}><MoreHorizontal className="h-5 w-5" /></Button>}
                {selectedFriend && <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="View profile" title="View profile" onClick={() => navigate(`/profile/${selectedFriend.id}`)}><CircleUserRound className="h-5 w-5" /></Button>}
              </header>

              <ScrollArea className="min-h-0 flex-1 px-3 py-4 sm:px-6">
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-2">
                  {selectedFriend ? (
                    activeDirectMessages.length === 0 ? (
                      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                        <AvatarRenderer avatar={selectedFriend.avatar} size="lg" className="mb-4 h-20 w-20" />
                        <h2 className="text-lg font-semibold">{selectedFriend.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Start a conversation. Your message will appear here.</p>
                      </div>
                    ) : activeDirectMessages.map((message) => (
                      <DirectMessageBubble key={message.id} message={message} isMine={message.sender === user?.id} />
                    ))
                  ) : loadingMessages ? (
                    <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading messages" /></div>
                  ) : groupMessagesError ? (
                    <div role="alert" className="m-auto max-w-sm rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center">
                      <p className="text-sm font-semibold">Messages couldn’t load</p>
                      <p className="mt-1 text-xs text-muted-foreground">Your conversation hasn’t been cleared. Try loading it again.</p>
                      <Button type="button" variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => activeRoom && void loadGroupMessages(activeRoom.id)}>Try again</Button>
                    </div>
                  ) : groupMessages.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground"><Users className="h-7 w-7" /></span>
                      <h2 className="text-lg font-semibold">Say hello to the group</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Your conversation starts with the first message.</p>
                    </div>
                  ) : (
                    groupMessages.map((message) => (
                      <GroupMessageBubble key={message.id} message={message} isMine={message.sender_id === user?.id} onReply={() => setReplyTo(message)} />
                    ))
                  )}
                  {activeRoom && activeGroupTypingText && <p role="status" aria-live="polite" className="px-3 py-1 text-xs text-muted-foreground">{activeGroupTypingText}</p>}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {activeRoom && replyTo && <div className="mx-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2 sm:mx-5">
                <span className="h-8 w-1 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold">Replying to {replyTo.senderName}</p><p className="truncate text-xs text-muted-foreground">{replyTo.content}</p></div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></Button>
              </div>}

              <form className="border-t border-border bg-background px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5" onSubmit={(event) => { event.preventDefault(); void sendCurrentMessage(); }}>
                <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[1.5rem] border border-border bg-muted/40 p-1.5 pl-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
                  <Button type="button" variant="ghost" size="icon" className="mb-0.5 h-9 w-9 shrink-0 rounded-full text-muted-foreground" aria-label="Insert smiley" title="Insert smiley" disabled={sending} onClick={() => { setDraft((value) => `${value}${value ? " " : ""}🙂`); inputRef.current?.focus(); }}><Smile className="h-5 w-5" /></Button>
                  <Textarea
                    ref={inputRef}
                    value={draft}
                    disabled={sending}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={1}
                    placeholder="Message…"
                    aria-label="Write a message"
                    aria-describedby="message-composer-hint"
                    className="max-h-44 min-h-11 flex-1 resize-none border-0 bg-transparent px-1 py-3 text-sm leading-5 shadow-none focus-visible:ring-0"
                  />
                  <Button type="submit" aria-label={sending ? "Sending message" : "Send message"} disabled={!draft.trim() || sending} className="mb-0.5 h-10 shrink-0 rounded-full px-4 font-semibold">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Sending" /> : <><span className="hidden sm:inline">Send</span><Send className="h-4 w-4 sm:hidden" /></>}
                  </Button>
                </div>
                <p id="message-composer-hint" className="mx-auto mt-1.5 max-w-3xl px-2 text-[10px] text-muted-foreground">Enter to send · Shift + Enter for a new line</p>
              </form>
            </>
          ) : (
            <div className="hidden h-full flex-col items-center justify-center px-6 text-center md:flex">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/25 text-primary"><MessageCircle className="h-9 w-9" /></div>
              <h2 className="mt-5 text-xl font-semibold">Your messages</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Select a conversation or start a new message with a friend.</p>
              <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={() => setShowNewMessage(true)}>New message</Button>
            </div>
          )}
        </section>
      </section>

      <Dialog open={showNewMessage} onOpenChange={(open) => { setShowNewMessage(open); if (!open) setNewMessageSearch(""); }}>
        <DialogContent className="max-h-[85dvh] overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border px-5 py-4 text-left"><DialogTitle>New message</DialogTitle></DialogHeader>
          <div className="p-4"><Input autoFocus value={newMessageSearch} onChange={(event) => setNewMessageSearch(event.target.value)} placeholder="Search your friends" aria-label="Search friends for a new message" className="rounded-xl bg-muted/50" /></div>
          <ScrollArea className="max-h-[55dvh] px-2 pb-3">
            {friendsLoading ? <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading friends…</div> : friends.length === 0 ? <EmptyInbox title="No friends to message" description="Add friends first, then start a conversation here." actionLabel="Find friends" onAction={() => { setShowNewMessage(false); navigate("/friends"); }} /> : filteredNewMessageFriends.length === 0 ? <EmptyInbox title="No friends match that search" description="Try another name or username." /> : (
              <div className="space-y-1">
                {filteredNewMessageFriends.map((friend) => (
                  <button key={friend.id} type="button" onClick={() => selectDirectFromModal(friend)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <AvatarRenderer avatar={friend.avatar} size="sm" className="h-10 w-10" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{friend.name}</span><span className="block truncate text-xs text-muted-foreground">{friend.username ? `@${friend.username}` : "Friend"}</span></span>
                    {isOnline(friend.id) && <span className="text-xs text-emerald-600">Active</span>}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create a group chat</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Input autoFocus value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Group name" aria-label="Group name" />
            <div className="flex flex-wrap gap-2">
              {["group", "private", "public", "class"].map((type) => <Button key={type} type="button" size="sm" variant={newGroupType === type ? "default" : "outline"} className="capitalize" onClick={() => setNewGroupType(type)}>{type}</Button>)}
            </div>
            <Button type="button" className="w-full rounded-full" onClick={() => void createGroup()} disabled={!newGroupName.trim()}>Create group</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFindGroup} onOpenChange={setShowFindGroup}>
        <DialogContent className="max-h-[85dvh] overflow-hidden sm:max-w-md">
          <DialogHeader><DialogTitle>Find a group</DialogTitle></DialogHeader>
          <Input autoFocus value={groupQuery} onChange={(event) => void searchGroups(event.target.value)} placeholder="Search public groups" aria-label="Search public groups" />
          <ScrollArea className="max-h-[55dvh]">
            {groupResults.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Type at least two characters to search open groups.</p> : <div className="space-y-1">
              {groupResults.map((room) => {
                const joinedRoom = rooms.find((memberRoom) => memberRoom.id === room.id);
                return <div key={room.id} className="flex items-center gap-3 rounded-xl p-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Users className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{room.name}</span><span className="text-xs capitalize text-muted-foreground">{room.group_type}</span></span>
                  {joinedRoom ? <Button type="button" size="sm" variant="outline" onClick={() => { setShowFindGroup(false); selectRoom(joinedRoom); }}>Open</Button> : <Button type="button" size="sm" onClick={() => void joinGroup(room)}>Join</Button>}
                </div>;
              })}
            </div>}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>People in {activeRoom?.name || "this group"}</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-[60dvh]">
            <div className="space-y-1">
              {activeRoomMembers.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-xl p-2.5">
                <AvatarRenderer avatar={member.avatar} size="sm" className="h-10 w-10" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{member.name}</span><span className="text-xs capitalize text-muted-foreground">{member.role}</span></span>
                {member.user_id === user?.id && <Badge variant="secondary">You</Badge>}
              </div>)}
              {activeRoomMembers.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No member details available.</p>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </main>
  );
};

const EmptyInbox = ({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className="flex flex-col items-center px-5 py-12 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><MessageCircle className="h-5 w-5" /></span>
    <p className="mt-3 text-sm font-semibold">{title}</p>
    <p className="mt-1 max-w-[17rem] text-xs leading-5 text-muted-foreground">{description}</p>
    {actionLabel && onAction && <Button type="button" variant="link" className="mt-2" onClick={onAction}>{actionLabel}</Button>}
  </div>
);

const DirectMessageBubble = ({ message, isMine }: { message: DirectMessage; isMine: boolean }) => (
  <div className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}>
    <div className="max-w-[min(82%,42rem)]">
      <div className={cn("rounded-[1.4rem] px-4 py-2.5 text-[15px] leading-6 shadow-sm", isMine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground")}>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
      <div className={cn("mt-1 flex items-center gap-1 px-2 text-[10px] text-muted-foreground", isMine && "justify-end")}>
        <span>{formatTime(message.timestamp)}</span>
        {isMine && (message.read ? <><CheckCheck className="h-3 w-3 text-primary" /><span>Seen</span></> : <><Check className="h-3 w-3" /><span>Sent</span></>)}
      </div>
    </div>
  </div>
);

const GroupMessageBubble = ({ message, isMine, onReply }: { message: GroupMessage; isMine: boolean; onReply: () => void }) => (
  <div className={cn("group flex w-full items-end gap-2", isMine ? "justify-end" : "justify-start")}>
    {!isMine && <span className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs">{message.senderAvatar}</span>}
    <div className="max-w-[min(82%,42rem)]">
      {!isMine && <p className="mb-1 px-2 text-[11px] font-semibold text-muted-foreground">{message.senderName}</p>}
      {message.replyTo && <div className={cn("mb-1 rounded-t-xl border-l-2 border-primary/60 px-3 py-1.5 text-xs", isMine ? "bg-primary/10" : "bg-muted/60")}><span className="font-semibold">{message.replyTo.senderName}</span><p className="truncate text-muted-foreground">{message.replyTo.content}</p></div>}
      <div className="flex items-end gap-1.5">
        {!isMine && <button type="button" onClick={onReply} aria-label="Reply to message" className="mb-1 rounded-full p-1.5 text-muted-foreground opacity-100 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100"><MessageCircle className="h-3.5 w-3.5" /></button>}
        <div className={cn("rounded-[1.4rem] px-4 py-2.5 text-[15px] leading-6", isMine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground")}><p className="whitespace-pre-wrap break-words">{message.content}</p></div>
        {isMine && <button type="button" onClick={onReply} aria-label="Reply to message" className="mb-1 rounded-full p-1.5 text-muted-foreground opacity-100 transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100"><MessageCircle className="h-3.5 w-3.5" /></button>}
      </div>
      <p className={cn("mt-1 px-2 text-[10px] text-muted-foreground", isMine && "text-right")}>{formatTime(message.created_at)}</p>
    </div>
  </div>
);

export default Chat;
