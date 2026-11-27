// (the dashboard's faces ship beside it, app/fonts/, each under the SIL Open Font License: a build fetches nothing, so a
// box with no route to Google's font service builds as any other)
import localFont from 'next/font/local';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import AuthNav from '@/components/AuthNav';
import { rtlLocales } from '@/i18n/config';
import { isAuthEnabled } from '@/lib/auth/session';

const geistSans = localFont({ src: './fonts/geist-variable.woff2', variable: '--font-geist-sans', weight: '100 900', display: 'swap' });
const geistMono = localFont({ src: './fonts/geist-mono-variable.woff2', variable: '--font-geist-mono', weight: '100 900', display: 'swap' });
const outfit = localFont({ src: './fonts/outfit-variable.woff2', variable: '--font-outfit', weight: '100 900', display: 'swap' });

export const metadata = {
  title: 'Mojulo',
  description: 'The mojulo dashboard — your agent\'s 3D creative studio: objects, worlds and playable games, made by talking to Claude Code, Codex, or any other MCP-capable agent',
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();

  const dir = rtlLocales.has(locale) ? 'rtl' : 'ltr';
  const authEnabled = isAuthEnabled();

  return (
    <html lang={locale} dir={dir}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthNav authEnabled={authEnabled} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
