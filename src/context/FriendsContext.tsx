import { db } from "@/integrations/untypedClient";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser, UserProfile } from './UserContext';
import { toast } from 'sonner';
import { useCommunityTerms } from '@/context/CommunityTermsContext';

export type FriendStatus = "pending" | "accepted" | "declined";

export interface FriendRequest {
  id: string;
  sender: UserProfile;
  receiver: UserProfile;
  status: FriendStatus;
  timestamp: Date;
  isOutgoing: boolean;
}

export interface Message {
  id: string;
  sender: string;
  receiver: string;
  content: string;
  read: boolean;
  timestamp: Date;
}

export interface FriendPresence {
  status: string;
  lastSeen: string | null;
}

interface FriendsContextType {
  friends: UserProfile[];
  friendRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  messages: Message[];
  loading: boolean;
  sendFriendRequest: (userId: string) => Promise<boolean>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  sendMessage: (userId: string, content: string) => Promise<boolean>;
  markMessageAsRead: (messageId: string) => void;
  getMessagesWithUser: (userId: string) => Message[];
  getFriendById: (userId: string) => UserProfile | undefined;
  searchUsers: (query: string) => Promise<UserProfile[]>;
  onlineFriends: UserProfile[];
  friendPresence: Record<string, FriendPresence>;
  refreshFriends: () => Promise<void>;
  isPendingRequest: (userId: string) => boolean;
}

