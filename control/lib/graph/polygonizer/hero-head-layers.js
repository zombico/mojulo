/**
 * THE HEAD'S LAYERS on the realistic hero: what the face-harmony growers make on the relational head (dermal-jewel.js's
 * piercings, then the scalp's and the beard's cards), carried onto the hero's head as pinned layer-2 parts (station-loft.js:
 * free triangles, each part one weight set, its pin face's).
 *
 *   heroJewellery(recipe, piercings) → { parts: { jewel?, jewelJaw? }, palette: { group: hex } }
 *   heroHair(recipe, dermis, scalp)   → { parts: { hair? }, palette: { Hair, HairStreak? }, counts }
 *   heroFaceHair(recipe, dermis, { type, epidermis }) → { parts: { hairBeard?, hairBeardJaw?, hairBrows?, hairLashes? }, palette }
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
import { readScalp, growBodyHair, bladeOf, HAIR_LADDER } from '../epidermis/dermal-hair.js';
import { depictHair, stripMesh, capMesh, HAIR_RAMP } from '../epidermis/hair-depict.js';
import { readDermis, hairMeanOf, hairColourOf as hairColourOfDermis, linHex, GREY_HAIR as GREY } from '../epidermis/dermal-map.js';
import { growEpidermis, readEpidermis } from '../epidermis/epidermis.js';

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
  const head = relationalHead({ sex, tune: fit.tune ?? HEAD_TUNES[sex], ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}) });
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

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
/**
 * CARDS as one pinned part: each card { pts (chart metres), side? (its across, per point; absent, square to the card and
 * to its way out from `centre`), width (m, a number or per point), group } a thin closed slab of CARD.points stations
 * along it, its corners a thickness apart about its middle, mapped by `toHero` and held in the pin's frame.
 */
function slabPart(frame, toHero, cards, pin, group, centre = [0, 0, 0], points = CARD.points) {
  const offsets = {}, faces = {}, groups = {};
  let nv = 0, nf = 0;
  const put = (p) => { const id = `v${nv++}`; offsets[id] = surfaceLocalOffset(frame, toHero(p)).map(r6); return id; };
  const face = (a, b, c, g) => { const id = `f${nf++}`; faces[id] = [a, b, c]; if (g !== group) groups[id] = g; };
  for (const c of cards) {
    const N = c.pts.length - 1; if (N < 1) continue;
    const M = Math.min(points, N), idx = Array.from({ length: M + 1 }, (_, i) => Math.round((i * N) / M)), g = c.group ?? group;
    const ring = idx.map((j) => {
      const p = c.pts[j], t = unit3(sub3(c.pts[Math.min(N, j + 1)], c.pts[Math.max(0, j - 1)]));
      const sd = unit3(c.side ? c.side[j] : cross3(t, sub3(p, centre))), n = unit3(cross3(t, sd)), w = (Array.isArray(c.width) ? c.width[j] : c.width) / 2, h = CARD.thick / 2;
      return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => put([0, 1, 2].map((q) => p[q] + sd[q] * w * a + n[q] * h * b)));
    });
    for (let i = 0; i < M; i++) for (let e = 0; e < 4; e++) { const a = ring[i][e], b = ring[i][(e + 1) % 4], c2 = ring[i + 1][(e + 1) % 4], d = ring[i + 1][e]; face(a, d, c2, g); face(a, c2, b, g); }
    // (closed at both ends)
    face(ring[0][0], ring[0][1], ring[0][2], g); face(ring[0][0], ring[0][2], ring[0][3], g);
    face(ring[M][0], ring[M][2], ring[M][1], g); face(ring[M][0], ring[M][3], ring[M][2], g);
  }
  return { layer: 2, closure: 'closed', pin, group, offsets, faces, ...(Object.keys(groups).length ? { groups } : {}) };
}
/**
 * A MESH (epidermis/hair-depict.js's, the chart's frame) as one pinned part: its points mapped by `toHero` and held in the
 * pin's frame, its faces' groups where they differ from the part's; an open mesh lists its boundary (every edge one face
 * uses), as the audit wants of an open part.
 */
