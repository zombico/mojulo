/**
 * COMBAT CONFORMANCE — the corpus that holds the Godot kernel's fight (godot-kernel/combat.gd, with cast.gd's hit
 * facts) EQUAL to the web's controllable engine, frame by frame. A scenario is a world (a platform hero with a melee
 * rule, hittable bodies) and its input, frame by frame. The web side steps the real world (worlds/controllable, on
 * flat ground) and records where the hero stood after each step; the Godot side replays those poses (its walker is
 * its own) and runs its own strike, contacts and hits. Both print the same snapshot for every frame: the hero's swing
 * (its time, clip, cooldown, combo window, direction, counts), every body's hp, hits, last hitter and fall, and the
 * facts the cast tells the bus (hit:<id>, down). scripts/godot-combat-conformance.mjs runs the Godot side.
 *
 *   SCENARIOS                  the hand scenarios: each names what it exercises
 *   randomScenarios(n, seed)   seeded worlds and inputs
 *   corpus({ random, seed })   every scenario, with its trace and the export's rows, as plain JSON
 *   runCombat(sc)              → { snaps, trace } on the web engine
 */
import { mulberry32 } from '../vegetation/grow.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { extractBus } from './engine-score.js';
import { readBeam, beamLanding, BEAM_NAMES } from '../playscape/elements/beams.js';
import { readExplosion, EXPLOSION_NAMES } from '../playscape/elements/explosions.js';

const DT = 1 / 60;
const FLAT = { ground: () => 0 };
const clone = (x) => JSON.parse(JSON.stringify(x));
let CW = null;

const hero = (rule, extra = {}) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, ...(rule.loadout ? {} : { strike: 'melee' }), ...rule }, transform: { pos: [0, 0, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] }, ...extra });
// a weapon rides the entity (a loadout slot carries its own)
const gunner = (weapon, extra = {}) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, transform: { pos: [0, 0, 0], heading: 0 }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] }, weapon, ...extra });
const REACT = { poise: 30, staggerDur: 0.5, toppleDur: 0.6, getupDur: 0.5, downPause: 0.8 };
const foe = (id, pos, body = {}, extra = {}) => ({ id, rule: { type: 'static' }, transform: { pos, heading: Math.PI }, body: { type: 'mesh', hittable: true, hp: 10, radius: 0.5, ...body }, ...extra });
// frames from runs: [n, input] repeated n times
const frames = (...runs) => runs.flatMap(([n, input]) => Array.from({ length: n }, () => ({ input: { fire: false, forward: 0, strafe: 0, turn: 0, ...input } })));
const press = (n = 2, input = {}) => [n, { fire: true, ...input }];
const idle = (n) => [n, {}];
// a frame that also hands the cast ops (the bus's ctrl verb), after the step and the facts as the page does
const withOps = (fr, at, ops) => { fr[at] = { ...fr[at], ops: [...(fr[at].ops || []), ...ops] }; return fr; };
// a beam and an explosion as a cue lowers them (playscape/ui/cast.js lowerCastEffect)
const beam = (who, to, is = 'orb') => { const spec = readBeam(is, 'beam'); return { op: 'beam', who, to, spec, land: beamLanding(spec), name: is }; };
const explode = (where, is = 'blast', scale) => ({ op: 'puff', ...(typeof where === 'string' ? { who: where } : { at: where }), is, spec: readExplosion(is, 'explode'), ...(scale ? { scale } : {}) });
const quiet = (n) => frames(idle(n));

