import { describe, expect, it } from 'vitest';

import { facesTo3mf } from './scene-3mf.js';
import { facesToStl } from './scene-stl.js';
import { readZip } from './zip-writer.js';

// A unit quad on the ground plane (z=0), corners in TL,TR,BR,BL order.
function quad(fill = '#808080', extra = {}) {
  return { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill, ...extra };
}

// Unpack a 3MF: the three OPC parts + a tiny structural parse of the model XML.
function open3mf(bytes) {
  const entries = readZip(bytes);
  const byName = Object.fromEntries(entries.map((e) => [e.name, e.data.toString('utf8')]));
  const model = byName['3D/3dmodel.model'];
  expect(model).toBeTruthy();
  const objects = [...model.matchAll(/<object id="(\d+)" name="([^"]*)"[^>]*pindex="(\d+)">(.*?)<\/object>/gs)].map((m) => ({
    id: +m[1],
    name: m[2],
    pindex: +m[3],
    vertices: (m[4].match(/<vertex /g) || []).length,
    triangles: [...m[4].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"(?: p1="(\d+)")?\/>/g)].map((t) => ({ v: [+t[1], +t[2], +t[3]], p1: t[4] == null ? null : +t[4] })),
    xml: m[4],
  }));
  const bases = [...model.matchAll(/<base name="([^"]+)" displaycolor="([^"]+)"\/>/g)].map((m) => ({ name: m[1], display: m[2] }));
  const items = [...model.matchAll(/<item objectid="(\d+)"(?: transform="([^"]+)")?\/>/g)].map((m) => ({ objectid: +m[1], transform: m[2] ? m[2].split(' ').map(Number) : null }));
  return { entries, byName, model, objects, bases, items };
}

