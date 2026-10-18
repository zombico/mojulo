/**
 * fractal-structure / read — a structure's words against its preset, every dial checked, a teaching error naming the
 * choices for any word that does not read.
 *
 *   { id?, preset?, seed?, at: [x, y, z?], turn?, size?, height?,
 *     plan?    a plan word or { form, …dials } (plan.js)
 *     rise?    { tiers, curve, power?, top, diminish, stepped?, twist?, cornice?: { depth, height } | false }
 *     crown?   'disc' | 'dome' | 'finial' | 'none', or { form, ribs?, size? }
 *     echo?    false, or { depth, scale, where: 'faces' | 'corners' | 'both', around, rings, reach, sink }
 *     plinth?  false, or { steps, height, margin }
 *     palette? { body?, band?, crown?, plinth? } }
 *
 * `size` is the base's width and `height` the body's (the plinth and the crown stand outside it), in the world's
 * own units. `auto` rolls a preset and jitters a few of its dials from the seed, each from its own labelled stream,
 * so a later dial never reshuffles an earlier roll; the preset it rolled is in the readout.
 */
import { readPlan } from './plan.js';
import { PRESETS, PRESET_IDS, AUTO_POOL } from './presets.js';
import { streamOf } from '../city/plan/dice.js';

/** The rise's curvature words → the power p in r(f) = top + (1 − top)(1 − f^p). */
export const CURVES = Object.freeze({ needle: 0.6, cone: 1, rekha: 2, bulb: 3.2, dome: 6 });
export const CROWN_FORMS = Object.freeze(['disc', 'dome', 'finial', 'none']);
export const ECHO_WHERE = Object.freeze(['faces', 'corners', 'both']);
export const DEFAULT_SIZE = 12;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-fA-F]{6}$/;

function num(v, at, lo, hi, { int = false } = {}) {
  if (!Number.isFinite(v) || v < lo || v > hi || (int && !Number.isInteger(v))) {
    throw new Error(`${at}: ${int ? 'a whole number' : 'a number'} from ${lo} to ${hi} (got ${JSON.stringify(v)})`);
  }
  return v;
}

function only(o, keys, at) {
  for (const k of Object.keys(o)) if (!keys.includes(k)) throw new Error(`${at}.${k}: not a word here; ${at} takes ${keys.join(', ')}`);
}

const merge = (base, over) => (over === undefined ? base : over === false ? false : isObj(base) && isObj(over) ? { ...base, ...over } : over);

function rolled(seed) {
  const pick = (layer, list) => list[Math.floor(streamOf(seed, 'fractal-structure', layer)() * list.length)];
  const id = pick('preset', AUTO_POOL);
  const P = PRESETS[id];
  const tiers = Math.max(2, P.rise.tiers + pick('tiers', [-2, -1, 0, 0, 1, 2]));
  const twist = P.rise.stepped ? pick('twist', [0, 0, 15, 22.5, 45]) : 0;
  const plan = pick('plan', [P.plan, P.plan, { form: 'turned', sides: 4, k: 2 }, { form: 'turned', sides: 4, k: 3 }, { form: 'offset', bays: 3, project: 0.14, depth: 1 }, { form: 'stepped-circle', steps: 4 }]);
  const echo = P.echo ? { ...P.echo, depth: pick('echo', [1, 1, 2]) } : pick('echo', [false, false, { depth: 1, scale: 0.35, where: 'faces', around: 4, rings: 1, reach: 0, sink: 0.45 }]);
  return { id, words: { ...P, plan, echo, rise: { ...P.rise, tiers, ...(twist ? { twist } : {}) } } };
}

