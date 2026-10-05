// hero-hand.test.js — the structured hero's HAND (hero-hand.js): a palm and five digits for the mitten, and the rig's
// `hands` block (station-loft-rig.js) that turns the wrist and the digits in the hand's own frame before the hand rides
// the forearm. The streamlined core keeps its mitten and refuses the hand's words.
import { describe, it, expect } from 'vitest';
import { heroPlan } from './hero-form.js';
import { DIGITS, HAND_POSES, HAND_FORM } from './hero-hand.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, layeredClip, handValue } from './station-loft-rig.js';
import { validateGesture, validateHeroClips } from './hero-gesture.js';
import { humanoidBonesFor } from './figure-humanoid-map.js';
import { heroRecord, heroPlanOf } from '../../mcp/tools/layered.js';

const sub = (a, b) => a.map((x, i) => x - b[i]); const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0); const len = (v) => Math.hypot(...v);
const unit = (v) => v.map((x) => x / len(v)); const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mv = (M, v) => M.map((r) => dot(r, v)); const mirror = (p) => [-p[0], p[1], p[2]];
const rigged = (opts) => { const recipe = expandPlan(heroPlan(opts)); const R = validateRig(recipe.rig); return { recipe, R }; };
const FINGERS = DIGITS.filter((d) => d !== 'thumb');
// the hand's own frame at rest: along the forearm's line, across toward the thumb, out of the palm
const frameOf = (R, S = 'R') => { const A = unit(sub(R.joints[`wrist${S}`], R.joints[`elbow${S}`])), V = unit(sub([0, 1, 0], A.map((x) => x * A[1]))); return { A, V, N: unit(cross(V, A)), W: R.joints[`wrist${S}`] }; };

describe('the structured hand', () => {
  const { recipe, R } = rigged({ cast: 'male' });
  it('is a palm and five digits a side, mirrored by name; the streamlined core keeps its mitten', () => {
    for (const S of ['R', 'L']) for (const p of ['hand', ...DIGITS]) expect(recipe.parts[`${p}${S}`]?.layer, `${p}${S}`).toBe(1);
    expect(recipe.parts.handR.slots).toHaveLength(8); expect(recipe.parts.indexR.slots).toHaveLength(6);
    const s = expandPlan(heroPlan({ cast: 'male', core: 'streamlined' }));
    expect(Object.keys(s.parts).filter((k) => DIGITS.some((d) => k.startsWith(d)))).toEqual([]);
    expect(s.rig.hands).toBeUndefined(); expect(s.rig.bones.some((b) => /^(thumb|index)/.test(b.id))).toBe(false);
  });
  it('fifteen bones a hand, each a phalanx from its joint, with an aux pair', () => {
    for (const S of ['R', 'L']) {
      const fb = R.bones.filter((b) => DIGITS.some((d) => b.id.startsWith(d) && b.id.endsWith(S)));
      expect(fb.map((b) => b.id).sort()).toEqual(DIGITS.flatMap((d) => [1, 2, 3].map((i) => `${d}${i}${S}`)).sort());
      for (const b of fb) expect(b.aux).toHaveLength(2);
    }
  });
  it('the proportions: the middle finger about the palm, the phalanges ≈ 1 : 0.6 : 0.45, the knuckles on an arc', () => {
    const J = R.joints, palm = len(sub(J.knucklesR, J.wristR));
    const run = (d) => [['Mcp', 'Pip'], ['Pip', 'Dip'], ['Dip', 'Tip']].map(([a, b]) => len(sub(J[`${d}${b}R`], J[`${d}${a}R`])));
    const mid = run('middle'), sum = mid.reduce((a, b) => a + b, 0);
    expect(sum / palm).toBeGreaterThan(0.8); expect(sum / palm).toBeLessThan(1);
    expect(mid[1] / mid[0]).toBeCloseTo(0.63, 1); expect(mid[2] / mid[0]).toBeCloseTo(0.47, 1);
    const { A, W } = frameOf(R), u = (d) => dot(sub(J[`${d}McpR`], W), A);
    expect(u('middle')).toBeGreaterThan(u('index')); expect(u('index')).toBeGreaterThan(u('little')); expect(u('ring')).toBeGreaterThan(u('little'));
    // the little finger's tip near the ring finger's last joint, the thumb's tip beside the index's knuckles at rest
    expect(Math.abs(dot(sub(J.littleTipR, J.ringDipR), A))).toBeLessThan(0.03);   // its deeper curl lifts it a little
    expect(dot(sub(J.thumbTipR, W), A)).toBeGreaterThan(u('index') - 0.01);
  });
  it('rests relaxed: the cascade deepens toward the little finger; the hand faces the thigh, the thumb forward', () => {
    const J = R.joints, { A, N, V, W } = frameOf(R);
    const bend = (d) => Math.acos(dot(unit(sub(J[`${d}PipR`], J[`${d}McpR`])), unit(sub(J[`${d}TipR`], J[`${d}DipR`])))) * 180 / Math.PI;
    expect(bend('index')).toBeLessThan(bend('middle')); expect(bend('middle')).toBeLessThan(bend('ring')); expect(bend('ring')).toBeLessThan(bend('little'));
    expect(N[0]).toBeLessThan(-0.9);                                 // the palm looks in, at the thigh
    expect(dot(sub(J.thumbTipR, W), V)).toBeGreaterThan(0.01);       // the thumb on the front edge
    expect(dot(sub(J.middleTipR, J.middleMcpR), N)).toBeGreaterThan(0);   // the fingers curl toward the palm
    expect(dot(A, [0, 0, -1])).toBeGreaterThan(0.9);
  });
  it('the female palm is narrower for its length (HAND_FORM)', () => {
    const w = (b) => b.palm.rings.at(-1)[1] / b.fingers.middle.len.reduce((a, c) => a + c, 0);
    expect(w(HAND_FORM.female)).toBeLessThan(w(HAND_FORM.male));
  });
});

