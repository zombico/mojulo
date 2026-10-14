/**
 * A game's cover, swept: every format at its aspect, and every archetype in every format with its title, tagline,
 * studio and menu zone inside the canvas and apart.
 */
import { describe, it, expect } from 'vitest';
import { normalizeCoverManifest } from './cover-manifest.js';
import { layoutCover, GAME_FORMATS, GAME_FORMAT_IDS, COVER_DEFAULTS_BY_KIND } from './cover-archetypes.js';

const inside = (r, c) => r.x >= 0 && r.y >= 0 && r.x + r.w <= c.w && r.y + r.h <= c.h && r.w > 0 && r.h > 0;
const apart = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
const game = (format, archetype) => normalizeCoverManifest({ for_kind: 'game', format, artDirection: { composition: { archetype } }, slots: { title: { text: 'Lantern Keep', realizer: 'flat' } } });

describe('a game cover, every format and archetype', () => {
  it('each format at its aspect', () => {
    for (const f of GAME_FORMAT_IDS) {
      const { canvas } = game(f), [aw, ah] = GAME_FORMATS[f].aspect;
      expect(Math.abs(canvas.w / canvas.h - aw / ah), f).toBeLessThan(0.01);
    }
  });
  it('every archetype in every format: its zones inside the canvas, none overlapping', () => {
    for (const a of COVER_DEFAULTS_BY_KIND.game.archetypes) for (const f of GAME_FORMAT_IDS) {
      const m = game(f, a), L = layoutCover(m), at = `${a} · ${f}`;
      expect(L.archetype, at).toBe(a);
      const zones = [L.titleZone, L.subtextRegions.tagline, L.metadataRegions.studio, L.menuZone];
      for (const z of zones) expect(inside(z, m.canvas), at).toBe(true);
      for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) expect(apart(zones[i], zones[j]), `${at}: ${i} and ${j}`).toBe(true);
    }
  });
});
