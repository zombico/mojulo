/**
 * MOTION — the UI's moves, a closed set with game timing (the counterpart of objects/drive.js: a drive moves an
 * entry's t, a motion moves a part between appearance states). Durations are FRAMES on the game clock (60 a second),
 * so a pause freezes them and hit-stop reaches them; nothing eases on hover, and nothing moves that means nothing.
 *
 *   UI_MOTIONS              name → { frames, rail: [lo, hi], use, loop? }
 *   motionSheet(dial, F)    the motions for a register's motion dial: [{ name, frames, ms, fn, use }], F overriding
 *                           frames per motion (the guide's rolled numbers)
 *   rollMotion(R)           frames per motion drawn inside each rail by seeded dice R()
 */
import { MOTION_TIMING } from './register.js';

export const FPS = 60;
export const UI_MOTIONS = Object.freeze({
  snap: { frames: 2, rail: [1, 3], use: 'a part appears or goes' },
  punch: { frames: 8, rail: [6, 12], use: 'a value changes: a short overshoot' },
  roll: { frames: 20, rail: [12, 30], use: 'a counter ticks up to its new value' },
  shake: { frames: 10, rail: [6, 14], use: 'harm lands' },
  pulse: { frames: 36, rail: [24, 48], use: 'urgency, on the status accent only', loop: true },
  'hold-fade': { frames: 60, rail: [48, 90], use: 'a toast: held, then faded over its last fifth' },
  slide: { frames: 12, rail: [8, 18], use: 'a layer comes in or goes on a phase change' },
  sway: { frames: 90, rail: [60, 120], use: 'a diegetic part lags the camera', loop: true },
});
export const MOTION_IDS = Object.keys(UI_MOTIONS);

/** The motions at a register's motion dial, frames from `F` where the guide rolled them. */
export function motionSheet(dial = 'ease', F = {}) {
  const t = MOTION_TIMING[dial] || MOTION_TIMING.ease;
  return MOTION_IDS.map((name) => {
    const M = UI_MOTIONS[name], frames = Number.isInteger(F[name]) ? F[name] : M.frames;
    return { name, frames, ms: Math.round((frames / FPS) * 1000), fn: t.fn, use: M.use, ...(M.loop ? { loop: true } : {}) };
  });
}

/** Frames per motion drawn inside each rail. */
export function rollMotion(R) {
  const out = {};
  for (const name of MOTION_IDS) { const [lo, hi] = UI_MOTIONS[name].rail; out[name] = lo + Math.floor(R() * (hi - lo + 1)); }
  return out;
}
