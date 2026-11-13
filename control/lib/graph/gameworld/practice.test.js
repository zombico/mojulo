// THE PRACTICE DOOR (practice.js): which rooms a game's play has, each built from the world alone. One case per procedure:
// a template that fights hand to hand, one that platforms, one that fights on another runtime, one with no room, a world
// that rides, one that shoots, the stealth game, the mech; the platform room's course and foes, the mount lane's horse;
// the mounts suggestion.
import { describe, expect, it } from 'vitest';

import { practiceFor, practiceRoomOf, mountSuggestion, rangeMeasured, PRACTICE_ROOMS, TEMPLATE_FRAMES } from './practice.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { validateRange } from './combat/range.js';
import { validateFrame } from './combat/frames.js';
import { FIGHTS_ELSEWHERE } from './practice-room.js';
import { COURSE } from './platform-room.js';
import { FENCES, LANE_START } from './mount-lane.js';
import { POLES } from './feel/cards.js';

// (templates chosen from the table by what they are, never by name, save the ones the door names itself)
const FIGHTER = Object.keys(POLES).find((id) => POLES[id].demo.includes('attack') && !FIGHTS_ELSEWHERE[id] && POLES[id].base !== 'platformer');
const PLATFORMER = Object.keys(POLES).find((id) => POLES[id].base === 'platformer' && !POLES[id].demo.includes('attack'));
const ELSEWHERE = Object.keys(FIGHTS_ELSEWHERE)[0];
const NONE = Object.keys(POLES).find((id) => !POLES[id].demo.includes('attack') && POLES[id].base !== 'platformer' && !POLES[id].demo.includes('wall') && !POLES[id].demo.includes('stomp') && !TEMPLATE_LOADOUTS[id] && !TEMPLATE_FRAMES[id]);
// (one that shoots and does not fight hand to hand; one that shoots and fights hand to hand, whose close quarters are the
// range's knife; one that owns a frame)
const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => !POLES[id].demo.includes('attack') && POLES[id].base !== 'platformer');
const STEALTH = Object.keys(TEMPLATE_LOADOUTS).find((id) => POLES[id].demo.includes('attack') && FIGHTS_ELSEWHERE[id]);
const MECH = Object.keys(TEMPLATE_FRAMES)[0];

describe('the door', () => {
  it('a template that fights hand to hand has the action room; one that platforms the platform room', () => {
    expect(practiceFor({ feel: FIGHTER }).rooms).toEqual(['practice']);
    expect(practiceFor({ feel: PLATFORMER }).rooms).toEqual(['platform']);
  });
  it('a template whose fights are another runtime\'s has no action room, and says where its practice is', () => {
    const D = practiceFor({ feel: ELSEWHERE });
    expect(D.rooms).not.toContain('practice');
    expect(D.why ?? D.elsewhere).toBe(FIGHTS_ELSEWHERE[ELSEWHERE]);
  });
  it('a world that rides has the mount lane, beside whatever else it has; none at all says why', () => {
    expect(practiceFor({ feel: FIGHTER, mounts: 2 }).rooms).toEqual(['practice', 'mount']);
    expect(practiceFor({ mounts: [{ coat: 'grey' }] }).rooms).toEqual(['mount']);
    expect(practiceFor({ feel: NONE })).toMatchObject({ rooms: [], why: expect.stringMatching(/no practice room yet/) });
    expect(practiceFor({})).toMatchObject({ rooms: [], why: expect.stringMatching(/writes no feel, rides no horse and works no shift/) });
  });
  it('a room the world does not have is refused, in words', () => {
    expect(() => practiceRoomOf({ feel: FIGHTER }, 'mount')).toThrow(/this world has no mount lane \(it has practice\)/);
    expect(() => practiceRoomOf({ feel: FIGHTER }, 'yard')).toThrow(/room is practice, platform, mount, range, artillery, work/);
    expect(Object.keys(PRACTICE_ROOMS)).toEqual(['practice', 'platform', 'mount', 'range', 'artillery', 'work']);
  });
});

