import { describe, it, expect } from 'vitest';
import { GROUND_UNITS, GROUND_UNIT_IDS, GROUNDFORCE_PALETTE, GROUNDFORCE_SCALE, UNIT_MATERIALS, unitFaces, unitFormFaces, unitFigure, unitRadius } from './index.js';

// THE GROUND FORCE (groundforce/): a sci-fi army's units as cards of a few big shapes, lit under one key, drawn larger than
// life for an arcade fighter going past. One procedure for every card: a unit's faces, its figure, its numbers.
const kind = GROUND_UNIT_IDS[0];

describe('the ground force', () => {
  it('is a card per unit, each with its numbers', () => {
    // (one card read: a new card runs through the same reader)
    const U = GROUND_UNITS[kind];
    expect(U.label).toBeTruthy();
    for (const n of ['size', 'hp', 'rof', 'range', 'points']) expect(U[n]).toBeGreaterThan(0);
    expect(() => unitFaces('mech')).toThrow(new RegExp(GROUND_UNIT_IDS.join(', ')));
  });

  it('stands on the ground, larger than life, its armour lit and its sensor and drive their own colour', () => {
    const F = unitFaces(kind), zs = F.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(-1e-9);
    const raw = GROUND_UNITS[kind].parts().flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.max(...zs)).toBeCloseTo(Math.max(...raw) * GROUNDFORCE_SCALE, 6);
    // (a sensor that looks out: lit faces keep their colour; the armour is shaded off its own)
    expect(F.some((f) => f.role === 'sensor' && f.fill === GROUNDFORCE_PALETTE.sensor)).toBe(true);
    expect(F.filter((f) => f.role === 'hull').every((f) => f.fill !== GROUNDFORCE_PALETTE.hull)).toBe(true);
    expect(unitRadius(kind)).toBeCloseTo(GROUND_UNITS[kind].size * GROUNDFORCE_SCALE, 2);
  });

  it('packs as a rig figure of one bone, the same card the same figure', () => {
    const fig = unitFigure(kind);
    expect(fig.rig).toBe(true);
    expect(fig.bones.map((b) => b.id)).toEqual(['root']);
    expect(fig.groundforce).toMatchObject({ kind, faces: unitFaces(kind).length });
    expect(JSON.stringify(unitFigure(kind))).toBe(JSON.stringify(fig));
  });
  it('in the form render: each face its role\'s metal and colour, its round parts shaded round and its edges kept', () => {
    // (a flier with fans and a ball, chosen in code: the first that flies)
    const k = GROUND_UNIT_IDS.find((u) => GROUND_UNITS[u].flies) ?? kind, F = unitFormFaces(k);
    for (const f of F) { expect(UNIT_MATERIALS[f.material]).toBeTruthy(); expect(f.albedo).toBe(GROUNDFORCE_PALETTE[f.material]); }
    // (some corners smoothed off their face's own normal, a box's corner never past the crease)
    const bent = F.flatMap((f) => f.cornerNormals.map((n) => n[0] * f.outNormal[0] + n[1] * f.outNormal[1] + n[2] * f.outNormal[2]));
    expect(bent.some((d) => d < 0.999)).toBe(true);
    expect(Math.min(...bent)).toBeGreaterThan(Math.cos((40 * Math.PI) / 180) - 1e-6);
    const fig = unitFigure(k, { form: true });
    expect(fig.form.materials).toBe(UNIT_MATERIALS);
    expect(unitFigure(k).form).toBeUndefined();
  });
});
