import { describe, it, expect } from 'vitest';
import { ASK_INTENT_MAX, checkAsk, traceStart, traceOf, tracedJob } from './asks.js';

// The asks (asks.js): the intent the agent acted on, cut as a ticket when intent becomes work, and the trace from any
// ticket to the intent above it and the work below it. An ask is the agent's inference, never the person's words.

describe('an ask', () => {
  it('is the inferred intent, or an existing ticket by its id', () => {
    expect(() => checkAsk({ intent: 'the boss should hit harder, so the climb to it matters' })).not.toThrow();
    expect(() => checkAsk({ intent: 'a darker crypt', units: ['level:crypt'] })).not.toThrow();
    expect(() => checkAsk('a3')).not.toThrow();
    for (const bad of ['3', 'r2', '', null, 7]) expect(() => checkAsk(bad), String(bad)).toThrow(/an ask is \{ intent, units\? \}/);
  });

  it('never carries the person\'s words: there is no field for them, and a call that tries is refused', () => {
    for (const k of ['says', 'prompt', 'message', 'quote', 'verbatim']) {
      expect(() => checkAsk({ intent: 'x', [k]: 'the boss is too easy lol' }), k).toThrow(/the intent you inferred, in your own words, never the person's/);
    }
    expect(() => checkAsk({ intent: 'x', mood: 'grim' })).toThrow(/not mood/);
  });

  it('is an intent, not a transcript: short and said', () => {
    expect(() => checkAsk({ intent: '   ' })).toThrow(/what you understood and are doing/);
    expect(() => checkAsk({ intent: 'x'.repeat(ASK_INTENT_MAX + 1) })).toThrow(/at most 1024 characters/);
    expect(() => checkAsk({ intent: 'x', units: 'level:crypt' })).toThrow(/units are the units it maps to/);
  });
});

describe('a trace', () => {
  it('starts from an ask, a req or a job', () => {
    expect(traceStart('a3')).toEqual({ ask: 'a3' });
    expect(traceStart('r2')).toEqual({ req: 'r2' });
    expect(traceStart('r2.j1')).toEqual({ req: 'r2', job: 'j1' });
    for (const bad of ['j1', 'r2.', 'a0', 'x']) expect(() => traceStart(bad), bad).toThrow(/an ask \(a3\), a req \(r2\) or a job \(r2\.j1\)/);
  });

  it('shows a job by what it did and why, never the patch\'s values', () => {
    const j = tracedJob({ id: 'j1', kind: 'author', status: 'kept', report: { patch: [{ op: 'set', path: '/levels/crypt/name', value: 'secret' }], decisions: [{ slot: 'name', value: 'The Crypt', because: 'the intent: older' }, { slot: 'palette' }], asks: ['a tide'], rev: 7 } });
    expect(j).toEqual({ id: 'j1', kind: 'author', status: 'kept', wrote: ['/levels/crypt/name'], decisions: [{ slot: 'name', value: 'The Crypt', because: 'the intent: older' }, { slot: 'palette', because: null }], asks: ['a tide'], rev: 7 });
    expect(JSON.stringify(j)).not.toContain('secret');
  });

  it('the ask, its reqs and jobs, its verdicts, patches and runs; its path derived from where it started', () => {
    const jobs = [{ id: 'j1', kind: 'author', status: 'kept', report: { rev: 4 } }, { id: 'j2', kind: 'critic', status: 'submitted', report: { findings: [{ says: 'too bright' }] } }];
    const links = [{ kind: 'req', target: 'r2' }, { kind: 'verdict', target: 'level:crypt', detail: { status: 'revise', note: 'darker', rev: 5 } }, { kind: 'run', target: '6', detail: { made: ['level-crypt-0'] } }];
    const T = traceOf({ world: 'gw', ask: { id: 'a3', intent: 'an older crypt' }, links, reqs: [{ id: 'r2', unit: 'level:crypt', status: 'sent back', jobs }] });
    expect(T).toMatchObject({ path: 'gw·a3', ask: { id: 'a3', intent: 'an older crypt' }, verdicts: [{ part: 'level:crypt', status: 'revise', note: 'darker', rev: 5 }], runs: [{ rev: 6, made: ['level-crypt-0'] }] });
    expect(T.reqs[0].jobs.map((j) => j.id)).toEqual(['j1', 'j2']);
    // from a job: the path names it, and only that job of its req is shown
    const J = traceOf({ world: 'gw', ask: { id: 'a3', intent: 'x' }, links, reqs: [{ id: 'r2', unit: 'level:crypt', status: 'open', jobs }], focus: { req: 'r2', job: 'j2' } });
    expect(J.path).toBe('gw·a3·r2·j2');
    expect(J.reqs[0].jobs.map((j) => j.id)).toEqual(['j2']);
    // a req raised with no ticket: no ask, its own work
    expect(traceOf({ world: 'gw', reqs: [{ id: 'r1', unit: 'feel', status: 'open' }], focus: { req: 'r1' } })).toMatchObject({ path: 'gw·r1', ask: null });
  });
});
