import { describe, it, expect } from 'vitest';
import { withAlbedo } from '../roads/road-faces.js';
import { buildVehicle, FLEET, FLEET_TRIM } from '../roads/fleet.js';
import { SMOKE } from '../roads/bodywork.js';
import { rollVehicleSheet } from './sheet.js';
import { compileRealistic } from './realistic.js';
import { roadPart, formFace, smoothForm, ROAD_MATERIALS } from './road-form.js';
import { loftFigure } from './race-families.js';
import { roadWheel, wheelWell, WHEEL_STYLES } from './road-wheel.js';

// one class per body plan the loft draws, chosen in code: a car's language loft and a heavy class's own build
const carClass = Object.keys(FLEET).find((c) => FLEET[c].kind === 'car');
const heavyClass = Object.keys(FLEET).find((c) => FLEET[c].kind === 'semi' || FLEET[c].kind === 'straight');
const sheet = (cls, seed = 1) => rollVehicleSheet({ facets: { pole: 'realistic', class: cls }, seed });
const parsedB64 = (s, T) => new T(Buffer.from(s, 'base64').buffer.slice(0));

describe('the albedo recorder: what each face was asked in, beside it', () => {
  it('records every face and changes none', () => {
    const plain = buildVehicle(carClass, 0);
    const { out, albedo } = withAlbedo(() => buildVehicle(carClass, 0));
    expect(JSON.stringify(out)).toBe(JSON.stringify(plain));
    const faces = [...out.paint, ...out.trim];
    expect(faces.every((f) => albedo.get(f)?.hex)).toBe(true);
    // (its normal as the helper computed it, outward; formFace takes it to unit length, and a face with no area has none)
    expect(faces.every((f) => albedo.get(f).n.every(Number.isFinite))).toBe(true);
  });
  it('is off outside its run', () => {
    const { albedo } = withAlbedo(() => null);
    expect(albedo.get(buildVehicle(carClass, 0).paint[0])).toBeUndefined();
  });
});

describe('a face named by the colour it was drawn in', () => {
  it('reads each kind of trim, the plastics by where they face, a wheel\'s own', () => {
    expect(roadPart(FLEET_TRIM.glass)).toEqual({ part: 'glass', material: 'glass' });
    expect(roadPart(FLEET_TRIM.lamp).material).toBe('lamp');
    expect(roadPart(FLEET_TRIM.tail).material).toBe('tail');
    expect(roadPart(SMOKE)).toEqual({ part: 'lamp.bezel', material: 'carbon' });
    expect(roadPart(FLEET_TRIM.plastic, [0, 0, -1]).part).toBe('floor');
    expect(roadPart(FLEET_TRIM.plastic, [1, 0, 0]).part).toBe('grille');
    expect(roadPart('#123456')).toEqual({ part: 'body', material: 'paint' });
    expect(roadPart(FLEET_TRIM.tyre, null, 'wheel').material).toBe('rubber');
    expect(roadPart('#c3c7cb', null, 'wheel').material).toBe('alloy');
  });
  it('turns an unrecorded mark away from the body', () => {
    const f = formFace({ corners: [[0, 0, 2], [1, 0, 2], [1, 1, 2], [0, 1, 2]], fill: '#eceae3' }, null, { part: 'stripe', hex: '#eceae3', inside: [0.5, 0.5, 1] });
    expect(f).toMatchObject({ part: 'stripe', material: 'paint', albedo: '#eceae3' });
    expect(f.outNormal[2]).toBeCloseTo(1);
  });
  it('smooths across a shallow joint and keeps a crease', () => {
    const q = (corners, n) => ({ corners, outNormal: n, material: 'paint' });
    const tilt = (deg) => [Math.sin((deg * Math.PI) / 180), 0, Math.cos((deg * Math.PI) / 180)];
    const shallow = smoothForm([q([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 0, 1]), q([[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]], tilt(20))]);
    expect(shallow[0].cornerNormals[1][0]).toBeGreaterThan(0.05);
    expect(smoothForm([q([[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]], [0, 0, 0])])).toEqual([]);
    const sharp = smoothForm([q([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 0, 1]), q([[1, 0, 0], [2, 0, 0], [2, 1, 0], [1, 1, 0]], tilt(70))]);
    expect(sharp[0].cornerNormals[1]).toEqual([0, 0, 1]);
  });
});

