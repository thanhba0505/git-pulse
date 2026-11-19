'use client';

import { RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';

export interface FloatingPosition {
  style: React.CSSProperties;
  openUpward: boolean;
  portalTarget: HTMLElement;
}

interface UseFloatingPositionOptions {
  isOpen: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  align?: 'start' | 'end';
  gap?: number;
  estimatedHeight?: number;
  estimatedWidth?: number;
  matchWidth?: boolean;
}

function resolveContainingOffsets(portalTarget: HTMLElement): {
  offsetX: number;
  offsetY: number;
  containerW: number;
  containerH: number;
} {
  if (typeof window === 'undefined' || portalTarget === document.body) {
    return {
      offsetX: 0,
      offsetY: 0,
      containerW: typeof window !== 'undefined' ? window.innerWidth : 0,
      containerH: typeof window !== 'undefined' ? window.innerHeight : 0,
    };
  }

  const cs = window.getComputedStyle(portalTarget);
  const createsContainingBlock =
    cs.transform !== 'none' ||
    cs.filter !== 'none' ||
    cs.perspective !== 'none' ||
    cs.backdropFilter !== 'none';

  if (!createsContainingBlock) {
    return {
      offsetX: 0,
      offsetY: 0,
      containerW: window.innerWidth,
      containerH: window.innerHeight,
    };
  }

  const rect = portalTarget.getBoundingClientRect();
  return {
    offsetX: rect.left,
    offsetY: rect.top,
    containerW: rect.width,
    containerH: rect.height,
  };
}

export function useFloatingPosition({
  isOpen,
  anchorRef,
  align = 'start',
  gap = 8,
  estimatedHeight = 250,
  estimatedWidth = 264,
  matchWidth = false,
}: UseFloatingPositionOptions): FloatingPosition | null {
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  const compute = useCallback(() => {
    const anchorEl = anchorRef.current;
    if (!anchorEl || typeof document === 'undefined') {
      setPosition(null);
      return;
    }

    const dialogEl = anchorEl.closest('dialog');
    const portalTarget = dialogEl instanceof HTMLElement ? dialogEl : document.body;
    const { offsetX, offsetY, containerW, containerH } = resolveContainingOffsets(portalTarget);

    const rect = anchorEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    const spaceAbove = rect.top - gap - 12;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const anchorTop = rect.top - offsetY;
    const anchorBottom = rect.bottom - offsetY;
    const anchorLeft = rect.left - offsetX;
    const anchorRight = rect.right - offsetX;

    const availableHeight = openUpward ? spaceAbove : spaceBelow;
    const clampedMaxHeight = Math.max(140, Math.min(340, Math.floor(availableHeight)));
    const panelWidth = matchWidth ? rect.width : Math.min(estimatedWidth, containerW - 24);

    const clampedLeft = Math.max(12, Math.min(anchorLeft, containerW - panelWidth - 12));
    const clampedRight = Math.max(
      12,
      Math.min(containerW - anchorRight, containerW - panelWidth - 12),
    );

    const style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 70,
      maxHeight: `${clampedMaxHeight}px`,
      ...(openUpward
        ? { bottom: `${containerH - anchorTop + gap}px` }
        : { top: `${anchorBottom + gap}px` }),
      ...(align === 'end' ? { right: `${clampedRight}px` } : { left: `${clampedLeft}px` }),
      ...(matchWidth ? { width: `${rect.width}px` } : {}),
    };

    setPosition({ style, openUpward, portalTarget });
  }, [anchorRef, align, gap, estimatedHeight, estimatedWidth, matchWidth]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    compute();

    const handleReposition = () => {
      compute();
    };

    window.addEventListener('scroll', handleReposition, { capture: true, passive: true });
    window.addEventListener('resize', handleReposition, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, compute]);

  return isOpen ? position : null;
}

/**
 * Retains portal mounting during CSS exit transitions so menus/selects animate smoothly on close.
 */
export function usePopoverPresence(
  isOpen: boolean,
  panelRef: RefObject<HTMLElement | null>,
): { shouldRender: boolean; isClosing: boolean } {
  const [rendered, setRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      return;
    }

    if (!rendered) return;

    let cancelled = false;
    let rafId = 0;
    let settleTimer = 0;
    const panel = panelRef.current;

    const finish = () => {
      if (!cancelled) {
        setRendered(false);
      }
    };

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fallbackTimer = window.setTimeout(finish, reducedMotion ? 100 : 190);

    rafId = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const animations = panel?.getAnimations ? panel.getAnimations({ subtree: false }) : [];
      if (animations.length > 0) {
        void Promise.allSettled(animations.map((a) => a.finished)).then(() => {
          window.clearTimeout(fallbackTimer);
          finish();
        });
      } else {
        settleTimer = window.setTimeout(
          () => {
            window.clearTimeout(fallbackTimer);
            finish();
          },
          reducedMotion ? 85 : 130,
        );
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [isOpen, rendered, panelRef]);

  return {
    shouldRender: isOpen || rendered,
    isClosing: !isOpen && rendered,
  };
}
