import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Lumine.io',
  description: 'Sistema de gestão completo para a Lumine',
  // O favicon vem de src/app/icon.svg e src/app/apple-icon.png, que o
  // App Router detecta pelo nome do arquivo — não precisa declarar aqui.
};

export const viewport: Viewport = {
  themeColor: '#B8A9C9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
