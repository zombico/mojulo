import { safeJson } from '../../emit-util.js';

// The HANGAR menu block (mobile-suit-hangar.plan.md P2+P3+livery), emitted into the controllable
// runtime ONLY when the manifest carries a `hangar` config — every other world stays byte-identical
// (so no emit-channels char re-pin). The config is a NESTED model: `hangar.suits[i].liveries[j]` names
// a display ENTITY { id, name, color } — one baked body per (suit, livery), all seated at the origin,
// exactly ONE visible. Three menus over it:
//   • SUIT STEPPER (P2): ◀ NAME ▶ (top) + ◀/▶ keys — picks the suit.
//   • LIVERY PICKER: a swatch row (under the stepper) + ▲/▼ keys — picks the recolor; swaps which
//     baked body is visible (a livery is a differently-tinted bake, not a bone toggle). Hidden when a
//     suit has one livery. The active WEAPON carries across a recolor (same suit, new paint).
//   • EQUIP PICKER (P3): the active body's loadout slots (bottom) + number keys — flips loadoutIdx so
//     __applyWeaponShow toggles the weapon_<tag> bone (bazooka poses over-shoulder via its overlay).
// Per-suit selection (suit → livery → weapon) is the P4 launch preset; window.__mojHangar exposes it
// + { step, livery, equip, preset } for P4 + headless capture (driven via input.hangarStep /
// input.liverySet / input.equipSlot in stepControllable). Inline cssText like the other HUD widgets.
export function hangarStepperBlock(hangar) {
  const suits = Array.isArray(hangar.suits) ? hangar.suits : [];
  return `
// ---- hangar menu: suit stepper (P2) + livery picker + equip picker (P3) ----
{
  const __H = ${safeJson(suits)};
  let __sIdx = 0;                       // active suit
  const __lIdx = __H.map(() => 0);      // per-suit active livery (each suit remembers its own)
  const __liv = (s) => (s.liveries && s.liveries.length ? s.liveries : [{ id: s.id, name: s.name }]);
  const __activeId = () => { const s = __H[__sIdx]; return __liv(s)[__lIdx[__sIdx]].id; };
  const __curEnt = () => __world.byId[__activeId()];
  const __eLoadout = (ent) => (ent && ent.rule && Array.isArray(ent.rule.loadout) ? ent.rule.loadout : []);
  // suit stepper bar (top)
  const __sBar = document.createElement('div');
  __sBar.style.cssText = 'position:absolute;left:50%;top:10px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:rgba(4,7,16,.8);border:1px solid #24324a;border-radius:9px;padding:6px 12px;font:600 14px system-ui,sans-serif;color:#e8f4ff;z-index:9;user-select:none';
  const __mkBtn = (t) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'color:#9cc4ff;background:rgba(11,18,32,.6);border:1px solid #24324a;border-radius:6px;padding:3px 13px;cursor:pointer;font:inherit'; return b; };
  const __sPrev = __mkBtn('◀'), __sNext = __mkBtn('▶');
  const __sLbl = document.createElement('span'); __sLbl.style.cssText = 'min-width:154px;text-align:center;letter-spacing:0.07em';
  __sBar.appendChild(__sPrev); __sBar.appendChild(__sLbl); __sBar.appendChild(__sNext);
  wrap.appendChild(__sBar);
  // livery picker row (under the stepper)
  const __lvRow = document.createElement('div');
  __lvRow.style.cssText = 'position:absolute;left:50%;top:52px;transform:translateX(-50%);display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:90%;z-index:9;user-select:none';
  wrap.appendChild(__lvRow);
  const __lvBase = 'border-radius:6px;padding:4px 11px;cursor:pointer;font:600 11px system-ui,sans-serif;letter-spacing:0.03em;background:rgba(11,18,32,.62);border:1px solid #24324a;color:#9cc4ff;display:flex;align-items:center';
  // equip picker row (bottom)
  const __eRow = document.createElement('div');
  __eRow.style.cssText = 'position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:90%;z-index:9;user-select:none';
  wrap.appendChild(__eRow);
  const __eBase = 'border-radius:6px;padding:5px 12px;cursor:pointer;font:600 12px system-ui,sans-serif;letter-spacing:0.03em;background:rgba(11,18,32,.62);border:1px solid #24324a;color:#9cc4ff';
  const __onCss = ';background:#26406a;color:#fff;border-color:#3a5a8c';
  // visibility: hide every suit-livery body, show only the active one. Runs per FRAME
  // (the hangar step hook), not just per pick: the rig bodies are created lazily on the
  // first sync tick — long after this block evals — and the rig sync's respawn re-show
  // would otherwise re-flash hidden suits every frame. userData.hangarHidden is the
  // contract with that re-show (it skips marked bodies); the flag rides the group so a
  // loadout variant swap on the ACTIVE suit stays visible (fresh groups carry no mark).
  const __showActive = () => {
    for (const s of __H) for (const lv of __liv(s)) {
      const b = __bodies[lv.id];
      if (b && lv.id !== __activeId()) { b.userData.hangarHidden = true; b.visible = false; }
    }
    const b = __bodies[__activeId()];
    if (b) { b.userData.hangarHidden = false; b.visible = true; }
  };
  const __eEquip = (i) => { const ent = __curEnt(); if (!ent) return; const lo = __eLoadout(ent); if (i < 0 || i >= lo.length) return; ent.loadoutIdx = i; if (Array.isArray(ent.loadoutWeapons)) ent.weapon = ent.loadoutWeapons[i]; __eBuild(); };
  const __eBuild = () => {
    __eRow.textContent = '';
    const ent = __curEnt(), lo = __eLoadout(ent), cur = ent ? (ent.loadoutIdx || 0) : 0;
    for (let i = 0; i < lo.length; i++) {
      const b = document.createElement('button');
      b.textContent = lo[i].name || ('SLOT ' + (i + 1));
      b.style.cssText = __eBase + (i === cur ? __onCss : '');
      const idx = i; b.onclick = () => __eEquip(idx);
      __eRow.appendChild(b);
    }
  };
  const __liverySet = (i) => {
    const liv = __liv(__H[__sIdx]); if (i < 0 || i >= liv.length || i === __lIdx[__sIdx]) return;
    const prev = __curEnt(), carry = prev ? (prev.loadoutIdx || 0) : 0;   // keep the weapon across a recolor
    __lIdx[__sIdx] = i;
    const next = __curEnt(); if (next) { next.loadoutIdx = carry; if (Array.isArray(next.loadoutWeapons)) next.weapon = next.loadoutWeapons[carry]; }
    __apply();
  };
  const __lvBuild = () => {
    __lvRow.textContent = '';
    const liv = __liv(__H[__sIdx]);
    if (liv.length < 2) { __lvRow.style.display = 'none'; return; }
    __lvRow.style.display = 'flex';
    for (let i = 0; i < liv.length; i++) {
      const b = document.createElement('button');
      b.style.cssText = __lvBase + (i === __lIdx[__sIdx] ? __onCss : '');
      const dot = document.createElement('span');
      dot.style.cssText = 'width:11px;height:11px;border-radius:50%;display:inline-block;margin-right:6px;border:1px solid rgba(255,255,255,0.35);background:' + (liv[i].color || '#888');
      b.appendChild(dot); b.appendChild(document.createTextNode(liv[i].name || ('LIVERY ' + (i + 1))));
      const idx = i; b.onclick = () => __liverySet(idx);
      __lvRow.appendChild(b);
    }
  };
  const __apply = () => {
    __showActive();
    __sLbl.textContent = (__H[__sIdx] || {}).name || '';
    __lvBuild(); __eBuild();
    const hg = window.__mojHangar; hg.suitIdx = __sIdx; hg.liveryIdx = __lIdx[__sIdx]; hg.active = __activeId();
  };
  const __suitStep = (d) => { const n = __H.length; if (!n) return; __sIdx = ((__sIdx + d) % n + n) % n; __apply(); };
  window.__mojHangar = {
    suits: __H, suitIdx: 0, liveryIdx: 0, active: null,
    sync: __showActive,   // per-frame re-assert (see __showActive) — called by the step hook
    bodies: () => Object.keys(__bodies),   // introspection surface (spikes/debug), like __mojShadows
    step: __suitStep, livery: __liverySet, equip: __eEquip,
    preset: () => { const s = __H[__sIdx], liv = __liv(s), ent = __curEnt(), lo = __eLoadout(ent), w = lo[ent ? (ent.loadoutIdx || 0) : 0];
      return { suit: s.name, livery: (liv[__lIdx[__sIdx]] || {}).name || null, id: __activeId(), weapon: w ? w.name : null, weaponSlot: ent ? (ent.loadoutIdx || 0) : 0 }; },
  };
  __sPrev.onclick = () => __suitStep(-1);
  __sNext.onclick = () => __suitStep(1);
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'ArrowLeft') { ev.preventDefault(); __suitStep(-1); }
    else if (ev.code === 'ArrowRight') { ev.preventDefault(); __suitStep(1); }
    else if (ev.code === 'ArrowUp' || ev.code === 'ArrowDown') { ev.preventDefault(); const liv = __liv(__H[__sIdx]); const n = liv.length; if (n > 1) __liverySet(((__lIdx[__sIdx] + (ev.code === 'ArrowDown' ? 1 : -1)) % n + n) % n); }
    else if (/^Digit[1-9]$/.test(ev.code)) { ev.preventDefault(); __eEquip((+ev.code.slice(5)) - 1); }
  });
  __apply();
}
`;
}
