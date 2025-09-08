import React, { useState } from 'react';
import { useRoom } from '@/context/RoomContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Lock, Play, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const RoomLobby: React.FC = () => {
  const { rooms, createRoom, joinRoom, getPublicRooms } = useRoom();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('2');
  const [password, setPassword] = useState('');
  const [subject, setSubject] = useState('Math');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionCount, setQuestionCount] = useState('10');

  const publicRooms = getPublicRooms();

  const handleCreateRoom = () => {
    if (!roomName.trim()) return;
    
    const gameSettings = {
      subject,
      difficulty: difficulty as 'Easy' | 'Medium' | 'Hard',
      questionCount: parseInt(questionCount),
      timePerQuestion: 30
    };

    createRoom(roomName, gameSettings, parseInt(maxPlayers), password || undefined);
    setShowCreateRoom(false);
    setRoomName('');
    setPassword('');
  };

  const handleJoinRoom = (roomId: string) => {
    joinRoom(roomId, 'current-user'); // Would use actual username
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Multiplayer Lobby</h2>
          <p className="text-muted-foreground">Join a room or create your own</p>
        </div>
        
        <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Create Room</span>
            </Button>
          </DialogTrigger>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Room</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <Input
                placeholder="Room Name"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Max Players</label>
                  <Select value={maxPlayers} onValueChange={setMaxPlayers}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Players</SelectItem>
                      <SelectItem value="3">3 Players</SelectItem>
                      <SelectItem value="4">4 Players</SelectItem>
                      <SelectItem value="6">6 Players</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Math">Math</SelectItem>
                      <SelectItem value="Science">Science</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="History">History</SelectItem>
                      <SelectItem value="Geography">Geography</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Difficulty</label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Easy">Easy</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Questions</label>
                  <Select value={questionCount} onValueChange={setQuestionCount}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                      <SelectItem value="15">15 Questions</SelectItem>
                      <SelectItem value="20">20 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Input
                placeholder="Password (Optional)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              
              <Button onClick={handleCreateRoom} className="w-full">
                Create Room
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Public Rooms */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Public Rooms</h3>
        
        {publicRooms.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">No public rooms available</p>
            <p className="text-sm text-muted-foreground mt-1">Create one to get started!</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicRooms.map(room => (
              <Card key={room.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold truncate">{room.name}</h4>
                    {room.password && <Lock className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{room.players.length}/{room.maxPlayers}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {room.gameSettings.subject}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {room.gameSettings.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {room.gameSettings.questionCount}Q
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Host: {room.host}
                    </div>
                    
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleJoinRoom(room.id)}
                      disabled={room.players.length >= room.maxPlayers}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {room.players.length >= room.maxPlayers ? 'Full' : 'Join'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomLobby;