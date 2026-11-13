import React from 'react';

interface AnimatedBackgroundProps {
  variant?: 'default' | 'minimal' | 'intense';
  showIcons?: boolean;
  showParticles?: boolean;
  showGrid?: boolean;
  showStreaks?: boolean;
}

// Calm, static canvas. Previously rendered floating icons/particles; removed for focus and performance.
const AnimatedBackground: React.FC<AnimatedBackgroundProps> = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-background" />
);

export default AnimatedBackground;
export { AnimatedBackground };
