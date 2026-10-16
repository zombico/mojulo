/**
 * THE MASCOT DRIVER: a racer whose driver is a mascot (a race's setting leans that way, egocube/setting.js) is driven by
 * that driver's own body, the mascot read off the same person (egocube/mascot-from-person.js), seated in the cockpit in
 * place of the chibi stand-in. The machine is still read off the person's sheet, and the frame is still sized from the
 * stand-in's (racer.js frameOf), so the physics and the field's balance are the driver's either way; only who is seen
 * in the seat changes.
 *
 *   mascotDriver(plan, F, d, body)  → { faces, head, crown, palette, count, culled }, in the stand-in's shape (racer.js
 *                                     standIn) and its crown, the point the driver-seen law looks for
 *
 *   plan   the mascot's ring plan (mascot-form.js mascotPlanFromSheet's create.spec.plan)
 *   F, d   the frame and the stand-in's sizes: the mascot is scaled so its seated height (the pelvis to the crown) is
 *          the stand-in's (torso and head), its pelvis on the seat
 *   body   the lofted body's queries (hwAt, topAt, botAt): a face inside the shell is never seen, and is left out
 *
 * Seated by the rig's own channels (station-loft-rig.js): the legs free, turned forward about the hips past the swivel's
 * cone (`seat`, a seated statue's), the knees bent, the hands forward to the wheel. The mascot keeps its fine rings
 * (mascot law 8) and its own colours; its faces are counted apart from the machine's budget. Pure and deterministic.
 */
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { poseLayered } from '../polygonizer/hero-gesture.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** the seated key: thighs forward and level, knees bent, hands forward and down to the wheel's rim */
export const SEATED = Object.freeze({
  support: 'none', crouch: 0, seat: 60,
  hipL: { pitch: 50, yaw: 0, roll: 0 }, hipR: { pitch: 50, yaw: 0, roll: 0 }, kneeL: 90, kneeR: 90,
  armL: { x: -0.3, y: 0.85, z: -0.4 }, armR: { x: 0.3, y: 0.85, z: -0.4 }, elbowL: 'slight', elbowR: 'slight',
});

/** the group a mascot face is painted under on the machine: its own palette role, kept apart from the machine's slots */
export const mascotSlot = (group) => `mascot:${group}`;

export function mascotDriver(plan, F, d, body = null) {
  const recipe = expandPlan(plan), mesh = poseLayered(compileLayered(recipe), recipe, SEATED).mesh, J = recipe.rig.joints;
  const pelvis = J.pelvisHub.at, top = Math.max(...mesh.vertices.map((v) => v[2]));
  // seated height: the pelvis to the crown, as the stand-in's torso and head
  const s = (d.torso + d.head) / Math.max(1e-6, top - pelvis[2]);
  const seat = [0, F.hipY, F.seatZ + 0.04];
  const at = (v) => [r4(seat[0] + (v[0] - pelvis[0]) * s), r4(seat[1] + (v[1] - pelvis[1]) * s), r4(seat[2] + (v[2] - pelvis[2]) * s)];
  const V = mesh.vertices.map(at);
  // inside the shell: below its top, above its bottom, within its half width, at every corner
  const inside = (p) => body && p[1] >= body.tailY && p[1] <= body.noseY && Math.abs(p[0]) < body.hwAt(p[1]) - 0.005 && p[2] > body.botAt(p[1]) && p[2] < body.topAt(p[1]) - 0.005;
  const faces = [];
  let culled = 0;
  mesh.faces.forEach((f, i) => {
    const corners = f.map((k) => V[k]);
    if (corners.every(inside)) { culled++; return; }
    faces.push({ corners, group: mascotSlot(mesh.groups[i]), value: 0.6, driver: true });
  });
  const headAt = (J.headBase && J.headTop) ? at(J.headBase.at.map((x, k) => (x + J.headTop.at[k]) / 2)) : at([pelvis[0], pelvis[1], top]);
  // the crown a little under the top of the head (its hair, a tuft or ears may stand over it): what the chase camera must see
  const crown = [headAt[0], headAt[1], r4(seat[2] + (top - pelvis[2]) * s * 0.92)];
  const palette = Object.fromEntries(Object.entries(plan.palette).map(([g, hex]) => [mascotSlot(g), hex]));
  return { faces, head: headAt, crown, palette, count: faces.length, culled };
}
