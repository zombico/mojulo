/**
 * THE RENDER BENCHMARK (docs/side-map-principles.md "It is rendered to the modern benchmark", "The look"): a built side
 * map shot on its page at the frames a player sees and MEASURED BY ROLE, the house's modern side-scroller read off the
 * studied frames held to numbers. Each shot is rendered twice: as the page draws it, and as a ROLE PASS (every face its
 * role's flat colour, a hero stand-in where the hero stands), so each pixel of the page knows what it shows.
 *
 *   the SHOTS        one a zone kind: a run (the first with hatches, else the first), a climb (the first up run, the
 *                    hero on a rest halfway up), the boss's room; each framed as the side map's camera frames its hero
 *   the ROLES        top (a standable top's lit edge and its cap), jamb (a wall's edge and its face into the open), closed (the closed parts and their paint), back (an indoor zone's
 *                    wall and its dress), hills and range (an outdoor zone's backdrop, a layer each), play (shutters, ladders, pickups,
 *                    hatches), lamp, boss (its emblem), hero (the stand-in), fore (the
 *                    foreground's doodads), sky (nothing drawn)
 *   the MEASURES     hero      the hero's share of the frame's height (1/8)
 *                    lane      how far down the frame the top under the hero stands (2/3), a run's
 *                    hue       play against place: the hue between the play's pixels and the closed parts' (opposite)
 *                    litTops   the tops lighter than the closed parts under them
 *                    painted   the closed parts' lightness varied (a plain face is flat)
 *                    sharp     the lane's layer (the closed parts) the sharpest: its Laplacian energy against the back's
 *                    recedes   each layer back quieter: the closed parts' contrast over the back's, the backdrop's
 *                    lamps     lights with a source in an indoor run's frame
 *                    boss      the boss's mark on its room's back wall
 *                    light     a lamp's falloff on the back, a ledge's shadow (a closed face darker under its lip), the
 *                              lane lit a step over the back, a climb's frame lighter at its top (light.js)
 *                    fore      a foreground under the feet: its share of the frame (the icing's foreground doodads,
 *                              doodads.js), and how many of its pixels stand over the hero's feet in the hero's columns
 *                    moving    something moving beside the way (the map moves nothing yet: said)
 *
 *   ROLE_COLOURS, roleOf(group)
 *   benchmarkShots(layout, dress) → [{ name, zone, hero: [s, z], pose: { at, look, vfov } }]
 *   rolePayload(payload, shot, stature) → the payload's faces in their roles' colours, the hero's stand-in among them
 *   measureShot({ page, roles, flat? }, shot) → the measures (the images decoded: visual-gate.js decodeImage; `flat`: the
 *                    shot's flat twin, where its material reflects: the glints read as what the bake adds)
 *   benchmarkLaws(shots) → [{ id, shot, holds, says }]  advisory, each against the frame's principle
 *
 * Pure: the rendering is the script's (scripts/side-map.mjs --bench).
 */
import { srgbToLab } from '../../scene/visual-gate.js';

