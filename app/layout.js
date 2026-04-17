import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'ScriptApp — Video Scripting Workflow',
  description:
    'Timeline-based scripting tool for continuous-shot video production. Plan, write, and organize narration across scenes with AI-powered polish and YouTube asset generation.',
  keywords: [
    'video scripting',
    'narration tool',
    'video production',
    'script editor',
    'youtube scripting',
    'AI script writer',
    'scene timeline',
  ],
  openGraph: {
    title: 'ScriptApp — Video Scripting Workflow',
    description:
      'Timeline-based scripting tool for continuous-shot video production. Plan, write, and organize narration across scenes.',
    type: 'website',
    siteName: 'ScriptApp',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ScriptApp — Video Scripting Workflow',
    description:
      'Timeline-based scripting tool for continuous-shot video production.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  authors: [{ name: 'ScriptApp' }],
  creator: 'ScriptApp',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
