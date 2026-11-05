// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GameworldReqRepository, GameworldReqJobRepository } from '@/lib/db/repositories/gameworld-reqs.js';
import { jobsLeft } from '@/lib/graph/gameworld/jobs.js';
import { chapterById } from '@/lib/graph/gameworld/chapters.js';
import { designGameHandler } from './design-game.js';
import { MEADOWMARK, MEADOWMARK_HERO } from '@/lib/graph/gameworld/index';
import { pullThrough } from '@/lib/graph/gameworld/reqs.js';

// The requisitions through the door (design_game { ref, req }): a unit asked for, what it pulls through, one worked
// at a time, its view carrying its remit and precedent, accepted on the creator's verdict. These write recipes and
// the ledger and read them; nothing is made (a run is the e2e tier's).

// the reference book without its verdicts (it ships one level sent back): every part waits for the creator
const { review: _verdicts, ...BOOK } = MEADOWMARK_HERO;
const GATED = { ...BOOK, mode: 'gated' };
const [FIRST, SECOND] = Object.keys(GATED.levels);
const REMIT = { in: 'from the meadow gate', out: 'the shore gate', band: 'gentle', idea: 'climb to see', foes: 'none', beat: 'setting out' };

describe('design_game: the requisitions', () => {
  beforeEach(() => { closeDb(); });

  it('a level asked for pulls through what it reads and has not settled, each its own req, the first open', async () => {
    const full = await designGameHandler({ world: GATED, ref: 'gw' });
    const ups = pullThrough(`level:${FIRST}`, { book: full.chapters });
    expect(ups.length).toBeGreaterThan(0);
    const out = await designGameHandler({ ref: 'gw', req: { unit: `level:${FIRST}`, remit: REMIT } });
    expect(out.reqs.raised).toEqual([...ups.map((u, i) => `r${i + 1} ${u} (pulled through: level:${FIRST} reads it)`), `r${ups.length + 1} level:${FIRST}`]);
    expect(out.reqs.current).toMatchObject({ id: 'r1', unit: ups[0], status: 'open' });
    expect(out.reqs.queue.at(-1)).toBe(`r${ups.length + 1} level:${FIRST} (queued)`);
    expect(out.next).toContainEqual(expect.objectContaining({ step: 'req', id: 'r1', unit: ups[0] }));
    // a full remit: nothing advised
    expect(out.reqs.advises).toBeUndefined();
  });

  it('the ledger never touches the recipe', async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    const before = JSON.stringify(SketchRepository.getByRef('gw').manifest);
    await designGameHandler({ ref: 'gw', req: { unit: `level:${FIRST}`, remit: REMIT } });
    await designGameHandler({ ref: 'gw', req: { id: 'r1', staffing: 'studio' } });
    expect(JSON.stringify(SketchRepository.getByRef('gw').manifest)).toBe(before);
  });

  it('one at a time: a second unit asked for while one is open is queued and said, never refused; asked twice, once', async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    const a = await designGameHandler({ ref: 'gw', req: { unit: `level:${FIRST}`, remit: REMIT } });
    const n = a.reqs.raised.length;
    const b = await designGameHandler({ ref: 'gw', req: { unit: `level:${SECOND}` } });
    expect(b.reqs.raised).toEqual([`r${n + 1} level:${SECOND}`]);
    expect(b.reqs.advises[0]).toMatch(/^r1 \(.+\) is open: accept it or send it back first; level:.+ is queued after it$/);
    // its remit left out: advised, by name
    expect(b.reqs.advises[1]).toMatch(/its remit says nothing of in, out, band, idea, foes, beat \(in: how the player arrives/);
    const c = await designGameHandler({ ref: 'gw', req: { unit: `level:${SECOND}`, remit: { idea: 'the tide turns' } } });
    expect(c.reqs.raised).toBeUndefined();
    expect(c.reqs.advises[0]).toBe(`level:${SECOND} is already asked for: r${n + 1} (queued)`);
    expect(GameworldReqRepository.get('gw', `r${n + 1}`).remit).toEqual({ idea: 'the tide turns' });
  });

  it('a unit\'s view carries its req; accepted when the creator approves its parts, and the next opens', async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    // the world's upstream settled first, so the level is the only unit asked for
    const full = await designGameHandler({ ref: 'gw' });
    const upstream = full.parts.filter((p) => ['intent', 'world', 'nature', 'civilizations', 'key'].includes(p.id) || p.id.startsWith('tech:')).map((p) => p.id);
    await designGameHandler({ ref: 'gw', approve: upstream });
    const out = await designGameHandler({ ref: 'gw', req: { unit: `level:${FIRST}`, remit: REMIT } });
    expect(out.reqs.raised).toEqual([`r1 level:${FIRST}`]);
    const view = await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` });
    expect(view.req).toMatchObject({ id: 'r1', status: 'open', staffing: 'soloist', remit: REMIT, budget: { jobs: expect.any(Number) } });
    expect(view.next).toContainEqual(expect.objectContaining({ step: 'req', unit: `level:${FIRST}` }));
    // a sibling's view carries no req of its own and no move for it
    const sibling = await designGameHandler({ ref: 'gw', chapter: `level:${SECOND}` });
    expect(sibling.req).toBeUndefined();
    expect(sibling.next.some((m) => m.step === 'req')).toBe(false);
    // sent back with a note: still the one being worked, the note kept
    await designGameHandler({ ref: 'gw', revise: { part: `level:${FIRST}`, note: 'the climb is too short' } });
    const back = await designGameHandler({ ref: 'gw', req: { unit: `level:${SECOND}`, remit: REMIT } });
    expect(back.reqs.current).toMatchObject({ id: 'r1', status: 'sent back' });
    // approved: accepted, and the next level opens with the first as its precedent and the creator's note
    await designGameHandler({ ref: 'gw', approve: [`level:${FIRST}`] });
    const next = await designGameHandler({ ref: 'gw', chapter: `level:${SECOND}` });
    expect(next.req).toMatchObject({ id: 'r2', status: 'open', precedent: { last: { id: 'r1', unit: `level:${FIRST}`, remit: REMIT }, notes: [{ unit: `level:${FIRST}`, part: `level:${FIRST}`, note: 'the climb is too short' }] } });
    const whole = await designGameHandler({ ref: 'gw' });
    expect(whole.reqs).toMatchObject({ current: { id: 'r2' }, accepted: 1 });
  });

  it('a unit with no review part is accepted on the creator\'s word; one with parts by approving them; cancelled is passed', async () => {
    await designGameHandler({ world: { ...GATED, feel: { pole: 'conscription', toward: 'infinity-crisis', t: 0.5 } }, ref: 'gw' });
    const r = await designGameHandler({ ref: 'gw', req: { unit: 'feel' } });
    const id = r.reqs.raised.at(-1).split(' ')[0];
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r1', accept: true } })).rejects.toThrow(/accepted by approving its parts/);
    await designGameHandler({ ref: 'gw', req: { id, accept: true, note: 'that weight is right' } });
    expect(GameworldReqRepository.get('gw', id).verdict).toMatchObject({ status: 'accepted', note: 'that weight is right', print: expect.stringMatching(/^[0-9a-f]{8}$/) });
    await designGameHandler({ ref: 'gw', req: { id: 'r1', cancel: true } });
    const out = await designGameHandler({ ref: 'gw' });
    expect(out.reqs.cancelled).toBe(1);
    expect(out.reqs.accepted).toBeGreaterThanOrEqual(1);
  });

  it('refuses a req it cannot read before it writes anything', async () => {
    await expect(designGameHandler({ world: GATED, ref: 'gw-no', req: { unit: 'lighting' } })).rejects.toThrow(/a req's unit is a chapter/);
    expect(SketchRepository.getByRef('gw-no')).toBeFalsy();
    await designGameHandler({ world: GATED, ref: 'gw' });
    await expect(designGameHandler({ ref: 'gw', req: { unit: 'hero', id: 'r1' } })).rejects.toThrow(/one or the other/);
    await expect(designGameHandler({ ref: 'gw', req: { unit: 'hero', staffing: 'crowd' } })).rejects.toThrow(/staffing is soloist or studio/);
    await expect(designGameHandler({ ref: 'gw', req: { unit: 'level:nowhere' } })).rejects.toThrow(/no level 'nowhere'/);
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r9' } })).rejects.toThrow(/no req 'r9'/);
  });
});

describe('design_game: the jobs inside a req', () => {
  beforeEach(() => { closeDb(); });

  // a world whose upstream is settled, so a level asked for is the one being worked
  async function levelReq(extra = {}) {
    await designGameHandler({ world: GATED, ref: 'gw' });
    const full = await designGameHandler({ ref: 'gw' });
    const upstream = full.parts.filter((p) => ['intent', 'world', 'nature', 'civilizations', 'key'].includes(p.id) || p.id.startsWith('tech:')).map((p) => p.id);
    await designGameHandler({ ref: 'gw', approve: upstream });
    const out = await designGameHandler({ ref: 'gw', req: { unit: `level:${FIRST}`, remit: REMIT, ...extra } });
    expect(out.reqs.raised).toEqual([`r1 level:${FIRST}`]);
  }
  const named = (ref) => SketchRepository.getByRef(ref).manifest.levels[FIRST].name;
  const nameOp = (value) => [{ op: 'set', path: `/levels/${FIRST}/name`, value }];

  it('a soloist: started, one author handed its brief, its patch applied when it reports, then the creator\'s', async () => {
    await levelReq();
    const before = await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` });
    expect(before.req.does).toBe('start');
    const started = await designGameHandler({ ref: 'gw', req: { id: 'r1', start: true } });
    expect(started.reqs.raised).toEqual(['r1 j1 author issued']);
    expect(started.reqs.current).toMatchObject({ does: 'work', jobs: ['j1 author issued'] });
    // the brief: the exact call to read with, the pages it writes, the call to report with
    const view = await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` });
    expect(view.req.jobs[0]).toMatchObject({ job: 'j1', kind: 'author', read: { tool: 'design_game', args: { ref: 'gw', chapter: `level:${FIRST}` } }, writes: [`/levels/${FIRST}`], submit: { tool: 'design_game' } });
    // the report: the patch applied to the recipe, the decisions counted
    const done = await designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j1', patch: nameOp('The Long Climb'), decisions: [{ slot: 'name', value: 'The Long Climb', because: 'the remit\'s idea: climb to see' }, { slot: 'palette' }] } });
    expect(named('gw')).toBe('The Long Climb');
    expect(done.reqs.done).toEqual(['j1 author kept: its patch applied']);
    const after = await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` });
    // a level is played by the probe before the creator is shown it
    expect(after.req.does).toBe('probe');
    expect(after.req.jobs[0]).toMatchObject({ job: 'j1', status: 'kept', writes: [`/levels/${FIRST}/name`], decisions: { cited: 1, uncited: ['palette'] } });
    // started twice: once; reported twice: refused, nothing written
    const again = await designGameHandler({ ref: 'gw', req: { id: 'r1', start: true } });
    expect(again.reqs.advises[0]).toBe('r1 is started: j1 author kept');
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j1', patch: nameOp('Other') } })).rejects.toThrow(/j1 is kept: only an issued job reports/);
    expect(named('gw')).toBe('The Long Climb');
  });

  it('a studio: its diverge proposals held, one kept and applied, the rest declined, its critics issued and reporting', async () => {
    await levelReq({ staffing: 'studio', budget: { diverge: 2, critics: 1 } });
    const started = await designGameHandler({ ref: 'gw', req: { id: 'r1', start: true } });
    expect(started.reqs.current.jobs).toEqual(['j1 diverge issued', 'j2 diverge issued']);
    const view = await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` });
    expect(view.req.jobs.map((j) => j.angle)).toHaveLength(2);
    expect(view.req.jobs[0].angle).not.toBe(view.req.jobs[1].angle);
    const original = named('gw');
    // each proposal held: the recipe as it was
    await designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j1', patch: nameOp('The Plain Climb'), decisions: [{ slot: 'name', because: 'plainest' }] } });
    const held = await designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j2', patch: nameOp('The Sky Stair'), decisions: [{ slot: 'name', because: 'boldest' }] } });
    expect(held.reqs.done[0]).toMatch(/^j2 diverge held: keep one of the proposals/);
    expect(named('gw')).toBe(original);
    expect(held.reqs.current.does).toBe('keep');
    // kept: its patch applied, its sibling declined, a critic issued with its lens
    const kept = await designGameHandler({ ref: 'gw', req: { id: 'r1', keep: 'j2' } });
    expect(named('gw')).toBe('The Sky Stair');
    expect(kept.reqs.done).toEqual(['j2 kept: its patch applied; the other proposals declined and kept on record', 'j3 critic issued (design)']);
    expect(kept.reqs.current.jobs).toEqual(['j1 diverge declined', 'j2 diverge kept', 'j3 critic issued']);
    expect(kept.reqs.current.does).toBe('critique');
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r1', keep: 'j1' } })).rejects.toThrow(/keep names a diverge proposal that has reported/);
    // the critic: a lens, nothing to write, findings in
    const crit = (await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` })).req.jobs.find((j) => j.job === 'j3');
    expect(crit).toMatchObject({ kind: 'critic', lens: expect.stringMatching(/^design: /) });
    expect(crit.writes).toBeUndefined();
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j3', patch: nameOp('x') } })).rejects.toThrow(/it reports findings/);
    await designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j3', findings: [{ says: 'the stair names a height the level never reaches', part: `level:${FIRST}` }] } });
    const last = await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` });
    expect(last.req.does).toBe('probe');
    expect(last.req.jobs.find((j) => j.job === 'j3').findings).toHaveLength(1);
  });

  it('a proposal past its unit is applied and said; a reissue spends the budget; a spent budget is said, never past', async () => {
    await levelReq({ budget: { jobs: 2, reissues: 1 } });
    await designGameHandler({ ref: 'gw', req: { id: 'r1', start: true } });
    // reissued once: the old one passed, a new author issued; twice: the budget's reissues are spent
    const re = await designGameHandler({ ref: 'gw', req: { id: 'r1', reissue: 'j1' } });
    expect(re.reqs.raised).toEqual(['r1 j2 author issued (reissue of j1)']);
    const spent = await designGameHandler({ ref: 'gw', req: { id: 'r1', reissue: 'j2' } });
    expect(spent.reqs.advises[0]).toMatch(/^r1: j2 not reissued: the budget's (reissues|jobs) are spent/);
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j1', patch: nameOp('x') } })).rejects.toThrow(/j1 is reissued/);
    const past = await designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j2', patch: [...nameOp('Mine'), { op: 'set', path: `/levels/${SECOND}/name`, value: 'Not mine' }], asks: ['a passage the tide opens and closes'] } });
    expect(past.reqs.done).toContain('j2 asks for what no word reaches: a passage the tide opens and closes');
    expect((await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` })).req.jobs.find((j) => j.job === 'j2').asks).toEqual(['a passage the tide opens and closes']);
    expect(past.reqs.done).toContain(`j2 wrote past level:${FIRST}: /levels/${SECOND}/name`);
    expect(SketchRepository.getByRef('gw').manifest.levels[SECOND].name).toBe('Not mine');
  });

  it('a job act names its req and does one thing', async () => {
    await levelReq();
    await expect(designGameHandler({ ref: 'gw', req: { unit: 'hero', start: true } })).rejects.toThrow(/act on a raised req/);
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r1', start: true, keep: 'j1' } })).rejects.toThrow(/does one of start, job, keep, reissue/);
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r1', patch: nameOp('x') } })).rejects.toThrow(/report a job: give its `job`/);
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j7', patch: nameOp('x') } })).rejects.toThrow(/no job 'j7' on r1 \(none issued: start it\)/);
  });
});

