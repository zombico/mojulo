import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { POMPEII_LAND_RECORD } from './record/pompeii-land.js';
import { POMPEII_RECORD } from './record/pompeii.js';
import { POMPEII_FARM_ASSETS } from './assets/pompeii-land.js';
import { checkRecord, inUseAt } from './record.js';
import { planFarmstead, assembleFarmsteadScene } from './farmstead.js';
import { HISTORIC_SCENES, historicOptions } from './historic-kind.js';
import { CREWS } from './crews.js';

const hash = (x) => createHash('sha1').update(JSON.stringify(x)).digest('hex');

describe('Pompeii\'s land: the villa farm, from its own record', () => {
  it('its record is sound, in Pompeii\'s, and all of it in use at 79', () => {
    expect(checkRecord(POMPEII_RECORD).filter((f) => f.level === 'error')).toEqual([]);
    for (const e of POMPEII_LAND_RECORD) expect(POMPEII_RECORD).toContain(e);
    for (const k of ['type', 'method', 'form']) expect(inUseAt(POMPEII_LAND_RECORD, 79, k).length).toBe(POMPEII_LAND_RECORD.filter((e) => e.kind === k).length);
    // what was working at the eruption but no page dated is held from 79, never back-dated
    expect(POMPEII_LAND_RECORD.find((e) => e.id === 'pl-pistrinum').built.from).toBe(79);
  });

  it('lays a villa at the vintage, every slot from its kit, every kit piece a placeholder until drawn', () => {
    const p = planFarmstead({ culture: 'pompeii' });
    expect(p.stats.season).toBe('vintage');
    for (const s of p.slots) expect(POMPEII_FARM_ASSETS[s.asset], s.asset).toBeDefined();
    for (const a of Object.values(POMPEII_FARM_ASSETS)) expect(a.designed, a.id).toBe(false);
    for (const id of ['pl-villa', 'pl-cella-vinaria', 'pl-press-room', 'pl-trapetum', 'pl-cart']) expect(p.slots.some((s) => s.asset === id), id).toBe(true);
    expect(hash(planFarmstead({ culture: 'pompeii' }))).toBe(hash(p));
  });

  it('is a farm scene for Pompeii, with the vintage its one season', () => {
    expect(HISTORIC_SCENES.farm.cultures).toContain('pompeii');
    expect(historicOptions({ culture: 'pompeii', scene: 'farm', season: 'vintage' }).opts.season).toBe('vintage');
    expect(() => historicOptions({ culture: 'pompeii', scene: 'farm', season: 'flood' })).toThrow(/vintage/);
  });

  it('puts the crews to the vintage and hitches the cart', () => {
    for (const id of Object.keys(POMPEII_FARM_ASSETS).filter((id) => id !== 'pl-cart')) expect(CREWS[id], id).toBeDefined();
    const on = assembleFarmsteadScene({ culture: 'pompeii', world: true, people: true });
    expect(on.stats.people.crew).toBeGreaterThan(40);
    expect(on.stats.people.drivers).toBeGreaterThan(0);   // the carter at the hitched pair
  }, 300000);
});
