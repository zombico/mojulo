import { describe, it, expect } from 'vitest';

import {
  KIND_MOTION_COMIC,
  MOTION_COMIC_CONTRACT,
  normalizeMotionComicManifest,
  resolveMotionComicLayout,
  layoutSlotRects,
  validateMotionComicRefs,
  collectMotionComicSources,
  collectZoneSays,
} from './motion-comic-manifest';
import { buildPlayerDoc, renderMotionComicHtml } from './motion-comic-player';

function minimal(overrides = {}) {
  return {
    kind: KIND_MOTION_COMIC,
    scenes: [
      {
        base: [{ source: { ref: 'sk_page1' }, at: { x: 0, y: 100, w: 390, h: 520 } }],
        events: [
          { do: [{ say: { of: 'pl1', panel: 'p1', zone: 0 } }] },
          { do: [{ say: { text: 'Later that night…', carrier: 'narration', at: { x: 20, y: 20, w: 350, h: 60 } } }] },
        ],
      },
    ],
    ...overrides,
  };
}

const PAGE_SKETCH = {
  manifest: {
    kind: 'sequential-art',
    viewBox: { width: 1536, height: 2048 },
    panels: [
      {
        id: 'p1',
        bounds: { x: 46, y: 46, w: 1444, h: 939 },
        bubbleZones: [
          { x: 100, y: 200, w: 400, h: 160, label: 'blank speech', lettering: 'What is that light…?' },
          { x: 700, y: 900, w: 380, h: 140, label: 'blank shout' }, // no lettering
        ],
      },
      {
        id: 'p2',
        bounds: { x: 46, y: 1003, w: 713, h: 489 },
        bubbleZones: [
          { x: 120, y: 1060, w: 480, h: 170, label: 'blank speech', lettering: 'It knows my name.' },
        ],
      },
    ],
  },
};

const STORE = {
  sk_page1: PAGE_SKETCH,
  sk_fig: { manifest: { kind: 'figure' } },
};
const getSketch = (ref) => STORE[ref] || null;

