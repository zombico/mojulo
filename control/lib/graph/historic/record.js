/**
 * historic/record — the cited record a historic city is built from. Before any geometry, a period is
 * written down as data: the MATERIALS it built with, the METHODS it built by, the building TYPES it
 * raised and the urban FORMS it laid out, each entry citing where the fact comes from. The generator
 * reads only what the record holds, so a building can use only what its builders had.
 *
 * Years are integers on the historical scale, BCE negative (−5400 = 5400 BCE; there is no year 0, so
 * 1 BCE = −1 and 1 CE = 1). A span is { from, to } with to = null for "still in use"; `approx: true`
 * marks a scholarly estimate rather than a fixed date.
 *
 * Every entry also states how far its facts are checked — `confidence`: 'read' (the cited source was read
 * directly), 'secondary' (known through a secondary page that points at the cited source), 'unverified'
 * (a standard account no source in hand confirms) — and may list `disputes` where sources disagree.
 * An unverified entry is allowed (the gap is the point of recording it) but is always reported.
 *
 * Entry shapes (every entry: id, name, kind, confidence, sources[] — { author, title, year, url?, via? }):
 *   material { attested: span & { where[] }, supply, role[], unit?: { l, w, h } (cm), colour?: ['#rrggbb'], notes? }
 *   method   { attested, materials: [material ids], notes? }
 *   type     { built: span, materials: [ids], methods?: [ids], dims?: {…} (m), notes? }
 *   form     { attested, notes? }
 *   dress    { attested, wearer: 'man' | 'woman' | 'hand', cut: 'knee' | 'shin' | 'ankle', looks: [{ shirt, skirt?,
 *              sleeve?, legs?, shoe?, weight? }] (colours #rrggbb), notes? } — a garment and who wore it (./dress.js)
 *
 * checkRecord is the machine gate over a record: it advises (returns findings), never refuses.
 */

export const ENTRY_KINDS = ['material', 'method', 'type', 'form', 'dress'];
export const DRESS_WEARERS = ['man', 'woman', 'hand'];
export const DRESS_CUTS = ['knee', 'shin', 'ankle'];
export const CONFIDENCE = ['read', 'secondary', 'unverified'];
export const MATERIAL_ROLES = ['wall', 'mortar', 'roof', 'structure', 'finish', 'waterproofing', 'paving', 'foundation', 'ornament', 'drainage'];

const HEX = /^#[0-9a-f]{6}$/i;
const spanOf = (e) => (e.kind === 'type' ? e.built : e.attested);
const isYear = (y) => Number.isInteger(y) && y !== 0;

/** Findings over a list of entries: { level: 'error' | 'warn', id, message }. Empty ⇒ the record is sound. */
export function checkRecord(entries) {
  const findings = [];
  const add = (level, id, message) => findings.push({ level, id, message });
  const byId = new Map();
  for (const e of entries) {
    if (!e || typeof e.id !== 'string' || !e.id) { add('error', null, 'entry without an id'); continue; }
    if (byId.has(e.id)) add('error', e.id, 'duplicate id');
    byId.set(e.id, e);
  }
  for (const e of byId.values()) {
    if (!ENTRY_KINDS.includes(e.kind)) add('error', e.id, `unknown kind '${e.kind}'`);
    if (!e.name) add('error', e.id, 'no name');
    if (!CONFIDENCE.includes(e.confidence)) add('error', e.id, `confidence must be one of ${CONFIDENCE.join(', ')}`);
    else if (e.confidence === 'unverified') add('warn', e.id, 'unverified: no source in hand confirms it');
    if (!Array.isArray(e.sources) || !e.sources.length) add('error', e.id, 'no sources');
    else for (const s of e.sources) if (!s || !s.author || !s.title || !s.year) add('error', e.id, 'a source lacks author, title or year');
    const span = spanOf(e);
    if (!span || !isYear(span.from)) add('error', e.id, `no ${e.kind === 'type' ? 'built' : 'attested'}.from year`);
    else if (span.to !== null && span.to !== undefined && (!isYear(span.to) || span.to < span.from)) add('error', e.id, 'span ends before it starts');
    if (e.kind === 'material') {
      if (!Array.isArray(e.role) || !e.role.length) add('error', e.id, 'no structural role');
      else for (const r of e.role) if (!MATERIAL_ROLES.includes(r)) add('warn', e.id, `unknown role '${r}'`);
      for (const c of e.colour || []) if (!HEX.test(c)) add('error', e.id, `colour '${c}' is not #rrggbb`);
    }
    if (e.kind === 'dress') {
      if (!DRESS_WEARERS.includes(e.wearer)) add('error', e.id, `wearer must be one of ${DRESS_WEARERS.join(', ')}`);
      if (!DRESS_CUTS.includes(e.cut)) add('error', e.id, `cut must be one of ${DRESS_CUTS.join(', ')}`);
      if (!Array.isArray(e.looks) || !e.looks.length) add('error', e.id, 'no looks');
      for (const l of e.looks || []) {
        // nobody is bare to the waist: every look covers the torso (its `shirt`)
        if (!l || !HEX.test(l.shirt || '')) { add('error', e.id, 'a look without a #rrggbb shirt'); continue; }
        for (const k of ['skirt', 'legs', 'shoe']) if (l[k] !== undefined && !HEX.test(l[k])) add('error', e.id, `${k} '${l[k]}' is not #rrggbb`);
        if (l.weight !== undefined && !(Number.isInteger(l.weight) && l.weight >= 1)) add('error', e.id, 'a look weight is a whole number from 1');
      }
    }
    // what a method or type uses must exist, and be attested by the year it was first used / built
    for (const ref of [...(e.materials || []), ...(e.methods || [])]) {
      const m = byId.get(ref);
      if (!m) { add('error', e.id, `references unknown '${ref}'`); continue; }
      const own = spanOf(e), theirs = spanOf(m);
      if (own && theirs && isYear(own.from) && isYear(theirs.from) && own.from < theirs.from) {
        add('error', e.id, `uses '${ref}' (from ${fmtYear(theirs.from)}) before it is attested (${fmtYear(own.from)})`);
      }
    }
  }
  return findings;
}

/** The entries of a kind in use at `year` (attested from ≤ year ≤ to, or to open). */
export function inUseAt(entries, year, kind = 'material') {
  return entries.filter((e) => {
    if (e.kind !== kind) return false;
    const s = spanOf(e);
    return s && s.from <= year && (s.to === null || s.to === undefined || year <= s.to);
  });
}

export function fmtYear(y) { return y < 0 ? `${-y} BCE` : `${y} CE`; }
