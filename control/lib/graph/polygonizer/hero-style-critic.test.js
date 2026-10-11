import { describe, it, expect } from 'vitest';
import { styleMeasures, styleCritic, STYLE_BANDS, STYLES, chestMeasures, chestCritic } from './hero-style-critic.js';
import { castSpend, tierOf } from '../era/cast-spend.js';
import { heroRecord, expandLayeredManifest, planLayered, validateHeroSpec } from '../../mcp/tools/layered.js';
import { validateRig } from './station-loft-rig.js';
import { standPose, poseLayered } from './hero-gesture.js';
import { TIERED_JOINTS } from './tiered-form.js';

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
});

describe('the tiered form', () => {
  it('draws the chest into the torso: no domes, a quarter fewer triangles, standing off the chest wall', () => {
    const today = built({ cast: 'female' }), tiered = built({ cast: 'female', form: 'tiered' });
    expect(tiered.m.plan.segments.some((s) => /^bust/.test(s.name))).toBe(false);
    expect(tiered.mesh.faces.length).toBe(4308);   // the domes' 1,280 gone, the chest band's three rings added; the four joint bridges (and the shin's ring8) 320
    // the chest stands off the wall (the same figure with no bust) by a couple of centimetres at its fullest
    const wall = built({ cast: 'female', body: { bust: 0 } }), front = (mesh) => Math.max(...[1.13, 1.16, 1.19, 1.22].map((z) => chestY(mesh, z)));
    expect(front(tiered.mesh) - front(wall.mesh)).toBeGreaterThan(0.015);
  }, 120000);

  it('a male, a child-coded figure or a bust of 0 takes no profile; the form is checked by name', () => {
    // the male's tiered form is today's and the joints' bridges alone (the female's 320)
    expect(built({ cast: 'male', form: 'tiered' }).mesh.faces.length - built({ cast: 'male' }).mesh.faces.length).toBe(320);
    expect(validateHeroSpec({ form: 'layered' })[0]).toMatch(/form: 'tiered'/);
  }, 120000);
});

describe('the tiered joints', () => {
  // a ring's points by slot, off the compiled (or skinned) mesh
  const ring = (mesh, V, part, st) => { const o = {}; mesh.pointIds.forEach((id, i) => { const m = id.match(/^([^/]+)\/([^.]+)\.(.+)$/); if (m && m[1] === part && m[2] === st) o[m[3]] = V[i]; }); return o; };
  const lastSt = (mesh, part) => { let last = null; mesh.pointIds.forEach((id) => { const m = id.match(/^([^/]+)\/([^.]+)\./); if (m && m[1] === part) last = m[2]; }); return last; };
  const gap = (a, b) => Math.max(...Object.keys(b).map((sl) => (a[sl] ? Math.hypot(a[sl][0] - b[sl][0], a[sl][1] - b[sl][1], a[sl][2] - b[sl][2]) : Infinity)));
  const seams = (mesh, V) => TIERED_JOINTS.flatMap((J) => ['R', 'L'].flatMap((S) => { const br = J.bridge.replace(/R$/, S), up = J.upper.replace(/R$/, S), lo = J.lower.replace(/R$/, S);
    return [gap(ring(mesh, V, up, lastSt(mesh, up)), ring(mesh, V, br, 'st0')), gap(ring(mesh, V, br, lastSt(mesh, br)), ring(mesh, V, lo, 'st0'))]; }));
  it('each limb stops short of its joint and a bridge spans it, its ends the limbs\' own rings at rest and bent, bare, clothed and split', () => {
    for (const spec of [{}, { detail: 'clothed' }, { target: '1080p' }]) {
      const { m, mesh } = built({ cast: 'female', form: 'tiered', ...spec });
      expect(Math.max(...seams(mesh, mesh.vertices)), JSON.stringify(spec)).toBeLessThan(1e-6);
      const R = validateRig(m.recipe.rig), bent = poseLayered(mesh, m.recipe, { ...(standPose(m.recipe, R) ?? {}), elbowR: 140, elbowL: 90 }, { R });
      expect(Math.max(...seams(mesh, bent.mesh.vertices)), JSON.stringify(spec)).toBeLessThan(1e-6);
    }
    // the upper arm no longer runs past the elbow: every point on the shoulder's side of it
    const { m, mesh } = built({ cast: 'female', form: 'tiered' }), J = m.plan.joints, d = J.elbow.map((x, k) => x - J.shoulder[k]), L = Math.hypot(...d);
    const along = (v) => ((v[0] - J.shoulder[0]) * d[0] + (v[1] - J.shoulder[1]) * d[1] + (v[2] - J.shoulder[2]) * d[2]) / L;
    expect(Math.max(...mesh.vertices.filter((_, i) => mesh.provenance[i].part === 'upperArmR').map(along))).toBeLessThan(L);
  }, 240000);
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
