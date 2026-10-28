// The race machines upgraded: the supercar's streamlined line (its own budgets, wider tyres inside the old envelope, the
// arches clear of them, the aero kit, the pipes where the flames come out, the calipers, the light bar), the racer's gloss
// finish (its tyres turned on a lathe, the machine and its physics the plain one's), and the form render (gen-7): a
// figure carrying its material form for the page to light, its lamps baked; absent, every byte as it was.
import { describe, it, expect } from 'vitest';
import { composeSupercar, SUPERCAR_LIBRARY } from './vehicle-library.js';
import { STREAMLINE_BUDGETS } from './vehicle-odm-surface.js';
import { supercarFigure } from './supercar-figure.js';
import { racerOf, racerSpec } from './roster.js';
import { packFormMesh } from '../vehicle-designer/vehicle-rig.js';
import { formLight } from './form-light.js';
import { VEHICLE_MATERIALS } from './vehicle-surface-finish.js';
import { controllableChannelScript } from '../scene/channels/controllable/index.js';
import { bakeWheel, KART_MATERIALS, materialOfSlot } from './racer-shade.js';
import { buildBlock } from '../era/blocks.js';
import { PARTS } from './parts.js';

const preset = Object.keys(SUPERCAR_LIBRARY).find((p) => SUPERCAR_LIBRARY[p].brief.aero === 'track') ?? Object.keys(SUPERCAR_LIBRARY)[0];
const faces = (c) => Object.values(c.faces).flat();

describe('the streamlined supercar', () => {
  it('fits its own ceiling at every quality, finer than the classic line, and refuses an unknown line', () => {
    for (const quality of ['game', 'hero']) {
      const s = composeSupercar({ preset, surface: { quality, line: 'streamline' } }), c = composeSupercar({ preset, surface: { quality } });
      expect(s.census.triangles).toBeLessThanOrEqual(STREAMLINE_BUDGETS[quality]);
      expect(s.census.triangles).toBeGreaterThan(c.census.triangles);
      expect(s.line).toBe('streamline');
      expect(c.line).toBeUndefined();
    }
    expect(() => composeSupercar({ preset, surface: { line: 'bubble' } })).toThrow(/line is classic or streamline/);
  });
  it('wears an aero kit, pipes at the flames\' anchors, calipers and a light bar; its wider tyres stay inside the classic envelope', () => {
    const s = composeSupercar({ preset, surface: { quality: 'game', line: 'streamline' } }), c = composeSupercar({ preset, surface: { quality: 'game' } });
    const parts = new Set(faces(s).map((f) => f.part));
    for (const p of ['aero.splitter', 'aero.skirt', 'aero.strake', 'exhaust.tip', 'exhaust.bore', 'brake.caliper']) expect(parts.has(p), p).toBe(true);
    expect(faces(s).filter((f) => f.part === 'taillamp').length).toBeGreaterThan(faces(c).filter((f) => f.part === 'taillamp').length);
    // the pipes where supercar-figure.js puts the flames: ±W·0.18, the clearance and 0.12 up
    const F = s.design.frame, tips = faces(s).filter((f) => f.part === 'exhaust.tip').flatMap((f) => f.corners);
    for (const side of [-1, 1]) expect(tips.some((p) => Math.abs(p[0] - side * F.W * 0.18) < 0.06 && Math.abs(p[2] - (F.groundClearance + 0.12)) < 0.06)).toBe(true);
    const outer = (cc) => Math.max(...cc.faces.wheels.flatMap((f) => f.corners.map((p) => Math.abs(p[0]))));
    expect(outer(s)).toBeLessThanOrEqual(outer(c) + 1e-6);
    const width = (cc) => { const xs = cc.faces.wheels.filter((f) => f.part === 'tyre').flatMap((f) => f.corners.map((p) => p[0])).filter((x) => x > 0); return Math.max(...xs) - Math.min(...xs); };
    expect(width(s)).toBeGreaterThan(width(c) * 1.15);
    expect(faces(s).every((f) => f.corners.flat().every(Number.isFinite))).toBe(true);
    expect(JSON.stringify(composeSupercar({ preset, surface: { quality: 'game', line: 'streamline' } }))).toBe(JSON.stringify(s));
  });
});

