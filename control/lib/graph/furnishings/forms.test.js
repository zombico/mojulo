import { describe, it, expect } from 'vitest';
import { FURNITURE_KINDS, FURNITURE_STYLES, resolveFurniture, finishErrors, paletteFinish, styleFrame } from './forms.js';
import { lockedFurnitureFaces, FACADE_KINDS } from '../construction/facades.js';
import { expandBuild } from '../construction/furniture-builds.js';

const MM = 1;   // render the locked pieces in millimetres, so a bbox reads against sizeMm directly
const bbox = (faces) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); }
  return { lo, hi, size: lo.map((v, k) => hi[k] - v) };
};
const body = (faces) => faces.filter((f) => !['pull', 'tv', 'lamp'].includes(f.group));
const legFaces = (faces) => faces.filter((f) => /^leg-/.test(f.group));

describe('furniture styles: worked pieces over the slot forms', () => {
  for (const id of Object.keys(FURNITURE_STYLES)) {
    it(`${id} resolves, locks as plain data, and builds at about its size`, () => {
      const { locked, basis, worn } = resolveFurniture({ like: id });
      expect(basis).toBe(id);
      expect(worn).toEqual([]);
      expect(JSON.parse(JSON.stringify(locked))).toEqual(locked);           // a lock is data: no functions, nothing lost
      const faces = lockedFurnitureFaces(locked, { unitMm: MM });
      const b = bbox(body(faces));
      expect(b.lo[2]).toBeCloseTo(0, 6);
      for (let k = 0; k < 3; k++) expect(Math.abs(b.size[k] - locked.sizeMm[k]) / locked.sizeMm[k], `${id} axis ${k}`).toBeLessThan(0.08);
    });
  }

  it('makes the room facades from the first styles', () => {
    for (const kind of Object.keys(FACADE_KINDS)) expect(FURNITURE_STYLES[kind], kind).toBeTruthy();
  });
});

describe('every form builds alone on its kind', () => {
  for (const [kind, K] of Object.entries(FURNITURE_KINDS)) {
    for (const [slot, table] of Object.entries(K.slots)) {
      for (const name of Object.keys(table)) {
        it(`${kind} ${slot}: ${name}`, () => {
          const { locked } = resolveFurniture({ kind, forms: { [slot]: name } });
          expect(() => expandBuild({ unit: 'mm', build: locked.build })).not.toThrow();
          expect(lockedFurnitureFaces(locked, { unitMm: MM }).length).toBeGreaterThan(0);
        });
      }
    }
  }
});

