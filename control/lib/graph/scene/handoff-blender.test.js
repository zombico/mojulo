/**
 * The handoff's Blender adapter (scene/handoff-blender.js): a handoff as a folder whose importer builds level.blend. The
 * pack carries the GLB, the level record and each material's height map in handoff.json, the layered ground's layers each
 * its own image, the importer and the probe, the same bytes twice; mojulo/ is written whole every time and the artist's
 * level.blend beside it kept. With MOJULO_BLENDER (local, advisory: CI has no Blender job): the importer runs headless,
 * and the probe finds what it built in the saved .blend held to handoff.json (materials, markers, seats, the World, the
 * sun, the lamps, a camera, the terrain's and the sea's node trees bound), with no Python error in the log; a re-handoff
 * rebuilds mojulo's collections and keeps the artist's.
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { resolveHandoff } from './handoff.js';
import { handoffBlenderFiles, writeHandoffBlender, handoffFirePy, HANDOFF_BLENDER_VERSION, HANDOFF_BLEND } from './handoff-blender.js';
import { importerPy } from './blender-project.js';

const BLENDER = process.env.MOJULO_BLENDER;
// (MOJULO_HANDOFF_KEEP=<dir>: the Blender legs write their folders there, kept, to open in Blender and look at)
const KEEP = process.env.MOJULO_HANDOFF_KEEP;
const packDir = (name) => { if (!KEEP) return mkdtempSync(path.join(os.tmpdir(), `mojulo-handoff-blender-${name}-`)); const d = path.join(KEEP, `blender-${name}`); mkdirSync(d, { recursive: true }); return d; };
const box = { type: 'mesh', shape: 'box' };
const COUCH = { ref: 'sk_couch', title: 'couch', manifest: { kind: 'controllable', title: 'couch', faces: [{ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#a0b0c0', group: 'floor' }],
  figures: { hero: { hero: { cast: 'male', head: 'none', register: 'lowpoly' } } },
  entities: [{ id: 'p1', pilotable: true, rule: { type: 'walk' }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0.5] } }, { id: 'p2', pilotable: true, rule: { type: 'walk' }, body: box, transform: { pos: [3, 0, 0.5] } },
    { id: 'grunt', rule: { type: 'ai' }, body: box, transform: { pos: [6, 2, 0.5] } }],
  seats: { bodies: ['p2'], lives: 3 }, camera: { rule: 'side', target: 'p1', dist: 11 }, game: { levelRef: 'couch', mechanics: [{ kind: 'reach-exit', at: [8, 0, 0] }] } } };
const TRAIL = { ref: 'sk_trail', title: 'trail', manifest: { kind: 'geocube', cube: 'island-noon', show: 'trail', seed: 1 } };
const FIRE = { ref: 'sk_fire', title: 'fire', manifest: { kind: 'dungeon', fire: true, chambers: [{ id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 }, { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 }], tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }] } };
const BAY = { ref: 'sk_bay', title: 'bay', manifest: { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 8, h: 3.5 }] } };

const fileOf = (files, name) => files.find((f) => f.file === name);
const pngSize = (b) => [Buffer.from(b).readUInt32BE(16), Buffer.from(b).readUInt32BE(20)];
const glbJson = (bytes) => { const b = Buffer.from(bytes); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };

// (the importer, headless, over the folder; then the probe over the .blend it saved)
const blender = (args) => spawnSync(BLENDER, args, { encoding: 'utf8', timeout: 900000 });
const ERRORS = /Traceback \(most recent call last\)|\[mojulo-handoff\] ERROR|^Error: /;
const probe = (dir) => {
  const imp = blender(['-b', '--python', path.join(dir, 'mojulo', 'import_handoff.py')]);
  const run = blender(['-b', path.join(dir, HANDOFF_BLEND), '--python', path.join(dir, 'mojulo', 'handoff_probe.py')]);
  const all = `${imp.stdout}\n${imp.stderr}\n${run.stdout}\n${run.stderr}`;
  const line = `${run.stdout}\n${run.stderr}`.split('\n').find((l) => l.startsWith('[mojulo-handoff-probe] '));
  return { line: line ? JSON.parse(line.slice('[mojulo-handoff-probe] '.length)) : null, status: imp.status, errors: all.split('\n').filter((l) => ERRORS.test(l)), log: all.slice(-4000) };
};

describe('the handoff as a Blender folder', () => {
  it('carries the GLB, the level record and each dressed face\'s height, the importer and the probe, the same bytes twice', async () => {
    const h = await resolveHandoff(BAY), files = handoffBlenderFiles(h);
    expect(fileOf(files, 'mojulo/level.glb').data.equals(Buffer.from(h.exported.bytes))).toBe(true);
    const H = JSON.parse(fileOf(files, 'mojulo/handoff.json').data);
    expect(H.version).toBe(HANDOFF_BLENDER_VERSION);
    expect(H.level).toEqual(JSON.parse(JSON.stringify(h.level)));
    // (every dressed face's material its height map, a file of the pack, by the material's name in the GLB)
    const names = new Set(glbJson(h.exported.bytes).materials.map((m) => m.name));
    const named = Object.entries(H.materials);
    expect(named.length).toBeGreaterThanOrEqual(Object.keys(h.materials).length);
    for (const [name, m] of named) {
      expect(names.has(name), name).toBe(true);
      expect(fileOf(files, `mojulo/${m.height}`), m.height).toBeDefined();
      expect(m.depth).toBeGreaterThan(0);
    }
    expect(fileOf(files, 'mojulo/import_handoff.py').data).toContain('import handoff_nodes as N');
    expect(fileOf(files, 'mojulo/handoff_nodes.py').data).toContain('def terrain_group(');
    expect(fileOf(files, 'mojulo/handoff_probe.py').data).toContain('[mojulo-handoff-probe]');
    // (nothing outside mojulo/: the .blend is the importer's to write, and then the artist's)
    expect(files.every((f) => f.file.startsWith('mojulo/'))).toBe(true);
    const again = handoffBlenderFiles(h);
    expect(again.map((f) => f.file)).toEqual(files.map((f) => f.file));
    for (const [i, f] of files.entries()) expect(Buffer.from(again[i].data).equals(Buffer.from(f.data)), f.file).toBe(true);
  }, 300_000);

  it('a layered ground: each layer of its atlases its own image, its dice and mask as written; the sea\'s depth map', async () => {
    const h = await resolveHandoff(TRAIL), files = handoffBlenderFiles(h), H = JSON.parse(fileOf(files, 'mojulo/handoff.json').data);
    const parts = h.instances.filter((x) => x.terrain), T = parts[0].terrain;
    expect(H.terrain.parts).toEqual(parts.map((x) => x.name));
    expect(H.terrain.read).toEqual(JSON.parse(JSON.stringify(T.read)));
    for (const k of ['base', 'normal', 'orm']) {
      expect(H.terrain.layers[k]).toHaveLength(T.read.atlas.cells.length);
      // (a cell of the grid each: the atlas's width over its grid, square)
      const [W] = pngSize(Buffer.from(T.atlases[k].split(',')[1], 'base64'));
      for (const f of H.terrain.layers[k]) expect(pngSize(fileOf(files, `mojulo/${f}`).data), f).toEqual([W / T.read.atlas.grid, W / T.read.atlas.grid]);
    }
    for (const k of ['dice', 'path']) expect(fileOf(files, `mojulo/${H.terrain.images[k]}`).data.equals(Buffer.from(T.atlases[k].split(',')[1], 'base64')), k).toBe(true);
    expect(H.sea).toMatchObject({ part: 'form:sea', image: 'terrain/sea_depth.png' });
    expect(H.sea.read).not.toHaveProperty('depth');
    expect(fileOf(files, 'mojulo/terrain/sea_depth.png')).toBeDefined();
  }, 300_000);

  it('writes mojulo/ whole every time and keeps the artist\'s level.blend and files beside it', async () => {
    const h = await resolveHandoff(COUCH), dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-handoff-blender-'));
    const first = await writeHandoffBlender(h, dir);
    expect(first.kept).toEqual([]);
    expect(first.fire).toBeNull();
    expect(first.written).toContain('mojulo/handoff.json');
    // (the artist's .blend and their own files; a stale file of mojulo's)
    writeFileSync(path.join(dir, HANDOFF_BLEND), 'the artist\'s');
    writeFileSync(path.join(dir, 'notes.txt'), 'mine');
    writeFileSync(path.join(dir, 'mojulo', 'stale.png'), 'left over');
    const second = await writeHandoffBlender(h, dir);
    expect(second.kept).toEqual([HANDOFF_BLEND]);
    expect(readFileSync(path.join(dir, HANDOFF_BLEND), 'utf8')).toBe('the artist\'s');
    expect(readFileSync(path.join(dir, 'notes.txt'), 'utf8')).toBe('mine');
    expect(existsSync(path.join(dir, 'mojulo', 'stale.png'))).toBe(false);
  }, 120_000);

  it('a world\'s fire is built by the art pack\'s own fire builder', () => {
    const py = handoffFirePy(), src = importerPy();
    expect(py).toContain('def build_fire():');
    expect(py).toContain(src.slice(src.indexOf('# ---- fire ('), src.indexOf('\ndef render():')).trimEnd());
    expect(py).not.toContain('def render():');
  });

  it.skipIf(!BLENDER)('in a headless Blender: the couch\'s cast, markers and seats; a re-handoff keeps the artist\'s own (MOJULO_BLENDER)', async () => {
    const h = await resolveHandoff(COUCH), dir = packDir('couch');
    await writeHandoffBlender(h, dir);
    const { line, log, errors, status } = probe(dir);
    expect(line, `${dir}\n${log}`).toBeTruthy();
    expect(status, log).toBe(0);
    expect(errors, log).toEqual([]);
    expect(line.handoff).toBe(HANDOFF_BLENDER_VERSION);
    expect(line.level).toBe(true);
    expect(line.principled).toBe(line.materials);
    expect(line.vertex_colour, log).toBeGreaterThan(0);
    expect(line.markers).toBe(h.level.markers.length);
    expect(line.seats).toBe(h.level.seats.rows.length);
    expect(line.marker_records).toBe(line.markers + line.seats);
    // (no sun of its own: the default, its strength the record's; a World; a camera active; the page's tone)
    expect(line.sun && line.sun_default, log).toBe(true);
    expect(line.sun_strength).toBeCloseTo(h.level.environment.sun.intensity, 4);
    expect(line.world).toBe(true);
    expect(line.camera, log).toBeTruthy();
    expect(line.view_transform).toBe('Khronos PBR Neutral');
    // (the cast: the hero its rigged figure with its clips, the second seat's body and the foe their meshes)
    expect(line.armatures, log).toBeGreaterThan(0);
    expect(line.skinned, log).toBeGreaterThan(0);
    expect(line.actions, log).toBeGreaterThan(0);
    expect(line.entity_meshes, log).toBe(2);
    expect(line.artist).toBe(0);
    // (the artist adds their own collection and object to level.blend; a re-handoff rebuilds mojulo's and keeps theirs)
    const blend = path.join(dir, HANDOFF_BLEND);
    const mine = blender(['-b', blend, '--python-expr', 'import bpy\nc = bpy.data.collections.new("Mine")\nbpy.context.scene.collection.children.link(c)\no = bpy.data.objects.new("my_door", None)\nc.objects.link(o)\nbpy.ops.wm.save_mainfile()\n']);
    expect(mine.status, mine.stderr).toBe(0);
    const again = await writeHandoffBlender(h, dir);
    expect(again.kept).toEqual([HANDOFF_BLEND]);
    const re = probe(dir);
    expect(re.errors, re.log).toEqual([]);
    expect(re.line.artist, re.log).toBe(1);
    expect(re.line.objects).toBe(line.objects);
    expect(re.line.markers).toBe(line.markers);
  }, 900_000);

  it.skipIf(!BLENDER)('in a headless Blender: a dressed face\'s height under its normal map, the room lit by its lamps (MOJULO_BLENDER)', async () => {
    const h = await resolveHandoff(BAY), dir = packDir('bay');
    await writeHandoffBlender(h, dir);
    const { line, log, errors } = probe(dir);
    expect(line?.ok, log).toBe(true);
    expect(errors, log).toEqual([]);
    expect(line.height, log).toBeGreaterThan(0);
    expect(line.normal, log).toBeGreaterThan(0);
    expect(line.orm, log).toBeGreaterThan(0);
    // (lit by its lamps at the page's strength, 4π x each glTF intensity: no sun; its background, its haze)
    const lights = glbJson(h.exported.bytes).extensions.KHR_lights_punctual.lights;
    expect(line.sun, log).toBe(false);
    expect(line.points).toBe(lights.length);
    expect(line.point_energy).toBeCloseTo(lights.reduce((a, l) => a + 4 * Math.PI * l.intensity, 0), 1);
    expect(line.world && !line.sky, log).toBe(true);
    expect(line.haze).toBe(line.materials);
    expect(line.camera, log).toBeTruthy();
  }, 900_000);

  it.skipIf(!BLENDER)('in a headless Blender: the layered ground and the sea on their node trees, under the sky, sun and haze (MOJULO_BLENDER)', async () => {
    const h = await resolveHandoff(TRAIL), dir = packDir('trail');
    await writeHandoffBlender(h, dir);
    const { line, log, errors } = probe(dir), parts = h.instances.filter((x) => x.terrain);
    expect(line?.ok, log).toBe(true);
    expect(errors, log).toEqual([]);
    // (every layered part on the terrain's tree, its corners' weights kept, every layer's image, the trail's mask)
    expect(line.terrain, log).toBe(parts.length);
    expect(line.terrain_splat, log).toBe(parts.length);
    expect(line.terrain_layers, log).toBe(parts[0].terrain.read.atlas.cells.length);
    expect(line.terrain_path, log).toBe(true);
    // (the sea on its own, its depth bound, casting no shadow; the cube's sky, its sun at the hour, the solve's ambient)
    expect(line.sea, log).toBe(1);
    expect(line.sea_depth && line.sea_shadow === false, log).toBe(true);
    const env = h.level.environment;
    expect(line.sky && line.sun, log).toBe(true);
    expect(line.sun_default, log).toBe(false);
    expect(line.sun_strength).toBeCloseTo(env.sun.intensity, 4);
    line.ambient.forEach((v, i) => expect(v).toBeCloseTo(env.ambient[i], 4));
    expect(line.haze, log).toBe(line.materials);
    expect(line.camera, log).toBe(`cam:${h.level.markers.find((m) => m.kind === 'camera').name.slice('camera:'.length)}`);
  }, 900_000);

  it.skipIf(!BLENDER)('in a headless Blender: a world\'s fire at fire_t, by the art pack\'s builder, beside the level (MOJULO_BLENDER)', async () => {
    const h = await resolveHandoff(FIRE), dir = packDir('fire');
    const w = await writeHandoffBlender(h, dir, { sketch: FIRE, fireT: 4 });
    expect(w.fire).toMatchObject({ t: 4, fires: 4 });
    const { line, log, errors } = probe(dir);
    expect(line?.ok, log).toBe(true);
    expect(errors, log).toEqual([]);
    // (its flames and smoke as volumes, a light per fire; the level's own World and camera kept over the fire's)
    expect(line.fire.volumes, log).toBeGreaterThanOrEqual(w.fire.flamelets);
    expect(line.fire.lights, log).toBe(w.fire.fires);
    expect(line.world).toBe(true);
    expect(line.camera).not.toBe('Fire');
  }, 900_000);
});
