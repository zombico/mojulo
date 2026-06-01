import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyDepictionOverlay,
  buildConstellationGrid,
  buildPolygonizerRepairPrompt,
  compileSketchRecipe,
  lowerDepictionLayout,
  normalizeModelResponse,
  PANEL_DEPICTION_RECIPES,
  polygonizePrompt,
  validatePolygonizerManifest,
} from './index.js';

function bookshelfManifest() {
  return {
    title: 'Bookshelf with 4 rows',
    viewBox: { width: 620, height: 460 },
    polygonizer: {
      subject: 'bookshelf',
      impactPoint: [280, 235],
      concept: { movementConcept: 'portrait', depictionClass: 'object-portrait' },
      picture: {
        framing: 'object portrait',
        shotAngle: 'slight angle',
        cameraDistance: 'medium',
        compositionIntent: 'show four rows and shelf depth',
      },
      elements: [
        { role: 'cabinet-body', importance: 'primary', footprint: 'center', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'shelf-row', importance: 'primary-detail', footprint: 'inside cabinet', depthBand: 'midground', blockingNeeded: 'partition' },
        { role: 'book-spines', importance: 'secondary', footprint: 'inside rows', depthBand: 'foreground', blockingNeeded: 'cca-array' },
      ],
      blockingReality: [
        {
          role: 'cabinet-body-block',
          basis: 'cca',
          footprint: 'center cabinet volume',
          depthBand: 'midground',
          purpose: 'primary bookshelf mass',
        },
        {
          role: 'shelf-row-partition',
          basis: 'partition',
          footprint: 'four horizontal bands inside cabinet-body',
          attachesTo: 'cabinet-body',
          depthBand: 'midground',
          purpose: 'four readable shelf rows',
        },
        {
          role: 'book-spines-item',
          basis: 'array-item',
          footprint: 'repeated narrow vertical blocks inside shelf rows',
          repeats: 'book-spines',
          depthBand: 'foreground',
          purpose: 'book contents without hand-placing every spine',
        },
      ],
      draftingTable: {
        horizonY: 190,
        vanishingPoint: [460, 190],
        baselineY: 382,
        depthBands: { foreground: [300, 420], midground: [140, 300], background: [80, 140] },
        eyeLine: { direction: [-0.45, -0.35], stackingRule: 'front shelf faces paint above back panel' },
      },
      realityFacts: ['4 shelf rows', 'side walls', 'back panel', 'book spines'],
      minimalAbstractions: ['cabinet = solid', 'rows = partition cabinet volume into 4 bands'],
    },
    scene: {
      perspective: { mode: 'one-point', vanishingPoint: [460, 190], depthScale: 230 },
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'solid',
        role: 'cabinet-body',
        x: 150,
        y: 82,
        width: 260,
        height: 300,
        depth: 62,
        fill: '#8a654a',
        stroke: '#3f2f24',
        z: 9,
      },
      {
        kind: 'partition',
        target: 'cabinet-body',
        axis: 'y',
        count: 4,
        role: 'shelf-row',
        thickness: 13,
      },
      {
        kind: 'array',
        role: 'book-spines',
        count: 10,
        from: [190, 156],
        to: [360, 156],
        item: { kind: 'solid', width: 10, height: 48, depth: 18, fill: '#6d7c74' },
      },
    ],
  };
}

