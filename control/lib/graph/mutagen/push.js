// PUSHES: the reading of a game creature laid over a species, not a field guide's. Every push moves ring radii, the
// head's own rows and ornaments, the palette and paint, or adds a midline ornament; none moves a joint the species has,
// so its skeleton and rig stay its own. The principles are the house's (docs/mascot.md, the creature catalyst's art
// direction, the stylism tuner): one dominant mass and one hook that breaks the outline, contrast spent at the eyes
// and the mouth, three values, and a push that exaggerates the animal's proportions but never reverses them.
//
// MASS
//   wedge    { fore, hind, broad }   the trunk's rings, hind (rump) → fore (chest and withers): the brute's wedge;
//            `broad` widens the fore rings' side radius again (shoulders that read from the front)
//   neck     k                 the neck's rings
//   limbs    { fore, hind, paws }   each leg's rings by the girdle it hangs from; the foot (a chain's last row) by paws
// HEAD
//   head     { skull: { width, height }, muzzle: { width, height, length }, brow, eye, pace }   the head's rows moved
//            (creature-heads deriveHead: a low wide skull, a heavier muzzle, a shorter face; the head bone keeps its
//            own), the brow strip's size, the eye's radius; `pace`: the head keeps pace with the chest the wedge
//            builds, grown by that gain to this power (a head that reads small against the torso is a proportion
//            problem no detail fixes)
//   ears     { height, sweep, drop, none }   the ear spine's length, its upper points laid back (sweep: run per rise),
//            laid down the skull (drop: degrees, the fauna builder's `earDrop`), or no ears at all (none: true)
//   fangs    k                 a few decisive teeth, upper and lower, on a head with teeth: the canines × k, the rest
//            left small
//   expression { <control>: v }   the head's rest face (station-loft-head.js controls: jawOpen, sneer, browFurrow, …)
// THE HOOK
//   hackles  { count, height, lean, color, glow }   spikes along the dorsal line, nape to mid-back (height in back
//            depths): fur, ice, crystal, vertebrae or fins by their colour and glow
// ORNAMENT (in the creature's MOTIF: its colour, its glow and its material, motif.js; spikes in a frost creature are ice)
//   horns    { size, curl, pairs }   a pair of horns rooted behind the brow, sweeping back (size in the skull's
//            lengths; curl 0 straight … 1 swept down at the tip); `pairs: 2` a second, smaller pair at the brow,
//            forward (a crown); a worn head mesh takes none
//   plates   { count, height }  a ridge of plates from the nape down the back to the tail's tip, tallest over the hips
//            (height in back depths): the chimera's spines
//   cheeks   { size }          a spur at each cheek, swept back
//   shoulders { size }         a spike standing off each shoulder
//   spurs    { size }          a spur behind each elbow
//   tailSpikes { count, size }  spikes along the top of the tail, smaller toward the tip
//   ruff     { size }          a ruff of tiles round the neck
//   bands    true              a band of the motif round each lower leg
//   pauldrons { size }         a ball over each shoulder, in the armour (the toy hero's girth contrast)
//   earDomes { size }          a round dome on each side of the head where the ears were (a worn head mesh: none)
//   gem      true              a gem on the brow, in the motif
//   pistons  { size }          a hydraulic rod along the outside of each upper limb, in the armour (the machine's joint)
//   jointBalls { size }        a ball at every joint down each leg (elbow, knee, wrist, hock), in the armour: a toy's joints
//   antenna  { size }          twin antennae off the crown, ball-tipped in the motif
//   piece    { kind, size, color }   one signature piece (docs/mascot.md Ad1–Ad6): a bell on a collar, a trailing scarf, a
//            bandana, a medal, a studded collar (round the neck), a bow (on the crown), a pack (on the back); in `color`
//            (satin) with one gold shine; a body with no neck wears the bow
//   tipGlow  true              the tail's tip drawn full-bright
//   motif    <word>            the shape family the ornaments are made in (the last ooze's, else `horn`)
//   motifGlow true             the ornaments drawn full-bright whatever their motif (the stylist's accent)
// ARMOUR AND GROUPS
//   armor    { color, material, glow }   what the pauldrons, the ear domes and the pistons are made of
//   groups   { <Group>: { color, material?, glow? } }   a palette group recoloured and given a material on the body,
//            the head and a worn head mesh alike (a chrome faceplate: Skull and Snout)
//   boots    { flare }         each lower leg widened toward the foot, a cone (the toy hero's flared boots)
// COLOUR WORDS: wherever a push names a colour it may name one of the animal's own instead of a hex: `suit` (its coat
//   lightened and quietened), `armor` (its coat darkened), `seam` (darker still: panel lines), `accent` (one warm
//   signal colour from the coat's own hue, bright), `opposite` (the hue across the wheel from the coat: what the body
//   lacks): a creature made in its own colours, never one fixed hue (resolveColorWords)
//   motifColor <colour>         the motif's colour over its own (a gem in the creature's accent)
// SURFACE
//   coat     darken            the coat's colours toward black
//   desaturate d               the coat's colours toward their own grey
//   saturate s                 the coat's colours pushed to a mascot's saturation (a near-grey coat keeps its values)
//   smooth   true              nothing on the surface: the species' fur cards (its head and body tiles) left off
//   tint     { color, amount, light, lightColor }   the coat mixed toward a colour (the light values by `light` ×
//            amount, default half, and toward `lightColor` when named: a two-tone); several oozes' tints apply in order
//   marks    [ marking, … ]    painted regions (the fauna builder's `markings`: band, stripes, patch, spots), each with
//            `group` and `color`, `glow: true` to draw it full-bright; spots are placed by the creature's seed
//   surfaces { <group> | '*': material }   a shelf material per palette group (gunmetal, steel, glass, stone, …)
//   cover    { length, size, shape, sheen, tipped }   a beast-kin's coat carried as a material (beast/cover.js COVER_STYLE:
//            sleek or shaggy fur, fine or keeled scales, a matte, glossy or metal sheen, frosted tips); an animal reads none
//   eyes     { color, glow, open, socket }   the iris's colour, mixed in by strength; glow draws the whole eye
//            full-bright (the sclera a deeper shade, the pupil dark); `open` widens the lids; `socket`: a dark socket
//            round a glowing pupil (the sclera black and unlit); `toon`: a cartoon's eye, the set eye with a white round
//            a big iris and a round pupil, and no dark brow (the catchlight is the eye's own)
//
// In every layer the coat's colours keep their values apart: the light ones (belly, cheek, throat) take half of a
// darkening and `light` of a tint. Composition (several oozes): multipliers multiply, each raised to its ooze's strength;
// sweeps, drops and the face's controls add, scaled by strength; a spike's height is the tallest asked; darkening and
// greying compound; tints and marks stack in list order (marks from strength 0.35); a word (a colour, a count, a
// material) is the last ooze's.
import { deriveHead } from '../creature-heads/derive.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { MOTIFS, MOTIF_NAMES } from './motif.js';
import { saturate } from '../egocube/mascot-animals.js';
import * as dmath from '../../util/dmath.js';