describe('the gun rooms', () => {
  it('a template that shoots has the firing range, its loadout the range\'s weapons', () => {
    expect(practiceFor({ feel: SHOOTER }).rooms).toEqual(['range']);
    const { spec } = practiceRoomOf({ id: 'g', feel: SHOOTER }, 'range');
    expect(spec.weapons).toEqual(TEMPLATE_LOADOUTS[SHOOTER].weapons);
    expect(validateRange(spec)).toEqual([]);
  });
  it('the stealth game has the range and not the action room, and says its close quarters are the range\'s knife', () => {
    const D = practiceFor({ feel: STEALTH });
    expect(D.rooms).toEqual(['range']);
    expect(D.elsewhere).toMatch(/knife/);
    expect(practiceRoomOf({ feel: STEALTH }, 'range').spec.weapons).toContainEqual({ name: 'knife', fire: 'melee' });
  });
  it('a world that carries a gun has the range whatever its template; one carrying none under a melee template, none', () => {
    expect(practiceFor({ feel: FIGHTER, quick: { goal: 'shoot', arms: ['rifle'] } }).rooms).toEqual(['practice', 'range']);
    expect(practiceFor({ feel: FIGHTER }).rooms).not.toContain('range');
  });
  it('the range measured on the world\'s guns: its laws carried or lost, the same guns kept, none without a range', () => {
    const G = { id: 'g', quick: { goal: 'shoot', arms: ['rifle'] } };
    const M = rangeMeasured(G);
    expect(M.carried).toBeGreaterThan(0);
    expect(M.lost).toBe(0);
    expect(rangeMeasured({ ...G, id: 'another' })).toBe(M);
    expect(rangeMeasured({ feel: FIGHTER })).toBeNull();
  });
  it('the mech has the artillery range on its own frame, a transforming biped', () => {
    expect(practiceFor({ feel: MECH }).rooms).toEqual(['artillery']);
    const { spec } = practiceRoomOf({ id: 'g', feel: MECH }, 'artillery');
    expect(spec).toMatchObject({ base: { frame: TEMPLATE_FRAMES[MECH].frame }, name: 'g' });
    expect(validateFrame(spec.base)).toEqual([]);
  });
});

describe('the platform room', () => {
  const R = practiceRoomOf({ id: 'g', feel: PLATFORMER }, 'platform'), m = R.manifest;
  it('its course of the moves the feel asks for, a stand-in hero that stomps and is touched, a walker and a hopper', () => {
    expect(m.colliders.length).toBe(COURSE.length + 4);
    const h = m.entities.find((e) => e.pilotable);
    expect(h.rule.stomp).toMatchObject({ low: expect.any(Number), high: expect.any(Number) });
    expect(h.body.hittable).toBe(true);
    expect(R.foes.map((f) => f.class)).toEqual(['walker', 'walker', 'walker', 'hopper']);
    expect(m.entities.filter((e) => e.team === 'foes').map((e) => e.rule.foe?.move)).toEqual(['pace', 'pace', 'pace', 'hop']);
    expect(R.hero).toBe('stand-in');
  });
  it('is the same room every read', () => {
    expect(JSON.stringify(practiceRoomOf({ id: 'g', feel: PLATFORMER }, 'platform').manifest)).toBe(JSON.stringify(m));
  });
});

describe('the mount lane', () => {
  it('the world\'s horse at the start, the hero beside it, the fences across the lane', () => {
    const R = practiceRoomOf({ id: 'g', mounts: [{ coat: 'chestnut' }] }, 'mount'), m = R.manifest;
    expect(m.mounts).toEqual([{ at: LANE_START.horse.slice(0, 2), heading: Math.PI / 2, coat: 'chestnut' }]);
    expect(m.entities.find((e) => e.pilotable).transform.pos).toEqual(LANE_START.hero);
    expect(m.colliders.filter((c) => c.max[2] > 0.1).length).toBe(FENCES.length);
    expect(practiceRoomOf({ id: 'g', mounts: 2 }, 'mount').coat).toBe('bay');
  });
});

describe('mounts, suggested', () => {
  it('a template that rides with no horse yet is suggested two; one written, or a template that does not ride, none', () => {
    const rider = Object.keys(POLES).find((id) => mountSuggestion({ feel: id }));
    expect(mountSuggestion({ feel: rider })).toMatchObject({ suggest: 2 });
    expect(mountSuggestion({ feel: rider, mounts: false })).toBeNull();
    expect(mountSuggestion({ feel: FIGHTER === rider ? PLATFORMER : FIGHTER })).toBeNull();
  });
});
