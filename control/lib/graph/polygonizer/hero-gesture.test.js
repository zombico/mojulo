// hero-gesture.test.js — the STAND: the gesture's words (refused by name), the presets resolved per cast, the one-key
// `gesture` clip first in the plan, every preset solvable on both anime casts through the mint's rig gates, the relaxed
// stand clear of the body on every cast word, the rest-placed pieces (piecesAt), the door's absent ⇒ byte-identical, and
// the door's clips (words refused by name, merged over the hero's own, stored sparse, named by the rig gates, read out),
// and on the anime head their facial tracks and designed durations (the forms, refused by name elsewhere, the strip).
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { GESTURE_CLIP, GESTURE_PRESETS, GESTURE_WORDS, heroGesture, validateGesture, resolveGesture, withGestureClip, gestureWord, standPose, poseLayered, gestureClearance, validateHeroClips, withHeroClips, ANIME_CLIP_SECONDS, heroClipSeconds, heroClipFaces } from './hero-gesture.js';
import { resolveAnimeExpression } from './anime-head.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, layeredClip, auditRig } from './station-loft-rig.js';
import { layeredSeat, layeredFaces } from './station-loft-faces.js';
import { compileLayered } from './station-loft.js';
import { expandPlan } from './station-loft-plan.js';
import { CAST_PRESET_NAMES } from './figure-cast.js';
import { characterLitPieces, layeredShadingNormals, piecesAt } from './station-loft-shade.js';
import { heroRecord, heroPlanOf, heroReadout, expandLayeredManifest, planLayered } from '../../mcp/tools/layered.js';
import { humanoidPlan } from './humanoid-plan.js';
import { composeAnime } from './anime-looks.js';
import { heroPlan, ANIME_WAVE } from './hero-form.js';

const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
/** a hero as the door mints it, compiled at rest, with its rig bound */
function hero(spec) {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
  const mesh = compileLayered(m.recipe, m.dials); const R = validateRig(m.recipe.rig);
  return { m, mesh, R, skin: bindLayered(mesh, m.recipe, R) };
}
/** the lowest point of a side's foot and toes, metres */
const soleOf = (mesh, V, S) => { let lo = Infinity; mesh.vertices.forEach((_, i) => { const p = mesh.provenance[i].part; if (p === `foot${S}` || p === `toes${S}`) lo = Math.min(lo, V[i][2]); }); return lo; };

