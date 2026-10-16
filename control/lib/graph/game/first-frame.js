/**
 * first-frame — what a player sees on a level's opening frame, measured (a MACHINE gate: it measures, advises and
 * stamps; it never refuses a level and never stands in for the eyes gate, which is a person playing it).
 *
 * Why: nothing looked at the first frame. A level whose follow camera opens inside the hero ships a whole frame of
 * one colour, and every other check (the contract dry-run, the completability audit) still passes it. Three reads,
 * each on one frame rendered from the level's own camera (first-frame-check.js renders it):
 *
 *   one colour  the frame's pixels quantized coarsely (FIRST_FRAME.bits per channel); one bin over `oneColour` of the
 *               frame → failed (the camera is inside something, or looking at nothing)
 *   eye inside  the camera's eye inside an entity's body (its collision volume, as the runtime holds it) → failed;
 *               a first-person camera rides its own target's eye, so that target is never counted
 *   hero size   the hero's on-screen size: the square root of its projected bounding box's share of the frame (a
 *               linear measure: 0.08–0.35 reads as a hero between a twelfth and a third of the frame across). Outside
 *               `hero` → warn. Derived from the camera (eye, look point, vertical fov) and the hero's collision
 *               volume, not from the pixels: the page does not hand out its meshes. Its bounding box is coarser
 *               than its silhouette, which is why the band is wide.
 *
 * Pure: pixel buffers and plain scene numbers in, a verdict out. Unit-tested on synthetic buffers.
 */

export const FIRST_FRAME = Object.freeze({
  width: 320,          // the frame the check renders (fractions are what is judged, so it renders small)
  height: 240,
  settle: 24,          // idle ticks at 1/24 s before the frame: the first second of play, the camera eased in
  bits: 3,             // per channel: 8 levels of each, 512 bins
  oneColour: 0.85,     // one bin over this share of the frame → failed
  hero: Object.freeze([0.08, 0.35]),   // the hero's linear on-screen size outside this band → warn
});

const RANK = { pass: 0, warn: 1, failed: 2 };
/** The worse of two statuses (pass < warn < failed). */
export const worse = (a, b) => ((RANK[b] ?? 0) > (RANK[a] ?? 0) ? b : a);

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/**
 * The most common colour of an RGBA buffer, quantized to `bits` per channel.
 * @param {Uint8Array|Uint8ClampedArray|Buffer} rgba  width*height*4 bytes
 * @returns {{ share: number, color: string }}  its share of the pixels and its bin's centre colour
 */
export function dominantColour(rgba, { bits = FIRST_FRAME.bits } = {}) {
  const n = Math.floor((rgba?.length ?? 0) / 4);
  if (!n) return { share: 0, color: null };
  const shift = 8 - bits, levels = 1 << bits, counts = new Uint32Array(levels * levels * levels);
  let best = 0, at = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const k = ((rgba[o] >> shift) * levels + (rgba[o + 1] >> shift)) * levels + (rgba[o + 2] >> shift);
    const c = ++counts[k];
    if (c > best) { best = c; at = k; }
  }
  const step = 1 << shift, mid = (q) => q * step + step / 2;
  const r = Math.floor(at / (levels * levels)), g = Math.floor(at / levels) % levels, b = at % levels;
  return { share: best / n, color: hex(mid(r), mid(g), mid(b)) };
}

/**
 * An entity's body as a vertical cylinder: { id, x, y, z0, z1, r }, or null when it has none (`body.type: 'none'`,
 * or no size to read). Reads what the runtime holds: the collision volume (`collideVol`), else the rule's collide
 * radius and height, else the body's own radius or size. `eye` is how far above its feet the entity's position sits.
 */
export function bodyOf(e) {
  if (!e || !Array.isArray(e.pos) || e.bodyType === 'none') return null;
  const cv = e.collideVol;
  const r = Number.isFinite(cv?.a) ? cv.a : Number.isFinite(e.collideRadius) ? e.collideRadius
    : Number.isFinite(e.radius) ? e.radius : Array.isArray(e.size) ? Math.max(e.size[0] ?? 0, e.size[1] ?? 0) / 2 : null;
  if (!(r > 0)) return null;
  const h = Number.isFinite(cv?.c) ? 2 * cv.c : Number.isFinite(e.collideHeight) ? e.collideHeight
    : Array.isArray(e.size) && Number.isFinite(e.size[2]) ? e.size[2] : 2 * r;
  const z0 = e.pos[2] - (Number.isFinite(e.eye) ? e.eye : 0);
  return { id: e.id, x: e.pos[0], y: e.pos[1], z0, z1: z0 + h, r };
}

