import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ArrowBigUp, Loader2, Lightbulb, Search, Sparkles, TrendingUp } from 'lucide-react';

type BoardPost = {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
  votes: number;
  hasVoted: boolean;
  postType: 'support_request' | 'feature_request';
  metadata: Record<string, any> | null;
};

const SocialSupportHub: React.FC = () => {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [supportPosts, setSupportPosts] = useState<BoardPost[]>([]);
  const [featurePosts, setFeaturePosts] = useState<BoardPost[]>([]);
  const [supportText, setSupportText] = useState('');
  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDetails, setFeatureDetails] = useState('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [isSubmittingFeature, setIsSubmittingFeature] = useState(false);
  const [isVoting, setIsVoting] = useState<string | null>(null);
  const [supportSearch, setSupportSearch] = useState('');
  const [featureSearch, setFeatureSearch] = useState('');

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: postsData, error } = await supabase
        .from('social_posts')
        .select('id, content, created_at, author_id, post_type, metadata')
        .in('post_type', ['support_request', 'feature_request'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const authorIds = [...new Set((postsData || []).map((p: any) => p.author_id))];
      const [{ data: profiles }, { data: likesData }] = await Promise.all([
        authorIds.length
          ? supabase.from('profiles').select('id, name').in('id', authorIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('social_post_likes').select('post_id, user_id').in('post_id', (postsData || []).map((p: any) => p.id)),
      ]);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((profile: any) => {
        profileMap[profile.id] = profile.name || 'Student';
      });

      const likesByPost: Record<string, { count: number; hasVoted: boolean }> = {};
      (likesData || []).forEach((like: any) => {
        if (!likesByPost[like.post_id]) likesByPost[like.post_id] = { count: 0, hasVoted: false };
        likesByPost[like.post_id].count += 1;
        if (like.user_id === user?.id) {
          likesByPost[like.post_id].hasVoted = true;
        }
      });

      const mappedPosts: BoardPost[] = (postsData || []).map((post: any) => ({
        id: post.id,
        content: post.content,
        createdAt: post.created_at,
        authorName: profileMap[post.author_id] || 'Student',
        votes: likesByPost[post.id]?.count || 0,
        hasVoted: likesByPost[post.id]?.hasVoted || false,
        postType: post.post_type,
        metadata: post.metadata && typeof post.metadata === 'object' ? post.metadata : null,
      }));

      const support = mappedPosts.filter((post) => post.postType === 'support_request');
      const feature = mappedPosts
        .filter((post) => post.postType === 'feature_request')
        .sort((a, b) => b.votes - a.votes || +new Date(b.createdAt) - +new Date(a.createdAt));

      setSupportPosts(support);
      setFeaturePosts(feature);
    } catch (err) {
      console.error('Failed to load support board:', err);
      toast.error('Could not load support board');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const channel = supabase
      .channel('social-support-board-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_posts' }, loadBoard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_post_likes' }, loadBoard)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBoard]);

  const submitSupportRequest = async () => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id || !supportText.trim()) return;

    setIsSubmittingSupport(true);
    try {
      const { error } = await supabase.from('social_posts').insert({
        author_id: auth.data.user.id,
        content: supportText.trim(),
        post_type: 'support_request',
      });

      if (error) throw error;
      setSupportText('');
      toast.success('Support request sent to the team.');
      loadBoard();
    } catch (err) {
      console.error('Support request failed:', err);
      toast.error('Could not send support request');
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  const submitFeatureRequest = async () => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id || !featureTitle.trim()) return;

    setIsSubmittingFeature(true);
    try {
      const details = featureDetails.trim();
      const composedContent = details ? `${featureTitle.trim()}\n\n${details}` : featureTitle.trim();
      const { error } = await supabase.from('social_posts').insert({
        author_id: auth.data.user.id,
        content: composedContent,
        post_type: 'feature_request',
        metadata: {
          title: featureTitle.trim(),
          details,
        },
      });

      if (error) throw error;
      setFeatureTitle('');
      setFeatureDetails('');
      toast.success('Feature request created. Ask classmates to vote!');
      loadBoard();
    } catch (err) {
      console.error('Feature request failed:', err);
      toast.error('Could not create feature request');
    } finally {
      setIsSubmittingFeature(false);
    }
  };

  const toggleVote = async (post: BoardPost) => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user?.id) return;

    setIsVoting(post.id);
    try {
      if (post.hasVoted) {
        await supabase
          .from('social_post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', auth.data.user.id);
      } else {
        await supabase.from('social_post_likes').insert({
          post_id: post.id,
          user_id: auth.data.user.id,
        });
      }

      loadBoard();
    } catch (err) {
      console.error('Vote action failed:', err);
      toast.error('Could not update vote');
    } finally {
      setIsVoting(null);
    }
  };

  const emptyStateText = useMemo(
    () => ({
      support: 'No support issues reported yet. Be the first to tell the team what is blocking you.',
      feature: 'No feature requests yet. Share an idea and let students vote on it.',
    }),
    [],
  );

  const filteredSupportPosts = useMemo(() => {
    const keyword = supportSearch.trim().toLowerCase();
    if (!keyword) return supportPosts;

    return supportPosts.filter((post) => {
      const content = post.content.toLowerCase();
      const author = post.authorName.toLowerCase();
      return content.includes(keyword) || author.includes(keyword);
    });
  }, [supportPosts, supportSearch]);

  const filteredFeaturePosts = useMemo(() => {
    const keyword = featureSearch.trim().toLowerCase();
    if (!keyword) return featurePosts;

    return featurePosts.filter((post) => {
      const title = ((post.metadata?.title as string | undefined) || post.content.split('\n')[0]).toLowerCase();
      const details = ((post.metadata?.details as string | undefined) || post.content).toLowerCase();
      return title.includes(keyword) || details.includes(keyword) || post.authorName.toLowerCase().includes(keyword);
    });
  }, [featurePosts, featureSearch]);

  const topFeature = featurePosts[0];

  return (
    <Card className="bg-card/80 border-border/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl">Student Support & Feature Voting</CardTitle>
        <CardDescription>
          Report problems to the support team and suggest new features. Feature requests with the most votes are prioritized.
        </CardDescription>
        <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Open support reports</p>
            <p className="text-lg font-semibold">{supportPosts.length}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Feature ideas</p>
            <p className="text-lg font-semibold">{featurePosts.length}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Top voted idea</p>
            <p className="text-sm font-semibold truncate">{topFeature ? ((topFeature.metadata?.title as string | undefined) || 'Untitled idea') : '—'}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="support" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="support" className="gap-2"><AlertTriangle className="h-4 w-4" />Support Team</TabsTrigger>
            <TabsTrigger value="features" className="gap-2"><Lightbulb className="h-4 w-4" />Feature Votes</TabsTrigger>
          </TabsList>

          <TabsContent value="support" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report a problem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Explain the issue you are facing in the app..."
                  value={supportText}
                  onChange={(e) => setSupportText(e.target.value)}
                  className="min-h-28"
                />
                <p className="text-xs text-muted-foreground">{supportText.length}/500 characters</p>
                <Button onClick={submitSupportRequest} disabled={isSubmittingSupport || !supportText.trim()}>
                  {isSubmittingSupport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Send to support team
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={supportSearch}
                  onChange={(e) => setSupportSearch(e.target.value)}
                  placeholder="Search support requests"
                  className="pl-9"
                />
              </div>
              {isLoading && <p className="text-sm text-muted-foreground">Loading support requests...</p>}
              {!isLoading && filteredSupportPosts.length === 0 && <p className="text-sm text-muted-foreground">{emptyStateText.support}</p>}
              {filteredSupportPosts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7"><AvatarFallback>{post.authorName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                        <span className="text-sm font-medium">{post.authorName}</span>
                      </div>
                      <Badge variant="outline">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</Badge>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suggest a feature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Feature title (example: Dark mode for quiz page)"
                  value={featureTitle}
                  onChange={(e) => setFeatureTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Optional details about how this feature should work..."
                  value={featureDetails}
                  onChange={(e) => setFeatureDetails(e.target.value)}
                  className="min-h-24"
                />
                <p className="text-xs text-muted-foreground">{featureTitle.length + featureDetails.length}/600 characters</p>
                <Button onClick={submitFeatureRequest} disabled={isSubmittingFeature || !featureTitle.trim()}>
                  {isSubmittingFeature ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Submit feature idea
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Ranked by votes and recency
                </div>
                <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />Community picks</Badge>
              </div>
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                  placeholder="Search feature ideas"
                  className="pl-9"
                />
              </div>
              {isLoading && <p className="text-sm text-muted-foreground">Loading feature requests...</p>}
              {!isLoading && filteredFeaturePosts.length === 0 && <p className="text-sm text-muted-foreground">{emptyStateText.feature}</p>}
              {filteredFeaturePosts.map((post) => {
                const title = (post.metadata?.title as string | undefined) || post.content.split('\n')[0];
                const details = (post.metadata?.details as string | undefined) || post.content;

                return (
                  <Card key={post.id}>
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{title}</p>
                          <p className="text-xs text-muted-foreground">By {post.authorName} • {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={post.hasVoted ? 'default' : 'outline'}
                          onClick={() => toggleVote(post)}
                          disabled={isVoting === post.id}
                          className="gap-1"
                        >
                          {isVoting === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowBigUp className="h-4 w-4" />}
                          {post.votes}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{details}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SocialSupportHub;
