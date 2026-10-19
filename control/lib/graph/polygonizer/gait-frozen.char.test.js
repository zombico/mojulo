/**
 * The frozen motions (characterization net for the walk / run / wave / bow mint tables).
 *
 * A recipe stored with motion 'walk' or 'sprint', or with a partial { walk } / { sprint }, resolves its left-out dials
 * against WALK_DEFAULTS / SPRINT_DEFAULTS at every render; a hero's door gait does the same through motionPlan. Those
 * tables are frozen: what is made from now on is tuned in WALK_MINT / SPRINT_MINT and stamped into the recipe by value
 * (motion-stamp.js). These hashes pin that a bare gait renders as it did before the mint tables existed. They were
 * computed on 1012-worldbible-technology at 8d9c183b, before them.
 *
 * Re-pinning is legitimate ONLY alongside a plan phase that says the frozen emission changes (it should not: a change
 * to how new walks look belongs in the mint tables).
 */
import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { balancedArmature, sampleMotionPose, renderFigureFrames } from './figure-render.js';
import { motionPlan, heroLocomotion } from './hero-motion.js';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveMotion } from './figure-posing.js';

const hash = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const r9 = (v) => Math.round(v * 1e9) / 1e9;
const armature = (m, n) => Array.from({ length: n }, (_, i) => Object.fromEntries(
  Object.entries(balancedArmature(sampleMotionPose(m, i / n, n))).map(([k, p]) => [k, [r9(p.x), r9(p.y), r9(p.z)]])));
const dofs = (spec, n) => { const move = resolveMotion(spec); return Array.from({ length: n }, (_, i) => move(i / n)); };

describe('frozen gaits — a bare gait renders as it did before the mint tables', () => {
  it("'walk': the balanced armature over a stride", () => {
    expect(hash(armature('walk', 16))).toBe('ac8d41d8b06e1e11');
  });
  it("'sprint': the armature over a stride", () => {
    expect(hash(armature('sprint', 16))).toBe('3f511f1bd432c5e6');
  });
  it("'walk': the figure's frames as the GIF draws them", () => {
    expect(hash(renderFigureFrames({ kind: 'figure', motion: 'walk' }, 4))).toBe('8e6c835c570bb59f');
  });
  it("'wave': the armature over the choreography, and its frames", () => {
    expect(hash(armature('wave', 30))).toBe('e3d80b443d3c9529');
    expect(hash(renderFigureFrames({ kind: 'figure', motion: 'wave' }, 4))).toBe('e3cc0b1f2079923e');
  });
  it("'bow' and { emote: 'bow', intensity }: the armature over the emote", () => {
    expect(hash(armature('bow', 30))).toBe('4b426a76736484fa');
    expect(hash(armature({ emote: 'bow', intensity: 1.3 }, 30))).toBe('966ceaa841c5ede3');
  });
  it('a hero door gait as studied (walk, jog, sprint: seconds, tilt and the resolved dof)', () => {
    const plan = motionPlan({ walk: true, jog: true, sprint: true });
    expect(hash(Object.entries(plan).map(([g, P]) => [g, P.seconds, P.tilt, dofs(P.spec, 12)]))).toBe('612558927f6f982e');
  });
  // (re-pinned for the hero laws 3, hero-form.js LEG_SET: the leg turned back about the ankle moves the rig the gaits
  // ride; a hero at laws 2 gives the value pinned before it, still)
  it("a hero's studied walk and jog on its rig (heroLocomotion: travel and the grounded pose; hashes from 713ef32e)", () => {
    const r6 = (x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x);
    const deep = (v) => (Array.isArray(v) ? v.map(deep) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)])) : r6(v));
    for (const [laws, pin] of [[undefined, 'a5f8b543f83e3263'], [2, '7833f58a379d4311']]) {
      const hr = heroRecord({ cast: 'female', head: 'anime' }), R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: laws ? { ...hr, laws } : hr }).recipe.rig);
      const out = Object.entries(motionPlan({ walk: true, jog: true })).map(([g, P]) => { const lo = heroLocomotion(P.spec, R, { tilt: P.tilt }); return [g, r6(lo.travel), Array.from({ length: 12 }, (_, i) => deep(lo.fn(i / 12)))]; });
      expect(hash(out), `laws ${laws ?? 'current'}`).toBe(pin);
    }
  }, 120_000);
});