export const ROLE_COLOURS = Object.freeze({ top: '#ffffff', jamb: '#8000ff', closed: '#3060ff', back: '#00ff00', hills: '#ffff00', range: '#808000', play: '#ff00ff', lamp: '#00ffff', boss: '#ff8000', hero: '#ff0000', fore: '#008080', sky: '#000000' });
const SLIVER = 0.003, LAMP_WHOLE = 600, ROLES = Object.keys(ROLE_COLOURS), RGB = ROLES.map((k) => [1, 3, 5].map((i) => parseInt(ROLE_COLOURS[k].slice(i, i + 2), 16)));
/** The role a face of the side map's build plays, by its group. */
export function roleOf(group = '') {
  const g = String(group).replace(/^sidemap:/, '');
  if (g === 'edge' || g.startsWith('paint-cap')) return 'top';
  if ((g.startsWith('paint-jamb') && g !== 'paint-jamb-notch') || g.startsWith('paint-bracket')) return 'jamb';
  if (['rock', 'built', 'machine', 'padded'].includes(g) || g.startsWith('paint-')) return 'closed';
  if (g === 'hills' || g === 'range') return g;
  if (['door', 'ladder', 'pickup', 'hatch'].includes(g)) return 'play';
  if (g === 'lamp') return 'lamp';
  if (g === 'emblem') return 'boss';
  // (the icing's doodads: the foreground's its own layer, the rest the lane's detail)
  if (g === 'doodad-foreground') return 'fore';
  if (g.startsWith('doodad-')) return 'closed';
  return 'back';
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** One shot a zone kind, each framed as the side map's camera frames its hero there. */
export function benchmarkShots(layout, dress) {
  const L = layout, W = L.screen.width, H = L.screen.height, C = L.camera, out = [];
  const topAt = (zone, s, under = Infinity) => L.solids.filter((r) => r.zone === zone && r.s0 <= s && r.s1 >= s && r.z1 <= under + 1e-3 && r.role !== 'ceiling').reduce((m, r) => Math.max(m, r.z1), -Infinity);
  const frame = (Z, s, foot) => {
    const [s0, s1, z0, z1] = Z.rect, cs = s1 - s0 <= W ? (s0 + s1) / 2 : clamp(s, s0 + W / 2, s1 - W / 2), cz = z1 - z0 <= H ? (z0 + z1) / 2 : clamp(foot + C.lookH, z0 + H / 2, z1 - H / 2);
    return { at: [C.dist * Math.cos(C.tilt), cs, cz + C.dist * Math.sin(C.tilt)], look: [0, cs, cz], vfov: C.vfov };
  };
  const runs = L.zones.filter((Z) => Z.run === 'across'), run = runs.find((Z) => (dress.zones[Z.i].hatches ?? []).length) ?? runs[0];
  // (the hero on a floor, the one nearest three fifths of a screen in: never over a pit)
  if (run) {
    // (and on a floor at the run's way-in height, the one its camera is held at, where the path has one: path.js)
    const want = run.rect[0] + W * 0.6, z0 = run.i ? L.zones[run.i - 1].exit[1] : 0, all = L.solids.filter((r) => r.zone === run.i && r.role === 'floor' && r.s1 - r.s0 > 1);
    const level = all.filter((r) => Math.abs(r.z1 - z0) < 0.05), F = (level.length ? level : all).sort((a, b) => Math.abs((a.s0 + a.s1) / 2 - want) - Math.abs((b.s0 + b.s1) / 2 - want))[0];
    const s = F ? clamp(want, F.s0 + 0.5, F.s1 - 0.5) : want, z = topAt(run.i, s);
    out.push({ name: 'run', zone: run.i, material: dress.zones[run.i]?.material, hero: [s, z], screenH: H, pose: frame(run, s, z) });
  }
  const up = L.zones.find((Z) => Z.run === 'up');
  if (up) {
    const R = L.rests.filter((r) => r.zone === up.i), mid = R[Math.floor(R.length / 2)];
    const at = mid ? [(mid.s0 + mid.s1) / 2, mid.z] : [(up.rect[0] + up.rect[1]) / 2, (up.rect[2] + up.rect[3]) / 2];
    out.push({ name: 'climb', zone: up.i, material: dress.zones[up.i]?.material, hero: at, screenH: H, pose: frame(up, at[0], at[1]) });
  }
  const room = L.zones.find((Z) => Z.kind === 'room' && Z.teach === 'boss') ?? L.zones.find((Z) => Z.kind === 'room');
  if (room) { const s = (room.rect[0] + room.rect[1]) / 2, z = room.exit[1]; out.push({ name: 'boss', zone: room.i, material: dress.zones[room.i]?.material, hero: [s, z], screenH: H, pose: frame(room, s, z) }); }
  return out;
}

/** The payload as its ROLE PASS: each face its role's flat colour, the hero's stand-in where the shot stands it. */
export function rolePayload(payload, shot, stature) {
  const [s, z] = shot.hero, w = 0.35 * stature;
  const hero = { corners: [[0.6, s - w / 2, z], [0.6, s + w / 2, z], [0.6, s + w / 2, z + stature], [0.6, s - w / 2, z + stature]], normal: [1, 0, 0], fill: ROLE_COLOURS.hero, group: 'sidemap:hero' };
  return { ...payload, bg: ROLE_COLOURS.sky, sky: null, haze: null, ao: null, faces: [...payload.faces.map(({ cornerFills: _c, texture: _t, uv: _u, textureLit: _l, ...f }) => ({ ...f, fill: ROLE_COLOURS[roleOf(f.group)] })), hero] };
}

// (the foreground's colour is where two others blend at an edge (the closed parts' and the back's): read only near its own)
const FORE = ROLES.indexOf('fore');
const nearest = (r, g, b) => { let k = 0, d = Infinity; RGB.forEach((c, i) => { const e = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (e < d && (i !== FORE || e < 900)) { d = e; k = i; } }); return ROLES[k]; };
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : v), r3 = (v) => Math.round(v * 1000) / 1000;
/** The measures of one shot: its page and its role pass, decoded. */
export function measureShot({ page, roles, flat = null }, shot) {
  const { W, H } = roles, n = W * H, role = new Array(n), L = new Float32Array(n), lab = new Array(n);
  for (let i = 0; i < n; i++) {
    role[i] = nearest(roles.rgb[3 * i], roles.rgb[3 * i + 1], roles.rgb[3 * i + 2]);
    lab[i] = srgbToLab(page.rgb[3 * i], page.rgb[3 * i + 1], page.rgb[3 * i + 2]); L[i] = lab[i][0];
  }
  const count = (k) => { let c = 0; for (let i = 0; i < n; i++) if (role[i] === k) c++; return c >= 40 ? c : 0; };
  // (a role on a sliver of the frame is the role pass's own antialiasing, two colours blended at an edge: not read)
  const of = (k) => { const out = []; for (let i = 0; i < n; i++) if (role[i] === k) out.push(i); return out.length >= SLIVER * n ? out : []; };
  const stat = (ix) => { if (!ix.length) return null; let m = 0; for (const i of ix) m += L[i]; m /= ix.length; let v = 0; for (const i of ix) v += (L[i] - m) ** 2; return { n: ix.length, mean: r2(m), std: r2(Math.sqrt(v / ix.length)) }; };
  // (a role's Laplacian energy on the page's lightness, over its pixels whose four neighbours share the role)
  // (the lane's layer is its closed parts and its tops together: the caps on them are the lane's own detail)
  const layerOf = (r) => (r === 'top' || r === 'jamb' ? 'closed' : r);
  const sharp = (k) => { if (!of(k).length) return null; let e = 0, c = 0; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (layerOf(role[i]) !== k || layerOf(role[i - 1]) !== k || layerOf(role[i + 1]) !== k || layerOf(role[i - W]) !== k || layerOf(role[i + W]) !== k) continue; const l = 4 * L[i] - L[i - 1] - L[i + 1] - L[i - W] - L[i + W]; e += l * l; c++; } return c ? r2(e / c) : null; };
  const hueOf = (ix) => { let a = 0, b = 0; for (const i of ix) { a += lab[i][1]; b += lab[i][2]; } return ix.length && Math.hypot(a, b) > 1e-6 ? ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 : null; };
  // the hero's rows (its stand-in's extent down the frame), the top under it (the first top row below its feet, at its column)
  let y0 = H, y1 = -1, xs = 0, xc = 0;
  for (let i = 0; i < n; i++) if (role[i] === 'hero') { const y = Math.floor(i / W); y0 = Math.min(y0, y); y1 = Math.max(y1, y); xs += i % W; xc++; }
  const hx = xc ? Math.round(xs / xc) : Math.round(W / 2);
  let lane = null;
  if (xc) for (let y = y1; y < H; y++) if (role[y * W + hx] === 'top') { lane = y; break; }
  const closed = of('closed'), back = of('back'), hills = of('hills'), range = of('range'), play = of('play'), top = of('top');
  const hp = hueOf(play), hc = hueOf(closed), apart = hp === null || hc === null ? null : Math.min(Math.abs(hp - hc), 360 - Math.abs(hp - hc));
  return {
    shot: shot.name,
    hero: xc ? r3((y1 - y0 + 1) / H) : null,
    lane: lane === null ? null : r3(lane / H),
    hue: apart === null ? null : r2(apart),
    litTops: top.length && closed.length ? r2(stat(top).mean - stat(closed).mean) : null,
    painted: closed.length ? stat(closed).std : null,
    sharp: { closed: sharp('closed'), back: sharp('back'), hills: sharp('hills'), range: sharp('range') },
    recedes: { closed: stat(closed)?.std ?? null, back: stat(back)?.std ?? null, hills: stat(hills)?.std ?? null, range: stat(range)?.std ?? null },
    // (a lamp and the boss's mark are small things by design: counted whole, past a few dozen pixels)
    lamps: count('lamp'), boss: count('boss'),
    topStd: top.length ? stat(top).std : null,
    jambStd: of('jamb').length ? stat(of('jamb')).std : null,
    // (the glints: what the bake adds over the paint, the page against its flat twin (one baked key, no finish), on the
    // lane: how far its brightest thirty-third stands over its median; read only where a twin is given)
    glint: (() => {
      if (!flat) return null;
      const ix = [...closed, ...top]; if (ix.length < 100) return null;
      const v = ix.map((i) => L[i] - srgbToLab(flat.rgb[3 * i], flat.rgb[3 * i + 1], flat.rgb[3 * i + 2])[0]).sort((a, b) => a - b);
      return r2(v[Math.floor(0.97 * (v.length - 1))] - v[Math.floor(v.length / 2)]);
    })(),
    material: shot.material ?? null,
    shares: Object.fromEntries(ROLES.map((k) => [k, r2(of(k).length / n)])),
    light: lightOf({ W, H, n, role, L, of, screenH: shot.screenH ?? 13.36 }),
    // (the foreground: its share, and its pixels over the hero's feet in the hero's columns: under the feet line, none)
    fore: (() => { const f = of('fore'); if (!f.length || !xc) return f.length ? { share: r3(f.length / n), over: null } : null; let x0 = W, x1 = -1; for (let i = 0; i < n; i++) if (role[i] === 'hero') { const x = i % W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); } let over = 0; for (const i of f) { const x = i % W; if (x >= x0 && x <= x1 && Math.floor(i / W) <= y1) over++; } return { share: r3(f.length / n), over }; })(),
    moving: false,
  };
}

