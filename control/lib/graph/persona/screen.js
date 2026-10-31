/**
 * screen — a persona ON A SCREEN in a world: the first host (rung 1), the news broadcast. A world's `broadcasts` key
 * stands screens in it, each playing one of a persona's reads on the read's own clock, looped: the set, the channel's
 * bug, the lower third (the reader's name and its strap), the captions, and the reader drawn as the body's register
 * plays them (a silhouette that nods, points and bows on the read's gestures, its mouth on the read's words).
 *
 * The page draws no talking face yet: the face is the GLB's and the engines' (`face:<read>`, bundle.js). The screen
 * records what the game would draw (`fidelity`, fidelity.js: 'face' in a gen-7 world with the realistic hero) so a
 * host that draws faces knows which screens get one.
 *
 *   BROADCASTS: [{ persona: <ref>, read: <id>, at: [x, y, z], yaw?: degrees (0 faces −y), size?: [w, h] (m),
 *                  title?: the channel's words, strap?: the line under the reader's name, package?: a broadcast
 *                  package (broadcast/broadcast-package.js: network | stadium | arcade | table), loop?: true, gap?: s }]
 *   broadcastErrors(list) → error lines (shape only; the refs are the resolver's)
 *   broadcastScreens(list, { era, lookup }) → the page's screens (scene/channels/broadcast-screen.js)
 *
 * Pure: `lookup(ref)` is the store's.
 */
import { personaReads } from './persona.js';
import { captionCues } from './captions.js';
import { speakerFidelity } from './fidelity.js';
import { BROADCAST_PACKAGES } from '../broadcast/broadcast-package.js';

/** a screen's default size (m): a wall television */
export const SCREEN_SIZE = Object.freeze([1.6, 0.9]);
/** the accent each package's metal reads as on a screen's plates */
const ACCENT = Object.freeze({ gold: '#d4a73a', brass: '#b5893b', chrome: '#c8ced8' });
const KEYS = ['persona', 'read', 'at', 'yaw', 'size', 'title', 'strap', 'package', 'loop', 'gap'];
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const vec = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
const r3 = (v) => Math.round(v * 1000) / 1000;

export function broadcastErrors(list) {
  if (!Array.isArray(list) || !list.length) return ['broadcasts: [{ persona, read, at: [x, y, z], yaw?, size?, title?, strap?, package?, loop?, gap? }]'];
  const errs = [];
  list.forEach((b, i) => {
    const at = `broadcasts[${i}]`;
    if (!isPlain(b)) { errs.push(`${at}: { persona, read, at, … }`); return; }
    const extra = Object.keys(b).filter((k) => !KEYS.includes(k));
    if (extra.length) errs.push(`${at}: a screen takes ${KEYS.join(', ')} (not ${extra.join(', ')})`);
    if (typeof b.persona !== 'string' || !b.persona) errs.push(`${at}.persona: a persona's ref (create_character { as: 'persona' })`);
    if (typeof b.read !== 'string' || !b.read) errs.push(`${at}.read: the id of one of its reads`);
    if (!vec(b.at, 3)) errs.push(`${at}.at: [x, y, z], where the screen's centre stands`);
    if (b.yaw !== undefined && !Number.isFinite(b.yaw)) errs.push(`${at}.yaw: degrees about up (0 faces −y)`);
    if (b.size !== undefined && !(vec(b.size, 2) && b.size.every((v) => v > 0 && v <= 40))) errs.push(`${at}.size: [width, height] in metres, each more than 0 and at most 40`);
    for (const k of ['title', 'strap']) if (b[k] !== undefined && (typeof b[k] !== 'string' || b[k].length > 60)) errs.push(`${at}.${k}: words, at most 60 characters`);
    if (b.package !== undefined && !BROADCAST_PACKAGES[b.package]) errs.push(`${at}.package: one of ${Object.keys(BROADCAST_PACKAGES).join(', ')}`);
    if (b.loop !== undefined && typeof b.loop !== 'boolean') errs.push(`${at}.loop: true (the read again after its gap, the default) or false (once, then held)`);
    if (b.gap !== undefined && !(Number.isFinite(b.gap) && b.gap >= 0 && b.gap <= 60)) errs.push(`${at}.gap: seconds between loops, 0 to 60`);
  });
  return errs;
}

/** The page's screens: each read compiled, its captions cued, its words and gestures on its clock */
export function broadcastScreens(list, { era = null, lookup }) {
  const errs = broadcastErrors(list);
  if (errs.length) throw new Error(errs.join('; '));
  return list.map((b, i) => {
    const row = lookup(b.persona), P = row?.manifest?.kind === 'persona' ? row.manifest.persona : null;
    if (!P) throw new Error(`broadcasts[${i}].persona: '${b.persona}' is ${row ? `a ${row.manifest?.kind ?? 'sketch'}` : 'no sketch'}, not a persona (create_character { as: 'persona' })`);
    if (!P.reads[b.read]) throw new Error(`broadcasts[${i}].read: the persona '${b.persona}' has no read '${b.read}' (it has ${Object.keys(P.reads).join(', ') || 'none'})`);
    const hero = lookup(P.hero)?.manifest;
    if (!hero?.hero) throw new Error(`broadcasts[${i}]: the persona's hero '${P.hero}' is not a stored hero`);
    const R = personaReads({ ...P, reads: { [b.read]: P.reads[b.read] } })[b.read], K = BROADCAST_PACKAGES[b.package ?? 'network'];
    return {
      at: b.at.map(r3), yaw: b.yaw ?? 0, size: b.size ?? [...SCREEN_SIZE], loop: b.loop ?? true, gap: b.gap ?? 2,
      seconds: R.seconds, title: b.title ?? 'NEWS', name: hero.hero.name ?? row.title ?? b.persona, ...(b.strap ? { strap: b.strap } : {}),
      look: { glass: [...K.glass], accent: ACCENT[K.accent] ?? ACCENT.gold, face: K.face, weight: K.weight },
      cues: captionCues(R).map((c) => [c.start, c.end, c.text]),
      words: R.lines.flatMap((L) => L.words.map((w) => [w.t, w.dur, w.emph ? 1 : 0])),
      body: R.body.map((g) => [g.t, g.gesture]),
      fidelity: speakerFidelity({ era }, hero.hero),
    };
  });
}
