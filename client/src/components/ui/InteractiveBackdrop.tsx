'use client';

import React, { useEffect, useRef } from 'react';
import { GitBranch, GitCommitHorizontal, GitMerge, GitPullRequest, Code2 } from 'lucide-react';
import { readMotionPausedPreference } from '../../lib/motion-preference';

const TRAIL_POOL_SIZE = 12;
const RIPPLE_POOL_SIZE = 4;

interface FloatingTileConfig {
  id: string;
  positionClass: string;
  animClass: 'gp-float-anim-a' | 'gp-float-anim-b' | 'gp-float-anim-c';
  depthX: number;
  depthY: number;
  kind: 'branch' | 'merge' | 'diff' | 'pr' | 'commit' | 'code' | 'diamond' | 'node';
}

const FLOATING_TILES: readonly FloatingTileConfig[] = [
  {
    id: 'tile-branch',
    positionClass: 'left-[3.5%] top-[12%] hidden sm:flex',
    animClass: 'gp-float-anim-a',
    depthX: 28,
    depthY: 24,
    kind: 'branch',
  },
  {
    id: 'tile-merge',
    positionClass: 'right-[4.5%] top-[13%] hidden sm:flex',
    animClass: 'gp-float-anim-b',
    depthX: -24,
    depthY: 22,
    kind: 'merge',
  },
  {
    id: 'tile-diff',
    positionClass: 'left-[2.5%] top-[44%] hidden md:flex',
    animClass: 'gp-float-anim-c',
    depthX: 34,
    depthY: -18,
    kind: 'diff',
  },
  {
    id: 'tile-pr',
    positionClass: 'right-[3.5%] top-[48%] hidden md:flex',
    animClass: 'gp-float-anim-a',
    depthX: -32,
    depthY: -22,
    kind: 'pr',
  },
  {
    id: 'tile-commit',
    positionClass: 'left-[6%] bottom-[11%] hidden sm:flex',
    animClass: 'gp-float-anim-b',
    depthX: 22,
    depthY: -28,
    kind: 'commit',
  },
  {
    id: 'tile-code',
    positionClass: 'right-[6%] bottom-[12%] hidden sm:flex',
    animClass: 'gp-float-anim-c',
    depthX: -26,
    depthY: -24,
    kind: 'code',
  },
  {
    id: 'tile-diamond',
    positionClass: 'left-[21%] top-[20%] hidden lg:flex',
    animClass: 'gp-float-anim-b',
    depthX: 16,
    depthY: 16,
    kind: 'diamond',
  },
  {
    id: 'tile-node',
    positionClass: 'right-[20%] bottom-[19%] hidden lg:flex',
    animClass: 'gp-float-anim-a',
    depthX: -18,
    depthY: -14,
    kind: 'node',
  },
];

interface FloatingMoteConfig {
  id: string;
  style: React.CSSProperties;
  depthX: number;
  depthY: number;
  sizeClass: string;
  shape: 'dot' | 'plus';
}

