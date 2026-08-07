import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from './controllable-world.js';

// ── GOLDEN TRACES (controllable-split.plan.md, S0) ────────────────────────────────────────────────
// Four scripted scenario traces over the live engine — the behavior gate for the monolith→builders
// decomposition. Every split stage (S0–S4) must leave these snapshots BYTE-IDENTICAL: the digests
// capture full-precision positions and combat state on a fixed cadence, so any drift in the sim —
// a reordered pass, a lost default, a changed helper — shows up as a snapshot diff. Scenarios are
// chosen to cover the engine's mode branches, not to be good gameplay:
//   1. walk        — walk rule + mover + clock + follow camera over wavy terrain (no combat at all)
//   2. groundArena — platform pilot (boost gauge / dodge / tackle / loadout: rifle+saber+bazooka,
//                    shield) vs an ai hunter (meleeSeek, boost juke, difficulty detune), colliders,
//                    match layer with respawns
//   3. space       — 6DoF space mode: platform space pilot (energy beam + melee) vs a space ai,
//                    station collider, ascend/descend/boost/dodge
//   4. matchDropIn — team match: spawn drop-in + fire-gated guard + wreck finisher, weak hulls so
//                    a kill → death burst → vanish → respawn lifecycle runs inside the trace
// Inputs are pure functions of the frame index (deterministic, dice-free like the engine itself).

const DT = 1 / 60;

// sample the world every SAMPLE_EVERY frames into a compact full-precision digest
const SAMPLE_EVERY = 6;

function digestEntity(e) {
  const d = {
    id: e.id,
    pos: e.transform.pos.slice(),
    heading: e.transform.heading,
    pitch: e.transform.pitch,
    locomotion: e.locomotion,
    gaitPhase: e.gaitPhase,
    moving: e.moving,
  };
  if (e.isCamera) { d.lookAt = e.lookAt ? e.lookAt.slice() : null; return d; }
  d.vel = e.vel.slice();
  if (e.body && Number.isFinite(e.body.hp)) d.hp = e.body.hp;
  if (Number.isFinite(e.poise)) d.poise = e.poise;
  if (e.staggerT != null) d.staggerT = e.staggerT;
  if (e.reactClip && e.staggerT != null) d.reactClip = e.reactClip;
  if (e.downed) d.downed = true;
  if (e.gone) d.gone = true;
  if (e.invincible) d.invincible = true;
  if (e.boost != null) d.boost = e.boost;
  if (e.boostLock) d.boostLock = true;
  if (e.loadoutIdx != null) d.loadoutIdx = e.loadoutIdx;
  if (e.weapon) d.ammo = e.weapon.ammo;
  if (e.weapon && e.weapon.energyMax > 0) d.energy = e.weapon.energy;
  if (Number.isFinite(e.shieldHp)) d.shieldHp = e.shieldHp;
  if (e.swingT != null) d.swingT = e.swingT;
  if (e.dodgeT != null) d.dodgeT = e.dodgeT;
  if (e.tackleT != null) d.tackleT = e.tackleT;
  if (e.clashT != null) d.clashT = e.clashT;
  if (e.dropping) d.dropping = true;
  if (e.spawnGuard) d.spawnGuard = true;
  if (e.thrust) d.thrust = e.thrust;
  return d;
}

function digestFrame(state, frame) {
  const d = {
    frame,
    time: state.time,
    entities: state.entities.map(digestEntity),
    projectiles: state.projectiles.length,
    burstSeq: state.burstSeq,
    clashSeq: state.clashSeq,
    shieldBreaks: state.shieldBreaks,
    pilotId: state.pilotId,
  };
  if (state.match) {
    d.match = {
      kills: { ...state.match.kills },
      over: state.match.over,
      winner: state.match.winner,
      winnerTeam: state.match.winnerTeam ?? null,
      dead: !!state.match.dead,
    };
  }
  if (state.cinematic) d.cinematic = true;
  return d;
}

function trace(state, script, frames, hooks) {
  const samples = [];
  for (let i = 0; i < frames; i++) {
    stepWorld(state, script(i), DT, hooks);
    if ((i + 1) % SAMPLE_EVERY === 0) samples.push(digestFrame(state, i + 1));
  }
  return samples;
}

// press-edge helper: 1 on exactly the listed frames
const on = (i, frames) => (frames.includes(i) ? 1 : 0);
// held: 1 while i is inside any [from, to) span
const held = (i, spans) => (spans.some(([a, b]) => i >= a && i < b) ? 1 : 0);

