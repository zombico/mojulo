// Graceful degradation — the placer reads, the assessor checks. A card authored for one unit
// size is fit into another by looping on the assessor's FIXABLE invariants and applying the
// cheapest declared action: split a run around the door throat, shift a point or the counter,
// or shed in SHED_RANK order (a small unit sheds feature podiums before it sheds the aisle).
// Every action is stamped in the report; a card already clean exits on iteration 0, so its
// output is byte-identical to the undegraded fit-out.

import { assessStoreConcept } from './store-assess.js';

// shed first → last; the counter is never shed (a store without a cash wrap is not a store)
export const SHED_RANK = {
  plant: 0, podium: 1, mannequin: 1, tableSet: 2, stool: 3, queueRail: 3, rackRun: 4, gondola: 4,
  banquette: 5, tillPoint: 5, hangerRun: 6, shelfWall: 6, fridgeCase: 6, backBar: 6, counter: 99,
};
const rank = (p) => SHED_RANK[p.archetype] ?? 4;
const FIXABLE = /^(entry-decompression|fixture-overlap|pierces-glass|fixture-out-of-bounds|cashwrap-sightline|aisle-to-|aisle-through|staff-to-)/;

/**
 * placements / cast: resolved footprints (sales-local feet). Returns the degraded copies and
 * the action log. `ctx` = { salesFrame, entry, cells } — what the assessor needs.
 */
