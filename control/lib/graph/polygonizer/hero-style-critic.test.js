import { describe, it, expect } from 'vitest';
import { styleMeasures, styleCritic, STYLE_BANDS, STYLES, chestMeasures, chestCritic } from './hero-style-critic.js';
import { castSpend, tierOf } from '../era/cast-spend.js';
import { heroRecord, expandLayeredManifest, planLayered, validateHeroSpec } from '../../mcp/tools/layered.js';
import { validateRig } from './station-loft-rig.js';
import { standPose, poseLayered } from './hero-gesture.js';
import { TIERED_JOINTS, TIERED_FACE } from './tiered-form.js';
import { layeredShadingNormals } from './station-loft-shade.js';

const built = (spec) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }); return { m, mesh: planLayered(m).mesh }; };
const chestY = (mesh, z) => { let y = -1; for (const v of mesh.vertices) if (Math.abs(v[2] - z) < 0.015 && Math.abs(v[0]) < 0.12) y = Math.max(y, v[1]); return y; };

describe('the style critics', () => {
  it('two canons for each body, every band low below high', () => {
    expect(STYLES).toEqual(['western', 'anime']);
    for (const st of STYLES) for (const body of ['female', 'male']) for (const [k, [lo, hi]] of Object.entries(STYLE_BANDS[st][body])) expect(lo, `${st}.${body}.${k}`).toBeLessThan(hi);
  });

  it('reads a hero in head heights: the anime head is shorter in heads than the landmark head and fits its canon better', () => {
    const west = built({ cast: 'female' }), anime = built({ cast: 'female', head: 'anime' });
    const w = styleMeasures(west.m.plan, west.mesh), a = styleMeasures(anime.m.plan, anime.mesh);
    expect(w.headsTall).toBeGreaterThan(a.headsTall);
    const fit = (m, st) => Number(styleCritic(m, st, 'female').fit.split('/')[0]);
    expect(fit(a, 'anime')).toBeGreaterThan(fit(a, 'western'));
    expect(fit(w, 'western')).toBeGreaterThan(fit(w, 'anime'));
    expect(styleCritic(w, 'anime', 'female').advice.join(' ')).toMatch(/anime: heads tall .* is over 6–7.5 \(female\); it moves with \/hero\/tune\/head/);
  }, 120000);

  it('a hero with no head has no head unit to read', () => {
    const none = built({ cast: 'female', head: 'none' });
    expect(styleMeasures(none.m.plan, none.mesh)).toBeNull();
  }, 60000);
});

describe('the spend critic', () => {
  it('picks the tier by pixel height and reads each region against its reserve', () => {
    expect(['T0', 'T1', 'T2', 'T3', 'T4'].map((id, k) => tierOf([100, 240, 360, 720, 1728][k]).id)).toEqual(['T0', 'T1', 'T2', 'T3', 'T4']);
    const { m, mesh } = built({ cast: 'female' });
    const s = castSpend(mesh, m.plan, '720p');
    expect(s).toMatchObject({ tier: 'T1', figurePx: 240, budget: 2880, triangles: 5196 });
    expect(Object.values(s.regions).reduce((t, r) => t + r.triangles, 0)).toBe(5196);
    expect(s.heaviest[0]).toMatchObject({ part: expect.stringMatching(/^bust[RL]$/), region: 'body' });
  }, 60000);

  it('a bare figure spends nothing on clothing: the jaw is the head\'s, the tiered form\'s bridges and balls the body\'s', () => {
    for (const spec of [{ cast: 'female' }, { cast: 'female', form: 'tiered' }]) {
      const { m, mesh } = built(spec), s = castSpend(mesh, m.plan, '1080p');
      expect(s.regions.clothing.triangles, JSON.stringify(spec)).toBe(0);
    }
  }, 120000);
});

