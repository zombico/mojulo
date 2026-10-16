/**
 * AUTHORING TIME — where a palette's seed is rolled and stored, the way a stage's `art` is (era/art-direction.js): the
 * build only ever reads what is stored, so a recipe re-renders the same forever.
 *
 *   stampWorldPalette(manifest, prior, fresh) → a gameworld manifest with its `style.palette` settled:
 *     'auto', or a spec with no seed      → the seed rolled here
 *     false                               → left: the kit's own colours
 *     nothing, a geocube named, not a quick game: the cube's palette (an edit keeps the one the world had)
 *     nothing, and no kit, look or geocube named, not a quick game:
 *       a NEW world                       → a palette rolled for it (the silent meadow default retired)
 *       an edit of a world that had one   → the one it had (a recipe re-sent whole keeps its colours)
 *       an edit of a world made before   → left as it was (an old world never changes colour by being edited)
 *   stampInteriorPalette(manifest, prior, fresh) → an interior's `palette`, by the same rules (a style named is a name)
 *   resolveArtPalette(manifest, fresh) → a room stage whose `art.palette` is { from: spec } given its ramps, solved
 *   resolveTonePalette(manifest, fresh) → a stage whose `tone` is { preset?, from: spec } given the preset's ramps, solved
 *   stampLookPalette(manifest, fresh) → a world whose `look.palette` has no seed given one
 *   stampTerrainPalette(manifest, fresh) → a terrain world whose `palette` has no seed given one
 *   resolveStagePalette(manifest, fresh) → a nature or jungle stage's `palette` spec solved into the data its builder reads
 *   stampGeocubes(manifest, prior, fresh) → every geocube the recipe names (a key `geocube`, or a geocube world's
 *     `cube`) given its palette's seed: the color theorist decides a cube's colours (era/geocube.js). A preset id
 *     becomes { from, palette: { …its character (GEOCUBE_PALETTES), seed } }, the spec it is solved from; a cube
 *     re-sent as it was before it was stamped keeps the seed it was given; a cube an edit leaves as it was is left
 *     (a recipe minted before keeps its colours); palette false is the cube's own colours
 *   freshPaletteSeed(spec)  → a seed for the spec, the farthest of a few from the palettes written lately (ledger.js)
 *
 * `fresh(spec)` is injectable for tests.
 */
import { readPaletteSpec, solvePalette } from './solve.js';
import { novelSeed } from './ledger.js';
import { artPalette, toneRamps, natureColours } from './adapters.js';
import { stageKit } from '../era/stage.js';
import { TONE_PRESETS } from '../era/tone.js';
import { GEOCUBE_PRESETS, GEOCUBE_PALETTES, seededPalette } from '../era/geocube.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** A seed for a spec, rolled at authoring time, looking away from the palettes written lately (ledger.js). */
export const freshPaletteSeed = (spec = {}) => novelSeed(spec);
const withPalette = (m, palette) => ({ ...m, style: { ...(m.style ?? {}), palette } });

/** An interior's `palette` at authoring time, by the same rules: rolled for a new room that names no style, kept by an
 * edit, never given to a room made before. */
export function stampInteriorPalette(manifest, prior = null, fresh = freshPaletteSeed) {
  if (!isObj(manifest) || manifest.kind !== 'interior') return manifest;
  const p = manifest.palette;
  if (p === 'auto' || (isObj(p) && p.seed === undefined)) { const q = isObj(p) ? p : {}; return { ...manifest, palette: { ...q, seed: fresh(q) } }; }
  if (p !== undefined || manifest.style !== undefined) return manifest;
  if (prior) return prior.palette !== undefined ? { ...manifest, palette: prior.palette } : manifest;
  return { ...manifest, palette: { seed: fresh({}) } };
}

