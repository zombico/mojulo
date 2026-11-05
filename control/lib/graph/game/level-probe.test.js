import { describe, it, expect, vi } from 'vitest';
import { PROBE, DEBUG_TEXT, opposition, probeVerdict, scriptInput, probeLevel } from './level-probe.js';

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
    expect(v.checks.map((c) => c.check)).toEqual(['loads', 'not lost', 'opposed', 'clean']);
    expect(v.note).toMatch(/eyes gate .* has not run/);
  });

  it('each starter that failed in play fails its check, said by stage', () => {
    const failing = (s) => probeVerdict([ok(s)]).checks.filter((c) => !c.holds);
    expect(failing({ errors: ["Cannot access '__groundRay' before initialization"] })).toEqual([{ check: 'loads', holds: false, says: "s1: it threw: Cannot access '__groundRay' before initialization" }]);
    expect(failing({ startedLost: 'ended (fail) standing still' })[0]).toMatchObject({ check: 'not lost', says: 's1: it was over before any input: ended (fail) standing still' });
    expect(failing({ opposition: opposition(stage(['survive'])) })[0].check).toBe('opposed');
    expect(failing({ debug: ['0 events → store'] })[0]).toMatchObject({ check: 'clean', says: 's1: it shows "0 events → store"' });
    expect(failing({ error: 'Navigation timeout' })[0]).toMatchObject({ check: 'loads', says: 's1: Navigation timeout' });
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
    expect(writeFile).toHaveBeenCalledTimes(PROBE.frames.length);
    expect(v.skippedStages).toEqual(['gw~level-a-1']);
    const none = await probeLevel(stages, { findBrowser: async () => ({ path: null, why: 'no browser' }), play });
    expect(none).toMatchObject({ holds: false, skipped: 'skipped: no browser' });
    expect(play).toHaveBeenCalledTimes(1);
  });
});
