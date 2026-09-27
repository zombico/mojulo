// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createFigureHandler } from './figure.js';
import { createEdificeHandler } from './edifice.js';
import { createWorkbenchHandler, createCodeSolidHandler } from './workbench.js';
import { updateSketchHandler } from './sketches.js';
import { measureSolidHandler } from './measure-solid.js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// edit-3d-recipes.plan.md Phase 2: solids and edifices were always editable in
// place through update_sketch's world branch (their kinds live in WORLD_KINDS),
// but nothing documented or tested it — create_figure even taught "re-mint".
// These tests pin the path so the starter thesis holds for 3D objects.

beforeEach(() => { closeDb(); });

const CAMPUS = {
  masses: [
    { id: 'commons', at: [0, 0], footprint: { w: 60, d: 44 }, floors: 2, facade: { material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frame: '#34383c' }, roof: 'flat' },
    { id: 'wing', on: { anchor: 'commons', side: 'E', align: 'start', gap: 14 }, footprint: { w: 34, d: 74 }, floors: 3, facade: { material: 'brick', rhythm: 'punched', glass: '#9a6650', frame: '#6f4636' }, roof: 'mission' },
  ],
  concourses: [{ from: 'commons', to: 'wing', width: 12 }],
  entrance: 'commons',
};

describe('update_sketch on solid recipes (figure)', () => {
  it('a pose-dial edit updates IN PLACE (no new ref, no diagram validator)', async () => {
    const fig = await createFigureHandler({ title: 'Subject', ref: 'fig-iterate', animate: false });
    const stored = SketchRepository.getByRef(fig.ref);
    const edited = { ...stored.manifest, pose: { ...(stored.manifest.pose || {}), elbowL: 90, head: { yaw: 15, pitch: 0 } } };
    const r = await updateSketchHandler({ ref: fig.ref, manifest: edited });
    expect(r.ok).toBe(true);
    expect(r.ref).toBe('fig-iterate');
    const after = SketchRepository.getByRef('fig-iterate');
    expect(after.manifest.kind).toBe('figure');
    expect(after.manifest.pose.elbowL).toBe(90);
    expect(after.manifest.pose.head.yaw).toBe(15);
  });

  it('an out-of-range dial is accepted, not refused — joint LIMITS clamp at render, so an edit can never break the form', async () => {
    const fig = await createFigureHandler({ title: 'Subject', ref: 'fig-clamp', animate: false });
    const stored = SketchRepository.getByRef(fig.ref);
    const edited = { ...stored.manifest, pose: { ...(stored.manifest.pose || {}), elbowL: 400 } };
    const r = await updateSketchHandler({ ref: fig.ref, manifest: edited });
    expect(r.ok).toBe(true);   // validated by RESOLVING the figure scene — the clamp holds, the render succeeds
  });
});

describe('update_sketch on edifice recipes', () => {
  it('a mass edit updates IN PLACE (add a floor to the wing)', async () => {
    await createEdificeHandler({ ...CAMPUS, title: 'Campus', ref: 'ed-iterate' });
    const stored = SketchRepository.getByRef('ed-iterate');
    const edited = {
      ...stored.manifest,
      masses: stored.manifest.masses.map((m) => (m.id === 'wing' ? { ...m, floors: 4 } : m)),
    };
    const r = await updateSketchHandler({ ref: 'ed-iterate', manifest: edited });
    expect(r.ok).toBe(true);
    expect(r.ref).toBe('ed-iterate');
    const after = SketchRepository.getByRef('ed-iterate');
    expect(after.manifest.kind).toBe('edifice');
    expect(after.manifest.masses.find((m) => m.id === 'wing').floors).toBe(4);
  });

  it('a broken edit is refused with a WORLD error, and the stored recipe never moves', async () => {
    await createEdificeHandler({ ...CAMPUS, title: 'Campus', ref: 'ed-broken' });
    const stored = SketchRepository.getByRef('ed-broken');
    // collapse both masses onto the same spot — the building resolver refuses
    const broken = {
      ...stored.manifest,
      masses: stored.manifest.masses.map((m) => ({ ...m, at: [0, 0], on: undefined })),
    };
    await expect(updateSketchHandler({ ref: 'ed-broken', manifest: broken }))
      .rejects.toThrow(/Invalid world manifest \(kind 'edifice'\)/);
    await expect(updateSketchHandler({ ref: 'ed-broken', manifest: broken }))
      .rejects.not.toThrow(/viewBox is required/);
    const after = SketchRepository.getByRef('ed-broken');
    expect(after.manifest.masses.find((m) => m.id === 'wing').on).toBeTruthy();
  });
});

