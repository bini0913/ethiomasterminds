import React from 'react';
import { motion } from 'framer-motion';

const Confetti: React.FC = () => {
  const colors = ['#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e'];
  const particles = Array.from({ length: 50 });

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((_, i) => {
        const randomX = Math.random() * 100;
        const randomDelay = Math.random() * 0.5;
        const randomDuration = 2 + Math.random() * 2;
        const randomSize = 8 + Math.random() * 12;
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        return (
          <motion.div
            key={i}
            initial={{
              x: `${randomX}vw`,
              y: -20,
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              y: '110vh',
              rotate: Math.random() * 360 * (Math.random() > 0.5 ? 1 : -1),
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: randomDuration,
              delay: randomDelay,
              ease: 'easeIn',
            }}
            style={{
              position: 'absolute',
              width: randomSize,
              height: randomSize,
              backgroundColor: randomColor,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            }}
          />
        );
      })}
    </div>
  );
};

export default Confetti;
