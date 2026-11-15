// a scene's coverage: the scenes card's framings, the cuts a director makes, one side of the line, a shoot plan's shape
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FRAMES, frameShot, coverScene, fitRoom, focalOf, WALL_OFF, SOLID_OFF, WIDEST } from './coverage.js';
import { actScene } from './scene.js';
import { BASELINE } from './baseline.js';
import { normalizeShoot } from '../shoot/plan.js';

const S = actScene(BASELINE.blocked), C = coverScene(S);

describe('the framings', () => {
  it('are the scenes card\'s own (rules-basic.js FRAMES)', () => {
    const src = readFileSync(new URL('../worlds/controllable/rules-basic.js', import.meta.url), 'utf8');
    const lit = /const FRAMES = (\{[^}]+\});/.exec(src)[1];
    expect(JSON.parse(lit.replace(/(\w+):/g, '"$1":'))).toEqual(JSON.parse(JSON.stringify(FRAMES)));
  });

  it('an over stands past the second\'s shoulder and looks at the first; a close stands before its subject', () => {
    const A = [0, 0, 0], B = [2, 0, 0], O = frameShot('over', [A, B]);
    expect(O.pos[0]).toBeGreaterThan(B[0]);
    expect(O.poi.slice(0, 2)).toEqual([0, 0]);
    const heading = Math.PI / 2, K = frameShot('close', [A], { heading });   // (facing +y)
    expect(K.pos[1]).toBeGreaterThan(0.5);
  });
});

describe('a scene\'s coverage', () => {
  it('is a shoot plan the shoot plan takes as it is, its shots one after another from start to end', () => {
    const N = normalizeShoot(C);
    expect(N.warnings).toEqual([]);
    expect(N.plan.shots).toHaveLength(C.shots.length);
    expect(C.shots[0].span[0]).toBe(0);
    expect(C.shots.at(-1).span[1]).toBe(S.seconds);
    for (let i = 1; i < C.shots.length; i++) expect(C.shots[i].span[0]).toBe(C.shots[i - 1].span[1]);
  });

  it('opens wide, goes wide for a cross, and closes on a line with a face of its own', () => {
    expect(C.shots[0].camera).toBe('wide');
    const [w] = S.actors.mara.walks, during = C.shots.find((s) => s.span[0] <= (w.start + w.end) / 2 && s.span[1] > (w.start + w.end) / 2);
    expect(during.camera).toBe('wide');
    for (const T of S.turns.filter((x) => x.face)) {
      const shot = C.shots.find((s) => s.span[0] <= (T.at + T.end) / 2 && s.span[1] > (T.at + T.end) / 2);
      expect(shot.camera).toBe(`close-${T.who}`);
    }
    expect(C.shots.some((s) => s.camera.startsWith('over-'))).toBe(true);
  });

  it('keeps every camera on one side of the actors\' line (the 180° rule)', () => {
    // (the line as it is at each key: an actor's place from its blocking, linearly between its keys)
    const at = (w, t) => { const K = S.actors[w].root; let p = K[0]; for (let k = 1; k < K.length; k++) if (t >= K[k - 1].t) p = t >= K[k].t ? K[k] : { x: K[k - 1].x + (K[k].x - K[k - 1].x) * ((t - K[k - 1].t) / (K[k].t - K[k - 1].t)), y: K[k - 1].y + (K[k].y - K[k - 1].y) * ((t - K[k - 1].t) / (K[k].t - K[k - 1].t)) }; return p; };
    const side = (t, p) => { const a = at('mara', t), b = at('jon', t); return Math.sign((b.x - a.x) * (p[1] - a.y) - (b.y - a.y) * (p[0] - a.x)); };
    const sides = new Set(C.cameras.flatMap((c) => c.keys.map((k) => side(k.t, k.pos))));
    expect(sides.size).toBe(1);
  });

  it('a camera a setup: the wide, an over and a close an actor at most', () => {
    expect(C.cameras.length).toBeLessThanOrEqual(1 + 2 * Object.keys(S.actors).length);
    expect(new Set(C.cameras.map((c) => c.id)).size).toBe(C.cameras.length);
  });
});

describe('a camera in a walled room', () => {
  const room = { min: [0, 0], max: [5, 4], walled: true };
  const wide = { pos: [2.5, -9, 3.6], poi: [2.5, 3, 1.4], fov: 50 };
  it('is brought inside the wall along its own line of sight, its lens opened to hold the framing', () => {
    const f = fitRoom(wide, [room]);
    expect(f.pos[0]).toBe(2.5);
    expect(f.pos[1]).toBeCloseTo(WALL_OFF, 3);
    expect(f.pos[2]).toBeLessThan(wide.pos[2]);
    expect(f.poi).toEqual(wide.poi);
    expect(f.fov).toBeGreaterThan(50);
    expect(f.fov).toBeLessThanOrEqual(WIDEST);
    expect(focalOf(f.fov)).toBeLessThan(focalOf(50));
  });
  it('stops before a tall piece on its line of sight', () => {
    const f = fitRoom(wide, [{ ...room, solids: [{ min: [2, 0], max: [3, 0.4] }] }]);
    expect(f.pos[1]).toBeCloseTo(0.4 + SOLID_OFF, 3);
    // (a piece off the line is no matter)
    expect(fitRoom(wide, [{ ...room, solids: [{ min: [4, 0], max: [5, 0.4] }] }]).pos[1]).toBeCloseTo(WALL_OFF, 3);
  });
  it('leaves a camera already inside, a room with no walls and a subject in no room as they were', () => {
    const inside = { pos: [2.5, 1, 1.6], poi: [2.5, 3, 1.4], fov: 50 };
    expect(fitRoom(inside, [room])).toBe(inside);
    expect(fitRoom(wide, [{ min: [0, 0], max: [5, 4] }])).toBe(wide);
    expect(fitRoom({ ...wide, poi: [9, 9, 1.4] }, [room])).toEqual({ ...wide, poi: [9, 9, 1.4] });
    expect(fitRoom(wide, null)).toBe(wide);
  });
  it('covers a scene from inside its room, and as it was with no rooms', () => {
    const S = actScene({ cast: { ada: { mark: 'a' }, jon: { mark: 'b' } }, marks: { a: [1.8, 3], b: [3.2, 3] }, script: 'ADA: You kept the key.\nJON (worried): I kept everything.' });
    const C = coverScene(S, { rooms: [room] });
    for (const cam of C.cameras) for (const k of cam.keys) {
      expect(k.pos[0]).toBeGreaterThanOrEqual(-1e-6); expect(k.pos[0]).toBeLessThanOrEqual(5 + 1e-6);
      expect(k.pos[1]).toBeGreaterThanOrEqual(-1e-6); expect(k.pos[1]).toBeLessThanOrEqual(4 + 1e-6);
    }
    expect(coverScene(S, { rooms: null })).toEqual(coverScene(S));
    expect(coverScene(S).cameras[0].keys[0].pos[1]).toBeLessThan(0);
  });
});
