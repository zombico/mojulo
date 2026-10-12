// western-face-rig — the landmark hero's face as blend shapes: a target per channel end, differenced from head builds;
// the channels linear, so a word's weights put back its build; the eyes drawn at the knots; the guards; the tracks
// through the same weighing (a key's face, the ambient blink).
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { westernFaceRig, westernWeights, westernState, westernKnots, WESTERN_FACE_TARGETS, WESTERN_EYE_KNOTS } from './western-face-rig.js';
import { heroFaceTracks } from './anime-face-tracks.js';
import { EXPRESSIONS, resolveWesternExpression } from './humanoid-head.js';

const built = (spec) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ register: 'lowpoly', ...spec }) }); return { m, mesh: compileLayered(m.recipe, m.dials || {}, m.channels || {}) }; };
const W = (ch) => westernWeights(westernState(resolveWesternExpression(ch)));
const at = (w, name) => w[WESTERN_FACE_TARGETS.indexOf(name)];

describe('the western face\'s weights', () => {
  it('each channel weighs its own target by its value over the range end; the signs split', () => {
    expect(W('neutral').every((x) => x === 0)).toBe(true);
    expect(at(W({ mouthCorner: 0.005 }), 'smile')).toBe(0.5); expect(at(W({ mouthCorner: -0.003 }), 'frown')).toBe(0.5);
    expect(at(W({ browRaise: 0.015 }), 'browRaise')).toBe(1); expect(at(W({ browRaise: -0.005 }), 'browLower')).toBe(0.5);
    expect(at(W({ browTilt: 0.006 }), 'browAngry')).toBe(0.5); expect(at(W({ browTilt: -0.012 }), 'browWorried')).toBe(1);
    expect(at(W({ aperture: 1.2 }), 'eyeWide')).toBeCloseTo(0.5, 6); expect(at(W({ aperture: 0.75 }), 'eyeSquint')).toBeCloseTo(0.5, 6);
  });

  it('the blink and the aperture compose as the head builds them: the aperture weighs (a − 1)(1 − blink)', () => {
    const w = W({ aperture: 0.75, blink: 0.5 });
    expect(at(w, 'blink')).toBe(0.5); expect(at(w, 'eyeSquint')).toBeCloseTo(0.25, 6);
    expect(at(W({ aperture: 1.4, blink: 1 }), 'eyeWide')).toBe(0);   // shut is shut, however wide
    // the eyes are drawn at the knots: a 0.3 shows as 0.2, its own closure as itself
    expect(at(W({ blink: 0.3 }), 'blink')).toBe(0.2);
    expect(westernKnots({ blink: 0.3 }).eyeKnots).toEqual([...WESTERN_EYE_KNOTS, 0.3].sort((a, b) => a - b));
  });
});

describe('the western face rig', () => {
  const female = built({ cast: 'female', form: 'tiered', expression: 'smile' });
  const rig = westernFaceRig(female.m, female.mesh);

  it('a target per channel end over the head (the skin and every feature but the hair); the words and the authored face', () => {
    expect(rig.skipped).toBeUndefined();
    expect(rig.targets).toEqual([...WESTERN_FACE_TARGETS]);
    const W1 = (1 + rig.targets.length) * 3, n = rig.rows.length / W1;
    // every target moves something; the hair never moves
    rig.targets.forEach((t, ti) => { let moved = 0; for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) if (rig.rows[k * W1 + 3 + ti * 3 + c]) moved++; expect(moved, t).toBeGreaterThan(0); });
    rig.sub.forEach((k, i) => { if (k >= 0) expect(female.m.recipe.parts[female.mesh.provenance[i].part].group).not.toBe('Hair'); });
    expect(Object.keys(rig.meta.words)).toEqual([...Object.keys(EXPRESSIONS), 'authored']);
    expect(rig.meta.weights).toEqual(rig.meta.words.smile);
  }, 300000);

  it('the stored face: neutral + Σ w · target lands on the figure the row compiles', () => {
    const W1 = (1 + rig.targets.length) * 3; let worst = 0;
    rig.sub.forEach((k, i) => { if (k < 0) return; for (let c = 0; c < 3; c++) { let y = female.mesh.vertices[i][c] - rig.rows[k * W1 + c]; rig.meta.weights.forEach((w, ti) => { y += w * rig.rows[k * W1 + 3 + ti * 3 + c]; }); worst = Math.max(worst, Math.abs(y - female.mesh.vertices[i][c])); } });
    expect(worst).toBeLessThan(0.0003);
  }, 300000);

  it('a key\'s face and the ambient blink: the tracks weigh through the rig\'s own', () => {
    const hero = { ...female.m.hero, clips: { cheer: [{ support: 'both', face: { blink: 1 } }, { support: 'both', face: 'surprised' }] } };
    const T = heroFaceTracks(hero, { cheer: [{}, {}] }, null, rig.authored, rig.K);
    const w = T.tracks.cheer.w;
    expect(w.every((x) => x.length === WESTERN_FACE_TARGETS.length)).toBe(true);
    expect(w.some((x) => at(x, 'blink') === 1)).toBe(true);
    expect(w.some((x) => at(x, 'eyeWide') > 0.7)).toBe(true);
    expect(T.ambient.w.some((x) => at(x, 'blink') === 1)).toBe(true);
    expect(heroFaceTracks({ ...hero, blink: false }, { cheer: [{}, {}] }, null, rig.authored, rig.K).ambient).toBeUndefined();
  }, 300000);

  it('the guards: a row whose head is not the one it builds now is skipped by name; another head is none of its', () => {
    const stale = structuredClone(female.m); stale.hero.expression = 'determined';
    expect(westernFaceRig(stale, female.mesh).skipped).toMatch(/regenerate the row/);
    const anime = built({ cast: 'female', head: 'anime' });
    expect(westernFaceRig(anime.m, anime.mesh)).toBeNull();
  }, 300000);
});
