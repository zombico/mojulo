import { describe, expect, it } from 'vitest';

import { GLYPH_FORMS, GLYPH_IDS, glyphFormFaces, lowerGlyphBodies } from './glyph-forms.js';
import { getGlyphVocabCatalog, listGlyphVocab } from './glyph-cards/loader.js';

describe('glyph-forms — the form shelf (game-ui-language U1)', () => {
  it('ships the eight forms with complete metadata', () => {
    expect(GLYPH_IDS).toEqual(['gem', 'coin', 'key', 'heart', 'star', 'orb', 'flag', 'skull']);
    for (const id of GLYPH_IDS) {
      const row = GLYPH_FORMS[id];
      expect(row.name).toBeTruthy();
      expect(row.summary).toBeTruthy();
      expect(row.when).toBeTruthy();
      expect(row.tint).toMatch(/^#[0-9a-f]{6}$/i);
      expect(['radial', 'radial-5', 'radial-6', 'bilateral']).toContain(row.symmetry);
      expect(['bob', 'spin-bob']).toContain(row.idle);
      expect(row.fit.height).toBeGreaterThan(0);
      expect(row.fit.cz).toBeGreaterThan(0);
    }
  });

  it('builds every form deterministically, icon-grade, base at z=0', () => {
    for (const id of GLYPH_IDS) {
      const a = glyphFormFaces(id);
      const b = glyphFormFaces(id);
      expect(a.length).toBeGreaterThan(0);
      expect(a.length).toBeLessThan(1000);           // icon-grade budget
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));   // deterministic
      let minZ = Infinity, maxZ = -Infinity;
      for (const f of a) for (const [, , z] of f.corners) { if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
      expect(minZ).toBeGreaterThanOrEqual(-1e-9);    // base at (or above) the ground plane
      expect(maxZ).toBeCloseTo(GLYPH_FORMS[id].fit.height, 1);
    }
  });

  it('applies tint and scale as params', () => {
    const plain = glyphFormFaces('gem');
    const tinted = glyphFormFaces('gem', { tint: '#ff00ff' });
    expect(JSON.stringify(tinted)).not.toBe(JSON.stringify(plain));
    const doubled = glyphFormFaces('gem', { scale: 2 });
    expect(doubled[0].corners[0][2]).toBeCloseTo(plain[0].corners[0][2] * 2, 9);
  });

  it('teaches on an unknown form', () => {
    expect(() => glyphFormFaces('sword')).toThrow(/unknown form 'sword'.*gem.*skull.*get_game_vocab/s);
  });

  describe('lowerGlyphBodies', () => {
    const glyphEntity = { id: 'p1', transform: { pos: [4, 0, 0] }, body: { type: 'glyph', form: 'gem' } };
    const meshEntity = { id: 'p2', transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box' } };

    it('returns null when no entity carries a glyph body (byte-identity guard)', () => {
      expect(lowerGlyphBodies([meshEntity], {})).toBeNull();
      expect(lowerGlyphBodies([], {})).toBeNull();
      expect(lowerGlyphBodies(null, {})).toBeNull();
    });

    it('rewrites glyph bodies to single-frame figure-frames and registers the clip', () => {
      const out = lowerGlyphBodies([glyphEntity, meshEntity], {});
      expect(out.entities[0].body).toEqual({ type: 'figure-frames', figure: 'glyph:gem', lerp: false, yawOffset: 0 });
      expect(out.entities[1]).toBe(meshEntity);                       // non-glyph untouched
      expect(out.figures['glyph:gem']).toHaveLength(1);                     // one static frame
      expect(out.figures['glyph:gem'][0].faces.length).toBeGreaterThan(0);  // { faces } frame shape (packFigureFrames contract)
    });

    it('shares one clip across identical (form, tint, scale) and splits variants', () => {
      const e = (id, body) => ({ id, transform: { pos: [0, 0, 0] }, body });
      const out = lowerGlyphBodies([
        e('a', { type: 'glyph', form: 'coin' }),
        e('b', { type: 'glyph', form: 'coin' }),
        e('c', { type: 'glyph', form: 'coin', tint: '#ffffff', scale: 2 }),
      ], {});
      expect(Object.keys(out.figures).sort()).toEqual(['glyph:coin', 'glyph:coin:#ffffff:s2']);
      expect(out.entities[0].body.figure).toBe('glyph:coin');
      expect(out.entities[1].body.figure).toBe('glyph:coin');
      expect(out.entities[2].body.figure).toBe('glyph:coin:#ffffff:s2');
    });

    it('preserves pre-existing figures and an explicit yawOffset', () => {
      const prior = { hero: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#fff' }] };
      const out = lowerGlyphBodies([{ ...glyphEntity, body: { type: 'glyph', form: 'flag', yawOffset: 1.5 } }], prior);
      expect(out.figures.hero).toBe(prior.hero);
      expect(out.entities[0].body.yawOffset).toBe(1.5);
    });
  });
});

describe('glyph-cards — generated vocabulary', () => {
  it('generates one card per form, keyed glyph-<form>', () => {
    const catalog = getGlyphVocabCatalog();
    expect([...catalog.keys()]).toEqual(GLYPH_IDS.map((id) => `glyph-${id}`));
    for (const card of catalog.values()) {
      expect(card.name).toMatch(/^Glyph: /);
      expect(card.summary).toBeTruthy();
      expect(card.when).toBeTruthy();
      expect(card.body).toContain('"type": "glyph"');
      expect(card.body).toContain('figure-frames');
      expect(card.body).toContain('symmetry');
    }
  });

  it('index rows carry routing fields only', () => {
    for (const row of listGlyphVocab()) {
      expect(Object.keys(row).sort()).toEqual(['id', 'name', 'summary', 'when']);
    }
  });
});
