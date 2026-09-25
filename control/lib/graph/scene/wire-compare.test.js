import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { sourceSilhouette, compareSilhouette, maskFromPixels, squareMask, maskBBox, maskIoU, fitMask, referenceMask, writeCompareSheet } from './wire-compare.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { expandPlan, PLAN_SCHEMA } from '../polygonizer/station-loft-plan.js';

const recipe = expandPlan({
  schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y' }, joints: { hip: [0.2, 0, 1], knee: [0.22, 0.1, 0.5], toe: [0.22, 0.3, 0.05] },
  segments: [
    { name: 'torso', kind: 'trunk', stations: [{ z: 0.9, r: [0.3, 0.22] }, { z: 1.3, r: [0.32, 0.24] }, { z: 1.7, r: [0.2, 0.16] }], caps: { back: [0, 0, 0.8], tip: [0, 0, 1.8] }, group: 'Torso', mirror: 'plane' },
    { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.14, rB: 0.1, group: 'Legs', mirror: 'name' },
    { name: 'shinR', kind: 'segment', from: 'knee', to: 'toe', rA: 0.1, rB: [0.08, 0.04], group: 'Legs', mirror: 'name' },
  ],
});
const mesh = compileLayered(recipe);
const source = { vertices: mesh.vertices, faces: mesh.faces, groups: mesh.groups };
// a mask as an RGBA picture: dark foreground on a light background, optionally padded and stretched
const picture = (mask, res, { padX = 0, padY = 0, stretchX = 1 } = {}) => {
  const width = Math.round(res * stretchX) + 2 * padX, height = res + 2 * padY; const data = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const sx = Math.floor((x - padX) / stretchX), sy = y - padY; if (sx >= 0 && sy >= 0 && sx < res && sy < res && mask[sy * res + sx]) { const k = (y * width + x) * 4; data[k] = 40; data[k + 1] = 40; data[k + 2] = 40; } }
  return { data, width, height, channels: 4 };
};

describe('wire-compare — the matched-azimuth silhouette compare', () => {
  it('a source against its own silhouette: IoU 1, aspect 1, no centroid offset; placement and scale in the picture do not matter', () => {
    const sil = sourceSilhouette(source, 'three-quarter', { res: 192, groups: ['Torso', 'Legs'] });
    expect(sil.azimuth).toBe(150); expect(maskBBox(sil.mask, 192)).not.toBeNull(); expect(sil.groups.Torso.some((x) => x)).toBe(true); expect(sil.groups.Legs.some((x) => x)).toBe(true);
    const own = compareSilhouette(sil, sil.mask, 192); expect(own.iou).toBe(1); expect(own.aspect).toBe(1); expect(own.centroid).toEqual([0, 0]);
    const pic = picture(sil.mask, 192, { padX: 30, padY: 12 }); const ref = squareMask(maskFromPixels(pic));
    const moved = compareSilhouette(sil, ref.mask, ref.res); expect(moved.iou).toBeGreaterThan(0.95); expect(Math.abs(moved.aspect - 1)).toBeLessThan(0.05); expect(Math.hypot(...moved.centroid)).toBeLessThan(0.03);
  });
  it('a stretched reference reports its aspect and a lower overlap; a different view is a different silhouette', () => {
    const sil = sourceSilhouette(source, 'frontal', { res: 160 });
    const wideRef = squareMask(maskFromPixels(picture(sil.mask, 160, { stretchX: 1.5 }))); const wide = compareSilhouette(sil, wideRef.mask, wideRef.res);
    expect(wide.aspect).toBeGreaterThan(1.3); expect(wide.iou).toBeLessThan(0.9);
    const side = sourceSilhouette(source, 'lateral', { res: 160 }); const cross = compareSilhouette(sil, side.mask, 160);
    expect(cross.iou).toBeLessThan(0.99);   // a side view of a simple biped is a different shape, if not by much
    expect(maskIoU(sil.mask, sil.mask)).toBe(1); expect(fitMask(sil.mask, 160, [0, 0, 159, 159], 160).some((x) => x)).toBe(true);
  });
  it('reads a PNG reference and writes the side-by-side sheet (sharp)', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'wire-compare-')); const sil = sourceSilhouette(source, 'frontal', { res: 128 });
    const { default: sharp } = await import('sharp'); const pic = picture(sil.mask, 128, { padX: 10, padY: 10 });
    const refPath = path.join(dir, 'ref.png'); await sharp(pic.data, { raw: { width: pic.width, height: pic.height, channels: 4 } }).png().toFile(refPath);
    const ref = await referenceMask(refPath); const r = compareSilhouette(sil, ref.mask, ref.res); expect(r.iou).toBeGreaterThan(0.95);
    const sheet = await writeCompareSheet(path.join(dir, 'sheet.png'), sil, ref.mask, ref.res, r.fitted); const meta = await sharp(sheet).metadata(); expect(meta.width).toBe(384); expect(meta.height).toBe(128);
    writeFileSync(path.join(dir, 'numbers.json'), JSON.stringify({ iou: r.iou }));
  });
});
