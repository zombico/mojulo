/**
 * THE GUIDE — a sketched map's page saying what the level is and where to go (map-sketch.js: its concept's pitch and its
 * journey): an INTRO (the pitch, shown as the page opens) and the WAY ON, the journey's beats that fall on this page in
 * their order, each a place on the land and a radius it is reached within: an encounter at its mark (reached when its
 * foes about it are down), a find at its loot or secret, a rest or someone met at theirs, the walk's end at the goal's
 * door, a traverse or a climb at the gate on to the walk's next segment (else the segment's middle). The arrival is the
 * intro's. The page draws it (scene/channels/guide.js): the beat in words, a bearing and the metres to it, a pillar of
 * light where it stands. Drafts guide as well as approved segments: directions are not a build.
 *
 *   guideOf(level, G, Z, { seed }) → { intro?, steps: [{ id, say, kind, at: [x, y, z], radius, fight?, downs?, keys? }], held? } | null
 *     G levelGrid's read, Z zoneOf's (null: the whole map); null where the level has no concept or no beat on the page
 *     says   what is said on reaching it: a meet's or a rest's line, a find's 'Found: <item>'
 *     keys   a beat that teaches (its `teach`, map-sketch.js TEACH): the keys of what it teaches, shown while it is the way on
 *     downs  a scenario's fight: the falls on the page that win it (its own foes and every fight's before it), so it is
 *            won where it is fought: its foes may come to the hero (a pursuer) or come later (a beat's `after`)
 *     introKeys  the arrival's keys (its `teach`), shown under the intro as the page opens
 *     lessons    an arrival that teaches SEVERAL (how a game starts: the controls explained with the hero in hand):
 *                [{ keys, fact? }] in place of introKeys, each shown alone until the pilot does it (`fact`: move, look,
 *                jump, sprint, map-sketch.js TEACH) or its patience runs out, before the way on is shown
 *     held   a concept that holds its pages (`hold`): the page's ways out, each [x, y, z] and the word for it, held while a
 *            foe stands on the page (gameworld/levels.js holds the exits; the page says why one does not open)
 * Pure.
 */
import { readSketch, BEAT_PLACE, TEACH } from './map-sketch.js';
import { levelHeight } from '../era/out-tile.js';

export const GUIDE = Object.freeze({ reach: 6, fight: 12, find: 4 });
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
// (the mark each kind of beat stands at, by preference: map-sketch.js's, the climax's goal before its mark)
const MARK_OF = BEAT_PLACE;

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
  let fallen = 0;
  for (const b of C.journey) {
    if (!segs.includes(b.at) || b.kind === 'arrival') continue;
    const own = b.tile ? centre(P.segments[b.at].at[0] + b.tile[0], P.segments[b.at].at[1] + b.tile[1]) : null;
    const at = own ? own : b.kind === 'climax' ? goalIn(b.at) ?? markAt(b.at, ['encounter']) ?? middle(b.at)
      : MARK_OF[b.kind] ? markAt(b.at, MARK_OF[b.kind]) ?? (b.kind === 'climb' ? onward(b.at) : null) ?? middle(b.at)
      : onward(b.at) ?? middle(b.at);
    const fight = b.kind === 'encounter' || (b.kind === 'climax' && (K.segments[b.at]?.marks ?? []).some((m) => m.beat === b.id && m.foes));
    // (what is said on reaching it: a meet's or a rest's line, a find's item; a scenario's beat, by its own mark)
    const item = (K.segments[b.at]?.marks ?? []).find((m) => m.beat === b.id && m.item)?.item;
    const says = b.kind === 'meet' || b.kind === 'rest' ? b.say : item ? `Found: ${item}` : null;
    // (a meet's way on names who is met, its words before a colon; what they say is said on reaching them)
    const way = b.kind === 'meet' && b.say.indexOf(':') > 0 ? b.say.slice(0, b.say.indexOf(':')).trim() : b.say;
    // (a scenario's fight says how many it stands: the page counts its falls, so a fight whose foes come to the hero,
    // or come later, is won where it is fought and not where its mark is. `downs` the falls on the page that win it)
    const n = fight ? (K.segments[b.at]?.marks ?? []).filter((m) => m.beat === b.id && m.foes).reduce((t, m) => t + (m.foes.count ?? 1), 0) : 0;
    if (n) fallen += n;
    steps.push({ id: b.id, say: way, kind: b.kind, at, radius: fight ? GUIDE.fight : b.kind === 'find' || b.kind === 'secret' ? GUIDE.find : GUIDE.reach, ...(fight ? { fight: true } : {}), ...(n ? { downs: fallen } : {}), ...(b.teach?.length ? { keys: b.teach.map((v) => TEACH[v].keys) } : {}), ...(says ? { says } : {}) });
  }
  const first = segs.includes(P.route[0]);
  if (!steps.length && !(first && (C.pitch || C.journey.some((x) => x.kind === 'arrival' && segs.includes(x.at) && x.teach?.length)))) return null;
  // (a held page's ways out, where it fights: each gate's exit; the word the page shows at one while foes stand)
  const fightHere = C.journey.some((b) => segs.includes(b.at) && (b.kind === 'encounter' || b.kind === 'climax'));
  const held = C.hold && Z && fightHere ? Z.ways.map((w) => [r3(w.exit[0]), r3(w.exit[1]), r3(w.exit[2])]) : null;
  // (the arrival's keys, a page holding the walk's start: shown under the intro, before the first beat's)
  const arr = first ? C.journey.find((b) => b.kind === 'arrival' && segs.includes(b.at) && b.teach?.length) : null;
  // (an arrival that teaches several is the game's start: the controls explained one at a time, each until it is done)
  const lessons = arr && arr.teach.length > 1 ? arr.teach.map((v) => ({ keys: TEACH[v].keys, ...(TEACH[v].fact ? { fact: TEACH[v].fact } : {}) })) : null;
  return { ...(first && C.pitch ? { intro: C.pitch } : {}), ...(lessons ? { lessons } : arr ? { introKeys: arr.teach.map((v) => TEACH[v].keys) } : {}), steps, ...(held?.length ? { held } : {}) };
}
