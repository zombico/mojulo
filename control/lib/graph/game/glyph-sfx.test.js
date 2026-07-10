import { describe, expect, it } from 'vitest';

import {
  SFX_VERBS, SFX_VERB_IDS, composeGlyphSfx, resolveSfxLayers,
} from './glyph-sfx.js';
import { getSfxVocabCatalog, listSfxVocab } from './sfx-cards/loader.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

describe('glyph-sfx — the SFX verb shelf (game-ui-language U4)', () => {
  it('ships all 11 verbs with complete metadata', () => {
    expect(SFX_VERB_IDS).toHaveLength(11);
    expect(SFX_VERB_IDS).toEqual([
      'enchant', 'heal', 'charge', 'hit', 'accumulate', 'ward', 'sparkle', 'drain', 'aura', 'ssj-aura', 'kokusen',
    ]);
    for (const id of SFX_VERB_IDS) {
      const v = SFX_VERBS[id];
      expect(v.summary).toBeTruthy();
      expect(v.when).toBeTruthy();
      expect(['bead', 'field', 'extinction']).toContain(v.mechanism);
      expect(v.steps).toBeGreaterThanOrEqual(64);
      expect(v.defaults.color).toHaveLength(3);
      expect(typeof v.glsl(v.defaults)).toBe('string');
    }
  });

  describe('composeGlyphSfx', () => {
    it('returns null on no valid layers', () => {
      expect(composeGlyphSfx([])).toBeNull();
      expect(composeGlyphSfx([{ verb: 'nope', at: [0, 0, 0] }])).toBeNull();
      expect(composeGlyphSfx([{ verb: 'sparkle' }])).toBeNull();        // no anchor
    });

    it('composes one volSample summing every valid layer, with the gain-knee', () => {
      const c = composeGlyphSfx([
        { verb: 'sparkle', at: [0, 0, 0] },
        { verb: 'aura', at: [3, 0, 0] },
      ]);
      expect(c.globals).toContain('void volSample(vec3 p_');
      expect(c.globals).toContain('emis = emis / (1.0 + emis)');   // soft-knee present
      expect(c.globals.match(/vec3 cc = /g)).toHaveLength(2);       // one anchor block per layer
    });

    it('takes the max march-step floor across verbs (kokusen forces 240)', () => {
      expect(composeGlyphSfx([{ verb: 'sparkle', at: [0, 0, 0] }]).maxSteps).toBe(80);
      expect(composeGlyphSfx([{ verb: 'sparkle', at: [0, 0, 0] }, { verb: 'kokusen', at: [1, 0, 0] }]).maxSteps).toBe(240);
    });

    it('round-trips a color override and param into the GLSL', () => {
      const c = composeGlyphSfx([{ verb: 'enchant', at: [0, 0, 0], color: [0.1, 0.2, 0.3], params: { gain: 12 } }]);
      expect(c.globals).toContain('vec3(0.100, 0.200, 0.300)');     // color reached the shader
      expect(c.globals).toContain('12.000');                        // gain override reached it
    });

    it('formats a squared/small constant at high precision (no div-by-zero)', () => {
      const c = composeGlyphSfx([{ verb: 'kokusen', at: [0, 0, 0], params: { width: 0.022 } }]);
      expect(c.globals).not.toContain('/ 0.000)');                  // width² would round to 0.000 at f3
      expect(c.globals).toContain('0.000484');                      // 0.022² at f6
    });

    it('bakes the anchor into the GLSL (static, no per-frame uniform)', () => {
      const c = composeGlyphSfx([{ verb: 'aura', at: [3.5, -1.25, 0.5] }]);
      expect(c.globals).toContain('vec3(3.500000, -1.250000, 0.500000)');
    });
  });

  describe('resolveSfxLayers', () => {
    const entities = [{ id: 'boss', transform: { pos: [4, 2, 0] } }];
    it('resolves an `on` id to the entity transform.pos', () => {
      const out = resolveSfxLayers([{ verb: 'ward', on: 'boss' }], entities);
      expect(out).toEqual([{ verb: 'ward', at: [4, 2, 0], color: undefined, rate: undefined, params: undefined }]);
    });
    it('keeps an explicit `at` and drops unknown verbs / unresolvable anchors', () => {
      const out = resolveSfxLayers([
        { verb: 'sparkle', at: [1, 1, 1] },
        { verb: 'sparkle', on: 'ghost' },    // unknown entity → dropped
        { verb: 'nope', at: [0, 0, 0] },     // unknown verb → dropped
      ], entities);
      expect(out).toHaveLength(1);
      expect(out[0].at).toEqual([1, 1, 1]);
    });
  });
});

describe('sfx-cards — generated vocabulary', () => {
  it('generates one card per verb, keyed sfx-<verb>', () => {
    const catalog = getSfxVocabCatalog();
    expect([...catalog.keys()].sort()).toEqual(SFX_VERB_IDS.map((v) => `sfx-${v}`).sort());
    for (const card of catalog.values()) {
      expect(card.name).toMatch(/^SFX: /);
      expect(card.summary).toBeTruthy();
      expect(card.body).toContain('Mechanism');
      expect(card.body).toContain('"sfx"');    // manifest usage shape
    }
  });
  it('index rows carry routing fields only', () => {
    for (const row of listSfxVocab()) {
      expect(Object.keys(row).sort()).toEqual(['id', 'name', 'summary', 'when']);
    }
  });
});

describe('resolveWorldScene — manifest.sfx → payload.spriteSfx (§V geometry backend)', () => {
  const sketch = (manifest) => ({ manifest, title: null });
  it('resolves an sfx channel into sprite layers (not a raymarch overlay)', async () => {
    const { payload } = await resolveWorldScene(sketch({
      kind: 'planetary',
      sfx: [{ verb: 'sparkle', at: [0, 0, 0] }, { verb: 'ward', at: [3, 0, 0], color: [1, 0.5, 0] }],
    }));
    expect(payload.spriteSfx).toHaveLength(2);
    expect(payload.spriteSfx[0]).toMatchObject({ verb: 'sparkle', cc: [0, 0, 0] });
    expect(payload.spriteSfx[1]).toMatchObject({ verb: 'ward', cc: [3, 0, 0], color: [1, 0.5, 0] });
    expect(payload.effects).toBeUndefined();   // no raymarch overlay for game sfx anymore
  });
  it('drops deferred verbs (kokusen absorbs light → no additive equivalent)', async () => {
    const { payload } = await resolveWorldScene(sketch({
      kind: 'planetary',
      sfx: [{ verb: 'kokusen', at: [0, 0, 0] }],
    }));
    expect(payload.spriteSfx).toBeUndefined();   // only deferred verb → nothing resolves
  });
  it('leaves payload untouched when no sfx channel', async () => {
    const { payload } = await resolveWorldScene(sketch({ kind: 'planetary' }));
    expect(payload.spriteSfx).toBeUndefined();
    expect(payload.effects).toBeUndefined();
  });
});
