// The meet arena: the venue as a stage recipe carrying the meet, its track in the stage's frame, the page's data.
import { describe, it, expect } from 'vitest';
import { readMeet, meetTrack, meetManifest, meetArenaData, meetSpec, MEET_EVENTS, MEET_EVENT_IDS, LANE_W, LANE_Y0, RUN_IN, contestSource } from './meet-arena.js';
import { contestRead } from './contest-kernel.js';
import { emitThreeWorld } from '../scene/scene-three.js';

describe('reading a meet', () => {
  it('teaches the shape, fills the event\'s defaults', () => {
    expect(() => readMeet({ event: 'marathon' })).toThrow(/event 'marathon' is one of sprint, hurdles, longJump/);
    expect(() => readMeet({ event: 'sprint', lanes: 9 })).toThrow(/lanes is 1 to 8/);
    expect(() => readMeet({ event: 'sprint', lanes: 2, players: 3 })).toThrow(/players \(3\) is at most the lanes \(2\)/);
    expect(() => readMeet({ event: 'sprint', distance: 20 })).toThrow(/distance for sprint is 40 to 400 m/);
    expect(() => readMeet({ event: 'sprint', attempts: 3 })).toThrow(/sprint is a race: it has no attempts/);
    expect(() => readMeet({ event: 'sprint', register: 'arcade' })).toThrow(/register is one of realistic, action/);
    expect(() => readMeet({ event: 'sprint', wind: 2 })).toThrow(/a meet has no 'wind'/);
    expect(readMeet({})).toMatchObject({ event: 'sprint', lanes: 4, players: 1, register: 'realistic', distance: 100, seed: 1, kit: 'island-plaza', crowd: { rows: 3, fill: 0.8 } });
    expect(readMeet({ event: 'longJump', crowd: false })).toMatchObject({ distance: 40, attempts: 3, crowd: false });
    for (const id of MEET_EVENT_IDS) expect(MEET_EVENTS[id].words.length, id).toBeGreaterThan(10);
  });
  it('the contest kernel reads the meet\'s spec: lanes, the measure, the attempts', () => {
    const C = contestRead(meetSpec(readMeet({ event: 'longJump', lanes: 3, attempts: 2 })));
    expect(C.event).toMatchObject({ kind: 'longJump', lanes: 3, measure: 'distance', attempts: 2, best: 'high' });
    expect(contestRead(meetSpec(readMeet({ event: 'hurdles' }))).event).toMatchObject({ measure: 'time', attempts: 1 });
  });
});

describe('the track and the venue', () => {
  it('the lanes along x at their y, the start after the run-in, the finish at the distance, the flights spaced as the hurdles are', () => {
    const M = readMeet({ event: 'hurdles', lanes: 3, distance: 110 }), T = meetTrack(M);
    expect(T.lanesY).toEqual([LANE_Y0 + 0.5 * LANE_W, LANE_Y0 + 1.5 * LANE_W, LANE_Y0 + 2.5 * LANE_W].map((v) => Math.round(v * 1000) / 1000));
    expect(T.x0).toBe(-T.room.w / 2 + RUN_IN); expect(T.finish).toBeCloseTo(T.x0 + 110, 6);
    expect(T.hurdles.length).toBe(10); expect(T.hurdles[0]).toBeCloseTo(13.72, 3); expect(T.hurdles[1] - T.hurdles[0]).toBeCloseTo(9.14, 3);
    expect(T.hurdles.at(-1)).toBeLessThan(108);
    // a short hurdles race keeps only the flights before its line
    expect(meetTrack(readMeet({ event: 'hurdles', distance: 60 })).hurdles.length).toBe(5);
    const J = meetTrack(readMeet({ event: 'longJump' }));
    expect(J.board).toBe(40); expect(J.boardX).toBeCloseTo(J.x0 + 40, 6); expect(J.hurdles).toEqual([]);
  });
  it('the venue is a stage: one open room the track long, the stands behind the lanes, a broadcast camera, the meet key', () => {
    const m = meetManifest({ event: 'sprint', lanes: 4, players: 2, seed: 7 });
    expect(m.kind).toBe('stage'); expect(m.rooms.length).toBe(1); expect(m.rooms[0].open).toEqual(['-y']);
    expect(m.rooms[0].w).toBeGreaterThan(100); expect(m.rooms[0].d).toBe(2 * Math.ceil((LANE_Y0 * 2 + 4 * LANE_W) / 2));   // the stage's grid: even metres
    expect(m.stands).toMatchObject({ rows: 3, fill: 0.8, seed: 7 }); expect(m.stands.from).toBeLessThan(m.rooms[0].d);
    expect(m.camera.name).toBe('broadcast');
    expect(m.meet).toMatchObject({ event: 'sprint', lanes: 4, players: 2, register: 'realistic', distance: 100 });
    expect(meetManifest({ event: 'sprint', crowd: false }).stands).toBeUndefined();
  });
  it('the page\'s data: the meet, its track, the compiled contest, the wire; the channel inlines the kernel and the sim', () => {
    const D = meetArenaData({ event: 'hurdles', lanes: 3, players: 1 });
    expect(D.C.shape).toBe('meet'); expect(D.C.event.lanes).toBe(3);
    expect(D.event).toMatchObject({ kind: 'hurdles', measure: 'time', distance: 110 }); expect(D.event.hurdles.length).toBe(10);
    expect(D.wire).toMatchObject({ ready: 'game-ready', init: 'game-init', outcome: 'game-outcome' });
    for (const f of ['contest-kernel.js', 'meet-sim.js']) { const src = contestSource(f); expect(src).not.toMatch(/^import /m); expect(src).not.toMatch(/^export /m); }
    const page = emitThreeWorld({ faces: [{ corners: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: '#888' }], meet: D, inline: true, hud: false });
    expect(page).toContain('const MEET_ARENA = '); expect(page).toContain('stepContest = stepMeetArena'); expect(page).toContain('function buildContest()');
    const bare = emitThreeWorld({ faces: [{ corners: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: '#888' }], inline: true, hud: false });
    expect(bare).not.toContain('MEET_ARENA'); expect(bare).not.toContain('stepContest');
  });
});
