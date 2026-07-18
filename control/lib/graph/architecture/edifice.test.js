/**
 * edifice assembler tests — planEdifice (placement + concourse derivation + openings),
 * buildEdificeFaces (doorway punch), and the advisory reachability check. Deterministic,
 * no rendering / chromium.
 */
import { describe, it, expect } from 'vitest';
import { planEdifice, buildEdificeFaces, assessEdifice, facing, FLOOR_FT } from './edifice.js';

const CAMPUS = {
  kind: 'edifice', seed: 7, theme: 'earth-temperate',
  masses: [
    { id: 'commons', at: [0, 0], footprint: { w: 60, d: 44 }, floors: 2,
      facade: { material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frame: '#34383c' }, roof: 'flat' },
    { id: 'wing', on: { anchor: 'commons', side: 'E', align: 'S', gap: 14 }, footprint: { w: 34, d: 74 }, floors: 3,
      facade: { material: 'brick', rhythm: 'punched', glass: '#9a6650', frame: '#6f4636' }, roof: 'mission' },
    { id: 'annex', on: { anchor: 'commons', side: 'N', align: 'W', gap: 12 }, footprint: { w: 40, d: 30 }, floors: 1,
      facade: { material: 'glass', rhythm: 'banded', glass: '#9fb6c2', frame: '#5c646d' }, roof: 'modern-shed' },
  ],
  concourses: [
    { from: 'commons', to: 'wing', width: 12 },
    { from: 'commons', to: 'annex', width: 10 },
  ],
  entrance: 'commons',
};

describe('planEdifice — relative placement', () => {
  it('resolves every mass to absolute coords in dependency order', () => {
    const plan = planEdifice(CAMPUS);
    expect(plan.masses).toHaveLength(3);
    expect(plan.masses.every((m) => [m.x0, m.y0, m.x1, m.y1].every(Number.isFinite))).toBe(true);
  });

  it('places the wing EAST of the commons with the south edges aligned', () => {
    const plan = planEdifice(CAMPUS);
    const commons = plan.masses.find((m) => m.id === 'commons');
    const wing = plan.masses.find((m) => m.id === 'wing');
    expect(wing.x0).toBe(commons.x1 + 14);          // gap honored
    expect(wing.y0).toBe(commons.y0);               // align:'S' → shared south edge
  });

  it('places the annex NORTH of the commons with the west edges aligned', () => {
    const plan = planEdifice(CAMPUS);
    const commons = plan.masses.find((m) => m.id === 'commons');
    const annex = plan.masses.find((m) => m.id === 'annex');
    expect(annex.y0).toBe(commons.y1 + 12);
    expect(annex.x0).toBe(commons.x0);              // align:'W'
  });

  it('resolves placement regardless of mass order in the recipe', () => {
    const reordered = { ...CAMPUS, masses: [CAMPUS.masses[1], CAMPUS.masses[2], CAMPUS.masses[0]] };
    const plan = planEdifice(reordered);
    const wing = plan.masses.find((m) => m.id === 'wing');
    const commons = plan.masses.find((m) => m.id === 'commons');
    expect(wing.x0).toBe(commons.x1 + 14);
  });

  it('derives z1 from floors × storey height', () => {
    const plan = planEdifice(CAMPUS);
    expect(plan.masses.find((m) => m.id === 'wing').z1).toBe(3 * FLOOR_FT);
  });

  it('throws on a missing / cyclic anchor', () => {
    expect(() => planEdifice({ masses: [{ id: 'a', on: { anchor: 'ghost', side: 'E' }, footprint: { w: 10, d: 10 }, floors: 1, facade: {} }] }))
      .toThrow(/unresolved placement/);
  });
});

