// the sweep over every camera style on the baseline scene: the coverage read through the frame read (shoot/frame.js)
// on the actors loses no one and cuts off no head (a styled one reads clean), and raises none of the notes the style
// answers by design
import { describe, it, expect } from 'vitest';
import { CAMERA_STYLES } from './camera-styles.js';
import { coverScene } from './coverage.js';
import { actScene } from './scene.js';
import { BASELINE } from './baseline.js';
import { directorsNotes } from './notes.js';
import { sceneFrameRead } from './frame-read.js';

const S = actScene(BASELINE.blocked);
describe('camera styles, swept', () => {
  it('every style keeps its subjects in frame with their heads on, a styled one reads clean, and none raises its quiet notes', () => {
    const misses = [];
    for (const c of CAMERA_STYLES) {
      const C = coverScene(S, { style: c.id });
      const notes = sceneFrameRead(S, C).notes.filter((n) => c.id !== 'classical' || n.code === 'lost' || n.code === 'head-cut');
      if (notes.length) misses.push(`${c.id}: ${notes.map((n) => `${n.code} in '${n.shot}'`).join(', ')}`);
      const quiet = directorsNotes(S, C).filter((n) => c.quiet.includes(n.id));
      if (quiet.length) misses.push(`${c.id}: raised ${quiet.map((n) => n.id).join(', ')}`);
    }
    expect(misses).toEqual([]);
  });
});