function pinMesh(frame, toHero, M, pin, group) {
  const offsets = {}, faces = {}, groups = {};
  M.vertices.forEach((p, i) => { offsets[`v${i}`] = surfaceLocalOffset(frame, toHero(p)).map(r6); });
  M.faces.forEach((f, i) => { faces[`f${i}`] = f.map((v) => `v${v}`); if (M.groups[i] !== group) groups[`f${i}`] = M.groups[i]; });
  let boundary = null;
  if (M.closure === 'open') {
    const count = new Map();
    for (const f of M.faces) for (let e = 0; e < 3; e++) { const a = f[e], b = f[(e + 1) % 3], kk = a < b ? `${a}|${b}` : `${b}|${a}`; count.set(kk, (count.get(kk) || 0) + 1); }
    boundary = [...count].filter(([, n]) => n === 1).map(([kk]) => kk.split('|').map((v) => `v${v}`));
  }
  return { layer: 2, closure: M.closure, pin, group, offsets, faces, ...(boundary ? { boundary } : {}), ...(Object.keys(groups).length ? { groups } : {}) };
}
/** the beard's: one colour, its own */
const BEARD_BANDS = Object.freeze([[0.4, 'BeardRoot'], [1.01, 'Beard']]);
/** the beard's rung for the scalp's: one finer */
const BEARD_RUNG = Object.freeze({ L2: 'L2', L1: 'L2', L0: 'L1' });
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
export function heroHair(recipe, dermis, scalp, { level = 'L1' } = {}) {
  const fit = recipe.headFit;
  if (!fit || !scalp || !recipe.parts.visage) return { parts: {}, palette: {}, counts: null };
  const { sex, k, ty, men, relations, eyes } = fit, D = readDermis(dermis), S = readScalp(scalp);
  const head = relationalHead({ sex, tune: fit.tune ?? HEAD_TUNES[sex], ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}) });
  // THE GRASS HAT: the scalp a lawn of blades, combed, cut and hung, its coat under them (epidermis/hair-depict.js)
  const centre = [0, head.landmarks.eyeR.y * STAND_M * 0.3, head.landmarks.eyeR.z * STAND_M];
  const { blades, strips, cap, counts } = depictHair(relationalHeadChart(head, { cells: CELLS }), D, S, { level, centre });
  if (!strips && !cap) return { parts: {}, palette: {}, counts };
  const sc = k / STAND_M, toHero = (q) => [q[0] * sc, q[1] * sc + ty, q[2] * sc + men];
  const visage = recipe.parts.visage, compiled = compileLayered({ parts: { visage }, dials: {}, creases: {} }).parts.visage;
  const pin = visagePin(visage, compiled, 'head', [head.landmarks.n.x * k, head.landmarks.n.y * k + ty, head.landmarks.n.z * k + men]);
  if (!pin) return { parts: {}, palette: {}, counts };
  const frame = pinFrame(compiled, pin);
  const streaked = blades.find((b) => b.streak && !b.streak.grey)?.streak.colour ?? null;
  const c = hairMeanOf(D), palette = { ...Object.fromEntries(Object.entries(HAIR_RAMP).map(([g, k]) => [g, linHex(c.map((v) => Math.min(1, v * k + 0.003 * (k - 1))))])), ...(streaked ? { HairStreak: linHex(streaked) } : {}) };
  return { parts: { ...(strips ? { hair: pinMesh(frame, toHero, strips, pin, 'HairRoot') } : {}), ...(cap ? { hairCap: pinMesh(frame, toHero, cap, pin, 'HairRoot') } : {}) }, palette, counts: { ...counts, level, blades: blades.length } };
}

/** the face's hair cards' clump (m, the beard's locks gathered to one card a cell) and the brows' and lashes' widths (m) */
const FACE_CARD = Object.freeze({ cell: 0.004, beardWidth: 1.9, beardStations: 3, coatMin: 3, browCell: 0.0025, brow: 0.0012, browPoints: 3, lash: 0.0002, lashPoints: 3 });
/** strands gathered to one card a cell of `cell` (m) by their roots, the card the strand nearest the cell's middle */
function clumps(strands, cell) {
  const cells = new Map();
  for (const st of strands) { const key = st.pts[0].map((v) => Math.floor(v / cell)).join(','); (cells.get(key) || cells.set(key, []).get(key)).push(st); }
  return [...cells.values()].map((g) => { const m = [0, 1, 2].map((q) => g.reduce((a, st) => a + st.pts[0][q], 0) / g.length); return g.reduce((a, b) => (Math.hypot(...sub3(b.pts[0], m)) < Math.hypot(...sub3(a.pts[0], m)) ? b : a)); });
}
/**
 * THE FACE'S HAIR on the realistic hero: a styled BEARD (dermal-map.js `beardStyle` with locks: dermal-hair.js
 * growBodyHair's beard locks, gathered to one lock a FACE_CARD.cell, the lock nearest the cell's middle, worn as the grass
 * hat's tufts are: dermal-hair.js grassHat; stubble stays the skin's paint), its locks under the lip line riding the jaw (`hairBeardJaw`), the moustache and the
 * cheeks' above it the head (`hairBeard`); the BROWS and the LASHES (epidermis.js, `epidermis` its spec) a thin card a hair
 * (`hairBrows`, `hairLashes`). `Beard` the hair's colour, its grey a third again; `Brow` its colour with less grey;
 * `Lash` darker. `type` the scalp's hair type (the beard curls by it). Deterministic.
 */
