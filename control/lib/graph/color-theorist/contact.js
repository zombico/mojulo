/**
 * THE CONTACT SHEET — palettes side by side, each painted into the same small landscape, so the only thing that differs
 * between two thumbnails is the palette. The test of the thesis: laid out by the dozen, do they read as different
 * games, or is there a house look? A human answers that (the eyes gate); `sheetStats` measures the machine half.
 *
 *   thumbnail(contract, { w?, h? })   → an SVG: sky (zenith to horizon), a cloud, the sun in the light's colour, three
 *                                       far ridges, the ground's hills, the soil's trail, a rock, trees (bark,
 *                                       foliage), a house (made, rope) flying the accent, the fog, and a HUD strip
 *   contactSheet(sections, { title? }) → a whole HTML page: sections of { title, says?, stats?: false, rows: [{ label,
 *                                       contract }] }, on a neutral grey (a colour surround biases the eye)
 *   sheetStats(contracts)             → the spread: nearest-neighbour distances, the ground's and sky's hue bins,
 *                                       keys, schemes, the ground's lightness range
 *
 * Pure: a contract in, text out.
 */
import { hexToRgb, lchOf } from './oklab.js';
import { signatureOf, paletteDistance } from './ledger.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (v) => Math.round(v * 10) / 10;

const hud = (U, sx, sy) => `<rect x="${r1(4 * sx)}" y="${r1(4 * sy)}" width="${r1(58 * sx)}" height="${r1(12 * sy)}" rx="${r1(2 * sx)}" fill="${U.panel}" stroke="${U.line}" stroke-width="${r1(0.6 * sx)}"/>`
  + `<text x="${r1(8 * sx)}" y="${r1(12.5 * sy)}" font-family="system-ui, sans-serif" font-size="${r1(7 * sy)}" font-weight="600" fill="${U.ink}">HP</text>`
  + `<rect x="${r1(20 * sx)}" y="${r1(8 * sy)}" width="${r1(30 * sx)}" height="${r1(4 * sy)}" fill="${U.bg}"/><rect x="${r1(20 * sx)}" y="${r1(8 * sy)}" width="${r1(21 * sx)}" height="${r1(4 * sy)}" fill="${U.accent}"/>`
  + `<circle cx="${r1(56 * sx)}" cy="${r1(10 * sy)}" r="${r1(2.2 * sx)}" fill="${U.accent2}"/>`;

/** A palette with thin air or none, painted into the sheet's other place: a cratered plain, a crater rim far off, and a
 *  lander. In vacuum the sky is the void (stars, a nebula, a planet whose dark side is the palette's shadow) and the
 *  shadows are hard; in thin air the sky is the dust's and the distance a little hazed. */
