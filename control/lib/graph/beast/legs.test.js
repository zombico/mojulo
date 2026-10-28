// The beast-kin's legs on the tiered body (lib/graph/beast/legs.js): a digitigrade kin's knee forward, its hock raised
// behind it and bridged on a fold to the heel's side, a metatarsus to the toes' base, a pad and the card's toes; a
// plantigrade kin's foot keeping the card's toes; a digitigrade kin's gaits drawing in the knee's swing, without which a
// person's jog folds the knee's bridge shut. Kins are chosen in code by the procedure they run.
import { describe, it, expect } from 'vitest';
import { BEAST_KINS } from './cards.js';
import { beastWords, DIGITIGRADE_GAIT } from './tiered.js';
import { DIGITIGRADE, KEPT_TOES } from './legs.js';
import { heroRecord, heroPlanOf, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig, bindLayered, auditRig } from '../polygonizer/station-loft-rig.js';
import { stretchAudit } from '../polygonizer/hero-stretch.js';
import { locomotionClips } from '../polygonizer/hero-motion.js';

const kinBy = (pred) => Object.entries(BEAST_KINS).find(([, c]) => pred(c))[0];
const FOUR = kinBy((c) => c.toes === 4 && c.claws !== 'none'), THREE = kinBy((c) => c.toes === 3 && c.claws !== 'none');
const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const digi = (kin, extra = {}) => mint({ cast: 'male', beast: { kin, legs: 'digitigrade' }, ...extra });
const seg = (p, n) => p.segments.find((s) => s.name === n);
const built = (hero) => { const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero }), R = validateRig(recipe.rig), mesh = compileLayered(recipe, dials); return { recipe, R, mesh, skin: bindLayered(mesh, recipe, R) }; };
const ownFrames = (recipe, R) => { const C = locomotionClips(recipe.locomotion, R).clips;
  return [{ label: 'stand', pose: {} }, ...['walk', 'jog', 'sprint'].filter((g) => C[g]).flatMap((g) => [0, 1, 2, 3, 4, 5].map((i) => ({ label: `${g} ${i}/6`, pose: C[g](i / 6) })))]; };

describe('the beast-kin\'s legs on the tiered body', () => {
  it('a digitigrade kin stands its knee forward, its hock raised behind it, its toes\' base on the floor ahead', () => {
    const p = heroPlanOf(digi(FOUR)), J = p.joints, H = J.hip[2];
    expect(J.knee[1]).toBeGreaterThan(J.hip[1]);
    expect(J.ankle[1]).toBeLessThan(J.knee[1]);
    expect(J.ankle[2]).toBeCloseTo(DIGITIGRADE.hock[1] * H, 6);
    expect(J.toeBase[1]).toBeGreaterThan(J.ankle[1]);
    expect(J.toeBase[2]).toBeLessThan(0.1 * H);
    for (const j of ['knee', 'ankle', 'toeBase', 'toeTip']) expect(p.rig.joints[`${j}$S`].at).toEqual(J[j]);
    // the thigh turned onto its new line: its last ring short of the knee by the bridge's reach, on the line
    const T = seg(p, 'thighR').stations.at(-1).at, d = Math.hypot(...T.map((x, i) => x - J.knee[i]));
    expect(d).toBeGreaterThan(0.01); expect(d).toBeLessThan(0.08);
    expect(p.rig.folds['hipFold$S'].inAxis.map((x) => Math.round(x * 1e4))).toEqual(J.knee.map((x, i) => Math.round((x - J.hip[i]) * 1e4)));
  });

  it('its hock is bridged as the knee is, on a fold to the heel\'s side; the metatarsus to the toes, a pad, the card\'s toes', () => {
    const p = heroPlanOf(digi(FOUR)), kept = KEPT_TOES.digitigrade[BEAST_KINS[FOUR].toes];
    const bridge = seg(p, 'hockBridgeR');
    expect(bridge.bind.bone).toBe('hockFoldR');
    expect(p.rig.folds['hockFold$S']).toMatchObject({ joint: 'ankle$S', to: 'toeBase$S', front: [0, -1, 0] });
    expect(p.rig.folds['kneeFold$S'].front).toEqual([0, 1, 0]);   // (the two bend opposite ways)
    expect(p.rig.bones.some((b) => b.perSide?.some((x) => x.id === 'hockFold$S'))).toBe(true);
    expect(seg(p, 'footR')).toMatchObject({ kind: 'segment', from: 'ankle', to: 'toeBase' });
    expect(seg(p, 'pawR').bind.bone).toBe('toesR');
    for (const t of ['hallux', 'toe2', 'toe3', 'toe4', 'toe5']) expect(!!seg(p, `${t}R`), t).toBe(kept.includes(t));
    for (const t of kept) expect(seg(p, `${t}ClawR`).bind).toBe('toesR');
    const stance = p.dials.stance.parts;
    for (const n of ['paw$S', 'hockBridge$S', ...kept.map((t) => `${t}$S`)]) expect(stance).toContain(n);
    expect(stance).not.toContain('hallux$S');
  });

  it('a plantigrade kin keeps a person\'s foot with the card\'s toes, the big toe among them', () => {
    const p = heroPlanOf(mint({ cast: 'male', beast: { kin: THREE } })), kept = KEPT_TOES.plantigrade[3];
    for (const t of ['hallux', 'toe2', 'toe3', 'toe4', 'toe5']) expect(!!seg(p, `${t}R`), t).toBe(kept.includes(t));
    expect(seg(p, 'hockBridgeR')).toBeUndefined();
    expect(p.dials.stance.parts).not.toContain('toe5$S');
  });

  it('a digitigrade kin walks and runs with its knee drawn in, the operator\'s own dials over it', () => {
    const H = digi(FOUR, { motion: { jog: true } });
    expect(H.motion.walk).toMatchObject(DIGITIGRADE_GAIT.walk);
    expect(H.motion.jog).toMatchObject(DIGITIGRADE_GAIT.sprint);
    expect(digi(FOUR, { motion: { walk: { swingLift: 40 } } }).motion.walk.swingLift).toBe(40);
    expect(mint({ cast: 'male', beast: { kin: FOUR } }).motion.walk.swingLift).toBeUndefined();   // (a plantigrade kin walks a person's walk)
  });

  it('it rigs as a hero does, its planted toes where they stand; through its own walk, jog and sprint its joints hold', () => {
    const { recipe, R, mesh, skin } = built(digi(THREE, { motion: { jog: true, sprint: true } }));
    const A = auditRig(mesh, skin, R);
    expect(A.badWeights).toBe(0); expect(A.restIdentity).toBeLessThan(1e-9); expect(A.maxPlantedDrift).toBeLessThan(1e-6);
    const W = stretchAudit(mesh, skin, R, recipe, ownFrames(recipe, R)).worst;
    expect(W.pinch.value).toBeGreaterThan(0.7);
    expect(W.folds.value).toBeLessThanOrEqual(2);   // (a person's own: the shoulder cone's in a jog)
    expect(Math.abs(W.twist.value)).toBeLessThan(30);
  }, 120_000);

  it('a person\'s jog on the digitigrade knee folds its bridge: the kin\'s own gait is what holds it', () => {
    const { recipe, R, mesh, skin } = built(digi(THREE, { motion: { jog: { stanceKnee: 12, swingTuck: 115 } } }));
    const W = stretchAudit(mesh, skin, R, recipe, ownFrames(recipe, R)).worst;
    expect(W.pinch.value).toBeLessThan(0.4);
  }, 120_000);
});
