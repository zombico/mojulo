/**
 * A ROLLED WAY UP — a meru's own tiers varied by a seed, so a trail laid from a new seed is not the stock island. The
 * same number of tiers, the same forms and ways up, the same plan's sides: each mound's height, foot, summit and
 * bulge, each spiral's turns and hand and each tower's deck drawn in a band (ROLL) round the recipe's own.
 *
 * A roll is kept only when it breaks no law the recipe's own tiers keep (plan.js localMeruLaws: the steps, the
 * landings, the shelves, a tier inside the top below); else the next roll, and after ROLLS the recipe as it is.
 *
 *   rollTiers(recipe, seed)   → the recipe with its tiers rolled (`tiers` in place of `preset` or the older words)
 *
 * Pure: mulberry32 dice from the seed, so the same recipe and seed roll the same tiers.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { FORMS, UPS, readLocalMeru, planLocalMeru, localMeruLaws } from './plan.js';

/** Each rolled dial's band: a factor on the recipe's own (turns: added). */
export const ROLL = Object.freeze({ height: [0.75, 1.3], foot: [0.85, 1.2], summit: [0.8, 1.2], profile: [0.85, 1.15], deck: [0.8, 1.25], turns: [-0.25, 0.5] });
const ROLLS = 8;

const r2 = (x) => Math.round(x * 100) / 100;
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

function rollTier(t, rnd) {
  const by = (k, v) => r2(v * (ROLL[k][0] + (ROLL[k][1] - ROLL[k][0]) * rnd()));
  const dials = pick(t, Object.keys(FORMS[t.form].dials)), up = { via: t.up.via, ...pick(t.up, Object.keys(UPS[t.up.via])) };
  if (t.form === 'mound') {
    dials.height = by('height', dials.height);
    dials.foot = by('foot', dials.foot);
    dials.summit = Math.min(by('summit', dials.summit), r2(dials.foot * 0.8));
    dials.profile = by('profile', dials.profile);
  }
  if (t.form === 'tower') dials.deck = by('deck', dials.deck);
  if (up.via === 'spiral') {
    up.turns = Math.max(0.5, r2(up.turns + ROLL.turns[0] + (ROLL.turns[1] - ROLL.turns[0]) * rnd()));
    up.hand = rnd() < 0.5 ? 'left' : 'right';
  }
  return { form: t.form, id: t.id, ...dials, up };
}

export function rollTiers(recipe, seed) {
  const own = readLocalMeru(recipe), { preset: _p, mound: _m, path: _a, tower: _t, ...rest } = recipe;
  const base = { ...rest, ...(own.approach !== null ? { approach: own.approach } : {}) };
  // the laws the recipe's own tiers keep: a roll may break none of them (one the recipe already breaks is not the roll's)
  const kept = new Set(localMeruLaws(planLocalMeru(recipe)).filter((l) => l.ok).map((l) => l.law));
  for (let k = 0; k < ROLLS; k++) {
    const rnd = mulberry32(Math.imul(seed | 0, 0x9e3779b1) + k * 0x632be5ab);
    const next = { ...base, tiers: own.tiers.map((t) => rollTier(t, rnd)) };
    let laws;
    try { laws = localMeruLaws(planLocalMeru(next)); } catch { continue; }
    if (laws.every((l) => l.ok || !kept.has(l.law))) return next;
  }
  return recipe;
}
