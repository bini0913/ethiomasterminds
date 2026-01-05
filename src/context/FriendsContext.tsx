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
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const FriendsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineFriends, setOnlineFriends] = useState<UserProfile[]>([]);

  const fetchFriends = useCallback(async () => {
    if (!user?.id) {
      setFriends([]);
      setFriendRequests([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch accepted friendships
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendshipsError) throw friendshipsError;

      // Get friend IDs
      const friendIds = (friendships || []).map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );

      if (friendIds.length > 0) {
        // Fetch friend profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, username, avatar, level, xp')
          .in('id', friendIds);

        if (profilesError) throw profilesError;

        // Fetch presence
        const { data: presenceData } = await supabase
          .from('user_presence')
          .select('user_id, status')
          .in('user_id', friendIds);

        const presenceMap = new Map(presenceData?.map(p => [p.user_id, p.status]) || []);

        const mappedFriends: UserProfile[] = (profiles || []).map(p => {
          const friendship = friendships?.find(f => f.user_id === p.id || f.friend_id === p.id);
          return {
            id: p.id,
            name: p.name || 'Unknown',
            username: p.username || '',
            email: '',
            role: 'student',
            xp: p.xp || 0,
            level: p.level || 1,
            avatar: p.avatar || 'avatar-1',
            friendshipId: friendship?.id
          } as UserProfile & { friendshipId?: string };
        });

        setFriends(mappedFriends);
        setOnlineFriends(mappedFriends.filter(f => presenceMap.get(f.id) === 'online'));
      } else {
        setFriends([]);
        setOnlineFriends([]);
      }

      // Fetch pending friend requests (where user is the receiver)
      const { data: requests, error: requestsError } = await supabase
        .from('friends')
        .select('*')
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (requestsError) throw requestsError;

      if (requests && requests.length > 0) {
        const senderIds = requests.map(r => r.user_id);
        const { data: senderProfiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar, level, xp')
          .in('id', senderIds);

        const mappedRequests: FriendRequest[] = requests.map(r => {
          const sender = senderProfiles?.find(p => p.id === r.user_id);
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
            timestamp: new Date(r.created_at)
          };
        });

        setFriendRequests(mappedRequests);
      } else {
        setFriendRequests([]);
      }

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

    // Set up realtime subscription
    if (user?.id) {
      const channel = supabase
        .channel('friends-realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        }, (payload) => {
          const newMsg = payload.new as any;
          setMessages(prev => [...prev, {
            id: newMsg.id,
            sender: newMsg.sender_id,
            receiver: newMsg.receiver_id,
            content: newMsg.content,
            read: newMsg.read || false,
            timestamp: new Date(newMsg.created_at)
          }]);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `friend_id=eq.${user.id}`
        }, () => {
          fetchFriends();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchFriends, user?.id]);

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
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          content: content.trim()
        });

      if (error) throw error;

      // Optimistically add to local state
      const newMessage: Message = {
        id: `temp-${Date.now()}`,
        sender: user.id,
        receiver: receiverId,
        content: content.trim(),
        read: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newMessage]);
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
        refreshFriends
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