describe('golden traces (behavior gate for the controllable split)', () => {
  it('walk world: walk + mover + clock + follow camera over wavy terrain', () => {
    const state = createWorld({
      entities: [
        { id: 'hero', rule: { type: 'walk', speed: 6, turn: 2.2, stride: 2.4, strafe: 1, eye: 0.9 }, body: { type: 'mesh', shape: 'box' }, transform: { pos: [0, 0, 0], heading: 0 } },
        { id: 'lift', rule: { type: 'mover', from: [6, -4, 0], to: [6, 8, 2], period: 5 }, body: { type: 'mesh', carrier: true, carryRadius: 2.5, deck: 0.4 }, transform: { pos: [6, -4, 0] } },
        { id: 'amb', rule: { type: 'clock', rate: 0.8 }, body: { type: 'mesh' }, transform: { pos: [-5, 3, 0] } },
      ],
      camera: { rule: 'follow', target: 'hero', dist: 8, height: 4, lead: 3 },
    });
    const hooks = { ground: (p) => Math.sin(p[0] * 0.13) * 1.5 + Math.cos(p[1] * 0.09) };
    const script = (i) => ({
      forward: held(i, [[0, 70], [70, 110]]) * (i < 70 ? 1 : -0.6),
      turn: held(i, [[40, 110], [150, 200]]),
      strafe: held(i, [[110, 150]]),
    });
    expect(trace(state, script, 240, hooks)).toMatchSnapshot();
  });

  it('ground arena: platform pilot (gauge/dodge/tackle/loadout/shield) vs ai hunter, colliders, match', () => {
    const rifle = { fireClass: 'sight', magazine: 8, cooldown: 0.4, damage: 16, impact: 40, range: 300, eye: 14 };
    const bazooka = { fireClass: 'lob', magazine: 2, cooldown: 1.5, damage: 30, splashRadius: 10, projectileSpeed: 80, projectileGravity: 18, lobAngle: 4, eye: 14 };
    const suitBody = { type: 'figure-rig', hittable: true, hp: 120, poise: 100, egg: { a: 3, c: 11 }, collide: { a: 3, c: 11 }, shield: { hp: 40 } };
    const pilotRule = {
      type: 'platform', speed: 12, boostSpeed: 40, eye: 0, jumpSpeed: 12,
      boostMax: 9, dodge: true, tackle: true, kneel: true, collideRadius: 3.5, collideHeight: 22, strikeDur: 0.8, strikeCooldown: 1.2,
      loadout: [
        { name: 'rifle', weapon: rifle },
        { name: 'saber', strike: 'melee', strikeReach: 14, strikeDamage: 24, strikeImpact: 100, combo: 1 },
        { name: 'bazooka', weapon: bazooka },
      ],
    };
    const state = createWorld({
      entities: [
        { id: 'pilot', pilotable: true, rule: pilotRule, ambient: { type: 'static' }, body: suitBody, transform: { pos: [0, 0, 0], heading: 0 } },
        {
          // a pure SHOOTER (no meleeSeek — the space scenario covers the ai blade; a ground melee
          // hunter stun-locks the scripted pilot and starves the bazooka/tackle branches of the
          // trace). Two ranged slots so the ai WEAPON ROTATION path runs (mg ↔ rifle every ~6s).
          id: 'hunter',
          rule: {
            type: 'ai', speed: 10, boost: true, boostSpeed: 34, turn: 2.4, eye: 0, standoff: 60,
            collideRadius: 3.5, collideHeight: 22,
            loadout: [
              { name: 'mg', weapon: { fireClass: 'area', auto: true, rof: 8, magazine: 24, damage: 4, impact: 12, range: 260, eye: 14 } },
              { name: 'rifle', weapon: { fireClass: 'sight', magazine: 10, cooldown: 0.6, damage: 10, impact: 20, range: 300, eye: 14 } },
            ],
          },
          body: { ...suitBody, shield: undefined }, transform: { pos: [90, 6, 0], heading: Math.PI },
        },
      ],
      camera: { rule: 'follow', target: 'pilot', dist: 30, height: 14, shoulder: 5 },
      colliders: [{ min: [40, -30, 0], max: [52, -14, 18] }],
      aiDifficulty: 'medium',
      match: { killTarget: 3, respawnDelay: 1.2, iFrames: 1, spawns: [[0, 0, 0], [90, 6, 0], [40, 60, 0]] },
    });
    const hooks = { ground: () => 0 };
    // action frames respect the engine's own gates so every subsystem actually RUNS in the trace:
    // weapon switches pay a 1s ready-time (fire ≥60 frames after cycle), the dodge owns the body
    // for ~33 frames, the tackle for 120 — the script sequences around them, and the snapshot
    // proves each maneuver happened (swingT / dodgeT / tackleT / projectiles > 0 samples).
    const script = (i) => ({
      forward: held(i, [[0, 90], [260, 330]]),
      turn: held(i, [[90, 120]]) * 0.5,
      fire: held(i, [[30, 34], [60, 64], [190, 194], [360, 364], [380, 384]]),
      jump: on(i, [100]),
      jumpHeld: held(i, [[100, 112]]),
      boost: held(i, [[180, 210]]) || on(i, [214, 218]),   // a boost burn, then tap-tap → dodge
      cycle: on(i, [125, 296]),                              // rifle → saber (swing at 190) → bazooka (lobs at 360/380)
      slot: 0,
      tackle: held(i, [[400, 404]]),                         // after the bazooka rounds — the tackle owns 400–520
      aiToggle: on(i, [530]),
      kneel: held(i, [[330, 338]]),
    });
    expect(trace(state, script, 540, hooks)).toMatchSnapshot();
  });

  it('space: 6DoF pilot (energy beam + melee) vs space ai around a station collider', () => {
    const beam = { fireClass: 'sight', magazine: 30, cooldown: 0.5, damage: 18, impact: 60, range: 400, eye: 10, energyMax: 6, energyCost: 2, energyRegen: 1.5 };
    const suitBody = { type: 'figure-rig', hittable: true, hp: 140, poise: 100, egg: { a: 3, c: 11 }, collide: { a: 3, c: 11 } };
    const state = createWorld({
      entities: [
        {
          id: 'pilot', pilotable: true,
          rule: {
            type: 'platform', space: true, speed: 12, boostSpeed: 44, boostMax: 8, dodge: true, collideRadius: 3.5,
            strikeDur: 0.8, loadout: [{ name: 'beam', weapon: beam }, { name: 'saber', strike: 'melee', strikeReach: 14, strikeDamage: 22, strikeImpact: 100 }],
          },
          ambient: { type: 'static' }, body: suitBody, transform: { pos: [0, 0, 20], heading: 0 },
        },
        {
          id: 'seeker',
          rule: {
            type: 'ai', space: true, speed: 11, boost: true, boostSpeed: 36, meleeSeek: true, turn: 2.2, standoff: 50, target: 'all',
            loadout: [
              { name: 'rifle', weapon: { fireClass: 'sight', magazine: 10, cooldown: 0.6, damage: 12, impact: 45, range: 320, eye: 10 } },
              { name: 'blade', strike: 'melee', strikeReach: 13, strikeDamage: 18, strikeImpact: 100 },
            ],
          },
          body: suitBody, transform: { pos: [110, -20, 45], heading: Math.PI },
        },
      ],
      camera: { rule: 'follow', target: 'pilot', dist: 26, height: 10, pitchFollow: 1 },
      colliders: [{ min: [30, 20, 0], max: [70, 60, 40] }],
    });
    const script = (i) => ({
      forward: held(i, [[0, 100], [220, 300]]),
      lookDX: held(i, [[40, 90]]) * 3,
      lookDY: held(i, [[100, 130]]) * -2,
      jumpHeld: held(i, [[130, 170]]),   // ascend
      kneel: held(i, [[170, 200]]),      // descend
      boost: held(i, [[200, 230]]) || on(i, [236, 240]),   // burn then tap-tap dodge
      fire: held(i, [[60, 64], [95, 99], [250, 290], [365, 369]]),   // beam bolts, then a space saber swing
      cycle: on(i, [300]),                                            // beam → saber (ready-time paid by 360)
    });
    expect(trace(state, script, 420, undefined)).toMatchSnapshot();
  });

  it('team match: drop-in + fire guard + wreck finisher through a kill → respawn lifecycle', () => {
    const gun = { fireClass: 'sight', magazine: 6, cooldown: 0.35, damage: 30, impact: 60, range: 300, eye: 12 };
    const frail = { type: 'figure-rig', hittable: true, hp: 55, poise: 80, egg: { a: 3, c: 11 }, collide: { a: 3, c: 11 } };
    const state = createWorld({
      entities: [
        {
          id: 'blue', pilotable: true, team: 'a',
          rule: { type: 'platform', speed: 12, eye: 0, boostMax: 8, dodge: true, collideRadius: 3.5, loadout: [{ name: 'gun', weapon: gun }] },
          ambient: { type: 'static' }, body: frail, transform: { pos: [0, 0, 0], heading: 0 },
        },
        {
          id: 'red', team: 'b',
          rule: {
            type: 'ai', speed: 9, turn: 2.0, standoff: 70, target: 'enemy', eye: 0, collideRadius: 3.5,
            loadout: [{ name: 'gun', weapon: { ...gun, damage: 10, cooldown: 0.8 } }],
          },
          body: { ...frail }, transform: { pos: [70, 0, 0], heading: Math.PI },
        },
      ],
      camera: { rule: 'follow', target: 'blue', dist: 28, height: 12 },
      // killTarget 1 → the first kill ENDS the bout: the trace covers over/winner/winnerTeam and the
      // result tableau (controls dead). respawnDelay 3 outlasts the topple fall (~1.7s) + the wreck
      // linger (0.3s), so the death burst DEFERS and the wreck goes `gone` inside the trace window.
      match: { killTarget: 1, respawnDelay: 3, dropHeight: 50, dropSpeed: 60, fireGuard: true, fireGuardMax: 4, spawns: [[0, 0, 0], [70, 0, 0]] },
      wreckExplodes: { delay: 0.3 },
    });
    const hooks = { ground: () => 0 };
    const script = (i) => ({
      forward: held(i, [[70, 110]]),
      fire: held(i, [[80, 84], [110, 114], [140, 144], [180, 184], [220, 224], [260, 264], [300, 304]]),
    });
    expect(trace(state, script, 420, hooks)).toMatchSnapshot();
  });
});
