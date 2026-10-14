/**
 * historic/inventory — buildings composed from an inventory of STYLES and STRUCTURES instead of drawn by hand.
 *
 * A style is a building language as data: an element set (era/out-anchor-elements.js ELEMENT_SETS shape): the wall
 * storey by storey and how it is laid, the cap (its form, pitch, eave, covering), the lights and their rhythm, the door,
 * the ornaments (socle, sills, lintels, quoins, frame, shutters, chimney…), with a composed citizen house. A structure
 * is a USE (era/out-structures.js STRUCTURE_USES: dwelling, shop, workshop, barn, hall, tower). The style spoken as a
 * use on a lot is a building (era/out-anchor-structure.js `speak`): its storeys from the need, its cap at the style's
 * pitch, its lights in the style's rhythm, each household varying inside what the street holds.
 *
 * `inventoryAsset({ id, style, use })` makes that building a historic KIT ASSET (../assets/kit.js contract): built in
 * its slot's frame, front −y, as lit panels (the `panel` solid) painted from the culture's palette. A culture's kit
 * holds inventory assets beside hand-built ones; the solver lays them like any house.
 *
 * Painting: era buildings are VALUES on SURFACE GROUPS (plaster at 0.88, tile at 0.5, an opening at 0.04), never
 * colours. Each group takes its colour from the culture's palette (GROUP_PALETTE: the first key the palette has, else a
 * neutral default), and a face's value moves it lighter or darker about the style's own value for that group, so a
 * socle reads darker than its wall and a household's wall a shade off its neighbour's.
 *
 * Pure; seeded dice only.
 */
import { decompileAnchor, speak } from '../../era/out-anchor-structure.js';
import { structureStyle, STRUCTURE_USES, STRUCTURE_USE_IDS, STRUCTURE_RING_IDS } from '../../era/out-structures.js';
import { ELEMENT_SETS } from '../../era/out-anchor-elements.js';
import { scaleHex } from '../../polygonizer/vexar.js';
import { INVENTORY_STYLES } from './styles.js';
import { SACRED } from '../../landmarks/refacade-sacred.js';

/** The styles the inventory speaks, by id: the historic ones (./styles.js: each with its tradition record and the
 *  ledger rows it stands on), then the era library's own element sets (uncited: a fantasy town's). */
export const STYLES = Object.freeze({ ...INVENTORY_STYLES, ...ELEMENT_SETS });
export const STYLE_IDS = Object.freeze(Object.keys(STYLES));
export const USE_IDS = STRUCTURE_USE_IDS;

/** Each surface group's palette keys, the first the culture's palette has, and its colour when it has none. */
export const GROUP_PALETTE = Object.freeze({
  'str:plaster': { keys: ['plaster', 'wall'], hex: '#d6cbb2' },
  'str:stone': { keys: ['stone', 'wall'], hex: '#9b9285' },
  'str:timber': { keys: ['timber', 'wood'], hex: '#5b4332' },
  'str:thatch': { keys: ['thatch', 'roof'], hex: '#a38c5a' },
  'str:tile': { keys: ['tile', 'roof'], hex: '#a3553b' },
  'str:shingle': { keys: ['shingle', 'roof'], hex: '#6d5a48' },
  'str:slate': { keys: ['slate', 'roof'], hex: '#4f545b' },
  'str:opening': { keys: ['opening'], hex: '#1f1b18' },
  'str:paint': { keys: ['paint', 'accent'], hex: '#5d6f58' },
  'str:accent': { keys: ['accent', 'paint'], hex: '#9c3b2a' },
  'str:shell': { keys: ['wall'], hex: '#d9d2c2' },
  'str:lens': { keys: ['opening'], hex: '#33404a' },
  'str:motif': { keys: ['wall'], hex: '#c9bfa8' },
});
/** A terraced house's setbacks: none at the sides (party walls), on the street line, a yard behind. */
const TERRACE = Object.freeze({ side: 0, front: 0, rear: 1.5 });
/** How far a face's value moves its colour from its group's (value − the style's value for the group, × this). */
const VALUE_SWING = 0.8;

