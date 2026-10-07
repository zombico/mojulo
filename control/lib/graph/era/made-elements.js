/**
 * MADE ELEMENTS — one vocabulary for what built things are made of, shared by the outdoor master index (out-made.js)
 * and the playscape entries (playscape/objects/*): every element word a style guide uses (a bridge's stringers, a
 * rope bridge's footropes, an arch's keystone, a post's cap) says which PART it is and which MATERIAL it is made of.
 *
 * A playscape object is built in values only on its obj:* groups (playscape/objects/laws.js); the kit's swatches say
 * what colours those values become. The material picks the ramp (the kit's swatch role for it), the value picks the
 * stop, and `obj:status` (what you can use) takes the kit's accent and nothing else does: decorative paint has its own
 * ramp. Pure.
 */
import { accentOf, hexOfRgb } from './style/swatches.js';

// the materials a built thing is made of: each is a swatch role of the kit (out-made.js MADE_RAILS swatch)
export const MATERIALS = Object.freeze(['timber', 'stone', 'rope', 'paint', 'hat']);

const T = (part, read) => ({ part, material: 'timber', read });
const S = (part, read) => ({ part, material: 'stone', read });
const R = (part, read) => ({ part, material: 'rope', read });
export const ELEMENTS = Object.freeze({
  // the index's parts, as words
  post: T('post', 'an upright set in the ground'), rail: T('rail', 'a horizontal member a walker meets'), beam: T('beam', 'a member that spans'),
  plank: T('plank', 'a deck board'), tread: T('tread', 'the step stood on'), riser: T('riser', 'the edge that holds a tread'), board: T('board', 'a sign\'s face'),
  cap: T('cap', 'the top of a post'), footing: S('footing', 'what an upright or a beam bears on'), stone: S('stone', 'a block laid or stacked'),
  // a bridge's elements (playscape/objects/bridge.js)
  boards: T('plank', 'one board across'), chocks: S('footing', 'the stones a plank is chocked on'), cleats: T('rail', 'battens binding the boards'),
  planks: T('plank', 'the deck boards'), stringers: T('beam', 'the beams the planks lie on'), posts: T('post', 'the uprights'),
  rails: T('rail', 'the rail along the posts'), braces: T('rail', 'the X-braces in the middle bays'), abutments: S('footing', 'the stone each bank bears'),
  piers: S('footing', 'the stone uprights under a long deck'), footropes: R('beam', 'the ropes the planks lie on'), handropes: R('rail', 'the ropes held'),
  suspenders: R('rail', 'the cords from handrope to footrope'), lashings: R('cap', 'the knots binding planks to ropes'),
  ring: S('stone', 'the arch\'s voussoirs'), crown: S('stone', 'the middle third of the ring'), keystone: S('stone', 'the ring\'s top stone'),
  spandrels: S('stone', 'the walls from the ring up to the deck'), deck: S('plank', 'the arch\'s slab'), parapets: S('rail', 'the arch\'s low walls'),
  coping: S('cap', 'the stones along a parapet\'s top'), dentils: S('stone', 'the toothed band under the coping'), band: S('stone', 'a plain band along the parapet'),
  // what a kit's tokens dress them with (out-made.js MADE_RAILS)
  caps: T('cap', 'a post\'s top: a bevel, a round, an open culm'), hat: { part: 'cap', material: 'hat', read: 'a grass hat on a post' },
  nodes: T('post', 'a culm\'s rings'), lashing: R('cap', 'rope bound over a meeting'), peg: T('cap', 'a peg through a meeting'),
  notch: T('cap', 'a notch where one member is let into another'), motif: T('board', 'the relief along a fascia'), courses: S('stone', 'the coursing of laid stone'),
});

/** An element word's material (an unknown word is timber: the commonest thing people build with). */
export const materialOf = (word) => ELEMENTS[word]?.material ?? 'timber';

/**
 * The colour of a value on an element under a resolved style (out-made.js madeStyle): the stop of its material's ramp
 * the value falls on, moved `light` stops (a face toward the light is a stop up its ramp, never off it); the accent for
 * what you use.
 */
export function madeColour(style, { material, group, value }, light = 0) {
  if (group === 'obj:status') return hexOfRgb(accentOf(style.kitId));
  const ramp = (style.swatch[material] ?? style.swatch.timber).stops, n = ramp.length;
  const k = Math.max(0, Math.min(n - 1, Math.round(Math.max(0, Math.min(1, value)) * (n - 1)) + light));
  return hexOfRgb(ramp[k]);
}

/** A built object's faces painted in a kit: each face its material's colour, a stop up where it faces `sun`. */
export function kitPaint(faces, style, sun = [0.4, -0.5, 0.77]) {
  return faces.map((f) => {
    const value = f.value ?? (f.tint ? f.tint[0] : 0.5), n = f.normal || [0, 0, 1], lam = n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
    const fill = madeColour(style, { material: f.material ?? materialOf(f.part), group: f.group, value }, lam > 0.35 ? 1 : lam < -0.2 ? -1 : 0);
    const { tint: _t, ...rest } = f;
    return { ...rest, fill };
  });
}
