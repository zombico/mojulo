// THE CREATURE STYLIST: the hero door's stylism tuner (lib/graph/stylism) compressed for a beast and made opinionated.
// The words are design notes; what they resolve to is pushes (push.js) the creature already wears, and the notes say
// what was chosen and why. A creature with no stylism is its oozes' design exactly.
//
//   stylism: { register?, detail?, focal?, motif? }
//     register  HEIGHTENING: grounded 0 · storybook 0.35 · heroic 0.7 · mythic 1, or 0 … 1. Storybook and below are the
//               design itself; above it every push is exaggerated together and the creature grows (a mythic beast a
//               quarter bigger), after the design and never into it
//     detail    the BUDGET: plain 0 · considered 0.35 · rich 0.7 · ornate 1, or 0 … 1: how many ornaments, never how big
//     focal     where the detail gathers: head (default: the eyes and the mouth carry a creature) | shoulders | back |
//               forelegs | tail
//     motif     the shape family every ornament is made in (motif.js), over the oozes' own
//
// The budget is spent in a designer's order (the tuner's detail.js):
//   1 HIERARCHY   the focal first, its richest ornament then its next, until it outweighs every other zone; no other
//                 zone ever reaches the focal's weight (what the oozes already grew counts in the weights, not the budget)
//   2 REPETITION  the motif echoed once at another zone, smaller
//   3 REST        quiet bands on what is left; what stays unspent is rest, part of the design
//   4 MATERIAL    from heroic up, the motif's ornaments drawn full-bright near the focal: the accent
// Rows may carry their own stylism (a boss ooze is mythic); the spec's words stand over theirs, key by key.
import { MOTIFS, MOTIF_NAMES } from './motif.js';
import * as dmath from '../../util/dmath.js';

export const REGISTER_WORDS = Object.freeze({ grounded: 0, storybook: 0.35, heroic: 0.7, mythic: 1 });
export const DETAIL_WORDS = Object.freeze({ plain: 0, considered: 0.35, rich: 0.7, ornate: 1 });
export const ZONES = Object.freeze(['head', 'shoulders', 'back', 'forelegs', 'tail']);
const FIELDS = ['register', 'detail', 'focal', 'motif'];
// each ornament: its zone, its cost in units (the richest single ornament 3), and its baseline push
const ORNAMENTS = {
  horns: { zone: 'head', cost: 3, push: { horns: { size: 1 } }, reads: 'a pair of horns' },
  cheeks: { zone: 'head', cost: 2, push: { cheeks: { size: 1 } }, reads: 'a spur at each cheek' },
  hackles: { zone: 'back', cost: 3, push: { hackles: { count: 6, height: 0.5, lean: 0.5 } }, reads: 'a crest of spikes down the back' },
  shoulders: { zone: 'shoulders', cost: 2, push: { shoulders: { size: 1 } }, reads: 'a spike off each shoulder' },
  ruff: { zone: 'shoulders', cost: 2, push: { ruff: { size: 1 } }, reads: 'a ruff round the neck' },
  spurs: { zone: 'forelegs', cost: 2, push: { spurs: { size: 1 } }, reads: 'a spur behind each elbow' },
  tailSpikes: { zone: 'tail', cost: 2, push: { tailSpikes: { count: 4, size: 1 } }, reads: 'spikes down the tail' },
  bands: { zone: 'forelegs', cost: 1, push: { bands: true }, reads: 'a band round each lower leg' },
  tipGlow: { zone: 'tail', cost: 1, push: { tipGlow: true }, reads: 'a burning tail tip' },
};
const OFFER = { head: ['horns', 'cheeks'], shoulders: ['shoulders', 'ruff'], back: ['hackles'], forelegs: ['spurs', 'bands'], tail: ['tailSpikes', 'tipGlow'] };
const ECHO = ['tailSpikes', 'shoulders', 'spurs', 'cheeks'];   // the motif again, smaller, where the focal is not
const REST = ['bands', 'tipGlow'];
const level = (v, W) => (typeof v === 'number' ? Math.max(0, Math.min(1, v)) : W[v]);
const r3 = (x) => Math.round(x * 1000) / 1000;

