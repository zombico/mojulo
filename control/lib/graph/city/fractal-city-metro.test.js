import { describe, expect, it, vi } from 'vitest';

// The metro profile: the storey stays, and block pitch, rights-of-way, lot grain,
// heights and the street kit come into proportion with it. The bands below are real-world
// ones, measured in metres by cityScaleCensus over three seeds; the stock city must not move at all.
vi.setConfig({ testTimeout: 120000 });

import { planFractalCity, assembleFractalCityScene, cityScaleCensus, fractalCityCameras, metroAtmosphere, FRACTAL_CAMERAS, METRO, CITY_METERS_PER_UNIT } from './fractal-city.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { assembleBoxCityScene } from '../scene/scene-css3d.js';
import { facadeReadHex } from '../architecture/facade-card.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { hexToRgb } from '../polygonizer/vexar.js';
import { CITY_FLAVORS, normalizeCityFlavor, resolveMintFlavor } from './city-flavors.js';

const FRAME = { x: 2, y: 2, w: 220, d: 140 };
const metro = (seed, extra = {}) => planFractalCity({ seed, profile: 'metro', anchor: 'tower', region: FRAME, elements: { frontage: true }, ...extra });
const PLANS = [1, 7, 42].map((seed) => metro(seed));
const CENSUS = PLANS.map((p) => cityScaleCensus(p, FRAME));
const MASS = new Set(['building', 'anchor', 'midtower', 'townhouse', 'house']);
const overlap = (a, b, e = 1e-6) => a.x + e < b.x + b.w && b.x + e < a.x + a.w && a.y + e < b.y + b.d && b.y + e < a.y + a.d;

describe('metro profile: the stock city is untouched', () => {
  it('an absent profile plans the same city as profile "city", with no metro fields', () => {
    const a = planFractalCity({ seed: 7, anchor: 'tower' }), b = planFractalCity({ seed: 7, anchor: 'tower', profile: 'city' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.cues).toBeUndefined();
    expect(a.core).toBeUndefined();
    expect(a.stats.profile).toBeUndefined();
  });
  it('the stock recipe keeps the stock cameras', () => {
    expect(fractalCityCameras({ seed: 7 })).toBe(FRACTAL_CAMERAS);
    expect(assembleFractalCityScene({ seed: 7 }).cameras).toEqual(FRACTAL_CAMERAS);
  });
});

describe('metro profile: proportion bands (metres)', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(metro(7))).toBe(JSON.stringify(PLANS[1]));
  });
  it('blocks sit at a real downtown pitch with a real crossing density', () => {
    for (const c of CENSUS) {
      expect(c.pitch).toBeGreaterThan(90);            // Portland 81 m … Manhattan / Chicago ≈ 140 m (√ area per block)
      expect(c.pitch).toBeLessThan(145);
      expect(c.crossingsPerKm2).toBeGreaterThan(45);  // Manhattan 46, Eixample 56, Portland 172
      expect(c.crossingsPerKm2).toBeLessThan(170);
      expect(c.streetShare).toBeLessThan(0.42);       // walk bands; crossings count twice
    }
  });
  it('heights are heavy-tailed and peak at the core', () => {
    for (const c of CENSUS) {
      expect(c.height.p50).toBeGreaterThan(12);       // all Manhattan 18 m, Midtown 20 m
      expect(c.height.p50).toBeLessThan(30);
      expect(c.height.max).toBeGreaterThan(150);
      expect(c.height.maxOverP50).toBeGreaterThan(7); // CBDs 8–24×
      expect(c.core.coreP50).toBeGreaterThan(c.core.edgeP50 * 1.5);
      expect(c.towers).toBeGreaterThan(3);
      expect(c.minSlenderness).toBeGreaterThan(3.5);  // nothing over 100 m is a slab
    }
  });
  it('the root tower is slender, not a third of the frame', () => {
    for (const p of PLANS) {
      const a = p.boxes.find((b) => b.kind === 'anchor');
      expect(a).toBeTruthy();
      expect((a.z1 - a.z0) / Math.min(a.w, a.d)).toBeGreaterThanOrEqual(METRO.anchor.slender);
      expect((a.z1 - a.z0) * CITY_METERS_PER_UNIT).toBeGreaterThan(170);
    }
  });
  it('no sub-anchor slab: a k16-size metro region carries no quadrant-sized mass', () => {
    const p = planFractalCity({ seed: 7, profile: 'metro', region: { x: 2, y: 2, w: 480, d: 288 }, depth: 6 });
    const masses = p.boxes.filter((b) => MASS.has(b.kind));
    expect(masses.every((b) => b.w * b.d < 0.01 * 480 * 288)).toBe(true);
  });
  it('the street kit stands at its real size, and a signalled crossing carries no stop signs', () => {
    for (const c of CENSUS) {
      expect(c.kit.streetSign).toBeLessThan(3.5);
      expect(c.kit.signal).toBeLessThan(6);
      expect(c.kit.stopSign).toBeNull();
    }
  });
});

