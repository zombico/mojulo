// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GameworldReqRepository } from '@/lib/db/repositories/gameworld-reqs.js';
import { designGameHandler } from './design-game.js';
import { MEADOWMARK_HERO } from '@/lib/graph/gameworld/index';
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
