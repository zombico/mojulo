/**
 * interior/solve — the functional solver graph's walk. A room's program (its functions) is resolved in SOLVE_ORDER:
 * each function tries its strategies in order (interior/strategies.js); the first that qualifies (needs, when, unless)
 * and lays without refusal wins, its suggestions join the program, and the refused say why. A function nothing fills is
 * a gap. Then the operator's own word wins: a piece's size is asked before its group is laid (the group lays round it),
 * and a piece moved, turned or left out is moved, turned or left out after.
 *
 * Pure and seeded by nothing but its inputs: the same room and brief lay the same room.
 */
import { law } from './laws.js';
import { PIECES, MATTRESSES, BED_FRAME } from './pieces.js';
import { FUNCTIONS, ROOM_PROGRAMS, FIXTURE_ROOMS, SOLVE_ORDER, TAGS } from './functions.js';
import { strategiesFor, Refuse } from './strategies.js';
import { makeRoom, wallFrame, footprint, whyNot, put, onWall, solidSpans, passages, openShare, wayWhy, EDGES } from './place.js';
import { lengthMm } from './units.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** What a room measures to, in the closed buckets strategies qualify on. */
export function capabilitiesOf(R) {
  const area = (R.W * R.D) / 1e6;
  return {
    area,
    span: area < 12 ? 's' : area < 24 ? 'm' : 'l',
    shape: Math.max(R.W, R.D) / Math.min(R.W, R.D) > 1.6 ? 'long' : 'square',
  };
}

const qualifies = (s, caps, tags) => {
  if (s.needs?.span && !s.needs.span.includes(caps.span)) return `needs a ${s.needs.span.join(' or ')} room (this one is ${caps.span}, ${caps.area.toFixed(1)} m²)`;
  for (const t of s.when || []) if (!tags.includes(t)) return `wants the brief's '${t}'`;
  for (const t of s.unless || []) if (tags.includes(t)) return `not with '${t}'`;
  return null;
};

/** Daylight on each wall: the window width it carries, mm. */
function daylightOf(R) {
  const out = { N: 0, E: 0, S: 0, W: 0 };
  for (const o of R.openings) if (o.kind === 'window') out[o.wall] += o.b - o.a;
  return out;
}

/**
 * The focal point: the brief's (`'fireplace'`, a feature's id, a window's mark, a wall letter, `'view'`), else the
 * hearth, else for a room with a screen the longest solid wall that is no door's, else the widest window's wall.
 * → { edge, u, why, depth? }
 */
export function resolveFocal(R, asked, fns) {
  const day = daylightOf(R);
  const doorWalls = new Set(R.openings.filter((o) => o.kind === 'door').map((o) => o.wall));
  const mid = (edge) => wallFrame(R, edge).len / 2;
  const feature = (id) => R.features.find((f) => f.type === id || f.id === id);
  if (asked) {
    if (EDGES.includes(asked)) return { edge: asked, u: mid(asked), why: `the ${asked} wall, as asked` };
    const f = feature(asked);
    if (f) return { edge: f.wall, u: f.u, depth: f.depth, why: `the ${f.type}, as asked` };
    const win = R.openings.find((o) => o.tag === asked);
    if (win) { const [a, b] = wallFrame(R, win.wall).span(win.a, win.b); return { edge: win.wall, u: (a + b) / 2, why: `the ${win.kind} ${win.tag}, as asked` }; }
    if (asked === 'view') {
      const edge = [...EDGES].sort((a, b) => day[b] - day[a])[0];
      if (day[edge]) return { edge, u: mid(edge), why: 'the view: the widest windows' };
    }
  }
  const hearth = R.features.find((f) => f.type === 'fireplace');
  if (hearth) return { edge: hearth.wall, u: hearth.u, depth: hearth.depth, why: 'the fireplace' };
  if (fns.includes('media')) {
    // the media wall: a solid stretch that takes a screen and its console, no door's if it can be, no window's after
    const need = 1800;
    const best = [...EDGES].map((e) => ({ e, span: solidSpans(R, e)[0] })).filter((x) => x.span)
      .map((x) => ({ ...x, score: (x.span.len >= need ? 8 : 0) + (doorWalls.has(x.e) ? 0 : 2) + (day[x.e] ? 0 : 1) + x.span.len / 1e5 }))
      .sort((a, b) => b.score - a.score)[0];
    if (best) return { edge: best.e, u: (best.span.u0 + best.span.u1) / 2, why: `the media wall: its longest solid stretch, ${Math.round(best.span.len)} mm${doorWalls.has(best.e) ? ', beside the door' : ''}` };
  }
  const lit = [...EDGES].sort((a, b) => day[b] - day[a])[0];
  if (day[lit]) return { edge: lit, u: mid(lit), why: 'the view: the widest windows' };
  const long = [...EDGES].sort((a, b) => wallFrame(R, b).len - wallFrame(R, a).len)[0];
  return { edge: long, u: mid(long), why: 'the longest wall' };
}

