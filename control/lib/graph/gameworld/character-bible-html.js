/**
 * THE CHARACTER BIBLE — the binder for the creator who makes the hero: the direction every page reads (the tradition,
 * where it comes from, the motif, the leading and supporting elements, every departure ledgered), one plate for each
 * looks element, the composed hero in its bare base, the base pinned, the motion, the actions, the adornment, the
 * world's equipment table it seeds, the systems numbered from the actions, and what is left open.
 *
 * It is the APPROVAL GATE (character-review.js) as the world's bible is: each part carries its stamp, the cover lists
 * them with what to look at next, and says which later steps (adornment, the game's systems) may start. What the
 * machine measured is stated per part; whether a plate reads right is the creator's, and nothing here says it does.
 *
 * `characterBibleHtml(world, { renders, lookup })` is pure (the same world, the same page). The composed hero's
 * turnaround is drawn by the hero door, not by this page: a script mints the orders and hands the views in as
 * `renders: { front, three, back }` (SVG strings); without them the page shows the orders to run. Each plate is fenced
 * `<!--plate:name-->…<!--/plate-->` so `out-sheet.mjs characters --raster` can swap its SVG for an image.
 */
import { resolveBook, characterState, characterReady } from './character-review.js';
import { heroOrders } from './hero-looks.js';
import { SYSTEM_KINDS, STAGES } from './actions.js';
import { AXES, VIBES } from './hero-vibe.js';
import { buildAt } from './adornment.js';
import { suggestKit } from './adornment-kit.js';
import { equipmentOrders } from './equipment.js';
import { mechanicsOrders } from './mechanics.js';
import { TRADITIONS, FROM } from './characters.js';
import { MODES, STAMPS } from './review.js';
import { esc, plate, CSS } from './bible-html.js';

