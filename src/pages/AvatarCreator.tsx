import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Trophy, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useUser } from '@/context/UserContext';
import FullAvatarEditor from '@/components/avatar/FullAvatarEditor';
import { FullAvatarConfig } from '@/components/avatar/SVGAvatarParts';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

const AvatarCreator: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useUser();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  const handleSave = async (config: FullAvatarConfig) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_config: config as unknown as Json })
        .eq('id', user.id);

      if (error) throw error;

      await updateProfile({ avatarConfig: config as any });
      toast.success('Avatar saved! 🎉', { description: '+10 XP earned!' });
      navigate(-1);
    } catch (error) {
      console.error('Error saving avatar:', error);
      toast.error('Failed to save avatar');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />

      {/* Header */}
      <header className="relative z-10 p-4 flex items-center justify-between border-b border-border/30 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Avatar Studio
            </h1>
            <p className="text-sm text-muted-foreground">Create your unique character</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Star className="w-3 h-3 text-yellow-400" />
            Level {user.level || 1}
          </Badge>
          <Badge className="bg-primary/20 text-primary gap-1">
            <Trophy className="w-3 h-3" />
            {(user.xp || 0).toLocaleString()} XP
          </Badge>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 container max-w-6xl mx-auto py-6 px-4">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <FullAvatarEditor
              initialConfig={user.avatarConfig as Partial<FullAvatarConfig> | undefined}
              userLevel={user.level || 1}
              onSave={handleSave}
              onCancel={() => navigate(-1)}
            />
          </CardContent>
        </Card>
      </main>

      {/* Loading overlay */}
      <AnimatePresence>
        {isSaving && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="text-center" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }}>
              <Sparkles className="w-16 h-16 text-primary mx-auto mb-4" />
              <p className="text-xl font-bold">Saving your avatar...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AvatarCreator;
