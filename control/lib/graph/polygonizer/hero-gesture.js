/**
 * hero-gesture — the hero's GESTURE: the stand the figure holds, said in the pose words the rig already honours
 * (figure-posing.js `resolvePose` through station-loft-rig.js `rigNodesAt`), carried as a ONE-KEY CLIP named `gesture`
 * listed first in the plan's clips.
 *
 *   • the clip IS the stand: on a hero, the World resolver skins the static solid at it (bindLayered → rigNodesAt →
 *     boneFrames → skinLayered) and bakes the light on the posed mesh (the head's parts in their own frame:
 *     rigidParts); the page opens on that solid; the mint's rig gates (every clip's keyposes solvable, planted toes
 *     held) check it; an engine export carries it as a 1-key clip.
 *   • a gesture is a WORD (GESTURE_PRESETS, or `rest`: no stand, the bind pose), an OBJECT of pose words
 *     (GESTURE_KEYS), or a LIST of either resolved left → right (a later entry's keys win; `spine`, `neck`, `head` and
 *     the raw swivels merge one level deep), so `['relaxed', { head: { pitch: -12 } }]` is the relaxed stand, chin down.
 *   • the door's CLIPS (`hero.clips`, withHeroClips): the operator's motion in the same words —
 *     `{ <name>: [keys] | false }`, each key an object of the stand's pose words plus the clip words (CLIP_KEYS: a
 *     direction for the head and neck, the heel and lift channels, `support: 'none'`, the jaw on a head that has one),
 *     merged over the form's own clips when the plan is generated (a name it has replaced in place, a new one after,
 *     `false` removing one); `gesture` stays the stand's. On the anime head a clip may be `{ seconds, keys }` (its
 *     designed duration) and a key may carry `face` (an expression word, `{ blink, smile, open, brow }` or a list, as
 *     `hero.expression` reads): the plan never sees it (the rig does not read it); the export draws it
 *     (heroClipFaces, anime-face-tracks.js).
 *   • CLIP TIMING (heroClipSeconds, the anime hero only): every clip a designed duration the World page's clip preview,
 *     the GLB and the Godot pack all play — the door clip's own `seconds`, else the hero's own clip's
 *     (ANIME_CLIP_SECONDS), else half a second a key. Every other hero's clips play one second in an export and three
 *     on the World page.
 *   • the presets are per CAST (each body carries its arms and free leg differently): the rig has no arm IK and no
 *     foot targets, so each placed hand and free foot is a set of raw channel values found offline by a deterministic
 *     search over the rig's own channels (the free sole on the floor, the hand at its target, the hand and forearm
 *     clear of the torso and the thighs), stored here as data.
 *   • the gesture owns the head's pitch: the head bone nods the chin down (the anime face's own carriage floors at a
 *     level head), so chin-down is a gesture word, not a face control.
 *
 * gestureClearance measures the posed hand and forearm against the torso, the bust and the thighs (ray parity on the
 * posed triangles, depth = the distance to the nearest one), the check a placed hand needs and the readout reports.
 * Pure and deterministic: tables and functions of the mesh, the recipe and the pose alone.
 */
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered, layeredClip } from './station-loft-rig.js';
import { validateAnimeExpression, resolveAnimeExpression } from './anime-head.js';
import { SWING_WORDS, isSwing } from './hero-swing.js';

const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };
const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = Number.isFinite;

/** The clip name the stand rides under (listed first; the World resolver poses the static solid at its key). */
export const GESTURE_CLIP = 'gesture';
/** The anime hero's default gesture: a PLAN-TIME default (heroGesture), never stored, so a `/hero/head` switch takes it
 * on or drops it with the head, as the character light's read-time default does. */
export const ANIME_GESTURE = 'relaxed';
/** The gesture a hero record stands in: its own (`rest` is the one opt-out: no stand), else the anime head's default. */
export const heroGesture = (hero) => hero?.gesture ?? (hero?.head === 'anime' ? ANIME_GESTURE : undefined);

/** the relaxed stand's body (every cast): weight on the left leg, the hips turned toward the free leg and the chest
 * counter-turned, the shoulder line dropping to the support side, the head tilted toward the high shoulder, chin down */
