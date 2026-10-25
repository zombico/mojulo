// THE LIVE VEHICLE IN GODOT (since kernel 0.31.0): a racer's rig, its juice and a dark mood's light travel in score.json
// for kernel/level.gd and kernel/juice.gd (score.vehicles, score.wetRoad); kernel/vehicle.gd poses the rig and reads
// the juice as the page's own functions do, held to them by the vehicle corpus.
import { describe, it, expect } from 'vitest';
import { extractEngineScore } from './engine-score.js';
import { corpus, runVehicle, SCENARIOS } from './vehicle-conformance.js';
import { runCorpus } from './engines/runners.js';
import { compare } from './engines/conformance.js';
import { supercarFigure } from '../car-designer/supercar-figure.js';

const GODOT = process.env.MOJULO_GODOT;
const score = (payload, engine) => extractEngineScore({ ref: 'r', manifest: {} }, payload, engine ? { engine } : {});
const car = (fig, extra = {}) => ({ entities: [{ id: 'car', pilotable: true, rule: { type: 'drive' }, transform: { pos: [0, 0, 0], heading: 0 }, body: { type: 'figure', figure: 'ride', ...extra } }], figures: { ride: fig } });

describe('the live vehicles a Godot level poses', () => {
  const night = supercarFigure({ mood: 'night-rain' });

  it('a rig that lives rides as its bones, clips, overlay and juice; an engine that poses none carries no key', () => {
    const s = score(car(night, { blendTime: 0.25 }), 'godot');
    expect(s.vehicles).toHaveLength(1);
    const v = s.vehicles[0];
    expect(v).toMatchObject({ id: 'car', figure: 'ride', blendTime: 0.25 });
    expect(v.bones.map((b) => b.id)).toEqual(night.bones.map((b) => b.id));
    expect(v.bones.every((b, i) => b.part === !!night.parts[i])).toBe(true);
    expect(Object.keys(v.clips)).toEqual(Object.keys(night.clips));
    expect(v.live).toEqual(night.live);
    expect(v.juice.beams).toEqual(night.juice.beams);
    expect(score(car(night), 'unity')).not.toHaveProperty('vehicles');
    // a rig with neither an overlay nor juice, and a body with no rig, carry none
    expect(score(car({ ...night, live: undefined, juice: undefined }), 'godot')).not.toHaveProperty('vehicles');
    expect(score({ entities: [{ id: 'x', rule: { type: 'walk' }, transform: { pos: [0, 0, 0] }, body: { type: 'none' } }] }, 'godot')).not.toHaveProperty('vehicles');
  });

  it('a wet road rides as its quads to 1e-4, its lamps and its sky; a dry one carries no key', () => {
    const wetRoad = { quads: [[[1.234567, 2, 0], [3, 2, 0], [3, 4, 0], [1, 4, 0.000049]]], lamps: [{ at: [1.00004, 2, 5], rgb: [255, 200, 140], intensity: 1.4, extra: 1 }], zenith: [10, 20, 30], horizon: [40, 50, 60] };
    const s = score({ wetRoad, entities: [] }, 'godot');
    expect(s.wetRoad.quads[0][0]).toEqual([1.2346, 2, 0]);
    expect(s.wetRoad.quads[0][3][2]).toBe(0);
    expect(s.wetRoad.lamps).toEqual([{ at: [1, 2, 5], rgb: [255, 200, 140], intensity: 1.4 }]);
    expect(s.wetRoad).toMatchObject({ zenith: [10, 20, 30], horizon: [40, 50, 60] });
    expect(score({ wetRoad, entities: [] }, 'unity')).not.toHaveProperty('wetRoad');
    expect(score({ wetRoad: { quads: [] }, entities: [] }, 'godot')).not.toHaveProperty('wetRoad');
  });

  it('the corpus reads every overlay a bone can take and the moments the juice answers', () => {
    const runs = Object.fromEntries(SCENARIOS.map((sc) => [sc.id, runVehicle(sc).map((x) => JSON.parse(x))]));
    const c = corpus();
    // every role the overlay gives a bone is in some machine: the front wheels, a steering wheel, a mast, the body
    const roles = new Set(c.flatMap((sc) => { const L = sc.vehicle.live; return [L.steer.length && 'steer', L.wheel && 'wheel', L.mast && 'mast', L.spin && 'spin', L.body.bones.length && 'body'].filter(Boolean); }));
    expect([...roles].sort()).toEqual(['body', 'mast', 'spin', 'steer', 'wheel']);
    const all = Object.values(runs).flat();
    // a landing, a slide, a corner held, a bump, a boost's first frame: the facts the triggers read come true
    for (const f of ['landed', 'skidding', 'impact', 'boostStart', 'damage', 'shield', 'invulnerable', 'charge', 'item']) expect(all.some((r) => r.facts[f] > 0), f).toBe(true);
    expect(all.some((r) => r.facts.cornerTime > 1.8)).toBe(true);
    // and the rows they light: the landing's ring, the drift's sparks, a flame, the shield's bubble, a hit's flash
    for (const id of ['landingRing', 'driftSpark', 'throttleFlame', 'boostFlame', 'boostShock', 'motionLines', 'speedLines']) expect(all.some((r) => r.on.includes(id)), id).toBe(true);
    expect(all.some((r) => r.bubble && r.bubble.on)).toBe(true);
    // a landing bounces the body: the root bone's height leaves its rest
    const ramp = runs['vehicle-mast-ramp'], land = ramp.findIndex((r) => r.facts.landed > 0);
    expect(land).toBeGreaterThan(0);
    expect(Math.abs(ramp[land + 2].pose[0][6] - ramp[land - 1].pose[0][6])).toBeGreaterThan(1e-3);
  });

  it.skipIf(!GODOT)('kernel/vehicle.gd poses every machine and reads its juice as the page does (MOJULO_GODOT)', () => {
    const sc = corpus();
    const { out, errors } = runCorpus('godot', 'vehicle', sc, { bin: GODOT });
    expect(errors).toEqual([]);
    expect(compare('vehicle', sc, out).filter((r) => !r.equal)).toEqual([]);
  }, 600000);

  const PLANTS = [
    { name: 'the lean settling at another rate', from: '* float(G["lean"]))) - float(S["lean"])) * minf(1.0, d * 6.0)', to: '* float(G["lean"]))) - float(S["lean"])) * minf(1.0, d * 6.5)' },
    { name: 'a landing\'s bounce damped harder', from: '(-140.0 * float(S["bz"]) - 11.0 * float(S["vz"])) * d', to: '(-140.0 * float(S["bz"]) - 12.0 * float(S["vz"])) * d' },
    { name: 'the steering wheel turned the wrong way', from: 'q_axis(1, -steer * 2.2)', to: 'q_axis(1, steer * 2.2)' },
    { name: 'the crossfade a little longer', from: 'var bt := blend_time if blend_time > 0.0 else 0.18', to: 'var bt := blend_time if blend_time > 0.0 else 0.2' },
    { name: 'a corner read against another gravity', from: 'grip if grip != 0.0 else 1.0) * 9.81)', to: 'grip if grip != 0.0 else 1.0) * 9.8)' },
    { name: 'a drift\'s tier a step early', from: 'C = lin(String(cols[mini(cols.size() - 1, maxi(0, k - 1))]))', to: 'C = lin(String(cols[mini(cols.size() - 1, maxi(0, k))]))' },
    { name: 'a colour lifted off three\'s curve', from: 'pow(c * 0.9478672986 + 0.0521327014, 2.4)', to: 'pow(c * 0.9478672986 + 0.0521327014, 2.2)' },
    { name: 'a part\'s mix colour forgotten between frames', from: '\t\t\t\t\tjs["mixCol"][int(i)] = b["mixCol"]\n', to: '' },
    { name: 'an "and" that answers its first side', from: 'return when(n[2], F) if a != 0.0 else a', to: 'return a if a != 0.0 else when(n[2], F)' },
    { name: 'the speed\'s change smoothed slower', from: 'js["accel"] = float(js["accel"]) + (acc - float(js["accel"])) * minf(1.0, d * 8.0)', to: 'js["accel"] = float(js["accel"]) + (acc - float(js["accel"])) * minf(1.0, d * 7.0)' },
  ];
  it.skipIf(!GODOT)('every planted bug in the pose and the juice is caught by the corpus (MOJULO_GODOT)', () => {
    const sc = corpus();
    for (const p of PLANTS) {
      const { out } = runCorpus('godot', 'vehicle', sc, { bin: GODOT, mutate: [{ file: 'vehicle.gd', from: p.from, to: p.to }] });
      expect(compare('vehicle', sc, out).some((r) => !r.equal), p.name).toBe(true);
    }
  }, 900000);
});