export function heroFaceHair(recipe, dermis, { type = 'straight', epidermis = null, level = 'L1' } = {}) {
  const fit = recipe.headFit;
  if (!fit || !recipe.parts.visage) return { parts: {}, palette: {} };
  const { sex, k, ty, men, relations, eyes } = fit, D = readDermis(dermis);
  const head = relationalHead({ sex, tune: fit.tune ?? HEAD_TUNES[sex], ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}) });
  const sc = k / STAND_M, toHero = (q) => [q[0] * sc, q[1] * sc + ty, q[2] * sc + men], L = head.landmarks, at = (p) => [p.x * k, p.y * k + ty, p.z * k + men];
  const visage = recipe.parts.visage, compiled = compileLayered({ parts: { visage }, dials: {}, creases: {} }).parts.visage;
  const centre = [0, L.eyeR.y * STAND_M * 0.3, L.eyeR.z * STAND_M], parts = {}, palette = {};
  const mean = (g) => { const c = hairColourOfDermis(D); return linHex(c.map((v, i) => v + (GREY[i] - v) * Math.min(1, (D.grey ?? 0) * g))); };
  // the BEARD's locks, a card a cell, split at the lip line
  if (D.beardStyle) {
    const bchart = relationalHeadChart(head, { cells: CELLS }), B = growBodyHair(bchart, D, { share: 1, tracts: ['beard'], type });
    const lip = L.stomion.z * STAND_M - 0.002, cards = { head: [], jaw: [] };
    // (the beard a lawn as the scalp is: a wedge a cell, along the lock rooted nearest its middle)
    // (on the hat's ladder: a rung's cell the wider by 1/√keep, so its wedges as much wider; the outline's three cells)
    // (a beard is small and costs little: a rung finer than the scalp's)
    const R = HAIR_LADDER[BEARD_RUNG[level] ?? 'L2'], cell = R.guides ? FACE_CARD.cell * 3 : FACE_CARD.cell / Math.sqrt(R.keep);
    for (const st of clumps(B.strands.filter((x) => x.ribbon && x.pts.length > 1), cell)) cards[st.pts[0][2] < lip ? 'jaw' : 'head'].push(bladeOf(st, cell * FACE_CARD.beardWidth, FACE_CARD.beardStations, R.turn));
    for (const [bone, name, near] of [['head', 'hairBeard', at(L.n)], ['jaw', 'hairBeardJaw', at(L.pg)]]) {
      if (!cards[bone].length) continue;
      const pin = visagePin(visage, compiled, bone, near); if (!pin) continue;
      parts[name] = pinMesh(pinFrame(compiled, pin), toHero, stripMesh(cards[bone], BEARD_BANDS, { centre }), pin, 'BeardRoot');
    }
    // (the beard's coat under it, as the scalp's: where the style grows locks, the skin painted the beard's root; split
    // at the lip line as the beard is, the chin's riding the jaw)
    for (const [bone, name, near, where] of [['head', 'hairBeardCoat', at(L.n), (p) => p[2] >= lip], ['jaw', 'hairBeardCoatJaw', at(L.pg), (p) => p[2] < lip]]) {
      const cp = visagePin(visage, compiled, bone, near); if (!cp) continue;
      const coat = capMesh(bchart, D, { tract: 'beard', group: 'BeardRoot', min: FACE_CARD.coatMin, where });
      if (coat) parts[name] = pinMesh(pinFrame(compiled, cp), toHero, coat, cp, 'BeardRoot');
    }
    if (parts.hairBeard || parts.hairBeardJaw) { palette.Beard = mean(1.3); palette.BeardRoot = linHex(hairColourOfDermis(D).map((v) => v * 0.6)); }
  }
  // the BROWS and the LASHES, a card a hair (the epidermis's strands, in the head's own units)
  if (epidermis) {
    const E = growEpidermis(head, readEpidermis(epidermis)), M = (p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M];
    // (the brows gathered a few hairs to a card, as the beard's locks are; the lashes a card each, they are few)
    const brows = clumps(E.strands.filter((st) => st.groom === 'brow').map((st) => ({ pts: st.pts.map(M) })), FACE_CARD.browCell).map((st) => ({ pts: st.pts, width: FACE_CARD.brow, group: 'Brow' }));
    const lashes = E.strands.filter((st) => /^lash/.test(st.groom)).map((st) => ({ pts: st.pts.map(M), width: FACE_CARD.lash, group: 'Lash' }));
    const pin = visagePin(visage, compiled, 'head', at(L.n));
    if (pin) {
      const frame = pinFrame(compiled, pin);
      if (brows.length) { parts.hairBrows = slabPart(frame, toHero, brows, pin, 'Brow', centre, FACE_CARD.browPoints); palette.Brow = mean(0.7); }
      if (lashes.length) { parts.hairLashes = slabPart(frame, toHero, lashes, pin, 'Lash', centre, FACE_CARD.lashPoints); palette.Lash = linHex(hairColourOfDermis(D).map((v) => v * 0.55)); }
    }
  }
  return { parts, palette };
}
