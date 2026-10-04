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
import { heroRecord, heroPlanOf, heroReadout, validateHeroSpec } from './layered.js';

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
    // (the warning names both causes: a stored plan also differs when the hero's generator changed since it was stored)
    expect(back.stats.hero.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/differs from what the hero generates now \(hand-edited under \/plan, or the hero's generator changed .*\); this \/hero edit regenerated the plan and replaced it/)]));
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
  // the child-coded casts guard: a child or chibi figure cast, or the anime 'kid' look, takes no bust, at mint and on an
  // edit; the adult casts take one up to the ceiling every cast has
  it('a child-coded figure refuses a bust by name, at mint and on an edit; every cast refuses a runaway bust', async () => {
    for (const spec of [{ cast: 'child', body: { bust: 0.05 } }, { cast: 'chibi', body: { bust: 0.01 } }, { cast: 'female', head: 'anime', look: ['kid'], body: { bust: 0.12 } }, { cast: 'female', head: 'anime', look: 'kid', body: { bust: 5 } }]) {
      await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec })).rejects.toThrow(/body\.bust: the '(child|chibi)' cast is a child-coded figure and takes no bust|body\.bust: the 'kid' look is a child-coded figure and takes no bust/);
    }
    expect(validateHeroSpec({ cast: 'child', body: { bust: 0 } })).toEqual([]);                           // 0 is no bust
    expect(validateHeroSpec({ cast: 'female', head: 'anime', look: ['heroine'], body: { bust: 0.05 } })).toEqual([]);   // an adult look
    const adult = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-bust', spec: { cast: 'female', register: 'lowpoly', body: { bust: 0.05 } } });
    expect(adult.ok).toBe(true);
    await expect(updateSketchHandler({ ref: 'hero-bust', patch: [{ op: 'set', path: '/hero/cast', value: 'child' }] })).rejects.toThrow(/body\.bust: the 'child' cast is a child-coded figure/);
    expect(SketchRepository.getByRef('hero-bust').manifest.hero.cast).toBe('female');   // the refused edit stored nothing
    // every cast: a bust past 0.4 × the chest radius is a runaway number, refused by name at mint and on an edit
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'female', body: { bust: 5 } } })).rejects.toThrow(/body\.bust 5 is past its ceiling: at most 0\.4 × the chest radius, 0\.078 m/);
    await expect(updateSketchHandler({ ref: 'hero-bust', patch: [{ op: 'set', path: '/hero/body/bust', value: 0.5 }] })).rejects.toThrow(/body\.bust 0\.5 is past its ceiling/);
    expect(SketchRepository.getByRef('hero-bust').manifest.hero.body.bust).toBe(0.05);
  }, 60000);
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

// anime-form: `head: 'anime'` wears the Anime Form Studio's head; `face`, `hair` (families, controls, per-clump locks)
// and `expression` are its words, stored resolved; a patch under /hero regenerates the head, the plan and the recipe.
describe('the hero door wears the anime head', () => {
  it("head: 'anime' mints by the studio's words; /hero/face, /hero/hair/locks/<clump>, /hero/expression regenerate", async () => {
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-anime', spec: { cast: 'female', head: 'anime', face: { eyeHeight: 1.05, tilt: 0.03 }, hair: ['long', { fringe: 0.9 }], expression: 'smile' } });
    // the anime hero stands in its default gesture (hero-gesture.js): a one-key `gesture` clip listed first
    expect(minted.ok).toBe(true); expect(minted.stats.closed).toBe(true); expect(minted.stats.layered.rig.clips).toEqual(['gesture', 'idle', 'walk', 'wave']);
    expect(minted.hero.head).toBe('anime'); expect(minted.hero.base).toBe('female');
    expect(minted.hero.proportions).toBe('anime'); expect(minted.hero.headsTall).toBeGreaterThan(6.3); expect(minted.hero.headsTall).toBeLessThan(6.7);
    expect(minted.hero.faceMoved).toEqual({ eyeHeight: 1.05, tilt: 0.03 }); expect(minted.hero.hair.style).toBe('long'); expect(minted.hero.hairMoved).toEqual({ fringe: 0.9 });
    expect(minted.hero.expression).toEqual({ blink: 0.12, smile: 1, open: 0, brow: 0.3 });
    expect(minted.hero.faceMeasures.head_m).toBeGreaterThan(0.2); expect(minted.hero.faceMeasures.eye_m).toBeGreaterThan(0.02);
    expect(minted.hero.evidence.head).toMatchObject({ base: 'female', face: 'authored off the base: eyeHeight, tilt' });
    expect(minted.next.reason).toMatch(/\/hero\/hair\/locks\/<clump>/);
    const stored = SketchRepository.getByRef('hero-anime');
    expect(stored.title).toBe('hero · female · anime'); expect(stored.manifest.hero.face.eyeHeight).toBe(1.05); expect(stored.manifest.hero.hair.locks).toEqual({});
    // the long family consolidates its clumps into sections; fringe-3 is a member of the left and centre bang sections
    expect(stored.manifest.recipe.parts.face).toBeTruthy(); expect(stored.manifest.recipe.parts.hairFormFringeC).toBeTruthy(); expect(stored.manifest.recipe.parts.hairFringe3).toBeUndefined(); expect(stored.manifest.recipe.dials.jawOpen).toBeUndefined();
    const tip = (m) => m.recipe.parts.hairFormFringeC.offsets;
    const r = await updateSketchHandler({ ref: 'hero-anime', patch: [{ op: 'set', path: '/hero/hair/locks/fringe-3', value: { ty: -0.1, tx: 0.05 } }] });
    expect(r.ok).toBe(true); expect(r.stats.closed).toBe(true); expect(r.stats.hero.hairMoved.locks).toEqual(['fringe-3']);
    const after = SketchRepository.getByRef('hero-anime'); expect(tip(after.manifest)).not.toEqual(tip(stored.manifest));
    expect(after.manifest.recipe.parts.hairFormBackC.offsets).toEqual(stored.manifest.recipe.parts.hairFormBackC.offsets);   // the clump's sections moved, the rest held
    // under the graphic face (the default) the slider read is its face layer times the word (the female nose 0.6 × 2.6)
    // and the feature spacing is advised against the base's bands
    const w = await updateSketchHandler({ ref: 'hero-anime', patch: [{ op: 'set', path: '/hero/face/nose', value: 2.6 }, { op: 'set', path: '/hero/expression', value: 'blink' }, { op: 'set', path: '/hero/hair/style', value: 'short' }] });
    // (the minted eyeHeight 1.05 opens the fissure just past the female band)
    expect(w.stats.hero.warnings).toEqual([expect.stringMatching(/face\.nose 2\.6 puts the studio's slider at 1\.56,/), expect.stringMatching(/face: the opening's height over its width is 0\.8\d*, outside the female band \[0\.55, 0\.8\]: \/hero\/sculpt \{ fissureHeight: … \} moves it \(then \/hero\/sculpt\/<word>\)/), expect.stringMatching(/face: the nose projection \(of H\) is 0\.\d+, outside the female band \[0\.025, 0\.04\]: \/hero\/sculpt \{ tipProjection: … \} moves it/)]);
    // closed lids bury the lenses behind the lid skin; every expression keeps the same parts (the graphic face)
    expect(w.stats.hero.expression.blink).toBe(1); expect(SketchRepository.getByRef('hero-anime').manifest.recipe.parts.irisR).toBeTruthy();
    // the hair base's form grows no crown accents (the short family's six clumps); the word by path grows them back
    expect(SketchRepository.getByRef('hero-anime').manifest.recipe.parts.hairCrownR0).toBeUndefined();
    await updateSketchHandler({ ref: 'hero-anime', patch: [{ op: 'set', path: '/hero/hair/crownAccents', value: 'grow' }] });
    expect(SketchRepository.getByRef('hero-anime').manifest.recipe.parts.hairCrownR0).toBeTruthy();   // the short family grows its crown clumps
    const bald = await updateSketchHandler({ ref: 'hero-anime', patch: [{ op: 'set', path: '/hero/hair', value: 'none' }] });
    expect(bald.stats.closed).toBe(true); expect(SketchRepository.getByRef('hero-anime').manifest.recipe.parts.hairCap).toBeUndefined();
  });
  it('refuses by name: an unknown family, clump, pose or control; the landmark words are not the anime head\'s', async () => {
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', hair: 'ponytail' } })).rejects.toThrow(/unknown anime family 'ponytail'/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', hair: { locks: { 'fringe-12': { ty: 0.1 } } } } })).rejects.toThrow(/not a clump/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', expression: 'furious' } })).rejects.toThrow(/unknown anime pose 'furious'/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', face: { jawWidth: 1.1 } } })).rejects.toThrow(/face\.jawWidth: unknown control/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', headPreset: 'chibi' } })).rejects.toThrow(/anime head's design base/);
    const real = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-anime-real', spec: { cast: 'female', head: 'anime', proportions: 'hero' } });
    expect(real.hero.proportions).toBe('hero'); expect(real.hero.headsTall).toBeGreaterThan(7.3);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', proportions: 'chibi' } })).rejects.toThrow(/proportions: 'anime'/);
    const male = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-anime-male', spec: { cast: 'chibi', head: 'anime', register: 'lowpoly' } });
    expect(male.hero.base).toBe('male'); expect(male.hero.hair.style).toBe('short'); expect(male.stats.closed).toBe(true);
  });
});

