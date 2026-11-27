/**
 * A TAUR: one figure of two, a body that walks on four legs and fights with two hands (a centaur's). A packed figure for
 * the LOWER body (a beast's: its legs, its barrel, its gaits) and one for the UPPER (a person's or a kin's: its torso,
 * its arms and head, its swings and throws), merged into one skeleton and one skin the World page plays as any
 * `figure-rig` body:
 *
 *   the lower body keeps every bone but its neck and head (`cut`, and every bone after them on their chain), whose parts
 *     are dropped and whose skin goes to the bone they hung from (`anchor`, the front of its spine: the withers);
 *   the upper body keeps every bone but its legs (`drop`), set on the withers at its waist (its `waist` bone's rest head
 *     placed `at` the lower body's rest, grown `scale`): its parts carried there, its legs' weight given to its waist;
 *   every pose is both: the lower body's clip as it is, and the upper body's moving on the withers as it moves on its
 *     own hips (its waist's motion taken off, the anchor's put on), so the arms swing and the trunk sways on a body that
 *     walks, trots or rears.
 *
 * A state's pose is the two clips of that name (each body's own map's), the lower's where its own is none its `rest`
 * one and the upper's its `idle`; the moving states (LOCO) run on the lower body's clock, the rest (a swing, a throw, a
 * flinch) on the upper's.
 *
 *   taurFit(upper, lower, { share? })  → { cut, drop, waist, anchor, at, scale }: read off the two skeletons, the lower's
 *       neck (its bones named neck…) and the spine bone it hangs from, the upper's legs and its pelvis, its waist set a
 *       little behind and below the neck's root, grown so its waist-to-crown is `share` of the withers' height (TAUR_SHARE)
 *   taurFigure(upper, lower, { cut, drop, waist, anchor, at, scale, rest? }) → the figure
 *
 * A pack: { bones: [{ id, head, tail }], clips: { <state>: { k, b, s, once? … } }, parts: [part | null] (a part a bone's,
 * its corners' buffers in base64: pos f32×3, col u8×3, jnt u8×4, wgt f32×4 …), figH }; a clip's `b` is its frames, each
 * a bone's [x, y, z, w] rotation from rest and its head's place (7 numbers a bone). Pure and deterministic.
 */

const N = 7;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
/** the moving states: played on the lower body's clock (its gait's), the upper's idle looped over it */
export const LOCO = Object.freeze(['forward', 'walk', 'strafe', 'turn', 'run', 'sprint', 'jog', 'backward', 'fly', 'swim']);

