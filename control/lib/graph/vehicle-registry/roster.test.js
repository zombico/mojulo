import { describe, it, expect } from 'vitest';
import {
  VEHICLES, REALMS, ROLES, ERAS, USES, HANDLE_TABLES, vehicleNameIndex, resolveVehicle, normalizeName, handlesOf,
  rowOfHandle, vehiclesForRole, findVehicles, suggestVehicles,
} from './roster.js';
import { buildsOf, buildOf, upscaleOf, dimsOf, loftable, TIER_IDS, STATUSES } from './builds.js';
import { VEHICLE_REGISTRY } from '../vehicles/vehicles-css3d.js';
import { CAR_NETS, SMOOTH_BOX_NETS } from '../polygonizer/vehicle-swept-net.js';
import { AIRCRAFT_FUSELAGE_NETS } from '../polygonizer/vehicle-fuselage-net.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { FLEET } from '../roads/fleet.js';
import { VEH_ARCHETYPES } from '../vehicle-designer/assembly-bom.js';
import { RIDES } from '../gameworld/ride.js';
import { SUPERCAR_LIBRARY } from '../car-designer/vehicle-library.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { CRAFT } from '../skyscape/eye.js';
import { CYCLE_ARCHETYPES } from '../cycle-shelf/cycle-archetypes.js';
import { CON_ARCHETYPES } from '../construction-shelf/con-archetypes.js';
import { MECHA_ARCHETYPES } from '../mecha-shelf/mecha-archetypes.js';
import { CAR_CARDS } from '../car-shelf/car-library.js';
import { CRAFT_TRAITS } from '../gameworld/tech-crafter.js';

const IDS = Object.keys(VEHICLES);
const FROZEN = 'a new vehicle is a registry row first (vehicle-registry/roster.js), its builds after it';
// the tech crafter's vehicle concepts: the traits that are a form's variant (the rest are modifiers: sail, steam, armed…)
const TECH = Object.keys(CRAFT_TRAITS.vehicle).filter((k) => CRAFT_TRAITS.vehicle[k].form);

// every measuring table a row's handle may name: its keys
const TABLES = {
  scenery: Object.keys(VEHICLE_REGISTRY),
  physics: Object.keys(PHYSICS),
  fleet: Object.keys(FLEET),
  assembly: Object.keys(VEH_ARCHETYPES),
  ride: Object.keys(RIDES),
  supercar: Object.keys(SUPERCAR_LIBRARY),
  craft: Object.keys(CRAFT_ARCHETYPES),
  sky: Object.keys(CRAFT),
  cycle: Object.keys(CYCLE_ARCHETYPES),
  construction: Object.keys(CON_ARCHETYPES),
  mecha: Object.keys(MECHA_ARCHETYPES),
  car: Object.keys(CAR_CARDS),
};
const NETS = [...Object.keys(CAR_NETS), ...Object.keys(SMOOTH_BOX_NETS), ...Object.keys(AIRCRAFT_FUSELAGE_NETS)];

const CONTRACT = {
  label: (r) => (typeof r.label === 'string' && r.label.length > 0) || 'label: what it is called in prose',
  aliases: (r) => (Array.isArray(r.aliases) && r.aliases.every((a) => typeof a === 'string' && a.length >= 3)) || 'aliases: the words people say, 3+ characters each',
  realm: (r) => r.realm in REALMS || `realm: one of ${Object.keys(REALMS).join(', ')}`,
  role: (r) => r.role in ROLES || `role: one of ${Object.keys(ROLES).join(', ')}`,
  eras: (r) => (r.eras.length > 0 && r.eras.every((e) => e in ERAS)) || `eras: some of ${Object.keys(ERAS).join(', ')}`,
  uses: (r) => (r.uses.length > 0 && r.uses.every((u) => u in USES)) || `uses: some of ${Object.keys(USES).join(', ')}`,
  tables: (r) => Object.keys(r.handles).every((t) => t in HANDLE_TABLES) || `handles: only ${Object.keys(HANDLE_TABLES).join(', ')}`,
  tech: (r) => TECH.includes(r.handles.tech) || `handles.tech: the concept it falls back to, one of ${TECH.join(', ')}`,
  keys: (r) => Object.entries(r.handles).every(([t, v]) => t === 'tech' || t === 'racer' || [v].flat().every((k) => (t === 'net' ? NETS : TABLES[t]).includes(k))) || 'handles: every key is a key of its table',
};

