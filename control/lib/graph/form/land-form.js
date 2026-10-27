/**
 * THE LAND IN THE FORM RENDER (gen-7, era/eras.js): a land's faces read as material, never light. A gen-6 face's fill
 * holds the light (the isekai land's stepped shading is cel bands of a painted sun); its group says what it is. Here the
 * group is read and the fill is not: a face's base colour is the cube's colour for its class with a small seeded tone,
 * its roughness the class's, and the renderer lights it.
 *
 *   landForm(faces, colour, { seed?, wetBand? }) → { faces: [{ cls, base: [r, g, b] (0–255), rough, wet, under,
 *       corners? }], waterZ, deep: [r, g, b], unread }
 *       faces: a payload's faces (`group` 'isekai:<class>', `corners`); colour: the cube's key colours (era/geocube.js
 *       `colour`: stone, grass, sand, water, floor). A face of a group with no class keeps its fill (cls null) and is
 *       counted in `unread`. Sand within `wetBand` metres above the water's line is WET: darker, and glossy (its
 *       roughness, not its paint); sand wholly under the line (the shallows' floor, seen through the sea) is wet and `under`,
 *       fading with its depth to `deep`, the sea's own body (its colour as the cube names it, or as the light solves it):
 *       the floor is lost into the colour the deep water shows, never into a darker one, so the shallows read lighter:
 *       over the floor's own depth (the deepest it falls under the line, at least DEEP_FADE), corner by corner (`corners`:
 *       each corner's base), so the floor fades smoothly and never in the steps of its faces.
 *       A face's tone wanders smoothly over the ground (a few metres to a swing), not face by face.
 *
 * Nothing here reads a sun: the same faces and colours give the same material whatever the hour. Pure, seeded.
 */
import { hexToRgb } from '../color-theorist/oklab.js';
import { strHash } from '../city/plan/dice.js';

/** A class: the cube colour it takes, its roughness, its tone (× the colour) and how far a face's tone may wander. The
 *  colour is the palette's target (era/cube-light.js solves it into a base), so a class never re-darkens it: cliff and
 *  rock are the stone the palette names (the theorist's seen laws caught a 0.8 on the rock as stone out of order). */
export const LAND_CLASSES = Object.freeze({
  sand: { colour: 'sand', rough: 0.95, tone: 1, vary: 0.04 },
  ground: { colour: 'grass', rough: 0.9, tone: 1, vary: 0.07 },
  // a geo island's bare ground (local-meru island `cover: 'soil'`): the soil the cube names, and the scree under its cliffs
  soil: { colour: 'floor', rough: 0.95, tone: 1, vary: 0.06 },
  scree: { colour: 'stone', rough: 0.9, tone: 1, vary: 0.1 },
  cliff: { colour: 'stone', rough: 0.85, tone: 1, vary: 0.06 },
  rock: { colour: 'stone', rough: 0.8, tone: 1, vary: 0.08 },
  trail: { colour: 'floor', rough: 0.9, tone: 1, vary: 0.04 },
  water: { colour: 'water', rough: 0.06, tone: 1, vary: 0 },
  // the green over the rock: a cliff's grass lip and a boulder's mossy cap (era/isekai.js), the cube's grass
  lip: { colour: 'grass', rough: 0.9, tone: 1, vary: 0.07 },
  hat: { colour: 'grass', rough: 0.9, tone: 0.95, vary: 0.07 },
  // a trail's flora (era/isekai.js, its crowns and trunks): the cube's foliage, and its floor darkened for the bark (a
  // cube names no bark of its own)
  crown: { colour: 'foliage', rough: 0.85, tone: 1, vary: 0.08 },
  wood: { colour: 'floor', rough: 0.9, tone: 0.5, vary: 0.05 },
});
/** Wet sand: how high above the water's line, its colour (× dry) and its roughness. */
export const WET_BAND = 0.3, WET_TONE = 0.68, WET_ROUGH = 0.25;
/** Sand under the sea: its colour (× dry), lighter than the wet line's (the sea over it, not a film of water, darkens it). */
export const UNDER_TONE = 0.9;
/** Deep water: its colour (× the sea's: the sea's own body, so a floor fading into it meets the water it is seen
 *  through; a darker deep turned the shallows darker than the open sea) and the least depth (metres under the line)
 *  over which the shallows' floor is lost in it (a deeper sea fades over its own depth). */
