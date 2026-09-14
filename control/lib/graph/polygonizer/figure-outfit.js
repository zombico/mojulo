/**
 * OUTFIT — dressing a figure by tiers, lowered to the garment array (outfit.plan.md P4).
 *
 * `garment` is the LOWERED form: an ordered list of wardrobe keys and inline specs, and it is the
 * compatibility promise (a minted row keeps rendering byte-identical). `outfit` is the authoring
 * form above it, a ladder where every rung is the rung below with fewer decisions made:
 *
 *   'shift-and-trousers'                       a NAMED OUTFIT (the book's; resolved by value at mint)
 *   { fit: 'relaxed', layers: [ ... ] }        layers inner → outer, one global ease dial
 *     'tee'                                    a garment NAME (core shell, or a book garment resolved at mint)
 *     { garment: 'shift-dress', dials, cloth } a name + DIALS (hem, length, ease…) + cloth
 *     { id, pieces, seams }                    the craft tier: an inline spec, pieces in cm
 *
 * Two functions, two moments. `resolveOutfitNames` runs ONCE at mint with the book's wardrobe in
 * hand and replaces every book name by its spec, stamped `from: 'book:<id>'`; core names stay
 * names. `lowerOutfit` runs at every render with core tables only — pure, so book drift can
 * never change a figure that already exists. Nothing here reads the registry.
 */

import { GARMENTS, validateGarmentSpec } from './figure-garments.js';

export const OUTFIT_FITS = Object.freeze({
  slim: { ease_cm: 0.75, clearance: 0.75 },
  regular: { ease_cm: 1.5, clearance: 1 },
  relaxed: { ease_cm: 3, clearance: 1.4 },
});
export const OUTFIT_FIT_NAMES = Object.keys(OUTFIT_FITS);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isPatternSpec = (spec) => isObj(spec) && Array.isArray(spec.pieces) && spec.pieces.some((p) => p && p.fit === 'pattern');

// Dials over a pattern spec: every `sloper` piece takes the common dials; a key that names a
// piece (or a mirror's id) scopes its object to that piece only.
function applyDials(spec, dials) {
  if (!isObj(dials) || !Object.keys(dials).length) return spec;
  const ids = new Set(spec.pieces.flatMap((p) => [p.id, p.mirror].filter(Boolean)));
  const common = Object.fromEntries(Object.entries(dials).filter(([k, v]) => !(ids.has(k) && isObj(v))));
  return {
    ...spec,
    pieces: spec.pieces.map((p) => (p && p.sloper
      ? { ...p, dials: { ...(p.dials ?? {}), ...common, ...(isObj(dials[p.id]) ? dials[p.id] : {}), ...(p.mirror && isObj(dials[p.mirror]) ? dials[p.mirror] : {}) } }
      : p)),
  };
}

// One layer → one garment entry (a key string or an inline spec).
function lowerLayer(layer, fit, garments) {
  const f = fit ? OUTFIT_FITS[fit] : null;
  let base, opts = {};
  if (typeof layer === 'string') base = layer;
  else if (isObj(layer) && layer.garment !== undefined) { base = layer.garment; opts = layer; }
  else if (isObj(layer)) base = layer;   // an inline spec is its own layer
  else throw new Error(`outfit layer must be a garment name, { garment, dials?, cloth? }, or an inline spec`);
  let spec = typeof base === 'string' ? garments[base] : base;
  if (!spec) throw new Error(`outfit layer '${typeof base === 'string' ? base : '?'}' is not a wardrobe key — a book garment is resolved by name at mint`);
  const key = typeof base === 'string' ? base : null;
  const touched = opts.cloth !== undefined || isObj(opts.dials) || opts.ease_cm !== undefined || (f && fit !== 'regular');
  if (key && !touched) return key;   // a bare core name lowers to the name — byte-identical to `garment`
  spec = { ...spec, pieces: spec.pieces.map((p) => ({ ...p })) };
  if (opts.cloth !== undefined) spec.color = { ...(spec.color ?? {}), cloth: opts.cloth };
  if (isPatternSpec(spec)) {
    if (isObj(opts.dials)) spec = applyDials(spec, opts.dials);
    if (opts.ease_cm !== undefined) spec.ease_cm = opts.ease_cm;
    else if (f && fit !== 'regular') spec.ease_cm = f.ease_cm;
  } else if (f && fit !== 'regular') {
    spec.pieces = spec.pieces.map((p) => (Number.isFinite(p.clearance) ? { ...p, clearance: p.clearance * f.clearance } : p));
  }
  return spec;
}

/**
 * Lower an outfit to the garment array. Pure, core tables only. Null for no outfit.
 * @param {string|object|null} outfit
 * @param {{ garments?: object }} [opts]  the core wardrobe (test seam)
 */
export function lowerOutfit(outfit, { garments = GARMENTS } = {}) {
  if (outfit == null) return null;
  if (typeof outfit === 'string') throw new Error(`outfit '${outfit}' is not lowered — a named outfit is resolved by value at mint (the book's), core carries none`);
  if (!isObj(outfit) || !Array.isArray(outfit.layers)) throw new Error('outfit must be { fit?, layers: [...] }');
  const fit = outfit.fit ?? null;
  return outfit.layers.map((layer) => lowerLayer(layer, fit, garments));
}

