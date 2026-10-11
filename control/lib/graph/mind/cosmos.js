/**
 * The Mind facet's authored axes, as the cosmos registry reads them: each value's status is FOUND by resolving it on a
 * reference body that holds every verb, and taking the worst strategy it needs. So a motivation is `built` only when
 * every strategy it resolves to runs in a general module, `local` while some still live only inside the arena, and
 * `absent` while some exist nowhere. The note names those strategies.
 *
 *   mindAxisValues() → { motivation, aggressiveness, rank, skill }: { [value]: { status, note?, effort?, pkg?, lowers? } }
 *
 * A local value belongs to the mind-lift package (cosmos/packages.js). Pure; imports the resolver only.
 */
import { MOTIVATIONS, AGGRESSIVENESS, RANKS, SKILLS } from './vocab.js';
import { STRATEGIES } from './strategies.js';
import { resolveMind } from './resolve.js';

// a body that holds every verb (and no patrol route, which would win idle first), so a value's status reflects the
// mind, not one body's limits
const ARMED = Object.freeze({
  rule: { type: 'ai', meleeSeek: true, boost: true, jumpSpeed: 1, loadout: [{ strike: 'melee' }, { weapon: { fireClass: 'lob' } }, { weapon: { fireClass: 'area' } }] },
});
const BASE = Object.freeze({ motivation: 'hunt', aggressiveness: 'bold', rank: 'minion' });
// a motivation is judged at its natural temperament: the fighting goals at bold, the rest at passive, so a forager's
// status is about foraging, not about a fight it would never start
const NATURAL = Object.freeze({ hunt: 'bold', guard: 'bold', territorial: 'bold' });
const SEVERITY = { built: 0, partial: 1, local: 2, absent: 3 };
const MODULE = 'lib/graph/mind/resolve.js';

const statusOf = (sit, id) => STRATEGIES[sit].find((s) => s.id === id).status;

function rowFor(mind) {
  const r = resolveMind(mind, ARMED);
  const short = [];
  let status = 'built';
  for (const [sit, c] of Object.entries(r.situations)) {
    for (const id of c.repertoire ?? [c.strategy]) {
      const st = statusOf(sit, id);
      if (st !== 'built') short.push(`${sit}: ${id} (${st})`);
      if (SEVERITY[st] > SEVERITY[status]) status = st;
    }
  }
  // a duelist's switching ways
  for (const w of r.switches) {
    const st = 'built';   // rotate, phase and adapt all run in the engine's mind
    short.push(`switch: ${w} (${st})`);
    if (SEVERITY[st] > SEVERITY[status]) status = st;
  }
  const row = { status, lowers: MODULE };
  if (short.length) row.note = short.join('; ');
  if (status === 'local') Object.assign(row, { effort: 'M', pkg: 'mind-lift' });
  if (status === 'absent') row.effort = 'M';
  return row;
}

export function mindAxisValues() {
  const out = { motivation: {}, aggressiveness: {}, rank: {}, skill: {} };
  for (const m of Object.keys(MOTIVATIONS)) out.motivation[m] = rowFor({ ...BASE, motivation: m, aggressiveness: NATURAL[m] || 'passive' });
  for (const a of Object.keys(AGGRESSIVENESS)) out.aggressiveness[a] = rowFor({ ...BASE, aggressiveness: a });
  for (const k of Object.keys(RANKS)) out.rank[k] = rowFor({ ...BASE, rank: k });
  // skill knobs detune after deciding: the engine's mind applies them, for a class (aiDifficulty) or one character
  for (const s of Object.keys(SKILLS)) out.skill[s] = { status: 'built', lowers: 'lib/graph/worlds/controllable/mind.js' };
  return out;
}
