// The round street kit (elements.roundKit): the city's poles, heads, lenses, bins and bollards drawn round instead of
// as blocks. Two halves, both pure:
//   - roundStreetKit(boxes, { profile }) — the planner's post-pass. Each kit box keeps its kind, footprint, heights
//     and tint (tenancy, the LOD table, the census, lampSources and the tile split read the same numbers) and gains a
//     `kit-*` shape by its ROLE in the piece: a pole stands on z0 = 0, a head is the warm tint, an arm is elongated.
//     Profile materials ride along as `metal` (the metal-surface spec) on the parts a real kit makes of metal.
//   - roundKitFaces(b, L) — the assembler's realizer. Lathe rings about the box's own axis, inscribed in its
//     footprint, single-sided with outward winding (cityBox's convention: the back half culls), lit by the true
//     normal (so a template instances anywhere); round caps are `radius: '50%'` faces, not clip-path fans: a true
//     circle on the CSS page, and in the mesh an n-gon that meets its ring corner for corner (`radiusSeg`). Every
//     ring's n is a multiple of 4 so the two agree.
// Stylized, not measured: the proportions are the city's own, rounded. No rng, no Date.
import { litFactor, scaleHex } from '../polygonizer/vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from '../polygonizer/materials.js';

// ---------- the post-pass ----------

const WARM = new Set(['#f0d982', '#f2d18a']);   // the lamp heads (lampSources reads these tints)
const METAL = {
  standard: { metal: 'aluminium', finish: 'brushed' },   // a modern lamp standard and its arm
  housing: { metal: 'aluminium', finish: 'blasted' },    // a luminaire's cast housing
  galvanized: { metal: 'zinc', finish: 'spangle' },      // sign posts, metro signal poles
  stainless: { metal: 'stainless', finish: 'brushed' },  // metro bollards
};
const BUILDING_KINDS = new Set(['building', 'anchor', 'midtower']);
const onGround = (b) => Math.abs(b.z0 || 0) < 1e-9;
const elongated = (b) => Math.max(b.w, b.d) >= 2.5 * Math.min(b.w, b.d);

// the kit piece a box is, by kind and role; null keeps the box (a sign blade, a signal housing, a crossarm)
function kitRole(b, metro, canal) {
  switch (b.kind) {
    case 'street-lamp':
      if (WARM.has(b.tint)) return canal ? { shape: 'kit-lantern', hood: '#2d3033' } : { shape: 'kit-head', hood: '#555b62', ...(metro ? { metal: METAL.housing } : {}) };
      if (onGround(b)) return { shape: 'kit-pole', round: canal ? { taper: 0.78, collar: 1.9 } : { taper: 0.66, collar: 1.7 }, ...(metro ? { metal: METAL.standard } : {}) };
      if (elongated(b)) return { shape: 'kit-arm', ...(metro ? { metal: METAL.standard } : {}) };
      return { shape: 'kit-lantern-roof' };
    case 'freeway-lamp':
      if (WARM.has(b.tint)) return { shape: 'kit-head', hood: '#3a3d42', ...(metro ? { metal: METAL.housing } : {}) };
      return { shape: 'kit-pole', round: { taper: 0.7, collar: 1.5 }, ...(metro ? { metal: METAL.standard } : {}) };
    case 'street-signal':
      if (onGround(b)) return { shape: 'kit-pole', round: { taper: 0.82, collar: 1.45 }, ...(metro ? { metal: METAL.galvanized } : {}) };
      return b.tint === '#26282b' ? null : { shape: 'kit-lens' };
    case 'street-sign':
      return onGround(b) ? { shape: 'kit-pole', round: { taper: 1 }, metal: METAL.galvanized } : null;
    case 'stop-sign':
      return onGround(b) ? { shape: 'kit-pole', round: { taper: 1 }, metal: METAL.galvanized } : { shape: 'kit-octagon' };
    case 'power-pole':
      return onGround(b) ? { shape: 'kit-pole', round: { taper: 0.7 } } : null;   // a wooden pole; the crossarm is sawn timber
    case 'tram-pole':
      return { shape: 'kit-pole', round: { taper: 0.8, collar: 1.35 } };
    case 'platform-post':
      return { shape: 'kit-pole', round: { taper: 1 } };
    case 'pillar':
      return { shape: 'kit-pier' };
    case 'park-bin':
      return { shape: 'kit-drum' };
    case 'drop-off-bollard':
      return { shape: 'kit-bollard', ...(metro ? { metal: METAL.stainless } : {}) };
    case 'play-swing': case 'play-slide': case 'play-gym': case 'play-seesaw':
      // playground frames are tube: a post on the ground is a round post, a thin bar (a beam, a rung, a monkey bar)
      // a rod; the seesaw's fulcrum a drum. Seats, chains, the slide's platform and handles stay as built
      if (onGround(b) && Math.abs(b.w - b.d) < 1e-6 && b.z1 > 4 * b.w) return { shape: 'kit-pole', round: { taper: 1 } };
      if (elongated(b) && Math.min(b.w, b.d) <= 0.12 && b.z1 - (b.z0 || 0) <= 0.12) return { shape: 'kit-arm' };
      if (b.kind === 'play-seesaw' && onGround(b)) return { shape: 'kit-drum' };
      return null;
    case 'power-line': case 'tram-bracket':
      return elongated(b) ? { shape: 'kit-arm' } : null;   // a wire, a mast's bracket arm
    case 'parking-entrance':
      // the entrance's posts and bollards: the small square uprights on the ground (a porte-cochère column, the
      // barrier and P-sign posts); the rest of the entrance (walls, canopy, doors, signs) stays as built
      if (!onGround(b) || Math.abs(b.w - b.d) > 1e-6 || b.w > 0.2) return null;
      if (b.z1 <= 0.6) return { shape: 'kit-bollard', ...(metro ? { metal: METAL.stainless } : {}) };
      return { shape: 'kit-pole', round: b.z1 > 2 ? { taper: 0.92, collar: 1.3 } : { taper: 1 }, ...(b.z1 > 2 ? {} : { metal: METAL.galvanized }) };
    default:
      return null;
  }
}

