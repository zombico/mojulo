import { describe, it, expect } from 'vitest';
import { STAFFING, LEVEL_REMIT, budgetOf, kindOf, unitPrint, unitParts, reqStatus, readLedger, notesWith, precedentOf, pullThrough, remitAdvice, ledgerSummary, reqForView } from './reqs.js';
import { CHAPTERS, chapterById } from './chapters.js';

// The requisitions' rules (reqs.js): a unit's status read from the book's stamps, one unit worked at a time in order,
// what a unit pulls through, and what it reads besides its chapter (its precedent).

const world = { id: 'w', levels: { crypt: { name: 'Crypt' }, vale: { name: 'Vale' } }, feel: { template: 'brisk' } };
const req = (seq, unit, extra = {}) => ({ id: `r${seq}`, seq, unit, remit: null, staffing: 'soloist', budget: {}, verdict: null, notes: [], ...extra });
const part = (id, status, note) => ({ id, status, ...(note ? { note } : {}) });

describe('a req\'s status, from the book\'s stamps', () => {
  it('a level: accepted when its part is approved, stale when changed after, sent back on revise, else live', () => {
    const r = req(1, 'level:crypt');
    expect(reqStatus(r, { world, parts: [part('level:crypt', 'approved'), part('level:vale', 'revise')] })).toBe('accepted');
    expect(reqStatus(r, { world, parts: [part('level:crypt', 'changed')] })).toBe('stale');
    expect(reqStatus(r, { world, parts: [part('level:crypt', 'revise', 'darker')] })).toBe('sent back');
    expect(reqStatus(r, { world, parts: [part('level:crypt', 'proposed')] })).toBe('live');
    // autonomous mode's machine stamp is not the creator's: still live
    expect(reqStatus(r, { world, parts: [part('level:crypt', 'auto')] })).toBe('live');
  });

  it('a unit with no review part is accepted on the creator\'s verdict, stale once its pages move', () => {
    const accepted = req(1, 'feel', { verdict: { status: 'accepted', print: unitPrint(world, 'feel') } });
    expect(reqStatus(accepted, { world })).toBe('accepted');
    expect(reqStatus(accepted, { world: { ...world, feel: { template: 'floaty' } } })).toBe('stale');
    expect(reqStatus(req(2, 'feel'), { world })).toBe('live');
  });

  it('cancelled by the director; gone when its level left the world', () => {
    expect(reqStatus(req(1, 'level:crypt', { verdict: { status: 'cancelled' } }), { world })).toBe('cancelled');
    expect(reqStatus(req(1, 'level:keep'), { world })).toBe('gone');
  });
});

describe('the ledger: one unit worked at a time', () => {
  it('the first live req is open, the rest queued; accepted and cancelled ones are passed', () => {
    const rows = [req(1, 'world'), req(2, 'level:crypt'), req(3, 'level:vale', { verdict: { status: 'cancelled' } }), req(4, 'level:vale')];
    const parts = [part('world', 'approved'), part('nature', 'approved'), part('level:crypt', 'proposed'), part('level:vale', 'proposed')];
    const L = readLedger(rows, { world, parts });
    expect(L.reqs.map((r) => r.status)).toEqual(['accepted', 'open', 'cancelled', 'queued']);
    expect(L.current.id).toBe('r2');
    expect(ledgerSummary(L)).toEqual({ current: { id: 'r2', unit: 'level:crypt', status: 'open', staffing: 'soloist' }, queue: ['r4 level:vale (queued)'], accepted: 1, cancelled: 1 });
  });

  it('a unit sent back is the current one, with its status said', () => {
    const L = readLedger([req(1, 'level:crypt'), req(2, 'level:vale')], { world, parts: [part('level:crypt', 'revise', 'more light')] });
    expect(L.current).toMatchObject({ id: 'r1', status: 'sent back' });
    expect(L.reqs[1].status).toBe('queued');
  });

  it('nothing raised: no summary', () => {
    expect(ledgerSummary(readLedger([], { world }))).toBeNull();
  });
});

