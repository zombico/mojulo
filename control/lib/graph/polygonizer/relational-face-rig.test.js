// The realistic head's face rig (relational-face-rig.js): its targets differenced from the head rebuilt at its fit with
// one of its own actions; what is pinned to the face carried by the skin under it; the weights from the western
// expression channels. One face, built once (a rig costs a few head builds). (Beside the module, not in the critical
// tier: a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { relationalFaceRig, relationalWeights, facsWeights, performanceTrack, gazeWeights, GAZE_TURN, RELATIONAL_FACE_TARGETS } from './relational-face-rig.js';
import { perform } from '../face-acting/perform.js';
import { westernState } from './western-face-rig.js';
import { EXPRESSIONS, CHANNEL_RANGES } from './humanoid-head.js';

describe('the realistic face\'s weights', () => {
  it('reads the western channels: the blink its own, a smile its corners\' lift, a brow its raise or its lowering', () => {
    const at = (c) => Object.fromEntries(RELATIONAL_FACE_TARGETS.map((t, i) => [t, relationalWeights(westernState({ ...EXPRESSIONS.neutral, ...c }), [0, 0.2, 0.5, 1])[i]]));
    expect(Object.values(at({}))).toEqual(RELATIONAL_FACE_TARGETS.map(() => 0));
    expect(at({ blink: 1 }).blink).toBe(1);
    expect(at({ mouthCorner: CHANNEL_RANGES.mouthCorner[1] }).smile).toBe(1);
    expect(at({ mouthCorner: CHANNEL_RANGES.mouthCorner[0] }).smile).toBe(0);
    expect(at({ browRaise: CHANNEL_RANGES.browRaise[1] }).browRaise).toBe(1);
    expect(at({ browRaise: CHANNEL_RANGES.browRaise[0] }).browLower).toBe(1);
    // (an acted take's brow is the tilt: set, the corrugator's lower; worried, its own inner raise, not the brows' lift)
    expect(at({ browTilt: CHANNEL_RANGES.browTilt[1] }).browLower).toBe(1);
    expect(at({ browTilt: CHANNEL_RANGES.browTilt[0] }).browWorried).toBe(1);
    expect(at({ browTilt: CHANNEL_RANGES.browTilt[0] }).browRaise).toBe(0);
    expect(at({ browTilt: CHANNEL_RANGES.browTilt[1] / 2, browRaise: CHANNEL_RANGES.browRaise[0] }).browLower).toBe(1);
    // (the aperture: wide over 1, squinted under it, as far as the lids are open; a surprised key widens the eyes)
    expect(at({ aperture: CHANNEL_RANGES.aperture[1] }).eyeWide).toBe(1);
    expect(at({ aperture: CHANNEL_RANGES.aperture[0] }).eyeSquint).toBe(1);
    expect(at({ aperture: CHANNEL_RANGES.aperture[1], blink: 1 }).eyeWide).toBe(0);
    expect(at(EXPRESSIONS.surprised).eyeWide).toBeGreaterThan(0.5);
  });
});

describe('a FACS state on the realistic face', () => {
  it('weighs each unit on its action\'s target, a side on the side\'s, a lip on the lip\'s, the jaw on jawOpen', () => {
    const at = (st) => { const { weights, gaps } = facsWeights(st); return { w: Object.fromEntries(RELATIONAL_FACE_TARGETS.map((t, i) => [t, weights[i]]).filter(([, v]) => v)), gaps }; };
    expect(at({ AU15: 0.6 })).toEqual({ w: { frown: 0.6 }, gaps: {} });
    expect(at({ AU12R: 0.4, AU14R: 0.4 })).toEqual({ w: { smileRight: 0.4, dimpleRight: 0.4 }, gaps: {} });
    expect(at({ AU1: 0.8, AU26: 0.5 })).toEqual({ w: { browWorried: 0.8, jawOpen: 0.5 }, gaps: {} });
    expect(at({ AU28B: 0.7, AU25: 0.4 })).toEqual({ w: { rollLower: 0.7, lipsPart: 0.4 }, gaps: {} });
    expect(at({ AU28: 0.5 })).toEqual({ w: { rollUpper: 0.5, rollLower: 0.5 }, gaps: {} });
  });
});

