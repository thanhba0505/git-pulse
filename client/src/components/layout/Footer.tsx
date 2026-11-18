'use client';

import React from 'react';
import { useTranslation } from '../../i18n';

export function Footer() {
  const { dict } = useTranslation();

  return (
    <footer className="relative z-20 shrink-0 border-t border-white/[0.08] bg-[#090B10]/55 py-3.5 sm:py-4 px-4 text-center font-mono text-xs text-slate-400 backdrop-blur-xl">
      <p>
        © {new Date().getFullYear()} {dict.header.brand} • {dict.footer.tagline}
      </p>
    </footer>
  );
}
