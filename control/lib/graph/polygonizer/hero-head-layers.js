/**
 * THE HEAD'S LAYERS on the realistic hero: what the face-harmony growers make on the relational head (dermal-jewel.js's
 * piercings, then the scalp's and the beard's cards), carried onto the hero's head as pinned layer-2 parts (station-loft.js:
 * free triangles, each part one weight set, its pin face's).
 *
 *   heroJewellery(recipe, piercings) → { parts: { jewel?, jewelJaw? }, palette: { group: hex } }
 *   heroHair(recipe, dermis, scalp)   → { parts: { hair? }, palette: { Hair, HairStreak? }, counts }
 *
 * The head the recipe wears is rebuilt from its fit (`recipe.headFit`: the pole, the face's relations and eyes, its
 * scale and offsets), pierced on its own chart (metres, the chart's frame) and mapped into the hero's frame: a chart
 * point q is [q0·k/1.8, q1·k/1.8 + ty, q2·k/1.8 + men]. The pieces ride the VISAGE (never the cranium or the jaw, whose
 * pins the relational head keeps clear): a face of it the head alone carries for the ears', the nose's and the brow's,
 * one the jaw alone carries for the lower lip's (a labret, a lip ring), so each follows what it is through. Each piece's
 * group its metal's (`JewelGold`, …) or its gem's (`GemRuby`, …), coloured by the palette this returns. Deterministic.
 */
import { relationalHead } from './head-relational.js';
import { HEAD_TUNES } from './hero-relational-head.js';
import { compileLayered, pinFrame } from './station-loft.js';
import { surfaceLocalOffset } from './surface-pin.js';
import { relationalHeadChart, STAND_M } from '../epidermis/dermal-head.js';
import { pierce, JEWEL_METALS, JEWEL_GEMS } from '../epidermis/dermal-jewel.js';
import { growScalp, readScalp } from '../epidermis/dermal-hair.js';
import { readDermis, hairMeanOf, linHex } from '../epidermis/dermal-map.js';

const r6 = (v) => Math.round(v * 1e6) / 1e6;
/** the sites through the lower lip: they ride the jaw */
const JAW_SITES = new Set(['labret', 'lip-ring']);
/** the chart the piercings are placed on (its cells: the ear's samples for the ear's sites; the face's settle on the field) */
const CELLS = 60;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
/** a piece's group: its gem's, else its metal's (a hex metal its own word) */
export const jewelGroupOf = (name, metal) => (metal ? `Jewel${JEWEL_METALS[name] ? cap(name) : name.replace('#', '')}` : `Gem${JEWEL_GEMS[name] ? cap(name) : name.replace('#', '')}`);

/** the visage's face the bone `bone` alone carries nearest `near` (hero frame): its pin, its point ids' centroid */
function visagePin(visage, compiled, bone, near) {
  const blend = visage.bind?.blend || {}, only = (pid) => { const b = blend[pid.slice(pid.indexOf('/') + 1)] ?? { head: 1 }; return (b[bone] ?? 0) >= 0.999; };
  let best = null, bd = Infinity;
  for (const [id, f] of Object.entries(compiled.faces)) {
    if (!f.every(only)) continue;
    const c = [0, 1, 2].map((k) => f.reduce((a, p) => a + compiled.points[p][k], 0) / 3), d = Math.hypot(c[0] - near[0], c[1] - near[1], c[2] - near[2]);
    if (d < bd) { bd = d; best = { parent: 'visage', face: id, weights: [0.25, 0.25, 0.5], tangentEdge: [f[0], f[1]], handedness: 1 }; }
  }
  return best;
}

/** The piercings (dermal-jewel.js's list) on the realistic hero's head, as pinned parts and their palette. */
export function heroJewellery(recipe, piercings) {
  const fit = recipe.headFit;
  if (!fit || !piercings?.length || !recipe.parts.visage) return { parts: {}, palette: {} };
  const { sex, k, ty, men, relations, eyes } = fit;
  const head = relationalHead({ sex, tune: HEAD_TUNES[sex], ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}) });
  const J = pierce(relationalHeadChart(head, { cells: CELLS }), head, piercings);
  if (!J.mesh.faces.length) return { parts: {}, palette: {} };
  const s = k / STAND_M, toHero = (q) => [q[0] * s, q[1] * s + ty, q[2] * s + men];
  const visage = recipe.parts.visage, compiled = compileLayered({ parts: { visage }, dials: {}, creases: {} }).parts.visage;
  const L = head.landmarks, at = (p) => [p.x * k, p.y * k + ty, p.z * k + men];
  const groups = J.materials.map((m) => jewelGroupOf(m.name, m.metal)), palette = {};
  J.materials.forEach((m, i) => { palette[groups[i]] = m.metal ? (JEWEL_METALS[m.name] ?? m.name) : (JEWEL_GEMS[m.name] ?? m.name); });
  const parts = {};
  for (const [name, bone, near] of [['jewel', 'head', at(L.n)], ['jewelJaw', 'jaw', at(L.pg)]]) {
    const fis = J.mesh.faces.map((_, fi) => fi).filter((fi) => JAW_SITES.has(J.pieces[J.mesh.piece[fi]].site) === (bone === 'jaw'));
    if (!fis.length) continue;
    const pin = visagePin(visage, compiled, bone, near);
    if (!pin) continue;
    const frame = pinFrame(compiled, pin), vid = new Map(), offsets = {}, faces = {}, fg = {};
    const v = (i) => { if (!vid.has(i)) { const id = `v${vid.size}`; vid.set(i, id); offsets[id] = surfaceLocalOffset(frame, toHero(J.mesh.vertices[i])).map(r6); } return vid.get(i); };
    fis.forEach((fi, n) => { faces[`f${n}`] = J.mesh.faces[fi].map(v); fg[`f${n}`] = groups[J.mesh.material[fi]]; });
    const gs = new Set(Object.values(fg)), group = Object.values(fg)[0];
    parts[name] = { layer: 2, closure: 'closed', pin, group, offsets, faces, ...(gs.size > 1 ? { groups: fg } : {}) };
  }
  return { parts, palette };
}