// continuous-guardrails.plan.md G1: the workbench kind pays the mint gates on EVERY edit. The
// structural refusals (unknown material, a malformed spec) are the same ones mint makes; the
// closure lint stays advisory — an open shell edits fine and says so in stats.warnings.
describe('update_sketch on workbench recipes runs the mint gates (G1)', () => {
  const CYL = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };
  const BOX = { profile: { rect: { w: 4, h: 3 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 } };

  it('an unknown material on an edit is refused with the mint-time message', async () => {
    await createWorkbenchHandler({ title: 'cyl', ref: 'wb-g1-mat', lathes: [CYL] });
    const stored = SketchRepository.getByRef('wb-g1-mat');
    const edited = { ...stored.manifest, lathes: [{ ...CYL, material: 'unobtainium' }] };
    await expect(updateSketchHandler({ ref: 'wb-g1-mat', manifest: edited })).rejects.toThrow(/material/);
    expect(SketchRepository.getByRef('wb-g1-mat').manifest.lathes[0].material).toBeUndefined(); // the row is untouched
  });

  it('a wall at or past half the profile on an edit is refused (the extrude validator)', async () => {
    await createWorkbenchHandler({ title: 'box', ref: 'wb-g1-wall', extrudes: [BOX] });
    const stored = SketchRepository.getByRef('wb-g1-wall');
    const edited = { ...stored.manifest, extrudes: [{ ...BOX, wallThickness: 1.5 }] };
    await expect(updateSketchHandler({ ref: 'wb-g1-wall', manifest: edited })).rejects.toThrow(/wallThickness/);
  });

  it('an edit that opens a shell is accepted — closure is advisory and rides stats.warnings + ledger', async () => {
    // The code door: a program returning one quad is an open sheet the audit does NOT excuse
    // (a lathe's caps:false is a declared intent and is excused — see monomerIntendsClosed).
    await createCodeSolidHandler({ title: 'sheet', ref: 'wb-g1-open', source: 'return [{ corners: [[0,0,0],[4,0,0],[4,4,0],[0,4,0]] }];' });
    const stored = SketchRepository.getByRef('wb-g1-open');
    const edited = { ...stored.manifest, program: { ...stored.manifest.program, source: 'return [{ corners: [[0,0,0],[6,0,0],[6,6,0],[0,6,0]] }];' } };
    const r = await updateSketchHandler({ ref: 'wb-g1-open', manifest: edited });
    expect(r.ok).toBe(true);
    expect(r.stats.ledger.closed).toBe(false);
    expect(r.stats.warnings.join('\n')).toMatch(/open shell/);
    expect(SketchRepository.getByRef('wb-g1-open').manifest.program.source).toContain('[6,6,0]');
  });

  it('a clean edit returns the same stats block mint returns (ledger closed, no warnings)', async () => {
    await createWorkbenchHandler({ title: 'cyl', ref: 'wb-g1-clean', lathes: [CYL] });
    const stored = SketchRepository.getByRef('wb-g1-clean');
    const r = await updateSketchHandler({ ref: 'wb-g1-clean', manifest: { ...stored.manifest, lathes: [{ ...CYL, axisTo: { x: 0, y: 0, z: 8 } }] } });
    expect(r.ok).toBe(true);
    expect(r.stats.ledger.closed).toBe(true);
    expect(r.stats.warnings).toBeUndefined();
  });
});

// continuous-guardrails.plan.md G5 + G6: a solid keeps its history, and its ledger travels.
import { SketchRevisionRepository } from '@/lib/db/repositories/sketch-revisions';
import { createSketchHandler } from './sketches.js';

describe('update_sketch on solid kinds archives the previous manifest (G5) and re-stamps the ledger (G6)', () => {
  const CYL = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };

  it('mint writes the ledger; each edit archives the previous manifest as the next rev; the row stays HEAD', async () => {
    await createWorkbenchHandler({ title: 'cyl', ref: 'wb-rev', lathes: [CYL] });
    const minted = SketchRepository.getByRef('wb-rev').manifest;
    expect(minted.ledger).toEqual({ recipe_bytes: expect.any(Number), faces: expect.any(Number), closed: true });
    expect(SketchRevisionRepository.list('wb-rev')).toEqual([]); // rev 1 is written lazily, at the first edit

    const r1 = await updateSketchHandler({ ref: 'wb-rev', manifest: { ...minted, lathes: [{ ...CYL, axisTo: { x: 0, y: 0, z: 8 } }] }, note: 'taller' });
    expect(r1.revision).toEqual({ archived_rev: 1, head_rev: 2 });
    const r2 = await updateSketchHandler({ ref: 'wb-rev', manifest: { ...SketchRepository.getByRef('wb-rev').manifest, lathes: [{ ...CYL, axisTo: { x: 0, y: 0, z: 10 } }] } });
    expect(r2.revision).toEqual({ archived_rev: 2, head_rev: 3 });

    const list = SketchRevisionRepository.list('wb-rev');
    expect(list.map((r) => r.rev)).toEqual([2, 1]);
    expect(list[1].note).toBe('taller');
    expect(SketchRevisionRepository.get('wb-rev', 1).manifest).toEqual(minted);      // rev 1 IS the mint manifest
    expect(SketchRevisionRepository.get('wb-rev', 2).manifest.lathes[0].axisTo.z).toBe(8);
    expect(SketchRepository.getByRef('wb-rev').manifest.lathes[0].axisTo.z).toBe(10); // HEAD is the row
  });

  it('the ledger is re-measured on every edit and its bytes exclude itself', async () => {
    await createWorkbenchHandler({ title: 'cyl', ref: 'wb-ledger', lathes: [CYL] });
    const minted = SketchRepository.getByRef('wb-ledger').manifest;
    const { ledger: _l, ...recipe } = minted;
    expect(minted.ledger.recipe_bytes).toBe(Buffer.byteLength(JSON.stringify(recipe), 'utf8'));
    // an edit that carries the STALE ledger forward gets it re-stamped, not copied
    await updateSketchHandler({ ref: 'wb-ledger', manifest: { ...minted, lathes: [CYL, { ...CYL, axisFrom: { x: 6, y: 0, z: 0 }, axisTo: { x: 6, y: 0, z: 6 } }] } });
    const after = SketchRepository.getByRef('wb-ledger').manifest;
    expect(after.ledger.faces).toBe(minted.ledger.faces * 2);
    expect(after.ledger.recipe_bytes).toBeGreaterThan(minted.ledger.recipe_bytes);
    expect(after.ledger.closed).toBe(true);
  });

  it('a title-only edit and a diagram edit write no revision', async () => {
    await createWorkbenchHandler({ title: 'cyl', ref: 'wb-title', lathes: [CYL] });
    const r = await updateSketchHandler({ ref: 'wb-title', title: 'renamed' });
    expect(r.revision).toBeUndefined();
    expect(SketchRevisionRepository.list('wb-title')).toEqual([]);
    const flat = (v) => ({ title: 'flat', viewBox: { width: 100, height: 100 }, marks: [{ kind: 'text', x: 10, y: 10, value: v, size: 12 }] });
    await createSketchHandler({ title: 'flat', ref: 'flat-1', manifest: flat('A') });
    const d = await updateSketchHandler({ ref: 'flat-1', manifest: flat('B') });
    expect(d.revision).toBeUndefined();
    expect(SketchRevisionRepository.list('flat-1')).toEqual([]);
  });

  it('a malformed note is refused before anything is written', async () => {
    await createWorkbenchHandler({ title: 'cyl', ref: 'wb-note', lathes: [CYL] });
    const m = SketchRepository.getByRef('wb-note').manifest;
    await expect(updateSketchHandler({ ref: 'wb-note', manifest: m, note: '   ' })).rejects.toThrow(/note/);
    expect(SketchRevisionRepository.list('wb-note')).toEqual([]);
  });
});