function spaceScape(K, { w, h }) {
  const R = K.roles, U = K.ui, id = K.id.replace(/[^a-z0-9-]/gi, ''), vac = K.read.air === 'none';
  const sx = w / 200, sy = h / 130, X = (v) => r1(v * sx), Y = (v) => r1(v * sy), P = (pts) => pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
  let q = 7;
  const rnd = () => { q = (q * 16807) % 2147483647; return q / 2147483647; };
  const stars = vac ? Array.from({ length: 34 }, () => `<circle cx="${X(rnd() * 200)}" cy="${Y(rnd() * 64)}" r="${r1((0.3 + rnd() * 0.5) * sx)}" fill="${K.light}" opacity="${r1(0.4 + rnd() * 0.6)}"/>`).join('') : '';
  const crater = (x, y, rx) => `<ellipse cx="${X(x)}" cy="${Y(y)}" rx="${X(rx)}" ry="${Y(rx * 0.3)}" fill="${R.ground[4]}"/><ellipse cx="${X(x)}" cy="${Y(y + rx * 0.04)}" rx="${X(rx * 0.86)}" ry="${Y(rx * 0.24)}" fill="${R.ground[1]}"/><ellipse cx="${X(x - rx * 0.2)}" cy="${Y(y + rx * 0.02)}" rx="${X(rx * 0.55)}" ry="${Y(rx * 0.17)}" fill="${R.ground[0]}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(K.id)}">`
    + `<defs><linearGradient id="s-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${R.sky[vac ? 0 : 1]}"/><stop offset="1" stop-color="${R.sky[vac ? 2 : 4]}"/></linearGradient>`
    + `<radialGradient id="g-${id}"><stop offset="0" stop-color="${R.accent2[4]}"/><stop offset="0.4" stop-color="${R.accent2[3]}" stop-opacity="0.8"/><stop offset="1" stop-color="${R.accent2[3]}" stop-opacity="0"/></radialGradient>`
    + `<filter id="b-${id}"><feGaussianBlur stdDeviation="${r1(6 * sx)}"/></filter></defs>`
    + `<rect width="${w}" height="${h}" fill="url(#s-${id})"/>`
    + (vac ? `<g filter="url(#b-${id})" opacity="0.85"><ellipse cx="${X(70)}" cy="${Y(28)}" rx="${X(46)}" ry="${Y(13)}" fill="${R.cloud[2]}"/><ellipse cx="${X(92)}" cy="${Y(22)}" rx="${X(26)}" ry="${Y(9)}" fill="${R.cloud[4]}"/></g>` : '')
    + stars
    + (vac ? `<circle cx="${X(42)}" cy="${Y(40)}" r="${X(15)}" fill="${R.accent2[2]}"/><circle cx="${X(36)}" cy="${Y(37)}" r="${X(15)}" fill="${R.accent2[3]}" opacity="0.6"/><path d="M${X(42)} ${Y(25)} A${X(15)} ${X(15)} 0 0 1 ${X(42)} ${Y(55)} A${X(9)} ${X(15)} 0 0 0 ${X(42)} ${Y(25)}Z" fill="${K.shadow}" opacity="0.85"/>` : '')
    + `<circle cx="${X(166)}" cy="${Y(20)}" r="${X(vac ? 4.5 : 6)}" fill="${K.light}"/>`
    + `<polygon points="${P([[0, 130], [0, 70], [18, 66], [30, 60], [44, 64], [58, 57], [70, 62], [92, 58], [108, 63], [126, 55], [142, 61], [160, 58], [178, 63], [200, 60], [200, 130]])}" fill="${R.far[vac ? 3 : 4]}"/>`
    + `<polygon points="${P([[0, 130], [0, 76], [40, 72], [80, 75], [120, 71], [160, 74], [200, 72], [200, 130]])}" fill="${R.ground[3]}"/>`
    + `<polygon points="${P([[0, 130], [0, 96], [60, 92], [130, 95], [200, 91], [200, 130]])}" fill="${R.ground[2]}"/>`
    + crater(48, 84, 16) + crater(150, 104, 24) + crater(98, 80, 7)
    + `<polygon points="${P([[14, 110], [20, 100], [30, 98], [36, 108]])}" fill="${R.rock[2]}"/><polygon points="${P([[20, 100], [30, 98], [27, 106], [17, 108]])}" fill="${R.rock[3]}"/><polygon points="${P([[36, 108], [14, 110], [48, 114]])}" fill="${vac ? R.rock[0] : R.rock[1]}"/>`
    + `<polygon points="${P([[178, 92], [182, 76], [186, 92]])}" fill="${R.foliage[3]}"/><polygon points="${P([[184, 92], [189, 80], [192, 92]])}" fill="${R.foliage[2]}"/><polygon points="${P([[182, 76], [184, 84], [182, 92]])}" fill="${R.foliage[4]}"/>`
    + `<line x1="${X(108)}" y1="${Y(88)}" x2="${X(102)}" y2="${Y(98)}" stroke="${R.rope[2]}" stroke-width="${X(1)}"/><line x1="${X(126)}" y1="${Y(88)}" x2="${X(132)}" y2="${Y(98)}" stroke="${R.rope[2]}" stroke-width="${X(1)}"/>`
    + `<circle cx="${X(117)}" cy="${Y(94)}" r="${X(9)}" fill="url(#g-${id})"/>`
    + `<polygon points="${P([[106, 88], [110, 76], [124, 76], [128, 88]])}" fill="${R.made[2]}"/><polygon points="${P([[110, 76], [124, 76], [121, 70], [113, 70]])}" fill="${R.made[3]}"/><polygon points="${P([[120, 76], [124, 76], [128, 88], [122, 88]])}" fill="${R.made[1]}"/>`
    + `<rect x="${X(113)}" y="${Y(79)}" width="${X(5)}" height="${Y(3)}" fill="${R.accent2[3]}"/><circle cx="${X(110)}" cy="${Y(86)}" r="${X(1.2)}" fill="${R.accent[2]}"/><circle cx="${X(125)}" cy="${Y(86)}" r="${X(1.2)}" fill="${R.accent[2]}"/>`
    + `<line x1="${X(117)}" y1="${Y(70)}" x2="${X(117)}" y2="${Y(61)}" stroke="${R.rope[1]}" stroke-width="${X(0.8)}"/><circle cx="${X(117)}" cy="${Y(61)}" r="${X(1.4)}" fill="${R.accent[3]}"/>`
    + hud(U, sx, sy) + '</svg>';
}

