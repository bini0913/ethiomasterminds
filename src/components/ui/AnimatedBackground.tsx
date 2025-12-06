import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Brain, Zap, Trophy, Star, Calculator, Lightbulb, Target } from 'lucide-react';

interface FloatingIcon {
  id: number;
  Icon: React.ElementType;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  color: string;
}

interface AnimatedBackgroundProps {
  variant?: 'default' | 'minimal' | 'intense';
  showIcons?: boolean;
  showParticles?: boolean;
  showGrid?: boolean;
  showStreaks?: boolean;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  variant = 'default',
  showIcons = true,
  showParticles = true,
  showGrid = true,
  showStreaks = true
}) => {
  const icons = [BookOpen, Brain, Zap, Trophy, Star, Calculator, Lightbulb, Target];
  const colors = [
    'hsl(250 89% 67%)', // Primary purple
    'hsl(180 100% 50%)', // Cyan
    'hsl(320 100% 60%)', // Pink
    'hsl(280 100% 65%)', // Purple
    'hsl(50 100% 60%)', // Yellow
    'hsl(150 100% 50%)' // Green
  ];

  const floatingIcons: FloatingIcon[] = useMemo(() => 
    Array.from({ length: variant === 'intense' ? 20 : variant === 'minimal' ? 6 : 12 }, (_, i) => ({
      id: i,
      Icon: icons[i % icons.length],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 24 + 16,
      duration: Math.random() * 10 + 15,
      delay: Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)]
    })), [variant]
  );

  const particles: Particle[] = useMemo(() =>
    Array.from({ length: variant === 'intense' ? 50 : variant === 'minimal' ? 20 : 35 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 6 + 2,
      duration: Math.random() * 15 + 10,
      color: colors[Math.floor(Math.random() * colors.length)]
    })), [variant]
  );

  const streaks = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      delay: i * 2,
      duration: 4 + Math.random() * 2
    })), []
  );

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base Gradient */}
      <div className="absolute inset-0 animated-gradient" />
      
      {/* Grid Overlay */}
      {showGrid && (
        <div className="absolute inset-0 bg-grid opacity-30" />
      )}

      {/* Radial Glow Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse-glow" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px]" />

      {/* Light Streaks */}
      {showStreaks && streaks.map((streak) => (
        <motion.div
          key={streak.id}
          className="absolute h-[2px] w-32 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
          style={{
            top: `${20 + streak.id * 15}%`,
            left: '-10%',
            rotate: '45deg'
          }}
          animate={{
            x: ['0%', '200vw'],
            opacity: [0, 1, 0]
          }}
          transition={{
            duration: streak.duration,
            delay: streak.delay,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      ))}

      {/* Floating Particles */}
      {showParticles && particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            opacity: 0.3
          }}
          animate={{
            y: [0, -100, 0],
            x: [0, Math.random() * 50 - 25, 0],
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 1.2, 1]
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      ))}

      {/* Floating Icons */}
      {showIcons && floatingIcons.map(({ id, Icon, x, y, size, duration, delay, color }) => (
        <motion.div
          key={id}
          className="absolute"
          style={{
            left: `${x}%`,
            top: `${y}%`,
          }}
          animate={{
            y: [0, -40, 0],
            x: [0, 20, -20, 0],
            rotate: [0, 10, -10, 0],
            opacity: [0.15, 0.3, 0.15]
          }}
          transition={{
            duration: duration,
            delay: delay,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <Icon 
            size={size} 
            style={{ color }}
            className="drop-shadow-lg"
          />
        </motion.div>
      ))}

      {/* Corner Decorations */}
      <div className="absolute top-0 left-0 w-64 h-64 border-l-2 border-t-2 border-primary/20 rounded-tl-3xl" />
      <div className="absolute bottom-0 right-0 w-64 h-64 border-r-2 border-b-2 border-accent/20 rounded-br-3xl" />

      {/* Geometric Shapes */}
      <motion.div
        className="absolute top-20 right-20 w-32 h-32 border border-primary/30 rounded-lg"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute bottom-20 left-20 w-24 h-24 border border-accent/30 rounded-full"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
};

export default AnimatedBackground;