describe('planEdifice — concourse derivation', () => {
  it('derives a hall between the facing walls and records a punched opening on each', () => {
    const plan = planEdifice(CAMPUS);
    expect(plan.concourses).toHaveLength(2);
    const toWing = plan.concourses.find((c) => c.to === 'wing');
    expect(toWing.axis).toBe('x');
    expect(toWing.aSide).toBe('E');                 // commons' east wall
    expect(toWing.bSide).toBe('W');                 // wing's west wall
    // hall spans the gap between the two masses
    const commons = plan.masses.find((m) => m.id === 'commons');
    const wing = plan.masses.find((m) => m.id === 'wing');
    expect(toWing.hall.x0).toBe(commons.x1);
    expect(toWing.hall.x1).toBe(wing.x0);
    // an opening was recorded on both facing walls, with a world cross-span
    expect(commons.openings.some((o) => o.side === 'E' && o.span.length === 2)).toBe(true);
    expect(wing.openings.some((o) => o.side === 'W')).toBe(true);
  });

  it('builds the structureEnvelopes once (masses + halls)', () => {
    const plan = planEdifice(CAMPUS);
    expect(plan.envelopes).toHaveLength(3 + 2);
    expect(plan.envelopes.filter((e) => e.kind === 'hall')).toHaveLength(2);
  });

  it('refuses a concourse between masses that do not face each other', () => {
    const bad = {
      masses: [
        { id: 'a', at: [0, 0], footprint: { w: 20, d: 20 }, floors: 1, facade: {} },
        { id: 'b', at: [0, 0], footprint: { w: 20, d: 20 }, floors: 1, facade: {} },   // overlapping
      ],
      concourses: [{ from: 'a', to: 'b', width: 8 }],
    };
    expect(() => planEdifice(bad)).toThrow(/overlap|facing/);
  });
});

describe('facing', () => {
  const A = { x0: 0, y0: 0, x1: 10, y1: 10 };
  it('detects east / west / north / south neighbours', () => {
    expect(facing(A, { x0: 15, y0: 0, x1: 25, y1: 10 }).aSide).toBe('E');
    expect(facing(A, { x0: -25, y0: 0, x1: -5, y1: 10 }).aSide).toBe('W');
    expect(facing(A, { x0: 0, y0: 15, x1: 10, y1: 25 }).aSide).toBe('N');
    expect(facing(A, { x0: 0, y0: -25, x1: 10, y1: -5 }).aSide).toBe('S');
  });
  it('returns null for fully overlapping masses', () => {
    expect(facing(A, { x0: 2, y0: 2, x1: 8, y1: 8 })).toBeNull();
  });
});

describe('buildEdificeFaces — doorway punch', () => {
  it('emits faces + roof textures for the whole edifice', () => {
    const plan = planEdifice(CAMPUS);
    const { faces, textures } = buildEdificeFaces(plan);
    expect(faces.length).toBeGreaterThan(100);
    expect(faces.every((f) => Array.isArray(f.corners) && typeof f.fill === 'string')).toBe(true);
    expect(Object.keys(textures).length).toBeGreaterThan(0);   // clay/shingle from the pitched roofs
  });

  it('leaves a real gap in the punched wall (no facade covers the doorway span at grade)', () => {
    // A one-mass edifice with a door punched into its south wall, vs. the same wall solid.
    const withDoor = planEdifice({
      masses: [
        { id: 'hall', at: [0, 0], footprint: { w: 40, d: 20 }, floors: 1, facade: { material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frame: '#333' }, roof: 'flat' },
        { id: 'shed', on: { anchor: 'hall', side: 'S', align: 'center', gap: 10 }, footprint: { w: 40, d: 16 }, floors: 1, facade: { material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frame: '#333' }, roof: 'flat' },
      ],
      concourses: [{ from: 'hall', to: 'shed', width: 10 }],
    });
    const hall = withDoor.masses.find((m) => m.id === 'hall');
    expect(hall.openings.some((o) => o.side === 'S')).toBe(true);
    // the door span is the middle ~10ft of the 40ft south wall at grade; assert no facade
    // facet sits low & centered inside it (the gap is real, walk-through).
    const { faces } = buildEdificeFaces(withDoor);
    const door = hall.openings.find((o) => o.side === 'S');
    const [dl, dr] = door.span;
    const lowCentered = faces.filter((f) =>
      f.corners.every((c) => Math.abs(c[1] - hall.y0) < 0.6 && c[2] < 8)      // on the south plane, below head height
      && f.corners.some((c) => c[0] > dl + 0.5 && c[0] < dr - 0.5));         // within the door span
    expect(lowCentered).toHaveLength(0);
  });
});