// the graphic face: `sculpt` at the hero door (anime-sculpt.js) — on by default and never stored; the stored field is
// SPARSE (only the words that differ from the base; absent when none), `false` (the studio's face) stored; /hero/sculpt
// regenerates; refused by name, and refused on any hero but the anime one.
describe('the hero door: the anime head\'s graphic face', () => {
  it('stored sparse, false stored, the default never stored; /hero/sculpt/<word> regenerates; the readout carries the feature table', async () => {
    expect(heroRecord({ cast: 'female', head: 'anime' }).sculpt).toBeUndefined();
    expect(heroRecord({ cast: 'female', head: 'anime', sculpt: { lidWeight: 1, eyeLevel: 0 } }).sculpt).toBeUndefined();   // neutral words strip away
    expect(heroRecord({ cast: 'female', head: 'anime', sculpt: false }).sculpt).toBe(false);
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-sculpt', spec: { cast: 'male', head: 'anime', gesture: 'rest', sculpt: ['heavy-lid', { lidWeight: 0.8, browThick: 1, fissureShape: 'tri' }] } });
    expect(minted.ok).toBe(true); expect(minted.stats.closed).toBe(true);
    const stored = SketchRepository.getByRef('hero-sculpt');
    expect(stored.manifest.hero.sculpt).toEqual({ lidCover: 1.3, fissureShape: 'tri' });   // heavy-lid's 1.25 × 0.8 is the base's lid again: stripped; browThick 1 too
    expect(minted.hero.sculpt).toEqual(stored.manifest.hero.sculpt);
    expect(minted.hero.evidence.head.sculpt).toMatch(/the graphic face, authored off its base: sculpt .*lidCover 130%.*fissureShape tri/);
    expect(minted.hero.faceMeasures.features.eyeLevel).toBeGreaterThan(0.4); expect(minted.hero.faceMeasures.head_m).toBeGreaterThan(0.2);
    expect(minted.next.reason).toMatch(/\/hero\/sculpt/);
    const parts = stored.manifest.recipe.parts; expect(parts.lidR.through).toBe('fringe'); expect(parts.noseLine).toBeTruthy(); expect(parts.lashR).toBeUndefined();
    // a word by path: regenerates the head; a word set back to the base drops out of the stored layer
    const r = await updateSketchHandler({ ref: 'hero-sculpt', patch: [{ op: 'set', path: '/hero/sculpt/browThick', value: 1.3 }, { op: 'set', path: '/hero/sculpt/lidCover', value: 1 }] });
    expect(r.ok).toBe(true); expect(r.stats.closed).toBe(true);
    const after = SketchRepository.getByRef('hero-sculpt');
    expect(after.manifest.hero.sculpt).toEqual({ fissureShape: 'tri', browThick: 1.3 });
    expect(after.manifest.recipe.parts.browR.offsets).not.toEqual(parts.browR.offsets); expect(after.manifest.recipe.parts.earR.offsets).toEqual(parts.earR.offsets);
    // false: the studio's face, stored; back to the default by null
    const off = await updateSketchHandler({ ref: 'hero-sculpt', patch: [{ op: 'set', path: '/hero/sculpt', value: false }] });
    expect(off.stats.hero.sculpt).toBe(false); expect(off.stats.hero.faceMeasures.features).toBeUndefined();
    expect(SketchRepository.getByRef('hero-sculpt').manifest.hero.sculpt).toBe(false); expect(SketchRepository.getByRef('hero-sculpt').manifest.recipe.parts.lashR).toBeTruthy();
    await updateSketchHandler({ ref: 'hero-sculpt', patch: [{ op: 'set', path: '/hero/sculpt', value: null }] });
    expect('sculpt' in SketchRepository.getByRef('hero-sculpt').manifest.hero).toBe(false); expect(SketchRepository.getByRef('hero-sculpt').manifest.recipe.parts.lidR).toBeTruthy();
  }, 60000);
  it('refuses an unknown word by name, and a sculpt on any hero but the anime one', async () => {
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', sculpt: { lidWidth: 1.2 } } })).rejects.toThrow(/sculpt\.lidWidth: unknown control/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', sculpt: 'big-eyes' } })).rejects.toThrow(/unknown sculpt move 'big-eyes'/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', sculpt: { browShape: 'arch' } } })).rejects.toThrow(/sculpt\.browShape: one of block, taper/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'male', sculpt: { lidWeight: 1.2 } } })).rejects.toThrow(/sculpt: the graphic face is the anime head's/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'male', head: 'none', sculpt: false } })).rejects.toThrow(/sculpt: the graphic face is the anime head's/);
    expect(validateHeroSpec({ cast: 'male', sculpt: null })).toEqual([]);
  });
  it('a look carries graphic-face traits on its own channel; the own layer composes on top', () => {
    const plain = heroRecord({ cast: 'female', head: 'anime' }), looked = heroRecord({ cast: 'female', head: 'anime', look: ['heavy-lid'] });
    expect(looked.lookResolved.sculpt).toMatchObject({ lidWeight: 1.25, lidCover: 1.3 }); expect(plain.lookResolved).toBeUndefined();
    expect(heroRecord({ cast: 'female', head: 'anime', look: ['heroine'] }).lookResolved.sculpt).toBeUndefined();   // a look without one keeps its stamp as it was
    const lidOf = (hero) => heroPlanOf(hero).include[0].parts.lidR.offsets;
    expect(lidOf(looked)).not.toEqual(lidOf(plain));
    expect(lidOf({ ...looked, sculpt: { lidWeight: 0.8 } })).toEqual(lidOf({ ...plain, sculpt: { lidWeight: 1, lidCover: 1.3 } }));   // 1.25 × 0.8 over the look's cover
  });
});

