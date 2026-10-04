import { describe, it, expect, vi } from 'vitest';

// The round street kit (elements.roundKit): the kit's poles, heads, lenses, bins, bollards and piers drawn round.
// Off, the plan is byte-identical; on, every box keeps its kind, footprint, heights and tint (so tenancy, the LOD
// table, the census and the lamp sources read the same numbers) and only gains a shape and its dress.
vi.setConfig({ testTimeout: 120000 });

import { createHash } from 'node:crypto';
import { withPngPixels } from '../../util/png-pixels.fixture.js';
import { planFractalCity, assembleFractalCityScene, normalizeFractalCityElements } from './fractal-city.js';
import { roundStreetKit, roundKitFaces, isRoundKitShape } from './round-kit.js';
import { makeLight } from '../polygonizer/vexar.js';
import { buildingExtras, makeFacade } from '../architecture/building-facade.js';

const STOCK = { seed: 7, anchor: 'freeway', elements: { streetcars: true, frontage: true } };
const METRO = { seed: 3, profile: 'metro', anchor: 'tower', region: { x: 2, y: 2, w: 120, d: 80 }, elements: { frontage: true } };
const CANAL = { seed: 7, profile: 'canal' };
const withKit = (o, on = true) => ({ ...o, elements: { ...(o.elements || {}), roundKit: on } });
const plans = new Map();
const plan = (name, o) => (plans.has(name) ? plans.get(name) : plans.set(name, planFractalCity(o)).get(name));
const CASES = [['stock', STOCK], ['metro', METRO], ['canal', CANAL]];
const strip = ({ shape, round, metal, hood, roundKit, ...rest }) => (isRoundKitShape(shape) ? rest : { shape, ...rest });

describe('round street kit: the element', () => {
  it('is off by default and takes its aliases', () => {
    expect(normalizeFractalCityElements(undefined).roundKit).toBe(false);
    for (const a of ['round', 'rounded', 'roundPoles', 'roundKit']) expect(normalizeFractalCityElements([a]).roundKit).toBe(true);
  });
  it('off (absent or false) plans the same bytes, and no box carries a kit shape', () => {
    const off = plan('stock:off', STOCK);
    expect(JSON.stringify(planFractalCity(withKit(STOCK, false)).boxes)).toBe(JSON.stringify(off.boxes));
    expect(off.boxes.some((b) => isRoundKitShape(b.shape))).toBe(false);
  });
  // GOLDENS from the release tree before the kit and the city's metal (7925d71, the same calls run there): off, the plan
  // (all but its normalized `elements`, which now names roundKit: false) and the scene keep those bytes
  // a scene's textures hash by their pixels: Node builds compress them differently (util/png-pixels.fixture.js)
  const h = (x) => createHash('sha256').update(withPngPixels(JSON.stringify(x))).digest('hex').slice(0, 16);
  // canal re-pinned when its water faces took `liquid: 'canal'` (the aqua look); the kit-off property is unchanged.
  // metro and canal are 3.0's and plan on dmath (util/math-scope.js): the same bytes everywhere, re-pinned when they took it.
  // The stock city is 2.1.0's generator on the engine's Math, whose bytes turn on the CPU and on Node's pow (22 → 24),
  // measured the same on Linux and macOS for each; a minted stock city keeps them, so its pins are per CPU and Node major
  // (a runtime nobody measured, Windows or another major, skips).
  const RELEASE = { metro: ['26b0d6c6b877c6a9', 'd1de92f4c5babcad'], canal: ['914b85d5ddf4209d', '5e8a51ad0de1f693'] };
  const STOCK_RELEASE = {
    'x64-22': ['52bf3c17e291ede6', '293e04862bfa91b1'], 'arm64-22': ['b6a090d979ee8c58', 'b6de9f37038d57b1'],
    'x64-24': ['ef366fd05f29de7b', 'bec1fc975276bed8'], 'arm64-24': ['ef366fd05f29de7b', 'bec1fc975276bed8'],
  };
  RELEASE.stock = process.platform === 'win32' ? undefined : STOCK_RELEASE[`${process.arch}-${process.versions.node.split('.')[0]}`];
  for (const [name, spec] of CASES) it.skipIf(!RELEASE[name])(`off, the ${name} plan and scene are the release bytes`, () => {
    const { elements: _e, ...rest } = plan(`${name}:off`, spec);
    expect(h(rest)).toBe(RELEASE[name][0]);
    expect(h(assembleFractalCityScene(spec))).toBe(RELEASE[name][1]);
  });
});

