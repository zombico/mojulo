/**
 * THE TACTICAL CAMERA — a commander's view of a board, not a hero's: a locked pitch, yaw in quarter turns from a
 * diagonal, zoom in stops, the focus held to the board; the RTS form pans and scrolls at the edge instead of turning.
 *
 * The board kernel's discipline (board-kernel.js): one closure, `buildBoardCamera()`, referencing nothing outside
 * itself, so the page runs the same code by emitting its source, and Node tests it. No clock: the page hands it dt.
 * The frame is the world's, z up; yaw is the way the camera looks, in radians from +x (east) toward +y (north).
 *
 *   opts: { bounds: [x0, y0, x1, y1] (the board's, world metres), z (the ground's middle height), rotate (true),
 *           edge (false), fov (degrees, 24: narrow, so the view reads close to isometric), pitches ([30, 45]: degrees
 *           below the horizon, the first the default), zooms ([1, 0.62, 0.38]: shares of the distance that frames the
 *           whole board), follow ([0, 0.75, 1]: how far each zoom stop leans from the board's middle to the focus asked
 *           for, so the widest holds the whole board and the closer ones follow the cursor), yaw (0..3: which diagonal
 *           it starts on; 0 looks north-east) }
 *   init(opts) → C
 *   rotate(C, ±1)  a quarter turn (no-op in the RTS form); zoom(C, ±1) a stop in or out; tilt(C) the next pitch
 *   focusOn(C, [x, y, z?])  where it looks, held inside the bounds; pan(C, right, up, dt) by the screen's axes (RTS)
 *   step(C, dt)    eases yaw, pitch, distance and focus toward where they are going
 *   pose(C) → { pos: [x, y, z], target: [x, y, z], fov, up: [0, 0, 1] }
 *   screenStep(C, 'up' | 'down' | 'left' | 'right') → [dc, dr]   the board step a key means on screen: up is the board
 *                  axis most along the way the camera looks (the one clockwise of it on the diagonal's tie), right the
 *                  one most along the screen's right; read off the yaw it is turning to, so a key pressed mid-turn
 *                  already means the new view
 */

export function buildBoardCamera() {
  const QUARTER = Math.PI / 2, DIAG = Math.PI / 4, RAD = Math.PI / 180;
  const DEFAULTS = { rotate: true, edge: false, fov: 24, pitches: [30, 45], zooms: [1, 0.62, 0.38], follow: [0, 0.75, 1], yaw: 0, z: 0 };
  const AXES = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // e n w s, as [dc, dr]
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

  function init(opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    if (!o.bounds) throw new Error('board camera: bounds [x0, y0, x1, y1] are the board\'s');
    const [x0, y0, x1, y1] = o.bounds, w = x1 - x0, h = y1 - y0;
    // the distance that frames the whole board at the narrow fov, a margin round it
    const frame = (Math.hypot(w, h) * 0.46) / Math.tan((o.fov * RAD) / 2);
    const yawIdx = o.rotate ? ((o.yaw % 4) + 4) % 4 : 0, zoomIdx = 0, pitchIdx = 0;
    const focus = [(x0 + x1) / 2, (y0 + y1) / 2, o.z];
    const yaw = DIAG + yawIdx * QUARTER;
    return { o, frame, yawIdx, zoomIdx, pitchIdx, middle: focus.slice(), focusTo: focus.slice(), focus: focus.slice(), yawTo: yaw, yaw,
      pitch: o.pitches[0] * RAD, dist: frame * o.zooms[0] };
  }
  function rotate(C, by) {
    if (!C.o.rotate) return C;
    C.yawIdx = (((C.yawIdx + by) % 4) + 4) % 4;
    C.yawTo += by * QUARTER;   // the long way round never: it turns the quarter it was asked
    return C;
  }
  function zoom(C, by) { C.zoomIdx = clamp(C.zoomIdx + by, 0, C.o.zooms.length - 1); return C; }
  function tilt(C) { C.pitchIdx = (C.pitchIdx + 1) % C.o.pitches.length; return C; }
  function hold(C, p) {
    const [x0, y0, x1, y1] = C.o.bounds;
    return [clamp(p[0], x0, x1), clamp(p[1], y0, y1), p[2] != null ? p[2] : C.focusTo[2]];
  }
  function focusOn(C, p) { C.focusTo = hold(C, p); return C; }
  function pan(C, right, up, dt) {
    const f = [Math.cos(C.yawTo), Math.sin(C.yawTo)], r = [f[1], -f[0]], speed = C.dist * 0.9 * dt;
    C.focusTo = hold(C, [C.focusTo[0] + (r[0] * right + f[0] * up) * speed, C.focusTo[1] + (r[1] * right + f[1] * up) * speed, C.focusTo[2]]);
    return C;
  }
  function step(C, dt) {
    const k = ease(10, dt), kz = ease(8, dt), kf = ease(7, dt);
    C.yaw += (C.yawTo - C.yaw) * k;
    if (Math.abs(C.yawTo - C.yaw) < 1e-4) C.yaw = C.yawTo;
    const near = (v, to, k) => (Math.abs(to - v) < 1e-4 ? to : v + (to - v) * k);   // eased, and at rest once there
    C.pitch = near(C.pitch, C.o.pitches[C.pitchIdx] * RAD, kz);
    C.dist = near(C.dist, C.frame * C.o.zooms[C.zoomIdx], kz);
    // the RTS form pans the focus itself; the tactics form leans from the middle toward it by the zoom stop's share
    const lean = C.o.edge ? 1 : C.o.follow[Math.min(C.zoomIdx, C.o.follow.length - 1)];
    for (let i = 0; i < 3; i++) C.focus[i] = near(C.focus[i], C.middle[i] + (C.focusTo[i] - C.middle[i]) * lean, kf);
    return C;
  }
  function pose(C) {
    const c = Math.cos(C.pitch), s = Math.sin(C.pitch), f = C.focus;
    return { pos: [f[0] - Math.cos(C.yaw) * C.dist * c, f[1] - Math.sin(C.yaw) * C.dist * c, f[2] + C.dist * s], target: f.slice(), fov: C.o.fov, up: [0, 0, 1] };
  }
  function screenStep(C, key) {
    // the way it looks, nudged clockwise a degree so the diagonal's tie falls the same way every time
    const a = C.yawTo - RAD, f = [Math.cos(a), Math.sin(a)], r = [f[1], -f[0]];
    const best = (v) => { let b = AXES[0], d = -Infinity; for (const x of AXES) { const t = x[0] * v[0] + x[1] * v[1]; if (t > d) { d = t; b = x; } } return b; };
    const up = best(f), right = best(r);
    if (key === 'up') return up.slice();
    if (key === 'down') return [-up[0], -up[1]];
    if (key === 'right') return right.slice();
    if (key === 'left') return [-right[0], -right[1]];
    throw new Error("board camera: a step is 'up', 'down', 'left' or 'right'");
  }

  return { DEFAULTS, init, rotate, zoom, tilt, focusOn, pan, step, pose, screenStep };
}

const _cam = buildBoardCamera();
export const BOARD_CAMERA_DEFAULTS = _cam.DEFAULTS;
export const boardCameraInit = _cam.init;
export const boardCameraRotate = _cam.rotate;
export const boardCameraZoom = _cam.zoom;
export const boardCameraTilt = _cam.tilt;
export const boardCameraFocus = _cam.focusOn;
export const boardCameraPan = _cam.pan;
export const boardCameraStep = _cam.step;
export const boardCameraPose = _cam.pose;
export const boardCameraScreenStep = _cam.screenStep;
