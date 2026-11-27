/**
 * A HYDRA: a serpent of many necks, one figure (the boss shelf's hydra, boss/vehicles.js). A serpent's packed figure (a
 * sea serpent's: its body humped behind, its front rising into a neck and a head) made into one body of coils and N
 * necks fanned round its breast, one skeleton the World page plays as any `figure-rig` body:
 *
 *   the ROOT is the last low point of its spine before the front rises (the neck's foot); every bone before it is the
 *     BODY, kept once, set so the root stands at the figure's origin on the water, grown `k` so a neck rises `height`;
 *   every bone from the root to the head is a NECK, copied once a head (`<bone>_<head>`), each turned about the upright
 *     to its place in the FAN (`fan` degrees apart, the middle one ahead, the first to the right) and stood out from the
 *     root `base` metres along it; a head's head and upper neck are tinted toward its colour (`colours`: its element's),
 *     its coils and lower necks toward its `body` colour (so it stands off the ground it is fought on)
 *   its CLIPS bend each neck about its own sideways axis, the bend shared down the neck from its foot and the head held
 *     looking ahead: `idle` (every neck swaying, each on its own beat), a TURN a head (`turn-<head>`: its neck rises,
 *     rears back, strikes, then hangs LOW and gasping, its head brought down to `low` [ahead, up] metres from its foot,
 *     its opening, and recovers; the others sway), `heart` (every neck thrashing).
 *
 *   hydraFigure(serpent, { heads, fan?, base?, height?, colours?, low?, turns?, body? }) → the figure (`necks`: each head's bones, the
 *       boss's parts hide them once severed; `opening`: the share of a turn its head hangs low)
 *   HYDRA   the defaults
 *
 * A pack's shape: figures/taur.js. Pure and deterministic.
 */

