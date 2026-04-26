import type { Metadata } from 'next';
import './globals.css';
import { ReactNode } from 'react';
import Navigation from '@/components/Navigation';
import { AuthProvider } from '@/context/auth-context';

export const metadata: Metadata = {
  title: 'Top Shelf Draft',
  description: 'Data-driven NHL playoff fantasy draft assistant',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navigation />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