/** Error strings for a stylism (empty = valid). */
export function stylismErrors(s, label = 'stylism') {
  if (s === undefined || s === null) return [];
  if (typeof s !== 'object' || Array.isArray(s)) return [`${label}: { register?: ${Object.keys(REGISTER_WORDS).join(' | ')}, detail?: ${Object.keys(DETAIL_WORDS).join(' | ')}, focal?: ${ZONES.join(' | ')}, motif?: ${MOTIF_NAMES.join(' | ')} }`];
  const errs = [];
  for (const [k, W] of [['register', REGISTER_WORDS], ['detail', DETAIL_WORDS]]) if (s[k] !== undefined && !(W[s[k]] !== undefined || (Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 1))) errs.push(`${label}.${k}: ${Object.keys(W).join(' | ')}, or a number 0 … 1`);
  if (s.focal !== undefined && !ZONES.includes(s.focal)) errs.push(`${label}.focal: one of ${ZONES.join(', ')}`);
  if (s.motif !== undefined && !MOTIFS[s.motif]) errs.push(`${label}.motif: one of ${MOTIF_NAMES.join(', ')}`);
  for (const k of Object.keys(s)) if (!FIELDS.includes(k)) errs.push(`${label}.${k}: not a stylism word (${FIELDS.join(', ')})`);
  return errs;
}

/** The rows' stylisms (list order, the last a key wins) under the spec's → `{ r, d, a, focal, motif }`, or null. */
export function resolveStylism(rows, own) {
  const merged = Object.assign({}, ...rows.filter(Boolean), own || {});
  if (!Object.keys(merged).length) return null;
  const r = level(merged.register ?? 'storybook', REGISTER_WORDS), d = level(merged.detail ?? 'considered', DETAIL_WORDS);
  return { r, d, a: r3(Math.max(0, (r - REGISTER_WORDS.storybook) / (1 - REGISTER_WORDS.storybook))), focal: merged.focal ?? 'head', ...(merged.motif ? { motif: merged.motif } : {}), said: merged };
}

const SIZE_LEAVES = { horns: 'size', cheeks: 'size', shoulders: 'size', spurs: 'size', tailSpikes: 'size', ruff: 'size', hackles: 'height' };
const MUL_ROOTS = ['wedge', 'neck', 'limbs', 'head', 'fangs', 'ears'];
const clampMul = (v) => Math.min(3, Math.max(0.3, v));
const bend = (v, e) => (typeof v === 'number' && v > 0 ? clampMul(dmath.pow(v, e)) : v);
/**
 * THE WARP: the register's heightening over a composed form and push (new objects). Each push's departure from
 * identity grows (a multiplier raised to 1 + 0.6a), each ornament's size by 1 + 0.5a, the rest face by 1 + 0.3a, and the
 * creature by 1 + 0.25a. Counts, colours and words are the design's: they stay.
 */
export function heighten(form, push, a) {
  if (!a) return { form, push };
  const e = 1 + 0.6 * a, out = structuredClone(push || {});
  for (const k of MUL_ROOTS) {
    if (typeof out[k] === 'number') out[k] = bend(out[k], e);
    else if (out[k] && typeof out[k] === 'object') for (const [kk, v] of Object.entries(out[k])) {
      if (k === 'head' && kk === 'pace') continue;
      if (k === 'ears' && kk !== 'height') continue;
      out[k][kk] = v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([x, y]) => [x, bend(y, e)])) : bend(v, e);
    }
  }
  for (const [k, leaf] of Object.entries(SIZE_LEAVES)) if (out[k]?.[leaf]) out[k][leaf] = r3(out[k][leaf] * (1 + 0.5 * a));
  if (out.expression) out.expression = Object.fromEntries(Object.entries(out.expression).map(([k, v]) => [k, r3(v * (1 + 0.3 * a))]));
  return { form: { ...form, scale: r3(Math.min(3, (form.scale ?? 1) * (1 + 0.25 * a))) }, push: out };
}

/**
 * THE DETAIL STAGE: the budget spent on a body (`can`: which ornaments this body can wear) → `{ push, notes, budget, left }`,
 * the push the composed one with the spent ornaments laid in (sizes heightened by the register, as the warp would).
 */
