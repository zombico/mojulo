/**
 * THE BATTLES PAGE — the book's reading of a world's party battles (battles.js), as the run lays them: the party and
 * each one's class, the road (each stage the packs it meets, the boss at the end), each foe as it stands on the map and
 * fights, the shops and the inn on the way, and the hub with the town's people who keep its shop and its inn.
 *
 *   battlesPage(G, { esc, stamp? })  → { section, tab } | null   (null: a world with no party battles, or fought on boards)
 *
 * The packs are read off the world's stages in the order the run walks them (the start first, then the rest; a level's
 * trail and climb stages, never a building, a room, a city or a track); a stage stands as many of its packs as its trail
 * has beats for, so a short trail may stand fewer than the page shows. Pure: the same world, the same page.
 */
import { resolveLevel } from './world.js';
import { layLevel } from '../level/index.js';
import { PACKS, HUB_WARES, laidBattles, battleParty, battlePlan, foeLookOf, foeKindsOf, isPeopleLook, shopsOn, waresFor, innOf, tierOf } from './battles.js';
import { beastLook } from './stage-figures.js';
import { CLASS_PRESETS, FOE_PRESETS, ITEM_PRESETS, GEAR_PRESETS } from '../playscape/rpg/presets.js';

// the stages the run walks, in its order, as much of each as the plan reads (levels.js gameStages, less the manifests)
function bookStages(G) {
  const order = [G.start, ...G.ids.filter((id) => id !== G.start)], out = [];
  for (const level of order) {
    const R = resolveLevel(G, level);
    const one = R.building ? 'building' : R.geotown ? 'geotown' : R.city ? 'city' : R.roadway ? 'roadway' : R.runner ? 'runner' : R.obstacles ? 'obstacle course' : R.airspace ? 'airspace' : null;
    if (one) { out.push({ level, node: one, section: one }); continue; }
    for (const s of layLevel(R.level).stages) out.push({ level, node: s.node, section: s.section });
  }
  return out;
}

// how a foe stands, in the words of the door that makes it
function lookWords(look) {
  if (beastLook(look)) return `a beast: ${look.species}${look.ooze ? `, grown by the ${look.ooze} ooze` : ''}${look.stylism ? ` (${look.stylism})` : ''}`;
  if (isPeopleLook(look)) return `a people: ${look.people}${look.facets ? `, ${Object.entries(look.facets).map(([k, v]) => `${k} ${v}`).join(', ')}` : ''}${look.dress ? `, dressed ${typeof look.dress === 'string' ? look.dress : 'its own'}` : ''}`;
  return 'a person, through the hero door';
}
const priceOf = (id) => ITEM_PRESETS[id]?.price ?? GEAR_PRESETS[id]?.price ?? null;
const nameOf = (id) => ITEM_PRESETS[id]?.name ?? GEAR_PRESETS[id]?.name ?? id;

