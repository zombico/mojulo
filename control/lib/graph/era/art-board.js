/**
 * THE ART BOARD — a room stage's art direction drawn for approval before it is built, in mojulo's own web graphics
 * (no image model): one SVG of five panels, each an item the operator approves or sends back.
 *
 *   1 palette       the ramps, darkest to lightest, each surface's own
 *   2 materials     the ACTUAL tiles the build will lay (the generators' PNGs, not a mock-up)
 *   3 architecture  one wall elevation (two bays: a niche, an arched doorway, the torch) and the room's section (the
 *                   vault), drawn from the same proportions the builder reads, dimensioned
 *   4 motifs        the repeating element, the accent wall, the corner things
 *   5 plan          the rooms from above: doorways, the walk, the set piece, the accent wall
 *
 * `artBoardSvg(manifest)` is pure; `artBoardPng(manifest)` rasterizes it with sharp (lazy; absent, it throws
 * SHARP_UNAVAILABLE and the caller falls back to the SVG).
 */
import { planStage, buildStageGeometry, STAGE_KITS } from './stage.js';
import { cryptTomb, accentWall } from './crypt.js';
import { walkLine } from './dirt.js';
import { tileFamilyOf } from './tile-specs.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { roundArch } from './arches.js';
import { artForBuild } from './art-direction.js';
import { loadSharp } from '../../sharp-lazy.js';

