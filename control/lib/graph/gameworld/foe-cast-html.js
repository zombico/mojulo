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
 * `foeCastHtml(world, { portrait })` is pure (the same world, the same page). `portrait(ref)` → an image's URL for a
 * figure's sketch, or null (the route's: the sketch's PNG while served; none in a download); without one a foe is shown by
 * its lineup silhouette. The lineup plate is fenced `<!--plate:lineup-->…<!--/plate-->`.
 */
import { foeCastOf, foeState } from './foe-cast.js';
import { castingCall } from './foe-casting.js';
import { readGameworld } from './world.js';
import { MODES, STAMPS, FOE_CAST_PART } from './review.js';
import { esc, plate, CSS } from './bible-html.js';
import { resolveFoe } from '../foes/resolve.js';
import { bestiaryOf } from './foes.js';

const list = (a) => (a && a.length ? a.map(esc).join(', ') : '—');
const dl = (rows) => `<dl class="vocab">${rows.filter(([, v]) => v !== undefined).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
const r2 = (v) => Math.round(v * 100) / 100;
/** The colour a foe's element is drawn in on the sheet (an element without a row: the tier's ink). */
const ELEMENT_INK = Object.freeze({ fire: '#d4602a', ice: '#5aa6d6', water: '#3f7fc4', earth: '#8a6a3c', wind: '#5fae8e', lightning: '#c9a227', light: '#d8b84a', shadow: '#5b4a7a', poison: '#6f9a3a' });
const TIER_INK = Object.freeze({ minion: '#7d8794', elite: '#4f7fd0', miniboss: '#b9822a', boss: '#b14f39' });

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
.proposal{border:1px dashed var(--ink);border-radius:4px;padding:16px;display:grid;gap:12px;background:transparent}
`;

// a foe's outline as drawn at its game size: a body on legs (a person upright, a beast long), a flier held up off the
// ground; `w` and `h` metres, `ink` its colour
function silhouette(x, ground, px, { w, h, people, flies }, ink) {
  const W = w * px, H = h * px, lift = flies ? Math.max(0.6, h) * px : 0, y = ground - lift - H;
  if (people) {
    const head = Math.min(W, H * 0.16);
    return `<g fill="${ink}"><circle cx="${x}" cy="${r2(y + head / 2)}" r="${r2(head / 2)}"/><rect x="${r2(x - W / 2)}" y="${r2(y + head * 1.05)}" width="${r2(W)}" height="${r2(H * 0.48)}" rx="${r2(W * 0.3)}"/><rect x="${r2(x - W * 0.42)}" y="${r2(y + head * 1.05 + H * 0.46)}" width="${r2(W * 0.34)}" height="${r2(H - head * 1.05 - H * 0.46)}" rx="2"/><rect x="${r2(x + W * 0.08)}" y="${r2(y + head * 1.05 + H * 0.46)}" width="${r2(W * 0.34)}" height="${r2(H - head * 1.05 - H * 0.46)}" rx="2"/></g>`;
  }
  const body = H * (flies ? 1 : 0.62), legs = flies ? 0 : H - body;
  return `<g fill="${ink}"><ellipse cx="${x}" cy="${r2(y + body / 2)}" rx="${r2(W / 2)}" ry="${r2(body / 2)}"/>${flies ? `<path d="M${r2(x - W / 2)} ${r2(y + body / 2)} L${r2(x - W)} ${r2(y - body * 0.2)} L${r2(x - W * 0.2)} ${r2(y + body * 0.3)} Z M${r2(x + W / 2)} ${r2(y + body / 2)} L${r2(x + W)} ${r2(y - body * 0.2)} L${r2(x + W * 0.2)} ${r2(y + body * 0.3)} Z"/>` : `<rect x="${r2(x - W * 0.36)}" y="${r2(y + body * 0.8)}" width="${r2(Math.max(2, W * 0.1))}" height="${r2(legs + body * 0.2)}"/><rect x="${r2(x + W * 0.26)}" y="${r2(y + body * 0.8)}" width="${r2(Math.max(2, W * 0.1))}" height="${r2(legs + body * 0.2)}"/>`}</g>`;
}

