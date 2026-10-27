/**
 * THE ROSTER — a field of cartoon racers, each in the machine its driver reads as (racer.js), and the law over them:
 * BALANCE. Every machine's handling is derived from what was built (its mass from its shell, engine, tyres and driver;
 * its power from its engine at its size; its drag from its silhouette at its size; its grip from its tyres; its
 * centre of gravity from its stance), so a racer's "stats" are readouts, never dials. The law reads them as five
 * measures:
 *
 *   top      top speed (m/s): power against drag and rolling
 *   pull     the pull at 8 m/s (m/s²): power over mass, less drag and rolling, capped by traction
 *   corner   the cornering limit (m/s²): grip, or sooner where a high, narrow machine would roll
 *   turn     how quickly it turns in (rad/s at 10 m/s on full lock): a short wheelbase darts
 *   heft     mass (kg): who wins a bump
 *
 * Balance: none best on all five, and none bettered by another on every one (each has something over every rival).
 * A machine that fails is leaned: its engine or tyres swapped (the solver's runners-up first, then the rest of the
 * family; then the machine that betters it) until the field fails less, each change kept with its reason.
 *
 *   racerSpec(entry, k, seed, setting?)   an entry (an archetype, a brief in words, or { archetype?, build?, age?,
 *                                 brief?, facets?, seed?, parts?, shade?, tuning?, light? }) → the recipe { facets, brief?,
 *                                 seed, parts?, shade, tuning?, setting?, light } (minted gloss in the form render unless
 *                                 the entry names its own)
 *   racerOf(spec, { form? })      → { R, S } the reading and the solved machine (what a figures entry resolves through;
 *                                   `form`, a gen-7 read, or the spec's `light: 'form'`: its materials for the page)
 *   racerMeasures(S)              → { top, pull, corner, turn, heft }
 *   racerRule(S, { tuning, conditions })   the drive rule the machine plays by (arcade by default)
 *   balanceOf(measures)           → { holds, best: { measure: [i] }, everything: [i], bettered: [{ i, by }] }
 *   solveRoster(entries | n, { seed, setting? })   → { racers: [{ spec, archetype, R, S, measures, rule }], balance, changes }
 *
 * Pure and deterministic: a roster of n draws distinct archetypes in a seeded order.
 */
import { rollEgocube } from '../egocube/egocube.js';
import { ARCHETYPES } from '../egocube/facets.js';
import { leanOf, tuningOf } from '../egocube/setting.js';
import { mascotOfPerson } from '../egocube/mascot-from-person.js';
import { mascotPlanFromSheet } from '../egocube/mascot-form.js';
import { envelopeOf, ruleOf, wheelPower } from '../roads/vehicles.js';
import { mulberry32 } from '../vegetation/grow.js';
import { racerFromSheet, solveRacer, SHADES } from './racer.js';
import { PARTS } from './parts.js';

const G = 9.81, RHO = 1.225;
const r3 = (v) => Math.round(v * 1000) / 1000;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`car-designer: ${m}`);
const SPEC_KEYS = ['archetype', 'build', 'age', 'brief', 'facets', 'seed', 'parts', 'shade', 'tuning', 'light'];
const TUNINGS = ['person', 'mascot'];

export const MEASURES = Object.freeze({ top: 'top speed', pull: 'pull', corner: 'cornering', turn: 'turn-in', heft: 'weight in a bump' });
// the solver's families a lean may swap, in the order it tries them
const LEANS = ['engine', 'wheel'];
const HARD = ['touches', 'wheel-clear', 'budget'];

/** An entry of a roster → its recipe: { facets, brief?, seed, parts?, shade?, tuning?, setting? } (`setting`: the game's,
 * egocube/setting.js, kept in the recipe so the figure the world resolves through it is the one the roster rolled; in
 * it, a racer whose entry names no `tuning` is a mascot on the setting's own die, setting.js tuningOf). */
