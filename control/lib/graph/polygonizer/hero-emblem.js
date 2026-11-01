/**
 * THE HERO'S EMBLEM AND NAME — a named hero's identity, the part of it that travels into any game on this machine and is
 * drawn there on whatever body the game gives it. A name is the hero's own (unique on the machine: the door's handlers
 * hold that, never this module); an emblem is its mark (a logo, an insignia), pasted as SVG paths, kept on the hero as
 * given and lowered at every read to FIELD PAINT (field-paint.js) on the place it is worn, so a body or a palette edit
 * redraws it and nothing derived is stored.
 *
 *   hero.name     a name: letters, digits, spaces and . ' - _ &, 1 to 40 characters, trimmed
 *   hero.emblem   { layers: [{ path, role?, color? }…], at?, size?, offset? }
 *                   layers  1 to 8, painted in order (the field first, a charge over it): each one SVG path's d (a mark,
 *                           field-paint.js markPolys), its colour a ROLE's (EMBLEM_ROLES: the hero's palette group of that
 *                           role, else the palette's colour that role falls back to, else the role's own) or its own
 *                           fixed `color`; a layer with no role is the field when it is the first, a charge after
 *                   at      where it is worn (EMBLEM_PLACES): 'chest' (the default) or 'back'
 *                   size    its larger side as a share of the place's chart (the place's own by default)
 *                   offset  [dx, dy] shares of the chart from the place's centre, x to the viewer's right, y up
 *
 *   EMBLEM_PLACES, EMBLEM_ROLES, HERO_NAME
 *   validateHeroName(name)          error strings
 *   readHeroName(name)              the name as stored (trimmed, inner spaces one), or throws
 *   validateEmblem(emblem)          error strings (each layer's path read as a mark is: why it cannot be cut)
 *   emblemFieldPaint(emblem, palette)   → field-paint entries, in order, each its colour resolved
 *   heroFieldPaint(manifest)        a layered manifest's field paint with its hero's emblem under its own entries: the
 *                                   list every reader paints (the World, the rig pack, the mint's readout), or the
 *                                   manifest's own when its hero wears none
 *
 * Pure and deterministic.
 */
import { validateFieldPaint } from './field-paint.js';
import { camoFieldPaint } from '../outfit/camouflage.js';
import { isOutfitBuild, outfitLanguage } from '../outfit/expand.js';

/** where an emblem is worn: the field-paint entry's parts (the body part and every layer worn over it, so it lands on the
 * outermost: the suit, the top, a catsuit's painted skin), its chart, its centre and its size by default */
export const EMBLEM_PLACES = Object.freeze({
  chest: Object.freeze({ part: Object.freeze(['torso', '*_torso']), chart: 'front', at: Object.freeze([0.5, 0.66]), size: 0.3 }),
  back: Object.freeze({ part: Object.freeze(['torso', '*_torso']), chart: 'back', at: Object.freeze([0.5, 0.62]), size: 0.4 }),
});
/** an emblem's colour roles: the palette group a layer of that role paints (which a palette edit recolours), the hero's
 * palette colours it falls back to in turn (the suit's accent for the field, its base for the charge), and its own */
