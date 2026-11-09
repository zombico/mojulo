// THE PRACTICE DOOR (practice.js): which rooms a game's play has, each built from the world alone. One case per procedure:
// a template that fights hand to hand, one that platforms, one that fights on another runtime, one with no room, a world
// that rides; the platform room's course and foes, the mount lane's horse; the mounts suggestion.
import { describe, expect, it } from 'vitest';

import { practiceFor, practiceRoomOf, mountSuggestion, PRACTICE_ROOMS } from './practice.js';
import { FIGHTS_ELSEWHERE } from './practice-room.js';
import { COURSE } from './platform-room.js';
import { FENCES, LANE_START } from './mount-lane.js';
import { POLES } from './feel/cards.js';

// (templates chosen from the table by what they are, never by name, save the ones the door names itself)
const FIGHTER = Object.keys(POLES).find((id) => POLES[id].demo.includes('attack') && !FIGHTS_ELSEWHERE[id] && POLES[id].base !== 'platformer');
const PLATFORMER = Object.keys(POLES).find((id) => POLES[id].base === 'platformer' && !POLES[id].demo.includes('attack'));
const ELSEWHERE = Object.keys(FIGHTS_ELSEWHERE)[0];
const NONE = Object.keys(POLES).find((id) => !POLES[id].demo.includes('attack') && POLES[id].base !== 'platformer' && !POLES[id].demo.includes('wall') && !POLES[id].demo.includes('stomp'));

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
    expect(practiceFor({})).toMatchObject({ rooms: [], why: expect.stringMatching(/writes no feel and rides no horse/) });
  });
  it('a room the world does not have is refused, in words', () => {
    expect(() => practiceRoomOf({ feel: FIGHTER }, 'mount')).toThrow(/this world has no mount lane \(it has practice\)/);
    expect(() => practiceRoomOf({ feel: FIGHTER }, 'yard')).toThrow(/room is practice, platform, mount/);
    expect(Object.keys(PRACTICE_ROOMS)).toEqual(['practice', 'platform', 'mount']);
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
