'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => Promise<void> | void;
  onError?: (error: string) => void;
  disabled?: boolean;
  onDevChooserClick?: () => void;
  isClientDev?: boolean;
  mode?: 'signin' | 'signup';
}

function GoogleLogoSvg({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  disabled = false,
  onDevChooserClick,
  isClientDev = false,
  mode = 'signin',
}: GoogleSignInButtonProps) {
  const { dict } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const popupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Cleanup popup listener and polling timer on unmount
  useEffect(() => {
    return () => {
      if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
      if (messageHandlerRef.current) {
        window.removeEventListener('message', messageHandlerRef.current);
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  const handleGoogleClick = () => {
    if (disabled || isProcessing) return;

    if (!clientId) {
      if (isClientDev && onDevChooserClick) {
        onDevChooserClick();
        return;
      }
      onError?.(dict.auth.googleUnconfigured);
      return;
    }

    setIsProcessing(true);

    const redirectUri = `${window.location.origin}/auth/callback`;
    const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);

    try {
      sessionStorage.setItem('google_auth_nonce', nonce);
    } catch {
      // Ignore sessionStorage availability issues in sandboxes
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'id_token');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('prompt', 'select_account');

    // Calculate center coordinates for popup
    const width = 500;
    const height = 620;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

    const popup = window.open(
      authUrl.toString(),
      'google_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no,menubar=no`,
    );

    popupRef.current = popup;

    // If popup was blocked by browser, fallback to direct redirect
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = authUrl.toString();
      return;
    }

    try {
      popup.focus();
    } catch {
      // Ignore cross-origin focus restrictions
    }

    // Clean previous handler if exists
    if (messageHandlerRef.current) {
      window.removeEventListener('message', messageHandlerRef.current);
    }

    // Listen for response postMessage from /auth/callback
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data.credential) {
        window.removeEventListener('message', handleMessage);
        messageHandlerRef.current = null;
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        popupIntervalRef.current = null;

        try {
          await onSuccess(event.data.credential);
        } catch (err) {
          const msg = err instanceof Error ? err.message : dict.auth.googleAuthFailed;
          onError?.(msg);
        } finally {
          setIsProcessing(false);
        }
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        window.removeEventListener('message', handleMessage);
        messageHandlerRef.current = null;
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        popupIntervalRef.current = null;
        onError?.(event.data.error || dict.auth.googleAuthFailed);
        setIsProcessing(false);
      }
    };

    messageHandlerRef.current = handleMessage;
    window.addEventListener('message', handleMessage);

    // Poll to detect if user closed the popup before completing sign-in
    if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
    popupIntervalRef.current = setInterval(() => {
      if (!popup || popup.closed) {
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        popupIntervalRef.current = null;
        if (messageHandlerRef.current) {
          window.removeEventListener('message', messageHandlerRef.current);
          messageHandlerRef.current = null;
        }
        setIsProcessing(false);
      }
    }, 500);
  };

  const buttonText = mode === 'signup' ? dict.auth.signUpWithGoogle : dict.auth.continueWithGoogle;

  if (!clientId && isClientDev && onDevChooserClick) {
    return (
      <button
        type="button"
        onClick={onDevChooserClick}
        disabled={disabled || isProcessing}
        className="flex w-full min-h-[42px] items-center justify-center gap-2.5 rounded-lg border border-slate-600/80 bg-[#1E293B] px-4 py-2.5 text-xs font-semibold text-slate-100 shadow-sm transition-all hover:bg-[#253349] hover:border-slate-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      >
        <GoogleLogoSvg className="w-4 h-4 shrink-0" />
        <span>{dict.auth.googleDevBtn}</span>
      </button>
    );
  }

  if (!clientId) {
    return (
      <p className="text-xs text-slate-400 text-center py-2">{dict.auth.googleUnconfigured}</p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleGoogleClick}
      disabled={disabled || isProcessing}
      className="flex w-full min-h-[42px] items-center justify-center gap-2.5 rounded-lg border border-slate-600/80 bg-[#1E293B] px-4 py-2.5 text-xs font-semibold text-slate-100 shadow-sm transition-all hover:bg-[#253349] hover:border-slate-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
    >
      {isProcessing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-sky-400 shrink-0" aria-hidden="true" />
          <span>{dict.auth.googleConnecting}</span>
        </>
      ) : (
        <>
          <GoogleLogoSvg className="w-4 h-4 shrink-0" />
          <span>{buttonText}</span>
        </>
      )}
    </button>
  );
}
