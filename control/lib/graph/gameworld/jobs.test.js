import { describe, it, expect } from 'vitest';
import { ANGLES, LENSES, authorPlan, criticPlan, jobsLeft, reissuesLeft, unitPaths, outsideOf, citing, checkSubmit, jobBrief, jobReport, nextOf, jobLines } from './jobs.js';
import { STAFFING } from './reqs.js';
import { chapterById } from './chapters.js';

// The jobs inside a req (jobs.js): what a req is started with by its staffing, what each job is handed, what it may
// write, how its report is checked, and what the director does next.

const req = (extra = {}) => ({ id: 'r2', seq: 2, unit: 'level:crypt', staffing: 'soloist', budget: {}, ...extra });
const job = (n, kind, status = 'issued', extra = {}) => ({ id: `j${n}`, n, kind, tier: 'judge', status, ...extra });

describe('what a req is started with', () => {
  it('a soloist: one author at the budget\'s tier; a studio: its diverge authors, each a different angle', () => {
    expect(authorPlan(req())).toEqual([{ kind: 'author', tier: STAFFING.soloist.tier }]);
    const studio = authorPlan(req({ staffing: 'studio' }));
    expect(studio).toHaveLength(STAFFING.studio.diverge);
    expect(new Set(studio.map((j) => j.angle)).size).toBe(studio.length);
    for (const j of studio) expect(j).toMatchObject({ kind: 'diverge', tier: STAFFING.studio.tier, angle: expect.any(String) });
    // more siblings than angles: the angles come round again, in order
    expect(authorPlan(req({ staffing: 'studio', budget: { diverge: ANGLES.length + 1 } })).at(-1).angle).toBe(ANGLES[0]);
  });

  it('critics: one per lens in turn, never above the budget\'s tier', () => {
    const lenses = Object.keys(LENSES);
    expect(criticPlan(req({ staffing: 'studio', budget: { critics: 3 } })).map((c) => c.lens)).toEqual(lenses.slice(0, 3));
    expect(criticPlan(req({ staffing: 'studio' })).every((c) => c.tier === 'judge')).toBe(true);
    expect(criticPlan(req({ staffing: 'studio', budget: { tier: 'fill' } }))[0].tier).toBe('fill');
    expect(criticPlan(req())).toEqual([]);
  });

  it('the budget counts every job issued, a reissue among them', () => {
    const R = req({ budget: { jobs: 3, reissues: 1 } });
    expect(jobsLeft(R, [job(1, 'author', 'reissued'), job(2, 'author')])).toBe(1);
    expect(reissuesLeft(R, [job(1, 'author', 'reissued')])).toBe(0);
  });
});

describe('what a job is handed and may write', () => {
  it('a level\'s job writes its level; a chapter\'s, its chapter\'s paths', () => {
    expect(unitPaths('level:crypt')).toEqual(['/levels/crypt']);
    expect(unitPaths('hero')).toEqual([...chapterById('hero').paths]);
    expect(outsideOf('level:crypt', [{ op: 'set', path: '/levels/crypt/name' }, { op: 'set', path: '/levels/vale/name' }, { op: 'set', path: '/levels/crypt' }])).toEqual(['/levels/vale/name']);
  });

  it('the brief: the call it reads with, its pages, the call it reports with', () => {
    const b = jobBrief(job(1, 'diverge', 'issued', { angle: ANGLES[1] }), req(), { ref: 'gw' });
    expect(b).toMatchObject({ job: 'j1', kind: 'diverge', angle: ANGLES[1], read: { tool: 'design_game', args: { ref: 'gw', chapter: 'level:crypt' } }, writes: ['/levels/crypt'] });
    expect(b.submit).toMatchObject({ tool: 'design_game', args: { ref: 'gw', req: { id: 'r2', job: 'j1' } } });
    expect(Object.keys(b.submit.args.req)).toEqual(['id', 'job', 'patch', 'decisions', 'asks']);
    const c = jobBrief(job(3, 'critic', 'issued', { lens: 'play' }), req(), { ref: 'gw' });
    expect(c.writes).toBeUndefined();
    expect(c.lens).toBe(`play: ${LENSES.play}`);
    expect(Object.keys(c.submit.args.req)).toEqual(['id', 'job', 'findings']);
  });
});

describe('a job\'s report', () => {
  it('an author sends a patch; a critic, findings; an issued job reports once', () => {
    const patch = [{ op: 'set', path: '/levels/crypt/name', value: 'Crypt' }];
    expect(() => checkSubmit(job(1, 'author'), { patch })).not.toThrow();
    expect(() => checkSubmit(job(1, 'author'), { findings: [] })).toThrow(/reports its pages as patch/);
    expect(() => checkSubmit(job(1, 'critic'), { findings: [{ says: 'the boss is too soon' }] })).not.toThrow();
    expect(() => checkSubmit(job(1, 'critic'), { findings: [{ says: 'x' }], patch })).toThrow(/never a patch/);
    expect(() => checkSubmit(job(1, 'author', 'kept'), { patch })).toThrow(/j1 is kept: only an issued job reports/);
    expect(() => checkSubmit(job(1, 'author'), { patch, decisions: [{ value: 1 }] })).toThrow(/decisions are/);
    expect(() => checkSubmit(job(1, 'author'), { patch, asks: 'a tide' })).toThrow(/asks are/);
    expect(() => checkSubmit(job(1, 'author'), { patch, asks: ['a tide'] })).not.toThrow();
  });

  it('decisions without a because were the seed\'s: counted, by slot', () => {
    expect(citing([{ slot: 'band', because: 'the remit says gentle' }, { slot: 'palette' }, { slot: 'foes', because: ' ' }])).toEqual({ cited: 1, uncited: ['palette', 'foes'] });
    expect(citing([{ slot: 'band', because: 'x' }])).toEqual({ cited: 1 });
  });

  it('a report as the ledger shows it: what it wrote, not the patch', () => {
    const r = jobReport(job(1, 'diverge', 'submitted', { report: { patch: [{ op: 'set', path: '/levels/crypt/name', value: 'A' }, { op: 'set', path: '/levels/crypt/name', value: 'B' }], decisions: [{ slot: 'name' }] } }));
    expect(r).toEqual({ job: 'j1', kind: 'diverge', status: 'submitted', writes: ['/levels/crypt/name'], decisions: { cited: 0, uncited: ['name'] } });
  });
});

describe('what the director does next', () => {
  it('start, work, keep, critique, review, in that order', () => {
    expect(nextOf([])).toBe('start');
    expect(nextOf([job(1, 'author')])).toBe('work');
    expect(nextOf([job(1, 'diverge', 'submitted'), job(2, 'diverge', 'submitted')])).toBe('keep');
    expect(nextOf([job(1, 'diverge', 'kept'), job(2, 'diverge', 'declined'), job(3, 'critic')])).toBe('critique');
    expect(nextOf([job(1, 'author', 'kept')])).toBe('review');
    // a reissued job is passed: its replacement is the one being worked
    expect(nextOf([job(1, 'author', 'reissued'), job(2, 'author')])).toBe('work');
    expect(jobLines([job(1, 'author', 'kept')])).toEqual(['j1 author kept']);
  });
});
