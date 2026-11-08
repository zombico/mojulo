import { describe, it, expect } from 'vitest';
import { solveClassical } from './solve.js';
import { CLASSICAL_LAW } from './laws.js';
import { MATTER } from '../../rupa/matter.js';

// Matter on classical bodies: one case per procedure (mass from density, bounce on a pair, bounce on a plane, a
// medium's numbers, the impact verdicts, the refusals) and the absent-channel rule.

const gateOf = (r, id) => r.gates.find((g) => g.id === id);
const sphere = (r) => (4 / 3) * Math.PI * r ** 3;

describe('science worlds: classical bodies made of matter', () => {
  it('adds nothing when no body or law names matter', () => {
    const r = solveClassical({ model: CLASSICAL_LAW.collision.example });
    expect(r.matter).toBeUndefined();
    expect(gateOf(r, 'bodies-intact')).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain('rupa');
  });

  it('takes a body\'s mass from its matter\'s density and its radius, and says so', () => {
    const r = solveClassical({ model: {
      bodies: [{ id: 'ball', matter: 'steel', radius: '5 cm', at: [0, 0, 1] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane' }], duration: 1,
    } });
    const m = MATTER.steel.density * sphere(0.05);
    expect(r.model.bodies[0].mass).toBeCloseTo(m, 9);
    expect(r.model.bodies[0].matter).toBe('steel');
    expect(r.matter.bodies.ball.mass.from).toBe('density × volume');
  });

  it('gives each colliding pair the lower bounce of its two matters, and the head-on closed form still holds', () => {
    const r = solveClassical({ model: {
      bodies: [{ id: 'a', matter: 'steel', radius: 0.05, at: [-0.5, 0, 0], v: [2, 0, 0] }, { id: 'b', matter: 'timber', radius: 0.05, at: [0.5, 0, 0] }],
      laws: [{ law: 'collision' }], duration: 1,
    } });
    const e = Math.min(MATTER.steel.bounce, MATTER.timber.bounce);
    expect(gateOf(r, 'closed-form:collision')?.ok).toBe(true);
    expect(gateOf(r, 'energy-never-gained')?.ok).toBe(true);
    // the steel ball keeps (m₁ − e·m₂) / (m₁ + m₂) of its speed
    const m1 = r.model.bodies[0].mass, m2 = r.model.bodies[1].mass;
    const v1 = r.tracks.bodies.a.v.at(-1)[0];
    expect(v1).toBeCloseTo((2 * (m1 - e * m2)) / (m1 + m2), 3);
    expect(r.matter.contacts).toBe(1);
  });

  it('bounces a body on a plane by the lower bounce of the two matters', () => {
    const r = solveClassical({ model: {
      bodies: [{ id: 'ball', matter: 'glass', radius: 0.02, at: [0, 0, 1] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane', matter: 'concrete' }], duration: 0.6,
    } });
    const e = Math.min(MATTER.glass.bounce, MATTER.concrete.bounce);
    const vz = r.tracks.bodies.ball.v.map((v) => v[2]);
    const k = vz.findIndex((v, i) => i > 0 && v > 0 && vz[i - 1] < 0);
    const before = vz[k - 1], after = vz[k];
    expect(after / -before).toBeGreaterThan(e * 0.9);
    expect(after / -before).toBeLessThan(e * 1.1);
  });

  it('takes a drag\'s viscosity and a buoyancy\'s density from the medium it names', () => {
    const bead = { id: 'bead', matter: 'steel', radius: '2 mm', at: [0, 0, -0.01] };
    const viaMedium = solveClassical({ model: { bodies: [bead], laws: [{ law: 'gravity-uniform' }, { law: 'drag-linear', medium: 'honey' }, { law: 'buoyancy', medium: 'honey', surface: 1 }], duration: 0.5 } });
    const viaNumbers = solveClassical({ model: { bodies: [bead], laws: [{ law: 'gravity-uniform' }, { law: 'drag-linear', viscosity: MATTER.honey.viscosity }, { law: 'buoyancy', rho: MATTER.honey.density, surface: 1 }], duration: 0.5 } });
    expect(viaMedium.tracks).toEqual(viaNumbers.tracks);
    expect(viaMedium.model.laws[1].medium).toBe('honey');
  });

  it('reports what each contact did: a fast steel ball breaks a glass one, a slow one leaves it whole; the run is never altered', () => {
    const run = (speed) => solveClassical({ model: {
      bodies: [{ id: 'shot', matter: 'steel', radius: 0.03, at: [-0.3, 0, 0], v: [speed, 0, 0] }, { id: 'pane', matter: 'glass', radius: 0.03, at: [0.3, 0, 0] }],
      laws: [{ law: 'collision' }], duration: 0.6 / speed + 0.2,
    } });
    const slow = run(0.05), fast = run(200);
    expect(slow.matter.bodies.pane.worst).toBe('holds');
    expect(gateOf(slow, 'bodies-intact').ok).toBe(true);
    expect(fast.matter.bodies.pane.worst).toBe('breaks');
    expect(fast.matter.broken).toEqual(['pane']);
    expect(gateOf(fast, 'bodies-intact').ok).toBe(false);
    expect(fast.matter.enacted).toBe(false);
  });

  it('a plastic matter dents before it breaks', () => {
    const r = solveClassical({ model: {
      bodies: [{ id: 'slug', matter: 'lead', radius: 0.02, at: [0, 0, 2] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane', matter: 'steel' }], duration: 0.8,
    } });
    expect(r.matter.bodies.slug.worst).toBe('dents');
  });

  it('refuses a liquid as a body and a solid as a medium, and asks for a radius when the mass must come from matter', () => {
    expect(() => solveClassical({ model: { bodies: [{ id: 'drop', matter: 'water', radius: 0.01, at: [0, 0, 0] }], laws: [], duration: 1 } })).toThrow(/a body is a solid/);
    expect(() => solveClassical({ model: { bodies: [{ id: 'b', mass: 1, radius: 0.01, at: [0, 0, 0] }], laws: [{ law: 'drag-linear', medium: 'steel' }], duration: 1 } })).toThrow(/not a liquid or a gas/);
    expect(() => solveClassical({ model: { bodies: [{ id: 'b', matter: 'steel', at: [0, 0, 0] }], laws: [], duration: 1 } })).toThrow(/or a radius/);
  });
});
