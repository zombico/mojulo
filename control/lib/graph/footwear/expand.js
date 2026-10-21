// footwear/expand — a footwear CARD (styles.js) worn on a body through its FOOT ADAPTER (adapters/), by the passes in a
// fixed order (principles.js carries the laws):
//
//   1 SOCK   the protosock: the body's own close upper at the card's height and thickness (none: a sandal, worn on the
//            bare foot)
//   2 SOLE   on HEELS (`heels`): the foot tipped about the toe base and the body risen (the `stance` it returns, which
//            the rig stands every pose in), the soles and the heel cut against the ground under that pose; else
//            per side, under the foot and under the toes (split at the toe base): its LAYERS stacked from the floor up
//            (the outsole, a midsole, a stripe …), each the footprint's outline grown by its own welt, in its own group; a
//            layer's `pod` a window of another group at the heel, proud of the layer's wall (an air sole)
//   3 ADORN  per side, the card's primitives in order (ADORN_PRIMS), each on the layer under it, carried by its weights;
//            a `panel` on a cobbler region (cobbler.js: the tongue, the eyestays, the quarters, the counter …)
//   4 TONE   the colours of the groups laid, the card's own over FOOTWEAR_TONES, its skin's (a colourway) over those; a
//            tone OF another group stays so, for the palette it lands in to read (readTones)
//
// Parts are layer 1, named `<id>_<segment>` (the sock), `<id>Sole_<segment>`, `<id>Strap<k>_<segment>` and
// `<id>Buckle<k>_<segment>` (k counting the straps), a boot's ankle bridge `<id><Region>Ankle<Lat|Med>_<foot>`, `<id>Sole<i>_…` for a sole's layers past the first, `<id>Pod<i>_…`, `<id>Band<k>_…`, `<id>Cuff_…`, `<id>ToeCap_…`, `<id>Rivet<k>_…`, a panel
// `<id><Region><Lat|Med>_…` (an inline region's `<id>Panel<k>…`), `<id>Lace<k>_…`.
// Pure and deterministic: no dice, fixed order.
import { soleSlab, slabBetween, strapBand, buckleOn, bindNearest, block, quarterEgg, tuckUnderEgg, studsOn, pointsOf, unitv, mean } from './parts.js';
import { FOOTWEAR, FOOTWEAR_TONES, SKINS } from './styles.js';
import { COBBLER_REGIONS, REGION_SIDES, arcOf, panelOn, laceBars } from './cobbler.js';
import { toeSpike, ribbon, helixOn, flareTop, rowel, furRing } from './fantasy.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** THE ADORNMENT PRIMITIVES: each one's keys, its group, and what it is */
export const ADORN_PRIMS = Object.freeze({
  strap: { keys: ['on', 'at', 'width', 'lift', 'buckle', 'group'], group: 'Strap', what: 'a band round the sock (or the bare foot) at a share, a buckle on its outer side' },
  band: { keys: ['on', 'at', 'width', 'lift', 'group'], group: 'Gilt', what: 'a thin ring of gilding at a share' },
  cuff: { keys: ['width', 'lift', 'group'], group: 'Cuff', what: "a turned band at the sock's collar" },
  panel: { keys: ['region', 'on', 'lift', 'thick', 'rise', 'group'], group: 'Overlay', what: 'a pattern piece laid over the sock on a cobbler region (cobbler.js COBBLER_REGIONS: tongue, eyestay, quarter …, or { along, around, sides, shaft? }), a matching pair on both sides where the region has two; on a boot carried up the shaft where the region has one' },
  laces: { keys: ['rows', 'shaftRows', 'lift', 'w', 'group'], group: 'Lace', what: "criss-cross laces between the eyestays' inner edges, over the tongue (on a boot on up the shaft: `shaftRows`)" },
  toePoint: { keys: ['length', 'curl', 'taper', 'bell', 'group'], group: 'Shoes', what: "the toe drawn out past the toes, tapering, curled up by `curl` degrees (a poulaine's, a jester's with a `bell` on its tip, a Persian slipper's)" },
  wrap: { keys: ['on', 'from', 'to', 'turns', 'cross', 'w', 'lift', 'group'], group: 'Wrap', what: 'a ribbon spiralled up the leg, `cross` a second the other way (cross-gartering, a gladiator\'s straps, leg wraps)' },
  flare: { keys: ['height', 'spread', 'group'], group: 'Shoes', what: "a funnel rising from a boot's top and opening out (a cavalier's bucket top)" },
  buttons: { keys: ['count', 'side', 'around', 'from', 'to', 'size', 'group'], group: 'Button', what: "a row of buttons up a boot's side (a button boot's, a spat's)" },
  spur: { keys: ['length', 'size', 'group'], group: 'Steel', what: "a spur: a neck from the heel's back and a star rowel" },
  wings: { keys: ['feathers', 'span', 'group'], group: 'Wing', what: "a fan of feathers at each side of the ankle (Hermes' talaria)" },
  jewel: { keys: ['at', 'size', 'group'], group: 'Gem', what: 'a stone set on the toe, the instep or the ankle' },
  fur: { keys: ['on', 'at', 'length', 'droop', 'seed', 'group'], group: 'Fur', what: "a shaggy ruff of fur round the sock's collar (or a ring at `at` along `on`), tufted and fringed" },
  toeCap: { keys: ['lift', 'room', 'rivets', 'stud', 'group'], group: 'Steel', what: 'a quarter egg over the toes, toe base to tip (the half teacup), rivets round its back edge (`stud`: { size, group }, small and dark: broguing)' },
});
/** the families a card is annotated with (what kind of footwear it is: a shelf to browse, a word to ask by) */
export const FOOTWEAR_FAMILIES = Object.freeze(['shoe', 'boot', 'sandal', 'sneaker', 'dress', 'historic', 'fantasy']);
/** a sole layer's PATTERNS: `pod` a window of another group at the heel, `from` … `to` shares of the foot's print from
 * the heel, proud of the layer's wall (an air sole); `heel` a block under the print's rear (`to` of it from the heel),
 * `thick` tall from the layer's floor (a dress heel, the foot still flat); `lugs` tread blocks round the layer's edge,
 * every `every`-th point of its outline, `size` (m) */
