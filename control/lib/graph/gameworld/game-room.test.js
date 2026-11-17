// The game room at the practice door: the room composed for the world, the hero on its feel, the foes on their spots
// (still until woken), a shift on its counters and measured; offered to any world with a feel, a shift or foes.
import { describe, it, expect } from 'vitest';
import { gameRoom, gameRoomOf } from './game-room.js';
import { practiceFor } from './practice.js';
import { POLES, POLE_IDS } from './feel/cards.js';
import { feelRule } from './feel/lower.js';
import { readGameworld } from './world.js';

const FIGHTER = POLE_IDS.find((id) => POLES[id].demo.includes('attack') && POLES[id].base === 'action');

describe('the game room', () => {
  it('is offered to a world that fights hand to hand or works a shift, and left to their own rooms for the rest', () => {
    expect(gameRoomOf({ feel: FIGHTER })).toBe(true);
    expect(gameRoomOf({ quick: { goal: 'work' } })).toBe(true);
    expect(gameRoomOf({ id: 'bare' })).toBe(false);
    const PLATFORMER = POLE_IDS.find((id) => POLES[id].base === 'platformer' && !POLES[id].demo.includes('attack'));
    if (PLATFORMER) expect(practiceFor({ feel: PLATFORMER }).rooms).not.toContain('room');
    expect(practiceFor({ feel: FIGHTER }).rooms).toContain('room');
  });
  it('stands the composed room, the hero on the feel at the spawn, and a foe on every spot', () => {
    const r = gameRoom({ id: 'g', feel: FIGHTER }), M = r.manifest, A = r.room.anchors;
    const hero = M.entities.find((e) => e.pilotable);
    expect(hero.transform.pos).toEqual(A.spawn);
    expect(hero.rule.speed).toBe(feelRule(FIGHTER).speed);
    expect(M.entities.filter((e) => /^foe-/.test(e.id)).length).toBe(A.foes.length);
    // every block of the composition collides (the four walls besides)
    expect(M.colliders.length).toBe(4 + r.room.primitives.reduce((t, p) => t + (p.kind === 'platform' && (p.h ?? 0) > 0.72 ? 2 : 1), 0));
    expect(r.laws.every((l) => l.holds)).toBe(true);
    expect(M.camera.rule).not.toBe('overhead');
  });
  it('a shift: its line on the counters, seen from overhead, the work shown and measured', () => {
    const r = gameRoom({ id: 'w', quick: { goal: 'work' } });
    expect(r.manifest.camera.rule).toBe('overhead');
    expect(r.manifest.events.sources.some((z) => z.use === 'w0-serve')).toBe(true);
    expect(r.manifest.events.entities.some((e) => e.type === 'work-pip')).toBe(true);
    expect(r.manifest.faces.some((f) => f.group === 'room:flow')).toBe(true);
    expect(r.measured.won).toBe(true);
  });
});

describe('the game room\'s area', () => {
  it('stands in its trade\'s area, the world\'s own written over it, or on the plane', () => {
    const own = gameRoom({ id: 'w', quick: { goal: 'work' } });
    expect(own.area.name).toBe(own.dress.trade);
    expect(own.area.cut).toEqual(['s']);
    expect(own.manifest.faces.some((f) => f.group === 'room:area:wall')).toBe(true);
    expect(own.manifest.faces.some((f) => f.group === 'room:plane')).toBe(false);
    const H = own.room.half, south = own.manifest.colliders.find((c) => c.max[1] <= -H);
    expect(south.max[2]).toBeLessThan(own.manifest.colliders.find((c) => c.min[1] >= H).max[2] + 1e-9);
    const G = { id: 'w', quick: { goal: 'work' }, room: { area: { like: 'farm', walls: 'stone', surround: false } } };
    const w = gameRoom(G);
    expect(w.area).toMatchObject({ name: 'farm', walls: 'stone', surround: [] });
    const plane = gameRoom(G, { area: false });
    expect(plane.area).toBeNull();
    expect(plane.manifest.faces.some((f) => f.group === 'room:plane')).toBe(true);
    expect(plane.manifest.faces.some((f) => String(f.group).startsWith('room:area'))).toBe(false);
  });
  it('is the world\'s to design: `room: { dress?, area? }`, read and taught', () => {
    const W = (room) => ({ id: 'r', levels: { a: { walk: { nodes: { t: { trail: true } } } } }, room });
    expect(readGameworld(W({ dress: 'farm', area: { like: 'farm', sky: '#dde8ef' } })).room.dress).toBe('farm');
    expect(() => readGameworld(W({ area: 'moon' }))).toThrow(/area is/);
    expect(() => readGameworld(W({ dress: 'moon' }))).toThrow(/room.dress/);
    expect(() => readGameworld(W({ walls: 'stone' }))).toThrow(/room has no 'walls'/);
  });
});

