/**
 * tune_ground — a gameworld level's ground, authored in the level's own space: the dials every trail is built by
 * (amplitude, depth, grade, the beats' shapes…) and the ground shaped by hand on a top-down grid of cells (raise,
 * lower, flatten, cliff, gorge, ridge). It answers with the SURVEY (level/ground-survey.js): the grid as a map, the
 * trails' dials and the laws the ground now breaks, and the hotspots, each with edits ready to paste.
 *
 * A call previews unless `apply: true`: the change is surveyed, compared with the stored ground, and written to
 * `levels.<id>.ground` only when applied. Separate from the geocube (a level's look): this is its land.
 *
 * A level's ground travels as a HEARTBEAT (era/heartbeat.js): `heartbeat` lays one on the level (a preset, a document,
 * or the ref of a `heartbeat` sketch, copied in with its source), and `export` turns the level's whole ground into one,
 * its places made relative so it lays on any level as the same ground to walk, saved as a sketch with `save`.
 */
import { registerTool } from '@/lib/mcp/server';
import { RENDER_TOOL_TIMEOUT_MS } from '@/lib/mcp/telemetry';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler, updateSketchHandler } from './sketches.js';
import { isGameworldKind, gameworldOf, readGameworld } from '@/lib/graph/gameworld/index';
import { resolveLevel } from '@/lib/graph/gameworld/world.js';
import { surveyLevelGround, groundDiff } from '@/lib/graph/level/ground-survey.js';
import { GROUND_CELL, compileLevelGround } from '@/lib/graph/level/ground.js';
import { readLevel } from '@/lib/graph/level/graph.js';
import { sequentialOrder } from '@/lib/graph/level/sequential.js';
import { GROUND_DIALS, GROUND_EDITS } from '@/lib/graph/era/out-ground.js';
import { readHeartbeat, heartbeatFromLevel, HEARTBEAT_PRESETS } from '@/lib/graph/era/heartbeat.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const label = (e, i) => e.id || `${e.op}-${i + 1}`;

/** The ground a call asks for, over the stored one: dials merged (null clears one), edits added (an id already
 *  there is replaced in place, an identical edit is not added twice), removed by label, or cleared. → the next ground, or undefined when it is empty. */
export function nextGround(cur, { cell, tune, edits, remove, clear, heartbeat, rise } = {}) {
  const g = isObj(cur) ? { ...cur } : {};
  if (cell !== undefined) g.cell = cell;
  if (heartbeat !== undefined) { if (heartbeat === null) delete g.heartbeat; else g.heartbeat = heartbeat; }
  if (rise !== undefined) { if (rise === null) delete g.rise; else g.rise = rise; }
  if (tune !== undefined) {
    if (!isObj(tune)) throw new Error(`tune_ground: tune is the dials { ${Object.keys(GROUND_DIALS).filter((k) => k !== 'edits').join(', ')} }; null clears one`);
    const t = { ...(g.tune || {}) };
    for (const [k, v] of Object.entries(tune)) {
      if (v === null) delete t[k];
      else if (isObj(v) && isObj(t[k])) t[k] = Object.fromEntries(Object.entries({ ...t[k], ...v }).filter(([, w]) => w !== null));
      else t[k] = v;
    }
    if (Object.keys(t).length) g.tune = t; else delete g.tune;
  }
  let list = clear ? [] : [...(g.edits || [])];
  if (remove !== undefined) {
    const gone = Array.isArray(remove) ? remove : [remove], labels = list.map(label);
    for (const r of gone) if (!labels.includes(r)) throw new Error(`tune_ground: remove '${r}' is not an edit of this level (edits: ${labels.join(', ') || 'none'})`);
    list = list.filter((e, i) => !gone.includes(label(e, i)));
  }
  if (edits !== undefined) {
    if (!Array.isArray(edits)) throw new Error('tune_ground: edits is a list of { op, … } in cells');
    for (const e of edits) {
      // an id already there is replaced in place; an edit already there as written is not laid twice (a retried call)
      const k = isObj(e) && e.id ? list.findIndex((x) => x.id === e.id) : -1;
      if (k >= 0) list[k] = e; else if (!list.some((x) => same(x, e))) list.push(e);
    }
  }
  if (list.length) g.edits = list; else delete g.edits;
  if (g.cell === GROUND_CELL.d && Object.keys(g).length === 1) delete g.cell;
  return Object.keys(g).length ? g : undefined;
}

