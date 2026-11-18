import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { I18nProvider } from '../i18n';
import { AuthProvider } from '../lib/auth-context';

const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin', 'vietnamese'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#090B10',
};

export const metadata: Metadata = {
  title: 'Git Pulse | Git Activity & AI Standup Workspace',
  description: 'Developer Intelligence & AI Standup Workspace.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`dark ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh gp-canvas-backdrop text-slate-100 antialiased selection:bg-sky-500/30 selection:text-sky-100">
        <I18nProvider>
          <AuthProvider>
            <div className="relative flex min-h-dvh flex-col">{children}</div>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
