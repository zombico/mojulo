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
import { streamOf } from '../city/plan/dice.js';
import { simplifyMesh } from './skin-net.js';

const r6 = (v) => Math.round(v * 1e6) / 1e6;
/** the sites through the lower lip: they ride the jaw */
const JAW_SITES = new Set(['labret', 'lip-ring']);
/** the chart the piercings are placed on (its cells: the ear's samples for the ear's sites; the face's settle on the field) */
const CELLS = 60;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
/** a piece's group: its gem's, else its metal's (a hex metal its own word) */
export const jewelGroupOf = (name, metal) => (metal ? `Jewel${JEWEL_METALS[name] ? cap(name) : name.replace('#', '')}` : `Gem${JEWEL_GEMS[name] ? cap(name) : name.replace('#', '')}`);

/** the part the head's layers ride: the ONE SKIN (hero-one-skin.js, realistic laws 2), else the visage → [name, part] */
const faceSkinOf = (recipe) => (recipe.parts.headSkin ? ['headSkin', recipe.parts.headSkin] : recipe.parts.visage ? ['visage', recipe.parts.visage] : [null, null]);
/** the face skin's face the bone `bone` alone carries nearest `near` (hero frame): its pin, its point ids' centroid */
function visagePin(visage, compiled, bone, near, parent = 'visage') {
  const blend = visage.bind?.blend || {}, only = (pid) => { const b = blend[pid.slice(pid.indexOf('/') + 1)] ?? { head: 1 }; return (b[bone] ?? 0) >= 0.999; };
  let best = null, bd = Infinity;
  for (const [id, f] of Object.entries(compiled.faces)) {
    if (!f.every(only)) continue;
    const c = [0, 1, 2].map((k) => f.reduce((a, p) => a + compiled.points[p][k], 0) / 3), d = Math.hypot(c[0] - near[0], c[1] - near[1], c[2] - near[2]);
    if (d < bd) { bd = d; best = { parent, face: id, weights: [0.25, 0.25, 0.5], tangentEdge: [f[0], f[1]], handedness: 1 }; }
  }
  return best;
}

/** The piercings (dermal-jewel.js's list) on the realistic hero's head, as pinned parts and their palette. */
export function heroJewellery(recipe, piercings) {
  const fit = recipe.headFit;
  if (!fit || !piercings?.length || !faceSkinOf(recipe)[0]) return { parts: {}, palette: {} };
  const { sex, k, ty, men, relations, eyes } = fit;
  const head = relationalHead({ sex, tune: fit.tune ?? HEAD_TUNES[sex], ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}), ...(fit.seat ? { seat: true } : {}) });
  const J = pierce(relationalHeadChart(head, { cells: CELLS }), head, piercings);
  if (!J.mesh.faces.length) return { parts: {}, palette: {} };
  const s = k / STAND_M, toHero = (q) => [q[0] * s, q[1] * s + ty, q[2] * s + men];
  const [skinName, visage] = faceSkinOf(recipe), compiled = compileLayered({ parts: { [skinName]: visage }, dials: {}, creases: {} }).parts[skinName];
  const L = head.landmarks, at = (p) => [p.x * k, p.y * k + ty, p.z * k + men];
  const groups = J.materials.map((m) => jewelGroupOf(m.name, m.metal)), palette = {};
  J.materials.forEach((m, i) => { palette[groups[i]] = m.metal ? (JEWEL_METALS[m.name] ?? m.name) : (JEWEL_GEMS[m.name] ?? m.name); });
  const parts = {};
  for (const [name, bone, near] of [['jewel', 'head', at(L.n)], ['jewelJaw', 'jaw', at(L.pg)]]) {
    const fis = J.mesh.faces.map((_, fi) => fi).filter((fi) => JAW_SITES.has(J.pieces[J.mesh.piece[fi]].site) === (bone === 'jaw'));
    if (!fis.length) continue;
    const pin = visagePin(visage, compiled, bone, near, skinName);
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
 * A MESH (epidermis/hair-depict.js's, the chart's frame) as one pinned part: its points mapped by `toHero` and held in the
 * pin's frame, its faces' groups where they differ from the part's; an open mesh lists its boundary (every edge one face
 * uses), as the audit wants of an open part.
 */
