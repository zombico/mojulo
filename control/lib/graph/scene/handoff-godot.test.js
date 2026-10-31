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
  entities: [{ id: 'p1', pilotable: true, rule: { type: 'walk' }, body: box, transform: { pos: [0, 0, 0.5] } }, { id: 'p2', pilotable: true, rule: { type: 'walk' }, body: box, transform: { pos: [3, 0, 0.5] } },
    { id: 'grunt', rule: { type: 'ai' }, body: box, transform: { pos: [6, 2, 0.5] } }],
  seats: { bodies: ['p2'], lives: 3 }, camera: { rule: 'side', target: 'p1', dist: 11 }, game: { levelRef: 'couch', mechanics: [{ kind: 'reach-exit', at: [8, 0, 0] }] } } };
const BAY = { ref: 'sk_bay', title: 'bay', manifest: { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 8, h: 3.5 }] } };

const fileOf = (files, name) => files.find((f) => f.file === name);
const probe = (dir) => {
  const imp = spawnSync(GODOT, ['--headless', '--path', dir, '--import'], { encoding: 'utf8', timeout: 600000 });
  const run = spawnSync(GODOT, ['--headless', '--path', dir, '--script', 'res://mojulo/handoff_probe.gd'], { encoding: 'utf8', timeout: 300000 });
  const line = `${run.stdout}\n${run.stderr}`.split('\n').find((l) => l.startsWith('[mojulo-handoff-probe] '));
  return { line: line ? JSON.parse(line.slice('[mojulo-handoff-probe] '.length)) : null, log: `${imp.stdout}${imp.stderr}${run.stdout}${run.stderr}`.slice(-4000) };
};

describe('the handoff as a Godot project', () => {
  it('names its importer on the GLB, carries the level record and each dressed face\'s height, the same bytes twice', async () => {
    const h = await resolveHandoff(BAY), files = handoffGodotFiles(h);
    expect(fileOf(files, 'mojulo/level.glb').data.equals(Buffer.from(h.exported.bytes))).toBe(true);
    expect(fileOf(files, 'mojulo/level.glb.import').data).toBe(LEVEL_GLB_IMPORT);
    expect(LEVEL_GLB_IMPORT).toContain('import_script/path="res://mojulo/handoff_post_import.gd"');
    const H = JSON.parse(fileOf(files, 'mojulo/handoff.json').data);
    expect(H.level).toEqual(JSON.parse(JSON.stringify(h.level)));
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
    const { line, log } = probe(dir);
    expect(line, `${dir}\n${log}`).toBeTruthy();
    expect(line.ok, log).toBe(true);
    expect(line.handoff).toBe(HANDOFF_GODOT_VERSION);
    expect(line.albedo).toBe(line.materials);
    expect(line.environment && line.sky && line.ssao).toBe(true);
    expect(line.markers).toBe(h.level.markers.length);
    expect(line.seats).toBe(h.level.seats.rows.length);
    expect(line.bodies).toBeGreaterThan(0);
  }, 900_000);

  it.skipIf(!GODOT)('in a headless Godot: a dressed face\'s relief is its material\'s height map (MOJULO_GODOT)', async () => {
    const h = await resolveHandoff(BAY), dir = packDir('bay');
    await writeHandoffGodot(h, dir);
    const { line, log } = probe(dir);
    expect(line?.ok, log).toBe(true);
    expect(line.height, log).toBeGreaterThan(0);
    expect(line.normal, log).toBeGreaterThan(0);
  }, 900_000);
});
