/**
 * glyph-forms — the game UI language's FORM SHELF (game-ui-language.plan.md, U1).
 *
 * Eight icon-grade procedural solids (gem coin key heart star orb flag skull) built from the
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
};

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
      body: { type: 'figure-frames', figure: key, lerp: false, yawOffset: Number.isFinite(b.yawOffset) ? b.yawOffset : 0 },
    };
  });
  return { entities: outEntities, figures: outFigures };
}
