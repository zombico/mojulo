// godot-humanoid-pack.test.js — a humanoid figure's world pack under --humanoid (buildGodotWorldPack { humanoid: true }):
// the GLB is the engine skeleton export_model { humanoid: true, rest: 'tpose' } writes, the pack carries the figure's
// BoneMap (godot-humanoid.js) named on its skeleton in model.glb.import, and figure.gd turns it from the VRM facing back
// to the world's. Without the flag the pack is as before and its ledger says how to get the BoneMap. With MOJULO_GODOT:
// Godot's retargeter makes the skeleton %GeneralSkeleton with the profile's bone names, and through level.tscn each
// profile bone stands where the flat pack's bone stands, at every key of the clip.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-godot-humanoid-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { buildGodotWorldPack } from './godot-pack.js';
import { bakeFps } from './godot-bake.js';
import { godotBoneMapTres } from './godot-humanoid.js';
import { tposeRig, withProfileJoints } from '../figures/rig-tpose.js';
import { humanoidBonesFor } from '../polygonizer/figure-humanoid-map.js';
import { parseFigureLine } from './figure-gate.js';

const GODOT = process.env.MOJULO_GODOT;
const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scripts');
const outDir = (ref) => path.join(process.env.MOJULO_OUTCOMES_DIR, ref, 'godot');
const read = (ref, f) => readFileSync(path.join(outDir(ref), f));
const text = (ref, f) => read(ref, f).toString('utf8');
const glbJson = (bytes) => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
// the times of a clip's keys, off its first sampler's input accessor
function keyTimes(bytes, anim) {
  const j = glbJson(bytes), jsonLen = bytes.readUInt32LE(12), bin = bytes.subarray(20 + jsonLen + 8);
  const a = j.animations.find((x) => x.name === anim), acc = j.accessors[a.samplers[0].input], bv = j.bufferViews[acc.bufferView];
  const off = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  return Array.from({ length: acc.count }, (_, i) => bin.readFloatLE(off + i * 4));
}

// the fast hero (no head, lowpoly): a humanoid rig with its idle, walk and wave
const HERO = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'none', register: 'lowpoly' }) });