function pinMesh(frame, toHero, M, pin, group, { volume = null } = {}) {
  const offsets = {}, faces = {}, groups = {};
  M.vertices.forEach((p, i) => { offsets[`v${i}`] = surfaceLocalOffset(frame, toHero(p)).map(r6); });
  M.faces.forEach((f, i) => { faces[`f${i}`] = f.map((v) => `v${v}`); if (M.groups[i] !== group) groups[`f${i}`] = M.groups[i]; });
  let boundary = null;
  if (M.closure === 'open') {
    const count = new Map();
    for (const f of M.faces) for (let e = 0; e < 3; e++) { const a = f[e], b = f[(e + 1) % 3], kk = a < b ? `${a}|${b}` : `${b}|${a}`; count.set(kk, (count.get(kk) || 0) + 1); }
    boundary = [...count].filter(([, n]) => n === 1).map(([kk]) => kk.split('|').map((v) => `v${v}`));
  }
  // (an alpha card's points' places on it, hair-depict.js stripMesh `card`: carried to the compiled mesh's provenance)
  const cardUV = M.uv ? Object.fromEntries(M.uv.map((t, i) => [`v${i}`, t.map(r6)])) : null;
  return { layer: 2, closure: M.closure, pin, group, offsets, faces, ...(boundary ? { boundary } : {}), ...(Object.keys(groups).length ? { groups } : {}), ...(volume ? { volume } : {}), ...(cardUV ? { cardUV } : {}) };
}
/** the beard's: one colour, its own */
const BEARD_BANDS = Object.freeze([[0.4, 'BeardRoot'], [1.01, 'Beard']]);
/** the beard's root and its coat: its colour (the grey in it) darkened by this */
const BEARD_ROOT = 0.7;
/** the hair's parts lit as one volume about the head (station-loft-shade.js volumeNormals: the grass's way) */
const HAIR_VOLUME = Object.freeze({ heart: 'cranium' });
/** the beard's rung for the scalp's: one finer */
const BEARD_RUNG = Object.freeze({ L2: 'L2', L1: 'L2', L0: 'L1' });
/**
 * THE HEAD'S HAIR BUDGET by the rung (realistic laws 2, with the one skin: `budget`): the coats under the scalp's blades
 * and the beard's simplified to at most `coat` and `beardCoat` faces (skin-net.js simplifyMesh: smooth shells, their
 * chart's every cell is more than they need), the beard on the scalp's own rung (not one finer: a beard's locks cost
 * more than the scalp's blades at every rung), the brows' blades `browStations` long, every `browEvery`th hair kept and
 * twinned only where `browTwin`, `browWiden` the wider. Without `budget`, each as it was.
 */
export const HEAD_BUDGET = Object.freeze({
  L2: Object.freeze({ coat: 6000, beardCoat: 2000, browStations: 3, browEvery: 1, browTwin: true, browWiden: 1 }),
  L1: Object.freeze({ coat: 3000, beardCoat: 1200, browStations: 2, browEvery: 1, browTwin: true, browWiden: 1 }),
  L0: Object.freeze({ coat: 1500, beardCoat: 600, browStations: 2, browEvery: 3, browTwin: false, browWiden: 2 }),
});
/** a closed coat (hair-depict.js capMesh) simplified to at most `n` faces, its group as it was */
function leanCoat(M, n) {
  if (!M || !n || M.faces.length <= n) return M;
  const S = simplifyMesh(M.vertices, M.faces, { target: n, turn: 0.5 });
  return { vertices: S.V, faces: S.F, groups: S.F.map(() => M.groups[0]), closure: M.closure };
}
/** an open strip mesh (hair-depict.js stripMesh) without the faces that have no area (a blade's segment of no length) */
function solidStrips(M) {
  if (!M) return M;
  const keep = M.faces.map((t) => { const [a, b, c] = t.map((v) => M.vertices[v]); return Math.hypot(...cross3(sub3(b, a), sub3(c, a))) > 1e-12; });
  return { ...M, faces: M.faces.filter((_, i) => keep[i]), groups: M.groups.filter((_, i) => keep[i]) };
}
/** the hair lit as one volume about the skin it rides: the one skin's, else the cranium's */
const volumeOf = (skinName) => (skinName === 'headSkin' ? { heart: 'headSkin' } : HAIR_VOLUME);
/**
 * The SCALP on the realistic hero: the groom (dermal-hair.js `readScalp`'s: a style word or its document, the cut, the
 * ties, the streaks) grown on the face's head as the grass hat (epidermis/hair-depict.js depictHair: its blades at the
 * rung `level` and the coat under them), mapped into the hero's frame and pinned to the visage where the head alone
 * carries it, lit as one volume. Its bands the hair's colour as the eye averages it (its grey mixed in: dermal-map.js
 * `hairMeanOf`) down HAIR_RAMP, a streak's blades `HairStreak` in the dye. A buzz (under 2 cm, lying on the scalp) is
 * the coat alone. `dermis` the hero's (its colour, its
 * hairline and loss). Deterministic.
 */
