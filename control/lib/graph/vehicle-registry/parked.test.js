// Parked vehicles: registry words read and refused with what they need; laid side by side in a room, noses to its +x,
// as many as it holds; lowered by the world into static loft figures and boxes over their footprints added to the
// level's colliders; a base building's `parked` laid in its hangar, painted as its foes' faction dresses or its
// setting's camo; absent, nothing. One case per procedure, the vehicles chosen in code from the registry.
import { describe, it, expect } from 'vitest';
import { readParked, parkIn, withParked, paintOfDress, readBuildingParked, parkable, BASE_PARKED, PARKED_MAX } from './parked.js';
import { VEHICLES, rowOfHandle } from './roster.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { MILITARY_CLASSES } from '../car-designer/road-military.js';
import { UNBUILT } from '../car-designer/sheet.js';
import { CAMO } from '../car-designer/livery-cut.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';
import { readGameworld, MEADOWMARK } from '../gameworld/index.js';
import { gameStages, stageLevelOrder } from '../gameworld/levels.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { FOE_CLASSES } from '../foes/index.js';
import { MOVES } from '../foes/vocab.js';
import { CYCLE_ARCHETYPES } from '../cycle-shelf/cycle-archetypes.js';
import { CYCLE_ODM } from '../cycle-shelf/cycle-odm.js';
import { LOOK_IDS } from '../cycle-shelf/cycle-looks.js';

// (the field's bodies the sheet builds: one still waiting for its parts cannot park)
const FIELD = Object.keys(MILITARY_CLASSES).filter((k) => !UNBUILT[k]).map((k) => rowOfHandle('physics', k));
const ROAD = rowOfHandle('physics', 'pickup');
const room = { x: 10, y: 0, w: 24, d: 30, z: 0 };

describe('a machine ridden astride, parked', () => {
  // (rows chosen in code: one that stands on a stand, one whose machine has none or cannot stand parked)
  const ids = Object.keys(VEHICLES), stands = (id) => CYCLE_ARCHETYPES[VEHICLES[id].handles.cycle].layout.some((e) => CYCLE_ODM[e.sku].kind === 'cycle-stand');
  const standing = ids.find((id) => VEHICLES[id].handles.cycle && VEHICLES[id].uses.includes('parked') && stands(id));
  const held = ids.find((id) => VEHICLES[id].handles.cycle && !(VEHICLES[id].uses.includes('parked') && stands(id)));
  const look = LOOK_IDS.find((k) => k !== 'stock');
  it('stands on its stand as its cycle shelf machine, a look dressing it', () => {
    const p = readParked([{ vehicle: standing, at: [1, 2, 0], look }])[0];
    expect(p).toMatchObject({ vehicle: standing, cycle: VEHICLES[standing].handles.cycle, look });
    const { manifest, colliders } = withParked({ parked: [{ vehicle: standing, at: [1, 2, 0], look }] });
    expect(manifest.figures['parked-0']).toEqual({ cycle: { archetype: VEHICLES[standing].handles.cycle, look } });
    expect(colliders[0].max[2]).toBeCloseTo(PHYSICS[VEHICLES[standing].handles.physics].H, 6);
  });
  it('refuses a machine that cannot stand parked, and a look on a car', () => {
    expect(() => parkable(held)).toThrow(/stand/);
    expect(() => readParked([{ vehicle: ROAD, at: [0, 0, 0], look }])).toThrow(/dressed by its own build/);
  });
  it('in a world: its figure compiled on its stand, a bone at each wheel', async () => {
    const floor = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]], fill: '#777777' };
    const base = { kind: 'controllable', faces: [floor], entities: [{ id: 'cam', rule: { type: 'glide' }, body: { type: 'none' } }] };
    const { payload } = await resolveWorldScene({ ref: 'parked-cycle', title: 'p', manifest: { ...base, parked: [{ vehicle: standing, at: [0, 0, 0] }] } });
    const fig = payload.figures['parked-0'];
    expect(fig.bones.map((b) => b.id).sort()).toEqual(['root', 'wheelF', 'wheelR']);
    expect(fig.cycle.lean).toBeLessThan(0);
    expect(payload.colliders).toHaveLength(1);
  }, 60000);
});

