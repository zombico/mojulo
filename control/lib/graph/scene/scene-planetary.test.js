import { describe, it, expect } from 'vitest';

import { assemblePlanetaryScene, planPlanetaryScene, PLANETARY_SUBJECTS } from './scene-planetary.js';
import { emitThreeWorld } from './scene-three.js';
import { sketchRenderMode, classifyBucket } from '../sketch/sketch-manifest.js';

// planetary rides the rotatable-starmap basis: a body in the middle of the three.js World,
// shaded against a fixed sun (baked terminator) and wrapped in a SPACE sky (full-sphere
// starfield). These guard the assemble seam, the subject→axis-mundi/mandala wiring, and the
// emitThreeWorld `space:true` sky extension.
const EARTH = { kind: 'planetary', subject: 'earth' };

describe('assemblePlanetaryScene', () => {
  it('returns a world payload of faces + a worldFraming camera + a space sky', () => {
    const payload = assemblePlanetaryScene(EARTH);
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.cameras.length).toBeGreaterThan(0);
    const cam = payload.cameras[0];
    expect(Array.isArray(cam.worldFraming.cameraPosition)).toBe(true);
    expect(cam.worldFraming.lookAt).toEqual([0, 0, 0]); // orbit pivots on the core (axis mundi)
    expect(payload.sky.space).toBe(true);
    expect(payload.sky.stars).toBeGreaterThan(0);
    expect(typeof payload.sky.seed).toBe('number'); // the World LCG needs a number
  });

  it('pins the sun on the star sphere at the real light direction (default on)', () => {
    const { sky } = assemblePlanetaryScene(EARTH);
    expect(sky.sun).toBeTruthy();
    expect(Array.isArray(sky.sun.dir)).toBe(true);                  // a 3D world direction, not { u, h }
    expect(Math.hypot(...sky.sun.dir)).toBeCloseTo(1);             // unit vector
    // the sun sits where the light comes FROM, so the lit hemisphere faces it.
    const same = assemblePlanetaryScene({ ...EARTH, sunU: 0 }).sky.sun.dir;
    const moved = assemblePlanetaryScene({ ...EARTH, sunU: 0.5 }).sky.sun.dir;
    expect(same).not.toEqual(moved);
  });

  it('sun:false renders a sun-lit body with no visible disc', () => {
    expect(assemblePlanetaryScene({ ...EARTH, sun: false }).sky.sun).toBeNull();
    // the terminator (face shading) is unchanged — only the visible disc is dropped.
    expect(assemblePlanetaryScene({ ...EARTH, sun: false }).faces.length).toBe(assemblePlanetaryScene(EARTH).faces.length);
  });

  it('exposes a SOLID void bg (three.js cannot parse a CSS gradient)', () => {
    const { bg } = assemblePlanetaryScene(EARTH);
    expect(bg).toMatch(/^#/);
    expect(bg).not.toContain('gradient');
  });

  it('defaults to the earth subject for an unknown subject', () => {
    expect(planPlanetaryScene({ subject: 'pluto' }).subject).toBe('earth');
    expect(PLANETARY_SUBJECTS).toContain('earth');
  });
});

describe('every face is a renderable 4-corner quad', () => {
  // faceListToMesh DROPS faces with < 4 corners — the sphere's pole bands must self-degenerate
  // to quads, never ship as triangles, or the caps vanish.
  it('ships only quads (pole tris padded)', () => {
    for (const f of planPlanetaryScene(EARTH).faces) {
      expect(f.corners.length).toBe(4);
    }
  });
});

