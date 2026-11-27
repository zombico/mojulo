/**
 * THE SCRIPT — a level's spoken lines as data, each with an id, who says it, its words and the moment it is said: the
 * level's own events (a task begun or met, a scan's find, a wave, a body down, the win, the loss), a few seconds after
 * if it says so. Shown as comms on the page (scene/channels/comms.js: the speaker's name and portrait, the words as a
 * subtitle), read whole as the game's script (the script book) by whoever records the voices: every line has an id.
 *
 *   readScript(v, { tasks, at? }) → { speakers, lines, calls } (throws, teaching)
 *     v       { speakers?: { <who>: { name, colour? } }, lines?: [{ id, who, text, on, after? }],
 *               calls?: [{ id, on, after?, from?, again?, lines: [{ id, who, text }] }] }   (lines or calls, or both)
 *     on      'start' | 'win' | 'lost' | { begin: <task n> } | { done: <task n> } | { found: <task n> } | { wave: <n> } |
 *             { down: <entity id> } | { event: '<bus event>' }   (tasks counted from 1, as the level's objectives number
 *             them; an event any the bus hears: a stealth game's alarm:detected or alarm:found, a ledge:catch, a scene's
 *             end scene-end:<id>, another call's end call:<id>:end)
 *     after   seconds after the moment (0 to 30)
 *     calls   a RADIO CALL: the game held while it is on (scene/channels/calls.js), its lines passed one by one or the
 *             call ended; `from` the caller (else its second speaker), `again` made each time its moment comes (else once)
 *   scriptSequences(lines, calls?) → the bus's sequences (worlds/event-bus.js): each line's moment its trigger, `comms:<id>`
 *             raised; each call's, `call:<id>`
 *   SCRIPT                 the numbers: the most lines a level, the longest line
 *
 * The moments are the objectives' own events (game/objectives.js: objective:begin / done / found carry the task's id,
 * `t<n>` as a frame operation names them), the cast's `down`, `wave`, `objectives:done`, `dead`. Pure.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const SCRIPT = Object.freeze({ lines: 80, text: 240, after: 30, calls: 40, callLines: 30 });
const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z][a-z0-9-]{0,40}$/;

export function readScript(v, { tasks = 0, at = 'script' } = {}) {
  const fail = (m) => { throw new Error(`${at}${m}`); };
  if (!isObj(v)) fail(' is { speakers?, lines: [{ id, who, text, on, after? }] }: the level\'s spoken lines');
  for (const k of Object.keys(v)) if (!['speakers', 'lines', 'calls'].includes(k)) fail(`.${k} is not part of a script (speakers, lines, calls)`);
  const speakers = {};
  if (v.speakers !== undefined) {
    if (!isObj(v.speakers)) fail('.speakers is { <who>: { name, colour? } }');
    for (const [w, S] of Object.entries(v.speakers)) {
      if (!ID.test(w)) fail(`.speakers: '${w}' is a speaker's id, lower-case`);
      if (!isObj(S) || typeof S.name !== 'string' || !S.name || S.name.length > 24) fail(`.speakers.${w} is { name, colour? }: what the line is shown as said by`);
      if (S.colour !== undefined && !HEX.test(S.colour)) fail(`.speakers.${w}.colour is #rrggbb`);
      speakers[w] = { name: S.name, ...(S.colour ? { colour: S.colour } : {}) };
    }
  }
  if (v.lines === undefined && v.calls === undefined) fail(' says something: its lines (over the play) or its calls (the game held), or both');
  if (v.lines !== undefined && (!Array.isArray(v.lines) || !v.lines.length || v.lines.length > SCRIPT.lines)) fail(`.lines is 1 to ${SCRIPT.lines} lines`);
  const seen = new Set();
  const lines = (v.lines ?? []).map((L, i) => {
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
  // THE CALLS: each a radio call made at its moment, its lines said one by one with the game held
  if (v.calls !== undefined && (!Array.isArray(v.calls) || !v.calls.length || v.calls.length > SCRIPT.calls)) fail(`.calls is 1 to ${SCRIPT.calls} calls`);
  const callIds = new Set();
  const calls = (v.calls ?? []).map((C, i) => {
    const cat = `${at}.calls[${i}]`, no = (m) => { throw new Error(`${cat}${m}`); };
    if (!isObj(C)) no(' is { id, on, after?, from?, again?, lines: [{ id, who, text }] }');
    for (const k of Object.keys(C)) if (!['id', 'on', 'after', 'from', 'again', 'lines'].includes(k)) no(`.${k} is not part of a call (id, on, after, from, again, lines)`);
    if (typeof C.id !== 'string' || !ID.test(C.id) || callIds.has(C.id)) no('.id is its own name, lower-case');
    callIds.add(C.id);
    if (C.after !== undefined && !(Number.isFinite(C.after) && C.after >= 0 && C.after <= SCRIPT.after)) no(`.after is seconds after its moment, 0 to ${SCRIPT.after}`);
    if (C.from !== undefined && (typeof C.from !== 'string' || !ID.test(C.from))) no('.from is the caller (a speaker\'s id)');
    if (C.again !== undefined && typeof C.again !== 'boolean') no('.again is true: the call made each time its moment comes');
    if (!Array.isArray(C.lines) || !C.lines.length || C.lines.length > SCRIPT.callLines) no(`.lines is 1 to ${SCRIPT.callLines} lines`);
    const said = C.lines.map((L, j) => {
      const lat = `${cat}.lines[${j}]`, nl = (m) => { throw new Error(`${lat}${m}`); };
      if (!isObj(L)) nl(' is { id, who, text }');
      for (const k of Object.keys(L)) if (!['id', 'who', 'text'].includes(k)) nl(`.${k} is not part of a call's line (id, who, text)`);
      if (typeof L.id !== 'string' || !ID.test(L.id) || seen.has(L.id)) nl('.id is its own name, lower-case: the voice recorded for it is found by it');
      seen.add(L.id);
      if (typeof L.who !== 'string' || !ID.test(L.who)) nl('.who is who says it (a speaker\'s id)');
      if (typeof L.text !== 'string' || !L.text || L.text.length > SCRIPT.text) nl(`.text is the words, up to ${SCRIPT.text} letters`);
      return { id: L.id, who: L.who, text: L.text };
    });
    if (C.from !== undefined && !said.some((L) => L.who === C.from)) no(`.from is one who speaks on the call (${[...new Set(said.map((L) => L.who))].join(', ')})`);
    return { id: C.id, on: readMoment(C.on, tasks, `${cat}.on`), ...(C.after ? { after: C.after } : {}), ...(C.from ? { from: C.from } : {}), ...(C.again ? { again: true } : {}), lines: said };
  });
  return { speakers, lines, calls };
}

const MOMENTS = "'start' | 'win' | 'lost' | { begin: n } | { done: n } | { found: n } | { wave: n } | { down: <entity id> } | { event: '<bus event>' }";
function readMoment(on, tasks, at) {
  const task = (n, k) => { if (!(Number.isInteger(n) && n >= 1 && (!tasks || n <= tasks))) throw new Error(`${at}.${k} is a task, 1 to ${tasks || 'the last'}`); return n; };
  if (on === 'start' || on === 'win' || on === 'lost') return on;
  if (!isObj(on) || Object.keys(on).length !== 1) throw new Error(`${at} is ${MOMENTS}`);
  const [k, n] = Object.entries(on)[0];
  if (k === 'begin' || k === 'done' || k === 'found') return { [k]: task(n, k) };
  if (k === 'wave') { if (!(Number.isInteger(n) && n >= 1)) throw new Error(`${at}.wave is a wave, from 1`); return { wave: n }; }
  if (k === 'event') { if (typeof n !== 'string' || !/^[a-z][a-z0-9:_-]{0,80}$/.test(n)) throw new Error(`${at}.event is a bus event's type (alarm:found, ledge:catch, scene-end:<id>, call:<id>:end)`); return { event: n }; }
  if (k === 'down') { if (typeof n !== 'string' || !n) throw new Error(`${at}.down is the id of a body (a group's members are <group>-<n>)`); return { down: n }; }
  throw new Error(`${at} is ${MOMENTS}`);
}

// a moment as the bus's trigger
const TRIGGER = (on) => on === 'start' ? { on: 'objective:begin', task: 't1' } : on === 'win' ? { on: 'objectives:done' } : on === 'lost' ? { on: 'objectives:failed' }
  : on.begin ? { on: 'objective:begin', task: `t${on.begin}` } : on.done ? { on: 'objective:done', task: `t${on.done}` } : on.found ? { on: 'objective:found', task: `t${on.found}` }
  : on.wave ? { on: 'wave', n: on.wave } : on.event ? { on: on.event } : { on: 'down', entity: on.down };

export function scriptSequences(lines, calls = []) {
  return [...lines.map((L) => ({ id: `script:${L.id}`, trigger: TRIGGER(L.on), steps: [...(L.after ? [{ await: { timer: L.after } }] : []), { do: 'emit', type: `comms:${L.id}` }] })),
    ...calls.map((C) => ({ id: `call:${C.id}`, trigger: TRIGGER(C.on), steps: [...(C.after ? [{ await: { timer: C.after } }] : []), { do: 'emit', type: `call:${C.id}` }] }))];
}
