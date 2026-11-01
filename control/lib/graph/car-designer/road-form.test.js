import { describe, it, expect } from 'vitest';
import { withAlbedo } from '../roads/road-faces.js';
import { buildVehicle, FLEET, FLEET_TRIM } from '../roads/fleet.js';
import { SMOKE } from '../roads/bodywork.js';
import { rollVehicleSheet } from './sheet.js';
import { compileRealistic } from './realistic.js';
import { roadPart, formFace, smoothForm, bakeForm, ROAD_MATERIALS } from './road-form.js';
import { loftFigure, loftInstanceFaces } from './race-families.js';
import { roadWheel, wheelWell, WHEEL_STYLES } from './road-wheel.js';
import { glasshouse, GLASSHOUSE, paneJoints } from './road-glass.js';
import { panels } from './road-panels.js';
import { heavyBody, HEAVY_KINDS } from './road-heavy.js';

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

describe('the glasshouse: panes, pillars and frames', () => {
  const area = (fs) => fs.reduce((s, f) => {
    const c = f.corners, n = [0, 0, 0];
    for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    return s + Math.hypot(...n) / 2;
  }, 0);
  const glassy = (f) => f.material === 'glass' || f.part === 'glass.frame' || f.part === 'pillar';
  // (the pass run on a few panes made here: one case per rule, the smallest input that shows it)
  const quad = (y0, y1, x, n) => ({ corners: [[x, y0, 1], [x, y1, 1], [x, y1, 1.4], [x, y0, 1.4]], material: 'glass', part: 'glass', albedo: '#1e2630', outNormal: n });
  const paintAbove = (y0, y1, x) => ({ corners: [[x, y0, 1.4], [x, y1, 1.4], [x * 0.9, y1, 1.5], [x * 0.9, y0, 1.5]], material: 'paint', part: 'body', albedo: '#20304a', outNormal: [Math.sign(x), 0, 0.3] });
  it('parts a long side into panes with a door pillar, and keeps the glass\'s area', () => {
    const faces = [quad(-1.2, 0, -0.9, [-1, 0, 0]), quad(0, 1.2, -0.9, [-1, 0, 0])];
    const out = glasshouse(faces, { body: '#20304a' });
    const span = 2.4, panes = Math.round(span / GLASSHOUSE.pane);
    expect(out.filter((f) => f.part === 'pillar' && f.material === 'carbon').length).toBeGreaterThan(0);
    expect(panes).toBeGreaterThan(1);
    expect(area(out.filter(glassy))).toBeCloseTo(area(faces), 6);
  });
  it('keeps a short side one pane', () => {
    const out = glasshouse([quad(0, 1.0, -0.9, [-1, 0, 0])]);
    expect(out.some((f) => f.part === 'pillar')).toBe(false);
  });
  it('frames a pane where it meets paint, in rubber or a classic\'s chrome, the area kept', () => {
    const faces = [quad(0, 1, -0.9, [-1, 0, 0]), paintAbove(0, 1, -0.9)];
    const rubber = glasshouse(faces), chrome = glasshouse(faces, { chrome: true });
    expect(rubber.find((f) => f.part === 'glass.frame')).toMatchObject({ material: 'seal' });
    expect(chrome.find((f) => f.part === 'glass.frame')).toMatchObject({ material: 'alloy' });
    expect(area(rubber.filter(glassy))).toBeCloseTo(area(faces.slice(0, 1)), 6);
  });
  it('paints a pillar where two panes meet at a turn', () => {
    const screen = { ...quad(0, 1, -0.9, [0, 0.7, 0.7]), corners: [[-0.9, 1, 1], [-0.9, 1, 1.4], [0, 1.4, 1.4], [0, 1.4, 1]] };
    const side = { ...quad(0, 1, -0.9, [-1, 0, 0]), corners: [[-0.9, 0, 1], [-0.9, 1, 1], [-0.9, 1, 1.4], [-0.9, 0, 1.4]] };
    const out = glasshouse([screen, side], { body: '#20304a' });
    expect(out.filter((f) => f.part === 'pillar' && f.material === 'paint' && f.albedo === '#20304a')).toHaveLength(2);
  });
  it('is the loft\'s glass in the form render: every side of a car framed, a sedan\'s doors pillared', () => {
    const c = compileRealistic(sheet(carClass), { form: true });
    expect(c.form.root.some((f) => f.part === 'glass.frame')).toBe(true);
    expect(c.form.root.some((f) => f.part === 'pillar')).toBe(true);
    for (const f of c.form.root) expect(ROAD_MATERIALS).toHaveProperty(f.material);
  });
});