/** One palette painted into the sheet's landscape (200 × 130 by default; it scales); a palette with thin air or none
 *  into the cratered plain. */
export function thumbnail(K, { w = 200, h = 130 } = {}) {
  if (K.read.air && K.read.air !== 'full') return spaceScape(K, { w, h });
  const R = K.roles, U = K.ui, id = K.id.replace(/[^a-z0-9-]/gi, '');
  const sx = w / 200, sy = h / 130, P = (pts) => pts.map(([x, y]) => `${r1(x * sx)},${r1(y * sy)}`).join(' ');
  const ridge = (y0, amp, ph) => P([[0, 130], ...Array.from({ length: 11 }, (_, i) => [i * 20, y0 - amp * Math.abs(Math.sin(i * 0.9 + ph)) - (i % 3) * amp * 0.3]), [200, 130]]);
  const tree = (x, y, s) => `<rect x="${r1((x - 1.2 * s) * sx)}" y="${r1((y - 4 * s) * sy)}" width="${r1(2.4 * s * sx)}" height="${r1(9 * s * sy)}" fill="${R.bark[1]}"/>`
    + `<circle cx="${r1(x * sx)}" cy="${r1((y - 9 * s) * sy)}" r="${r1(7 * s * sx)}" fill="${R.foliage[1]}"/>`
    + `<circle cx="${r1((x - 1.8 * s) * sx)}" cy="${r1((y - 10.5 * s) * sy)}" r="${r1(5.2 * s * sx)}" fill="${R.foliage[2]}"/>`
    + `<circle cx="${r1((x - 3 * s) * sx)}" cy="${r1((y - 12 * s) * sy)}" r="${r1(2.6 * s * sx)}" fill="${R.foliage[3]}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(K.id)}">`
    + `<defs><linearGradient id="s-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${R.sky[1]}"/><stop offset="1" stop-color="${R.sky[4]}"/></linearGradient>`
    + `<linearGradient id="f-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${K.fog}" stop-opacity="0"/><stop offset="0.6" stop-color="${K.fog}" stop-opacity="0.45"/><stop offset="1" stop-color="${K.fog}" stop-opacity="0"/></linearGradient></defs>`
    + `<rect width="${w}" height="${h}" fill="url(#s-${id})"/>`
    + `<circle cx="${r1(160 * sx)}" cy="${r1(24 * sy)}" r="${r1(9 * sx)}" fill="${K.light}"/>`
    + `<ellipse cx="${r1(52 * sx)}" cy="${r1(22 * sy)}" rx="${r1(24 * sx)}" ry="${r1(6 * sy)}" fill="${R.cloud[3]}"/><ellipse cx="${r1(60 * sx)}" cy="${r1(19 * sy)}" rx="${r1(13 * sx)}" ry="${r1(5 * sy)}" fill="${R.cloud[4]}"/>`
    + `<polygon points="${ridge(56, 10, 0.4)}" fill="${R.far[4]}"/><polygon points="${ridge(64, 9, 1.7)}" fill="${R.far[3]}"/><polygon points="${ridge(72, 8, 2.9)}" fill="${R.far[2]}"/>`
    + `<rect y="${r1(62 * sy)}" width="${w}" height="${r1(16 * sy)}" fill="url(#f-${id})"/>`
    + `<path d="M0 ${r1(84 * sy)} Q${r1(50 * sx)} ${r1(72 * sy)} ${r1(100 * sx)} ${r1(82 * sy)} T${w} ${r1(78 * sy)} V${h} H0Z" fill="${R.ground[3]}"/>`
    + `<path d="M0 ${r1(96 * sy)} Q${r1(70 * sx)} ${r1(86 * sy)} ${r1(130 * sx)} ${r1(96 * sy)} T${w} ${r1(92 * sy)} V${h} H0Z" fill="${R.ground[2]}"/>`
    + `<path d="M0 ${r1(114 * sy)} Q${r1(60 * sx)} ${r1(104 * sy)} ${r1(120 * sx)} ${r1(112 * sy)} T${w} ${r1(108 * sy)} V${h} H0Z" fill="${R.ground[1]}"/>`
    + `<path d="M${r1(70 * sx)} ${h} C${r1(80 * sx)} ${r1(110 * sy)} ${r1(112 * sx)} ${r1(104 * sy)} ${r1(104 * sx)} ${r1(88 * sy)} L${r1(110 * sx)} ${r1(88 * sy)} C${r1(124 * sx)} ${r1(104 * sy)} ${r1(100 * sx)} ${r1(112 * sy)} ${r1(96 * sx)} ${h}Z" fill="${R.soil[3]}" stroke="${R.soil[1]}" stroke-width="${r1(0.8 * sx)}"/>`
    + `<polygon points="${P([[142, 100], [150, 84], [162, 80], [172, 92], [168, 102]])}" fill="${R.rock[2]}"/><polygon points="${P([[150, 84], [162, 80], [160, 92], [148, 96]])}" fill="${R.rock[3]}"/><polygon points="${P([[160, 92], [172, 92], [168, 102], [154, 102]])}" fill="${R.rock[1]}"/>`
    + tree(22, 98, 1.25) + tree(40, 92, 1) + tree(184, 100, 1.15)
    + `<polygon points="${P([[118, 72], [128, 62], [138, 72]])}" fill="${R.made[1]}"/><rect x="${r1(120 * sx)}" y="${r1(72 * sy)}" width="${r1(16 * sx)}" height="${r1(13 * sy)}" fill="${R.made[2]}"/>`
    + `<rect x="${r1(126 * sx)}" y="${r1(77 * sy)}" width="${r1(4 * sx)}" height="${r1(8 * sy)}" fill="${R.made[0]}"/><rect x="${r1(122 * sx)}" y="${r1(74 * sy)}" width="${r1(3 * sx)}" height="${r1(3 * sy)}" fill="${R.accent2[3]}"/>`
    + `<line x1="${r1(137 * sx)}" y1="${r1(72 * sy)}" x2="${r1(137 * sx)}" y2="${r1(54 * sy)}" stroke="${R.bark[2]}" stroke-width="${r1(1 * sx)}"/><polygon points="${P([[137, 54], [147, 57], [137, 60]])}" fill="${R.accent[2]}"/>`
    + `<polyline points="${P([[84, 90], [96, 87], [118, 86]])}" fill="none" stroke="${R.rope[2]}" stroke-width="${r1(0.9 * sx)}"/>`
    + hud(U, sx, sy) + '</svg>';
}

