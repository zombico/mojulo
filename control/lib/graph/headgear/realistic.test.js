// headgear/realistic: the circlet and the hats built on a head given as points (the builder alone, the smallest head: an
// ellipsoid skull under a cap of hair with crests), held to the law the hero's are (headwearGaps), faced out, the same
// twice; and the cards' realistic sides lowering to the `headwear` word from the hero laws 23
import { describe, it, expect } from 'vitest';
import { buildHeadwear, headwearGaps, HEADWEAR } from './realistic.js';
import { HEADGEAR, withHeadgear } from './cards.js';
import { headgearErrors } from './wear.js';

// a head: the skull an ellipsoid (m), the hair a cap over its top half, 1–2.5 cm thick with crests round it (no dice:
// the crests a sine of the bearing and the height)
function head() {
  const skull = [], hair = [], at = [0, 0, 1.6], r = [0.075, 0.095, 0.115];
  for (let i = 0; i <= 24; i++) for (let j = 0; j < 48; j++) {
    const v = Math.PI * i / 24, u = 2 * Math.PI * j / 48, d = [Math.sin(v) * Math.sin(u), Math.sin(v) * Math.cos(u), Math.cos(v)];
    skull.push(d.map((x, q) => at[q] + x * r[q]));
    if (Math.cos(v) > -0.1 && !(d[1] > 0.55 && Math.cos(v) < 0.6)) { const t = 0.01 + 0.015 * (0.5 + 0.5 * Math.sin(5 * u + 3 * v)); hair.push(d.map((x, q) => at[q] + x * (r[q] + t))); }
  }
  return { cloud: { skull, hair, hood: [] }, centre: [0, 0], band: (b) => 1.6 + 0.04 + 0.025 * Math.cos(b) };
}
const volumes = (M) => M.shells.map(([a, b]) => { let v = 0; for (let f = a; f < b; f++) { const [p, q, s] = M.faces[f].map((i) => M.vertices[i]); v += p[0] * (q[1] * s[2] - q[2] * s[1]) - p[1] * (q[0] * s[2] - q[2] * s[0]) + p[2] * (q[0] * s[1] - q[1] * s[0]); } return v; });

