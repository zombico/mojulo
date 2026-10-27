/**
 * THE FOE RESOLVER: a foe (a class at a rank, on a body) → the controllable entity it plays as, the mind that entity
 * resolves to (mind/resolve.js, on the entity itself, so a class whose attack its body cannot carry out is the mind's to
 * report, not a second check's), its toll in the hero's frame, its attack's timing and what lowers it today.
 *
 *   resolveFoe({ class, rank?, skill?, skin?, group? }, { hero? })
 *     → { class, rank, skill, body, skin, measured, entity, mind, toll: { downs, harm, hp, damage }, attack: { kind,
 *         timing, pattern?, reach?, zone? }, stomp, threat, status, marks, short, advisories }
 *     `skin` the species and what grows it, as the animal door takes them; `measured` the grown body (./fit.js bodyOf)
 *     rank    mind/vocab.js RANKS (minion default): × the class's downs and threat (./vocab.js FOE_RANKS)
 *     skill   mind/vocab.js SKILLS (regular default)
 *     skin    { species?, ooze?, stylism? }: the body it plays on, grown by its oozes and checked against the class
 *             (./fit.js, on the grown body); absent, its `standIn`
 *     group   the id a swarm's members share (rule.mind.group); absent, the class's id
 *     hero    the frame (./vocab.js HERO): its run sets a pace's speed, its blow and its hit price the toll
 *
 * The entity's attack is the Power verb its class's attack holds (a blade slot, a weapon); `contact` and `charge` have
 * no verb yet (their status says so) and lay nothing. Nothing here reaches a plan or a page.
 *
 * Pure and deterministic.
 */
import { PACES, MOVES, ATTACKS, FOE_RANKS, HERO } from './vocab.js';
import { foeClass, classStatus } from './index.js';
import { checkFit } from './fit.js';
import { RANKS, SKILLS } from '../mind/vocab.js';
import { resolveMind } from '../mind/resolve.js';
import { RANGED } from '../gameworld/feel/kernel.js';
import { mutagenErrors } from '../mutagen/index.js';

const FPS = 60;
const r3 = (v) => Math.round(v * 1000) / 1000;
const SKIN_KEYS = ['species', 'ooze', 'stylism'];
const SPEC_KEYS = ['class', 'rank', 'skill', 'skin', 'group'];

function check(what, v, table) {
  if (!(v in table)) throw new Error(`foe: unknown ${what} '${v}' (known: ${Object.keys(table).join(', ')})`);
}

// the attack's Power verb on the rule: a blade slot the mind draws, or a weapon it fires
function armed(rule, entity, A, damage) {
  const t = A.timing;
  if (A.verb === 'melee') {
    Object.assign(rule, { meleeSeek: true, meleeCombo: false });
    rule.loadout = [{ name: 'blow', strike: 'melee', strikeReach: A.reach, strikeDamage: damage, strikeDur: r3(((t.startup ?? 0) + (t.active ?? 0) + (t.recovery ?? 0)) / FPS) }];
  } else if (A.fireClass) {
    entity.weapon = { fireClass: A.fireClass, damage };
  }
}

export function resolveFoe(spec, { hero = HERO } = {}) {
  if (!spec || typeof spec !== 'object') throw new Error('foe: a foe is { class, rank?, skill?, skin?, group? }');
  for (const k of Object.keys(spec)) if (!SPEC_KEYS.includes(k)) throw new Error(`foe: no key '${k}' (known: ${SPEC_KEYS.join(', ')})`);
  const c = foeClass(spec.class), rank = spec.rank ?? 'minion', skill = spec.skill ?? 'regular';
  check('rank', rank, RANKS); check('skill', skill, SKILLS);
  if (spec.skin !== undefined) {
    if (!spec.skin || typeof spec.skin !== 'object') throw new Error('foe: .skin is { species?, ooze?, stylism? }');
    for (const k of Object.keys(spec.skin)) if (!SKIN_KEYS.includes(k)) throw new Error(`foe: .skin has no key '${k}' (known: ${SKIN_KEYS.join(', ')})`);
  }
  const species = spec.skin?.species ?? c.standIn;
  const grown = { ...(spec.skin?.ooze !== undefined ? { ooze: spec.skin.ooze } : {}), ...(spec.skin?.stylism !== undefined ? { stylism: spec.skin.stylism } : {}) };
  const errs = mutagenErrors(grown.ooze, undefined, grown.stylism);
  if (errs.length) throw new Error(`foe: .skin: ${errs.join('; ')}`);
  const { body: measured } = checkFit(c.id, species, grown);

  const M = MOVES[c.move], W = ATTACKS[c.attack.kind];
  const A = { ...W, ...c.attack, timing: { ...(W.timing || {}), ...(c.attack.timing || {}) } };
  if (A.pattern !== undefined) check('shot pattern', A.pattern, RANGED);
  const R = FOE_RANKS[rank];
  const downs = c.toll.downs * R.downs, damage = c.toll.harm * hero.hit;

  const mind = {
    motivation: c.mind.motivation ?? M.mind.motivation, aggressiveness: c.mind.aggressiveness, rank, skill,
    ...(c.mind.perception ? { perception: c.mind.perception } : {}), ...(c.mind.pathing ? { pathing: c.mind.pathing } : {}),
    ...(M.group ? { group: { id: spec.group ?? c.id, ...M.group } } : {}),
  };
  const rule = { type: 'ai', dodge: false, mind, ...(c.pace ? { speed: r3(PACES[c.pace] * hero.run) } : {}), ...(M.rule || {}) };
  const entity = { rule, body: { hp: downs * hero.blow } };
  armed(rule, entity, A, damage);

  const resolved = resolveMind({ motivation: mind.motivation, aggressiveness: mind.aggressiveness, rank, skill }, entity);
  const { status, marks, short } = classStatus(c);
  const attack = { kind: c.attack.kind, timing: A.timing, ...(A.pattern ? { pattern: A.pattern } : {}), ...(A.reach !== undefined ? { reach: A.reach } : {}), ...(A.zone ? { zone: A.zone } : {}) };
  return {
    class: c.id, rank, skill, body: species, skin: { species, ...grown }, measured, entity, mind: resolved,
    toll: { downs, harm: c.toll.harm, hp: entity.body.hp, damage },
    attack, stomp: c.stomp, threat: c.threat * R.threat, status, marks, short, advisories: resolved.advisories,
  };
}
