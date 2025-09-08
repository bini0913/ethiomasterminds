import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Users, Clock, Star, Calendar, Award } from 'lucide-react';

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

  const getStatusBadge = (status: Tournament['status']) => {
    const variants = {
      upcoming: 'bg-blue-500',
      active: 'bg-green-500',
      completed: 'bg-gray-500'
    };
    
    return (
      <Badge className={`text-white ${variants[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeIcon = (type: Tournament['type']) => {
    switch (type) {
      case 'bracket': return '🏆';
      case 'swiss': return '⚔️';
      case 'leaderboard': return '📊';
      default: return '🎯';
    }
  };

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming');
  const completedTournaments = tournaments.filter(t => t.status === 'completed');

  const renderTournament = (tournament: Tournament) => (
    <Card key={tournament.id} className="p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{getTypeIcon(tournament.type)}</span>
              <h3 className="text-lg font-semibold">{tournament.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{tournament.description}</p>
          </div>
          {getStatusBadge(tournament.status)}
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{tournament.participants}/{tournament.maxParticipants}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{tournament.startDate.toLocaleDateString()}</span>
          </div>
          
          {tournament.status === 'active' && tournament.currentRound && (
            <div className="flex items-center space-x-1">
              <Trophy className="w-4 h-4" />
              <span>Round {tournament.currentRound}/{tournament.totalRounds}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="outline">{tournament.subject}</Badge>
          <Badge variant="outline">Grade {tournament.grade}</Badge>
          <Badge variant="outline" className="capitalize">{tournament.type}</Badge>
        </div>

        {tournament.status === 'active' && tournament.currentRound && tournament.totalRounds && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Tournament Progress</span>
              <span>Round {tournament.currentRound}/{tournament.totalRounds}</span>
            </div>
            <Progress value={(tournament.currentRound / tournament.totalRounds) * 100} />
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium">Prize Pool:</div>
          <div className="flex items-center space-x-3 text-sm">
            <div className="flex items-center space-x-1">
              <span>🪙</span>
              <span>{tournament.prizePool.coins.toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>💎</span>
              <span>{tournament.prizePool.gems.toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Award className="w-4 h-4" />
              <span>{tournament.prizePool.badges.length} Badges</span>
            </div>
          </div>
        </div>

        {tournament.entryFee && (
          <div className="text-sm">
            <span className="font-medium">Entry Fee: </span>
            {tournament.entryFee.coins && `🪙 ${tournament.entryFee.coins}`}
            {tournament.entryFee.gems && `💎 ${tournament.entryFee.gems}`}
          </div>
        )}

        <div className="flex items-center space-x-2">
          {tournament.status === 'upcoming' && (
            <Button className="flex-1">
              Register Now
            </Button>
          )}
          
          {tournament.status === 'active' && (
            <Button className="flex-1">
              Continue Playing
            </Button>
          )}
          
          {tournament.status === 'completed' && (
            <Button variant="outline" className="flex-1">
              View Results
            </Button>
          )}
          
          <Button variant="outline" size="sm">
            Details
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Tournament Hub</h2>
        <p className="text-muted-foreground">
          Compete with students worldwide and climb the ranks
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
          <TabsTrigger value="active" className="flex items-center space-x-2">
            <span>🔥</span>
            <span>Active ({activeTournaments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center space-x-2">
            <span>📅</span>
            <span>Upcoming ({upcomingTournaments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center space-x-2">
            <span>🏁</span>
            <span>Completed ({completedTournaments.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeTournaments.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No active tournaments</p>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeTournaments.map(renderTournament)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcomingTournaments.map(renderTournament)}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {completedTournaments.map(renderTournament)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TournamentHub;