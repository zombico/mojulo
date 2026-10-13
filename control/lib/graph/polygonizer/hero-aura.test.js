// hero-aura — the showcase poses on real hero bodies: each held pose balanced, its hands on their places and turned
// their way, nothing of a hand or forearm inside the body (a resting hand against what it rests on), the gaze where it
// is asked, and the performance clear of the body from the stand to the hit; a left pose is its right twin mirrored.
// The laws run on one pose per distinct procedure (each family, a planted and a lifted footing, an aimed and a placed
// hand), chosen from the catalog, the cast and the side alternating.
import { describe, expect, it } from 'vitest';
import { validateRig, bindLayered, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest, planLayered } from '../../mcp/tools/layered.js';
import { heroAura, auraBody, AURAS, AURA_NAMES, SHAPES, FOOTINGS } from './hero-aura.js';

const heroOf = (cast) => {
  const hero = heroRecord({ cast, head: 'anime' }), ex = expandLayeredManifest({ kind: 'layered', title: 't', hero });
  const { mesh } = planLayered({ kind: 'layered', title: 't', recipe: ex.recipe, hero, dials: ex.dials, units: 'm' });
  const R = validateRig(ex.recipe.rig); return { R, body: auraBody(R, mesh, bindLayered(mesh, ex.recipe, R)) };
};
const HEROES = { female: heroOf('female'), male: heroOf('male') };
// the first pose of the catalog that brings a family, a footing kind (planted, or a leg lifted) or a hand kind (aimed, or
// placed at a landmark) not yet covered
const featuresOf = (P) => [`family ${P.family}`, ...P.beats.filter((b) => b.feet).map((b) => `feet ${FOOTINGS[b.feet]?.R.lift || FOOTINGS[b.feet]?.L.lift ? 'lifted' : 'planted'}`),
  ...P.beats.flatMap((b) => Object.values(b.hands || {}).map((h) => `hand ${h.aim ? 'aim' : 'at'}`))];
const PICKS = (() => { const seen = new Set(); return Object.keys(AURAS).filter((n) => { const f = featuresOf(AURAS[n]).filter((x) => !seen.has(x)); f.forEach((x) => seen.add(x)); return f.length > 0; }); })()
  .map((n, i) => [(i >> 1) % 2 ? `${n}Left` : n, i % 2 ? 'male' : 'female']);
const shown = new Map(), aura = (name, cast) => { const k = `${cast} ${name}`; if (!shown.has(k)) shown.set(k, heroAura(name, HEROES[cast].R, { body: HEROES[cast].body })); return shown.get(k); };
const lawsHold = (c) => expect(c.laws, JSON.stringify(c)).toEqual(Object.fromEntries(Object.keys(c.laws).map((k) => [k, true])));

