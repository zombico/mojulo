/**
 * A DRAGON'S PRIMARY FORM: the beast on four legs its two-legged form (boss/dragons.js dragonFigure) is the risen shape
 * of, the two told apart by their stance and known for one dragon by what carries between them: the SAME HEAD (its snout,
 * its horns and crests, its eyes: the head the two-legged form wears, its neck and jaw with it), the SAME WINGS, the same
 * colours. A packed figure made of three (figures/taur.js's merge, twice):
 *
 *   the BODY      a four-legged reptile's (a monitor lizard's: its sprawled legs, its long tail, its walk), grown `scale`
 *                 and its scales drawn to the dragon's colour, its value kept (the scales' own light and dark)
 *   the HEAD      the two-legged form's neck, head and jaw, set on the end of the body's neck in place of its own head,
 *                 grown `head`
 *   the WINGS     the two-legged form's wings, set on the body's shoulders, grown `wings`, spread out to the sides
 *   the RIDGE     the two-legged form's dorsal spines, in its horns' colour, down the body's neck, back and tail
 *
 *   dragonPrimary(form, beast, { scales, horns }) → the figure (`form` the two-legged form's pack, `beast` the reptile's)
 *   scalePack, girthPack, spreadPack, tintPack, ridgePack   a pack grown about its origin; swollen about its bones; bones turned out
 *                                about the forward axis; its corners' hues drawn toward a colour; a
 *                                ridge of spines down its back
 *   dragonRisen(form) → the two-legged form at the primary's scale (the same head, the same wings): what it rises into
 *   growBones(F, k)   bones' corners grown about their heads
 *   PRIMARY   the beast it is grown from and how much each piece is grown
 *
 * Pure and deterministic.
 */
import { taurFigure } from './taur.js';

export const PRIMARY = Object.freeze({ species: 'monitorLizard', gait: 'walk', scale: 3.4, head: 1.9, wings: 2.8, spread: 38, tint: 0.85, lift: 1.15,
  // (the two-legged form's dorsal spines carried down its back: [bone, how tall] (× scale), two to a bone, in its horns'
  // colour)
  ridge: Object.freeze([['neck1', 0.09], ['neck0', 0.11], ['spine3', 0.13], ['spine2', 0.14], ['spine1', 0.13], ['spine0', 0.12], ['tail0', 0.1], ['tail1', 0.08], ['tail2', 0.06], ['tail3', 0.045]]),
  // (a beast, not a lizard: its trunk barrelled, its neck and limbs thickened, its tail kept long and lean)
  girth: Object.freeze([[/^spine/, 1.75], [/^neck/, 1.45], [/^(upperArm|foreArm|thigh|shin)/, 1.5], [/^(pastern|meta|forePaw|hindPaw)/, 1.3], [/^tail[01]$/, 1.45], [/^tail[23]$/, 1.2]]) });

const N = 7;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const enc = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const hexLinear = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return 255 * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); });
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** A pack grown `k` about its origin: its bones, its corners, its clips' heads. */
export function scalePack(F, k) {
  const grow = (p) => p.map((x) => r5(x * k));
  const parts = F.parts.map((P) => { if (!P || typeof P.pos !== 'string') return P; const V = dec(P.pos, Float32Array); for (let i = 0; i < V.length; i++) V[i] *= k; return { ...P, pos: enc(V) }; });
  const clips = Object.fromEntries(Object.entries(F.clips).map(([n, C]) => [n, { ...C, b: C.b.map((x, i) => (i % N >= 4 ? r5(x * k) : x)) }]));
  return { ...F, bones: F.bones.map((b) => ({ ...b, head: grow(b.head), tail: grow(b.tail) })), parts, clips, figH: r5(F.figH * k) };
}