describe('the gesture words', () => {
  it('a word, an object of pose words, or a list; refused by name', () => {
    for (const ok of [undefined, null, 'rest', 'relaxed', 'hand-on-hip', 'guard', { support: 'L', spine: { twist: ['left', 0.2], curl: 0.1 }, head: { pitch: -12 } },
      ['relaxed', { head: { pitch: -12 } }], { armR: ['forward', 'down'], elbowR: 'half', kneeL: 20, crouch: 0.1, shL: { yaw: 5 }, legL: { x: 0.1, y: 0.2, z: -1 } }]) expect(validateGesture(ok), JSON.stringify(ok)).toEqual([]);
    expect(validateGesture('dance')).toEqual([expect.stringMatching(/^gesture: unknown gesture word 'dance' \(rest, relaxed, hand-on-hip, guard/)]);
    expect(validateGesture(['relaxed', 'strut'])).toEqual([expect.stringMatching(/^gesture\[1\]: unknown gesture word 'strut'/)]);
    expect(validateGesture({ wristR: { flex: 30 } })[0]).toMatch(/gesture\.wristR: the hand is rigid on the forearm \(no wrist\), so the gesture refuses it/);
    expect(validateGesture({ jump: 1 })[0]).toMatch(/gesture\.jump: not a gesture word \(have support, crouch, spine/);
    expect(validateGesture({ support: 'none' })[0]).toMatch(/support: 'both' \| 'L' \| 'R'/);
    expect(validateGesture({ crouch: 2 })[0]).toMatch(/crouch: 0/);
    expect(validateGesture({ spine: { sideBend: ['up', 0.2] } })[0]).toMatch(/spine\.sideBend: \['left' \| 'right', amount 0 … 1\]/);
    // a stray number is refused by name, not minted as a wild pose
    expect(validateGesture({ spine: { curl: 1e6 } })[0]).toMatch(/spine\.curl: an amount \(0 … 1\)/);
    expect(validateGesture({ spine: { twist: ['left', 3] } })[0]).toMatch(/spine\.twist:/);
    expect(validateGesture({ pelvis: 400 })[0]).toMatch(/pelvis: degrees, within ±45/);
    expect(validateGesture({ shoulders: -60 })[0]).toMatch(/shoulders: degrees, within ±45/);
    expect(validateGesture({ hinge: 400 })[0]).toMatch(/hinge: degrees, -30 … 90/);
    expect(validateGesture({ head: { pitch: 120 } })[0]).toMatch(/head: \{ yaw, pitch \} in degrees, each within ±90/);
    expect(validateGesture({ shL: { yaw: 720, pitch: 0, roll: 0 } })[0]).toMatch(/shL: \{ yaw, pitch, roll \} in degrees, each within ±180/);
    expect(validateGesture({ head: { roll: 5 } })[0]).toMatch(/head: \{ yaw, pitch \}/);
    expect(validateGesture({ armL: 'sideways' })[0]).toMatch(/armL: a direction/);
    expect(validateGesture({ elbowR: 'kinked' })[0]).toMatch(/elbowR: a bend word/);
    expect(validateGesture([])[0]).toMatch(/a gesture word/);
    expect(validateGesture(7)[0]).toMatch(/a gesture word/);
  });
  it('resolves per cast: its own entry, else the male; a list merges left to right; rest is none; a copy, never the table', () => {
    expect(resolveGesture('relaxed', 'female')).toEqual(GESTURE_PRESETS.relaxed.female);
    expect(resolveGesture('relaxed', 'chibi')).toEqual(GESTURE_PRESETS.relaxed.chibi);
    expect(resolveGesture('guard', 'chibi')).toEqual(GESTURE_PRESETS.guard.male);
    expect(resolveGesture('guard', { dials: { legs: 1.1 } })).toEqual(GESTURE_PRESETS.guard.male);
    for (const g of [undefined, null, 'rest', ['relaxed', 'rest']]) expect(resolveGesture(g, 'male')).toBeNull();
    const chin = resolveGesture(['relaxed', { head: { pitch: -12 }, elbowR: 40 }], 'female');
    expect(chin.head).toEqual({ yaw: 10, pitch: -12 }); expect(chin.elbowR).toBe(40); expect(chin.hipR).toEqual(GESTURE_PRESETS.relaxed.female.hipR);
    expect(Object.isFrozen(chin.spine)).toBe(false); chin.spine.curl = 1; expect(GESTURE_PRESETS.relaxed.female.spine.curl).toBeUndefined();
    expect(gestureWord('relaxed')).toBe('relaxed'); expect(gestureWord(['relaxed', { head: { pitch: -1 } }])).toBe('relaxed+data'); expect(gestureWord(undefined)).toBeNull();
    expect(GESTURE_WORDS).toEqual(['rest', 'relaxed', 'hand-on-hip', 'guard']);
    // every relaxed entry is one stand: the same body words, only the free leg and the arms' swing differ per cast
    for (const cast of ['male', ...CAST_PRESET_NAMES]) expect(GESTURE_PRESETS.relaxed[cast], cast).toBeTruthy();
  });
  it('the stand is the FIRST clip, one key; no stand leaves the plan as it was', () => {
    const plan = { rig: {}, clips: { idle: [{}], walk: [{}] } };
    const out = withGestureClip(plan, { support: 'L' });
    expect(Object.keys(out.clips)).toEqual([GESTURE_CLIP, 'idle', 'walk']); expect(out.clips.gesture).toEqual([{ support: 'L' }]);
    expect(withGestureClip(plan, null)).toBe(plan); expect(withGestureClip({ clips: {} }, { support: 'L' })).toEqual({ clips: {} });
  });
});

describe('the presets on the anime hero', () => {
  const casts = { female: hero({ cast: 'female', head: 'anime' }), male: hero({ cast: 'male', head: 'anime' }) };

  it('the anime hero stands relaxed by default: read at plan time (never stored), the clip first, the mint gate passes', () => {
    for (const [cast, { m }] of Object.entries(casts)) {
      expect(m.hero.gesture).toBeUndefined(); expect(heroGesture(m.hero)).toBe('relaxed');
      expect(Object.keys(m.plan.clips)).toEqual(['gesture', 'idle', 'walk', 'wave']); expect(m.plan.clips.gesture).toEqual([GESTURE_PRESETS.relaxed[cast]]);
      expect(Object.keys(m.recipe.clips)[0]).toBe('gesture');
      const { stats } = planLayered(m); expect(stats.layered.rig.clips).toEqual(['gesture', 'idle', 'walk', 'wave']); expect(stats.closed).toBe(true);
    }
    // the default follows the head: switching it away drops the stand, switching to anime takes it on; `rest` opts out
    const { m } = casts.female;
    expect(heroGesture({ ...m.hero, head: 'landmark' })).toBeUndefined();
    expect(heroGesture({ ...heroRecord({ cast: 'female' }), head: 'anime' })).toBe('relaxed');
    expect(heroPlanOf(heroRecord({ cast: 'female' })).clips.gesture).toBeUndefined();
    expect(heroPlanOf(heroRecord({ cast: 'female', head: 'anime', gesture: 'rest' })).clips.gesture).toBeUndefined();
    expect(heroGesture(heroRecord({ cast: 'female', head: 'anime', gesture: null }))).toBe('relaxed');   // null is no word: the default
  });
  it("a stand the rig cannot solve names the hero field that made it", () => {
    expect(() => planLayered(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'anime', gesture: { pelvis: 25 } }) })))
      .toThrow(/the stand \(hero\.gesture \{"pelvis":25\}\): station-loft-rig: leg R cannot reach its planted toe .* — set \/hero\/gesture to another stand/);
  });
  it('every preset on both casts: solvable through the rig gates, planted toes held, the free sole on the floor', () => {
    for (const [cast, ctx] of Object.entries(casts)) for (const word of Object.keys(GESTURE_PRESETS)) {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, head: 'anime', gesture: word }) });
      expect(() => planLayered(m), `${cast} ${word}`).not.toThrow();   // layeredClip + auditRig (planted drift 0) over every clip
      const pose = standPose(m.recipe, ctx.R); expect(pose.support).toBe(GESTURE_PRESETS[word][cast].support);
      const P = poseLayered(ctx.mesh, ctx.m.recipe, pose, ctx);
      for (const S of ['L', 'R']) expect(Math.abs(soleOf(ctx.mesh, P.mesh.vertices, S) - soleOf(ctx.mesh, ctx.mesh.vertices, S)), `${cast} ${word} ${S}`).toBeLessThan(1e-3);
    }
  });
  it('relaxed: no hand or forearm point inside the torso or the thighs; the placed hands within a few millimetres', () => {
    for (const [cast, ctx] of Object.entries(casts)) {
      const at = (word) => gestureClearance(ctx.mesh, poseLayered(ctx.mesh, ctx.m.recipe, resolveGesture(word, cast), ctx).mesh.vertices);
      expect(at('relaxed'), cast).toEqual({ pairs: {}, worstMm: 0 });
      for (const word of ['hand-on-hip', 'guard']) expect(at(word).worstMm, `${cast} ${word}`).toBeLessThan(5);
    }
    // the measure itself: a forearm swung into the thigh is caught and named
    const { female: f } = casts;
    const into = gestureClearance(f.mesh, poseLayered(f.mesh, f.m.recipe, { ...resolveGesture('relaxed', 'female'), shR: { yaw: 25, pitch: 0, roll: 0 }, elbowR: 0 }, f).mesh.vertices);
    expect(into.worstMm).toBeGreaterThan(5); expect(Object.keys(into.pairs).some((k) => /^(hand|foreArm)R→(thighR|torso)$/.test(k))).toBe(true);
  });
  it('guard: the rear knee over its hip-to-foot line from the front (not knock-kneed, not bowed); the fists apart, one each side of the chin', () => {
    for (const [cast, ctx] of Object.entries(casts)) {
      const n = rigNodesAt(ctx.R, resolveGesture('guard', cast)).nodes;
      // the knee's offset from the hip → ankle line in the frontal (x, z) plane, + = outward (the right leg's +x)
      const out = (S) => { const [hp, k, a] = [n[`hip${S}`], n[`knee${S}`], n[`ankle${S}`]]; return (k[0] - (hp[0] + (a[0] - hp[0]) * (k[2] - hp[2]) / (a[2] - hp[2]))) * (S === 'R' ? 1 : -1); };
      expect(out('R'), `${cast} rear knee`).toBeGreaterThanOrEqual(0); expect(out('R'), `${cast} rear knee`).toBeLessThan(0.03); expect(Math.abs(out('L')), `${cast} lead knee`).toBeLessThan(0.03);
      const cx = n.headBase[0];
      expect(n.knucklesL[0], `${cast} lead fist`).toBeLessThan(cx - 0.05); expect(n.knucklesR[0], `${cast} rear fist`).toBeGreaterThan(cx + 0.05);
      expect(n.knucklesL[1], `${cast} lead fist forward`).toBeGreaterThan(n.knucklesR[1] + 0.1);
    }
  });
  it('relaxed on every cast word: clear of the body and standing on the floor', () => {
    for (const cast of CAST_PRESET_NAMES) {
      const ctx = hero({ cast, head: 'anime' }); const pose = standPose(ctx.m.recipe, ctx.R);
      expect(ctx.m.recipe.clips.gesture).toEqual([GESTURE_PRESETS.relaxed[cast]]);
      const P = poseLayered(ctx.mesh, ctx.m.recipe, pose, ctx);
      expect(gestureClearance(ctx.mesh, P.mesh.vertices), cast).toEqual({ pairs: {}, worstMm: 0 });
      expect(Math.abs(soleOf(ctx.mesh, P.mesh.vertices, 'R') - soleOf(ctx.mesh, ctx.mesh.vertices, 'R')), cast).toBeLessThan(1e-3);
    }
  });
  it('the stand as the World shows it: rest-placed pieces re-place exactly; the posed faces seat on the rest floor', () => {
    const { mesh, m, R, skin } = casts.female; const dz = layeredSeat(mesh, true);
    const rest = characterLitPieces(mesh, { normals: layeredShadingNormals(mesh, m.recipe), palette: m.recipe.palette, dz });
    const again = piecesAt(rest, mesh, dz);
    expect(again.map((pc) => pc.refs.map((r) => r.p))).toEqual(rest.map((pc) => pc.refs.map((r) => r.p)));
    expect(again.map((pc) => [pc.fill, pc.part, pc.mark, pc.outNormal])).toEqual(rest.map((pc) => [pc.fill, pc.part, pc.mark, pc.outNormal]));
    const shown = poseLayered(mesh, m.recipe, standPose(m.recipe, R), { R, skin }).mesh;
    expect(shown.faces).toBe(mesh.faces); expect(rigNodesAt(R, standPose(m.recipe, R)).report.legs.L.planted).toBe(true);
    const faces = layeredFaces(shown, m.recipe, { dz }); expect(Math.min(...faces.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(0, 3);
    expect(layeredFaces(mesh, m.recipe, { dz })).toEqual(layeredFaces(mesh, m.recipe));   // dz = the mesh's own seat: as before
  });
});

