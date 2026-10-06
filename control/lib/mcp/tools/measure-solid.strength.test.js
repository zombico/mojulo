// The rigidity sensor through the tools: the spec rides the row (update_sketch, shape-checked on the way in),
// measure_solid reads it against the printable soup, and the World draws the weak spot as an animated pointer.
// A row without a spec gains no key anywhere.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-strength-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { loadOpenscad } from '@/lib/graph/scad/scad-render';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { measureSolidHandler } from './measure-solid.js';
import { createScadHandler } from './scad.js';
import { updateSketchHandler } from './sketches.js';

const hasWasm = (await loadOpenscad()) != null;
const HOOK = 'union(){ translate([0,-10,-40]) cube([5,20,50]); translate([0,-10,0]) cube([80,20,10]); }';
const SPEC = { material: 'petg', build: 'z+', checks: [{ element: 'cantilever', label: 'hook', root: { at: [5, 0, 5], normal: [1, 0, 0] }, load: { at: [75, 0, 10], mass: 5 } }] };

describe.skipIf(!hasWasm)('the rigidity sensor through measure_solid and the World', () => {
  it('no spec: no strength key, no marks — the readout and the page are unchanged', async () => {
    await createScadHandler({ title: 'hook', ref: 'st_plain', source: HOOK, units: 'mm' });
    const m = await measureSolidHandler({ ref: 'st_plain', volume: false });
    expect(m).not.toHaveProperty('strength');
    expect(m.note).not.toMatch(/Strength/);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('st_plain'));
    expect(payload).not.toHaveProperty('marks');
    expect(emitThreeWorld(payload)).not.toMatch(/marks channel/);
  });

  it('a spec passed in reads the part; stored on the row it reproduces; a bad one is refused at the edit', async () => {
    await createScadHandler({ title: 'hook', ref: 'st_hook', source: HOOK, units: 'mm' });
    const passed = await measureSolidHandler({ ref: 'st_hook', volume: false, strength: SPEC });
    expect(passed.strength.readings[0]).toEqual(expect.objectContaining({ element: 'cantilever', verdict: expect.any(String) }));
    expect(passed.strength.sensor).toMatch(/not a guarantee/);
    expect(passed.note).toMatch(/Strength \(a sensor, not a guarantee\): hook:/);
    await expect(updateSketchHandler({ ref: 'st_hook', patch: [{ op: 'set', path: '/strength', value: { material: 'unobtainium', checks: [] } }] }))
      .rejects.toThrow(/strength refused/);
    const r = await updateSketchHandler({ ref: 'st_hook', patch: [{ op: 'set', path: '/strength', value: SPEC }] });
    expect(r.ok).toBe(true);
    const stored = await measureSolidHandler({ ref: 'st_hook', volume: false });
    expect(stored.strength.readings[0].margin).toEqual(passed.strength.readings[0].margin);
  });

  it('the World points at the weak spot; the faces (and so every mesh export) are untouched', async () => {
    const plain = (await resolveWorldScene(SketchRepository.getByRef('st_plain'))).payload;
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('st_hook'));
    expect(payload.marks).toHaveLength(1);
    const [mk] = payload.marks;
    expect(mk.at[0]).toBeCloseTo(5, 0);                          // at the wall
    expect(mk.label).toMatch(/^hook: bending, SF/);
    expect(mk.size).toBeGreaterThan(1); expect(mk.size).toBeLessThan(10);   // millimetre-sized for a 80 mm part
    expect(JSON.stringify(payload.faces)).toBe(JSON.stringify(plain.faces));
    const html = emitThreeWorld(payload);
    expect(html).toMatch(/marks channel/);
    expect(html).toMatch(/ stepMarks\(t\);/);
    // show:false keeps the pointer off
    await updateSketchHandler({ ref: 'st_hook', patch: [{ op: 'set', path: '/strength/show', value: false }] });
    expect((await resolveWorldScene(SketchRepository.getByRef('st_hook'))).payload).not.toHaveProperty('marks');
  });
}, 180000);
