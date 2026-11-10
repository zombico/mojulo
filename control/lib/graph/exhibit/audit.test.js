// The exhibit audit: what a curator asks of a label wall, and the page half (every stop framed) through a stub browser.
import { describe, it, expect } from 'vitest';
import { auditTour, auditExhibit, holdSeconds } from './audit.js';
import { auditStops, FRAMED } from './page-audit.js';

describe('a tour, as a visitor meets it', () => {
  it('counts what it grades, cites and lights, and how long it takes to read', () => {
    const a = auditTour({ stops: [
      { id: 'a', caption: 'One two three.', camera: { cam: 0 }, grade: 'simulated', highlight: ['dam'] },
      { id: 'b', caption: 'Four five.', camera: { cam: 1 }, grade: 'attested', cite: ['Strabo 5.4.8'] },
    ] });
    expect(a).toMatchObject({ stops: 2, graded: 2, cited: 1, lit: 1, words: 5 });
    expect(a.seconds).toBe(Math.round(holdSeconds('One two three.') + holdSeconds('Four five.')));
    expect(a.findings).toEqual([]);
  });

  it('warns on a record\'s claim with no source; advises on the rest', () => {
    const long = Array.from({ length: 70 }, () => 'word').join(' ');
    const a = auditTour({ stops: [
      { id: 'a', caption: 'Built in 80 BC.', camera: { cam: 0 }, grade: 'reconstructed' },
      { id: 'b', caption: long, camera: { cam: 0 } },
      { id: 'c', caption: 'Again.', camera: { cam: 0 } },
    ] });
    const codes = a.findings.map((f) => `${f.level}:${f.code}:${f.at ?? ''}`);
    expect(codes).toEqual(['warn:uncited-claim:a', 'advice:ungraded:b', 'advice:long-caption:b', 'advice:same-view:b', 'advice:ungraded:c', 'advice:same-view:c', 'advice:nothing-lit:']);
  });

  it('a world with no tour is told it has no story; a gallery is audited room by room', () => {
    expect(auditExhibit({ tour: null }).findings.map((f) => f.code)).toEqual(['no-tour']);
    const g = auditExhibit({ rooms: [{ ref: 'r1', title: 'One', tour: { stops: [{ caption: 'x', camera: 'a', grade: 'attested' }] } }, { ref: 'r2', title: 'Two', tour: null }] });
    expect(g.gate).toBe('machine');
    expect(g.warnings).toBe(1);
    expect(g.findings.map((f) => `${f.room}:${f.code}`)).toEqual(['r1:uncited-claim', 'r2:no-tour']);
    expect(g.eyes).toMatch(/^not run/);
  });
});

describe('the page half: every stop framed', () => {
  // a stub browser: the page's tour handle, its views given per stop
  const browser = (views) => {
    const calls = [];
    // the page's tour handle, holding its stop across calls the way a page does
    const page = { count: views.length, at: 0, go(k) { this.at = k; calls.push(k); }, view() { return views[this.at]; } };
    const evaluate = async (fn, arg) => { globalThis.window = { __mojTour: page }; try { return fn(arg); } finally { delete globalThis.window; } };
    return { calls, evaluate };
  };

  it('seats each stop and says which are framed, off frame, specks or behind the camera', async () => {
    const b = browser([
      { at: 0, id: 'whole', framed: null },
      { at: 1, id: 'dam', onScreen: 1, share: 0.2, behind: 0 },
      { at: 2, id: 'outlet', onScreen: 0.4, share: 0.1, behind: 0 },
      { at: 3, id: 'bolt', onScreen: 1, share: FRAMED.share / 2, behind: 0 },
      { at: 4, id: 'back', onScreen: 1, share: 0.3, behind: 2 },
    ]);
    const a = await auditStops(b.evaluate);
    expect(b.calls).toEqual([0, 1, 2, 3, 4]);
    expect(a.stops.map((s) => s.framed)).toEqual([null, true, false, false, false]);
    expect(a.findings.map((f) => `${f.level}:${f.code}:${f.at}`)).toEqual(['warn:off-frame:outlet', 'advice:too-small:bolt', 'warn:behind-camera:back']);
    expect(a.warnings).toBe(2);
  });

  it('a page with no tour is told so', async () => {
    const a = await auditStops(async (fn) => { globalThis.window = {}; try { return fn(); } finally { delete globalThis.window; } });
    expect(a.findings.map((f) => f.code)).toEqual(['no-tour']);
  });
});
