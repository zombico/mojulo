import { describe, it, expect } from 'vitest';
import { boatBase, boatOf, validateBoat, BOAT_ARMS, SHORE } from './boats.js';
import { layArtillery } from './artillery.js';
import { CRAFT_ARCHETYPES } from '../../craft-shelf/craft-archetypes.js';
import { VEHICLES, handlesOf } from '../../vehicle-registry/roster.js';
import { composeLive } from '../../worlds/controllable/compose.js';

// THE BOATS ON THE RANGE (boats.js): the craft shelf's boats driven on the range's water, armed with their own gun on its
// mount's bone or fitted one. One case per procedure, chosen from the shelf in code: the lightest boat with its own gun,
// the lightest fitted one; a boat the shelf builds with no drive; the sea the range lays for them.
const wordOf = (a) => VEHICLES[Object.keys(VEHICLES).find((id) => (handlesOf(id).craft ?? []).includes(a))].label;
const lightest = (f) => Object.keys(BOAT_ARMS).filter((a) => f(BOAT_ARMS[a])).sort((a, b) => CRAFT_ARCHETYPES[a].reference.mtow - CRAFT_ARCHETYPES[b].reference.mtow)[0];
const OWN = lightest((x) => x.bone), FIT = lightest((x) => x.fit === 'bow');
const E = composeLive(), DT = 1 / 60;

describe('the boats on the range', () => {
  it('its own gun: its mount\'s bone turned by the hand, its rounds carried by the boat\'s way', () => {
    const B = boatBase({ boat: wordOf(OWN) });
    expect(B.rule.type).toBe('boat');
    expect(B.bone).toBe(BOAT_ARMS[OWN].bone);
    expect(B.figure.bones.some((b) => b.id === B.bone)).toBe(true);
    expect(B.fitted).toBe(false);
    expect(B.turret.mount.stabilized).toBe(true);
    // (on the runtime, at speed: a round fired ahead leaves at its speed and the boat's together)
    const w = E.createWorld({ entities: [{ id: 'b', pilotable: true, rule: { ...B.rule, leverStart: 1 }, turret: { ...B.turret, rounds: B.rounds }, weapon: B.rounds[0], body: { type: 'none' }, transform: B.transform }] });
    const hooks = { ground: () => -50 };
    for (let i = 0; i < 600; i++) E.stepWorld(w, {}, DT, hooks);
    const b = w.byId.b, u = b.speed;
    E.stepWorld(w, { fire: 1 }, DT, hooks);
    const p = w.projectiles.find((q) => q.owner === 'b');
    expect(u).toBeGreaterThan(5);
    expect(p.carried).toBe(true);
  });
  it('a boat built unarmed is fitted a gun at its bow; its water is a lake\'s, its wake at each of its speeds', () => {
    const B = boatBase({ boat: wordOf(FIT) });
    expect(B.fitted).toBe(true);
    expect(B.bone).toBe(null);
    expect(B.turret.mount.at[0]).toBeGreaterThan(0);
    expect(B.sea.kind).toBe('lake');
    expect(B.sea.wakes.length).toBeGreaterThan(4);
    expect(B.sea.wakes.map((w) => w.speed)).toEqual([...B.sea.wakes.map((w) => w.speed)].sort((a, b) => a - b));
  });
  it('refuses a boat with no drive on the range, and what is no boat', () => {
    const none = Object.keys(VEHICLES).find((id) => VEHICLES[id].realm === 'water' && !(handlesOf(id).craft ?? []).some((a) => BOAT_ARMS[a]));
    expect(validateBoat({ boat: VEHICLES[none].label }).join()).toMatch(/no boat of the craft shelf|no drive/);
    expect(validateBoat({ boat: 'sedan' }).join()).toMatch(/no boat/);
    expect(boatOf(wordOf(OWN)).archetype).toBe(OWN);
  });
  it('the range laid for a boat: the sea to the shore, its bottom deep, a beach up to the land; the stands inland', () => {
    const L = layArtillery({ sea: { shore: SHORE } });
    const sea = L.faces.filter((f) => f.corners.every((c) => c[2] <= -8 + 1e-9));
    expect(sea.length).toBe(1);
    expect(L.stands.every((s) => s.min[0] > SHORE)).toBe(true);
    expect(L.faces.some((f) => f.corners.some((c) => c[0] === SHORE && c[2] === 0) && f.corners.some((c) => c[2] === -8))).toBe(true);
  });
});
