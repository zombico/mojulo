import { describe, expect, it } from 'vitest';

import { WORLD_TIERS, assessWorldTier, contractLedgerEntry, tierName } from './world-contract.js';

// A box room in FEET: floor, four walls, an optional ceiling; the walker stands in the middle.
const quad = (a, b, c, d, extra = {}) => ({ corners: [a, b, c, d], fill: '#8899aa', ...extra });
const room = ({ ceiling = false, normals = false, pane = false, w = 20, d = 24, h = 10 } = {}) => {
  const n = (v) => (normals ? { outNormal: v } : {});
  const faces = [
    quad([0, 0, 0], [w, 0, 0], [w, d, 0], [0, d, 0], n([0, 0, 1])),                 // floor
    quad([0, 0, 0], [w, 0, 0], [w, 0, h], [0, 0, h], n([0, -1, 0])),                // south
    quad([w, 0, 0], [w, d, 0], [w, d, h], [w, 0, h], n([1, 0, 0])),                 // east
    quad([w, d, 0], [0, d, 0], [0, d, h], [w, d, h], n([0, 1, 0])),                 // north
    quad([0, d, 0], [0, 0, 0], [0, 0, h], [0, d, h], n([-1, 0, 0])),                // west
    ...(ceiling ? [quad([0, 0, h], [w, 0, h], [w, d, h], [0, d, h], n([0, 0, -1]))] : []),
    ...(pane ? [quad([4, 0, 3], [8, 0, 3], [8, 0, 7], [4, 0, 7], { water: true, ...n([0, -1, 0]) })] : []),
  ];
  return { faces, walk: { eye: 5.3, spawn: [w / 2, d / 2] }, metersPerUnit: 0.3048 };
};
const pot = (x, y, z) => ({ name: `pot:${x}`, type: 'spot', position: [x, y, z], color: [1, 0.93, 0.82], intensity: 400, innerCone: 0.4, outerCone: 0.7 });

