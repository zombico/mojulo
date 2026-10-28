// What the frame adds to a beast-kin on the tiered body (lib/graph/beast/topology.js, socket.js): a tail on the pelvis,
// flight feathers on the arms, a second pair of arms on the torso, the tail and the second shoulders welded to their
// trunk by the generic socket. Kins are chosen in code by the procedure they run.
import { describe, it, expect } from 'vitest';
import { BEAST_KINS } from './cards.js';
import { beastWords } from './tiered.js';
import { SOCKET } from './socket.js';
import { heroRecord, heroPlanOf, validateHeroSpec, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { partRings, torsoSection } from '../polygonizer/tiered-form.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig, bindLayered, auditRig } from '../polygonizer/station-loft-rig.js';
import { stretchAudit, gaitFrames } from '../polygonizer/hero-stretch.js';

const kinBy = (pred) => Object.entries(BEAST_KINS).find(([, c]) => pred(c))[0];
const TAILED = kinBy((c) => c.tail && c.tail !== 'none'), TAILLESS = kinBy((c) => c.tail === 'none');
const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const kin = (id, extra = {}) => mint({ cast: 'male', beast: { kin: id, ...extra } });
const seg = (p, n) => p.segments.find((s) => s.name === n);
const centre = (pts) => { const v = Object.values(pts); return [0, 1, 2].map((k) => v.reduce((t, p) => t + p[k], 0) / v.length); };
const ALL = { tail: 'thin', wings: 'arms', arms: 4 };

describe('what the frame adds to a beast-kin', () => {
  it('a tail from the back of the pelvis at the hip, its bones riding the pelvis; its socket ends on its first ring', () => {
    const p = heroPlanOf(kin(TAILED)), tail = seg(p, 'tail'), J = p.joints;
    expect(tail.kind).toBe('loft');
    expect(tail.stations[0].at[1]).toBeLessThan(J.hip[1]);                       // behind the hips
    expect(Math.abs(tail.stations[0].at[2] - J.hip[2])).toBeLessThan(0.05);      // at their height
    for (let i = 0; i < tail.stations.length; i++) expect(p.rig.joints[`tail${i}`].rides).toBe('pelvis');
    expect(p.rig.bones.filter((b) => /^tail\d$/.test(b.id)).length).toBe(tail.stations.length - 1);
    // the socket: its last ring the tail's first, point for point (one surface), its first held inside the pelvis
    const sock = seg(p, 'tailSocket'), first = partRings(p, tail).stations[0].points, last = sock.stations.at(-1).points;
    for (const sl of Object.keys(first)) expect(Math.hypot(...last[sl].map((x, i) => x - first[sl][i]))).toBeLessThan(2e-5);
    const hold = torsoSection(p, p.segments, 'pelvis').hold;
    for (const q of Object.values(sock.stations[0].points)) { const h = hold(q, SOCKET.inside + 1e-6); expect(Math.hypot(...q.map((x, i) => x - h[i]))).toBeLessThan(1e-4); }
    // its skin hands the pelvis to the tail over its length, never at once
    const share = sock.stations.map((st) => sock.bind.blend[st.id].pelvis ?? 0);
    expect(share[0]).toBe(1); expect(share.at(-1)).toBe(0);
    for (let i = 1; i < share.length; i++) expect(share[i]).toBeLessThan(share[i - 1]);
    // the operator's word over the card's
    expect(seg(heroPlanOf(kin(TAILED, { tail: 'none' })), 'tail')).toBeUndefined();
    expect(seg(heroPlanOf(kin(TAILLESS)), 'tail')).toBeUndefined();
    expect(seg(heroPlanOf(kin(TAILLESS, { tail: 'stub' })), 'tail')).toBeTruthy();
  });

  it('wings on the arms: five flight feathers a side, trailing from the forearm and the hand, riding them', () => {
    const p = heroPlanOf(kin(TAILLESS, { wings: 'arms' })), vanes = p.segments.filter((s) => /^wing(Prim|Sec)\dR$/.test(s.name));
    expect(vanes.length).toBe(5);
    for (const v of vanes) { expect(['foreArmR', 'handR']).toContain(v.bind.bone); expect(p.joints[v.to][2]).toBeLessThan(p.joints[v.from][2]); }
    expect(p.palette.Flight).toBeTruthy();
    expect(p.dials.lean.parts).toContain('wingPrim1$S');
  });

  it('a second pair of arms under the first, folded forward, bridged at the elbow and the wrist, welded to the torso', () => {
    const p = heroPlanOf(kin(TAILLESS, { arms: 4 })), J = p.joints;
    for (const n of ['upperArm2R', 'foreArm2R', 'hand2R', 'elbow2BridgeR', 'wrist2BridgeR', 'arm2SocketR']) expect(seg(p, n), n).toBeTruthy();
    expect(J.shoulder2[2]).toBeLessThan(J.shoulder[2]);
    expect(J.knuckles2[1]).toBeGreaterThan(J.shoulder2[1]);                      // folded forward
    for (const n of ['shoulder2', 'elbow2', 'wrist2', 'knuckles2']) expect(p.rig.joints[`${n}$S`].rides).toBe('torso');
    const sock = seg(p, 'arm2SocketR'), ring = partRings(p, seg(p, 'upperArm2R')).stations.find((st) => st.id === 'st1').points;
    expect(centre(sock.stations.at(-1).points).map((x) => Math.round(x * 1e5))).toEqual(centre(ring).map((x) => Math.round(x * 1e5)));
    for (const n of ['upperArm2$S', 'elbow2Bridge$S', 'arm2Socket$S']) expect(p.dials.bulk.parts).toContain(n);
  });

  it('with all three it binds and rigs as a hero does, and bends as the same body without them', () => {
    const built = (hero) => { const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero }), R = validateRig(recipe.rig), mesh = compileLayered(recipe, dials); return { recipe, R, mesh, skin: bindLayered(mesh, recipe, R) }; };
    const all = built(kin(TAILLESS, ALL)), bare = built(kin(TAILLESS));
    const A = auditRig(all.mesh, all.skin, all.R);
    expect(A.badWeights).toBe(0); expect(A.restIdentity).toBeLessThan(1e-9);
    const worst = (b) => stretchAudit(b.mesh, b.skin, b.R, b.recipe, [{ label: 'stand', pose: {} }, ...gaitFrames(b.R, { gaits: ['walk'], samples: 6 })]).worst;
    const W = worst(all), V = worst(bare);
    expect(W.pinch.value).toBeGreaterThan(V.pinch.value - 0.02);
    expect(W.folds.value).toBeLessThanOrEqual(V.folds.value);
  }, 120_000);

  it('the door refuses a word the frame does not add', () => {
    const errs = (beast) => validateHeroSpec(beastWords({ form: 'tiered', cast: 'male', beast })).join('\n');
    expect(errs({ kin: TAILED, tail: 'whip' })).toMatch(/beast\.tail/);
    expect(errs({ kin: TAILED, wings: 'back' })).toMatch(/beast\.wings/);
    expect(errs({ kin: TAILED, arms: 6 })).toMatch(/beast\.arms/);
    expect(errs({ kin: TAILED, ...ALL })).toBe('');
  });
});