export const BOARD = Object.freeze({ w: 1200, h: 880 });
const KIT_NAMES = { 'gothic-stone': 'castle dungeon', catacomb: 'catacomb' };
const STATUS_COLOUR = { proposed: '#e8b04a', approved: '#6cc070', auto: '#8a93a6' };
const INK = '#e9e4da', DIM = '#9a958c', PANEL = '#1e2026', BG = '#14161a';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const f1 = (x) => Math.round(x * 10) / 10;
const text = (x, y, s, { size = 13, fill = INK, anchor = 'start', weight = 400 } = {}) => `<text x="${f1(x)}" y="${f1(y)}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${fill}" ${extra}/>`;
const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')}" fill="${fill}" ${extra}/>`;
const line = (pts, stroke, w = 1, extra = '') => `<polyline points="${pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;

function panel(x, y, w, h, n, title, status, sub = '') {
  const c = STATUS_COLOUR[status] || DIM;
  return [
    rect(x, y, w, h, PANEL, 'rx="6"'),
    text(x + 14, y + 24, `${n}  ${title}`, { size: 15, weight: 700 }),
    sub ? text(x + 14, y + 42, sub, { size: 12, fill: DIM }) : '',
    rect(x + w - 104, y + 10, 92, 20, 'none', `rx="10" stroke="${c}" stroke-width="1.5"`),
    text(x + w - 58, y + 24, (status || 'proposed').toUpperCase(), { size: 11, fill: c, anchor: 'middle', weight: 700 }),
  ].join('');
}

function palettePanel(x, y, P, status) {
  const rows = [['walls', P.stone], ['floor', P.floor], ['vault', P.vault], ['trim', P.trim], ['wood', P.wood], ['accent', P.accent]];
  const out = [panel(x, y, 560, 300, 1, 'PALETTE', status, `stone: ${P.family} · ramps run shade (cool) to light (warm)`)];
  rows.forEach(([name, R], i) => {
    const ry = y + 60 + i * 34;
    out.push(text(x + 14, ry + 20, name, { size: 13, fill: DIM }));
    R.forEach((c, k) => out.push(rect(x + 90 + k * 62, ry, 58, 28, hex(c), 'rx="3"')));
    out.push(text(x + 410, ry + 19, hex(R[2]), { size: 12, fill: DIM }));
  });
  out.push(text(x + 14, y + 284, 'torchlight', { size: 13, fill: DIM }), `<circle cx="${x + 119}" cy="${y + 279}" r="12" fill="${hex(P.light)}"/>`, text(x + 140, y + 284, hex(P.light), { size: 12, fill: DIM }));
  return out.join('');
}

function materialsPanel(x, y, tiles, status) {
  const out = [panel(x, y, 600, 300, 2, 'MATERIALS', status, 'the tiles the build lays, exactly')];
  tiles.forEach(([name, key, note], i) => {
    const tx = x + 14 + (i % 3) * 194, ty = y + 54 + Math.floor(i / 3) * 122, url = surfaceTexture(key);
    if (url) out.push(`<image x="${tx}" y="${ty}" width="96" height="96" href="${url}" preserveAspectRatio="none"/>`);
    out.push(rect(tx, ty, 96, 96, 'none', 'stroke="#000" stroke-opacity="0.4"'));
    out.push(text(tx + 104, ty + 18, name, { size: 13, weight: 700 }), text(tx + 104, ty + 36, note, { size: 11, fill: DIM }));
  });
  return out.join('');
}

/** The elevation (two bays of one wall) and the section (the room across, its vault), at a common scale. */
function architecturePanel(x, y, plan, P, status) {
  const k = plan.kit, out = [panel(x, y, 560, 440, 3, 'ARCHITECTURE', status, 'one wall, two bays · the room across · metres')];
  const H = 5, bay = k.bay, s = Math.min(250 / (2 * bay), 290 / (H + 3.4), 186 / 6), gx = x + 24, gy = y + 400;   // ground line
  const X = (u) => gx + u * s, Y = (z) => gy - z * s, c = (r) => hex(r);
  const wall = c(P.stone[2]), trim = c(P.trim[3]), dark = c(P.stone[0]), niche = c([18, 16, 15]);
  // the wall, its plinth and cornice
  out.push(rect(X(0), Y(H), 2 * bay * s, H * s, wall));
  out.push(rect(X(0), Y(k.plinth.h), 2 * bay * s, k.plinth.h * s, trim), rect(X(0), Y(H), 2 * bay * s, k.cornice.h * s, trim));
  // bay 1: the repeating niche (its head, its tiers)
  const N = k.dress.niches, wd = Math.min(N.w, (bay - k.pilaster.w) * 0.6), round = N.head === 'round', nh = N.h + (round ? wd / 2 : 0);
  const top = H - k.cornice.h, z0 = k.plinth.h + N.sill, tiers = Math.max(1, Math.min(N.tiers ?? 2, Math.floor((top - z0 - 0.3 + N.gap) / (nh + N.gap))));
  for (let t = 0; t < tiers; t++) {
    const zb = z0 + t * (nh + N.gap), u0 = bay / 2 - wd / 2, u1 = bay / 2 + wd / 2, f = N.frame;
    // heads run left to right (a round arch, or a flat lintel); each outline closes by walking its head back
    const head = round ? roundArch(u0, u1, zb + N.h, wd / 2, 10).map((p) => [X(p.u), Y(p.z)]) : [[X(u0), Y(zb + N.h)], [X(u1), Y(zb + N.h)]];
    const ring = round ? roundArch(u0 - f, u1 + f, zb + N.h, wd / 2 + f, 10).map((p) => [X(p.u), Y(p.z)]) : [[X(u0 - f), Y(zb + N.h + f)], [X(u1 + f), Y(zb + N.h + f)]];
    out.push(poly([[X(u0 - f), Y(zb - f)], [X(u1 + f), Y(zb - f)], ...ring.reverse()], trim));
    out.push(poly([[X(u0), Y(zb)], [X(u1), Y(zb)], ...head.reverse()], niche));
  }
  // bay 2: the arched doorway with its archivolt
  const dw = 2, dh = Math.min(k.door.height, H - 0.5), du0 = bay * 1.5 - dw / 2, du1 = du0 + dw, fw = k.door.frame;
  const arch = k.arch && k.arch.door, zs = arch ? dh - dw / 2 : dh;
  const ringO = arch ? roundArch(du0 - fw, du1 + fw, zs, dw / 2 + fw, 12).map((p) => [X(p.u), Y(p.z)]) : [[X(du0 - fw), Y(dh + fw)], [X(du1 + fw), Y(dh + fw)]];
  const open = arch ? roundArch(du0, du1, zs, dw / 2, 12).map((p) => [X(p.u), Y(p.z)]) : [[X(du0), Y(dh)], [X(du1), Y(dh)]];
  out.push(poly([[X(du0 - fw), Y(0)], [X(du1 + fw), Y(0)], ...ringO.slice().reverse()], trim));
  out.push(poly([[X(du0), Y(0)], [X(du1), Y(0)], ...open.slice().reverse()], c([10, 9, 9])));
  // the pilasters, and the torch on the middle one
  for (const u of [0, bay, 2 * bay]) out.push(rect(X(u - k.pilaster.w / 2), Y(top), k.pilaster.w * s, (top - k.plinth.h) * s, trim, `stroke="${dark}" stroke-width="0.6"`));
  out.push(line([[X(bay), Y(k.torch.z - 0.35)], [X(bay), Y(k.torch.z)]], '#3a2d22', 3), `<ellipse cx="${f1(X(bay))}" cy="${f1(Y(k.torch.z + 0.18))}" rx="${f1(0.09 * s)}" ry="${f1(0.2 * s)}" fill="${hex(P.light)}"/>`);
  out.push(line([[gx - 8, gy], [X(2 * bay) + 8, gy]], DIM, 1));
  // dimensions
  const dim = (x1, y1, x2, y2, label, dx = 6) => [line([[x1, y1], [x2, y2]], DIM, 0.8), text(x1 + dx, (y1 + y2) / 2 + 4, label, { size: 10, fill: DIM })].join('');
  out.push(dim(X(2 * bay) + 10, Y(0), X(2 * bay) + 10, Y(k.plinth.h), `plinth ${k.plinth.h}`), dim(X(2 * bay) + 10, Y(H - k.cornice.h), X(2 * bay) + 10, Y(H), `cornice ${k.cornice.h}`));
  out.push(text(X(bay), gy + 16, `bay ${bay} · pilaster ${k.pilaster.w}`, { size: 10, fill: DIM, anchor: 'middle' }), text(X(bay * 1.5), Y(dh + fw) - 6, `door ${f1(dh)}`, { size: 10, fill: DIM, anchor: 'middle' }));
  // the section: an 8 m room across, its vault on the springing line
  const span = 6, sx = x + 362, S = s, XS = (u) => sx + u * S, rise = k.arch && k.arch.vault ? Math.min(span / 2, k.arch.vault.maxRise ?? span / 2, (k.arch.vault.rise ?? 0.5) * span) : 0;
  const vault = rise > 0 ? roundArch(0, span, H, rise, 16).map((p) => [XS(p.u), gy - p.z * S]) : [[XS(0), gy - H * S], [XS(span), gy - H * S]];
  out.push(poly([[XS(0), gy], [XS(span), gy], ...vault.slice().reverse()], c(P.stone[1])));
  out.push(line(vault, c(P.vault[3]), 3), line([[XS(-0.3), gy], [XS(span + 0.3), gy]], DIM, 1));
  out.push(rect(XS(0) - 3, gy - H * S, 6, H * S, trim), rect(XS(span) - 3, gy - H * S, 6, H * S, trim));
  out.push(text(XS(span / 2), gy + 16, rise > 0 ? `barrel vault · rise ${f1(rise)} over 6 m` : 'flat ceiling', { size: 10, fill: DIM, anchor: 'middle' }));
  return out.join('');
}

const PROP_GLYPH = {
  crate: (x, y, c) => rect(x - 14, y - 28, 28, 28, c.wood, `stroke="${c.dark}"`) + line([[x - 14, y - 28], [x + 14, y]], c.dark, 1.2),
  barrel: (x, y, c) => `<rect x="${x - 12}" y="${y - 32}" width="24" height="32" rx="9" fill="${c.wood}" stroke="${c.dark}"/>` + line([[x - 12, y - 24], [x + 12, y - 24]], '#333', 2) + line([[x - 12, y - 8], [x + 12, y - 8]], '#333', 2),
  planks: (x, y, c) => [0, 1, 2].map((i) => line([[x - 16 + i * 8, y], [x - 6 + i * 8, y - 36]], c.wood, 5)).join(''),
  stones: (x, y, c) => [[-9, -6, 7], [5, -5, 6], [-1, -14, 6]].map(([dx, dy, r]) => `<circle cx="${x + dx}" cy="${y + dy}" r="${r}" fill="${c.stone}"/>`).join(''),
  boulder: (x, y, c) => `<ellipse cx="${x}" cy="${y - 14}" rx="17" ry="14" fill="${c.stone}"/>`,
  debris: (x, y, c) => [[-12, -3], [-4, -5], [5, -2], [11, -4], [0, -9], [-8, -10]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="2.6" fill="${c.stone}"/>`).join(''),
  amphora: (x, y, c) => `<path d="M${x - 4} ${y - 38} h8 v5 q12 6 10 20 q-2 12 -9 13 h-10 q-7 -1 -9 -13 q-2 -14 10 -20 z" fill="#9e6a4c"/>`,
  bones: (x, y, c) => line([[x - 14, y - 4], [x + 14, y - 12]], c.bone, 4) + line([[x - 12, y - 14], [x + 13, y - 2]], c.bone, 4) + `<circle cx="${x + 2}" cy="${y - 22}" r="8" fill="${c.bone}"/>`,
};

