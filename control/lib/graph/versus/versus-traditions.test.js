// The ways a body has been taught to strike: a tradition is a fighter's guard (where its moves start and come home,
// what its idle boxes are), its rhythm, its stance and its moves in every slot; a strike carries weight (it
// accelerates into contact and is carried on past it); a spinning move completes its turn at contact; and a fighter
// without a tradition is the genre's own, nothing added. The cases are picked in code, one per procedure; the
// sweep over every family is versus-traditions.deep.test.js.
import { describe, it, expect } from 'vitest';
import { TRADITIONS, FAMILIES, traditionRests } from './versus-traditions.js';
import { POSES } from './versus-library.js';
import { compileFighter, strikeBody } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';
import { fighterSpec } from './versus-sheet.js';
import { rigJoints, lerpPose } from './versus-rig.js';
import { reactionPose } from './versus-react.js';
import { figureBase, figurePose } from './versus-figure.js';

const fighter = (intent) => compileFighter(solveFighter({ id: 'x', ...intent }).recipe);
const WORDS = Object.keys(TRADITIONS);
// a tradition that throws no kicks, and one whose guard is lower than the genre's
const PUNCHER = WORDS.find((t) => Object.values(TRADITIONS[t].normals).every((f) => !/^(toe|ankle|knee)/.test(FAMILIES[f].limb)));
const LOW = WORDS.find((t) => (TRADITIONS[t].guard.hip ?? [0, 0])[1] < -40);
const pelvisY = (pose, F) => rigJoints(F.body, pose).pelvis[1];

describe('versus: a tradition is how a fighter stands and strikes', () => {
  it('fills every slot from its own moves, says so, and stands its own way', () => {
    const t = WORDS[0], { recipe, notes } = solveFighter({ id: 'x', tradition: t });
    expect(Object.fromEntries(Object.entries(recipe.normals).map(([k, v]) => [k, v.family]))).toMatchObject(
      Object.fromEntries(Object.entries(TRADITIONS[t].normals).filter(([k]) => k !== 'stand.H')));
    expect(notes).toContain(TRADITIONS[t].says);
    expect(recipe.tradition).toBe(t);
    const square = WORDS.find((w) => TRADITIONS[w].stance.open < 0);
    expect(solveFighter({ id: 'x', tradition: square }).recipe.stance.open).toBeLessThan(solveFighter({ id: 'x' }).recipe.stance.open);
    expect(() => solveFighter({ id: 'x', tradition: 'fencing' })).toThrow(/tradition 'fencing' is one of boxing/);
  });

  it('its guard is where every move starts and comes home, and what its idle boxes are', () => {
    const F = fighter({ tradition: LOW }), G = fighter({});
    const jab = F.moves['stand.L'];
    expect(jab.frames[jab.total].pose).toEqual(expect.objectContaining({ torso: TRADITIONS[LOW].guard.torso }));
    expect(F.poses.guard).toBe(TRADITIONS[LOW].guard);
    // a lower guard stands lower: its idle boxes come down with it
    expect(F.idle.stand.hurt[0][3]).toBeLessThan(G.idle.stand.hurt[0][3]);
    expect(pelvisY(F.poses.guard, F)).toBeLessThan(pelvisY(POSES.guard, F));
  });

  it('a fighter without a tradition is the genre\'s own: nothing added to what it compiles to', () => {
    const G = fighter({});
    for (const k of ['tradition', 'poses', 'rhythm']) expect(G).not.toHaveProperty(k);
    expect(traditionRests(undefined)).toBeNull();
  });

  it('a signature swaps among the tradition\'s own moves, and says when it throws none to swap', () => {
    const kicker = WORDS.find((t) => t !== PUNCHER && Object.values(TRADITIONS[t].normals).some((f) => /^fist/.test(FAMILIES[f].limb) && FAMILIES[f].stance === 'stand'));
    const { recipe } = solveFighter({ id: 'x', tradition: kicker, signature: ['kicks'] });
    const own = new Set([...Object.values(TRADITIONS[kicker].normals), ...TRADITIONS[kicker].families]);
    for (const { family } of Object.values(recipe.normals)) expect(own.has(family) || family === 'uppercut', family).toBe(true);
    expect(solveFighter({ id: 'x', tradition: PUNCHER, signature: ['kicks'] }).notes.join(' ')).toMatch(new RegExp(`${PUNCHER} throws no kicks`));
  });

  it('a roster entry says it as a word, or as tradition; one it does not know is refused by name', () => {
    expect(fighterSpec(WORDS[1], 0)).toMatchObject({ roll: { facets: {} }, over: { tradition: WORDS[1] } });
    expect(fighterSpec({ archetype: 'hero', tradition: WORDS[2] }).over).toEqual({ tradition: WORDS[2] });
    expect(() => fighterSpec({ tradition: 'fencing' })).toThrow(/tradition is how the fighter strikes: boxing/);
  });
});

