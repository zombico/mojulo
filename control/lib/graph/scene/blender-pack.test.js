// blender-pack.test.js — the assembler over an in-memory DB: the file set, pack.json's
// inventory / landmark / collections / units, the lit default vs the dials, byte-identical
// re-emit, and the in-place write that never clobbers the operator's .blend.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-blender-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { buildBlenderPack, metersPerUnitFor } from './blender-pack.js';

const CYLINDER = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };
const SPOUT = { axisFrom: { x: 3, y: 0, z: 3 }, axisTo: { x: 6, y: 0, z: 4 }, profile: [{ t: 0, radius: 0.6 }, { t: 1, radius: 0.4 }] };
const glbJson = (bytes) => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const snapshot = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true }).filter((f) => !f.endsWith('.blend')).map((f) => { const p = path.join(dir, f); return existsSync(p) && !readdirSync(dir).includes(`${f}/`) ? [f, (() => { try { return readFileSync(p).toString('base64'); } catch { return null; } })()] : [f, null]; }));

describe('buildBlenderPack', () => {
  it('emits the pack in place — files, pack.json inventory + landmark + collections + units, lit by default', async () => {
    SketchRepository.create({ ref: 'sk_bp_cup', title: 'cup', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER, SPOUT] } });
    const dir = path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_bp_cup', 'blender');
    writeFileSync(path.join(process.env.MOJULO_OUTCOMES_DIR, 'placeholder'), '');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'sk_bp_cup.blend'), 'THE OPERATOR\'S PASS IN PROGRESS');

    const out = await buildBlenderPack({ ref: 'sk_bp_cup', outDir: dir });
    expect(out.written.map((f) => f.file)).toEqual(['model.glb', 'pack.json', 'recipe/sk_bp_cup.json', 'import_mojulo.py', 'export_return.py', 'ARTPASS-GUIDE.md', 'README.md']);
    for (const f of out.written) expect(existsSync(path.join(dir, f.file)), f.file).toBe(true);
    // the operator's .blend beside the pack survives a (re-)emit
    expect(readFileSync(path.join(dir, 'sk_bp_cup.blend'), 'utf8')).toBe('THE OPERATOR\'S PASS IN PROGRESS');

    const pack = JSON.parse(readFileSync(path.join(dir, 'pack.json'), 'utf8'));
    expect(pack.ref).toBe('sk_bp_cup');
    expect(pack.base).toBe('lit');
    expect(pack.glb.lit).toBe(true);
    expect(pack.units).toBe('cm');
    expect(pack.meters_per_unit).toBe(0.01);
    expect(pack.nodes.length).toBeGreaterThanOrEqual(1);
    expect(pack.landmark).toBeTruthy();
    expect(Object.keys(pack.collections).length).toBeGreaterThanOrEqual(1);
    for (const [coll, names] of Object.entries(pack.collections)) for (const n of names) expect(pack.nodes.some((x) => x.name === n), `${coll} → ${n}`).toBe(true);
    expect(pack.glb.triangles).toBe(pack.nodes.reduce((s, n) => s + n.triangles, 0));
    expect(pack.bounds.size.every((v) => v > 0)).toBe(true);
    expect(pack.epsilon).toBeGreaterThan(0);
    // lit GLB: real PBR, no unlit extension
    const j = glbJson(readFileSync(path.join(dir, 'model.glb')));
    expect(j.extensionsUsed || []).not.toContain('KHR_materials_unlit');
    expect(j.asset.generator).toContain('blender pack, lit');
    // the ledger says what the base is and that hand work is not regenerable
    expect(out.ledger.base_lit).toBeTruthy();
    expect(out.ledger.hand_work).toBeTruthy();
    const guide = readFileSync(path.join(dir, 'ARTPASS-GUIDE.md'), 'utf8');
    expect(guide).toContain(`\`${pack.landmark.name}\``);
  });

  it('re-emit is byte-identical', async () => {
    SketchRepository.create({ ref: 'sk_bp_cyl', title: 'cylinder', manifest: { kind: 'workbench', units: 'mm', lathes: [CYLINDER] } });
    const dir = path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_bp_cyl', 'blender');
    const a = await buildBlenderPack({ ref: 'sk_bp_cyl', outDir: dir });
    const first = Object.fromEntries(a.written.map((f) => [f.file, readFileSync(path.join(dir, f.file)).toString('base64')]));
    const b = await buildBlenderPack({ ref: 'sk_bp_cyl', outDir: dir });
    const second = Object.fromEntries(b.written.map((f) => [f.file, readFileSync(path.join(dir, f.file)).toString('base64')]));
    expect(second).toEqual(first);
    expect(b.manifestHash).toBe(a.manifestHash);
  });

  it('the taste dials: unlit keeps KHR_materials_unlit, shaded resolves the shaded payload; a bad base throws', async () => {
    SketchRepository.create({ ref: 'sk_bp_dial', title: 'cylinder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const dir = path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_bp_dial', 'blender');
    const unlit = await buildBlenderPack({ ref: 'sk_bp_dial', outDir: dir, base: 'unlit' });
    expect(unlit.pack.base).toBe('unlit');
    expect(glbJson(readFileSync(path.join(dir, 'model.glb'))).extensionsUsed).toContain('KHR_materials_unlit');
    expect(unlit.ledger.base_unlit).toBeTruthy();
    const shaded = await buildBlenderPack({ ref: 'sk_bp_dial', outDir: dir, base: 'shaded' });
    expect(shaded.pack.base).toBe('shaded');
    expect(shaded.ledger.base_shaded).toBeTruthy();
    expect(readFileSync(path.join(dir, 'README.md'), 'utf8')).toContain('--base shaded');
    await expect(buildBlenderPack({ ref: 'sk_bp_dial', outDir: dir, base: 'neon' })).rejects.toThrow(/base/);
  });

  it('greybox posture stamps the pack; unknown posture / missing ref / no-mesh kinds refuse with the reason', async () => {
    SketchRepository.create({ ref: 'sk_bp_grey', title: 'cylinder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const dir = path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_bp_grey', 'blender');
    const g = await buildBlenderPack({ ref: 'sk_bp_grey', outDir: dir, posture: 'greybox' });
    expect(g.pack.posture).toBe('greybox');
    expect(g.ledger.greybox_declared).toBeTruthy();
    expect(readFileSync(path.join(dir, 'README.md'), 'utf8')).toContain('Greybox handoff');
    await expect(buildBlenderPack({ ref: 'sk_bp_grey', outDir: dir, posture: 'sketchy' })).rejects.toThrow(/posture/);
    await expect(buildBlenderPack({ ref: 'sk_bp_missing', outDir: dir })).rejects.toThrow(/not found/);
    SketchRepository.create({ ref: 'sk_bp_pix', title: 'pix', manifest: { kind: 'pixelizer' } });
    await expect(buildBlenderPack({ ref: 'sk_bp_pix', outDir: dir })).rejects.toThrow(/pixelizer/);
  });

  it('metersPerUnitFor mirrors the print leg\'s unit table', () => {
    expect(metersPerUnitFor('cm')).toBe(0.01);
    expect(metersPerUnitFor('mm')).toBe(0.001);
    expect(metersPerUnitFor('in')).toBe(0.0254);
    expect(metersPerUnitFor(null)).toBe(1);
    expect(metersPerUnitFor('parsecs')).toBe(1);
  });
});