function motifsPanel(x, y, plan, P, status) {
  const k = plan.kit, D = k.dress, N = D.niches, out = [panel(x, y, 290, 440, 4, 'MOTIFS', status)];
  const c = { wood: hex(P.wood[3]), dark: hex(P.wood[0]), stone: hex(P.stone[1]), bone: hex(P.accent[3]) };
  out.push(text(x + 14, y + 54, 'repeats on every bare bay', { size: 12, fill: DIM }));
  // the niche, at a glyph's size
  const nx = x + 40, ny = y + 140, w = 50, round = N.head === 'round';
  out.push(rect(nx - 8, ny - 70, w + 16, 86, hex(P.stone[2]), 'rx="2"'));
  out.push(round ? `<path d="M${nx} ${ny} v-34 a${w / 2} ${w / 2} 0 0 1 ${w} 0 v34 z" fill="#121010" stroke="${hex(P.trim[3])}" stroke-width="4"/>` : rect(nx, ny - 26, w, 22, '#121010', `stroke="${hex(P.trim[3])}" stroke-width="4"`));
  out.push(text(nx + w + 22, ny - 40, round ? 'arched niche' : N.sealed !== undefined ? 'loculus slot' : 'square niche', { size: 13, weight: 700 }), text(nx + w + 22, ny - 22, `${N.tiers} tier${N.tiers > 1 ? 's' : ''} · urns ${Math.round(N.urns * 100)}%`, { size: 11, fill: DIM }));
  if (N.sealed !== undefined) out.push(text(nx + w + 22, ny - 6, `sealed ${Math.round(N.sealed * 100)}%`, { size: 11, fill: DIM }));
  // the accent wall
  const ay = y + 200, ossuary = !!D.accent.skulls;
  out.push(text(x + 14, ay, 'one accent wall, behind the set piece', { size: 12, fill: DIM }));
  out.push(rect(x + 14, ay + 10, 262, 70, hex(P.accent[2])));
  for (let r = 0; r < 4; r++) for (let q = 0; q < (ossuary ? 14 : 5); q++) {
    const bw = ossuary ? 18 : 52, bh = ossuary ? 16 : 16;
    out.push(rect(x + 16 + q * (bw + 1) + (r % 2) * (bw / 2) - (r % 2 ? bw / 2 : 0), ay + 12 + r * (bh + 1), bw - 1, bh, hex(P.accent[1 + ((q + r) % 3)])));
  }
  if (ossuary) for (let q = 0; q < 10; q++) out.push(`<circle cx="${x + 30 + q * 25}" cy="${ay + 46}" r="8" fill="${hex(P.accent[4])}"/>`, `<circle cx="${x + 27 + q * 25}" cy="${ay + 45}" r="1.8" fill="#111"/>`, `<circle cx="${x + 33 + q * 25}" cy="${ay + 45}" r="1.8" fill="#111"/>`);
  out.push(text(x + 14, ay + 98, ossuary ? 'ossuary: bone ends, rows of skulls' : 'larger, darker ashlar; no niches', { size: 11, fill: DIM }));
  // the corner things
  const py = y + 330;
  out.push(text(x + 14, py, 'corner things, where floor meets wall', { size: 12, fill: DIM }));
  D.props.kinds.forEach((kind, i) => {
    const gx = x + 36 + (i % 5) * 54, gy = py + 62;
    out.push((PROP_GLYPH[kind] || (() => ''))(gx, gy, c), text(gx, gy + 16, kind, { size: 10, fill: DIM, anchor: 'middle' }));
  });
  return out.join('');
}

