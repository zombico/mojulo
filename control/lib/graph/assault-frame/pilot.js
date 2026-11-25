/**
 * THE FRAME AS A BODY IN A WORLD — an assembled frame (assemble.js) handed to the frame rule
 * (worlds/controllable/rules-frame.js): its numbers as the rule's, its weapons as its four slots, its armour as its hp, and
 * where its guns' muzzles are on its body (the body's mounts, body.js, where it is built; a stock place where not).
 *
 *   FRAME_WORLD                 the world's own numbers: Mars's gravity, the field a frame fights over
 *   frameEntity(build, { id, at, heading?, team?, pilot?, mind?, gravity?, figure?, mounts?, bound? }) → the entity
 *     pilot     true: the player's (pilotable, no mind)
 *     mind      { range?, aggression?, dodge? }: an enemy frame's own keys (no pilot)
 *     figure    the figures map's name its body is drawn by (absent: none, a box)
 *   frameSlots(weapons)         → the rule's slots: each weapon row as its trigger reads it
 *   FRAME_CAMERA                the chase: behind and over the shoulder, pitched with the aim
 *   frameMounts(build)          → its guns' muzzles off its body (body.js), frame space; null where the body says none
 *
 * Pure: the same build, the same entity.
 */
import { assembleFrame } from './assemble.js';
import { frameBody } from './body.js';

const r2 = (v) => Math.round(v * 100) / 100;

// (a frame falls by the game's gravity, not the planet's alone: Mars's 3.71 m/s² would hold a frame up a quarter of a
// minute off a two-second climb; the game's is twice it, a long hang that still comes down to the fight)
export const FRAME_WORLD = Object.freeze({ gravity: 7.4, mars: 3.71, earth: 9.81 });
export const FRAME_CAMERA = Object.freeze({ dist: 22, height: 9, lead: 12, lookH: 6.5, shoulder: 2.2, lerp: 9, pitchFollow: 0.8, mouseLook: true });

// (a stock muzzle where the body has not said: frame space, +y forward, +x right, +z up; the hands at the chest's height
// ahead of the shoulders, the shoulders' weapons over them)
const STOCK_MOUNTS = Object.freeze({ armR: [2.6, 3.4, 6.1], armL: [-2.6, 3.4, 6.1], backR: [2.1, 1.2, 9.3], backL: [-2.1, 1.2, 9.3] });
// a weapon's tracer and burst colours, by kind
const COLOR = Object.freeze({ rifle: 0xffd38a, shotgun: 0xffc070, gatling: 0xffe0a0, bazooka: 0xff9050, laser: 0x7fd8ff, blade: 0xfff0d0, missiles: 0xffb060, grenade: 0xff8040, plasma: 0x9fe8ff });

export function frameSlots(weapons) {
  return Object.fromEntries(Object.entries(weapons).map(([slot, W]) => [slot, {
    id: W.id, name: W.name, kind: W.kind, fire: W.fire, damage: W.damage, mag: W.mag, reload: W.reload,
    ...(W.rof ? { rof: W.rof } : {}), ...(W.cooldown != null ? { cooldown: W.cooldown } : {}), speed: W.speed, range: W.range,
    ...(W.splash ? { splash: W.splash } : {}), ...(W.pellets ? { pellets: W.pellets } : {}), ...(W.salvo ? { salvo: W.salvo } : {}),
    ...(W.homing ? { homing: W.homing } : {}), ...(W.energy ? { energy: W.energy } : {}), stagger: W.stagger ?? 0,
    ...(W.handling ? { handling: W.handling } : {}), ...(W.drag ? { drag: W.drag } : {}), ...(W.brace ? { brace: W.brace, wind: W.wind } : {}),
    color: COLOR[W.kind] ?? 0xffd38a,
  }]));
}

export function frameEntity(build, { id, at, heading = 0, team = null, pilot = false, mind = null, gravity = FRAME_WORLD.gravity, figure = null, mounts = null, bound = null } = {}) {
  const A = assembleFrame(build), M = { ...STOCK_MOUNTS, ...(mounts ?? {}) };
  return {
    id, ...(team ? { team } : {}), ...(pilot ? { pilotable: true } : {}),
    rule: {
      type: 'frame', move: A.move, en: A.en, fcs: A.fcs, gravity, slots: frameSlots(A.weapons), stab: { stagger: A.stab.stagger, bonus: A.stab.bonus }, kick: A.kick, steady: A.parts.legs.steady ?? 1,
      mounts: Object.fromEntries(Object.keys(A.weapons).map((s) => [s, M[s]])), eyeH: A.move.height + 2,
      ...(mind ? { mind: { range: 120, aggression: 0.6, dodge: 0.5, ...mind } } : {}), ...(bound ? { bound } : {}),
    },
    body: { type: figure ? 'figure-rig' : 'box', ...(figure ? { figure } : { size: [5, 4, 10] }), hittable: true, hp: A.ap, hpMax: A.ap, poise: A.stab.max, poiseRegen: A.stab.regen, staggerDur: A.stab.stagger, radius: 4.2, aimH: r2(A.move.height * 0.95), egg: { a: 3.2, c: r2(A.move.height), cz: r2(A.move.height * 0.95) }, blast: 6 },
    transform: { pos: [...at], heading },
    frame: { build: A.build, weight: A.weight, ap: A.ap },
  };
}

/** Its guns' muzzles as its body places them (frame space: +x right, +y forward, +z up; body.js mounts), each slot's
 *  place at rest. Kept per build: the body is built once to read them. */
const MOUNTS = new Map();
export function frameMounts(build) {
  const key = JSON.stringify(build ?? null);
  if (MOUNTS.has(key)) return MOUNTS.get(key);
  if (MOUNTS.size > 16) MOUNTS.clear();
  const M = Object.fromEntries(Object.entries(frameBody(build).mounts).map(([s, m]) => [s, m.at.map(r2)]));
  MOUNTS.set(key, M);
  return M;
}
