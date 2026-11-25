/**
 * THE HANGAR'S WORD IN THE SAVE — the build a player chose in the garage, kept in the game's store as a `flags` slice
 * (game/store-kernel.js: a flag holds a string), one flag a slot: `frame.<slot>` its part's id, `-` where the slot is
 * left empty (a weapon slot, or the head a headless core takes none of). A frame level consumes the slice and the page
 * stands the build (kernel.js); the hangar writes it (setFlag events) as the player goes out.
 *
 *   HANGAR_SLICE              the slice's name in a game's store
 *   buildOfFlags(flags)       → the build the flags say ({ <slot>: id | null } over every slot they name), or null where
 *                               they name none; a part no table has is left to the stock's (said by readBuild, never here)
 *   flagsOfBuild(build)       → the setFlag events that keep a build: [{ type, slice, key, value }], every slot's
 *
 * Pure: the same flags, the same build.
 */
import { SLOTS, WEAPON_SLOTS, tableOf } from './parts.js';

export const HANGAR_SLICE = 'hangar';
const KEY = 'frame.', NONE = '-';
const EVERY = Object.freeze([...SLOTS, ...WEAPON_SLOTS]);

export function buildOfFlags(flags) {
  const F = flags && typeof flags === 'object' ? (flags.flags && typeof flags.flags === 'object' ? flags.flags : flags) : null;
  if (!F) return null;
  const B = {};
  for (const s of EVERY) {
    const v = F[KEY + s];
    if (typeof v !== 'string') continue;
    if (v === NONE) { if (s === 'head' || WEAPON_SLOTS.includes(s)) B[s] = null; continue; }
    if (tableOf(s)[v]) B[s] = v;
  }
  return Object.keys(B).length ? B : null;
}

export function flagsOfBuild(build) {
  return EVERY.filter((s) => build[s] !== undefined).map((s) => ({ type: 'setFlag', slice: HANGAR_SLICE, key: KEY + s, value: build[s] === null ? NONE : String(build[s]) }));
}

