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
    expect(bad.tour_refused).toMatch(/names no camera 'nowhere' \(this world's: angle, side, top\).*update_sketch set \/tour/);
    expect(SketchRepository.getByRef(bad.ref).manifest.tour).toBeUndefined();
  });
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
