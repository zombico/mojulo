/**
 * historic/solver — a historic town SOLVED from its form (../form/), its monument (../monuments/) and what its people
 * had (../ledger/), instead of laid by hand. One solver for every culture; what differs between them is data.
 *
 * The layers, in order, each on its own seeded stream so a change to one never rerolls the ones before it, each its
 * own module sharing one context (./context.js):
 *   frame      the ground the scene plans on: the town ('city'), the region round it ('region'), a slice of life cut
 *              from the region ('slice', round a `focus`)
 *   site       the water and the lie of the land (./site.js), anchored on the town
 *   armature   the monument seated at its place, its precinct, its approach (./armature.js ARMATURES)
 *   enclosure  a ring wall with towers and gates, or walled wards (./enclosure.js ENCLOSURES)
 *   streets    the pattern and the alleys that keep every block shallow (./streets.js STREETS)
 *   placement  what stands by meaning or need (./placement.js WHERE)
 *   lots       the free ground packed with house lots, each fronting a lane; the houses by size (./land.js)
 *   land       the fields and trees outside the town; in a region, the activities (./land.js TREES, ACTIVITY_WHERE)
 *   views      eye-level views read off the armature; a slice is cut to its window (./views.js)
 *   ground     the kits built, the terrain under it all (../terrain.js), the lanes, the precinct's floor (./emit.js)
 *   guide      the ledger's findings and the laws (./laws.js)
 * A new armature, enclosure, street pattern, placement, tree or activity place is one entry in its layer's table: the
 * form's schema reads its words from those tables.
 *
 * It returns the PLAN every historic emitter reads ({ boxes, grounds, slots, views, frame, stats, grid, hAt,
 * repeats? }), and with it what the field guide reads: the form, the monument, the ledger's findings and the laws.
 * Plans in metres, x east, y south. Pure and deterministic.
 */
import { HISTORIC_CULTURES } from '../cultures/index.js';
import { FORMS } from '../form/towns.js';
import { readForm } from '../form/schema.js';
import { CELL, C } from '../layout-kit.js';
import { orientBox } from '../assets/kit.js';
import { placeOf, availableAt } from '../ledger/index.js';
import { solveContext } from './context.js';
import { seatArmature, claimSite, layArmature } from './armature.js';
import { ENCLOSURES } from './enclosure.js';
import { layStreets } from './streets.js';
import { placementItems, layPlacement } from './placement.js';
import { layLots, layLand, activitiesOf } from './land.js';
import { layViews, SCENES, SLICE, SLICE_FOCI } from './views.js';
import { emitPlan } from './emit.js';
import { ledgerOf, lawsOf } from './laws.js';

export { SCENES, SLICE, SLICE_FOCI, activitiesOf };

/** A culture's form and kit, checked: `form` (a document or `{ from, … }`) overrides the culture's own. */
export function formOf(culture, form) {
  if (!HISTORIC_CULTURES[culture]) throw new Error(`historic: unknown culture '${culture}' — one of ${Object.keys(HISTORIC_CULTURES).map((c) => `'${c}'`).join(', ')}`);
  // a culture with no form of its own is laid out by the form its card names (`form: '<culture>'`: a scaffold's `--like`)
  const own = FORMS[culture] ? culture : HISTORIC_CULTURES[culture].form;
  if (!FORMS[own]) throw new Error(`historic: ${culture} has no form, and its card names none ('form: <culture>')`);
  return form ? readForm(form.from ? form : { from: own, ...form }, FORMS) : FORMS[own];
}

/** What a slice of life may be cut round, read off the form (no solve): its street, its monument, its water, what its
 *  enclosure offers (a gate, the market ward), and the activities in reach at the town's year. */
export function sliceFoci(culture, form = null) {
  const F = formOf(culture, form), inReach = new Set(availableAt(placeOf(culture)).map((r) => r.key));
  return ['street', 'monument', ...(F.water?.kind && F.water.kind !== 'none' ? ['water'] : []), ...ENCLOSURES[F.enclosure.kind].foci(F.enclosure),
    ...activitiesOf(culture, F, inReach).map((a) => a.id)];
}

/** Solve a historic scene: `{ culture, seed, scene, focus, form }` → the plan. */
export function solveHistoric({ culture = 'sumer', seed = 1, scene = 'city', focus = null, form = null } = {}) {
  if (!SCENES.includes(scene)) throw new Error(`historic: scene is one of ${SCENES.map((v) => `'${v}'`).join(', ')}`);
  const F = formOf(culture, form);
  const X = solveContext({ culture, seed, view: scene, focus, F });
  X.ENC = ENCLOSURES[F.enclosure.kind];
  seatArmature(X);
  claimSite(X);
  layArmature(X);
  X.ENC.lay(X);
  placementItems(X);
  layPlacement(X, 'before');
  layStreets(X);
  layPlacement(X, 'after');
  layLots(X);
  layPlacement(X, 'lots');
  layLand(X);
  layViews(X);
  emitPlan(X);
  const ledger = ledgerOf(X), laws = lawsOf(X);

  const { M, mRect, mFacing, mcx, mcy, win, view, activities, square, precinct, monuments, slots, houseAssets, borrowed, grid, gates, water, mvRect } = X;
  const [MW, MD] = M.size;
  return {
    boxes: X.placedBoxes, grounds: X.placedGrounds, views: X.views, slots: X.outSlots, frame: { w: win.w, d: win.d },
    hAt: X.H0, focus: M.focus ? (() => { const [fx, fy] = M.focus(MW, MD); const r = orientBox({ x: fx, y: fy, w: 0, d: 0 }, mRect, mFacing); return [r.x - win.x, r.y - win.y]; })() : [mcx - win.x, mcy - win.y],
    ...(X.reps.length ? { repeats: X.reps } : {}),
    world: { boxes: [], skirt: view === 'slice' ? null : { width: 120, cell: 20, fill: X.groundFill, ...(water.kind !== 'none' ? { waterZ: water.z, water: X.waterFill } : {}) } },
    stats: {
      culture, scene, focus: view === 'slice' ? (focus ?? activities[0]?.id ?? 'street') : null, form: F.label ?? null,
      houses: slots.filter((s) => houseAssets.has(s.asset)).length, precinct: mvRect(precinct), ...(square ? { square: mvRect(square) } : {}),
      monuments: monuments.map((m) => ({ ...m, rect: mvRect(m.rect) })),
      activities: activities.map((a) => ({ id: a.id, read: a.read, rect: mvRect(a.rect) })),
      foci: Object.keys(X.foci), trees: X.trees, laneCells: grid.reduce((n, v) => n + (v === C.LANE ? 1 : 0), 0),
      gates: gates.length, borrowed: [...new Set(slots.map((s) => borrowed[s.asset]).filter(Boolean))],
    },
    grid: { cols: X.cols, rows: X.rows, cell: CELL, data: grid, codes: C, origin: [win.x, win.y] },
    form: F, ledger, laws, notes: X.notes,
  };
}