const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
function qrot(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

const dec = (s, T) => { const b = Buffer.from(s, 'base64'); return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const enc = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

/** a clip's frame at share `u` of it (looping unless `once`), its bones' rotations and heads mixed between its frames */
function frameAt(C, u, nb) {
  const K = C.k, x = C.once ? Math.max(0, Math.min(1, u)) * (K - 1) : (((u % 1) + 1) % 1) * K, i0 = Math.floor(x) % K, f = x - Math.floor(x);
  const i1 = C.once ? Math.min(K - 1, i0 + 1) : (i0 + 1) % K, out = new Array(nb * N);
  for (let j = 0; j < nb; j++) {
    const a = (i0 * nb + j) * N, b = (i1 * nb + j) * N, s = C.b[a] * C.b[b] + C.b[a + 1] * C.b[b + 1] + C.b[a + 2] * C.b[b + 2] + C.b[a + 3] * C.b[b + 3] < 0 ? -1 : 1;
    const q = [0, 1, 2, 3].map((k) => C.b[a + k] * (1 - f) + s * C.b[b + k] * f), l = Math.hypot(...q) || 1;
    for (let k = 0; k < 4; k++) out[j * N + k] = q[k] / l;
    for (let k = 4; k < 7; k++) out[j * N + k] = C.b[a + k] * (1 - f) + C.b[b + k] * f;
  }
  return out;
}
/** the clip a state plays on a body: its own, else the one named `rest`, else its first */
const clipOf = (F, state, rest) => F.clips[state] ?? F.clips[rest] ?? Object.values(F.clips)[0];

/** the bones a cut takes: those named and every bone further out along their chains (by head distance from the root) */
function chainOf(bones, names) {
  const out = new Set();
  for (const id of names) if (bones.some((b) => b.id === id)) out.add(id);
  // (a bone whose head is the tail of a cut bone, or sits on its chain past it, is cut with it: a head after its neck)
  let grew = true;
  while (grew) { grew = false; for (const b of bones) if (!out.has(b.id) && bones.some((c) => out.has(c.id) && Math.hypot(...sub(b.head, c.tail)) < 1e-4)) { out.add(b.id); grew = true; } }
  return out;
}

export function taurFigure(upper, lower, { cut, drop, waist = 'pelvis', anchor, at, scale = 1, rest = 'idle', upperRest = 'idle' } = {}) {
  if (!upper?.bones || !lower?.bones) throw new Error('taur: an upper and a lower figure, each packed');
  const LB = lower.bones, UB = upper.bones, nl = LB.length, nu = UB.length;
  const cutL = chainOf(LB, cut ?? []), dropU = new Set(drop ?? []);
  const iA = LB.findIndex((b) => b.id === anchor), iW = UB.findIndex((b) => b.id === waist);
  if (iA < 0 || cutL.has(anchor)) throw new Error(`taur: the anchor '${anchor}' is a bone the lower body keeps`);
  if (iW < 0 || dropU.has(waist)) throw new Error(`taur: the waist '${waist}' is a bone the upper body keeps`);
  // (the bones kept and where each goes: the lower's first, then the upper's)
  const keepL = LB.map((b, i) => (cutL.has(b.id) ? -1 : i)).filter((i) => i >= 0), keepU = UB.map((b, i) => (dropU.has(b.id) ? -1 : i)).filter((i) => i >= 0);
  const mapL = new Map(keepL.map((i, k) => [i, k])), mapU = new Map(keepU.map((i, k) => [i, keepL.length + k]));
  const RA = LB[iA].head, RW = UB[iW].head, T = at;
  const place = (p) => add(T, mul(sub(p, RW), scale));
  const bones = [...keepL.map((i) => ({ ...LB[i] })), ...keepU.map((i) => ({ ...UB[i], head: place(UB[i].head).map(r5), tail: place(UB[i].tail).map(r5) }))];
  // the skin: each part's corners carried (the upper's placed), their joints renumbered, a cut or dropped bone's weight
  // given to the anchor (the lower's neck to its withers) or the waist (the upper's legs to its hips)
  const toL = (j) => mapL.get(j) ?? mapL.get(iA), toU = (j) => mapU.get(j) ?? mapU.get(iW);
  const carry = (P, to, moved) => {
    if (!P) return P;
    const out = { ...P };
    if (typeof P.jnt === 'string') { const J = dec(P.jnt, Uint8Array); for (let i = 0; i < J.length; i++) J[i] = to(J[i]); out.jnt = enc(J); }
    if (moved && typeof P.pos === 'string') { const V = dec(P.pos, Float32Array); for (let i = 0; i < V.length; i += 3) { const p = place([V[i], V[i + 1], V[i + 2]]); V[i] = p[0]; V[i + 1] = p[1]; V[i + 2] = p[2]; } out.pos = enc(V); }
    return out;
  };
  const parts = [...keepL.map((i) => carry(lower.parts?.[i] ?? null, toL, false)), ...keepU.map((i) => carry(upper.parts?.[i] ?? null, toU, true))];
  // every state either body plays, posed as both
  const states = [...new Set([...Object.keys(lower.clips), ...Object.keys(upper.clips)])];
  const clips = {};
  for (const st of states) {
    // (a moving state: the lower body's gait, the upper held at its rest over it, never its own legs' run in its arms)
    const loco = LOCO.includes(st), CL = clipOf(lower, st, rest), CU = loco ? clipOf(upper, upperRest, upperRest) : clipOf(upper, st, upperRest), drive = loco ? CL : CU, K = drive.k, once = !!drive.once;
    const b = new Array(K * bones.length * N);
    for (let f = 0; f < K; f++) {
      const u = once ? (K > 1 ? f / (K - 1) : 0) : f / K, L = frameAt(CL, u, nl), U = frameAt(CU, u, nu);
      const qa = L.slice(iA * N, iA * N + 4), ha = L.slice(iA * N + 4, iA * N + 7), qp = U.slice(iW * N, iW * N + 4), hp = U.slice(iW * N + 4, iW * N + 7), qpc = qconj(qp);
      keepL.forEach((i, k) => { for (let c = 0; c < N; c++) b[(f * bones.length + k) * N + c] = r5(L[i * N + c]); });
      keepU.forEach((i, k) => {
        const qb = U.slice(i * N, i * N + 4), hb = U.slice(i * N + 4, i * N + 7);
        // (its pose on its own hips, the hips' own motion taken off, set on the withers and carried by them)
        const q = qmul(qmul(qa, qpc), qb), h = add(ha, qrot(qa, add(sub(T, RA), mul(qrot(qpc, sub(hb, hp)), scale))));
        const o = (f * bones.length + keepL.length + k) * N;
        for (let c = 0; c < 4; c++) b[o + c] = r5(q[c]);
        for (let c = 0; c < 3; c++) b[o + 4 + c] = r5(h[c]);
      });
    }
    const { b: _b, k: _k, ...meta } = drive;
    // (a clip's own marks name the body that drives it: a swing's tip is the upper's bone, its id unchanged)
    clips[st] = { ...meta, k: K, b };
  }
  const top = Math.max(...bones.map((x) => Math.max(x.head[2], x.tail[2])));
  return { ...upper, bones, parts, clips, figH: r5(Math.max(lower.figH ?? 0, upper.figH != null ? top + (upper.figH - Math.max(...UB.map((x) => Math.max(x.head[2], x.tail[2])))) * scale : top)), taur: true };
}

/** a centaur's man over its horse: its waist to its crown this share of the withers' height */
export const TAUR_SHARE = 0.6;
const LEGS = /^(thigh|shank|hipFold|kneeFold|foot|toes|calf|ankle|heel)[RL]?\d*$/;

export function taurFit(upper, lower, { share = TAUR_SHARE } = {}) {
  const LB = lower.bones, UB = upper.bones;
  const neck = LB.filter((b) => /^neck/.test(b.id)), root = neck.reduce((a, b) => (b.head[2] < a.head[2] ? b : a), neck[0]);
  if (!root) throw new Error('taur: the lower body has no neck to stand the upper on');
  // (the spine bone the neck hangs from: its tail at the neck's root, else the spine bone nearest it)
  const spine = LB.filter((b) => /^spine/.test(b.id)), anchor = (spine.find((b) => Math.hypot(...sub(b.tail, root.head)) < 1e-3) ?? spine.reduce((a, b) => (Math.hypot(...sub(b.tail, root.head)) < Math.hypot(...sub(a.tail, root.head)) ? b : a), spine[0])).id;
  const waist = UB.find((b) => b.id === 'pelvis') ? 'pelvis' : UB[0].id, W = UB.find((b) => b.id === waist).head;
  const crown = Math.max(...UB.map((b) => Math.max(b.head[2], b.tail[2]))), withers = root.head[2];
  const scale = r5(Math.max(0.5, Math.min(2, (share * withers) / Math.max(0.1, crown - W[2]))));
  const len = Math.max(...LB.map((b) => b.head[1])) - Math.min(...LB.map((b) => b.head[1]));
  return { cut: neck.map((b) => b.id), drop: UB.map((b) => b.id).filter((id) => LEGS.test(id)), waist, anchor,
    at: [r5(root.head[0]), r5(root.head[1] - 0.03 * len), r5(withers - 0.06 * withers)], scale };
}

