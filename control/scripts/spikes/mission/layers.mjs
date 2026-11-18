#!/usr/bin/env node
/**
 * LAYERS — a built level's page with a panel that switches it apart, so the person playing it on their own machine can
 * find which layer costs the frame: each layer of the scene on or off, the ground's shading full or plain paint, the live
 * shadows' passes, the haze, the HUD, the pixel density; and a frame readout that counts each frame once (a page runs
 * several animation loops). Nothing in the level is changed: the built page is read and written again beside itself with
 * the panel added (`<name>-layers.html`).
 *
 *   node scripts/spikes/mission/layers.mjs <page.html> [<out.html>]
 *
 * A layer is switched off by making its materials invisible (drawn by no pass, the shadows' included), so the game's own
 * showing and hiding and the rays it casts are untouched. The layers are read off the scene by kind: the ground (the
 * land's material), the grass (instanced blades), stones and plants (instanced meshes), characters (skinned), structures
 * (the level's cover and buildings by name), trees and far sheets (large transparent layers), and the rest. The panel
 * says each layer's triangles, re-read every two seconds (a far twin, an effect, built later, joins its layer).
 */
import fs from 'node:fs';
import path from 'node:path';

const [src, out0] = process.argv.slice(2);
if (!src) { console.error('layers: node scripts/spikes/mission/layers.mjs <page.html> [<out.html>]'); process.exit(1); }
const out = out0 ?? src.replace(/\.html$/, '-layers.html');

// (before any of the page's scripts: the scene and the renderer caught as they are made, the pixel budget held by the panel)
const PROBE = `<script>(function(){
  var catchOn = function (key, test) { Object.defineProperty(Object.prototype, key, { configurable: true, get: function () { return undefined; }, set: function (v) { Object.defineProperty(this, key, { value: v, writable: true, configurable: true, enumerable: true }); test(this, v); } }); };
  window.__LY = { scenes: [], renderers: [], dpr: null };
  catchOn('isScene', function (o, v) { if (v) window.__LY.scenes.push(o); });
  catchOn('shadowMap', function (o) { if (o && typeof o.render === 'function') window.__LY.renderers.push(o); });
  Object.defineProperty(window, '__mojBudget', { configurable: true, get: function () { return this.__lyB; }, set: function (v) {
    var own = v.dpr; Object.defineProperty(v, 'dpr', { get: function () { return window.__LY.dpr != null ? window.__LY.dpr : own; }, set: function (x) { own = x; } }); this.__lyB = v; } });
})();</script>`;

