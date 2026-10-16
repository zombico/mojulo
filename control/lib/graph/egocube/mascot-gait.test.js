// mascot-gait — a mascot on foot: its walk and run sized by its own legs (a short leg takes short, quick steps), every
// key reached with no clamped leg, the planted foot on the floor, the run's flight, and the measures a game plays them at.
import { describe, it, expect } from 'vitest';
import { rollMascot, FORMS, ENERGIES } from './mascot.js';
import { mascotPlan } from './mascot-form.js';
import { gaitMeasures, mascotGaits, KEYS, DUTY } from './mascot-gait.js';
import { mascotPilot, isMascotPlan, MAX_CYCLES, PERSON_HEIGHT } from './mascot-pilot.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { validateRig, rigNodesAt } from '../polygonizer/station-loft-rig.js';
import { humanoidBonesFor } from '../polygonizer/figure-humanoid-map.js';
import { tposeRig } from '../figures/rig-tpose.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { expandLayeredManifest } from '../../mcp/tools/layered.js';

const planOf = (facets, seed = 1) => mascotPlan(rollMascot({ facets, seed })).plan;
// one mascot per form (a form is a leg topology: the orb's stubs, the sprout's, the toon's long legs)
const BY_FORM = Object.fromEntries(Object.keys(FORMS).map((form) => [form, planOf({ form, energy: 'bouncy', hook: 'none', extremities: form === 'orb' ? 'nubs' : 'gloves' })]));

describe('mascot gaits', () => {
  it('every form walks and runs with both legs reaching every key, the toes where the gait puts them', () => {
    for (const [form, plan] of Object.entries(BY_FORM)) {
      const R = validateRig(expandPlan(plan).rig);
      for (const gait of ['walk', 'run']) {
        expect(plan.clips[gait], `${form} ${gait}`).toHaveLength(KEYS);
        for (const [i, key] of plan.clips[gait].entries()) {
          const { nodes, report } = rigNodesAt(R, key);
          for (const [S, leg] of Object.entries(report.legs)) {
            expect(leg.reach, `${form} ${gait} key ${i} leg ${S}`).toBe('ok');
            expect(Math.hypot(...nodes[`toeBase${S}`].map((v, k) => v - key.feet[S][k]))).toBeLessThan(1e-6);
          }
        }
      }
    }
  }, 60000);
  it('a walk keeps a foot on the floor at every key; a run flies, both feet up', () => {
    const plan = BY_FORM.toon, floor = plan.rig.joints['toeBase$S'].at[2];
    const down = (key) => ['R', 'L'].filter((S) => Math.abs(key.feet[S][2] - floor) < 1e-6).length;
    expect(plan.clips.walk.every((k) => down(k) >= 1)).toBe(true);
    expect(plan.clips.walk.some((k) => down(k) === 2)).toBe(true);
    expect(plan.clips.run.some((k) => down(k) === 0 && k.lift > 0)).toBe(true);
  });
  it('a short leg takes short, quick steps: stride and cycle grow with the leg, the run faster than the walk', () => {
    const M = Object.fromEntries(Object.entries(BY_FORM).map(([form, plan]) => [form, mascotGaits(plan)]));
    const byLeg = Object.values(M).sort((a, b) => a.leg - b.leg);
    for (let i = 1; i < byLeg.length; i++) {
      expect(byLeg[i].walk.stride).toBeGreaterThan(byLeg[i - 1].walk.stride);
      expect(byLeg[i].walk.seconds).toBeGreaterThanOrEqual(byLeg[i - 1].walk.seconds);
    }
    for (const m of Object.values(M)) {
      expect(m.run.speed).toBeGreaterThan(m.walk.speed);
      expect(m.walk.travel).toBeCloseTo(m.walk.stride / DUTY.walk, 3);
      expect(m.walk.stride).toBeLessThan(2 * m.leg);
    }
  });
  it('the energy flavours it: a sturdy one waddles wide, a zippy one trails its arms in the run', () => {
    const sturdy = planOf({ form: 'toon', energy: 'sturdy', hook: 'none', extremities: 'gloves' }), zippy = planOf({ form: 'toon', energy: 'zippy', hook: 'none', extremities: 'gloves' });
    expect(Math.abs(sturdy.clips.walk[0].feet.R[0])).toBeGreaterThan(Math.abs(BY_FORM.toon.clips.walk[0].feet.R[0]));
    expect(sturdy.clips.walk.some((k) => k.spine.sideBend)).toBe(true);
    expect(zippy.clips.run.every((k) => k.armR.y < 0)).toBe(true);
    expect(Object.keys(ENERGIES)).toContain('zippy');
  });
  it('is pure: the same plan, the same clips and measures', () => {
    const again = planOf({ form: 'toon', energy: 'bouncy', hook: 'none', extremities: 'gloves' });
    expect(again.clips.run).toEqual(BY_FORM.toon.clips.run);
    expect(gaitMeasures({ hip: [0.1, 0, 0.4], knee: [0.1, 0.04, 0.22], ankle: [0.1, -0.02, 0.05], toeBase: [0.1, 0.04, 0.03] })).toEqual(gaitMeasures({ hip: [0.1, 0, 0.4], knee: [0.1, 0.04, 0.22], ankle: [0.1, -0.02, 0.05], toeBase: [0.1, 0.04, 0.03] }));
  });
  it('its rig is a humanoid\'s (the shin the lower leg, the metatarsus the foot): it moulds to the T-pose, its gaits kept', async () => {
    const plan = BY_FORM.sprout;
    expect(humanoidBonesFor(validateRig(expandPlan(plan).rig).bones).missing).toEqual([]);
    const { payload } = await resolveWorldScene({ ref: 'sk_t', manifest: expandLayeredManifest({ kind: 'layered', plan }) });
    const T = tposeRig(payload.figures.body);
    expect(Object.keys(T.clips)).toEqual(expect.arrayContaining(['walk', 'run']));
  }, 60000);
  it('as a pilot: its own size, its capsule and camera from its body, its stride never past four cycles a second', () => {
    for (const plan of Object.values(BY_FORM)) {
      expect(isMascotPlan(plan)).toBe(true);
      const P = mascotPilot(plan, { speed: 4 }), h = plan.mascot.height;
      expect(P.rule.collideHeight).toBeCloseTo(h, 2);
      expect(P.rule.collideRadius).toBeLessThan(h / 2 + 1e-9);
      expect(P.rule.stride).toBeGreaterThanOrEqual(P.gaits.run.travel - 1e-3);
      expect(4 / P.rule.stride).toBeLessThanOrEqual(MAX_CYCLES + 1e-9);
      expect(P.camera.dist).toBeLessThanOrEqual(5.5 * Math.max(0.45, h / PERSON_HEIGHT) + 1e-3);
      expect(P.eye).toBeLessThan(h);
      expect(P.clips).toMatchObject({ forward: 'run', turn: 'walk', idle: 'idle', leap: 'leap', squat: 'squat' });
      for (const c of Object.values(P.clips)) expect(plan.clips[c]).toBeDefined();
    }
    expect(isMascotPlan({ clips: { run: [] } })).toBe(false);
    expect(() => mascotPilot({})).toThrow(/not a mascot/);
  });
});

