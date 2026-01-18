import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Trophy, Star, Brain, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useUser } from '@/context/UserContext';
import GameAvatarEditor from '@/components/avatar/GameAvatarEditor';
import type { GameAvatarConfig } from '@/components/avatar/GameAvatarRenderer';

const AvatarCreator: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useUser();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSave = async (config: GameAvatarConfig) => {
    if (!user) return;
    
    setIsSaving(true);
    try {
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
      <div className="absolute inset-0 animated-gradient opacity-50" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: `hsl(${Math.random() * 360}, 70%, 60%)`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.5, 1],
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
        className="absolute top-20 left-10 text-yellow-400"
        animate={{ 
          y: [0, -20, 0],
          rotate: [0, 10, -10, 0],
        }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <Star className="w-8 h-8" />
      </motion.div>
      
      <motion.div
        className="absolute top-40 right-20 text-purple-400"
        animate={{ 
          y: [0, 15, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
      >
        <Brain className="w-10 h-10" />
      </motion.div>
      
      <motion.div
        className="absolute bottom-40 left-20 text-cyan-400"
        animate={{ 
          rotate: 360,
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      >
        <Zap className="w-8 h-8" />
      </motion.div>
      
      <motion.div
        className="absolute bottom-20 right-40 text-amber-400"
        animate={{ 
          y: [0, -10, 0],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Crown className="w-12 h-12" />
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
            <h1 className="text-xl font-display font-bold text-gradient flex items-center gap-2">
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
      <main className="relative z-10 h-[calc(100vh-73px)]">
        <GameAvatarEditor
          initialConfig={user.avatarConfig as Partial<GameAvatarConfig> | undefined}
          userLevel={user.level || 1}
          userXP={user.xp || 0}
          unlockedItems={[]}
          onSave={handleSave}
          onClose={() => navigate(-1)}
        />
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
              <p className="text-xl font-display font-bold">Saving your avatar...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AvatarCreator;
