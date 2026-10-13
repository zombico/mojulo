/**
 * THE TECHNOLOGY INDEX, drawn — what a civilization's technology can be, tunnelled from words: every function at
 * three scales (a tool, a machine, an installation), the modifiers that change how a thing looks doing it, from bare
 * to busy, an automation through its cycle, and each thing's tunnel log (the traits read, the passes, what was
 * tweaked); then what the crafter (tech-crafter.js) makes: every form of vehicle, tech-structure and weapon, and the
 * words that change how each looks. Painted in a kit by a finish (era/blocks.js). Pure.
 */
import { tunnelTech, TECH_TRAITS } from './tunnel-tech.js';
import { craftTech, CRAFT_TRAITS, CRAFT_KINDS } from './tech-crafter.js';
import { FUNCTIONS, FINISHES, TIERS, buildBlock, blockPaint } from '../era/blocks.js';
import { drawStructures } from '../era/out-structures-draw.js';
import { CSS } from '../era/out-index-html.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fig = (svg, cap) => `<figure>${svg}<figcaption>${cap}</figcaption></figure>`;

/** A tunnelled thing as a figure: its drawing, its intent, and what the tunnel did. */
export function thingFigure(intent, { paint, seed = 1, w = 200, h = 160, many } = {}) {
  const r = tunnelTech(intent, { seed }), b = many === undefined ? r.built.b : buildBlock(r.plan.block, { seed, many });
  const tweaks = r.passes.flatMap((p) => p.changed ?? []);
  return fig(drawStructures([b.faces], { paint, w, h }), `<b>${esc(intent)}</b><br><span class="note">${esc(r.plan.block.tier)} · ${b.counted} faces · ${esc(r.read.traits.map((t) => t.id).join(', '))}${tweaks.length ? ` · tweaked: ${esc(tweaks.join('; '))}` : ''}${r.complete ? '' : ' · <b>advises</b>'}</span>`);
}

/** A crafted thing as a figure: its drawing, its intent, its form and what the tunnel did. */
export function craftFigure(kind, intent, { paint, seed = 1, w = 200, h = 160 } = {}) {
  const r = craftTech(kind, intent, { seed }), b = r.built.b, tweaks = r.passes.flatMap((p) => p.changed ?? []);
  return fig(drawStructures([b.faces], { paint, w, h }), `<b>${esc(intent)}</b><br><span class="note">${esc(r.plan.variant)} · ${esc(r.plan.block.tier)} · ${b.counted} faces · ${esc(r.plan.block.functions.join(', '))}${r.plan.carries ? ` · carried as the ${esc(r.plan.carries)}` : ''}${tweaks.length ? ` · tweaked: ${esc(tweaks.join('; '))}` : ''}${r.complete ? '' : ' · <b>advises</b>'}</span>`);
}
// each kind: a figure for every form (its variants), and pairs that show what a word changes
const CRAFT_PAIRS = {
  vehicle: [['a hauling wagon', 'a merchant cargo wagon'], ['a tracked crawler', 'an armoured battle tank'], ['a ship', 'a sailing frigate'], ['a car', 'a colossal land-train']],
  structure: [['a tower', 'a lattice radio mast'], ['a lighthouse', 'a radar gun tower'], ['a gate', 'a forcefield gate'], ['a bridge', 'a steel truss bridge']],
  weapon: [['a rifle', 'a laser rifle'], ['a cannon', 'a twin cannon'], ['a turret', 'a sentry gatling turret'], ['a sword', 'an ornate greatsword']],
};
function craftCard(kind, paint, seed) {
  const forms = Object.entries(CRAFT_TRAITS[kind]).filter(([, t]) => t.form && !t.generic);
  return `<div class="card" id="craft-${esc(kind)}"><h3>${esc(kind)}s</h3><p class="note">${esc(CRAFT_KINDS[kind].read)}; judged ${esc(CRAFT_KINDS[kind].judged)}. Forms: ${esc(forms.map(([id, t]) => `${id} (${t.words.slice(0, 3).join(', ')})`).join(' · '))}.</p><div class="views">${forms.map(([id, t]) => craftFigure(kind, `a ${t.words[0]}`, { paint, seed, w: 170, h: 140 })).join('')}</div>
<p class="note">${esc(Object.entries(CRAFT_TRAITS[kind]).filter(([, t]) => !t.form).map(([id, t]) => `${id} (${t.words.slice(0, 3).join(', ')}): ${t.read}`).join(' · '))}</p>${CRAFT_PAIRS[kind].map((p) => `<div class="views">${p.map((i) => craftFigure(kind, i, { paint, seed })).join('')}</div>`).join('')}</div>`;
}