describe('a humanoid figure\'s Godot world pack', () => {
  it('--humanoid: the engine skeleton, its BoneMap on the skeleton, the scene turning it to the world\'s facing', async () => {
    SketchRepository.create({ ref: 'sk_gh_hero', title: 'hero', manifest: HERO });
    const pack = await buildGodotWorldPack({ ref: 'sk_gh_hero', outDir: outDir('sk_gh_hero'), humanoid: true });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_gh_hero'), { face: true });
    const engine = tposeRig(payload.figures.body);
    const want = facesToGlb({ ...payload, figures: { ...payload.figures, body: engine } }, { generator: 'mojulo sk_gh_hero', clips: '_all', skinned: true, humanoid: true }).bytes;
    expect(Buffer.compare(read('sk_gh_hero', 'model.glb'), Buffer.from(want))).toBe(0);
    const { names, leaves } = humanoidBonesFor(withProfileJoints(engine).bones);
    const vrm = [...names.values(), ...leaves.map((l) => l.vrm)];
    expect(pack.figure.humanoid).toEqual(vrm);
    expect(pack.figure.joints).toBe(glbJson(want).skins[0].joints.length);
    expect(text('sk_gh_hero', 'body.bonemap.tres')).toBe(godotBoneMapTres('body', vrm));
    expect(text('sk_gh_hero', 'model.glb.import')).toContain('"PATH:body/Skeleton3D": {\n"retarget/bone_map": Resource("res://body.bonemap.tres")\n}');
    expect(text('sk_gh_hero', 'level.tscn')).toContain('\nturn = "body"\n');
    expect(pack.ledger.figure_humanoid.note).toMatch(/^the skeleton is the engine humanoid's \(--humanoid\)/);
  }, 120000);

  it('without the flag: the flat skeleton as before, and the ledger says how to get the BoneMap', async () => {
    SketchRepository.create({ ref: 'sk_gh_flat', title: 'hero', manifest: HERO });
    const pack = await buildGodotWorldPack({ ref: 'sk_gh_flat', outDir: outDir('sk_gh_flat') });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_gh_flat'), { face: true });
    const want = facesToGlb(payload, { generator: 'mojulo sk_gh_flat', clips: '_all', skinned: true }).bytes;
    expect(Buffer.compare(read('sk_gh_flat', 'model.glb'), Buffer.from(want))).toBe(0);
    expect(pack.figure.humanoid).toBeUndefined();
    expect(pack.figure.humanoidRig).toBe(true);
    expect(pack.written.map((f) => f.file)).not.toContain('body.bonemap.tres');
    expect(text('sk_gh_flat', 'level.tscn')).not.toContain('turn =');
    expect(pack.ledger.figure_humanoid.note).toContain('Re-mint with --humanoid');
    // the clips' keys come every twelfth of a second: Godot's default bake (30 fps) would cut across them
    expect(bakeFps(read('sk_gh_flat', 'model.glb'))).toBe(36);
    expect(text('sk_gh_flat', 'model.glb.import')).toContain('\n[params]\n\nanimation/fps=36\nmeshes/generate_lods=false\n');
  }, 120000);

  it.skipIf(!GODOT)('in Godot: the flat pack on the page\'s keys; %GeneralSkeleton with the profile\'s names, each bone where the flat pack\'s stands at every key (MOJULO_GODOT)', async () => {
    const godot = (ref, args) => spawnSync(GODOT, ['--headless', '--path', outDir(ref), ...args], { encoding: 'utf8', timeout: 300000 });
    for (const ref of ['sk_gh_hero', 'sk_gh_flat']) { godot(ref, ['--import']); godot(ref, ['--import']); }
    const probe = godot('sk_gh_hero', ['--script', path.join(SCRIPTS, 'godot-figure-probe.gd'), '--', 'res://level.tscn']);
    const built = parseFigureLine(probe.stdout + probe.stderr);
    expect(built.general).toBe(1);
    expect(built.hips).toBe(1);
    expect(built.playing).toBe('body_idle');
    // the flat bone and its profile name: a hand, the head, a foot, a forearm
    const j = glbJson(read('sk_gh_flat', 'model.glb')), bones = j.skins[0].joints.map((n) => j.nodes[n].name);
    const pairs = [['handR', 'RightHand'], ['head', 'Head'], ['footL', 'LeftFoot'], ['foreArmL', 'LeftLowerArm']].filter(([b]) => bones.includes(`body:${b}`));
    expect(pairs.length).toBe(4);
    const times = keyTimes(read('sk_gh_flat', 'model.glb'), 'body:wave');
    expect(times.length).toBeGreaterThan(2);
    const at = (ref, names) => {
      const r = godot(ref, ['--script', path.join(SCRIPTS, 'godot-pose-probe.gd'), '--', 'res://level.tscn', 'body_wave', times.join(','), names.join(',')]);
      return Object.fromEntries((r.stdout + r.stderr).split('\n').filter((l) => l.startsWith('[mojulo-pose] ')).map((l) => { const [, b, ...ps] = l.split(' '); return [b, ps.map((p) => p.split(',').map(Number))]; }));
    };
    const a = at('sk_gh_flat', pairs.map(([b]) => `body_${b}`)), b = at('sk_gh_hero', pairs.map(([, v]) => v));
    // the flat pack plays the page's posed heads at every key (z-up → y-up), the wrap key the first
    const fig = (await resolveWorldScene(SketchRepository.getByRef('sk_gh_flat'), { face: true })).payload.figures.body, nb = fig.bones.length, clip = fig.clips.wave;
    for (const [fb] of pairs) {
      const i = fig.bones.findIndex((bn) => bn.id === fb);
      for (let k = 0; k < times.length; k++) {
        const o = ((k % clip.k) * nb + i) * 7, h = [clip.b[o + 4], clip.b[o + 6], -clip.b[o + 5]];
        for (let c = 0; c < 3; c++) expect(Math.abs(a[`body_${fb}`][k][c] - h[c]), `${fb} key ${k} on the page's`).toBeLessThan(2e-3);
      }
    }
    for (const [fb, vb] of pairs) {
      expect(a[`body_${fb}`]?.length, fb).toBe(times.length);
      for (let k = 0; k < times.length; k++) for (let c = 0; c < 3; c++) expect(Math.abs(a[`body_${fb}`][k][c] - b[vb][k][c]), `${fb} key ${k}`).toBeLessThan(2e-3);
    }
  }, 900000);
});
