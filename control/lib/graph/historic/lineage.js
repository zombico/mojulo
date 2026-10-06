/**
 * lineage — how the historic cultures draw on each other through history, read off their cards (`draws`), so a new
 * culture starts from what history carried into it rather than from nothing.
 *
 * A relation is declared on the LATER culture's card:
 *
 *   draws: [{ from: 'giza', kind: 'continues', parts: ['patterns', 'skins', 'record'], note: '…' }]
 *
 * KINDS say how the forms travelled; PARTS say what the relation carries. This is history, not code: what a
 * culture actually shares by identity (the kit it runs on) is its depth (./depth.js).
 *
 * The BRIEF (`drawable`) lists, for a culture or a draft, what each relation offers at its year: patterns, skins,
 * assets, the layout, and the source's record entries in use then. A drawn record entry stays the source's: for the
 * new culture it is a PARALLEL to verify, never its basis. Pure.
 */
import { HISTORIC_CULTURES } from './cultures/index.js';
import { inUseAt, fmtYear } from './record.js';

export const KINDS = {
  continues: 'the same land, a later period',
  inherits: 'a tradition carried to another place',
  contact: 'forms taken across cultures, by trade or rule',
  contemporary: 'the same culture at the same time, elsewhere',
  variant: 'a generic or sibling version',
};
export const PARTS = ['palette', 'skins', 'patterns', 'assets', 'layout', 'record', 'dress'];

/**
 * Which record entries a relation carries. A tradition travels as its materials and methods; particular buildings
 * (types) and the town's form stay in their place, so only a culture on the same ground (`continues`) or a version
 * of the same town (`variant`) inherits them.
 */
export const RECORD_KINDS = {
  continues: ['material', 'method', 'type', 'form'],
  variant: ['material', 'method', 'type', 'form'],
  contemporary: ['material', 'method'],
  inherits: ['material', 'method'],
  contact: ['material', 'method'],
};

const drawsOf = (K) => (K && Array.isArray(K.draws) ? K.draws : []);

/** A culture's relations both ways: `{ drawsOn: [{ from, kind, parts, note }], drawnOnBy: [{ by, kind, parts }] }`. */
export function relationsOf(id) {
  const drawnOnBy = [];
  for (const [other, K] of Object.entries(HISTORIC_CULTURES)) for (const r of drawsOf(K)) if (r.from === id && other !== id) drawnOnBy.push({ by: other, kind: r.kind, parts: r.parts });
  return { drawsOn: drawsOf(HISTORIC_CULTURES[id]), drawnOnBy };
}

/** Every culture a culture draws on, transitively, nearest first: `[{ id, kind, via }]`. */
export function ancestry(id) {
  const out = [], seen = new Set([id]);
  let frontier = [{ id, via: null }];
  while (frontier.length) {
    const next = [];
    for (const { id: at } of frontier) for (const r of drawsOf(HISTORIC_CULTURES[at])) {
      if (seen.has(r.from)) continue;
      seen.add(r.from);
      out.push({ id: r.from, kind: r.kind, via: at === id ? null : at });
      next.push({ id: r.from });
    }
    frontier = next;
  }
  return out;
}

/** The whole tree: every relation as an edge `{ from, to, kind, parts }`, in registry order of the later culture. */
export function lineageTree() {
  const edges = [];
  for (const [to, K] of Object.entries(HISTORIC_CULTURES)) for (const r of drawsOf(K)) edges.push({ from: r.from, to, kind: r.kind, parts: r.parts || [], note: r.note });
  return edges;
}

/** The year a culture (or draft) is read at: its `readAt`, else the middle of its span. */
export function yearOf(K) {
  if (Number.isFinite(K.readAt)) return K.readAt;
  return Array.isArray(K.years) ? Math.round((K.years[0] + K.years[1]) / 2) : null;
}

/**
 * The brief: for a culture id or a draft card (`{ draws, readAt | years }`), what each relation offers at its year.
 * `[{ from, kind, note, year, patterns?, skins?, assets?, layout?, palette?, record?: { id, inUse: [{ id, name, kind,
 * confidence, where }] } }]` — only the parts the relation carries.
 */
export function drawable(culture) {
  const K = typeof culture === 'string' ? HISTORIC_CULTURES[culture] : culture;
  if (!K) return [];
  const year = yearOf(K);
  return drawsOf(K).map((r) => {
    const S = HISTORIC_CULTURES[r.from], parts = new Set(r.parts || []), out = { from: r.from, kind: r.kind, note: r.note || '', year };
    if (!S) return { ...out, missing: true };
    if (parts.has('palette')) out.palette = Object.keys(S.palette || {});
    if (parts.has('skins')) out.skins = [...new Set(Object.values(S.skins?.kinds || {}))];
    if (parts.has('patterns')) out.patterns = [...(S.patterns || [])];
    if (parts.has('assets')) out.assets = Object.entries(S.assets || {}).map(([id, a]) => ({ id, read: a.read || '' }));
    if (parts.has('layout')) out.layout = S.layout || 'ring-canal';
    // `dress`: the garments its people wore at this year, which the new culture's people wear where its own record has none
    if (parts.has('dress') && S.record && year !== null) out.dress = inUseAt(S.record.entries, year, 'dress').map((e) => ({ id: e.id, name: e.name, wearer: e.wearer, confidence: e.confidence }));
    if (parts.has('record') && S.record && year !== null) {
      const inUse = (RECORD_KINDS[r.kind] || ['material', 'method']).flatMap((k) => inUseAt(S.record.entries, year, k));
      out.record = { id: S.record.id, inUse: inUse.map((e) => ({ id: e.id, name: e.name, kind: e.kind, confidence: e.confidence, where: (e.attested && e.attested.where) || [] })) };
    }
    return out;
  });
}

/** The brief as text, for a README or the agent: what to draw from, the record entries as parallels to verify. */
export function briefText(culture) {
  const rows = drawable(culture);
  if (!rows.length) return 'Draws on no culture yet: name its relations (`draws`) to start from what history carried into it.';
  const out = [];
  for (const r of rows) {
    out.push(`### From ${r.from} (${r.kind}: ${KINDS[r.kind] || r.kind})${r.note ? ` — ${r.note}` : ''}`, '');
    if (r.missing) { out.push(`- ${r.from} is not a registered culture.`, ''); continue; }
    if (r.layout) out.push(`- Layout: \`${r.layout}\``);
    if (r.patterns) out.push(`- Patterns: ${r.patterns.join(', ')}`);
    if (r.skins) out.push(`- Wall skins: ${r.skins.join(', ')}`);
    if (r.palette) out.push(`- Palette roles: ${r.palette.join(', ')}`);
    if (r.assets) out.push(`- Assets: ${r.assets.map((a) => a.id).join(', ')}`);
    if (r.dress) out.push(`- Dress at c. ${fmtYear(r.year)}: ${r.dress.length ? r.dress.map((e) => `${e.name} (${e.wearer})`).join(', ') : 'none recorded then'}`);
    if (r.record) {
      out.push(`- Its record (${r.record.id}) in use at c. ${fmtYear(r.year)}: ${r.record.inUse.length} entries, PARALLELS to verify for this culture, never its basis:`);
      for (const e of r.record.inUse) out.push(`  - ${e.name} [${e.kind}, ${e.confidence}]${e.where.length ? ` — ${e.where.join(', ')}` : ''}`);
    }
    out.push('');
  }
  return out.join('\n').trimEnd();
}