/**
 * Solve a room.
 *   solveRoom(shell, { uses?, tags?, seats?, focal?, bed?, tv?, pieces? })
 * `pieces` are the operator's overrides by id: { id, size?, at?, facing?, omit?, piece? (an extra) }.
 * → { R, focal, placed, wall, resolved, gaps, notes, caps }
 */
export function solveRoom(shell, brief = {}) {
  const R = makeRoom(shell);
  const caps = capabilitiesOf(R);
  const glyph = shell.card?.glyph;
  const notes = [];
  const tags = (brief.tags || []).filter((t) => {
    if (TAGS[t]) return true;
    notes.push(`brief.tags: '${t}' is not a tag (${Object.keys(TAGS).join(', ')}); left out`);
    return false;
  });
  const program = ROOM_PROGRAMS[glyph];
  let uses = Array.isArray(brief.uses) && brief.uses.length ? brief.uses : (program ? program.uses : []);
  if (!program && !brief.uses?.length && FIXTURE_ROOMS[glyph]) notes.push(`room ${shell.card.tag}: ${FIXTURE_ROOMS[glyph]}; the interior leaves it as the house fits it (name its uses to furnish it anyway)`);
  uses = uses.filter((u) => {
    if (FUNCTIONS[u]) return true;
    notes.push(`brief.uses: '${u}' is not a function (${Object.keys(FUNCTIONS).join(', ')}); left out`);
    return false;
  });
  if (tags.includes('no-tv')) uses = uses.filter((u) => u !== 'media');
  const overrides = new Map((brief.pieces || []).filter((p) => p && typeof p.id === 'string').map((p) => [p.id, p]));
  const want = new Set(uses);
  const wall = [];
  const resolved = [], gaps = [];

  const tvDiagonal = clamp(lengthMm(brief.tv ? `${brief.tv}in` : null) ?? 1651, 800, 2540);   // 65 in unless asked
  const ctx = {
    R, tags, seats: brief.seats, note: (n) => notes.push(n),
    focal: resolveFocal(R, brief.focal, uses),
    tvDiagonal, tvWidth: tvDiagonal * 0.8716,
    daylight: (edge) => daylightOf(R)[edge],
    find: (id) => R.placed.find((p) => p.id === id) || null,
    band: (piece) => PIECES[piece].band,
    wants: (fn) => want.has(fn) || (ctx._current?.suggest || []).includes(fn),
    // a wall piece hangs only where no opening is: its span on the wall against every door and window there
    wall: (spec) => {
      const F = wallFrame(R, spec.edge);
      const z0 = spec.centre - spec.h / 2, z1 = spec.centre + spec.h / 2;
      const hit = R.openings.find((o) => {
        if (o.wall !== spec.edge) return false;
        const [a, b] = F.span(o.a, o.b);
        return Math.min(b, spec.u + spec.w / 2) > Math.max(a, spec.u - spec.w / 2) && o.head > z0 && (o.sill || 0) < z1;
      });
      const feat = R.features.find((f) => f.wall === spec.edge && Math.abs(f.u - spec.u) < (f.w + spec.w) / 2);
      if (hit || feat) { notes.push(`${spec.id}: left off the ${spec.edge} wall — ${hit ? `the ${hit.kind} ${hit.tag}` : `the ${feat.type}`} is there`); return; }
      wall.push(spec);
    },
    // a piece's size: the library's, then the strategy's, then the operator's (clamped to the piece's band, and said)
    size: (piece, id, dflt = {}) => {
      const P = PIECES[piece];
      let [w, d, h] = P.size;
      if (piece === 'bed') {
        const m = MATTRESSES[brief.bed] || MATTRESSES.queen;
        [w, d] = [m[0] + 2 * BED_FRAME[0], m[1] + BED_FRAME[1]];
      }
      if (dflt.w != null) w = dflt.w;
      if (dflt.d != null) d = dflt.d;
      if (dflt.h != null) h = dflt.h;
      const ov = overrides.get(id);
      if (ov && Array.isArray(ov.size)) {
        const [ow, od, oh] = ov.size.map((v) => (v == null ? null : lengthMm(v)));
        if (ow) w = ow; if (od) d = od; if (oh) h = oh;
      }
      const [lo, hi] = P.band;
      if (w < lo || w > hi) { const c = clamp(w, lo, hi); notes.push(`${id}: ${Math.round(w)} mm is outside a ${P.label}'s ${lo}–${hi} mm; ${Math.round(c)} mm`); w = c; }
      return [w, d, h];
    },
  };
  notes.push(`focal point: ${ctx.focal.why} (${ctx.focal.edge} wall)`);

  for (const fn of SOLVE_ORDER) {
    if (!want.has(fn)) continue;
    const refused = [];
    let won = null;
    for (const s of strategiesFor(fn)) {
      const q = qualifies(s, caps, tags);
      if (q) { refused.push({ id: s.id, why: q }); continue; }
      const mark = R.placed.length, wmark = wall.length, focal = { ...ctx.focal };
      ctx._current = s;
      // the ways the room has before this group: a group may not close one that was open
      ctx.wayWas = wayWhy(R);
      try {
        s.lay(ctx);
        const way = ctx.wayWas ? null : wayWhy(R);
        if (way) throw new Refuse(way);
        won = s;
        break;
      } catch (err) {
        if (!(err instanceof Refuse)) throw err;
        R.placed.length = mark; wall.length = wmark; ctx.focal = focal;
        refused.push({ id: s.id, why: err.message });
      } finally { ctx._current = null; }
    }
    if (won) {
      resolved.push({ fn, strategy: won.id, line: won.line, ...(refused.length ? { refused } : {}) });
      for (const f of won.suggest || []) want.add(f);
      for (const f of won.covers || []) want.delete(f);
    } else {
      gaps.push({ fn, why: refused.map((r) => `${r.id}: ${r.why}`).join('; ') || 'no strategy' });
    }
  }

  // the operator's word: omit, move, turn; extras
  for (const [id, ov] of overrides) {
    const i = R.placed.findIndex((p) => p.id === id);
    if (i >= 0) {
      if (ov.omit) { R.placed.splice(i, 1); continue; }
      const p = R.placed[i];
      const at = Array.isArray(ov.at) ? ov.at.map(lengthMm) : null;
      const facing = EDGES.includes(ov.facing) ? ov.facing : p.facing;
      if ((at && at.every((v) => v != null)) || facing !== p.facing) {
        const [x, y] = at && at.every((v) => v != null) ? at : [p.x, p.y];
        const moved = { ...p, x, y, facing, rect: footprint(x, y, p.w, p.d, facing) };
        R.placed.splice(i, 1);
        const why = whyNot(R, moved.rect, { h: p.h, skin: p.mount === 'skin' });
        if (why) notes.push(`${id}: moved as asked, though ${why}`);
        R.placed.splice(i, 0, moved);
      }
      continue;
    }
    const wi = wall.findIndex((w) => w.id === id);
    if (wi >= 0) { if (ov.omit) wall.splice(wi, 1); continue; }
    if (ov.omit) continue;
    // an extra piece the operator adds by id
    if (!ov.piece || !PIECES[ov.piece]) { notes.push(`pieces: '${id}' is not a solved piece; an extra names its piece (${Object.keys(PIECES).join(', ')})`); continue; }
    const [w, d, h] = ctx.size(ov.piece, id);
    const at = Array.isArray(ov.at) ? ov.at.map(lengthMm) : null;
    const facing = EDGES.includes(ov.facing) ? ov.facing : 'S';
    const mount = PIECES[ov.piece].mount;
    if (at && at.every((v) => v != null)) {
      const why = whyNot(R, footprint(at[0], at[1], w, d, facing), { h, skin: mount === 'skin' });
      if (why) notes.push(`${id}: placed as asked, though ${why}`);
      put(R, { id, piece: ov.piece, fn: 'extra', x: at[0], y: at[1], w, d, h, facing, mount });
    } else {
      const edge = EDGES.includes(ov.wall) ? ov.wall : null;
      const spot = (edge ? [edge] : EDGES).map((e) => onWall(R, e, { w, d, h })).find((s) => !s.why);
      if (spot) put(R, { id, piece: ov.piece, fn: 'extra', x: spot.x, y: spot.y, w, d, h, facing: spot.facing, mount });
      else notes.push(`${id}: no wall takes a ${PIECES[ov.piece].label} ${Math.round(w)} mm wide; give it \`at\``);
    }
  }

  return { R, focal: ctx.focal, placed: R.placed, wall, resolved, gaps, notes, caps };
}

