import { describe, expect, it } from 'vitest';

import { expandSequence, validateDiagramManifest } from './diagram-core.js';

// P1 sequence lowering (diagram-patterns-spike.plan.md): a `kind:'sequence'`
// spec { actors, messages } lowers to a plain diagram (viewBox + line/rect/text
// marks with P0 heads). Pure + deterministic; no-op for every other kind.
const SPEC = {
  kind: 'sequence',
  title: 'S',
  actors: [
    { id: 'a', label: 'Agent' },
    { id: 'b', label: 'Tool' },
    { id: 'c', label: 'DB' },
  ],
  messages: [
    { from: 'a', to: 'b', label: 'call', activate: true },
    { from: 'b', to: 'c', label: 'insert' },
    { from: 'c', to: 'b', label: 'ref', kind: 'return' },
    { from: 'b', to: 'a', label: 'ok', kind: 'return' },
  ],
};

describe('expandSequence', () => {
  it('is a no-op for a non-sequence manifest', () => {
    const m = { title: 'x', viewBox: { width: 10, height: 10 }, marks: [{ kind: 'rect', x: 0, y: 0, w: 1, h: 1 }] };
    expect(expandSequence(m)).toBe(m);
  });

  it('lowers a sequence into a valid diagram (viewBox + marks)', () => {
    const out = expandSequence(SPEC);
    expect(out.viewBox.width).toBeGreaterThan(0);
    expect(out.viewBox.height).toBeGreaterThan(0);
    expect(Array.isArray(out.marks)).toBe(true);
    // The lowered manifest must pass the kernel diagram validator.
    expect(validateDiagramManifest(out).ok).toBe(true);
  });

  it('emits a lifeline + header per actor and a message line per message', () => {
    const out = expandSequence(SPEC);
    const lifelines = out.marks.filter((m) => m.kind === 'line' && m.dash === '3 4');
    const headers = out.marks.filter((m) => m.kind === 'rect' && m.rx === 6);
    const messageLines = out.marks.filter((m) => m.kind === 'line' && m.head === 'arrow');
    expect(lifelines).toHaveLength(3);
    expect(headers).toHaveLength(3);
    expect(messageLines).toHaveLength(4);
  });

  it('derives an activation bar from `activate`', () => {
    const out = expandSequence(SPEC);
    const bars = out.marks.filter((m) => m.kind === 'rect' && m.fill === 'rgba(20,184,166,0.18)');
    expect(bars.length).toBeGreaterThanOrEqual(1);
    expect(bars[0].h).toBeGreaterThan(0);
  });

  it('draws a self-message (from===to) as a loopback polyline with a head', () => {
    const out = expandSequence({
      kind: 'sequence',
      title: 'self',
      actors: [{ id: 'a', label: 'A' }],
      messages: [{ from: 'a', to: 'a', label: 'retry' }],
    });
    const loop = out.marks.find((m) => m.kind === 'polyline' && m.head === 'arrow');
    expect(loop).toBeTruthy();
    expect(loop.points.length).toBe(4);
  });

  it('is deterministic (same spec → identical marks)', () => {
    expect(JSON.stringify(expandSequence(SPEC))).toBe(JSON.stringify(expandSequence(SPEC)));
  });

  it('rejects a spec with no actors', () => {
    expect(() => expandSequence({ kind: 'sequence', title: 'x', actors: [] })).toThrow(/actors must be a non-empty array/);
  });

  it('rejects a message referencing an unknown actor', () => {
    expect(() =>
      expandSequence({ kind: 'sequence', title: 'x', actors: [{ id: 'a', label: 'A' }], messages: [{ from: 'a', to: 'z' }] }),
    ).toThrow(/does not match any actor id/);
  });

  it('rejects an unknown message kind', () => {
    expect(() =>
      expandSequence({ kind: 'sequence', title: 'x', actors: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], messages: [{ from: 'a', to: 'b', kind: 'shout' }] }),
    ).toThrow(/kind must be one of/);
  });
});