const json = (v) => esc(JSON.stringify(v));
const list = (a) => (a && a.length ? a.map(esc).join(', ') : '—');
const swatch = (hex, label) => `<span class="sw" title="${esc(label ? `${label} ${hex}` : hex)}"><i style="background:${esc(hex)}"></i>${label ? `<b>${esc(label)}</b>` : ''}</span>`;
const swatches = (o) => `<div class="sws">${Object.entries(o).map(([k, v]) => swatch(v, k)).join('')}</div>`;
const dl = (rows) => `<dl class="vocab">${rows.filter(([, v]) => v !== undefined).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

const EXTRA_CSS = `
.sws{display:flex;flex-wrap:wrap;gap:8px}.sw{display:inline-flex;align-items:center;gap:6px;font:11px var(--mono);color:var(--muted)}.sw i{width:22px;height:22px;border-radius:3px;border:1px solid var(--rule)}.sw b{font-weight:500;color:var(--ink)}
.turn{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.turn figure{background:#fff;border:1px solid var(--rule);border-radius:3px;padding:6px}.turn figcaption{font:10.5px var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:4px}
.turn.colour figure{padding:0;overflow:hidden}.turn.colour img{display:block;width:100%;height:auto}.turn.colour figcaption{padding:4px 6px}details.wire{margin-top:10px}details.wire summary{font:10.5px var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);cursor:pointer}details.wire .turn{margin-top:8px}
.live iframe{width:100%;height:520px;border:1px solid var(--rule);border-radius:3px;background:#fff}.live figcaption{font:10.5px var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:4px}
.norender{border:1.5px dashed var(--rule);border-radius:4px;padding:16px;display:grid;gap:8px}
.ready{display:grid;gap:4px}.ready b{font:500 12px var(--mono);letter-spacing:.08em;text-transform:uppercase}.yes{color:var(--c-trail)}.no{color:var(--local)}
table.powers{border-collapse:collapse;width:100%;font-size:13.5px}table.powers th,table.powers td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--rule)}table.powers th{font:10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.stages{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.stage{border:1px solid var(--rule);border-radius:4px;padding:12px;display:grid;gap:6px;align-content:start}
.axes{display:grid;gap:6px}.axis{display:grid;grid-template-columns:110px minmax(0,1fr) 48px;gap:10px;align-items:center;font:12px var(--mono)}.axis b{font-weight:500;text-transform:uppercase;letter-spacing:.08em}
.bar{position:relative;height:6px;border-radius:3px;background:var(--rule)}.bar::before{content:"";position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:var(--muted)}.bar i{position:absolute;top:-4px;width:12px;height:14px;margin-left:-6px;border-radius:3px;background:var(--ink)}
@media (max-width:860px){.turn,.stages{grid-template-columns:1fr}}
`;

/** The character book of a world, as one page. */
export function characterBibleHtml(world, { renders = {}, lookup } = {}) {
  const B = resolveBook(world);
  if (!B) throw new Error('characters: the world has no character book (characters: { direction, hero? }); the world bible names it open');
  const { G, D, looks: L, composed: C, hero, actions: R } = B, orders = heroOrders(G, { composed: C });
  const state = characterState(world, { lookup, book: B }), ready = characterReady(world, { state });
  const stampOf = (id) => state.find((x) => x.id === id);
  const stamp = (id) => { const x = stampOf(id); return x ? `<span class="stamp st-${x.status}" title="${esc(STAMPS[x.status])}">${esc(x.status)}</span>` : ''; };
  const note = (id) => { const x = stampOf(id); return x?.note ? `<div class="review-note"><span class="eyebrow">${x.status === 'revise' ? 'Sent back' : 'Note'}</span><p>${esc(x.note)}</p></div>` : ''; };
  const machine = (id) => { const m = stampOf(id)?.machine ?? []; return m.length ? `<p class="muted">The machine gate advises: ${list(m)}.</p>` : '<p class="muted">The machine gate holds.</p>'; };
  const T = TRADITIONS[D.tradition], mode = world.mode ?? 'gated', waiting = state.filter((x) => ['changed', 'revise', 'proposed'].includes(x.status));
  const anchor = (id) => `#${id.replace(':', '-')}`;

  const gate = `<div class="gate" id="gate"><div class="gate-h"><span class="eyebrow">The gate</span><span class="mode mode-${esc(mode)}">${esc(mode)}</span><p class="muted">${esc(MODES[mode])}.</p></div>
<ol class="parts">${state.map((x) => `<li><a href="${anchor(x.id)}">${esc(x.name)}</a>${stamp(x.id)}<code>${esc(x.print)}</code>${x.note ? `<p class="muted">${esc(x.note)}</p>` : ''}</li>`).join('')}</ol>
<p class="muted">${waiting.length ? `Next to look at: ${waiting.map((x) => `<a href="${anchor(x.id)}">${esc(x.name)}</a>`).join(', ')}.` : 'Nothing is waiting on you.'}</p>
<p class="muted">The machine gate is measured; whether each plate reads right is yours to judge.</p></div>`;

  const direction = `<section class="part" id="characters-direction"><div class="part-h"><span class="eyebrow">Direction ${stamp('characters:direction')}</span><h2>What every page reads</h2></div><div class="card">${note('characters:direction')}
${dl([
    ['tradition', `<b>${esc(D.tradition)}</b>: ${esc(T.read)}`],
    ['from', `${esc(D.from)}: ${esc(FROM[D.from])}`],
    ['the hero', `${esc(D.hero.head)} head · ${esc(D.hero.proportions)} proportions · ${D.hero.toon ? 'the character light' : 'no character light'}`],
    ...(D.kit ? [['kit', `${esc(D.kit)} · ${esc(D.pole)} pole`]] : []),
    ['motif', D.motif ? `${list(D.motif.words)}${D.motif.on ? ` on ${list(D.motif.on)}` : ''}` : '—'],
    ['leading element', D.primary ? esc(D.primary) : '—'],
    ['supporting element', D.secondary ? esc(D.secondary) : '—'],
  ])}
${D.palette ? swatches(Object.fromEntries(D.palette.map((h, i) => [`${i + 1}`, h]))) : D.ramps?.length ? `<div class="sws">${D.ramps.map((r) => swatch(r.stops[Math.floor(r.stops.length / 2)], r.name)).join('')}</div><p class="muted">The kit's ramps, handed down.</p>` : ''}
<h4>Where it departs</h4>${D.ledger.length ? `<ul class="ledger">${D.ledger.map((o) => `<li><b>${esc(o.key)}</b> ${json(o.local)} <span>${esc(o.scope)}: ${json(o.world)}</span></li>`).join('')}</ul>` : '<p class="muted">Follows its tradition and its world in everything.</p>'}
${machine('characters:direction')}</div></section>`;

  const looks = `<section class="part" id="hero-looks"><div class="part-h"><span class="eyebrow">The hero · looks</span><h2>Four pages, each its own</h2><p class="muted">Visual only: no stats. Each element is designed and reviewed on its own, then composed top down into the base.</p></div><div class="cards">${Object.entries(L.elements).map(([k, E]) => `<article class="card" id="hero-${k}"><div class="card-h"><span class="eyebrow">${esc(E.part)} ${stamp(E.part)}</span><h3>${esc(k)}</h3><p class="muted">${esc(E.read)}</p></div>${note(E.part)}
${k === 'colour' && E.spec.palette ? swatches(E.spec.palette) : ''}
${dl(Object.entries(E.spec).filter(([f]) => !(k === 'colour' && f === 'palette')).map(([f, v]) => [f, json(v)]))}
${Object.keys(E.reads).length ? `<p class="muted">Read from the direction: ${Object.entries(E.reads).map(([f, v]) => `${esc(f)} ${json(v)}`).join(' · ')}</p>` : ''}${machine(E.part)}</article>`).join('')}</div>
${L.unread.length ? `<p class="muted">Not placed: ${L.unread.map((u) => `<b>${esc(u.word)}</b> (${esc(u.why)})`).join('; ')}.</p>` : ''}</section>`;

  const views = [['front', 'Front'], ['three', 'Three-quarter'], ['back', 'Back']];
  const U = C.underlayer;
  // the live view: the page the dashboard's World serves for the minted hero, baked to a string (character-renders.mjs)
  const live = renders.world ? `<figure class="live"><iframe sandbox="allow-scripts" title="${esc(G.name)} hero, live" srcdoc="${esc(renders.world)}"></iframe><figcaption>Live view · drag to orbit · the page's controls play the hero's clips (idle, walk, and the feel set on the motion page)</figcaption></figure>` : '';
  // the turnaround: in colour (the World page's own render, photographed) when the renders carry it, and as wire views
  const colour = views.some(([k]) => renders.color?.[k]) ? `<div class="turn colour">${views.map(([k, name]) => `<figure>${renders.color?.[k] ? `<img alt="${esc(G.name)} hero, ${esc(name)}" src="${esc(renders.color[k])}">` : '<div class="norender">not drawn</div>'}<figcaption>${esc(name)} · colour</figcaption></figure>`).join('')}</div>` : '';
  const wire = `<div class="turn">${views.map(([k, name]) => `<figure>${renders[k] ? plate(`hero-${k}`, renders[k]) : '<div class="norender">not drawn</div>'}<figcaption>${esc(name)}</figcaption></figure>`).join('')}</div>`;
  const base =`<section class="part" id="hero-base"><div class="part-h"><span class="eyebrow">The hero · base ${stamp('hero:base')}</span><h2>Composed, and bare</h2><p class="muted">The elements merged top down: no adornment, paint or gear. It wears only what its world's setting would.</p></div><div class="card">${note('hero:base')}
${live}
${colour}${views.some(([k]) => renders[k]) ? (colour ? `<details class="wire"><summary>The wire views: its construction</summary>${wire}</details>` : wire) : colour ? '' : `<div class="norender"><span class="eyebrow">Not drawn yet</span><p class="muted">The hero door draws it: run the orders below, then draw the front, three-quarter and back views (export-wire-svg.mjs --ref &lt;ref&gt; --views 180,150,0), or render the sheet with --render.</p></div>`}
<h4>The underlayer</h4><p class="read">${esc(U.read)}</p>${U.tones && Object.keys(U.tones).length ? `${swatches(U.tones)}<p class="muted">${Object.entries(U.toneFrom ?? {}).map(([g, f]) => `${esc(g)}: ${esc(f)}`).join(' · ')}</p>` : ''}
${dl([['outfit', json(U.build)], ['pinned base', hero.looks?.base ? json(hero.looks.base) : 'not pinned: mint the orders, settle a revision, and pin it (hero-base.js)']])}
${machine('hero:base')}
<details><summary>The orders that realize it</summary><pre>${esc(JSON.stringify(orders, null, 2))}</pre></details></div></section>`;

  const MO = B.motion;
  const bar = (v) => `<span class="bar" title="${v}"><i style="left:${50 + v * 50}%"></i></span>`;
  const motion = `<section class="part" id="hero-motion"><div class="part-h"><span class="eyebrow">The hero · motion ${stamp('hero:motion')}</span><h2>How it moves</h2><p class="muted">Assigned by vibe from the base. A custom edit starts from this baseline and is saved as a revision of the sketch.</p></div><div class="card">${note('hero:motion')}
${MO ? `${dl([['vibe', MO.vibe.length ? list(MO.vibe) : '—'], ['not read', MO.unread.length ? list(MO.unread) : undefined], ['stand', MO.gesture ? esc(MO.gesture) : undefined], ['branched from', MO.from ? `${esc(MO.from.ref)} · rev ${MO.from.rev}` : undefined]])}
<h4>The axes</h4><div class="axes">${Object.entries(MO.axes).map(([k, v]) => `<div class="axis"><b>${esc(k)}</b>${bar(v)}<span class="muted">${v}</span></div>`).join('')}</div>
${MO.reasons.length ? `<ul class="principles">${MO.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
<h4>The gaits it sets</h4>${MO.motion ? `<table class="powers"><tr><th>gait</th><th>dials that moved</th></tr>${Object.entries(MO.motion).map(([g, d]) => `<tr><td><b>${esc(g)}</b></td><td>${Object.entries(d).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}</td></tr>`).join('')}</table>` : '<p class="muted">No dial moves: the gaits stand as they are.</p>'}
${MO.clips ? `<h4>Custom clips</h4><p class="muted">${list(Object.keys(MO.clips))}</p>` : ''}`
    : '<p class="muted">Not laid out yet. Say how it should feel: a few words (cocky, heavy, floaty, graceful) or the axes themselves.</p>'}${machine('hero:motion')}
<details><summary>The words and axes it understands</summary><dl class="vocab">${Object.entries(AXES).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}<dt>vibes</dt><dd>${list(Object.keys(VIBES))}</dd></dl></details></div></section>`;

  const S = R.system;
  const actions = `<section class="part" id="hero-actions"><div class="part-h"><span class="eyebrow">The hero · actions ${stamp('hero:actions')}</span><h2>What it can do</h2><p class="muted">Beyond platforming. What the hero can do decides the world's core systems; can is not the beginning.</p></div><div class="card">${note('hero:actions')}
${R.idiom ? `<p class="read">Idiom <b>${esc(R.idiom)}</b>.</p>` : ''}
${S ? dl([['system', `<b>${esc(S.kind)}</b>: ${esc(SYSTEM_KINDS[S.kind])}`], ['resource', S.resource ? esc(S.resource) : undefined], ['source', S.source ? esc(S.source) : undefined], ['rule', S.rule ? esc(S.rule) : undefined]]) : '<p class="muted">No power system yet.</p>'}
<h4>The power set</h4>${R.powers.length ? `<table class="powers"><tr><th>power</th><th>does</th><th>element</th><th>drawn as</th></tr>${R.powers.map((p) => `<tr><td><b>${esc(p.id)}</b></td><td>${esc(p.verb)}</td><td>${p.element ? esc(p.element) : '—'}</td><td>${p.look ? `look ${esc(p.look)}` : ''}${p.attack ? `${p.look ? ' · ' : ''}attack ${esc(p.attack)}` : ''}${!p.look && !p.attack ? '<span class="muted">held as words</span>' : ''}</td></tr>`).join('')}</table>` : '<p class="muted">No powers yet.</p>'}
<h4>The escalation</h4>${R.progression.length ? `<div class="stages">${R.progression.map((s) => `<div class="stage"><span class="eyebrow">${esc(s.stage)}</span><p>${s.gains.length ? list(s.gains) : '<span class="muted">no new power</span>'}</p>${s.gate ? `<p class="muted">${esc(s.gate)}</p>` : ''}</div>`).join('')}</div>` : '<p class="muted">Not laid out.</p>'}
${R.open.length ? `<h4>Still open</h4><ul class="principles">${R.open.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}${machine('hero:actions')}
<details><summary>The mechanics seed (data only, nothing numbered)</summary><pre>${esc(JSON.stringify(R.mechanicsSeed, null, 2))}</pre></details></div></section>`;

  // adornment: the page as the creator wrote it, or what the loop proposes while none is adopted
  const AD = B.adornment, proposal = AD ? null : suggestKit(R, D);
  const dialsAt = (it, s) => { const d = buildAt(it, s).dials || {}; return `${s} · ornament ${d.ornament ?? 0}, mass ${d.mass ?? 1}`; };
  const itemRows = (items) => `<table class="powers"><tr><th>item</th><th>hand</th><th>serves</th><th>by stage</th><th>alternate uses</th></tr>${items.map((it) => `<tr><td><b>${esc(it.id)}</b><br><span class="muted">${esc(it.build.item)}${it.build.gem ? ` · ${esc(it.build.gem)}` : ''}</span></td><td>${esc(it.slot)}</td><td>${list(it.serves)}</td><td>${STAGES.map((s) => esc(dialsAt(it, s))).join('<br>')}</td><td>${it.alt?.length ? it.alt.map((a) => `<b>${esc(a.id)}</b> ${esc(a.use)}${a.serves ? ` (serves ${list(a.serves)})` : ''}`).join('<br>') : '<span class="muted">none</span>'}</td></tr>`).join('')}</table>`;
  const adornment = `<section class="part" id="hero-adornment"><div class="part-h"><span class="eyebrow">The hero · adornment ${stamp('hero:adornment')}</span><h2>What it carries</h2><p class="muted">Equipment from the main loop's final design: an item exists because a power needs it, grows with the stage that unlocks it, and may serve another power as an alternate use. Each item is the template of its class in the equipment table.</p></div><div class="card">${note('hero:adornment')}
${AD ? `${AD.bodily.length ? dl([['the body carries', list(AD.bodily)]]) : ''}${AD.items.length ? itemRows(AD.items) : '<p class="muted">No item: the body carries the whole loop.</p>'}
${AD.open.length ? `<h4>Still open</h4><ul class="principles">${AD.open.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}`
    : `<p class="read">Nothing is laid out yet. Proposed from the loop (not adopted):</p>${proposal.adornment.bodily?.length ? dl([['the body carries', list(proposal.adornment.bodily)]]) : ''}${proposal.adornment.items.length ? itemRows(proposal.adornment.items) : '<p class="muted">No item is called for.</p>'}
<ul class="principles">${proposal.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>${proposal.unread.length ? `<p class="muted">Not read: ${proposal.unread.map((u) => `<b>${esc(u.id)}</b> (${esc(u.verb)})`).join(', ')}.</p>` : ''}`}
${machine('hero:adornment')}</div></section>`;

  // the equipment table: a row per class of gear, seeded by the adornment or the world's own, the rest the creator's
  const E = B.equipment, EO = equipmentOrders(G, ready.equipment);
  const statusOf = { authored: 'the world\'s own', seeded: 'from the hero', empty: 'to fill' };
  const buildCell = (r) => (r.build ? `${esc(r.build.item)}${r.build.style ? ` · ${esc(typeof r.build.style === 'string' ? r.build.style : 'own style')}` : ''}${r.build.gem ? ` · ${esc(r.build.gem)}` : ''}<br><span class="muted">${esc(r.slot)} hand</span>` : '<span class="muted">—</span>');
  // once the systems stand, each tier's gives are the stats' own (the tree's or the offers' `<class>-<stage>`)
  const tierGives = (cls, st) => { const x = [...(B.mechanics?.play.stats.tree ?? []), ...(B.mechanics?.play.stats.offers ?? [])].find((y) => y.id === `${cls}-${st}`); return x?.gives?.raise ? ` · ${Object.entries(x.gives.raise).map(([k, v]) => `${k} +${v}`).join(', ')}` : ''; };
  const tierCell = (r) => (r.build ? STAGES.map((st) => esc(dialsAt(r, st) + tierGives(r.class, st))).join('<br>') : '<span class="muted">—</span>');
  const equipment = `<section class="part" id="equipment"><div class="part-h"><span class="eyebrow">Equipment ${stamp('equipment')}</span><h2>What can be equipped</h2><p class="muted">The world's gear, one row per class. What the hero's adornment conceived is the template of its class; the empty rows are yours to fill. Gear is made once the stats are settled: what each tier raises is theirs.</p></div><div class="card">${note('equipment')}
<table class="powers"><tr><th>class</th><th>status</th><th>template</th><th>by stage</th><th>from</th></tr>${E.rows.map((r) => `<tr><td><b>${esc(r.class)}</b></td><td class="${r.status === 'empty' ? 'muted' : ''}">${esc(statusOf[r.status])}</td><td>${buildCell(r)}</td><td>${tierCell(r)}</td><td>${r.from ? `${esc(r.from)}${r.also ? `<br><span class="muted">also ${list(r.also)}</span>` : ''}` : '<span class="muted">—</span>'}</td></tr>`).join('')}</table>
${E.tasks.length ? `<h4>To fill</h4><p class="muted">${list(E.tasks)}: write each as <code>equipment.classes.&lt;class&gt; = { build, slot?, tiers? }</code>, or <code>null</code> to leave it empty on purpose.</p>` : ''}
${E.ledger.length ? `<h4>Where it departs</h4><ul class="ledger">${E.ledger.map((o) => `<li><b>${esc(o.key)}</b> ${esc(o.local)} <span>over ${esc(o.world)}</span></li>`).join('')}</ul>` : ''}
${machine('equipment')}
<p class="muted">${EO.mints.length ? `Ready: ${EO.mints.length} mint${EO.mints.length === 1 ? '' : 's'} below.` : `Not made yet: waiting on ${EO.waiting.map((w) => `${esc(w.id)} (${esc(w.status)})`).join(', ')}.`}</p>
${EO.mints.length ? `<details><summary>The orders that make them</summary><pre>${esc(JSON.stringify(EO.mints, null, 2))}</pre></details>` : ''}</div></section>`;

  // the systems: the stats the loop calls for, with their reasons, the epochs and the tree by stage, the HUD
  const MC = B.mechanics, MS = MC?.play.stats;
  const gainsOf = (g) => [...Object.entries(g?.raise ?? {}).map(([k, v]) => `${k} +${v}`), ...Object.entries(g?.grant ?? {}).map(([k, v]) => `${k} +${v}`)].join(', ');
  const costOf = (c) => (c && Object.keys(c).length ? Object.entries(c).map(([k, v]) => `${v} ${k}`).join(', ') : 'free');
  const reqOf = (r) => (!r ? '' : r.has ? `after ${r.has}` : r.epoch ? `at ${r.epoch}` : r.all ? r.all.map(reqOf).join(', ') : r.level ? `level ${r.level}` : '');
  const stageCols = (MS?.epochs ?? []).map((e) => `<div class="stage"><span class="eyebrow">${esc(e.id)}${e.level ? ` · level ${e.level}` : ''}</span>${(MS.tree ?? []).filter((n) => n.epoch === e.id).map((n) => `<p><b>${esc(n.id)}</b> <span class="muted">${esc(costOf(n.cost))}${n.requires ? ` · ${esc(reqOf(n.requires))}` : ''}${n.gives ? ` · ${esc(gainsOf(n.gives))}` : ''}</span></p>`).join('') || '<p class="muted">nothing new</p>'}</div>`).join('');
  const MO2 = MC ? mechanicsOrders(G, MC) : null;
  const systemsPage = `<section class="part" id="mechanics-stats"><div class="part-h"><span class="eyebrow">Systems · stats ${stamp('mechanics:stats')}</span><h2>The numbers</h2><p class="muted">The actions numbered: each stage an epoch, each power a node of the tree in its stage, the system's resource what the powers spend. Every number below is derived, with its reason, unless the world wrote its own.</p></div><div class="card">${note('mechanics:stats')}
${MC ? `<table class="powers"><tr><th>stat</th><th>starts</th></tr>${MS.stats.map((x) => `<tr><td><b>${esc(x.id)}</b></td><td>${x.base ?? 'derived'}</td></tr>`).join('')}${(MS.resources ?? []).map((x) => `<tr><td><b>${esc(x.id)}</b> <span class="muted">resource</span></td><td>${x.start}${x.cap ? ` of ${x.cap}` : ''}</td></tr>`).join('')}</table>
<h4>The escalation, numbered</h4><div class="stages">${stageCols}</div>
${MS.offers?.length ? `<h4>Offers</h4><p class="muted">${MS.offers.map((o) => `<b>${esc(o.id)}</b> ${esc(costOf(o.cost))}: ${esc(gainsOf(o.gives))}`).join(' · ')}</p>` : ''}
<h4>How each power is used</h4><table class="powers"><tr><th>key</th><th>power</th><th>spends</th><th>shows</th><th>lands</th></tr>${MC.powers.map((p) => `<tr><td>${p.key ? `<b>${esc(p.key)}</b>` : '<span class="muted">—</span>'}</td><td><b>${esc(p.id)}</b></td><td>${p.spends ? esc(costOf(p.spends)) : '<span class="muted">—</span>'}</td><td>${p.look ? `look ${esc(p.look)}` : '<span class="muted">—</span>'}</td><td>${p.hurt ? `${esc(p.hurt.stat)} × ${p.hurt.per}` : '<span class="muted">—</span>'}</td></tr>`).join('')}</table>
${MC.limits.length ? `<p class="muted">Not yet: ${MC.limits.map(esc).join('; ')}.</p>` : ''}
<ul class="principles">${MC.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
${MC.ledger.length ? `<h4>Where it departs</h4><ul class="ledger">${MC.ledger.map((o) => `<li><b>${esc(o.at)}</b> ${json(o.local)} <span>over ${json(o.world)}</span></li>`).join('')}</ul>` : ''}
${MC.open.length ? `<h4>Still open</h4><ul class="principles">${MC.open.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}`
    : '<p class="muted">Not laid out yet. Write <code>mechanics: {}</code> and the loop\'s numbers are derived from the actions; any of them can be your own.</p>'}
${machine('mechanics:stats')}${MO2 ? `<details><summary>The orders that make it playable</summary><pre>${esc(JSON.stringify({ ...MO2, args: { ...MO2.args, manifest: { ...MO2.args.manifest, faces: `[${MO2.args.manifest.faces.length} faces]` } } }, null, 2))}</pre></details>` : ''}</div></section>
<section class="part" id="mechanics-hud"><div class="part-h"><span class="eyebrow">Systems · HUD ${stamp('mechanics:hud')}</span><h2>What it shows</h2><p class="muted">The readouts the systems call for; how they look is the UI direction's (${esc(MC ? (typeof MC.play.ui === 'string' ? MC.play.ui : 'stored') : 'propose')}), styled and gated when the world is minted.</p></div><div class="card">${note('mechanics:hud')}
${MC?.play.parts?.length ? `<table class="powers"><tr><th>part</th><th>shows</th><th>where</th></tr>${MC.play.parts.map((p) => `<tr><td><b>${esc(p.label ?? p.id ?? p.part)}</b> <span class="muted">${esc(p.part)} · ${esc(p.variant ?? '')}</span></td><td>${esc(p.bind?.var ?? (p.bind?.from ? `${p.bind.from}.${p.bind.field}` : p.bind?.on ?? '—'))}</td><td>${esc(typeof p.at === 'string' ? p.at : '—')}</td></tr>`).join('')}</table>
${MC.play.cues?.some((c) => c.then?.as === 'banner') ? `<p class="muted">Banners: ${MC.play.cues.filter((c) => c.then?.as === 'banner').map((c) => esc(c.then.say)).join(' · ')}.</p>` : ''}${MC.play.menus?.length ? `<p class="muted">A status page (${esc(MC.inputs.find((x) => x.emit.type === 'status')?.key.toUpperCase() ?? '—')}): ${list(MC.play.menus[0].rows.map((r) => r.label))}.</p>` : ''}<p class="muted">The legend: ${esc(MC.legend)}</p>` : '<p class="muted">Nothing on the HUD.</p>'}
${machine('mechanics:hud')}</div></section>`;

  const step = (name, what, r) => `<article class="card open"><div class="card-h"><span class="eyebrow">Next · ${r.ready ? 'may start' : 'waiting'}</span><h3>${esc(name)}</h3></div><p class="muted">${esc(what)}</p><div class="ready"><b class="${r.ready ? 'yes' : 'no'}">${r.ready ? 'ready' : 'waiting on'}</b>${r.waiting.map((w) => `<span>${stampOf(w.id) ? `<a href="${anchor(w.id)}">${esc(w.id)}</a>` : esc(w.id)} · ${esc(w.status)}</span>`).join('')}</div></article>`;
  const open = `<section class="part" id="open"><div class="part-h"><span class="eyebrow">Open</span><h2>Beyond the hero</h2></div><div class="cards">
${step('Adornment', 'Equipment shaped to the main loop\'s final design, scaled up and down, with alternate uses.', ready.adornment)}
${step('Systems', 'The game\'s systems: the numbers and the UI, over the actions\' mechanics seed.', ready.systems)}
${step('Equipment', 'The gear classes made, once the stats exist to give them a reason to be equipped.', ready.equipment)}
<article class="card open"><div class="card-h"><span class="eyebrow">Open</span><h3>Cast</h3></div><p class="muted">The other characters and the people of its civilizations are left open for now.</p></article></div></section>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(G.name)} · Character bible</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&display=swap">
<style>${CSS}${EXTRA_CSS}</style></head><body><div class="wrap">
<div class="mast"><div class="t">Character bible</div><div class="eyebrow">${esc(G.id)} · seed ${G.seed}</div></div>
<nav class="tabs" aria-label="Sections"><a href="#cover">Hero</a><a href="#gate">Gate</a><a href="#characters-direction">Direction</a><a href="#hero-looks">Looks</a><a href="#hero-base">Base</a><a href="#hero-motion">Motion</a><a href="#hero-actions">Actions</a><a href="#hero-adornment">Adornment</a><a href="#equipment">Equipment</a><a href="#mechanics-stats">Systems</a><a href="#open">Open</a></nav>
<section class="part" id="cover"><div class="cover"><div><h1>${esc(G.name)}</h1><p class="lede">${esc(D.tradition)} · ${esc(D.from === 'world' ? G.style.kit : 'its own direction')}${D.primary ? ` · ${esc(D.primary)}${D.secondary ? ` and ${esc(D.secondary)}` : ''}` : ''}</p></div></div>
${gate}</section>
${direction}
${looks}
${base}
${motion}
${actions}
${adornment}
${equipment}
${systemsPage}
${open}
<footer><span class="eyebrow">Every page read from its recipe</span><span class="eyebrow">Character book</span></footer>
</div></body></html>`;
}
