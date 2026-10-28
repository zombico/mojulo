// The beast head on the tiered neck (lib/graph/beast/head.js): a kin wears its library head by default, seated by its
// nape on a neck leaned forward into the back of its skull as the head was drawn for, its jaw a bone the rig's chain
// opens, and a nape fillet from the neck's middle into the skull. Kins are chosen in code by the procedure they run.
import { describe, it, expect } from 'vitest';
import { BEAST_KINS } from './cards.js';
import { beastWords } from './tiered.js';
import { beastHeadOf, NECK_LEAN } from './head.js';
import { headFor, HEAD_LIBRARY } from '../creature-heads/index.js';
import { heroRecord, heroPlanOf, validateHeroSpec, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { partRings } from '../polygonizer/tiered-form.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { insidePart } from '../polygonizer/station-loft-head.js';
import { validateRig, bindLayered, auditRig, rigNodesAt } from '../polygonizer/station-loft-rig.js';

const KIN = Object.keys(BEAST_KINS).find((k) => headFor(k)), OTHER = Object.keys(HEAD_LIBRARY).find((id) => id !== headFor(KIN).id);
const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const kin = (extra = {}, spec = {}) => mint({ cast: 'male', beast: { kin: KIN, ...extra }, ...spec });
const seg = (p, n) => p.segments.find((s) => s.name === n);

describe('the beast head on the tiered neck', () => {
  it('a kin wears its library head by its nape on the head base, its skull the head bone\'s and its jaw its own', () => {
    const H = kin(), p = heroPlanOf(H);
    expect(H.head).toBe('none');
    expect(H.hair).toBeUndefined();
    expect(beastHeadOf(H)).toEqual({ id: headFor(KIN).id });
    expect(p.heads).toHaveLength(1);
    expect(p.heads[0]).toMatchObject({ name: 'head', on: 'headBase', bind: { cranium: 'head', jaw: 'jaw' } });
    expect(seg(p, 'head')).toBeUndefined();                                     // (the blank trunk's head is off)
    expect(p.rig.joints.headTop.at).toBe('head.cranium.tip');
    expect(p.rig.bones.some((b) => b.id === 'jaw')).toBe(true);
    expect(p.rig.chains.jaw.links[0].pivot).toBe('jawHinge');
  });

  it('the neck leans forward into the back of the skull, its length kept', () => {
    // (against a person of the kin's frame: its neck's length is the frame's tune, cards.js)
    const person = heroPlanOf(mint({ cast: 'male', detail: 'none', head: 'none', tune: BEAST_KINS[KIN].frame ?? {} })), p = heroPlanOf(kin());
    const lean = (J) => Math.atan2(J.headBase[1] - J.neckHub[1], J.headBase[2] - J.neckHub[2]) * 180 / Math.PI;
    expect(lean(p.joints)).toBeCloseTo(NECK_LEAN, 3);
    const len = (J) => Math.hypot(...J.headBase.map((x, i) => x - J.neckHub[i]));
    expect(len(p.joints)).toBeCloseTo(len(person.joints), 5);
  });

  it('a nape fillet from the neck\'s middle ring, point for point, into the skull, handing the neck to the head', () => {
    const H = kin(), p = heroPlanOf(H), nape = seg(p, 'nape'), mid = partRings(p, seg(p, 'neck')).stations.find((st) => st.id === 'st1').points;
    for (const sl of Object.keys(mid)) expect(nape.stations[0].points[sl].map((x) => Math.round(x * 1e5))).toEqual(mid[sl].map((x) => Math.round(x * 1e5)));
    const share = nape.stations.map((st) => nape.bind.blend[st.id].neck ?? 0);
    expect(share[0]).toBe(1); expect(share.at(-1)).toBe(0);
    for (let i = 1; i < share.length; i++) expect(share[i]).toBeLessThan(share[i - 1]);
    // its top ring buried in the skull
    const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero: H }), mesh = compileLayered(recipe, dials);
    const crown = nape.stations.at(-1).points;
    expect(Object.values(crown).every((q) => insidePart(mesh.parts.cranium, q))).toBe(true);
  }, 60_000);

  it('it binds and rigs as a hero does, and the rig\'s jaw chain opens the jaw', () => {
    const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero: kin() }), R = validateRig(recipe.rig), mesh = compileLayered(recipe, dials), skin = bindLayered(mesh, recipe, R);
    const A = auditRig(mesh, skin, R);
    expect(A.badWeights).toBe(0); expect(A.restIdentity).toBeLessThan(1e-9);
    const shut = rigNodesAt(R, {}).nodes.jawTip, open = rigNodesAt(R, { jaw: 20 }).nodes.jawTip;
    expect(open[2]).toBeLessThan(shut[2] - 0.005);
  }, 60_000);

  it('the operator\'s word: another library head, or a person\'s; the door refuses a beast\'s head under a person\'s', () => {
    expect(beastHeadOf(kin({ head: OTHER }))).toEqual({ id: OTHER });
    const P = kin({ head: 'person' });
    expect(P.head).toBe('landmark'); expect(heroPlanOf(P).heads).toBeUndefined();
    expect(beastHeadOf(kin({}, { head: 'landmark' }))).toBe(null);
    const errs = (beast, extra = {}) => validateHeroSpec(beastWords({ form: 'tiered', cast: 'male', beast: { kin: KIN, ...beast }, ...extra })).join('\n');
    expect(errs({ head: 'gryphon' })).toMatch(/beast\.head/);
    expect(errs({ head: OTHER }, { head: 'landmark' })).toMatch(/is a beast's head/);
  });
});
