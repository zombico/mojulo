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
 * The seventh generation's laws (`form: true`) are listed after them: what the form render affords that paint could
 * not, each beside the sixth-gen law it answers. A kit is measured against them by era/form-laws.js.
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
import { ALIEN_NIGHT } from './style/alien-night.js';
import { AIRLESS_PLAIN } from './style/airless-plain.js';
import { ISEKAI_GARDEN } from './style/isekai-garden.js';
import { CRYPT, CRYPT_SOBER } from './style/crypt.js';
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
  'dare-height': { layer: 'composition', law: 'Don\'t be afraid to make it tall: some space rises far over the walker, its vault lost in the dark.' },
  'motif-small': { layer: 'surface', law: 'Motifs are small: a pattern carved or painted in a band (a frieze on the plinth, the cornice), never an object.' },
  'doodads-apart': { layer: 'composition', law: 'Doodads are the large things: never two together unless gathered on purpose (a corner\'s cluster).' },
  'repeat-adjacent': { layer: 'composition', law: 'Adjacent bare walls share a repeating design element.' },
  'accent-wall': { layer: 'composition', law: 'One accent wall breaks the repeat and carries the eye.' },
  'corner-things': { layer: 'composition', law: 'Things gather where floor meets wall: clusters in corners, singles at wall bases, off the way.' },
  'cast-over-world': { layer: 'composition', era: true, law: 'The cast reads denser on screen than the world behind it.' },
  'frame-readout': { layer: 'composition', era: true, law: 'Detail is read at the era\'s frame (640×448), not at today\'s.' },
  // dressing
  'kit-dressing': { layer: 'dressing', law: 'A kit\'s own set pieces.' },
  // THE SEVENTH GENERATION'S (`form: true`): what the form render affords that paint could not. Each answers a sixth-gen
  // law that was a limit of its frame and its light, not a taste: detail sized to be read at 640×448 ('texel-density',
  // 'frame-readout'), contrast drawn into the tile because the light could not make it ('value-order' as baked colour ×
  // tile mean), shapes faceted because a curve cost vertices ('big-shapes'), shade lifted because black was a hole
  // ('shade-is-colour'). The composition laws (focus, repeat, accent, corners, causes, height) hold in both eras.
  'built-scale': { layer: 'surface', form: true, law: 'An element is the size it is built at (a course, a slab, a board), read at today\'s frame; nothing is enlarged to be read small.' },
  'relief-is-material': { layer: 'surface', form: true, law: 'A joint, a chip and a tool mark are relief the light finds (a normal, a height); no line is drawn.' },
  'value-by-light': { layer: 'look', form: true, law: 'A surface\'s elements stay close in tone; a place\'s contrast is its light\'s: lit against dark, not block against block.' },
  'true-curves': { layer: 'composition', form: true, law: 'A curve is cut fine enough to read as a curve at arm\'s length.' },
  'dark-is-a-place': { layer: 'look', form: true, law: 'The dark is part of a room: light falls off to it, and where no lamp reaches shade may be black.' },
  'live-emitters': { layer: 'look', form: true, law: 'What burns moves, and what emits is brighter than white: a flame is live, a lamp blooms.' },
  'layers-stand-proud': { layer: 'surface', form: true, law: 'A layer over a surface (a coat of render, a patch, a plate) stands proud of what it covers, and its broken edge casts its shadow.' },
  // CRAFT, in both eras (`craft: true`): what a first pass may not be. A thing made of boxes reads as voxels in any light
  // (each one's reason, as the question a room is asked, is in era/room-craft.js: a kit answers the question, never copies another kit's answer)
  'no-voxel-first': { layer: 'composition', craft: true, law: 'Nothing is a box on its first pass: a fixture shows how it was made (turned, cast, forged, pressed) and what holds it to the room, before it is placed.' },
  'wall-rhythm': { layer: 'composition', craft: true, law: 'Along one wall at most two neighbouring segments look alike and a pair is never followed by the same pair (ABBA, never AAAA or ABAB), a wall of three the odd one in the middle (ABA, BAB); the second kind of segment is the first with less on it; a wall all alike is a stated choice, drawn clean and repeatable.' },
  'floor-is-laid': { layer: 'composition', craft: true, law: 'A floor is laid, not tiled: a border course along the walls, the way down the room in its own slabs, the fields between laid bay by bay on the structure\'s lines, keeping a rhythm.' },
  'wall-has-storeys': { layer: 'composition', craft: true, law: 'A tall wall has storeys: a course divides it, and what is over the course is derived from what is under it, the same with less.' },
  'air-is-furnished': { layer: 'composition', craft: true, law: 'The air of a tall room is furnished and its height lit by a cause: what the height is for hangs in it or crosses it, and light reaches the upper room from a thing that gives it.' },
  'pillars-are-worked': { layer: 'composition', craft: true, law: 'A support is worked the way its material is worked, never a flat strip: tapered, rounded, fluted or cut in parts, spread at its foot and gathered at its head.' },
});

