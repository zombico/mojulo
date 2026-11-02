/**
 * The handoff's Unreal adapter (scene/handoff-unreal.js): a handoff as an Unreal Engine 5 project. The pack carries the
 * GLB, the level record and each material's height map in handoff.json, the layered ground's layers each its own image,
 * a white sky for the SkyLight, the page's fragments as HLSL, the importer, the probe and the render script, the same
 * bytes twice; mojulo/ is written whole every time and the developer's project files kept. With MOJULO_UNREAL (the
 * UnrealEditor-Cmd binary; local and advisory: CI has no Unreal job): the importer runs headless and the probe finds what
 * it built in the developer's level held to handoff.json (materials, markers, seats, the sun, the lamps, the ambient,
 * the tone and haze, a camera, the terrain's and the sea's materials bound, collision), with no Python, importer or
 * shader error in the log; a re-handoff rebuilds mojulo's sublevel and keeps what the developer added to theirs.
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { resolveHandoff } from './handoff.js';
import { handoffUnrealFiles, writeHandoffUnreal, whiteHdr, HANDOFF_UNREAL_VERSION, HANDOFF_UPROJECT, HANDOFF_UNREAL_PATHS, HANDOFF_UNREAL_INI } from './handoff-unreal.js';

const UNREAL = process.env.MOJULO_UNREAL;
// (MOJULO_HANDOFF_KEEP=<dir>: the Unreal legs write their projects there, kept, to open in the editor and look at)
const KEEP = process.env.MOJULO_HANDOFF_KEEP;
const packDir = (name) => { if (!KEEP) return mkdtempSync(path.join(os.tmpdir(), `mojulo-handoff-unreal-${name}-`)); const d = path.join(KEEP, `unreal-${name}`); mkdirSync(d, { recursive: true }); return d; };
const box = { type: 'mesh', shape: 'box' };
const COUCH = { ref: 'sk_couch', title: 'couch', manifest: { kind: 'controllable', title: 'couch', faces: [{ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#a0b0c0', group: 'floor' }],
  figures: { hero: { hero: { cast: 'male', head: 'none', register: 'lowpoly' } } },
  entities: [{ id: 'p1', pilotable: true, rule: { type: 'walk' }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0.5] } }, { id: 'p2', pilotable: true, rule: { type: 'walk' }, body: box, transform: { pos: [3, 0, 0.5] } },
    { id: 'grunt', rule: { type: 'ai' }, body: box, transform: { pos: [6, 2, 0.5] } }],
  seats: { bodies: ['p2'], lives: 3 }, camera: { rule: 'side', target: 'p1', dist: 11 }, game: { levelRef: 'couch', mechanics: [{ kind: 'reach-exit', at: [8, 0, 0] }] } } };
const TRAIL = { ref: 'sk_trail', title: 'trail', manifest: { kind: 'geocube', cube: 'island-noon', show: 'trail', seed: 1 } };
const BAY = { ref: 'sk_bay', title: 'bay', manifest: { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 8, h: 3.5 }] } };

const fileOf = (files, name) => files.find((f) => f.file === name);
const pngSize = (b) => [Buffer.from(b).readUInt32BE(16), Buffer.from(b).readUInt32BE(20)];
const glbJson = (bytes) => { const b = Buffer.from(bytes); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
// (the materials whose every primitive carries COLOR_0: the ones the importer switches the vertex colour in on)
const coloured = (h) => {
  const j = glbJson(h.exported.bytes), on = new Map();
  for (const m of j.meshes ?? []) for (const p of m.primitives) if (Number.isInteger(p.material)) on.set(p.material, (on.get(p.material) ?? true) && 'COLOR_0' in p.attributes);
  return [...on.values()].filter(Boolean).length;
};
const lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

// (Unreal headless over the pack: the importer, then the probe, each its own editor; their logs read back)
const unreal = (dir, script, extra = []) => {
  const log = path.join(dir, `${path.basename(script, '.py')}.log`);
  const r = spawnSync(UNREAL, [path.join(dir, HANDOFF_UPROJECT), '-run=pythonscript', `-script=${script}`, '-unattended', '-nosplash', ...extra, `-abslog=${log}`], { encoding: 'utf8', timeout: 1_800_000 });
  return { status: r.status, text: existsSync(log) ? readFileSync(log, 'utf8') : `${r.stdout}\n${r.stderr}` };
};
const ERRORS = /LogPython: Error|\[mojulo-handoff\] ERROR|Material\.ush:\d+:\d+: error|Failed to compile Material/;
const importer = (dir) => unreal(dir, path.join(dir, 'mojulo', 'import_handoff.py'), ['-AllowCommandletRendering', '-RenderOffscreen']);
const probe = (dir) => {
  const imp = importer(dir);
  const run = unreal(dir, path.join(dir, 'mojulo', 'handoff_probe.py'), ['-nullrhi']);
  const all = `${imp.text}\n${run.text}`;
  const line = run.text.split('\n').find((l) => l.includes('LogPython: [mojulo-handoff-probe] '));
  return { line: line ? JSON.parse(line.slice(line.indexOf('[mojulo-handoff-probe] ') + '[mojulo-handoff-probe] '.length)) : null, status: imp.status,
    errors: all.split('\n').filter((l) => ERRORS.test(l)), log: all.split('\n').filter((l) => /mojulo-handoff|Error/.test(l)).slice(-60).join('\n') };
};

describe('the handoff as an Unreal project', () => {
  it('carries the GLB, the level record and each dressed face\'s height, the importer, probe and HLSL, the same bytes twice', async () => {
    const h = await resolveHandoff(BAY), files = handoffUnrealFiles(h);
    expect(fileOf(files, 'mojulo/level.glb').data.equals(Buffer.from(h.exported.bytes))).toBe(true);
    const H = JSON.parse(fileOf(files, 'mojulo/handoff.json').data);
    expect(H.version).toBe(HANDOFF_UNREAL_VERSION);
    expect(H.paths).toEqual(HANDOFF_UNREAL_PATHS);
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
    expect(fileOf(files, 'mojulo/import_handoff.py').data).toContain('def build():');
    expect(fileOf(files, 'mojulo/handoff_probe.py').data).toContain('[mojulo-handoff-probe]');
    expect(fileOf(files, 'mojulo/handoff_render.py').data).toContain('take_high_res_screenshot');
    expect(fileOf(files, 'mojulo/handoff_tone.hlsl').data).toContain('0.76');
    expect(fileOf(files, 'mojulo/handoff_sky.hlsl')).toBeDefined();
    // (a room without land: no ground or sea to port)
    expect(fileOf(files, 'mojulo/handoff_terrain.hlsl')).toBeUndefined();
    expect(fileOf(files, 'mojulo/handoff_sea.hlsl')).toBeUndefined();
    // (the developer's project files, written once; the rest is mojulo's folder)
    expect(files.filter((f) => f.keep).map((f) => f.file)).toEqual([HANDOFF_UPROJECT, 'Config/DefaultEngine.ini']);
    expect(files.filter((f) => !f.keep).every((f) => f.file.startsWith('mojulo/'))).toBe(true);
    expect(JSON.parse(fileOf(files, HANDOFF_UPROJECT).data).Plugins.map((p) => p.Name)).toEqual(['PythonScriptPlugin', 'Interchange']);
    expect(fileOf(files, 'Config/DefaultEngine.ini').data).toBe(HANDOFF_UNREAL_INI);
    const again = handoffUnrealFiles(h);
    expect(again.map((f) => f.file)).toEqual(files.map((f) => f.file));
    for (const [i, f] of files.entries()) expect(Buffer.from(again[i].data).equals(Buffer.from(f.data)), f.file).toBe(true);
  }, 300_000);

  it('a layered ground: each layer of its atlases its own image, its dice and mask as written; the sea\'s depth map', async () => {
    const h = await resolveHandoff(TRAIL), files = handoffUnrealFiles(h), H = JSON.parse(fileOf(files, 'mojulo/handoff.json').data);
    const parts = h.instances.filter((x) => x.terrain), T = parts[0].terrain;
    expect(H.terrain.parts).toEqual(parts.map((x) => x.name));
    expect(H.terrain.read).toEqual(JSON.parse(JSON.stringify(T.read)));
    expect(H.terrain.hlsl).toBe('handoff_terrain.hlsl');
    for (const k of ['base', 'normal', 'orm']) {
      // (a slice of the importer's Texture2DArray each: a cell of the atlas, square)
      expect(H.terrain.layers[k]).toHaveLength(T.read.atlas.cells.length);
      const [W] = pngSize(Buffer.from(T.atlases[k].split(',')[1], 'base64'));
      for (const f of H.terrain.layers[k]) expect(pngSize(fileOf(files, `mojulo/${f}`).data), f).toEqual([W / T.read.atlas.grid, W / T.read.atlas.grid]);
    }
    for (const k of ['dice', 'path']) expect(fileOf(files, `mojulo/${H.terrain.images[k]}`).data.equals(Buffer.from(T.atlases[k].split(',')[1], 'base64')), k).toBe(true);
    expect(H.sea).toMatchObject({ part: 'form:sea', image: 'terrain/sea_depth.png', hlsl: 'handoff_sea.hlsl' });
    expect(H.sea.read).not.toHaveProperty('depth');
    for (const f of ['mojulo/terrain/sea_depth.png', 'mojulo/handoff_terrain.hlsl', 'mojulo/handoff_sea.hlsl']) expect(fileOf(files, f), f).toBeDefined();
  }, 300_000);

  it('a white sky for the SkyLight: every texel 1.0 (RGBE 128, 128, 128, 129), run-length scanlines', () => {
    const b = whiteHdr(), head = '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 32 +X 64\n';
    expect(b.subarray(0, head.length).toString('latin1')).toBe(head);
    const row = b.subarray(head.length, head.length + 12);
    expect([...row]).toEqual([2, 2, 0, 64, 192, 128, 192, 128, 192, 128, 192, 129]);
    expect(b.length).toBe(head.length + 32 * 12);
  });

  it('writes mojulo/ whole every time and keeps the developer\'s project files', async () => {
    const h = await resolveHandoff(COUCH), dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-handoff-unreal-'));
    const first = await writeHandoffUnreal(h, dir);
    expect(first.kept).toEqual([]);
    expect(first.written).toContain(HANDOFF_UPROJECT);
    // (the developer's project, their config and their own files; a stale file of mojulo's)
    writeFileSync(path.join(dir, HANDOFF_UPROJECT), '{"mine":true}');
    writeFileSync(path.join(dir, 'Config', 'DefaultEngine.ini'), '; mine');
    mkdirSync(path.join(dir, 'Content'), { recursive: true });
    writeFileSync(path.join(dir, 'Content', 'Level.umap'), 'theirs');
    writeFileSync(path.join(dir, 'mojulo', 'stale.png'), 'left over');
    const second = await writeHandoffUnreal(h, dir);
    expect(second.kept).toEqual([HANDOFF_UPROJECT, 'Config/DefaultEngine.ini']);
    expect(readFileSync(path.join(dir, HANDOFF_UPROJECT), 'utf8')).toBe('{"mine":true}');
    expect(readFileSync(path.join(dir, 'Config', 'DefaultEngine.ini'), 'utf8')).toBe('; mine');
    expect(readFileSync(path.join(dir, 'Content', 'Level.umap'), 'utf8')).toBe('theirs');
    expect(existsSync(path.join(dir, 'mojulo', 'stale.png'))).toBe(false);
  }, 120_000);

  it.skipIf(!UNREAL)('in a headless Unreal: the couch\'s cast, markers and seats; a re-handoff keeps the developer\'s own (MOJULO_UNREAL)', async () => {
    const h = await resolveHandoff(COUCH), dir = packDir('couch');
    await writeHandoffUnreal(h, dir);
    const { line, log, errors, status } = probe(dir);
    expect(line, `${dir}\n${log}`).toBeTruthy();
    expect(status, log).toBe(0);
    expect(errors, log).toEqual([]);
    expect(line.ok, log).toBe(true);
    expect(line.handoff).toBe(HANDOFF_UNREAL_VERSION);
    expect(line.level && line.streamed, log).toBe(true);
    // (every slot on mojulo's lit master, its vertex colour as base where every primitive on it carries COLOR_0)
    expect(line.materials, log).toBeGreaterThan(0);
    expect(line.lit + line.translucent).toBe(line.materials);
    expect(line.vertex_colour).toBe(coloured(h));
    expect(line.markers).toBe(h.level.markers.length);
    expect(line.seats).toBe(h.level.seats.rows.length);
    // (each marker and seat its record, and the seats' own)
    expect(line.marker_records).toBe(line.markers + line.seats + 1);
    // (no sun of its own: the default, its lux the record's; the ambient the background's, as Blender's World; the tone)
    expect(line.sun && line.sun_default && line.sun_shadow, log).toBe(true);
    expect(line.sun_lux).toBeCloseTo(h.level.environment.sun.intensity, 4);
    lin(h.level.environment.background).forEach((v, i) => expect(Math.abs(line.ambient[i] - v), 'ambient').toBeLessThan(0.002));
    expect(line.tone && line.exposure_manual, log).toBe(true);
    expect(line.haze).toBeNull();
    expect(line.cameras).toBe(h.level.markers.filter((m) => m.kind === 'camera').length);
    // (the cast: the hero its skeletal mesh with its clips, the second seat's body and the foe their meshes)
    expect(line.skeletal, log).toBeGreaterThan(0);
    expect(line.anims, log).toBeGreaterThan(0);
    expect(line.entity_meshes, log).toBe(2);
    expect(line.blocking, log).toBeGreaterThan(0);
    expect(line.developer).toBe(0);
    // (the developer adds an actor to their level; a re-handoff rebuilds mojulo's sublevel and keeps theirs)
    const mine = path.join(dir, 'mine.py');
    writeFileSync(mine, `import unreal\nunreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level('${HANDOFF_UNREAL_PATHS.map}')\na = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).spawn_actor_from_class(unreal.TargetPoint, unreal.Vector(0, 0, 0))\na.set_actor_label('my_door')\nunreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()\n`);
    const add = unreal(dir, mine, ['-nullrhi']);
    expect(add.status, add.text.slice(-2000)).toBe(0);
    await writeHandoffUnreal(h, dir);
    const re = probe(dir);
    expect(re.errors, re.log).toEqual([]);
    expect(re.line.developer, re.log).toBe(1);
    expect(re.line.objects).toBe(line.objects);
    expect(re.line.markers).toBe(line.markers);
    expect(re.line.streamed).toBe(true);
  }, 3_600_000);

  it.skipIf(!UNREAL)('in a headless Unreal: a dressed face\'s normal, ORM and height; the room lit by its lamps (MOJULO_UNREAL)', async () => {
    const h = await resolveHandoff(BAY), dir = packDir('bay');
    await writeHandoffUnreal(h, dir);
    const { line, log, errors } = probe(dir);
    expect(line?.ok, log).toBe(true);
    expect(errors, log).toEqual([]);
    expect(line.normal, log).toBeGreaterThan(0);
    expect(line.orm, log).toBeGreaterThan(0);
    expect(line.height, log).toBeGreaterThan(0);
    expect(line.height_ratio).toBe(0);
    // (lit by its lamps at the page's strength, the glTF intensity in candela: no sun; the solve's ambient)
    const lights = glbJson(h.exported.bytes).extensions.KHR_lights_punctual.lights;
    expect(line.sun, log).toBe(false);
    expect(line.points).toBe(lights.length);
    // (the room's lamps found by handoff.json's list: every one unshadowed)
    expect(line.lamps, log).toBe(h.lamps.length);
    expect(line.point_cd).toBeCloseTo(lights.reduce((a, l) => a + l.intensity, 0), 2);
    h.level.environment.ambient.forEach((v, i) => expect(Math.abs(line.ambient[i] - v), 'ambient').toBeLessThan(Math.max(0.002, v * 0.02)));
    // (what is see-through takes no collision: the bay's sun patch, panes and wiring)
    expect(line.no_collision, log).toBeGreaterThan(0);
    expect(line.cameras).toBeGreaterThan(0);
  }, 3_600_000);

  it.skipIf(!UNREAL)('in a headless Unreal: the layered ground and the sea on their materials, under the sky, sun and haze (MOJULO_UNREAL)', async () => {
    const h = await resolveHandoff(TRAIL), dir = packDir('trail');
    await writeHandoffUnreal(h, dir);
    const { line, log, errors } = probe(dir), parts = h.instances.filter((x) => x.terrain);
    expect(line?.ok, log).toBe(true);
    expect(errors, log).toEqual([]);
    // (every layered part on the terrain's material, every layer a slice of its arrays, the trail's mask)
    expect(line.terrain, log).toBe(parts.length);
    expect(line.terrain_layers, log).toBe(parts[0].terrain.read.atlas.cells.length);
    expect(line.terrain_path, log).toBe(true);
    // (the sea on its own, its depth bound, casting no shadow and taking no collision; the cube's sky, its sun at the
    // hour, the solve's ambient, the haze)
    expect(line.sea, log).toBe(1);
    expect(line.sea_depth && line.sea_shadow === false, log).toBe(true);
    const env = h.level.environment;
    expect(line.sky && line.sun, log).toBe(true);
    expect(line.sun_default, log).toBe(false);
    expect(line.sun_lux).toBeCloseTo(env.sun.intensity, 4);
    env.ambient.forEach((v, i) => expect(Math.abs(line.ambient[i] - v), 'ambient').toBeLessThan(Math.max(0.002, v * 0.02)));
    expect(line.haze).toBeCloseTo(env.haze.density, 5);
    // (the stones and plants take no collision; the land blocks)
    expect(line.no_collision, log).toBeGreaterThan(0);
    expect(line.blocking, log).toBeGreaterThan(0);
    expect(line.cameras).toBe(h.level.markers.filter((m) => m.kind === 'camera').length);
    // (a still from the island's camera, offscreen in the full editor: it is drawn, not blank)
    const shots = path.join(dir, 'shots.json'), out = path.join(dir, 'island.png');
    const cam = h.level.markers.find((m) => m.kind === 'camera');
    writeFileSync(shots, JSON.stringify({ settle: 15, shots: [{ out, w: 320, h: 180, at: cam.at, look: cam.look, yfov: cam.yfov }] }));
    const ed = UNREAL.replace(/-Cmd$/, '');
    spawnSync(ed, [path.join(dir, HANDOFF_UPROJECT), '-RenderOffscreen', '-unattended', '-nosplash', '-nosound', `-ExecCmds=py ${path.join(dir, 'mojulo', 'handoff_render.py')}`, `-abslog=${path.join(dir, 'render.log')}`],
      { encoding: 'utf8', timeout: 1_800_000, env: { ...process.env, MOJULO_SHOTS: shots } });
    expect(existsSync(out), readFileSync(path.join(dir, 'render.log'), 'utf8').split('\n').filter((l) => /mojulo-handoff-render|Error/.test(l)).join('\n')).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(20_000);
  }, 3_600_000);
});
