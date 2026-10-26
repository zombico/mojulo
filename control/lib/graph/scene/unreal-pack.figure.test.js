// unreal-pack.figure.test.js — the Unreal ASSET pack over an in-memory DB: a rigged layered figure ships SKINNED as the
// engine skeleton by default (VRM names, the T-pose rest: export_model { humanoid: true, rest: 'tpose' }'s bytes), the
// importer loops its clip and reads its retarget chains off the GLB; `humanoid: false` keeps the flat skeleton; a solid
// with no figure carries the GLB it always exported; a game is refused (Unreal takes assets, not games), and
// export_model { format: 'unreal' } writes the same pack.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-unreal-figure-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { buildUnrealAssetPack } from './unreal-pack.js';
import { exportModelHandler } from '../../mcp/tools/sketch-model-export.js';
import { exportGameHandler } from '../../mcp/tools/export-game.js';
import { tposeRig } from '../figures/rig-tpose.js';

const glbJson = (bytes) => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const outDir = (ref) => path.join(process.env.MOJULO_OUTCOMES_DIR, ref, 'unreal');
const read = (ref, f) => readFileSync(path.join(outDir(ref), f));
const text = (ref, f) => read(ref, f).toString('utf8');

// the fast hero (no head, lowpoly): its rig and the hero's own idle, walk and wave
const HERO = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'none', register: 'lowpoly' }) });
// the walking figure of world-scene.export-kinds.test.js: a rig, but not a layered one (rigid parts stay)
const FIGURE_KIND = { kind: 'figure', pose: { shR: { yaw: -40, pitch: -10 }, elbowR: 60, spine: { lateral: 0.2 } }, proto: { sex: 'female' }, garment: 'tee', motion: 'walk', title: 'walking figure' };

