/**
 * playscape objects — the encyclopedia's entries resolved for one opening at one moment.
 *
 *   resolveObject({ entry, variant, skin?, fit | anchor, t? | state?, params? }) → {
 *     entry, variant, skin, t, params, frame,
 *     faces       the skinned leaves posed at t, in the world (values only, obj:* groups)
 *     collider    [{ min, max, of }] what blocks at t, in the world
 *     sweep       [{ min, max, of }] the space the leaves pass through, in the world: keep it clear
 *     clearance   { width, height, passable } what a walker gets through at t
 *     usePoints   [{ at, side, use }] where the player stands to use it, in the world
 *   }
 *   ejectObject(resolved) → { kind: 'game-object', entry, variant, skin, params, ejected: true }
 *
 * A platform, a lift, a catapult and a bridge resolve themselves (`resolve` on the entry) and answer in their own terms: a deck, its sweep
 * and headroom or its shaft and landings, its landing read, a catapult its throw and arc, and the pieces the world runs (`world`).
 *
 * The variant says what it does, the skin what it looks like, the fit how big it is, t where it is in its motion.
 * An ejected object keeps its numbers, so it is edited like any recipe and no longer follows its opening.
 */
import { DOOR } from './door.js';
import { PLATFORM } from './platform.js';
import { LIFT } from './lift.js';
import { CATAPULT } from './catapult.js';
import { BRIDGE } from './bridge.js';
import { collider, sweep, clearance, toWorld } from './mechanism.js';

export const ENTRIES = Object.freeze({ door: DOOR, platform: PLATFORM, lift: LIFT, catapult: CATAPULT, bridge: BRIDGE });
export const ENTRY_IDS = Object.freeze(Object.keys(ENTRIES));

const DEFAULT_FRAME = { at: [0, 0, 0], N: [0, -1, 0], U: [1, 0, 0] };

// an axis-aligned box in the opening's frame, as the box around its eight corners in the world
const boxToWorld = (frame) => {
  const W = toWorld(frame);
  return ({ min, max, of }) => {
    const cs = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => W([i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]));
    return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]))), max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]))), of };
  };
};

export function resolveObject({ entry, variant, skin = 'greybox', fit, anchor, t, state, params, ...spec } = {}) {
  const E = ENTRIES[entry];
  if (!E) throw new Error(`playscape: unknown entry '${entry}' (known: ${ENTRY_IDS.join(', ')})`);
  if (E.resolve) return E.resolve({ variant, skin, t, params, ...spec });   // an entry that resolves itself (platform, lift)
  if (!E.variants[variant]) throw new Error(`playscape: a ${entry} has no variant '${variant}' (variants: ${Object.keys(E.variants).join(', ')})`);
  if (!E.skins[skin]) throw new Error(`playscape: a ${entry} has no skin '${skin}' (skins: ${Object.keys(E.skins).join(', ')})`);
  if (state !== undefined && !(state in E.states)) throw new Error(`playscape: a ${entry} has no state '${state}' (states: ${Object.keys(E.states).join(', ')})`);
  const at = t !== undefined ? Math.min(1, Math.max(0, t)) : E.states[state ?? 'closed'];
  const F = anchor ? E.frame(anchor) : { ...DEFAULT_FRAME, fit };
  if (!F.fit && !params) throw new Error(`playscape: a ${entry} needs a fit ({ width, height }), an anchor or ejected params`);
  const frame = { at: F.at, N: F.N, U: F.U };
  const p = params || E.params(F.fit, variant), leaves = E.leaves(variant, p), BW = boxToWorld(frame), W = toWorld(frame);
  return {
    entry, variant, skin, t: at, ...(state ? { state } : {}), params: p, frame, interest: E.interest, drive: E.drive(),
    faces: E.build(variant, p, skin, at, frame),
    collider: collider(leaves, at).map(BW),
    sweep: sweep(leaves).map(BW),
    clearance: clearance(leaves, p, at),
    usePoints: E.usePoints(variant, p).map((u) => ({ ...u, at: W(u.at) })),
  };
}

/** Freeze a resolved object: its variant, skin and numbers, so it no longer follows its opening. */
export function ejectObject(o) {
  return { kind: 'game-object', entry: o.entry, variant: o.variant, skin: o.skin, params: structuredClone(o.params), ejected: true };
}