export const SCENARIOS = [
  {
    id: 'swing-reach-cone',
    about: 'neutral swings: one in front is hit once per swing, one behind and one out of reach are not; the cooldown eats an early press',
    entities: [hero({ strikeReach: 1.6, strikeDamage: 3, strikeDur: 0.5, strikeCooldown: 0.4 }), foe('front', [1.5, 0.2, 0]), foe('behind', [-1.4, 0, 0]), foe('far', [4, 0, 0])],
    frames: frames(press(), idle(30), press(), idle(10), press(), idle(40), press(), idle(40)),
  },
  {
    id: 'directions',
    about: 'the held direction picks the cut: a side cut yaws the hitbox, a back cleave and a forward thrust; a turn rotates the hero between swings',
    entities: [hero({ strikeReach: 1.4, strikeDamage: 2, strikeDur: 0.4, strikeCooldown: 0.1 }), foe('left', [0.6, 1.1, 0]), foe('right', [0.6, -1.1, 0]), foe('ahead', [1.3, 0, 0])],
    frames: frames(press(2, { strafe: -1 }), idle(30), press(2, { strafe: 1 }), idle(30), press(2, { forward: -1 }), idle(30), [12, { turn: 1 }], press(2, { forward: 1 }), idle(30)),
  },
  {
    id: 'combo',
    about: 'a combo slot: the opener opens a window, a follow-up in another direction bypasses the cooldown, a repeat direction does not, and the follow-up arms the long cooldown',
    entities: [hero({ loadout: [{ name: 'sword', strike: 'melee', combo: 1, strikeReach: 1.5, strikeDamage: 1, strikeDur: 0.3, strikeCooldown: 0.5, comboWindow: 0.6, comboCooldown: 1.2 }] }), foe('a', [1.4, 0, 0], { hp: 40 })],
    frames: frames(press(), idle(20), press(2, { strafe: 1 }), idle(20), press(), idle(90), press(), idle(20), press(), idle(60)),
  },
  {
    id: 'falls',
    about: 'a reacting body falls at 0 hp and keeps taking hits, and its fall blasts a stagger around it; one without poise stands at 0; an egg presents its width; an ally in the arc only reels',
    entities: [hero({ strikeReach: 1.5, strikeDamage: 5, strikeDur: 0.3, strikeCooldown: 0, strikeCone: 80 }, { team: 'a' }), foe('reacts', [1.2, 0.3, 0], { hp: 9, poise: 40 }), foe('stands', [1.2, -0.3, 0], { hp: 6 }), foe('egg', [2.1, 0, 0], { hp: 20, radius: undefined, egg: { a: 0.7, c: 1 }, ...REACT }), foe('pal', [1, 0.8, 0], { ...REACT }, { team: 'a' })],
    frames: frames(press(), idle(25), press(), idle(25), press(), idle(25)),
  },
  {
    id: 'away-and-back',
    about: 'a body sent away (vanish) takes no hit; brought back (spawn) it is whole and hittable again, and one minted asleep wakes the same way',
    entities: [hero({ strikeReach: 1.6, strikeDamage: 3, strikeDur: 0.3 }), foe('a', [1.3, 0, 0], { hp: 6, poise: 20 }), foe('b', [1.3, 0.4, 0], { hp: 5 }, { dormant: true })],
    frames: withOps(withOps(frames(press(), idle(25), press(), idle(25), press(), idle(25), press(), idle(25)), 30, [{ op: 'vanish', who: 'a' }]), 58, [{ op: 'spawn', who: 'a' }, { op: 'spawn', who: 'b' }]),
  },
  {
    id: 'topple-and-rise',
    about: 'a back cleave topples a reacting egg: it falls, lies flat (its length is its reach), gets up untouchable, and a wake guard keeps it so',
    // the back cleave reaches it standing (2 + its width); the neutral swing only lying flat (1.2 + its length)
    entities: [hero({ strikeReach: 1.2, strikeDamage: 1, strikeDur: 0.3, strikeVerbs: { back: { strikeReach: 2 } } }), foe('egg', [1.9, 0, 0], { hp: 40, radius: undefined, egg: { a: 0.3, c: 1.1 }, ...REACT, wakeGuard: 0.6 })],
    frames: frames(press(2, { forward: -1 }), ...Array.from({ length: 12 }, () => [[8, {}], press()]).flat(), idle(30)),
  },
  {
    id: 'rifle',
    about: 'a semi rifle: one round a pull, the nearest body on the ray takes it (listed after a farther one), cover eats a shot, a shield in front eats its damage and breaks, the magazine empties and reloads',
    // the tank turn is 2.4 rad/s, right for a positive turn: ten frames of turn is 0.4 rad
    colliders: [{ min: [2.6, 0.9, -1], max: [3.1, 1.5, 3] }],
    entities: [gunner({ fireClass: 'sight', damage: 3, impact: 12, cooldown: 0.25, magazine: 6, reload: 0.6, eye: 0, range: 40 }), foe('far', [6, 0, 0], { hp: 20 }), foe('near', [3, 0, 0], { hp: 20, ...REACT }), foe('hidden', [5.53, 2.34, 0], { hp: 20 }), foe('guard', [3.68, -1.56, 0], { hp: 20, shield: { hp: 7, arc: 120 }, radius: undefined, egg: { a: 0.9, c: 1, cz: 0 } }, { transform: { pos: [3.68, -1.56, 0], heading: 2.741 } })],
    frames: frames(press(), idle(20), press(), idle(20), [10, { turn: 1 }], press(), idle(20), press(), idle(20), press(), idle(20), press(), idle(20), [20, { turn: -1 }], press(), idle(20), press(), idle(60)),
  },
  {
    id: 'reserve-and-rearm',
    about: 'a reserve the reloads draw from runs dry and the weapon stops; a rearm by n adds to the reserve, a rearm with no by fills the magazine; a heal is held to hpMax',
    entities: [gunner({ fireClass: 'sight', damage: 1, cooldown: 0.1, magazine: 3, reserve: 4, reload: 0.3, eye: 0, range: 40 }), foe('a', [6, 0, 0], { hp: 500 })],
    // a pull every 0.15 s: 20 pulls run the 3 + 4 rounds dry; the rearm by 5 (frame 125) reloads again; the full
    // magazine (frame 215) fires without a reload
    // and a heal far past the body's hp is held to its hpMax (frame 300)
    frames: withOps(withOps(withOps(frames(...Array.from({ length: 20 }, () => [press(), idle(7)]).flat(), ...Array.from({ length: 10 }, () => [press(), idle(7)]).flat(), ...Array.from({ length: 10 }, () => [press(), idle(7)]).flat(), idle(20)), 125, [{ op: 'rearm', who: 'hero', by: 5 }]), 215, [{ op: 'rearm', who: 'hero' }]), 300, [{ op: 'heal', who: 'a', by: 1000 }]),
  },
  {
    id: 'auto-and-assist',
    about: 'an automatic streams while held, its assist ring catches a body just off the line, and the cooldown paces the rounds',
    entities: [gunner({ fireClass: 'area', rof: 9, damage: 1, magazine: 12, reload: 0.5, eye: 0, assistAngle: 9 }), foe('off', [5, 0.5, 0], { hp: 50, radius: 0.2 }), foe('egg', [7, -0.9, 0], { hp: 50, radius: undefined, egg: { a: 0.4, c: 1, cz: 0 } })],
    frames: frames([40, { fire: true }], idle(10), [3, { turn: 1 }], [50, { fire: true }], idle(30)),
  },
  {
    id: 'burst-charge-heat',
    about: 'a burst rifle opens three rounds a pull; a held charge fires one charged bolt (its damage, range and ammo); heat locks the weapon until it cools',
    entities: [gunner({ fireClass: 'sight', damage: 2, burst: 3, burstRof: 10, cooldown: 0.4, magazine: 20, eye: 0, chargeTime: 0.4, chargedDamage: 9, chargedAmmoCost: 3, energyMax: 10, energyCost: 2, chargedEnergyCost: 4, energyRegen: 0.5, energyOverheatRegen: 5, energyUnlockFrac: 0.8 }), foe('a', [6, 0, 0], { hp: 200 })],
    frames: frames(press(1), idle(45), [40, { fire: true }], idle(20), press(1), idle(10), press(1), idle(10), press(1), idle(10), press(1), idle(10), [35, { fire: true }], idle(120)),
  },
  {
    id: 'grenades',
    about: 'a lobbed round arcs under gravity, bursts on a body it passes, on the ground or on a wall, and its splash catches who is near (an ally only reels)',
    colliders: [{ min: [7, -3, 0], max: [7.5, -1, 3] }],
    entities: [gunner({ fireClass: 'lob', damage: 4, impact: 10, lobAngle: 35, projectileSpeed: 9, projectileGravity: 12, splashRadius: 1.6, cooldown: 0.8, magazine: 3, reload: 1, eye: 1 }, { team: 'a' }), foe('mark', [5.5, 0, 0], { hp: 20, ...REACT }), foe('close', [6.2, 0.9, 0], { hp: 20 }), foe('pal', [6, -0.8, 0], { ...REACT }, { team: 'a' }), foe('egg', [9, -1.5, 0], { hp: 20, radius: undefined, egg: { a: 0.5, c: 1.2 } })],
    frames: frames(press(), idle(50), [6, { turn: -1 }], press(), idle(50), [8, { turn: 1 }], press(), idle(80)),
  },
  {
    id: 'rocket',
    about: 'a flat fast round with a proximity fuze bursts as it passes beside a body, swept along its whole step',
    entities: [gunner({ fireClass: 'lob', damage: 6, projectileSpeed: 45, projectileGravity: 0, splashRadius: 1.4, proximityRadius: 0.8, cooldown: 0.5, eye: 0.5 }), foe('beside', [12, 1.1, 0], { hp: 20, ...REACT }), foe('beyond', [20, 0, 0], { hp: 20 })],
    frames: frames(press(), idle(40), [5, { turn: -1 }], press(), idle(40)),
  },
  {
    id: 'death-blast',
    about: 'a body felled blasts a stagger around it: a bystander behind the hero, out of every swing, reels; a shield facing the blast eats it',
    entities: [hero({ strikeReach: 1.5, strikeDamage: 5, strikeDur: 0.3 }), foe('victim', [1.2, 0, 0], { hp: 4, ...REACT }), foe('bystander', [-3, 0, 0], { hp: 9, ...REACT }), foe('shielded', [-2, 3, 0], { hp: 9, ...REACT, shield: { hp: 5, arc: 160 } }, { transform: { pos: [-2, 3, 0], heading: -0.83 } })],
    frames: frames(press(), idle(40)),
  },
  {
    id: 'swept',
    about: 'a fast thin round would step over a thin body between two frames; its flight is swept in samples, and it bursts on it',
    entities: [gunner({ fireClass: 'lob', damage: 5, projectileSpeed: 60, projectileGravity: 0, projRadius: 0.05, splashRadius: 0, cooldown: 0.5, eye: 0.5 }), foe('thin', [5.5, 0, 0.5], { hp: 20, radius: 0.2 })],
    frames: frames(press(), idle(30)),
  },
  {
    id: 'beams',
    about: 'a beam of every kind from a character at another or at a place: it lands after its distance, its impact and shake are moments then, its target hears struck once; one at a body sent away is not fired',
    entities: [hero({}), foe('caster', [0, 3, 0], { hp: 20 }), foe('a', [6, 3, 0], { hp: 20 }), foe('b', [2, -5, 0], { hp: 20 }), foe('gone', [4, 4, 0], {}, { dormant: true })],
    frames: BEAM_NAMES.reduce((fr, is, i) => withOps(fr, 5 + i * 25, [beam('caster', i % 3 === 2 ? [3 + i, -2, 0] : i % 2 ? 'a' : 'b', is)]), withOps(quiet(BEAM_NAMES.length * 25 + 200), 2, [beam('caster', 'gone')])),
  },
  {
    id: 'explosions',
    about: 'an explosion of every kind at a place and at a character\'s feet, some scaled: a chain scatters its blasts by the web\'s dice and staggers them, a shake rides each',
    entities: [hero({}), foe('target', [3, 1, 0], { hp: 20 })],
    frames: EXPLOSION_NAMES.reduce((fr, is, i) => withOps(fr, 5 + i * 20, [explode(i % 2 ? 'target' : [i, -i, 0], is, i % 3 ? undefined : 1.5)]), quiet(EXPLOSION_NAMES.length * 20 + 120)),
  },
  {
    id: 'asleep',
    about: 'a body minted asleep is not hittable',
    entities: [hero({ strikeReach: 1.6, strikeDamage: 2, strikeDur: 0.4 }), foe('sleeper', [1.3, 0, 0], {}, { dormant: true }), foe('woke', [1.3, 0.5, 0])],
    frames: frames(press(), idle(30)),
  },
];

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const round = (x, k = 100) => Math.round(x * k) / k;