/** A pack's corners swollen out from the bone each hangs on, `g(boneId)` times as far from it (1 leaves it). */
export function girthPack(F, g) {
  const k = F.bones.map((b) => g(b.id) ?? 1);
  const parts = F.parts.map((P) => {
    if (!P || typeof P.pos !== 'string') return P;
    const V = dec(P.pos, Float32Array), J = dec(P.jnt, Uint8Array), W = dec(P.wgt, Float32Array);
    for (let v = 0; v < V.length / 3; v++) {
      let top = 0; for (let q = 1; q < 4; q++) if (W[v * 4 + q] > W[v * 4 + top]) top = q;
      const j = J[v * 4 + top], f = k[j]; if (f === 1) continue;
      const { head: a, tail: b } = F.bones[j], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
      const p = [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / L2));
      for (let q = 0; q < 3; q++) { const c = a[q] + d[q] * t; V[v * 3 + q] = c + (p[q] - c) * f; }
    }
    return { ...P, pos: enc(V) };
  });
  return { ...F, parts };
}

/** A pack's bones (and the corners that hang on them) turned `deg` about the forward axis (y) at each one's head. */
export function spreadPack(F, turns) {
  const rot = (p, o, deg) => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), x = p[0] - o[0], z = p[2] - o[2]; return [r5(o[0] + x * c + z * s), p[1], r5(o[2] - x * s + z * c)]; };
  const at = F.bones.map((b) => turns[b.id] ?? 0);
  const parts = F.parts.map((P) => {
    if (!P || typeof P.pos !== 'string') return P;
    const V = dec(P.pos, Float32Array), J = dec(P.jnt, Uint8Array), W = dec(P.wgt, Float32Array);
    // (a lit pack's normals and tangents turned with their corners: `nrm` xyz, `tan` xyz and its handedness)
    const Nn = typeof P.nrm === 'string' ? dec(P.nrm, Float32Array) : null, Tn = typeof P.tan === 'string' ? dec(P.tan, Float32Array) : null, tw = Tn ? Tn.length / (V.length / 3) : 0;
    for (let v = 0; v < V.length / 3; v++) {
      let top = 0; for (let q = 1; q < 4; q++) if (W[v * 4 + q] > W[v * 4 + top]) top = q;
      const j = J[v * 4 + top]; if (!at[j]) continue;
      V.set(rot([V[v * 3], V[v * 3 + 1], V[v * 3 + 2]], F.bones[j].head, at[j]), v * 3);
      if (Nn) Nn.set(rot([Nn[v * 3], Nn[v * 3 + 1], Nn[v * 3 + 2]], [0, 0, 0], at[j]), v * 3);
      if (Tn) Tn.set(rot([Tn[v * tw], Tn[v * tw + 1], Tn[v * tw + 2]], [0, 0, 0], at[j]), v * tw);
    }
    return { ...P, pos: enc(V), ...(Nn ? { nrm: enc(Nn) } : {}), ...(Tn ? { tan: enc(Tn) } : {}) };
  });
  return { ...F, parts, bones: F.bones.map((b, j) => (at[j] ? { ...b, tail: rot(b.tail, b.head, at[j]) } : b)) };
}

/** A pack with a ridge of spines down its back: two to each `[bone, tall]` of `ridge`, standing on the top of the
 * skin over it, raked back (−y) and coloured `hex`, each hung wholly on its bone. */