describe.each(CASES)('round street kit on the %s city', (name, spec) => {
  const off = () => plan(`${name}:off`, spec), on = () => plan(`${name}:on`, withKit(spec));
  it('keeps every box, footprint and tint, the grounds and faces, and the lamp sources', () => {
    expect(on().boxes.length).toBe(off().boxes.length);
    expect(JSON.stringify(on().boxes.map(strip))).toBe(JSON.stringify(off().boxes.map(strip)));
    expect(JSON.stringify(on().grounds)).toBe(JSON.stringify(off().grounds));
    expect(JSON.stringify(on().sources)).toBe(JSON.stringify(off().sources));
    expect(on().sources.length).toBeGreaterThan(0);
  });
  it('rounds every lamp: the post, the head (a lantern on the canal)', () => {
    const lamps = on().boxes.filter((b) => b.kind === 'street-lamp');
    expect(lamps.length).toBeGreaterThan(0);
    for (const b of lamps) {
      if (b.z0 === 0) expect(b.shape).toBe('kit-pole');
      if (b.tint === '#f0d982') expect(b.shape).toBe(name === 'canal' ? 'kit-lantern' : 'kit-head');
      expect(isRoundKitShape(b.shape)).toBe(true);
    }
  });
});

describe('round street kit: roles and materials', () => {
  const stock = () => plan('stock:on', withKit(STOCK)), metro = () => plan('metro:on', withKit(METRO));
  it('the stock city covers the whole kit: signals, signs, power and tram poles, freeway lamps and piers', () => {
    const shaped = (kind) => stock().boxes.filter((b) => b.kind === kind);
    for (const kind of ['street-signal', 'street-sign', 'tram-pole', 'freeway-lamp', 'pillar']) {
      expect(shaped(kind).length, kind).toBeGreaterThan(0);
      expect(shaped(kind).some((b) => b.shape === 'kit-pole' || b.shape === 'kit-pier'), kind).toBe(true);
    }
    expect(shaped('street-signal').filter((b) => b.shape === 'kit-lens').length).toBe(3 * shaped('street-signal').filter((b) => b.shape === 'kit-pole').length);
    expect(shaped('street-signal').some((b) => b.tint === '#26282b' && !b.shape)).toBe(true);   // the housing stays a box
    expect(shaped('freeway-lamp').some((b) => b.shape === 'kit-head')).toBe(true);
    const power = plan('tower:on', withKit({ seed: 7, anchor: 'tower' })).boxes.filter((b) => b.kind === 'power-pole');
    expect(power.some((b) => b.shape === 'kit-pole' && !b.metal)).toBe(true);   // wood, not metal
    expect(power.some((b) => !b.shape)).toBe(true);                             // the crossarm stays sawn timber
  });
  it('metro lamp standards are aluminium, stock ones painted; sign posts are galvanized everywhere', () => {
    const pole = (p, kind) => p.boxes.find((b) => b.kind === kind && b.shape === 'kit-pole');
    expect(pole(metro(), 'street-lamp').metal).toEqual({ metal: 'aluminium', finish: 'brushed' });
    expect(pole(stock(), 'street-lamp').metal).toBeUndefined();
    for (const p of [stock(), metro()]) expect(pole(p, 'street-sign').metal).toEqual({ metal: 'zinc', finish: 'spangle' });
  });
  it('is a pure post-pass: a pre-shaped box and an unknown kind pass by identity', () => {
    const tree = { kind: 'city-tree', shape: 'tree', x: 0, y: 0, w: 1, d: 1, z0: 0, z1: 2 };
    const bench = { kind: 'park-bench', x: 0, y: 0, w: 1, d: 0.3, z0: 0, z1: 0.4 };
    const out = roundStreetKit([tree, bench]);
    expect(out[0]).toBe(tree); expect(out[1]).toBe(bench);
  });
});

