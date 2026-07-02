/**
 * figure-animal-pelage — fur as ROUNDED, rearward-flowing strands along the body.
 *
 * Earlier tries hung FLAT tapered blades (triangles) off the skin's cross-section
 * rings — they read as angular spikes standing straight off the contour. This rounds
 * each strand out: like the mane lock, every strand is now a tapered ring-STACK (an
 * elliptical cross-section, wide-ish belly → sharp point) so it has volume and shades
 * / depth-sorts with the body instead of a single flat facet. And the comb no longer
 * spikes radially OUT — each strand leaves the skin with a little loft then arcs to
 * FLOW toward the rear (−y, the tail) and down with gravity, so the coat lies along
 * the body the way real fur lies, pointing toward the haunch.
 *
 * Pure 3D: returns render parts `{polylines, stroke}` (ring-stacks) in the parts' own
 * space; the renderer meshes/depth-sorts them in with the body faces (face normals are
 * taken outward from each ring centre, so winding is irrelevant). Soft↔rough is the
 * strand size / loft / spread / density.
 */
import { normalize3, sub3, cross3 } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len3 = (a) => Math.hypot(a.x, a.y, a.z);
const polyCenter = (poly) => { let x = 0, y = 0, z = 0; for (const p of poly) { x += p.x; y += p.y; z += p.z; } const n = poly.length || 1; return { x: x / n, y: y / n, z: z / n }; };
const ringR = (poly, c) => { let s = 0; for (const p of poly) s += Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z); return s / Math.max(1, poly.length); };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (k) => { let x = k >>> 0; x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };

// Sleek coat: short strands, low loft, lies hard toward the rear.
export const PELAGE_SOFT = {
  ringStep: 2, pointStep: 2,        // skirt station spacing / strands around the ring
  lenFrac: 0.7, widthFrac: 0.22, thickFrac: 0.7,   // strand length / half-width / half-thickness ÷ ring radius
  loft: 0.25, flow: 1.0, down: 0.5, curl: 0.12,    // comb: lift off skin / rearward / gravity / random side wisp
  tip: 0.04,                        // tip half-width fraction: ~0 = sharp point, ↑ = blunt soft lobe (cf. the mane)
  rear: { x: 0, y: -1, z: 0 },      // body-rear in STAND space (hips at −y)
  jitter: 0.3, seed: 7, color: '#c69772', N: 6, M: 7,
};
// Shaggy coat: longer strands, more loft, stands off the body more.
export const PELAGE_ROUGH = {
  ringStep: 3, pointStep: 3,
  lenFrac: 1.2, widthFrac: 0.30, thickFrac: 0.7,
  loft: 0.5, flow: 0.8, down: 0.4, curl: 0.3,
  tip: 0.04,
  rear: { x: 0, y: -1, z: 0 },
  jitter: 0.6, seed: 11, color: '#8f6038',
};

// belly-then-point taper profile (wide-ish near the root, taper toward the tip; `tip`
// sets bluntness — ~0 a sharp point, higher a rounded soft lobe like the mane lock).
const profile = (t, tip = 0.04) => (t < 0.2 ? 0.5 + 0.5 * (t / 0.2) : 1 - (1 - tip) * ((t - 0.2) / 0.8));

// Scale a #rrggbb toward black by k (k<1 darkens). Mirrors figure-garments' darkenHex.
export const darkenHex = (hex, k = 0.72) => {
  const n = parseInt(hex.slice(1), 16), ch = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
};

/**
 * The "wet paint underneath" hue for a coat: the fur's own colour, darkened into an
 * under-shade (or an explicit `cfg.under`), so the body repainted with it reads as
 * shadow beneath the strands and the skin tone never shows through the gaps.
 */
export const coatUnderHex = (cfg = {}) => {
  const base = cfg.rough ? PELAGE_ROUGH : PELAGE_SOFT;
  const c = { ...base, ...cfg };
  return c.under ?? darkenHex(c.color, c.underK ?? 0.72);
};

// The coat's resolved fur (strand) colour — for matching ears / head skin to the coat.
export const coatHex = (cfg = {}) => ({ ...(cfg.rough ? PELAGE_ROUGH : PELAGE_SOFT), ...cfg }.color);

