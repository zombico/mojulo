import { describe, it, expect } from 'vitest';
import { flyRule, craftPilot, airframeOf, AIRFRAME, seatCraft } from './craft.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { CRAFT } from './eye.js';
import { planMap } from './map.js';
import { assembleAirspace, airspaceOf, validateAirspace } from './airspace.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

// one powered class and one without an engine, chosen from the registry
const powered = Object.keys(CRAFT).find((k) => CRAFT[k].engine !== false), unpowered = Object.keys(CRAFT).find((k) => CRAFT[k].engine === false);
const DT = 1 / 60, flat = { ground: () => 0 };

describe('a craft on the fly rule', () => {
  it('tops out at its class\'s top speed at full throttle', () => {
    const rule = flyRule(powered, { lever: false });
    const w = createWorld({ entities: [{ id: 'p', rule, transform: { pos: [0, 0, 2000], heading: 0, pitch: 0 } }] });
    w.byId.p.airspeed = CRAFT[powered].cruise; w.byId.p.airborne = true;
    for (let i = 0; i < 60 * 120; i++) stepWorld(w, { forward: 1 }, DT, flat);
    expect(w.byId.p.airspeed).toBeGreaterThan(CRAFT[powered].max * 0.97);
  });

  it('takes off from the runway on the lever', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: flyRule(powered), transform: { pos: [0, 0, 1.2], heading: 0, pitch: 0 } }] });
    let up = false;
    for (let i = 0; i < 60 * 60 && !up; i++) { stepWorld(w, { forward: i < 120 ? 1 : 0, lift: w.byId.p.airspeed > CRAFT[powered].stall * 1.2 ? 1 : 0 }, DT, flat); up = w.byId.p.airborne; }
    expect(up).toBe(true);
  });

  it('gives a craft without an engine no thrust, and its glide ratio as its drag', () => {
    const rule = flyRule(unpowered);
    expect(rule.engine).toBe(false);
    expect(rule.lever).toBeUndefined();
    const c = CRAFT[unpowered];
    expect(rule.drag * c.cruise * c.cruise).toBeCloseTo((c.mass * 9.81) / c.glide, 0);
  });

  it('takes the map\'s reach as its bound', () => {
    const map = planMap({ form: 'island', field: 1200, craft: powered });
    expect(flyRule(powered, { map }).bound.hx).toBe(map.rings.reach.hx);
  });

  it('is seated on the airspace\'s runway (or aloft when it has no engine), with a chase camera that banks', () => {
    const base = { kind: 'airspace', map: { form: 'island', field: 1200, craft: powered }, ground: { pads: [{ at: [0.5, 0.4] }] } };
    const p = assembleAirspace({ ...base, fly: true }, { live: true });
    expect(p.entities[0].rule.type).toBe('fly');
    expect(p.camera.rollFollow).toBe(1);
    expect(p.walk).toBeUndefined();
    const g = assembleAirspace({ ...base, fly: { craft: unpowered } }, { live: true });
    expect(g.entities[0].rule.launchSpeed).toBeGreaterThan(0);
    expect(g.entities[0].transform.pos[2]).toBeGreaterThan(p.entities[0].transform.pos[2] + 50);
  });
});

// THE AIRFRAME: a level's craft flies as its class's machine off the craft shelf, or one the level names, or the slab
// where the shelf has none (a glider) or the level asks for it (false); its gear down when it starts on the runway and up
// when it starts aloft. A name the shelf lacks is refused, naming the shelf.
describe('the craft as its airframe', () => {
  const pilotOf = (manifest, opts) => { const { map, field } = airspaceOf(manifest); return craftPilot(map, seatCraft(map, field, null, {}), opts); };
  it('every class\'s airframe is on the shelf, and the shelf\'s figure is the body', () => {
    for (const a of Object.values(AIRFRAME)) expect(CRAFT_ARCHETYPES[a], a).toBeTruthy();
    const P = pilotOf({ kind: 'airspace', map: { craft: 'trainer' }, ground: { pads: [{ kind: 'runway', at: [0.5, 0.25] }] } });
    expect(P.entities[0].body).toEqual({ type: 'figure-rig', figure: 'craft' });
    expect(P.figures.craft.craft).toEqual({ archetype: 'lightSingle', flying: true, gear: 'down' });
  });
  it('aloft (a glider is launched, space has no runway) the gear is up; a glider has no airframe and stays the slab', () => {
    expect(pilotOf({ kind: 'airspace', map: { craft: 'fighter' } }).figures.craft.craft).toMatchObject({ archetype: 'strikeFoil', gear: 'up' });
    const G = pilotOf({ kind: 'airspace', map: { craft: 'glider' } });
    expect(G.entities[0].body.type).toBe('mesh');
    expect(G.figures).toBeUndefined();
  });
  it('a level may name another airframe, or the slab; a name the shelf lacks is refused', () => {
    expect(pilotOf({ kind: 'airspace', map: { craft: 'fighter' } }, { airframe: 'heavyFighter' }).figures.craft.craft.archetype).toBe('heavyFighter');
    expect(pilotOf({ kind: 'airspace', map: { craft: 'trainer' } }, { airframe: false }).entities[0].body.type).toBe('mesh');
    expect(() => airframeOf({ key: 'trainer' }, 'cessna')).toThrow(/'cessna' is not a craft of the shelf \(lightSingle/);
    expect(validateAirspace({ kind: 'airspace', airframe: 'cessna' }).join(' ')).toMatch(/not a craft of the shelf/);
  });
});