describe('the vehicle row contract', () => {
  it('every row says everything the registry needs', () => {
    const missing = IDS.flatMap((id) => Object.values(CONTRACT).map((c) => c(VEHICLES[id])).filter((r) => r !== true).map((m) => `${id}: ${m}`));
    expect(missing).toEqual([]);
  });
  it('fills every role', () => {
    expect(Object.keys(ROLES).filter((role) => !vehiclesForRole(role).length)).toEqual([]);
  });
  it('names every vehicle concept the technology crafter draws', () => {
    expect(TECH.filter((k) => !rowOfHandle('tech', k)), FROZEN).toEqual([]);
  });
});

describe('the legacy tables are frozen behind the registry: every key claimed by exactly one row', () => {
  const claims = (table) => {
    const by = new Map();
    for (const id of IDS) for (const k of handlesOf(id)[table] ?? []) by.set(k, [...(by.get(k) ?? []), id]);
    return by;
  };
  for (const [table, keys] of Object.entries(TABLES)) {
    it(`claims every key of the ${table} table once`, () => {
      const by = claims(table);
      expect(keys.filter((k) => !by.has(k)), `${HANDLE_TABLES[table].table}: ${FROZEN}`).toEqual([]);
      expect([...by].filter(([, ids]) => ids.length > 1)).toEqual([]);
    });
  }
  it('claims every net, through its scenery entry or as an orphan', () => {
    const viaScenery = new Set(Object.values(VEHICLE_REGISTRY).map((v) => v.net));
    const orphans = claims('net');
    expect(NETS.filter((n) => !viaScenery.has(n) && !orphans.has(n)), FROZEN).toEqual([]);
    expect([...orphans.keys()].filter((n) => viaScenery.has(n)), 'an orphan net is one no scenery entry builds').toEqual([]);
  });
  it('gives the racer grammar to one row', () => {
    expect(IDS.filter((id) => VEHICLES[id].handles.racer)).toHaveLength(1);
  });
  it('names no row by another row\'s legacy ride key (a ride names a row by either, the key first)', () => {
    expect(Object.keys(RIDES).filter((k) => VEHICLES[k] && rowOfHandle('ride', k) !== k)).toEqual([]);
  });
  it('agrees with the legacy pairings', () => {
    for (const id of IDS) {
      const h = VEHICLES[id].handles;
      if (h.ride) expect(RIDES[h.ride].archetype, `${id}: the ride is its assembly`).toBe(h.assembly);
      if (h.fleet && h.physics) expect([h.physics].flat(), `${id}: one class, measured and driven`).toContain(h.fleet);
    }
  });
});

describe('the words: one word, one vehicle', () => {
  it('builds the name index without a collision', () => {
    expect(() => vehicleNameIndex()).not.toThrow();
  });
  it('reads a word the way people say it', () => {
    const [id, r] = Object.entries(VEHICLES).find(([, v]) => v.aliases.some((a) => a.includes(' ')));
    const alias = r.aliases.find((a) => a.includes(' '));
    expect(resolveVehicle(`the ${alias.toUpperCase().replace(' ', '-')}`)?.id).toBe(id);
    expect(resolveVehicle(`${id.replace(/-/g, ' ')}s`)?.id).toBe(id);
    expect(resolveVehicle('nothing at all')).toBe(null);
    expect(normalizeName('A Box_Truck')).toBe('box truck');
  });
  it('maps a legacy key to its row', () => {
    const [id, r] = Object.entries(VEHICLES).find(([, v]) => v.handles.ride);
    expect(rowOfHandle('ride', r.handles.ride)).toBe(id);
    expect(rowOfHandle('ride', 'no-such')).toBe(null);
  });
});

describe('search', () => {
  it('ranks the vehicle named exactly first, then by its words, deterministically', () => {
    const id = IDS.find((k) => VEHICLES[k].realm === 'air');
    const got = findVehicles({ words: VEHICLES[id].label });
    expect(got[0]).toMatchObject({ id, score: 100 });
    expect(findVehicles({ words: VEHICLES[id].label })).toEqual(got);
  });
  it('filters by its facets', () => {
    const era = 'rustic';
    const got = findVehicles({ era, limit: 99 });
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((f) => f.row.eras.includes(era))).toBe(true);
    expect(findVehicles({ realm: 'space', role: 'commuter' })).toEqual([]);
  });
  it('points a refusal at the registry', () => {
    expect(suggestVehicles('stealth jet')).toMatch(/vehicle registry has/);
    expect(suggestVehicles('qqqq')).toMatch(/get_solid_vocab/);
  });
});

