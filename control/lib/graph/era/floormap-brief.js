/**
 * THE PLATE BRIEF — what a painter (a person or an image model) is asked for, one per floormap camera: the backdrop
 * that camera sees, painted over the greybox so the floor lands where the walkmesh already knows it is. The painted
 * image comes back to that camera's plate (playscape/walkmesh/from-floormap.js), whose floor, occluders and exits are
 * projected from the floormap, never traced.
 *
 *   plateBrief(fm, cam, { style })   → { id, size, camera, looking, inView: { regions, edges, items }, prompt, guide }
 *     guide: the greybox through the camera in values (an SVG, 1280×720), what the painting must keep
 *
 * The words are the floormap's own (a region's or an item's `form`, DEPICT for the edge kinds); the brief adds no
 * look of its own: style is the caller's.
 */
import { floormapFaces, footprint, inPoly, EDGE_KINDS, GREY } from './floormap.js';
import { VIEW, SHOTS } from './floormap-cameras.js';
import { project } from './floormap-laws.js';

// how a painter is told each edge kind (what the backdrop shows where the floor ends)
export const DEPICT = Object.freeze({ wall: 'walls', rail: 'a balustrade, the view running on past it', drop: 'a lip over a drop', water: 'a bank onto water', foliage: 'hedges and undergrowth', exit: 'a way through that runs on out of frame' });
const COMPASS = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
const inFrame = (p) => p && p.px[0] >= 0 && p.px[0] <= VIEW.width && p.px[1] >= 0 && p.px[1] <= VIEW.height;
const r1 = (n) => Math.round(n * 10) / 10;
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// a world polygon cut to the part in front of the camera
function clipNear(B, poly) {
  const side = (P) => (P[0] - B.position[0]) * B.forward[0] + (P[1] - B.position[1]) * B.forward[1] + (P[2] - B.position[2]) * B.forward[2] - 0.06;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length], sp = side(P), sq = side(Q);
    if (sp >= 0) out.push(P);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([0, 1, 2].map((j) => P[j] + (Q[j] - P[j]) * t)); }
  }
  return out;
}

/** The greybox's nearest depth per cell through one camera (a small z-buffer), and a test: is a point seen? */
export function seenTest(fm, cam, w = 160) {
  const B = cam.basis, h = Math.round((w * VIEW.height) / VIEW.width), s = w / VIEW.width, depth = new Float32Array(w * h).fill(Infinity);
  for (const f of floormapFaces(fm)) {
    const q = clipNear(B, f.corners).map((P) => project(B, P)).filter(Boolean).map((x) => [x.px[0] * s, x.px[1] * s, x.depth]);
    for (let k = 1; k + 1 < q.length; k++) {
      const p = [q[0], q[k], q[k + 1]], den = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
      if (Math.abs(den) <= 1e-12) continue;
      const i0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), i1 = Math.min(w - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
      const j0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), j1 = Math.min(h - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = i + 0.5, y = j + 0.5, ba = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / den, bb = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / den, bc = 1 - ba - bb;
        if (ba < -1e-9 || bb < -1e-9 || bc < -1e-9) continue;
        const d = 1 / (ba / p[0][2] + bb / p[1][2] + bc / p[2][2]);
        if (d < depth[j * w + i]) depth[j * w + i] = d;
      }
    }
  }
  return (P) => {
    const r = project(B, P);
    if (!inFrame(r)) return false;
    const i = Math.min(w - 1, Math.floor(r.px[0] * s)), j = Math.min(h - 1, Math.floor(r.px[1] * s));
    return r.depth <= depth[j * w + i] + 0.06 + r.depth * 0.004;   // a point on a face is its own nearest
  };
}

