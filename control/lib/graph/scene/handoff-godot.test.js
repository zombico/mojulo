/**
 * The handoff's Godot adapter (scene/handoff-godot.js): a handoff as a Godot project. The pack names its importer on the
 * GLB, carries each material's height map and the level record in handoff.json, writes the developer's project and scene
 * once and mojulo/ whole every time. With MOJULO_GODOT (CI's `godot` job): the pack imports, and the probe finds what the
 * importer built held to handoff.json (the materials' albedo and height, the sun and its shadow, the environment, every
 * marker and seat, collision).
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { resolveHandoff } from './handoff.js';
import { handoffGodotFiles, writeHandoffGodot, LEVEL_GLB_IMPORT, LEVEL_TSCN, HANDOFF_GODOT_VERSION } from './handoff-godot.js';

const GODOT = process.env.MOJULO_GODOT;
// (MOJULO_HANDOFF_KEEP=<dir>: the Godot legs write their projects there, kept, to open in the editor and look at)
const KEEP = process.env.MOJULO_HANDOFF_KEEP;
const packDir = (name) => { if (!KEEP) return mkdtempSync(path.join(os.tmpdir(), `mojulo-handoff-godot-${name}-`)); const d = path.join(KEEP, name); mkdirSync(d, { recursive: true }); return d; };
const box = { type: 'mesh', shape: 'box' };
const COUCH = { ref: 'sk_couch', title: 'couch', manifest: { kind: 'controllable', title: 'couch', faces: [{ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#a0b0c0', group: 'floor' }],
  figures: { hero: { hero: { cast: 'male', head: 'none', register: 'lowpoly' } } },
  entities: [{ id: 'p1', pilotable: true, rule: { type: 'walk' }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0.5] } }, { id: 'p2', pilotable: true, rule: { type: 'walk' }, body: box, transform: { pos: [3, 0, 0.5] } },
    { id: 'grunt', rule: { type: 'ai' }, body: box, transform: { pos: [6, 2, 0.5] } }],
  seats: { bodies: ['p2'], lives: 3 }, camera: { rule: 'side', target: 'p1', dist: 11 }, game: { levelRef: 'couch', mechanics: [{ kind: 'reach-exit', at: [8, 0, 0] }] } } };
const TRAIL = { ref: 'sk_trail', title: 'trail', manifest: { kind: 'geocube', cube: 'island-noon', show: 'trail', seed: 1 } };
const BAY = { ref: 'sk_bay', title: 'bay', manifest: { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 8, h: 3.5 }] } };

const fileOf = (files, name) => files.find((f) => f.file === name);
const probe = (dir) => {
  const imp = spawnSync(GODOT, ['--headless', '--path', dir, '--import'], { encoding: 'utf8', timeout: 600000 });
  const run = spawnSync(GODOT, ['--headless', '--path', dir, '--script', 'res://mojulo/handoff_probe.gd'], { encoding: 'utf8', timeout: 300000 });
  const line = `${run.stdout}\n${run.stderr}`.split('\n').find((l) => l.startsWith('[mojulo-handoff-probe] '));
  const all = `${imp.stdout}\n${imp.stderr}\n${run.stdout}\n${run.stderr}`;
  // (what the importer, a shader or a script said went wrong, anywhere in the import or the probe's run)
  const errors = all.split('\n').filter((l) => /SCRIPT ERROR|SHADER ERROR|\[mojulo-handoff\]|Invalid color code/.test(l));
  return { line: line ? JSON.parse(line.slice('[mojulo-handoff-probe] '.length)) : null, errors, log: all.slice(-4000) };
};

describe('the handoff as a Godot project', () => {
  it('names its importer on the GLB, carries the level record and each dressed face\'s height, the same bytes twice', async () => {
    const h = await resolveHandoff(BAY), files = handoffGodotFiles(h);
    expect(fileOf(files, 'mojulo/level.glb').data.equals(Buffer.from(h.exported.bytes))).toBe(true);
    expect(fileOf(files, 'mojulo/level.glb.import').data).toBe(LEVEL_GLB_IMPORT);
    expect(LEVEL_GLB_IMPORT).toContain('import_script/path="res://mojulo/handoff_post_import.gd"');
    const H = JSON.parse(fileOf(files, 'mojulo/handoff.json').data);
    expect(H.level).toEqual(JSON.parse(JSON.stringify(h.level)));
    // (the room's lamps by their GLB node names: the importer lights them by this list)
    expect(H.lamps).toEqual(h.lamps);
    expect(H.lamps.length).toBeGreaterThan(0);
    // (every dressed face's material its height map, a file of the pack)
    const named = Object.entries(H.materials);
    expect(named.length).toBeGreaterThanOrEqual(Object.keys(h.materials).length);
    for (const [, m] of named) {
      expect(fileOf(files, m.height.replace('res://', ''))).toBeDefined();
      expect(m.depth).toBeGreaterThan(0);
    }
    expect(fileOf(files, 'mojulo/handoff_post_import.gd').data).toContain('extends EditorScenePostImport');
    // (the same handoff, the same pack)
    const again = handoffGodotFiles(h);
    expect(again.map((f) => f.file)).toEqual(files.map((f) => f.file));
    for (const [i, f] of files.entries()) expect(Buffer.from(again[i].data).equals(Buffer.from(f.data)), f.file).toBe(true);
  }, 300_000);

  it('a layered ground: its shader, its layers\' atlases imported as arrays, its dice and mask kept as written', async () => {
    const h = await resolveHandoff(TRAIL), files = handoffGodotFiles(h), H = JSON.parse(fileOf(files, 'mojulo/handoff.json').data);
    // (no room, no lamps: no list)
    expect(H.lamps).toBeUndefined();
    expect(H.terrain.parts).toEqual(h.instances.filter((x) => x.terrain).map((x) => x.name));
    expect(H.terrain.shader).toBe('res://mojulo/handoff_terrain.gdshader');
    expect(fileOf(files, 'mojulo/handoff_terrain.gdshader').data).toContain('shader_type spatial');
    for (const [k, res] of Object.entries(H.terrain.images)) {
      const f = res.replace('res://', '');
      expect(fileOf(files, f), k).toBeDefined();
      const imp = fileOf(files, `${f}.import`).data;
      // (an atlas a cell a layer, three by three; the rest read as written)
      if (['base', 'normal', 'orm'].includes(k)) {
        expect(imp).toContain('importer="2d_array_texture"');
        expect(imp).toContain(`slices/horizontal=${H.terrain.read.atlas.grid}`);
      } else expect(imp).toContain('importer="keep"');
    }
    expect(Object.keys(H.terrain.images)).toEqual(expect.arrayContaining(['base', 'normal', 'orm', 'dice', 'path']));
    // (the sea: its plane, its read, its depth map kept as written, its shader)
    expect(H.sea).toMatchObject({ part: 'form:sea', image: 'res://mojulo/terrain/sea_depth.png', shader: 'res://mojulo/handoff_sea.gdshader' });
    expect(fileOf(files, 'mojulo/terrain/sea_depth.png.import').data).toContain('importer="keep"');
    expect(fileOf(files, 'mojulo/handoff_sea.gdshader').data).toContain('shader_type spatial');
  }, 300_000);

  it('writes the developer\'s project and scene once, and mojulo/ whole every time', async () => {
    const h = await resolveHandoff(COUCH), dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-handoff-godot-'));
    const first = await writeHandoffGodot(h, dir);
    expect(first.written).toContain('level.tscn');
    expect(readFileSync(path.join(dir, 'level.tscn'), 'utf8')).toBe(LEVEL_TSCN);
    // (the developer wires their own nodes into level.tscn; a re-handoff keeps it)
    const mine = `${LEVEL_TSCN}\n[node name="MyDoorScript" type="Node" parent="."]\n`;
    writeFileSync(path.join(dir, 'level.tscn'), mine);
    writeFileSync(path.join(dir, 'mojulo', 'stale.png'), 'left over');
    const second = await writeHandoffGodot(h, dir);
    expect(second.kept).toEqual(['project.godot', 'level.tscn']);
    expect(readFileSync(path.join(dir, 'level.tscn'), 'utf8')).toBe(mine);
    expect(() => readFileSync(path.join(dir, 'mojulo', 'stale.png'))).toThrow();
  }, 120_000);

  it.skipIf(!GODOT)('in a headless Godot: imports, and the probe finds what the importer built (MOJULO_GODOT)', async () => {
    const h = await resolveHandoff(COUCH), dir = packDir('couch');
    await writeHandoffGodot(h, dir);
    const { line, log, errors } = probe(dir);
    expect(line, `${dir}\n${log}`).toBeTruthy();
    expect(line.ok, log).toBe(true);
    expect(errors).toEqual([]);
    expect(line.handoff).toBe(HANDOFF_GODOT_VERSION);
    expect(line.albedo).toBe(line.materials);
    expect(line.environment && line.ssao).toBe(true);
    expect(line.markers).toBe(h.level.markers.length);
    expect(line.seats).toBe(h.level.seats.rows.length);
    expect(line.bodies).toBeGreaterThan(0);
    // (no sun of its own: the default, casting shadows; the background its own colour; a camera current)
    expect(line.sun && line.sun_shadow && line.sun_default, log).toBe(true);
    expect(line.background, log).toBe(true);
    expect(line.camera, log).toBe(true);
    // (the cast: the hero its rigged figure with its clips, the second seat's body and the foe their meshes)
    expect(line.skins, log).toBeGreaterThan(0);
    expect(line.animated, log).toBeGreaterThan(0);
    expect(line.entity_meshes, log).toBe(2);
  }, 900_000);

  it.skipIf(!GODOT)('in a headless Godot: a dressed face\'s relief is its material\'s height map (MOJULO_GODOT)', async () => {
    const h = await resolveHandoff(BAY), dir = packDir('bay');
    await writeHandoffGodot(h, dir);
    const { line, log, errors } = probe(dir);
    expect(line?.ok, log).toBe(true);
    expect(errors).toEqual([]);
    expect(line.height, log).toBeGreaterThan(0);
    expect(line.normal, log).toBeGreaterThan(0);
    // (lit by its lamps: no sun; a camera current)
    expect(line.sun, log).toBe(false);
    expect(line.omni, log).toBeGreaterThan(0);
    // (the room's lamps found by handoff.json's list, every one, none by a name's substring)
    expect(h.lamps.length).toBeGreaterThan(0);
    expect(line.lamps, log).toBe(h.lamps.length);
    expect(line.camera, log).toBe(true);
  }, 900_000);

  it.skipIf(!GODOT)('in a headless Godot: the layered ground on its shader, its weights and layers bound, the sea on its own, under its sky (MOJULO_GODOT)', async () => {
    const h = await resolveHandoff(TRAIL), dir = packDir('trail');
    await writeHandoffGodot(h, dir);
    const { line, log, errors } = probe(dir), parts = h.instances.filter((x) => x.terrain).length;
    expect(line?.ok, log).toBe(true);
    expect(errors).toEqual([]);
    // (every layered part on the terrain shader, its corners' weights kept, every layer's slice, the trail's mask)
    expect(line.terrain, log).toBe(parts);
    expect(line.terrain_splat, log).toBe(parts);
    expect(line.terrain_layers, log).toBeGreaterThanOrEqual(h.instances.find((x) => x.terrain).terrain.read.atlas.cells.length);
    expect(line.terrain_path, log).toBe(true);
    // (the sea on its water shader, its depth bound; the cube's sky, its sun at the hour, its haze)
    expect(line.sea && line.sea_depth, log).toBe(true);
    expect(line.sky && line.sun && line.fog, log).toBe(true);
    expect(line.sun_default, log).toBe(false);
  }, 900_000);
});
