/**
 * sheet — the eyes gate's contact sheet: a gait as a row of stick poses at even phases of its stride (side view, the
 * near (left) limbs drawn behind and pale, the far (right) dark, a planted hoof marked; or `view: 'front'`, x doubled-
 * and-a-half so a limb's sideways travel shows), and under it the footfall
 * diagram (each hoof's stance as a bar across the stride, Hildebrand's way), so the poses can be laid beside
 * Muybridge's plates and the footfalls read against the reference table. Generic over frames of { bones: { id: {
 * head, tail } }, contact? }: the fauna's frames draw on it too (the before sheet). Pure: a string of SVG.
 */
const AXIS = /^(spine|neck|tail)\d*$|^head$|^tailHair$|^jaw$/;
const f1 = (x) => x.toFixed(1);

function inkOf(id) {
  if (/^(saddle|bit)$/.test(id)) return '#c92a2a';
  if (AXIS.test(id)) return '#212529';
  return /L$/.test(id) ? '#74c0fc' : '#d9480f';
}

/**
 * `rows` [{ label, sub, frames: [frame], footfalls?: { LF: [bool…], … } }], each frame { bones, contact?, ground? }.
 * `cols` poses a row; `scale` px per metre.
 */
export function contactSheet(rows, { title = '', scale = 70, cellW = 230, cellH = 175, foot = 64, view = 'side' } = {}) {
  const cols = Math.max(...rows.map((r) => r.frames.length));
  const W = 30 + cols * cellW, rowH = cellH + foot + 46, H = 50 + rows.length * rowH;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`, `<text x="16" y="30" font-size="18" font-weight="bold" fill="#212529">${title}</text>`];
  rows.forEach((row, ri) => {
    const y0 = 50 + ri * rowH;
    out.push(`<text x="16" y="${y0 + 16}" font-size="14" font-weight="bold" fill="#212529">${row.label}</text>`);
    if (row.sub) out.push(`<text x="${16 + 8.5 * row.label.length + 14}" y="${y0 + 16}" font-size="12" fill="#495057">${row.sub}</text>`);
    row.frames.forEach((fr, ci) => {
      const ox = 15 + ci * cellW, groundY = y0 + 22 + cellH - 10;
      // centre the mount in its cell on y = 0 (its centre of mass); from the front, on x = 0 (its mirror plane), its
      // right on the viewer's left
      const P = view === 'front' ? (q) => [ox + cellW * 0.5 - q[0] * scale * 1.6, groundY - q[2] * scale]
        : (q) => [ox + cellW * 0.52 + q[1] * scale, groundY - q[2] * scale];
      out.push(`<line x1="${ox + 6}" y1="${groundY}" x2="${ox + cellW - 6}" y2="${groundY}" stroke="#adb5bd" stroke-width="1"/>`);
      const g = fr.ground ?? 0, step = 0.5;
      for (let k = -4; k <= 4 && view !== 'front'; k++) {
        const y = ((g % step) + step) % step + k * step, x = ox + cellW * 0.52 + y * scale;
        if (x > ox + 8 && x < ox + cellW - 8) out.push(`<line x1="${f1(x)}" y1="${groundY}" x2="${f1(x - 5)}" y2="${groundY + 5}" stroke="#ced4da" stroke-width="1"/>`);
      }
      // side: the near (left) limbs behind; front: the far (hind) limbs behind the fore
      const back = (id) => (view === 'front' ? /^(femur|tibia|cannonH|pasternH|hoofH|tail|spine0)/.test(id) : /L$/.test(id) && !AXIS.test(id));
      const ids = Object.keys(fr.bones).sort((a, b) => (back(b) ? 1 : 0) - (back(a) ? 1 : 0));
      for (const id of ids) {
        const { head, tail } = fr.bones[id], [a, b] = [P(head), P(tail)];
        const w = AXIS.test(id) ? 3 : /^(saddle|bit)$/.test(id) ? 2 : 2.4;
        out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${inkOf(id)}" stroke-width="${w}" stroke-linecap="round"/>`);
      }
      for (const [k, hoof] of [['LF', 'hoofFL'], ['RF', 'hoofFR'], ['LH', 'hoofHL'], ['RH', 'hoofHR']]) {
        const bone = fr.bones[hoof]; if (!bone) continue;
        const on = fr.contact ? fr.contact[k] : Math.min(bone.head[2], bone.tail[2]) < 0.01;
        if (on) { const p = P(bone.tail); out.push(`<circle cx="${f1(p[0])}" cy="${f1(groundY)}" r="3.2" fill="${/^L/.test(k) ? '#74c0fc' : '#d9480f'}" stroke="#212529" stroke-width="0.8"/>`); }
      }
      out.push(`<text x="${ox + 8}" y="${y0 + 36}" font-size="10" fill="#868e96">${(ci / row.frames.length).toFixed(3)}</text>`);
    });
    if (row.footfalls) {
      const fy = y0 + 22 + cellH + 6, fw = cols * cellW - 70, fx = 70;
      ['LH', 'LF', 'RF', 'RH'].forEach((k, i) => {
        const s = row.footfalls[k]; if (!s) return;
        const y = fy + i * 14;
        out.push(`<text x="${fx - 30}" y="${y + 10}" font-size="10" fill="#495057">${k}</text>`);
        out.push(`<rect x="${fx}" y="${y}" width="${fw}" height="10" fill="#f1f3f5"/>`);
        let start = -1;
        for (let n = 0; n <= s.length; n++) {
          const on = n < s.length && s[n];
          if (on && start < 0) start = n;
          if (!on && start >= 0) { out.push(`<rect x="${f1(fx + fw * start / s.length)}" y="${y}" width="${f1(fw * (n - start) / s.length)}" height="10" fill="${/^L/.test(k) ? '#74c0fc' : '#d9480f'}"/>`); start = -1; }
        }
      });
      for (let ci = 0; ci <= cols; ci++) { const x = fx + fw * ci / cols; out.push(`<line x1="${f1(x)}" y1="${fy - 2}" x2="${f1(x)}" y2="${fy + 56}" stroke="#adb5bd" stroke-width="0.6" stroke-dasharray="2 2"/>`); }
    }
  });
  out.push('</svg>');
  return out.join('\n');
}
