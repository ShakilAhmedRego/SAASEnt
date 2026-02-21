import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'VerifiedMeasure Enterprise',
  description: 'SaaS Intelligence Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundImage: 'var(--gradient-mesh, none)' }}>
        {children}
      </body>
    </html>
  );
}
