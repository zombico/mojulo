// Isolate to an in-memory SQLite — must run before any import that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { VIEW_KINDS, createViewHandler } from './create-view.js';
import { createExhibitHandler, getExhibitHandler, exhibitCards } from './create-exhibit.js';
import { HALL_IDS, splitExhibitId } from '@/lib/graph/exhibit/halls';
import { HISTORIC_CULTURES } from '@/lib/graph/historic/historic-city';

beforeEach(() => {
  closeDb();
});

describe('the exhibit ids', () => {
  it('give every listed study kind one hall id and a folded kind none', () => {
    const byCard = new Map([...exhibitCards()].map(([xid, c]) => [c.id, xid]));
    for (const [kind, k] of Object.entries(VIEW_KINDS)) {
      if (k.listed === false) expect(byCard.has(kind), `${kind} is folded`).toBe(false);
      else expect(HALL_IDS).toContain(splitExhibitId(byCard.get(kind)).hall);
    }
  });
});

describe('create_exhibit', () => {
  it('mints a study kind through the handler create_view used, by hall id or bare id, to the same recipe', async () => {
    const a = await createExhibitHandler({ id: 'science/fission', title: 't' });
    const b = await createExhibitHandler({ id: 'fission', title: 't' });
    const c = await createViewHandler({ kind: 'fission', title: 't' });
    expect(a.exhibit).toBe('science/fission');
    expect(b.exhibit).toBe('science/fission');
    expect(a.recipe).toEqual(c.recipe);
    expect(b.recipe).toEqual(c.recipe);
  });

  it('teaches a misfiled hall and an unknown id', async () => {
    await expect(createExhibitHandler({ id: 'science/galaxy' })).rejects.toThrow(/create_exhibit: 'galaxy' is in the space hall/);
    await expect(createExhibitHandler({ id: 'earth/nope' })).rejects.toThrow(/no exhibit 'nope' in the earth hall.*earth\/hydro/);
  });

  it('mints a history culture as the historic manifest create_sketch took, and refuses to make a hub', async () => {
    const culture = Object.keys(HISTORIC_CULTURES)[0];
    const res = await createExhibitHandler({ id: `history/${culture}`, params: { seed: 3 } });
    expect(res.ok).toBe(true);
    expect(res.exhibit).toBe(`history/${culture}`);
    expect(res.guideUrl).toMatch(/\/bible$/);
    const record = [...exhibitCards().keys()].find((x) => x.endsWith('/record'));
    await expect(createExhibitHandler({ id: record })).rejects.toThrow(/is read, not made.*history\//);
  });
});

describe('create_exhibit with a tour', () => {
  it('sets the tour through update_sketch\'s gate; a refused tour leaves the exhibit made and says why', async () => {
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const ok = await createExhibitHandler({ id: 'life/cellular', tour: { stops: [{ caption: 'The cell.', camera: 'angle' }, { caption: 'Power.', camera: 'top', highlight: 'org:mitochondria' }] } });
    expect(ok.tour).toEqual({ stops: 2 });
    expect(SketchRepository.getByRef(ok.ref).manifest.tour.stops).toHaveLength(2);
    const bad = await createExhibitHandler({ id: 'life/cellular', tour: { stops: [{ caption: 'x', camera: 'nowhere' }] } });
    expect(bad.ok).toBe(true);
    expect(bad.tour_refused).toMatch(/names no camera 'nowhere' \(this world's: angle, side, top\).*update_sketch \(set \/curation, set \/tour\)/);
    expect(SketchRepository.getByRef(bad.ref).manifest.tour).toBeUndefined();
  });
});

describe('create_exhibit with a brief (its curation)', () => {
  it('sets the brief with the tour, audits it, points at its catalogue, and reads the expert\'s sign-off as it stands', async () => {
    const { updateSketchHandler } = await import('./sketch-mint.js');
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const brief = { aims: ['Mitochondria power the cell.'], claims: [{ id: 'atp', text: 'Mitochondria make most of the ATP.', cite: 'Alberts ch. 14', grade: 'depicted' }], expert: { name: 'Dr. Rivera' } };
    const r = await createExhibitHandler({ id: 'life/cellular', curation: brief, tour: { stops: [{ caption: 'Power.', camera: 'top', claims: ['atp'], highlight: 'org:mitochondria' }] } });
    expect(r.catalogue).toBe(`/api/sketches/${r.ref}/bible?book=exhibit`);
    expect(r.audit.accuracy).toMatchObject({ state: 'unsigned' });
    expect(r.audit.tour).toMatchObject({ graded: 1, cited: 1 });
    // recorded only when the operator says the expert signed: stamped at write with the claims as they stand
    await updateSketchHandler({ ref: r.ref, patch: [{ op: 'set', path: '/curation/signoff', value: { by: 'Dr. Rivera', on: '2026-11-10', claims: 'all' } }] });
    expect(SketchRepository.getByRef(r.ref).manifest.curation.signoff.claims).toEqual([{ id: 'atp', text: 'Mitochondria make most of the ATP.' }]);
    expect((await getExhibitHandler({ ref: r.ref, audit: true })).audit.accuracy).toMatchObject({ state: 'signed', by: 'Dr. Rivera' });
    // a tour that states a claim the brief does not have is refused, and the exhibit is still made
    const bad = await createExhibitHandler({ id: 'life/cellular', curation: brief, tour: { stops: [{ caption: 'x', camera: 'top', claims: ['nope'] }] } });
    expect(bad.tour_refused).toMatch(/names no claim 'nope'/);
  });
});

describe('a gallery: made exhibits joined as rooms', () => {
  it('is made from refs, audited room by room, refused for a room that is not there, and exported as a folder', async () => {
    const { mkdtempSync, existsSync, readFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(join(tmpdir(), 'gallery-'));
    const cell = await createExhibitHandler({ id: 'life/cellular', tour: { title: 'Inside a cell', stops: [{ caption: 'The cell.', camera: 'angle', grade: 'depicted', highlight: 'cytoplasm' }] } });
    expect(cell.audit).toMatchObject({ gate: 'machine', warnings: 0, tour: { stops: 1, graded: 1, lit: 1 } });
    const g = await createExhibitHandler({ rooms: [cell.ref], title: 'Life', params: { intro: 'One room.', kiosk: true } });
    expect(g).toMatchObject({ ok: true, rooms: 1, gallery: `/api/sketches/${g.ref}/gallery` });
    expect(g.audit.rooms).toEqual([expect.objectContaining({ ref: cell.ref, stops: 1 })]);
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    expect(SketchRepository.getByRef(g.ref).manifest).toEqual({ kind: 'gallery', title: 'Life', intro: 'One room.', kiosk: true, rooms: [cell.ref] });
    await expect(createExhibitHandler({ rooms: ['sk_nope'] })).rejects.toThrow(/rooms\[0\]\.ref names no sketch 'sk_nope'/);
    await expect(createExhibitHandler({ rooms: [cell.ref], id: 'life/dna' })).rejects.toThrow(/pass one of them/);
    await expect(createExhibitHandler({ rooms: [cell.ref], params: { music: 1 } })).rejects.toThrow(/take intro, kiosk and curation, not 'music'/);
    expect((await getExhibitHandler({ ref: g.ref, audit: true })).audit.gate).toBe('machine');
    expect((await getExhibitHandler({ ref: cell.ref, audit: true })).audit.tour.stops).toBe(1);
    const { exportModelHandler } = await import('./sketch-model-export.js');
    const out = await exportModelHandler({ ref: g.ref, format: 'html' });
    expect(out).toMatchObject({ ok: true, kind: 'gallery', files: ['index.html', `rooms/${cell.ref}.html`] });
    expect(readFileSync(join(out.dir, 'index.html'), 'utf8')).toContain(`"src":"rooms/${cell.ref}.html"`);
    expect(readFileSync(join(out.dir, `rooms/${cell.ref}.html`), 'utf8')).toContain('window.__mojTour');
    expect(existsSync(join(out.dir, 'rooms'))).toBe(true);
  }, 120000);
});

describe('narration: the caption spoken', () => {
  it('keeps a WAV given with the tour or added later as a recording, and the page carries its voice', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    const { updateSketchHandler } = await import('./sketch-mint.js');
    const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
    const dir = mkdtempSync(join(tmpdir(), 'voice-'));
    process.env.MOJULO_OUTCOMES_DIR = join(dir, 'outcomes');
    const wav = (name, seconds) => {
      const rate = 24000, n = Math.round(seconds * rate), b = Buffer.alloc(44 + n * 2);
      b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8, 'ascii'); b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16);
      b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
      b.write('data', 36, 'ascii'); b.writeUInt32LE(n * 2, 40);
      for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 20) * 6000), 44 + i * 2);
      const f = join(dir, name); writeFileSync(f, b); return f;
    };
    const r = await createExhibitHandler({ id: 'life/cellular', tour: { stops: [
      { caption: 'A cell is a city in a membrane.', camera: 'angle', narration: wav('one.wav', 2.5) },
      { caption: 'Power.', camera: 'top' }] } });
    expect(r.tour).toEqual({ stops: 2 });
    let m = SketchRepository.getByRef(r.ref).manifest;
    expect(m.tour.stops[0].narration.general).toEqual({ recording: expect.stringMatching(/^[0-9a-f]{16}$/), seconds: 2.5 });
    expect(r.audit.findings.map((f) => f.code)).toContain('unnarrated-stop');
    // added later, by path, through update_sketch: kept as a recording before the world gate reads it
    await updateSketchHandler({ ref: r.ref, patch: [{ op: 'set', path: '/tour/stops/1/narration', value: wav('two.wav', 1) }] });
    m = SketchRepository.getByRef(r.ref).manifest;
    expect(m.tour.stops[1].narration.general.seconds).toBe(1);
    const { payload } = await resolveWorldScene(SketchRepository.getByRef(r.ref));
    expect(payload.tour.narrated).toBe(true);
    expect(payload.tour.stops.map((s) => Object.keys(s.voice || {}))).toEqual([['general'], ['general']]);
    expect((await getExhibitHandler({ ref: r.ref, audit: true })).audit.findings.map((f) => f.code)).not.toContain('unnarrated-stop');
  }, 120000);
});

