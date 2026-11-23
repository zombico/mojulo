import { describe, it, expect } from 'vitest';
import { planTrack } from './track.js';
import { driveSurfaceTable, surfaceAt, padAt } from './surface.js';
import { SURFACES } from './surfaces.js';
import { vehicleRule } from './vehicles.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

// THE ALLEY IS WORTH TAKING, AND ONLY OVER ITS PADS: a kart on the drive rule, at full pace from the same start at the
// same speed, reaches the far side of a corner sooner down its cobbled alley over the boost pads than round the way,
// and later down the alley with the pads taken away (the cobbles are slow): the pads are why it pays.
const plan = planTrack({ form: 'circuit', course: { class: 'kart', length: 700, seed: 3, streets: true }, language: 'candy-city' });
const SP = plan.street.split, a = plan.alignment, B = SP.branch.alignment, D = driveSurfaceTable(plan);
const along = (al, s0, s1, step = 2) => { const out = []; for (let s = s0; s <= s1 + 1e-6; s += step) { const q = al.at(s); out.push([q.x, q.y]); } return out; };
function race(line, { pads = true } = {}) {
  const rule = { ...vehicleRule('kart'), type: 'racer', line, closed: false, pace: 1 }, q0 = a.at(SP.s0 - 20);
  const W = createWorld({ entities: [{ id: 'k', rule, transform: { pos: [q0.x, q0.y, 0], heading: q0.heading } }] });
  const end = line[line.length - 1], hooks = { ground: () => 0, surface: (p) => surfaceAt(D, p), ...(pads ? { padAt: (p) => padAt(D, p) } : {}) };
  // (at speed from the start: a step to settle it on the ground, then the speed it comes into the corner at)
  stepWorld(W, {}, 1 / 60, hooks); W.byId.k.speed = 17;
  let t = 0, boosted = false;
  for (; t < 30; t += 1 / 60) { stepWorld(W, {}, 1 / 60, hooks); const p = W.byId.k.transform.pos; boosted ||= !!W.byId.k.boosting; if (Math.hypot(p[0] - end[0], p[1] - end[1]) < 3) break; }
  return { t, boosted };
}

describe('a street circuit\'s alley', () => {
  const way = along(a, SP.s0 - 20, SP.s1 + 20), alley = [...along(a, SP.s0 - 20, SP.s0 - 2), ...along(B, 0, B.length), ...along(a, SP.s1 + 2, SP.s1 + 20)];
  it('cuts across a corner\'s inside, shorter than the way round it, cobbled, its pads lighting a boost', () => {
    expect(SP.kind).toBe('alley');
    expect(B.length).toBeLessThan(SP.s1 - SP.s0);
    const mid = B.at(B.length / 2), q = surfaceAt(D, [mid.x, mid.y]);
    expect([q.mu, q.roll]).toEqual([SURFACES.cobbles.mu, SURFACES.cobbles.roll]);
    expect(SP.pads.length).toBeGreaterThan(0);
    expect(padAt(D, SP.pads[0].at)).toBe(SP.pads[0].boost);
    const before = a.at(SP.s0 - 10);
    expect(padAt(D, [before.x, before.y])).toBe(0);
  });
  it('over its pads it is the quicker way; bare on its cobbles the slower, so the pads are why it pays', () => {
    const round = race(way), cut = race(alley), bare = race(alley, { pads: false });
    if (process.env.BOOST_TIMES) console.log('TIMES', round.t.toFixed(2), cut.t.toFixed(2), bare.t.toFixed(2));
    expect(cut.boosted).toBe(true); expect(round.boosted).toBe(false);
    expect(cut.t).toBeLessThan(round.t);
    expect(bare.t).toBeGreaterThan(round.t);
  });
});
