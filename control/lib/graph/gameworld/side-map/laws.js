/**
 * THE SIDE MAP'S LAWS (docs/side-map-principles.md "What holds it"): the principles measured on a laid map (layout.js)
 * and, where it is given, its dress (dress.js). Advisory, as every law in the house: each says what it measured, and a
 * map that loses one is still made.
 *
 *   the layout's
 *     one-screen          a run is one screen thick across the axis its camera holds; a room at least a screen each way
 *     both-walls          a shaft's two walls are inside the frame at every height (its open narrower than a screen)
 *     reach               every gap a pit the move that teaches it crosses; every step up a climb a jump makes
 *     rests               no more than three kicks between rests up a chimney, its top counted
 *     outclimbs           a rising frame takes longer up its climb than the bot does on the shipped rule, with a margin
 *     light-at-the-top    every climb's top opens into the next zone's space (and, dressed, is lit)
 *     stakes              the first zone has no pit; climbs lengthen through the stage
 *     checkpoints         every zone has a checkpoint inside it, never further back than its start
 *     ladders             a ladder's foot on a floor and its top at a floor's lip, both in the open
 *     one-new-thing       what a stage teaches comes in its order, and no zone repeats the one before it
 *     varied              no run one smooth trail: a step, a block or a pit at least every screen and a quarter (path.js)
 *     swept               nothing built outside the camera's swept area, nor in another zone's open space; nothing in it
 *                         left unbuilt but a pit
 *     the-boss-owns-it    the boss's room shuts behind (and, dressed, carries its mark)
 *   the dress's (with a dress)
 *     a-place-a-zone      no two zones running are one place or one key; each a fill's family
 *     solid-over-void     the closed parts lighter than the void behind the play
 *     lit-tops            every standable top a lit edge, lighter than its solid
 *     play-against-place  play and place on opposite sides of the wheel
 *     boss-colour         the boss's hue its own, unused before the zones that lead to its room, growing toward it
 *     rhythm              bays by the walls' rule, a pillar or a seam in every frame, a spawner a screen apart
 *     peeks-in            the next zone's family and key at the edge of a zone's last screen, the zones touching
 *     threads             the setting's thread runs unbroken from zone to zone
 *     painted             every zone with closed parts names what they are painted as; with the paint, every closed
 *                         face carries its fill and no zone's slices repeat
 *     doodads             what stands on the icing blocks nothing and hides nothing: none sunk in a closed part or at a
 *                         pit's lip, the lip's low, the foreground's under the feet line (doodads.js)
 *
 *   sideMapLaws(layout, reach, { dress?, paint? }) → [{ id, holds, says, zones? }]  (zones: where a law is lost)
 *   SIDE_MAP_LAWS        the ids, in order
 *
 * Pure.
 */
import { reachAt } from '../feel/reach.js';
import { TEACH } from '../course.js';
import { rhythmFaults } from '../../era/wall-rhythm.js';
import { FILLS } from './fills.js';
import { climbTime, RISE_SHARE } from './layout.js';
import { wallSurfaces } from './paint.js';
import { doodadsOf, doodadFaults } from './doodads.js';

export const SIDE_MAP_LAWS = Object.freeze(['one-screen', 'both-walls', 'reach', 'rests', 'outclimbs', 'light-at-the-top', 'stakes', 'checkpoints', 'ladders', 'one-new-thing', 'varied', 'swept', 'the-boss-owns-it',
  'a-place-a-zone', 'solid-over-void', 'lit-tops', 'play-against-place', 'boss-colour', 'rhythm', 'peeks-in', 'threads', 'painted', 'doodads']);

