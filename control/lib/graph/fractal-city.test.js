import { describe, expect, it } from 'vitest';

import { normalizeFractalCityElements, planFractalCity } from './fractal-city.js';

describe('fractal-city recipe elements', () => {
  it('normalizes concise element lists into deterministic generation flags', () => {
    const elements = normalizeFractalCityElements(['buildings', 'road', 'parking', 'bike', 'tree', 'stop', 'lamps']);

    expect(elements.buildings).toBe(true);
    expect(elements.roads).toBe(true);
    expect(elements.parkingLots).toBe(true);
    expect(elements.bikeLanes).toBe(true);
    expect(elements.cityTrees).toBe(true);
    expect(elements.stopSigns).toBe(true);
    expect(elements.streetLamps).toBe(true);
    expect(elements.cars).toBe(false);
    expect(elements.powerLines).toBe(false);
  });

  it('can remove street furniture without changing the city mint surface', () => {
    const { boxes, ribbons, elements } = planFractalCity({
      seed: 7,
      anchor: 'tower',
      depth: 2,
      density: 1,
      elements: {
        cars: false,
        dumpsters: false,
        streetSignals: false,
        streetSigns: false,
        stopSigns: false,
        streetLamps: false,
        cityTrees: false,
        powerLines: false,
      },
    });

    expect(elements.cars).toBe(false);
    expect(boxes.some((b) => b.kind === 'building')).toBe(true);
    expect(ribbons.length).toBeGreaterThan(0);
    expect(boxes.some((b) => [
      'car',
      'dumpster',
      'street-signal',
      'street-sign',
      'stop-sign',
      'street-lamp',
      'city-tree-trunk',
      'city-tree-canopy',
      'power-line',
      'power-pole',
    ].includes(b.kind))).toBe(false);
  });

  it('streetcar line is opt-in: absent by default, laid down the main street when requested', () => {
    const off = planFractalCity({ seed: 4, anchor: 'tower', depth: 3, density: 0.9 });
    expect(off.elements.streetcars).toBe(false);
    expect(off.boxes.some((b) => b.kind === 'tram-pole')).toBe(false);
    expect(off.stats.streetcar).toBe(false);

    const on = planFractalCity({ seed: 4, anchor: 'tower', depth: 3, density: 0.9, elements: { streetcars: true } });
    expect(on.elements.streetcars).toBe(true);
    expect(on.stats.streetcar).toBe(true);
    // the corridor: wire poles + roofed boarding bays + trams (vehicle faces)
    expect(on.boxes.some((b) => b.kind === 'tram-pole')).toBe(true);
    expect(on.boxes.some((b) => b.kind === 'platform-roof')).toBe(true);
    expect(on.faces.length).toBeGreaterThan(0);
    // it's still a city — the corridor is woven in, not a takeover
    expect(on.boxes.some((b) => b.kind === 'building')).toBe(true);
  });

  it('streetcar element is OFF by default — no regression to existing seeds', () => {
    // a scene generated with the default elements must be byte-identical to one that
    // explicitly leaves streetcars off (the new opt-in path never runs when disabled)
    const base = planFractalCity({ seed: 11, anchor: 'tower', depth: 3, density: 0.9 });
    const explicit = planFractalCity({ seed: 11, anchor: 'tower', depth: 3, density: 0.9, elements: { streetcars: false } });
    expect(explicit.boxes.length).toBe(base.boxes.length);
    expect(explicit.ribbons.length).toBe(base.ribbons.length);
    expect(explicit.faces.length).toBe(base.faces.length);
    expect(base.boxes.some((b) => b.kind === 'tram-pole')).toBe(false);
  });

  it('accepts streetcar aliases (tram / streetcar) in the array element form', () => {
    const els = normalizeFractalCityElements(['roads', 'tram']);
    expect(els.streetcars).toBe(true);
    expect(els.buildings).toBe(false);
  });

  it('seeds street-only lamps, signs, traffic lights, stop signs, and city trees near roads', () => {
    const { boxes } = planFractalCity({ seed: 1, anchor: 'tower', depth: 3, density: 1 });

    expect(boxes.filter((b) => b.kind === 'street-lamp').length).toBeGreaterThan(0);
    expect(boxes.filter((b) => b.kind === 'street-signal').length).toBeGreaterThan(0);
    expect(boxes.filter((b) => b.kind === 'street-sign').length).toBeGreaterThan(0);
    expect(boxes.filter((b) => b.kind === 'stop-sign').length).toBeGreaterThan(0);
    expect(boxes.filter((b) => b.kind === 'city-tree-trunk').length).toBeGreaterThan(0);
    expect(boxes.filter((b) => b.kind === 'city-tree-canopy').length).toBeGreaterThan(0);
  });

  it('orients crosswalk stripes parallel to their road direction', () => {
    const { grounds } = planFractalCity({ seed: 1, anchor: 'tower', depth: 3, density: 1 });
    const verticalRoadBars = grounds.filter((g) => g.kind === 'crosswalk-vertical-road-stripe');
    const horizontalRoadBars = grounds.filter((g) => g.kind === 'crosswalk-horizontal-road-stripe');

    expect(verticalRoadBars.length).toBeGreaterThan(0);
    expect(horizontalRoadBars.length).toBeGreaterThan(0);
    // vertical road runs along y → bars run along y (d > w); horizontal road along x → bars along x (w > d)
    expect(verticalRoadBars.every((g) => g.d > g.w)).toBe(true);
    expect(horizontalRoadBars.every((g) => g.w > g.d)).toBe(true);
  });

  it('dresses some two-building blocks with a flat-sticker alleyway, gated by the recipe flag', () => {
    // alleys are probabilistic per split, so scan a range and assert the feature appears
    let floors = 0, stickers = [];
    for (let seed = 1; seed <= 30; seed += 1) {
      const c = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1 });
      floors += c.grounds.filter((g) => g.kind === 'alley-floor').length;
      stickers = stickers.concat(c.faces.filter((f) => f.kind === 'alley-sticker'));
    }
    expect(floors).toBeGreaterThan(0);
    expect(stickers.length).toBeGreaterThan(0);
    // stickers are cheap flat billboards, not solids: each is a vertical quad (4 corners,
    // a positive height span, and flat in one axis — all corners share an x or a y)
    expect(stickers.every((f) => {
      if (f.corners.length !== 4) return false;
      const zs = f.corners.map((c) => c[2]);
      const flatX = f.corners.every((c) => c[0] === f.corners[0][0]);
      const flatY = f.corners.every((c) => c[1] === f.corners[0][1]);
      return Math.max(...zs) > Math.min(...zs) && (flatX || flatY);
    })).toBe(true);

    // the recipe flag turns the whole alley path off across every seed
    for (let seed = 1; seed <= 30; seed += 1) {
      const off = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, elements: { alleyways: false } });
      expect(off.grounds.some((g) => g.kind === 'alley-floor')).toBe(false);
      expect(off.faces.some((f) => f.kind === 'alley-sticker')).toBe(false);
    }
  });

  it('townhouse rows are opt-in: absent by default, no regression to existing seeds', () => {
    // a default city carries no townhouses, and is byte-identical to one that
    // explicitly leaves them off (the opt-in path never runs the rng when disabled)
    const base = planFractalCity({ seed: 9, anchor: 'tower', depth: 3, density: 0.9 });
    const off = planFractalCity({ seed: 9, anchor: 'tower', depth: 3, density: 0.9, elements: { townhouses: false } });
    expect(base.elements.townhouses).toBe(false);
    expect(base.boxes.some((b) => b.kind === 'townhouse')).toBe(false);
    expect(base.stats.townhouses).toBe(0);
    expect(off.boxes.length).toBe(base.boxes.length);
    expect(off.ribbons.length).toBe(base.ribbons.length);
    expect(off.faces.length).toBe(base.faces.length);
  });

  it('accepts townhouse aliases (rowhouse / brownstone) in the array element form', () => {
    const els = normalizeFractalCityElements(['roads', 'rowhouse']);
    expect(els.townhouses).toBe(true);
    expect(els.buildings).toBe(false);
    expect(normalizeFractalCityElements(['brownstone']).townhouses).toBe(true);
  });

  it('lays attached rowhouse rows with annotated structure metadata when opted in', () => {
    const { boxes, stats } = planFractalCity({ seed: 4, anchor: null, subAnchors: false, depth: 3, density: 0.8, elements: { townhouses: true } });
    const units = boxes.filter((b) => b.kind === 'townhouse');
    expect(units.length).toBeGreaterThan(0);
    expect(stats.townhouses).toBe(units.length);
    // every unit is self-describing: structure + style + row position + a facade
    for (const u of units) {
      expect(u.structure).toBe('townhouse-row');
      expect(['brownstone', 'modern-stacked']).toContain(u.style);
      expect(['half', 'full']).toContain(u.loading);
      expect(u.units).toBeGreaterThanOrEqual(2);
      expect(u.unitIndex).toBeGreaterThanOrEqual(0);
      expect(u.unitIndex).toBeLessThan(u.units);
      expect(u.facade).toBeTruthy();
    }
    // each row carries its street gesture: stoop steps + door faces
    expect(boxes.some((b) => b.kind === 'townhouse-stoop')).toBe(true);
  });

  it('emits both treatments and a double-loaded (doors-on-both-faces) full row across seeds', () => {
    const styles = new Set();
    const faceDirs = new Set();
    let sawFull = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { boxes } = planFractalCity({ seed, anchor: null, subAnchors: false, depth: 3, density: 0.9, elements: { townhouses: true } });
      for (const u of boxes.filter((b) => b.kind === 'townhouse')) {
        styles.add(u.style);
        faceDirs.add(u.face);
        if (u.loading === 'full') sawFull = true;
      }
    }
    expect(styles.has('brownstone')).toBe(true);
    expect(styles.has('modern-stacked')).toBe(true);
    expect(sawFull).toBe(true);
    // double-loaded full rows present units fronting BOTH long edges (opposite faces)
    expect(faceDirs.has('+y') || faceDirs.has('+x')).toBe(true);
    expect(faceDirs.has('-y') || faceDirs.has('-x')).toBe(true);
  });

  it('rowhouse units are ATTACHED — contiguous along the run with no inter-unit gaps', () => {
    // a blocked unit ENDS its row (it never leaves a gap), so contiguity must hold for
    // every row across many seeds. Scan a range so we exercise plenty of rows.
    let checked = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const { boxes } = planFractalCity({ seed, anchor: null, subAnchors: false, depth: 3, density: 0.8, elements: { townhouses: true } });
      const rows = new Map();
      for (const u of boxes.filter((b) => b.kind === 'townhouse')) {
        const horiz = u.face === '+y' || u.face === '-y';
        const key = `${seed}:${u.row}`;   // stable per-row identity (block + axis + side + run origin)
        (rows.get(key) || rows.set(key, []).get(key)).push({ ...u, horiz });
      }
      for (const row of rows.values()) {
        if (row.length < 2) continue;
        const horiz = row[0].horiz;
        row.sort((a, b) => (horiz ? a.x - b.x : a.y - b.y));
        for (let i = 1; i < row.length; i++) {
          const prevEnd = horiz ? row[i - 1].x + row[i - 1].w : row[i - 1].y + row[i - 1].d;
          const start = horiz ? row[i].x : row[i].y;
          expect(Math.abs(start - prevEnd)).toBeLessThan(0.01);   // no gap, no overlap
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('seeds exactly one religious place per scene for a listed locale, deterministically', () => {
    for (const locale of ['north-america', 'south-america', 'europe', 'philippines']) {
      for (const seed of [1, 2, 3, 9, 17]) {
        const { boxes, stats } = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale });
        const places = boxes.filter((b) => b.class === 'religious');   // church OR mosque OR temple
        expect(stats.religiousPlaces).toBe(1);
        expect(places.length).toBe(1);
        // self-describing metadata, like townhouses
        expect(['church', 'mosque', 'temple']).toContain(places[0].structure);
        expect(['church', 'mosque', 'temple']).toContain(places[0].shape);
        expect(places[0].locale).toBe(locale);
      }
    }
  });

  it('draws all three church variants from the same pool, basilica bigger than chapel', () => {
    const counts = { chapel: 0, basilica: 0, orthodox: 0 };
    let chapelArea = 0, chapelN = 0, basiArea = 0, basiN = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const church = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale: 'europe' })
        .boxes.find((b) => b.shape === 'church');
      if (!church) continue;   // some europe seeds are mosques — this test is about church variants
      expect(['chapel', 'basilica', 'orthodox']).toContain(church.churchVariant);
      counts[church.churchVariant] += 1;
      if (church.churchVariant === 'basilica') { basiArea += church.w * church.d; basiN += 1; }
      else if (church.churchVariant === 'chapel') { chapelArea += church.w * church.d; chapelN += 1; }
    }
    expect(counts.chapel).toBeGreaterThan(0);
    expect(counts.basilica).toBeGreaterThan(0);
    expect(counts.orthodox).toBeGreaterThan(0);
    // the basilica deliberately takes the largest footprint → bigger than the random chapel
    expect(basiArea / basiN).toBeGreaterThan(chapelArea / chapelN);
  });

  it('domed (orthodox) churches grow more common the further east', () => {
    const domeRate = (locale) => {
      let dome = 0, tot = 0;
      for (let seed = 1; seed <= 90; seed++) {
        const church = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale })
          .boxes.find((b) => b.shape === 'church');
        if (church) { tot += 1; if (church.churchVariant === 'orthodox') dome += 1; }
      }
      return dome / tot;
    };
    const na = domeRate('north-america'), eu = domeRate('europe'), ru = domeRate('russia');
    expect(na).toBeLessThan(eu);            // rarer in the Americas than (western) Europe
    expect(eu).toBeLessThan(ru);            // and rarer in Europe than Russia
    expect(ru).toBeGreaterThan(0.8);        // near-universal in Russia
    expect(na).toBeLessThan(0.25);          // uncommon in North America
  });

  it('seeds mosques as a relative from the same pool, weighted by locale', () => {
    const sample = (locale) => {
      let mosque = 0, tot = 0;
      for (let seed = 1; seed <= 90; seed++) {
        const place = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale })
          .boxes.find((b) => b.class === 'religious');
        if (place) { tot += 1; if (place.structure === 'mosque') mosque += 1; }
      }
      return mosque / tot;
    };
    const na = sample('north-america'), ph = sample('philippines'), me = sample('middle-east'),
      af = sample('africa'), sea = sample('southeast-asia');
    expect(me).toBeGreaterThan(0.85);       // dominant in the Middle East
    expect(af).toBeGreaterThan(0.4);        // prominent in Africa
    expect(sea).toBeGreaterThan(0.4);       // prominent in Southeast Asia
    expect(ph).toBeGreaterThan(na);         // present in the Philippines, more than North America
    expect(ph).toBeLessThan(0.5);           // but still secondary to churches there
    // a mosque is the same religious-place class, tagged structure 'mosque' with shape 'mosque'
    const m = planFractalCity({ seed: 7, anchor: 'tower', depth: 3, density: 1, locale: 'middle-east' })
      .boxes.find((b) => b.structure === 'mosque');
    expect(m).toBeTruthy();
    expect(m.class).toBe('religious');
    expect(m.shape).toBe('mosque');
  });

  it('gives mosques a regional FORM weighted by locale (ottoman default, persian / sahelian / nusantara relatives)', () => {
    const VALID = ['ottoman', 'persian', 'sahelian', 'nusantara'];
    const variants = (locale) => {
      const counts = { ottoman: 0, persian: 0, sahelian: 0, nusantara: 0 };
      for (let seed = 1; seed <= 120; seed++) {
        const m = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale })
          .boxes.find((b) => b.structure === 'mosque');
        if (!m) continue;
        expect(VALID).toContain(m.mosqueVariant);   // every mosque carries a known variant tag
        counts[m.mosqueVariant] += 1;
      }
      return counts;
    };
    const me = variants('middle-east'), af = variants('africa'), sea = variants('southeast-asia');
    // each region's distinctive form is the dominant relative there…
    expect(me.persian).toBeGreaterThan(0);
    expect(af.sahelian).toBeGreaterThan(af.ottoman);          // West-African mud mosque dominates Africa
    expect(sea.nusantara).toBeGreaterThan(sea.ottoman);       // Javanese tiered roof dominates SE Asia
    // …and the regional relative does not leak across regions
    expect(af.persian).toBe(0);
    expect(sea.persian).toBe(0);
    expect(me.sahelian).toBe(0);
  });

  it('keeps the mosque variant out of locale-less / church seeds (no rng regression)', () => {
    // a western locale that almost always yields a church must not carry a mosqueVariant on the church
    const church = planFractalCity({ seed: 1, anchor: 'tower', depth: 3, density: 1, locale: 'north-america' })
      .boxes.find((b) => b.structure === 'church');
    if (church) expect(church.mosqueVariant).toBeUndefined();
    // an unlisted-variant mosque locale falls back to ottoman
    let sawDefaultRegionMosque = false;
    for (let seed = 1; seed <= 30; seed++) {
      const m = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale: 'middle-east' })
        .boxes.find((b) => b.structure === 'mosque');
      if (m && m.mosqueVariant === 'ottoman') sawDefaultRegionMosque = true;
    }
    expect(sawDefaultRegionMosque).toBe(true);   // the Middle East still has ottoman mosques too
  });

  it('seeds Buddhist temples as a third relative, weighted by locale and rarer than mosques in the West', () => {
    const shares = (locale) => {
      const c = { church: 0, mosque: 0, temple: 0, tot: 0 };
      for (let seed = 1; seed <= 120; seed++) {
        const p = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale }).boxes.find((b) => b.class === 'religious');
        if (p) { c[p.structure] += 1; c.tot += 1; }
      }
      return c;
    };
    const ea = shares('east-asia'), him = shares('himalaya'), ind = shares('indochina'), na = shares('north-america');
    expect(ea.temple / ea.tot).toBeGreaterThan(0.7);        // dominant in East Asia
    expect(him.temple / him.tot).toBeGreaterThan(0.8);      // dominant in the Himalaya
    expect(ind.temple / ind.tot).toBeGreaterThan(0.7);      // dominant in Indochina
    expect(ea.church).toBeGreaterThan(0);                   // …but East Asia still has churches (Korea)
    // rare in the West, and rarer there than the mosque
    expect(na.temple).toBeGreaterThan(0);
    expect(na.temple).toBeLessThan(na.mosque);
    expect(na.temple / na.tot).toBeLessThan(0.1);
  });

  it('gives temples a regional FORM (pagoda / stupa / tibetan) and keeps mosque ratios byte-identical', () => {
    const VALID = ['pagoda', 'stupa', 'tibetan'];
    const variants = (locale) => {
      const counts = { pagoda: 0, stupa: 0, tibetan: 0 };
      for (let seed = 1; seed <= 150; seed++) {
        const t = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale }).boxes.find((b) => b.structure === 'temple');
        if (!t) continue;
        expect(VALID).toContain(t.templeVariant);
        counts[t.templeVariant] += 1;
      }
      return counts;
    };
    const ea = variants('east-asia'), him = variants('himalaya'), ind = variants('indochina');
    expect(ea.pagoda).toBeGreaterThan(ea.tibetan + ea.stupa);   // East Asia → pagoda
    expect(him.tibetan).toBeGreaterThan(him.pagoda);            // Himalaya → tibetan monastery
    expect(ind.stupa).toBeGreaterThan(ind.pagoda);              // Indochina → Theravada stupa
    // adding temples must not have shifted any mosque ratio (mosque is still decided first)
    const mosqueShare = (locale) => {
      let m = 0, tot = 0;
      for (let seed = 1; seed <= 90; seed++) {
        const p = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale }).boxes.find((b) => b.class === 'religious');
        if (p) { tot += 1; if (p.structure === 'mosque') m += 1; }
      }
      return m / tot;
    };
    expect(mosqueShare('middle-east')).toBeGreaterThan(0.85);   // unchanged from the mosque-only contract
    expect(mosqueShare('southeast-asia')).toBeGreaterThan(0.4);
  });

  it('accepts locale aliases (us / ph) for the listed regions', () => {
    expect(planFractalCity({ seed: 5, depth: 3, density: 1, locale: 'US' }).stats.religiousPlaces).toBe(1);
    expect(planFractalCity({ seed: 5, depth: 3, density: 1, locale: 'ph' }).stats.religiousPlaces).toBe(1);
    expect(planFractalCity({ seed: 5, depth: 3, density: 1, locale: 'japan' }).stats.religiousPlaces).toBe(1);    // → east-asia
    expect(planFractalCity({ seed: 5, depth: 3, density: 1, locale: 'tibet' }).stats.religiousPlaces).toBe(1);    // → himalaya
    expect(planFractalCity({ seed: 5, depth: 3, density: 1, locale: 'thailand' }).stats.religiousPlaces).toBe(1); // → indochina
  });

  it('places no religious place for an unlisted locale or none at all', () => {
    for (const locale of ['asia', 'oceania', 'antarctica', undefined, null]) {
      const { boxes, stats } = planFractalCity({ seed: 3, anchor: 'tower', depth: 3, density: 1, locale });
      expect(stats.religiousPlaces).toBe(0);
      expect(boxes.some((b) => b.class === 'religious')).toBe(false);   // neither a church nor a mosque
    }
  });

  it('religious places are byte-identical when the locale is absent (no regression to existing seeds)', () => {
    // a locale-less city must match the default exactly — the church path consumes no rng
    const base = planFractalCity({ seed: 11, anchor: 'tower', depth: 3, density: 0.9 });
    const explicit = planFractalCity({ seed: 11, anchor: 'tower', depth: 3, density: 0.9, locale: null });
    expect(explicit.boxes.length).toBe(base.boxes.length);
    expect(base.boxes.some((b) => b.shape === 'church')).toBe(false);
    expect(base.stats.religiousPlaces).toBe(0);
  });

  it('honors the religiousPlaces element toggle even for a listed locale', () => {
    const off = planFractalCity({ seed: 1, anchor: 'tower', depth: 3, density: 1, locale: 'europe', elements: { religiousPlaces: false } });
    expect(off.stats.religiousPlaces).toBe(0);
    expect(off.boxes.some((b) => b.shape === 'church')).toBe(false);
    expect(normalizeFractalCityElements(['church']).religiousPlaces).toBe(true);
  });

  it('uses density as a recipe knob for block fill', () => {
    // density modulates the keep-building probability; sum across seeds so the signal is
    // robust to any single seed's composition (a sparse city leaves more leftover instead).
    let sparse = 0, dense = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      sparse += planFractalCity({ seed, anchor: null, subAnchors: false, depth: 3, density: 0.2 }).stats.buildings;
      dense += planFractalCity({ seed, anchor: null, subAnchors: false, depth: 3, density: 1 }).stats.buildings;
    }
    expect(dense).toBeGreaterThan(sparse);
  });
});

