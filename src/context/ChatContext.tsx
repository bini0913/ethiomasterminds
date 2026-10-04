import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from './UserContext';
import { toast } from 'sonner';

export interface ChatGroup {
  id: string;
  name: string;
  description?: string;
  group_type: 'private' | 'class' | 'subject' | 'public';
  created_by: string;
  avatar_url?: string;
  created_at: string;
  member_count?: number;
  last_message?: GroupMessage;
  unread_count?: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  user_name?: string;
  user_avatar?: string;
  user_level?: number;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'system';
  attachment_url?: string;
  reply_to_id?: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

interface ChatContextType {
  groups: ChatGroup[];
  currentGroup: ChatGroup | null;
  messages: GroupMessage[];
  members: GroupMember[];
  loading: boolean;
  loadingMessages: boolean;
  setCurrentGroup: (group: ChatGroup | null) => void;
  createGroup: (name: string, description?: string, type?: string) => Promise<ChatGroup | null>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  sendMessage: (content: string, replyToId?: string) => Promise<void>;
  addMember: (groupId: string, userId: string) => Promise<void>;
  fetchGroups: () => Promise<void>;
  searchGroups: (query: string) => Promise<ChatGroup[]>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [currentGroup, setCurrentGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!user?.id) {
      setGroups([]);
      setLoading(false);
      return;
    }

    try {
      // Get groups where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('chat_group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const groupIds = memberData?.map(m => m.group_id) || [];

      if (groupIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const { data: groupsData, error: groupsError } = await supabase
        .from('chat_groups')
        .select('*')
        .in('id', groupIds)
        .order('updated_at', { ascending: false });

      if (groupsError) throw groupsError;

      // Get member counts
      const { data: countData } = await supabase
        .from('chat_group_members')
        .select('group_id')
        .in('group_id', groupIds);

      const countMap = new Map<string, number>();
      countData?.forEach(c => {
        countMap.set(c.group_id, (countMap.get(c.group_id) || 0) + 1);
      });

      const enrichedGroups: ChatGroup[] = (groupsData || []).map(g => ({
        ...g,
        group_type: g.group_type as ChatGroup['group_type'],
        member_count: countMap.get(g.id) || 0
      }));

      setGroups(enrichedGroups);
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchMessages = useCallback(async (groupId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .in('id', senderIds);

      const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]));

      const enrichedMessages: GroupMessage[] = (data || []).map(m => ({
        ...m,
        message_type: m.message_type as GroupMessage['message_type'],
        sender_name: profileMap.get(m.sender_id)?.name || 'Unknown',
        sender_avatar: profileMap.get(m.sender_id)?.avatar
      }));

      setMessages(enrichedMessages);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const fetchMembers = useCallback(async (groupId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_group_members')
        .select('*')
        .eq('group_id', groupId);

      if (error) throw error;

      const userIds = (data || []).map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar, level')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enrichedMembers: GroupMember[] = (data || []).map(m => ({
        ...m,
        role: m.role as GroupMember['role'],
        user_name: profileMap.get(m.user_id)?.name,
        user_avatar: profileMap.get(m.user_id)?.avatar,
        user_level: profileMap.get(m.user_id)?.level
      }));

      setMembers(enrichedMembers);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  }, []);

  // Fetch groups on mount and user change
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Fetch messages when current group changes
  useEffect(() => {
    if (currentGroup) {
      fetchMessages(currentGroup.id);
      fetchMembers(currentGroup.id);

      // Set up realtime subscription
      const channel = supabase
        .channel(`group-${currentGroup.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${currentGroup.id}`
        }, async (payload) => {
          const newMsg = payload.new as any;
          
          // Fetch sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, avatar')
            .eq('id', newMsg.sender_id)
            .single();

          const enrichedMsg: GroupMessage = {
            ...newMsg,
            message_type: newMsg.message_type as GroupMessage['message_type'],
            sender_name: profile?.name || 'Unknown',
            sender_avatar: profile?.avatar
          };

          setMessages(prev => {
            if (prev.some(m => m.id === enrichedMsg.id)) return prev;
            return [...prev, enrichedMsg];
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentGroup, fetchMessages, fetchMembers]);

  const createGroup = async (name: string, description?: string, type: string = 'private'): Promise<ChatGroup | null> => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('chat_groups')
        .insert({
          name,
          description,
          group_type: type,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as owner
      await supabase
        .from('chat_group_members')
        .insert({
          group_id: data.id,
          user_id: user.id,
          role: 'owner'
        });

      const newGroup: ChatGroup = {
        ...data,
        group_type: data.group_type as ChatGroup['group_type'],
        member_count: 1
      };

      setGroups(prev => [newGroup, ...prev]);
      toast.success('Group created!');
      return newGroup;
    } catch (err) {
      console.error('Error creating group:', err);
      toast.error('Failed to create group');
      return null;
    }
  };

  const joinGroup = async (groupId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('chat_group_members')
        .insert({
          group_id: groupId,
          user_id: user.id,
          role: 'member'
        });

      if (error) throw error;

      await fetchGroups();
      toast.success('Joined group!');
    } catch (err: any) {
      if (err.code === '23505') {
        toast.info('You are already a member of this group');
      } else {
        console.error('Error joining group:', err);
        toast.error('Failed to join group');
      }
    }
  };

  const leaveGroup = async (groupId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('chat_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (currentGroup?.id === groupId) {
        setCurrentGroup(null);
      }

      setGroups(prev => prev.filter(g => g.id !== groupId));
      toast.info('Left group');
    } catch (err) {
      console.error('Error leaving group:', err);
      toast.error('Failed to leave group');
    }
  };

  const sendMessage = async (content: string, replyToId?: string) => {
    if (!user?.id || !currentGroup || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: currentGroup.id,
          sender_id: user.id,
          content: content.trim(),
          message_type: 'text',
          reply_to_id: replyToId
        });

      if (error) throw error;

      // Update group's updated_at
      await supabase
        .from('chat_groups')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentGroup.id);
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    }
  };

  const addMember = async (groupId: string, userId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('chat_group_members')
        .insert({
          group_id: groupId,
          user_id: userId,
          role: 'member'
        });

      if (error) throw error;

      if (currentGroup?.id === groupId) {
        await fetchMembers(groupId);
      }
      toast.success('Member added!');
    } catch (err: any) {
      if (err.code === '23505') {
        toast.info('User is already a member');
      } else {
        console.error('Error adding member:', err);
        toast.error('Failed to add member');
      }
    }
  };

  const searchGroups = async (query: string): Promise<ChatGroup[]> => {
    if (!query.trim()) return [];

    try {
      const { data, error } = await supabase
        .from('chat_groups')
        .select('*')
        .or(`group_type.eq.public,group_type.eq.class`)
        .ilike('name', `%${query}%`)
        .limit(20);

      if (error) throw error;

      return (data || []).map(g => ({
        ...g,
        group_type: g.group_type as ChatGroup['group_type']
      }));
    } catch (err) {
      console.error('Error searching groups:', err);
      return [];
    }
  };

  return (
    <ChatContext.Provider
      value={{
        groups,
        currentGroup,
        messages,
        members,
        loading,
        loadingMessages,
        setCurrentGroup,
        createGroup,
        joinGroup,
        leaveGroup,
        sendMessage,
        addMember,
        fetchGroups,
        searchGroups
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
