import { describe, expect, it } from 'vitest';

import { assembleFractalCityScene, normalizeFractalCityElements, planFractalCity } from './fractal-city.js';
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