// the light, read on the page by role: the back near a lamp against far from one, a closed face just under its lip against
// lower down, the lane's layer against the back, and the frame's top third of back against its foot's
function lightOf({ W, H, n, role, L, of, screenH }) {
  const mean = (ix) => (ix.length ? ix.reduce((m, i) => m + L[i], 0) / ix.length : null);
  const lamps = [], back = of('back');
  for (let i = 0; i < n; i += 3) if (role[i] === 'lamp') lamps.push(i);
  let lamp = null;
  // (a lamp's own pool in the frame: a whole lamp's pixels, not a neighbour's corner at its edge)
  if (lamps.length * 3 >= LAMP_WHOLE && back.length) {
    const near = [], far = [], dNear = 0.06 * W, dFar = 0.22 * W;
    for (const i of back) { const x = i % W, y = (i - x) / W; let d = Infinity; for (const j of lamps) { const dx = (j % W) - x, dy = ((j - (j % W)) / W) - y; d = Math.min(d, dx * dx + dy * dy); } d = Math.sqrt(d); if (d < dNear) near.push(i); else if (d > dFar) far.push(i); }
    const a = mean(near), b = mean(far);
    lamp = a !== null && b !== null ? r2(a - b) : null;
  }
  // (each column: closed pixels a hand under a top, past its lit edge and a built fill's trim (0.45 to 0.9 m), against those
  // a body's height under it (1.3 to 2 m), where the column stays closed; in screen rows at the frame's own metres)
  const lipNear = [], lipFar = [];
  const m = H / screenH, a0 = Math.round(0.45 * m), a1 = Math.round(0.9 * m), b0 = Math.round(1.3 * m), b1 = Math.round(2 * m);
  for (let x = 0; x < W; x += 4) for (let y = 1; y < H - b1 - 1; y++) {
    const i = y * W + x;
    if (role[i] !== 'top' || role[i + W] === 'top') continue;
    let ok = true; for (let k = 2; k <= b1 && ok; k++) ok = role[i + k * W] === 'closed' || (k < a0 && role[i + k * W] === 'top');
    if (!ok) continue;
    for (let k = a0; k <= a1; k++) lipNear.push(i + k * W);
    for (let k = b0; k <= b1; k++) lipFar.push(i + k * W);
  }
  // (medians: a fill's courses and seams are thin lines on the level's own grid, and a mean reads where they fall)
  const median = (ix) => { if (!ix.length) return null; const v = ix.map((i) => L[i]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const lip = lipNear.length ? r2(median(lipFar) - median(lipNear)) : null;
  const closed = of('closed'), laneOverBack = closed.length && back.length ? r2(mean(closed) - mean(back)) : null;
  const third = (lo, hi) => back.filter((i) => { const y = Math.floor(i / W); return y >= lo * H && y < hi * H; });
  const t = mean(third(0, 1 / 3)), f = mean(third(2 / 3, 1)), topOverFoot = t !== null && f !== null ? r2(t - f) : null;
  return { lamp, lip, laneOverBack, topOverFoot };
}

/** The benchmark's laws over the shots' measures: advisory, each against its principle. */
export function benchmarkLaws(measures) {
  const out = [], law = (id, shot, holds, says) => out.push({ id, shot, holds: !!holds, says });
  for (const M of measures) {
    if (M.hero !== null) law('hero-share', M.shot, Math.abs(M.hero - 1 / 8) <= 0.02, `the hero stands ${Math.round(1000 * M.hero) / 10}% of the frame's height (an eighth: 12.5%)`);
    if (M.shot === 'run') law('lane-down', M.shot, M.lane !== null && Math.abs(M.lane - 2 / 3) <= 0.05, M.lane === null ? 'no top under the hero in the frame' : `the top under the hero ${Math.round(1000 * M.lane) / 10}% down the frame (two thirds: 66.7%)`);
    if (M.hue !== null) law('play-against-place', M.shot, M.hue >= 90, `play and place ${M.hue}° apart (opposite: past 90°)`);
    if (M.litTops !== null) law('lit-tops', M.shot, M.litTops >= 5, `the tops ${M.litTops} L* over the closed parts`);
    if (M.painted !== null) law('painted', M.shot, M.painted >= 3, `the closed parts' lightness varies by ${M.painted} L* (a plain face: under 3)`);
    const S = M.sharp, behind = [S.back, S.hills, S.range].filter((v) => v !== null);
    if (S.closed !== null && behind.length) law('lane-sharpest', M.shot, behind.every((v) => S.closed >= v), `the lane's layer ${S.closed}, behind it ${behind.join(', ')} (Laplacian energy)`);
    const R = M.recedes, back = [R.back, R.hills, R.range].filter((v) => v !== null);
    if (R.closed !== null && back.length) law('recedes', M.shot, back.every((v) => R.closed >= v), `contrast ${R.closed} in the lane's layer, ${back.join(', ')} behind it`);
    if (M.shot === 'run' && M.shares.back > 0) law('lamps', M.shot, M.lamps > 0, M.lamps ? `${M.lamps} px of lamps: light with a source` : 'no lamp in an indoor run\'s frame');
    if (M.shot === 'boss') law('boss-mark', M.shot, M.boss > 0, M.boss ? 'the boss\'s mark on its room\'s back wall' : 'no mark of the boss\'s in its room');
    const G = M.light ?? {};
    if (G.lamp !== null && G.lamp !== undefined) law('lamp-falloff', M.shot, G.lamp >= 5, `the back ${G.lamp} L* lighter near a lamp than far from it (its light falls off: 5 or more)`);
    // (a climb's own light rises up its frame: under a lip there is read against it, so the climb's shot does not say)
    if (M.shot !== 'climb' && G.lip !== null && G.lip !== undefined) law('ledge-shadow', M.shot, G.lip >= 1.5, `a closed face ${G.lip} L* darker just under its lip than lower down (contact: 1.5 or more)`);
    if (M.shares.back > 0.05 && G.laneOverBack !== null && G.laneOverBack !== undefined) law('lane-lit', M.shot, G.laneOverBack >= 10, `the lane's layer ${G.laneOverBack} L* over the back (a step: 10 or more)`);
    if (M.shot === 'climb' && G.topOverFoot !== null && G.topOverFoot !== undefined) law('light-at-the-top', M.shot, G.topOverFoot >= 3, `the shaft's back ${G.topOverFoot} L* lighter at the frame's top than at its foot (the way up a patch of light: 3 or more)`);
    // (the top a hero stands on in segments, never one smooth band: its lightness varies along it)
    // (a material that reflects shows it: its glints and sheen stand over the lane's median, cake.js finishes)
    if (['kibble', 'plate', 'snow'].includes(M.material) && M.glint !== null) law('reflective', M.shot, M.glint >= 8, `the lane's glints ${M.glint} L* over its median, over the paint (${M.material}: 8 or more)`);
    if (M.jambStd !== null && M.jambStd !== undefined) law('walls-segmented', M.shot, M.jambStd >= 3, `the walls' edges vary by ${M.jambStd} L* (one smooth band: under 3)`);
    if (M.topStd !== null && M.topStd !== undefined) law('top-segmented', M.shot, M.topStd >= 3, `the tops' lightness varies by ${M.topStd} L* (one smooth band: under 3)`);
    if (M.fore) law('foreground', M.shot, M.fore.over === 0, M.fore.over ? `the foreground (${Math.round(1000 * M.fore.share) / 10}% of the frame) stands over the hero's feet by ${M.fore.over} px` : `a foreground under the feet, ${Math.round(1000 * M.fore.share) / 10}% of the frame`);
    // (a run's frame carries the icing's foreground; a climb's and a room's say only where one stands in it)
    else if (M.shot === 'run') law('foreground', M.shot, false, 'no foreground in the run\'s frame');
    law('moving', M.shot, M.moving, 'nothing moves beside the way: the map animates nothing yet');
  }
  return out;
}
