'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Script from 'next/script';
import { Loader2 } from 'lucide-react';
import { GoogleCredentialResponse } from '../../types/google';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleCredentialResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        onError?.('Không nhận được mã xác thực từ Google.');
        return;
      }

      setIsProcessing(true);
      try {
        await onSuccess(response.credential);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Xác thực tài khoản Google thất bại. Vui lòng thử lại.';
        onError?.(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [onSuccess, onError],
  );

  useEffect(() => {
    if (!isScriptLoaded || !clientId || !containerRef.current) return;

    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Clear container before rendering
      containerRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: mode === 'signup' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        width: 384,
        logo_alignment: 'left',
        locale: 'vi',
      });
    }
  }, [isScriptLoaded, clientId, handleCredentialResponse, mode]);

  if (!clientId) {
    return (
      <div className="flex flex-col items-center gap-2 w-full">
        {isClientDev && onDevChooserClick ? (
          <button
            type="button"
            onClick={onDevChooserClick}
            disabled={disabled || isProcessing}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-xs font-medium text-white shadow-xs transition-all hover:bg-white/[0.08] hover:border-white/25 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <span>Đăng nhập Google (Giả lập Dev)</span>
          </button>
        ) : (
          <div className="text-xs text-slate-500 font-mono text-center">
            [Google Client ID chưa cấu hình]
          </div>
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
          <div className="absolute inset-0 flex items-center justify-center bg-[#070b1a]/80 backdrop-blur-xs rounded-xl z-10">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          </div>
        )}

        <div
          ref={containerRef}
          className={`w-full flex justify-center [&>div]:w-full! [&>div>iframe]:w-full! [&>div>iframe]:rounded-xl! ${
            disabled ? 'pointer-events-none opacity-50' : ''
          }`}
        />
      </div>
    </>
  );
}
