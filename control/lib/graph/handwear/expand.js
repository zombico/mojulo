// handwear/expand — a handwear CARD (styles.js) worn on a body through its HAND ADAPTER (adapters/), by passes in a
// fixed order (principles.js carries the laws):
//
//   1 GLOVE   the protoglove: the palm's and the digits' own rings stood off by the leather's thickness (parts.js
//             `standOff`), a digit cut at its middle joint or its knuckle where the card's fingers say, the cuff up the
//             forearm by its share (the adapter's close leather); none: the adornment on the bare hand
//   4 TONE    the colours of the groups laid, the card's own over HANDWEAR_TONES, its skin's over those
//
// Parts are layer 1, named `<id>_<segment>` (the glove). Pure and deterministic: no dice, fixed order.
import { standOff } from './parts.js';
import { HANDWEAR, HANDWEAR_TONES, SKINS } from './styles.js';
import { readTones } from '../footwear/expand.js';

export { readTones };
export const DIGITS = Object.freeze(['thumb', 'index', 'middle', 'ring', 'little']);
/** how far a glove's fingers reach: whole, to the middle joint (fingerless), to the knuckle (a mitt's) — the rings kept */
export const FINGERS = Object.freeze({ full: 5, half: 3, none: 2 });
/** the families a card is annotated with (a shelf to browse, a word to ask by) */
export const HANDWEAR_FAMILIES = Object.freeze(['glove', 'gauntlet', 'dress', 'work', 'sport', 'historic', 'fantasy']);
const GROUP = /^[A-Z][A-Za-z0-9]*$/;
const share = (x) => typeof x === 'number' && x >= 0 && x <= 1;
const isTone = (c) => (typeof c === 'string' ? /^#[0-9a-f]{6}$/i.test(c) : !!c && typeof c === 'object' && GROUP.test(c.of ?? '') && c.shade >= -1 && c.shade <= 1 && Object.keys(c).length === 2);

/** a word or a card of one's own → the card, resolved: `from` its kin (its glove merged, adornment and family replaced
 * where given, `adornPlus` appended, tones merged), then its `skin` (a colourway) over the tones */
export function handwearCard(spec, depth = 0) {
  const C = typeof spec === 'string' ? HANDWEAR[spec] : spec;
  if (!C || typeof C !== 'object' || depth > 4) return C;
  const B = C.from !== undefined ? handwearCard(C.from, depth + 1) : null;
  const { from: _f, skin, adornPlus, ...own } = C;
  const out = B ? { ...B, ...own, glove: own.glove === false ? false : own.glove === undefined ? B.glove : B.glove ? { ...B.glove, ...own.glove } : own.glove,
    tones: { ...(B.tones || {}), ...(own.tones || {}) } } : { ...own };
  if (adornPlus) out.adorn = [...(out.adorn || []), ...adornPlus];
  if (skin !== undefined) out.tones = { ...(out.tones || {}), ...(typeof skin === 'string' ? SKINS[skin] : skin) };
  if (out.tones && !Object.keys(out.tones).length) delete out.tones;
  return out;
}

/** Error strings for a card (a word: is it one), by name */
export function validateHandwear(spec, label = 'handwear') {
  const words = Object.keys(HANDWEAR).join(', ');
  if (typeof spec === 'string') return Object.hasOwn(HANDWEAR, spec) ? [] : [`${label}: '${spec}' is not a handwear word (${words}), or give a card { glove, adorn }`];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [`${label}: a word or a card { glove, adorn }`];
  const errs = [], KEYS = ['family', 'glove', 'adorn', 'adornPlus', 'tones', 'from', 'skin'];
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) errs.push(`${label}: a card takes ${KEYS.join(', ')}, not '${k}'`);
  if (spec.from !== undefined && !(typeof spec.from === 'string' ? Object.hasOwn(HANDWEAR, spec.from) : spec.from && typeof spec.from === 'object')) errs.push(`${label}.from: a handwear word (${words}) or a card`);
  if (spec.skin !== undefined && !(typeof spec.skin === 'string' ? Object.hasOwn(SKINS, spec.skin) : spec.skin && typeof spec.skin === 'object' && !Array.isArray(spec.skin))) errs.push(`${label}.skin: a colourway (${Object.keys(SKINS).join(', ')}) or { <group>: '#rrggbb' }`);
  if (spec.adornPlus !== undefined && !Array.isArray(spec.adornPlus)) errs.push(`${label}.adornPlus: a list of { prim, … }, laid after the adornment`);
  if (errs.length) return errs;
  if (typeof spec.from === 'object') { const sub = validateHandwear(spec.from, `${label}.from`); if (sub.length) return sub; }
  const C = handwearCard(spec), G = C.glove;
  if (C.family !== undefined && !HANDWEAR_FAMILIES.includes(C.family)) errs.push(`${label}.family: one of ${HANDWEAR_FAMILIES.join(', ')}`);
  if (G !== false && G !== undefined) {
    if (!G || typeof G !== 'object') errs.push(`${label}.glove: { cuff?, thick?, fingers?, thumb?, group? }, or false (the bare hand)`);
    else {
      if (G.cuff !== undefined && !share(G.cuff)) errs.push(`${label}.glove.cuff: a share of the forearm, 0 (at the wrist) to 1 (to the elbow)`);
      if (G.thick !== undefined && !(G.thick > 0 && G.thick <= 0.02)) errs.push(`${label}.glove.thick: metres, over 0 and at most 0.02`);
      for (const k of ['fingers', 'thumb']) if (G[k] !== undefined && !Object.hasOwn(FINGERS, G[k])) errs.push(`${label}.glove.${k}: one of ${Object.keys(FINGERS).join(', ')}`);
      if (G.group !== undefined && !GROUP.test(G.group)) errs.push(`${label}.glove.group: a group name`);
      for (const k of Object.keys(G)) if (!['cuff', 'thick', 'fingers', 'thumb', 'group'].includes(k)) errs.push(`${label}.glove: takes cuff, thick, fingers, thumb, group, not '${k}'`);
    }
  }
  if (C.adorn !== undefined && !Array.isArray(C.adorn)) errs.push(`${label}.adorn: a list of { prim, … }`);
  for (const [g, c] of Object.entries(C.tones || {})) if (!isTone(c)) errs.push(`${label}.tones.${g}: '#rrggbb', or { of: <group>, shade: −1 … 1 }`);
  return errs;
}

