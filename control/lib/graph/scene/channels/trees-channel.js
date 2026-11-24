/**
 * The TREES channel: the hero's skill tree on how it moves and its tech tree on its spells and attacks as one screen, on
 * mana-ui (worlds/controllable/trees.js keeps them; gameworld/trees/tree.js lays them). T opens it: a tab a tree, each
 * its nodes in tiers by what they require (mana-ui's `tree`: learned, available, locked; a node its power gives shows
 * locked until the power is found, and says so), the one in focus beside it with what it does and what it costs, the
 * points to spend over it; the arrows move its focus, Q and E (or [ and ]) turn its tabs, Enter or J learns the node in
 * focus where the purse and what it requires allow (refused, said), T or Esc shuts it; the world is held while it is
 * open, as a menu holds it. Its look is the theme's, never its own. Emitted only for a page whose world has trees:
 * absent, not one byte.
 */
import { manaUi, manaUiSource } from '../../../mana-ui/kernel.js';
import { manaCss } from '../../../mana-ui/css.js';
import { themeCss } from '../../../mana-ui/theme.js';

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const I = (f) => ({ item: f }), K = (p) => ({ pick: p }), B = (p) => ({ bind: `trees.${p}` });
const txt = (value, role) => ({ use: 'text', props: { value, ...(role ? { role } : {}) } });

/** The spec it draws: mana's skill tree, a tab a tree. */
export function treesSpec() {
  return { screens: { trees: { use: 'screen', props: { title: B('title'), layer: 'modal', place: 'full', legend: 'none' }, children: [
    { use: 'counter', props: { label: { word: 'points' }, value: B('points'), icon: 'skill point' } },
    { use: 'window', children: [{ use: 'tabs', props: { pages: B('pages'), page: { use: 'split', props: { ratio: 'wide' }, children: [
      { use: 'tree', id: 'skills', props: { nodes: I('nodes'), node: { use: 'stack', props: { gap: 'tight' }, children: [txt(I('name')), txt(I('price'), 'caption')] } }, on: { accept: { emit: 'learn', skill: I('id') } } },
      { use: 'stack', props: { gap: 'normal' }, children: [txt(K('skills.name'), 'title'), txt(K('skills.status'), 'label'), txt(K('skills.about')), txt(K('skills.price'), 'caption')] },
    ] } } }] },
    txt(B('said'), 'caption'),
    { use: 'legend', props: { rows: [{ action: 'accept', label: { word: 'learn' } }, { actions: ['tabPrev', 'tabNext'], label: { word: 'tabs' } }, { action: 'back', label: { word: 'back' } }] } },
  ] } } };
}
const TREES_CSS = '.moj-trees{position:absolute;inset:0;pointer-events:none;z-index:8}.moj-trees .mana-root{background:none}.moj-trees.open{z-index:34;pointer-events:auto}';

/** The page's side (inlined by toString): the runtime mounted, the trees read off the world while the screen is open. */
export function treesPage(ui, spec, css) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'moj-trees'; (document.getElementById('wrap') || document.body).appendChild(root);
  const S = { trees: { title: 'Skills and techs', points: 0, pages: [], said: '' } };
  const world = () => (window.__mojCtrl && window.__mojCtrl.world) || null;
  let sig = '';
  function read() {
    const w = world(), T = w && w.trees;
    if (!T) return;
    const all = T.states(), points = T.points();
    const word = { learned: 'learned', available: 'can be learned', locked: 'not yet', found: 'found, not bought' };
    const pages = T.spec.trees.map((t) => ({ label: t.name, nodes: all.filter((n) => n.tree === t.id).map((n) => ({ id: n.id, name: n.name, about: n.about, requires: n.requires,
      // (a node its power gives shows locked until the power is found: it is never bought)
      state: n.state === 'found' ? 'locked' : n.state, status: word[n.state], price: n.state === 'found' ? 'given by a power found' : n.state === 'learned' ? 'learned' : `${n.cost} point${n.cost === 1 ? '' : 's'}` })) }));
    const next = JSON.stringify([pages, points, S.trees.said]);
    if (next === sig) return;
    sig = next; S.trees = { ...S.trees, pages, points };
    paint();
  }
  const rt = ui.runtime(spec, { read: (p) => ui.readPath(S, p), act: (e) => {
    if (!e || e.emit !== 'learn') return;
    const w = world(), r = w && w.trees ? w.trees.learn(e.skill) : { ok: false, why: 'no trees' };
    S.trees = { ...S.trees, said: r.ok ? 'Learned.' : `Not learned: ${r.why}.` }; sig = ''; requestAnimationFrame(read);
  }, now: () => performance.now() / 1000 });
  rt.glyphs({ keys: { accept: 'Enter', tabPrev: 'Q', tabNext: 'E', back: 'T' } }); rt.input('keys');
  // (its paint called on each press and each change of what it reads: an auto mount repaints only as the runtime ticks)
  const M = ui.mount(root, rt, { auto: true }), paint = () => { if (M && M.paint) M.paint(); };
  let open = false;
  function show(on) {
    if (on === open) return;
    if (on && ((window.__mojScenes && window.__mojScenes.on()) || window.__mojMenuOpen || window.__mojManaOpen)) return;   // not over a scene or another menu
    open = on; root.classList.toggle('open', on);
    if (on) { sig = ''; S.trees = { ...S.trees, said: '' }; read(); rt.open('trees'); } else rt.close();
    window.__mojManaOpen = on ? 'trees' : null; window.__mojMenuOpen = on; window.__mojFreeze = on;
  }
  const MOVE = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', BracketRight: 'tabNext', BracketLeft: 'tabPrev', KeyE: 'tabNext', KeyQ: 'tabPrev', Enter: 'accept', KeyJ: 'accept', Space: 'accept' };
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'KeyT' && !ev.repeat) { ev.preventDefault(); show(!open); return; }
    if (!open) return;
    if (ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); show(false); }
    else if (MOVE[ev.code]) { ev.preventDefault(); ev.stopImmediatePropagation(); rt.press(MOVE[ev.code]); paint(); }
  }, true);
  (function tick() { requestAnimationFrame(tick); if (open) read(); })();
  return { state: S, rt, open: () => show(true), close: () => show(false), isOpen: () => open, read: () => { sig = ''; read(); return S.trees; } };
}

/** The page's script ('' for none). `theme`: the look the level's HUD wears. */
export function treesScript(trees, theme = null, { shared = null } = {}) {
  if (!trees || !Array.isArray(trees.nodes)) return '';
  const spec = treesSpec();
  manaUi.readSpec(spec);
  return `
// THE TREES (scene/channels/trees-channel.js): the hero's skills and techs, on T, mana-ui's skill tree; kept by
// worlds/controllable/trees.js
window.__mojTrees = (${treesPage.toString()})(${shared || manaUiSource()}, ${json(spec)}, ${json(shared ? TREES_CSS : `${manaCss()}\n${themeCss(theme ?? 'greybox')}\n${TREES_CSS}`)});
`;
}