describe('versus: a strike carries weight', () => {
  const withFollow = Object.entries(FAMILIES).find(([, f]) => f.stance === 'stand' && f.follow && !f.strike.spin)[0];
  it('accelerates into contact: from the load, each step of the strike turns the joints further than the last', () => {
    const F = compileFighter({ ...solveFighter({ id: 'x' }).recipe, normals: { ...solveFighter({ id: 'x' }).recipe.normals, 'stand.H': { family: withFollow } } });
    const m = F.moves['stand.H'], P = (f) => m.frames[f].pose;
    const angles = (p) => [p.torso, ...p.armF, ...p.armB, ...p.legF, ...p.legB];
    const step = (f) => angles(P(f)).reduce((sum, a, i) => sum + Math.abs(a - angles(P(f - 1))[i]), 0);
    const load = Math.max(1, Math.round((m.startup - 1) * 0.6));
    const steps = []; for (let f = load + 1; f <= m.startup; f++) steps.push(step(f));
    steps.slice(1).forEach((d, i) => expect(d).toBeGreaterThan(steps[i]));
  });

  it('is carried on past contact to its follow, then comes home by the end of recovery', () => {
    const fam = FAMILIES[withFollow];
    const F = compileFighter({ ...solveFighter({ id: 'x' }).recipe, normals: { ...solveFighter({ id: 'x' }).recipe.normals, 'stand.H': { family: withFollow } } });
    const m = F.moves['stand.H'], lastActive = m.startup + m.active - 1;
    const near = (a, b) => Math.abs((a.torso ?? 0) - (b.torso ?? 0)) + Math.abs(a.armB[0] - b.armB[0]) + Math.abs(a.legB[0] - b.legB[0]);
    const passes = m.frames.slice(lastActive + 1).some((fr) => near(fr.pose, fam.follow) < 1);
    expect(passes).toBe(true);
    expect(near(m.frames[m.total].pose, POSES.guard)).toBeLessThan(1);
  });

  it('a spinning move turns its back in the load and completes the turn at contact, so the hit lands square', () => {
    const [id, fam] = Object.entries(FAMILIES).find(([, f]) => (f.strike.spin ?? 0) >= 360);
    const t = Object.keys(TRADITIONS).find((w) => Object.values(TRADITIONS[w].normals).includes(id));
    const F = compileFighter({ ...solveFighter({ id: 'x', tradition: t }).recipe });
    const slot = Object.entries(TRADITIONS[t].normals).find(([, f]) => f === id)[0];
    const m = F.moves[slot];
    expect(m.id).toBe(id);
    for (let f = m.startup; f < m.startup + m.active; f++) expect(m.frames[f].pose.spin % 360).toBe(0);
    expect(Math.max(...m.frames.slice(1, m.startup).map((fr) => fr.pose.spin ?? 0))).toBeGreaterThanOrEqual(180);
    // and it comes home having turned whole: the last frame faces as it began
    expect(m.frames[m.total].pose.spin % 360).toBe(0);
  });

  it('a hook swings the hand across to the centre line in the round; the side view never sees it', () => {
    const [, hook] = Object.entries(FAMILIES).find(([, f]) => f.limb === 'fistF' && f.strike.hands && f.strike.hands[0] <= 0);
    const F = fighter({}), base = figureBase(F.body), J = rigJoints(F.body, hook.strike);
    const across = figurePose(base, J, { face: 1, hands: hook.strike.hands }), plain = figurePose(base, J, { face: 1 });
    // (bladed, the lead shoulder is already near the centre line: the hook ends on it)
    expect(across.wristL[0]).toBeCloseTo(0, 6);
    expect(Math.abs(plain.wristL[0])).toBeGreaterThan(0.02);
    expect(across.wristL[1]).toBeCloseTo(plain.wristL[1], 3);
    expect(lerpPose(hook.strike, POSES.guard, 0.5).hands[0]).toBeCloseTo((hook.strike.hands[0] + 0.75) / 2, 6);
  });
});

