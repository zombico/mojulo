// Every family of every tradition, swept (the law tests pick one move per procedure; this walks them all): each
// compiles on its own tradition's guard, holds its fighter's laws, and seen from the side its round body is the sim's
// figure on every frame it is not turned about the vertical (the hands, the feet and the pelvis on the sim's points),
// so what the arena draws hitting is where the hitbox is.
import { describe, it, expect } from 'vitest';
import { TRADITIONS, FAMILIES, traditionRests } from './versus-traditions.js';
import { NORMAL_FAMILIES } from './versus-library.js';
import { compileFighter, compileNormal } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';
import { lawsFor } from './versus-laws.js';
import { rigJoints } from './versus-rig.js';
import { figureBase, figurePose } from './versus-figure.js';
import { newVersus, stepVersus } from './versus-core.js';
import { cpuPad, newCpuMemory } from './versus-cpu.js';

const homeOf = Object.fromEntries(Object.entries(TRADITIONS).flatMap(([t, T]) => Object.keys(T.moves).map((f) => [f, t])));
const near2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const side = (p) => [p[1] * 1000, p[2] * 1000];

describe('versus traditions, swept', () => {
  it('every tradition is a fighter whose laws hold', () => {
    for (const t of Object.keys(TRADITIONS)) {
      const F = compileFighter(solveFighter({ id: t, tradition: t }).recipe);
      expect(lawsFor(F).filter((l) => !l.ok).map((l) => l.id), t).toEqual([]);
    }
  });

  it('every family\'s frames, seen from the side, are the sim\'s figure wherever the body is not turned about the vertical', () => {
    const F = compileFighter(solveFighter({ id: 'k' }).recipe), base = figureBase(F.body);
    const worst = {};
    for (const [id, fam] of Object.entries(FAMILIES)) {
      const t = homeOf[id], rests = traditionRests(t) ?? undefined;
      const stance = t ? solveFighter({ id: 'k', tradition: t }).recipe.stance : F.stance;
      const m = compileNormal(F.body, `${fam.stance}.M`, { family: id }, null, rests);
      for (let f = 1; f <= m.total; f++) {
        const pose = m.frames[f].pose;
        if (Math.round((pose.spin ?? 0) % 360) !== 0 || Math.round(pose.bank ?? 0) !== 0) continue;
        const J = rigJoints(F.body, pose);
        for (const face of [1, -1]) {
          const N = figurePose(base, J, { face, air: !!pose.air, stance, twist: pose.twist ?? 0, sway: pose.sway ?? 0, tilt: pose.tilt ?? 0, ...(pose.hands ? { hands: pose.hands } : {}), ...(pose.feet ? { feet: pose.feet } : {}) });
          const lead = face > 0 ? 'L' : 'R', rear = lead === 'L' ? 'R' : 'L';
          let w = near2(side(N.pelvisHub), J.pelvis);
          for (const [S, X] of [[lead, 'F'], [rear, 'B']]) w = Math.max(w, near2(side(N[`wrist${S}`]), J[`hand${X}`]), near2(side(N[`toe${S}`]), J[`toe${X}`]));
          worst[id] = Math.max(worst[id] ?? 0, w);
        }
      }
    }
    const off = Object.entries(worst).filter(([, w]) => w >= 2).map(([id, w]) => `${id} ${Math.round(w)}mm`);
    expect(off).toEqual([]);
    expect(Object.keys(worst).length).toBe(Object.keys(FAMILIES).length);
    expect(Object.keys(NORMAL_FAMILIES).every((f) => FAMILIES[f] === NORMAL_FAMILIES[f])).toBe(true);
  });

  it('every tradition fights the next one, CPU against CPU, and blows land both ways', () => {
    const words = Object.keys(TRADITIONS);
    for (const [k, t] of words.entries()) {
      const ctx = { fighters: [t, words[(k + 1) % words.length]].map((w) => compileFighter(solveFighter({ id: w, tradition: w }).recipe)) };
      let s = newVersus(ctx, { rules: { intro: 1 } });
      const mem = [newCpuMemory(), newCpuMemory()], hurt = [0, 0];
      for (let f = 0; f < 1800; f++) {
        const pads = [0, 1].map((i) => { const r = cpuPad(s, ctx, i, mem[i]); mem[i] = r.mem; return r.pad; });
        s = stepVersus(s, pads, ctx);
        for (const e of s.events) if (e.t === 'hit' || e.t === 'counter') hurt[1 - e.p]++;
      }
      expect(hurt.every((n) => n > 0), `${t}: ${hurt}`).toBe(true);
    }
  });
});
