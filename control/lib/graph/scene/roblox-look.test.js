// THE ROBLOX LOOK (roblox-look.js): a face's colour and material, the level's non-floor faces voxelized into boxes of
// one look each, the shell decoration only (no body, ray or touch meets it), and the floors wearing their faces' looks
// without the look ever changing what the player stands on.
import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { faceLook, materialOf, textureMeans, voxelShell, lookModel, VOXEL } from './roblox-look.js';
import { floorSlabs, greyboxModel } from './roblox-project.js';

const quad = (x0, y0, x1, y1, z, extra = {}) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], ...extra });
// an upright wall along x at y, from z0 to z1
const wall = (x0, x1, y, z0, z1, extra = {}) => ({ corners: [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], ...extra });

// an RGBA PNG as a data URL (one row per entry of rows: [[r, g, b, a], …])
function png(rows) {
  const W = rows[0].length, H = rows.length;
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.concat(rows.map((r) => Buffer.from([0, ...r.flat()])));
  const buf = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

describe('a face\'s look', () => {
  it('names a material by its texture first, then its group, else smooth plastic', () => {
    expect(materialOf({ texture: 'bark-spruce', group: 'trail:rock' })).toBe('Wood');
    expect(materialOf({ texture: 'card:x', group: 'stage:moss' })).toBe('Grass');
    expect(materialOf({ group: 'stage:prop' })).toBe('SmoothPlastic');
    expect(faceLook({ water: true, fill: '#3366aa' })).toMatchObject({ material: 'Glass', transparency: expect.any(Number) });
  });

  it('a plain face wears its fill; a textured one its tint times its texture\'s mean, the cut-out not counted', () => {
    expect(faceLook({ fill: '#ffffff' }).color).toEqual([1, 1, 1]);
    // half the texture is cut out: its mean is the opaque half's green, not a blend with the clear red
    const means = textureMeans({ leaf: png([[[0, 255, 0, 255], [255, 0, 0, 0]]]) });
    expect(faceLook({ texture: 'leaf', fill: '#ffffff' }, means).color).toEqual([0, 1, 0]);
    // a mid-grey tint darkens it in linear light (sRGB 0.5 × 1 → 0.5 back in sRGB, to a level)
    expect(faceLook({ texture: 'leaf', fill: '#808080' }, means).color[1]).toBeCloseTo(0.5, 1);
    expect(means('missing')).toBe(null);
  });
});

describe('the shell', () => {
  it('voxelizes a wall into one box of its look, leaves floors to the slabs and drops what the page draws as ground or sky', () => {
    const boxes = voxelShell([
      wall(0, 2, 0.1, 0, 1, { fill: '#ff0000' }),
      quad(0, 0, 4, 4, 0, { fill: '#00ff00' }),                                   // a floor: the slabs carry it
      wall(5, 6, 0.1, 0, 1, { fill: '#0000ff', group: 'trail:ridge' }),           // a backdrop
      wall(7, 8, 0.1, 0, 1, { fill: '#0000ff', group: 'trail:shadow' }),          // a ground's shadow
      wall(9, 10, 0.1, 0, 1, { fill: '#0000ff', texture: 'card:meadow' }),        // ground cover drawn as a card
    ]);
    expect(boxes).toEqual([{ min: [0, 0, 0], max: [2, VOXEL, 1], color: [1, 0, 0], material: 'SmoothPlastic' }]);
  });

  it('keeps two looks apart, the first face to cross a cell holds it, and the same faces make the same boxes', () => {
    const faces = [wall(0, 1, 0.1, 0, 1, { fill: '#ff0000' }), wall(1, 2, 0.1, 0, 1, { fill: '#0000ff' }), wall(0, 1, 0.2, 0, 1, { fill: '#00ff00' })];
    const boxes = voxelShell(faces);
    expect(new Set(boxes.map((b) => b.color.join(',')))).toEqual(new Set(['1,0,0', '0,0,1']));
    expect(voxelShell(faces)).toEqual(boxes);
  });

  it('is decoration only: no part collides, meets a ray or is touched; its voxel coarsens to fit the budget', () => {
    const faces = Array.from({ length: 40 }, (_, i) => wall(i * 2, i * 2 + 1, 0.1, 0, 1, { fill: i % 2 ? '#ff0000' : '#0000ff' }));
    const { model, boxes, voxel } = lookModel(faces, { max: 25 });
    expect(boxes).toBeLessThanOrEqual(25);
    expect(voxel).toBeGreaterThan(VOXEL);
    expect(model.Children.every((p) => p.Properties.CanCollide === false && p.Properties.CanQuery === false && p.Properties.CanTouch === false && p.Properties.Anchored)).toBe(true);
  });
});

describe('the floors wear their faces\' looks', () => {
  it('the slabs are the same with a look as without: each wears the look most of its cells carry', () => {
    const faces = [quad(0, 0, 3, 1, 0, { fill: '#ff0000' }), quad(3, 0, 4, 1, 0, { fill: '#0000ff' })];
    const plain = floorSlabs(faces), worn = floorSlabs(faces, { lookOf: (f) => faceLook(f) });
    expect(worn.map(({ min, max }) => ({ min, max }))).toEqual(plain);
    expect(worn[0].look.color).toEqual([1, 0, 0]);
  });

  it('with a look, the colliders are the physics only, unseen as on the page, and the look rides in the greybox', () => {
    const faces = [quad(0, 0, 2, 2, 0, { fill: '#808080' }), wall(0, 2, 1, 0, 2, { fill: '#aa0000' })];
    const look = lookModel(faces);
    const { model } = greyboxModel({ faces, colliders: [{ min: [0, 0.9, 0], max: [2, 1.1, 2] }], lookOf: look.lookOf, look });
    expect(model.Children.find((c) => c.Name === 'wall-0').Properties.Transparency).toBe(1);
    expect(model.Children.find((c) => c.Name === 'Look').Children.length).toBe(look.boxes);
    expect(model.Children.find((c) => c.Name === 'floor-0').Properties.CanCollide).toBeUndefined();
  });
});