// the hair bases (anime-head ANIME_HAIR_BASE): the anime hero's default hair per design base — the FORM (the lift, thicker
// ridge sections, no crown accents) under every family, the CUT (swept-back on the male, side-parted on the female) while
// nothing names a family — with the base's hair colour under the operator's palette; read at plan time, never stored. The
// hair form's words ride on the hair SPARSE (only when given; false the studio's construction, null back to the base's).
describe('the hero door: the anime hair bases and the hair form words', () => {
  it('the default hair per base, never stored; a named family keeps the form and drops the cut; the palette is the operator\'s first', () => {
    const female = heroRecord({ cast: 'female', head: 'anime' }), male = heroRecord({ cast: 'male', head: 'anime' });
    for (const hr of [female, male]) expect(Object.keys(hr.hair)).toEqual(['style', 'volume', 'length', 'fringe', 'clump', 'thickness', 'taper', 'sweep', 'part', 'ahoge', 'strands', 'locks']);   // nothing of the base stored
    const inc = (hr) => heroPlanOf(hr).include[0];
    expect(inc(female).hair).toMatchObject({ style: 'long', part: 0.15, length: 1.2, thickness: 1.4, lift: { crown: 0.13, temple: 0.06, fringe: 0.05, nape: 0.07 }, section: 'ridge', crownAccents: 'none', fringeGroups: [[1, 2, 3, 4, 5], [5, 6, 7]], backNotch: 0.9, ridge: 0.8, flute: 0.35 });
    expect(inc(male).hair).toMatchObject({ style: 'short', clump: 1.12, thickness: 1.5, lift: { crown: 0.12, temple: 0.06, fringe: 0.06, nape: 0.05 }, section: 'ridge', crownAccents: 'none', hairline: { front: 0.7 } });
    expect(inc(male).hair.sweepBack).toMatchObject({ amount: 1, rise: 1.75, tipY: 0.85, tipZ: 0.75 }); expect(inc(male).hair.sweepSides).toMatchObject({ amount: 1, from: 1 });
    expect(heroPlanOf(female).palette.Hair).toBe('#465365'); expect(heroPlanOf(male).palette.Hair).toBe('#644634'); expect(heroPlanOf(male).palette.Ink).toBe('#16181c');
    expect(heroPlanOf(heroRecord({ cast: 'female', head: 'anime', palette: { Hair: '#aa3322' } })).palette.Hair).toBe('#aa3322');   // the operator's palette wins
    // a named family (by the operator or a look): that family, the form under it, no cut
    const bob = inc(heroRecord({ cast: 'female', head: 'anime', hair: 'bob' })).hair;
    expect(bob).toMatchObject({ style: 'bob', part: 0, length: 1, thickness: 1.4, section: 'ridge' }); expect(bob.fringeGroups).toBeUndefined(); expect(bob.locks).toEqual({});
    expect(inc(heroRecord({ cast: 'female', head: 'anime', look: ['heroine'] })).hair).toMatchObject({ style: 'long', sweep: 0.2, part: 0.1, lift: { crown: 0.13 } });
    // a face-only look keeps the cut; the base's cut is a word anywhere a hair word goes
    expect(inc(heroRecord({ cast: 'female', head: 'anime', look: ['tsurime'] })).hair.style).toBe('long');
    expect(inc(heroRecord({ cast: 'female', head: 'anime', look: ['swept-back'] })).hair).toMatchObject({ style: 'short', lift: { crown: 0.13 }, sweepBack: { amount: 1 } });
    // the parts: the male's swept locks and no crown accents; the female's one dominant bang and its partner
    expect(Object.keys(heroPlanOf(male).include[0].parts).filter((k) => /^hairCrown/.test(k))).toEqual([]);
    expect(Object.keys(heroPlanOf(female).include[0].parts).filter((k) => /^hairFormFringe/.test(k))).toEqual(['hairFormFringeA', 'hairFormFringeB']);
  });
  it('the words by path regenerate and stay sparse; false is the studio\'s construction, null the base\'s; the readout and its advice', async () => {
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-hairform', spec: { cast: 'male', head: 'anime', gesture: 'rest' } });
    expect(minted.ok).toBe(true); expect(minted.stats.closed).toBe(true); expect(minted.hero.warnings).toBeUndefined();
    expect(minted.hero.hairCut).toBe('swept-back'); expect(minted.hero.hairMoved).toEqual({}); expect(minted.hero.evidence.head.hair).toBe('the male hair base: the swept-back cut over its form');
    expect(minted.hero.hairCoverage.views.back).toBeLessThanOrEqual(0.02); expect(minted.next.reason).toMatch(/\/hero\/hair\/<word> \(lift, section/);
    const cap = (ref) => SketchRepository.getByRef(ref).manifest.recipe.parts.hairCap.offsets;
    const before = cap('hero-hairform');
    // an object word merges key by key over the base's; stored as given
    const r = await updateSketchHandler({ ref: 'hero-hairform', patch: [{ op: 'set', path: '/hero/hair/lift', value: { crown: 0.2 } }] });
    expect(r.ok).toBe(true); expect(r.stats.closed).toBe(true); expect(r.stats.hero.hair.lift).toEqual({ crown: 0.2, temple: 0.06, fringe: 0.06, nape: 0.05 });
    expect(SketchRepository.getByRef('hero-hairform').manifest.hero.hair.lift).toEqual({ crown: 0.2 }); expect(cap('hero-hairform')).not.toEqual(before);
    // volume beside the lift: advised (the fringe's control points scale into a visor)
    const v = await updateSketchHandler({ ref: 'hero-hairform', patch: [{ op: 'set', path: '/hero/hair/volume', value: 1.1 }] });
    expect(v.stats.hero.warnings).toEqual([expect.stringMatching(/^hair\.volume 1\.1 beside the lift: .*visor/)]);
    // false: the studio's cap (no lift), stored; null: the base's again, dropped from the record
    await updateSketchHandler({ ref: 'hero-hairform', patch: [{ op: 'set', path: '/hero/hair/volume', value: 1 }, { op: 'set', path: '/hero/hair/lift', value: false }] });
    expect(SketchRepository.getByRef('hero-hairform').manifest.hero.hair.lift).toBe(false);
    const flat = SketchRepository.getByRef('hero-hairform').manifest.plan.include[0].hairMeasures.top_m;
    const back = await updateSketchHandler({ ref: 'hero-hairform', patch: [{ op: 'set', path: '/hero/hair/lift', value: null }] });
    expect(back.ok).toBe(true); expect('lift' in SketchRepository.getByRef('hero-hairform').manifest.hero.hair).toBe(false); expect(cap('hero-hairform')).toEqual(before);
    expect(SketchRepository.getByRef('hero-hairform').manifest.plan.include[0].hairMeasures.top_m).toBeGreaterThan(flat);
    // the round section by word; a family by word drops the cut
    const round = await updateSketchHandler({ ref: 'hero-hairform', patch: [{ op: 'set', path: '/hero/hair/section', value: 'round' }, { op: 'set', path: '/hero/hair/style', value: 'short' }] });
    expect(round.stats.hero.hair.section).toBe('round'); expect(round.stats.hero.hairCut).toBeNull(); expect(round.stats.hero.hair.sweepBack).toBeUndefined();
    expect(round.stats.hero.evidence.head.hair).toBe("a named family over the hair base's form");
  }, 60000);
  it('refuses a bad hair form word by name', async () => {
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', hair: { lift: { top: 0.1 } } } })).rejects.toThrow(/hair\.lift\.top: not a lift field/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', hair: { lift: { crown: -0.1 } } } })).rejects.toThrow(/hair\.lift\.crown: a number in \[0, 0\.5\]/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', hair: { section: 'square' } } })).rejects.toThrow(/hair\.section: round \| ridge/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', hair: { crownAccents: 'hide' } } })).rejects.toThrow(/hair\.crownAccents: grow \| tuck \| none/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', hair: { fringeGroups: [[1, 3]] } } })).rejects.toThrow(/hair\.fringeGroups: a list of bang sections/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', hair: { sweepBack: { rise: 1.2 } } } })).rejects.toThrow(/hair\.sweepBack: needs its amount/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', hair: { backNotch: 0 } } })).rejects.toThrow(/hair\.backNotch/);
    // the landmark head's hair has its own words
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'male', hair: { lift: { crown: 0.1 } } } })).rejects.toThrow(/hair/);
  });
});

