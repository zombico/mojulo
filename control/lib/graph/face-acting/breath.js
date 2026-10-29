/**
 * breath — THE MIND-BODY LOOP's body: the breath a state of mind breathes, the face it moves, and the body it lifts.
 *
 *   • THE STATE SETS THE BREATH (`breathOf`): calm breathes slow and low (the belly's breath, the chest barely moving);
 *     the warier (alert.js) faster, shallower in feel and HIGH (the chest's, the shoulders rising with it) and, past
 *     half, through the mouth; sadness slower and given to sighs; anger heavier. An emote's card may set its own.
 *   • THE BREATH MOVES THE FACE (`breathFace`): breathing through the mouth parts the lips and lets the jaw drop a
 *     little with each breath in; a HELD breath presses the lips shut; a SIGH lifts the brows on its long breath in and
 *     lets the lips part and the lids grow heavy on the breath out (relief). A line spoken owns the mouth (mouth.js).
 *   • THE BREATH SETTLES THE MIND (`settle`): a startle holds the breath, then its wariness settles away over seconds
 *     and lets go with a sigh as it falls under half: the loop closed, the body easing the mind.
 *   • THE BREATH LIFTS THE BODY (`breathBones`): each breath in tips the torso back a little about its root (the chest
 *     rising), the upper body's joints carried with it; a high breath lifts the clavicles and the arms with them. Small
 *     offsets from the rest pose: an engine plays them as an additive layer over any body clip.
 * Breath here is a curve, the lungs' fill (0 empty at rest … 1 a sigh's full), and how HIGH it sits (0 the belly … 1 the
 * chest). The physiology's (resting rate about a dozen a minute, quickening and rising into the chest with arousal,
 * the startle's held breath, the sigh's reset); the numbers tuned on the eyes gate. Pure and deterministic.
 */

/** the breath: its rate a minute and depth (the fill a breath reaches) and how high it sits, calm → on guard; a breath
 * in's share of the cycle; mouth breathing (from what wariness, the lips apart, the jaw with each breath in); a held
 * breath (how long, the lips' press); a sigh (its breath in and out, s, the face it moves); a startle's settling (s, the
 * e-fold of its wariness, the sigh when it falls under `relief`); how fast the breath follows a change of state (s) */
export const BREATH = Object.freeze({
  rate: Object.freeze([12, 22]), depth: Object.freeze([0.45, 0.6]), high: Object.freeze([0.15, 0.85]), inhale: 0.42,
  mouth: Object.freeze({ from: 0.5, lips: 0.2, jaw: 0.1 }),
  hold: Object.freeze({ seconds: Object.freeze([0.9, 1.5]), press: 0.3 }),
  sigh: Object.freeze({ inhale: 1.1, exhale: 1.9, lips: 0.25, brow: 0.12, lids: 0.12, jaw: 0.06 }),
  settle: 4, relief: 0.5, follow: 1.2,
  sad: Object.freeze({ rate: 0.85, sigh: Object.freeze([9, 16]) }), angry: Object.freeze({ depth: 0.15 }),
});
/** the body's breath: the torso's tip back at a full breath (degrees, low and high), the clavicles' lift at a full high
 * breath (degrees), the joints the clavicles carry (by name, a side's), the joints the torso carries (all above it) */
export const BODY_BREATH = Object.freeze({ torso: Object.freeze([0.8, 2.4]), clavicle: 6, arm: /^(upperArm|foreArm|hand|thumb|index|middle|ring|pinky|little|shoulderFold)\d?([LR])$/ });

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const unit = (S, au) => (S[au] ?? 0) + Math.max(S[`${au}L`] ?? 0, S[`${au}R`] ?? 0);

/**
 * The breath a state breathes: a face (a FACS state) at a wariness → { rate (a minute), depth, high, mouth (0 … 1, how
 * far through the mouth), sigh ([s, s] between sighs, or null) }; an emote card's `breath` over it.
 */
export function breathOf(S = {}, a = 0, own = {}) {
  const sad = Math.min(unit(S, 'AU1'), unit(S, 'AU15') + unit(S, 'AU17') * 0.5), angry = Math.min(unit(S, 'AU4'), unit(S, 'AU23') + unit(S, 'AU24'));
  const B = BREATH;
  return {
    rate: own.rate ?? lerp(B.rate[0], B.rate[1], a) * (1 - (1 - B.sad.rate) * clamp01(sad * 2)),
    depth: own.depth ?? clamp01(lerp(B.depth[0], B.depth[1], a) + B.angry.depth * clamp01(angry * 2)),
    high: own.high ?? lerp(B.high[0], B.high[1], a),
    mouth: clamp01((a - B.mouth.from) / (1 - B.mouth.from)),
    sigh: own.sigh ?? (sad > 0.3 ? B.sad.sigh : null),
  };
}

