// the sweep over every camera style on the baseline scene: the coverage read through the frame read (shoot/frame.js)
// on the actors loses no one and cuts off no head, and the notes it raises are none the style answers by design
import { describe, it, expect } from 'vitest';
import { CAMERA_STYLES } from './camera-styles.js';
import { coverScene, FIGURE } from './coverage.js';
import { actScene } from './scene.js';
import { BASELINE } from './baseline.js';
import { directorsNotes } from './notes.js';
import { normalizeShoot } from '../shoot/plan.js';
import { frameRead } from '../shoot/frame.js';

const S = actScene(BASELINE.blocked);
const subjects = new Map(Object.entries(S.actors).map(([w, A]) => [`actor:${w}`, { id: `actor:${w}`, kind: 'figure', box: { len: 0.4, wid: 0.4, hgt: FIGURE }, at: (t) => {
  const K = A.root; let k = 0;
  while (k + 1 < K.length && K[k + 1].t <= t) k++;
  const a = K[k], b = K[k + 1] ?? a, u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  return { pos: [a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 0], heading: ((90 - (a.yaw + (b.yaw - a.yaw) * u)) * Math.PI) / 180 };
} }]));

describe('camera styles, swept', () => {
  it('every style keeps its subjects in frame with their heads on, and raises none of its quiet notes', () => {
    const misses = [];
    for (const c of CAMERA_STYLES) {
      const C = coverScene(S, { style: c.id });
      const notes = frameRead(normalizeShoot(C, { subjects }).plan, { subjects }).notes.filter((n) => n.code === 'lost' || n.code === 'head-cut');
      if (notes.length) misses.push(`${c.id}: ${notes.map((n) => `${n.code} in '${n.shot}'`).join(', ')}`);
      const quiet = directorsNotes(S, C).filter((n) => c.quiet.includes(n.id));
      if (quiet.length) misses.push(`${c.id}: raised ${quiet.map((n) => n.id).join(', ')}`);
    }
    expect(misses).toEqual([]);
  });
});
