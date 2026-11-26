'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface IntroScreenProps {
  isReady?: boolean;
  onComplete: () => void;
}

export function IntroScreen({ isReady = true, onComplete }: IntroScreenProps) {
  const { dict } = useTranslation();
  const [isFadingOut, setIsFadingOut] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const isReadyRef = useRef(isReady);
  const onCompleteRef = useRef(onComplete);
  const readySinceRef = useRef<number | null>(isReady ? performance.now() : null);

  useEffect(() => {
    isReadyRef.current = isReady;
    if (isReady && readySinceRef.current === null) {
      readySinceRef.current = performance.now();
    }
  }, [isReady]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minDuration = reducedMotion ? 160 : 950;
    const startTime = performance.now();
    let frameId = 0;
    let finishTimer: ReturnType<typeof setTimeout> | null = null;
    let finishing = false;

    const setScale = (ratio: number) => {
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
      }
    };

    if (reducedMotion) {
      setScale(1);
    }

    const tick = (now: number) => {
      const elapsed = now - startTime;

      if (!reducedMotion) {
        if (!isReadyRef.current || elapsed < minDuration) {
          // Advance smoothly to 0.88 over minDuration, then asymptotically hold toward 0.96 until ready
          const ratio =
            elapsed < minDuration
              ? (elapsed / minDuration) * 0.88
              : 0.88 + 0.08 * (1 - Math.exp(-(elapsed - minDuration) / 1400));
          setScale(ratio);
          frameId = window.requestAnimationFrame(tick);
          return;
        }

        const readyAt = Math.max(readySinceRef.current ?? now, startTime + minDuration);
        const settleElapsed = now - readyAt;
        const settleProgress = Math.min(1, settleElapsed / 140);
        setScale(0.88 + 0.12 * settleProgress);

        if (settleProgress < 1) {
          frameId = window.requestAnimationFrame(tick);
          return;
        }
      } else if (!isReadyRef.current || elapsed < minDuration) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      if (!finishing) {
        finishing = true;
        setScale(1);
        setIsFadingOut(true);
        finishTimer = setTimeout(
          () => {
            onCompleteRef.current();
          },
          reducedMotion ? 100 : 260,
        );
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, []);

  return (
    <div
      role="status"
      aria-label={dict.auth.workspaceLoading}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F172A] transition-opacity duration-250 ease-out ${
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

      {/* Center Wordmark & Compositor Progress Indicator */}
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

        {/* GPU-Composited Glowing Progress Bar */}
        <div className="mt-8 h-1.5 w-64 sm:w-80 overflow-hidden rounded-full border border-white/15 bg-white/[0.06] p-[1px] shadow-[0_0_25px_rgba(56,189,248,0.18)] backdrop-blur-md">
          <div
            ref={barRef}
            className="h-full w-full origin-left rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)] will-change-transform"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>
      </div>
    </div>
  );
}