describe('the panels: shut lines, fittings, a patched door', () => {
  const area = (fs) => fs.reduce((s, f) => {
    const c = f.corners, n = [0, 0, 0];
    for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    return s + Math.hypot(...n) / 2;
  }, 0);
  const side = (f, sx) => Math.sign(f.outNormal[0]) === sx && Math.abs(f.outNormal[0]) > 0.5;
  // one sheet a case, found in code: a car that is not battered, one that is (the sheet's own roll), and the cargo van
  const seedWhere = (cls, test) => [1, 2, 3, 4, 5, 6, 7, 8].find((s) => test(sheet(cls, s)));
  const clean = sheet(carClass, seedWhere(carClass, (S) => S.facets.wear !== 'battered'));
  const battered = sheet(carClass, seedWhere(carClass, (S) => S.facets.wear === 'battered'));
  const cargoClass = Object.keys(FLEET).find((c) => c === 'van');
  it('cuts the shut lines into the paint, its area kept, and adds a pull to each door', () => {
    const glassed = glasshouse([
      { corners: [[-0.9, -1, 1], [-0.9, 1, 1], [-0.9, 1, 1.4], [-0.9, -1, 1.4]], material: 'glass', part: 'glass', albedo: '#1e2630', outNormal: [-1, 0, 0] },
      { corners: [[-0.92, -1, 0.3], [-0.92, 1, 0.3], [-0.9, 1, 1], [-0.9, -1, 1]], material: 'paint', part: 'body', albedo: '#20304a', outNormal: [-1, 0, 0.03] },
    ]);
    const out = panels(glassed, { body: '#20304a', W: 1.84 });
    const panel = (fs) => fs.filter((f) => f.material === 'paint' && f.part === 'body' || f.part === 'seam');
    expect(out.filter((f) => f.part === 'seam').length).toBeGreaterThan(0);
    expect(area(panel(out))).toBeCloseTo(area(panel(glassed)), 6);
    expect(out.filter((f) => f.part === 'door.handle')).toHaveLength(paneJoints(-1, 1).length + 1);
  });
  it('fits a car: shut lines each side, a mirror each side its glass looking back, a plate each end', () => {
    const c = compileRealistic(clean, { form: true }), R = c.form.root;
    for (const sx of [-1, 1]) expect(R.some((f) => f.part === 'seam' && side(f, sx))).toBe(true);
    const mirrors = R.filter((f) => f.part === 'mirror.glass');
    expect(mirrors).toHaveLength(2);
    for (const m of mirrors) expect(m.outNormal[1]).toBeLessThan(-0.9);
    const plates = R.filter((f) => f.part === 'plate');
    expect(plates.map((p) => Math.sign(p.outNormal[1])).sort()).toEqual([-1, 1]);
    expect(R.some((f) => f.material === 'primer')).toBe(false);
  });
  it('patches a battered car\'s front door in primer, on one side', () => {
    const R = compileRealistic(battered, { form: true }).form.root, primer = R.filter((f) => f.material === 'primer');
    expect(primer.length).toBeGreaterThan(0);
    expect(new Set(primer.map((f) => Math.sign(f.outNormal[0]))).size).toBe(1);
  });
  it('glazes a cargo van at its cab alone, its side behind a panel', () => {
    const R = compileRealistic(sheet(cargoClass), { form: true }).form.root;
    const sideGlass = R.filter((f) => f.material === 'glass' && Math.abs(f.outNormal[0]) > 0.6), body = R.filter((f) => f.part === 'body' && Math.abs(f.outNormal[0]) > 0.6);
    const ys = (fs) => fs.flatMap((f) => f.corners.map((p) => p[1]));
    expect(Math.max(...ys(sideGlass)) - Math.min(...ys(sideGlass))).toBeLessThan(GLASSHOUSE.pane * 1.2);
    expect(Math.min(...ys(body))).toBeLessThan(Math.min(...ys(sideGlass)) - 1);
  });
});