// the stand: `gesture` at the hero door is a preset word (per cast), pose words, or a list; stored as given; the anime hero
// stands `relaxed` by default (a plan-time default, never stored). It rides as a one-key `gesture` clip first in the plan
// (the mint's rig gates check it; the World poses the static solid at it); /hero/gesture regenerates; the readout
// measures the stand and the budget.
describe('the hero door stands the hero in a gesture', () => {
  it('the anime hero stands relaxed; /hero/gesture regenerates by word, by pose words and back to rest; the readout measures it', async () => {
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-stand', spec: { cast: 'female', head: 'anime' } });
    expect(minted.ok).toBe(true); expect(minted.stats.closed).toBe(true); expect(minted.stats.layered.rig.clips[0]).toBe('gesture');
    // the structured core's relaxed stand plants both feet on its own base (hero-gesture.js STRUCTURED_STANDS): no free sole
    expect(minted.hero.gesture).toEqual({ word: 'relaxed', support: 'both', clearance: { pairs: {}, worstMm: 0 } });
    expect(minted.hero.warnings).toBeUndefined(); expect(minted.next.reason).toMatch(/\/hero\/gesture \(rest, relaxed, hand-on-hip, guard/);
    // the budget: triangles and vertices per palette group, the stored plan and recipe in bytes
    const b = minted.hero.budget; expect(b.triangles).toBe(minted.stats.faces); expect(b.vertices).toBe(minted.stats.vertices);
    expect(Object.keys(b.groups)).toEqual(expect.arrayContaining(['Skin', 'Hair', 'Iris', 'Pupil', 'Sclera', 'Ink', 'Top', 'Bottom', 'Shoes']));
    expect(Object.values(b.groups).reduce((s, g) => s + g.triangles, 0)).toBe(b.triangles);
    const row = () => SketchRepository.getByRef('hero-stand');
    expect(b.bytes.plan).toBe(Buffer.byteLength(JSON.stringify(row().manifest.plan))); expect(b.bytes.recipe).toBe(Buffer.byteLength(JSON.stringify(row().manifest.recipe)));
    expect(row().manifest.hero.gesture).toBeUndefined(); expect(Object.keys(row().manifest.recipe.clips)).toEqual(['gesture', 'idle', 'walk', 'wave']);
    // a word: the mirror stance
    const hip = await updateSketchHandler({ ref: 'hero-stand', patch: [{ op: 'set', path: '/hero/gesture', value: 'hand-on-hip' }] });
    expect(hip.ok).toBe(true); expect(hip.stats.layered.rig.clips[0]).toBe('gesture'); expect(hip.stats.hero.gesture).toMatchObject({ word: 'hand-on-hip', support: 'both' });
    expect(row().manifest.recipe.clips.gesture).toHaveLength(1); expect(row().manifest.recipe.clips.gesture[0].support).toBe('both'); expect(row().manifest.recipe.clips.gesture[0].stagger).toBeGreaterThan(0);   // the mirror stance on its own base: the left foot ahead
    // a list: the relaxed stand, chin down (the gesture owns the head's pitch)
    const chin = await updateSketchHandler({ ref: 'hero-stand', patch: [{ op: 'set', path: '/hero/gesture', value: ['relaxed', { head: { pitch: -12 } }] }] });
    expect(chin.stats.hero.gesture.word).toBe('relaxed+data'); expect(row().manifest.recipe.clips.gesture[0].head).toEqual({ yaw: 10, pitch: -12 });
    // a reshaping dial beside a stand advises (the rig poses the rest joints)
    const lean = await updateSketchHandler({ ref: 'hero-stand', patch: [{ op: 'set', path: '/dials/lean', value: 10 }] });
    expect(lean.stats.hero.warnings).toEqual([expect.stringMatching(/gesture 'relaxed\+data' beside lean 10: the stand poses the rest joints/)]);
    await updateSketchHandler({ ref: 'hero-stand', patch: [{ op: 'set', path: '/dials/lean', value: 0 }] });
    // refused by name; the row untouched
    await expect(updateSketchHandler({ ref: 'hero-stand', patch: [{ op: 'set', path: '/hero/gesture', value: 'strut' }] })).rejects.toThrow(/gesture: unknown gesture word 'strut'/);
    await expect(updateSketchHandler({ ref: 'hero-stand', patch: [{ op: 'set', path: '/hero/gesture', value: { wristR: { flex: 30 } } }] })).rejects.toThrow(/gesture\.wristR: the hand is rigid on the forearm/);
    expect(row().manifest.hero.gesture).toEqual(['relaxed', { head: { pitch: -12 } }]);
    // back to rest: no stand clip, no stand readout
    const rest = await updateSketchHandler({ ref: 'hero-stand', patch: [{ op: 'set', path: '/hero/gesture', value: 'rest' }] });
    expect(rest.stats.layered.rig.clips).toEqual(['idle', 'walk', 'wave']); expect(rest.stats.hero.gesture).toBeUndefined(); expect(row().manifest.recipe.clips.gesture).toBeUndefined();
  });
  it('refuses an unknown word at the door; a landmark hero stands only when it says so; a stand the body does not fit advises', async () => {
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', gesture: 'dance' } })).rejects.toThrow(/gesture: unknown gesture word 'dance' \(rest, relaxed, hand-on-hip, guard/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { gesture: { support: 'none' } } })).rejects.toThrow(/gesture\.support: 'both' \| 'L' \| 'R'/);
    const plain = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-still', spec: { cast: 'male' } });
    expect(plain.stats.layered.rig.clips).toEqual(['idle', 'walk', 'wave']); expect(plain.hero.gesture).toBeUndefined(); expect(SketchRepository.getByRef('hero-still').manifest.hero.gesture).toBeUndefined();
    expect(plain.hero.budget.groups.Skin.triangles).toBeGreaterThan(0);
    const guard = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-guard', spec: { cast: 'male', gesture: 'guard' } });
    expect(guard.ok).toBe(true); expect(guard.stats.layered.rig.clips[0]).toBe('gesture'); expect(guard.hero.gesture.word).toBe('guard');
    // the male's placed hands on the chibi body: the readout names what sinks and where the free foot went
    const chibi = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-chibi-guard', spec: { cast: 'chibi', head: 'anime', gesture: 'guard' } });
    expect(chibi.ok).toBe(true); expect(chibi.hero.gesture.clearance.worstMm).toBeGreaterThan(5);
    // (the structured core's guard plants both feet, so no free foot sinks: only the arm's placement is advised)
    expect(chibi.hero.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/^gesture 'guard': (hand|foreArm)R sinks [\d.]+ mm into (torso|thighR)/)]));
    expect(chibi.hero.warnings.some((w) => /free right foot/.test(w))).toBe(false);
  });
});