describe('the tiered form', () => {
  it('draws the chest into the torso: no domes, a quarter fewer triangles, standing off the chest wall', () => {
    const today = built({ cast: 'female' }), tiered = built({ cast: 'female', form: 'tiered' });
    expect(tiered.m.plan.segments.some((s) => /^bust/.test(s.name))).toBe(false);
    expect(tiered.mesh.faces.length).toBe(5480);   // (hero laws 8 and 9: the shoulders' webs and cones, 384, over the 5,096 below) the domes' 1,280 gone, the chest band's three rings added; the six joint bridges, the limbs' ring8 and the shoulder balls 752; the lower lips 64; the eyes' domes and lids 160; the lips' denser strips 144; the brows' 48; the nose's wings 192; the lean ears −400; the brow ridge's eye-and-brow column 52 (cranium 36, jaw 16) and the brows' spans halved again over it 96
    // the chest stands off the wall (the same figure with no bust) by a couple of centimetres at its fullest
    const wall = built({ cast: 'female', body: { bust: 0 } }), front = (mesh) => Math.max(...[1.13, 1.16, 1.19, 1.22].map((z) => chestY(mesh, z)));
    expect(front(tiered.mesh) - front(wall.mesh)).toBeGreaterThan(0.015);
  }, 120000);

  it('the ear by tier: lean below a close-up (no target, 1080p third-person), the full ear at T3 and up', () => {
    const ears = (spec) => { const { mesh } = built({ cast: 'female', form: 'tiered', ...spec }); return mesh.faces.filter((t) => /^ear[RL]$/.test(mesh.provenance[t[0]].part)).length; };
    expect(ears({})).toBe(160);
    expect(ears({ target: '1080p' })).toBe(160);
    expect(ears({ target: { resolution: '1080p', framing: 'close' } })).toBe(560);
    expect(ears({ target: '4k' })).toBe(560);
  }, 120000);

  it('a male, a child-coded figure or a bust of 0 takes no profile; the form is checked by name', () => {
    // the male's tiered form is today's and the joints' bridges and balls, the lips and the eyes' domes and lids, less
    // the lean ears' 400 (two ears at 80 against 280); the brow ridge's column and the brows over it 148; the shoulders'
    // webs and cones 384 (hero laws 8 and 9)
    expect(built({ cast: 'male', form: 'tiered' }).mesh.faces.length - built({ cast: 'male' }).mesh.faces.length).toBe(1492);
    expect(validateHeroSpec({ form: 'layered' })[0]).toMatch(/form: 'tiered'/);
  }, 120000);
});

describe('the tiered joints', () => {
  // a ring's points by slot, off the compiled (or skinned) mesh
  const ring = (mesh, V, part, st) => { const o = {}; mesh.pointIds.forEach((id, i) => { const m = id.match(/^([^/]+)\/([^.]+)\.(.+)$/); if (m && m[1] === part && m[2] === st) o[m[3]] = V[i]; }); return o; };
  const lastSt = (mesh, part) => { let last = null; mesh.pointIds.forEach((id) => { const m = id.match(/^([^/]+)\/([^.]+)\./); if (m && m[1] === part) last = m[2]; }); return last; };
  // the two rings as point sets (a bridge's slots may be turned against the lower part's): every point of each on the other
  const gap = (a, b) => { const A = Object.values(a), B = Object.values(b); if (!A.length || A.length !== B.length) return Infinity;
    const near = (P, Q) => Math.max(...P.map((p) => Math.min(...Q.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))))); return Math.max(near(A, B), near(B, A)); };
  const seams = (mesh, V) => TIERED_JOINTS.flatMap((J) => ['R', 'L'].flatMap((S) => { const br = J.bridge.replace(/R$/, S), up = J.upper.replace(/R$/, S), lo = J.lower.replace(/R$/, S);
    return [gap(ring(mesh, V, up, lastSt(mesh, up)), ring(mesh, V, br, 'st0')), gap(ring(mesh, V, br, lastSt(mesh, br)), ring(mesh, V, lo, 'st0'))]; }));
  it('each limb stops short of its joint and a bridge spans it, its ends the limbs\' own rings at rest and bent, bare, clothed and split', () => {
    for (const spec of [{}, { detail: 'clothed' }, { target: '1080p' }]) {
      const { m, mesh } = built({ cast: 'female', form: 'tiered', ...spec });
      expect(Math.max(...seams(mesh, mesh.vertices)), JSON.stringify(spec)).toBeLessThan(1e-6);
      const R = validateRig(m.recipe.rig), bent = poseLayered(mesh, m.recipe, { ...(standPose(m.recipe, R) ?? {}), elbowR: 140, elbowL: 90, wristR: -70, wristL: { flex: 50, deviation: 20 } }, { R });
      expect(Math.max(...seams(mesh, bent.mesh.vertices)), JSON.stringify(spec)).toBeLessThan(1e-6);
    }
    // the upper arm no longer runs past the elbow: every point on the shoulder's side of it
    const { m, mesh } = built({ cast: 'female', form: 'tiered' }), J = m.plan.joints, d = J.elbow.map((x, k) => x - J.shoulder[k]), L = Math.hypot(...d);
    const along = (v) => ((v[0] - J.shoulder[0]) * d[0] + (v[1] - J.shoulder[1]) * d[1] + (v[2] - J.shoulder[2]) * d[2]) / L;
    expect(Math.max(...mesh.vertices.filter((_, i) => mesh.provenance[i].part === 'upperArmR').map(along))).toBeLessThan(L);
  }, 240000);
});

