import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Send, UserPlus, Check, X, Users, Home, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFriends, FriendRequest } from "@/context/FriendsContext";
import { useUser, UserProfile } from "@/context/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { avatarToEmoji } from "@/utils/avatarUtils";
import BackButton from "@/components/ui/BackButton";
import { motion } from "framer-motion";

const Friends: React.FC = () => {
  const { user } = useUser();
  const { 
    friends, 
    friendRequests, 
    messages,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    getMessagesWithUser,
    sendMessage,
    markMessageAsRead 
  } = useFriends();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<string>("friends");
  const [selectedFriend, setSelectedFriend] = useState<UserProfile | null>(null);
  const [messageInput, setMessageInput] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedFriend, messages]);
  
  // Filter friends and requests based on search
  const filteredFriends = friends.filter(friend => 
    friend.name.toLowerCase().includes(searchInput.toLowerCase())
  );
  
  const pendingRequests = friendRequests.filter(
    req => req.status === "pending" && req.receiver.id === user?.id
  );
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFriend && messageInput.trim()) {
      sendMessage(selectedFriend.id, messageInput);
      setMessageInput("");
    }
  };
  
  const handleSelectFriend = (friend: UserProfile) => {
    setSelectedFriend(friend);
    // Mark unread messages as read
    const conversation = getMessagesWithUser(friend.id);
    conversation
      .filter(msg => msg.sender === friend.id && !msg.read)
      .forEach(msg => markMessageAsRead(msg.id));
  };
  
  const getUnreadMessageCount = (friendId: string) => {
    return messages.filter(
      msg => msg.sender === friendId && msg.receiver === user?.id && !msg.read
    ).length;
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 px-4 py-3 shadow-xl">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <BackButton to="/" className="text-white hover:bg-white/20" />
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-2">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Friends & Messages</h1>
              <p className="text-xs text-white/70">{friends.length} friends online</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate("/")} className="gap-2">
            <Home className="h-4 w-4" /> Menu
          </Button>
        </div>
      </header>

      <div className="flex flex-col flex-1 md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-1/3 border-r">
          <Tabs 
            defaultValue="friends" 
            className="w-full"
            onValueChange={setActiveTab}
          >
            <div className="p-3 border-b">
              <Input
                placeholder="Search friends..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full"
              />
            </div>
            
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="friends">
                Friends
                {filteredFriends.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {filteredFriends.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="requests">
                Requests
                {pendingRequests.length > 0 && (
                  <Badge className="ml-2 bg-red-500">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="friends" className="m-0">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="divide-y">
                  {filteredFriends.length > 0 ? (
                    filteredFriends.map((friend) => (
                      <div 
                        key={friend.id}
                        onClick={() => handleSelectFriend(friend)}
                        className={`flex items-center p-3 hover:bg-gray-100 cursor-pointer ${
                          selectedFriend?.id === friend.id ? 'bg-gray-100' : ''
                        }`}
                      >
                        <Avatar className="h-10 w-10 mr-3">
                          <AvatarFallback>
                            {avatarToEmoji(friend.avatar)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium">{friend.name}</div>
                          <div className="text-xs text-gray-500">
                            Grade {friend.grade} • {friend.educationLevel}
                          </div>
                        </div>
                        {getUnreadMessageCount(friend.id) > 0 && (
                          <Badge className="bg-primary">
                            {getUnreadMessageCount(friend.id)}
                          </Badge>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      {searchInput ? "No friends match your search" : "No friends yet"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="requests" className="m-0">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="divide-y">
                  {pendingRequests.length > 0 ? (
                    pendingRequests.map((request) => (
                      <FriendRequestItem 
                        key={request.id}
                        request={request}
                        onAccept={acceptFriendRequest}
                        onDecline={declineFriendRequest}
                      />
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No friend requests
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedFriend ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center p-3 border-b bg-white">
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarFallback>
                    {avatarToEmoji(selectedFriend.avatar)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{selectedFriend.name}</div>
                  <div className="text-xs text-gray-500">
                    Level {selectedFriend.level} • {selectedFriend.xp} XP
                  </div>
                </div>
              </div>
              
              {/* Messages */}
              <ScrollArea className="flex-1 p-4 bg-gray-50">
                <div className="space-y-3">
                  {getMessagesWithUser(selectedFriend.id).map((msg) => (
                    <div 
                      key={msg.id}
                      className={`flex ${msg.sender === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[70%] px-3 py-2 rounded-lg ${
                          msg.sender === user?.id 
                            ? 'bg-primary text-white' 
                            : 'bg-white border'
                        }`}
                      >
                        <div>{msg.content}</div>
                        <div className={`text-xs mt-1 ${
                          msg.sender === user?.id ? 'text-primary-light' : 'text-gray-500'
                        }`}>
                          {formatTime(msg.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {/* Message Input */}
              <div className="p-3 border-t bg-white">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!messageInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
              {activeTab === "friends" ? (
                <>
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-xl font-medium mb-2">Select a friend to start chatting</h3>
                  <p className="text-center mb-4">
                    Send messages, share quiz results, and challenge friends to multiplayer matches!
                  </p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">👋</div>
                  <h3 className="text-xl font-medium mb-2">Friend Requests</h3>
                  <p className="text-center">
                    Accept or decline friend requests from other students
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Friend Request Item Component
interface FriendRequestItemProps {
  request: FriendRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

const FriendRequestItem: React.FC<FriendRequestItemProps> = ({ 
  request, 
  onAccept, 
  onDecline 
}) => {
  return (
    <div className="flex items-center p-3">
      <Avatar className="h-10 w-10 mr-3">
        <AvatarFallback>
          {avatarToEmoji(request.sender.avatar)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="font-medium">{request.sender.name}</div>
        <div className="text-xs text-gray-500">
          Grade {request.sender.grade} • {request.sender.educationLevel}
        </div>
      </div>
      <div className="flex gap-2">
        <Button 
          size="sm" 
          className="bg-green-500 hover:bg-green-600"
          onClick={() => onAccept(request.id)}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="destructive"
          onClick={() => onDecline(request.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Friends;
