import { describe, it, expect } from 'vitest';
import { fabricationPlan, needsError } from './plan.js';
import { withPlacement, PLACE_BEGIN, PLACE_END } from './place.js';

// A lid on a base: four heat-set joints on the mating plane z = 20, the bolts running down.
const LID = { id: 'lid', function: 'fasten', tags: ['serviceable'], count: 4, at: [[5, 5, 20], [35, 5, 20], [5, 35, 20], [35, 35, 20]], parts: { into: 'base', head: 'lid' } };

describe('fabricator placement', () => {
  it('a two-part joint: the pilot at the mating plane, the counterbore its depth back in the head part', () => {
    const { placement } = fabricationPlan({ needs: [LID] });
    const lines = placement.block.split('\n');
    expect(lines[0]).toBe(PLACE_BEGIN);
    expect(lines.at(-1)).toBe(PLACE_END);
    expect(placement.block).toContain('  if (part == "base") {\n    translate([5, 5, 20]) mj_heatset_hole("M3", 8);');
    expect(placement.block).toContain('  if (part == "lid") {\n    translate([5, 5, 30]) mj_counterbore("M3", 10);');
    expect(placement.placed).toEqual([{ need: 'lid', call: 'mj_heatset_hole("M3", 8)', part: 'base', n: 4 }, { need: 'lid', call: 'mj_counterbore("M3", 10)', part: 'lid', n: 4 }]);
    expect(placement.manual).toEqual([]);
  });

  it('each point may turn its own way, a pin pair flips into the other part, magnets go one each side', () => {
    const { placement } = fabricationPlan({ needs: [
      { id: 'axle', function: 'spin', shaftD: 8, part: 'housing', at: [{ at: [20, 0, 10], axis: 'y+' }, { at: [20, 40, 10], axis: 'y-' }] },
      { id: 'pins', function: 'locate', tags: ['precise'], at: [[0, 0, 0], [30, 0, 0]], parts: { into: 'a', head: 'b' } },
      { id: 'shut', function: 'catch', at: [[10, 10, 0]], axis: 'x+', parts: { into: 'door', head: 'frame' } },
    ] });
    expect(placement.block).toContain('translate([20, 0, 10]) rotate([90, 0, 0]) mj_bearing_seat("688");');
    expect(placement.block).toContain('translate([20, 40, 10]) rotate([-90, 0, 0]) mj_bearing_seat("688");');
    expect(placement.block).toMatch(/part == "a"[^}]*translate\(\[0, 0, 0\]\) mj_hole\(3, 9, "press"\)/);
    expect(placement.block).toMatch(/part == "b"[^}]*translate\(\[0, 0, 0\]\) rotate\(\[180, 0, 0\]\) mj_hole\(3, 9, "slip"\)/);
    expect(placement.block).toMatch(/part == "door"[^}]*rotate\(\[0, -90, 0\]\) mj_hole\(6, 3, "press"\)/);
    expect(placement.block).toMatch(/part == "frame"[^}]*rotate\(\[0, 90, 0\]\) mj_hole\(6, 3, "press"\)/);
  });

  it('what it cannot place is said, never guessed', () => {
    const { placement } = fabricationPlan({ needs: [
      { ...LID, at: LID.at.slice(0, 3) },
      { id: 'nut', function: 'fasten', at: [[0, 0, 0]], part: 'base' },
      { id: 'gland', function: 'seal', through: 'cable', part: 'base' },
      { id: 'one-side', function: 'fasten', tags: ['serviceable'], at: [[0, 0, 0]], part: 'base' },
    ] });
    const why = Object.fromEntries(placement.manual.map((m) => [`${m.need} ${m.call.replace(/\(.*/, '')}`, m.why]));
    expect(why['lid mj_heatset_hole']).toMatch(/needs 4 `at` points, the need gives 3/);
    expect(why['nut mj_nut_trap']).toMatch(/placed by hand/);
    expect(why['gland mj_hole']).toMatch(/no `at` points/);
    expect(why['one-side mj_counterbore']).toMatch(/name the part for its head side/);
    expect(placement.placed).toEqual([{ need: 'one-side', call: 'mj_heatset_hole("M3", 8)', part: 'base', n: 1 }]);
    expect(fabricationPlan({ needs: [{ function: 'fasten' }] }).placement).toBeUndefined();
  });

  it('bad placement fields are taught with the needs', () => {
    expect(needsError([{ function: 'fasten', at: [[0, 0]] }])).toMatch(/at\[0\] must be \[x, y, z\]/);
    expect(needsError([{ function: 'fasten', at: [[0, 0, 0]], axis: 'up' }])).toMatch(/axis` must be one of z-/);
    expect(needsError([{ function: 'fasten', parts: ['a'] }])).toMatch(/parts must be/);
  });

  it('the block is written in where the source calls it, replaced on a re-plan, and taken out when no longer called', () => {
    const { placement } = fabricationPlan({ needs: [LID] });
    const src = 'difference() { cube([40, 40, 20]); fab_cuts("base"); }';
    const once = withPlacement(src, placement);
    expect(once).toMatchObject({ written: true, called: true });
    expect(once.source.startsWith(PLACE_BEGIN)).toBe(true);
    expect(once.source.endsWith(src)).toBe(true);
    const moved = fabricationPlan({ needs: [{ ...LID, at: LID.at.map(([x, y]) => [x + 1, y, 20]) }] }).placement;
    const twice = withPlacement(once.source, moved).source;
    expect(twice.split(PLACE_BEGIN)).toHaveLength(2);
    expect(twice).toContain('translate([6, 5, 20])');
    expect(twice).not.toContain('translate([5, 5, 20])');
    expect(withPlacement('cube(1);', placement)).toEqual({ source: 'cube(1);', written: false, called: false });
    expect(withPlacement(once.source.replace(src, 'cube(1);'), placement).source).toBe('cube(1);');
  });
});