describe('metro profile: fabric integrity', () => {
  it('masses stand wall to wall but never inside each other', () => {
    for (const p of PLANS) {
      const m = p.boxes.filter((b) => MASS.has(b.kind));
      for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) expect(overlap(m[i], m[j], 0.26)).toBe(false);
    }
  });
  it('walk tiles never overlap each other (the renderer lift never fires on them)', () => {
    const w = PLANS[1].grounds.filter((g) => g.kind === 'sidewalk');
    expect(w.length).toBeGreaterThan(20);
    for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) expect(overlap(w[i], w[j])).toBe(false);
  });
  it('a metro mass carries whole floors at a real floor height', () => {
    const b = PLANS[1].boxes.filter((x) => x.kind === 'building');
    expect(b.every((x) => Number.isInteger(x.floors) && x.floors >= 1)).toBe(true);
    expect(b.every((x) => [METRO.floorH.residential, METRO.floorH.office].includes(x.floorH))).toBe(true);
  });
  it('the portal car is a real-size car', () => {
    const p = metro(7, { traffic: true });
    const rects = p.faces.filter((f) => f.portalCarRect).map((f) => f.portalCarRect);
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) expect(Math.max(r.w, r.d) * CITY_METERS_PER_UNIT).toBeLessThan(4.7);
  });
});

describe('metro profile: cameras and cues', () => {
  it('opens on a 1.7 m street eye and hands the world path its real-size cues', () => {
    const cams = fractalCityCameras({ profile: 'metro', region: FRAME });
    expect(cams.map((c) => c.name)).toEqual(['street', 'aerial', 'skyline']);
    expect(cams[0].worldFraming.cameraPosition[2] * CITY_METERS_PER_UNIT).toBeCloseTo(1.7, 5);
    const scene = assembleFractalCityScene({ seed: 7, profile: 'metro', region: FRAME });
    expect(scene.cameras).toEqual(cams);
    expect(scene.cityCues).toEqual({ figure: METRO.figure, car: METRO.car, pedHeight: METRO.pedHeight });
  });
  it('a stock-depth metro recipe still reaches block size (depth is not a metro block dial)', () => {
    const shallow = cityScaleCensus(planFractalCity({ seed: 7, profile: 'metro', region: FRAME, depth: 2 }), FRAME);
    expect(shallow.pitch).toBeLessThan(145);
  });
});

describe('metro profile: atmosphere and kerb lamps', () => {
  it('a metro scene carries a gradient sky and a distance haze sized to its frame; the stock scene neither', () => {
    const scene = assembleFractalCityScene({ seed: 7, profile: 'metro', region: FRAME });
    expect(Array.isArray(scene.sky.zenith) && Array.isArray(scene.sky.horizon)).toBe(true);
    expect(scene.haze.density).toBeCloseTo(1.98 / (2 * Math.hypot(FRAME.w, FRAME.d)), 9);
    const stock = assembleFractalCityScene({ seed: 7 });
    expect(stock.haze).toBeUndefined();
    expect(metroAtmosphere({ seed: 7 })).toBeNull();
    expect(metroAtmosphere({ profile: 'metro', region: FRAME }, 'night').sky.stars).toBe(1);
  });
  it('the World page emits the haze only when asked', () => {
    const faces = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#888888' }];
    expect(emitThreeWorld({ faces, haze: { color: '#c6cfda', density: 0.004 } })).toContain('new THREE.FogExp2');
    expect(emitThreeWorld({ faces })).not.toContain('distance haze');
  });
  it('lamps stand along the kerbs between crossings, every one on the walk', () => {
    const p = PLANS[1];
    const heads = p.boxes.filter((b) => b.kind === 'street-lamp' && b.tint === '#f0d982');
    expect(heads.length).toBeGreaterThan(4 * p.stats.crossings);          // more than the crossings' own four
    const poles = p.boxes.filter((b) => b.kind === 'street-lamp' && b.z0 === 0);
    const masses = p.boxes.filter((b) => MASS.has(b.kind));
    for (const pole of poles) expect(masses.some((m) => overlap(m, pole))).toBe(false);
  });
});

