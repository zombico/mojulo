/**
 * THE FOOD, READ OFF THE CARD: what each thing a work card handles looks like, never modelled item by item. A card
 * already says what each thing is made of; its words say the rest.
 *
 *   1. a thing whose words name a DISH (roster.js DISHES: sushi, a roll, a salad, a soup…) is that dish, its parts what
 *      its station takes;
 *   2. a thing whose words name an INGREDIENT is that ingredient: in the STATE its words say (sliced, cooked, crated…);
 *      else, made from the same ingredient, in the state its station gives (a shovel that does not run alone: prepped;
 *      one that runs alone: cooked; a bucket of one thing: packed); else as it comes (wheat grown from seed is wheat);
 *   3. a thing no row names is read from its station: one thing taken, that thing in the station's state; two or more,
 *      a dish of them on a plate; nothing taken, or raw, a block in a colour of its name.
 *
 *   foodOf(card) → { <item>: look }   look: { item, kind: 'ingredient' | 'dish' | 'block', ingredient?, family?, state,
 *                  form | arrangement, colours, vessel?, parts? (dish: the parts' looks) }
 *   lookFaces(look) → faces            at glyph scale (about one unit across, its base at z = 0)
 *   foodFaces(look, { at?, size? }) → faces   placed: its middle at `at`, its widest `size` metres across (0.4)
 *   bounds(faces) → [[x0, y0, z0], [x1, y1, z1]]
 *
 * Pure, no dice (a block's colour is a hash of its name).
 */
import { readCard, isRaw } from '../worksim/card.js';
import { INGREDIENTS, FAMILY_WORDS, STATES, DISHES } from './roster.js';
import { FORMS, VESSEL_FORMS, ARRANGE } from './forms.js';

const wordsOf = (item) => String(item).toLowerCase().split(/[-_\s]+/).filter(Boolean);
const ingredientOf = (ws) => {
  for (const w of ws) for (const [id, R] of Object.entries(INGREDIENTS)) if (R.words.includes(w)) return id;
  for (const w of ws) for (const [fam, list] of Object.entries(FAMILY_WORDS)) if (list.includes(w)) return Object.keys(INGREDIENTS).find((id) => INGREDIENTS[id].family === fam) ?? null;
  return null;
};
const dishOf = (ws) => { for (const w of ws) for (const [id, D] of Object.entries(DISHES)) if (D.words.includes(w)) return id; return null; };
const stateWord = (ws) => { for (const [id, S] of Object.entries(STATES)) if (S.words.some((w) => ws.includes(w))) return id; return null; };
// a colour from a name (a hash: no dice), mid-light, for a thing no row names
function nameColour(name) {
  let h = 2166136261;
  for (const ch of String(name)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const hue = h % 360, hsl = (hh, s, l) => { const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + hh / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); };
  return [hsl(hue, 0.45, 0.6), hsl(hue, 0.4, 0.75)];
}

// the state a station gives the one thing it takes
const stationState = (st) => (st.verb === 'bucket' ? 'packed' : st.wait ? 'cooked' : 'prepped');

export function foodOf(card) {
  const C = card.producer ? card : readCard(card);
  const items = [...new Set([...Object.keys(C.items), ...Object.values(C.stations).flatMap((st) => [...Object.keys(st.takes), st.item])])];
  const out = {};
  const look = (item, seen = new Set()) => {
    if (out[item]) return out[item];
    if (seen.has(item)) return block(item);
    seen.add(item);
    const ws = wordsOf(item), sid = C.producer[item], st = sid ? C.stations[sid] : null, takes = st ? Object.keys(st.takes) : [];
    const parts = () => takes.map((t) => look(t, seen));
    let L;
    const dish = dishOf(ws);
    // (a dish's colours its parts': a dish that is a part of another reads as them, a salad in a roll as its greens)
    const dished = (d, ps) => ({ item, kind: 'dish', dish: d, arrangement: DISHES[d].arrangement, vessel: DISHES[d].vessel, parts: ps, state: 'whole', colours: ps.flatMap((p) => p.colours.slice(0, 1)) });
    if (dish) L = dished(dish, parts());
    else {
      const ing = ingredientOf(ws);
      if (ing) {
        const said = stateWord(ws), same = takes.length === 1 && ingredientOf(wordsOf(takes[0])) === ing;
        const state = said ?? (st && same ? stationState(st) : 'whole');
        L = state === 'packed' ? packed(item, ing, look(takes[0] ?? item, seen), ws) : ingLook(item, ing, state);
      } else if (st && takes.length === 1) {
        const base = look(takes[0], seen), state = stationState(st);
        // (a block worked or run alone: its colour lighter or darker by the state, so it never looks as it came)
        L = state === 'packed' ? { ...packed(item, base.ingredient, base, ws), item } : base.kind === 'ingredient' ? { ...ingLook(item, base.ingredient, state) } : base.kind === 'block' ? { ...base, item, state, colours: base.colours.map((c) => shade(c, state === 'cooked' ? -0.28 : 0.22)) } : { ...base, item };
      } else if (st && takes.length > 1) L = dished('plate', parts());
      else L = block(item);
    }
    out[item] = L;
    return L;
  };
  for (const item of items) look(item);
  // (raw things, the crates' own, kept whole: a raw thing is never a state of another)
  for (const item of items) if (isRaw(C, item) && out[item].kind === 'ingredient' && out[item].state !== 'whole' && !stateWord(wordsOf(item))) out[item] = ingLook(item, out[item].ingredient, 'whole');
  return out;
}