const FLOATING_MOTES: readonly FloatingMoteConfig[] = [
  {
    id: 'm1',
    style: {
      left: '9%',
      top: '26%',
      '--mote-dur': '11s',
      '--mote-delay': '-2s',
    } as React.CSSProperties,
    depthX: 18,
    depthY: 14,
    sizeClass: 'w-1.5 h-1.5',
    shape: 'dot',
  },
  {
    id: 'm2',
    style: {
      left: '16%',
      top: '68%',
      '--mote-dur': '14s',
      '--mote-delay': '-5s',
    } as React.CSSProperties,
    depthX: 26,
    depthY: -20,
    sizeClass: 'w-2 h-2',
    shape: 'dot',
  },
  {
    id: 'm3',
    style: {
      left: '26%',
      top: '12%',
      '--mote-dur': '13s',
      '--mote-delay': '-1s',
    } as React.CSSProperties,
    depthX: 14,
    depthY: 18,
    sizeClass: 'w-2.5 h-2.5',
    shape: 'plus',
  },
  {
    id: 'm4',
    style: {
      left: '36%',
      top: '84%',
      '--mote-dur': '16s',
      '--mote-delay': '-7s',
    } as React.CSSProperties,
    depthX: 20,
    depthY: -16,
    sizeClass: 'w-1.5 h-1.5',
    shape: 'dot',
  },
  {
    id: 'm5',
    style: {
      left: '48%',
      top: '9%',
      '--mote-dur': '12s',
      '--mote-delay': '-4s',
    } as React.CSSProperties,
    depthX: -12,
    depthY: 22,
    sizeClass: 'w-1.5 h-1.5',
    shape: 'dot',
  },
  {
    id: 'm6',
    style: {
      left: '58%',
      top: '76%',
      '--mote-dur': '15s',
      '--mote-delay': '-6s',
    } as React.CSSProperties,
    depthX: -22,
    depthY: -22,
    sizeClass: 'w-2.5 h-2.5',
    shape: 'plus',
  },
  {
    id: 'm7',
    style: {
      left: '72%',
      top: '17%',
      '--mote-dur': '13s',
      '--mote-delay': '-3s',
    } as React.CSSProperties,
    depthX: -18,
    depthY: 16,
    sizeClass: 'w-2 h-2',
    shape: 'dot',
  },
  {
    id: 'm8',
    style: {
      left: '84%',
      top: '31%',
      '--mote-dur': '17s',
      '--mote-delay': '-9s',
    } as React.CSSProperties,
    depthX: -28,
    depthY: 12,
    sizeClass: 'w-1.5 h-1.5',
    shape: 'dot',
  },
  {
    id: 'm9',
    style: {
      left: '90%',
      top: '66%',
      '--mote-dur': '12s',
      '--mote-delay': '-4s',
    } as React.CSSProperties,
    depthX: -24,
    depthY: -18,
    sizeClass: 'w-2.5 h-2.5',
    shape: 'plus',
  },
  {
    id: 'm10',
    style: {
      left: '78%',
      top: '87%',
      '--mote-dur': '15s',
      '--mote-delay': '-8s',
    } as React.CSSProperties,
    depthX: -16,
    depthY: -24,
    sizeClass: 'w-1.5 h-1.5',
    shape: 'dot',
  },
  {
    id: 'm11',
    style: {
      left: '13%',
      top: '86%',
      '--mote-dur': '14s',
      '--mote-delay': '-10s',
    } as React.CSSProperties,
    depthX: 24,
    depthY: -14,
    sizeClass: 'w-2 h-2',
    shape: 'dot',
  },
  {
    id: 'm12',
    style: {
      left: '66%',
      top: '42%',
      '--mote-dur': '18s',
      '--mote-delay': '-11s',
    } as React.CSSProperties,
    depthX: -14,
    depthY: 10,
    sizeClass: 'w-1 h-1',
    shape: 'dot',
  },
  {
    id: 'm13',
    style: {
      left: '34%',
      top: '46%',
      '--mote-dur': '16s',
      '--mote-delay': '-6s',
    } as React.CSSProperties,
    depthX: 16,
    depthY: -10,
    sizeClass: 'w-1 h-1',
    shape: 'dot',
  },
  {
    id: 'm14',
    style: {
      left: '5%',
      top: '60%',
      '--mote-dur': '13s',
      '--mote-delay': '-3s',
    } as React.CSSProperties,
    depthX: 30,
    depthY: -12,
    sizeClass: 'w-2 h-2',
    shape: 'plus',
  },
  {
    id: 'm15',
    style: {
      left: '93%',
      top: '23%',
      '--mote-dur': '14s',
      '--mote-delay': '-5s',
    } as React.CSSProperties,
    depthX: -30,
    depthY: 18,
    sizeClass: 'w-2 h-2',
    shape: 'dot',
  },
  {
    id: 'm16',
    style: {
      left: '53%',
      top: '91%',
      '--mote-dur': '15s',
      '--mote-delay': '-7s',
    } as React.CSSProperties,
    depthX: 10,
    depthY: -22,
    sizeClass: 'w-1.5 h-1.5',
    shape: 'dot',
  },
];