/** The handwear on a body (see the head of this file). */
export function wearHandwear(A, spec = 'gloves', { id = 'gloves', group = 'Gloves' } = {}) {
  const errs = validateHandwear(spec); if (errs.length) throw new Error(errs.join('; '));
  const C = handwearCard(spec), G = C.glove || null, used = new Set();
  const g0 = G?.group ?? group, parts = {};
  const put = (name, part) => { parts[name] = part; used.add(part.group); };
  // 1 GLOVE: the cuff up the forearm (the adapter's leather), the palm and the digits stood off
  if (G) {
    if ((G.cuff ?? 0) > 0 && A.cuff) for (const [name, part] of Object.entries(A.cuff(G, { id, group: g0 }))) put(name, part);
    const thick = G.thick ?? 0.0018;
    for (const S of A.sides) for (const kind of ['hand', ...DIGITS]) {
      const seg = A.seg(kind, S), P = seg && A.bare(seg); if (!P) continue;
      const keep = kind === 'hand' ? P.stations.length : FINGERS[(kind === 'thumb' ? G.thumb : null) ?? G.fingers ?? 'full'];
      put(`${id}_${seg}`, standOff(P, thick, { keep, group: g0 }));
    }
  }
  // 4 TONE
  const tones = { ...HANDWEAR_TONES, ...(G ? { [g0]: HANDWEAR_TONES[g0] ?? HANDWEAR_TONES.Gloves } : {}), ...(C.tones || {}) };
  return { parts, tones: Object.fromEntries(Object.entries(tones).filter(([g]) => used.has(g))), named: Object.keys(C.tones || {}).filter((g) => used.has(g)) };
}
