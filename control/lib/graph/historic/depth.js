/**
 * depth — how far a culture is built, read off what it owns and what it shares with a culture registered before
 * it (./cultures/index.js order). A culture enters at any depth and deepens:
 *
 *   0  a card — palette, skins, patterns, the contract lines — on another culture's kit and layout (its record
 *      none yet, or, for a generic variant like the polis, its parent's);
 *   1  + its own record and style card (researched);
 *   2  + its own assets (its forms, through the asset loop);
 *   3  + its own layout (its place).
 *
 * "Shares" is identity, not likeness: the same record entries, the same assets object, the same layout id. A
 * culture spread from another (`{ ...LINDOS, … }`) shares what it did not replace, so the depth is never claimed,
 * only found. Pure.
 */
import { HISTORIC_CULTURES } from './cultures/index.js';
import { HISTORIC_STYLES } from './style/index.js';

const layoutOf = (K) => K.layout || 'ring-canal';

/** `{ depth, owns: [...], borrows: { part: cultureId } }` for a registered culture. */
export function cultureDepth(id) {
  const ids = Object.keys(HISTORIC_CULTURES), K = HISTORIC_CULTURES[id];
  if (!K) return null;
  const before = ids.slice(0, ids.indexOf(id) >= 0 ? ids.indexOf(id) : ids.length).filter((o) => o !== id);
  const sharer = (same) => before.find((o) => same(HISTORIC_CULTURES[o]));
  const borrows = {};
  const rec = K.record && sharer((O) => O.record && O.record.entries === K.record.entries);
  if (rec) borrows.record = rec;
  const kit = K.assets && sharer((O) => O.assets === K.assets);
  if (kit) borrows.assets = kit;
  const lay = sharer((O) => layoutOf(O) === layoutOf(K));
  if (lay) borrows.layout = lay;
  const owns = {
    record: !!K.record && !rec,
    style: !!HISTORIC_STYLES[id],
    assets: !kit,
    layout: !lay,
  };
  const depth = owns.layout ? 3 : owns.assets ? 2 : owns.record && owns.style ? 1 : 0;
  return { depth, owns: Object.keys(owns).filter((k) => owns[k]), borrows };
}

const PART = { record: 'record', style: 'style card', assets: 'assets', layout: 'layout' };
const list = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

/** The entry's DEPTH line: "2 of 3: its own record, style card and assets; layout from lindos". */
export function depthText(id) {
  const d = cultureDepth(id);
  if (!d) return '';
  const own = d.owns.map((k) => PART[k]);
  const from = {};
  for (const [part, o] of Object.entries(d.borrows)) (from[o] ||= []).push(PART[part]);
  const borrowed = Object.entries(from).map(([o, parts]) => `${list(parts)} from ${o}`);
  return `${d.depth} of 3: ${own.length ? `its own ${list(own)}` : 'its card only'}${borrowed.length ? `; ${borrowed.join('; ')}` : ''}`;
}
