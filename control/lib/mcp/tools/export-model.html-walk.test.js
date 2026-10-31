// export_model format:html keeps the scene's own walk: its spawn, eye and speed, not the defaults off its bounds.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';

import { htmlWalk } from './sketch-model-export.js';

describe('the exported page\'s walk', () => {
  it('is the scene\'s own when it tunes one, else on for a walk kind and off for another', () => {
    const W = { speed: 6, spawn: [13, 2.5, 1.5], minEye: 1.7 };
    expect(htmlWalk({ walk: W }, 'geocube')).toBe(W);
    expect(htmlWalk({ walk: true }, 'anything')).toBe(true);
    expect(htmlWalk({}, 'not-a-walk-kind')).toBe(false);
  });
});