/** a breath's fill over its cycle (phase 0 … 1): in over `inhale`, out over the rest, eased; nought at rest */
const shape = (ph) => (ph < BREATH.inhale ? ease(ph / BREATH.inhale) : 1 - ease((ph - BREATH.inhale) / (1 - BREATH.inhale)));
/** a sigh's fill `t` seconds into it: up to full, then out */
const sighShape = (t) => { const S = BREATH.sigh; return t < S.inhale ? ease(t / S.inhale) : 1 - ease((t - S.inhale) / S.exhale); };
export const SIGH_SECONDS = BREATH.sigh.inhale + BREATH.sigh.exhale;

/**
 * A take's breath: `n` frames at `fps`, the state a frame breathes (`at(t)` → breathOf's), the held breaths ([{ t, dur }])
 * and the sighs ([t]); `loop` makes it whole cycles of the period (`n - 1` frames), round. → { v: [fill], high: [],
 * mouth: [], holds, sighs }. The state is followed over `BREATH.follow` seconds, never jumped.
 */
export function breathTake({ n, fps, at, holds = [], sighs = [], loop = false }) {
  const v = new Array(n), high = new Array(n), mouth = new Array(n), P = (n - 1) / fps;
  const s0 = at(0);
  let rate = s0.rate, depth = s0.depth, hi = s0.high, mo = s0.mouth, ph = 0;
  const k = 1 - Math.exp(-1 / (fps * BREATH.follow));
  // (a loop breathes whole cycles: its rate rounded so the period holds a whole number of breaths)
  const cycles = loop ? Math.max(1, Math.round((s0.rate / 60) * P)) : 0;
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    if (!loop) { const s = at(t); rate += (s.rate - rate) * k; depth += (s.depth - depth) * k; hi += (s.high - hi) * k; mo += (s.mouth - mo) * k; }
    const held = holds.find((h) => t >= h.t && t < h.t + h.dur), sigh = sighs.find((s) => t >= s && t < s + SIGH_SECONDS);
    if (loop) ph = (cycles * (i % (n - 1))) / (n - 1);
    else if (!held && !sigh) ph = (ph + rate / 60 / fps) % 1;
    // (a sigh breathes over whatever breath it falls in, from where that breath is; a hold keeps the fill it caught)
    const base = depth * shape(ph % 1);
    v[i] = held ? (i > 0 ? v[i - 1] : base) : sigh !== undefined ? Math.max(base, sighShape(t - sigh)) : base;
    high[i] = hi; mouth[i] = mo;
  }
  if (loop) { v[n - 1] = v[0]; high[n - 1] = high[0]; mouth[n - 1] = mouth[0]; }
  return { v, high, mouth, holds, sighs };
}

/**
 * The breath on the face, frame by frame, in place (`curves` a take's, `n` frames at `fps`; `B` breathTake's): through
 * the mouth the lips apart and the jaw dropping a little with each breath in; a held breath's lips pressed (and the
 * lips' and the jaw's own parting held off); a sigh's brows lifted on its breath in, the lips parted and the lids heavy
 * on its breath out. `wrap` for a loop (a sigh near the end carries round). Returns the curves.
 */
export function breathFace(curves, B, { n, fps, wrap = false }) {
  const P = (n - 1) / fps, M = BREATH.mouth, S = BREATH.sigh;
  const put = (k, i, v) => { if (!(v > 0)) return; const c = curves[k] || (curves[k] = new Array(n).fill(0)); c[i] = clamp01(Math.max(c[i], v)); };
  const since = (t, t0) => { const d = t - t0; return wrap ? ((d % P) + P) % P : d; };
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    // (through the mouth: the lips apart by how far, the jaw with the breath in)
    put('AU25', i, M.lips * B.mouth[i]);
    put('AU26', i, M.jaw * B.mouth[i] * B.v[i]);
    for (const s of B.sighs) {
      const d = since(t, s);
      if (d < 0 || d >= SIGH_SECONDS) continue;
      const up = d < S.inhale ? Math.sin((Math.PI * d) / S.inhale) : 0, out = d >= S.inhale ? Math.sin((Math.PI * (d - S.inhale)) / S.exhale) : 0;
      put('AU1', i, S.brow * up); put('AU26', i, S.jaw * up);
      put('AU25', i, S.lips * out); put('AU45', i, S.lids * out);
    }
    for (const h of B.holds) {
      const d = since(t, h.t);
      if (d < 0 || d >= h.dur) continue;
      const env = Math.min(1, d / 0.1, (h.dur - d) / 0.15);
      put('AU24', i, BREATH.hold.press * env);
      for (const k of Object.keys(curves)) if (/^AU2[56][LR]?$/.test(k)) curves[k][i] *= 1 - env;
    }
  }
  return curves;
}