const languages = new Map();
/** A style's language (decompiled once), and its value for each surface group (the first its elements give). */
export function languageOf(style) {
  if (languages.has(style)) return languages.get(style);
  const set = typeof style === 'string' ? STYLES[style] : style;
  if (!set) throw new Error(`inventory: '${style}' is not a style (${STYLE_IDS.join(', ')})`);
  const L = decompileAnchor(set, typeof style === 'string' ? style : set.id ?? 'style'), nominal = {};
  const note = (g, v) => { if (g && typeof v === 'number' && nominal[g] === undefined) nominal[g] = v; };
  for (const el of Object.values(set.elements ?? {})) { for (const s of el.storeys ?? []) note(s.group, s.value); note(el.group, el.value); }
  const out = { L, nominal };
  if (typeof style === 'string') languages.set(style, out);
  return out;
}

/** A face's colour: its group's from the palette, moved by its value about the style's. */
export function paintFace(palette, nominal, group, value) {
  const G = GROUP_PALETTE[group] ?? GROUP_PALETTE['str:stone'], key = G.keys.find((k) => typeof palette?.[k] === 'string');
  const base = key ? palette[key] : G.hex, at = nominal[group] ?? value;
  return Math.abs(value - at) < 1e-9 ? base : scaleHex(base, Math.max(0.4, 1 + VALUE_SWING * (value - at)));
}

/**
 * A kit asset that speaks `style` as `use` on its slot's lot (`crown`: a landmark's height, m, that it dares up to,
 * taller storeys and a steeper cap, as a town hall's tower does over the street; `terrace`: a town house in a row,
 * wall to wall with its neighbours on the street line, drawn out to its lot's frontage; `storeys` [lo, hi]: the
 * storeys a house rises to, as its record's house type gives them). `ring` (near | mid | far) is how much it says: the
 * openings and the fine at near, the masses and caps at far; a slot's own `ring`, else the scene's (the solver passes
 * near for a slice, mid for a town, far for a region), overrides it. A lot smaller than the
 * use needs is spoken at the use's least lot and drawn in to fit (the plan, never the height).
 */
export function inventoryAsset({ id, style, use, ring = 'mid', read = null, cites = [], crown = 0, terrace = false, storeys = null }) {
  const U = STRUCTURE_USES[use];
  if (!U) throw new Error(`inventory: '${use}' is not a use (${USE_IDS.join(', ')})`);
  if (!STRUCTURE_RING_IDS.includes(ring)) throw new Error(`inventory: '${ring}' is not a ring (${STRUCTURE_RING_IDS.join(', ')})`);
  const { L, nominal } = languageOf(style), craft = structureStyle('isekai-meadow', 1);
  return {
    id, sheet: 'inventory', designed: true, patterns: [], inventory: { style: typeof style === 'string' ? style : L.id, use }, cites,
    envelope: { w: [U.lot.w, U.lot.w * 2.4], d: [U.lot.d, U.lot.d * 1.8] },
    read: read ?? `a ${use} in the ${L.id} style: ${L.read ?? ''}`.trim(),
    notes: 'spoken from the inventory (era/ speak), painted from the culture\'s palette',
    build({ W, D, slot }, { palette, rng, ring: sceneRing }) {
      const lot = { w: Math.max(W, U.lot.w), d: Math.max(D, U.lot.d) }, sy = Math.min(1, D / lot.d);
      let sx = Math.min(1, W / lot.w);
      const seed = 1 + Math.floor(rng() * 1e6);
      const at = slot?.ring ?? sceneRing ?? ring;
      const b = speak(L, use, lot, craft, seed, { ring: at, ...(crown ? { crown, accent: true } : {}), ...(terrace ? { over: TERRACE } : {}), ...(storeys ? { band: storeys } : {}) });
      // seen close, the marks in a wall's face (its bond) are drawn too; a roof's courses stay the roof's colour
      const faces = at === 'near' ? [...b.faces, ...b.tile.filter((f) => f.part !== 'course')] : b.faces;
      let x0 = Infinity, x1 = -Infinity;
      for (const f of b.faces) for (const [x] of f.corners) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      // a terraced house fills its frontage wall to wall: drawn out across its lot (never more than half again)
      if (terrace && x1 - x0 < W) sx = Math.min(W / (x1 - x0), 1.5) * Math.min(1, W / lot.w);
      const dx = W / 2 - ((x0 + x1) / 2) * sx;   // centred across its lot, its front on the lot's front
      return faces.map((f) => {
        const pts = f.corners.map(([x, y, z]) => [x * sx + dx, y * sy, z]);
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
        const bx = Math.min(...xs), by = Math.min(...ys);
        return {
          kind: `inv-${f.part}`, solid: 'panel', pts, out: f.normal, tint: paintFace(palette, nominal, f.group, f.value), skin: null,
          x: bx, y: by, w: Math.max(...xs) - bx, d: Math.max(...ys) - by, z0: Math.min(...zs), z1: Math.max(...zs),
        };
      });
    },
  };
}

