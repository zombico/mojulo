// fabricator/mech-tables — the size tables the mechanical library already carries, read back out of its program text.
//
// The library (../scad/mech-lib.js) is the one place a bearing's bore or a motor's bolt square is written down; the
// fabricator sizes parts from the same rows instead of keeping a second copy that could drift. Each reader parses one
// OpenSCAD table literal and is pinned by a test against a row everyone knows (a 608 is 8 × 22 × 7).
import { MECH_LIB_SOURCE } from '../scad/mech-lib.js';

/** The literal of `NAME = [ … ];` in the library text. */
function block(name) {
  const at = MECH_LIB_SOURCE.indexOf(`${name} = [`);
  if (at < 0) throw new Error(`mech-tables: no ${name} in the mechanical library`);
  return MECH_LIB_SOURCE.slice(at, MECH_LIB_SOURCE.indexOf('];', at));
}

const rows = (name) => [...block(name).matchAll(/\[\s*("[^"]*"|[\d.]+)\s*,([^[\]]*)\]/g)]
  .map((m) => [m[1].replace(/"/g, ''), ...m[2].split(',').map((s) => s.trim()).map((s) => (/^"/.test(s) ? s.replace(/"/g, '') : +s))]);

/** Ball and linear bearings: code → { bore, od, width, linear }. */
export const BEARINGS = Object.freeze(Object.fromEntries(rows('MJ_BEARINGS').map(([code, bore, od, width]) =>
  [code, Object.freeze({ code, bore, od, width, linear: /^LM/.test(code) })])));

/** ISO metric sizes the library cuts, and the heat-set pilot each takes (0 = no insert that size). */
export const ISO_SIZES = Object.freeze(Object.fromEntries(rows('MJ_ISO').map((r) => [r[0], Object.freeze({ d: r[1], heatset: r[r.length - 1] })])));

/** NEMA stepper frames: n → { face, boltSquare, pilot, screw, shaft }. */
export const NEMA = Object.freeze(Object.fromEntries(rows('MJ_NEMA').map(([n, face, boltSquare, pilot, , screw, shaft]) =>
  [+n, Object.freeze({ n: +n, face, boltSquare, pilot, screw, shaft })])));

/** Boards the library has hole patterns for. */
export const BOARDS = Object.freeze([...block('MJ_BOARDS').matchAll(/\["([a-z0-9-]+)"/g)].map((m) => m[1]));

/** Is `name` a module or function the library defines? */
export const hasMech = (name) => new RegExp(`(module|function)\\s+${name}\\s*\\(`).test(MECH_LIB_SOURCE);
