/**
 * Shoot plan — the CONTACT SHEET's frames: a few instants of each shot (its start, its middle, its end: the instants
 * the frame read reads, frame.js), so an agent and a person can see what a plan frames without rendering the film. A
 * sheet is a row a shot, a frame a column, each frame captioned with what the frame read says of it.
 *
 *   contactFrames(plan, { subjects, per, metersPerUnit, aspect }) → { rows: [{ shot, camera, about?, size?, notes:
 *     [codes], frames: [{ at: 'start' | 'middle' | 'end', tau, world_t, camera_t?, framing, roll, size? }] }] }
 *   `per` 1 (the middle), 2 (start and end) or 3 (all three, the default); the running order's shots, cued ones not
 *
 * Pure and deterministic: the cameras come from the sampler (sample.js), the words from the frame read.
 */
import { compileCamera, cameraAt, programOf, shotAt, frameOf } from './sample.js';
import { frameRead, readFigure, ASPECT, FIGURE_H } from './frame.js';

/** the instants a sheet takes of a shot, by how many it takes */
export const AT = Object.freeze({ 1: ['middle'], 2: ['start', 'end'], 3: ['start', 'middle', 'end'] });
/** the most shots a sheet holds (a longer cut is its first ones; the sheet says so) */
export const MAX_ROWS = 16;

const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** The sheet's frames (see the header) */
export function contactFrames(plan, { subjects = null, per = 3, metersPerUnit = 1, aspect = ASPECT } = {}) {
  const n = AT[per] ? per : 3;
  const program = programOf(plan), compiled = new Map(plan.cameras.map((c) => [c.id, compileCamera(c, { subjects })]));
  const read = frameRead(plan, { subjects, metersPerUnit, aspect });
  const mpu = Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1;
  const rows = program.shots.slice(0, MAX_ROWS).map((shot, i) => {
    const R = read.shots[i] || {}, about = R.about && subjects ? subjects.get(R.about) : null;
    const frames = AT[n].map((at) => {
      const tau = at === 'start' ? shot.start + 1e-6 : at === 'end' ? shot.start + shot.length - 1e-6 : shot.start + shot.length / 2;
      const w = shotAt(program, tau), cam = cameraAt(compiled.get(shot.camera), w.camera_t ?? w.t);
      // the size this frame reads of the shot's subject (a figure's), so a move shows its sizes along the row
      let size;
      if (about && (about.box || about.kind === 'entity')) {
        const here = about.at(w.t);
        size = readFigure(cam, { pos: here.pos, heading: here.heading, height: about.box ? about.box.hgt : FIGURE_H / mpu, figure: about.kind === 'walker' || about.kind === 'entity' || about.kind === 'figure' }, { aspect }).size;
      }
      const f = frameOf(cam);
      return { at, tau: r4(tau), world_t: r4(w.t), ...(w.camera_t !== undefined ? { camera_t: r4(w.camera_t) } : {}), framing: f.worldFraming, roll: f.roll, ...(size ? { size } : {}) };
    });
    return { shot: shot.name, camera: shot.camera, ...(R.about ? { about: R.about } : {}), ...(R.size ? { size: R.size } : {}), notes: read.notes.filter((x) => x.shot === shot.name).map((x) => x.code), frames };
  });
  return { rows, ...(program.shots.length > MAX_ROWS ? { cut: `the first ${MAX_ROWS} of ${program.shots.length} shots` } : {}), notes: read.notes };
}
