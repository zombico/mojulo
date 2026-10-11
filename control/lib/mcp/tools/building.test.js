process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// mint_building: one door for the house. It stores what create_sketch kind 'floorplan' stores
// for the same manifest, and answers with `next`, the steps the recipe can take from here.

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, updateSketchHandler } from '@/lib/mcp/tools/sketches';
import { mintBuilding } from '@/lib/mcp/tools/building';
import { mintSchoolComplex } from '@/lib/mcp/tools/scene-school';
import { buildingNext, OUTCOME_CARDS } from '@/lib/mcp/tools/building-next';

beforeEach(() => {
  closeDb();
});

const stored = (ref) => JSON.stringify(SketchRepository.getByRef(ref).manifest);

// One manifest per step the ladder names: a seeded floor, a furnished one-cell room, a stack,
// a framed house with its roof covering and drainage.
const HOUSES = {
  seeded: { kind: 'floorplan', title: 'h', seed: 7 },
  furnishedRoom: {
    kind: 'floorplan', title: 'h', width: 24, height: 28, rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }],
    furnish: true, view: 'cutaway', seed: 7,
  },
  storeys: { kind: 'floorplan', title: 'h', seed: 5, storeys: 2 },
  framed: { kind: 'floorplan', title: 'h', seed: 5, framing: { system: 'platform', stage: 'rough-in' }, roof: { covering: { type: 'slate' } }, drainage: true },
};

describe('mint_building — the door', () => {
  for (const [name, manifest] of Object.entries(HOUSES)) {
    it(`stores the row create_sketch stores: ${name}`, async () => {
      await createSketchHandler({ title: name, manifest, ref: `cs-${name}` });
      mintBuilding({ title: name, manifest, ref: `mb-${name}` });
      expect(stored(`mb-${name}`)).toBe(stored(`cs-${name}`));
    }, 120_000);
  }

  it("fills kind 'floorplan' and the call's title in front when they are left out, as the card writes them", async () => {
    await createSketchHandler({ title: 'h', manifest: { kind: 'floorplan', title: 'h', seed: 7 }, ref: 'cs-kindless' });
    mintBuilding({ title: 'h', manifest: { seed: 7 }, ref: 'mb-kindless' });
    expect(stored('mb-kindless')).toBe(stored('cs-kindless'));
  }, 120_000);

  it('refuses a kind that is not a building, naming where it goes', () => {
    expect(() => mintBuilding({ title: 'x', manifest: { kind: 'condo-complex' } })).toThrow(/edifice|compose_world/);
    expect(() => mintBuilding({ title: 'x' })).toThrow(/requires \{ title, manifest \}/);
  });
});

describe('mint_building — a store, a restaurant, a mall', () => {
  const SHOPS = {
    store: { kind: 'store', title: 's', card: 'bookstore' },
    restaurant: { kind: 'restaurant', title: 'r', seed: 1 },
    mall: { kind: 'mall', title: 'm', levels: 2 },
    school: { kind: 'school-complex', title: 'k', seed: 1 },
  };
  for (const [name, manifest] of Object.entries(SHOPS)) {
    it(`stores the row create_sketch stores, and reads out its occupancy and grade: ${name}`, async () => {
      if (manifest.kind === 'school-complex') mintSchoolComplex({ ...manifest, ref: `cs-shop-${name}` });   // compose_world's school door
      else await createSketchHandler({ title: name, manifest, ref: `cs-shop-${name}` });
      const res = mintBuilding({ title: name, manifest, ref: `mb-shop-${name}` });
      expect(stored(`mb-shop-${name}`)).toBe(stored(`cs-shop-${name}`));
      expect(res).toMatchObject({ ok: true, subject: 'building', occupancy: manifest.kind === 'school-complex' ? 'school' : manifest.kind, grade: { score: expect.any(Number) } });
      expect(res.notAHome).toBeUndefined();
      expect(res.next.at(-1)).toEqual({ id: 'sheets', outcome: 'drawings', export: 'sheets', card: 'building-commercial' });
    }, 120_000);
  }
});