describe('the tiered sockets', () => {
  // the arm's root ring, posed with the arm overhead: its mean radius over its rest radius (a stalk is well under 1)
  const rootGirth = (spec) => { const { m, mesh } = built({ cast: 'female', ...spec }), R = validateRig(m.recipe.rig);
    const posed = poseLayered(mesh, m.recipe, { ...(standPose(m.recipe, R) ?? {}), armR: 'up' }, { R }).mesh.vertices;
    const idx = mesh.pointIds.map((id, i) => [id, i]).filter(([id]) => /^upperArmR\/st0\./.test(id)).map(([, i]) => i);
    const r = (V) => { const c = [0, 1, 2].map((k) => idx.reduce((t, i) => t + V[i][k], 0) / idx.length); return idx.reduce((t, i) => t + Math.hypot(...V[i].map((x, k) => x - c[k])), 0) / idx.length; };
    return r(posed) / r(mesh.vertices); };
  it('the arm turns whole in its socket: a raised arm keeps its root\'s girth, the torso\'s shoulder takes a share of the fold', () => {
    expect(rootGirth({ form: 'tiered' })).toBeGreaterThan(0.98);
    expect(rootGirth({})).toBeLessThan(rootGirth({ form: 'tiered' }));
    const { m } = built({ cast: 'female', form: 'tiered' });
    expect(m.recipe.rig.folds.shoulderFoldR.bones).toEqual(['clavicleR', 'upperArmR']);
    expect(m.recipe.parts.torso.bind.blend['st3.sideR'].shoulderFoldR).toBeGreaterThan(0.3);
    expect(m.recipe.parts.thighR.bind.blend.st1).toEqual({ hipFoldR: 1 });
    // the shoulder's ball (the vajra's ball-in-socket) rides the fold; the hip's sits deep in the pelvis, none
    expect([m.recipe.parts.shoulderBallR?.bind, m.recipe.parts.shoulderBallL?.bind, m.recipe.parts.hipBallR]).toEqual(['shoulderFoldR', 'shoulderFoldL', undefined]);
  }, 120000);
});

