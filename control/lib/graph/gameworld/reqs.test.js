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

import { receiptOf, upstreamPrints, staleUpstream, reqParts } from './reqs.js';

describe('the received gate', () => {
  const kept = (n, decisions = [{ slot: 'walk', because: 'the remit' }], extra = {}) => ({ id: `j${n}`, n, kind: 'author', status: 'kept', report: { patch: [], decisions, ...extra } });
  const probe = (n, prints, holds = true) => ({ id: `j${n}`, n, kind: 'probe', status: 'submitted', report: { holds, prints, checks: holds ? [] : [{ check: 'opposed', holds: false, says: 's1: nothing stands in it' }] } });
  const made = { 'level-crypt-0': { ref: 's0', stored: 'aaaa' }, 'level-vale-0': { ref: 'v0', stored: 'cccc' } };

  it('a chapter: a proposal kept, its decisions cited, its critics reported, its laws holding', () => {
    const r = req(1, 'feel');
    expect(receiptOf(r, { jobs: [kept(1)], world }).holds).toBe(true);
    expect(receiptOf(r, { jobs: [], world }).checks[0]).toEqual({ check: 'proposal', holds: false, says: 'no proposal kept: start it and work its jobs' });
    expect(receiptOf(r, { jobs: [kept(1, [{ slot: 'pole' }])], world }).checks.find((c) => c.check === 'cited')).toMatchObject({ holds: false, says: 'decisions with no because: pole' });
    expect(receiptOf(r, { jobs: [kept(1), { id: 'j2', n: 2, kind: 'critic', status: 'issued' }], world }).checks.find((c) => c.check === 'critics')).toMatchObject({ holds: false, says: 'still to report: j2' });
    // what it does not hold on, it says: what no word reached, and the critics' findings
    const said = receiptOf(r, { jobs: [kept(1, undefined, { asks: ['a tide'] }), { id: 'j2', n: 2, kind: 'critic', status: 'submitted', report: { findings: [{ says: 'too floaty' }] } }], world });
    expect(said).toMatchObject({ holds: true, said: { asks: ['a tide'], findings: ['j2: too floaty'] } });
  });

  it('its laws: a part the machine gate advises on does not hold', () => {
    const r = req(1, 'level:crypt');
    const c = receiptOf(r, { jobs: [kept(1)], world, made, parts: [{ id: 'level:crypt', status: 'proposed', machine: ['a dead end'] }] }).checks.find((x) => x.check === 'laws');
    expect(c).toMatchObject({ holds: false, says: 'level:crypt: a dead end' });
  });

  it('a level: its stages made, and probed after its proposal was kept, as they stand', () => {
    const r = req(1, 'level:crypt');
    const at = (jobs, m = made) => receiptOf(r, { jobs, world, made: m }).checks.find((c) => c.check === 'probe');
    expect(at([kept(1)], {})).toMatchObject({ holds: false, says: expect.stringMatching(/no stage made/) });
    expect(at([kept(1)])).toMatchObject({ holds: false, says: expect.stringMatching(/not played/) });
    expect(at([kept(1), probe(2, { 'level-crypt-0': 'aaaa' })])).toEqual({ check: 'probe', holds: true });
    // a sibling level's stages are not its own
    expect(at([kept(1), probe(2, { 'level-crypt-0': 'aaaa', 'level-vale-0': 'cccc' })]).holds).toBe(false);
    // its stage remade since, or probed before the proposal kept: played again
    expect(at([kept(1), probe(2, { 'level-crypt-0': 'aaaa' })], { 'level-crypt-0': { stored: 'bbbb' } })).toMatchObject({ holds: false, says: expect.stringMatching(/probe again/) });
    expect(at([probe(1, { 'level-crypt-0': 'aaaa' }), kept(2)]).holds).toBe(false);
    expect(at([kept(1), probe(2, { 'level-crypt-0': 'aaaa' }, false)])).toMatchObject({ holds: false, says: 'opposed: s1: nothing stands in it' });
  });

  it('received is a status of its own between open and accepted; a queued one stays queued', () => {
    const rows = [req(1, 'feel'), req(2, 'level:crypt')];
    const L = readLedger(rows, { world, received: (r) => r.unit === 'feel' || r.unit === 'level:crypt' });
    expect(L.reqs.map((r) => r.status)).toEqual(['received', 'queued']);
    expect(L.current.id).toBe('r1');
  });

  it('an accepted unit goes stale when a chapter it reads moves after it was accepted', () => {
    const W1 = { ...world, style: { kit: 'meadow' } };
    const r = req(1, 'level:crypt', { verdict: { upstream: upstreamPrints('level:crypt', W1) } });
    const parts = [part('level:crypt', 'approved')];
    expect(reqStatus(r, { world: W1, parts })).toBe('accepted');
    const W2 = { ...W1, style: { kit: 'tundra' } };
    expect(reqStatus(r, { world: W2, parts })).toBe('stale');
    expect(staleUpstream(r, W2)).toEqual(['world']);
    // accepted with nothing kept upstream (read before the prints were kept): accepted
    expect(reqStatus(req(1, 'level:crypt'), { world: W2, parts })).toBe('accepted');
  });
});

describe('the director\'s call, and crews', () => {
  const lp = (status, print = 'p1') => ({ id: 'level:crypt', status, print });

  it('directed: held on the prints it was settled on; stale when they move; the creator\'s approval wins', () => {
    const r = req(1, 'level:crypt', { verdict: { status: 'directed', prints: { 'level:crypt': 'p1' } } });
    expect(reqStatus(r, { world, parts: [lp('proposed')] })).toBe('directed');
    expect(reqStatus(r, { world, parts: [lp('proposed', 'p2')] })).toBe('stale');
    expect(reqStatus(r, { world, parts: [lp('revise')] })).toBe('stale');
    expect(reqStatus(r, { world, parts: [lp('approved')] })).toBe('accepted');
    // a directed unit is settled: passed in the queue, counted apart from the creator's
    const L = readLedger([r, req(2, 'level:vale')], { world, parts: [lp('proposed'), { id: 'level:vale', status: 'proposed', print: 'v' }] });
    expect(L.reqs.map((x) => x.status)).toEqual(['directed', 'open']);
    expect(ledgerSummary(L)).toMatchObject({ accepted: 0, directed: 1 });
  });

  it('a crew\'s parts are every unit\'s; its receipt wants a kept proposal for each', () => {
    const r = req(1, 'level:crypt', { crew: ['foes'] });
    const parts = [lp('approved'), { id: 'foes:a', status: 'approved', print: 'f' }, { id: 'level:vale', status: 'proposed', print: 'v' }];
    expect(reqParts(r, parts).map((p) => p.id)).toEqual(['level:crypt', 'foes:a']);
    expect(reqStatus(r, { world, parts })).toBe('accepted');
    expect(reqStatus(r, { world, parts: [lp('approved'), { id: 'foes:a', status: 'proposed', print: 'f' }] })).toBe('live');
    const jobs = [{ id: 'j1', n: 1, kind: 'author', unit: 'level:crypt', status: 'kept', report: { decisions: [] } }, { id: 'j2', n: 2, kind: 'author', unit: 'foes', status: 'issued' }];
    expect(receiptOf({ ...r, unit: 'feel', crew: ['foes'] }, { jobs: jobs.map((j) => ({ ...j, unit: j.unit === 'level:crypt' ? 'feel' : j.unit })), world }).checks[0]).toEqual({ check: 'proposal', holds: false, says: 'no proposal kept yet for foes' });
  });
});
