/**
 * THE TALK FACE — a speaker's own figure, head and shoulders, drawn live in the talk box's face (playscape/ui/talk-box.js,
 * mana-ui's `talk-box`): the level's scene seen through a second camera standing in front of whoever speaks. Drawn on the
 * page's one renderer, never a second context: before the frame's own render, the portrait is rendered into a corner of
 * the canvas, copied into a canvas laid over the face's place, and the frame's render then draws over the corner.
 * What the speaker does is what the portrait shows (their idle, their walk, their scene's take): nothing is baked.
 *
 *   faceFrame(box, heading, fov) → { at, look }: the portrait's camera for a body whose box is { min, max } ([x, y, z]
 *     metres, z up) facing `heading` (radians from +x, a transform's): the top of the body framed (its upper share, a
 *     head and shoulders on a person), a little to the speaker's right of straight on and a touch above the eyes. Pure
 *   buildTalkFace(THREE, renderer, scene, frame) → { draw(who, body, heading, el), hide(), drawn(), canvas }: the page's
 *     portrait (self-contained, shipped by toString). `draw` renders `body` (a THREE object) framed by `frame` into the
 *     inside of `el` (the face's place, its border kept); its box is measured once a speaker, so their breath does not
 *     move the frame
 */

/** the portrait camera's field of view (degrees): a long lens, the face not stretched */
export const FACE_FOV = 26;

/** The portrait's camera for a body (see the header). */
export function faceFrame(box, heading, fov) {
  const h = Math.max(0.2, box.max[2] - box.min[2]);
  // the share framed: a person's head and shoulders (the crown a little under the frame's top, the chest at its foot),
  // never less than a head nor more than a door's width
  const span = Math.min(1, Math.max(0.3, 0.3 * h));
  const cx = (box.min[0] + box.max[0]) / 2, cy = (box.min[1] + box.max[1]) / 2, cz = box.max[2] - span * 0.42;
  const dist = span / 2 / Math.tan((fov * Math.PI) / 360);
  const fx = Math.cos(heading), fy = Math.sin(heading), rx = fy, ry = -fx;   // their front, their right
  return { at: [cx + fx * dist + rx * dist * 0.18, cy + fy * dist + ry * dist * 0.18, cz + span * 0.06], look: [cx, cy, cz] };
}

/** The page's portrait (see the header). Self-contained: shipped by toString. */
export function buildTalkFace(THREE, renderer, scene, frame) {
  const FOV = 26;
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;z-index:33;pointer-events:none;display:none';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const cam = new THREE.PerspectiveCamera(FOV, 1, 0.05, 120);
  cam.up.set(0, 0, 1);
  const box = new THREE.Box3(), vp = new THREE.Vector4(), sc = new THREE.Vector4();
  let key = null, rel = null, drawn = 0;
  function hide() { if (cv.style.display !== 'none') cv.style.display = 'none'; key = null; }
  function draw(who, body, heading, el) {
    const r = el.getBoundingClientRect(), bx = el.clientLeft || 0, by = el.clientTop || 0, w = el.clientWidth, h = el.clientHeight;
    if (w < 8 || h < 8) { hide(); return; }
    // the body's box, measured once a speaker and carried with it (its breath, a gesture, never moves the frame)
    if (key !== who) {
      box.setFromObject(body);
      if (box.isEmpty()) { hide(); return; }
      const p = body.position;
      rel = { min: [box.min.x - p.x, box.min.y - p.y, box.min.z - p.z], max: [box.max.x - p.x, box.max.y - p.y, box.max.z - p.z] };
      key = who; cv.style.borderRadius = getComputedStyle(el).borderRadius;
    }
    const p = body.position, B = { min: [p.x + rel.min[0], p.y + rel.min[1], p.z + rel.min[2]], max: [p.x + rel.max[0], p.y + rel.max[1], p.z + rel.max[2]] };
    const F = frame(B, heading, FOV);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    cam.position.set(F.at[0], F.at[1], F.at[2]); cam.lookAt(F.look[0], F.look[1], F.look[2]);
    // rendered into the canvas's corner (the frame's own render draws over it), copied out at once
    const pr = renderer.getPixelRatio(), W = renderer.domElement.width, H = renderer.domElement.height;
    const bw = Math.max(1, Math.min(Math.round(w * pr), W >> 1)), bh = Math.max(1, Math.min(Math.round(h * pr), H >> 1));
    renderer.getViewport(vp); renderer.getScissor(sc); const was = renderer.getScissorTest();
    renderer.setViewport(0, 0, bw / pr, bh / pr); renderer.setScissor(0, 0, bw / pr, bh / pr); renderer.setScissorTest(true);
    renderer.render(scene, cam);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    ctx.drawImage(renderer.domElement, 0, H - bh, bw, bh, 0, 0, bw, bh);
    renderer.setViewport(vp); renderer.setScissor(sc); renderer.setScissorTest(was);
    const s = cv.style;
    s.left = (r.left + bx) + 'px'; s.top = (r.top + by) + 'px'; s.width = w + 'px'; s.height = h + 'px';
    if (s.display !== 'block') s.display = 'block';
    drawn++;
  }
  return { draw, hide, drawn: () => drawn, canvas: cv };
}
