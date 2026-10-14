/**
 * CAST DENSITY: a hero's rings set by its target (target.js), not by a console. Each body part's outline is held within
 * the target's pixel error: its radius in pixels (the plan's radii × pixels per metre at the target's framing) says how
 * many sides it wants; a part whose ring misses by more takes the body refine pass's split (station-loft-body.js
 * `refine`, `slots: 'halve'`), twice the sides and a ring between each pair. One split is the most a part takes today;
 * a part still over after it is named in the readout, never refused.
 *
 * The parts are the body's: trunk, neck, limbs, feet. The head, the hands and the fingers carry features, not
 * outline, and keep their own budget.
 *
 *   castDensity(plan, target, { parts?, joints? })   per part: radius in pixels, sides, the error, whether it is split;
 *                               the refine to add (`parts` the hero's DENSITY_PARTS, `joints` its bridges, by default;
 *                               a creature passes its own, creature-drawn.js)
 *   densityPlan(plan, target, { parts?, joints? })   the plan with that refine after the dress's (a part is split once)
 */
import { SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';
import { bridgedChains } from '../polygonizer/tiered-form.js';
import { readTarget, pxPerMetre, sidesFor, outlineError } from './target.js';

/** the body parts the rule sets, right-hand names (a limb's left twin follows its right) */
export const DENSITY_PARTS = Object.freeze(['torso', 'pelvis', 'neck', 'upperArmR', 'foreArmR', 'thighR', 'shankR', 'footR']);
/** a standing figure's height over its highest joint (the head's base): the crown above it, measured on the casts */
export const CROWN_OVER_HEAD_BASE = 1.14;

const r2 = (v) => Math.round(v * 100) / 100;
const flat = (v) => (Array.isArray(v) ? v.flat(Infinity) : [v]).filter(Number.isFinite);
const radiusOf = (g) => Math.max(0, ...flat(g.rA), ...flat(g.rB), ...(g.stations || []).flatMap((s) => flat(s.r)));
const sidesOf = (g, style) => SLOT_FAMILIES[g.slots ?? (g.kind === 'segment' ? style?.limbSlots : style?.slots)]?.length ?? null;
const twin = (p) => (/R$/.test(p) ? [p, p.replace(/R$/, 'L')] : [p]);

/** How a plan's body refine already treats each part: 'split' (its rings halved), 'stations' (rings added, sides kept). */
function refinedHow(plan) {
  const how = new Map();
  for (const e of plan.body?.refine || []) for (const p of e.parts || []) if (how.get(p) !== 'split') how.set(p, e.slots === false ? 'stations' : 'split');
  return how;
}

/** The figure's height in metres, from its plan's joints. */
export const planHeight = (plan) => Math.max(...Object.values(plan.joints || {}).map((j) => j[2])) * CROWN_OVER_HEAD_BASE;

/**
 * Per body part under `target`: { part, radiusPx, sides, errorPx, split } as the plan stands, and `refine`, the entries
 * that split each part still over the error (a part the dress gave stations only takes the split without new stations).
 */
export function castDensity(plan, targetSpec, { parts: names = DENSITY_PARTS, joints } = {}) {
  const target = readTarget(targetSpec), heightM = planHeight(plan), ppm = pxPerMetre(target, heightM);
  const how = refinedHow(plan), byName = Object.fromEntries((plan.segments || []).map((g) => [g.name, g]));
  const parts = [], fresh = [], splitOnly = [];
  for (const name of names) {
    const g = byName[name], base = g && sidesOf(g, plan.style); if (!g || !base) continue;
    const rPx = radiusOf(g) * ppm, split = how.get(name) === 'split', sides = split ? base * 2 : base, errorPx = outlineError(rPx, sides);
    parts.push({ part: name, radiusPx: r2(rPx), sides, wants: Math.ceil(sidesFor(rPx, target.error)), errorPx: r2(errorPx), split });
    if (!split && errorPx > target.error) (how.get(name) === 'stations' ? splitOnly : fresh).push(...twin(name));
  }
  // a bridged limb (tiered-form.js) splits as one chain: its limbs, its hand and its bridges share their seam rings
  const split = (p) => how.get(p) === 'split' || fresh.includes(p) || splitOnly.includes(p);
  for (const chain of new Set(bridgedChains(plan, joints).values())) if (chain.some(split)) for (const p of chain) if (!split(p)) (how.get(p) === 'stations' ? splitOnly : fresh).push(...twin(p));
  const refine = [...(fresh.length ? [{ parts: fresh, slots: 'halve' }] : []), ...(splitOnly.length ? [{ parts: splitOnly, stations: false, slots: 'halve' }] : [])];
  return { target, heightM: r2(heightM), pxPerMetre: r2(ppm), parts, refine };
}

/** The plan with its target's split after the dress's refine; nothing to split ⇒ the plan as it was. */
export function densityPlan(plan, target, opts) {
  const { refine } = castDensity(plan, target, opts);
  return refine.length ? { ...plan, body: { ...(plan.body || {}), refine: [...(plan.body?.refine || []), ...refine] } } : plan;
}

/** The readout: the target, pixels per metre, each part's outline, the worst, and the parts still over after a split. */
export function castDensityReadout(plan, target, triangles) {
  const d = castDensity(plan, target), worst = d.parts.reduce((a, p) => (!a || p.errorPx > a.errorPx ? p : a), null);
  const over = d.parts.filter((p) => p.errorPx > d.target.error).map((p) => p.part);
  return {
    target: { resolution: d.target.resolution, framing: d.target.framing, error: d.target.error, figurePx: d.target.figurePx },
    pxPerMetre: d.pxPerMetre, triangles,
    parts: Object.fromEntries(d.parts.map((p) => [p.part, { radiusPx: p.radiusPx, sides: p.sides, wants: p.wants, errorPx: p.errorPx }])),
    ...(worst ? { worst: { part: worst.part, errorPx: worst.errorPx } } : {}),
    ...(over.length ? { over, advice: `${over.join(', ')} still miss the outline by more than ${d.target.error} px after one split: a looser error, a wider framing, or a lower resolution` }
      // the rule only adds rings: a target that wants far fewer than the figure has says so, and names the lighter register
      : d.parts.length && worst.errorPx <= d.target.error / 2 && d.parts.every((p) => p.wants < p.sides) ? { advice: `every part holds its outline within half the error with fewer sides than it has: register 'lowpoly' spends less` } : {}),
  };
}
