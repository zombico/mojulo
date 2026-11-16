/**
 * THE COURSE'S SKIN — how a platforming course over a trail (a 3D platformer's: course.js lowerCourse) is drawn, so its
 * floors and stairs read as part of the place rather than as grey boxes. The side strip skins its course in the cube's
 * layers (era/geocube-side.js); this is the same reading for a course in the round, made of the level's own blocks:
 *
 *   a TERRAIN run   a floor the hero runs on: a turf cap over a dirt band over rock, in the colours of THE LAND IT
 *                   STANDS ON (the stage's own kit palette: its grass, its soil, its rock), so a floor is a piece of
 *                   that land lifted up
 *   a BUILT run     the stairs, and a floor reached up a wall: masonry in the colours of A GEOCUBE (its stone; a floor
 *                   wears a trim cornice over it, a stair is stone alone)
 *
 * WHICH CUBE the built parts are drawn in is read from what the level needs, never asked for twice: the level's own
 * `style.geocube`, else the world's, else the cube that is made for the kit the stage stands on (GEOCUBE_PRESETS, its
 * `outside.base`), else the meadow's valley (the side strip's own default). A world that names a cube restyles its
 * course's masonry with everything else.
 *
 *   SKIN                          the bands' measures (the strip's: geocube-side.js SIDE)
 *   courseCube(G, stage)          → { cube, from: 'level' | 'world' | 'kit' | 'default' }
 *   courseColours(stage, cube, from?) → { turf, dirt, rock, stone, trim }: each [r, g, b] 0 to 1; the land's from the
 *                                 cube's own outside where the level or the world names the cube (it paints the land)
 *   skinCourse(lowered, plan, colours) → the course's block asks, one a band ({ blocks, course: false, value, tint }):
 *                                 every box cut into its bands by height; its top, its sides and its footprint are the
 *                                 box's own, so the hero stands where it stood and the course's laws hold as built
 *
 * Pure: the same course and the same colours make the same blocks.
 */
import { GEOCUBE_PRESETS, readGeocube, geocubeRamps, lowerGeocube } from '../era/geocube.js';
import { SIDE_CUBE } from '../era/geocube-side.js';
import { outTrailStyle } from '../era/out-trail-board.js';

export const SKIN = Object.freeze({ cap: 0.24, dirt: 0.62, cornice: 0.2 });
const r3 = (v) => Math.round(v * 1000) / 1000;
const unit = (c) => c.map((v) => Math.round((v / 255) * 1e4) / 1e4);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mid = (ramp, t) => ramp[Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1)))];
const cubeName = (c) => (typeof c === 'string' ? c : c && typeof c === 'object' ? c.from ?? null : null);

/** The cube a course's masonry is drawn in, and where the choice came from (the header). */
export function courseCube(G, stage) {
  const own = G.levels?.[stage.level]?.style?.geocube;
  if (own !== undefined) return { cube: own, from: 'level' };
  if (G.style?.geocube !== undefined) return { cube: G.style.geocube, from: 'world' };
  const kit = typeof stage.manifest?.kit === 'string' ? stage.manifest.kit : null;
  if (kit) {
    // (the strip's own default first where it is made for this kit, so a meadow's course is the same in both dimensions)
    const made = [SIDE_CUBE, ...Object.keys(GEOCUBE_PRESETS)].find((id) => GEOCUBE_PRESETS[id]?.outside?.base === kit);
    if (made) return { cube: made, from: 'kit' };
  }
  return { cube: SIDE_CUBE, from: 'default' };
}

/** The colours a course is skinned in: the land's from the stage's own kit, the masonry's from the cube. */
export function courseColours(stage, cube, from = 'kit') {
  let C;
  try { C = readGeocube(cube); } catch { C = readGeocube(cubeName(cube) && GEOCUBE_PRESETS[cubeName(cube)] ? cubeName(cube) : SIDE_CUBE); }
  const R = geocubeRamps(C);
  // THE LAND'S COLOURS: where the level or the world names the cube, the cube PAINTS the land the stage stands on, so
  // the land's palette is the cube's own outside (as the side strip reads it); else the stage's own kit, as it is drawn
  const painted = from === 'level' || from === 'world';
  const P = outTrailStyle(painted ? { kit: lowerGeocube(C, 'outside').kit } : stage.manifest).st.palette;
  // (the trim a stop lighter than the stone: a cornice is the lit edge of the masonry under it, whatever hue a solved
  // palette gives it)
  return { turf: unit(mid(P.grass, 0.5)), dirt: unit(mid(P.soil, 0.5)), rock: unit(mid(P.rock, 0.6)), stone: unit(hex(mid(R.stone, 0.5))), trim: unit(hex(mid(R.trim, 0.75))) };
}

/** The course's blocks, cut into bands and coloured (the header). */
export function skinCourse(lowered, plan, colours) {
  const src = lowered.blocks[0], B = src.blocks, P = lowered.parts, value = src.value ?? 0.58;
  const bands = { turf: [], dirt: [], rock: [], trim: [], stone: [] };
  const cut = (b, z0, z1) => ({ min: [b.min[0], b.min[1], r3(z0)], max: [b.max[0], b.max[1], r3(z1)] });
  B.forEach((b, k) => {
    const p = P[k] ?? {}, top = b.max[2], lo = b.min[2];
    const built = !!p.stair || (p.floor > 0 && plan.gaps[p.floor - 1]?.kind === 'wall');
    // (the bands from the top down, each cut short where the box ends; a box thinner than its cap is all cap)
    // (a stair is stone alone: a tread is about as tall as a cornice, so a cornice on each would be all there is to see)
    const layers = p.stair ? [['stone', Infinity]] : built ? [['trim', SKIN.cornice], ['stone', Infinity]] : [['turf', SKIN.cap], ['dirt', SKIN.dirt], ['rock', Infinity]];
    let z = top;
    for (const [name, h] of layers) {
      if (z - lo < 1e-6) break;
      const z0 = Math.max(lo, z - h);
      bands[name].push(cut(b, z0, z));
      z = z0;
    }
  });
  // (the lit bands a little lighter than the body under them: a top reads against its side)
  const VALUE = { turf: value + 0.06, dirt: value, rock: value - 0.04, trim: value + 0.08, stone: value };
  return Object.entries(bands).filter(([, blocks]) => blocks.length).map(([name, blocks]) => ({ blocks, course: false, value: r3(VALUE[name]), tint: colours[name === 'rock' ? 'rock' : name] }));
}
