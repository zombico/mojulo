// godot-pack.figure.test.js — a rigged layered figure's Godot world pack over an in-memory DB: the figure ships SKINNED
// (the bytes export_model { clips: '_all', skinned: true } writes) with its importer settings and a scene that plays
// one clip under the authored view; every other pack — clips off or naming none of its clips, an unrigged layered
// solid, the figure kind — emits as before, and the emitter without a figure writes the text it wrote before the figure
// pack.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-godot-figure-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { buildGodotWorldPack, figureClip } from './godot-pack.js';
import { emitGodotProject, FIGURE_IMPORT, FIGURE_VIEW_GD } from './godot-project.js';

const glbJson = (bytes) => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const outDir = (ref) => path.join(process.env.MOJULO_OUTCOMES_DIR, ref, 'godot');
const read = (ref, f) => readFileSync(path.join(outDir(ref), f));
const text = (ref, f) => read(ref, f).toString('utf8');

// the fast hero (no head, lowpoly): an 18-joint rig and the hero's own idle, walk and wave
const HERO = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'none', register: 'lowpoly' }) });
// the walking figure of world-scene.export-kinds.test.js: a rig, but not a layered one (rigid parts stay)
const FIGURE_KIND = { kind: 'figure', pose: { shR: { yaw: -40, pitch: -10 }, elbowR: 60, spine: { lateral: 0.2 } }, proto: { sex: 'female' }, garment: 'tee', motion: 'walk', title: 'walking figure' };

const STUB = `[gd_scene load_steps=3 format=3]

[ext_resource type="PackedScene" path="res://model.glb" id="model"]
[ext_resource type="Script" path="res://figure.gd" id="figure"]

[node name="Level" type="Node3D"]
script = ExtResource("figure")
score_path = "res://score.json"
clip = "body:idle"
view = 1

[node name="World" parent="." instance=ExtResource("model")]
`;
// the kernel stub and the presets of a pack without a figure, as the emitter wrote them before the figure pack
const KERNEL_STUB = `[gd_scene load_steps=3 format=3]

[ext_resource type="PackedScene" path="res://model.glb" id="model"]
[ext_resource type="Script" path="res://kernel/level.gd" id="kernel"]

[node name="Level" type="Node3D"]
script = ExtResource("kernel")
score_path = "res://score.json"

[node name="World" parent="." instance=ExtResource("model")]
`;
const PRESETS_W = `[preset.0]

name="Web"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter="*.json"
export_path="build/web/index.html"

[preset.0.options]

variant/thread_support=false

[preset.1]

name="macOS"
platform="macOS"
runnable=true
export_filter="all_resources"
include_filter="*.json"
export_path="build/mac/w.zip"

[preset.1.options]

application/bundle_identifier="com.mojulo.w"
`;

describe('figureClip', () => {
  it('idle when the figure has it, else the first looping clip, else the first; none ⇒ null', () => {
    const K = { pelvis: 5 };
    expect(figureClip({ gesture: [K], idle: [K, {}], walk: [K, {}] })).toBe('idle');
    expect(figureClip({ gesture: [K], wave: [K, {}, K], walk: [K, {}] })).toBe('wave');
    expect(figureClip({ gesture: [K] })).toBe('gesture');
    expect(figureClip({})).toBeNull();
    // the clips the GLB carries choose among the recipe's
    expect(figureClip({ idle: [K, {}], walk: [K, {}] }, ['walk'])).toBe('walk');
  });
});