const EPS = 1e-3, MARGIN = 0.35, SEEN = 1, OUTCLIMB = 1.25, CELL = 0.5;
const r2 = (v) => Math.round(v * 100) / 100;
const inRect = (r, s, z, e = EPS) => s >= r.s0 - e && s <= r.s1 + e && z >= r.z0 - e && z <= r.z1 + e;
const lum = (h) => { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const hue = (h) => {
  const n = parseInt(h.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255), M = Math.max(r, g, b), d = M - Math.min(r, g, b);
  if (!d) return 0;
  return ((M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
};
const apart = (a, b) => { const d = Math.abs(hue(a) - hue(b)) % 360; return Math.min(d, 360 - d); };

/** The side map's laws over its layout and, given one, its dress. */
export function sideMapLaws(layout, reach, { dress, paint } = {}) {
  const L = layout, W = L.screen.width, H = L.screen.height, run = reach.moves.run, kick = reach.wall?.climb ?? null;
  const laws = [];
  const law = (id, lost, held, losing) => laws.push(lost.length ? { id, holds: false, says: losing(lost), zones: [...new Set(lost.map((x) => x.zone))] } : { id, holds: true, says: held });
  const byZone = (list, i) => list.filter((x) => x.zone === i);
  const entry = (i) => (i ? L.zones[i - 1].exit : [0, 0]);
  const ups = L.zones.filter((Z) => Z.run === 'up');

  // one-screen: thick as a screen across the held axis
  {
    const lost = [];
    for (const Z of L.zones) {
      const [s0, s1, z0, z1] = Z.rect;
      if (Z.lock === 'z' && z1 - z0 > H + EPS) lost.push({ zone: Z.i, says: `zone ${Z.i} is ${r2(z1 - z0)} m thick, its held frame ${r2(H)} m: its floors climb ${r2(z1 - z0 - H)} m out of it` });
      if (Z.lock === 's' && Math.abs(s1 - s0 - W) > 0.01) lost.push({ zone: Z.i, says: `zone ${Z.i} is ${r2(s1 - s0)} m wide, a screen ${r2(W)} m` });
      if (Z.kind === 'room' && (s1 - s0 < W - EPS || z1 - z0 < H - EPS)) lost.push({ zone: Z.i, says: `room ${Z.i} is smaller than a screen` });
    }
    law('one-screen', lost, `every run one screen thick across its held axis (${r2(W)} by ${r2(H)} m a screen)`, (x) => x.map((y) => y.says).join('; '));
  }
  // both-walls: a shaft's walls in the frame
  {
    const lost = [];
    for (const Z of L.zones.filter((Z) => Z.lock === 's')) {
      const o = byZone(L.open, Z.i).reduce((m, r) => Math.max(m, r.s1 - r.s0), 0);
      if (o > W - 2 * SEEN) lost.push({ zone: Z.i, w: o });
    }
    law('both-walls', lost, `every shaft's two walls in the frame, at least ${SEEN} m of each seen`, (x) => x.map((y) => `zone ${y.zone}'s shaft is ${r2(y.w)} m wide in a ${r2(W)} m frame`).join('; '));
  }
  // reach: the pits, and the stands up a climb
  {
    const lost = [];
    for (const g of L.gaps) {
      if (g.kind === 'wall') {
        const kicks = Math.ceil(Math.max(0, g.dz - run.height) / (kick || 1));
        if (!(kick && kicks <= 3)) lost.push({ zone: g.zone, says: `a ${g.dz} m face in zone ${g.zone}: ${kick ? `${kicks} kicks` : 'no kick'}` });
        continue;
      }
      const M = g.teaches === 'run' ? run : reach.moves[g.teaches], at = reachAt(M, g.dz);
      if (!(at !== null && at >= g.w + MARGIN)) lost.push({ zone: g.zone, says: `a ${g.w} m pit in zone ${g.zone}, ${g.dz} m up: the ${g.teaches === 'run' ? 'running jump' : g.teaches} reaches ${at ?? 'not that high'}` });
    }
    for (const Z of ups.filter((Z) => ['ledges', 'stair', 'switchback'].includes(Z.climb))) {
      const z = entry(Z.i)[1], shaft = byZone(L.open, Z.i)[0], top = Z.exit[1];
      const stands = [{ s0: shaft.s0, s1: shaft.s1, z }, ...byZone(L.rests, Z.i).sort((a, b) => a.z - b.z), { s0: shaft.s1, s1: shaft.s1 + W, z: top }];
      for (let k = 1; k < stands.length; k++) {
        const A = stands[k - 1], B = stands[k], dz = B.z - A.z, h = Math.max(0, B.s0 - A.s1, A.s0 - B.s1);
        const ok = h <= EPS ? dz <= run.height + EPS : (reachAt(run, dz) ?? -1) >= h + MARGIN;
        if (!ok) lost.push({ zone: Z.i, says: `zone ${Z.i}'s ${Z.climb}: a stand ${r2(dz)} m up and ${r2(h)} m across (the running jump rises ${run.height} m)` });
      }
    }
    // (and every step up the path a hop the running jump clears with room, path.js)
    for (const st of L.steps ?? []) if (st.dz > 0) { const at = reachAt(run, st.dz); if (!(at !== null && at >= MARGIN)) lost.push({ zone: st.zone, says: `a step ${r2(st.dz)} m up in zone ${st.zone}: the running jump rises ${run.height} m` }); }
    // (and room to stand on every stand up a climb: nothing over it closer than the hero is tall)
    if (L.stature) for (const r of L.rests) {
      const over = L.solids.filter((o) => o.zone === r.zone && o.z0 > r.z + 0.05 && Math.min(o.s1, r.s1) - Math.max(o.s0, r.s0) > 0.3).reduce((m, o) => Math.min(m, o.z0), Infinity);
      if (over - r.z < L.stature + 0.1) lost.push({ zone: r.zone, says: `zone ${r.zone}: a rest at ${r2(r.z)} m with ${r2(over - r.z)} m over it, the hero ${L.stature} m tall` });
    }
    law('reach', lost, 'every pit crossed by the move that teaches it, every stand up a climb a jump away', (x) => x.map((y) => y.says).join('; '));
  }
  // rests: three kicks at most, the top counted
  {
    const lost = [];
    for (const Z of ups.filter((Z) => Z.climb === 'chimney')) {
      const zs = [entry(Z.i)[1], ...byZone(L.rests, Z.i).map((r) => r.z).sort((a, b) => a - b), Z.exit[1]];
      const most = zs.slice(1).reduce((m, v, k) => Math.max(m, v - zs[k]), 0);
      if (!kick || most > 3 * kick + EPS) lost.push({ zone: Z.i, most });
    }
    law('rests', lost, `no more than three kicks (${kick ? r2(3 * kick) : '—'} m) between rests up any chimney`, (x) => x.map((y) => kick ? `zone ${y.zone}: ${r2(y.most)} m between rests, three kicks ${r2(3 * kick)} m` : `zone ${y.zone}: a chimney, and the hero kicks off no wall`).join('; '));
  }
  // outclimbs: the frame slower than the bot
  {
    const lost = [], said = [];
    for (const R of L.rises) {
      const Z = L.zones[R.zone], shaft = byZone(L.open, R.zone)[0];
      const bot = climbTime({ climb: Z.climb, from: R.from, to: R.to, rests: byZone(L.rests, R.zone), width: shaft.s1 - shaft.s0 }, reach), frame = (R.to - R.from) / R.pace;
      said.push(`zone ${R.zone}: the bot ${r2(bot)} s, the frame ${r2(frame)} s`);
      if (!(frame >= OUTCLIMB * bot - EPS)) lost.push({ zone: R.zone, says: `zone ${R.zone}'s frame rises ${R.pace} m/s and takes ${r2(frame)} s; the bot climbs in ${r2(bot)} s, a margin of ${OUTCLIMB}× wants ${r2(OUTCLIMB * bot)} s` });
    }
    law('outclimbs', lost, said.length ? `every rising frame slower than the bot (${said.join('; ')}; the frame set at ${RISE_SHARE} of its pace)` : 'no frame rises', (x) => x.map((y) => y.says).join('; '));
  }
  // light at the top: the next zone's space adjoins the climb's top
  {
    const lost = [];
    for (const Z of ups) {
      const shaft = byZone(L.open, Z.i)[0], top = Z.exit[1], N = byZone(L.open, Z.i + 1);
      const opens = N.some((r) => r.s0 <= shaft.s1 + EPS && r.s1 >= shaft.s1 - EPS && r.z0 <= top + EPS && r.z1 >= top);
      const lit = !dress || dress.zones[Z.i]?.light?.at === 'top';
      if (!opens) lost.push({ zone: Z.i, says: `zone ${Z.i}'s top opens into ${N.length ? 'no space of the next zone' : 'nothing: the map ends on a climb'}` });
      else if (!lit) lost.push({ zone: Z.i, says: `zone ${Z.i}'s top is open but its dress lights no top` });
    }
    law('light-at-the-top', lost, ups.length ? 'every climb\'s top opens into the next zone\'s space' : 'no climbs', (x) => x.map((y) => y.says).join('; '));
  }
  // stakes: no pit first; climbs lengthen
  {
    const lost = [], first = byZone(L.gaps, 0);
    if (first.length) lost.push({ zone: 0, says: `the first zone has ${first.length} pit${first.length === 1 ? '' : 's'}: a move is taught safe first (a step that only lands back on the floor)` });
    ups.forEach((Z, k) => { if (k) { const a = ups[k - 1].exit[1] - entry(ups[k - 1].i)[1], b = Z.exit[1] - entry(Z.i)[1]; if (b < a - EPS) lost.push({ zone: Z.i, says: `zone ${Z.i}'s climb (${r2(b)} m) is shorter than the one before it (${r2(a)} m): climbs lengthen` }); } });
    law('stakes', lost, 'the first zone without a pit, and every climb as long as the last or longer', (x) => x.map((y) => y.says).join('; '));
  }
  // checkpoints: one inside every zone
  {
    const lost = L.zones.filter((Z) => !byZone(L.checkpoints, Z.i).some((c) => inRect({ s0: Z.rect[0], s1: Z.rect[1], z0: Z.rect[2], z1: Z.rect[3] }, ...c.at))).map((Z) => ({ zone: Z.i }));
    law('checkpoints', lost, 'a checkpoint in every zone, none further back than its start', (x) => `no checkpoint inside zone${x.length === 1 ? '' : 's'} ${x.map((y) => y.zone).join(', ')}`);
  }
  // ladders: on floors, in the open
  {
    const lost = [];
    for (const l of L.ladders) {
      const foot = L.solids.some((r) => Math.abs(r.z1 - l.foot[1]) < EPS && r.s0 - EPS <= l.foot[0] && l.foot[0] <= r.s1 + EPS);
      const lip = L.solids.some((r) => Math.abs(r.z1 - l.lip[1]) < EPS && (Math.abs(r.s0 - l.lip[0]) < 0.05 || Math.abs(r.s1 - l.lip[0]) < 0.05));
      const open = [l.foot, l.lip].every((p) => L.open.some((r) => inRect(r, ...p)));
      if (!(foot && lip && open)) lost.push({ zone: l.zone, says: `zone ${l.zone}'s ladder: ${[!foot && 'its foot on no floor', !lip && 'its top at no floor\'s lip', !open && 'out of the open'].filter(Boolean).join(', ')}` });
    }
    law('ladders', lost, L.ladders.length ? 'every ladder\'s foot on a floor and its top at a floor\'s lip, in the open' : 'no ladders', (x) => x.map((y) => y.says).join('; '));
  }
  // one new thing: the teaching in its order; no zone the one before it again
  {
    const lost = [], words = (Z) => [Z.kind, Z.run, Z.teach, Z.beat, Z.climb, Z.drop].join('/');
    let at = -1;
    for (const Z of L.zones) {
      if (Z.teach) { const k = TEACH.indexOf(Z.teach); if (k < at) lost.push({ zone: Z.i, says: `zone ${Z.i} teaches ${Z.teach} after ${TEACH[at]}` }); at = Math.max(at, k); }
      if (Z.i && words(Z) === words(L.zones[Z.i - 1]) && (Z.teach || Z.beat)) lost.push({ zone: Z.i, says: `zone ${Z.i} is zone ${Z.i - 1} again (${Z.teach ?? Z.beat})` });
    }
    law('one-new-thing', lost, `what the stage teaches in its order (${TEACH.join(', ')}), no zone the one before it again`, (x) => x.map((y) => y.says).join('; '));
  }
  // varied: no run one smooth trail (path.js): no stretch with no step and no pit longer than a screen and a quarter, but a
  // landing's (wide and flat by design) and a boss's floor
  {
    const lost = [];
    for (const Z of L.zones.filter((Z) => Z.run === 'across' && Z.beat !== 'landing' && Z.teach !== 'boss')) {
      const at = [Z.rect[0], Z.rect[1], ...(L.steps ?? []).filter((x) => x.zone === Z.i).map((x) => x.s), ...L.gaps.filter((g) => g.zone === Z.i).flatMap((g) => [g.s0, g.s1])].sort((a, b) => a - b);
      const most = at.slice(1).reduce((m, v, k) => Math.max(m, v - at[k]), 0);
      if (most > 1.25 * W + EPS) lost.push({ zone: Z.i, says: `zone ${Z.i}: ${r2(most)} m of one smooth floor (a screen and a quarter: ${r2(1.25 * W)} m)` });
    }
    law('varied', lost, 'no run one smooth trail: a step, a block or a pit at least every screen and a quarter', (x) => x.map((y) => y.says).join('; '));
  }
  // swept: built only where seen, everything seen built (a pit is the frame's bottom, left open)
  {
    const lost = [], outside = [];
    const seen = (s, z) => L.swept.some((r) => inRect(r, s, z, 0));
    for (const r of L.solids) {
      for (let s = r.s0 + CELL / 2; s < r.s1; s += CELL) for (let z = r.z0 + CELL / 2; z < r.z1; z += CELL) if (!seen(s, z)) { outside.push(r.zone); s = r.s1; break; }
    }
    if (outside.length) lost.push(...[...new Set(outside)].map((zone) => ({ zone, says: `zone ${zone} builds outside the camera's path` })));
    // (and no solid stands in another zone's open space: a wall hung into the run before it)
    for (const r of L.solids) for (const o of L.open) if (o.zone !== r.zone && o.s0 < r.s1 - 0.01 && o.s1 > r.s0 + 0.01 && o.z0 < r.z1 - 0.01 && o.z1 > r.z0 + 0.01) lost.push({ zone: r.zone, says: `zone ${r.zone}'s ${r.role} stands in zone ${o.zone}'s open space` });
    const pit = (s, z) => L.gaps.some((g) => s > g.s0 && s < g.s1 && z < (byZone(L.open, g.zone)[0]?.z0 ?? -Infinity));
    const done = new Set();
    let blank = 0, area = 0;
    for (const r of L.swept) {
      for (let s = Math.floor(r.s0 / CELL) * CELL + CELL / 2; s < r.s1; s += CELL) for (let z = Math.floor(r.z0 / CELL) * CELL + CELL / 2; z < r.z1; z += CELL) {
        if (s < r.s0 || z < r.z0) continue;
        const k = `${s},${z}`;
        if (done.has(k)) continue;
        done.add(k); area++;
        if (!pit(s, z) && !L.open.some((o) => inRect(o, s, z, 0)) && !L.solids.some((o) => inRect(o, s, z, 0))) blank++;
      }
    }
    if (blank) lost.push({ zone: null, says: `${r2(blank * CELL * CELL)} m² of the ${r2(area * CELL * CELL)} m² the camera sees is neither open nor built` });
    law('swept', lost, `nothing built outside the camera's path, and the ${r2(area * CELL * CELL)} m² it sees all open, built or a pit`, (x) => x.map((y) => y.says).join('; '));
  }
  // the boss owns its room
  {
    const rooms = L.zones.filter((Z) => Z.kind === 'room' && Z.teach === 'boss'), lost = [];
    for (const Z of rooms) {
      if (!L.doors.some((d) => d.zone === Z.i && d.kind === 'shutter')) lost.push({ zone: Z.i, says: `the boss's room ${Z.i} does not shut behind` });
      if (dress && dress.zones[Z.i]?.mark?.kind !== 'emblem') lost.push({ zone: Z.i, says: `the boss's room ${Z.i} carries no mark` });
    }
    law('the-boss-owns-it', lost, rooms.length ? 'the boss\'s room shuts behind' + (dress ? ' and carries its mark' : '') : 'no boss\'s room', (x) => x.map((y) => y.says).join('; '));
  }
  if (!dress) return laws;

  const D = dress, Z = D.zones;
  // a place a zone
  law('a-place-a-zone', Z.flatMap((z, i) => [
    ...(i && (z.place === Z[i - 1].place || z.key === Z[i - 1].key) ? [{ zone: i, says: `zone ${i} is zone ${i - 1}'s place again (${z.place})` }] : []),
    ...(!FILLS[z.family] ? [{ zone: i, says: `zone ${i}'s family ${z.family} is no fill` }] : []),
  ]), `${Z.length} zones, no two running one place: ${Z.map((z) => z.place).join(', ')}`, (x) => x.map((y) => y.says).join('; '));
  // solid over void, and lit tops
  law('solid-over-void', Z.filter((z) => !(lum(z.key) - lum(z.void) >= 0.2)).map((z) => ({ zone: z.zone })), 'every zone\'s closed parts lighter than its void by a fifth of the scale at least', (x) => `zones ${x.map((y) => y.zone).join(', ')}: the solid no lighter than the void`);
  law('lit-tops', Z.filter((z) => !(z.edge && lum(z.edge) > lum(z.key))).map((z) => ({ zone: z.zone })), 'every standable top a lit edge over its solid', (x) => `zones ${x.map((y) => y.zone).join(', ')}: no lit edge on their tops`);
  // play against place
  {
    const lost = Z.filter((z) => apart(z.key, D.palette.play) < 120).map((z) => ({ zone: z.zone, d: apart(z.key, D.palette.play) }));
    if (apart(D.palette.play, D.palette.place) < 150) lost.push({ zone: null, d: apart(D.palette.play, D.palette.place) });
    law('play-against-place', lost, `play and place ${r2(apart(D.palette.play, D.palette.place))}° apart on the wheel, every zone's key at least 120° from play`, (x) => x.map((y) => `${y.zone === null ? 'the palette' : `zone ${y.zone}`}: ${r2(y.d)}° from play`).join('; '));
  }
  // the boss's colour
  {
    const at = Z.findIndex((z) => z.boss === 1), lost = [];
    for (const z of Z) if (apart(z.key, D.palette.boss) < 30) lost.push({ zone: z.zone, says: `zone ${z.zone}'s key is ${r2(apart(z.key, D.palette.boss))}° from the boss's` });
    Z.forEach((z, i) => {
      if (at < 0 ? z.boss : i < at - 2 && z.boss) lost.push({ zone: i, says: `zone ${i} wears the boss's colour before its lead-in` });
      if (at >= 0 && i > 0 && i <= at && z.boss < Z[i - 1].boss) lost.push({ zone: i, says: `the boss's colour falls at zone ${i}` });
    });
    law('boss-colour', lost, at < 0 ? 'no boss: its colour worn nowhere' : `the boss's colour its own, unused before zone ${Math.max(0, at - 2)}, growing to its room`, (x) => x.map((y) => y.says).join('; '));
  }
  // rhythm
  {
    const lost = [];
    for (const z of Z.filter((z) => z.bays)) {
      const [s0, s1] = L.zones[z.zone].rect, marks = [s0, ...z.pillars, ...(z.seams ?? []), s1].sort((a, b) => a - b);
      const wide = marks.slice(1).reduce((m, v, k) => Math.max(m, v - marks[k]), 0), hs = [...z.hatches].map((h) => h[0]).sort((a, b) => a - b);
      const near = hs.slice(1).reduce((m, v, k) => Math.min(m, v - hs[k]), Infinity);
      if (rhythmFaults(z.bays.join('')).length) lost.push({ zone: z.zone, says: `zone ${z.zone}'s bays ${z.bays.join('')} break the walls' rule` });
      if (wide > W + EPS) lost.push({ zone: z.zone, says: `zone ${z.zone}: ${r2(wide)} m with no pillar or seam, wider than a screen` });
      if (near < 0.95 * W) lost.push({ zone: z.zone, says: `zone ${z.zone}: two spawners ${r2(near)} m apart, less than a screen` });
    }
    law('rhythm', lost, 'every run\'s bays by the walls\' rule, a pillar or a seam in every frame, its spawners a screen apart', (x) => x.map((y) => y.says).join('; '));
  }
  // the next place peeks in
  {
    const lost = [];
    Z.slice(0, -1).forEach((z, i) => {
      const N = Z[i + 1], a = L.zones[i].rect, b = L.zones[i + 1].rect, touch = a[0] <= b[1] + EPS && b[0] <= a[1] + EPS && a[2] <= b[3] + EPS && b[2] <= a[3] + EPS;
      if (!(z.peek && z.peek.family === N.family && z.peek.key === N.key)) lost.push({ zone: i, says: `zone ${i}'s edge does not carry zone ${i + 1}'s place` });
      else if (!touch) lost.push({ zone: i, says: `zone ${i} does not touch zone ${i + 1}: the next place is never in its frame` });
    });
    law('peeks-in', lost, 'every zone\'s last half screen carries the next zone\'s family and key', (x) => x.map((y) => y.says).join('; '));
  }
  // threads
  {
    const lost = [];
    for (let i = 1; i < Z.length; i++) if (!D.threads.some((t) => t.from === i - 1 && t.to === i)) lost.push({ zone: i });
    if (new Set(D.threads.map((t) => t.kind)).size > 1) lost.push({ zone: null });
    law('threads', lost, `${D.threads[0]?.kind ?? 'the thread'} carried unbroken from zone to zone`, (x) => `the thread breaks at ${x.map((y) => (y.zone === null ? 'a change of kind' : `zone ${y.zone}`)).join(', ')}`);
  }
  // painted
  {
    const lost = L.zones.filter((LZ) => byZone(L.solids, LZ.i).length && !(Z[LZ.i] && FILLS[Z[LZ.i].family] && Number.isFinite(Z[LZ.i].wear))).map((LZ) => ({ zone: LZ.i, says: `zone ${LZ.i}'s closed parts name no fill` }));
    // (painted: every closed face of any size carries its fill, and no zone's slices repeat)
    if (paint) {
      L.solids.forEach((r) => {
        if ((r.s1 - r.s0) * (r.z1 - r.z0) < 2) return;
        const on = paint.marks.some((m) => m.layer === 1 && m.zone === r.zone && m.s0 >= r.s0 - EPS && m.s1 <= r.s1 + EPS && m.z0 >= r.z0 - EPS && m.z1 <= r.z1 + EPS);
        if (!on) lost.push({ zone: r.zone, says: `zone ${r.zone}'s ${r.role} (${r2(r.s1 - r.s0)} by ${r2(r.z1 - r.z0)} m) is a plain face` });
      });
      for (const LZ of L.zones) { const ab = paint.slices.filter((x) => x.zone === LZ.i).map((x) => x.ab).join(''); if (rhythmFaults(ab).length) lost.push({ zone: LZ.i, says: `zone ${LZ.i}'s slices ${ab} repeat` }); }
      // (every wall a hero kicks off wears its jamb in segments, paint.js wallSurfaces: the cap on its side)
      for (const W0 of wallSurfaces(L)) {
        const n = paint.marks.filter((m) => m.zone === W0.zone && m.what === 'jamb' && m.z1 > W0.z0 && m.z0 < W0.z1 && Math.abs((W0.dir > 0 ? m.s1 : m.s0) - W0.e) < 1e-3).length;
        if (n < Math.floor((W0.z1 - W0.z0) / 2)) lost.push({ zone: W0.zone, says: `zone ${W0.zone}'s wall at ${r2(W0.e)} m (${r2(W0.z1 - W0.z0)} m tall) is one smooth band` });
      }
      // (every top a hero stands on wears its cap in segments: never one smooth band)
      for (const r of L.solids) {
        if (r.role === 'ceiling' || r.role === 'wall' || r.s1 - r.s0 < 1 || L.solids.some((o) => o !== r && Math.abs(o.z0 - r.z1) < 0.05 && Math.min(o.s1, r.s1) - Math.max(o.s0, r.s0) > 0.3)) continue;
        const caps = paint.marks.filter((m) => m.zone === r.zone && m.top && Math.abs(m.z1 - r.z1) < 1e-3 && m.s1 > r.s0 && m.s0 < r.s1 && m.what === 'cap-top');
        if (caps.length < Math.max(1, Math.floor((r.s1 - r.s0) / 3))) lost.push({ zone: r.zone, says: `zone ${r.zone}'s ${r.role} top (${r2(r.s1 - r.s0)} m) is one smooth band` });
      }
    }
    law('painted', lost, paint ? `every closed face painted in its fill (${paint.marks.length} marks), every zone's slices by the walls' rule, every top capped and every wall jambed in segments` : 'every zone\'s closed parts named a fill and a wear to be painted in', (x) => x.map((y) => y.says).join('; '));
  }
  // doodads: on the icing, never a collider (they are not the layout's blocks), and hiding nothing the play needs
  {
    const all = doodadsOf(L, D), lost = doodadFaults(L, all);
    law('doodads', lost, all.length ? `${all.length} things on the icing at their depths, none a collider, none sunk or at a pit's lip, the foreground under the feet line` : 'nothing stands on the icing', (x) => x.map((y) => y.says).join('; '));
  }
  return laws;
}
