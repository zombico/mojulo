import { describe, it, expect } from 'vitest';
import { planTrack } from './track.js';
import { ITEMS, ITEM_BOXES, readItems, itemRows, itemTable, itemState, kartItemsStep } from './kart-items.js';
import { composeTrack } from './trackscape-compose.js';
import { driveSurfaceTable } from './surface.js';
import { raceHud } from '../gameworld/race-hud.js';
import { iconOf, ICON_MEANING } from '../../mana-ui/icons.js';

const plan = planTrack({ form: 'circuit', course: { class: 'kart', length: 420, twist: 0.5, seed: 1 }, items: true });

describe('the item boxes on a kart track', () => {
  it('stand in rows across the way on its straights, never on the grid, and are the same each time', () => {
    const rows = itemRows(plan, plan.items), a = plan.alignment, L = a.length;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.s).toBeGreaterThanOrEqual(ITEM_BOXES.clear);
      expect(r.s).toBeLessThanOrEqual(L - ITEM_BOXES.clear);
      expect(Math.abs(a.at(r.s).k)).toBeLessThan(1 / 300);
      expect(r.boxes).toHaveLength(ITEM_BOXES.across);
      const q = a.at(r.s);
      for (const b of r.boxes) expect(Math.hypot(b[0] - q.x, b[1] - q.y)).toBeLessThan(plan.X.road);
    }
    expect(JSON.stringify(itemRows(plan, plan.items))).toBe(JSON.stringify(rows));
    // (the drive surface carries them to the page; a track without items carries none)
    expect(driveSurfaceTable(plan).items.boxes).toHaveLength(rows.length * ITEM_BOXES.across);
    expect(driveSurfaceTable(planTrack({ form: 'circuit', course: { class: 'kart', length: 420, twist: 0.5, seed: 1 } })).items).toBeUndefined();
  });
  it('are read as true, false or their settings, and an unknown setting or item is refused', () => {
    expect(readItems(true)).toEqual({});
    expect(readItems(false)).toBe(null);
    expect(() => readItems({ often: 2 })).toThrow(/not an item setting/);
    expect(() => readItems({ odds: { banana: 1 } })).toThrow(/not an item/);
  });
  it('come with a kart track from words, not with a circuit', () => {
    expect(composeTrack('a kart track in green hills', { seed: 2 }).items).toBe(true);
    expect(composeTrack('a GT circuit', { seed: 2 }).items).toBeUndefined();
  });
});

describe('what the boxes hand out', () => {
  const T = { ...itemTable(plan, {}), boxes: [[0, 10, 1]] };
  const kart = (id, y, o = {}) => ({ id, pos: [0, y, 0.3], heading: Math.PI / 2, speed: 15, use: false, ai: false, ...o });
  it('a kart through a box takes one item and the box pops, back after its time; a kart holding one takes no second', () => {
    const S = itemState(T, 3);
    let fx = kartItemsStep(S, [kart('a', 10)], 1 / 60);
    expect(fx.find((f) => f.took)).toBeTruthy();
    const held = S.held.a;
    expect(Object.keys(ITEMS)).toContain(held);
    expect(S.box[0]).toBeCloseTo(T.back, 6);
    for (let t = 0; t < T.back + 0.1; t += 0.05) kartItemsStep(S, [], 0.05);
    expect(S.box[0]).toBe(0);
    fx = kartItemsStep(S, [kart('a', 10)], 1 / 60);
    expect(fx.some((f) => f.took)).toBe(false);
    expect(S.held.a).toBe(held);
  });
  it('the same dice hand out the same items', () => {
    const run = () => { const S = itemState({ ...T, back: 0.01 }, 9), got = []; for (let i = 0; i < 12; i++) { delete S.held.a; kartItemsStep(S, [kart('a', 10)], 0.05); got.push(S.held.a); kartItemsStep(S, [], 0.05); } return got; };
    expect(run()).toEqual(run());
    expect(new Set(run()).size).toBeGreaterThan(1);
  });
  it('a sugar rush is a boost the moment it is used', () => {
    const S = itemState(T, 1); S.held.a = 'sugar-rush';
    const fx = kartItemsStep(S, [kart('a', 0, { use: true })], 1 / 60);
    expect(fx.find((f) => f.id === 'a' && f.boost === ITEMS['sugar-rush'].seconds)).toBeTruthy();
    expect(S.held.a).toBeUndefined();
  });
  it('a toffee is dropped behind and slows the kart that drives over it', () => {
    const S = itemState(T, 1); S.held.a = 'toffee';
    kartItemsStep(S, [kart('a', 0, { use: true })], 1 / 60);
    expect(S.traps).toHaveLength(1);
    expect(S.traps[0].at[1]).toBeLessThan(0);
    for (let i = 0; i < 40; i++) kartItemsStep(S, [kart('a', 30)], 1 / 60);
    const fx = kartItemsStep(S, [kart('a', 30), kart('b', S.traps[0].at[1])], 1 / 60);
    expect(fx.find((f) => f.id === 'b' && f.slow === ITEMS.toffee.slow && f.spin > 0)).toBeTruthy();
    expect(S.traps).toHaveLength(0);
  });
  it('a gumball rolls ahead and knocks the first kart it meets', () => {
    const S = itemState(T, 1); S.held.a = 'gumball';
    let hitB = null;
    for (let i = 0; i < 200 && !hitB; i++) { const fx = kartItemsStep(S, [kart('a', 0, { use: i === 0, speed: 0 }), kart('b', 25, { speed: 0 })], 1 / 60); hitB = fx.find((f) => f.id === 'b' && f.slow) ?? null; }
    expect(hitB).toBeTruthy();
    expect(S.shots).toHaveLength(0);
  });
  it('a rival uses what it holds without a press: a boost at once, a gumball when a kart is ahead', () => {
    const S = itemState(T, 1); S.held.r = 'sugar-rush';
    let fx = []; for (let i = 0; i < 60 && !fx.some((f) => f.boost); i++) fx = kartItemsStep(S, [kart('r', 0, { ai: true })], 1 / 30);
    expect(fx.some((f) => f.id === 'r' && f.boost)).toBe(true);
    S.held.r = 'gumball';
    kartItemsStep(S, [kart('r', 0, { ai: true }), kart('a', 15)], 1 / 30);
    expect(S.shots).toHaveLength(1);
  });
});

