// The airport: its plan in true metres (both glyphs, the same twice), every stand's aircraft fitting its stand and clear
// of every pier and every other stand, nose-in, its jet bridge reaching its first door; the field at its separations;
// each concourse a wing that lists its stands; and the miniature: the plan at its scale on its plinth, a net a stand.
import { describe, it, expect } from 'vitest';
import { planAirport, AIRPORT_GLYPHS, AIRPORT_FIGURES } from './plan.js';
import { airportMiniature, assembleAirportScene, MINIATURE_SCALES } from './miniature.js';
import { craftFootprint } from '../craft-shelf/index.js';
import { airportWing } from './wing.js';
import { jetBridge } from './jet-bridge.js';

const W = AIRPORT_FIGURES;
const box = (c, u, hu, hn) => ({ c, ux: u, nx: [-u[1], u[0]], halfU: hu, halfN: hn });
const proj = (o, ax) => Math.abs(o.ux[0] * ax[0] + o.ux[1] * ax[1]) * o.halfU + Math.abs(o.nx[0] * ax[0] + o.nx[1] * ax[1]) * o.halfN;
const overlap = (a, b) => { const d = [b.c[0] - a.c[0], b.c[1] - a.c[1]]; return [a.ux, a.nx, b.ux, b.nx].every((ax) => Math.abs(d[0] * ax[0] + d[1] * ax[1]) < proj(a, ax) + proj(b, ax) - 1e-6); };
const figs = (craft) => { const F = craftFootprint(craft); return { span: F.max[0] - F.min[0], length: F.max[1] - F.min[1] }; };
// a stand's aircraft as it stands: its span across the stand's line, its length along its heading
const planeBox = (s) => { const f = figs(s.craft); return box(s.at, s.u, f.span / 2, f.length / 2); };
const pierBox = (p) => { const d = [p.b[0] - p.a[0], p.b[1] - p.a[1]], l = Math.hypot(...d); return box([(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2], [d[0] / l, d[1] / l], l / 2, p.w / 2); };

describe('the airport\'s plan, in true metres', () => {
  const plans = AIRPORT_GLYPHS.map((glyph) => planAirport({ seed: 3, glyph, stands: 16 }));
  it('either glyph, the same twice, its stands as many as asked where they fit', () => {
    plans.forEach((p, k) => {
      expect(p.glyph).toBe(AIRPORT_GLYPHS[k]);
      expect(JSON.stringify(planAirport({ seed: 3, glyph: AIRPORT_GLYPHS[k], stands: 16 }))).toBe(JSON.stringify(p));
      expect(p.stands.length).toBeGreaterThan(8);
      expect(p.stands.length).toBeLessThanOrEqual(16);
      expect(p.concourses.every((c) => c.w === W.pierW)).toBe(true);
    });
    expect(() => planAirport({ glyph: 'spiral' })).toThrow(/glyph/);
    expect(() => planAirport({ stands: 0 })).toThrow(/stands/);
  });
  it('every aircraft on its stand clear of every pier and every other aircraft, nose-in, its bridge at its door', () => {
    for (const p of plans) {
      const planes = p.stands.map(planeBox), piers = p.concourses.map(pierBox);
      for (let i = 0; i < planes.length; i++) {
        for (const q of piers) expect(overlap(planes[i], q), `${p.stands[i].id} on a pier`).toBe(false);
        for (let j = i + 1; j < planes.length; j++) expect(overlap(planes[i], planes[j]), `${p.stands[i].id} on ${p.stands[j].id}`).toBe(false);
      }
      for (const s of p.stands) {
        // (nose-in: its heading toward its pier, its nose its stop line off the pier's face)
        expect(Math.cos(s.heading) * -s.nOut[0] + Math.sin(s.heading) * -s.nOut[1]).toBeCloseTo(1, 2);
        const nose = [s.at[0] + Math.cos(s.heading) * figs(s.craft).length / 2, s.at[1] + Math.sin(s.heading) * figs(s.craft).length / 2];
        expect(Math.hypot(nose[0] - s.stop[0], nose[1] - s.stop[1])).toBeCloseTo(W.noseGap, 0);
        // (a bridge where the door is high enough for its cab, at that door; none below it)
        if (!s.bridge) continue;
        expect(Math.hypot(s.bridge.door[0] - s.at[0], s.bridge.door[1] - s.at[1])).toBeLessThan(figs(s.craft).length / 2);
        expect(s.bridge.door[2]).toBeGreaterThanOrEqual(2.6);
      }
    }
  });
  it('a jet bridge at every stand whose door its cab meets, none at a low one', () => {
    const all = plans.flatMap((p) => p.stands);
    expect(all.some((s) => s.bridge)).toBe(true);
    for (const s of all.filter((q) => !q.bridge)) expect(['regional', 'bizjet']).toContain(s.craft);
  });
  it('its field at its separations; each concourse a wing that lists its stands', () => {
    for (const p of plans) {
      const F = p.field;
      expect(F.taxilane.a[1] - F.taxiway.a[1]).toBeCloseTo(W.laneToTaxiway, 3);
      expect(F.taxiway.a[1] - F.runway.a[1]).toBeCloseTo(W.taxiwayToRunway, 3);
      expect(F.runway.b[0] - F.runway.a[0]).toBeCloseTo(W.runwayL, 3);
      // (no aircraft out past the apron's edge, over its taxilane)
      for (const s of p.stands) expect(Math.min(...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => s.at[1] + s.u[1] * a * figs(s.craft).span / 2 + s.nOut[1] * b * figs(s.craft).length / 2))).toBeGreaterThan(F.apron.y0);
      for (const s of p.stands) expect(p.wings[s.wing].stands).toContain(s.id);
      for (const c of p.concourses) expect(p.wings[c.wing].concourses).toContain(c.id);
    }
  });
});

