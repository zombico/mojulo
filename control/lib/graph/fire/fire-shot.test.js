// fire-shot.test.js — a world's fire at one instant for a path tracer: the page's kernel read at t, its flamelets as
// volumes of light, its smoke, embers, lights and props; the Blender pack carries it as a fire/ folder, only with `fire`.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-fire-shot-'));

import { resolveFire, firePageChannel, fireKernel, firePropParts } from './fire.js';
import { fireShot, fireShotTime, fireShotFaces, fireAirFor } from './fire-shot.js';
import { windField } from '../vegetation/wind.js';

const fire = (f, o = {}) => firePageChannel(resolveFire(f, []), o);
const CAMP = fire({ sources: [{ kind: 'campfire', at: [0, 0, 0] }, { kind: 'torch', at: [2, 0, 1.5], color: 'copper' }] });

describe('fireShot: the fire at one instant', () => {
  it('is the page kernel read at t: same fire, same t → the same shot; another t, another', () => {
    const a = JSON.stringify(fireShot(CAMP, 6.5)), b = JSON.stringify(fireShot(CAMP, 6.5));
    expect(a).toBe(b);
    expect(JSON.stringify(fireShot(CAMP, 6.6))).not.toBe(a);
  });

  it('a volume per flamelet the page draws, glowing about its spine; a colorant\'s lines colour it', () => {
    const t = 6.5, K = fireKernel(CAMP, null, null), S = fireShot(CAMP, t);
    for (const [i, f] of S.fires.entries()) {
      const drawn = K.flames(i, t).filter(Boolean);
      expect(f.flames).toHaveLength(drawn.length);
      expect(f.peak).toBeGreaterThan(0);
      // the brightest voxel lies within the flamelet's own box, near its spine
      const g = f.flames[0], d = drawn[0]; let best = 0, at = 0;
      for (let j = 0; j < g.idx.length; j++) { const v = g.val[3 * j] + g.val[3 * j + 1] + g.val[3 * j + 2]; if (v > best) { best = v; at = g.idx[j]; } }
      const [, ny, nz] = g.dims, p = [Math.floor(at / (ny * nz)), Math.floor(at / nz) % ny, at % nz].map((k, c) => g.origin[c] + k * g.voxel);
      let near = 1e9; for (let k = 0; k < d.rad.length; k++) near = Math.min(near, Math.hypot(p[0] - d.pts[3 * k], p[1] - d.pts[3 * k + 1], p[2] - d.pts[3 * k + 2]));
      expect(near).toBeLessThan(2 * Math.max(...d.rad));
    }
    // the campfire glows soot-orange (red over blue); the copper torch's light leans blue
    const sum = (g) => { const s = [0, 0, 0]; for (let j = 0; j < g.idx.length; j++) for (let c = 0; c < 3; c++) s[c] += g.val[3 * j + c]; return s; };
    const camp = sum(S.fires[0].flames[0]), torch = sum(S.fires[1].flames[0]);
    expect(camp[0]).toBeGreaterThan(3 * camp[2]);
    expect(torch[2] / torch[0]).toBeGreaterThan(camp[2] / camp[0]);
    expect(S.fires[1].light.color[2]).toBeGreaterThan(S.fires[1].light.color[0]);
  });

  it('a light where the page\'s stands, its smoke and embers; a fireball between casts is nowhere, mid-flight it is', () => {
    const S = fireShot(CAMP, 6.5), c = S.fires[0];
    expect(c.light.at[2]).toBeCloseTo(c.centre[2] + 0.4 * CAMP.sources[0].L, 4);
    expect(c.light.power).toBeGreaterThan(0);
    expect(c.smoke.idx.length).toBeGreaterThan(0);
    expect(S.embers.length % 9).toBe(0);
    const B = fire({ sources: [{ kind: 'fireball', path: { from: [0, 0, 1], to: [10, 0, 1], speed: 10, every: 4 } }] });
    const mid = fireShotTime(B);
    expect(fireShot(B, mid).fires[0].flames.length).toBeGreaterThan(0);
    expect(fireShot(B, 0.2).fires[0].flames).toHaveLength(0);
    expect(fireShot(B, 0.2).fires[0].light).toBeNull();
  });

  it('stands each fire on the page\'s own props; its solid parts are faces the GLB writer meshes (tris and quads)', () => {
    const S = fireShot(CAMP, 6.5);
    expect(S.fires[0].props).toEqual(firePropParts(CAMP.sources[0]));
    const camp = S.fires[0].props;
    expect(camp.filter((p) => p.shape === 'stone')).toHaveLength(11);
    expect(camp.filter((p) => p.shape === 'cyl')).toHaveLength(5);
    expect(camp.filter((p) => p.shape === 'coal')).toHaveLength(1);
    const faces = fireShotFaces(S);
    expect(faces.every((f) => f.corners.length === 3 || f.corners.length === 4)).toBe(true);
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['fire-props-0', 'fire-coals-0', 'fire-props-1', 'fire-coals-1', 'fire-embers']));
  });

  it('reads the air as the page does: a terrain\'s wind field at 1.2 m, still air elsewhere', () => {
    expect(fireAirFor({ kind: 'dungeon' }, { fire: CAMP }).air).toBeNull();
    const { air, wind } = fireAirFor({ kind: 'terrain', wind: { speed: 4, dir: 30 } }, { fire: { ...CAMP, terrainAir: true } });
    const f = windField({ speed: 4, dir: (30 * Math.PI) / 180, gust: 0.5, scale: 8, evolve: 6, veer: (20 * Math.PI) / 180, seed: 1, z0: 0.05 });
    expect(air(3, 4, 0, 2.5)).toEqual(f.at(3, 4, 1.2, 2.5));
    expect(wind.speed).toBe(4);
  });
});

