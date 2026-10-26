import { describe, expect, it } from 'vitest';

import { EMIT_FIXTURES } from '../emit-fixtures.js';
import { emitThreeWorld } from '../scene-three.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { titleFontsFound } from '../../game/title-carve.js';
import { titleHex } from './title-channel.js';
import { resolvePlayUi } from '../../playscape/ui/direction.js';

// ── the title layer (title-channel.js): a HUD banner `as: 'title'` as carved 3D letters on the page ──
// The concept: a world with a title the host can carve gets the title block (the atlas as its own constant, not the
// bus's EVENTS), parsing standalone; a world without one is untouched; a title the host cannot carve stays a banner
// and says why; the layer runs on the frame clock from the firing, the same frame twice. The run's geometry needs a
// face the host can parse, so the carving cases run only where one is found (the fallback case runs everywhere).

const fixture = (name) => EMIT_FIXTURES.find(([n]) => n === name)[1];
const pageScripts = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*importmap)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const world = (events, extra = {}) => ({ manifest: { kind: 'orbit-view', scenario: 'circular', events, ...extra }, title: 'test' });
const live = { reactions: [{ on: 'x', do: 'emit', type: 'y' }], vars: { round: 1 } };
const hasFont = titleFontsFound().length > 0;

describe('title-channel — the colour the letters are baked in', () => {
  it('a hex passes (expanded to six digits), a semantic name and a token resolve, nothing ⇒ the accent', () => {
    expect(titleHex('#F0A', {})).toBe('#ff00aa');
    expect(titleHex('#12345678', {})).toBe('#123456');
    expect(titleHex('harm', {})).toBe('#ff5a4d');
    expect(titleHex('accent', { accent: '#5fe6d6' })).toBe('#5fe6d6');
    expect(titleHex(undefined, { accent: '#5fe6d6' })).toBe('#5fe6d6');
    expect(titleHex('accent2', {})).toBe('#e8b96a');
  });
});

