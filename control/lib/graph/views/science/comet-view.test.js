import { describe, expect, it } from 'vitest';

import { planCometScene, assembleCometScene, COMET_SCENARIOS } from './comet-view.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

const CLASSIC = { kind: 'comet-view', scenario: 'classic' };

describe('planCometScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical planets and comet path', () => {
    const a = planCometScene(CLASSIC), b = planCometScene(CLASSIC);
    expect(JSON.stringify(a.planets)).toBe(JSON.stringify(b.planets));
    expect(JSON.stringify(a.comets[0].path)).toBe(JSON.stringify(b.comets[0].path));
  });

  it('emits a pickable self-luminous Sun planet and one comet carrying ion + dust tail payloads', () => {
    const plan = planCometScene(CLASSIC);
    const sun = plan.planets.find((p) => p.group === 'sun');
    expect(sun).toBeTruthy();
    expect(sun.star).toBe(true);
    expect(sun.center).toEqual([0, 0, 0]);
    expect(plan.picks.map((p) => p.name)).toEqual(['sun']);
    expect(plan.comets.length).toBe(1);
    const cm = plan.comets[0];
    expect(cm.ion.count).toBeGreaterThan(0);
    expect(cm.dust.count).toBeGreaterThan(0);
    expect(cm.dist.length).toBe(cm.path.length);
    expect(cm.speed.length).toBe(cm.path.length);
  });

  it('tails:false drops both tails but keeps the comet on its orbit', () => {
    const cm = planCometScene({ ...CLASSIC, tails: false }).comets[0];
    expect(cm.ion.count).toBe(0);
    expect(cm.dust.count).toBe(0);
    expect(cm.path.length).toBeGreaterThan(2);
  });

  it('falls back to classic on an unknown scenario', () => {
    expect(planCometScene({ kind: 'comet-view', scenario: 'oumuamua' }).stats.scenario).toBe('classic');
  });
});

describe('planCometScene — accurate motion', () => {
  it("Kepler's 2nd law — fastest at perihelion (min r), slowest at aphelion", () => {
    const cm = planCometScene(CLASSIC).comets[0];
    const iMin = cm.dist.indexOf(Math.min(...cm.dist));   // perihelion sample
    const iMax = cm.dist.indexOf(Math.max(...cm.dist));   // aphelion sample
    expect(cm.speed[iMin]).toBeGreaterThan(cm.speed[iMax] * 3);   // e=0.9 → a big speed swing
  });

  it('higher eccentricity → a longer, more elongated orbit (sungrazer > classic)', () => {
    const span = (s) => { const p = planCometScene({ kind: 'comet-view', scenario: s }).comets[0]; return p.rAphe / p.rPeri; };
    expect(span('sungrazer')).toBeGreaterThan(span('classic'));
  });

  it('Halley-type reports a real multi-decade period', () => {
    expect(planCometScene({ kind: 'comet-view', scenario: 'halley' }).stats.period).toMatch(/yr$/);
  });

  it('orbit path is a closed loop (seamless period — first ≈ last sample)', () => {
    const cm = planCometScene(CLASSIC).comets[0];
    const a = cm.path[0], b = cm.path[cm.path.length - 1];
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-9);
  });

  it('the Sun sits at the focus, near the perihelion end (not the orbit centre)', () => {
    const cm = planCometScene(CLASSIC).comets[0];
    const peri = Math.min(...cm.path.map((p) => Math.hypot(p[0], p[1])));
    expect(Math.abs(peri - cm.rPeri)).toBeLessThan(1e-6);   // perihelion distance from Sun == rPeri
  });
});

describe('assembleCometScene — World framing', () => {
  it('frames path-first with a closeup second, glow off, and threads the comet channel', () => {
    const scene = assembleCometScene(CLASSIC, {});
    expect(scene.glow).toBe(false);
    expect(scene.cameras.map((c) => c.name)).toEqual(['path', 'closeup']);
    expect(scene.comets.length).toBe(1);
  });

  it('emits the comet channel into the World HTML when a comet is present', () => {
    const html = emitThreeWorld({ ...assembleCometScene(CLASSIC, {}), inline: true });
    expect(html).toContain('stepComets =');
    expect(html).toContain('away from Sun');
  });

  it('a World with no comets leaves stepComets inert (no channel block)', () => {
    const html = emitThreeWorld({ faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], fill: '#888' }] });
    expect(html).toContain('let stepComets = () => {};');
    expect(html).not.toContain('const COMETS =');
  });
});

describe('comet-view registration', () => {
  it('routes to the world renderer and the object concern bucket', () => {
    const m = { kind: 'comet-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('object');
  });

  it('exposes the three comet primitives', () => {
    expect(COMET_SCENARIOS).toEqual(['classic', 'halley', 'sungrazer']);
  });
});
