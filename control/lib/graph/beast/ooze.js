/**
 * OOZES ON THE BEAST-KIN: the animal door's oozes (lib/graph/mutagen: frost, venom, crystal, dire, zombie …), composed by
 * the same law (mutagen/compose.js: a word, or a list of words and { id, strength }, read left to right; form multiplies by
 * strength, the pushes compose by their leaves, tints and marks stack, the marks' dice keyed by `beast.seed`), lowered from
 * a species' ring plan onto the beast's own anatomy words, so a beast-kin is styled into the same compositions an animal is
 * (`beast: { kin, ooze: ['frost', { id: 'venom', strength: 0.5 }], seed }`).
 *
 *   beastOozeOf(beast)  → the composition lowered (memoized on its words), or null when no ooze acts:
 *     mass       { <mass key>: × }      bulk, legBulk, the wedge's fore and hind, the neck, the limbs and the paws
 *     headScale  ×                      the head grown on the neck (beast/head.js)
 *     head       { moves?, eye?, palette? }   the skull's and the muzzle's widths, heights and length, the eye, as the
 *                                       designed head's row moves; the eyes' colour as its iris
 *     ridge, ruff                       hackles, plates or tail spikes → a crest of spines; a ruff → the ruff
 *     spines     { color, glow, material }   the crest's own group, in the hackles' colour or the motif's
 *     claw       { color, glow, material }   the claws in the motif
 *     cover      { …qualities }         the cover's qualities (cover.js COVER_STYLE), the ones its kind takes; `smooth` none
 *     eyes       { color, glow }        glow: the eyes drawn full-bright
 *     expression { control: + }        added over the beast's own
 *     surfaces   { group: material }    the rows' (Hackle → Spines)
 *     groups     { group: { color, material?, glow? } }   a group recoloured, on the body or the head (a chrome
 *                                       faceplate: the library head's Skull and Snout); one the body has not, passed over
 *     push                              the composed push (its colour layers: ./style.js tones the coat)
 *     pending    [ words ]              what the tiered body does not carry from it yet, named
 *
 * The ooze's `scale` (grown whole) is pending: the tiered body's size is its tune's stature, which the operator sets (a
 * record's words are applied again whenever it is rebuilt, so a multiplier there would compound). Pure.
 */
import { resolveMutagen } from '../mutagen/index.js';
import { MOTIFS } from '../mutagen/motif.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r3 = (x) => Math.round(x * 1000) / 1000;

/** the pushes the tiered body reads (everything else in a composed push is pending, named) */
const READ = new Set(['wedge.fore', 'wedge.hind', 'neck', 'limbs.fore', 'limbs.hind', 'limbs.paws', 'head.skull', 'head.muzzle', 'head.eye', 'hackles', 'plates',
  'tailSpikes', 'ruff', 'expression', 'motif', 'motifColor', 'motifGlow', 'surfaces', 'groups', 'smooth', 'cover', 'eyes.color', 'eyes.glow', 'eyes.mix', 'tints', 'coat', 'desaturate', 'saturate']);
const pathsOf = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (READ.has(`${pre}${k}`) ? [`${pre}${k}`] : v && typeof v === 'object' && !Array.isArray(v) ? pathsOf(v, `${pre}${k}.`) : [`${pre}${k}`]));

const memo = new Map();
export function beastOozeOf(B) {
  if (!B || B.ooze === undefined || B.ooze === null) return null;
  const key = JSON.stringify([B.ooze, B.seed ?? null, B.kin ?? null]);
  if (memo.has(key)) return memo.get(key);
  const M = resolveMutagen(B.ooze, { seed: B.seed, key: B.kin ?? 'beast' });
  const L = M ? lower(M) : null;
  if (memo.size > 256) memo.clear();
  memo.set(key, L);
  return L;
}

/** an upright body reads an ooze's girths at this power of each multiplier: a quadruped's wedge (its chest ×1.45, a dire
 * animal's) is drawn for a level trunk and swelled an upright one into a barrel */
export const UPRIGHT_MASS = 0.5;

