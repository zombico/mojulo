// The solver: a historic town laid from its form, one case per procedure (a street pattern, an armature, an enclosure,
// a water, a scene), each culture chosen in code from the forms that use it, never a hand list.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { solveHistoric, SCENES, SLICE, sliceFoci, formOf } from './index.js';
import { FORMS } from '../form/towns.js';
import { STREET_PATTERNS, ARMATURES, readForm } from '../form/schema.js';
import { MONUMENTS } from '../monuments/index.js';
import { HISTORIC_CULTURES } from '../cultures/index.js';

const hash = (x) => createHash('sha256').update(JSON.stringify(x, (k, v) => (typeof v === 'function' ? undefined : v))).digest('hex');
const using = (test) => Object.keys(FORMS).find((id) => test(FORMS[id]));
const law = (p, id) => p.laws.find((l) => l.id === id);
const cells = (p, code) => { let n = 0; for (const v of p.grid.data) if (v === p.grid.codes[code]) n++; return n; };
const houses = (p) => new Set(p.form.houses.map((h) => h.asset));

describe('the solver', () => {
  const id = Object.keys(FORMS)[0], p = solveHistoric({ culture: id, seed: 7 });
  it('is deterministic, and a different seed is a different town', () => {
    expect(hash(solveHistoric({ culture: id, seed: 7 }))).toBe(hash(p));
    expect(hash(solveHistoric({ culture: id, seed: 8 }))).not.toBe(hash(p));
  });
  it('rolls each layer on its own dice: a change to the lots never moves a street', () => {
    const q = solveHistoric({ culture: id, seed: 7, form: { density: { lot: [p.form.density.lot[0] + 2, p.form.density.lot[1] + 3] } } });
    const lanes = (x) => x.grid.data.map((v) => (v === x.grid.codes.LANE ? 1 : 0)).join('');
    expect(lanes(q)).toBe(lanes(p));
    expect(q.stats.houses).not.toBe(p.stats.houses);
  });
  it('returns the plan every emitter reads, and what the field guide reads', () => {
    for (const k of ['boxes', 'grounds', 'slots', 'views', 'frame', 'stats', 'grid', 'hAt', 'form', 'ledger', 'laws', 'notes']) expect(p, k).toHaveProperty(k);
    expect(p.stats.precinct).toBeTruthy();
    expect(p.laws.map((l) => l.id)).toEqual(['fronts', 'connected', 'monument-fits']);
  });
  it('houses keep to their lots: off the lanes, the water and the precinct, apart from their neighbours', () => {
    const H = houses(p), { cols, cell, data, codes } = p.grid;
    for (const q of p.slots.filter((s) => H.has(s.asset))) {
      const [x, y] = [q.rect.x + q.rect.w / 2, q.rect.y + q.rect.d / 2];
      expect(data[Math.floor(y / cell) * cols + Math.floor(x / cell)]).toBe(codes.HOUSE);
    }
  });
});

describe('the street patterns', () => {
  for (const pattern of STREET_PATTERNS) {
    const id = using((f) => f.streets.pattern === pattern);
    it(`${pattern} (${id}): one network of lanes, every house on one`, () => {
      const p = solveHistoric({ culture: id });
      expect(cells(p, 'LANE')).toBeGreaterThan(50);
      expect(law(p, 'fronts').ok, law(p, 'fronts').detail).toBe(true);
      expect(p.stats.houses).toBeGreaterThan(20);
    });
  }
  it('a form may lay another pattern over the same town', () => {
    const id = using((f) => f.streets.pattern === 'meander');
    const p = solveHistoric({ culture: id, form: { streets: { pattern: 'grid', block: [30, 30] } } });
    expect(p.form.streets.pattern).toBe('grid');
    expect(law(p, 'fronts').ok).toBe(true);
  });
});