describe('what a unit reads besides its chapter', () => {
  it('the creator\'s notes on what they sent back are kept once each', () => {
    const r = req(1, 'level:crypt');
    const notes = notesWith(r, [part('level:crypt', 'revise', 'the boss comes too soon'), part('level:vale', 'revise', 'not mine')]);
    expect(notes).toEqual([{ unit: 'level:crypt', part: 'level:crypt', note: 'the boss comes too soon' }]);
    expect(notesWith({ ...r, notes }, [part('level:crypt', 'revise', 'the boss comes too soon')])).toBeNull();
  });

  it('precedent: the last accepted unit of its kind before it, and every note so far', () => {
    const reqs = [
      { ...req(1, 'world'), status: 'accepted' },
      { ...req(2, 'level:crypt', { remit: { idea: 'light as a key' }, notes: [{ unit: 'level:crypt', part: 'level:crypt', note: 'darker' }] }), status: 'accepted' },
      { ...req(3, 'level:vale'), status: 'open' },
    ];
    expect(precedentOf(reqs[2], reqs)).toEqual({ last: { id: 'r2', unit: 'level:crypt', remit: { idea: 'light as a key' } }, notes: [{ unit: 'level:crypt', part: 'level:crypt', note: 'darker' }] });
    // a chapter's kind is its own: the world is not a level's precedent, nor a level the world's
    expect(kindOf('level:vale')).toBe('level');
    expect(kindOf('hero')).toBe('hero');
    // the world has no earlier unit of its kind; it still reads every note so far (a unit reopened learns from later ones)
    expect(precedentOf(reqs[0], reqs)).toEqual({ notes: reqs[1].notes });
    expect(precedentOf(reqs[0], reqs.map((r) => ({ ...r, notes: [] })))).toBeNull();
  });

  it('a unit\'s view carries its remit, precedent and budget', () => {
    const reqs = [{ ...req(1, 'level:crypt', { remit: { idea: 'light' }, staffing: 'studio', budget: { diverge: 3 } }), status: 'open' }];
    expect(reqForView(reqs[0], reqs)).toEqual({ id: 'r1', status: 'open', staffing: 'studio', budget: { ...STAFFING.studio, diverge: 3 }, remit: { idea: 'light' } });
    expect(budgetOf(req(1, 'hero'))).toEqual(STAFFING.soloist);
  });
});

describe('pull-through', () => {
  it('raises upstream chapters the book holds and has not settled, in book order, none already asked for', () => {
    // a chapter that reads through two others (chosen from the registry, not by hand): every one upstream open
    const deep = CHAPTERS.find((c) => c.reads.some((r) => chapterById(r).reads.length));
    const up = new Set();
    const visit = (id) => { for (const r of chapterById(id).reads) if (!up.has(r)) { up.add(r); visit(r); } };
    visit(deep.id);
    const book = CHAPTERS.map((c) => ({ id: c.id, state: 'open' }));
    const order = CHAPTERS.map((c) => c.id).filter((id) => up.has(id));
    expect(pullThrough(deep.id, { book })).toEqual(order);
    // settled, unheld, or already asked for: not pulled
    const [first, ...rest] = order;
    const settled = book.map((c) => (c.id === first ? { ...c, state: 'settled' } : c));
    expect(pullThrough(deep.id, { book: settled })).toEqual(rest);
    expect(pullThrough(deep.id, { book: book.filter((c) => c.id !== first) })).toEqual(rest);
    expect(pullThrough(deep.id, { book, reqs: [{ unit: first, status: 'queued' }] })).toEqual(rest);
    // a written chapter (no review of its own) is not pulled
    expect(pullThrough(deep.id, { book: book.map((c) => (c.id === first ? { ...c, state: 'written' } : c)) })).toEqual(rest);
  });

  it('a level pulls what the levels chapter reads', () => {
    const book = CHAPTERS.map((c) => ({ id: c.id, state: 'open' }));
    expect(pullThrough('level:crypt', { book })).toEqual(pullThrough('levels', { book }));
  });
});

describe('the remit', () => {
  it('a level\'s remit advises on what it leaves out; a chapter\'s is its own', () => {
    expect(remitAdvice('level:crypt', { in: 'a', out: 'b', band: 'c', idea: 'd', foes: 'e', beat: 'f' })).toEqual([]);
    const [line] = remitAdvice('level:crypt', { idea: 'light as a key' });
    for (const k of Object.keys(LEVEL_REMIT).filter((x) => x !== 'idea')) expect(line).toContain(k);
    expect(remitAdvice('hero', null)).toEqual([]);
  });

  it('a unit\'s parts and print are its own', () => {
    expect(unitParts('level:crypt', [part('level:crypt', 'x'), part('level:vale', 'x'), part('world', 'x')]).map((p) => p.id)).toEqual(['level:crypt']);
    expect(unitPrint(world, 'level:crypt')).not.toBe(unitPrint(world, 'level:vale'));
    expect(unitPrint(world, 'lighting')).toBeNull();
  });
});