export const DEEP_TONE = 1, DEEP_FADE = 3;
/** The tone's swing: one lattice cell, metres. */
export const TONE_CELL = 4;

// a smooth field in −1..1 over the ground: seeded values at a lattice, blended between (smoothstep)
function toneField(seed) {
  const at = (i, j) => strHash(`${seed}|land-tone-v1|${i},${j}`) / 2147483648 - 1, ease = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const u = x / TONE_CELL, v = y / TONE_CELL, i = Math.floor(u), j = Math.floor(v), s = ease(u - i), t = ease(v - j);
    return (at(i, j) * (1 - s) + at(i + 1, j) * s) * (1 - t) + (at(i, j + 1) * (1 - s) + at(i + 1, j + 1) * s) * t;
  };
}

const clsOf = (group) => { const m = /^isekai:([a-z]+)$/.exec(String(group || '')); return m && LAND_CLASSES[m[1]] ? m[1] : null; };
const byte = (v) => Math.max(0, Math.min(255, Math.round(v)));

export function landForm(faces, colour, { seed = 1, wetBand = WET_BAND } = {}) {
  // (the colours the faces' classes take: a land with no flora needs no foliage)
  for (const c of new Set(faces.map((f) => clsOf(f.group)).filter(Boolean).map((k) => LAND_CLASSES[k].colour))) if (!/^#[0-9a-f]{6}$/i.test(colour?.[c] || '')) throw new Error(`land-form: colour.${c} is a #rrggbb (the cube's key colours)`);
  const water = faces.filter((f) => clsOf(f.group) === 'water').map((f) => f.corners[0][2]).sort((a, b) => a - b);
  const waterZ = water.length ? water[water.length >> 1] : null;
  const tone = toneField(seed), deep = hexToRgb(colour.water).map((v) => byte(v * DEEP_TONE));
  // (the floor's own depth: how far the sand falls under the line, over which it is lost in deep water)
  const floorZ = waterZ === null ? 0 : Math.min(waterZ, ...faces.filter((f) => clsOf(f.group) === 'sand').flatMap((f) => f.corners.map((c) => c[2])));
  const fade = waterZ === null ? DEEP_FADE : Math.max(DEEP_FADE, waterZ - floorZ);
  let unread = 0;
  const out = faces.map((f) => {
    const cls = clsOf(f.group);
    if (!cls) { unread += 1; return { cls: null }; }
    const n = f.corners.length, mid = [0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / n);
    const C = LAND_CLASSES[cls], t = C.tone * (1 + C.vary * tone(mid[0], mid[1]));
    const zs = f.corners.map((c) => c[2]), under = cls === 'sand' && waterZ !== null && Math.max(...zs) <= waterZ;
    const wet = under || (cls === 'sand' && waterZ !== null && Math.min(...zs) < waterZ + wetBand);
    const k = t * (under ? UNDER_TONE : wet ? WET_TONE : 1), own = hexToRgb(colour[C.colour]);
    // (clear water keeps its sand until it is deep: lost by the square of the depth's share)
    const at = (z) => { const lost = under ? Math.max(0, Math.min(1, (waterZ - z) / fade)) ** 2 : 0; return own.map((v, c) => byte(v * k * (1 - lost) + (lost ? deep[c] * lost : 0))); };
    return { cls, base: at(mid[2]), rough: wet ? WET_ROUGH : C.rough, wet, under, ...(under ? { corners: zs.map(at) } : {}) };
  });
  return { faces: out, waterZ, deep, unread };
}