describe('normalizeMotionComicManifest', () => {
  it('pins defaults: box preset, matte, lettering mode, ids, contract', () => {
    const out = normalizeMotionComicManifest(minimal());
    expect(out.contract).toBe(MOTION_COMIC_CONTRACT);
    expect(out.box).toEqual({ width: 390, height: 844, matte: '#000000', screen: 'phone-upright' });
    expect(out.lettering).toEqual({ mode: 'bubbles' });
    expect(out.scenes[0].id).toBe('s1');
    expect(out.scenes[0].base[0].id).toBe('pl1');
    expect(out.scenes[0].base[0].frame).toBe('panel');
    expect(out.scenes[0].base[0].source.face).toBe('auto');
    expect(out.scenes[0].events.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(out.scenes[0].events[0].do[0].say).toEqual({ of: 'pl1', panel: 'p1', zone: 0 });
  });

  it('accepts a freeform box and per-scene subtitles override', () => {
    const out = normalizeMotionComicManifest(minimal({
      box: { screen: { width: 1200, height: 500 }, matte: '#fff' },
      lettering: { mode: 'subtitles', subtitles: { at: 'top', enter: 'type-on', size: 24 } },
    }));
    expect(out.box).toEqual({ width: 1200, height: 500, matte: '#fff' });
    expect(out.lettering.mode).toBe('subtitles');
    expect(out.lettering.subtitles).toEqual({ at: 'top', enter: 'type-on', size: 24 });
  });

  it('rejects unknown screen presets, matte formats, and lettering modes', () => {
    expect(() => normalizeMotionComicManifest(minimal({ box: { screen: 'imax' } }))).toThrow(/unknown screen preset/);
    expect(() => normalizeMotionComicManifest(minimal({ box: { matte: 'black' } }))).toThrow(/matte must be a hex/);
    expect(() => normalizeMotionComicManifest(minimal({ lettering: { mode: 'karaoke' } }))).toThrow(/mode must be one of/);
  });

  it('rejects a delta carrying zero or multiple verbs', () => {
    const bad = minimal();
    bad.scenes[0].events.push({ do: [{ say: { text: 'x', at: { x: 0, y: 0, w: 10, h: 10 } }, clear: true }] });
    expect(() => normalizeMotionComicManifest(bad)).toThrow(/exactly ONE of show \| hide \| say \| swap \| move \| letter \| focus \| hold \| clear/);
    const empty = minimal();
    empty.scenes[0].events.push({ do: [{}] });
    expect(() => normalizeMotionComicManifest(empty)).toThrow(/exactly ONE/);
  });

  it('rejects hide/say references to unknown placements', () => {
    const bad = minimal();
    bad.scenes[0].events.push({ do: [{ hide: 'ghost' }] });
    expect(() => normalizeMotionComicManifest(bad)).toThrow(/hide must name a placement/);
    const badSay = minimal();
    badSay.scenes[0].events[0] = { do: [{ say: { of: 'ghost', panel: 'p1', zone: 0 } }] };
    expect(() => normalizeMotionComicManifest(badSay)).toThrow(/unknown placement 'ghost'/);
  });

  it("requires inline-say position in bubbles mode but not in subtitles mode", () => {
    const bare = minimal();
    bare.scenes[0].events[1] = { do: [{ say: { text: 'floating words' } }] };
    expect(() => normalizeMotionComicManifest(bare)).toThrow(/requires at/);
    const subs = minimal({ lettering: { mode: 'subtitles' } });
    subs.scenes[0].events[1] = { do: [{ say: { text: 'floating words' } }] };
    expect(() => normalizeMotionComicManifest(subs)).not.toThrow();
  });

  it('normalizes the panel-crop source form — the canonical grain', () => {
    const src = minimal();
    src.scenes[0].base[0] = { id: 'panel', source: { pageRef: 'sk_page1', panel: 'p1' }, at: { x: 8, y: 250, w: 374, h: 243 } };
    src.scenes[0].events = [{ do: [{ say: { of: 'panel', zone: 0 } }] }];  // panel implicit
    const out = normalizeMotionComicManifest(src);
    expect(out.scenes[0].base[0].source).toEqual({ pageRef: 'sk_page1', panel: 'p1', face: 'auto' });
    expect(out.scenes[0].events[0].do[0].say).toEqual({ of: 'panel', panel: 'p1', zone: 0 });
  });

  it('refuses a zone say reaching outside its panel crop, and both-source forms', () => {
    const cross = minimal();
    cross.scenes[0].base[0] = { id: 'panel', source: { pageRef: 'sk_page1', panel: 'p1' }, at: { x: 0, y: 0, w: 300, h: 200 } };
    cross.scenes[0].events = [{ do: [{ say: { of: 'panel', panel: 'p2', zone: 0 } }] }];
    expect(() => normalizeMotionComicManifest(cross)).toThrow(/can only read that panel's zones/);
    const both = minimal();
    both.scenes[0].base[0].source = { ref: 'sk_page1', pageRef: 'sk_page1', panel: 'p1' };
    expect(() => normalizeMotionComicManifest(both)).toThrow(/EITHER \{ pageRef, panel \} or \{ ref \}/);
  });

  it('collects sources and zone says', () => {
    const out = normalizeMotionComicManifest(minimal());
    expect([...collectMotionComicSources(out).keys()]).toEqual(['sk_page1']);
    const says = collectZoneSays(out);
    expect(says).toHaveLength(1);
    expect(says[0].placement.id).toBe('pl1');
  });
});

describe('validateMotionComicRefs (the store gate)', () => {
  it('passes when refs exist and zones resolve with lettering', () => {
    const out = normalizeMotionComicManifest(minimal());
    expect(() => validateMotionComicRefs(out, getSketch)).not.toThrow();
  });

  it('rejects a dangling source ref, naming where it is used', () => {
    const bad = minimal();
    bad.scenes[0].base[0].source.ref = 'sk_missing';
    bad.scenes[0].events = [];
    const out = normalizeMotionComicManifest(bad);
    expect(() => validateMotionComicRefs(out, getSketch)).toThrow(/'sk_missing' not found.*scene 's1' placement 'pl1'/);
  });

  it('rejects zone says against non-sequential-art sources', () => {
    const bad = minimal();
    bad.scenes[0].base[0].source.ref = 'sk_fig';
    const out = normalizeMotionComicManifest(bad);
    expect(() => validateMotionComicRefs(out, getSketch)).toThrow(/kind 'figure'/);
  });

  it('gates panel crops: pageRef must be sequential-art with that panel', () => {
    const wrongKind = minimal();
    wrongKind.scenes[0].base[0] = { id: 'panel', source: { pageRef: 'sk_fig', panel: 'p1' }, at: { x: 0, y: 0, w: 300, h: 200 } };
    wrongKind.scenes[0].events = [];
    expect(() => validateMotionComicRefs(normalizeMotionComicManifest(wrongKind), getSketch))
      .toThrow(/kind 'figure' — panel crops read a sequential-art page/);
    const noPanel = minimal();
    noPanel.scenes[0].base[0] = { id: 'panel', source: { pageRef: 'sk_page1', panel: 'p9' }, at: { x: 0, y: 0, w: 300, h: 200 } };
    noPanel.scenes[0].events = [];
    expect(() => validateMotionComicRefs(normalizeMotionComicManifest(noPanel), getSketch))
      .toThrow(/has no panel 'p9'/);
  });

  it('rejects missing panels, out-of-range zones, and letterless zones', () => {
    const noPanel = normalizeMotionComicManifest(minimal());
    noPanel.scenes[0].events[0].do[0].say.panel = 'p9';
    expect(() => validateMotionComicRefs(noPanel, getSketch)).toThrow(/no panel 'p9'/);
    const noZone = normalizeMotionComicManifest(minimal());
    noZone.scenes[0].events[0].do[0].say.zone = 5;
    expect(() => validateMotionComicRefs(noZone, getSketch)).toThrow(/zone 5 does not exist/);
    const noText = normalizeMotionComicManifest(minimal());
    noText.scenes[0].events[0].do[0].say.zone = 1;
    expect(() => validateMotionComicRefs(noText, getSketch)).toThrow(/no lettering text/);
  });
});

describe('buildPlayerDoc + renderMotionComicHtml', () => {
  const assets = {
    's1/pl1': {
      src: 'data:image/svg+xml;base64,AAAA',
      pageViewBox: { width: 1536, height: 2048 },
      zonesByPanel: {
        p1: [{ x: 100, y: 200, w: 400, h: 160, label: 'blank speech', lettering: 'What is that light…?' }],
      },
    },
  };

  it('maps a page zone into box coords through the placement rect', () => {
    const out = normalizeMotionComicManifest(minimal());
    const doc = buildPlayerDoc(out, assets);
    const say = doc.scenes[0].events[0].do[0];
    expect(say.t).toBe('say');
    expect(say.text).toBe('What is that light…?');
    // placement at {0,100,390,520} over viewBox 1536×2048
    expect(say.rect.x).toBeCloseTo(0 + (100 / 1536) * 390, 5);
    expect(say.rect.y).toBeCloseTo(100 + (200 / 2048) * 520, 5);
    expect(say.rect.w).toBeCloseTo((400 / 1536) * 390, 5);
    expect(say.rect.h).toBeCloseTo((160 / 2048) * 520, 5);
  });

  it('maps a zone through PANEL-CROP space when the placement is a panel', () => {
    const src = minimal();
    src.scenes[0].base[0] = { id: 'panel', source: { pageRef: 'sk_page1', panel: 'p1' }, at: { x: 0, y: 0, w: 300, h: 200 } };
    src.scenes[0].events = [{ do: [{ say: { of: 'panel', zone: 0 } }] }];
    const out = normalizeMotionComicManifest(src);
    const panelAssets = {
      's1/panel': {
        src: 'data:image/png;base64,BBBB',
        pageViewBox: { width: 1536, height: 2048 },
        panelBounds: { x: 100, y: 100, w: 600, h: 400 },
        zonesByPanel: { p1: [{ x: 150, y: 150, w: 100, h: 80, label: '', lettering: 'Hi.' }] },
      },
    };
    const doc = buildPlayerDoc(out, panelAssets);
    const say = doc.scenes[0].events[0].do[0];
    expect(say.rect).toEqual({ x: 25, y: 25, w: 50, h: 40 });
    expect(say.text).toBe('Hi.');
  });

  it('errors on a missing asset instead of emitting a broken page', () => {
    const out = normalizeMotionComicManifest(minimal());
    expect(() => buildPlayerDoc(out, {})).toThrow(/no resolved asset for placement 'pl1'/);
  });

  it('emits byte-identical HTML for the same inputs, with the DOC embedded and script-safe', () => {
    const source = minimal();
    source.scenes[0].events[1] = {
      do: [{ say: { text: 'sneaky </script> attack', at: { x: 10, y: 10, w: 100, h: 40 } } }],
    };
    const out = normalizeMotionComicManifest(source);
    const a = renderMotionComicHtml(out, { assets });
    const b = renderMotionComicHtml(out, { assets });
    expect(a).toBe(b);
    expect(a).toContain('const DOC =');
    expect(a).not.toContain('sneaky </script>');
    expect(a).toContain('sneaky \\u003c/script>');
    expect(a).toContain('background: #000000');
    expect(a).toContain('width: 390px');
  });

  it('resolves the effective lettering mode and subtitle defaults per scene', () => {
    const source = minimal({ lettering: { mode: 'subtitles', subtitles: { at: 'top' } } });
    source.scenes[0].lettering = { subtitles: { size: 26 } };
    source.scenes.push({
      lettering: { mode: 'bubbles' },
      base: [{ source: { ref: 'sk_page1' }, at: { x: 0, y: 0, w: 390, h: 844 } }],
      events: [{ do: [{ clear: true }] }],
    });
    const out = normalizeMotionComicManifest(source);
    const doc = buildPlayerDoc(out, { ...assets, 's2/pl1': assets['s1/pl1'] });
    expect(doc.scenes[0].mode).toBe('subtitles');
    expect(doc.scenes[0].subtitles.at).toBe('top');
    expect(doc.scenes[0].subtitles.size).toBe(26);
    expect(doc.scenes[0].subtitles.enter).toBe('fade'); // default preserved under overrides
    expect(doc.scenes[1].mode).toBe('bubbles');
  });
});

describe('layouts — full-spread and two-panel slots', () => {
  it('resolves slots to aspect-fitted rects (portrait stacks along the long axis)', () => {
    const src = minimal();
    src.scenes[0].layout = 'two-panel';
    src.scenes[0].base = [
      { id: 'a', source: { pageRef: 'sk_page1', panel: 'p1' }, slot: 1 },
      { id: 'b', source: { ref: 'sk_page1' }, slot: 2 },
    ];
    src.scenes[0].events = [{ do: [{ say: { of: 'a', zone: 0 } }] }];
    const out = resolveMotionComicLayout(normalizeMotionComicManifest(src), getSketch);
    // box 390×844, pad 12 → slots {12,12,366,404} and {12,428,366,404}
    expect(layoutSlotRects(out.box, 'two-panel')).toEqual([
      { x: 12, y: 12, w: 366, h: 404 },
      { x: 12, y: 428, w: 366, h: 404 },
    ]);
    // p1 aspect 1444/939 contain-fit into slot 1; page viewBox 0.75 into slot 2
    expect(out.scenes[0].base[0].at).toEqual({ x: 12, y: 95, w: 366, h: 238 });
    expect(out.scenes[0].base[0].slot).toBeUndefined();
    expect(out.scenes[0].base[1].at).toEqual({ x: 44, y: 428, w: 303, h: 404 });
  });

  it('rejects slots without a layout, and slot 2 in full-spread', () => {
    const noLayout = minimal();
    noLayout.scenes[0].base[0] = { source: { ref: 'sk_page1' }, slot: 1 };
    expect(() => normalizeMotionComicManifest(noLayout)).toThrow(/requires the scene to declare layout/);
    const badSlot = minimal();
    badSlot.scenes[0].layout = 'full-spread';
    badSlot.scenes[0].base[0] = { source: { ref: 'sk_page1' }, slot: 2 };
    expect(() => normalizeMotionComicManifest(badSlot)).toThrow(/slot must be 1\.\.1/);
  });
});

describe('swap — direct single-panel action', () => {
  function actionStory() {
    const src = minimal();
    src.scenes[0].base = [{ id: 'panel', source: { pageRef: 'sk_page1', panel: 'p1' }, at: { x: 0, y: 0, w: 300, h: 200 } }];
    src.scenes[0].events = [
      { do: [{ swap: { of: 'panel', to: { pageRef: 'sk_page1', panel: 'p2' } } }] },
      { do: [{ say: { of: 'panel', zone: 0 } }] },   // reads the ACTIVE panel: p2
    ];
    return src;
  }

  it('normalizes the swap, defaults the cut, and re-anchors later says to the active art', () => {
    const out = normalizeMotionComicManifest(actionStory());
    expect(out.scenes[0].events[0].do[0].swap).toEqual({ of: 'panel', to: { pageRef: 'sk_page1', panel: 'p2', face: 'auto' } });
    expect(out.scenes[0].events[1].do[0].say.panel).toBe('p2');
    const uses = collectMotionComicSources(out).get('sk_page1');
    expect(uses.map((u) => u.assetId)).toEqual(['panel', 'panel#v1']);
    expect(() => validateMotionComicRefs(out, getSketch)).not.toThrow();
  });

  it('gates swap targets like any panel crop', () => {
    const bad = actionStory();
    bad.scenes[0].events[0].do[0].swap.to = { pageRef: 'sk_page1', panel: 'p9' };
    bad.scenes[0].events = [bad.scenes[0].events[0]];
    expect(() => validateMotionComicRefs(normalizeMotionComicManifest(bad), getSketch)).toThrow(/has no panel 'p9'/);
  });

  it('lowers the swap to a variant asset and maps the say through the new panel', () => {
    const out = normalizeMotionComicManifest(actionStory());
    const assets = {
      's1/panel': {
        src: 'data:x;base64,A',
        pageViewBox: { width: 1536, height: 2048 },
        panelBounds: { x: 46, y: 46, w: 1444, h: 939 },
        zonesByPanel: {
          p1: [{ x: 100, y: 200, w: 400, h: 160, lettering: 'One' }],
          p2: [{ x: 120, y: 1060, w: 480, h: 170, lettering: 'Two' }],
        },
      },
      's1/panel#v1': {
        src: 'data:x;base64,B',
        pageViewBox: { width: 1536, height: 2048 },
        panelBounds: { x: 46, y: 1003, w: 713, h: 489 },
        zonesByPanel: {
          p1: [{ x: 100, y: 200, w: 400, h: 160, lettering: 'One' }],
          p2: [{ x: 120, y: 1060, w: 480, h: 170, lettering: 'Two' }],
        },
      },
    };
    const doc = buildPlayerDoc(out, assets);
    expect(doc.scenes[0].events[0].do[0]).toEqual({ t: 'swap', id: 'panel', src: 'data:x;base64,B', enter: 'cut' });
    const say = doc.scenes[0].events[1].do[0];
    expect(say.text).toBe('Two');
    // p2 bounds are the source space: (120-46)*(300/713) ≈ 31.1
    expect(say.rect.x).toBeCloseTo((120 - 46) * (300 / 713), 1);
    expect(say.rect.y).toBeCloseTo((1060 - 1003) * (200 / 489), 1);
  });
});

describe('splash layout and move — the camera-cheat primitive', () => {
  it('splash is the centered 80% showcase; full-spread bleeds edge to edge', () => {
    const box = { width: 390, height: 844 };
    expect(layoutSlotRects(box, 'splash')).toEqual([{ x: 39, y: 84, w: 312, h: 675 }]);
    expect(layoutSlotRects(box, 'full-spread')).toEqual([{ x: 0, y: 0, w: 390, h: 844 }]);
  });

  it('normalizes move with the eased default and re-anchors later zone says', () => {
    const src = minimal();
    src.scenes[0].base = [{ id: 'panel', source: { pageRef: 'sk_page1', panel: 'p1' }, at: { x: 0, y: 0, w: 300, h: 200 } }];
    src.scenes[0].events = [
      { do: [{ move: { of: 'panel', to: { x: 75, y: 50, w: 150, h: 100 } } }] },
      { do: [{ say: { of: 'panel', zone: 0 } }] },
    ];
    const out = normalizeMotionComicManifest(src);
    expect(out.scenes[0].events[0].do[0]).toEqual({ move: { of: 'panel', to: { x: 75, y: 50, w: 150, h: 100 } } });
    const assets = {
      's1/panel': {
        src: 'data:x;base64,A',
        pageViewBox: { width: 1536, height: 2048 },
        panelBounds: { x: 46, y: 46, w: 1444, h: 939 },
        zonesByPanel: { p1: [{ x: 100, y: 200, w: 400, h: 160, lettering: 'Hi.' }] },
      },
    };
    const doc = buildPlayerDoc(out, assets);
    expect(doc.scenes[0].events[0].do[0]).toEqual({ t: 'move', id: 'panel', to: { x: 75, y: 50, w: 150, h: 100 }, enter: 'ease' });
    // The say AFTER the move maps through the MOVED rect (150×100 at 75,50)
    const say = doc.scenes[0].events[1].do[0];
    expect(say.rect.x).toBeCloseTo(75 + (100 - 46) * (150 / 1444), 1);
    expect(say.rect.w).toBeCloseTo(400 * (150 / 1444), 1);
  });

  it('rejects a move naming an unknown placement or a bad enter', () => {
    const bad = minimal();
    bad.scenes[0].events = [{ do: [{ move: { of: 'ghost', to: { x: 0, y: 0, w: 10, h: 10 } } }] }];
    expect(() => normalizeMotionComicManifest(bad)).toThrow(/move.of must name a placement/);
    const badEnter = minimal();
    badEnter.scenes[0].events = [{ do: [{ move: { of: 'pl1', to: { x: 0, y: 0, w: 10, h: 10 } }, enter: 'pop' }] }];
    expect(() => normalizeMotionComicManifest(badEnter)).toThrow(/move enter must be one of ease \| cut/);
  });
});

describe('letter — SFX lettering as a composer-owned overlay', () => {
  it('normalizes with the 3d default, validates anchors and vocab', () => {
    const src = minimal();
    src.scenes[0].events.push({ do: [{ letter: { text: 'CRASH!', of: 'pl1', at: { x: 40, y: 40, w: 200, h: 60 }, rotate: -8 } }] });
    const out = normalizeMotionComicManifest(src);
    const letter = out.scenes[0].events[2].do[0].letter;
    expect(letter).toEqual({ text: 'CRASH!', at: { x: 40, y: 40, w: 200, h: 60 }, of: 'pl1', effect: '3d', rotate: -8 });
    const badOf = minimal();
    badOf.scenes[0].events = [{ do: [{ letter: { text: 'BAM', of: 'ghost', at: { x: 0, y: 0, w: 100, h: 40 } } }] }];
    expect(() => normalizeMotionComicManifest(badOf)).toThrow(/letter.of must name a placement/);
    const tooLong = minimal();
    tooLong.scenes[0].events = [{ do: [{ letter: { text: 'X'.repeat(25), at: { x: 0, y: 0, w: 100, h: 40 } } }] }];
    expect(() => normalizeMotionComicManifest(tooLong)).toThrow(/24 glyphs max/);
    const badEffect = minimal();
    badEffect.scenes[0].events = [{ do: [{ letter: { text: 'BAM', at: { x: 0, y: 0, w: 100, h: 40 }, effect: 'neon' } }] }];
    expect(() => normalizeMotionComicManifest(badEffect)).toThrow(/letter.effect must be one of/);
  });

  it('lowers to a deterministic glyph SVG data URI, anchored to its placement', () => {
    const src = minimal();
    src.scenes[0].base = [{ id: 'panel', source: { pageRef: 'sk_page1', panel: 'p1' }, at: { x: 0, y: 100, w: 300, h: 200 } }];
    src.scenes[0].events = [{ do: [{ letter: { text: 'BOOM', of: 'panel', at: { x: 50, y: 150, w: 150, h: 50 } } }] }];
    const out = normalizeMotionComicManifest(src);
    const assets = {
      's1/panel': {
        src: 'data:x;base64,A',
        pageViewBox: { width: 1536, height: 2048 },
        panelBounds: { x: 46, y: 46, w: 1444, h: 939 },
        zonesByPanel: { p1: [] },
      },
    };
    const a = buildPlayerDoc(out, assets);
    const b = buildPlayerDoc(out, assets);
    const letter = a.scenes[0].events[0].do[0];
    expect(letter.t).toBe('letter');
    expect(letter.src.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(letter.src).toBe(b.scenes[0].events[0].do[0].src);   // seeded, byte-stable
    expect(letter.rotate).toBe(-6);
    expect(letter.enter).toBe('slam-in');
    expect(letter.anchor.id).toBe('panel');
    const svg = Buffer.from(letter.src.split(',')[1], 'base64').toString('utf8');
    expect(svg).toContain('<path');   // real glyph contours from the font shelf
  });
});

describe('Balak grammar — hold, focus, tails', () => {
  it('normalizes hold and focus; focus.on must exist; focus false releases', () => {
    const src = minimal();
    src.scenes[0].events.push({ note: 'the wait', do: [{ hold: true }] });
    src.scenes[0].events.push({ do: [{ focus: { on: 'pl1' } }] });
    src.scenes[0].events.push({ do: [{ focus: false }] });
    const out = normalizeMotionComicManifest(src);
    expect(out.scenes[0].events[2].do[0]).toEqual({ hold: true });
    expect(out.scenes[0].events[3].do[0]).toEqual({ focus: { on: 'pl1' } });
    expect(out.scenes[0].events[4].do[0]).toEqual({ focus: false });
    const badFocus = minimal();
    badFocus.scenes[0].events = [{ do: [{ focus: { on: 'ghost' } }] }];
    expect(() => normalizeMotionComicManifest(badFocus)).toThrow(/focus.on must name a placement/);
    const badHold = minimal();
    badHold.scenes[0].events = [{ do: [{ hold: 'yes' }] }];
    expect(() => normalizeMotionComicManifest(badHold)).toThrow(/hold must be exactly true/);
  });

  it('normalizes say tails from the closed direction set', () => {
    const src = minimal();
    src.scenes[0].events[0] = { do: [{ say: { of: 'pl1', panel: 'p1', zone: 0, tail: 'down-right' } }] };
    const out = normalizeMotionComicManifest(src);
    expect(out.scenes[0].events[0].do[0].say.tail).toBe('down-right');
    const bad = minimal();
    bad.scenes[0].events[0] = { do: [{ say: { of: 'pl1', panel: 'p1', zone: 0, tail: 'sideways' } }] };
    expect(() => normalizeMotionComicManifest(bad)).toThrow(/say.tail must be one of/);
  });

  it('lowers hold and focus to the client doc; tail rides the say', () => {
    const src = minimal();
    src.scenes[0].events = [
      { do: [{ say: { of: 'pl1', panel: 'p1', zone: 0, tail: 'down' } }] },
      { do: [{ hold: true }] },
      { do: [{ focus: { on: 'pl1' } }] },
    ];
    const out = normalizeMotionComicManifest(src);
    const assets = {
      's1/pl1': {
        src: 'data:x;base64,A',
        pageViewBox: { width: 1536, height: 2048 },
        zonesByPanel: { p1: [{ x: 100, y: 200, w: 400, h: 160, lettering: 'Hi.' }] },
      },
    };
    const doc = buildPlayerDoc(out, assets);
    expect(doc.scenes[0].events[0].do[0].tail).toBe('down');
    expect(doc.scenes[0].events[1].do[0]).toEqual({ t: 'hold' });
    expect(doc.scenes[0].events[2].do[0]).toEqual({ t: 'focus', on: 'pl1' });
  });
});
