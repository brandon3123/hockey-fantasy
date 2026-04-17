import type { Metadata } from 'next';
import './globals.css';
import { ReactNode } from 'react';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Hockey Playoff Draft Helper',
  description: 'Data-driven NHL playoff fantasy draft assistant',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  );
}