export function randomScenarios(n = 12, seed = 1) {
  const rand = mulberry32(seed), out = [];
  for (let i = 0; i < n; i++) {
    const combo = rand() < 0.4;
    const cfg = {
      strikeReach: round(0.8 + rand() * 1.8), strikeDamage: Math.ceil(rand() * 6), strikeDur: round(0.25 + rand() * 0.6),
      strikeCooldown: rand() < 0.4 ? 0 : round(rand() * 0.6), strikeCone: Math.round(30 + rand() * 70),
      ...(rand() < 0.5 ? { strikeContact: [round(rand() * 0.4), round(0.5 + rand() * 0.45)] } : {}),
      ...(rand() < 0.4 ? { strikeVerbs: { left: { strikeReach: round(1 + rand()) }, back: { strikeDamage: Math.ceil(rand() * 9) }, forward: { strikeYaw: Math.round(rand() * 40 - 20) } } } : {}),
      ...(combo ? { combo: 1, comboWindow: round(0.3 + rand() * 0.7), comboCooldown: round(0.5 + rand() * 1.5) } : {}),
    };
    const ranged = rand() < 0.45;
    const lob = ranged && rand() < 0.35;
    const weapon = lob
      ? { fireClass: 'lob', damage: Math.ceil(rand() * 5), impact: rand() < 0.5 ? Math.round(rand() * 20) : 0, lobAngle: Math.round(rand() * 45), projectileSpeed: round(6 + rand() * 30), projectileGravity: round(rand() * 20), splashRadius: round(rand() * 2), cooldown: round(0.2 + rand()), magazine: 1 + Math.floor(rand() * 4), reload: round(0.3 + rand()), eye: round(rand() * 1.5), ...(rand() < 0.3 ? { proximityRadius: round(rand()) } : {}) }
      : { fireClass: pick(rand, ['sight', 'area']), damage: Math.ceil(rand() * 5), impact: Math.round(rand() * 25), cooldown: round(0.1 + rand() * 0.5), rof: Math.round(4 + rand() * 10), magazine: 2 + Math.floor(rand() * 10), reload: round(0.2 + rand()), eye: round(rand() * 1.5), coreAngle: round(1 + rand() * 6), assistAngle: round(4 + rand() * 10), ...(rand() < 0.3 ? { burst: 2 + Math.floor(rand() * 3), burstRof: Math.round(6 + rand() * 6) } : {}), ...(rand() < 0.25 ? { chargeTime: round(0.2 + rand() * 0.5), chargedDamage: Math.ceil(rand() * 10) } : {}), ...(rand() < 0.25 ? { energyMax: 6, energyCost: round(1 + rand() * 2), energyRegen: round(rand() * 4) } : {}) };
    const team = rand() < 0.3 ? 'a' : null;
    const ents = [ranged ? (rand() < 0.5 ? gunner(weapon, team ? { team } : {}) : hero({ loadout: [{ name: 'gun', weapon }] }, team ? { team } : {})) : hero(rand() < 0.5 ? cfg : { loadout: [{ name: 'blade', strike: 'melee', ...cfg }] }, team ? { team } : {})];
    const nf = 1 + Math.floor(rand() * 4);
    for (let k = 0; k < nf; k++) {
      const ang = rand() * Math.PI * 2, r = ranged ? 1.5 + rand() * 8 : 0.6 + rand() * 2.6;
      const reacts = rand() < 0.5 ? { poise: Math.round(10 + rand() * 40), staggerDur: round(0.3 + rand()), ...(rand() < 0.5 ? { toppleDur: round(0.3 + rand()), getupDur: round(0.3 + rand()), downPause: round(0.2 + rand()), wakeGuard: round(rand() * 0.8) } : {}) } : {};
      const body = { hp: 2 + Math.floor(rand() * 12), ...reacts, ...(rand() < 0.4 ? { radius: undefined, egg: { a: round(0.3 + rand() * 0.6), c: round(0.8 + rand() * 0.6) } } : { radius: round(0.3 + rand() * 0.5) }), ...(rand() < 0.2 ? { shield: { hp: Math.ceil(rand() * 8), arc: Math.round(60 + rand() * 120) } } : {}) };
      ents.push(foe(`f${k}`, [round(Math.cos(ang) * r), round(Math.sin(ang) * r), 0], body, { transform: { pos: [round(Math.cos(ang) * r), round(Math.sin(ang) * r), 0], heading: round(rand() * 6.28) }, ...(team && rand() < 0.3 ? { team } : {}) }));
    }
    const colliders = rand() < 0.3 ? [{ min: [round(1 + rand() * 3), round(-2 + rand() * 2), -1], max: [round(4 + rand()), round(rand() * 2), 3] }] : null;
    const runs = [];
    let len = 0;
    while (len < 360) {
      const kind = rand();
      const dir = pick(rand, [{}, {}, { forward: 1 }, { forward: -1 }, { strafe: 1 }, { strafe: -1 }]);
      const run = kind < 0.45 ? press(1 + Math.floor(rand() * 3), dir) : kind < 0.6 ? [2 + Math.floor(rand() * 8), pick(rand, [{ turn: 1 }, { turn: -1 }, { forward: 1 }])] : idle(3 + Math.floor(rand() * 30));
      runs.push(run);
      len += run[0];
    }
    out.push({ id: `random-${seed}-${i}`, about: 'seeded', entities: ents, ...(colliders ? { colliders } : {}), frames: frames(...runs) });
  }
  return out;
}