/** The planner's post-pass: every kit box that has a round form gains it (a new object; the rest pass by identity). */
export function roundStreetKit(boxes, { profile = 'city' } = {}) {
  const metro = profile === 'metro', canal = profile === 'canal';
  return boxes.map((b) => {
    // a building carries the flag to its rooftop kit (water tanks, stacks, masts: building-facade addRoofItem)
    if (b && BUILDING_KINDS.has(b.kind)) return { ...b, roundKit: true };
    if (!b || b.shape || typeof b.kind !== 'string') return b;
    const role = kitRole(b, metro, canal);
    return role ? { ...b, ...role } : b;
  });
}

// ---------- the realizer ----------

export const ROUND_KIT_SHAPES = new Set(['kit-pole', 'kit-arm', 'kit-head', 'kit-lantern', 'kit-lantern-roof', 'kit-lens', 'kit-octagon', 'kit-drum', 'kit-bollard', 'kit-pier', 'kit-tank']);
export const isRoundKitShape = (s) => typeof s === 'string' && ROUND_KIT_SHAPES.has(s);

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const r4 = (p) => p.map((v) => +v.toFixed(5));
// an axis frame: `a` the axis, (p, q) the ring plane with p × q = a, so a CCW ring's tangent × a points outward
const AXES = { z: { a: [0, 0, 1], p: [1, 0, 0], q: [0, 1, 0] }, x: { a: [1, 0, 0], p: [0, 1, 0], q: [0, 0, 1] }, y: { a: [0, 1, 0], p: [0, 0, 1], q: [1, 0, 0] } };

function makeLathe(faces, L) {
  const at = (c, ax, r, t, ang) => add(add(c, mul(ax.a, t)), add(mul(ax.p, Math.cos(ang) * r), mul(ax.q, Math.sin(ang) * r)));
  const push = (corners, tint) => {
    const n = unit(cross(sub(corners[2], corners[0]), sub(corners[3], corners[1])));
    faces.push({ corners: corners.map(r4), fill: scaleHex(tint, litFactor(n, L)) });
  };
  /** Bands between successive rings of `profile` [[r, t], …] (t along the axis, bottom → top), n segments. */
  const lathe = (c, ax, profile, n, tint, phase = 0) => {
    for (let k = 0; k + 1 < profile.length; k++) {
      const [r0, t0] = profile[k], [r1, t1] = profile[k + 1];
      for (let i = 0; i < n; i++) {
        const a0 = phase + TAU * i / n, a1 = phase + TAU * (i + 1) / n;
        push([at(c, ax, r0, t0, a0), at(c, ax, r0, t0, a1), at(c, ax, r1, t1, a1), at(c, ax, r1, t1, a0)], tint);
      }
    }
  };
  /** A round cap of radius r at t over an n-sided ring, facing +axis (up) or −axis: one border-radius face (or `clip`). */
  const disc = (c, ax, r, t, tint, up = true, clip = null, n = 8) => {
    const o = add(c, mul(ax.a, t)), P = (s, u) => add(o, add(mul(ax.p, s * r), mul(ax.q, u * r)));
    const corners = up ? [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)] : [P(-1, -1), P(-1, 1), P(1, 1), P(1, -1)];
    faces.push({ corners: corners.map(r4), fill: scaleHex(tint, litFactor(mul(ax.a, up ? 1 : -1), L)), ...(clip ? { clip } : { radius: '50%', radiusSeg: n / 4 }) });
  };
  return { lathe, disc };
}