function planPanel(x, y, plan, P, status) {
  const out = [panel(x, y, 290, 440, 5, 'PLAN', status, `${plan.rooms.length} rooms · walk ends at the set piece`)];
  const xs = plan.rooms.flatMap((r) => r.box.filter((_, i) => i % 2 === 0)), ys = plan.rooms.flatMap((r) => r.box.filter((_, i) => i % 2 === 1));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(250 / (maxX - minX), 340 / (maxY - minY)), ox = x + 20 + (250 - (maxX - minX) * s) / 2, oy = y + 60 + (340 - (maxY - minY) * s) / 2;
  const X = (v) => ox + (v - minX) * s, Y = (v) => oy + (maxY - v) * s;   // north up
  for (const r of plan.rooms) {
    out.push(rect(X(r.box[0]), Y(r.box[3]), (r.box[2] - r.box[0]) * s, (r.box[3] - r.box[1]) * s, hex(P.floor[1]), `stroke="${hex(P.stone[3])}" stroke-width="3"`));
    out.push(text(X(r.box[0]) + 5, Y(r.box[3]) + 13, r.id, { size: 10, fill: INK }));
  }
  for (const l of plan.links) {
    const along = l.wall.endsWith('y');
    out.push(line(along ? [[X(l.lo), Y(l.at)], [X(l.hi), Y(l.at)]] : [[X(l.at), Y(l.lo)], [X(l.at), Y(l.hi)]], hex(P.floor[3]), 5));
  }
  out.push(line(walkLine(plan).map(([a, b]) => [X(a), Y(b)]), hex(P.light), 1.5, 'stroke-dasharray="4 3"'));
  if (plan.kit.dress && plan.kit.dress.tomb) {
    const geom = buildStageGeometry(plan), tomb = cryptTomb(plan), tc = [tomb.corners.reduce((a, q) => a + q[0], 0) / 4, tomb.corners.reduce((a, q) => a + q[1], 0) / 4];
    const acc = accentWall(plan, geom.pilasters, tc);
    if (acc) { const a = acc.F.o, b = [a[0] + acc.F.U[0] * acc.F.len, a[1] + acc.F.U[1] * acc.F.len]; out.push(line([[X(a[0]), Y(a[1])], [X(b[0]), Y(b[1])]], hex(P.accent[3]), 5)); }
    out.push(`<rect x="${f1(X(tc[0]) - 6)}" y="${f1(Y(tc[1]) - 4)}" width="12" height="8" fill="${INK}"/>`);
  }
  out.push(text(x + 14, y + 426, 'dashed: the walk · bright edge: the accent wall', { size: 10, fill: DIM }));
  return out.join('');
}

