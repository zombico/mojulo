'use client';

// Lite is single-user. Top bar: brand-as-home on the left, settings on the
// right. When CONTROL_PLANE_USER/PASSWORD are set in env, layout.js passes
// authEnabled=true and a logout link is rendered next to settings.

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import MojuloMark from '@/components/brand/MojuloMark';
import WorkshopDrawer from '@/components/WorkshopDrawer';

function HomeIcon() {
  // The 2.0 mark — the dot-relief `m` (3d-factory-ui.plan.md §7c), baked by
  // scripts/build-brand-mark.mjs. 28px is the measured floor at which the
  // halftone still resolves; below it MojuloMark switches to the solid reading
  // of the same skeleton, so the nav can never show mush.
  //
  // Deliberately NO sizing class: the old icon took `h-5 w-5`, which would both
  // shrink the lattice past its floor and squash a 18:15 mark into a square.
  // The mark carries its own size and aspect.
  return <MojuloMark size={28} className="text-[color:var(--ink-primary)]" />;
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

function AuthNavBody({ authEnabled = false }) {
  const tSettings = useTranslations('settings');
  const tLogin = useTranslations('login');
  const tHome = useTranslations('home');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navOpen, setNavOpen] = useState(false);

  // Bare-view routes: the agent launches the user directly into a single
  // artifact (e.g. a minted sketch) and the surrounding nav would distract
  // from the thing they came to see. Skip rendering chrome on these paths.
  if (pathname && pathname.startsWith('/sketches/')) return null;
  // The front door IS the nav: its shell's top strip carries the brand, the
  // locator, the install pills, Settings and the sign-out (WorkshopHome's
  // NavStrip). Rendering this bar above it would describe the app twice.
  if (pathname === '/') return null;
  // The splayed floor wears the same shell strip, so it stands the chrome down
  // too — but only the floor reading: `/dashboard?ref=` is the viewport home,
  // which lays itself out below this bar and keeps it.
  if (pathname === '/dashboard' && !searchParams.get('ref')) return null;
  // The library wears the shell as well (`?shelf=` is a filter chip, not a
  // separate reading — every shelf shares the one shell surface).
  if (pathname === '/library') return null;

  async function onLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.replace('/login');
  }

  return (
    <nav className="w-full border-b border-[color:var(--border-color)] bg-[color:var(--surface-primary)] px-4 py-2 flex items-center justify-between text-sm">
      {/* The brand opens the global Workshop nav drawer rather than navigating
          home — home stays reachable as the first link inside the drawer. */}
      <button
        type="button"
        onClick={() => setNavOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={navOpen}
        aria-label={tHome('drawer.open')}
        className="moj-hover-wave font-semibold tracking-tight inline-flex items-center gap-2 rounded-md px-1 py-0.5 hover:text-white hover:bg-[color:var(--surface-elevated)]/40 transition"
      >
        <HomeIcon />
        Mojulo
      </button>
      <WorkshopDrawer open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex items-center gap-4 text-[color:var(--text-muted)]">
        <Link href="/settings" className="moj-hover-pop inline-flex items-center gap-1.5 hover:text-white">
          <GearIcon />
          {tSettings('title')}
        </Link>
        {authEnabled ? (
          <button
            type="button"
            onClick={onLogout}
            className="moj-hover-pop inline-flex items-center gap-1.5 hover:text-white"
          >
            <SignOutIcon />
            {tLogin('signOut')}
          </button>
        ) : null}
      </div>
    </nav>
  );
}

// `useSearchParams` needs a Suspense boundary above it (the ViewportHome
// pattern); the fallback is nothing because the bar is chrome, not content.
export default function AuthNav(props) {
  return (
    <Suspense fallback={null}>
      <AuthNavBody {...props} />
    </Suspense>
  );
}