describe('design_game: the received gate', () => {
  beforeEach(() => { closeDb(); });
  const FEEL = { pole: 'conscription', toward: 'infinity-crisis', t: 0.5 };

  async function settled() {
    await designGameHandler({ world: { ...GATED, feel: FEEL }, ref: 'gw' });
    const full = await designGameHandler({ ref: 'gw' });
    const upstream = full.parts.filter((p) => ['intent', 'world', 'nature', 'civilizations', 'key'].includes(p.id) || p.id.startsWith('tech:')).map((p) => p.id);
    await designGameHandler({ ref: 'gw', approve: upstream });
  }

  it('a chapter is received when its kept proposal\'s decisions are cited and its laws hold, then shown to the creator', async () => {
    await settled();
    const raised = await designGameHandler({ ref: 'gw', req: { unit: 'feel' } });
    const ids = raised.reqs.raised.map((x) => x.split(' ')[0]), id = ids.at(-1);
    // what it pulled through, withdrawn, so the feel is the unit being worked
    for (const up of ids.slice(0, -1)) await designGameHandler({ ref: 'gw', req: { id: up, cancel: true } });
    await designGameHandler({ ref: 'gw', req: { id, start: true } });
    const open = await designGameHandler({ ref: 'gw', chapter: 'feel' });
    expect(open.req.receipt).toMatchObject({ holds: false, checks: expect.arrayContaining([{ check: 'proposal', holds: false, says: expect.any(String) }]) });
    await designGameHandler({ ref: 'gw', req: { id, job: 'j1', patch: [{ op: 'set', path: '/feel', value: { ...FEEL, t: 0.4 } }], decisions: [{ slot: 'feel.t', value: 0.4, because: 'a touch lighter than the pole' }] } });
    const view = await designGameHandler({ ref: 'gw', chapter: 'feel' });
    expect(view.req).toMatchObject({ status: 'received', does: 'review', receipt: { holds: true } });
    expect((await designGameHandler({ ref: 'gw' })).reqs.current).toMatchObject({ id, status: 'received' });
  });

  it('the probe plays a level\'s stages: none made, said; no browser, skipped, and the loop goes on to the creator', async () => {
    await settled();
    await designGameHandler({ ref: 'gw', req: { unit: `level:${FIRST}`, remit: REMIT } });
    const id = (await designGameHandler({ ref: 'gw' })).reqs.current.id;
    await expect(designGameHandler({ ref: 'gw', req: { id: 'r1', probe: true, start: true } })).rejects.toThrow(/does one of/);
    const none = await designGameHandler({ ref: 'gw', req: { id, probe: true } });
    expect(none.reqs.done).toEqual([`${id}: no stage of level:${FIRST} made yet: { ref, chapter: 'level:${FIRST}', run: true } first`]);
    await designGameHandler({ ref: 'gw', req: { id, start: true } });
    await designGameHandler({ ref: 'gw', req: { id, job: 'j1', patch: [{ op: 'set', path: `/levels/${FIRST}/name`, value: 'The Climb' }], decisions: [{ slot: 'name', because: 'the remit' }] } });
    // a stage on record (as a run leaves it), played with no browser (the test environment keeps it off)
    const row = SketchRepository.getByRef('gw');
    SketchRepository.update({ ref: 'gw', manifest: { ...row.manifest, made: { [`level-${FIRST}-0`]: { ref: 'gw', order: '0000aaaa', stored: '0000bbbb' } } } });
    const played = await designGameHandler({ ref: 'gw', req: { id, probe: true } });
    expect(played.reqs.done[0]).toMatch(/^j2 probe skipped: /);
    const view = await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` });
    expect(view.req.jobs.find((j) => j.job === 'j2')).toMatchObject({ kind: 'probe', holds: false, skipped: expect.stringMatching(/^skipped/) });
    expect(view.req.receipt.checks.find((c) => c.check === 'probe')).toMatchObject({ holds: false, says: expect.stringMatching(/^skipped/) });
    // no browser: the loop degrades, never breaks; it goes on to the creator
    expect(view.req.does).toBe('review');
    // the probe is the server's: it spends none of the budget's jobs (four, one author spent)
    expect(jobsLeft(GameworldReqRepository.get('gw', id), GameworldReqJobRepository.list('gw', id))).toBe(3);
  });

  it('the probe is a level\'s: a chapter\'s req is refused', async () => {
    await settled();
    const raised = await designGameHandler({ ref: 'gw', req: { unit: 'feel' } });
    const id = raised.reqs.raised.at(-1).split(' ')[0];
    await expect(designGameHandler({ ref: 'gw', req: { id, probe: true } })).rejects.toThrow(/the probe plays a level/);
  });

  it('an accepted level goes stale when the world it reads moves, and is accepted again on the creator\'s word', async () => {
    await settled();
    await designGameHandler({ ref: 'gw', req: { unit: `level:${FIRST}`, remit: REMIT } });
    const id = (await designGameHandler({ ref: 'gw' })).reqs.current.id;
    await designGameHandler({ ref: 'gw', approve: [`level:${FIRST}`] });
    // the prints of what a level reads, as the registry says it reads (chapters.js), kept when it was first read accepted
    const upstream = GameworldReqRepository.get('gw', id).verdict.upstream;
    expect(Object.keys(upstream)).toEqual([...chapterById('levels').reads]);
    for (const print of Object.values(upstream)) expect(print).toMatch(/^[0-9a-f]{8}$/);
    // the world's page moves (a civilization renamed): the level it was accepted against is stale
    const civ = Object.keys(SketchRepository.getByRef('gw').manifest.civilizations)[0];
    await designGameHandler({ ref: 'gw', patch: [{ op: 'set', path: `/civilizations/${civ}/name`, value: 'The Renamed' }] });
    const stale = await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` });
    expect(stale.req).toMatchObject({ id, status: 'stale' });
    // accepted again on the creator's word: the new prints kept
    await designGameHandler({ ref: 'gw', req: { id, accept: true, note: 'still right on the new ground' } });
    const again = await designGameHandler({ ref: 'gw' });
    expect(again.reqs.accepted).toBe(1);
    expect(again.reqs.current).toBeUndefined();
  });
});

