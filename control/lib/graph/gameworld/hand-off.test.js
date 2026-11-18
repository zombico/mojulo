// The hand-off: once the producer's own steps are done (the pitch locked, a designed game's brief asked), the chain's
// first unit is proposed to the director, its remit filled from what the producer settled. It proposes; nothing is raised.
import { describe, it, expect } from 'vitest';
import { handOff } from './hand-off.js';
import { pitchStart } from './pitch-start.js';
import { RAILS, RAIL_IDS, TUNINGS, laidGenre } from './rails.js';
import { MOTIVATIONS, LABOURS, stampGameBrief } from './gmn.js';
import { LEVEL_REMIT } from './reqs.js';
import { leadNext, goalposts } from './goalposts.js';

// a rail the book lays as a designed game, picked from the roster; its starter is the stored game the producer hands on
const rail = RAIL_IDS.find((k) => RAILS[k].sizes.includes('designed') && RAILS[k].handles.genres.some(laidGenre));
const tuning = Object.keys(TUNINGS)[0];
const gmn = { motivations: { [Object.keys(MOTIVATIONS)[0]]: 1 }, labours: { [Object.keys(LABOURS)[0]]: 1 } };
const game = (pitch = {}, more = {}) => ({ ...pitchStart({ id: 'their-game', name: 'Their Game', rail: { from: rail, locked: true, ...pitch } }).world, ...more });

describe('the hand-off', () => {
  it('waits for the producer: no pitch, a pitch not locked, or a brief still owed hands nothing on', () => {
    const W = game();
    expect(handOff({ ...W, rail: undefined })).toBeNull();
    expect(handOff({ ...W, rail: { from: rail } })).toBeNull();
    expect(handOff(W)).toBeNull();   // (a designed game: its brief is the producer's last question)
    expect(handOff({ ...W, gameBrief: { gmn } })).not.toBeNull();
    expect(handOff({ ...W, gameBrief: { gmn }, quick: { goal: 'reach' } })).toBeNull();
  });

  it('proposes the first level as a req, its remit read from the rail, the pitch and the brief', () => {
    const W = stampGameBrief(game({ departs: { [tuning]: 'theirs' } }, { gameBrief: { gmn } }));
    const H = handOff(W), first = Object.keys(W.levels)[0];
    expect(H).toMatchObject({ step: 'hand-off', unit: `level:${first}`, level: first, from: { rail, brief: 'lv0' }, card: 'gameworld-ledger' });
    expect(H.req).toEqual({ unit: H.unit, remit: H.remit });
    expect(H.remit.template).toContain(RAILS[rail].name); expect(H.remit.template).toMatch(/the game is theirs/);
    expect(H.remit.departs).toEqual({ [tuning]: 'theirs' }); expect(H.remit.keeps).toEqual(Object.keys(TUNINGS).filter((k) => k !== tuning));
    expect(H.remit.idea).toContain(RAILS[rail].level1); expect(H.remit.beat).toBe(W.gameBrief.orders.find((o) => o.id === 'lv0').words);
    // it speaks the ledger's own remit, and leaves the ticket to the agent: no intent is written for it
    for (const k of ['in', 'band', 'idea', 'beat']) expect(LEVEL_REMIT[k], k).toBeTruthy();
    expect(JSON.stringify(H)).not.toMatch(/"intent"/); expect(H.move).toMatch(/ask: \{ intent \}/);
    // a pitch that departs nowhere says no departures
    expect(handOff(stampGameBrief(game({}, { gameBrief: { gmn } }))).remit.departs).toBeUndefined();
  });

  it('hands nothing on once the director has a level in hand, and other units do not count', () => {
    const W = game({}, { gameBrief: { gmn } }), first = Object.keys(W.levels)[0];
    expect(handOff(W, { units: [`level:${first}`] })).toBeNull();
    expect(handOff(W, { units: ['intent', 'hero'] })).not.toBeNull();
  });

  it('a smaller game owes no brief: its lock alone hands it on', () => {
    const W = { ...game(), rail: { from: rail, size: 'quick', locked: true } };
    expect(handOff(W)).toMatchObject({ step: 'hand-off' });
  });

  it('leads the readout as the producer\'s own steps do, ahead of a goalpost', () => {
    const W = game({}, { gameBrief: { gmn } }), H = handOff(W);
    const next = leadNext([H, { step: 'run' }], goalposts({ world: W }), {});
    expect(next.map((s) => s.step)).toEqual(['hand-off', 'goalpost', 'run']);
  });
});
