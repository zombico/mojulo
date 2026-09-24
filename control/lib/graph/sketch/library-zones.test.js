import { describe, it, expect } from 'vitest';

import {
  LIBRARY_ZONES,
  STRIP_LIMITS,
  STRIP_SHELVES,
  zoneCounts,
  titleStem,
  characterStem,
  collapseStems,
  stripFaces,
  castGroups,
  facetKeyFor,
  facetCounts,
} from '@/lib/graph/sketch/library-zones';
import { LIBRARY_SHELVES } from '@/lib/graph/sketch/library-shelves';

// The floor is a lens over the shelf model, so the two must agree by
// construction: every zone shelf is a real shelf, every shelf with a home on
// the floor has exactly one zone.
describe('library zones — the floor agrees with the shelf model', () => {
  const shelfKeys = new Set(LIBRARY_SHELVES.map((s) => s.key));

  it('every zone shelf is a real library shelf', () => {
    for (const zone of LIBRARY_ZONES) {
      for (const key of zone.shelves) expect(shelfKeys.has(key)).toBe(true);
    }
  });

  it('no shelf sits in two zones', () => {
    const seen = new Set();
    for (const zone of LIBRARY_ZONES) {
      for (const key of zone.shelves) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it('strip shelves are the zone shelves that carry a limit, in zone order', () => {
    expect(STRIP_SHELVES).toEqual(['scenes', 'turntables', 'models', 'views', 'characters', 'images', 'diagrams']);
    for (const key of STRIP_SHELVES) expect(STRIP_LIMITS[key]).toBeGreaterThan(0);
  });

  it('zone counts are sums of shelf counts; materials contributes nothing', () => {
    const counts = { scenes: 335, turntables: 300, models: 1103, views: 40, characters: 71, images: 64, diagrams: 121 };
    expect(zoneCounts(counts)).toEqual({ d3: 1849, d2: 185 });
    expect(zoneCounts({})).toEqual({ d3: 0, d2: 0 });
  });
});

describe('titleStem — conservative iteration folding', () => {
  it('folds bare trailing numbers and vN tokens', () => {
    expect(titleStem('city 1')).toBe('city');
    expect(titleStem('city 2')).toBe('city');
    expect(titleStem('Humanoid-Face full assembly v10')).toBe('humanoid face full assembly');
    expect(titleStem('Green Battle Wizard - Wave-Drape V7')).toBe('green battle wizard wave drape');
  });

  it('folds at a vN token anywhere — chains annotate past the version', () => {
    expect(titleStem('Humanoid-Face full assembly v10 - first form')).toBe('humanoid face full assembly');
    expect(titleStem('Humanoid-Face full assembly v9 - slimmer waist')).toBe('humanoid face full assembly');
  });

  it('bare mid-title numbers do NOT fold — only trailing ones do', () => {
    expect(titleStem('apollo 11 landing')).toBe('apollo 11 landing');
    expect(titleStem('tram night 7')).toBe('tram night');
  });

  it('drops trailing parenthetical annotation', () => {
    expect(titleStem('Wizard — dream-reconstruction (attested)')).toBe('wizard dream reconstruction');
    expect(titleStem('QA orphan-fix check (disposable)')).toBe('qa orphan fix check');
  });

  it('identical titles meet trivially', () => {
    expect(titleStem('Wizard Sprite Sheet')).toBe(titleStem('Wizard Sprite Sheet'));
  });

  it('does NOT fold when the tail is a real word', () => {
    // "tram night 7 dense" is a variation, not an iteration of "tram night 7" —
    // the conservative rule leaves it a solo card.
    expect(titleStem('tram night 7 dense')).not.toBe(titleStem('tram night 7'));
  });

  it('never folds a title to nothing', () => {
    expect(titleStem('7')).toBe('7');
    expect(titleStem('v2')).toBe('v2');
    expect(titleStem('')).toBe('');
    expect(titleStem(null)).toBe('');
  });
});

describe('collapseStems / stripFaces', () => {
  const row = (ref, title) => ({ ref, title });

  it('keeps the newest sibling as the face and counts the window', () => {
    const rows = [row('c3', 'city 3'), row('a', 'alpha'), row('c2', 'city 2'), row('c1', 'city 1')];
    const faces = collapseStems(rows);
    expect(faces.map((f) => f.ref)).toEqual(['c3', 'a']);
    expect(faces[0].stack).toBe(3);
    expect(faces[1].stack).toBe(1);
    // The rooms' filmstrip: siblings include the face, newest first.
    expect(faces[0].siblings.map((s) => s.ref)).toEqual(['c3', 'c2', 'c1']);
  });

  it('rows without titles fall back to ref — always a solo card', () => {
    const faces = collapseStems([{ ref: 'x' }, { ref: 'y' }]);
    expect(faces).toHaveLength(2);
    expect(faces.every((f) => f.stack === 1)).toBe(true);
  });

  it('stripFaces caps at the shelf limit after folding', () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(`r${i}`, `solo thing ${'abcdefghijklmnopqrst'[i]}`));
    expect(stripFaces(rows, 'scenes')).toHaveLength(STRIP_LIMITS.scenes);
  });
});

describe('characterStem — the name before the spaced separator', () => {
  it('takes the lead segment and iteration-folds it', () => {
    expect(characterStem('Green Battle Wizard - Hooded Cape Study')).toBe('green battle wizard');
    expect(characterStem('Milla — first walk cycle (artist-painted)')).toBe('milla');
    expect(characterStem('Sprocket — hero preview P0c (stocky mascot)')).toBe('sprocket');
  });

  it('keeps hyphenated names whole — the separator must be spaced', () => {
    expect(characterStem('Humanoid-Face full assembly v10')).toBe('humanoid face full assembly');
  });
});

describe('castGroups — one card per character', () => {
  it('folds kinds into a kit under one face', () => {
    const rows = [
      { ref: 'w1', title: 'Green Battle Wizard - Hooded Cape Study', manifest: { kind: 'figure' } },
      { ref: 'w2', title: 'Green Battle Wizard - Tailor Sheet Validation', kind: 'character-sheet' },
      { ref: 's1', title: 'Wizard Sprite Sheet', kind: 'sprite-sheet' },
      { ref: 'w3', title: 'Green Battle Wizard - Garment Integration V1', kind: 'figure' },
      { ref: 'm1', title: 'Milla — first walk cycle (artist-painted)', kind: 'figure' },
    ];
    const groups = castGroups(rows);
    const wizard = groups.find((g) => g.ref === 'w1');
    expect(wizard).toBeTruthy();
    expect(wizard.stack).toBe(3);
    expect(wizard.kit).toEqual({ figure: 2, 'character-sheet': 1 });
    const milla = groups.find((g) => g.ref === 'm1');
    expect(milla.kit).toEqual({ figure: 1 });
    expect(wizard.siblings.map((s) => s.ref)).toEqual(['w1', 'w2', 'w3']);
  });
});

describe('room facets', () => {
  it('maps kinds to their facet, with the rest facet as the honest tail', () => {
    expect(facetKeyFor('scenes', 'controllable')).toBe('walkable');
    expect(facetKeyFor('scenes', 'transportation-hub')).toBe('hubs');
    expect(facetKeyFor('scenes', 'not-a-kind')).toBe(null);   // scenes has no rest facet
    expect(facetKeyFor('models', 'workbench')).toBe('workbench');
    expect(facetKeyFor('models', 'atom-view')).toBe('science');
    expect(facetKeyFor('images', 'image-outcome')).toBe('painted');
    expect(facetKeyFor('diagrams', 'anything')).toBe(null);   // no facets defined
  });

  it('tallies facets over mixed row shapes', () => {
    const rows = [
      { kind: 'workbench' },
      { manifest: { kind: 'workbench' } },
      { kind: 'manji-tree' },
      { kind: 'hydro-view' },
    ];
    expect(facetCounts('models', rows)).toEqual({ workbench: 2, manji: 1, science: 1 });
  });
});