// the door's clips: `clips` at the hero door is `{ <name>: [keys] | false }` in the rig's pose words, stored as given and
// merged over the hero's own when the plan is generated; /hero/clips and /hero/clips/<name> regenerate, any other /hero
// edit keeps them (the plan regenerates from the record); a bad word, the stand's name and an unsolvable key refuse by
// name and leave the row as it was.
describe("the hero door's clips through update_sketch", () => {
  it('mints with a clip; it survives an unrelated /hero edit; /hero/clips/<name> replaces, removes and re-adds; refusals leave the row', async () => {
    const K = [{ armR: 'forward', elbowR: 'slight' }, { armR: ['forward', 'up'], elbowR: 'half', head: { x: 0.1, y: 0.95, z: 0.3 } }];
    const K2 = [{}, { armL: ['forward', 'up'], elbowL: 'half', head: 'up' }];
    const row = () => SketchRepository.getByRef('hero-clips');
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-clips', spec: { cast: 'male', head: 'none', register: 'lowpoly', clips: { reach: K } } });
    expect(minted.ok).toBe(true); expect(minted.stats.layered.rig.clips).toEqual(['idle', 'walk', 'wave', 'reach']);
    expect(minted.hero.clips).toEqual({ plays: ['idle', 'walk', 'wave', 'reach'], authored: ['reach'] }); expect(minted.next.reason).toMatch(/Clips: set \/hero\/clips to \{ <name>: \[keys\] \}.*; a name the figure plays \(idle, walk, wave, reach\) replaces that clip/);
    expect(row().manifest.hero.clips).toEqual({ reach: K }); expect(row().manifest.recipe.clips.reach).toEqual(K);
    // an unrelated /hero edit regenerates the plan from the record: the clip rides along
    const legs = await updateSketchHandler({ ref: 'hero-clips', patch: [{ op: 'set', path: '/hero/tune/legs', value: 1.05 }] });
    expect(legs.ok).toBe(true); expect(legs.stats.layered.rig.clips).toEqual(['idle', 'walk', 'wave', 'reach']); expect(row().manifest.recipe.clips.reach).toEqual(K);
    // by name: one door clip replaced, one of the hero's own removed
    const swap = await updateSketchHandler({ ref: 'hero-clips', patch: [{ op: 'set', path: '/hero/clips/reach', value: K2 }, { op: 'set', path: '/hero/clips/wave', value: false }] });
    expect(swap.stats.layered.rig.clips).toEqual(['idle', 'walk', 'reach']); expect(swap.stats.hero.clips).toEqual({ plays: ['idle', 'walk', 'reach'], authored: ['reach'], removed: ['wave'] });
    expect(row().manifest.recipe.clips.reach).toEqual(K2); expect(row().manifest.recipe.clips.wave).toBeUndefined();
    // both removed: the field drops (sparse) and the hero's own clips are back
    const back = await updateSketchHandler({ ref: 'hero-clips', patch: [{ op: 'remove', path: '/hero/clips/reach' }, { op: 'remove', path: '/hero/clips/wave' }] });
    expect(back.stats.layered.rig.clips).toEqual(['idle', 'walk', 'wave']); expect(back.stats.hero.clips).toBeUndefined();
    expect('clips' in row().manifest.hero).toBe(false); expect(Object.keys(row().manifest.recipe.clips)).toEqual(['idle', 'walk', 'wave']);
    expect(row().manifest.plan).toEqual(heroPlanOf(row().manifest.hero));
    const again = await updateSketchHandler({ ref: 'hero-clips', patch: [{ op: 'set', path: '/hero/clips', value: { reach: K } }] });
    expect(again.stats.layered.rig.clips).toEqual(['idle', 'walk', 'wave', 'reach']); expect(row().manifest.hero.clips).toEqual({ reach: K });
    // refused by name; the row untouched
    const before = JSON.stringify(row().manifest);
    await expect(updateSketchHandler({ ref: 'hero-clips', patch: [{ op: 'set', path: '/hero/clips/gesture', value: [{}] }] })).rejects.toThrow(/clips\.gesture: the stand's clip/);
    await expect(updateSketchHandler({ ref: 'hero-clips', patch: [{ op: 'set', path: '/hero/clips/reach', value: [{ elbowR: 'kinked' }] }] })).rejects.toThrow(/clips\.reach\[0\]\.elbowR: a bend word/);
    // (out of reach on the structured core: feet planted three hip spreads apart on straight legs)
    await expect(updateSketchHandler({ ref: 'hero-clips', patch: [{ op: 'set', path: '/hero/clips/lunge', value: [{}, { stance: 3 }] }] })).rejects.toThrow(/the clip 'lunge' \(hero\.clips\.lunge\[1\]\)/);
    expect(JSON.stringify(row().manifest)).toBe(before);
  });
});

// the anime head's door clips: a clip `{ seconds, keys }` (its designed duration) and a key's `face` (its facial track),
// stored as given, the plan without the face; they survive an unrelated /hero edit and edit by path; `blink` is stored
// only when false; the readout says every clip's duration and the clips carrying a face; the World payload's packed
// clips carry the durations the page, the GLB and the Godot pack play.
describe("the anime hero's timed clips, facial tracks and ambient blink through update_sketch", () => {
  it('stored as given; survives an unrelated /hero edit; by path; blink stored only when false; refusals leave the row', async () => {
    const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
    const K = [{ support: 'both', crouch: 0.1, face: { blink: 0.2, smile: 0.6, brow: 0.55 } }, { support: 'both', armR: { x: 0.3, y: 0.15, z: 0.94 }, elbowR: 'slight', face: ['happy', { open: 0.85 }] }];
    const row = () => SketchRepository.getByRef('anime-clips');
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'anime-clips', spec: { cast: 'male', head: 'anime', register: 'lowpoly', clips: { cheer: { seconds: 1.5, keys: K } } } });
    expect(minted.ok).toBe(true); expect('blink' in row().manifest.hero).toBe(false);
    expect(minted.hero.clips).toEqual({ plays: ['gesture', 'idle', 'walk', 'wave', 'cheer'], authored: ['cheer'], seconds: { gesture: 1, idle: 4, walk: 1, wave: 2, cheer: 1.5 }, face: ['cheer'] });
    expect(minted.next.reason).toMatch(/On the anime head a key may carry face \(an expression word, \{ blink, smile, open, brow \} or a list\), a clip may be \{ seconds, keys \} \(its designed duration; the clips play idle 4 s, walk 1 s, wave 2 s, cheer 1\.5 s\), and \/hero\/blink false turns the ambient blink off\./);
    expect(row().manifest.hero.clips).toEqual({ cheer: { seconds: 1.5, keys: K } });
    expect(row().manifest.recipe.clips.cheer).toEqual(K.map(({ face: _f, ...pose }) => pose));
    const clipsOf = async () => (await resolveWorldScene({ ref: 'anime-clips', title: 't', manifest: row().manifest })).payload.figures.body.clips;
    expect(Object.fromEntries(Object.entries(await clipsOf()).map(([c, v]) => [c, v.s]))).toEqual({ gesture: 1, idle: 4, walk: 1, wave: 2, cheer: 1.5 });
    // an unrelated /hero edit regenerates the plan from the record: the clip, its duration and its faces ride along
    const legs = await updateSketchHandler({ ref: 'anime-clips', patch: [{ op: 'set', path: '/hero/tune/legs', value: 1.05 }] });
    expect(legs.ok).toBe(true); expect(row().manifest.hero.clips).toEqual({ cheer: { seconds: 1.5, keys: K } }); expect(legs.stats.hero.clips.seconds.cheer).toBe(1.5);
    // by path: the duration, a key's face
    const faster = await updateSketchHandler({ ref: 'anime-clips', patch: [{ op: 'set', path: '/hero/clips/cheer/seconds', value: 1 }, { op: 'set', path: '/hero/clips/cheer/keys/0/face', value: 'determined' }] });
    expect(faster.ok).toBe(true); expect(row().manifest.hero.clips.cheer.seconds).toBe(1); expect(row().manifest.hero.clips.cheer.keys[0].face).toBe('determined');
    expect((await clipsOf()).cheer.s).toBe(1); expect(row().manifest.recipe.clips.cheer).toEqual(K.map(({ face: _f, ...pose }) => pose));
    // the ambient blink: stored only when off; setting it back on drops the field
    await updateSketchHandler({ ref: 'anime-clips', patch: [{ op: 'set', path: '/hero/blink', value: false }] });
    expect(row().manifest.hero.blink).toBe(false);
    await updateSketchHandler({ ref: 'anime-clips', patch: [{ op: 'set', path: '/hero/blink', value: true }] });
    expect('blink' in row().manifest.hero).toBe(false);
    // refused by name; the row untouched
    const before = JSON.stringify(row().manifest);
    await expect(updateSketchHandler({ ref: 'anime-clips', patch: [{ op: 'set', path: '/hero/blink', value: 'off' }] })).rejects.toThrow(/blink: false turns the anime hero's ambient blink off/);
    await expect(updateSketchHandler({ ref: 'anime-clips', patch: [{ op: 'set', path: '/hero/clips/cheer/seconds', value: 100 }] })).rejects.toThrow(/clips\.cheer\.seconds: the clip's length in seconds, 0\.25 … 60/);
    await expect(updateSketchHandler({ ref: 'anime-clips', patch: [{ op: 'set', path: '/hero/clips/cheer/keys/1/face', value: 'grin' }] })).rejects.toThrow(/clips\.cheer\.keys\[1\]\.face: unknown anime pose 'grin'/);
    expect(JSON.stringify(row().manifest)).toBe(before);
  });
  it('every other head refuses the face, the duration and the blink by name at the door', async () => {
    const cheer = [{ support: 'both', crouch: 0.1 }];
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'male', register: 'lowpoly', clips: { cheer: [{ ...cheer[0], face: 'happy' }] } } })).rejects.toThrow(/clips\.cheer\[0\]\.face: a facial track is the anime head's \(head: 'anime'\); this head's face is \/hero\/expression/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'female', head: 'none', register: 'lowpoly', clips: { cheer: { seconds: 2, keys: cheer } } } })).rejects.toThrow(/clips\.cheer\.seconds: a designed duration is the anime hero's/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'male', register: 'lowpoly', blink: false } })).rejects.toThrow(/blink: the ambient blink is the anime head's/);
    // a { keys } clip without a duration is a list on any head
    const ok = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'landmark-keys', spec: { cast: 'male', register: 'lowpoly', clips: { cheer: { keys: cheer } } } });
    expect(ok.ok).toBe(true); expect(ok.hero.clips).toEqual({ plays: ['idle', 'walk', 'wave', 'cheer'], authored: ['cheer'] });
    expect(SketchRepository.getByRef('landmark-keys').manifest.recipe.clips.cheer).toEqual(cheer);
  });
});

