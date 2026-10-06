process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// mint_building: one door for the house. It stores what create_sketch kind 'floorplan' stores
// for the same manifest, and answers with `next`, the steps the recipe can take from here.

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, updateSketchHandler } from '@/lib/mcp/tools/sketches';
import { mintBuilding } from '@/lib/mcp/tools/building';
import { buildingNext, RUNG_CARDS } from '@/lib/mcp/tools/building-next';

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
    expect(() => mintBuilding({ title: 'x', manifest: { kind: 'store', concept: 'bakery' } })).toThrow(/edifice|create_sketch|compose_world/);
    expect(() => mintBuilding({ title: 'x' })).toThrow(/requires \{ title, manifest \}/);
  });
});

describe('next — the steps open from here', () => {
  const steps = (m) => buildingNext(m).map((s) => s.add || `export:${s.export}`);

  it('a bare layout can take every step', () => {
    expect(steps({ kind: 'floorplan', seed: 7 })).toEqual(['furnishing', 'storeys', 'framing', 'export:ifc']);
  });

  it('steps already taken drop out; a framed house offers its roof covering and drainage', () => {
    expect(steps({ kind: 'floorplan', seed: 7, furnish: true, storeys: 2 })).toEqual(['framing', 'export:ifc']);
    expect(steps({ kind: 'floorplan', seed: 7, view: 'cutaway', levels: [{ role: 'ground' }], framing: { system: 'steel' } }))
      .toEqual(['roof', 'drainage', 'export:ifc']);
    expect(steps(HOUSES.framed)).toEqual(['furnishing', 'storeys', 'export:ifc']);
  });

  it('every step names the card that teaches it; anything that is not a building has no ladder', () => {
    for (const s of buildingNext({ kind: 'floorplan', seed: 7 })) expect(Object.values(RUNG_CARDS)).toContain(s.card);
    expect(buildingNext({ kind: 'store' })).toBeUndefined();
    expect(buildingNext({ title: 'flow', stations: [] })).toBeUndefined();
  });

  it('mint_building, create_sketch and update_sketch all answer with next; a diagram does not', async () => {
    const minted = mintBuilding({ title: 'h', manifest: { seed: 7 }, ref: 'next-mb' });
    expect(minted.next).toEqual(buildingNext({ kind: 'floorplan', seed: 7 }));
    const viaSketch = await createSketchHandler({ title: 'h', manifest: { kind: 'floorplan', title: 'h', seed: 7 }, ref: 'next-cs' });
    expect(viaSketch.next).toEqual(minted.next);
    const updated = await updateSketchHandler({ ref: 'next-mb', manifest: { kind: 'floorplan', title: 'h', seed: 7, storeys: 2 } });
    expect(updated.next.map((s) => s.add || s.export)).toEqual(['furnishing', 'framing', 'ifc']);
    expect(SketchRepository.getByRef('next-mb').manifest.next).toBeUndefined();   // never stored
    const flow = await createSketchHandler({ title: 'f', manifest: { title: 'f', stations: [{ id: 'a', kind: 'mcp_tool', label: 'A' }] } });
    expect(flow.next).toBeUndefined();
  }, 120_000);
});