describe('buildEdificeFaces — suite interior kernel', () => {
  const oneMass = (kernel) => ({
    masses: [{ id: 'block', at: [0, 0], footprint: { w: 40, d: 48 }, floors: 1, facade: { material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frame: '#333' }, roof: 'flat', interior: { kernel } }],
  });

  it('a `suite` kernel adds interior room faces (more than a bare `open` shell)', () => {
    const open = buildEdificeFaces(planEdifice(oneMass('open'))).faces.length;
    const suite = buildEdificeFaces(planEdifice(oneMass('suite'))).faces.length;
    expect(suite).toBeGreaterThan(open);
  });

  it('the interior faces sit INSIDE the mass footprint (inset from the facade)', () => {
    const plan = planEdifice(oneMass('suite'));
    const openFaces = buildEdificeFaces(planEdifice(oneMass('open'))).faces.length;
    const all = buildEdificeFaces(plan).faces;
    const m = plan.masses[0];
    // the faces beyond the `open` baseline are the interior; all their corners fall within the footprint
    const interior = all.slice(openFaces);
    const withinFootprint = interior.every((f) => f.corners.every(([x, y]) => x >= m.x0 - 0.01 && x <= m.x1 + 0.01 && y >= m.y0 - 0.01 && y <= m.y1 + 0.01));
    expect(interior.length).toBeGreaterThan(0);
    expect(withinFootprint).toBe(true);
  });
});

describe('assessEdifice — advisory livability (daylight)', () => {
  it('reports daylight OK for a normal campus (open sides)', () => {
    expect(assessEdifice(planEdifice(CAMPUS)).livability.ok).toBe(true);
  });

  it('SURFACES a mass enclosed on all four sides as no-daylight', () => {
    const facade = { material: 'glass', glass: '#89a', frame: '#333' };
    const boxedIn = {
      masses: [
        { id: 'core', at: [0, 0], footprint: { w: 20, d: 20 }, floors: 1, facade },
        { id: 'n', on: { anchor: 'core', side: 'N', align: 'center', gap: 0 }, footprint: { w: 24, d: 16 }, floors: 1, facade },
        { id: 's', on: { anchor: 'core', side: 'S', align: 'center', gap: 0 }, footprint: { w: 24, d: 16 }, floors: 1, facade },
        { id: 'e', on: { anchor: 'core', side: 'E', align: 'center', gap: 0 }, footprint: { w: 16, d: 24 }, floors: 1, facade },
        { id: 'w', on: { anchor: 'core', side: 'W', align: 'center', gap: 0 }, footprint: { w: 16, d: 24 }, floors: 1, facade },
      ],
      entrance: 'core',
    };
    const { livability } = assessEdifice(planEdifice(boxedIn));
    expect(livability.ok).toBe(false);
    expect(livability.necessary.find((d) => d.id === 'core')).toMatchObject({ code: 'no-daylight' });
  });
});

describe('assessEdifice — advisory reachability', () => {
  it('reports all masses reachable for a connected campus', () => {
    const { reachability } = assessEdifice(planEdifice(CAMPUS));
    expect(reachability.ok).toBe(true);
    expect(reachability.necessary).toHaveLength(0);
  });

  it('SURFACES an unreachable mass but does not throw (advisory, not a gate)', () => {
    const disconnected = {
      ...CAMPUS,
      masses: [...CAMPUS.masses, { id: 'shed', on: { anchor: 'wing', side: 'E', align: 'center', gap: 8 }, footprint: { w: 20, d: 20 }, floors: 1, facade: { material: 'brick', glass: '#844', frame: '#633' }, roof: 'flat' }],
      // no concourse to 'shed' → unreachable, but the plan still builds
    };
    const plan = planEdifice(disconnected);
    const { reachability } = assessEdifice(plan);
    expect(reachability.ok).toBe(false);
    expect(reachability.necessary[0]).toMatchObject({ code: 'unreachable-mass', id: 'shed' });
    // the edifice still builds — advisory, never enforced
    expect(buildEdificeFaces(plan).faces.length).toBeGreaterThan(100);
  });
});