/** The garment array a figure manifest wears: `garment` (the lowered form) or its `outfit` lowered. */
export function manifestGarment(manifest = {}) {
  if (manifest.garment !== undefined && manifest.garment !== null) return manifest.garment;
  return manifest.outfit != null ? lowerOutfit(manifest.outfit) : null;
}

/**
 * Replace book names by their specs (by value, stamped `from`). `wardrobe` is a Map id →
 * { kind: 'garment' | 'outfit', spec }. Core names stay names. Unknown names are left for
 * `validateOutfit` to refuse.
 */
export function resolveOutfitNames(outfit, wardrobe, { garments = GARMENTS } = {}) {
  if (outfit == null || !wardrobe) return outfit;
  const get = (name, kind) => { const e = wardrobe.get?.(name); return e && e.kind === kind ? e : null; };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  if (typeof outfit === 'string') {
    const e = get(outfit, 'outfit');
    if (!e) return outfit;
    return resolveOutfitNames({ ...clone(e.spec), from: `book:${outfit}` }, wardrobe, { garments });
  }
  if (!isObj(outfit) || !Array.isArray(outfit.layers)) return outfit;
  const layers = outfit.layers.map((layer) => {
    const name = typeof layer === 'string' ? layer : (isObj(layer) && typeof layer.garment === 'string' ? layer.garment : null);
    if (!name || garments[name]) return layer;
    const e = get(name, 'garment');
    if (!e) return layer;
    return typeof layer === 'string' ? { garment: clone(e.spec), from: `book:${name}` } : { ...layer, garment: clone(e.spec), from: `book:${name}` };
  });
  return { ...outfit, layers };
}

/**
 * Validate an outfit at the door. `wardrobe` (optional) lets a bare book name pass before
 * resolution; without it every name must be a core key or an inline spec.
 */
export function validateOutfit(outfit, label = 'outfit', { garments = GARMENTS, wardrobe = null } = {}) {
  const errors = [];
  if (outfit == null) return errors;
  const known = (name, kind) => Boolean(wardrobe?.get?.(name) && wardrobe.get(name).kind === kind);
  const available = (kind) => (wardrobe ? [...wardrobe.entries()].filter(([, e]) => e.kind === kind).map(([k]) => k) : []);
  if (typeof outfit === 'string') {
    if (!known(outfit, 'outfit')) errors.push(`${label}: '${outfit}' is not a named outfit${available('outfit').length ? ` (the book has: ${available('outfit').join(', ')})` : ' — no book outfit is attached; pass { fit?, layers } instead'}`);
    return errors;
  }
  if (!isObj(outfit)) { errors.push(`${label}: must be a named outfit (string) or { fit?, layers: [...] }`); return errors; }
  if (outfit.fit !== undefined && !OUTFIT_FIT_NAMES.includes(outfit.fit)) errors.push(`${label}.fit: one of ${OUTFIT_FIT_NAMES.join(' | ')}`);
  if (!Array.isArray(outfit.layers) || !outfit.layers.length) { errors.push(`${label}.layers: a non-empty array, inner → outer`); return errors; }
  outfit.layers.forEach((layer, i) => {
    const lbl = `${label}.layers[${i}]`;
    const nameOk = (name) => garments[name] || known(name, 'garment');
    const nameErr = (name) => `${lbl}: '${name}' is not a wardrobe key (${Object.keys(garments).join(' | ')})${available('garment').length ? ` or a book garment (${available('garment').join(', ')})` : ''}`;
    if (typeof layer === 'string') { if (!nameOk(layer)) errors.push(nameErr(layer)); return; }
    if (!isObj(layer)) { errors.push(`${lbl}: a garment name, { garment, dials?, cloth? }, or an inline spec`); return; }
    if (layer.garment !== undefined) {
      let spec = null;
      if (typeof layer.garment === 'string') { if (!nameOk(layer.garment)) { errors.push(nameErr(layer.garment)); return; } spec = garments[layer.garment] ?? wardrobe.get(layer.garment).spec; }
      else if (isObj(layer.garment)) { const e = validateGarmentSpec(layer.garment, `${lbl}.garment`); if (e.length) { errors.push(...e); return; } spec = layer.garment; }
      else { errors.push(`${lbl}.garment: a name or an inline spec`); return; }
      if (layer.dials !== undefined) {
        if (!isObj(layer.dials)) errors.push(`${lbl}.dials: an object of block dials`);
        else if (!isPatternSpec(spec)) errors.push(`${lbl}.dials: '${typeof layer.garment === 'string' ? layer.garment : spec.id}' is an offset shell — dials need a cut-and-sewn (fit:'pattern') garment`);
      }
      if (layer.cloth !== undefined && typeof layer.cloth !== 'string') errors.push(`${lbl}.cloth: a hex colour string`);
      if (layer.ease_cm !== undefined && !(Number.isFinite(layer.ease_cm) && layer.ease_cm >= 0 && layer.ease_cm <= 30)) errors.push(`${lbl}.ease_cm: a number in [0, 30]`);
      return;
    }
    errors.push(...validateGarmentSpec(layer, lbl));
  });
  return errors;
}