// colour: real facades are low in chroma, glass is the darkest of them (solar albedo 0.08 against
// 0.1–0.4 for concrete, stone and brick), and the material follows a district, glass at the core
const lum = (hex) => { const [r, g, b] = hexToRgb(hex).map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const chroma = (hex) => { const c = hexToRgb(hex).map((v) => v / 255); return Math.max(...c) - Math.min(...c); };
const skinnable = (p) => p.boxes.filter((b) => b.metro && ['building', 'anchor', 'midtower'].includes(b.kind));
describe('metro profile: materials', () => {
  it('every metro mass wears a skin; the stock city wears none', () => {
    for (const p of PLANS) {
      const masses = skinnable(p);
      expect(masses.length).toBeGreaterThan(100);
      for (const b of masses) {
        expect(['glass', 'stone', 'brick']).toContain(b.skin.material);
        for (const k of ['glass', 'frame', 'roof']) expect(b.skin[k]).toMatch(/^#[0-9a-f]{6}$/);
      }
      const { glass, stone, brick } = p.stats.skins;
      expect(glass + stone + brick).toBe(masses.length);
      expect(Math.min(glass, stone, brick)).toBeGreaterThan(0);
    }
    expect(planFractalCity({ seed: 7, anchor: 'tower' }).boxes.some((b) => b.skin)).toBe(false);
  });
  it('skins are low in chroma, and glass is darker than the masonry around it', () => {
    const skins = PLANS.flatMap((p) => skinnable(p).map((b) => b.skin));
    const colours = skins.flatMap((k) => [k.glass, k.frame, k.roof]);
    for (const c of colours) expect(chroma(c)).toBeLessThan(0.25);                         // brick is the most chromatic, ≈ 0.2
    expect(colours.reduce((a, c) => a + chroma(c), 0) / colours.length).toBeLessThan(0.08);
    for (const k of skins.filter((k) => k.material === 'stone')) expect(lum(k.glass)).toBeLessThan(lum(k.frame));
    const mean = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
    expect(mean(skins.filter((k) => k.material === 'glass').map((k) => lum(k.glass))))
      .toBeLessThan(mean(skins.filter((k) => k.material === 'stone').map((k) => lum(k.frame))) / 2.5);
  });
  it('glass gathers at the core and masonry toward the edge; towers are never brick, brick stays walk-up height', () => {
    for (const p of PLANS) {
      const masses = skinnable(p), r = (b) => Math.hypot(b.x + b.w / 2 - p.core.cx, b.y + b.d / 2 - p.core.cy);
      const sorted = [...masses].sort((a, b) => r(a) - r(b)), q = Math.floor(sorted.length / 4);
      const glassShare = (xs) => xs.filter((b) => b.skin.material === 'glass').length / xs.length;
      expect(glassShare(sorted.slice(0, q))).toBeGreaterThan(glassShare(sorted.slice(-q)));
      for (const b of masses) {
        if (b.tower || b.kind === 'anchor') expect(b.skin.material).not.toBe('brick');
        if (b.skin.material === 'brick') expect(b.z1 - b.z0).toBeLessThanOrEqual(14);
      }
    }
  });
  it('skinning moves nothing: the massing prune keeps each skin, and a seed always skins the same', () => {
    const full = new Map(skinnable(PLANS[1]).map((b) => [`${b.x},${b.y},${b.z1}`, b.skin]));
    const massing = skinnable(metro(7, { fidelity: 'massing' }));
    expect(massing.length).toBe(full.size);
    for (const b of massing) expect(b.skin).toEqual(full.get(`${b.x},${b.y},${b.z1}`));
  });
  it('a massing box paints its facade\'s average and its own roof', () => {
    const stone = { material: 'stone', glass: '#3f4952', frame: '#c4bfb4', rhythm: 'punched' };
    const read = facadeReadHex(stone);
    expect(lum(read)).toBeGreaterThan(lum(stone.glass));
    expect(lum(read)).toBeLessThan(lum(stone.frame));
    const brick = facadeReadHex({ material: 'brick', glass: '#835d50', frame: '#cfc6b6', rhythm: 'grid' });
    expect(Math.abs(lum(brick) - lum('#835d50'))).toBeLessThan(Math.abs(lum(brick) - lum('#2a2f36')));
    const box = { kind: 'building', lod: 'mass', x: 0, y: 0, w: 4, d: 4, z0: 0, z1: 10 };
    const plain = assembleBoxCityScene({ boxes: [box] }).faces, skinned = assembleBoxCityScene({ boxes: [{ ...box, skin: { ...stone, roof: '#9e9c96' } }] }).faces;
    const top = (fs) => fs.find((f) => f.corners.every((c) => c[2] === 10));
    const [r, g, b] = hexToRgb(top(skinned).fill);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(8);   // a grey roof, not darkened glass
    expect(skinned.map((f) => f.fill)).not.toEqual(plain.map((f) => f.fill));
  });
  it('metro streets run on aged asphalt; the stock streets keep the charcoal', () => {
    const textured = (p) => p.ribbons.filter((rb) => rb.texture).map((rb) => rb.texture);
    expect(new Set(textured(PLANS[1]))).toEqual(new Set(['asphalt-aged']));
    expect(textured(planFractalCity({ seed: 7, anchor: 'tower' }))).not.toContain('asphalt-aged');
    expect(surfaceTexture('asphalt-aged')).toMatch(/^data:image\/png;base64,/);
    expect(surfaceTexture('asphalt-aged')).not.toBe(surfaceTexture('asphalt'));
  });
});

// landmarks: a metro monument stands at its real size (height for a tower; height and ground plan fitted
// together where the plan is the building), so it can be read against the 3 m storey around it
const LANDMARK_CANON = ['taj', 'cn-tower', 'skytree', 'rogers-centre', 'colosseum', 'arena', 'great-pyramid', 'louvre-pyramid', 'mexican-pyramid', 'petronas-towers', 'big-ben', 'stonehenge', 'chinatown-gate', 'arc-de-triomphe', 'parthenon', 'griffith-observatory', 'washington-monument', 'parliament-hill', 'mobile-edm-hall', 'eiffel-tower', 'tokyo-tower', 'empire-state-building', 'gateway-arch', 'cloud-gate', 'statue-of-liberty', 'rizal-monument'];
const withLandmark = (landmark, seed = 7) => metro(seed, { landmark, anchor: null });
const landmarkBoxes = (p) => p.boxes.filter((b) => b.class === 'landmark');
describe('metro profile: landmarks at their real size', () => {
  it('the stock city keeps its demo-frame monument', () => {
    const [b] = landmarkBoxes(planFractalCity({ seed: 7, landmark: 'eiffel-tower' }));
    expect(b.w).toBeCloseTo(18 * 0.3, 9);                    // LANDMARK_FOOTPRINT × the default frame's short side
    expect(planFractalCity({ seed: 7, landmark: 'eiffel-tower' }).stats.landmarkSizes).toBeUndefined();
  });
  it('a tower stands at its real height', () => {
    for (const [shape, m] of [['cn-tower', 553.3], ['eiffel-tower', 330], ['tokyo-tower', 332.9], ['petronas-towers', 451.9], ['washington-monument', 169.3], ['statue-of-liberty', 93]]) {
      const p = withLandmark(shape), [b] = landmarkBoxes(p);
      expect(b.z1 * CITY_METERS_PER_UNIT).toBeCloseTo(m, 0);
      expect(p.stats.landmarkSizes[0]).toMatchObject({ shape, fit: 1 });
    }
  });
  it('a building whose plan is the landmark fits its height and its plan together', () => {
    for (const [shape, h, long, tol] of [['empire-state-building', 443.2, 129, 0.1], ['great-pyramid', 146.6, 230.3, 0.05], ['colosseum', 48, 189, 0.25]]) {
      const [b] = landmarkBoxes(withLandmark(shape)), M = CITY_METERS_PER_UNIT;
      expect(Math.abs(Math.log((b.z1 * M) / h))).toBeLessThan(Math.log(1 + tol));
      expect(Math.abs(Math.log((Math.max(b.w, b.d) * M) / long))).toBeLessThan(Math.log(1 + tol));
    }
  });
  it('every landmark fits the default metro frame at full size, ringed by a real forecourt', () => {
    for (const shape of LANDMARK_CANON) {
      const p = withLandmark(shape), plaza = p.grounds.find((g) => g.kind === 'landmark-plaza'), [b] = landmarkBoxes(p);
      expect(p.stats.landmarkSizes[0].fit).toBe(1);
      expect(plaza.w - b.w).toBeLessThanOrEqual(12 + 1e-9);   // ≤ 6 u (22 m) each side, not a quarter of the cluster
    }
  });
  it('the skyline preset holds the tallest landmark from base to tip; the street eye stands on the avenue that flanks it', () => {
    for (const landmark of ['cn-tower', ['cn-tower', 'rogers-centre'], 'eiffel-tower', 'great-pyramid', 'colosseum', 'empire-state-building']) {
      const recipe = { seed: 7, profile: 'metro', landmark, region: FRAME }, p = withLandmark(landmark);
      const [street, , sky] = fractalCityCameras(recipe).map((c) => c.worldFraming);
      const top = landmarkBoxes(p).reduce((a, b) => (b.z1 > a.z1 ? b : a));
      const at = [top.x + top.w / 2, top.y + top.d / 2], cam = sky.cameraPosition;
      const dist = Math.hypot(at[0] - cam[0], at[1] - cam[1]), look = Math.atan2(sky.lookAt[2] - cam[2], Math.hypot(sky.lookAt[0] - cam[0], sky.lookAt[1] - cam[1]));
      const half = Math.atan(Math.tan((sky.horizontalFov * Math.PI) / 360) / (1120 / 780));
      expect(Math.atan2(top.z1 - cam[2], dist) - look).toBeLessThan(half);
      expect(look - Math.atan2(-cam[2], dist)).toBeLessThan(half);
      const [ex, ey] = street.cameraPosition;
      const onAvenue = p.ribbons.some((r) => r.width === METRO.street.major && Math.abs(r.path[0][1] - r.path.at(-1)[1]) < 1e-9 && Math.abs(r.path[0][1] - ey) < METRO.street.major / 2 + METRO.walk.major);
      expect(onAvenue).toBe(true);
      const inCarriageway = p.ribbons.filter((r) => r.texture).some((r) => {   // a straight street: within its span and its half-width
        const [[x0, y0], [x1, y1]] = [r.path[0], r.path.at(-1)], h = r.width / 2;
        return Math.abs(y0 - y1) < 1e-9 ? ex >= Math.min(x0, x1) && ex <= Math.max(x0, x1) && Math.abs(ey - y0) < h : ey >= Math.min(y0, y1) && ey <= Math.max(y0, y1) && Math.abs(ex - x0) < h;
      });
      expect(inCarriageway).toBe(false);
      expect(p.boxes.filter((b) => MASS.has(b.kind) || b.class === 'landmark').some((b) => ex > b.x && ex < b.x + b.w && ey > b.y && ey < b.y + b.d)).toBe(false);
    }
  });
  it('the band a plaza leaves against the frame edge is cut into blocks, not one 550 m block', () => {
    const p = withLandmark('great-pyramid');
    const courts = p.grounds.filter((g) => g.kind === 'lot-asphalt' || String(g.kind).startsWith('leftover'));
    for (const g of courts) expect(Math.max(g.w, g.d)).toBeLessThan(80);
  });
});

// flavours: one seed under a regional architecture (city-flavors.js). The dials move, the city's
// skeleton is the kernel's own, and a recipe without one is today's metro city.
const flavored = (flavor, seed = 7) => metro(seed, { flavor });
const masses = (p) => p.boxes.filter((b) => b.metro && ['building', 'anchor', 'midtower'].includes(b.kind));
const share = (xs, f) => xs.filter(f).length / xs.length;
describe('metro profile: regional flavours', () => {
  it('no flavour is north-american is today; the stock city ignores a flavour', () => {
    const na = flavored('north-american'), sansFlavor = (p) => JSON.stringify({ ...p, stats: { ...p.stats, flavor: undefined } });
    expect(na.stats.flavor).toBe('north-american');
    expect(sansFlavor(na)).toBe(JSON.stringify(PLANS[1]));
    expect(JSON.stringify(flavored('atlantis'))).toBe(JSON.stringify(PLANS[1]));   // unknown ⇒ none
    expect(JSON.stringify(planFractalCity({ seed: 7, anchor: 'tower', flavor: 'paris' }))).toBe(JSON.stringify(planFractalCity({ seed: 7, anchor: 'tower' })));
    expect(PLANS[1].stats.flavor).toBeUndefined();
  });
  it('Paris: cut stone under zinc mansards at one cornice line, no towers, white lines', () => {
    const p = flavored('paris'), ms = masses(p).filter((b) => b.kind === 'building');
    expect(p.stats.flavor).toBe('paris');
    expect(share(ms, (b) => b.skin.material === 'stone')).toBeGreaterThan(0.85);
    expect(ms.some((b) => b.tower)).toBe(false);
    for (const b of ms) expect(b.z1).toBeLessThanOrEqual(CITY_FLAVORS.paris.height.cap + 0.13);
    expect(share(ms, (b) => b.skin.roofCap && b.skin.roofCap.form === 'mansard')).toBeGreaterThan(0.7);
    expect(share(ms, (b) => b.skin.balcony && b.skin.balconyType === 'continuous')).toBeGreaterThan(0.6);
    expect(p.ribbons.some((r) => r.tint === CITY_FLAVORS.paris.street.centreLine)).toBe(true);
    expect(PLANS[1].ribbons.some((r) => r.tint === CITY_FLAVORS.paris.street.centreLine)).toBe(false);
  });
  it('New York: a wooden tank on most roofs over six storeys, fire escapes on the brick', () => {
    const ms = masses(flavored('new-york')).filter((b) => !b.tower && b.kind === 'building');
    expect(share(ms.filter((b) => b.floors >= 6), (b) => b.skin.kit && b.skin.kit.includes('wood-tank'))).toBeGreaterThan(0.6);
    expect(ms.some((b) => b.floors < 6 && b.skin.kit)).toBe(false);
    expect(share(ms.filter((b) => b.skin.material === 'brick'), (b) => b.skin.fireEscape)).toBeGreaterThan(0.7);
  });
  it('Tokyo: narrower lots than the default, no brick, blade signs on the mid-rise', () => {
    const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const front = (p) => median(masses(p).filter((b) => !b.tower && b.kind === 'building').map((b) => Math.min(b.w, b.d)));
    const tokyo = flavored('tokyo'), ms = masses(tokyo);
    expect(front(tokyo)).toBeLessThan(front(PLANS[1]));
    expect(ms.some((b) => b.skin.material === 'brick')).toBe(false);
    expect(share(ms.filter((b) => b.floors >= 3 && b.floors <= 10 && !b.tower), (b) => b.skin.blades)).toBeGreaterThan(0.4);
  });
  it('the Mediterranean: render under terracotta, low and even', () => {
    const ms = masses(flavored('mediterranean')).filter((b) => b.kind === 'building');
    expect(share(ms, (b) => b.skin.material === 'stone')).toBeGreaterThan(0.85);
    expect(share(ms, (b) => b.skin.roofCap && b.skin.roofCap.form === 'hip')).toBeGreaterThan(0.5);
    expect(share(ms, (b) => b.z1 <= CITY_FLAVORS.mediterranean.height.cap + 0.13 || b.tower)).toBe(1);
  });
  it('every flavour plans a whole city, and a roof cap never rides a tower', () => {
    for (const flavor of Object.keys(CITY_FLAVORS)) {
      const p = flavored(flavor), ms = masses(p);
      expect(ms.length).toBeGreaterThan(200);
      for (const b of ms) if (b.tower || b.kind === 'anchor') expect(b.skin.roofCap).toBeUndefined();
    }
  });
  it('names resolve by city and country, and the mint-time resolver is pure', () => {
    expect(normalizeCityFlavor('New York')).toBe('new-york');
    expect(normalizeCityFlavor('Buenos Aires')).toBe('latin-american');
    expect(normalizeCityFlavor('São Paulo')).toBe('latin-american');
    expect(normalizeCityFlavor('atlantis')).toBeNull();
    expect(resolveMintFlavor({ flavor: 'rome' })).toBe('mediterranean');
    expect(resolveMintFlavor({ landmarks: ['eiffel-tower'] })).toBe('paris');
    expect(resolveMintFlavor({ region: 'east-asia', seed: 9 })).toBe('tokyo');
    expect(resolveMintFlavor({ seed: 42 })).toBe(resolveMintFlavor({ seed: 42 }));
  });
});