// A FIGHT in the room (gameroom/fight.js, fights.js): composed for the kit, its foes asleep until their wave, its ways
// sealed. One kind laid with rifts and one with perches, chosen from the table in code.
import { FIGHT_KINDS, FIGHT_KIND_IDS, composeFight } from '../gameroom/fight.js';
import { castRoles, fightWaves, fightCast, fightPlacements, fightMechanic, FIGHT_ROLES } from './fights.js';
import { roomNeeds } from '../gameroom/needs.js';
import { TEMPLATE_ARSENALS } from './combos.js';
import { playLevel } from './playthrough.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const KIT = Object.keys(TEMPLATE_ARSENALS).find((id) => (TEMPLATE_ARSENALS[id].ranged ?? []).length && TEMPLATE_ARSENALS[id].weapons.some((W) => Object.values(W.moves).some((m) => m.launch > 0)));
const RIFTED = FIGHT_KIND_IDS.find((k) => composeFight(roomNeeds({ feel: KIT }), { kind: k }).anchors.rifts.length > 1);
const PERCHED = FIGHT_KIND_IDS.find((k) => composeFight(roomNeeds({ feel: KIT }), { kind: k }).primitives.some((p) => p.kind === 'perch'));

describe('a fight\'s waves', () => {
  it('are read by role or by the bestiary\'s id, and say what a wave takes', () => {
    const R = castRoles({});
    for (const role of Object.keys(FIGHT_ROLES)) expect(R[role]).toBeTruthy();
    expect(R.shooter).not.toBe(R.grunt);
    const W = fightWaves({}, RIFTED);
    expect(W.length).toBe(FIGHT_KINDS[RIFTED].waves.length);
    expect(fightWaves({}, RIFTED, [{ [R.grunt]: 2, grunt: 1 }])).toEqual([{ [R.grunt]: 3 }]);
    expect(() => fightWaves({}, RIFTED, [{ dragon: 1 }])).toThrow(/no role .* and no foe of the bestiary/);
    expect(() => fightWaves({}, RIFTED, [{ grunt: 0 }])).toThrow(/a count/);
  });
  it('stand at the rifts in turn, shooters on the perches, every foe once, facing the ring', () => {
    const N = roomNeeds({ feel: KIT });
    const m = composeFight(N, { kind: RIFTED }), pm = fightPlacements({}, m, fightWaves({}, RIFTED));
    const spots = m.anchors.rifts.flatMap((q) => q.spots.map((s) => s.join()));
    expect(spots).toContain(pm[0][0].at.join());
    const ids = pm.flat().map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const g = composeFight(N, { kind: PERCHED }), pg = fightPlacements({}, g, fightCast({}, PERCHED)), R = castRoles({});
    expect(pg[0].filter((f) => f.eid === R.shooter).every((f) => f.at[2] > 1)).toBe(true);
    // a wave larger than its spots is ringed round the ring, never stacked
    const big = fightPlacements({}, m, [{ [R.grunt]: 12 }])[0].map((f) => f.at.join());
    expect(new Set(big).size).toBe(12);
    // a role stands its entry at the role's rank where the bestiary holds none
    expect(fightPlacements({}, m, fightCast({}, RIFTED, [{ boss: 1 }]))[0][0].rank).toBe('boss');
    expect(fightPlacements({}, m, fightCast({}, RIFTED, [{ grunt: 1 }]))[0][0].rank).toBeUndefined();
    const M = fightMechanic(m, pm);
    expect(M.arenas[0].enter.radius).toBe(m.anchors.ring.r);
    expect(M.seals.length).toBe(m.anchors.ways.length - 1);
  });
});