export function battlesPage(G0, { esc, stamp = () => '' }) {
  // (a world whose intent fights turn by turn is laid with them, written or not: the run's own reading)
  const G = laidBattles(G0);
  if (!G.battles || G.battles.on === 'board') return null;
  const B = G.battles, stages = bookStages(G), plan = battlePlan(G, stages), name = (id) => resolveLevel(G, id).name;
  // the party
  const party = battleParty(G).map((m) => `<li><b>${esc(m.name)}</b> · ${esc(CLASS_PRESETS[m.class]?.name ?? m.class)}${m.joins ? ` <span class="muted">joins on ${esc(m.joins)}</span>` : ''}${m.auto ? ` <span class="muted">a familiar, beside ${esc(m.auto.keeper)}</span>` : ''}</li>`).join('');
  // the road: each fought stage its packs, numbered across the game
  let n = 0;
  const last = Object.keys(plan).map(Number).at(-1);
  const road = Object.entries(plan).map(([i, packs]) => {
    const s = stages[i], rows = packs.map((p, j) => `<li><i>${++n}</i> ${esc(p.join(', '))}${B.boss && +i === last && j === packs.length - 1 ? ' <b>the boss: no escape</b>' : ''}</li>`).join('');
    return `<li><a href="#level-${esc(s.level)}">${esc(name(s.level))}</a> · ${esc(s.node)}<ol class="packs">${rows}</ol></li>`;
  }).join('');
  // the foes, each as it stands and as it fights
  const foes = foeKindsOf(G, plan).map((k) => {
    const F = (B.foes && typeof B.foes === 'object' && !Array.isArray(B.foes) ? B.foes[k] : null) ?? FOE_PRESETS[k] ?? {}, look = foeLookOf(G, k), own = B.looks?.[k] !== undefined || B.foe !== undefined;
    const stats = ['hp', 'atk', 'def', 'mag', 'spd'].filter((x) => F[x] !== undefined).map((x) => `${x} ${F[x]}`).join(' · ');
    const weak = F.weak?.length ? ` · weak to ${F.weak.join(', ')}` : '';
    return `<dt>${esc(F.name ?? k)}</dt><dd>${esc(lookWords(look))}${own ? ' <b class="own-mark">the book\'s</b>' : ''}<br><span class="muted">${esc(stats)}${esc(weak)}${F.xp !== undefined ? esc(` · ${F.xp} xp, ${F.gold ?? 0} gold`) : ''}</span></dd>`;
  }).join('');
  // the shops: the hub's market, else one beside each fighting stage's start, by how far on
  const shops = shopsOn(G);
  const wareList = (list) => list.map((w) => `${esc(nameOf(w))}${priceOf(w) != null ? ` <span class="muted">${priceOf(w)}g</span>` : ''}`).join(', ');
  let shopHtml = '<p class="muted">No shops: shops: false.</p>';
  if (shops && G.hub) {
    const inn = innOf(G, 0);
    shopHtml = `<p>In <a href="#level-${esc(G.hub)}">${esc(name(G.hub))}</a>, the hub: the merchant sells ${wareList(waresFor(G, 0, HUB_WARES))}, and buys back at half.</p><p>${inn != null ? `A night at the inn: ${inn} gold, full HP and MP, cured. It is the only rest: the hub has no free one.` : 'No inn.'}</p>`;
  } else if (shops) {
    const tiers = [...new Set(Object.keys(plan).map((i, k) => tierOf(Object.values(plan).slice(0, k).flat().length)))];
    shopHtml = `<p>A merchant and an innkeeper beside each fighting stage's start, selling by how far on (bought back at half):</p><dl class="vocab">${tiers.map((t) => `<dt>tier ${t + 1}</dt><dd>${wareList(B.shops?.wares ?? waresFor(G, t * 2))}${innOf(G, t) != null ? `<br><span class="muted">a night ${innOf(G, t)} gold</span>` : ''}</dd>`).join('')}</dl>`;
  }
  // the hub and its people
  const hubHtml = G.hub ? (() => {
    const R = resolveLevel(G, G.hub), S = R.street, ways = G.links.filter((l) => l.from === G.hub || l.to === G.hub).map((l) => (l.from === G.hub ? l.to : l.from));
    const street = S ? [`${S.houses ?? 'its'} houses along its street`, S.walk?.length ? `the ${S.walk.join(', ')} walked into as part of the town` : null, S.enter ? (Array.isArray(S.enter) ? `the ${S.enter.join(', ')} entered (a household at its door)` : `${S.enter} entered`) : null, S.walls ? 'walled in its builders\' own fortification' : null, S.inside ? 'its rooms in the town\'s own construction' : null].filter(Boolean).join('; ') : 'no street of its own';
    const folk = G.characters?.folk ? `Its people live in it (characters.folk): grown from its houses, each with its talk${shops ? '; its merchant and its innkeeper are two of them, and talking to them opens the shop and the inn' : ''}.` : `No town's people: the merchant and the innkeeper stand by the way in${G.characters ? ' (characters.folk: true grows them)' : ''}.`;
    return `<p><a href="#level-${esc(G.hub)}">${esc(R.name)}</a> is the hub every way leads back to (${esc(ways.map(name).join(', ') || 'no way out yet')}). No fight is laid in it. ${esc(street)}.</p><p>${esc(folk)}</p>`;
  })() : '<p class="muted">No hub: the stages are walked one after another.</p>';
  const section = `<section class="part" id="battles"><div class="part-h"><span class="eyebrow">The battles ${stamp('battles')}</span><h2>The party and its road</h2><p class="muted">Turn by turn, walked up to on the trails; the party, its classes and the bag carried level to level.</p></div>
<div class="cards"><article class="card"><div class="card-h"><span class="eyebrow">The party</span><h3>Who fights</h3></div><ul class="ledger">${party}</ul><p class="muted">A member switches class on P, outside a fight.</p></article>
<article class="card"><div class="card-h"><span class="eyebrow">The hub</span><h3>Coming back</h3></div>${hubHtml}</article>
<article class="card wide"><div class="card-h"><span class="eyebrow">The road</span><h3>Every pack, in the order met</h3><p class="muted">${B.packs ? 'The book\'s packs' : `The default packs (${esc(PACKS.slice(0, 2).map((p) => p.join(', ')).join('; '))} …)`}, ${B.per ?? 2} a stage on its beats, as many as its trail has room for.</p></div><ol class="road">${road || '<li class="muted">No stage to fight on.</li>'}</ol></article>
<article class="card"><div class="card-h"><span class="eyebrow">The foes</span><h3>As they stand and fight</h3></div><dl class="vocab">${foes}</dl></article>
<article class="card"><div class="card-h"><span class="eyebrow">The shops</span><h3>Wares and the inn</h3></div>${shopHtml}</article></div></section>`;
  return { section, tab: '<a href="#battles">Battles</a>', css: '.road{margin:0;padding-left:18px;display:grid;gap:8px}.packs{margin:4px 0 0;padding-left:18px;font-size:13.5px}.packs i{font:normal 11px var(--mono);color:var(--muted);margin-right:6px}' };
}

