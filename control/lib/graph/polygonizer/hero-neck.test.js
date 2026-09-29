/** The NECK FORM (hero-form.js ANIME_NECK_FORMS): the anime casts' neck as a ring loft whose back rises into the occiput,
 * the male's trapezius ring; and the neck occlusion rule it is lit under (station-loft-shade.js). Absent ⇒ the plan as it
 * was; the column sits inside its width band; at every preset stand its top stays buried in the head, the nape enters
 * the skull at the hair hem or above, and the mint's gates pass on both registers. */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { heroPlan, ANIME_NECK_FORMS } from './hero-form.js';
import { humanoidPlan } from './humanoid-plan.js';
import { GESTURE_PRESETS, standPose, poseLayered } from './hero-gesture.js';
import { validateRig, bindLayered } from './station-loft-rig.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { SLOT_FAMILIES } from './station-loft-plan.js';
import { heroRecord, heroPlanOf, expandLayeredManifest, planLayered, neckReadout } from '../../mcp/tools/layered.js';

const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const door = (spec) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
const neckOf = (plan) => plan.segments.find((s) => s.name === 'neck');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const RAY = [0.8726, 0.3313, 0.3589];
const inside = (tris, q) => { let c = 0; for (const [A, B, C] of tris) { const e1 = sub(B, A), e2 = sub(C, A), p = cross(RAY, e2), det = dot(e1, p); if (Math.abs(det) < 1e-14) continue; const tv = sub(q, A), u = dot(tv, p) / det; if (u < 0 || u > 1) continue; const qq = cross(tv, e1), v = dot(RAY, qq) / det; if (v < 0 || u + v > 1) continue; if (dot(e2, qq) / det > 0) c++; } return c % 2 === 1; };

// Re-pinned for the hero's `wave` clip (hero-form.js): the upper arm level and the forearm up, the elbow never over
// the head. Every hero plan carries the clip, so the plan, the recipe and the pages move with it and with nothing else
// (with the old wave restored these pins pass unchanged).
describe('the neck form: absent ⇒ the plan as it was', () => {
  it('reaches only the anime head on anime proportions; every other path keeps the segment, byte for byte', () => {
    // pinned from the code before the neck form existed (sha256(JSON.stringify(plan)), first 16 hex digits)
    expect(h(heroPlan({ cast: 'male', proportions: 'anime' }))).toBe('7df808760df93813');
    expect(h(heroPlan({ cast: 'female', proportions: 'anime', register: 'lowpoly' }))).toBe('d5582c1b5d57b926');
    expect(heroPlan({ cast: 'male', proportions: 'anime', neckForm: null })).toEqual(heroPlan({ cast: 'male', proportions: 'anime' }));
    expect(h(humanoidPlan({ preset: 'male', proportions: 'anime' }))).toBe('a548ad8506b71fba');   // the landmark head on anime proportions
    expect(h(heroPlanOf(heroRecord({ cast: 'female', proportions: 'anime' })))).toBe('6e8dcaca2f4e56eb');
    expect(neckOf(heroPlanOf(heroRecord({ cast: 'male', head: 'anime', proportions: 'hero' }))).kind).toBe('segment');
    expect(neckOf(heroPlanOf(heroRecord({ cast: 'stout', head: 'anime' }))).kind).toBe('segment');   // a figure cast has none
    for (const cast of ['female', 'male']) {
      const n = neckOf(heroPlanOf(heroRecord({ cast, head: 'anime', register: 'lowpoly' })));
      expect(n.kind, cast).toBe('loft'); expect(n.slots, cast).toBe('ring12'); expect(n.e, cast).toBe(2); expect(n.stations, cast).toHaveLength(ANIME_NECK_FORMS[cast].rings.length);
    }
  });
  it('the trapezius ring replaces the male collar (no collar rise, no widening); the female keeps her collar', () => {
    const top = (spec) => { const t = heroPlanOf(heroRecord(spec)).segments.find((s) => s.name === 'torso'); return { st: t.stations.at(-1), tip: t.caps.tip, blend: t.bind.blend.st4 }; };
    const m = top({ cast: 'male', head: 'anime' }), T = ANIME_NECK_FORMS.male.trap;
    const zs = heroPlanOf(heroRecord({ cast: 'male', head: 'anime' })).joints.neckHub[2];
    expect(m.st.r).toEqual(T.r); expect(m.st.yc).toBe(T.yc); expect(m.st.z).toBeCloseTo(zs + T.z, 6); expect(m.tip[2]).toBeCloseTo(zs + T.tip, 6); expect(m.blend).toEqual(T.blend);
    expect(ANIME_NECK_FORMS.female.trap).toBeUndefined();
    const f = top({ cast: 'female', head: 'anime' }); expect(f.st.yc).toBeUndefined(); expect(f.blend).toEqual({ torso: 0.6, neck: 0.4 });
  });
});