export const EMBLEM_ROLES = Object.freeze({
  field: Object.freeze({ group: 'EmblemField', from: Object.freeze(['OutfitAccent', 'Trim']), own: '#d9b25a' }),
  charge: Object.freeze({ group: 'EmblemCharge', from: Object.freeze(['OutfitBase', 'Top']), own: '#1c1c22' }),
  outline: Object.freeze({ group: 'EmblemOutline', from: Object.freeze(['Shoes']), own: '#111114' }),
});
export const HERO_NAME = Object.freeze({ max: 40, re: /^[\p{L}\p{N}][\p{L}\p{N} .'&_-]*$/u });
const EMBLEM_KEYS = ['layers', 'at', 'size', 'offset'], LAYER_KEYS = ['path', 'role', 'color'];
const HEX = /^#[0-9a-f]{6}$/i;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

const tidy = (name) => name.trim().replace(/\s+/g, ' ');
export function validateHeroName(name) {
  if (name === undefined || name === null) return [];
  if (typeof name !== 'string' || !tidy(name)) return ['name: the hero\'s name, a word or a few ("Nightjar", "Captain Vale")'];
  const n = tidy(name);
  if (n.length > HERO_NAME.max) return [`name: at most ${HERO_NAME.max} characters (this one is ${n.length})`];
  if (!HERO_NAME.re.test(n)) return ['name: letters, digits, spaces and . \' - _ &, starting with a letter or a digit'];
  return [];
}
export function readHeroName(name) {
  const e = validateHeroName(name);
  if (e.length) throw new Error(e[0]);
  return tidy(name);
}

const roleOf = (L, i) => L.role ?? (i === 0 ? 'field' : 'charge');
/** the field-paint entries an emblem lowers to: each layer one entry on its place, its colour fixed or its role's. A role's
 * group takes the role's colour; a fixed colour paints a group of the layer's own, so two fixed layers never share one */
export function emblemFieldPaint(emblem, palette = {}) {
  const P = EMBLEM_PLACES[emblem.at ?? 'chest'], size = emblem.size ?? P.size, off = emblem.offset ?? [0, 0];
  const at = [P.at[0] + off[0], P.at[1] + off[1]];
  return emblem.layers.map((L, i) => {
    const R = EMBLEM_ROLES[roleOf(L, i)];
    const color = L.color ?? palette[R.group] ?? R.from.map((g) => palette[g]).find((h) => HEX.test(h ?? '')) ?? R.own;
    return { part: [...P.part], chart: P.chart, shape: { path: L.path }, at, size, group: L.color ? `EmblemLayer${i + 1}` : R.group, color };
  });
}

export function validateEmblem(emblem) {
  if (emblem === undefined || emblem === null) return [];
  if (!isObj(emblem)) return ['emblem: { layers: [{ path, role?, color? }], at?, size?, offset? } (a mark pasted as SVG paths)'];
  const errs = [];
  for (const k of Object.keys(emblem)) if (!EMBLEM_KEYS.includes(k)) errs.push(`emblem.${k}: not an emblem word (${EMBLEM_KEYS.join(', ')})`);
  if (!Array.isArray(emblem.layers) || !emblem.layers.length || emblem.layers.length > 8) return [...errs, 'emblem.layers: 1 to 8 layers, each { path: an SVG path\'s d, role?, color? }, the field first'];
  if (emblem.at !== undefined && !EMBLEM_PLACES[emblem.at]) errs.push(`emblem.at: where it is worn (${Object.keys(EMBLEM_PLACES).join(', ')})`);
  if (emblem.size !== undefined && !(isNum(emblem.size) && emblem.size >= 0.05 && emblem.size <= 0.9)) errs.push('emblem.size: its larger side, a share of the place\'s chart, 0.05 to 0.9');
  if (emblem.offset !== undefined && !(Array.isArray(emblem.offset) && emblem.offset.length === 2 && emblem.offset.every((v) => isNum(v) && Math.abs(v) <= 0.4))) errs.push('emblem.offset: [dx, dy] shares of the chart from the place\'s centre, each within ±0.4');
  emblem.layers.forEach((L, i) => {
    const at = `emblem.layers[${i}]`;
    if (!isObj(L)) { errs.push(`${at}: { path, role?, color? }`); return; }
    for (const k of Object.keys(L)) if (!LAYER_KEYS.includes(k)) errs.push(`${at}.${k}: not a layer word (${LAYER_KEYS.join(', ')})`);
    if (L.role !== undefined && !EMBLEM_ROLES[L.role]) errs.push(`${at}.role: one of ${Object.keys(EMBLEM_ROLES).join(', ')} (its colour the hero's palette's for that role)`);
    if (L.color !== undefined && !HEX.test(L.color)) errs.push(`${at}.color: a fixed '#rrggbb' in place of its role's colour`);
  });
  if (errs.length) return errs;
  // each layer's path read as the field paint reads it, its errors said as the layer's
  return validateFieldPaint(emblemFieldPaint(emblem)).map((e) => e.replace(/^fieldPaint\[(\d+)\]\.shape/, (_, i) => `emblem.layers[${i}]`));
}

/** The field paint a layered manifest is painted with: its hero's emblem first (so the row's own entries paint over it),
 * its colours from the recipe's palette as it reads now; under it the camouflage its outfit is printed in. A manifest whose
 * hero wears neither: its own list as it is. */
export function heroFieldPaint(m) {
  const E = m?.hero?.emblem;
  // (the camouflage its outfit is printed in, outfit/camouflage.js: under the emblem, the row's own over both)
  const camo = isOutfitBuild(m?.hero?.outfit) ? camoFieldPaint(outfitLanguage(m.hero.outfit), m.recipe) : null;
  if (!E && !camo) return m?.fieldPaint;
  return [...(camo || []), ...(E ? emblemFieldPaint(E, m.recipe?.palette ?? m.hero.palette ?? {}) : []), ...(Array.isArray(m.fieldPaint) ? m.fieldPaint : [])];
}
