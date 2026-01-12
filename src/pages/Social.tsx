import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import AvatarRenderer from '@/components/avatar/AvatarRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, MessageCircle, Send, Trophy, Award, Bell, 
  Loader2, Share2, MoreHorizontal, Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  author_id: string;
  post_type: 'post' | 'achievement' | 'announcement';
  content: string;
  metadata: any;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
  author_level?: number;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

const Social: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchPosts();
    setupRealtime();
  }, [user]);

  const fetchPosts = async () => {
    try {
      // Fetch posts
      const { data: postsData, error } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // Get unique author IDs
      const authorIds = [...new Set(postsData.map(p => p.author_id))];

      // Fetch author profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar, level')
        .in('id', authorIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Fetch likes for current user
      const { data: userLikes } = await supabase
        .from('social_post_likes')
        .select('post_id')
        .eq('user_id', user?.id || '');

      const likedPostIds = new Set((userLikes || []).map(l => l.post_id));

      // Fetch like counts
      const postIds = postsData.map(p => p.id);
      const { data: likeCounts } = await supabase
        .from('social_post_likes')
        .select('post_id')
        .in('post_id', postIds);

      const likeCountMap = new Map<string, number>();
      (likeCounts || []).forEach(l => {
        likeCountMap.set(l.post_id, (likeCountMap.get(l.post_id) || 0) + 1);
      });

      // Fetch comment counts
      const { data: commentCounts } = await supabase
        .from('social_post_comments')
        .select('post_id')
        .in('post_id', postIds);

      const commentCountMap = new Map<string, number>();
      (commentCounts || []).forEach(c => {
        commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) || 0) + 1);
      });

      const enrichedPosts: Post[] = postsData.map(p => {
        const author = profileMap.get(p.author_id);
        return {
          ...p,
          post_type: p.post_type as Post['post_type'],
          author_name: author?.name || 'Unknown',
          author_avatar: author?.avatar || 'avatar-1',
          author_level: author?.level || 1,
          likes_count: likeCountMap.get(p.id) || 0,
          comments_count: commentCountMap.get(p.id) || 0,
          is_liked: likedPostIds.has(p.id)
        };
      });

      setPosts(enrichedPosts);
    } catch (err) {
      console.error('Error fetching posts:', err);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel('social-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'social_posts'
      }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createPost = async () => {
    if (!user || !newPostContent.trim()) return;

    setPosting(true);
    try {
      const { error } = await supabase
        .from('social_posts')
        .insert({
          author_id: user.id,
          post_type: 'post',
          content: newPostContent.trim()
        });

      if (error) throw error;

      toast.success('Post created!');
      setNewPostContent('');
      fetchPosts();
    } catch (err) {
      console.error('Error creating post:', err);
      toast.error('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!user) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.is_liked) {
        // Unlike
        await supabase
          .from('social_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, is_liked: false, likes_count: Math.max(0, p.likes_count - 1) }
            : p
        ));
      } else {
        // Like
        await supabase
          .from('social_post_likes')
          .insert({ post_id: postId, user_id: user.id });

        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, is_liked: true, likes_count: p.likes_count + 1 }
            : p
        ));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments(postId);
    try {
      const { data, error } = await supabase
        .from('social_post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch comment author profiles
      const authorIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .in('id', authorIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enrichedComments: Comment[] = (data || []).map(c => ({
        ...c,
        user_name: profileMap.get(c.user_id)?.name || 'Unknown',
        user_avatar: profileMap.get(c.user_id)?.avatar || 'avatar-1'
      }));

      setComments(prev => ({ ...prev, [postId]: enrichedComments }));
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(null);
    }
  };

  const addComment = async (postId: string) => {
    if (!user || !commentInput[postId]?.trim()) return;

    try {
      const { error } = await supabase
        .from('social_post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: commentInput[postId].trim()
        });

      if (error) throw error;

      setCommentInput(prev => ({ ...prev, [postId]: '' }));
      fetchComments(postId);
      
      // Update comment count
      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
      ));
    } catch (err) {
      console.error('Error adding comment:', err);
      toast.error('Failed to add comment');
    }
  };

  const getPostIcon = (postType: string) => {
    switch (postType) {
      case 'achievement': return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'announcement': return <Bell className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  const getPostBadge = (postType: string) => {
    switch (postType) {
      case 'achievement': return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Achievement</Badge>;
      case 'announcement': return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Announcement</Badge>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground variant="minimal" />
      
      <div className="relative z-10 container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <BackButton />
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Social Feed</h1>
            <p className="text-sm text-muted-foreground">Share achievements and connect with friends</p>
          </div>
        </div>

        {/* Create Post */}
        <Card className="glass border-border/30 mb-6">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AvatarRenderer avatar={user?.avatar} size="md" />
              <div className="flex-1">
                <Textarea
                  placeholder="Share something with the community..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="min-h-[80px] resize-none bg-muted/30 border-border/50"
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" disabled>
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Photo
                    </Button>
                  </div>
                  <Button 
                    onClick={createPost}
                    disabled={!newPostContent.trim() || posting}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="glass border-border/30">
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-display text-lg mb-2">No posts yet</h3>
              <p className="text-muted-foreground">Be the first to share something!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="glass border-border/30 overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <AvatarRenderer avatar={post.author_avatar} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{post.author_name}</span>
                            <span className="text-xs text-muted-foreground">Lv.{post.author_level}</span>
                            {getPostIcon(post.post_type)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPostBadge(post.post_type)}
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 pb-3">
                    <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
                  </CardContent>

                  {/* Actions */}
                  <div className="px-4 py-2 border-t border-border/30 flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLike(post.id)}
                      className={post.is_liked ? 'text-red-500' : 'text-muted-foreground'}
                    >
                      <Heart className={`h-4 w-4 mr-1 ${post.is_liked ? 'fill-current' : ''}`} />
                      {post.likes_count}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (expandedComments === post.id) {
                          setExpandedComments(null);
                        } else {
                          setExpandedComments(post.id);
                          if (!comments[post.id]) {
                            fetchComments(post.id);
                          }
                        }
                      }}
                      className="text-muted-foreground"
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      {post.comments_count}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      <Share2 className="h-4 w-4 mr-1" />
                      Share
                    </Button>
                  </div>

                  {/* Comments Section */}
                  <AnimatePresence>
                    {expandedComments === post.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border/30"
                      >
                        <div className="p-4 space-y-3">
                          {loadingComments === post.id ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                          ) : (
                            <>
                              {(comments[post.id] || []).map(comment => (
                                <div key={comment.id} className="flex gap-2">
                                  <AvatarRenderer avatar={comment.user_avatar} size="sm" />
                                  <div className="flex-1 bg-muted/30 rounded-lg p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium">{comment.user_name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                      </span>
                                    </div>
                                    <p className="text-sm">{comment.content}</p>
                                  </div>
                                </div>
                              ))}

                              {/* Add Comment */}
                              <div className="flex gap-2 pt-2">
                                <AvatarRenderer avatar={user?.avatar} size="sm" />
                                <div className="flex-1 flex gap-2">
                                  <Input
                                    placeholder="Write a comment..."
                                    value={commentInput[post.id] || ''}
                                    onChange={(e) => setCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        addComment(post.id);
                                      }
                                    }}
                                    className="bg-muted/30"
                                  />
                                  <Button
                                    size="icon"
                                    onClick={() => addComment(post.id)}
                                    disabled={!commentInput[post.id]?.trim()}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Social;
