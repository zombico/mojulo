'use client';

// The view-cube preset strip — ¾ / Front / Side / Top posted into an embedded
// /world frame over the view-cube protocol (lib/graph/scene/view-cube-contract.js).
//
// Protocol-gated on purpose: the strip renders only after the frame announces
// MSG_VIEW_READY, so a CSS-3D /scene frame, a plain image, or a frame that failed
// to boot never grows buttons that do nothing. The camera itself stays inside the
// frame's three.js context — the parent only ever asks.

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  VIEW_PRESETS,
  focusMessage,
  isViewReadyMessage,
  selectableGroups,
  viewMessage,
} from '@/lib/graph/scene/view-cube-contract';

/**
 * Tracks whether the iframe behind `frameRef` speaks the protocol, and what it
 * announced: `groups` is the frame's own selectable render groups (`static`
 * dropped — isolating the whole world means nothing). `src` keys the reset: a
 * remounted or re-pointed frame must re-announce before the strip returns.
 *
 * `focused` lives here because it is protocol state, not page state — it must
 * clear when the frame does, or a stale isolation would carry into a fresh world.
 */
export function useWorldViewProtocol(frameRef, src) {
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState([]);
  const [focused, setFocused] = useState(null);
  useEffect(() => {
    setReady(false);
    setGroups([]);
    setFocused(null);
    if (!src) return undefined;
    function onMsg(e) {
      if (!isViewReadyMessage(e.data)) return;
      // Only trust the frame we mounted — a page can hold several live worlds
      // (the floor's bench hero, a board focus) and each strip answers for its own.
      if (frameRef.current && e.source === frameRef.current.contentWindow) {
        setReady(true);
        setGroups(selectableGroups(e.data));
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [frameRef, src]);
  const send = useCallback(
    (view) => frameRef.current?.contentWindow?.postMessage(viewMessage(view), '*'),
    [frameRef],
  );
  // Toggle semantics: focusing the focused group clears it. The wire write rides
  // an effect so the updater stays pure (Strict Mode double-invokes updaters);
  // re-posting the same value is idempotent on the viewer side.
  const focus = useCallback((group) => {
    setFocused((prev) => (prev === group ? null : group));
  }, []);
  useEffect(() => {
    if (ready) frameRef.current?.contentWindow?.postMessage(focusMessage(focused), '*');
  }, [frameRef, ready, focused]);
  return { ready, groups, focused, focus, send };
}

/** The strip itself — absolutely positioned by its parent (top-right of the pane). */
export default function WorldViewStrip({ ready, send }) {
  const t = useTranslations('viewCube');
  if (!ready) return null;
  return (
    <span className="absolute right-2 top-2 z-10 flex items-center gap-1" role="group" aria-label={t('label')}>
      {VIEW_PRESETS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => send(v)}
          className="rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)]/80 px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--ink-muted)] transition-colors duration-100 hover:border-[color:var(--bay-rail-lit)] hover:text-[color:var(--ink-secondary)]"
        >
          {t(v)}
        </button>
      ))}
    </span>
  );
}