const RELAXED_BODY = { support: 'L', spine: { sideBend: ['left', 0.35], twist: ['right', 0.35] }, pelvis: 8, shoulders: -6, neck: { yaw: 8 }, head: { yaw: 10, pitch: -6 } };
/** the relaxed stand on one cast: the free right leg `[yaw, pitch, roll]` + knee, and each arm's yaw — the far (left)
 * arm hanging, straight and a little back; the near (right, the three-quarter camera's side) arm curved, the elbow
 * bent 45° with the forearm carried forward, so one arm reads straight and one bent at game size */
const relaxed = ([y, p, r], knee, yawL, yawR) => ({ ...RELAXED_BODY, hipR: { yaw: y, pitch: p, roll: r }, kneeR: knee, shL: { yaw: yawL, pitch: -8, roll: 0 }, elbowL: 12, shR: { yaw: yawR, pitch: 12, roll: 0 }, elbowR: 45 });

/**
 * The preset stands, per cast body. Frame: +x is the figure's RIGHT, +y front, +z up; `shX` / `hipX` are the raw
 * swivels `{ yaw, pitch, roll }` in degrees, hinges in degrees. The free leg (the one `support` does not plant) is
 * placed so its sole rests on the floor, its toe a little forward and out; each arm takes the most inward yaw whose
 * hand and forearm clear the torso and the thighs — the hanging left arm by 2 cm, the bent right arm by 5 cm (about
 * 8 px at 256 px, the size the stand must read at).
 *   relaxed      RELAXED_BODY on the free knee, the left arm hanging, the right curved (no hand rests on anything):
 *                one entry per hero cast and per figure cast, so the default stand of every cast word is clear of the
 *                body at its baseline.
 *   hand-on-hip  the mirror stance (weight on the right), the right hand at the side of the waist with the elbow out
 *                and back, the mitten lying forward over the hip bone (the rig has no wrist); the left arm hangs.
 *   guard        a ready stance: soft knees (crouch), bladed with the left side leading, the rear right foot back and out
 *                on its toe with the heel up, its knee over the line from its hip to its foot seen from the front (neither
 *                knock-kneed nor bowed), chin down, the fists up and apart — the lead fist forward before the left of the
 *                chin, the rear fist under the right jaw — so the two forearms read as two with the chest between them.
 * A cast without its own entry wears the male values (the readout measures what they do on that body).
 */
export const GESTURE_PRESETS = deepFreeze({
  relaxed: {
    female: relaxed([7.3, 5, -20], 15, 7, -1), male: relaxed([6.9, 7, -14], 20, 0, 3),
    canonical: relaxed([-4, 10, 8.9], 25, 3, 1), heroic: relaxed([-4.5, 5.8, 13], 20, -1, 6), brute: relaxed([3.8, 10, -20], 25, -3, 10),
    lithe: relaxed([-4.5, 7, 13.5], 20, 4, -1), stout: relaxed([-4.5, 15, 6.6], 25, 3, 0), child: relaxed([-8.9, 10, 30], 25, 5, -9), chibi: relaxed([4.9, 15, 20], 25, 14, -24),
  },
  'hand-on-hip': {
    female: { support: 'R', spine: { sideBend: ['right', 0.25], twist: ['left', 0.3] }, pelvis: -8, shoulders: 6, neck: { yaw: -8 }, head: { yaw: -10, pitch: -6 },
      hipL: { yaw: -7.2, pitch: 5, roll: 20 }, kneeL: 15, shL: { yaw: -10, pitch: -4, roll: 0 }, elbowL: 14, shR: { yaw: -33.2, pitch: -33.2, roll: -57.8 }, elbowR: 113.5 },
    male: { support: 'R', spine: { sideBend: ['right', 0.25], twist: ['left', 0.3] }, pelvis: -8, shoulders: 6, neck: { yaw: -8 }, head: { yaw: -10, pitch: -6 },
      hipL: { yaw: -6.9, pitch: 7, roll: 14 }, kneeL: 20, shL: { yaw: -13, pitch: -4, roll: 0 }, elbowL: 14, shR: { yaw: -20.5, pitch: -40, roll: -46.2 }, elbowR: 110 },
  },
  guard: {
    female: { support: 'L', crouch: 0.2, pelvis: -12, spine: { twist: ['right', 0.3], curl: 0.1 }, hinge: 4, head: { pitch: -10 },
      hipR: { yaw: -0.7, pitch: 10, roll: -5 }, kneeR: 50, shL: { yaw: -12, pitch: 38.8, roll: 10.6 }, elbowL: 122.5, shR: { yaw: 11.8, pitch: 28, roll: -7.2 }, elbowR: 143.3 },
    male: { support: 'L', crouch: 0.2, pelvis: -12, spine: { twist: ['right', 0.3], curl: 0.1 }, hinge: 4, head: { pitch: -10 },
      hipR: { yaw: -4.1, pitch: 15, roll: 0 }, kneeR: 55, shL: { yaw: -12.5, pitch: 38.8, roll: 18.8 }, elbowL: 123.8, shR: { yaw: 12.8, pitch: 29.5, roll: -17.5 }, elbowR: 140 },
  },
});
export const GESTURE_WORDS = ['rest', ...Object.keys(GESTURE_PRESETS)];

