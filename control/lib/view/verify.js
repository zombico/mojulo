/**
 * THE VIEW'S VERIFICATION — every gate a level has, machine and eyes, said apart and never conflated
 * (docs/bicycles.md): what ran, what it found, and what it cannot prove.
 *
 *   still(r, { seconds? }) → { status: pass | fail | skip, seconds, ends: [{ event, end }], ended?: { event, at, end }, why }
 *        THE STILL CHECK (a machine gate, spiked here): the level stood still in the headless simulator
 *        (game/level-sim.js), no press at all, for `seconds` (3). A level whose contract ends it in that time (a guard
 *        that sees the hero at the spawn, a hazard under it, a clock already out) fails with the event and its second:
 *        a level a player loses before touching a key is broken, whatever its first frame looks like. A level with no
 *        contract has nothing to end: skipped. Kept per level as stored (its print), so a repeat is free.
 *   stillNow(r) → the still check's result if it has run for the level as it stands, else null (never waits)
 *   recordStill(r, result) / recordReadout(ref, print, readout) / readoutNow(ref, print) the view's record of what its
 *        warmer found (`view-cache.json` beside the database): a level is resolved whole the first time, seconds to a
 *        minute for a built one, so the checks run in a process of their own and the pages read their results. The
 *        record belongs in a game's run record, where the level is resolved anyway (the plan's next phase)
 *   gates(level, r, { still? }) → [{ id, kind: machine | eyes, status, says }] the walk, the first frame, the still
 *        check, the eyes: each one's status and what it says
 *   The eyes gate is always open here: the person's verdict on a level they played has no record yet (the view is read
 *   only until a person's decisions have one of their own), so the page says to tell the agent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { printOf } from './data.js';

const STILL_SECONDS = 3, DT = 1 / 30;
const stillCache = new Map();

const dataDir = () => process.env.MOJULO_DATA_DIR || path.dirname(process.env.SQLITE_PATH || './data/x');
const cacheFile = () => path.join(dataDir(), 'view-cache.json');
const readCache = () => { try { return JSON.parse(fs.readFileSync(cacheFile(), 'utf8')); } catch { return { stills: {}, readouts: {} }; } };
function writeCache(fn) {
  const c = readCache(); c.stills ??= {}; c.readouts ??= {};
  fn(c);
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = `${cacheFile()}.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(c)); fs.renameSync(tmp, cacheFile());
}
export function stillNow(r, { seconds = STILL_SECONDS } = {}) {
  if (!r) return null;
  const c = readCache().stills?.[r.ref];
  return c && c.print === printOf(r) && c.result?.seconds === seconds ? c.result : null;
}
export const recordStill = (r, result) => writeCache((c) => { c.stills[r.ref] = { print: printOf(r), result }; });
export const recordReadout = (ref, print, readout) => writeCache((c) => { c.readouts[ref] = { print, goalposts: readout?.goalposts ?? null }; });
export function readoutNow(ref, print) { const c = readCache().readouts?.[ref]; return c && c.print === print ? c : null; }

export async function still(r, { seconds = STILL_SECONDS } = {}) {
  if (!r) return { status: 'skip', seconds, why: 'no such level' };
  const key = `${r.ref}:${printOf(r)}:${seconds}`;
  if (stillCache.has(key)) return stillCache.get(key);
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
  const { simLevel } = await import('@/lib/graph/game/level-sim.js');
  let out;
  try {
    const { payload } = await resolveWorldScene(r);
    const ends = Object.entries(payload?.game?.on ?? {}).filter(([, v]) => v && v.end).map(([event, v]) => ({ event, end: v.end }));
    if (!payload || !ends.length) out = { status: 'skip', seconds, ends, why: 'the level has no contract that ends it' };
    else {
      const sim = simLevel({ entities: structuredClone(payload.entities || []), events: payload.events || {}, colliders: payload.colliders, camera: payload.camera, world: payload });
      let ended = null;
      for (let f = 0; f < Math.round(seconds / DT) && !ended; f++) {
        const n0 = sim.bus.log.length;
        sim.frame(DT);
        for (let i = n0; i < sim.bus.log.length && !ended; i++) {
          const e = ends.find((x) => x.event === sim.bus.log[i]?.type);
          if (e) ended = { event: e.event, end: e.end, at: Math.round((f + 1) * DT * 100) / 100 };
        }
      }
      out = ended
        ? { status: 'fail', seconds, ends, ended, why: `stood still, the level ended (${ended.event} → ${ended.end}) at ${ended.at} s, before any press` }
        : { status: 'pass', seconds, ends, why: `stood still for ${seconds} s, nothing ended the level` };
    }
  } catch (err) {
    out = { status: 'skip', seconds, why: `could not be simulated: ${String(err?.message ?? err).split('\n')[0]}` };
  }
  stillCache.set(key, out);
  return out;
}

export function gates(level, r, { still: S = null } = {}) {
  const W = level?.walk?.verdict ?? null, F = level?.frame ?? null;
  return [
    { id: 'walk', kind: 'machine', status: W ? (W.completable === true ? 'pass' : 'fail') : 'skip',
      says: W ? (W.completable === true ? 'walked to its end by the scripted player' : W.note || 'not completable') : 'not walked: the walk proves reach, survive and escape levels; this one is the person\'s to play' },
    { id: 'first frame', kind: 'machine', status: F ? (F.status === 'pass' ? 'pass' : F.status === 'skipped' ? 'skip' : 'fail') : 'skip',
      says: F ? `the opening view judged: ${F.status} (the framing, not the play)` : 'not judged' },
    { id: 'still', kind: 'machine', status: S ? S.status : 'skip', says: S ? S.why : 'running in the background: reload in a moment' },
    { id: 'eyes', kind: 'eyes', status: 'open', says: 'the person\'s to say, by playing it: tell your agent whether it is the game' },
  ];
}
