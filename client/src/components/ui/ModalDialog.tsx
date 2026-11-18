'use client';

import React, { useEffect, useRef } from 'react';

interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  maxWidthClass?: string;
  dismissible?: boolean;
  children: React.ReactNode;
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (dismissible) {
      onClose();
    }
  };

  const handleNativeClose = () => {
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
      className={`m-auto w-[calc(100%-2rem)] ${maxWidthClass} bg-transparent p-0 text-slate-100 open:flex open:flex-col gp-dialog-in`}
    >
      {isOpen && (
        <div className="gp-modal-surface rounded-xl w-full flex flex-col max-h-[88dvh] overflow-hidden">
          {children}
        </div>
      )}
    </dialog>
  );
}