// ─── the pose words a gesture may use ──────────────────────────────────────
const DIR_WORDS = ['up', 'down', 'forward', 'back', 'left', 'right', 'outward', 'inward'];
const BEND_WORDS = ['straight', 'slight', 'half', 'bent', 'full'];
const SPINE_WORDS = { curl: 'amount', arch: 'amount', lean: ['forward', 'back'], sideBend: ['left', 'right'], twist: ['left', 'right'] };
/** Every key a gesture object takes: the vajra core's words and raw swivels, and the rig's stance channels. */
export const GESTURE_KEYS = ['support', 'crouch', 'spine', 'pelvis', 'hinge', 'shoulders', 'neck', 'head', 'armL', 'armR', 'legL', 'legR', 'shL', 'shR', 'hipL', 'hipR', 'elbowL', 'elbowR', 'kneeL', 'kneeR'];
/** Every word a door clip's key takes: the stand's, the rig's heel and lift channels, and the jaw chain on a head that
 * has one. */
export const CLIP_KEYS = [...GESTURE_KEYS, 'heelL', 'heelR', 'lift', 'jaw'];
/** Words the pose language knows that move nothing on this rig (said by name when refused). */
const INERT = { wristL: 'the hand is rigid on the forearm (no wrist)', wristR: 'the hand is rigid on the forearm (no wrist)', fingersL: 'the hand has no fingers', fingersR: 'the hand has no fingers', weight: 'the rig has no sideways root shift', twist: "the spine's twist is spine.twist", lift: 'a gesture stands on the floor' };
const DEEP = new Set(['spine', 'neck', 'head', 'shL', 'shR', 'hipL', 'hipR']);

function directionErrors(v, label) {
  const one = (d) => (typeof d === 'string' ? DIR_WORDS.includes(d) : isObj(d) && ['x', 'y', 'z'].every((k) => d[k] === undefined || fin(d[k])) && ['x', 'y', 'z'].some((k) => fin(d[k]) && d[k] !== 0));
  const ok = Array.isArray(v) ? v.length > 0 && v.every((d) => typeof d === 'string' && DIR_WORDS.includes(d)) : one(v);
  return ok ? [] : [`${label}: a direction to aim the limb — ${DIR_WORDS.join(' / ')}, a list of them, or { x, y, z }`];
}
/** the ranges a gesture's numbers must sit in (degrees, or an amount 0 … 1), and a door clip's heel (degrees), lift
 * (metres, 0 … 1) and jaw (degrees, the jawOpen dial's 0 … 25): wide enough for any pose the rig solves, narrow enough
 * that a stray number (a 720° swivel, a curl of 1e6) is refused by name instead of minting a wild pose */
const RANGE = { girdle: 45, hinge: [-30, 90], look: 90, swivel: 180, heel: 90, lift: [0, 1], jaw: [0, 25] };
const inRange = (x, [lo, hi]) => fin(x) && x >= lo && x <= hi;
const anglesErrors = (v, label, keys, lim) => (isObj(v) && Object.keys(v).length && Object.entries(v).every(([k, x]) => keys.includes(k) && inRange(x, [-lim, lim])) ? [] : [`${label}: { ${keys.join(', ')} } in degrees, each within ±${lim}`]);