describe('the form render', () => {
  it('packs a bone\'s material form: every triangle in its slot\'s group, normals unit, the albedo linear', () => {
    const c = composeSupercar({ preset, surface: { quality: 'game', line: 'streamline' } }), body = [...c.faces.body, ...c.faces.detail].filter((f) => f.corners.length === 4);
    const P = packFormMesh(body), idx = new Uint16Array(Buffer.from(P.idx, 'base64').buffer.slice(0));
    expect(P.groups.reduce((n, g) => n + g[1], 0)).toBe(idx.length);
    expect(P.mats).toEqual([...new Set(body.map((f) => f.material))].sort());
    const nrm = new Int8Array(Buffer.from(P.nrm, 'base64'));
    for (let i = 0; i < nrm.length; i += 3) expect(Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) / 127).toBeGreaterThan(0.95);
    expect(Math.max(...idx)).toBe(P.n - 1);
  });
  it('carries its form on the supercar\'s body and wheels when asked or read in gen-7, its lamps baked; absent, as before', () => {
    const plain = supercarFigure({ preset }), lit = supercarFigure({ preset, light: 'form' }), read = supercarFigure({ preset }, { form: true });
    expect(plain.form).toBeUndefined();
    expect(JSON.stringify(supercarFigure({ preset, light: 'paint' }, { form: true }))).toBe(JSON.stringify(plain));
    expect(JSON.stringify(read)).toBe(JSON.stringify(lit));
    for (const [b, part] of lit.bones.map((b, i) => [b, lit.parts[i]])) expect(!!part.form, b.id).toBe(!b.id.startsWith('lamp'));
    expect(lit.form.materials).toBe(VEHICLE_MATERIALS);
    expect(() => supercarFigure({ preset, light: 'hdr' })).toThrow(/light is form/);
    // a mood's key, ambient and sky; noon's otherwise
    expect(formLight(null, {}).toLight).toBeUndefined();
    expect(supercarFigure({ preset, mood: 'golden', light: 'form' }).form.toLight).toHaveLength(3);
  });
  it('carries a finished racer\'s form (never a cel racer\'s), its gloss tyres turned, its machine the plain one\'s', () => {
    const spec = { facets: { archetype: 'ruler' }, seed: 3 };
    const cel = racerOf({ ...spec, shade: 'cel' }, { form: true }).S, gloss = racerOf({ ...spec, shade: 'gloss' }, { form: true }).S, smooth = racerOf({ ...spec, shade: 'smooth' }).S;
    expect(cel.figure.form).toBeUndefined();
    expect(gloss.figure.form).toBeTruthy();
    expect(smooth.figure.form).toBeUndefined();
    expect(gloss.physics).toEqual(smooth.physics);
    expect(gloss.physics.mass).toBe(cel.physics.mass);
    // (a lathed tyre: more faces round it than the prism, and its shoulder rounder: its tread narrower than its flank)
    expect(gloss.census.triangles).toBeGreaterThan(smooth.census.triangles);
    expect(racerSpec('ruler')).toMatchObject({ shade: 'gloss', light: 'form' });
    expect(racerSpec({ archetype: 'ruler', shade: 'cel', light: 'paint' })).toMatchObject({ shade: 'cel', light: 'paint' });
  }, 60000);
  it('draws a form figure with physical materials on the page, and a page without one as it was', () => {
    const fig = supercarFigure({ preset, light: 'form' }), plain = supercarFigure({ preset });
    const ent = [{ id: 'car', pilotable: true, rule: { type: 'drive' }, body: { type: 'figure-rig', figure: 'sc' }, transform: { pos: [0, 0, 0], heading: 0 } }];
    const lit = controllableChannelScript(ent, null, { sc: fig }, { pilot: 'car', formSun: [0.4, -0.3, 0.86] }), paint = controllableChannelScript(ent, null, { sc: plain }, { pilot: 'car' });
    expect(lit).toContain('MeshPhysicalMaterial');
    expect(lit).toContain('[0.4,-0.3,0.86]');
    expect(paint).not.toContain('__formBone');
    expect(paint).not.toContain('MeshPhysicalMaterial');
  });
});

