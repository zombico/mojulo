// The anime face rig in 7G (anime-face-rig.js sevenG, drawingWeights): the concepts. The gate: `acting: 'full'`, or a
// take on a target of T3 or higher, never the painted face, never `acting: 'basic'`. A 7G rig keeps the four channels'
// targets and rows as they were and appends the drawings' and the correctives'. A face drawn per layer, weighed onto the
// targets, IS the exact build of its drawings: the layers that add, and the pairs that do not through their correctives
// (a lid's shape over a turned gaze, a brow's over its shut eye).
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { animeHeadAt } from './humanoid-plan.js';
import { heroFaceRig, faceRigOptions, sevenG, drawingWeights, drawTarget, fixTarget, SEVEN_G, FACE_TARGETS } from './anime-face-rig.js';
import { DRAWINGS, drawingWords } from './anime-drawings.js';

const mint = (spec) => { const M = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }); return { M, mesh: compileLayered(M.recipe, M.dials) }; };
const SPEC = { cast: 'male', head: 'anime', register: 'lowpoly' };

describe('the gate', () => {
  it('draws 7G when asked, or for a take on a T3 or higher target; never painted, never basic', () => {
    const take = { line: { beats: [{ at: 0, face: 'happiness' }] } };
    expect(sevenG(heroRecord(SPEC))).toBe(false);
    expect(sevenG(heroRecord({ ...SPEC, acting: 'full' }))).toBe(true);
    expect(sevenG(heroRecord({ ...SPEC, perform: take }))).toBe(false);   // (the default target is T2)
    expect(sevenG(heroRecord({ ...SPEC, perform: take, target: { resolution: '1440p', framing: 'close' } }))).toBe(true);
    expect(sevenG(heroRecord({ ...SPEC, perform: take, target: { resolution: '1440p', framing: 'close' }, acting: 'basic' }))).toBe(false);
    expect(sevenG({ ...heroRecord({ ...SPEC, acting: 'full' }), painterly: true })).toBe(false);
  });
});

describe('a 7G rig', () => {
  const plain = mint(SPEC), full = mint({ ...SPEC, acting: 'full' });
  const F0 = heroFaceRig(plain.M, plain.mesh), F = heroFaceRig(full.M, full.mesh);
  it('keeps the channels\' targets and rows, and appends the drawings\' and the correctives\'', () => {
    expect(F0.targets).toEqual(FACE_TARGETS); expect(F0.meta.sevenG).toBeUndefined(); expect(F0.K).toBeUndefined();
    expect(F.targets.slice(0, FACE_TARGETS.length)).toEqual(FACE_TARGETS);
    for (const n of [drawTarget('brows.angry', 'L'), drawTarget('mouth.a'), drawTarget('gaze.left'), fixTarget('lids.angry', 'gaze.left', 'R'), fixTarget('brows.worried', 'shut', 'L')]) expect(F.targets).toContain(n);
    expect(F.meta.sevenG.targets).toBe(F.targets.length - FACE_TARGETS.length); expect(F.meta.sevenG.bytes).toBeGreaterThan(0);
    // (the channels' columns of every row as the plain rig's)
    const W0 = (1 + F0.targets.length) * 3, W = (1 + F.targets.length) * 3;
    for (let i = 0; i < plain.mesh.vertices.length; i += 97) { const k0 = F0.sub[i], k = F.sub[i]; if (k0 < 0) continue; for (let c = 0; c < W0; c++) expect(F.rows[k * W + c]).toBe(F0.rows[k0 * W0 + c]); }
  });
  it('draws a face per layer as the exact build of its drawings, the pairs that do not add through their correctives', () => {
    const { opts } = faceRigOptions(full.M.hero), head = full.M.plan.include.find((p) => p.name === 'head');
    const X = Object.keys(head.parts).filter((n) => !/^(cranium|ear[LR]|noseLine|hair)/.test(n) && full.M.recipe.parts[n]);
    const W = (1 + F.targets.length) * 3;
    // (the face the rig's targets draw at weights w, against the head built at those words)
    const check = (state, E = {}) => {
      const words = drawingWords({ brows: state.brows?.L, lids: state.lids?.L, gaze: state.gaze, mouth: state.mouth }), w = drawingWeights({ eyeL: E.blink ?? 0, eyeR: E.blink ?? 0, smile: 0, open: 0, brow: 0, ...state }, F.K);
      const exact = compileLayered({ ...full.M.recipe, parts: { ...full.M.recipe.parts, ...animeHeadAt(opts, E, X, words) } }, full.M.dials).vertices;
      let worst = 0;
      for (let i = 0; i < full.mesh.vertices.length; i++) {
        const k = F.sub[i]; if (k < 0) continue;
        const p = full.mesh.vertices[i].map((x, c) => x - F.rows[k * W + c] + w.reduce((t, wt, ti) => t + (wt ? wt * F.rows[k * W + 3 + ti * 3 + c] : 0), 0));
        worst = Math.max(worst, Math.hypot(...p.map((x, c) => x - exact[i][c])));
      }
      return worst;
    };
    const both = (n) => ({ L: n, R: n });
    expect(check({ brows: both('brows.angry'), lids: both('lids.sad'), mouth: 'mouth.a' })).toBeLessThan(1e-5);
    expect(check({ lids: both('lids.angry'), gaze: 'gaze.right' })).toBeLessThan(1e-5);
    expect(check({ brows: both('brows.worried') }, { blink: 1 })).toBeLessThan(1e-5);
  });
  it('weighs one eye\'s drawing alone, a sided mouth on its side, a lid\'s shape only on an open eye', () => {
    const w = (state) => Object.fromEntries(F.targets.map((n, i) => [n, drawingWeights({ eyeL: 0, eyeR: 0, smile: 0, open: 0, brow: 0, ...state }, F.K)[i]]).filter(([, x]) => x));
    expect(w({ brows: { L: 'brows.raised', R: null } })).toEqual({ [drawTarget('brows.raised', 'L')]: 1 });
    expect(w({ mouth: 'mouth.smirk', mouthSide: 'R' })).toEqual({ [drawTarget('mouth.smirk', 'R')]: 1 });
    expect(Object.keys(w({ eyeL: 1, eyeR: 1, lids: { L: 'lids.angry', R: 'lids.angry' } })).some((n) => n.startsWith('drawLids'))).toBe(false);
    expect(SEVEN_G.drawings.every((n) => DRAWINGS[n].words)).toBe(true);
  });
}, 300000);