/** A heartbeat asked for by name: a preset id stays one; a `heartbeat` sketch's ref is copied in, its source noted. */
function heartbeatAsked(v) {
  if (v === null || v === undefined || isObj(v)) return v;
  if (typeof v !== 'string') throw new Error('tune_ground: heartbeat is a preset id, a document, or a heartbeat sketch\'s ref (null clears it)');
  if (HEARTBEAT_PRESETS[v]) return v;
  const row = SketchRepository.getByRef(v);
  if (!row) throw new Error(`tune_ground: heartbeat '${v}' is neither a preset (${Object.keys(HEARTBEAT_PRESETS).join(', ')}) nor a sketch`);
  if (row.manifest?.kind !== 'heartbeat') throw new Error(`tune_ground: '${v}' is a ${row.manifest?.kind ?? 'sketch'}, not a heartbeat`);
  return { ...readHeartbeat(row.manifest.heartbeat), source: v };
}

/** The level's whole ground as one heartbeat: → the document (and the sketch it was saved to). */
async function exportHeartbeat(level, ex, ctx) {
  if (!isObj(ex)) throw new Error('tune_ground: export is { id, title?, reads?, why?, terrain?, save?: <ref> }');
  const G = readLevel(level), order = sequentialOrder(G), laid = compileLevelGround(G.ground ? G : { ...G, ground: { cell: GROUND_CELL.d, tune: null, edits: [] } }, order);
  if (!laid) throw new Error('tune_ground: export reads a level\'s trails, and this level has none');
  // made on a painted level, the heartbeat remembers the terrain it was made for: a cube that has it gives it back
  const terrain = ex.terrain ?? G.paint?.terrain.name ?? G.ground?.heartbeat?.terrain;
  const doc = heartbeatFromLevel(laid.metres, laid.frame, { id: ex.id, title: ex.title, reads: ex.reads, why: ex.why, terrain, source: ex.source ?? `${ctx.ref}/${ctx.level}` });
  if (ex.save === undefined) return { heartbeat: doc };
  if (typeof ex.save !== 'string' || !ex.save) throw new Error('tune_ground: export.save is the ref to keep the heartbeat at');
  const manifest = { kind: 'heartbeat', heartbeat: doc }, title = ex.title ?? doc.title;
  if (SketchRepository.getByRef(ex.save)) await updateSketchHandler({ ref: ex.save, title, manifest });
  else await createSketchHandler({ ref: ex.save, title, manifest });
  return { heartbeat: doc, saved: ex.save };
}

const withGround = (world, id, ground) => {
  const L = { ...world.levels[id] };
  if (ground === undefined) delete L.ground; else L.ground = ground;
  return { ...world, levels: { ...world.levels, [id]: L } };
};

