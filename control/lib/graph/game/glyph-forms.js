/**
 * glyph-forms — the game UI language's FORM SHELF (game-ui-language.plan.md, U1).
 *
 * Icon-grade procedural solids (gem coin key heart medkit ammo-crate star orb flag skull, and the rhythm game's note blocks) built from the
 * lathe/extrude primitives, vexar-lit, one semantic tint each — the closed, player-facing pickup/
 * marker vocabulary. Not workbench-grade objects: these are silhouettes designed to read at
 * gameplay distance, the substrate's equivalent of a tinted icon set, kept pure-vector.
 *
 * Each registry row carries the metadata the language needs beyond geometry:
 *   symmetry — 'radial' (any spin invisible) | 'radial-N' | 'bilateral'. Spin-class idle/SFX
 *              effects only read on non-radial forms (spike rule: a 6-fold gem looks identical
 *              every 60°); default idles honor this.
 *   idle     — the default idle effect class ('bob' | 'spin-bob') derived from symmetry.
 *   fit      — anchor data for the effect layers: { height, cz } (cz = the aura/wisp anchor
 *              height). Forms build with their base at z=0, centered on x=y.
 *
 * ENTITY BODIES BY NAME — `lowerGlyphBodies`: a world entity may declare
 *   body: { type:'glyph', form:'gem', tint?, scale?, yawOffset? }
 * At resolve time (world-scene.js) the body lowers to a single-frame `figure-frames` body whose
 * frame is the glyph's face list — the packer and the in-page figure machinery do the rest, so
 * the emitter is untouched and a world without glyph bodies emits byte-identical HTML.
 *
 * Deterministic: same (form, tint, scale) → identical faces. Vocab cards are GENERATED from this
 * registry (glyph-cards/loader.js) so the discoverable shelf can never drift from the builders.
 */
import { latheToFaces } from '../polygonizer/lathe-faces.js';
import { extrudeToFaces } from '../polygonizer/extrude-faces.js';

const mapCorners = (faces, f) => faces.map((face) => ({ ...face, corners: face.corners.map(f) }));
const shift = (faces, [dx, dy, dz]) => mapCorners(faces, ([x, y, z]) => [x + dx, y + dy, z + dz]);

export const circlePts = (r, n) => Array.from({ length: n }, (_, k) => {
  const a = (k / n) * 2 * Math.PI;
  return [r * Math.cos(a), r * Math.sin(a)];
});

// ── the registry ─────────────────────────────────────────────────────────────
// build({ tint }) → faces, base at z=0, centered on x=y=0, ~1–1.5 units tall.
// `tint` recolors the form's PRIMARY material; structural accents (flag pole,
// skull eye sockets) keep their fixed colors so the silhouette stays legible.

// a TREASURE CHEST (the chest and chest-open forms): a box of wood, its lid a half-round barrel along its width, two gold
// bands round both and a gold lock on its front (+y, the figure's forward); open, the lid stands back on its hinge and
// the inside shows dark
const CHEST = Object.freeze({ w: 0.9, d: 0.6, h: 0.42, r: 0.3, band: 0.07, gold: '#e8b730', dark: '#2e1d10' });
function chestFaces(tint, open) {
  const { w, d, h, r, band, gold, dark } = CHEST;
  const slab = (sw, sh, sd, z, c) => extrudeToFaces({ profile: { rect: { w: sw, h: sh } }, axisFrom: { x: 0, y: -sd / 2, z }, axisTo: { x: 0, y: sd / 2, z } }, { tint: c });
  const barrel = (x0, x1, rad, c) => latheToFaces({ axisFrom: { x: x0, y: 0, z: h }, axisTo: { x: x1, y: 0, z: h }, profile: [{ t: 0, radius: rad }, { t: 1, radius: rad }], crossSections: 16, samples: 2 }, { tint: c });
  const body = [...slab(w, h, d, h / 2, tint), ...[-0.3, 0.3].flatMap((x) => shift(slab(band, h + 0.01, d + 0.02, (h + 0.01) / 2, gold), [x, 0, 0]))];
  if (!open) return [...body, ...barrel(-w / 2, w / 2, r, tint), ...[-0.3, 0.3].flatMap((x) => barrel(x - band / 2, x + band / 2, r + 0.012, gold)), ...shift(slab(0.12, 0.14, 0.04, h + 0.02, gold), [0, d / 2 + 0.01, 0])];
  // (open: the inside a dark slab under the rim, the lid stood back on its hinge behind)
  return [...body, ...slab(w - 0.06, 0.02, d - 0.06, h + 0.005, dark), ...shift(slab(w, 2 * r, 0.08, h + r, tint), [0, -d / 2 - 0.04, 0]), ...[-0.3, 0.3].flatMap((x) => shift(slab(band, 2 * r + 0.01, 0.1, h + r, gold), [x, -d / 2 - 0.04, 0]))];
}

