// Isolate to in-memory SQLite and a temporary storage root — before any import that reads them.
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
const STORE = mkdtempSync(path.join(os.tmpdir(), 'moj-cover-'));
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.STORAGE_ROOT = STORE;

/**
 * create_cover without an image worker: the plugin profile's cover starts with a placeholder illustration (nothing
 * to paint), and an operator's uploaded picture (a stash image item) is mapped onto the slot and composited as it is.
 */
import { afterAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { closeDb } from '@/lib/db/index';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { uploadFile } from '@/lib/storage';
import { createCoverHandler } from './cover.js';
import { compositeCoverForSketch } from '@/lib/graph/image-outcomes/cover-compositor';
import { coverRenderTargets } from '@/lib/graph/image-outcomes/cover-manifest';

afterAll(() => { closeDb(); rmSync(STORE, { recursive: true, force: true }); });

async function upload() {
  const png = await sharp({ create: { width: 160, height: 90, channels: 3, background: { r: 230, g: 20, b: 30 } } }).png().toBuffer();
  const stash = StashRepository.mint({ title: 'cover art' });
  const key = `stashes/${stash.stashRef}/items/key-art.png`;
  await uploadFile(key, png);
  const item = StashRepository.gather({ stashRef: stash.stashRef, type: 'image', title: 'key art', mediaRef: key, metadata: { mime: 'image/png', width: 160, height: 90, content_hash: createHash('sha256').update(png).digest('hex') } });
  return { stash: stash.stashRef, item: item.id };
}
const withProfile = (fn) => { const was = process.env.MOJULO_DISTRIBUTION; process.env.MOJULO_DISTRIBUTION = 'claude-plugin'; try { return fn(); } finally { if (was === undefined) delete process.env.MOJULO_DISTRIBUTION; else process.env.MOJULO_DISTRIBUTION = was; } };

describe('a cover with no image worker', () => {
  it('the plugin profile starts with a placeholder: nothing to paint, and the way to real art said', () => {
    const r = withProfile(() => createCoverHandler({ title: 'Lantern Keep', for_kind: 'game' }));
    const m = SketchRepository.getByRef(r.ref).manifest;
    expect(m.slots.illustration.realizer).toBe('placeholder');
    expect(coverRenderTargets(m)).toEqual([]);
    expect(r.next).toMatch(/upload the picture into a stash/);
    expect(r.next).toMatch(/realizer: 'upload'/);
  });

  it('outside the profile a cover is painted, as before', () => {
    const r = createCoverHandler({ title: 'A Novel' });
    expect(SketchRepository.getByRef(r.ref).manifest.slots.illustration.realizer).toBe('painted');
    expect(r.render_targets).toContain('illustration');
  });

  it('an uploaded picture is mapped onto the slot and composited as it is', async () => {
    const art = await upload();
    const r = withProfile(() => createCoverHandler({ title: 'Lantern Keep', for_kind: 'game', art }));
    const sketch = SketchRepository.getByRef(r.ref);
    expect(sketch.manifest.slots.illustration).toMatchObject({ realizer: 'upload', from: art });
    const png = await compositeCoverForSketch(sketch);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const at = (x, y) => data.slice((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3);
    const [rr, g, b] = at(Math.round(info.width * 0.95), Math.round(info.height * 0.05));   // a corner: art, no lockup
    expect(rr).toBeGreaterThan(200); expect(g).toBeLessThan(60); expect(b).toBeLessThan(60);
  });

  it('a patch maps an upload onto a cover made before it', async () => {
    const art = await upload();
    const r = withProfile(() => createCoverHandler({ title: 'Later Art', for_kind: 'game', format: 'capsule' }));
    const row = SketchRepository.getByRef(r.ref);
    const manifest = { ...row.manifest, slots: { ...row.manifest.slots, illustration: { realizer: 'upload', from: art } } };
    const png = await compositeCoverForSketch({ ...row, manifest });
    expect((await sharp(png).metadata()).width).toBe(manifest.canvas.w);
  });

  it('a wrong mapping teaches', async () => {
    const art = await upload();
    expect(() => createCoverHandler({ title: 'x', art: { stash: art.stash } })).toThrow(/get_stash for its item id/);
    expect(() => createCoverHandler({ title: 'x', art: { stash: 'nope', item: 1 } })).toThrow(/no stash 'nope'/);
    expect(() => createCoverHandler({ title: 'x', art: { stash: art.stash, item: art.item + 999 } })).toThrow(/has no item/);
    expect(() => createCoverHandler({ title: 'x', for_kind: 'novel', format: 'box' })).toThrow(/game cover/);
  });
});
