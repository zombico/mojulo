import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { assembleEdificeScene, planEdifice } from '../architecture/edifice.js';
import { buildFacadeCard, projectCardOntoQuad, facadeReadHex } from '../architecture/facade-card.js';
import { buildRoof } from '../architecture/roof.js';
import { makeLight } from '../polygonizer/vexar.js';
import { storefrontLocal, validateConceptCard } from '../retail/store-concept.js';
import { structurizeFloorplan, METAL_CLADDING } from '../polygonizer/floorplan-structure.js';
import { mintSketch } from '../../mcp/tools/sketch-mint.js';
import { lowerObjectFaces, WORKBENCH_LIGHT } from '../worlds/workbench.js';

// GOLDENS from the release tree BEFORE metal surfaces (7925d71, the same calls run there): absent a metal, a roof, a
// facade card and a material lathe must keep those bytes. sha256(JSON.stringify(out)), first 16 hex digits.
const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const GOLDEN = {
  roof: { bungalow: '2801cd04f4d4e778', mission: 'b07d595908523031', pavilion: '7b13c511f32165ff', farmhouse: '0a58a92be52aa7f8', manor: '76860e8ec958f9b4',
    colonial: '61bd4ddc9c14cc6e', 'modern-shed': '5a2049ad1fd93787', butterfly: 'a059dc58c06995e0', 'tofu-deck': '508875afd82e176e', 'tofu-stacked': '284cf77f2f985e9f' },
  facade: { 'glass-curtain': '62dc372f65dce46e', 'glass-grid': '917d7dab2007d964', 'stone-punched': '4487bf9e8210e7f7', 'brick-pier': '2dac66dedf73a14e', 'concrete-banded': '8b83b9f85dac7e7f' },
  lathe: { steel: '47fec54cd4491a4e', gold: '98e06fb5e34c648f', satin: 'aae3036567d5eca9', chrome: '226da884236eec69', '#aa3344': '3d7e636b6944dccd', 'preset-chrome': 'df47815db7a0805a' },
};
const HX = { glass: '#8fb6c8', frame: '#333333' };
const CARDS = { 'glass-curtain': { material: 'glass', rhythm: 'curtain', ...HX }, 'glass-grid': { material: 'glass', rhythm: 'grid', ...HX }, 'stone-punched': { material: 'stone', rhythm: 'punched', ...HX },
  'brick-pier': { material: 'brick', rhythm: 'pier', glass: '#9a4a3a', frame: '#333333' }, 'concrete-banded': { material: 'concrete', rhythm: 'banded', ...HX, glassVar: 0.9 } };
const LATHES = { steel: 'steel', gold: 'gold', satin: 'satin', chrome: 'chrome', '#aa3344': '#aa3344', 'preset-chrome': { preset: 'chrome', specular: 0.5 } };

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
    for (const [k, spec] of Object.entries(CARDS)) expect(h(projectCardOntoQuad(wall, buildFacadeCard(spec, 2, 4), { light: L })), k).toBe(GOLDEN.facade[k]);   // the release bytes
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
    for (const style of Object.keys(GOLDEN.roof)) expect(h(buildRoof(fp, { style, light: L })), style).toBe(GOLDEN.roof[style]);   // the release bytes
    const c = buildRoof(fp, { style: 'modern-shed', metal: { metal: 'copper', film: { age: 30 } }, light: L }); expect(metalOf(c.faces).length).toBeGreaterThan(0);
  });
  it('a metal roof on a flat deck is refused at plan time, naming the pitched styles (it used to be dropped without a word)', () => {
    for (const roof of [{ metal: { metal: 'zinc' } }, { style: 'flat', metal: { metal: 'zinc' } }, { style: 'tofu-deck', metal: { metal: 'copper' } }]) {
      expect(() => planEdifice(MASS({ material: 'glass', glass: '#88aacc', frame: '#333' }, roof))).toThrow(/mass 'a' roof\.metal: a metal roof needs a pitched style \(bungalow, mission.*'(flat|tofu-deck)' is a flat deck/);
    }
    expect(() => planEdifice(MASS({ material: 'glass', glass: '#88aacc', frame: '#333' }, { style: 'tofu-stacked', metal: { metal: 'zinc' } }))).not.toThrow();   // its hip room wears it
    expect(metalOf(buildRoof(fp, { style: 'tofu-stacked', metal: { metal: 'zinc' }, light: L }).faces).length).toBeGreaterThan(0);
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

describe('metal cladding on a floorplan house (metal-surfaces S5)', () => {
  const skin = (o) => structurizeFloorplan({ seed: 7 }, { style: null, facadeStyle: 'metal', facadeDecor: true, view: 'exterior', ...o }).faces.filter((f) => f.group === 'facade:skin');
  it('each cladding wears its own metal; a panel\'s dark open joint is not metal (it used to shade as aluminium)', () => {
    for (const cladding of Object.keys(METAL_CLADDING)) {
      const faces = skin({ cladding }), tagged = faces.filter((f) => f.metal);
      expect(tagged.length, cladding).toBeGreaterThan(0);
      expect(new Set(tagged.map((f) => JSON.parse(f.metal.s).metal)), cladding).toEqual(new Set([METAL_CLADDING[cladding].metal]));
      const joints = faces.filter((f) => !f.metal);
      if (cladding === 'panel') { expect(joints.length).toBeGreaterThan(0); for (const f of joints) expect(parseInt(f.fill.slice(1, 3), 16)).toBeLessThan(0x40); }
      else expect(joints).toHaveLength(0);
    }
  });
  it('facadeMetal overrides the cladding\'s metal', () => {
    const tagged = skin({ cladding: 'corrugated', facadeMetal: { metal: 'copper', film: { age: 5 } } }).filter((f) => f.metal);
    expect(tagged.length).toBeGreaterThan(0);
    expect(tagged.every((f) => JSON.parse(f.metal.s).metal === 'copper')).toBe(true);
  });
  it('roofMetal sheets a pitched roof; on a flat deck, or with no roof, the mint refuses it by name', () => {
    const roofMetal = { metal: 'copper' };
    expect(structurizeFloorplan({ seed: 7 }, { style: null, roof: 'mission', roofMetal, view: 'exterior' }).faces.filter((f) => f.metal).length).toBeGreaterThan(0);
    const mint = (m) => () => mintSketch({ title: 'metal roof', manifest: { kind: 'floorplan', title: 'h', seed: 3, ...m } });
    expect(mint({ style: null, roof: 'tofu-deck', roofMetal })).toThrow(/roofMetal: a metal roof needs a pitched style .*'tofu-deck' is a flat deck/);
    expect(mint({ style: null, roof: { style: 'tofu-deck', metal: roofMetal } })).toThrow(/roof\.metal: a metal roof needs a pitched style/);
    expect(mint({ style: null, roofMetal })).toThrow(/roofMetal: this house has no roof to wear it/);
    expect(mint({ style: null, roof: 'mission', roofMetal: { metal: 'mithril' } })).toThrow(/roofMetal: unknown metal 'mithril'/);
  });
});

describe('a material lathe without a metal keeps the release bytes', () => {
  it('shelf names, a hex and a preset object lower as before metal surfaces', () => {
    const lathe = (material) => ({ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 10 }, profile: [{ t: 0, radius: 3 }, { t: 0.5, radius: 4 }, { t: 1, radius: 0 }], material });
    for (const [k, m] of Object.entries(LATHES)) expect(h(lowerObjectFaces({ kind: 'workbench', lathes: [lathe(m)] }, WORKBENCH_LIGHT)), k).toBe(GOLDEN.lathe[k]);
  });
});