/** Error strings for one gesture object (empty = valid) — or, with `clip` ({ jaw, face, expression }), one KEY of a door
 * clip, which takes the clip words besides (CLIP_KEYS), and on the anime head (`face`) the key's facial track: `face`,
 * read as `hero.expression` reads (a word, the channels or a list); elsewhere refused, pointing at /hero/expression only
 * on a head that takes one (`expression`). Form only; solvability is the rig's (the mint gate). */
function gestureObjectErrors(g, label, clip = null) {
  const errs = [], KEYS = clip ? CLIP_KEYS : GESTURE_KEYS, noun = clip ? 'clip' : 'gesture';
  for (const [k, v] of Object.entries(g)) {
    const at = `${label}.${k}`;
    if (clip && k === 'face') { errs.push(...(clip.face ? validateAnimeExpression(v, at) : [`${at}: a facial track is the anime head's (head: 'anime')${clip.expression ? "; this head's face is /hero/expression" : ''}`])); continue; }
    if (!KEYS.includes(k)) { errs.push(`${at}: ${INERT[k] ? `${INERT[k]}, so the ${noun} refuses it` : `not a ${noun} word`} (have ${KEYS.join(', ')})`); continue; }
    if (k === 'support') { const S = clip ? ['both', 'L', 'R', 'none'] : ['both', 'L', 'R']; if (!S.includes(v)) errs.push(`${at}: ${S.map((s) => `'${s}'`).join(' | ')} (the planted foot or feet${clip ? '; none: both free' : ''})`); }
    else if (k === 'crouch') { if (!(fin(v) && v >= 0 && v <= 1)) errs.push(`${at}: 0 (standing) … 1 (a deep squat)`); }
    else if (k === 'pelvis' || k === 'shoulders') { if (!inRange(v, [-RANGE.girdle, RANGE.girdle])) errs.push(`${at}: degrees, within ±${RANGE.girdle} (the girdle's turn)`); }
    else if (k === 'hinge') { if (!inRange(v, RANGE.hinge)) errs.push(`${at}: degrees, ${RANGE.hinge[0]} … ${RANGE.hinge[1]} (the trunk hinging over the hips)`); }
    else if (k === 'spine') {
      if (!isObj(v)) { errs.push(`${at}: { ${Object.keys(SPINE_WORDS).join(', ')} }`); continue; }
      for (const [s, x] of Object.entries(v)) {
        const want = SPINE_WORDS[s];
        if (!want) errs.push(`${at}.${s}: not a spine word (have ${Object.keys(SPINE_WORDS).join(', ')})`);
        else if (want === 'amount') { if (!inRange(x, [0, 1])) errs.push(`${at}.${s}: an amount (0 … 1)`); }
        else if (!(Array.isArray(x) && x.length === 2 && want.includes(x[0]) && inRange(x[1], [0, 1]))) errs.push(`${at}.${s}: [${want.map((w) => `'${w}'`).join(' | ')}, amount 0 … 1]`);
      }
    } else if (k === 'neck' || k === 'head') {
      // a clip's head and neck may AIM (a direction, as the hero's own `wave` does) as well as turn by angles
      if (!clip) errs.push(...anglesErrors(v, at, ['yaw', 'pitch'], RANGE.look));
      else if ((isObj(v) && ['yaw', 'pitch', 'roll'].some((a) => a in v) ? anglesErrors(v, at, ['yaw', 'pitch'], RANGE.look) : directionErrors(v, at)).length) errs.push(`${at}: { yaw, pitch } in degrees${isObj(v) && 'roll' in v ? ' (no roll)' : ''}, each within ±${RANGE.look}, or a direction to aim (${DIR_WORDS.join(' / ')}, a list of them, or { x, y, z })`);
    }
    else if (/^(arm|leg)[LR]$/.test(k)) errs.push(...directionErrors(v, at));
    else if (/^(sh|hip)[LR]$/.test(k)) errs.push(...anglesErrors(v, at, ['yaw', 'pitch', 'roll'], RANGE.swivel));
    else if (k === 'heelL' || k === 'heelR') { if (!inRange(v, [-RANGE.heel, RANGE.heel])) errs.push(`${at}: degrees the metatarsus turns about the toe base, within ±${RANGE.heel}`); }
    else if (k === 'lift') { if (!inRange(v, RANGE.lift)) errs.push(`${at}: metres the root rises off the floor, ${RANGE.lift[0]} … ${RANGE.lift[1]} (both feet free)`); }
    else if (k === 'jaw') { if (!clip.jaw) errs.push(`${at}: this head has no jaw bone (the landmark head has one; the anime head's mouth is /hero/expression), so the clip refuses it`); else if (!inRange(v, RANGE.jaw)) errs.push(`${at}: degrees the jaw opens, ${RANGE.jaw[0]} … ${RANGE.jaw[1]} (the jawOpen dial's range)`); }
    else if (!(BEND_WORDS.includes(v) || (fin(v) && v >= 0 && v <= 150))) errs.push(`${at}: a bend word (${BEND_WORDS.join(', ')}) or degrees 0 … 150`);
  }
  return errs;
}

