// THE MISSION EDITOR — the holo table the person edits a mission on (briefing-page.js inlines it after the briefing's
// client when the page is served as a game's book with an editor: lib/graph/campaign/designer.js). It reads EDITOR
// ({ ref, mission, design, edit, post, at }) and the table's handle (window.__brief.api), and writes the design back
// through the missions route: saved as a draft, or approved.
//
//   the briefing (edit off)   the briefing as the pilot sees it, a bar over it: the mission's state, Edit on the table,
//                             Approve as it is
//   the table (edit on)       everything lit and in view, the camera held; a thing picked by a click (its model or its
//                             name), dragged across the plane it stands on, Shift-dragged up and down; the right button
//                             turns the table, the wheel brings it near; a panel says what is picked and changes it (its
//                             name, how many, when it comes in or lights, what the comms say, its heading); a beacon added
//                             where the view is; the briefing's words; Save as a draft, or Approve
//
// Positions are the design's own: metres from the pilot's start (x across, y ahead, z up), rounded to ten.

(function () {
  const E = EDITOR, API = window.__brief.api, D = JSON.parse(JSON.stringify(E.design));
  let reshaped = false;   // (a beacon added or taken away: the table is drawn again once it is saved)
  const R10 = (v) => Math.round(v / 10) * 10, half = (D.theatre.field || 6000) / 2;
  const clamp = (v) => Math.max(-half, Math.min(half, v));
  const css = document.createElement('style');
  css.textContent = `
#mjed-bar{position:fixed;top:10px;right:12px;z-index:30;display:flex;gap:8px;align-items:center;font:600 13px/1.2 system-ui,sans-serif;color:#e9f6ff}
#mjed-bar button,#mjed-bar a{background:#0b1722cc;border:1px solid #4fd6ff;color:#e9f6ff;padding:7px 12px;border-radius:3px;cursor:pointer;text-decoration:none;font:inherit}
#mjed-bar button.go{background:#4fd6ff;color:#06121b}
#mjed-bar .state{padding:6px 10px;border:1px dashed #ffd166;color:#ffd166;border-radius:3px}
#mjed-bar .state.ok{border-color:#7be0a0;color:#7be0a0}
#mjed-say{position:fixed;top:52px;right:12px;z-index:30;max-width:420px;font:12px/1.4 system-ui,sans-serif;color:#ffd166;background:#0b1722e6;border:1px solid #ffd16655;padding:8px 10px;display:none;white-space:pre-wrap}
#mjed-panel{position:fixed;left:12px;top:12px;bottom:12px;width:min(360px,40vw);z-index:30;overflow:auto;background:#0b1722e6;border:1px solid #4fd6ff;color:#e9f6ff;font:13px/1.35 system-ui,sans-serif;padding:12px 14px}
#mjed-panel h3{margin:4px 0 8px;font-size:15px;color:#4fd6ff;letter-spacing:.04em;text-transform:uppercase}
#mjed-panel label{display:block;margin:8px 0 3px;color:#9fc6da;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
#mjed-panel input,#mjed-panel select,#mjed-panel textarea{width:100%;box-sizing:border-box;background:#06121b;border:1px solid #2f7fa3;color:#e9f6ff;padding:5px 6px;font:inherit}
#mjed-panel textarea{min-height:56px;resize:vertical}
#mjed-panel .row{display:flex;gap:6px}#mjed-panel .row>*{flex:1}
#mjed-panel .hint{color:#7fa6ba;font-size:12px;margin:6px 0}
#mjed-panel button{background:#06121b;border:1px solid #4fd6ff;color:#e9f6ff;padding:5px 10px;cursor:pointer;margin:6px 6px 0 0;font:inherit}
#mjed-panel hr{border:0;border-top:1px solid #1d4a63;margin:12px 0}
`;
  document.head.appendChild(css);
  const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'on') for (const [ev, f] of Object.entries(v)) n.addEventListener(ev, f); else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); } for (const c of kids) if (c) n.append(c); return n; };

  // ── the bar: the mission's state, the way between the briefing and the table, save and approve ──
  const bar = el('div', { id: 'mjed-bar' }), say = el('div', { id: 'mjed-say' });
  const state = el('span', { class: `state${D.status === 'approved' ? ' ok' : ''}`, text: D.status === 'approved' ? 'Approved' : 'Draft' });
  const tell = (text, good) => { say.style.display = text ? 'block' : 'none'; say.style.color = good ? '#7be0a0' : '#ffd166'; say.textContent = text || ''; };
  async function send(approve) {
    tell(approve ? 'Approving…' : 'Saving…');
    try {
      const r = await fetch(E.post, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mission: E.mission, design: D, approve }) });
      const j = await r.json();
      if (!r.ok) { tell(j.error || `refused (${r.status})`); return; }
      const failing = (j.laws || []).filter((L) => !L.ok);
      state.textContent = j.status === 'approved' ? 'Approved' : 'Draft'; state.className = `state${j.status === 'approved' ? ' ok' : ''}`;
      tell(`${j.status === 'approved' ? 'Approved: the next build lays its level from it.' : 'Saved as a draft.'}${failing.length ? `\nIts laws advise:\n${failing.map((L) => `· ${L.says}`).join('\n')}` : ''}`, !failing.length);
      // (approved from the briefing, or a beacon added or taken away on the table: the page drawn again from what was saved)
      if ((approve && !E.edit) || (E.edit && reshaped)) { reshaped = false; setTimeout(() => location.reload(), 1200); }
    } catch (e) { tell(`not saved: ${e.message}`); }
  }
  bar.append(state);
  if (E.edit) bar.append(el('a', { href: E.at, text: 'Preview the briefing' }), el('button', { text: 'Save draft', on: { click: () => send(false) } }));
  else if (!E.fixed) bar.append(el('a', { href: `${E.at}&edit=1`, text: 'Edit on the table' }));   // (a stage's table follows from its route: approved, not moved)
  bar.append(el('button', { class: 'go', text: 'Approve', on: { click: () => send(true) } }));
  document.body.append(bar, say);
  if (!E.edit) return;

  // ── the table, for editing: everything lit and in view, the words put away, the camera held ──
  const mana = document.getElementById('mana'); if (mana) mana.style.display = 'none';
  API.setDrift(0); API.showAll();
  const canvas = API.renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  ray.camera = API.camera;
  const navOf = (id) => D.theatre.nav && D.theatre.nav[id];
  const entryOf = (id) => (id === 'station' ? { kind: 'station', obj: D.theatre.station } : navOf(id) ? { kind: 'nav', obj: navOf(id) }
    : c(id) ? { kind: c(id).capital ? 'capital' : 'group', obj: c(id) } : (D.beacons || []).find((b) => b.id === id) ? { kind: 'beacon', obj: (D.beacons || []).find((b) => b.id === id) } : null);
  function c(id) { return D.cast.find((x) => x.id === id); }
  const toMetres = (v) => [R10(clamp(v.x / API.S)), R10(clamp(v.y / API.S)), R10(clamp((v.z - API.LIFT) / API.S))];
  const toTable = (m) => new THREE.Vector3(m[0] * API.S, m[1] * API.S, API.LIFT + m[2] * API.S);
  const where = (at) => (typeof at === 'string' ? navOf(at)?.at ?? [0, 0, 0] : at);

  // a click: the thing under it (its model or its name), else nothing
  function pick(ev) {
    const b = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, API.camera);
    for (const h of ray.intersectObjects(API.th.children, true)) { let o = h.object; while (o && !(o.userData && o.userData.id)) o = o.parent; if (o && o.userData.id !== 'start' && entryOf(o.userData.id)) return o.userData.id; }
    return null;
  }
  let sel = null, drag = null, orbit = null;
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button === 2) { orbit = { x: ev.clientX, y: ev.clientY, az: API.view.az, el: API.want.el }; canvas.setPointerCapture(ev.pointerId); return; }
    const id = pick(ev); select(id);
    // (the pilot's flight is where the start is: the start is the frame everything else stands in)
    if (id && !(c(id) && c(id).pilot)) { drag = { id, z: API.places[id].at.z, y0: ev.clientY, shift: ev.shiftKey }; canvas.setPointerCapture(ev.pointerId); }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (orbit) { API.view.az = orbit.az - (ev.clientX - orbit.x) * 0.006; API.want.el = Math.max(0.15, Math.min(1.45, orbit.el + (ev.clientY - orbit.y) * 0.004)); return; }
    if (!drag) return;
    const P = API.places[drag.id], at = P.at.clone();
    if (drag.shift || ev.shiftKey) {
      // (up and down: the screen's height turned into the table's, at its distance)
      at.z = Math.max(API.LIFT - half * API.S, Math.min(API.LIFT + half * API.S, drag.z - (ev.clientY - drag.y0) * 0.004 * API.view.dist / 6));
    } else {
      const b = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(ndc, API.camera);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -P.at.z), hit)) return;
      at.x = hit.x; at.y = hit.y;
    }
    place(drag.id, toMetres(at));
  });
  const up = () => { drag = null; orbit = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); API.want.dist = Math.max(2, Math.min(40, API.want.dist * (ev.deltaY > 0 ? 1.12 : 1 / 1.12))); }, { passive: false });

  // a thing set where it now stands, in the design and on the table: a nav point takes what stands at it along; anything
  // else stood at a nav point stands at its own spot from now
  function place(id, m) {
    const e = entryOf(id); if (!e) return;
    if (e.kind === 'nav') {
      e.obj.at = m; API.moveTo(id, toTable(m));
      for (const x of [...D.cast, ...(D.beacons || [])]) if (x.at === id && API.places[x.id]) API.moveTo(x.id, toTable(m));
    } else { e.obj.at = m; API.moveTo(id, toTable(m)); }
    if (sel === id) draw();
  }

  // ── the panel: what is picked, and what it says and does ──
  const panel = el('div', { id: 'mjed-panel' });
  document.body.append(panel);
  const groups = () => D.cast.filter((x) => !x.capital && !x.pilot).map((x) => x.id), beacons = () => (D.beacons || []).map((b) => b.id);
  const nameOf = (id) => (c(id) || (D.beacons || []).find((b) => b.id === id) || navOf(id) || { name: id }).name;
  function field(lab, input) { return [el('label', { text: lab }), input]; }
  function text(v, set, multi) { const n = el(multi ? 'textarea' : 'input', multi ? {} : { value: v ?? '' }); if (multi) n.value = v ?? ''; n.addEventListener('input', () => set(n.value)); return n; }
  function num(v, set) { const n = el('input', { type: 'number', value: v ?? '' }); n.addEventListener('input', () => set(n.value === '' ? undefined : Number(n.value))); return n; }
  function choose(v, opts, set) { const n = el('select'); for (const [k, lab] of opts) { const o = el('option', { value: k, text: lab }); if (k === v) o.selected = true; n.append(o); } n.addEventListener('change', () => set(n.value)); return n; }
  // when a group comes in, or a beacon lights: at once, some seconds in, once a group is down, once a beacon is reached
  function when(obj, key, startWord) {
    const W = obj[key] && typeof obj[key] === 'object' ? obj[key] : null, mode = !W ? 'start' : W.reach ? 'reach' : W.down ? 'down' : 'after';
    const box = el('div');
    const refill = () => { box.replaceChildren(...build()); };
    const build = () => {
      const w = obj[key] && typeof obj[key] === 'object' ? obj[key] : null, m = !w ? 'start' : w.reach ? 'reach' : w.down ? 'down' : 'after';
      const out = [choose(m, [['start', startWord], ['after', 'some seconds in'], ['down', 'once a group is down'], ['reach', 'once a beacon is reached']], (v) => {
        const keep = w && w.say ? { say: w.say } : {};
        if (v === 'start') { if (key === 'arrive') obj[key] = 'start'; else delete obj[key]; }
        else if (v === 'after') obj[key] = { after: 10, ...keep };
        else if (v === 'down') obj[key] = { down: groups().filter((g) => g !== obj.id)[0], ...keep };
        else obj[key] = { reach: beacons().filter((b) => b !== obj.id)[0], ...keep };
        refill();
      })];
      if (m === 'down') out.push(choose(w.down, groups().filter((g) => g !== obj.id).map((g) => [g, nameOf(g)]), (v) => { w.down = v; }));
      if (m === 'reach') out.push(choose(w.reach, beacons().filter((b) => b !== obj.id).map((b) => [b, nameOf(b)]), (v) => { w.reach = v; }));
      if (m !== 'start') out.push(...field(m === 'after' ? 'Seconds' : 'Then, seconds after', num(w.after, (v) => { if (v === undefined) delete w.after; else w.after = v; })));
      if (m !== 'start' && key === 'arrive') out.push(...field('The comms say, as they come in', text(w.say, (v) => { if (v) w.say = v; else delete w.say; })));
      return out;
    };
    void mode; refill();
    return box;
  }
  function draw() {
    const kids = [el('h3', { text: E.design.name || 'Mission' }), el('div', { class: 'hint', text: 'Click a thing to pick it; drag it across the table, Shift-drag it up and down. Right-drag turns the table, the wheel brings it near.' })];
    if (sel) {
      const e = entryOf(sel), o = e.obj, at = where(o.at);
      kids.push(el('hr'), el('h3', { text: `${e.kind === 'nav' ? 'Nav point' : e.kind}: ${o.name ?? sel}` }));
      kids.push(el('div', { class: 'hint', text: `At ${at.map((v) => `${v} m`).join(', ')} (across, ahead, up)${typeof o.at === 'string' ? `, at ${nameOf(o.at)}` : ''}` }));
      if (e.kind !== 'station') kids.push(...field('Name', text(o.name, (v) => { o.name = v; })));
      if (e.kind === 'group') {
        kids.push(...field('How many', num(o.count, (v) => { o.count = v; })));
        if (!o.pilot) kids.push(el('label', { text: 'Comes in' }), when(o, 'arrive', 'there from the start'));
        kids.push(...field('Hull (hits it takes)', num(o.hull, (v) => { if (v === undefined) delete o.hull; else o.hull = v; })));
      }
      if (e.kind === 'beacon') {
        kids.push(...field('Reach (m)', num(o.radius, (v) => { if (v === undefined) delete o.radius; else o.radius = v; })));
        kids.push(el('label', { text: 'Lights' }), when(o, 'lit', 'at once'));
        kids.push(...field('The comms say, when it is reached', text(o.say, (v) => { if (v) o.say = v; else delete o.say; })));
        kids.push(el('button', { text: 'Remove this beacon', on: { click: () => { D.beacons = D.beacons.filter((b) => b.id !== sel); reshaped = true; tell('The beacon is removed: save, and the table shows the mission without it (a goal or a group that waits on it is said to be wrong).'); sel = null; draw(); } } }));
      }
      if (e.kind === 'capital' || e.kind === 'station') kids.push(...field('Heading (° clockwise from the pilot\'s)', num(o.heading ?? 0, (v) => { o.heading = v ?? 0; })));
    }
    kids.push(el('hr'), el('button', { text: 'Add a beacon here', on: { click: () => {
      const n = (D.beacons || []).length + 1, id = `beacon${n}`, t = API.view.target;
      (D.beacons = D.beacons || []).push({ id, name: `Beacon ${n}`, at: toMetres(new THREE.Vector3(t.x, t.y, API.LIFT)) });
      reshaped = true;
      tell(`${id} added where the view is: save, and it stands on the table; send the pilot to it from a goal (the agent writes those), a group's "comes in" or another beacon's "lights".`);
      sel = null; draw();
    } } }));
    kids.push(el('hr'), el('h3', { text: 'The briefing' }));
    D.steps.forEach((st, k) => kids.push(el('label', { text: `Step ${k + 1}` }), text(st.title, (v) => { st.title = v; }), text(st.say, (v) => { st.say = v; }, true),
      el('label', { text: 'What it shows (ids)' }), text(st.show.join(', '), (v) => { st.show = v.split(',').map((x) => x.trim()).filter(Boolean); })));
    panel.replaceChildren(...kids);
  }
  function select(id) { sel = id; draw(); }
  draw();
  window.__mojEditor = { design: D, select, place, send };
})();