// update-sketch-patch: iterate a recipe by naming the part. A patch is a cheaper way to author the
// next manifest — it pays the same gates, stores the same row, archives the same revision (with the
// ops as its diff) — and the `changed` readout answers "what moved" without the whole parts list.
import { MZ_NE410 } from './update-sketch.mz-ne410.fixture.js';
import { planWorkbench } from '@/lib/graph/worlds/workbench';

// create_workbench takes the monomer arrays, not `grid` / `movers`; store the fixture verbatim
// after the mint so every test starts from the recipe as the session left it (ledger re-stamped
// by the first edit, as G6 promises).
async function mintNe410(ref) {
  await createWorkbenchHandler({ title: 'MZ-NE410', ref, ...MZ_NE410 });
  SketchRepository.update({ ref, manifest: structuredClone(MZ_NE410) });
}

describe('update_sketch { patch } — the same row a full replacement stores (Phase 2)', () => {
  const CYL = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };

  it('a patch edit updates in place with head_rev advancing; the archived revision carries the ops', async () => {
    await createWorkbenchHandler({ title: 'cyl', ref: 'wb-patch', lathes: [{ ...CYL, id: 'post' }] });
    const ops = [{ op: 'set', id: 'post', axisTo: { x: 0, y: 0, z: 8 } }];
    const r = await updateSketchHandler({ ref: 'wb-patch', patch: ops, note: 'taller' });
    expect(r.ok).toBe(true);
    expect(r.revision).toEqual({ archived_rev: 1, head_rev: 2 });
    expect(SketchRepository.getByRef('wb-patch').manifest.lathes[0].axisTo.z).toBe(8);
    const rev1 = SketchRevisionRepository.get('wb-patch', 1);
    expect(rev1.note).toBe('taller');
    expect(rev1.patch).toEqual(ops);                       // history reads as a diff
    expect(rev1.manifest.lathes[0].axisTo.z).toBe(6);      // the archived row is the PREVIOUS manifest
    expect(SketchRevisionRepository.list('wb-patch')[0]).toMatchObject({ rev: 1, note: 'taller', patch: ops });
  });

  it('byte-identical row: a patch and a full replacement with the same edit store the same manifest (MZ-NE410)', async () => {
    await mintNe410('ne410-a');
    await mintNe410('ne410-b');
    const stored = SketchRepository.getByRef('ne410-a').manifest;
    const full = structuredClone(stored);
    full.lathes.find((l) => l.id === 'dial').material = 'chrome';
    full.movers[0].states = [0, 0.27];
    full.grid = true;
    full.extrudes.splice(full.extrudes.findIndex((e) => e.id === 'holdknob'), 1);
    full.lathes.push({ id: 'usbcap2', axisFrom: { x: 3, y: 0, z: 2 }, axisTo: { x: 3.6, y: 0, z: 2 }, profile: [{ t: 0, radius: 0.5 }, { t: 1, radius: 0.5 }], material: 'rubber' });
    await updateSketchHandler({ ref: 'ne410-a', manifest: full });
    await updateSketchHandler({ ref: 'ne410-b', patch: [
      { op: 'set', id: 'dial', material: 'chrome' },
      { op: 'set', path: '/movers/0/states', value: [0, 0.27] },
      { op: 'set', path: '/grid', value: true },
      { op: 'remove', id: 'holdknob' },
      { op: 'add', into: 'lathes', entry: { id: 'usbcap2', axisFrom: { x: 3, y: 0, z: 2 }, axisTo: { x: 3.6, y: 0, z: 2 }, profile: [{ t: 0, radius: 0.5 }, { t: 1, radius: 0.5 }], material: 'rubber' } },
    ] });
    const a = SketchRepository.getByRef('ne410-a').manifest;
    const b = SketchRepository.getByRef('ne410-b').manifest;
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(b.ledger).toEqual(a.ledger);                    // G6 re-stamped identically
  });

  it('a refused patch (bad material via set) leaves the row and the revision table untouched', async () => {
    await createWorkbenchHandler({ title: 'cyl', ref: 'wb-patch-bad', lathes: [{ ...CYL, id: 'post' }] });
    await expect(updateSketchHandler({ ref: 'wb-patch-bad', patch: [{ op: 'set', id: 'post', material: 'unobtainium' }] }))
      .rejects.toThrow(/material/);
    expect(SketchRepository.getByRef('wb-patch-bad').manifest.lathes[0].material).toBeUndefined();
    expect(SketchRevisionRepository.list('wb-patch-bad')).toEqual([]);
    // an op the applier refuses is named by index, before any gate runs
    await expect(updateSketchHandler({ ref: 'wb-patch-bad', patch: [{ op: 'set', id: 'nope', material: 'steel' }] }))
      .rejects.toThrow(/Invalid patch: patch\[0\]: no monomer carries id 'nope'/);
    expect(SketchRevisionRepository.list('wb-patch-bad')).toEqual([]);
  });

  it('patch + manifest together, an empty patch, and a bad readout are refused up front', async () => {
    await createWorkbenchHandler({ title: 'cyl', ref: 'wb-patch-x', lathes: [{ ...CYL, id: 'post' }] });
    const m = SketchRepository.getByRef('wb-patch-x').manifest;
    await expect(updateSketchHandler({ ref: 'wb-patch-x', manifest: m, patch: [{ op: 'set', path: '/grid', value: false }] })).rejects.toThrow(/exclusive/);
    await expect(updateSketchHandler({ ref: 'wb-patch-x', patch: [] })).rejects.toThrow(/non-empty array/);
    await expect(updateSketchHandler({ ref: 'wb-patch-x', patch: [{ op: 'set', path: '/grid', value: false }], readout: 'all' })).rejects.toThrow(/readout/);
    await expect(updateSketchHandler({ ref: 'no-such', patch: [{ op: 'set', path: '/grid', value: false }] })).rejects.toThrow(/No sketch exists/);
    expect(SketchRevisionRepository.list('wb-patch-x')).toEqual([]);
  });

  it('a patch on an edifice mass edits in place (no kind-specific patch logic)', async () => {
    await createEdificeHandler({ ...CAMPUS, title: 'Campus', ref: 'ed-patch' });
    const r = await updateSketchHandler({ ref: 'ed-patch', patch: [{ op: 'set', path: '/masses/1/floors', value: 4 }] });
    expect(r.ok).toBe(true);
    expect(r.stats).toBeUndefined();                       // readout is a workbench thing; nothing else changes
    expect(SketchRepository.getByRef('ed-patch').manifest.masses.find((m) => m.id === 'wing').floors).toBe(4);
    expect(SketchRevisionRepository.get('ed-patch', 1).patch).toEqual([{ op: 'set', path: '/masses/1/floors', value: 4 }]);
  });
});

