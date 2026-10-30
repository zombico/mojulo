/**
 * THE CAST SHEET — the world's foes as a casting call's sheet, for the creator who makes the world: the LINEUP (every foe
 * drawn at the size it reads at in the game, beside the hero, on a metre rule), a tile per foe by tier (its portrait once
 * a run has made its figure, its threat, its element, its modes, where it stands) and a card per foe (the lesson it
 * teaches, its stats in the words of the game's flavor, its mind as the Mind gem resolves it on its body, its shelves,
 * what an engine keeps). A world that keeps no bestiary shows what the casting call proposes (foe-casting.js), never
 * written.
 *
 * It is the APPROVAL GATE as the other books are: the cast and each foe carry a stamp (foe-cast.js foeState). What the
 * machine measured is stated per foe; whether a foe reads right is the creator's.
 *
 * It is drawn in its WORLD's colours, as the world's bible is, and wears the world's book skin over them when it names one
 * (book-skin.js `book`): the lineup stands on the world's own sky and ground (its
 * kit's colour key: nature.js colorKey), the page's accent the kit's paint, and its parts are the bible's own blocks (the
 * cover and its strip of levels in the order they are played, a civilization's article for each role the casting call
 * would cast, the ledger of what it read).
 *
 * `foeCastHtml(world, { portraits })` is pure (the same world, the same page). `portraits` `{ <foe id>: { figure, bust } }` the
 * photographs of the foes a run has made (image URIs: the route's, taken in headless Chromium when one is at hand); a foe
 * without one is shown by its silhouette, which also stands in for one that fails to load. The lineup plate is fenced `<!--plate:lineup-->…<!--/plate-->`.
 */
import { foeCastOf, foeState } from './foe-cast.js';
import { castingCall } from './foe-casting.js';
import { readGameworld } from './world.js';
import { MODES, STAMPS, FOE_CAST_PART } from './review.js';
import { esc, plate, CSS } from './bible-html.js';
import { skinHead } from './book-skin.js';
import { resolveFoe } from '../foes/resolve.js';
import { bestiaryOf, readLevelFoes } from './foes.js';
import { playOrder } from './graph.js';
import { colorKey } from './nature.js';
import { foeClass } from '../foes/index.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';
import { OOZES } from '../mutagen/oozes/index.js';

