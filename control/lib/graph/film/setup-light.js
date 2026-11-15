/**
 * setup-light — a scene LIT PER SETUP, as a cinematographer lights it: each shot of the coverage its own key, fill and
 * rim, placed from where that shot's camera stands and where its subject faces, in the cast rig's colours and ratios
 * (color-theorist/cast-rig.js: the one light every body is drawn under; its card where the scene has no world light).
 *
 *   THE KEY: on the SHORT side, the side the subject's face is turned to and away from the lens, so the far cheek takes
 *   the light and the near one turns to shade (a subject square to the lens is keyed 35° off its axis); raised 35°, three
 *   metres off. THE FILL: across the lens from the key, low (15°), at the rig's sky against its key (a quarter to a half),
 *   so the shade side keeps its form. THE RIM: behind the subject from the lens, on the key's side, high (45°), at the
 *   rig's rim strength, separating the figure from what is behind it.
 *
 *   setupLights({ S, coverage, shots, rig? }) → [{ shot, frame, subject, key, fill, rim }]: each light { pos, energy (W),
 *     color (#hex), size (m) }; `frame` the shot's first frame on the film's timeline (1-based, the shots laid end to end
 *     as film_shots.py lays them); `subject` what the lights aim at (the camera's point of interest)
 *
 * Pure and deterministic.
 */
import { castCard } from '../color-theorist/cast-rig.js';
import { placeOn } from '../actor/scene.js';

export const KEY_WATTS = 300;
const r3 = (v) => Math.round(v * 1000) / 1000;
const rad = (d) => (d * Math.PI) / 180;
const unit2 = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
const turn2 = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hex = (lin) => `#${lin.map((v) => Math.round(Math.min(1, Math.max(0, v)) ** (1 / 2.2) * 255).toString(16).padStart(2, '0')).join('')}`;

/** a light `dist` metres from the subject along a horizontal direction, raised `el` degrees */
const place = (subject, dir, el, dist) => [r3(subject[0] + dir[0] * dist * Math.cos(rad(el))), r3(subject[1] + dir[1] * dist * Math.cos(rad(el))), r3(subject[2] + dist * Math.sin(rad(el)))];

/** Each shot's lights (see the header) */
export function setupLights({ S, coverage, shots, rig = castCard() }) {
  const sky = rig.hemi?.sky ?? [0.1, 0.1, 0.12];
  const ratio = Math.min(0.5, Math.max(0.25, (lum(sky) / Math.max(1e-6, lum(rig.key.linear))) * 3));
  const keyW = r3(KEY_WATTS * (rig.key.gain ?? 1));
  let frame = 1;
  return coverage.shots.map((s, k) => {
    const n = shots[k]?.frame_count ?? shots[k]?.cameras?.length ?? 1, first = frame;
    frame += n;
    const cam = coverage.cameras.find((c) => c.id === s.camera), keys = cam.keys.filter((x) => x.t >= s.span[0] - 1e-3 && x.t <= s.span[1] + 1e-3);
    const K = keys[Math.floor(keys.length / 2)] ?? cam.keys[0];
    const subject = K.poi.map(r3), toCam = unit2([K.pos[0] - subject[0], K.pos[1] - subject[1]]);
    // (the subject: whoever stands nearest what the camera looks at, its facing at the shot's middle)
    const mid = (s.span[0] + s.span[1]) / 2;
    const near = Object.values(S.actors).map((A) => placeOn(A.root, mid)).sort((a, b) => Math.hypot(a.x - subject[0], a.y - subject[1]) - Math.hypot(b.x - subject[0], b.y - subject[1]))[0];
    const face = near ? [Math.sin(rad(near.yaw)), Math.cos(rad(near.yaw))] : [-toCam[0], -toCam[1]];
    // the short side: in front of the face, away from the lens; a face square to the lens keyed 35° off its axis
    let keyDir = unit2([face[0] - 0.35 * toCam[0], face[1] - 0.35 * toCam[1]]);
    const off = Math.acos(Math.max(-1, Math.min(1, keyDir[0] * toCam[0] + keyDir[1] * toCam[1])));
    if (off < rad(25)) keyDir = turn2(toCam, rad(35));
    const side = Math.sign(toCam[0] * keyDir[1] - toCam[1] * keyDir[0]) || 1;
    const fillDir = turn2(toCam, -side * rad(40)), rimDir = turn2([-toCam[0], -toCam[1]], -side * rad(25));
    return {
      shot: k, name: s.name, frame: first, subject,
      key: { pos: place(subject, keyDir, 35, 3), energy: keyW, color: rig.key.color ?? hex(rig.key.linear), size: 1.2 },
      fill: { pos: place(subject, fillDir, 15, 3.5), energy: r3(keyW * ratio), color: hex(sky.map((v) => v / Math.max(...sky))), size: 2 },
      rim: { pos: place(subject, rimDir, 45, 2.5), energy: r3(keyW * (rig.rim?.strength ?? 0.45) * 1.4), color: rig.rim?.color ?? '#ffffff', size: 0.6 },
    };
  });
}