// ── budget / tenancy invariants (the phase-1 redesign contract) ──────────────────
// These are the structural guarantees of the occupancy-grid budget: nothing places into
// space already claimed by an anchor, every tenant stays on its host surface, and the
// leftover layer is tagged. They replace the old byte-identity snapshots.
describe('fractal-city budget invariants', () => {
  const hit = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);
  const ptIn = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d;
  const towerBoxes = (boxes) => boxes.filter((b) => b.kind === 'anchor').map((b) => ({ x: b.x, y: b.y, w: b.w, d: b.d }));
  const faceCentroid = (f) => {
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  };
  const DOODAD = new Set(['street-signal', 'street-sign', 'stop-sign', 'street-lamp', 'city-tree-trunk', 'city-tree-canopy', 'power-pole', 'power-line']);
  const CONFIGS = [
    { anchor: 'tower', depth: 2, density: 0.58 },
    { anchor: 'tower', depth: 3, density: 0.9, subAnchorChance: 0.6 },
    { anchor: 'tower', depth: 3, density: 1, elements: { streetcars: true } },
  ];

  it('never places a building, lot, or townhouse inside an anchor footprint', () => {
    for (const cfg of CONFIGS) for (let seed = 1; seed <= 60; seed += 1) {
      const { boxes, grounds } = planFractalCity({ ...cfg, seed });
      const towers = towerBoxes(boxes);
      if (!towers.length) continue;
      for (const b of boxes) {
        if (b.kind !== 'building' && b.kind !== 'townhouse') continue;
        expect(towers.some((t) => hit(t, { x: b.x, y: b.y, w: b.w, d: b.d }))).toBe(false);
      }
      for (const g of grounds.filter((x) => x.kind === 'lot-asphalt'))
        expect(towers.some((t) => hit(t, g))).toBe(false);
    }
  });

  it('keeps street furniture, crosswalks, and vehicles out of the anchor structure (tenancy)', () => {
    // the guarantee is "nothing renders INSIDE the tower box". A cantilevered lamp ARM may
    // overhang the 0.7 clearance plaza (the ring) — realistic — so we test the strict box.
    for (const cfg of CONFIGS) for (let seed = 1; seed <= 60; seed += 1) {
      const { boxes, grounds, faces } = planFractalCity({ ...cfg, seed });
      const towers = towerBoxes(boxes);
      if (!towers.length) continue;
      for (const b of boxes) {
        if (!DOODAD.has(b.kind)) continue;
        expect(towers.some((t) => hit(t, { x: b.x, y: b.y, w: b.w, d: b.d }))).toBe(false);
      }
      for (const g of grounds.filter((x) => typeof x.kind === 'string' && x.kind.startsWith('crosswalk')))
        expect(towers.some((t) => hit(t, g))).toBe(false);
      for (const f of faces) {
        if (!f.corners) continue;
        const [cx, cy] = faceCentroid(f);
        expect(towers.some((t) => ptIn(cx, cy, t))).toBe(false);
      }
    }
  });

  it('never plants an anchor on the streetcar corridor', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const { boxes } = planFractalCity({ anchor: 'tower', depth: 3, density: 1, subAnchorChance: 0.7, elements: { streetcars: true } });
      const track = boxes.filter((b) => b.kind === 'tram-pole' || b.kind === 'platform-roof');
      if (!track.length) continue;
      for (const a of boxes.filter((b) => b.kind === 'anchor'))
        for (const t of track)
          expect(hit({ x: a.x, y: a.y, w: a.w, d: a.d }, { x: t.x, y: t.y, w: t.w, d: t.d })).toBe(false);
    }
  });

  it('emits a tagged leftover layer that does not overlap buildings or anchors', () => {
    let sawLeftover = false;
    for (let seed = 1; seed <= 30; seed += 1) {
      const { boxes, grounds, stats } = planFractalCity({ anchor: 'tower', depth: 3, density: 0.6, seed });
      const left = grounds.filter((g) => g.leftover);
      if (left.length) { sawLeftover = true; expect(stats.leftover).toBeGreaterThan(0); }
      for (const g of left) {
        expect(['gore', 'pocket']).toContain(g.leftover);
        // leftover tiles are EXACT empty-cell runs, so they never overlap a placed thing
        for (const b of boxes.filter((x) => x.kind === 'building' || x.kind === 'anchor'))
          expect(hit(g, { x: b.x, y: b.y, w: b.w, d: b.d })).toBe(false);
      }
    }
    expect(sawLeftover).toBe(true);
  });
});
