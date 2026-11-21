/**
 * The CONTACT SHEET composed: rendered frames laid a row a shot (shoot/contact.js `contactFrames`), each cell the
 * frame with the rule of thirds drawn over it faintly and a caption under it (the instant, the world's time, the size
 * the frame read reads), each row headed by its shot (its name, its camera, what it is about, the frame read's notes).
 * One PNG, small enough for an agent to look at and a person to read.
 *
 *   composeContactSheet(rows, pngs, { width, height, cell, thirds }) → Promise<Buffer>   `pngs` the rendered frames in
 *     the rows' order (row by row, frame by frame); `cell` the width a frame is drawn at (px, default 320)
 *
 * IO only in sharp; no clock, no dice.
 */
import sharp from 'sharp';

const PAD = 10, HEAD = 26, CAP = 20, BG = '#14161a', INK = '#e8e6df', DIM = '#9a978f', WARN = '#f2b45c';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The sheet (see the header) */
export async function composeContactSheet(rows, pngs, { width, height, cell = 320, thirds = true } = {}) {
  const cols = Math.max(1, ...rows.map((r) => r.frames.length));
  const ch = Math.round((cell * height) / width), rowH = HEAD + ch + CAP + PAD;
  const W = PAD + cols * (cell + PAD), H = PAD + rows.length * rowH;
  const layers = [];
  let k = 0;
  const svg = [];
  rows.forEach((r, i) => {
    const y0 = PAD + i * rowH;
    const head = `${r.shot} · ${r.camera}${r.about ? ` · on ${r.about}` : ''}${r.size ? ` · ${r.size}` : ''}`;
    svg.push(`<text x="${PAD}" y="${y0 + 17}" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" font-weight="bold" fill="${INK}">${esc(head)}</text>`);
    if (r.notes.length) svg.push(`<text x="${W - PAD}" y="${y0 + 17}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="${WARN}">${esc(r.notes.join(', '))}</text>`);
    r.frames.forEach((f, j) => {
      const x = PAD + j * (cell + PAD), y = y0 + HEAD;
      layers.push({ i: k++, left: x, top: y });
      if (thirds) for (const u of [1 / 3, 2 / 3]) {
        svg.push(`<line x1="${x + cell * u}" y1="${y}" x2="${x + cell * u}" y2="${y + ch}" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1"/>`);
        svg.push(`<line x1="${x}" y1="${y + ch * u}" x2="${x + cell}" y2="${y + ch * u}" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1"/>`);
      }
      svg.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${cell - 1}" height="${ch - 1}" fill="none" stroke="#000" stroke-opacity="0.6"/>`);
      svg.push(`<text x="${x}" y="${y + ch + 15}" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="${DIM}">${esc(`${f.at} · ${f.world_t.toFixed(2)}s${f.size ? ` · ${f.size}` : ''}`)}</text>`);
    });
  });
  const frames = await Promise.all(layers.map(async (L) => ({ input: await sharp(pngs[L.i]).resize(cell, ch, { fit: 'fill' }).png().toBuffer(), left: L.left, top: L.top })));
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg.join('')}</svg>`);
  return sharp({ create: { width: W, height: H, channels: 3, background: BG } })
    .composite([...frames, { input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
}
