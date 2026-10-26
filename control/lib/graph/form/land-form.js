/**
 * THE LAND IN THE FORM RENDER (gen-7, era/eras.js): a land's faces read as material, never light. A gen-6 face's fill
 * holds the light (the isekai land's stepped shading is cel bands of a painted sun); its group says what it is. Here the
 * group is read and the fill is not: a face's base colour is the cube's colour for its class with a small seeded tone,
 * its roughness the class's, and the renderer lights it.
 *
 *   landForm(faces, colour, { seed?, wetBand? }) → { faces: [{ cls, base: [r, g, b] (0–255), rough, wet, under }], waterZ,
 *       deep: [r, g, b], unread }
 *       faces: a payload's faces (`group` 'isekai:<class>', `corners`); colour: the cube's key colours (era/geocube.js
 *       `colour`: stone, grass, sand, water, floor). A face of a group with no class keeps its fill (cls null) and is
 *       counted in `unread`. Sand within `wetBand` metres above the water's line is WET: darker, and glossy (its
 *       roughness, not its paint); sand wholly under the line (the shallows' floor, seen through the sea) is wet and `under`,
 *       fading with its depth to `deep`, the colour of deep water (the sea's colour darkened), which open sea shows too.
 *       A face's tone wanders smoothly over the ground (a few metres to a swing), not face by face.
 *
 * Nothing here reads a sun: the same faces and colours give the same material whatever the hour. Pure, seeded.
 */
import { hexToRgb } from '../color-theorist/oklab.js';
import { strHash } from '../city/plan/dice.js';

/** A class: the cube colour it takes, its roughness, its tone (× the colour) and how far a face's tone may wander. */
export const LAND_CLASSES = Object.freeze({
  sand: { colour: 'sand', rough: 0.95, tone: 1, vary: 0.04 },
  ground: { colour: 'grass', rough: 0.9, tone: 1, vary: 0.07 },
  cliff: { colour: 'stone', rough: 0.85, tone: 0.92, vary: 0.06 },
  rock: { colour: 'stone', rough: 0.8, tone: 0.8, vary: 0.08 },
  trail: { colour: 'floor', rough: 0.9, tone: 1, vary: 0.04 },
  water: { colour: 'water', rough: 0.06, tone: 1, vary: 0 },
});
/** Wet sand: how high above the water's line, its colour (× dry) and its roughness. */
export const WET_BAND = 0.3, WET_TONE = 0.68, WET_ROUGH = 0.25;
/** Sand under the sea: its colour (× dry), lighter than the wet line's (the sea over it, not a film of water, darkens it). */
export const UNDER_TONE = 0.9;
/** Deep water: its colour (× the sea's) and the depth (metres under the line) at which the shallows' floor is lost in it. */
export const DEEP_TONE = 0.4, DEEP_FADE = 3;
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
  for (const c of new Set(Object.values(LAND_CLASSES).map((C) => C.colour))) if (!/^#[0-9a-f]{6}$/i.test(colour?.[c] || '')) throw new Error(`land-form: colour.${c} is a #rrggbb (the cube's key colours)`);
  const water = faces.filter((f) => clsOf(f.group) === 'water').map((f) => f.corners[0][2]).sort((a, b) => a - b);
  const waterZ = water.length ? water[water.length >> 1] : null;
  const tone = toneField(seed), deep = hexToRgb(colour.water).map((v) => byte(v * DEEP_TONE));
  let unread = 0;
  const out = faces.map((f) => {
    const cls = clsOf(f.group);
    if (!cls) { unread += 1; return { cls: null }; }
    const n = f.corners.length, mid = [0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / n);
    const C = LAND_CLASSES[cls], t = C.tone * (1 + C.vary * tone(mid[0], mid[1]));
    const zs = f.corners.map((c) => c[2]), under = cls === 'sand' && waterZ !== null && Math.max(...zs) <= waterZ;
    const wet = under || (cls === 'sand' && waterZ !== null && Math.min(...zs) < waterZ + wetBand);
    const k = t * (under ? UNDER_TONE : wet ? WET_TONE : 1), lost = under ? Math.min(1, (waterZ - mid[2]) / DEEP_FADE) : 0;
    const base = hexToRgb(colour[C.colour]).map((v, c) => byte(v * k * (1 - lost) + deep[c] * lost));
    return { cls, base, rough: wet ? WET_ROUGH : C.rough, wet, under };
  });
  return { faces: out, waterZ, deep, unread };
}
