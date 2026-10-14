import { describe, it, expect } from 'vitest';
import { planCourse, courseCheckpoints, flightLaps, GATE_MIN_S } from './course.js';
import { seatCraft } from './craft.js';
import { flyCourse } from './autopilot.js';
import { airspaceOf } from './airspace.js';
import { DEPARTURE } from './ground.js';
import { CRAFT } from './eye.js';
import { HEARTBEAT_IDS, HEARTBEAT_PRESETS } from '../era/heartbeat.js';

// one powered craft and one without an engine, from the registry; a heartbeat with a cliff (the departure's obstacle)
const powered = Object.keys(CRAFT).filter((k) => CRAFT[k].engine !== false).sort((a, b) => CRAFT[a].max - CRAFT[b].max)[0];
const unpowered = Object.keys(CRAFT).find((k) => CRAFT[k].engine === false);
const cliffy = HEARTBEAT_IDS.find((id) => HEARTBEAT_PRESETS[id].marks.some((m) => m.op === 'cliff'));
const make = (craft, extra = {}) => airspaceOf({ kind: 'airspace', map: { form: 'island', craft }, ground: { heartbeat: cliffy, pads: [{ at: [0.5, 0.25] }] }, ...extra });

describe('the course', () => {
  it('keeps every law, and its gates are the laps mechanic\'s checkpoints in three dimensions', () => {
    const { map, field } = make(powered), C = planCourse(map, field);
    expect(C.laws.filter((l) => !l.ok)).toEqual([]);
    const cps = courseCheckpoints(C);
    expect(cps.length).toBe(C.gates.length + 1);                       // the gates, then the finish on the runway
    expect(cps.every((c) => c.planar === false)).toBe(true);
    expect(C.gates.length * GATE_MIN_S * map.craft.cruise).toBeLessThan(2 * Math.PI * map.rings.field.hx);
  });

  it('sites the runway where its departure clears the ground ahead, even with a cliff on the map', () => {
    const { field } = make(powered), pad = field.pads[0];
    expect([1, -1]).toContain(pad.depart);
    expect(pad.gradient).toBeLessThanOrEqual(DEPARTURE.gradient);
  });

  it('flies a craft with no engine once, downhill, launched high enough to glide to its first gate', () => {
    const { map, field } = make(unpowered), C = planCourse(map, field);
    expect(C.open).toBe(true);
    for (let i = 1; i < C.gates.length; i++) expect(C.gates[i].at[2]).toBeLessThanOrEqual(C.gates[i - 1].at[2] + 0.05);
    expect(C.laws.filter((l) => !l.ok)).toEqual([]);
  });

  it('is flown by its own craft on its rule: every gate in order, then landed on the runway no harder than its gear takes', () => {
    for (const craft of [powered, unpowered]) {
      const { map, field } = make(craft), r = flyCourse(map, field, planCourse(map, field));
      expect(r.flown, `${craft}: ${r.reason}`).toBe(true);
      expect(r.passed).toBe(r.of);
      expect(r.landed).toBe(1);
      expect(r.landing.sink).toBeLessThanOrEqual(CRAFT[craft].sink);
      const pad = field.pads[0];
      expect(r.landing.at[0]).toBeGreaterThanOrEqual(pad.x0 - 1); expect(r.landing.at[0]).toBeLessThanOrEqual(pad.x1 + 1);
      expect(r.landing.at[1]).toBeGreaterThanOrEqual(pad.y0 - 1); expect(r.landing.at[1]).toBeLessThanOrEqual(pad.y1 + 1);
    }
  });

  it('gives the laps mechanic a landing to finish on, the pads to set down in and a respawn for each stretch', () => {
    const { map, field } = make(powered), C = planCourse(map, field), seat = seatCraft(map, field, C), L = flightLaps(C, map, field, seat);
    const fin = L.checkpoints.at(-1), pad = field.pads[0];
    expect(fin.land).toBe(true);
    expect(fin.half.slice(0, 2)).toEqual([(pad.x1 - pad.x0) / 2, (pad.y1 - pad.y0) / 2]);
    expect(L.land.pads).toHaveLength(field.pads.length);
    expect(L.respawn).toHaveLength(L.checkpoints.length);
    expect(L.respawn[0]).toMatchObject({ spot: seat.transform.pos, aloft: 0 });
    // after a gate: that gate, aloft, heading for the next checkpoint
    const g = C.gates[0].at, n = L.checkpoints[1].at;
    expect(L.respawn[1]).toEqual({ spot: g, heading: Math.round(Math.atan2(n[1] - g[1], n[0] - g[0]) * 100) / 100, aloft: 1 });
  });

  it('is deterministic', () => {
    const { map, field } = make(powered);
    expect(JSON.stringify(planCourse(map, field, { seed: 4 }))).toBe(JSON.stringify(planCourse(map, field, { seed: 4 })));
  });
});
