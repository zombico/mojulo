/**
 * THE MIND RESOLVER: a mind (the authored axes) over a body (the measured ones) → what it does in every situation.
 *
 *   resolveMind(mind, entity) → { mind, actions, capability, situations: { [situation]: Choice }, switches, advisories }
 *     mind    { motivation, aggressiveness, rank?, skill? }   rank defaults to minion, skill to regular
 *     Choice  a minion or elite: { strategy, status, why }, the first strategy it qualifies for
 *             a duelist (miniboss, boss): { repertoire: [...ids], status, why }, every qualifying strategy except the
 *             fallback (the fallback alone when nothing else qualifies); `status` is the worst among them
 *   resolveSkill(base, ...tunes)  the skill knobs: a tier name for the whole class, then per-character overrides
 *                                 (a tier name or partial knobs), applied in order: difficulty moves as a class, a
 *                                 boss is fine-tuned
 *   tuningOf({ skill, aggressiveness })  skill knobs then aggressiveness knobs: the runtime's detune record
 *
 * Advisories never refuse: a boss under its rank's typical health is reported, nothing more.
 *
 * Pure and deterministic.
 */
import { SITUATIONS, MOTIVATIONS, AGGRESSIVENESS, RANKS, RANK_SWITCHES, SKILLS, RANK_HP } from './vocab.js';
import { STRATEGIES } from './strategies.js';
import { actionsOf, capabilityOf } from './measure.js';

const SEVERITY = { built: 0, partial: 1, local: 2, absent: 3 };

function check(name, value, table) {
  if (!(value in table)) throw new Error(`mind: unknown ${name} '${value}' (known: ${Object.keys(table).join(', ')})`);
}

export function validateMind(mind) {
  if (!mind || typeof mind !== 'object') throw new Error('mind: a mind is { motivation, aggressiveness, rank?, skill? }');
  check('motivation', mind.motivation, MOTIVATIONS);
  check('aggressiveness', mind.aggressiveness, AGGRESSIVENESS);
  check('rank', mind.rank ?? 'minion', RANKS);
  if (typeof (mind.skill ?? 'regular') === 'string') check('skill', mind.skill ?? 'regular', SKILLS);
  return mind;
}

// does strategy s fit this mind and body? returns the reasons it does, or null
function qualifies(s, mind, has) {
  const why = [];
  for (const w of s.needs || []) { if (!has[w]) return null; why.push(w); }
  if (s.needsAny) { const any = s.needsAny.filter((w) => has[w]); if (!any.length) return null; why.push(any.join('|')); }
  const level = AGGRESSIVENESS[mind.aggressiveness].level;
  if (s.when?.motivation && !s.when.motivation.includes(mind.motivation)) return null;
  if (s.when?.motivation) why.push(mind.motivation);
  if (s.when?.aggr && (level < s.when.aggr[0] || level > s.when.aggr[1])) return null;
  if (s.when?.aggr) why.push(mind.aggressiveness);
  if (s.unless?.motivation?.includes(mind.motivation)) return null;
  return why;
}

const worst = (ids, list) => ids.map((id) => list.find((s) => s.id === id).status).reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), 'built');

export function resolveMind(mind, entity) {
  validateMind(mind);
  const rank = mind.rank ?? 'minion';
  const actions = actionsOf(entity), capability = capabilityOf(entity);
  const has = { ...actions, ...capability };
  const situations = {};
  for (const sit of Object.keys(SITUATIONS)) {
    const list = STRATEGIES[sit];
    const fits = [];
    for (const s of list) { const why = qualifies(s, mind, has); if (why) fits.push({ s, why }); }
    if (RANKS[rank].duels) {
      const real = fits.filter((f) => f.s !== list[list.length - 1]);
      const pick = real.length ? real : fits.slice(-1);
      const repertoire = pick.map((f) => f.s.id);
      situations[sit] = { repertoire, status: worst(repertoire, list), why: pick.map((f) => `${f.s.id}: ${f.why.join(', ') || 'fallback'}`).join('; ') };
    } else {
      const { s, why } = fits[0];
      situations[sit] = { strategy: s.id, status: s.status, why: why.join(', ') || 'fallback' };
    }
  }
  const advisories = [];
  if (capability.hp != null && capability.hp < RANK_HP[rank]) advisories.push(`a ${rank} with ${capability.hp} hp: the rank usually carries ${RANK_HP[rank]} or more`);
  return { mind: { ...mind, rank }, actions, capability, situations, switches: RANK_SWITCHES[rank], advisories };
}

export function resolveSkill(base, ...tunes) {
  check('skill', base, SKILLS);
  let knobs = { ...SKILLS[base] };
  for (const t of tunes) {
    if (t == null) continue;
    if (typeof t === 'string') { check('skill', t, SKILLS); knobs = { ...SKILLS[t] }; continue; }
    for (const k of Object.keys(t)) if (!(k in SKILLS.ace)) throw new Error(`mind: unknown skill knob '${k}' (known: ${Object.keys(SKILLS.ace).join(', ')})`);
    knobs = { ...knobs, ...t };
  }
  return knobs;
}

export function tuningOf(mind) {
  check('aggressiveness', mind.aggressiveness, AGGRESSIVENESS);
  const skill = typeof mind.skill === 'object' ? mind.skill : resolveSkill(mind.skill ?? 'regular');
  return { ...skill, ...(AGGRESSIVENESS[mind.aggressiveness].knobs || {}) };
}