describe('the armatures: the monument seated', () => {
  for (const kind of ARMATURES) {
    const id = using((f) => f.armature.kind === kind);
    it(`${kind} (${id}): the monument stands whole at its real size, the town organised round it`, () => {
      const p = solveHistoric({ culture: id }), m = p.stats.monuments[0], M = MONUMENTS[m.id];
      expect(law(p, 'monument-fits').ok).toBe(true);
      expect([m.rect.w, m.rect.d].sort((a, b) => a - b)).toEqual([...M.size].sort((a, b) => a - b));
      expect(p.slots.some((s) => s.monument === m.id) || (p.repeats || []).length > 0).toBe(true);
      const c = [m.rect.x + m.rect.w / 2, m.rect.y + m.rect.d / 2];
      if (kind === 'forum') { const sq = p.stats.square; expect(c[0] > sq.x && c[0] < sq.x + sq.w && c[1] > sq.y && c[1] < sq.y + sq.d).toBe(true); }
      if (kind === 'summit' && (p.form.site.relief || p.form.site.rock)) {
        const zs = p.slots.filter((s) => houses(p).has(s.asset)).map((s) => s.z).sort((a, b) => a - b);
        expect(m.z).toBeGreaterThan(zs[Math.floor(zs.length / 2)]);
      }
      if (kind === 'axis') expect(p.grounds.some((g) => g.kind === 'avenue') || p.slots.some((s) => s.asset === p.form.water.bridge)).toBe(true);
    });
  }
  it('a monument the library lacks is refused by name', () => {
    const id = Object.keys(FORMS)[0];
    expect(() => solveHistoric({ culture: id, form: { armature: { monument: 'colossus-of-rhodes' } } })).toThrow(/monument 'colossus-of-rhodes'/);
  });
});

describe('the enclosures', () => {
  it('a ring: a wall with towers round the town, gates where the streets leave it', () => {
    const id = using((f) => f.enclosure.kind === 'ring' && f.walls?.tower), p = solveHistoric({ culture: id });
    const W = p.form.walls;
    expect(p.slots.filter((s) => s.asset === W.run).length).toBeGreaterThan(10);
    expect(p.slots.filter((s) => s.asset === W.tower).length).toBeGreaterThan(3);
    expect(p.stats.gates).toBeGreaterThanOrEqual(2);
  });
  it('walled wards: each with its gate, one the market', () => {
    const id = using((f) => f.enclosure.kind === 'wards'), p = solveHistoric({ culture: id });
    expect(p.slots.filter((s) => s.asset === p.form.walls.wardGate).length).toBeGreaterThan(3);
    expect(p.slots.filter((s) => s.asset === p.form.enclosure.market)).toHaveLength(1);
    expect(law(p, 'connected').ok, law(p, 'connected').detail).toBe(true);
  });
});

describe('the water', () => {
  it('lies below the land, and a canal\'s bridges let a boat through', () => {
    const id = using((f) => f.water.kind === 'canal' && f.water.bridge), p = solveHistoric({ culture: id, seed: 7 });
    const bridges = p.slots.filter((s) => s.asset === p.form.water.bridge), K = HISTORIC_CULTURES[id];
    expect(bridges.length).toBeGreaterThan(0);
    for (const b of bridges) expect(K.assets[b.asset].profile(b.span, b.waterZ)(b.waterZ + 0.5)).toBeGreaterThan(1);
    expect(p.hAt(...(() => { const g = p.grid; for (let i = 0; i < g.data.length; i++) if (g.data[i] === g.codes.WATER) return [(i % g.cols + 0.5) * g.cell, (Math.floor(i / g.cols) + 0.5) * g.cell]; return [0, 0]; })())).toBeLessThan(-1);
  });
  it('a canal is dug in the low ground: never up a bluff or a plateau', () => {
    const id = using((f) => f.water.kind === 'canal' && (f.site.relief ?? 0) > 0), p = solveHistoric({ culture: id });
    const g = p.grid, high = [];
    for (let i = 0; i < g.data.length; i++) if (g.data[i] === g.codes.WATER) high.push(p.hAt((i % g.cols + 0.5) * g.cell, (Math.floor(i / g.cols) + 0.5) * g.cell));
    expect(high.every((z) => z < 0)).toBe(true);
  });
});

