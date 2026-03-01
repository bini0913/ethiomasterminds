import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/context/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Heart, MessageCircle, Share2, Bookmark, MoreHorizontal,
  Image as ImageIcon, Send, Loader2, ThumbsUp, PartyPopper, 
  Flame, Smile, Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import ReportButton from './ReportButton';
import ImageUploader from './ImageUploader';

interface Post {
  id: string;
  content: string;
  imageUrl: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorLevel: number;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
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
  { type: 'like', icon: ThumbsUp, color: 'text-blue-500' },
  { type: 'love', icon: Heart, color: 'text-red-500' },
  { type: 'celebrate', icon: PartyPopper, color: 'text-yellow-500' },
  { type: 'fire', icon: Flame, color: 'text-orange-500' },
  { type: 'trophy', icon: Trophy, color: 'text-amber-500' },
];

const EnhancedSocialFeed: React.FC = () => {
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [newPostImagePath, setNewPostImagePath] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [showReactions, setShowReactions] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    try {
      // First get posts
      const { data: postsData, error } = await supabase
        .from('social_posts')
        .select('id, content, image_url, author_id, created_at')
        .eq('post_type', 'post')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Then get author profiles separately
      const authorIds = [...new Set((postsData || []).map((p: any) => p.author_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar, level')
        .in('id', authorIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = p;
      });

      // Get likes, reactions, saves for each post
      const postsWithData = await Promise.all((postsData || []).map(async (post: any) => {
        let imageUrl: string | null = null;
        if (post.image_url) {
          if (post.image_url.startsWith('http://') || post.image_url.startsWith('https://')) {
            imageUrl = post.image_url;
          } else {
            const { data: signedData, error: signedError } = await supabase.storage.from('user-uploads').createSignedUrl(post.image_url, 3600);
            if (signedError) {
              console.error('Error creating signed URL for post image:', signedError);
            }
            imageUrl = signedData?.signedUrl || null;
          }
        }
        const authorProfile = profileMap[post.author_id];
        
        const [likesRes, reactionsRes, savedRes, commentsRes] = await Promise.all([
          supabase.from('social_post_likes').select('id', { count: 'exact' }).eq('post_id', post.id),
          supabase.from('social_post_reactions').select('reaction_type').eq('post_id', post.id),
          user?.id ? supabase.from('saved_posts').select('id').eq('post_id', post.id).eq('user_id', user.id) : { data: [] },
          supabase.from('social_post_comments').select('id', { count: 'exact' }).eq('post_id', post.id),
        ]);

        // Check if user liked/reacted
        let isLiked = false;
        let userReaction: string | null = null;
        if (user?.id) {
          const { data: userLike } = await supabase
            .from('social_post_likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .maybeSingle();
          isLiked = !!userLike;

          const { data: userReact } = await supabase
            .from('social_post_reactions')
            .select('reaction_type')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .maybeSingle();
          userReaction = userReact?.reaction_type || null;
        }

        // Group reactions by type
        const reactionCounts: Record<string, number> = {};
        (reactionsRes.data || []).forEach((r: any) => {
          reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
        });

        return {
          id: post.id,
          content: post.content,
          imageUrl,
          authorId: post.author_id,
          authorName: authorProfile?.name || 'User',
          authorAvatar: authorProfile?.avatar,
          authorLevel: authorProfile?.level || 1,
          createdAt: post.created_at,
          likesCount: likesRes.count || 0,
          commentsCount: commentsRes.count || 0,
          isLiked,
          isSaved: (savedRes.data || []).length > 0,
          reactions: Object.entries(reactionCounts).map(([type, count]) => ({ type, count })),
          userReaction,
        };
      }));

      setPosts(postsWithData);
    } catch (error) {
      console.error('Error loading posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const channel = supabase
      .channel('social-feed-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_posts' }, () => loadPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_post_comments' }, () => loadPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_post_likes' }, () => loadPosts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPosts]);

  const createPost = async () => {
    const auth = await supabase.auth.getUser();
    if (!newPostContent.trim() || !auth.data.user?.id) return;

    setIsPosting(true);
    try {
      const { error } = await supabase.from('social_posts').insert({
        author_id: auth.data.user.id,
        content: newPostContent.trim(),
        image_url: newPostImagePath,
        post_type: 'post',
      });

      if (error) throw error;

      toast.success('Post created!');
      setNewPostContent('');
      setNewPostImage(null);
      setNewPostImagePath(null);
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setIsPosting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.isLiked) {
        await supabase
          .from('social_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', auth.data.user.id);
      } else {
        const { error } = await supabase.from('social_post_likes').insert({
          post_id: postId,
          user_id: auth.data.user.id,
        });
        if (error) throw error;
      }

      await loadPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Could not update like status');
    }
  };

  const addReaction = async (postId: string, reactionType: string) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id) return;

    try {
      // Remove existing reaction if any
      await supabase
        .from('social_post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', auth.data.user.id);

      // Add new reaction
      await supabase.from('social_post_reactions').insert({
        post_id: postId,
        user_id: auth.data.user.id,
        reaction_type: reactionType,
      });

      setShowReactions(null);
      loadPosts();
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const toggleSave = async (postId: string) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.isSaved) {
        await supabase
          .from('saved_posts')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', auth.data.user.id);
      } else {
        await supabase.from('saved_posts').insert({
          post_id: postId,
          user_id: auth.data.user.id,
        });
      }

      await loadPosts();

      toast.success(post.isSaved ? 'Removed from saved' : 'Saved!');
    } catch (error) {
      console.error('Error toggling save:', error);
      toast.error('Could not update saved posts');
    }
  };

  const loadComments = async (postId: string) => {
    // First get comments
    const { data: commentsData, error } = await supabase
      .from('social_post_comments')
      .select('id, content, user_id, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading comments:', error);
      return;
    }

    // Then get user profiles
    const userIds = [...new Set((commentsData || []).map((c: any) => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => {
      profileMap[p.id] = p;
    });

    setComments(prev => ({
      ...prev,
      [postId]: (commentsData || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        userId: c.user_id,
        userName: profileMap[c.user_id]?.name || 'User',
        createdAt: c.created_at,
      })),
    }));
  };

  const toggleComments = (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
      if (!comments[postId]) {
        loadComments(postId);
      }
    }
    setExpandedComments(newExpanded);
  };

  const addComment = async (postId: string) => {
    const commentText = newComments[postId];
    const auth = await supabase.auth.getUser();
    if (!commentText?.trim() || !auth.data.user?.id) return;

    try {
      await supabase.from('social_post_comments').insert({
        post_id: postId,
        user_id: auth.data.user.id,
        content: commentText.trim(),
      });

      setNewComments(prev => ({ ...prev, [postId]: '' }));
      loadComments(postId);
      loadPosts();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Create Post */}
      <Card className="glass border-border/50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                {user?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
              <div className="flex-1 space-y-3">
              <Textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What's on your mind?"
                className="min-h-[80px] resize-none"
              />
              {newPostImage && (
                <div className="relative">
                  <img src={newPostImage} alt="Upload preview" className="rounded-lg max-h-64 object-cover" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => { setNewPostImage(null); setNewPostImagePath(null); }}
                  >
                    Remove
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between">
                {user?.id && (
                  <ImageUploader 
                    userId={user.id} 
                    onUpload={({ path, previewUrl }) => {
                      setNewPostImagePath(path);
                      setNewPostImage(previewUrl);
                    }}
                    onRemove={() => {
                      setNewPostImage(null);
                      setNewPostImagePath(null);
                    }}
                    imageUrl={newPostImage || undefined}
                  />
                )}
                <Button 
                  onClick={createPost} 
                  disabled={isPosting || !newPostContent.trim()}
                >
                  {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Post
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <Card className="glass border-border/50">
          <CardContent className="py-12 text-center">
            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
          </CardContent>
        </Card>
      ) : (
        posts.map((post) => (
          <Card key={post.id} className="glass border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                      {post.authorName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{post.authorName}</span>
                      <Badge variant="secondary" className="text-xs">
                        Lv.{post.authorLevel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ReportButton 
                    reportedType="post" 
                    reportedId={post.id} 
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap">{post.content}</p>
              
              {post.imageUrl && (
                <img 
                  src={post.imageUrl} 
                  alt="Post image" 
                  className="rounded-lg w-full max-h-96 object-cover"
                />
              )}

              {/* Reactions Summary */}
              {post.reactions.length > 0 && (
                <div className="flex items-center gap-1">
                  {post.reactions.slice(0, 3).map((reaction) => {
                    const reactionConfig = reactionTypes.find(r => r.type === reaction.type);
                    if (!reactionConfig) return null;
                    const Icon = reactionConfig.icon;
                    return (
                      <div key={reaction.type} className={`flex items-center gap-1 ${reactionConfig.color}`}>
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{reaction.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-1 relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={post.isLiked ? 'text-red-500' : ''}
                    onClick={() => toggleLike(post.id)}
                    onMouseEnter={() => setShowReactions(post.id)}
                  >
                    <Heart className={`h-4 w-4 mr-1 ${post.isLiked ? 'fill-current' : ''}`} />
                    {post.likesCount}
                  </Button>
                  
                  {/* Reactions Popup */}
                  {showReactions === post.id && (
                    <div 
                      className="absolute bottom-full left-0 mb-2 flex gap-1 p-2 rounded-full bg-card border border-border shadow-lg"
                      onMouseLeave={() => setShowReactions(null)}
                    >
                      {reactionTypes.map((reaction) => {
                        const Icon = reaction.icon;
                        return (
                          <Button
                            key={reaction.type}
                            variant="ghost"
                            size="sm"
                            className={`h-8 w-8 p-0 hover:scale-125 transition-transform ${
                              post.userReaction === reaction.type ? reaction.color : ''
                            }`}
                            onClick={() => addReaction(post.id, reaction.type)}
                          >
                            <Icon className="h-5 w-5" />
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleComments(post.id)}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  {post.commentsCount}
                </Button>
                
                <Button variant="ghost" size="sm">
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className={post.isSaved ? 'text-primary' : ''}
                  onClick={() => toggleSave(post.id)}
                >
                  <Bookmark className={`h-4 w-4 ${post.isSaved ? 'fill-current' : ''}`} />
                </Button>
              </div>

              {/* Comments Section */}
              {expandedComments.has(post.id) && (
                <div className="space-y-3 pt-3 border-t border-border/50">
                  {(comments[post.id] || []).map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {comment.userName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-muted/50 rounded-lg p-2">
                        <p className="text-sm font-medium">{comment.userName}</p>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {user?.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={newComments[post.id] || ''}
                        onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Write a comment..."
                        className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                        onKeyPress={(e) => e.key === 'Enter' && addComment(post.id)}
                      />
                      <Button size="sm" onClick={() => addComment(post.id)}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default EnhancedSocialFeed;