describe('the gloss wheel', () => {
  const wheelIds = Object.keys(PARTS).filter((id) => PARTS[id].family === 'wheel');
  const box = (fs) => [0, 1, 2].map((k) => [Math.min(...fs.flatMap((f) => f.corners.map((p) => p[k]))), Math.max(...fs.flatMap((f) => f.corners.map((p) => p[k])))]);
  it('turns its tyre and its rim on the lathe within the wheel\'s own radius and width, its decals tagged', () => {
    for (const id of [wheelIds[0], wheelIds[wheelIds.length - 1]]) {
      const P = { r: 0.3, w: 0.2 }, plain = buildBlock(PARTS[id].block, { params: P }).faces, lathe = buildBlock(PARTS[id].block, { params: P, lathe: true }).faces;
      // (the plain prism's box is its polygon's; the lathe's round reaches the radius itself, no further, and no wider)
      const a = box(plain), b = box(lathe);
      expect(b[0][0], id).toBeGreaterThanOrEqual(a[0][0] - 1e-3);
      expect(b[0][1], id).toBeLessThanOrEqual(a[0][1] + 1e-3);
      for (const f of lathe) for (const [, y, z] of f.corners) expect(Math.hypot(y, z - P.r), id).toBeLessThanOrEqual(P.r + 1e-3);
      const decals = new Set(lathe.map((f) => f.decal).filter(Boolean));
      for (const d of ['groove', 'stripe']) expect(decals.has(d), `${id} ${d}`).toBe(true);
      expect(lathe.length).toBeGreaterThan(plain.length);
      for (const f of lathe) { expect(f.corners.length).toBeGreaterThanOrEqual(3); expect(f.corners.flat().every(Number.isFinite)).toBe(true); }
    }
    // a running drum turned as a dish: its lip, its dish and its boss
    const rimmed = wheelIds.find((id) => PARTS[id].block.parts.some((p) => p.prim === 'drum' && p.role === 'running'));
    const tags = new Set(buildBlock(PARTS[rimmed].block, { params: { r: 0.3, w: 0.2 }, lathe: true }).faces.map((f) => f.decal));
    for (const d of ['lip', 'dish', 'boss']) expect(tags.has(d), d).toBe(true);
    expect(materialOfSlot('wheel:lip')).toBe('chrome');
    expect(materialOfSlot('wheel:groove')).toBe('tread');
    expect(KART_MATERIALS.chrome.metalness).toBe(1);
  });
  it('paints its occlusion and its edges and no light that would turn with it: the same bake at any turn of the wheel', () => {
    const { S } = racerOf({ facets: { archetype: 'ruler' }, seed: 3, shade: 'gloss' });
    const faces = S.faces.wheels[0].faces, hub = S.faces.wheels[0].hub;
    for (const f of faces) { expect(f.cornerAlbedo).toHaveLength(f.corners.length); expect(f.cornerAlbedo.every((h) => /^#[0-9a-f]{6}$/.test(h))).toBe(true); }
    // some corner darkened by the occlusion (the bead in the dish), none lifted past its slot's own colour twice over
    expect(faces.some((f) => f.cornerAlbedo.some((h) => h !== f.albedo))).toBe(true);
    // turned a third of a turn about its axle: every corner bakes the same
    const turn = (a) => faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => { const dy = y - hub[1], dz = z - hub[2]; return [x, hub[1] + dy * Math.cos(a) - dz * Math.sin(a), hub[2] + dy * Math.sin(a) + dz * Math.cos(a)]; }) }));
    const strip = (fs) => fs.map((f) => ({ ...f, cornerFills: f.corners.map(() => f.fill), cornerAlbedo: undefined }));
    const at0 = bakeWheel(strip(faces)), at1 = bakeWheel(strip(turn((2 * Math.PI) / 3)));
    const diff = at0.flatMap((f, i) => f.cornerAlbedo.map((h, j) => Math.abs(parseInt(h.slice(1, 3), 16) - parseInt(at1[i].cornerAlbedo[j].slice(1, 3), 16))));
    expect(Math.max(...diff)).toBeLessThanOrEqual(3);
  }, 60000);
  it('carries each corner\'s painted albedo into its form', () => {
    const P = packFormMesh([{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], material: 'paint', albedo: '#808080', cornerAlbedo: ['#808080', '#404040', '#808080', '#808080'], cornerNormals: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]] }]);
    expect(P.n).toBe(4);
    const c = Buffer.from(P.col, 'base64');
    expect(new Set(Array.from(c)).size).toBe(2);
  });
});
