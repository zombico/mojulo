import { describe, it, expect, vi } from 'vitest';
import { PROBE, DEBUG_TEXT, opposition, probeVerdict, scriptInput, probeLevel, mergeVerdicts } from './level-probe.js';

// The play probe (level-probe.js): a level played for a few seconds and four things said of it. Each check is held to
// the starters that failed it in play (a page that throws at load, a guard where the hero spawns, a survive level with
// nothing in it, an end card's debugging line); the browser is stubbed (test the gate itself with a stub, CLAUDE.md).

const stage = (mechanics = [], entities = []) => ({ game: { mechanics: mechanics.map((kind) => ({ kind })) }, entities });
const ok = (extra = {}) => ({ ref: 's1', errors: [], startedLost: null, debug: [], frames: [], opposition: { needs: false, has: [] }, ...extra });

describe('what a level has to play against', () => {
  it('a survive or fight level needs something against it; a walk to the exit does not', () => {
    expect(opposition(stage(['reach-exit']))).toEqual({ needs: false, has: [] });
    const empty = opposition(stage(['survive']));
    expect(empty.needs).toBe(true);
    expect(empty.says).toMatch(/its goal \(survive\) needs something to play against/);
    expect(opposition(stage(['survive', 'hazard-damage'])).says).toBeUndefined();
    // a foe is an entity that is not the player's and fights: an AI rule or a weapon
    const foe = { id: 'g', rule: { type: 'ai', mind: { motivation: 'hunt' } } };
    expect(opposition(stage(['defeat-all'], [foe, { id: 'hero', pilotable: true, rule: { type: 'ai' } }])).has).toEqual(['defeat-all', '1 foe(s)']);
  });

  it('a level\'s own goal asks too: a boss, guards, health', () => {
    expect(opposition(stage(['reach-exit']), { goal: { boss: true } }).says).toMatch(/\(boss\) needs something to play against/);
    expect(opposition(stage(['reach-exit']), { goal: { collect: true } }).needs).toBe(false);
  });
});

describe('the verdict', () => {
  it('a sound level holds on every check', () => {
    const v = probeVerdict([ok()]);
    expect(v).toMatchObject({ gate: 'machine', holds: true });
    expect(v.checks.map((c) => c.check)).toEqual(['loads', 'not lost', 'opposed', 'clean', 'sees']);
    expect(v.note).toMatch(/eyes gate .* has not run/);
  });

  it('each starter that failed in play fails its check, said by stage', () => {
    const failing = (s) => probeVerdict([ok(s)]).checks.filter((c) => !c.holds);
    expect(failing({ errors: ["Cannot access '__groundRay' before initialization"] })).toEqual([{ check: 'loads', holds: false, says: "s1: it threw: Cannot access '__groundRay' before initialization" }]);
    expect(failing({ startedLost: 'ended (fail) standing still' })[0]).toMatchObject({ check: 'not lost', says: 's1: it was over before any input: ended (fail) standing still' });
    expect(failing({ opposition: opposition(stage(['survive'])) })[0].check).toBe('opposed');
    expect(failing({ debug: ['0 events → store'] })[0]).toMatchObject({ check: 'clean', says: 's1: it shows "0 events → store"' });
    expect(failing({ error: 'Navigation timeout' })[0]).toMatchObject({ check: 'loads', says: 's1: Navigation timeout' });
    // a camera that turns to an empty sky partway (the real run's stage 2 at 11 s): one colour over the first-frame
    // check's threshold, read off the world's canvas
    const sky = { at: 11, colour: { share: 0.97, color: '#3a7aa8' } };
    expect(failing({ frames: [{ at: 5, colour: { share: 0.4, color: '#556644' } }, sky] })).toEqual([{ check: 'sees', holds: false, says: 's1: at 11 s one colour (#3a7aa8) covers 97% of the frame: the camera looks at nothing' }]);
    // a frame read without its canvas is said by nothing: the other checks still hold
    expect(failing({ frames: [{ at: 5 }] })).toEqual([]);
  });

  it('the debugging text it looks for is the kind a player must never see', () => {
    const hit = (t) => DEBUG_TEXT.some((re) => re.test(t));
    expect(hit('Level complete · 0 events → store')).toBe(true);
    expect(hit('Score: NaN')).toBe(true);
    expect(hit('[object Object]')).toBe(true);
    expect(hit('Level complete · 3 relics')).toBe(false);
  });

  it('no browser: skipped, never holding; nothing to play: said', () => {
    expect(probeVerdict([ok({ skipped: 'skipped: no browser' })])).toMatchObject({ holds: false, skipped: 'skipped: no browser' });
    expect(probeVerdict([])).toMatchObject({ holds: false, note: expect.stringMatching(/no stage to play/) });
  });

  it('a composed stage\'s laws that advise are kept, by stage, played or not; they are not the probe\'s own checks', () => {
    const composed = [{ law: 'lit', says: 'side: under 0.2 of the rooms\' mean light' }];
    const v = probeVerdict([ok({ ref: 's1', composed })]);
    expect(v).toMatchObject({ holds: true, composed: [{ ref: 's1', law: 'lit', says: expect.stringMatching(/^side/) }] });
    expect(v.checks.map((c) => c.check)).not.toContain('lit');
    expect(probeVerdict([ok({ ref: 's1', composed, skipped: 'skipped: no browser' })]).composed).toHaveLength(1);
    expect(probeVerdict([ok()]).composed).toBeUndefined();
  });
});

