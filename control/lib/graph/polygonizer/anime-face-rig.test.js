/** The anime hero's face as blend shapes (anime-face-rig.js): the authored weights are the drawn face, the head builds are
 * the head the hero wears (bald equal to haired, at the plan's scale), every expression word's blend lands on a true door
 * build of that word, the one-eye targets split the blink exactly, a second call builds nothing, a hero whose own lid
 * closure sits between the knots is drawn at it (the default face the stored one), and a row whose head is not the one
 * the hero builds now, or whose dial moves the head, exports without the face (a reason, never a wrong face). */
import { describe, it, expect, vi } from 'vitest';

// the head builds, counted (a cache hit builds nothing)
vi.mock('./humanoid-plan.js', async (importOriginal) => { const m = await importOriginal(); return { ...m, animeHeadAt: vi.fn(m.animeHeadAt) }; });
import { animeHeadAt } from './humanoid-plan.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { ANIME_POSES, resolveAnimeExpression } from './anime-head.js';
import { heroFaceRig, faceRigOptions, faceWeights, faceState, faceWords, faceKnots, fixName, drawEye, FACE_TARGETS, FACE_BUILDS, EYE_KNOTS, FIX_KNOTS } from './anime-face-rig.js';

const mintOf = (spec) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
const LOW = { cast: 'male', head: 'anime', register: 'lowpoly', expression: ['determined', { smile: 0.3 }] };   // an authored face off the neutral: the rows carry a rebase
const M = mintOf(LOW), FULL = compileLayered(M.recipe, M.dials);
const named = (w) => Object.fromEntries(FACE_TARGETS.map((n, i) => [n, w[i]]).filter(([, x]) => x));
/** per figure vertex: the neutral head (V0) and each target, from the rows (a vertex without a row does not move) */
function unpack(F, mesh) {
  const W = (1 + F.targets.length) * 3, n = mesh.vertices.length, V0 = mesh.vertices.map((v) => [...v]), T = F.targets.map(() => new Float64Array(n * 3));
  for (let i = 0; i < n; i++) { const k = F.sub[i]; if (k < 0) continue; for (let c = 0; c < 3; c++) V0[i][c] -= F.rows[k * W + c]; T.forEach((t, ti) => { for (let c = 0; c < 3; c++) t[i * 3 + c] = F.rows[k * W + 3 + ti * 3 + c]; }); }
  return { V0, T };
}

describe('anime-face-rig: the contract', () => {
  it("the authored weights of ['smile', { open: 0.3 }] are the drawn face (the eyes at the 0.12 knot with its correctives)", () => {
    expect(named(faceWeights(faceState(resolveAnimeExpression(['smile', { open: 0.3 }]))))).toEqual({ blink: 0.12, smile: 1, mouthOpen: 0.3, browInnerLower: 0.3, blinkFix12L: 1, blinkFix12R: 1 });
    expect(FACE_TARGETS.length).toBe(7 + 2 * FIX_KNOTS.length);
    expect(Object.keys(FACE_BUILDS).length).toBe(6 + FIX_KNOTS.length);
    // every word's weights, in the words' order, then the hero's own; an eye is always drawn at a knot
    const words = faceWords(resolveAnimeExpression('angry'));
    expect(Object.keys(words)).toEqual([...Object.keys(ANIME_POSES), 'authored']);
    expect(words.authored).toEqual(words.angry);
    expect(named(words.happy)).toEqual({ blink: 1, smile: 1, browInnerRaise: 0.2 });
    for (const e of [0, 0.05, 0.11, 0.3, 0.74, 0.76, 1]) expect(EYE_KNOTS).toContain(drawEye(e));
    expect(drawEye(0.3)).toBe(0.2); expect(drawEye(0.76)).toBe(1);
    // the correctives' names: a closure's decimals, two at least
    expect(FIX_KNOTS.map((k) => fixName(k, 'L'))).toEqual(['blinkFix10L', 'blinkFix12L', 'blinkFix18L', 'blinkFix20L', 'blinkFix50L']);
    expect([0.35, 0.6, 0.125, 0.05].map((k) => fixName(k, 'R'))).toEqual(['blinkFix35R', 'blinkFix60R', 'blinkFix125R', 'blinkFix05R']);
    // a hero's own closure between the knots is drawn at it: its words keep their knots, its own face its own
    const own = resolveAnimeExpression(['neutral', { blink: 0.35 }]), K = faceKnots(own), ow = faceWords(own);
    expect(K.targets.slice(0, FACE_TARGETS.length)).toEqual([...FACE_TARGETS]);
    expect(Object.fromEntries(K.targets.map((n, i) => [n, ow.authored[i]]).filter(([, x]) => x))).toEqual({ blink: 0.35, blinkFix35L: 1, blinkFix35R: 1 });
    expect(ow.happy).toEqual([...faceWeights(faceState(resolveAnimeExpression('happy'))), 0, 0]);
  });

  it('the head builds are the head the hero wears: a female (round) and a male (lowpoly) at their authored expression, bald equal to haired', () => {
    for (const spec of [{ cast: 'female', head: 'anime', expression: ['smile', { open: 0.3 }], tune: { stature: 1.04, head: 1.05 } }, LOW]) {
      const m = spec === LOW ? M : mintOf(spec), head = m.plan.include.find((i) => i.name === 'head');
      const names = Object.keys(head.parts).filter((n) => n !== 'cranium' && !n.startsWith('hair'));
      const { opts, authored } = faceRigOptions(m.hero);
      const parts = animeHeadAt(opts, authored, names);
      expect(Object.keys(parts)).toEqual(names);
      for (const n of names) expect(JSON.stringify(parts[n]), `${spec.cast} ${n}`).toBe(JSON.stringify(m.recipe.parts[n]));
    }
  });
});

