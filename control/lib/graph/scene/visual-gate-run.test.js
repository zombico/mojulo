// The visual gate's engine projects are kept between runs (visual-gate-run.js renderEngineShots): a pack whose key
// (packKey: the gate's version, the engine's binary, every file the adapter writes) is the project's stamp skips its
// write and its import; a changed pack, or `fresh`, imports again over the same project. Held with a stand-in engine (a
// shell script that answers every step and draws nothing), so no engine is needed.
import { afterAll, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveHandoff } from './handoff.js';
import { renderEngineShots, packKey, PROJECT_STAMP } from './visual-gate-run.js';
import { gateShots } from './visual-gate.js';

const dirs = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const tmp = (n) => { const d = mkdtempSync(path.join(os.tmpdir(), `mojulo-visual-gate-run-${n}-`)); dirs.push(d); return d; };

const LEVEL = (fill) => ({ ref: 'sk_vg_cache', title: 'cache', manifest: { kind: 'controllable', title: 'cache', faces: [{ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill, group: 'floor' }],
  entities: [{ id: 'p1', pilotable: true, rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' }, transform: { pos: [0, 0, 0.5] } }], camera: { rule: 'side', target: 'p1', dist: 11 } } });

describe('the visual gate\'s engine projects, kept', () => {
  it('an unchanged pack skips its import; a changed one, or `fresh`, imports again over the same project', async () => {
    const bin = path.join(tmp('bin'), 'godot');
    writeFileSync(bin, '#!/bin/sh\nexit 0\n');
    chmodSync(bin, 0o755);
    const dir = tmp('project'), stills = tmp('stills');
    const a = await resolveHandoff(LEVEL('#a0b0c0'), { what: 'level' });
    const shots = gateShots(a.level, { payload: a.payload, poses: [{ name: 'p', pos: [5, 5, 5], target: [0, 0, 0], vfov: 40 }] });
    const labels = (r) => r.steps.map((s) => s.label);
    const first = await renderEngineShots('godot', a, shots, { dir, stills, bin });
    expect(labels(first)).toEqual(['import', 'shots']);
    expect(first.cached).toBeUndefined();
    expect(readFileSync(path.join(dir, PROJECT_STAMP), 'utf8').trim()).toBe(packKey('godot', a, { title: null, bin }));
    // (the same pack again: built already)
    const again = await renderEngineShots('godot', a, shots, { dir, stills, bin });
    expect(labels(again)).toEqual(['shots']);
    expect(again.cached).toBe(true);
    // (`fresh`: imported again whatever the stamp says)
    expect(labels(await renderEngineShots('godot', a, shots, { dir, stills, bin, fresh: true }))).toEqual(['import', 'shots']);
    // (a changed recipe, a changed pack: imported again, and stamped with its own key)
    const b = await resolveHandoff(LEVEL('#c0b0a0'), { what: 'level' });
    expect(packKey('godot', b, { bin })).not.toBe(packKey('godot', a, { bin }));
    expect(labels(await renderEngineShots('godot', b, shots, { dir, stills, bin }))).toEqual(['import', 'shots']);
    expect(readFileSync(path.join(dir, PROJECT_STAMP), 'utf8').trim()).toBe(packKey('godot', b, { bin }));
    // (an import that fails leaves no stamp: the next run imports again)
    writeFileSync(bin, '#!/bin/sh\nexit 3\n');
    const failed = await renderEngineShots('godot', a, shots, { dir, stills, bin });
    expect(failed.steps[0]).toMatchObject({ label: 'import', code: 3 });
    expect(existsSync(path.join(dir, PROJECT_STAMP))).toBe(false);
  }, 300_000);
});