const N = 7;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const enc = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
// (a turn about the upright by `a` radians: +y, ahead, toward −x, the figure's left)
const yaw = (a) => (v) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
// (a rotation of `t` radians about the unit axis `u`, as a quaternion, and turning a vector by it)
const qaxis = (u, t) => [u[0] * Math.sin(t / 2), u[1] * Math.sin(t / 2), u[2] * Math.sin(t / 2), Math.cos(t / 2)];
function qrot(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ss = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

export const HYDRA = Object.freeze({
  heads: Object.freeze(['ember', 'venom', 'rime', 'storm', 'gloom']), fan: 32, base: 1.6, height: 6.5,
  // (its head brought this far ahead of its neck's foot and this high in its opening: where a blade reaches it)
  low: Object.freeze([2.4, 1.25]),
  // (a head's tint: how far toward its colour its head and upper neck are drawn; how many bones from the head take it)
  tint: 0.4, tinted: 3,
  // (its BODY's tint, `body`: how far its coils and lower necks are drawn toward it, so it stands off the ground it is on)
  bodyTint: 0.5,
  // (a turn: its keys as shares of it and the neck's bend at each, `low` its opening's; the share its head hangs low)
  turn: Object.freeze([[0, 0], [0.12, 0.08], [0.28, -0.38], [0.4, 0.75], [0.5, 'low'], [0.86, 'low'], [1, 0]]),
  opening: Object.freeze([0.5, 0.86]),
  turnSeconds: 6.5, idleSeconds: 3.2, keys: 48,
});

/** the bones of a serpent's spine in order, its neck and head after them */
function spineOf(src) {
  const at = (id) => src.bones.findIndex((b) => b.id === id);
  const spine = src.bones.map((b, i) => [b.id, i]).filter(([id]) => /^spine\d+$/.test(id)).sort((a, b) => +a[0].slice(5) - +b[0].slice(5)).map(([, i]) => i);
  const neck = src.bones.map((b, i) => [b.id, i]).filter(([id]) => /^neck\d+$/.test(id)).sort((a, b) => +a[0].slice(4) - +b[0].slice(4)).map(([, i]) => i);
  const head = at('head');
  if (spine.length < 4 || head < 0) throw new Error('hydra: the serpent has no spine and head to grow necks from');
  return [...spine, ...neck, head];
}

export function hydraFigure(src, { heads = HYDRA.heads, fan = HYDRA.fan, base = HYDRA.base, height = HYDRA.height, colours = null, low = HYDRA.low, turns = null, body = null } = {}) {
  if (!Array.isArray(heads) || heads.length < 2) throw new Error('hydra: two heads or more');
  const chain = spineOf(src), Z = (i) => src.bones[i].head[2];
  // THE ROOT: the last low point of the spine before its front rises to the head
  let r = chain.length - 2;
  while (r > 1 && !(Z(chain[r]) <= Z(chain[r - 1]) && Z(chain[r]) <= Z(chain[r + 1]))) r--;
  const neckSrc = chain.slice(r), isNeck = new Set(neckSrc), bodySrc = src.bones.map((_, i) => i).filter((i) => !isNeck.has(i));
  const root = src.bones[neckSrc[0]].head, floor = Math.min(...bodySrc.map((i) => src.bones[i].head[2]), root[2]);
  const k = height / Math.max(1e-6, src.bones[chain.at(-1)].head[2] - root[2]), R0 = [0, root[1], floor];
  const n = heads.length, angle = (i) => ((i - (n - 1) / 2) * fan * Math.PI) / 180;
  const T = { body: (v) => mul(sub(v, R0), k) };
  heads.forEach((h, i) => { const Y = yaw(angle(i)), at = Y([0, base, 0]); T[h] = (v) => add(Y(mul(sub(v, R0), k)), at); });
  // THE SKELETON: the body's bones, then each head's neck
  const bones = [], idx = new Map();
  const put = (si, tag) => { const b = src.bones[si], id = tag === 'body' ? b.id : `${b.id}_${tag}`; idx.set(`${tag}:${si}`, bones.length); bones.push({ id, head: T[tag](b.head).map(r5), tail: T[tag](b.tail).map(r5) }); };
  for (const si of bodySrc) put(si, 'body');
  for (const h of heads) for (const si of neckSrc) put(si, h);
  const mid = heads[Math.floor(n / 2)];
  // THE PARTS: each bone's part carried by its transform, its corners' joints renumbered (a body corner weighed to the
  // neck's foot rides the middle neck), a head's own tinted toward its colour
  const tintFrom = neckSrc.length - HYDRA.tinted;
  const partOf = (si, tag) => {
    const P = src.parts[si]; if (!P) return null;
    const pos = dec(P.pos, Float32Array), out = new Float32Array(pos.length);
    for (let v = 0; v < pos.length; v += 3) { const q = T[tag]([pos[v], pos[v + 1], pos[v + 2]]); out[v] = q[0]; out[v + 1] = q[1]; out[v + 2] = q[2]; }
    const J = dec(P.jnt, Uint8Array), J2 = new Uint8Array(J.length);
    for (let j = 0; j < J.length; j++) { const s0 = J[j], t = isNeck.has(s0) ? (tag === 'body' ? mid : tag) : 'body'; J2[j] = idx.get(`${t}:${s0}`) ?? 0; }
    let col = P.col;
    const at = neckSrc.indexOf(si), C = colours && tag !== 'body' && at >= tintFrom ? colours[tag] : body && (tag === 'body' || at < tintFrom) ? body : null;
    if (C && typeof P.col === 'string') {
      const c = dec(P.col, Uint8Array), out2 = new Uint8Array(c.length), [cr, cg, cb] = hexRgb(C), w = C === body ? HYDRA.bodyTint : HYDRA.tint;
      for (let j = 0; j < c.length; j += 3) { out2[j] = Math.round(c[j] * (1 - w) + cr * w); out2[j + 1] = Math.round(c[j + 1] * (1 - w) + cg * w); out2[j + 2] = Math.round(c[j + 2] * (1 - w) + cb * w); }
      col = enc(out2);
    }
    return { ...P, pos: enc(out), jnt: enc(J2), ...(col !== P.col ? { col } : {}) };
  };
  const parts = [...bodySrc.map((si) => partOf(si, 'body')), ...heads.flatMap((h) => neckSrc.map((si) => partOf(si, h)))];
  // THE POSES: a neck bent `t` radians forward about its sideways axis, shared down it from its foot, its head turned back
  // up by half of it (looking ahead); every body bone at rest
  const nb = bones.length, L = neckSrc.length, W = neckSrc.map((_, j) => (j < L - 1 ? (L - 1 - j) : 0)), Wsum = W.reduce((a, b) => a + b, 0) || 1;
  const neckPose = (h, i, t, out) => {
    const side = yaw(angle(i))([1, 0, 0]), H = neckSrc.map((si) => bones[idx.get(`${h}:${si}`)].head);
    let acc = 0, at = H[0];
    for (let j = 0; j < L; j++) {
      acc += j < L - 1 ? (t * W[j]) / Wsum : -0.5 * t;
      const q = qaxis(side, -acc), bi = idx.get(`${h}:${neckSrc[j]}`);
      out.set([q[0], q[1], q[2], q[3], at[0], at[1], at[2]].map(r5), bi * N);
      if (j < L - 1) at = add(at, qrot(q, sub(H[j + 1], H[j])));
    }
    return at;
  };
  const restFrame = () => { const f = new Float64Array(nb * N); bones.forEach((b, bi) => f.set([0, 0, 0, 1, ...b.head], bi * N)); return f; };
  // (the bend that brings a head `low`: down to its height ahead of its foot, searched)
  const lowBend = (() => {
    const f = restFrame(); let a = 0, b = 2.6;
    const zAt = (t) => neckPose(heads[0], 0, t, f)[2];
    for (let s = 0; s < 40; s++) { const m = (a + b) / 2; if (zAt(m) > low[1]) a = m; else b = m; }
    return (a + b) / 2;
  })();
  const sway = (i, u, amp = 0.07, beats = 1) => amp * Math.sin(2 * Math.PI * (u * beats + i / n));
  const clip = (K, seconds, bend) => {
    const b = [];
    for (let f = 0; f < K; f++) { const u = f / K, fr = restFrame(); heads.forEach((h, i) => neckPose(h, i, bend(h, i, u), fr)); for (const x of fr) b.push(r5(x)); }
    return { k: K, s: seconds, b };
  };
  // (a turn's keys: its own times where it is given them, `turns[head]` { seconds, land, open: [from, to] } (boss/vehicles.js
  // turnTimes): reared before its strike lands, struck as it lands, hung low through its opening; else the defaults)
  const keysOf = (h) => {
    const T = turns?.[h]; if (!T || !(T.seconds > 0)) return HYDRA.turn;
    const u = (x) => Math.max(0, Math.min(1, x / T.seconds)), land = u(T.land), o0 = Math.max(land + 0.03, u(T.open[0]) - 0.04), o1 = Math.max(o0 + 0.05, Math.min(0.96, u(T.open[1])));
    return [[0, 0], [Math.max(0.02, land - 0.2), 0.08], [Math.max(0.04, land - 0.08), -0.38], [land, 0.75], [o0, 'low'], [o1, 'low'], [1, 0]];
  };
  const keyed = (u, K = HYDRA.turn) => {
    const val = (x) => (x === 'low' ? lowBend : x);
    for (let j = 1; j < K.length; j++) if (u <= K[j][0]) { const [u0, a] = K[j - 1], [u1, c] = K[j]; return val(a) + (val(c) - val(a)) * ss((u - u0) / (u1 - u0)) + (a === 'low' && c === 'low' ? 0.05 * Math.sin(u * 40) : 0); }
    return 0;
  };
  const clips = { idle: clip(HYDRA.keys / 2, HYDRA.idleSeconds, (h, i, u) => sway(i, u)) };
  clips.forward = clips.idle;
  for (const h of heads) { const K = keysOf(h); clips[`turn-${h}`] = clip(HYDRA.keys, turns?.[h]?.seconds ?? HYDRA.turnSeconds, (x, i, u) => (x === h ? keyed(u, K) : sway(i, u))); }
  clips.heart = clip(HYDRA.keys / 2, 1.6, (h, i, u) => sway(i, u, 0.35, 2));
  const tops = bones.map((b) => Math.max(b.head[2], b.tail[2]));
  const necks = Object.fromEntries(heads.map((h) => [h, neckSrc.slice(tintFrom).map((si) => bones[idx.get(`${h}:${si}`)].id)]));
  // (drawn as the serpent's rig is, `rig` and `layered` its pack's: rigid parts, one a bone, so a severed neck's bones hide)
  return { ...(src.rig !== undefined ? { rig: src.rig } : {}), ...(src.layered !== undefined ? { layered: src.layered } : {}), bones, parts, clips, figH: r5(Math.max(...tops)), necks, opening: [...HYDRA.opening], lowBend: r5(lowBend) };
}