function renderTileInner(kind: FloatingTileConfig['kind'], illuminated: boolean) {
  const iconTone = illuminated ? 'text-sky-300' : 'text-sky-400/50';
  const barTone = illuminated ? 'bg-sky-300/60' : 'bg-slate-600/50';
  const accentBarTone = illuminated ? 'bg-emerald-400/75' : 'bg-emerald-500/35';

  switch (kind) {
    case 'branch':
      return <GitBranch className={`w-4 h-4 ${iconTone}`} />;
    case 'merge':
      return (
        <div className="flex items-center gap-2">
          <GitMerge className={`w-4 h-4 ${iconTone}`} />
          <div className="flex flex-col gap-1">
            <span className={`w-5 h-1 rounded-full ${accentBarTone}`} />
            <span className={`w-3.5 h-1 rounded-full ${barTone}`} />
          </div>
        </div>
      );
    case 'diff':
      return (
        <div className="flex flex-col gap-1.5 w-11">
          <span className={`h-1 w-8 rounded-full ${accentBarTone}`} />
          <span className={`h-1 w-10 rounded-full ${barTone}`} />
          <span
            className={`h-1 w-6 rounded-full ${illuminated ? 'bg-indigo-300/65' : 'bg-slate-600/45'}`}
          />
        </div>
      );
    case 'pr':
      return <GitPullRequest className={`w-4 h-4 ${iconTone}`} />;
    case 'commit':
      return <GitCommitHorizontal className={`w-5 h-5 ${iconTone}`} />;
    case 'code':
      return <Code2 className={`w-4 h-4 ${iconTone}`} />;
    case 'diamond':
      return (
        <span
          className={`w-3.5 h-3.5 rotate-45 rounded-[3px] border ${
            illuminated
              ? 'border-sky-300/80 bg-sky-400/25 shadow-[0_0_16px_rgba(56,189,248,0.4)]'
              : 'border-sky-400/35 bg-sky-500/10'
          }`}
        />
      );
    case 'node':
      return (
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${illuminated ? 'bg-sky-300' : 'bg-sky-400/55'}`}
          />
          <span className={`w-4 h-[1.5px] ${barTone}`} />
          <span
            className={`w-2 h-2 rounded-full ${illuminated ? 'bg-indigo-300' : 'bg-indigo-400/50'}`}
          />
        </div>
      );
  }
}

function FloatingFieldLayer({ illuminated }: { illuminated: boolean }) {
  return (
    <div
      className={
        illuminated ? 'absolute inset-0 gp-float-spotlight-mask' : 'absolute inset-0 opacity-60'
      }
    >
      {/* Translucent Architectural Geometric Tiles */}
      {FLOATING_TILES.map((tile) => {
        const isMinimalShape = tile.kind === 'diamond';
        const frameClass = isMinimalShape
          ? 'p-1'
          : illuminated
            ? 'px-3 py-2.5 rounded-xl border border-sky-400/65 bg-sky-500/[0.11] shadow-[0_0_26px_rgba(56,189,248,0.22)]'
            : 'px-3 py-2.5 rounded-xl border border-slate-700/45 bg-slate-900/30 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)]';

        return (
          <div
            key={`${tile.id}-${illuminated ? 'glow' : 'base'}`}
            className={`absolute items-center justify-center gp-parallax-layer ${tile.positionClass}`}
            style={
              {
                '--depth-x': `${tile.depthX}px`,
                '--depth-y': `${tile.depthY}px`,
              } as React.CSSProperties
            }
          >
            <div className={`${tile.animClass} flex items-center justify-center ${frameClass}`}>
              {renderTileInner(tile.kind, illuminated)}
            </div>
          </div>
        );
      })}

      {/* Floating Ambient Cyan/Indigo Motes & Geometric Crosshairs */}
      {FLOATING_MOTES.map((mote) => (
        <div
          key={`${mote.id}-${illuminated ? 'glow' : 'base'}`}
          className="absolute gp-parallax-layer"
          style={
            {
              ...mote.style,
              '--depth-x': `${mote.depthX}px`,
              '--depth-y': `${mote.depthY}px`,
            } as React.CSSProperties
          }
        >
          {mote.shape === 'plus' ? (
            <div
              className={`gp-mote-anim relative flex items-center justify-center ${mote.sizeClass} ${
                illuminated
                  ? 'text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]'
                  : 'text-sky-400/45'
              }`}
              style={mote.style}
            >
              <span className="absolute inset-x-0 h-[1.5px] bg-current rounded-full" />
              <span className="absolute inset-y-0 w-[1.5px] bg-current rounded-full" />
            </div>
          ) : (
            <span
              className={`block rounded-full gp-mote-anim ${mote.sizeClass} ${
                illuminated
                  ? 'bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.85)]'
                  : 'bg-sky-400/45 shadow-[0_0_6px_rgba(56,189,248,0.2)]'
              }`}
              style={mote.style}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function InteractiveBackdrop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trailPoolRef = useRef<(HTMLSpanElement | null)[]>([]);
  const ripplePoolRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finePointer.matches) return;

    let viewportW = window.innerWidth || 1440;
    let viewportH = window.innerHeight || 900;

    const updateViewport = () => {
      viewportW = window.innerWidth || 1440;
      viewportH = window.innerHeight || 900;
    };

    let rafId = 0;
    let latestX = -600;
    let latestY = -600;
    let normX = 0;
    let normY = 0;
    let isActive = false;

    let lastTrailX = -999;
    let lastTrailY = -999;
    let trailIdx = 0;
    let rippleIdx = 0;

    const canSpawnFx = () => !reducedMotion.matches && !readMotionPausedPreference();

    const commitStyles = () => {
      rafId = 0;
      el.style.setProperty('--px', `${latestX}px`);
      el.style.setProperty('--py', `${latestY}px`);
      el.style.setProperty('--nx', normX.toFixed(3));
      el.style.setProperty('--ny', normY.toFixed(3));
      el.style.setProperty('--spot-radius', isActive ? '400px' : '0px');
      el.style.setProperty('--spot-opacity', isActive ? '1' : '0');
    };

    const scheduleUpdate = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(commitStyles);
      }
    };

    const deactivateSpotlight = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      isActive = false;
      normX = 0;
      normY = 0;
      lastTrailX = -999;
      lastTrailY = -999;
      el.style.setProperty('--nx', '0');
      el.style.setProperty('--ny', '0');
      el.style.setProperty('--spot-radius', '0px');
      el.style.setProperty('--spot-opacity', '0');
    };

    const spawnTrailSpark = (x: number, y: number, dx: number, dy: number) => {
      if (!canSpawnFx()) return;
      const spark = trailPoolRef.current[trailIdx];
      trailIdx = (trailIdx + 1) % TRAIL_POOL_SIZE;
      if (!spark || typeof spark.animate !== 'function') return;

      const angleOffset = (trailIdx % 2 === 0 ? 1 : -1) * 14;
      const clampedDx = Math.max(-28, Math.min(28, dx * 0.45));
      const clampedDy = Math.max(-28, Math.min(28, dy * 0.45 - 12));

      spark.animate(
        [
          {
            transform: `translate3d(${x}px, ${y}px, 0) scale(1)`,
            opacity: 0.72,
          },
          {
            transform: `translate3d(${x + clampedDx + angleOffset * 0.5}px, ${y + clampedDy}px, 0) scale(0.15)`,
            opacity: 0,
          },
        ],
        {
          duration: 720,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'none',
        },
      );
    };

    const spawnClickRipple = (x: number, y: number) => {
      if (!canSpawnFx()) return;
      const ring = ripplePoolRef.current[rippleIdx];
      rippleIdx = (rippleIdx + 1) % RIPPLE_POOL_SIZE;
      if (!ring || typeof ring.animate !== 'function') return;

      ring.animate(
        [
          {
            transform: `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), 0) scale(0.14)`,
            opacity: 0.65,
          },
          {
            transform: `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), 0) scale(1)`,
            opacity: 0,
          },
        ],
        {
          duration: 560,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'none',
        },
      );
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= viewportW || e.clientY >= viewportH) {
        deactivateSpotlight();
        return;
      }

      latestX = e.clientX;
      latestY = e.clientY;
      normX = (e.clientX / viewportW - 0.5) * 2;
      normY = (e.clientY / viewportH - 0.5) * 2;
      isActive = true;
      scheduleUpdate();

      const dx = e.clientX - lastTrailX;
      const dy = e.clientY - lastTrailY;
      if (Math.hypot(dx, dy) >= 28) {
        if (lastTrailX > -500) {
          spawnTrailSpark(e.clientX, e.clientY, dx, dy);
        }
        lastTrailX = e.clientX;
        lastTrailY = e.clientY;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= viewportW || e.clientY >= viewportH) {
        return;
      }
      latestX = e.clientX;
      latestY = e.clientY;
      isActive = true;
      scheduleUpdate();
      spawnClickRipple(e.clientX, e.clientY);
    };

    const handlePointerOut = (e: PointerEvent) => {
      if (!e.relatedTarget) {
        deactivateSpotlight();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        deactivateSpotlight();
      }
    };

    window.addEventListener('resize', updateViewport, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    document.addEventListener('pointerout', handlePointerOut);
    document.addEventListener('mouseleave', deactivateSpotlight);
    document.documentElement.addEventListener('pointerleave', deactivateSpotlight);
    window.addEventListener('blur', deactivateSpotlight);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('mouseleave', deactivateSpotlight);
      document.documentElement.removeEventListener('pointerleave', deactivateSpotlight);
      window.removeEventListener('blur', deactivateSpotlight);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#090B10]"
    >
      {/* Layer 1: Stripe-style Ambient Floating Aura Orbs with Inverse Parallax */}
      <div
        className="gp-parallax-layer absolute inset-0"
        style={{ '--depth-x': '-28px', '--depth-y': '-24px' } as React.CSSProperties}
      >
        <div className="gp-aura-orb-a absolute -top-48 left-[-8%] w-[64vw] max-w-[840px] aspect-square rounded-full bg-sky-500/[0.11] blur-[120px]" />
        <div className="gp-aura-orb-b absolute -top-36 right-[-10%] w-[56vw] max-w-[740px] aspect-square rounded-full bg-indigo-500/[0.095] blur-[130px]" />
        <div className="gp-aura-orb-c absolute -bottom-52 left-[28%] w-[50vw] max-w-[680px] aspect-square rounded-full bg-cyan-500/[0.065] blur-[135px]" />
      </div>

      {/* Layer 2: Base Architectural Dot Matrix */}
      <div className="absolute inset-0 gp-grid-base" />

      {/* Layer 3: Mouse-Illuminated Grid Mask & Velvet Cursor Aura */}
      <div className="absolute inset-0 gp-grid-illuminated" />
      <div className="gp-cursor-halo" />

      {/* Layer 4: Floating Geometric Git Tiles & Motes + Illuminated Spotlight Twin */}
      <FloatingFieldLayer illuminated={false} />
      <FloatingFieldLayer illuminated={true} />

      {/* Layer 5: Pooled Pointer Trail Sparks & Click Shockwave Ripples */}
      {Array.from({ length: TRAIL_POOL_SIZE }).map((_, idx) => (
        <span
          key={`trail-${idx}`}
          ref={(node) => {
            trailPoolRef.current[idx] = node;
          }}
          className="fixed left-0 top-0 w-2 h-2 -ml-1 -mt-1 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.85)] opacity-0 will-change-transform"
        />
      ))}

      {Array.from({ length: RIPPLE_POOL_SIZE }).map((_, idx) => (
        <span
          key={`ripple-${idx}`}
          ref={(node) => {
            ripplePoolRef.current[idx] = node;
          }}
          className="fixed left-0 top-0 w-36 h-36 rounded-full border border-sky-400/55 shadow-[0_0_24px_rgba(56,189,248,0.2)] opacity-0 will-change-transform"
        />
      ))}

      {/* Top Subtle Horizon Wash */}
      <div
        className="absolute inset-x-0 top-0 h-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56, 189, 248, 0.08), transparent 75%)',
        }}
      />
    </div>
  );
}