/**
 * One rounded, rearward-flowing strand as a tapered ring-stack.
 * @param {{x,y,z}} root   point on the skin surface
 * @param {{x,y,z}} n      outward surface normal at the root
 * @param {{x,y,z}} side   along-the-ring direction (sets the width plane)
 * @param {{x,y,z}} flow   rearward+down comb direction (already normalized)
 * @param {number}  L      strand length
 * @param {object}  c      tuning
 * @param {number}  seed
 */
function furStrand(root, n, side, flow, L, c, seed) {
  // quadratic arc: leaves the skin with a little outward loft, then flows to the rear.
  const wisp = (rnd(seed) - 0.5) * 2 * c.curl;                 // small random side wisp
  const P0 = root;
  const P2 = add(add(root, mul(flow, L)), mul(side, wisp * L));
  const P1 = add(add(root, mul(n, c.loft * L)), mul(flow, L * 0.4));
  const bez = (t) => add(add(mul(P0, (1 - t) * (1 - t)), mul(P1, 2 * (1 - t) * t)), mul(P2, t * t));
  const tan = (t) => add(mul(sub3(P1, P0), 2 * (1 - t)), mul(sub3(P2, P1), 2 * t));
  const rings = [];
  for (let i = 0; i < c.N; i++) {
    const t = i / (c.N - 1);
    const ctr = bez(t);
    let axis = tan(t); axis = len3(axis) > 1e-6 ? normalize3(axis) : flow;
    // width runs along the ring; keep it perpendicular to the strand axis
    let fan = sub3(side, mul(axis, dot(side, axis)));
    if (len3(fan) < 1e-6) fan = cross3(axis, n);
    fan = normalize3(fan);
    const thin = normalize3(cross3(axis, fan));
    const p = profile(t, c.tip), hw = c.widthFrac * p, ht = c.widthFrac * c.thickFrac * p, poly = [];
    for (let j = 0; j <= c.M; j++) {
      const a = (j / c.M) * Math.PI * 2;
      poly.push(add(ctr, add(mul(fan, hw * Math.cos(a)), mul(thin, ht * Math.sin(a)))));
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: c.color };
}

/**
 * Build the coat over a figure's render parts (world or STAND — same space is
 * returned). At stations down each body part we read the cross-section ring and grow a
 * fringe of rounded strands off it, combed toward the rear so they shingle into a coat.
 * @param {{polylines:{x,y,z}[][]}[]} parts
 * @returns {{polylines:{x,y,z}[][], stroke:string}[]}
 */
export function coatBlades(parts, cfg = {}) {
  const base = cfg.rough ? PELAGE_ROUGH : PELAGE_SOFT;
  const c = { ...base, ...cfg };
  const down = { x: 0, y: 0, z: -1 };
  const rear = normalize3(c.rear);
  const strands = [];
  for (const part of parts) {
    const rings = part.polylines; if (!rings || rings.length < 2) continue;
    for (let i = 0; i < rings.length; i += c.ringStep) {
      const ring = rings[i]; if (ring.length < 3) continue;
      const ctr = polyCenter(ring), rr = ringR(ring, ctr);
      if (rr < 1e-6) continue;
      // width/length are scaled to this ring's radius so the coat reads at any girth.
      const cc = { ...c, widthFrac: c.widthFrac * rr, thickFrac: c.thickFrac };
      for (let j = 0; j < ring.length - 1; j += c.pointStep) {
        const p = ring[j];
        if (c.mask && !c.mask(p)) continue;                       // skip masked regions (e.g. a bare snout)
        const n = normalize3(sub3(p, ctr));                       // outward surface normal
        const flow = normalize3(add(add(mul(n, c.loft), mul(rear, c.flow)), mul(down, c.down)));
        const side = normalize3(sub3(ring[(j + 1) % ring.length], p));
        const seed = hash(`${c.seed}:${i}:${j}`);
        const L = rr * c.lenFrac * (1 - c.jitter * 0.5 + c.jitter * rnd(seed));
        strands.push(furStrand(p, n, side, flow, L, cc, seed));
      }
    }
  }
  return strands;
}