// a colour moved toward black (k < 0) or white (k > 0)
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}
function block(item) { return { item, kind: 'block', state: 'whole', form: 'block', colours: nameColour(item) }; }
function ingLook(item, ing, state) {
  const R = INGREDIENTS[ing], S = state === 'prepped' ? R.prepped : state === 'cooked' ? R.cooked : null;
  if (state === 'burnt') return { item, kind: 'ingredient', ingredient: ing, family: R.family, state, form: 'burnt', colours: ['#2a2522'] };
  return { item, kind: 'ingredient', ingredient: ing, family: R.family, state, form: S ? S.form : R.form, colours: S ? S.colours : R.colours, ...(S?.vessel ? { vessel: S.vessel } : {}) };
}
// packed: in what its words say (a crate, a box; a bag, a sack), else a sack of a grain and a crate of the rest, its
// thing on top of a crate
const SACK_WORDS = ['bag', 'bagged', 'sack', 'parcel', 'bundle'];
function packed(item, ing, inside, ws = []) {
  const R = ing ? INGREDIENTS[ing] : null, sack = ws.some((w) => SACK_WORDS.includes(w)) || (!ws.some((w) => STATES.packed.words.includes(w)) && R?.family === 'grain');
  return { item, kind: 'ingredient', ingredient: ing, family: R?.family ?? null, state: 'packed', form: inside.form, colours: inside.colours, vessel: sack ? 'sack' : 'crate', inside };
}

/** A look's faces at glyph scale. */
export function lookFaces(L) {
  if (L.kind === 'dish') {
    const V = VESSEL_FORMS[L.vessel](), parts = L.parts.map((p) => (p.kind === 'ingredient' && p.state === 'whole' && p.family !== 'grain' && INGREDIENTS[p.ingredient]?.prepped ? { ...p, form: INGREDIENTS[p.ingredient].prepped.form, colours: INGREDIENTS[p.ingredient].prepped.colours } : p));
    return [...V.faces, ...ARRANGE[L.arrangement](parts, V.top, lookFaces)];
  }
  if (L.state === 'packed') {
    const V = VESSEL_FORMS[L.vessel]();
    if (L.vessel === 'sack') return V.faces;
    return [...V.faces, ...lift(lookFaces({ ...L.inside, vessel: undefined }), [0, 0, V.top], 0.6)];
  }
  const body = FORMS[L.form](L.colours);
  if (!L.vessel) return body;
  const V = VESSEL_FORMS[L.vessel]();
  return [...V.faces, ...lift(body, [0, 0, V.top - 0.02], 0.85)];
}

const lift = (faces, [dx, dy, dz], k = 1) => faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x * k + dx, y * k + dy, z * k + dz]) }));

export function bounds(faces) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); }
  return [lo, hi];
}

/** A look placed: its middle at `at` (its base on at[2]), its widest `size` metres across. */
export function foodFaces(L, { at = [0, 0, 0], size = 0.4, group = null, tall = false } = {}) {
  // (`tall`: its largest extent `size`, a tall thing too: a review's frame)
  const F = lookFaces(L), [lo, hi] = bounds(F), k = size / Math.max(hi[0] - lo[0], hi[1] - lo[1], tall ? hi[2] - lo[2] : 0, 1e-6), cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
  const r = (v) => Math.round(v * 1000) / 1000;
  return F.map((f) => ({ ...f, ...(group ? { group } : {}), corners: f.corners.map(([x, y, z]) => [r(at[0] + (x - cx) * k), r(at[1] + (y - cy) * k), r(at[2] + (z - lo[2]) * k)]) }));
}