describe('hero-aura', () => {
  for (const [name, cast] of PICKS) it(`${cast} ${name}: every law holds`, () => lawsHold(aura(name, cast).checks), 90000);

  it('a hand on the hip rests on the hip: on its surface, not in it, not off it', () => {
    const x = aura('heroHips', 'female'), c = x.checks; lawsHold(c);
    for (const S of ['L', 'R']) { expect(c.hands[S]).toBeLessThan(0.01); expect(c.rest[S]).toBeGreaterThan(-0.02); expect(c.rest[S]).toBeLessThan(0.03); }
  }, 90000);

  it('the point aims at the viewer; the T-pose holds its arms level and its palms down', () => {
    const { R } = HEROES.male, p = aura('jotaroPoint', 'male'); lawsHold(p.checks); const n = rigNodesAt(R, p.hold).nodes;
    const arm = [0, 1, 2].map((k) => n.indexTipR[k] - n.shoulderR[k]); expect(arm[1] / Math.hypot(...arm)).toBeGreaterThan(0.9);
    const t = aura('tPose', 'male'), m = rigNodesAt(R, t.hold).nodes;
    for (const S of ['L', 'R']) { expect(Math.abs(m[`wrist${S}`][2] - m[`shoulder${S}`][2])).toBeLessThan(0.06); expect(t.checks.aim[S].palm).toBeLessThan(5); }
  }, 90000);

  it('Dio turns his back: the body faces away, the face comes round over the shoulder', () => {
    const { R } = HEROES.male, x = aura('dioBack', 'male'); lawsHold(x.checks); const n = rigNodesAt(R, x.hold).nodes;
    // the shoulder line's normal (the chest's front) points away from the viewer
    const lat = [n.shoulderR[0] - n.shoulderL[0], n.shoulderR[1] - n.shoulderL[1]]; expect(lat[0]).toBeLessThan(-0.2);   // front = (−lat.y, lat.x): its y < 0
    expect(x.checks.gaze).toBeLessThan(75);
  }, 90000);

  it('the crane stands on one foot, the other leg drawn up', () => {
    const { R } = HEROES.female, x = aura('ginyu', 'female'), n = rigNodesAt(R, x.hold).nodes;
    expect(n.toeBaseR[2] - R.joints.toeBaseR[2]).toBeGreaterThan(0.15); expect(x.checks.balance).toBeGreaterThan(0.004);
  }, 90000);

  it('a performance starts on the stand, steps where the feet move, and ends held on the hit', () => {
    const x = aura('jotaroPoint', 'female');
    expect(x.keys[0].t).toBe(0); expect(x.keys[x.keys.length - 1].t).toBe(1);
    expect(x.keys.some((k) => k.groundR === 0 || k.groundL === 0)).toBe(true);   // a foot lifts to step
    expect(JSON.stringify(x.clip.fn(1))).toBe(JSON.stringify(x.clip.fn(x.beats[x.beats.length - 1].t / x.seconds)));
    expect(x.faces[0].face).toEqual({ blink: 0, smile: 0, open: 0, brow: 0 }); expect(x.face.brow).toBeLessThan(0);
  }, 90000);

  it('a left pose is its right twin mirrored joint for joint', () => {
    const { R } = HEROES.male;
    for (const name of ['killerQueen', 'giorno']) {
      const a = aura(name, 'male'), b = aura(`${name}Left`, 'male');
      for (const t of [0.4, 1]) { const na = rigNodesAt(R, a.clip.fn(t)).nodes, nb = rigNodesAt(R, b.clip.fn(t)).nodes;
        for (const k of Object.keys(na)) { const tw = k.replace(/([LR])$/, (x) => (x === 'L' ? 'R' : 'L')); if (!nb[tw]) continue; expect(Math.hypot(na[k][0] + nb[tw][0], na[k][1] - nb[tw][1], na[k][2] - nb[tw][2])).toBeLessThan(1e-6); } }
    }
  }, 90000);

  it('is deterministic', () => {
    const { R, body } = HEROES.female; expect(JSON.stringify(heroAura('hairToss', R, { body }).keys)).toBe(JSON.stringify(heroAura('hairToss', R, { body }).keys));
  }, 90000);

  it('names its poses, shapes and footings; refuses unknown words by name', () => {
    expect(AURA_NAMES).toEqual(Object.keys(AURAS).flatMap((n) => [n, `${n}Left`]));
    for (const P of Object.values(AURAS)) { expect(['aura', 'jojo', 'squad', 'meme']).toContain(P.family); expect(P.after).toBeTruthy(); }
    expect(SHAPES.vee.index).toBeLessThan(0); expect(Object.keys(FOOTINGS)).toContain('crane');
    const { R } = HEROES.male;
    expect(() => heroAura('moonwalk', R)).toThrow(/no pose/);
    expect(() => heroAura({ beats: [{ at: 0.5, feet: 'splits' }] }, R)).toThrow(/no footing/);
    expect(() => heroAura({ beats: [{ at: 0.5, hands: { R: { at: 'elbowPit' } } }] }, R)).toThrow(/no landmark/);
    expect(() => heroAura({ beats: [{ at: 0.5, hands: { R: { aim: 'up', shape: 'shaka' } } }] }, R)).toThrow(/no hand shape/);
  });
});