const PANEL = `<script>(function(){
  var LY = window.__LY, NAMES = ['ground', 'grass', 'stones & plants', 'trees & far sheets', 'structures', 'characters', 'the rest'];
  var off = {}, plain = false, shadowsOff = false, hazeOff = false, hudOff = false, groups = {};
  var scene = function () { return LY.scenes.reduce(function (a, s) { return s.children.length > (a ? a.children.length : -1) ? s : a; }, null); };
  var renderer = function () { return LY.renderers.filter(function (r) { return r.domElement; })[0]; };
  var obcLen = function (m) { return m && m.onBeforeCompile ? m.onBeforeCompile.toString().length : 0; };
  function layerOf(o) {
    var m = Array.isArray(o.material) ? o.material[0] : o.material, g = String((o.userData && o.userData.g) || (o.parent && o.parent.userData && o.parent.userData.g) || '');
    if (o.isSkinnedMesh) return 'characters';
    for (var q = o.parent; q; q = q.parent) if (q.userData && q.userData.rigFig) return 'characters';   // (a figure's own bone meshes)
    if (obcLen(m) > 20000) return 'ground';
    if (o.geometry && o.geometry.isInstancedBufferGeometry) return 'grass';
    if (o.isInstancedMesh) return 'stones & plants';
    if (/^(cover|structure|stage|wall|tower|bags|wire|truck|parked)/.test(g)) return 'structures';
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (m && m.transparent && o.geometry.boundingSphere && o.geometry.boundingSphere.radius > 40) return 'trees & far sheets';
    return 'the rest';
  }
  var tris = function (o) { var g = o.geometry; if (!g) return 0; var n = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0; var k = o.isInstancedMesh ? o.count : (g.instanceCount && g.instanceCount !== Infinity ? g.instanceCount : 1); return n / 3 * k; };
  function reread() {
    var s = scene(); if (!s) return;
    groups = {}; NAMES.forEach(function (n) { groups[n] = { mats: new Set(), meshes: [], tris: 0 }; });
    s.traverse(function (o) { if (!(o.isMesh || o.isPoints) || !o.material || o.userData.__ly) return; var L = groups[layerOf(o)]; L.meshes.push(o); var shown = true; for (var q = o; q; q = q.parent) if (q.visible === false) shown = false; if (shown) L.tris += tris(o); (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { L.mats.add(m); }); });
    apply();
  }
  function apply() {
    NAMES.forEach(function (n) { var L = groups[n]; if (!L) return; L.mats.forEach(function (m) { if (m.__lyPlain) return; m.visible = !off[n]; }); });
    // (the ground plain: its material swapped for one paint, the land's own colours, no light, no layers)
    var G = groups.ground; if (G) G.meshes.forEach(function (o) {
      if (plain && !o.userData.__lyOwn) { o.userData.__lyOwn = o.material; var B = basic(), P = new B({ color: 0x8a8f6a, vertexColors: !!o.geometry.attributes.color }); P.__lyPlain = true; P.visible = !off.ground; o.material = P; }
      else if (!plain && o.userData.__lyOwn) { o.material = o.userData.__lyOwn; o.userData.__lyOwn = null; }
      if (o.material.__lyPlain) o.material.visible = !off.ground;
    });
    var r = renderer(); if (r && r.shadowMap) r.shadowMap.autoUpdate = !shadowsOff;
    var hud = document.querySelectorAll('.mana-root, body > div'); for (var i = 0; i < hud.length; i++) if (hud[i] !== panel && !hud[i].contains(panel)) hud[i].style.visibility = hudOff ? 'hidden' : '';
  }
  var basicCtor = null; function basic() { if (basicCtor) return basicCtor; scene().traverse(function (o) { if (!basicCtor && o.material && o.material.isMeshBasicMaterial) basicCtor = o.material.constructor; }); return basicCtor; }
  // the panel
  var panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:12px;top:64px;z-index:99;font:600 12px/1.5 ui-monospace,monospace;color:#e8ecef;background:rgba(10,14,18,.82);padding:10px 12px;border-left:3px solid #6fd6ff;max-width:300px;user-select:text';
  document.body.appendChild(panel);
  var readout = '—', frames = [];
  function draw() {
    var h = '<div style="font-size:14px;margin-bottom:6px">' + readout + '</div>';
    NAMES.forEach(function (n) { var L = groups[n] || { tris: 0 }; h += '<label style="display:block;cursor:pointer"><input type="checkbox" data-l="' + n + '"' + (off[n] ? '' : ' checked') + '> ' + n + ' <span style="opacity:.6">' + Math.round(L.tris / 1000) + 'k</span></label>'; });
    h += '<hr style="border:0;border-top:1px solid #333">';
    h += '<label style="display:block"><input type="checkbox" data-x="plain"' + (plain ? ' checked' : '') + '> ground as plain paint</label>';
    h += '<label style="display:block"><input type="checkbox" data-x="shadows"' + (shadowsOff ? '' : ' checked') + '> live shadows (their passes)</label>';
    h += '<label style="display:block"><input type="checkbox" data-x="haze"' + (hazeOff ? '' : ' checked') + '> haze</label>';
    h += '<label style="display:block"><input type="checkbox" data-x="hud"' + (hudOff ? '' : ' checked') + '> HUD</label>';
    h += '<div>density <span data-d>' + [0.5, 0.75, 1, 1.5, 2].map(function (d) { return '<button data-d="' + d + '" style="margin:1px;' + (LY.dpr === d ? 'background:#6fd6ff' : '') + '">' + d + '</button>'; }).join('') + '<button data-d="auto" style="margin:1px;' + (LY.dpr == null ? 'background:#6fd6ff' : '') + '">auto</button></span></div>';
    h += '<div style="margin-top:6px"><button data-all="off">all off</button> <button data-all="on">all on</button> <button data-copy>copy line</button></div>';
    h += '<div style="opacity:.6;margin-top:4px">L hides this panel</div>';
    panel.innerHTML = h;
  }
  panel.addEventListener('change', function (e) { var t = e.target; if (t.dataset.l) off[t.dataset.l] = !t.checked; if (t.dataset.x === 'plain') plain = t.checked; if (t.dataset.x === 'shadows') shadowsOff = !t.checked; if (t.dataset.x === 'haze') hazeOff = !t.checked; if (t.dataset.x === 'hud') hudOff = !t.checked; apply(); frames = []; draw(); });
  panel.addEventListener('click', function (e) { var t = e.target;
    if (t.dataset.d) { LY.dpr = t.dataset.d === 'auto' ? null : +t.dataset.d; window.dispatchEvent(new Event('resize')); frames = []; draw(); }
    if (t.dataset.all) { NAMES.forEach(function (n) { off[n] = t.dataset.all === 'off'; }); apply(); frames = []; draw(); }
    if (t.dataset.copy !== undefined) { var line = line_(); try { navigator.clipboard.writeText(line); } catch (x) {} console.log(line); t.textContent = 'copied'; }
    e.stopPropagation(); });
  panel.addEventListener('mousedown', function (e) { e.stopPropagation(); });
  window.addEventListener('keydown', function (e) { if (e.key === 'l' || e.key === 'L') panel.style.display = panel.style.display === 'none' ? '' : 'none'; });
  function line_() { return readout + ' | on: ' + NAMES.filter(function (n) { return !off[n]; }).join(', ') + (plain ? ' | ground plain' : '') + (shadowsOff ? ' | shadows off' : '') + (hazeOff ? ' | haze off' : '') + (hudOff ? ' | hud off' : '') + ' | density ' + (LY.dpr == null ? 'auto ' + (window.__mojBudget ? window.__mojBudget.dpr : '?') : LY.dpr) + ' | ' + innerWidth + 'x' + innerHeight; }
  // the frame readout: its own loop, one entry a frame, over the last two seconds
  (function tick() { requestAnimationFrame(tick); var t = performance.now(); frames.push(t); while (frames.length > 2 && t - frames[1] > 2000) frames.shift();
    if (hazeOff) { var s = scene(); if (s && s.fog && 'density' in s.fog) s.fog.density = 0; }
    if (frames.length >= 2) { var ms = (frames[frames.length - 1] - frames[0]) / (frames.length - 1); var txt = (1000 / ms).toFixed(0) + ' fps · ' + ms.toFixed(1) + ' ms'; if (txt !== readout) { readout = txt; var d = panel.querySelector('div'); if (d) d.textContent = readout; } } })();
  setInterval(function () { reread(); draw(); }, 2000);
  setTimeout(function () { reread(); draw(); }, 500);
})();</script>`;

let html = fs.readFileSync(src, 'utf8');
const head = html.indexOf('<head>');
html = head >= 0 ? html.slice(0, head + 6) + PROBE + html.slice(head + 6) : PROBE + html;
const end = html.lastIndexOf('</body>');
html = end >= 0 ? html.slice(0, end) + PANEL + html.slice(end) : html + PANEL;
fs.writeFileSync(out, html);
console.log(`layers: ${path.basename(out)} (${(html.length / 1e6).toFixed(1)} MB): a panel at the left, L hides it`);