function bridgeManifest() {
  return {
    title: 'Golden Gate Bridge at an angle',
    viewBox: { width: 860, height: 430 },
    polygonizer: {
      subject: 'golden gate bridge',
      impactPoint: [260, 290],
      cameraIntent: 'angled span receding right',
      concept: { movementConcept: 'static-scene', depictionClass: 'landmark-portrait' },
      picture: {
        framing: 'angled landmark portrait',
        shotAngle: 'low street-level span view',
        cameraDistance: 'wide',
        compositionIntent: 'show two towers, receding deck, cable, and repeated suspenders',
      },
      elements: [
        { role: 'deck', importance: 'primary', footprint: 'long lower span', depthBand: 'foreground-to-background', blockingNeeded: 'cca' },
        { role: 'tower', importance: 'primary', footprint: 'near and far vertical anchors', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'suspenders', importance: 'primary-detail', footprint: 'between cable and deck', depthBand: 'midground', blockingNeeded: 'array-item' },
        { role: 'main-cable', importance: 'secondary', footprint: 'arc above deck', depthBand: 'midground', blockingNeeded: 'path' },
      ],
      blockingReality: [
        {
          role: 'deck-block',
          basis: 'cca',
          footprint: 'long lower span receding right',
          depthBand: 'foreground-to-background',
          purpose: 'primary bridge mass',
        },
        {
          role: 'tower-block',
          basis: 'cca',
          footprint: 'two vertical anchors, near larger than far',
          depthBand: 'midground',
          purpose: 'bridge identity',
        },
        {
          role: 'main-cable-path',
          basis: 'path',
          footprint: 'arc above deck through tower tops',
          depthBand: 'midground',
          purpose: 'suspension cable identity',
        },
        {
          role: 'suspender-item',
          basis: 'array-item',
          footprint: 'vertical repeated member between main-cable and deck',
          repeats: 'suspenders',
          depthBand: 'midground',
          purpose: 'suspension rhythm without enumerating every suspender',
        },
      ],
      draftingTable: {
        horizonY: 190,
        vanishingPoint: [760, 190],
        baselineY: 300,
        depthBands: { foreground: [260, 360], midground: [160, 260], background: [90, 160] },
        eyeLine: { direction: [-0.6, -0.25], stackingRule: 'near tower and near deck paint above far span' },
      },
      realityFacts: ['two main towers', 'long deck', 'main suspension cable arcs', 'vertical suspenders repeat along span'],
      minimalAbstractions: ['deck = solid', 'towers = solids', 'suspenders = array'],
    },
    scene: {
      perspective: { mode: 'one-point', vanishingPoint: [760, 190], depthScale: 260 },
      view: { direction: [-0.6, -0.25], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      { kind: 'solid', role: 'deck', x: 150, y: 278, width: 520, height: 22, depth: 120, fill: '#c9572d', z: 10 },
      { kind: 'solid', role: 'near-tower', x: 238, y: 116, width: 46, height: 178, depth: 42, fill: '#d46f42', z: 14 },
      { kind: 'solid', role: 'far-tower', x: 548, y: 142, width: 34, height: 128, depth: 34, fill: '#bd512c', z: 12 },
      { kind: 'polyline', role: 'main-cable', points: [[142, 206], [260, 124], [565, 150], [704, 206]], stroke: '#e08a5c', strokeWidth: 5, z: 24 },
      {
        kind: 'array',
        role: 'suspenders',
        count: 14,
        from: [170, 278],
        to: [670, 250],
        upperFrom: [170, 204],
        upperTo: [670, 198],
        item: { kind: 'line', stroke: '#f1a06b', strokeWidth: 2 },
        z: 23,
      },
    ],
  };
}

function blockingHouseManifest() {
  return {
    title: 'Blocking reality house',
    viewBox: { width: 860, height: 520 },
    polygonizer: {
      subject: 'simple house blocking reality demo',
      impactPoint: [402, 292],
      concept: { movementConcept: 'portrait', depictionClass: 'object-portrait' },
      picture: {
        framing: 'object portrait',
        shotAngle: 'slight left-front angle',
        cameraDistance: 'medium',
        compositionIntent: 'show house separated into body block, sloped roof panels, and repeated window blocks',
      },
      elements: [
        { role: 'house-body', importance: 'primary', footprint: 'center lower mass', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'roof', importance: 'primary-detail', footprint: 'sloped cap over body', depthBand: 'midground', blockingNeeded: 'panel-cca' },
        { role: 'window-band', importance: 'secondary', footprint: 'repeated facade panels', depthBand: 'foreground', blockingNeeded: 'cca-array' },
        { role: 'door', importance: 'secondary', footprint: 'front lower center', depthBand: 'foreground', blockingNeeded: 'cca' },
      ],
      blockingReality: [
        {
          role: 'house-body-block',
          basis: 'cca',
          footprint: 'main rectangular house mass, about 38% canvas width',
          depthBand: 'midground',
          purpose: 'primary readable building mass',
        },
        {
          role: 'roof-left-panel',
          basis: 'cca',
          footprint: 'left sloped roof plane attached to house-body',
          depthBand: 'midground',
          attachesTo: 'house-body',
          purpose: 'sloped roof face',
        },
        {
          role: 'roof-right-panel',
          basis: 'cca',
          footprint: 'right sloped roof plane attached to house-body',
          depthBand: 'midground',
          attachesTo: 'house-body',
          purpose: 'second sloped roof face and depth cue',
        },
        {
          role: 'window-item',
          basis: 'array-item',
          footprint: 'small repeated facade CCA',
          depthBand: 'foreground',
          repeats: 'window-band',
          purpose: 'habitable facade rhythm without hand-enumerating windows',
        },
        {
          role: 'door-block',
          basis: 'cca',
          footprint: 'front lower center block',
          depthBand: 'foreground',
          attachesTo: 'house-body',
          purpose: 'entry identity',
        },
      ],
      draftingTable: {
        horizonY: 190,
        vanishingPoint: [690, 184],
        baselineY: 390,
        depthBands: { foreground: [330, 450], midground: [190, 330], background: [90, 190] },
        eyeLine: { direction: [-0.48, -0.3], stackingRule: 'front facade and door paint above side/roof depth planes' },
      },
      realityFacts: ['body block', 'sloped roof', 'door', 'repeated window blocks'],
      minimalAbstractions: ['house = body CCA + roof panel CCAs + window array + door block'],
    },
    scene: {
      perspective: { mode: 'one-point', vanishingPoint: [690, 184], depthScale: 250 },
      view: { direction: [-0.48, -0.3], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      { kind: 'solid', role: 'house-body', x: 270, y: 210, width: 265, height: 165, depth: 96, fill: '#85664a', z: 10 },
      { kind: 'polygon', role: 'roof-left-panel', points: [[246, 222], [402, 140], [424, 164], [278, 246]], fill: '#664348', z: 17 },
      { kind: 'polygon', role: 'roof-right-panel', points: [[402, 140], [566, 224], [535, 250], [424, 164]], fill: '#553b43', z: 16 },
      {
        kind: 'array',
        role: 'window-band',
        count: 4,
        from: [306, 256],
        to: [475, 256],
        item: { kind: 'solid', width: 28, height: 34, depth: 8, fill: '#6d7c74' },
        z: 14,
      },
      { kind: 'solid', role: 'door-block', x: 378, y: 292, width: 50, height: 82, depth: 10, fill: '#4f3928', z: 24 },
    ],
  };
}

function cupPolygonizerManifest() {
  return {
    title: 'Volumizer cup',
    viewBox: { width: 420, height: 420 },
    polygonizer: {
      subject: 'hollow tapered cup',
      impactPoint: [210, 230],
      concept: { movementConcept: 'portrait', depictionClass: 'object-portrait' },
      picture: {
        framing: 'object portrait',
        shotAngle: 'eye-level slight top view',
        cameraDistance: 'medium',
        compositionIntent: 'show tapered cup rim and hollow interior',
      },
      elements: [
        { role: 'cup', importance: 'primary', footprint: 'center object', depthBand: 'midground', blockingNeeded: 'volume-ring-stack' },
      ],
      blockingReality: [
        {
          role: 'cup-volume',
          basis: 'cca',
          footprint: 'tapered hollow rotational volume',
          depthBand: 'midground',
          purpose: 'cup body, rim, hollow interior, and foot taper',
        },
      ],
      draftingTable: {
        horizonY: 150,
        vanishingPoint: [210, 150],
        baselineY: 330,
        depthBands: { foreground: [280, 380], midground: [150, 280], background: [70, 150] },
        eyeLine: { direction: [-0.45, -0.35], stackingRule: 'rim and inner hollow paint above lower rings' },
      },
      realityFacts: ['open top', 'hollow inside', 'rim wider than foot', 'tapered bottom'],
      minimalAbstractions: ['cup = CCA axis plus volumizer ring stack'],
    },
    scene: {
      perspective: { mode: 'one-point', vanishingPoint: [210, 150], depthScale: 220 },
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      {
        kind: 'volume',
        primitive: 'cup',
        role: 'cup',
        anchor: [210, 230],
        height: 170,
        rimWidth: 128,
        footWidth: 72,
        wallThickness: 10,
        rings: 12,
        openTop: true,
        fill: '#b1845e',
        stroke: '#4f3928',
        z: 20,
      },
    ],
  };
}

describe('polygonizer prompt orchestration', () => {
  it('accepts a one-trip bookshelf manifest and expands construction marks locally', async () => {
    const calls = [];
    const result = await polygonizePrompt({
      prompt: 'bookshelf with 4 rows at a slight angle',
      modelClient: async (input) => {
        calls.push(input);
        return bookshelfManifest();
      },
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].systemInstruction).toContain('Mojulo');
    expect(calls[0].systemInstruction).toContain('blockingReality');
    expect(result.manifest.marks.some((m) => m.kind === 'partition')).toBe(true);
    expect(result.manifest.polygonizer.blockingReality.some((block) => block.basis === 'partition')).toBe(true);
    expect(result.expandedManifest.marks.some((m) => m.kind === 'partition')).toBe(false);
    expect(result.expandedManifest.marks.some((m) => m.solidPresetRef === 'bookshelf')).toBe(false);
    expect(result.expandedManifest.neoRembrandt.polygonizerSubject).toBe('bookshelf');
  });

  it('accepts a one-trip bridge manifest with repeated suspenders', async () => {
    const result = await polygonizePrompt({
      prompt: 'Golden Gate Bridge at an angle',
      modelClient: async () => JSON.stringify(bridgeManifest()),
    });
    const suspenders = result.expandedManifest.marks.filter(
      (m) => m.source && m.constructionKind === 'array' && m.constructionRole === 'suspenders',
    );

    expect(result.ok).toBe(true);
    expect(result.manifest.polygonizer.realityFacts).toEqual(expect.arrayContaining(['two main towers']));
    expect(result.manifest.polygonizer.blockingReality).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'suspender-item', basis: 'array-item' })]),
    );
    expect(suspenders).toHaveLength(14);
    expect(suspenders.every((m) => m.kind === 'line')).toBe(true);
  });

  it('returns a repair prompt instead of silently accepting broken construction references', async () => {
    const broken = bookshelfManifest();
    broken.marks[1] = { ...broken.marks[1], target: 'missing-cabinet' };

    const result = await polygonizePrompt({
      prompt: 'bookshelf with 4 rows at a slight angle',
      modelClient: async () => broken,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain("target 'missing-cabinet'");
    expect(result.repairPrompt).toContain('Return corrected JSON only');
    expect(result.repairPrompt).toContain('missing-cabinet');
  });

  it('can spend a second trip only when local validation fails', async () => {
    const broken = bookshelfManifest();
    broken.marks[1] = { ...broken.marks[1], target: 'missing-cabinet' };
    const responses = [broken, bookshelfManifest()];

    const result = await polygonizePrompt({
      prompt: 'bookshelf with 4 rows at a slight angle',
      maxRepairs: 1,
      modelClient: async () => responses.shift(),
    });

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.expandedManifest.marks.some((m) => m.kind === 'partition')).toBe(false);
  });

  it('normalizes fenced JSON responses', () => {
    expect(normalizeModelResponse(`\n\`\`\`json\n${JSON.stringify(bookshelfManifest())}\n\`\`\``).polygonizer.subject).toBe('bookshelf');
  });

  it('exposes prompt-specific validation errors for count drift', () => {
    const wrong = bookshelfManifest();
    wrong.marks[1] = { ...wrong.marks[1], count: 3 };
    const result = validatePolygonizerManifest(wrong, 'bookshelf with 4 rows at a slight angle');

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('expected partition.count = 4');
  });

  it('requires drafting table alignment for perspective polygonizer manifests', () => {
    const wrong = bookshelfManifest();
    wrong.polygonizer.draftingTable = {
      ...wrong.polygonizer.draftingTable,
      vanishingPoint: [999, 190],
    };

    const result = validatePolygonizerManifest(wrong, 'bookshelf with 4 rows at a slight angle');

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('draftingTable.vanishingPoint must match');
  });

  it('requires primary brief elements to correspond to visible construction marks', () => {
    const wrong = bookshelfManifest();
    wrong.polygonizer.elements.push({
      role: 'missing-ladder',
      importance: 'primary',
      footprint: 'left edge',
      depthBand: 'foreground',
      blockingNeeded: 'cca',
    });

    const result = validatePolygonizerManifest(wrong, 'bookshelf with 4 rows at a slight angle');

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain("role 'missing-ladder' needs corresponding marks");
  });

  it('requires blocking reality to map to a visible mark family', () => {
    const wrong = bookshelfManifest();
    wrong.polygonizer.blockingReality.push({
      role: 'ladder-block',
      basis: 'cca',
      footprint: 'left edge',
      depthBand: 'foreground',
      purpose: 'extra support',
    });

    const result = validatePolygonizerManifest(wrong, 'bookshelf with 4 rows at a slight angle');

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain("blockingReality role 'ladder-block' needs corresponding");
  });

  it('rejects blocking reality that hand-enumerates repeated details', () => {
    const wrong = bookshelfManifest();
    wrong.polygonizer.blockingReality = [
      { role: 'window-1', basis: 'cca', purpose: 'manual detail', attachesTo: 'cabinet-body' },
      { role: 'window-2', basis: 'cca', purpose: 'manual detail', attachesTo: 'cabinet-body' },
      { role: 'window-3', basis: 'cca', purpose: 'manual detail', attachesTo: 'cabinet-body' },
      { role: 'window-4', basis: 'cca', purpose: 'manual detail', attachesTo: 'cabinet-body' },
    ];
    wrong.marks = wrong.marks.filter((mark) => mark.kind !== 'partition' && mark.kind !== 'array');

    const result = validatePolygonizerManifest(wrong, 'simple angled cabinet');

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('appears to enumerate repeated details');
  });

  it('builds standalone repair prompts for callers that own the model loop', () => {
    const prompt = buildPolygonizerRepairPrompt({
      prompt: 'Golden Gate Bridge at an angle',
      errors: ['bridge prompt needs an array of at least 8 suspenders/posts'],
      manifest: { title: 'bad' },
    });

    expect(prompt).toContain('Validation errors');
    expect(prompt).toContain('array of at least 8');
    expect(prompt).toContain('Previous manifest');
  });

  it('validates the corner-property streetlight artifact through the polygonizer path', () => {
    const artifactPath = new URL(
      '../../../../lite-template/integration/app-system/0530/polygonizer_corner_property_streetlight_artifact.json',
      import.meta.url,
    );
    const manifest = JSON.parse(readFileSync(artifactPath, 'utf8'));
    const result = validatePolygonizerManifest(
      manifest,
      'streetlight view of a single corner property with a fence on each side, two variations, a higher post per 5 mid posts',
    );

    expect(result.ok).toBe(true);
    expect(manifest.polygonizer.subject).toContain('corner property');
    expect(manifest.polygonizer.blockingReality.some((block) => block.basis === 'array-item')).toBe(true);
    expect(manifest.marks.filter((m) => m.kind === 'array' && /mid-posts/.test(m.role || ''))).toHaveLength(8);
    expect(result.expandedManifest.marks.some((m) => m.kind === 'array')).toBe(false);
    expect(result.expandedManifest.marks.filter((m) => m.source && /high-post-(?:0|5|10):front$/.test(m.role || '')).length).toBeGreaterThanOrEqual(12);
    expect(result.expandedManifest.marks.filter((m) => m.source && /mid-posts/.test(m.constructionRole || '')).length).toBeGreaterThan(40);
  });

  it('derives a CCA constellation grid that bounds house subelements', () => {
    const manifest = blockingHouseManifest();
    const grid = buildConstellationGrid(manifest);
    const nodes = Object.fromEntries(grid.nodes.map((node) => [node.role, node]));

    expect(grid.kind).toBe('cca-constellation-grid');
    expect(grid.axisMundi.anchor).toEqual([402, 292]);
    expect(grid.vanishingPoint).toEqual([690, 184]);
    expect(grid.nodes).toHaveLength(manifest.polygonizer.elements.length);
    expect(nodes['house-body'].parent).toBe(null);
    expect(nodes.roof.parent).toBe('house-body');
    expect(nodes['window-band'].parent).toBe('house-body');
    expect(nodes.door.parent).toBe('house-body');
    expect(nodes.roof.overflow).toBe('attachment');
    expect(nodes['window-band'].region).toBe('facade-band');
    expect(nodes.door.region).toBe('lower-front');
    expect(nodes.roof.renderOrder).toBeGreaterThan(nodes['house-body'].renderOrder);
    expect(nodes.door.bounds.y).toBeGreaterThan(nodes['house-body'].bounds.y);
    expect(nodes['window-band'].bounds.x).toBeGreaterThanOrEqual(nodes['house-body'].bounds.x);
    expect(nodes['window-band'].bounds.x + nodes['window-band'].bounds.width).toBeLessThanOrEqual(
      nodes['house-body'].bounds.x + nodes['house-body'].bounds.width,
    );
  });

  it('normalizes supplied constellation relative-grid cells into full CCA nodes', () => {
    const manifest = {
      title: 'Three cubes on constellation grid',
      viewBox: { width: 600, height: 360 },
      polygonizer: {
        subject: 'three cubes on a grid',
        impactPoint: [300, 220],
        elements: [
          { role: 'left-cube', importance: 'primary', depthBand: 'midground', blockingNeeded: 'cca' },
          { role: 'mid-cube', importance: 'primary', depthBand: 'midground', blockingNeeded: 'cca' },
          { role: 'right-cube', importance: 'primary', depthBand: 'midground', blockingNeeded: 'cca' },
        ],
        blockingReality: [
          { role: 'left-cube-block', basis: 'cca', purpose: 'left cube' },
          { role: 'mid-cube-block', basis: 'cca', purpose: 'middle cube' },
          { role: 'right-cube-block', basis: 'cca', purpose: 'right cube' },
        ],
        draftingTable: { horizonY: 120, vanishingPoint: [300, 120], depthBands: { foreground: [250, 340], midground: [130, 250], background: [40, 130] } },
        realityFacts: ['left cube', 'middle cube', 'right cube'],
        minimalAbstractions: ['three cubes = three solid CCA marks snapped to constellation cells'],
      },
      scene: {
        perspective: { mode: 'one-point', vanishingPoint: [300, 120] },
        view: { direction: [-0.45, -0.35], baseZ: 10 },
        light: { direction: [-0.58, -0.82], z: 0.72 },
        palette: 'warm-low-key',
      },
      marks: [
        { kind: 'solid', role: 'left-cube', x: 110, y: 210, width: 64, height: 64, depth: 26, fill: '#b1845e', stroke: '#4f3928', z: 10 },
        { kind: 'solid', role: 'mid-cube', x: 310, y: 210, width: 64, height: 64, depth: 26, fill: '#8f9f78', stroke: '#38432f', z: 11 },
        { kind: 'solid', role: 'right-cube', x: 510, y: 210, width: 64, height: 64, depth: 26, fill: '#6d8fa3', stroke: '#2d3c45', z: 12 },
      ],
    };
    manifest.polygonizer.constellation = {
      kind: 'cca-constellation-grid',
      layout: { kind: 'relative-grid', cols: 12, rows: 6, pad: 0.1, gap: 0 },
      vanishingPoint: [300, 120],
      nodes: [
        { role: 'left-cube', cell: { col: 1, row: 3, colSpan: 2, rowSpan: 2 } },
        { role: 'mid-cube', cell: { col: 5, row: 3, colSpan: 2, rowSpan: 2 } },
        { role: 'right-cube', cell: { col: 9, row: 3, colSpan: 2, rowSpan: 2 } },
      ],
    };

    const result = validatePolygonizerManifest(manifest, 'three cubes on a grid');
    const nodes = result.expandedManifest.polygonizer.constellation.nodes;

    expect(result.ok).toBe(true);
    expect(nodes.every((node) => node.gridCellResolved)).toBe(true);
    expect(nodes.map((node) => node.bounds.x)).toEqual([100, 260, 420]);
    expect(nodes.map((node) => node.anchor[0])).toEqual([140, 300, 460]);
    expect(nodes.every((node) => node.cca.lengthAxis && node.cca.heightAxis)).toBe(true);
    expect(result.expandedManifest.neoRembrandt.elementMandalaCount).toBe(3);
  });

  it('derives constellation nodes from element cells when a relative placement grid is supplied', () => {
    const manifest = cupPolygonizerManifest();
    manifest.viewBox = { width: 600, height: 360 };
    manifest.polygonizer.placementGrid = { kind: 'relative-grid', cols: 12, rows: 6, pad: 0.1 };
    manifest.polygonizer.elements = [
      { role: 'left-cube', importance: 'primary', cell: { col: 1, row: 3, colSpan: 2, rowSpan: 2 }, blockingNeeded: 'cca' },
      { role: 'mid-cube', importance: 'primary', cell: { col: 5, row: 3, colSpan: 2, rowSpan: 2 }, blockingNeeded: 'cca' },
      { role: 'right-cube', importance: 'primary', cell: { col: 9, row: 3, colSpan: 2, rowSpan: 2 }, blockingNeeded: 'cca' },
    ];

    const grid = buildConstellationGrid(manifest);

    expect(grid.layout.kind).toBe('relative-grid');
    expect(grid.nodes.map((node) => node.bounds.x)).toEqual([100, 260, 420]);
    expect(grid.nodes.map((node) => node.anchor[0])).toEqual([140, 300, 460]);
    expect(grid.nodes.map((node) => node.role)).toEqual(['left-cube', 'mid-cube', 'right-cube']);
  });

  it('attaches the derived constellation to expanded polygonizer manifests', () => {
    const result = validatePolygonizerManifest(blockingHouseManifest(), 'simple house blocking reality demo');
    const constellation = result.expandedManifest.polygonizer.constellation;
    const doorMarks = result.expandedManifest.marks.filter((mark) => mark.constellationRole === 'door');
    const windowMarks = result.expandedManifest.marks.filter((mark) => mark.constellationRole === 'window-band');

    expect(result.ok).toBe(true);
    expect(constellation.kind).toBe('cca-constellation-grid');
    expect(constellation.nodes.map((node) => node.role)).toEqual(['house-body', 'roof', 'window-band', 'door']);
    expect(result.expandedManifest.neoRembrandt.constellationAnnotatedMarkCount).toBeGreaterThan(0);
    expect(doorMarks.length).toBeGreaterThan(0);
    expect(doorMarks.every((mark) => mark.constellationParent === 'house-body')).toBe(true);
    expect(windowMarks.length).toBeGreaterThan(0);
    expect(windowMarks.every((mark) => mark.constructionKind === 'array')).toBe(true);
    expect(new Set(windowMarks.map((mark) => mark.constellationFit))).toEqual(new Set(['inside']));
    expect(result.expandedManifest.marks.some((mark) => mark.kind === 'array')).toBe(false);
  });

  it('rejects supplied constellation grids that contradict the scene vanishing point', () => {
    const wrong = blockingHouseManifest();
    wrong.polygonizer.constellation = {
      ...buildConstellationGrid(wrong),
      vanishingPoint: [200, 120],
    };

    const result = validatePolygonizerManifest(wrong, 'simple house blocking reality demo');

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('constellation.vanishingPoint must match');
  });

  it('validates a volumizer cup through constellation attribution', () => {
    const result = validatePolygonizerManifest(cupPolygonizerManifest(), 'hollow tapered cup');
    const cupMarks = result.expandedManifest.marks.filter((mark) => mark.constellationRole === 'cup');
    const outerRings = cupMarks.filter((mark) => mark.volumeSurface === 'outer-ring');

    expect(result.ok).toBe(true);
    expect(result.expandedManifest.neoRembrandt.constellationDebugMarkCount).toBe(0);
    expect(result.expandedManifest.marks.some((mark) => mark.constellationDebug)).toBe(false);
    expect(result.expandedManifest.marks.some((mark) => mark.kind === 'volume')).toBe(false);
    expect(result.expandedManifest.polygonizer.constellation.nodes).toHaveLength(1);
    expect(cupMarks.length).toBeGreaterThan(20);
    expect(outerRings).toHaveLength(12);
    expect(new Set(cupMarks.map((mark) => mark.constellationFit))).toEqual(new Set(['inside']));
    expect(outerRings[0].ring.outerRx).toBeGreaterThan(outerRings[outerRings.length - 1].ring.outerRx);
  });

  it('renders an opt-in visible constellation grid with tri-section depth dots', () => {
    const manifest = cupPolygonizerManifest();
    manifest.polygonizer.constellation = {
      ...buildConstellationGrid(manifest),
      debugVisible: true,
    };
    const result = validatePolygonizerManifest(manifest, 'hollow tapered cup');
    const debugMarks = result.expandedManifest.marks.filter((mark) => mark.constellationDebug);
    const roles = new Set(debugMarks.map((mark) => mark.role));
    const depthAxis = debugMarks.find((mark) => mark.role === 'constellation:cup:depth-axis');
    const farDot = debugMarks.find((mark) => mark.role === 'constellation:cup:z-far-dot');
    const centerDot = debugMarks.find((mark) => mark.role === 'constellation:cup:z-center-dot');
    const vp = result.expandedManifest.scene.perspective.vanishingPoint;

    expect(result.ok).toBe(true);
    expect(result.expandedManifest.neoRembrandt.constellationDebugMarkCount).toBeGreaterThanOrEqual(9);
    expect([...roles]).toEqual(expect.arrayContaining([
      'constellation:cup:anchor-dot',
      'constellation:cup:bounds',
      'constellation:cup:length-axis',
      'constellation:cup:height-axis',
      'constellation:cup:depth-axis',
      'constellation:cup:z-near-dot',
      'constellation:cup:z-center-dot',
      'constellation:cup:z-far-dot',
    ]));
    expect(farDot.depthSample).toBe('far');
    expect(centerDot.depthSample).toBe('center');
    expect(distance([farDot.cx, farDot.cy], vp)).toBeLessThan(distance([centerDot.cx, centerDot.cy], vp));
    expect(depthAxis.points[1]).toEqual([farDot.cx, farDot.cy]);
  });

  it('compiles a garment pattern recipe into blueprint primitives before validation', () => {
    const manifest = compileSketchRecipe({
      kind: 'garmentPattern',
      subject: 'blueprint-style garment pattern for jeans, with pattern pieces and labels',
      style: 'blueprint',
      anchors: ['front leg piece', 'back leg piece', 'waistband strip', 'notch ticks'],
    });
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);

    expect(result.ok).toBe(true);
    expect(manifest.polygonizer.outputStyle).toBe('blueprint');
    expect(manifest.scene.renderMode).toBe('grid-render');
    expect(manifest.polygonizer.pureMandala.kind).toBe('flat-blueprint-sheet');
    expect(manifest.polygonizer.recipeAudit.kind).toBe('garmentPattern');
    expect(manifest.marks.some((mark) => mark.kind === 'garmentPattern')).toBe(false);
    expect(new Set(manifest.marks.map((mark) => mark.kind))).toEqual(
      new Set(['rect', 'line', 'polygon', 'polyline', 'array', 'text']),
    );
    expect(result.expandedManifest.marks.some((mark) => mark.kind === 'array')).toBe(false);
    expect(result.expandedManifest.marks.some((mark) => mark.kind === 'garmentPattern')).toBe(false);
  });

  it('compiles an architectural construction recipe from a zero-vector mandala map', () => {
    const manifest = compileSketchRecipe({
      kind: 'architecturalConstruction',
      subject: 'craftsman cottage with porch steps chimney and repeated facade windows',
      style: 'craftsman',
    });
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);

    expect(result.ok).toBe(true);
    expect(manifest.polygonizer.outputStyle).toBe('architectural-construction');
    expect(manifest.polygonizer.pureMandala.kind).toBe('zero-vector-element-map');
    expect(manifest.polygonizer.pureMandala.slotMap.kind).toBe('architectural-zero-vector-map');
    expect(manifest.polygonizer.pureMandala.plannedElements.map((item) => item.role)).toEqual(
      expect.arrayContaining(['house-body', 'roof', 'door', 'porch', 'steps', 'chimney', 'window-band']),
    );
    expect(manifest.polygonizer.pureMandala.collisionPolicy.rule).toContain('must not overlap');
    expect(manifest.polygonizer.architecturalLibraries.doors.map((item) => item.id)).toContain('craftsman-panel');
    expect(manifest.polygonizer.architecturalLibraries.roofs.map((item) => item.id)).toContain('gable');
    expect(manifest.polygonizer.architecturalLibraries.porches.map((item) => item.id)).toContain('covered');
    expect(manifest.polygonizer.architecturalLibraries.steps.map((item) => item.id)).toContain('front-treads');
    expect(manifest.polygonizer.pureMandala.fitRules.join('\n')).toContain('door occupies center lower');
    expect(manifest.marks.some((mark) => mark.role === 'house-body' && mark.kind === 'solid')).toBe(true);
    expect(manifest.marks.some((mark) => mark.role === 'door' && mark.kind === 'solid')).toBe(true);
    expect(manifest.marks.some((mark) => mark.role === 'porch' && mark.kind === 'solid')).toBe(true);
    expect(manifest.marks.some((mark) => mark.role === 'steps' && mark.kind === 'array')).toBe(true);
    expect(manifest.marks.some((mark) => mark.role === 'chimney' && mark.kind === 'solid')).toBe(true);
    expect(manifest.marks.some((mark) => mark.kind === 'facePattern' && mark.role === 'window-band')).toBe(true);
    expect(result.expandedManifest.marks.some((mark) => mark.kind === 'facePattern')).toBe(false);
    expect(result.expandedManifest.marks.some((mark) => mark.faceAttachment?.patternRole === 'window-band')).toBe(true);
  });

  it.each([
    ['tartan', 'rect'],
    ['houndstooth', 'polygon'],
    ['victorian wallpaper', 'oval'],
    ['mandala fabric', 'circle'],
  ])('compiles %s garment textile recipes into aligned repeat primitives', (style, expectedKind) => {
    const manifest = compileSketchRecipe({
      kind: 'garmentPattern',
      subject: `${style} garment textile swatch`,
      style,
    });
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);

    expect(result.ok).toBe(true);
    expect(manifest.polygonizer.outputStyle).toBe('pattern-sheet');
    expect(manifest.polygonizer.pureMandala.kind).toBe('flat-textile-repeat-sheet');
    expect(manifest.polygonizer.pureMandala.pattern.alignment).toBe('orthographic locked grid');
    expect(manifest.polygonizer.recipeAudit.kind).toBe('garmentPattern');
    expect(manifest.polygonizer.recipeAudit.style).toBeDefined();
    expect(manifest.marks.some((mark) => mark.kind === expectedKind)).toBe(true);
    expect(manifest.marks.every((mark) => !['tartan', 'houndstooth', 'victorianWallpaper', 'mandalaFabric'].includes(mark.kind))).toBe(true);
    expect(manifest.marks.some((mark) => /^fabric-mandala-/.test(mark.role || '') && mark.opacity < 0.15)).toBe(true);
    expect(result.expandedManifest.marks.every((mark) => mark.kind !== 'garmentPattern')).toBe(true);
  });

  it('preserves depiction display metadata without creating renderer primitives', () => {
    const manifest = compileSketchRecipe({
      kind: 'propStudy',
      subject: 'sword comparison page',
      depiction: {
        mode: 'unrelated',
        display: { kind: 'comic-page', panelCount: 5, borderWidth: 1 },
        panelBlocking: {
          paradigm: 'unequal-comic-page',
          eyeLine: 'large silhouette panel, then detail panels, then final annotation strip',
        },
        panels: [
          { id: 'silhouette', concern: 'object-portrait', constellation: 'applies' },
          { id: 'detail', concern: 'material-detail', constellation: 'does-not-apply' },
        ],
      },
    });
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);

    expect(result.ok).toBe(true);
    expect(manifest.depiction.paradigm).toBe('depiction');
    expect(manifest.depiction.mode).toBe('unrelated');
    expect(manifest.depiction.display.kind).toBe('comic-page');
    expect(manifest.depiction.display.panelCount).toBe(5);
    expect(manifest.depiction.panelBlocking.paradigm).toBe('unequal-comic-page');
    expect(manifest.depiction.panels[1].constellation).toBe('does-not-apply');
    expect(manifest.depiction.panels).toHaveLength(5);
    expect(manifest.marks.filter((mark) => mark.depictionPanel)).toHaveLength(5);
    expect(manifest.marks.every((mark) => mark.kind !== 'comic-page')).toBe(true);
    expect(manifest.marks.every((mark) => mark.kind !== 'unequal-comic-page')).toBe(true);
  });

  it('lowers a full equal grid depiction to 1px rect panel frames', () => {
    const { depiction, marks } = lowerDepictionLayout({
      paradigm: 'depiction',
      mode: 'related-physical-visual',
      display: { kind: 'full-equal-grid', panelCount: 4, borderWidth: 1, pad: 20, gap: 10 },
      panelBlocking: { paradigm: 'full-equal-grid', eyeLine: 'left-to-right, top-to-bottom' },
      panels: [
        { id: 'one', concern: 'scene', constellation: 'applies' },
        { id: 'two', concern: 'detail', constellation: 'applies' },
        { id: 'three', concern: 'detail', constellation: 'applies' },
        { id: 'four', concern: 'resolution', constellation: 'applies' },
      ],
    }, { width: 420, height: 300 });

    expect(depiction.panels).toHaveLength(4);
    expect(marks).toHaveLength(4);
    expect(new Set(marks.map((mark) => mark.kind))).toEqual(new Set(['rect']));
    expect(new Set(marks.map((mark) => mark.strokeWidth))).toEqual(new Set([1]));
    expect(marks[0]).toMatchObject({ x: 20, y: 20, w: 185, h: 125 });
    expect(marks[3]).toMatchObject({ x: 215, y: 155, w: 185, h: 125 });
    expect(marks.every((mark) => mark.depictionPanel)).toBe(true);
  });

  it('lowers comic-page panel blocking to unequal rect panel frames', () => {
    const manifest = compileSketchRecipe({
      kind: 'propStudy',
      subject: 'coffee mug lifecycle page',
      depiction: {
        mode: 'related-physical-visual',
        display: { kind: 'comic-page', panelCount: 5, borderWidth: 1, pad: 24, gap: 8 },
        panelBlocking: {
          paradigm: 'unequal-comic-page',
          eyeLine: 'establishing panel first, detail beats second, wide resolution last',
        },
        panels: [
          { id: 'establishing', concern: 'scene', constellation: 'applies' },
          { id: 'rim', concern: 'object-detail', constellation: 'does-not-apply' },
          { id: 'handle', concern: 'object-detail', constellation: 'does-not-apply' },
          { id: 'blueprint', concern: 'blueprint-inset', constellation: 'does-not-apply' },
          { id: 'use', concern: 'scene-resolution', constellation: 'applies' },
        ],
      },
    });
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);
    const panelMarks = manifest.marks.filter((mark) => mark.depictionPanel);
    const widths = new Set(panelMarks.map((mark) => mark.w));
    const heights = new Set(panelMarks.map((mark) => mark.h));

    expect(result.ok).toBe(true);
    expect(panelMarks).toHaveLength(5);
    expect(widths.size).toBeGreaterThan(1);
    expect(heights.size).toBeGreaterThan(1);
    expect(manifest.depiction.panels.find((panel) => panel.id === 'blueprint').constellation).toBe('does-not-apply');
    expect(panelMarks.every((mark) => mark.kind === 'rect')).toBe(true);
    expect(panelMarks.every((mark) => !['comic-page', 'unequal-comic-page'].includes(mark.kind))).toBe(true);
  });

  it('lowers comic panels with white paper, noisy outlines, and optional static backgrounds', () => {
    const { depiction, marks } = lowerDepictionLayout({
      paradigm: 'depiction',
      mode: 'unrelated',
      display: {
        kind: 'comic-page',
        panelCount: 2,
        borderWidth: 2,
        pad: 24,
        gap: 10,
        outlineNoise: 0.025,
        backgroundMode: 'static-speed-lines',
      },
      panels: [
        { id: 'closeup', concern: 'face-close-up', constellation: 'does-not-apply' },
        {
          id: 'swing',
          concern: 'foreground-figure-over-static-bg',
          constellation: 'applies',
          background: { mode: 'static-gradient', from: '#ffffff', to: '#dbeafe', bands: 4 },
        },
      ],
    }, { width: 560, height: 320 });

    const paper = marks.find((mark) => mark.role === 'depiction-page-paper');
    const panelMarks = marks.filter((mark) => mark.depictionPanel);
    const backgrounds = marks.filter((mark) => mark.staticPanelBackground);

    expect(depiction.display.comicPanel).toBe(true);
    expect(depiction.panels.every((panel) => panel.comicPanel)).toBe(true);
    expect(depiction.panels.every((panel) => panel.foregroundReality === 'form-lighting')).toBe(true);
    expect(paper).toMatchObject({ kind: 'rect', fill: '#ffffff', comicPanelPaper: true });
    expect(panelMarks).toHaveLength(2);
    expect(panelMarks.every((mark) => mark.kind === 'polygon')).toBe(true);
    expect(panelMarks.every((mark) => mark.panelOutlineNoise === 0.025)).toBe(true);
    expect(panelMarks.every((mark) => mark.polygonLock.source === 'comicPanel')).toBe(true);
    expect(backgrounds.some((mark) => mark.kind === 'line' && mark.panelBackgroundMode === 'static-speed-lines')).toBe(true);
    expect(backgrounds.some((mark) => mark.kind === 'rect' && mark.panelBackgroundMode === 'static-gradient')).toBe(true);
    expect(marks.every((mark) => mark.kind !== 'comicPanel')).toBe(true);
  });

  it('lowers depiction lettering carriers into existing marks above panel worlds', () => {
    const { depiction, marks } = lowerDepictionLayout({
      paradigm: 'depiction',
      mode: 'related-physical-visual',
      display: { kind: 'comic-page', panelCount: 2, borderWidth: 1, pad: 20, gap: 8 },
      panels: [
        { id: 'scene', concern: 'figure-scene', constellation: 'applies' },
        { id: 'caption-panel', concern: 'narration', constellation: 'does-not-apply' },
      ],
      lettering: {
        carriers: [
          {
            id: 'hello',
            kind: 'speech',
            panel: 'scene',
            text: 'we found it',
            textCase: 'caps',
            headAnchor: [220, 198],
            box: { x: 62, y: 48, w: 150, h: 62 },
          },
          {
            id: 'caption',
            kind: 'narration',
            panel: 'caption-panel',
            text: 'Later, the evidence becomes clear.',
            textCase: 'regular',
            box: { x: 260, y: 230, w: 210, h: 58 },
          },
          {
            id: 'bang',
            kind: 'shout',
            panel: 'scene',
            text: 'Run!',
            effect: 'shout',
            tailTo: [330, 170],
            box: { x: 300, y: 50, w: 130, h: 70 },
          },
        ],
      },
    }, { width: 520, height: 340 });
    const lettering = marks.filter((mark) => mark.depictionLettering);
    const speechTail = lettering.find((mark) => mark.role === 'lettering-hello-tail');
    const speechBody = lettering.find((mark) => mark.role === 'lettering-hello-bubble');
    const shoutBody = lettering.find((mark) => mark.role === 'lettering-bang-shout-box');
    const captionBody = lettering.find((mark) => mark.role === 'lettering-caption-box');
    const speechText = lettering.find((mark) => mark.role === 'lettering-hello-text-1');

    expect(depiction.lettering.paradigm).toBe('lettering');
    expect(depiction.lettering.carriers).toHaveLength(3);
    expect(lettering.length).toBeGreaterThan(6);
    expect(speechTail).toMatchObject({ kind: 'polygon', letteringTail: true });
    expect(speechTail.points).toHaveLength(5);
    expect(speechTail.mouthAnchor).toEqual([220, 210]);
    expect(speechTail.shortestToMouth).toBe(true);
    expect(speechBody).toMatchObject({ kind: 'polygon', balloonShape: 'elliptical', letteringOutlineNoise: 0.018 });
    expect(shoutBody.kind).toBe('polygon');
    expect(shoutBody.letteringOutlineNoise).toBe(0.01);
    expect(captionBody.kind).toBe('rect');
    expect(speechText.value).toBe('WE FOUND IT');
    expect(new Set(lettering.map((mark) => mark.kind))).toEqual(new Set(['rect', 'polygon', 'text']));
    expect(lettering.every((mark) => !['speech', 'speechBubble', 'narration', 'shout'].includes(mark.kind))).toBe(true);
  });

  it('lets recipes carry speech bubble shorthand without adding speech bubble primitives', () => {
    const manifest = compileSketchRecipe({
      kind: 'figure',
      subject: 'robot figure in a panel saying hello',
      speechBubbles: [
        {
          id: 'robot-line',
          kind: 'speech',
          text: 'hello human',
          textCase: 'regular',
          tailTo: [360, 260],
          box: { x: 96, y: 58, w: 190, h: 64 },
        },
      ],
    });
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);
    const lettering = manifest.marks.filter((mark) => mark.depictionLettering);

    expect(result.ok).toBe(true);
    expect(manifest.depiction.lettering.carriers).toHaveLength(1);
    expect(lettering.some((mark) => mark.letteringTail)).toBe(true);
    expect(lettering.some((mark) => mark.kind === 'speech')).toBe(false);
    expect(lettering.some((mark) => mark.kind === 'speechBubble')).toBe(false);
    expect(result.expandedManifest.marks.some((mark) => mark.kind === 'speechBubble')).toBe(false);
  });

  it('compiles handwritten bubble letters as locked glyph polygons with straight variation', () => {
    const { depiction, marks } = lowerDepictionLayout({
      paradigm: 'depiction',
      display: { kind: 'cover-mode', panelCount: 1, pad: 24, borderWidth: 0 },
      panels: [{ id: 'masthead', concern: 'graphic-lettering', constellation: 'does-not-apply' }],
      lettering: {
        carriers: [
          {
            id: 'xmen-logo',
            kind: 'handwrittenBubbleLetters',
            text: 'X-MEN',
            language: 'en',
            effect: 'xmen-90s',
            box: { x: 60, y: 70, w: 480, h: 120 },
            fill: '#fff36d',
            stroke: '#111111',
            extrudeFill: '#e0442e',
            depth: 16,
          },
        ],
      },
    }, { width: 620, height: 260 });
    const glyphBodies = marks.filter((mark) => mark.letteringBubbleLetter && mark.polygonLock?.role === 'glyph-body');
    const extrudes = marks.filter((mark) => mark.letteringBubbleLetter && mark.polygonLock?.role === 'glyph-extrude');

    expect(depiction.lettering.carriers[0].kind).toBe('handwrittenBubbleLetters');
    expect(glyphBodies).toHaveLength(5);
    expect(extrudes).toHaveLength(5);
    expect(glyphBodies.every((mark) => mark.kind === 'polygon')).toBe(true);
    expect(glyphBodies.every((mark) => mark.polygonLock.locked)).toBe(true);
    expect(glyphBodies.every((mark) => mark.polygonLock.straightSegmentContract)).toBe(true);
    expect(new Set(glyphBodies.map((mark) => mark.angleCurvatureProfile))).toEqual(new Set(['comic-hero-3d-straight']));
    expect(new Set(glyphBodies.map((mark) => mark.points.length)).size).toBeGreaterThan(1);
    expect(marks.every((mark) => !['handwrittenBubbleLetters', 'bubbleLetters', 'glyph'].includes(mark.kind))).toBe(true);
  });

  it('lets recipes carry bubble letter shorthand without adding lettering primitives', () => {
    const manifest = compileSketchRecipe({
      kind: 'propStudy',
      subject: 'handwritten bubble letter logo study',
      bubbleLetters: {
        id: 'logo',
        text: 'BAM',
        effect: '3d',
        language: 'en',
        box: { x: 120, y: 80, w: 360, h: 110 },
      },
    });
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);
    const glyphBodies = manifest.marks.filter((mark) => mark.letteringBubbleLetter && mark.polygonLock?.role === 'glyph-body');

    expect(result.ok).toBe(true);
    expect(manifest.depiction.lettering.carriers[0].kind).toBe('handwrittenBubbleLetters');
    expect(glyphBodies).toHaveLength(3);
    expect(glyphBodies.every((mark) => mark.kind === 'polygon')).toBe(true);
    expect(glyphBodies.every((mark) => mark.polygonLock.source === 'handwrittenBubbleLetters')).toBe(true);
    expect(result.expandedManifest.marks.some((mark) => mark.kind === 'bubbleLetters')).toBe(false);
  });

  it('compiles figure recipes with main gesture, cross gesture, and dynamic skeleton metadata', () => {
    const manifest = compileSketchRecipe({
      kind: 'figure',
      subject: 'hero figure reaching across the panel',
    });
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);

    expect(result.ok).toBe(true);
    expect(manifest.gesture.kind).toBe('body-line');
    expect(manifest.gesture.crossGesture.kind).toBe('active-arm-line');
    expect(manifest.gesture.dynamicSkeleton.anchors.some((anchor) => anchor.role === 'active-elbow')).toBe(true);
    expect(manifest.gesture.dynamicSkeleton.anchors.some((anchor) => anchor.role === 'left-knee')).toBe(true);
    expect(manifest.gesture.dynamicSkeleton.connections.some((connection) => connection.role === 'left-upper-leg')).toBe(true);
    expect(result.expandedManifest.neoRembrandt.dynamicSkeletonGenerated).toBe(true);
    expect(result.expandedManifest.marks.some((mark) => mark.kind === 'dynamicSkeleton')).toBe(false);
    expect(result.expandedManifest.marks.some((mark) => mark.kind === 'skeleton')).toBe(false);
    expect(result.expandedManifest.marks.some((mark) => mark.dynamicSkeletonRole === 'active-hand')).toBe(true);
    expect(result.expandedManifest.marks.some((mark) => mark.dynamicSkeletonRole === 'left-knee')).toBe(true);
    expect(result.expandedManifest.marks.some((mark) => mark.dynamicSkeletonRole === 'left-lower-leg' && mark.jointMediated)).toBe(true);
  });

  it('supports named panel depiction recipes as graphic design layout modes', () => {
    const expectedCounts = {
      'sunday-comic': 6,
      'manga-high-eye-control': 5,
      'american-comic-widescreen-panels': 3,
      natgeo: 3,
      monoculous: 4,
      'cover-mode': 3,
      'time-magazine-cover': 3,
    };

    for (const panelRecipe of PANEL_DEPICTION_RECIPES) {
      const manifest = compileSketchRecipe({
        kind: 'propStudy',
        subject: `${panelRecipe} layout study`,
        panelRecipe,
      });
      const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);
      const panelMarks = manifest.marks.filter((mark) => mark.depictionPanel);

      expect(result.ok).toBe(true);
      expect(manifest.depiction.panelRecipe).toBe(panelRecipe);
      expect(manifest.depiction.display.kind).toBe(panelRecipe);
      expect(manifest.depiction.panels).toHaveLength(expectedCounts[panelRecipe]);
      expect(panelMarks).toHaveLength(expectedCounts[panelRecipe]);
      expect(panelMarks.every((mark) => mark.kind === 'rect')).toBe(true);
      expect(manifest.marks.every((mark) => mark.kind !== panelRecipe)).toBe(true);
    }
  });

  it('uses distinctive panel proportions for editorial and comic panel depiction recipes', () => {
    const sunday = compileSketchRecipe({
      kind: 'propStudy',
      subject: 'newspaper page rhythm',
      panelRecipe: 'sunday comic',
    });
    const manga = compileSketchRecipe({
      kind: 'propStudy',
      subject: 'high eye reaction page',
      panelRecipe: 'manga high eye control',
    });
    const cover = compileSketchRecipe({
      kind: 'propStudy',
      subject: 'magazine cover',
      panelRecipe: 'cover mode',
    });

    const sundayPanels = sunday.marks.filter((mark) => mark.depictionPanel);
    const mangaPanels = manga.marks.filter((mark) => mark.depictionPanel);
    const coverPanels = cover.marks.filter((mark) => mark.depictionPanel);

    expect(sunday.depiction.display.kind).toBe('sunday-comic');
    expect(sundayPanels.at(-1).w).toBeGreaterThan(sundayPanels[2].w);
    expect(sunday.depiction.panelBlocking.eyeLine).toContain('punchline');
    expect(manga.depiction.display.kind).toBe('manga-high-eye-control');
    expect(mangaPanels.at(-1).h).toBeGreaterThan(mangaPanels[1].h);
    expect(manga.depiction.panelBlocking.eyeLine).toContain('high vertical');
    expect(cover.depiction.display.kind).toBe('cover-mode');
    expect(coverPanels[1].h).toBeGreaterThan(coverPanels[0].h);
    expect(cover.depiction.panelBlocking.eyeLine).toContain('masthead');
  });

  it('compiles a Time-style news magazine cover with transparent movable zones and cover furniture', () => {
    const manifest = compileSketchRecipe({
      kind: 'propStudy',
      subject: 'AI researcher portrait for a news magazine cover',
      panelRecipe: 'time magazine cover',
      display: {
        coverLines: ['THE AI ISSUE', 'WHO CONTROLS THE FUTURE?', 'INSIDE THE NEW LABS'],
      },
    });
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);
    const panelMarks = manifest.marks.filter((mark) => mark.depictionPanel);
    const furniture = manifest.marks.filter((mark) => mark.depictionFurniture);
    const masthead = furniture.find((mark) => mark.role === 'time-cover-masthead');
    const frame = furniture.find((mark) => mark.role === 'time-cover-red-frame');
    const subject = manifest.marks.find((mark) => mark.role === 'subject-mass');
    const heroPanel = manifest.depiction.panels.find((panel) => panel.id === 'cover-hero');

    expect(result.ok).toBe(true);
    expect(manifest.viewBox.height).toBeGreaterThan(manifest.viewBox.width);
    expect(manifest.depiction.display.kind).toBe('time-magazine-cover');
    expect(manifest.depiction.panelRecipe).toBe('time-magazine-cover');
    expect(heroPanel.constellation).toBe('applies');
    expect(subject.anchor[1]).toBeGreaterThan(heroPanel.bounds.y);
    expect(subject.anchor[1]).toBeLessThan(heroPanel.bounds.y + heroPanel.bounds.h);
    expect(panelMarks).toHaveLength(3);
    expect(panelMarks.every((mark) => mark.depictionPanelTransparent)).toBe(true);
    expect(panelMarks.every((mark) => mark.movableElement)).toBe(true);
    expect(frame).toMatchObject({ kind: 'rect', stroke: '#b11226' });
    expect(masthead).toMatchObject({ kind: 'text', value: 'TIME', color: '#b11226' });
    expect(furniture.filter((mark) => /^time-cover-line-/.test(mark.role || ''))).toHaveLength(3);
    expect(manifest.marks.every((mark) => mark.kind !== 'time-magazine-cover')).toBe(true);
  });

  it('applies a Time-style cover as transparent overlay over an ordinary scene sketch', () => {
    const sceneManifest = {
      title: 'Datacenter city cover scene',
      viewBox: { width: 520, height: 720 },
      polygonizer: {
        subject: 'datacenter city interior',
        impactPoint: [260, 382],
        concept: { movementConcept: 'static-scene', depictionClass: 'datacenter-city' },
        picture: {
          framing: 'portrait magazine cover',
          shotAngle: 'one-point aisle view',
          cameraDistance: 'wide',
          compositionIntent: 'server cabinets recede like buildings toward the horizon',
        },
        elements: [
          { role: 'server-cabinet', importance: 'primary', footprint: 'left and right aisle rows', depthBand: 'foreground-to-background', blockingNeeded: 'cca-array' },
        ],
        blockingReality: [
          {
            role: 'server-cabinet-row',
            basis: 'array-item',
            footprint: 'repeating cabinet solids along aisle',
            depthBand: 'foreground-to-background',
            purpose: 'datacenter city blocks receding toward horizon',
          },
        ],
        draftingTable: {
          horizonY: 190,
          vanishingPoint: [260, 190],
          baselineY: 590,
          depthBands: { foreground: [380, 620], midground: [240, 380], background: [160, 240] },
          eyeLine: { direction: [0, -1], stackingRule: 'near cabinets paint above far cabinets' },
        },
        realityFacts: ['server cabinets recede toward horizon'],
        minimalAbstractions: ['datacenter = regular scene solids; cover = depiction overlay'],
      },
      scene: {
        perspective: { mode: 'one-point', vanishingPoint: [260, 190], depthScale: 260 },
        view: { direction: [-0.42, -0.33], baseZ: 10 },
      },
      depiction: {
        panelRecipe: 'time-magazine-cover',
        display: {
          overlay: true,
          coverLineColor: '#ffffff',
          issueLabelColor: '#ffffff',
          coverLines: ['DATA CENTER CITY', 'CABINETS TO THE HORIZON', 'THE NEW INFRASTRUCTURE'],
        },
      },
      marks: [
        {
          kind: 'solid',
          role: 'server-cabinet-near',
          x: 74,
          y: 342,
          width: 74,
          height: 214,
          depth: 62,
          fill: '#263947',
          stroke: '#111827',
          z: 12,
        },
        {
          kind: 'solid',
          role: 'server-cabinet-far',
          x: 314,
          y: 232,
          width: 44,
          height: 118,
          depth: 38,
          fill: '#34495a',
          stroke: '#111827',
          z: 8,
        },
      ],
    };

    const manifest = applyDepictionOverlay(sceneManifest);
    const result = validatePolygonizerManifest(manifest, manifest.polygonizer.subject);
    const sceneMarks = manifest.marks.filter((mark) => mark.role?.startsWith('server-cabinet'));
    const overlayMarks = manifest.marks.filter((mark) => mark.depictionOverlay);
    const paper = manifest.marks.find((mark) => mark.role === 'time-cover-paper' || mark.role === 'depiction-page-paper');
    const panelBackgrounds = manifest.marks.filter((mark) => mark.depictionPanelBackground);
    const frame = manifest.marks.find((mark) => mark.role === 'time-cover-red-frame');
    const coverLines = manifest.marks.filter((mark) => /^time-cover-line-/.test(mark.role || ''));

    expect(result.ok).toBe(true);
    expect(sceneMarks).toHaveLength(2);
    expect(overlayMarks.length).toBeGreaterThan(0);
    expect(manifest.marks.indexOf(sceneMarks[0])).toBeLessThan(manifest.marks.indexOf(overlayMarks[0]));
    expect(paper).toBeUndefined();
    expect(panelBackgrounds).toHaveLength(0);
    expect(frame).toMatchObject({ kind: 'rect', stroke: '#b11226', depictionOverlay: true });
    expect(coverLines).toHaveLength(3);
    expect(coverLines.every((mark) => mark.color === '#ffffff')).toBe(true);
    expect(overlayMarks.filter((mark) => mark.depictionPanel).every((mark) => mark.depictionPanelTransparent)).toBe(true);
  });

  it('keeps transparent panels as movable layout elements with explicit bounds', () => {
    const { depiction, marks } = lowerDepictionLayout({
      paradigm: 'depiction',
      mode: 'unrelated',
      display: {
        kind: 'freeform-elements',
        panelCount: 2,
        transparentPanels: true,
        draggablePanels: true,
        selectionRole: 'powerpoint-like-element',
      },
      panels: [
        {
          id: 'floating-photo',
          concern: 'image-container',
          constellation: 'does-not-apply',
          bounds: { x: 72, y: 48, w: 260, h: 180 },
        },
        {
          id: 'caption-block',
          concern: 'caption-container',
          constellation: 'does-not-apply',
          x: 360,
          y: 250,
          w: 210,
          h: 90,
        },
      ],
    }, { width: 640, height: 420 });
    const panelMarks = marks.filter((mark) => mark.depictionPanel);

    expect(depiction.display.transparentPanels).toBe(true);
    expect(depiction.panels[0].bounds).toEqual({ x: 72, y: 48, w: 260, h: 180 });
    expect(depiction.panels[1].bounds).toEqual({ x: 360, y: 250, w: 210, h: 90 });
    expect(panelMarks).toHaveLength(2);
    expect(panelMarks.every((mark) => mark.kind === 'rect')).toBe(true);
    expect(panelMarks.every((mark) => mark.fill === 'transparent')).toBe(true);
    expect(panelMarks.every((mark) => mark.stroke === 'transparent')).toBe(true);
    expect(panelMarks.every((mark) => mark.strokeWidth === 0)).toBe(true);
    expect(panelMarks.every((mark) => mark.draggable)).toBe(true);
    expect(panelMarks.every((mark) => mark.movableElement)).toBe(true);
    expect(new Set(panelMarks.map((mark) => mark.selectionRole))).toEqual(new Set(['powerpoint-like-element']));
  });

  it('lets polygonizePrompt accept recipe-only model output but returns a lowered manifest', async () => {
    const result = await polygonizePrompt({
      prompt: 'blueprint-style garment pattern for jeans, with pattern pieces and labels',
      modelClient: async () => ({
        recipe: {
          kind: 'garmentPattern',
          subject: 'blueprint-style garment pattern for jeans, with pattern pieces and labels',
        },
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.manifest.recipe).toBeUndefined();
    expect(result.manifest.polygonizer.recipeAudit.kind).toBe('garmentPattern');
    expect(result.manifest.marks.every((mark) => mark.kind !== 'garmentPattern')).toBe(true);
    expect(result.expandedManifest.marks.every((mark) => mark.kind !== 'garmentPattern')).toBe(true);
  });

  it('rejects recipe family names that leak into renderer mark kinds', () => {
    const wrong = compileSketchRecipe({
      kind: 'garmentPattern',
      subject: 'blueprint-style garment pattern for jeans, with pattern pieces and labels',
    });
    wrong.marks.push({ kind: 'garmentPattern', role: 'illegal-renderer-leak' });

    const result = validatePolygonizerManifest(wrong, wrong.polygonizer.subject);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain("got 'garmentPattern'");
  });

  it('fails unknown recipe families before renderer expansion', () => {
    const result = validatePolygonizerManifest({
      recipe: {
        kind: 'productSpecCatalog',
        subject: 'invent a product primitive',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain("Unknown sketch recipe family 'productSpecCatalog'");
  });
});

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
