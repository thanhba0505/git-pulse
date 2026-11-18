'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

const MOTION_STORAGE_KEY = 'git_pulse_motion_paused';
const MOTION_CHANGE_EVENT = 'git-pulse:motion-change';

export function readMotionPausedPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MOTION_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setMotionPausedPreference(paused: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, paused ? 'true' : 'false');
  } catch {
    // Ignore storage restriction errors
  }

  document.documentElement.dataset.gpMotion = paused ? 'paused' : 'active';
  window.dispatchEvent(new CustomEvent(MOTION_CHANGE_EVENT));
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(MOTION_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(MOTION_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

export function useAmbientMotionPreference() {
  const isPaused = useSyncExternalStore(subscribe, readMotionPausedPreference, () => false);

  useEffect(() => {
    document.documentElement.dataset.gpMotion = isPaused ? 'paused' : 'active';
  }, [isPaused]);

  const toggleMotion = useCallback(() => {
    setMotionPausedPreference(!readMotionPausedPreference());
  }, []);

  return { isPaused, toggleMotion };
}