// THE ANIME WAVE (hero-form.js ANIME_WAVE): the anime head's own `wave`, measured on both anime casts through the rig's
// solve and the skinned mesh (and on the female under the hero proportions: the gate is the head, not the proportions);
// every other head keeps the form's wave byte for byte.
const SH = { yaw: -45, pitch: 90, roll: 90 };   // the form's wave: the upper arm at shoulder height, the forearm up
const FORM_WAVE = [{ elbowL: 'slight', elbowR: 'slight' }, { elbowL: 'slight', elbowR: 100, shR: SH, head: { x: 0.1, y: 0.95, z: 0.3 } },
  { elbowL: 'slight', elbowR: 78, shR: SH }, { elbowL: 'slight', elbowR: 118, shR: SH }];
describe('the anime wave', () => {
  const casts = { female: hero({ cast: 'female', head: 'anime' }), male: hero({ cast: 'male', head: 'anime' }) };
  const heroProps = { ...casts, 'female, hero proportions': hero({ cast: 'female', head: 'anime', proportions: 'hero' }) };
  const DEG = 180 / Math.PI, sub = (a, b) => a.map((x, i) => x - b[i]), len = (a) => Math.hypot(...a), unit = (a) => a.map((x) => x / len(a));
  /** a cast's part sets and head levels at rest */
  const sets = (ctx) => {
    const by = (re) => ctx.mesh.provenance.flatMap((p, i) => (re.test(p.part) ? [i] : [])), V = ctx.mesh.vertices, iris = by(/^iris/);
    return { hand: by(/^handR$/), arm: by(/^(handR|foreArmR)$/), hair: by(/^hair/), head: by(/^(cranium|face|ear|brow|catch|iris|pupil|lid|lash|nose)/), torso: by(/^(torso|neck)$/),
      eyeZ: iris.reduce((a, i) => a + V[i][2], 0) / iris.length, chinZ: Math.min(...by(/^face$/).map((i) => V[i][2])), torsoX: Math.max(...by(/^torso$/).map((i) => V[i][0])) };
  };
  const gap = (V, A, B) => { let d = Infinity; for (const i of A) for (const j of B) d = Math.min(d, len(sub(V[i], V[j]))); return d; };
  /** the node read: the upper arm's drop below horizontal, the forearm's angle from vertical and its lean in the front plane */
  const read = (R, pose) => {
    const n = rigNodesAt(R, pose).nodes, ua = sub(n.elbowR, n.shoulderR), fa = unit(sub(n.wristR, n.elbowR));
    return { n, fa, drop: Math.asin(-ua[2] / len(ua)) * DEG, vert: Math.acos(fa[2]) * DEG, lean: Math.atan2(fa[0], fa[2]) * DEG, depth: Math.atan2(fa[1], fa[2]) * DEG, hand: n.wristR.map((x, i) => (x + n.knucklesR[i]) / 2) };
  };

  it("the anime head waves its own way; every other head keeps the form's wave, byte for byte", () => {
    for (const { m } of Object.values(heroProps)) expect(m.recipe.clips.wave).toEqual(ANIME_WAVE);
    expect(ANIME_WAVE.map((k) => k.elbowR)).toEqual(['slight', 120, 85, 120, 85, 120]);   // rest, in, out, in, out, in
    expect(JSON.stringify(heroPlan({ cast: 'male' }).clips.wave)).toBe(JSON.stringify(FORM_WAVE));
    for (const spec of [{ cast: 'male' }, { cast: 'female', hair: 'bob' }, { cast: 'female', proportions: 'anime' }, { cast: 'male', head: 'none' }, { cast: 'heroic', head: 'none' }])
      expect(JSON.stringify(heroPlanOf(heroRecord(spec)).clips.wave), JSON.stringify(spec)).toBe(JSON.stringify(FORM_WAVE));
    // the plan gets its own copy: a plan edited downstream never reaches the table
    const p = humanoidPlan({ preset: 'female', head: 'anime', hair: 'none' }); p.clips.wave[1].elbowR = 0; expect(ANIME_WAVE[1].elbowR).toBe(120);
  });
  it('the raised key: the elbow out and down, the forearm upright, the hand at head height, clear of the head, the hair and the torso', () => {
    for (const [cast, ctx] of Object.entries(heroProps)) {
      const S = sets(ctx), [, IN, OUT] = ctx.m.recipe.clips.wave, r = read(ctx.R, IN);
      expect(r.drop, cast).toBeGreaterThan(25); expect(r.drop, cast).toBeLessThan(30);   // about 27° below horizontal
      expect(r.n.shoulderR[2] - r.n.elbowR[2], cast).toBeGreaterThan(0.13);             // the elbow well below the shoulder
      expect(r.n.elbowR[0] - S.torsoX, cast).toBeGreaterThan(0.2);                        // and out past the torso's side
      expect(r.vert, cast).toBeLessThan(1);                                              // the forearm upright
      expect(r.hand[2], cast).toBeGreaterThan(S.chinZ + 0.04); expect(r.hand[2], cast).toBeLessThan(S.eyeZ);   // beside the head, below the eyes
      for (const key of [IN, OUT]) {
        const V = poseLayered(ctx.mesh, ctx.m.recipe, key, ctx).mesh.vertices;
        for (const body of ['head', 'hair', 'torso']) expect(gap(V, S.arm, S[body]), `${cast} ${key.elbowR} ${body}`).toBeGreaterThan(0.05);
        // the hand's top about eye level upright, and still above the chin at the stroke's outer end
        expect(Math.max(...S.hand.map((i) => V[i][2])), `${cast} ${key.elbowR} hand top`).toBeGreaterThan(key === IN ? S.eyeZ - 0.04 : S.chinZ + 0.03);
      }
      const headTilt = rigNodesAt(ctx.R, IN).nodes.headTop[0] - rigNodesAt(ctx.R, {}).nodes.headTop[0]; expect(headTilt, cast).toBeGreaterThan(0.01);   // toward the hand
    }
  });
  it("the stroke: the forearm swings 35° across the front plane on the elbow's hinge, the elbow still; the mitten keeps its facing", () => {
    for (const [cast, ctx] of Object.entries(casts)) {
      const [, IN, OUT] = ctx.m.recipe.clips.wave, i = read(ctx.R, IN), o = read(ctx.R, OUT);
      expect(len(sub(i.n.elbowR, o.n.elbowR)), cast).toBeLessThan(1e-9);
      expect(o.lean - i.lean, cast).toBeCloseTo(35, 0); expect(Math.abs(o.depth - i.depth), cast).toBeLessThan(3);
      expect(o.hand[0] - i.hand[0], cast).toBeGreaterThan(0.14); expect(Math.abs(o.hand[1] - i.hand[1]), cast).toBeLessThan(0.015);
      // the forearm bone's frame is the shortest arc from its hanging direction: the stroke stays 14° or more from that
      // direction's opposite, where the frame spins, and the mitten's broad face stays to the front
      const fi = ctx.R.bones.findIndex((b) => b.id === 'foreArmR'), hang = unit(sub(ctx.R.joints.wristR, ctx.R.joints.elbowR));
      for (let e = 85; e <= 120; e += 2.5) {
        const key = { ...IN, elbowR: e }, r = read(ctx.R, key), m = boneFrames(ctx.R, ctx.R.joints, r.n)[fi].m;
        expect(Math.acos(-r.fa.reduce((a, x, k) => a + x * hang[k], 0)) * DEG, `${cast} ${e}`).toBeGreaterThan(14);
        expect(Math.abs(m[1][1]), `${cast} ${e} facing`).toBeGreaterThan(0.99);
      }
    }
  });
  it('as the pack bakes it: each key on one of the 12 samples a cycle, the rig gates and the rig audit clean', () => {
    for (const [cast, ctx] of Object.entries(casts)) {
      const keys = ctx.m.recipe.clips.wave, fn = layeredClip(keys, ctx.R);
      keys.forEach((k, j) => { const a = rigNodesAt(ctx.R, fn((2 * j) / 12)).nodes, b = rigNodesAt(ctx.R, k).nodes; for (const n of ['elbowR', 'wristR', 'headTop']) expect(len(sub(a[n], b[n])), `${cast} key ${j} ${n}`).toBeLessThan(1e-9); });
      expect(() => planLayered(ctx.m), cast).not.toThrow();
      const A = auditRig(ctx.mesh, ctx.skin, ctx.R, keys);
      expect([A.badWeights, A.maxPlantedDrift], cast).toEqual([0, 0]); expect(A.maxLengthError, cast).toBeLessThan(1e-9); expect(A.maxOrthoError, cast).toBeLessThan(1e-9);
    }
  });
});