describe('prepared states: one exhibit at several settings', () => {
  it('makes a state an exhibit under the shared params, one recipe over them, audited, exported, and a gallery room', async () => {
    const { mkdtempSync, readFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { SketchRepository } = await import('@/lib/db/repositories/sketches');
    process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(join(tmpdir(), 'states-'));
    const st = await createExhibitHandler({ id: 'earth/hydro', title: 'Head', params: { scenario: 'dam' }, states: { label: 'Head', of: [
      { label: '30 m', params: { head: 30 }, caption: 'Low.' }, { label: '120 m', params: { head: 120 } }] } });
    expect(st).toMatchObject({ ok: true, exhibit: 'earth/hydro', page: `/api/sketches/${st.ref}/states` });
    const m = SketchRepository.getByRef(st.ref).manifest;
    expect(m).toMatchObject({ kind: 'exhibit-states', title: 'Head', label: 'Head', control: 'toggle' });
    expect(m.states.map((x) => SketchRepository.getByRef(x.ref).manifest)).toEqual([
      expect.objectContaining({ kind: 'hydro-view', scenario: 'dam', head: 30 }), expect.objectContaining({ kind: 'hydro-view', scenario: 'dam', head: 120 })]);
    expect(st.audit.findings.map((f) => `${f.code}:${f.at}`)).toEqual(['no-caption:120 m']);
    expect((await getExhibitHandler({ ref: st.ref, audit: true })).audit.ran).toEqual(['states']);
    await expect(createExhibitHandler({ id: 'earth/hydro', states: { of: [{ label: 'only' }] } })).rejects.toThrow(/two states or more/);
    const { exportModelHandler } = await import('./sketch-model-export.js');
    const out = await exportModelHandler({ ref: st.ref, format: 'html' });
    expect(out.files).toEqual(['index.html', ...m.states.map((x) => `states/${x.ref}.html`)]);
    expect(readFileSync(join(out.dir, `states/${m.states[0].ref}.html`), 'utf8')).toContain('pose-ready');
    const g = await createExhibitHandler({ rooms: [st.ref] });
    expect(g.audit.statesRooms).toEqual([expect.objectContaining({ ref: st.ref, states: 2 })]);
    const gout = await exportModelHandler({ ref: g.ref, format: 'html' });
    expect(gout.files).toEqual(['index.html', `rooms/${st.ref}.html`, ...m.states.map((x) => `rooms/${st.ref}/${x.ref}.html`)]);
    // a host whose page rules refuse an inlined module (an artifact host) gets the cdn form: the same folder, three.js fetched
    const cout = await exportModelHandler({ ref: g.ref, format: 'html', cdn: true });
    expect(cout).toMatchObject({ cdn: true, files: gout.files });
    expect(cout.dir).toMatch(/gallery-cdn$/);
    const framed = readFileSync(join(cout.dir, `rooms/${st.ref}/${m.states[0].ref}.html`), 'utf8');
    expect(framed).toContain('cdn.jsdelivr.net');
    expect(framed).not.toContain('data:text/javascript');
    expect(readFileSync(join(gout.dir, `rooms/${st.ref}/${m.states[0].ref}.html`), 'utf8')).toContain('data:text/javascript');
  }, 180000);
});

describe('get_exhibit', () => {
  it('reads a card by hall id, lists the halls and one hall', async () => {
    const one = await getExhibitHandler({ id: 'earth/hydro' });
    expect(one).toMatchObject({ id: 'earth/hydro', hall: 'earth' });
    expect(one.card.body.length).toBeGreaterThan(0);
    const all = await getExhibitHandler({});
    expect(all.halls.map((h) => h.id)).toEqual(HALL_IDS);
    const math = await getExhibitHandler({ hall: 'math' });
    expect(math.cards.length).toBe(all.halls.find((h) => h.id === 'math').count);
    expect(math.cards.every((r) => r.id.startsWith('math/'))).toBe(true);
    await expect(getExhibitHandler({ hall: 'nope' })).rejects.toThrow(/no hall 'nope'/);
  });

  it('measures a made exhibit by ref in SI, and an unmeasurable one refuses as get_exhibit', async () => {
    const made = await createExhibitHandler({ id: 'science/mechanics', params: { scenario: 'projectile', v0: 18, angle: 55, g: 9.8 } });
    const m = await getExhibitHandler({ ref: made.ref });
    expect(m).toMatchObject({ ok: true, exhibit: 'science/mechanics', kind: 'mechanics-view', tier: 'si' });
    expect(m.series[0].samples.length).toBeGreaterThan(10);
    const shown = await createExhibitHandler({ id: 'science/fission' });
    await expect(getExhibitHandler({ ref: shown.ref })).rejects.toThrow(/^get_exhibit: kind 'fission-view' has no honest read-back/);
    await expect(getExhibitHandler({ ref: 'sk_nope' })).rejects.toThrow(/no exhibit with ref/);
  });
});

describe('the surface', () => {
  it('lists the exhibit doors and the world manual reader; the folded doors answer by name, unlisted', async () => {
    const { ensureToolsRegistered, isToolListed, invokeRegisteredTool } = await import('@/lib/mcp/server');
    await ensureToolsRegistered();
    for (const t of ['create_exhibit', 'get_exhibit', 'get_view_vocab', 'save_recipe']) expect(isToolListed(t), t).toBe(true);
    for (const t of ['create_view', 'measure_view']) expect(isToolListed(t), t).toBe(false);
    const res = await invokeRegisteredTool('create_view', { kind: 'fission', title: 'folded' }, {});
    expect(res.recipe.kind).toBe('fission-view');
  });
});
