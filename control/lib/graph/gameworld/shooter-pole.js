/**
 * THE SHOOTER POLE — one dial from a REALISTIC shooter to a STYLIZED one, resolved into the rules a match plays by.
 *
 *   realistic (0)   a gun kills in a few rounds and the head is worth four bodies; the player walks, no jumping off
 *                   the ground's own steps; no kit; minds hold angles and peek them; the fallen lie a while; the arena
 *                   close quarters. The fight is decided by who sees whom first, and from where.
 *   stylized (1)    a body takes a long burst to drop and the head two; the player runs fast, jumps twice and dashes;
 *                   a heal on a cooldown and an ultimate charged by fighting (overdrive: its rounds hit harder); hp
 *                   mends when left alone; minds strafe and roll rather than peek; the fallen are back quickly; the
 *                   arena large, open and long. The fight is decided by movement and the kit.
 *
 * Between the poles every number moves along the dial and each feature switches on where its pole begins to win
 * (THRESHOLDS). The time to kill is the dial's spine: the damage a round deals is derived from it, the hp and the
 * fire rate, so a pole is a promise about how long a duel lasts, measured by its laws (shooter-pole.test.js).
 *
 *   SHOOTER_POLES                 the two poles' numbers and features
 *   readPole(v)                   'realistic' | 'stylized' | 0..1 → 0..1 (or throws, saying what it takes)
 *   shooterPole(v)                → { pole, ttk, hp, weapon, move, regen, abilities, respawn, mind, arena }
 *
 * Pure.
 */
const lerp = (a, b, t) => a + (b - a) * t;
const r2 = (v) => Math.round(v * 100) / 100;

export const SHOOTER_POLES = Object.freeze({
  realistic: Object.freeze({
    read: 'a few rounds kill and the head is worth four; walk, no kit; minds hold angles and peek them; the arena close',
    ttk: 0.3, hp: 100, rof: 10, headshot: 4, coreAngle: 0.8, magazine: 30, reserve: 90, reload: 2.4,
    speed: 4.5, respawn: 5, strafe: 0.35, arena: 'a close quarters three-lane arena',
  }),
  stylized: Object.freeze({
    read: 'a long burst drops a body, the head is worth two; run, double jump, dash; a heal and an ultimate on their keys; hp mends; minds strafe and roll; the arena large and open',
    ttk: 1.25, hp: 200, rof: 8, headshot: 2, coreAngle: 1.5, magazine: 40, reserve: 160, reload: 1.5,
    speed: 6.5, respawn: 3, strafe: 0.9, arena: 'a large sparse ring arena with long sightlines',
    regen: { after: 4, rate: 25 }, heal: { amount: 60, cooldown: 8 }, ultimate: { per: 6, for: 6 },
  }),
});
// where each feature switches on along the dial (at or past it), or off (peeking, below it)
export const THRESHOLDS = Object.freeze({ dash: 0.35, jump: 0.5, airJump: 0.5, regen: 0.5, heal: 0.6, ultimate: 0.75, peekBelow: 0.5 });

/** A pole as a number on the dial: its name, or 0 to 1. */
export function readPole(v) {
  if (v === 'realistic') return 0;
  if (v === 'stylized') return 1;
  if (typeof v === 'number' && v >= 0 && v <= 1) return v;
  throw new Error(`shooter pole: 'realistic', 'stylized', or a number from 0 (realistic) to 1 (stylized)`);
}

/** The rules a match plays by at a point on the dial. */
export function shooterPole(v) {
  const p = readPole(v), R = SHOOTER_POLES.realistic, S = SHOOTER_POLES.stylized, at = (k) => lerp(R[k], S[k], p);
  const hp = Math.round(at('hp')), rof = r2(at('rof')), ttk = r2(at('ttk'));
  // the rounds a body takes: one more than the dial's time to kill fires (the first round is at once), the damage what
  // drops it in exactly that many
  const rounds = Math.max(1, Math.round(ttk * rof) + 1), damage = Math.ceil(hp / rounds);
  const weapon = {
    fireClass: 'sight', auto: true, rof, magazine: Math.round(at('magazine')), reserve: Math.round(at('reserve')), reload: r2(at('reload')),
    damage, impact: 0.5, range: 60, coreAngle: r2(at('coreAngle')), headshot: r2(at('headshot')), hand: 'right',
  };
  const move = {
    speed: r2(at('speed')),
    ...(p >= THRESHOLDS.jump ? { jump: true, airJumps: p >= THRESHOLDS.airJump ? 1 : 0 } : {}),
    ...(p >= THRESHOLDS.dash ? { dash: true } : {}),
  };
  return {
    pole: p, read: p <= 0.25 ? R.read : p >= 0.75 ? S.read : 'between the poles',
    ttk, rounds, hp, weapon, move,
    regen: p >= THRESHOLDS.regen ? { ...S.regen, max: hp } : null,
    abilities: {
      ...(p >= THRESHOLDS.heal ? { heal: { ...S.heal, max: hp } } : {}),
      ...(p >= THRESHOLDS.ultimate ? { ultimate: { ...S.ultimate, max: hp } } : {}),
    },
    respawn: r2(at('respawn')),
    mind: { peek: p < THRESHOLDS.peekBelow, strafe: r2(at('strafe')), dodge: p >= THRESHOLDS.dash },
    arena: p < 0.34 ? R.arena : p > 0.66 ? S.arena : 'a three-lane arena',
  };
}