// The door's absent ⇒ byte-identical: the hero record, the plan and the recipe of every hero that does not stand, pinned
// from the door BEFORE the gesture existed (sha256(JSON.stringify(x)), first 16 hex digits); the anime hero at
// `gesture: 'rest'` keeps the plan and recipe it had (its record says 'rest').
// Re-pinned for the hero's `wave` clip (hero-form.js): the upper arm level and the forearm up, the elbow never over
// the head. Every hero plan carries the clip, so the plan, the recipe and the pages move with it and with nothing else
// (with the old wave restored these pins pass unchanged).
const PINS = {
  landmarkMale: [{ cast: 'male' }, ['5151980a1491275e', '3c7bbf346eaac7ec', 'bea115d3e2080dac']],
  landmarkFemaleLowpoly: [{ cast: 'female', register: 'lowpoly' }, ['724eb23c69be56d1', '19bd030cf5c6b514', '0491e3116c5d971b']],
  headNone: [{ cast: 'female', head: 'none' }, ['2abfcb8d912a8fef', '3501097320b96707', 'cd26a720b2420d48']],
  ranger: [{ cast: 'male', hair: 'crop', detail: 'clothed', adorn: 'ranger' }, ['3f6b63054ff0a911', '406acf0f4215b0e5', '4124db4ac9b3b4a1']],
  chibiFaced: [{ cast: 'chibi', headScale: 1.3, face: 'broad-jaw' }, ['aa18806411303cd1', '73b7f4b40fcd97f1', '1f5bb5d11318a03f']],
};
describe('the door: no gesture ⇒ byte-identical', () => {
  for (const [name, [spec, [record, plan, recipe]]] of Object.entries(PINS)) {
    it(`${name}: record, plan, recipe`, () => {
      const hr = heroRecord(spec); const p = heroPlanOf(hr);
      expect(hr.gesture).toBeUndefined(); expect(h(hr)).toBe(record); expect(h(p)).toBe(plan); expect(h(expandPlan(p))).toBe(recipe);
    });
  }
  it("the anime hero at gesture: 'rest' keeps its plan and recipe", () => {
    // re-pinned for the anime hero's own palette (layered.js ANIME_HERO_PALETTE): the plan and recipe the door gave before
    // the gesture existed for the same hero with that palette passed as its operator palette, byte for byte; on the
    // studio's face (`sculpt: false`), since the graphic face is the anime head's other default. Re-pinned for the female
    // neck form (hero-form.js ANIME_NECK_FORMS: the neck a ring loft): the humanoid starter with the segment neck in its
    // place gives d56790646999f85a / efd7142540e4b892, the values before it, still. Re-pinned for the female HAIR BASE
    // (anime-head ANIME_HAIR_BASE, applied by the door: the lifted, thicker ridge-section form and the side-parted cut)
    // and her hair colour (#3b4859): the starter with the studio's hair and the one palette gives 20603e67ecc8120a /
    // c6c06fb062f633e5, the values before them, still. Re-pinned for her hair colour lifted to L* 35 (#465365, layered.js
    // ANIME_HERO_PALETTE, so her shade side parts from the World's backdrop): with #3b4859 passed as the operator's palette
    // the door gives 981042f892f927a8 / fb4ca6e99c355c48, the values before it, still. Re-pinned for the ANIME WAVE
    // (hero-form.js ANIME_WAVE, put over the form's `wave` by the humanoid starter under the anime head): each plan with
    // the form's wave back in its place gives the values before it, still
    const formWave = (x) => ({ ...x, clips: { ...x.clips, wave: FORM_WAVE } });
    const hr = heroRecord({ cast: 'female', head: 'anime', gesture: 'rest', sculpt: false }); const p = heroPlanOf(hr);
    expect(hr.gesture).toBe('rest'); expect(p.clips.gesture).toBeUndefined(); expect(h(p)).toBe('a526850c37befbbf'); expect(h(expandPlan(p))).toBe('13de9d6c2ce14d7d');
    expect(h(formWave(p))).toBe('d5c955f2008e39c1'); expect(h(expandPlan(formWave(p)))).toBe('86ed5d6451d0e21b');
    const was = heroPlanOf(heroRecord({ cast: 'female', head: 'anime', gesture: 'rest', sculpt: false, palette: { Hair: '#3b4859' } }));
    expect(h(formWave(was))).toBe('981042f892f927a8'); expect(h(expandPlan(formWave(was)))).toBe('fb4ca6e99c355c48');
    const eff = composeAnime(hr, 'bob');
    const before = humanoidPlan({ preset: 'female', register: hr.register, tune: eff.tune, body: {}, girth: 1, head: 'anime', face: eff.face, hair: eff.hair, expression: eff.expression, sculpt: eff.sculpt, palette: { Hair: '#644634', Ink: '#16181c' } });
    expect(h(formWave(before))).toBe('20603e67ecc8120a'); expect(h(expandPlan(formWave(before)))).toBe('c6c06fb062f633e5');
  });
  it('a landmark hero stands only when it says so', () => {
    const hr = heroRecord({ cast: 'male', gesture: 'guard' }); const p = heroPlanOf(hr);
    expect(hr.gesture).toBe('guard'); expect(Object.keys(p.clips)).toEqual(['gesture', 'idle', 'walk', 'wave']); expect(p.clips.gesture).toEqual([GESTURE_PRESETS.guard.male]);
    const { gesture: _g, ...others } = p.clips; expect(h({ ...p, clips: others })).toBe('3c7bbf346eaac7ec');   // nothing else moved
  });
});