function fnCard(f, paint, seed) {
  const word = Object.values(TECH_TRAITS).find((t) => t.fn === f).words[0];
  const row = [`a small ${word}`, `a ${word}`, `a ${word} station`].map((i) => thingFigure(i, { paint, seed })).join('');
  return `<div class="card" id="fn-${esc(f)}"><h3>${esc(f)}</h3><p class="note">${esc(FUNCTIONS[f].read)}. Reads: ${esc(FUNCTIONS[f].reads.map((r) => r.join(' or ')).join(' + '))}. Words: ${esc(Object.values(TECH_TRAITS).filter((t) => t.fn === f).flatMap((t) => t.words).join(', '))}.</p><div class="views">${row}</div></div>`;
}

/** The technology index as one page. */
export function techIndexHtml({ seed = 1, kitId = 'isekai-meadow', finish = 'alloy' } = {}) {
  const paint = blockPaint(kitId, finish);
  const mods = Object.entries(TECH_TRAITS).filter(([, t]) => !t.fn);
  const pairs = [['a tracked hauler', 'a wheeled hauler'], ['a solar generator', 'a wind generator'], ['a crane', 'a tall heavy crane'], ['a scanner', 'an automated scanner']];
  const many = [0, 0.25, 0.5, 0.75, 1].map((m) => thingFigure('an industrial refinery with storage', { paint, seed, many: m, w: 150, h: 120 }).replace('</b>', ` · many ${m}</b>`)).join('');
  const auto = tunnelTech('an automated fabricator', { seed }), cyc = [0, 60, 120].map((v) => fig(drawStructures([buildBlock(auto.plan.block, { seed, params: { swing: v } }).faces], { paint, view: 'plan', w: 170, h: 140 }), `swing ${v}`)).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Technology Index</title><style>${CSS}svg{max-width:100%;height:auto}</style></head><body><div id="page">
<h1>TECHNOLOGY INDEX</h1>
<p class="lede">A civilization's technology, tunnelled from words: each thing is read into the functions it shows and how it looks doing them, laid out on a body (what it runs on below, what it collects and listens with on top, what comes out in front), assessed by its laws, tweaked and reassessed, and kept as a block. Look and function only: a function is what the eye must find. Drawn in ${esc(kitId)}, finished in ${esc(finish)} (${esc(FINISHES[finish].read)}), at seed ${seed}.</p>
<h2>Functions, at three scales</h2>${Object.keys(FUNCTIONS).filter((f) => Object.values(TECH_TRAITS).some((t) => t.fn === f)).map((f) => fnCard(f, paint, seed)).join('')}
<h2>How it looks doing it</h2><div class="card"><p class="note">${esc(mods.map(([id, t]) => `${id} (${t.words.slice(0, 3).join(', ')}): ${t.read}`).join(' · '))}</p>${pairs.map((p) => `<div class="views">${p.map((i) => thingFigure(i, { paint, seed })).join('')}</div>`).join('')}</div>
<h2>From bare to busy</h2><div class="card"><div class="views many">${many}</div></div>
<h2>An automation's cycle</h2><div class="card"><p class="note">${esc(auto.plan.block.read)}: its arm swept through its cycle, from above.</p><div class="views">${cyc}</div></div>
<h2>What the crafter makes</h2><p class="lede">Beside its machines, a civilization fields vehicles, raises tech-structures and fights with weapons. Each is read into a form, the functions it shows and how it looks doing it, laid out by its kind's grammar, assessed and tweaked like any thing, and kept as a block in its library.</p>${Object.keys(CRAFT_KINDS).map((k) => craftCard(k, paint, seed)).join('')}
<h2>Tiers</h2><div class="card"><table>${Object.entries(TIERS).map(([k, t]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(t.read)}</td><td class="note">judged at ${esc(t.ring)}</td></tr>`).join('')}</table></div>
</div></body></html>`;
}
