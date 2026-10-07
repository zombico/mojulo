/**
 * LAWS — the sixth-gen principles, counted. Every principle a style card states (its own, its night's, its decay's)
 * is mapped here to the shared LAWS it is an instance of, and every law to the LAYER that has to carry it when the
 * look leaves the stage kind:
 *
 *  - look         light, value, palette, air, sky: what a render or bake can apply to any scene
 *  - surface      materials, tiles, blends, cards, density: what a scene's surfaces must be built to take
 *  - composition  focus, subject line, distinctness, clusters, causes: where things go — the scene planner's job
 *  - dressing     a kit's own set pieces: built by that kit only
 *
 * The era card and the builder carry laws no style card states (vertex density, texel density, baked light, the
 * readout frame, the cast reading denser than the world); they are listed with `era: true`.
 *
 * A style card that gains a principle without a mapping here fails laws.test.js: nothing a template was built on is
 * left uncounted when a look is applied somewhere new. Data only; nothing here draws.
 */
import { DELFINO_PLAZA } from './style/delfino-plaza.js';
import { GOTHIC_NAVE } from './style/gothic-nave.js';
import { RESEARCH_LAB } from './style/research-lab.js';
import { NATURE_TRAIL } from './style/nature-trail.js';
import { JUNGLE_MGS3 } from './style/jungle-mgs3.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';
import { ISEKAI_BAMBOO } from './style/isekai-bamboo.js';
import { ISEKAI_SAKURA } from './style/isekai-sakura.js';
import { CRYPT } from './style/crypt.js';
import { CATACOMB } from './style/catacomb.js';

export const LAYERS = Object.freeze(['look', 'surface', 'composition', 'dressing']);

export const LAWS = Object.freeze({
  // look
  'value-order': { layer: 'look', law: 'A stated value order, brightest first, kept as baked colour × tile mean.' },
  'shade-is-colour': { layer: 'look', law: 'Shade is a colour, cool and pale, never black.' },
  'baked-light': { layer: 'look', era: true, law: 'World light is baked into the vertices: one key, a fill, cast shadows, placed lights as pools.' },
  'light-through': { layer: 'look', law: 'Light comes through things (windows, canopy, leaves) and lands as pools and dapples.' },
  'locked-palette': { layer: 'look', law: 'A limited palette and one small accent; a grade holds it.' },
  'pixel-lock': { layer: 'look', law: 'Colour only from a ramp\'s stops; light picks the lit or the shade stop.' },
  'depth-by-air': { layer: 'look', law: 'Depth by atmosphere: far fades to the fog; far layers are flat silhouettes.' },
  'sky-is-a-place': { layer: 'look', law: 'The sky has weather and landmarks, lit by the same sun.' },
  // surface
  'vertex-density': { layer: 'surface', era: true, law: 'Every surface is split so light has corners to land on.' },
  'texel-density': { layer: 'surface', era: true, law: 'Small painted tiles at the era\'s density, about a texel per pixel near the camera.' },
  'materials-by-layer': { layer: 'surface', law: 'Floor, junction, wall and ceiling are different materials and values; the floor never takes the walls\' grid.' },
  'material-by-slope': { layer: 'surface', law: 'Slope decides material: flat is grass, steep is rock, scree at the foot.' },
  'blend-by-cause': { layer: 'surface', law: 'Two tiles blended per vertex where water, feet, sand or moss have been; never a seam.' },
  'detail-in-tile': { layer: 'surface', law: 'Big shapes in geometry, detail in the texture.' },
  'cutout-cards': { layer: 'surface', law: 'Foliage and soft dressing are painted cutout cards, never boxes or blobs.' },
  // composition
  'focus': { layer: 'composition', law: 'One set piece or scale break holds the focus.' },
  'subject-line': { layer: 'composition', law: 'The way forward is the subject line: the brightest, warmest value, and it leads the eye.' },
  'distinct-radius': { layer: 'composition', law: 'Distinct inside the radius, repetition outside it.' },
  'big-shapes': { layer: 'composition', law: 'Big shapes first, faceted, never smooth; the ground is never flat.' },
  'clusters': { layer: 'composition', law: 'Things come in clusters with gaps, never an even scatter.' },
  'layered-depth': { layer: 'composition', law: 'Layers at every depth, revealed in rings out from the way.' },
  'by-cause': { layer: 'composition', law: 'Everything placed or messy has a cause it can be traced to.' },
  'arches-and-rounds': { layer: 'composition', law: 'Curves break the grid: openings arched, ceilings vaulted, things turned round; a level is never only boxes (the voxel read).' },
  'repeat-adjacent': { layer: 'composition', law: 'Adjacent bare walls share a repeating design element.' },
  'accent-wall': { layer: 'composition', law: 'One accent wall breaks the repeat and carries the eye.' },
  'corner-things': { layer: 'composition', law: 'Things gather where floor meets wall: clusters in corners, singles at wall bases, off the way.' },
  'cast-over-world': { layer: 'composition', era: true, law: 'The cast reads denser on screen than the world behind it.' },
  'frame-readout': { layer: 'composition', era: true, law: 'Detail is read at the era\'s frame (640×448), not at today\'s.' },
  // dressing
  'kit-dressing': { layer: 'dressing', law: 'A kit\'s own set pieces.' },
});