describe('versus: the runtime stands a tradition\'s body', () => {
  it('a hit comes home to the fighter\'s own guard', () => {
    const own = traditionRests(LOW);
    const p = { st: 'hit', sf: 20, stun: 0, low: 0, y: 0, ko: 0, rx: { k: 'hit', h: 1, w: 1 } };
    expect(reactionPose(p, {}, { guard: own.stand, crouch: own.crouch }).torso).toBe(own.stand.torso);
    expect(reactionPose(p, {}).torso).toBe(POSES.guard.torso);
  });
});

describe('versus: every strike moves as a body', () => {
  const kicks = Object.entries(FAMILIES).filter(([, f]) => f.stance === 'stand' && /^(toe|ankle)/.test(f.limb) && !f.strike.spin);
  const highKick = (side, flag) => kicks.find(([, f]) => f.limb.endsWith(side) && f.strike[`leg${side}`][0] >= 80 && !!f[flag] === false && !f.through && !f.straight);
  const knee = (leg) => leg[0] - leg[1];   // how far the knee is bent (degrees between the thigh and the shin)

  it('a kick\'s knee leads: it chambers at least to the strike\'s height with the shin folded, and re-chambers after', () => {
    const [, fam] = highKick('F');
    const b = strikeBody(fam);
    expect(b.load.legF[0]).toBeGreaterThanOrEqual(Math.min(fam.strike.legF[0] + 8, 125) - 1e-9);
    expect(knee(b.load.legF)).toBeGreaterThanOrEqual(115);
    expect(knee(b.follow.legF)).toBeGreaterThanOrEqual(110);
    // one that swings through the target, or rises straight, does neither
    const [, through] = kicks.find(([, f]) => f.through);
    const leg = (f) => `leg${f.limb.slice(-1)}`;
    expect(strikeBody(through).follow[leg(through)]).toEqual(through.follow[leg(through)]);
    const [, straight] = kicks.find(([, f]) => f.straight);
    expect(strikeBody(straight).load[`leg${straight.limb.slice(-1)}`]).toEqual(straight.load[`leg${straight.limb.slice(-1)}`]);
  });

  it('the weight comes over the standing leg, its knee giving, and the trunk leans away from a high kick', () => {
    const F = fighter({}), [, fam] = highKick('F'), b = strikeBody(fam);
    expect(knee(b.strike.legB)).toBeGreaterThanOrEqual(16 - 1e-9);
    expect(b.strike.torso).toBeLessThan(0);
    // one that leaves the standing leg to its guard stands it under the hips
    const free = { ...fam, strike: { ...fam.strike, legB: POSES.guard.legB } };
    const J = rigJoints(F.body, strikeBody(free).strike), G = rigJoints(F.body, POSES.guard);
    expect(Math.abs(J.ankleB[0] - J.pelvis[0])).toBeLessThan(Math.abs(G.ankleB[0] - G.pelvis[0]));
  });

  it('the hips turn into a kick: a lead leg opens the far hip forward, a rear leg turns them over', () => {
    const lead = kicks.find(([, f]) => f.limb.endsWith('F') && f.strike.legF[0] >= 80 && f.strike.sway === undefined);
    const rear = kicks.find(([, f]) => f.limb.endsWith('B') && f.strike.legB[0] >= 80);
    if (lead) expect(strikeBody(lead[1]).strike.sway).toBeGreaterThan(0);
    expect(strikeBody(rear[1]).strike.sway).toBeLessThan(0);
  });

  it('a punch is driven by the body: coiled back in the load, the hips forward and down at the strike', () => {
    const [, fam] = Object.entries(FAMILIES).find(([, f]) => f.stance === 'stand' && f.limb === 'fistB');
    const b = strikeBody(fam), hip = (p) => p.hip ?? [0, 0];
    expect(hip(b.load)[0]).toBeLessThan(hip(fam.load)[0]);
    expect(hip(b.strike)[0]).toBeGreaterThan(hip(fam.strike)[0]);
    expect(hip(b.strike)[1]).toBeLessThan(hip(fam.strike)[1]);
    expect(b.strike.legB[2]).toBeLessThanOrEqual(64);   // the back heel up
  });

  it('a crouching or air move is left as it is written', () => {
    const [, low] = Object.entries(FAMILIES).find(([, f]) => f.stance !== 'stand');
    expect(strikeBody(low)).toBe(low);
  });
});