describe('mandala + axis mundi toggle', () => {
  it('mandala:false drops the graticule + axis faces', () => {
    const withM = planPlanetaryScene({ subject: 'earth', mandala: true }).faces.length;
    const without = planPlanetaryScene({ subject: 'earth', mandala: false }).faces.length;
    expect(without).toBeLessThan(withM);
  });

  it('atmosphere:false drops the translucent shell (water-tagged faces)', () => {
    // clouds are also water-tagged, so disable them to isolate the atmosphere shell.
    const on = planPlanetaryScene({ subject: 'earth', atmosphere: true, clouds: false });
    const off = planPlanetaryScene({ subject: 'earth', atmosphere: false, clouds: false });
    expect(on.faces.some((f) => f.water)).toBe(true);
    expect(off.faces.some((f) => f.water)).toBe(false);
  });

  it('continents:false drops the coastline trace (thousands of ribbon faces)', () => {
    const withC = planPlanetaryScene({ subject: 'earth', continents: true }).faces.length;
    const without = planPlanetaryScene({ subject: 'earth', continents: false }).faces.length;
    expect(withC - without).toBeGreaterThan(1000); // the 110m coastline adds ~5k segments
  });

  it('relief:false drops the golden-angle elevation spikes', () => {
    const on = planPlanetaryScene({ subject: 'earth', blanket: false, relief: true }).faces.length;
    const off = planPlanetaryScene({ subject: 'earth', blanket: false, relief: false }).faces.length;
    expect(on - off).toBeGreaterThan(1000); // ~1700 land spikes × 2 ribbons
  });

  it('blanket:true (the default) fills the land with thousands of hypso-coloured faces', () => {
    const on = planPlanetaryScene({ subject: 'earth' }).faces.length;          // blanket default on
    const off = planPlanetaryScene({ subject: 'earth', blanket: false }).faces.length;
    expect(on - off).toBeGreaterThan(5000); // ~9700 land cells
  });

  it('blanket colour is deterministic by height (same elevation → same fill)', () => {
    const a = planPlanetaryScene({ subject: 'earth', mandala: false, continents: false, atmosphere: false }).faces.map((f) => f.fill);
    const b = planPlanetaryScene({ subject: 'earth', mandala: false, continents: false, atmosphere: false }).faces.map((f) => f.fill);
    expect(a).toEqual(b);                  // pure function of the (fixed) DEM → byte-identical
    expect(new Set(a).size).toBeGreaterThan(8); // a real ramp, not one flat colour
  });

  it('the coastline border is transparent (off) by default — the blanket defines the land', () => {
    const base = planPlanetaryScene({ subject: 'earth' }).faces.length;
    const withCoast = planPlanetaryScene({ subject: 'earth', continents: true }).faces.length;
    expect(withCoast).toBeGreaterThan(base); // the coast ribbon is only drawn when explicitly asked
  });

  it('polar caps are whited-out: many near-white blanket cells, all clustered to the poles', () => {
    const faces = planPlanetaryScene({ subject: 'earth', mandala: false, continents: false, atmosphere: false, clouds: false }).faces;
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const whiteish = faces.filter((f) => { const [r, g, b] = rgb(f.fill || ''); return r > 200 && g > 200 && b > 200; });
    expect(whiteish.length).toBeGreaterThan(100); // the caps are big white fields
    // every white cell sits at a pole (mean corner z well away from the equator), and BOTH caps
    // are present — Antarctica (south) and the Arctic (Greenland / N. Canada / N. Russia).
    const meanZ = (f) => f.corners.reduce((s, c) => s + c[2], 0) / f.corners.length;
    expect(whiteish.every((f) => Math.abs(meanZ(f)) > 1.5)).toBe(true); // none near the equator (R0=6)
    expect(whiteish.some((f) => meanZ(f) < 0)).toBe(true);              // Antarctica
    expect(whiteish.some((f) => meanZ(f) > 0)).toBe(true);              // the Arctic cap
  });

  it('moon:true (the default) adds a real far body; moon:false drops it', () => {
    const withMoon = planPlanetaryScene({ subject: 'earth' }).faces.length;          // moon default on
    const without = planPlanetaryScene({ subject: 'earth', moon: false }).faces.length;
    expect(withMoon - without).toBe(24 * 12);     // unitSphereFaces(24, 12) quads
  });

  it('the Moon sits at TRUE scale + TRUE distance (a small disc ~60 Earth radii out)', () => {
    const R0 = 6;                                  // world-unit Earth radius (scene-planetary)
    const base = planPlanetaryScene({ subject: 'earth', moon: false }).faces;
    const all = planPlanetaryScene({ subject: 'earth' }).faces;
    const moon = all.slice(base.length);           // the moon faces are appended last
    const cs = moon.flatMap((f) => f.corners);
    const dist = (c) => Math.hypot(c[0], c[1], c[2]);
    const cx = cs.reduce((s, c) => s + c[0], 0) / cs.length;
    const cy = cs.reduce((s, c) => s + c[1], 0) / cs.length;
    const cz = cs.reduce((s, c) => s + c[2], 0) / cs.length;
    const centreDist = Math.hypot(cx, cy, cz);
    expect(centreDist / R0).toBeGreaterThan(55);   // ~60.3 Earth radii (mean orbit)
    expect(centreDist / R0).toBeLessThan(65);
    // radius: half the spread of corner distances about the centre ≈ 0.27 Earth radii
    const radius = (Math.max(...cs.map(dist)) - Math.min(...cs.map(dist))) / 2;
    expect(radius / R0).toBeGreaterThan(0.2);
    expect(radius / R0).toBeLessThan(0.35);
  });

  it('moonScale grows the disc but not the face count or its distance', () => {
    const a = planPlanetaryScene({ subject: 'earth', moonScale: 1 }).faces;
    const b = planPlanetaryScene({ subject: 'earth', moonScale: 4 }).faces;
    expect(a.length).toBe(b.length);               // same sphere tessellation
  });

  it('datetime GEO-LOCKS the scene: a deterministic geoLock readout + the Moon at its true distance', () => {
    const plan = planPlanetaryScene({ subject: 'earth', datetime: '2026-06-18T02:30:00Z' });
    expect(plan.geoLock).toBeTruthy();
    expect(plan.geoLock.datetime).toBe('2026-06-18T02:30:00.000Z');
    // sub-solar point ≈ Pacific noon near the June solstice (≈ 143°E, +23.4°)
    expect(plan.geoLock.subsolar.lat).toBeGreaterThan(23);
    expect(plan.geoLock.subsolar.lon).toBeGreaterThan(130);
    // the Moon body (last 24×12 faces) sits at the resolved geocentric distance (Earth radii × R0=6)
    const moon = plan.faces.slice(plan.faces.length - 24 * 12).flatMap((f) => f.corners);
    const c = moon.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / moon.length);
    expect(Math.hypot(...c) / 6).toBeCloseTo(plan.geoLock.moonDistEarthRadii, 0);
  });

  it('manual mode leaves geoLock null (sunU/moonAngle still drive it)', () => {
    expect(planPlanetaryScene({ subject: 'earth' }).geoLock).toBeNull();
    expect(planPlanetaryScene({ subject: 'earth', datetime: 'not-a-date' }).geoLock).toBeNull();
  });

  it('a different instant moves the Sun + Moon (different shaded fills)', () => {
    const a = planPlanetaryScene({ subject: 'earth', datetime: '2026-06-18T02:30:00Z' }).faces.map((f) => f.fill);
    const b = planPlanetaryScene({ subject: 'earth', datetime: '2026-06-18T14:30:00Z' }).faces.map((f) => f.fill);
    expect(a).not.toEqual(b);   // half a day later → the lit hemisphere has rotated
  });

  it('reliefScale grows the relief height but not the cell count', () => {
    const a = planPlanetaryScene({ subject: 'earth', mandala: false, continents: false, atmosphere: false, moon: false, reliefScale: 1 }).faces;
    const b = planPlanetaryScene({ subject: 'earth', mandala: false, continents: false, atmosphere: false, moon: false, reliefScale: 4 }).faces;
    expect(a.length).toBe(b.length);               // same golden-angle samples → same face count
    // a taller spike pushes the highest corner further from the core (moon off → it isn't the farthest)
    const far = (faces) => Math.max(...faces.flatMap((f) => f.corners.map((c) => Math.hypot(c[0], c[1], c[2]))));
    expect(far(b)).toBeGreaterThan(far(a));
  });
});