describe('round street kit: the realizer', () => {
  const L = makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
  const all = () => [...plan('stock:on', withKit(STOCK)).boxes, ...plan('metro:on', withKit(METRO)).boxes, ...plan('canal:on', withKit(CANAL)).boxes];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  it('draws every shape inside its footprint (a luminaire overhangs by a tenth, a collar by its flare), wound outward', () => {
    const seen = new Set();
    for (const b of all()) {
      if (!isRoundKitShape(b.shape) || seen.has(b.shape)) continue;
      seen.add(b.shape);
      const faces = roundKitFaces(b, L);
      expect(faces.length, b.shape).toBeGreaterThan(0);
      const tol = Math.max(0.12 * Math.max(b.w, b.d), (Math.min(b.w, b.d) / 2) * (((b.round && b.round.collar) || 1) - 1)) + 1e-5;   // corners are rounded to 5 decimals
      for (const f of faces) for (const [x, y] of f.corners) {
        expect(x).toBeGreaterThanOrEqual(b.x - tol); expect(x).toBeLessThanOrEqual(b.x + b.w + tol);
        expect(y).toBeGreaterThanOrEqual(b.y - tol); expect(y).toBeLessThanOrEqual(b.y + b.d + tol);
      }
      if (['kit-pole', 'kit-drum', 'kit-pier', 'kit-bollard'].includes(b.shape)) {
        const ax = [b.x + b.w / 2, b.y + b.d / 2];
        for (const f of faces.filter((g) => !g.radius)) {
          const c = f.corners, n = cross(sub(c[2], c[0]), sub(c[3], c[1]));
          const m = [(c[0][0] + c[2][0]) / 2 - ax[0], (c[0][1] + c[2][1]) / 2 - ax[1]];
          expect(n[0] * m[0] + n[1] * m[1], b.shape).toBeGreaterThan(0);
        }
      }
    }
    for (const s of ['kit-pole', 'kit-arm', 'kit-head', 'kit-lantern', 'kit-lantern-roof', 'kit-lens', 'kit-pier']) expect(seen.has(s), s).toBe(true);
  });
  it('caps are border-radius faces (no clip-path fans), the stop plate an octagon clip', () => {
    const pole = roundKitFaces({ kind: 'street-lamp', shape: 'kit-pole', round: { taper: 0.7, collar: 1.7 }, x: 0, y: 0, w: 0.09, d: 0.09, z0: 0, z1: 2.35, tint: '#555b62' }, L);
    expect(pole.filter((f) => f.radius === '50%' && f.radiusSeg === 2).length).toBe(2);   // an 8-sided ring's caps: 2 segments a quarter
    expect(pole.some((f) => f.clip)).toBe(false);
    const plate = roundKitFaces({ kind: 'stop-sign', shape: 'kit-octagon', x: -0.18, y: -0.045, w: 0.36, d: 0.09, z0: 1.18, z1: 1.52, tint: '#b93632' }, L);
    expect(plate.filter((f) => f.clip && f.clip.startsWith('polygon(')).length).toBe(4);
  });
  it('a metal part is tagged for the metal channel; a lamp glass never is', () => {
    const head = roundKitFaces({ kind: 'street-lamp', shape: 'kit-head', hood: '#555b62', metal: { metal: 'aluminium', finish: 'blasted' }, x: 0, y: 0, w: 0.18, d: 0.16, z0: 2.06, z1: 2.22, tint: '#f0d982' }, L);
    expect(head.some((f) => f.metal)).toBe(true);
    expect(head.filter((f) => !f.metal).length).toBe(17);   // the bowl's two rings of eight panes and its disc
    const painted = roundKitFaces({ kind: 'street-lamp', shape: 'kit-pole', x: 0, y: 0, w: 0.09, d: 0.09, z0: 0, z1: 2.35, tint: '#555b62' }, L);
    expect(painted.some((f) => f.metal)).toBe(false);
  });
});

