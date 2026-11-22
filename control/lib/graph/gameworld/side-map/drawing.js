/**
 * THE SIDE MAP, DRAWN — the elevation of a laid, dressed map (docs/side-map-principles.md): the area the camera sweeps on
 * black, read left to right as the studied maps are. What a designer reads off it:
 *
 *   the map          the swept area in each zone's void, the closed parts in its key with their tops lit and their
 *                    paint over them (paint.js), nothing outside
 *   the zones        outlined and numbered, each with its place and what it teaches or its beat
 *   the rulers       along the bottom in screens, metres and seconds at the hero's run; up the side in screens and metres
 *   the play         the bot's line through the zones (a jump an arc, a chimney's kicks a zigzag between its rests, each
 *                    stretch's kicks counted), checkpoints, doors, ladders, pickups, a rising frame's pace
 *   the cells        where the dress places its things: bays A and B, pillars and seams, lamps, hatches at the spawners,
 *                    the next place's band at a zone's edge, a shaft's mark, the boss's emblem
 *   the laws         what the machine gate measured: each law lost named under the map, or all held
 *
 *   drawSideMap({ layout, dress, paint?, laws, reach }, { width? }) → an SVG document (a string)
 *
 * Pure.
 */
const r1 = (v) => Math.round(v * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The map as an elevation. */
export function drawSideMap({ layout: L, dress: D, paint, laws = [], reach }, { width = 2200 } = {}) {
  const W = L.screen.width, H = L.screen.height, speed = reach?.speed ?? 5;
  const s0 = Math.min(...L.swept.map((r) => r.s0)), s1 = Math.max(...L.swept.map((r) => r.s1));
  const z0 = Math.min(...L.swept.map((r) => r.z0)), z1 = Math.max(...L.swept.map((r) => r.z1));
  const left = 90, top = 50, k = Math.min(8, (width - left - 40) / (s1 - s0)), mapW = (s1 - s0) * k, mapH = (z1 - z0) * k;
  const lost = laws.filter((l) => !l.holds), legend = 34 + 18 * Math.max(1, lost.length);
  const Wpx = Math.ceil(left + mapW + 40), Hpx = Math.ceil(top + mapH + 70 + legend);
  const X = (s) => r1(left + (s - s0) * k), Y = (z) => r1(top + (z1 - z) * k);
  const box = (r, attrs) => `<rect x="${X(r.s0)}" y="${Y(r.z1)}" width="${r1((r.s1 - r.s0) * k)}" height="${r1((r.z1 - r.z0) * k)}" ${attrs}/>`;
  const Z = D?.zones ?? [], play = D?.palette.play ?? '#ffb000', out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Wpx}" height="${Hpx}" viewBox="0 0 ${Wpx} ${Hpx}" font-family="Helvetica, Arial, sans-serif">`);
  out.push(`<rect width="${Wpx}" height="${Hpx}" fill="#000"/>`);
  // the map: what the camera sweeps, then the closed parts with their tops lit
  for (const r of L.swept) out.push(box(r, `fill="${Z[r.zone]?.void ?? '#151a24'}"`));
  for (const r of L.solids) {
    const z = Z[r.zone];
    out.push(box(r, `fill="${z?.key ?? '#5a6b85'}"`));
    out.push(`<line x1="${X(r.s0)}" y1="${Y(r.z1)}" x2="${X(r.s1)}" y2="${Y(r.z1)}" stroke="${z?.edge ?? '#cfd8e8'}" stroke-width="2"/>`);
  }
  // the paint: each closed part's fill, motifs, middles, edges and threads
  for (const k of [...(paint?.marks ?? [])].filter((k) => !k.top && !k.side).sort((a, b) => a.layer - b.layer)) out.push(box(k, `fill="${k.fill}"`));
  // the cells: what the dress places, zone by zone
  for (const z of Z) {
    const LZ = L.zones[z.zone], [a, b, lo, hi] = LZ.rect, o = L.open.find((r) => r.zone === z.zone);
    for (const p of z.pillars ?? []) out.push(`<line x1="${X(p)}" y1="${Y(hi)}" x2="${X(p)}" y2="${Y(lo)}" stroke="${z.key}" stroke-opacity="0.55" stroke-width="5"/>`);
    for (const p of z.seams ?? []) out.push(`<line x1="${X(p)}" y1="${Y(hi)}" x2="${X(p)}" y2="${Y(lo)}" stroke="${z.key}" stroke-opacity="0.3" stroke-width="1"/>`);
    (z.bays ?? []).forEach((bay, i) => { const m = z.seams[i]; out.push(`<text x="${X(m) + 4}" y="${Y(hi) + 14}" font-size="11" fill="${z.edge}" fill-opacity="0.7">${bay}</text>`); });
    if (o) for (const p of z.lamps ?? []) out.push(`<circle cx="${X(p)}" cy="${Y(o.z1 - 1.4)}" r="3.5" fill="${z.edge}"/>`);
    for (const [hs, hz] of z.hatches ?? []) out.push(`<path d="M${X(hs) - 6} ${Y(hz + 2)} L${X(hs) + 6} ${Y(hz + 2)} L${X(hs)} ${Y(hz + 0.6)} Z" fill="${play}" fill-opacity="0.85"/>`);
    if (z.peek) { const P = z.peek.at; out.push(box(P.s0 !== undefined ? { s0: P.s0, s1: P.s1, z0: lo, z1: hi } : { s0: a, s1: b, z0: P.z0, z1: P.z1 }, `fill="${z.peek.key}" fill-opacity="0.13"`)); }
    if (o && z.mark?.kind === 'emblem') { const cx = X((o.s0 + o.s1) / 2), cy = Y((o.z0 + o.z1) / 2); out.push(`<path d="M${cx} ${cy - 14} L${cx + 14} ${cy} L${cx} ${cy + 14} L${cx - 14} ${cy} Z" fill="${D.palette.boss}"/>`); }
    if (o && z.mark?.kind === 'stripes') for (let y = o.z0; y < o.z1; y += 1.8) out.push(box({ s0: o.s0 + 0.2, s1: o.s1 - 0.2, z0: y, z1: y + 0.9 }, `fill="${play}" fill-opacity="0.25"`));
  }
  // the play: the bot's line, the checkpoints, doors, ladders, pickups, a rising frame
  out.push(`<path d="${botLine(L, reach).map(([c, s, z], i) => `${i ? c : 'M'}${X(s)} ${Y(z)}`).join(' ')}" fill="none" stroke="${play}" stroke-width="2" stroke-dasharray="6 4"/>`);
  for (const t of kickCounts(L, reach)) out.push(`<text x="${X(t.s) + 8}" y="${Y(t.z)}" font-size="11" fill="${play}">${t.n} kick${t.n === 1 ? '' : 's'}</text>`);
  for (const c of L.checkpoints) out.push(`<path d="M${X(c.at[0])} ${Y(c.at[1])} V${Y(c.at[1] + 2.4)} l9 4 l-9 4" fill="#fff" stroke="#fff" stroke-width="1.5"/>`);
  for (const d of L.doors) out.push(`<rect x="${X(d.at[0]) - 3}" y="${Y(d.at[1] + 3.6)}" width="6" height="${r1(3.6 * k)}" fill="${play}"/>`);
  for (const l of L.ladders) for (const ds of [-0.3, 0.3]) out.push(`<line x1="${X(l.foot[0] + ds)}" y1="${Y(l.foot[1])}" x2="${X(l.foot[0] + ds)}" y2="${Y(l.lip[1] + 1)}" stroke="${play}" stroke-width="2"/>`);
  for (const p of L.pickups) out.push(`<path d="M${X(p.at[0])} ${Y(p.at[1]) - 5} l5 5 l-5 5 l-5 -5 Z" fill="${play}"/>`);
  for (const R of L.rises) { const s = L.zones[R.zone].rect[0] + 1.5; out.push(`<path d="M${X(s)} ${Y(R.from + 2)} V${Y(R.to - 2)} m-6 10 l6 -10 l6 10" fill="none" stroke="#ff5a4a" stroke-width="2"/><text x="${X(s) - 6}" y="${Y((R.from + R.to) / 2)}" font-size="11" fill="#ff5a4a" text-anchor="end">rises ${R.pace} m/s</text>`); }
  // the zones, outlined and numbered
  for (const LZ of L.zones) {
    const [a, b, lo, hi] = LZ.rect, z = Z[LZ.i], what = LZ.teach ?? LZ.beat ?? LZ.climb ?? LZ.drop ?? '';
    out.push(box({ s0: a, s1: b, z0: lo, z1: hi }, 'fill="none" stroke="#fff" stroke-opacity="0.35" stroke-dasharray="4 4"'));
    // (a shaft's name at its foot, where the run beside it does not write its own)
    out.push(`<text x="${X(a) + 6}" y="${LZ.lock === 's' ? Y(lo) - 8 : Y(hi) + 30}" font-size="13" fill="#fff"><tspan font-weight="bold">${LZ.i}</tspan> ${esc(z?.place ?? '')}<tspan fill-opacity="0.6"> · ${esc(what)}</tspan></text>`);
  }
  // the rulers: screens, metres, seconds along; screens and metres up
  const yb = top + mapH + 18;
  out.push(`<line x1="${left}" y1="${yb}" x2="${r1(left + mapW)}" y2="${yb}" stroke="#888"/>`);
  for (let n = 0; s0 + n * W <= s1 + 1e-6; n++) { const x = X(s0 + n * W); out.push(`<line x1="${x}" y1="${yb - 5}" x2="${x}" y2="${yb + 5}" stroke="#888"/><text x="${x}" y="${yb + 18}" font-size="11" fill="#aaa" text-anchor="middle">${n} · ${Math.round(n * W)} m · ${r1((n * W) / speed)} s</text>`); }
  out.push(`<line x1="${left - 18}" y1="${top}" x2="${left - 18}" y2="${r1(top + mapH)}" stroke="#888"/>`);
  for (let n = 0; z0 + n * H <= z1 + 1e-6; n++) { const y = Y(z0 + n * H); out.push(`<line x1="${left - 23}" y1="${y}" x2="${left - 13}" y2="${y}" stroke="#888"/><text x="${left - 26}" y="${y + 4}" font-size="11" fill="#aaa" text-anchor="end">${n} · ${Math.round(n * H)} m</text>`); }
  out.push(`<text x="${left}" y="${top - 22}" font-size="15" fill="#fff" font-weight="bold">${esc(D ? `${D.setting}: ` : '')}${L.zones.length} zones, a screen ${r1(W)} × ${r1(H)} m</text>`);
  // the laws
  const ly = yb + 46;
  out.push(`<text x="${left}" y="${ly}" font-size="13" fill="#fff">the machine gate: ${lost.length ? `${lost.length} of ${laws.length} laws lost` : `all ${laws.length} laws hold`}</text>`);
  lost.forEach((l, i) => out.push(`<text x="${left}" y="${ly + 18 * (i + 1)}" font-size="12" fill="#ff7a6a">${esc(l.id)}: ${esc(l.says)}</text>`));
  out.push('</svg>');
  return out.join('\n');
}