export const SOLE_PATTERNS = Object.freeze({ pod: ['from', 'to', 'welt', 'group'], heel: ['to', 'thick', 'group'], lugs: ['every', 'size', 'group'] });
const GROUP = /^[A-Z][A-Za-z0-9]*$/;
/** HEELS: how the heel stands (`kind`): its foot drawn in to a point (stiletto), a little (kitten), hardly (block), the
 * sole filled down to the ground under the arch (wedge), or a board on two teeth across the foot (teeth: a geta's, the
 * foot raised level when the toes stand as high as the heel) */
export const HEEL_KINDS = Object.freeze({ stiletto: 0.22, kitten: 0.35, block: 0.85, wedge: 1, teeth: 1 });
/** a tone: '#rrggbb', or { of: <group>, shade } (that group's colour darkened (−) or lightened (+)) */
const isTone = (c) => (typeof c === 'string' ? /^#[0-9a-f]{6}$/i.test(c) : !!c && typeof c === 'object' && GROUP.test(c.of ?? '') && c.shade >= -1 && c.shade <= 1 && Object.keys(c).length === 2);
/** A palette with its tones OF other groups read (each that group's colour, darkened or lightened; a group it names
 * missing, a mid grey): '#rrggbb' throughout */
export function readTones(palette) {
  const out = { ...palette }, hex = (g, depth = 0) => {
    const c = out[g]; if (typeof c === 'string') return c;
    if (!c || depth > 4) return '#808080';
    const base = hex(c.of, depth + 1), rgb = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
    const v = rgb.map((x) => Math.round(c.shade < 0 ? x * (1 + c.shade) : x + (255 - x) * c.shade));
    return (out[g] = `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}`);
  };
  for (const g of Object.keys(out)) hex(g);
  return out;
}
/** each named pattern piece's group (an inline region's is Overlay) */
const PANEL_GROUPS = { tongue: 'Tongue', eyestay: 'Eyestay', quarter: 'Overlay', vamp: 'Overlay', counter: 'Counter', foxing: 'Overlay' };
const SEGS = ['foot', 'shank'], share = (x) => typeof x === 'number' && x >= 0 && x <= 1;

/** a word or a card of one's own → the card, resolved: `from` a card it extends (its sock merged, its sole, adorn and
 * family replaced where given, `adornPlus` appended to the adornment, its tones merged), then its `skin` (a colourway,
 * styles.js SKINS) over the tones */
export function footwearCard(spec, depth = 0) {
  const C = typeof spec === 'string' ? FOOTWEAR[spec] : spec;
  if (!C || typeof C !== 'object' || depth > 4) return C;
  const B = C.from !== undefined ? footwearCard(C.from, depth + 1) : null;
  const { from: _f, skin, adornPlus, ...own } = C;
  const out = B ? { ...B, ...own, sock: own.sock === false ? false : own.sock === undefined ? B.sock : B.sock ? { ...B.sock, ...own.sock } : own.sock,
    tones: { ...(B.tones || {}), ...(own.tones || {}) } } : { ...own };
  if (adornPlus) out.adorn = [...(out.adorn || []), ...adornPlus];
  if (skin !== undefined) out.tones = { ...(out.tones || {}), ...(typeof skin === 'string' ? SKINS[skin] : skin) };
  if (out.tones && !Object.keys(out.tones).length) delete out.tones;
  return out;
}

/** Error strings for a card (a word: is it one), by name */
export function validateFootwear(spec, label = 'footwear') {
  if (typeof spec === 'string') return Object.hasOwn(FOOTWEAR, spec) ? [] : [`${label}: '${spec}' is not a footwear word (${Object.keys(FOOTWEAR).join(', ')}), or give a card { sock, sole, adorn }`];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [`${label}: a word or a card { sock, sole, adorn }`];
  const pre = [];
  if (spec.from !== undefined && !(typeof spec.from === 'string' ? Object.hasOwn(FOOTWEAR, spec.from) : spec.from && typeof spec.from === 'object')) pre.push(`${label}.from: a footwear word (${Object.keys(FOOTWEAR).join(', ')}) or a card`);
  if (spec.skin !== undefined && !(typeof spec.skin === 'string' ? Object.hasOwn(SKINS, spec.skin) : spec.skin && typeof spec.skin === 'object' && !Array.isArray(spec.skin))) pre.push(`${label}.skin: a colourway (${Object.keys(SKINS).join(', ')}) or { <group>: '#rrggbb' }`);
  if (spec.adornPlus !== undefined && !Array.isArray(spec.adornPlus)) pre.push(`${label}.adornPlus: a list of { prim, … }, laid after the adornment`);
  for (const k of Object.keys(spec)) if (!['family', 'sock', 'sole', 'heels', 'adorn', 'adornPlus', 'tones', 'from', 'skin'].includes(k)) pre.push(`${label}: a card takes family, sock, sole, heels, adorn, adornPlus, tones, from, skin, not '${k}'`);
  if (pre.length) return pre;
  if (spec.from !== undefined || spec.skin !== undefined || spec.adornPlus !== undefined) {
    const sub = typeof spec.from === 'object' ? validateFootwear(spec.from, `${label}.from`) : [];
    if (sub.length) return sub;
    const tones = typeof spec.skin === 'object' ? Object.entries(spec.skin).filter(([, c]) => !isTone(c)).map(([g]) => `${label}.skin.${g}: '#rrggbb', or { of, shade }`) : [];
    const { skin: _s, ...rest } = footwearCard(spec);
    return [...tones, ...validateFootwear(rest, label)];
  }
  const errs = [], { sock, sole, adorn = [] } = spec;
  if (spec.family !== undefined && !FOOTWEAR_FAMILIES.includes(spec.family)) errs.push(`${label}.family: one of ${FOOTWEAR_FAMILIES.join(', ')}`);
  if (sock !== false && sock !== undefined) {
    if (!['shoe', 'boot'].includes(sock?.height)) errs.push(`${label}.sock.height: 'shoe' or 'boot' (or sock: false, a sandal)`);
    for (const k of ['collar', 'shaft']) if (sock?.[k] !== undefined && !share(sock[k])) errs.push(`${label}.sock.${k}: a share, 0 to 1`);
    if (sock?.thick !== undefined && !(sock.thick > 0 && sock.thick <= 0.03)) errs.push(`${label}.sock.thick: metres, over 0 and at most 0.03`);
  }
  const metres = (v) => v === undefined || (v >= 0 && v <= 0.1);
  if (sole?.layers !== undefined) {
    if (!Array.isArray(sole.layers) || !sole.layers.length) errs.push(`${label}.sole.layers: a list of { thick, welt?, group?, pod? }, the floor's first`);
    else sole.layers.forEach((L, i) => {
      const at = `${label}.sole.layers[${i}]`;
      if (!(L?.thick > 0 && L.thick <= 0.1)) errs.push(`${at}.thick: metres, over 0 and at most 0.1`);
      if (!metres(L?.welt)) errs.push(`${at}.welt: metres, 0 to 0.1`);
      if (L?.group !== undefined && !GROUP.test(L.group)) errs.push(`${at}.group: a group name (Sole, Midsole …)`);
      for (const k of Object.keys(L || {})) if (!['thick', 'welt', 'group', ...Object.keys(SOLE_PATTERNS)].includes(k)) errs.push(`${at}: a layer takes thick, welt, group, ${Object.keys(SOLE_PATTERNS).join(', ')}, not '${k}'`);
      for (const pat of Object.keys(SOLE_PATTERNS)) if (L?.[pat] !== undefined) {
        const P = L[pat];
        if (!P || typeof P !== 'object') { errs.push(`${at}.${pat}: { ${SOLE_PATTERNS[pat].join(', ')} }`); continue; }
        for (const k of ['from', 'to']) if (P[k] !== undefined && !share(P[k])) errs.push(`${at}.${pat}.${k}: a share, 0 to 1`);
        for (const k of ['thick', 'size']) if (P[k] !== undefined && !(P[k] > 0 && P[k] <= 0.1)) errs.push(`${at}.${pat}.${k}: metres, over 0 and at most 0.1`);
        if (P.every !== undefined && !(Number.isInteger(P.every) && P.every >= 1)) errs.push(`${at}.${pat}.every: a whole number, 1 or more`);
        if (P.group !== undefined && !GROUP.test(P.group)) errs.push(`${at}.${pat}.group: a group name`);
        for (const k of Object.keys(P)) if (!SOLE_PATTERNS[pat].includes(k)) errs.push(`${at}.${pat}: takes ${SOLE_PATTERNS[pat].join(', ')}, not '${k}'`);
      }
    });
    if (sole.thick !== undefined || sole.welt !== undefined) errs.push(`${label}.sole: layers, or thick and welt (one layer), not both`);
  } else if (sole !== undefined) for (const k of ['thick', 'welt']) if (!metres(sole?.[k])) errs.push(`${label}.sole.${k}: metres, 0 to 0.1`);
  if (spec.heels !== undefined) {
    const H = spec.heels, at = `${label}.heels`;
    if (!H || typeof H !== 'object') errs.push(`${at}: { height, toe?, shank?, kind?, to?, group? } (the foot raised on them: the body stands in them)`);
    else {
      if (!(H.height >= 0.01 && H.height <= 0.2)) errs.push(`${at}.height: metres the heel stands, 0.01 … 0.2`);
      if (H.toe !== undefined && !(H.toe >= 0 && H.toe <= 0.08)) errs.push(`${at}.toe: metres of sole under the toes (a platform's), 0 … 0.08`);
      if (H.toe !== undefined && H.height !== undefined && !(H.height >= H.toe)) errs.push(`${at}: the heel must stand at least as high as the toes' sole`);
      if (H.shank !== undefined && !(H.shank > 0 && H.shank <= 0.03)) errs.push(`${at}.shank: metres of sole under the arch, over 0 and at most 0.03`);
      if (H.kind !== undefined && !Object.hasOwn(HEEL_KINDS, H.kind)) errs.push(`${at}.kind: one of ${Object.keys(HEEL_KINDS).join(', ')}`);
      if (H.to !== undefined && !(H.to > 0 && H.to <= 0.5)) errs.push(`${at}.to: the share of the footprint from the heel the heel stands under, over 0 and at most 0.5`);
      if (H.group !== undefined && !GROUP.test(H.group)) errs.push(`${at}.group: a group name`);
      for (const k of Object.keys(H)) if (!['height', 'toe', 'shank', 'kind', 'to', 'group'].includes(k)) errs.push(`${at}: takes height, toe, shank, kind, to, group, not '${k}'`);
    }
  }
  if (!Array.isArray(adorn)) errs.push(`${label}.adorn: a list of { prim, … }`);
  else adorn.forEach((a, i) => {
    const P = ADORN_PRIMS[a?.prim], at = `${label}.adorn[${i}]`;
    if (!P) { errs.push(`${at}.prim: one of ${Object.keys(ADORN_PRIMS).join(', ')}`); return; }
    for (const k of Object.keys(a)) if (k !== 'prim' && !P.keys.includes(k)) errs.push(`${at}: ${a.prim} takes ${P.keys.join(', ')}, not '${k}'`);
    if (a.shaftRows !== undefined && !(Number.isInteger(a.shaftRows) && a.shaftRows >= 0 && a.shaftRows <= 16)) errs.push(`${at}.shaftRows: a whole number of rows up a boot's shaft, 0 … 16`);
    if (P.keys.includes('on') && !['panel', 'wrap', 'fur'].includes(a.prim) && !SEGS.includes(a.on)) errs.push(`${at}.on: ${SEGS.join(' or ')}`);
    if (a.prim !== 'jewel' && a.at !== undefined && !share(a.at)) errs.push(`${at}.at: a share, 0 to 1`);
    if (a.prim === 'panel') {
      const R = a.region;
      if (typeof R === 'string') { if (!COBBLER_REGIONS[R]) errs.push(`${at}.region: one of ${Object.keys(COBBLER_REGIONS).join(', ')}, or { along, around, sides }`); }
      else {
        const pair = (x) => Array.isArray(x) && x.length === 2 && x.every(share) && x[0] <= x[1];
        if (!R || !pair(R.along) || !pair(R.around) || !REGION_SIDES.includes(R.sides)) errs.push(`${at}.region: a cobbler region's name, or { along: [a0, a1], around: [r0, r1] (shares), sides: ${REGION_SIDES.join(' | ')}, shaft? }`);
        else if (R.shaft !== undefined && !(R.shaft && pair(R.shaft.along) && (R.shaft.around === undefined || pair(R.shaft.around)))) errs.push(`${at}.region.shaft: { along: [a0, a1], around?: [r0, r1] } (shares of a boot's shank)`);
      }
      if (a.on !== undefined && !SEGS.includes(a.on)) errs.push(`${at}.on: ${SEGS.join(' or ')}`);
    }
    const num = (k, lo, hi, what) => { if (a[k] !== undefined && !(typeof a[k] === 'number' && a[k] >= lo && a[k] <= hi)) errs.push(`${at}.${k}: ${what}, ${lo} … ${hi}`); };
    num('length', 0.005, 0.25, 'metres'); num('curl', 0, 270, 'degrees'); num('taper', 0, 1, 'a share'); num('turns', 0.5, 12, 'turns round the leg');
    num('height', 0.01, 0.3, 'metres'); num('spread', 1, 3, 'times the top'); num('count', 1, 20, 'buttons'); num('around', 0, 1, 'a share round');
    num('span', 0.01, 0.2, 'metres'); num('feathers', 1, 12, 'feathers'); num('size', 0.002, 0.04, 'metres'); num('w', 0.001, 0.05, 'metres');
    for (const k of ['from', 'to']) if (a.prim !== 'panel' && a[k] !== undefined && !share(a[k])) errs.push(`${at}.${k}: a share, 0 to 1`);
    if (a.side !== undefined && !['lateral', 'medial'].includes(a.side)) errs.push(`${at}.side: lateral or medial`);
    if (a.prim === 'jewel' && !['toe', 'instep', 'ankle'].includes(a.at)) errs.push(`${at}.at: toe, instep or ankle`);
    if ((a.prim === 'wrap' || a.prim === 'fur') && a.on !== undefined && !SEGS.includes(a.on)) errs.push(`${at}.on: ${SEGS.join(' or ')}`);
    num('droop', 0, 2, 'times its length'); if (a.seed !== undefined && !Number.isInteger(a.seed)) errs.push(`${at}.seed: a whole number`);
    if (a.prim === 'fur' && a.at !== undefined && a.on === undefined) errs.push(`${at}: give the fur's \`on\` with its \`at\` (else it sits at the collar)`);
    if ((a.prim === 'flare' || a.prim === 'buttons') && sock?.height !== 'boot') errs.push(`${at}: a ${a.prim} is a boot's; this card's sock is no boot`);
    if (a.group !== undefined && !GROUP.test(a.group)) errs.push(`${at}.group: a group name (Steel, Gilt …)`);
    if (['cuff', 'toeCap', 'panel', 'laces'].includes(a.prim) && sock === false) errs.push(`${at}: a ${a.prim} is worn on the sock; this card has none`);
  });
  for (const [g, c] of Object.entries(spec.tones || {})) if (!isTone(c)) errs.push(`${label}.tones.${g}: '#rrggbb', or { of: <group>, shade: −1 … 1 } (that group's colour darkened or lightened)`);
  return errs;
}

/** The footwear on a body (see the head of this file). */
export function wearFootwear(A, spec = 'boots', { id = 'boots', group = 'Shoes' } = {}) {
  const errs = validateFootwear(spec), C = footwearCard(spec);
  if (errs.length) throw new Error(errs.join('; '));
  const sock = C.sock || null, used = new Set();
  // (the sole's layers from the floor up; `{ thick, welt }` is one)
  const layers = C.sole?.layers ?? [{ thick: C.sole?.thick ?? 0.008, welt: C.sole?.welt ?? 0.003 }], HL = C.heels ?? null, soleThick = HL ? 0 : layers.reduce((t, L) => t + L.thick, 0);
  let stance = null;
  // 1 SOCK (none: the sole and the straps on the bare foot, the skin's own parts)
  const parts = sock ? A.upper(sock, { id, group }) : {};
  const on = (seg) => (seg ? (sock ? parts[`${id}_${seg}`] : A.bare(seg)) : undefined);
  const put = (name, part) => { parts[name] = part; used.add(part.group); };
  // (the sock's collar: its top ring's share, a boot's up the shank, a shoe's on the foot)
  const collar = sock && (sock.height === 'boot' ? { on: 'shank', at: 1 - (sock.shaft ?? 0.3) } : { on: 'foot', at: sock.collar ?? 0.15 });
  for (const S of A.sides) {
    const fn = A.seg('foot', S), tn = A.seg('toes', S), foot = on(fn), toes = on(tn);
    if (!foot) continue;
    // 2 SOLE: each segment's footprint behind or in front of the toe base (a few millimetres over it), grown by the welt
    const { toeBase: tb, toeTip: tt } = A.joints(S), fwd = tb && tt ? unitv([tt[0] - tb[0], tt[1] - tb[1], 0]) : [0, 1, 0];
    const ahead = (p) => (tb ? (p[0] - tb[0]) * fwd[0] + (p[1] - tb[1]) * fwd[1] : 0);
    const floor = Math.min(...[foot, toes].filter(Boolean).flatMap(pointsOf).map((p) => p[2]));
    const n = { strap: 0, band: 0, rivet: 0, panel: 0, lace: 0, lug: 0, wrap: 0, button: 0 };
    if (HL) {
      // 2 SOLE ON HEELS: the foot tipped about the toe base (the rig's stance: lib/graph/polygonizer/station-loft-rig.js),
      // so each piece is cut against where the ground will be under that pose: the toes on their sole (`toe`), the foot's
      // sole thinning from the ball to the arch (`shank`; a wedge filled down to the ground), the heel standing from the
      // heel's seat to the ground, drawn in to its foot by its kind
      const t = HL.toe ?? 0.008, sh = HL.shank ?? 0.004, kind = HL.kind ?? 'block', welt = C.sole?.welt ?? layers[0].welt ?? 0.003, sg = layers[0].group ?? 'Sole';
      const near = (P, keep) => pointsOf(P).filter((p) => p[2] < floor + 0.015 && keep(p));
      const fp = near(foot, (p) => ahead(p) < 0.004), back = Math.max(0.05, ...fp.map((p) => -ahead(p)));
      const pitch = Math.asin(Math.min(0.95, Math.max(0, (HL.height - t) / back))) * 180 / Math.PI, a = (-pitch * Math.PI) / 180, sa = Math.sin(a), ca = Math.cos(a);
      // (the bind height a place on the foot must have to stand on the floor once the foot is tipped and raised)
      const groundAt = (x, y) => tb[2] + (floor - tb[2] - t - (y - tb[1]) * sa) / ca;
      const lerp = (x, y) => Math.min(1, Math.max(0, -ahead([x, y, 0]) / 0.06));
      const teeth = kind === 'teeth', toeSole = toes && slabBetween(near(toes, (p) => ahead(p) > -0.004), { welt, bottom: () => floor - (teeth ? sh : t), top: () => floor + 0.002 });
      const footSole = slabBetween(fp, { welt, top: () => floor + 0.002,
        bottom: kind === 'wedge' ? (x, y) => Math.min(floor - t, groundAt(x, y)) : teeth ? () => floor - sh : (x, y) => floor - (t + (sh - t) * lerp(x, y)) });
      // (rigid on the foot's bone and the toes', as a shoe's sole and heel are: the leather's blend round the ankle would
      // turn them with the shin)
      const rigid = (P) => ({ bone: P.bind.bone, blend: {} });
      if (footSole) put(`${id}Sole_${fn}`, { ...footSole, group: sg, bind: rigid(foot) });
      if (toeSole) put(`${id}Sole_${tn}`, { ...toeSole, group: sg, bind: rigid(toes) });
      if (kind === 'teeth') {
        // (a GETA: a board under the whole foot, `shank` thick, on two teeth across it, one under the ball, one under the heel)
        for (const [name, [b0, b1]] of [['ToothFront', [0, 0.3]], ['ToothBack', [0.62, 0.86]]]) {
          // (its strip of the footprint, or on a coarse foot the eight points nearest the strip's middle)
          const strip = fp.filter((p) => -ahead(p) >= back * b0 && -ahead(p) <= back * b1), m = back * (b0 + b1) / 2;
          const print = strip.length >= 8 ? strip : [...fp].sort((p, q) => Math.abs(-ahead(p) - m) - Math.abs(-ahead(q) - m)).slice(0, 8);
          const tooth = slabBetween(print, { welt: welt * 0.5, top: () => floor - sh + 0.002, bottom: groundAt });
          if (tooth) put(`${id}${name}_${fn}`, { ...tooth, group: HL.group ?? 'Heel', bind: rigid(foot) });
        }
      } else if (kind !== 'wedge') {
        const seat = fp.filter((p) => -ahead(p) >= back * (1 - (HL.to ?? 0.28))), c = seat.length ? seat.reduce((m, p) => [m[0] + p[0] / seat.length, m[1] + p[1] / seat.length], [0, 0]) : null;
        // (leaned forward by the pitch in the bind, so it stands plumb under the tipped foot)
        const tall = c ? floor - sh - groundAt(c[0], c[1]) : 0, lean = tall * Math.tan(-a), shift = [fwd[0] * lean, fwd[1] * lean];
        // (a slender heel's foot under the back of the seat, a block's under its middle)
        const rear = seat.reduce((m, p) => (ahead(p) < ahead(m) ? p : m), seat[0] ?? [0, 0, 0]), k = HEEL_KINDS[kind] < 0.5 ? 0.45 : 0;
        const toward = c && [c[0] + (rear[0] - c[0]) * k, c[1] + (rear[1] - c[1]) * k];
        const heel = c && slabBetween(seat, { welt, top: () => floor - sh + 0.002, bottom: groundAt, taper: HEEL_KINDS[kind], toward, shift });
        if (heel) put(`${id}Heel_${fn}`, { ...heel, group: HL.group ?? 'Heel', bind: rigid(foot) });
      }
      // (the stance the rig stands every pose in: the toes up on their sole, the heel up by the pitch, the root risen so
      // the legs keep their length: the toes' rise and the ankle's under the turn)
      if (!stance) { const an = A.joints(S).ankle ?? tb, vy = an[1] - tb[1], vz = an[2] - tb[2];
        stance = { rise: r6(t + (vy * sa + vz * ca) - vz), toe: r6(t), pitch: r6(pitch) }; }
    } else for (const [seg, P, keep] of [[fn, foot, (p) => ahead(p) < 0.004], [tn, toes, (p) => ahead(p) > -0.004]]) {
      if (!P) continue;
      const print = pointsOf(P).filter((p) => p[2] < floor + Math.max(0.015, soleThick + 0.008) && keep(p));
      let z = floor;
      layers.forEach((L, i) => {
        const welt = L.welt ?? 0.003, slab = soleSlab(print, { floor: z, thick: L.thick, welt });
        if (slab) put(`${id}Sole${i || ''}_${seg}`, { ...slab, group: L.group ?? 'Sole', bind: bindNearest(slab, P) });
        // (its pod: the print from the heel, `from` … `to` of its length, its own slab a little proud of the layer's wall)
        // (its tread: lugs round its edge, standing off it at its middle height)
        if (L.lugs && slab) {
          const mid = Object.fromEntries(Object.entries(slab.stations[0].points).map(([k, q]) => [k, [q[0], q[1], q[2] + L.thick / 2]]));
          studsOn(mid, { every: L.lugs.every ?? 3, over: -1, size: L.lugs.size ?? Math.min(0.008, L.thick * 0.9) }).forEach((b) => put(`${id}Lug${n.lug++}_${seg}`, { ...b, group: L.lugs.group ?? L.group ?? 'Sole', bind: bindNearest(b, P) }));
        }
        // (its heel: a block under the print's rear, from the layer's floor up, the foot still flat on it)
        if (L.heel && seg === fn && print.length) {
          const t = print.map(ahead), t0 = Math.min(...t), t1 = Math.max(...t), sub = print.filter((q, j) => (t[j] - t0) / (t1 - t0 || 1) <= (L.heel.to ?? 0.3));
          const blk = soleSlab(sub, { floor: z, thick: L.heel.thick ?? 0.02, welt });
          if (blk) put(`${id}Heel${i}_${seg}`, { ...blk, group: L.heel.group ?? 'Heel', bind: bindNearest(blk, P) });
        }
        if (L.pod && seg === fn && print.length) {
          const t = print.map(ahead), t0 = Math.min(...t), t1 = Math.max(...t), at = (q) => (q - t0) / (t1 - t0 || 1);
          const sub = print.filter((p, j) => at(t[j]) >= (L.pod.from ?? 0) && at(t[j]) <= (L.pod.to ?? 0.35));
          const pod = soleSlab(sub, { floor: z + L.thick * 0.2, thick: L.thick * 0.6, welt: welt + (L.pod.welt ?? 0.0015) });
          if (pod) put(`${id}Pod${i}_${seg}`, { ...pod, group: L.pod.group ?? 'Air', bind: bindNearest(pod, P) });
        }
        z += L.thick;
      });
    }
    // 3 ADORN, in the card's order
    for (const a of C.adorn ?? []) {
      if (a.prim === 'strap' || a.prim === 'band' || a.prim === 'cuff') {
        const strap = a.prim === 'strap', k = n[a.prim] ?? 0; if (a.prim !== 'cuff') n[a.prim]++;
        const where = a.prim === 'cuff' ? { on: collar.on, at: Math.min(1, collar.at + 0.02) } : a, seg = A.seg(where.on, S), P = on(seg); if (!P) continue;
        const dims = { strap: [0.0025, 0.015], band: [0.003, 0.006], cuff: [0.005, 0.03] }[a.prim];
        const band = strapBand(P, A.u(where.on, where.at), { lift: a.lift ?? dims[0], width: a.width ?? dims[1] }); if (!band) continue;
        const name = { strap: `${id}Strap${k}`, band: `${id}Band${k}`, cuff: `${id}Cuff` }[a.prim];
        put(`${name}_${seg}`, { ...band, group: a.group ?? ADORN_PRIMS[a.prim].group });
        if (strap && a.buckle) { const b = buckleOn(band, S === 'R' ? 1 : -1); put(`${id}Buckle${k}_${seg}`, { ...b, group: 'Brass', bind: bindNearest(b, P) }); }
      } else if (a.prim === 'panel') {
        // a PATTERN PIECE on a cobbler region: its stations along, its arc round (a pair where the region has two sides)
        const named = typeof a.region === 'string', R = named ? COBBLER_REGIONS[a.region] : a.region, kind = a.on ?? 'foot';
        const base = named ? `${id}${a.region[0].toUpperCase()}${a.region.slice(1)}` : `${id}Panel${n.panel++}`, g = a.group ?? PANEL_GROUPS[a.region] ?? 'Overlay';
        const sides = R.sides === 'both' ? [['lateral', 'Lat'], ['medial', 'Med']] : [[R.sides, R.sides === 'centre' ? '' : R.sides === 'lateral' ? 'Lat' : 'Med']];
        // (its pieces: on its segment, and on a boot's shaft where the region carries one, the topmost taking the rise; and
        // where the foot's piece begins below the ankle, a BRIDGE on the foot's leather from the ankle down to it, cut round
        // as the shaft's is, so no plain leather shows between them)
        const shaft = R.shaft && kind === 'foot' && sock?.height === 'boot' && on(A.seg('shank', S)) ? { kind: 'shank', R: { ...R, along: R.shaft.along, around: R.shaft.around ?? R.around } } : null;
        const bridge = shaft && R.along[0] > 0 ? { kind: 'foot', tag: 'Ankle', R: { ...R, along: [0, Math.min(1, R.along[0] + 0.06)], around: shaft.R.around } } : null;
        for (const piece of [{ kind, R }, ...(bridge ? [bridge] : []), ...(shaft ? [shaft] : [])]) {
          const seg = A.seg(piece.kind, S), P = on(seg); if (!P) continue;
          const sts = P.stations.filter((st, i) => { const u = st.u ?? i; return u >= A.u(piece.kind, piece.R.along[0]) - 1e-9 && u <= A.u(piece.kind, piece.R.along[1]) + 1e-9; });
          const rise = (shaft ? piece === shaft : true) ? a.rise ?? 0 : 0;
          for (const [side, tag] of sides) {
            const pc = panelOn(P, sts, arcOf(P.slots, piece.R, side, S), { lift: a.lift ?? 0.0025, thick: a.thick ?? 0.0015, rise }); if (!pc) continue;
            put(`${base}${piece.tag ?? ''}${tag}_${seg}`, { ...pc, group: g, bind: bindNearest(pc, P) });
          }
        }
      } else if (a.prim === 'laces') {
        // LACES between the eyestays' inner edges (the slot of each nearest the tongue), over the tongue; on a boot on up
        // the shaft between its eyestays there
        const E = COBBLER_REGIONS.eyestay, boot = sock?.height === 'boot';
        for (const [kind, along, rows] of [['foot', E.along, a.rows ?? 5], ...(boot ? [['shank', E.shaft.along, a.shaftRows ?? 4]] : [])]) {
          const seg = A.seg(kind, S), P = on(seg); if (!P || !rows) continue;
          const sts = P.stations.filter((st, i) => { const u = st.u ?? i; return u >= A.u(kind, along[0]) - 1e-9 && u <= A.u(kind, along[1]) + 1e-9; });
          const inner = (side) => { const arc = arcOf(P.slots, E, side, S), N = P.slots.length, j = (sl) => { const i = P.slots.indexOf(sl); return Math.min(i, N - i); }; return arc.reduce((b, sl) => (j(sl) < j(b) ? sl : b), arc[0]); };
          laceBars(P, sts, inner('lateral'), inner('medial'), { rows, lift: a.lift ?? 0.0055, w: a.w ?? 0.003 })
            .forEach((b) => put(`${id}Lace${n.lace++}_${seg}`, { ...b, group: a.group ?? 'Lace', bind: bindNearest(b, P) }));
        }
      } else if (a.prim === 'toePoint') {
        // a TOE drawn out past the toes, from inside their front at their middle height, tapering, curled up; a bell on its tip
        const P = toes ?? foot; if (!tb || !tt || !P) continue;
        const side = [fwd[1], -fwd[0], 0], pts = pointsOf(P).filter((p) => ahead(p) >= -0.002 && p[2] > floor + 0.002); if (!pts.length) continue;
        const front = Math.max(...pts.map(ahead)), lowZ = floor + soleThick / 2, hi = Math.max(...pts.map((p) => p[2]));
        const nearFront = pts.filter((p) => ahead(p) > front - 0.02), across = nearFront.map((p) => (p[0] - tb[0]) * side[0] + (p[1] - tb[1]) * side[1]);
        const c = across.reduce((m, x) => m + x, 0) / across.length, half = (Math.max(...across) - Math.min(...across)) / 2, back = front - 0.012;
        const o = [tb[0] + fwd[0] * back + side[0] * c, tb[1] + fwd[1] * back + side[1] * c, lowZ + (hi - lowZ) * 0.42];
        const r0 = Math.max(0.006, Math.min(half, (hi - lowZ) / 2) * 0.85), spike = toeSpike(o, fwd, side, { length: (a.length ?? 0.06) + 0.012, curl: a.curl ?? 0, r0, taper: a.taper ?? 0.15 });
        const seg = toes ? tn : fn, rig = { bone: P.bind.bone, blend: {} };
        put(`${id}ToePoint_${seg}`, { ...spike, group: a.group ?? 'Shoes', bind: rig });
        if (a.bell) { const tip = spike.caps.tip, last = spike.stations[spike.stations.length - 1].points, m = mean(Object.values(last)), d = unitv(tip.map((x, q) => x - m[q]));
          put(`${id}Bell_${seg}`, { ...block(tip, d, unitv([fwd[1], -fwd[0], 0]), { w: 0.014, h: 0.014, thick: 0.014 }), group: 'Bell', bind: rig }); }
      } else if (a.prim === 'wrap') {
        // a RIBBON spiralled up the leg over the stations between its shares, a second the other way when crossed
        // (on the leather where it runs there, else on the bare leg above a short boot)
        const kind = a.on ?? 'shank', seg = A.seg(kind, S), lo = A.u(kind, a.from ?? 0.3), hi = A.u(kind, a.to ?? 1);
        const within = (Q) => (Q ? Q.stations.filter((st, i) => { const u = st.u ?? i; return u >= Math.min(lo, hi) - 1e-9 && u <= Math.max(lo, hi) + 1e-9; }) : []);
        let P = on(seg), sts = within(P);
        if (sts.length < 2) { P = A.bare(seg); sts = within(P); }
        if (sts.length < 2) continue;
        const k0 = n.wrap; n.wrap += a.cross ? 2 : 1;
        [1, ...(a.cross ? [-1] : [])].forEach((sign, j) => {
          const H = helixOn(P, sts, { turns: a.turns ?? 3, phase: j * 0.5, lift: a.lift ?? 0.003, sign }), rb = ribbon(H.path, H.normals, { w: a.w ?? 0.012 });
          if (rb) put(`${id}Wrap${k0 + j}_${seg}`, { ...rb, group: a.group ?? 'Wrap', bind: bindNearest(rb, P) });
        });
      } else if (a.prim === 'flare') {
        // a FUNNEL from the boot's top, rising and opening out
        const seg = A.seg('shank', S), P = on(seg); if (!P || !sock) continue;
        const f = flareTop(P.stations[0].points, { height: a.height ?? 0.08, spread: a.spread ?? 1.6 });
        put(`${id}Flare_${seg}`, { ...f, group: a.group ?? 'Shoes', bind: bindNearest(f, P) });
      } else if (a.prim === 'buttons') {
        // BUTTONS up the boot's side: `count` of them spread over the shaft between its shares, round at `around`
        const seg = A.seg('shank', S), P = on(seg); if (!P) continue;
        const lo = A.u('shank', a.from ?? 0), hi = A.u('shank', a.to ?? 1), sts = P.stations.filter((st, i) => { const u = st.u ?? i; return u >= lo - 1e-9 && u <= hi + 1e-9; });
        const arc = arcOf(P.slots, { around: [a.around ?? 0.3, a.around ?? 0.3] }, a.side ?? 'lateral', S), sl = arc[0], cnt = Math.min(a.count ?? 6, sts.length);
        for (let i = 0; i < cnt; i++) {
          const st = sts[Math.round((i * (sts.length - 1)) / Math.max(1, cnt - 1))], m = mean(Object.values(st.points)), p = st.points[sl], d = unitv(p.map((x, q) => x - m[q])), sz = a.size ?? 0.007;
          const b = block(p.map((x, q) => x + d[q] * 0.002), d, [0, 0, 1], { w: sz, h: sz, thick: sz * 0.5 });
          put(`${id}Button${n.button++}_${seg}`, { ...b, group: a.group ?? 'Button', bind: bindNearest(b, P) });
        }
      } else if (a.prim === 'spur') {
        // a SPUR: a neck back from the heel at the ankle's height, a star rowel on its end, rigid on the foot
        if (!tb || !foot) continue;
        const z0 = floor + 0.025, ring = pointsOf(foot).filter((p) => p[2] > z0 && p[2] < z0 + 0.03); if (!ring.length) continue;
        const heel = ring.reduce((m, p) => (ahead(p) < ahead(m) ? p : m), ring[0]), len = a.length ?? 0.035, back = [-fwd[0], -fwd[1], 0];
        const path = [0, 0.5, 1].map((s) => [heel[0] + back[0] * len * s, heel[1] + back[1] * len * s, heel[2] + 0.004 * s]);
        const neck = ribbon(path, path.map(() => [0, 0, 1]), { w: 0.004, thick: 0.003 }), side = [fwd[1], -fwd[0], 0], rig = { bone: foot.bind.bone, blend: {} };
        if (neck) put(`${id}SpurNeck_${fn}`, { ...neck, group: a.group ?? 'Steel', bind: rig });
        put(`${id}Rowel_${fn}`, { ...rowel(path[2].map((x, q) => x + back[q] * (a.size ?? 0.012)), side, [0, 0, 1], { r: a.size ?? 0.012 }), group: a.group ?? 'Steel', bind: rig });
      } else if (a.prim === 'wings') {
        // WINGS: a fan of feathers at each side of the ankle, swept back and up, the longest first
        const seg = A.seg('shank', S), P = on(seg); if (!P) continue;
        const st = P.stations[Math.max(0, P.stations.length - 3)], m = mean(Object.values(st.points)), up = [0, 0, 1], back = [-fwd[0], -fwd[1], 0];
        for (const [side, tag] of [['lateral', 'Lat'], ['medial', 'Med']]) {
          const sl = arcOf(P.slots, { around: [0.5, 0.5] }, side, S)[0], p0 = st.points[sl], nrm = unitv(p0.map((x, q) => x - m[q])), F = a.feathers ?? 5, span = a.span ?? 0.07;
          for (let i = 0; i < F; i++) {
            const ang = ((20 + (60 * i) / Math.max(1, F - 1)) * Math.PI) / 180, dir = unitv(back.map((x, q) => x * Math.cos(ang) + up[q] * Math.sin(ang))), L = span * (1 - 0.12 * i);
            const path = [0, 0.33, 0.66, 1].map((s) => p0.map((x, q) => x + nrm[q] * (0.004 + 0.012 * Math.sin(Math.PI * s * 0.8)) + dir[q] * L * s));
            const f = ribbon(path, path.map(() => nrm), { w: 0.01, thick: 0.0015, widths: [0.006, 0.012, 0.01, 0.002] });
            if (f) put(`${id}Wing${tag}${i}_${seg}`, { ...f, group: a.group ?? 'Wing', bind: bindNearest(f, P) });
          }
        }
      } else if (a.prim === 'jewel') {
        // a JEWEL set on the toe (the toes' top front), the instep (the foot's centre line) or the ankle (its outer side)
        const where = a.at, sz = a.size ?? 0.009;
        const P = where === 'toe' ? toes ?? foot : where === 'instep' ? foot : on(A.seg('shank', S)), seg = where === 'toe' ? (toes ? tn : fn) : where === 'instep' ? fn : A.seg('shank', S); if (!P) continue;
        let p, d;
        if (where === 'ankle') { const st = P.stations[P.stations.length - 2] ?? P.stations[0], m = mean(Object.values(st.points)); p = st.points[arcOf(P.slots, { around: [0.5, 0.5] }, 'lateral', S)[0]]; d = unitv(p.map((x, q) => x - m[q])); }
        else {
          const st = where === 'instep' ? P.stations.find((x, i) => (x.u ?? i) >= A.u('foot', 0.62)) ?? P.stations[P.stations.length - 1] : P.stations.reduce((b, x) => (ahead(mean(Object.values(x.points))) > ahead(mean(Object.values(b.points))) - 0.01 && x !== P.stations[P.stations.length - 1] ? x : b), P.stations[0]);
          const m = mean(Object.values(st.points)); p = Object.values(st.points).reduce((b, x) => (x[2] > b[2] ? x : b)); d = unitv(p.map((x, q) => x - m[q]));
        }
        const b = block(p.map((x, q) => x + d[q] * 0.002), d, fwd, { w: sz, h: sz, thick: sz * 0.6 });
        put(`${id}Jewel_${seg}`, { ...b, group: a.group ?? 'Gem', bind: bindNearest(b, P) });
      } else if (a.prim === 'fur') {
        // FUR round the sock's collar (its top ring), or round the ring at `at` along `on` (the bare leg where no sock is)
        let seg, ring, P;
        if (a.on) {
          // (the leather's ring there if it reaches there, else the bare leg's)
          seg = A.seg(a.on, S); const u = A.u(a.on, a.at ?? 0.5), ringAt = (Q) => Q?.stations.find((x, i) => Math.abs((x.u ?? i) - u) <= 0.06);
          const st = ringAt(on(seg)) ?? ringAt(A.bare(seg)); P = st && ringAt(on(seg)) ? on(seg) : A.bare(seg); ring = st?.points;
        }
        else if (collar) { seg = A.seg(collar.on, S); P = on(seg); ring = P?.stations[0]?.points; }
        if (!ring) continue;
        const f = furRing(ring, { length: a.length ?? 0.03, droop: a.droop ?? 0.8, seed: (a.seed ?? 1) * 2 + (S === 'R' ? 0 : 1) });
        put(`${id}Fur_${seg}`, { ...f, group: a.group ?? 'Fur', bind: bindNearest(f, P) });
      } else if (a.prim === 'toeCap') {
        // the half teacup: a quarter egg over the toes, mapped toe to toe (the toe base to past the tip, with `room` beyond
        // it: a shoe's toe allowance), as wide and as high as the toes and `lift` more, its bottom inside the sole, carried
        // by the toes; in the leather's own group it is the toe's shape (a dress shoe's sleek toe)
        if (!tb || !tt || !toes) continue;
        const lift = a.lift ?? 0.004, minZ = floor + soleThick / 2, side = [fwd[1], -fwd[0], 0];
        // (measured on the toes' leather and the skin under it, so neither shows past it)
        const pts = [toes, A.bare(tn)].filter(Boolean).flatMap(pointsOf).filter((p) => ahead(p) >= -0.002 && p[2] > floor + 0.002); if (!pts.length) continue;
        const across = pts.map((p) => (p[0] - tb[0]) * side[0] + (p[1] - tb[1]) * side[1]), c = (Math.max(...across) + Math.min(...across)) / 2;
        // (its tip at the frontmost of them, the toe line being oblique)
        const tMax = Math.max(...pts.map(ahead)), front = pts.map((q, j) => [ahead(q), across[j]]).filter(([t]) => t > tMax - 0.01), cTip = front.reduce((s, f) => s + f[1], 0) / front.length;
        const egg = { o: tb, fwd, side, c, cTip, minZ, p: 3, L: Math.max(ahead(tt), ...pts.map(ahead)) + lift + (a.room ?? 0.006),
          W: Math.max(...across.map((x) => Math.abs(x - c))) + lift, H: Math.max(...pts.map((p) => p[2])) - minZ + lift };
        const cap = quarterEgg(egg);
        // (the sock's leather under it tucked inside, so none pokes through)
        for (const seg of [fn, tn]) if (parts[`${id}_${seg}`]) parts[`${id}_${seg}`] = tuckUnderEgg(parts[`${id}_${seg}`], egg);
        put(`${id}ToeCap_${tn}`, { ...cap, group: a.group ?? 'Steel', bind: bindNearest(cap, toes) });
        // the rivets round its back edge
        if (a.rivets) for (const r of studsOn(cap.stations[0].points, { every: a.rivets, over: 0.004, ...(a.stud?.size ? { size: a.stud.size } : {}) })) put(`${id}Rivet${n.rivet++}_${tn}`, { ...r, group: a.stud?.group ?? 'Steel', bind: bindNearest(r, toes) });
      }
    }
  }
  // 4 TONE: the groups laid
  // (`named`: the groups the card or its skin names a tone for, over a palette's defaults; the operator's own over all)
  const tones = { ...FOOTWEAR_TONES, ...(C.tones || {}) };
  return { parts, tones: Object.fromEntries(Object.entries(tones).filter(([g]) => used.has(g) || (C.tones && Object.hasOwn(C.tones, g)))), named: Object.keys(C.tones || {}), ...(stance ? { stance } : {}) };
}
