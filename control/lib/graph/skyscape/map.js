/**
 * WHAT A MAP IS, for a pilot. A walker's level ends at a kit's cliff a few hundred metres off; a pilot climbs until the
 * whole level is a postage stamp and the horizon is a hundred kilometres away. Mojulo does not build a globe for that:
 * a map is a field the game happens in and rings round it, each with its own detail contract, and a sky that hides the
 * last ring's edge:
 *
 *   field      where the course or the mission is: flown through, landed on, ground at scapeshift detail
 *   reach      the flyable bound: the field plus room to turn back at top speed (the turn circle twice, and the warning
 *              time flown straight); past it the craft is warned, then turned back
 *   backdrop   the land past the reach, only ever seen: relief that closes the view (the sea round an island, the wall
 *              of a basin, a canyon's walls, a plain under the haze), out to the quadtree's root
 *   horizon    the sky: its horizon band the haze's hue, no geometry
 *
 * The cheat that makes it hold: the haze (the World page's FogExp2, thinned with height by the terrain channel as
 * hazeHeight / (hazeHeight + alt)) is opaque before the root's edge from anywhere in the reach, at the ceiling. The
 * numbers that make it hold come from the pilot's eye (eye.js): the haze is clear enough at the low pass to see the
 * field across, thins to THIN times that at the ceiling, and the root is sized to hold what the ceiling sees.
 *
 *   MAP_FORMS, planMap({ form, field, craft, ceiling, seed, lands }), mapLaws(map)
 *
 * Space forms (void, trench, limb) are a later step; a globe (the terrain channel's planet) is not a form.
 * Pure, deterministic.
 */
import { pilotEye, craftOf } from './eye.js';
import * as dmath from '../../util/dmath.js';

/** Fog factor where the haze is taken as opaque (FogExp2: 1 − e^−(ρd)²). */
export const OPAQUE = 0.98;
const OPAQUE_RD = Math.sqrt(-Math.log(1 - OPAQUE));   // ρ·d at OPAQUE: 1.978
/** How much further the eye sees through the haze at the ceiling than at the low pass. */
export const THIN = 4;
/** s the craft flies straight past the reach's warning before it is turned (time to notice and turn yourself). */
export const WARN_S = 5;
/** s of cruise the low pass sees at least (beyond the field's own width): visibility in seconds, not metres. */
export const SEE_S = 40;
/** The baked grid's cells at most a side (the page carries three bytes a cell, base64), and its finest cell (m). */
export const GRID = Object.freeze({ maxN: 256, minCell: 8 });
/** A field when none is asked: this many seconds of the craft's cruise across, and never smaller than this (m). */
export const FIELD_S = 40, FIELD_MIN = 4000;

/**
 * Each form's backdrop, shares of the ceiling: `base` where the land settles past the reach, `amp` its swell, `wall`
 * the rise the reach's own ring climbs to (0 for none), `sea` whether water lies at the datum, `axis` a canyon's.
 */
export const MAP_FORMS = Object.freeze({
  island: { label: 'an island in a sea to the horizon', sea: true, base: -0.02, amp: 0.004, wall: 0, axis: null },
  basin: { label: 'a valley ringed by mountains', sea: false, base: 0.45, amp: 0.08, wall: 0.45, axis: null },
  canyon: { label: 'a corridor between walls, open at its ends to the haze', sea: false, base: 0.05, amp: 0.02, wall: 0.35, axis: 'x' },
  plain: { label: 'a plain that runs into the haze', sea: false, base: 0, amp: 0.01, wall: 0, axis: null },
});
/** The ceiling a form flies to when none is asked: a share of the craft's service ceiling, at most this (m). */
const CEILING_CAP = 3000;

const r2 = (v) => Math.round(v * 100) / 100;
const pow2Ceil = (x) => { let p = 1; while (p < x) p *= 2; return p; };

