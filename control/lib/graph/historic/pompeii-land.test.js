import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { POMPEII_LAND_RECORD } from './record/pompeii-land.js';
import { POMPEII_RECORD } from './record/pompeii.js';
import { POMPEII_FARM_ASSETS } from './assets/pompeii-land.js';
import { checkRecord, inUseAt } from './record.js';
import { historicFoci } from './historic-kind.js';
import { planHistoricCity, assembleHistoricCityScene } from './historic-city.js';
import { FORMS } from './form/towns.js';
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

  const villa = FORMS.pompeii.activities.find((a) => a.kit === 'farm');
  it('lays the villa farm in the region, every piece from its kit, every kit piece a placeholder until drawn', () => {
    const p = planHistoricCity({ culture: 'pompeii', scene: 'region' }), pieces = p.slots.filter((q) => q.activity === villa.id);
    expect(pieces.map((q) => q.asset).sort()).toEqual([...villa.pieces].sort());
    for (const q of pieces) expect(POMPEII_FARM_ASSETS[q.asset], q.asset).toBeDefined();
    for (const a of Object.values(POMPEII_FARM_ASSETS)) expect(a.designed, a.id).toBe(false);
    expect(hash(planHistoricCity({ culture: 'pompeii', scene: 'region' }).slots)).toBe(hash(p.slots));
  });

  it('is a slice of life for Pompeii', () => {
    expect(historicFoci({ culture: 'pompeii' })).toContain(villa.id);
  });

  it('puts the crews to work at the villa', () => {
    for (const id of Object.keys(POMPEII_FARM_ASSETS).filter((id) => id !== 'pl-cart')) expect(CREWS[id], id).toBeDefined();
    const on = assembleHistoricCityScene({ culture: 'pompeii', scene: 'slice', focus: villa.id, world: true, people: true, shade: false });
    expect(on.stats.people.crew).toBeGreaterThan(5);
  }, 300000);
});
