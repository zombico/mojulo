import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { EMIT_FIXTURES } from './emit-fixtures.js';
import { emitThreeWorld } from './scene-three.js';

// ── characterization net (renderer-emitter.plan.md E2a) ────────────────────────────
// Hash-pins emitThreeWorld's emission for the whole fixture matrix. The E2b registry
// refactor must keep every hash IDENTICAL — that is the proof it is byte-pure. A hash
// here may only change when a plan step SAYS emission changes (and then the step's
// notes must name the fixtures it touched). To inspect a mismatch, dump both sides:
//   node -e "import('./lib/graph/scene/emit-fixtures.js').then(async ({EMIT_FIXTURES}) => {
//     const {emitThreeWorld} = await import('./lib/graph/scene/scene-three.js');
//     const fx = EMIT_FIXTURES.find(([n]) => n === '<name>');
//     process.stdout.write(emitThreeWorld(fx[1]));
//   })" > /tmp/emission.html
// and diff against the same dump from a clean checkout.

const sha = (s) => createHash('sha256').update(s).digest('hex');

describe('emitThreeWorld characterization (byte-level pin over the fixture matrix)', () => {
  it.each(EMIT_FIXTURES.map(([name]) => name))('%s emits byte-identically', (name) => {
    const [, opts] = EMIT_FIXTURES.find(([n]) => n === name);
    expect(sha(emitThreeWorld(opts))).toMatchSnapshot();
  });

  it('emission is deterministic (two calls, same bytes) for every fixture', () => {
    for (const [name, opts] of EMIT_FIXTURES) {
      expect(emitThreeWorld(opts), name).toBe(emitThreeWorld(opts));
    }
  });
});
