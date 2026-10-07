/**
 * furnishings/forms — composed furniture: a piece is a KIND, one FORM in each of its slots, a FINISH and a size, the
 * way a bug is a bauplan (bugs/forms.js). The workbench builds (construction/furniture-builds.js) are the kernel: a
 * kind turns a footprint and its forms into a build's dials, and the build makes the members, padding and cloth.
 *
 *   kind      sofa | chair | table | casework — which build, which slots, the size it defaults to
 *   forms     one per slot, by name: { arms: 'rolled-high', back: 'tufted', seat: 'bench', legs: 'turned' }
 *   finish    what it is made of, apart from its shape: fabric (a cloth preset or spec), timber (a species), wood (a
 *             timber finish: 'oil', 'wax', …), tint (a timber colour), board (a sheet material), paint (its colour),
 *             piping (true, false or a colour)
 *   size      [w, d, h] millimetres, the piece's own; the kind derives what follows from it (a sofa's seat count, a
 *             chest's drawers)
 *
 * A STYLE is a worked piece over the same grammar (a chesterfield is a sofa with high rolled arms, a tufted back, a
 * bench seat, in velvet); the facades a room places are the first styles. `resolveFurniture` takes a style to start
 * from, swaps in any forms and finish asked for, and LOCKS the result: the build's resolved dials, its cloth, tint and
 * legs, and its size — so a locked piece re-renders identically however the forms and styles here are retuned later.
 * The build kernel is the only thing a locked piece depends on, and it is already a compatibility promise.
 *
 * Leg forms other than `block` change only what is drawn (construction/facades.js): a turned or tapered leg is turned
 * from the square blank the build cuts, so the members, joints and cut list stay the blank's.
 */
import { expandBuild, LEG_SHAPES } from '../construction/furniture-builds.js';
import { fabricError } from '../construction/fabric.js';
import { TIMBER_KEYS, FINISHES as TIMBER_FINISHES } from '../construction/timber.js';
import { SHEET_KEYS } from '../construction/sheets.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const HEX = /^#[0-9a-f]{6}$/i;

// ── the slots ───────────────────────────────────────────────────────────────────────────────────────────────────
// A form is the build dials it sets. A function form reads the footprint (mm) — a chest's drawers follow its height.
// `armH: 'back'` stands the arms as high as the back (the sofa kind resolves it against the height).

export const ARM_FORMS = {
  track: { arms: 'track' },
  rolled: { arms: 'rolled' },
  tuxedo: { arms: 'track', armH: 'back' },
  'rolled-high': { arms: 'rolled', armH: 'back' },
  none: { arms: 'none' },
};
export const BACK_FORMS = {
  loose: { back: 'loose' },
  tight: { back: 'tight' },
  tufted: { back: 'tufted' },
};
export const SEAT_FORMS = {
  loose: { cushions: 'loose' },
  bench: { cushions: 'bench' },
};
// drawn, not built: the blank stays square in the build (see the header)
export const LEG_FORMS = Object.fromEntries(LEG_SHAPES.map((k) => [k, {}]));
export const FRONT_FORMS = {
  open: {},
  doors: { doors: 2, shelves: 1 },
  'doors-over-drawer': { doors: 2, drawers: 1, drawerHeight: 150, shelves: 1 },
  drawers: (W, D, H) => { const n = clamp(Math.round((H - 80) / 190), 2, 6); return { drawers: n, drawerHeight: (H - 80) / n }; },
  'two-drawers': (W, D, H) => ({ drawers: 2, drawerHeight: (H - 80) / 2 }),
};

/** A sofa's dials for a footprint (mm): as many seats of about 720 mm as the width takes, the depth closed in two passes. */
function sofaDials(W, D, H, extra = {}) {
  const arms = extra.arms || 'track', armW = arms === 'none' ? 0 : arms === 'rolled' ? 180 : 150;
  const seats = extra.seats || clamp(Math.round((W - 2 * armW) / 720), 1, 4);
  const backH = clamp(H, 680, 1000);
  const b = { type: 'sofa', ...extra, seats, arms, seatW: Math.max(420, (W - 2 * armW) / seats), backH, seatH: Math.min(440, backH - 260), armH: extra.armH ? Math.min(extra.armH, backH) : Math.min(620, backH - 60) };
  const d0 = expandBuild({ unit: 'mm', build: { ...b, seatD: 560 } }).dials.sizeMm[1];
  return { ...b, seatD: clamp(560 + (D - d0), 420, 720) };
}

