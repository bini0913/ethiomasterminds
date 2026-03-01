import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Trophy, Star, Brain, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useUser } from '@/context/UserContext';
import AvatarStudio, { UltimateAvatarConfig } from '@/components/avatar/AvatarStudio';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

const AvatarCreator: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useUser();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSave = async (config: UltimateAvatarConfig) => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_config: config as unknown as Json })
        .eq('id', user.id);

      if (error) throw error;

      const avatarClient = supabase as any;
      await avatarClient.from('avatars').upsert({
        user_id: user.id,
        skin_tone: config.skinTone,
        hair_style: config.hair,
        hair_color: config.hairColor,
        eye_type: config.eyes,
        mouth_type: config.mouth,
        accessories: config.accessories,
        outfit: config.clothes,
        background: config.background,
      });

      await updateProfile({
        avatarConfig: config as any,
      });
      toast.success('Avatar saved successfully! 🎉', {
        description: '+10 XP earned for customizing your avatar!',
      });
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
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Floating icons */}
      <motion.div
        className="absolute top-20 left-10 text-yellow-400/50"
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <Star className="w-6 h-6" />
      </motion.div>
      
      <motion.div
        className="absolute top-40 right-20 text-purple-400/50"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
      >
        <Brain className="w-8 h-8" />
      </motion.div>
      
      <motion.div
        className="absolute bottom-40 left-20 text-cyan-400/50"
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      >
        <Zap className="w-6 h-6" />
      </motion.div>
      
      <motion.div
        className="absolute bottom-20 right-40 text-amber-400/50"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Crown className="w-8 h-8" />
      </motion.div>

      {/* Header */}
      <header className="relative z-10 p-4 flex items-center justify-between border-b border-border/30 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
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

      {/* Main content */}
      <main className="relative z-10 container max-w-5xl mx-auto py-6">
        <Card className="glass border-border/50">
          <CardContent className="p-6">
            <AvatarStudio
              userId={user.id}
              userXp={user.xp || 0}
              initialConfig={user.avatarConfig as Partial<UltimateAvatarConfig> | undefined}
              onSave={handleSave}
            />
          </CardContent>
        </Card>
      </main>

      {/* Save loading overlay */}
      <AnimatePresence>
        {isSaving && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
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