describe('the neck form on the anime casts', () => {
  it('the column in its band of the face width (W, the cheek outline): the male 0.75–0.95, the female 0.40–0.50, both registers', () => {
    for (const register of ['round', 'lowpoly']) for (const [cast, [lo, hi]] of [['male', [0.75, 0.95]], ['female', [0.40, 0.50]]]) {
      const m = door({ cast, head: 'anime', register, gesture: 'rest' }); const r = neckReadout(m.plan, compileLayered(m.recipe, m.dials));
      expect(r.form, `${cast} ${register}`).toBe('loft'); expect(r.ofW, `${cast} ${register}`).toBeGreaterThanOrEqual(lo); expect(r.ofW, `${cast} ${register}`).toBeLessThanOrEqual(hi);
    }
  }, 60000);
  // at each preset stand: the loft's top (the nape ring) keeps its front half and the top cap's point inside the head
  // (the face shell and the cranium core), the nape — where the neck's back line first enters the skull — at or above
  // the back hair hem less 5 mm, and the mint's gates (compile, closure, every clip solvable) pass
  it('at every preset stand, both registers: the top buried in the head, the nape at the hair hem or above, the gates pass', () => {
    for (const cast of ['female', 'male']) for (const register of ['round', 'lowpoly']) for (const gesture of ['rest', ...Object.keys(GESTURE_PRESETS)]) {
      const at = `${cast} ${register} ${gesture}`;
      const m = door({ cast, head: 'anime', register, gesture });
      expect(() => planLayered(m), at).not.toThrow();
      const mesh = compileLayered(m.recipe, m.dials); const R = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, R);
      expect(auditLayered(mesh).neck.pass, at).toBe(true);
      const pose = standPose(m.recipe, R); const V = pose ? poseLayered(mesh, m.recipe, pose, { R, skin }).mesh.vertices : mesh.vertices;
      const tris = (re) => mesh.faces.filter((t) => re.test(mesh.provenance[t[0]].part)).map((t) => t.map((vi) => V[vi]));
      const skull = [tris(/^face$/), tris(/^cranium$/)], head = skull[0]; const isIn = (q) => skull.some((T) => inside(T, q));   // each closed part on its own
      const N = m.recipe.parts.neck, ids = N.stations.map((s) => s.id), last = ids.at(-1);
      const ringOf = (id) => mesh.provenance.map((p, i) => (p.part === 'neck' && p.station === id ? i : -1)).filter((i) => i >= 0);
      const front = ringOf(last).filter((vi) => /^(front|side)/.test(mesh.provenance[vi].slot));
      expect(front.length, at).toBe(SLOT_FAMILIES.ring12.filter((s) => /^(front|side)/.test(s)).length);
      expect(front.filter((vi) => !isIn(V[vi])), `${at}: the top ring's front half`).toEqual([]);
      const apex = mesh.provenance.map((p, i) => (p.part === 'neck' && !p.station ? i : -1)).filter((i) => i >= 0).sort((a, b) => V[b][2] - V[a][2])[0];
      expect(isIn(V[apex]), `${at}: the top cap's point`).toBe(true);
      // the nape: walk the back line (slot 'back', ring to ring, then up the top cap to its point) to the first point
      // inside the skull (the male's nape ring stands out behind it by design: the visible nape)
      const back = [...ids.map((id) => ringOf(id).find((vi) => mesh.provenance[vi].slot === 'back')), apex];
      let nape = null;
      for (let i = 0; i + 1 < back.length && !nape; i++) for (let k = 0; k <= 40; k++) { const a = V[back[i]], b = V[back[i + 1]], q = a.map((x, j) => x + (b[j] - x) * (k / 40)); if (isIn(q)) { nape = q; break; } }
      expect(nape, `${at}: the nape enters the skull`).not.toBeNull();
      const cy = head.flat().reduce((s, p) => s + p[1], 0) / (3 * head.length);
      const hem = Math.min(...V.filter((p, i) => /^hair/.test(mesh.provenance[i].part) && Math.abs(p[0]) < 0.015 && p[1] < cy).map((p) => p[2]));
      expect(nape[2], `${at}: the nape against the hair hem`).toBeGreaterThanOrEqual(hem - 0.005);
    }
  }, 240000);
});