/** Errors (strings) for a map ask; [] when it plans. */
export function validateMap(m = {}) {
  const e = [];
  if (m.form !== undefined && !MAP_FORMS[m.form]) e.push(`map.form must be one of ${Object.keys(MAP_FORMS).join(', ')}`);
  const f = m.field;
  if (f !== undefined && !(Number.isFinite(f) && f >= 500 && f <= 40000) && !(Array.isArray(f) && f.length === 2 && f.every((v) => Number.isFinite(v) && v >= 500 && v <= 40000))) e.push('map.field must be metres 500–40000, or [width, depth]: the box the course or mission fits in');
  if (m.ceiling !== undefined && !(Number.isFinite(m.ceiling) && m.ceiling >= 100 && m.ceiling <= 20000)) e.push('map.ceiling must be metres 100–20000 (the highest the craft may climb in play)');
  if (m.craft !== undefined) { try { craftOf(m.craft); } catch (err) { e.push(err.message); } }
  return e;
}

/**
 * Plan a map. `field` m (a square side, or [w, d]); `craft` a class or envelope; `ceiling` m (a form's default from
 * the craft); `lands` (the craft lands in play). → { form, craft, ceiling, rings, haze, backdrop, grid, lod, eye }.
 * Every ring is a half-extent box about the origin, in metres: { hx, hy }.
 */
export function planMap({ form = 'island', field: fieldAsk, craft = 'trainer', ceiling, lands = true, seed = 1 } = {}) {
  const errs = validateMap({ form, field: fieldAsk, craft, ceiling }); if (errs.length) throw new Error(`map: ${errs.join('; ')}`);
  const F = MAP_FORMS[form], eye = pilotEye(craft, { lands }), c = eye.craft;
  // the field when none is asked: FIELD_S of cruise across (a jet's is wider than a glider's), never under FIELD_MIN
  const field = fieldAsk ?? Math.max(FIELD_MIN, Math.round(c.cruise * FIELD_S / 100) * 100);
  const top = r2(ceiling ?? Math.min(c.ceiling * 0.75, CEILING_CAP));
  const [fw, fd] = Array.isArray(field) ? field : [field, field];
  const fieldBox = { hx: fw / 2, hy: fd / 2 };
  // room to turn back at top speed: the warning flown straight, then the turn circle's diameter
  const margin = r2(c.max * WARN_S + 2 * eye.turn.max);
  const reach = { hx: r2(fieldBox.hx + margin), hy: r2(fieldBox.hy + margin) };
  // the haze: at the low pass the eye sees the field across (corner to corner) or SEE_S of cruise, whichever is more;
  // at the ceiling THIN times that. hazeHeight H solves (H + top) / (H + low) = THIN
  const low = c.lowPass, seeLow = Math.max(dmath.hypot(fw, fd), c.cruise * SEE_S);
  const H = r2(Math.max(50, (top - THIN * low) / (THIN - 1)));
  // ρ at the datum, so ρ(low) · seeLow = OPAQUE_RD, kept to six figures (the page carries it so); seeLow is padded by
  // 1e-5, more than that rounding moves it, so the field stays in the clear whichever way the sixth figure goes
  const density0 = Number((OPAQUE_RD * (H + low) / (H * seeLow * (1 + 1e-5))).toPrecision(6));
  const seeAt = (alt) => OPAQUE_RD * (H + alt) / (density0 * H);
  const seeTop = r2(seeAt(top));
  // the root: from the reach's corner at the ceiling, the haze closes before the root's edge (in both axes)
  const need = Math.max(reach.hx, reach.hy) + seeTop;
  const root = pow2Ceil(2 * need / eye.lod.minSize) * eye.lod.minSize;   // a whole number of leaves: leaves stay minSize
  // the backdrop past the reach, in metres
  const backdrop = { sea: F.sea, base: r2(F.base * top), amp: r2(F.amp * top), wall: r2(F.wall * top), axis: F.axis, fall: r2(Math.max(margin, seeLow / 2)) };
  // the baked grid: the reach and a band of backdrop (where a wall rises), its cell from the eye where it is flown low,
  // coarsened to fit; the kernel's own octaves carry the detail below a cell
  const gx = 2 * (reach.hx + (F.wall ? backdrop.fall : 0)), gy = 2 * (reach.hy + (F.wall ? backdrop.fall : 0));
  const cell = Math.ceil(100 * Math.max(GRID.minCell, eye.spacing.lowPass * 2, Math.max(gx, gy) / GRID.maxN)) / 100;   // up to the cm: never a row past maxN
  const grid = { cell, nx: Math.ceil(gx / cell) + 1, ny: Math.ceil(gy / cell) + 1, hx: r2(gx / 2), hy: r2(gy / 2) };
  return {
    form, label: F.label, seed, craft: c, ceiling: top,
    rings: { field: fieldBox, reach, root: { hx: root / 2, hy: root / 2 } },
    haze: { hazeHeight: H, density: density0, see: { lowPass: r2(seeAt(low)), ceiling: seeTop } },
    backdrop, grid,
    lod: { n: eye.lod.n, split: eye.lod.split, minSize: eye.lod.minSize, horizonScale: r2(root / Math.max(gx, gy)), root },
    eye: { spacing: eye.spacing, gaze: eye.gaze, turn: eye.turn, chunksPerFrame: eye.lod.chunksPerFrame, rings: eye.rings },
  };
}