describe('the Blender pack carries the fire', () => {
  it('a world with fire: fire/fire.json, a voxel file per volume, the props GLB, a ledger line; without: none', async () => {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const { buildBlenderPack } = await import('../scene/blender-pack.js');
    const DUNGEON = { kind: 'dungeon', chambers: [{ id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 }, { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 }], tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }] };
    SketchRepository.create({ ref: 'sk_fs_lit', title: 'lit', manifest: { ...DUNGEON, fire: true } });
    SketchRepository.create({ ref: 'sk_fs_dark', title: 'dark', manifest: DUNGEON });
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-fire-pack-'));
    const out = await buildBlenderPack({ ref: 'sk_fs_lit', outDir: dir, fireT: 5 });
    const F = JSON.parse(readFileSync(path.join(dir, 'fire/fire.json'), 'utf8'));
    // the dungeon's own fires, read as the live page reads them: braziers in its chambers, torches on its walls
    expect(F.fires.map((f) => f.kind)).toEqual(['brazier', 'brazier', 'torch', 'torch']);
    expect(F.t).toBe(5);
    for (const f of F.fires) for (const g of f.flames) {
      const bytes = readFileSync(path.join(dir, g.file));
      expect(bytes.length).toBe(4 * g.n * 4);   // indices, then rgb
      expect(Math.max(...new Uint32Array(bytes.buffer, bytes.byteOffset, g.n))).toBeLessThan(g.dims[0] * g.dims[1] * g.dims[2]);
    }
    expect(existsSync(path.join(dir, 'fire/props.glb'))).toBe(true);
    expect(out.pack.fire).toMatchObject({ t: 5, fires: 4 });
    expect(out.ledger.fire.note).toMatch(/mojulo-fire/);
    expect(readFileSync(path.join(dir, 'README.md'), 'utf8')).toMatch(/--mode render/);
    // the same pack again: the same bytes
    const a = readFileSync(path.join(dir, 'fire/fire.json'));
    await buildBlenderPack({ ref: 'sk_fs_lit', outDir: dir, fireT: 5 });
    expect(readFileSync(path.join(dir, 'fire/fire.json')).equals(a)).toBe(true);
    // the recipe's fire gone, a re-pack in place leaves none behind
    SketchRepository.update({ ref: 'sk_fs_lit', manifest: DUNGEON });
    await buildBlenderPack({ ref: 'sk_fs_lit', outDir: dir });
    expect(readdirSync(path.join(dir, 'fire'))).toEqual([]);
    const dark = mkdtempSync(path.join(os.tmpdir(), 'mojulo-fire-pack-'));
    const d = await buildBlenderPack({ ref: 'sk_fs_dark', outDir: dark });
    expect(readdirSync(dark)).not.toContain('fire');
    expect(d.pack.fire).toBeUndefined();
    expect(d.ledger.fire).toBeUndefined();
  }, 120000);
});
