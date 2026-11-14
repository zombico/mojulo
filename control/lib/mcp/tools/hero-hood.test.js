// hero-hood.test.js — a hero's HOOD under the outfit laws 2 (body-garment.js drapedHood): cut and fallen as cloth from
// the head it is worn over, not a bell over an ellipsoid. Worn up it clears the skull and the hair, shows the face from
// the brow to the chin and cheek to cheek, lies on the cloak's collar at its foot and draws out to its point behind the
// crown; worn down it leaves the head bare. One case per body path, chosen in code: the tiered body's landmark head, the
// anime head (its big skull and hair), the chibi (the anime head at a child's scale) and the realistic head (its skin and
// hair the realistic lane's own). Laws 1 keep the old hood byte for byte.
import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';

import { heroRecord, heroPlanOf, expandLayeredManifest } from './layered.js';
import { compileOutfit } from '../../graph/polygonizer/outfit-plan.js';
import { compileLayered } from '../../graph/polygonizer/station-loft.js';
import { validateGarments } from '../../graph/polygonizer/body-garment.js';

const ranger = (laws, hood = true, extra = {}) => ({ type: 'outfit', style: 'adventurer', laws, pieces: [{ kind: 'cloak', hood, hem: 'calf' }], ...extra });
const PATHS = {
  landmark: { cast: 'male', register: 'round', hair: 'crop' },
  anime: { cast: 'female', head: 'anime', hair: 'long' },
  chibi: { cast: 'chibi' },
};
const recipeOf = (spec) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(spec) }).recipe;
const HEAD = /^(cranium|jaw|headSkin|face|ear[RL]|hair(?!Brows|Lashes|Beard)\w*)$/;

/** the compiled head (its points by kind), the hood's and the cape's faces, the head's landmarks as the kernel reads them */
function read(recipe) {
  const mesh = compileLayered(recipe), V = mesh.vertices, part = (i) => mesh.provenance[i].part;
  const head = [], face = [], brow = [];
  V.forEach((p, i) => { const n = part(i); if (HEAD.test(n)) { head.push(p); if (!/^(hair|ear)/.test(n)) face.push(p); } if (/^(brow[RL]|hairBrows)$/.test(n)) brow.push(p); });
  const tris = (re) => mesh.faces.filter((f) => re.test(part(f[0]))).map((f) => f.map((i) => V[i]));
  const top = Math.max(...head.map((p) => p[2])), cape = recipe.parts.cloak_cape, zb = cape.stations[0].points.p0[2];
  const sk = head.filter((p) => p[2] > top - 0.35 * (top - zb)), cy = (Math.min(...sk.map((p) => p[1])) + Math.max(...sk.map((p) => p[1]))) / 2;
  const front = face.filter((p) => p[1] > cy), chin = Math.min(...front.map((p) => p[2])), brw = brow.length ? Math.max(...brow.map((p) => p[2])) : chin + 0.62 * (top - chin);
  const cheek = Math.max(...front.filter((p) => p[2] >= chin + 0.15 * (brw - chin) && p[2] <= brw).map((p) => Math.abs(p[0])));
  return { recipe, head, cy, top, chin, brow: brw, cheek, hood: tris(/_hood$/), cape: tris(/_cape$/) };
}
/** the farthest the triangles reach along the horizontal ray from (0, cy, z) toward (x, y): null when none is hit */
function reach(tris, cy, p) {
  const d = [p[0], p[1] - cy, 0], l = Math.hypot(d[0], d[1]); if (l < 1e-6) return null; d[0] /= l; d[1] /= l; const o = [0, cy, p[2]]; let best = null;
  for (const [a, b, c] of tris) {
    if (Math.min(a[2], b[2], c[2]) > p[2] || Math.max(a[2], b[2], c[2]) < p[2]) continue;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], q = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * q[0] + e1[1] * q[1] + e1[2] * q[2]; if (Math.abs(det) < 1e-12) continue;
    const s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]], u = (s[0] * q[0] + s[1] * q[1] + s[2] * q[2]) / det; if (u < 0 || u > 1) continue;
    const r = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / det; if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * r[0] + e2[1] * r[1] + e2[2] * r[2]) / det; if (t > 0 && (best === null || t > best)) best = t;
  }
  return best;
}
const hoodVerts = (R) => Object.values(R.recipe.parts.cloakHood_hood.stations).flatMap((st) => Object.values(st.points));

