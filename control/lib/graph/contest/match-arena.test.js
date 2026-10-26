// The court arena: the venue as a stage recipe carrying the court, its geometry in the stage's frame, the page's data
// and the modules the page inlines (one script block that parses, no name declared twice).
import { describe, it, expect } from 'vitest';
import { readMatch, matchCourt, matchManifest, matchArenaData, sportDials, graphSource, COURT_PAGE_MODULES, RUN_OFF } from './match-arena.js';
import { SPORTS, SPORT_IDS, sportOf, tennis } from './sports.js';
import { contestRead } from './contest-kernel.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const FLOOR = { corners: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: '#888' };

describe('the sports and reading a court', () => {
  it('tennis is the book\'s, its spec the kernel reads; the dials carry no code; a sport asked for by a name the book lacks is refused', () => {
    expect(SPORT_IDS).toContain('tennis');
    expect(contestRead(tennis({ sets: 1 })).scoring.ladder.at(-1).to).toBe(1);
    expect(sportOf('tennis').ball).toBe('tennis');
    expect(() => sportOf('quidditch')).toThrow(/sport 'quidditch' is one of tennis/);
    const dials = sportDials('tennis');
    expect(dials.spec).toBeUndefined(); expect(dials).toMatchObject({ id: 'tennis', ball: 'tennis', players: 1, strokes: { fore: 'forehand', back: 'backhand', serve: 'serve' } });
    expect(JSON.parse(JSON.stringify(dials))).toEqual(dials);
    expect(SPORTS.tennis.words.length).toBeGreaterThan(10);
  });
  it('teaches the shape, fills the defaults', () => {
    expect(() => readMatch({ sport: 'squash' })).toThrow(/sport 'squash' is one of tennis/);
    expect(() => readMatch({ players: 3 })).toThrow(/players is 0 \(an exhibition\), 1/);
    expect(() => readMatch({ register: 'arcade' })).toThrow(/register is one of realistic, action/);
    expect(() => readMatch({ level: 'pro' })).toThrow(/level is one of novice, regular, veteran, ace/);
    expect(() => readMatch({ sets: 5 })).toThrow(/sets is 1 to 3/);
    expect(() => readMatch({ net: 1 })).toThrow(/a court has no 'net'/);
    expect(readMatch({})).toMatchObject({ sport: 'tennis', players: 1, register: 'realistic', level: 'regular', sets: 1, seed: 1, kit: 'island-plaza', crowd: { rows: 3, fill: 0.8 } });
    expect(readMatch({ crowd: false, title: 'Centre court' })).toMatchObject({ crowd: false, title: 'Centre court' });
  });
});

describe('the court and the venue', () => {
  it('the court in the stage\'s frame: the singles court\'s halves, the net\'s centre the frame\'s origin, run-off round it', () => {
    const T = matchCourt(readMatch({}));
    expect(T.width).toBeCloseTo(8.23, 6); expect(T.length).toBeCloseTo(23.77, 6);
    expect(T.halfW).toBeCloseTo(4.115, 3); expect(T.halfL).toBeCloseTo(11.885, 3);
    expect(T.room.w).toBe(2 * Math.ceil((8.23 + 2 * RUN_OFF.side) / 2)); expect(T.room.d).toBe(2 * Math.ceil((23.77 + 2 * RUN_OFF.end) / 2));   // the stage's grid: even metres
    expect(T.netY).toBeCloseTo(T.room.d / 2, 3);
    expect(T.net.height).toBe(0.914); expect(Object.keys(T.regions)).toContain('service-right');
  });
  it('the venue is a stage: one open room, the stands behind the far baseline, a broadcast camera behind the near one, the court key', () => {
    const m = matchManifest({ players: 2, seed: 7 });
    expect(m.kind).toBe('stage'); expect(m.rooms[0].open).toEqual(['-y']);
    expect(m.stands).toMatchObject({ rows: 3, fill: 0.8, seed: 7 }); expect(m.stands.from).toBeLessThan(m.rooms[0].d);
    expect(m.camera.name).toBe('broadcast'); expect(m.camera.worldFraming.cameraPosition[1]).toBeLessThan(m.rooms[0].d / 2);
    expect(m.court).toMatchObject({ sport: 'tennis', players: 2, register: 'realistic', sets: 1 });
    expect(m.title).toMatch(/two players/);
    expect(matchManifest({ crowd: false }).stands).toBeUndefined();
  });
  it('the page\'s data and the block it inlines: every module import-free once stripped, one script that parses, no name declared twice', () => {
    const D = matchArenaData({ players: 1, level: 'ace' });
    expect(D.C.shape).toBe('match'); expect(D.sport.id).toBe('tennis'); expect(D.court.halfL).toBeCloseTo(11.885, 3);
    expect(D.wire).toMatchObject({ ready: 'game-ready', outcome: 'game-outcome' });
    const parts = COURT_PAGE_MODULES.map(graphSource);
    for (const [i, src] of parts.entries()) { expect(src, COURT_PAGE_MODULES[i]).not.toMatch(/^import /m); expect(src, COURT_PAGE_MODULES[i]).not.toMatch(/^export /m); }
    const block = parts.join('\n');
    const names = [...block.matchAll(/^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
    expect(() => new Function('THREE', 'scene', 'camera', 'controls', 'wrap', 'window', 'document', 'navigator', 'performance', 'COURT_ARENA', `"use strict"; let __ctrlOwnsCamera = false; let stepCourt; ${block}`)).not.toThrow();
    const page = emitThreeWorld({ faces: [FLOOR], court: D, inline: true, hud: false });
    expect(page).toContain('const COURT_ARENA = '); expect(page).toContain('stepCourt = stepCourtArena'); expect(page).toContain('function buildSim()');
    const bare = emitThreeWorld({ faces: [FLOOR], inline: true, hud: false });
    expect(bare).not.toContain('COURT_ARENA'); expect(bare).not.toContain('stepCourt');
  });
});
