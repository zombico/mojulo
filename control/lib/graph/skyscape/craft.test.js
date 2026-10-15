import { describe, it, expect } from 'vitest';
import { flyRule } from './craft.js';
import { CRAFT } from './eye.js';
import { planMap } from './map.js';
import { assembleAirspace } from './airspace.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

// one powered class and one without an engine, chosen from the registry
const powered = Object.keys(CRAFT).find((k) => CRAFT[k].engine !== false), unpowered = Object.keys(CRAFT).find((k) => CRAFT[k].engine === false);
const DT = 1 / 60, flat = { ground: () => 0 };

describe('a craft on the fly rule', () => {
  it('tops out at its class\'s top speed at full throttle', () => {
    const rule = flyRule(powered, { lever: false });
    const w = createWorld({ entities: [{ id: 'p', rule, transform: { pos: [0, 0, 2000], heading: 0, pitch: 0 } }] });
    w.byId.p.airspeed = CRAFT[powered].cruise; w.byId.p.airborne = true;
    for (let i = 0; i < 60 * 120; i++) stepWorld(w, { forward: 1 }, DT, flat);
    expect(w.byId.p.airspeed).toBeGreaterThan(CRAFT[powered].max * 0.97);
  });

  it('takes off from the runway on the lever', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: flyRule(powered), transform: { pos: [0, 0, 1.2], heading: 0, pitch: 0 } }] });
    let up = false;
    for (let i = 0; i < 60 * 60 && !up; i++) { stepWorld(w, { forward: i < 120 ? 1 : 0, lift: w.byId.p.airspeed > CRAFT[powered].stall * 1.2 ? 1 : 0 }, DT, flat); up = w.byId.p.airborne; }
    expect(up).toBe(true);
  });

  it('gives a craft without an engine no thrust, and its glide ratio as its drag', () => {
    const rule = flyRule(unpowered);
    expect(rule.engine).toBe(false);
    expect(rule.lever).toBeUndefined();
    const c = CRAFT[unpowered];
    expect(rule.drag * c.cruise * c.cruise).toBeCloseTo((c.mass * 9.81) / c.glide, 0);
  });

  it('takes the map\'s reach as its bound', () => {
    const map = planMap({ form: 'island', field: 1200, craft: powered });
    expect(flyRule(powered, { map }).bound.hx).toBe(map.rings.reach.hx);
  });

  it('is seated on the airspace\'s runway (or aloft when it has no engine), with a chase camera that banks', () => {
    const base = { kind: 'airspace', map: { form: 'island', field: 1200, craft: powered }, ground: { pads: [{ at: [0.5, 0.4] }] } };
    const p = assembleAirspace({ ...base, fly: true }, { live: true });
    expect(p.entities[0].rule.type).toBe('fly');
    expect(p.camera.rollFollow).toBe(1);
    expect(p.walk).toBeUndefined();
    const g = assembleAirspace({ ...base, fly: { craft: unpowered } }, { live: true });
    expect(g.entities[0].rule.launchSpeed).toBeGreaterThan(0);
    expect(g.entities[0].transform.pos[2]).toBeGreaterThan(p.entities[0].transform.pos[2] + 50);
  });
});