/** The bot's line through the map: [cmd, s, z] points (an arc over a pit, a zigzag up a chimney). */
function botLine(L, reach) {
  const J = reach?.moves?.run?.height ?? 1.6, pts = [], foot = 0.9;
  const go = (s, z) => pts.push(['L', s, z + foot]);
  const arc = (a, b, za, zb) => { pts.push(['Q', (a + b) / 2, Math.max(za, zb) + J * 2 + foot]); pts.push(['', b, zb + foot]); };
  for (const Z of L.zones) {
    const [enS, enZ] = Z.i ? L.zones[Z.i - 1].exit : [0, 0], [exS, exZ] = Z.exit;
    if (!pts.length) pts.push(['M', enS, enZ + foot]);
    if (Z.run === 'across' || Z.kind === 'room') {
      const F = L.solids.filter((r) => r.zone === Z.i && (r.role === 'floor' || r.role === 'pillar')).sort((a, b) => a.s0 - b.s0);
      let last = null;
      for (const f of F) { if (last && f.s0 > last.s1 + 0.05) arc(last.s1, f.s0, last.z1, f.z1); else go(f.s0, f.z1); go(f.s1, f.z1); last = f; }
      go(exS, exZ);
    } else if (Z.run === 'up') {
      const R = L.rests.filter((r) => r.zone === Z.i).sort((a, b) => a.z - b.z), lad = L.ladders.find((l) => l.zone === Z.i);
      if (lad) { go(lad.foot[0], enZ); go(lad.foot[0], exZ); }
      else for (const r of R) go((r.s0 + r.s1) / 2, r.z);
      go(exS, exZ);
    } else if (Z.drop === 'chute') { go(enS + 1.2, enZ); go(enS + 1.2, exZ); go(exS, exZ); }
    else { const S = L.solids.filter((r) => r.zone === Z.i).sort((a, b) => a.s0 - b.s0); for (const r of S) { go(r.s0, r.z1); go(r.s1, r.z1); } }
  }
  return pts;
}

/** A chimney's kicks between its rests, where the drawing counts them. */
function kickCounts(L, reach) {
  const kick = reach?.wall?.climb, out = [];
  if (!kick) return out;
  for (const Z of L.zones.filter((Z) => Z.climb === 'chimney')) {
    const zs = [Z.i ? L.zones[Z.i - 1].exit[1] : 0, ...L.rests.filter((r) => r.zone === Z.i).map((r) => r.z).sort((a, b) => a - b), Z.exit[1]];
    const s = L.open.find((r) => r.zone === Z.i)?.s1 ?? Z.rect[1];
    for (let k = 1; k < zs.length; k++) out.push({ s, z: (zs[k] + zs[k - 1]) / 2, n: Math.ceil((zs[k] - zs[k - 1]) / kick - 1e-9) });
  }
  return out;
}
