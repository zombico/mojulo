import { describe, it, expect } from 'vitest';

import { scaffoldGameFromKit } from './kits.js';
import { validateGameManifest } from './game-manifest.js';
import { resolveGame } from './game-resolve.js';

// ── attribution: the optional, operator-owned default about/credits page ────────────────────────
// A game with a menu but no declared about entry resolves with a generated provenance page
// (identical served + exported, recipe untouched). Declaring an about entry replaces it
// wholesale; menu.attribution:false removes it; menu-less games are untouched.

const GEOM = {
  title: 'Attribution Crypt',
  levels: [{ ref: 'crypt-1', exit: [20, 0, 0] }],
};

function fixture(menu) {
  const out = scaffoldGameFromKit('dungeon-crawler', GEOM);
  const store = {};
  for (const ref of Object.keys(out.levelChannels)) {
    store[ref] = { manifest: { kind: 'controllable', entities: [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 2] } }], game: out.levelChannels[ref] } };
  }
  const manifest = { kind: 'game', title: GEOM.title, store: out.store, levels: out.gameLevels, ...(menu ? { menu } : {}) };
  return { manifest, resolve: () => resolveGame(manifest, (r) => store[r] || null, (r) => `/api/sketches/${r}/world`) };
}

describe('attribution default (menu.attribution)', () => {
  it('a menu with no about entry gets the generated credits page', () => {
    const { resolve } = fixture({ entries: [{ id: 'play', title: 'Play', kind: 'levels' }] });
    const about = resolve().menu.find((en) => en.kind === 'about');
    expect(about).toBeDefined();
    expect(about.id).toBe('mojulo-about');
    expect(about.body.join(' ')).toContain('Attribution Crypt');
    expect(about.body.join(' ')).toContain('1 level,');   // singular count folded into the copy
    expect(about.links.map((l) => l.href)).toEqual(expect.arrayContaining([
      'https://github.com/zombico/mojulo', 'https://www.npmjs.com/package/mojulo', 'https://mojulo.ai',
    ]));
    expect(typeof about.footer).toBe('string');
  });

  it('menu.attribution:false removes it', () => {
    const { manifest, resolve } = fixture({ attribution: false, entries: [{ id: 'play', title: 'Play', kind: 'levels' }] });
    expect(validateGameManifest(manifest).ok).toBe(true);
    expect(resolve().menu.some((en) => en.kind === 'about')).toBe(false);
  });

  it('a declared about entry replaces the default wholesale (even nested)', () => {
    const own = { id: 'about', title: 'About', kind: 'about', body: ['My own words.'] };
    const flat = fixture({ entries: [{ id: 'play', title: 'Play', kind: 'levels' }, own] }).resolve();
    expect(flat.menu.filter((en) => en.kind === 'about')).toHaveLength(1);
    expect(flat.menu.find((en) => en.kind === 'about').body).toEqual(['My own words.']);
    const nested = fixture({ entries: [{ id: 'play', title: 'Play', kind: 'levels' }, { id: 'more', title: 'More', kind: 'menu', entries: [own] }] }).resolve();
    expect(nested.menu.some((en) => en.kind === 'about')).toBe(false);   // no root injection beside the nested one
  });

  it('a menu-less game resolves untouched', () => {
    expect(fixture(null).resolve().menu).toBeNull();
  });

  it('menu.attribution must be a boolean', () => {
    const { manifest } = fixture({ attribution: 'no', entries: [{ id: 'play', title: 'Play', kind: 'levels' }] });
    const v = validateGameManifest(manifest);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toContain('menu.attribution');
  });
});
