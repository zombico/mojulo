/**
 * tell.js — THE TELL: how lit a body's SIGNAL is now (a boss's eyes, its visor, its molten pool: gameworld/bosses.js
 * `Signal`), read off the world each frame; the page brightens the signal's corners by it (scene/channels/controllable,
 * the cel body's `sigM`). The face is the tell: it shows what the body is about to do.
 *
 *   AT REST      an ember: the eyes always lit a little (REST), so the gaze reads
 *   WINDING UP   while its mind means to fire (e.aiFire) and its weapon is cooling down to the next shot: rising as the
 *                cooldown runs out (eased: slow, then fast), so the player sees the shot coming
 *   THE SHOT     a FLASH at full for FLASH s after it fires (e.lastShot), then back to the ember
 *   DOWN         a body down or gone: dark
 *
 *   tellOf(e, time) → 0..1
 *   TELL         the numbers (the function carries its own copy, being run as source: a test holds them equal)
 *
 * Import-free: the page runs this exact source (toString). Deterministic: the world's time.
 */
export const TELL = Object.freeze({ rest: 0.2, flash: 0.18, ease: 2 });

export function tellOf(e, time) {
  const T = { rest: 0.2, flash: 0.18, ease: 2 };
  if (!e || e.gone || e.downed) return 0;
  const t = time || 0, L = e.lastShot;
  if (L && t - L.t >= 0 && t - L.t < T.flash) return 1;
  const w = e.weapon;
  if (e.aiFire && w && w.cooldown > 0) {
    const ready = 1 - Math.max(0, Math.min(1, (w.cooldownT || 0) / w.cooldown));
    return T.rest + (1 - T.rest) * Math.pow(ready, T.ease);
  }
  return T.rest;
}
