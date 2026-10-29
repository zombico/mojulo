// The rooms' roles (compose-roles.js): read from the plan's graph, a hand-laid stage's and a program's alike; the focus
// where the room is built to be looked at; the pockets few; a pinned role kept; nothing when nothing is composed.
import { describe, expect, it } from 'vitest';
import { ROLES } from './compose-roles.js';
import { PROGRAMS, PROGRAM_IDS, withProgram } from './programs.js';
import { CONSTRUCTIONS } from './style/bay-axes.js';
import { COMPOSE_WORDS } from './compose.js';
import { planStage } from './stage.js';

const roleOf = (p, id) => p.compose.roles.find((r) => r.room === id);
const SUITE = { kind: 'stage', kit: 'bay-military', compose: 'a hangar', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] };
// (a building with an annex, chosen from the table)
const USE = PROGRAM_IDS.find((u) => PROGRAMS[u].shape === 'core' && PROGRAMS[u].annex);

describe('the rooms\' roles', () => {
  it('a hand-laid stage: the way in shows the way on; the great room is looked at across from its doorway', () => {
    const p = planStage(SUITE), low = roleOf(p, 'low'), tall = roleOf(p, 'tall');
    expect([low.role, tall.role]).toEqual(['arrival', 'landmark']);
    expect(low.focus).toEqual([3, 12, 1.5]);                                 // the doorway between them
    expect(tall.focus.slice(0, 2)).toEqual([3, 41.75 - 1.5]);                 // straight across, short of the far wall
    expect(tall.setPiece).toBe(ROLES.landmark.setPiece);
  });

  it('a building: its goal the climax, its first way in the arrival, its stairs passages, its annex the landmark, few pockets', () => {
    const p = planStage(withProgram({ kind: 'stage', program: { use: USE, storeys: 2, bays: 2 }, compose: 'a warehouse' })), R = p.compose.roles;
    expect(roleOf(p, PROGRAMS[USE].roles.goal).role).toBe('climax');
    expect(R.filter((r) => r.role === 'arrival').map((r) => r.room)).toEqual([p.ways[0].room]);
    for (const s of p.stairs) expect([roleOf(p, s.lower).role, roleOf(p, s.upper).role]).toEqual(['passage', 'passage']);
    expect(roleOf(p, PROGRAMS[USE].annex.role).role).toBe('landmark');
    for (const st of [0, 1]) expect(R.filter((r) => r.role === 'pocket' && (p.rooms.find((x) => x.id === r.room).storey ?? 0) === st).length).toBeLessThanOrEqual(2);
  });

  it('a pinned role is kept; a room or a role it does not know is refused', () => {
    expect(roleOf(planStage({ ...SUITE, compose: { words: 'a hangar', roles: { tall: 'rest' } } }), 'tall').role).toBe('rest');
    expect(() => planStage({ ...SUITE, compose: { roles: { attic: 'rest' } } })).toThrow(/compose.roles.attic: no such room/);
    expect(() => planStage({ ...SUITE, compose: { roles: { tall: 'boss' } } })).toThrow(/compose.roles.tall is/);
  });

  it('a stage not composed carries none of it', () => {
    const { compose, ...bare } = SUITE;
    expect('compose' in planStage(bare)).toBe(false);
  });
});

describe('a composed building is laid for the kit it composes', () => {
  it('a construction with wider doors than the use\'s own kit still lays its corridors', () => {
    const use = PROGRAM_IDS.find((u) => PROGRAMS[u].shape === 'core' && PROGRAMS[u].kit), own = PROGRAMS[use].kit.slice(4);
    const width = (c) => (CONSTRUCTIONS[c].door?.width ?? 2.4), wider = Object.keys(CONSTRUCTIONS).find((c) => width(c) > width(own));
    expect(wider).toBeDefined();
    const p = planStage(withProgram({ kind: 'stage', program: { use, storeys: 1 }, compose: { construction: wider } }));
    expect(p.compose.axes.construction).toBe(wider);
    expect(p.kit.door.width).toBe(width(wider));
  });
});
