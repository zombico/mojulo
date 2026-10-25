// unreal-pack.figure.test.js — a rigged layered figure's Unreal packs over an in-memory DB: the figure ships SKINNED (the
// bytes export_model { clips: '_all', skinned: true } writes) in a world pack and in a game's level, the importer loops
// its clip in the world pack, and `humanoid` ships the engine skeleton (VRM names, the T-pose rest); every other pack —
// an unrigged layered solid, the figure kind — carries the GLB it carried before the figure (no skin).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-unreal-figure-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { buildUnrealWorldPack, buildUnrealGamePack } from './unreal-pack.js';

const glbJson = (bytes) => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const outDir = (ref) => path.join(process.env.MOJULO_OUTCOMES_DIR, ref, 'unreal');
const read = (ref, f) => readFileSync(path.join(outDir(ref), f));
const text = (ref, f) => read(ref, f).toString('utf8');

// the fast hero (no head, lowpoly): its rig and the hero's own idle, walk and wave
const HERO = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'none', register: 'lowpoly' }) });
// the walking figure of world-scene.export-kinds.test.js: a rig, but not a layered one (rigid parts stay)
const FIGURE_KIND = { kind: 'figure', pose: { shR: { yaw: -40, pitch: -10 }, elbowR: 60, spine: { lateral: 0.2 } }, proto: { sex: 'female' }, garment: 'tee', motion: 'walk', title: 'walking figure' };

describe('buildUnrealWorldPack — a rigged layered figure', () => {
  it('ships the skinned GLB, the importer loops its idle, the README says what Interchange makes of it', async () => {
    SketchRepository.create({ ref: 'sk_uf_hero', title: 'hero', manifest: HERO });
    const pack = await buildUnrealWorldPack({ ref: 'sk_uf_hero', outDir: outDir('sk_uf_hero') });
    expect(pack.figure).toEqual({ name: 'body', clip: 'idle', clips: ['idle', 'walk', 'wave'], joints: 57 });

    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_uf_hero'), {});
    const want = facesToGlb(payload, { generator: 'mojulo sk_uf_hero', clips: '_all', skinned: true }).bytes;
    expect(Buffer.compare(read('sk_uf_hero', 'model.glb'), Buffer.from(want))).toBe(0);
    const j = glbJson(read('sk_uf_hero', 'model.glb'));
    expect(j.skins.map((s) => [s.name, s.joints.length])).toEqual([['body:skin', 57]]);   // what the importer's verify reads
    expect(j.animations.map((a) => a.name)).toEqual(['body:idle', 'body:walk', 'body:wave']);

    expect(text('sk_uf_hero', 'import_mojulo.py')).toContain('FIGURE_CLIPS = {"body":"body:idle"}');
    expect(text('sk_uf_hero', 'IMPORT-GUIDE.md')).toContain('the figure `body` stands skinned (one mesh, its skeleton) and loops its `idle` clip');
    const readme = text('sk_uf_hero', 'README.md');
    expect(readme).toContain('`body` ships skinned: one mesh on a 57-joint skeleton and its clips (`idle`, `walk`, `wave`).');
    expect(readme).toContain('importer loops `idle` on it (single node), since a world pack has no kernel.');
    expect(readme).not.toContain('VRM names');
  }, 60000);

  it('--humanoid: the engine skeleton, VRM-named at the T-pose rest, said as the retarget seam', async () => {
    const pack = await buildUnrealWorldPack({ ref: 'sk_uf_hero', outDir: outDir('sk_uf_hero_h'), humanoid: true });
    expect(pack.figure.joints).toBe(58);
    expect(pack.figure.humanoid).toEqual(expect.arrayContaining(['hips', 'spine', 'head', 'leftUpperArm', 'rightFoot']));
    const j = glbJson(read('sk_uf_hero_h', 'model.glb'));
    expect(j.extensionsUsed).toContain('VRMC_vrm');
    expect(j.skins[0].joints).toHaveLength(58);
    // the engine skeleton stands outside the y-up root, a scene root of its own
    expect(j.scenes[0].nodes.map((n) => j.nodes[n].name)).toEqual(['mojulo', 'body']);
    expect(text('sk_uf_hero_h', 'README.md')).toContain('the joints carry VRM names');
    expect(text('sk_uf_hero_h', 'README.md')).toContain('--humanoid');
  }, 60000);

  it('every other pack as before: an unrigged layered solid, the figure kind', async () => {
    const { rig: _r, clips: _c, ...bare } = HERO.recipe;
    SketchRepository.create({ ref: 'sk_uf_unrigged', title: 'unrigged', manifest: { kind: 'layered', title: 'unrigged', recipe: bare, dials: HERO.dials, units: 'm' } });
    SketchRepository.create({ ref: 'sk_uf_kind', title: 'walking figure', manifest: FIGURE_KIND });
    for (const ref of ['sk_uf_unrigged', 'sk_uf_kind']) {
      const pack = await buildUnrealWorldPack({ ref, outDir: outDir(ref) });
      expect(pack.figure, ref).toBeUndefined();
      const { payload } = await resolveWorldScene(SketchRepository.getByRef(ref), {});
      const before = facesToGlb(payload, { generator: `mojulo ${ref}`, clips: '_all' }).bytes;
      expect(Buffer.compare(read(ref, 'model.glb'), Buffer.from(before)), ref).toBe(0);
      expect(glbJson(read(ref, 'model.glb')).skins, ref).toBeUndefined();
      expect(text(ref, 'import_mojulo.py'), ref).toContain('FIGURE_CLIPS = {}');
      expect(text(ref, 'README.md'), ref).not.toContain('## Characters');
    }
  }, 60000);
});

describe('buildUnrealGamePack — a level with a rigged layered figure', () => {
  it('ships the level skinned, the kernel plays it (no import-time loop), the README names the level', async () => {
    SketchRepository.create({ ref: 'sk_uf_game', title: 'hero game', manifest: { kind: 'game', title: 'Hero Game', levels: [{ ref: 'sk_uf_hero', title: 'Hero' }] } });
    const pack = await buildUnrealGamePack({ ref: 'sk_uf_game', outDir: outDir('sk_uf_game') });
    expect(pack.glbStats.levels.sk_uf_hero.skinned).toEqual(['body']);
    expect(glbJson(read('sk_uf_game', 'levels/sk_uf_hero/model.glb')).skins).toHaveLength(1);
    expect(text('sk_uf_game', 'import_mojulo.py')).toContain('FIGURE_CLIPS = {}');
    const readme = text('sk_uf_game', 'README.md');
    expect(readme).toContain('## Characters');
    expect(readme).toContain('- `sk_uf_hero`: `body`');
    expect(text('sk_uf_game', 'MojuloKernel/Source/MojuloKernel/Private/MojuloGameMode.cpp')).toContain('PlayFigureClip');
  }, 60000);
});