describe('catch-up: what a box hands out by where the kart stands', () => {
  // (a straight line of points the field is ranked on, a box under each of two karts far apart)
  const line = Array.from({ length: 60 }, (_, j) => [0, j * 2, Math.PI / 2, 0]).flat();
  const T0 = itemTable(plan, {}), T = { ...T0, line, back: 0.001, boxes: [[0, 90, 0.3], [0, 12, 0.3]] };
  const kart = (id, y) => ({ id, pos: [0, y, 0.3], heading: Math.PI / 2, speed: 15, use: false, ai: false });
  const draws = (table, runs = 300) => {
    const S = itemState(table, 5), got = { lead: {}, last: {} };
    for (let i = 0; i < runs; i++) {
      S.held = {}; S.box = S.box.map(() => 0);
      kartItemsStep(S, [kart('lead', 90), kart('last', 12)], 0.01);
      for (const id of ['lead', 'last']) got[id][S.held[id]] = (got[id][S.held[id]] || 0) + 1;
    }
    return got;
  };
  it('the last is handed sugar rushes far more often than the leader, the leader the toffee', () => {
    const got = draws(T);
    expect((got.last['sugar-rush'] || 0)).toBeGreaterThan(3 * (got.lead['sugar-rush'] || 0));
    expect((got.lead.toffee || 0)).toBeGreaterThan(3 * (got.last.toffee || 0));
  });
  it('without catch-up, the two draw alike', () => {
    const flat = { ...itemTable(plan, { catchup: false }), line, back: 0.001, boxes: T.boxes }, got = draws(flat);
    const share = (g) => (g['sugar-rush'] || 0) / 300;
    expect(Math.abs(share(got.last) - share(got.lead))).toBeLessThan(0.12);
  });
  it('is read as its settings, and a bad one refused', () => {
    expect(readItems({ catchup: false })).toEqual({ catchup: false });
    expect(() => readItems({ catchup: { 'sugar-rush': [1] } })).toThrow(/leader's scale/);
  });
});

describe('the race HUD shows the item held', () => {
  it('each item is drawn by a pictogram of the game UI\'s, by its own icon or its name, none two alike', () => {
    const drawn = Object.entries(ITEMS).map(([id, I]) => { expect(iconOf(I.icon)).toBe(I.icon); expect(iconOf(id)).toBe(I.icon); return I.icon; });
    expect(new Set(drawn).size).toBe(drawn.length);
    // (in a theme that tones its icons by meaning, the items take the accents or the ink: never the harm's, on a berry plate)
    for (const id of drawn) expect(['accent', 'accent2', undefined]).toContain(ICON_MEANING[id]);
  });
  it('a race with items has its slot and its feed says so; one without, neither', () => {
    const on = raceHud({ mech: 0, laps: 3, racers: 4, items: true }), off = raceHud({ mech: 0, laps: 3, racers: 4 });
    // (one large slot, its pictogram the held item's, no words)
    expect(JSON.stringify(on.spec)).toContain('{"use":"slot","props":{"name":{"bind":"race.itemIcon"},"key":"F","size":"l","active":{"bind":"race.hasItem"}}}');
    expect(JSON.stringify(on.spec)).not.toContain('race.itemSays');
    expect(on.feed.items).toBe(true);
    expect(JSON.stringify(off.spec)).not.toContain('race.itemIcon');
    expect(off.feed.items).toBeUndefined();
  });
});