describe('update_sketch { readout } — what an edit hands back (Phase 3)', () => {
  const CYL = (id, x = 0, z = 6) => ({ id, axisFrom: { x, y: 0, z: 0 }, axisTo: { x, y: 0, z }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] });

  it('parts[] rows carry the monomer id (additive)', () => {
    const { stats } = planWorkbench({ kind: 'workbench', lathes: [CYL('post'), { ...CYL('x'), id: undefined }] });
    expect(stats.parts[0]).toMatchObject({ kind: 'lathe', index: 0, id: 'post' });
    expect('id' in stats.parts[1]).toBe(false);
  });

  it("'full' on a manifest replacement is the block the pre-plan handler returned (default unchanged)", async () => {
    await createWorkbenchHandler({ title: 'two', ref: 'wb-ro-full', lathes: [CYL('a'), CYL('b', 6)] });
    const stored = SketchRepository.getByRef('wb-ro-full').manifest;
    const edited = { ...stored, lathes: [CYL('a'), CYL('b', 6, 8)] };
    const r = await updateSketchHandler({ ref: 'wb-ro-full', manifest: edited });
    const { ledger: _l, ...expected } = planWorkbench(edited).stats;
    const { ledger: _r, ...got } = r.stats;
    expect(got).toEqual(expected);                          // no readout key, every part, verbatim
    expect(got.readout).toBeUndefined();
  });

  it("'changed' on a one-part set returns exactly that part; 'summary' drops parts", async () => {
    await createWorkbenchHandler({ title: 'two', ref: 'wb-ro-one', lathes: [CYL('a'), CYL('b', 6)] });
    const r = await updateSketchHandler({ ref: 'wb-ro-one', patch: [{ op: 'set', id: 'b', axisTo: { x: 6, y: 0, z: 9 } }] });
    expect(r.stats.readout).toBe('changed');
    expect(r.stats.parts.map((p) => p.id)).toEqual(['b']);
    expect(r.stats.parts[0].top).toBe(9);
    expect(r.stats.parts_total).toBe(2);
    expect(r.stats).toMatchObject({ monomers: 2, faces: expect.any(Number), size: expect.any(Object), ledger: expect.any(Object) });
    expect(r.stats.warnings).toBeUndefined();
    const s = await updateSketchHandler({ ref: 'wb-ro-one', patch: [{ op: 'set', id: 'a', material: 'steel' }], readout: 'summary' });
    expect(s.stats.readout).toBe('summary');
    expect(s.stats.parts).toBeUndefined();
    expect(s.stats.monomers).toBe(2);
  });

  it('a touched part whose geometry did not move is reported; so is an untouched part a neighbour re-cut; a removed part is named', async () => {
    await mintNe410('ne410-ro');
    const r = await updateSketchHandler({ ref: 'ne410-ro', patch: [
      // the dial is consumed by the 'dialglyphs' cut: widening it moves the CUT part, which the patch never named
      { op: 'set', id: 'dial', profile: [{ t: 0, radius: 1.4 }, { t: 0.75, radius: 1.4 }, { t: 1, radius: 1.3 }] },
      { op: 'set', id: 'menu', material: 'chrome' },       // touched, geometry unchanged
      { op: 'remove', id: 'holdknob' },                     // a standalone part, gone
    ] });
    const ids = r.stats.parts.map((p) => p.id);
    expect(ids).toContain('menu');
    expect(ids).toContain('dialglyphs');
    expect(ids).not.toContain('lid');
    expect(r.stats.removed).toEqual(['holdknob']);
    expect(r.stats.parts_total).toBe(27);
    expect(r.stats.parts.length).toBe(2);
  });

  it('touching a monomer a cut consumes surfaces the CUT part (its own id is not a part)', async () => {
    await mintNe410('ne410-cut');
    // the g_stop glyph is subtracted from the dial: nudging its profile changes nothing measurable
    // on the dial's bounds, yet the edit was to that part — the MZ-NE410 rev 5→6 case
    const stop = MZ_NE410.extrudes.find((e) => e.id === 'g_stop');
    const r = await updateSketchHandler({ ref: 'ne410-cut', patch: [{ op: 'set', id: 'g_stop', axisTo: { ...stop.axisTo, y: stop.axisTo.y - 0.01 } }] });
    expect(r.stats.parts.map((p) => p.id)).toEqual(['dialglyphs']);
    expect(r.stats.parts[0]).toMatchObject({ kind: 'field', cut: 'dialglyphs', from: 'dial' });
  });

  it('warnings already on the previous revision collapse to one counted line; a new one is spelled out', async () => {
    await mintNe410('ne410-warn');
    // MZ-NE410 carries THREE standing advisories: an open relief, the cut's edge rounding, and —
    // since the field-contribution gate landed — its `spindle` term, which measures 0% exposed
    // inside the body union. The count is what this test is about, not the findings; the spindle
    // is a real one and stands until the fixture's recipe is the thing being fixed.
    const r1 = await updateSketchHandler({ ref: 'ne410-warn', patch: [{ op: 'set', id: 'menu', material: 'chrome' }] });
    expect(r1.stats.warnings).toEqual(['3 warnings unchanged from rev 1']);
    // a coarser cut re-words its edge-rounding advisory: a NEW line beside the collapsed count
    const r2 = await updateSketchHandler({ ref: 'ne410-warn', patch: [{ op: 'set', path: '/cuts/0/cells', value: 32 }] });
    expect(r2.stats.warnings.at(-1)).toBe('2 warnings unchanged from rev 2');
    expect(r2.stats.warnings.length).toBe(2);
    expect(r2.stats.warnings[0]).toMatch(/cut 'dialglyphs'/);
  });
});

