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
    // MZ-NE410 carries two standing advisories (an open relief, the cut's edge rounding)
    const r1 = await updateSketchHandler({ ref: 'ne410-warn', patch: [{ op: 'set', id: 'menu', material: 'chrome' }] });
    expect(r1.stats.warnings).toEqual(['2 warnings unchanged from rev 1']);
    // a coarser cut re-words its edge-rounding advisory: a NEW line beside the collapsed count
    const r2 = await updateSketchHandler({ ref: 'ne410-warn', patch: [{ op: 'set', path: '/cuts/0/cells', value: 32 }] });
    expect(r2.stats.warnings.at(-1)).toBe('1 warning unchanged from rev 2');
    expect(r2.stats.warnings.length).toBe(2);
    expect(r2.stats.warnings[0]).toMatch(/cut 'dialglyphs'/);
  });
});