/** a card on the hero: the points along it (every CARD.step-th of the guide's), its thickness (m, before the head's scale) */
const CARD = Object.freeze({ points: 12, thick: 0.0006 });
/**
 * The SCALP on the realistic hero: the groom (dermal-hair.js `readScalp`'s: a style word or its document, the cut, the
 * ties, the streaks) grown on the face's head as an engine's hair, its CARDS (one ribbon per guide, the strands left to a
 * render), each a thin closed slab along the guide (its width the card's, its points CARD.points of the guide's), mapped
 * into the hero's frame and pinned to the visage where the head alone carries it. `Hair` the hair's colour as the eye
 * averages it (its grey mixed in: dermal-map.js `hairMeanOf`), a streak's cards `HairStreak` in the dye. A buzz (under
 * 2 cm, lying on the scalp) grows no cards: the skin's painted scalp is the hair. `dermis` the hero's (its colour, its
 * hairline and loss). Deterministic.
 */
export function heroHair(recipe, dermis, scalp) {
  const fit = recipe.headFit;
  if (!fit || !scalp || !recipe.parts.visage) return { parts: {}, palette: {}, counts: null };
  const { sex, k, ty, men, relations, eyes } = fit, D = readDermis(dermis), S = readScalp(scalp);
  const head = relationalHead({ sex, tune: HEAD_TUNES[sex], ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}) });
  const G = growScalp(relationalHeadChart(head, { cells: CELLS }), D, S, { colliders: ['head'], strands: false });
  if (!G.cards.length) return { parts: {}, palette: {}, counts: G.counts };
  const sc = k / STAND_M, toHero = (q) => [q[0] * sc, q[1] * sc + ty, q[2] * sc + men];
  const visage = recipe.parts.visage, compiled = compileLayered({ parts: { visage }, dials: {}, creases: {} }).parts.visage;
  const pin = visagePin(visage, compiled, 'head', [head.landmarks.n.x * k, head.landmarks.n.y * k + ty, head.landmarks.n.z * k + men]);
  if (!pin) return { parts: {}, palette: {}, counts: G.counts };
  const frame = pinFrame(compiled, pin), offsets = {}, faces = {}, groups = {};
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
  let nv = 0, nf = 0, streaked = null;
  const put = (p) => { const id = `v${nv++}`; offsets[id] = surfaceLocalOffset(frame, toHero(p)).map(r6); return id; };
  const face = (a, b, c, g) => { const id = `f${nf++}`; faces[id] = [a, b, c]; if (g !== 'Hair') groups[id] = g; };
  for (const c of G.cards) {
    const N = c.pts.length - 1, M = Math.min(CARD.points, N), idx = Array.from({ length: M + 1 }, (_, i) => Math.round((i * N) / M));
    const g = c.streak ? 'HairStreak' : 'Hair';
    if (c.streak) streaked = c.streak.colour;
    // each point's four corners: the card's two edges, a thickness apart about its middle
    const ring = idx.map((j) => {
      const p = c.pts[j], t = unit(sub(c.pts[Math.min(N, j + 1)], c.pts[Math.max(0, j - 1)])), sd = unit(c.side[j]), n = unit(cross(t, sd)), w = c.width[j] / 2, h = CARD.thick / 2;
      return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => put([0, 1, 2].map((q) => p[q] + sd[q] * w * a + n[q] * h * b)));
    });
    for (let i = 0; i < M; i++) for (let e = 0; e < 4; e++) { const a = ring[i][e], b = ring[i][(e + 1) % 4], c2 = ring[i + 1][(e + 1) % 4], d = ring[i + 1][e]; face(a, d, c2, g); face(a, c2, b, g); }
    // (closed at both ends)
    face(ring[0][0], ring[0][1], ring[0][2], g); face(ring[0][0], ring[0][2], ring[0][3], g);
    face(ring[M][0], ring[M][2], ring[M][1], g); face(ring[M][0], ring[M][3], ring[M][2], g);
  }
  const palette = { Hair: linHex(hairMeanOf(D)), ...(streaked ? { HairStreak: linHex(streaked) } : {}) };
  return { parts: { hair: { layer: 2, closure: 'closed', pin, group: 'Hair', offsets, faces, ...(Object.keys(groups).length ? { groups } : {}) } }, palette, counts: { ...G.counts, cards: G.cards.length } };
}
