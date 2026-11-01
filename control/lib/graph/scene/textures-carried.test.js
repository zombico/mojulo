/**
 * Phase 3 of skin-over-mesh.plan.md: textures flip from an implicit gap to a
 * CARRIED line. The GLB already embeds them (facesToGlb reads
 * payload.textures); the score names the keys. Untextured worlds stay
 * byte-identical.
 */
import { describe, expect, it } from 'vitest';

import { extractEngineScore } from './engine-score.js';

const sketch = { ref: 'sk_tex', manifest: { kind: 'floorplan-world', title: 'tex world' } };
const PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('engine score — texture keys ride the score', () => {
  it('names the payload texture keys, sorted', () => {
    const score = extractEngineScore(sketch, { textures: { 'skin-atlas': PNG_URL, 'marble-carrara': PNG_URL } });
    expect(score.textures).toEqual(['marble-carrara', 'skin-atlas']);
  });

  it('untextured payloads carry no key — byte-identical to pre-phase-3', () => {
    expect('textures' in extractEngineScore(sketch, {})).toBe(false);
    expect('textures' in extractEngineScore(sketch, { textures: {} })).toBe(false);
  });
});
