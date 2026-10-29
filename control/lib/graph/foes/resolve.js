/**
 * THE FOE RESOLVER: a foe (a class at a rank, on a body) → the controllable entity it plays as, the mind that entity
 * resolves to (mind/resolve.js, on the entity itself, so a class whose attack its body cannot carry out is the mind's to
 * report, not a second check's), its toll in the hero's frame, its attack's timing and what lowers it today.
 *
 *   resolveFoe({ class, rank?, skill?, skin?, group? }, { hero? })
 *     → { class, rank, skill, body, skin, measured, stature, scale, entity, mind, toll: { downs, harm, hp, damage }, attack: { kind,
 *         timing, pattern?, reach?, zone? }, strike, stomp, threat, status, marks, short, advisories }
 *     `strike` the timing its body deals a melee attack's blow by (its clip: fauna/behavior/strike.js), null when its
 *     attack is no blade's or its body cannot strike (a swimmer)
 *     `skin` the species and what grows it, as the animal door takes them; `measured` the grown body (./fit.js bodyOf);
 *     `stature` the size it reads at in the game, its longest extent (its class's presence × its rank's × the hero's
 *     height), and `scale` the factor that draws the grown body at it
 *     rank    mind/vocab.js RANKS (minion default): × the class's downs and threat (./vocab.js FOE_RANKS)
 *     skill   mind/vocab.js SKILLS (regular default)
 *     skin    { species?, ooze?, stylism? }: the beast it plays on, grown by its oozes and checked against the class
 *             (./fit.js, on the grown body); absent, its `standIn`. Or { people, facets? }: a person or a non-human
 *             people (./people.js), made by the character loop, at its own height (`body` null; `skin` the people).
 *             Or { meshRef, height? }: a model made elsewhere (./model.js), a rigged humanoid worn as a people is
 *             (`body` null; `skin` the model)
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
import { checkFit, checkFitPeople, checkFitModel } from './fit.js';
import { readPeopleSkin } from './people.js';
import { readModelSkin, isModelSkin } from './model.js';
import { RANKS, SKILLS, sightKnobs } from '../mind/vocab.js';
import { resolveMind } from '../mind/resolve.js';
import { RANGED } from '../gameworld/feel/kernel.js';
import { mutagenErrors } from '../mutagen/index.js';
import { strikesOf, strikeWindow } from '../fauna/behavior/strike.js';

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
    // (the hit lands on the blow's own frames: the window the beast's strike clip shows it in, fauna/behavior/strike.js)
    rule.loadout = [{ name: 'blow', strike: 'melee', strikeReach: A.reach, strikeDamage: damage, strikeDur: r3(((t.startup ?? 0) + (t.active ?? 0) + (t.recovery ?? 0)) / FPS), strikeContact: strikeWindow(t) }];
  } else if (A.fireClass) {
    entity.weapon = { fireClass: A.fireClass, damage };
  }
}

// the rule's `foe` record: a move of its own (its numbers; a dive's telegraph and a rush's brace and recovery its
// attack's own frames), a touch (its harm, and when), the stomp; null for a class the mind plays whole and that never
// touches (a turret, a brute)
function foeRecord(c, M, A) {
  const own = M.own ? structuredClone(M.own) : null, t = A.timing;
  if (own?.dive) own.dive.telegraph = r3((t.startup ?? 30) / FPS);
  if (own?.rush) Object.assign(own.rush, { brace: r3((t.startup ?? 30) / FPS), recover: r3((t.recovery ?? 30) / FPS) });
  const touch = A.verb === 'contact';
  if (!own && !touch && c.stomp === 'blow') return null;
  return { move: c.move, ...(own || {}), ...(touch ? { touch: c.toll.harm, ...(A.during ? { during: A.during } : {}) } : {}), stomp: c.stomp };
}

export function resolveFoe(spec, { hero = HERO } = {}) {
  if (!spec || typeof spec !== 'object') throw new Error('foe: a foe is { class, rank?, skill?, skin?, group? }');
  for (const k of Object.keys(spec)) if (!SPEC_KEYS.includes(k)) throw new Error(`foe: no key '${k}' (known: ${SPEC_KEYS.join(', ')})`);
  const c = foeClass(spec.class), rank = spec.rank ?? 'minion', skill = spec.skill ?? 'regular';
  check('rank', rank, RANKS); check('skill', skill, SKILLS);
  if (spec.skin !== undefined && (!spec.skin || typeof spec.skin !== 'object')) throw new Error('foe: .skin is { species?, ooze?, stylism? } (a beast), { people, facets? } (a person or a people) or { meshRef, height? } (a model)');
  // a PEOPLE (./people.js): a person or a non-human people on two legs at its own stature, made by the character loop;
  // a MODEL (./model.js): a rigged humanoid made elsewhere, worn as a people is
  const model = isModelSkin(spec.skin) ? readModelSkin(spec.skin) : null;
  const people = model ?? (spec.skin?.people !== undefined ? readPeopleSkin(spec.skin) : null);
  if (spec.skin !== undefined && !people) for (const k of Object.keys(spec.skin)) if (!SKIN_KEYS.includes(k)) throw new Error(`foe: .skin has no key '${k}' (a beast's: ${SKIN_KEYS.join(', ')}; a people's: people, facets; a model's: meshRef, height)`);
  const species = people ? null : spec.skin?.species ?? c.standIn;
  const grown = people ? {} : { ...(spec.skin?.ooze !== undefined ? { ooze: spec.skin.ooze } : {}), ...(spec.skin?.stylism !== undefined ? { stylism: spec.skin.stylism } : {}) };
  const errs = people ? [] : mutagenErrors(grown.ooze, undefined, grown.stylism);
  if (errs.length) throw new Error(`foe: .skin: ${errs.join('; ')}`);
  const { body: measured } = model ? checkFitModel(c.id, model) : people ? checkFitPeople(c.id, people) : checkFit(c.id, species, grown);

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
  const rule = { type: 'ai', dodge: false, mind, ...(c.pace ? { speed: r3(PACES[c.pace] * hero.run) } : {}), ...(M.rule || {}), ...sightKnobs(c.mind) };
  const entity = { rule, body: { hp: downs * hero.blow } };
  armed(rule, entity, A, damage);
  // what the mind does not play (worlds/controllable/foe.js): its own move's numbers, the touch it hurts by, the stomp
  const own = foeRecord(c, M, A);
  if (own) rule.foe = own;
  // a touch closes to the body, not to a gun's standoff
  if (A.verb === 'contact') rule.standoff = r3(Math.max(0.3, (rule.collideRadius ?? 0.3)));

  const resolved = resolveMind({ motivation: mind.motivation, aggressiveness: mind.aggressiveness, rank, skill }, entity);
  const { status, marks, short } = classStatus(c);
  // the blow its body deals it by (a melee attack, on a body that can strike: fauna/behavior/strike.js), at its timing; a
  // people's swing is its role's attack (egocube/moves.js), not a beast's strike
  const strike = !people && A.verb === 'melee' && strikesOf(species).length ? { ...A.timing } : null;
  const attack = { kind: c.attack.kind, timing: A.timing, ...(A.pattern ? { pattern: A.pattern } : {}), ...(A.reach !== undefined ? { reach: A.reach } : {}), ...(A.zone ? { zone: A.zone } : {}) };
  // its PRESENCE: the size it reads at in the game (its longest extent, the class's share of the hero's height grown by
  // rank), the body drawn at the scale that takes its grown extent there
  // (a people stands at its own height, grown only by its rank: a class's presence is a beast's word)
  const stature = people ? r3(measured.height * R.presence) : r3(c.presence * R.presence * hero.height);
  const scale = people ? r3(R.presence) : r3(stature / Math.max(0.01, measured.extent));
  return {
    class: c.id, rank, skill, body: species, skin: people ?? { species, ...grown }, measured, stature, scale, entity, mind: resolved,
    toll: { downs, harm: c.toll.harm, hp: entity.body.hp, damage },
    attack, strike, stomp: c.stomp, threat: c.threat * R.threat, status, marks, short, advisories: resolved.advisories,
  };
}