export const GLYPH_FORMS = {
  gem: {
    name: 'Gem',
    summary: 'A faceted cut stone — the canonical collectible/value pickup.',
    when: 'collectibles, treasure, currency of a fantasy flavor, "collect the gems"',
    tint: '#2fd6a3',
    symmetry: 'radial-6',
    idle: 'bob',
    fit: { height: 1.1, cz: 0.6 },
    build: ({ tint }) => latheToFaces({
      axisFrom: { x: 0, y: 0, z: 0.12 }, axisTo: { x: 0, y: 0, z: 1.1 },
      profile: [
        { t: 0, radius: 0.03 }, { t: 0.5, radius: 0.5 }, { t: 0.72, radius: 0.44 },
        { t: 0.85, radius: 0.24 }, { t: 1, radius: 0.03 },
      ],
      crossSections: 12, samples: 6,
    }, { tint }),
  },

  coin: {
    name: 'Coin',
    summary: 'A standing disc — currency, score, the classic run-through pickup.',
    when: 'money, points, "collect coins", shop currency',
    tint: '#e8b93b',
    symmetry: 'bilateral',
    idle: 'spin-bob',
    fit: { height: 1.05, cz: 0.6 },
    build: ({ tint }) => extrudeToFaces({
      profile: { points: circlePts(0.45, 22) },
      axisFrom: { x: 0, y: -0.06, z: 0.6 }, axisTo: { x: 0, y: 0.06, z: 0.6 },
    }, { tint }),
  },

  key: {
    name: 'Key',
    summary: 'A skeleton key — unlocks, access, gated progress.',
    when: 'key→door mechanics, unlocks, "find the key", access tokens',
    tint: '#c9a227',
    symmetry: 'bilateral',
    idle: 'spin-bob',
    fit: { height: 1.23, cz: 0.65 },
    build: ({ tint }) => {
      const head = extrudeToFaces({
        profile: { points: circlePts(0.24, 6) },
        axisFrom: { x: 0, y: -0.05, z: 1.02 }, axisTo: { x: 0, y: 0.05, z: 1.02 },
      }, { tint });
      const shaft = extrudeToFaces({
        profile: { rect: { w: 0.1, h: 0.72 } },
        axisFrom: { x: 0, y: -0.045, z: 0.5 }, axisTo: { x: 0, y: 0.045, z: 0.5 },
      }, { tint });
      const tooth = (z) => shift(extrudeToFaces({
        profile: { rect: { w: 0.2, h: 0.09 } },
        axisFrom: { x: 0, y: -0.04, z: 0 }, axisTo: { x: 0, y: 0.04, z: 0 },
      }, { tint }), [0.14, 0, z]);
      return [...head, ...shaft, ...tooth(0.2), ...tooth(0.36)];
    },
  },

  heart: {
    name: 'Heart',
    summary: 'The parametric heart — health, lives, healing.',
    when: 'hp pickups, lives, healing items, affection/favor tokens',
    tint: '#e0393f',
    symmetry: 'bilateral',
    idle: 'bob',
    fit: { height: 1.2, cz: 0.55 },
    build: ({ tint }) => {
      const s = 0.038;
      const pts = Array.from({ length: 40 }, (_, k) => {
        const a = (k / 40) * 2 * Math.PI;
        const u = 16 * Math.sin(a) ** 3;
        const v = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
        return [u * s, v * s + 0.75];
      });
      return extrudeToFaces({
        profile: { points: pts },
        axisFrom: { x: 0, y: -0.11, z: 0 }, axisTo: { x: 0, y: 0.11, z: 0 },
      }, { tint });
    },
  },

  medkit: {
    name: 'Medkit',
    summary: 'A first-aid case, a red cross on its faces — health where a heart would be out of place.',
    when: 'health pickups in a shooter, a mission, a survival game: a supply that heals',
    tint: '#f1f0ea',
    symmetry: 'bilateral',
    idle: 'bob',
    fit: { height: 0.72, cz: 0.36 },
    build: ({ tint }) => {
      const slab = (w, h, d, z, c) => extrudeToFaces({ profile: { rect: { w, h } }, axisFrom: { x: 0, y: -d / 2, z }, axisTo: { x: 0, y: d / 2, z } }, { tint: c });
      // (the case; its cross proud of both faces; the handle on its lid)
      return [...slab(0.84, 0.54, 0.4, 0.33, tint), ...slab(0.13, 0.36, 0.44, 0.33, '#d8262c'), ...slab(0.36, 0.13, 0.44, 0.33, '#d8262c'), ...slab(0.3, 0.07, 0.1, 0.635, '#3a3d42')];
    },
  },

  chest: {
    name: 'Treasure chest',
    summary: 'A wooden chest with a rounded lid, bound in gold bands, a lock on its front — shut, something inside.',
    when: 'treasure found off the path in a party RPG or an adventure: walk up and open it (a chest menu, loot: all)',
    tint: '#8b5a2b',
    symmetry: 'bilateral',
    idle: 'bob',
    fit: { height: 0.74, cz: 0.4 },
    build: ({ tint }) => chestFaces(tint, false),
  },
  'chest-open': {
    name: 'Open chest',
    summary: 'The same chest with its lid thrown back on its hinge, its inside dark — emptied, found.',
    when: 'a chest already opened: what stands where a treasure chest was looted',
    tint: '#8b5a2b',
    symmetry: 'bilateral',
    idle: 'bob',
    fit: { height: 0.98, cz: 0.4 },
    build: ({ tint }) => chestFaces(tint, true),
  },
  'ammo-crate': {
    name: 'Ammo crate',
    summary: 'A drab steel ammunition box, a stencil band across it — rounds, a resupply.',
    when: 'ammunition pickups, a resupply point, grenades and rounds in a shooter or a mission',
    tint: '#5d6b3a',
    symmetry: 'bilateral',
    idle: 'bob',
    fit: { height: 0.6, cz: 0.3 },
    build: ({ tint }) => {
      const slab = (w, h, d, z, c) => extrudeToFaces({ profile: { rect: { w, h } }, axisFrom: { x: 0, y: -d / 2, z }, axisTo: { x: 0, y: d / 2, z } }, { tint: c });
      // (the box; its lid a lip wider; the stencil band proud of both faces; the carry handle on its lid)
      return [...slab(0.86, 0.4, 0.46, 0.2, tint), ...slab(0.9, 0.09, 0.5, 0.445, '#444f2a'), ...slab(0.5, 0.08, 0.5, 0.2, '#e3c33b'), ...slab(0.34, 0.06, 0.08, 0.52, '#2d3033')];
    },
  },

  star: {
    name: 'Star',
    summary: 'A five-point star — achievement, rating, the special pickup.',
    when: 'achievements, power stars, ratings, "collect all the stars", specials',
    tint: '#f5d442',
    symmetry: 'radial-5',
    idle: 'bob',
    fit: { height: 1.2, cz: 0.65 },
    build: ({ tint }) => {
      const pts = Array.from({ length: 10 }, (_, k) => {
        const a = Math.PI / 2 + (k / 10) * 2 * Math.PI;
        const r = k % 2 === 0 ? 0.55 : 0.23;
        return [r * Math.cos(a), r * Math.sin(a) + 0.65];
      });
      return extrudeToFaces({
        profile: { points: pts },
        axisFrom: { x: 0, y: -0.09, z: 0 }, axisTo: { x: 0, y: 0.09, z: 0 },
      }, { tint });
    },
  },

  orb: {
    name: 'Orb',
    summary: 'A sphere — mana, energy, arcane charges, neutral resource.',
    when: 'mana/energy pickups, magic charges, souls, neutral resources',
    tint: '#5aa7f0',
    symmetry: 'radial',
    idle: 'bob',
    fit: { height: 1.12, cz: 0.64 },
    build: ({ tint }) => latheToFaces({
      axisFrom: { x: 0, y: 0, z: 0.16 }, axisTo: { x: 0, y: 0, z: 1.12 },
      profile: Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        return { t, radius: 0.48 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) + 0.004 };
      }),
      crossSections: 16, samples: 18,
    }, { tint }),
  },

  flag: {
    name: 'Flag',
    summary: 'A pennant on a pole — the goal, the exit, a claimed checkpoint.',
    when: 'level exits, goals, checkpoints, capture points',
    tint: '#46c46a',
    symmetry: 'bilateral',
    idle: 'bob',
    fit: { height: 1.5, cz: 1.2 },
    build: ({ tint }) => {
      const pole = extrudeToFaces({
        profile: { rect: { w: 0.07, h: 1.5 } },
        axisFrom: { x: 0, y: -0.035, z: 0.75 }, axisTo: { x: 0, y: 0.035, z: 0.75 },
      }, { tint: '#8a8f99' });
      const pennant = extrudeToFaces({
        profile: { points: [[0.04, 1.45], [0.04, 1.09], [0.95, 1.27]] },
        axisFrom: { x: 0, y: -0.02, z: 0 }, axisTo: { x: 0, y: 0.02, z: 0 },
      }, { tint });
      return [...pole, ...pennant];
    },
  },

  skull: {
    name: 'Skull',
    summary: 'A stylized skull — danger, death, hazard, enemy marker.',
    when: 'hazard markers, danger zones, enemy spawns, poison/curse flavor',
    tint: '#e6e1d3',
    symmetry: 'bilateral',
    idle: 'bob',
    fit: { height: 1.22, cz: 0.75 },
    build: ({ tint }) => {
      const cranium = latheToFaces({
        axisFrom: { x: 0, y: 0, z: 0.42 }, axisTo: { x: 0, y: 0, z: 1.22 },
        profile: [
          { t: 0, radius: 0.28 }, { t: 0.3, radius: 0.44 }, { t: 0.7, radius: 0.42 }, { t: 1, radius: 0.06 },
        ],
        crossSections: 12, samples: 16,
      }, { tint });
      const jaw = extrudeToFaces({
        profile: { rect: { w: 0.36, h: 0.3, r: 0.08 } },
        axisFrom: { x: 0, y: -0.16, z: 0.28 }, axisTo: { x: 0, y: 0.16, z: 0.28 },
      }, { tint });
      const eye = (dx) => ({
        corners: [[dx - 0.09, -0.43, 0.72], [dx + 0.09, -0.43, 0.72], [dx + 0.09, -0.43, 0.9], [dx - 0.09, -0.43, 0.9]],
        fill: '#14161a', doubleSided: true,
      });
      const nose = {
        corners: [[-0.05, -0.44, 0.55], [0.05, -0.44, 0.55], [0, -0.44, 0.66], [0, -0.44, 0.66]],
        fill: '#14161a', doubleSided: true,
      };
      return [...cranium, ...jaw, eye(-0.17), eye(0.17), nose];
    },
  },

  // THE NOTES: a rhythm game's blocks (game/mechanics.js `notes`, cut in a headset). A cube half a metre across, its
  // arrow (white) on each of its four sides pointing the way the cut must go for whoever looks at that side, so it reads
  // however it turns on its walk; the `any` note a dot in place of the arrow.
  ...Object.fromEntries(['up', 'down', 'left', 'right', 'any'].map((dir) => [`note-${dir}`, {
    name: dir === 'any' ? 'Note (any cut)' : `Note (cut ${dir})`,
    summary: dir === 'any' ? 'A rhythm block cut any way: a cube with a dot on each side.' : `A rhythm block to cut ${dir}: a cube with its arrow on each side.`,
    when: `a saber rhythm game's notes (the notes mechanic): ${dir === 'any' ? 'a cut in any direction' : `a cut ${dir}`}`,
    tint: '#2f7fe0',
    symmetry: 'radial-4',
    idle: 'bob',
    fit: { height: 0.5, cz: 0.25 },
    build: ({ tint }) => noteBlock(dir, tint),
  }])),
};