// the door around the new channels: the non-anime readout's keys (it gains the budget and the midsection's `core`), the dress ledgers read at
// rest whatever dial the mint turned, and the character light's toon fields — the anime hero's outline opt-out kept at
// the door, an invalid light refused by field at the door and on a /toon edit.
describe('the hero door: readouts and the character light fields', () => {
  it('the non-anime readout keys: the old set plus `budget` and `core` (the midsection, hero-core-measures.js)', async () => {
    const keys = {
      landmark: [{ cast: 'male' }, ['cast', 'evidence', 'expression', 'face', 'faceMeasures', 'faceMoved', 'hair', 'hairMeasures', 'hairMoved', 'head', 'measures', 'moved', 'register', 'tune']],
      none: [{ cast: 'female', head: 'none' }, ['cast', 'evidence', 'head', 'measures', 'moved', 'register', 'tune']],
      ranger: [{ cast: 'male', register: 'round', hair: 'crop', detail: 'clothed', adorn: 'ranger' }, ['cast', 'dress', 'evidence', 'expression', 'face', 'faceMeasures', 'faceMoved', 'hair', 'hairMeasures', 'hairMoved', 'head', 'measures', 'moved', 'register', 'tune', 'warnings']],
    };
    for (const [k, [spec, before]] of Object.entries(keys)) {
      const out = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: `keys-${k}`, spec });
      expect(Object.keys(out.hero).sort(), k).toEqual([...before, 'budget', 'core'].sort());
      const ed = await updateSketchHandler({ ref: `keys-${k}`, patch: [{ op: 'set', path: '/hero/tune/limbs', value: 1.1 }] });
      expect(Object.keys(ed.stats.hero).sort(), `${k} edit`).toEqual([...before, 'budget', 'core'].sort());
    }
  });
  it('a dressed hero minted with a dial: the dress ledgers read the figure at rest, as without the dial', async () => {
    const spec = { cast: 'male', register: 'round', hair: 'crop', detail: 'clothed', adorn: 'ranger' };
    const plain = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'dress-rest', spec });
    const dialed = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'dress-dial', spec: { ...spec, dials: { stance: 1.35 } } });
    expect(SketchRepository.getByRef('dress-dial').manifest.dials.stance).toBe(1.35);
    expect(dialed.hero.dress).toEqual(plain.hero.dress);
  });
  it("the anime hero minted with toon: { ink: false } keeps the opt-out; an invalid light is refused by field", async () => {
    const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
    const off = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'anime-noink', spec: { cast: 'female', head: 'anime', gesture: 'rest', toon: { ink: false } } });
    expect(off.ok).toBe(true); const row = SketchRepository.getByRef('anime-noink');
    expect(row.manifest.toon).toEqual({ ink: false });
    const { payload } = await resolveWorldScene({ ref: row.ref, title: 't', manifest: row.manifest });
    expect(payload.toon).toBeUndefined(); expect(payload.figures.body.preview.ink).toBeUndefined();
    // a landmark hero's `ink: false` is nothing the dial reads: dropped as before
    await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'landmark-noink', spec: { cast: 'male', toon: { ink: false } } });
    expect(SketchRepository.getByRef('landmark-noink').manifest.toon).toBeUndefined();
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'female', head: 'anime', toon: { light: { toLight: [0, 0, 0] } } } })).rejects.toThrow(/toon refused:\n - toon\.light\.toLight: \[x, y, z\] pointing TOWARD the light/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { cast: 'male', toon: { ink: true, light: 'key' } } })).rejects.toThrow(/toon\.light: true \(the default character light\), false \(off\)/);
    await expect(updateSketchHandler({ ref: 'anime-noink', patch: [{ op: 'set', path: '/toon/light', value: { threshold: 3 } }] })).rejects.toThrow(/toon\.light\.threshold: the N·L step/);
    const on = await updateSketchHandler({ ref: 'anime-noink', patch: [{ op: 'set', path: '/toon/light', value: { threshold: 0.2 } }] });
    expect(on.ok).toBe(true); expect(SketchRepository.getByRef('anime-noink').manifest.toon).toEqual({ ink: false, light: { threshold: 0.2 } });
  });
});

