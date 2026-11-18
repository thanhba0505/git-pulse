'use client';

import React, { useEffect, useRef } from 'react';
import { readMotionPausedPreference } from '../../lib/motion-preference';

type ShowcaseElement = 'div' | 'li' | 'section' | 'article';

interface ShowcaseCardProps extends React.HTMLAttributes<HTMLElement> {
  as?: ShowcaseElement;
  staggerIndex?: number;
  tiltStrength?: number;
  className?: string;
  children: React.ReactNode;
}

export function ShowcaseCard({
  as = 'div',
  staggerIndex,
  tiltStrength = 0,
  className = '',
  style,
  children,
  ...rest
}: ShowcaseCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finePointer.matches) return;

    const updateRect = () => {
      rectRef.current = el.getBoundingClientRect();
    };

    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(el);

    let rafId = 0;
    let nextX = -500;
    let nextY = -500;
    let tiltX = 0;
    let tiltY = 0;

    const flushCoords = () => {
      rafId = 0;
      el.style.setProperty('--card-x', `${nextX}px`);
      el.style.setProperty('--card-y', `${nextY}px`);
      if (tiltStrength > 0) {
        el.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
        el.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
      }
    };

    const handlePointerEnter = () => {
      updateRect();
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = rectRef.current || el.getBoundingClientRect();
      rectRef.current = rect;
      nextX = e.clientX - rect.left;
      nextY = e.clientY - rect.top;

      if (tiltStrength > 0 && !reducedMotion.matches && !readMotionPausedPreference()) {
        const ratioX = rect.width > 0 ? nextX / rect.width - 0.5 : 0;
        const ratioY = rect.height > 0 ? nextY / rect.height - 0.5 : 0;
        tiltX = ratioY * -2 * tiltStrength;
        tiltY = ratioX * 2 * tiltStrength;
      } else {
        tiltX = 0;
        tiltY = 0;
      }

      if (!rafId) {
        rafId = window.requestAnimationFrame(flushCoords);
      }
    };

    const handlePointerLeave = () => {
      nextX = -500;
      nextY = -500;
      tiltX = 0;
      tiltY = 0;
      if (!rafId) {
        rafId = window.requestAnimationFrame(flushCoords);
      }
    };

    el.addEventListener('pointerenter', handlePointerEnter, { passive: true });
    el.addEventListener('pointermove', handlePointerMove, { passive: true });
    el.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      el.removeEventListener('pointerenter', handlePointerEnter);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [tiltStrength]);

  const mergedStyle: React.CSSProperties = {
    ...(staggerIndex !== undefined
      ? ({ '--stagger-idx': staggerIndex } as React.CSSProperties)
      : {}),
    ...style,
  };

  const Tag = as as React.ElementType;

  return (
    <Tag
      ref={cardRef}
      style={mergedStyle}
      className={`group relative overflow-hidden rounded-xl gp-card transition-colors duration-200 hover:border-slate-700/90 ${
        tiltStrength > 0 ? 'gp-showcase-tilt' : ''
      } ${staggerIndex !== undefined ? 'gp-stagger-item' : ''} ${className}`}
      {...rest}
    >
      {/* Inner Surface Pointer Sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300 gp-showcase-surface"
      />

      {/* 1px Perimeter Border Spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300 gp-showcase-border-glow"
      />

      <div className="relative z-10">{children}</div>
    </Tag>
  );
}