/** A note block (see the registry's notes): the cube, then on each side its mark, a hair out of the face. */
function noteBlock(dir, tint) {
  const H = 0.25, out = H + 0.004, cube = extrudeToFaces({ profile: { rect: { w: 2 * H, h: 2 * H } }, axisFrom: { x: 0, y: -H, z: H }, axisTo: { x: 0, y: H, z: H } }, { tint });
  // the mark in a side's own (right, up) coordinates: an arrow up, turned to the cut; a square dot for `any`
  const arrow = [[-0.12, -0.08], [0.12, -0.08], [0, 0.16]], dot = [[-0.06, -0.06], [0.06, -0.06], [0.06, 0.06], [-0.06, 0.06]];
  const turn = { up: ([u, v]) => [u, v], down: ([u, v]) => [-u, -v], left: ([u, v]) => [-v, u], right: ([u, v]) => [v, -u], any: (q) => q }[dir];
  const mark = (dir === 'any' ? dot : arrow).map(turn);
  // each side: its outward normal n and the right of a viewer facing it (looking along −n, z up): −n × z
  const sides = [[[0, 1, 0], [-1, 0, 0]], [[0, -1, 0], [1, 0, 0]], [[1, 0, 0], [0, 1, 0]], [[-1, 0, 0], [0, -1, 0]]];
  const marks = sides.map(([n, r]) => ({
    corners: mark.map(([u, v]) => [n[0] * out + r[0] * u, n[1] * out + r[1] * u, H + v]),
    fill: '#ffffff', doubleSided: true, outNormal: n,
  }));
  return [...cube, ...marks];
}

