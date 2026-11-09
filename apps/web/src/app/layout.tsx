import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/shared/styles/globals.css';
import { SessionProvider } from '@/shared/auth';
import { ToastProvider } from '@/shared/ui/Toast';

export const metadata: Metadata = {
  title: 'Down to Earth Investments',
  description: 'Investor portal for Down to Earth Investments.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-sans">
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
