/**
 * A PUBLICATION'S COVER — the front a book shows on a shelf and on its first page: the studio's cover grammar
 * (image-outcomes/cover-archetypes.js: where the picture, the title and the lines under it sit) with a drawn plate
 * where a painted illustration would go, and its words set as type fitted to their zones (in the book's own faces
 * where the page carries them, a serif where it does not: a carved title is half a megabyte, and a shelf holds
 * several). One SVG, no raster and no worker: it is drawn from the recipe alone.
 *
 *   publication.cover: true | { props?: [word | [word, tint]], plate?, tagline?, archetype?, palette?: { bg, accent, ink, paper } }
 *     props    a still life from the prop shelf (props.js); `plate` a plate spec of its own instead
 *     absent both: the book's first plate, else the cover's own ground
 *   readCover(cover)            → the cover as written, checked
 *   publicationCover(P, { res?, id?, faces? }) → the SVG, or null when the publication asks for none; `id` keeps its
 *                                 ids apart from another cover's on the same page; `faces` { display, text } font stacks
 *   COVER_GROUNDS               each kind's cloth
 *
 * Pure and deterministic.
 */
import { normalizeCoverManifest } from '../image-outcomes/cover-manifest.js';
import { layoutCover, archetypeNames } from '../image-outcomes/cover-archetypes.js';
import { shade } from '../image-outcomes/cover-preview.js';
import { renderPlate, readPlate } from '../book/drawn-plate.js';
import { stillLife } from './props.js';

/** Each kind's cloth: the cover's ground, its title's foil, its small type, and the paper its picture is drawn on. */
export const COVER_GROUNDS = Object.freeze({
  grimoire: { bg: '#3a2620', accent: '#e2b64a', ink: '#f0e2c4', paper: '#e9dcc0' },
  bestiary: { bg: '#2c3a2b', accent: '#d9c27a', ink: '#eee6cf', paper: '#e6dfc6' },
  manual: { bg: '#2b3440', accent: '#e8e2d0', ink: '#d6dbe2', paper: '#e4e2da' },
  notebook: { bg: '#5a4a31', accent: '#f1e3bd', ink: '#efe2c2', paper: '#ecdfc4' },
  comic: { bg: '#8a2a22', accent: '#ffd84a', ink: '#fff4d6', paper: '#f4ecd8' },
});
const COVER_KEYS = ['props', 'plate', 'tagline', 'archetype', 'palette'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const fail = (m) => new Error(`publication: cover ${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readCover(cover) {
  if (cover === undefined || cover === false || cover === true) return cover;
  if (!isObj(cover)) throw fail('is true (the book\'s own first plate) or { props?, plate?, tagline?, archetype?, palette? }');
  for (const k of Object.keys(cover)) if (!COVER_KEYS.includes(k)) throw fail(`has no '${k}' (${COVER_KEYS.join(', ')})`);
  if (cover.props !== undefined && cover.plate !== undefined) throw fail('takes props (a still life from the shelf) or a plate of its own, not both');
  if (cover.props !== undefined) { try { stillLife(cover.props); } catch (e) { throw fail(`props: ${e.message.replace(/^publication: /, '')}`); } }
  if (cover.plate !== undefined) { try { readPlate(cover.plate); } catch (e) { throw fail(e.message); } }
  if (cover.tagline !== undefined && !(typeof cover.tagline === 'string' && cover.tagline.trim())) throw fail('tagline is words');
  if (cover.archetype !== undefined && !archetypeNames().includes(cover.archetype)) throw fail(`archetype is one of ${archetypeNames().join(', ')}`);
  if (cover.palette !== undefined) {
    if (!isObj(cover.palette)) throw fail('palette is { bg?, accent?, ink?, paper? }');
    for (const [k, v] of Object.entries(cover.palette)) if (!['bg', 'accent', 'ink', 'paper'].includes(k) || !HEX.test(v)) throw fail(`palette.${k} is one of bg, accent, ink, paper as #rrggbb`);
  }
  return cover;
}

const firstPlate = (P) => { for (const c of P.chapters) for (const b of c.blocks) { if (b.plate) return b.plate; if (b.specimen?.plate) return b.specimen.plate; if (b.panels) { const p = b.panels.find((x) => x.plate); if (p) return p.plate; } } return null; };