describe('facesTo3mf', () => {
  it('returns null for an empty payload', () => {
    expect(facesTo3mf({ faces: [] })).toBeNull();
    expect(facesTo3mf({})).toBeNull();
    expect(facesTo3mf({ faces: [quad('#222', { decal: 'shadow' })] })).toBeNull();
  });

  it('packages the three OPC parts with millimetre units and one indexed object', () => {
    const out = facesTo3mf({ faces: [quad()] }, { title: 'a quad' });
    const z = open3mf(out.bytes);
    expect(z.entries.map((e) => e.name)).toEqual(['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']);
    expect(z.byName['_rels/.rels']).toContain('/3D/3dmodel.model');
    expect(z.byName['[Content_Types].xml']).toContain('3dmanufacturing-3dmodel+xml');
    expect(z.model).toContain('unit="millimeter"');
    expect(z.model).toContain('<metadata name="Title">a quad</metadata>');
    expect(z.objects).toHaveLength(1);
    expect(z.objects[0].name).toBe('base');
    expect(z.objects[0].vertices).toBe(4); // dedup: two triangles share the diagonal
    expect(z.objects[0].triangles).toHaveLength(2);
    expect(z.items).toEqual([{ objectid: 2, transform: null }]);
    expect(out.triangleCount).toBe(2);
    expect(out.vertexCount).toBe(4);
    expect(out.objectCount).toBe(1);
    expect(out.itemCount).toBe(1);
    expect(out.byteLength).toBe(out.bytes.length);
  });

  it('is byte-identical for the same input (the kernel baseline)', () => {
    const a = facesTo3mf({ faces: [quad('#3366cc')] }, { scale: 2.5 }).bytes;
    const b = facesTo3mf({ faces: [quad('#3366cc')] }, { scale: 2.5 }).bytes;
    expect(a.equals(b)).toBe(true);
  });

  it('stays z-up and scales world units to mm, reporting post-scale bounds', () => {
    const out = facesTo3mf({ faces: [quad()] }, { scale: 10 });
    const z = open3mf(out.bytes);
    expect(z.objects[0].xml).toContain('x="10" y="10" z="0"');
    expect(out.bounds).toEqual({ min: [0, 0, 0], max: [10, 10, 0], size: [10, 10, 0] });
  });

  it('carries the face colour as a basematerial (sRGB hex, opaque)', () => {
    const z = open3mf(facesTo3mf({ faces: [quad('#ff0000')] }).bytes);
    expect(z.bases).toEqual([{ name: '#FF0000', display: '#FF0000FF' }]);
    expect(z.objects[0].pindex).toBe(0);
    // uniform colour ⇒ no per-triangle override
    expect(z.objects[0].triangles.every((t) => t.p1 === null)).toBe(true);
  });

  it('gives a mixed-colour shell a dominant default plus per-triangle overrides', () => {
    const grey = quad('#808080');
    const red = { ...quad('#ff0000'), corners: [[2, 0, 0], [3, 0, 0], [3, 1, 0], [2, 1, 0]] };
    const grey2 = { ...quad('#808080'), corners: [[4, 0, 0], [5, 0, 0], [5, 1, 0], [4, 1, 0]] };
    const out = facesTo3mf({ faces: [grey, red, grey2] });
    const z = open3mf(out.bytes);
    expect(out.colorCount).toBe(2);
    expect(out.colorBits).toBe(8);
    const greyIdx = z.bases.findIndex((b) => b.name === '#808080');
    expect(z.objects[0].pindex).toBe(greyIdx);
    const overrides = z.objects[0].triangles.filter((t) => t.p1 !== null);
    expect(overrides).toHaveLength(2); // the red quad's two triangles
    expect(z.bases[overrides[0].p1].name).toBe('#FF0000');
  });

  it('quantizes a wide palette down to the cap, deterministically', () => {
    const faces = [];
    for (let i = 0; i < 40; i++) {
      const h = `#${(i * 6).toString(16).padStart(2, '0')}${(255 - i * 6).toString(16).padStart(2, '0')}80`;
      faces.push({ ...quad(h), corners: [[i * 2, 0, 0], [i * 2 + 1, 0, 0], [i * 2 + 1, 1, 0], [i * 2, 1, 0]] });
    }
    const out = facesTo3mf({ faces }, { maxColors: 8 });
    expect(out.colorCount).toBeLessThanOrEqual(8);
    expect(out.colorBits).toBeLessThan(8);
    expect(facesTo3mf({ faces }, { maxColors: 8 }).bytes.equals(out.bytes)).toBe(true);
  });

  it('omits water, decals, and studio furniture; keeps textured faces as bare geometry', () => {
    const out = facesTo3mf({
      faces: [
        quad('#808080'),
        quad('rgba(20,60,120,0.6)', { water: true }),
        quad('#222', { decal: 'shadow' }),
        quad('#000', { decal: 'ink' }),
        quad('#33414c', { studio: true }),
        { ...quad('#808080', { texture: 'label', uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }), corners: [[2, 0, 0], [3, 0, 0], [3, 1, 0], [2, 1, 0]] },
      ],
    });
    expect(out.triangleCount).toBe(4);
  });

  it('keeps instanced repeats as one object + one build item per transform', () => {
    const payload = {
      faces: [],
      repeats: [{
        group: 'trees',
        template: [quad('#00aa00')],
        transforms: [{ pos: [10, 0, 0] }, { pos: [0, 20, 0], scale: 2 }, { pos: [0, 0, 0], rotZ: Math.PI / 2 }],
      }],
    };
    const out = facesTo3mf(payload, { scale: 3 });
    const z = open3mf(out.bytes);
    expect(z.objects).toHaveLength(1);
    expect(z.objects[0].name).toBe('trees');
    expect(z.objects[0].triangles).toHaveLength(2); // NOT expanded
    expect(z.items).toHaveLength(3);
    expect(out.triangleCount).toBe(6); // printed count still counts every instance
    expect(out.objectCount).toBe(1);
    expect(out.itemCount).toBe(3);
    // translation lands in mm (pos × scale): 10 world → 30 mm
    expect(z.items[0].transform.slice(9)).toEqual([30, 0, 0]);
    // scale 2 shows on the diagonal
    expect(z.items[1].transform.slice(0, 3)).toEqual([2, 0, 0]);
    expect(z.items[1].transform.slice(9)).toEqual([0, 60, 0]);
    // 90° about +Z: row-vector convention, x' = x·m00 + y·m10 ⇒ m01 = 1, m10 = -1
    const r = z.items[2].transform;
    expect(r[0]).toBeCloseTo(0, 4); expect(r[1]).toBeCloseTo(1, 4);
    expect(r[3]).toBeCloseTo(-1, 4); expect(r[4]).toBeCloseTo(0, 4);
    // printed bounds match the STL's for the same payload
    const stl = facesToStl(payload, { scale: 3 });
    for (let i = 0; i < 3; i++) {
      expect(out.bounds.min[i]).toBeCloseTo(stl.bounds.min[i], 3);
      expect(out.bounds.max[i]).toBeCloseTo(stl.bounds.max[i], 3);
    }
  });

  it('drops zero-area slivers', () => {
    const degenerate = quad('#808080', { corners: [[0, 0, 0], [1, 0, 0], [1, 0, 0], [0, 0, 0]] });
    expect(facesTo3mf({ faces: [degenerate] })).toBeNull();
  });
});
