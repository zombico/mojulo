import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildStandaloneStore, validateConceptCard } from './store-concept.js';
import { assessStoreConcept } from './store-assess.js';
import { SEEDED_CARDS } from './store-cards.js';
import { validateStoreManifest } from './store-world.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';
import { buildMall } from '../polygonizer/floorplan-mall.js';
import { validateSketchManifest } from '../sketch/sketch-manifest.js';

const SIZE = { department: { width: 40, depth: 60 }, 'wine-bar': { width: 26, depth: 44 } };
const size = (id) => SIZE[id] || { width: 24, depth: 40 };
const card = (id) => structuredClone(SEEDED_CARDS[id]);
const hash = (faces) => createHash('sha256').update(JSON.stringify(faces)).digest('hex').slice(0, 16);
const inv = (r) => r.findings.filter((f) => f.severity === 'invariant').map((f) => f.id);
// the mannequin is ~35k faces per figure: the behavioural tests use the cast-free cards
const light = Object.keys(SEEDED_CARDS).filter((id) => !(SEEDED_CARDS[id].cast || []).length);

describe('concept cards are data', () => {
  it('every seeded card round-trips through JSON and validates', () => {
    for (const [id, c] of Object.entries(SEEDED_CARDS)) {
      expect(JSON.parse(JSON.stringify(c)), id).toEqual(c);
      expect(validateConceptCard(c), id).toEqual([]);
    }
  });
  const bad = {
    'unknown-fixture': (c) => { c.fixtures.push({ archetype: 'jacuzzi', zone: 'browse', at: 0.5 }); },
    'unknown-cell': (c) => { c.cells.push({ archetype: 'ballroom' }); },
    'unknown-fixture-zone': (c) => { c.fixtures[0].zone = 'mezzanine'; },
    'overlapping-zones': (c) => { c.zones[1].depth = [0.1, 0.7]; },
    'run-out-of-range': (c) => { c.fixtures.find((f) => f.run).run = [0.4, 1.3]; },
    'gradient-inverted': (c) => { c.zones = [{ role: 'service', depth: [0, 0.3] }, { role: 'browse', depth: [0.3, 1] }]; c.fixtures = []; },
    'bad-palette': (c) => { c.palette.merch = []; },
    'unknown-size': (c) => { c.fixtures.push({ archetype: 'tableSet', zone: 'browse', at: 0.5, size: 'banquet' }); },
  };
  for (const [code, mut] of Object.entries(bad)) {
    it(`the validator names ${code}`, () => {
      const c = card('apparel'); mut(c);
      expect(validateConceptCard(c).map((e) => e.code)).toContain(code);
    });
  }
});

describe('the interpreter', () => {
  for (const id of light) {
    it(`${id}: deterministic, cells tile the unit, doors off the glass, zero invariant findings`, () => {
      const a = buildStandaloneStore(card(id), { ...size(id), seed: 3 });
      expect(hash(a.faces)).toBe(hash(buildStandaloneStore(card(id), { ...size(id), seed: 3 }).faces));
      const { width, depth } = size(id);
      expect(a.sub.rooms.reduce((s, r) => s + r.w * r.h, 0)).toBeCloseTo(width * depth, 6);
      for (const c of a.sub.cells) expect(c.door.world[1]).toBeGreaterThan(depth * 0.5);
      expect(inv(assessStoreConcept(card(id), a))).toEqual([]);
      expect(a.fitOut.report.degraded).toEqual([]);   // a card that fits is untouched
    });
  }
  it('an absent cast channel contributes zero bytes', () => {
    const c = card('apparel');
    expect(hash(buildStandaloneStore(c, { seed: 5 }).faces)).toBe(hash(buildStandaloneStore({ ...c, cast: [] }, { seed: 5 }).faces));
  });
});

