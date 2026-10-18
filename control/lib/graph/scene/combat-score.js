/**
 * THE FIGHT AS DATA: what an engine kernel needs to adjudicate the web's combat in the bus's frame (z-up, recipe units,
 * radians), beside the cast it fights over. It rides bus.json as `combat`; Godot's kernel/combat.gd reads it.
 *
 *   extractCombat(payload, player) → { version, hero, team?, eye, look, strike?, weapon?, colliders?, bodies } | null
 *     hero     the player's id (the seat engine-score names); team, its side when it has one (a blade spares its own)
 *     eye      the platform rule's eye: the web stands the hero there above the ground (a walker stands on its feet)
 *     look     the rule turns by mouse-look (it then aims with its pitch, and the turn keys pick a side cut)
 *     strike   the hero's melee, when its platform rule (or the slot in its fist at the start) swings one:
 *              { dur, cooldown, combo, comboWindow, comboCooldown, swings: { <dir>: { clip, params } } }
 *              `swings` is meleeSwingSpec for each of the five directions, so a kernel ports the adjudication and
 *              never the spec's fallbacks
 *     weapon   the hero's ranged weapon in that slot, as initWeapon normalizes it (its timers at rest)
 *     colliders  the world's boxes ({ min, max }), the cover a round stops on
 *     bodies   every hittable character, as the web normalizes it: its egg or radius, team, hpMax, poise and the
 *              reaction's timings (a reacting body staggers, topples, lies flat, gets up; a killing blow floors it;
 *              without poise the web leaves it standing at 0 hp, and so does the kernel), its shield
 * Absent an armed platform hero (or a mind) and hittable bodies ⇒ null (no key). What stays on the web: the combo's stun, scaling
 * and juggle (`combo` names a world or body that opts in), the clash and the other set pieces, a loadout's other
 * slots. A mind's attack runs in the kernel since 0.26.0 (mind-score.js carries the minds).
 */
import { composeLive } from '../worlds/controllable/compose.js';

export const COMBAT_VERSION = 'combat/1';
export const SWING_DIRS = Object.freeze(['neutral', 'forward', 'back', 'left', 'right']);
let CW = null;

function strikeOf(e) {
  const r = e.rule || {};
  const lo = Array.isArray(r.loadout) && r.loadout.length ? r.loadout : null;
  const sc = lo ? lo[0] : r;
  if (!sc || !(sc.strike === 'melee' || sc.strike === true)) return null;
  // the web's own reads (combat-melee.js, the platform strike): a slot's value, else the rule's, else the default
  const pick = (k, d) => (lo && sc[k] != null ? sc[k] : r[k] ?? d);
  const combo = (lo ? sc.combo : r.combo) || 0;
  return {
    dur: pick('strikeDur', 0.9), cooldown: pick('strikeCooldown', 0), combo,
    comboWindow: pick('comboWindow', 0.8), comboCooldown: pick('comboCooldown', 2.5),
    swings: Object.fromEntries(SWING_DIRS.map((d) => [d, CW.meleeSwingSpec(sc, r, d, combo > 0)])),
  };
}

const REACTS = ['poise', 'poiseMax', 'poiseRegen', 'staggerDur', 'toppleDur', 'getupDur', 'wakeGuard', 'downPause'];

function bodyOf(e) {
  const b = e.body;
  const egg = b.egg && typeof b.egg === 'object' ? { a: b.egg.a, c: b.egg.c, ...(Number.isFinite(b.egg.cz) ? { cz: b.egg.cz } : {}), ...(Number.isFinite(b.egg.lean) ? { lean: b.egg.lean } : {}) } : null;
  return {
    ...(egg ? { egg } : { radius: Number.isFinite(b.radius) ? b.radius : 0.5 }),
    ...(e.team ? { team: e.team } : {}),
    ...(Number.isFinite(e.hpMax) ? { hpMax: e.hpMax } : {}),
    ...(Number.isFinite(e.poise) ? Object.fromEntries(REACTS.map((k) => [k, e[k]])) : {}),
    ...(Number.isFinite(e.shieldHp) ? { shieldHp: e.shieldHp, shieldArc: e.shieldArc } : {}),
    ...(e.noDestroy ? { noDestroy: true } : {}),
    ...(e.comboCfg ? { combo: true } : {}),
  };
}

export function extractCombat(payload, player) {
  const ents = Array.isArray(payload?.entities) ? payload.entities : [];
  const hero = ents.find((e) => e && e.id === player);
  if (!hero || !ents.some((e) => e && e.body && e.body.hittable)) return null;
  CW ||= composeLive();
  // the web's normalized world: the same hoists (poise, hpMax, team) a page starts from
  const world = CW.createWorld({ entities: JSON.parse(JSON.stringify(ents)), ...(Array.isArray(payload.colliders) ? { colliders: payload.colliders } : {}) });
  const me = world.byId[player];
  // minds fight too (kernel/mind.gd, since 0.26.0): their trigger and blade need the fight whatever the pilot holds
  const minds = ents.some((e) => e && e.rule && e.rule.type === 'ai');
  // the strike and the trigger are the platform pilot's: a walker fights nothing of its own
  const platform = me.rule.type === 'platform';
  if (!platform && !minds) return null;
  const strike = platform ? strikeOf(me) : null;
  const weapon = platform && me.weapon ? JSON.parse(JSON.stringify(me.weapon)) : null;
  if (!strike && !weapon && !minds) return null;
  // authored hittable (one minted asleep starts unhittable, and a spawn arms it when it has hpMax, as on the web)
  const bodies = {};
  for (const raw of ents) if (raw && raw.body && raw.body.hittable && !raw.isCamera) bodies[raw.id] = bodyOf(world.byId[raw.id]);
  const { team, rule } = me;
  return {
    version: COMBAT_VERSION, hero: player, ...(team ? { team } : {}),
    // the platform rule stands its body at the ground plus its eye (0 by default): a walker standing on its feet adds it
    eye: Number.isFinite(rule.eye) ? rule.eye : 0,
    // tank turning (the default) aims level and leaves the turn keys out of the direction pick; mouse-look reads both
    look: rule.space === true || (rule.turnMode ?? 'tank') !== 'tank',
    ...(strike ? { strike } : {}), ...(weapon ? { weapon } : {}),
    ...(world.colliders ? { colliders: world.colliders } : {}),
    bodies,
  };
}
