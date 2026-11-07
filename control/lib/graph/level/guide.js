/**
 * THE GUIDE — a sketched map's page saying what the level is and where to go (map-sketch.js: its concept's pitch and its
 * journey): an INTRO (the pitch, shown as the page opens) and the WAY ON, the journey's beats that fall on this page in
 * their order, each a place on the land and a radius it is reached within: an encounter at its mark (reached when its
 * foes about it are down), a find at its loot or secret, a rest or someone met at theirs, the walk's end at the goal's
 * door, a traverse or a climb at the gate on to the walk's next segment (else the segment's middle). The arrival is the
 * intro's. The page draws it (scene/channels/guide.js): the beat in words, a bearing and the metres to it, a pillar of
 * light where it stands. Drafts guide as well as approved segments: directions are not a build.
 *
 *   guideOf(level, G, Z, { seed }) → { intro?, steps: [{ id, say, kind, at: [x, y, z], radius, fight? }] } | null
 *     G levelGrid's read, Z zoneOf's (null: the whole map); null where the level has no concept or no beat on the page
 * Pure.
 */
import { readSketch } from './map-sketch.js';
import { levelHeight } from '../era/out-tile.js';

export const GUIDE = Object.freeze({ reach: 6, fight: 12, find: 4 });
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
// (the mark each kind of beat stands at, by preference)
const MARK_OF = Object.freeze({ encounter: ['encounter'], find: ['loot', 'secret'], secret: ['secret', 'loot'], rest: ['rest'], vista: ['landmark'], puzzle: ['hazard', 'landmark'], climb: ['hazard', 'landmark'] });

export function guideOf(level, G, Z = null, { seed = 1 } = {}) {
  const P = G.plan, K = P && level.sketch ? readSketch(level.sketch, P) : null, C = K?.concept;
  if (!C) return null;
  const segs = Z ? Z.segments ?? [Z.id] : Object.keys(P.segments), T = G.tile, n = P.size;
  const L = { seed, ...(G.rise ? { rise: G.rise } : {}) }, on = (x, y) => [r3(x), r3(y), r3(levelHeight(x, y, L))];
  const centre = (r, c) => on((c + 0.5) * T, -(r + 0.5) * T);
  const markAt = (S, kinds) => { for (const k of kinds) { const m = K.segments[S]?.marks.find((x) => x.kind === k); if (m) { const [r0, c0] = P.segments[S].at; return centre(r0 + m.at[0], c0 + m.at[1]); } } return null; };
  const goalIn = (S) => { const [r0, c0] = P.segments[S].at; const x = G.cells.find((y) => y.kind === 'place' && y.place?.goal && y.r >= r0 && y.r < r0 + n && y.c >= c0 && y.c < c0 + n); return x ? centre(x.r, x.c) : null; };
  // (the gate on to the walk's next segment, where the page has it: its crossing)
  const onward = (S) => { const i = P.route.indexOf(S), next = i >= 0 ? P.route[i + 1] : null, g = next ? P.gates.find((x) => (x.from === S && x.to === next) || (x.to === S && x.from === next)) : null; if (!g) return null; const [tr, tc] = g.from === S ? g.tiles[0] : g.tiles[1], side = g.from === S ? g.side : { n: 's', s: 'n', e: 'w', w: 'e' }[g.side]; return on(...{ n: [(tc + 0.5) * T, -tr * T], s: [(tc + 0.5) * T, -(tr + 1) * T], w: [tc * T, -(tr + 0.5) * T], e: [(tc + 1) * T, -(tr + 0.5) * T] }[side]); };
  const middle = (S) => { const [r0, c0] = P.segments[S].at; return centre(r0 + (n - 1) / 2, c0 + (n - 1) / 2); };
  const steps = [];
  for (const b of C.journey) {
    if (!segs.includes(b.at) || b.kind === 'arrival') continue;
    const at = b.kind === 'climax' ? goalIn(b.at) ?? markAt(b.at, ['encounter']) ?? middle(b.at)
      : MARK_OF[b.kind] ? markAt(b.at, MARK_OF[b.kind]) ?? (b.kind === 'climb' ? onward(b.at) : null) ?? middle(b.at)
      : onward(b.at) ?? middle(b.at);
    const fight = b.kind === 'encounter';
    steps.push({ id: b.id, say: b.say, kind: b.kind, at, radius: fight ? GUIDE.fight : b.kind === 'find' || b.kind === 'secret' ? GUIDE.find : GUIDE.reach, ...(fight ? { fight: true } : {}) });
  }
  const first = segs.includes(P.route[0]);
  if (!steps.length && !(first && C.pitch)) return null;
  return { ...(first && C.pitch ? { intro: C.pitch } : {}), steps };
}