/** Each style card's principles, in order, as the laws they are instances of. */
export const PRINCIPLE_LAWS = Object.freeze({
  crypt: [['value-order', 'light-through'], ['focus', 'kit-dressing'], ['materials-by-layer'], ['blend-by-cause'], ['cutout-cards', 'by-cause'], ['distinct-radius'],
    ['repeat-adjacent'], ['accent-wall', 'focus'], ['corner-things', 'clusters', 'distinct-radius', 'by-cause'], ['arches-and-rounds', 'big-shapes'], ['dare-height', 'big-shapes'], ['motif-small', 'detail-in-tile'], ['doodads-apart', 'clusters']],
  catacomb: [['value-order', 'light-through'], ['focus', 'kit-dressing'], ['materials-by-layer'], ['arches-and-rounds', 'big-shapes'], ['repeat-adjacent'],
    ['accent-wall', 'focus', 'kit-dressing'], ['blend-by-cause'], ['cutout-cards', 'by-cause', 'distinct-radius'], ['corner-things', 'clusters', 'distinct-radius', 'by-cause'], ['dare-height', 'big-shapes'], ['motif-small', 'detail-in-tile'], ['doodads-apart', 'clusters'],
    ['no-voxel-first'], ['pillars-are-worked'], ['wall-rhythm', 'repeat-adjacent'], ['wall-has-storeys', 'by-cause'], ['layers-stand-proud', 'blend-by-cause'], ['floor-is-laid', 'subject-line'], ['air-is-furnished', 'light-through']],
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
  'alien-night': [['locked-palette', 'shade-is-colour'], ['baked-light', 'focus'], ['big-shapes'], ['depth-by-air', 'value-order'], ['sky-is-a-place'], ['value-order', 'focus']],
  'airless-plain': [['depth-by-air'], ['sky-is-a-place', 'value-order'], ['baked-light', 'shade-is-colour'], ['big-shapes'], ['locked-palette', 'value-order']],
  'isekai-garden': [['clusters', 'by-cause'], ['layered-depth', 'distinct-radius'], ['subject-line', 'focus'], ['repeat-adjacent', 'accent-wall'], ['corner-things']],
  // (the crypt in the form render's register, style/crypt.js CRYPT_SOBER.form: the seventh generation's principles)
  'crypt/form': [['built-scale'], ['relief-is-material', 'detail-in-tile'], ['value-by-light', 'value-order'], ['true-curves', 'arches-and-rounds'], ['dark-is-a-place', 'dare-height'], ['live-emitters'], ['built-scale', 'materials-by-layer'], ['motif-small', 'relief-is-material'],
    ['no-voxel-first'], ['pillars-are-worked', 'arches-and-rounds'], ['layers-stand-proud', 'blend-by-cause'], ['wall-rhythm', 'distinct-radius'], ['wall-rhythm', 'repeat-adjacent'], ['wall-has-storeys', 'wall-rhythm'], ['layers-stand-proud', 'by-cause'], ['air-is-furnished', 'light-through', 'focus'], ['floor-is-laid', 'subject-line', 'wall-rhythm']],
});

/** Every principle a style card states, keyed as PRINCIPLE_LAWS keys them: the card's own, its night's, its decay's. */
export function statedPrinciples() {
  const out = {};
  for (const S of [CRYPT, CATACOMB, DELFINO_PLAZA, GOTHIC_NAVE, RESEARCH_LAB, NATURE_TRAIL, JUNGLE_MGS3, ISEKAI_MEADOW, ISEKAI_BAMBOO, ISEKAI_SAKURA, ALIEN_NIGHT, AIRLESS_PLAIN, ISEKAI_GARDEN]) {
    out[S.id] = S.principles;
    if (S.night?.principles) out[`${S.id}/night`] = S.night.principles;
    if (S.decay?.principles) out[`${S.id}/decay`] = S.decay.principles;
  }
  // (a card's form register, the seventh generation's: the crypt's is its sober card's)
  for (const S of [CRYPT_SOBER]) if (S.form?.principles) out[`${S.id}/form`] = S.form.principles;
  return out;
}

/** The ledger: each law with its layer and every principle that states it (`card#index`). */
export function lawLedger() {
  const ledger = Object.fromEntries(Object.entries(LAWS).map(([id, L]) => [id, { ...L, stated: [] }]));
  for (const [card, rows] of Object.entries(PRINCIPLE_LAWS)) rows.forEach((laws, i) => { for (const l of laws) ledger[l].stated.push(`${card}#${i}`); });
  return ledger;
}
