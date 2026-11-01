// export_model engine: 'godot' | 'unreal' | 'blender' — the engine handoff from a tool call: a world's assets, animation
// and level as a Godot 4 project under <ref>/godot-handoff/ (scene/handoff-godot.js), the developer's project and scene
// kept on a re-handoff, as an Unreal project under <ref>/unreal-handoff/ (scene/handoff-unreal.js), the developer's
// project files kept, or as a Blender folder under <ref>/blender-handoff/ (scene/handoff-blender.js), the artist's .blend
// kept, a world's fire carried at `fire_t`; `engine` is its own export (no `format`), and a bad engine or `what` refuses.
// Unreal's `what: 'asset'` (its default off a world) is its asset pack; `format: 'blender'` stays the Blender art pack.

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

  it('a game: each of its levels handed to Godot as its own project under the game\'s folder', async () => {
    SketchRepository.create({ ref: 'sk_xe_lv_a', title: 'a', manifest: COUCH });
    SketchRepository.create({ ref: 'sk_xe_lv_b', title: 'b', manifest: { ...COUCH, seats: undefined } });
    SketchRepository.create({ ref: 'sk_xe_game', title: 'duo', manifest: { kind: 'game', title: 'duo', levels: [{ ref: 'sk_xe_lv_a', title: 'A' }, { ref: 'sk_xe_lv_b', title: 'B' }] } });
    const r = await exportModelHandler({ ref: 'sk_xe_game', engine: 'godot' });
    expect(r).toMatchObject({ ok: true, kind: 'game', engine: 'godot', what: 'level' });
    expect(r.levels.map((l) => l.ref)).toEqual(['sk_xe_lv_a', 'sk_xe_lv_b']);
    for (const l of r.levels) {
      expect(l.dir).toBe(path.join(r.dir, l.ref));
      expect(existsSync(path.join(l.dir, 'mojulo', 'level.glb')), l.ref).toBe(true);
      expect(existsSync(path.join(l.dir, 'level.tscn')), l.ref).toBe(true);
    }
    expect(r.levels[0].level.seats).toBe(2);
    expect(r.levels[1].level.seats).toBe(0);
    expect(r.note).toContain('export_game');
  }, 300_000);

  it('Unreal takes an asset, lit; its format name the same pack; Blender\'s format name the art pack', async () => {
    const u = await exportModelHandler({ ref: 'sk_xe_box', engine: 'unreal' });
    expect(u).toMatchObject({ ok: true, engine: 'unreal', what: 'asset' });
    expect(u.format).toBeUndefined();
    expect(path.basename(u.dir)).toBe('unreal');
    expect(u.commands.gate).toContain('--lit');
    // (the old names: the same Unreal pack, unlit unless asked; Blender's the art pack, in its own folder)
    const uf = await exportModelHandler({ ref: 'sk_xe_box', format: 'unreal' });
    expect(uf).toMatchObject({ ok: true, format: 'unreal' });
    expect(uf.commands.gate).not.toContain('--lit');
    const bf = await exportModelHandler({ ref: 'sk_xe_box', format: 'blender' });
    expect(bf).toMatchObject({ ok: true, format: 'blender' });
    expect(path.basename(bf.dir)).toBe('blender');
    expect(bf.files).toContain('import_mojulo.py');
  }, 300_000);

  it('Unreal takes a world\'s level as a UE5 project (its default for a world); a re-handoff keeps the developer\'s files', async () => {
    const r = await exportModelHandler({ ref: 'sk_xe_couch', engine: 'unreal' });
    expect(r).toMatchObject({ ok: true, engine: 'unreal', what: 'level', kept: [], map: '/Game/Level' });
    expect(path.basename(r.dir)).toBe('unreal-handoff');
    for (const f of ['mojulo/level.glb', 'mojulo/handoff.json', 'mojulo/import_handoff.py', 'mojulo/handoff_probe.py', 'mojulo/handoff_render.py', 'mojulo/handoff_tone.hlsl', 'mojulo/white.hdr', 'MojuloHandoff.uproject', 'Config/DefaultEngine.ini']) {
      expect(r.files, f).toContain(f);
      expect(existsSync(path.join(r.dir, f)), f).toBe(true);
    }
    expect(r.level.seats).toBe(2);
    expect(r.commands.import).toContain('-run=pythonscript');
    expect(r.commands.probe).toContain('mojulo/handoff_probe.py');
    expect(r.note).toContain('/Game/Level');
    writeFileSync(path.join(r.dir, 'Config', 'DefaultEngine.ini'), '; mine\n');
    const again = await exportModelHandler({ ref: 'sk_xe_couch', engine: 'unreal', what: 'level' });
    expect(again.kept).toEqual(['MojuloHandoff.uproject', 'Config/DefaultEngine.ini']);
    expect(readFileSync(path.join(r.dir, 'Config', 'DefaultEngine.ini'), 'utf8')).toBe('; mine\n');
    // (a thing that is no world still lands as its asset pack, unless its level is asked for; a game, each level a project)
    const a = await exportModelHandler({ ref: 'sk_xe_box', engine: 'unreal', what: 'level' });
    expect(a).toMatchObject({ ok: true, engine: 'unreal', what: 'level' });
    expect(path.basename(a.dir)).toBe('unreal-handoff');
    const g = await exportModelHandler({ ref: 'sk_xe_game', engine: 'unreal' });
    expect(g).toMatchObject({ ok: true, kind: 'game', engine: 'unreal', what: 'level' });
    expect(g.levels.map((l) => path.relative(g.dir, l.dir))).toEqual(['sk_xe_lv_a', 'sk_xe_lv_b']);
    expect(path.basename(g.dir)).toBe('unreal-handoff');
    for (const l of g.levels) expect(existsSync(path.join(l.dir, 'MojuloHandoff.uproject')), l.ref).toBe(true);
    expect(g.note).toContain('Unreal project');
  }, 300_000);

  it('Blender takes the same handoff: the folder its importer builds level.blend from; a re-handoff keeps the artist\'s', async () => {
    const r = await exportModelHandler({ ref: 'sk_xe_couch', engine: 'blender' });
    expect(r).toMatchObject({ ok: true, engine: 'blender', what: 'level', kept: [] });
    expect(path.basename(r.dir)).toBe('blender-handoff');
    for (const f of ['mojulo/level.glb', 'mojulo/handoff.json', 'mojulo/import_handoff.py', 'mojulo/handoff_nodes.py', 'mojulo/handoff_probe.py']) {
      expect(r.files, f).toContain(f);
      expect(existsSync(path.join(r.dir, f)), f).toBe(true);
    }
    expect(r.level.seats).toBe(2);
    expect(r.commands.import).toContain('mojulo/import_handoff.py');
    expect(r.commands.gate).toContain('mojulo/handoff_probe.py');
    expect(r.fire).toBeUndefined();
    expect(r.note).toContain('level.blend');
    writeFileSync(path.join(r.dir, 'level.blend'), 'the artist\'s');
    const again = await exportModelHandler({ ref: 'sk_xe_couch', engine: 'blender' });
    expect(again.kept).toEqual(['level.blend']);
    expect(readFileSync(path.join(r.dir, 'level.blend'), 'utf8')).toBe('the artist\'s');
    // (an asset alone: no level record; a game: each level its own folder)
    const a = await exportModelHandler({ ref: 'sk_xe_box', engine: 'blender', what: 'asset' });
    expect(a).toMatchObject({ ok: true, engine: 'blender', what: 'asset' });
    expect(JSON.parse(readFileSync(path.join(a.dir, 'mojulo/handoff.json'), 'utf8')).level).toBeNull();
    const g = await exportModelHandler({ ref: 'sk_xe_game', engine: 'blender' });
    expect(g).toMatchObject({ ok: true, kind: 'game', engine: 'blender' });
    expect(g.levels.map((l) => path.relative(g.dir, l.dir))).toEqual(['sk_xe_lv_a', 'sk_xe_lv_b']);
    expect(path.basename(g.dir)).toBe('blender-handoff');
  }, 300_000);

  it('Blender carries a world\'s fire at fire_t, by the art pack\'s own writer; bad fire dials refuse', async () => {
    const DUNGEON = { kind: 'dungeon', chambers: [{ id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 }, { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 }], tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }] };
    SketchRepository.create({ ref: 'sk_xe_fire', title: 'fire', manifest: { ...DUNGEON, fire: true } });
    const r = await exportModelHandler({ ref: 'sk_xe_fire', engine: 'blender', fire_t: 4 });
    expect(r).toMatchObject({ ok: true, engine: 'blender', fire: { t: 4, fires: 4 } });
    for (const f of ['mojulo/fire/fire.json', 'mojulo/fire/props.glb', 'mojulo/handoff_fire.py']) {
      expect(r.files, f).toContain(f);
      expect(existsSync(path.join(r.dir, f)), f).toBe(true);
    }
    expect(r.files.some((f) => f.endsWith('.bin'))).toBe(false);
    expect(JSON.parse(readFileSync(path.join(r.dir, 'mojulo/fire/fire.json'), 'utf8')).t).toBe(4);
    expect(r.commands.render).toMatch(/--camera Fire --engine cycles --res 3840x2160/);
    await expect(exportModelHandler({ ref: 'sk_xe_fire', engine: 'blender', fire_t: -1 })).rejects.toThrow(/fire_t/);
    await expect(exportModelHandler({ ref: 'sk_xe_fire', engine: 'blender', fire_detail: 9 })).rejects.toThrow(/fire_detail/);
  }, 300_000);

  it('a desktop app built from the same outcome folder leaves the engine packs out', () => {
    expect(ENGINE_HANDOFF_DIRS).toEqual(expect.arrayContaining(['godot-handoff', 'unreal-handoff', 'unreal', 'blender-handoff', 'blender']));
    const pkg = JSON.parse(desktopPackageJson({ title: 't', ref: 'sk_x' }));
    for (const d of ENGINE_HANDOFF_DIRS) expect(pkg.scripts.package).toContain(d);
  });
});
