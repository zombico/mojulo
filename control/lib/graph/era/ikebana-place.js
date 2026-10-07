/**
 * IKEBANA, PLACED — a style card's `ikebana` paints arrangements (era/out-ikebana.js) along the banks of a trail and
 * stands them in the world: every element on the ground at its own foot, coloured from the kit's swatches (the flora
 * skin, era/out-flora.js) and banded by the same cel light as the rest of the stage, so it casts and takes the sun's
 * shadow. What a walker pushes through (flowers, tufts, anything under a step) goes in a SOFT group the page walks
 * through; what blocks is solid on the page and a collider for an engine. Pure; seeded.
 *
 *   card.ikebana = { materials, scale, density, variation, bend, cover, walk, incongruity, ma,
 *                    banks: [{ side: ±1, off, from, to }]   strokes along the trail, `off` metres past its fringe }
 */
import { ikebanaZone, WALK } from './out-ikebana.js';
import { IKEBANA_MATERIALS } from './out-ikebana.js';
import { floraSkin, floraMeasures } from './out-flora.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
export const SOFT_GROUP = 'flora:soft', SOLID_GROUP = 'flora:solid';
// below this a downturned face is under a walker's eye (1.7 m) with room to spare: never seen
const EYE_LOW = 1.3;

/**
 * The arrangements for a site: strokes down each bank (broken where the ground will not take them: the cliff, the
 * apron, the trail's reserved places), sprouted by the zone painter facing the trail's centreline.
 * → { arrangements, elements: [{ x, y, z, design, soft, of }], colliders, anchors, avoid }
 */
export function placeIkebana(st, site, seed) {
  const K = st.ikebana, { W, D, trailX, halfWAt, fringeAt, cliffX, apronAt, ground } = site;
  const ok = (x, y) => x > cliffX(y) + 3 && x < W - 2 && y > 2 && y < D - 2 && apronAt(x, y) < 0.02 && !(site.clear && site.clear(x, y));
  const line = []; for (let y = 0; y <= D; y += 2) line.push([trailX(y), y]);
  // a level stands on its own terrain: an arrangement's ground of its own (a mound, a hollow) is left to the land
  const M0 = typeof K.materials === 'string' ? IKEBANA_MATERIALS[K.materials] : K.materials, { ground: _g, ...M } = M0;
  // each bank its own zone: a bank may override the card's dials (a far row builds at far detail, sparser, uncovered)
  const all = [];
  K.banks.forEach((b, bi) => {
    const strokes = [];
    let run = [];
    for (let y = b.from ?? 3; y <= Math.min(D - 3, b.to ?? D); y += 2) {
      const x = trailX(y) + b.side * (halfWAt(y) + fringeAt(y) + b.off);
      if (ok(x, y)) run.push([r5(x), y]); else { if (run.length > 1) strokes.push({ points: run, width: b.width ?? 2 }); run = []; }
    }
    if (run.length > 1) strokes.push({ points: run, width: b.width ?? 2 });
    const { side: _s, off: _o, from: _f, to: _t, width: _w, ...over } = b;
    const Z = ikebanaZone({ ...K, level: K.level ?? 'mid', ...over, materials: M, strokes, faceTo: line }, seed * 31 + bi);
    all.push(...Z.arrangements.map((A) => ({ ...A, bank: bi })));
  });
  // and two banks' arrangements never stand in each other's way
  const arrangements = [];
  for (const A of all.filter((q) => ok(q.at[0], q.at[1]))) if (arrangements.every((B) => Math.hypot(A.at[0] - B.at[0], A.at[1] - B.at[1]) > (K.scale ?? 8) * 0.7)) arrangements.push(A);
  const elements = [], colliders = [], anchors = [], avoid = [];
  arrangements.forEach((A, i) => {
    for (const e of [...A.stems, ...A.cover]) {
      const h = floraMeasures(e.design).height, thick = A.walk === 'thicket' && e.role === 'jushi';
      const soft = !thick && (e.form === 'flower' || e.form === 'tuft' || h < WALK.step);
      elements.push({ x: e.x, y: e.y, z: ground(e.x, e.y) - 0.04, design: e.design, soft, of: `ikebana-${i}:${e.role}` });
      if (!soft) avoid.push({ x: e.x, y: e.y });
    }
    for (const c of A.colliders.filter((q) => q.kind === 'block')) {
      const g = ground(c.x, c.y);
      colliders.push({ min: [r5(c.x - c.r), r5(c.y - c.r), r5(g)], max: [r5(c.x + c.r), r5(c.y + c.r), r5(g + Math.min(c.h ?? WALK.body, WALK.body * 2))], of: `ikebana:${i}:${c.of}` });
    }
    anchors.push({ id: `ikebana-${i}`, kind: 'arrangement', at: [A.at[0], A.at[1], r5(ground(A.at[0], A.at[1]))].map(r5), facing: r5(A.facing), hand: A.hand, style: A.style, odd: !!A.odd, stems: A.stems.length, laws: A.laws.map((l) => l.law) });
  });
  return { arrangements, elements, colliders, anchors, avoid };
}

/**
 * The elements' faces in the world, unlit: each face at its element's foot, its part's ramp (the kit's flora skin) and
 * its value carried for the lock. `group` says whether a walker passes through it.
 */
export function ikebanaFaces(st, P) {
  const out = [];
  // what a walker never sees goes too: a face turned down below the eye (a bush's or a flower's underside on the
  // ground), or one sunk under the ground
  const hidden = (f) => { const n = f.gn ?? f.normal; return (n[2] < -0.35 && Math.max(...f.corners.map((p) => p[2])) < EYE_LOW) || f.corners.every((p) => p[2] < -0.02); };
  for (const e of P.elements) for (const f of e.design.faces) if (!hidden(f)) out.push({ corners: f.corners.map((p) => [r5(p[0] + e.x), r5(p[1] + e.y), r5(p[2] + e.z)]), normal: f.normal, part: f.part, value: f.value, group: e.soft ? SOFT_GROUP : SOLID_GROUP, node: e.of });
  return out;
}

/** A face's colour: its part's ramp in the kit's skin, the stop its value falls on, one up where the sun reaches it and
 *  one down where it turns from it (the cel band, pixel-locked to the ramp). */
export function ikebanaFill(st, f, lit, away) {
  const role = floraSkin(st.id)[f.part], ramp = st.palette[role] ?? st.palette.foliage, n = ramp.length;
  const k = Math.max(0, Math.min(n - 1, Math.round(f.value * (n - 1)) + (lit ? 1 : 0) - (away ? 1 : 0)));
  return ramp[k];
}
