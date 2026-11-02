import { describe, it, expect } from 'vitest';
import { resolveMount } from './build.js';
import { gaitCycle } from './gait.js';
import { gaitGates, shotGates, jumpGates, idleGates } from './gates.js';
import { idleLayer, idleClip, grazeClip, IDLE_LAYERS } from './idle.js';
import { jumpClip } from './jump.js';
import { oneShot } from './motion.js';
import { standPose } from './gait.js';
import { GAITS } from './reference.js';
import { REGISTERS } from './cards.js';

// The deep sweep: every gait at both ends of its speed band, on both leads where it has one, in every register, held to
// the machine gate (the joint ranges are the preferred speed's, so they are checked in mount.test.js, not here).
describe('the mount at its speed bands\' ends', () => {
  for (const register of Object.keys(REGISTERS)) {
    const B = resolveMount('horse', { register });
    for (const [gait, spec] of Object.entries(GAITS)) for (const v of spec.speed) for (const lead of spec.symmetric ? ['right'] : ['right', 'left']) {
      it(`${register} ${gait} at ${v} m/s, ${lead} lead`, () => {
        const r = gaitGates(B, gaitCycle(B, gait, { speed: v * Math.sqrt(B.scale), lead }));
        expect(r.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
      });
    }
  }
});

// every one-shot, every register, both leads where a canter or gallop is in it, held to the one-shot machine gate
const SHOTS = [['stand', 'walk'], ['walk', 'trot'], ['trot', 'walk'], ['trot', 'canter'], ['canter', 'trot'], ['canter', 'gallop'], ['gallop', 'canter'], ['walk', 'stand'], ['trot', 'stand']];
describe('the mount\'s one-shots', () => {
  for (const register of Object.keys(REGISTERS)) {
    const B = resolveMount('horse', { register }), stand = standPose(B);
    for (const [from, to] of SHOTS) for (const lead of [from, to].some((g) => GAITS[g] && !GAITS[g].symmetric) ? ['right', 'left'] : ['right']) {
      it(`${register} ${from} → ${to}, ${lead} lead`, () => {
        const r = shotGates(B, oneShot(B, { from, to, lead }), { stand });
        expect(r.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
      });
    }
  }
});

// the jump over uprights of three heights and an oxer, both leads (the realistic register: the stylized one's jump is a
// recorded gap, its margins a centimetre or two short at the rail and the ground)
describe('the mount\'s jumps', () => {
  const B = resolveMount('horse'), stand = standPose(B);
  for (const [fence, spread] of [[0.8, 0], [1.1, 0], [1.3, 0], [1.1, 1.2]]) for (const lead of ['right', 'left']) {
    it(`${fence} m${spread ? ` × ${spread} m` : ''}, ${lead} lead`, () => {
      const r = jumpGates(B, jumpClip(B, { fence, spread, lead }), { stand });
      expect(r.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
    });
  }
});

// every idle layer as its own loop, the layers together, and grazing, in every register
describe('the mount at rest', () => {
  for (const register of Object.keys(REGISTERS)) {
    const B = resolveMount('horse', { register });
    for (const name of Object.keys(IDLE_LAYERS)) {
      it(`${register} layer ${name}`, () => {
        expect(idleGates(B, idleLayer(B, name, { seed: 3 }), { loop: true }).checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
      });
    }
    it(`${register} every layer together, and grazing`, () => {
      for (const clip of [idleClip(B, { seed: 3 }), grazeClip(B, { seed: 3 })]) expect(idleGates(B, clip).checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
    });
  }
});
