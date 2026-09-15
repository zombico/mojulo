import { describe, it, expect } from 'vitest';
import { applyManifestPatch, parsePointer } from './manifest-patch.js';

// update-sketch-patch: the applier is pure — a deep clone is patched in op order, refusals name the
// op index, and a stored recipe can never end up with a cut or a hinge pointing at nothing.

const CYL = (id, z = 6) => ({ id, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] });
const BOX = (id) => ({ id, group: 'lid', profile: { rect: { w: 4, h: 3 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 } });

const base = () => ({
  kind: 'workbench',
  units: 'cm',
  grid: true,
  lathes: [CYL('dial'), CYL('nub', 1)],
  extrudes: [BOX('lid'), BOX('g_stop'), { profile: { rect: { w: 1, h: 1 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 } }],
  cuts: [{ id: 'glyphs', from: 'dial', subtract: ['g_stop'] }],
  movers: [{ group: 'lid', turn: { center: [0, 0, 0], axis: [1, 0, 0] }, states: [0, 1.8] }],
  ledger: { recipe_bytes: 1, faces: 1, closed: true },
});

describe('applyManifestPatch — op kinds', () => {
  it('set by id shallow-merges the remaining keys; null deletes a key', () => {
    const { manifest, touched } = applyManifestPatch(base(), [
      { op: 'set', id: 'dial', material: 'chrome', profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] },
      { op: 'set', id: 'lid', group: null },
    ]);
    expect(manifest.lathes[0]).toMatchObject({ id: 'dial', material: 'chrome', axisTo: { z: 6 } });
    expect(manifest.lathes[0].profile[0].radius).toBe(1);
    expect('group' in manifest.extrudes[0]).toBe(false);
    expect([...touched]).toEqual(['dial', 'lid']);
  });

  it('set by path replaces the value at an RFC 6901 pointer and creates the last segment', () => {
    const { manifest, touched } = applyManifestPatch(base(), [
      { op: 'set', path: '/movers/0/states', value: [0, 0.27] },
      { op: 'set', path: '/grid', value: false },
      { op: 'set', path: '/facing', value: 'front' },          // absent last segment is created
      { op: 'set', path: '/extrudes/2/material', value: 'steel' }, // an unnamed monomer, by index
    ]);
    expect(manifest.movers[0].states).toEqual([0, 0.27]);
    expect(manifest.grid).toBe(false);
    expect(manifest.facing).toBe('front');
    expect(manifest.extrudes[2].material).toBe('steel');
    // the readout key for a touched monomer: its id when it has one, else its slot
    expect(touched.has('/extrudes/2')).toBe(true);
    expect(touched.has('/movers/0/states')).toBe(true);
  });

  it('add appends a monomer; a positional pointer written after the add means what the author saw', () => {
    const { manifest, touched } = applyManifestPatch(base(), [
      { op: 'add', into: 'lathes', entry: CYL('usbcap', 2) },
      { op: 'set', path: '/lathes/2/material', value: 'rubber' },
      { op: 'add', into: 'sweeps', entry: { path: [[0, 0, 0], [1, 0, 0]], radius: 0.2 } },
    ]);
    expect(manifest.lathes.map((l) => l.id)).toEqual(['dial', 'nub', 'usbcap']);
    expect(manifest.lathes[2].material).toBe('rubber');
    expect(manifest.sweeps).toHaveLength(1);           // the array is created when absent
    expect(touched.has('usbcap')).toBe(true);
    expect(touched.has('/sweeps/0')).toBe(true);
  });

  it('remove by id and by path; a positional pointer after a remove sees the shifted array', () => {
    const doc = base();
    doc.cuts = [];
    doc.movers = [];
    const { manifest } = applyManifestPatch(doc, [
      { op: 'remove', id: 'dial' },
      { op: 'remove', path: '/extrudes/0' },
      { op: 'remove', path: '/grid' },
    ]);
    expect(manifest.lathes.map((l) => l.id)).toEqual(['nub']);
    expect(manifest.extrudes.map((e) => e.id)).toEqual(['g_stop', undefined]);
    expect('grid' in manifest).toBe(false);
  });

  it('never mutates the input manifest', () => {
    const doc = base();
    const before = JSON.stringify(doc);
    applyManifestPatch(doc, [
      { op: 'set', id: 'dial', material: 'chrome' },
      { op: 'set', path: '/movers/0/states/1', value: 0.1 },
      { op: 'add', into: 'lathes', entry: CYL('x') },
      { op: 'remove', path: '/extrudes/2' },
    ]);
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe('applyManifestPatch — refusals name the op and the reason', () => {
  it('an ambiguous id is refused with both locations named', () => {
    const doc = base();
    doc.extrudes.push(BOX('dial'));
    expect(() => applyManifestPatch(doc, [{ op: 'set', id: 'dial', material: 'chrome' }]))
      .toThrow(/patch\[0\]: id 'dial' is ambiguous — carried by lathes\[0\] and extrudes\[3\]/);
  });

  it('an unknown id lists the known ones; a bare unnamed monomer is only reachable by path', () => {
    expect(() => applyManifestPatch(base(), [{ op: 'set', id: 'nope', material: 'chrome' }]))
      .toThrow(/patch\[0\]: no monomer carries id 'nope' \(known: dial, nub, lid, g_stop\)/);
  });

  it('removing a cut operand or a cut body is refused with the cut named', () => {
    expect(() => applyManifestPatch(base(), [{ op: 'remove', id: 'g_stop' }]))
      .toThrow(/patch\[0\]: cannot remove 'g_stop' — cuts\[0\] \('glyphs'\) still names 'g_stop' in `subtract`/);
    expect(() => applyManifestPatch(base(), [{ op: 'remove', id: 'dial' }]))
      .toThrow(/cuts\[0\] \('glyphs'\) still cuts FROM 'dial'/);
    // the same guard on the path form
    expect(() => applyManifestPatch(base(), [{ op: 'remove', path: '/extrudes/1' }]))
      .toThrow(/cannot remove '\/extrudes\/1' — cuts\[0\]/);
    // re-point the cut first and the removal goes through
    const { manifest } = applyManifestPatch(base(), [
      { op: 'set', path: '/cuts/0/subtract', value: [] },
      { op: 'remove', id: 'g_stop' },
    ]);
    expect(manifest.extrudes.map((e) => e.id)).toEqual(['lid', undefined]);
  });

  it('removing the last monomer of a group a mover drives is refused with the mover named', () => {
    const doc = base();
    doc.cuts = [];
    // 'lid' and 'g_stop' both carry group 'lid': removing one leaves the hinge something to swing
    const ok = applyManifestPatch(doc, [{ op: 'remove', id: 'g_stop' }]);
    expect(ok.manifest.extrudes.map((e) => e.id)).toEqual(['lid', undefined]);
    expect(() => applyManifestPatch(ok.manifest, [{ op: 'remove', id: 'lid' }]))
      .toThrow(/patch\[0\]: cannot remove 'lid' — movers\[0\] still drives group 'lid'/);
    // a mover that names a cut operand by id (its faces carry group:<id>) is a dependant too
    const byId = base();
    byId.cuts = [];
    byId.movers = [{ group: 'nub', parent: 'lid', slide: { axis: [0, 0, 1] }, states: [0, 1] }];
    expect(() => applyManifestPatch(byId, [{ op: 'remove', id: 'nub' }])).toThrow(/movers\[0\] still drives group 'nub'/);
  });

  it('add refuses an id that already exists and an unknown array', () => {
    expect(() => applyManifestPatch(base(), [{ op: 'add', into: 'lathes', entry: CYL('dial') }]))
      .toThrow(/patch\[0\]: id 'dial' already exists \(lathes\[0\]\)/);
    expect(() => applyManifestPatch(base(), [{ op: 'add', into: 'cuts', entry: {} }]))
      .toThrow(/`add` needs `into`, one of lathes \| extrudes/);
  });

  it('an unknown op, a malformed op, and an id+path op are refused', () => {
    expect(() => applyManifestPatch(base(), [{ op: 'replace', path: '/grid', value: 1 }])).toThrow(/patch\[0\]: unknown op 'replace'/);
    expect(() => applyManifestPatch(base(), ['set'])).toThrow(/patch\[0\]: an op is an object/);
    expect(() => applyManifestPatch(base(), [{ op: 'set', id: 'dial', path: '/grid', value: 1 }])).toThrow(/exactly one of `id` or `path`/);
    expect(() => applyManifestPatch(base(), [{ op: 'set', id: 'dial' }])).toThrow(/needs at least one key to merge/);
    expect(() => applyManifestPatch(base(), [{ op: 'set', path: '/grid' }])).toThrow(/needs a `value`/);
    expect(() => applyManifestPatch(base(), [])).toThrow(/non-empty array/);
  });

  it('a pointer through a missing intermediate or past the end of an array is refused; the second op is the one named', () => {
    expect(() => applyManifestPatch(base(), [{ op: 'set', path: '/grid', value: false }, { op: 'set', path: '/nope/0/x', value: 1 }]))
      .toThrow(/patch\[1\]: `path` '\/nope\/0\/x' has nothing at '\/nope'/);
    expect(() => applyManifestPatch(base(), [{ op: 'set', path: '/lathes/5', value: {} }])).toThrow(/index 5 is past the end \(2 entries\)/);
    expect(() => applyManifestPatch(base(), [{ op: 'set', path: 'grid', value: 1 }])).toThrow(/must be a JSON Pointer starting with '\/'/);
    expect(() => applyManifestPatch(base(), [{ op: 'remove', path: '/nothing' }])).toThrow(/has nothing to remove/);
  });

  it('parsePointer unescapes ~1 and ~0', () => {
    expect(parsePointer('/a~1b/c~0d/0', 'p')).toEqual(['a/b', 'c~d', '0']);
  });
});