describe('the rig turns the hand in its own frame', () => {
  const { recipe, R } = rigged({ cast: 'female', proportions: 'anime' });
  const rest = rigNodesAt(R, {}).nodes;
  it('no hand word, a zero curl or a zero wrist: the rest exactly', () => {
    for (const pose of [{ fingersR: 0 }, { wristR: 0 }, { fingersR: 'relaxed', wristL: { flex: 0, deviation: 0, twist: 0 } }]) expect(rigNodesAt(R, pose).nodes).toEqual(rest);
    for (const k of [...R.hands.R.joints, ...R.hands.L.joints]) expect(rest[k], k).toEqual(R.joints[k]);
  });
  it('a fist brings every fingertip into the palm and leaves the forearm and the other hand still', () => {
    const { nodes } = rigNodesAt(R, { fingersR: 'fist' }), { A, N, W } = frameOf(R);
    for (const d of FINGERS) {
      const t = sub(nodes[`${d}TipR`], W), m = dot(sub(R.joints[`${d}McpR`], W), A);
      expect(dot(t, A), d).toBeLessThan(m);                          // back above its knuckle
      expect(dot(t, N), d).toBeGreaterThan(0);                       // in front of the palm
    }
    for (const k of ['elbowR', 'wristR', 'knucklesR', 'indexMcpR', 'indexTipL']) expect(nodes[k]).toEqual(rest[k]);
  });
  it('the last joint bends ⅔ of the middle joint (the coupling)', () => {
    const { nodes } = rigNodesAt(R, { fingersR: 60 });
    const ang = (a, b, c) => Math.acos(dot(unit(sub(nodes[b], nodes[a])), unit(sub(nodes[c], nodes[b])))) * 180 / Math.PI;
    const angR = (a, b, c) => Math.acos(dot(unit(sub(R.joints[b], R.joints[a])), unit(sub(R.joints[c], R.joints[b])))) * 180 / Math.PI;
    const pip = ang('indexMcpR', 'indexPipR', 'indexDipR') - angR('indexMcpR', 'indexPipR', 'indexDipR'), dip = ang('indexPipR', 'indexDipR', 'indexTipR') - angR('indexPipR', 'indexDipR', 'indexTipR');
    expect(dip / pip).toBeCloseTo(2 / 3, 1);
  });
  it('the wrist flexes, deviates and twists about the wrist joint by its angles', () => {
    const { A, N, V, W } = frameOf(R), k0 = sub(R.joints.knucklesR, W);
    const turned = (pose) => sub(rigNodesAt(R, pose).nodes.knucklesR, W);
    const ext = turned({ wristR: 30 });
    expect(len(ext)).toBeCloseTo(len(k0), 9);
    expect(Math.acos(dot(unit(ext), unit(k0))) * 180 / Math.PI).toBeCloseTo(30, 6);
    expect(dot(ext, N)).toBeLessThan(0);                             // + extension: toward the back of the hand
    expect(dot(turned({ wristR: { deviation: 20 } }), V)).toBeGreaterThan(0);   // + radial: toward the thumb
    // + twist (pronation): the thumb's side turns toward the palm's, the hand's axis still
    const a = sub(R.joints.indexMcpR, R.joints.littleMcpR), b = sub(rigNodesAt(R, { wristR: { twist: 90 } }).nodes.indexMcpR, rigNodesAt(R, { wristR: { twist: 90 } }).nodes.littleMcpR);
    expect(dot(unit(b), N)).toBeGreaterThan(0.9 * dot(unit(a), V));
  });
  it('the left hand mirrors the right under the same words', () => {
    const pose = { fingersR: 'point', fingersL: 'point', wristR: { flex: 20, deviation: -10, twist: 35 }, wristL: { flex: 20, deviation: -10, twist: 35 } };
    const { nodes } = rigNodesAt(R, pose);
    for (const k of R.hands.R.joints) { const l = k.replace(/R$/, 'L'); mirror(nodes[k]).forEach((x, i) => expect(nodes[l][i], l).toBeCloseTo(x, 9)); }
  });
  it('every finger bone\'s frame is rigid on its joints: the head-to-tail run and the aux pair carried exactly', () => {
    const pose = { fingersR: 'fist', wristR: { flex: -25, twist: 40 } }, { nodes } = rigNodesAt(R, pose);
    for (const f of boneFrames(R, R.joints, nodes)) {
      const b = R.bones.find((x) => x.id === f.id); if (!/^(hand|thumb|index|middle|ring|little)\dR$|^handR$/.test(b.id)) continue;
      const run = mv(f.m, sub(R.joints[b.tail], R.joints[b.head])), aux = mv(f.m, sub(R.joints[b.aux[1]], R.joints[b.aux[0]]));
      // to a few micrometres: a hinge joint and an axis are stored rounded (r6), a hair off true
      sub(nodes[b.tail], nodes[b.head]).forEach((x, i) => expect(run[i], `${b.id} run`).toBeCloseTo(x, 5));
      sub(nodes[b.aux[1]], nodes[b.aux[0]]).forEach((x, i) => expect(aux[i], `${b.id} aux`).toBeCloseTo(x, 5));
    }
  });
  it('the hand words: a number curls the thumb at half, a word is its pose, an unknown word throws by name', () => {
    expect(handValue(R, 'fingersR', 40)).toEqual({ thumb: 20, index: 40, middle: 40, ring: 40, little: 40 });
    expect(handValue(R, 'fingersL', 'fist')).toEqual({ ...HAND_POSES.fist });
    expect(handValue(R, 'wristR', 12)).toEqual({ flex: 12, deviation: 0, twist: 0 });
    expect(() => rigNodesAt(R, { fingersR: 'claw' })).toThrow(/no hand pose 'claw' \(have relaxed, open, fist, point, grip\)/);
  });
  it('a clip blends the hand words as numbers (a word at one key, a curl at the next)', () => {
    const f = layeredClip([{ fingersR: 'relaxed' }, { fingersR: 'fist' }], R, { loop: false });
    expect(f(0.5).fingersR.index).toBeCloseTo(HAND_POSES.fist.index / 2, 9);
  });
  it('the skin binds every hand vertex', () => {
    const mesh = compileLayered(recipe); const skin = bindLayered(mesh, recipe, R);
    const n = mesh.provenance.filter((p) => /^(hand|thumb|index|middle|ring|little)[RL]$/.test(p.part)).length;
    expect(n).toBeGreaterThan(300); expect(skin.weights).toHaveLength(mesh.vertices.length);
  });
});