describe('design_game: the composite', () => {
  beforeEach(() => { closeDb(); });

  it('a level accepted asks for the game to be made of it; a world that asks for no level never does', async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    const plain = await designGameHandler({ ref: 'gw' });
    expect(plain.next.some((m) => m.step === 'composite')).toBe(false);
    expect(plain.reqs).toBeUndefined();
    await designGameHandler({ ref: 'gw', req: { unit: `level:${FIRST}`, remit: REMIT } });
    // asked for, not yet accepted: no game to make of it
    const asked = await designGameHandler({ ref: 'gw' });
    expect(asked.next.some((m) => m.step === 'composite')).toBe(false);
    await designGameHandler({ ref: 'gw', approve: [`level:${FIRST}`] });
    const accepted = await designGameHandler({ ref: 'gw' });
    expect(accepted.next).toContainEqual(expect.objectContaining({ step: 'composite', levels: [FIRST], first: true }));
    expect(accepted.reqs.composite).toEqual({ levels: [FIRST], made: false });
    // the build's view says it too (the director's)
    const build = await designGameHandler({ ref: 'gw', chapter: 'build' });
    expect(build.next).toContainEqual(expect.objectContaining({ step: 'composite', levels: [FIRST] }));
  });

  it('the pre-compile check prices the game of the accepted levels, not the whole book', async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    const whole = (await designGameHandler({ ref: 'gw', chapter: 'build' })).compile;
    await designGameHandler({ ref: 'gw', req: { unit: `level:${FIRST}`, remit: REMIT } });
    await designGameHandler({ ref: 'gw', approve: [`level:${FIRST}`] });
    const one = (await designGameHandler({ ref: 'gw', chapter: 'build' })).compile;
    expect(one.estimate.seconds).toBeLessThan(whole.estimate.seconds);
  });
});

