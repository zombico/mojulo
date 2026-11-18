// The cel body (world-scene.js heroFigure `cel`): a body's light, not its face's. The character light baked twice, every
// group stepped lit and every group in shade, each part carrying both tones on the same corners, so the page steps
// between them by the world's key. The concepts: the side scroller's own hero (the herobot rail's) in cel carries its
// shade tones on most of its parts, each differing from its lit tone on the same corners; without `cel` the body is as it
// was, one tone a corner.
import { describe, it, expect } from 'vitest';
import { heroFigure } from './world-scene.js';
import { gameBody } from '../gameworld/game-bodies.js';

const HERO = gameBody('herobot', 'hero').spec;

describe('the cel body', () => {
  it('the herobot in cel: most parts carry a shade tone on their own corners; without it, one tone', async () => {
    const [cel, baked] = await Promise.all([heroFigure('hero', { hero: HERO }, { cel: true }), heroFigure('hero', { hero: HERO })]);
    const parts = cel.parts.filter(Boolean), stepped = parts.filter((p) => p.colS);
    expect(cel.toon).toBe(true);
    expect(stepped.length).toBeGreaterThan(parts.length * 0.8);
    for (const p of stepped) { expect(p.colS).not.toBe(p.col); expect(Buffer.from(p.colS, 'base64').length).toBe(Buffer.from(p.col, 'base64').length); }
    expect(baked.toon).toBeUndefined();
    expect(baked.parts.some((p) => p && p.colS)).toBe(false);
  }, 120000);
});
