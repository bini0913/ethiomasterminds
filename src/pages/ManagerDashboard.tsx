import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import BackButton from '@/components/ui/BackButton';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  ClipboardList,
  Crown,
  Gamepad2,
  Lock,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Shield,
  SkipForward,
  LogOut,
  Trophy,
  Upload,
  UserMinus,
  UserPlus,
  Users,
  Zap,
  Sparkles,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DashboardStats = {
  totalStudents: number;
  activeUsersToday: number;
  totalPosts: number;
  totalMessages: number;
  totalFlashcards: number;
  totalStudyRooms: number;
  xpActivityToday: number;
};

type StudentRow = {
  id: string;
  name: string;
  avatar: string | null;
  grade: string | null;
  level: number;
  xp: number;
  created_at: string;
};

type FeedReport = {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  reporter_id: string;
  reported_id: string;
  created_at: string;
};

type ManagedPost = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  post_type: string;
};

type ManagerTournamentStatus = 'waiting' | 'active' | 'finished';
type TournamentMode = 'speed' | 'accuracy';
type BracketMatchStatus = 'waiting' | 'live' | 'finished';

type TournamentPlayer = {
  id: string;
  name: string;
  progress: number;
  userId: string;
};

type TournamentMatch = {
  id: string;
  round: string;
  playerA: string;
  playerB: string;
  status: BracketMatchStatus;
  winner?: string;
};

type ManagedTournament = {
  id: string;
  name: string;
  subject: string;
  status: ManagerTournamentStatus;
  maxPlayers: 8 | 16 | 32;
  questionCount: number;
  mode: TournamentMode;
  entryFeeType: 'coins' | 'free';
  entryFeeCoins: number;
  players: TournamentPlayer[];
  matches: TournamentMatch[];
  rewards: {
    winnerCoins: number;
    winnerXp: number;
    runnerUpCoins: number;
    runnerUpXp: number;
  };
  locked: boolean;
  paused: boolean;
};

type TournamentParticipantRow = {
  id: string;
  tournament_id: string;
  user_id: string;
  score: number | null;
};

type TournamentMatchRow = {
  id: string;
  tournament_id: string;
  round: number;
  bracket_position: number;
  status: 'pending' | 'ready' | 'live' | 'finished';
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
};

