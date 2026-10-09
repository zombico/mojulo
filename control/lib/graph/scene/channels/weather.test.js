import { describe, it, expect } from 'vitest';
import { weatherScript, weatherStates, weatherForces } from './weather.js';
import { emitThreeWorld } from '../scene-three.js';
import { readWeather, fallCount } from '../../weather/weather.js';

const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#445566' };
const W = readWeather({ climate: { clear: 1, rain: 2, snow: 1 }, dwell: [10, 20], blend: 5 });

// a THREE stub: enough to run the page's code in node and read back what it did to the scene
function rig(cfg) {
  class Color {
    constructor(r = 1, g, b) { if (typeof r === 'string') { this.r = this.g = this.b = 0.6; } else { this.r = r; this.g = g ?? r; this.b = b ?? r; } this.isColor = true; }
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
    Vector3: class {},
  };
  const added = [], scene = { fog: new THREE.FogExp2(new Color(0.6), 0.02), background: new Color(0.6), add: (o) => added.push(o), traverse() {} };
  const camera = { position: { x: 3, y: 4, z: 2 } };
  const ov = { style: {} }, frames = [];
  const win = { __mojGlyphs: { soft: { tex: 1 }, leaf: { tex: 1 }, flake: { tex: 1 }, dot: { tex: 1 } }, __mojClock: 0 };
  new Function('THREE', 'scene', 'camera', 'document', 'window', 'requestAnimationFrame', 'performance', weatherScript(cfg))(THREE, scene, camera, { createElement: () => ov, body: { appendChild() {} } }, win, (f) => frames.push(f), { now: () => 0 });
  const at = (sec) => { win.__mojClock = sec * 1000; frames.pop()(); };
  return { scene, ov, win, added, at };
}

describe('weather channel', () => {
  it('absent weather ⇒ not a byte; present ⇒ the channel and its probe', () => {
    const base = emitThreeWorld({ faces: [face] });
    expect(base).not.toContain('window.__mojWeather');
    const html = emitThreeWorld({ faces: [face], weather: { weather: W, seed: 5 } });
    expect(html).toContain('window.__mojWeather');
    expect(html.length).toBeGreaterThan(base.length);
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
    expect(opac.some(([bg, o]) => bg === '#000' && o > 0.3)).toBe(true);
  });
});

describe('weather forced by a cue', () => {
  const W2 = readWeather({ climate: { clear: 1 }, dwell: [600, 700], blend: 5 });
  it('the page reads the bus var: eases to the forced state, holds it, and eases back to the schedule', () => {
    const r = rig({ weather: W2, seed: 1, radius: 40, forces: ['blizzard'] });
    const vars = {}; r.win.__mojBus = { state: { vars } };
    r.at(10); const clearFog = r.scene.fog.density;
    vars['weather-force'] = 'blizzard'; vars['weather-blend'] = 4;
    r.at(11); r.at(13);
    const mid = r.scene.fog.density;
    r.at(20);
    const held = r.scene.fog.density;
    expect(mid).toBeGreaterThan(clearFog); expect(held).toBeGreaterThan(mid);
    expect(held).toBeCloseTo(0.02 * 9, 6);                  // the blizzard's factor on the kit's own fog
    vars['weather-force'] = '';
    r.at(21); r.at(40);
    expect(r.scene.fog.density).toBeCloseTo(clearFog, 6);   // back on the schedule
  });
  it('a state a cue forces that the climate lacks still has its pool', () => {
    expect(weatherStates(W2, ['blizzard'])).toEqual(['clear', 'blizzard']);
    expect(weatherForces({ reactions: [{ do: 'set', var: 'weather-force', to: 'fog' }, { do: 'set', var: 'weather-force', to: '' }, { do: 'set', var: 'x', to: 'rain' }] })).toEqual(['fog']);
    expect(emitThreeWorld({ faces: [face], weather: { weather: W2, seed: 1 }, events: { reactions: [{ on: 'go', do: 'set', var: 'weather-force', to: 'blizzard' }] } })).toContain('"blizzard"');
  });
});
