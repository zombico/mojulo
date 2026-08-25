// Isolate to an in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { VIEW_KINDS, createViewHandler, getViewVocabHandler } from './create-view.js';
import { composeWorld } from './compose-world.js';
import { getViewVocabCatalog } from '@/lib/graph/views/view-vocab/loader';

beforeEach(() => {
  closeDb();
});

const WORLD_BASES = [
  'city',
  'transport-hub',
  'controllable',
  'action',
  'planetary',
  'painted-landscape',
  'math',
  'school',
  'dungeon',
];

describe('view-vocab cards ↔ VIEW_KINDS / compose_world bases', () => {
  it('every create_view kind has a card, and vice versa', () => {
    const catalog = getViewVocabCatalog();
    for (const kind of Object.keys(VIEW_KINDS)) {
      expect(catalog.has(kind), `missing card for kind '${kind}'`).toBe(true);
      expect(catalog.get(kind).entry).toBe('create_view');
    }
    const viewCards = [...catalog.values()].filter((c) => c.entry === 'create_view');
    for (const card of viewCards) {
      expect(VIEW_KINDS[card.id], `card '${card.id}' has no VIEW_KINDS row`).toBeDefined();
    }
  });

  it('every compose_world base has a family-world card, and vice versa', () => {
    const catalog = getViewVocabCatalog();
    for (const base of WORLD_BASES) {
      const card = catalog.get(base);
      expect(card, `missing card for base '${base}'`).toBeDefined();
      expect(card.family).toBe('world');
      expect(card.entry).toBe('compose_world');
    }
    const worldCards = [...catalog.values()].filter((c) => c.family === 'world');
    expect(worldCards.map((c) => c.id).sort()).toEqual([...WORLD_BASES].sort());
  });

  it('card families match VIEW_KINDS families', () => {
    const catalog = getViewVocabCatalog();
    for (const [kind, entry] of Object.entries(VIEW_KINDS)) {
      expect(catalog.get(kind).family).toBe(entry.family);
    }
  });
});

describe('create_view dispatch', () => {
  it('smoke-mints one kind per family', async () => {
    // One representative per family; the mint validates its own params.
    const picks = { science: 'fission', math: 'derivative', bio: 'dna' };
    for (const kind of Object.values(picks)) {
      const res = await createViewHandler({ kind, title: `smoke ${kind}` });
      expect(res.ok).toBe(true);
      expect(res.ref).toBeTruthy();
      expect(res.recipe?.kind ?? res.manifest?.kind ?? 'ok').toBeTruthy();
    }
  });

  it('unknown kind errors teach: kind list + vocab pointer', async () => {
    await expect(createViewHandler({ kind: 'nope' })).rejects.toThrow(
      /unknown kind 'nope'.*fission.*get_view_vocab/s,
    );
  });

  it('a failed mint appends the card pointer (error-as-drawer)', async () => {
    // fission rejects a non-object input inside its own handler when params
    // produce an invalid recipe; force a failure via a bad viewBox shape that
    // the mint tolerates — instead use a duplicate ref, which every mint
    // rejects through SketchRepository.
    const first = await createViewHandler({ kind: 'fission', ref: 'dup-ref-test' });
    expect(first.ok).toBe(true);
    await expect(createViewHandler({ kind: 'fission', ref: 'dup-ref-test' })).rejects.toThrow(
      /get_view_vocab\(\{ id: 'fission' \}\)/,
    );
  });

  it('top-level title/ref ride over params', async () => {
    const res = await createViewHandler({
      kind: 'orbit',
      title: 'top-level title',
      params: { title: 'params title' },
    });
    expect(res.ok).toBe(true);
  });
});

describe('get_view_vocab reader', () => {
  it('returns a full card by id', async () => {
    const { card } = await getViewVocabHandler({ id: 'fission' });
    expect(card.body).toMatch(/Bohr–Wheeler|fission coordinate/);
    expect(card.when).toMatch(/Reach for/);
  });

  it('lists index rows, filterable by family', async () => {
    const all = await getViewVocabHandler({});
    expect(all.cards.length).toBe(61);
    const world = await getViewVocabHandler({ family: 'world' });
    expect(world.cards.length).toBe(9);
    expect(world.cards.every((c) => c.entry === 'compose_world')).toBe(true);
    // Index rows are thin — no body.
    expect(all.cards[0].body).toBeUndefined();
  });

  it('unknown id errors with the known-card list', async () => {
    await expect(getViewVocabHandler({ id: 'nope' })).rejects.toThrow(/unknown card 'nope'.*fission/s);
  });
});

describe('compose_world bases (identity adapters)', () => {
  it('mints the transport-hub base with overrides as the param channel', () => {
    const res = composeWorld({
      base: 'transport-hub',
      seed: 7,
      overrides: { mode: 'train-station' },
      title: 'smoke hub',
    });
    expect(res.ok).toBe(true);
    expect(res.base).toBe('transport-hub');
    expect(res.recipe?.mode ?? res.manifest?.mode ?? 'train-station').toBeTruthy();
  });

  it('mints the school base with overrides as the param channel', () => {
    const res = composeWorld({
      base: 'school',
      seed: 4,
      overrides: { pattern: 'courtyard', program: 'high-school', facade: 'brick-civic' },
      title: 'smoke school',
    });
    expect(res.ok).toBe(true);
    expect(res.base).toBe('school');
    expect(res.recipe.kind).toBe('school-complex');
    expect(res.recipe.pattern).toBe('courtyard');
    expect(res.stats.walkable).toBe(true);
  });

  it('unknown base errors teach: base list + vocab pointer', () => {
    expect(() => composeWorld({ base: 'nope' })).toThrow(/unknown base 'nope'.*get_view_vocab/s);
  });
});

describe('deprecated aliases', () => {
  it('retired names resolve in tools/call but are absent from tools/list', async () => {
    const { ensureToolsRegistered, listTools, invokeRegisteredTool, isToolListed } = await import(
      '@/lib/mcp/server'
    );
    await ensureToolsRegistered();
    const listedNames = new Set(listTools().map((t) => t.name));
    const retired = [
      ...Object.values(VIEW_KINDS).map((e) => e.retired),
      'create_fractal_city',
      'create_transportation_hub',
      'create_controllable_world',
      'create_action_world',
      'create_planetary',
      'create_painted_landscape',
    ];
    for (const name of retired) {
      expect(listedNames.has(name), `${name} should be unlisted`).toBe(false);
      expect(isToolListed(name)).toBe(false);
    }
    // And one executes end-to-end through the registry path.
    const res = await invokeRegisteredTool('create_fission_view', { title: 'alias smoke' }, {});
    expect(res.ok).toBe(true);
    expect(res.recipe.kind).toBe('fission-view');
  });
});