// anime looks: presets as words that compose; `look` is one list (archetypes, face and hair traits, families, poses),
// stored as its words beside a resolved stamp; the own face / hair / expression / tune compose on top.
describe('the hero door composes anime looks', () => {
  it('mint by a look, add and peel words by /hero/look, the own layer on top; the stamp holds until the list changes', async () => {
    const minted = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-look', spec: { cast: 'female', head: 'anime', look: ['heroine', 'tsurime'] } });
    expect(minted.ok).toBe(true); expect(minted.stats.closed).toBe(true); expect(minted.hero.warnings).toBeUndefined();
    expect(minted.hero.look).toEqual(['heroine', 'tsurime']); expect(minted.hero.lookFrom).toBe('heroine+tsurime');
    expect(minted.hero.hair.style).toBe('long'); expect(minted.hero.expression.smile).toBe(1); expect(minted.hero.tune.head).toBe(1); expect(minted.hero.proportions).toBe('anime');
    expect(minted.hero.face.tilt).toBeCloseTo(0.03, 9);   // heroine's slight droop (−0.02) and tsurime (+0.05)
    expect(minted.next.reason).toMatch(/set \/hero\/look/);
    const stored = SketchRepository.getByRef('hero-look');
    expect(stored.title).toBe('hero · female · anime · heroine+tsurime'); expect(stored.manifest.hero.lookResolved.words).toEqual(['heroine', 'tsurime']);
    expect(stored.manifest.hero.hair.style).toBeNull(); expect(stored.manifest.hero.expression).toBeUndefined();   // the own layer stays sparse
    // add a word: one bang over the eye
    const add = await updateSketchHandler({ ref: 'hero-look', patch: [{ op: 'set', path: '/hero/look', value: ['heroine', 'tsurime', 'peekaboo'] }] });
    expect(add.stats.hero.hair.locks).toEqual({ 'fringe-3': { ty: -0.16, tx: 0.03, tz: -0.02 } });
    expect(SketchRepository.getByRef('hero-look').manifest.hero.lookResolved.words).toEqual(['heroine', 'tsurime', 'peekaboo']);
    // the own layer on top of the look
    const own = await updateSketchHandler({ ref: 'hero-look', patch: [{ op: 'set', path: '/hero/hair/length', value: 1.1 }, { op: 'set', path: '/hero/expression', value: 'worried' }] });
    expect(own.stats.hero.hair.length).toBe(1.1); expect(own.stats.hero.hair.style).toBe('long'); expect(own.stats.hero.expression.brow).toBe(-0.8);
    expect(own.stats.hero.own).toMatchObject({ hair: { length: 1.1 }, expression: 'worried' });
    // the stamp promise: a stamp that no longer matches today's table is kept until the list itself is edited
    const row = SketchRepository.getByRef('hero-look'), stale = structuredClone(row.manifest); stale.hero.lookResolved.face.eyeHeight = 1.07;
    SketchRepository.update({ ref: row.ref, manifest: stale });
    const kept = await updateSketchHandler({ ref: 'hero-look', patch: [{ op: 'set', path: '/hero/face/nose', value: 1.05 }] });
    expect(kept.stats.hero.face.eyeHeight).toBeCloseTo(1.07, 9); expect(SketchRepository.getByRef('hero-look').manifest.hero.lookResolved.face.eyeHeight).toBe(1.07);
    // peel back to the heroine: the list changed, so it re-resolves; the own layer stays
    const peel = await updateSketchHandler({ ref: 'hero-look', patch: [{ op: 'set', path: '/hero/look', value: ['heroine'] }] });
    expect(peel.stats.hero.face.tilt).toBeCloseTo(-0.02, 9); expect(peel.stats.hero.hair.locks).toEqual({}); expect(peel.stats.hero.hair.length).toBe(1.1);
    // drop the look: the stamp goes with it
    const none = await updateSketchHandler({ ref: 'hero-look', patch: [{ op: 'set', path: '/hero/look', value: [] }] });
    expect(none.stats.hero.look).toBeUndefined(); expect(SketchRepository.getByRef('hero-look').manifest.hero.lookResolved).toBeUndefined();
    expect(none.stats.hero.hair.style).toBe('long'); expect(none.stats.hero.hairCut).toBe('side-parted');   // the female hair base's cut again (no family named)
  });
  it('refuses by name; the looks are the anime head\'s', async () => {
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { head: 'anime', look: ['heroine', 'mohawk'] } })).rejects.toThrow(/unknown look word 'mohawk'/);
    await expect(mintSolidHandler({ kind: 'layered', via: 'hero', spec: { look: 'heroine' } })).rejects.toThrow(/look: the looks are the anime head's/);
    const kid = await mintSolidHandler({ kind: 'layered', via: 'hero', ref: 'hero-kid', spec: { cast: 'male', head: 'anime', look: 'kid' } });
    expect(kid.stats.closed).toBe(true); expect(kid.hero.tune).toMatchObject({ head: 1.15, stature: 0.85 }); expect(kid.hero.expression.blink).toBe(1);
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
    // cannot follow is named: the belt is pinned to the torso's hem, and on the structured core `bulk` narrows the hem over
    // the pelvis (a dial blends by station across its parts); on the streamlined core it was `stance` swinging the thighs
    expect(minted.hero.dress.clearance.sinking).toEqual(['belt']); expect(minted.hero.dress.clearance.worst.baldric.at).toBe('rest');
    expect(minted.hero.warnings).toEqual([expect.stringMatching(/^adornment belt sinks into pelvis at bulk 0\.8/)]);
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


// The readout measures the head at the PLAN's own scale (hero-form.js planScale: the cast's scale times the tune's
// stature, on the proportions worn): a stature-only tune is a uniform shrink, so the metres shrink with it and the
// heads-tall stays where it was (the anime readout used to read the cast's scale alone, so the kid look read ~18 % large)
describe('the hero readout at the plan\'s own scale', () => {
  const read = (spec) => { const hero = heroRecord(spec); return heroReadout(hero, heroPlanOf(hero), null, []); };
  it('anime: a stature-only tune moves head_m by the stature and leaves headsTall', () => {
    const a = read({ cast: 'female', head: 'anime', register: 'lowpoly' }), b = read({ cast: 'female', head: 'anime', register: 'lowpoly', tune: { stature: 0.85 } });
    expect(b.faceMeasures.head_m).toBeCloseTo(a.faceMeasures.head_m * 0.85, 2);
    expect(Math.abs(b.headsTall - a.headsTall)).toBeLessThan(0.03);
  }, 60000);
  it('landmark: the same, on the stature and on the worn cast\'s head scale', () => {
    const a = read({ cast: 'male' }), b = read({ cast: 'male', tune: { stature: 0.9 } });
    expect(b.faceMeasures.head_m).toBeCloseTo(a.faceMeasures.head_m * 0.9, 2);
  }, 60000);
  // `proportions` was stored on a blank-trunk or include hero and then ignored: it now reaches heroPlan as it does the two
  // worn heads; absent, the plan is the one before
  it("the blank trunk takes proportions: 'anime' builds the anime cast, absent keeps the plan", () => {
    const plain = heroPlanOf(heroRecord({ cast: 'female', head: 'none' })), anime = heroPlanOf(heroRecord({ cast: 'female', head: 'none', proportions: 'anime' }));
    expect(anime.frame.note).toMatch(/anime proportions/); expect(plain.frame.note).not.toMatch(/anime proportions/);
    expect(JSON.stringify(anime.segments)).not.toBe(JSON.stringify(plain.segments));
    expect(JSON.stringify(heroPlanOf(heroRecord({ cast: 'female', head: 'none', proportions: 'hero' })))).toBe(JSON.stringify(plain));
  });
});