export const GLYPH_IDS = Object.keys(GLYPH_FORMS);

/**
 * glyphFormFaces(form, { tint?, scale? }) → faces (base at z=0, centered on x=y=0).
 * Deterministic; throws a teaching error on an unknown form.
 */
export function glyphFormFaces(form, { tint, scale } = {}) {
  const row = GLYPH_FORMS[form];
  if (!row) {
    throw new Error(`glyph-forms: unknown form '${form}'. Known: ${GLYPH_IDS.join(', ')} — manuals: get_game_vocab({ id: 'glyph-<form>' }).`);
  }
  let faces = row.build({ tint: tint || row.tint });
  const k = Number.isFinite(scale) && scale > 0 && scale !== 1 ? scale : null;
  if (k) faces = mapCorners(faces, ([x, y, z]) => [x * k, y * k, z * k]);
  return faces;
}

/**
 * lowerGlyphBodies(entities, figures) — resolve-time lowering for
 * body:{ type:'glyph', form, tint?, scale?, yawOffset? } entities.
 *
 * Returns null when no entity carries a glyph body (caller leaves the payload
 * untouched — byte-identity for glyph-free worlds). Otherwise returns fresh
 * { entities, figures }: each glyph body rewritten to a single-frame
 * `figure-frames` body referencing a `glyph:<form>[:tint][:s<scale>]` clip
 * registered in figures. Identical (form, tint, scale) share one clip.
 */