describe('builds by tier', () => {
  // one row per builder, chosen in code: the concept is the builder, not the catalog
  const byVia = new Map();
  for (const id of IDS) for (const b of buildsOf(id)) if (!byVia.has(b.via)) byVia.set(b.via, id);

  it('every builder has a row, and every build a tier, a status and the uses it serves', () => {
    expect([...byVia.keys()].sort()).toEqual(['assembly', 'construction', 'craft', 'cycle', 'fleet', 'loft', 'mecha', 'net', 'racer', 'ride', 'scenery', 'supercar', 'tech']);
    for (const id of byVia.values()) {
      for (const b of buildsOf(id)) {
        expect(b.tier === null || TIER_IDS.includes(b.tier)).toBe(true);
        expect(STATUSES).toContain(b.status);
        expect(b.uses.length).toBeGreaterThan(0);
      }
    }
  });
  it('every row falls back to a concept, so a game can always draw it', () => {
    for (const id of byVia.values()) expect(buildsOf(id).at(-1).status).toBe('concept');
  });
  it('draws a row at its own tier, and says so when it falls', () => {
    const toy = byVia.get('racer');
    expect(buildOf(toy, 'toy')).toMatchObject({ tier: 'toy', build: { via: 'racer', status: 'live' } });
    expect(buildOf(toy, 'toy').fell).toBeUndefined();
    const fell = buildOf(toy, 'realistic');
    expect(fell.tier).not.toBe('realistic');
    expect(fell.fell).toMatch(/no realistic build yet/);
    expect(() => buildOf(toy, 'photoreal')).toThrow(/toy, stylised, realistic/);
  });
  it('picks the build that serves the use: traffic is not a hero\'s car', () => {
    const id = byVia.get('fleet');
    expect(buildOf(id, 'realistic', { use: 'traffic' }).build.via).toBe('fleet');
    expect(buildOf(id, 'realistic', { use: 'driven' }).build.via).not.toBe('fleet');
  });
  it('lofts only a class with a body to loft', () => {
    const loft = byVia.get('loft');
    expect(loftable(buildOf(loft, 'realistic', { use: 'driven' }).build.key)).toBe(true);
    const open = IDS.find((id) => VEHICLES[id].handles.racer);
    expect([VEHICLES[open].handles.physics].flat().some(loftable)).toBe(false);
  });
  it('says what each row needs to be drawn realistic', () => {
    const states = new Set(IDS.map((id) => upscaleOf(id).realistic));
    expect([...states].every((st) => ['live', 'preview', 'asleep', 'none'].includes(st))).toBe(true);
    // a road class's loft is driven now: its row is drawn realistic, by the loft
    const lofted = byVia.get('loft');
    expect(upscaleOf(lofted)).toMatchObject({ realistic: 'live', via: 'loft', next: null });
    expect(upscaleOf(IDS.find((id) => upscaleOf(id).realistic === 'none')).next).toMatch(/realistic body/);
  });
  it('sends a site machine to the construction shelf, and a skid steer\'s driving to skid steer', () => {
    const site = IDS.filter((id) => VEHICLES[id].role === 'construction');
    expect(site.length).toBeGreaterThan(0);
    // (each drawn and parked by the shelf; what one that drives needs is driving: a skid steer's by skid steer, the rest
    // by its ride; one that never drives, a tower crane, needs nothing)
    for (const id of site) {
      expect(buildOf(id, 'realistic', { use: 'parked' }).build).toMatchObject({ via: 'construction', status: 'live' });
      if (VEHICLES[id].uses.includes('driven')) expect(upscaleOf(id).next, id).toMatch(/^driving it: /);
      else expect(upscaleOf(id)).toMatchObject({ realistic: 'live', via: 'construction', next: null });
    }
    expect(site.map((id) => upscaleOf(id).next).some((n) => /construction shelf/.test(n))).toBe(true);
    // every site machine falls back to a concept the crafter draws, and its size is its class's or its own
    for (const id of site) expect(buildOf(id, 'realistic').build).toBeTruthy();
    expect(site.filter((id) => !handlesOf(id).physics)).toEqual(['tower-crane']);
  });
  it('reads a size from the table that measures it', () => {
    const fleet = byVia.get('fleet'), craft = byVia.get('craft');
    expect(dimsOf(fleet)).toMatchObject({ L: FLEET[handlesOf(fleet).fleet[0]].L, from: 'fleet' });
    expect(dimsOf(craft)).toMatchObject({ from: 'craft' });
  });
});
