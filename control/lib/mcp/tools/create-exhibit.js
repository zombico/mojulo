/**
 * create_exhibit / get_exhibit — the exhibit doors: a study object, a science world or a historic culture at its
 * period, asked for by HALL (lib/graph/exhibit/halls.js): `science/fission`, `earth/hydro`, `life/dna`,
 * `math/derivative`, `history/pompeii`.
 *
 * They fold three doors into two. create_view's kinds mint through the same handler (create-view.js
 * `resolveKindEntry`); a history id mints the `historic` manifest create_sketch always took; measure_view's read-back
 * is get_exhibit's `{ ref }`. The old names stay callable by name (RETIRED_PACKS' folded doors); get_view_vocab stays
 * listed as compose_world's manual reader (family `world`), which is no exhibit. A hall id lowers onto the manifest
 * kind its card always minted, so nothing already minted changes.
 */

import { registerTool } from '@/lib/mcp/server';
import { isToolRefusal } from '@/lib/errors/tool-refusal';
import { listingRows, DETAIL_PROPERTY } from '@/lib/mcp/vocab-listing';
import { getViewVocabCatalog } from '@/lib/graph/views/view-vocab/loader';
import { HALLS, HALL_IDS, exhibitCatalog, exhibitId, resolveExhibit, splitExhibitId } from '@/lib/graph/exhibit/halls';
import { HISTORIC_CULTURES } from '@/lib/graph/historic/historic-city';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { VIEW_KINDS, resolveKindEntry } from '@/lib/mcp/tools/create-view';
import { measureViewSamples } from '@/lib/mcp/tools/measure-view';
import { deriveViewKind } from '@/lib/mcp/tools/save-recipe';
import { createSketchHandler, updateSketchHandler } from '@/lib/mcp/tools/sketch-mint';

/** The kinds folded into a science world (VIEW_KINDS `listed: false`): no exhibit id, their rows render as before. */
const FOLDED = () => Object.entries(VIEW_KINDS).filter(([, k]) => k.listed === false).map(([id]) => id);

/** Every exhibit, by its hall id → its card (the view-vocab catalog's exhibit cards, the book's and the cookbook's). */
export function exhibitCards() {
  return exhibitCatalog(getViewVocabCatalog(), { leave: FOLDED() });
}

function resolveOrTeach(door, id) {
  try {
    return resolveExhibit(id, exhibitCards());
  } catch (err) {
    throw new Error(`${door}: ${err.message}`);
  }
}

// A history exhibit: a culture's entry mints its `historic` scene; a region's hub, the lineage and a record are read only.
async function mintHistory(x, { params, title, ref, folder_ref: folderRef, tour }) {
  const culture = x.card.id;
  if (!HISTORIC_CULTURES[culture]) {
    const cultures = Object.keys(HISTORIC_CULTURES).map((c) => `history/${c}`);
    throw new Error(`create_exhibit: '${x.id}' is read, not made (a hub, the lineage or a record). Make one of: ${cultures.join(', ')}`);
  }
  const p = params && typeof params === 'object' ? params : {};
  const manifest = { ...p, kind: 'historic', culture };
  const res = await createSketchHandler({ title: title || x.card.name, manifest, ref, folder_ref: folderRef });
  return withTour({ ...res, exhibit: x.id }, tour);
}

// A tour (lib/graph/exhibit/tour.js) is read against the world it rides, so it is set once the exhibit is made, through
// update_sketch's own gate. A refused tour leaves the exhibit made and says why, so the agent fixes the stops in place.
async function withTour(res, tour) {
  if (tour === undefined || !res || !res.ref) return res;
  try {
    await updateSketchHandler({ ref: res.ref, patch: [{ op: 'set', path: '/tour', value: tour }] });
    return { ...res, tour: { stops: Array.isArray(tour?.stops) ? tour.stops.length : 0 } };
  } catch (err) {
    return { ...res, tour_refused: `${err.message} — fix it with update_sketch set /tour; manual: get_view_vocab({ id: 'tour' })` };
  }
}

export async function createExhibitHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_exhibit requires { id, params? } (id: <hall>/<id>)');
  const x = resolveOrTeach('create_exhibit', input.id);
  if (x.hall === 'history') return mintHistory(x, input);
  const { params, title, viewBox, scene, ref, folder_ref: folderRef } = input;
  // a kind's card is its kind; a kept recipe (the book's, the cookbook's) mints its kind with its params under the caller's
  const recipe = x.card.recipe && typeof x.card.recipe === 'object' ? x.card.recipe : null;
  const kind = recipe?.kind ?? x.card.kind ?? x.card.id;
  const entry = resolveKindEntry(kind);
  if (!entry) throw new Error(`create_exhibit: '${x.id}' names no kind that mints (${kind}); read it with get_exhibit({ id: '${x.id}' })`);
  const merged = { ...(recipe?.params ?? {}), ...(params && typeof params === 'object' ? params : {}) };
  if (title !== undefined) merged.title = title;
  else if (recipe?.title && merged.title === undefined) merged.title = recipe.title;
  if (viewBox !== undefined) merged.viewBox = viewBox;
  if (scene !== undefined) merged.scene = scene;
  if (ref !== undefined) merged.ref = ref;
  if (folderRef !== undefined) merged.folder_ref = folderRef;
  try {
    const res = await entry.handler(merged);
    return res && typeof res === 'object' ? withTour({ ...res, exhibit: x.id }, input.tour) : res;
  } catch (err) {
    if (isToolRefusal(err)) throw err;
    throw new Error(`${err.message} — its manual: get_exhibit({ id: '${x.id}' }).`);
  }
}