export function lowerGlyphBodies(entities, figures) {
  if (!Array.isArray(entities) || !entities.some((e) => e && e.body && e.body.type === 'glyph')) return null;
  const outFigures = { ...(figures || {}) };
  const outEntities = entities.map((e) => {
    if (!e || !e.body || e.body.type !== 'glyph') return e;
    const b = e.body;
    const key = `glyph:${b.form}${b.tint ? `:${b.tint}` : ''}${Number.isFinite(b.scale) && b.scale !== 1 ? `:s${b.scale}` : ''}`;
    // a figure CLIP is a list of frames, each `{ faces }` (packFigureFrames reads frame.faces);
    // a glyph is a single static frame.
    if (!outFigures[key]) outFigures[key] = [{ faces: glyphFormFaces(b.form, { tint: b.tint, scale: b.scale }) }];
    return {
      ...e,
      // glyphs are mostly radial/forward-neutral: default yawOffset 0 (a figure's -π/2
      // convention would turn the coin/heart/flag sideways to the camera).
      // (what else the body says, a target's `hittable` and `egg`, rides on after the frame's own keys: a glyph that says
      // nothing more is the body it always was)
      body: { type: 'figure-frames', figure: key, lerp: false, yawOffset: Number.isFinite(b.yawOffset) ? b.yawOffset : 0, ...glyphKeeps(b) },
    };
  });
  return { entities: outEntities, figures: outFigures };
}
/** a glyph body's fields beyond its look (form, tint, scale, yawOffset): kept on the body it lowers to */
function glyphKeeps(b) {
  const { type: _t, form: _f, tint: _c, scale: _s, yawOffset: _y, ...keep } = b;
  return keep;
}