export function ridgePack(F, ridge, hex) {
  const col = hexLinear(hex).map((c) => Math.round(c)), idx = new Map(F.bones.map((b, j) => [b.id, j]));
  const skin = F.parts.map((P) => (P && typeof P.pos === 'string' ? { V: dec(P.pos, Float32Array), J: dec(P.jnt, Uint8Array), W: dec(P.wgt, Float32Array) } : null));
  const pos = [], jnt = [];
  for (const [id, tall] of ridge) {
    const j = idx.get(id); if (j === undefined) continue;
    const { head: a, tail: b } = F.bones[j], h = tall * PRIMARY.scale;
    for (const t of [0.25, 0.75]) {
      const y = a[1] + (b[1] - a[1]) * t, x = a[0] + (b[0] - a[0]) * t, win = Math.abs(b[1] - a[1]) * 0.2 + 1e-3;
      let top = a[2] + (b[2] - a[2]) * t;
      for (const S of skin) { if (!S) continue; for (let v = 0; v < S.V.length / 3; v++) { let m = 0; for (let q = 1; q < 4; q++) if (S.W[v * 4 + q] > S.W[v * 4 + m]) m = q; if (S.J[v * 4 + m] === j && Math.abs(S.V[v * 3 + 1] - y) < win && Math.abs(S.V[v * 3] - x) < h) top = Math.max(top, S.V[v * 3 + 2]); } }
      const w = h * 0.32, z = top - h * 0.15, B = [[x - w, y + w, z], [x + w, y + w, z], [x, y - w, z]], A = [x, y - h * 0.55, top + h];
      for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) { pos.push(...B[p], ...B[q], ...A, ...B[q], ...B[p], ...A); jnt.push(j, j, j, j, j, j); }
    }
  }
  // (each spine joins the part of the bone it stands on: a pack's parts are its bones')
  const parts = F.parts.slice(), cat = (T, x, y) => { const o = new T(x.length + y.length); o.set(x); o.set(y, x.length); return o; };
  for (const j of new Set(jnt)) {
    const at = jnt.flatMap((k, v) => (k === j ? [v] : [])), n = at.length;
    const P = new Float32Array(n * 3), C = new Uint8Array(n * 3), J = new Uint8Array(n * 4), Wt = new Float32Array(n * 4);
    at.forEach((v, i) => { P.set(pos.slice(v * 3, v * 3 + 3), i * 3); C.set(col, i * 3); J[i * 4] = j; Wt[i * 4] = 1; });
    const O = parts[j];
    parts[j] = O && typeof O.pos === 'string'
      ? { ...O, pos: enc(cat(Float32Array, dec(O.pos, Float32Array), P)), col: enc(cat(Uint8Array, dec(O.col, Uint8Array), C)), jnt: enc(cat(Uint8Array, dec(O.jnt, Uint8Array), J)), wgt: enc(cat(Float32Array, dec(O.wgt, Float32Array), Wt)), faces: String(Number(O.faces) + n / 3) }
      : { pos: enc(P), col: enc(C), faces: String(n / 3), jnt: enc(J), wgt: enc(Wt) };
  }
  return { ...F, parts };
}

/** A pack's corners (linear light) drawn `w` of the way to a colour: each takes the colour at its own light or dark
 * against the pack's mean (so its pattern stays and its value is the colour's), × `lift`. */
export function tintPack(F, hex, w, lift = 1) {
  const T = hexLinear(hex), cols = F.parts.map((P) => (P && typeof P.col === 'string' ? dec(P.col, Uint8Array) : null));
  let sum = 0, n = 0; for (const c of cols) if (c) for (let j = 0; j < c.length; j += 3) { sum += lum([c[j], c[j + 1], c[j + 2]]); n++; }
  const mean = sum / (n || 1) || 1;
  const parts = F.parts.map((P, i) => {
    const c = cols[i]; if (!c) return P;
    for (let j = 0; j < c.length; j += 3) { const s0 = (lum([c[j], c[j + 1], c[j + 2]]) / mean) * lift; for (let q = 0; q < 3; q++) c[j + q] = Math.max(0, Math.min(255, Math.round(c[j + q] * (1 - w) + Math.min(255, T[q] * s0) * w))); }
    return { ...P, col: enc(c) };
  });
  return { ...F, parts };
}

