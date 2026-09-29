// House design checks: walkways measured on the free floor (the upstairs hall a stair well splits), stair and door
// rules by tradition, the recipe's `design` naming them, and the opt-in repair that keeps a passage past the stair.
import { describe, expect, it } from 'vitest';
import { assessHouseDesign, designRules, validateDesign, DESIGN_RULES, stairEnds } from './floorplan-design.js';
import { structurizeHouse, storeyLevels, assembleHouseWorldScene } from './floorplan-structure.js';
import { assessHouseManifest } from './floorplan-bim.js';

const recipe = (extra = {}) => ({ kind: 'floorplan', storeys: 2, seed: 4, tier: 'house', ...extra });
const build = (m) => structurizeHouse({ ...m, ...storeyLevels(m) }, m);

describe('walkways on the free floor', () => {
  it('finds the upstairs hall a stair well splits: how wide, where, between what, cutting off which doors', () => {
    const d = build(recipe({ design: true })).design;
    expect(d.ok).toBe(false);
    const up = d.storeys.find((s) => s.index === 1);
    expect(up.pinches.length).toBeGreaterThan(0);
    const p = up.pinches[0];
    expect(p.widthFt).toBeLessThan(DESIGN_RULES['north-american'].passage);
    expect(p.between).toContain('the stair well');
    expect(p.cuts.some((c) => /door to the (bedroom|bathroom)/.test(c))).toBe(true);
    expect(d.findings[0]).toMatch(/^upstairs: \d+ in between .* the passage wants 36 in; beyond it: /);
    expect(d.storeys.find((s) => s.index === 0).ok).toBe(true);        // the ground floor walks
  });

  it('keeps a passage past the stair when asked to repair, on every seed and tier, two and three storeys', () => {
    for (const tier of ['cottage', 'house', 'villa']) for (const storeys of [2, 3]) for (let seed = 1; seed <= 6; seed++) {
      const d = build(recipe({ tier, storeys, seed, design: { repair: true } })).design;
      expect(d.findings, `${tier} ${storeys} storeys seed ${seed}`).toEqual([]);
    }
  });

  it('repairs without costing the upper floor its rooms: a straight flight where the U-return and a passage would', () => {
    const rooms = (h, i) => h.levels.find((l) => l.index === i).structure.cells.filter((c) => c.glyph !== 'H' && c.kind !== 'hall').map((c) => c.glyph).sort().join('');
    for (const tier of ['cottage', 'house', 'villa']) for (let seed = 1; seed <= 4; seed++) {
      const before = build(recipe({ tier, seed })), after = build(recipe({ tier, seed, design: { repair: true } }));
      expect(rooms(after, 1), `${tier} ${seed}`).toBe(rooms(before, 1));
    }
    expect(build(recipe({ tier: 'villa', design: { repair: true } })).stairs[0].switchback).toBe(true);
    expect(!!build(recipe({ tier: 'house', design: { repair: true } })).stairs[0].switchback).toBe(false);
    // an authored flight keeps its form
    expect(build(recipe({ tier: 'house', design: { repair: true }, stairs: [{ from: 0, to: 1, switchback: true }] })).stairs[0].switchback).toBe(true);
  });

  it('measures by the tradition, or by the recipe’s own numbers', () => {
    const jp = build(recipe({ design: { tradition: 'japanese' } })).design;
    expect(jp.rules.passageFt).toBeCloseTo(780 / 304.8, 3);
    expect(jp.findings[0]).toMatch(/mm between .* the passage wants 780 mm/);
    const loose = build(recipe({ design: { passage: 0.5 } })).design;
    expect(loose.storeys.every((s) => !s.pinches.length)).toBe(true);
    const tight = build(recipe({ design: { door: 3.5, stair: { riser: 0.5 } } })).design;
    expect(tight.findings.some((f) => /door .* clear, under 42 in/.test(f))).toBe(true);
    expect(tight.findings.some((f) => /risers 7 in, over 6 in/.test(f))).toBe(true);
    expect(designRules({ tradition: 'british' }).passage).toBeCloseTo(900 / 304.8, 6);
  });

  it('places each stair end outside its flight', () => {
    const h = build(recipe());
    for (const st of h.stairs) {
      const e = stairEnds(st);
      for (const p of [e.foot, e.head]) expect(p[0] < st.slot.x0 || p[0] > st.slot.x1 || p[1] < st.slot.y0 || p[1] > st.slot.y1).toBe(true);
      expect(e.width).toBeCloseTo(3.5, 6);
    }
  });

  it('is deterministic and quick', () => {
    const h = build(recipe());
    const t0 = performance.now();
    const a = assessHouseDesign(h, true), b = assessHouseDesign(h, true);
    expect((performance.now() - t0) / 2).toBeLessThan(250);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('the recipe', () => {
  it('leaves the house as it was unless it asks for the repair', () => {
    const m = recipe();
    const plain = JSON.stringify(assembleHouseWorldScene({ ...m, ...storeyLevels(m) }, m));
    const checked = JSON.stringify(assembleHouseWorldScene({ ...m, ...storeyLevels(m) }, { ...m, design: { tradition: 'british', passage: 4 } }));
    expect(checked).toBe(plain);
    const repaired = JSON.stringify(assembleHouseWorldScene({ ...m, ...storeyLevels(m) }, { ...m, design: { repair: true } }));
    expect(repaired).not.toBe(plain);
  });

  it('validates', () => {
    expect(validateDesign(true)).toEqual([]);
    expect(validateDesign({ tradition: 'north-american', passage: 3, stair: { width: 3 }, repair: true })).toEqual([]);
    expect(validateDesign({ tradition: 'martian' })[0]).toMatch(/design.tradition/);
    expect(validateDesign({ passage: -1 })[0]).toMatch(/design.passage/);
    expect(validateDesign({ stair: { riser: 'tall' } })[0]).toMatch(/design.stair.riser/);
    expect(validateDesign({ repair: 'yes' })[0]).toMatch(/design.repair/);
  });

  it('is read from a house recipe at mint (the framing names the tradition), and not from a single floor', () => {
    const d = assessHouseManifest(recipe({ framing: { system: 'kigumi' } }));
    expect(d.tradition).toBe('japanese');
    expect(d.ok).toBe(false);
    expect(assessHouseManifest(recipe({ design: { repair: true } })).ok).toBe(true);
    expect(assessHouseManifest({ kind: 'floorplan', seed: 3 })).toBeNull();
    expect(assessHouseManifest({ kind: 'workbench' })).toBeNull();
  });
});