/** The id of the first body the eye is inside, or null. `skip` is an id never counted (a first person's own body). */
export function eyeInside(eye, bodies, { skip = null } = {}) {
  if (!Array.isArray(eye)) return null;
  for (const b of bodies) {
    if (!b || b.id === skip) continue;
    if (Math.hypot(eye[0] - b.x, eye[1] - b.y) < b.r && eye[2] >= b.z0 && eye[2] <= b.z1) return b.id;
  }
  return null;
}

/**
 * The hero's on-screen size, from a pinhole camera (z-up world, like the page's): the eye, the point it looks at, its
 * vertical fov in degrees and the frame's aspect. The body's bounding box corners are projected; the part in front of
 * the camera is clipped to the frame.
 * @returns {{ area: number, size: number, visible: boolean }}  area: the box's share of the frame; size: √area
 */
export function heroOnScreen({ eye, look, vfov, aspect }, body) {
  const none = { area: 0, size: 0, visible: false };
  if (!body || !Array.isArray(eye) || !Array.isArray(look) || !(vfov > 0) || !(aspect > 0)) return none;
  const f = norm([look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]]);
  if (!f) return none;
  // right = f × up(z); a camera looking straight down keeps +y as its up
  let r = norm([f[1], -f[0], 0]);
  if (!r) r = [1, 0, 0];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const t = Math.tan((vfov * Math.PI) / 360);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, front = 0;
  for (const cx of [body.x - body.r, body.x + body.r]) for (const cy of [body.y - body.r, body.y + body.r]) for (const cz of [body.z0, body.z1]) {
    const d = [cx - eye[0], cy - eye[1], cz - eye[2]];
    const zc = dot(d, f);
    if (zc <= 0.05) continue;   // behind (or at) the near plane
    front++;
    const nx = dot(d, r) / (zc * t * aspect), ny = dot(d, u) / (zc * t);
    x0 = Math.min(x0, nx); x1 = Math.max(x1, nx); y0 = Math.min(y0, ny); y1 = Math.max(y1, ny);
  }
  if (!front) return none;
  // a box straddling the camera: what is in front reaches past the frame on the side behind
  if (front < 8) { x0 = Math.min(x0, -1); x1 = Math.max(x1, 1); y0 = Math.min(y0, -1); y1 = Math.max(y1, 1); }
  const w = Math.max(0, Math.min(1, x1) - Math.max(-1, x0)), h = Math.max(0, Math.min(1, y1) - Math.max(-1, y0));
  const area = (w * h) / 4;
  return { area: r4(area), size: r4(Math.sqrt(area)), visible: area > 0 };
}

/**
 * The verdict on one opening frame.
 * @param {{ rgba, scene: { eye, look, vfov, aspect, firstPerson?, heroId?, entities: object[] } }} frame
 * @returns {{ status: 'pass'|'warn'|'failed', colour: { share, color }, eye_inside: string|null, hero: object|null, says: string[] }}
 */
export function judgeFrame({ rgba, scene = {} }, T = FIRST_FRAME) {
  const says = [];
  let status = 'pass';
  const colour = dominantColour(rgba, { bits: T.bits });
  colour.share = r4(colour.share);
  if (colour.share > T.oneColour) {
    status = 'failed';
    says.push(`one colour (${colour.color}) covers ${pct(colour.share)} of the frame: the camera is inside something or looking at nothing`);
  }
  const bodies = (scene.entities ?? []).map(bodyOf).filter(Boolean);
  const inside = eyeInside(scene.eye, bodies, { skip: scene.firstPerson ? scene.heroId : null });
  if (inside) {
    status = 'failed';
    says.push(`the camera's eye is inside '${inside}'`);
  }
  let hero = null;
  const heroBody = !scene.firstPerson && scene.heroId ? bodies.find((b) => b.id === scene.heroId) : null;
  if (heroBody && inside !== heroBody.id) {   // (an eye inside the hero has said all there is to say about its size)
    hero = { id: scene.heroId, ...heroOnScreen(scene, heroBody) };
    const [lo, hi] = T.hero;
    if (!hero.visible) { status = worse(status, 'warn'); says.push(`the hero '${hero.id}' is not in the frame`); }
    else if (hero.size < lo || hero.size > hi) {
      status = worse(status, 'warn');
      says.push(`the hero is ${pct(hero.size)} of the frame across (${pct(lo)}–${pct(hi)} reads): ${hero.size < lo ? 'too far to read' : 'too close'}`);
    }
  }
  return { status, colour, eye_inside: inside, hero, says };
}

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : null; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function r4(v) { return Math.round(v * 10000) / 10000; }
function pct(v) { return `${Math.round(v * 100)}%`; }