// The kinds: the build each makes, its slots (the first form of each is its default), the size it defaults to (mm), and
// footprint + chosen dials → the build.
export const FURNITURE_KINDS = {
  sofa: {
    build: 'sofa', slots: { arms: ARM_FORMS, back: BACK_FORMS, seat: SEAT_FORMS, legs: LEG_FORMS }, size: [2130, 915, 820],
    dials: (W, D, H, set) => sofaDials(W, D, H, set.armH === 'back' ? { ...set, armH: H } : set),
  },
  chair: {
    build: 'chair', slots: { legs: LEG_FORMS }, size: [457, 488, 884],
    dials: (W, D, H, set) => ({ type: 'chair', w: W, d: D, seat: Math.min(450, H * 0.55), back: H, ...set }),
  },
  table: {
    build: 'table', slots: { legs: LEG_FORMS }, size: [1830, 975, 760],
    dials: (W, D, H, set) => ({ type: 'table', w: W, d: D, h: H, ...set }),
  },
  casework: {
    build: 'carcass', slots: { front: FRONT_FORMS }, size: [1520, 490, 850],
    dials: (W, D, H, set) => ({ type: 'carcass', w: W, d: D, h: H, ...set }),
  },
};

// ── the finish ──────────────────────────────────────────────────────────────────────────────────────────────────
// Which finish keys each kind wears: the cloth on what is upholstered, timber on what is timber, board on casework.
const WEARS = {
  sofa: ['fabric', 'timber', 'tint', 'piping'],
  chair: ['timber', 'wood', 'tint'],
  table: ['timber', 'wood', 'tint'],
  casework: ['board', 'wood', 'paint'],
};
export const FINISH_KEYS = ['fabric', 'timber', 'wood', 'tint', 'board', 'paint', 'piping'];

/** Why a finish is malformed for a kind → string[]. A key the kind does not wear is named, never silently dropped. */
export function finishErrors(kind, finish = {}) {
  const e = [];
  if (!finish || typeof finish !== 'object') return ['finish: { fabric?, timber?, wood?, tint?, board?, paint?, piping? }'];
  for (const k of Object.keys(finish)) {
    if (!FINISH_KEYS.includes(k)) e.push(`finish.${k}: not a finish (${FINISH_KEYS.join(', ')})`);
    else if (!WEARS[kind].includes(k)) e.push(`finish.${k}: a ${kind} wears ${WEARS[kind].join(', ')}`);
  }
  if (finish.fabric !== undefined && fabricError(finish.fabric)) e.push(`finish.${fabricError(finish.fabric)}`);
  if (finish.timber !== undefined && !TIMBER_KEYS.includes(finish.timber)) e.push(`finish.timber: one of ${TIMBER_KEYS.join(', ')}`);
  if (finish.wood !== undefined && !TIMBER_FINISHES[finish.wood]) e.push(`finish.wood: one of ${Object.keys(TIMBER_FINISHES).join(', ')}`);
  if (finish.board !== undefined && !SHEET_KEYS.includes(finish.board)) e.push(`finish.board: one of ${SHEET_KEYS.join(', ')}`);
  for (const k of ['tint', 'paint']) if (finish[k] !== undefined && !HEX.test(finish[k])) e.push(`finish.${k}: '#rrggbb'`);
  if (finish.piping !== undefined && typeof finish.piping !== 'boolean' && !HEX.test(finish.piping)) e.push("finish.piping: true, false or '#rrggbb'");
  return e;
}

/** A house style's palette ({ upholstery, wood, cabinet }) as a finish for a kind: the cloth woven in its colour, the
 *  timber tinted, the casework in painted board — each only where the kind wears it (a palette colours a whole house).
 *  Keys the palette does not name stay the piece's own. */
export function paletteFinish(palette, kind) {
  if (!palette) return {};
  const all = {
    ...(typeof palette.upholstery === 'string' ? { fabric: { preset: 'linen', warp: palette.upholstery } } : {}),
    ...(typeof palette.wood === 'string' ? { tint: palette.wood } : {}),
    ...(palette.cabinet ? { board: 'mfc', paint: palette.cabinet } : {}),
  };
  return Object.fromEntries(Object.entries(all).filter(([k]) => WEARS[kind].includes(k)));
}