// ring-plan: the layered kind's PLAN door stores the plan beside the recipe; an edit under /plan
// re-expands the recipe, an edit under /dials leaves the plan alone; every edit pays the layered gates.
import { mintSolidHandler } from './mint-solid.js';

const RING_PLAN = {
  schema: 'layered-plan-v1', frame: { up: '+z', front: '+y' },
  joints: { hip: [0.2, 0, 1], knee: [0.22, 0.1, 0.5], toe: [0.22, 0.3, 0.05] },
  segments: [
    { name: 'torso', kind: 'trunk', stations: [{ z: 0.9, r: [0.3, 0.22] }, { z: 1.3, r: [0.32, 0.24] }, { z: 1.7, r: [0.2, 0.16] }], caps: { back: [0, 0, 0.8], tip: [0, 0, 1.8] }, group: 'Torso', tint: '#667', mirror: 'plane' },
    { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.14, rB: 0.1, group: 'Legs', tint: '#565', mirror: 'name' },
    { name: 'shinR', kind: 'segment', from: 'knee', to: 'toe', rA: 0.1, rB: [0.08, 0.04], over: [0.6, 0.3], group: 'Legs', tint: '#565', mirror: 'name' },
  ],
  dials: { bulk: { min: 0.8, max: 1.3, rest: 1, doc: 'x scale of the trunk', op: 'scale', axis: 'x', pivot: 0, parts: ['torso'], blend: { st0: 1, st1: 1, st2: 1, back: 1, tip: 1 } } },
};

describe('update_sketch on a layered solid minted through the plan door', () => {
  it('stores plan + recipe; a /plan patch re-expands the recipe; a /dials patch keeps the plan; a bad plan edit refuses with a pointer', async () => {
    const minted = await mintSolidHandler({ kind: 'layered', via: 'plan', ref: 'ring-plan-biped', spec: { plan: RING_PLAN, title: 'biped' } });
    expect(minted.ok).toBe(true);
    const stored = SketchRepository.getByRef('ring-plan-biped');
    expect(stored.manifest.kind).toBe('layered'); expect(stored.manifest.plan.schema).toBe('layered-plan-v1');
    expect(Object.keys(stored.manifest.recipe.parts)).toEqual(['torso', 'thighR', 'thighL', 'shinR', 'shinL']);
    expect(stored.manifest.ledger.closed).toBe(true);
    // a plan edit: a wider knee → the recipe's shin ring moves; the dial value survives
    await updateSketchHandler({ ref: 'ring-plan-biped', patch: [{ op: 'set', path: '/dials/bulk', value: 1.2 }] });
    const r = await updateSketchHandler({ ref: 'ring-plan-biped', patch: [{ op: 'set', path: '/plan/joints/knee', value: [0.3, 0.1, 0.5] }] });
    expect(r.ok).toBe(true); expect(r.stats.closed).toBe(true);
    const after = SketchRepository.getByRef('ring-plan-biped');
    expect(after.manifest.plan.joints.knee).toEqual([0.3, 0.1, 0.5]); expect(after.manifest.dials.bulk).toBe(1.2);
    expect(after.manifest.recipe.parts.thighR.stations[2].points.front[0]).toBeGreaterThan(stored.manifest.recipe.parts.thighR.stations[2].points.front[0]);
    expect(after.manifest.recipe.parts.thighL.stations[2].points.front[0]).toBeCloseTo(-after.manifest.recipe.parts.thighR.stations[2].points.front[0], 12);
    // a dial-only edit leaves the plan untouched and still pays the gates (an unknown dial refuses)
    await expect(updateSketchHandler({ ref: 'ring-plan-biped', patch: [{ op: 'set', path: '/dials/nope', value: 1 }] })).rejects.toThrow(/unknown dial 'nope'/);
    // a plan edit that breaks the plan refuses with the plan field named
    await expect(updateSketchHandler({ ref: 'ring-plan-biped', patch: [{ op: 'set', path: '/plan/segments/1/from', value: 'knuckle' }] })).rejects.toThrow(/names joint 'knuckle'/);
    expect(SketchRepository.getByRef('ring-plan-biped').manifest.plan.joints.knee).toEqual([0.3, 0.1, 0.5]);
  });
  it('the plan door refuses a missing plan with a pointer to the manual', async () => {
    await expect(mintSolidHandler({ kind: 'layered', via: 'plan', spec: {} })).rejects.toThrow(/needs `plan`/);
  });
});

