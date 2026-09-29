// hero-gesture.test.js — the STAND: the gesture's words (refused by name), the presets resolved per cast, the one-key
// `gesture` clip first in the plan, every preset solvable on both anime casts through the mint's rig gates, the relaxed
// stand clear of the body on every cast word, the rest-placed pieces (piecesAt), the door's absent ⇒ byte-identical, and
// the door's clips (words refused by name, merged over the hero's own, stored sparse, named by the rig gates, read out).
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { GESTURE_CLIP, GESTURE_PRESETS, GESTURE_WORDS, heroGesture, validateGesture, resolveGesture, withGestureClip, gestureWord, standPose, poseLayered, gestureClearance, validateHeroClips, withHeroClips } from './hero-gesture.js';
import { validateRig, bindLayered, rigNodesAt } from './station-loft-rig.js';
import { layeredSeat, layeredFaces } from './station-loft-faces.js';
import { compileLayered } from './station-loft.js';
import { expandPlan } from './station-loft-plan.js';
import { CAST_PRESET_NAMES } from './figure-cast.js';
import { characterLitPieces, layeredShadingNormals, piecesAt } from './station-loft-shade.js';
import { heroRecord, heroPlanOf, heroReadout, expandLayeredManifest, planLayered } from '../../mcp/tools/layered.js';
import { humanoidPlan } from './humanoid-plan.js';
import { composeAnime } from './anime-looks.js';

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

// The door's absent ⇒ byte-identical: the hero record, the plan and the recipe of every hero that does not stand, pinned
// from the door BEFORE the gesture existed (sha256(JSON.stringify(x)), first 16 hex digits); the anime hero at
// `gesture: 'rest'` keeps the plan and recipe it had (its record says 'rest').
const PINS = {
  landmarkMale: [{ cast: 'male' }, ['5151980a1491275e', '6fe2cd3a9c74d711', 'fc8478c87f655ed3']],
  landmarkFemaleLowpoly: [{ cast: 'female', register: 'lowpoly' }, ['724eb23c69be56d1', '35de64b3f0ee35b0', '038a00c662b5944e']],
  headNone: [{ cast: 'female', head: 'none' }, ['2abfcb8d912a8fef', 'efc53a2abc390cad', '5e8d8528833c1814']],
  ranger: [{ cast: 'male', hair: 'crop', detail: 'clothed', adorn: 'ranger' }, ['3f6b63054ff0a911', 'bdd213bf73b9a667', 'd68b48d0267532a9']],
  chibiFaced: [{ cast: 'chibi', headScale: 1.3, face: 'broad-jaw' }, ['aa18806411303cd1', '76a47c3ed7d142b9', 'e267c39595020625']],
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
    // and her hair colour (#3b4859): the starter with the studio's hair and the one palette gives 095252dbb83a1ef9 /
    // 2c562764ab1eef7e, the values before them, still. Re-pinned for her hair colour lifted to L* 35 (#465365, layered.js
    // ANIME_HERO_PALETTE, so her shade side parts from the World's backdrop): with #3b4859 passed as the operator's palette
    // the door gives 4da49ea78bba6152 / 769748cc87d1a964, the values before it, still
    const hr = heroRecord({ cast: 'female', head: 'anime', gesture: 'rest', sculpt: false }); const p = heroPlanOf(hr);
    expect(hr.gesture).toBe('rest'); expect(p.clips.gesture).toBeUndefined(); expect(h(p)).toBe('38d0100609dca818'); expect(h(expandPlan(p))).toBe('2fbbadfa437a7d35');
    const was = heroPlanOf(heroRecord({ cast: 'female', head: 'anime', gesture: 'rest', sculpt: false, palette: { Hair: '#3b4859' } }));
    expect(h(was)).toBe('4da49ea78bba6152'); expect(h(expandPlan(was))).toBe('769748cc87d1a964');
    const eff = composeAnime(hr, 'bob');
    const before = humanoidPlan({ preset: 'female', register: hr.register, tune: eff.tune, body: {}, girth: 1, head: 'anime', face: eff.face, hair: eff.hair, expression: eff.expression, sculpt: eff.sculpt, palette: { Hair: '#644634', Ink: '#16181c' } });
    expect(h(before)).toBe('095252dbb83a1ef9'); expect(h(expandPlan(before))).toBe('2c562764ab1eef7e');
  });
  it('a landmark hero stands only when it says so', () => {
    const hr = heroRecord({ cast: 'male', gesture: 'guard' }); const p = heroPlanOf(hr);
    expect(hr.gesture).toBe('guard'); expect(Object.keys(p.clips)).toEqual(['gesture', 'idle', 'walk', 'wave']); expect(p.clips.gesture).toEqual([GESTURE_PRESETS.guard.male]);
    const { gesture: _g, ...others } = p.clips; expect(h({ ...p, clips: others })).toBe('6fe2cd3a9c74d711');   // nothing else moved
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
    for (const v of [[], 'wave', null, {}]) expect(validateHeroClips({ greet: v }), JSON.stringify(v)).toEqual([expect.stringMatching(/^clips\.greet: a list of keys/)]);
    expect(validateHeroClips({ greet: [7] })[0]).toMatch(/^clips\.greet\[0\]: a key is an object of pose words/);
    expect(validateHeroClips({ 'big wave': [{}] })[0]).toMatch(/^clips\.big wave: a clip name is a word/);
    expect(validateHeroClips([{}])[0]).toMatch(/^clips: \{ <name>: \[keys\] \| false \}/);
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
