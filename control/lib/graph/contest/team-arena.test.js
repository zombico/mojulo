// The team arena: the venue as a stage recipe carrying the game, the pitch in the stage's frame, the page's data and
// the modules the page inlines (one script block that parses, no name declared twice).
import { describe, it, expect } from 'vitest';
import { readTeam, teamPitch, teamManifest, teamArenaData, teamSportDials, PITCH_PAGE_MODULES, PITCH_RUN_OFF } from './team-arena.js';
import { graphSource } from './match-arena.js';
import { TEAM_SPORTS, TEAM_SPORT_IDS, soccer, hockey } from './sports.js';
import { contestRead } from './contest-kernel.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const FLOOR = { corners: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: '#888' };

describe('the book\'s team games and reading one', () => {
  it('soccer and hockey are the book\'s team games, their specs the kernel reads (outs and offside the soccer\'s, boards the hockey\'s); the dials carry no code', () => {
    expect(TEAM_SPORT_IDS).toEqual(['soccer', 'hockey']);
    const S = contestRead(soccer()), H = contestRead(hockey());
    expect(S.outs).toEqual({ side: 'throw-in', end: 'corner' }); expect(S.offside).toBe('ball'); expect(S.players).toBe(5);
    expect(H.outs).toBeNull(); expect(H.offside).toBeNull(); expect(H.clock.overtime).toBe(60); expect(H.players).toBe(4);
    for (const id of TEAM_SPORT_IDS) { const d = teamSportDials(id); expect(d.spec).toBeUndefined(); expect(JSON.parse(JSON.stringify(d))).toEqual(d); expect(Object.keys(d.homes)).toEqual(Object.keys(contestRead(TEAM_SPORTS[id].spec()).roles)); }
  });
  it('teaches the shape, fills the defaults', () => {
    expect(() => readTeam({ sport: 'tennis' })).toThrow(/sport 'tennis' is one of soccer, hockey/);
    expect(() => readTeam({ players: 3 })).toThrow(/players is 0 \(an exhibition\), 1/);
    expect(() => readTeam({ register: 'arcade' })).toThrow(/register is one of realistic, action/);
    expect(() => readTeam({ periods: 9 })).toThrow(/periods is 1 to 4/);
    expect(() => readTeam({ seconds: 5 })).toThrow(/seconds is 20 to 900/);
    expect(() => readTeam({ net: 1 })).toThrow(/a team game has no 'net'/);
    expect(readTeam({})).toMatchObject({ sport: 'soccer', players: 1, register: 'realistic', level: 'regular', seed: 1, kit: 'island-plaza', crowd: { rows: 3, fill: 0.8 } });
    expect(readTeam({ sport: 'hockey', players: 2, periods: 1, seconds: 45, crowd: false })).toMatchObject({ sport: 'hockey', periods: 1, seconds: 45, crowd: false });
  });
});

describe('the pitch and the venue', () => {
  it('the pitch in the stage\'s frame: its halves, the goal, the origin at its centre, run-off round it', () => {
    const T = teamPitch(readTeam({}));
    expect(T.halfW).toBe(15); expect(T.halfL).toBe(25); expect(T.goal).toEqual({ width: 4, height: 2 }); expect(T.boards).toBe(false);
    expect(T.room.w).toBeCloseTo(30 + 2 * PITCH_RUN_OFF.side, 6); expect(T.originY).toBeCloseTo(T.room.d / 2, 6);
    expect(teamPitch(readTeam({ sport: 'hockey' })).boards).toBe(true);
  });
  it('the venue is a stage: one open room, the stands behind the far goal, a camera behind the near one, the pitch key', () => {
    const m = teamManifest({ players: 2, seed: 7 });
    expect(m.kind).toBe('stage'); expect(m.rooms[0].open).toEqual(['-y']);
    expect(m.stands).toMatchObject({ rows: 3, fill: 0.8, seed: 7 }); expect(m.camera.name).toBe('end');
    expect(m.pitch).toMatchObject({ sport: 'soccer', players: 2 }); expect(m.title).toMatch(/two players/);
    expect(teamManifest({ crowd: false }).stands).toBeUndefined();
  });
  it('the page\'s data and the block it inlines: every module import-free once stripped, one script that parses, no name declared twice', () => {
    const D = teamArenaData({ sport: 'hockey', players: 1 });
    expect(D.C.shape).toBe('match'); expect(D.sport.id).toBe('hockey'); expect(D.court.halfL).toBe(30);
    expect(D.wire).toMatchObject({ ready: 'game-ready', outcome: 'game-outcome' });
    const parts = PITCH_PAGE_MODULES.map(graphSource);
    for (const [i, src] of parts.entries()) { expect(src, PITCH_PAGE_MODULES[i]).not.toMatch(/^import /m); expect(src, PITCH_PAGE_MODULES[i]).not.toMatch(/^export /m); }
    const block = parts.join('\n');
    const names = [...block.matchAll(/^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
    expect(() => new Function('THREE', 'scene', 'camera', 'controls', 'wrap', 'window', 'document', 'navigator', 'performance', 'PITCH_ARENA', `"use strict"; let __ctrlOwnsCamera = false; let stepPitch; ${block}`)).not.toThrow();
    const page = emitThreeWorld({ faces: [FLOOR], pitch: D, inline: true, hud: false });
    expect(page).toContain('const PITCH_ARENA = '); expect(page).toContain('stepPitch = stepPitchArena');
    const bare = emitThreeWorld({ faces: [FLOOR], inline: true, hud: false });
    expect(bare).not.toContain('PITCH_ARENA'); expect(bare).not.toContain('stepPitch');
  });
});