function lower(M) {
  const F = M.form ?? {}, P = M.push ?? {}, mass = {}, pending = [];
  const times = (keys, k) => { if (k === undefined || k === 1) return; for (const m of keys) mass[m] = (mass[m] ?? 1) * k ** UPRIGHT_MASS; };
  times(['trunk', 'hips', 'neck', 'upperArm', 'foreArm', 'thigh', 'shank'], F.bulk);
  times(['upperArm', 'foreArm', 'hand', 'thigh', 'shank', 'foot'], F.legBulk);
  times(['trunk'], P.wedge?.fore); times(['hips'], P.wedge?.hind); times(['neck'], P.neck);
  times(['upperArm', 'foreArm'], P.limbs?.fore); times(['thigh', 'shank'], P.limbs?.hind); times(['hand', 'foot'], P.limbs?.paws);
  if (F.scale && F.scale !== 1) pending.push(`scale ×${r3(F.scale)} (the tiered body's size is its tune's stature: set tune.stature)`);
  if (F.tailBush && F.tailBush !== 1) pending.push('tailBush (a tail\'s girth is not a beast word yet)');
  if (P.wedge?.broad) pending.push('wedge.broad (the shoulders\' width is the tune\'s)');
  for (const p of pathsOf(P)) if (!READ.has(p) && !/^(wedge\.broad|head\.pace|eyes\.open)$/.test(p)) pending.push(p);
  if (P.head?.pace) pending.push('head.pace (the head keeps the body\'s proportion)');
  if (P.eyes?.open) pending.push('eyes.open (the library head\'s lids are its own)');
  if (P.marks?.length) pending.push(`marks (${[...new Set(P.marks.map((m) => m.group))].join(', ')}: a quadruped's windows; the biped's pattern solver paints them)`);
  if (M.stylism) pending.push('stylism (the register, the chimera and the detail budget are the animal door\'s yet)');
  const motif = P.motif ? MOTIFS[P.motif] : null, motifColor = P.motifColor ?? motif?.color;
  // THE CREST: hackles, plates or tail spikes; its height against the hackles' half a back depth, a plate's taller
  const H = P.hackles ?? P.plates ?? P.tailSpikes, crest = !!H;
  const scale = crest ? clamp((P.hackles?.height ?? P.plates?.height ?? P.tailSpikes?.size ?? 0.5) / 0.5, 0.6, 1.8) : 1;
  const surf = { ...(P.surfaces ?? {}) }; if (surf.Hackle) { surf.Spines = surf.Hackle; delete surf.Hackle; }
  const spines = crest ? { color: P.hackles?.color ?? motifColor ?? null, glow: !!(P.hackles?.glow || P.motifGlow || (!P.hackles?.color && motif?.glow)), scale: r3(scale), material: surf.Spines ?? motif?.material ?? null } : null;
  const claw = motif || P.motifColor ? { color: motifColor, glow: !!(P.motifGlow || motif?.glow), material: motif?.material ?? null } : null;
  const head = {};
  if (P.head?.skull || P.head?.muzzle) head.moves = [...(P.head.skull ? [{ op: 'skull', pivot: -0.02, width: P.head.skull.width ?? 1, height: P.head.skull.height ?? 1 }] : []),
    ...(P.head.muzzle ? [{ op: 'muzzle', pivot: 0.02, length: P.head.muzzle.length ?? 1, width: P.head.muzzle.width ?? 1, height: P.head.muzzle.height ?? 1 }] : [])];
  if (P.head?.eye) head.eye = P.head.eye;
  const eyes = P.eyes?.color ? { color: P.eyes.color, glow: !!P.eyes.glow, mix: P.eyes.mix ?? 1 } : null;
  return {
    oozes: M.oozes, seed: M.seed,
    mass: Object.fromEntries(Object.entries(mass).map(([k, v]) => [k, r3(v)])),
    ...(F.headScale && F.headScale !== 1 ? { headScale: r3(F.headScale) } : {}),
    head, ...(eyes ? { eyes } : {}),
    ridge: crest, ruff: !!P.ruff, ...(spines ? { spines } : {}), ...(claw ? { claw } : {}),
    cover: { ...(P.cover ?? {}) }, smooth: !!P.smooth,
    expression: { ...(P.expression ?? {}) }, surfaces: surf, groups: { ...(P.groups ?? {}) },
    push: P, pending,
  };
}
