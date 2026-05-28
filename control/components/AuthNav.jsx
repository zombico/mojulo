'use client';

// Lite is single-user. Top bar: brand-as-home on the left, settings on the
// right. When CONTROL_PLANE_USER/PASSWORD are set in env, layout.js passes
// authEnabled=true and a logout link is rendered next to settings.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

function HomeIcon({ className = 'h-5 w-5' }) {
  // Mojulo favicon (3-card stack with teal gradient) — keeps the brand
  // visual identical to the tab favicon.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="160 115 70 70"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="authNavCardBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d6f68" />
          <stop offset="0.55" stopColor="#134e4a" />
          <stop offset="1" stopColor="#0a2a28" />
        </linearGradient>
        <linearGradient id="authNavCardMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7af0dc" />
          <stop offset="0.5" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#138a78" />
        </linearGradient>
        <linearGradient id="authNavCardFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9f5e8" />
          <stop offset="0.5" stopColor="#5eead4" />
          <stop offset="1" stopColor="#26b8a0" />
        </linearGradient>
      </defs>
      <rect x="-9.25" y="-19.55" width="11" height="40" rx="7.75" fill="url(#authNavCardBack)" transform="translate(183.8, 150) rotate(17)" />
      <rect x="-6.45" y="-21.55" width="11" height="40" rx="7.75" fill="url(#authNavCardMid)" transform="translate(191, 150) rotate(340)" />
      <rect x="-6.00" y="-21.55" width="11" height="40" rx="7.75" fill="url(#authNavCardFront)" transform="translate(206.3, 150) rotate(340)" />
    </svg>
  );
}

function GearIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 17l5-5-5-5" />
      <path d="M20 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

export default function AuthNav({ authEnabled = false }) {
  const tSettings = useTranslations('settings');
  const tLogin = useTranslations('login');
  const router = useRouter();
  const pathname = usePathname();

  // Bare-view routes: the agent launches the user directly into a single
  // artifact (e.g. a minted sketch) and the surrounding nav would distract
  // from the thing they came to see. Skip rendering chrome on these paths.
  if (pathname && pathname.startsWith('/sketches/')) return null;

  async function onLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.replace('/login');
  }

  return (
    <nav className="w-full border-b border-[color:var(--border-color)] bg-[color:var(--surface-primary)] px-4 py-2 flex items-center justify-between text-sm">
      <Link href="/" className="font-semibold tracking-tight inline-flex items-center gap-2">
        <HomeIcon />
        Mojulo
      </Link>
      <div className="flex items-center gap-4 text-[color:var(--text-muted)]">
        <Link href="/settings" className="inline-flex items-center gap-1.5 hover:text-white">
          <GearIcon />
          {tSettings('title')}
        </Link>
        {authEnabled ? (
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 hover:text-white"
          >
            <SignOutIcon />
            {tLogin('signOut')}
          </button>
        ) : null}
      </div>
    </nav>
  );
}
