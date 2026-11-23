/**
 * A TRACK IN THE FORM RENDER (the seventh generation, era/eras.js): a surface carries its colour and its form, and the
 * page lights it. The track's faces are built in their colours alone (a kit's `form: true`: chunky-look.js
 * CHUNKY_FORM_LIGHT, every part's normals kept), then baked here as the town's buildings are (form/sun-light.js): each
 * corner its BASE (the colour its paint asks for, so a face lying flat, the way and its verge, the most of the screen,
 * shows the design language's own colour: the palette kept) and the LIGHT the day lays there, the sky by how much of it the corner sees
 * and the sun by its cosine, and the share of that light the sun gives. The sun's SHADOW is cast live on the page: the
 * static world into its own map, fitted to the track and drawn once at load, and what moves (the karts) each frame, each
 * darkening a corner by its sun share alone (scene/live-light.js), so a shadow is the sky's soft blue, never black.
 *
 *   trackForm(faces, { light?, fit, keep? }) → { faces, form: { town }, shadows, sun }
 *     faces   the track's faces in their colours (a face may carry `normal` and `cornerNormals`; one without is given
 *             its own from its corners, which every builder winds out of the face)
 *     light   the day, linear (CHUNKY_SUN unsaid)
 *     fit     { at: [x, y, z], half } the box the static shadow map covers: the track and its venue
 *     keep    groups left as they came: lit already, casting nothing (the sky's clouds, `track:cloud`)
 *
 * Pure.
 */
import { sunLitFaces, skyAt } from '../form/sun-light.js';
import { CHUNKY_SUN } from './chunky-look.js';

export const TRACK_FORM_KEEP = Object.freeze(['track:cloud']);
const r5 = (v) => Math.round(v * 1e5) / 1e5;
function newell(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  const l = Math.hypot(...n) || 1; return n.map((v) => v / l);
}

export function trackForm(faces, { light = CHUNKY_SUN, fit, keep = TRACK_FORM_KEEP } = {}) {
  const K = new Set(keep);
  const withN = faces.map((f) => (!f || !Array.isArray(f.corners) || f.normal || K.has(f.group) ? f : { ...f, normal: newell(f.corners) }));
  // (the palette kept where it is most seen: a colour shows as the card says on a face lying flat, the way, the kerbs and
  // the verge, so a wall turned to the sun runs brighter than its paint and one turned away darker)
  const B = sunLitFaces(withN, { sun: [...light.sun], ambient: [...light.ambient], dir: [...light.dir] }, { keep: K, reference: [0, 0, 1] });
  const far = light.dir.map((v) => r5(v * 1e6));
  return {
    faces: B.faces,
    form: { town: { lights: [{ at: far, key: [...light.sun], radius: 1e9, live: true }], ambient: [...light.ambient], fall: 2, sun: { ground: skyAt([0, 0, -1], light).map(r5) }, keep: [...K], panes: [], ...(B.unreached.length ? { unreached: B.unreached } : {}) } },
    shadows: { actors: true, hour: true, fit: { at: fit.at.map(r5), half: r5(fit.half) }, noCastGroups: [...K] },
    sun: light.dir.map(r5),
  };
}