/** One structure's words → the resolved structure every later step reads. Throws naming what reads. */
export function readStructure(spec, at = 'structures[0]') {
  if (!isObj(spec)) throw new Error(`${at}: a structure is { preset?, at: [x, y, z?], size?, height?, plan?, rise?, crown?, echo?, plinth?, palette? }`);
  only(spec, ['id', 'preset', 'seed', 'at', 'turn', 'size', 'height', 'plan', 'rise', 'crown', 'echo', 'plinth', 'palette'], at);
  const presetWord = spec.preset ?? (spec.plan === undefined ? 'spire' : null);
  if (presetWord !== null && !PRESET_IDS.includes(presetWord)) throw new Error(`${at}.preset: one of ${PRESET_IDS.join(', ')} (got ${JSON.stringify(presetWord)})`);
  const seed = spec.seed ?? 1;
  num(seed, `${at}.seed`, 0, 2 ** 31, { int: true });
  const roll = presetWord === 'auto' ? rolled(seed) : null;
  const base = roll ? roll.words : presetWord ? PRESETS[presetWord] : PRESETS.spire;
  const resolvedPreset = roll ? roll.id : presetWord;

  if (!Array.isArray(spec.at) || spec.at.length < 2 || spec.at.length > 3 || !spec.at.every(Number.isFinite)) throw new Error(`${at}.at: where it stands, [x, y] or [x, y, z] in the world's units (got ${JSON.stringify(spec.at)})`);
  const size = num(spec.size ?? DEFAULT_SIZE, `${at}.size`, 0.1, 5000);
  const height = num(spec.height ?? size * base.aspect, `${at}.height`, 0.1, 20000);
  const turn = num(spec.turn ?? 0, `${at}.turn`, -3600, 3600);
  const plan = readPlan(spec.plan ?? base.plan, `${at}.plan`);

  const r = merge(base.rise, spec.rise);
  if (!isObj(r)) throw new Error(`${at}.rise: { tiers, curve, power?, top, diminish, stepped?, twist?, cornice? }`);
  only(r, ['tiers', 'curve', 'power', 'top', 'diminish', 'stepped', 'twist', 'cornice'], `${at}.rise`);
  if (r.curve !== undefined && !(r.curve in CURVES)) throw new Error(`${at}.rise.curve: one of ${Object.keys(CURVES).join(', ')} (got ${JSON.stringify(r.curve)})`);
  const cor = r.cornice === undefined ? { depth: 0.04, height: 0.12 } : r.cornice;
  if (cor !== false && !isObj(cor)) throw new Error(`${at}.rise.cornice: { depth, height } (fractions of the width and of each tier) or false`);
  if (cor) only(cor, ['depth', 'height'], `${at}.rise.cornice`);
  const rise = {
    tiers: num(r.tiers ?? 6, `${at}.rise.tiers`, 1, 24, { int: true }),
    power: num(r.power ?? CURVES[r.curve ?? 'cone'], `${at}.rise.power`, 0.2, 12),
    top: num(r.top ?? 0.3, `${at}.rise.top`, 0.02, 1),
    diminish: num(r.diminish ?? 1, `${at}.rise.diminish`, 0.6, 1.2),
    stepped: r.stepped === true,
    twist: num(r.twist ?? 0, `${at}.rise.twist`, -90, 90),
    cornice: cor ? { depth: num(cor.depth ?? 0.04, `${at}.rise.cornice.depth`, 0, 0.5), height: num(cor.height ?? 0.12, `${at}.rise.cornice.height`, 0.01, 0.6) } : false,
  };

  const cw = merge(base.crown, typeof spec.crown === 'string' ? { form: spec.crown } : spec.crown);
  const c = typeof cw === 'string' ? { form: cw } : cw || { form: 'none' };
  if (!isObj(c) || !CROWN_FORMS.includes(c.form)) throw new Error(`${at}.crown: one of ${CROWN_FORMS.join(', ')}, or { form, ribs?, size? }`);
  only(c, ['form', 'ribs', 'size'], `${at}.crown`);
  const crown = { form: c.form, ribs: num(c.ribs ?? 32, `${at}.crown.ribs`, 4, 96, { int: true }), size: num(c.size ?? 1.4, `${at}.crown.size`, 0.2, 4) };

  const e = merge(base.echo, spec.echo);
  let echo = false;
  if (e) {
    if (!isObj(e)) throw new Error(`${at}.echo: { depth, scale, where, around, rings, reach, sink } or false`);
    only(e, ['depth', 'scale', 'where', 'around', 'rings', 'reach', 'sink'], `${at}.echo`);
    if (e.where !== undefined && !ECHO_WHERE.includes(e.where)) throw new Error(`${at}.echo.where: one of ${ECHO_WHERE.join(', ')} (got ${JSON.stringify(e.where)})`);
    echo = {
      depth: num(e.depth ?? 1, `${at}.echo.depth`, 0, 3, { int: true }),
      scale: num(e.scale ?? 0.4, `${at}.echo.scale`, 0.05, 0.75),
      where: e.where ?? 'faces',
      around: num(e.around ?? 4, `${at}.echo.around`, 2, 16, { int: true }),
      rings: num(e.rings ?? 1, `${at}.echo.rings`, 1, 6, { int: true }),
      reach: num(e.reach ?? 0.5, `${at}.echo.reach`, 0, 1),
      sink: num(e.sink ?? 0.45, `${at}.echo.sink`, 0, 1),
    };
    if (!echo.depth) echo = false;
  }

  const p = merge(base.plinth, spec.plinth);
  let plinth = false;
  if (p) {
    if (!isObj(p)) throw new Error(`${at}.plinth: { steps, height, margin } (fractions of the width) or false`);
    only(p, ['steps', 'height', 'margin'], `${at}.plinth`);
    plinth = { steps: num(p.steps ?? 1, `${at}.plinth.steps`, 1, 8, { int: true }), height: num(p.height ?? 0.06, `${at}.plinth.height`, 0.005, 1), margin: num(p.margin ?? 0.2, `${at}.plinth.margin`, 0, 2) };
  }

  const pal = { ...base.palette, ...(spec.palette ?? {}) };
  if (spec.palette !== undefined && !isObj(spec.palette)) throw new Error(`${at}.palette: { body?, band?, crown?, plinth? } as #rrggbb`);
  only(pal, ['body', 'band', 'crown', 'plinth'], `${at}.palette`);
  for (const [k, v] of Object.entries(pal)) if (!HEX.test(v)) throw new Error(`${at}.palette.${k}: a #rrggbb colour (got ${JSON.stringify(v)})`);

  return {
    id: typeof spec.id === 'string' && spec.id ? spec.id : at.replace(/\W+/g, '-').replace(/-$/, ''),
    preset: resolvedPreset,
    at: [spec.at[0], spec.at[1], spec.at[2] ?? 0],
    turn, size, height, plan, rise, crown, echo, plinth, palette: pal,
  };
}

/** Every structure in a list → its errors (empty when all read). */
export function validateStructures(list) {
  if (!Array.isArray(list)) return ['structures: a list of { preset?, at: [x, y, z?], size?, … }'];
  if (list.length > 64) return [`structures: at most 64 structures in one world (got ${list.length})`];
  const errs = [];
  list.forEach((s, i) => { try { readStructure(s, `structures[${i}]`); } catch (err) { errs.push(err.message); } });
  return errs;
}
