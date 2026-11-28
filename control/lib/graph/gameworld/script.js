/**
 * THE SCRIPT — a level's spoken lines as data, each with an id, who says it, its words and the moment it is said: the
 * level's own events (a task begun or met, a scan's find, a wave, a body down, the win, the loss), a few seconds after
 * if it says so. Shown as comms on the page (scene/channels/comms.js: the speaker's name and portrait, the words as a
 * subtitle), read whole as the game's script (the script book) by whoever records the voices: every line has an id.
 *
 *   readScript(v, { tasks, at? }) → { speakers, lines } (throws, teaching)
 *     v       { speakers?: { <who>: { name, colour?, portrait? (a still of their face, a small data URI) } }, lines: [{ id, who,
 *             text, on, after? }] }
 *     on      'start' | 'win' | 'lost' | { begin: <task n> } | { done: <task n> } | { found: <task n> } | { wave: <n> } |
 *             { down: <entity id> }   (tasks counted from 1, as the level's objectives number them)
 *     after   seconds after the moment (0 to 30)
 *   scriptSequences(lines) → the bus's sequences (worlds/event-bus.js): each line's moment its trigger, `comms:<id>` raised
 *   SCRIPT                 the numbers: the most lines a level, the longest line, the largest portrait (characters)
 *
 * The moments are the objectives' own events (game/objectives.js: objective:begin / done / found carry the task's id,
 * `t<n>` as a frame operation names them), the cast's `down`, `wave`, `objectives:done`, `dead`. Pure.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const SCRIPT = Object.freeze({ lines: 80, text: 240, after: 30, portrait: 60000 });
const PORTRAIT = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z][a-z0-9-]{0,40}$/;

export function readScript(v, { tasks = 0, at = 'script' } = {}) {
  const fail = (m) => { throw new Error(`${at}${m}`); };
  if (!isObj(v)) fail(' is { speakers?, lines: [{ id, who, text, on, after? }] }: the level\'s spoken lines');
  for (const k of Object.keys(v)) if (!['speakers', 'lines'].includes(k)) fail(`.${k} is not part of a script (speakers, lines)`);
  const speakers = {};
  if (v.speakers !== undefined) {
    if (!isObj(v.speakers)) fail('.speakers is { <who>: { name, colour? } }');
    for (const [w, S] of Object.entries(v.speakers)) {
      if (!ID.test(w)) fail(`.speakers: '${w}' is a speaker's id, lower-case`);
      if (!isObj(S) || typeof S.name !== 'string' || !S.name || S.name.length > 24) fail(`.speakers.${w} is { name, colour?, portrait? }: what the line is shown as said by`);
      if (S.colour !== undefined && !HEX.test(S.colour)) fail(`.speakers.${w}.colour is #rrggbb`);
      // (a PORTRAIT: a still of the speaker's face, a small image carried in the recipe, shown in place of the initials)
      if (S.portrait !== undefined && !(typeof S.portrait === 'string' && PORTRAIT.test(S.portrait) && S.portrait.length <= SCRIPT.portrait)) fail(`.speakers.${w}.portrait is a small still of their face, a data URI (jpeg, png or webp) of at most ${Math.round(SCRIPT.portrait / 1024)} KB`);
      speakers[w] = { name: S.name, ...(S.colour ? { colour: S.colour } : {}), ...(S.portrait ? { portrait: S.portrait } : {}) };
    }
  }
  if (!Array.isArray(v.lines) || !v.lines.length || v.lines.length > SCRIPT.lines) fail(`.lines is 1 to ${SCRIPT.lines} lines`);
  const seen = new Set();
  const lines = v.lines.map((L, i) => {
    const lat = `${at}.lines[${i}]`, no = (m) => { throw new Error(`${lat}${m}`); };
    if (!isObj(L)) no(' is { id, who, text, on, after? }');
    for (const k of Object.keys(L)) if (!['id', 'who', 'text', 'on', 'after'].includes(k)) no(`.${k} is not part of a line (id, who, text, on, after)`);
    if (typeof L.id !== 'string' || !ID.test(L.id) || seen.has(L.id)) no('.id is its own name, lower-case: the voice recorded for it is found by it');
    seen.add(L.id);
    if (typeof L.who !== 'string' || !ID.test(L.who)) no('.who is who says it (a speaker\'s id)');
    if (typeof L.text !== 'string' || !L.text || L.text.length > SCRIPT.text) no(`.text is the words, up to ${SCRIPT.text} letters`);
    if (L.after !== undefined && !(Number.isFinite(L.after) && L.after >= 0 && L.after <= SCRIPT.after)) no(`.after is seconds after its moment, 0 to ${SCRIPT.after}`);
    return { id: L.id, who: L.who, text: L.text, on: readMoment(L.on, tasks, `${lat}.on`), ...(L.after ? { after: L.after } : {}) };
  });
  return { speakers, lines };
}

const MOMENTS = "'start' | 'win' | 'lost' | { begin: n } | { done: n } | { found: n } | { wave: n } | { down: <entity id> }";
function readMoment(on, tasks, at) {
  const task = (n, k) => { if (!(Number.isInteger(n) && n >= 1 && (!tasks || n <= tasks))) throw new Error(`${at}.${k} is a task, 1 to ${tasks || 'the last'}`); return n; };
  if (on === 'start' || on === 'win' || on === 'lost') return on;
  if (!isObj(on) || Object.keys(on).length !== 1) throw new Error(`${at} is ${MOMENTS}`);
  const [k, n] = Object.entries(on)[0];
  if (k === 'begin' || k === 'done' || k === 'found') return { [k]: task(n, k) };
  if (k === 'wave') { if (!(Number.isInteger(n) && n >= 1)) throw new Error(`${at}.wave is a wave, from 1`); return { wave: n }; }
  if (k === 'down') { if (typeof n !== 'string' || !n) throw new Error(`${at}.down is the id of a body (a group's members are <group>-<n>)`); return { down: n }; }
  throw new Error(`${at} is ${MOMENTS}`);
}

// a moment as the bus's trigger
const TRIGGER = (on) => on === 'start' ? { on: 'objective:begin', task: 't1' } : on === 'win' ? { on: 'objectives:done' } : on === 'lost' ? { on: 'objectives:failed' }
  : on.begin ? { on: 'objective:begin', task: `t${on.begin}` } : on.done ? { on: 'objective:done', task: `t${on.done}` } : on.found ? { on: 'objective:found', task: `t${on.found}` }
  : on.wave ? { on: 'wave', n: on.wave } : { on: 'down', entity: on.down };

export function scriptSequences(lines) {
  return lines.map((L) => ({ id: `script:${L.id}`, trigger: TRIGGER(L.on), steps: [...(L.after ? [{ await: { timer: L.after } }] : []), { do: 'emit', type: `comms:${L.id}` }] }));
}
