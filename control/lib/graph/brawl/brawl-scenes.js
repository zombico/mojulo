/**
 * brawl scenes — A STREET'S SCENES: a few beats played on the street's own page with the fight held, as a game's turn
 * asks (game/turn.js: a level step's `start` and `end` triggers; the play shell stages one by its id). A scene is the
 * map's to say and the game's to call: the street names its scenes, the game says which plays as play starts and
 * which once the outcome is known.
 *
 *   scenes: { <id>: [beat…] }          a street's scenes, by id (a short lower-case name)
 *   a beat, one of:
 *     { title: 'words', sub?: 'words', secs? }        a card across the middle (the street's name, a boss's)
 *     { say: 'words', who?: 'a name', secs? }         a line someone says, in a bar along the foot
 *     { pan: [from, to], secs? }                      the camera travels the belt (m along it), eased
 *     { look: at }                                    the camera cut to a place on the belt, held there
 *     { wait: secs }                                  nothing: a beat's rest
 *   `secs`: how long it stands (a line: by its length when not said); a line or a card is put away by accept too.
 *
 *   SCENE_LIMITS
 *   readScenes(scenes, belt, where)   → the scenes, settled (throws naming the fault)
 *   sceneFrames(beat)                 → how many frames a beat stands
 *   sceneOf(beats)                    → a scene's first state
 *   stepScene(beats, state, pad?)     → the next frame's state; pad { accept?, skip? } (edges): accept puts a line or
 *                                       a card away, skip ends the scene
 *   sceneShows(beats, state)          → { cam: m along the belt | null (the fight's own), title?, sub?, say?, who?,
 *                                         done } what the frame shows
 * A state is { at, f, cam, done }. Pure: frames, no clock; the page steps it sixty times a second.
 */
export const SCENE_LIMITS = Object.freeze({ scenes: 8, beats: 24, words: 160, secs: [0.2, 20], frames: 60 });
const KINDS = ['title', 'say', 'pan', 'look', 'wait'];
const KEYS = { title: ['title', 'sub', 'secs'], say: ['say', 'who', 'secs'], pan: ['pan', 'secs'], look: ['look'], wait: ['wait'] };
const ID = /^[a-z][a-z0-9-]{0,24}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const kindOf = (b) => (isObj(b) ? KINDS.find((k) => b[k] !== undefined) ?? null : null);

export function readScenes(scenes, belt, where = 'scenes') {
  const no = (m) => { throw new Error(`brawl: ${m}`); };
  if (!isObj(scenes)) no(`${where} is { <id>: [beat…] }: a street's scenes by name (a beat: { title } | { say, who? } | { pan: [from, to] } | { look: at } | { wait: secs })`);
  const ids = Object.keys(scenes);
  if (ids.length > SCENE_LIMITS.scenes) no(`${where} holds ${SCENE_LIMITS.scenes} scenes at the most`);
  const [sLo, sHi] = SCENE_LIMITS.secs, out = {};
  for (const id of ids) {
    if (!ID.test(id)) no(`${where}.${id}: a scene's id is a short lower-case name`);
    const beats = scenes[id];
    if (!Array.isArray(beats) || !beats.length || beats.length > SCENE_LIMITS.beats) no(`${where}.${id} is 1 to ${SCENE_LIMITS.beats} beats`);
    out[id] = beats.map((b, i) => {
      const at = `${where}.${id}[${i}]`, kind = kindOf(b);
      if (!kind) no(`${at} is a beat: { title, sub? } | { say, who? } | { pan: [from, to] } | { look: at } | { wait: secs }`);
      for (const k of Object.keys(b)) if (!KEYS[kind].includes(k)) no(`${at}.${k} is not a ${kind} beat's word (${KEYS[kind].join(', ')})`);
      const secs = (v, name) => { if (v !== undefined && !(typeof v === 'number' && v >= sLo && v <= sHi)) no(`${at}.${name} is seconds, ${sLo} to ${sHi}`); };
      const along = (v, name) => { if (!(typeof v === 'number' && v >= 0 && v <= belt.length)) no(`${at}.${name} is metres along the belt, 0 to ${belt.length}`); };
      for (const k of ['title', 'sub', 'say', 'who']) if (b[k] !== undefined && !(isStr(b[k]) && b[k].length <= SCENE_LIMITS.words)) no(`${at}.${k} is words, ${SCENE_LIMITS.words} letters at the most`);
      if (kind === 'pan') { if (!Array.isArray(b.pan) || b.pan.length !== 2) no(`${at}.pan is [from, to], metres along the belt`); along(b.pan[0], 'pan[0]'); along(b.pan[1], 'pan[1]'); }
      if (kind === 'look') along(b.look, 'look');
      if (kind === 'wait') secs(b.wait, 'wait'); else secs(b.secs, 'secs');
      return { ...b };
    });
  }
  return out;
}

/** How many frames a beat stands: its `secs`, else a line by its length (a little under three words a second, never
 * under a breath), a card a couple of seconds, a pan by how far it travels; a cut takes one. */
export function sceneFrames(b) {
  const F = SCENE_LIMITS.frames, kind = kindOf(b);
  if (kind === 'wait') return Math.round(b.wait * F);
  if (kind === 'look') return 1;
  if (b.secs !== undefined) return Math.round(b.secs * F);
  if (kind === 'say') return Math.round(Math.min(7, Math.max(1.8, b.say.trim().split(/\s+/).length * 0.38 + 0.8)) * F);
  if (kind === 'title') return Math.round(2.2 * F);
  return Math.round(Math.min(6, Math.max(1.2, Math.abs(b.pan[1] - b.pan[0]) / 9)) * F);
}

export const sceneOf = () => ({ at: 0, f: 0, cam: null, done: false });

export function stepScene(beats, state, pad = {}) {
  if (state.done) return state;
  if (pad.skip) return { ...state, at: beats.length, f: 0, done: true };
  let { at, f, cam } = state;
  const b = beats[at], kind = kindOf(b), n = sceneFrames(b);
  // (the camera's place this frame: along a pan eased in and out, at a cut where it says)
  if (kind === 'pan') { const u = Math.min(1, (f + 1) / n), e = u * u * (3 - 2 * u); cam = b.pan[0] + (b.pan[1] - b.pan[0]) * e; }
  if (kind === 'look') cam = b.look;
  f += 1;
  // (accept puts a line or a card away, once it has stood long enough to be seen)
  if (f >= n || (pad.accept && (kind === 'say' || kind === 'title') && f > 12)) { at += 1; f = 0; }
  return { at, f, cam, done: at >= beats.length };
}

export function sceneShows(beats, state) {
  if (state.done || !beats[state.at]) return { cam: state.cam, done: true };
  const b = beats[state.at], kind = kindOf(b);
  return { cam: state.cam, done: false, ...(kind === 'title' ? { title: b.title, ...(b.sub ? { sub: b.sub } : {}) } : {}), ...(kind === 'say' ? { say: b.say, ...(b.who ? { who: b.who } : {}) } : {}) };
}
