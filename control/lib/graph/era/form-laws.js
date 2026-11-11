/**
 * THE FORM RENDER'S LAWS, MEASURED (era/laws.js, the laws marked `form`): a room kit's card read against the seventh
 * generation's principles, so a kit that claims the form register is held to it and one that does not is told which
 * of its numbers are the sixth generation's. A law here is one a card's numbers can answer; the rest are the page's
 * (a live flame, a bloom) and are checked where the page is made.
 *
 *   FORM_MEASURES   the limits, each beside its law:
 *     built-scale         a wall's course `course` [least, most] m high; a floor's slab at least `slab` m; what stands
 *                         proud of a wall (plinth, cornice, pilaster) at most `proud` m
 *     relief-is-material  the wall, the floor and the trim painted by a generator whose relief the form render reads
 *                         (`dressed`)
 *     value-by-light      a block's tone against its neighbour's at most `vary` (the generator's 0–40)
 *     true-curves         an arch, a vault and a niche's head cut in at least `seg` pieces
 *     dark-is-a-place     the torches at least `torch` m up, the vault's tint no brighter than `vault`
 *     no-voxel-first, pillars-are-worked (craft, both eras)   the torch turned; a pilaster cut in parts, fluted or a shaft
 *     layers-stand-proud  a wall's coat, where it has one, neither whole nor all gone
 *   readFormKit(kit) → { ok, rows: [{ law, what, value, limit, ok }] }
 *
 * Pure: reads a card, draws nothing.
 */
import { generatedSpecOf } from '../landscape/surface-textures.js';

export const FORM_MEASURES = Object.freeze({ course: Object.freeze([0.15, 0.45]), slab: 0.6, proud: 0.2, vary: 12, seg: 12, torch: 3, vault: 0.3 });

const specOf = (t) => (t && t.family ? generatedSpecOf(`${t.family}-a`) : null);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

export function readFormKit(kit) {
  const M = FORM_MEASURES, rows = [], row = (law, what, value, limit, ok) => rows.push({ law, what, value, limit, ok: !!ok });
  const T = kit.tiles || {}, W = specOf(T.wall), F = specOf(T.floor), R = specOf(T.trim);
  const course = W && W.cfg.rows ? (T.wall.scale ?? 2) / W.cfg.rows : null, slab = F && F.cfg.rows ? (T.floor.scale ?? 2) / F.cfg.rows : null;
  row('built-scale', 'a wall\'s course (m)', course, M.course, course !== null && course >= M.course[0] && course <= M.course[1]);
  row('built-scale', 'a floor\'s slab (m)', slab, `>= ${M.slab}`, slab !== null && slab >= M.slab);
  const proud = Math.max(kit.plinth?.out ?? 0, kit.cornice?.out ?? 0, kit.pilaster?.out ?? 0);
  row('built-scale', 'what stands proud of a wall (m)', proud, `<= ${M.proud}`, proud <= M.proud);
  for (const [part, S] of [['wall', W], ['floor', F], ['trim', R]]) row('relief-is-material', `the ${part}'s generator`, S ? S.gen : (T[part] && T[part].key) || null, 'dressed', !!S && S.gen === 'dressed');
  for (const [part, S] of [['wall', W], ['floor', F]]) row('value-by-light', `the ${part}'s tone from block to block`, S ? S.cfg.vary ?? null : null, `<= ${M.vary}`, !!S && Number.isFinite(S.cfg.vary) && S.cfg.vary <= M.vary);
  const segs = [['a doorway\'s head', kit.arch?.door?.seg], ['the vault', kit.arch?.vault?.seg], ['a niche\'s head', kit.dress?.niches ? kit.dress.niches.seg ?? 6 : undefined]];
  for (const [what, seg] of segs) if (seg !== undefined) row('true-curves', `${what} (pieces)`, seg, `>= ${M.seg}`, seg >= M.seg);
  // (craft, in both eras: a fixture turned and a pillar worked; a wall's coat where it has one)
  if (kit.torch) row('no-voxel-first', 'the torch\'s form', kit.torch.form ?? 'boxes', 'turned (cone)', kit.torch.form === 'cone');
  if (kit.pilaster) { const P = specOf(T.pillar), worked = !!kit.pilaster.bands || (!!P && ['fluted', 'shaft'].includes(P.cfg.cut));
    row('pillars-are-worked', 'a pilaster\'s work', [kit.pilaster.bands ? 'cut in parts' : null, P && P.cfg.cut ? P.cfg.cut : null].filter(Boolean).join(', ') || 'a flat strip', 'parts, flutes or a shaft', worked); }
  if (W && W.cfg.cut === 'render') row('layers-stand-proud', 'the wall\'s coat lost (share)', W.cfg.loss ?? null, 'between 0.2 and 0.8', W.cfg.loss >= 0.2 && W.cfg.loss <= 0.8);
  if (kit.dress?.niches) row('wall-rhythm', 'a wall\'s bays', kit.dress.niches.rhythm ? `a rhythm, the second kind ${kit.dress.niches.rhythm.less ?? 1} tier less` : 'every bay alike', 'a rhythm', !!kit.dress.niches.rhythm);
  row('floor-is-laid', 'the floor\'s laying', kit.floorPlan ? 'a border, a walk, fields by the bay' : (kit.dress?.floor ? 'zoned' : 'one field of tile'), 'laid by a plan', !!kit.floorPlan || !!kit.dress?.floor);
  row('wall-has-storeys', 'the wall\'s height', kit.storeys ? `a course at ${kit.storeys.at} of it, an upper register over it` : 'one storey', 'storeys', !!kit.storeys);
  row('air-is-furnished', 'the air above', kit.dress?.above ? Object.keys(kit.dress.above).join(', ') : 'empty', 'something hung, and a light that reaches up', !!kit.dress?.above);
  if (kit.torch) row('dark-is-a-place', 'the torches\' height (m)', kit.torch.z, `>= ${M.torch}`, kit.torch.z >= M.torch);
  if (kit.tint?.ceiling) row('dark-is-a-place', 'the vault\'s tint', Math.round(lum(kit.tint.ceiling) * 1e3) / 1e3, `<= ${M.vault}`, lum(kit.tint.ceiling) <= M.vault);
  return { ok: rows.every((r) => r.ok), rows };
}