const list = (a) => (a && a.length ? a.map(esc).join(', ') : '—');
const dl = (rows) => `<dl class="vocab">${rows.filter(([, v]) => v !== undefined).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
const r2 = (v) => Math.round(v * 100) / 100;
/** The colour a foe's element is drawn in on the sheet (an element without a row: the tier's ink). */
const ELEMENT_INK = Object.freeze({ fire: '#d4602a', ice: '#5aa6d6', water: '#3f7fc4', earth: '#8a6a3c', wind: '#5fae8e', lightning: '#c9a227', light: '#d8b84a', shadow: '#5b4a7a', poison: '#6f9a3a' });
const TIER_INK = Object.freeze({ minion: '#7d8794', elite: '#4f7fd0', miniboss: '#b9822a', boss: '#b14f39' });
/** An ooze's own colour, as its row draws it (mutagen/oozes: its tint, else its crest, its marks or its eyes): a
 * variant is drawn in it, outlined in its tier's, as a palette swap reads. */
const oozeInk = (id) => { const P = OOZES[id]?.push ?? {}; return P.tint?.color ?? P.hackles?.color ?? P.marks?.[0]?.color ?? P.eyes?.color ?? null; };
const words = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

const EXTRA_CSS = `
.cover{grid-template-columns:minmax(0,7fr) minmax(0,5fr)}.cover h1{overflow-wrap:normal;word-break:normal;font-size:clamp(40px,5.6vw,76px)}.eyebrow .stamp{margin-left:6px}
.lineup{background:var(--sheet);border:1px solid var(--rule);border-radius:4px;padding:10px;overflow-x:auto}.lineup svg{max-width:none}
.lu-t{font:500 11px var(--mono);fill:var(--ink)}.lu-m{font:10px var(--mono);fill:var(--muted)}.lu-r{stroke:var(--rule);stroke-width:1}.lu-g{stroke:var(--ink);stroke-width:1.5}
.tier{display:grid;gap:10px}.tier-h{display:flex;gap:10px;align-items:baseline;border-top:2px solid var(--ink);padding-top:10px}.tier-h h3{font-size:26px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.tile{background:var(--sheet);border:1px solid var(--rule);border-top:4px solid var(--tier);border-radius:4px;padding:10px;display:grid;gap:6px;text-decoration:none;color:inherit;align-content:start}
.tile:hover h4{text-decoration:underline}.tile h4{margin:0;font:800 20px var(--display);letter-spacing:.02em;color:var(--ink)}
.por{height:150px;border-radius:3px;background:var(--paper);display:grid;place-items:center;overflow:hidden}.por img{width:100%;height:100%;object-fit:contain}.por svg{height:120px;width:auto}
.pips{display:flex;gap:2px;flex-wrap:wrap}.pips i{width:8px;height:8px;border-radius:50%;background:var(--tier)}.pips span{font:10px var(--mono);color:var(--muted);margin-left:4px}
.chips{display:flex;gap:4px;flex-wrap:wrap}.chip{font:10.5px var(--mono);padding:1px 6px;border:1px solid var(--rule);border-radius:10px;color:var(--muted)}.chip.el{color:#fff;border-color:transparent}
.statline{font:12px var(--mono);color:var(--ink)}
.foe{border-top:4px solid var(--tier)}.foe .lesson{font:500 17px var(--body);max-width:70ch}
.sit{width:100%;border-collapse:collapse;font-size:13px}.sit td,.sit th{border-bottom:1px solid var(--rule);padding:5px 8px;text-align:left;vertical-align:top}.sit th{font:10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:400}
.marks{display:flex;gap:6px;flex-wrap:wrap}.mk{font:10.5px var(--mono);padding:2px 6px;border-radius:3px;border:1px solid var(--rule)}.mk-absent{color:var(--local)}.mk-approximated{color:var(--c-meru)}.mk-built{color:var(--c-trail)}
.foe-h{display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:end}.foe-h .por{height:110px}.foe-h .por svg{height:96px}
.counsel{display:grid;grid-template-columns:max-content 1fr;margin:0;gap:0;border-top:2px solid var(--tier);font-size:14.5px}.counsel dt{font:500 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:9px 12px 0 0}.counsel dd{margin:0;padding:6px 0;border-bottom:1px solid var(--rule)}.counsel dd.lesson{font:500 16px var(--body)}.counsel ul{margin:0;padding-left:18px;display:grid;gap:3px}
details.designer{margin-top:6px}
.chip.ooze{border-color:var(--local);color:var(--local)}.chip.var{border-style:dashed}
.fort-im{background:var(--sheet);border:1px solid var(--rule);border-radius:3px;padding:6px;overflow-x:auto}.fort-im svg{max-width:none}
.stop .im svg{width:100%;height:100%}.stop .im .none{font:11px var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.civ.role{border-top-color:var(--tier)}.civ.role .score{font:500 12px var(--mono);color:var(--local)}
`;

// a foe's outline as drawn at its game size: a body on legs (a person upright, a beast long), a flier held up off the
// ground; `w` and `h` metres, `ink` its colour
function silhouette(x, ground, px, { w, h, people, flies }, ink, edge = null) {
  const W = w * px, H = h * px, lift = flies ? Math.max(0.6, h) * px : 0, y = ground - lift - H;
  if (people) {
    const head = Math.min(W, H * 0.16);
    return `<g fill="${ink}"${edge ? ` stroke="${edge}" stroke-width="2"` : ''}><circle cx="${x}" cy="${r2(y + head / 2)}" r="${r2(head / 2)}"/><rect x="${r2(x - W / 2)}" y="${r2(y + head * 1.05)}" width="${r2(W)}" height="${r2(H * 0.48)}" rx="${r2(W * 0.3)}"/><rect x="${r2(x - W * 0.42)}" y="${r2(y + head * 1.05 + H * 0.46)}" width="${r2(W * 0.34)}" height="${r2(H - head * 1.05 - H * 0.46)}" rx="2"/><rect x="${r2(x + W * 0.08)}" y="${r2(y + head * 1.05 + H * 0.46)}" width="${r2(W * 0.34)}" height="${r2(H - head * 1.05 - H * 0.46)}" rx="2"/></g>`;
  }
  const body = H * (flies ? 1 : 0.62), legs = flies ? 0 : H - body;
  return `<g fill="${ink}"${edge ? ` stroke="${edge}" stroke-width="2"` : ''}><ellipse cx="${x}" cy="${r2(y + body / 2)}" rx="${r2(W / 2)}" ry="${r2(body / 2)}"/>${flies ? `<path d="M${r2(x - W / 2)} ${r2(y + body / 2)} L${r2(x - W)} ${r2(y - body * 0.2)} L${r2(x - W * 0.2)} ${r2(y + body * 0.3)} Z M${r2(x + W / 2)} ${r2(y + body / 2)} L${r2(x + W)} ${r2(y - body * 0.2)} L${r2(x + W * 0.2)} ${r2(y + body * 0.3)} Z"/>` : `<rect x="${r2(x - W * 0.36)}" y="${r2(y + body * 0.8)}" width="${r2(Math.max(2, W * 0.1))}" height="${r2(legs + body * 0.2)}"/><rect x="${r2(x + W * 0.26)}" y="${r2(y + body * 0.8)}" width="${r2(Math.max(2, W * 0.1))}" height="${r2(legs + body * 0.2)}"/>`}</g>`;
}

// the size an entry is drawn at: its grown body at its game scale (foes/resolve.js), a person upright at its height
function shapeOf(entry) {
  const f = resolveFoe((({ class: c, rank, skill, skin }) => ({ class: c, ...(rank ? { rank } : {}), ...(skill ? { skill } : {}), ...(skin ? { skin } : {}) }))(entry));
  const m = f.measured;
  if (entry.skin?.people !== undefined || entry.skin?.meshRef !== undefined) return { w: r2(m.height * f.scale * 0.32), h: r2(m.height * f.scale), people: true, flies: false };
  return { w: r2(m.extent * f.scale), h: r2(m.height * f.scale), people: false, flies: !!m.wings };
}

/** The world's colours the sheet is drawn in (its kit's colour key, nature.js): its sky, its far air, its ground, its
 * grass and its paint (the page's accent). A kit with no ramps (a room kit) draws on the bible's own paper. */
function themeOf(G) {
  let ramps = [];
  try { ramps = G.style?.kit ? colorKey(G.style.kit).ramps : []; } catch { ramps = []; }
  const at = (names, k = 0.5) => { for (const n of names) { const r = ramps.find((x) => x.name === n); if (r) return r.stops[Math.min(r.stops.length - 1, Math.floor(r.stops.length * k))]; } return null; };
  return { sky: at(['sky', 'far'], 0.75), far: at(['far', 'cloud', 'sky'], 0.75), ground: at(['soil', 'stone', 'rock', 'timber'], 0.4), grass: at(['grass', 'moss', 'foliage']), accent: at(['paint', 'fruit', 'gold'], 0.6), kit: G.style?.kit ?? null };
}

/** A lineup: who is drawn (each { id, shape, ink, label?, sub?, href? }) at the size each reads at, the hero first, on a
 * metre rule over the world's own sky and ground. `labels: false` for a thumbnail. */
function lineupSvg(items, T, { hero = 1.7, labels = true, minW = 70 } = {}) {
  const tallest = Math.max(hero, ...items.map(({ shape: s }) => s.h + (s.flies ? Math.max(0.6, s.h) : 0)));
  const px = Math.max(24, Math.min(90, 260 / tallest)), top = 26, ground = top + tallest * px + 6;
  let at = 40;
  const slots = [{ id: 'hero', w: hero * 0.32 }, ...items.map((x) => ({ ...x, w: x.shape.w * (x.shape.flies ? 2 : 1) }))].map((s) => { const w = Math.max(minW, s.w * px + 24), mid = at + w / 2; at += w; return { ...s, mid }; });
  const width = at + 20, height = ground + (labels ? 44 : 14), rows = [];
  const sky = T.sky ? `<defs><linearGradient id="lu-sky-${items.map((x) => x.id).join('-')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.sky}"/><stop offset="1" stop-color="${T.far ?? T.sky}"/></linearGradient></defs><rect x="0" y="0" width="${r2(width)}" height="${r2(ground)}" fill="url(#lu-sky-${items.map((x) => x.id).join('-')})" opacity="0.55"/>` : '';
  const land = T.ground ? `<rect x="0" y="${r2(ground)}" width="${r2(width)}" height="10" fill="${T.ground}"/>${T.grass ? `<rect x="0" y="${r2(ground)}" width="${r2(width)}" height="3" fill="${T.grass}"/>` : ''}` : '';
  // (the rule's lines under the ground, its marks over it: the ground never hides the 0)
  const marks = [];
  for (let m = 0; m <= Math.ceil(tallest); m++) { const y = r2(ground - m * px); rows.push(`<line class="lu-r" x1="30" x2="${width - 10}" y1="${y}" y2="${y}"/>`); if (labels) marks.push(`<text class="lu-m" x="4" y="${r2(m ? y + 3 : y - 3)}">${m} m</text>`); }
  const ly = (k) => r2(ground + (T.ground ? 10 : 0) + k);
  const drawn = slots.map((s, k) => {
    const shape = k ? s.shape : { w: hero * 0.32, h: hero, people: true, flies: false }, ink = k ? s.ink : 'var(--ink)', edge = k ? s.edge ?? null : null;
    const text = labels ? `<text class="lu-t" x="${s.mid}" y="${ly(14)}" text-anchor="middle">${esc(k ? s.label ?? s.id : 'the hero')}</text><text class="lu-m" x="${s.mid}" y="${ly(28)}" text-anchor="middle">${esc(k ? s.sub ?? '' : `${hero} m`)}</text>` : '';
    const g = `${silhouette(s.mid, ground, px, shape, ink, edge)}${text}`;
    return k && s.href ? `<a href="${s.href}">${g}</a>` : g;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(width)} ${r2(height)}" width="${r2(width)}" height="${r2(height)}" role="img" aria-label="${labels ? 'The cast at the size each reads at, beside the hero' : 'who stands here, beside the hero'}">${sky}${rows.join('')}${land}<line class="lu-g" x1="0" x2="${width}" y1="${r2(ground)}" y2="${r2(ground)}"/>${marks.join('')}${drawn.join('')}</svg>`;
}

const inkOf = (x) => (x.variantOf && oozeInk(x.skin.oozes[0].id)) || (x.element && ELEMENT_INK[x.element]) || TIER_INK[x.rank];
const edgeOf = (x) => (x.variantOf && oozeInk(x.skin.oozes[0].id) ? TIER_INK[x.rank] : null);

function soloSvg(x, sh) {
  const tall = sh.h + (sh.flies ? Math.max(0.6, sh.h) : 0), px = 110 / Math.max(tall, sh.w * (sh.flies ? 2 : 1) * 0.8, 0.2), w = Math.max(60, sh.w * px * (sh.flies ? 2 : 1) + 20);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(w)} 124" width="${r2(w)}" height="124" aria-hidden="true">${silhouette(w / 2, 120, px, sh, inkOf(x), edgeOf(x))}</svg>`;
}

// the strip of the levels in the order they are played, each its own lineup thumbnail of who stands on it
function levelStrip(G, standsOn, item) {
  const order = playOrder(G);
  return order.map((id, i) => {
    const who = standsOn(id), next = G.links.find((l) => l.from === id);
    const im = who.length ? lineupSvg(who.map(item), themeOf(G), { labels: false, minW: 40 }) : '<span class="none">no foe</span>';
    return `<div class="stop"><div class="im">${im}</div><div class="cap"><i>${i + 1}</i><b>${esc(G.levels[id].name ?? id)}</b></div></div>${next && i < order.length - 1 ? `<div class="joint"><span>${esc(next.kind)}</span><svg viewBox="0 0 26 12"><path d="M1 6H22" stroke="var(--ink)" stroke-width="2"/><path d="M18 1L24 6L18 11" fill="none" stroke="var(--ink)" stroke-width="2"/></svg></div>` : ''}`;
  }).join('');
}

const pips = (n) => `<div class="pips">${Array.from({ length: Math.min(n, 12) }, () => '<i></i>').join('')}<span>threat ${n}</span></div>`;
const chipEl = (x) => (x.element ? `<span class="chip el" style="background:${ELEMENT_INK[x.element] ?? 'var(--ink)'}">${esc(x.element)}</span>` : '');
const statLine = (x, W) => `${x.stats.downs} ${esc(W.downs)} · ${x.stats.harm} ${esc(W.harm)}`;

// A foe's chips: its element, its oozes (each in its colour), its stylism, its dress, its modes, its relations
const chipsOf = (x) => [
  chipEl(x),
  ...(x.skin.oozes ?? []).map((o) => `<span class="chip ooze"${oozeInk(o.id) ? ` style="border-color:${oozeInk(o.id)}"` : ''} title="${esc(OOZES[o.id]?.about ?? o.id)}">${esc(o.id)}${o.strength !== 1 ? ` ×${o.strength}` : ''}</span>`),
  x.skin.stylism !== undefined ? `<span class="chip">${esc(typeof x.skin.stylism === 'string' ? x.skin.stylism : 'stylism')}</span>` : '',
  x.skin.dress ? `<span class="chip">${esc(x.skin.dress.kind ?? x.skin.dress.faction)}</span>` : '',
  x.modes.length ? `<span class="chip">${x.modes.length} modes</span>` : '',
  ...x.relations.filter((r) => r.kind !== 'mode-of').map((r) => `<span class="chip${r.kind.startsWith('variant') ? ' var' : ''}">${esc(r.kind === 'variant-of' ? 'variant of' : r.kind)} ${esc(r.foe)}</span>`),
].join('');

/**
 * The cast drawn as both books draw it: each foe's shape, its lineup item, its tile (its photograph where `portraits`
 * holds one, `{ <id>: { figure, bust } }` image URIs; else its silhouette, which also stands in for a photograph that
 * fails to load), the tiers of tiles, and who stands on a level. `href(id)` where a foe's card is (the sheet's own
 * anchor; the world bible's, on the cast sheet).
 */
function castKit(G, C, { stamp = () => '', portraits = {}, href = (id) => `#foe-${id}` } = {}) {
  const B = bestiaryOf(G), shapes = Object.fromEntries(C.foes.map((x) => [x.id, shapeOf(B[x.id])])), W = C.words;
  const byId = Object.fromEntries(C.foes.map((x) => [x.id, x]));
  const item = (x) => ({ id: x.id, shape: shapes[x.id], ink: inkOf(x), edge: edgeOf(x), label: x.name, sub: `${x.stats.stature} m · ${x.class}`, href: href(x.id) });
  const face = (x, which = 'figure') => {
    const src = portraits[x.id]?.[which], solo = soloSvg(x, shapes[x.id]);
    return src ? `<img alt="${esc(x.name)}" src="${esc(src)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${solo}</span>` : solo;
  };
  const tile = (x) => `<a class="tile" href="${esc(href(x.id))}" style="--tier:${TIER_INK[x.rank]}"><div class="por">${face(x)}</div><h4>${esc(x.name)}</h4><span class="eyebrow">${esc(x.class)} · ${esc(x.rank)}${stamp(`foes:${x.id}`)}</span>${pips(x.stats.threat)}<p class="statline">${esc(x.costs)}</p><div class="chips">${chipsOf(x)}</div><p class="muted">${x.levels.length ? `on ${list(x.levels)}` : x.fielded ? 'stood by another' : 'kept, not stood'}</p></a>`;
  // (a variant follows the foe it is a variant of, within its tier)
  const ordered = (ids) => ids.filter((id) => !byId[id].variantOf || !ids.includes(byId[id].variantOf)).flatMap((id) => [id, ...ids.filter((v) => byId[v].variantOf === id)]);
  const tiers = () => C.tiers.map((t) => `<div class="tier"><div class="tier-h"><h3>${esc(t.name)}</h3><span class="eyebrow">${esc(t.rank)} · ${t.ids.length}</span></div><div class="tiles">${ordered(t.ids).map((id) => tile(byId[id])).join('')}</div></div>`).join('');
  const standsOn = (id) => (G.levels[id].foes !== undefined ? readLevelFoes(G.levels[id].foes, G.foes, `levels.${id}`).from.map((f) => byId[f]).filter(Boolean) : []);
  return { shapes, item, byId, face, tile, tiers, standsOn };
}

/**
 * The cast as the WORLD's bible carries it (bible-html.js), for a world that fields foes: its section (the lineup, the
 * tiers of tiles, each linking to its card on the cast sheet), each level's strip of who stands on it, and the styles
 * and theme they need. Null for a world that fields none, so its bible keeps every byte.
 *   foeBiblePart(world, { href?, portraits? }) → { css, section, onLevel(levelId) → html | '' } | null
 */
export function foeBiblePart(world, { href = (id) => `?book=foes#foe-${id}`, portraits = {} } = {}) {
  const G = readGameworld(world), C = foeCastOf(world);
  if (!C) return null;
  const T = themeOf(G), K = castKit(G, C, { href, portraits });
  const section = `<section class="part" id="foes"><div class="part-h"><span class="eyebrow">Foes · ${esc(C.words.title)}</span><h2>The cast</h2><a class="eyebrow" href="${esc(href('').replace(/#foe-$/, ''))}">Cast sheet ↗</a></div>
<div class="lineup">${plate('foes-lineup', lineupSvg(C.foes.filter((x) => x.fielded).map(K.item), T))}</div>
${K.tiers()}</section>`;
  const onLevel = (id) => {
    const who = K.standsOn(id);
    return who.length ? `<h4>Foes</h4><div class="lineup">${plate(`foes-${id}`, lineupSvg(who.map(K.item), T, { minW: 56 }))}</div>` : '';
  };
  return { css: EXTRA_CSS, section, onLevel };
}

// a dress or a beast's growth, in words
const skinWords = (skin) => {
  if (!skin) return 'its class\'s stand-in beast';
  if (skin.dress) { const S = GRUNT_STYLES[skin.dress.faction]; return `a person, the ${S.name.toLowerCase()}'s ${skin.dress.kind ?? 'crew'}${skin.dress.colourway ? `, ${S.colourways[skin.dress.colourway].reads}` : ''}`; }
  if (skin.people) return skin.people === 'human' ? 'a person' : `${skin.people} folk`;
  return `${skin.species ? words(skin.species) : 'its stand-in'}${skin.ooze ? ` grown ${[].concat(skin.ooze).map((o) => (typeof o === 'string' ? o : o.id)).join(' and ')}` : ''}`;
};

// THE CASTING CALL, as the bible lays a civilization: what it read, then an article for each role (its plate beside
// the hero, why this class, its variants, how it is dressed), then who would stand where, then the patch
function proposalHtml(G, P) {
  const T = themeOf(G), item = (id) => {
    const e = P.foes[id], r = e.rank ?? 'minion', v = P.variants.find((x) => x.id === id), ink = v ? oozeInk(v.ooze) : null;
    return { id, shape: shapeOf(e), ink: ink ?? TIER_INK[r], ...(ink ? { edge: TIER_INK[r] } : {}), label: id, sub: `${e.class}${r !== 'minion' ? ` · ${r}` : ''}` };
  };
  const roles = P.roles.map((r) => {
    const vs = P.variants.filter((v) => v.of === r.id), C = foeClass(r.class);
    return `<article class="civ role" id="role-${esc(r.id)}" style="--tier:${TIER_INK[r.rank]}"><div class="civ-h"><div><span class="eyebrow">Role · ${esc(r.id)} · ${esc(r.rank)}${r.skill ? ` · ${esc(r.skill)}` : ''}</span><h3>${esc(r.class)}</h3></div><p class="muted mono">${esc(skinWords(r.skin))} · <span class="score">score ${r.score}</span></p></div>
<p class="read">${esc(C.reads)}</p>
<div class="fort"><div class="fort-im">${plate(`role-${r.id}`, lineupSvg([r.id, ...vs.map((v) => v.id)].map(item), T))}</div><div>
<h4>Why</h4><ul class="ledger">${r.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
${vs.length ? `<h4>Variants</h4><ul class="ledger">${vs.map((v) => `<li><b>${esc(v.id)}</b> grown by ${esc(v.ooze)}${oozeInk(v.ooze) ? ` <i class="sw" style="background:${oozeInk(v.ooze)}"></i>` : ''}: ${esc(OOZES[v.ooze]?.about ?? '')} </li>`).join('')}</ul>` : ''}
${r.skin?.dress ? `<h4>Dress</h4><p class="muted">${esc(GRUNT_STYLES[r.skin.dress.faction].kinds[r.skin.dress.kind].reads)}.</p>` : ''}</div></div></article>`;
  }).join('');
  const standsOn = (id) => (P.levels[id]?.from ?? []);
  return `<section class="part" id="casting-call"><div class="part-h"><span class="eyebrow">The casting call · proposed, not written</span><h2>Who it would cast</h2></div>
<details class="brief" open><summary>What it read</summary><p class="prompt">“${esc([P.from.genre ?? 'no genre', P.from.flavor, P.from.register, P.from.era ?? 'no era'].join(' · '))}”</p><ul class="decided">${P.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></details>
${roles}
<div class="eyebrow">Where</div><div class="strip">${levelStrip(G, standsOn, item)}</div>
<details><summary>Patch</summary><pre>${esc(JSON.stringify(P.patch, null, 2))}</pre></details></section>`;
}

export function foeCastHtml(world, { portraits = {} } = {}) {
  const G = readGameworld(world), C = foeCastOf(world), P = castingCall(world), T = themeOf(G);
  if (!C && !P) throw new Error('foes: the world fields no foe and fights nothing a casting call could cast for (foes: { <id>: { class, … } }, levels.<id>.foes)');
  const W = C?.words, state = C ? foeState(world, { cast: C }) : [];
  const stampOf = (id) => state.find((s) => s.id === id);
  const stamp = (id) => { const s = stampOf(id); return s ? `<span class="stamp st-${s.status}" title="${esc(STAMPS[s.status])}">${esc(s.status)}</span>` : ''; };
  const note = (id) => { const s = stampOf(id); return s?.note ? `<div class="review-note"><span class="eyebrow">${s.status === 'revise' ? 'Sent back' : 'Note'}</span><p>${esc(s.note)}</p></div>` : ''; };
  const machine = (id) => { const m = stampOf(id)?.machine ?? []; return m.length ? `<p class="muted">Advises: ${list(m)}</p>` : ''; };
  const anchor = (id) => (id === FOE_CAST_PART ? '#lineup' : `#foe-${id.slice(5)}`);
  const mode = world.mode ?? 'gated', waiting = state.filter((s) => ['changed', 'revise', 'proposed'].includes(s.status));
  const title = W?.title ?? 'Enemy roster';
  // (the page's accent the world's paint, its trail colour the world's grass)
  const theme = `:root{${T.accent ? `--local:${T.accent};` : ''}${T.grass ? `--c-trail:${T.grass};` : ''}}`;
  // (and the world's book skin over it, as its bible wears it: book-skin.js; absent, nothing)
  const skin = skinHead(G.book);

  let body = '';
  if (C) {
    const K = castKit(G, C, { stamp, portraits }), { shapes, item, byId } = K;
    const gate = `<div class="gate" id="gate"><div class="gate-h"><span class="eyebrow">The gate</span><span class="mode mode-${esc(mode)}" title="${esc(MODES[mode])}">${esc(mode)}</span></div>
<ol class="parts">${state.map((s) => `<li><a href="${anchor(s.id)}">${esc(s.name)}</a>${stamp(s.id)}<code>${esc(s.print)}</code>${s.note ? `<p class="muted">${esc(s.note)}</p>` : ''}</li>`).join('')}</ol>
${waiting.length ? `<p class="muted">Next: ${waiting.map((s) => `<a href="${anchor(s.id)}">${esc(s.name)}</a>`).join(', ')}</p>` : ''}</div>`;
    const fielded = C.foes.filter((x) => x.fielded).length;
    const standsOn = K.standsOn;
    const cover = `<section class="part" id="cover"><div class="cover"><div><h1>${esc(G.name)}</h1><p class="lede">${C.foes.length} in the cast${fielded < C.foes.length ? `, ${fielded} stood on a level` : ''} · ${esc(C.register)} · ${esc(C.flavor)}${T.kit ? ` · ${esc(T.kit)}` : ''}</p></div><figure class="hero">${plate('cover', lineupSvg(C.foes.filter((x) => x.fielded).map(item), T, { labels: false, minW: 50 }))}</figure></div>
${gate}<div class="eyebrow">Levels</div><div class="strip">${levelStrip(G, standsOn, item)}</div></section>`;
    const lineup = `<section class="part" id="lineup"><div class="part-h"><span class="eyebrow">Lineup ${stamp(FOE_CAST_PART)}</span><h2>At their size</h2></div>${note(FOE_CAST_PART)}<div class="lineup">${plate('lineup', lineupSvg(C.foes.map(item), T))}</div>${machine(FOE_CAST_PART)}</section>`;
    const roster = `<section class="part" id="roster"><div class="part-h"><span class="eyebrow">${esc(W.title)}</span><h2>By tier</h2></div>${K.tiers()}</section>`;
    const card = (x) => {
      const id = `foes:${x.id}`, A = x.attack, M = x.mind, S = x.skin;
      const sitRows = M.situations.map((s) => `<tr><td><b>${esc(s.situation)}</b><br><span class="muted">${esc(s.asks)}</span></td><td>${list(s.does)}</td><td><span class="mk mk-${esc(s.status)}">${esc(s.status)}</span></td></tr>`).join('');
      return `<article class="card foe" id="foe-${esc(x.id)}" style="--tier:${TIER_INK[x.rank]}"><div class="foe-h"><div class="por">${K.face(x, portraits[x.id]?.bust ? 'bust' : 'figure')}</div><div class="card-h"><span class="eyebrow">${esc(x.tier)} · ${esc(x.class)} ${stamp(id)}</span><h3>${esc(x.name)}</h3></div></div>${note(id)}
<dl class="counsel"><dt>Does</dt><dd class="lesson">${esc(x.reads)}</dd><dt>Beat it</dt><dd><ul>${x.beat.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></dd><dt>Costs</dt><dd>${esc(x.costs)}</dd></dl>
<h4>Who</h4>${dl([['skin', esc(S.dress ? 'a person' : S.says)], ['grown by', S.oozes ? `${S.oozes.map((o) => `<b>${esc(o.id)}</b> at ${o.strength}`).join(', ')}` : undefined], ['stylism', S.stylism !== undefined ? esc(typeof S.stylism === 'string' ? S.stylism : JSON.stringify(S.stylism)) : undefined], ['dressed', S.dress ? `${esc(GRUNT_STYLES[S.dress.faction].name)} · ${esc(S.dress.kind ?? 'crew')} · ${esc(GRUNT_STYLES[S.dress.faction].colourways[S.dress.colourway].reads)}${S.dress.kind ? `: ${esc(GRUNT_STYLES[S.dress.faction].kinds[S.dress.kind].reads.replace(/^the [a-z ]+: /, ''))}` : ''}${S.dress.body ? ` · ${esc(S.dress.body)} body` : ''}` : undefined], ['rank', esc(M.rank.word)], ['skill', esc(x.skill)], ['element', x.element ? esc(x.element) : undefined]])}
<h4>Numbers</h4>${dl([[W.downs, `${x.stats.downs}`], [W.harm, `${x.stats.harm}`], [W.pace, x.stats.speed ? `${esc(x.stats.pace)} · ${x.stats.speed} m/s` : 'never moves'], ['stature', `${x.stats.stature} m`], ['threat', `${x.stats.threat}`], ['stomp', esc(x.stats.stomp.word)]])}
<h4>Attack</h4>${dl([['kind', esc(A.kind)], [W.telegraph, A.telegraph !== undefined ? `${A.telegraph} s` : undefined], ['active', A.active !== undefined ? `${A.active} s` : undefined], ['recovery', A.recovery !== undefined ? `${A.recovery} s` : undefined], ['reach', A.reach !== undefined ? `${A.reach} m` : undefined], ['pattern', A.pattern ? esc(A.pattern) : undefined], ['zone', A.zone ? esc(A.zone) : undefined]])}
<h4>Shelves</h4>${shelvesOf(x)}
<h4>Where</h4><p class="muted">${x.levels.length ? list(x.levels) : x.fielded ? 'with its relations' : '—'}</p>
<details class="designer"><summary>Designer</summary>
<h4>Mind</h4>${dl([['motivation', `<b>${esc(M.motivation.word)}</b>: ${esc(M.motivation.line)}`], ['aggressiveness', `<b>${esc(M.aggressiveness.word)}</b>: ${esc(M.aggressiveness.line)}`], ...M.senses.map((s) => [s.axis, `<b>${esc(s.word)}</b>: ${esc(s.line)}`]), ['switches', M.switches.length ? M.switches.map((s) => `<b>${esc(s.word)}</b> ${esc(s.line)}`).join('; ') : undefined]])}
<table class="sit"><tr><th>when</th><th>it does</th><th>runs</th></tr>${sitRows}</table>
<h4>Engines</h4><div class="marks">${Object.entries(x.marks ?? {}).map(([e, m]) => `<span class="mk mk-${esc(m)}">${esc(e)} ${esc(m)}</span>`).join('')}</div>
${machine(id)}</details></article>`;
    };
    const shelvesOf = (x) => `${dl([['modes', x.modes.length ? x.modes.map((m) => (m === x.id ? `<b>${esc(m)}</b>` : `<a href="#foe-${esc(m)}">${esc(m)}</a>`)).join(' → ') : undefined], ['states', x.states.length ? x.states.map((s) => `<b>${esc(s.name)}</b>${s.color ? ` (${esc(s.color)})` : ''}: ${esc(s.reads)}`).join('; ') : undefined], ['death', esc(x.death.says)], ...x.relations.map((r) => [r.kind === 'variant-of' ? 'variant of' : r.kind, `<a href="#foe-${esc(r.foe)}">${esc(r.foe)}</a>: ${esc(r.says)}`])])}`;
    const cards = `<section class="part" id="cards"><div class="part-h"><h2>Cards</h2></div><div class="cards">${C.foes.map(card).join('')}</div></section>`;
    body = `${cover}\n${lineup}\n${roster}\n${cards}`;
  } else {
    body = `<section class="part" id="cover"><div class="cover"><div><h1>${esc(G.name)}</h1><p class="lede">no cast yet · ${esc(P.from.register)} · ${esc(P.from.flavor)}${T.kit ? ` · ${esc(T.kit)}` : ''}</p></div><figure class="hero">${plate('cover', lineupSvg(P.roles.map((r) => ({ id: r.id, shape: shapeOf(P.foes[r.id]), ink: TIER_INK[r.rank] })), T, { labels: false, minW: 50 }))}</figure></div></section>`;
  }
  const proposal = !G.foes && P ? proposalHtml(G, P) : '';
  const tabs = C ? `<a href="#cover">Cast</a><a href="#gate">Gate</a><a href="#lineup">Lineup</a><a href="#roster">Tiers</a><a href="#cards">Cards</a>${proposal ? '<a href="#casting-call">Casting call</a>' : ''}` : `<a href="#cover">Cast</a><a href="#casting-call">Casting call</a>${P.roles.map((r) => `<a href="#role-${esc(r.id)}">${esc(r.id)}</a>`).join('')}`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(G.name)} · ${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&display=swap">${skin.link}
<style>${CSS}${EXTRA_CSS}${theme}${skin.css ? `\n${skin.css}` : ''}</style></head><body><div class="wrap">
<div class="mast"><div class="t">${esc(title)}</div><div class="eyebrow">${esc(G.id)} · seed ${G.seed}</div></div>
<nav class="tabs" aria-label="Sections">${tabs}</nav>
${body}
${proposal}
<footer><span class="eyebrow">Every foe drawn from its recipe</span><span class="eyebrow">Cast sheet</span></footer>
</div></body></html>`;
}