describe('design_game: the main quest as the queue', () => {
  beforeEach(() => { closeDb(); });
  const [M1, M2] = Object.keys(MEADOWMARK.levels);
  const mainQuest = { acts: [
    { id: 'one', name: 'Setting out', goal: 'set out', beats: [{ id: 'shore-first', goal: 'the shore first', as: { level: M2 } }] },
    { id: 'two', goal: 'the coast', beats: [{ id: 'windy-shore', goal: 'cross the windy shore' }] },
    { id: 'three', goal: 'the end', beats: [{ id: 'the-keep', goal: 'into the keep', built: false }] },
  ] };
  const QW = { ...MEADOWMARK, mode: 'gated', review: undefined, mainQuest };
  const levelsOf = (ref) => Object.keys(SketchRepository.getByRef(ref).manifest.levels);

  it('a beat asked for is its level, laid now if a run would lay it, its remit from the quest and the director\'s words winning', async () => {
    await designGameHandler({ world: QW, ref: 'gq' });
    expect(levelsOf('gq')).not.toContain('windy-shore');
    const out = await designGameHandler({ ref: 'gq', req: { unit: 'beat:windy-shore', remit: { foes: 'gulls, minions only' } } });
    expect(levelsOf('gq')).toContain('windy-shore');
    expect(out.reqs.raised.at(-1)).toMatch(/^r\d+ level:windy-shore \(beat windy-shore\)$/);
    const id = out.reqs.raised.at(-1).split(' ')[0];
    expect(GameworldReqRepository.get('gq', id).remit).toMatchObject({ beat: 'act 2 of 3 (mid): cross the windy shore', band: 'mid: act 2 of 3', foes: 'gulls, minions only', in: `from 'the shore first' (level:${M2})`, loop: expect.any(String) });
    // laid once: asked again, the level stands as laid and the req is the same
    const again = await designGameHandler({ ref: 'gq', req: { unit: 'beat:windy-shore' } });
    expect(again.reqs.advises.some((a) => a.startsWith(`level:windy-shore is already asked for: ${id} (`))).toBe(true);
    expect(again.reqs.raised).toBeUndefined();
    await expect(designGameHandler({ ref: 'gq', req: { unit: 'beat:the-keep' } })).rejects.toThrow(/planned \(built: false\)/);
  });

  it('the quest asked for whole: each built beat\'s level in its order, the planned beat said, asked once each', async () => {
    await designGameHandler({ world: QW, ref: 'gq' });
    const out = await designGameHandler({ ref: 'gq', req: { quest: true } });
    const own = out.reqs.raised.filter((x) => /\(beat /.test(x));
    expect(own.map((x) => x.split(' ').slice(1).join(' '))).toEqual([`level:${M2} (beat shore-first)`, 'level:windy-shore (beat windy-shore)']);
    expect(out.reqs.advises).toContain('planned, not asked for yet: the-keep');
    const again = await designGameHandler({ ref: 'gq', req: { quest: true } });
    expect(again.reqs.raised).toBeUndefined();
    expect(again.reqs.advises.filter((a) => /is already asked for/.test(a))).toHaveLength(2);
    await expect(designGameHandler({ ref: 'gq', req: { quest: true, unit: 'hero' } })).rejects.toThrow(/give no unit or id with it/);
    await expect(designGameHandler({ ref: 'gq', req: { unit: 'beat:nowhere' } })).rejects.toThrow(/no beat 'nowhere'/);
  });

  it('while a req is open the ledger leads: its move first in next', async () => {
    await designGameHandler({ world: QW, ref: 'gq' });
    await designGameHandler({ ref: 'gq', req: { quest: true } });
    const out = await designGameHandler({ ref: 'gq' });
    expect(out.next[0]).toMatchObject({ step: 'req', id: out.reqs.current.id, card: 'gameworld-ledger' });
  });
});

describe('design_game: the production ledger (asks and traces)', () => {
  beforeEach(() => { closeDb(); });

  async function settledLevel() {
    await designGameHandler({ world: GATED, ref: 'gw' });
    const full = await designGameHandler({ ref: 'gw' });
    const upstream = full.parts.filter((p) => ['intent', 'world', 'nature', 'civilizations', 'key'].includes(p.id) || p.id.startsWith('tech:')).map((p) => p.id);
    await designGameHandler({ ref: 'gw', approve: upstream });
  }

  it('an ask is cut with the work it causes, and holds the inferred intent alone', async () => {
    await settledLevel();
    const out = await designGameHandler({ ref: 'gw', ask: { intent: 'the first level should feel like setting out: gentle, open, a long view', units: [`level:${FIRST}`] }, req: { unit: `level:${FIRST}`, remit: REMIT } });
    expect(out.ask).toEqual({ id: 'a1', intent: 'the first level should feel like setting out: gentle, open, a long view', linked: ['r1'] });
    // no work, no ticket; the person's words, refused
    await expect(designGameHandler({ ref: 'gw', ask: { intent: 'just looking' } })).rejects.toThrow(/an ask is cut when intent becomes work/);
    await expect(designGameHandler({ ref: 'gw', ask: { intent: 'x', says: 'make it gentle pls' }, req: { unit: 'feel' } })).rejects.toThrow(/never the person's/);
    // the table has no place for them
    const { getDb } = await import('@/lib/db/index');
    expect(getDb().prepare('pragma table_info(gameworld_asks)').all().map((c) => c.name)).toEqual(['world_ref', 'seq', 'intent', 'units_json', 'created_at']);
  });

  it('a trace from a job reaches the intent above it and the reasons, revisions and verdicts below it', async () => {
    await settledLevel();
    await designGameHandler({ ref: 'gw', ask: { intent: 'a gentle first climb' }, req: { unit: `level:${FIRST}`, remit: REMIT } });
    await designGameHandler({ ref: 'gw', req: { id: 'r1', start: true } });
    await designGameHandler({ ref: 'gw', req: { id: 'r1', job: 'j1', patch: [{ op: 'set', path: `/levels/${FIRST}/name`, value: 'The Long View' }], decisions: [{ slot: 'name', value: 'The Long View', because: 'the intent: a long view' }] } });
    // the creator sends it back, on the same ticket
    const back = await designGameHandler({ ref: 'gw', ask: 'a1', revise: { part: `level:${FIRST}`, note: 'gentler still' } });
    expect(back.ask).toMatchObject({ id: 'a1', linked: [`sent back level:${FIRST}`] });
    const T = (await designGameHandler({ ref: 'gw', trace: 'r1.j1' })).trace;
    expect(T).toMatchObject({ path: 'gw·a1·r1·j1', ask: { id: 'a1', intent: 'a gentle first climb' }, verdicts: [{ part: `level:${FIRST}`, status: 'revise', note: 'gentler still', rev: expect.any(Number) }] });
    expect(T.reqs[0]).toMatchObject({ id: 'r1', unit: `level:${FIRST}`, status: 'sent back', jobs: [{ id: 'j1', kind: 'author', status: 'kept', wrote: [`/levels/${FIRST}/name`], decisions: [{ slot: 'name', because: 'the intent: a long view' }], rev: expect.any(Number) }] });
    // any ticket reaches the same chain
    expect((await designGameHandler({ ref: 'gw', trace: 'a1' })).trace.ask).toEqual(T.ask);
    expect((await designGameHandler({ ref: 'gw', trace: 'r1' })).trace.verdicts).toEqual(T.verdicts);
    await expect(designGameHandler({ ref: 'gw', trace: 'r9' })).rejects.toThrow(/no req 'r9'/);
    await expect(designGameHandler({ ref: 'gw', trace: 'a9' })).rejects.toThrow(/no ask 'a9'/);
  });

  it('a unit\'s view carries the intent it was asked for with; the next level\'s precedent, the last one\'s', async () => {
    await settledLevel();
    await designGameHandler({ ref: 'gw', ask: { intent: 'a gentle first climb' }, req: { unit: `level:${FIRST}`, remit: REMIT } });
    expect((await designGameHandler({ ref: 'gw', chapter: `level:${FIRST}` })).req.intent).toEqual({ ask: 'a1', intent: 'a gentle first climb' });
    await designGameHandler({ ref: 'gw', approve: [`level:${FIRST}`] });
    await designGameHandler({ ref: 'gw', ask: { intent: 'the shore pushes back' }, req: { unit: `level:${SECOND}`, remit: REMIT } });
    const next = await designGameHandler({ ref: 'gw', chapter: `level:${SECOND}` });
    expect(next.req.intent).toEqual({ ask: 'a2', intent: 'the shore pushes back' });
    expect(next.req.precedent.last).toMatchObject({ id: 'r1', intent: 'a gentle first climb' });
  });

  it('the production ledger never touches the recipe', async () => {
    await settledLevel();
    const before = JSON.stringify(SketchRepository.getByRef('gw').manifest);
    await designGameHandler({ ref: 'gw', ask: { intent: 'the feel later' }, req: { unit: 'feel' } });
    await designGameHandler({ ref: 'gw', trace: 'a1' });
    expect(JSON.stringify(SketchRepository.getByRef('gw').manifest)).toBe(before);
  });
});