/** A kit of inventory assets: `{ <asset id>: { style, use, ring? } }` → `{ <asset id>: asset }`. */
export function inventoryKit(spec) {
  return Object.fromEntries(Object.entries(spec).map(([id, s]) => [id, inventoryAsset({ id, ...s })]));
}

// ── structures from the landmark library ──────────────────────────────────────────────────────────────────────────
/** The landmark builders the inventory takes, each `(box, ctx) → faces` in a lot's local frame (../../landmarks/). */
export const LANDMARKS = Object.freeze({
  basilica: { read: 'a Gothic church: a tall nave over aisles, towers at its entrance front, a pointed choir', build: SACRED.church, box: { churchVariant: 'basilica' } },
  chapel: { read: 'a steepled parish church: a nave under one roof, a tower at its entrance front', build: SACRED.church, box: { churchVariant: 'chapel' } },
});
const FLAT = Object.freeze({ ambient: 1, diffuse: 0, toLight: [0, 0, 1] });   // no light: the builder's fills are its colours
const unclip = (f) => {
  // a triangle drawn as a quad clipped to it (the landmark kit's way): its third corner from the clip
  const m = /polygon\(0% 0%, 100% 0%, (-?[\d.]+)% 100%\)/.exec(f.clip ?? '');
  if (!m) return f.corners;
  const [A, B, , D] = f.corners, t = Number(m[1]) / 100;
  return [A, B, [D[0] + (B[0] - A[0]) * t, D[1] + (B[1] - A[1]) * t, D[2] + (B[2] - A[2]) * t]];
};

/**
 * A kit asset that builds a landmark (`builder`, LANDMARKS) on its slot's lot, its entrance on the front: `height` its
 * full height (a tower's top), `paint(palette)` its colours from the culture's palette (the builder's own where it
 * gives none). Built unlit, as panels the scene lights like every other mass.
 */
export function landmarkAsset({ id, builder, height, paint = () => ({}), read = null, cites = [] }) {
  const B = LANDMARKS[builder];
  if (!B) throw new Error(`inventory: '${builder}' is not a landmark (${Object.keys(LANDMARKS).join(', ')})`);
  return {
    id, sheet: 'inventory', designed: true, patterns: [], inventory: { landmark: builder }, cites,
    envelope: { w: [12, 60], d: [20, 120] },
    read: read ?? B.read, notes: 'built by the landmark library, painted from the culture\'s palette',
    build({ W, D }, { palette }) {
      // the long side runs from the front (the builder's entrance end); a plate seen from both sides faces the street
      const box = { x: 0, y: 0, w: W, d: D, z0: 0, z1: height, ...B.box, churchPalette: paint(palette ?? {}) };
      const faces = B.build(box, { L: FLAT, camHint: [W / 2, -4 * D, height] });
      return faces.map((f) => {
        const pts = unclip(f), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), zs = pts.map((p) => p[2]);
        const bx = Math.min(...xs), by = Math.min(...ys);
        return { kind: 'landmark', solid: 'panel', pts, out: f.outNormal, tint: f.fill, skin: null, x: bx, y: by, w: Math.max(...xs) - bx, d: Math.max(...ys) - by, z0: Math.min(...zs), z1: Math.max(...zs) };
      });
    },
  };
}