export function heroHair(recipe, dermis, scalp, { level = 'L1', budget = false, cards = false } = {}) {
  const fit = recipe.headFit;
  if (!fit || !scalp || !faceSkinOf(recipe)[0]) return { parts: {}, palette: {}, counts: null };
  const { sex, k, ty, men, relations, eyes } = fit, D = readDermis(dermis), S = readScalp(scalp);
  const head = relationalHead({ sex, tune: fit.tune ?? HEAD_TUNES[sex], ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}), ...(fit.seat ? { seat: true } : {}) });
  // THE GRASS HAT: the scalp a lawn of blades, combed, cut and hung, its coat under them (epidermis/hair-depict.js)
  const centre = [0, head.landmarks.eyeR.y * STAND_M * 0.3, head.landmarks.eyeR.z * STAND_M];
  // (`cards`, realistic laws 7: the blades as alpha cards, each point's place on its card kept for the strand texture)
  const { blades, strips: strips0, cap: cap0, counts } = depictHair(relationalHeadChart(head, { cells: CELLS }), D, S, { level, centre, cards });
  // (on the budget: the coat simplified, and the strips' faces without area let go, a blade's segment of no length)
  const cap = budget ? leanCoat(cap0, HEAD_BUDGET[level]?.coat) : cap0, strips = budget ? solidStrips(strips0) : strips0;
  if (!strips && !cap) return { parts: {}, palette: {}, counts };
  const sc = k / STAND_M, toHero = (q) => [q[0] * sc, q[1] * sc + ty, q[2] * sc + men];
  const [skinName, visage] = faceSkinOf(recipe), compiled = compileLayered({ parts: { [skinName]: visage }, dials: {}, creases: {} }).parts[skinName];
  const pin = visagePin(visage, compiled, 'head', [head.landmarks.n.x * k, head.landmarks.n.y * k + ty, head.landmarks.n.z * k + men], skinName);
  if (!pin) return { parts: {}, palette: {}, counts };
  const frame = pinFrame(compiled, pin);
  const streaked = blades.find((b) => b.streak && !b.streak.grey)?.streak.colour ?? null;
  const c = hairMeanOf(D), palette = { ...Object.fromEntries(Object.entries(HAIR_RAMP).map(([g, k]) => [g, linHex(c.map((v) => Math.min(1, v * k + 0.003 * (k - 1))))])), ...(streaked ? { HairStreak: linHex(streaked) } : {}) };
  const volume = volumeOf(skinName);
  return { parts: { ...(strips ? { hair: pinMesh(frame, toHero, strips, pin, 'HairRoot', { volume }) } : {}), ...(cap ? { hairCap: pinMesh(frame, toHero, cap, pin, 'HairRoot', { volume }) } : {}) }, palette, counts: { ...counts, level, blades: blades.length } };
}