const LEAVES = {
  'wedge.fore': 'mul', 'wedge.hind': 'mul', 'wedge.broad': 'mul', neck: 'mul', 'limbs.fore': 'mul', 'limbs.hind': 'mul', 'limbs.paws': 'mul',
  'head.skull.width': 'mul', 'head.skull.height': 'mul', 'head.muzzle.width': 'mul', 'head.muzzle.height': 'mul', 'head.muzzle.length': 'mul', 'head.brow': 'mul',
  'head.eye': 'mul', 'head.pace': 'max', 'ears.height': 'mul', 'ears.sweep': 'add', 'ears.drop': 'add', 'ears.none': 'last', fangs: 'mul',
  'hackles.count': 'last', 'hackles.height': 'max', 'hackles.lean': 'last', 'hackles.color': 'last', 'hackles.glow': 'glow',
  coat: 'compound', desaturate: 'compound', saturate: 'max', smooth: 'glow', 'piece.kind': 'last', 'piece.size': 'max', 'piece.color': 'last', 'eyes.color': 'last', 'eyes.glow': 'glow', 'eyes.open': 'mul', 'eyes.socket': 'last', 'eyes.toon': 'glow',
  'horns.size': 'max', 'horns.curl': 'last', 'horns.pairs': 'max', 'plates.count': 'last', 'plates.height': 'max', 'cheeks.size': 'max', 'shoulders.size': 'max', 'spurs.size': 'max',
  'tailSpikes.count': 'last', 'tailSpikes.size': 'max', 'ruff.size': 'max', bands: 'glow', tipGlow: 'glow', motif: 'last', motifGlow: 'glow',
  'pauldrons.size': 'max', 'earDomes.size': 'max', gem: 'glow', 'pistons.size': 'max', 'boots.flare': 'mul', 'jointBalls.size': 'max', 'antenna.size': 'max', motifColor: 'last',
  'armor.color': 'last', 'armor.material': 'last', 'armor.glow': 'glow',
  // (the COVER's qualities a beast-kin's coat takes, beast/cover.js COVER_STYLE: an animal's fur cards read none of them)
  'cover.length': 'last', 'cover.size': 'last', 'cover.shape': 'last', 'cover.sheen': 'last', 'cover.tipped': 'max',
};
const LISTS = ['tint', 'marks'];   // stacked in list order, not merged
const leafOf = (path) => LEAVES[path] ?? (path.startsWith('expression.') ? 'add' : path.startsWith('surfaces.') || /^groups\.[A-Za-z]\w*\.(color|material)$/.test(path) ? 'last' : /^groups\.[A-Za-z]\w*\.glow$/.test(path) ? 'glow' : null);
const MUL_CLAMP = [0.3, 3];
const HEX = /^#[0-9a-f]{6}$/i;
export const COLOR_WORDS = Object.freeze(['suit', 'armor', 'seam', 'accent', 'opposite']);
export const PIECE_KINDS = Object.freeze(['bell', 'scarf', 'bandana', 'medal', 'studs', 'bow', 'pack']);
const COLORISH = (c) => HEX.test(c ?? '') || COLOR_WORDS.includes(c);
const MARK_KINDS = ['band', 'belly', 'stripes', 'patch', 'spots'];
const TRUNK_DENSITY = 5, LEG_DENSITY = 3, PART_DENSITY = 3;   // rings per station interval under a mark