export function spendDetail(S, push, can) {
  const budget = Math.round(S.d * 10), notes = [], out = structuredClone(push || {});
  const motif = S.motif ?? out.motif ?? 'horn';
  out.motif = motif;
  const has = (k) => (k === 'bands' || k === 'tipGlow' ? !!out[k] : k === 'tailSpikes' ? !!out[k]?.count : k === 'hackles' ? !!out[k]?.count : !!out[k]?.[SIZE_LEAVES[k]]);
  const weight = Object.fromEntries(ZONES.map((z) => [z, 0]));
  for (const [k, O] of Object.entries(ORNAMENTS)) if (has(k)) weight[O.zone] += O.cost;
  // the focal: the asked zone if this body can wear something there, else the first that can
  const wears = (z) => OFFER[z].some((k) => can[k]);
  const F = wears(S.focal) ? S.focal : ZONES.find(wears) ?? S.focal;
  if (F !== S.focal) notes.push({ stage: 'detail', technique: `focal ${F}`, where: S.focal, principle: 'hierarchy: the focal richest', why: `this body wears nothing at the ${S.focal} (${S.focal === 'head' ? 'a worn head mesh takes no ornament' : 'no part there'}): the detail gathers at the ${F}` });
  let left = budget;
  const grow = 1 + 0.5 * S.a;
  const wear = (k, technique, scale = 1) => {
    const O = ORNAMENTS[k];
    if (!can[k] || has(k) || O.cost > left || (O.zone !== F && weight[O.zone] + O.cost >= weight[F])) return false;
    for (const [pk, pv] of Object.entries(O.push)) out[pk] = typeof pv === 'object' ? Object.fromEntries(Object.entries(pv).map(([x, y]) => [x, x === SIZE_LEAVES[pk] ? r3(y * scale * grow) : y])) : pv;
    left -= O.cost; weight[O.zone] += O.cost;
    notes.push({ stage: 'detail', technique, where: O.zone, principle: technique === 'echo' ? 'repetition with variation' : technique === 'rest' ? 'rest: the quiet edges' : 'hierarchy: the focal richest', why: `${O.reads} in ${MOTIFS[motif].reads} (${O.cost} unit${O.cost === 1 ? '' : 's'})` });
    return true;
  };
  const most = () => Math.max(0, ...ZONES.filter((z) => z !== F).map((z) => weight[z]));
  // 1 · the focal, until it outweighs every other zone
  for (const k of OFFER[F]) if (left > 0 && (weight[F] <= most() || weight[F] < 3)) wear(k, 'focal');
  // 2 · the echo: the motif once more, smaller, away from the focal
  for (const k of ECHO) if (ORNAMENTS[k].zone !== F && wear(k, 'echo', 0.7)) break;
  // 3 · rest: quiet bands
  for (const k of REST) if (ORNAMENTS[k].zone !== F) wear(k, 'rest');
  // the focal could not outrank what the oozes already grew (a crest heavier than the budget can raise at the head)
  const top = ZONES.filter((z) => z !== F).reduce((b, z) => (weight[z] > weight[b] ? z : b), ZONES.find((z) => z !== F));
  if (weight[top] >= weight[F] && weight[top] > 0) notes.push({ stage: 'detail', technique: 'stalled', where: `the ${F}`, principle: 'hierarchy: the focal richest', why: `the oozes' own ${top} (${weight[top]}) outweighs what ${budget} units can raise at the ${F} (${weight[F]}): a richer detail, or the ${top} as the focal, settles it` });
  // 4 · material: the accent near the focal, from heroic up
  if (S.r >= 0.6 && !MOTIFS[motif].glow && left >= 1 && Object.keys(ORNAMENTS).some(has)) {
    out.motifGlow = true; left -= 1;
    notes.push({ stage: 'detail', technique: 'accent', where: F, principle: 'material contrast near the focal', why: `heroic and up: the ${motif} ornaments burn, the one accent (1 unit)` });
  }
  notes.unshift({ stage: 'detail', technique: `budget ${budget}`, where: `the ${F}`, principle: 'how many, never how big', why: `${budget} units from the ${F} out in one motif (${motif}: ${MOTIFS[motif].reads}); ${budget - left} spent, ${left} left as rest` });
  return { push: out, notes, budget, left, focal: F };
}

/** the register's note */
export function registerNote(S) {
  const word = Object.entries(REGISTER_WORDS).reduce((b, [w, v]) => (Math.abs(v - S.r) < Math.abs(REGISTER_WORDS[b] - S.r) ? w : b), 'grounded');
  return { stage: 'register', technique: S.a ? `warp ${S.a}` : 'none', where: 'the whole creature', principle: 'exaggerate after the design, never into it',
    why: S.a ? `${word}: every push's departure grows (× its own to the ${r3(1 + 0.6 * S.a)}), ornaments × ${r3(1 + 0.5 * S.a)}, the creature × ${r3(1 + 0.25 * S.a)}` : `${word}: the design's own sizes` };
}