/** Each style card's principles, in order, as the laws they are instances of. */
export const PRINCIPLE_LAWS = Object.freeze({
  crypt: [['value-order', 'light-through'], ['focus', 'kit-dressing'], ['materials-by-layer'], ['blend-by-cause'], ['cutout-cards', 'by-cause'], ['distinct-radius'],
    ['repeat-adjacent'], ['accent-wall', 'focus'], ['corner-things', 'clusters', 'distinct-radius', 'by-cause'], ['arches-and-rounds', 'big-shapes']],
  catacomb: [['value-order', 'light-through'], ['focus', 'kit-dressing'], ['materials-by-layer'], ['arches-and-rounds', 'big-shapes'], ['repeat-adjacent'],
    ['accent-wall', 'focus', 'kit-dressing'], ['blend-by-cause'], ['cutout-cards', 'by-cause', 'distinct-radius'], ['corner-things', 'clusters', 'distinct-radius', 'by-cause']],
  'delfino-plaza': [['value-order', 'shade-is-colour'], ['focus', 'kit-dressing'], ['materials-by-layer'], ['blend-by-cause'], ['cutout-cards'], ['depth-by-air'], ['distinct-radius'], ['kit-dressing'], ['kit-dressing'], ['focus', 'kit-dressing'], ['kit-dressing'], ['sky-is-a-place']],
  'delfino-plaza/night': [['baked-light', 'shade-is-colour'], ['value-order', 'baked-light'], ['focus'], ['distinct-radius', 'by-cause'], ['sky-is-a-place']],
  'gothic-nave': [['value-order'], ['light-through'], ['blend-by-cause'], ['cutout-cards', 'by-cause'], ['focus'], ['distinct-radius'], ['materials-by-layer'], ['materials-by-layer']],
  'research-lab': [['materials-by-layer', 'value-order'], ['focus'], ['baked-light', 'locked-palette'], ['by-cause', 'distinct-radius'], ['blend-by-cause']],
  'research-lab/decay': [['by-cause'], ['baked-light', 'value-order'], ['by-cause'], ['focus']],
  'nature-trail': [['big-shapes', 'detail-in-tile'], ['big-shapes'], ['material-by-slope'], ['subject-line'], ['value-order'], ['clusters'], ['locked-palette'], ['baked-light'], ['depth-by-air'], ['sky-is-a-place'], ['blend-by-cause', 'by-cause'], ['distinct-radius'], ['blend-by-cause'], ['cutout-cards'], ['big-shapes']],
  'jungle-mgs3': [['subject-line'], ['layered-depth'], ['cutout-cards'], ['layered-depth', 'distinct-radius'], ['light-through'], ['value-order'], ['by-cause'], ['locked-palette'], ['depth-by-air'], ['focus'], ['blend-by-cause'], ['big-shapes'], ['detail-in-tile'], ['cutout-cards'], ['detail-in-tile']],
  'isekai-meadow': [['locked-palette', 'pixel-lock'], ['pixel-lock'], ['shade-is-colour'], ['kit-dressing'], ['big-shapes'], ['value-order'], ['depth-by-air'], ['sky-is-a-place', 'pixel-lock']],
  'isekai-bamboo': [['clusters'], ['pixel-lock', 'kit-dressing'], ['light-through', 'cutout-cards'], ['locked-palette', 'subject-line']],
  'isekai-sakura': [['focus', 'pixel-lock'], ['kit-dressing'], ['by-cause', 'pixel-lock'], ['locked-palette']],
});

/** Every principle a style card states, keyed as PRINCIPLE_LAWS keys them: the card's own, its night's, its decay's. */
export function statedPrinciples() {
  const out = {};
  for (const S of [CRYPT, CATACOMB, DELFINO_PLAZA, GOTHIC_NAVE, RESEARCH_LAB, NATURE_TRAIL, JUNGLE_MGS3, ISEKAI_MEADOW, ISEKAI_BAMBOO, ISEKAI_SAKURA]) {
    out[S.id] = S.principles;
    if (S.night?.principles) out[`${S.id}/night`] = S.night.principles;
    if (S.decay?.principles) out[`${S.id}/decay`] = S.decay.principles;
  }
  return out;
}

/** The ledger: each law with its layer and every principle that states it (`card#index`). */
export function lawLedger() {
  const ledger = Object.fromEntries(Object.entries(LAWS).map(([id, L]) => [id, { ...L, stated: [] }]));
  for (const [card, rows] of Object.entries(PRINCIPLE_LAWS)) rows.forEach((laws, i) => { for (const l of laws) ledger[l].stated.push(`${card}#${i}`); });
  return ledger;
}