describe('a parked vehicle read', () => {
  it('takes a registry word with a realistic body that stands parked, and refuses one without', () => {
    expect(readParked([{ vehicle: VEHICLES[FIELD[0]].aliases[0], at: [0, 0, 0] }])[0]).toMatchObject({ vehicle: FIELD[0], heading: 0, seed: 1 });
    expect(() => readParked([{ vehicle: 'a flying carpet of words', at: [0, 0, 0] }])).toThrow(/no vehicle/);
    const concept = Object.keys(VEHICLES).find((id) => VEHICLES[id].uses.includes('parked') && !VEHICLES[id].handles.physics);
    expect(() => parkable(concept)).toThrow(/no realistic body/);
    expect(() => readParked([])).toThrow(new RegExp(`1 to ${PARKED_MAX}`));
    expect(() => readParked([{ vehicle: FIELD[0], at: [0, 0] }])).toThrow(/\[x, y, z\]/);
  });
  it('a livery and a wear only on a field vehicle, and only words the field reads', () => {
    expect(() => readParked([{ vehicle: ROAD, at: [0, 0, 0], livery: 'woodland' }])).toThrow(/its own build/);
    expect(() => readParked([{ vehicle: FIELD[0], at: [0, 0, 0], livery: 'paisley' }])).toThrow(/livery/);
    expect(() => readParked([{ vehicle: FIELD[0], at: [0, 0, 0], wear: 'shiny' }])).toThrow();
  });
});

describe('parked in a room', () => {
  it('side by side across it, noses to its +x, inside it, as many as it holds', () => {
    const P = parkIn(room, FIELD, { seed: 4, livery: 'desert' });
    expect(P).toHaveLength(FIELD.length);
    for (const p of P) {
      const v = PHYSICS[readParked([p])[0].class];
      expect(p.heading).toBe(0);
      expect(p.at[0] - v.L / 2).toBeGreaterThanOrEqual(room.x);
      expect(p.at[0] + v.L / 2).toBeLessThanOrEqual(room.x + room.w);
      expect(p.livery).toBe('desert');
    }
    const ys = P.map((p) => p.at[1]);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(parkIn({ ...room, d: 6 }, FIELD).length).toBeLessThan(FIELD.length);
    // (a road car takes no livery: its paint is its build's)
    expect(parkIn(room, [ROAD], { livery: 'desert' })[0].livery).toBeUndefined();
  });
});

describe('lowered by the world', () => {
  const at = [5, 2, 0];
  it('a static loft figure and a box over its footprint, turned with it', () => {
    const cls = readParked([{ vehicle: FIELD[0], at }])[0].class, v = PHYSICS[cls];
    const along = withParked({ parked: [{ vehicle: FIELD[0], at, livery: 'winter' }] }), across = withParked({ parked: [{ vehicle: FIELD[0], at, heading: Math.PI / 2 }] });
    expect(along.manifest.parked).toBeUndefined();
    expect(along.manifest.figures['parked-0'].loft).toMatchObject({ class: cls, light: 'form', livery: 'winter' });
    expect(along.manifest.entities[0]).toMatchObject({ rule: { type: 'static' }, body: { type: 'figure-rig', figure: 'parked-0' }, transform: { pos: at } });
    const span = (c, k) => c.max[k] - c.min[k];
    expect(span(along.colliders[0], 0)).toBeCloseTo(v.L, 3);
    expect(span(along.colliders[0], 1)).toBeCloseTo(v.W, 3);
    expect(span(across.colliders[0], 0)).toBeCloseTo(v.W, 3);
    expect(span(along.colliders[0], 2)).toBeCloseTo(v.H, 3);
  });
  it('in a world: its figure compiled, its box beside the level\'s own colliders; absent, nothing', async () => {
    const floor = { corners: [[-20, -20, 0], [20, -20, 0], [20, 20, 0], [-20, 20, 0]], fill: '#777777' };
    const own = [{ min: [-20, -20, 0], max: [-19, 20, 3] }];
    const base = { kind: 'controllable', faces: [floor], entities: [{ id: 'cam', rule: { type: 'glide' }, body: { type: 'none' } }], colliders: own };
    const { payload } = await resolveWorldScene({ ref: 'parked-test', title: 'p', manifest: { ...base, parked: [{ vehicle: FIELD[0], at }] } });
    expect(payload.entities.map((e) => e.id)).toContain('parked-0');
    expect(payload.figures['parked-0'].bones.some((b) => b.id.startsWith('wheel'))).toBe(true);
    expect(payload.colliders).toHaveLength(2);
    expect(payload.colliders[0]).toEqual(own[0]);
    const { payload: plain } = await resolveWorldScene({ ref: 'parked-test', title: 'p', manifest: base });
    expect(plain.figures?.['parked-0']).toBeUndefined();
    expect(plain.colliders).toEqual(own);
  }, 60000);
});