/** The visibility (m, to opaque) at a height, for a planned map's haze. */
export function seeAt(map, alt) {
  const { hazeHeight: H, density } = map.haze;
  return OPAQUE_RD * (H + alt) / (density * H);
}

/**
 * The map's laws, advising: [{ law, ok, note }]. Read on the plan (P1); the ground's own (P2) join them.
 *   edge-unseen      from the reach's corner at the ceiling, the haze is opaque before the root's edge
 *   field-seen       from the field's edge at the low pass, the far side of the field is in the clear
 *   turn-room        the reach holds the warning flown straight and a turn back at top speed
 *   ceiling-flyable  the ceiling is under the craft's service ceiling and well over its low pass
 *   keeps-up         the ground builds under a frame's share of chunks down low at top speed
 */
export function mapLaws(map) {
  const { rings, ceiling, craft } = map;
  const corner = Math.max(rings.reach.hx, rings.reach.hy), edge = rings.root.hx;
  const fieldAcross = dmath.hypot(2 * rings.field.hx, 2 * rings.field.hy);
  const margin = Math.min(rings.reach.hx - rings.field.hx, rings.reach.hy - rings.field.hy);
  const need = craft.max * WARN_S + 2 * map.eye.turn.max;
  return [
    { law: 'edge-unseen', ok: corner + seeAt(map, ceiling) <= edge + 1e-6, note: `from the reach at ${ceiling} m the haze closes ${r2(seeAt(map, ceiling))} m out; the root's edge is ${r2(edge - corner)} m past the reach` },
    { law: 'field-seen', ok: seeAt(map, craft.lowPass) >= fieldAcross - 1e-6, note: `at the low pass the eye sees ${r2(seeAt(map, craft.lowPass))} m; the field is ${r2(fieldAcross)} m across` },
    { law: 'turn-room', ok: margin >= need - 1e-6, note: `${r2(margin)} m between the field and the reach's edge; turning back at ${craft.max} m/s needs ${r2(need)} m` },
    { law: 'ceiling-flyable', ok: ceiling <= craft.ceiling && ceiling >= 4 * craft.lowPass, note: `ceiling ${ceiling} m; the ${craft.label} flies to ${craft.ceiling} m, its low pass ${craft.lowPass} m` },
    { law: 'keeps-up', ok: map.eye.chunksPerFrame <= 4, note: `${map.eye.chunksPerFrame} chunks a frame down low at top speed` },
  ];
}
