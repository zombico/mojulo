// Livability around a stair. The laws: absent `design.clearance`, the house is built as it always was; with it,
// no piece in the stair's room stands within it of the flight, landing or well; every stack is walked whether or not
// the recipe asked; a check the operator waives is recorded as waived, not dropped; and the book says how to change it.

import { describe, it, expect } from 'vitest';
import { structurizeHouse, FLOORPLAN_DEFAULTS } from '../polygonizer/floorplan-structure.js';
import { validateDesign, designRules } from '../polygonizer/floorplan-design.js';
import { readStructure } from './read.js';
import { checkRows, stairCrowding } from './tables.js';
import { structureBookHtml } from './book-html.js';

const HOUSE = { kind: 'floorplan', seed: 7, levels: [{ index: 0 }, { index: 1 }], stairs: true, roof: { style: 'hip' }, windows: true, furnish: true, style: 'auto', layout: 'varied', furnishing: 'composed' };
const faces = (m) => JSON.stringify(structurizeHouse(m, { ...FLOORPLAN_DEFAULTS, ...m, view: 'cutaway', walk: false }).faces);

describe('design.clearance and design.waive', () => {
  it('are validated: true, false or feet; a list of checks', () => {
    expect(validateDesign({ clearance: true, waive: ['stair-clearance', 'walkway:upstairs'] })).toEqual([]);
    expect(validateDesign({ clearance: 2.5 })).toEqual([]);
    expect(validateDesign({ clearance: -1 })).toHaveLength(1);
    expect(validateDesign({ waive: 'all' })).toHaveLength(1);
  });

  it('clearance: true is the passage; a number is the operator\'s; absent is none', () => {
    expect(designRules({ clearance: true }).clearance).toBeCloseTo(3, 6);
    expect(designRules({ clearance: true, passage: 4 }).clearance).toBe(4);
    expect(designRules({ clearance: 2 }).clearance).toBe(2);
    expect(designRules({}).clearance).toBe(0);
    expect(designRules({ tradition: 'japanese', clearance: true }).clearance).toBeCloseTo(780 / 304.8, 6);
  });

  it('absent, the house is built byte for byte as before (the walk report reads the floor, never changes it)', () => {
    expect(faces({ ...HOUSE, design: {} })).toBe(faces(HOUSE));
    expect(faces({ ...HOUSE, design: { clearance: false } })).toBe(faces(HOUSE));
  });
});

describe('the stair-clearance check', () => {
  const asIs = readStructure(HOUSE);
  const passed = readStructure({ ...HOUSE, design: { repair: true, clearance: true } });

  it('finds the furniture in the stair\'s room that crowds it, and none behind a wall', () => {
    const c = stairCrowding(asIs);
    expect(c.length).toBeGreaterThan(0);
    for (const x of c) {
      expect(x.gapFt).toBeLessThan(x.wantFt);
      const room = asIs.rooms.find((r) => r.tag === x.room);
      const st = asIs.elements.stairs[0];
      const overlaps = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
      expect(overlaps(room.rect, st.slot), `${x.room} holds the stair`).toBe(true);
    }
  });

  it('with clearance, nothing in the stair\'s room stands within it; the walkways connect', () => {
    expect(stairCrowding(passed)).toEqual([]);
    const rows = checkRows(passed).filter((r) => r.source === 'livability' || r.source === 'design');
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it('walks every stack, whether or not the recipe carries design', () => {
    expect(asIs.design).toBeTruthy();
    expect(checkRows(asIs).some((r) => r.rule === 'walkway')).toBe(true);
    expect(readStructure({ kind: 'floorplan', seed: 3 }).design).toBeUndefined();
  });
});

describe('waivers and overrides', () => {
  it('a waived check stays in the list, marked waived; a rule alone waives all of it', () => {
    const one = readStructure({ ...HOUSE, design: { waive: ['stair-clearance:101'] } });
    const rows = checkRows(one).filter((r) => r.rule === 'stair-clearance');
    expect(rows.filter((r) => r.subject === '101').every((r) => r.waived)).toBe(true);
    expect(rows.filter((r) => r.subject !== '101' && r.ok === false).every((r) => !r.waived)).toBe(true);
    const all = readStructure({ ...HOUSE, design: { waive: ['stair-clearance', 'walkway'] } });
    expect(checkRows(all).filter((r) => (r.rule === 'stair-clearance' || r.rule === 'walkway') && r.ok === false).every((r) => r.waived)).toBe(true);
  });

  it('the operator\'s clearance is the one measured against', () => {
    const tight = readStructure({ ...HOUSE, design: { clearance: 1 } });
    for (const c of stairCrowding(tight)) expect(c.wantFt).toBe(1);
  });

  it('the book shows the rules in force, the waived pill, and how to change them', () => {
    const html = structureBookHtml({ ...HOUSE, design: { waive: ['stair-clearance'] } }, { ref: 'sk_l' });
    expect(html).toContain('id="livability"');
    expect(html).toContain('class="pill waived"');
    expect(html).toContain('clearance: true');
    expect(html).toMatch(/waive: \['stair-clearance:101'\]/);
  });
});