// ── the spread ───────────────────────────────────────────────────────────────────────────────────────────────────────
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const r3 = (v) => Math.round(v * 1000) / 1000;
/** Twelve 30° bins of a role's hue (its middle stop; under 0.02 chroma it is grey). */
function bins(contracts, role, at) {
  const B = Array(12).fill(0);
  let grey = 0;
  for (const K of contracts) { const [, C, h] = lchOf(hexToRgb(K.roles[role][at])); if (C < 0.02) grey += 1; else B[Math.floor(h / 30) % 12] += 1; }
  const n = contracts.length, top = Math.max(grey, ...B);
  return { bins: B, grey, used: B.filter(Boolean).length, top: r3(top / n) };
}
const tally = (xs) => xs.reduce((o, x) => ({ ...o, [x]: (o[x] ?? 0) + 1 }), {});
/** How spread a set of palettes is. `nearest`: each palette's distance to its nearest other (the median, the least,
 * and how many sit under 0.04, near-twins). */
export function sheetStats(contracts) {
  const sig = contracts.map(signatureOf), near = sig.map((a, i) => Math.min(...sig.filter((_, j) => j !== i).map((b) => paletteDistance(a, b))));
  const Ls = contracts.map((K) => lchOf(hexToRgb(K.roles.ground[2]))[0]);
  return {
    n: contracts.length,
    nearest: { median: r3(median(near)), least: r3(Math.min(...near)), twins: near.filter((d) => d < 0.04).length },
    ground: bins(contracts, 'ground', 2),
    sky: bins(contracts, 'sky', 4),
    keys: tally(contracts.map((K) => K.read.key)),
    schemes: tally(contracts.map((K) => K.read.scheme)),
    groundL: { least: r3(Math.min(...Ls)), most: r3(Math.max(...Ls)) },
  };
}

