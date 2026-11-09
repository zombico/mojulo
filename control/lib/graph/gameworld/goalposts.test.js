import { describe, it, expect } from 'vitest';
import { goalposts, GOALPOSTS } from './goalposts.js';
import { MEADOWMARK_HERO } from './index.js';
import { POLE_IDS } from './feel/cards.js';

// The first session's goalposts, read from the book (the chapters' states, the main quest, the record): each met,
// partial or open, the open ones with the creator's question, and where the next session picks up. Each case is the
// book a session leaves, built from the chapters' states the readout says.

const [L1] = Object.keys(MEADOWMARK_HERO.levels);
const settled = (...ids) => ids.map((id) => ({ id, state: 'settled' }));
const ALL = settled('intent', 'world', 'main-quest', 'levels', 'direction', 'hero', 'motion', 'actions');
const QUEST = { length: 'long', acts: [{ id: 'one', goal: 'set out', beats: [{ id: 'climb', goal: 'climb out', as: { level: L1 } }] }] };
const BOOK = { ...MEADOWMARK_HERO, intent: { from: 'long-rpg' }, feel: POLE_IDS[0], mainQuest: QUEST };
const PLAYS = { plays: { climb: L1 } };
const MADE = { [`level-${L1}-0`]: { ref: 'r', order: '0', stored: '0' }, [`audit-level-${L1}-0`]: { ref: 'r', order: '0', stored: '0', verdict: { completable: true, note: 'walked' } } };
const at = (G, id) => G.posts.find((p) => p.id === id);

describe('the first session\'s goalposts', () => {
  it('a book begun: every goalpost open, each with the creator\'s question, the next the first', () => {
    const G = goalposts({ world: { id: 'w' } });
    expect(G).toMatchObject({ met: 0, of: GOALPOSTS.length, next: { goalpost: 'game', chapter: 'intent' } });
    expect(G.posts.map((p) => p.id)).toEqual(GOALPOSTS.map((g) => g.id));
    for (const p of G.posts) expect(p, p.id).toMatchObject({ status: 'open', ask: expect.any(String), says: expect.any(String) });
    expect(G.next.move).toEqual(expect.any(String));
  });

  it('a good first session: all met, nothing to say (the creator playing it stays the eyes gate\'s)', () => {
    expect(goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, made: MADE })).toBeNull();
    // one short of it: the first level made, its walk not taken: partial, with the move
    const G = goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, made: { [`level-${L1}-0`]: MADE[`level-${L1}-0`] } });
    expect(G).toMatchObject({ met: GOALPOSTS.length - 1, next: { goalpost: 'first-level', chapter: 'build', move: expect.stringContaining('check: true') } });
    expect(at(G, 'first-level')).toMatchObject({ status: 'partial', says: 'made, 1 of its 1 stage not yet walked: run with check: true' });
    // a level is its stages: its first walked and proved, its climb not walked yet, is not proved (a real session's
    // first check stopped at its budget between them, and the goalposts read met)
    const climb = { ...MADE, [`level-${L1}-1`]: MADE[`level-${L1}-0`] };
    expect(at(goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, made: climb }), 'first-level')).toMatchObject({ status: 'partial', says: 'made, 1 of its 2 stages not yet walked: run with check: true' });
    expect(goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, made: { ...climb, [`audit-level-${L1}-1`]: MADE[`audit-level-${L1}-0`] } })).toBeNull();
  });

  it('reads each partial from the book: no length, an open hero, a planned first beat, a level still to lay, a walk that failed', () => {
    const noLength = goalposts({ world: { ...BOOK, mainQuest: { acts: QUEST.acts } }, chapters: ALL, mainQuest: PLAYS, made: MADE });
    expect(at(noLength, 'shape')).toMatchObject({ status: 'partial', says: 'the main quest says no length' });
    const hero = goalposts({ world: BOOK, chapters: ALL.map((c) => (c.id === 'hero' ? { id: 'hero', state: 'open' } : c)), mainQuest: PLAYS, made: MADE });
    expect(at(hero, 'look')).toMatchObject({ status: 'partial', says: expect.stringContaining('hero still open') });
    // an adopted hero's look is the creator's own
    expect(goalposts({ world: { ...BOOK, characters: { ...BOOK.characters, hero: { ref: 'mine' } } }, chapters: ALL.filter((c) => c.id !== 'hero' && c.id !== 'direction'), mainQuest: PLAYS, made: MADE })).toBeNull();
    const planned = { ...BOOK, mainQuest: { ...QUEST, acts: [{ ...QUEST.acts[0], beats: [{ ...QUEST.acts[0].beats[0], built: false }] }] } };
    expect(at(goalposts({ world: planned, chapters: ALL, mainQuest: { plays: { climb: null } }, made: {} }), 'plan')).toMatchObject({ status: 'partial', says: expect.stringContaining('planned, not built') });
    const laid = { ...BOOK, mainQuest: { ...QUEST, acts: [{ ...QUEST.acts[0], beats: [{ id: 'windy', goal: 'cross the windy shore' }] }] } };
    expect(at(goalposts({ world: laid, chapters: ALL, mainQuest: { plays: { windy: 'windy' } }, made: {} }), 'first-plan')).toMatchObject({ status: 'partial', says: "the first level 'windy' is laid at the next run" });
    const failed = { ...MADE, [`audit-level-${L1}-0`]: { ...MADE[`audit-level-${L1}-0`], verdict: { completable: false, note: 'stuck on the ladder' } } };
    expect(at(goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, made: failed }), 'first-level')).toMatchObject({ status: 'partial', says: 'made; 1 of its 1 stage not proved (stuck on the ladder)' });
    // a blocker in the pre-compile check holds the plan back
    expect(at(goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, made: MADE, compile: { blockers: [{}] } }), 'plan')).toMatchObject({ status: 'partial', says: '1 blocker in the pre-compile check' });
    // the first level's own review part, not settled
    expect(at(goalposts({ world: BOOK, chapters: ALL, parts: [{ id: `level:${L1}`, status: 'proposed' }], mainQuest: PLAYS, made: MADE }), 'first-plan')).toMatchObject({ status: 'partial', says: `the first level '${L1}' is not settled` });
  });
});