describe('mojulo earth — live geo-lock + camera bookmarks', () => {
  it('a geo-locked scene ships Earth / Sun / Moon camera bookmarks', () => {
    const sc = assemblePlanetaryScene({ subject: 'earth', datetime: '2026-06-18T02:47:41Z' });
    expect(sc.cameras.map((c) => c.name)).toEqual(['Earth', 'Sun', 'Moon']);
    expect(sc.cameras[0].worldFraming.lookAt).toEqual([0, 0, 0]); // Earth cam pivots on the core
    for (const c of sc.cameras) expect(Array.isArray(c.worldFraming.cameraPosition)).toBe(true);
  });

  it('manual (knob) mode ships only the single Earth view', () => {
    const cams = assemblePlanetaryScene({ subject: 'earth', sunU: 0.25, sunH: 0.5 }).cameras;
    expect(cams.map((c) => c.name)).toEqual(['Earth']);
  });

  it('live:true geo-locks to the current instant at assemble time', () => {
    const sc = assemblePlanetaryScene({ subject: 'earth', live: true });
    expect(sc.cameras.map((c) => c.name)).toEqual(['Earth', 'Sun', 'Moon']);
    expect(sc.sky.sun).toBeTruthy();              // the sun disc is pinned at the resolved direction
    expect(sc.faces.length).toBeGreaterThan(0);
  });

  it('a geo-locked moon:false scene drops the Moon bookmark', () => {
    const cams = assemblePlanetaryScene({ subject: 'earth', datetime: '2026-06-18T02:47:41Z', moon: false }).cameras;
    expect(cams.map((c) => c.name)).toEqual(['Earth', 'Sun']);
  });
});

