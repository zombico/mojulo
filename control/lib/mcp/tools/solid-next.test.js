// The solid ladder: `ask` (look | fit | function | engineered) caps `next` at its rung; without it every kind's
// `next` is what it returned before `ask` existed.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { scadNext } from './scad-next.js';
import { ASKS, checkedAsk, solidNext } from './solid-next.js';
import { createWorkbenchHandler } from './workbench.js';
import { updateSketchHandler } from './sketches.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { loadOpenscad } from '@/lib/graph/scad/scad-render';
import { createScadHandler } from './scad.js';

const hasWasm = (await loadOpenscad()) != null;

const SCAD = { kind: 'scad', source: 'cube(10);', parts: { a: 'cube(1);', b: 'sphere(1);' }, strength: { material: 'pla' } };
const cup = { lathes: [{ id: 'cup', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 0.1 }, profile: [{ t: 0, radius: 0.04 }, { t: 1, radius: 0.04 }] }] };

describe('checkedAsk', () => {
  it('passes the four asks and absence, refuses anything else by name', () => {
    for (const a of ASKS) expect(checkedAsk(a)).toBe(a);
    expect(checkedAsk(undefined)).toBeUndefined();
    expect(() => checkedAsk('serious')).toThrow(/look \| fit \| function \| engineered/);
  });
});

describe('solidNext without an ask', () => {
  it('is the scad ladder byte for byte', () => {
    expect(solidNext(SCAD)).toEqual(scadNext(SCAD));
  });

  it('says nothing on a workbench look, an equipment build or another kind', () => {
    expect(solidNext({ kind: 'workbench', ...cup })).toBeUndefined();
    expect(solidNext({ kind: 'workbench', units: 'mm', build: { type: 'equipment', item: 'sword' } })).toBeUndefined();
    expect(solidNext({ kind: 'layered' })).toBeUndefined();
    expect(solidNext({ kind: 'floorplan' })).toBeUndefined();
  });

  it('walks a workbench that is meant to be made: frames name fabricate and the bill', () => {
    expect(solidNext({ kind: 'workbench', frames: [{}] })).toEqual([
      { measure: 'printer' },
      { add: 'fabricate', tool: 'fabricate_solid', card: 'fabricate' },
      { export: 'bom', card: 'workbench', section: 'frames' },
      { add: 'strength', card: 'scad', section: 'strength' },
      { export: '3mf' },
    ]);
    expect(solidNext({ kind: 'workbench', units: 'mm', ...cup })[0]).toEqual({ measure: 'printer' });
  });
});

describe('solidNext with an ask', () => {
  it('caps the scad ladder at the rung and opens the print check', () => {
    expect(solidNext({ ...SCAD, ask: 'look' })).toEqual([{ export: '3mf' }]);
    expect(solidNext({ ...SCAD, ask: 'fit' })).toEqual([{ measure: 'printer' }, { export: '3mf' }]);
    const fn = solidNext({ ...SCAD, ask: 'function' });
    expect(fn.map((s) => s.add || s.measure || s.export)).toEqual(['printer', 'mechanism', 'strength', '3mf']);
    const eng = solidNext({ ...SCAD, ask: 'engineered' });
    expect(eng).toContainEqual({ add: 'strength.print', card: 'scad', section: 'strength' });
  });

  it('walks a workbench look only to its export, and climbs with the ask', () => {
    expect(solidNext({ kind: 'workbench', ...cup, ask: 'look' })).toEqual([{ export: '3mf' }]);
    expect(solidNext({ kind: 'workbench', ...cup, ask: 'fit' })).toEqual([{ measure: 'printer' }, { export: '3mf' }]);
    expect(solidNext({ kind: 'workbench', ...cup, ask: 'function' })).toContainEqual({ add: 'strength', card: 'scad', section: 'strength' });
  });
});

describe('the doors', () => {
  it('a workbench mint stores `ask` and returns the capped next; absent, no key and no next', async () => {
    const plain = await createWorkbenchHandler({ ...cup });
    expect(plain.next).toBeUndefined();
    expect(SketchRepository.getByRef(plain.ref).manifest).not.toHaveProperty('ask');

    const fit = await createWorkbenchHandler({ ...cup, ask: 'fit' });
    expect(fit.next).toEqual([{ measure: 'printer' }, { export: '3mf' }]);
    expect(SketchRepository.getByRef(fit.ref).manifest.ask).toBe('fit');

    await expect(createWorkbenchHandler({ ...cup, ask: 'serious' })).rejects.toThrow(/ask is one of/);
  });

  it('update_sketch climbs by patching /ask, and refuses an ask off the list', async () => {
    const { ref } = await createWorkbenchHandler({ ...cup, ask: 'look' });
    const up = await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/ask', value: 'function' }] });
    expect(up.next).toContainEqual({ add: 'strength', card: 'scad', section: 'strength' });
    await expect(updateSketchHandler({ ref, patch: [{ op: 'set', path: '/ask', value: 'max' }] })).rejects.toThrow(/ask is one of/);
  });

  it.skipIf(!hasWasm)('a scad mint stores `ask` and returns the capped ladder', async () => {
    const out = await createScadHandler({ source: 'cube(10);', ask: 'fit' });
    expect(out.next).toEqual([{ measure: 'printer' }, { export: '3mf' }]);
    expect(SketchRepository.getByRef(out.ref).manifest.ask).toBe('fit');
  });
});
