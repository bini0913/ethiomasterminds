import { useEffect } from 'react';
import { triggerTactileFeedback } from '@/lib/tactileFeedback';

const INTERACTIVE_SELECTOR = 'button, a, [role="button"], input[type="submit"], input[type="button"]';

const TactileFeedback = () => {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;

      const target = event.target instanceof Element ? event.target.closest(INTERACTIVE_SELECTOR) : null;
      if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return;
      if (target.getAttribute('data-tactile') === 'off' || target.closest('[data-tactile="off"]')) return;

      triggerTactileFeedback('light');
    };

    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return null;
};

export default TactileFeedback;