// ── the snapshot: the same canonical string on both sides ────────────────────────────────────────────────────────
function canon(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

const nano = (x) => Math.floor(x * 1e9 + 0.5) / 1e9;
const WEAPON_STATE = ['ammo', 'reserve', 'cooldownT', 'reloading', 'reloadT', 'burstLeft', 'shots', 'prevFire', 'charging', 'chargeT', 'chargeReady', 'energy', 'energyLock'];

function snapshot(world, ids, events) {
  const h = world.byId.hero;
  const bodies = {};
  for (const id of ids) {
    const e = world.byId[id];
    bodies[id] = {
      hp: e.body && Number.isFinite(e.body.hp) ? e.body.hp : null, hits: e.hits || 0, by: e.lastHitBy || null, downed: !!e.downed,
      hittable: !!(e.body && e.body.hittable), invincible: !!e.invincible,
      ...(Number.isFinite(e.poise) ? { poise: e.poise, staggerT: e.staggerT ?? null, react: e.reactClip, pause: e.downPauseT ?? null } : {}),
      ...(Number.isFinite(e.shieldHp) ? { shield: e.shieldHp, broken: !!e.shieldBroken } : {}),
    };
  }
  const w = h.weapon;
  return canon({
    hero: {
      swingT: h.swingT ?? null, clip: h.swingClip ?? null, cd: h.strikeCdT || 0, combo: h.comboT || 0, chain: !!h.swingCombo, dir: h.lastSwingDir ?? null, swings: h.swingCount || 0, dealt: h.meleeHitCount || 0,
      ...(w ? { weapon: Object.fromEntries(WEAPON_STATE.map((k) => [k, w[k] ?? null])) } : {}),
    },
    bodies,
    // a round's flight to 1e-9: its launch is a sine and a cosine, which the two engines' libraries agree on to the
    // last bit almost, not quite, always (an integrator, held to a stated tolerance)
    rounds: (world.projectiles || []).map((p) => [p.pos.map(nano), p.vel.map(nano), p.age]),
    // the cast's moments (puffs, blasts, beams, shakes), their places to 1e-9 (a chain's dice are a sine)
    moments: (world.moments || []).map((m) => ({ is: m.is, t0: m.t0, at: m.at.map(nano), ...(m.until != null ? { until: m.until } : {}), ...(m.hit != null ? { hit: m.hit, to: m.to.map(nano), target: m.target ?? null, struck: !!m.struck } : {}), ...(m.k != null ? { k: m.k, for: m.for } : {}), ...(m.scale != null ? { scale: m.scale } : {}) })),
    facts: events.map((ev) => ({ type: ev.type, entity: ev.entity, ...(ev.type.startsWith('hit:') || ev.type === 'struck' ? { by: ev.by } : {}) })),
  });
}

export function runCombat(sc) {
  CW ||= composeLive();
  const world = CW.createWorld({ entities: clone(sc.entities), ...(sc.colliders ? { colliders: clone(sc.colliders) } : {}) });
  const ids = sc.entities.filter((e) => e.body && e.body.hittable).map((e) => e.id);
  let prev = CW.castFacts(world, undefined).prev;
  const snaps = [], trace = [];
  for (const f of sc.frames) {
    CW.stepWorld(world, clone(f.input), f.dt || DT, FLAT);
    const c = CW.castFacts(world, prev);
    prev = c.prev;
    const h = world.byId.hero;
    trace.push({ pos: h.transform.pos.slice(), heading: h.transform.heading, pitch: h.transform.pitch || 0, grounded: !!h.grounded });
    snaps.push(snapshot(world, ids, c.events));
    if (f.ops) CW.castOps(world, clone(f.ops));
  }
  return { snaps, trace };
}

// every scenario with what the Godot side reads: the export's cast rows and combat (bus.json), the frames with the
// hero's pose after each web step
export function corpus({ random = 12, seed = 1 } = {}) {
  return [...SCENARIOS, ...randomScenarios(random, seed)].map((sc) => {
    const bus = extractBus({ entities: clone(sc.entities), events: {}, ...(sc.colliders ? { colliders: clone(sc.colliders) } : {}) });
    const { trace } = runCombat(sc);
    return clone({ id: sc.id, about: sc.about, cast: bus.cast, combat: bus.combat, bodies: Object.keys(bus.combat.bodies), frames: sc.frames.map((f, i) => ({ input: f.input, dt: f.dt || DT, hero: trace[i], ...(f.ops ? { ops: f.ops } : {}) })) });
  });
}

export const scenarioById = (id, { random = 12, seed = 1 } = {}) => [...SCENARIOS, ...randomScenarios(random, seed)].find((s) => s.id === id);
