// In-page script (post-capture): THE FRAME'S HUD — what an assault frame's pilot reads at a glance, in the register the
// boost-and-gun mech games drew it in: thin lines, figures and no boxes over the fight. Opt-in: a page whose pilot is a
// frame (worlds/controllable/rules-frame.js); absent, not one byte of this is emitted.
//
//   centre        THE RETICLE: the FCS's cone as a ring round the aim, the lock box drawn on the foe it holds (square,
//                 closing as the lock builds, solid when locked), the foe's armour under it; under the box a frame's
//                 STRESS, its stability spent (filling as it is pressed, red and STAGGER when it breaks: the moment to
//                 punish it)
//   own           its own stability under its armour, and STAGGER while it reels
//   an ace        its name and its armour across the top while it is in the field (its stability under it), a line said
//                 as it crosses into a phase, and its TELL: a flare marked over it while it squares up to lunge
//   bottom        THE GENERATOR: EN as one long bar, its draw seen as it happens; OUT when it is emptied and shut. Over
//                 it the frame's armour (AP) as a figure and a bar, and its speed and height
//   the corners   THE WEAPONS where they are on the frame: the hands below left and right, the shoulders above them;
//                 each its name, its rounds (a reload and a charge shown as a bar filling)
//
// The page is its host: each frame it reads the pilot off `window.__mojCtrl` and projects the locked foe through the
// page's camera. It takes no input. `window.__mojFrameHud` → { en, ap, lock: { id, locked, stress?, stagger? } } as
// last drawn.