/** The room's review: what the hard laws measure once it is laid (advisory, as every gate). */
export function reviewRoom(solved) {
  const { R } = solved;
  const findings = [];
  const walk = law('walkway');
  const ways = passages(R);
  const side = law('secondary-path');
  for (const p of ways) {
    const L = p.kind === 'through' ? walk : side, name = p.kind === 'through' ? 'walkway' : 'secondary-path';
    if (p.clear < L.min) findings.push({ law: name, severity: 'warn', line: `from door ${p.from} ${p.kind === 'through' ? `through to door ${p.to}` : `to ${p.to}`} the way is ${p.clear} mm clear at its narrowest; ${L.target} mm is the rule (${L.min} the least)` });
  }
  const sofa = R.placed.find((p) => p.id === 'conversation.sofa'), table = R.placed.find((p) => p.id === 'conversation.coffee-table');
  if (sofa && table) {
    const r = table.w / sofa.w, L = law('coffee-length');
    if (r < L.min || r > L.max) findings.push({ law: 'coffee-length', severity: 'note', line: `the coffee table is ${Math.round(r * 100)}% of the sofa; about ${Math.round(L.ratio * 100)}% reads best` });
  }
  const open = openShare(R), N = law('negative-space');
  if (open < N.min) findings.push({ law: 'negative-space', severity: 'note', line: `${Math.round(open * 100)}% of the floor is open; ${Math.round(N.min * 100)}% or more keeps a room from feeling full` });
  const lights = R.placed.filter((p) => p.piece === 'floor-lamp').length;
  if (lights + 1 < law('lighting-layers').min) findings.push({ law: 'lighting-layers', severity: 'note', line: `${lights + 1} light source${lights ? 's' : ''} (the ceiling's and ${lights} lamp${lights === 1 ? '' : 's'}); three, in a triangle, light a room in layers` });
  return { passages: ways, openShare: Math.round(open * 100) / 100, findings };
}