describe('a take on the realistic face', () => {
  it('turns the gaze to the look targets: up and in for the left eye when the eyes go up and to the figure\'s right', () => {
    const G = gazeWeights(GAZE_TURN / 2, GAZE_TURN);
    expect(G.eyeLookUpLeft).toBe(1); expect(G.eyeLookInLeft).toBe(0.5); expect(G.eyeLookOutRight).toBe(0.5);
    expect(G.eyeLookDownLeft).toBe(0); expect(G.eyeLookOutLeft).toBe(0);
  });
  it('keys a take at 30 fps on every target, its units and its gaze, the jaw on jawOpen', () => {
    const T = perform({ seed: 1, seconds: 2, beats: [{ at: 0, face: 'neutral' }, { at: 0.5, face: 'shocked', gaze: 'away' }] }), K = performanceTrack(T);
    expect(K.t).toHaveLength(2 * 30 + 1); expect(K.t.at(-1)).toBe(2);
    expect(K.w.every((row) => row.length === RELATIONAL_FACE_TARGETS.length)).toBe(true);
    const last = Object.fromEntries(RELATIONAL_FACE_TARGETS.map((n, i) => [n, K.w.at(-1)[i]]));
    expect(last.browRaise + last.browWorried + last.browOuter).toBeGreaterThan(0.5);
    expect(Object.keys(last).filter((k) => k.startsWith('eyeLook') && last[k] > 0.2).length).toBeGreaterThan(0);
    expect(K.gaps).toEqual([]);
    // (a spoken line opens the jaw and shapes the lips, none of it a gap)
    const S = performanceTrack(perform({ seed: 1, beats: [{ at: 0, face: 'neutral', say: 'Who are you?' }] })), at = (n) => Math.max(...S.w.map((r) => r[RELATIONAL_FACE_TARGETS.indexOf(n)]));
    expect(at('jawOpen')).toBeGreaterThan(0.1); expect(at('pucker')).toBeGreaterThan(0.3); expect(S.gaps).toEqual([]);
  });
});

