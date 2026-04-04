import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Send, UserPlus, Check, X, Users, Home, MessageCircle, Search, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFriends, FriendRequest } from "@/context/FriendsContext";
import { useUser, UserProfile } from "@/context/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import AvatarRenderer from "@/components/avatar/AvatarRenderer";
import BackButton from "@/components/ui/BackButton";
import { motion } from "framer-motion";
import { toast } from "sonner";

const Friends: React.FC = () => {
  const { user } = useUser();
  const { 
    friends, 
    friendRequests, 
    outgoingRequests,
    messages,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    getMessagesWithUser,
    sendMessage,
    markMessageAsRead,
    searchUsers
  } = useFriends();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<string>("friends");
  const [selectedFriend, setSelectedFriend] = useState<UserProfile | null>(null);
  const [messageInput, setMessageInput] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  
  // Add friend search state
  const [addFriendSearch, setAddFriendSearch] = useState<string>("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingSentRequests, setPendingSentRequests] = useState<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedFriend, messages]);

  // Track sent requests from outgoing requests
  useEffect(() => {
    const sentIds = new Set(outgoingRequests.map(r => r.receiver.id));
    setPendingSentRequests(sentIds);
  }, [outgoingRequests]);
  
  // Handle add friend search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (addFriendSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(addFriendSearch);
        // Filter out existing friends
        const friendIds = new Set(friends.map(f => f.id));
        const filteredResults = results.filter(u => !friendIds.has(u.id));
        setSearchResults(filteredResults);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [addFriendSearch, searchUsers, friends]);
  
  // Filter friends and requests based on search
  const filteredFriends = friends.filter(friend => 
    friend.name.toLowerCase().includes(searchInput.toLowerCase())
  );
  
  const pendingRequests = friendRequests.filter(
    req => req.status === "pending" && req.receiver.id === user?.id
  );

  const sentRequests = outgoingRequests.filter(
    req => req.status === "pending" && req.sender.id === user?.id
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

  const handleSendFriendRequest = async (targetUser: UserProfile) => {
    try {
      await sendFriendRequest(targetUser.id);
      setPendingSentRequests(prev => new Set([...prev, targetUser.id]));
    } catch (err) {
      console.error('Error sending friend request:', err);
    }
  };

  const isRequestPending = (userId: string) => {
    return pendingSentRequests.has(userId) || friends.some(f => f.id === userId);
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
              <p className="text-xs text-white/70">{friends.length} friends</p>
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
            
            <TabsList className="grid w-full grid-cols-3">
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
                {(pendingRequests.length + sentRequests.length) > 0 && (
                  <Badge className="ml-2 bg-red-500">
                    {pendingRequests.length + sentRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="add">
                <UserPlus className="h-4 w-4" />
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
                        className={`flex items-center p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                          selectedFriend?.id === friend.id ? 'bg-muted' : ''
                        }`}
                      >
                        <AvatarRenderer 
                          avatar={friend.avatar} 
                          size="md" 
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{friend.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Level {friend.level} • {friend.xp} XP
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
                    <div className="p-4 text-center text-muted-foreground">
                      {searchInput ? "No friends match your search" : "No friends yet. Add some!"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="requests" className="m-0">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="divide-y">
                  {pendingRequests.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                        Received Requests
                      </div>
                      {pendingRequests.map((request) => (
                        <FriendRequestItem 
                          key={request.id}
                          request={request}
                          onAccept={acceptFriendRequest}
                          onDecline={declineFriendRequest}
                        />
                      ))}
                    </>
                  )}

                  {sentRequests.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30 border-t">
                        Sent Requests
                      </div>
                      {sentRequests.map((request) => (
                        <div key={request.id} className="flex items-center p-3 gap-3">
                          <AvatarRenderer avatar={request.receiver.avatar} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{request.receiver.name}</p>
                            <p className="text-xs text-muted-foreground truncate">@{request.receiver.username || 'no-username'}</p>
                          </div>
                          <Badge variant="secondary">Pending</Badge>
                        </div>
                      ))}
                    </>
                  )}

                  {pendingRequests.length === 0 && sentRequests.length === 0 && (
                    <div className="p-4 text-center text-muted-foreground">
                      No friend requests
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Add Friends Tab */}
            <TabsContent value="add" className="m-0">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or username..."
                    value={addFriendSearch}
                    onChange={(e) => setAddFriendSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="divide-y">
                  {searching ? (
                    <div className="p-6 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground mt-2">Searching...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((resultUser) => (
                      <motion.div
                        key={resultUser.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center p-3 hover:bg-muted/50"
                      >
                        <AvatarRenderer 
                          avatar={resultUser.avatar} 
                          size="md" 
                          className="mr-3"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{resultUser.name}</div>
                          <div className="text-xs text-muted-foreground">
                            @{resultUser.username} • Level {resultUser.level}
                          </div>
                        </div>
                        {isRequestPending(resultUser.id) ? (
                          <Badge variant="secondary">
                            {friends.some(f => f.id === resultUser.id) ? 'Friends' : 'Pending'}
                          </Badge>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => handleSendFriendRequest(resultUser)}
                            className="gap-1"
                          >
                            <UserPlus className="h-4 w-4" />
                            Add
                          </Button>
                        )}
                      </motion.div>
                    ))
                  ) : addFriendSearch.length >= 2 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No users found matching "{addFriendSearch}"
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <UserPlus className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                      <h3 className="font-medium text-foreground mb-1">Find New Friends</h3>
                      <p className="text-sm text-muted-foreground">
                        Search for users by name or username to send friend requests
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-muted/20">
          {selectedFriend ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center p-3 border-b bg-card">
                <AvatarRenderer 
                  avatar={selectedFriend.avatar} 
                  size="md" 
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-foreground">{selectedFriend.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Level {selectedFriend.level} • {selectedFriend.xp} XP
                  </div>
                </div>
              </div>
              
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {getMessagesWithUser(selectedFriend.id).length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    getMessagesWithUser(selectedFriend.id).map((msg) => (
                      <div 
                        key={msg.id}
                        className={`flex ${msg.sender === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-[70%] px-3 py-2 rounded-lg ${
                            msg.sender === user?.id 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-card border'
                          }`}
                        >
                          <div>{msg.content}</div>
                          <div className={`text-xs mt-1 ${
                            msg.sender === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {formatTime(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {/* Message Input */}
              <div className="p-3 border-t bg-card">
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
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
              {activeTab === "friends" ? (
                <>
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-xl font-medium mb-2 text-foreground">Select a friend to start chatting</h3>
                  <p className="text-center mb-4">
                    Send messages, share quiz results, and challenge friends to multiplayer matches!
                  </p>
                </>
              ) : activeTab === "requests" ? (
                <>
                  <div className="text-6xl mb-4">👋</div>
                  <h3 className="text-xl font-medium mb-2 text-foreground">Friend Requests</h3>
                  <p className="text-center">
                    Accept or decline friend requests from other students
                  </p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-medium mb-2 text-foreground">Add New Friends</h3>
                  <p className="text-center">
                    Search for other students and send friend requests
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
      <AvatarRenderer 
        avatar={request.sender.avatar} 
        size="md" 
        className="mr-3"
      />
      <div className="flex-1">
        <div className="font-medium text-foreground">{request.sender.name}</div>
        <div className="text-xs text-muted-foreground">
          Level {request.sender.level} • {request.sender.xp} XP
        </div>
      </div>
      <div className="flex gap-2">
        <Button 
          size="sm" 
          className="bg-glow-green hover:bg-glow-green/80"
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