describe('the heavy classes: their own bodies round the fleet\'s wheels', () => {
  // one class a body plan, found in code from the fleet: the bus, the straight truck, the semi
  const kindOf = (k) => Object.keys(FLEET).find((c) => FLEET[c].kind === k);
  const compiled = (k) => compileRealistic(sheet(kindOf(k)), { form: true });
  const parts = (R) => new Set(R.map((f) => f.part));
  it('gives every face of each a material and a unit normal', () => {
    for (const k of HEAVY_KINDS) {
      for (const f of compiled(k).form.root) { expect(ROAD_MATERIALS).toHaveProperty(f.material); expect(Math.hypot(...f.outNormal)).toBeCloseTo(1, 6); }
    }
  });
  it('builds a bus: its doors on the kerb side alone, its sign and lamps at the right ends, its arches over its wheels', () => {
    const c = compiled('bus'), R = c.form.root;
    const doors = R.filter((f) => f.part === 'door.glass');
    expect(doors.length).toBeGreaterThan(0);
    expect(doors.every((f) => f.outNormal[0] > 0.9)).toBe(true);
    expect(R.find((f) => f.part === 'sign').outNormal[1]).toBeCloseTo(1, 6);
    expect(R.filter((f) => f.part === 'headlamp').every((f) => f.outNormal[1] > 0.9)).toBe(true);
    expect(R.filter((f) => f.part === 'taillamp').every((f) => f.outNormal[1] < -0.9)).toBe(true);
    // no skirt hangs below the arch's top over a wheel
    const r = c.spec.r;
    for (const w of c.faces.wheels) {
      const over = R.filter((f) => f.part === 'body' && Math.abs(f.outNormal[0]) > 0.9 && f.corners.every((p) => Math.abs(p[1] - w.hub[1]) < r * 0.5));
      for (const f of over) expect(Math.min(...f.corners.map((p) => p[2]))).toBeGreaterThan(r * 2);
    }
    expect(R.some((f) => f.part === 'door.handle')).toBe(false);
  });
  it('builds a truck\'s box and a semi\'s rig', () => {
    const T = parts(compiled('straight').form.root), S = parts(compiled('semi').form.root);
    for (const p of ['box', 'box.post', 'box.lockbar', 'marker', 'grille', 'headlamp', 'mudflap']) expect(T.has(p), p).toBe(true);
    for (const p of ['exhaust', 'tank', 'marker', 'skirt', 'grille', 'box.post']) expect(S.has(p), p).toBe(true);
  });
  it('leaves a car\'s body the loft\'s', () => {
    const P = parts(compileRealistic(sheet(carClass), { form: true }).form.root);
    expect(P.has('box.post') || P.has('sign')).toBe(false);
    expect(heavyBody({ kind: 'car' }, { hubs: [] })).toBe(null);
  });
});

describe('the studio grid: the loft as a game draws it, its light baked', () => {
  it('bakes the named faces under the studio\'s light, polygons fanned, a lit slot in its own colour', () => {
    const c = compileRealistic(sheet(carClass), { form: true }), faces = Object.values(c.form).flat();
    const baked = bakeForm(faces);
    expect(baked.every((f) => f.corners.length <= 4 && f.cornerFills.length === f.corners.length)).toBe(true);
    expect(baked.length).toBeGreaterThanOrEqual(faces.length);
    const lamp = faces.find((f) => f.material === 'lamp' || f.material === 'tail');
    expect(bakeForm([lamp])[0].fill).toBe(lamp.albedo);
    // a face looking at the key is lit brighter than one looking away
    const q = (n) => ({ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], albedo: '#808080', material: 'paint', outNormal: n });
    const lum = (hex) => parseInt(hex.slice(1, 3), 16);
    expect(lum(bakeForm([q([0, 0, 1])])[0].fill)).toBeGreaterThan(lum(bakeForm([q([0, 0, -1])])[0].fill));
  });
  it('is the loft\'s preview on the grid, whatever its light', () => {
    const lit = loftInstanceFaces({ class: carClass }), painted = loftInstanceFaces({ class: carClass, light: 'paint' });
    expect(lit.faces.length).toBe(painted.faces.length);
    expect(lit.faces.every((f) => f.corners.length <= 4)).toBe(true);
  });
});