describe('the assessor and the degrade pass', () => {
  const planted = {
    'entry-decompression': ['apparel', (c) => { c.fixtures.push({ archetype: 'podium', zone: 'window', at: 0.5, depth: 0.9 }); }],
    'aisle-to-service': ['bookstore', (c) => { c.fixtures.push({ archetype: 'gondola', zone: 'browse', run: [0.02, 0.98], depth: 0.5 }); }],
    'cashwrap-sightline': ['apparel', (c) => { c.fixtures.push({ archetype: 'gondola', zone: 'service', run: [0.55, 0.75], depth: 0.05 }); }],
    'fixture-overlap': ['apparel', (c) => { c.fixtures.push({ archetype: 'podium', zone: 'window', at: 0.18 }); }],
    'pierces-glass': ['apparel', (c) => { c.fixtures.push({ archetype: 'rackRun', zone: 'window', run: [0.02, 0.3], depth: 0.0 }); }],
    'exposure-gradient': ['apparel', (c) => { c.zones = [{ role: 'window', depth: [0, 0.16] }, { role: 'service', depth: [0.16, 0.4] }, { role: 'browse', depth: [0.4, 1] }]; }],
    'cashwrap-missing': ['homewares', (c) => { c.fixtures = c.fixtures.filter((f) => f.archetype !== 'counter'); }],
  };
  for (const [id, [base, mut]] of Object.entries(planted)) {
    it(`${id} fires on the raw fit-out${id === 'exposure-gradient' || id === 'cashwrap-missing' ? '' : ' and degrade repairs it, stamped'}`, () => {
      const c = card(base); mut(c);
      expect(inv(assessStoreConcept(c, buildStandaloneStore(c, { ...size(base), degrade: false })))).toContain(id);
      if (id === 'exposure-gradient' || id === 'cashwrap-missing') return;   // authoring errors: not the placer's to fix
      const s = buildStandaloneStore(c, size(base));
      expect(inv(assessStoreConcept(c, s))).toEqual([]);
      expect(s.fitOut.report.degraded.length).toBeGreaterThan(0);
    });
  }
  it('a fitting room doored onto the storefront fires', () => {
    const c = card('apparel');
    const s = buildStandaloneStore(c, size('apparel'));
    const fr = s.sub.cells.find((q) => q.archetype === 'fittingRoom');
    fr.door = { ...fr.door, world: [fr.door.world[0], 0.1] };
    expect(inv(assessStoreConcept(c, s))).toContain('cell-door-on-glass');
  });
  it('downsizes a table before shedding it', () => {
    const c = card('cafe');
    c.fixtures.push({ archetype: 'tableSet', zone: 'service', at: 0.3, depth: 0.6 });
    expect(buildStandaloneStore(c, size('cafe')).fitOut.report.degraded.map((x) => x.action)).toContain('downsize');
  });
});

describe('the mall fits its bays from cards', () => {
  it('every tenant, food and anchor bay; zero invariant findings; the anchors keep a through-aisle', () => {
    const m = buildMall({}, {});
    expect(m.bays.filter((b) => b.card.id === 'department').length).toBe(2);
    expect(m.bays.length).toBeGreaterThan(10);
    for (const b of m.bays) expect(inv(assessStoreConcept(b.card, b.store)), `${b.index}:${b.card.id}`).toEqual([]);
    const raw = buildMall({}, { cards: { department: 'department' }, degrade: false });
    for (const b of raw.bays.filter((q) => q.card.id === 'department')) expect(inv(assessStoreConcept(b.card, b.store))).toContain('aisle-through');
  });
  it('cards: false leaves the bays bare; an override replaces one bay', () => {
    expect(buildMall({}, { cards: false }).bays).toEqual([]);
    const m = buildMall({}, { cards: { cafe: 'wine-bar' } });
    expect(m.bays.some((b) => b.card.id === 'wine-bar')).toBe(true);
    expect(m.bays.some((b) => b.card.id === 'cafe')).toBe(false);
  });
});

describe('the store and mall world kinds', () => {
  it('store resolves a seeded card and stamps the assessment', () => {
    const scene = WORLD_KINDS.store.resolve({ kind: 'store', title: 'Books', card: 'bookstore' }, {});
    expect(scene.faces.length).toBeGreaterThan(1000);
    expect(scene.walk).toBeTruthy();
    expect(scene.store.card).toBe('bookstore');
    expect(scene.store.assessment.findings.every((f) => f.register === 'retail')).toBe(true);
  });
  it('store refuses a malformed card with the validator\'s named error', () => {
    expect(validateStoreManifest({ kind: 'store', card: 'bodega' })[0]).toMatch(/unknown card 'bodega'/);
    const c = card('cafe'); c.fixtures.push({ archetype: 'jacuzzi', zone: 'browse', at: 0.5 });
    expect(() => WORLD_KINDS.store.resolve({ kind: 'store', card: c }, {})).toThrow(/unknown-fixture/);
  });
  it('create_sketch\'s shape arm admits store / mall and names what is missing', () => {
    expect(validateSketchManifest({ kind: 'store', title: 'S', card: 'cafe' }).ok).toBe(true);
    expect(validateSketchManifest({ kind: 'mall', title: 'M' }).ok).toBe(true);
    expect(validateSketchManifest({ kind: 'store', title: 'S' }).errors[0]).toMatch(/needs a card/);
    expect(validateSketchManifest({ kind: 'mall', title: 'M', cards: ['cafe'] }).ok).toBe(false);
  });
  it('mall resolves with a concourse walk and the per-bay stamps', () => {
    const scene = WORLD_KINDS.mall.resolve({ kind: 'mall', title: 'Arcade' }, {});
    expect(scene.walk.spawn.length).toBe(2);
    expect(scene.mall.bays.length).toBeGreaterThan(10);
  });
});