/** the face's hair cards' clump (m, the beard's locks gathered to one card a cell) and the brows' and lashes' widths (m) */
const FACE_CARD = Object.freeze({ cell: 0.004, beardWidth: 1.9, beardStations: 3, coatMin: 3, lash: 0.0003, lashStations: 2 });
/**
 * THE BROWS as a fine lawn: every brow hair its own blade (no gathering), `width` at its root to a point over `stations`
 * spans, and once REPEATED (`twin`: a copy `side` across from it, `lift` off the skin and `short` of its length, by a seeded
 * die's side), so the brow reads full where the hairs alone would read sparse; its root `root` of the brow's colour (the
 * hair's ramp), lit as the scalp is, as one volume. A blade is ~3 faces where a card's box was ~20.
 */
export const BROW_BLADE = Object.freeze({ width: 0.0005, stations: 3, turn: 12, twin: { side: 0.0003, lift: 0.00012, short: 0.85 }, root: 0.7 });
const BROW_BANDS = Object.freeze([[0.4, 'BrowRoot'], [1.01, 'Brow']]);
/** a brow hair's twin, a little across from it and off the skin, shorter (see BROW_BLADE) */
function browTwin(st, centre, die) {
  const P = st.pts, n = P.length - 1, T = BROW_BLADE.twin;
  const out = unit3(sub3(P[0], centre)), side = unit3(cross3(unit3(sub3(P[n], P[0])), out)), s = (die() < 0.5 ? -1 : 1) * T.side * (0.6 + 0.8 * die());
  const pts = P.map((p, i) => [0, 1, 2].map((q) => P[0][q] + (p[q] - P[0][q]) * T.short + side[q] * s + out[q] * T.lift));
  return { pts: pts.slice(0, Math.max(2, pts.length)) };
}
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
 * `Lash` darker. `type` the scalp's hair type (the beard curls by it). `cards` (realistic laws 7) the beard's locks as alpha
 * cards on the strand texture, as the scalp's are. Deterministic.
 */
