/**
 * Capability catalog for the `architecturalConstruction` recipe family.
 *
 * Source artifact for `sketch_what_possible` (see
 * lite-template/integration/0603/what-possible-spike.plan.md). Paragraph-per-
 * value descriptions are embedded against the user's intent so the host agent
 * can read structured scores and decide whether to call `create_sketch` with
 * inferred knobs, ask a clarifying question, or route to an LLM-rich path.
 *
 * Description register:
 *   - ~40 words per value. Lead with the visually discriminating feature;
 *     follow with concrete cues a user prompt might use.
 *   - Style descriptions ANTICIPATE the pending STYLE_PRESETS refactor by
 *     mentioning the implicit roof / door / porch / chimney each style
 *     pulls in. When that refactor lands the prose doesn't need to change.
 *   - Avoid generic praise ("classic", "beautiful") — it dilutes the
 *     embedding signal without helping discrimination.
 *
 * Knob values must stay in lockstep with `normalizeHouseVariant` in
 * recipe-compiler.js. The default value for each knob is marked so a reader
 * can tell at a glance which value is silent-passthrough vs. opt-in.
 */

export const ARCH_CAPABILITIES = {
  family: 'architecturalConstruction',
  description:
    'A house or small building rendered in three-quarter view: rectangular body mass, a roof, a front door, a porch or stoop, a small flight of entry steps, an optional chimney, and a regular band of facade windows. The image reads as architectural — the exterior of a residence — not an interior, not a landscape, not a figure.',
  knobs: {
    style: [
      {
        value: 'craftsman',
        default: true,
        describe:
          'Craftsman bungalow — low-pitched gable roof with deep overhanging eaves, a covered porch with tapered piers in front of the door, a paneled craftsman door with a small upper light, and a single brick chimney. Modest one-to-one-and-a-half story proportions, exposed rafter tails, earthy palette.',
      },
      {
        value: 'victorian',
        describe:
          'Victorian — steep mansard roof with dormer slots, ornate trim and decorative bands, an arched front door with a fanlight cue, a wraparound porch with a rhythmic post pattern, and twin chimneys. Vertical proportions, asymmetric massing, fussy detail.',
      },
      {
        value: 'modern',
        describe:
          'Modern — flat parapet roof with no visible pitch, a minimalist stoop instead of a covered porch, large horizontal window bands, a plain slab front door, and often no visible chimney. Geometric silhouette, low ornament, contemporary urban or infill house.',
      },
      {
        value: 'colonial',
        describe:
          'Colonial — symmetrical two-story facade, simple gable roof, a centered paneled door with sidelights, a modest front stoop, and twin chimneys at the gable ends. Restrained trim, brick or clapboard cladding, balanced window placement.',
      },
      {
        value: 'mediterranean',
        describe:
          'Mediterranean — shallow tiled roof reading as low-pitched gable, stucco walls in a warm palette, an arched entry door, terraced front steps, and twin masonry chimneys. Warm masonry, archways, hillside or villa proportions.',
      },
      {
        value: 'ranch',
        describe:
          'Ranch — long horizontal one-story mass that hugs the ground, shallow gable roof, a covered porch running much of the front facade, a single-leaf front door, and a low single chimney. Spreading footprint, suburban vernacular.',
      },
      {
        value: 'bungalow',
        describe:
          'Bungalow — compact one-story mass, low-pitched gable with a deep front overhang, a covered porch with tapered piers, a craftsman-panel front door, and a single brick chimney. Cottage-craftsman cousin, modest scale.',
      },
      {
        value: 'cottage',
        describe:
          'Cottage — small mass with a steep gable roof, a simple covered porch or stoop, a paneled wood door, and a single chimney often rising through the ridge. Storybook proportions, modest scale, quiet rural character.',
      },
      {
        value: 'farmhouse',
        describe:
          'Farmhouse — tall gabled mass, a wide wraparound porch with simple square posts, a paneled or double-leaf front door, and a single brick chimney rising through the ridge. Practical rural character, white or pale clapboard cladding.',
      },
    ],
    roof: [
      {
        value: 'gable',
        default: true,
        describe:
          'Gable roof — two pitched slopes meeting at a ridge, triangular gable ends on the short sides of the house. The most common residential roof shape; reads as the silent default for craftsman, ranch, bungalow, cottage, farmhouse, colonial.',
      },
      {
        value: 'mansard',
        describe:
          'Mansard roof — steep four-sided lower skirt with a flatter upper cap, dormer windows cut into the steep section. Reads as a two-tier "wedding-cake" silhouette. Strongly tied to victorian and French Second Empire houses.',
      },
      {
        value: 'flat-parapet',
        describe:
          'Flat parapet roof — flat or near-flat roofline with a low parapet band along the top edge, often with visible scupper or drain accents. Geometric silhouette, no visible pitch. Modern, contemporary, urban infill houses.',
      },
    ],
    door: [
      {
        value: 'craftsman-panel',
        default: true,
        describe:
          'Craftsman-panel front door — rectangular slab with four recessed panels, one or two small glass lites at the top, and a simple knob. Quiet, vertical, framed-and-paneled. Default for craftsman, bungalow, ranch and most modest houses.',
      },
      {
        value: 'arched-panel',
        describe:
          'Arched-panel door — an arched top (round or pointed arch) over vertical plank or panel infill, often with a fanlight or arched transom above. Reads as ornate, romantic, or old-world. Strongly associated with victorian and mediterranean homes.',
      },
      {
        value: 'double-panel',
        describe:
          'Double-panel front door — two wide paneled leaves meeting at a center seam, often with paired upper lites and a generous opening. Grand-entry feel. Used for larger or more formal homes — farmhouse, colonial, big-house entries.',
      },
    ],
    porch: [
      {
        value: 'covered',
        default: true,
        describe:
          'Covered porch — a small platform in front of the door, two front posts, and a small porch roof providing shade and shelter. The standard suburban front porch. Default for craftsman, ranch, bungalow, and cottage.',
      },
      {
        value: 'stoop',
        describe:
          'Stoop — minimal landing pad at the door with short side cheeks and no overhead cover. Reads as urban, modern, or restrained. Used for modern houses, urban infill, formal colonial entries with a small landing.',
      },
      {
        value: 'wraparound',
        describe:
          'Wraparound porch — a long platform extending across the front and continuing around at least one side, a rhythmic line of posts, with a visible side return. Hospitality cue. Default for victorian and farmhouse styles.',
      },
    ],
    steps: [
      {
        value: 'front-treads',
        default: true,
        describe:
          'Front treads — a small flight of four parallel tread slabs directly in front of the porch or door, running perpendicular to the facade. The standard entry stair. Default for most houses.',
      },
      {
        value: 'terraced',
        describe:
          'Terraced steps — a wider, shallower set of five low terraces ascending toward the porch, reading more like landscape steps than a stair. Used on hillside sites and with mediterranean homes; signals a deliberate gradual ascent.',
      },
      {
        value: 'side-stair',
        describe:
          'Side stair — a diagonal run of steps approaching the porch from one side rather than head-on. Used when the entry is offset or when the porch faces sideways; reads as a wraparound-porch entry pattern.',
      },
    ],
    chimney: [
      {
        value: 'single-stack',
        default: true,
        describe:
          'Single-stack chimney — one masonry chimney shaft rising through the roof with brick bands and a cap. The standard residential chimney. Default for craftsman, ranch, bungalow, farmhouse, and most modest houses.',
      },
      {
        value: 'twin-stack',
        describe:
          'Twin-stack chimney — two chimney shafts, either sharing a common cap or paired at opposite roof ends, with brick bands on each. Reads as larger, formal, or older home. Tied to victorian and colonial styles.',
      },
      {
        value: 'none',
        describe:
          'No chimney — the roof reads cleanly with no vertical chimney protrusion. Used for modern, urban, or stylized houses where the chimney is intentionally absent. The silhouette is uninterrupted along the roofline.',
      },
    ],
  },
};
