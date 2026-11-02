// the WIDER HAND (station-loft-rig.js `fingers<S>` digit objects) and its servos (hero-servo.js handRead) on a real hero
// rig, the realistic form: a digit's curl in the wide form is the curl exactly; each joint turns alone; a middle joint
// named alone brings the last at two thirds; a spread fans a finger away from the middle without bending it, and the
// bone the GLB exports turns with it; the thumb's second axis brings its tip in to the palm, which the curl alone never
// did, and the thumb meets every finger's tip within the servos; the reading is the hand's own (the same wherever the arm
// holds it), every hand word within its ranges; an unknown key throws by name.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt, boneFrames, HAND_POSES, DIP_OF_PIP } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { handRead } from './hero-servo.js';
import { HAND_FORM } from './hero-hand.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', form: 'realistic' }) }).recipe.rig);
const at = (fingers, extra = {}) => rigNodesAt(R, { support: 'none', ...extra, ...(fingers ? { fingersR: fingers } : {}) }).nodes;
const read = (fingers, extra) => handRead(R, at(fingers, extra), 'R');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(...sub(a, b));
// the palm's frame at rest: across toward the thumb, out of the palm's front
const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const rest = at(null), A = unit(sub(rest.middleMcpR, rest.wristR)), V1 = sub(rest.indexMcpR, rest.littleMcpR);
const V = unit(sub(V1, A.map((x) => x * dot(V1, A))));   // across, square to the hand's length
const N0 = [A[1] * V[2] - A[2] * V[1], A[2] * V[0] - A[0] * V[2], A[0] * V[1] - A[1] * V[0]];
const fist = at('fist'), N = dot(sub(fist.middleTipR, rest.middleMcpR), N0) < 0 ? N0.map((x) => -x) : N0;
const offPalm = (p) => dot(sub(p, rest.wristR), N);

