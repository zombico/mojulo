// The arthropod encyclopedia: every worked bug ships with its facts, the names people say are unique across the whole
// roster, every stand-in is built, and the generated cards stay small. Plans never read about.js, so facts change no
// plan's bytes (bugs.test.js pins the plans).
import { describe, it, expect } from 'vitest';
import { BUG_SPECIES } from './species.js';
import { about, wanted, ORDERS, CLASSES } from './about.js';
import { bugEntryCards, bugByName, speciesCard, ENTRY_BODY_CEILING, HUB_BODY_CEILING } from './entries.js';
import { SPECIES as FAUNA } from '../fauna/species.js';
import { getSolidVocabCatalog } from '../solid-vocab/loader.js';
import { getSolidVocabHandler } from '../../mcp/tools/mint-solid.js';

const ids = Object.keys(BUG_SPECIES);
// every name a search or a `species` value can land on, with who claims it
function claims() {
  const out = [];
  for (const [id, A] of Object.entries(about)) for (const n of [A.common, ...A.aliases]) out.push([n, id]);
  for (const [w, W] of Object.entries(wanted)) for (const n of [W.common, ...W.aliases]) out.push([n, `wanted:${w}`]);
  return out;
}

describe('the facts', () => {
  it('every worked bug has an about row, and every row is a worked bug', () => {
    expect(Object.keys(about).sort()).toEqual([...ids].sort());
    for (const [id, A] of Object.entries(about)) {
      for (const k of ['common', 'sci', 'size', 'source', 'read']) expect(typeof A[k] === 'string' && A[k].length > 2, `${id}.${k}`).toBe(true);
      expect(Array.isArray(A.aliases), `${id}.aliases`).toBe(true);
    }
  });

  it('every order has its everyday group and a class hub', () => {
    for (const id of ids) expect(CLASSES[ORDERS[BUG_SPECIES[id].order]?.cls], `${id} (${BUG_SPECIES[id].order})`).toBeTruthy();
  });

  it('names are lower case, unique across the roster (stand-ins included), and never another animal\'s id', () => {
    const seen = new Map(), otherIds = new Map([...ids, ...Object.keys(FAUNA)].map((i) => [i.toLowerCase(), i]));
    for (const [n, who] of claims()) {
      expect(n, `${who}: '${n}'`).toBe(n.toLowerCase());
      expect(seen.has(n), `'${n}' claimed by ${seen.get(n)} and ${who}`).toBe(false);
      seen.set(n, who);
      const other = otherIds.get(n);
      if (other) expect(other, `'${n}' (${who}) is the id of ${other}`).toBe(who);
    }
  });

  it('each generic word belongs to ONE species: the one most people picture', () => {
    const owner = Object.fromEntries(claims());
    const pictured = { bug: 'ladybird', insect: 'honeyBee', spider: 'gardenSpider', beetle: 'stagBeetle', crab: 'greenCrab', ant: 'carpenterAnt', bee: 'honeyBee', fly: 'houseFly', butterfly: 'monarch', lobster: 'lobster' };
    for (const [w, id] of Object.entries(pictured)) expect(owner[w], w).toBe(id);
  });

  it('every stand-in is a worked bug, and nothing wanted is already built', () => {
    for (const [w, W] of Object.entries(wanted)) {
      expect(BUG_SPECIES[W.near], `${w}.near '${W.near}'`).toBeTruthy();
      expect(BUG_SPECIES[w], `${w} is built: move its aliases onto its about row`).toBeFalsy();
      expect(W.note.length > 5, w).toBe(true);
    }
    // the asks the 1006 fauna note names land on something
    for (const n of ['firefly', 'wasp', 'mosquito', 'moth', 'cockroach', 'cricket', 'tick', 'hermit crab', 'millipede', 'krill']) expect(bugByName(n), n).toBeTruthy();
  });
});

describe('the cards', () => {
  const cards = bugEntryCards();

  it('a hub per class and an entry per worked bug, each within its ceiling', () => {
    expect(cards.length).toBe(Object.keys(CLASSES).length + ids.length);
    for (const c of cards) {
      for (const k of ['id', 'name', 'family', 'entry', 'summary', 'when', 'body']) expect(typeof c[k] === 'string' && c[k].length > 0, `${c.id}.${k}`).toBe(true);
      expect(c.family).toBe('species');
      expect(c.body.length, c.id).toBeLessThanOrEqual(c.id.slice(8) in CLASSES ? HUB_BODY_CEILING : ENTRY_BODY_CEILING);
    }
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it('an entry carries its facts, its true size and starters that parse', () => {
    const c = speciesCard('ladybird');
    expect(c.when).toContain('"ladybug"');
    expect(c.body).toContain('Coccinella septempunctata');
    expect(c.body).toContain('Majerus 1994');
    expect(c.body).toMatch(/built at 6\.8 mm/);
    const starters = c.body.split('\n').filter((l) => /^ {2}.+: \{/.test(l)).map((l) => JSON.parse(l.slice(l.indexOf('{'))));
    expect(starters[0]).toEqual({ kind: 'animal', title: 'ladybird', spec: { species: 'ladybird' } });
    expect(starters.some((s) => s.spec.bug?.length === 0.1)).toBe(true);
  });

  it('a hub names what it does not build and what stands in', () => {
    const hub = cards.find((c) => c.id === 'species/insects');
    expect(hub.body).toMatch(/wasp → 'honeyBee'/);
    expect(hub.when).toContain('"wasp"');
  });

  it('the solid-vocab catalog serves them, out of the bare listing', async () => {
    expect(getSolidVocabCatalog().get('species/honeyBee')?.family).toBe('species');
    const bare = await getSolidVocabHandler({});
    expect(bare.cards.some((c) => c.family === 'species')).toBe(false);
    const listed = await getSolidVocabHandler({ family: 'species' });
    expect(listed.cards.length).toBe(cards.length);
    expect((await getSolidVocabHandler({ id: 'species/firefly' })).card.body).toContain('Photinus pyralis');
  });
});

describe('a name as people say it', () => {
  it('finds a worked bug by its id, common name or any alias', () => {
    for (const [id, A] of Object.entries(about)) for (const n of [id, A.common, ...A.aliases]) expect(bugByName(n)?.id, n).toBe(id);
    expect(bugByName('A Ladybug')).toEqual({ id: 'ladybird', via: 'alias' });
  });

  it('lands a name not built on its stand-in, and says what it misses', () => {
    expect(bugByName('a wasp')).toMatchObject({ id: 'honeyBee', via: 'stand-in', wanted: 'wasp' });
    expect(bugByName('roly-poly')).toMatchObject({ id: 'woodlouse', via: 'stand-in' });
    expect(bugByName('unicorn')).toBe(null);
  });
});
