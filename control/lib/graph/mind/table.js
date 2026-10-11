/**
 * The live solve behind MIND_TABLE: every named mind and every species' mind, each situation said as the strategy it
 * resolves to (a minion or elite) or its repertoire (a duelist). Read by the generator and the deep test.
 *
 *   liveMindTable() → { presets: { [id]: Row }, fauna: { [species]: Row } }   Row = { [situation]: id | [ids] }
 */
import { SPECIES } from '../fauna/species.js';
import { resolveMind } from './resolve.js';
import { PRESETS, faunaMind } from './presets.js';

const rowOf = (r) => Object.fromEntries(Object.entries(r.situations).map(([k, v]) => [k, v.strategy ?? v.repertoire]));

export function liveMindTable() {
  const presets = {}, fauna = {};
  for (const [id, p] of Object.entries(PRESETS)) presets[id] = rowOf(resolveMind(p.mind, p.body));
  for (const id of Object.keys(SPECIES).sort()) { const f = faunaMind(id); fauna[id] = rowOf(resolveMind(f.mind, f.body)); }
  return { presets, fauna };
}
