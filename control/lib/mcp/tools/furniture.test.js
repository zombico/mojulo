process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintSolidHandler } from '@/lib/mcp/tools/mint-solid';
import { updateSketchHandler } from '@/lib/mcp/tools/sketches';
import { getSolidVocabCatalog } from '@/lib/graph/solid-vocab/loader';
import { lowerObjectFaces } from '@/lib/graph/worlds/workbench';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { FURNITURE_KINDS, FURNITURE_STYLES, FINISH_KEYS } from '@/lib/graph/furnishings/forms';

beforeEach(() => { closeDb(); });
const buildOf = (ref) => SketchRepository.getByRef(ref).manifest.build;
const legFaces = (manifest) => lowerObjectFaces(manifest).filter((f) => /^leg-/.test(f.group));

describe("mint_solid kind 'furniture': a display asset by default", () => {
  it('locks a composed piece as a furniture build, flagged not buildable', async () => {
    const res = await mintSolidHandler({ kind: 'furniture', ref: 'fu_chester', spec: { like: 'chesterfield', forms: { legs: 'turned' }, finish: { fabric: 'tartan' } } });
    expect(res.ok).toBe(true);
    expect(res.furniture).toMatchObject({ piece: 'sofa', basis: 'chesterfield', worn: ['legs', 'finish.fabric'], buildable: false, size_mm: FURNITURE_STYLES.chesterfield.size });
    expect(res.furniture.note).toMatch(/display piece.*not checked for building/);
    const m = SketchRepository.getByRef('fu_chester').manifest;
    expect(m.kind).toBe('workbench');
    expect(m.frames).toBeUndefined();                                       // no jointed frame
    expect(m.build).toMatchObject({ type: 'furniture', piece: 'sofa', legs: 'turned', fabric: 'tartan', size: FURNITURE_STYLES.chesterfield.size, dials: { type: 'sofa', arms: 'rolled', back: 'tufted', cushions: 'bench' } });
    expect(m.build.laws).toBeUndefined();                                   // the equipment stamp is equipment's
    expect(res.stats.furniture).toMatchObject({ piece: 'sofa', buildable: false });
    expect(res.stats.frames).toBeUndefined();                               // no construction report
  });

  it('fills the size it is given exactly, even where a build would hold it', async () => {
    const res = await mintSolidHandler({ kind: 'furniture', spec: { like: 'sofa', size: [2000, 900, 500] } });
    expect([res.stats.size.w, res.stats.size.d, res.stats.size.h]).toEqual([2000, 900, 500]);
  });

  it('starts from a kind with no style', async () => {
    const res = await mintSolidHandler({ kind: 'furniture', spec: { piece: 'casework', forms: { front: 'drawers' }, finish: { board: 'mfc', paint: '#c9a227' }, size: [900, 450, 900] } });
    expect(res.furniture.basis).toBeNull();
    expect(buildOf(res.ref).dials).toMatchObject({ type: 'carcass', material: 'mfc', finish: { paint: '#c9a227' } });
  });

  it('restyles in place with a patch on the build', async () => {
    await mintSolidHandler({ kind: 'furniture', ref: 'fu_table', spec: { like: 'dining-table' } });
    const before = legFaces(SketchRepository.getByRef('fu_table').manifest).length;
    await updateSketchHandler({ ref: 'fu_table', patch: [{ op: 'set', path: '/build/legs', value: 'turned' }] });
    expect(legFaces(SketchRepository.getByRef('fu_table').manifest).length).toBeGreaterThan(before);
    await updateSketchHandler({ ref: 'fu_table', patch: [{ op: 'set', path: '/build/size', value: [1400, 800, 740] }] });
    const m = SketchRepository.getByRef('fu_table').manifest;
    const b = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
    for (const f of lowerObjectFaces(m)) for (const c of f.corners) for (let k = 0; k < 3; k++) { b.lo[k] = Math.min(b.lo[k], c[k]); b.hi[k] = Math.max(b.hi[k], c[k]); }
    expect(b.hi[0] - b.lo[0]).toBeCloseTo(1400, 3);
  }, 120_000);

  it('refuses a malformed patch, naming what is valid', async () => {
    await mintSolidHandler({ kind: 'furniture', ref: 'fu_bad', spec: { like: 'chair' } });
    await expect(updateSketchHandler({ ref: 'fu_bad', patch: [{ op: 'set', path: '/build/legs', value: 'cabriole' }] }))
      .rejects.toThrow(/build.legs: one of block, tapered, turned, bun, hairpin/);
    await expect(updateSketchHandler({ ref: 'fu_bad', patch: [{ op: 'set', path: '/build/piece', value: 'lamp' }] }))
      .rejects.toThrow(/build.piece: one of sofa, chair, table, casework/);
  });

  it('refuses a malformed request, pointing at the manual', async () => {
    await expect(mintSolidHandler({ kind: 'furniture', spec: {} })).rejects.toThrow(/needs `like`.*or `piece`/);
    await expect(mintSolidHandler({ kind: 'furniture', spec: { like: 'camelback' } })).rejects.toThrow(/no style 'camelback'.*get_solid_vocab\(\{ id: 'furniture' \}\)/);
    await expect(mintSolidHandler({ kind: 'furniture', spec: { like: 'sofa', buildable: 'yes' } })).rejects.toThrow(/buildable is true/);
  });
});