describe('a base parks its vehicles', () => {
  const colourways = Object.entries(GRUNT_STYLES).flatMap(([faction, S]) => Object.keys(S.colourways ?? {}).map((colourway) => ({ faction, colourway })));
  it('a faction paints them: a camo it names, else its own colour flat; nothing without one', () => {
    const camo = colourways.find((d) => CAMO[d.colourway]), flat = colourways.find((d) => !CAMO[d.colourway] && GRUNT_STYLES[d.faction].colourways[d.colourway].palette?.Top);
    expect(paintOfDress(camo)).toBe(camo.colourway);
    expect(paintOfDress(flat)).toEqual({ pattern: 'mono', colours: [GRUNT_STYLES[flat.faction].colourways[flat.colourway].palette.Top.toLowerCase()] });
    expect(paintOfDress(null)).toBeNull();
  });
  it('its word: true a truck and a carrier, a list, or its words; refused when it names what cannot park', () => {
    expect(readBuildingParked(true).vehicles).toEqual([...BASE_PARKED]);
    expect(readBuildingParked({ vehicles: [FIELD[0]], wear: 'battered' })).toMatchObject({ vehicles: [FIELD[0]], wear: 'battered' });
    expect(() => readBuildingParked('yes')).toThrow(/true/);
    expect(() => readBuildingParked({ cars: [] })).toThrow(/not one of its words/);
  });
  const hangar = (parked, more = {}) => ({ ...MEADOWMARK, ...more, levels: { ...MEADOWMARK.levels, base: { name: 'The hangar', building: { use: 'hangar-bay', seed: 2, ...(parked !== undefined ? { parked } : {}) } } } });
  const order = (W) => stageLevelOrder(readGameworld(W), gameStages(W).find((s) => s.level === 'base'), { ref: 'lv_base' }).args.manifest;
  it('in its hangar, in its setting\'s camo; refused by the world when a word cannot park; absent, the level as it was', () => {
    const M = order(hangar(true));
    expect(M.parked.map((p) => p.vehicle)).toEqual([...BASE_PARKED]);
    expect(M.parked.every((p) => typeof p.livery === 'string' && CAMO[p.livery])).toBe(true);
    expect(order(hangar(undefined)).parked).toBeUndefined();
    expect(() => readGameworld(hangar(['a flying carpet of words']))).toThrow(/no vehicle/);
  });
  it('painted as its foes\' faction dresses, over its setting', () => {
    const SOLO = Object.values(FOE_CLASSES).find((c) => !MOVES[c.move].group);
    const dress = colourways.find((d) => CAMO[d.colourway] && d.colourway !== order(hangar(true)).parked[0].livery);
    const M = order(hangar(true, { foes: { a: { class: SOLO.id, skin: { people: 'human', dress } } } }));
    expect(M.parked.every((p) => p.livery === dress.colourway)).toBe(true);
  });
  it('parks the tracked too: a tank and a carrier named in its list, beside the wheeled', () => {
    const tracked = Object.keys(MILITARY_CLASSES).filter((k) => PHYSICS[k].running === 'track' && !UNBUILT[k]).map((k) => rowOfHandle('physics', k));
    expect(tracked.length).toBeGreaterThan(0);
    const M = order(hangar([...tracked, FIELD[0]]));
    expect(M.parked.map((p) => p.vehicle)).toEqual([...tracked, FIELD[0]]);
    const lowered = withParked({ parked: M.parked });
    expect(Object.values(lowered.manifest.figures).map((f) => f.loft.class)).toEqual(expect.arrayContaining(tracked.map((id) => readParked([{ vehicle: id, at: [0, 0, 0] }])[0].class)));
  });
});

