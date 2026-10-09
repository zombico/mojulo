// hero-aura — the showcase poses on real hero bodies: each held pose balanced, its hands on their places and turned
// their way, nothing of a hand or forearm inside the body (a resting hand against what it rests on), the gaze where it
// is asked, and the performance clear of the body from the stand to the hit; a left pose is its right twin mirrored.
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
const lawsHold = (c) => expect(c.laws, JSON.stringify(c)).toEqual(Object.fromEntries(Object.keys(c.laws).map((k) => [k, true])));

describe('hero-aura', () => {
  // one pose from each family and each kind of hand (a hand on the body, aimed, at the face, a folded pair, a crane)
  for (const name of ['crossedArms', 'heroHips', 'jotaroPoint', 'dioBack', 'peaceWink', 'sentaiRoll', 'ginyu'])
    for (const [cast, { R, body }] of Object.entries(HEROES)) it(`${cast} ${name}: every law holds`, () => lawsHold(heroAura(name, R, { body }).checks), 90000);

  it('a hand on the hip rests on the hip: on its surface, not in it, not off it', () => {
    const { R, body } = HEROES.female, x = heroAura('heroHips', R, { body }), c = x.checks;
    for (const S of ['L', 'R']) { expect(c.hands[S]).toBeLessThan(0.01); expect(c.rest[S]).toBeGreaterThan(-0.02); expect(c.rest[S]).toBeLessThan(0.03); }
  }, 90000);

  it('the point aims at the viewer; the T-pose holds its arms level and its palms down', () => {
    const { R, body } = HEROES.male; const n = rigNodesAt(R, heroAura('jotaroPoint', R, { body }).hold).nodes;
    const arm = [0, 1, 2].map((k) => n.indexTipR[k] - n.shoulderR[k]); expect(arm[1] / Math.hypot(...arm)).toBeGreaterThan(0.9);
    const t = heroAura('tPose', R, { body }), m = rigNodesAt(R, t.hold).nodes;
    for (const S of ['L', 'R']) { expect(Math.abs(m[`wrist${S}`][2] - m[`shoulder${S}`][2])).toBeLessThan(0.06); expect(t.checks.aim[S].palm).toBeLessThan(5); }
  }, 90000);

  it('Dio turns his back: the body faces away, the face comes round over the shoulder', () => {
    const { R, body } = HEROES.male, x = heroAura('dioBack', R, { body }); const n = rigNodesAt(R, x.hold).nodes;
    // the shoulder line's normal (the chest's front) points away from the viewer
    const lat = [n.shoulderR[0] - n.shoulderL[0], n.shoulderR[1] - n.shoulderL[1]]; expect(lat[0]).toBeLessThan(-0.2);   // front = (−lat.y, lat.x): its y < 0
    expect(x.checks.gaze).toBeLessThan(75);
  }, 90000);

  it('the crane stands on one foot, the other leg drawn up', () => {
    const { R, body } = HEROES.female, x = heroAura('ginyu', R, { body }), n = rigNodesAt(R, x.hold).nodes;
    expect(n.toeBaseR[2] - R.joints.toeBaseR[2]).toBeGreaterThan(0.15); expect(x.checks.balance).toBeGreaterThan(0.004);
  }, 90000);

  it('a performance starts on the stand, steps where the feet move, and ends held on the hit', () => {
    const { R, body } = HEROES.female, x = heroAura('jotaroPoint', R, { body });
    expect(x.keys[0].t).toBe(0); expect(x.keys[x.keys.length - 1].t).toBe(1);
    expect(x.keys.some((k) => k.groundR === 0 || k.groundL === 0)).toBe(true);   // a foot lifts to step
    expect(JSON.stringify(x.clip.fn(1))).toBe(JSON.stringify(x.clip.fn(x.beats[x.beats.length - 1].t / x.seconds)));
    expect(x.faces[0].face).toEqual({ blink: 0, smile: 0, open: 0, brow: 0 }); expect(x.face.brow).toBeLessThan(0);
  }, 90000);

  it('a left pose is its right twin mirrored joint for joint', () => {
    const { R, body } = HEROES.male;
    for (const name of ['killerQueen', 'giorno']) {
      const a = heroAura(name, R, { body }), b = heroAura(`${name}Left`, R, { body });
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
