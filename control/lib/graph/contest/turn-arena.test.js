// The turn arena: the venue as a stage recipe carrying the game, the course in the stage's frame, the page's data and
// the modules the page inlines (one script block that parses, no name declared twice).
import { describe, it, expect } from 'vitest';
import { readTurns, turnsCourse, turnsManifest, turnsArenaData, turnSportDials, TURNS_PAGE_MODULES, COURSE_RUN_OFF } from './turn-arena.js';
import { graphSource } from './match-arena.js';
import { SPORTS, TURN_SPORT_IDS, MATCH_SPORT_IDS, golf, bowling, GOLF_HOLES, PIN_SPOTS } from './sports.js';
import { contestRead } from './contest-kernel.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const FLOOR = { corners: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: '#888' };

describe('the book\'s turn sports and reading a game', () => {
  it('golf and bowling are the book\'s turn sports, their specs the kernel reads; the dials carry no code; the court refuses them', () => {
    expect(TURN_SPORT_IDS).toEqual(['golf', 'bowling']); expect(MATCH_SPORT_IDS[0]).toBe('tennis'); expect(MATCH_SPORT_IDS.filter((id) => TURN_SPORT_IDS.includes(id))).toEqual([]);
    expect(contestRead(golf({ holes: 2 })).rounds.map((r) => r.par)).toEqual(GOLF_HOLES.slice(0, 2).map((h) => h.par));
    expect(() => golf({ holes: 9 })).toThrow(/golf plays 1 to 3 holes/); expect(() => bowling({ frames: 12 })).toThrow(/bowling is 1 to 10 frames/);
    expect(contestRead(bowling({ frames: 3 })).rounds.length).toBe(3);
    expect(PIN_SPOTS.length).toBe(10); expect(PIN_SPOTS[0]).toEqual([0, 18.29]);
    for (const id of TURN_SPORT_IDS) { const d = turnSportDials(id); expect(d.spec).toBeUndefined(); expect(JSON.parse(JSON.stringify(d))).toEqual(d); expect(SPORTS[id].words.length).toBeGreaterThan(10); }
  });
  it('teaches the shape, fills the defaults', () => {
    expect(() => readTurns({ sport: 'tennis' })).toThrow(/sport 'tennis' is one of golf, bowling/);
    expect(() => readTurns({ seats: 9 })).toThrow(/seats is 1 to 8/);
    expect(() => readTurns({ seats: 2, players: 3 })).toThrow(/players is 0 to the seats \(2\)/);
    expect(() => readTurns({ register: 'arcade' })).toThrow(/register is one of realistic, action/);
    expect(() => readTurns({ level: 'pro' })).toThrow(/level is one of novice, regular, veteran, ace/);
    expect(() => readTurns({ sport: 'golf', rounds: 4 })).toThrow(/rounds for golf is 1 to 3 \(the holes\)/);
    expect(() => readTurns({ sport: 'bowling', rounds: 11 })).toThrow(/rounds for bowling is 1 to 10 \(the frames\)/);
    expect(() => readTurns({ net: 1 })).toThrow(/a turn sport has no 'net'/);
    expect(readTurns({})).toMatchObject({ sport: 'golf', seats: 1, players: 1, register: 'realistic', level: 'regular', rounds: 3, seed: 1, kit: 'island-plaza', crowd: { rows: 3, fill: 0.8 } });
    expect(readTurns({ sport: 'bowling', seats: 2, players: 0, crowd: false, title: 'Lane 7' })).toMatchObject({ rounds: 10, players: 0, crowd: false, title: 'Lane 7' });
  });
});

describe('the course and the venue', () => {
  it('the course in the stage\'s frame: the room holds the largest round with run-off, the origin at its middle', () => {
    const T = turnsCourse(readTurns({ sport: 'golf' }));
    expect(T.width).toBe(60); expect(T.depth).toBe(340);
    expect(T.room.w).toBe(2 * Math.ceil((60 + 2 * COURSE_RUN_OFF.side) / 2)); expect(T.room.d).toBe(2 * Math.ceil((340 + 2 * COURSE_RUN_OFF.end) / 2));
    expect(T.originY).toBeCloseTo(T.room.d / 2, 6); expect(T.rounds.map((r) => r.par)).toEqual([3, 4, 3]);
    const L = turnsCourse(readTurns({ sport: 'bowling', rounds: 1 }));
    expect(L.rounds[0].regions).toEqual(['approach', 'lane', 'gutter-left', 'gutter-right', 'pit']);
  });
  it('the venue is a stage: one open room, the stands behind the far end, a camera behind the tee, the turns key', () => {
    const m = turnsManifest({ sport: 'bowling', seats: 2, players: 1, rounds: 5, seed: 7 });
    expect(m.kind).toBe('stage'); expect(m.rooms[0].open).toEqual(['-y']);
    expect(m.stands).toMatchObject({ rows: 3, fill: 0.8, seed: 7 }); expect(m.stands.from).toBeLessThan(m.rooms[0].d);
    expect(m.camera.name).toBe('follow'); expect(m.camera.worldFraming.cameraPosition[1]).toBeLessThan(m.rooms[0].d / 2);
    expect(m.turns).toMatchObject({ sport: 'bowling', seats: 2, players: 1, rounds: 5 });
    expect(m.title).toMatch(/you against the computer/);
    expect(turnsManifest({ crowd: false }).stands).toBeUndefined();
  });
  it('the page\'s data and the block it inlines: every module import-free once stripped, one script that parses, no name declared twice', () => {
    const D = turnsArenaData({ sport: 'golf', seats: 2, players: 1, rounds: 2 });
    expect(D.C.shape).toBe('turns'); expect(D.C.players).toBe(2); expect(D.sport.id).toBe('golf'); expect(D.course.rounds.length).toBe(2);
    expect(D.wire).toMatchObject({ ready: 'game-ready', outcome: 'game-outcome' });
    const parts = TURNS_PAGE_MODULES.map(graphSource);
    for (const [i, src] of parts.entries()) { expect(src, TURNS_PAGE_MODULES[i]).not.toMatch(/^import /m); expect(src, TURNS_PAGE_MODULES[i]).not.toMatch(/^export /m); }
    const block = parts.join('\n');
    const names = [...block.matchAll(/^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
    expect(() => new Function('THREE', 'scene', 'camera', 'controls', 'wrap', 'window', 'document', 'navigator', 'performance', 'TURNS_ARENA', `"use strict"; let __ctrlOwnsCamera = false; let stepTurnSport; ${block}`)).not.toThrow();
    const page = emitThreeWorld({ faces: [FLOOR], turns: D, inline: true, hud: false });
    expect(page).toContain('const TURNS_ARENA = '); expect(page).toContain('stepTurnSport = stepTurnsArena'); expect(page).toContain('function buildContest()');
    const bare = emitThreeWorld({ faces: [FLOOR], inline: true, hud: false });
    expect(bare).not.toContain('TURNS_ARENA'); expect(bare).not.toContain('stepTurnSport');
  });
});
