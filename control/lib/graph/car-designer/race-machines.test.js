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