describe('the realistic face rig', () => {
  let m, mesh, F, W;
  const move = (t, re) => { const ti = F.targets.indexOf(t); let mx = 0; mesh.vertices.forEach((_, i) => { const k = F.sub[i]; if (k < 0 || !re.test(mesh.provenance[i].part)) return; const o = k * W + 3 + ti * 3; mx = Math.max(mx, Math.hypot(F.rows[o], F.rows[o + 1], F.rows[o + 2])); }); return mx; };
  beforeAll(() => {
    const hero = heroRecord({ form: 'realistic', cast: 'female', face: { seed: 10, ethnicity: 'western' } });
    m = { ...expandLayeredManifest({ kind: 'layered', hero }), hero }; mesh = compileLayered(m.recipe);
    F = relationalFaceRig(m, mesh); W = (1 + F.targets.length) * 3;
  }, 600_000);
  it('builds its targets on the head the figure carries (the rest rebuilt is the stored face, within a millimetre: the rows carry the rest)', () => {
    expect(F.skipped).toBeUndefined();
    expect(F.targets).toEqual([...RELATIONAL_FACE_TARGETS]);
    let rebase = 0; mesh.vertices.forEach((_, i) => { const k = F.sub[i]; if (k >= 0) rebase = Math.max(rebase, Math.hypot(F.rows[k * W], F.rows[k * W + 1], F.rows[k * W + 2])); });
    expect(rebase).toBeLessThan(1e-3);
  });
  it('moves what each action moves: a blink the eyes and their lashes, one eye its own side; a brow its hairs, hardly the scalp\'s', () => {
    // (the ONE SKIN, realistic laws 2: the lids are the skin's own points, turned over the globes, which stay)
    expect(move('blink', /^headSkin$/)).toBeGreaterThan(0.003);
    expect(move('blink', /^hairLashes$/)).toBeGreaterThan(0.002);
    expect(move('blink', /^(mouth|ear[RL])$/)).toBe(0);
    // (the globes in the rig: a blink sinks them behind the shut lid, its sink and no more; the gaze turns them)
    expect(move('blink', /^globe[RL]$/)).toBeGreaterThan(0.001); expect(move('blink', /^globe[RL]$/)).toBeLessThan(0.0031);
    expect(move('eyeLookUpLeft', /^globe[RL]$/)).toBeGreaterThan(0.002); expect(move('eyeLookUpLeft', /^headSkin$/)).toBe(0);
    // (and nothing of the skin far from the eyes)
    const tb = F.targets.indexOf('blink'), eyes = ['globeR', 'globeL'].map((g) => { const ps = Object.values(m.recipe.parts[g].mesh.points); return [0, 1, 2].map((a) => ps.reduce((t, q) => t + q[a], 0) / ps.length); });
    let far = 0; mesh.vertices.forEach((v, i) => { const k = F.sub[i]; if (k < 0 || mesh.provenance[i].part !== 'headSkin' || eyes.some((e) => Math.hypot(v[0] - e[0], v[1] - e[1], v[2] - e[2]) < 0.04)) return; const o = k * W + 3 + tb * 3; far = Math.max(far, Math.hypot(F.rows[o], F.rows[o + 1], F.rows[o + 2])); });
    expect(far).toBeLessThan(1e-4);
    // (nor the fold over the lid and the brow: the lid slides down under them; above the eye's centre by more than the
    // globe's radius, the skin is still)
    let fold = 0; mesh.vertices.forEach((v, i) => { const k = F.sub[i]; if (k < 0 || mesh.provenance[i].part !== 'headSkin' || !eyes.some((e) => v[2] - e[2] > 0.015 && Math.hypot(v[0] - e[0], v[1] - e[1], v[2] - e[2]) < 0.04)) return; const o = k * W + 3 + tb * 3; fold = Math.max(fold, Math.hypot(F.rows[o], F.rows[o + 1], F.rows[o + 2])); });
    expect(fold).toBeLessThan(3e-4);
    // (one eye: the left's target leaves the right's side still)
    const ti = F.targets.indexOf('blinkLeft'); let right = 0;
    mesh.vertices.forEach((v, i) => { const k = F.sub[i]; if (k < 0 || v[0] < 0.01) return; const o = k * W + 3 + ti * 3; right = Math.max(right, Math.hypot(F.rows[o], F.rows[o + 1], F.rows[o + 2])); });
    expect(right).toBeLessThan(1e-4);
    // (realistic laws 10: the brow a band lying on the skin, riding it as the skin under it moves, ~2 mm; the blades' tips
    // stood off it and swung further; seated, laws 11, the brows hang lower on the fold, where the raise reaches a little
    // less)
    expect(move('browRaise', /^hairBrows$/)).toBeGreaterThan(0.0015);
    // (the scalp's hair stays, but for the fringe lying on the forehead's skin, which the frontalis lifts)
    const ti2 = F.targets.indexOf('browRaise'); let hair = 0, moved = 0;
    mesh.vertices.forEach((_, i) => { if (mesh.provenance[i].part !== 'hair') return; hair++; const k = F.sub[i]; if (k < 0) return; const o = k * W + 3 + ti2 * 3; if (Math.hypot(F.rows[o], F.rows[o + 1], F.rows[o + 2]) > 5e-4) moved++; });
    expect(moved / hair).toBeLessThan(0.2);
    expect(move('smile', /^headSkin$/)).toBeGreaterThan(0.003);
    // (the eyes' own: the lids, the lashes riding them; the worried brow its hairs)
    for (const t of ['eyeWide', 'eyeSquint']) { expect(move(t, /^headSkin$/)).toBeGreaterThan(0.001); expect(move(t, /^(globe[RL]|mouth|ear[RL])$/)).toBe(0); }
    // (a FACS unit's target, and its side: the left alone leaves the right's side still)
    expect(move('frown', /^headSkin$/)).toBeGreaterThan(0.002);
    const tf = F.targets.indexOf('frownLeft'); let rightF = 0;
    mesh.vertices.forEach((v, i) => { const k = F.sub[i]; if (k < 0 || v[0] < 0.01) return; const o = k * W + 3 + tf * 3; rightF = Math.max(rightF, Math.hypot(F.rows[o], F.rows[o + 1], F.rows[o + 2])); });
    expect(rightF).toBeLessThan(1e-4);
    // (its inner ends as far as the raise lifts them, the tail kept: most of the raise's reach at its most)
    expect(move('browWorried', /^hairBrows$/)).toBeGreaterThan(0.7 * move('browRaise', /^hairBrows$/));
  });
  it('parts the lips for speech, each lip its own way, and opens the jaw by the bone\'s own turn', () => {
    // (the lips' middles: the one skin's points on the midline about the mouth's bag, the upper lip's the head bone's and
    // the lower's the jaw's; parted, the upper rise and the lower fall)
    const bag = Object.values(m.recipe.parts.mouth.mesh.points), zc = bag.reduce((t, q) => t + q[2], 0) / bag.length, front = Math.max(...bag.map((q) => q[1]));
    const blend = m.recipe.parts.headSkin.bind.blend, ti = F.targets.indexOf('lipsPart'), dz = { up: [], low: [] };
    mesh.vertices.forEach((v, i) => {
      const k = F.sub[i]; if (k < 0 || mesh.provenance[i].part !== 'headSkin' || Math.abs(v[0]) > 0.008 || Math.abs(v[2] - zc) > 0.01 || v[1] < front) return;
      const pv = mesh.provenance[i];
      dz[(blend[`${pv.station}.${pv.slot}`]?.jaw ?? 0) >= 0.5 ? 'low' : 'up'].push(F.rows[k * W + 3 + ti * 3 + 2]);
    });
    const mean = (a) => a.reduce((t, x) => t + x, 0) / a.length;
    expect(dz.up.length).toBeGreaterThan(2); expect(dz.low.length).toBeGreaterThan(2);
    expect(mean(dz.up)).toBeGreaterThan(0.0008); expect(mean(dz.low)).toBeLessThan(-0.0008);
    // (the jaw: the lower face, the mouth's bag with it, by the bone; the eyes and the brows still)
    expect(move('jawOpen', /^headSkin$/)).toBeGreaterThan(0.01); expect(move('jawOpen', /^mouth$/)).toBeGreaterThan(0.005);
    expect(move('jawOpen', /^(globe[RL]|hairBrows|hairLashes)$/)).toBeLessThan(1e-6);
    for (const t of ['pucker', 'funnel', 'rollLower', 'rollUpper']) { expect(move(t, /^headSkin$/)).toBeGreaterThan(0.002); expect(move(t, /^(globe[RL]|hairLashes)$/)).toBeLessThan(1e-6); }
  });
  it('turns the lashes with their lids: an upper lash points up at rest and down when the lid is shut', () => {
    // (each lash a connected blade of the lashes' faces; its root the point nearest the skin, its tip the farthest from it)
    const L = new Set(), ti = F.targets.indexOf('blink');
    mesh.vertices.forEach((_, i) => { if (mesh.provenance[i].part === 'hairLashes') L.add(i); });
    const parent = new Map([...L].map((i) => [i, i])), find = (i) => (parent.get(i) === i ? i : find(parent.get(i)));
    for (const t of mesh.faces) if (t.every((v) => L.has(v))) for (const v of t) parent.set(find(v), find(t[0]));
    const blades = new Map(); for (const i of L) { const r = find(i); (blades.get(r) || blades.set(r, []).get(r)).push(i); }
    const skin = []; mesh.vertices.forEach((_, i) => { if (mesh.provenance[i].part === 'headSkin') skin.push(i); });
    const V = mesh.vertices, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const shut = (i) => { const k = F.sub[i], o = k * W + 3 + ti * 3; return k < 0 ? V[i] : V[i].map((x, a) => x + F.rows[o + a]); };
    const eyeZ = Object.values(m.recipe.parts.globeR.mesh.points).reduce((t, q, _, A) => t + q[2] / A.length, 0);
    const up = [], down = [];
    for (const blade of blades.values()) {
      const gap = (i) => Math.min(...skin.map((j) => d(V[i], V[j])));
      const root = blade.reduce((a, b) => (gap(b) < gap(a) ? b : a)), tip = blade.reduce((a, b) => (d(V[b], V[root]) > d(V[a], V[root]) ? b : a));
      if (V[root][2] < eyeZ) continue;   // (the upper lashes)
      const dir = (A, B) => (B[2] - A[2]) / d(A, B);
      up.push(dir(V[root], V[tip])); down.push(dir(shut(root), shut(tip)));
    }
    const median = (A) => [...A].sort((a, b) => a - b)[A.length >> 1];
    expect(up.length).toBeGreaterThan(10);
    expect(median(up)).toBeGreaterThan(0);
    expect(median(down)).toBeLessThan(0);
  });
  it('wears the hero\'s expression as its default weights; a hero without the relational head has none', () => {
    expect(F.meta.weights).toEqual(RELATIONAL_FACE_TARGETS.map(() => 0));
    expect(relationalFaceRig({ ...m, hero: { ...m.hero, head: 'landmark' } }, mesh)).toBeNull();
  });
});
