/**
 * face-paint-rig — the PAINTED FACE IN MOTION: the painterly anime hero's eyes, brows and mouth (paint, face-paint.js)
 * drawn per state and swapped by morph targets, the way anime-face-rig moves the slab face's.
 *
 *   • STATES, EACH A DRAWING: an eye at each knot it is drawn at (anime-face-rig faceKnots: EYE_KNOTS and the hero's own
 *     closure); a brow at each brow value a word, the authored face or a clip key draws, shut or not where the shut eye
 *     lifts it; the mouth at each (smile, open) they draw. Each state is a head build at that expression (humanoid-plan
 *     `animeHeadAt`, the face part alone), its feature layers painted.
 *   • THE ATLAS (face-paint.js faceAtlas): the authored face (the row's own layers, 512²), and per region and state a
 *     TILE — the state's layers painted over the region's window — and a white tile. Every picture takes its blush from
 *     the open eyes, so a tile meets the face round it texel for texel.
 *   • THE SHELLS: the painted face's triangles over a region (its UVs meeting the region's box) become that region's
 *     shells, a copy per state with its UVs in that state's tile. The neutral state's copy (every channel 0) stands in
 *     place; every other copy is collapsed to a point inside the head (`hidden`). One morph target per non-neutral state
 *     opens its copy and collapses the neutral one: `blinkDrawn<k><L|R>`, `browDrawn<i><L|R>`, `mouthDrawn<i>`. A face
 *     state's weights are 0 or 1 (`weigh`): drawings, never tweens. Left is mesh −x, the figure's left.
 *   • GUARDS: the build at the hero's own expression must paint the layers the row stores, else the face is skipped with
 *     its reason (a row stored by older head code).
 * paintFaceRig(m, mesh, paint) → null (no painted anime head) | { skipped } | { targets, authored, meta, K, pack }:
 * `meta` what the GLB carries (anime-face-rig's shape), `K` the knots with `weigh` (anime-face-tracks draws the clips'
 * tracks through it), `pack` what station-loft-rig packs (the atlas, the shells, the UV maps). Pure and deterministic.
 */
import { animeHeadAt } from './humanoid-plan.js';
import { faceRigOptions, faceKnots, faceState, drawEye, FACE_FPS } from './anime-face-rig.js';
import { ANIME_POSES, resolveAnimeExpression } from './anime-head.js';
import { heroClipFaces } from './hero-gesture.js';
import { faceAtlas, facePaintDense, FACE_PAINT_SIZE, TILE_PAD } from './face-paint.js';
import { NOSE_DEFAULTS } from './anime-nose.js';
import { heroTarget } from '../era/cast-light.js';

const Q = 4096, SIZE = FACE_PAINT_SIZE;
/** the eye's painted kinds; the brow's; the mouth's ('ink' above the eye's white is a studio brow's stroke) */
const EYE_KINDS = new Set(['sclera', 'iris', 'pupil', 'catch', 'ink', 'lid']);
/** a region's box past its states' paint (texels), so the shells take every triangle the drawings touch */
const REGION_PAD = 3;
const STALE = 'the stored painted face is not the face this hero paints now: regenerate the row (any /hero edit)';
/** a closure's tag: its decimals, two at least (0.1 → 10, 0.12 → 12, 0.5 → 50), and shut (1) → 100 */
const knotTag = (k) => (k >= 1 ? '100' : String(Math.round(k * 1e4)).padStart(4, '0').replace(/0+$/, '').padEnd(2, '0'));
const r3 = (x) => Math.round(x * 1000) / 1000;

/** the head-shaping words, with the painted face's own (as layered.js plans it) */
export function paintRigOptions(hero) {
  const { opts, authored } = faceRigOptions(hero);
  return { opts: { ...opts, facePaint: { dense: facePaintDense(heroTarget(hero)), nose: { ...NOSE_DEFAULTS, ...(hero.painterly?.nose ?? {}) } } }, authored };
}

