/**
 * Shoot plan — the NAMED MOVES: what a camera operator calls a move, compiled to the keys that make it. Each is a row
 * (MOVES) whose keys are framed in words (framing.js) on the subject `on` names, so a move on a figure that walks rides
 * it, and the frame read (frame.js) reads each key back as the size it was framed at. The keys are a starter: they are
 * ordinary keys afterwards, edited with set_key, eased with ease.
 *
 *   push_in / pull_out   the dolly: toward the subject from one size to a tighter one (`from`, `to`), or back from it
 *   dolly_zoom           the dolly and the zoom against each other: the subject's size held while the lens goes from
 *                        `from` to `to` (24mm → 85mm: the background closes in round it)
 *   arc                  round the subject `by` degrees (+ toward its left) at one size, from its `side`
 *   crane_up / crane_down   the boom: from eye level at a size up to a high wide (`to` an angle, `to_size`), or down
 *   track                the tracking shot: alongside a subject as it moves (from its side at its size); on a point
 *                        that stands still, a truck `by` metres across the frame
 *   whip_pan             a pan so fast it blurs: from `on` to `to` (another subject or a point), the camera held
 *   crash_zoom           the lens slammed in from where the camera stands: `from` a size `to` a tighter one
 *   handheld / steadicam / run / rumble   the camera's shake (shake.js) over the move's span: no keys
 *
 *   moveKeys(spec, t0, { subjects, metersPerUnit, aspect, camera }) → { keys, shake?, span, warnings }
 *     spec: { kind, on, for?, follow?, heading?, height?, …the framing words (size, angle, side, place, lens, dutch),
 *     from?, to?, by?, to_size?, amount?, seed? }; `for` the move's seconds (each row has its own)
 *
 * Pure and deterministic.
 */
import { frameKey, subjectOf, SIDES, readFraming } from './framing.js';
import { SHAKES, readShake } from './shake.js';
import { ASPECT, SIZES, sizeOf } from './frame.js';

/** the moves: what each does, its seconds when none are said */
export const MOVES = Object.freeze([
  { id: 'push_in', says: 'the dolly in: toward the subject, from one size to a tighter one', for: 3 },
  { id: 'pull_out', says: 'the dolly out: back from the subject, from a tight size to a wide one: a reveal', for: 3 },
  { id: 'dolly_zoom', says: 'the dolly against the zoom: the subject held at its size while the lens changes and the place round it stretches or closes in', for: 3 },
  { id: 'arc', says: 'round the subject at one size', for: 4 },
  { id: 'crane_up', says: 'the boom up: from eye level up and out to a high wide', for: 4 },
  { id: 'crane_down', says: 'the boom down: from a high wide down to eye level on the subject', for: 4 },
  { id: 'track', says: 'the tracking shot: alongside the subject as it moves', for: 4 },
  { id: 'whip_pan', says: 'a pan so fast it blurs, from one subject to another, the camera held', for: 0.35 },
  { id: 'crash_zoom', says: 'the zoom slammed in from where the camera stands', for: 0.3 },
  ...SHAKES.map((s) => ({ id: s.id, says: `the camera's shake: ${s.says}`, for: null, shake: true })),
]);
const WORDS = { dolly_in: 'push_in', push: 'push_in', dolly_out: 'pull_out', pull_back: 'pull_out', pull: 'pull_out', reveal: 'pull_out', vertigo: 'dolly_zoom', zolly: 'dolly_zoom', orbit: 'arc', circle: 'arc', boom_up: 'crane_up', crane: 'crane_up', boom_down: 'crane_down', tracking: 'track', truck: 'track', follow: 'track', whip: 'whip_pan', swish_pan: 'whip_pan', snap_zoom: 'crash_zoom', zoom_in: 'crash_zoom' };
/** the most keys a move lays (an arc's one per this many degrees) */
export const ARC_STEP = 30;

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const r3 = (v) => Math.round(v * 1000) / 1000;

/** a move by its id or a word it is said by; null if none */
export function moveOf(word) {
  if (word == null) return null;
  const s = String(word).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return MOVES.find((m) => m.id === s) || MOVES.find((m) => m.id === WORDS[s]) || MOVES.find((m) => m.id === s.replace(/_/g, '')) || null;
}

