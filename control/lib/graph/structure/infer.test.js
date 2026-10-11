// structure/infer: the laws a new house is minted with. Each fills only a field left out, writes an ordinary value,
// gives its reason in notes.inferred, and leaves an explicit value (even false) alone.

import { describe, it, expect } from 'vitest';
import { inferHouse } from './infer.js';
import { readStructure } from './read.js';
import { checkRows } from './tables.js';

const fields = (r) => r.inferred.map((x) => x.field);

describe('the laws', () => {
  it('gives a levels[] stack a stair to every floor, and leaves a stair the creator set', () => {
    const r = inferHouse({ kind: 'floorplan', title: 'h', seed: 7, levels: [{ index: 0 }, { index: 1 }] });
    expect(r.manifest.stairs).toBe(true);
    expect(inferHouse({ kind: 'floorplan', title: 'h', seed: 7, levels: [{ index: 0 }, { index: 1 }], stairs: false }).manifest.stairs).toBe(false);
    expect(fields(inferHouse({ kind: 'floorplan', title: 'h', seed: 7, storeys: 2 }))).not.toContain('stairs');   // storeys: N has its own
  });

  it('lays a stacked house out with the livability pass, and fills only the clearance a given design leaves out', () => {
    expect(inferHouse({ kind: 'floorplan', title: 'h', seed: 5, storeys: 2 }).manifest.design).toEqual({ repair: true, clearance: true });
    expect(inferHouse({ kind: 'floorplan', title: 'h', seed: 5, storeys: 2, design: { tradition: 'japanese' } }).manifest.design).toEqual({ tradition: 'japanese', clearance: true });
    const given = { kind: 'floorplan', title: 'h', seed: 5, storeys: 2, windows: true, design: { clearance: false } };
    expect(inferHouse(given).manifest).toBe(given);
    expect(inferHouse({ kind: 'floorplan', title: 'h', seed: 5, windows: true }).inferred).toEqual([]);   // one floor, no stair to clear
  });

  it('gives a house windows unless the creator said none', () => {
    expect(inferHouse({ kind: 'floorplan', title: 'h', rooms: [{ x: 0, y: 0, w: 12, h: 12, glyph: 'B' }] }).manifest.windows).toBe(true);
    expect(fields(inferHouse({ kind: 'floorplan', title: 'h', seed: 5, windows: false }))).toEqual([]);
  });

  it('stacks a framed single floor', () => {
    const r = inferHouse({ kind: 'floorplan', title: 'h', seed: 5, windows: true, framing: { system: 'platform' } });
    expect(r.manifest.levels).toEqual([{ index: 0 }]);
    expect(fields(r)).toEqual(['levels']);
    expect(readStructure(r.manifest).construction).toBeDefined();
  });

  it('reads a roof form named as a style as that form on the default style', () => {
    expect(inferHouse({ kind: 'floorplan', title: 'h', seed: 5, roof: { style: 'gable', covering: { type: 'slate' } } }).manifest.roof)
      .toEqual({ style: 'bungalow', form: 'gable', covering: { type: 'slate' } });
    expect(inferHouse({ kind: 'floorplan', title: 'h', seed: 5, roof: 'gable' }).manifest.roof).toEqual({ style: 'bungalow', form: 'gable' });
    expect(fields(inferHouse({ kind: 'floorplan', title: 'h', seed: 5, roof: 'mission' }))).toEqual(['windows']);
  });
});

describe('the notes', () => {
  it('give each law its field, value, reason and tab, after any notes the creator wrote', () => {
    const r = inferHouse({ kind: 'floorplan', title: 'h', seed: 7, levels: [{ index: 0 }, { index: 1 }], notes: { brief: 'b', inferred: [{ field: 'x', reason: 'y' }] } });
    expect(r.manifest.notes.brief).toBe('b');
    expect(r.manifest.notes.inferred.map((x) => x.field)).toEqual(['x', 'windows', 'stairs', 'design']);
    for (const n of r.inferred) {
      expect(typeof n.reason).toBe('string');
      expect(['plan', 'structure', 'massing']).toContain(n.tab);
    }
  });

  it('are absent, and the manifest the same object, when no law applies; and the same on a second pass', () => {
    const m = { kind: 'floorplan', title: 'h', seed: 3, windows: false };
    expect(inferHouse(m).manifest).toBe(m);
    expect(inferHouse({ kind: 'store', card: 'x' }).inferred).toEqual([]);
    const once = inferHouse({ kind: 'floorplan', title: 'h', seed: 7, levels: [{ index: 0 }, { index: 1 }] }).manifest;
    expect(inferHouse(once).manifest).toBe(once);
  });
});

describe('a house built by the laws', () => {
  it('passes its stair checks', () => {
    const { manifest } = inferHouse({ kind: 'floorplan', title: 'h', seed: 7, levels: [{ index: 0 }, { index: 1 }], roof: { style: 'hip' }, windows: true, furnish: true, style: 'auto', layout: 'varied', furnishing: 'composed' });
    const rows = checkRows(readStructure(manifest)).filter((c) => ['stair-reach', 'stair-clearance', 'walkway'].includes(c.rule));
    expect(rows.map((c) => c.rule).sort()).toEqual(['stair-clearance', 'stair-reach', 'walkway']);
    for (const c of rows) expect(c.ok, JSON.stringify(c)).not.toBe(false);
  }, 60_000);
});
