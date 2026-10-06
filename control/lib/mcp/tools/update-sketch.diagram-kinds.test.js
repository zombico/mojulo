// update_sketch runs the same diagram lowering as create_sketch: a replacement manifest of kind
// 'sequence' or 'gantt', or carrying lanes[] or boundaries[], is stored exactly as create_sketch would
// store it (both call one helper in sketch-mint.js). A stored row sent back, whole or as a patch, already
// carries its lowered marks and is not lowered a second time.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, updateSketchHandler } from './sketches.js';

const PLACEHOLDER = {
  title: 'placeholder',
  viewBox: { width: 300, height: 120 },
  stations: [{ id: 'p', kind: 'input', label: 'P', x: 20, y: 20, w: 100, h: 40 }],
  edges: [],
};
const SEQUENCE = {
  kind: 'sequence',
  title: 'Seq',
  actors: [{ id: 'a', label: 'Agent' }, { id: 'm', label: 'mint' }, { id: 'd', label: 'db' }],
  messages: [
    { from: 'a', to: 'm', label: 'call', activate: true },
    { from: 'm', to: 'd', label: 'insert' },
    { from: 'd', to: 'm', label: 'ref', kind: 'return' },
    { from: 'm', to: 'a', label: 'ok', kind: 'return' },
  ],
};
const GANTT = {
  kind: 'gantt',
  title: 'G',
  scale: { start: 0, end: 4, unit: 'wk' },
  tasks: [{ label: 'A', start: 0, end: 2 }, { label: 'B', start: 1, end: 4 }],
};
const LANES = {
  title: 'SW',
  lanes: [{ id: 'u', label: 'User' }, { id: 's', label: 'System' }],
  stations: [
    { id: 'a', kind: 'input', label: 'Ask', lane: 'u', col: 0 },
    { id: 'b', kind: 'mcp_tool', label: 'Do', lane: 's', col: 2 },
  ],
  edges: [{ from: 'a', to: 'b' }],
};
const BOUNDARIES = {
  title: 'C4',
  viewBox: { width: 500, height: 300 },
  stations: [
    { id: 'a', kind: 'mcp_tool', label: 'A', x: 60, y: 60, w: 120, h: 50 },
    { id: 'b', kind: 'db_row', label: 'B', x: 60, y: 160, w: 120, h: 50 },
    { id: 'out', kind: 'input', label: 'Out', x: 320, y: 110, w: 120, h: 50 },
  ],
  edges: [{ from: 'out', to: 'a' }],
  boundaries: [{ label: 'Plane', contains: ['a', 'b'] }],
};
// lanes[] whose stations all carry explicit x/y: it used to pass update_sketch without bands
const PLACED_LANES = {
  title: 'Placed lanes',
  viewBox: { width: 800, height: 300 },
  lanes: [{ id: 'u', label: 'User' }, { id: 's', label: 'System' }],
  stations: [
    { id: 'a', kind: 'input', label: 'Ask', x: 40, y: 75, w: 120, h: 50 },
    { id: 'b', kind: 'mcp_tool', label: 'Do', x: 600, y: 185, w: 120, h: 50 },
  ],
  edges: [{ from: 'a', to: 'b' }],
};
const CASES = [['sequence', SEQUENCE], ['gantt', GANTT], ['lanes', LANES], ['boundaries', BOUNDARIES], ['placed-lanes', PLACED_LANES]];

const stored = (ref) => SketchRepository.getByRef(ref).manifest;

beforeAll(() => closeDb());
afterAll(() => closeDb());

describe('update_sketch lowers diagram kinds as create_sketch does', () => {
  for (const [name, manifest] of CASES) {
    it(`${name}: a replacement manifest is stored as create_sketch stores it`, async () => {
      await createSketchHandler({ title: manifest.title, manifest, ref: `dk-mint-${name}` });
      await createSketchHandler({ title: 'placeholder', manifest: PLACEHOLDER, ref: `dk-upd-${name}` });
      await updateSketchHandler({ ref: `dk-upd-${name}`, manifest });
      expect(JSON.stringify(stored(`dk-upd-${name}`))).toBe(JSON.stringify(stored(`dk-mint-${name}`)));
    });

    it(`${name}: the stored row sent back, whole or patched, is not lowered twice`, async () => {
      const ref = `dk-mint-${name}`;
      const before = stored(ref);
      await updateSketchHandler({ ref, manifest: before });
      expect(stored(ref)).toEqual(before);
      await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/title', value: 'Renamed' }] });
      expect(stored(ref)).toEqual({ ...before, title: 'Renamed' });
      // re-minting a stored row (a copy) doesn't stack its marks either
      await createSketchHandler({ title: 'copy', manifest: before, ref: `${ref}-copy` });
      expect(stored(`${ref}-copy`)).toEqual(before);
    });
  }

  it('lanes with explicitly placed stations get their bands, sized to hold every station', async () => {
    const m = stored('dk-upd-placed-lanes');
    const bands = m.marks.filter((k) => k.z === -1);
    expect(bands.filter((k) => k.kind === 'text').map((k) => k.value)).toEqual(['User', 'System']);
    expect(m.viewBox.width).toBeGreaterThanOrEqual(600 + 120);
    for (const band of bands.filter((k) => k.kind === 'rect')) expect(band.w).toBe(m.viewBox.width);
  });

  it('a sequence spec that fails lowering names the manifest manual, as at mint', async () => {
    await expect(updateSketchHandler({ ref: 'dk-upd-sequence', manifest: { ...SEQUENCE, actors: [] } }))
      .rejects.toThrow(/Invalid manifest: Invalid sequence manifest[\s\S]*manifest manual/);
  });
});