const gradeBands = ['Grade 1-4', 'Grade 5-8', 'Grade 9-12'];
const subjects = ['Math', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Language'];
const roundNameBySize: Record<number, string> = {
  16: 'Round of 16',
  8: 'Quarterfinal',
  4: 'Semifinal',
  2: 'Final',
};

const ManagerDashboard: React.FC = () => {
  const { user, logout } = useUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeUsersToday: 0,
    totalPosts: 0,
    totalMessages: 0,
    totalFlashcards: 0,
    totalStudyRooms: 0,
    xpActivityToday: 0,
  });

  const [dailyUsers, setDailyUsers] = useState<Array<{ day: string; users: number }>>([]);
  const [weeklyLearning, setWeeklyLearning] = useState<Array<{ day: string; quizzes: number; flashcards: number }>>([]);
  const [subjectMix, setSubjectMix] = useState<Array<{ subject: string; value: number }>>([]);
  const [leaderboard, setLeaderboard] = useState<StudentRow[]>([]);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentGradeFilter, setStudentGradeFilter] = useState('all');
  const [studentPage, setStudentPage] = useState(0);

  const [posts, setPosts] = useState<ManagedPost[]>([]);
  const [reports, setReports] = useState<FeedReport[]>([]);

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');

  const [resourceForm, setResourceForm] = useState({
    title: '',
    type: 'book',
    gradeBand: 'Grade 5-8',
    subject: 'Math',
    description: '',
  });

  const [xpRewards, setXpRewards] = useState({
    flashcardComplete: 10,
    battleWin: 50,
    uploadMaterial: 25,
  });

  const [systemSettings, setSystemSettings] = useState({
    socialFeedEnabled: true,
    aiTutorEnabled: true,
    tournamentsEnabled: true,
    maxUploadMb: 20,
    strictModeration: true,
  });

  const [activityLog, setActivityLog] = useState<Array<{ id: string; action: string; at: string }>>([]);
  const [tournamentLog, setTournamentLog] = useState<Array<{ id: string; action: string; at: string }>>([]);
  const [managedTournaments, setManagedTournaments] = useState<ManagedTournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [createTournamentForm, setCreateTournamentForm] = useState({
    maxPlayers: '8',
    subject: 'Math',
    questionCount: '10',
    mode: 'speed' as TournamentMode,
    entryFeeType: 'free' as 'coins' | 'free',
    entryFeeCoins: '0',
  });
  const [manualPlayerName, setManualPlayerName] = useState('');

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logAction = async (action: string) => {
    const stamp = new Date().toISOString();
    setActivityLog((prev) => [{ id: `${stamp}-${Math.random()}`, action, at: stamp }, ...prev].slice(0, 20));

    if (!user?.id) return;

    await supabase.from('announcements').insert({
      title: `[Admin Log] ${action}`,
      content: `${action} • ${stamp}`,
      author_id: user.id,
      target_type: 'system_log',
      target_id: user.id,
    });
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOverviewStats(),
        fetchCharts(),
        fetchStudents(),
        fetchModerationData(),
        fetchManagerTournaments(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchManagerTournaments = async () => {
    const [{ data: tournaments }, { data: participants }, { data: matches }, { data: profiles }] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id,name,subject,status,max_participants,entry_fee_coins,prize_coins,start_time,end_time')
        .order('start_time', { ascending: false })
        .limit(50),
      supabase.from('tournament_participants').select('id,tournament_id,user_id,score'),
      supabase
        .from('tournament_matches' as any)
        .select('id,tournament_id,round,bracket_position,status,player1_id,player2_id,winner_id')
        .order('round', { ascending: true })
        .order('bracket_position', { ascending: true }),
      supabase.from('profiles').select('id,name'),
    ]);

    const typedProfiles = (profiles || []) as Array<{ id: string; name: string | null }>;
     const profileMap = new Map(typedProfiles.map((profile) => [profile.id, profile.name || 'Student']));
    const participantsByTournament = (participants || []).reduce<Record<string, TournamentParticipantRow[]>>((acc, row) => {
      if (!acc[row.tournament_id]) acc[row.tournament_id] = [];
      acc[row.tournament_id].push(row as TournamentParticipantRow);
      return acc;
    }, {});

    const matchesByTournament = ((matches as any[]) || []).reduce<Record<string, TournamentMatchRow[]>>((acc, row: any) => {
      if (!acc[row.tournament_id]) acc[row.tournament_id] = [];
      acc[row.tournament_id].push(row as TournamentMatchRow);
      return acc;
    }, {});

    const mapped = (tournaments || []).map((tournament): ManagedTournament => {
      const players = (participantsByTournament[tournament.id] || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: profileMap.get(row.user_id) || 'Student',
        progress: Math.max(0, Math.min(100, row.score || 0)),
      }));

      const bracketMatches = (matchesByTournament[tournament.id] || []).map((row) => {
        const roundSize = Math.pow(2, Math.max(1, 5 - row.round));
        return {
          id: row.id,
          round: roundNameBySize[roundSize] || `Round ${row.round}`,
          playerA: row.player1_id ? profileMap.get(row.player1_id) || 'TBD' : 'TBD',
          playerB: row.player2_id ? profileMap.get(row.player2_id) || 'TBD' : 'TBD',
          status: row.status === 'pending' ? 'waiting' : row.status,
          winner: row.winner_id ? profileMap.get(row.winner_id) || undefined : undefined,
        } as TournamentMatch;
      });

      return {
        id: tournament.id,
        name: tournament.name,
        subject: tournament.subject || 'Mixed',
        status: tournament.status === 'completed' ? 'finished' : (tournament.status as ManagerTournamentStatus),
        maxPlayers: ((tournament.max_participants || 16) as 8 | 16 | 32),
        questionCount: 15,
        mode: 'speed',
        entryFeeType: (tournament.entry_fee_coins || 0) > 0 ? 'coins' : 'free',
        entryFeeCoins: tournament.entry_fee_coins || 0,
        players,
        matches: bracketMatches,
        rewards: {
          winnerCoins: tournament.prize_coins || 1500,
          winnerXp: 800,
          runnerUpCoins: Math.round((tournament.prize_coins || 1500) * 0.4),
          runnerUpXp: 300,
        },
        locked: tournament.status === 'active' || tournament.status === 'completed',
        paused: false,
      };
    });

    setManagedTournaments(mapped);
    if (mapped.length && !mapped.some((item) => item.id === selectedTournamentId)) {
      setSelectedTournamentId(mapped[0].id);
    }
  };

  const fetchOverviewStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [studentRoles, activeUsers, totalPosts, totalMessages, totalFlashcards, totalRooms, xpToday] = await Promise.all([
      supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('user_presence').select('*', { count: 'exact', head: true }).gte('last_seen', today.toISOString()),
      supabase.from('social_posts').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('flashcards').select('*', { count: 'exact', head: true }),
      supabase.from('multiplayer_rooms').select('*', { count: 'exact', head: true }),
      supabase.from('quiz_results').select('xp_earned').gte('completed_at', today.toISOString()),
    ]);

    const xp = (xpToday.data || []).reduce((sum, row) => sum + (row.xp_earned || 0), 0);

    setStats({
      totalStudents: studentRoles.count || 0,
      activeUsersToday: activeUsers.count || 0,
      totalPosts: totalPosts.count || 0,
      totalMessages: totalMessages.count || 0,
      totalFlashcards: totalFlashcards.count || 0,
      totalStudyRooms: totalRooms.count || 0,
      xpActivityToday: xp,
    });
  };

  const fetchCharts = async () => {
    const { data: presence } = await supabase.from('user_presence').select('last_seen').order('last_seen', { ascending: false }).limit(500);
    const { data: quizResults } = await supabase.from('quiz_results').select('completed_at').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(500);
    const { data: flashcardProgress } = await supabase.from('user_flashcard_progress').select('created_at').order('created_at', { ascending: false }).limit(500);
    const { data: quizzes } = await supabase.from('quizzes').select('subject');

    const days = [...Array(7)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    const dUsers = days.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const users = (presence || []).filter((p) => p.last_seen.slice(0, 10) === key).length;
      return { day: date.toLocaleDateString(undefined, { weekday: 'short' }), users };
    });

    const dLearning = days.map((date) => {
      const key = date.toISOString().slice(0, 10);
      return {
        day: date.toLocaleDateString(undefined, { weekday: 'short' }),
        quizzes: (quizResults || []).filter((q) => q.completed_at?.slice(0, 10) === key).length,
        flashcards: (flashcardProgress || []).filter((f) => f.created_at.slice(0, 10) === key).length,
      };
    });

    const subjectCounts = (quizzes || []).reduce<Record<string, number>>((acc, quiz) => {
      acc[quiz.subject] = (acc[quiz.subject] || 0) + 1;
      return acc;
    }, {});

    setDailyUsers(dUsers);
    setWeeklyLearning(dLearning);
    setSubjectMix(Object.entries(subjectCounts).slice(0, 6).map(([subject, value]) => ({ subject, value: Number(value) })));

    const { data: topStudents } = await supabase
      .from('profiles')
      .select('id,name,avatar,grade,level,xp,created_at')
      .order('xp', { ascending: false })
      .limit(5);
    setLeaderboard((topStudents || []) as StudentRow[]);
  };

  const fetchStudents = async () => {
    const pageSize = 12;
    let query = supabase
      .from('profiles')
      .select('id,name,avatar,grade,level,xp,created_at')
      .order('created_at', { ascending: false })
      .range(studentPage * pageSize, studentPage * pageSize + pageSize - 1);

    if (studentSearch.trim()) query = query.ilike('name', `%${studentSearch.trim()}%`);
    if (studentGradeFilter !== 'all') query = query.eq('grade', studentGradeFilter);

    const { data } = await query;
    setStudents((data || []) as StudentRow[]);
  };

  const fetchModerationData = async () => {
    const [{ data: recentPosts }, { data: pendingReports }] = await Promise.all([
      supabase.from('social_posts').select('id,content,created_at,author_id,post_type').order('created_at', { ascending: false }).limit(40),
      supabase.from('reports').select('id,reason,description,status,reporter_id,reported_id,created_at').order('created_at', { ascending: false }).limit(40),
    ]);

    setPosts((recentPosts || []) as ManagedPost[]);
    setReports((pendingReports || []) as FeedReport[]);
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentPage, studentSearch, studentGradeFilter]);

  const topStudentsChart = useMemo(
    () => leaderboard.map((s) => ({ name: s.name.split(' ')[0], xp: s.xp })),
    [leaderboard],
  );

  const handleStudentAction = async (studentId: string, action: 'suspend' | 'ban' | 'reset_xp' | 'edit_grade', grade?: string) => {
    if (action === 'reset_xp') {
      const { error } = await supabase.from('profiles').update({ xp: 0, level: 1 }).eq('id', studentId);
      if (error) return toast.error('Failed to reset XP');
      toast.success('Student XP reset');
      await logAction(`Reset XP for student ${studentId}`);
      fetchStudents();
      return;
    }

    if (action === 'suspend' || action === 'ban') {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user?.id || studentId,
        reported_id: studentId,
        reported_type: 'user',
        reason: action,
        description: `Manager performed ${action} action`,
        status: 'resolved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      });
      if (error) return toast.error(`Failed to ${action} student`);
      toast.success(`Student ${action}ed`);
      await logAction(`${action} student ${studentId}`);
      return;
    }

    if (action === 'edit_grade' && grade) {
      const { error } = await supabase.from('profiles').update({ grade }).eq('id', studentId);
      if (error) return toast.error('Failed to update grade');
      toast.success('Grade updated');
      await logAction(`Updated grade for student ${studentId} to ${grade}`);
      fetchStudents();
    }
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from('social_posts').delete().eq('id', postId);
    if (error) return toast.error('Failed to delete post');
    toast.success('Post deleted');
    await logAction(`Deleted social post ${postId}`);
    fetchModerationData();
  };

  const handleResolveReport = async (reportId: string) => {
    const { error } = await supabase
      .from('reports')
      .update({ status: 'resolved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', reportId);
    if (error) return toast.error('Failed to resolve report');
    toast.success('Report resolved');
    await logAction(`Resolved report ${reportId}`);
    fetchModerationData();
  };

  const handleUploadResource = async () => {
    if (!resourceForm.title.trim()) return toast.error('Resource title is required');

    const content = `${resourceForm.type.toUpperCase()} • ${resourceForm.title}\n${resourceForm.description}`;
    const { error } = await supabase.from('social_posts').insert({
      author_id: user?.id || '',
      content,
      post_type: 'resource',
      metadata: {
        gradeBand: resourceForm.gradeBand,
        subject: resourceForm.subject,
      },
    });

    if (error) return toast.error('Failed to publish resource metadata');

    toast.success('Educational resource published');
    await logAction(`Published resource ${resourceForm.title}`);
    setResourceForm({ title: '', type: 'book', gradeBand: 'Grade 5-8', subject: 'Math', description: '' });
    fetchModerationData();
  };

  const sendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim()) return toast.error('Announcement title and message are required');

    const { error } = await supabase.from('announcements').insert({
      author_id: user?.id || '',
      title: announcementTitle,
      content: announcementBody,
      target_type: 'global',
      target_id: null,
    });

    if (error) return toast.error('Failed to send announcement');

    toast.success('Announcement sent platform-wide');
    await logAction(`Sent announcement: ${announcementTitle}`);
    setAnnouncementTitle('');
    setAnnouncementBody('');
  };

  const selectedTournament = useMemo(
    () => managedTournaments.find((tournament) => tournament.id === selectedTournamentId) || managedTournaments[0],
    [managedTournaments, selectedTournamentId],
  );

  const pushTournamentLog = async (action: string) => {
    const stamp = new Date().toISOString();
    setTournamentLog((prev) => [{ id: `${stamp}-${Math.random()}`, action, at: stamp }, ...prev].slice(0, 40));
    await logAction(`Tournament control: ${action}`);
  };

  const createTournament = async () => {
    const maxPlayers = Number(createTournamentForm.maxPlayers) as 8 | 16 | 32;
    const questionCount = Number(createTournamentForm.questionCount);
    const entryFeeCoins = createTournamentForm.entryFeeType === 'coins' ? Number(createTournamentForm.entryFeeCoins) : 0;

    if (![8, 16, 32].includes(maxPlayers)) return toast.error('Players must be 8, 16, or 32');
    if (!createTournamentForm.subject.trim()) return toast.error('Subject is required');
    if (questionCount < 5) return toast.error('Question count should be at least 5');
    if (entryFeeCoins < 0) return toast.error('Entry fee must be positive');

    const tournamentName = `${createTournamentForm.subject} ${createTournamentForm.mode === 'speed' ? 'Blitz' : 'Precision'} Cup`;
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        name: tournamentName,
        subject: createTournamentForm.subject,
        status: 'upcoming',
        max_participants: maxPlayers,
        entry_fee_coins: entryFeeCoins,
        prize_coins: 1500,
        prize_description: `${maxPlayers}-player champions league`,
        start_time: now.toISOString(),
        end_time: end.toISOString(),
        created_by: user?.id || '',
      })
      .select('id')
      .single();

    if (error || !data) return toast.error('Failed to create tournament');

    await fetchManagerTournaments();
    setSelectedTournamentId(data.id);
    toast.success('Tournament created in database');
    await pushTournamentLog(`Created tournament "${tournamentName}"`);
  };

  const setTournamentStatus = async (status: ManagerTournamentStatus) => {
    if (!selectedTournament) return;
    const nextStatus = status === 'finished' ? 'completed' : status === 'waiting' ? 'upcoming' : 'active';
    const { error } = await supabase.from('tournaments').update({ status: nextStatus }).eq('id', selectedTournament.id);
    if (error) return toast.error('Failed to update tournament status');
    await fetchManagerTournaments();
    await pushTournamentLog(`Set ${selectedTournament.name} status to ${status}`);
  };

  const addPlayerManually = async () => {
    const userId = manualPlayerName.trim();
    if (!selectedTournament || !userId) return toast.error('Enter player user id');
    if (selectedTournament.players.length >= selectedTournament.maxPlayers) return toast.error('Tournament is full');
    const { error } = await supabase.from('tournament_participants').insert({
      tournament_id: selectedTournament.id,
      user_id: userId,
    });
    if (error) return toast.error('Could not add player (check user id)');
    await fetchManagerTournaments();
    await pushTournamentLog(`Added player ${userId} into ${selectedTournament.name}`);
    setManualPlayerName('');
  };

  const removePlayer = async (playerId: string) => {
    if (!selectedTournament) return;
    const player = selectedTournament.players.find((item) => item.id === playerId);
    const { error } = await supabase.from('tournament_participants').delete().eq('id', playerId);
    if (error) return toast.error('Failed to remove player');
    await fetchManagerTournaments();
    await pushTournamentLog(`Removed player ${player?.name || playerId} from ${selectedTournament.name}`);
  };

  const toggleTournamentLock = async () => {
    if (!selectedTournament) return;
    const nextStatus = selectedTournament.locked ? 'upcoming' : 'active';
    const { error } = await supabase.from('tournaments').update({ status: nextStatus }).eq('id', selectedTournament.id);
    if (error) return toast.error('Failed to lock/unlock');
    await fetchManagerTournaments();
    await pushTournamentLog(`${selectedTournament.locked ? 'Unlocked' : 'Locked'} tournament ${selectedTournament.name}`);
  };

  const updateMatch = async (matchId: string, updater: (match: TournamentMatch) => TournamentMatch, action: string) => {
    if (!selectedTournament) return;
    const existing = selectedTournament.matches.find((match) => match.id === matchId);
    if (!existing) return;
    const next = updater(existing);
    const winnerUserId = next.winner
      ? selectedTournament.players.find((player) => player.name === next.winner)?.userId || null
      : null;
    const status = next.status === 'waiting' ? 'pending' : next.status;
    const { error } = await supabase
      .from('tournament_matches' as any)
      .update({ status, winner_id: winnerUserId })
      .eq('id', matchId);
    if (error) return toast.error('Failed to update match');
    await fetchManagerTournaments();
    await pushTournamentLog(action);
  };

  const updateRewards = async (key: keyof ManagedTournament['rewards'], value: number) => {
    if (!selectedTournament) return;
    if (key !== 'winnerCoins') return;
    const { error } = await supabase.from('tournaments').update({ prize_coins: value }).eq('id', selectedTournament.id);
    if (error) return toast.error('Failed to update rewards');
    await fetchManagerTournaments();
  };

  const generateChampionsBracket = async () => {
    if (!selectedTournament) return;
    if (selectedTournament.maxPlayers !== 16) {
      toast.error('Champions League bracket is designed for 16 players');
      return;
    }
    if (selectedTournament.players.length < 16) {
      toast.error('Need 16 registered players before generating bracket');
      return;
    }

    const seeded = [...selectedTournament.players].slice(0, 16);
    const matchRows = seeded.slice(0, 16).reduce<Array<Record<string, unknown>>>((acc, _, index, arr) => {
      if (index % 2 !== 0) return acc;
      acc.push({
        tournament_id: selectedTournament.id,
        round: 1,
        bracket_position: Math.floor(index / 2) + 1,
        status: 'ready',
        player1_id: arr[index].userId,
        player2_id: arr[index + 1]?.userId || null,
      });
      return acc;
    }, []);

    const { error: clearError } = await (supabase as any).from('tournament_matches').delete().eq('tournament_id', selectedTournament.id);
    if (clearError) return toast.error('Failed to reset previous bracket');

    const { error } = await supabase.from('tournament_matches' as any).insert(matchRows);
    if (error) return toast.error('Failed to generate Round of 16');

    await fetchManagerTournaments();
    await pushTournamentLog(`Generated Champions League Round of 16 bracket for ${selectedTournament.name}`);
    toast.success('Round of 16 bracket generated');
  };

  const messagingTrend = weeklyLearning.map((item) => ({ day: item.day, messages: item.quizzes * 2 + item.flashcards }));
  const panelClass = 'border border-primary/20 bg-background/70 backdrop-blur-xl shadow-[0_0_30px_rgba(99,102,241,0.12)]';
  const subtlePanelClass = 'border border-primary/15 bg-background/60 backdrop-blur-md';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,rgba(99,102,241,0.20),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(14,165,233,0.15),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.18),transparent_30%),hsl(var(--background))] p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 tracking-tight">
              <Crown className="h-8 w-8 text-cyan-400" />
              Manager Command Grid
            </h1>
            <p className="text-muted-foreground">Futuristic operations hub for reports, moderation, automation and platform control.</p>
          </div>
          <div className="flex items-center gap-2">
            <BackButton to="/" className={subtlePanelClass} />
            <Button variant="outline" onClick={loadDashboard} className={subtlePanelClass}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Live Data
            </Button>
            <Button variant="outline" onClick={logout} className={subtlePanelClass}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <Badge className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 text-white border-none">
              <Sparkles className="h-3 w-3 mr-1" />
              Manager Access
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {[
            { label: 'Total Students', value: stats.totalStudents, icon: Users },
            { label: 'Active Users Today', value: stats.activeUsersToday, icon: Activity },
            { label: 'Total Posts', value: stats.totalPosts, icon: BookOpen },
            { label: 'Total Messages', value: stats.totalMessages, icon: MessageSquare },
            { label: 'Total Flashcards', value: stats.totalFlashcards, icon: Zap },
            { label: 'Study Rooms', value: stats.totalStudyRooms, icon: Trophy },
            { label: 'XP Today', value: stats.xpActivityToday, icon: BarChart3 },
          ].map((item) => (
            <Card key={item.label} className={panelClass}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-xl font-bold">{item.value.toLocaleString()}</p>
                  </div>
                  <item.icon className="h-5 w-5 text-cyan-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className={`grid grid-cols-2 md:grid-cols-6 xl:grid-cols-11 h-auto p-1 ${panelClass}`}>
            <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Overview</TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Students</TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Content</TabsTrigger>
            <TabsTrigger value="social" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Social Feed</TabsTrigger>
            <TabsTrigger value="messaging" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Messaging</TabsTrigger>
            <TabsTrigger value="xp" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">XP Control</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Analytics</TabsTrigger>
            <TabsTrigger value="announcements" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Announcements</TabsTrigger>
            <TabsTrigger value="tournaments" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Tournaments</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">Settings</TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">AI Monitor</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className={panelClass}>
                <CardHeader><CardTitle>Daily Active Users</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyUsers}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Area type="monotone" dataKey="users" stroke="#6366f1" fill="#818cf8" /></AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className={panelClass}>
                <CardHeader><CardTitle>Weekly Learning Activity</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyLearning}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Bar dataKey="quizzes" fill="#06b6d4" /><Bar dataKey="flashcards" fill="#22c55e" /></BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className={panelClass}>
                <CardHeader><CardTitle>Popular Subjects</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={subjectMix} dataKey="value" nameKey="subject" outerRadius={90}>
                        {subjectMix.map((_, index) => <Cell key={index} fill={["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#6366f1"][index % 6]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className={panelClass}>
                <CardHeader><CardTitle>Top Students Leaderboard</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topStudentsChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="xp" fill="#f97316" /></BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <Card className={panelClass}>
              <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Button onClick={() => setResourceForm((prev) => ({ ...prev, type: 'book' }))}><Upload className="h-4 w-4 mr-2" />Add new books</Button>
                <Button variant="outline" onClick={() => toast.info('Use Student Management tab to ban users')}><Shield className="h-4 w-4 mr-2" />Ban / manage users</Button>
                <Button variant="outline" onClick={() => toast.info('Use Social Feed tab for moderation')}><AlertTriangle className="h-4 w-4 mr-2" />Moderate posts</Button>
                <Button variant="outline" onClick={() => toast.info('Use Announcement tab to broadcast updates')}><MessageSquare className="h-4 w-4 mr-2" />Send announcements</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Student Management</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="Search by name / ID" value={studentSearch} onChange={(e) => { setStudentPage(0); setStudentSearch(e.target.value); }} />
                  <Input placeholder="Search by email (not exposed in profile table)" disabled />
                  <Select value={studentGradeFilter} onValueChange={(value) => { setStudentPage(0); setStudentGradeFilter(value); }}>
                    <SelectTrigger><SelectValue placeholder="Filter by grade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {Array.from({ length: 12 }).map((_, i) => <SelectItem key={i + 1} value={`Grade ${i + 1}`}>Grade {i + 1}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  {students.map((s) => (
                    <div key={s.id} className="rounded-lg border p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.id} • {s.grade || 'Unassigned Grade'} • Level {s.level} • {s.xp} XP</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleStudentAction(s.id, 'suspend')}>Suspend</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleStudentAction(s.id, 'ban')}>Ban</Button>
                        <Button size="sm" variant="secondary" onClick={() => handleStudentAction(s.id, 'reset_xp')}>Reset XP</Button>
                        <Select onValueChange={(grade) => handleStudentAction(s.id, 'edit_grade', grade)}>
                          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Edit grade" /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }).map((_, i) => <SelectItem key={i + 1} value={`Grade ${i + 1}`}>Grade {i + 1}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" disabled={studentPage === 0} onClick={() => setStudentPage((p) => Math.max(0, p - 1))}>Previous</Button>
                  <Button variant="outline" onClick={() => setStudentPage((p) => p + 1)}>Next</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Educational Content Management</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input placeholder="Resource title" value={resourceForm.title} onChange={(e) => setResourceForm((p) => ({ ...p, title: e.target.value }))} />
                  <Select value={resourceForm.type} onValueChange={(value) => setResourceForm((p) => ({ ...p, type: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="book">Books</SelectItem>
                      <SelectItem value="study-note">Study notes</SelectItem>
                      <SelectItem value="flashcard-set">Flashcards</SelectItem>
                      <SelectItem value="practice-questions">Practice questions</SelectItem>
                      <SelectItem value="study-guide">Study guides</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={resourceForm.gradeBand} onValueChange={(value) => setResourceForm((p) => ({ ...p, gradeBand: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{gradeBands.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={resourceForm.subject} onValueChange={(value) => setResourceForm((p) => ({ ...p, subject: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Textarea placeholder="Description / upload notes" value={resourceForm.description} onChange={(e) => setResourceForm((p) => ({ ...p, description: e.target.value }))} />
                <div className="flex gap-2">
                  <Button onClick={handleUploadResource}><Upload className="h-4 w-4 mr-2" />Publish Resource</Button>
                  <Button variant="outline" onClick={() => toast.info('Student submissions can be reviewed from Social Feed / report queue')}>Approve Student Uploads</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Reported Posts</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-2">
                      {reports.map((r) => (
                        <div key={r.id} className="border rounded-lg p-3 space-y-1">
                          <div className="flex justify-between"><Badge>{r.reason}</Badge><Badge variant="outline">{r.status}</Badge></div>
                          <p className="text-sm">{r.description || 'No extra details provided.'}</p>
                          <p className="text-xs text-muted-foreground">Reporter: {r.reporter_id}</p>
                          <Button size="sm" variant="outline" onClick={() => handleResolveReport(r.id)}>Resolve</Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>All / Trending Posts</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[320px]">
                    <div className="space-y-2">
                      {posts.map((p) => (
                        <div key={p.id} className="border rounded-lg p-3">
                          <p className="text-sm line-clamp-2">{p.content}</p>
                          <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()} • {p.post_type}</p>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="destructive" onClick={() => handleDeletePost(p.id)}>Delete Post</Button>
                            <Button size="sm" variant="outline" onClick={() => toast.info('Use comment moderation in social module if needed')}>Remove Comments</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="messaging" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-3">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Messages Sent Today</p><p className="text-2xl font-bold">{stats.totalMessages}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Chats (estimated)</p><p className="text-2xl font-bold">{Math.max(1, Math.floor(stats.totalMessages / 8))}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">AI Harm Alerts</p><p className="text-2xl font-bold">{reports.filter((r) => r.reason.toLowerCase().includes('harm')).length}</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Chat Activity Trend (Stats Only)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={messagingTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Area dataKey="messages" fill="#14b8a6" stroke="#0d9488" /></AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="xp" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>XP & Gamification Controls</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(xpRewards).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between border rounded-lg p-3">
                    <p className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                    <Input type="number" className="w-32" value={value} onChange={(e) => setXpRewards((p) => ({ ...p, [key]: Number(e.target.value) }))} />
                  </div>
                ))}
                <div className="grid md:grid-cols-2 gap-3">
                  <Button onClick={() => { logAction('Updated XP reward configuration'); toast.success('XP rewards updated'); }}>Save XP Rewards</Button>
                  <Button variant="outline" onClick={() => { logAction('Configured seasonal rewards'); toast.success('Seasonal rewards configured'); }}>Configure Seasonal Rewards</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Analytics & Insights (filter-ready)</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-4 gap-3">
                <Select defaultValue="all"><SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent><SelectItem value="all">All Grades</SelectItem>{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i + 1} value={`${i + 1}`}>Grade {i + 1}</SelectItem>)}</SelectContent></Select>
                <Select defaultValue="all"><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent><SelectItem value="all">All Subjects</SelectItem>{subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                <Input type="date" />
                <Input type="date" />
              </CardContent>
            </Card>
            <div className="grid lg:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle>Most Studied Subjects</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={subjectMix}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="subject" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#6366f1" /></BarChart></ResponsiveContainer></CardContent></Card>
              <Card><CardHeader><CardTitle>Student Engagement Levels</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dailyUsers}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Area dataKey="users" stroke="#a855f7" fill="#d8b4fe" /></AreaChart></ResponsiveContainer></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="announcements" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Platform-wide Announcements</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Announcement title" value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} />
                <Textarea placeholder="Type announcement message" value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} />
                <Button onClick={sendAnnouncement}>Send Announcement</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tournaments" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> Tournament Control Center</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-3 gap-3">
                    {managedTournaments.map((tournament) => (
                      <button
                        key={tournament.id}
                        type="button"
                        onClick={() => setSelectedTournamentId(tournament.id)}
                        className={`text-left rounded-lg border p-3 transition ${selectedTournament?.id === tournament.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-border hover:border-cyan-500/40'}`}
                      >
                        <p className="font-semibold">{tournament.name}</p>
                        <p className="text-xs text-muted-foreground">{tournament.subject} • {tournament.players.length}/{tournament.maxPlayers} players</p>
                        <Badge className="mt-2 capitalize" variant={tournament.status === 'active' ? 'default' : 'secondary'}>{tournament.status}</Badge>
                      </button>
                    ))}
                  </div>
                  {selectedTournament && (
                    <div className="rounded-lg border p-4 space-y-4">
                      <div className="grid md:grid-cols-4 gap-3 text-sm">
                        <div className="rounded-md border p-2"><p className="text-muted-foreground">Status</p><p className="font-semibold capitalize">{selectedTournament.status}</p></div>
                        <div className="rounded-md border p-2"><p className="text-muted-foreground">Mode</p><p className="font-semibold capitalize">{selectedTournament.mode}</p></div>
                        <div className="rounded-md border p-2"><p className="text-muted-foreground">Questions</p><p className="font-semibold">{selectedTournament.questionCount}</p></div>
                        <div className="rounded-md border p-2"><p className="text-muted-foreground">Entry Fee</p><p className="font-semibold">{selectedTournament.entryFeeType === 'free' ? 'Free' : `${selectedTournament.entryFeeCoins} coins`}</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setTournamentStatus('active')}><Play className="h-4 w-4 mr-2" />Start tournament</Button>
                        <Button variant="outline" onClick={() => pushTournamentLog(`Paused ${selectedTournament.name}`)}><Pause className="h-4 w-4 mr-2" />Pause</Button>
                        <Button variant="outline" onClick={() => pushTournamentLog(`Resumed ${selectedTournament.name}`)}><Play className="h-4 w-4 mr-2" />Resume</Button>
                        <Button variant="outline" onClick={generateChampionsBracket}><SkipForward className="h-4 w-4 mr-2" />Generate R16 bracket</Button>
                        <Button variant={selectedTournament.locked ? 'secondary' : 'outline'} onClick={toggleTournamentLock}>{selectedTournament.locked ? <Lock className="h-4 w-4 mr-2" /> : <ClipboardList className="h-4 w-4 mr-2" />}{selectedTournament.locked ? 'Locked' : 'Lock tournament'}</Button>
                        <Button variant="outline" onClick={() => setTournamentStatus('finished')}>End tournament</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Gamepad2 className="h-5 w-5 text-cyan-500" /> Create Tournament</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Number of players</Label>
                    <Select value={createTournamentForm.maxPlayers} onValueChange={(value) => setCreateTournamentForm((prev) => ({ ...prev, maxPlayers: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="8">8</SelectItem>
                        <SelectItem value="16">16</SelectItem>
                        <SelectItem value="32">32</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Input value={createTournamentForm.subject} onChange={(event) => setCreateTournamentForm((prev) => ({ ...prev, subject: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Number of questions</Label>
                    <Input type="number" min={5} value={createTournamentForm.questionCount} onChange={(event) => setCreateTournamentForm((prev) => ({ ...prev, questionCount: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Mode</Label>
                    <Select value={createTournamentForm.mode} onValueChange={(value: TournamentMode) => setCreateTournamentForm((prev) => ({ ...prev, mode: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="speed">Speed</SelectItem>
                        <SelectItem value="accuracy">Accuracy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Entry fee</Label>
                    <Select value={createTournamentForm.entryFeeType} onValueChange={(value: 'coins' | 'free') => setCreateTournamentForm((prev) => ({ ...prev, entryFeeType: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="coins">Coins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {createTournamentForm.entryFeeType === 'coins' && (
                    <Input type="number" min={0} value={createTournamentForm.entryFeeCoins} onChange={(event) => setCreateTournamentForm((prev) => ({ ...prev, entryFeeCoins: event.target.value }))} />
                  )}
                  <Button className="w-full" onClick={createTournament}>Create Tournament</Button>
                </CardContent>
              </Card>
            </div>

            {selectedTournament && (
              <div className="grid xl:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-cyan-500" /> Player Control</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input placeholder="Enter player user id" value={manualPlayerName} onChange={(event) => setManualPlayerName(event.target.value)} />
                      <Button onClick={addPlayerManually}><UserPlus className="h-4 w-4 mr-2" />Add</Button>
                    </div>
                    <ScrollArea className="h-56 pr-3">
                      <div className="space-y-2">
                        {selectedTournament.players.map((player) => (
                          <div key={player.id} className="rounded-lg border p-2 flex items-center justify-between">
                            <div>
                              <p className="font-medium">{player.name}</p>
                              <p className="text-xs text-muted-foreground">Progress {player.progress}%</p>
                            </div>
                            <Button size="sm" variant="destructive" onClick={() => removePlayer(player.id)}><UserMinus className="h-4 w-4 mr-1" />Remove</Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-fuchsia-500" /> Match + Bracket Control</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <ScrollArea className="h-64 pr-3">
                      <div className="space-y-2">
                        {selectedTournament.matches.map((match) => (
                          <div key={match.id} className="rounded-lg border p-3 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{match.round}</span>
                              <Badge variant={match.status === 'live' ? 'default' : 'secondary'} className="capitalize">{match.status}</Badge>
                            </div>
                            <p className="font-semibold">{match.playerA} vs {match.playerB}</p>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => updateMatch(match.id, (m) => ({ ...m, status: 'live' }), `Force started match ${match.id} in ${selectedTournament.name}`)}>Force start</Button>
                              <Button size="sm" variant="outline" onClick={() => updateMatch(match.id, (m) => ({ ...m, status: 'finished', winner: m.playerA }), `Ended match ${match.id} manually`)}>End match</Button>
                              <Button size="sm" onClick={() => updateMatch(match.id, (m) => ({ ...m, status: 'finished', winner: m.playerB }), `Assigned winner ${match.playerB} in match ${match.id}`)}>Assign winner</Button>
                              <Button size="sm" variant="secondary" onClick={() => updateMatch(match.id, (m) => ({ ...m, playerA: m.playerB, playerB: m.playerA }), `Edited pairing for match ${match.id}`)}>Swap pairing</Button>
                            </div>
                            {match.winner && <p className="text-xs text-emerald-600">Winner: {match.winner}</p>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Reward Control</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <div><Label>Winner coins</Label><Input type="number" value={selectedTournament.rewards.winnerCoins} onChange={(event) => updateRewards('winnerCoins', Number(event.target.value))} /></div>
                    <div><Label>Winner XP</Label><Input type="number" value={selectedTournament.rewards.winnerXp} onChange={(event) => updateRewards('winnerXp', Number(event.target.value))} /></div>
                    <div><Label>Runner-up coins</Label><Input type="number" value={selectedTournament.rewards.runnerUpCoins} onChange={(event) => updateRewards('runnerUpCoins', Number(event.target.value))} /></div>
                    <div><Label>Runner-up XP</Label><Input type="number" value={selectedTournament.rewards.runnerUpXp} onChange={(event) => updateRewards('runnerUpXp', Number(event.target.value))} /></div>
                    <Button className="col-span-2" onClick={() => pushTournamentLog(`Applied rewards for ${selectedTournament.name}`)}>Give winner + runner-up rewards</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Live Monitoring + Logs</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg border p-2"><p className="text-muted-foreground">Active matches</p><p className="font-semibold">{selectedTournament.matches.filter((m) => m.status === 'live').length}</p></div>
                      <div className="rounded-lg border p-2"><p className="text-muted-foreground">Live results</p><p className="font-semibold">{selectedTournament.matches.filter((m) => m.status === 'finished').length}</p></div>
                      <div className="rounded-lg border p-2"><p className="text-muted-foreground">Player progress</p><p className="font-semibold">{Math.round(selectedTournament.players.reduce((sum, player) => sum + player.progress, 0) / Math.max(1, selectedTournament.players.length))}%</p></div>
                    </div>
                    <ScrollArea className="h-52 pr-3">
                      <div className="space-y-2">
                        {tournamentLog.map((log) => (
                          <div key={log.id} className="text-sm rounded-lg border p-2">{log.action}<span className="text-muted-foreground"> • {new Date(log.at).toLocaleString()}</span></div>
                        ))}
                        {!tournamentLog.length && <p className="text-sm text-muted-foreground">Manager tournament actions will appear here.</p>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />System Settings & Security</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    { key: 'socialFeedEnabled', label: 'Enable social feed' },
                    { key: 'aiTutorEnabled', label: 'Enable AI tutor tools' },
                    { key: 'tournamentsEnabled', label: 'Enable tournaments' },
                    { key: 'strictModeration', label: 'Strict harmful content moderation' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between border rounded-lg p-3">
                      <span>{item.label}</span>
                      <Switch checked={Boolean(systemSettings[item.key as keyof typeof systemSettings])} onCheckedChange={(checked) => setSystemSettings((p) => ({ ...p, [item.key]: checked }))} />
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label>Max Upload Size (MB)</Label>
                  <Input type="number" value={systemSettings.maxUploadMb} onChange={(e) => setSystemSettings((p) => ({ ...p, maxUploadMb: Number(e.target.value) }))} className="w-40" />
                </div>
                <Button onClick={() => { logAction('Updated global system settings'); toast.success('Settings saved'); }}>Save Settings</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Admin Action History</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-56">
                  <div className="space-y-2">
                    {activityLog.map((log) => (
                      <div key={log.id} className="text-sm border rounded-lg p-2">{log.action} <span className="text-muted-foreground">• {new Date(log.at).toLocaleString()}</span></div>
                    ))}
                    {!activityLog.length && <p className="text-sm text-muted-foreground">Actions will appear here after manager operations.</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>AI Monitoring (Optional)</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-3">
                <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">Most common student questions</p><p className="font-semibold">Algebra simplification, Cell biology, Essay structure</p></div>
                <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">AI usage frequency</p><p className="font-semibold">{Math.max(15, stats.activeUsersToday * 3)} sessions/day</p></div>
                <div className="border rounded-lg p-3"><p className="text-xs text-muted-foreground">Struggle topics detected</p><p className="font-semibold">Stoichiometry, Fractions, Grammar tenses</p></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ManagerDashboard;
