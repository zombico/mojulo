/**
 * QUESTS — a level's errands, kept in a journal: each a name and steps in order, each step done when its flag is set
 * (scenes.js flags: a scene's `sets`, an answer's, or a cue's `emit: 'flag:<name>'`). The page keeps a journal (J opens
 * it) and a word at the top as a quest begins, a step is done, a quest ends. With `play.carry`, the flags are carried
 * between levels as the scenes' are, so a quest begun in one level goes on in the next.
 *
 *   play.quests: [{ id, name?, starts?: '<flag>' (shown once it is set; else from the start),
 *                   steps: [{ log?: 'what to do', done: '<flag>' }] }]
 *
 * The words are a slot: a step without `log` shows `[Quest name: step n]`.
 *
 *   readQuests(play)     → the quests, read (throws, teaching)
 *   questFlags(play)     → every flag they read
 *   questProgram(play)   → what the page keeps: [{ id, name, starts?, steps: [{ text, flag }] }]
 *   questView(program, vars)   → [{ id, name, state: 'on' | 'done', steps: [{ text, done }] }] (begun quests; a step
 *                          shows once those before it are done)    } self-contained: the page ships their source
 *   questNews(program, flags)  → [{ kind: 'begun' | 'step' | 'done', name, text? }] for flags set just now
 */
const ID = /^[a-z][a-z0-9-]*$/;
const FLAG = /^[a-z][a-z0-9-]{0,47}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`play.quests${m}`);
const words = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;

export const QUEST_KEYS = Object.freeze({ id: 'a lowercase id', name: 'what the journal calls it', starts: 'the flag that begins it (else it is on from the start)', steps: '[{ log?, done: flag }] in order' });

export function readQuests(play) {
  const Q = play && play.quests;
  if (Q === undefined) return [];
  if (!Array.isArray(Q)) throw err(' is a list of { id, name?, starts?, steps: [{ log?, done }] }');
  const seen = new Set();
  return Q.map((q, i) => {
    const at = `[${i}]`;
    if (!isObj(q)) throw err(`${at} is { id, name?, starts?, steps: [{ log?, done }] }`);
    for (const k of Object.keys(q)) if (!QUEST_KEYS[k]) throw err(`${at}.${k} is not part of a quest (${Object.keys(QUEST_KEYS).join(', ')})`);
    if (typeof q.id !== 'string' || !ID.test(q.id)) throw err(`${at}.id is a lowercase id ("clear-the-cave")`);
    if (seen.has(q.id)) throw err(`${at}.id '${q.id}' appears twice`);
    seen.add(q.id);
    if (q.name !== undefined && !words(q.name)) throw err(`${at}.name is what the journal calls it, in words`);
    if (q.starts !== undefined && !FLAG.test(q.starts ?? '')) throw err(`${at}.starts is the flag that begins it (a lowercase name: took-job)`);
    if (!Array.isArray(q.steps) || !q.steps.length || q.steps.length > 12) throw err(`${at}.steps is 1 to 12 steps in order: [{ log?, done: '<flag>' }]`);
    const steps = q.steps.map((s, j) => {
      const sat = `${at}.steps[${j}]`;
      if (!isObj(s)) throw err(`${sat} is { log?, done: '<flag>' }`);
      for (const k of Object.keys(s)) if (!['log', 'done'].includes(k)) throw err(`${sat}.${k} is not part of a step (log, done)`);
      if (s.log !== undefined && !words(s.log)) throw err(`${sat}.log is what to do, in words (leave it out for a placeholder)`);
      if (!FLAG.test(s.done ?? '')) throw err(`${sat}.done is the flag that marks it done (a lowercase name: cave-cleared)`);
      return { ...(s.log !== undefined ? { log: s.log.trim() } : {}), done: s.done };
    });
    return { id: q.id, ...(q.name !== undefined ? { name: q.name.trim() } : {}), ...(q.starts ? { starts: q.starts } : {}), steps };
  });
}

export function questFlags(play) {
  const out = new Set();
  for (const q of readQuests(play)) { if (q.starts) out.add(q.starts); for (const s of q.steps) out.add(s.done); }
  return [...out].sort();
}

const nameOf = (q) => q.name || q.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export function questProgram(play) {
  return readQuests(play).map((q) => {
    const name = nameOf(q);
    return { id: q.id, name, ...(q.starts ? { starts: q.starts } : {}), steps: q.steps.map((s, j) => ({ text: s.log ?? `[${name}: step ${j + 1}]`, flag: s.done })) };
  });
}

// self-contained (the page ships their source): the flags are the bus vars flag-<name>
export function questView(program, vars) {
  const on = (f) => !!(vars && vars['flag-' + f]);
  const out = [];
  for (const q of program || []) {
    if (q.starts && !on(q.starts)) continue;
    const steps = [];
    for (const s of q.steps) { const d = on(s.flag); steps.push({ text: s.text, done: d }); if (!d) break; }
    out.push({ id: q.id, name: q.name, state: steps.every((s) => s.done) && steps.length === q.steps.length ? 'done' : 'on', steps });
  }
  return out;
}
export function questNews(program, flags) {
  const out = [];
  for (const f of flags || []) {
    for (const q of program || []) {
      if (q.starts === f) out.push({ kind: 'begun', name: q.name });
      const j = q.steps.findIndex((s) => s.flag === f);
      if (j >= 0) out.push(j === q.steps.length - 1 ? { kind: 'done', name: q.name } : { kind: 'step', name: q.name, text: q.steps[j].text });
    }
  }
  return out;
}