describe('next — what is open, by outcome', () => {
  const ids = (m) => buildingNext(m).map((s) => s.id);
  const OUTCOMES = ['concept', 'layout', 'drawings', 'build'];

  it('a bare layout names every outcome, in order, ending in the exports', () => {
    const next = buildingNext({ kind: 'floorplan', seed: 7 });
    expect(ids({ kind: 'floorplan', seed: 7 })).toEqual(['site', 'roof', 'dwelling', 'windows', 'furnishing', 'sheets', 'framing', 'drainage', 'ifc']);   // the single-floor generator draws no kitchen or bath
    const order = next.map((s) => OUTCOMES.indexOf(s.outcome));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(next.find((s) => s.id === 'sheets')).toEqual({ id: 'sheets', outcome: 'drawings', export: 'sheets', card: 'house-drawings' });
  });

  it('steps taken drop out; a roof is offered as a style, never as a form; a framed roof offers its covering', () => {
    expect(ids({ kind: 'floorplan', seed: 7, windows: true, furnish: true, storeys: 2, design: { repair: true, clearance: true }, roof: 'bungalow', perimeter: true })).toEqual(['sheets', 'framing', 'drainage', 'ifc']);
    expect(buildingNext({ kind: 'floorplan', seed: 7 }).find((s) => s.id === 'roof').add).toMatch(/^roof: 'bungalow'/);
    expect(ids(HOUSES.framed)).not.toContain('covering');   // it has one
    expect(ids({ ...HOUSES.framed, roof: { style: 'bungalow' }, levels: [{ index: 0 }] })).toContain('covering');
    expect(ids({ ...HOUSES.framed, levels: [{ index: 0 }] })).not.toContain('framing');
  });

  it('names a crowded stair under layout, with the field that clears it', () => {
    const crowded = { kind: 'floorplan', seed: 7, levels: [{ index: 0 }, { index: 1 }], stairs: true, roof: { style: 'bungalow' }, windows: true, furnish: true, style: 'auto', layout: 'varied', furnishing: 'composed' };
    expect(buildingNext(crowded).find((s) => s.id === 'livability')).toMatchObject({ outcome: 'layout', add: 'design: { repair: true, clearance: true }', card: 'house-livability' });
    expect(ids({ ...crowded, design: { repair: true, clearance: true } })).not.toContain('livability');
    expect(ids({ ...crowded, design: { waive: ['stair-clearance', 'walkway'] } })).not.toContain('livability');
  });

  it('every step names its outcome card; anything that is not a building has no next', () => {
    for (const s of buildingNext({ kind: 'floorplan', seed: 7 })) expect(s.card).toBe(OUTCOME_CARDS[s.outcome]);
    expect(buildingNext({ kind: 'store' })).toBeUndefined();
    expect(buildingNext({ title: 'flow', stations: [] })).toBeUndefined();
  });

  it('mint_building, create_sketch and update_sketch all answer with next from the recipe as stored; a diagram does not', async () => {
    const minted = mintBuilding({ title: 'h', manifest: { seed: 7 }, ref: 'next-mb' });
    expect(minted.next).toEqual(buildingNext(SketchRepository.getByRef('next-mb').manifest));
    expect(minted.next.map((s) => s.id)).not.toContain('windows');   // the draw gives a drawn house windows
    expect(minted.inferred).toEqual(SketchRepository.getByRef('next-mb').manifest.notes?.inferred?.map((x) => x.field));
    const viaSketch = await createSketchHandler({ title: 'h', manifest: { kind: 'floorplan', title: 'h', seed: 7 }, ref: 'next-cs' });
    expect(viaSketch.next).toEqual(minted.next);
    const updated = await updateSketchHandler({ ref: 'next-mb', patch: [{ op: 'set', path: '/perimeter', value: true }] });
    expect(updated.next.map((s) => s.id)).not.toContain('site');
    expect(SketchRepository.getByRef('next-mb').manifest.next).toBeUndefined();   // never stored
    const flow = await createSketchHandler({ title: 'f', manifest: { title: 'f', stations: [{ id: 'a', kind: 'mcp_tool', label: 'A' }] } });
    expect(flow.next).toBeUndefined();
  }, 120_000);

  it('the design readout carries the stair clearance beside the walkway', async () => {
    const made = mintBuilding({ title: 'stack', manifest: { seed: 7, levels: [{ index: 0 }, { index: 1 }], furnish: true }, ref: 'clear-mb' });
    expect(made.design.clearance).toMatchObject({ ok: true, clearIn: 36 });
    const off = await updateSketchHandler({ ref: 'clear-mb', patch: [{ op: 'set', path: '/design', value: {} }] });
    expect(off.design.clearance.clearIn).toBe(36);
    if (!off.design.clearance.ok) expect(off.design.clearance.next).toMatch(/design\.clearance: true/);
  }, 120_000);
});