describe('headwear on the realistic head', () => {
  const H = head();
  for (const id of ['circlet', 'bandana', 'travelerHat', 'wizardHat']) {
    it(`${id}: clears the head and the hair it covers, every shell faced out, the same twice`, () => {
      const B = buildHeadwear(H.cloud, H, HEADWEAR[id]), law = headwearGaps({ ...H, made: B.made });
      expect(law.points).toBeGreaterThan(20);
      expect(law.through).toBe(0);
      expect(law.minGap).toBeGreaterThan(0);
      expect(volumes(B.M).every((v) => v > 0)).toBe(true);
      expect(JSON.stringify(buildHeadwear(H.cloud, H, HEADWEAR[id]).M.vertices)).toBe(JSON.stringify(B.M.vertices));
    });
  }
  // (the shield, the welding mask: a plate off the face; the head's nasion and chin on the test head)
  const face = { nasion: 1.62, chin: 1.5 };
  const inGroup = (M, g) => M.vertices.filter((_, i) => M.faces.some((f, fi) => M.groups[fi] === g && f.includes(i)));
  it('the welding mask: its strap clears the head, its plate stands off the face, its glass at the eyes; the same twice', () => {
    const W = HEADWEAR.weldingMask, B = buildHeadwear(H.cloud, { ...H, face }, W), law = headwearGaps({ ...H, made: B.made });
    expect(law.through).toBe(0);
    expect(volumes(B.M).every((v) => v > 0)).toBe(true);
    const plate = inGroup(B.M, W.group), skull = H.cloud.skull.filter((p) => p[1] > 0);
    const gap = Math.min(...plate.map((p) => Math.min(...skull.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])))));
    expect(gap).toBeGreaterThan(W.ease * 0.4);
    // (the plate over the brow and under the chin; the glass across the eyes, in front of the plate)
    expect(Math.min(...plate.map((p) => p[2]))).toBeLessThan(face.chin);
    const glass = inGroup(B.M, W.visorGroup);
    expect(glass.length).toBeGreaterThan(0);
    expect(Math.max(...glass.map((p) => p[2]))).toBeLessThan(face.nasion + 0.02);
    expect(Math.min(...glass.map((p) => p[1]))).toBeGreaterThan(Math.max(...skull.map((p) => p[1])));
    expect(JSON.stringify(buildHeadwear(H.cloud, { ...H, face }, W).M.vertices)).toBe(JSON.stringify(B.M.vertices));
  });
  it('the shooter\'s wrap: the glasses a band at the eyes, the scarf wound round the lower face; both clear the head', () => {
    const W = HEADWEAR.shooterWrap, B = buildHeadwear(H.cloud, { ...H, face }, W), skull = H.cloud.skull;
    expect(volumes(B.M).every((v) => v > 0)).toBe(true);
    const lens = inGroup(B.M, W.group), scarf = inGroup(B.M, W.wrap.group).filter((p) => !lens.includes(p));
    expect(Math.min(...lens.map((p) => p[2]))).toBeGreaterThan(face.nasion + W.span.lo - 0.001);
    expect(Math.max(...lens.map((p) => p[2]))).toBeLessThan(face.nasion + W.span.hi + 0.001);
    // (the scarf under the glasses, and round to the back of the head)
    expect(Math.max(...scarf.map((p) => p[2]))).toBeLessThan(face.nasion + W.span.lo);
    expect(Math.min(...scarf.map((p) => p[1]))).toBeLessThan(0);
    const gap = Math.min(...[...lens, ...scarf].map((p) => Math.min(...skull.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])))));
    expect(gap).toBeGreaterThan(0.002);
    // (and close round it everywhere: a wrap's chords through the head's middle never throw a point far off)
    const reach = (pts) => Math.max(...pts.map((p) => Math.hypot(p[0], p[1])));
    expect(reach(B.M.vertices)).toBeLessThan(reach(skull) + 0.04);
  });
  it('the cracked welding mask: no glass, and the plate open across the eyes in front', () => {
    const W = HEADWEAR.weldingMaskCracked, { M } = buildHeadwear(H.cloud, { ...H, face }, W);
    expect(W.visorGroup).toBeUndefined();
    const front = inGroup(M, W.group).filter((p) => Math.abs(p[0]) < 0.02 && p[1] > 0);
    expect(front.some((p) => p[2] > face.nasion - 0.02 && p[2] < face.nasion + 0.005)).toBe(false);
    expect(front.some((p) => p[2] < face.nasion - 0.06)).toBe(true);
  });
  it('the circlet: its gem on the midline at the front, in its own group', () => {
    const { M } = buildHeadwear(H.cloud, H, HEADWEAR.circlet), W = HEADWEAR.circlet;
    const gem = M.vertices.filter((_, i) => M.faces.some((f, fi) => M.groups[fi] === W.gemGroup && f.includes(i)));
    expect(gem.length).toBeGreaterThan(0);
    expect(Math.max(...gem.map((p) => Math.abs(p[0])))).toBeLessThan(0.01);
    expect(Math.min(...gem.map((p) => p[1]))).toBeGreaterThan(Math.max(...M.vertices.map((p) => p[1])) - 0.02);
  });
  it('a hat: its crown over the hair\'s top, its brim out past the crown\'s foot, the wizard\'s cone standing over both', () => {
    const top = Math.max(...H.cloud.hair.map((p) => p[2]));
    const T = buildHeadwear(H.cloud, H, HEADWEAR.travelerHat), Wz = buildHeadwear(H.cloud, H, HEADWEAR.wizardHat);
    expect(T.made.top).toBeGreaterThan(top);
    const reach = (M) => Math.max(...M.vertices.map((p) => Math.hypot(p[0], p[1])));
    expect(reach(T.M)).toBeGreaterThan(Math.max(...T.made.crown[0]) + 0.5 * HEADWEAR.travelerHat.brim.len);
    expect(Math.max(...Wz.M.vertices.map((p) => p[2]))).toBeGreaterThan(top + 0.6 * HEADWEAR.wizardHat.cone.len);
  });
  it('the cards lower to the headwear word on the realistic body from the hero laws 23, and refuse it before', () => {
    for (const id of ['circlet', 'bandana', 'travelerHat', 'wizardHat']) {
      const worn = withHeadgear({ form: 'realistic', palette: { Helmet: '#112233' } }, 'realistic', id);
      expect(worn.headwear).toBe(id);
      expect(worn.hair).toBeUndefined();
      if (HEADGEAR[id].family === 'hat') expect(worn.palette.Helmet).toBe('#112233');
      expect(headgearErrors(id, { form: 'realistic', laws: 22 })[0]).toMatch(/from the hero laws 23/);
      expect(headgearErrors(id, { form: 'realistic', laws: 23 })).toEqual([]);
    }
  });
});