/** Error strings for a hero `gesture` (empty = valid): a word, an object of pose words, or a list of either. */
export function validateGesture(gesture, label = 'gesture') {
  if (gesture === undefined || gesture === null) return [];
  if (isSwing(gesture)) return [];   // a swing word (hero-swing.js): the stand is its ready key, the swing its clip
  const items = Array.isArray(gesture) ? gesture : [gesture];
  if (!items.length) return [`${label}: a gesture word (${GESTURE_WORDS.join(', ')}), an object of pose words, or a list of them`];
  const errs = [];
  items.forEach((it, i) => {
    const at = Array.isArray(gesture) ? `${label}[${i}]` : label;
    if (typeof it === 'string') { if (isSwing(it)) errs.push(`${at}: a swing word ('${it}') stands alone, not in a list`); else if (!GESTURE_WORDS.includes(it)) errs.push(`${at}: unknown gesture word '${it}' (${GESTURE_WORDS.join(', ')}; a swing: ${SWING_WORDS.join(', ')}; or an object of pose words: ${GESTURE_KEYS.join(', ')})`); }
    else if (isObj(it)) errs.push(...gestureObjectErrors(it, at));
    else errs.push(`${at}: a gesture word (${GESTURE_WORDS.join(', ')}) or an object of pose words`);
  });
  return errs;
}

/** A door clip's name: a word (it names the GLB animation `<figure>:<name>`, the page's ?clip= and a patch path). */
const CLIP_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
/** a designed duration's range (seconds): a quarter second (a snap) to a minute (a long idle) */
const CLIP_SECONDS = [0.25, 60];
/** Error strings for a hero's `clips` (empty = valid): `{ <name>: [keys] | { seconds, keys } | false }`, each key an
 * object of pose words (CLIP_KEYS; `jaw` only when the head has a jaw bone); on the anime head (`face`) a key may carry
 * `face` and a clip its `seconds`, elsewhere both refuse by name (`expression`: the head takes /hero/expression, which the
 * refusal points at). `gesture` is the stand's and refuses here. Another head's refusals read as before the anime forms:
 * an object that names neither `keys` nor `seconds` is refused as a list. */
export function validateHeroClips(clips, { jaw = false, face = false, expression = false } = {}, label = 'clips') {
  if (clips === undefined || clips === null) return [];
  if (!isObj(clips)) return [`${label}: { <name>: [keys]${face ? ' | { seconds, keys }' : ''} | false } — each key an object of pose words (${CLIP_KEYS.join(', ')})`];
  const errs = [];
  const keyErrors = (keys, at, name, form) => {
    if (!Array.isArray(keys) || !keys.length) return [form ? `${at}: a list of keys, each an object of pose words` : `${at}: a list of keys, each an object of pose words — or false to remove the hero's own clip of that name (remove /hero/clips/${name} drops a door clip)`];
    return keys.flatMap((k, i) => (isObj(k) ? gestureObjectErrors(k, `${at}[${i}]`, { jaw, face, expression }) : [`${at}[${i}]: a key is an object of pose words (${CLIP_KEYS.join(', ')})`]));
  };
  for (const [name, keys] of Object.entries(clips)) {
    const at = `${label}.${name}`;
    if (name === GESTURE_CLIP) errs.push(`${at}: the stand's clip — set /hero/gesture (${Object.keys(GESTURE_PRESETS).join(', ')}, pose words or a list; 'rest' for none); a door clip cannot replace or remove it`);
    else if (!CLIP_NAME_RE.test(name)) errs.push(`${at}: a clip name is a word of up to 32 letters, digits, '_' or '-', starting with a letter`);
    else if (keys === false) continue;
    else if (isObj(keys) && (face || 'keys' in keys || 'seconds' in keys)) {
      // the clip with its designed duration: `{ seconds, keys }` (the anime hero's; `{ keys }` alone is the list)
      for (const k of Object.keys(keys)) if (k !== 'seconds' && k !== 'keys') errs.push(`${at}.${k}: a clip is [keys] or { seconds, keys }`);
      if (keys.seconds !== undefined) {
        if (!face) errs.push(`${at}.seconds: a designed duration is the anime hero's (head: 'anime'); this hero's clips play one second in an export and three on the World page`);
        else if (!inRange(keys.seconds, CLIP_SECONDS)) errs.push(`${at}.seconds: the clip's length in seconds, ${CLIP_SECONDS[0]} … ${CLIP_SECONDS[1]}`);
      }
      errs.push(...keyErrors(keys.keys, `${at}.keys`, name, true));
    } else errs.push(...keyErrors(keys, at, name, false));
  }
  return errs;
}