// a racer minted now: the gloss finish (racer.js: smooth, its tyres turned) in the form render (form-light.js), unless
// the entry names its own; a stored recipe keeps what it was written with
const MINT = Object.freeze({ shade: 'gloss', light: 'form' });
export function racerSpec(entry, k = 0, seed = 1, setting) {
  const s0 = seed * 31 + 7 * k + 1;
  const tuning = (t) => (t ?? (setting ? tuningOf(setting, seed, `racer/${k}`) : 'person'));
  const inGame = (t) => ({ ...(tuning(t) === 'mascot' ? { tuning: 'mascot' } : {}), ...(setting ? { setting } : {}) });
  if (typeof entry === 'string') {
    const w = entry.trim();
    if (!w) throw fail('a racer is an archetype, a brief in words, or { archetype?, build?, age?, brief?, facets?, seed?, parts?, shade?, tuning? }');
    return ARCHETYPES[w] ? { facets: { archetype: w }, seed: s0, ...inGame(), ...MINT } : { facets: {}, brief: w, seed: s0, ...inGame(), ...MINT };
  }
  if (!isObj(entry)) throw fail('a racer is an archetype, a brief in words, or { archetype?, build?, age?, brief?, facets?, seed?, parts?, shade? }');
  for (const key of Object.keys(entry)) if (!SPEC_KEYS.includes(key)) throw fail(`a racer's ${key} is not one of ${SPEC_KEYS.join(', ')}`);
  if (entry.facets !== undefined && !isObj(entry.facets)) throw fail('a racer\'s facets are the Egocube\'s ({ archetype, build, age, role, … })');
  if (entry.parts !== undefined && !isObj(entry.parts)) throw fail('a racer\'s parts are pins { family: id }');
  if (entry.seed !== undefined && !Number.isInteger(entry.seed)) throw fail('a racer\'s seed is a whole number');
  if (entry.shade !== undefined && !SHADES.includes(entry.shade)) throw fail(`a racer's shade is one of ${SHADES.join(', ')}`);
  if (entry.tuning !== undefined && !TUNINGS.includes(entry.tuning)) throw fail(`a racer's tuning is ${TUNINGS.join(' or ')} (mascot: its driver drawn as its mascot)`);
  if (entry.light !== undefined && !['form', 'paint'].includes(entry.light)) throw fail('a racer\'s light is form (its materials lit by the page: the seventh generation\'s) or paint (its light baked in)');
  const facets = { ...(entry.facets ?? {}), ...Object.fromEntries(['archetype', 'build', 'age'].filter((x) => entry[x] !== undefined).map((x) => [x, entry[x]])) };
  return { facets, ...(entry.brief ? { brief: entry.brief } : {}), seed: entry.seed ?? s0, ...(entry.parts ? { parts: entry.parts } : {}), shade: entry.shade ?? MINT.shade, ...inGame(entry.tuning), light: entry.light ?? MINT.light };
}

/** A recipe's reading and machine. */
export function racerOf(spec, { form = false } = {}) {
  const sheet = rollEgocube({ facets: spec.facets ?? {}, ...(spec.brief ? { brief: spec.brief } : {}), seed: spec.seed ?? 1, ...(spec.setting ? { setting: spec.setting } : {}) });
  // a mascot racer: the machine read off the person, the driver in the seat its mascot (in the game's setting, kept on the sheet)
  const R0 = racerFromSheet(sheet, { seed: spec.seed ?? 1 });
  const R = spec.tuning === 'mascot' ? { ...R0, mascot: { plan: mascotPlanFromSheet(mascotOfPerson(sheet)).create.spec.plan } } : R0;
  // (the form render: the recipe's word, else the read's era)
  const lit = spec.light === 'form' || (spec.light === undefined && form);
  return { R, S: solveRacer(R, { seed: spec.seed ?? 1, parts: spec.parts ?? {}, ...(spec.shade ? { shade: spec.shade } : {}), ...(lit ? { form: true } : {}) }) };
}

/** A machine's five measures, read off its derived physics. */
export function racerMeasures(S) {
  const p = S.physics, env = envelopeOf(p), u = 8;
  const pull = Math.min(env.launch, wheelPower(p) / (p.mass * u) - (0.5 * RHO * p.CdA * u * u + p.Crr * p.mass * G) / p.mass);
  return { top: env.top, pull: r3(pull), corner: r3(G * Math.min(p.grip, env.stability ?? p.grip)), turn: r3((10 * Math.tan(Math.atan(p.wheelbase / p.turn))) / p.wheelbase), heft: r3(p.mass) };
}

/** The drive rule a machine plays by: its own numbers at a tuning (arcade: a cartoon racer's) and in conditions. */
export function racerRule(S, { tuning = 'arcade', conditions = 'dry' } = {}) {
  return ruleOf(S.physics, { tuning, conditions, vehicle: 'racer' });
}

