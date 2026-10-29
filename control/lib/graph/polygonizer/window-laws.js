/**
 * THE WINDOW LAWS (a home's windows, home-windows.js): what an architect checks on the drawings, measured on the
 * storeys as built. Each law advises, as every gate here does: it says what it found and where, never refuses.
 *
 *   daylight    every room that needs light has glazing of at least the code's 8% of its floor (IRC R303.1); its own
 *               target (home-windows.js DAYLIGHT) is said beside it
 *   egress      every bedroom has a unit it can be left by (IRC R310: 5.7 sf clear, 20 in wide, 24 in high, sill
 *               at most 44 in)
 *   blind       a room that needs none (a store, a laundry, a hall) has none
 *   stacking    on a facade, every window above the ground stands on an axis of the storey below (the windows line up:
 *               the load path runs down piers, a header over every opening); the share standing over a window below
 *               (void over void) is said
 *   head        one head line per storey
 *   corners     every window at least CORNER clear of the facade's ends
 *   rhythm      at most two unit widths per facade per storey
 *   glazing     each facade's share of glass in its wall (said; the traditional home ~15–20%, modern to ~40%)
 *
 *   windowLaws(levels) → { ok, laws: [{ id, ok, says }], facades: [{ side, storey, windows, glazed }] }
 *   levels: [{ index, height, structure: { wallGraph } }] (structurizeHouse's, or one storey's)
 */
import { CORNER, DAYLIGHT, egressOf } from './home-windows.js';

const CODE = 0.08;
const r3 = (n) => Math.round(n * 1000) / 1000;

export function windowLaws(levels) {
  const facades = [], rooms = [];
  for (const L of levels) {
    const g = L.structure?.wallGraph;
    if (!g?.homeWindows) continue;
    const fp = g.footprint, h = L.height ?? 9;
    const sides = { N: ['h', fp.y0, fp.x0, fp.x1], S: ['h', fp.y1, fp.x0, fp.x1], W: ['v', fp.x0, fp.y0, fp.y1], E: ['v', fp.x1, fp.y0, fp.y1] };
    for (const [side, [orient, at, lo, hi]] of Object.entries(sides)) {
      const wins = g.runs.filter((r) => !r.interior && r.orientation === orient && Math.abs(r.at - at) < 0.75)
        .flatMap((r) => (r.openings || []).filter((op) => op.sill > 0.01).map((op) => ({ a: op.a, b: op.b, mid: (op.a + op.b) / 2, w: op.b - op.a, sill: op.sill, top: op.top, off: !!op.offGrid })));
      const glazed = wins.reduce((n, w) => n + w.w * (w.top - w.sill), 0);
      facades.push({ side, storey: L.index, lo, hi, axes: g.homeWindows.axes[side] || [], windows: wins, glazed: r3(glazed / ((hi - lo) * h)) });
    }
    for (const r of g.homeWindows.rooms) rooms.push({ ...r, storey: L.index });
  }
  const laws = [];
  // the rooms
  // (the code holds the habitable rooms to it; a hall's earned light is said, not held)
  const lit = rooms.filter((r) => r.need === 'yes' || r.need === 'egress' || r.need === 'preferred');
  const dark = lit.filter((r) => r.glazing / r.area < CODE - 1e-9);
  laws.push({ id: 'daylight', ok: !dark.length, says: dark.length ? dark.map((r) => `${r.glyph} on storey ${r.storey}: ${(100 * r.glazing / r.area).toFixed(1)}% glazed, the code asks 8% (its target ${Math.round(100 * (DAYLIGHT[r.glyph] ?? 0.1))}%)`).join('; ') : `every room that needs light clears 8%` });
  // (a mulled pair is two units: each opens as one)
  const beds = rooms.filter((r) => r.need === 'egress'), trapped = beds.filter((r) => !r.units.some((u) => egressOf(u.style, u.pair ? u.w / 2 : u.w, u.top - u.sill, u.sill).ok));
  laws.push({ id: 'egress', ok: !trapped.length, says: trapped.length ? trapped.map((r) => `a bedroom on storey ${r.storey} has no window to leave by`).join('; ') : `every bedroom (${beds.length}) has a window to leave by` });
  const lit2 = rooms.filter((r) => r.need === 'no' && r.glyph !== 'W' && r.units.length);
  laws.push({ id: 'blind', ok: !lit2.length, says: lit2.length ? lit2.map((r) => `${r.glyph} on storey ${r.storey} needs no window and has ${r.units.length}`).join('; ') : 'no store, laundry or hall is glazed' });
  // the facades
  let over = 0, upper = 0, aligned = 0;
  for (const f of facades) {
    const below = facades.find((x) => x.side === f.side && x.storey === f.storey - 1 && Math.abs(x.lo - f.lo) < 0.5 && Math.abs(x.hi - f.hi) < 0.5);
    if (!below) continue;
    for (const w of f.windows.filter((x) => !x.off)) {
      upper += 1;
      if (below.axes.some((x) => Math.abs(x - w.mid) < 0.5)) aligned += 1;
      if (below.windows.some((v) => !v.off && Math.abs(v.mid - w.mid) < 0.5)) over += 1;
    }
  }
  laws.push({ id: 'stacking', ok: aligned === upper, says: upper ? `${aligned} of ${upper} upper windows on an axis of the storey below; ${over} stand over a window (${Math.round(100 * over / upper)}% void over void)` : 'one storey: nothing to stack' });
  const heads = new Map();
  for (const f of facades) for (const w of f.windows) (heads.get(f.storey) || heads.set(f.storey, new Set()).get(f.storey)).add(w.top.toFixed(2));
  const split = [...heads].filter(([, s]) => s.size > 1);
  laws.push({ id: 'head', ok: !split.length, says: split.length ? split.map(([s, v]) => `storey ${s} has ${v.size} head heights`).join('; ') : 'one head line per storey' });
  const tight = facades.flatMap((f) => f.windows.filter((w) => w.a - f.lo < CORNER - 1e-6 || f.hi - w.b < CORNER - 1e-6).map(() => `${f.side} storey ${f.storey}`));
  laws.push({ id: 'corners', ok: !tight.length, says: tight.length ? `a window within ${CORNER} ft of a corner: ${[...new Set(tight)].join(', ')}` : `every window ${CORNER} ft or more from a corner` });
  const mixed = facades.filter((f) => new Set(f.windows.filter((w) => !w.off).map((w) => w.w.toFixed(2))).size > 2);
  laws.push({ id: 'rhythm', ok: !mixed.length, says: mixed.length ? mixed.map((f) => `${f.side} storey ${f.storey} mixes ${new Set(f.windows.map((w) => w.w.toFixed(2))).size} widths`).join('; ') : 'at most two unit widths a facade' });
  laws.push({ id: 'glazing', ok: true, says: facades.map((f) => `${f.side}${f.storey} ${Math.round(100 * f.glazed)}%`).join(' ') });
  return { ok: laws.every((l) => l.ok), laws, facades: facades.map(({ side, storey, windows, glazed }) => ({ side, storey, windows: windows.length, glazed })) };
}