// ── the styles ──────────────────────────────────────────────────────────────────────────────────────────────────
// A worked piece: its kind, forms, finish, size, and `over` — build dials of its own (a coffee table's thick top, an
// armchair's single seat; a function reads the footprint). The first eleven are the facades a room places
// (construction/facades.js); their recipes are pinned there, byte for byte.
export const FURNITURE_STYLES = {
  sofa: { label: 'sofa', kind: 'sofa', forms: {}, finish: { fabric: 'herringbone' }, size: [2130, 915, 820] },
  armchair: { label: 'armchair', kind: 'sofa', forms: {}, finish: { fabric: 'boucle' }, size: [880, 880, 790], over: { seats: 1 } },
  chesterfield: {
    label: 'chesterfield', kind: 'sofa', forms: { arms: 'rolled-high', back: 'tufted', seat: 'bench' }, finish: { fabric: 'velvet' }, size: [2190, 945, 760],
    note: 'arms rolled as high as the back, the back buttoned in a diamond, one long seat',
  },
  'coffee-table': {
    label: 'coffee table', kind: 'table', forms: {}, finish: { timber: 'walnut', wood: 'oil' }, size: [1220, 610, 455],
    over: (W, D, H) => ({ top: 30, leg: 45, apron: Math.min(80, H * 0.2), overhang: 25 }),
  },
  'dining-table': { label: 'dining table', kind: 'table', forms: {}, finish: { timber: 'oak', wood: 'oil' }, size: [1830, 975, 760] },
  chair: { label: 'chair', kind: 'chair', forms: {}, finish: { timber: 'beech', wood: 'oil' }, size: [457, 488, 884] },
  bookcase: { label: 'bookcase', kind: 'casework', forms: { front: 'open' }, finish: { board: 'plywood', wood: 'oil' }, size: [915, 335, 1830] },
  'media-console': { label: 'media console', kind: 'casework', forms: { front: 'doors' }, finish: { board: 'plywood', wood: 'oil' }, size: [1675, 455, 550] },
  sideboard: { label: 'sideboard', kind: 'casework', forms: { front: 'doors-over-drawer' }, finish: { board: 'plywood', wood: 'oil' }, size: [1525, 490, 855] },
  chest: { label: 'chest of drawers', kind: 'casework', forms: { front: 'drawers' }, finish: { board: 'plywood', wood: 'oil' }, size: [1035, 490, 1035] },
  nightstand: { label: 'nightstand', kind: 'casework', forms: { front: 'two-drawers' }, finish: { board: 'plywood', wood: 'oil' }, size: [490, 425, 580] },

  // ── composed from the same forms ──
  tuxedo: {
    label: 'tuxedo sofa', kind: 'sofa', forms: { arms: 'tuxedo', back: 'tight' }, finish: { fabric: 'twill' }, size: [2135, 915, 760],
    note: 'arms the height of the back, one continuous line round the seat',
  },
  'english-roll-arm': {
    label: 'English roll-arm sofa', kind: 'sofa', forms: { arms: 'rolled', back: 'tight', legs: 'turned' }, finish: { fabric: 'linen' }, size: [2080, 940, 840],
    note: 'low rolled arms set back, a tight back, loose seat cushions, turned front legs',
  },
  'mid-century-sofa': {
    label: 'mid-century sofa', kind: 'sofa', forms: { back: 'tight', seat: 'bench', legs: 'tapered' }, finish: { fabric: 'twill', timber: 'walnut' }, size: [2030, 860, 790],
    note: 'track arms, a tight back over one bench cushion, raised on tapered legs',
  },
  settee: {
    label: 'armless settee', kind: 'sofa', forms: { arms: 'none', back: 'tight', seat: 'bench', legs: 'hairpin' }, finish: { fabric: 'boucle' }, size: [1520, 790, 760],
    note: 'no arms, a tight back, one bench cushion, on steel hairpin legs',
  },
  'club-chair': {
    label: 'club chair', kind: 'sofa', forms: { arms: 'rolled', back: 'tight', legs: 'bun' }, finish: { fabric: 'velvet' }, size: [890, 910, 800], over: { seats: 1 },
    note: 'a deep single seat with rolled arms and a tight back, on bun feet',
  },
  'farmhouse-table': {
    label: 'farmhouse table', kind: 'table', forms: { legs: 'turned' }, finish: { timber: 'pine', wood: 'wax' }, size: [2130, 965, 765],
    over: { top: 38, leg: 75, apron: 110 },
    note: 'a thick top over a deep apron, on heavy turned legs',
  },
  'mid-century-table': {
    label: 'mid-century dining table', kind: 'table', forms: { legs: 'tapered' }, finish: { timber: 'walnut', wood: 'oil' }, size: [1830, 915, 750],
    over: { top: 25, leg: 50, apron: 70 },
  },
  'windsor-side-chair': {
    label: 'turned side chair', kind: 'chair', forms: { legs: 'turned' }, finish: { timber: 'ash', wood: 'oil' }, size: [460, 470, 900],
  },
  'painted-dresser': {
    label: 'painted chest of drawers', kind: 'casework', forms: { front: 'drawers' }, finish: { board: 'mfc', paint: '#5d7a73' }, size: [915, 460, 860],
  },
};

