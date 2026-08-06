/**
 * wordmark-treatment — high-effort deterministic TITLE treatments carved from
 * the font shelf. mojulo owns the letter geometry (title-geometry → carve
 * kernel); a treatment stacks vector layers over that ONE outline to build a
 * finished wordmark — no image worker, no host fonts, byte-stable.
 *
 * `comicWordmark` is the comic-logo treatment: a chunky 3D block extrude, a
 * black keyline, a color outline, a chrome/foil gradient face, and a soft drop
 * shadow — the same construction a hand-built comic masthead uses, from the same
 * letterforms the flat/carved/painted realizers share. Returned as a standalone
 * alpha SVG doc sized to the zone, so it drops straight in as the title layer
 * (renders.title) the compositor overlays on the cover art.
 */
import { fitTextToZone, ringsToPathD } from './title-geometry.js';

const r1 = (n) => Math.round(n * 10) / 10;

const COMIC_DEFAULTS = {
  face: 'archivo-black',
  slant: 0.12,          // mild forward lean — comic dynamism
  tracking: 0.03,
  fill: 0.78,           // leave room in the zone for extrude + shadow
  extrude: 9,           // receding block copies
  colors: {
    faceTop: '#fff7db', faceHi: '#ffd24d', faceMid: '#f6a428', faceHorizon: '#a85916', faceLo: '#ffd863',
    keyline: '#0b0b12', outline: '#d21f27', block: '#5c0d12', blockEdge: '#320609',
  },
};

/**
 * @param {string} text
 * @param {{ face?, slant?, tracking?, fill?, extrude?, colors?, style? }} [opts]
 * @param {{ x?, y?, w:number, h:number }} zone  target box (only w/h used; the mark is zone-local)
 * @returns {string} a standalone alpha SVG doc (transparent ground) sized w×h
 */
export function comicWordmark(text, opts = {}, zone) {
  const o = { ...COMIC_DEFAULTS, ...opts, colors: { ...COMIC_DEFAULTS.colors, ...(opts.colors || {}) } };
  const W = Math.max(1, Math.round(zone.w)), H = Math.max(1, Math.round(zone.h));
  const style = { preset: 'heavy', slant: o.slant, tracking: o.tracking, ...(o.style || {}) };
  const { rings } = fitTextToZone(text, { face: o.face, style }, { x: 0, y: 0, w: W, h: H }, { fill: o.fill });
  const d = ringsToPathD(rings);
  if (!d) return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"></svg>`;

  const keyW = r1(H * 0.11);   // black keyline (widest)
  const outW = r1(H * 0.066);  // color outline (narrower → a band inside the keyline)
  const ex = r1(H * 0.011), ey = r1(H * 0.015); // per-copy block offset (down-right)

  // 3D block: receding copies, farthest first. The farthest edge is darker.
  const block = [];
  for (let i = o.extrude; i >= 1; i -= 1) {
    const col = i === o.extrude ? o.colors.blockEdge : o.colors.block;
    block.push(`<path d="${d}" fill="${col}" transform="translate(${r1(i * ex)},${r1(i * ey)})"/>`);
  }

  const c = o.colors;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="wmface" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.faceTop}"/>
      <stop offset="0.34" stop-color="${c.faceHi}"/>
      <stop offset="0.5" stop-color="${c.faceMid}"/>
      <stop offset="0.55" stop-color="${c.faceHorizon}"/>
      <stop offset="0.6" stop-color="${c.faceMid}"/>
      <stop offset="1" stop-color="${c.faceLo}"/>
    </linearGradient>
    <filter id="wmshadow" x="-15%" y="-15%" width="140%" height="145%">
      <feDropShadow dx="${r1(H * 0.02)}" dy="${r1(H * 0.03)}" stdDeviation="${r1(H * 0.02)}" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#wmshadow)">
    ${block.join('\n    ')}
    <path d="${d}" fill="none" stroke="${c.keyline}" stroke-width="${keyW}" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${c.outline}" stroke-width="${outW}" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${d}" fill="url(#wmface)" fill-rule="evenodd"/>
  </g>
</svg>`;
}
