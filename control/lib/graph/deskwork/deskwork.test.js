// deskwork — a shift of office work in a browser of tabs: pure and deterministic; every question answerable from what
// the tabs show (its right choice is what the invoice, the memo, the week or the policies say); a player who answers
// right serves every ticket and meets quota; a wrong answer costs and is written about; a ticket past its due is
// escalated; training holds the screen till acknowledged; the browser's every control is an action the reducer takes;
// the card's schedules give more tickets on less patience as the rank climbs.
import { describe, it, expect } from 'vitest';
import { newGame, step, wonOf, KINDS, TABS, policiesOf, rankTitle, RANKS, POINTS, SLIP, FOLDERS, SENDS } from './core.js';
import { renderHtml, resolveOverlay } from './skin.js';
import { deskSchedule, PATIENCE } from './card.js';

const cents = (s) => Number(s.replace(/[$,.]/g, ''));
// a player who opens each ticket as it comes and answers each step with the right choice (or a wrong one, `slip`)
function work(s, { slip = () => false, ack = true } = {}) {
  for (let t = 0; t < s.time * 1000 && !s.over; t += 250) {
    if (s.popup && ack) s = step(s, { type: 'ack' });
    const x = s.tickets.find((y) => y.state === 'open');
    if (x && !s.popup) {
      s = step(s, { type: 'open', id: x.id });
      const st = x.steps[x.on];
      s = step(s, { type: 'answer', k: slip(x, st) ? (st.answer + 1) % st.choices.length : st.answer });
    }
    s = step(s, { type: 'tick', dt: 250 });
  }
  return s;
}