describe('the game room playing a fight', () => {
  const G = { id: 'f', feel: KIT };
  it('composes it for the kit, arms the hero with it, stands its foes asleep and wires the gauntlet', () => {
    const r = gameRoom(G, { fight: RIFTED }), M = r.manifest;
    expect(r.laws.filter((l) => !l.holds)).toEqual([]);
    expect(r.laws.map((l) => l.law)).toEqual(expect.arrayContaining(['ring', 'seen', 'put-back']));
    const hero = M.entities.find((e) => e.pilotable), foes = M.entities.filter((e) => e.team === 'foes');
    expect(hero.rule.moveset).toBeTruthy();
    expect(hero.body.hittable).toBe(true);
    expect(foes.length).toBe(r.fight.placed.flat().length);
    expect(foes.every((e) => e.dormant)).toBe(true);
    expect(M.events.sources.some((s) => s.zone === 'fight-enter-0')).toBe(true);
    expect(M.events.entities.filter((e) => e.type === 'seal').length).toBe(r.room.anchors.ways.length);
    expect(M.events.initial ?? []).toEqual([]);
    expect(r.choices.fights).toEqual(FIGHT_KIND_IDS);
  });
  it('leaves the room as it was where no fight is asked, and refuses one for a world that does not fight', () => {
    const plain = gameRoom(G), again = gameRoom(G, { fight: null });
    expect(JSON.stringify(again.manifest)).toBe(JSON.stringify(plain.manifest));
    expect(plain.fight).toBeUndefined();
    expect(JSON.stringify(plain.manifest)).not.toMatch(/fight-enter|room:ring/);
    expect(() => gameRoom({ id: 'c', feel: POLE_IDS.find((id) => !POLES[id].demo.includes('attack')) }, { fight: RIFTED })).toThrow(/fights hand to hand/);
  });
});

// A GAME'S OWN FIGHTS (`fights`): kept on the world by name, read with it, composed and held to their laws
import { readFights, fightOf } from './fights.js';
import { composedFights, fightsReadout } from './fights-readout.js';
import { GAMEWORLD_KEYS } from './world.js';
describe('a world\'s fights', () => {
  const KEPT = { id: 'k', seed: 5, feel: KIT, fights: { gate: { kind: RIFTED, seed: 9, waves: [{ grunt: 2 }, { grunt: 2, elite: 1 }] }, perch: { kind: PERCHED } } };
  it('are read with the world, each fault taught', () => {
    expect(GAMEWORLD_KEYS).toContain('fights');
    expect(readFights(KEPT.fights, KEPT)).toEqual(KEPT.fights);
    expect(fightOf(KEPT, 'perch').seed).toBe(5);
    for (const [bad, says] of [[{ Gate: { kind: RIFTED } }, /no name/], [{ gate: { kind: 'siege' } }, /kind:/], [{ gate: { kind: RIFTED, seed: 0 } }, /seed is/], [{ gate: { kind: RIFTED, waves: [{ dragon: 1 }] } }, /no role/], [{ gate: { kind: RIFTED, size: 3 } }, /has no 'size'/]]) expect(() => readFights(bad, {}), JSON.stringify(bad)).toThrow(says);
  });
  it('are composed by their kind and seed and played by name in the room', () => {
    const C = composedFights(KEPT);
    expect(C.map((f) => f.name)).toEqual(['gate', 'perch']);
    expect(C[0].room).toEqual(composeFight(roomNeeds(KEPT), { kind: RIFTED, seed: 9 }));
    const r = gameRoom(KEPT, { fight: 'gate' });
    expect(r.fight).toMatchObject({ name: 'gate', kind: RIFTED, seed: 9 });
    expect(r.fight.waves.length).toBe(2);
    expect(r.choices.kept).toEqual(['gate', 'perch']);
  });
  it('are read out: what is kept, what each loses, whether the kit\'s asks are answered; none kept, one of each kind offered', () => {
    const R = fightsReadout(KEPT);
    expect(R.kept.map((f) => f.name)).toEqual(['gate', 'perch']);
    expect(R.kept.every((f) => f.lost.length === 0)).toBe(true);
    expect(R.asked.holds).toBe(true);
    const one = fightsReadout({ ...KEPT, fights: { gate: KEPT.fights.gate } });
    expect(one.asked.holds).toBe(false);
    const none = fightsReadout({ id: 'n', feel: KIT });
    expect(Object.keys(none.suggest.patch[0].value)).toEqual(FIGHT_KIND_IDS);
    expect(fightsReadout({ id: 'c', feel: POLE_IDS.find((id) => !POLES[id].demo.includes('attack')) })).toBeNull();
  });
});