describe('composing: swaps, finishes, refusals', () => {
  it('reports what it swapped from the style', () => {
    const r = resolveFurniture({ like: 'chesterfield', forms: { legs: 'turned', back: 'tufted' }, finish: { fabric: 'tartan' } });
    expect(r.worn).toEqual(['legs', 'finish.fabric']);                       // the back was already tufted
    expect(r.forms).toEqual({ arms: 'rolled-high', back: 'tufted', seat: 'bench', legs: 'turned' });
    expect(r.locked.fabric).toBe('tartan');
    expect(r.locked.legs).toBe('turned');
  });

  it('starts from a kind with no style', () => {
    const r = resolveFurniture({ kind: 'sofa', forms: { arms: 'none', seat: 'bench' }, size: [1500, 850, 780] });
    expect(r.basis).toBeNull();
    expect(r.locked.build).toMatchObject({ type: 'sofa', arms: 'none', cushions: 'bench' });
    expect(r.locked.sizeMm).toEqual([1500, 850, 780]);
  });

  it('derives what follows from the size (a chest\'s drawers, a sofa\'s seats)', () => {
    expect(resolveFurniture({ like: 'chest', size: [1000, 480, 600] }).locked.build.drawers).toBe(3);
    expect(resolveFurniture({ like: 'chest', size: [1000, 480, 1300] }).locked.build.drawers).toBe(6);
    expect(resolveFurniture({ like: 'sofa', size: [1600, 900, 820] }).locked.build.seats).toBe(2);
    expect(resolveFurniture({ like: 'sofa', size: [2900, 900, 820] }).locked.build.seats).toBe(4);
  });

  it('refuses an unknown style, kind, slot, form or finish, naming what is valid', () => {
    expect(() => resolveFurniture({ like: 'camelback' })).toThrow(/no style 'camelback' \(sofa, armchair, chesterfield/);
    expect(() => resolveFurniture({ kind: 'lamp' })).toThrow(/kind one of sofa, chair, table, casework/);
    expect(() => resolveFurniture({ like: 'bookcase', forms: { legs: 'turned' } })).toThrow(/no slot 'legs' \(front\)/);
    expect(() => resolveFurniture({ like: 'sofa', forms: { arms: 'scroll' } })).toThrow(/arms 'scroll' is not one of track, rolled, tuxedo, rolled-high, none/);
    expect(() => resolveFurniture({ like: 'sofa', finish: { timber: 'teak' } })).toThrow(/finish.timber: one of oak/);
    expect(() => resolveFurniture({ like: 'dining-table', finish: { fabric: 'velvet' } })).toThrow(/finish.fabric: a table wears timber, wood, tint/);
    expect(() => resolveFurniture({ like: 'sofa', kind: 'table' })).toThrow(/'sofa' is a sofa, not a table/);
  });

  it('checks a finish against what the kind wears', () => {
    expect(finishErrors('casework', { board: 'plywood', paint: '#112233' })).toEqual([]);
    expect(finishErrors('casework', { paint: 'blue' })).toEqual(["finish.paint: '#rrggbb'"]);
    expect(finishErrors('sofa', { fabric: { preset: 'velvet', warp: 'mustard' }, piping: '#222222' })).toEqual([]);
  });

  it('takes from a house palette only what each kind wears', () => {
    const P = { upholstery: '#3d6b5a', wood: '#5a3a22', cabinet: '#dcd6c8' };
    expect(paletteFinish(P, 'sofa')).toEqual({ fabric: { preset: 'linen', warp: '#3d6b5a' }, tint: '#5a3a22' });
    expect(paletteFinish(P, 'table')).toEqual({ tint: '#5a3a22' });
    expect(paletteFinish(P, 'casework')).toEqual({ board: 'mfc', paint: '#dcd6c8' });
    expect(styleFrame('bookcase', 900, 330, 1800, P).build).toMatchObject({ material: 'mfc', finish: { paint: '#dcd6c8' } });
  });
});

describe('a locked piece is its own', () => {
  it('re-renders identically after the styles and forms are retuned', () => {
    const { locked } = resolveFurniture({ like: 'chesterfield', forms: { legs: 'bun' } });
    const before = JSON.stringify(lockedFurnitureFaces(locked, { unitMm: MM }));
    const saved = FURNITURE_STYLES.chesterfield;
    FURNITURE_STYLES.chesterfield = { ...saved, forms: { arms: 'track', back: 'loose', seat: 'loose' }, finish: { fabric: 'gingham' } };
    try {
      expect(resolveFurniture({ like: 'chesterfield' }).locked).not.toEqual(locked);
      expect(JSON.stringify(lockedFurnitureFaces(JSON.parse(JSON.stringify(locked)), { unitMm: MM }))).toBe(before);
    } finally { FURNITURE_STYLES.chesterfield = saved; }
  });

  it('is deterministic', () => {
    const a = resolveFurniture({ like: 'mid-century-sofa', size: [1900, 860, 790] });
    const b = resolveFurniture({ like: 'mid-century-sofa', size: [1900, 860, 790] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('leg forms: drawn over the blank, the build unchanged', () => {
  const at = (legs) => resolveFurniture({ like: 'dining-table', forms: { legs } }).locked;

  it('keeps the build and the cut list the square blank\'s', () => {
    expect(at('turned').build).toEqual(at('block').build);
  });

  it('shapes each leg inside the blank\'s height, on the floor', () => {
    const block = legFaces(lockedFurnitureFaces(at('block'), { unitMm: MM }));
    for (const legs of ['tapered', 'turned', 'bun', 'hairpin']) {
      const faces = legFaces(lockedFurnitureFaces(at(legs), { unitMm: MM }));
      expect(faces.length, legs).toBeGreaterThan(block.length);
      expect(new Set(faces.map((f) => f.group))).toEqual(new Set(block.map((f) => f.group)));
      expect(bbox(faces).lo[2]).toBeCloseTo(0, 6);
      expect(bbox(faces).hi[2]).toBeCloseTo(bbox(block).hi[2], 6);
    }
  });

  it('turns a chair\'s back legs only to the seat rails, square above', () => {
    const { locked } = resolveFurniture({ like: 'chair', forms: { legs: 'turned' } });
    const back = lockedFurnitureFaces(locked, { unitMm: MM }).filter((f) => f.group === 'leg-bl');
    expect(bbox(back).hi[2]).toBeCloseTo(locked.sizeMm[2], 0);
  });

  it('stands a hairpin leg in steel', () => {
    const faces = legFaces(lockedFurnitureFaces(at('hairpin'), { unitMm: MM }));
    const timber = legFaces(lockedFurnitureFaces(at('block'), { unitMm: MM }))[0].fill;
    expect(faces.some((f) => f.fill !== timber && !f.spec)).toBe(true);    // the rods carry no timber material
  });
});