describe('a chapter\'s levels as one verdict', () => {
  it('holds where every level holds, says which level does not, and keeps every level\'s frames and composed laws', () => {
    const ok = probeVerdict([{ ref: 'a-0', opposition: { says: null }, frames: [{ at: 1, png: 'x' }] }]);
    const lost = probeVerdict([{ ref: 'b-0', startedLost: 'fell', opposition: { says: null }, composed: [{ law: 'room', says: 'tight' }] }]);
    const both = mergeVerdicts([['town', ok], ['shrine', lost]]);
    expect(both.holds).toBe(false);
    expect(both.checks.find((c) => c.check === 'not lost').says).toBe('shrine: b-0: it was over before any input: fell');
    expect(both.checks.find((c) => c.check === 'loads').holds).toBe(true);
    expect(both.frames).toHaveLength(1);
    expect(both.composed).toEqual([{ ref: 'b-0', law: 'room', says: 'tight' }]);
    expect(mergeVerdicts([['town', ok], ['shrine', ok]]).holds).toBe(true);
    // a level no browser played does not hold the chapter
    expect(mergeVerdicts([['town', ok], ['shrine', { holds: false, skipped: 'skipped: no browser', checks: [] }]])).toMatchObject({ holds: false, skippedLevels: ['shrine'] });
  });
});

describe('the script and the run', () => {
  it('forward always; fire each second, interact each two, jump each three', () => {
    expect(scriptInput(0)).toEqual({ forward: 1, turn: 0 });
    expect(scriptInput(PROBE.fps)).toEqual({ forward: 1, turn: 0, fire: true });
    expect(scriptInput(PROBE.fps * 6)).toEqual({ forward: 1, turn: 0, fire: true, interact: true, jump: true });
  });

  it('plays each stage in one browser, writes its frames and judges them; no browser, plays nothing', async () => {
    const play = vi.fn(async (items) => items.map(() => ({ errors: [], startedLost: null, debug: [], frames: PROBE.frames.map((at) => ({ at, png: Buffer.from('png') })) })));
    const writeFile = vi.fn(async () => {});
    const stages = [{ ref: 'gw~level-a-0', manifest: stage(['reach-exit']), html: '<html>' }, { ref: 'gw~level-a-1', manifest: stage(['survive']), skip: 'no World form to render' }];
    const v = await probeLevel(stages, { findBrowser: async () => ({ path: '/chrome' }), play, framesDir: '/out', writeFile });
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0][0]).toEqual([{ html: '<html>' }]);
    expect(v.frames).toEqual(PROBE.frames.map((at) => ({ ref: 'gw~level-a-0', at, file: `/out/gw_level-a-0-${at}s.png` })));
    // the frames' colour reads judged, not carried into the verdict's frame list
    const coloured = vi.fn(async (items) => items.map(() => ({ errors: [], frames: [{ at: 11, png: Buffer.from('p'), colour: { share: 0.99, color: '#000000' } }] })));
    const blind = await probeLevel(stages.slice(0, 1), { findBrowser: async () => ({ path: '/chrome' }), play: coloured });
    expect(blind.checks.find((c) => c.check === 'sees')).toMatchObject({ holds: false });
    expect(blind.frames).toEqual([{ ref: 'gw~level-a-0', at: 11 }]);
    expect(writeFile).toHaveBeenCalledTimes(PROBE.frames.length);
    expect(v.skippedStages).toEqual(['gw~level-a-1']);
    const none = await probeLevel(stages, { findBrowser: async () => ({ path: null, why: 'no browser' }), play });
    expect(none).toMatchObject({ holds: false, skipped: 'skipped: no browser' });
    expect(play).toHaveBeenCalledTimes(1);
  });
});
