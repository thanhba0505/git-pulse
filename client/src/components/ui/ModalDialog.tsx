'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  maxWidthClass?: string;
  dismissible?: boolean;
  children: React.ReactNode;
}

let cachedSupportsTopLayerExit: boolean | null = null;
const openModalStack: HTMLDialogElement[] = [];
const topDialogListeners = new Set<() => void>();

function notifyTopDialogListeners() {
  for (const listener of topDialogListeners) {
    listener();
  }
}

function registerOpenModalDialog(dialog: HTMLDialogElement) {
  const existingIdx = openModalStack.indexOf(dialog);
  if (existingIdx !== -1) {
    openModalStack.splice(existingIdx, 1);
  }
  openModalStack.push(dialog);
  notifyTopDialogListeners();
}

function unregisterOpenModalDialog(dialog: HTMLDialogElement | null) {
  if (!dialog) return;
  const idx = openModalStack.indexOf(dialog);
  if (idx !== -1) {
    openModalStack.splice(idx, 1);
    notifyTopDialogListeners();
  }
}

export function getTopOpenModalDialog(): HTMLDialogElement | null {
  return openModalStack.length > 0 ? openModalStack[openModalStack.length - 1] : null;
}

export function subscribeTopOpenModalDialog(listener: () => void): () => void {
  topDialogListeners.add(listener);
  return () => {
    topDialogListeners.delete(listener);
  };
}

function canUseNativeTopLayerExit(): boolean {
  if (cachedSupportsTopLayerExit !== null) return cachedSupportsTopLayerExit;
  if (typeof window === 'undefined' || !window.CSS?.supports || !document.body) {
    return false;
  }

  if (
    !window.CSS.supports('overlay', 'auto') ||
    !window.CSS.supports('transition-behavior', 'allow-discrete')
  ) {
    cachedSupportsTopLayerExit = false;
    return false;
  }

  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedSupportsTopLayerExit = getComputedStyle(probe).display === 'block';
  probe.remove();

  return cachedSupportsTopLayerExit;
}

export function ModalDialog({
  isOpen,
  onClose,
  labelledBy,
  maxWidthClass = 'max-w-lg',
  dismissible = true,
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);
  const [rendered, setRendered] = useState(isOpen);

  if (isOpen && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      unregisterOpenModalDialog(dialog);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    let cancelled = false;

    if (isOpen) {
      dialog.removeAttribute('data-closing');
      if (!dialog.open) {
        dialog.showModal();
      }
      registerOpenModalDialog(dialog);
      return;
    }

    if (dialog.open) {
      const finishClose = () => {
        if (cancelled) return;
        dialog.removeAttribute('data-closing');
        if (dialog.open) {
          dialog.close();
        }
        unregisterOpenModalDialog(dialog);
        setRendered(false);
      };

      if (canUseNativeTopLayerExit()) {
        dialog.close();
        unregisterOpenModalDialog(dialog);
        const animations = dialog.getAnimations({ subtree: true });
        if (animations.length > 0) {
          Promise.race([
            Promise.allSettled(animations.map((a) => a.finished)),
            new Promise((r) => setTimeout(r, 250)),
          ]).then(() => {
            if (!cancelled) setRendered(false);
          });
        } else {
          setRendered(false);
        }
      } else {
        dialog.setAttribute('data-closing', '');
        const animations = dialog.getAnimations({ subtree: true });
        if (animations.length > 0) {
          Promise.race([
            Promise.allSettled(animations.map((a) => a.finished)),
            new Promise((r) => setTimeout(r, 250)),
          ]).then(finishClose);
        } else {
          finishClose();
        }
      }
    } else {
      unregisterOpenModalDialog(dialog);
      if (rendered) {
        setRendered(false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, rendered]);

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (dismissible) {
      onClose();
    }
  };

  const handleNativeClose = () => {
    unregisterOpenModalDialog(dialogRef.current);
    if (isOpen) {
      onClose();
    }
  };

  const isPointerOutside = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return false;
    const rect = dialog.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDialogElement>) => {
    if (!dismissible) return;
    pressedOutsideRef.current = isPointerOutside(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDialogElement>) => {
    if (!dismissible) return;
    if (pressedOutsideRef.current && isPointerOutside(e)) {
      onClose();
    }
    pressedOutsideRef.current = false;
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={`gp-top-dialog m-auto w-[calc(100%-2rem)] ${maxWidthClass} bg-transparent p-0 text-slate-100 open:flex open:flex-col`}
    >
      {rendered && (
        <div className="gp-modal-surface rounded-xl w-full flex flex-col max-h-[88dvh] overflow-hidden">
          {children}
        </div>
      )}
    </dialog>
  );
}