/** The board for a room stage recipe with an art direction. → SVG text. */
export function artBoardSvg(manifest) {
  const kitId = manifest.kit || 'gothic-stone', art = artForBuild(kitId, manifest.art), status = manifest.art && manifest.art.status || {};
  const plan = planStage(manifest), k = plan.kit, P = art.palette;
  const fam = (part) => k.tiles[part].family ? `${k.tiles[part].family}-a` : k.tiles[part].key;
  const tiles = [
    ['walls', fam('wall'), art.materials.wall.gen], ['floor', fam('floor'), art.materials.floor.gen], ['vault', fam('ceiling'), art.materials.ceiling.gen],
    ['trim', fam('trim'), art.materials.trim.gen], ['wood', `${tileFamilyOf(k.dress.props.wood.light)}-a`, 'props'], ['accent', `${tileFamilyOf({ gen: 'stone-brick', ...k.dress.accent.stone })}-a`, k.dress.accent.skulls ? 'ossuary' : 'ashlar'],
  ];
  const { w, h } = BOARD;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    rect(0, 0, w, h, BG),
    text(20, 38, `ART DIRECTION · ${KIT_NAMES[kitId] || kitId}`, { size: 22, weight: 700 }),
    text(20, 58, `${manifest.title || ''}${art.seed ? ` seed ${art.seed}` : ''} · approve or send back each item; nothing is built from an item you reject`, { size: 12, fill: DIM }),
    palettePanel(20, 70, P, status.palette),
    materialsPanel(590, 70, tiles, status.materials),
    architecturePanel(20, 390, plan, P, status.architecture),
    motifsPanel(590, 390, plan, P, status.motifs),
    planPanel(890, 390, plan, P, status.plan),
    '</svg>',
  ].join('');
}

/** The board as a PNG (sharp). Throws SHARP_UNAVAILABLE without it. */
export async function artBoardPng(manifest) {
  const sharp = await loadSharp();
  return sharp(Buffer.from(artBoardSvg(manifest))).png().toBuffer();
}

export const artKits = () => Object.keys(KIT_NAMES).filter((k) => STAGE_KITS[k]);
