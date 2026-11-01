// export_model engine: 'godot' — the engine handoff from a tool call: a world's assets, animation and level as a Godot 4
// project under <ref>/godot-handoff/ (scene/handoff-godot.js), the developer's project and scene kept on a re-handoff;
// `engine` is its own export (no `format`), and a bad engine or `what` refuses.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-engine-export-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';
import { LEVEL_TSCN } from '@/lib/graph/scene/handoff-godot';
import { ENGINE_HANDOFF_DIRS } from '@/lib/graph/scene/engines/registry';
import { desktopPackageJson } from '@/lib/graph/game/desktop-shell';

const box = { type: 'mesh', shape: 'box' };
const COUCH = { kind: 'controllable', title: 'couch', faces: [{ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#a0b0c0', group: 'floor' }],
  entities: [{ id: 'p1', pilotable: true, rule: { type: 'walk' }, body: box, transform: { pos: [0, 0, 0.5] } }, { id: 'p2', pilotable: true, rule: { type: 'walk' }, body: box, transform: { pos: [3, 0, 0.5] } }],
  seats: { bodies: ['p2'], lives: 3 }, camera: { rule: 'side', target: 'p1', dist: 11 }, game: { levelRef: 'couch', mechanics: [{ kind: 'reach-exit', at: [8, 0, 0] }] } };

describe("export_model engine: 'godot'", () => {
  it('writes the Godot project: the level, its markers and seats; a re-handoff keeps the developer\'s scene', async () => {
    SketchRepository.create({ ref: 'sk_xe_couch', title: 'couch', manifest: COUCH });
    const r = await exportModelHandler({ ref: 'sk_xe_couch', engine: 'godot' });
    expect(r).toMatchObject({ ok: true, engine: 'godot', what: 'level', kept: [] });
    expect(path.basename(r.dir)).toBe('godot-handoff');
    for (const f of ['mojulo/level.glb', 'mojulo/level.glb.import', 'mojulo/handoff.json', 'mojulo/handoff_post_import.gd', 'mojulo/handoff_probe.gd', 'project.godot', 'level.tscn']) {
      expect(r.files, f).toContain(f);
      expect(existsSync(path.join(r.dir, f)), f).toBe(true);
    }
    expect(r.level.seats).toBe(2);
    expect(r.level.contract).toBe(true);
    expect(r.level.markers).toBeGreaterThan(0);
    expect(r.commands.gate).toContain('res://mojulo/handoff_probe.gd');
    expect(Array.isArray(r.stays)).toBe(true);
    // (the developer wires their scene; the recipe changes; a re-handoff replaces mojulo/ and keeps theirs)
    const mine = `${LEVEL_TSCN}\n[node name="MyDoor" type="Node" parent="."]\n`;
    writeFileSync(path.join(r.dir, 'level.tscn'), mine);
    SketchRepository.update({ ref: 'sk_xe_couch', manifest: { ...COUCH, entities: [...COUCH.entities, { id: 'crate', rule: { type: 'static' }, body: box, transform: { pos: [5, 5, 0.5] } }] } });
    const again = await exportModelHandler({ ref: 'sk_xe_couch', engine: 'godot' });
    expect(again.kept).toEqual(['project.godot', 'level.tscn']);
    expect(readFileSync(path.join(r.dir, 'level.tscn'), 'utf8')).toBe(mine);
    expect(again.level.markers).toBe(r.level.markers + 1);
  }, 300_000);

  it('`what: asset` hands off the thing alone; a format beside an engine, an unknown engine or what refuse', async () => {
    SketchRepository.create({ ref: 'sk_xe_box', title: 'table', manifest: { kind: 'workbench', units: 'mm', frames: [{ id: 'box', unit: 'mm', build: { type: 'table', w: 600, d: 400, h: 450, species: 'oak' } }] } });
    const r = await exportModelHandler({ ref: 'sk_xe_box', engine: 'godot', what: 'asset' });
    expect(r).toMatchObject({ ok: true, what: 'asset' });
    expect(r.level).toBeUndefined();
    expect(JSON.parse(readFileSync(path.join(r.dir, 'mojulo/handoff.json'), 'utf8')).level).toBeNull();
    await expect(exportModelHandler({ ref: 'sk_xe_box', engine: 'godot', format: 'glb' })).rejects.toThrow(/omit `format`/);
    await expect(exportModelHandler({ ref: 'sk_xe_box', engine: 'roblox' })).rejects.toThrow(/`engine` must be one of 'godot'/);
    await expect(exportModelHandler({ ref: 'sk_xe_box', engine: 'godot', what: 'game' })).rejects.toThrow(/`what` must be one of/);
    await expect(exportModelHandler({ ref: 'sk_xe_none', engine: 'godot' })).rejects.toThrow(/No sketch exists/);
  }, 300_000);

  it('a desktop app built from the same outcome folder leaves the engine packs out', () => {
    expect(ENGINE_HANDOFF_DIRS).toEqual(expect.arrayContaining(['godot-handoff', 'unreal', 'blender']));
    const pkg = JSON.parse(desktopPackageJson({ title: 't', ref: 'sk_x' }));
    for (const d of ENGINE_HANDOFF_DIRS) expect(pkg.scripts.package).toContain(d);
  });
});
