// The bug roster's facts as the animal encyclopedia reads them (fauna/entries.js runs the shared contract: an about row
// per species, wanted rows with a built stand-in, one word one animal). Here: what is particular to the arthropods.
import { describe, it, expect } from 'vitest';
import { BUG_SPECIES } from './species.js';
import { about, ORDERS, stanceOfOrder } from './about.js';
import { resolveAnimalName } from '../fauna/entries.js';

describe('the bug roster in the encyclopedia', () => {
  it('every order has its everyday group, class and leg count', () => {
    for (const [id, B] of Object.entries(BUG_SPECIES)) {
      expect(ORDERS[B.order]?.cls, `${id} (${B.order})`).toMatch(/^(insect|arachnid|crustacean|myriapod)$/);
      expect(stanceOfOrder(B.order), id).toBeTruthy();
      expect(typeof about[id]?.read, `${id}.read`).toBe('string');
    }
  });

  it('each generic word belongs to ONE arthropod: the one most people picture', () => {
    const pictured = { bug: 'ladybird', insect: 'honeyBee', spider: 'gardenSpider', beetle: 'stagBeetle', crab: 'greenCrab', ant: 'carpenterAnt', bee: 'honeyBee', fly: 'houseFly', butterfly: 'monarch', lobster: 'lobster' };
    for (const [w, id] of Object.entries(pictured)) expect(resolveAnimalName(w)?.id, w).toBe(id);
  });

  it('the asks the fauna note names land on a bug or its stand-in', () => {
    for (const n of ['firefly', 'wasp', 'mosquito', 'moth', 'cockroach', 'cricket', 'tick', 'hermit crab', 'millipede', 'krill', 'a ladybug', 'crawdad', 'roly-poly']) {
      const r = resolveAnimalName(n);
      expect(r && (BUG_SPECIES[r.id] || BUG_SPECIES[r.near]), n).toBeTruthy();
    }
  });
});
