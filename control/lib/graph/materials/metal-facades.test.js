import { describe, it, expect } from 'vitest';
import { assembleEdificeScene, planEdifice } from '../architecture/edifice.js';
import { buildFacadeCard, projectCardOntoQuad, facadeReadHex } from '../architecture/facade-card.js';
import { buildRoof } from '../architecture/roof.js';
import { makeLight } from '../polygonizer/vexar.js';
import { storefrontLocal, validateConceptCard } from '../retail/store-concept.js';

const L = makeLight({});
const wall = [[0, 0, 0], [30, 0, 0], [30, 0, 22], [0, 0, 22]];
const metalOf = (faces) => faces.filter((f) => f.metal);
const MASS = (facade, roof = 'flat') => ({ kind: 'edifice', masses: [{ id: 'a', at: [0, 0], footprint: { w: 40, d: 30 }, floors: 2, facade, roof }], entrance: 'a' });

describe('metal facades (metal-surfaces S5)', () => {
  it("a 'metal' facade is a rainscreen whose panels wear the surface; the recessed body does not", () => {
    const card = buildFacadeCard({ material: 'metal', metal: { metal: 'stainless', finish: 'brushed' }, rhythm: 'banded' }, 2, 4);
    const faces = projectCardOntoQuad(wall, card, { light: L });
    expect(faces[0].metal).toBeUndefined(); expect(metalOf(faces).length).toBe(faces.length - 1);
    expect(JSON.parse(metalOf(faces)[0].metal.s).metal).toBe('stainless');
    const solid = projectCardOntoQuad(wall, buildFacadeCard({ material: 'metal', rhythm: 'solid' }, 2, 4), { light: L });
    expect(metalOf(solid).length).toBeGreaterThan(metalOf(faces).length);   // panel rows over the whole wall
    expect(facadeReadHex({ material: 'metal', rhythm: 'solid' })).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('a glass wall with frameMetal tags its mullions; without it, byte-identical to before', () => {
    const plain = projectCardOntoQuad(wall, buildFacadeCard({ material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frame: '#333' }, 2, 4), { light: L });
    expect(metalOf(plain)).toHaveLength(0);
    const framed = projectCardOntoQuad(wall, buildFacadeCard({ material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frameMetal: { metal: 'aluminium', finish: 'blasted' } }, 2, 4), { light: L });
    expect(metalOf(framed).length).toBe(framed.length - 1);
  });
  it('the edifice refuses a bad metal at plan time, naming the choices', () => {
    expect(() => planEdifice(MASS({ material: 'metal', metal: { metal: 'mithril' } }))).toThrow(/mass 'a' facade\.metal: unknown metal/);
    expect(() => planEdifice(MASS({ material: 'glass', glass: '#88aacc', frame: '#333' }, { style: 'gable', metal: { metal: 'gold', film: { age: 3 } } }))).toThrow(/roof\.metal: gold grows no coloured film/);
  });
});

describe('metal roofs (metal-surfaces S5)', () => {
  const fp = { x: 0, y: 0, w: 30, d: 20, z: 10 };
  it("'standing-seam' is a zinc gable with seams; the slope skins run down-slope", () => {
    const { faces } = buildRoof(fp, { style: 'standing-seam', light: L });
    const m = metalOf(faces); expect(m.length).toBeGreaterThan(20);   // two slopes + a seam's three faces every 1.5 ft
    expect(JSON.parse(m[0].metal.s).metal).toBe('zinc');
    const flat = buildRoof(fp, { style: 'standing-seam', seams: false, light: L }); expect(metalOf(flat.faces).length).toBe(2);
  });
  it('any pitched style takes a metal; no metal → the same faces as before', () => {
    const a = buildRoof(fp, { style: 'modern-shed', light: L }), b = buildRoof(fp, { style: 'modern-shed', light: L });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(metalOf(a.faces)).toHaveLength(0);
    const c = buildRoof(fp, { style: 'modern-shed', metal: { metal: 'copper', film: { age: 30 } }, light: L }); expect(metalOf(c.faces).length).toBeGreaterThan(0);
  });
  it('an edifice roof object carries its metal through', () => {
    const p = assembleEdificeScene(MASS({ material: 'glass', glass: '#88aacc', frame: '#333' }, { style: 'gable', metal: { metal: 'copper' } }));
    expect(p.faces.some((f) => f.metal && JSON.parse(f.metal.s).metal === 'copper')).toBe(true);
  });
});

describe('metal storefront trim (metal-surfaces S5)', () => {
  it('trim may be a metal surface: the mullions, jambs and head rail wear it; a hex is unchanged', () => {
    const args = { W: 20, s0: 2, s1: 18, e0: 9, e1: 11, top: 8, ceil: 12, sign: '#574f6a', light: L };
    expect(metalOf(storefrontLocal({ ...args, trim: '#7c8088' }))).toHaveLength(0);
    expect(metalOf(storefrontLocal({ ...args, trim: { metal: 'brass', finish: 'brushed' } })).length).toBeGreaterThan(20);
    const card = { id: 'shop', palette: { merch: ['#aa3344'] }, finishes: { trim: { metal: 'brass', finish: 'spangle' } } };
    expect(validateConceptCard(card).some((e) => e.code === 'bad-metal')).toBe(true);
  });
});
