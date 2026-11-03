// a scene's coverage: the scenes card's framings, the cuts a director makes, one side of the line, a shoot plan's shape
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FRAMES, frameShot, coverScene } from './coverage.js';
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