const getDisplayName = (profile: { name?: string | null; username?: string | null } | undefined, userId: string) => {
  const trimmedName = profile?.name?.trim();
  if (trimmedName) return trimmedName;

  const trimmedUsername = profile?.username?.trim();
  if (trimmedUsername) return trimmedUsername;

  return `User ${userId.slice(0, 8)}`;
};

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const FriendsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const { runWithCommunityTerms } = useCommunityTerms();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineFriends, setOnlineFriends] = useState<UserProfile[]>([]);
  const [friendPresence, setFriendPresence] = useState<Record<string, FriendPresence>>({});

  const fetchFriends = useCallback(async () => {
    if (!user?.id) {
      setFriends([]);
      setFriendRequests([]);
      setOutgoingRequests([]);
      setFriendPresence({});
      setLoading(false);
      return;
    }

    try {
      // Fetch ALL friendships involving this user
      const { data: allFriendships, error: friendshipsError } = await db
        .from('friends')
        .select('*')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (friendshipsError) throw friendshipsError;

      // Separate accepted, incoming pending, and outgoing pending
      const acceptedFriendships = (allFriendships || []).filter(f => f.status === 'accepted');
      const incomingPending = (allFriendships || []).filter(f => f.status === 'pending' && f.friend_id === user.id);
      const outgoingPending = (allFriendships || []).filter(f => f.status === 'pending' && f.user_id === user.id);

      // Get all user IDs we need to fetch profiles for
      const friendIdsFromAccepted = acceptedFriendships.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      const senderIds = incomingPending.map(r => r.user_id);
      const receiverIds = outgoingPending.map(r => r.friend_id);
      
      const allUserIds = [...new Set([...friendIdsFromAccepted, ...senderIds, ...receiverIds])];

      const profilesMap = new Map<string, any>();
      const presenceMap = new Map<string, FriendPresence>();

      if (allUserIds.length > 0) {
        // Fetch all profiles at once
        const { data: profiles } = await (supabase as any)
          .rpc('get_friend_profiles', { _user_ids: allUserIds });

        profiles?.forEach(p => profilesMap.set(p.id, p));

        // Fetch presence
        const { data: presenceData } = await db
          .from('user_presence')
          .select('user_id, status, last_seen')
          .in('user_id', friendIdsFromAccepted);

        presenceData?.forEach(p => {
          presenceMap.set(p.user_id, {
            status: p.status || 'offline',
            lastSeen: p.last_seen || null,
          });
        });
      }

      // Map accepted friends
      const mappedFriends: UserProfile[] = acceptedFriendships.map(f => {
        const friendId = f.user_id === user.id ? f.friend_id : f.user_id;
        const profile = profilesMap.get(friendId);
        return {
          id: friendId,
          name: getDisplayName(profile, friendId),
          username: profile?.username || '',
          email: '',
          role: 'student',
          xp: profile?.xp || 0,
          level: profile?.level || 1,
          avatar: profile?.avatar || 'avatar-1',
          friendshipId: f.id
        } as UserProfile & { friendshipId?: string };
      });

      setFriends(mappedFriends);
      const now = Date.now();
      setOnlineFriends(mappedFriends.filter(f => {
        const presence = presenceMap.get(f.id);
        if (!presence || presence.status !== 'online' || !presence.lastSeen) return false;
        return now - new Date(presence.lastSeen).getTime() < 5 * 60 * 1000;
      }));
      setFriendPresence(Object.fromEntries(presenceMap.entries()));

      // Map incoming pending requests
      const mappedIncoming: FriendRequest[] = incomingPending.map(r => {
        const sender = profilesMap.get(r.user_id);
        return {
          id: r.id,
          sender: {
            id: r.user_id,
            name: getDisplayName(sender, r.user_id),
            username: sender?.username || '',
            email: '',
            role: 'student',
            avatar: sender?.avatar || 'avatar-1',
            level: sender?.level || 1,
            xp: sender?.xp || 0
          } as UserProfile,
          receiver: user as UserProfile,
          status: r.status as FriendStatus,
          timestamp: new Date(r.created_at),
          isOutgoing: false
        };
      });
      setFriendRequests(mappedIncoming);

      // Map outgoing pending requests
      const mappedOutgoing: FriendRequest[] = outgoingPending.map(r => {
        const receiver = profilesMap.get(r.friend_id);
        return {
          id: r.id,
          sender: user as UserProfile,
          receiver: {
            id: r.friend_id,
            name: getDisplayName(receiver, r.friend_id),
            username: receiver?.username || '',
            email: '',
            role: 'student',
            avatar: receiver?.avatar || 'avatar-1',
            level: receiver?.level || 1,
            xp: receiver?.xp || 0
          } as UserProfile,
          status: r.status as FriendStatus,
          timestamp: new Date(r.created_at),
          isOutgoing: true
        };
      });
      setOutgoingRequests(mappedOutgoing);

      // Fetch messages
      const { data: messagesData, error: messagesError } = await db
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true })
        .limit(500);

      if (messagesError) throw messagesError;

      setMessages((messagesData || []).map(m => ({
        id: m.id,
        sender: m.sender_id,
        receiver: m.receiver_id,
        content: m.content,
        read: m.read || false,
        timestamp: new Date(m.created_at)
      })));

    } catch (err) {
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user]);

  // Keep real online presence fresh while the authenticated app is open.
  useEffect(() => {
    if (!user?.id) return;
    let disposed = false;
    const publishPresence = async (status: "online" | "offline") => {
      if (disposed) return;
      const payload = { user_id: user.id, status, last_seen: new Date().toISOString() };
      const { error } = await (supabase as any).from("user_presence").upsert(payload, { onConflict: "user_id" });
      if (error && status === "online") console.warn("Could not update online presence", error.message);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void publishPresence("online");
    };
    void publishPresence("online");
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") void publishPresence("online");
    }, 30000);
    document.addEventListener("visibilitychange", onVisibility);
    const onPageHide = () => { void publishPresence("offline"); };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      disposed = true;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void (supabase as any).from("user_presence").upsert(
        { user_id: user.id, status: "offline", last_seen: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    };
  }, [user?.id]);

  useEffect(() => {
    fetchFriends();

    // Set up realtime subscription for both directions with recovery/resync.
    if (user?.id) {
      let disposed = false;
      let refreshTimer: number | undefined;
      const scheduleRefresh = () => {
        if (disposed) return;
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => { void fetchFriends(); }, 250);
      };
      const channel = supabase
        .channel('friends-realtime-full')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages'
        }, (payload) => {
          const msg = payload.new as any;
          if (msg && (msg.sender_id === user.id || msg.receiver_id === user.id)) {
            if (payload.eventType === 'INSERT') {
              setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, {
                  id: msg.id,
                  sender: msg.sender_id,
                  receiver: msg.receiver_id,
                  content: msg.content,
                  read: msg.read || false,
                  timestamp: new Date(msg.created_at)
                }].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
              });
            } else if (payload.eventType === 'UPDATE' && msg.id) {
              setMessages(prev => prev.map(message => message.id === msg.id
                ? { ...message, read: msg.read ?? message.read }
                : message));
            }
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friends'
        }, () => {
          scheduleRefresh();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        }, () => {
          scheduleRefresh();
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            scheduleRefresh();
            if (!disposed) window.setTimeout(() => { if (!disposed) channel.subscribe(); }, 1000);
          }
        });

      const onVisibility = () => {
        if (document.visibilityState === 'visible') scheduleRefresh();
      };
      const onOnline = () => scheduleRefresh();
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('online', onOnline);

      return () => {
        disposed = true;
        if (refreshTimer) window.clearTimeout(refreshTimer);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('online', onOnline);
        supabase.removeChannel(channel);
      };
    }
  }, [fetchFriends, user?.id]);

  const isPendingRequest = (userId: string): boolean => {
    return outgoingRequests.some(r => r.receiver.id === userId) ||
           friendRequests.some(r => r.sender.id === userId);
  };

  const searchUsers = useCallback(async (query: string): Promise<UserProfile[]> => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return [];

    let results: UserProfile[] = [];
    try {
      // Check guardian eligibility separately so a disabled feature is never
      // presented as though the searched username does not exist.
      const { data: featureEnabled, error: featureError } = await (supabase as any).rpc(
        'is_current_user_feature_enabled',
        { p_feature: 'friend_requests' }
      );
      if (featureError) throw featureError;
      if (featureEnabled !== true) {
        throw new Error('Friend search is disabled by Parent Controls. Ask your parent or guardian to enable Social and Friend Requests for this account.');
      }

      const allowed = await runWithCommunityTerms(async () => {
        // Student discovery uses its own guardian-safe RPC. Keep the existing
        // staff-scoped lookup for teacher/admin workflows unchanged.
        const discoveryRpc = user?.role === 'student'
          ? 'search_students_for_friend_requests'
          : 'find_student_by_username';
        const { data, error } = await db
          .rpc(discoveryRpc, { _username: normalizedQuery });

        if (error) throw error;

        results = (data || [])
          .filter((u: any) => u.id !== user?.id)
          .map((u: any) => ({
            id: u.id,
            name: getDisplayName(u, u.id),
            username: u.username || '',
            email: '',
            role: 'student',
            avatar: u.avatar || 'avatar-1',
            level: u.level || 1,
            xp: u.xp || 0
          } as UserProfile));
      }, 'friend_requests');

      if (!allowed) return [];
      return results;
    } catch (err) {
      console.error('Error searching users:', err);
      throw err;
    }
  }, [user?.id, user?.role, runWithCommunityTerms]);

  const sendFriendRequest = async (targetUserId: string): Promise<boolean> => {
    if (!user?.id || !targetUserId || targetUserId === user.id) return false;
    let succeeded = false;
    await runWithCommunityTerms(async () => {
      try {
        const { error } = await db.rpc('send_friend_request', { p_target_user_id: targetUserId });
        if (error) throw error;
        const { data: request } = await db.from('friends').select('id')
          .eq('user_id', user.id).eq('friend_id', targetUserId).eq('status', 'pending')
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (request?.id) {
          const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
            body: { kind: 'friend_request', event_id: request.id },
          });
          if (pushError) console.warn('Friend request push could not be sent:', pushError.message);
        }
        toast.success('Friend request sent!');
        succeeded = true;
        await fetchFriends();
      } catch (err: any) {
        toast.error(err?.message?.includes('already') ? 'Friend request already exists' : err?.message || 'Failed to send friend request');
      }
    }, 'friend_requests');
    return succeeded;
  };

  const acceptFriendRequest = async (requestId: string) => {
    await runWithCommunityTerms(async () => {
      try {
        const { error } = await db.rpc('respond_friend_request', { p_request_id: requestId, p_accept: true });
        if (error) throw error;
        toast.success('Friend request accepted!');
        await fetchFriends();
      } catch (err: any) {
        console.error('Error accepting friend request:', err);
        toast.error(err?.message || 'Failed to accept friend request');
      }
    }, 'friend_requests');
  };

  const declineFriendRequest = async (requestId: string) => {
    try {
      const { error } = await db.rpc('respond_friend_request', { p_request_id: requestId, p_accept: false });
      if (error) throw error;
      toast.info('Friend request declined');
      await fetchFriends();
    } catch (err) {
      console.error('Error declining friend request:', err);
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      const { error } = await db.rpc('remove_friend', { p_friendship_id: friendshipId });
      if (error) throw error;
      toast.info('Friend removed');
      await fetchFriends();
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  const sendMessage = async (receiverId: string, content: string): Promise<boolean> => {
    if (!user?.id || !receiverId || !content.trim()) return false;
    let succeeded = false;
    await runWithCommunityTerms(async () => {
      try {
        const { data, error } = await db.rpc('send_direct_message', {
          p_receiver_id: receiverId,
          p_content: content.trim(),
        });
        if (error) throw error;
        if (data) {
          setMessages(prev => {
            if (prev.some(message => message.id === data.id)) return prev;
            return [...prev, {
              id: data.id,
              sender: data.sender_id,
              receiver: data.receiver_id,
              content: data.content,
              read: false,
              timestamp: new Date(data.created_at)
            }].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          });
          const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
            body: { kind: 'direct_message', event_id: data.id },
          });
          if (pushError) console.warn('Message push could not be sent:', pushError.message);
          succeeded = true;
        } else {
          throw new Error('The message was not saved. Please try again.');
        }
      } catch (err: any) {
        console.error('Error sending message:', err);
        toast.error(err?.message || 'Failed to send message');
      }
    }, 'direct_messages');
    return succeeded;
  };

  const markMessageAsRead = (messageId: string) => {
    void db.rpc('mark_direct_message_read', { p_message_id: messageId }).then(({ error }) => {
      if (error) {
        console.warn('Could not mark direct message as read:', error.message);
        return;
      }
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
    });
  };

  const getMessagesWithUser = (userId: string) => {
    if (!user) return [];
    return messages.filter(
      msg => 
        (msg.sender === user.id && msg.receiver === userId) || 
        (msg.sender === userId && msg.receiver === user.id)
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  const getFriendById = (userId: string) => {
    return friends.find(friend => friend.id === userId);
  };

  const refreshFriends = async () => {
    await fetchFriends();
  };

  return (
    <FriendsContext.Provider
      value={{
        friends,
        friendRequests,
        outgoingRequests,
        messages,
        loading,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        removeFriend,
        sendMessage,
        markMessageAsRead,
        getMessagesWithUser,
        getFriendById,
        searchUsers,
        onlineFriends,
        friendPresence,
        refreshFriends,
        isPendingRequest
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
};

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (context === undefined) {
    throw new Error("useFriends must be used within a FriendsProvider");
  }
  return context;
};