/** The balance law over a field's measures. */
export function balanceOf(ms) {
  const keys = Object.keys(MEASURES), best = {};
  for (const k of keys) { const top = Math.max(...ms.map((m) => m[k])); best[k] = ms.map((m, i) => (m[k] === top ? i : -1)).filter((i) => i >= 0); }
  const everything = ms.length > 1 ? ms.map((_, i) => i).filter((i) => keys.every((k) => best[k].length === 1 && best[k][0] === i)) : [];
  const bettered = [];
  ms.forEach((m, i) => ms.forEach((o, j) => { if (i !== j && keys.every((k) => o[k] >= m[k]) && keys.some((k) => o[k] > m[k])) bettered.push({ i, by: j }); }));
  return { holds: !everything.length && !bettered.length, best, everything, bettered };
}

/** A field of racers, balanced. `field`: n (2 to 8, a seeded draw of distinct archetypes) or a list of entries.
 * `setting`, the game's (egocube/setting.js): its genre's archetype lean weights the draw, and every racer is rolled in it. */
export function solveRoster(field, { seed = 1, setting } = {}) {
  let entries;
  if (Number.isInteger(field)) {
    if (field < 1 || field > 8) throw fail('a roster is 1 to 8 racers');
    const rnd = mulberry32((seed * 2654435761 + 97) >>> 0), pool = Object.keys(ARCHETYPES);
    const lean = setting ? leanOf(setting, 'person').archetype : null;
    if (lean) {
      // a weighted draw without replacement: each archetype keyed u^(1/w) and the highest kept (an archetype leaned to 0 last)
      const key = Object.fromEntries(pool.map((a) => { const w = lean[a] ?? 1, u = rnd(); return [a, w > 0 ? Math.log(u) / w : -Infinity]; }));
      pool.sort((a, b) => key[b] - key[a]);
    } else for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    entries = pool.slice(0, field);
  } else if (Array.isArray(field) && field.length >= 1 && field.length <= 8) entries = field;
  else throw fail('a roster is a number of racers (1 to 8) or a list of them (an archetype, a brief, or { archetype?, … })');
  const racers = entries.map((e, k) => {
    const spec = racerSpec(e, k, seed, setting), { R, S } = racerOf(spec);
    return { spec, archetype: R.archetype, R, S, measures: racerMeasures(S) };
  });
  // the lean: a racer bettered everywhere by another (or best everywhere) takes a runner-up engine or tyre that gives
  // it something of its own without costing the field its balance; a pinned family is the creator's, never swapped
  const changes = [];
  const fails = (B) => B.bettered.length + B.everything.length;
  for (let pass = 0; pass < 2 * racers.length; pass++) {
    const B = balanceOf(racers.map((r) => r.measures));
    if (B.holds) break;
    let took = null;
    // the bettered first, then those that better them (a machine best everywhere gives something up)
    for (const i of [...new Set([...B.bettered.map((b) => b.i), ...B.everything, ...B.bettered.map((b) => b.by)])]) {
      const r = racers[i], by = B.bettered.find((b) => b.i === i)?.by ?? null, over = B.bettered.find((b) => b.by === i)?.i ?? null;
      for (const fam of LEANS) {
        if (r.spec.parts?.[fam]) continue;
        // its runners-up first, then the rest of the family
        const alts = [...(r.S.suggestions[fam] ?? []).map((x) => x.id), ...Object.keys(PARTS).filter((k) => PARTS[k].family === fam)];
        for (const id of [...new Set(alts)]) {
          if (id === r.S.ids[fam]) continue;
          const alt = { id };
          const spec = { ...r.spec, parts: { ...(r.spec.parts ?? {}), [fam]: alt.id } };
          let R, S;
          try { ({ R, S } = racerOf(spec)); } catch { continue; }   // (a part this machine cannot take: a hidden engine is a cowl)
          if (S.laws.some((l) => HARD.includes(l.law))) continue;
          // taken when the field fails less for it
          const m = racerMeasures(S);
          if (fails(balanceOf(racers.map((x, j) => (j === i ? m : x.measures)))) < fails(B)) { took = { i, by, over, fam, alt, spec, R, S, m }; break; }
        }
        if (took) break;
      }
      if (took) break;
    }
    if (!took) break;
    const r = racers[took.i], was = r.S.ids[took.fam];
    racers[took.i] = { ...r, spec: took.spec, R: took.R, S: took.S, measures: took.m };
    changes.push({ racer: took.i, archetype: r.archetype, family: took.fam, from: was, to: took.alt.id, why: took.by !== null ? `the ${racers[took.by].archetype}'s machine bettered it on every measure: ${took.alt.id} in place of ${was}` : took.over !== null ? `it bettered the ${racers[took.over].archetype}'s on every measure: ${took.alt.id} in place of ${was}` : `best on every measure: ${took.alt.id} in place of ${was}` });
  }
  return { racers, balance: balanceOf(racers.map((r) => r.measures)), changes };
}