export function degradeFitOut(card, placements, cast, ctx, { maxIter = 60 } = {}) {
  let P = placements.map((p) => ({ ...p }));
  let C = cast.map((c) => ({ ...c }));
  const actions = [];
  const { W, D } = ctx.salesFrame;
  const assess = (pp, cc) => assessStoreConcept(card, { salesFrame: ctx.salesFrame, entry: ctx.entry, through: ctx.through, sub: { cells: ctx.cells }, fitOut: { placements: pp, cast: cc } });
  const invOf = (r) => r.findings.filter((f) => f.severity === 'invariant' && FIXABLE.test(f.id));
  const drop = (o, why) => {
    // downsize before shed: step to the next smaller declared footprint, re-centred in place
    const sizes = o.row?.decl?.sizes;
    const keys = sizes ? Object.keys(sizes) : [];
    const next = keys[keys.indexOf(o.variant) + 1];
    if (next) {
      const [w, d] = sizes[next], cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
      Object.assign(o, { variant: next, x0: cx - w / 2, x1: cx + w / 2, y0: cy - d / 2, y1: cy + d / 2 });
      actions.push({ action: 'downsize', archetype: o.archetype, to: next, why });
      return;
    }
    actions.push({ action: 'shed', archetype: o.archetype, why });
    if (o.row?.decl?.cast) C = C.filter((c) => c !== o); else P = P.filter((p) => p !== o);
    if (o.archetype === 'counter') return;
  };
  const shift = (o, dx, dy, why) => { o.x0 += dx; o.x1 += dx; o.y0 += dy; o.y1 += dy; actions.push({ action: 'shift', archetype: o.archetype, by: [+dx.toFixed(2), +dy.toFixed(2)], why }); };
  const isRun = (o) => !o.row?.decl?.cast && o.row?.decl?.shape === 'run';
  // cut the span [c0, c1] out of a run along its axis, keeping the longer remainder (≥ 2 ft)
  const trimOut = (o, c0, c1, why) => {
    const ax = o.along === 'y' ? ['y0', 'y1'] : ['x0', 'x1'];
    const lo = [o[ax[0]], Math.min(o[ax[1]], c0)], hi = [Math.max(o[ax[0]], c1), o[ax[1]]];
    const keep = (lo[1] - lo[0]) >= (hi[1] - hi[0]) ? lo : hi;
    if (keep[1] - keep[0] < 2) return false;
    o[ax[0]] = keep[0]; o[ax[1]] = keep[1];
    actions.push({ action: 'trim', archetype: o.archetype, to: +(keep[1] - keep[0]).toFixed(2), why });
    return true;
  };
  const fits = (o) => o.x0 >= -0.01 && o.x1 <= W + 0.01 && o.y0 >= -0.01 && o.y1 <= D + 0.01;

  let r = assess(P, C);
  for (let it = 0; it < maxIter; it += 1) {
    const inv = invOf(r);
    if (!inv.length) break;
    let acted = false;
    for (const f of inv) {
      const subj = (f.refs || []).map((k) => r.obstacles[k]).filter(Boolean);
      if (f.id === 'entry-decompression') {
        const t = r.debug.throat;
        for (const o of subj.sort((a, b) => rank(a) - rank(b))) {
          const isCast = !!o.row?.decl?.cast;
          if (!isCast && o.row.decl.shape === 'run' && o.along === 'x' && o.x1 - o.x0 > (t.x1 - t.x0) + 3) {
            // split the run around the throat: two runs, each ≥ 1.5 ft
            const a = { ...o, x1: t.x0 - 0.2 }, b = { ...o, x0: t.x1 + 0.2 };
            P = P.filter((p) => p !== o);
            for (const s of [a, b]) if (s.x1 - s.x0 >= 1.5) P.push(s);
            actions.push({ action: 'split', archetype: o.archetype, why: f.id });
          } else if (!isCast && o.row.decl.shape === 'run' && trimOut(o, o.along === 'y' ? t.y0 : t.x0 - 0.2, o.along === 'y' ? t.y1 + 0.2 : t.x1 + 0.2, f.id)) {
            // trimmed clear of the throat
          } else {
            // push the point fixture out of the throat, toward the side with more room
            const w = o.x1 - o.x0;
            const left = t.x0 - 0.1 - w, right = t.x1 + 0.1;
            const dx = (left >= 0 && (right + w > W || (t.x0 - 0) >= (W - t.x1))) ? left - o.x0 : right - o.x0;
            const moved = { ...o, x0: o.x0 + dx, x1: o.x1 + dx };
            if (fits(moved)) shift(o, dx, 0, f.id); else drop(o, f.id);
          }
          acted = true; break;
        }
      } else if (f.id === 'fixture-overlap') {
        const [a, b] = subj;
        const loser = rank(a) === rank(b) ? (P.indexOf(a) > P.indexOf(b) ? a : b) : (rank(a) < rank(b) ? a : b);
        const winner = loser === a ? b : a;
      const ax = loser.along === 'y' ? ['y0', 'y1'] : ['x0', 'x1'];
      if (!(isRun(loser) && trimOut(loser, winner[ax[0]] - 0.2, winner[ax[1]] + 0.2, f.id))) drop(loser, f.id);
      acted = true;
      } else if (f.id === 'pierces-glass' || f.id === 'fixture-out-of-bounds') {
        const o = subj[0];
        const dx = o.x0 < 0 ? -o.x0 : o.x1 > W ? W - o.x1 : 0, dy = o.y0 < 0 ? -o.y0 : o.y1 > D ? D - o.y1 : 0;
        const moved = { ...o, x0: o.x0 + dx, x1: o.x1 + dx, y0: o.y0 + dy, y1: o.y1 + dy };
        if (fits(moved)) shift(o, dx, dy, f.id); else drop(o, f.id);
        acted = true;
      } else if (f.id === 'cashwrap-sightline') {
        const o = subj.sort((a, b) => rank(a) - rank(b))[0];
        if (o && rank(o) < 99) { drop(o, f.id); acted = true; }
      } else {
        // aisle / staff path: first move the counter forward (staff room behind it), then the
        // single cheapest removal that clears this finding, else shed the cheapest candidate
        const counter = P.find((p) => p.archetype === 'counter');
        if (f.id.startsWith('staff-to-') && counter) {
          for (let step = 0.5; step <= 4 && !acted; step += 0.5) {
            const trial = P.map((p) => (p === counter || p.entry?.along === 'counter' ? { ...p, y0: p.y0 - step, y1: p.y1 - step } : p));
            const tr = assess(trial, C);
            if (!tr.findings.some((g) => g.id === f.id) && invOf(tr).length <= invOf(r).length) {
              for (const p of P) if (p === counter || p.entry?.along === 'counter') { p.y0 -= step; p.y1 -= step; }
              actions.push({ action: 'shift', archetype: 'counter', by: [0, -step], why: f.id });
              acted = true;
            }
          }
        }
        if (!acted && f.id === 'aisle-through' && counter) {
          // slide the counter (and its stools) sideways off the through-route, smallest move first
          for (let step = 1; step <= W / 2 && !acted; step += 1) {
            for (const dx of [step, -step]) {
              const moved = P.map((p) => (p === counter || p.entry?.along === 'counter' ? { ...p, x0: p.x0 + dx, x1: p.x1 + dx } : p));
              if (moved.some((p) => (p.archetype === 'counter' || p.entry?.along === 'counter') && (p.x0 < 0 || p.x1 > W))) continue;
              const tr = assess(moved, C);
              if (!tr.findings.some((g) => g.id === f.id) && invOf(tr).length < invOf(r).length) {
                for (const p of P) if (p === counter || p.entry?.along === 'counter') { p.x0 += dx; p.x1 += dx; }
                actions.push({ action: 'shift', archetype: 'counter', by: [dx, 0], why: f.id });
                acted = true; break;
              }
            }
          }
        }
        if (!acted) {
          const all = [...P, ...C];
          const cands = all.filter((o) => rank(o) < 99 && !o.row?.decl?.overhead && !o.row?.decl?.wallHung)
            .sort((a, b) => rank(a) - rank(b) || all.indexOf(b) - all.indexOf(a));
          const clears = (pp, cc) => !assess(pp, cc).findings.some((g) => g.id === f.id);
          // (1) a cheap feature (plant, podium, mannequin, table set) whose removal clears it
          const cheap = cands.filter((o) => rank(o) <= 2).find((o) => clears(P.filter((p) => p !== o), C.filter((c) => c !== o)));
          if (cheap) { drop(cheap, f.id); acted = true; }
          // (2) the smallest trim of one run that clears it (1 ft steps from either end)
          if (!acted) {
            let best = null;
            for (const o of cands.filter(isRun)) {
              const ax = o.along === 'y' ? ['y0', 'y1'] : ['x0', 'x1'];
              const len = o[ax[1]] - o[ax[0]];
              for (let cut = 1; cut <= len - 2 && (!best || cut < best.cut); cut += 1) {
                for (const end of [0, 1]) {
                  const t = { ...o };
                  if (end) t[ax[1]] -= cut; else t[ax[0]] += cut;
                  if (clears(P.map((p) => (p === o ? t : p)), C)) { best = { o, t, cut }; break; }
                }
              }
            }
            if (best) {
              Object.assign(best.o, { x0: best.t.x0, x1: best.t.x1, y0: best.t.y0, y1: best.t.y1 });
              actions.push({ action: 'trim', archetype: best.o.archetype, cut: best.cut, why: f.id });
              acted = true;
            }
          }
          // (3) the cheapest single removal that clears it, else shed the cheapest candidate
          if (!acted) {
            const fixer = cands.find((o) => clears(P.filter((p) => p !== o), C.filter((c) => c !== o)));
            if (fixer) { drop(fixer, f.id); acted = true; } else if (cands.length) { drop(cands[0], f.id); acted = true; }
          }
        }
      }
      if (acted) break;
    }
    if (!acted) break;
    r = assess(P, C);
  }
  return { placements: P, cast: C, actions };
}