/** every face a hero draws: each word's, the authored one, each clip key's (heroClipFaces), as face states */
function drawnFaces(hero, clips, authored) {
  const out = [...Object.keys(ANIME_POSES).map((w) => resolveAnimeExpression(w)), authored];
  for (const keys of Object.values(heroClipFaces(hero, clips))) for (const f of keys) if (f) out.push(f);
  return out.map(faceState);
}

/** a layer list's triangles of `keep(kind, [s, t] centroid)`, flattened: [s0, t0, s1, t1, s2, t2, …] (Q units) */
const trisOf = (layers, keep) => layers.flatMap((l) => {
  const out = [];
  for (let i = 0; i + 5 < l.tris.length; i += 6) { const c = [(l.tris[i] + l.tris[i + 2] + l.tris[i + 4]) / 3, (l.tris[i + 1] + l.tris[i + 3] + l.tris[i + 5]) / 3]; if (keep(l.kind, c)) out.push(...l.tris.slice(i, i + 6)); }
  return out;
});
const boxOf = (tris, box = null) => { for (let i = 0; i + 1 < tris.length; i += 2) { const s = tris[i], t = tris[i + 1]; box = box ? [Math.min(box[0], s), Math.min(box[1], t), Math.max(box[2], s), Math.max(box[3], t)] : [s, t, s, t]; } return box; };

