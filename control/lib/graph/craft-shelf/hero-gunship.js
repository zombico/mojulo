/**
 * THE HERO GUNSHIP (the craft shelf's own register, Blaze Gunner's ship): a classic hero fighter read in profile, the
 * scrolling shooter's ship. A long chined lance of a hull, its nose a chisel drooped a little; a low canopy; short
 * swept wings; a tall swept fin over its tail and a KEEL blade hanging under it (the same fin turned over, the
 * silhouette's signature: a dagger with a keel); one big drive bell; and a long gun rail slung under the forward half
 * to the nose. It reads at a sixteenth of a frame: big shapes, white with a blue trim and a lit drive.
 *
 *   HERO_GUNSHIP_ODM          its parts, rows on the one shelf (craft-odm.js assigns them after every other row)
 *   HERO_GUNSHIP_ARCHETYPES   the craft, `heroGunship` (craft-archetypes.js assigns it after every other row)
 *
 * Its reference figures are its own register's, not a published craft's: they guard the shape against drift.
 */

// a chined section: a flat top, the chines at its widest, a narrower flat keel (craft-odm.js CHINE)
const CHINE = [[1, 0], [0.5, 1], [-0.5, 1], [-1, 0], [-0.55, -1], [0.55, -1]];
const REGISTER = 'hero gunship register';

export const HERO_GUNSHIP_ODM = {
  'hull-hero-gunship': {
    kind: 'craft-fuselage', realm: 'space', label: 'chined lance hull, hero gunship', classOf: REGISTER,
    aliases: ['lance hull', 'gunship hull', 'hero hull'], dims: { length: 10.4, width: 2.2, height: 1.5 }, mass: 3600, mount: null,
    build: {
      family: 'facet', facets: CHINE,
      greebles: { top: 5, sides: 0, span: [0.5, 0.95] },
      // (the nose a chisel, its tip low: the sketch's nose turned a little down; the body full aft of the canopy)
      stations: [[0, 0.04, 0.14, 0.36], [0.16, 0.36, 0.4, 0.42], [0.4, 0.8, 0.78, 0.5], [0.68, 1, 1, 0.52], [0.9, 0.92, 0.9, 0.52], [1, 0.7, 0.72, 0.52]],
      points: { canopy: [0.3, 0, 0.78], wingRoot: [0.58, 0.9, -0.15], finRoot: [0.7, 0, 1], keel: [0.72, 0, -1], gun: [0.45, 0, -1], engine: [1, 0, 0] },
    },
  },
  'canopy-hero-gunship': {
    kind: 'craft-canopy', realm: 'space', label: 'faceted canopy, hero gunship', classOf: REGISTER,
    aliases: ['gunship canopy'], dims: { length: 2.6, width: 1.0, height: 0.72 }, mass: 60, mount: 'sill',
    build: { family: 'bubble', facets: true, bows: [0.35, 0.7] },
  },
  'wing-hero-gunship': {
    kind: 'craft-wing', realm: 'space', label: 'short swept wing, hero gunship', classOf: REGISTER,
    aliases: ['gunship wing'], dims: { span: 2.6 }, mass: 320, mount: 'wing-root',
    build: { section: 'facet', planform: [[0, 3.6], [1, 1.1]], sweep: 48, thickness: 0.1 },
  },
  'fin-hero-dorsal': {
    kind: 'craft-fin', realm: 'space', label: 'tall swept fin, hero gunship', classOf: REGISTER,
    aliases: ['gunship fin', 'hero fin'], dims: { span: 2.4 }, mass: 60, mount: 'tail-root',
    build: { vertical: true, section: 'facet', rootChord: 3.8, tipChord: 1.1, sweep: 55, thickness: 0.07 },
  },
  'fin-hero-keel': {
    kind: 'craft-fin', realm: 'space', label: 'keel blade, hero gunship', classOf: REGISTER,
    aliases: ['keel blade', 'ventral blade'], dims: { span: 2.2 }, mass: 45, mount: 'tail-root',
    // (longer and leaner than the fin over it, raked further back: a blade trailing down and aft to a small foot)
    build: { vertical: true, section: 'facet', rootChord: 2.4, tipChord: 0.35, sweep: 68, thickness: 0.06 },
  },
  'drive-bell-hero': {
    kind: 'craft-engine', realm: 'space', label: 'main drive bell, hero gunship', classOf: REGISTER,
    aliases: ['gunship drive', 'hero drive'], dims: { length: 1.6, diameter: 1.0 }, mass: 520, perf: { thrust: 80 }, mount: 'hull-store',
    build: { family: 'bell' },
  },
  'cannon-hero-rail': {
    kind: 'craft-weapon', realm: 'space', label: 'gun rail, hero gunship', classOf: REGISTER,
    aliases: ['gun rail', 'rail cannon', 'gunship cannon'], dims: { length: 5.4, diameter: 0.42 }, mass: 320, mount: 'hardpoint',
    build: { family: 'cannon', body: 0.7 },
  },
};

export const HERO_GUNSHIP_ARCHETYPES = {
  heroGunship: {
    realm: 'space', role: 'superiority', palette: 'heroWhite', class: 'hero gunship', label: 'hero gunship', classOf: REGISTER,
    reference: { span: 7.0, length: 13.3, height: 6.1, mtow: 6000 },
    bom: { 'craft-fuselage': 1, 'craft-canopy': 1, 'craft-wing': 2, 'craft-fin': 2, 'craft-engine': 1, 'craft-weapon': 1 },
    layout: [
      { id: 'hull', sku: 'hull-hero-gunship' },
      { id: 'canopy', sku: 'canopy-hero-gunship', at: 'hull.canopy' },
      { id: 'wing', sku: 'wing-hero-gunship', at: 'hull.wingRoot', pair: true },
      { id: 'fin', sku: 'fin-hero-dorsal', at: 'hull.finRoot' },
      // (the keel: the fin's sibling turned over about the hull's long axis, hanging under the tail)
      { id: 'keel', sku: 'fin-hero-keel', at: 'hull.keel', roll: 180 },
      { id: 'drive', sku: 'drive-bell-hero', at: 'hull.engine' },
      { id: 'gun', sku: 'cannon-hero-rail', at: 'hull.gun' },
    ],
  },
};
