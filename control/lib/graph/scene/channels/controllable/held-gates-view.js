// In-page script: a metroidvania's HELD GATES seen (worlds/controllable/held-gates.js): what the hero picks up said as
// it is taken, a band across the top of the screen with its name, held a moment and gone (and a save room's "Saved", a
// waking after death); what the hero holds listed small under it; her health and MP as bars at the top left, under the page's own
// buttons (the page's health panel hidden: one set of vitals); a boss that is a body of the world (`entity`) its name and
// its health as a long bar across the bottom while she stands in its room and it stands, its room's way out barred while
// she fights it (a portcullis dropping across each doorway, an iron grate over each hole). The gates themselves are breakables: the page's break pass hides each as it opens.
// Emitted only into a page whose world has held gates, so every other page keeps every byte.

export const HELD_TOAST = Object.freeze({ hold: 2.4, fade: 0.5 });
/** a boss room's bars: their drop (s), their iron and rust, the grate's pitch (and a portcullis rail's) and a bar's thickness */
export const BOSS_BARS = Object.freeze({ drop: 0.28, iron: 0x2b2a2e, rust: 0x5a4636, pitch: 0.42, bar: 0.11 });

export function heldGatesScript() {
  return `
// HELD GATES (held-gates-view.js): what the hero picks up, said as it is taken
const __HG = ${JSON.stringify(HELD_TOAST)}, __HGB = ${JSON.stringify(BOSS_BARS)};
const __hgEl = document.createElement('div');
__hgEl.style.cssText = 'position:fixed;left:50%;top:9%;transform:translateX(-50%);padding:10px 28px;background:rgba(10,8,14,.82);color:#f3e6c4;font:600 20px/1.2 Georgia,serif;letter-spacing:.06em;border-top:1px solid #c9a75a;border-bottom:1px solid #c9a75a;pointer-events:none;opacity:0;transition:opacity .2s;z-index:30;text-align:center';
const __hgHeld = document.createElement('div');
__hgHeld.style.cssText = 'position:fixed;left:16px;bottom:14px;color:#cfc6b0;font:12px/1.4 Georgia,serif;pointer-events:none;z-index:30;text-shadow:0 1px 2px #000';
document.body.appendChild(__hgEl); document.body.appendChild(__hgHeld);
// (her VITALS, an action RPG's: health and MP as bars at the top left, read off her body and her moveset's pool; no lives)
const __hgV = document.createElement('div');
__hgV.style.cssText = 'position:fixed;left:16px;top:62px;width:220px;pointer-events:none;z-index:30;font:600 11px/1 Georgia,serif;color:#e8dcc0;letter-spacing:.08em;text-shadow:0 1px 2px #000';
__hgV.innerHTML = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px"><span style="width:22px">HP</span><div style="flex:1;height:9px;background:#2a1418;border:1px solid #6b3a2e"><div data-hp style="height:100%;width:100%;background:linear-gradient(#e0565a,#9c1e2c)"></div></div></div>'
  + '<div style="display:flex;align-items:center;gap:6px"><span style="width:22px">MP</span><div style="flex:1;height:7px;background:#141a2a;border:1px solid #34406b"><div data-mp style="height:100%;width:100%;background:linear-gradient(#6f9cf0,#2a4ea8)"></div></div></div>';
document.body.appendChild(__hgV);
const __hgHp = __hgV.querySelector('[data-hp]'), __hgMp = __hgV.querySelector('[data-mp]');
// (a BOSS's bar: its name over a long bar across the bottom, while she is in its room and it stands)
const __hgB = document.createElement('div');
__hgB.style.cssText = 'position:fixed;left:50%;bottom:58px;width:min(560px,70vw);transform:translateX(-50%);pointer-events:none;z-index:30;display:none;font:600 13px/1 Georgia,serif;color:#f3e6c4;letter-spacing:.1em;text-align:center;text-shadow:0 1px 2px #000';
__hgB.innerHTML = '<div data-name style="margin-bottom:6px"></div><div style="height:10px;background:#1a0c10;border:1px solid #c9a75a"><div data-bhp style="height:100%;width:100%;background:linear-gradient(#c8454a,#6e1420)"></div></div>';
document.body.appendChild(__hgB);
const __hgBName = __hgB.querySelector('[data-name]'), __hgBHp = __hgB.querySelector('[data-bhp]'), __hgBMax = {};
let __hgSeen = 0, __hgAt = -1;
// (a boss room's BARS: an iron portcullis across each doorway (bars upright, a rail across), a grate over each hole (bars
// along the lane), built once hidden; dropped in as the room shuts, gone as it opens)
const __hgBars = [];
{
  const M = (c) => new THREE.MeshBasicMaterial({ color: c });
  for (const B of ((__world.heldGates && __world.heldGates.spec.bosses) || [])) for (const b of B.shut || []) {
    const g = new THREE.Group(), w = b.max[1] - b.min[1], h = b.max[2] - b.min[2], x = 0.9;
    if (b.is === 'bar') {
      // (seen from the side a doorway's bar is a narrow upright: iron the doorway's height, rust rails across it, spikes under)
      { const m = new THREE.Mesh(new THREE.BoxGeometry(2 * x, w, h), M(__HGB.iron)); g.add(m); }
      for (let zz = -h / 2 + __HGB.pitch; zz < h / 2; zz += __HGB.pitch * 2) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, w + 0.06, __HGB.bar * 0.7), M(__HGB.rust)); m.position.set(x + 0.02, 0, zz); g.add(m); }
    } else {
      for (let y = -w / 2 + __HGB.pitch / 2; y < w / 2; y += __HGB.pitch) { const m = new THREE.Mesh(new THREE.BoxGeometry(2 * x, __HGB.bar, __HGB.bar), M(__HGB.iron)); m.position.set(0, y, h / 2 - __HGB.bar); g.add(m); }
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, w, __HGB.bar), M(__HGB.rust)); m.position.set(x, 0, h / 2 - __HGB.bar); g.add(m);
    }
    g.position.set(0, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    g.traverse((o) => { o.raycast = function () {}; });
    g.visible = false; scene.add(g);
    __hgBars.push({ id: B.id, g, h, z: g.position.z, is: b.is });
  }
}
let __hgFight = null, __hgFightAt = 0;
function __hgFrame() {
  const G = __world.heldGates;
  if (!G) return;
  // (one set of vitals: the page's own health panel, drawn and shown for any body with an hpMax, gives way to the castle's)
  if (typeof __hp !== 'undefined' && __hp && __hp.wrap && __hp.wrap.style.display !== 'none') __hp.wrap.style.display = 'none';
  // (a game with a look draws these on mana-ui, gameworld/metroidvania/hud.js: this page's own band and bars give way)
  // (its vitals and its toasts only: the boss's bar across the bottom and the room's bars stay this page's)
  const __mana = !!(window.__mojHud && window.__mojHud.state && window.__mojHud.state.bx);
  if (__mana && __hgV.parentNode) { __hgEl.remove(); __hgHeld.remove(); __hgV.remove(); }
  const T = __world.byId[G.spec.target || 'hero'];
  if (T && !__mana) {
    const hp = T.body && Number.isFinite(T.body.hp) && T.hpMax ? Math.max(0, T.body.hp / T.hpMax) : 1, M = T.rule && T.rule.moveset && T.rule.moveset.mp;
    __hgHp.style.width = (hp * 100).toFixed(1) + '%';
    __hgMp.style.width = (M ? Math.max(0, (T.mp == null ? M.max : T.mp) / M.max) * 100 : 0).toFixed(1) + '%';
  }
  // (its room's bars: dropped in as the fight begins, gone as it ends)
  if (G.fight !== __hgFight) { __hgFight = G.fight; __hgFightAt = __world.time; }
  for (const R of __hgBars) {
    const on = R.id === G.fight, a = on ? Math.min(1, (__world.time - __hgFightAt) / __HGB.drop) : 1;
    R.g.visible = on;
    if (on) R.g.position.z = R.is === 'bar' ? R.z + (1 - a) * R.h : R.z;
  }
  // (the boss whose room she stands in, standing)
  let __b = null;
  if (T) for (const B of G.spec.bosses || []) {
    const e = B.entity && __world.byId[B.entity], q = B.room, p = T.transform.pos;
    if (!e || !q) continue;
    if (__hgBMax[B.id] == null && Number.isFinite(e.body.hp)) __hgBMax[B.id] = e.body.hp;
    if (!e.downed && !e.gone && G.felled[B.id] == null && p[1] >= q[0] && p[1] <= q[1] && p[2] >= q[2] && p[2] <= q[3]) { __b = { B, e }; break; }
  }
  __hgB.style.display = __b ? 'block' : 'none';
  // (a boss of more than one form: the bar its form's, its full health and its name the mode's own)
  if (__b) { const Md = __b.e.body.modes && __b.e.body.modes[__b.e.modeIdx || 0], mx = Md && Md.hp ? Md.hp : (__hgBMax[__b.B.id] || 1);
    __hgBName.textContent = (Md && Md.title) || __b.B.title || __b.B.id; __hgBHp.style.width = (Math.max(0, __b.e.body.hp / mx) * 100).toFixed(1) + '%'; }
  if (__mana) return;
  if (G.got.length > __hgSeen) {
    const g = G.got[G.got.length - 1]; __hgSeen = G.got.length; __hgAt = __world.time;
    __hgEl.textContent = g.name;
    __hgHeld.textContent = G.got.filter((x) => !x.kind).map((x) => x.name).join(' · ');
  }
  const age = __world.time - __hgAt;
  __hgEl.style.opacity = __hgAt < 0 || age > __HG.hold + __HG.fade ? '0' : age > __HG.hold ? String(1 - (age - __HG.hold) / __HG.fade) : '1';
}
const __hgStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __hgStep0(dt, inputOverride); __hgFrame(); };
`;
}
