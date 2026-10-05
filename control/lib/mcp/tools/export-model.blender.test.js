// export_model format: 'blender' — the Blender pack from a tool call: the same folder scripts/export-blender.mjs writes,
// a world's fire in it at `fire_t` with the render command handed back; a world without fire carries none; bad dials refuse.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-blender-export-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';

const DUNGEON = { kind: 'dungeon', chambers: [{ id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 }, { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 }], tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }] };

describe("export_model format: 'blender'", () => {
  it('writes the Blender pack, with the fire at fire_t and the Cycles render command', async () => {
    SketchRepository.create({ ref: 'sk_xb_fire', title: 'fire', manifest: { ...DUNGEON, fire: true } });
    const r = await exportModelHandler({ ref: 'sk_xb_fire', format: 'blender', fire_t: 4 });
    expect(r).toMatchObject({ ok: true, format: 'blender', kind: 'dungeon', fire: { t: 4, fires: 4 } });
    for (const f of ['model.glb', 'pack.json', 'import_mojulo.py', 'export_return.py', 'ARTPASS-GUIDE.md', 'README.md', 'fire/fire.json', 'fire/props.glb']) {
      expect(r.files, f).toContain(f);
      expect(existsSync(path.join(r.dir, f)), f).toBe(true);
    }
    expect(r.files.some((f) => f.endsWith('.bin'))).toBe(false);   // the voxel files are the pack's, not listed
    expect(r.commands.render).toMatch(/--mode render --res 3840x2160/);
    expect(JSON.parse(readFileSync(path.join(r.dir, 'fire/fire.json'), 'utf8')).t).toBe(4);
  }, 120000);

  it('a world without fire packs none; a bad fire_t or fire_detail refuses', async () => {
    SketchRepository.create({ ref: 'sk_xb_dark', title: 'dark', manifest: DUNGEON });
    const r = await exportModelHandler({ ref: 'sk_xb_dark', format: 'blender' });
    expect(r.ok).toBe(true);
    expect(r.fire).toBeUndefined();
    expect(r.commands.render).toBeUndefined();
    expect(existsSync(path.join(r.dir, 'fire'))).toBe(false);
    await expect(exportModelHandler({ ref: 'sk_xb_dark', format: 'blender', fire_t: -1 })).rejects.toThrow(/fire_t/);
    await expect(exportModelHandler({ ref: 'sk_xb_dark', format: 'blender', fire_detail: 9 })).rejects.toThrow(/fire_detail/);
  }, 120000);
});