// the size a foe is drawn at: its grown body at its game scale (foes/resolve.js), a person upright at its height
function shapeOf(G, x) {
  const f = resolveFoe((({ class: c, rank, skill, skin }) => ({ class: c, ...(rank ? { rank } : {}), ...(skill ? { skill } : {}), ...(skin ? { skin } : {}) }))(bestiaryOf(G)[x.id]));
  const people = x.skin.kind !== 'beast', m = f.measured;
  if (people) return { w: r2(m.height * f.scale * 0.32), h: r2(m.height * f.scale), people: true, flies: false };
  return { w: r2(m.extent * f.scale), h: r2(m.height * f.scale), people: false, flies: !!m.wings };
}

const inkOf = (x) => (x.element && ELEMENT_INK[x.element]) || TIER_INK[x.rank];

/** The lineup: every foe at the size it reads at, the hero first, on a metre rule. */
function lineupSvg(C, shapes) {
  const tallest = Math.max(C.hero.height, ...C.foes.map((x) => { const s = shapes[x.id]; return s.h + (s.flies ? Math.max(0.6, s.h) : 0); }));
  const px = Math.max(24, Math.min(90, 260 / tallest)), top = 26, ground = top + tallest * px + 6;
  let at = 40;
  const slots = [{ id: 'hero', w: C.hero.height * 0.32 }, ...C.foes.map((x) => ({ id: x.id, w: shapes[x.id].w * (shapes[x.id].flies ? 2 : 1) }))].map((s) => { const w = Math.max(70, s.w * px + 24), mid = at + w / 2; at += w; return { ...s, mid }; });
  const width = at + 20, height = ground + 44, rows = [];
  for (let m = 0; m <= Math.ceil(tallest); m++) { const y = r2(ground - m * px); rows.push(`<line class="lu-r" x1="30" x2="${width - 10}" y1="${y}" y2="${y}"/><text class="lu-m" x="4" y="${r2(y + 3)}">${m} m</text>`); }
  const hero = slots[0], drawn = [`${silhouette(hero.mid, ground, px, { w: C.hero.height * 0.32, h: C.hero.height, people: true, flies: false }, 'var(--ink)')}<text class="lu-t" x="${hero.mid}" y="${r2(ground + 16)}" text-anchor="middle">the hero</text><text class="lu-m" x="${hero.mid}" y="${r2(ground + 30)}" text-anchor="middle">${C.hero.height} m</text>`];
  slots.slice(1).forEach((s) => {
    const x = C.foes.find((y) => y.id === s.id), sh = shapes[s.id];
    drawn.push(`<a href="#foe-${esc(s.id)}">${silhouette(s.mid, ground, px, sh, inkOf(x))}<text class="lu-t" x="${s.mid}" y="${r2(ground + 16)}" text-anchor="middle">${esc(x.name)}</text><text class="lu-m" x="${s.mid}" y="${r2(ground + 30)}" text-anchor="middle">${x.stats.stature} m · ${esc(x.class)}</text></a>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(width)} ${r2(height)}" width="${r2(width)}" height="${r2(height)}" role="img" aria-label="The cast at the size each reads at, beside the hero">${rows.join('')}<line class="lu-g" x1="30" x2="${width - 10}" y1="${r2(ground)}" y2="${r2(ground)}"/>${drawn.join('')}</svg>`;
}

function soloSvg(x, sh) {
  const tall = sh.h + (sh.flies ? Math.max(0.6, sh.h) : 0), px = 110 / Math.max(tall, sh.w * (sh.flies ? 2 : 1) * 0.8, 0.2), w = Math.max(60, sh.w * px * (sh.flies ? 2 : 1) + 20);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(w)} 124" width="${r2(w)}" height="124" aria-hidden="true">${silhouette(w / 2, 120, px, sh, inkOf(x))}</svg>`;
}

const pips = (n) => `<div class="pips">${Array.from({ length: Math.min(n, 12) }, () => '<i></i>').join('')}<span>threat ${n}</span></div>`;
const chipEl = (x) => (x.element ? `<span class="chip el" style="background:${ELEMENT_INK[x.element] ?? 'var(--ink)'}">${esc(x.element)}</span>` : '');
const statLine = (x, W) => `${x.stats.downs} ${esc(W.downs)} · ${x.stats.harm} ${esc(W.harm)}`;

function proposalHtml(P) {
  return `<section class="part" id="casting-call"><div class="part-h"><span class="eyebrow">The casting call · proposed, not written</span><h2>Who it would cast</h2><p class="muted">The world keeps no bestiary. Read from what it says: its intent's cube (the Mind gem's values, its combat), its register and flavor, its era. Write the patch through design_game to adopt it, or any of it.</p></div><div class="proposal">
<ul class="principles">${P.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
<table class="sit"><tr><th>role</th><th>class</th><th>rank</th><th>skin</th><th>why</th></tr>${P.roles.map((r) => `<tr><td><b>${esc(r.id)}</b><br><span class="muted">${esc(r.role)}</span></td><td>${esc(r.class)}</td><td>${esc(r.rank)}${r.skill ? ` · ${esc(r.skill)}` : ''}</td><td>${r.skin ? esc(r.skin.people) : '<span class="muted">its stand-in</span>'}</td><td>${list(r.why)} <span class="muted">(${r.score})</span></td></tr>`).join('')}</table>
<h4>Where they would stand</h4>${dl(Object.entries(P.levels).map(([id, v]) => [id, `${list(v.from)}${v.win ? ` · won by ${esc(v.win)}` : ''}`]))}
<details><summary>The patch that writes it</summary><pre>${esc(JSON.stringify(P.patch, null, 2))}</pre></details></div></section>`;
}

export function foeCastHtml(world, { portrait = () => null } = {}) {
  const G = readGameworld(world), C = foeCastOf(world), P = castingCall(world);
  if (!C && !P) throw new Error('foes: the world fields no foe and fights nothing a casting call could cast for (foes: { <id>: { class, … } }, levels.<id>.foes)');
  const W = C?.words, state = C ? foeState(world, { cast: C }) : [];
  const stampOf = (id) => state.find((s) => s.id === id);
  const stamp = (id) => { const s = stampOf(id); return s ? `<span class="stamp st-${s.status}" title="${esc(STAMPS[s.status])}">${esc(s.status)}</span>` : ''; };
  const note = (id) => { const s = stampOf(id); return s?.note ? `<div class="review-note"><span class="eyebrow">${s.status === 'revise' ? 'Sent back' : 'Note'}</span><p>${esc(s.note)}</p></div>` : ''; };
  const machine = (id) => { const m = stampOf(id)?.machine ?? []; return m.length ? `<p class="muted">The machine gate advises: ${list(m)}.</p>` : '<p class="muted">The machine gate holds.</p>'; };
  const anchor = (id) => (id === FOE_CAST_PART ? '#lineup' : `#foe-${id.slice(5)}`);
  const mode = world.mode ?? 'gated', waiting = state.filter((s) => ['changed', 'revise', 'proposed'].includes(s.status));
  const title = W?.title ?? 'Enemy roster';

  let body = '';
  if (C) {
    const shapes = Object.fromEntries(C.foes.map((x) => [x.id, shapeOf(G, x)]));
    const gate = `<div class="gate" id="gate"><div class="gate-h"><span class="eyebrow">The gate</span><span class="mode mode-${esc(mode)}">${esc(mode)}</span><p class="muted">${esc(MODES[mode])}.</p></div>
<ol class="parts">${state.map((s) => `<li><a href="${anchor(s.id)}">${esc(s.name)}</a>${stamp(s.id)}<code>${esc(s.print)}</code>${s.note ? `<p class="muted">${esc(s.note)}</p>` : ''}</li>`).join('')}</ol>
<p class="muted">${waiting.length ? `Next to look at: ${waiting.map((s) => `<a href="${anchor(s.id)}">${esc(s.name)}</a>`).join(', ')}.` : 'Nothing is waiting on you.'}</p>
<p class="muted">The machine gate is measured; whether each foe reads right is yours to judge.</p></div>`;
    const fielded = C.foes.filter((x) => x.fielded).length;
    const cover = `<section class="part" id="cover"><div class="cover"><div><h1>${esc(G.name)}</h1><p class="lede">${esc(W.lede)} · ${C.foes.length} in the cast${fielded < C.foes.length ? `, ${fielded} stood on a level` : ''} · ${esc(C.register)} · ${esc(C.flavor)}</p></div><p class="muted">Its stats are said as a ${esc(C.flavor)} game says them (${esc(W.downs)}, ${esc(W.harm)}), its tiers in the ${esc(C.register)} register: ${esc(C.from)}.</p></div>${gate}</section>`;
    const lineup = `<section class="part" id="lineup"><div class="part-h"><span class="eyebrow">The lineup ${stamp(FOE_CAST_PART)}</span><h2>At the size each reads at</h2><p class="muted">Every foe drawn at its stature in the game (its class's presence grown by its rank; a person at its height), beside the hero, on a metre rule. A flier is held off the ground. Coloured by its element, else its tier.</p></div>${note(FOE_CAST_PART)}<div class="lineup">${plate('lineup', lineupSvg(C, shapes))}</div>${machine(FOE_CAST_PART)}</section>`;
    const tile = (x) => {
      const src = x.figure ? portrait(x.figure) : null;
      return `<a class="tile" href="#foe-${esc(x.id)}" style="--tier:${TIER_INK[x.rank]}"><div class="por">${src ? `<img alt="${esc(x.name)}" src="${esc(src)}" loading="lazy">` : soloSvg(x, shapes[x.id])}</div><h4>${esc(x.name)}</h4><span class="eyebrow">${esc(x.class)} · ${esc(x.rank)}${stamp(`foes:${x.id}`)}</span>${pips(x.stats.threat)}<p class="statline">${statLine(x, W)}</p><div class="chips">${chipEl(x)}${x.modes.length ? `<span class="chip">${x.modes.length} modes</span>` : ''}${x.relations.filter((r) => r.kind !== 'mode-of').map((r) => `<span class="chip">${esc(r.kind)} ${esc(r.foe)}</span>`).join('')}</div><p class="muted">${x.levels.length ? `on ${list(x.levels)}` : x.fielded ? 'stood by another' : 'kept, not stood'}</p></a>`;
    };
    const roster = `<section class="part" id="roster"><div class="part-h"><span class="eyebrow">${esc(W.title)}</span><h2>By tier</h2></div>${C.tiers.map((t) => `<div class="tier"><div class="tier-h"><h3>${esc(t.name)}</h3><span class="eyebrow">${esc(t.rank)} · ${t.ids.length}</span></div><div class="tiles">${t.ids.map((id) => tile(C.foes.find((x) => x.id === id))).join('')}</div></div>`).join('')}</section>`;
    const card = (x) => {
      const id = `foes:${x.id}`, A = x.attack, M = x.mind;
      const sitRows = M.situations.map((s) => `<tr><td><b>${esc(s.situation)}</b><br><span class="muted">${esc(s.asks)}</span></td><td>${list(s.does)}</td><td><span class="mk mk-${esc(s.status)}">${esc(s.status)}</span></td></tr>`).join('');
      return `<article class="card foe" id="foe-${esc(x.id)}" style="--tier:${TIER_INK[x.rank]}"><div class="card-h"><span class="eyebrow">${esc(x.tier)} · ${esc(x.class)} ${stamp(id)}</span><h3>${esc(x.name)}</h3></div>${note(id)}
<p class="lesson">${esc(x.reads)}</p>
<h4>Who it is</h4>${dl([['skin', `${esc(x.skin.says)} <span class="muted">(${esc(x.skin.kind)})</span>`], ['rank', `<b>${esc(M.rank.word)}</b>: ${esc(M.rank.line)}`], ['skill', esc(x.skill)], ['element', x.element ? esc(x.element) : undefined]])}
<h4>Its numbers</h4>${dl([[W.downs, `${x.stats.downs}${W.health ? ` <span class="muted">(${x.stats.downs / 20} of the hero's blows)</span>` : ` <span class="muted">(${x.stats.hp} health)</span>`}`], [W.harm, `${x.stats.harm}${W.health ? '' : ` <span class="muted">(${x.stats.damage} of the hero's ${C.hero.hp})</span>`}`], [W.pace, x.stats.speed ? `${esc(x.stats.pace)} · ${x.stats.speed} m/s` : 'never moves'], ['stature', `${x.stats.stature} m`], ['threat', `${x.stats.threat}`], ['stomp', `<b>${esc(x.stats.stomp.word)}</b>: ${esc(x.stats.stomp.says)}`]])}
<h4>Its attack</h4>${dl([['kind', `<b>${esc(A.kind)}</b>: ${esc(A.line)}`], [W.telegraph, A.telegraph !== undefined ? `${A.telegraph} s` : undefined], ['active', A.active !== undefined ? `${A.active} s` : undefined], ['recovery', A.recovery !== undefined ? `${A.recovery} s` : undefined], ['reach', A.reach !== undefined ? `${A.reach} m` : undefined], ['pattern', A.pattern ? esc(A.pattern) : undefined], ['zone', A.zone ? esc(A.zone) : undefined]])}
<h4>Its mind</h4>${dl([['motivation', `<b>${esc(M.motivation.word)}</b>: ${esc(M.motivation.line)}`], ['aggressiveness', `<b>${esc(M.aggressiveness.word)}</b>: ${esc(M.aggressiveness.line)}`], ...M.senses.map((s) => [s.axis, `<b>${esc(s.word)}</b>: ${esc(s.line)}`]), ['switches', M.switches.length ? M.switches.map((s) => `<b>${esc(s.word)}</b> ${esc(s.line)}`).join('; ') : undefined]])}
<table class="sit"><tr><th>when</th><th>it does</th><th>runs</th></tr>${sitRows}</table>
<h4>Its shelves</h4>${dl([['modes', x.modes.length ? x.modes.map((m) => (m === x.id ? `<b>${esc(m)}</b>` : `<a href="#foe-${esc(m)}">${esc(m)}</a>`)).join(' → ') : undefined], ['states', x.states.length ? x.states.map((s) => `<b>${esc(s.name)}</b>${s.color ? ` (${esc(s.color)})` : ''}: ${esc(s.reads)}`).join('; ') : undefined], ['death', esc(x.death.says)], ...x.relations.map((r) => [r.kind, `<a href="#foe-${esc(r.foe)}">${esc(r.foe)}</a>: ${esc(r.says)}`])])}
<h4>Where it stands</h4><p class="muted">${x.levels.length ? list(x.levels) : x.fielded ? 'on the levels its relations stand on' : 'kept in the bestiary; no level stands it'}</p>
<h4>What an engine keeps</h4><div class="marks">${Object.entries(x.marks ?? {}).map(([e, s]) => `<span class="mk mk-${esc(s)}">${esc(e)} ${esc(s)}</span>`).join('')}</div>
${machine(id)}</article>`;
    };
    const cards = `<section class="part" id="cards"><div class="part-h"><span class="eyebrow">The cards</span><h2>Each foe</h2><p class="muted">The lesson it teaches the player first; then its numbers in the hero's frame, its mind as the Mind gem resolves it on its body, and the shelves over it.</p></div><div class="cards">${C.foes.map(card).join('')}</div></section>`;
    body = `${cover}\n${lineup}\n${roster}\n${cards}`;
  } else {
    body = `<section class="part" id="cover"><div class="cover"><div><h1>${esc(G.name)}</h1><p class="lede">no cast yet · ${esc(P.from.register)} · ${esc(P.from.flavor)}</p></div></div></section>`;
  }
  const proposal = !G.foes && P ? proposalHtml(P) : '';
  const tabs = C ? `<a href="#cover">Cast</a><a href="#gate">Gate</a><a href="#lineup">Lineup</a><a href="#roster">Tiers</a><a href="#cards">Cards</a>${proposal ? '<a href="#casting-call">Casting call</a>' : ''}` : '<a href="#cover">Cast</a><a href="#casting-call">Casting call</a>';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(G.name)} · ${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&display=swap">
<style>${CSS}${EXTRA_CSS}</style></head><body><div class="wrap">
<div class="mast"><div class="t">${esc(title)}</div><div class="eyebrow">${esc(G.id)} · seed ${G.seed}</div></div>
<nav class="tabs" aria-label="Sections">${tabs}</nav>
${body}
${proposal}
<footer><span class="eyebrow">Every foe read from its recipe</span><span class="eyebrow">Cast sheet</span></footer>
</div></body></html>`;
}