/** a startle's wariness `t` seconds after it: full through its held breath, then settling (e-fold `BREATH.settle`) */
export const settle = (t, hold) => (t < 0 ? 0 : t < hold ? 1 : Math.exp(-(t - hold) / BREATH.settle));
/** when a startle's settling breathes its sigh of relief (s after it) */
export const reliefAt = (hold) => hold + BREATH.settle * Math.log(1 / BREATH.relief);

/**
 * The breath on the body: the rig's joints (`heads`: { id: [x, y, z] } at rest, the native frame) and a breath's
 * frames (`v`, `high`) → { id: { r?: [qx, qy, qz, qw per frame], d?: [dx, dy, dz per frame] } }: the torso's rotation
 * (tipped back about its root), the clavicles' (lifted), and the offsets the joints they carry take (the upper body's
 * with the torso, the arms' with their clavicle too). Up from the torso to the neck, forward from the foot to its toes,
 * each clavicle's direction to its arm; a rig without them breathes nothing (an empty object).
 */
export function breathBones(heads, { v, high }) {
  const need = ['torso', 'neck', 'clavicleL', 'clavicleR', 'upperArmL', 'upperArmR', 'footL', 'toesL'];
  if (!need.every((id) => heads[id])) return {};
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const up = norm(sub(heads.neck, heads.torso)), fw0 = sub(heads.toesL, heads.footL);
  const fw = norm(sub(fw0, up.map((u) => u * (fw0[0] * up[0] + fw0[1] * up[1] + fw0[2] * up[2]))));
  const quat = (axis, deg) => { const h = (deg * Math.PI) / 360, s = Math.sin(h); return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)]; };
  const rot = (q, p) => { const [x, y, z, w] = q, u = [x, y, z], t = cross(u, p).map((c) => 2 * c), c2 = cross(u, t); return [p[0] + w * t[0] + c2[0], p[1] + w * t[1] + c2[1], p[2] + w * t[2] + c2[2]]; };
  // (the torso tips back: its up toward behind, about the axis forward × up; each clavicle lifts: its line toward up,
  // about its line × up)
  const tAxis = norm(cross(fw, up)), side = (s) => ({ dir: sub(heads[`upperArm${s}`], heads[`clavicle${s}`]), axis: norm(cross(norm(sub(heads[`upperArm${s}`], heads[`clavicle${s}`])), up)) });
  const C = { L: side('L'), R: side('R') }, T0 = heads.torso, f = v.length, out = {};
  // (what the torso carries: every joint above it but the legs', and the arms wherever they hang)
  const arm = (id) => BODY_BREATH.arm.exec(id)?.[2];
  const upper = Object.keys(heads).filter((id) => id !== 'torso' && (arm(id) || ((heads[id][0] - T0[0]) * up[0] + (heads[id][1] - T0[1]) * up[1] + (heads[id][2] - T0[2]) * up[2] > 0.05 && !/^(thigh|shin|foot|toes)/.test(id))));
  for (const id of ['torso', 'clavicleL', 'clavicleR', ...upper]) out[id] ??= {};
  for (const id of Object.keys(out)) { if (['torso', 'clavicleL', 'clavicleR'].includes(id)) out[id].r = new Array(f * 4); if (id !== 'torso') out[id].d = new Array(f * 3); }
  for (let i = 0; i < f; i++) {
    const qt = quat(tAxis, v[i] * lerp(BODY_BREATH.torso[0], BODY_BREATH.torso[1], high[i]));
    const moved = (p) => sub(rot(qt, sub(p, T0)), sub(p, T0));
    out.torso.r.splice(i * 4, 4, ...qt);
    for (const s of ['L', 'R']) {
      const qc = quat(C[s].axis, v[i] * high[i] * BODY_BREATH.clavicle), lift = sub(rot(qc, C[s].dir), C[s].dir);
      out[`clavicle${s}`].r.splice(i * 4, 4, ...qc);
      C[s].lift = lift;
    }
    for (const id of Object.keys(out)) {
      if (id === 'torso') continue;
      // (an arm hangs from its shoulder: every joint of it takes its shoulder's move, the torso's and the clavicle's lift)
      const s = arm(id), d = moved(s ? heads[`upperArm${s}`] : heads[id]), l = s ? C[s].lift : [0, 0, 0];
      out[id].d.splice(i * 3, 3, d[0] + l[0], d[1] + l[1], d[2] + l[2]);
    }
  }
  return out;
}