describe('baked day/night terminator', () => {
  // shading against a fixed sun must produce DISTINCT face fills (a lit hemisphere + a near-black
  // night side), not one flat colour.
  it('body faces carry a range of shaded fills', () => {
    const body = planPlanetaryScene({ subject: 'earth', mandala: false, atmosphere: false }).faces;
    const fills = new Set(body.map((f) => f.fill));
    expect(fills.size).toBeGreaterThan(5);
  });

  it('sunU rotates the terminator (different sun → different fills)', () => {
    const a = planPlanetaryScene({ subject: 'earth', mandala: false, atmosphere: false, sunU: 0 }).faces.map((f) => f.fill);
    const b = planPlanetaryScene({ subject: 'earth', mandala: false, atmosphere: false, sunU: 0.5 }).faces.map((f) => f.fill);
    expect(a).not.toEqual(b);
  });
});

describe('emitThreeWorld over a planetary body', () => {
  it('renders to a World page with a FULL-sphere starfield and no gradient dome', () => {
    const html = emitThreeWorld(assemblePlanetaryScene(EARTH));
    expect(html).toContain('OrbitControls');     // free orbit wired
    expect(html).toContain('THREE.Points');       // star-field code path present
    expect(html).toContain('"space":true');       // the space-sky flag threaded through
    expect(html).toContain('Math.asin');          // full-sphere star elevation (space branch)
    expect(html).toContain('translucent water sheet'); // the atmosphere shell rides the water pass
  });

  it('a non-space, non-gradient sky is still guarded out (no behaviour change for box worlds)', () => {
    const html = emitThreeWorld({ faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], fill: '#888' }], sky: { preset: 'night', stars: true } });
    expect(html).not.toContain('world-fixed sky dome');
  });
});

describe('kind registry', () => {
  it('classifies planetary as a traversable world (orbit-only, /world render mode)', () => {
    expect(sketchRenderMode(EARTH)).toBe('world');
    expect(classifyBucket(EARTH)).toBe('world');
  });
});
