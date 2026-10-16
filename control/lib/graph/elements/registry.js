/**
 * THE ELEMENTS — what a world is styled from, each shown as itself: a GEOCUBE (one style for a level's inside and its
 * outside), a KIT (the ground and the room a stage is drawn in), a city GRAMMAR (how a city is laid out, how high and of
 * what). Each is a document mojulo holds, so it can be seen without a recipe: its colours as strips, its document, and
 * a live specimen drawn as an unsaved World (a geocube's room and land, a kit's bare stage, a grammar's small city).
 *
 *   ELEMENT_FAMILIES                       [{ id, name }]
 *   listElements(family)                   [{ id, title, reads, colours: [[hex…]…], views: [{ id, name }] }]
 *   elementDocument(family, id)            the element as data
 *   elementManifest(family, id, view)      the specimen recipe a World is drawn from (never stored)
 *   usedBy(family, id, rows)               the recipes that name it ({ ref, title, kind })
 *
 * Pure: the colours, the documents and the specimens are read from the tables. Every word shown is the table's own.
 */
import { GEOCUBE_PRESETS, readGeocube, geocubeRamps, geocubeTerrains } from '../era/geocube.js';
import { STAGE_KITS, isGroundKit } from '../era/stage.js';
import { SWATCHES } from '../era/style/swatches.js';
import { GRAMMAR_IDS, resolveGrammar } from '../city/plan/grammars.js';
import { inferCity } from '../city/plan/card.js';
import { isGameworldKind, gameworldOf } from '../gameworld/gameworld-kind.js';

export const ELEMENT_FAMILIES = Object.freeze([
  { id: 'geocubes', name: 'Geocubes' },
  { id: 'kits', name: 'Kits' },
  { id: 'grammars', name: 'City grammars' },
]);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const hex = (c) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c
  : Array.isArray(c) && c.length >= 3 && c.slice(0, 3).every(Number.isFinite) ? `#${c.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}` : null);
/** Every colour in a value, as hex, in the order met (a palette, a ramp, a skin's pairs). */
function coloursIn(v, out = []) {
  const h = hex(v);
  if (h) out.push(h);
  else if (Array.isArray(v)) v.forEach((x) => coloursIn(x, out));
  else if (isObj(v)) Object.values(v).forEach((x) => coloursIn(x, out));
  return out;
}

// a room kit is drawn as one bare room; open ground is drawn as itself
const ROOM = Object.freeze({ id: 'room', x: 0, y: 0, w: 12, d: 12, h: 6, open: ['-y', '+x'] });
const isOpenGround = (kit) => !!STAGE_KITS[kit] && isGroundKit(kit);   // the one rule (era/stage.js)
const grammarCity = (id, look) => ({ kind: 'city', ...inferCity({ seed: 3, grammar: id, board: { cols: 8, rows: 6 } }).recipe, ...(look ? {} : { fidelity: 'massing' }) });

const FAMILIES = {
  geocubes: {
    ids: () => Object.keys(GEOCUBE_PRESETS),
    card(id) {
      const c = readGeocube(id);
      return {
        id, title: c.title ?? id, reads: c.reads ?? '',
        colours: Object.values(geocubeRamps(c)),
        terrains: geocubeTerrains(c).map((t) => t.name),
        views: [{ id: 'room', name: 'Room' }, { id: 'land', name: 'Land' }],
      };
    },
    document: (id) => readGeocube(id),
    // the geocube kind's own specimens: its room (the inside) and its landform (the outside, its own terrain)
    manifest: (id, view = 'room') => ({ kind: 'geocube', cube: id, show: view === 'room' ? 'room' : 'land' }),
    names: (m, id) => {
      const named = (g) => g === id || (isObj(g) && g.from === id);
      const w = isGameworldKind(m.kind) ? gameworldOf(m) : null;
      return named(m.geocube) || named(m.paint?.geocube) || (w && (named(w.style?.geocube) || Object.values(isObj(w.levels) ? w.levels : {}).some((l) => named(l?.style?.geocube))));
    },
  },
  kits: {
    ids: () => Object.keys(STAGE_KITS),
    card: (id) => ({
      id, title: id, reads: STAGE_KITS[id].shell ?? '',
      colours: Object.values(SWATCHES[id]?.land ?? {}).map((ramp) => coloursIn(ramp)).filter((r) => r.length),
      views: [{ id: 'stage', name: isOpenGround(id) ? 'Ground' : 'Room' }],
    }),
    document: (id) => STAGE_KITS[id],
    manifest: (id) => (isOpenGround(id) ? { kind: 'stage', kit: id, seed: 1 } : { kind: 'stage', kit: id, seed: 1, rooms: [ROOM] }),
    names: (m, id) => {
      const w = isGameworldKind(m.kind) ? gameworldOf(m) : null;
      return m.kit === id || (w && (w.style?.kit === id || Object.values(isObj(w.levels) ? w.levels : {}).some((l) => l?.style?.kit === id)));
    },
  },
  grammars: {
    ids: () => [...GRAMMAR_IDS],
    card(id) {
      const g = resolveGrammar(id);
      return {
        id, title: g.label ?? id, reads: g.locale ?? '',
        colours: ['glass', 'stone', 'brick', 'roof'].map((k) => coloursIn(g.skin?.[k])).filter((r) => r.length),
        views: [{ id: 'massing', name: 'Massing' }, { id: 'look', name: 'Look' }],
      };
    },
    document: (id) => resolveGrammar(id),
    manifest: (id, view = 'massing') => grammarCity(id, view === 'look'),
    names: (m, id) => m.kind === 'city' && (m.grammar === id || (isObj(m.grammar) && m.grammar.from === id)),
  },
};

const family = (f) => {
  const F = FAMILIES[f];
  if (!F) throw new Error(`elements: '${f}' is not a family (${Object.keys(FAMILIES).join(', ')})`);
  return F;
};
const known = (F, f, id) => {
  if (!F.ids().includes(id)) throw new Error(`elements: '${id}' is not one of the ${f} (${F.ids().join(', ')})`);
};

/** A family's elements as cards. */
export const listElements = (f) => family(f).ids().map((id) => family(f).card(id));

/** One element: its card and its document. */
export function readElement(f, id) {
  const F = family(f);
  known(F, f, id);
  return { family: f, ...F.card(id), document: F.document(id) };
}

/** The specimen recipe a view of an element is drawn from. */
export function elementManifest(f, id, view) {
  const F = family(f);
  known(F, f, id);
  const views = F.card(id).views.map((v) => v.id);
  const at = view ?? views[0];
  if (!views.includes(at)) throw new Error(`elements: ${f} '${id}' is seen as ${views.join(', ')}, not '${at}'`);
  return F.manifest(id, at);
}

/** The recipes (rows of { ref, title, manifest }) that name an element. */
export function usedBy(f, id, rows) {
  const F = family(f);
  return rows.filter((r) => isObj(r.manifest) && F.names(r.manifest, id)).map((r) => ({ ref: r.ref, title: r.title || r.ref, kind: r.manifest.kind }));
}

/** The kinds whose recipes can name an element of a family (what `usedBy` reads). */
export const NAMING_KINDS = Object.freeze({ geocubes: ['stage', 'gameworld', 'city', 'geocube'], kits: ['stage', 'gameworld'], grammars: ['city'] });