export function frameHudScript() {
  return `
// THE FRAME'S HUD (scene/channels/controllable/frame-hud.js)
(function () {
  const css = '.fh{position:fixed;inset:0;pointer-events:none;font:600 12px/1.2 ui-monospace,Menlo,Consolas,monospace;color:#bfefff;text-shadow:0 0 4px rgba(0,30,40,.9);z-index:40}'
    + '.fh .ret{position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;border:1px solid rgba(160,230,255,.35);border-radius:50%}'
    + '.fh .dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#dff8ff;border-radius:50%}'
    + '.fh .box{position:absolute;border:1.5px solid #ffd060;display:none}.fh .box.on{border-color:#ff5a4a;border-width:2px}'
    + '.fh .tap{position:absolute;font-size:11px;color:#ffd060;display:none;white-space:nowrap}'
    + '.fh .acs{position:absolute;height:4px;background:rgba(255,208,96,.18);display:none}.fh .acs i{display:block;height:100%;width:0;background:#ffd060}'
    + '.fh .acs.brk i{background:#ff3b2f}.fh .acs.brk:after{content:"STAGGER";position:absolute;left:0;right:0;top:7px;text-align:center;font-size:12px;font-weight:700;color:#ff3b2f;letter-spacing:.14em}'
    + '.fh .stb{position:absolute;left:50%;bottom:98px;width:440px;margin-left:-220px;height:2px;background:rgba(160,230,255,.12)}.fh .stb i{position:absolute;left:0;top:0;bottom:0;background:#ffd060}'
    + '.fh .ace{position:absolute;left:50%;top:92px;width:520px;margin-left:-260px;display:none;text-align:center}.fh .ace b{font-size:13px;letter-spacing:.3em;color:#ffd9b0}'
    + '.fh .ace .hp{height:6px;margin-top:4px;border:1px solid rgba(255,190,150,.5)}.fh .ace .hp i{display:block;height:100%;background:linear-gradient(90deg,#c22a22,#ff8a5a)}'
    + '.fh .ace .st{height:2px;margin-top:2px;background:rgba(255,208,96,.15)}.fh .ace .st i{display:block;height:100%;background:#ffd060}.fh .ace em{display:block;font-style:normal;font-size:12px;color:#ffb48a;margin-top:4px;min-height:14px}'
    + '.fh .tell{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border:2px solid #ff3b2f;transform:rotate(45deg);display:none;box-shadow:0 0 14px #ff3b2f}'
    + '.fh .me{position:absolute;left:50%;top:58%;transform:translateX(-50%);font-size:18px;font-weight:700;color:#ff3b2f;letter-spacing:.2em;display:none}'
    + '.fh .en{position:absolute;left:50%;bottom:78px;width:440px;margin-left:-220px;height:8px;border:1px solid rgba(160,230,255,.5)}'
    + '.fh .en i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#3ec6ff,#bff0ff)}.fh .en.out i{background:#ff4a3a}'
    + '.fh .enl{position:absolute;left:50%;bottom:90px;width:440px;margin-left:-220px;display:flex;justify-content:space-between}'
    + '.fh .ap{position:absolute;left:50%;bottom:106px;width:440px;margin-left:-220px;display:flex;justify-content:space-between;font-size:15px}'
    + '.fh .apb{position:absolute;left:50%;bottom:102px;width:440px;margin-left:-220px;height:3px;background:rgba(160,230,255,.18)}.fh .apb i{position:absolute;left:0;top:0;bottom:0;background:#dff8ff}'
    + '.fh .w{position:absolute;width:190px}.fh .w b{display:block;font-size:11px;opacity:.75;letter-spacing:.08em}.fh .w span{font-size:20px}'
    + '.fh .w .bar{height:3px;background:rgba(160,230,255,.18);margin-top:3px}.fh .w .bar i{display:block;height:100%;background:#ffd060;width:0}'
    + '.fh .armR{right:calc(50% - 330px);bottom:140px;text-align:right}.fh .armL{left:calc(50% - 330px);bottom:140px}'
    + '.fh .backR{right:calc(50% - 330px);bottom:200px;text-align:right}.fh .backL{left:calc(50% - 330px);bottom:200px}';
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'fh';
  root.innerHTML = '<div class="ret"></div><div class="dot"></div><div class="box"></div><div class="tap"></div><div class="acs"><i></i></div><div class="me">STAGGER</div><div class="ace"><b></b><div class="hp"><i></i></div><div class="st"><i></i></div><em></em></div><div class="tell"></div><div class="stb"><i></i></div>'
    + '<div class="ap"><span class="apn">AP</span><span class="spd"></span></div><div class="apb"><i></i></div>'
    + '<div class="enl"><span>EN</span><span class="ens"></span></div><div class="en"><i></i></div>'
    + ['armR', 'armL', 'backR', 'backL'].map((s) => '<div class="w ' + s + '"><b></b><span></span><div class="bar"><i></i></div></div>').join('');
  document.body.appendChild(root);
  const q = (s) => root.querySelector(s), box = q('.box'), tap = q('.tap'), acs = q('.acs'), acsI = q('.acs i'), me = q('.me'), stbI = q('.stb i'), aceEl = q('.ace'), aceN = q('.ace b'), aceHp = q('.ace .hp i'), aceSt = q('.ace .st i'), aceSay = q('.ace em'), tellEl = q('.tell'), enEl = q('.en'), enI = q('.en i'), ens = q('.ens'), apn = q('.apn'), spd = q('.spd'), apI = q('.apb i');
  const W = {}; for (const s of ['armR', 'armL', 'backR', 'backL']) W[s] = { el: q('.' + s), b: q('.' + s + ' b'), n: q('.' + s + ' span'), bar: q('.' + s + ' .bar i') };
  const out = window.__mojFrameHud = { en: 0, ap: 0, lock: null };
  let pv = null;
  const screenOf = (p) => { if (typeof camera === 'undefined' || typeof THREE === 'undefined') return null; pv = pv || new THREE.Vector3(); camera.updateMatrixWorld(); pv.set(p[0], p[1], p[2]).project(camera); return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight, back: pv.z >= 1 }; };
  function tick() {
    requestAnimationFrame(tick);
    const C = window.__mojCtrl, w = C && C.world, P = w && w.pilotId && w.byId[w.pilotId];
    if (!P || !P.rule || P.rule.type !== 'frame') { root.style.display = 'none'; return; }
    root.style.display = '';
    const R = P.rule, enMax = P.enMax || (R.en && R.en.max) || 1;
    enI.style.width = (100 * Math.max(0, P.en || 0) / enMax).toFixed(1) + '%';
    enEl.classList.toggle('out', !!(P.enOut > 0 || P.enShut));
    ens.textContent = P.enOut > 0 || P.enShut ? 'EN OUT' : Math.round(P.en || 0);
    const hp = P.body ? P.body.hp : 0, hpMax = (P.body && P.body.hpMax) || hp || 1;
    apn.textContent = 'AP ' + Math.round(hp); apI.style.width = (100 * hp / hpMax).toFixed(1) + '%';
    spd.textContent = (P.braced === 'stick' ? 'BRACED  ' : P.braced === 'wind' ? 'RECOVER  ' : P.ab ? 'ASSAULT BOOST  ' : '') + Math.round((P.speed || 0) * 3.6) + ' km/h  ' + Math.round(P.agl || 0) + ' m';
    out.en = Math.round(P.en || 0); out.ap = Math.round(hp);
    stbI.style.width = (100 * (P.stab ?? 1)).toFixed(1) + '%';
    me.style.display = P.stagger > 0 ? 'block' : 'none';
    const S = P.slotState || {};
    for (const s in W) {
      const slot = R.slots && R.slots[s], X = W[s];
      if (!slot) { X.el.style.display = 'none'; continue; }
      X.el.style.display = ''; X.b.textContent = (s.startsWith('arm') ? (s === 'armR' ? 'R ARM ' : 'L ARM ') : (s === 'backR' ? 'R BACK ' : 'L BACK ')) + slot.name.toUpperCase();
      const v = S[s] || {};
      X.n.textContent = v.reloading ? 'RELOAD' : slot.mag >= 9999 ? (slot.energy ? 'EN' : '--') : (v.ammo ?? slot.mag);
      X.bar.style.width = (v.charge > 0 ? 100 * v.charge : v.reloading ? 100 : 0) + '%';
    }
    // an ace in the field: its bar across the top, the line it says as it crosses a phase, and its tell over it
    let ace = null;
    for (const id in w.byId) { const b = w.byId[id]; if (b.ace && !b.dormant && !b.gone && !b.downed) { ace = b; break; } }
    if (ace) {
      aceEl.style.display = 'block'; aceN.textContent = ace.ace.name.toUpperCase();
      aceHp.style.width = (100 * Math.max(0, ace.body.hp) / (ace.body.hpMax || 1)).toFixed(1) + '%'; aceSt.style.width = (100 * (ace.stab ?? 1)).toFixed(1) + '%';
      const ph = ace.rule.mind && ace.rule.mind.phases && ace.rule.mind.phases[ace.acePhase || 0];
      aceSay.textContent = ph && ph.say && (ace.frTime - (ace.phaseAt || 0)) < 4 ? ph.say : '';
      const ts = ace.tell ? screenOf([ace.transform.pos[0], ace.transform.pos[1], ace.transform.pos[2] + ((ace.body && ace.body.aimH) || 6)]) : null;
      if (ts && !ts.back) { tellEl.style.display = 'block'; tellEl.style.left = ts.x + 'px'; tellEl.style.top = ts.y + 'px'; } else tellEl.style.display = 'none';
      out.ace = { id: ace.id, phase: ace.acePhase || 0, tell: !!ace.tell };
    } else { aceEl.style.display = 'none'; tellEl.style.display = 'none'; out.ace = null; }
    // the lock: a box on the foe the FCS holds, closing as it builds
    const T = P.lockOn && w.byId[P.lockOn];
    if (T && !T.gone && !T.downed) {
      const h = (T.body && T.body.aimH) || 2, sp = screenOf([T.transform.pos[0], T.transform.pos[1], T.transform.pos[2] + h]);
      if (sp && !sp.back) {
        const k = P.locked ? 1 : Math.min(1, (P.lockT || 0) / ((R.fcs && R.fcs.lock) || 0.5)), size = Math.round(70 - 34 * k);
        box.style.display = 'block'; box.classList.toggle('on', !!P.locked);
        box.style.left = (sp.x - size / 2) + 'px'; box.style.top = (sp.y - size / 2) + 'px'; box.style.width = size + 'px'; box.style.height = size + 'px';
        const thp = T.body.hp, tmax = T.body.hpMax || thp || 1, d = Math.hypot(T.transform.pos[0] - P.transform.pos[0], T.transform.pos[1] - P.transform.pos[1], T.transform.pos[2] - P.transform.pos[2]);
        tap.style.display = 'block'; tap.style.left = (sp.x + size / 2 + 6) + 'px'; tap.style.top = (sp.y - 8) + 'px';
        tap.textContent = (P.locked ? 'LOCK ' : '') + Math.round(d) + ' m  ' + Math.round(100 * thp / tmax) + '%';
        // (its stress: a frame's stability spent, filling as it is pressed; broken, red with STAGGER under it)
        const frame = T.rule && T.rule.type === 'frame', stress = frame ? Math.max(0, Math.min(1, 1 - (T.stab ?? 1))) : 0, brk = frame && T.stagger > 0;
        acs.style.display = frame ? 'block' : 'none';
        if (frame) { acs.style.left = (sp.x - size / 2) + 'px'; acs.style.top = (sp.y + size / 2 + 5) + 'px'; acs.style.width = size + 'px'; acsI.style.width = (brk ? 100 : 100 * stress).toFixed(1) + '%'; acs.classList.toggle('brk', !!brk); }
        out.lock = { id: T.id, locked: !!P.locked, ...(frame ? { stress: Math.round(stress * 100) / 100, stagger: !!brk } : {}) };
      } else { box.style.display = 'none'; tap.style.display = 'none'; acs.style.display = 'none'; out.lock = null; }
    } else { box.style.display = 'none'; tap.style.display = 'none'; acs.style.display = 'none'; out.lock = null; }
  }
  requestAnimationFrame(tick);
})();
`;
}