describe('WORLD_TIERS — the contract as data', () => {
  it('is monotonic and each tier names a gate and a witness', () => {
    expect(WORLD_TIERS.map((t) => t.id)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4']);
    for (const t of WORLD_TIERS) {
      expect(t.declares.length).toBeGreaterThan(0);
      expect(typeof t.gate).toBe('string');
      expect(typeof t.witness).toBe('string');
    }
    expect(tierName('T2')).toBe('transported');
    expect(tierName('T9')).toBeNull();
  });
});

describe('assessWorldTier — the ladder, read off a payload', () => {
  it('a bare room in feet with a walk seat and a floor declares T0 and names what T1 needs', () => {
    const a = assessWorldTier(room());
    expect(a.tier).toBe('T0');
    expect(a.next).toBe('T1');
    expect(a.missing.T0).toEqual([]);
    expect(a.missing.T1.map((m) => m.split(' — ')[0])).toEqual(['out_normals', 'lights']);
    expect(a.measured.floor_under_spawn).toBe(true);
    expect(a.measured.eye_m).toBeCloseTo(5.3 * 0.3048, 2);   // measured rounds to 3 decimals
    expect(a.advisories).toEqual([]);   // no ceiling: an open-top room is not enclosed
  });

  it('normals + KHR-shaped lights lift it to T1; positioned lights inside the room and a person-sized eye make T2', () => {
    const p = room({ normals: true });
    p.lights = [pot(10, 12, 9.6)];
    const a = assessWorldTier(p);
    expect(a.missing.T1).toEqual([]);
    expect(a.missing.T2).toEqual([]);
    expect(a.tier).toBe('T2');
    expect(a.next).toBe('T3');
    expect(a.missing.T3[0]).toMatch(/^material_identity — 0% of faces/);
  });

  it('T3 needs every face to name a material; T4 needs cones on every spot and declared units', () => {
    const p = room({ normals: true });
    p.lights = [pot(10, 12, 9.6)];
    for (const f of p.faces) f.pbr = [0, 0.85];
    expect(assessWorldTier(p).tier).toBe('T4');
    delete p.lights[0].outerCone;
    const a = assessWorldTier(p);
    expect(a.tier).toBe('T3');
    expect(a.missing.T4[0]).toMatch(/^lights_physical — 1 of 1/);
    const q = { ...p, lights: [pot(10, 12, 9.6)] };
    delete q.metersPerUnit;
    expect(assessWorldTier(q).missing.T4[0]).toMatch(/^units_declared/);
  });

  it('is monotonic: a T1 gap blocks T2 even when every T2 declaration is present', () => {
    const p = room({ normals: false });          // no outNormal ⇒ T1 open
    p.lights = [pot(10, 12, 9.6)];
    const a = assessWorldTier(p);
    expect(a.missing.T2).toEqual([]);
    expect(a.tier).toBe('T0');
    expect(a.next).toBe('T1');
  });

  it('the eye check is the 3.28× finding: feet read as metres put the walker at 5.3 m', () => {
    const p = room();
    delete p.metersPerUnit;
    const a = assessWorldTier(p);
    expect(a.measured.eye_m).toBe(5.3);
    expect(a.missing.T2.some((m) => m.startsWith('eye_plausible — walker eye 5.3 m'))).toBe(true);
    // declare the unit (feet) and the same seat is a person again
    expect(assessWorldTier(room()).missing.T2.some((m) => m.startsWith('eye_plausible'))).toBe(false);
  });

  it('a walkable kind with no walk seat is named at T0; a non-walkable payload is not asked for one', () => {
    const p = { faces: room().faces };
    expect(assessWorldTier(p, { walkable: true }).missing.T0[0]).toMatch(/^walk_seat — no walk seat/);
    expect(assessWorldTier(p, { walkable: false }).missing.T0).toEqual([]);
    expect(assessWorldTier(p).missing.T0).toEqual([]);   // default: walkable ⇔ the payload carries a seat
  });

  it('tolerates the other walk-seat spellings (eyeHeight/start, minEye) and a 3-D spawn', () => {
    const p = { faces: room().faces, walk: { enabled: true, eyeHeight: 1.4, start: [10, 12] } };
    expect(assessWorldTier(p).missing.T0).toEqual([]);
    const q = { faces: room().faces, walk: { minEye: 1.7, spawn: [10, 12, 0] } };
    expect(assessWorldTier(q).missing.T0).toEqual([]);
  });

  it('imports_dark: a ceiling over the spawn with no lights and no openings is advised, never refused', () => {
    const dark = assessWorldTier(room({ ceiling: true }));
    expect(dark.measured.ceiling_over_spawn).toBe(true);
    expect(dark.advisories).toEqual(['imports_dark']);
    expect(dark.tier).toBe('T0');                                                  // still a coherent world
    expect(assessWorldTier(room({ ceiling: true, pane: true })).advisories).toEqual([]);   // a pane is an opening
    const lit = room({ ceiling: true }); lit.lights = [pot(10, 12, 9.6)];
    expect(assessWorldTier(lit).advisories).toEqual([]);
    expect(assessWorldTier(room({ ceiling: false })).advisories).toEqual([]);      // open top: not enclosed
  });

  it('an empty payload sits below T0 and says so', () => {
    const a = assessWorldTier({});
    expect(a.tier).toBeNull();
    expect(a.next).toBe('T0');
    expect(a.missing.T0).toEqual(['faces — none']);
  });
});

describe('contractLedgerEntry — the row every pack carries', () => {
  it('reads as one honest line', () => {
    const e = contractLedgerEntry(assessWorldTier(room()));
    expect(e.tier).toBe('T0');
    expect(e.next).toBe('T1');
    expect(e.note).toMatch(/^declares T0 \(coherent\); for T1 \(baked\): out_normals — /);
    expect(e.advisories).toBeUndefined();
  });

  it('carries the advisory into the note', () => {
    const e = contractLedgerEntry(assessWorldTier(room({ ceiling: true })));
    expect(e.advisories).toEqual(['imports_dark']);
    expect(e.note).toMatch(/imports_dark: a ceiling over the spawn/);
  });

  it('at T4 says every declaration is present and leaves attainment to the gates', () => {
    const p = room({ normals: true }); p.lights = [pot(10, 12, 9.6)];
    for (const f of p.faces) f.pbr = [0, 0.85];
    const e = contractLedgerEntry(assessWorldTier(p));
    expect(e.tier).toBe('T4');
    expect(e.next).toBeNull();
    expect(e.note).toMatch(/attainment is each gate's to stamp/);
  });
});