export function stampWorldPalette(manifest, prior = null, fresh = freshPaletteSeed) {
  if (!isObj(manifest)) return manifest;
  const st = isObj(manifest.style) ? manifest.style : {}, p = st.palette;
  if (p === 'auto' || (isObj(p) && p.seed === undefined)) { const q = isObj(p) ? p : {}; return withPalette(manifest, { ...q, seed: fresh(q) }); }
  if (p !== undefined) return manifest;
  // a world on a cube: the cube's palette (stampGeocubes seeds it first) is the world's, so its HUD, cover and bible are
  // the cube's colours, and every level's cube is solved from it (gameworld/world.js cubeInPalette). An edit keeps the
  // palette the world had; a world made before with the same cube is left as it was
  if (st.geocube !== undefined && manifest.quick === undefined) {
    if (prior?.style?.palette !== undefined) return withPalette(manifest, prior.style.palette);
    if (prior && JSON.stringify(prior.style?.geocube) === JSON.stringify(st.geocube)) return manifest;
    return isObj(st.geocube) && seededPalette(st.geocube.palette) ? withPalette(manifest, st.geocube.palette) : manifest;
  }
  if (manifest.quick !== undefined || st.kit !== undefined || st.look !== undefined) return manifest;
  if (prior) return prior.style?.palette !== undefined ? withPalette(manifest, prior.style.palette) : manifest;
  return withPalette(manifest, { seed: fresh({}) });
}

/** A room stage's art palette from a palette spec (`art: { palette: { from: spec } }`, the other items rolled as ever by
 * resolveArt): solved here, at authoring time, and stored as the numbers the build reads, with what it came from. */
export function resolveArtPalette(manifest, fresh = freshPaletteSeed) {
  const P = isObj(manifest) && manifest.kind === 'stage' && isObj(manifest.art) ? manifest.art.palette : undefined;
  if (!isObj(P) || P.from === undefined || Array.isArray(P.stone)) return manifest;
  let spec = readPaletteSpec(P.from, 'art.palette.from');
  if (spec === false) throw new Error("stage: art.palette.from is a palette spec (pick_palette's), or 'auto'");
  if (spec === 'auto') spec = {};
  if (spec.seed === undefined) spec = { ...spec, seed: fresh(spec) };
  const K = solvePalette(spec);
  return { ...manifest, art: { ...manifest.art, palette: { seed: spec.seed, from: K.spec, ...artPalette(K) } } };
}

/** A stage's tone from a palette spec (`tone: { preset?, from: spec, …its own fields }`): the preset's ramps (flat's when
 * none is named) solved here, at authoring time, and stored as hex with the palette's id; its `key` from the palette's
 * unless the tone names its own. A tone already solved (it carries `palette`) is left as stored. */
export function resolveTonePalette(manifest, fresh = freshPaletteSeed) {
  const T = isObj(manifest) && manifest.kind === 'stage' ? manifest.tone : undefined;
  if (!isObj(T) || T.from === undefined || typeof T.palette === 'string') return manifest;
  const preset = T.preset ?? 'flat';
  if (!TONE_PRESETS[preset]) throw new Error(`stage: tone.preset is one of ${Object.keys(TONE_PRESETS).join(', ')}`);
  let spec = readPaletteSpec(T.from, 'tone.from');
  if (spec === false) throw new Error("stage: tone.from is a palette spec (pick_palette's), or 'auto'");
  if (spec === 'auto') spec = {};
  if (spec.seed === undefined) spec = { ...spec, seed: fresh(spec) };
  const K = solvePalette(spec), { ramps, key } = toneRamps(K, Object.keys(TONE_PRESETS[preset].ramps));
  return { ...manifest, tone: { ...T, preset, from: K.spec, palette: K.id, ramps: { ...ramps, ...(T.ramps ?? {}) }, key: T.key ?? key } };
}

/** A world's sixth-gen look recoloured by a palette (`look: { id, palette }`): its seed rolled here when it has none. */
export function stampLookPalette(manifest, fresh = freshPaletteSeed) {
  const L = isObj(manifest) ? manifest.look : undefined, p = isObj(L) ? L.palette : undefined;
  if (!(p === 'auto' || (isObj(p) && p.seed === undefined))) return manifest;
  const q = isObj(p) ? p : {};
  return { ...manifest, look: { ...L, palette: { ...q, seed: fresh(q) } } };
}

/** A terrain world's palette (`kind: 'terrain'`, `palette`): its seed rolled here when it has none. Opt-in: a terrain
 * world's colours are its painting's (or its climate's) unless it names a palette. */