describe('a minted asset furnishes a house', () => {
  it('stands in a room as a ref item, fitted to the item\'s footprint', async () => {
    await mintSolidHandler({ kind: 'furniture', ref: 'fu_house_sofa', spec: { like: 'tuxedo', finish: { fabric: 'velvet' } } });
    const manifest = { kind: 'floorplan', rooms: [{ x: 0, y: 0, w: 18, h: 16, glyph: 'L', items: [{ ref: 'fu_house_sofa', wall: 'N', size: [7, 3], height: 2.6, name: 'sofa' }] }] };
    const { payload } = await resolveWorldScene({ manifest, title: null, ref: 'fu_house' });
    const sofa = payload.faces.filter((f) => f.group === 'item:sofa');
    expect(sofa.length).toBeGreaterThan(100);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const f of sofa) for (const c of f.corners) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); }
    expect(hi[0] - lo[0]).toBeLessThanOrEqual(7 + 1e-6);
    expect(lo[2]).toBeCloseTo(0, 6);
    expect(hi[2]).toBeLessThanOrEqual(2.6 + 1e-6);
  }, 120_000);
});

describe("mint_solid kind 'furniture', buildable: true: the jointed build", () => {
  it('stores one workbench frame of resolved dials, with its construction report', async () => {
    const res = await mintSolidHandler({ kind: 'furniture', ref: 'fu_built', spec: { like: 'chesterfield', forms: { legs: 'turned' }, buildable: true } });
    expect(res.furniture.buildable).toBe(true);
    const m = SketchRepository.getByRef('fu_built').manifest;
    expect(m.build).toBeUndefined();
    expect(m.frames[0]).toMatchObject({ id: 'chesterfield', unit: 'mm', legs: 'turned', build: { type: 'sofa', arms: 'rolled' } });
    expect(res.stats.frames[0]).toBeTruthy();
  });

  it('says where the build could not take the size asked', async () => {
    const low = await mintSolidHandler({ kind: 'furniture', spec: { like: 'sofa', size: [2000, 900, 500], buildable: true } });
    expect(low.furniture.size_note).toMatch(/built h \d+(\.\d)? mm \(asked 500\)/);   // a sofa's back runs 680–1000 mm
  });

  it('refuses an unknown leg form on a frame, naming the forms', async () => {
    await mintSolidHandler({ kind: 'furniture', ref: 'fu_badf', spec: { like: 'chair', buildable: true } });
    await expect(updateSketchHandler({ ref: 'fu_badf', patch: [{ op: 'set', path: '/frames/0/legs', value: 'cabriole' }] }))
      .rejects.toThrow(/legs: how a build's legs are drawn, one of block, tapered, turned, bun, hairpin/);
  });
});

describe('the furniture card names the whole grammar', () => {
  const card = getSolidVocabCatalog().get('furniture');

  it('exists for mint_solid', () => {
    expect(card).toBeTruthy();
    expect(card.entry).toBe('mint_solid');
  });

  it('lists every kind, slot, form, finish key and style', () => {
    const missing = [];
    for (const [kind, K] of Object.entries(FURNITURE_KINDS)) {
      if (!card.body.includes(`**${kind}**`)) missing.push(`kind ${kind}`);
      for (const [slot, table] of Object.entries(K.slots)) {
        if (!card.body.includes(`\`${slot}\``)) missing.push(`slot ${slot}`);
        for (const form of Object.keys(table)) if (!new RegExp(`(^|[\\s:·(\`])${form}([\\s·,.)\`]|$)`, 'm').test(card.body)) missing.push(`${slot} form ${form}`);
      }
    }
    for (const k of FINISH_KEYS) if (!card.body.includes(`\`${k}\``)) missing.push(`finish ${k}`);
    for (const id of Object.keys(FURNITURE_STYLES)) if (!card.body.includes(`\`${id}\``)) missing.push(`style ${id}`);
    expect(missing, `the furniture card is missing:\n  ${missing.join('\n  ')}`).toEqual([]);
  });
});
