'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface IntroScreenProps {
  onComplete: () => void;
}

export function IntroScreen({ onComplete }: IntroScreenProps) {
  const { dict } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) {
      setProgress(100);
      const quickTimer = window.setTimeout(() => {
        setIsFadingOut(true);
        window.setTimeout(() => onCompleteRef.current(), 120);
      }, 180);
      return () => window.clearTimeout(quickTimer);
    }

    const startTime = performance.now();
    const duration = 1150;
    let frameId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);

      if (pct < 100) {
        frameId = window.requestAnimationFrame(tick);
      } else {
        setIsFadingOut(true);
        timeoutId = setTimeout(() => {
          onCompleteRef.current();
        }, 280);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      role="status"
      aria-label={dict.auth.workspaceLoading}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F172A]/95 backdrop-blur-2xl transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient Radial Bloom */}
      <div
        aria-hidden="true"
        className="absolute h-96 w-96 rounded-full bg-sky-500/15 blur-[130px] pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute h-72 w-72 translate-x-20 translate-y-10 rounded-full bg-indigo-500/15 blur-[120px] pointer-events-none"
      />

      {/* Center Wordmark & Sleek Progress Indicator */}
      <div className="relative z-10 flex flex-col items-center text-center px-4">
        <div className="flex items-center gap-3 select-none">
          <div
            className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/35 flex items-center justify-center text-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.28)]"
            aria-hidden="true"
          >
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-1.5 text-3xl sm:text-4xl font-bold tracking-tight">
            <span className="text-slate-100">Git</span>
            <span className="text-sky-400">Pulse</span>
          </div>
          <span
            className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.95)]"
            aria-hidden="true"
          />
        </div>

        <p className="mt-3 font-mono text-xs sm:text-sm tracking-widest text-slate-400 uppercase">
          {dict.intro.tagline}
        </p>

        {/* Sleek Glowing Progress Bar */}
        <div className="mt-8 h-1.5 w-64 sm:w-80 overflow-hidden rounded-full border border-white/15 bg-white/[0.06] p-[1px] shadow-[0_0_25px_rgba(56,189,248,0.18)] backdrop-blur-md">
          <div
            className="h-full rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)] transition-[width] duration-75 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