export function stampTerrainPalette(manifest, fresh = freshPaletteSeed) {
  if (!isObj(manifest) || manifest.kind !== 'terrain') return manifest;
  const p = manifest.palette;
  if (!(p === 'auto' || (isObj(p) && p.seed === undefined))) return manifest;
  const q = isObj(p) ? p : {};
  return { ...manifest, palette: { ...q, seed: fresh(q) } };
}

/** A nature or jungle stage's `palette` (a pick_palette spec): solved here, at authoring time, into the data its builder
 * reads (color-theorist/recolour.js), with what it came from. A palette already solved (it carries `roles`) is left. */
export function resolveStagePalette(manifest, fresh = freshPaletteSeed) {
  if (!isObj(manifest) || manifest.kind !== 'stage' || manifest.palette === undefined || manifest.palette === false) return manifest;
  if (isObj(manifest.palette) && isObj(manifest.palette.roles)) return manifest;
  if (!['nature', 'jungle'].includes(stageKit(manifest.kit)?.shell)) throw new Error(`stage: palette is for the open-ground kits painted by their cards (trail-valley, jungle-trail); a room kit takes art: { palette: { from } } or tone: { from }, an isekai kit a gameworld's style.palette`);
  let spec = readPaletteSpec(isObj(manifest.palette) && manifest.palette.from !== undefined ? manifest.palette.from : manifest.palette, 'palette');
  if (spec === 'auto') spec = {};
  if (spec.seed === undefined) spec = { ...spec, seed: fresh(spec) };
  const K = solvePalette(spec);
  return { ...manifest, palette: { from: K.spec, ...natureColours(K) } };
}

// a value that is a cube: a preset id, { from, … }, or a document (it says its light)
const isCube = (v) => (typeof v === 'string' && GEOCUBE_PRESETS[v] !== undefined) || (isObj(v) && (v.from !== undefined || isObj(v.light)));
// a cube as it was written before its stamp: the seed and the preset's character taken off its palette, an empty
// palette dropped, a bare preset its id; 'auto' is the same ask as no palette
function unstamped(v) {
  if (!isObj(v)) return v;
  const intent = (v.from !== undefined && GEOCUBE_PALETTES[v.from]) || {};
  const { palette, ...rest } = v, p = isObj(palette) ? Object.fromEntries(Object.entries(palette).filter(([k, x]) => k !== 'seed' && !same(x, intent[k]))) : palette;
  const out = p === undefined || p === 'auto' || (isObj(p) && !Object.keys(p).length) ? rest : { ...rest, palette: p };
  return Object.keys(out).length === 1 && typeof out.from === 'string' ? out.from : out;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** One cube at authoring time, against what stood at its place before (`was`). */
function stampCube(v, was, fresh) {
  if (!isCube(v)) return v;
  if (was !== undefined && same(v, was)) return v;                       // left as it was by the edit
  const cube = typeof v === 'string' ? { from: v } : v, p = cube.palette;
  if (p === false || seededPalette(p)) return v;                         // a seed written (or a new one) is kept
  if (was !== undefined && seededPalette(was?.palette) && same(unstamped(v), unstamped(was))) return was;   // re-sent
  const intent = cube.from !== undefined ? GEOCUBE_PALETTES[cube.from] ?? {} : {}, q = isObj(p) ? p : {};
  return { ...cube, palette: { ...intent, ...q, seed: fresh({ ...intent, ...q }) } };
}
export function stampGeocubes(manifest, prior = null, fresh = freshPaletteSeed) {
  const walk = (v, was) => {
    if (Array.isArray(v)) return v.map((x, i) => walk(x, Array.isArray(was) ? was[i] : undefined));
    if (!isObj(v)) return v;
    let changed = false;
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const w = isObj(was) ? was[k] : undefined;
      const y = k === 'geocube' || (k === 'cube' && v.kind === 'geocube') ? stampCube(x, w, fresh) : walk(x, w);
      if (y !== x) changed = true;
      out[k] = y;
    }
    return changed ? out : v;
  };
  return walk(manifest, prior ?? undefined);
}
