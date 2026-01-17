import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { useChat, ChatGroup, GroupMessage } from '@/context/ChatContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import AvatarRenderer from '@/components/avatar/AvatarRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, Users, Plus, Send, Search, 
  Loader2, Settings, UserPlus, LogOut, Hash
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const Chat: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { 
    groups, currentGroup, messages, members, loading, loadingMessages,
    setCurrentGroup, createGroup, sendMessage, leaveGroup
  } = useChat();

  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    const group = await createGroup(newGroupName, newGroupDesc);
    if (group) {
      setCurrentGroup(group);
      setCreateDialogOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
    }
  };

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground variant="minimal" />
      
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="glass border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <BackButton to="/" />
              <MessageCircle className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold">Group Chat</h1>
                <p className="text-xs text-muted-foreground">Chat with teachers, students & admins</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r bg-card/50 flex flex-col">
            <div className="p-3 border-b">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <Input
                        placeholder="Group name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={newGroupDesc}
                        onChange={(e) => setNewGroupDesc(e.target.value)}
                      />
                      <Button onClick={handleCreateGroup} className="w-full">
                        Create Group
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-6 text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No groups yet</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setCreateDialogOpen(true)}>
                    Create your first group
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => setCurrentGroup(group)}
                      className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                        currentGroup?.id === group.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Hash className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{group.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {group.member_count} members
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {currentGroup ? (
              <>
                {/* Chat Header */}
                <div className="p-3 border-b bg-card/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Hash className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{currentGroup.name}</div>
                      <div className="text-xs text-muted-foreground">{members.length} members</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => leaveGroup(currentGroup.id)}>
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-2 ${msg.sender_id === user?.id ? 'justify-end' : ''}`}
                        >
                          {msg.sender_id !== user?.id && (
                            <AvatarRenderer avatar={msg.sender_avatar} size="sm" />
                          )}
                          <div className={`max-w-[70%] ${msg.sender_id === user?.id ? 'text-right' : ''}`}>
                            {msg.sender_id !== user?.id && (
                              <div className="text-xs text-muted-foreground mb-1">{msg.sender_name}</div>
                            )}
                            <div className={`px-3 py-2 rounded-lg inline-block ${
                              msg.sender_id === user?.id 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted'
                            }`}>
                              {msg.content}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-3 border-t bg-card/50">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={!messageInput.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Select a group to start chatting</h3>
                  <p className="text-sm">Or create a new group to connect with others</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