export async function tuneGroundHandler(input = {}) {
  if (!isObj(input)) throw new Error('tune_ground takes { ref, level?, cell?, tune?, edits?, remove?, clear?, inspect?, apply? }');
  const { ref, level: asked, cell, tune, edits, remove, clear, inspect, apply, top, rise, export: ex } = input;
  const heartbeat = heartbeatAsked(input.heartbeat);
  if (typeof ref !== 'string' || !ref) throw new Error('tune_ground: ref is the gameworld\'s ref (design_game makes one)');
  const row = SketchRepository.getByRef(ref);
  if (!row) throw new Error(`tune_ground: no sketch '${ref}'`);
  if (!isGameworldKind(row.manifest?.kind)) throw new Error(`tune_ground: '${ref}' is a ${row.manifest?.kind ?? 'sketch'}, not a gameworld; a level's ground is a gameworld level's (design_game)`);
  const world = gameworldOf(row.manifest), G = readGameworld(world), id = asked ?? G.start;
  if (!G.levels[id]) throw new Error(`tune_ground: '${id}' is not a level (levels: ${G.ids.join(', ')})`);

  const cur = world.levels[id].ground, next = nextGround(cur, { cell, tune, edits, remove, clear, heartbeat, rise }), changed = !same(cur, next);
  const nextWorld = changed ? withGround(world, id, next) : world;
  const opts = { inspect: Array.isArray(inspect) ? inspect : inspect ? [inspect] : [], top: Number.isInteger(top) ? top : 12 };
  const after = surveyLevelGround(resolveLevel(nextWorld, id).level, opts);
  const before = changed ? surveyLevelGround(resolveLevel(world, id).level, { top: 0 }) : null;

  let applied = false;
  if (apply && changed) {
    await updateSketchHandler({ ref, patch: [next === undefined ? { op: 'remove', path: `/levels/${id}/ground` } : { op: 'set', path: `/levels/${id}/ground`, value: next }], note: `tune_ground: ${id}'s ground` });
    applied = true;
  }
  const exported = ex !== undefined ? await exportHeartbeat(resolveLevel(nextWorld, id).level, ex, { ref, level: id }) : null;
  const { heights: _h, ...survey } = after;
  return {
    ok: true, ref, level: id, changed, applied,
    ground: next ?? null,
    ...survey,
    ...(changed ? { diff: groundDiff(before, after) } : {}),
    ...(exported ? { exported } : {}),
    ...(!changed && !cur ? { vocab: { dials: GROUND_DIALS, edits: Object.fromEntries(Object.entries(GROUND_EDITS).filter(([k]) => k !== 'rise')), cells: "a cell 'C4', a block 'C4:E6' (raise, lower, flatten: `at`), a path 'B3>B9>D12' (cliff, gorge, ridge: `path`); a cliff names its high side by a cell on it (`high`)",
      rise: '[[row, metres], …]: the walk\'s long swell by row', heartbeat: `a preset (${Object.keys(HEARTBEAT_PRESETS).join(', ')}), a document or a heartbeat sketch's ref: the land's flow, shared between levels (card heartbeat)` } } : {}),
    next: changed && !applied
      ? ['a preview: nothing is stored. The same call with `apply: true` writes it to the level.']
      : ['Paste a hotspot\'s `suggest` into `edits` (its `why` is advice, left out of the edit), or name your own in cells; `apply: true` to keep it.', 'design_game({ ref, run: true }) remakes the level\'s stages from the stored ground.'],
  };
}

export function registerTuneGroundTools() {
  registerTool({
    name: 'tune_ground',
    timeoutMs: RENDER_TOOL_TIMEOUT_MS,
    description:
      "A gameworld level's ground on a top-down grid: a heartbeat to lay or export, dials (amplitude, depth…), a rise, edits by cell (raise, lower, flatten, cliff, gorge, ridge). Answers a map, broken laws and hotspots with edits to paste. Previews unless `apply`.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The gameworld (design_game).' },
        level: { type: 'string', description: 'Default: the start.' },
        cell: { type: 'number', description: 'Metres (4–16).' },
        heartbeat: { description: 'Preset, document or heartbeat ref; null clears.' },
        rise: { type: 'array', items: { type: 'array' }, description: '[[row, metres], …].' },
        export: { type: 'object', description: '{ id, title?, save?: ref }: the ground as a heartbeat.' },
        tune: { type: 'object', description: 'Dials; null clears one.' },
        edits: { type: 'array', items: { type: 'object' }, description: "{ op, at | path, … } in cells." },
        remove: { type: 'array', items: { type: 'string' }, description: 'Edit ids or labels.' },
        clear: { type: 'boolean' },
        inspect: { type: 'array', items: { type: 'string' }, description: 'Cells.' },
        apply: { type: 'boolean' },
      },
      required: ['ref'],
    },
    handler: tuneGroundHandler,
  });
}