describe('the realistic loft in the form render', () => {
  const formParts = (fig) => fig.parts.filter((p) => p.form).map((p) => p.form);
  it('leaves the default compile as it was', () => {
    const S = sheet(carClass);
    const plain = compileRealistic(S), lit = compileRealistic(S, { form: true });
    expect(JSON.stringify(lit.faces)).toBe(JSON.stringify(plain.faces));
    expect(plain.figure.form).toBeUndefined();
    expect(plain.figure.parts.some((p) => p.form)).toBe(false);
  });
  it('gives the body and every wheel their materials, the figure its light', () => {
    for (const cls of [carClass, heavyClass]) {
      const c = compileRealistic(sheet(cls), { form: true }), F = formParts(c.figure);
      expect(F).toHaveLength(1 + c.faces.wheels.length);
      expect(F[0].mats).toEqual(expect.arrayContaining(['paint', 'glass', 'seal']));
      for (const w of F.slice(1)) expect(w.mats).toEqual(expect.arrayContaining(['rubber', 'alloy']));
      for (const m of F.flatMap((f) => f.mats)) expect(ROAD_MATERIALS).toHaveProperty(m);
      expect(c.figure.form.materials).toBe(ROAD_MATERIALS);
    }
  });
  it('packs unit normals, one group a material, and the same bytes for the same words', () => {
    const S = sheet(carClass), F = formParts(compileRealistic(S, { form: true }).figure)[0];
    expect(F.groups.map((g) => F.mats[g[2]])).toEqual(F.mats);
    const n = parsedB64(F.nrm, Int8Array);
    for (let i = 0; i < n.length; i += 3) expect(Math.hypot(n[i], n[i + 1], n[i + 2]) / 127).toBeGreaterThan(0.97);
    expect(JSON.stringify(compileRealistic(S, { form: true }).figure)).toBe(JSON.stringify(compileRealistic(S, { form: true }).figure));
  });
  it('is asked by a loft\'s light, or read in gen-7, and never by a word it does not know', () => {
    expect(loftFigure({ class: carClass, light: 'form' }).form).toBeTruthy();
    expect(loftFigure({ class: carClass }).form).toBeUndefined();
    expect(loftFigure({ class: carClass }, { form: true }).form).toBeTruthy();
    expect(loftFigure({ class: carClass, light: 'paint' }, { form: true }).form).toBeUndefined();
    expect(() => loftFigure({ class: carClass, light: 'glossy' })).toThrow(/form .* or paint/);
  });
});

describe('the road wheel, lathed', () => {
  const hub = [0.8, 1.4, 0.33], r = 0.33, width = 0.24;
  const dist = (p) => Math.hypot(p[1] - hub[1], p[2] - hub[2]);
  const mid = (f) => f.corners.reduce((s, p) => [s[0] + p[0] / f.corners.length, s[1] + p[1] / f.corners.length, s[2] + p[2] / f.corners.length], [0, 0, 0]);
  // one wheel per kind of face a style draws, chosen in code: spoked, and a dish
  const spoked = Object.keys(WHEEL_STYLES).find((k) => WHEEL_STYLES[k].spokes > 0), dish = Object.keys(WHEEL_STYLES).find((k) => !WHEEL_STYLES[k].spokes);
  it('lathes a tyre to its radius and its width, its faces out of it', () => {
    const W = roadWheel({ hub, r, width });
    const tyre = W.filter((f) => f.part === 'tyre');
    expect(Math.max(...tyre.flatMap((f) => f.corners.map(dist)))).toBeCloseTo(r, 3);
    expect(Math.max(...W.flatMap((f) => f.corners.map((p) => Math.abs(p[0] - hub[0]))))).toBeLessThan(width * 0.55);
    for (const f of tyre) { const m = mid(f); expect(f.outNormal[1] * (m[1] - hub[1]) + f.outNormal[2] * (m[2] - hub[2])).toBeGreaterThan(0); }
  });
  it('gives every face a material and a unit normal, the face of the wheel toward the outside', () => {
    for (const style of [spoked, dish]) {
      const W = roadWheel({ hub, r, width, style });
      for (const f of W) { expect(ROAD_MATERIALS).toHaveProperty(f.material); expect(Math.hypot(...f.outNormal)).toBeCloseTo(1, 6); }
      // (the plates look out of the wheel; the lip is a cone, leaning out)
      for (const f of W.filter((g) => ['rim.lip', 'wheel.brake', 'rim.back', 'wheel.hub'].includes(g.part))) expect(f.outNormal[0] * Math.sign(hub[0])).toBeGreaterThan(0.5);
      expect(W.some((f) => f.material === 'brake')).toBe(true);
    }
  });
  it('draws a style\'s spokes as solids, a dish as a plate', () => {
    expect(roadWheel({ hub, r, width, style: spoked }).filter((f) => f.part === 'wheel.spoke')).toHaveLength(WHEEL_STYLES[spoked].spokes * 3);
    const D = roadWheel({ hub, r, width, style: dish });
    expect(D.some((f) => f.part === 'wheel.face')).toBe(true);
    expect(D.some((f) => f.part === 'wheel.spoke')).toBe(false);
  });
  it('lines the arch facing the wheel, and grips the disc, on the body', () => {
    const B = wheelWell({ hub, r, width });
    for (const f of B.filter((g) => g.part === 'wheel.well')) { const m = mid(f); expect(f.outNormal[1] * (hub[1] - m[1]) + f.outNormal[2] * (hub[2] - m[2])).toBeGreaterThan(0); }
    expect(B.some((f) => f.part === 'wheel.caliper')).toBe(true);
  });
  it('is the loft\'s wheel in the form render: its bones roll the wheel, the body keeps the liner', () => {
    const c = compileRealistic(sheet(carClass), { form: true });
    const wheelBone = c.faces.wheels[0].bone;
    expect(c.form[wheelBone].some((f) => f.part === 'wheel.spoke' || f.part === 'wheel.face')).toBe(true);
    expect(c.form[wheelBone].some((f) => f.part === 'wheel.caliper')).toBe(false);
    expect(c.form.root.filter((f) => f.part === 'wheel.well').length).toBeGreaterThan(0);
    expect(c.form.root.some((f) => f.part === 'wheel.caliper')).toBe(true);
  });
});
