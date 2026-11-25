/**
 * THE SCROLL STAGE'S SPACE (Blaze Gunner): the side map's five layers (docs/side-map-principles.md "The look") read for
 * space. Play is one plane (frame.js); what stands off it parallaxes under the perspective camera for nothing:
 *
 *   dust     the FOREGROUND, in front of the plane: faint motes drawn long along the scroll, sliding past fastest; dim,
 *            so they never read as rounds
 *   (the play plane: the ships, the rounds; nothing here)
 *   near     stars a camera's distance behind the plane, the brightest, sliding at half the play's pace
 *   mid      stars three distances back
 *   far      stars eight distances back, the faintest and most
 *   hulls    capital ships off the fleet (fleet/), laid in profile at their depth, hazed toward the void by it: a fleet
 *            going by behind the fight
 *   (the sky: the space map's backdrop at infinity, its nebula, planets and far star, and its stars; the page's)
 *
 * Each layer back is quieter and nearer the void (the side map's rule), and a layer is laid only where the camera sees it
 * as it is carried down its track: the screen at its depth, grown by `(dist − d) / dist` (frame.js layerGrowth), swept
 * along the centres the track passes (what is never seen is never built). A star's size and a layer's density are set as
 * the frame shows them (a share of the screen across, a count a screen seen), so every layer reads at its own grain
 * however deep it stands.
 *
 *   SPACE_LAYERS           the star and dust layers (a new layer is a row): { depth (in camera distances: + in front,
 *                          − behind), per (a screen seen), size [min, max] (shares of the screen across), stretch (along
 *                          the scroll), bright [min, max] (toward the void at 0), tints }
 *   SPACE_VOID             the void's colour (the page's background)
 *   layerSpan(cam, extent, d) → { u: [u0, u1], v: [v0, v1] }: what the camera sees at depth d over the track's centres
 *   layScrollSpace(cam, extent, { seed?, layers? }) → { faces, report: { [layer]: count } }
 *   hazeHulls(faces, cam, d) → the faces, each fill mixed toward the void by its depth
 *
 * Pure: seeded dice (city/plan/dice.js streamOf, a stream a layer), the same stage the same sky.
 */
import { toWorld, layerGrowth, SCROLL_VIEWS } from './frame.js';
import { streamOf } from '../../city/plan/dice.js';

export const SPACE_VOID = '#03040a';
const L = (o) => Object.freeze({ ...o, size: Object.freeze(o.size), bright: Object.freeze(o.bright), tints: Object.freeze(o.tints) });
const STARS = ['#ffffff', '#d4e2ff', '#fff3dc', '#ffd9bb', '#c3d6ff'];
export const SPACE_LAYERS = Object.freeze({
  dust: L({ depth: 0.35, per: 12, size: [0.0016, 0.0028], stretch: 5, bright: [0.16, 0.26], tints: ['#9aa6bb', '#b5aea2'] }),
  near: L({ depth: -1, per: 22, size: [0.0034, 0.0056], stretch: 1, bright: [0.75, 1], tints: STARS }),
  mid: L({ depth: -3, per: 48, size: [0.0024, 0.0036], stretch: 1, bright: [0.45, 0.75], tints: STARS }),
  far: L({ depth: -8, per: 110, size: [0.0016, 0.0024], stretch: 1, bright: [0.22, 0.48], tints: STARS }),
});
export const SPACE_LAYER_IDS = Object.freeze(Object.keys(SPACE_LAYERS));

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** a colour mixed toward the void: k 1 the colour, 0 the void */
const toward = (hex, k) => { const a = hexRgb(hex), v = hexRgb(SPACE_VOID); return rgbHex(a.map((x, i) => v[i] + (x - v[i]) * k)); };
const r3 = (v) => Math.round(v * 1000) / 1000;

/** What the camera sees at depth d (metres; + in front of the plane) as its centre sweeps the track's extent. */
export function layerSpan(cam, extent, d) {
  const g = layerGrowth(cam, d), S = cam.screen;
  return { u: [extent.u[0] - (g * S.along) / 2, extent.u[1] + (g * S.along) / 2], v: [extent.v[0] - (g * S.across) / 2, extent.v[1] + (g * S.across) / 2] };
}

/** The star and dust layers over the track's extent (the centres it passes: frame.js trackExtent), as faces square to the
 * camera, each layer its own group (`space:<layer>`). */
export function layScrollSpace(cam, extent, { seed = 1, layers = SPACE_LAYER_IDS } = {}) {
  const V = SCROLL_VIEWS[cam.view], faces = [], report = {};
  for (const id of layers) {
    const Y = SPACE_LAYERS[id];
    if (!Y) throw new Error(`scroll stage: '${id}' is not a space layer (${SPACE_LAYER_IDS.join(', ')})`);
    const d = Y.depth * cam.dist, g = layerGrowth(cam, d), span = layerSpan(cam, extent, d);
    // (as many as `per` a screen seen at this depth: the layer's area over the screen's, grown)
    const seen = ((span.u[1] - span.u[0]) * (span.v[1] - span.v[0])) / (g * g * cam.screen.along * cam.screen.across);
    const n = Math.round(Y.per * seen), die = streamOf(seed, 'scroll-space', id);
    for (let i = 0; i < n; i++) {
      const u = span.u[0] + die() * (span.u[1] - span.u[0]), v = span.v[0] + die() * (span.v[1] - span.v[0]);
      const h = ((Y.size[0] + die() * (Y.size[1] - Y.size[0])) * cam.screen.across * g) / 2, hu = h * Y.stretch;
      const fill = toward(Y.tints[Math.floor(die() * Y.tints.length)], Y.bright[0] + die() * (Y.bright[1] - Y.bright[0]));
      const corners = [[u - hu, v - h], [u + hu, v - h], [u + hu, v + h], [u - hu, v + h]].map(([a, b]) => toWorld(cam.view, [a, b, d]).map(r3));
      faces.push({ corners, normal: [...V.toward], fill, group: `space:${id}` });
    }
    report[id] = n;
  }
  return { faces, report };
}

/** A hull laid at depth d hazed toward the void by it: the side map's vista rule (each layer back quieter and nearer the
 * sky), its share kept `1 / (1 + haze · (growth − 1))`. */
export function hazeHulls(faces, cam, d, { haze = 0.5 } = {}) {
  const k = 1 / (1 + haze * Math.max(0, layerGrowth(cam, d) - 1));
  return faces.map((f) => (typeof f.fill === 'string' && /^#[0-9a-f]{6}$/i.test(f.fill) ? { ...f, fill: toward(f.fill, k) } : f));
}