describe('the wider hand', () => {
  it('a digit’s curl in the wide form is the curl, exactly; a number and a word take the curl’s path', () => {
    for (const d of ['index', 'thumb']) {
      const a = at({ [d]: 40 }), b = at({ [d]: { curl: 40 } });
      for (const k of Object.keys(a)) expect(dist(a[k], b[k]), k).toBe(0);
    }
    const w = at('grip'), o = at(HAND_POSES.grip);
    for (const k of Object.keys(w)) expect(dist(w[k], o[k]), k).toBe(0);
  }, 120000);

  it('each joint turns alone, and a middle joint named alone brings the last at two thirds of it', () => {
    const r0 = read(null).index, r1 = read({ index: { mcp: 30 } }).index;
    expect(r1.mcp.value - r0.mcp.value).toBeCloseTo(30, 0);
    expect(r1.pip.value).toBeCloseTo(r0.pip.value, 0); expect(r1.dip.value).toBeCloseTo(r0.dip.value, 0);
    const p = read({ index: { pip: 60 } }).index;
    expect(p.pip.value - r0.pip.value).toBeCloseTo(60, 0);
    expect(p.dip.value - r0.dip.value).toBeCloseTo(60 * DIP_OF_PIP, 0);
    const q = read({ index: { pip: 60, dip: 10 } }).index;
    expect(q.dip.value - r0.dip.value).toBeCloseTo(10, 0);
  }, 120000);

  it('a spread fans a finger away from the middle without bending it, and its exported bone turns with it', () => {
    const r0 = read(null);
    for (const [d, toThumb] of [['index', 1], ['middle', 1], ['ring', -1], ['little', -1]]) {
      const n = at({ [d]: { spread: 12 } }), r = handRead(R, n, 'R')[d];
      expect(r.spread.value - r0[d].spread.value, d).toBeCloseTo(12, 0);
      expect(Math.abs(r.mcp.value - r0[d].mcp.value), d).toBeLessThan(1); expect(Math.abs(r.pip.value - r0[d].pip.value), d).toBeLessThan(1);
      expect(Math.sign(dot(sub(n[`${d}TipR`], rest[`${d}TipR`]), V)), d).toBe(toThumb);
    }
    // the bone a skinned export turns: the index's first bone, by about the spread
    const i1 = R.boneIndex.index1R, f0 = boneFrames(R, R.joints, rest)[i1], f1 = boneFrames(R, R.joints, at({ index: { spread: 12 } }))[i1];
    const tr = [0, 1, 2].reduce((s, i) => s + [0, 1, 2].reduce((t, k) => t + f0.m[k][i] * f1.m[k][i], 0), 0);
    expect(Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * 180 / Math.PI).toBeGreaterThan(9);
  }, 120000);

  it('the thumb’s second axis brings its tip in to the palm, which the curl alone never does', () => {
    let nearest = Infinity;
    for (let c = -15; c <= 90; c += 15) nearest = Math.min(nearest, offPalm(at({ thumb: c }).thumbTipR));
    expect(nearest, 'the curl keeps the tip off the palm (29 mm at its nearest, opened)').toBeGreaterThan(0.025);
    const n = at({ thumb: { cmc: [40, 25] } });
    expect(offPalm(n.thumbTipR)).toBeLessThan(0.02);
    expect(offPalm(n.thumbTipR)).toBeLessThan(offPalm(at({ thumb: { cmc: [40, 0] } }).thumbTipR) - 0.02);
  }, 120000);

  it('the thumb meets every finger’s tip within the servos (the middle’s, which the curl could not)', () => {
    // (each found by a search over the wide controls, the servos' ranges a cost: scripts/spikes/manipulator)
    const meets = {
      index: { thumb: { cmc: [10, -5], mcp: 5, ip: -25 }, index: { mcp: 8, pip: 48 } },
      middle: { thumb: { cmc: [18, -10], mcp: -9, ip: 31 }, middle: { mcp: 14, pip: 50, spread: -10 } },
      ring: { thumb: { cmc: [10, -5], mcp: 30, ip: 44 }, ring: { mcp: 20, pip: 50, spread: 21 } },
      little: { thumb: { cmc: [25, 20], mcp: 40, ip: 53 }, little: { mcp: 20, pip: 50, spread: 27 } },
    };
    for (const [d, fingers] of Object.entries(meets)) {
      const n = at(fingers), pads = HAND_FORM.male.thumb.r[3] + HAND_FORM.male.fingers[d].r[3];
      expect(dist(n.thumbTipR, n[`${d}TipR`]), d).toBeLessThan(pads);
      const h = handRead(R, n, 'R');
      for (const [g, j] of Object.entries(h)) for (const [k, v] of Object.entries(j)) expect(v.inRange, `${d}: ${g}.${k} ${v.value}`).toBe(true);
    }
  }, 120000);

  it('the reading is the hand’s own, the open hand reads straight, and every hand word lies within its ranges', () => {
    const a = read('fist'), b = read('fist', { shR: { pitch: 90 }, elbowR: 60, wristR: { flex: 30, twist: 40 } });
    for (const [d, j] of Object.entries(a)) for (const k of Object.keys(j)) expect(Math.abs(b[d][k].value - j[k].value), `${d}.${k}`).toBeLessThan(0.5);
    for (const d of ['index', 'middle', 'ring', 'little']) for (const k of ['mcp', 'pip', 'dip']) expect(Math.abs(read('open')[d][k].value), `${d}.${k}`).toBeLessThan(0.5);
    for (const w of Object.keys(HAND_POSES)) for (const [d, j] of Object.entries(read(w))) for (const [k, v] of Object.entries(j)) expect(v.inRange, `${w}: ${d}.${k} ${v.value}`).toBe(true);
  }, 120000);

  it('an unknown key throws by name', () => {
    expect(() => at({ index: { bend: 10 } })).toThrow(/fingersR\.index: no key 'bend'/);
    expect(() => at({ thumb: { spread: 10 } })).toThrow(/fingersR\.thumb: no key 'spread'/);
  }, 120000);
});