describe('the plan door records who printed the plan', () => {
  it('a text-worker audit is stored as provenance; an agent audit needs no prompt; a malformed audit refuses', async () => {
    const minted = await mintSolidHandler({ kind: 'layered', via: 'plan', ref: 'ring-plan-audited', spec: { plan: RING_PLAN, plan_audit: { source: 'text:codex', prompt: 'fill the biped ring plan for a lean courier lizard', token: 'resp_01' } } });
    expect(minted.ok).toBe(true);
    const stored = SketchRepository.getByRef('ring-plan-audited');
    expect(stored.manifest.provenance).toEqual({ kind: 'plan-reconstruction', plan_audit: { source: 'text:codex', prompt: 'fill the biped ring plan for a lean courier lizard', token: 'resp_01' } });
    const own = await mintSolidHandler({ kind: 'layered', via: 'plan', ref: 'ring-plan-own', spec: { plan: RING_PLAN, plan_audit: { source: 'agent' } } });
    expect(SketchRepository.getByRef(own.ref).manifest.provenance.plan_audit).toEqual({ source: 'agent' });
    await expect(mintSolidHandler({ kind: 'layered', via: 'plan', spec: { plan: RING_PLAN, plan_audit: { source: 'text:codex' } } })).rejects.toThrow(/plan_audit.prompt: required|job_id \| token/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'plan', spec: { plan: RING_PLAN, plan_audit: { source: 'dreamt' } } })).rejects.toThrow(/plan_audit.source/);
    expect(SketchRepository.getByRef('ring-plan-biped') ?? null).toBeNull();   // nothing minted for the refused calls under a fresh db
  });
});

// hero-tune: the HERO door. A cast word and a tune (percentages of the cast's own baseline) mint the hero form with
// `hero` stored beside `plan` and `recipe`; a patch under /hero regenerates plan and recipe by word; the readout
// answers in metres; a hand edit under /plan is kept until the next /hero edit, which says it replaced it.
describe('update_sketch on a hero minted through the hero door', () => {
  it('mints from a cast + tune, stores hero + plan + recipe, and a /hero/tune patch regenerates the figure by word', async () => {
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-tuned', spec: { cast: 'female', register: 'lowpoly', tune: ['athletic', { legs: 1.08 }] } });
    expect(minted.ok).toBe(true);
    expect(minted.hero.cast).toBe('female'); expect(minted.hero.from).toBe('athletic');
    expect(minted.hero.tune.shoulders).toBe(1.18); expect(minted.hero.tune.legs).toBe(1.08); expect(minted.hero.tune.calf).toBe(1);
    expect(minted.hero.moved).toEqual({ legs: 1.08, shoulders: 1.18, waist: 0.94 });
    expect(minted.hero.measures.height_m).toBeGreaterThan(1.5); expect(minted.hero.measures.shoulder_m).toBeGreaterThan(0.2); expect(minted.hero.measures.hip_m).toBeGreaterThan(0.2);
    expect(minted.hero.warnings).toBeUndefined();
    expect(minted.next.args.patch[0].path).toBe('/hero/tune/<control>');
    const stored = SketchRepository.getByRef('hero-tuned');
    expect(stored.manifest.kind).toBe('layered'); expect(stored.manifest.hero.tune.shoulders).toBe(1.18); expect(stored.manifest.plan.schema).toBe('layered-plan-v1');
    expect(stored.manifest.plan.style.slots).toBe('ring6'); expect(stored.manifest.recipe.parts.torso).toBeTruthy(); expect(stored.manifest.ledger.closed).toBe(true);
    expect(stored.title).toBe('hero · female · athletic');
    // "broader still": one word, one number; the plan and the recipe follow
    const yoke = (m) => m.plan.segments.find((s) => s.name === 'torso').stations[3].r[0];
    const r = await updateSketchHandler({ ref: 'hero-tuned', patch: [{ op: 'set', path: '/hero/tune/shoulders', value: 1.3 }] });
    expect(r.ok).toBe(true); expect(r.stats.closed).toBe(true);
    expect(r.stats.hero.tune.shoulders).toBe(1.3); expect(r.stats.hero.measures.shoulder_m).toBeGreaterThan(minted.hero.measures.shoulder_m);
    expect(r.stats.hero.warnings).toEqual([expect.stringMatching(/tune\.shoulders 1\.3 .*\[0\.8, 1\.25\]/)]);   // advice, not a refusal
    const after = SketchRepository.getByRef('hero-tuned');
    expect(yoke(after.manifest)).toBeGreaterThan(yoke(stored.manifest));
    expect(after.manifest.recipe.parts.torso.stations[3].points).not.toEqual(stored.manifest.recipe.parts.torso.stations[3].points);
    // a live dial keeps the plan and the hero
    await updateSketchHandler({ ref: 'hero-tuned', patch: [{ op: 'set', path: '/dials/lean', value: 10 }] });
    const dialed = SketchRepository.getByRef('hero-tuned'); expect(dialed.manifest.plan).toEqual(after.manifest.plan); expect(dialed.manifest.dials.lean).toBe(10);
    // a hand edit under /plan is honoured (hero stays as the record) and the next /hero edit says it replaced it
    await updateSketchHandler({ ref: 'hero-tuned', patch: [{ op: 'set', path: '/plan/segments/0/stations/0/r/0', value: 0.3 }] });
    expect(SketchRepository.getByRef('hero-tuned').manifest.hero.tune.shoulders).toBe(1.3);
    const back = await updateSketchHandler({ ref: 'hero-tuned', patch: [{ op: 'set', path: '/hero/tune/waist', value: 1 }] });
    expect(back.stats.hero.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/hand-edited under \/plan .* replaced/)]));
    expect(SketchRepository.getByRef('hero-tuned').manifest.plan.segments[0].stations[0].r[0]).not.toBe(0.3);
    // an unknown control or a bad ratio refuses by name, and the row is untouched
    await expect(updateSketchHandler({ ref: 'hero-tuned', patch: [{ op: 'set', path: '/hero/tune/shoulder', value: 1.1 }] })).rejects.toThrow(/unknown control/);
    await expect(updateSketchHandler({ ref: 'hero-tuned', patch: [{ op: 'set', path: '/hero/tune/legs', value: 0 }] })).rejects.toThrow(/> 0/);
    expect(SketchRepository.getByRef('hero-tuned').manifest.hero.tune.waist).toBe(1);
  });
  it('the door refuses by name: an unknown cast, a proportion word under body, a bad move; identity mints the cast itself', async () => {
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'nobody' } })).rejects.toThrow(/unknown preset 'nobody'.*hero cast \(male, female\)/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { body: { shoulders: 1.1 } } })).rejects.toThrow(/body\.shoulders: not a body control.*belongs in tune/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { tune: 'lanky' } })).rejects.toThrow(/unknown move 'lanky'/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { register: 'smooth' } })).rejects.toThrow(/register: a register word/);
    const plain = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-plain', spec: {} });
    expect(plain.hero.cast).toBe('male'); expect(plain.hero.moved).toEqual({}); expect(plain.hero.from).toBeUndefined();
    expect(SketchRepository.getByRef('hero-plain').title).toBe('hero · male');
    // a figure-cast word is a cast too
    const chibi = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-chibi', spec: { cast: 'chibi', headScale: 1.3, tune: { limbs: 1.2 } } });
    expect(chibi.hero.moved).toEqual({ upperArm: 1.2, forearm: 1.2, thigh: 1.2, calf: 1.2 }); expect(chibi.stats.closed).toBe(true);
  });
});

