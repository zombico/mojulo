// The construction shelf's deep sweep: every machine over its joints' whole ranges, finely (every ram within its
// stroke, every linkage closed, every link at its length, every body on its parent's joint), and every machine at every
// named pose assembled with every law read. The law tests pick one machine per procedure; this walks them all.
import { describe, it, expect } from 'vitest';
import { CON_ARCHETYPES, assembleMachine, machineCtx, posedJoints } from './index.js';
import { apply } from './con-common.js';
import { rangeOf, solveChain } from './con-chain.js';

const span = (r, n) => Array.from({ length: n + 1 }, (_, i) => r[0] + ((r[1] - r[0]) * i) / n);

describe.each(Object.keys(CON_ARCHETYPES))('%s', (id) => {
  const ctx = machineCtx(id), arch = ctx.arch;
  it('holds together over every joint\'s range', () => {
    const rest = posedJoints(id, 'rest');
    for (const [name, J] of Object.entries(arch.joints)) {
      const r = rangeOf(arch, name, ctx) ?? [-180, 180];
      for (const v of span(r, 40)) {
        const C = solveChain(arch, { ...rest, [name]: v }, ctx);
        expect(C.clamped, `${name} ${v}`).toEqual([]);
        for (const s of C.struts) {
          const row = ctx.row(ctx.entry(s.id).sku);
          if (s.kind === 'barrel') expect(s.length >= row.dims.closed - 1e-6 && s.length <= row.dims.closed + row.dims.stroke + 1e-6, `${s.item} at ${name} ${v}`).toBe(true);
          if (s.kind === 'link') expect(Math.abs(s.length - row.dims.length), `${s.item} at ${name} ${v}`).toBeLessThan(1e-6);
        }
        for (const e of arch.layout.filter((x) => x.on)) {
          const i = e.on.indexOf('.'), [p, hp] = [e.on.slice(0, i), e.on.slice(i + 1)], a = apply(C.frames[e.id], [0, 0, 0]), b = apply(C.frames[p], ctx.hp(p, hp));
          expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), `${e.id} at ${name} ${v}`).toBeLessThan(1e-9);
        }
      }
      void J;
    }
  });
  it('assembles at every named pose, its laws read', () => {
    for (const pose of Object.keys(arch.poses)) {
      const { manifest, readout } = assembleMachine(id, { pose });
      expect(manifest.items.length, pose).toBeGreaterThan(arch.layout.length);
      expect(readout.laws.laws.length, pose).toBeGreaterThan(0);
      expect(readout.clamped, pose).toBeUndefined();
    }
  });
});
