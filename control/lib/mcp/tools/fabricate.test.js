// fabricate_solid: the plan first (nothing minted), then a scad source or a workbench frame minted with the plan beside it.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { loadOpenscad } from '@/lib/graph/scad/scad-render';
import { fabricateSolidHandler } from './fabricate.js';
import { mintSolidHandler } from './mint-solid.js';

const hasWasm = (await loadOpenscad()) != null;
const NEEDS = [{ id: 'lid', function: 'fasten', tags: ['serviceable'], count: 4 }, { id: 'axle', function: 'spin', shaftD: 8 }];

// A carcass's top and bottom on two sides: four cam-lock corners, a hardboard back in grooves.
const box = (min, max, material = 'mfc', extra = {}) => ({ box: { min, max }, material, ...extra });
const CARCASS = [{ id: 'cabinet', unit: 'mm', members: [
  { id: 'side-l', ...box([0, 0, 0], [18, 300, 800]) }, { id: 'side-r', ...box([582, 0, 0], [600, 300, 800]) },
  { id: 'top', ...box([18, 0, 782], [582, 300, 800]) }, { id: 'bottom', ...box([18, 0, 60], [582, 300, 78]) },
], joints: [
  { type: 'cam-lock', a: 'top', b: 'side-l' }, { type: 'cam-lock', a: 'top', b: 'side-r' },
  { type: 'cam-lock', a: 'bottom', b: 'side-l' }, { type: 'cam-lock', a: 'bottom', b: 'side-r' },
] }];

describe('fabricate_solid', () => {
  it('needs alone hand back the plan and mint nothing', async () => {
    const r = await fabricateSolidHandler({ host: 'printed', needs: NEEDS });
    expect(r).toMatchObject({ ok: true, phase: 'plan', minted: false });
    expect(r.fabrication.needs.map((n) => [n.strategy, n.executor])).toEqual([['heatset-bolt', 'scad'], ['ball-bearing', 'scad']]);
    expect(r.fabrication.executors).toEqual(['scad']);
    expect(r.fabrication.modules).toContain('mj_bearing_seat');
    expect(r.next).toMatch(/`source`: an OpenSCAD program/);
  });

  it('a wood need is planned as a frame joint, and the next step says to write it in `frames`', async () => {
    const r = await fabricateSolidHandler({ host: 'wood', tags: ['flat-pack'], needs: [{ id: 'corners', function: 'fasten', count: 4 }, { id: 'door', function: 'hinge', tags: ['hidden'] }] });
    expect(r.fabrication.needs.map((n) => [n.strategy, n.executor])).toEqual([['cam-lock', 'frames'], ['concealed-cup', 'frames']]);
    expect(r.fabrication.joints).toEqual([{ need: 'corners', type: 'cam-lock', count: 4 }, { need: 'door', type: 'hinge', count: 1 }]);
    expect(r.fabrication.cuts).toEqual([]);
    expect(r.next).toMatch(/`frames`: a workbench frames entry/);
  });

  it('a bad needs list, or both bodies at once, is taught with the manual pointer', async () => {
    const { ensureToolsRegistered, invokeRegisteredTool } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    await expect(fabricateSolidHandler({ needs: [{ function: 'weld' }] })).rejects.toThrow(/not one of fasten/);
    await expect(fabricateSolidHandler({ needs: NEEDS, source: 'cube(1);', frames: CARCASS })).rejects.toThrow(/not both/);
    await expect(invokeRegisteredTool('fabricate_solid', { needs: [] })).rejects.toThrow(/non-empty array.*get_solid_vocab\(\{ id: 'fabricate' \}\)/);
  });

  it('with frames mints a workbench row; the bill of materials is the frame\'s own hardware report', async () => {
    const r = await fabricateSolidHandler({ host: 'wood', tags: ['flat-pack'], ref: 'sk_fab_cabinet', title: 'cabinet',
      needs: [{ id: 'corners', function: 'fasten', count: 4 }, { id: 'feet', function: 'spin', host: 'printed', shaftD: 8 }], frames: CARCASS });
    expect(r.ok).toBe(true);
    const f = r.stats.fabrication;
    expect(f.executor).toBe('frames');
    expect(f.unplaced).toEqual([]);
    const cams = f.bom.find((l) => l.code === 'cam-15');
    expect(cams).toMatchObject({ from: 'frames', label: expect.any(String) });
    expect(cams.count).toBe(r.stats.frames[0].furniture.hardware.find((h) => h.code === 'cam-15').count);
    expect(f.bom.some((l) => l.part === 'cam-lock' && l.from === 'plan')).toBe(false);   // the estimate gave way to the report
    expect(f.bom.find((l) => l.code === '688')).toMatchObject({ from: 'plan' });          // the printed need stays on the plan
    expect(f.elsewhere).toEqual(['feet (scad)']);
    expect(r.stats.warnings.join(' ')).toMatch(/feet \(scad\) is planned for the other executor/);
    const m = SketchRepository.getByRef('sk_fab_cabinet').manifest;
    expect(m.kind).toBe('workbench');
    expect(m.fabricate).toMatchObject({ executor: 'frames', host: 'wood', plan: { version: expect.stringMatching(/^fabricator-v/) } });
  });

  it('a frame without the planned joint is warned about, not refused', async () => {
    const screwed = [{ ...CARCASS[0], joints: CARCASS[0].joints.map((j) => ({ ...j, type: 'confirmat' })) }];
    const r = await fabricateSolidHandler({ host: 'wood', tags: ['flat-pack'], needs: [{ function: 'fasten' }], frames: screwed });
    expect(r.ok).toBe(true);
    expect(r.stats.fabrication.unplaced).toEqual(['cam-lock']);
    expect(r.stats.warnings.join(' ')).toMatch(/no frame joint of type cam-lock/);
  });

  it.skipIf(!hasWasm)('with a source mints a scad row, the plan beside it, unplaced cuts said', async () => {
    const source = 'difference() { cube([40, 40, 10]); translate([20, 20, 10]) mj_bearing_seat("688"); }';
    const r = await fabricateSolidHandler({ host: 'printed', needs: NEEDS, source, title: 'axle block', ref: 'sk_fab_block' });
    expect(r.ok).toBe(true);
    expect(r.stats.fabrication.bom.map((b) => b.part)).toEqual(['radial-bearing', 'socket-bolt']);
    expect(r.stats.fabrication.unplaced).toEqual(['mj_counterbore', 'mj_heatset_hole']);
    const m = SketchRepository.getByRef('sk_fab_block').manifest;
    expect(m.kind).toBe('scad');
    expect(m.fabricate).toMatchObject({ executor: 'scad', needs: NEEDS });
  });

  it.skipIf(!hasWasm)('the assembler refuses a fabricated scad row and says where it assembles instead', async () => {
    await expect(mintSolidHandler({ kind: 'assembler', spec: { items: [{ source: { ref: 'sk_fab_block' } }] } }))
      .rejects.toThrow(/scad row — the assembler composes workbench parts only.*`parts` entry.*`mechanism`.*fabricate_solid/);
  });

  it('mint_solid no longer carries the fabricate door', async () => {
    await expect(mintSolidHandler({ kind: 'scad', via: 'fabricate', spec: { needs: NEEDS } })).rejects.toThrow(/has no via 'fabricate'/);
  });
});
