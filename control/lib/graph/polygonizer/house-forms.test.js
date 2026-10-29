// House forms (house-forms.js): a townhouse and a modern block plan every storey as each is lived in. The stair stands
// in its hall on every floor; the floors carry their program; a townhouse's party walls are blind and an end unit's
// open side lit; the window laws hold; a footprint that cannot hold the form is refused, naming the size it needs; the
// draw gives a form its own storeys and footprint.
import { describe, expect, it } from 'vitest';
import { readForm, partyWallsOf, formErrors, stairWidthOf, FORM_FOOTPRINT, FORM_MAX_RISE } from './house-forms.js';
import { structurizeHouse } from './floorplan-structure.js';
import { drawNewHouse } from './floorplan-draw.js';

const LEVELS = [{ role: 'ground' }, { role: 'second' }, { role: 'third' }];
const build = (extra) => { const m = { kind: 'floorplan', seed: 5, levels: LEVELS, stairs: true, windows: true, houseLook: 2, ...extra }; return structurizeHouse(m, { ...m, view: 'cutaway' }); };
const windowsOn = (L, side) => {
  const fp = L.structure.wallGraph.footprint, at = { W: fp.x0, E: fp.x1 }[side];
  return L.structure.wallGraph.runs.filter((r) => !r.interior && r.orientation === 'v' && Math.abs(r.at - at) < 0.75).flatMap((r) => (r.openings || []).filter((o) => o.sill > 0.01));
};

describe('the form', () => {
  it('read and refused by name; a townhouse\'s party walls, both by default', () => {
    expect(readForm({})).toBe('detached');
    expect(() => readForm({ form: 'castle' })).toThrow(/form: one of detached, block, townhouse/);
    expect(() => readForm({ form: 'block', attached: 'left' })).toThrow(/attached: a townhouse's/);
    expect(partyWallsOf({ form: 'townhouse' })).toEqual(['W', 'E']);
    expect(partyWallsOf({ form: 'townhouse', attached: 'left' })).toEqual(['W']);
    expect(partyWallsOf({ form: 'block' })).toEqual([]);
    // (a footprint that cannot hold the form says the size it needs)
    expect(formErrors('townhouse', { width: 18, height: 48, rise: FORM_MAX_RISE })[0]).toMatch(/at least 21 ft wide/);
    expect(formErrors('block', { width: 36, height: 20, rise: FORM_MAX_RISE })[0]).toMatch(/ft deep cannot hold its stair/);
    for (const form of ['townhouse', 'block']) expect(formErrors(form, { ...FORM_FOOTPRINT[form], rise: FORM_MAX_RISE })).toEqual([]);
  });
});

describe('a townhouse and a block, planned storey by storey', () => {
  for (const [form, style] of [['townhouse', 'brick'], ['block', 'tofu']]) {
    it(`a ${form}: the stair inside on every floor, each floor its program, the window laws held`, () => {
      const H = build({ form, style }), fp = H.footprint;
      expect(H.stairs.length).toBe(2);
      for (const st of H.stairs) expect(st.slot.x0 >= fp.x0 && st.slot.x1 <= fp.x1 && st.slot.y0 >= fp.y0 && st.slot.y1 <= fp.y1).toBe(true);
      const glyphs = H.levels.map((L) => L.structure.plan.rooms.map((r) => r.glyph).join(''));
      expect(glyphs[0]).toMatch(/K/);
      expect(glyphs[0]).toMatch(/L|D/);
      for (const g of glyphs.slice(1)) expect([g.includes('B'), g.includes('W')]).toEqual([true, true]);
      for (const law of H.windows.laws) expect(law.ok, `${law.id}: ${law.says}`).toBe(true);
    });
  }

  it('a wide flight keeps to the hall kept for it: the zone is as wide as the widest flight asked for', () => {
    const wide = [{ from: 0, to: 1, width: 5 }, { from: 1, to: 2, width: 5 }];
    expect(stairWidthOf(wide)).toBe(5);
    expect(stairWidthOf(true)).toBe(stairWidthOf([{ width: 2 }]));
    for (const form of ['townhouse', 'block']) {
      const H = build({ form, stairs: wide }), fp = H.footprint;
      for (const st of H.stairs) {
        expect(st.slot.x0 >= fp.x0 && st.slot.x1 <= fp.x1 && st.slot.y0 >= fp.y0 && st.slot.y1 <= fp.y1, `${form}: the flight inside the house`).toBe(true);
        // (no room's floor under the flight: it stands in the hall)
        const rooms = H.levels.find((L) => L.index === st.fromIndex)?.structure.plan.rooms ?? [];
        const over = rooms.filter((r) => r.glyph !== 'H' && st.slot.x0 < r.x + r.w - 0.05 && st.slot.x1 > r.x + 0.05 && st.slot.y0 < r.y + r.h - 0.05 && st.slot.y1 > r.y + 0.05);
        expect(over.map((r) => r.glyph), `${form}: rooms under the flight`).toEqual([]);
      }
    }
    // (and the footprint it needs grows with it, refused by name at mint)
    expect(formErrors('townhouse', { width: 21, height: 48, rise: FORM_MAX_RISE })).toEqual([]);
    expect(formErrors('townhouse', { width: 21, height: 48, rise: FORM_MAX_RISE, stairWidth: 6 })[0]).toMatch(/ft wide/);
  });

  it('a mid-terrace townhouse\'s party walls take no window; an end unit\'s open side is lit', () => {
    const mid = build({ form: 'townhouse' }), end = build({ form: 'townhouse', attached: 'left' });
    for (const L of mid.levels) expect([windowsOn(L, 'W').length, windowsOn(L, 'E').length]).toEqual([0, 0]);
    expect(end.levels.every((L) => windowsOn(L, 'W').length === 0)).toBe(true);
    expect(end.levels.some((L) => windowsOn(L, 'E').length > 0)).toBe(true);
  });
});

describe('the draw', () => {
  it('a form draws its own storeys and footprint and plans its own front door; a detached house draws as it did', () => {
    const t = drawNewHouse({ kind: 'floorplan', seed: 7, form: 'townhouse' });
    expect(t.levels.length).toBeGreaterThanOrEqual(3);
    expect(t.width).toBeLessThan(30);
    expect(t.height).toBeGreaterThan(t.width);
    expect([t.stairs, t.entryDoor, t.tier]).toEqual([true, undefined, undefined]);
    const b = drawNewHouse({ kind: 'floorplan', seed: 7, form: 'block' });
    expect(b.levels.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(b.width - b.height)).toBeLessThan(8);
    expect(drawNewHouse({ kind: 'floorplan', seed: 7 }).tier).toBeDefined();
  });
});
