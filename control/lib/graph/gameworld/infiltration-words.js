/**
 * THE INFILTRATION LEVEL'S WORDS — read (infiltration-level.js lays them; its header says each word). Its own module, with
 * no imports, so the world's reader (world.js) reads a level's `infiltration` without the operative's modules.
 *
 *   INFILTRATION                 the numbers: the floor's half, a guard's sight, a patrol's pace, a reach's radius
 *   readInfiltration(v, at?)     → the level's words read (throws, teaching)
 *
 * Pure.
 */
export const INFILTRATION = Object.freeze({ half: 20, cone: 0.6, range: 14, speed: 1.6, reach: 2.5, eye: 0.2 });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ID = /^[a-z][a-z0-9-]{0,40}$/;
const r2 = (v) => Math.round(v * 100) / 100;
const KEYS = ['ground', 'start', 'heading', 'exit', 'cover', 'guards', 'alarm', 'backup', 'tasks'];
const ALARM_KEYS = ['confirm', 'radio', 'found', 'detected', 'vigilant', 'sweep', 'every'];

/** The level's words (see the header): read, every place inside its floor; throws, teaching. */
export function readInfiltration(v, at = 'infiltration') {
  const fail = (m) => { throw new Error(`${at}${m}`); };
  if (!isObj(v)) fail(` is { ${KEYS.join(', ')} }: a stealth level's ground, its operative's start, its way on, its cover, its guards and its tasks`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) fail(`.${k} is not part of an infiltration level (${KEYS.join(', ')})`);
  const half = v.ground?.half ?? INFILTRATION.half;
  if (v.ground !== undefined && !(isObj(v.ground) && Object.keys(v.ground).every((k) => k === 'half'))) fail('.ground is { half }: the floor\'s half-width in metres');
  if (!(Number.isFinite(half) && half >= 6 && half <= 60)) fail('.ground.half is 6 to 60 m');
  const place = (p, w) => {
    if (!(Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) fail(`${w} is [x, y] in metres from the floor's middle`);
    if (Math.abs(p[0]) > half || Math.abs(p[1]) > half) fail(`${w} is off the floor (it reaches ${half} m each way)`);
    return [r2(p[0]), r2(p[1])];
  };
  const start = place(v.start, '.start');
  if (v.heading !== undefined && !Number.isFinite(v.heading)) fail('.heading is degrees, 90 up the floor');
  const X = Array.isArray(v.exit) ? { at: v.exit } : v.exit;
  if (!isObj(X)) fail('.exit is [x, y] or { at, radius?, text? }: the way on');
  const exit = { at: place(X.at, '.exit.at'), radius: X.radius ?? INFILTRATION.reach, text: X.text ?? 'Reach the way on' };
  const seen = new Set();
  const named = (id, w) => { if (typeof id !== 'string' || !ID.test(id) || seen.has(id)) fail(`${w}.id is its own short name, lower-case`); seen.add(id); return id; };
  const cover = (v.cover ?? []).map((c, i) => {
    const w = `.cover[${i}]`;
    if (!isObj(c)) fail(`${w} is { id, at, size: [w, d, h] }`);
    if (!(Array.isArray(c.size) && c.size.length === 3 && c.size.every((s) => Number.isFinite(s) && s > 0 && s <= 30))) fail(`${w}.size is [w, d, h] in metres`);
    return { id: named(c.id, w), at: place(c.at, `${w}.at`), size: c.size.map(r2) };
  });
  if (!Array.isArray(v.cover ?? [])) fail('.cover is a list of boxes');
  if (!Array.isArray(v.guards ?? [])) fail('.guards is a list of guards');
  const guards = (v.guards ?? []).map((g, i) => {
    const w = `.guards[${i}]`;
    if (!isObj(g) || !['patrol', 'post'].includes(g.kind)) fail(`${w} is { id, kind: 'patrol', at, to } or { id, kind: 'post', at, facing }`);
    const out = { id: named(g.id, w), kind: g.kind, at: place(g.at, `${w}.at`) };
    if (g.kind === 'patrol') out.to = place(g.to, `${w}.to`); else out.facing = place(g.facing, `${w}.facing`);
    for (const [k, lo, hi] of [['speed', 0.3, 4], ['cone', 0.1, 1.6], ['range', 2, 60]]) {
      if (g[k] === undefined) continue;
      if (!(Number.isFinite(g[k]) && g[k] >= lo && g[k] <= hi)) fail(`${w}.${k} is ${lo} to ${hi}`);
      out[k] = g[k];
    }
    if (g.look !== undefined) { if (!(isObj(g.look) && Number.isFinite(g.look.secs) && g.look.secs > 0)) fail(`${w}.look is { secs }: a look all the way round at each end`); out.look = { secs: g.look.secs }; }
    return out;
  });
  let alarm = null;
  if (v.alarm !== undefined) {
    if (!isObj(v.alarm) || Object.keys(v.alarm).some((k) => !ALARM_KEYS.includes(k) || !Number.isFinite(v.alarm[k]) || v.alarm[k] < 0)) fail(`.alarm is { ${ALARM_KEYS.join(', ')} }: the garrison's numbers (seconds, a gain, metres)`);
    alarm = { ...v.alarm };
  }
  let backup = null;
  if (v.backup !== undefined) {
    if (!isObj(v.backup) || !(Number.isInteger(v.backup.count) && v.backup.count >= 1 && v.backup.count <= 6)) fail('.backup is { count: 1 to 6, from: [x, y] }');
    backup = { count: v.backup.count, from: place(v.backup.from, '.backup.from') };
  }
  if (!Array.isArray(v.tasks ?? [])) fail('.tasks is a list');
  const tasks = (v.tasks ?? []).map((t, i) => {
    const w = `.tasks[${i}]`;
    if (!isObj(t)) fail(`${w} is { reach: [x, y] } | { take: [x, y] } | { act: '<bus event>' }, with text?`);
    const k = ['reach', 'take', 'act'].find((x) => t[x] !== undefined);
    if (!k) fail(`${w} names what is done: reach, take or act`);
    if (t.text !== undefined && !(typeof t.text === 'string' && t.text.length > 0 && t.text.length <= 80)) fail(`${w}.text is words, up to 80 letters`);
    if (k === 'act') { if (typeof t.act !== 'string' || !t.act) fail(`${w}.act is the bus event that meets it (a scene's end: scene-end:<id>)`); return { kind: 'act', on: t.act, text: t.text ?? 'Do what is asked' }; }
    return { kind: k, at: place(t[k], `${w}.${k}`), radius: t.radius ?? INFILTRATION.reach, text: t.text ?? (k === 'take' ? 'Take it' : 'Reach it') };
  });
  const heading = ((v.heading ?? 90) * Math.PI) / 180;
  return { half, start, heading: r2(heading), exit, cover, guards, alarm, backup, tasks };
}

