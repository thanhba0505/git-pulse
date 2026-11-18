'use client';

import React from 'react';
import { useTranslation } from '../../i18n';

export function Footer() {
  const { dict } = useTranslation();
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.4.0';

  return (
    <footer className="relative z-20 shrink-0 border-t border-white/[0.08] bg-[#090B10]/55 py-3.5 sm:py-4 text-center font-mono text-xs text-slate-400 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-center gap-1.5 px-4 sm:flex-row sm:gap-2.5">
        <span>
          © {new Date().getFullYear()} {dict.header.brand} • {dict.footer.tagline}
        </span>
        <span className="hidden sm:inline text-slate-600" aria-hidden="true">
          •
        </span>
        <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300/90 tabular-nums">
          v{version}
        </span>
      </div>
    </footer>
  );
}