describe('deskwork: the shift', () => {
  it('is pure: the same seed and the same hands make the same shift', () => {
    expect(JSON.stringify(work(newGame(7)))).toBe(JSON.stringify(work(newGame(7))));
    expect(newGame(7).policies).toEqual(policiesOf(7));
  });

  it('every question is answerable from what the tabs show', () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame(seed, { schedule: Array.from({ length: 12 }, (_, k) => ({ at: k, kind: ['invoice', 'decision', 'tps'][k % 3], patience: 60 })) }), P = s.policies;
      for (const x of s.tickets) {
        expect(x.steps.map((y) => y.step)).toEqual(KINDS[x.kind].steps);
        for (const st of x.steps) { expect(st.choices[st.answer]).toBeDefined(); expect(new Set(st.choices).size).toBe(st.choices.length); }
        const [a, b, c] = x.steps, d = x.doc;
        if (x.kind === 'invoice') {
          expect(d.sub).toBe(d.lines.reduce((t, l) => t + l.qty * l.unit, 0));
          expect(d.total).toBe(d.sub + d.tax);
          expect([String(d.total), d.po]).toContain(a.choices[a.answer].startsWith('$') ? String(cents(a.choices[a.answer])) : a.choices[a.answer]);
          expect(b.choices[b.answer]).toBe(FOLDERS[d.vendor === 'Synergetics Internal' ? 2 : d.total > P.threshold ? 1 : 0]);
        } else if (x.kind === 'decision') {
          const pick = d.rows.find((r) => r.vendor === a.choices[a.answer]);
          expect(cents(pick.cost)).toBeLessThan(cents(d.budget));
          expect(pick.days).toBeLessThanOrEqual(d.days);
          expect(pick.legal).toBe('Approved');
          // (exactly one meets them all)
          expect(d.rows.filter((r) => cents(r.cost) < cents(d.budget) && r.days <= d.days && r.legal === 'Approved')).toHaveLength(1);
        } else {
          expect(Number(a.choices[a.answer])).toBe(d.week.reduce((t, w) => t + w.n, 0));
          expect(b.choices[b.answer]).toBe(`Cover sheet v${P.cover}`);
          expect(c.choices[c.answer]).toBe(SENDS[P.send]);
        }
      }
    }
  });

  it('a player who answers right serves every ticket and meets quota; the points rise with the rank', () => {
    const s = work(newGame(3));
    expect(s.over).toBe(true);
    expect(s.served).toBe(s.tickets.length);
    expect(s.missed + s.mistakes).toBe(0);
    expect(wonOf(s)).toBe(true);
    expect(s.score).toBe(s.served * POINTS);
    const hi = work(newGame(3, { rank: 2 }));
    expect(hi.score / hi.served).toBe(POINTS * 1.5);
    expect(resolveOverlay(s)).toMatchObject({ status: 'over', message: expect.stringMatching(/Quota met/) });
  });

  it('a wrong answer costs and Quality Assurance writes; the ticket stays to be done right', () => {
    let s = step(newGame(4), { type: 'tick', dt: 3000 });
    const x = s.tickets.find((y) => y.state === 'open'), st = x.steps[0];
    s = step(step(s, { type: 'open', id: x.id }), { type: 'answer', k: (st.answer + 1) % 4 });
    expect(s).toMatchObject({ mistakes: 1, open: x.id, last: { id: x.id, ok: false } });
    expect(s.mail.at(-1).from).toBe('Quality Assurance');
    expect(s.tickets.find((y) => y.id === x.id).on).toBe(0);
    s = step(s, { type: 'answer', k: st.answer });
    expect(s.tickets.find((y) => y.id === x.id).on).toBe(1);
    expect(s.score).toBe(0);
  });

  it('a ticket left past its due is escalated; a shift of them is missed quota', () => {
    const idle = step(newGame(5), { type: 'tick', dt: 1000 * 200 });
    expect(idle.over).toBe(true);
    expect(idle.served).toBe(0);
    expect(idle.missed).toBe(idle.tickets.filter((x) => x.state === 'missed').length);
    expect(idle.missed).toBeGreaterThan(0);
    expect(idle.mail.some((m) => m.from === 'Escalations Bot')).toBe(true);
    expect(wonOf(idle)).toBe(false);
  });

  it('past the first rank, training comes up mid-shift and holds the screen till acknowledged; the clock runs on', () => {
    expect(newGame(6).training).toEqual([]);
    let s = newGame(6, { rank: 1 });
    s = step(s, { type: 'tick', dt: (s.training[0] + 1) * 1000 });
    expect(s.popup).toMatchObject({ title: 'Mandatory Training' });
    const x = s.tickets.filter((y) => y.state === 'open').sort((a, b) => b.due - a.due)[0];
    expect(step(s, { type: 'open', id: x.id }).open).toBe(null);
    const t = s.left;
    s = step(s, { type: 'tick', dt: 1000 });
    expect(s.left).toBe(t - 1000);
    s = step(s, { type: 'ack' });
    expect(s.popup).toBe(null);
    expect(step(s, { type: 'open', id: x.id }).open).toBe(x.id);
  });

  it('the browser: a tab for each of TABS, the rank, and every control an action the reducer takes', () => {
    let s = step(newGame(8, { rank: 3 }), { type: 'tick', dt: 3000 });
    const x = s.tickets.find((y) => y.state === 'open');
    s = step(s, { type: 'open', id: x.id });
    const html = renderHtml(s);
    for (const t of TABS) expect(html).toContain(`&quot;tab&quot;:&quot;${t}&quot;`);
    expect(html).toContain(rankTitle(3));
    const acts = [...html.matchAll(/data-act="([^"]+)"/g)].map((m) => JSON.parse(m[1].replace(/&quot;/g, '"')));
    expect(acts.some((a) => a.type === 'answer')).toBe(true);
    for (const a of acts) expect(['tab', 'open', 'answer', 'ack']).toContain(a.type);
    expect(renderHtml(step(s, { type: 'tab', tab: 'policies' }))).toContain(`Cover sheet v${s.policies.cover}`);
    expect(RANKS).toHaveLength(6);
  });
});

describe('deskwork: the card', () => {
  it('more rank, more work: more tickets a shift on less patience, every kind dealt; the same seed the same shift', () => {
    const lo = deskSchedule(0, 3), hi = deskSchedule(RANKS.length - 1, 3);
    expect(hi.length).toBeGreaterThan(lo.length);
    expect(lo[0].patience).toBe(PATIENCE[1]);
    expect(hi[0].patience).toBe(PATIENCE[0]);
    for (const S of [lo, hi]) expect(new Set(S.map((x) => x.kind))).toEqual(new Set(Object.keys(KINDS)));
    expect(deskSchedule(0, 3)).toEqual(lo);
    // (its shift played right meets quota)
    expect(wonOf(work(newGame(3, { schedule: lo })))).toBe(true);
  });
});