// face-tune: the hero door wears the fitted landmark head by default; `face` is the face proportion lab's controls as
// ratios about the fit; a patch under /hero/face regenerates the head, the plan and the recipe by word.
describe('the hero door wears a face', () => {
  it('a hero has a face by default; /hero/face/<control> regenerates it; the readout answers in metres', async () => {
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-faced', spec: { cast: 'female', face: ['large-eyes', { noseWidth: 1.1 }], hair: 'bob', expression: 'smile' } });
    expect(minted.ok).toBe(true); expect(minted.hero.head).toBe('landmark'); expect(minted.hero.faceFrom).toBe('large-eyes');
    expect(minted.hero.faceMoved).toEqual({ eyeSpacing: 1.05, eyeSize: 1.15, noseWidth: 1.1 }); expect(minted.hero.hair.style).toBe('bob'); expect(minted.hero.hairMoved).toEqual({}); expect(minted.hero.hairMeasures.top_m).toBeGreaterThan(0); expect(minted.hero.expression).toBe('smile');
    expect(minted.hero.faceMeasures.head_m).toBeGreaterThan(0.15); expect(minted.hero.faceMeasures.pupils_m).toBeGreaterThan(0.04); expect(minted.hero.faceMeasures.jaw_m).toBeGreaterThan(0.06);
    expect(minted.next.reason).toMatch(/\/hero\/face\/<control>/);
    const stored = SketchRepository.getByRef('hero-faced');
    expect(stored.manifest.hero.face.eyeSize).toBe(1.15); expect(stored.manifest.recipe.parts.cranium).toBeTruthy(); expect(stored.manifest.recipe.parts.hairCap).toBeTruthy();
    expect(stored.manifest.recipe.dials.jawOpen).toBeTruthy(); expect(stored.title).toBe('hero · female · large-eyes');
    const jawX = (m) => m.recipe.parts.jaw.stations[0].points.sideR[0];
    const r = await updateSketchHandler({ ref: 'hero-faced', patch: [{ op: 'set', path: '/hero/face/jawWidth', value: 1.2 }] });
    expect(r.ok).toBe(true); expect(r.stats.closed).toBe(true); expect(r.stats.hero.face.jawWidth).toBe(1.2);
    expect(r.stats.hero.faceMeasures.jaw_m).toBeGreaterThan(minted.hero.faceMeasures.jaw_m);
    const after = SketchRepository.getByRef('hero-faced'); expect(jawX(after.manifest)).toBeGreaterThan(jawX(stored.manifest));
    expect(after.manifest.joints).toEqual(stored.manifest.joints);   // a face never moves a joint
    const h = await updateSketchHandler({ ref: 'hero-faced', patch: [{ op: 'set', path: '/hero/hair', value: 'none' }, { op: 'set', path: '/hero/face/faceLength', value: 0.9 }] });
    expect(SketchRepository.getByRef('hero-faced').manifest.recipe.parts.hairCap).toBeUndefined();
    expect(h.stats.hero.warnings).toEqual([expect.stringMatching(/face\.faceLength 0\.9 .*\[0\.92, 1\.15\]/)]);
    await expect(updateSketchHandler({ ref: 'hero-faced', patch: [{ op: 'set', path: '/hero/face/jawline', value: 1.1 }] })).rejects.toThrow(/unknown control/);
    await expect(updateSketchHandler({ ref: 'hero-faced', patch: [{ op: 'set', path: '/hero/hair', value: 'mohawk' }] })).rejects.toThrow(/hair: unknown style 'mohawk'/);
  });
  it("head: 'none' is the blank trunk and takes no face; a figure cast wears the male head; the door refuses by name", async () => {
    const bare = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-bare', spec: { head: 'none' } });
    expect(bare.hero.head).toBe('none'); expect(bare.hero.face).toBeUndefined(); expect(SketchRepository.getByRef('hero-bare').manifest.recipe.parts.head).toBeTruthy();
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'none', face: { jawWidth: 1.1 } } })).rejects.toThrow(/face: only the landmark head/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { face: 'square-jaw' } })).rejects.toThrow(/unknown move 'square-jaw'/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { expression: 'angry' } })).rejects.toThrow(/expression: one of/);
    const chibi = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-chibi-faced', spec: { cast: 'chibi', headScale: 1.3, face: 'broad-jaw' } });
    expect(chibi.stats.closed).toBe(true); expect(SketchRepository.getByRef('hero-chibi-faced').manifest.recipe.parts.cranium).toBeTruthy();
  });
});

