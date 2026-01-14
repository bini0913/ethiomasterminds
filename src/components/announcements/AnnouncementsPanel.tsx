import React, { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, ChevronDown, ChevronUp, MessageSquare, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
  author_name?: string;
  is_read: boolean;
}

interface AnnouncementsPanelProps {
  userRole?: 'student' | 'teacher' | 'admin' | 'manager';
  classIds?: string[];
  maxHeight?: string;
  collapsed?: boolean;
}

const AnnouncementsPanel: React.FC<AnnouncementsPanelProps> = ({
  userRole = 'student',
  classIds = [],
  maxHeight = '300px',
  collapsed: initialCollapsed = false
}) => {
  const { user } = useUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAnnouncements();
      setupRealtime();
    }
  }, [user, userRole, classIds]);

  const fetchAnnouncements = async () => {
    if (!user) return;

    try {
      // Build query based on target types the user should see
      let query = supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data, error } = await query;

      if (error) throw error;

      // Filter client-side for proper target matching
      const filtered = (data || []).filter(a => {
        if (a.target_type === 'all') return true;
        if (a.target_type === 'students' && userRole === 'student') return true;
        if (a.target_type === 'teachers' && (userRole === 'teacher' || userRole === 'admin' || userRole === 'manager')) return true;
        if (a.target_id === user.id) return true;
        if (a.target_type === 'class' && classIds.includes(a.target_id || '')) return true;
        return false;
      });

      // Fetch read status
      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);

      const readIds = new Set((reads || []).map(r => r.announcement_id));

      // Fetch author names
      const authorIds = [...new Set(filtered.map(a => a.author_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', authorIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p.name]));

      const withReadStatus: Announcement[] = filtered.map(a => ({
        ...a,
        is_read: readIds.has(a.id),
        author_name: profileMap.get(a.author_id) || 'Unknown'
      }));

      setAnnouncements(withReadStatus);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'announcements'
      }, () => {
        fetchAnnouncements();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (announcementId: string) => {
    if (!user) return;

    try {
      // Use insert with onConflict handling - if already read, do nothing
      const { error } = await supabase
        .from('announcement_reads')
        .insert({
          announcement_id: announcementId,
          user_id: user.id
        });
      
      // Ignore unique constraint violations - means it's already read
      if (error && error.code !== '23505') {
        throw error;
      }

      setAnnouncements(prev => 
        prev.map(a => a.id === announcementId ? { ...a, is_read: true } : a)
      );
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const unreadCount = announcements.filter(a => !a.is_read).length;

  if (loading) {
    return (
      <Card className="glass border-border/30">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/30">
      <CardHeader 
        className="pb-3 cursor-pointer" 
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Announcements
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0">
              {announcements.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No announcements yet</p>
                </div>
              ) : (
                <ScrollArea style={{ maxHeight }} className="pr-4">
                  <div className="space-y-3">
                    {announcements.map(announcement => (
                      <motion.div
                        key={announcement.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                          !announcement.is_read 
                            ? 'bg-primary/10 border-primary/30' 
                            : 'bg-muted/30 border-border/50'
                        }`}
                        onClick={() => {
                          if (!announcement.is_read) {
                            markAsRead(announcement.id);
                          }
                          setExpandedId(expandedId === announcement.id ? null : announcement.id);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {!announcement.is_read && (
                                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                              )}
                              <h4 className="font-medium text-foreground truncate">
                                {announcement.title}
                              </h4>
                            </div>
                            
                            <AnimatePresence>
                              {expandedId === announcement.id ? (
                                <motion.p
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="text-sm text-muted-foreground mb-2"
                                >
                                  {announcement.content}
                                </motion.p>
                              ) : (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {announcement.content}
                                </p>
                              )}
                            </AnimatePresence>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span>By {announcement.author_name}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                          
                          {announcement.is_read && (
                            <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export default AnnouncementsPanel;