/** The preset entry a cast wears: its own when the preset has one (a cast word), else the male. */
const castEntry = (preset, cast) => (typeof cast === 'string' && Object.hasOwn(preset, cast) ? preset[cast] : preset.male);

/** A gesture → the stand's pose words for `cast`, or null (`rest`, or nothing given). A list resolves left → right:
 * a later entry's keys win, the nested words (spine, neck, head, the raw swivels) merge one level deep. */
export function resolveGesture(gesture, cast) {
  if (gesture === undefined || gesture === null) return null;
  let pose = null;
  for (const it of Array.isArray(gesture) ? gesture : [gesture]) {
    if (it === 'rest') { pose = null; continue; }
    const add = typeof it === 'string' ? castEntry(GESTURE_PRESETS[it], cast) : it;
    pose = pose || {};
    for (const [k, v] of Object.entries(add)) pose[k] = DEEP.has(k) && isObj(v) && isObj(pose[k]) ? { ...pose[k], ...v } : v;
  }
  return pose && Object.keys(pose).length ? clone(pose) : null;
}

/** A plan with the stand added as the FIRST clip (`gesture: [pose]`); the plan untouched when there is none. */
export function withGestureClip(plan, pose) {
  if (!pose || !plan?.rig) return plan;
  const { [GESTURE_CLIP]: _old, ...rest } = plan.clips || {};
  return { ...plan, clips: { [GESTURE_CLIP]: [pose], ...rest } };
}

/** a door clip's keys: the list, or the `keys` of `{ seconds, keys }` */
const doorKeys = (clip) => (Array.isArray(clip) ? clip : clip?.keys);
/** a door key as the rig reads it: its pose words, without its facial track */
const poseOf = (k) => { if (!isObj(k) || !('face' in k)) return k; const { face: _f, ...pose } = k; return pose; };
/** A plan with the door's CLIPS (hero.clips) merged over its own: a name it has replaced in place, a new one after it,
 * `false` removing one of its own (refused, naming them, when it has none of that name); the plan untouched when there
 * are none. A `{ seconds, keys }` clip merges its keys; a key's `face` stays with the record (the rig never reads it; the
 * export draws it). The stand is added after (withGestureClip). */
export function withHeroClips(plan, clips) {
  if (!clips || !plan?.rig || !Object.keys(clips).length) return plan;
  const out = { ...(plan.clips || {}) };
  for (const [name, clip] of Object.entries(clips)) {
    if (clip !== false) { out[name] = clone(doorKeys(clip).map(poseOf)); continue; }
    if (!Object.hasOwn(out, name)) throw new Error(`clips.${name}: false removes one of the hero's own clips (${Object.keys(plan.clips || {}).join(', ')}); it has no '${name}'`);
    delete out[name];
  }
  return { ...plan, clips: out };
}

/**
 * The anime hero's own clips' DESIGNED DURATIONS (seconds a cycle), timed as an animator times them: the stand's one key
 * holds (a second, played as a hold); a breathing idle takes one breath in four seconds (about 15 breaths a minute at
 * rest); a walk cycle is two steps, and 120 steps a minute puts the cycle at a second; the wave (hero-form.js ANIME_WAVE)
 * raises the hand, strokes out and back twice and lowers it, a third of a second a key.
 */