// ── resolving and locking ───────────────────────────────────────────────────────────────────────────────────────

const formOf = (slots, slot, name) => {
  const table = slots[slot];
  if (!table) throw new Error(`furniture: no slot '${slot}' (${Object.keys(slots).join(', ') || 'no slots'})`);
  if (!(name in table)) throw new Error(`furniture: ${slot} '${name}' is not one of ${Object.keys(table).join(', ')}`);
  return table[name];
};

/** The finish as the build's dials and the recipe's cloth and tint. */
function wear(kind, finish) {
  const build = {}, rec = {};
  if (finish.fabric !== undefined) rec.fabric = finish.fabric;
  if (finish.tint !== undefined) rec.tint = finish.tint;
  if (finish.piping !== undefined) build.piping = finish.piping;
  if (kind === 'casework') {
    if (finish.board !== undefined) build.material = finish.board;
    if (finish.paint !== undefined) build.finish = { paint: finish.paint };
    else if (finish.wood !== undefined) build.finish = finish.wood;
  } else {
    if (finish.timber !== undefined) build.species = finish.timber;
    if (finish.wood !== undefined) build.finish = finish.wood;
  }
  return { build, rec };
}

/**
 * Compose a piece and lock it.
 *   resolveFurniture({ like?, kind?, forms?, finish?, size?, palette? })
 * `like` names a style to start from (FURNITURE_STYLES); without it `kind` starts from the kind's defaults. `forms` and
 * `finish` swap over the style's, slot by slot and key by key; `size` is [w, d, h] mm; `palette` is a house style's
 * (applied over the finish, as a room does). Throws, naming what is valid, on an unknown style, kind, slot, form or
 * finish.
 * → { locked: { kind, build, legs, sizeMm, fabric?, tint? }, basis, worn, forms, finish }
 */
export function resolveFurniture({ like = null, kind = null, forms = {}, finish = {}, size = null, palette = null } = {}) {
  const style = like ? FURNITURE_STYLES[like] : null;
  if (like && !style) throw new Error(`furniture: no style '${like}' (${Object.keys(FURNITURE_STYLES).join(', ')})`);
  const k = style ? style.kind : kind;
  if (style && kind && kind !== style.kind) throw new Error(`furniture: '${like}' is a ${style.kind}, not a ${kind}`);
  const K = FURNITURE_KINDS[k];
  if (!K) throw new Error(`furniture: kind one of ${Object.keys(FURNITURE_KINDS).join(', ')} (or a style to start from)`);
  const chosen = {}, worn = [];
  for (const slot of Object.keys(K.slots)) chosen[slot] = Object.keys(K.slots[slot])[0];
  Object.assign(chosen, style ? style.forms : {});
  for (const [slot, name] of Object.entries(forms || {})) {
    formOf(K.slots, slot, name);
    if (chosen[slot] !== name) worn.push(slot);
    chosen[slot] = name;
  }
  const fin = { ...(style ? style.finish : {}), ...(finish || {}), ...paletteFinish(palette, k) };
  const errs = finishErrors(k, fin);
  if (errs.length) throw new Error(`furniture: ${errs.join('; ')}`);
  for (const key of Object.keys(finish || {})) if (!style || JSON.stringify(style.finish[key]) !== JSON.stringify(finish[key])) worn.push(`finish.${key}`);
  const [W, D, H] = Array.isArray(size) && size.length === 3 && size.every((v) => Number.isFinite(v) && v > 0) ? size : (style ? style.size : K.size);
  // the dials the forms set, in slot order, then the style's own, then the finish's
  const set = {};
  for (const [slot, name] of Object.entries(chosen)) {
    const f = formOf(K.slots, slot, name);
    Object.assign(set, typeof f === 'function' ? f(W, D, H) : f);
  }
  const over = style && style.over ? (typeof style.over === 'function' ? style.over(W, D, H) : style.over) : {};
  const w = wear(k, fin);
  const build = K.dials(W, D, H, { ...set, ...over, ...w.build });
  return {
    locked: { kind: k, build, legs: chosen.legs || 'block', sizeMm: [W, D, H], ...w.rec },
    basis: like, worn, forms: chosen, finish: fin,
  };
}

/** A style at a footprint (mm), in a house palette → the frame recipe the facades lower (construction/facades.js). */
export function styleFrame(like, W, D, H, palette = null) {
  const { locked } = resolveFurniture({ like, size: [W, D, H], palette });
  return { build: locked.build, ...(locked.fabric !== undefined ? { fabric: locked.fabric } : {}), ...(locked.tint !== undefined ? { tint: locked.tint } : {}), ...(locked.legs !== 'block' ? { legs: locked.legs } : {}) };
}