describe('the scenes', () => {
  const id = using((f) => (f.activities || []).length > 0);
  it(`the region (${id}): the town in a larger frame, the work done in its land laid by need`, () => {
    const town = solveHistoric({ culture: id }), region = solveHistoric({ culture: id, scene: 'region' });
    expect(region.frame.w).toBeGreaterThan(town.frame.w);
    expect(region.stats.activities.length).toBeGreaterThan(0);
    for (const a of region.stats.activities) expect(region.slots.filter((s) => s.activity === a.id).length).toBeGreaterThan(1);
  });
  it('the crafts that need the water stand by it, upstream or downstream of the town as the water flows', () => {
    const wid = using((f) => (f.activities || []).some((a) => a.where === 'upstream') && f.water.flows);
    const p = solveHistoric({ culture: wid, scene: 'region' }), F = FORMS[wid], cy = p.frame.d / 2, cx = p.frame.w / 2;
    const water = (x, y) => { const g = p.grid, i = Math.floor(y / g.cell) * g.cols + Math.floor(x / g.cell); return g.data[i] === g.codes.WATER; };
    for (const a of F.activities.filter((x) => x.where === 'upstream' || x.where === 'downstream')) {
      const r = p.stats.activities.find((x) => x.id === a.id).rect;
      let near = false; for (let d = 0; d <= 40 && !near; d += 3) near = [[r.x - d, r.y + r.d / 2], [r.x + r.w + d, r.y + r.d / 2], [r.x + r.w / 2, r.y - d], [r.x + r.w / 2, r.y + r.d + d]].some(([x, y]) => water(x, y));
      expect(near, `${a.id} by the water`).toBe(true);
      const down = { n: r.y + r.d / 2 < cy, s: r.y + r.d / 2 > cy, w: r.x + r.w / 2 < cx, e: r.x + r.w / 2 > cx }[F.water.flows];
      expect(down, `${a.id} ${a.where}`).toBe(a.where === 'downstream');
    }
  });
  it('a slice of life: the region cut round its focus, at its own origin, with an eye on it', () => {
    const focus = sliceFoci(id).find((f) => !['street', 'monument'].includes(f)) ?? 'street';
    const s = solveHistoric({ culture: id, scene: 'slice', focus });
    expect([s.frame.w, s.frame.d]).toEqual([...SLICE]);
    expect(s.views.slice).toBeTruthy();
    expect(s.slots.every((q) => q.rect.x + q.rect.w > 0 && q.rect.y + q.rect.d > 0 && q.rect.x < s.frame.w && q.rect.y < s.frame.d)).toBe(true);
    expect(() => solveHistoric({ culture: id, scene: 'slice', focus: 'nowhere' })).toThrow(/no slice of life round 'nowhere' — one of/);
  });
  it('refuses a scene it does not have', () => {
    expect(SCENES).toEqual(['city', 'region', 'slice']);
    expect(() => solveHistoric({ culture: id, scene: 'farm' })).toThrow(/scene is one of/);
  });
});

describe('what people had: the ledger', () => {
  it('an activity whose cited rows are not yet in reach at the town\'s year is left out, and the plan says why', () => {
    const id = using((f) => (f.activities || []).some((a) => (a.cites || []).length));
    const a = FORMS[id].activities.find((x) => (x.cites || []).length);
    const p = solveHistoric({ culture: id, scene: 'region' });
    const inReach = p.ledger.buildable && !p.notes.some((n) => n.includes(`'${a.id}' is left out`));
    expect(p.stats.activities.some((x) => x.id === a.id)).toBe(inReach);
    if (!inReach) expect(p.notes.join(' ')).toMatch(/not yet in reach/);
  });
  it('the plan carries the ledger at its place and year: what can be built, and any finding', () => {
    const p = solveHistoric({ culture: Object.keys(FORMS)[1] });
    expect(p.ledger.place.year).toBe(p.ledger.buildable.year);
    expect(Array.isArray(p.ledger.findings)).toBe(true);
    expect(p.ledger.buildable.surfaces.length).toBeGreaterThan(0);
  });
  it('a borrowed kit is said: the assets another culture lent', () => {
    const id = using((f) => (f.borrow || []).length), p = solveHistoric({ culture: id });
    expect(p.stats.borrowed).toEqual(FORMS[id].borrow);
  });
});

describe('the form', () => {
  it('is checked: an unknown field or a value out of range is refused by name', () => {
    expect(() => readForm({ from: 'sumer', streets: { width: 4 } }, FORMS)).toThrow(/form.streets.width is not a setting/);
    expect(() => readForm({ from: 'sumer', density: { gap: 9 } }, FORMS)).toThrow(/form.density.gap is a number 0–3/);
    expect(() => formOf('sumer', { armature: { kind: 'spiral' } })).toThrow(/form.armature.kind is/);
  });
  it('a variant is its base with its changes (the polis is Lindos on a gentle hill)', () => {
    const v = Object.keys(FORMS).find((k) => FORMS[k].site.cliff === false), base = 'lindos';
    expect(FORMS[v].streets).toEqual(FORMS[base].streets);
    expect(FORMS[v].site.rock).toBeLessThan(FORMS[base].site.rock);
  });
});
