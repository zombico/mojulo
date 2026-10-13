/**
 * The frozen gaits (characterization net for the walk / run mint tables).
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
import { motionPlan } from './hero-motion.js';
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
  it('a hero door gait as studied (walk, jog, sprint: seconds, tilt and the resolved dof)', () => {
    const plan = motionPlan({ walk: true, jog: true, sprint: true });
    expect(hash(Object.entries(plan).map(([g, P]) => [g, P.seconds, P.tilt, dofs(P.spec, 12)]))).toBe('612558927f6f982e');
  });
});