/** worn up: clears the head and the hair, shows the face, lies on the collar, draws out to its point behind the crown */
function upChecks(R, label) {
  const hs = R.top - R.chin, every = Math.max(1, Math.floor(R.head.length / 900));
  let missedBack = 0, inside = 0;
  for (let i = 0; i < R.head.length; i += every) { const p = R.head[i]; if (p[2] < R.chin) continue;
    if (p[1] > R.cy && p[2] < R.brow && Math.abs(p[0]) < R.cheek) continue;   // the face, shown through the opening
    const r = reach(R.hood, R.cy, p), rp = Math.hypot(p[0], p[1] - R.cy);
    if (r === null) { if (p[1] < R.cy) missedBack += 1; continue; }
    if (r < rp + 0.002) inside += 1; }
  expect(missedBack, `${label}: the back of the head and the hair under the hood`).toBe(0);
  expect(inside, `${label}: the hood clears the skull and the hair`).toBe(0);
  // the face shown from the brow to the chin and cheek to cheek: no cloth in front of it
  const over = hoodVerts(R).filter((p) => p[1] > R.cy && p[2] > R.chin && p[2] < R.brow && Math.abs(p[0]) < 0.85 * R.cheek);
  expect(over.length, `${label}: the face open`).toBe(0);
  // its foot on the cloak's collar: below the cape's top, standing off it by no more than the cloth's ease
  const H = R.recipe.parts.cloakHood_hood, m = H.slots.length / 2, foot = H.slots.slice(0, m).map((sl) => H.stations[0].points[sl]);
  const capeTop = Math.max(...R.recipe.parts.cloak_cape.stations.flatMap((st) => Object.values(st.points)).map((p) => p[2]));
  for (const p of foot) { expect(p[2], `${label}: the foot under the collar's top`).toBeLessThanOrEqual(capeTop + 1e-6);
    const c = reach(R.cape, R.cy, p), rp = Math.hypot(p[0], p[1] - R.cy); if (c === null) continue;
    expect(rp - c, `${label}: the foot on the collar`).toBeGreaterThanOrEqual(-0.002); expect(rp - c, `${label}: no gap at the collar`).toBeLessThan(0.05); }
  // the point: the hood's back-most reach behind the skull's, below the crown and above the chin
  const back = hoodVerts(R).filter((p) => p[2] > R.brow).reduce((b, p) => (p[1] < b[1] ? p : b)), skullBack = Math.min(...R.head.filter((p) => p[2] > R.brow).map((p) => p[1]));
  expect(back[1], `${label}: the point drawn out behind the crown`).toBeLessThan(skullBack - 0.1 * hs);
  expect(back[2], `${label}: the point below the crown`).toBeLessThan(R.top); expect(back[2]).toBeGreaterThan(R.brow - 0.2 * hs);
}

describe('the hood, outfit laws 2', () => {
  for (const [path, body] of Object.entries(PATHS)) {
    it(`${path}: worn up it fits the head it is worn over, shows the face, lies on the collar and peaks behind`, { timeout: 120000 }, () => {
      upChecks(read(recipeOf({ ...body, outfit: ranger(2) })), path);
    });
  }
  it('realistic: the same on the realistic head and its hair', { timeout: 300000 }, () => {
    upChecks(read(recipeOf({ cast: 'male', form: 'realistic', face: { seed: 3 }, outfit: ranger(2) })), 'realistic');
  });
  it('worn down it lies on the shoulders and the back, the head bare; a long point hangs down the back as a strand of its cloth', { timeout: 120000 }, () => {
    const R = read(recipeOf({ ...PATHS.landmark, outfit: ranger(2, { worn: 'down', point: 'long' }) })), V = hoodVerts(R);
    expect(Math.max(...V.map((p) => p[2])), 'below the chin').toBeLessThan(R.chin);
    expect(V.filter((p) => p[1] > R.cy + 0.02).length, 'nothing before the throat but the collar').toBeLessThan(V.length * 0.2);
    const T = R.recipe.parts.cloakHood_hoodTail; expect(T, 'the liripipe').toBeTruthy();
    expect(T.material).toBe('wool'); expect(Array.isArray(T.root)).toBe(true);
    const tz = T.stations.map((st) => Object.values(st.points)[0][2]); expect(tz[tz.length - 1]).toBeLessThan(tz[0]);
    // (up, the long point's tail hangs from behind the crown, below it)
    const U = recipeOf({ ...PATHS.landmark, outfit: ranger(2, { point: 'long' }) }), root = U.parts.cloakHood_hoodTail.root;
    expect(root[1]).toBeLessThan(R.cy - 0.08); expect(root[2]).toBeLessThan(R.top);
    expect(U.parts.cloakHood_hood.material, 'the hood\'s body stays on the head').toBeUndefined();
  });
  it('the words: worn, point and depth are said and judged; the budget is the register\'s', { timeout: 120000 }, () => {
    // (an unknown word is said, as a hem's is: the cloak it is on is left off with it, never worn as a guess)
    const plan = heroPlanOf(heroRecord({ ...PATHS.landmark, outfit: { type: 'outfit', style: 'adventurer', laws: 2 } }));
    const wear = (hood) => compileOutfit({ ...plan, outfit: { laws: 2, pieces: [{ kind: 'cloak', hood }] } });
    expect(() => wear({ worn: 'sideways' })).toThrow(/hood\.worn: 'sideways'/);
    expect(() => wear({ lining: 'red' })).toThrow(/hood\.lining/);
    expect(wear({ worn: 'down', point: 'none', depth: 'shallow' }).garments.find((g) => g.fit === 'hood')).toMatchObject({ worn: 'down', point: 'none', depth: 'shallow' });
    expect(validateGarments([{ id: 'x', part: 'torso', ease: 0.01, group: 'G', point: 'long' }])[0]).toMatch(/point/);
    const slots = (register) => recipeOf({ cast: 'male', register, outfit: ranger(2) }).parts.cloakHood_hood.slots.length;
    expect(slots('box')).toBeLessThan(slots('lowpoly')); expect(slots('lowpoly')).toBeLessThan(slots('round'));
  });
  it('deterministic, and laws 1 keep the bell a stored row has, byte for byte', { timeout: 120000 }, () => {
    const a = recipeOf({ ...PATHS.landmark, outfit: ranger(2) }).parts.cloakHood_hood, b = recipeOf({ ...PATHS.landmark, outfit: ranger(2) }).parts.cloakHood_hood;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const old = recipeOf({ ...PATHS.landmark, outfit: ranger(1) }).parts;
    // (pinned 2026-11-14 on 5c7ed163, before the draped hood: the laws 1 hood and cape)
    const hash = crypto.createHash('sha256').update(JSON.stringify([old.cloakHood_hood, old.cloak_cape])).digest('hex').slice(0, 16);
    expect(hash).toBe('0b6368e9354aa73e');
    expect(old.cloakHood_hoodTail).toBeUndefined();
  });
});
