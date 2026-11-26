// A FRAME'S WAKE (frame-wake.js): the plasma's light a booster leaves, in its propellant's colour (parts.js PROPELLANTS),
// lasting longer and straight in vacuum, curling and shorter in air; and a page without a frame carries none of it.
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { frameWakeScript, WAKE } from './frame-wake.js';
import { frameFigure } from '../../../assault-frame/figure.js';
import { PARTS, PROPELLANTS, STOCK } from '../../../assault-frame/parts.js';
import { FLAME_LAYERS } from './frame-flame.js';

describe('a frame\'s wake', () => {
  it('is its booster\'s propellant\'s colour, on the plume and the wake both', () => {
    // (two stock frames whose boosters burn different gases, picked from the table)
    const [a, b] = Object.keys(STOCK).filter((k, i, all) => all.findIndex((x) => PARTS.booster[STOCK[x].booster].propellant === PARTS.booster[STOCK[k].booster].propellant) === i).slice(0, 2);
    const A = frameFigure({ build: a }), B = frameFigure({ build: b });
    expect(A.wake.colour).toBe(PROPELLANTS[PARTS.booster[STOCK[a].booster].propellant].colour);
    expect(A.wake.colour).not.toBe(B.wake.colour);
    expect(A.thrusters.every((t) => t.color === A.wake.colour)).toBe(true);
    // (no fire: the plume's tail takes the propellant's colour, not an amber of its own)
    expect(FLAME_LAYERS.tail.hot).toBe(null);
  });

  it('lasts longer and runs straight in vacuum; curls and fades sooner in air', () => {
    const air = frameWakeScript({ air: true }), space = frameWakeScript({ air: false });
    expect(air).toContain(`"life":${WAKE.life.air}`);
    expect(space).toContain(`"life":${WAKE.life.space}`);
    expect(WAKE.life.space).toBeGreaterThan(WAKE.life.air);
    expect(space).toContain('"air":false');
    // (the page's block is one script that parses)
    expect(() => new Function('THREE', 'scene', 'camera', '__world', '__bodies', 'window', space)).not.toThrow();
  });

  it('runs on the page through a boost, a climb and a quick boost, the ribbon held and a ring shed, and never stops the world', async () => {
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 5000);
    camera.position.set(0, -30, 12); camera.lookAt(0, 0, 8);
    // (a body with two main bells on its rig, as frame-flame.js makes them: a holder at each mouth, its exhaust down its y)
    const group = new THREE.Group(), jets = [-1, 1].map((sx) => { const loc = new THREE.Object3D(); loc.position.set(sx, -1, 6); group.add(loc); const holder = new THREE.Object3D(); loc.add(holder); return { kind: 'flame', main: true, holder, rad: 0.4 }; });
    group.userData.rigFig = { jets, fig: { wake: { colour: '#a47cff' } }, thrustAmt: 0 };
    scene.add(group);
    const P = { id: 'p', transform: { pos: [0, 0, 0], heading: 0 }, qbT: 0 };
    const __world = { time: 0, entities: [P] }, __bodies = { p: group }, win = {}, warned = [];
    const run = new Function('THREE', 'scene', 'camera', '__world', '__bodies', 'window', 'console', `${frameWakeScript({ air: true })}\nreturn __updateWake;`)(THREE, scene, camera, __world, __bodies, win, { warn: (...a) => warned.push(a) });
    const step = (n, f) => { for (let i = 0; i < n; i++) { __world.time += 1 / 30; f(i); group.position.set(...P.transform.pos); group.updateMatrixWorld(true); run(1 / 30); } };
    // (still: nothing; boosted along x, then climbing, then a quick boost sideways)
    step(10, () => {});
    group.userData.rigFig.thrustAmt = 0.8;
    step(30, () => { P.transform.pos[0] += 1.5; });
    step(30, () => { P.transform.pos[2] += 1; });
    P.qbT = 0.2; P.qbDir = [0, 1];
    step(6, () => { P.transform.pos[1] += 4; });
    expect(warned).toEqual([]);
    const T = win.__mojWake.trails.get('p');
    expect(T.jets.every((J) => J.s.length > 5)).toBe(true);
    expect(win.__mojWake.rings.filter((r) => r.m.visible)).toHaveLength(1);
    expect([...T.g.attributes.position.array].every(Number.isFinite)).toBe(true);
    // (the burn stopped: the wake drains away and is gone)
    group.userData.rigFig.thrustAmt = 0; P.qbT = 0;
    step(40, () => {});
    expect(T.m.visible).toBe(false);
  });
});