const statLine = (S) => `${S.n} palettes · nearest neighbour median ${S.nearest.median}, least ${S.nearest.least}, ${S.nearest.twins} near-twin${S.nearest.twins === 1 ? '' : 's'} · ground hues in ${S.ground.used} of 12 bins (top ${Math.round(S.ground.top * 100)}%) · sky in ${S.sky.used} · keys ${Object.entries(S.keys).map(([k, v]) => `${k} ${v}`).join(', ')} · ${Object.keys(S.schemes).length} schemes · ground L ${S.groundL.least}–${S.groundL.most}`;

/** The page: sections of thumbnails, each captioned (its label, id, scheme and key, the laws that hold), the spread
 * of each section under its title. */
export function contactSheet(sections, { title = 'Palette contact sheet' } = {}) {
  const card = ({ label, contract: K }) => {
    const held = K.checks.filter((c) => c.ok).length;
    return `<figure>${thumbnail(K)}<figcaption><b>${esc(label)}</b><span>${esc(K.id)} · ${esc(K.read.preset ?? K.read.scheme)} · ${esc(K.read.key)}${K.read.air ? ` · ${esc(K.read.air === 'none' ? 'vacuum' : 'thin air')}` : ''}${K.read.shift ? ' · shifted' : ''}</span><span class="${held === K.checks.length ? '' : 'warn'}">${held}/${K.checks.length} laws</span></figcaption></figure>`;
  };
  const body = sections.map((S) => `<section><h2>${esc(S.title)}</h2>${S.says ? `<p>${esc(S.says)}</p>` : ''}${S.stats === false ? '' : `<p class="stats">${esc(statLine(sheetStats(S.rows.map((r) => r.contract))))}</p>`}<div class="grid">${S.rows.map(card).join('')}</div></section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>
:root{--surround:#7f7f7f;--card:#8a8a8a;--ink:#141414;--quiet:#2b2b2b;--warn:#5a0f0f}
*{box-sizing:border-box}body{margin:0;padding:24px 16px;background:var(--surround);color:var(--ink);font:13px/1.4 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 4px}p{margin:0 0 6px;max-width:80ch}.stats{color:var(--quiet);font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
figure{margin:0;background:var(--card);padding:6px;border-radius:4px}figure svg{display:block;width:100%;height:auto;border-radius:2px}
figcaption{display:flex;flex-direction:column;margin-top:4px;font-size:11px}figcaption span{color:var(--quiet)}figcaption .warn{color:var(--warn)}
</style></head><body><h1>${esc(title)}</h1><p>Every thumbnail is the same landscape; only the palette changes. The surround is neutral grey so it biases no palette.</p>${body}</body></html>`;
}
