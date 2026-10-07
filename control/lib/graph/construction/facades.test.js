import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { facadeFaces, facadeRecipe, FACADE_KINDS } from './facades.js';
import { roomFurnitureAssetFaces, getRoomFurnitureAsset } from '../architecture/room-assets.js';
import { structurizeFloorplan } from '../polygonizer/floorplan-structure.js';
import { buildFractalCondoFaces } from '../architecture/fractal-condo.js';

const SIZES = { sofa: [7, 3, 2.7], armchair: [2.9, 2.9, 2.6], chesterfield: [7.2, 3.1, 2.5], 'coffee-table': [4, 2, 1.5], 'dining-table': [6, 3.2, 2.5], chair: [1.5, 1.6, 2.9], bookcase: [3, 1.1, 6], 'media-console': [5.5, 1.5, 1.8], sideboard: [5, 1.6, 2.8], chest: [3.4, 1.6, 3.4], nightstand: [1.6, 1.4, 1.9] };
const bbox = (faces) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); }
  return { lo, hi, size: lo.map((v, k) => hi[k] - v) };
};
const centroid = (faces) => [0, 1, 2].map((k) => faces.reduce((s, f) => s + f.corners[0][k], 0) / faces.length);
/** Without `furnishing`, a room and a condo are the ones they were before facades: hashes captured at 23fd35b (the room's
 *  re-pinned when the floor finish went quiet). */
const sha = (faces) => createHash('sha256').update(JSON.stringify(faces)).digest('hex').slice(0, 16);

describe('construction/facades — the built pieces, placeable', () => {
  it('fits every kind to its footprint, on the floor, with none of its fittings', () => {
    for (const kind of Object.keys(FACADE_KINDS)) {
      const [w, d, h] = SIZES[kind];
      const faces = facadeFaces(kind, { w, d, h });
      // the piece itself (its television and lamp stand above the footprint, as the room's own do; its pulls proud of it)
      const b = bbox(faces.filter((f) => !['tv', 'lamp', 'pull'].includes(f.group)));
      expect(b.size[0]).toBeCloseTo(w, 2); expect(b.size[1]).toBeCloseTo(d, 2); expect(b.size[2]).toBeCloseTo(h, 2);
      expect(b.lo[2]).toBeCloseTo(0, 6);
      expect(Math.abs(b.lo[0] + b.hi[0])).toBeLessThan(1e-6);
      expect(faces.some((f) => /(:|^)(bolt|washer|insert|hanger-bolt|spring|clip|dowel|wood-screw|cam|hinge|slide)\d*$/.test(f.group))).toBe(false);
      expect(facadeRecipe(kind, { W: w * 304.8, D: d * 304.8, H: h * 304.8 }).joints).toBeUndefined();
    }
  });
  it('faces +y, keeps to a room\'s budget, and is lowered once', () => {
    const sofa = facadeFaces('sofa', { w: 7, d: 3, h: 2.7 });
    expect(sofa.length).toBeLessThan(8000);                              // a whole sofa with every bolt is 27 000
    expect(centroid(sofa.filter((f) => f.group === 'seat-1'))[1]).toBeGreaterThan(centroid(sofa.filter((f) => f.group === 'back-1'))[1]);
    expect(facadeFaces('sofa', { w: 7, d: 3, h: 2.7 })).toBe(sofa);      // the cache
    // a near size is its own entry, scaled to its own footprint: the same bytes whatever was drawn before it
    const width = (fs) => bbox(fs.filter((f) => !['tv', 'lamp', 'pull'].includes(f.group))).size[0];
    facadeFaces('sofa', { w: 7.0004, d: 3, h: 2.7 });
    expect(width(facadeFaces('sofa', { w: 7.0001, d: 3, h: 2.7 }))).toBeCloseTo(7.0001, 9);
    const console0 = facadeFaces('media-console', { w: 5.5, d: 1.5, h: 1.8 });
    expect(console0.filter((f) => f.group === 'pull').length).toBe(12);   // a pull on each door
    expect(bbox(console0.filter((f) => f.group === 'tv')).lo[2]).toBeCloseTo(1.8, 6);   // standing on its top
  });
  it('takes a house style\'s colours', () => {
    const plain = facadeFaces('armchair', { w: 2.9, d: 2.9, h: 2.6 });
    const styled = facadeFaces('armchair', { w: 2.9, d: 2.9, h: 2.6, palette: { upholstery: '#3d6b5a' } });
    const tex = (fs) => new Set(fs.filter((f) => f.texture).map((f) => f.texture));
    expect([...tex(styled)]).not.toEqual([...tex(plain)]);
  });
  it('is a room asset by name, and furnishes a room with `furnishing: \'constructed\'`', () => {
    expect(getRoomFurnitureAsset('upholstered-sofa').id).toBe('constructed-sofa');
    const ONE = { width: 24, height: 28, rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }], doors: [{ x: 12, y: 26, room: 0, edge: 'S' }] };
    const assets = (s) => new Set(s.faces.map((f) => f.group).filter((g) => /^asset:/.test(g)).map((g) => g.split(':')[1]));
    const room = structurizeFloorplan(ONE, { furnish: true });
    expect(sha(room.faces)).toBe('03a9eadc21604348');   // re-pinned when the floor finish went quiet (muted planks, hairline seams)
    const plain = assets(room);
    const built = assets(structurizeFloorplan(ONE, { furnish: true, furnishing: 'constructed' }));
    expect([...plain].some((a) => a.startsWith('constructed-'))).toBe(false);
    for (const a of ['constructed-sofa', 'constructed-armchair', 'constructed-coffee-table', 'constructed-media-console', 'constructed-bookcase']) expect(built.has(a)).toBe(true);
  });
  it('falls back to the simpler piece for a footprint no build can take', () => {
    const el = { asset: 'constructed-sofa', heightManji: { heightWorld: 0.1, basePlane: { corners: [[0, 0, 0], [0.2, 0, 0], [0.2, 0.1, 0], [0, 0.1, 0]] } } };
    const r = roomFurnitureAssetFaces(el);
    expect(r.faces.length).toBeGreaterThan(0);
    expect(r.asset.id).toBe('constructed-sofa');
  });
  it('furnishes a condo\'s units with `furnishing: \'constructed\'`, and leaves it alone without', () => {
    const plain = buildFractalCondoFaces({ seed: 7 }).faces;
    // The condo's lobby and unit plants turn on lathe.js.
    // Output of a 2.1.0 generator that differs by CPU: V8 rounds sin(9π/8) one way on x64 and the other on arm64, and 2.1.0 builders keep
    // Math so their bytes do not move (util/math-scope.js); so this pin is per architecture (none recorded elsewhere).
    const PIN = { x64: '01b1bd7f413d0758', arm64: '97b66d5824337228' };
    if (PIN[process.arch]) expect(sha(plain)).toBe(PIN[process.arch]);
    const built = buildFractalCondoFaces({ seed: 7, furnishing: 'constructed' }).faces;
    expect(plain.some((f) => f.group === 'seat-1')).toBe(false);
    expect(built.some((f) => f.group === 'seat-1')).toBe(true);
    expect(built.some((f) => typeof f.texture === 'string' && f.texture.startsWith('fabric:'))).toBe(true);
  });
});
