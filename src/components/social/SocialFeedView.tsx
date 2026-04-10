import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Heart, MessageCircle, Share2, Bookmark, Send, Loader2,
  ThumbsUp, PartyPopper, Flame, Trophy, Swords
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import ReportButton from './ReportButton';
import ImageUploader from './ImageUploader';

interface Post {
  id: string;
  content: string;
  imageUrl: string | null;
  postType: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatar: string | null;
  authorLevel: number;
  authorRank: string | null;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
  reactions: { type: string; count: number }[];
  userReaction: string | null;
}

interface Comment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
}

const reactionTypes = [
  { type: 'like', icon: ThumbsUp, label: '👍' },
  { type: 'love', icon: Heart, label: '❤️' },
  { type: 'celebrate', icon: PartyPopper, label: '🎉' },
  { type: 'fire', icon: Flame, label: '🔥' },
  { type: 'trophy', icon: Trophy, label: '🏆' },
];

interface SocialFeedViewProps {
  mode: 'explore' | 'following' | 'trending' | 'study';
}

const SocialFeedView: React.FC<SocialFeedViewProps> = ({ mode }) => {
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [doubleTapPost, setDoubleTapPost] = useState<string | null>(null);
  const lastTapRef = useRef<Record<string, number>>({});

  const loadPosts = useCallback(async () => {
    try {
      // Load following list
      let followingIds: string[] = [];
      if (user?.id) {
        const { data: followData } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', user.id);
        followingIds = (followData || []).map((f: any) => f.following_id);
      }

      // Build query
      let query = supabase
        .from('social_posts')
        .select('id, content, image_url, author_id, created_at, post_type, metadata')
        .eq('post_type', 'post')
        .order('created_at', { ascending: false })
        .limit(50);

      if (mode === 'following' && followingIds.length > 0) {
        query = query.in('author_id', followingIds);
      } else if (mode === 'following' && followingIds.length === 0) {
        setPosts([]);
        setIsLoading(false);
        return;
      }

      const { data: postsData, error } = await query;
      if (error) throw error;

      // Get profiles
      const authorIds = [...new Set((postsData || []).map((p: any) => p.author_id))];
      const { data: profiles } = authorIds.length
        ? await supabase.from('profiles').select('id, name, username, avatar, level, rank').in('id', authorIds)
        : { data: [] };

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

      // Get engagement data in batch
      const postIds = (postsData || []).map((p: any) => p.id);

      const [likesRes, reactionsRes, commentsRes, savedRes] = await Promise.all([
        supabase.from('social_post_likes').select('post_id, user_id').in('post_id', postIds),
        supabase.from('social_post_reactions').select('post_id, user_id, reaction_type').in('post_id', postIds),
        supabase.from('social_post_comments').select('post_id', { count: 'exact' }).in('post_id', postIds),
        user?.id
          ? supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Index likes
      const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
      (likesRes.data || []).forEach((l: any) => {
        if (!likesMap[l.post_id]) likesMap[l.post_id] = { count: 0, userLiked: false };
        likesMap[l.post_id].count++;
        if (l.user_id === user?.id) likesMap[l.post_id].userLiked = true;
      });

      // Index reactions
      const reactionsMap: Record<string, { counts: Record<string, number>; userReaction: string | null }> = {};
      (reactionsRes.data || []).forEach((r: any) => {
        if (!reactionsMap[r.post_id]) reactionsMap[r.post_id] = { counts: {}, userReaction: null };
        reactionsMap[r.post_id].counts[r.reaction_type] = (reactionsMap[r.post_id].counts[r.reaction_type] || 0) + 1;
        if (r.user_id === user?.id) reactionsMap[r.post_id].userReaction = r.reaction_type;
      });

      // Index comments count — batch via grouping
      const commentsCountMap: Record<string, number> = {};
      // We need per-post counts, do individual counts
      await Promise.all(postIds.map(async (pid: string) => {
        const { count } = await supabase.from('social_post_comments').select('id', { count: 'exact', head: true }).eq('post_id', pid);
        commentsCountMap[pid] = count || 0;
      }));

      const savedSet = new Set((savedRes.data || []).map((s: any) => s.post_id));
      const followingSet = new Set(followingIds);

      let mapped: Post[] = (postsData || []).map((post: any) => {
        const profile = profileMap[post.author_id];
        const likes = likesMap[post.id];
        const reactions = reactionsMap[post.id];
        let imageUrl: string | null = null;
        if (post.image_url) {
          if (post.image_url.startsWith('http')) {
            imageUrl = post.image_url;
          } else {
            const { data: pubData } = supabase.storage.from('social-images').getPublicUrl(post.image_url);
            imageUrl = pubData?.publicUrl || null;
          }
        }

        return {
          id: post.id,
          content: post.content,
          imageUrl,
          postType: post.post_type,
          authorId: post.author_id,
          authorName: profile?.name || 'Student',
          authorUsername: profile?.username || null,
          authorAvatar: profile?.avatar || null,
          authorLevel: profile?.level || 1,
          authorRank: profile?.rank || null,
          createdAt: post.created_at,
          likesCount: likes?.count || 0,
          commentsCount: commentsCountMap[post.id] || 0,
          isLiked: likes?.userLiked || false,
          isSaved: savedSet.has(post.id),
          isFollowing: followingSet.has(post.author_id),
          reactions: Object.entries(reactions?.counts || {}).map(([type, count]) => ({ type, count })),
          userReaction: reactions?.userReaction || null,
        };
      });

      // Apply mode filters/sorting
      if (mode === 'trending') {
        mapped.sort((a, b) => (b.likesCount + b.commentsCount * 2) - (a.likesCount + a.commentsCount * 2));
      } else if (mode === 'study') {
        // Only show posts with educational keywords
        const studyKeywords = ['quiz', 'study', 'exam', 'learn', 'flashcard', 'grade', 'math', 'science', 'book', 'question', 'answer', 'solved', 'practice'];
        mapped = mapped.filter(p => studyKeywords.some(k => p.content.toLowerCase().includes(k)));
      }

      setPosts(mapped);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, mode]);

  useEffect(() => {
    setIsLoading(true);
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const channel = supabase
      .channel(`social-feed-${mode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_posts' }, () => loadPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_post_likes' }, () => loadPosts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadPosts, mode]);

  // Double tap to like
  const handlePostTap = (postId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[postId] || 0;
    if (now - lastTap < 300) {
      // Double tap
      const post = posts.find(p => p.id === postId);
      if (post && !post.isLiked) {
        toggleLike(postId);
      }
      setDoubleTapPost(postId);
      setTimeout(() => setDoubleTapPost(null), 800);
    }
    lastTapRef.current[postId] = now;
  };

  const toggleLike = async (postId: string) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, isLiked: !p.isLiked, likesCount: p.isLiked ? p.likesCount - 1 : p.likesCount + 1 }
        : p
    ));

    try {
      if (post.isLiked) {
        await supabase.from('social_post_likes').delete().eq('post_id', postId).eq('user_id', auth.data.user.id);
      } else {
        await supabase.from('social_post_likes').insert({ post_id: postId, user_id: auth.data.user.id });
      }
    } catch {
      // Revert on error
      loadPosts();
    }
  };

  const addReaction = async (postId: string, reactionType: string) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id) return;
    try {
      await supabase.from('social_post_reactions').delete().eq('post_id', postId).eq('user_id', auth.data.user.id);
      await supabase.from('social_post_reactions').insert({ post_id: postId, user_id: auth.data.user.id, reaction_type: reactionType });
      setShowReactions(null);
      loadPosts();
    } catch {}
  };

  const toggleSave = async (postId: string) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    setPosts(prev => prev.map(p => p.id === postId ? { ...p, isSaved: !p.isSaved } : p));

    try {
      if (post.isSaved) {
        await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', auth.data.user.id);
      } else {
        await supabase.from('saved_posts').insert({ post_id: postId, user_id: auth.data.user.id });
      }
      toast.success(post.isSaved ? 'Removed from saved' : 'Saved!');
    } catch {
      loadPosts();
    }
  };

  const toggleFollow = async (targetUserId: string) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id || auth.data.user.id === targetUserId) return;

    const post = posts.find(p => p.authorId === targetUserId);
    const wasFollowing = post?.isFollowing;

    // Optimistic
    setPosts(prev => prev.map(p => p.authorId === targetUserId ? { ...p, isFollowing: !wasFollowing } : p));

    try {
      if (wasFollowing) {
        await supabase.from('followers').delete().eq('follower_id', auth.data.user.id).eq('following_id', targetUserId);
      } else {
        await supabase.from('followers').insert({ follower_id: auth.data.user.id, following_id: targetUserId });
      }
      toast.success(wasFollowing ? 'Unfollowed' : 'Following!');
    } catch {
      loadPosts();
    }
  };

  const sharePost = async (postId: string) => {
    const url = `${window.location.origin}/social#post-${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase
      .from('social_post_comments')
      .select('id, content, user_id, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    const userIds = [...new Set((data || []).map((c: any) => c.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, name').in('id', userIds)
      : { data: [] };

    const pMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { pMap[p.id] = p.name; });

    setComments(prev => ({
      ...prev,
      [postId]: (data || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        userId: c.user_id,
        userName: pMap[c.user_id] || 'Student',
        createdAt: c.created_at,
      })),
    }));
  };

  const toggleComments = (postId: string) => {
    const next = new Set(expandedComments);
    if (next.has(postId)) {
      next.delete(postId);
    } else {
      next.add(postId);
      if (!comments[postId]) loadComments(postId);
    }
    setExpandedComments(next);
  };

  const addComment = async (postId: string) => {
    const text = newComments[postId];
    const auth = await supabase.auth.getUser();
    if (!text?.trim() || !auth.data.user?.id) return;

    try {
      await supabase.from('social_post_comments').insert({
        post_id: postId,
        user_id: auth.data.user.id,
        content: text.trim(),
      });
      setNewComments(prev => ({ ...prev, [postId]: '' }));
      loadComments(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p));
    } catch {
      toast.error('Failed to add comment');
    }
  };

  const getRankColor = (rank: string | null) => {
    if (!rank) return 'text-muted-foreground';
    const r = rank.toLowerCase();
    if (r.includes('grand') || r.includes('master')) return 'text-amber-400';
    if (r.includes('diamond')) return 'text-cyan-400';
    if (r.includes('plat')) return 'text-emerald-400';
    if (r.includes('gold')) return 'text-yellow-500';
    if (r.includes('silver')) return 'text-gray-400';
    if (r.includes('bronze')) return 'text-orange-400';
    return 'text-muted-foreground';
  };

  if (isLoading) {
    return (
      <div className="px-4 py-6 space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="text-muted-foreground text-sm">
          {mode === 'following'
            ? 'Follow students to see their posts here.'
            : mode === 'study'
            ? 'No study-related posts yet. Share your progress!'
            : 'No posts yet. Be the first to share!'}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {posts.map((post) => (
        <article
          key={post.id}
          className="px-4 py-4 relative"
          onClick={() => handlePostTap(post.id)}
        >
          {/* Double-tap heart animation */}
          {doubleTapPost === post.id && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              <Heart className="h-20 w-20 text-red-500 fill-red-500 animate-scale-in opacity-80" />
            </div>
          )}

          {/* Author Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-border/50">
                <AvatarFallback className="bg-muted text-foreground font-semibold text-sm">
                  {post.authorName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-foreground">{post.authorName}</span>
                  {post.authorRank && (
                    <span className={`text-[10px] font-bold ${getRankColor(post.authorRank)}`}>
                      {post.authorRank}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    Lv.{post.authorLevel}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {post.authorUsername ? `@${post.authorUsername} · ` : ''}
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {post.authorId !== user?.id && (
                <Button
                  variant={post.isFollowing ? 'secondary' : 'default'}
                  size="sm"
                  className="h-7 text-xs px-3 rounded-full"
                  onClick={(e) => { e.stopPropagation(); toggleFollow(post.authorId); }}
                >
                  {post.isFollowing ? 'Following' : 'Follow'}
                </Button>
              )}
              <ReportButton reportedType="post" reportedId={post.id} />
            </div>
          </div>

          {/* Content */}
          <p className="text-sm text-foreground whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>

          {/* Image */}
          {post.imageUrl && (
            <div className="rounded-xl overflow-hidden mb-3 -mx-1">
              <img
                src={post.imageUrl}
                alt="Post"
                className="w-full max-h-[480px] object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Reactions Summary */}
          {post.reactions.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              {post.reactions.map(r => {
                const cfg = reactionTypes.find(rt => rt.type === r.type);
                return cfg ? (
                  <span key={r.type} className="text-xs">
                    {cfg.label} {r.count}
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
            <div className="relative flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className={`h-9 px-2 ${post.isLiked ? 'text-red-500' : 'text-muted-foreground'}`}
                onClick={() => toggleLike(post.id)}
                onMouseEnter={() => setShowReactions(post.id)}
              >
                <Heart className={`h-5 w-5 ${post.isLiked ? 'fill-current' : ''}`} />
                <span className="ml-1 text-xs">{post.likesCount || ''}</span>
              </Button>

              {showReactions === post.id && (
                <div
                  className="absolute bottom-full left-0 mb-1 flex gap-0.5 p-1.5 rounded-full bg-card border border-border shadow-xl z-30"
                  onMouseLeave={() => setShowReactions(null)}
                >
                  {reactionTypes.map(r => (
                    <button
                      key={r.type}
                      className={`text-lg hover:scale-150 transition-transform p-1 ${post.userReaction === r.type ? 'scale-125' : ''}`}
                      onClick={() => addReaction(post.id, r.type)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-muted-foreground"
              onClick={() => toggleComments(post.id)}
            >
              <MessageCircle className="h-5 w-5" />
              <span className="ml-1 text-xs">{post.commentsCount || ''}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-muted-foreground"
              onClick={() => sharePost(post.id)}
            >
              <Share2 className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`h-9 px-2 ${post.isSaved ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={() => toggleSave(post.id)}
            >
              <Bookmark className={`h-5 w-5 ${post.isSaved ? 'fill-current' : ''}`} />
            </Button>
          </div>

          {/* Comments */}
          {expandedComments.has(post.id) && (
            <div className="mt-3 space-y-2.5 border-t border-border/30 pt-3" onClick={(e) => e.stopPropagation()}>
              {(comments[post.id] || []).map(c => (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] bg-muted">{c.userName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-muted/40 rounded-xl px-3 py-2">
                    <span className="text-xs font-semibold">{c.userName}</span>
                    <p className="text-xs text-foreground">{c.content}</p>
                  </div>
                </div>
              ))}

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newComments[post.id] || ''}
                  onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                  placeholder="Add a comment..."
                  className="flex-1 bg-muted/30 rounded-full px-4 py-2 text-xs outline-none border border-border/40 focus:border-primary/50"
                  onKeyDown={(e) => e.key === 'Enter' && addComment(post.id)}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => addComment(post.id)}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
};

export default SocialFeedView;
