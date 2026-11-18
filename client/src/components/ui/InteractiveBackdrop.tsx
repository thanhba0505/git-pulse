'use client';

import React, { useEffect, useRef } from 'react';

export function InteractiveBackdrop() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!finePointer.matches) return;

    let rafId = 0;
    let latestX = -500;
    let latestY = -500;
    let isActive = false;

    const commitStyles = () => {
      rafId = 0;
      el.style.setProperty('--px', `${latestX}px`);
      el.style.setProperty('--py', `${latestY}px`);
      el.style.setProperty('--spot-radius', isActive ? '360px' : '0px');
    };

    const scheduleUpdate = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(commitStyles);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      latestX = e.clientX;
      latestY = e.clientY;
      isActive = true;
      scheduleUpdate();
    };

    const handlePointerLeave = () => {
      isActive = false;
      scheduleUpdate();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('blur', handlePointerLeave);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('blur', handlePointerLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#090B10]"
    >
      {/* Layer 1: Stripe-style Ambient Aura Mesh */}
      <div className="gp-aura-orb-a absolute -top-48 left-[-8%] w-[62vw] max-w-[820px] aspect-square rounded-full bg-sky-500/[0.065] blur-[120px]" />
      <div className="gp-aura-orb-b absolute -top-36 right-[-10%] w-[54vw] max-w-[720px] aspect-square rounded-full bg-indigo-500/[0.06] blur-[130px]" />

      {/* Layer 2: Base Architectural Dot Matrix */}
      <div className="absolute inset-0 gp-grid-base" />

      {/* Layer 3: Mouse-Illuminated Grid Mask */}
      <div className="absolute inset-0 gp-grid-illuminated" />

      {/* Top Subtle Horizon Wash */}
      <div
        className="absolute inset-x-0 top-0 h-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56, 189, 248, 0.06), transparent 75%)',
        }}
      />
    </div>
  );
}