describe('buildGodotWorldPack — a rigged layered figure', () => {
  it('ships the skinned GLB, its import settings and a scene that plays idle under the three-quarter view', async () => {
    SketchRepository.create({ ref: 'sk_gf_hero', title: 'hero', manifest: HERO });
    const pack = await buildGodotWorldPack({ ref: 'sk_gf_hero', outDir: outDir('sk_gf_hero') });
    const files = pack.written.map((f) => f.file);
    for (const f of ['model.glb', 'model.glb.import', 'figure.gd', 'level.tscn', 'export_presets.cfg', 'README.md']) expect(files, f).toContain(f);
    expect(pack.figure).toEqual({ name: 'body', clip: 'idle', clips: ['idle', 'walk', 'wave'], view: 1, viewName: 'three-quarter', joints: 18 });

    // the bytes export_model { format: 'glb', clips: '_all', skinned: true } writes
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_gf_hero'), {});
    const want = facesToGlb(payload, { generator: 'mojulo sk_gf_hero', clips: '_all', skinned: true }).bytes;
    expect(Buffer.compare(read('sk_gf_hero', 'model.glb'), Buffer.from(want))).toBe(0);
    const j = glbJson(read('sk_gf_hero', 'model.glb'));
    expect(j.skins).toHaveLength(1);
    expect(j.animations.map((a) => a.name)).toEqual(['body:idle', 'body:walk', 'body:wave']);

    expect(text('sk_gf_hero', 'level.tscn')).toBe(STUB);
    expect(text('sk_gf_hero', 'model.glb.import')).toBe(FIGURE_IMPORT);
    expect(text('sk_gf_hero', 'figure.gd')).toBe(FIGURE_VIEW_GD);
    expect(text('sk_gf_hero', 'export_presets.cfg').match(/^exclude_filter=""$/gm)).toHaveLength(2);
    const readme = text('sk_gf_hero', 'README.md');
    expect(readme).toContain('`idle` on a loop under the authored three-quarter view');
    expect(readme).not.toContain('WASD');
    expect(Object.keys(pack.ledger)).toEqual(expect.arrayContaining(['figure_skinned', 'figure_normals']));
    expect(readme).toContain('- `figure_skinned` — one skinned mesh (18 joints) carrying its 3 clips, one second each');
    // the hero stands at rest (no stand), so its idle is not said against a stand
    expect(readme).not.toContain('not the stand');
  }, 60000);

  it('lit: the skinned GLB over the unshaded payload with PBR materials, the figure files beside it', async () => {
    SketchRepository.create({ ref: 'sk_gf_lit', title: 'hero lit', manifest: HERO });
    const pack = await buildGodotWorldPack({ ref: 'sk_gf_lit', outDir: outDir('sk_gf_lit'), lit: true });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_gf_lit'), { unshaded: true });
    const want = facesToGlb(payload, { generator: 'mojulo sk_gf_lit', clips: '_all', skinned: true, lit: true }).bytes;
    expect(Buffer.compare(read('sk_gf_lit', 'model.glb'), Buffer.from(want))).toBe(0);
    const j = glbJson(read('sk_gf_lit', 'model.glb'));
    expect(j.skins).toHaveLength(1);
    expect(j.materials.find((m) => m.name === 'fig:body')?.extensions?.KHR_materials_unlit).toBeUndefined();
    expect(pack.figure?.clip).toBe('idle');
    for (const f of ['model.glb.import', 'figure.gd']) expect(existsSync(path.join(outDir('sk_gf_lit'), f)), f).toBe(true);
  }, 60000);

  it('every other pack as before: clips off or naming none of its clips, an unrigged layered solid, the figure kind', async () => {
    const { rig: _r, clips: _c, ...bare } = HERO.recipe;
    SketchRepository.create({ ref: 'sk_gf_noclips', title: 'hero', manifest: HERO });
    SketchRepository.create({ ref: 'sk_gf_unrigged', title: 'unrigged', manifest: { kind: 'layered', title: 'unrigged', recipe: bare, dials: HERO.dials, units: 'm' } });
    SketchRepository.create({ ref: 'sk_gf_kind', title: 'walking figure', manifest: FIGURE_KIND });
    for (const [ref, opts] of [['sk_gf_noclips', { clips: null }], ['sk_gf_noclips', { clips: 'idle' }], ['sk_gf_noclips', { clips: ['nope'] }], ['sk_gf_unrigged', {}], ['sk_gf_kind', {}]]) {
      const pack = await buildGodotWorldPack({ ref, outDir: outDir(ref), ...opts });
      const files = pack.written.map((f) => f.file);
      expect(pack.figure, ref).toBeUndefined();
      expect(files, ref).not.toContain('model.glb.import');
      expect(files, ref).not.toContain('figure.gd');
      expect(text(ref, 'level.tscn'), ref).toBe(KERNEL_STUB);
      expect(text(ref, 'export_presets.cfg'), ref).not.toContain('exclude_filter');
      expect(text(ref, 'README.md'), ref).toContain('WASD/arrows to\nwalk');
      expect(Object.keys(pack.ledger), ref).not.toContain('figure_skinned');
      expect(glbJson(read(ref, 'model.glb')).skins, ref).toBeUndefined();
    }
  }, 60000);
});

describe('the emitter without a figure (the text before the figure pack)', () => {
  it('writes the kernel stub and the presets byte for byte', () => {
    const score = { ref: 'w', title: 'fixture', units: '1 mojulo unit = 1 meter', ground: 0, eye: 1.7, colliders: [], cameras: [], entities: [], mechanics: [], soundtrack: null, ledger: {} };
    const { files } = emitGodotProject({ ref: 'w', score, manifestHash: 'h', kernelVersion: '0.2.3' });
    expect(files.map((f) => f.file)).toEqual(['project.godot', 'level.tscn', 'export_presets.cfg', '.gitignore', 'README.md']);
    expect(files.find((f) => f.file === 'level.tscn').text).toBe(KERNEL_STUB);
    expect(files.find((f) => f.file === 'export_presets.cfg').text).toBe(PRESETS_W);
  });
});

describe('the emitter with a figure that stands', () => {
  it("says its loop is not the stand the World page opens on, and the tempo and the frame", () => {
    const score = { ref: 'w', title: 'fixture', units: '1 mojulo unit = 1 meter', ground: 0, eye: 1.7, colliders: [], cameras: [], entities: [], mechanics: [], soundtrack: null, ledger: {} };
    const figure = { name: 'body', clip: 'idle', clips: ['gesture', 'idle', 'walk', 'wave'], view: 1, viewName: 'three-quarter', joints: 18 };
    const readme = emitGodotProject({ ref: 'w', score, manifestHash: 'h', kernelVersion: '0.2.3', figure }).files.find((f) => f.file === 'README.md').text;
    expect(readme).toContain("`idle` is the figure's own loop, not the stand the World page opens on\n(the clip `gesture`).");
    expect(readme).toContain('one second each (the World\npage plays a clip over three)');
    expect(readme).toContain('which frames it at\nrest (a clip that reaches overhead can leave the frame)');
  });
});

describe('figure.gd against the kernel', () => {
  it("the kernel's level still defines what the figure's scene extends and calls", () => {
    const level = readFileSync(path.join(process.cwd(), 'lib/graph/scene/godot-kernel/level.gd'), 'utf8');
    for (const def of ['func _spawn_walker(', 'func _imported_player(', 'func _anim_name(', 'func _play_loop(', 'var score_path']) expect(level, def).toContain(def);
    expect(FIGURE_VIEW_GD.startsWith('extends "res://kernel/level.gd"\n')).toBe(true);
  });
});