// hero-detail: the dragon's BODY DETAIL and ADORNMENT passes worn by the hero through the door. `detail` and `adorn`
// are words stored in `hero`; a /hero patch regenerates them; the readout's `dress` carries the adornment ledger.
describe('a hero dressed through the door', () => {
  it('mints clothed and adorned, every signature justified; /hero/adorn and /hero/detail regenerate by word', async () => {
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-ranger', spec: { cast: 'male', register: 'round', hair: 'crop', detail: 'clothed', adorn: 'ranger' } });
    expect(minted.ok).toBe(true); expect(minted.stats.closed).toBe(true); expect(minted.stats.layered.rig.clips).toEqual(['idle', 'walk', 'wave']);
    expect(minted.hero.dress).toMatchObject({ detail: 'clothed', adorn: 'ranger' });
    expect(minted.hero.dress.parts.detail).toBeGreaterThan(40); expect(minted.hero.dress.parts.adorn).toBeGreaterThanOrEqual(8);
    expect(minted.hero.dress.adornments.map((a) => [a.id, a.verdict])).toEqual([['belt', 'justified'], ['baldric', 'justified'], ['bracer', 'justified'], ['pauldron', 'justified']]);
    // the clearance ledger: the dress FOLLOWS the dials (bulk widens the baldric with the chest), and the one thing it
    // cannot follow is named: the belt is pinned to the torso and `stance` swings the thighs out under it
    expect(minted.hero.dress.clearance.sinking).toEqual(['belt']); expect(minted.hero.dress.clearance.worst.baldric.at).toBe('rest');
    expect(minted.hero.warnings).toEqual([expect.stringMatching(/^adornment belt sinks into thighL, thighR at stance 1\.35/)]);
    expect(minted.hero.dress.legibility.families.find((f) => f.family === 'adorn.pauldron.sig').readsFrom).toBe(64);   // the focal accent reads at the smallest size
    expect(minted.hero.evidence.head).toMatchObject({ fit: 'male', inferred: ['front'], face: 'as fitted' });
    expect(minted.next.reason).toMatch(/\/hero\/adorn \(ranger, none\)/);
    const stored = SketchRepository.getByRef('hero-ranger');
    expect(stored.manifest.hero.detail).toBe('clothed'); expect(stored.manifest.hero.adorn).toBe('ranger');
    expect(stored.manifest.plan.body.tiles.length).toBe(2); expect(stored.manifest.recipe.parts['adorn.pauldron.sig0']).toBeTruthy();
    expect(stored.manifest.recipe.palette.Top).toBe('#56683f');   // the kit's suggestion
    // the kit off: the adornment parts go, the detail stays
    const off = await updateSketchHandler({ ref: 'hero-ranger', patch: [{ op: 'set', path: '/hero/adorn', value: 'none' }] });
    expect(off.ok).toBe(true); expect(off.stats.hero.dress.adorn).toBe('none'); expect(off.stats.hero.dress.adornments).toBeUndefined();
    const bare = SketchRepository.getByRef('hero-ranger').manifest.recipe.parts;
    expect(Object.keys(bare).some((k) => k.startsWith('adorn.'))).toBe(false); expect(Object.keys(bare).some((k) => k.startsWith('tile.quiltFront.'))).toBe(true);
    // the detail off too: the undressed hero
    await updateSketchHandler({ ref: 'hero-ranger', patch: [{ op: 'set', path: '/hero/detail', value: 'none' }] });
    expect(Object.keys(SketchRepository.getByRef('hero-ranger').manifest.recipe.parts).some((k) => k.startsWith('tile.'))).toBe(false);
    // a word the door does not know refuses by name, and the row is untouched
    await expect(updateSketchHandler({ ref: 'hero-ranger', patch: [{ op: 'set', path: '/hero/adorn', value: 'knight' }] })).rejects.toThrow(/adorn: 'ranger' \| 'none'/);
    await expect(updateSketchHandler({ ref: 'hero-ranger', patch: [{ op: 'set', path: '/hero/palette', value: { Top: 'green' } }] })).rejects.toThrow(/palette\.Top: must be a "#rrggbb" colour/);
    expect(SketchRepository.getByRef('hero-ranger').manifest.hero).toMatchObject({ detail: 'none', adorn: 'none' }); expect(SketchRepository.getByRef('hero-ranger').manifest.hero.palette).toBeUndefined();
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { detail: 'armoured' } })).rejects.toThrow(/detail: 'clothed' \| 'none'/);
  });
  it("the blank-headed form wears the dress too (head: 'none')", async () => {
    const r = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-bare-ranger', spec: { cast: 'female', register: 'lowpoly', head: 'none', detail: 'clothed', adorn: 'ranger' } });
    expect(r.stats.closed).toBe(true); expect(r.hero.dress.adornments.every((a) => a.verdict === 'justified')).toBe(true);
  });
});

// read-and-attach: the detail and adornment passes are not character-specific. An OBJECT — a wicker-wrapped flask — goes
// through the plain plan door with `body` (woven tiles, a lip ring) and `adorn` (a band and its buckle), and
// measure_solid reads it back with the legibility and clearance ledgers and says what kind of assembly it is.
const FLASK = path.resolve(process.cwd(), '../docs/examples/ring-plans/flask.plan.json');
describe.skipIf(!existsSync(FLASK))('an object dressed through the plan door', () => {
  it('a wicker-wrapped flask: tiles, a lip ring, a band with a buckle; measure_solid reads it', async () => {
    const plan = JSON.parse(readFileSync(FLASK, 'utf8'));
    const r = await mintSolidHandler({ kind: 'layered', via: 'plan', ref: 'flask', spec: { plan, plan_audit: { source: 'agent' } } });
    expect(r.ok).toBe(true); expect(r.stats.closed).toBe(true);
    const parts = SketchRepository.getByRef('flask').manifest.recipe.parts;
    expect(Object.keys(parts).filter((k) => k.startsWith('tile.wicker.')).length).toBeGreaterThan(80); expect(parts['adorn.band.sig0'].layer).toBe(3); expect(parts['adorn.band'].follow).toBe(true);
    const m = await measureSolidHandler({ ref: 'flask', volume: false });
    expect(m.assembly).toMatch(/^overlapping closed parts/);
    expect(m.legibility.families.find((f) => f.family === 'tile.wicker').readsFrom).toBe(64);
    expect(m.clearance.sinking).toEqual([]); expect(m.clearance.adornments.band.worst.share).toBe(0);
  });
});

