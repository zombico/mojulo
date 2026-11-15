// THE MISSION, COMPOSED (lib/graph/mission): a shooter's first level laid from what the world carries. One case a
// procedure, each chosen from the tables in code: a kit that serves the mid band and no further (a feel template's), a
// kit with a long gun (the long line too), close guns alone, sections written by hand. The concepts: the brief
// reads the bands; the same seed lays the same mission; another seed another; the laws hold on what is laid and say so
// when a hand-written order breaks them; a world with no gun has no mission.
import { describe, expect, it } from 'vitest';

import { missionBrief, readMission, composeMission, missionLaws, missionWalls, missionGrid, SECTIONS, SECTION_IDS, BANDS, ARCHETYPE_BAND, MISSION_LIMITS } from './index.js';
import { TEMPLATE_LOADOUTS } from '../gameworld/loadout.js';
import { ARMS_KIT } from '../gameworld/arms-kit.js';

// (a template whose guns are kit words alone; a kit word carried for each band, read off the archetypes)
const TEMPLATE = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string'));
const wordFor = (band) => Object.keys(ARMS_KIT).find((w) => ARCHETYPE_BAND[ARMS_KIT[w].as] === band && !ARMS_KIT[w].bow);
const LONG = wordFor('long'), CLOSE = wordFor('close'), MID = wordFor('mid');
const quick = (arms) => ({ quick: { goal: 'shoot', arms } });
const held = (M, B) => missionLaws(M, B).filter((l) => !l.holds).map((l) => l.law);

describe('the brief', () => {
  it('reads the kit\'s bands, and the sections they ask for', () => {
    const mid = missionBrief({ feel: TEMPLATE });
    expect(mid.serves).toEqual({ close: true, mid: true, long: false });
    expect(mid.sections).toEqual(['staging', 'contact', 'lane', 'holdout', 'extract']);
    // a long gun: the long line too; close guns alone: a room and a yard
    expect(missionBrief(quick([LONG, CLOSE])).sections).toContain('overwatch');
    expect(missionBrief(quick([CLOSE])).sections).toEqual(['staging', 'contact', 'holdout', 'extract']);
    // (and its yard is held across a room: the band its guns reach)
    expect([missionBrief(quick([CLOSE])).yard, mid.yard]).toEqual(['close', 'mid']);
    // each need says why
    for (const k of ['guns', 'run', 'width', 'sections', 'foes']) expect(typeof mid.why[k]).toBe('string');
  });
  it('a world that carries no gun has no mission', () => {
    expect(missionBrief({})).toBeNull();
  });
  it('a level\'s `mission` is read, and a wrong one taught', () => {
    expect(readMission(true)).toEqual({});
    expect(readMission({ foes: 5, hold: 60 })).toEqual({ foes: 5, hold: 60 });
    // (a section designed and not built is a gap, said with what it waits on, never laid half)
    const GAP = SECTION_IDS.find((id) => SECTIONS[id].gap);
    expect(() => readMission({ gun: true })).toThrow(/designed, not built/);
    expect(() => readMission({ sections: ['staging', GAP, 'extract'] })).toThrow(/designed, not built/);
    expect(missionBrief({ feel: TEMPLATE }).sections).not.toContain(GAP);
    expect(() => readMission({ sections: ['staging', 'nave'] })).toThrow(/not a section/);
    expect(() => readMission({ sections: ['staging', 'contact'] })).toThrow(/no way out/);
    expect(() => readMission({ foes: MISSION_LIMITS.foes[1] + 1 })).toThrow(/foes is/);
    expect(() => readMission({ pace: 2 })).toThrow(/not a mission setting/);
  });
});

describe('the composition', () => {
  const B = missionBrief(quick([LONG, MID])), M = composeMission(B, { seed: 5 });
  it('lays the sections end to end, a doorway between each, on alternate sides', () => {
    expect(M.sections.map((s) => s.kind)).toEqual(B.sections);
    M.sections.forEach((s, k) => { expect(s.x[0]).toBe(k ? M.sections[k - 1].x[1] : 0); });
    const doors = M.sections.filter((s) => s.door).map((s) => Math.sign(s.door.at[1]));
    expect(doors.length).toBe(M.sections.length - 1);
    doors.forEach((d, k) => { if (k) expect(d).toBe(-doors[k - 1]); });
    expect(M.length).toBe(M.sections.at(-1).x[1]);
  });
  it('gives each section the task its row names, its foes named once', () => {
    for (const s of M.sections) expect(s.task.kind).toBe(SECTIONS[s.kind].task);
    const ids = M.sections.flatMap((s) => s.foes.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    const yard = M.sections.find((s) => s.task.kind === 'hold');
    expect(yard.task.waves.flat().sort()).toEqual(yard.foes.map((f) => f.id).sort());
  });
  it('is its seed\'s: the same seed the same mission, another seed another', () => {
    expect(JSON.stringify(composeMission(B, { seed: 5 }))).toBe(JSON.stringify(M));
    expect(JSON.stringify(composeMission(B, { seed: 6 }))).not.toBe(JSON.stringify(M));
  });
  it('scales its fights with the foes asked', () => {
    const more = composeMission(missionBrief(quick([MID]), { foes: MISSION_LIMITS.foes[1] }), { seed: 5 });
    const lane = (X) => X.sections.find((s) => s.kind === 'lane').foes.length;
    expect(lane(more)).toBeGreaterThan(lane(composeMission(missionBrief(quick([MID])), { seed: 5 })));
  });
});

describe('the laws', () => {
  it('hold on what the brief lays, for each kind of kit', () => {
    for (const [G, spec] of [[{ feel: TEMPLATE }, {}], [quick([LONG, CLOSE]), {}], [quick([CLOSE]), {}]]) {
      const B = missionBrief(G, spec), M = composeMission(B, { seed: 2 });
      expect(held(M, B)).toEqual([]);
    }
  });
  it('say what a hand-written order breaks: a fight first, a band no gun is for, the bands out of order', () => {
    const B = missionBrief(quick([MID]), readMission({ sections: ['contact', 'overwatch', 'lane', 'extract'] }));
    const bad = held(composeMission(B, { seed: 1 }), B);
    expect(bad).toEqual(expect.arrayContaining(['in-order', 'armed']));
  });
  it('seal each task: with a way on shut, nothing past it is walked to', () => {
    const B = missionBrief({ feel: TEMPLATE }), M = composeMission(B, { seed: 2 });
    const open = missionGrid(M), shut = missionGrid(M, { shut: [0] });
    const next = M.sections[1].entry;
    expect(open.reaches(open.flood(M.anchors.spawn), next, 0.8)).toBe(true);
    expect(shut.reaches(shut.flood(M.anchors.spawn), next, 0.8)).toBe(false);
    // (a shut door is one wall across; an open one two with the doorway between)
    expect(missionWalls(M, { shut: [0] }).filter((w) => w.id.startsWith('cross-0')).length).toBe(1);
    expect(missionWalls(M).filter((w) => w.id.startsWith('cross-0')).length).toBe(2);
  });
});

describe('the tables', () => {
  it('every section names a task and, where it fights, a band; every band its metres inside its reach', () => {
    for (const id of SECTION_IDS) { const S = SECTIONS[id]; expect(typeof S.teaches).toBe('string'); expect(S.fight).toBe(!!S.band); if (S.band) expect(BANDS[S.band]).toBeTruthy(); }
    for (const b of Object.values(BANDS)) { expect(b.m).toBeGreaterThanOrEqual(b.reach[0]); expect(b.m).toBeLessThanOrEqual(b.reach[1]); }
  });
});