// the importer's pure helpers run under python3 with a stub `unreal` module (every editor call a no-op), over a pack's own
// files: what the import reads off the GLB, said by the code the operator's editor runs. Skipped without python3.
const PYTHON = spawnSync('python3', ['--version']).status === 0;
const RUNNER = `import json, sys, types
stub = types.ModuleType('unreal')
stub.__getattr__ = lambda name: (lambda *a, **k: None)
sys.modules['unreal'] = stub
src = open(sys.argv[1]).read()
g = {'__file__': sys.argv[1], '__name__': 'import_mojulo'}
exec(compile(src[:src.index("MODE = os.environ.get('MOJULO_MODE'")], 'import_mojulo.py', 'exec'), g)
glb = sys.argv[2]
print(json.dumps({'skins': g['glb_skins'](glb), 'chains': dict((f, g['retarget_chains'](v)) for f, v in g['glb_humanoids'](glb).items())}))
`;
const importerReads = (dir, glbRel) => {
  const runner = path.join(mkdtempSync(path.join(os.tmpdir(), 'mojulo-unreal-py-')), 'run.py');
  writeFileSync(runner, RUNNER);
  const r = spawnSync('python3', ['-I', runner, path.join(dir, 'import_mojulo.py'), path.join(dir, glbRel)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
};
// the chains a full VRM humanoid makes (the hero's: upper chest, toes, every finger), as the importer names them
const CHAINS = [
  ['Spine', 'spine', 'upperChest'], ['Neck', 'neck', 'neck'], ['Head', 'head', 'head'],
  ['LeftClavicle', 'leftShoulder', 'leftShoulder'], ['LeftArm', 'leftUpperArm', 'leftHand'],
  ['RightClavicle', 'rightShoulder', 'rightShoulder'], ['RightArm', 'rightUpperArm', 'rightHand'],
  ['LeftLeg', 'leftUpperLeg', 'leftToes'], ['RightLeg', 'rightUpperLeg', 'rightToes'],
  ...['left', 'right'].flatMap((side) => [['Thumb', 'Thumb', 'Metacarpal'], ['Index', 'Index', 'Proximal'], ['Middle', 'Middle', 'Proximal'], ['Ring', 'Ring', 'Proximal'], ['Pinky', 'Little', 'Proximal']]
    .map(([chain, vrm, first]) => [`${side[0].toUpperCase()}${side.slice(1)}${chain}`, `${side}${vrm}${first}`, `${side}${vrm}Distal`])),
];

describe('buildUnrealAssetPack — a rigged layered figure', () => {
  it('ships the engine skeleton by default: skinned, VRM-named at the T-pose rest, its idle looped, its IK Rig made', async () => {
    SketchRepository.create({ ref: 'sk_uf_hero', title: 'hero', manifest: HERO });
    const pack = await buildUnrealAssetPack({ ref: 'sk_uf_hero', outDir: outDir('sk_uf_hero') });
    expect(pack.scope).toBe('asset');
    expect(pack.written.map((f) => f.file)).toEqual(['model.glb', 'recipe/sk_uf_hero.json', 'import_mojulo.py', 'IMPORT-GUIDE.md', 'README.md']);
    const { humanoid, ...rest } = pack.figure;
    expect(rest).toEqual({ name: 'body', clip: 'idle', clips: ['idle', 'walk', 'wave'], joints: 58 });
    expect(humanoid).toEqual(expect.arrayContaining(['hips', 'spine', 'head', 'leftUpperArm', 'rightFoot']));

    // the bytes export_model { humanoid: true, rest: 'tpose' } writes
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_uf_hero'), {});
    const want = facesToGlb({ ...payload, figures: { ...payload.figures, body: tposeRig(payload.figures.body) } }, { generator: 'mojulo sk_uf_hero', clips: '_all', skinned: true, humanoid: true }).bytes;
    expect(Buffer.compare(read('sk_uf_hero', 'model.glb'), Buffer.from(want))).toBe(0);
    const j = glbJson(read('sk_uf_hero', 'model.glb'));
    expect(j.extensionsUsed).toContain('VRMC_vrm');
    expect(j.animations.map((a) => a.name)).toEqual(['body:idle', 'body:walk', 'body:wave']);
    // a scene root of its own, unplaced (no entity): the importer turns it to the world's facing
    expect(j.scenes[0].nodes.map((n) => j.nodes[n].name)).toEqual(['mojulo', 'body']);
    expect(j.nodes[j.scenes[0].nodes[1]].rotation).toBeUndefined();

    expect(text('sk_uf_hero', 'import_mojulo.py')).toContain('FIGURE_CLIPS = {"body":"body:idle"}');
    expect(text('sk_uf_hero', 'IMPORT-GUIDE.md')).toContain('the figure `body` stands skinned (one mesh, its skeleton) and loops its `idle` clip');
    const readme = text('sk_uf_hero', 'README.md');
    expect(readme).toContain('`body` ships skinned: one mesh on a 58-joint skeleton and its clips (`idle`, `walk`, `wave`).');
    expect(readme).toContain('the joints carry VRM names');
    expect(readme).toContain('`IK_Mojulo_<figure>` under `Content/Mojulo/sk_uf_hero/Retarget`');
    expect(readme).not.toContain('--no-humanoid');
  }, 60000);

  it.skipIf(!PYTHON)('the importer reads its skin and its retarget chains off the GLB (python3, a stub editor)', () => {
    expect(importerReads(outDir('sk_uf_hero'), 'model.glb')).toEqual({ skins: [['body', 58]], chains: { body: CHAINS } });
  });

  it('--no-humanoid: the flat skeleton, no VRM, nothing to retarget', async () => {
    const pack = await buildUnrealAssetPack({ ref: 'sk_uf_hero', outDir: outDir('sk_uf_hero_flat'), humanoid: false });
    expect(pack.figure).toEqual({ name: 'body', clip: 'idle', clips: ['idle', 'walk', 'wave'], joints: 57 });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_uf_hero'), {});
    const want = facesToGlb(payload, { generator: 'mojulo sk_uf_hero', clips: '_all', skinned: true }).bytes;
    expect(Buffer.compare(read('sk_uf_hero_flat', 'model.glb'), Buffer.from(want))).toBe(0);
    expect(glbJson(read('sk_uf_hero_flat', 'model.glb')).skins.map((k) => [k.name, k.joints.length])).toEqual([['body:skin', 57]]);
    const readme = text('sk_uf_hero_flat', 'README.md');
    expect(readme).not.toContain('VRM names');
    expect(readme).toContain('--no-humanoid');
    if (PYTHON) expect(importerReads(outDir('sk_uf_hero_flat'), 'model.glb')).toEqual({ skins: [['body', 57]], chains: {} });
  }, 60000);

  it('a solid with no figure: the GLB it always exported, no skin, no Characters', async () => {
    const { rig: _r, clips: _c, ...bare } = HERO.recipe;
    SketchRepository.create({ ref: 'sk_uf_unrigged', title: 'unrigged', manifest: { kind: 'layered', title: 'unrigged', recipe: bare, dials: HERO.dials, units: 'm' } });
    SketchRepository.create({ ref: 'sk_uf_kind', title: 'walking figure', manifest: FIGURE_KIND });
    for (const ref of ['sk_uf_unrigged', 'sk_uf_kind']) {
      const pack = await buildUnrealAssetPack({ ref, outDir: outDir(ref) });
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

describe('Unreal takes assets, not games', () => {
  it('a game is refused with the asset move, by the pack, by export_game and by export_model', async () => {
    SketchRepository.create({ ref: 'sk_uf_game', title: 'hero game', manifest: { kind: 'game', title: 'Hero Game', levels: [{ ref: 'sk_uf_hero', title: 'Hero' }] } });
    const move = /Unreal takes mojulo's assets, not its games or levels/;
    await expect(buildUnrealAssetPack({ ref: 'sk_uf_game', outDir: outDir('sk_uf_game') })).rejects.toThrow(move);
    await expect(exportGameHandler({ ref: 'sk_uf_game', target: 'unreal' })).rejects.toThrow(/export_model \{ ref, format: 'unreal' \}/);
    await expect(exportModelHandler({ ref: 'sk_uf_game', format: 'unreal' })).rejects.toThrow(move);
  });

  it("export_model { format: 'unreal' } writes the asset pack where export-unreal.mjs writes it", async () => {
    const out = await exportModelHandler({ ref: 'sk_uf_kind', format: 'unreal', lit: true });
    expect(out).toMatchObject({ ok: true, ref: 'sk_uf_kind', format: 'unreal', dir: outDir('sk_uf_kind') });
    expect(out.files).toEqual(['model.glb', 'recipe/sk_uf_kind.json', 'import_mojulo.py', 'IMPORT-GUIDE.md', 'README.md']);
    expect(out.commands.gate).toBe('node scripts/export-unreal.mjs --ref sk_uf_kind --lit');
    expect(text('sk_uf_kind', 'import_mojulo.py')).toContain('LIT = True');
    await expect(exportModelHandler({ ref: 'sk_uf_kind', format: 'unreal', humanoid: 'yes' })).rejects.toThrow(/`humanoid` must be a boolean/);
  }, 60000);
});