describe('anime-face-rig: a hero drawn at its own closure', () => {
  it('a lid closure between the knots (0.35) is its own knot, its corrective pair appended: the default weights put back the stored face', () => {
    const spec = { cast: 'female', head: 'anime', register: 'lowpoly', expression: ['neutral', { blink: 0.35 }] };
    const m = mintOf(spec), mesh = compileLayered(m.recipe, m.dials), F = heroFaceRig(m, mesh);
    expect(F.skipped).toBeUndefined();
    expect(F.targets).toEqual([...FACE_TARGETS, 'blinkFix35L', 'blinkFix35R']);
    expect(F.meta.eyeKnots).toEqual([0, 0.1, 0.12, 0.18, 0.2, 0.35, 0.5, 1]); expect(F.meta.fixKnots).toEqual([...FIX_KNOTS, 0.35]);
    const { V0, T } = unpack(F, mesh);
    let worst = 0;
    for (let i = 0; i < V0.length; i++) { const o = [...V0[i]]; F.meta.weights.forEach((x, t) => { if (x) for (let c = 0; c < 3; c++) o[c] += x * T[t][i * 3 + c]; }); worst = Math.max(worst, Math.hypot(o[0] - mesh.vertices[i][0], o[1] - mesh.vertices[i][1], o[2] - mesh.vertices[i][2])); }
    expect(worst, `${(worst * 1000).toFixed(4)} mm`).toBeLessThan(1e-6);
    // drawn at the nearest standard knot instead (0.5), the face is millimetres off: the reason for the knot
    const snapped = faceWeights(faceState(resolveAnimeExpression(['neutral', { blink: 0.35 }])));
    let off = 0;
    for (let i = 0; i < V0.length; i++) { const o = [...V0[i]]; snapped.forEach((x, t) => { if (x) for (let c = 0; c < 3; c++) o[c] += x * T[t][i * 3 + c]; }); off = Math.max(off, Math.hypot(o[0] - mesh.vertices[i][0], o[1] - mesh.vertices[i][1], o[2] - mesh.vertices[i][2])); }
    expect(off).toBeGreaterThan(0.001);
  });
});