export const ANIME_CLIP_SECONDS = Object.freeze({ gesture: 1, idle: 4, walk: 1, wave: 2 });
/** Every clip's designed duration on the ANIME hero (null on any other: its clips play one second in an export and three
 * on the World page): `{ <name>: seconds }` over the recipe's clips — the door clip's own `seconds`, else the hero's own
 * clip's (ANIME_CLIP_SECONDS), else half a second a key (a second at least). */
export function heroClipSeconds(hero, clips) {
  if (hero?.head !== 'anime' || !clips) return null;
  return Object.fromEntries(Object.entries(clips).map(([name, keys]) => {
    const door = hero.clips && Object.hasOwn(hero.clips, name) ? hero.clips[name] : null;
    return [name, isObj(door) && fin(door.seconds) ? door.seconds : Object.hasOwn(ANIME_CLIP_SECONDS, name) ? ANIME_CLIP_SECONDS[name] : Math.max(1, 0.5 * keys.length)];
  }));
}
/** Every clip's FACIAL TRACK as the door gave it: `{ <name>: [channels | null per key] }` over the recipe's clips — a door
 * key's `face` resolved as `hero.expression` is (anime-head resolveAnimeExpression: `{ blink, smile, open, brow }`),
 * null where a key carries none (the authored face holds) and for every key of the hero's own clips. */
export function heroClipFaces(hero, clips) {
  return Object.fromEntries(Object.entries(clips || {}).map(([name, keys]) => {
    const door = hero?.clips && Object.hasOwn(hero.clips, name) ? doorKeys(hero.clips[name]) : null;
    return [name, keys.map((_, i) => { const f = door?.[i]?.face; return f === undefined || f === null ? null : resolveAnimeExpression(f); })];
  }));
}

/** The word a gesture reads as in the readout: the word, the words of a list joined by '+', 'data' for an object. */
export const gestureWord = (g) => (g === undefined || g === null ? null : (Array.isArray(g) ? g : [g]).map((x) => (typeof x === 'string' ? x : 'data')).join('+'));

// ─── the stand on a compiled mesh ──────────────────────────────────────────
/** The stand a rigged recipe holds: its `gesture` clip's key, resolved as the clip preview resolves it; else null. The
 * caller keys it on a HERO (the World resolver: a hero-door row); a plan's own clip of that name is just a clip. */
export function standPose(recipe, R) {
  const keys = recipe?.rig && recipe.clips?.[GESTURE_CLIP];
  if (!Array.isArray(keys) || !keys.length) return null;
  return layeredClip(keys, R)(0);
}

/**
 * The parts riding one bone RIGIDLY (every vertex wholly bound to it) — for `head`, the face, the cranium, the ears, the
 * hair, the eyes, the brows and lashes. The stand lights them in their own frame (station-loft-shade.js
 * layeredShadingNormals `rigid`), so a turned or nodded head keeps the shadow shapes it has at rest, as the rig pack
 * carries them. A Set in mesh order; empty when the rig has no such bone.
 */
export function rigidParts(mesh, skin, R, bone = 'head') {
  const bi = R.bones.findIndex((b) => b.id === bone); const on = new Set(), off = new Set(); if (bi < 0) return on;
  mesh.provenance.forEach((p, vi) => { const J = skin.joints[vi], W = skin.weights[vi]; let w = 0; for (let k = 0; k < 4; k++) if (J[k] === bi) w += W[k]; (w >= 1 - 1e-9 ? on : off).add(p.part); });
  for (const p of off) on.delete(p);
  return on;
}

/**
 * A compiled layered mesh skinned at `pose` (bindLayered → rigNodesAt → boneFrames → skinLayered): the same mesh,
 * same topology, its vertices posed. `rig` reuses an already validated rig and binding `{ R, skin }`.
 */
