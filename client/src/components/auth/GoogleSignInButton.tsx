'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { Loader2 } from 'lucide-react';
import { GoogleCredentialResponse } from '../../types/google';
import { useTranslation } from '../../i18n';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => Promise<void> | void;
  onError?: (error: string) => void;
  disabled?: boolean;
  onDevChooserClick?: () => void;
  isClientDev?: boolean;
  mode?: 'signin' | 'signup';
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  disabled = false,
  onDevChooserClick,
  isClientDev = false,
  mode = 'signin',
}: GoogleSignInButtonProps) {
  const { locale, dict } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedClientIdRef = useRef<string | null>(null);
  const handlersRef = useRef({ onSuccess, onError, dict });

  useEffect(() => {
    handlersRef.current = { onSuccess, onError, dict };
  }, [onSuccess, onError, dict]);

  const [isScriptLoaded, setIsScriptLoaded] = useState(
    () => typeof window !== 'undefined' && Boolean(window.google?.accounts?.id),
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!isScriptLoaded || !clientId || !containerRef.current) return;

    const gsi = window.google?.accounts?.id;
    if (!gsi) return;

    if (initializedClientIdRef.current !== clientId) {
      gsi.initialize({
        client_id: clientId,
        callback: async (response: GoogleCredentialResponse) => {
          const { onSuccess: submit, onError: fail, dict: activeDict } = handlersRef.current;
          if (!response.credential) {
            fail?.(activeDict.auth.googleNoCredential);
            return;
          }

          setIsProcessing(true);
          try {
            await submit(response.credential);
          } catch (err) {
            const msg = err instanceof Error ? err.message : activeDict.auth.googleAuthFailed;
            fail?.(msg);
          } finally {
            setIsProcessing(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      initializedClientIdRef.current = clientId;
    }

    containerRef.current.innerHTML = '';

    gsi.renderButton(containerRef.current, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: mode === 'signup' ? 'signup_with' : 'signin_with',
      shape: 'rectangular',
      width: 384,
      logo_alignment: 'left',
      locale: locale === 'en' ? 'en' : 'vi',
    });
  }, [isScriptLoaded, clientId, mode, locale]);

  if (!clientId) {
    return (
      <div className="flex flex-col items-center gap-2 w-full">
        {isClientDev && onDevChooserClick ? (
          <button
            type="button"
            onClick={onDevChooserClick}
            disabled={disabled || isProcessing}
            className="flex w-full min-h-[42px] items-center justify-center gap-2.5 rounded-lg border border-slate-600/80 bg-[#253349] px-4 py-2.5 text-xs font-medium text-slate-100 transition-colors hover:bg-[#2E3E58] hover:border-slate-500 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <span>{dict.auth.googleDevBtn}</span>
          </button>
        ) : (
          <p className="text-xs text-slate-400 text-center">{dict.auth.googleUnconfigured}</p>
        )}
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setIsScriptLoaded(true)}
      />

      <div className="relative flex flex-col items-center justify-center w-full min-h-[44px]">
        {(!isScriptLoaded || isProcessing) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1E293B]/90 backdrop-blur-sm rounded-lg z-10">
            <Loader2 className="h-5 w-5 animate-spin text-sky-400" aria-hidden="true" />
          </div>
        )}

        <div
          ref={containerRef}
          className={`w-full flex justify-center [&>div]:!w-full [&>div>iframe]:!w-full [&>div>iframe]:!rounded-lg ${
            disabled ? 'pointer-events-none opacity-50' : ''
          }`}
        />
      </div>
    </>
  );
}
