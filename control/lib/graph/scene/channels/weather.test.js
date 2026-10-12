import { describe, it, expect } from 'vitest';
import { weatherScript, weatherStates, weatherForces } from './weather.js';
import { emitThreeWorld } from '../scene-three.js';
import { readWeather, fallCount } from '../../weather/weather.js';

const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#445566' };
const W = readWeather({ climate: { clear: 1, rain: 2, snow: 1 }, dwell: [10, 20], blend: 5 });

// a THREE stub: enough to run the page's code in node and read back what it did to the scene
function rig(cfg, extra = []) {
  class Color {
    constructor(r = 1, g, b) { if (typeof r === 'string') { const n = /^#[0-9a-f]{6}$/i.test(r) ? [1, 3, 5].map((i) => parseInt(r.slice(i, i + 2), 16) / 255) : [0.6, 0.6, 0.6]; [this.r, this.g, this.b] = n; } else { this.r = r; this.g = g ?? r; this.b = b ?? r; } this.isColor = true; }
    clone() { return new Color(this.r, this.g, this.b); } copy(c) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
    setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
    lerp(c, u) { this.r += (c.r - this.r) * u; this.g += (c.g - this.g) * u; this.b += (c.b - this.b) * u; return this; }
  }
  class Obj { constructor() { this.visible = true; this.renderOrder = 0; this.position = { set() {} }; this.scale = { setScalar() {} }; this.matrix = {}; } updateMatrix() {} }
  class Geo { constructor() { this.attributes = {}; this.range = null; } setAttribute(k, a) { this.attributes[k] = a; } setDrawRange(a, b) { this.range = [a, b]; } }
  class Inst extends Obj { constructor() { super(); this.count = 0; this.instanceMatrix = {}; this.setColorAt = () => {}; this.setMatrixAt = () => {}; this.instanceColor = {}; } }
  const THREE = {
    Color, FogExp2: class { constructor(c, d) { this.color = c; this.density = d; } }, BufferGeometry: Geo, BufferAttribute: class { constructor(a) { this.array = a; } },
    LineBasicMaterial: class {}, PointsMaterial: class {}, MeshBasicMaterial: class {}, LineSegments: class extends Obj { constructor(g) { super(); this.geometry = g; } }, Points: class extends Obj { constructor(g) { super(); this.geometry = g; } },
    InstancedMesh: Inst, RingGeometry: class {}, CircleGeometry: class {}, Object3D: class extends Obj {}, AdditiveBlending: 2,
    Vector3: class {}, ShaderChunk: { fog_fragment: 'float fogFactor = 1.0;\n\tgl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );' },
  };
  const added = [], scene = { fog: new THREE.FogExp2(new Color(0.6), 0.02), background: new Color(0.6), add: (o) => added.push(o), traverse: (f) => scene.extra.concat(added).forEach(f), extra };
  const camera = { position: { x: 3, y: 4, z: 2 } };
  const ov = { style: {} };
  const win = { __mojGlyphs: { soft: { tex: 1 }, leaf: { tex: 1 }, flake: { tex: 1 }, dot: { tex: 1 } }, __mojClock: 0 };
  const step = new Function('THREE', 'scene', 'camera', 'document', 'window', 'performance', weatherScript(cfg) + '\nreturn (t) => stepWeather(t);')(THREE, scene, camera, { createElement: () => ov, body: { appendChild() {} } }, win, { now: () => 0 });
  const at = (sec) => { win.__mojClock = sec * 1000; step(sec * 1000); };
  return { scene, ov, win, added, at, THREE };
}

describe('weather channel', () => {
  it('absent weather ⇒ not a byte; present ⇒ the channel and its probe', () => {
    const base = emitThreeWorld({ faces: [face] });
    expect(base).not.toContain('window.__mojWeather');
    const html = emitThreeWorld({ faces: [face], weather: { weather: W, seed: 5 } });
    expect(html).toContain('window.__mojWeather');
    expect(html.length).toBeGreaterThan(base.length);
  });

  it('a camera capture pins the clock for it, and the page\'s own step drives it (no loop of its own)', () => {
    const w = { weather: W, seed: 5 }, f = { faces: [face] };
    expect(emitThreeWorld({ ...f, weather: w, capture: true })).toContain('window.__mojClock = Number.isFinite(spec.t)');
    expect(emitThreeWorld({ ...f, capture: true })).not.toContain('window.__mojClock = Number.isFinite(spec.t)');
    const html = emitThreeWorld({ ...f, weather: w });
    expect(html).toContain('stepWeather(t);');
    expect(weatherScript({ weather: W, seed: 5 })).not.toContain('requestAnimationFrame');
  });

  it('the page runs, and its sky is the module\'s: the same seed at the same moment gives the same fog', () => {
    const a = rig({ weather: W, seed: 5, radius: 40 }), b = rig({ weather: W, seed: 5, radius: 40 });
    for (const t of [0, 7, 33, 90]) { a.at(t); b.at(t); expect(a.scene.fog.density).toBe(b.scene.fog.density); }
    const s = a.win.__mojWeather.at(33);
    a.at(33);
    expect(a.scene.fog.density).toBeCloseTo(0.02 * s.state.fog, 8);
  });

  it('a pool is one size however the weather moves, and states with a fall have one', () => {
    const r = rig({ weather: W, seed: 5, radius: 40 });
    const pools = r.added.filter((o) => o.geometry && o.geometry.attributes.position);
    const sizes = pools.map((p) => p.geometry.attributes.position.array.length);
    for (const t of [0, 40, 80, 120]) r.at(t);
    expect(pools.map((p) => p.geometry.attributes.position.array.length)).toEqual(sizes);
    expect(weatherStates(W).sort()).toEqual(['clear', 'rain', 'snow']);
    expect(fallCount({ rate: 0.5 })).toBeLessThanOrEqual(4000);
  });

  it('a storm takes light off the world and a flash lights it', () => {
    const S = readWeather({ climate: { thunderstorm: 1 }, start: 'thunderstorm', dwell: [600, 700], blend: 5 });
    const r = rig({ weather: S, seed: 3, radius: 40 });
    const opac = [];
    for (let t = 0; t < 120; t += 0.25) { r.at(t); opac.push([r.ov.style.background, +r.ov.style.opacity]); }
    expect(opac.some(([bg]) => bg === '#fff')).toBe(true);
    expect(opac.some(([bg, o]) => bg !== '#fff' && o === 1 && bg !== 'rgb(255,255,255)')).toBe(true);   // light off: a multiply colour
    expect(opac.every(([bg]) => bg !== '#000' && bg !== 'rgb(0,0,0)')).toBe(true);        // the style's shade, never black
  });
});

describe('weather forced by a cue', () => {
  const W2 = readWeather({ climate: { clear: 1 }, dwell: [600, 700], blend: 5 });
  it('the page reads the bus var: eases to the forced state, holds it, and eases back to the schedule', () => {
    const r = rig({ weather: W2, seed: 1, radius: 40, forces: ['blizzard'] });
    const vars = {}; r.win.__mojBus = { state: { vars } };
    const F = 'weather-force:cue:pass', B = 'weather-blend:cue:pass';
    r.at(10); const clearFog = r.scene.fog.density;
    vars[F] = 'blizzard'; vars[B] = 4;
    r.at(11); r.at(13);
    const mid = r.scene.fog.density;
    r.at(20);
    const held = r.scene.fog.density;
    expect(mid).toBeGreaterThan(clearFog); expect(held).toBeGreaterThan(mid);
    expect(held).toBeCloseTo(0.02 * 9, 6);                  // the blizzard's factor on the kit's own fog
    vars[F] = '';
    r.at(21); r.at(40);
    expect(r.scene.fog.density).toBeCloseTo(clearFog, 6);   // back on the schedule
  });
  it('a state a cue forces that the climate lacks still has its pool', () => {
    expect(weatherStates(W2, ['blizzard'])).toEqual(['clear', 'blizzard']);
    expect(weatherForces({ reactions: [{ do: 'set', var: 'weather-force:cue:a', to: 'fog' }, { do: 'set', var: 'weather-force:cue:a', to: '' }, { do: 'set', var: 'x', to: 'rain' }] })).toEqual(['fog']);
    expect(emitThreeWorld({ faces: [face], weather: { weather: W2, seed: 1 }, events: { reactions: [{ on: 'go', do: 'set', var: 'weather-force:go', to: 'blizzard' }] } })).toContain('"blizzard"');
  });
});

describe('weather in the style\'s air', () => {
  const AIRC = { hue: '#b4d8f0', density: 0.0015, shade: '#86aede', depth: 0.5, cast: 1, body: 'banded', steps: 4, skyFollow: 0.5, states: { duststorm: { hue: '#b79f77' } } };
  const DUST = readWeather({ climate: { duststorm: 1 }, start: 'duststorm', dwell: [600, 700], blend: 5 });
  it('a state takes the style\'s colour: a dust storm is the style\'s ochre, not a darker blue-grey', () => {
    const r = rig({ weather: DUST, seed: 2, radius: 40, air: AIRC });
    r.at(10);
    const c = r.scene.fog.color;
    expect(c.r).toBeGreaterThan(c.b);                                     // warm: ochre-ish, where the hue is a cold blue
    expect(r.ov.style.mixBlendMode).toBe('multiply');                      // the dimming is the style's shade, multiplied in
    const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(r.ov.style.background); expect(+m[1]).toBeGreaterThan(+m[3]);   // and takes the dust's warmth, not the sky's blue
  });
  it('a banded style quantises three\'s fog chunk once; a smooth one leaves it alone', () => {
    const b = rig({ weather: DUST, seed: 2, radius: 40, air: AIRC });
    expect(b.THREE.ShaderChunk.fog_fragment).toContain('floor(fogFactor * 4.0 + 0.5) / 4.0');
    const d = rig({ weather: DUST, seed: 2, radius: 40, air: { ...AIRC, body: 'dithered', steps: 3 } });
    expect(d.THREE.ShaderChunk.fog_fragment).toContain('gl_FragCoord');
    const s = rig({ weather: DUST, seed: 2, radius: 40, air: { ...AIRC, body: 'smooth' } });
    expect(s.THREE.ShaderChunk.fog_fragment).not.toContain('floor(');
  });
  it('shadows fade as the sky closes, and a card with no cast has none', () => {
    const mk = () => ({ isMesh: true, renderOrder: 0.5, material: { transparent: true, depthWrite: false, opacity: 0.6 }, geometry: { attributes: { position: { count: 6 } } } });
    const at = (state, air) => { const d = mk(), r = rig({ weather: readWeather({ climate: { [state]: 1 }, start: state, dwell: [600, 700], blend: 5 }), seed: 2, radius: 40, air }, [d]); r.at(10); return d.material.opacity; };
    expect(at('clear', AIRC)).toBeCloseTo(0.6, 5);                       // full sun: the style's own shadow
    expect(at('rain', AIRC)).toBeLessThan(0.2);                          // rain takes most of it
    expect(at('fog', AIRC)).toBeLessThan(at('overcast', AIRC));         // fog takes more than cloud
    expect(at('clear', { ...AIRC, cast: 0 })).toBe(0);
  });
  it('the sky gives way to the fog: a storm hides the dome, a card that does not follow leaves it', () => {
    const dome = () => ({ isMesh: true, renderOrder: -1, material: { color: {}, opacity: 1 }, geometry: { attributes: { color: {} } } });
    const run = (air) => { const d = dome(), r = rig({ weather: readWeather({ climate: { thunderstorm: 1 }, start: 'thunderstorm', dwell: [600, 700], blend: 5 }), seed: 2, radius: 40, air }, [d]); r.at(10); return d.material; };
    expect(run(AIRC).opacity).toBeLessThanOrEqual(0.5);                // a storm hides half the sky, as far as this style lets it
    expect(run(AIRC).opacity).toBeGreaterThan(0);
    expect(run(AIRC).transparent).toBe(true);
    expect(run({ ...AIRC, skyFollow: 0 }).opacity).toBe(1);
  });
});

describe('weather on a clock', () => {
  const W = readWeather({ climate: { clear: 1 } });
  it('a level with a clock darkens with the night; its seasons carry their climates\' states; without one, no clock code', () => {
    const plain = weatherScript({ weather: W, seed: 1 });
    expect(plain).not.toContain('night()');
    const night = weatherScript({ weather: W, seed: 1, clock: true });
    expect(night).toContain('const night = () =>');
    expect(night).not.toContain('seasonNow');
    const turned = weatherScript({ weather: W, seed: 1, clock: true, seasons: ['spring-blossom', 'temperate', 'autumn', 'alpine'].map((c) => readWeather(c)) });
    expect(turned).toContain('seasonNow();');
    expect(turned).toContain('"snow"');   // winter's states carried, though the level's own sky is clear
  });
});

describe('the pixel look', () => {
  it('draws the page small and blows it up unsmoothed; absent, the page\'s own resolution', () => {
    const plain = emitThreeWorld({ faces: [face] }), pix = emitThreeWorld({ faces: [face], pixel: { scale: 4 } });
    expect(plain).toContain('renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));');
    expect(plain).not.toContain('pixelated');
    expect(pix).toContain("renderer.setPixelRatio(1 / 4); canvas.style.imageRendering = 'pixelated';");
    expect(pix).toContain('antialias: false');
  });
});
