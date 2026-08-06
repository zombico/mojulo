import { describe, expect, it } from 'vitest';

import { RUNTIME_CHANNELS, channelRuntimeSection, mojStepCalls, normalizeRuntimeChannels } from './channels/index.js';
import { emitThreeWorld } from './scene-three.js';

// ── registry round-trip (renderer-emitter.plan.md E2b exit criterion) ──────────────
// Every row must be fully wired: its let-binding present in every page, its step call
// in __mojStep exactly once, and (for normalize rows) absent-payload ⇒ zero block bytes.

const quad = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888888' };

describe('RUNTIME_CHANNELS registry', () => {
  it('keys are unique and rows are well-formed', () => {
    const keys = RUNTIME_CHANNELS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of RUNTIME_CHANNELS) {
      expect(Array.isArray(r.comment) && r.comment.length, r.key).toBeTruthy();
      if (r.normalize) expect(typeof r.script, r.key).toBe('function');
      if (r.step) expect(r.lets, r.key).toBeTruthy(); // a stepped channel needs its inert binding
    }
  });

  it('every let-binding and step call lands in a bare page exactly once', () => {
    const html = emitThreeWorld({ faces: [quad] });
    for (const r of RUNTIME_CHANNELS) {
      if (r.lets) for (const line of r.lets.split('\n')) expect(html.split(line).length - 1, `${r.key} let`).toBe(1);
      if (r.step) expect(html.split(r.step).length - 1, `${r.key} step`).toBe(1);
    }
    const stepLine = `function __mojStep(t) { ${mojStepCalls()} }`;
    expect(html).toContain(stepLine);
  });

  it('normalize rows: absent payload → empty block; section text is registry-generated', () => {
    const { lists, blocks } = normalizeRuntimeChannels({});
    for (const r of RUNTIME_CHANNELS) {
      if (!r.normalize) continue;
      expect(lists[r.key], r.key).toBeNull();
      expect(blocks[r.key], r.key).toBe('');
    }
    const section = channelRuntimeSection(blocks);
    for (const r of RUNTIME_CHANNELS) for (const c of r.comment) expect(section).toContain(c);
  });

  it('step order preserves the physics-before-events contract', () => {
    const calls = mojStepCalls();
    expect(calls.indexOf('stepPhysics(t);')).toBeGreaterThan(-1);
    expect(calls.indexOf('stepPhysics(t);')).toBeLessThan(calls.indexOf('stepEvents(t);'));
    expect(calls.indexOf('stepSigns(t);')).toBeLessThan(calls.indexOf('stepPhysics(t);'));
  });
});
