// construction/elements — the parts a house is finished with, as elements: linings, insulation, infill, boxes, cable
// runs. An element is an axis-aligned box in the house's unit (feet), a catalog material, an IFC class, the storey it
// is on, and a stable id; it draws as the faces of its box (the sides a recipe does not hide), and the building model
// (bim.js) reads the same record. Walls in a floorplan house are axis-aligned, and so is everything laid on them.
//
// Element: { key, ifc, type?, material, storey, lo: [x,y,z], hi: [x,y,z], sides?, rgb?, sideRgb?: { '+y': rgb, … },
//            alpha?, texture?, uvM?: metres a texture tile spans, minPx?: draw at least this many pixels thick,
//            quantities?, host?, props? }
import { shadeHexMat, DEFAULT_LIGHT } from '../polygonizer/vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from '../polygonizer/materials.js';
import { rgbHex } from './timber.js';
import { CATALOG } from './catalog.js';
import * as dmath from '../../util/dmath.js';

const SHADING = { board: 'plaster', plaster: 'plaster', clay: 'matte', insulation: 'matte', paper: 'matte', timber: 'wood', bamboo: 'wood', block: 'stone', cable: 'matte', raceway: 'matte', box: 'matte', plate: 'matte', panel: 'steel', steel: 'steel' };
const SIDES = ['+x', '-x', '+y', '-y', '+z', '-z'];

function mix(n) { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; }
function hashStr(s, salt) { let h = salt | 0; for (let i = 0; i < s.length; i++) h = mix((h + Math.imul(s.charCodeAt(i), 0x9e3779b1)) | 0); return h; }
const IFC64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
/**
 * A stable 22-character IFC GlobalId for a key: 128 bits of the key's hash in IFC's base-64 (the first character
 * carries two bits). The same key always yields the same id, so a regenerated house keeps its element ids.
 */
export function ifcGuid(key) {
  const w = [hashStr(key, 1), hashStr(key, 2), hashStr(key, 3), hashStr(key, 4)];
  let n = 0n; for (const x of w) n = (n << 32n) | BigInt(x >>> 0);
  let out = ''; for (let i = 0; i < 22; i++) { out = IFC64[Number(n & 63n)] + out; n >>= 6n; }
  return out;
}

/** An element's colour: its own, or its material's. */
const rgbOf = (el) => el.rgb || (CATALOG[el.material] && CATALOG[el.material].rgb) || [200, 200, 200];

/**
 * The faces of elements (feet), lit. `eyes` ([{ pos (m), focalPx }]) let an element with `minPx` be drawn at least
 * that many pixels thick from the nearest eye (a cable reads as a line at any distance; its report keeps its size).
 * Each face's group is the element's key, so identical elements instance (instancing.js).
 */
export function elementFaces(elements, { light = DEFAULT_LIGHT, eyes = null, unit = 0.3048 } = {}) {
  const faces = [];
  const mats = new Map();
  const matOf = (el) => { const k = SHADING[(CATALOG[el.material] || {}).kind] || 'matte'; if (!mats.has(k)) mats.set(k, resolveMaterial(k)); return mats.get(k); };
  for (const el of elements) {
    let lo = el.lo, hi = el.hi;
    if (el.minPx && eyes && eyes.length) {
      // thicken the two thin axes about the centre until the element spans minPx from its nearest eye
      const c = lo.map((v, i) => (v + hi[i]) / 2);
      let near = Infinity; for (const e of eyes) near = Math.min(near, dmath.hypot(c[0] * unit - e.pos[0], c[1] * unit - e.pos[1], c[2] * unit - e.pos[2]) / (e.focalPx || 1000));
      const want = (el.minPx * near) / unit;
      const d = hi.map((v, i) => v - lo[i]); const long = d.indexOf(Math.max(...d));
      lo = lo.slice(); hi = hi.slice();
      for (let i = 0; i < 3; i++) if (i !== long && d[i] < want) { lo[i] = c[i] - want / 2; hi[i] = c[i] + want / 2; }
    }
    const mat = matOf(el);
    const sides = el.sides || SIDES;
    // an element names its texture, or draws with its material's map when the catalog gives one
    const map = !el.texture && CATALOG[el.material] && CATALOG[el.material].map && CATALOG[el.material].map.texture ? CATALOG[el.material].map : null;
    const texture = el.texture || (map && map.texture), uvM = el.uvM || (map && map.tileM);
    for (const side of sides) {
      const k = 'xyz'.indexOf(side[1]); const s = side[0] === '+' ? 1 : -1;
      const at = s > 0 ? hi[k] : lo[k];
      const [a, b] = [0, 1, 2].filter((i) => i !== k);
      const P = (u, v) => { const p = [0, 0, 0]; p[k] = at; p[a] = u; p[b] = v; return p; };
      const corners = [P(lo[a], lo[b]), P(hi[a], lo[b]), P(hi[a], hi[b]), P(lo[a], hi[b])];
      const n = [0, 0, 0]; n[k] = s;
      const rgb = (el.sideRgb && el.sideRgb[side]) || rgbOf(el);
      const f = { corners, fill: shadeHexMat(texture ? '#ffffff' : rgbHex(rgb), n, mat, { light }), doubleSided: true, outNormal: n, group: el.key };
      if (texture && (!el.textureSides || el.textureSides.includes(side))) {
        const m = (uvM || 1) / unit;
        Object.assign(f, { texture, uv: corners.map((p) => [p[a] / m, p[b] / m]), textureLit: true });
      } else if (texture) f.fill = shadeHexMat(rgbHex(rgb), n, mat, { light });
      if (el.alpha) f.alpha = el.alpha;
      tagFacesWithMaterial([f], mat);
      faces.push(f);
    }
  }
  return faces;
}

// ── plan geometry ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Rectangles [a0, a1, b0, b1] less every hole (the same form) → rectangles. */
export function rectMinus(rects, holes) {
  let out = rects;
  for (const [h0, h1, k0, k1] of holes) {
    out = out.flatMap(([p, q, r, s]) => {
      if (h1 <= p || h0 >= q || k1 <= r || k0 >= s) return [[p, q, r, s]];
      return [[p, Math.max(p, h0), r, s], [Math.min(q, h1), q, r, s], [Math.max(p, h0), Math.min(q, h1), r, Math.max(r, k0)], [Math.max(p, h0), Math.min(q, h1), Math.min(s, k1), s]];
    }).filter(([p, q, r, s]) => q - p > 0.02 && s - r > 0.02);
  }
  return out;
}

/** A run-aligned box: `s` along the run [s0, s1], `off` across it (its centre, ±t/2), z [z0, z1] → { lo, hi }. */
export function runBox(run, s0, s1, off, t, z0, z1) {
  const c0 = run.at + off - t / 2, c1 = run.at + off + t / 2;
  return run.orientation === 'h' ? { lo: [s0, c0, z0], hi: [s1, c1, z1] } : { lo: [c0, s0, z0], hi: [c1, s1, z1] };
}
/** The side (±) of a run a point lies on. */
export const acrossOf = (run) => (run.orientation === 'h' ? 1 : 0);