describe('anime-face-rig: the targets on a lowpoly male', () => {
  const F = heroFaceRig(M, FULL);
  const { V0, T } = unpack(F, FULL);
  const at = (name) => T[FACE_TARGETS.indexOf(name)];
  const blend = (w) => V0.map((v, i) => { const o = [...v]; w.forEach((x, t) => { if (x) for (let c = 0; c < 3; c++) o[c] += x * T[t][i * 3 + c]; }); return o; });

  it('every expression word (and the authored face) blends within 0.3 mm of a true door build of that word, at every moving vertex', () => {
    expect(F.skipped).toBeUndefined();
    expect(F.meta.targets).toEqual([...FACE_TARGETS]);
    expect(F.meta.weights).toEqual(faceWeights(faceState(F.authored)));
    const words = { ...Object.fromEntries(Object.keys(ANIME_POSES).map((w) => [w, w])), authored: M.hero.expression ?? 'neutral' };
    for (const [word, expression] of Object.entries(words)) {
      const truth = compileLayered(mintOf({ ...LOW, expression }).recipe, M.dials).vertices, B = blend(F.meta.words[word]);
      let worst = 0, moving = 0;
      for (let i = 0; i < truth.length; i++) {
        const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d(truth[i], V0[i]) <= 1e-6 && d(B[i], V0[i]) <= 1e-6) continue;
        moving++; worst = Math.max(worst, d(B[i], truth[i]));
      }
      expect(worst, `${word}: ${(worst * 1000).toFixed(3)} mm over ${moving} vertices`).toBeLessThan(0.0003);
      if (word !== 'neutral') expect(moving, word).toBeGreaterThan(0);
    }
  });

  it('the one-eye targets split the blink exactly, and nothing the lids move lies within 4 mm of the midline', () => {
    const b = at('blink'), l = at('blinkLeft'), r = at('blinkRight');
    let movers = 0, nearest = Infinity;
    for (let i = 0; i < V0.length; i++) {
      for (let c = 0; c < 3; c++) expect(l[i * 3 + c] + r[i * 3 + c] - b[i * 3 + c]).toBe(0);
      if (Math.hypot(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]) > 1e-6) { movers++; nearest = Math.min(nearest, Math.abs(V0[i][0])); }
    }
    expect(movers).toBeGreaterThan(100);
    expect(nearest).toBeGreaterThanOrEqual(0.004);
    // Left is mesh −x: its movers are all on the figure's left
    for (let i = 0; i < V0.length; i++) if (Math.hypot(l[i * 3], l[i * 3 + 1], l[i * 3 + 2]) > 1e-6) expect(V0[i][0]).toBeLessThan(0);
  });

  it('a second call builds nothing (the targets are kept per head); another head builds each of its builds once', () => {
    heroFaceRig(M, FULL); animeHeadAt.mockClear();
    const again = heroFaceRig(M, FULL);
    expect(animeHeadAt).not.toHaveBeenCalled();
    expect(Buffer.from(again.rows.buffer).equals(Buffer.from(F.rows.buffer))).toBe(true);
    const other = mintOf({ ...LOW, face: { eyeWidth: 1.03 } });
    expect(heroFaceRig(other, compileLayered(other.recipe, other.dials)).skipped).toBeUndefined();
    expect(animeHeadAt).toHaveBeenCalledTimes(Object.keys(FACE_BUILDS).length + 1);   // and the build at its own expression (the guard)
  });

  it('a dial that moves the head, or a stored head the hero no longer builds, exports without the face and says why', () => {
    expect(heroFaceRig(M, compileLayered(M.recipe, { ...M.dials, lean: 12 })).skipped).toMatch(/a dial or channel moves the head/);
    const ear = structuredClone(M); const v0 = Object.keys(ear.recipe.parts.earL.offsets)[0]; ear.recipe.parts.earL.offsets[v0] = ear.recipe.parts.earL.offsets[v0].map((x) => x + 0.001);
    expect(heroFaceRig(ear, compileLayered(ear.recipe, ear.dials)).skipped).toMatch(/the stored head is not the head this hero builds now/);
    const face = structuredClone(M); const f0 = Object.keys(face.recipe.parts.face.faces)[0]; face.recipe.parts.face.faces[f0] = [...face.recipe.parts.face.faces[f0]].reverse();
    expect(heroFaceRig(face, compileLayered(face.recipe, face.dials)).skipped).toMatch(/the stored head is not the head this hero builds now/);
    // a moving part with its layout kept but a point moved (a lid stored by older head code) is caught at the hero's own
    // expression, not only by its faces
    const lid = structuredClone(M); const l0 = Object.keys(lid.recipe.parts.lidL.offsets)[0]; lid.recipe.parts.lidL.offsets[l0] = lid.recipe.parts.lidL.offsets[l0].map((x) => x + 0.0005);
    expect(heroFaceRig(lid, compileLayered(lid.recipe, lid.dials)).skipped).toMatch(/the stored head is not the head this hero builds now/);
    // another head carries no face rig
    expect(heroFaceRig(mintOf({ cast: 'male', register: 'lowpoly' }), FULL)).toBeNull();
  });
});