export function poseLayered(mesh, recipe, pose, { R = validateRig(recipe.rig), skin = bindLayered(mesh, recipe, R) } = {}) {
  const { nodes, report } = rigNodesAt(R, pose);
  return { mesh: { ...mesh, vertices: skinLayered(mesh, skin, boneFrames(R, R.joints, nodes)) }, nodes, report };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const RAY = [0.8726, 0.3313, 0.3589];   // a skewed parity ray (no axis-aligned degeneracies; station-loft-head insidePart's)
function inside(tris, q) {
  let c = 0;
  for (const [A, B, C] of tris) {
    const e1 = sub(B, A), e2 = sub(C, A); const p = cross(RAY, e2); const det = dot(e1, p); if (Math.abs(det) < 1e-14) continue;
    const tv = sub(q, A); const u = dot(tv, p) / det; if (u < 0 || u > 1) continue; const qq = cross(tv, e1); const v = dot(RAY, qq) / det; if (v < 0 || u + v > 1) continue;
    if (dot(e2, qq) / det > 0) c++;
  }
  return c % 2 === 1;
}
/** distance from p to triangle abc (the closest-point regions) */
function distTri(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a); const d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return len(ap);
  const bp = sub(p, b); const d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return len(bp);
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return len(sub(p, [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v])); }
  const cp = sub(p, c); const d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return len(cp);
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return len(sub(p, [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w])); }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return len(sub(p, [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w])); }
  const den = 1 / (va + vb + vc); const v = vb * den, w = vc * den; return len(sub(p, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]));
}

/** The parts a placed hand must stay out of (the trunk and thighs, and the neck and head a raised fist can reach: the
 * anime head's face shell, the landmark head's jaw, the bare form's head), and the parts that carry the hand. */
export const CLEARANCE_BODY = ['torso', 'bustL', 'bustR', 'thighL', 'thighR', 'neck', 'face', 'cranium', 'jaw', 'head'];
export const CLEARANCE_HANDS = ['handL', 'foreArmL', 'handR', 'foreArmR'];

/**
 * The posed hand and forearm against the torso, the bust and the thighs: per pair `'<hand>→<body>'` that sinks
 * DEEPER than it does at rest (the limb segments already overlap where they join), `{ inside, depthMm, restDepthMm }`
 * — the vertices inside and the deepest one's distance to the body part's surface — and `worstMm` over them (0 when
 * clear). `vertices` is the posed mesh's (poseLayered); the rest is `mesh.vertices`. Parts the mesh lacks are skipped.
 */
export function gestureClearance(mesh, vertices, { hands = CLEARANCE_HANDS, body = CLEARANCE_BODY } = {}) {
  const partOfV = mesh.provenance.map((p) => p.part);
  const vertsOf = new Map(); partOfV.forEach((p, i) => { let a = vertsOf.get(p); if (!a) vertsOf.set(p, a = []); a.push(i); });
  const facesOf = new Map(); mesh.faces.forEach((t, fi) => { const p = partOfV[t[0]]; let a = facesOf.get(p); if (!a) facesOf.set(p, a = []); a.push(fi); });
  const probe = (V, A, B) => {
    const tris = facesOf.get(B).map((fi) => mesh.faces[fi].map((vi) => V[vi]));
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
    let n = 0, depth = 0;
    for (const vi of vertsOf.get(A)) {
      const q = V[vi]; if (q[0] < lo[0] || q[0] > hi[0] || q[1] < lo[1] || q[1] > hi[1] || q[2] < lo[2] || q[2] > hi[2]) continue;
      if (!inside(tris, q)) continue;
      n++; let d = Infinity; for (const [a, b, c] of tris) d = Math.min(d, distTri(q, a, b, c)); if (d > depth) depth = d;
    }
    return { n, depth };
  };
  const pairs = {}; let worst = 0;
  for (const A of hands) {
    if (!vertsOf.has(A)) continue;
    for (const B of body) {
      if (!facesOf.has(B)) continue;
      const now = probe(vertices, A, B); if (!now.n) continue;
      const was = probe(mesh.vertices, A, B);
      if (now.n <= was.n && now.depth <= was.depth + 1e-6) continue;
      const mm = (x) => Math.round(x * 10000) / 10 + 0;   // tenths of a millimetre, never −0
      pairs[`${A}→${B}`] = { inside: now.n, depthMm: mm(now.depth), restDepthMm: mm(was.depth) };
      worst = Math.max(worst, mm(now.depth - was.depth));
    }
  }
  return { pairs, worstMm: worst };
}