describe('the hand\'s words at the door', () => {
  it('a structured hero takes them; a streamlined one refuses them by name', () => {
    const g = { fingersR: 'fist', wristL: { flex: 20, twist: -30 }, fingersL: { index: -10, thumb: 40 } };
    expect(validateGesture(g, 'gesture', { hands: true })).toEqual([]);
    expect(validateGesture(g).join('\n')).toMatch(/the streamlined hand has no fingers/);
    expect(validateHeroClips({ grab: [{ fingersR: 80 }] }, { hands: true })).toEqual([]);
    expect(validateGesture({ fingersR: 'claw', wristR: { flex: 90 } }, 'gesture', { hands: true })).toHaveLength(2);
    expect(() => heroRecord({ cast: 'male', gesture: { fingersR: 'fist' } })).not.toThrow();
    expect(() => heroRecord({ cast: 'male', core: 'streamlined', gesture: { fingersR: 'fist' } })).toThrow(/streamlined hand has no fingers/);
  });
  it('the guard closes both fists; a hand holding gear grips it in every key', () => {
    const guard = heroPlanOf(heroRecord({ cast: 'male', gesture: 'guard' }));
    expect(guard.clips.gesture[0]).toMatchObject({ fingersL: 'fist', fingersR: 'fist' });
    const p = heroPlanOf(heroRecord({ cast: 'male', gear: { right: { item: 'sword' } } }));
    for (const keys of Object.values(p.clips)) for (const k of keys) expect(k.fingersR ?? null).not.toBe(null);
    expect(p.clips.idle.every((k) => k.fingersR === 'grip' && k.fingersL === undefined)).toBe(true);
  });
  it('the wave opens the hand and turns the palm to the front', () => {
    for (const head of ['anime', 'landmark']) {
      const hero = heroRecord({ cast: 'female', head }), recipe = expandPlan(heroPlanOf(hero)), R = validateRig(recipe.rig);
      recipe.clips.wave.slice(1).forEach((k, i) => {
        expect(k.fingersR).toBe('open');
        const n = rigNodesAt(R, k).nodes, palm = unit(cross(sub(n.indexMcpR, n.littleMcpR), sub(n.knucklesR, n.wristR)));
        expect(palm[1], `${head} key ${i + 1}`).toBeGreaterThan(0.9);
      });
    }
  });
});

describe('the hand under VRM names', () => {
  it('a structured hero\'s rig resolves every required VRM bone and its thirty finger bones; the torso is the chest over a lumbar', () => {
    const { R } = rigged({ cast: 'male' });
    const hb = humanoidBonesFor(R.bones); const names = [...hb.names.values()];
    expect(hb.missing).toEqual([]);
    expect(names.filter((n) => /(Thumb|Index|Middle|Ring|Little)/.test(n))).toHaveLength(30);
    expect(names).toContain('rightThumbMetacarpal'); expect(names).toContain('leftLittleDistal'); expect(names).toContain('chest');
    expect(new Set(names).size).toBe(names.length);
    const s = validateRig(expandPlan(heroPlan({ cast: 'male', core: 'streamlined' })).rig), sn = [...humanoidBonesFor(s.bones).names.values()];
    expect(sn).toContain('spine'); expect(sn).not.toContain('chest'); expect(humanoidBonesFor(s.bones).missing).toEqual([]);
  });
});
