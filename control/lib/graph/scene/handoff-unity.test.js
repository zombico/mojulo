/**
 * The handoff's Unity adapter (scene/handoff-unity.js): a handoff as a Unity 6 project (URP, glTFast). The pack carries
 * the GLB, the level record and each material's height map in handoff.json, the layered ground's layers each its own
 * image, the importer, the probe, the records' components and the page's fragments as URP shaders, every asset its .meta
 * by its path, the same bytes twice; Assets/Mojulo/ is written whole every time and the developer's packages, settings
 * and files kept. With MOJULO_UNITY (the Unity editor binary; local and advisory: CI has no Unity job): the importer runs
 * in batchmode and the probe finds what it built held to handoff.json (materials, markers, seats, the sun, the lamps, the
 * ambient, the tone and haze, a camera, the terrain's and the sea's materials bound, collision, the rigged hero's clips),
 * with no compile, shader, importer error or exception in the log; a re-handoff rebuilds mojulo's scene and keeps what
 * the developer added to theirs. The legs share one project (each handoff replaces Assets/Mojulo/ whole: the re-handoff
 * rule the couch's leg holds), so Unity resolves its packages once.
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { resolveHandoff } from './handoff.js';
import { handoffUnityFiles, writeHandoffUnity, unityGuid, HANDOFF_UNITY_VERSION, HANDOFF_UNITY_PATHS, HANDOFF_UNITY_PACKAGES, HANDOFF_UNITY_SOURCES } from './handoff-unity.js';

const UNITY = process.env.MOJULO_UNITY;
// (MOJULO_HANDOFF_KEEP=<dir>: the Unity legs write their project there, kept, to open in the editor and look at)
const KEEP = process.env.MOJULO_HANDOFF_KEEP;
const box = { type: 'mesh', shape: 'box' };
const COUCH = { ref: 'sk_couch', title: 'couch', manifest: { kind: 'controllable', title: 'couch', faces: [{ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#a0b0c0', group: 'floor' }],
  figures: { hero: { hero: { cast: 'male', head: 'none', register: 'lowpoly' } } },
  entities: [{ id: 'p1', pilotable: true, rule: { type: 'walk' }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0.5] } }, { id: 'p2', pilotable: true, rule: { type: 'walk' }, body: box, transform: { pos: [3, 0, 0.5] } },
    { id: 'grunt', rule: { type: 'ai' }, body: box, transform: { pos: [6, 2, 0.5] } }],
  seats: { bodies: ['p2'], lives: 3 }, camera: { rule: 'side', target: 'p1', dist: 11 }, game: { levelRef: 'couch', mechanics: [{ kind: 'reach-exit', at: [8, 0, 0] }] } } };
const TRAIL = { ref: 'sk_trail', title: 'trail', manifest: { kind: 'geocube', cube: 'island-noon', show: 'trail', seed: 1 } };
const BAY = { ref: 'sk_bay', title: 'bay', manifest: { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 8, h: 3.5 }] } };

const R = HANDOFF_UNITY_PATHS.root;
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

// (Unity in batchmode over the project: one editor per method, its log read back)
const unity = (dir, method, env = {}) => {
  mkdirSync(path.join(dir, 'Logs'), { recursive: true });
  const log = path.join(dir, 'Logs', `mojulo-${method.split('.').pop().toLowerCase()}.log`);
  const r = spawnSync(UNITY, ['-batchmode', '-projectPath', dir, '-executeMethod', method, '-quit', '-logFile', log], { encoding: 'utf8', timeout: 1_800_000, env: { ...process.env, ...env } });
  return { status: r.status, text: existsSync(log) ? readFileSync(log, 'utf8') : `${r.stdout}\n${r.stderr}` };
};
// (a C# compile error, a shader of mojulo's that fails, the importer's mark, an exception thrown)
const ERRORS = /\[mojulo-handoff\] ERROR|error CS\d{4}|Shader error in 'Mojulo|Scripts have compiler errors|(NullReference|MissingReference|InvalidOperation|Argument|IndexOutOfRange|InvalidCast|KeyNotFound)Exception/;
const probe = (dir) => {
  const imp = unity(dir, 'Mojulo.Handoff.Import.Run');
  const run = unity(dir, 'Mojulo.Handoff.Probe.Run');
  const all = `${imp.text}\n${run.text}`;
  const line = run.text.split('\n').find((l) => l.startsWith('[mojulo-handoff-probe] '));
  return { line: line ? JSON.parse(line.slice('[mojulo-handoff-probe] '.length)) : null, status: imp.status,
    errors: all.split('\n').filter((l) => ERRORS.test(l)), log: all.split('\n').filter((l) => /mojulo-handoff|error|Exception/i.test(l) && !/ValidationExceptions|Licensing/.test(l)).slice(-60).join('\n') };
};
// (one project for the legs: Unity resolves its packages and compiles once; each handoff replaces Assets/Mojulo/)
let project = null;
const shared = () => {
  if (project) return project;
  project = KEEP ? path.join(KEEP, 'unity') : mkdtempSync(path.join(os.tmpdir(), 'mojulo-handoff-unity-'));
  mkdirSync(project, { recursive: true });
  return project;
};

describe('the handoff as a Unity project', () => {
  it('carries the GLB, the level record and each dressed face\'s height, the importer, probe, records and shaders, the same bytes twice', async () => {
    const h = await resolveHandoff(BAY), files = handoffUnityFiles(h);
    expect(fileOf(files, `${R}/level.glb`).data.equals(Buffer.from(h.exported.bytes))).toBe(true);
    const H = JSON.parse(fileOf(files, `${R}/handoff.json`).data);
    expect(H.version).toBe(HANDOFF_UNITY_VERSION);
    expect(H.paths).toEqual(HANDOFF_UNITY_PATHS);
    expect(H.level).toEqual(JSON.parse(JSON.stringify(h.level)));
    // (every dressed face's material its height map, a file of the pack Unity does not import, by the material's name)
    const names = new Set(glbJson(h.exported.bytes).materials.map((m) => m.name));
    const named = Object.entries(H.materials);
    expect(named.length).toBeGreaterThanOrEqual(Object.keys(h.materials).length);
    for (const [name, m] of named) {
      expect(names.has(name), name).toBe(true);
      expect(m.height, name).toMatch(/^Data~\//);
      expect(fileOf(files, `${R}/${m.height}`), m.height).toBeDefined();
      expect(m.depth).toBeGreaterThan(0);
    }
    for (const dest of Object.values(HANDOFF_UNITY_SOURCES)) expect(fileOf(files, `${R}/${dest}`), dest).toBeDefined();
    expect(fileOf(files, `${R}/Editor/MojuloImport.cs`).data).toContain('public static void Run()');
    expect(fileOf(files, `${R}/Editor/MojuloProbe.cs`).data).toContain('[mojulo-handoff-probe] ');
    expect(fileOf(files, `${R}/Shaders/MojuloTone.shader`).data).toContain('0.76');
    expect(fileOf(files, `${R}/Shaders/MojuloTerrain.hlsl`).data).toContain('void MojuloTerrain(');
    // (every asset Unity imports its .meta, its GUID from its path: a script's, a shader's, a material's hold across handoffs)
    for (const f of files.filter((x) => !x.keep && !x.file.endsWith('.meta') && !x.file.includes('/Data~/'))) {
      const meta = fileOf(files, `${f.file}.meta`);
      expect(meta, f.file).toBeDefined();
      expect(meta.data).toBe(`fileFormatVersion: 2\nguid: ${unityGuid(f.file)}\n`);
    }
    for (const dir of [R, `${R}/Editor`, `${R}/Runtime`, `${R}/Shaders`]) expect(fileOf(files, `${dir}.meta`).data, dir).toContain('folderAsset: yes');
    expect(fileOf(files, `${R}/Shaders/MojuloSky.mat`).data).toContain(`guid: ${unityGuid(`${R}/Shaders/MojuloSky.shader`)}`);
    expect(new Set(files.filter((f) => f.file.endsWith('.meta')).map((f) => f.data)).size).toBe(files.filter((f) => f.file.endsWith('.meta')).length);
    // (the developer's project files, written once: URP and glTFast, the linear colour space; the rest is mojulo's folder)
    expect(files.filter((f) => f.keep).map((f) => f.file)).toEqual(['Packages/manifest.json', 'ProjectSettings/ProjectVersion.txt', 'ProjectSettings/ProjectSettings.asset']);
    expect(files.filter((f) => !f.keep).every((f) => f.file === `${R}.meta` || f.file.startsWith(`${R}/`))).toBe(true);
    expect(JSON.parse(fileOf(files, 'Packages/manifest.json').data).dependencies).toEqual(HANDOFF_UNITY_PACKAGES);
    expect(fileOf(files, 'ProjectSettings/ProjectSettings.asset').data).toContain('m_ActiveColorSpace: 1');
    // (a room without land: no ground or sea in handoff.json)
    expect(H.terrain).toBeUndefined();
    expect(H.sea).toBeUndefined();
    const again = handoffUnityFiles(h);
    expect(again.map((f) => f.file)).toEqual(files.map((f) => f.file));
    for (const [i, f] of files.entries()) expect(Buffer.from(again[i].data).equals(Buffer.from(f.data)), f.file).toBe(true);
  }, 300_000);

  it('a layered ground: each layer of its atlases its own image, its dice and mask as written; the sea\'s depth map', async () => {
    const h = await resolveHandoff(TRAIL), files = handoffUnityFiles(h), H = JSON.parse(fileOf(files, `${R}/handoff.json`).data);
    const parts = h.instances.filter((x) => x.terrain), T = parts[0].terrain;
    expect(H.terrain.parts).toEqual(parts.map((x) => x.name));
    expect(H.terrain.read).toEqual(JSON.parse(JSON.stringify(T.read)));
    expect(H.terrain.shader).toBe('Mojulo/Terrain');
    for (const k of ['base', 'normal', 'orm']) {
      // (a slice of the importer's Texture2DArray each: a cell of the atlas, square)
      expect(H.terrain.layers[k]).toHaveLength(T.read.atlas.cells.length);
      const [W] = pngSize(Buffer.from(T.atlases[k].split(',')[1], 'base64'));
      for (const f of H.terrain.layers[k]) expect(pngSize(fileOf(files, `${R}/${f}`).data), f).toEqual([W / T.read.atlas.grid, W / T.read.atlas.grid]);
    }
    for (const k of ['dice', 'path']) expect(fileOf(files, `${R}/${H.terrain.images[k]}`).data.equals(Buffer.from(T.atlases[k].split(',')[1], 'base64')), k).toBe(true);
    expect(H.sea).toMatchObject({ part: 'form:sea', image: 'Data~/terrain/sea_depth.png', shader: 'Mojulo/Sea' });
    expect(H.sea.read).not.toHaveProperty('depth');
    expect(fileOf(files, `${R}/Data~/terrain/sea_depth.png`)).toBeDefined();
  }, 300_000);

  it('writes Assets/Mojulo/ whole every time and keeps the developer\'s packages, settings, scene and files', async () => {
    const h = await resolveHandoff(COUCH), dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-handoff-unity-pack-'));
    const first = await writeHandoffUnity(h, dir);
    expect(first.kept).toEqual([]);
    expect(first.written).toContain('Packages/manifest.json');
    // (the developer's packages, their settings, their scene and scripts; a stale file and a built scene of mojulo's)
    writeFileSync(path.join(dir, 'Packages', 'manifest.json'), '{"dependencies":{"mine":"1.0.0"}}');
    writeFileSync(path.join(dir, 'ProjectSettings', 'ProjectSettings.asset'), 'mine');
    mkdirSync(path.join(dir, 'Assets', 'Scenes'), { recursive: true });
    writeFileSync(path.join(dir, 'Assets', 'Scenes', 'Level.unity'), 'theirs');
    mkdirSync(path.join(dir, 'Assets', 'Developer'), { recursive: true });
    writeFileSync(path.join(dir, 'Assets', 'Developer', 'Door.cs'), 'theirs');
    mkdirSync(path.join(dir, R, 'Built'), { recursive: true });
    writeFileSync(path.join(dir, R, 'Built', 'Level_Mojulo.unity'), 'built');
    writeFileSync(path.join(dir, R, 'stale.png'), 'left over');
    const second = await writeHandoffUnity(h, dir);
    expect(second.kept).toEqual(['Packages/manifest.json', 'ProjectSettings/ProjectVersion.txt', 'ProjectSettings/ProjectSettings.asset']);
    expect(readFileSync(path.join(dir, 'Packages', 'manifest.json'), 'utf8')).toBe('{"dependencies":{"mine":"1.0.0"}}');
    expect(readFileSync(path.join(dir, 'ProjectSettings', 'ProjectSettings.asset'), 'utf8')).toBe('mine');
    expect(readFileSync(path.join(dir, 'Assets', 'Scenes', 'Level.unity'), 'utf8')).toBe('theirs');
    expect(readFileSync(path.join(dir, 'Assets', 'Developer', 'Door.cs'), 'utf8')).toBe('theirs');
    expect(existsSync(path.join(dir, R, 'stale.png'))).toBe(false);
    expect(existsSync(path.join(dir, R, 'Built'))).toBe(false);
  }, 120_000);

  it.skipIf(!UNITY)('in a batchmode Unity: the couch\'s cast, markers and seats; a re-handoff keeps the developer\'s own (MOJULO_UNITY)', async () => {
    const h = await resolveHandoff(COUCH), dir = shared();
    await writeHandoffUnity(h, dir);
    const { line, log, errors, status } = probe(dir);
    expect(line, `${dir}\n${log}`).toBeTruthy();
    expect(status, log).toBe(0);
    expect(errors, log).toEqual([]);
    expect(line.ok, log).toBe(true);
    expect(line.handoff).toBe(HANDOFF_UNITY_VERSION);
    expect(line.colour_space).toBe('Linear');
    expect(line.level && line.record && line.streamed, log).toBe(true);
    // (every slot on mojulo's lit shader, its vertex colour as base where every primitive on it carries COLOR_0)
    expect(line.materials, log).toBeGreaterThan(0);
    expect(line.lit + line.translucent).toBe(line.materials);
    expect(line.other_materials).toBe(0);
    expect(line.vertex_colour).toBe(coloured(h));
    expect(line.markers).toBe(h.level.markers.length);
    expect(line.seats).toBe(h.level.seats.rows.length);
    // (each marker and seat its record, and the seats' own)
    expect(line.marker_records).toBe(line.markers + line.seats + 1);
    // (no sun of its own: the default, at the record's intensity / pi; the ambient the background's; the tone; no haze)
    expect(line.sun && line.sun_default && line.sun_shadow, log).toBe(true);
    expect(line.sun_intensity).toBeCloseTo(h.level.environment.sun.intensity / Math.PI, 4);
    lin(h.level.environment.background).forEach((v, i) => expect(Math.abs(line.ambient[i] - v), 'ambient').toBeLessThan(0.002));
    expect(line.ambient_flat && line.sky && line.reflection === 0 && line.fog === false, log).toBe(true);
    expect(line.tone && line.tone_depth && line.hdr, log).toBe(true);
    expect(line.haze).toBeNull();
    expect(line.cameras).toBe(h.level.markers.filter((m) => m.kind === 'camera').length);
    expect(line.main_camera).toBe(1);
    expect(line.glb_cameras_on).toBe(0);
    // (the cast: the hero skinned with its clips on an Animator, the second seat's body and the foe their meshes)
    expect(line.skinned, log).toBeGreaterThan(0);
    expect(line.animators, log).toBeGreaterThan(0);
    expect(line.clips, log).toBe(glbJson(h.exported.bytes).animations.length);
    expect(line.entity_meshes, log).toBe(2);
    expect(line.blocking, log).toBeGreaterThan(0);
    const before = line.developer;
    // (the developer adds an object to their scene and a script of their own; a re-handoff rebuilds mojulo's scene and
    // keeps theirs)
    mkdirSync(path.join(dir, 'Assets', 'Developer', 'Editor'), { recursive: true });
    writeFileSync(path.join(dir, 'Assets', 'Developer', 'Editor', 'Mine.cs'), `using UnityEditor.SceneManagement;
using UnityEngine;
public static class Mine
{
    public static void Add()
    {
        var s = EditorSceneManager.OpenScene("${HANDOFF_UNITY_PATHS.level}");
        new GameObject("my_door");
        EditorSceneManager.SaveScene(s);
    }
}
`);
    const add = unity(dir, 'Mine.Add');
    expect(add.status, add.text.split('\n').filter((l) => /error|Exception/i.test(l)).slice(-20).join('\n')).toBe(0);
    await writeHandoffUnity(h, dir);
    const re = probe(dir);
    expect(re.errors, re.log).toEqual([]);
    expect(re.line.developer, re.log).toBe(before + 1);
    expect(re.line.objects).toBe(line.objects);
    expect(re.line.markers).toBe(line.markers);
    expect(re.line.streamed).toBe(true);
    expect(existsSync(path.join(dir, 'Assets', 'Developer', 'Editor', 'Mine.cs'))).toBe(true);
  }, 3_600_000);

  it.skipIf(!UNITY)('in a batchmode Unity: a dressed face\'s normal, ORM and height; the room lit by its lamps (MOJULO_UNITY)', async () => {
    const h = await resolveHandoff(BAY), dir = shared();
    await writeHandoffUnity(h, dir);
    const { line, log, errors } = probe(dir);
    expect(line?.ok, log).toBe(true);
    expect(errors, log).toEqual([]);
    expect(line.normal, log).toBeGreaterThan(0);
    expect(line.orm, log).toBeGreaterThan(0);
    expect(line.height, log).toBeGreaterThan(0);
    expect(line.height_scale).toBe(0);
    // (lit by its lamps at the page's strength, the glTF intensity / pi: no sun; the solve's ambient; the room's haze)
    const lights = glbJson(h.exported.bytes).extensions.KHR_lights_punctual.lights;
    expect(line.sun, log).toBe(false);
    expect(line.points).toBe(lights.length);
    expect(line.point_shadows).toBe(0);
    expect(line.point_intensity).toBeCloseTo(lights.reduce((a, l) => a + l.intensity, 0) / Math.PI, 2);
    h.level.environment.ambient.forEach((v, i) => expect(Math.abs(line.ambient[i] - v), 'ambient').toBeLessThan(Math.max(0.002, v * 0.02)));
    expect(line.haze).toBeCloseTo(h.level.environment.haze.density, 5);
    // (what is see-through takes no collision: the bay's sun patch, panes and wiring)
    expect(line.translucent, log).toBeGreaterThan(0);
    expect(line.no_collision, log).toBeGreaterThan(0);
    expect(line.cameras).toBeGreaterThan(0);
  }, 3_600_000);

  it.skipIf(!UNITY)('in a batchmode Unity: the layered ground and the sea on their shaders, under the sky, sun and haze (MOJULO_UNITY)', async () => {
    const h = await resolveHandoff(TRAIL), dir = shared();
    await writeHandoffUnity(h, dir);
    const { line, log, errors } = probe(dir), parts = h.instances.filter((x) => x.terrain);
    expect(line?.ok, log).toBe(true);
    expect(errors, log).toEqual([]);
    // (every layered part on the terrain's shader, every layer a slice of its arrays, the trail's mask)
    expect(line.terrain, log).toBe(parts.length);
    expect(line.terrain_layers, log).toBe(parts[0].terrain.read.atlas.cells.length);
    expect(line.terrain_path, log).toBe(true);
    // (the sea on its own, its depth bound, casting no shadow; the cube's sky, its sun at the hour, the solve's ambient, the
    // haze: the tone pass's, Unity's own fog off with the same exp-squared numbers)
    expect(line.sea, log).toBe(1);
    expect(line.sea_depth && line.sea_shadow === false, log).toBe(true);
    const env = h.level.environment;
    expect(line.sky && line.sun, log).toBe(true);
    expect(line.sun_default, log).toBe(false);
    expect(line.sun_intensity).toBeCloseTo(env.sun.intensity / Math.PI, 4);
    env.ambient.forEach((v, i) => expect(Math.abs(line.ambient[i] - v), 'ambient').toBeLessThan(Math.max(0.002, v * 0.02)));
    expect(line.haze).toBeCloseTo(env.haze.density, 5);
    expect(line.fog_exp2).toBeCloseTo(env.haze.density, 5);
    expect(line.fog).toBe(false);
    // (the stones and plants take no collision; the land blocks)
    expect(line.no_collision, log).toBeGreaterThan(0);
    expect(line.blocking, log).toBeGreaterThan(0);
    expect(line.cameras).toBe(h.level.markers.filter((m) => m.kind === 'camera').length);
    // (a still from the island's camera through the pipeline: it is drawn, not blank)
    const shots = path.join(dir, 'shots.json'), out = path.join(dir, 'island.png');
    writeFileSync(shots, JSON.stringify({ shots: [{ out, w: 320, h: 180, camera: 'MojuloCamera_island' }] }));
    const r = unity(dir, 'Mojulo.Handoff.Probe.Render', { MOJULO_SHOTS: shots });
    expect(existsSync(out), r.text.split('\n').filter((l) => /mojulo-handoff|error|Exception/i.test(l)).slice(-20).join('\n')).toBe(true);
    expect(r.text.split('\n').filter((l) => ERRORS.test(l))).toEqual([]);
    expect(statSync(out).size).toBeGreaterThan(20_000);
  }, 3_600_000);
});
