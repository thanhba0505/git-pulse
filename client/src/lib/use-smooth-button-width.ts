'use client';

import { useLayoutEffect, useEffect, useRef } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Hook to smoothly animate an interactive button's width when its text/state changes.
 */
export function useSmoothButtonWidth<T extends HTMLElement = HTMLButtonElement>(
  dependency: unknown,
) {
  const elementRef = useRef<T>(null);
  const isFirstRender = useRef(true);

  useIsomorphicLayoutEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Get rendered box width before content changes
    const prevWidth = el.getBoundingClientRect().width;

    // Temporarily set width to auto to measure new natural width
    el.style.width = 'auto';
    const nextWidth = Math.ceil(el.getBoundingClientRect().width);

    if (isFirstRender.current || prefersReducedMotion) {
      isFirstRender.current = false;
      el.style.width = `${nextWidth}px`;
      return;
    }

    if (Math.abs(prevWidth - nextWidth) > 0.5) {
      // Pin to previous width without transition
      el.style.transitionProperty = 'none';
      el.style.width = `${Math.ceil(prevWidth)}px`;

      // Force synchronous reflow
      void el.offsetWidth;

      // Animate to new width smoothly
      el.style.transitionProperty =
        'width, background-color, border-color, color, box-shadow, transform';
      el.style.transitionDuration = '240ms';
      el.style.transitionTimingFunction = 'cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.width = `${nextWidth}px`;

      const timer = window.setTimeout(() => {
        if (!elementRef.current) return;
        elementRef.current.style.transitionProperty = '';
        elementRef.current.style.transitionDuration = '';
        elementRef.current.style.transitionTimingFunction = '';
      }, 260);

      return () => {
        window.clearTimeout(timer);
      };
    } else {
      el.style.width = `${nextWidth}px`;
    }
  }, [dependency]);

  // Keep width responsive on window resize
  useIsomorphicLayoutEffect(() => {
    const handleResize = () => {
      const el = elementRef.current;
      if (!el) return;
      el.style.transitionProperty = 'none';
      el.style.width = 'auto';
      const w = Math.ceil(el.getBoundingClientRect().width);
      el.style.width = `${w}px`;
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return elementRef;
}