// get_exhibit({ ref }): a made exhibit's physical time series in declared real units (measure_view's read-back).
function measureExhibit({ ref, every }) {
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`get_exhibit: no exhibit with ref '${ref}'`);
  let result;
  try {
    result = measureViewSamples(sketch.manifest, { every });
  } catch (err) {
    throw new Error(err.message.replace(/^measure_view:/, 'get_exhibit:'));
  }
  const v = deriveViewKind(sketch.manifest?.kind);
  const xid = v ? exhibitId({ id: v.kind, family: v.family }) : null;
  return { ok: true, ref: sketch.ref, title: sketch.title, ...(xid ? { exhibit: xid } : {}), ...result };
}

export async function getExhibitHandler(input) {
  const { id, hall, ref, every, detail } = input && typeof input === 'object' ? input : {};
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !ref) throw new Error('get_exhibit: `ref` is a made exhibit\'s sketch ref');
    return measureExhibit({ ref, every });
  }
  if (id) {
    const x = resolveOrTeach('get_exhibit', id);
    return { ok: true, id: x.id, hall: x.hall, card: x.card, _telemetrySignal: { id_requested: true, found: true } };
  }
  if (hall !== undefined && !HALL_IDS.includes(hall)) throw new Error(`get_exhibit: no hall '${hall}' (halls: ${HALL_IDS.join(', ')})`);
  const all = [...exhibitCards().entries()].filter(([, c]) => c.index !== false);
  const rows = all.filter(([xid]) => !hall || splitExhibitId(xid).hall === hall)
    .map(([xid, c]) => ({ ...c, id: xid }));
  return {
    ok: true,
    ...(hall ? {} : { halls: HALLS.map((h) => ({ ...h, count: all.filter(([xid]) => splitExhibitId(xid).hall === h.id).length })) }),
    cards: listingRows(rows.map(({ id: xid, family, entry, summary, when, name }) => ({ id: xid, name, family, entry, summary, when })), { detail: detail === true }),
    _telemetrySignal: { id_requested: false, found: true },
  };
}

export function registerExhibitTools() {
  registerTool({
    name: 'create_exhibit',
    description:
      'Make an EXHIBIT: an animated 3D study object, a science demo composed from laws, or a historic city at its period, '
      + 'served live at `/api/sketches/<ref>/world` (a tiny deterministic recipe, regenerated on render). Ask by hall: '
      + '`<hall>/<id>`, halls science, space, earth, life, math, history (`science/fission`, `earth/hydro`, `life/dna`, '
      + "`math/derivative`, `history/pompeii`). Find one via semantic_search({ kinds: ['view_vocab'] }) or "
      + 'get_exhibit({ hall }); read its manual with get_exhibit({ id }) before passing `params`. Reach for "teach me '
      + '<phenomenon>", "a museum exhibit about…", "show me ancient Egypt", "a demo for my class". Iterate with update_sketch.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "The exhibit, '<hall>/<id>'. Manual: get_exhibit({ id })." },
        params: { type: 'object', description: "Its own knobs (its card's manual). A history culture's: scene, focus, form, view, seed, people." },
        title: { type: 'string', description: 'Title for the resulting sketch.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height }.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#05040a" }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
        tour: { type: 'object', description: "Optional stops to step through: { stops: [{ caption, camera, highlight? }] }. Manual: get_view_vocab({ id: 'tour' })." },
      },
      required: ['id'],
    },
    handler: createExhibitHandler,
  });

  registerTool({
    name: 'get_exhibit',
    description:
      "Read an exhibit. `id` ('<hall>/<id>', or the bare id a search hit carries): its card in full, the depiction, "
      + 'routing phrases and parameter manual, or a history entry with its basis (attested, reconstructed, conjectural) '
      + 'and starters. No `id`: the halls and their rows (`hall` filters). `ref`: a made exhibit\'s physical time series '
      + 'in declared real units, re-planned from its recipe (the measurable kinds only; the rest refuse rather than '
      + 'return render units; `every` downsamples). Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "'<hall>/<id>'." },
        hall: { type: 'string', enum: HALL_IDS, description: 'List one hall.' },
        detail: DETAIL_PROPERTY,
        ref: { type: 'string', description: 'A made exhibit to measure.' },
        every: { type: 'number', description: 'With `ref`: every Nth sample (default 1).' },
      },
      required: [],
    },
    handler: getExhibitHandler,
  });
}
