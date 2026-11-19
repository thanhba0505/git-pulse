import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { InteractiveBackdrop } from '../components/ui/InteractiveBackdrop';
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
  themeColor: '#0F172A',
};

export const metadata: Metadata = {
  title: 'Git Pulse | Git Activity & AI Standup Workspace',
  description: 'Developer Intelligence & AI Standup Workspace.',
};

function getSafeOrigin(urlValue?: string): string | null {
  if (!urlValue) return null;
  try {
    return new URL(urlValue).origin;
  } catch {
    return null;
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const apiOrigin = getSafeOrigin(process.env.NEXT_PUBLIC_API_URL);

  return (
    <html
      lang="vi"
      className={`dark ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {apiOrigin && <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" />}
        <link rel="preconnect" href="https://accounts.google.com" />
      </head>
      <body className="h-screen h-[100dvh] overflow-hidden bg-[#0F172A] text-slate-50 antialiased selection:bg-sky-500/30 selection:text-sky-100">
        <InteractiveBackdrop />
        <I18nProvider>
          <ToastProvider>
            <AuthProvider>
              <div className="relative z-10 flex h-full w-full flex-col overflow-hidden">
                {children}
              </div>
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