export function heroFaceHair(recipe, dermis, { type = 'straight', epidermis = null, level = 'L1', budget = false, cards: asCards = false } = {}) {
  const fit = recipe.headFit;
  if (!fit || !faceSkinOf(recipe)[0]) return { parts: {}, palette: {} };
  const { sex, k, ty, men, relations, eyes } = fit, D = readDermis(dermis);
  const head = relationalHead({ sex, tune: fit.tune ?? HEAD_TUNES[sex], ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}), ...(fit.seat ? { seat: true } : {}) });
  const sc = k / STAND_M, toHero = (q) => [q[0] * sc, q[1] * sc + ty, q[2] * sc + men], L = head.landmarks, at = (p) => [p.x * k, p.y * k + ty, p.z * k + men];
  const [skinName, visage] = faceSkinOf(recipe), compiled = compileLayered({ parts: { [skinName]: visage }, dials: {}, creases: {} }).parts[skinName];
  const centre = [0, L.eyeR.y * STAND_M * 0.3, L.eyeR.z * STAND_M], parts = {}, palette = {}, volume = volumeOf(skinName), Bg = budget ? HEAD_BUDGET[level] ?? HEAD_BUDGET.L1 : null;
  const greyed = (g) => { const c = hairColourOfDermis(D); return c.map((v, i) => v + (GREY[i] - v) * Math.min(1, (D.grey ?? 0) * g)); }, mean = (g) => linHex(greyed(g));
  // the BEARD's locks, a card a cell, split at the lip line
  if (D.beardStyle) {
    const bchart = relationalHeadChart(head, { cells: CELLS }), B = growBodyHair(bchart, D, { share: 1, tracts: ['beard'], type });
    const lip = L.stomion.z * STAND_M - 0.002, cards = { head: [], jaw: [] };
    // (the beard a lawn as the scalp is: a wedge a cell, along the lock rooted nearest its middle)
    // (on the hat's ladder: a rung's cell the wider by 1/√keep, so its wedges as much wider; the outline's three cells)
    // (a beard is small and costs little: a rung finer than the scalp's)
    const R = HAIR_LADDER[(Bg ? level : BEARD_RUNG[level]) ?? 'L2'], cell = R.guides ? FACE_CARD.cell * 3 : FACE_CARD.cell / Math.sqrt(R.keep);
    for (const st of clumps(B.strands.filter((x) => x.ribbon && x.pts.length > 1), cell)) cards[st.pts[0][2] < lip ? 'jaw' : 'head'].push(bladeOf(st, cell * FACE_CARD.beardWidth, FACE_CARD.beardStations, R.turn));
    for (const [bone, name, near] of [['head', 'hairBeard', at(L.n)], ['jaw', 'hairBeardJaw', at(L.pg)]]) {
      if (!cards[bone].length) continue;
      const pin = visagePin(visage, compiled, bone, near, skinName); if (!pin) continue;
      parts[name] = pinMesh(pinFrame(compiled, pin), toHero, stripMesh(cards[bone], BEARD_BANDS, { centre, card: asCards }), pin, 'BeardRoot', { volume });
    }
    // (the beard's coat under it, as the scalp's: where the style grows locks, the skin painted the beard's root; split
    // at the lip line as the beard is, the chin's riding the jaw)
    for (const [bone, name, near, where] of [['head', 'hairBeardCoat', at(L.n), (p) => p[2] >= lip], ['jaw', 'hairBeardCoatJaw', at(L.pg), (p) => p[2] < lip]]) {
      const cp = visagePin(visage, compiled, bone, near, skinName); if (!cp) continue;
      const coat0 = capMesh(bchart, D, { tract: 'beard', group: 'BeardRoot', min: FACE_CARD.coatMin, where }), coat = Bg ? leanCoat(coat0, Bg.beardCoat) : coat0;
      if (coat) parts[name] = pinMesh(pinFrame(compiled, cp), toHero, coat, cp, 'BeardRoot', { volume });
    }
    // (the root the tip's colour darkened, its grey and all: a greying beard greys at the root too, never grey flecks on black)
    if (parts.hairBeard || parts.hairBeardJaw) { palette.Beard = mean(1.3); palette.BeardRoot = linHex(greyed(1.3).map((v) => v * BEARD_ROOT)); }
  }
  // the BROWS and the LASHES, a card a hair (the epidermis's strands, in the head's own units)
  if (epidermis) {
    const E = growEpidermis(head, readEpidermis(epidermis)), M = (p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M];
    // (the brows a blade a hair and its twin, BROW_BLADE; the lashes a fine blade each)
    const all = E.strands.filter((st) => st.groom === 'brow' && st.pts.length > 1).map((st) => ({ pts: st.pts.map(M) }));
    const die = streamOf(D.seed ?? 1, 'hero-brow-twin', 'brows'), B = BROW_BLADE;
    // (on the budget's rung: every `browEvery`th hair, twinned or not, its blade the shorter and the wider)
    const hairs = Bg ? all.filter((_, i) => i % Bg.browEvery === 0) : all, twins = !Bg || Bg.browTwin ? hairs.map((st) => browTwin(st, centre, die)) : [];
    const brows = [...hairs, ...twins].map((st) => bladeOf(st, B.width * (Bg?.browWiden ?? 1), Bg?.browStations ?? B.stations, B.turn));
    const lashes = E.strands.filter((st) => /^lash/.test(st.groom) && st.pts.length > 1).map((st) => bladeOf({ pts: st.pts.map(M) }, FACE_CARD.lash, FACE_CARD.lashStations, 20));
    const pin = visagePin(visage, compiled, 'head', at(L.n), skinName);
    if (pin) {
      const frame = pinFrame(compiled, pin);
      if (brows.length) { parts.hairBrows = pinMesh(frame, toHero, stripMesh(brows, BROW_BANDS, { centre }), pin, 'BrowRoot', { volume }); palette.Brow = mean(0.7); palette.BrowRoot = linHex(greyed(0.7).map((v) => v * B.root)); }
      if (lashes.length) { parts.hairLashes = pinMesh(frame, toHero, stripMesh(lashes, [[1.01, 'Lash']], { centre }), pin, 'Lash'); palette.Lash = linHex(hairColourOfDermis(D).map((v) => v * 0.55)); }
    }
  }
  return { parts, palette };
}
