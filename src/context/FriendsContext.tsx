
import React, { createContext, useContext, useState, ReactNode } from "react";
import { toast } from "sonner";
import { useUser, UserProfile } from "@/context/UserContext";

// Types
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
  sendFriendRequest: (userId: string) => void;
  acceptFriendRequest: (requestId: string) => void;
  declineFriendRequest: (requestId: string) => void;
  removeFriend: (userId: string) => void;
  sendMessage: (userId: string, content: string) => void;
  markMessageAsRead: (messageId: string) => void;
  getMessagesWithUser: (userId: string) => Message[];
  getFriendById: (userId: string) => UserProfile | undefined;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: UserProfile[] = [
  {
    id: "3",
    name: "Alex Johnson",
    email: "alex@example.com",
    role: "student",
    gender: "male",
    grade: "7",
    educationLevel: "middle",
    xp: 250,
    level: 3,
    avatar: "avatar-3",
  },
  {
    id: "4",
    name: "Sarah Williams",
    email: "sarah@example.com",
    role: "student",
    gender: "female",
    grade: "8",
    educationLevel: "middle",
    xp: 320,
    level: 4,
    avatar: "avatar-4",
  },
  {
    id: "5",
    name: "Michael Brown",
    email: "michael@example.com",
    role: "student",
    gender: "male",
    grade: "6",
    educationLevel: "middle",
    xp: 180,
    level: 2,
    avatar: "avatar-5",
  },
];

export const FriendsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [friends, setFriends] = useState<UserProfile[]>([mockUsers[0]]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([
    {
      id: "req1",
      sender: mockUsers[1],
      receiver: { ...user! },
      status: "pending",
      timestamp: new Date(),
    },
  ]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg1",
      sender: mockUsers[0].id,
      receiver: user?.id || "",
      content: "Hey there! How are you doing?",
      read: false,
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
    },
    {
      id: "msg2",
      sender: user?.id || "",
      receiver: mockUsers[0].id,
      content: "I'm doing well, thanks! Just finished a quiz.",
      read: true,
      timestamp: new Date(Date.now() - 3500000),
    },
    {
      id: "msg3",
      sender: mockUsers[0].id,
      receiver: user?.id || "",
      content: "That's great! What score did you get?",
      read: false,
      timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
    },
  ]);

  const sendFriendRequest = (userId: string) => {
    const targetUser = mockUsers.find(u => u.id === userId);
    if (!targetUser || !user) return;
    
    // Check if request already exists
    const existingRequest = friendRequests.find(
      req => 
        (req.sender.id === user.id && req.receiver.id === userId) || 
        (req.sender.id === userId && req.receiver.id === user.id)
    );
    
    if (existingRequest) {
      toast.error("Friend request already exists");
      return;
    }
    
    const newRequest: FriendRequest = {
      id: `req-${Date.now()}`,
      sender: { ...user },
      receiver: targetUser,
      status: "pending",
      timestamp: new Date(),
    };
    
    setFriendRequests(prev => [...prev, newRequest]);
    toast.success("Friend request sent!");
  };

  const acceptFriendRequest = (requestId: string) => {
    const request = friendRequests.find(req => req.id === requestId);
    if (!request) return;
    
    // Update request status
    setFriendRequests(prev => 
      prev.map(req => 
        req.id === requestId ? { ...req, status: "accepted" } : req
      )
    );
    
    // Add to friends list
    if (request.sender.id === user?.id) {
      setFriends(prev => [...prev, request.receiver]);
    } else {
      setFriends(prev => [...prev, request.sender]);
    }
    
    toast.success("Friend request accepted!");
  };

  const declineFriendRequest = (requestId: string) => {
    const request = friendRequests.find(req => req.id === requestId);
    if (!request) return;
    
    // Update request status
    setFriendRequests(prev => 
      prev.map(req => 
        req.id === requestId ? { ...req, status: "declined" } : req
      )
    );
    
    toast.info("Friend request declined");
  };

  const removeFriend = (userId: string) => {
    setFriends(prev => prev.filter(friend => friend.id !== userId));
    toast.success("Friend removed");
  };

  const sendMessage = (userId: string, content: string) => {
    if (!content.trim() || !user) return;
    
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: user.id,
      receiver: userId,
      content,
      read: false,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newMessage]);
  };

  const markMessageAsRead = (messageId: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, read: true } : msg
      )
    );
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

  return (
    <FriendsContext.Provider
      value={{
        friends,
        friendRequests,
        messages,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        removeFriend,
        sendMessage,
        markMessageAsRead,
        getMessagesWithUser,
        getFriendById,
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
