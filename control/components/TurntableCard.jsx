'use client';

/**
 * The gallery card's picture — a still that turns.
 *
 * A card cannot afford a WebGL context and a single still cannot show that the
 * thing has a back, so a turnable artifact gets one PNG of 16 azimuth frames
 * stepped with CSS. The frames are baked lazily: a cold card costs nothing but
 * the still it was already going to show, and the strip is minted the first time
 * someone actually asks that card to turn (bake queue in turntable-bake.js, so a
 * mouse swept across a cold grid mints one strip at a time, not twelve).
 *
 * `useTurntable` + `<TurntableThumb>` split the same way phase 2's
 * `useDisplayModeState` + `<DisplayModes>` do: the hook holds the state and the
 * hover handlers the CARD root wants (so hovering anywhere on the card turns the
 * picture), the component draws.
 *
 * Design: components/3d-factory-ui.plan.md §6.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { renderModeOf } from '@/lib/graph/sketch/sketch-summary';
import { resolveTurntableForMode, stripStyleVars } from '@/lib/graph/sketch/turntable-strip';

/** Whether this viewer has asked not to be moved. Read at hover time, never at render (SSR-safe). */
function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Turntable state for one artifact — a gallery summary (server-derived
 * `renderMode`, no manifest) or a full sketch (the detail page); sketch-summary's
 * `renderModeOf` reads either, so the card never needs the recipe.
 *
 * @param {{ ref: string, renderMode?: string, manifest?: object }} sketch
 * @returns {{ turntable: object|null, strip: string|null, turning: boolean, promote: function, handlers: object }}
 *   spread `handlers` onto the card root; pass the rest to <TurntableThumb>.
 */
export function useTurntable(sketch) {
  const renderMode = renderModeOf(sketch);
  const turntable = useMemo(
    () => resolveTurntableForMode({ renderMode, ref: sketch?.ref }),
    [renderMode, sketch?.ref],
  );
  return useTurntableResolved(turntable);
}

/**
 * The same state machine over a server-derived render mode — for light rows
 * (the splayed floor's strips) that carry `renderMode` instead of a manifest.
 */
export function useTurntableMode(row) {
  const turntable = useMemo(
    () => resolveTurntableForMode({ renderMode: row?.renderMode, ref: row?.ref }),
    [row?.renderMode, row?.ref],
  );
  return useTurntableResolved(turntable);
}

function useTurntableResolved(turntable) {
  const [strip, setStrip] = useState(null);
  const [awake, setAwake] = useState(false);
  // One request per card per mount, whether it succeeds or not — a card whose
  // world fails to bake must not re-ask on every hover.
  const asked = useRef(false);

  const load = useCallback(({ cachedOnly = false } = {}) => {
    if (!turntable?.turns || asked.current) return;
    // Reduced motion never turns, so it never pays for a bake either — but it
    // may still adopt a strip that already exists (see `promote`), because a
    // frame parked at rest is a still, not motion.
    if (!cachedOnly && prefersReducedMotion()) return;
    asked.current = true;
    const src = cachedOnly ? `${turntable.strip}?cached=1` : turntable.strip;
    // Preload rather than binding the URL straight into the DOM: the bake can
    // take seconds on a cold card, and swapping only on load means the still
    // holds the frame instead of the card flashing empty. A cached-only miss
    // simply never fires onload, so the card keeps its icon.
    const img = new window.Image();
    img.onload = () => setStrip(src);
    img.onerror = () => { asked.current = false; };   // a cached miss may still bake on hover
    img.src = src;
  }, [turntable]);

  const wake = useCallback(() => {
    if (!turntable?.turns) return;
    setAwake(true);
    load();
  }, [turntable, load]);

  const rest = useCallback(() => setAwake(false), []);

  // The still failed, so an ALREADY-BAKED strip becomes the still. This is not a
  // nicety: the orbit-only kinds (planetary, the science and education views)
  // have no CSS-3D /scene form, so /png 422s for them and they have never had a
  // gallery thumbnail at all — a documented v1 gap. Their turntable bakes fine,
  // and frame 0 of it is a better picture than an icon.
  //
  // Strictly cached-only, because this fires without anyone asking: a shelf of a
  // hundred such views would otherwise enqueue a hundred bakes on load. Which
  // means the gap closes going FORWARD — the mint-time warm bakes every new
  // world's strip, so a freshly minted view has a thumbnail on first sight —
  // while an older one keeps its icon until someone hovers it and mints one.
  const promote = useCallback(() => load({ cachedOnly: true }), [load]);

  return {
    turntable,
    strip,
    promote,
    turning: awake && Boolean(strip),
    // onFocus/onBlur bubble in React, so tabbing to the card's own checkbox or
    // preview button wakes the picture — no extra tab stop per card.
    handlers: { onMouseEnter: wake, onMouseLeave: rest, onFocus: wake, onBlur: rest },
  };
}

/**
 * The card's media block. Renders, in order of what the artifact actually has:
 * the turning strip, the still, or — for the artifacts that are not looked at at
 * all (beats are heard, voice is spoken, a game is played) — the caller's icon.
 */
export default function TurntableThumb({ turntable, strip, turning, promote, alt, fallback = null, className = '' }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const still = turntable?.still;
  // object-COVER only where a strip is coming: the cold still is a different
  // renderer at a different aspect than the strip's cells, and letterboxing it
  // would make the subject jump size the moment the strip arrives — cropping the
  // dark margins lands it close to the strip's own framing. A flat artifact has
  // no strip to match, so it is shown whole: cropping an illustration or a chart
  // to fill a card loses part of the artifact for nothing.
  const fit = turntable?.turns ? 'object-cover' : 'object-contain';

  return (
    // The plate carries the faint field (3d-factory-ui.plan.md §7c): behind a
    // loaded still it is invisible, and behind a baking or icon-only card the
    // artifact reads as a thing condensing out of the lattice — which is what
    // a recipe is.
    <div className={`moj-field-faint relative w-full aspect-[4/3] overflow-hidden bg-[color:var(--bay-floor)] ${className}`}>
      {/* Under everything: the icon. It is what a beats track or a game shows
          permanently, and what any card shows while its still is still baking —
          a cold world PNG takes seconds, and an empty box reads as broken. */}
      <div className="absolute inset-0 flex items-center justify-center text-gray-600">
        {fallback}
      </div>
      {still && !failed && (
        <img
          src={still}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => { setFailed(true); promote?.(); }}
          className={`absolute inset-0 h-full w-full ${fit} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {/* Once the strip has loaded it OWNS the card, paused on frame 0 at rest
          and running on hover — so the still-to-strip swap happens once, on the
          first hover, instead of on every hover. Painted only after load, so a
          cold bake never flashes the card empty. */}
      {strip && (
        <div
          aria-hidden="true"
          className={`moj-turntable absolute inset-0 ${turning ? 'is-turning' : ''}`}
          style={{ backgroundImage: `url(${strip})`, ...stripStyleVars(turntable) }}
        />
      )}
    </div>
  );
}
