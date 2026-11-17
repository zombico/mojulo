/**
 * The BAG channel: what the hero carries as a screen, on mana-ui (gameworld/bag-ui.js lays it off the level's
 * mechanics). I opens the inventory: what is held now by category (tabs), a grid of items each its icon and its count,
 * the one in focus beside it with what it is for, the money over it; the arrows move its focus, [ and ] (or Q and E)
 * turn its tabs, I or Esc shuts it; the world is held while it is open, as a menu holds it. The counts are the bus's
 * own vars (`window.__mojBus`), read while it is open. Its look is the theme's, never its own. Emitted only for a page
 * with a bag screen: absent, not one byte.
 */
import { manaUi, manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const I = (f) => ({ item: f }), K = (p) => ({ pick: p }), B = (p) => ({ bind: `bag.${p}` });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });

/** The spec it draws: mana's inventory, each item by its own icon (an item's `icon`, a name the shelf may not have). */
export function bagSpec(G) {
  return { screens: { bag: { use: 'screen', props: { title: G.title, layer: 'modal', place: 'full', legend: 'none' }, children: [
    ...(G.money ? [{ use: 'counter', props: { label: '', value: B('money'), icon: 'coin' } }] : []),
    { use: 'window', children: [{ use: 'tabs', props: { pages: B('categories'), page: { use: 'split', props: { ratio: 'wide' }, children: [
      { use: 'grid', id: 'bag', props: { cells: I('items'), columns: 4, empty: 'Nothing carried', cell: { use: 'stack', props: { align: 'center', gap: 'tight' }, children: [{ use: 'icon', props: { name: I('icon'), size: 'l' } }, txt(I('name'), 'caption'), { use: 'badge', props: { value: { format: 'x{count}' } } }] } } },
      { use: 'stack', props: { gap: 'normal' }, children: [txt(K('bag.name'), 'title'), txt(K('bag.kind'), 'label'), txt(K('bag.about')), { use: 'stat', props: { label: { word: 'held' }, value: K('bag.count') } }] },
    ] } } }] },
    // (a legend of its own keys: nothing in it is used yet, so no accept is offered)
    { use: 'legend', props: { rows: [{ actions: ['tabPrev', 'tabNext'], label: { word: 'tabs' } }, { action: 'back', label: { word: 'back' } }] } },
  ] } } };
}
const BAG_CSS = '.moj-bag{position:absolute;inset:0;pointer-events:none;z-index:8}.moj-bag .mana-root{background:none}.moj-bag.open{z-index:34;pointer-events:auto}';

/** The page's side (inlined by toString): the runtime mounted, the bag read off the bus while it is open. */
export function bagPage(G, ui, spec, css) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-bag'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { bag: { categories: [], money: 0 } };
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: function () {}, now: () => performance.now() / 1000 });
  // (its legend says the keys that work it)
  rt.glyphs({ keys: { tabPrev: 'Q', tabNext: 'E', back: 'I' } }); rt.input('keys');
  ui.mount(root, rt, { auto: true });
  let open = false, sig = '';
  function read() {
    const vars = window.__mojBus && window.__mojBus.state ? window.__mojBus.state.vars || {} : {};
    const held = G.items.map((it) => ({ id: it.id, name: it.name, icon: it.icon, kind: it.kind, about: it.about, category: it.category, count: Number(vars[it.var]) || 0 })).filter((it) => it.count > 0);
    const cats = [];
    for (const it of held) { let c = cats.find((x) => x.label === it.category); if (!c) cats.push((c = { label: it.category, items: [] })); c.items.push(it); }
    if (!cats.length) cats.push({ label: 'Carried', items: [] });
    // (what is carried first, the money after)
    cats.sort((x, y) => (x.label === 'Money') - (y.label === 'Money'));
    const money = G.money ? Number(vars[G.money]) || 0 : 0, next = JSON.stringify([cats, money]);
    if (next === sig) return;
    sig = next; S.bag = { categories: cats, money };
  }
  function show(on) {
    if (on === open) return;
    if (on && ((window.__mojScenes && window.__mojScenes.on()) || window.__mojMenuOpen || window.__mojManaOpen)) return;   // not over a scene or another menu (`__mojManaOpen`: the mana screen that is up, the journal's, the map's, the bag's)
    open = on; root.classList.toggle('open', on);
    if (on) { sig = ''; read(); rt.open('bag'); } else rt.close();
    window.__mojManaOpen = on ? 'bag' : null; window.__mojMenuOpen = on; window.__mojFreeze = on;
  }
  const MOVE = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', BracketRight: 'tabNext', BracketLeft: 'tabPrev', KeyE: 'tabNext', KeyQ: 'tabPrev' };
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'KeyI' && !ev.repeat) { ev.preventDefault(); show(!open); return; }
    if (!open) return;
    if (ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); show(false); }
    else if (MOVE[ev.code]) { ev.preventDefault(); ev.stopImmediatePropagation(); rt.press(MOVE[ev.code]); }
  }, true);
  (function tick() { requestAnimationFrame(tick); if (open) read(); })();
  return { state: S, rt, open: () => show(true), close: () => show(false), isOpen: () => open, read: () => { sig = ''; read(); return S.bag; } };
}

/** The page's script ('' for none). `theme`: the look the level's HUD wears. */
export function bagScript(G, theme = null, { shared = null } = {}) {
  if (!G || !Array.isArray(G.items)) return '';
  const spec = bagSpec(G);
  manaUi.readSpec(spec);
  return `
// THE BAG (scene/channels/bag-channel.js): what is carried, on I, mana-ui's inventory; laid by gameworld/bag-ui.js
window.__mojBag = (${bagPage.toString()})(${json(G)}, ${shared || manaUiSource()}, ${json(spec)}, ${json(shared ? BAG_CSS : `${manaCss()}\n${themeCss(theme ?? 'greybox')}\n${BAG_CSS}`)});
`;
}
