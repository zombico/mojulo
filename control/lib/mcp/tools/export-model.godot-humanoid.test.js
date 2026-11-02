// export-model.godot-humanoid.test.js — a humanoid figure as Godot takes it from export_model: the T-pose engine skeleton
// GLB (`humanoid: true, rest: 'tpose'`) with its Godot sidecars beside it (godot-humanoid.js: the figure's BoneMap, the
// .import naming it on the skeleton, the post-import script). With MOJULO_GODOT (CI's `godot` job), both GLBs of the same
// fast hero, the humanoid and the flat one, are placed in a Godot project where the sidecars say, imported by a real
// Godot headless, and probed (scripts/godot-humanoid-probe.gd): the retargeter makes the humanoid's skeleton
// %GeneralSkeleton with the profile's bone names and its clips arrive; and at every key of a clip that Godot's default
// bake (30 fps: the .import sets none) lands on, the flat GLB plays the page's posed heads and each profile bone stands
// where the flat GLB's bone stands, but for the half turn the VRM facing (+z) is from the world's. (Between the bake's
// frames the two rests interpolate apart, so a key off them is not compared.)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-godot-humanoid-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';
import { heroRecord, expandLayeredManifest } from './layered.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { godotBoneMapTres, godotBoneMapFile, godotHumanoidImport, GODOT_POST_IMPORT_FILE, GODOT_POST_IMPORT_GD } from '@/lib/graph/scene/godot-humanoid';
import { tposeRig, withProfileJoints } from '@/lib/graph/figures/rig-tpose';
import { humanoidBonesFor } from '@/lib/graph/polygonizer/figure-humanoid-map';
import { parseGlb } from '@/lib/graph/scene/scene-gltf-read';

const GODOT = process.env.MOJULO_GODOT;
const PROBE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scripts/godot-humanoid-probe.gd');
// the fast hero (no head, lowpoly): a humanoid rig with its idle, walk and wave
const HERO = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'none', register: 'lowpoly' }) });
// the times of a clip's keys, off its first sampler's input accessor
function keyTimes(bytes, anim) {
  const { json: j, bin } = parseGlb(bytes);
  const a = j.animations.find((x) => x.name === anim), acc = j.accessors[a.samplers[0].input], bv = j.bufferViews[acc.bufferView];
  const off = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  return Array.from({ length: acc.count }, (_, i) => bin.readFloatLE(off + i * 4));
}

const exported = {};
async function exportHero(ref, humanoid) {
  SketchRepository.create({ ref, title: 'hero', manifest: HERO });
  exported[ref] = await exportModelHandler({ ref, format: 'glb', clips: '_all', skinned: true, ...(humanoid ? { humanoid: true, rest: 'tpose' } : {}) });
  return exported[ref];
}

