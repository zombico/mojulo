// The construction shelf's deep sweep: every machine over its joints' whole ranges, finely (every ram within its
// stroke, every linkage closed, every link at its length, every body on its parent's joint), and every machine at every
// named pose assembled with every law read. The law tests pick one machine per procedure; this walks them all.
import { describe, it, expect } from 'vitest';
import { CON_ARCHETYPES, CON_MOUNTS, assembleMachine, composeMachine, machineCtx, posedJoints } from './index.js';
import { apply } from './con-common.js';
import { rangeOf, solveChain } from './con-chain.js';

const span = (r, n) => Array.from({ length: n + 1 }, (_, i) => r[0] + ((r[1] - r[0]) * i) / n);

// (every machine, and every tool on every machine whose mount takes it; a machine built in sections at its fewest
// and its most)
const MACHINES = Object.keys(CON_ARCHETYPES).flatMap((k) => [k, ...(CON_ARCHETYPES[k].mount ? Object.keys(CON_MOUNTS[CON_ARCHETYPES[k].mount.family].tools).map((t) => composeMachine(k, { tool: t })).filter((c) => c !== k) : []),
  ...(CON_ARCHETYPES[k].sections ? [composeMachine(k, { height: 0 }), composeMachine(k, { height: 1000 })] : [])]);

describe.each(MACHINES)('%s', (id) => {
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
        // (every body's pivot on its parent's hardpoint; a slide's along its axis from it)
        for (const e of arch.layout.filter((x) => x.on)) {
          const i = e.on.indexOf('.'), [p, hp] = [e.on.slice(0, i), e.on.slice(i + 1)], a = apply(C.frames[e.id], [0, 0, 0]), b = apply(C.frames[p], ctx.hp(p, hp));
          const d = a.map((x, k) => x - b[k]), slide = e.joint && arch.joints[e.joint].kind === 'slide';
          // (a slide's axis in its parent's frame turned its `turn`; a plumb body's the machine's own)
          const J = slide ? arch.joints[e.joint] : null, ax0 = J ? J.axis ?? (e.plumb ? [0, 0, -1] : [0, 1, 0]) : null, c = Math.cos(((e.turn ?? 0) * Math.PI) / 180), sn = Math.sin(((e.turn ?? 0) * Math.PI) / 180);
          const ax = !slide ? [0, 0, 0] : e.plumb ? ax0 : apply({ R: C.frames[p].R, t: [0, 0, 0] }, [c * ax0[0] - sn * ax0[1], sn * ax0[0] + c * ax0[1], ax0[2]]), t = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2];
          expect(Math.hypot(d[0] - ax[0] * t, d[1] - ax[1] * t, d[2] - ax[2] * t), `${e.id} at ${name} ${v}`).toBeLessThan(1e-9);
        }
      }
      void J;
    }
  });
  it('assembles at every named pose, its laws read', () => {
    for (const pose of Object.keys(arch.poses)) {
      const { manifest, readout } = assembleMachine(id, { pose });
      // (each body an item, each ram's barrel, stages and rod items besides; a machine with no ram, a mixer, its bodies)
      expect(manifest.items.length, pose).toBeGreaterThanOrEqual(arch.layout.length);
      expect(readout.laws.laws.length, pose).toBeGreaterThan(0);
      expect(readout.clamped, pose).toBeUndefined();
    }
  });
});