const escText = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** Words fitted to a zone as type: broken over up to three lines, as large as the zone lets them be. */
function fitted(text, zone, { fill, family, weight = 400, lines = 3, wide = 0.5, opacity = 1, italic = false }) {
  if (!zone || !text) return '';
  const words = String(text).trim().split(/\s+/);
  let best = null;
  for (let n = 1; n <= Math.min(lines, words.length); n++) {
    // n lines of about equal length, greedily
    const target = text.length / n, rows = [];
    let row = '';
    for (const w of words) {
      if (row && rows.length < n - 1 && (row + ' ' + w).length > target + 2) { rows.push(row); row = w; } else row = row ? `${row} ${w}` : w;
    }
    rows.push(row);
    const longest = Math.max(...rows.map((r) => r.length));
    const size = Math.min(zone.h / (rows.length * 1.18), zone.w / (longest * wide));
    if (!best || size > best.size) best = { size, rows };
  }
  const { size, rows } = best, lh = size * 1.18, top = zone.y + (zone.h - rows.length * lh) / 2 + size * 0.86;
  return `<text text-anchor="middle" font-family="${family}" font-size="${Math.round(size)}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''} fill="${fill}"${opacity < 1 ? ` opacity="${opacity}"` : ''}>`
    + rows.map((r, i) => `<tspan x="${Math.round(zone.x + zone.w / 2)}" y="${Math.round(top + i * lh)}">${escText(r)}</tspan>`).join('') + '</text>';
}

/** The cover as one SVG, or null when the publication asks for none. */
export function publicationCover(P, { res = 1.25, id = 'cv', faces = {} } = {}) {
  const cover = readCover(P.cover);
  if (!cover) return null;
  const C = cover === true ? {} : cover, ground = { ...(COVER_GROUNDS[P.kind] ?? COVER_GROUNDS.grimoire), ...(C.palette || {}) };
  const comic = P.kind === 'comic';
  const manifest = normalizeCoverManifest({
    for_kind: comic ? 'comic' : 'novel',
    artDirection: { palette: { bg: ground.bg, accent: ground.accent, ink: ground.ink }, composition: { archetype: C.archetype ?? (comic ? 'comic-masthead' : 'framed-below') }, ...(comic ? {} : { type: { titleFont: 'im-fell', textFont: 'crimson-text' } }) },
    slots: {
      illustration: { realizer: 'placeholder' },
      title: { text: P.title, realizer: 'flat' },
      subtext: [...(P.by ? [{ role: 'author', text: P.by }] : []), ...(C.tagline ?? P.subtitle ? [{ role: comic ? 'issue' : 'series', text: C.tagline ?? P.subtitle }] : [])],
    },
  });
  const layout = layoutCover(manifest), { canvas } = manifest, r = layout.illustrationRegion;
  const serif = "Georgia, 'Times New Roman', serif", clean = (f) => String(f).replace(/"/g, "'");
  const display = clean(faces.display ?? (comic ? "'Arial Black', Impact, system-ui, sans-serif" : serif)), text = clean(faces.text ?? serif);
  const spec = C.plate ?? (C.props ? stillLife(C.props) : firstPlate(P));
  let picture = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${shade(ground.bg, -0.18)}"/>`;
  if (spec) {
    const { svg } = renderPlate({ ...spec, finish: comic ? 'woodcut' : 'wash', palette: { paper: ground.paper, ink: shade(ground.bg, -0.45) } }, { res, prefix: `${id}-`, backdrop: false });
    const box = /viewBox="([^"]+)"/.exec(svg)[1], inner = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
    const pad = Math.round(Math.min(r.w, r.h) * 0.07);
    picture = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${ground.paper}"/>`
      + `<svg x="${r.x + pad}" y="${r.y + pad}" width="${r.w - 2 * pad}" height="${r.h - 2 * pad}" viewBox="${box}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`
      + `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${ground.accent}" stroke-width="${Math.max(2, Math.round(canvas.w / 300))}" opacity="0.7"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.w} ${canvas.h}" width="${canvas.w}" height="${canvas.h}">`
    + `<rect width="${canvas.w}" height="${canvas.h}" fill="${ground.bg}"/>${layout.band ? `<rect x="${layout.band.x}" y="${layout.band.y}" width="${layout.band.w}" height="${layout.band.h}" fill="${ground.bg}"/>` : ''}${picture}`
    + fitted(manifest.slots.title.text, layout.titleZone, { fill: comic && spec ? ground.bg : ground.accent, family: display, weight: comic ? 800 : 400, wide: comic ? 0.62 : 0.5 })
    + manifest.slots.subtext.map((s) => fitted(s.text, layout.subtextRegions?.[s.role], { fill: ground.ink, family: text, lines: 1, opacity: 0.9, italic: s.role !== 'author' })).join('')
    + '</svg>';
}
