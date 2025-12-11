import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Clock, Star, Calendar, Award, Crown, Zap, Target, Sparkles, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Tournament {
  id: string;
  name: string;
  description: string;
  type: 'bracket' | 'swiss' | 'leaderboard';
  status: 'upcoming' | 'active' | 'completed';
  participants: number;
  maxParticipants: number;
  startDate: Date;
  endDate: Date;
  subject: string;
  grade: number;
  prizePool: {
    coins: number;
    gems: number;
    badges: string[];
  };
  entryFee?: {
    coins?: number;
    gems?: number;
  };
  currentRound?: number;
  totalRounds?: number;
}

const TournamentHub: React.FC = () => {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  
  const [tournaments] = useState<Tournament[]>([
    {
      id: 'weekly_math',
      name: 'Weekly Math Championship',
      description: 'Test your mathematical skills against students worldwide',
      type: 'bracket',
      status: 'active',
      participants: 128,
      maxParticipants: 256,
      startDate: new Date('2025-01-06'),
      endDate: new Date('2025-01-13'),
      subject: 'Math',
      grade: 8,
      prizePool: {
        coins: 5000,
        gems: 100,
        badges: ['math_champion', 'tournament_winner']
      },
      entryFee: { coins: 50 },
      currentRound: 3,
      totalRounds: 8
    },
    {
      id: 'science_sprint',
      name: 'Science Sprint',
      description: 'Quick-fire science questions for the curious minds',
      type: 'leaderboard',
      status: 'upcoming',
      participants: 45,
      maxParticipants: 100,
      startDate: new Date('2025-01-10'),
      endDate: new Date('2025-01-17'),
      subject: 'Science',
      grade: 7,
      prizePool: {
        coins: 3000,
        gems: 50,
        badges: ['science_expert']
      }
    },
    {
      id: 'global_challenge',
      name: 'Global Mind Challenge',
      description: 'Multi-subject tournament for the ultimate brain test',
      type: 'swiss',
      status: 'upcoming',
      participants: 512,
      maxParticipants: 1000,
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-01-22'),
      subject: 'Mixed',
      grade: 9,
      prizePool: {
        coins: 15000,
        gems: 500,
        badges: ['global_champion', 'master_mind', 'legendary_player']
      },
      entryFee: { gems: 25 }
    },
    {
      id: 'daily_dash',
      name: 'Daily Dash',
      description: 'Quick daily tournament for active players',
      type: 'leaderboard',
      status: 'completed',
      participants: 89,
      maxParticipants: 200,
      startDate: new Date('2025-01-05'),
      endDate: new Date('2025-01-05'),
      subject: 'English',
      grade: 6,
      prizePool: {
        coins: 1000,
        gems: 20,
        badges: ['daily_winner']
      }
    }
  ]);

  const getStatusConfig = (status: Tournament['status']) => {
    const configs = {
      upcoming: { color: 'from-blue-500 to-cyan-500', text: 'Upcoming', icon: Calendar },
      active: { color: 'from-green-500 to-emerald-500', text: 'Live', icon: Zap },
      completed: { color: 'from-gray-500 to-gray-600', text: 'Ended', icon: Trophy }
    };
    return configs[status];
  };

  const getTypeConfig = (type: Tournament['type']) => {
    const configs = {
      bracket: { icon: '🏆', label: 'Bracket', color: 'from-yellow-500 to-orange-500' },
      swiss: { icon: '⚔️', label: 'Swiss', color: 'from-purple-500 to-pink-500' },
      leaderboard: { icon: '📊', label: 'Leaderboard', color: 'from-cyan-500 to-blue-500' }
    };
    return configs[type];
  };

  const handleRegister = (tournament: Tournament) => {
    toast.success(`Registered for ${tournament.name}!`, {
      description: 'You will be notified when the tournament begins.'
    });
  };

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming');
  const completedTournaments = tournaments.filter(t => t.status === 'completed');

  const renderTournamentCard = (tournament: Tournament) => {
    const statusConfig = getStatusConfig(tournament.status);
    const typeConfig = getTypeConfig(tournament.type);
    const StatusIcon = statusConfig.icon;
    
    return (
      <motion.div
        key={tournament.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        whileHover={{ y: -4 }}
        className="group"
      >
        <Card className="glass neon-border overflow-hidden h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
          {/* Status Banner */}
          <div className={`h-1.5 bg-gradient-to-r ${statusConfig.color}`} />
          
          <CardContent className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{typeConfig.icon}</span>
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {tournament.name}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{tournament.description}</p>
              </div>
              <Badge className={`bg-gradient-to-r ${statusConfig.color} text-white border-0 shrink-0`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.text}
              </Badge>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-lg">
                <Users className="w-4 h-4" />
                <span>{tournament.participants}/{tournament.maxParticipants}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-lg">
                <Calendar className="w-4 h-4" />
                <span>{tournament.startDate.toLocaleDateString()}</span>
              </div>
              {tournament.status === 'active' && tournament.currentRound && (
                <div className="flex items-center gap-1.5 bg-primary/20 text-primary px-2 py-1 rounded-lg">
                  <Target className="w-4 h-4" />
                  <span>Round {tournament.currentRound}/{tournament.totalRounds}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-border/50">{tournament.subject}</Badge>
              <Badge variant="outline" className="border-border/50">Grade {tournament.grade}</Badge>
              <Badge variant="outline" className={`border-0 bg-gradient-to-r ${typeConfig.color} text-white`}>
                {typeConfig.label}
              </Badge>
            </div>

            {/* Progress Bar for Active */}
            {tournament.status === 'active' && tournament.currentRound && tournament.totalRounds && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tournament Progress</span>
                  <span className="text-primary font-medium">{Math.round((tournament.currentRound / tournament.totalRounds) * 100)}%</span>
                </div>
                <Progress 
                  value={(tournament.currentRound / tournament.totalRounds) * 100} 
                  className="h-2"
                />
              </div>
            )}

            {/* Prize Pool */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
              <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Prize Pool
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">🪙</span>
                  <span className="font-bold text-foreground">{tournament.prizePool.coins.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">💎</span>
                  <span className="font-bold text-foreground">{tournament.prizePool.gems.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-primary" />
                  <span className="font-bold text-foreground">{tournament.prizePool.badges.length} Badges</span>
                </div>
              </div>
            </div>

            {/* Entry Fee */}
            {tournament.entryFee && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Entry Fee: </span>
                {tournament.entryFee.coins && <span className="text-foreground">🪙 {tournament.entryFee.coins}</span>}
                {tournament.entryFee.gems && <span className="text-foreground">💎 {tournament.entryFee.gems}</span>}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {tournament.status === 'upcoming' && (
                <Button 
                  className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground"
                  onClick={() => handleRegister(tournament)}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Register Now
                </Button>
              )}
              {tournament.status === 'active' && (
                <Button className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                  <Zap className="w-4 h-4 mr-2" />
                  Continue Playing
                </Button>
              )}
              {tournament.status === 'completed' && (
                <Button variant="outline" className="flex-1 border-border/50">
                  <Trophy className="w-4 h-4 mr-2" />
                  View Results
                </Button>
              )}
              <Button variant="outline" size="icon" className="border-border/50">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent blur-xl opacity-50" />
            <h2 className="relative text-4xl font-bold text-gradient flex items-center justify-center gap-3">
              <Trophy className="w-10 h-10" />
              Tournament Hub
            </h2>
          </div>
        </motion.div>
        <p className="text-muted-foreground max-w-md mx-auto">
          Compete with students worldwide and climb the ranks to legendary status
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active', count: activeTournaments.length, icon: Zap, color: 'from-green-500 to-emerald-500' },
          { label: 'Upcoming', count: upcomingTournaments.length, icon: Calendar, color: 'from-blue-500 to-cyan-500' },
          { label: 'Completed', count: completedTournaments.length, icon: Trophy, color: 'from-purple-500 to-pink-500' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass text-center p-4">
              <div className={`w-10 h-10 mx-auto rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-2`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.count}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="glass grid grid-cols-3 w-full max-w-lg mx-auto p-1">
          <TabsTrigger value="active" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Zap className="w-4 h-4" />
            <span>Live ({activeTournaments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Calendar className="w-4 h-4" />
            <span>Upcoming ({upcomingTournaments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Trophy className="w-4 h-4" />
            <span>Ended ({completedTournaments.length})</span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="active" className="mt-0">
            {activeTournaments.length === 0 ? (
              <Card className="glass p-12 text-center">
                <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active tournaments at the moment</p>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeTournaments.map(renderTournamentCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-0">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingTournaments.map(renderTournamentCard)}
            </div>
          </TabsContent>

          <TabsContent value="completed" className="mt-0">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {completedTournaments.map(renderTournamentCard)}
            </div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
};

export default TournamentHub;