describe('the goalposts read the ledger', () => {
  const R = (status, checks, does) => ({ id: 'r2', unit: `level:${L1}`, status, does, receipt: { holds: checks.every((c) => c.holds), checks } });
  const ok = (check) => ({ check, holds: true }), no = (check, says) => ({ check, holds: false, says });

  it('the first level\'s req: its plan met once its proposal is kept and cited, the level once it is received', () => {
    const open = goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, reqs: [R('open', [no('proposal', 'no proposal kept: start it and work its jobs'), no('cited', 'x'), ok('critics'), ok('laws'), no('probe', 'not played')], 'start')] });
    expect(at(open, 'first-plan')).toMatchObject({ status: 'partial', says: 'r2 (open): proposal: no proposal kept: start it and work its jobs; cited: x' });
    // the next goalpost is the req's: its move is the req's
    expect(open.next).toEqual({ goalpost: 'first-plan', chapter: 'levels', move: 'r2: start', req: 'r2' });
    const authored = goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, reqs: [R('open', [ok('proposal'), ok('cited'), ok('critics'), ok('laws'), no('probe', 'not played: { req: { id, probe: true } }')], 'probe')] });
    expect(at(authored, 'first-plan')).toEqual({ id: 'first-plan', status: 'met' });
    expect(at(authored, 'first-level')).toMatchObject({ status: 'partial', says: 'r2 (open): probe: not played: { req: { id, probe: true } }' });
    expect(authored.next).toMatchObject({ goalpost: 'first-level', move: 'r2: probe', req: 'r2' });
    // received is the machine's word: every goalpost met
    expect(goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, reqs: [R('received', [ok('proposal'), ok('cited'), ok('critics'), ok('laws'), ok('probe')], 'review')] })).toBeNull();
  });

  it('a req for another level, or none, leaves the goalposts as they read the book', () => {
    const other = { ...R('open', [], 'start'), unit: 'level:elsewhere' };
    expect(goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, made: MADE, reqs: [other] })).toBeNull();
    expect(JSON.stringify(goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS, reqs: [other] }))).toBe(JSON.stringify(goalposts({ world: BOOK, chapters: ALL, mainQuest: PLAYS })));
  });
});