export function dragonPrimary(form, beast, { scales, horns } = {}) {
  if (!form?.bones || !beast?.bones) throw new Error('dragon primary: its two-legged form and a four-legged beast, each packed');
  const need = (F, id, who) => { const b = F.bones.find((x) => x.id === id); if (!b) throw new Error(`dragon primary: the ${who} has no '${id}'`); return b; };
  const grown = scalePack(girthPack(beast, (id) => PRIMARY.girth.find(([re]) => re.test(id))?.[1]), PRIMARY.scale);
  const tinted = scales ? tintPack(grown, scales, PRIMARY.tint, PRIMARY.lift) : grown;
  const body = horns ? ridgePack(tinted, PRIMARY.ridge, horns) : tinted;
  // THE HEAD: the form's neck, head and jaw on the end of the body's neck, its own head cut
  const HEAD = new Set(['neck', 'head', 'jaw']), WINGS = new Set(['wingBoneR', 'wingBoneL']);
  const ownHead = need(body, 'head', 'beast'), neckEnd = body.bones.find((b) => b.tail.every((x, i) => Math.abs(x - ownHead.head[i]) < 1e-3)) ?? need(body, 'neck1', 'beast');
  const headed = taurFigure(form, body, { cut: ['head'], drop: form.bones.map((b) => b.id).filter((id) => !HEAD.has(id)), waist: 'neck', anchor: neckEnd.id, at: ownHead.head.slice(), scale: PRIMARY.head });
  // THE WINGS: the form's wings on the body's shoulders (the spine over its forelegs), as wide apart as they grow
  const W = need(form, 'wingBoneR', 'two-legged form'), WL = need(form, 'wingBoneL', 'two-legged form');
  const spread = spreadPack(form, { wingBoneR: Math.sign(W.head[0] || 1) * PRIMARY.spread, wingBoneL: Math.sign(WL.head[0] || -1) * PRIMARY.spread });
  const arm = need(body, 'upperArmR', 'beast'), back = headed.bones.filter((b) => /^spine\d+$/.test(b.id)).sort((a, b) => Math.abs(a.head[1] - arm.head[1]) - Math.abs(b.head[1] - arm.head[1]))[0];
  const at = [r5(W.head[0] * PRIMARY.wings), back.head[1], r5(back.head[2] + 0.12 * PRIMARY.scale)];
  const winged = taurFigure(spread, headed, { cut: [], drop: form.bones.map((b) => b.id).filter((id) => !WINGS.has(id)), waist: 'wingBoneR', anchor: back.id, at, scale: PRIMARY.wings });
  const tops = winged.bones.map((b) => Math.max(b.head[2], b.tail[2]));
  return { ...(beast.rig !== undefined ? { rig: beast.rig } : {}), ...(beast.layered !== undefined ? { layered: beast.layered } : {}), ...winged, figH: r5(Math.max(...tops)) };
}

/** Bones' corners grown `k[id]` times about each one's head (its clips turn it there, so they hold), its tail with it. */
export function growBones(F, k) {
  const f = F.bones.map((b) => k[b.id] ?? 1);
  const parts = F.parts.map((P) => {
    if (!P || typeof P.pos !== 'string') return P;
    const V = dec(P.pos, Float32Array), J = dec(P.jnt, Uint8Array), W = dec(P.wgt, Float32Array);
    for (let v = 0; v < V.length / 3; v++) {
      let top = 0; for (let q = 1; q < 4; q++) if (W[v * 4 + q] > W[v * 4 + top]) top = q;
      const j = J[v * 4 + top]; if (f[j] === 1) continue;
      const o = F.bones[j].head; for (let q = 0; q < 3; q++) V[v * 3 + q] = o[q] + (V[v * 3 + q] - o[q]) * f[j];
    }
    return { ...P, pos: enc(V) };
  });
  return { ...F, parts, bones: F.bones.map((b, j) => (f[j] === 1 ? b : { ...b, tail: b.tail.map((x, q) => r5(b.head[q] + (x - b.head[q]) * f[j])) })) };
}

/** THE RISEN FORM as it stands beside its primary: the two-legged form grown as the primary's head was (the same head),
 * its wings grown on to the primary's (the same wings): what it rises into. */
export function dragonRisen(form) {
  if (!form?.bones) throw new Error('dragon risen: its two-legged form, packed');
  const g = PRIMARY.wings / PRIMARY.head;
  return growBones(scalePack(form, PRIMARY.head), { wingBoneR: g, wingBoneL: g });
}
