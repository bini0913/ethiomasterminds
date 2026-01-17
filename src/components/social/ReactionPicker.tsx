import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Heart, ThumbsUp, Laugh, Frown, Angry, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export type ReactionType = 'like' | 'love' | 'laugh' | 'sad' | 'angry' | 'celebrate';

interface ReactionPickerProps {
  currentReaction?: ReactionType;
  reactions: Record<ReactionType, number>;
  onReact: (reaction: ReactionType) => void;
  disabled?: boolean;
}

const reactionConfig: Record<ReactionType, { icon: React.ElementType; color: string; label: string; emoji: string }> = {
  like: { icon: ThumbsUp, color: 'text-blue-500', label: 'Like', emoji: '👍' },
  love: { icon: Heart, color: 'text-red-500', label: 'Love', emoji: '❤️' },
  laugh: { icon: Laugh, color: 'text-yellow-500', label: 'Haha', emoji: '😂' },
  sad: { icon: Frown, color: 'text-purple-500', label: 'Sad', emoji: '😢' },
  angry: { icon: Angry, color: 'text-orange-500', label: 'Angry', emoji: '😠' },
  celebrate: { icon: PartyPopper, color: 'text-green-500', label: 'Celebrate', emoji: '🎉' }
};

const ReactionPicker: React.FC<ReactionPickerProps> = ({
  currentReaction,
  reactions,
  onReact,
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);
  const topReactions = (Object.entries(reactions) as [ReactionType, number][])
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const handleReact = (reaction: ReactionType) => {
    onReact(reaction);
    setOpen(false);
  };

  const CurrentIcon = currentReaction ? reactionConfig[currentReaction].icon : ThumbsUp;
  const currentColor = currentReaction ? reactionConfig[currentReaction].color : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              'gap-1 transition-colors',
              currentReaction && currentColor
            )}
            onMouseEnter={() => !disabled && setOpen(true)}
          >
            <CurrentIcon className={cn('h-4 w-4', currentReaction && 'fill-current')} />
            {totalReactions > 0 && <span>{totalReactions}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-2"
          side="top"
          align="start"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="flex gap-1">
            <AnimatePresence>
              {(Object.keys(reactionConfig) as ReactionType[]).map((reaction, index) => {
                const config = reactionConfig[reaction];
                const isSelected = currentReaction === reaction;
                const isHovered = hoveredReaction === reaction;

                return (
                  <motion.button
                    key={reaction}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleReact(reaction)}
                    onMouseEnter={() => setHoveredReaction(reaction)}
                    onMouseLeave={() => setHoveredReaction(null)}
                    className={cn(
                      'relative p-2 rounded-full transition-all',
                      isSelected ? 'bg-muted' : 'hover:bg-muted',
                      isHovered && 'scale-125'
                    )}
                  >
                    <span className="text-xl">{config.emoji}</span>
                    {isHovered && (
                      <motion.span
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap"
                      >
                        {config.label}
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </PopoverContent>
      </Popover>

      {/* Show top reactions */}
      {topReactions.length > 0 && (
        <div className="flex -space-x-1">
          {topReactions.map(([reaction]) => (
            <span key={reaction} className="text-sm">
              {reactionConfig[reaction].emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReactionPicker;
