import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser, UserProfile } from './UserContext';
import { toast } from 'sonner';

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

interface FriendsContextType {
  friends: UserProfile[];
  friendRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  messages: Message[];
  loading: boolean;
  sendFriendRequest: (userId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  declineFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  sendMessage: (userId: string, content: string) => Promise<void>;
  markMessageAsRead: (messageId: string) => void;
  getMessagesWithUser: (userId: string) => Message[];
  getFriendById: (userId: string) => UserProfile | undefined;
  searchUsers: (query: string) => Promise<UserProfile[]>;
  onlineFriends: UserProfile[];
  refreshFriends: () => Promise<void>;
  isPendingRequest: (userId: string) => boolean;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const FriendsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineFriends, setOnlineFriends] = useState<UserProfile[]>([]);

  const fetchFriends = useCallback(async () => {
    if (!user?.id) {
      setFriends([]);
      setFriendRequests([]);
      setOutgoingRequests([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch ALL friendships involving this user
      const { data: allFriendships, error: friendshipsError } = await supabase
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

      let profilesMap = new Map<string, any>();
      let presenceMap = new Map<string, string>();

      if (allUserIds.length > 0) {
        // Fetch all profiles at once
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar, level, xp')
          .in('id', allUserIds);

        profiles?.forEach(p => profilesMap.set(p.id, p));

        // Fetch presence
        const { data: presenceData } = await supabase
          .from('user_presence')
          .select('user_id, status')
          .in('user_id', friendIdsFromAccepted);

        presenceData?.forEach(p => presenceMap.set(p.user_id, p.status));
      }

      // Map accepted friends
      const mappedFriends: UserProfile[] = acceptedFriendships.map(f => {
        const friendId = f.user_id === user.id ? f.friend_id : f.user_id;
        const profile = profilesMap.get(friendId);
        return {
          id: friendId,
          name: profile?.name || 'Unknown',
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
      setOnlineFriends(mappedFriends.filter(f => presenceMap.get(f.id) === 'online'));

      // Map incoming pending requests
      const mappedIncoming: FriendRequest[] = incomingPending.map(r => {
        const sender = profilesMap.get(r.user_id);
        return {
          id: r.id,
          sender: {
            id: r.user_id,
            name: sender?.name || 'Unknown',
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
            name: receiver?.name || 'Unknown',
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
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

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

  useEffect(() => {
    fetchFriends();

    // Set up realtime subscription for both directions
    if (user?.id) {
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
                }];
              });
            }
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friends'
        }, () => {
          // Refresh on any friends table change
          fetchFriends();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchFriends, user?.id]);

  const isPendingRequest = (userId: string): boolean => {
    return outgoingRequests.some(r => r.receiver.id === userId) ||
           friendRequests.some(r => r.sender.id === userId);
  };

  const searchUsers = async (query: string): Promise<UserProfile[]> => {
    if (!query.trim()) return [];
    
    try {
      const { data, error } = await supabase
        .rpc('find_student_by_username', { search_username: query });
      
      if (error) throw error;
      
      return (data || [])
        .filter((u: any) => u.id !== user?.id)
        .map((u: any) => ({
          id: u.id,
          name: u.name || 'Unknown',
          username: u.username || '',
          email: '',
          role: 'student',
          avatar: u.avatar || 'avatar-1',
          level: u.level || 1,
          xp: u.xp || 0
        } as UserProfile));
    } catch (err) {
      console.error('Error searching users:', err);
      return [];
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!user?.id) return;

    try {
      // Check if friendship already exists
      const { data: existing } = await supabase
        .from('friends')
        .select('id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`)
        .single();

      if (existing) {
        if (existing.status === 'accepted') {
          toast.info('You are already friends!');
        } else {
          toast.info('Friend request already exists');
        }
        return;
      }

      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: targetUserId,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Friend request sent!');
      await fetchFriends();
    } catch (err: any) {
      if (err.code === '23505') {
        toast.error('Friend request already exists');
      } else {
        console.error('Error sending friend request:', err);
        toast.error('Failed to send friend request');
      }
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    try {
      // Verify this request is for the current user (they are the receiver)
      const { data: request, error: fetchError } = await supabase
        .from('friends')
        .select('*')
        .eq('id', requestId)
        .eq('friend_id', user?.id)
        .eq('status', 'pending')
        .single();

      if (fetchError || !request) {
        toast.error('Invalid request or already processed');
        return;
      }

      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Friend request accepted!');
      await fetchFriends();
    } catch (err) {
      console.error('Error accepting friend request:', err);
      toast.error('Failed to accept friend request');
    }
  };

  const declineFriendRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.info('Friend request declined');
      await fetchFriends();
    } catch (err) {
      console.error('Error declining friend request:', err);
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      toast.info('Friend removed');
      await fetchFriends();
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  const sendMessage = async (receiverId: string, content: string) => {
    if (!user?.id || !content.trim()) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: content.trim()
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state immediately
      if (data) {
        setMessages(prev => [...prev, {
          id: data.id,
          sender: data.sender_id,
          receiver: data.receiver_id,
          content: data.content,
          read: false,
          timestamp: new Date(data.created_at)
        }]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    }
  };

  const markMessageAsRead = (messageId: string) => {
    supabase
      .from('messages')
      .update({ read: true })
      .eq('id', messageId)
      .then(() => {
        setMessages(prev => prev.map(m => 
          m.id === messageId ? { ...m, read: true } : m
        ));
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
