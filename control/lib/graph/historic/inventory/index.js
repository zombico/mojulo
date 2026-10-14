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
import { HISTORIC_STYLES } from './styles.js';

/** The styles the inventory speaks, by id: the historic ones (./styles.js: each with its tradition record and the
 *  ledger rows it stands on), then the era library's own element sets (uncited: a fantasy town's). */
export const STYLES = Object.freeze({ ...HISTORIC_STYLES, ...ELEMENT_SETS });
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
 * A kit asset that speaks `style` as `use` on its slot's lot. `ring` (near | mid | far) is how much it says: the
 * openings and the fine at near, the masses and caps at far; a slot's own `ring`, else the scene's (the solver passes
 * near for a slice, mid for a town, far for a region), overrides it. A lot smaller than the
 * use needs is spoken at the use's least lot and drawn in to fit (the plan, never the height).
 */
export function inventoryAsset({ id, style, use, ring = 'mid', read = null, cites = [] }) {
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
      const lot = { w: Math.max(W, U.lot.w), d: Math.max(D, U.lot.d) }, sx = Math.min(1, W / lot.w), sy = Math.min(1, D / lot.d);
      const seed = 1 + Math.floor(rng() * 1e6);
      const b = speak(L, use, lot, craft, seed, { ring: slot?.ring ?? sceneRing ?? ring });
      let x0 = Infinity, x1 = -Infinity;
      for (const f of b.faces) for (const [x] of f.corners) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      const dx = W / 2 - ((x0 + x1) / 2) * sx;   // centred across its lot, its front on the lot's front
      return b.faces.map((f) => {
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
