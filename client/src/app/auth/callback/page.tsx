'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../../lib/auth-context';
import { useTranslation } from '../../../i18n';
import { Footer } from '../../../components/layout/Footer';

function SsoCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithSso } = useAuth();
  const { dict } = useTranslation();

  const code = searchParams.get('code');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');

  useEffect(() => {
    let mounted = true;

    async function handleExchange() {
      if (!code) {
        if (mounted) {
          setError(dict.auth.callback.missingCode);
          setStatus('failed');
        }
        return;
      }

      const verifier =
        sessionStorage.getItem('sso_code_verifier') ||
        'git-pulse-default-pkce-verifier-client-side-auth';

      const result = await loginWithSso(code, verifier);

      if (mounted) {
        if (result.success) {
          sessionStorage.removeItem('sso_code_verifier');
          setStatus('success');
          setTimeout(() => {
            router.push('/');
          }, 800);
        } else {
          setError(result.error || dict.auth.callback.failedDefault);
          setStatus('failed');
        }
      }
    }

    handleExchange();

    return () => {
      mounted = false;
    };
  }, [code, loginWithSso, router, dict]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-full max-w-md gp-card rounded-xl p-8">
          {status === 'verifying' && (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto rounded-xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
              </div>
              <h1 className="text-base font-semibold text-slate-100 tracking-tight">
                {dict.auth.callback.verifyingTitle}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                {dict.auth.callback.verifyingDesc}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <h1 className="text-base font-semibold text-slate-100 tracking-tight">
                {dict.auth.callback.successTitle}
              </h1>
              <p className="text-xs text-slate-400">{dict.auth.callback.successDesc}</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-6 h-6" aria-hidden="true" />
              </div>
              <h1 className="text-base font-semibold text-slate-100 tracking-tight">
                {dict.auth.callback.failedTitle}
              </h1>
              <p role="alert" className="text-xs text-rose-400 font-medium leading-relaxed">
                {error}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="min-h-[38px] px-5 py-2 rounded-lg text-xs font-medium text-slate-100 bg-[#253349] hover:bg-[#2E3E58] border border-slate-600 transition-colors cursor-pointer"
                >
                  {dict.common.backHome}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 min-h-0 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-sky-400" aria-hidden="true" />
        </div>
      }
    >
      <SsoCallbackHandler />
    </Suspense>
  );
}
