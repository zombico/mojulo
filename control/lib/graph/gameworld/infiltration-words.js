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
const KEYS = ['ground', 'start', 'heading', 'exit', 'cover', 'guards', 'alarm', 'backup', 'tasks', 'sea', 'scenery', 'marks', 'night', 'kit'];
// (how far from the floor's middle a thing seen, not walked, may stand: an island across the water, a mark a scene frames)
const FAR = 3000;
const ALARM_KEYS = ['confirm', 'radio', 'found', 'detected', 'vigilant', 'sweep', 'every'];

/** The level's words (see the header): read, every place inside its floor; throws, teaching. */
export function readInfiltration(v, at = 'infiltration') {
  const fail = (m) => { throw new Error(`${at}${m}`); };
  if (!isObj(v)) fail(` is { ${KEYS.join(', ')} }: a stealth level's ground, its operative's start, its way on, its cover, its guards and its tasks`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) fail(`.${k} is not part of an infiltration level (${KEYS.join(', ')})`);
  // THE GROUND: a walled square floor (`half`), or a ship's DECK (`deck: { length, beam, rail? }`: its length along y,
  // the bow at +y, its beam across x, a rail round it `rail` metres high)
  if (v.ground !== undefined && !(isObj(v.ground) && Object.keys(v.ground).every((k) => k === 'half' || k === 'deck') && !(v.ground.half !== undefined && v.ground.deck !== undefined))) fail('.ground is { half } (a walled square floor) or { deck: { length, beam, rail? } } (a ship\'s deck)');
  let deck = null, hx, hy;
  if (v.ground?.deck !== undefined) {
    const D = v.ground.deck;
    if (!isObj(D) || Object.keys(D).some((k) => !['length', 'beam', 'rail'].includes(k))) fail('.ground.deck is { length, beam, rail? }');
    if (!(Number.isFinite(D.length) && D.length >= 12 && D.length <= 240)) fail('.ground.deck.length is 12 to 240 m');
    if (!(Number.isFinite(D.beam) && D.beam >= 6 && D.beam <= 60)) fail('.ground.deck.beam is 6 to 60 m');
    if (D.rail !== undefined && !(Number.isFinite(D.rail) && D.rail >= 0.4 && D.rail <= 2)) fail('.ground.deck.rail is 0.4 to 2 m');
    deck = { length: r2(D.length), beam: r2(D.beam), rail: D.rail ?? 1.1 };
    hx = deck.beam / 2; hy = deck.length / 2;
  }
  const half = v.ground?.half ?? INFILTRATION.half;
  if (!deck && !(Number.isFinite(half) && half >= 6 && half <= 60)) fail('.ground.half is 6 to 60 m');
  if (!deck) { hx = half; hy = half; }
  const place = (p, w) => {
    if (!(Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) fail(`${w} is [x, y] in metres from the floor's middle`);
    if (Math.abs(p[0]) > hx || Math.abs(p[1]) > hy) fail(`${w} is off the ${deck ? 'deck' : 'floor'} (it reaches ${hx} m across and ${hy} m along)`);
    return [r2(p[0]), r2(p[1])];
  };
  // (a place seen, not walked: anywhere within FAR, its height given or the floor's)
  const seen = (p, w) => {
    if (!(Array.isArray(p) && (p.length === 2 || p.length === 3) && p.every(Number.isFinite))) fail(`${w} is [x, y] or [x, y, z] in metres from the floor's middle`);
    if (Math.abs(p[0]) > FAR || Math.abs(p[1]) > FAR || Math.abs(p[2] ?? 0) > FAR) fail(`${w} is within ${FAR} m`);
    return [r2(p[0]), r2(p[1]), r2(p[2] ?? 0)];
  };
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const start = place(v.start, '.start');
  if (v.heading !== undefined && !Number.isFinite(v.heading)) fail('.heading is degrees, 90 up the floor');
  // (no exit: the level is won as its last task is met, a scene's end or a call's: its tasks must say what that is)
  const X = Array.isArray(v.exit) ? { at: v.exit } : v.exit;
  if (X !== undefined && !isObj(X)) fail('.exit is [x, y] or { at, radius?, text? }: the way on');
  if (X === undefined && !(Array.isArray(v.tasks) && v.tasks.length)) fail(' has an exit (the way on) or tasks (the level won as the last is met)');
  const exit = X === undefined ? null : { at: place(X.at, '.exit.at'), radius: X.radius ?? INFILTRATION.reach, text: X.text ?? 'Reach the way on' };
  const ids = new Set();
  const named = (id, w) => { if (typeof id !== 'string' || !ID.test(id) || ids.has(id)) fail(`${w}.id is its own short name, lower-case`); ids.add(id); return id; };
  const cover = (v.cover ?? []).map((c, i) => {
    const w = `.cover[${i}]`;
    if (!isObj(c)) fail(`${w} is { id, at, size: [w, d, h], z?, colour? }`);
    if (!(Array.isArray(c.size) && c.size.length === 3 && c.size.every((s) => Number.isFinite(s) && s > 0 && s <= 30))) fail(`${w}.size is [w, d, h] in metres`);
    // (raised off the floor, `z`: a pipe run a body crawls under, a gantry walked beneath)
    if (c.z !== undefined && !(Number.isFinite(c.z) && c.z >= 0 && c.z <= 10)) fail(`${w}.z is how high its underside stands, 0 to 10 m`);
    if (c.colour !== undefined && !HEX.test(c.colour)) fail(`${w}.colour is #rrggbb`);
    return { id: named(c.id, w), at: place(c.at, `${w}.at`), size: c.size.map(r2), ...(c.z ? { z: r2(c.z) } : {}), ...(c.colour ? { colour: c.colour } : {}) };
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
  // THE SEA round a deck (`sea: true | { colour? }`): water to the horizon, its surface under the deck's edge
  let sea = null;
  if (v.sea !== undefined && v.sea !== false) {
    if (!(v.sea === true || (isObj(v.sea) && Object.keys(v.sea).every((k) => k === 'colour') && (v.sea.colour === undefined || HEX.test(v.sea.colour))))) fail('.sea is true or { colour?: #rrggbb }');
    sea = { colour: v.sea.colour ?? '#0b1a24' };
  }
  // SCENERY: things seen and never walked (an island's cliff, a fortress on it, a mast): boxes, each its colour
  if (!Array.isArray(v.scenery ?? [])) fail('.scenery is a list of boxes seen, not walked');
  const scenery = (v.scenery ?? []).map((b, i) => {
    const w = `.scenery[${i}]`;
    if (!isObj(b) || !(Array.isArray(b.size) && b.size.length === 3 && b.size.every((x) => Number.isFinite(x) && x > 0 && x <= 2000))) fail(`${w} is { id, at: [x, y, z?], size: [w, d, h], colour? }`);
    if (b.colour !== undefined && !HEX.test(b.colour)) fail(`${w}.colour is #rrggbb`);
    if (b.lit !== undefined && !HEX.test(b.lit)) fail(`${w}.lit is #rrggbb: a light that shows at night (a window, a lamp)`);
    return { id: named(b.id, w), at: seen(b.at, `${w}.at`), size: b.size.map(r2), colour: b.colour ?? '#2a2e33', ...(b.lit ? { lit: b.lit } : {}) };
  });
  // MARKS: named places a scene frames (playscape/ui/scenes.js shot `on`), on the floor or seen across the water
  if (v.marks !== undefined && !isObj(v.marks)) fail('.marks is { <name>: [x, y] | [x, y, z] }');
  const marks = Object.entries(v.marks ?? {}).map(([id, p]) => { if (!ID.test(id) || ['start', 'exit'].includes(id)) fail(`.marks: '${id}' is a short lower-case name (start and exit are the level's own)`); return { id, at: seen(p, `.marks.${id}`) }; });
  if (v.night !== undefined && typeof v.night !== 'boolean') fail('.night is true: the level played at night');
  // THE KIT the operative carries on this level (arms-kit.js words: a prologue's sleep dart alone, a chapter's pistol), in
  // place of the world's own; none said, the world's
  if (v.kit !== undefined && !(Array.isArray(v.kit) && v.kit.length >= 1 && v.kit.length <= 6 && v.kit.every((k) => typeof k === 'string' && /^[a-z][a-z0-9-]{0,30}$/.test(k)))) fail('.kit is 1 to 6 arms words (the sleep dart: dart; a pistol: handgun)');
  const heading = ((v.heading ?? 90) * Math.PI) / 180;
  return { half, ...(deck ? { deck } : {}), start, heading: r2(heading), exit, cover, guards, alarm, backup, tasks, ...(sea ? { sea } : {}), ...(scenery.length ? { scenery } : {}), ...(marks.length ? { marks } : {}), ...(v.night ? { night: true } : {}), ...(v.kit ? { kit: v.kit.slice() } : {}) };
}

