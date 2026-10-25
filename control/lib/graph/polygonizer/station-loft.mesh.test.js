// station-loft's MESH part: a layer-1 part given as points and faces, compiled as given (not lofted), its points named
// as one station's slots (so a bind blend and a station's normals address each point), its declared boundary audited.
import { describe, it, expect } from 'vitest';
import { compileLayered, auditLayered } from './station-loft.js';
import { layeredShadingNormals } from './station-loft-shade.js';

const tet = (extra = {}) => ({ layer: 1, closure: 'closed', group: 'Skin', mesh: { points: { a: [0, 0, 0], b: [1, 0, 0], c: [0, 1, 0], d: [0, 0, 1] }, faces: { f0: ['a', 'c', 'b'], f1: ['a', 'b', 'd'], f2: ['a', 'd', 'c'], f3: ['b', 'c', 'd'] }, ...extra }, bind: 'root' });

describe('a mesh part', () => {
  it('compiles as given: its points one station\'s slots, its faces and groups its own, closed and sound', () => {
    const m = compileLayered({ parts: { tet: tet({ groups: { f3: 'Iris' } }) } });
    expect(m.pointIds).toEqual(['tet/st0.a', 'tet/st0.b', 'tet/st0.c', 'tet/st0.d']);
    expect(m.provenance[3]).toMatchObject({ part: 'tet', layer: 1, station: 'st0', slot: 'd' });
    expect(m.groups).toEqual(['Skin', 'Skin', 'Skin', 'Iris']);
    expect(auditLayered(m).tet.pass).toBe(true);
    expect(compileLayered({ parts: { tet: tet() } })).toEqual(compileLayered({ parts: { tet: tet() } }));
  });
  it('audits an open one by its declared boundary, and shades by its own normals', () => {
    const open = { ...tet(), closure: 'open', mesh: { ...tet().mesh, faces: { f0: ['a', 'c', 'b'], f1: ['a', 'b', 'd'], f2: ['a', 'd', 'c'] }, boundary: [['b', 'c'], ['c', 'd'], ['d', 'b']] } };
    expect(auditLayered(compileLayered({ parts: { tet: open } })).tet.pass).toBe(true);
    expect(auditLayered(compileLayered({ parts: { tet: { ...open, mesh: { ...open.mesh, boundary: [['b', 'c']] } } } })).tet.pass).toBe(false);
    const n = [-1, -1, -1].map((x) => x / Math.sqrt(3)), r = { parts: { tet: tet({ normals: { a: n } }) } };
    expect(layeredShadingNormals(compileLayered(r), r, { proxy: false })[0][0]).toEqual(n);
  });
  it('refuses a face naming a point it lacks', () => {
    expect(() => compileLayered({ parts: { tet: tet({ faces: { f0: ['a', 'b', 'z'] } }) } })).toThrow(/names a point it lacks/);
  });
});
