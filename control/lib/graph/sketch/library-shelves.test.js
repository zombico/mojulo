import { describe, it, expect } from 'vitest';

import {
  LIBRARY_SHELVES,
  CHARACTER_KINDS,
  shelfByKey,
  shelfFetchBucket,
  inLibrary,
  onShelf,
  filterToShelf,
  shelfCountsFromTallies,
  SOLID_KINDS,
  VIEW_KINDS,
  LEGACY_ROUTE_SHELVES,
} from '@/lib/graph/sketch/library-shelves';

const s = (bucket, kind) => ({ ref: `sk_${bucket}_${kind || 'x'}`, bucket, manifest: { kind } });

const CORPUS = [
  s('world', 'fractal-city'),
  s('world', 'dungeon'),
  s('object', 'workbench'),
  s('object', 'atom-view'),
  s('illustration', 'painted-landscape'),
  s('illustration', 'css3d-turntable'),
  s('illustration', 'figure'),
  s('illustration', 'character-sheet'),
  s('diagram', undefined),
  s('beats', 'beats-ambient'),
  s('voice', 'voice-register'),
  s('game', 'game'),
];

describe('library shelves', () => {
  it('keeps heard / spoken / played artifacts out of the library entirely', () => {
    for (const bucket of ['beats', 'voice', 'game']) {
      expect(inLibrary(s(bucket, 'x'))).toBe(false);
    }
    for (const bucket of ['world', 'object', 'illustration', 'diagram']) {
      expect(inLibrary(s(bucket, 'x'))).toBe(true);
    }
  });

  it('maps each colloquial shelf onto the bucket it actually means', () => {
    expect(filterToShelf(CORPUS, 'scenes').map((x) => x.bucket)).toEqual(['world', 'world']);
    expect(filterToShelf(CORPUS, 'models').map((x) => x.manifest.kind)).toEqual(['workbench']);
    expect(filterToShelf(CORPUS, 'views').map((x) => x.manifest.kind)).toEqual(['atom-view']);
    expect(filterToShelf(CORPUS, 'turntables').map((x) => x.manifest.kind)).toEqual(['css3d-turntable']);
    expect(filterToShelf(CORPUS, 'diagrams').map((x) => x.bucket)).toEqual(['diagram']);
  });

  it('solids and views partition the object bucket; turntables leave images', () => {
    const object = CORPUS.filter((x) => x.bucket === 'object').length;
    expect(filterToShelf(CORPUS, 'models').length + filterToShelf(CORPUS, 'views').length).toBe(object);
    for (const k of SOLID_KINDS) expect(VIEW_KINDS).not.toContain(k);
    expect(VIEW_KINDS).toContain('atom-view');
    expect(filterToShelf(CORPUS, 'images').map((x) => x.manifest.kind)).not.toContain('css3d-turntable');
  });

  it('splits characters out of images so the two do not double-count', () => {
    const characters = filterToShelf(CORPUS, 'characters').map((x) => x.manifest.kind);
    const images = filterToShelf(CORPUS, 'images').map((x) => x.manifest.kind);
    expect(characters).toEqual(['figure', 'character-sheet']);
    expect(images).toEqual(['painted-landscape']);
    expect(images.some((k) => CHARACTER_KINDS.includes(k))).toBe(false);
  });

  // The bug this guards: an unscoped list is capped at rootLimit, so a Library
  // that fetched once and filtered in the browser would show ~200 of thousands
  // and hide the rest with no indication. Every typed shelf must name a bucket
  // so its request is the uncapped, bucket-scoped read.
  it('every typed shelf names the bucket it fetches; only `recent` is capped', () => {
    for (const shelf of LIBRARY_SHELVES) {
      if (shelf.registry) { expect(shelfFetchBucket(shelf.key)).toBeNull(); continue; }
      if (shelf.key === 'recent') { expect(shelf.capped).toBe(true); continue; }
      expect(shelfFetchBucket(shelf.key), shelf.key).toBeTruthy();
    }
    expect(shelfFetchBucket('characters')).toBe('illustration');
    expect(shelfFetchBucket('turntables')).toBe('illustration');
    expect(shelfFetchBucket('images')).toBe('illustration');
    expect(shelfFetchBucket('views')).toBe('object');
    expect(shelfFetchBucket('recent')).toBeNull();
  });

  it('`recent` holds the library-eligible page it was given, minus the other homes', () => {
    expect(filterToShelf(CORPUS, 'recent')).toHaveLength(9);
  });

  it('derives true shelf totals from whole-table tallies', () => {
    const counts = shelfCountsFromTallies({
      buckets: { world: 335, object: 1143, illustration: 413, diagram: 121, beats: 9 },
      kinds: {
        figure: 4, 'character-sheet': 2, 'sprite-sheet': 1, 'painted-landscape': 50,
        'css3d-turntable': 300, 'subway-station': 2, 'atom-view': 30, 'mechanics-view': 10,
        // the polygomer's 2D form: an illustration kind that must not be summed as a solid
        'manji-tree': 6,
      },
    });
    expect(counts).toEqual({
      scenes: 335, turntables: 302, models: 1103, views: 40, characters: 7, images: 104, diagrams: 121,
    });
    // the two splits must reconstruct their buckets exactly
    expect(counts.images + counts.characters + counts.turntables).toBe(413);
    expect(counts.models + counts.views).toBe(1143);
  });

  it('gives no count to `recent` or `materials` — a cap and a registry are not populations', () => {
    const counts = shelfCountsFromTallies({ buckets: { world: 1 }, kinds: {} });
    expect(counts.recent).toBeUndefined();
    expect(counts.materials).toBeUndefined();
  });

  it('tolerates empty tallies without emitting NaN into the chip row', () => {
    const counts = shelfCountsFromTallies();
    expect(Object.values(counts).every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
  });

  it('gives the registry shelf no rows — it is not backed by the sketch store', () => {
    expect(filterToShelf(CORPUS, 'materials')).toEqual([]);
    expect(shelfByKey('materials').registry).toBe(true);
    expect(onShelf(shelfByKey('materials'), s('world', 'fractal-city'))).toBe(false);
  });

  it('falls back to `recent` for an unknown or missing shelf key', () => {
    expect(shelfByKey('nonsense').key).toBe('recent');
    expect(shelfByKey(undefined).key).toBe('recent');
  });

  it('routes every folded index page to a shelf that exists', () => {
    const keys = new Set(LIBRARY_SHELVES.map((x) => x.key));
    for (const [route, shelf] of Object.entries(LEGACY_ROUTE_SHELVES)) {
      expect(keys.has(shelf), `${route} → ${shelf}`).toBe(true);
    }
  });
});