describe('world-scene — the title gate', () => {
  it('a title in a shaped script stays a banner and the events say why; nothing carved ⇒ no atlas', async () => {
    const out = await resolveWorldScene(world({ ...live, hud: [{ on: 'fight', text: 'قاتل!', as: 'title' }, { on: 'y', text: 'HIT' }] }));
    expect(out.payload.events.hud[0]).toMatchObject({ on: 'fight', text: 'قاتل!', as: 'banner' });
    expect(out.payload.events.hud[1]).toEqual({ on: 'y', text: 'HIT' });
    expect(out.payload.events.titlesFallback).toEqual([{ on: 'fight', text: 'قاتل!', reason: 'shaped-script:arabic' }]);
    expect(out.payload.events.titles).toBeUndefined();
    const html = emitThreeWorld(out.payload);
    expect(html).not.toContain('const __TT = ');
    expect(html).toContain('"kind":"banner","on":"fight"');   // the DOM spells it
  });

  it('a row\'s text may name a word in the world\'s language; a bad locale or key teaches', async () => {
    const out = await resolveWorldScene(world({ ...live, hud: [{ on: 'f', text: '@fight' }, { on: 'r', text: '@round', as: 'toast' }] }, { locale: 'ja' }));
    expect(out.payload.events.hud.map((r) => r.text)).toEqual(['ファイト！', 'ラウンド {round}']);
    const en = await resolveWorldScene(world({ ...live, hud: [{ on: 'f', text: '@fight' }] }));
    expect(en.payload.events.hud[0].text).toBe('Fight!');
    await expect(resolveWorldScene(world({ ...live, hud: [{ on: 'f', text: '@fight' }] }, { locale: 'xx' }))).rejects.toThrow(/locale 'xx' is not a shipped language/);
    await expect(resolveWorldScene(world({ ...live, hud: [{ on: 'f', text: '@winning' }] }))).rejects.toThrow(/names no title word/);
    // a world without a word reference never reads its locale
    const plain = await resolveWorldScene(world({ ...live, hud: [{ on: 'f', text: 'GO' }] }, { locale: 'xx' }));
    expect(plain.payload.events.hud[0].text).toBe('GO');
  });

  it('a bad look or style on a title row fails the gate with the closed words', async () => {
    await expect(resolveWorldScene(world({ ...live, hud: [{ on: 'f', text: 'GO', as: 'title', look: 'explode' }] }))).rejects.toThrow(/look must be one of: slam, rise, stamp, fade, slide/);
    await expect(resolveWorldScene(world({ ...live, hud: [{ on: 'f', text: 'GO', as: 'title', style: 'comic' }] }))).rejects.toThrow(/style must be one of: heavy, blocky, slick, thin, italic/);
    await expect(resolveWorldScene(world({ ...live, hud: [{ on: 'f', text: 'GO', as: 'title', material: 'plasma' }] }))).rejects.toThrow(/material must name a metal \(chrome, gold/);
  });

  it('a world without a title row carries no title bytes (the events-hud fixture)', () => {
    const html = emitThreeWorld(fixture('events-hud'));
    expect(html).not.toContain('__hudTitles');
    expect(html).not.toContain('const __TT');
    expect(html).not.toContain('__ttStep');
  });
});

describe.runIf(hasFont)('the title layer on the page (a face found on this host)', () => {
  const titled = async (extra = {}, rows = null) => (await resolveWorldScene(world({
    ...live,
    hud: rows || [
      { on: 'round-start', text: 'ROUND {round}', as: 'title', style: 'blocky' },
      { on: 'fight', text: 'FIGHT!', as: 'title', look: 'stamp', color: 'harm' },
      { on: 'clear', text: 'CLEAR', as: 'title', look: 'rise', slot: 'top' },
      { on: 'y', text: 'HIT' },
    ],
  }, extra))).payload;

  it('the atlas rides the title block, not the bus\'s EVENTS; the block parses standalone; the register picks the look', async () => {
    const out = await titled();
    expect(Object.keys(out.events.titles.styles).sort()).toEqual(['blocky', 'heavy']);
    expect(out.events.titlesFallback).toBeUndefined();
    const html = emitThreeWorld(out);
    expect(html).toContain('const __TT = {"styles":');
    expect(html).toContain('const __TT_CEL = true');
    expect(html).toContain('const __hudTitles = [];');
    expect(html).toContain('__ttFire(tt, __hudSubst(tt.w.text), t)');
    expect(html).toContain('__ttStep(t || 0);');
    const events = JSON.parse(html.match(/\nconst EVENTS = (\{[\s\S]*?\});\n/)[1]);
    expect(events.titles).toBeUndefined();
    expect(events.hud.filter((r) => r.as === 'title').length).toBe(3);
    const widgets = JSON.parse(html.match(/const __HUD = (\[[\s\S]*?\]);\n/)[1]);
    expect(widgets.filter((w) => w.kind === 'title').map((w) => [w.on, w.theme, w.look, w.style, w.hex, w.ttl, w.caps, w.edge])).toEqual([
      ['round-start', 'arcade', 'slam', 'blocky', '#5fb0ff', 1.8, true, 'both'], ['fight', 'arcade', 'stamp', 'heavy', '#ff5a4d', 1.8, true, 'both'], ['clear', 'arcade', 'rise', 'heavy', '#5fb0ff', 1.8, true, 'both'],
    ]);   // no juice floor ⇒ the arcade announcer; a row's own look, style and colour win over the theme's
    for (const src of pageScripts(html)) if (src.trim()) expect(() => new Function(src.replace(/^\s*import[^\n]*\n/gm, ''))).not.toThrow();
    // the composed floor's western register bakes the metal look
    const west = emitThreeWorld(await titled({ fxStyle: { register: 'western' } }));
    expect(west).toContain('const __TT_CEL = false');
  });

  // ── the layer at runtime: the emitted HUD + title block against DOM and THREE stubs, driven by frames ──
  class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; } setScalar(s) { return this.set(s, s, s); } multiplyScalar(k) { this.x *= k; this.y *= k; this.z *= k; return this; } }
  class Obj { constructor() { this.position = new V3(); this.scale = new V3(1, 1, 1); this.rotation = new V3(); this.quaternion = { copy() { return this; } }; this.children = []; this.visible = true; } add(o) { this.children.push(o); return this; } remove(o) { this.children = this.children.filter((c) => c !== o); return this; } }
  class Mat { constructor(o = {}) { Object.assign(this, { opacity: 1, rotation: 0 }, o); this.disposed = false; } dispose() { this.disposed = true; } }
  class Geo { setAttribute(k, a) { this[k] = a; } dispose() {} }
  const THREE = {
    Group: Obj, Mesh: class extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } }, Sprite: class extends Obj { constructor(m) { super(); this.material = m; } },
    BufferGeometry: Geo, BufferAttribute: class { constructor(a, n) { this.array = a; this.itemSize = n; } }, RingGeometry: class extends Geo {},
    MeshBasicMaterial: class extends Mat { constructor(o) { super(o); this.userData = {}; } }, SpriteMaterial: Mat, Color: class { constructor(c) { this.c = c; } }, BackSide: 1, DoubleSide: 2, AdditiveBlending: 3,
    CanvasTexture: class { constructor(c) { this.image = c; } }, SRGBColorSpace: 'srgb', LinearFilter: 6, ClampToEdgeWrapping: 7,
  };
  const dom = () => {
    const mk = (tag) => {
      const el = { tag, children: [], style: {}, cls: new Set(), textContent: '', get className() { return [...this.cls].join(' '); }, set className(v) { this.cls = new Set(v.split(' ').filter(Boolean)); }, appendChild(c) { el.children.push(c); return c; }, remove() {} };
      el.classList = { add: (c) => el.cls.add(c), remove: (c) => el.cls.delete(c), contains: (c) => el.cls.has(c) };
      if (tag === 'canvas') {   // a metal's sweep is drawn once into a two-column texture: record what was drawn
        el.drawn = [];
        el.getContext = () => ({ createLinearGradient: () => ({ stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }), fillRect(...r) { el.drawn.push([this.fillStyle, r]); }, fillStyle: null });
      }
      return el;
    };
    return { document: { head: mk('head'), createElement: mk }, wrap: mk('wrap') };
  };
  const mount = async (extra = {}, rows = null) => {
    const html = emitThreeWorld(await titled(extra, rows));
    const a = html.indexOf('// HUD: the screen-space widget layer'), b = html.indexOf('\n// Read-only projection of bus ENTITY state', a);
    const { document, wrap } = dom();
    const bus = { vars: { round: 1 }, log: [] };
    const scene = new Obj(), camera = { position: new V3(0, 0, 5), quaternion: { copy() { return this; } }, fov: 50, aspect: 1.6 };
    const window = { __mojGlyphs: { spark: { tex: {} }, streak: { tex: {}, stretch: true }, dot: { tex: {} } } };   // the sprite textures are made once per page; here they are given
    const h = new Function('document', 'wrap', '__busState', 'THREE', 'scene', 'camera', 'window', html.slice(a, b) + '\nreturn { sync: __syncHud, titles: () => __hudTitles, flash: () => __ttFlash, rig: () => __ttRig, layout: __ttLayout };')(document, wrap, bus, THREE, scene, camera, window);
    return { ...h, bus, scene };
  };
  const run = (h, on) => h.titles().find((tt) => tt.w.on === on).run;

  it('fires on its event with the bus var filled, lays the letters out from the atlas, and leaves after ttl', async () => {
    const h = await mount();
    h.sync(0, []);
    expect(h.scene.children.length).toBe(1);   // the rig, once
    expect(h.titles().map((tt) => tt.w.on)).toEqual(['round-start', 'fight', 'clear']);
    expect(h.titles().every((tt) => tt.run === null)).toBe(true);
    h.bus.vars.round = 2; h.bus.log.push({ type: 'round-start' }); h.sync(1000, []);
    const r = run(h, 'round-start');
    expect(r).toBeTruthy(); expect(r.t0).toBe(1000);
    expect(r.letters.map((L) => L.m.geometry)).toHaveLength(6);   // R O U N D 2 — the space is laid, not drawn
    expect(h.layout('blocky', 'ROUND 2').letters.map((l) => l.ch).join('')).toBe('ROUND2');
    expect(h.layout('blocky', 'ROUND 2').width).toBeGreaterThan(5);
    expect(h.layout('blocky', 'R#').letters.map((l) => l.ch)).toEqual(['R']);   // a character the atlas lacks is a space
    expect(r.letters[0].m.geometry.color.array.length).toBe(r.letters[0].m.geometry.position.array.length);   // colour baked per vertex
    expect(run(h, 'fight')).toBeNull();   // another title's event did not fire this one
    h.sync(1000 + 1800, []);
    expect(run(h, 'round-start')).toBeNull();   // ttl 1.8 s: gone, its materials disposed
    expect(r.letters[0].m.material.disposed).toBe(true);
    expect(h.rig().children).toEqual([]);
  });

  it('a material dresses the letters: a metal reflects its sweep from a map by height, a finish shades by its shelf row, glass stays glass through the fade', async () => {
    const rows = [
      { on: 'ko', text: 'KO', as: 'title', material: 'chrome', edge: 'glow' },
      { on: 'win', text: 'WIN', as: 'title', material: 'marble' },
      { on: 'ice', text: 'ICE', as: 'title', material: 'glass', look: 'fade', color: '#88ccff' },
      { on: 'go', text: 'GO', as: 'title', look: 'fade' },
    ];
    const out = await titled({}, rows);
    const html = emitThreeWorld(out);
    const widgets = JSON.parse(html.match(/const __HUD = (\[[\s\S]*?\]);\n/)[1]).filter((w) => w.kind === 'title');
    expect(widgets.map((w) => [w.material, w.mat ? (w.mat.metal || 'shade') : null])).toEqual([['chrome', 'chrome'], ['stone', 'shade'], ['glass', 'shade'], [undefined, null]]);
    expect(widgets[1].hex).toBe('#8d8f93');   // a finish without a colour of its own wears its shelf row's
    expect(widgets[2].hex).toBe('#88ccff');   // the row's own colour wins
    expect(new Set(widgets[0].mat.stops.map(([, h]) => h)).size).toBe(3);   // no floor ⇒ the anime register: cel metal, three bands
    for (const src of pageScripts(html)) if (src.trim()) expect(() => new Function(src.replace(/^\s*import[^\n]*\n/gm, ''))).not.toThrow();
    // a world whose titles name no material carries none of its code
    expect(emitThreeWorld(await titled())).not.toContain('__ttMatGeometry');
    expect(html).toContain('__ttMatGeometry');

    const h = await mount({}, rows);
    h.sync(0, []); h.bus.log.push({ type: 'ko' }, { type: 'win' }, { type: 'ice' }, { type: 'go' }); h.sync(0, []);
    const ko = run(h, 'ko').letters[0].m, win = run(h, 'win').letters[0].m, ice = run(h, 'ice').letters[0].m, go = run(h, 'go').letters[0].m;
    // the metal: a map whose first column is the sweep and second white; every vertex has a uv, v its height in the line
    expect(ko.material.map.image.drawn.map(([, r]) => r)).toEqual([[0, 0, 1, 128], [1, 0, 1, 128]]);
    expect(ko.material.map.colorSpace).toBe('srgb');
    const uv = ko.geometry.uv.array, pos = ko.geometry.position.array;
    expect(uv.length / 2).toBe(pos.length / 3);
    const us = new Set(); for (let i = 0; i < uv.length; i += 2) { us.add(uv[i]); expect(uv[i + 1]).toBe(pos[(i / 2) * 3 + 1]); }
    expect([...us].sort()).toEqual([0.25, 0.75]);   // the face and the bevel take the sweep; the walls take the white column
    expect(run(h, 'ko').letters[0].glow).toBeTruthy();   // the edge still stands behind the metal
    // the finish and the plain title: no map, colours per vertex
    expect(win.material.map).toBeUndefined(); expect(win.geometry.uv).toBeUndefined();
    expect(go.material.map).toBeUndefined(); expect(go.geometry.uv).toBeUndefined();
    // the same letter in the same material twice is one geometry; a different material is another
    expect(h.layout('heavy', 'KO').letters).toHaveLength(2);
    // glass keeps its opacity through the entrance: half of what the same fade gives a plain letter, mid-fade and settled
    h.sync(150, []);
    expect(go.material.opacity).toBeGreaterThan(0.05); expect(go.material.opacity).toBeLessThan(0.95);
    expect(ice.material.opacity).toBeCloseTo(0.5 * go.material.opacity, 5);
    h.sync(1200, []);
    expect(ice.material.opacity).toBeCloseTo(0.5 * go.material.opacity, 5);
  });

  it('slam: oversized at first, then its size, a flash and sparks on landing, growing out at the end; the same frame twice', async () => {
    const h = await mount();
    h.sync(0, []); h.bus.log.push({ type: 'round-start' }); h.sync(0, []);
    const r = run(h, 'round-start');
    h.sync(20, []); const early = r.grp.scale.x, tiltEarly = r.grp.rotation.z, xEarly = r.grp.position.x;
    h.sync(600, []); const settled = r.grp.scale.x;
    expect(early).toBeGreaterThan(settled * 1.5);
    expect(r.grp.rotation.z).toBe(0); expect(Math.abs(tiltEarly)).toBeGreaterThan(0);
    h.sync(260, []);
    expect(Number(h.flash().style.opacity)).toBeGreaterThan(0.3);   // the landing's flash, decaying
    expect(r.sparks.filter((q) => q.s.visible).length).toBe(14);
    expect(r.ring).toBeNull();   // the arcade theme throws no halo (the cel theme does)
    h.sync(1000, []);
    expect(Number(h.flash().style.opacity)).toBe(0);
    expect(r.sparks.some((q) => q.s.visible)).toBe(false);
    h.sync(1700, []);
    expect(r.grp.scale.x).toBeGreaterThan(settled); expect(r.letters[0].m.material.opacity).toBeLessThan(0.5);   // leaving: growing, fading
    // deterministic: a second page stepped the same way draws the same frame
    const h2 = await mount();
    h2.sync(0, []); h2.bus.log.push({ type: 'round-start' }); h2.sync(0, []); h2.sync(20, []);
    const r2 = run(h2, 'round-start');
    expect([r2.grp.scale.x, r2.grp.rotation.z, r2.grp.position.x]).toEqual([early, tiltEarly, xEarly]);
  });

  it('rise: the letters come up in turn (no flash, no sparks); stamp: punched in from the eye, the letters scatter out', async () => {
    const h = await mount();
    h.sync(0, []); h.bus.log.push({ type: 'clear' }); h.sync(0, []);
    const c = run(h, 'clear');
    expect(c.sparks).toEqual([]); expect(c.ring).toBeNull();
    h.sync(90, []);
    expect(c.letters[0].lg.position.y).toBeGreaterThan(c.letters[3].lg.position.y);   // the first letter is further up than the fourth
    expect(c.letters[0].lg.scale.y).toBeGreaterThan(1);   // stretched while rising
    expect(c.grp.position.y).toBeGreaterThan(0);   // slot top
    expect(Number(h.flash().style.opacity)).toBe(0);
    h.sync(600, []);
    for (const L of c.letters) { expect(L.lg.position.y).toBeCloseTo(0, 5); expect(L.lg.scale.y).toBeCloseTo(1, 5); }
    h.bus.log.push({ type: 'fight' }); h.sync(600, []);
    const f = run(h, 'fight');
    h.sync(640, []);
    expect(f.grp.position.z).toBeGreaterThan(-1);   // nearer the eye than its place at -1
    h.sync(900, []);
    expect(f.grp.position.z).toBeCloseTo(-1, 5);
    expect(f.letters[0].hull.material.color).toBe('#290e0c');   // the ink hull in the title's dark (harm)
    expect(f.letters[0].shadow.material.color).toBe('#290e0c');   // and the arcade theme's drop copy
    h.sync(600 + 1750, []);
    const xs = f.letters.map((L) => L.lg.position.x);
    expect(new Set(xs.map((x) => Math.round(x * 100))).size).toBeGreaterThan(1);   // scattering on their own lines
    expect(f.letters.some((L) => Math.abs(L.lg.rotation.z) > 0.1)).toBe(true);
  });

  it('the theme a game implies: its juice floor\'s register and game type, written onto the row; a named theme wins', async () => {
    const rows = [{ on: 'go', text: 'go', as: 'title' }, { on: 'win', text: 'win', as: 'title', theme: 'pixel' }];
    const cartoon = await titled({ fxStyle: { register: 'anime', flavor: 'platformer' } }, rows);
    expect(cartoon.events.hud.map((r) => r.theme)).toEqual(['cartoon', 'pixel']);
    const w = JSON.parse(emitThreeWorld(cartoon).match(/const __HUD = (\[[\s\S]*?\]);\n/)[1]);
    expect(w[0]).toMatchObject({ theme: 'cartoon', look: 'rise', style: 'heavy', caps: false, edge: 'ink', hex: '#ffd700', ttl: 2 });
    expect(w[1]).toMatchObject({ theme: 'pixel', look: 'rise', style: 'blocky', caps: true, flash: 0, sparks: false });
    expect(Object.keys(cartoon.events.titles.styles).sort()).toEqual(['blocky', 'heavy']);
    expect(cartoon.events.titles.styles.blocky.glyphs.W).toBeTruthy();   // the pixel theme's capitals carved
    expect(cartoon.events.titles.styles.heavy.glyphs.g).toBeTruthy();    // the cartoon theme's mixed case kept
    const cinematic = await titled({ fxStyle: { register: 'western', flavor: 'realistic' } }, [rows[0]]);
    expect(cinematic.events.hud[0].theme).toBe('cinematic');
    expect(JSON.parse(emitThreeWorld(cinematic).match(/const __HUD = (\[[\s\S]*?\]);\n/)[1])[0]).toMatchObject({ look: 'fade', style: 'thin', edge: 'none', hex: '#ffffff', ttl: 2.8, scale: 0.5 });
    await expect(titled({}, [{ on: 'go', text: 'go', as: 'title', theme: 'baroque' }])).rejects.toThrow(/theme must be one of: arcade, pixel, cel, cartoon, cinematic, speed/);
  });

  it('a settled play direction dresses the title rows through its register: the carve, the edge, the entrance, its tempo and steps', async () => {
    const m = resolvePlayUi({ kind: 'orbit-view', scenario: 'circular', title: 'test', events: { ...live }, play: { ui: { register: 'console', seed: 3 }, phases: ['playing'], parts: [{ part: 'banner', bind: { on: 'cue:win' }, text: 'GO', as: 'title' }] } }, () => 11);
    m.play.ui.status = Object.fromEntries(Object.keys(m.play.ui.status).map((k) => [k, 'approved']));
    const out = (await resolveWorldScene({ manifest: m, title: 'test' })).payload;
    expect(out.events.register).toMatchObject({ type: 'display', frame: 'bevel', motion: 'stepped' });
    const html = emitThreeWorld(out);
    const w = JSON.parse(html.match(/const __HUD = (\[[\s\S]*?\]);\n/)[1]).find((x) => x.kind === 'title');
    expect(w).toMatchObject({ style: 'heavy', edge: 'both', look: 'rise', caps: true, tempo: 0.55, steps: 3 });
    expect(html).toContain('const held = (k) =>');
    // the greybox while the direction is still proposed: the words stand, in the greybox tokens, with the theme's own dials
    const g = resolvePlayUi({ kind: 'orbit-view', scenario: 'circular', title: 'test', events: { ...live }, play: { ui: { register: 'console', seed: 3 }, phases: ['playing'], parts: [{ part: 'banner', bind: { on: 'cue:win' }, text: 'GO', as: 'title' }] } }, () => 11);
    const grey = (await resolveWorldScene({ manifest: g, title: 'test' })).payload;
    expect(grey.events.register).toBeUndefined();
    const gw = JSON.parse(emitThreeWorld(grey).match(/const __HUD = (\[[\s\S]*?\]);\n/)[1]).find((x) => x.kind === 'title');
    expect(gw).toMatchObject({ style: 'heavy', edge: 'both', look: 'slam', hex: '#d9d9d9', tempo: 1, steps: 0 });
  });

  it('fade comes in slowly with nothing else; slide comes in from the right, stretched, with streaks, and leaves to the left', async () => {
    const h = await mount({}, [{ on: 'go', text: 'GO', as: 'title', theme: 'cinematic' }, { on: 'lap', text: 'LAP', as: 'title', theme: 'speed' }]);
    h.sync(0, []); h.bus.log.push({ type: 'go' }); h.sync(0, []);
    const g = run(h, 'go');
    expect(g.sparks).toEqual([]); expect(g.ring).toBeNull(); expect(g.letters[0].hull).toBeNull(); expect(g.letters[0].shadow).toBeNull();
    h.sync(100, []);
    expect(g.letters[0].m.material.opacity).toBeGreaterThan(0); expect(g.letters[0].m.material.opacity).toBeLessThan(0.5);
    expect(Number(h.flash().style.opacity)).toBe(0);
    h.sync(800, []);
    expect(g.letters[0].m.material.opacity).toBeCloseTo(1, 5);
    h.bus.log.push({ type: 'lap' }); h.sync(800, []);
    const l = run(h, 'lap');
    expect(l.sparks.length).toBe(14); expect(l.sparks.every((q) => q.stretch)).toBe(true); expect(l.letters[0].shadow).toBeTruthy(); expect(l.letters[0].hull).toBeNull();
    h.sync(830, []);
    expect(l.grp.position.x).toBeGreaterThan(0.1);   // still coming in from the right
    expect(l.letters[0].lg.scale.x).toBeGreaterThan(1.2);   // stretched along its flight
    h.sync(1200, []);
    expect(l.grp.position.x).toBeCloseTo(0, 2); expect(l.letters[0].lg.scale.x).toBeCloseTo(1, 5);
    h.sync(800 + 1450, []);
    expect(l.grp.position.x).toBeLessThan(-0.05);   // leaving to the left
  });
});
