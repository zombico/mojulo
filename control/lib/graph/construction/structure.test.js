import { describe, it, expect, beforeAll } from 'vitest';
import { sectionProps, profile, sectionError, barMm } from './sections.js';
import { lowerFrame, validateFrames } from './frame.js';
import { ensureExactKernel } from '../polygonizer/field-exact.js';

const portal = {
  unit: 'cm', xray: true,
  members: [
    { id: 'pad', material: 'concrete', from: [-40, 0, -25], to: [40, 0, -25], stock: [80, 50] },
    { id: 'col-l', section: 'HEA200', from: [0, 0, 0], to: [0, 0, 400], up: [1, 0, 0], finish: 'primer' },
    { id: 'col-r', section: 'HEA200', from: [600, 0, 0], to: [600, 0, 400], up: [1, 0, 0] },
    { id: 'beam', section: 'IPE300', from: [0, 0, 380], to: [600, 0, 380] },
  ],
  joints: [{ type: 'base-plate', a: 'col-l', b: 'pad' }, { type: 'base-plate', a: 'col-r' }, { type: 'bolted', a: 'beam', b: 'col-l' }, { type: 'welded', a: 'beam', b: 'col-r' }],
};

describe('construction/sections — rolled steel by name', () => {
  it('computes properties within a few percent of the tables (fillets left out, so under)', () => {
    // AISC W8x31: A 9.13 in² (5890 mm²), Ix 110 in⁴ (45.8e6 mm⁴); W12x26: Ix 204 in⁴ (84.9e6); IPE300: Iy 8356 cm⁴
    const w8 = sectionProps('W8x31'), w12 = sectionProps('W12x26'), ipe = sectionProps('IPE300');
    for (const [got, table] of [[w8.A, 5890e-6], [w8.I, 45.8e-6], [w12.I, 84.9e-6], [ipe.I, 83.56e-6]]) {
      expect(got).toBeLessThanOrEqual(table);
      expect(got / table).toBeGreaterThan(0.95);
    }
    expect(w8.mass).toBeCloseTo(w8.A * 7850, 6);
    expect(profile('IPE300').outer).toHaveLength(12);
    expect(profile('SHS100x6').inner).toHaveLength(4);
    expect(sectionError('W99x1')).toMatch(/unknown section 'W99x1'/);
    expect(barMm('#5')).toBe(15.9); expect(barMm(16)).toBe(16); expect(barMm('huge')).toBeNull();
  });
});

describe('construction/frame — steel and reinforced concrete', () => {
  beforeAll(async () => { await ensureExactKernel(); });

  it('validates steel and concrete members', () => {
    const errs = validateFrames([{ members: [
      { id: 'a', section: 'W99', from: [0, 0, 0], to: [0, 0, 100] },
      { id: 'b', material: 'concrete', from: [0, 0, 0], to: [100, 0, 0], stock: [30, 50], rebar: { bottom: [3, 'huge'] } },
      { id: 'c', section: 'IPE200', from: [0, 0, 0], to: [100, 0, 0], finish: 'oil' },
    ] }]).join('\n');
    expect(errs).toMatch(/unknown section 'W99'/);
    expect(errs).toMatch(/rebar.bottom: \[count, bar\]/);
    expect(errs).toMatch(/a steel finish is one of mill, primer, galvanized, weathering, stainless/);
    expect(validateFrames([portal])).toEqual([]);
  });

  it('draws steel in its section and finish, bolts its plates, and reads it in the report', () => {
    const { faces, report } = lowerFrame(portal);
    const beam = report.members.find((m) => m.id === 'beam');
    expect(beam).toMatchObject({ material: 'steel', section: 'IPE300', grade: 'S355' });
    expect(faces.filter((f) => f.group === 'col-l').every((f) => !f.texture)).toBe(true);
    expect(report.pieces.map((p) => p.kind).sort()).toEqual(['base-plate', 'base-plate', 'end-plate']);
    expect(report.joints.find((j) => j.type === 'bolted')).toMatchObject({ bolts: 4, plateMm: [12, 170, 340], gripMm: 10 });
    const s = report.span.find((x) => x.member === 'beam');
    expect(s.material).toBe('steel'); expect(s.allowMPa).toBeCloseTo(0.6 * 355, 1);
  });

  it('cages concrete by default, shows it through xray, and checks its moment capacity', () => {
    const rc = { unit: 'cm', xray: true, load: 10, members: [
      { id: 'col-l', material: 'concrete', from: [0, 0, 0], to: [0, 0, 325], stock: [30, 30] },
      { id: 'col-r', material: 'concrete', from: [500, 0, 0], to: [500, 0, 325], stock: [30, 30] },
      { id: 'beam', material: 'concrete', from: [-15, 0, 325], to: [515, 0, 325], stock: [30, 50], rebar: { bottom: [4, 20], top: [2, 12], ties: [10, 150] } },
      { id: 'plain', material: 'concrete', from: [0, 100, 0], to: [100, 100, 0], stock: [20, 20], rebar: false },
    ], joints: [{ type: 'welded', a: 'col-l', b: 'beam' }, { type: 'welded', a: 'col-r', b: 'beam' }] };   // the columns run up into the beam
    const { faces, report } = lowerFrame(rc);
    const col = report.members.find((m) => m.id === 'col-l');
    expect(col.rebar.bars).toBe(4);                              // a 300 mm column: a ring of four
    const beam = report.members.find((m) => m.id === 'beam');
    expect(beam.rebar).toMatchObject({ bars: 6, AsMm2: Math.round(4 * Math.PI * 100), coverMm: 40 });
    expect(report.members.find((m) => m.id === 'plain').rebar).toBeNull();
    expect(faces.filter((f) => f.group === 'beam').every((f) => f.alpha === 0.28)).toBe(true);
    expect(faces.some((f) => f.group === 'beam:rebar')).toBe(true);
    const s = report.span.find((x) => x.member === 'beam');
    expect(s.capacityKNm).toBeGreaterThan(s.momentKNm);
  });
});