export function paintFaceRig(m, mesh, paint) {
  const hero = m?.hero, face = m?.recipe?.parts?.face?.paint;
  if (!hero || hero.head !== 'anime' || !hero.painterly || !face?.layers || !paint) return null;
  const { opts, authored } = paintRigOptions(hero);
  const builds = new Map();
  const layersAt = (E) => { const k = JSON.stringify(E); let L = builds.get(k); if (!L) builds.set(k, L = animeHeadAt(opts, E, ['face']).face?.paint?.layers ?? []); return L; };
  // the row paints the face this hero builds now
  if (JSON.stringify(layersAt(authored)) !== JSON.stringify(face.layers)) return { skipped: STALE };
  const K0 = faceKnots(authored), neutral = layersAt({});
  // the sides: a texture half is mesh −x (Left) or +x, read off the mesh
  const sideX = (() => { const P = m.recipe.parts.face.paint; const [vid, st] = Object.entries(P.uv).find(([, t]) => t[0] < 0.4) ?? []; const vi = vid ? mesh.pointIds?.indexOf(`face/${vid}`) : -1; return vi >= 0 && mesh.vertices[vi][0] > 0 ? 1 : -1; })();
  const sideOf = (s) => ((s < Q / 2 ? sideX : -sideX) < 0 ? 'L' : 'R');
  // a stroke of 'ink' above the neutral white is a brow (the studio's brow is drawn in ink)
  const white = boxOf(trisOf(neutral, (k) => k === 'sclera')), browLine = white ? white[3] + 0.02 * Q : Infinity;
  const isEye = (k, c) => EYE_KINDS.has(k) && !(k === 'ink' && c[1] > browLine), isBrow = (k, c) => k === 'brow' || (k === 'ink' && c[1] > browLine);

  // the drawings each region needs
  const F = drawnFaces(hero, m.recipe.clips, authored), uniq = (xs) => [...new Map(xs.map((x) => [JSON.stringify(x), x])).values()];
  const mouths = uniq([[0, 0], ...F.map((f) => [r3(f.smile), r3(f.open)])]), brows = uniq([0, ...F.map((f) => r3(f.brow))]);
  const regions = [];
  for (const side of ['L', 'R']) regions.push({ name: `eye${side}`, keep: (k, c) => isEye(k, c) && sideOf(c[0]) === side, states: K0.eyeKnots.map((k) => ({ key: k, E: k ? { blink: k } : {}, target: k ? `blinkDrawn${knotTag(k)}${side}` : null })) });
  for (const side of ['L', 'R']) {
    const keep = (k, c) => isBrow(k, c) && sideOf(c[0]) === side, states = [];
    for (const b of brows) for (const shut of [false, true]) {
      const E = { ...(b ? { brow: b } : {}), ...(shut ? { blink: 1 } : {}) };
      // a shut eye's brow is a drawing of its own only where it differs (the sculpt's shutLift)
      if (shut && JSON.stringify(trisOf(layersAt(E), keep)) === JSON.stringify(trisOf(layersAt(b ? { brow: b } : {}), keep))) continue;
      states.push({ key: [b, shut], E, target: b || shut ? `browDrawn${states.length}${side}` : null });
    }
    regions.push({ name: `brow${side}`, keep, states });
  }
  regions.push({ name: 'mouth', keep: (k) => k === 'mouth', states: mouths.map(([s, o], i) => ({ key: [s, o], E: { ...(s ? { smile: s } : {}), ...(o ? { open: o } : {}) }, target: s || o ? `mouthDrawn${i}` : null })) });
  // each region's box: every one of its drawings, padded (Q units)
  for (const R of regions) {
    let b = null; for (const st of R.states) b = boxOf(trisOf(layersAt(st.E), R.keep), b);
    R.box = b && [b[0] - REGION_PAD / SIZE * Q, b[1] - REGION_PAD / SIZE * Q, b[2] + REGION_PAD / SIZE * Q, b[3] + REGION_PAD / SIZE * Q];
  }
  const live = regions.filter((R) => R.box && R.states.length > 1);

  // the shells: each painted face whose UVs meet regions' boxes. The faces meeting the same regions are a GROUP: most meet
  // one region; a face under an eye and its brow both is the pair's, its drawings the pairs (eye × brow)
  const uvOf = (vi) => paint.uvAt({ vi }), groups = new Map();
  mesh.faces.forEach((tri, fi) => {
    if (!paint.painted(fi)) return;
    const T = tri.map(uvOf), s0 = Math.min(...T.map((t) => t[0])) * Q, s1 = Math.max(...T.map((t) => t[0])) * Q, t0 = Math.min(...T.map((t) => t[1])) * Q, t1 = Math.max(...T.map((t) => t[1])) * Q;
    const hit = live.flatMap((R, ri) => (s1 >= R.box[0] && s0 <= R.box[2] && t1 >= R.box[1] && t0 <= R.box[3] ? [ri] : []));
    if (!hit.length) return;
    if (hit.length > 2) throw new Error(`face-paint-rig: a painted face under ${hit.map((ri) => live[ri].name).join(', ')} (two regions at most)`);
    const key = hit.join('+'); let G = groups.get(key);
    if (!G) groups.set(key, G = { members: hit, faces: [], box: null });
    G.faces.push(fi); G.box = boxOf([s0, t0, s1, t1], G.box);
  });
  // a drawing's layers over a group: each member region's paint from its drawing's build, the rest the neutral face's
  const KINDS = [...new Set([...neutral.map((l) => l.kind), ...live.flatMap((R) => R.states.flatMap((st) => layersAt(st.E).map((l) => l.kind)))])];
  const compose = (members, picks) => KINDS.map((kind) => {
    const of = (L) => L.find((l) => l.kind === kind), n = of(neutral), keepAny = (c) => members.some((ri) => live[ri].keep(kind, c));
    const tris = [...trisOf(n ? [n] : [], (k, c) => !keepAny(c)), ...members.flatMap((ri, i) => { const l = of(layersAt(live[ri].states[picks[i]].E)); return l ? trisOf([l], (k, c) => live[ri].keep(k, c)) : []; })];
    return tris.length ? { kind, tris, ...(n?.width !== undefined ? { width: n.width } : {}) } : null;
  }).filter(Boolean);
  // each group's window (texels, y from the top) is its faces' UV box; a tile per drawing (per pair of drawings)
  const tiles = [], G = [...groups.values()];
  for (const g of G) {
    const b = g.box, x0 = Math.floor(b[0] / Q * SIZE), x1 = Math.ceil(b[2] / Q * SIZE), y0 = Math.floor((1 - b[3] / Q) * SIZE), y1 = Math.ceil((1 - b[1] / Q) * SIZE);
    g.rect = [x0, y0, x1 - x0, y1 - y0];
    g.picks = g.members.reduce((acc, ri) => acc.flatMap((p) => live[ri].states.map((_, si) => [...p, si])), [[]]);
    g.tile = g.picks.map((picks) => tiles.push({ layers: compose(g.members, picks), rect: g.rect }) - 1);
  }
  const atlas = faceAtlas({ layers: face.layers }, tiles, m.recipe.palette, { blush: trisOf(neutral, (k) => k === 'sclera') });

  // the targets, in the regions' order; a face state's weights (0 or 1 per target)
  const used = new Set(G.flatMap((g) => g.members)), shells = live.filter((_, ri) => used.has(ri));
  const targets = shells.flatMap((R) => R.states.filter((st) => st.target).map((st) => st.target));
  const stateOf = (R, Fd) => {
    if (R.name.startsWith('eye')) return R.states.findIndex((st) => st.key === Fd[R.name === 'eyeL' ? 'eyeL' : 'eyeR']);
    if (R.name.startsWith('brow')) {
      const shut = Fd[R.name === 'browL' ? 'eyeL' : 'eyeR'] >= 1, b = r3(Fd.brow);
      let best = 0, bd = Infinity; R.states.forEach((st, i) => { const d = Math.abs(st.key[0] - b) + (st.key[1] === shut ? 0 : st.key[1] ? 10 : 0.5); if (d < bd) { bd = d; best = i; } }); return best;
    }
    const s = r3(Fd.smile), o = r3(Fd.open);
    let best = 0, bd = Infinity; R.states.forEach((st, i) => { const d = Math.hypot(st.key[0] - s, st.key[1] - o); if (d < bd) { bd = d; best = i; } }); return best;
  };
  const weigh = (Fs) => { const Fd = { ...Fs, eyeL: drawEye(Fs.eyeL, K0.eyeKnots), eyeR: drawEye(Fs.eyeR, K0.eyeKnots) }, w = Object.fromEntries(targets.map((t) => [t, 0])); for (const R of shells) { const st = R.states[stateOf(R, Fd)]; if (st?.target) w[st.target] = 1; } return targets.map((t) => w[t]); };
  const K = { ...K0, fixKnots: [], targets, weigh };
  const meta = {
    targets: [...targets], weights: weigh(faceState(authored)), fps: FACE_FPS, eyeKnots: [...K0.eyeKnots], fixKnots: [],
    words: Object.fromEntries([...Object.keys(ANIME_POSES).map((w) => [w, weigh(faceState(resolveAnimeExpression(w)))]), ['authored', weigh(faceState(authored))]]),
    about: 'the PAINTED face: its eyes, brows and mouth are drawings on the texture, one copy of the face\'s triangles over each per drawing; POSITION shows the neutral drawings (every channel 0), a target opens its drawing and closes the neutral one, so a region takes one target at weight 1 at most; blinkDrawn<k><L|R> is that eye at closure k (k its decimals, two at least; 100 shut), browDrawn<i><L|R> and mouthDrawn<i> the brow and mouth drawings (drawings.brow: [brow, shut], drawings.mouth: [smile, open]); the default weights are the authored expression',
    drawings: { brow: Object.fromEntries(shells.filter((R) => R.name.startsWith('brow')).flatMap((R) => R.states.filter((s) => s.target).map((s) => [s.target, s.key]))), mouth: Object.fromEntries(shells.filter((R) => R.name === 'mouth').flatMap((R) => R.states.filter((s) => s.target).map((s) => [s.target, s.key]))) },
    pairs: G.filter((g) => g.members.length > 1).map((g) => g.members.map((ri) => live[ri].name).join('+')),
  };

  // what the pack carries: the atlas, each face's group, each group's drawings — its tile's UV map, whether it rests on the
  // face (the neutral one) or at the hidden point, and its targets' weights on (face − hidden). A single region's drawing
  // rests hidden and its target opens it (1); the neutral one rests open and every other target closes it (−1). A pair's
  // drawing takes a half from each of its two targets, so it is open only when both are on; with one, it stands half way
  // to the hidden point, inside the skull (the neutral pair −½ per target; a drawing paired with a neutral +1 from its
  // own and −½ from each of the other region's).
  const toAtlas = (X, Y) => [X / atlas.w, 1 - Y / atlas.h];   // (t up, as the static faces' UVs)
  const baseUV = ([s, t]) => toAtlas(s * SIZE, (1 - t) * SIZE);
  const tIndex = (R, si) => (R.states[si].target ? targets.indexOf(R.states[si].target) : -1);
  const others = (R) => R.states.map((_, si) => tIndex(R, si)).filter((t) => t >= 0);
  const packGroups = G.map((g) => ({ states: g.picks.map((picks, pi) => {
    const [ax, ay] = atlas.at[g.tile[pi]], Rs = g.members.map((ri) => live[ri]), ts = Rs.map((R, i) => tIndex(R, picks[i])), deltas = [];
    if (Rs.length === 1) { if (ts[0] < 0) for (const t of others(Rs[0])) deltas.push([t, -1]); else deltas.push([ts[0], 1]); }
    else if (ts[0] < 0 && ts[1] < 0) for (const R of Rs) for (const t of others(R)) deltas.push([t, -0.5]);
    else if (ts[0] < 0 || ts[1] < 0) { const own = ts[0] < 0 ? 1 : 0; deltas.push([ts[own], 1]); for (const t of others(Rs[1 - own])) deltas.push([t, -0.5]); }
    else deltas.push([ts[0], 0.5], [ts[1], 0.5]);
    return { rest: ts.every((t) => t < 0), deltas, uv: ([s, t]) => toAtlas(ax + s * SIZE - g.rect[0], ay + (1 - t) * SIZE - g.rect[1]) };
  }) }));
  const regionIndex = new Map(G.flatMap((g, gi) => g.faces.map((fi) => [fi, gi])));
  // the hidden point: the middle of the head's skin, inside the skull
  const fv = []; mesh.vertices.forEach((v, i) => { if (mesh.provenance[i].part === 'face') fv.push(v); });
  const hidden = [0, 1, 2].map((c) => (Math.min(...fv.map((v) => v[c])) + Math.max(...fv.map((v) => v[c]))) / 2);
  return {
    targets: [...targets], authored, meta, K,
    pack: { atlas: { url: atlas.url, w: atlas.w, h: atlas.h }, painted: paint.painted, uvAt: paint.uvAt, light: paint.light, baseUV, white: toAtlas(...atlas.white), regionOf: regionIndex, regions: packGroups, hidden, targets: targets.length, pad: TILE_PAD },
  };
}

/** The painted face at rest, for the World page's clip preview (which draws no expressions): the pack's paint with the
 * authored face alone on an atlas with its white tile — no states, no targets — so a playing clip keeps its face. */
export function paintFaceBase(m, paint) {
  const face = m?.recipe?.parts?.face?.paint;
  if (!face?.layers || !paint) return null;
  const atlas = faceAtlas({ layers: face.layers }, [], m.recipe.palette), toAtlas = (X, Y) => [X / atlas.w, 1 - Y / atlas.h];
  return { atlas: { url: atlas.url, w: atlas.w, h: atlas.h }, painted: paint.painted, uvAt: paint.uvAt, light: paint.light, baseUV: ([s, t]) => toAtlas(s * SIZE, (1 - t) * SIZE), white: toAtlas(...atlas.white), regionOf: new Map(), regions: [], hidden: [0, 0, 0], targets: 0, pad: TILE_PAD };
}