/** The greybox through one camera, in flat values (floor lightest, what stands darker), painter-sorted. */
export function guideSvg(fm, cam) {
  const B = cam.basis, draws = [];
  for (const f of floormapFaces(fm)) {
    const c = f.corners.reduce((a, p) => [a[0] + p[0] / f.corners.length, a[1] + p[1] / f.corners.length, a[2] + p[2] / f.corners.length], [0, 0, 0]);
    if (f.kind !== 'floor' && (c[0] - B.position[0]) * f.normal[0] + (c[1] - B.position[1]) * f.normal[1] + (c[2] - B.position[2]) * f.normal[2] > 0) continue;
    const q = clipNear(B, f.corners).map((P) => project(B, P)).filter(Boolean);
    if (q.length < 3) continue;
    draws.push({ floor: f.kind === 'floor', depth: Math.max(...q.map((x) => x.depth)), svg: `<polygon points="${q.map((x) => `${r1(x.px[0])},${r1(x.px[1])}`).join(' ')}" fill="${GREY[f.kind] || GREY.floor}" stroke="#000" stroke-opacity=".5" stroke-width="1.2"/>` });
  }
  draws.sort((a, b) => (b.floor ? 1 : 0) - (a.floor ? 1 : 0) || b.depth - a.depth);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.width} ${VIEW.height}" width="${VIEW.width}" height="${VIEW.height}"><rect width="${VIEW.width}" height="${VIEW.height}" fill="#26282d"/>${draws.map((d) => d.svg).join('')}</svg>`;
}

export function plateBrief(fm, cam, { style = null } = {}) {
  const B = cam.basis, z = fm.regions.find((r) => r.id === cam.zone.region).z;
  const yaw = Math.atan2(B.forward[1], B.forward[0]), looking = COMPASS[((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8];
  // what the camera sees, not only what falls in its frame: a point counts when nothing nearer stands over it
  const seen = seenTest(fm, cam), zOf = new Map(fm.regions.map((r) => [r.id, r.z]));
  const regions = fm.regions.filter((r) => {
    const xs = r.poly.map((p) => p[0]), ys = r.poly.map((p) => p[1]), step = Math.max(0.5, Math.sqrt(((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) / 60));
    let n = 0;
    for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step) for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) if (inPoly([x, y], r.poly) && seen([x, y, r.z + 0.02])) n++;
    return n >= 2;
  });
  const edges = {};
  for (const p of fm.pieces) {
    if (!EDGE_KINDS[p.kind] || p.kind === 'void') continue;
    const z = zOf.get(p.region), pts = [0.25, 0.5, 0.75].map((t) => [p.a[0] + (p.b[0] - p.a[0]) * t - p.n[0] * 0.05, p.a[1] + (p.b[1] - p.a[1]) * t - p.n[1] * 0.05, z + 0.4]);
    if (pts.some(seen)) edges[p.kind] = (edges[p.kind] || 0) + Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
  }
  const items = fm.items.filter((it) => {
    if (!['stand', 'block', 'hotspot', 'pickup', 'light'].includes(it.kind)) return false;
    const f = footprint(it), top = it.z + (it.h || 0.3), pts = f ? [...f.map(([x, y]) => [x, y, top + 0.01]), ...f.map(([x, y]) => [x, y, (it.z + top) / 2])] : [[it.at[0], it.at[1], top]];
    return pts.some(seen);
  });
  const forms = regions.map((r) => r.form).filter(Boolean);
  const said = Object.keys(edges).sort((a, b) => edges[b] - edges[a]).map((k) => DEPICT[k]).filter(Boolean);
  // what is painted in: the pieces that carry a form of their own (a pickup or a bare hotspot is the game's to draw)
  const counted = new Map();
  for (const it of items) if (it.form !== it.kind) counted.set(it.form, (counted.get(it.form) || 0) + 1);
  const things = [...counted].map(([f, n]) => (n > 1 ? `${f} (×${n})` : f));
  const prompt = [
    `A background plate for a fixed-camera game, seen ${SHOTS[cam.shot].about.split(' (')[0]}: ${Math.round(cam.framing.horizontalFov)}° across, the eye ${r1(B.position[2] - z)} m over the floor, looking ${looking}.`,
    forms.length ? `The floor: ${list(forms)}.` : '',
    said.length ? `Where the floor ends: ${list(said)}.` : '',
    things.length ? `Standing on it: ${list(things)}.` : '',
    'Keep the floor, every edge and every piece where the guide draws them; leave the floor open; no people.',
    style ? `Style: ${style}.` : '',
  ].filter(Boolean).join(' ');
  return {
    id: cam.id, size: [VIEW.width, VIEW.height],
    camera: { at: cam.framing.cameraPosition, look: cam.framing.lookAt, fov: cam.framing.horizontalFov },
    looking, inView: { regions: regions.map((r) => r.id), edges: Object.fromEntries(Object.entries(edges).map(([k, v]) => [k, r1(v)])), items: items.map((it) => it.id) },
    prompt, guide: guideSvg(fm, cam),
  };
}