describe('a humanoid figure as Godot takes it from export_model', () => {
  it('the engine skeleton GLB with its BoneMap, its .import naming it at the folder it is placed in, and the post-import script', async () => {
    const r = await exportHero('sk_gh_hero', true);
    await exportHero('sk_gh_flat', false);
    expect(r.godot.place_at).toBe('res://mojulo/sk_gh_hero/');
    expect(r.godot.files.sort()).toEqual([godotBoneMapFile('body'), GODOT_POST_IMPORT_FILE, 'model.glb.import'].sort());
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_gh_hero'), { face: true });
    const { names, leaves } = humanoidBonesFor(withProfileJoints(payload.figures.body).bones);
    const at = (f) => readFileSync(path.join(r.dir, f), 'utf8');
    expect(at(godotBoneMapFile('body'))).toBe(godotBoneMapTres('body', [...names.values(), ...leaves.map((l) => l.vrm)]));
    expect(at('model.glb.import')).toBe(godotHumanoidImport(['body'], 'mojulo/sk_gh_hero'));
    expect(at(GODOT_POST_IMPORT_FILE)).toBe(GODOT_POST_IMPORT_GD);
    // the skin's joints are the engine skeleton's: its bones, its inserted joints and its weightless leaves
    const joints = parseGlb(readFileSync(r.path)).json.skins[0].joints.length;
    expect(joints).toBe(withProfileJoints(tposeRig(payload.figures.body)).bones.length + leaves.length);
    expect(exported['sk_gh_flat'].godot).toBeUndefined();
  }, 300000);

  it.skipIf(!GODOT)('in Godot: %GeneralSkeleton with the profile\'s names and the clips; at each key on the bake, the flat GLB on the page\'s and each bone where the flat one stands (MOJULO_GODOT)', async () => {
    const project = mkdtempSync(path.join(os.tmpdir(), 'mojulo-godot-humanoid-project-'));
    writeFileSync(path.join(project, 'project.godot'), 'config_version=5\n\n[application]\nconfig/name="mojulo humanoid gate"\n');
    // each export at the res:// folder its sidecars name (the flat GLB with Godot's default import)
    for (const [ref, files] of [['sk_gh_hero', ['model.glb', ...exported['sk_gh_hero'].godot.files]], ['sk_gh_flat', ['model.glb']]]) {
      const to = path.join(project, 'mojulo', ref);
      mkdirSync(to, { recursive: true });
      for (const f of files) copyFileSync(path.join(exported[ref].dir, f), path.join(to, f));
    }
    const godot = (args) => spawnSync(GODOT, ['--headless', '--path', project, ...args], { encoding: 'utf8', timeout: 300000 });
    godot(['--import']); godot(['--import']);
    const flatGlb = readFileSync(exported['sk_gh_flat'].path), j = parseGlb(flatGlb).json;
    const bones = j.skins[0].joints.map((n) => j.nodes[n].name);
    // the flat bone and its profile name: a hand, the head, a foot, a forearm
    const pairs = [['handR', 'RightHand'], ['head', 'Head'], ['footL', 'LeftFoot'], ['foreArmL', 'LeftLowerArm']].filter(([b]) => bones.includes(`body:${b}`));
    expect(pairs.length).toBe(4);
    const times = keyTimes(flatGlb, 'body:wave');
    expect(times.length).toBeGreaterThan(2);
    const probe = (ref, names) => {
      const r = godot(['--script', PROBE, '--', `res://mojulo/${ref}/model.glb`, 'body_wave', times.join(','), names.join(',')]);
      const lines = `${r.stdout}\n${r.stderr}`.split('\n');
      const head = lines.find((l) => l.startsWith('[mojulo-humanoid] '));
      return {
        imported: head ? JSON.parse(head.slice('[mojulo-humanoid] '.length)) : null,
        at: Object.fromEntries(lines.filter((l) => l.startsWith('[mojulo-pose] ')).map((l) => { const [, b, ...ps] = l.split(' '); return [b, ps.map((p) => p.split(',').map(Number))]; })),
        log: `${r.stdout}\n${r.stderr}`.slice(-3000),
      };
    };
    const flat = probe('sk_gh_flat', pairs.map(([b]) => `body_${b}`)), hero = probe('sk_gh_hero', pairs.map(([, v]) => v));
    // the retargeter renamed the skeleton and its bones to the profile's; the clips arrived on both
    expect(hero.imported, hero.log).toMatchObject({ skeletons: 1, skeleton: 'GeneralSkeleton', hips: 1 });
    expect(hero.imported.animations).toContain('body_wave');
    expect(flat.imported, flat.log).toMatchObject({ skeletons: 1, hips: 0 });
    expect(flat.imported.animations).toEqual(hero.imported.animations);
    // the flat GLB plays the page's posed heads (z-up → y-up) at each key Godot's bake (30 fps) lands on
    const fig = (await resolveWorldScene(SketchRepository.getByRef('sk_gh_flat'), { face: true })).payload.figures.body, nb = fig.bones.length, clip = fig.clips.wave;
    const onBake = times.map((t, k) => [t, k]).filter(([t]) => Math.abs(t * 30 - Math.round(t * 30)) < 1e-4);
    expect(onBake.length).toBeGreaterThan(2);
    for (const [fb] of pairs) {
      const i = fig.bones.findIndex((bn) => bn.id === fb);
      for (const [, k] of onBake) {
        const o = ((k % clip.k) * nb + i) * 7, h = [clip.b[o + 4], clip.b[o + 6], -clip.b[o + 5]];
        for (let c = 0; c < 3; c++) expect(Math.abs(flat.at[`body_${fb}`][k][c] - h[c]), `${fb} key ${k} on the page's`).toBeLessThan(2e-3);
      }
    }
    // each profile bone where the flat bone stands, at each key on the bake: the engine skeleton faces +z, half a turn
    // about the world's up from the flat figure's facing
    for (const [fb, vb] of pairs) {
      expect(flat.at[`body_${fb}`]?.length, fb).toBe(times.length);
      expect(hero.at[vb]?.length, vb).toBe(times.length);
      for (const [, k] of onBake) {
        const [x, y, z] = hero.at[vb][k], turned = [-x, y, -z];
        for (let c = 0; c < 3; c++) expect(Math.abs(flat.at[`body_${fb}`][k][c] - turned[c]), `${fb} key ${k}`).toBeLessThan(2e-3);
      }
    }
  }, 900000);
});
