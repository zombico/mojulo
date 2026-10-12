import { describe, it, expect } from 'vitest';
import { faceTint } from './face-tint.js';
import { TIERED_FACE_TINT, tieredPole } from './tiered-form.js';
import { heroRecord, expandLayeredManifest, planLayered } from '../../mcp/tools/layered.js';

const built = (spec) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }); return { m, mesh: planLayered(m).mesh }; };

describe('the face tint', () => {
  it('touches the head\'s skin only: the folds darker, the cheeks warmer, nothing without a tint', () => {
    const { m, mesh } = built({ cast: 'female', form: 'tiered' });
    expect(tieredPole(m.hero)).toBe('female');
    const t = faceTint(mesh, TIERED_FACE_TINT.female), partOf = (fi) => mesh.provenance[mesh.faces[fi][0]].part;
    mesh.faces.forEach((_, fi) => { if (t[fi]) expect(partOf(fi)).toMatch(/^(cranium|jaw|ear[RL])$/); });
    const all = t.filter(Boolean).flat();
    expect(Math.min(...all.map((c) => c[0]))).toBeLessThan(0.9);                 // a fold darkens
    expect(all.some((c) => c[1] < c[0] * 0.95)).toBe(true);                       // a blush: green below red
    expect(Math.max(...all.flat())).toBeLessThanOrEqual(1);                       // a tint only ever darkens or warms down
    expect(faceTint(mesh, {})).toBeNull();
    // the crease round the nose's wing darkens beyond the occlusion alone
    const noGroove = faceTint(mesh, { ...TIERED_FACE_TINT.female, groove: null }).filter(Boolean).flat();
    expect(Math.min(...all.map((x) => x[0]))).toBeLessThanOrEqual(Math.min(...noGroove.map((x) => x[0])));
    expect(all.reduce((t, x) => t + x[0], 0)).toBeLessThan(noGroove.reduce((t, x) => t + x[0], 0));
    // the male's blush is the lighter
    const male = built({ cast: 'male', form: 'tiered' }), tm = faceTint(male.mesh, TIERED_FACE_TINT.male).filter(Boolean).flat();
    const warmth = (cs) => Math.max(...cs.map((c) => c[0] - c[1]));
    expect(warmth(tm)).toBeLessThan(warmth(all));
  }, 120000);
});
