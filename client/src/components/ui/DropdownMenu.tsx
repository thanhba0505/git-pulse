'use client';

import React, { useEffect, useId, useRef, useState } from 'react';

interface DropdownMenuProps {
  trigger: (props: {
    id: string;
    isOpen: boolean;
    onClick: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
    ariaProps: {
      'aria-haspopup': 'menu';
      'aria-expanded': boolean;
      'aria-controls': string;
    };
  }) => React.ReactNode;
  align?: 'start' | 'end';
  widthClass?: string;
  children: (helpers: { close: () => void }) => React.ReactNode;
}

export function DropdownMenu({
  trigger,
  align = 'end',
  widthClass = 'w-64',
  children,
}: DropdownMenuProps) {
  const triggerId = useId();
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const getEnabledItems = () => {
    const container = menuRef.current;
    if (!container) return [];
    return Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        const btn = document.getElementById(triggerId);
        btn?.focus();
      } else if (e.key === 'Tab') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, triggerId]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      }
      window.requestAnimationFrame(() => {
        const items = getEnabledItems();
        if (items.length === 0) return;
        const target = e.key === 'ArrowUp' ? items[items.length - 1] : items[0];
        target?.focus();
      });
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = getEnabledItems();
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[(currentIndex + 1 + items.length) % items.length];
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[(currentIndex - 1 + items.length) % items.length];
      prev?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const close = () => setIsOpen(false);

  return (
    <div ref={rootRef} className="relative inline-block">
      {trigger({
        id: triggerId,
        isOpen,
        onClick: () => setIsOpen((prev) => !prev),
        onKeyDown: handleTriggerKeyDown,
        ariaProps: {
          'aria-haspopup': 'menu',
          'aria-expanded': isOpen,
          'aria-controls': menuId,
        },
      })}

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={handleMenuKeyDown}
          className={`gp-glass-panel gp-popover-in absolute top-full mt-2 z-50 rounded-xl p-1.5 max-w-[calc(100vw-1.5rem)] ${widthClass} ${
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          }`}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}
