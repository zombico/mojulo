import { describe, expect, it } from 'vitest';
import { awaitShell, gameChannelScript } from './game.js';

// THE HANDSHAKE'S GRACE: a hosted level waits for its shell's game-init before it starts on its presets. A shell in the
// same window shares the level's thread, so the wait is counted in time the shell could have answered in.
//
// One thread, modelled: a clock, timers that run when due and the thread is free, and stretches where it is busy (the
// level building its world). A message posted to the level is a task too: heard at the first free moment after.
function thread() {
  let t = 0, seq = 0;
  const tasks = [], busy = [];
  const free = (at) => { for (const [a, b] of busy) if (at >= a && at < b) return b; return at; };
  return {
    now: () => t,
    later: (fn, ms) => tasks.push({ at: t + ms, fn, seq: seq++ }),
    post: (fn, at) => tasks.push({ at, fn, seq: seq++ }),
    busy: (a, b) => busy.push([a, b]),
    run(until) {
      for (;;) {
        // the next task: the one that can run first (its due time, pushed past any busy stretch), in posting order
        const next = tasks.map((k) => ({ k, when: free(Math.max(k.at, t)) })).sort((a, b) => a.when - b.when || a.k.seq - b.k.seq)[0];
        if (!next || next.when > until) { t = until; return; }
        tasks.splice(tasks.indexOf(next.k), 1);
        t = next.when;
        next.k.fn();
      }
    },
  };
}
// a level under a shell: the level asks at `ask`; the shell, on the same thread, hears it when the thread is free and
// answers at once; the answer is heard when the thread is next free
function level({ ask = 0, busy = [], answers = true, wait }) {
  const T = thread(), st = { started: null };
  for (const [a, b] of busy) T.busy(a, b);
  T.post(() => {
    awaitShell({ started: () => !!st.started, fallback: () => { st.started = 'presets'; st.at = T.now(); }, now: T.now, later: T.later, ...(wait ? { wait } : {}) });
    // (a message is a task of its own, a moment after it is posted: never in the turn that posted it)
    if (answers) T.post(() => T.post(() => { if (!st.started) { st.started = 'init'; st.at = T.now(); } }, T.now() + 1), T.now() + 1);
  }, ask);
  T.run(20000);
  return st;
}

describe('the grace a level gives its shell', () => {
  it('a shell that never answers: the presets, after the wait', () => {
    const st = level({ answers: false });
    expect(st.started).toBe('presets');
    expect(st.at).toBeGreaterThanOrEqual(1500);
    expect(st.at).toBeLessThan(1700);
  });

  it('a shell that answers at once is heard', () => {
    expect(level({}).started).toBe('init');
  });

  it('a build that ends anywhere near the wait never beats the shell\'s answer, queued behind it', () => {
    // the level asks, then builds its world for `ms`: the shell hears nothing and can say nothing until it ends.
    // (On the clock alone, a build ending inside 250 ms after the 1.5 s mark started the level on its presets.)
    for (const ms of [200, 1400, 1490, 1500, 1510, 1600, 1740, 1760, 3000, 9000]) {
      expect(level({ busy: [[0.5, ms]] }).started, `a ${ms} ms build`).toBe('init');
    }
  });

  it('a build in stretches, the thread free a moment between them, is no time the shell had', () => {
    const busy = Array.from({ length: 12 }, (_, k) => [k * 160 + 0.5, k * 160 + 150]);
    expect(level({ busy }).started).toBe('init');
    // and with no shell, the presets still come: late by the time the thread was busy, never lost
    const st = level({ busy, answers: false });
    expect(st.started).toBe('presets');
    expect(st.at).toBeGreaterThanOrEqual(1500);
  });

  it('the page runs this very source', () => {
    const js = gameChannelScript({ levelRef: 'l', produces: { events: [] } });
    expect(js).toContain(awaitShell.toString());
    expect(() => new Function(`return (${awaitShell.toString()})`)()).not.toThrow();
  });
});