describe('the house cards — every example mints', () => {
  const CARDS = ['floor-plan', 'house-layout', 'house-dwelling', 'house-storeys', 'house-construction', 'house-bim', 'house-concept', 'house-livability', 'house-drawings', 'house-build'];

  it('next only names house cards that exist', async () => {
    const { getSketchVocabCard: getSketchVocab } = await import('@/lib/graph/sketch-vocab/loader');
    for (const id of new Set(Object.values(OUTCOME_CARDS))) expect(getSketchVocab(id), id).toBeTruthy();
  });

  for (const id of CARDS) {
    it(`${id}: its JSON examples parse and mint through mint_building`, async () => {
      const { getSketchVocabCard: getSketchVocab } = await import('@/lib/graph/sketch-vocab/loader');
      const card = getSketchVocab(id);
      expect(card, id).toBeTruthy();
      const blocks = [...card.body.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
      blocks.forEach((src, i) => {
        const manifest = JSON.parse(src);
        expect(() => mintBuilding({ title: `${id} ${i}`, manifest }), `${id} example ${i}`).not.toThrow();
      });
    }, 300_000);
  }
});

describe('mint_building — the laws a new house is built by', () => {
  it('writes each inferred value into the recipe with its reason, and keeps what the creator set', () => {
    mintBuilding({ title: 'stack', manifest: { seed: 7, levels: [{ index: 0 }, { index: 1 }] }, ref: 'mb-infer' });
    const m = SketchRepository.getByRef('mb-infer').manifest;
    expect(m.stairs).toBe(true);
    expect(m.design).toEqual({ repair: true, clearance: true });
    expect(m.notes.inferred.map((x) => x.field)).toEqual(['windows', 'stairs', 'design']);
    mintBuilding({ title: 'kept', manifest: { seed: 7, levels: [{ index: 0 }, { index: 1 }], windows: false, stairs: [{ from: 0, to: 1 }], design: { clearance: false } }, ref: 'mb-kept' });
    const k = SketchRepository.getByRef('mb-kept').manifest;
    expect(k.design).toEqual({ clearance: false });
    expect(k.notes).toBeUndefined();
  }, 120_000);
});

describe('the readout never calls a house without a kitchen, bathroom or bedroom ok', () => {
  it('says not a home, and design.ok is false whatever the walkways say', async () => {
    // a stack of authored rooms with no kitchen and no bathroom
    const rooms = [{ x: 0, y: 0, w: 14, h: 12, glyph: 'L' }, { x: 14, y: 0, w: 14, h: 12, glyph: 'B' }, { x: 0, y: 12, w: 28, h: 6, glyph: 'H' }];
    const made = mintBuilding({ title: 'no home', manifest: { seed: 3, width: 28, height: 18, levels: [{ index: 0, rooms }, { index: 1, rooms }] }, ref: 'not-home' });
    expect(made.subject).toBe('house');
    expect(made.notAHome).toMatch(/no kitchen, no bathroom/);
    if (made.design) expect(made.design).toMatchObject({ ok: false, home: { ok: false } });
    expect(made.next.map((s) => s.id)).toContain('dwelling');
    const room = mintBuilding({ title: 'a room', manifest: { seed: 7, width: 24, height: 20, rooms: [{ x: 2, y: 2, w: 20, h: 16, glyph: 'L' }] }, ref: 'a-room' });
    expect(room.subject).toBe('room');
    expect(room.notAHome).toBeUndefined();
  }, 120_000);
});