// the octagon, as a square face's clip (regular: flats on the square's sides)
const OCT = (() => { const k = ((1 - Math.tan(Math.PI / 8)) / 2 * 100).toFixed(2), m = (100 - +k).toFixed(2);
  return `polygon(${k}% 0%, ${m}% 0%, 100% ${k}%, 100% ${m}%, ${m}% 100%, ${k}% 100%, 0% ${m}%, 0% ${k}%)`; })();

// The World page packs the metal channel's per-vertex data for EVERY vertex of a mesh group holding one metal face,
// so the kit's metal faces ride their own group: a few galvanized posts must not carry the whole city's mesh.
export const KIT_METAL_GROUP = 'street-kit:metal';

/** The faces of one `kit-*` box, lit by L. A box carrying `metal` wears it on its body (not on a lamp's glass). */
export function roundKitFaces(b, L) {
  const faces = [];
  const { lathe, disc } = makeLathe(faces, L);
  const z0 = b.z0 || 0, h = b.z1 - z0, cx = b.x + b.w / 2, cy = b.y + b.d / 2;
  const base = [cx, cy, z0], Z = AXES.z, rr = Math.min(b.w, b.d) / 2;
  const row = b.metal ? resolveMaterial(b.metal) : null;
  const body = row ? row.base : b.tint;
  const wear = (from, along) => { if (row) tagFacesWithMaterial(faces.slice(from), row, { along }); };
  switch (b.shape) {
    case 'kit-pole': {
      // a tapered shaft on an optional base collar (a lamp standard's plinth), capped round
      const { taper = 0.75, collar = 0 } = b.round || {};
      const n = rr > 0.1 ? 12 : 8;
      let t0 = 0;
      if (collar > 1) {
        const ch = Math.min(h * 0.07, rr * 3.2);
        lathe(base, Z, [[rr * collar, 0], [rr * collar, ch * 0.7], [rr * (1 + (collar - 1) * 0.45), ch]], n, scaleHex(body, 0.9));
        disc(base, Z, rr * (1 + (collar - 1) * 0.45), ch, body, true, null, n);
        t0 = ch;
      }
      lathe(base, Z, [[rr * (collar > 1 ? 0.96 : 1), t0], [rr * taper, h]], n, body);
      disc(base, Z, rr * taper, h, scaleHex(body, 1.05), true, null, n);
      wear(0, 'z');
      break;
    }
    case 'kit-arm': {
      // a round rod down the box's long axis
      const alongX = b.w >= b.d, ax = alongX ? AXES.x : AXES.y;
      const r = Math.min(alongX ? b.d : b.w, h) / 2, len = alongX ? b.w : b.d;
      const c = alongX ? [b.x, cy, z0 + h / 2] : [cx, b.y, z0 + h / 2];
      lathe(c, ax, [[r, 0], [r, len]], 6, body);
      wear(0, alongX ? 'x' : 'y');
      break;
    }
    case 'kit-head': {
      // a luminaire: a deep warm glass bowl (it reads from the street, not only from below) under a low domed hood
      const r = rr * 1.08, hood = row ? row.base : (b.hood || '#555b62');
      disc(base, Z, r * 0.5, 0, b.tint, false);
      lathe(base, Z, [[r * 0.5, 0], [r * 0.9, h * 0.3], [r * 0.98, h * 0.56]], 8, b.tint);
      const from = faces.length;
      lathe(base, Z, [[r * 1.03, h * 0.52], [r * 0.84, h * 0.8], [r * 0.4, h]], 8, hood);
      disc(base, Z, r * 0.4, h, scaleHex(hood, 1.05));
      if (row) tagFacesWithMaterial(faces.slice(from), row, { along: 'around' });
      break;
    }
    case 'kit-lantern': {
      // the canal lantern's glass: eight panes flaring toward the cap, on a dark base plate
      const hood = b.hood || '#2d3033';
      lathe(base, Z, [[rr * 0.62, 0], [rr * 0.62, h * 0.12]], 8, hood);
      lathe(base, Z, [[rr * 0.66, h * 0.12], [rr * 0.94, h]], 8, b.tint);
      disc(base, Z, rr * 0.62, 0, hood, false);
      break;
    }
    case 'kit-lantern-roof': {
      // the lantern's pitched cap and finial, rising a little past the box top
      lathe(base, Z, [[rr, 0], [rr * 0.94, h * 0.4], [rr * 0.26, h * 1.5]], 8, body);
      lathe(base, Z, [[rr * 0.14, h * 1.5], [rr * 0.14, h * 2.1]], 8, body);
      disc(base, Z, rr * 0.18, h * 2.1, scaleHex(body, 1.1));
      disc(base, Z, rr, 0, scaleHex(body, 0.8), false);
      break;
    }
    case 'kit-lens': {
      // a round signal lens: a short cylinder on the box's thin axis, both faces lit in its colour
      const thinX = b.w < b.d, ax = thinX ? AXES.x : AXES.y;
      const r = Math.min(thinX ? b.d : b.w, h) / 2, len = thinX ? b.w : b.d;
      const c = thinX ? [b.x, cy, z0 + h / 2] : [cx, b.y, z0 + h / 2];
      lathe(c, ax, [[r, 0], [r, len]], 8, scaleHex(b.tint, 0.7));
      disc(c, ax, r, 0, b.tint, false);
      disc(c, ax, r, len, b.tint, true);
      break;
    }
    case 'kit-octagon': {
      // the stop plate: a thin red octagon with a white border, on the box's thin axis
      const thinX = b.w < b.d, ax = thinX ? AXES.x : AXES.y;
      const s = Math.min(thinX ? b.d : b.w, h) / 2, th = Math.min(thinX ? b.w : b.d, 0.03);
      const c = thinX ? [cx - th / 2, cy, z0 + h / 2] : [cx, cy - th / 2, z0 + h / 2];
      lathe(c, ax, [[s / Math.cos(Math.PI / 8), 0], [s / Math.cos(Math.PI / 8), th]], 8, scaleHex(b.tint, 0.8), Math.PI / 8);
      for (const [t, up] of [[0, false], [th, true]]) {
        disc(c, ax, s, t, '#e9e6de', up, OCT);
        disc(c, ax, s * 0.84, up ? t + 0.002 : t - 0.002, b.tint, up, OCT);
      }
      break;
    }
    case 'kit-drum': {
      // `hood` darkens the top (a stack's flue)
      lathe(base, Z, [[rr, 0], [rr, h]], 12, b.tint);
      disc(base, Z, rr, h, b.hood || scaleHex(b.tint, 1.06), true, null, 12);
      break;
    }
    case 'kit-tank': {
      // a rooftop water tank: a round drum with a proud hoop band under a shallow conical roof and a vent cap
      const r = rr * 0.96;
      lathe(base, Z, [[r, 0], [r, h * 0.8]], 12, b.tint);
      lathe(base, Z, [[r * 1.04, h * 0.4], [r * 1.04, h * 0.48]], 12, scaleHex(b.tint, 0.78));
      lathe(base, Z, [[r * 1.03, h * 0.8], [r * 0.2, h]], 12, scaleHex(b.tint, 0.88));
      disc(base, Z, r * 0.2, h, scaleHex(b.tint, 0.7), true, null, 12);
      break;
    }
    case 'kit-bollard': {
      // a round post with a domed head
      const dome = Math.min(rr * 0.9, h * 0.3);
      lathe(base, Z, [[rr, 0], [rr, h - dome], [rr * 0.72, h - dome * 0.25]], 8, body);
      disc(base, Z, rr * 0.72, h - dome * 0.25, scaleHex(body, 1.08));
      wear(0, 'z');
      break;
    }
    case 'kit-pier': {
      // a round freeway pier: the deck covers its top
      lathe(base, Z, [[rr, 0], [rr * 0.92, h]], 12, b.tint);
      break;
    }
    default:
      break;
  }
  for (const f of faces) if (f.metal) f.group = KIT_METAL_GROUP;
  return faces;
}