describe('the tiered face', () => {
  it('pins the landmark head\'s defaults by sex under the operator\'s words; today\'s hero keeps today\'s head', () => {
    const f = built({ cast: 'female', form: 'tiered' }), m = built({ cast: 'male', form: 'tiered' }), today = built({ cast: 'female' });
    // the female's longer hair, stored on the record; the male keeps the swept cut; a named style wins
    expect([f.m.hero.hair.style, m.m.hero.hair.style, today.m.hero.hair.style]).toEqual(['bob', 'swept', 'swept']);
    expect(built({ cast: 'female', form: 'tiered', hair: 'ponytail' }).m.hero.hair.style).toBe('ponytail');
    // a lower lip in the lips' tint of the skin; today none, and the lip the skin at 0.96
    expect(Object.keys(f.m.recipe.parts).filter((k) => /^lowerLip/.test(k))).toEqual(['lowerLipR', 'lowerLipL']);
    expect(Object.keys(today.m.recipe.parts).some((k) => /^lowerLip/.test(k))).toBe(false);
    // the eye under a lid: a lower lid on the tiered head, none today
    expect([Object.keys(f.m.recipe.parts).filter((k) => /^lidLow/.test(k)).length, Object.keys(today.m.recipe.parts).filter((k) => /^lidLow/.test(k)).length]).toEqual([2, 0]);
    expect(f.m.recipe.palette.Lip).toBe('#bc6e60');
    expect(built({ cast: 'female', form: 'tiered', palette: { Skin: '#8d5a3b' } }).m.recipe.palette.Lip).toBe('#7a3b2d');   // the tint follows the skin
    expect(built({ cast: 'female', form: 'tiered', palette: { Lip: '#aa3344' } }).m.recipe.palette.Lip).toBe('#aa3344');   // the operator's wins
    // the face words compose by product: the operator's jaw moves from the tiered default
    const jaw = (spec) => { const { mesh: me } = built(spec); return Math.max(...me.vertices.filter((_, i) => me.provenance[i].part === 'jaw').map((v) => v[0])); };
    expect(jaw({ cast: 'female', form: 'tiered', face: { jawWidth: 1.1 } })).toBeGreaterThan(jaw({ cast: 'female', form: 'tiered' }));
    expect(TIERED_FACE.female.face.jawWidth).toBeLessThan(TIERED_FACE.male.face.jawWidth);
    // the nose stands further off the eye: its tip's lead over the eye's front, pinned against today's
    const lead = (mm) => { const y = (re) => Math.max(...mm.vertices.filter((_, i) => re.test(mm.provenance[i].part)).map((v) => v[1])); return y(/^cranium$/) - y(/^eyeR$/); };
    expect(lead(f.mesh)).toBeGreaterThan(lead(today.mesh) + 0.004);
    // the nose's wings, on the tiered head only
    expect([Object.keys(f.m.recipe.parts).filter((k) => /^wing[RL]$/.test(k)).length, Object.keys(today.m.recipe.parts).filter((k) => /^wing[RL]$/.test(k)).length]).toEqual([2, 0]);
  }, 240000);

  it('the head\'s normals lean toward its ellipsoid: the skin of the cranium and the jaw, none elsewhere', () => {
    const { m, mesh } = built({ cast: 'male', form: 'tiered' });
    const a = layeredShadingNormals(mesh, m.recipe, { crease: 70, proxy: false }), b = layeredShadingNormals(mesh, m.recipe, { crease: 70, proxy: false, ellipsoid: 0.7 });
    const moved = (part) => mesh.faces.some((t, fi) => mesh.provenance[t[0]].part === part && b[fi].some((n, k) => Math.hypot(n[0] - a[fi][k][0], n[1] - a[fi][k][1], n[2] - a[fi][k][2]) > 1e-6));
    expect([moved('cranium'), moved('jaw'), moved('earR'), moved('torso')]).toEqual([true, true, true, false]);
    expect(layeredShadingNormals(mesh, m.recipe, { crease: 70, proxy: false, ellipsoid: 0 })).toEqual(a);
    // round the nose the blend falls to its share: the nose's corners move less toward the sphere than the brow's
    const c = layeredShadingNormals(mesh, m.recipe, { crease: 70, proxy: false, ellipsoid: { w: 0.7, nose: 0.25 } });
    const nose = mesh.provenance.findIndex((pv) => pv.part === 'nostrilR'), at = mesh.vertices[nose];
    const shift = (N) => { let s = 0; mesh.faces.forEach((t, fi) => { if (mesh.provenance[t[0]].part !== 'cranium') return; t.forEach((vi, k) => { const v = mesh.vertices[vi]; if (Math.hypot(v[0] - at[0], v[1] - at[1], v[2] - at[2]) < 0.01) s = Math.max(s, Math.hypot(...N[fi][k].map((x, q) => x - a[fi][k][q]))); }); }); return s; };
    expect(shift(c)).toBeLessThan(shift(b));
  }, 120000);
});

describe('the chest critic', () => {
  const read = (spec) => { const { m, mesh } = built({ cast: 'female', ...spec }); return chestCritic(chestMeasures(m.plan, mesh, styleMeasures(m.plan, mesh).head_m)); };
  it('today\'s domes are set close together with a filled midline; the tiered chest holds the equilateral rule and a gap', () => {
    const today = read({}), tiered = read({ form: 'tiered' });
    expect(today.verdicts.spacing.at).toBe('low');
    expect(today.verdicts.gap.at).toBe('low');
    expect(today.advice.join(' ')).toMatch(/a garment's cleavage/);
    expect(tiered.fit).toBe('3/3');
    // clothed: the jerkin's volume lifts the chest, so the apex reads a little nearer the notch (spacing 1.18, just over)
    const clothed = read({ form: 'tiered', detail: 'clothed' });
    expect([clothed.verdicts.apex.at, clothed.verdicts.gap.at]).toEqual(['in', 'in']);
    expect(clothed.verdicts.spacing.value).toBeLessThan(1.25);
  }, 120000);
});
