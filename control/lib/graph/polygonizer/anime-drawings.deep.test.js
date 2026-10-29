// The 7G drawings' deep sweep (anime-drawings.js on anime-form.js `drawing`): every drawing of the catalog (on the default
// head, in its form, and on the head before it), and every
// word at both ends of its range, built on the default anime hero's head: the topology kept, only its layer moved, no
// face turned over.
import { describe, it } from 'vitest';
import { DRAWINGS, DRAWING_RANGES } from './anime-drawings.js';
import { checkDrawing, studio } from './anime-drawings.fixture.js';

const LAYER_OF = { brow: 'brows', lid: 'lids', gaze: 'gaze', pupil: 'gaze', mouth: 'mouth' };

describe('the 7G drawings, swept', () => {
  it('every drawing of the catalog', () => {
    for (const [name, D] of Object.entries(DRAWINGS)) if (D.words) checkDrawing(name, D.layer, D.words);
  });
  it('every drawing of the catalog on the head before its form (a row stamped hero laws 18)', () => {
    for (const [name, D] of Object.entries(DRAWINGS)) if (D.words) studio.checkDrawing(`laws 18 ${name}`, D.layer, D.words);
  });
  it('every word at both ends of its range', () => {
    for (const [k, R] of Object.entries(DRAWING_RANGES)) {
      const ends = Array.isArray(R) ? R.map((v) => [`${k} ${v}`, { [k]: v }]) : Object.entries(R).flatMap(([q, [lo, hi]]) => [lo, hi].map((v) => [`${k}.${q} ${v}`, { [k]: { [q]: v } }]));
      // (an end at the word's neutral draws nothing: 0, the shut lips' opening included)
      for (const [label, words] of ends) if (!/ 0$/.test(label)) checkDrawing(label, LAYER_OF[k], words);
    }
  });
}, 600000);