/** the seconds a move takes as said (its `for`, else its row's); null for a shake over the camera's whole range */
export function moveSeconds(spec) {
  const row = moveOf(spec && (spec.kind ?? spec.move));
  if (!row) return null;
  return fin(spec.for) && spec.for > 0 ? spec.for : row.for;
}

/** The keys for a move (see the header) */
export function moveKeys(spec, t0, { subjects = null, metersPerUnit = 1, aspect = ASPECT, camera = 'cam' } = {}) {
  const warnings = [];
  const row = moveOf(spec.kind ?? spec.move);
  if (!row) return { keys: [], warnings: [`unknown move '${spec.kind ?? spec.move}' (${MOVES.map((m) => m.id).join(' | ')})`] };
  const dur = moveSeconds(spec);
  if (row.shake) {
    const { shake, warnings: w } = readShake({ style: row.id, amount: spec.amount, seed: spec.seed ?? camera, ...(dur ? { span: [t0, t0 + dur] } : {}) }, { metersPerUnit });
    return { keys: [], shake, span: dur ? [t0, r3(t0 + dur)] : null, warnings: w };
  }
  const t1 = r3(t0 + dur);
  const { on, follow, heading, height, kind, move, for: _for, from, to, by, to_size: toSize, amount, seed, ...words } = spec;
  const where = (t, what = on) => subjectOf(what, t, { subjects, metersPerUnit, heading, height });
  const at0 = where(t0);
  if (at0.error) return { keys: [], warnings: [`${row.id}: ${at0.error}`] };
  const rides = at0.id && follow !== false ? at0.id : null;
  // a key framed at time t: the subject where it is then (a still point is where it stands)
  const key = (t, w, opts = {}) => {
    const S = where(t, opts.on ?? on);
    if (S.error) { warnings.push(`${row.id}: ${S.error}`); return null; }
    const id = S.id && follow !== false ? S.id : null;
    const out = frameKey(w, S.subject, { t: r3(t), follow: id, aspect, ease: opts.ease, stand: opts.stand });
    for (const x of out.warnings || []) if (!warnings.includes(x)) warnings.push(x);
    return { ...out.key, ...(S.id ? { about: S.id } : {}) };
  };
  const base = { ...words };
  let keys = [];
  switch (row.id) {
    case 'push_in': case 'pull_out': {
      const a = from ?? words.size ?? (row.id === 'push_in' ? 'ms' : 'cu'), b = to ?? (row.id === 'push_in' ? 'cu' : 'ws');
      // a dolly keeps its lens: the size is had by the distance (a lens said is kept, else the first size's)
      const glass = words.lens ?? readFraming({ size: a }).framing.focal_mm;
      keys = [key(t0, { ...base, size: a, lens: glass }, { ease: 'easy_ease' }), key(t1, { ...base, size: b, lens: glass }, { ease: 'easy_ease' })];
      break;
    }
    case 'dolly_zoom': {
      const a = readFraming({ lens: from ?? '24mm' }).framing.focal_mm, b = readFraming({ lens: to ?? '85mm' }).framing.focal_mm, n = 4;
      // the lens eased geometrically, the distance solved at each so the size holds between the keys too
      for (let i = 0; i < n; i++) { const u = i / (n - 1); keys.push(key(t0 + u * dur, { ...base, size: words.size ?? 'mcu', lens: Math.round(a * Math.pow(b / a, u) * 10) / 10 }, { ease: i === 0 || i === n - 1 ? 'easy_ease' : 'linear' })); }
      break;
    }
    case 'arc': {
      const turn = fin(by) ? by : 90, steps = Math.max(1, Math.ceil(Math.abs(turn) / ARC_STEP));
      const side0 = fin(words.side) ? words.side : (SIDES.find((s) => s.id === readFraming({ side: words.side ?? 'three-quarter-right' }).framing.side) || SIDES[0]).deg;
      for (let i = 0; i <= steps; i++) keys.push(key(t0 + (dur * i) / steps, { ...base, size: words.size ?? 'ms', side: side0 + (turn * i) / steps }, { ease: i === 0 || i === steps ? 'easy_ease' : 'linear' }));
      break;
    }
    case 'crane_up': case 'crane_down': {
      const low = { angle: words.angle ?? 'eye', size: words.size ?? 'ms' }, high = { angle: to ?? 'high', size: toSize ?? 'ws' };
      const [a, b] = row.id === 'crane_up' ? [low, high] : [high, low];
      const ang = (x) => readFraming({ angle: x }).rows.angle.deg;
      // a crane swings on its arm: a key between, at the mean of the two tilts, so the path bows
      const mid = { angle: (ang(a.angle) + ang(b.angle)) / 2, size: a.size };
      keys = [key(t0, { ...base, ...a }, { ease: 'easy_ease' }), key(t0 + dur / 2, { ...base, ...mid }, { ease: 'linear' }), key(t1, { ...base, ...b }, { ease: 'easy_ease' })];
      break;
    }
    case 'track': {
      const w = { ...base, size: words.size ?? 'fs', side: words.side ?? 'profile-left' };
      if (rides) { keys = [key(t0, w, { ease: 'easy_ease' }), key(t1, w, { ease: 'easy_ease' })]; break; }
      // a still subject: a truck across the frame, the framing kept
      const k0 = key(t0, w, { ease: 'easy_ease' }), d = fin(by) ? by / (metersPerUnit || 1) : 3 / (metersPerUnit || 1);
      if (!k0) break;
      const f = [k0.poi[0] - k0.pos[0], k0.poi[1] - k0.pos[1]], l = Math.hypot(...f) || 1, rt = [f[1] / l * d, -f[0] / l * d];
      keys = [k0, { ...k0, t: t1, pos: [k0.pos[0] + rt[0], k0.pos[1] + rt[1], k0.pos[2]], poi: [k0.poi[0] + rt[0], k0.poi[1] + rt[1], k0.poi[2]] }];
      break;
    }
    case 'whip_pan': {
      if (to == null) { warnings.push('whip_pan needs `to`: the subject or point it pans to'); break; }
      // the camera stands where the first framing puts it, and only turns
      const standAt = frameKey({ ...base, size: words.size ?? 'ms' }, at0.subject, { t: t0, aspect }).key.pos;
      keys = [key(t0, { ...base, size: words.size ?? 'ms' }, { stand: standAt, ease: 'easy_ease' }), key(t1, { ...base, size: toSize ?? words.size ?? 'ms' }, { stand: standAt, ease: 'easy_ease', on: to })];
      break;
    }
    case 'crash_zoom': {
      const a = from ?? words.size ?? 'ws', b = to ?? 'cu';
      const standAt = frameKey({ ...base, size: a }, at0.subject, { t: t0, aspect }).key.pos;
      // a key at each size between, timed by the lens (its log: a zoom's angle closes fast as it starts), so the aim
      // keeps the subject framed all the way in
      const ia = SIZES.indexOf(sizeOf(a)), ib = SIZES.indexOf(sizeOf(b)), dir = ib >= ia ? 1 : -1;
      const sizes = ia < 0 || ib < 0 ? [a, b] : Array.from({ length: Math.abs(ib - ia) + 1 }, (_, i) => SIZES[ia + i * dir].id);
      const solved = sizes.map((z) => frameKey({ ...base, size: z }, at0.subject, { t: t0, aspect, stand: standAt }).key.focal_mm);
      const lf = solved.map((f) => Math.log(f)), span = lf.at(-1) - lf[0] || 1;
      keys = sizes.map((z, i) => key(t0 + dur * (i === sizes.length - 1 ? 1 : (lf[i] - lf[0]) / span), { ...base, size: z }, { stand: standAt, ease: i === sizes.length - 1 ? 'easy_ease_in' : 'linear' }));
      break;
    }
    default: break;
  }
  // each key says the move that laid it (the frame read lets a whip pan leave its subject between its keys)
  keys = keys.filter(Boolean).map((k) => ({ ...k, framing: { ...(k.framing || {}), move: row.id } }));
  // keys a move times at one instant (a zoom whose sizes share a lens) are one key
  keys = keys.filter((k, i) => !keys.slice(i + 1).some((o) => Math.abs(o.t - k.t) < 1e-3));
  if (!keys.length && !warnings.length) warnings.push(`${row.id}: no keys could be laid`);
  return { keys, span: [r3(t0), t1], warnings };
}