// The door's CLIPS (`hero.clips`): the operator's motion in the rig's pose words, refused by name (the clip, the key, the
// word), stored as given and sparse, merged over the hero's own when the plan is generated, named by the rig gates when a
// key cannot be solved, and read out. The fast hero (the male form, blank head, low poly) carries the rig tests.
describe('the door clips', () => {
  const FAST = { cast: 'male', head: 'none', register: 'lowpoly' };
  const K = { armR: ['forward', 'up'], elbowR: 'half', head: { x: 0.1, y: 0.95, z: 0.3 } };
  const planned = (spec) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }); return { m, ...planLayered(m) }; };

  it('the words: the stand\'s and the clip words, every number range-checked; a word the rig does not know refused by clip, key and word', () => {
    expect(validateHeroClips({ greet: [{}, K] })).toEqual([]);
    for (const none of [undefined, null, {}]) expect(validateHeroClips(none)).toEqual([]);
    expect(validateHeroClips({ greet: [{ wristR: { flex: 30 } }] })).toEqual([expect.stringMatching(/^clips\.greet\[0\]\.wristR: the hand is rigid on the forearm \(no wrist\), so the clip refuses it \(have .*heelL, heelR, lift, jaw\)$/)]);
    expect(validateHeroClips({ greet: [{ dance: 1 }] })[0]).toMatch(/clips\.greet\[0\]\.dance: not a clip word/);
    expect(validateHeroClips({ greet: [{}, { elbowR: 'kinked' }] })[0]).toMatch(/^clips\.greet\[1\]\.elbowR: a bend word/);
    for (const v of [[{}], false]) expect(validateHeroClips({ gesture: v })).toEqual([expect.stringMatching(/^clips\.gesture: the stand's clip — set \/hero\/gesture/)]);
    for (const v of [[], 'wave', null]) expect(validateHeroClips({ greet: v }), JSON.stringify(v)).toEqual([expect.stringMatching(/^clips\.greet: a list of keys/)]);
    // an object naming neither keys nor seconds is a list on this head (the text as before the anime forms), the
    // { seconds, keys } form's own on the anime head
    expect(validateHeroClips({ greet: {} })).toEqual(["clips.greet: a list of keys, each an object of pose words — or false to remove the hero's own clip of that name (remove /hero/clips/greet drops a door clip)"]);
    expect(validateHeroClips({ greet: {} }, { face: true })).toEqual(['clips.greet.keys: a list of keys, each an object of pose words']);
    expect(validateHeroClips({ greet: [7] })[0]).toMatch(/^clips\.greet\[0\]: a key is an object of pose words/);
    expect(validateHeroClips({ 'big wave': [{}] })[0]).toMatch(/^clips\.big wave: a clip name is a word/);
    expect(validateHeroClips([{}])[0]).toMatch(/^clips: \{ <name>: \[keys\] \| false \}/);
    expect(validateHeroClips([{}], { face: true })[0]).toMatch(/^clips: \{ <name>: \[keys\] \| \{ seconds, keys \} \| false \}/);
    // the jaw only on a head with a jaw bone, within the jawOpen dial's range
    expect(validateHeroClips({ talk: [{ jaw: 5 }] })[0]).toMatch(/clips\.talk\[0\]\.jaw: this head has no jaw bone/);
    expect(validateHeroClips({ talk: [{ jaw: 5 }] }, { jaw: true })).toEqual([]);
    expect(validateHeroClips({ talk: [{ jaw: 40 }] }, { jaw: true })[0]).toMatch(/jaw: degrees the jaw opens, 0 … 25/);
    // leaving the floor, the heel channels, the head and neck aiming
    expect(validateHeroClips({ hop: [{ support: 'none', lift: 0.3 }] })).toEqual([]);
    expect(validateHeroClips({ hop: [{ lift: 2 }] })[0]).toMatch(/lift: metres the root rises off the floor, 0 … 1/);
    expect(validateHeroClips({ hop: [{ support: 'up' }] })[0]).toMatch(/support: 'both' \| 'L' \| 'R' \| 'none'/);
    expect(validateHeroClips({ tiptoe: [{ heelL: 30, heelR: -20 }] })).toEqual([]);
    expect(validateHeroClips({ tiptoe: [{ heelR: 120 }] })[0]).toMatch(/heelR: degrees the metatarsus turns about the toe base, within ±90/);
    expect(validateHeroClips({ look: [{ head: { x: 0, y: 1, z: 0.2 } }, { head: 'up' }, { neck: { yaw: 20 } }, { head: ['forward', 'down'] }] })).toEqual([]);
    expect(validateHeroClips({ look: [{ head: 'sideways' }] })[0]).toMatch(/head: \{ yaw, pitch \} in degrees, each within ±90, or a direction to aim/);
    expect(validateHeroClips({ look: [{ head: { roll: 5 } }] })[0]).toMatch(/head: \{ yaw, pitch \} in degrees \(no roll\), each within ±90, or a direction to aim/);
    expect(validateHeroClips({ look: [{ neck: { yaw: 120 } }] })[0]).toMatch(/neck: \{ yaw, pitch \} in degrees, each within ±90, or a direction to aim/);
    // the stand keeps its own words: no lift, no aimed head
    expect(validateGesture({ lift: 0.2 })[0]).toMatch(/gesture\.lift: a gesture stands on the floor, so the gesture refuses it/);
    expect(validateGesture({ head: { x: 0, y: 1, z: 0 } })[0]).toMatch(/head: \{ yaw, pitch \} in degrees, each within ±90$/);
    // every key of the hero's own clips is in the clip words (the landmark head's idle opens the jaw, its wave aims the head)
    for (const [spec, jaw] of [[{ cast: 'male' }, true], [{ cast: 'female', head: 'anime' }, false], [{ cast: 'female', head: 'none' }, false]]) {
      const { [GESTURE_CLIP]: _stand, ...own } = heroPlanOf(heroRecord(spec)).clips;
      expect(Object.keys(own)).toEqual(['idle', 'walk', 'wave']); expect(validateHeroClips(own, { jaw }), JSON.stringify(spec)).toEqual([]);
    }
  });
  it('merged over the hero\'s own: a name it has replaced in place, a new one after, false removing one; stored as given', () => {
    const plan = { rig: {}, clips: { idle: [1], walk: [2], wave: [3] } };
    expect(Object.entries(withHeroClips(plan, { walk: [{}], run: [{}], idle: false }).clips)).toEqual([['walk', [{}]], ['wave', [3]], ['run', [{}]]]);
    for (const none of [undefined, null, {}]) expect(withHeroClips(plan, none)).toBe(plan);
    const clips = { idle: [K, {}], greet: [K], wave: false };
    const hr = heroRecord({ cast: 'female', head: 'anime', clips }); expect(hr.clips).toEqual(clips);
    const p = heroPlanOf(hr), was = heroPlanOf(heroRecord({ cast: 'female', head: 'anime' }));
    expect(Object.keys(p.clips)).toEqual(['gesture', 'idle', 'walk', 'greet']);
    expect(p.clips.idle).toEqual(clips.idle); expect(p.clips.greet).toEqual(clips.greet);
    expect(p.clips.walk).toEqual(was.clips.walk); expect(p.clips.gesture).toEqual(was.clips.gesture);
    const { clips: _a, ...pBare } = p, { clips: _b, ...wasBare } = was; expect(h(pBare)).toBe(h(wasBare));   // nothing else moved
    expect(() => heroPlanOf(heroRecord({ cast: 'female', head: 'anime', clips: { dance: false } }))).toThrow(/clips\.dance: false removes one of the hero's own clips \(idle, walk, wave\); it has no 'dance'/);
    // the jaw: refused on a head without one, taken by the landmark head's jaw chain
    expect(() => heroRecord({ cast: 'male', head: 'anime', clips: { talk: [{ jaw: 5 }] } })).toThrow(/clips\.talk\[0\]\.jaw: this head has no jaw bone/);
    expect(heroPlanOf(heroRecord({ cast: 'male', clips: { talk: [{}, { jaw: 5 }] } })).clips.talk).toEqual([{}, { jaw: 5 }]);
    // an included head takes the jaw only when it carries a jaw hinge (the rig's jaw chain, as hero-form.js decides it)
    expect(() => heroRecord({ cast: 'male', head: { parts: {} }, clips: { talk: [{ jaw: 5 }] } })).toThrow(/clips\.talk\[0\]\.jaw: this head has no jaw bone/);
    expect(heroRecord({ cast: 'male', head: { parts: {}, joints: { jawHinge: [0, 0, 0] } }, clips: { talk: [{ jaw: 5 }] } }).clips).toEqual({ talk: [{ jaw: 5 }] });
  });
  it('sparse: an empty or null clips stores nothing, so every pinned hero keeps its record, plan and recipe', () => {
    for (const [name, [spec, [record, plan, recipe]]] of Object.entries(PINS)) for (const clips of [{}, null]) {
      const hr = heroRecord({ ...spec, clips }); const p = heroPlanOf(hr);
      expect('clips' in hr, name).toBe(false); expect(h(hr), name).toBe(record); expect(h(p), name).toBe(plan); expect(h(expandPlan(p)), name).toBe(recipe);
    }
  });
  it('the rig gates: a key or a blend the rig cannot solve names the clip and the key or the phase; a solvable clip plans, listed after the hero\'s own', () => {
    expect(() => planned({ ...FAST, clips: { lunge: [{}, { pelvis: 25 }] } })).toThrow(/layered rig: the clip 'lunge' \(hero\.clips\.lunge\[1\]\): station-loft-rig: leg R cannot reach its planted toe .* — lower the crouch or change heelR in that key — set \/hero\/clips\/lunge/);
    // each key solves (the right foot free while the pelvis turns, then both planted at rest); the blend plants the right
    // foot while the pelvis is still half turned
    expect(() => planned({ ...FAST, clips: { lunge: [{ support: 'L', pelvis: 45 }, { support: 'both' }] } })).toThrow(/layered rig: the clip 'lunge' \(hero\.clips\.lunge at phase 3\/12\): station-loft-rig: leg R cannot reach its planted toe .* — ease the keys either side of that phase .* — set \/hero\/clips\/lunge/);
    const { stats } = planned({ ...FAST, clips: { reach: [{}, K] } });
    expect(stats.layered.rig.clips).toEqual(['idle', 'walk', 'wave', 'reach']); expect(stats.closed).toBe(true);
  });
  it('the readout lists what the figure plays, the door\'s clips and the removed ones — only on a hero that authored some', () => {
    const readout = (spec) => { const { m, mesh, stats } = planned(spec); return heroReadout(m.hero, m.plan, stats, [], { mesh, recipe: m.recipe }); };
    expect(readout({ ...FAST, clips: { reach: [{}, K], wave: false } }).clips).toEqual({ plays: ['idle', 'walk', 'reach'], authored: ['reach'], removed: ['wave'] });
    expect(readout(FAST).clips).toBeUndefined();
  });
});

// The anime head's door clips: a key's facial track (`face`, read as hero.expression reads) and a clip's designed
// duration (`{ seconds, keys }`), each refused by name on every other head; the plan never carries the face (the rig does
// not read it); every clip of the anime hero plays a designed duration (heroClipSeconds) and its keys' faces are read
// from the record (heroClipFaces).
describe('the door clips on the anime head: facial tracks and designed durations', () => {
  const ANIME = { face: true };
  const K = { armR: ['forward', 'up'], elbowR: 'half' };
  it('the forms: [keys] or { seconds, keys }; a key may carry face on the anime head; each refused by name', () => {
    expect(validateHeroClips({ greet: { seconds: 2, keys: [{}, { ...K, face: 'happy' }] }, run: [{ face: ['determined', { open: 0.32, brow: 0.6 }] }, { face: { blink: 0.2, smile: 0.6 } }] }, ANIME)).toEqual([]);
    expect(validateHeroClips({ greet: { keys: [{}] } })).toEqual([]);   // { keys } alone is the list, on any head
    for (const s of [0.25, 3, 60]) expect(validateHeroClips({ greet: { seconds: s, keys: [{}] } }, ANIME)).toEqual([]);
    expect(validateHeroClips({ greet: { seconds: 2, keys: [{}], speed: 2 } }, ANIME)).toEqual(['clips.greet.speed: a clip is [keys] or { seconds, keys }']);
    for (const s of [0.2, 61, '2', NaN]) expect(validateHeroClips({ greet: { seconds: s, keys: [{}] } }, ANIME), String(s)).toEqual(["clips.greet.seconds: the clip's length in seconds, 0.25 … 60"]);
    expect(validateHeroClips({ greet: { seconds: 2 } }, ANIME)).toEqual(['clips.greet.keys: a list of keys, each an object of pose words']);
    expect(validateHeroClips({ greet: { seconds: 2, keys: [{ elbowR: 'kinked' }] } }, ANIME)[0]).toMatch(/^clips\.greet\.keys\[0\]\.elbowR: a bend word/);
    expect(validateHeroClips({ greet: [{ face: 'grin' }] }, ANIME)).toEqual([expect.stringMatching(/^clips\.greet\[0\]\.face: unknown anime pose 'grin' \(have neutral, blink, smile/)]);
    expect(validateHeroClips({ greet: [{ face: ['smile', { squint: 1 }] }] }, ANIME)).toEqual(['clips.greet[0].face[1].squint: not an expression amount (have blink, smile, open, brow)']);
    // every other head: the face and the duration refused by name (pointing at /hero/expression only on a head that takes
    // it: the landmark's); every other word's text as before
    expect(validateHeroClips({ greet: [{ face: 'happy' }] }, { expression: true })).toEqual(["clips.greet[0].face: a facial track is the anime head's (head: 'anime'); this head's face is /hero/expression"]);
    expect(validateHeroClips({ greet: [{ face: 'happy' }] })).toEqual(["clips.greet[0].face: a facial track is the anime head's (head: 'anime')"]);
    expect(validateHeroClips({ greet: { seconds: 2, keys: [{}] } })).toEqual(["clips.greet.seconds: a designed duration is the anime hero's (head: 'anime'); this hero's clips play one second in an export and three on the World page"]);
    expect(validateHeroClips({ greet: [{ dance: 1 }, { wristR: 1 }] }, ANIME)).toEqual(validateHeroClips({ greet: [{ dance: 1 }, { wristR: 1 }] }));
    for (const spec of [{ cast: 'male', register: 'lowpoly' }, { cast: 'female', head: 'none', register: 'lowpoly' }]) {
      const at = spec.head ?? 'landmark';
      expect(() => heroRecord({ ...spec, clips: { greet: [{ ...K, face: 'happy' }] } }), at).toThrow(spec.head ? /clips\.greet\[0\]\.face: a facial track is the anime head's \(head: 'anime'\)(?!; this head)/ : /clips\.greet\[0\]\.face: a facial track is the anime head's \(head: 'anime'\); this head's face is \/hero\/expression/);
      expect(() => heroRecord({ ...spec, clips: { greet: { seconds: 2, keys: [K] } } }), at).toThrow(/clips\.greet\.seconds: a designed duration is the anime hero's \(head: 'anime'\)/);
      expect(() => heroRecord({ ...spec, blink: false }), at).toThrow(/blink: the ambient blink is the anime head's \(head: 'anime'\)/);
      expect(heroRecord({ ...spec, clips: { greet: { keys: [K] } } }).clips).toEqual({ greet: { keys: [K] } });
    }
    expect(() => heroRecord({ cast: 'female', head: 'anime', blink: 'off' })).toThrow(/blink: false turns the anime hero's ambient blink off \(true is the default and not stored\)/);
  });
  it('the plan carries the keys without their face: a { seconds, keys } clip merges its keys; the record keeps it as given', () => {
    const clips = { greet: { seconds: 2, keys: [{}, { ...K, face: ['happy', { open: 0.4 }] }] }, run: [{ support: 'L', face: 'determined' }], idle: [K] };
    const hr = heroRecord({ cast: 'female', head: 'anime', clips }); expect(hr.clips).toEqual(clips);
    const p = heroPlanOf(hr);
    expect(Object.keys(p.clips)).toEqual(['gesture', 'idle', 'walk', 'wave', 'greet', 'run']);
    expect(p.clips.greet).toEqual([{}, K]); expect(p.clips.run).toEqual([{ support: 'L' }]); expect(p.clips.idle).toEqual([K]);
    // the face and the duration are the record's alone: the plan is the one of the same keys as plain lists
    expect(h(p)).toBe(h(heroPlanOf(heroRecord({ cast: 'female', head: 'anime', clips: { greet: [{}, K], run: [{ support: 'L' }], idle: [K] } }))));
    expect(hr.clips.greet.keys[1].face).toEqual(['happy', { open: 0.4 }]);   // the strip never touches the record
  });
  it("every clip of the anime hero plays a designed duration (the door clip's, the hero's own, half a second a key); no other hero's", () => {
    expect(ANIME_CLIP_SECONDS).toEqual({ gesture: 1, idle: 4, walk: 1, wave: 2 });
    const hr = heroRecord({ cast: 'female', head: 'anime', clips: { greet: { seconds: 2.5, keys: [{}, K] }, hop: [{}, K, {}], idle: [K], wave: { keys: [{}, K] }, walk: false } });
    expect(heroClipSeconds(hr, heroPlanOf(hr).clips)).toEqual({ gesture: 1, idle: 4, wave: 2, greet: 2.5, hop: 1.5 });
    expect(heroClipSeconds(hr, { tap: [{}], sway: Array(6).fill({}), constructor: [{}, {}] })).toEqual({ tap: 1, sway: 3, constructor: 1 });
    for (const spec of [{ cast: 'male' }, { cast: 'female', head: 'none' }]) { const r = heroRecord(spec); expect(heroClipSeconds(r, heroPlanOf(r).clips), spec.head ?? 'landmark').toBeNull(); }
  });
  it("the facial tracks as the door gave them: a door key's face resolved as hero.expression is, null elsewhere", () => {
    const hr = heroRecord({ cast: 'female', head: 'anime', clips: { greet: { seconds: 2, keys: [{}, { ...K, face: ['happy', { open: 0.4 }] }] }, run: [{ face: { blink: 0.2 } }, { face: null }] } });
    const F = heroClipFaces(hr, heroPlanOf(hr).clips);
    expect(Object.keys(F)).toEqual(['gesture', 'idle', 'walk', 'wave', 'greet', 'run']);
    expect(F.greet).toEqual([null, { blink: 1, smile: 1, open: 0.4, brow: -0.2 }]); expect(F.greet[1]).toEqual(resolveAnimeExpression(['happy', { open: 0.4 }]));
    expect(F.run).toEqual([{ blink: 0.2, smile: 0, open: 0, brow: 0 }, null]);
    expect(F.idle).toEqual([null, null, null, null]); expect(F.gesture).toEqual([null]);
  });
  it("the rig gates name a { seconds, keys } clip's key by its path", () => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'anime', register: 'lowpoly', clips: { lunge: { seconds: 2, keys: [{}, { pelvis: 25 }] } } }) });
    expect(() => planLayered(m)).toThrow(/layered rig: the clip 'lunge' \(hero\.clips\.lunge\.keys\[1\]\): station-loft-rig: leg R cannot reach its planted toe .* — lower the crouch or change heelR in that key — set \/hero\/clips\/lunge/);
  });
});
