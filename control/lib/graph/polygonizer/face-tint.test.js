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

  it('the socket: the brow shadows the eye, nothing above the brow or below the eye\'s hollow', () => {
    const { mesh } = built({ cast: 'female', form: 'tiered' }), V = mesh.vertices, F = mesh.faces, partOf = (fi) => mesh.provenance[F[fi][0]].part;
    const S = TIERED_FACE_TINT.female, on = faceTint(mesh, S), off = faceTint(mesh, { ...S, socket: null });
    const box = (re) => { const a = []; mesh.provenance.forEach((pv, vi) => { if (re.test(pv.part)) a.push(V[vi]); }); return [0, 1, 2].map((k) => [Math.min(...a.map((p) => p[k])), Math.max(...a.map((p) => p[k]))]); };
    const eye = box(/^eyeR$/), brow = box(/^browR$/), mid = (eye[0][0] + eye[0][1]) / 2;
    // the corners between the eye's top and the brow, over the eye: darker than without the socket, by a share of k
    const ratio = []; F.forEach((t, fi) => { if (!on[fi] || !/^cranium$/.test(partOf(fi))) return; t.forEach((vi, k) => { const p = V[vi];
      if (p[2] > eye[2][1] && p[2] < brow[2][0] && Math.abs(p[0] - mid) < (eye[0][1] - eye[0][0]) / 2 && p[1] > eye[1][0] - 0.02) ratio.push(on[fi][k][0] / off[fi][k][0]); }); });
    expect(ratio.length).toBeGreaterThan(0);
    expect(Math.min(...ratio)).toBeLessThan(1 - 0.25 * S.socket.k * S.socket.shade[0]);
    expect(Math.min(...ratio)).toBeGreaterThanOrEqual(1 - S.socket.k - 1e-3);
    // the cheek and the forehead do not
    F.forEach((t, fi) => { if (!on[fi] || !/^(cranium|jaw)$/.test(partOf(fi))) return; t.forEach((vi, k) => { const p = V[vi];
      if (p[2] > brow[2][1] + 0.02 || p[2] < eye[2][0] - 0.03) expect(on[fi][k]).toEqual(off[fi][k]); }); });
    // the male's ridge sets his deeper
    expect(TIERED_FACE_TINT.male.socket.k).toBeGreaterThan(S.socket.k);
  }, 120000);
});