describe('round street kit: instanced furniture', () => {
  it('kit pieces instance, with exact face accounting', () => {
    const SPEC = withKit({ region: { x: 2, y: 2, w: 30, d: 18 }, depth: 2, seed: 1 });
    const plain = assembleFractalCityScene(SPEC), inst = assembleFractalCityScene({ ...SPEC, instancing: true });
    const depicted = inst.repeats.reduce((a, r) => a + r.template.length * r.transforms.length, 0);
    expect(inst.faces.length + depicted).toBe(plain.faces.length);
    expect(inst.repeats.some((r) => r.template.some((f) => f.radius === '50%'))).toBe(true);
  });
  it('a metal kit piece stays expanded, so it keeps its metal shading (the instanced channel carries none)', () => {
    const SPEC = withKit({ region: { x: 2, y: 2, w: 30, d: 18 }, depth: 2, seed: 1 });
    const plain = assembleFractalCityScene(SPEC), inst = assembleFractalCityScene({ ...SPEC, instancing: true });
    expect(inst.repeats.every((r) => r.template.every((f) => !f.metal))).toBe(true);
    const metal = (sc) => sc.faces.filter((f) => f.metal).length;
    expect(metal(plain)).toBeGreaterThan(0); expect(metal(inst)).toBe(metal(plain));
  });
});

describe('round street kit: round two (playgrounds, wires, rooftops)', () => {
  const big = () => plan('big:on', withKit({ seed: 5, anchor: 'tower', region: { x: 0, y: 0, w: 80, d: 52 }, depth: 4, elements: { frontage: true } }));
  it('playground frames are tube: posts round, beams and bars rods; seats, chains and sandboxes stay built', () => {
    const play = big().boxes.filter((b) => b.kind.startsWith('play-'));
    const swing = play.filter((b) => b.kind === 'play-swing');
    expect(swing.filter((b) => b.shape === 'kit-pole').length).toBe(4 * swing.filter((b) => b.shape === 'kit-arm').length);   // four posts a top beam
    expect(swing.some((b) => !b.shape)).toBe(true);                                                                           // seats and chains
    expect(play.filter((b) => b.kind === 'play-sandbox').every((b) => !b.shape)).toBe(true);
    expect(play.some((b) => b.kind === 'play-seesaw' && b.shape === 'kit-drum')).toBe(true);
    expect(big().boxes.filter((b) => b.kind === 'power-line').every((b) => b.shape === 'kit-arm')).toBe(true);
  });
  it('buildings carry the flag to their rooftop kit; off, the extras are byte-identical', () => {
    expect(big().boxes.filter((b) => b.kind === 'building').every((b) => b.roundKit === true)).toBe(true);
    const box = { x: 0, y: 0, w: 4, d: 4, z0: 0, z1: 9 };
    for (const seed of [1, 2, 3, 5, 8, 13]) {
      const f = makeFacade(seed, { height: 9 });
      expect(JSON.stringify(buildingExtras(box, f, 6, 3, { round: false }))).toBe(JSON.stringify(buildingExtras(box, f, 6, 3)));
      const on = buildingExtras(box, f, 6, 3, { round: true });
      for (const b of on.boxes) if (b.shape) expect(isRoundKitShape(b.shape)).toBe(true);
    }
    const tankFacade = { ...makeFacade(1, { height: 9 }), rooftopKit: ['water-tank', 'smoke-stack', 'antenna', 'satellite-dish'] };
    const on = buildingExtras(box, tankFacade, 6, 3, { round: true });
    expect(on.boxes.map((b) => b.shape).filter(Boolean)).toEqual(['kit-tank', 'kit-pole', 'kit-drum', 'kit-pole', 'kit-drum']);
    expect(on.faces.some((f) => f.radius === '50%')).toBe(true);   // the dish
  });
});
