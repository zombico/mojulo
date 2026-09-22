import { describe, expect, it } from 'vitest';

import { assembleFractalCityScene, normalizeFractalCityElements, planFractalCity, normalizeCityBlocks, expandCityBlockMap, normalizeCityFidelity, lodClassCensus, cityThemeAdapter, STOREY_H } from './fractal-city.js';
import { isLandmarkShape, LANDMARK_HEIGHTS } from '../landmarks/index.js';

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
      'city-tree',
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
    expect(boxes.filter((b) => b.kind === 'city-tree' && b.shape === 'tree').length).toBeGreaterThan(0);
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
    const { boxes, stats } = planFractalCity({ seed: 1, anchor: null, subAnchors: false, depth: 3, density: 0.8, elements: { townhouses: true } });
    const units = boxes.filter((b) => b.kind === 'townhouse');
    expect(units.length).toBeGreaterThan(0);
    expect(stats.townhouses).toBe(units.length);
    // every unit is self-describing: structure + style + row position + a facade
    for (const u of units) {
      expect(u.structure).toBe('townhouse-row');
      expect(['brownstone', 'modern-stacked', 'dutch-row']).toContain(u.style);
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

  it('biases European-ish locales toward Dutch row townhouse facades', () => {
    const { boxes, stats, elements } = planFractalCity({ seed: 2, anchor: null, subAnchors: false, depth: 3, density: 0.9, locale: 'amsterdam' });
    const units = boxes.filter((b) => b.kind === 'townhouse');
    const dutch = units.filter((b) => b.style === 'dutch-row');

    expect(elements.townhouses).toBe(true);
    expect(stats.townhouses).toBe(units.length);
    expect(dutch.length).toBeGreaterThan(0);
    expect(boxes.some((b) => b.kind === 'townhouse-gable')).toBe(true);
    expect(dutch.every((u) => u.facade?.style === 'dutch-row')).toBe(true);
  });

  it('keeps European townhouse bias overridable', () => {
    const off = planFractalCity({ seed: 2, anchor: null, subAnchors: false, depth: 3, density: 0.9, locale: 'belgium', elements: { townhouses: false } });
    expect(off.elements.townhouses).toBe(false);
    expect(off.stats.townhouses).toBe(0);
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
    const m = planFractalCity({ seed: 1, anchor: 'tower', depth: 3, density: 1, locale: 'middle-east' })
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

  it('civic domes are off by default and byte-identical to an explicit-off scene', () => {
    const base = planFractalCity({ seed: 3, anchor: 'tower', depth: 3, density: 0.9 });
    const off = planFractalCity({ seed: 3, anchor: 'tower', depth: 3, density: 0.9, elements: { civicDomes: false } });
    expect(JSON.stringify(off.boxes)).toBe(JSON.stringify(base.boxes));
    expect(base.boxes.some((b) => b.shape === 'rotunda')).toBe(false);
    expect(base.stats.civicDomes).toBe(0);
  });

  it('matches a few of the largest buildings with classical domes when civicDomes is on', () => {
    const FORMS = new Set(['hemispheric', 'onion', 'bulbous']);
    let any = 0;
    for (const seed of [1, 3, 9]) {
      const on = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale: 'us', elements: { civicDomes: true } });
      const rot = on.boxes.filter((b) => b.shape === 'rotunda');
      expect(rot.length).toBe(on.stats.civicDomes);
      expect(rot.length).toBeLessThanOrEqual(3);                       // "some", not the whole city
      rot.forEach((b) => {                                             // every rotunda is a valid civic dome
        expect(b.class).toBe('civic');
        expect(FORMS.has(b.domeForm)).toBe(true);
      });
      // re-tag, not insert: box count + the locale's religious place both survive
      const off = planFractalCity({ seed, anchor: 'tower', depth: 3, density: 1, locale: 'us' });
      expect(on.boxes.length).toBe(off.boxes.length);
      expect(on.stats.religiousPlaces).toBe(off.stats.religiousPlaces);
      any += rot.length;
    }
    expect(any).toBeGreaterThan(0);
  });

  it('honors the civicDomes element toggle and its aliases', () => {
    const off = planFractalCity({ seed: 3, anchor: 'tower', depth: 3, density: 1, elements: { civicDomes: false } });
    expect(off.stats.civicDomes).toBe(0);
    expect(normalizeFractalCityElements(['rotunda']).civicDomes).toBe(true);
    expect(normalizeFractalCityElements(['domes']).civicDomes).toBe(true);
    expect(normalizeFractalCityElements(['civic']).civicDomes).toBe(true);
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

describe('fractal-city landmark anchor', () => {
  const hit = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);

  it('places the requested landmark as the root anchor', () => {
    const { boxes, stats } = planFractalCity({ seed: 7, anchor: 'tower', landmark: 'cn-tower' });
    const tagged = boxes.filter((b) => b.class === 'landmark');
    expect(tagged).toHaveLength(1);
    const lm = tagged[0];
    expect(lm.shape).toBe('cn-tower');
    expect(isLandmarkShape(lm.shape)).toBe(true);
    expect(lm.kind).toBe('anchor');
    expect(stats.landmarks).toBe(1);
    // z1 is the bbox-height hint derived from the footprint and the landmark's factor
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['cn-tower'], 5);
  });

  it('reserves a plaza budget around the landmark that no building lands on', () => {
    const { boxes, grounds } = planFractalCity({ seed: 7, anchor: 'tower', landmark: 'cn-tower' });
    const plaza = grounds.find((g) => g.kind === 'landmark-plaza');
    expect(plaza).toBeTruthy();
    // the plaza zone is a real buffer, materially bigger than the monument footprint
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(plaza.w).toBeGreaterThan(lm.w + 2);
    expect(plaza.d).toBeGreaterThan(lm.d + 2);
    // nothing builds anywhere inside the reserved plaza
    const occupants = boxes.filter((b) => b.kind === 'building' || b.kind === 'townhouse');
    for (const o of occupants) expect(hit(o, plaza)).toBe(false);
  });

  it('places a cluster (CN Tower + Rogers Centre) side by side without overlap', () => {
    const { boxes, stats } = planFractalCity({ seed: 7, anchor: 'tower', landmark: ['rogers-centre', 'cn-tower'] });
    const lm = boxes.filter((b) => b.class === 'landmark');
    expect(lm).toHaveLength(2);
    expect(stats.landmarks).toBe(2);
    expect(new Set(lm.map((b) => b.shape))).toEqual(new Set(['rogers-centre', 'cn-tower']));
    expect(hit(lm[0], lm[1])).toBe(false); // the two monuments don't overlap each other
    // and nothing else lands on either of them
    const occupants = boxes.filter((b) => b.kind === 'building' || b.kind === 'townhouse');
    for (const o of occupants) for (const l of lm) expect(hit(o, l)).toBe(false);
  });

  it('does not perturb seed determinism when no landmark is requested', () => {
    const base = JSON.stringify(planFractalCity({ seed: 13 }).boxes);
    const withNull = JSON.stringify(planFractalCity({ seed: 13, landmark: null }).boxes);
    expect(withNull).toBe(base);
  });

  it('ignores an unknown landmark shape (leaves the city unchanged)', () => {
    const base = JSON.stringify(planFractalCity({ seed: 13 }).boxes);
    const bogus = planFractalCity({ seed: 13, landmark: 'not-a-landmark' });
    expect(bogus.stats.landmarks).toBe(0);
    expect(JSON.stringify(bogus.boxes)).toBe(base);
  });

  it('renders the landmark into the assembled scene as a tall mass', () => {
    const scene = assembleFractalCityScene({ seed: 7, anchor: 'tower', landmark: 'cn-tower', time: 'day' });
    const plain = assembleFractalCityScene({ seed: 7, anchor: 'tower', time: 'day' });
    // the cn-tower expands into many extra faces and rises far above its small footprint
    expect(scene.faces.length).toBeGreaterThan(plain.faces.length);
    const lm = planFractalCity({ seed: 7, anchor: 'tower', landmark: 'cn-tower' }).boxes.find((b) => b.class === 'landmark');
    const maxZ = Math.max(...scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]));
    expect(maxZ).toBeGreaterThan(Math.min(lm.w, lm.d) * 2.5); // mast towers well over its base
  });

  it('places and renders the Eiffel Tower as a tall lattice pylon', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'eiffel-tower' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('eiffel-tower');
    expect(stats.landmarks).toBe(1);
    expect(lm.w).toBeCloseTo(lm.d, 5);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['eiffel-tower'], 5);

    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'eiffel-tower', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    // antenna tip towers far above the base; the open ironwork expands into many faces
    expect(Math.max(...zs) - lm.z0).toBeGreaterThan(Math.min(lm.w, lm.d) * 2.4);
    expect(scene.faces.length).toBeGreaterThan(300);
  });

  it('accepts the "eiffel" alias for the Eiffel Tower', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'eiffel' });
    expect(stats.landmarks).toBe(1);
    expect(boxes.find((b) => b.class === 'landmark').shape).toBe('eiffel');
    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'eiffel' });
    expect(scene.faces.length).toBeGreaterThan(300);
  });

  it('places and renders the Tokyo Tower as a tall, slender banded lattice pylon', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'tokyo-tower' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('tokyo-tower');
    expect(stats.landmarks).toBe(1);
    expect(lm.w).toBeCloseTo(lm.d, 5);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['tokyo-tower'], 5);

    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'tokyo-tower', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    // antenna tip towers far above the base; the open banded ironwork expands into many faces
    expect(Math.max(...zs) - lm.z0).toBeGreaterThan(Math.min(lm.w, lm.d) * 3.0);
    expect(scene.faces.length).toBeGreaterThan(300);
  });

  it('accepts the "tokyo" alias for the Tokyo Tower', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'tokyo' });
    expect(stats.landmarks).toBe(1);
    expect(boxes.find((b) => b.class === 'landmark').shape).toBe('tokyo');
    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'tokyo' });
    expect(scene.faces.length).toBeGreaterThan(300);
  });

  it('places and renders the Empire State Building as a tall setback skyscraper', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'empire-state-building' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('empire-state-building');
    expect(stats.landmarks).toBe(1);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['empire-state-building'], 5);

    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'empire-state-building', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    // antenna spire towers far above the base; stacked setbacks + window piers make many faces
    expect(Math.max(...zs) - lm.z0).toBeGreaterThan(Math.min(lm.w, lm.d) * 4.5);
    expect(scene.faces.length).toBeGreaterThan(150);
  });

  it('accepts the "empire" alias for the Empire State Building', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'empire' });
    expect(stats.landmarks).toBe(1);
    expect(boxes.find((b) => b.class === 'landmark').shape).toBe('empire');
    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'empire' });
    expect(scene.faces.length).toBeGreaterThan(150);
  });

  it('places and renders the Gateway Arch as a tall stainless catenary', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'gateway-arch' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('gateway-arch');
    expect(stats.landmarks).toBe(1);

    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'gateway-arch', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    // the catenary apex soars as-wide-as-tall; the triangular tube extrudes into many faces
    expect(Math.max(...zs) - lm.z0).toBeGreaterThan(Math.min(lm.w, lm.d) * 1.6);
    expect(scene.faces.length).toBeGreaterThan(120);
  });

  it('accepts the "gateway" alias for the Gateway Arch', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'gateway' });
    expect(stats.landmarks).toBe(1);
    expect(boxes.find((b) => b.class === 'landmark').shape).toBe('gateway');
    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'gateway' });
    expect(scene.faces.length).toBeGreaterThan(120);
  });

  it('places and renders Cloud Gate as a broad low mirror blob', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'cloud-gate' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('cloud-gate');
    expect(stats.landmarks).toBe(1);

    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'cloud-gate', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    // wider than tall: the crown sits below the short footprint side; the dome shells make many faces
    expect(Math.max(...zs) - lm.z0).toBeLessThan(Math.min(lm.w, lm.d));
    expect(Math.max(...zs) - lm.z0).toBeGreaterThan(Math.min(lm.w, lm.d) * 0.5);
    expect(scene.faces.length).toBeGreaterThan(300);
  });

  it('accepts the "bean" alias for Cloud Gate', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'bean' });
    expect(stats.landmarks).toBe(1);
    expect(boxes.find((b) => b.class === 'landmark').shape).toBe('bean');
    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'bean' });
    expect(scene.faces.length).toBeGreaterThan(300);
  });

  it('places and renders the Statue of Liberty as a robed figure on a tall pedestal', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'statue-of-liberty' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('statue-of-liberty');
    expect(stats.landmarks).toBe(1);

    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'statue-of-liberty', time: 'day' });
    // reduce (not Math.max spread) — the polygonized figure makes far too many verts to spread
    let maxZ = -Infinity;
    for (const f of scene.faces) for (const p of (f.corners || [])) if (p[2] > maxZ) maxZ = p[2];
    // torch tip soars over the pedestal; the polygonized figure expands into many faces
    expect(maxZ - lm.z0).toBeGreaterThan(Math.min(lm.w, lm.d) * 2.4);
    expect(scene.faces.length).toBeGreaterThan(400);
  });

  it('accepts the "liberty" alias for the Statue of Liberty', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'liberty' });
    expect(stats.landmarks).toBe(1);
    expect(boxes.find((b) => b.class === 'landmark').shape).toBe('liberty');
    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'liberty' });
    expect(scene.faces.length).toBeGreaterThan(400);
  });

  it('places and renders the Rizal Monument as a bronze figure under a granite obelisk', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'rizal-monument' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('rizal-monument');
    expect(stats.landmarks).toBe(1);

    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'rizal-monument', time: 'day' });
    let maxZ = -Infinity;   // reduce (not Math.max spread) — the polygonized figure makes too many verts
    for (const f of scene.faces) for (const p of (f.corners || [])) if (p[2] > maxZ) maxZ = p[2];
    // a modest obelisk (tip ≈ 1·short side); the polygonized figure expands into many faces
    expect(maxZ - lm.z0).toBeGreaterThan(Math.min(lm.w, lm.d) * 0.8);
    expect(scene.faces.length).toBeGreaterThan(400);
  });

  it('accepts the "rizal" alias for the Rizal Monument', () => {
    const { boxes, stats } = planFractalCity({ seed: 9, anchor: 'tower', landmark: 'rizal' });
    expect(stats.landmarks).toBe(1);
    expect(boxes.find((b) => b.class === 'landmark').shape).toBe('rizal');
    const scene = assembleFractalCityScene({ seed: 9, anchor: 'tower', landmark: 'rizal' });
    expect(scene.faces.length).toBeGreaterThan(400);
  });

  it('places and renders the Great Pyramid as a broad low landmark', () => {
    const { boxes, stats } = planFractalCity({ seed: 11, anchor: 'tower', landmark: 'great-pyramid' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('great-pyramid');
    expect(stats.landmarks).toBe(1);
    expect(lm.w).toBeCloseTo(lm.d, 5);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['great-pyramid'], 5);

    const scene = assembleFractalCityScene({ seed: 11, anchor: 'tower', landmark: 'great-pyramid', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 0.6);
    expect(scene.faces.length).toBeGreaterThan(12);
  });

  it('places and renders the Louvre Pyramid as a glass lattice landmark', () => {
    const { boxes, stats } = planFractalCity({ seed: 17, anchor: 'tower', landmark: 'louvre-pyramid' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('louvre-pyramid');
    expect(stats.landmarks).toBe(1);
    expect(lm.w).toBeCloseTo(lm.d, 5);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['louvre-pyramid'], 5);

    const scene = assembleFractalCityScene({ seed: 17, anchor: 'tower', landmark: 'louvre-pyramid', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 0.6);
    expect(scene.faces.length).toBeGreaterThan(80);
  });

  it('places and renders a Mexican Pyramid as a stepped temple landmark', () => {
    const { boxes, stats } = planFractalCity({ seed: 18, anchor: 'tower', landmark: 'mexican-pyramid' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('mexican-pyramid');
    expect(stats.landmarks).toBe(1);
    expect(lm.w).toBeCloseTo(lm.d, 5);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['mexican-pyramid'], 5);

    const scene = assembleFractalCityScene({ seed: 18, anchor: 'tower', landmark: 'mexican-pyramid', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 0.5);
    expect(scene.faces.length).toBeGreaterThan(70);
  });

  it('places and renders the Petronas Towers as a wide twin-tower landmark', () => {
    const { boxes, stats } = planFractalCity({ seed: 12, anchor: 'tower', landmark: 'petronas-towers' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('petronas-towers');
    expect(stats.landmarks).toBe(1);
    expect(lm.w / lm.d).toBeGreaterThan(1.3);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['petronas-towers'], 5);

    const scene = assembleFractalCityScene({ seed: 12, anchor: 'tower', landmark: 'petronas-towers', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 3.5);
    expect(scene.faces.length).toBeGreaterThan(400);
  });

  it('places and renders Big Ben as a tall clock tower landmark', () => {
    const { boxes, stats } = planFractalCity({ seed: 21, anchor: 'tower', landmark: 'big-ben' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('big-ben');
    expect(stats.landmarks).toBe(1);
    expect(lm.w).toBeCloseTo(lm.d, 5);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['big-ben'], 5);

    const scene = assembleFractalCityScene({ seed: 21, anchor: 'tower', landmark: 'big-ben', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 3.6);
    expect(scene.faces.length).toBeGreaterThan(180);
  });

  it('places and renders Stonehenge as a broad megalith ring landmark', () => {
    const { boxes, stats } = planFractalCity({ seed: 22, anchor: 'tower', landmark: 'stonehenge' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('stonehenge');
    expect(stats.landmarks).toBe(1);
    expect(lm.w / lm.d).toBeGreaterThan(1.1);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS.stonehenge, 5);

    const scene = assembleFractalCityScene({ seed: 22, anchor: 'tower', landmark: 'stonehenge', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 0.5);
    expect(scene.faces.length).toBeGreaterThan(180);
  });

  it('places and renders a Chinatown gate as a compact gateway landmark', () => {
    const { boxes, stats } = planFractalCity({ seed: 23, anchor: 'tower', landmark: 'chinatown-gate' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('chinatown-gate');
    expect(stats.landmarks).toBe(1);
    expect(lm.w / lm.d).toBeGreaterThan(1.2);
    expect(Math.min(lm.w, lm.d)).toBeLessThan(4);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['chinatown-gate'], 5);

    const scene = assembleFractalCityScene({ seed: 23, anchor: 'tower', landmark: 'chinatown-gate', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d));
    expect(scene.faces.length).toBeGreaterThan(90);
  });

  it('places and renders the Arc de Triomphe as a monumental arch landmark', () => {
    const { boxes, stats } = planFractalCity({ seed: 24, anchor: 'tower', landmark: 'arc-de-triomphe' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('arc-de-triomphe');
    expect(stats.landmarks).toBe(1);
    expect(lm.w).toBeCloseTo(lm.d, 5);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['arc-de-triomphe'], 5);

    const scene = assembleFractalCityScene({ seed: 24, anchor: 'tower', landmark: 'arc-de-triomphe', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 1.35);
    expect(scene.faces.length).toBeGreaterThan(80);
  });

  it('places and renders the Parthenon as an elongated Doric temple ruin', () => {
    const { boxes, stats } = planFractalCity({ seed: 24, anchor: 'tower', landmark: 'parthenon' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('parthenon');
    expect(stats.landmarks).toBe(1);
    // elongated rectangular stylobate (≈ 2.2:1), not square like the arch
    expect(Math.max(lm.w, lm.d) / Math.min(lm.w, lm.d)).toBeCloseTo(2.2, 1);
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS.parthenon, 5);

    const scene = assembleFractalCityScene({ seed: 24, anchor: 'tower', landmark: 'parthenon', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 0.45); // entablature crowns the colonnade
    expect(scene.faces.length).toBeGreaterThan(400); // 40+ fluted columns → many faces
  });

  it('places and renders Griffith Observatory as a three-dome Art Deco landmark', () => {
    const { boxes, stats } = planFractalCity({ seed: 24, anchor: 'tower', landmark: 'griffith-observatory' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('griffith-observatory');
    expect(stats.landmarks).toBe(1);
    expect(Math.max(lm.w, lm.d) / Math.min(lm.w, lm.d)).toBeCloseTo(2.3, 1); // long wing
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['griffith-observatory'], 5);

    const scene = assembleFractalCityScene({ seed: 24, anchor: 'tower', landmark: 'griffith-observatory', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 0.85); // great central dome + finial
    expect(scene.faces.length).toBeGreaterThan(400); // three domes → many faces
  });

  it('places and renders the Washington Monument as a slender obelisk', () => {
    const { boxes, stats } = planFractalCity({ seed: 24, anchor: 'tower', landmark: 'washington-monument' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('washington-monument');
    expect(stats.landmarks).toBe(1);
    expect(lm.w).toBeCloseTo(lm.d, 5); // square base
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['washington-monument'], 5);

    const scene = assembleFractalCityScene({ seed: 24, anchor: 'tower', landmark: 'washington-monument', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 5.5); // tall slender shaft + pyramidion
    expect(scene.faces.length).toBeGreaterThan(80);
  });

  it('places and renders Parliament Hill Centre Block with a central tower', () => {
    const { boxes, stats } = planFractalCity({ seed: 24, anchor: 'tower', landmark: 'parliament-hill' });
    const lm = boxes.find((b) => b.class === 'landmark');
    expect(lm.shape).toBe('parliament-hill');
    expect(stats.landmarks).toBe(1);
    expect(Math.max(lm.w, lm.d) / Math.min(lm.w, lm.d)).toBeCloseTo(2.6, 1); // long wings
    expect(lm.z1 - lm.z0).toBeCloseTo(Math.min(lm.w, lm.d) * LANDMARK_HEIGHTS['parliament-hill'], 5);

    const scene = assembleFractalCityScene({ seed: 24, anchor: 'tower', landmark: 'parliament-hill', time: 'day' });
    const zs = scene.faces.flatMap((f) => f.corners || []).map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(Math.min(lm.w, lm.d) * 3.0); // Peace Tower spire dominates the wings
    expect(scene.faces.length).toBeGreaterThan(400);
  });
});

describe('fractal-city civic areas', () => {
  const hit = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);
  // overlap PENETRATION depth (min across both axes); a graze of ≤ one grid cell is the
  // by-design `isBuildable` abut tolerance (a building touches a reserved edge the same way it
  // abuts a road/anchor), so the building-intrusion test only fails on real penetration.
  const CELL = 0.25;
  const penetration = (a, b) => Math.min(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y));
  // the reserved extent of each placed district = its full-footprint 'civic-area' base tile
  const fpsOf = (grounds) => grounds.filter((g) => g.kind === 'civic-area');
  const KINDS = ['town-square', 'school', 'strip-mall'];
  const BIG = { region: { x: 2, y: 2, w: 40, d: 28 }, depth: 3, anchor: 'tower' };

  it('places each requested district once, reserved, and reports it in stats', () => {
    const { grounds, stats } = planFractalCity({ ...BIG, seed: 1, civicAreas: KINDS });
    const fps = fpsOf(grounds);
    expect(fps.length).toBe(stats.civicAreas);
    expect(stats.civicAreas + stats.civicAreasSkipped).toBe(KINDS.length);
    // every placed district is one of the requested kinds, and kinds aren't duplicated
    const placedKinds = fps.map((f) => f.civic);
    expect(new Set(placedKinds).size).toBe(placedKinds.length);
    for (const k of placedKinds) expect(KINDS).toContain(k);
  });

  it('reserves a surface-area budget so roads / sidewalks / power / recursion buildings never run through a district', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const { boxes, grounds } = planFractalCity({ ...BIG, seed, landmark: 'cn-tower', civicAreas: KINDS });
      const fps = fpsOf(grounds);
      if (!fps.length) continue;
      for (const fp of fps) {
        // no junction patch (paving) lands on a district
        for (const g of grounds.filter((x) => x.kind === 'junction')) expect(hit(g, fp)).toBe(false);
        // no power line threads through a district
        for (const b of boxes.filter((x) => x.kind === 'power-line')) expect(hit({ x: b.x, y: b.y, w: b.w, d: b.d }, fp)).toBe(false);
        // no building the RECURSION placed (i.e. not the district's own civic-tagged building)
        // penetrates a district by more than the one-cell abut tolerance
        for (const b of boxes.filter((x) => x.kind === 'building' && x.civic == null)) {
          const r = { x: b.x, y: b.y, w: b.w, d: b.d };
          if (hit(r, fp)) expect(penetration(r, fp)).toBeLessThanOrEqual(CELL + 1e-9);
        }
      }
    }
  });

  it('keeps districts from overlapping each other or a monument landmark', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const { boxes, grounds } = planFractalCity({ ...BIG, seed, landmark: 'cn-tower', civicAreas: KINDS });
      const fps = fpsOf(grounds);
      for (let i = 0; i < fps.length; i += 1) for (let j = i + 1; j < fps.length; j += 1) expect(hit(fps[i], fps[j])).toBe(false);
      const lm = boxes.filter((b) => b.class === 'landmark').map((b) => ({ x: b.x, y: b.y, w: b.w, d: b.d }));
      for (const fp of fps) for (const m of lm) expect(hit(fp, m)).toBe(false);
    }
  });

  it('builds a strip-mall apron whose parked cars survive the final car pass', () => {
    // the apron is LOT-claimed over PLAZA so rectAllClaim(LOT) keeps its deferred cars
    let sawApronWithCars = false;
    for (let seed = 1; seed <= 30 && !sawApronWithCars; seed += 1) {
      const { grounds, faces } = planFractalCity({ ...BIG, seed, civicAreas: ['strip-mall'] });
      const apron = grounds.find((g) => g.kind === 'strip-mall-apron');
      if (!apron) continue;
      const inApron = faces.some((f) => f.corners && f.corners.some((c) => c[0] >= apron.x && c[0] <= apron.x + apron.w && c[1] >= apron.y && c[1] <= apron.y + apron.d));
      if (inApron) sawApronWithCars = true;
    }
    expect(sawApronWithCars).toBe(true);
  });

  it('is deterministic per seed and a no-op when no district is requested', () => {
    const a = JSON.stringify(planFractalCity({ ...BIG, seed: 9, civicAreas: KINDS }).boxes);
    const b = JSON.stringify(planFractalCity({ ...BIG, seed: 9, civicAreas: KINDS }).boxes);
    expect(a).toBe(b);
    const none = JSON.stringify(planFractalCity({ ...BIG, seed: 9 }).boxes);
    const empty = JSON.stringify(planFractalCity({ ...BIG, seed: 9, civicAreas: [] }).boxes);
    expect(none).toBe(empty);
    const bogus = planFractalCity({ ...BIG, seed: 9, civicAreas: ['not-a-district'] });
    expect(bogus.stats.civicAreas).toBe(0);
    expect(JSON.stringify(bogus.boxes)).toBe(none);
  });

  it('renders districts into the assembled scene (ground + props)', () => {
    const scene = assembleFractalCityScene({ ...BIG, seed: 1, civicAreas: KINDS, time: 'day' });
    expect(scene.faces.length).toBeGreaterThan(400);
  });

  it('builds a city-park: fractal greenery (trees + shrubs) that never roots in the pond, varying per seed', () => {
    const inRect = (b, r) => { const cx = b.x + b.w / 2, cy = b.y + b.d / 2; return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.d; };
    let pond = 0, trail = 0, centre = 0, lawns = 0, shrubSeeds = 0, plantTotal = 0;
    for (let seed = 1; seed <= 24; seed += 1) {
      const { boxes, grounds } = planFractalCity({ ...BIG, seed, civicAreas: ['city-park'] });
      const lawn = grounds.find((g) => g.kind === 'park-lawn');
      if (!lawn) continue;
      lawns += 1;
      const fp = grounds.find((g) => g.kind === 'civic-area' && g.civic === 'city-park');
      const plants = boxes.filter((b) => (b.kind === 'city-tree' || b.kind === 'city-shrub') && inRect(b, fp));
      expect(plants.length).toBeGreaterThan(0);                 // every park is planted
      plantTotal += plants.length;
      if (boxes.some((b) => b.kind === 'city-shrub' && inRect(b, fp))) shrubSeeds += 1;
      // NEVER a plant rooted in the pond water (it is LOT-claimed, not a tree surface)
      const water = grounds.find((g) => g.kind === 'park-pond');
      if (water) for (const b of plants) expect(inRect(b, water)).toBe(false);
      if (water) pond += 1;
      if (grounds.some((g) => g.kind === 'park-trail')) trail += 1;
      if (boxes.some((b) => b.kind === 'building' && b.civic === 'city-park')) centre += 1;
    }
    expect(plantTotal / lawns).toBeGreaterThan(8);              // greenery-first: lush on average
    expect(shrubSeeds).toBeGreaterThan(lawns / 2);              // shrubs (not just trees) are a routine part of the mix
    // the three optional features each appear on SOME seeds but not all (real variation)
    for (const n of [pond, trail, centre]) { expect(n).toBeGreaterThan(0); expect(n).toBeLessThan(lawns); }
  });
});

describe('fractal-city — instanced street furniture (renderer-convergence 1b)', () => {
  const SPEC = { region: { x: 2, y: 2, w: 30, d: 18 }, depth: 2, seed: 1 };
  // the two heavy assembles are shared across the assertions below (deterministic, so safe);
  // re-assembling per test made this file a timeout magnet under full-suite parallel load.
  let plain0 = null, inst0 = null;
  const plainScene = () => (plain0 ??= assembleFractalCityScene(SPEC));
  const instScene = () => (inst0 ??= assembleFractalCityScene({ ...SPEC, instancing: true }));

  it('is strictly opt-in: no `instancing` → no repeats channel, payload untouched', () => {
    const scene = plainScene();
    expect(scene.repeats).toBeUndefined();
    expect(scene.repeatsInfo).toBeUndefined();
  });

  it('moves repeated furniture into `repeats` with EXACT face accounting and a smaller payload', () => {
    const plain = plainScene();
    const inst = instScene();
    expect(inst.repeats.length).toBeGreaterThan(0);
    const depicted = inst.repeats.reduce((a, r) => a + r.template.length * r.transforms.length, 0);
    // every face removed from the soup is depicted by a template × its copies — nothing lost
    expect(inst.faces.length + depicted).toBe(plain.faces.length);
    // and the payload is smaller than its expanded equivalent (the channel's reason to exist)
    const bytes = (o) => JSON.stringify({ f: o.faces, r: o.repeats || [] }).length;
    expect(bytes(inst)).toBeLessThan(bytes(plain));
    // ledger: adopted groups all clear the copy threshold; skips are recorded, never silent
    for (const g of inst.repeatsInfo.instanced) expect(g.copies).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(inst.repeatsInfo.skipped)).toBe(true);
  });

  it('templates realize through the same assembler: faces match the expanded look at the template position', () => {
    const plain = plainScene();
    const inst = instScene();
    const r0 = inst.repeats[0];
    const t0 = r0.transforms[0];
    // translate the template's first face by the first transform: an identical face (same fill,
    // same corners within float noise) must exist in the expanded scene.
    const tf = r0.template[0];
    const moved = tf.corners.map((c) => [c[0] + t0.pos[0], c[1] + t0.pos[1], c[2] + t0.pos[2]]);
    const match = plain.faces.find((f) => f.fill === tf.fill && Array.isArray(f.corners)
      && f.corners.every((c, i) => Math.hypot(c[0] - moved[i][0], c[1] - moved[i][1], c[2] - moved[i][2]) < 1e-6));
    expect(match).toBeTruthy();
  });

  it('stands down (recorded, not silent) under position-dependent lighting', () => {
    for (const extra of [{ time: 'night' }, { time: 'day' }, { groundShadows: true }]) {
      const scene = assembleFractalCityScene({ ...SPEC, instancing: true, ...extra });
      expect(scene.repeats).toBeUndefined();
      expect(scene.repeatsInfo.disabled).toBeTruthy();
    }
  });
});

// ── operator blocks: parcels laid before the roads ─────────────────────────────────────
describe('fractal-city operator blocks', () => {
  const BIG = { region: { x: 2, y: 2, w: 40, d: 28 }, depth: 3, anchor: 'tower' };
  const CELL = 0.25;
  const hit = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);
  const penetration = (a, b) => Math.min(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y));
  const centreIn = (b, r) => { const cx = b.x + b.w / 2, cy = b.y + b.d / 2; return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.d; };
  const MASS = new Set(['building', 'house', 'townhouse', 'anchor']);
  // one block per use, spaced on a 3 × 3 lattice clear of the centred anchor tower
  const ALL_USES = [
    { rect: { x: 4, y: 4, w: 8, d: 6 }, use: 'residential', label: 'old town' },
    { rect: { x: 14, y: 4, w: 8, d: 6 }, use: 'residential', fill: 'rows' },
    { rect: { x: 24, y: 4, w: 8, d: 6 }, use: 'residential', fill: 'massed', storeys: [3, 6] },
    { rect: { x: 4, y: 12, w: 8, d: 6 }, use: 'commercial', storeys: [8, 14], density: 1 },
    { rect: { x: 34, y: 12, w: 6, d: 6 }, use: 'industrial', density: 1 },
    { rect: { x: 24, y: 12, w: 8, d: 6 }, use: 'park' },
    { rect: { x: 4, y: 20, w: 6, d: 6 }, use: 'plaza' },
    { rect: { x: 12, y: 20, w: 8, d: 6 }, use: 'civic' },
    { rect: { x: 22, y: 20, w: 8, d: 6 }, use: 'civic', fill: 'school' },
    { rect: { x: 32, y: 20, w: 6, d: 6 }, use: 'empty' },
  ];

  it('normalizes the rect form (aliases, bands, junk) and keeps the map form as a map', () => {
    const out = normalizeCityBlocks([
      { rect: { x: 1, y: 2, w: 3, d: 4 }, use: 'housing', storeys: 3, density: 2, label: '  north end  ' },
      { x: 5, y: 6, w: 2, d: 2, use: 'C', storeys: [80, 2], fill: 'nonsense' },          // inline rect, letter alias, band clamped + ordered, bad fill dropped
      { rect: { x: 0, y: 0, w: 2, d: 2 }, height: [4, 1] },                               // no use → commercial; height band ordered
      { rect: { x: 0, y: 0, w: 2, d: 2 }, use: 'moon-base' },                             // unknown use → dropped
      { rect: { x: 0, y: 0, w: 0, d: 2 }, use: 'park' },                                  // degenerate rect → dropped
      'nope', null, 7,
    ]);
    expect(out).toEqual([
      { rect: { x: 1, y: 2, w: 3, d: 4 }, use: 'residential', storeys: 3, density: 1, label: 'north end' },
      { rect: { x: 5, y: 6, w: 2, d: 2 }, use: 'commercial', storeys: [2, 40] },
      { rect: { x: 0, y: 0, w: 2, d: 2 }, use: 'commercial', height: [1, 4] },
    ]);
    expect(normalizeCityBlocks(null)).toBeNull();
    expect(normalizeCityBlocks([])).toBeNull();
    expect(normalizeCityBlocks([{ use: 'park' }])).toBeNull();
    expect(normalizeCityBlocks({ map: ['rrc.', 'ppze'], gap: 2 })).toEqual({ map: ['RRC.', 'PPZE'], gap: 2 });
    expect(normalizeCityBlocks({ map: [] })).toBeNull();
    expect(normalizeCityBlocks({ nonsense: true })).toBeNull();
  });

  it('expands a zoning map one block per lettered cell, row 0 at the far (high-y) edge', () => {
    const blocks = expandCityBlockMap(['RC', 'P.'], { x: 0, y: 0, w: 20, d: 10 }, 2);
    expect(blocks.map((b) => b.use)).toEqual(['residential', 'commercial', 'park']);
    expect(blocks[0].rect).toEqual({ x: 1, y: 6, w: 8, d: 3 });     // row 0 → y in the upper half
    expect(blocks[2].rect).toEqual({ x: 1, y: 1, w: 8, d: 3 });     // row 1 → the low band
    expect(blocks[1].rect.x).toBe(11);
    const laid = planFractalCity({ ...BIG, seed: 4, blocks: { map: ['RC', 'P.'] } }).stats.blocksLaid;
    expect(laid.map((b) => b.use)).toEqual(['residential', 'commercial', 'park']);
    expect(laid.every((b) => b.inside)).toBe(true);
  });

  it('lays every block, reports it, and tags what it built', () => {
    const { boxes, grounds, stats } = planFractalCity({ ...BIG, seed: 1, blocks: ALL_USES });
    expect(stats.blocksLaid.length).toBe(ALL_USES.length);
    stats.blocksLaid.forEach((r, i) => {
      expect(r.index).toBe(i);
      expect(r.use).toBe(ALL_USES[i].use);
      expect(r.rect).toEqual(ALL_USES[i].rect);
      expect(r.inside).toBe(true);
      expect(r.boxes).toBe(boxes.filter((b) => b.block === i).length);
      expect(r.masses).toBe(boxes.filter((b) => b.block === i && MASS.has(b.kind)).length);
    });
    expect(stats.blocksLaid[0].label).toBe('old town');
    expect(stats.blocksLaid[3].heightBand).toEqual([Math.round(8 * STOREY_H * 100) / 100, Math.round(14 * STOREY_H * 100) / 100]);
    // every block leaves a base tile under it (the park's is the civic-area base the builder expects)
    for (let i = 0; i < ALL_USES.length; i++) expect(grounds.some((g) => g.block === i && (g.kind === 'block-base' || g.kind === 'civic-area'))).toBe(true);
    // a `blocks` recipe still censuses the recursion's own blocks separately
    expect(stats.blocks).toBeGreaterThan(0);
  });

  it('fills each block by its use through the existing fill rules', () => {
    const inBlock = (i) => (b) => b.block === i;
    let seenRows = false, seenHouses = false, seenCommercial = false, seenIndustrial = false, seenPark = false, seenPlaza = false, seenHall = false, seenSchool = false;
    for (let seed = 1; seed <= 6; seed += 1) {
      const { boxes, grounds } = planFractalCity({ ...BIG, seed, blocks: ALL_USES });
      const rect = (i) => ALL_USES[i].rect;
      if (boxes.some((b) => inBlock(0)(b) && b.kind === 'house')) seenHouses = true;
      if (boxes.some((b) => inBlock(1)(b) && b.kind === 'townhouse')) seenRows = true;
      const massed = boxes.filter((b) => inBlock(2)(b) && b.kind === 'building');
      for (const b of massed) { expect(b.z1 - b.z0).toBeGreaterThanOrEqual(3 * STOREY_H - 1e-9); expect(b.z1 - b.z0).toBeLessThanOrEqual(6 * STOREY_H + 1e-9); }
      const commercial = boxes.filter((b) => inBlock(3)(b) && b.kind === 'building');
      if (commercial.length) seenCommercial = true;
      for (const b of commercial) { expect(b.z1 - b.z0).toBeGreaterThanOrEqual(8 * STOREY_H - 1e-9); expect(b.z1 - b.z0).toBeLessThanOrEqual(14 * STOREY_H + 1e-9); expect(b.condo).toBe(false); }
      const sheds = boxes.filter((b) => inBlock(4)(b) && b.kind === 'building');
      if (sheds.length) seenIndustrial = true;
      for (const b of sheds) expect(b.z1 - b.z0).toBeLessThanOrEqual(2.2 + 1e-9);
      if (grounds.some((g) => g.kind === 'park-lawn' && centreIn(g, rect(5))) && boxes.some((b) => inBlock(5)(b) && (b.kind === 'city-tree' || b.kind === 'city-shrub'))) seenPark = true;
      if (grounds.some((g) => g.kind === 'town-square-paving' && centreIn(g, rect(6))) && boxes.some((b) => inBlock(6)(b) && b.kind === 'park-bench')) seenPlaza = true;
      if (boxes.some((b) => inBlock(7)(b) && b.kind === 'building' && b.civic === 'hall')) seenHall = true;
      if (grounds.some((g) => g.kind === 'school-yard' && centreIn(g, rect(8)))) seenSchool = true;
      // an EMPTY block builds nothing and the recursion never fills it either
      expect(boxes.some((b) => inBlock(9)(b))).toBe(false);
      for (const b of boxes.filter((b) => MASS.has(b.kind) && b.block == null)) if (hit(b, rect(9))) expect(penetration(b, rect(9))).toBeLessThanOrEqual(CELL + 1e-9);
    }
    expect([seenHouses, seenRows, seenCommercial, seenIndustrial, seenPark, seenPlaza, seenHall, seenSchool]).toEqual([true, true, true, true, true, true, true, true]);
  });

  it('reserves each block before the roads: no junction, ribbon, power line or recursion mass runs through it', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { boxes, grounds, ribbons, stats } = planFractalCity({ ...BIG, seed, blocks: ALL_USES });
      for (const r of stats.blocksLaid) {
        const fp = r.rect;
        for (const g of grounds.filter((x) => x.kind === 'junction')) expect(hit(g, fp)).toBe(false);
        // a cross-street is shifted so its whole right-of-way clears the block (the `flank` pad); when
        // no side has room the street stays and its verge may abut the block edge, so the outermost
        // wire of the three (0.32 off the pole line) can graze the edge — never by more than a cell
        for (const b of boxes.filter((x) => x.kind === 'power-line')) if (hit(b, fp)) expect(penetration(b, fp)).toBeLessThanOrEqual(CELL + 1e-9);
        // road ribbons are clipped out of the block (a path point strictly inside would be a street through it)
        for (const rb of ribbons) for (const [x, y] of rb.path) expect(x > fp.x + 0.3 && x < fp.x + fp.w - 0.3 && y > fp.y + 0.3 && y < fp.y + fp.d - 0.3).toBe(false);
        for (const b of boxes.filter((x) => MASS.has(x.kind) && x.block == null && x.kind !== 'anchor')) if (hit(b, fp)) expect(penetration(b, fp)).toBeLessThanOrEqual(CELL + 1e-9);
      }
    }
  });

  it('is advisory: a block outside the region or over a reserved plaza is still placed and named', () => {
    const outside = { rect: { x: 60, y: 60, w: 8, d: 6 }, use: 'residential' };
    const onPlaza = { rect: { x: 18, y: 12, w: 8, d: 6 }, use: 'commercial', density: 1, label: 'under the tower' };
    const { stats } = planFractalCity({ ...BIG, seed: 2, landmark: 'cn-tower', blocks: [outside, onPlaza] });
    expect(stats.blocksLaid.length).toBe(2);
    expect(stats.blocksLaid[0]).toMatchObject({ use: 'residential', inside: false, overlapsReserved: false });
    expect(stats.blocksLaid[0].masses).toBeGreaterThan(0);                 // placed anyway, off the frame
    expect(stats.blocksLaid[1]).toMatchObject({ label: 'under the tower', inside: true, overlapsReserved: true });
    expect(stats.landmarks).toBeGreaterThan(0);                             // the monument keeps its plaza
  });

  it('follows the baseScale frame: reports the recipe rect, lands the masses inside it', () => {
    const blocks = [{ rect: { x: 4, y: 4, w: 10, d: 7 }, use: 'residential', fill: 'rows' }, { rect: { x: 20, y: 14, w: 8, d: 6 }, use: 'commercial', density: 1 }];
    const { boxes, stats } = planFractalCity({ ...BIG, seed: 3, baseScale: 0.6, blocks });
    expect(stats.blocksLaid.map((r) => r.rect)).toEqual(blocks.map((b) => b.rect));
    for (const r of stats.blocksLaid) {
      const mine = boxes.filter((b) => b.block === r.index && MASS.has(b.kind));
      expect(mine.length).toBeGreaterThan(0);
      for (const b of mine) { expect(centreIn(b, r.rect)).toBe(true); expect(penetration(b, r.rect)).toBeGreaterThan(0); }
    }
  });

  it('is deterministic per seed and contributes zero bytes when absent or empty', () => {
    const a = JSON.stringify(planFractalCity({ ...BIG, seed: 5, blocks: ALL_USES }).boxes);
    const b = JSON.stringify(planFractalCity({ ...BIG, seed: 5, blocks: ALL_USES }).boxes);
    expect(a).toBe(b);
    const none = planFractalCity({ ...BIG, seed: 5 });
    const noneJson = JSON.stringify([none.boxes, none.grounds, none.ribbons, none.faces, none.stats]);
    for (const blocks of [null, [], {}, { map: [] }, [{ use: 'park' }], 'nope']) {
      const p = planFractalCity({ ...BIG, seed: 5, blocks });
      expect(JSON.stringify([p.boxes, p.grounds, p.ribbons, p.faces, p.stats])).toBe(noneJson);
      expect(p.stats.blocksLaid).toBeUndefined();
    }
  });

  it('rides compose_world overrides at the top level through the city theme adapter', () => {
    const blocks = [{ rect: { x: 1, y: 1, w: 4, d: 4 }, use: 'park' }];
    expect(cityThemeAdapter({ blocks, fidelity: 'massing' })).toEqual({ blocks, fidelity: 'massing' });
    expect(cityThemeAdapter({ context: { time: 'day' } })).toEqual({ time: 'day' });
  });
});

// ── fidelity: the same city, less dressing ─────────────────────────────────────────────
describe('fractal-city fidelity', () => {
  const BIG = { region: { x: 2, y: 2, w: 40, d: 28 }, depth: 3, anchor: 'tower' };
  const MASS = new Set(['building', 'anchor', 'midtower', 'townhouse', 'house']);
  const FURNISHING = ['street-lamp', 'stop-sign', 'street-signal', 'street-sign', 'power-pole', 'power-line', 'city-tree', 'city-palm', 'city-shrub', 'park-bin', 'park-bench', 'fence', 'freeway-lamp'];
  const MARKING = ['sidewalk-joint', 'crosswalk-vertical-road-stripe', 'crosswalk-horizontal-road-stripe', 'lot-stripe', 'playground-pad', 'play-sand'];
  const footprint = (b) => [b.kind, b.x, b.y, b.w, b.d, b.z0, b.z1, b.shape ?? null, b.class ?? null].join('|');
  const massKey = (plan) => plan.boxes.filter((b) => MASS.has(b.kind)).map(footprint).sort().join('\n');
  const RECIPES = [
    { ...BIG, seed: 1 },
    { ...BIG, seed: 2, landmark: 'cn-tower', civicAreas: ['school', 'city-park', 'strip-mall', 'town-square'], locale: 'europe' },
    { ...BIG, seed: 3, anchor: 'freeway', elements: { streetcars: true, townhouses: true }, climate: 'tropical' },
    { ...BIG, seed: 4, profile: 'town' },
    { ...BIG, seed: 5, baseScale: 0.6, elements: { civicDomes: true } },
    { ...BIG, seed: 6, blocks: [{ rect: { x: 4, y: 4, w: 8, d: 6 }, use: 'residential', fill: 'rows' }, { rect: { x: 24, y: 12, w: 8, d: 6 }, use: 'park' }] },
  ];

  it('normalizes the dial (aliases, junk → full) and an explicit full is byte-identical to absent', () => {
    expect(normalizeCityFidelity('massing')).toBe('massing');
    expect(normalizeCityFidelity('Skyline')).toBe('skyline');
    expect(normalizeCityFidelity('far')).toBe('skyline');
    expect(normalizeCityFidelity('mass')).toBe('massing');
    for (const v of [undefined, null, 'full', 'ultra', 3, {}]) expect(normalizeCityFidelity(v)).toBe('full');
    const a = planFractalCity({ ...BIG, seed: 7 }), b = planFractalCity({ ...BIG, seed: 7, fidelity: 'full' });
    expect(JSON.stringify([b.boxes, b.grounds, b.ribbons, b.faces, b.stats])).toBe(JSON.stringify([a.boxes, a.grounds, a.ribbons, a.faces, a.stats]));
    expect(a.stats.fidelity).toBeUndefined();
  });

  it('same seed at any fidelity is the same city: ribbons and mass footprints identical, only dressing gone', () => {
    for (const rec of RECIPES) {
      const full = planFractalCity(rec), mass = planFractalCity({ ...rec, fidelity: 'massing' }), sky = planFractalCity({ ...rec, fidelity: 'skyline' });
      const ribbons = JSON.stringify(full.ribbons);
      expect(JSON.stringify(mass.ribbons)).toBe(ribbons);
      expect(JSON.stringify(sky.ribbons)).toBe(ribbons);
      expect(massKey(mass)).toBe(massKey(full));
      // skyline merges attached townhouse units per row; every other mass is footprint-identical
      const skyNonRow = sky.boxes.filter((b) => MASS.has(b.kind) && b.kind !== 'townhouse').map(footprint).sort().join('\n');
      const fullNonRow = full.boxes.filter((b) => MASS.has(b.kind) && b.kind !== 'townhouse').map(footprint).sort().join('\n');
      expect(skyNonRow).toBe(fullNonRow);
      expect(mass.stats.blocks).toBe(full.stats.blocks);
      expect(mass.stats.buildings).toBe(full.stats.buildings);
      expect(mass.stats.landmarks).toBe(full.stats.landmarks);
      expect(mass.stats.civicAreas).toBe(full.stats.civicAreas);
      expect(mass.stats.fidelity).toBe('massing');
      expect(sky.stats.fidelity).toBe('skyline');
      expect(mass.stats.pruned.boxes + mass.boxes.length).toBe(full.boxes.length);
    }
  });

  it('massing drops furnishing, markings, stickers, vehicles and people, keeps roads, planes, masses and forms', () => {
    for (const rec of RECIPES) {
      const full = planFractalCity(rec), mass = planFractalCity({ ...rec, fidelity: 'massing' });
      const kinds = new Set(mass.boxes.map((b) => b.kind));
      for (const k of FURNISHING) expect(kinds.has(k), `${k} survived massing`).toBe(false);
      for (const b of mass.boxes) { expect(b.kind.startsWith('play-') || b.kind.startsWith('townhouse-') || b.kind.startsWith('tram-') || b.kind.startsWith('platform')).toBe(false); }
      const gk = new Set(mass.grounds.map((g) => g.kind));
      for (const k of MARKING) expect(gk.has(k), `${k} survived massing`).toBe(false);
      expect(mass.faces.length).toBe(0);                                   // no stickers / doors / cars / cyclists / pedestrians (no insets here)
      expect(mass.grounds[0]).toEqual(full.grounds[0]);                     // the ground plate
      expect(mass.grounds.filter((g) => g.kind === 'sidewalk').length).toBe(full.grounds.filter((g) => g.kind === 'sidewalk').length);
      expect(mass.grounds.filter((g) => g.kind === 'junction').length).toBe(full.grounds.filter((g) => g.kind === 'junction').length);
      // kept masses (garages included) are plain extrusions unless they carry their own form
      for (const b of mass.boxes.filter((b) => MASS.has(b.kind) || b.kind === 'garage')) {
        if (b.class === 'landmark' || b.class === 'religious' || b.class === 'civic') expect(b.lod).toBeUndefined();
        else expect(b.lod).toBe('mass');
      }
      if (rec.anchor === 'freeway') expect(mass.boxes.some((b) => b.kind === 'pillar')).toBe(true);   // the deck's structure stays
      if (rec.landmark) expect(mass.boxes.filter((b) => b.class === 'landmark').length).toBe(full.boxes.filter((b) => b.class === 'landmark').length);
      expect(mass.sources.length).toBe(0);                                  // no lamp heads → no night pools
    }
  });

  it('skyline also drops the small planes and garages and merges each townhouse row into one mass', () => {
    const rec = { ...BIG, seed: 3, elements: { townhouses: true }, profile: 'town' };
    const full = planFractalCity(rec), sky = planFractalCity({ ...rec, fidelity: 'skyline' });
    expect(full.boxes.some((b) => b.kind === 'garage')).toBe(true);
    expect(sky.boxes.some((b) => b.kind === 'garage')).toBe(false);
    for (const k of ['alley-floor', 'driveway', 'front-lawn', 'park-trail', 'park-shore', ...MARKING]) expect(sky.grounds.some((g) => g.kind === k)).toBe(false);
    const rows = new Set(full.boxes.filter((b) => b.kind === 'townhouse').map((b) => b.row));
    expect(rows.size).toBeGreaterThan(0);
    const merged = sky.boxes.filter((b) => b.kind === 'townhouse');
    expect(merged.length).toBe(rows.size);
    for (const m of merged) {
      const units = full.boxes.filter((b) => b.kind === 'townhouse' && b.row === m.row);
      expect(m.merged).toBe(units.length);
      expect(m.lod).toBe('mass');
      expect(m.x).toBeCloseTo(Math.min(...units.map((u) => u.x)), 9);
      expect(m.x + m.w).toBeCloseTo(Math.max(...units.map((u) => u.x + u.w)), 9);
      expect(m.y).toBeCloseTo(Math.min(...units.map((u) => u.y)), 9);
      expect(m.y + m.d).toBeCloseTo(Math.max(...units.map((u) => u.y + u.d)), 9);
    }
  });

  it('plans no walkers, traffic or people below full, and the assembled scene attaches none', () => {
    const rec = { ...BIG, seed: 6, walkers: true, traffic: true, people: true };
    const full = planFractalCity(rec);
    expect(full.walkerLoops.length).toBeGreaterThan(0);
    expect(full.carLanes.length).toBeGreaterThan(0);
    expect(full.faces.length).toBeGreaterThan(0);
    for (const fidelity of ['massing', 'skyline']) {
      const p = planFractalCity({ ...rec, fidelity });
      expect(p.walkerLoops).toBeUndefined();
      expect(p.carLanes).toBeUndefined();
      expect(p.faces.length).toBe(0);
      const scene = assembleFractalCityScene({ ...rec, fidelity, time: 'night' });
      expect(scene.walkerLoops).toBeUndefined();
      expect(scene.carLanes).toBeUndefined();
    }
    // the rendered face budget drops by well over an order of magnitude
    const fullScene = assembleFractalCityScene(rec), massScene = assembleFractalCityScene({ ...rec, fidelity: 'massing' });
    expect(massScene.faces.length * 10).toBeLessThan(fullScene.faces.length);
    expect(massScene.faces.length).toBeGreaterThan(100);
  });

  it('keeps inset edifice faces through the prune (they are the operator\'s own masses)', () => {
    const inset = { ref: 'edifice-x', mode: 'plaza', footprint: { x: 20, y: 14, w: 4, d: 4 }, plot: { x: 20.5, y: 14.5, w: 3, d: 3 }, faces: [{ corners: [[20.5, 14.5, 0], [23.5, 14.5, 0], [23.5, 14.5, 5], [20.5, 14.5, 5]], fill: '#abcdef' }] };
    const mass = planFractalCity({ ...BIG, seed: 8, insets: [inset], fidelity: 'massing' });
    expect(mass.faces.length).toBe(1);
    expect(mass.faces[0].inset).toBe('edifice-x');
    expect(mass.grounds.some((g) => g.kind === 'inset-plaza')).toBe(true);
    expect(mass.stats.insets[0].envelope.z1).toBe(5);
  });

  it('classifies every emitted kind on purpose (no fallback-classified kind across the option space)', () => {
    const rich = [
      // a landmark takes the anchor role, so the freeway (pillars) rides a recipe of its own
      { ...BIG, seed: 1, anchor: 'freeway', elements: { streetcars: true, townhouses: true, civicDomes: true }, locale: 'europe', climate: 'tropical', blocks: [{ rect: { x: 4, y: 4, w: 8, d: 6 }, use: 'residential' }, { rect: { x: 30, y: 20, w: 8, d: 6 }, use: 'civic' }] },
      { ...BIG, seed: 3, landmark: 'cn-tower', civicAreas: ['school', 'city-park', 'strip-mall', 'town-square'], blocks: [{ rect: { x: 4, y: 20, w: 8, d: 6 }, use: 'park' }, { rect: { x: 30, y: 4, w: 8, d: 6 }, use: 'plaza' }] },
      { ...BIG, seed: 2, profile: 'town', locale: 'philippines' },
    ];
    for (const rec of rich) {
      const census = lodClassCensus(planFractalCity(rec));
      expect(census.unclassified).toEqual([]);
      expect(census.boxes.building ?? census.boxes.house).toBe('mass');   // a town is houses, not buildings
      expect(census.boxes['street-lamp']).toBe('furnishing');
      expect(census.grounds.sidewalk).toBe('plane');
      if (rec.anchor === 'freeway') expect(census.boxes.pillar).toBe('structure');
      if (rec.profile === 'town') expect(census.boxes.garage).toBe('outbuilding');
    }
  });
});
