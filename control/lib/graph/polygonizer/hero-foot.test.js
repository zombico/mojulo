// hero-foot — the bare structured hero's foot: footwear replaces the foot, so only a bare structured hero has one; the
// big toe stands apart (the grip), the toes ride the toe bone, the rig's joints do not move.
import { describe, it, expect } from 'vitest';
import { heroPlan } from './hero-form.js';
import { TOES } from './hero-foot.js';
import { expandPlan } from './station-loft-plan.js';

const names = (plan) => plan.segments.map((s) => s.name);
const pts = (recipe, part) => recipe.parts[part].stations.flatMap((st) => Object.values(st.points));

describe('the bare foot', () => {
  const bare = heroPlan({ cast: 'male', bare: true }), shod = heroPlan({ cast: 'male' });
  it('footwear replaces the foot: only a bare structured hero has one, the shoe stays the shoe', () => {
    expect(names(bare)).toEqual(expect.arrayContaining(['footR', ...TOES.map((t) => `${t}R`)]));
    expect(names(bare)).not.toContain('toesR');
    expect(names(shod)).toEqual(expect.arrayContaining(['footR', 'toesR'])); expect(names(shod)).not.toContain('halluxR');
    expect(shod.segments.find((s) => s.name === 'footR').kind).toBe('segment');
    expect(names(heroPlan({ cast: 'male', bare: true, core: 'streamlined' }))).toContain('toesR');
  });
  it('the rig is the shoe\'s: the same joints and bones, every toe on the toe bone', () => {
    expect(bare.rig.joints).toEqual(shod.rig.joints); expect(bare.rig.bones).toEqual(shod.rig.bones);
    for (const t of TOES) expect(bare.segments.find((s) => s.name === `${t}R`).bind.bone).toBe('toesR');
  });
  it('the big toe stands apart from the second (the grip), the four side by side; the left mirrors the right', () => {
    const r = expandPlan(bare);
    const inner = (part) => Math.min(...pts(r, part).map((p) => p[0])), outer = (part) => Math.max(...pts(r, part).map((p) => p[0]));
    // the right foot: the big toe toward the body (smaller x)
    expect(inner('toe2R') - outer('halluxR')).toBeGreaterThan(0.003);
    for (const [a, b] of [['toe2R', 'toe3R'], ['toe3R', 'toe4R'], ['toe4R', 'toe5R']]) expect(inner(b) - outer(a)).toBeLessThan(0.002);
    for (const t of ['footR', ...TOES.map((x) => `${x}R`)]) {
      const R = pts(r, t).map((p) => [-p[0], p[1], p[2]].join()).sort(), L = pts(r, t.replace(/R$/, 'L')).map((p) => p.map((x) => x + 0).join()).sort();
      expect(L).toEqual(R);
    }
  });
  it('the sole stands on the floor (z 0); the shoe\'s sole sits a centimetre into it', () => {
    const lo = (plan) => { const r = expandPlan(plan); return Math.min(...Object.keys(r.parts).filter((n) => /^(foot|toes|hallux|toe\d)R$/.test(n)).flatMap((n) => pts(r, n).map((p) => p[2]))); };
    expect(lo(bare)).toBeGreaterThanOrEqual(0); expect(lo(bare)).toBeLessThan(0.002); expect(lo(shod)).toBeLessThan(lo(bare));
  });
});