const fnv = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const flatten = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (!pre && LISTS.includes(k) ? [] : v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${pre}${k}.`) : [[`${pre}${k}`, v]]));
function unflatten(pairs) {
  const out = {};
  for (const [path, v] of pairs) { const ks = path.split('.'); let o = out; ks.slice(0, -1).forEach((k) => { o = o[k] ??= {}; }); o[ks.at(-1)] = v; }
  return out;
}

/** Error strings for a row's push (empty = valid): every leaf one this module reads. */
export function pushErrors(push, label = 'push') {
  if (push === undefined) return [];
  if (!push || typeof push !== 'object') return [`${label}: an object of pushes`];
  const errs = flatten(push).filter(([p]) => !leafOf(p)).map(([p]) => `${label}.${p}: not a push (have ${Object.keys(LEAVES).join(', ')}, tint, marks, surfaces.<group>, expression.<control>)`);
  if (push.tint !== undefined && !(push.tint && COLORISH(push.tint.color) && Number.isFinite(push.tint.amount) && (push.tint.lightColor === undefined || COLORISH(push.tint.lightColor)))) errs.push(`${label}.tint: { color: '#rrggbb' | ${COLOR_WORDS.join(' | ')}, amount, light?, lightColor? }`);
  for (const [g, v] of Object.entries(push.groups ?? {})) if (!v || !COLORISH(v.color) || (v.material !== undefined && typeof v.material !== 'string')) errs.push(`${label}.groups.${g}: { color: '#rrggbb' | ${COLOR_WORDS.join(' | ')}, material?, glow? }`);
  for (const [i, m] of (push.marks ?? []).entries()) if (!m || !MARK_KINDS.includes(m.kind) || !m.on || !m.group) errs.push(`${label}.marks[${i}]: { on, kind: ${MARK_KINDS.join(' | ')}, group, color?, glow?, … }`);
  for (const [g, m] of Object.entries(push.surfaces ?? {})) if (typeof m !== 'string') errs.push(`${label}.surfaces.${g}: a material name`);
  if (push.motif !== undefined && !MOTIFS[push.motif]) errs.push(`${label}.motif: one of ${MOTIF_NAMES.join(', ')}`);
  if (push.piece !== undefined && !(push.piece && (push.piece.kind === undefined || PIECE_KINDS.includes(push.piece.kind)) && (push.piece.color === undefined || COLORISH(push.piece.color)))) errs.push(`${label}.piece: { kind: ${PIECE_KINDS.join(' | ')}, size, color? }`);
  return errs;
}

/** Normalized oozes over a shelf → the one push they compose to (`null` when none pushes). `seed` places the marks. */
export function composePush(list, shelf, seed = 0) {
  const acc = new Map(), mix = { v: 0 }, tints = [], marks = [];
  for (const { id, strength: s } of list) {
    const push = shelf[id].push || {};
    for (const [path, v] of flatten(push)) {
      const kind = leafOf(path), a = acc.get(path);
      if (kind === 'mul') acc.set(path, (a ?? 1) * dmath.pow(v, s));
      else if (kind === 'add') acc.set(path, (a ?? 0) + v * s);
      else if (kind === 'max') acc.set(path, Math.max(a ?? 0, v * s));
      else if (kind === 'compound') acc.set(path, 1 - (1 - (a ?? 0)) * (1 - v * s));
      else if (kind === 'glow') acc.set(path, (a ?? false) || (v === true && s >= 0.5));
      else { acc.set(path, v); if (path === 'eyes.color') mix.v = s; }
    }
    if (push.tint) tints.push({ color: push.tint.color, amount: push.tint.amount * s, light: push.tint.light ?? 0.5, ...(push.tint.lightColor ? { lightColor: push.tint.lightColor } : {}) });
    // each mark's dice keyed by the creature's seed, its ooze and its place in that ooze's row: another ooze moves none
    if (push.marks && s >= 0.35) marks.push(...push.marks.map((m, i) => ({ ...m, seed: (m.seed ?? 0) + (fnv(`${seed}|${id}|${i}`) % 10007) })));
  }
  if (!acc.size && !tints.length && !marks.length) return null;
  const pairs = [...acc].map(([p, v]) => [p, leafOf(p) === 'mul' ? Math.min(MUL_CLAMP[1], Math.max(MUL_CLAMP[0], v)) : v]);
  if (acc.has('eyes.color')) pairs.push(['eyes.mix', mix.v]);
  return { ...unflatten(pairs), ...(tints.length ? { tints } : {}), ...(marks.length ? { marks } : {}) };
}

// ── colour ──
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const darken = (h, f) => (typeof h === 'string' && HEX.test(h) ? hex(rgb(h).map((x) => x * (1 - f))) : h);
const mixHex = (a, b, t) => (typeof a === 'string' && HEX.test(a) ? hex(rgb(a).map((x, i) => x + (rgb(b)[i] - x) * t)) : b);
const grey = (h, d) => { if (typeof h !== 'string' || !HEX.test(h)) return h; const c = rgb(h), y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; return hex(c.map((x) => x + (y - x) * d)); };
const mul = (r, m) => (Array.isArray(r) ? r.map((x) => x * m) : r * m);
const smooth = (t) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
const LIGHT = ['ash', 'ashAlt', 'belly'];   // the light values: half a darkening, `light` of a tint, so the body keeps three values
const FACE = ['iris', 'sclera', 'teeth', 'mouth', 'nose', 'ink'];   // the face's own colours: the eyes and mouth keep their contrast
// the beaked and billed families: every family names a tooth colour, so the families without fangs are named here
const TOOTHLESS = new Set(['avian', 'testudine', 'monotreme']);

/** A worn head mesh (fauna build.js `wearHeadMesh`, sized in metres nape to nose) grown by k. */
export const growMesh = (H, k) => ({ ...H, ...(H.length ? { length: H.length * k } : {}), ...(H.lift ? { lift: H.lift * k } : {}) });

// ── the animal's own colours, named by word ──
const hsl = (h) => { const [r, g, b] = rgb(h).map((x) => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l]; const s2 = d / (1 - Math.abs(2 * l - 1)); const hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [((hh * 60) + 360) % 360, s2, l]; };
const fromHsl = (h, s2, l) => { const c = (1 - Math.abs(2 * l - 1)) * s2, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return hex([r + m, g + m, b + m].map((v) => v * 255)); };
/**
 * The colour words against a coat: `suit` lighter and quieter, `armor` darker, `seam` darker still, and `accent` the one
 * bright note, a warm signal colour wherever the coat allows (a toy's light, not a cool blue). A muted coat (chroma under
 * 0.35: most animals, browns and greys) has no hue worth turning, so its accent is its own hue made vivid (amber on a
 * brown, red on a grey); a vivid warm coat steps along the warm band away from itself (an orange fox to red, a red macaw
 * to amber); a vivid cool coat takes its complement, which is warm. `opposite` is the hue across the wheel (a grey's is
 * red): the colour the body lacks, a mascot's signature piece (docs/mascot.md Ad4).
 */
export function colorWords(coat = '#7a6a58') {
  const [h, s2, l] = hsl(coat), chroma = s2 * (1 - Math.abs(2 * l - 1)), warm = h < 70 || h >= 330;
  const hue = chroma < 0.35 ? (s2 < 0.08 ? 4 : h) : !warm ? (h + 180) % 360 : (h < 15 || h >= 330) ? (h + 40) % 360 : h - 30;
  const accent = fromHsl((hue + 360) % 360, 0.85, 0.52);
  const opposite = s2 < 0.08 ? fromHsl(356, 0.72, 0.5) : fromHsl((h + 180) % 360, 0.7, 0.5);
  return { suit: grey(mixHex(coat, '#ffffff', 0.4), 0.25), armor: darken(grey(coat, 0.15), 0.5), seam: darken(coat, 0.75), accent, opposite };
}
const COLOR_PATHS = /(^|\.)(color|lightColor|motifColor)$/;
/** A composed push with every colour word resolved against the animal's own coat (a new object). */
export function resolveColorWords(push, colors) {
  if (!push) return push;
  const W = colorWords(colors?.coat), walk = (v, k = '') => (typeof v === 'string' && COLOR_PATHS.test(k) && W[v] ? W[v]
    : Array.isArray(v) ? v.map((x, i) => walk(x, `${k}.${i}`)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, walk(x, kk)])) : v);
  return walk(push);
}

/** Species params with a push's param-level half laid over them (a new object). */
export function pushParams(P, push) {
  if (!push) return P;
  const out = { ...P };
  if (push.wedge && Array.isArray(P.torso)) {
    const ys = P.torso.map((st) => st.at[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const { fore = 1, hind = 1, broad = 1 } = push.wedge;
    out.torso = P.torso.map((st) => {
      const f = smooth((st.at[1] - y0) / (y1 - y0 || 1)), r = mul(st.r, hind + (fore - hind) * f), b = 1 + (broad - 1) * f;
      return { ...st, r: Array.isArray(r) ? [r[0] * b, r[1]] : b === 1 ? r : [r * b, r] };
    });
    const gain = push.head?.pace ? dmath.pow(fore * dmath.pow(broad, 0.5), push.head.pace) : 1;
    if (gain !== 1 && P.headScale) out.headScale = P.headScale * gain;
    if (gain !== 1 && P.headMesh) out.headMesh = growMesh(P.headMesh, gain);
  }
  if (push.neck) for (const k of ['neckRA', 'neckRB', 'neckRMid']) if (P[k] !== undefined) out[k] = mul(P[k], push.neck);
  if ((push.limbs || push.boots) && Array.isArray(P.legs) && P.joints) out.legs = pushLimbs(P, { ...(push.limbs || {}), flare: push.boots?.flare ?? 1 });
  if (push.ears?.none) out.ears = false;
  else if (push.ears && Array.isArray(P.earSpine) && P.ears !== false) {
    const { height = 1, sweep = 0, drop = 0 } = push.ears, z0 = P.earSpine[1]?.[2] ?? 0;
    out.earH = (P.earH ?? 1) * height;
    out.earSpine = P.earSpine.map(([x, y, z], i) => [i < 2 ? x : x - sweep * Math.max(0, z - z0) * out.earH, y, z]);
    if (drop) out.earDrop = Math.min(120, (P.earDrop === true ? 100 : P.earDrop || 0) + drop);
  }
  if (push.smooth) { delete out.headTiles; delete out.bodyTiles; }
  // a toon eye is the set eye (one that shows: a narrow lid in the lids' colour, no dark rim), its iris big and round
  if (push.eyes?.toon) Object.assign(out, { eyeStyle: 'set', irisAngle: Math.max(P.irisAngle ?? 40, 54), pupil: 'round' });
  if (P.colors) out.colors = pushColors(P.colors, push);
  if (out.headMesh?.palette) out.headMesh = { ...out.headMesh, palette: pushMeshColors(out.headMesh.palette, push) };
  // a mark aimed at a part the body does not have (legs on a snake, a tail loft on a horse whose tail is hair)
  // paints nothing there
  const LEGS = ['legs', 'foreLegs', 'hindLegs'], legged = (P.legs || []).length > 0;
  const has = (o) => (LEGS.includes(o) ? legged : o === 'tail' ? !!P.tail : o === 'tailTip' ? !!(P.tail && P.tip) : o === 'torso' ? Array.isArray(P.torso) : o === 'neck' ? P.neckRA !== undefined : true);
  const marks = (push.marks || []).map((m) => ({ ...m, on: [m.on].flat().filter(has) }))
    .filter((m) => [m.on].flat().length).map((m) => (Array.isArray(m.on) && m.on.length === 1 ? { ...m, on: m.on[0] } : m));
  if (marks.length) {
    out.markings = [...(P.markings || []), ...marks.map(({ glow, ...m }) => m)];
    // finer rings where the marks land (the builder's `markDensity`, per part): a mark narrower than a band floods it
    const D = { ...(P.markDensity || {}) }, want = (k, n) => { D[k] = Math.max(D[k] ?? 0, n); };
    for (const m of marks) for (const on of [m.on].flat()) {
      if (['legs', 'foreLegs', 'hindLegs'].includes(on)) want('legs', LEG_DENSITY);
      else want(on, on === 'torso' ? TRUNK_DENSITY : PART_DENSITY);
    }
    out.markDensity = D;
  }
  return out;
}

/** One colour through a push's colour layers as a coat's colour is (pushColors): darkened, greyed, saturated, tinted; a
 * light value (a belly, a throat) takes half the darkening and `light` of each tint. For a body that is not a species'
 * colour table (the beast-kin's coat, beast/ooze.js). */
export function pushTone(hex, push, light = false) {
  let c = hex;
  if (push.coat) c = darken(c, light ? push.coat / 2 : push.coat);
  if (push.desaturate) c = grey(c, push.desaturate);
  if (push.saturate) c = saturate(c, push.saturate);
  for (const t of push.tints || []) c = light ? mixHex(c, t.lightColor ?? t.color, t.amount * t.light) : mixHex(c, t.color, t.amount);
  return c;
}

function pushColors(C0, push) {
  const C = { ...C0 }, body = Object.keys(C).filter((k) => !FACE.includes(k));
  if (push.coat) for (const k of body) C[k] = darken(C[k], LIGHT.includes(k) ? push.coat / 2 : push.coat);
  if (push.desaturate) for (const k of body) C[k] = grey(C[k], push.desaturate);
  if (push.saturate) for (const k of body) C[k] = saturate(C[k], push.saturate);
  for (const t of push.tints || []) for (const k of body) C[k] = LIGHT.includes(k) ? mixHex(C[k], t.lightColor ?? t.color, t.amount * t.light) : mixHex(C[k], t.color, t.amount);
  const E = push.eyes || {};
  if (E.color) C.iris = mixHex(C0.iris, E.color, E.mix ?? 1);
  if (E.socket) C.sclera = '#0b0907';
  else if (E.color && E.glow) C.sclera = darken(C.iris, 0.35);
  else if (E.toon) C.sclera = '#fbf8f2';
  if (E.toon) C.brow = C.coat;   // no dark brow over a toon eye: its slant reads as a frown
  return C;
}

// a worn head mesh's palette (its own group names) through the same colour layers: its light planes as the light values,
// its eyeball as the eye
const MESH_FACE = ['Socket', 'Eyes', 'Pupil', 'Nose', 'Mouth'], MESH_LIGHT = ['Muzzle', 'EarInset', 'FacePlanes', 'Whiskers'];
function pushMeshColors(C0, push) {
  const C = { ...C0 }, body = Object.keys(C).filter((k) => !MESH_FACE.includes(k)), lit = (k) => MESH_LIGHT.includes(k);
  if (push.coat) for (const k of body) C[k] = darken(C[k], lit(k) ? push.coat / 2 : push.coat);
  if (push.desaturate) for (const k of body) C[k] = grey(C[k], push.desaturate);
  if (push.saturate) for (const k of body) C[k] = saturate(C[k], push.saturate);
  for (const t of push.tints || []) for (const k of body) C[k] = lit(k) ? mixHex(C[k], t.lightColor ?? t.color, t.amount * t.light) : mixHex(C[k], t.color, t.amount);
  const E = push.eyes || {};
  if (E.color && C.Eyes) C.Eyes = mixHex(C0.Eyes, E.color, E.mix ?? 1);
  if (E.socket && C.Socket) C.Socket = '#0b0907';
  return C;
}

// each leg chain by the girdle it hangs from (its root joint ahead of the trunk's middle is fore), its foot the last row
// `flare` (boots): the last joint above each foot widened toward the foot, the foot's own ring with it: a cone
function pushLimbs(P, { fore = 1, hind = 1, paws = 1, flare = 1 }) {
  const ys = (P.torso || []).map((st) => st.at[1]), mid = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
  const byTo = new Map(P.legs.map((r) => [r[2], r])), froms = new Set(P.legs.map((r) => r[1]));
  const rootOf = (r) => { let j = r[1]; for (let i = 0; i < 16 && byTo.has(j); i++) j = byTo.get(j)[1]; return j; };
  return P.legs.map((row) => {
    const [name, from, to, rA, rB, group, over, rMid, ...rest] = row;
    const root = P.joints[rootOf(row)], k = root && root[1] > mid ? fore : hind;
    const foot = !froms.has(to), ankle = !foot && P.legs.some((r) => r[1] === to && !froms.has(r[2]));
    const ka = foot ? k * paws * flare : k, kb = foot ? k * paws * dmath.pow(flare, 0.5) : ankle ? k * dmath.pow(paws, 0.5) * flare : k;
    return [name, from, to, mul(rA, ka), mul(rB, kb), group, over, rMid === undefined ? rMid : mul(rMid, (ka + kb) / 2), ...rest].slice(0, row.length);
  });
}

/**
 * A built plan with a push's plan-level half laid over it (the plan given is not touched). The face (`head` and
 * `expression`) is seated as the fauna builder seats an eye (build.js `seatOrbit`): a head too small or too tight for
 * the whole push cannot place its lids, so the face steps back (three quarters, half, a quarter, none) until it seats.
 * A grown eye (`head.eye` over 1) and the rest face are the likeliest not to seat, so they step back alone first (the
 * eye's growth to three quarters, half, none; then the face's controls to half, none) and the rest of the face (the
 * skull, the muzzle, the head's ornaments) keeps its whole share until both are gone. `report.face` says how much of
 * the face was drawn, `report.eye` and `report.expression` how much of each when it alone stepped back.
 */
export function pushPlan(plan, push, P, report = {}) {
  if (!push) return plan;
  const faced = push.head || push.expression || push.horns || push.cheeks || push.earDomes || push.gem || push.antenna || push.piece?.kind === 'bow';
  const eyes = push.head?.eye > 1 ? [0.75, 0.5, 0] : [], last = eyes.length ? 0 : 1;
  const exprs = push.expression ? [0.5, 0] : [], x0 = exprs.length ? 0 : 1;
  const steps = !faced ? [[1, 1, 1]] : [[1, 1, 1], ...eyes.map((e) => [1, e, 1]), ...exprs.map((x) => [1, last, x]), ...[0.75, 0.5, 0.25, 0].map((f) => [f, last, x0])];
  for (const [f, e, x] of steps) {
    const at = f === 1 ? push : faceAt(push, f);
    const { expression, ...rest } = at;
    const out = pushOnce(plan, { ...rest, ...(e < 1 && at.head?.eye ? { head: { ...at.head, eye: dmath.pow(at.head.eye, e) } } : {}),
      ...(expression && x > 0 ? { expression: x === 1 ? expression : Object.fromEntries(Object.entries(expression).map(([k, v]) => [k, v * x])) } : {}) }, P);
    if (!faced) return out;
    try {
      expandPlan(out); report.face = f;
      if (e < 1 && eyes.length) report.eye = e;
      if (x < 1 && exprs.length) report.expression = x;
      return out;
    } catch (err) { if (!/projectOnto: no hit/.test(String(err?.message)) || f === 0) throw err; }
  }
  return plan;
}

// the face's pushes at a share f: its multipliers raised to f, its controls × f (`pace` is the body's: it stays)
function faceAt(push, f) {
  const { head, expression, horns, cheeks, earDomes, gem, antenna, ...rest } = push;
  if (f > 0 && antenna) rest.antenna = { ...antenna, size: antenna.size * f };
  if (rest.piece?.kind === 'bow') { if (f > 0) rest.piece = { ...rest.piece, size: rest.piece.size * f }; else delete rest.piece; }
  if (f > 0 && horns) rest.horns = { ...horns, size: horns.size * f };
  if (f > 0 && cheeks) rest.cheeks = { ...cheeks, size: cheeks.size * f };
  if (f > 0 && earDomes) rest.earDomes = { ...earDomes, size: earDomes.size * f };
  if (f >= 0.5 && gem) rest.gem = gem;
  const H = head && unflatten(flatten(head).map(([k, v]) => [k, k === 'pace' ? v : dmath.pow(v, f)]));
  const E = expression && Object.fromEntries(Object.entries(expression).map(([k, v]) => [k, v * f]));
  return { ...rest, ...(f > 0 && H ? { head: H } : {}), ...(f > 0 && E ? { expression: E } : {}) };
}

function pushOnce(plan, push, P) {
  const out = structuredClone(plan), H = out.heads?.[0];
  if (H && (push.head || push.fangs)) H.plan = pushHead(H.plan, push, P);
  if (H && push.expression) H.expression = Object.fromEntries(Object.entries(push.expression).map(([k, v]) => [k, +v.toFixed(4)]));
  if (push.hackles?.count && push.hackles.height > 0) hackles(out, push.hackles, P);
  const orn = ornaments(out, push, P);
  const glow = [
    ...orn.glow,
    ...(push.eyes?.glow ? (push.eyes.socket ? ['Iris', 'Limbus'] : ['Sclera', 'Iris', 'Limbus']) : []),
    ...(push.eyes?.glow && P.headMesh?.palette?.Eyes ? ['Eyes'] : []),
    ...(push.hackles?.glow && push.hackles.count ? ['Hackle'] : []),
    ...(push.marks || []).filter((m) => m.glow).map((m) => m.group),
    ...(push.extraGlow || []),
  ];
  if (glow.length) out.emissive = [...new Set([...(out.emissive || []), ...glow])];
  if (push.surfaces || orn.material || orn.surfaces) out.surfaces = { ...(out.surfaces || {}), ...(orn.surfaces || {}), ...(orn.material ? { Motif: orn.material } : {}), ...(push.surfaces || {}) };
  return out;
}

// ── ORNAMENTS: what a creature grows, in its motif. Each on joints or head rows of its own; no species joint moves ──
const r6 = (x) => +x.toFixed(6);
const v3 = (v) => v.map(r6);
const frontR = (r) => (Array.isArray(r) ? r[1] : r);
/** a loft station's centre and its top (a level loft's front slot is up), from a radius or (stable rings) its points */
function stationTop(st) {
  if (st.points) { const pts = Object.values(st.points), c = [0, 1, 2].map((i) => pts.reduce((a, p) => a + p[i], 0) / pts.length); return { c, top: st.points.front ?? [c[0], c[1], c[2] + 0.01] }; }
  return { c: st.at, top: [st.at[0], st.at[1], st.at[2] + frontR(st.r)] };
}
// the trunk's depth (its deepest half-height): every ornament is sized against the body it stands on
const depthOf = (plan) => { const t = plan.segments.find((g) => g.name === 'torso'); return t ? Math.max(...t.stations.map((st) => { const { c, top } = stationTop(st); return top[2] - c[2]; })) : 0.1; };
function cone(plan, name, A, B, rA, mirror) {
  plan.joints[`${name}A`] = v3(A); plan.joints[`${name}B`] = v3(B);
  plan.segments.push({ name: mirror === 'name' ? `${name}R` : name, kind: 'segment', from: `${name}A`, to: `${name}B`, rA: [r6(rA), r6(rA * 1.15)], rB: [r6(rA * 0.08), r6(rA * 0.08)], slots: 'ring12', group: 'Motif', mirror, over: [0.3, 0.2] });
}

function ornaments(plan, push, P) {
  const M = MOTIFS[push.motif ?? 'horn'], out = { glow: [], material: null };
  armorAndGroups(plan, push, out);
  // the signature piece first: it carries its own colours, not the motif's (a bow is drawn with the head's ornaments)
  const piece = push.piece?.size ? wearPiece(plan, push.piece, out) : null;
  const any = piece === 'bow' || push.horns?.size || push.plates?.count || push.cheeks?.size || push.pauldrons?.size || push.earDomes?.size || push.gem || push.pistons?.size || push.jointBalls?.size || push.antenna?.size || push.shoulders?.size || push.spurs?.size || push.tailSpikes?.count || push.ruff?.size || push.bands;
  // the tail's tip burns in the motif's colour (a dark tip glowing is still dark)
  if (push.tipGlow) { out.glow.push('Tip'); plan.palette = { ...plan.palette, Tip: M.glow ? M.color : (push.eyes?.color ?? M.color) }; }
  if (!any) return out;
  // VALUE: the ornament a clear step from the coat it stands on (value.js: local contrast), else it vanishes into it
  const color = push.motifColor ?? valueStep(M.color, P.colors?.coat, M.glow || push.motifGlow);
  plan.palette = { ...plan.palette, Motif: color };
  if (M.glow || push.motifGlow) out.glow.push('Motif');
  if (M.material) out.material = M.material;
  // armour no ooze coloured is the motif's
  if (!push.armor?.color && (push.pauldrons?.size || push.earDomes?.size || push.pistons?.size || push.jointBalls?.size || push.antenna?.size)) armorAndGroups(plan, { armor: { color, ...(M.material ? { material: M.material } : {}) } }, out);
  const J = plan.joints, depth = depthOf(plan), H = plan.heads?.[0]?.plan;
  // HORNS and CHEEK SPURS: sweeps in the head's own units, rooted inside the skull on its own rows (behind the brow;
  // at the cheek), sized in the skull's length, so every head takes them at its own scale
  if (H && (piece === 'bow' || push.horns?.size || push.cheeks?.size || push.earDomes?.size || push.gem || push.antenna?.size)) {
    const C = H.parts.cranium, Lh = C.caps.tip[1] - C.caps.back[1], row = (i) => C.rows[Math.min(i, C.rows.length - 1)];
    const xz = (S, k) => (Array.isArray(S[k]) ? S[k] : [0, S[k]]), orn = [];
    if (push.horns?.size) {
      const [, y, S] = row(1), [cx, cz] = xz(S, 'crown'), L = 0.6 * Lh * push.horns.size, c = push.horns.curl ?? M.curl;
      const root = [cx * 0.85, y, cz * 0.9], tpl = [[0, 0, 0], [0.08, -0.15, 0.2], [0.15, -0.4, 0.35], [0.2, -0.68, 0.38 - 0.25 * c], [0.22, -0.9, 0.3 - 0.55 * c]];
      orn.push({ kind: 'sweep', name: 'oozeHorn', at: [1, 1], space: 'head', spine: tpl.map((q) => v3(q.map((x, i) => root[i] + x * L))), radii: [0.18, 0.15, 0.11, 0.07, 0.015].map((r) => r6(r * L)), m: 8, group: 'Motif' });
      if (push.horns.pairs >= 2) {   // the crown: a second pair at the brow, smaller, rising forward
        const [, y2, S2] = row(2), [bx, bz] = xz(S2, 'brow'), L2 = 0.55 * L, root2 = [bx * 0.8, y2, bz * 0.95];
        orn.push({ kind: 'sweep', name: 'oozeCrown', at: [2, 2], space: 'head', spine: [[0, 0, 0], [0.06, 0.1, 0.25], [0.1, 0.22, 0.45], [0.12, 0.3, 0.6]].map((q) => v3(q.map((x, i) => root2[i] + x * L2))), radii: [0.2, 0.15, 0.08, 0.015].map((r) => r6(r * L2)), m: 8, group: 'Motif' });
      }
    }
    if (push.cheeks?.size) {
      const [, y, S] = row(2), [cx, cz] = xz(S, 'cheek'), L = 0.35 * Lh * push.cheeks.size, root = [cx * 0.9, y, cz];
      orn.push({ kind: 'sweep', name: 'oozeCheek', at: [2, 3], space: 'head', spine: [[0, 0, 0], [0.25, -0.2, 0.05], [0.4, -0.55, 0.1], [0.45, -0.85, 0.12]].map((q) => v3(q.map((x, i) => root[i] + x * L))), radii: [0.13, 0.1, 0.06, 0.012].map((r) => r6(r * L)), m: 8, group: 'Motif' });
    }
    if (push.earDomes?.size) {   // a round dome on each side of the skull, over where the ear stood
      const [, y, S] = row(Math.max(1, Math.round(P.earAt?.[0] ?? 1))), [cx, cz] = xz(S, 'crown'), L = 0.22 * Lh * push.earDomes.size, root = [cx * 0.9, y, cz * 0.55];
      orn.push({ kind: 'sweep', name: 'oozeEarDome', at: [1, 2], space: 'head', spine: [[0, 0, 0], [0.3, 0, 0], [0.5, 0, 0]].map((q) => v3(q.map((x, i) => root[i] + x * L))), radii: [0.55, 0.5, 0.2].map((r) => r6(r * L)), m: 10, group: 'Armor' });
    }
    if (push.gem) {   // a gem on the brow's midline, standing a little proud
      const [, y, S] = row(2), top = typeof S.top === 'number' ? S.top : xz(S, 'top')[1], L = 0.12 * Lh, root = [0.01 * Lh, y, top];
      orn.push({ kind: 'sweep', name: 'oozeGem', at: [2, 0], space: 'head', spine: [[0, 0, -0.2], [0, 0.15, 0.25], [0, 0.3, 0.3]].map((q) => v3(q.map((x, i) => root[i] + x * L))), radii: [0.45, 0.4, 0.05].map((r) => r6(r * L)), m: 6, group: 'Motif' });
    }
    if (push.antenna?.size) {   // twin antennae off the crown, a thin rod and a ball at its tip
      const [, y, S] = row(1), [cx, cz] = xz(S, 'crown'), L = 0.5 * Lh * push.antenna.size, root = [cx * 0.45, y, cz * 0.9];
      const tip = [root[0] + 0.12 * L, root[1] - 0.15 * L, root[2] + L];
      orn.push({ kind: 'sweep', name: 'oozeAntenna', at: [1, 1], space: 'head', spine: [root, [root[0] + 0.05 * L, root[1] - 0.06 * L, root[2] + 0.5 * L], tip].map(v3), radii: [0.05, 0.035, 0.03].map((r) => r6(r * L)), m: 6, group: 'Armor' });
      orn.push({ kind: 'sweep', name: 'oozeAntennaTip', at: [1, 1], space: 'head', spine: [[0, 0, -0.08], [0, 0, 0], [0, 0, 0.08]].map((q) => v3(q.map((x, i) => tip[i] + x * L))), radii: [0.04, 0.1, 0.04].map((r) => r6(r * L)), m: 8, group: 'Motif' });
    }
    if (piece === 'bow') {   // a bow on the crown: two lobes out to the sides and a knot, sized to the skull
      // sized to the skull: its length, its width or its height, the least (a frog's flat head, a crocodile's long one)
      const [, y, S] = row(1), top = typeof S.top === 'number' ? S.top : xz(S, 'top')[1], low = typeof S.palate === 'number' ? S.palate : top - 0.5 * Lh;
      const cw = 2 * Math.max(...Object.values(S).map((v) => (Array.isArray(v) ? Math.abs(v[0]) : 0))) || Lh;
      const L = 0.55 * Math.min(Lh, cw, 1.6 * (top - low)) * push.piece.size, root = [0.02 * Lh, y, top + 0.04 * L];
      orn.push({ kind: 'sweep', name: 'oozeBow', at: [1, 0], space: 'head', spine: [[0, 0, 0], [0.35, 0.05, 0.22], [0.62, 0.02, 0.18]].map((q) => v3(q.map((x, i) => root[i] + x * L))), radii: [0.1, 0.3, 0.12].map((r) => r6(r * L)), m: 10, group: 'Piece' });
      orn.push({ kind: 'sweep', name: 'oozeBowKnot', at: [1, 0], space: 'head', spine: [[0, -0.1, 0], [0, 0, 0.03], [0, 0.1, 0]].map((q) => v3(q.map((x, i) => root[i] + x * L))), radii: [0.08, 0.15, 0.08].map((r) => r6(r * L)), m: 10, group: 'Shine' });
    }
    H.ornaments = [...(H.ornaments || []), ...orn];
    H.palette = { ...H.palette, Motif: color, ...(push.armor?.color ? { Armor: push.armor.color } : {}) };
  }
  // PLATES: a ridge from the nape over the back and down the tail to its tip, tallest over the hips, each a thin kite
  // standing on the dorsal line (thin across, long fore and aft)
  if (push.plates?.count) {
    const torso = plan.segments.find((g) => g.name === 'torso'), tail = plan.segments.find((g) => g.name === 'tail'), tip = plan.segments.find((g) => g.name === 'tailTip'), neck = plan.segments.find((g) => g.name === 'neck');
    const line = [];
    if (neck && J.neckTop && J.neckBase) line.push([J.neckTop[1], J.neckTop[2] + 0.8 * frontR(neck.rB)], [J.neckBase[1], J.neckBase[2] + frontR(neck.rA)]);
    if (torso) line.push(...[...torso.stations].map((st) => stationTop(st).top).sort((a, b) => b[1] - a[1]).map((p) => [p[1], p[2]]));
    for (const g of [tail, tip]) if (g?.stations) line.push(...g.stations.map((st) => stationTop(st).top).map((p) => [p[1], p[2]]));
    if (line.length >= 2) {
      const segL = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1])), total = segL.reduce((a, b) => a + b, 0);
      const at = (u) => { let d = u * total; for (let i = 0; i < segL.length; i++) { if (d <= segL[i] || i === segL.length - 1) { const f = segL[i] ? Math.min(1, d / segL[i]) : 0; return [line[i].map((x, c) => x + (line[i + 1][c] - x) * f), [line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]]]; } d -= segL[i]; } return [line.at(-1), [-1, 0]]; };
      const n = Math.max(2, Math.round(push.plates.count)), H = push.plates.height * depth;
      for (let i = 0; i < n; i++) {
        const u = 0.06 + (0.9 * i) / (n - 1), [[y, z], [dy, dz]] = at(u), dl = Math.hypot(dy, dz) || 1;
        const h = H * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, u * 1.15))) * (i % 2 ? 0.8 : 1), nx = [-dz / dl, dy / dl];   // the line's normal, up off the back
        const up = nx[1] < 0 ? [-nx[0], -nx[1]] : nx, name = `oozePlate${i}`;
        J[`${name}A`] = v3([0, y - 0.25 * h * up[0], z - 0.25 * h * up[1]]); J[`${name}B`] = v3([0, y + h * up[0] - 0.15 * h * (dy / dl), z + h * up[1] - 0.15 * h * (dz / dl)]);
        plan.segments.push({ name, kind: 'segment', from: `${name}A`, to: `${name}B`, rA: [r6(0.06 * h), r6(0.42 * h)], rB: [r6(0.01 * h), r6(0.04 * h)], slots: 'ring12', group: 'Motif', mirror: 'plane', over: [0.3, 0.2] });
      }
    }
  }
  // PAULDRONS: a ball over each shoulder, long fore and aft, in the armour (rides the shoulder's bone)
  if (push.pauldrons?.size && J.shoulder) {
    // a round ball: a loft of rings on a circle's profile, fore to aft, capped at its poles
    const h = 0.55 * depth * push.pauldrons.size, c = [J.shoulder[0] + 0.3 * h, J.shoulder[1], J.shoulder[2] + 0.35 * h], n = 7;
    const stations = Array.from({ length: n }, (_, i) => { const u = (i + 0.5) / n, y = c[1] + h * (2 * u - 1), rr = h * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)); return { at: v3([c[0], y, c[2]]), r: r6(rr) }; });
    plan.segments.push({ name: 'oozePauldronR', kind: 'loft', slots: 'ring12', group: 'Armor', mirror: 'name', stations, caps: { back: v3([c[0], c[1] - h, c[2]]), tip: v3([c[0], c[1] + h, c[2]]) } });
  }
  // JOINT BALLS: a round ball at every joint down each leg (the end of each row but the foot's), a little wider than the
  // limb there, in the armour: the toy's ball joints; each rides the limb it caps
  if (push.jointBalls?.size && Array.isArray(P.legs)) {
    const froms = new Set(P.legs.map((r) => r[1]));
    for (const row of P.legs.filter((r) => froms.has(r[2]))) {
      const seg = plan.segments.find((g) => g.name === row[0]), c = J[row[2]];
      if (!seg || !c) continue;
      const rad = (v) => (v === undefined ? NaN : Math.max(...[v].flat())), rb = rad(seg.rB);
      const h = (Number.isFinite(rb) && rb > 0 ? rb : 0.05 * depth) * 1.3 * push.jointBalls.size, n = 5, name = `oozeJoint${row[0].replace(/R$/, '')}R`;
      const stations = Array.from({ length: n }, (_, i) => { const u = (i + 0.5) / n; return { at: v3([c[0], c[1] + h * (2 * u - 1), c[2]]), r: r6(h * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2))) }; });
      plan.segments.push({ name, kind: 'loft', slots: 'ring12', group: 'Armor', mirror: 'name', stations, caps: { back: v3([c[0], c[1] - h, c[2]]), tip: v3([c[0], c[1] + h, c[2]]) } });
    }
  }
  // PISTONS: a rod along the outside of each upper limb, half sunk in it, from its top joint most of the way down
  if (push.pistons?.size && Array.isArray(P.legs)) {
    const tos = new Set(P.legs.map((r) => r[2]));
    for (const row of P.legs.filter((r) => !tos.has(r[1]))) {
      const seg = plan.segments.find((g) => g.name === row[0]), A = J[row[1]], Bj = J[row[2]];
      if (!seg || !A || !Bj) continue;
      // the limb's radius: its own, else (a stable-ring leg, its rings as points) a share of its length
      const rad = (v) => (v === undefined ? NaN : Math.max(...[v].flat())), len = Math.hypot(...Bj.map((x, i) => x - A[i]));
      const r0 = rad(seg.rA), r = Number.isFinite(r0) && r0 > 0 ? r0 : 0.18 * len, off = [0.85 * r, -0.35 * r, 0], name = `oozePiston${row[0].replace(/R$/, '')}`;
      const a = A.map((x, i) => x + off[i]), b = A.map((x, i) => x + 0.8 * (Bj[i] - x) + off[i]), rr = 0.16 * r * push.pistons.size;
      J[`${name}A`] = v3(a); J[`${name}B`] = v3(b);
      plan.segments.push({ name: `${name}R`, kind: 'segment', from: `${name}A`, to: `${name}B`, rA: [r6(rr), r6(rr)], rB: [r6(0.7 * rr), r6(0.7 * rr)], slots: 'ring12', group: 'Armor', mirror: 'name', over: [0.2, 0.2] });
    }
  }
  // SHOULDER SPIKES: one off each shoulder, standing up and out of the body's side above the joint
  if (push.shoulders?.size && J.shoulder) {
    const h = 1.2 * depth * push.shoulders.size, A = [J.shoulder[0], J.shoulder[1], J.shoulder[2] + 0.15 * depth];
    cone(plan, 'oozeShoulder', A, [A[0] + 0.45 * h, A[1] - 0.25 * h, A[2] + 0.85 * h], 0.22 * h, 'name');
  }
  // ELBOW SPURS: behind the first joint down each foreleg, swept back
  const fore = forelegRow(P);
  if (push.spurs?.size && fore && J[fore[2]]) {
    const E = J[fore[2]], h = 0.8 * depth * push.spurs.size;
    cone(plan, 'oozeSpur', [E[0], E[1] + 0.1 * h, E[2]], [E[0] + 0.15 * h, E[1] - h, E[2] + 0.25 * h], 0.2 * h, 'name');
  }
  // TAIL SPIKES: along the top of the tail, smaller toward the tip, leaning away down its length
  const tail = plan.segments.find((g) => g.name === 'tail');
  if (push.tailSpikes?.count && tail?.stations?.length > 1) {
    const sts = tail.stations.map(stationTop), n = Math.max(1, Math.round(push.tailSpikes.count)), size = push.tailSpikes.size ?? 1;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.4 : 0.15 + (0.7 * i) / (n - 1), x = u * (sts.length - 1), k = Math.min(sts.length - 2, Math.floor(x)), f = x - k;
      const lerp = (a, b) => a.map((v, c) => v + (b[c] - v) * f), top = lerp(sts[k].top, sts[k + 1].top), dir = sts[k + 1].c.map((v, c) => v - sts[k].c[c]);
      const dl = Math.hypot(...dir) || 1, h = 0.85 * depth * size * (1 - 0.5 * u);
      cone(plan, `oozeTail${i}`, [top[0], top[1], top[2] - 0.3 * h], top.map((v, c) => v + (dir[c] / dl) * 0.5 * h + (c === 2 ? h : 0)), 0.22 * h, 'plane');
    }
  }
  // THE RUFF: tiles round the neck (the avian ruff's grammar), in the coat's own colours (a quiet mass, not noise)
  if (push.ruff?.size && plan.segments.some((g) => g.name === 'neck')) {
    plan.body = { ...(plan.body || {}), tiles: [...(plan.body?.tiles || []), { id: 'oozeRuff', parts: ['neck'], s: [0.3, 1.3], t: [0, 6], grid: [8, 4], brick: true, sides: 3, coverage: 1.5, inset: 0.9, height: r6(0.22 * depth * push.ruff.size), lean: -1.2, edgeFade: 0.2, thin: 0.3, wobble: 0.3, jitter: 0.3, group: ['Coat', 'Mane'] }] };
  }
  // BANDS: the motif round each lower leg (the last joint above each foot)
  if (push.bands && Array.isArray(P.legs)) {
    const froms = new Set(P.legs.map((r) => r[1])), feet = new Set(P.legs.filter((r) => !froms.has(r[2])).map((r) => r[1]));
    const ankles = P.legs.filter((r) => feet.has(r[2])).map((r) => r[0].replace(/R$/, ''));
    plan.paint = [...(plan.paint || []), ...ankles.map((part) => ({ part, run: [0.55, 1], t: [0, 1], group: 'Motif' }))];
  }
  return out;
}
// THE SIGNATURE PIECE (docs/mascot.md Ad1–Ad6): one piece, on a silhouette edge (the neck, the crown, the back), big
// and simple, in the colour the body lacks (satin) with one gold shine on its signature; it rides the neck's bones and
// never covers the face. A neck piece is a band round the neck low on it (wider than the neck there) and its signature
// hung at the throat or trailed behind; a body with no neck wears the bow, a body with no trunk too. → the kind drawn.
function wearPiece(plan, piece, out) {
  const J = plan.joints, neck = plan.segments.find((g) => g.name === 'neck'), torso = plan.segments.find((g) => g.name === 'torso'), k = piece.size;
  let kind = piece.kind ?? 'bow';
  if (kind === 'pack' ? !torso?.stations?.length : kind !== 'bow' && !(neck?.kind === 'segment' && J[neck.from] && J[neck.to])) kind = 'bow';
  const H = plan.heads?.[0]?.plan, paint = (g, c) => { plan.palette = { ...plan.palette, [g]: c }; if (H) H.palette = { ...H.palette, [g]: c }; };
  paint('Piece', piece.color && HEX.test(piece.color) ? piece.color : '#c8323c'); paint('Shine', '#f0c24a');
  out.surfaces = { ...(out.surfaces || {}), Piece: 'satin', Shine: 'gold' };
  if (kind === 'bow') return kind;
  const ball = (name, c, h, group, n = 5) => plan.segments.push({ name, kind: 'loft', slots: 'ring12', group,
    stations: Array.from({ length: n }, (_, i) => { const u = (i + 0.5) / n; return { at: v3([c[0], c[1] + h * (2 * u - 1), c[2]]), r: r6(h * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2))) }; }),
    caps: { back: v3([c[0], c[1] - h, c[2]]), tip: v3([c[0], c[1] + h, c[2]]) } });
  const seg = (name, a, b, rA, rB, group) => { J[`${name}A`] = v3(a); J[`${name}B`] = v3(b); plan.segments.push({ name, kind: 'segment', from: `${name}A`, to: `${name}B`, rA: rA.map(r6), rB: rB.map(r6), slots: 'ring12', group, over: [0.2, 0.2] }); };
  const add = (p, d, t) => p.map((x, i) => x + d[i] * t);
  if (kind === 'pack') {   // a rounded pack over the withers, a strap of the piece round the chest under it, a gold clasp
    const sts = torso.stations.map(stationTop).sort((a, b) => b.c[1] - a.c[1]), at = sts[Math.min(sts.length - 1, Math.round(0.3 * (sts.length - 1)))];
    const depth = depthOf(plan), h = 0.42 * depth * k, c = [0, at.top[1], at.top[2] + 0.45 * h];
    plan.segments.push({ name: 'oozePack', kind: 'loft', slots: 'ring12', group: 'Piece',
      stations: Array.from({ length: 6 }, (_, i) => { const u = (i + 0.5) / 6, w = Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)); return { at: v3([0, c[1] + 1.2 * h * (2 * u - 1), c[2]]), r: [r6(1.1 * h * Math.max(0.35, w)), r6(0.75 * h * Math.max(0.35, w))] }; }),
      caps: { back: v3([0, c[1] - 1.2 * h, c[2]]), tip: v3([0, c[1] + 1.2 * h, c[2]]) } });
    ball('oozePackClasp', [0, c[1] - 1.15 * h, c[2]], 0.22 * h, 'Shine');
    const ys = torso.stations.map((st) => stationTop(st).c[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), u = (at.c[1] - y0) / (y1 - y0 || 1);
    plan.paint = [...(plan.paint || []), { part: 'torso', run: [Math.max(0, u - 0.05), Math.min(1, u + 0.05)].map(r6), t: [0, 1], group: 'Piece' }];
    return kind;
  }
  // the band: low on the neck (a third of the way up), its rings a little proud of the neck's own
  const A = J[neck.from], B = J[neck.to], d0 = B.map((x, i) => x - A[i]), len = Math.hypot(...d0), d = d0.map((x) => x / len);
  const pr = (r) => (Array.isArray(r) ? r : [r, r]), rA = pr(neck.rA), rB = pr(neck.rB), at = (u) => [0, 1].map((i) => rA[i] + (rB[i] - rA[i]) * u);
  const wide = kind === 'studs' ? 0.26 : 0.16, u0 = 0.3, u1 = u0 + wide, ra = at(u0).map((x) => x * 1.16), rb = at(u1).map((x) => x * 1.16);
  seg('oozeCollar', add(A, d0, u0), add(A, d0, u1), ra, rb, 'Piece');
  // down the throat: the world's down with the neck's axis taken out of it; the band's centre and its depth there
  const dz = [0, 0, -1], dd = dz.map((x, i) => x - d[i] * (d[2] * -1)), dl = Math.hypot(...dd), down = dd.map((x) => x / (dl || 1));
  const c = add(A, d0, (u0 + u1) / 2), rf = Math.max((ra[1] + rb[1]) / 2, 1e-4), rs = Math.max((ra[0] + rb[0]) / 2, 1e-4), back = [0, -1, 0];
  if (kind === 'bell') ball('oozeBell', add(c, down, rf + 0.38 * rf * k), 0.42 * rf * k, 'Shine', 7);
  else if (kind === 'medal') {   // a gold disc facing forward, hung a little below the band
    const m = add(c, down, rf + 0.6 * rf * k), R = 0.55 * rf * k;
    plan.segments.push({ name: 'oozeMedal', kind: 'loft', slots: 'ring12', group: 'Shine', stations: [-1, 0, 1].map((s) => ({ at: v3([m[0], m[1] + 0.12 * R * s, m[2]]), r: r6(R * (s ? 0.85 : 1)) })), caps: { back: v3([m[0], m[1] - 0.15 * R, m[2]]), tip: v3([m[0], m[1] + 0.15 * R, m[2]]) } });
  } else if (kind === 'bandana') {   // a triangle hung down the front from the band, its knot at the nape
    const top = add(c, down, 0.8 * rf);
    seg('oozeBandana', top, add(add(top, down, 1.5 * rf * k), d, 0.25 * rf), [0.95 * rs * k, 0.18 * rf], [0.06 * rf, 0.04 * rf], 'Piece');
    ball('oozeBandanaKnot', add(c, down, -rf), 0.3 * rf * k, 'Piece');
  } else if (kind === 'scarf') {   // a tail streaming back from the nape over the withers, a shorter one under it, a gold pin
    const nape = add(c, down, -0.85 * rf);
    seg('oozeScarfTail', nape, add(add(nape, back, 2.6 * rf * k), down, 0.6 * rf * k), [0.5 * rs, 0.12 * rf], [0.42 * rs, 0.08 * rf], 'Piece');
    seg('oozeScarfTail2', add(nape, down, 0.15 * rf), add(add(nape, back, 1.7 * rf * k), down, 1.0 * rf * k), [0.4 * rs, 0.1 * rf], [0.34 * rs, 0.07 * rf], 'Piece');
    ball('oozeScarfPin', add(c, down, rf), 0.18 * rf * k, 'Shine');
  } else if (kind === 'studs') {   // gold studs round the front half of a wide collar
    for (const [i, a] of [-80, -40, 0, 40, 80].entries()) {
      const t = (a * Math.PI) / 180, dir = [Math.sin(t), down[1] * Math.cos(t), down[2] * Math.cos(t)], l = Math.hypot(...dir), rr = Math.abs(Math.sin(t)) * rs + Math.cos(t) * rf;
      ball(`oozeStud${i}`, add(c, dir.map((x) => x / l), rr * 1.02), 0.16 * rf * k, 'Shine');
    }
  }
  return kind;
}

// a colour's lightness (L*, 0 … 100) and the motif's colour moved a clear step (28 L*) from the coat's: lighter on a
// dark coat, darker on a light one (a glowing one only lighter), its hue kept
const lum = (h) => { const c = rgb(h).map((x) => { const v = x / 255; return v <= 0.04045 ? v / 12.92 : dmath.pow((v + 0.055) / 1.055, 2.4); }); const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return y > 0.008856 ? 116 * dmath.cbrt(y) - 16 : 903.3 * y; };
export function valueStep(m, coat, glow = false) {
  if (typeof coat !== 'string' || !HEX.test(coat) || !HEX.test(m)) return m;
  const Lc = lum(coat), Lm = lum(m);
  if (Math.abs(Lm - Lc) >= 28 || (glow && Lm >= Lc)) return m;   // a glowing ornament carries its own contrast: only ever lighter
  const target = glow || Lc < 50 ? Math.min(92, Lc + 34) : Math.max(10, Lc - 34);
  for (let t = 0; t <= 1.0001; t += 0.05) { const h = target > Lm ? mixHex(m, '#ffffff', t) : mixHex(m, '#000000', t); if (Math.abs(lum(h) - target) < 3 || (target > Lm ? lum(h) >= target : lum(h) <= target)) return h; }
  return m;
}

// ARMOUR (the pauldrons', the domes', the pistons' colour and material) and GROUPS (a palette group recoloured and given
// a material everywhere it is drawn: the body's palette, the head's, a worn head mesh's)
function armorAndGroups(plan, push, out) {
  const H = plan.heads?.[0]?.plan;
  const paint = (g, color) => { plan.palette = { ...plan.palette, [g]: color }; if (H) H.palette = { ...H.palette, [g]: color }; };
  if (push.armor?.color) { paint('Armor', push.armor.color); if (push.armor.material) out.surfaces = { ...(out.surfaces || {}), Armor: push.armor.material }; if (push.armor.glow) out.glow.push('Armor'); }
  for (const [g, v] of Object.entries(push.groups || {})) {
    if (v.color) paint(g, v.color);
    if (v.material) out.surfaces = { ...(out.surfaces || {}), [g]: v.material };
    if (v.glow) out.glow.push(g);
  }
}

// the foreleg's first row (from the girdle ahead of the trunk's middle)
function forelegRow(P) {
  if (!Array.isArray(P.legs) || !P.joints) return null;
  const tos = new Set(P.legs.map((r) => r[2])), roots = P.legs.filter((r) => !tos.has(r[1]));
  return roots.reduce((b, r) => (!b || P.joints[r[1]]?.[1] > P.joints[b[1]]?.[1] ? r : b), null);
}

function pushHead(head, push, P) {
  const rows = head.parts.cranium.rows, pivot = rows[Math.min(P.muzzleFrom ?? 3, rows.length - 1)][1];
  const h = push.head || {}, moves = [];
  if (h.skull) moves.push({ op: 'skull', pivot, width: h.skull.width ?? 1, height: h.skull.height ?? 1 });
  if (h.muzzle) moves.push({ op: 'muzzle', pivot, length: h.muzzle.length ?? 1, width: h.muzzle.width ?? 1, height: h.muzzle.height ?? 1 });
  const D = { moves };
  if (h.eye) D.eye = { R: +(head.regions.eye.R * h.eye).toFixed(5) };
  if (h.brow && head.regions.brow) D.regions = { brow: { w: +(head.regions.brow.w * h.brow).toFixed(5), h: +(head.regions.brow.h * h.brow).toFixed(5) } };
  // FANGS: a toothed head with a jaw of three rows or more takes two short rows, a big canine leading the incisors, on
  // the lip line of the muzzle (the wolf library head's rows, placed by row count)
  if (push.fangs && !TOOTHLESS.has(P.family) && head.parts.jaw.rows.length >= 3) {
    const nc = rows.length - 1, nj = head.parts.jaw.rows.length - 1, f = push.fangs;
    D.ornaments = { add: [
      { kind: 'teeth', part: 'cranium', from: +(nc * 0.7).toFixed(3), to: +(nc * 0.93).toFixed(3), t: 5.5, sizes: [+(0.036 * f).toFixed(4), 0.014, 0.012], down: [0, 0, -1], tag: 'fang' },
      { kind: 'teeth', part: 'jaw', from: +(nj * 0.68).toFixed(3), to: +(nj * 0.94).toFixed(3), t: 0.88, sizes: [+(0.026 * f).toFixed(4), 0.012], down: [0, 0, 1], tag: 'fangLow' },
    ] };
  }
  return deriveHead(head, D);
}

// HACKLES: spikes along the dorsal line, from just behind the nape over the withers to mid-back, tallest over the
// shoulders; each a cone leaning back, rooted under the skin. Midline ornaments on joints of their own (`ooze…`): they
// ride the spine bones nearest them, and no species joint moves.
function hackles(plan, { count, height, lean = 0.5, color }, P) {
  const J = plan.joints, torso = plan.segments.find((g) => g.name === 'torso'), neck = plan.segments.find((g) => g.name === 'neck');
  if (!torso) return;
  const front = (r) => (Array.isArray(r) ? r[1] : r);
  const line = [];
  if (neck && J.neckTop && J.neckBase) {
    line.push([J.neckTop[1], J.neckTop[2] + 0.8 * front(neck.rB)]);
    line.push([J.neckBase[1], J.neckBase[2] + front(neck.rA)]);
  }
  // a trunk station's top [y, z] and half depth: its centre and radius, or (stable rings) its front and back points
  const top = (st) => (st.points?.front ? [st.points.front[1], st.points.front[2]] : [st.at[1], st.at[2] + front(st.r)]);
  const half = (st) => (st.points?.front ? (st.points.back ? (st.points.front[2] - st.points.back[2]) / 2 : 0) : front(st.r));
  const sts = [...torso.stations].sort((a, b) => top(b)[0] - top(a)[0]);
  const yMid = (top(sts[0])[0] + top(sts.at(-1))[0]) / 2;
  for (const st of sts) if (top(st)[0] >= yMid) line.push(top(st));
  if (line.length < 2) return;
  const segL = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1])), total = segL.reduce((a, b) => a + b, 0);
  const at = (u) => { let d = u * total; for (let i = 0; i < segL.length; i++) { if (d <= segL[i] || i === segL.length - 1) { const f = segL[i] ? Math.min(1, d / segL[i]) : 0; return line[i].map((x, c) => x + (line[i + 1][c] - x) * f); } d -= segL[i]; } return line.at(-1); };
  const depth = Math.max(...torso.stations.map(half)), n = Math.max(1, Math.round(count));
  plan.palette = { ...plan.palette, Hackle: color ?? darken(P.colors?.tip ?? P.colors?.coat ?? '#333333', 0.2) };
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : 0.1 + (0.8 * i) / (n - 1), [y, z] = at(u);
    const hgt = height * depth * (0.55 + 0.45 * dmath.sin(Math.PI * Math.min(1, u * 1.25)));
    const a = `oozeHackle${i}A`, b = `oozeHackle${i}B`;
    J[a] = [0, +y.toFixed(6), +(z - 0.3 * hgt).toFixed(6)];
    J[b] = [0, +(y - lean * hgt).toFixed(6), +(z + hgt).toFixed(6)];
    plan.segments.push({ name: `oozeHackle${i}`, kind: 'segment', from: a, to: b, rA: [0.24 * hgt, 0.32 * hgt], rB: [0.02 * hgt, 0.02 * hgt], slots: 'ring12', group: 'Hackle', mirror: 'plane', over: [0.3, 0.2] });
  }
}
