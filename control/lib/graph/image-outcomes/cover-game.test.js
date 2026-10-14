/**
 * A game's cover: four formats at their aspects, three archetypes whose regions sit inside the canvas and apart, a
 * menu zone a title screen draws its menu in, and a book's cover exactly as it was.
 */
import { describe, it, expect } from 'vitest';
import { normalizeCoverManifest } from './cover-manifest.js';
import { layoutCover, GAME_FORMATS, GAME_FORMAT_IDS, COVER_DEFAULTS_BY_KIND, canvasFor } from './cover-archetypes.js';
import { renderCoverSvg } from './cover-preview.js';

const inside = (r, c) => r.x >= 0 && r.y >= 0 && r.x + r.w <= c.w && r.y + r.h <= c.h && r.w > 0 && r.h > 0;
const apart = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
const game = (format, archetype, extra = {}) => normalizeCoverManifest({
  for_kind: 'game', ...(format ? { format } : {}),
  artDirection: archetype ? { composition: { archetype } } : {},
  slots: { title: { text: 'Lantern Keep', realizer: 'flat' }, subtext: [{ role: 'tagline', text: 'The hill remembers' }], metadata: [{ kind: 'studio', value: 'Ombico Works' }] },
  ...extra,
});

describe('a game cover', () => {
  // every archetype in every format is swept in cover-game.deep.test.js
  it('is key art by default; a portrait format is portrait', () => {
    const m = game();
    expect(m.format).toBe('key-art');
    const [aw, ah] = GAME_FORMATS[m.format].aspect;
    expect(Math.abs(m.canvas.w / m.canvas.h - aw / ah)).toBeLessThan(0.01);
    const tall = GAME_FORMAT_IDS.find((f) => GAME_FORMATS[f].aspect[1] > GAME_FORMATS[f].aspect[0]);
    expect(game(tall).canvas.h).toBeGreaterThan(game(tall).canvas.w);
  });

  it('a game archetype places the title, tagline, studio and menu inside the canvas, none overlapping', () => {
    const m = game('key-art', COVER_DEFAULTS_BY_KIND.game.archetypes[0]), L = layoutCover(m);
    const zones = [L.titleZone, L.subtextRegions.tagline, L.metadataRegions.studio, L.menuZone];
    for (const z of zones) expect(inside(z, m.canvas)).toBe(true);
    for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) expect(apart(zones[i], zones[j])).toBe(true);
  });

  it('renders its tagline and studio, the title left-set where the archetype says', () => {
    const svg = renderCoverSvg(game('key-art', 'lower-third'));
    expect((svg.match(/<path /g) || []).length).toBeGreaterThanOrEqual(3);
    expect(renderCoverSvg(game('capsule', 'hero-side'))).toContain('<rect x="0" y="0" width="');
  });

  it('a format is a game\'s only, and a known one', () => {
    expect(() => normalizeCoverManifest({ for_kind: 'novel', format: 'box' })).toThrow(/game cover/);
    expect(() => normalizeCoverManifest({ for_kind: 'game', format: 'poster' })).toThrow(/key-art, capsule, box, icon/);
  });

  it('a book\'s cover is as it was: no format key, its own canvas', () => {
    const m = normalizeCoverManifest({ slots: { title: { text: 'A Novel' } } });
    expect('format' in m).toBe(false);
    expect(m.canvas).toEqual(canvasFor('novel'));
    expect(layoutCover(m).menuZone).toBeUndefined();
  });
});