describe('the airport in miniature', () => {
  const plan = planAirport({ seed: 2, glyph: 'linear', stands: 8 });
  it('the plan at its scale on its plinth, a net at each stand, its size as its scale says', () => {
    const a = airportMiniature(plan, { scale: 1000 }), b = airportMiniature(plan, { scale: 2000 });
    expect(a.size.x).toBeCloseTo((plan.bounds.x1 - plan.bounds.x0) / 1000, 6);
    expect(b.size.x).toBeCloseTo(a.size.x / 2, 6);
    const zs = a.faces.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(0);
    // (everything above the plinth's top inside its edges)
    const above = a.faces.filter((f) => f.corners.every((c) => c[2] > a.size.top - 1e-6)).flatMap((f) => f.corners);
    for (const c of above) { expect(Math.abs(c[0])).toBeLessThan(a.size.x / 2 + 0.05); expect(Math.abs(c[1])).toBeLessThan(a.size.y / 2 + 0.05); }
    expect(() => airportMiniature(plan, { scale: 10 })).toThrow(/scale/);
    expect(MINIATURE_SCALES[0]).toBeLessThan(MINIATURE_SCALES[1]);
  });
  it('its World page payload: the model\'s faces and its cameras; the same twice', () => {
    const P = assembleAirportScene({ kind: 'airport', seed: 2, glyph: 'linear', stands: 8 });
    expect(P.faces.length).toBeGreaterThan(1000);
    expect(P.cameras.map((c) => c.name)).toEqual(expect.arrayContaining(['model', 'terminal', 'apron']));
    expect(JSON.stringify(assembleAirportScene({ kind: 'airport', seed: 2, glyph: 'linear', stands: 8 }).faces)).toBe(JSON.stringify(P.faces));
    expect(() => assembleAirportScene({ kind: 'airport', show: 'tour' })).toThrow(/show is/);
  });
});

describe('the wing at full scale and its jet bridges', () => {
  const plan = planAirport({ seed: 1, glyph: 'linear', stands: 6 });
  const id = Object.keys(plan.wings).find((w) => plan.stands.some((s) => s.wing === w && s.bridge));
  it('a jet bridge from its rotunda on its column to the door, its bellows at the door\'s sill', () => {
    const s = plan.stands.find((q) => q.wing === id && q.bridge), left = [-Math.sin(s.heading), Math.cos(s.heading)];
    const fs = jetBridge({ ...s.bridge, deck: 5.5, side: left });
    const bel = fs.filter((f) => f.part === 'bridge.bellows').flatMap((f) => f.corners);
    expect(bel.length).toBeGreaterThan(0);
    const near = Math.min(...bel.map((c) => Math.hypot(c[0] - s.bridge.door[0], c[1] - s.bridge.door[1])));
    expect(near).toBeLessThan(2.2);
    expect(Math.min(...bel.map((c) => c[2]))).toBeCloseTo(s.bridge.door[2] - 0.15, 1);
    // (its rotunda's column stands on the apron)
    expect(Math.min(...fs.filter((f) => f.part === 'bridge.frame').flatMap((f) => f.corners.map((c) => c[2])))).toBeLessThan(0.01);
  });
  it('its stands\' aircraft its figures, each a static entity at its stand; its crews as asked; its piers and bridges its faces', () => {
    const quiet = airportWing(plan, { wing: id, crews: 'none' }), busy = airportWing(plan, { wing: id, crews: 'all' });
    const n = plan.stands.filter((s) => s.wing === id).length;
    expect(Object.keys(quiet.figures)).toHaveLength(n);
    expect(quiet.entities.every((e) => e.rule.type === 'static')).toBe(true);
    expect(busy.entities.length).toBeGreaterThan(n * 4);
    expect(quiet.faces.length).toBeGreaterThan(500);
    expect(JSON.stringify(airportWing(plan, { wing: id, crews: 'none' }).faces)).toBe(JSON.stringify(quiet.faces));
    expect(() => airportWing(plan, { wing: 'Z' })).toThrow(/no wing/);
    expect(() => airportWing(plan, { crews: 'some' })).toThrow(/crews/);
  }, 120000);
});
