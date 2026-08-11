import { lowerDepictionLayout } from './depiction-layout.js';
import { planVehicleMandala } from './vehicle-mandala-planner.js';
import {
  buildBusFacadeDecorators,
  buildLongHaulTruckOnWheels,
  buildRailHeadCarMandalaPlan,
  buildRectangularVehicleOnWheels,
} from './vehicle-manji.js';

const RECIPE_FAMILIES = new Set([
  'objectPortrait',
  'figure',
  'roomScene',
  'streetScene',
  'blueprintSpec',
  'garmentPattern',
  'architecturalConstruction',
  'vehicleGlyphLanguage',
  'propStudy',
  'portraitBust',
  'roomInteriorTwoPoint',
]);

export function compileSketchRecipe(input = {}) {
  const recipe = input?.recipe || input;
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
    throw new Error('compileSketchRecipe requires a recipe object');
  }
  const family = normalizeRecipeKind(recipe.kind || recipe.family);
  if (!RECIPE_FAMILIES.has(family)) {
    throw new Error(`Unknown sketch recipe family '${recipe.kind || recipe.family || '(missing)'}'`);
  }
  if (family === 'garmentPattern') return compileGarmentPatternRecipe(recipe);
  if (family === 'architecturalConstruction') return compileArchitecturalConstructionRecipe(recipe);
  if (family === 'vehicleGlyphLanguage') return compileVehicleGlyphLanguageRecipe(recipe);
  if (family === 'portraitBust') return compilePortraitBustRecipe(recipe);
  if (family === 'roomInteriorTwoPoint') return compileRoomInteriorTwoPointRecipe(recipe);
  return compileGenericRecipe(recipe, family);
}

export function lowerRecipeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || !manifest.recipe) return manifest;
  const hasDrawableMarks = Array.isArray(manifest.marks) && manifest.marks.length > 0;
  if (hasDrawableMarks) {
    const { recipe, ...rest } = manifest;
    return {
      ...rest,
      polygonizer: {
        ...(rest.polygonizer || {}),
        recipeAudit: auditRecipe(recipe),
      },
    };
  }
  return compileSketchRecipe(manifest.recipe);
}

export function recipeFamilyAllowlist() {
  return [...RECIPE_FAMILIES];
}

function normalizeRecipeKind(kind) {
  const value = String(kind || '').trim();
  const aliases = {
    object: 'objectPortrait',
    objectPortrait: 'objectPortrait',
    prop: 'propStudy',
    propStudy: 'propStudy',
    figure: 'figure',
    room: 'roomScene',
    roomScene: 'roomScene',
    street: 'streetScene',
    streetScene: 'streetScene',
    blueprint: 'blueprintSpec',
    blueprintSpec: 'blueprintSpec',
    garment: 'garmentPattern',
    garmentPattern: 'garmentPattern',
    house: 'architecturalConstruction',
    home: 'architecturalConstruction',
    building: 'architecturalConstruction',
    buildingHouse: 'architecturalConstruction',
    architecture: 'architecturalConstruction',
    architecturalConstruction: 'architecturalConstruction',
    vehicle: 'vehicleGlyphLanguage',
    vehicles: 'vehicleGlyphLanguage',
    bus: 'vehicleGlyphLanguage',
    train: 'vehicleGlyphLanguage',
    rail: 'vehicleGlyphLanguage',
    vehicleGlyphLanguage: 'vehicleGlyphLanguage',
    'vehicle-glyph-language': 'vehicleGlyphLanguage',
    portraitBust: 'portraitBust',
    'portrait-bust': 'portraitBust',
    bust: 'portraitBust',
    portrait: 'portraitBust',
    roomInteriorTwoPoint: 'roomInteriorTwoPoint',
    'room-interior-two-point': 'roomInteriorTwoPoint',
    roomInterior: 'roomInteriorTwoPoint',
    twoPointRoom: 'roomInteriorTwoPoint',
    interior: 'roomInteriorTwoPoint',
  };
  return aliases[value] || value;
}

function auditRecipe(recipe) {
  return {
    kind: normalizeRecipeKind(recipe.kind || recipe.family),
    subject: recipe.subject,
    style: recipe.style,
    camera: recipe.camera,
    panelRecipe: recipe.panelRecipe || recipe.panelDepiction,
    depiction: recipe.depiction,
    lettering: recipe.lettering,
    bubbleLetters: recipe.bubbleLetters,
    gesture: recipe.gesture,
    display: recipe.display,
    panelBlocking: recipe.panelBlocking,
    anchors: Array.isArray(recipe.anchors) ? recipe.anchors : undefined,
    materialFacts: Array.isArray(recipe.materialFacts) ? recipe.materialFacts : undefined,
  };
}

function compileGenericRecipe(recipe, family) {
  const subject = recipe.subject || `${family} sketch`;
  const viewBox = recipeViewBox(recipe);
  const { depiction, marks: panelMarks } = lowerDepictionLayout(buildRecipeDepiction(recipe, {
    mode: 'related-physical-visual',
    display: { kind: 'single-panel', panelCount: 1 },
    panelBlocking: { paradigm: 'single-subject-block', eyeLine: 'primary mass centered in one container' },
    panels: [{ id: 'main', concern: 'scene', constellation: 'applies' }],
  }), viewBox);
  const primaryPanel = primarySubjectPanel(depiction.panels) || { x: 0, y: 0, w: viewBox.width, h: viewBox.height };
  const anchor = panelCenter(primaryPanel);
  return {
    title: titleFromSubject(subject),
    viewBox,
    depiction,
    ...(family === 'figure' ? { gesture: buildFigureGesture(recipe, anchor) } : {}),
    polygonizer: {
      subject,
      impactPoint: anchor,
      concept: { movementConcept: 'static study', depictionClass: family },
      picture: {
        framing: recipe.camera || 'object portrait',
        shotAngle: 'front three-quarter',
        cameraDistance: 'medium',
        compositionIntent: subject,
      },
      elements: [
        { role: 'subject-mass', importance: 'primary', footprint: 'center', depthBand: 'midground', blockingNeeded: 'cca' },
      ],
      blockingReality: [
        {
          role: 'subject-mass-block',
          basis: 'cca',
          footprint: 'center subject mass',
          depthBand: 'midground',
          purpose: 'primary readable subject block',
        },
      ],
      realityFacts: recipe.materialFacts || [subject],
      minimalAbstractions: [`${subject} = recipe lowered to existing sketch primitives`],
      recipeAudit: auditRecipe({ ...recipe, kind: family }),
    },
    scene: {
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: 'warm-low-key',
    },
    marks: [
      ...panelMarks,
      {
        kind: 'blob',
        role: 'subject-mass',
        anchor,
        rx: Math.min(120, primaryPanel.w * 0.25),
        ry: Math.min(82, primaryPanel.h * 0.22),
        fill: '#b1845e',
        stroke: '#4f3928',
        z: 12,
      },
    ],
  };
}

function buildFigureGesture(recipe, anchor) {
  const supplied = recipe.gesture && typeof recipe.gesture === 'object' && !Array.isArray(recipe.gesture)
    ? recipe.gesture
    : {};
  const points = Array.isArray(supplied.points) && supplied.points.length >= 2
    ? supplied.points
    : [
        [anchor[0], anchor[1] - 118],
        [anchor[0] - 8, anchor[1] - 8],
        [anchor[0] + 12, anchor[1] + 118],
      ];
  const crossGesture = supplied.crossGesture || supplied.cross || {
    kind: 'active-arm-line',
    role: 'active-arm',
    points: [
      [anchor[0] - 70, anchor[1] - 30],
      [anchor[0] + 18, anchor[1] - 52],
      [anchor[0] + 112, anchor[1] - 86],
    ],
  };
  const dynamicSkeleton = supplied.dynamicSkeleton || {
    role: 'figure-dynamic-skeleton',
    anchors: [
      { role: 'head', axis: 'main', gestureT: 0.06, kind: 'core', radius: 22, zRole: 'head' },
      { role: 'torso-center', axis: 'main', gestureT: 0.42, kind: 'core', rx: 42, ry: 58, zRole: 'torso' },
      { role: 'pelvis', axis: 'main', gestureT: 0.78, kind: 'core', rx: 38, ry: 44, zRole: 'pelvis' },
      { role: 'left-hip', axis: 'main', gestureT: 0.78, offset: [-28, 0], kind: 'joint', radius: 12, zRole: 'hip', connects: ['pelvis', 'left-knee'] },
      { role: 'right-hip', axis: 'main', gestureT: 0.78, offset: [28, 0], kind: 'joint', radius: 12, zRole: 'hip', connects: ['pelvis', 'right-knee'] },
      { role: 'left-knee', axis: 'main', gestureT: 0.9, offset: [-24, 4], kind: 'joint', radius: 11, zRole: 'knee', connects: ['left-hip', 'left-ankle'] },
      { role: 'right-knee', axis: 'main', gestureT: 0.9, offset: [24, 4], kind: 'joint', radius: 11, zRole: 'knee', connects: ['right-hip', 'right-ankle'] },
      { role: 'left-ankle', axis: 'main', gestureT: 1, offset: [-20, 0], kind: 'joint', radius: 9, zRole: 'foot', connects: ['left-knee', 'left-foot'] },
      { role: 'right-ankle', axis: 'main', gestureT: 1, offset: [20, 0], kind: 'joint', radius: 9, zRole: 'foot', connects: ['right-knee', 'right-foot'] },
      { role: 'left-foot', axis: 'main', gestureT: 1, offset: [-34, 10], kind: 'joint', radius: 9, zRole: 'foot', connects: ['left-ankle'] },
      { role: 'right-foot', axis: 'main', gestureT: 1, offset: [34, 10], kind: 'joint', radius: 9, zRole: 'foot', connects: ['right-ankle'] },
      { role: 'active-shoulder', axis: 'cross', gestureT: 0.08, kind: 'joint', radius: 13, zRole: 'shoulder' },
      { role: 'active-elbow', axis: 'cross', gestureT: 0.52, kind: 'joint', radius: 12, zRole: 'elbow' },
      { role: 'active-hand', axis: 'cross', gestureT: 0.92, kind: 'joint', radius: 11, zRole: 'hand' },
    ],
    connections: [
      { from: 'active-shoulder', to: 'active-elbow', role: 'active-upper-arm', kind: 'limb' },
      { from: 'active-elbow', to: 'active-hand', role: 'active-forearm', kind: 'limb' },
      { from: 'torso-center', to: 'pelvis', role: 'torso-carry', kind: 'core-span', thickness: 24 },
      { from: 'pelvis', to: 'left-hip', role: 'left-hip-carry', kind: 'joint-span', thickness: 10 },
      { from: 'pelvis', to: 'right-hip', role: 'right-hip-carry', kind: 'joint-span', thickness: 10 },
      { from: 'left-hip', to: 'left-knee', role: 'left-upper-leg', kind: 'limb' },
      { from: 'right-hip', to: 'right-knee', role: 'right-upper-leg', kind: 'limb' },
      { from: 'left-knee', to: 'left-ankle', role: 'left-lower-leg', kind: 'limb' },
      { from: 'right-knee', to: 'right-ankle', role: 'right-lower-leg', kind: 'limb' },
      { from: 'left-ankle', to: 'left-foot', role: 'left-foot-carry', kind: 'foot', thickness: 9 },
      { from: 'right-ankle', to: 'right-foot', role: 'right-foot-carry', kind: 'foot', thickness: 9 },
    ],
  };
  return {
    kind: supplied.kind || 'body-line',
    role: supplied.role || 'standing-gesture',
    points,
    anchors: supplied.anchors || [
      { role: 'head', gestureT: 0.06 },
      { role: 'torso-center', gestureT: 0.42 },
      { role: 'pelvis', gestureT: 0.78 },
    ],
    crossGesture,
    dynamicSkeleton,
  };
}

function compileGarmentPatternRecipe(recipe) {
  const pattern = normalizeGarmentPatternStyle(recipe);
  if (pattern !== 'blueprint') return compileGarmentTextileRecipe(recipe, pattern);

  const subject = recipe.subject || 'blueprint-style garment pattern';
  const title = recipe.title || titleFromSubject(subject);
  const viewBox = { width: 900, height: 620 };
  const { depiction, marks: panelMarks } = lowerDepictionLayout(buildRecipeDepiction(recipe, {
    mode: 'related-physical-visual',
    display: { kind: 'single-panel-grid-render', panelCount: 1, borderWidth: 1, pad: 0 },
    panelBlocking: { paradigm: 'full-equal-grid', eyeLine: 'orthographic sheet scan from title strip to major pieces to labels' },
    panels: [{ id: 'sheet', concern: 'blueprint-spec', constellation: 'applies' }],
  }), viewBox);
  return {
    title,
    viewBox,
    depiction,
    polygonizer: {
      subject,
      outputStyle: 'blueprint',
      impactPoint: [450, 310],
      concept: { movementConcept: 'flat specification', depictionClass: 'blueprint-spec' },
      picture: {
        framing: 'blueprint sheet',
        shotAngle: 'orthographic flat lay',
        cameraDistance: 'full sheet',
        compositionIntent: 'show garment pattern pieces, grain lines, notches, labels, and datum grid',
      },
      elements: [
        { role: 'front-leg-pattern', importance: 'primary', footprint: 'left sheet panel', depthBand: 'flat-sheet', blockingNeeded: 'polygon-piece' },
        { role: 'back-leg-pattern', importance: 'primary', footprint: 'right sheet panel', depthBand: 'flat-sheet', blockingNeeded: 'polygon-piece' },
        { role: 'waistband-pattern', importance: 'primary-detail', footprint: 'top strip', depthBand: 'flat-sheet', blockingNeeded: 'polygon-piece' },
        { role: 'pocket-facing', importance: 'secondary', footprint: 'lower accessory pieces', depthBand: 'flat-sheet', blockingNeeded: 'polygon-piece' },
        { role: 'labels-and-ticks', importance: 'secondary', footprint: 'callouts and notches', depthBand: 'annotation', blockingNeeded: 'text-line-array' },
      ],
      blockingReality: [
        {
          role: 'front-leg-pattern-block',
          basis: 'flat-polygon',
          footprint: 'left tapered jean leg panel with crotch curve',
          depthBand: 'flat-sheet',
          purpose: 'primary front jeans pattern piece',
        },
        {
          role: 'back-leg-pattern-block',
          basis: 'flat-polygon',
          footprint: 'right wider jean leg panel with seat curve',
          depthBand: 'flat-sheet',
          purpose: 'primary back jeans pattern piece',
        },
        {
          role: 'waistband-pattern-block',
          basis: 'flat-polygon',
          footprint: 'top long rectangular waistband strip',
          depthBand: 'flat-sheet',
          purpose: 'waistband pattern piece',
        },
        {
          role: 'pocket-facing-block',
          basis: 'flat-polygon',
          footprint: 'small curved pocket facing pieces',
          depthBand: 'flat-sheet',
          purpose: 'secondary pocket facing pattern pieces',
        },
        {
          role: 'labels-and-ticks-array',
          basis: 'array-item',
          footprint: 'repeated notch ticks and text labels',
          repeats: 'labels-and-ticks',
          depthBand: 'annotation',
          purpose: 'blueprint annotation without introducing a garment primitive',
        },
      ],
      pureMandala: {
        kind: 'flat-blueprint-sheet',
        units: 'pattern-grid',
        origin: [80, 90],
        axes: { x: [1, 0], y: [0, 1] },
        interval: 40,
        sheet: { width: 900, height: 620 },
        objectFootprints: [
          { role: 'front-leg-pattern', bounds: [120, 170, 230, 350] },
          { role: 'back-leg-pattern', bounds: [430, 145, 270, 375] },
          { role: 'waistband-pattern', bounds: [120, 80, 560, 48] },
          { role: 'pocket-facing', bounds: [710, 330, 105, 135] },
        ],
      },
      cameraPrimitive: {
        kind: 'orthographic-flat-sheet',
        cropBox: { x: 0, y: 0, width: 900, height: 620 },
        showFullMandala: true,
      },
      realityFacts: [
        'front leg pattern piece',
        'back leg pattern piece',
        'waistband strip',
        'pocket facing',
        'grain lines',
        'notches and labels',
      ],
      minimalAbstractions: [
        'garmentPattern recipe = flat blueprint sheet',
        'jeans pieces = polygons plus seam allowance and grain lines',
        'annotations = line and text marks',
      ],
      recipeAudit: auditRecipe({ ...recipe, kind: 'garmentPattern' }),
    },
    scene: {
      renderMode: 'grid-render',
      view: { direction: [0, 0], baseZ: 10 },
      palette: 'blueprint',
      light: { direction: [-0.2, -0.8], z: 0.4 },
    },
    marks: [...garmentPatternMarks(), ...panelMarks.map((mark) => ({ ...mark, stroke: '#7ee7ff', opacity: 0.7, z: 40 }))],
  };
}

function compileArchitecturalConstructionRecipe(recipe) {
  const subject = recipe.subject || 'generative architectural construction';
  const title = recipe.title || titleFromSubject(subject);
  const viewBox = recipeViewBox({ ...recipe, viewBox: recipe.viewBox || { width: 760, height: 520 } });
  const palette = housePalette(recipe);
  const mass = houseMass(viewBox, recipe);
  const variant = normalizeHouseVariant(recipe);
  const libraries = architecturalConstructionLibraries(variant);
  const zeroMap = architecturalZeroVectorMap(mass, variant, libraries);
  const marks = architecturalConstructionMarks({ mass, palette, variant, recipe });
  const impactPoint = [Math.round(mass.x + mass.w / 2), Math.round(mass.y + mass.h * 0.64)];

  return {
    title,
    viewBox,
    depiction: {
      paradigm: 'depiction',
      mode: 'related-physical-visual',
      display: { kind: 'single-architectural-construction', panelCount: 1 },
      panelBlocking: {
        paradigm: 'zero-vector-architectural-map',
        eyeLine: 'mandala slot map first, main mass second, attached elements third, repeated facade rhythms last',
      },
      panels: [
        { id: 'architecture', concern: 'architectural-construction', constellation: 'applies', bounds: { x: 0, y: 0, w: viewBox.width, h: viewBox.height } },
      ],
    },
    polygonizer: {
      subject,
      outputStyle: 'architectural-construction',
      impactPoint,
      concept: { movementConcept: 'zero-vector mandala element map', depictionClass: 'architecturalConstruction' },
      picture: {
        framing: recipe.camera || 'front three-quarter architectural portrait',
        shotAngle: 'slight one-point exterior angle',
        cameraDistance: 'full facade with entry and roof readable',
        compositionIntent: 'generate a coherent building quickly by mapping element slots in vector-zero mandala space before lowering attached libraries to marks',
      },
      elements: [
        { role: 'house-body', importance: 'primary', footprint: 'main rectangular CCA block', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'roof', importance: 'primary-detail', footprint: `${variant.roof} roof cap`, depthBand: 'midground', blockingNeeded: 'panel-cca' },
        { role: 'door', importance: 'primary-detail', footprint: `${variant.door} entry`, depthBand: 'foreground', blockingNeeded: 'door-library' },
        { role: 'porch', importance: 'secondary', footprint: `${variant.porch} porch platform`, depthBand: 'foreground', blockingNeeded: 'porch-library' },
        { role: 'steps', importance: 'secondary', footprint: `${variant.steps} step cadence`, depthBand: 'foreground', blockingNeeded: 'step-library' },
        { role: 'chimney', importance: 'secondary', footprint: `${variant.chimney} chimney`, depthBand: 'midground', blockingNeeded: 'chimney-library' },
        { role: 'window-band', importance: 'secondary', footprint: 'repeated facade apertures', depthBand: 'foreground', blockingNeeded: 'array-face-pattern' },
      ],
      blockingReality: [
        { role: 'house-body-block', basis: 'cca', footprint: 'single main house volume', depthBand: 'midground', purpose: 'primary mass all libraries attach to' },
        { role: 'roof-block', basis: 'panel-cca', footprint: `${variant.roof} cap attached to house-body`, attachesTo: 'house-body', depthBand: 'midground', purpose: 'roof silhouette and depth cue' },
        { role: 'door-library-block', basis: 'library-slot', footprint: `${variant.door} door centered on lower facade`, attachesTo: 'house-body', depthBand: 'foreground', purpose: 'entry identity chosen from door library' },
        { role: 'porch-library-block', basis: 'library-slot', footprint: `${variant.porch} porch attached below door`, attachesTo: 'door', depthBand: 'foreground', purpose: 'entry transition chosen from porch library' },
        { role: 'steps-library-block', basis: 'array-item', footprint: `${variant.steps} repeated step treads`, repeats: 'steps', attachesTo: 'porch', depthBand: 'foreground', purpose: 'stairs/steps generated from a small count and spacing rule' },
        { role: 'chimney-library-block', basis: 'library-slot', footprint: `${variant.chimney} roof chimney`, attachesTo: 'roof', depthBand: 'midground', purpose: 'roof detail chosen from chimney library' },
        { role: 'window-band-item', basis: 'array-item', footprint: 'repeated window slot on facade', repeats: 'window-band', attachesTo: 'house-body', depthBand: 'foreground', purpose: 'facade rhythm without enumerating windows' },
      ],
      draftingTable: {
        horizonY: Math.round(mass.y - 22),
        vanishingPoint: [Math.round(mass.x + mass.w + mass.depth * 1.9), Math.round(mass.y - 22)],
        baselineY: Math.round(mass.y + mass.h + 34),
        rulerAxes: { x: 'facade width', y: 'story height', z: 'depth offset' },
        depthBands: { foreground: [mass.y + mass.h * 0.68, viewBox.height], midground: [mass.y - 80, mass.y + mass.h * 0.8], background: [40, mass.y] },
        eyeLine: { direction: [-0.45, -0.35], stackingRule: 'entry and porch paint above body, roof and chimney sit above body, facade repeats fit inside the body face' },
      },
      pureMandala: {
        kind: 'zero-vector-element-map',
        units: 'house-module',
        origin: [mass.x, mass.y],
        axes: { x: [1, 0], y: [0, 1], z: [0.42, -0.28] },
        interval: Math.round(mass.w / 8),
        field: { x: [0, 8], y: [0, 5], z: [0, 2] },
        slotMap: zeroMap,
        plannedElements: zeroMap.slots,
        collisionPolicy: {
          coordinateSpace: 'normalized-vector-zero',
          rule: 'slots must not overlap in the same collisionGroup before marks are emitted',
          resolution: 'attachments inherit parent slot clearance and clamp to facade/roof support bounds',
        },
        libraries,
        fitRules: [
          'door occupies center lower 1.15u x 2.2u',
          'porch width derives from door width plus side clearance',
          'steps repeat downward from porch front edge',
          'roof modules attach above the body and may overhang by 0.4u',
          'chimney snaps to a roof shoulder, never free-floating',
          'window-band repeats in facade slots and may be skinned by facePattern',
        ],
      },
      architecturalLibraries: libraries,
      realityFacts: [
        'main house body block',
        `${variant.roof} roof`,
        `${variant.door} front door`,
        `${variant.porch} porch`,
        `${variant.steps} steps`,
        `${variant.chimney} chimney`,
        'repeated aligned windows',
      ],
      minimalAbstractions: [
        'architecturalConstruction recipe = zero-vector mandala slot map plus reusable architectural libraries',
        'element positions are planned as normalized slots before marks are emitted',
        'overlap is prevented in mandala space before constellation and Rendrant expansion',
        'repetition uses arrays/face patterns rather than hand-placed detail',
      ],
      recipeAudit: auditRecipe({ ...recipe, kind: 'architecturalConstruction', style: variant.style }),
    },
    scene: {
      perspective: {
        mode: 'one-point',
        horizonY: Math.round(mass.y - 22),
        vanishingPoint: [Math.round(mass.x + mass.w + mass.depth * 1.9), Math.round(mass.y - 22)],
        depthScale: 230,
      },
      view: { direction: [-0.45, -0.35], baseZ: 10 },
      light: { direction: [-0.58, -0.82], z: 0.72 },
      palette: palette.name,
    },
    marks,
  };
}

function compileVehicleGlyphLanguageRecipe(recipe) {
  const subject = recipe.subject || 'vehicle glyph language scene';
  const title = recipe.title || titleFromSubject(subject);
  const viewBox = recipeViewBox({ ...recipe, viewBox: recipe.viewBox || { width: 900, height: 540 } });
  const prompt = recipe.prompt || subject;
  const conceptIds = Array.isArray(recipe.concepts) ? recipe.concepts : undefined;
  const plan = planVehicleMandala({
    prompt,
    conceptIds,
    seed: recipe.seed || prompt,
    maxConcepts: 6,
  });
  const marks = vehicleSceneMarksFromPlan(plan, subject, recipe);
  const impactPoint = [Math.round(viewBox.width * 0.5), Math.round(viewBox.height * 0.68)];

  return {
    title,
    viewBox,
    depiction: {
      paradigm: 'depiction',
      mode: 'related-physical-visual',
      display: { kind: 'single-vehicle-glyph-scene', panelCount: 1 },
      panelBlocking: {
        paradigm: 'vehicle-surface-allocation',
        eyeLine: 'allocate vehicle slots first, then mount grounded chassis and payload skins',
      },
      panels: [
        {
          id: 'vehicle-scene',
          concern: 'vehicle-glyph-language',
          constellation: 'applies',
          bounds: { x: 0, y: 0, w: viewBox.width, h: viewBox.height },
        },
      ],
    },
    polygonizer: {
      subject,
      outputStyle: 'vehicle-glyph-language',
      impactPoint,
      concept: { movementConcept: 'grounded vehicle glyph allocation map', depictionClass: 'vehicleGlyphLanguage' },
      picture: {
        framing: recipe.camera || 'street/rail side three-quarter',
        shotAngle: 'road and rail support planes in one frame',
        cameraDistance: 'medium-wide',
        compositionIntent: 'express bus/train grounding as reusable structural grammar with deterministic slot allocation',
      },
      elements: [
        { role: 'surface-plan', importance: 'primary', footprint: 'road/rail/platform support surfaces', depthBand: 'midground', blockingNeeded: 'allocation-plan' },
        { role: 'vehicle-instances', importance: 'primary', footprint: 'grounded chassis plus payload', depthBand: 'foreground', blockingNeeded: 'vehicle-glyph-grammar' },
      ],
      blockingReality: [
        { role: 'surface-plan-block', basis: 'mandala-slot-plan', footprint: 'road/rail/platform/yard rectangles', depthBand: 'midground', purpose: 'allocate finite support budget before visible drawing' },
        { role: 'vehicle-chassis-block', basis: 'grounded-manji', footprint: 'axles + center bar + wheel slots', depthBand: 'foreground', purpose: 'shared grounding grammar for bus/train/truck variants' },
      ],
      vehicleMandalaPlan: plan,
      realityFacts: [
        'vehicle concepts are allocated to explicit support surfaces',
        'grounded chassis remains visible as structural basis',
        'bus/train/truck variants change payload skin without changing support grammar',
      ],
      minimalAbstractions: [
        'vehicleGlyphLanguage recipe = support-surface plan plus grounded chassis primitives',
        'surface slots prevent collisions and over-budget vehicle placement',
        'bus, train, and truck emerge from one rectangular vehicle grammar with different facade policies',
      ],
      recipeAudit: auditRecipe({ ...recipe, kind: 'vehicleGlyphLanguage' }),
    },
    scene: {
      perspective: {
        mode: 'one-point',
        horizonY: Math.round(viewBox.height * 0.30),
        vanishingPoint: [Math.round(viewBox.width * 0.78), Math.round(viewBox.height * 0.30)],
        depthScale: 220,
      },
      view: { direction: [-0.42, -0.32], baseZ: 10 },
      light: { direction: [-0.55, -0.78], z: 0.68 },
      palette: 'vehicle-glyph-workbench',
    },
    marks,
  };
}

function vehicleSceneMarksFromPlan(plan, subject, recipe) {
  const project = ([x, y, z]) => [x * 24 + 60 + y * 4, 470 - y * 13 - z * 34 - x * 1.2];
  const marks = [
    {
      kind: 'rect',
      x: 0,
      y: 0,
      w: 900,
      h: 540,
      fill: '#f5f1e8',
      role: 'vehicle-scene:background',
      z: 0,
    },
    {
      kind: 'text',
      x: 36,
      y: 42,
      value: `Vehicle glyph language: ${subject}`,
      size: 22,
      weight: 700,
      color: '#1f2937',
      role: 'vehicle-scene:title',
      z: 10,
    },
  ];

  const roadY = 11.8;
  marks.push({
    kind: 'polygon',
    points: [
      project([1.0, roadY - 1.4, 0]),
      project([32.0, roadY - 1.4, 0]),
      project([32.0, roadY + 2.4, 0]),
      project([1.0, roadY + 2.4, 0]),
    ],
    fill: '#374151',
    stroke: '#111827',
    strokeWidth: 0.8,
    role: 'vehicle-scene:road-plane',
    z: 20,
  });
  marks.push({
    kind: 'polygon',
    points: [
      project([1.0, roadY - 5.4, 0]),
      project([32.0, roadY - 5.4, 0]),
      project([32.0, roadY - 3.1, 0]),
      project([1.0, roadY - 3.1, 0]),
    ],
    fill: '#d8d2c5',
    stroke: '#9b9488',
    strokeWidth: 0.7,
    role: 'vehicle-scene:rail-plane',
    z: 21,
  });

  const allocations = plan.allocations.slice(0, 3);
  for (const [index, allocation] of allocations.entries()) {
    const originX = 6.5 + index * 8.4;
    const isTruck = allocation.conceptId.includes('truck.long-haul');
    const isRail = allocation.surfaceKind === 'railPlane' || allocation.conceptId.includes('rectangular-wheeled');
    if (isTruck) {
      const truckVehicle = buildLongHaulTruckOnWheels({
        project,
        origin: [originX - 1.2, roadY + 0.15],
        axis: 'x',
        length: 9.4,
        width: 1.25,
        wheelRadius: 0.25,
        bodyLength: 10.1,
        bodyWidth: 1.65,
        bodyHeight: 1.32,
        trailerProfile: allocation.parameters?.trailerProfile || 'box-trailer',
        cargoHybrid: allocation.parameters?.cargoHybrid || 'train-cart-compatible',
        role: `vehicle-scene:alloc:${index}:truck`,
      });
      marks.push(...vehicleShapesToMarks(truckVehicle.paintGroups.underBodyChassisShapes, 40));
      marks.push(...truckBodyMarks(project, truckVehicle, `vehicle-scene:alloc:${index}:truck`, 42));
      marks.push(...vehicleShapesToMarks(truckVehicle.shapes, 46));
      marks.push(...vehicleShapesToMarks(truckVehicle.paintGroups.overlayWheelShapes, 48));
    } else if (isRail) {
      const headPlan = buildRailHeadCarMandalaPlan({
        origin: [originX, roadY - 3.9],
        axis: 'x',
        role: `vehicle-scene:alloc:${index}:rail-head-plan`,
      });
      const trainVehicle = buildRectangularVehicleOnWheels({
        project,
        origin: [originX, roadY - 3.9],
        axis: 'x',
        length: 6.4,
        width: 1.2,
        wheelRadius: 0.22,
        bodyLength: Math.max(6.8, headPlan.totalFootprint.length * 0.88),
        bodyWidth: 1.45,
        bodyHeight: 1.05,
        role: `vehicle-scene:alloc:${index}:train`,
      });
      marks.push(...vehicleShapesToMarks(trainVehicle.paintGroups.underBodyChassisShapes, 32));
      marks.push({
        kind: 'polygon',
        points: worldBoxFace(project, trainVehicle.bodyBox, 'front'),
        fill: '#d9e4ef',
        stroke: '#56606b',
        strokeWidth: 0.7,
        role: `vehicle-scene:alloc:${index}:train-body-front`,
        z: 34,
      });
      marks.push({
        kind: 'polygon',
        points: worldBoxFace(project, trainVehicle.bodyBox, 'right'),
        fill: '#b8c7d6',
        stroke: '#56606b',
        strokeWidth: 0.7,
        role: `vehicle-scene:alloc:${index}:train-body-side`,
        z: 35,
      });
      marks.push(...vehicleShapesToMarks(trainVehicle.paintGroups.overlayWheelShapes, 36));
    } else {
      const busVehicle = buildRectangularVehicleOnWheels({
        project,
        origin: [originX, roadY + 0.35],
        axis: 'x',
        length: 6.8,
        width: 1.2,
        wheelRadius: 0.28,
        bodyLength: 7.4,
        bodyWidth: 1.75,
        bodyHeight: 1.30,
        role: `vehicle-scene:alloc:${index}:bus`,
      });
      const facade = buildBusFacadeDecorators({
        project,
        block: busVehicle,
        role: `vehicle-scene:alloc:${index}:bus-facade`,
        windowCount: 5,
        doorPlacement: 'front-and-middle',
      });
      marks.push(...vehicleShapesToMarks(busVehicle.paintGroups.underBodyChassisShapes, 40));
      marks.push({
        kind: 'polygon',
        points: worldBoxFace(project, busVehicle.bodyBox, 'front'),
        fill: '#f0c98b',
        stroke: '#6f5430',
        strokeWidth: 0.75,
        role: `vehicle-scene:alloc:${index}:bus-body-front`,
        z: 42,
      });
      marks.push({
        kind: 'polygon',
        points: worldBoxFace(project, busVehicle.bodyBox, 'right'),
        fill: '#e6b66f',
        stroke: '#6f5430',
        strokeWidth: 0.75,
        role: `vehicle-scene:alloc:${index}:bus-body-side`,
        z: 43,
      });
      marks.push(...vehicleShapesToMarks(facade.shapes, 44));
      marks.push(...vehicleShapesToMarks(busVehicle.paintGroups.overlayWheelShapes, 45));
    }
  }

  marks.push({
    kind: 'text',
    x: 36,
    y: 512,
    value: `allocations=${plan.diagnostics.allocationCount} collisions=${plan.diagnostics.collisionCount} unplaced=${plan.diagnostics.unplacedCount}`,
    size: 12,
    color: '#475569',
    role: 'vehicle-scene:diagnostics',
    z: 90,
  });
  return marks;
}

function truckBodyMarks(project, truckVehicle, role, zBase) {
  return [
    {
      kind: 'polygon',
      points: worldBoxFace(project, truckVehicle.trailerBox, 'front'),
      fill: '#e2e8f0',
      stroke: '#64748b',
      strokeWidth: 0.75,
      role: `${role}:trailer-body-front`,
      z: zBase,
    },
    {
      kind: 'polygon',
      points: worldBoxFace(project, truckVehicle.trailerBox, 'right'),
      fill: '#cbd5e1',
      stroke: '#64748b',
      strokeWidth: 0.75,
      role: `${role}:trailer-body-side`,
      z: zBase + 0.1,
    },
    {
      kind: 'polygon',
      points: worldBoxFace(project, truckVehicle.cabBox, 'front'),
      fill: '#d7b06a',
      stroke: '#6f5430',
      strokeWidth: 0.75,
      role: `${role}:cab-body-front`,
      z: zBase + 0.2,
    },
    {
      kind: 'polygon',
      points: worldBoxFace(project, truckVehicle.cabBox, 'right'),
      fill: '#c99348',
      stroke: '#6f5430',
      strokeWidth: 0.75,
      role: `${role}:cab-body-side`,
      z: zBase + 0.3,
    },
  ];
}

function vehicleShapesToMarks(shapes, zBase) {
  return shapes.map((shape, index) => {
    if (shape.kind === 'line') {
      return {
        kind: 'line',
        x1: shape.from.x,
        y1: shape.from.y,
        x2: shape.to.x,
        y2: shape.to.y,
        stroke: shape.stroke || '#111827',
        strokeWidth: shape.strokeWidth || 1,
        role: shape.role,
        z: zBase + index * 0.01,
      };
    }
    return {
      kind: 'polygon',
      points: shape.points.map((point) => [point.x, point.y]),
      fill: shape.fill || '#94a3b8',
      stroke: shape.stroke || 'none',
      strokeWidth: shape.strokeWidth || 0,
      role: shape.role,
      z: zBase + index * 0.01,
    };
  });
}

function worldBoxFace(project, box, face) {
  const p0 = project([box.x, box.y, box.z]);
  const p1 = project([box.x + box.width, box.y, box.z]);
  const p2 = project([box.x + box.width, box.y + box.length, box.z]);
  const p3 = project([box.x, box.y + box.length, box.z]);
  const t0 = project([box.x, box.y, box.z + box.height]);
  const t1 = project([box.x + box.width, box.y, box.z + box.height]);
  const t2 = project([box.x + box.width, box.y + box.length, box.z + box.height]);
  const t3 = project([box.x, box.y + box.length, box.z + box.height]);
  if (face === 'front') return [p3, p2, t2, t3];
  if (face === 'right') return [p2, p1, t1, t2];
  return [t3, t2, t1, t0];
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 4 — portrait-bust recipe
//
// Bust-shot portrait composed of named generated masses sitting on a shared
// rig: hair silhouette, shoulder slab, neck flared column, head egg, eyes,
// mouth. Material-contract metadata is emitted on each mass so Phase 6
// (material-contracts.js) can normalize the family later. Visible-skin
// vocabulary stays inside existing renderer primitives (rect / polygon /
// blob).
// ─────────────────────────────────────────────────────────────────────────

function compilePortraitBustRecipe(recipe) {
  const subject = recipe.subject || 'portrait bust';
  const title = recipe.title || titleFromSubject(subject);
  const viewBox = recipeViewBox({ ...recipe, viewBox: recipe.viewBox || { width: 480, height: 600 } });
  const palette = portraitBustPalette(recipe);
  const rig = portraitBustRig(viewBox, recipe);
  const marks = portraitBustMarks(rig, palette);
  const impactPoint = [rig.headCenter[0], rig.headCenter[1]];
  const { depiction, marks: panelMarks } = lowerDepictionLayout(buildRecipeDepiction(recipe, {
    mode: 'related-physical-visual',
    display: { kind: 'single-panel-portrait', panelCount: 1 },
    panelBlocking: { paradigm: 'single-bust-block', eyeLine: 'head over shoulders, eyes at upper third' },
    panels: [{ id: 'portrait', concern: 'bust-portrait', constellation: 'applies' }],
  }), viewBox);

  return {
    title,
    viewBox,
    depiction,
    polygonizer: {
      subject,
      outputStyle: 'portrait-bust',
      impactPoint,
      concept: { movementConcept: 'iconic bust portrait', depictionClass: 'portraitBust' },
      picture: {
        framing: recipe.camera || 'close bust',
        shotAngle: recipe.pose?.headTurn || 'front three-quarter',
        cameraDistance: 'close',
        compositionIntent: 'head + shoulders + upper chest framed in a single panel',
      },
      elements: [
        { role: 'background', importance: 'secondary', footprint: 'full panel', depthBand: 'background', blockingNeeded: 'cca' },
        { role: 'shoulders-mass', importance: 'primary', footprint: 'lower bust slab', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'neck-mass', importance: 'primary', footprint: 'flared neck column', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'hair-mass', importance: 'primary', footprint: 'hair silhouette behind head', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'head-mass', importance: 'primary', footprint: 'inverted egg head', depthBand: 'foreground', blockingNeeded: 'cca' },
      ],
      blockingReality: [
        { role: 'background-block', basis: 'cca', footprint: 'flat panel backdrop', depthBand: 'background', purpose: 'iconic frame for the bust' },
        { role: 'shoulders-block', basis: 'cca', footprint: 'wide trapezoid below neck', depthBand: 'midground', purpose: 'primary bust mass anchoring the figure' },
        { role: 'neck-block', basis: 'cca', footprint: 'flared column between head and shoulders', depthBand: 'midground', purpose: 'connect head to shoulders' },
        { role: 'hair-block', basis: 'cca', footprint: 'curved silhouette behind head', depthBand: 'midground', purpose: 'hair frames the head' },
        { role: 'head-block', basis: 'cca', footprint: 'inverted-egg head mass', depthBand: 'foreground', purpose: 'face anchor for eye and mouth marks' },
      ],
      realityFacts: [
        'single bust portrait',
        `${recipe.pose?.headTurn || 'front three-quarter'} pose`,
        'visible head, neck, shoulders',
        'eyes on the upper third of the face',
      ],
      minimalAbstractions: [
        'portraitBust recipe = rig anchors + named mass polygons',
        'head sits on neck, neck sits on shoulders, hair sits behind head',
        'visible-skin marks are ordinary blob/polygon/rect kinds',
      ],
      recipeAudit: auditRecipe({ ...recipe, kind: 'portraitBust' }),
    },
    scene: {
      view: { direction: [0, -0.3], baseZ: 10 },
      light: { direction: [-0.52, -0.78], z: 0.7 },
      palette: palette.name,
    },
    marks: [...panelMarks, ...marks],
  };
}

function portraitBustPalette(recipe) {
  const tone = String(recipe.palette || recipe.style || 'warm-low-key').toLowerCase();
  const presets = {
    'warm-low-key': {
      name: 'warm-low-key',
      background: '#1c1612',
      skin: recipe.skinTone || '#c69b78',
      skinShadow: '#7a5a44',
      hair: recipe.hairColor || '#3a2418',
      garment: recipe.garmentColor || '#3f2620',
      garmentEdge: '#1f120e',
      eye: '#1a120c',
      mouth: '#7a3422',
    },
    'cool-high-key': {
      name: 'warm-low-key',
      background: '#e9e3d8',
      skin: recipe.skinTone || '#e2c2a7',
      skinShadow: '#a98570',
      hair: recipe.hairColor || '#4b3a36',
      garment: recipe.garmentColor || '#37445a',
      garmentEdge: '#1a2230',
      eye: '#1c1c20',
      mouth: '#b15f4f',
    },
  };
  return presets[tone] || presets['warm-low-key'];
}

function portraitBustRig(viewBox, recipe) {
  const cx = viewBox.width / 2;
  const headRy = Math.round(viewBox.height * 0.14);
  const headRx = Math.round(headRy * 0.82);
  const headCy = Math.round(viewBox.height * 0.34);
  const neckTopY = headCy + headRy - 4;
  const neckBottomY = neckTopY + Math.round(viewBox.height * 0.08);
  const shouldersTopY = neckBottomY - 4;
  const shouldersBottomY = viewBox.height;
  const headTilt = Number(recipe.pose?.headTilt) || 0;
  const headCenter = [Math.round(cx + headTilt * 8), headCy];
  return {
    cx,
    viewBox,
    headCenter,
    headRx,
    headRy,
    neckTopY,
    neckBottomY,
    neckHalfTop: Math.round(headRx * 0.32),
    neckHalfBottom: Math.round(headRx * 0.5),
    shouldersTopY,
    shouldersBottomY,
    shouldersHalfTop: Math.round(headRx * 1.2),
    shouldersHalfBottom: Math.round(viewBox.width * 0.46),
    hairRy: Math.round(headRy * 1.18),
    hairRx: Math.round(headRx * 1.18),
    eyeOffsetX: Math.round(headRx * 0.42),
    eyeOffsetY: Math.round(headRy * 0.05),
    eyeRx: Math.max(3, Math.round(headRx * 0.1)),
    eyeRy: Math.max(2, Math.round(headRy * 0.06)),
    mouthOffsetY: Math.round(headRy * 0.5),
    mouthHalfW: Math.round(headRx * 0.32),
  };
}

function portraitBustMarks(rig, palette) {
  const { viewBox, headCenter, headRx, headRy } = rig;
  const marks = [];
  marks.push({
    kind: 'rect',
    role: 'background',
    x: 0, y: 0, w: viewBox.width, h: viewBox.height,
    fill: palette.background,
    z: 1,
    generatedMass: 'flat-backdrop',
    materialContractFamily: 'backdrop',
  });
  marks.push({
    kind: 'polygon',
    role: 'shoulders-mass',
    points: [
      [rig.cx - rig.shouldersHalfTop, rig.shouldersTopY],
      [rig.cx + rig.shouldersHalfTop, rig.shouldersTopY],
      [rig.cx + rig.shouldersHalfBottom, rig.shouldersBottomY],
      [rig.cx - rig.shouldersHalfBottom, rig.shouldersBottomY],
    ],
    fill: palette.garment,
    stroke: palette.garmentEdge,
    strokeWidth: 1,
    z: 10,
    generatedMass: 'peach-profile-shoulders',
    materialContractFamily: 'peach-profile',
  });
  marks.push({
    kind: 'polygon',
    role: 'neck-mass',
    points: [
      [rig.cx - rig.neckHalfTop, rig.neckTopY],
      [rig.cx + rig.neckHalfTop, rig.neckTopY],
      [rig.cx + rig.neckHalfBottom, rig.neckBottomY],
      [rig.cx - rig.neckHalfBottom, rig.neckBottomY],
    ],
    fill: palette.skinShadow,
    stroke: palette.garmentEdge,
    strokeWidth: 0.8,
    z: 11,
    generatedMass: 'peach-profile-neck',
    materialContractFamily: 'peach-profile',
  });
  marks.push({
    kind: 'blob',
    role: 'hair-mass',
    anchor: [headCenter[0], headCenter[1] - 6],
    rx: rig.hairRx,
    ry: rig.hairRy,
    fill: palette.hair,
    stroke: '#1a120c',
    strokeWidth: 0.8,
    z: 12,
    generatedMass: 'hair-silhouette',
    materialContractFamily: 'hair',
  });
  marks.push({
    kind: 'blob',
    role: 'head-mass',
    anchor: headCenter,
    rx: headRx,
    ry: headRy,
    fill: palette.skin,
    stroke: palette.skinShadow,
    strokeWidth: 0.9,
    z: 15,
    generatedMass: 'inverted-egg-head',
    materialContractFamily: 'peach-profile',
  });
  // Eyes (two small ovals positioned at the upper third of the head).
  for (const side of [-1, 1]) {
    marks.push({
      kind: 'oval',
      role: `eye-${side === -1 ? 'left' : 'right'}`,
      cx: headCenter[0] + side * rig.eyeOffsetX,
      cy: headCenter[1] + rig.eyeOffsetY,
      rx: rig.eyeRx,
      ry: rig.eyeRy,
      fill: palette.eye,
      z: 18,
      generatedMass: 'eye-oval',
      materialContractFamily: 'face-feature',
    });
  }
  // Mouth.
  marks.push({
    kind: 'polygon',
    role: 'mouth',
    points: [
      [headCenter[0] - rig.mouthHalfW, headCenter[1] + rig.mouthOffsetY],
      [headCenter[0], headCenter[1] + rig.mouthOffsetY + 4],
      [headCenter[0] + rig.mouthHalfW, headCenter[1] + rig.mouthOffsetY],
      [headCenter[0], headCenter[1] + rig.mouthOffsetY - 1],
    ],
    fill: palette.mouth,
    stroke: palette.skinShadow,
    strokeWidth: 0.6,
    z: 19,
    generatedMass: 'mouth-lozenge',
    materialContractFamily: 'face-feature',
  });
  return marks;
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 4 — room-interior-two-point recipe
//
// Corner view of an empty interior in two-point perspective: floor and
// ceiling triangles converge to the back corner; left/right walls converge
// to opposite vanishing points. Marks use the existing renderer plane-role
// names ('room:floor-plane' etc.) so roomConcept resolution downstream picks
// them up. Two-point camera primitive declared via polygonizer.twoPointCamera
// so the resolver downstream can lock anchors.
// ─────────────────────────────────────────────────────────────────────────

function compileRoomInteriorTwoPointRecipe(recipe) {
  const subject = recipe.subject || 'two-point interior corner';
  const title = recipe.title || titleFromSubject(subject);
  const viewBox = recipeViewBox({ ...recipe, viewBox: recipe.viewBox || { width: 800, height: 520 } });
  const palette = roomInteriorPalette(recipe);
  const room = roomInteriorRig(viewBox, recipe);
  const marks = roomInteriorMarks(room, palette);
  const impactPoint = [room.backCornerX, room.backCornerFloorY];
  const { depiction, marks: panelMarks } = lowerDepictionLayout(buildRecipeDepiction(recipe, {
    mode: 'related-physical-visual',
    display: { kind: 'single-panel-interior', panelCount: 1 },
    panelBlocking: { paradigm: 'two-point-corner-block', eyeLine: 'back corner on the horizon line; floor + ceiling converge to it' },
    panels: [{ id: 'interior', concern: 'two-point-interior', constellation: 'applies' }],
  }), viewBox);

  return {
    title,
    viewBox,
    depiction,
    polygonizer: {
      subject,
      outputStyle: 'two-point-interior',
      impactPoint,
      concept: { movementConcept: 'corner-on interior', depictionClass: 'roomInteriorTwoPoint' },
      picture: {
        framing: recipe.camera || 'two-point interior corner',
        shotAngle: 'eye-level',
        cameraDistance: 'inside the room',
        compositionIntent: 'floor + left wall + right wall + ceiling meeting at a back corner',
      },
      elements: [
        { role: 'room:floor-plane', importance: 'primary', footprint: 'floor triangle converging to back corner', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'room:ceiling-plane', importance: 'primary', footprint: 'ceiling triangle converging to back corner', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'room:left-wall-plane', importance: 'primary', footprint: 'left wall converging to right vanishing point', depthBand: 'midground', blockingNeeded: 'cca' },
        { role: 'room:right-wall-plane', importance: 'primary', footprint: 'right wall converging to left vanishing point', depthBand: 'midground', blockingNeeded: 'cca' },
      ],
      blockingReality: [
        { role: 'floor-block', basis: 'cca', footprint: 'floor plane meeting walls at the bottom edge', depthBand: 'midground', purpose: 'ground plane' },
        { role: 'ceiling-block', basis: 'cca', footprint: 'ceiling plane meeting walls at the top edge', depthBand: 'midground', purpose: 'upper plane' },
        { role: 'left-wall-block', basis: 'cca', footprint: 'left wall converging into the back corner', depthBand: 'midground', purpose: 'side plane left' },
        { role: 'right-wall-block', basis: 'cca', footprint: 'right wall converging into the back corner', depthBand: 'midground', purpose: 'side plane right' },
      ],
      draftingTable: {
        horizonY: room.horizonY,
        vanishingPoint: room.rightVP,
        baselineY: room.bottomY,
        rulerAxes: { x: 'horizontal screen extent', y: 'vertical screen extent', z: 'depth toward back corner' },
        depthBands: {
          foreground: [Math.round(viewBox.height * 0.7), viewBox.height],
          midground: [room.horizonY - 60, Math.round(viewBox.height * 0.7)],
          background: [0, room.horizonY - 60],
        },
        eyeLine: { direction: [0, 0], stackingRule: 'all wall edges converge to one of the two vanishing points on the horizon' },
      },
      twoPointCamera: {
        kind: 'two-point',
        vanishingPoints: [room.leftVP, room.rightVP],
        horizonY: room.horizonY,
        backCorner: [room.backCornerX, room.backCornerFloorY],
        projectedPins: [
          { role: 'room:floor-plane', screen: [room.backCornerX, room.backCornerFloorY], spawnDirection: 'down' },
          { role: 'room:ceiling-plane', screen: [room.backCornerX, room.backCornerCeilingY], spawnDirection: 'up' },
        ],
      },
      cameraPrimitive: {
        kind: 'two-point',
        canonicalAngle: 'corner-on',
        cameraPoint: { kind: 'eye-level' },
        vanishingPoints: [room.leftVP, room.rightVP],
      },
      roomConcept: {
        kind: 'interior-room',
        camera: { mode: 'two-point-camera-primitive', subjectFraming: 'full-frame-room' },
        placementSpace: { gravityAxis: 'camera-floor-depth', supportPlane: 'room:floor-plane', fullFrameBounds: 'room-envelope' },
        requiredRoles: ['room:floor-plane', 'room:ceiling-plane', 'room:left-wall-plane', 'room:right-wall-plane'],
        fullFrame: true,
      },
      pureMandala: { kind: 'room-corner', room: true, backCorner: [room.backCornerX, room.backCornerFloorY] },
      realityFacts: [
        'two-point corner view',
        'floor + ceiling + 2 walls visible',
        'back corner on the horizon',
        'no back wall in view (corner-on)',
      ],
      minimalAbstractions: [
        'roomInteriorTwoPoint recipe = 2 vanishing points on a horizon + back corner anchor',
        'each room plane is one polygon converging to its associated vanishing point',
      ],
      recipeAudit: auditRecipe({ ...recipe, kind: 'roomInteriorTwoPoint' }),
    },
    scene: {
      view: { direction: [0, 0], baseZ: 10 },
      light: { direction: [-0.45, -0.7], z: 0.65 },
      palette: palette.name,
      cameraPrimitive: { kind: 'two-point', vanishingPoints: [room.leftVP, room.rightVP], horizonY: room.horizonY },
    },
    marks: [...panelMarks, ...marks],
  };
}

function roomInteriorPalette(recipe) {
  const tone = String(recipe.palette || recipe.style || 'warm-low-key').toLowerCase();
  const presets = {
    'warm-low-key': {
      name: 'warm-low-key',
      floor: recipe.floorColor || '#5a4030',
      floorEdge: '#2a1c14',
      ceiling: recipe.ceilingColor || '#a89070',
      ceilingEdge: '#665040',
      leftWall: recipe.leftWallColor || '#806350',
      rightWall: recipe.rightWallColor || '#6e5240',
      wallEdge: '#2a1c14',
    },
    'cool-high-key': {
      name: 'warm-low-key',
      floor: recipe.floorColor || '#aebfc7',
      floorEdge: '#5a6a72',
      ceiling: recipe.ceilingColor || '#e7eff2',
      ceilingEdge: '#8a9aa2',
      leftWall: recipe.leftWallColor || '#c9d4d8',
      rightWall: recipe.rightWallColor || '#b6c2c8',
      wallEdge: '#5a6a72',
    },
  };
  return presets[tone] || presets['warm-low-key'];
}

function roomInteriorRig(viewBox, recipe) {
  const margin = 40;
  const horizonY = Math.round(viewBox.height * 0.5);
  // Vanishing points sit on the horizon, outside the frame on both sides.
  const leftVP = [-Math.round(viewBox.width * 0.25), horizonY];
  const rightVP = [viewBox.width + Math.round(viewBox.width * 0.25), horizonY];
  // Back-corner horizontal position; 0.5 → centered, override via recipe.cornerX.
  const cornerT = Number.isFinite(Number(recipe.cornerX)) ? clamp01(Number(recipe.cornerX)) : 0.5;
  const backCornerX = Math.round(viewBox.width * cornerT);
  const topY = margin;
  const bottomY = viewBox.height - margin;
  // Where the floor lines converge at backCornerX, find the y on each line.
  const backCornerFloorY = intersectLineAtX(
    [margin, bottomY], rightVP, backCornerX,
  );
  const backCornerCeilingY = intersectLineAtX(
    [margin, topY], rightVP, backCornerX,
  );
  return {
    viewBox,
    margin,
    horizonY,
    leftVP,
    rightVP,
    topY,
    bottomY,
    backCornerX,
    backCornerFloorY: Math.round(backCornerFloorY),
    backCornerCeilingY: Math.round(backCornerCeilingY),
  };
}

function roomInteriorMarks(room, palette) {
  const { viewBox, margin, topY, bottomY, backCornerX, backCornerFloorY, backCornerCeilingY } = room;
  const marks = [];
  // Floor: front edge (full width) -> back corner.
  marks.push({
    kind: 'polygon',
    role: 'room:floor-plane',
    points: [
      [margin, bottomY],
      [viewBox.width - margin, bottomY],
      [backCornerX, backCornerFloorY],
    ],
    fill: palette.floor,
    stroke: palette.floorEdge,
    strokeWidth: 1,
    z: 4,
    generatedMass: 'two-point-floor-triangle',
    materialContractFamily: 'room-plane',
  });
  // Ceiling: front edge (full width) -> back corner.
  marks.push({
    kind: 'polygon',
    role: 'room:ceiling-plane',
    points: [
      [margin, topY],
      [viewBox.width - margin, topY],
      [backCornerX, backCornerCeilingY],
    ],
    fill: palette.ceiling,
    stroke: palette.ceilingEdge,
    strokeWidth: 1,
    z: 5,
    generatedMass: 'two-point-ceiling-triangle',
    materialContractFamily: 'room-plane',
  });
  // Left wall: front vertical edge at x=margin, back vertical edge at backCornerX.
  marks.push({
    kind: 'polygon',
    role: 'room:left-wall-plane',
    points: [
      [margin, topY],
      [backCornerX, backCornerCeilingY],
      [backCornerX, backCornerFloorY],
      [margin, bottomY],
    ],
    fill: palette.leftWall,
    stroke: palette.wallEdge,
    strokeWidth: 1,
    z: 6,
    generatedMass: 'two-point-wall-quad',
    materialContractFamily: 'room-plane',
  });
  // Right wall mirrors left.
  marks.push({
    kind: 'polygon',
    role: 'room:right-wall-plane',
    points: [
      [viewBox.width - margin, topY],
      [backCornerX, backCornerCeilingY],
      [backCornerX, backCornerFloorY],
      [viewBox.width - margin, bottomY],
    ],
    fill: palette.rightWall,
    stroke: palette.wallEdge,
    strokeWidth: 1,
    z: 7,
    generatedMass: 'two-point-wall-quad',
    materialContractFamily: 'room-plane',
  });
  return marks;
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0.5;
  if (v < 0.1) return 0.1;
  if (v > 0.9) return 0.9;
  return v;
}

function intersectLineAtX(p0, p1, x) {
  const dx = p1[0] - p0[0];
  if (Math.abs(dx) < 1e-6) return p0[1];
  const t = (x - p0[0]) / dx;
  return p0[1] + t * (p1[1] - p0[1]);
}

function normalizeGarmentPatternStyle(recipe) {
  const raw = String(
    recipe.patternKind ||
    recipe.pattern ||
    recipe.motif ||
    recipe.style ||
    recipe.aesthetic ||
    '',
  ).toLowerCase();
  if (/tartan|plaid|check/.test(raw)) return 'tartan';
  if (/houndstooth|dogtooth|pied-de-poule/.test(raw)) return 'houndstooth';
  if (/victorian|wallpaper|damask|floral/.test(raw)) return 'victorianWallpaper';
  if (/mandala|fractal|fabric|weave|textile/.test(raw)) return 'mandalaFabric';
  return 'blueprint';
}

function normalizeHouseVariant(recipe) {
  const style = String(recipe.style || recipe.aesthetic || recipe.houseStyle || 'craftsman').toLowerCase();
  const requestedRoof = String(recipe.roof || recipe.roofStyle || '').toLowerCase();
  const requestedDoor = String(recipe.door || recipe.doorStyle || '').toLowerCase();
  const requestedPorch = String(recipe.porch || recipe.porchStyle || '').toLowerCase();
  const requestedSteps = String(recipe.steps || recipe.stepStyle || '').toLowerCase();
  const requestedChimney = String(recipe.chimney || recipe.chimneyStyle || '').toLowerCase();
  return {
    style,
    roof: /mansard|victorian/.test(requestedRoof || style) ? 'mansard' : /flat|modern/.test(requestedRoof || style) ? 'flat-parapet' : 'gable',
    door: /arched|victorian/.test(requestedDoor || style) ? 'arched-panel' : /double|wide/.test(requestedDoor) ? 'double-panel' : 'craftsman-panel',
    porch: /wrap|victorian/.test(requestedPorch || style) ? 'wraparound' : /stoop|minimal|modern/.test(requestedPorch || style) ? 'stoop' : 'covered',
    steps: /stair|side/.test(requestedSteps) ? 'side-stair' : /deep|terrace/.test(requestedSteps) ? 'terraced' : 'front-treads',
    chimney: /none|no/.test(requestedChimney) ? 'none' : /twin|double/.test(requestedChimney || style) ? 'twin-stack' : 'single-stack',
  };
}

function housePalette(recipe) {
  const base = {
    name: 'warm-architectural-construction',
    sky: '#dbe8ef',
    ground: '#485642',
    body: '#9c7756',
    bodySide: '#765a42',
    trim: '#f0dfc0',
    roof: '#5c3c40',
    roofDark: '#463139',
    door: '#3f2b24',
    glass: '#6d9eb0',
    porch: '#7d6048',
    line: '#2f241f',
    shadow: '#231915',
    label: '#33403c',
  };
  return {
    ...base,
    ...(recipe.palette && typeof recipe.palette === 'object' && !Array.isArray(recipe.palette) ? recipe.palette : {}),
  };
}

function houseMass(viewBox, recipe) {
  const supplied = recipe.mass && typeof recipe.mass === 'object' && !Array.isArray(recipe.mass) ? recipe.mass : {};
  const w = finiteOr(supplied.w, Math.min(330, viewBox.width * 0.44));
  const h = finiteOr(supplied.h, Math.min(190, viewBox.height * 0.34));
  const x = finiteOr(supplied.x, Math.round((viewBox.width - w) / 2));
  const y = finiteOr(supplied.y, Math.round(viewBox.height * 0.43));
  const depth = finiteOr(supplied.depth, Math.round(w * 0.32));
  return { x, y, w, h, depth };
}

function architecturalConstructionLibraries(variant) {
  return {
    doors: [
      { id: 'craftsman-panel', modules: { w: 1.1, h: 2.15 }, parts: ['slab', 'four-panel insets', 'small upper lite', 'knob'] },
      { id: 'arched-panel', modules: { w: 1.1, h: 2.25 }, parts: ['arched top', 'vertical planks', 'fanlight cue'] },
      { id: 'double-panel', modules: { w: 1.8, h: 2.15 }, parts: ['two leaves', 'center seam', 'paired lites'] },
    ],
    porches: [
      { id: 'covered', modules: { w: 3.1, d: 1.1 }, parts: ['platform', 'two posts', 'small porch roof'] },
      { id: 'stoop', modules: { w: 2.0, d: 0.75 }, parts: ['landing', 'short side cheeks'] },
      { id: 'wraparound', modules: { w: 5.4, d: 1.05 }, parts: ['long platform', 'post rhythm', 'side return'] },
    ],
    steps: [
      { id: 'front-treads', repeat: { count: 4, spacing: 13 }, parts: ['parallel tread slabs'] },
      { id: 'terraced', repeat: { count: 5, spacing: 11 }, parts: ['wide shallow terraces'] },
      { id: 'side-stair', repeat: { count: 5, spacing: 10 }, parts: ['diagonal side run'] },
    ],
    roofs: [
      { id: 'gable', parts: ['left slope', 'right slope', 'ridge cap', 'shingle rhythm'] },
      { id: 'mansard', parts: ['steep lower skirt', 'upper cap', 'dormer slots'] },
      { id: 'flat-parapet', parts: ['flat cap', 'parapet band', 'drain/scupper accents'] },
    ],
    chimneys: [
      { id: 'single-stack', modules: { w: 0.55, h: 1.5 }, parts: ['shaft', 'cap', 'brick bands'] },
      { id: 'twin-stack', modules: { w: 1.2, h: 1.35 }, parts: ['two shafts', 'shared cap', 'brick bands'] },
      { id: 'none', modules: { w: 0, h: 0 }, parts: [] },
    ],
    selected: variant,
  };
}

function architecturalZeroVectorMap(mass, variant, libraries) {
  const slots = [
    {
      role: 'house-body',
      kind: 'primary-mass',
      constellationPoint: [4, 2.8, 0],
      bounds: { x: 0, y: 1.35, w: 8, h: 3.2, z: 0, d: 1.5 },
      collisionGroup: 'mass',
      library: 'body',
      selected: 'main-cca',
    },
    {
      role: 'roof',
      kind: 'cap',
      constellationPoint: [4, 0.9, 0.7],
      bounds: { x: -0.35, y: 0.15, w: 8.7, h: 1.5, z: 0.2, d: 1.8 },
      collisionGroup: 'roof',
      library: 'roofs',
      selected: variant.roof,
      support: 'house-body',
    },
    {
      role: 'door',
      kind: 'entry',
      constellationPoint: [4, 3.65, 0.05],
      bounds: { x: 3.45, y: 2.55, w: 1.1, h: 2.05, z: 0, d: 0.18 },
      collisionGroup: 'facade-openings',
      library: 'doors',
      selected: variant.door,
      support: 'house-body',
    },
    {
      role: 'porch',
      kind: 'entry-platform',
      constellationPoint: [4, 4.65, 0.42],
      bounds: { x: 2.5, y: 4.38, w: 3, h: 0.42, z: 0.15, d: 1 },
      collisionGroup: 'foreground-attachments',
      library: 'porches',
      selected: variant.porch,
      support: 'door',
    },
    {
      role: 'steps',
      kind: 'entry-repeat',
      constellationPoint: [4, 5.1, 0.72],
      bounds: { x: 2.85, y: 4.84, w: 2.3, h: 0.72, z: 0.25, d: 1.15 },
      collisionGroup: 'foreground-attachments',
      library: 'steps',
      selected: variant.steps,
      support: 'porch',
      repeat: libraries.steps.find((item) => item.id === variant.steps)?.repeat,
    },
    {
      role: 'chimney',
      kind: 'roof-attachment',
      constellationPoint: [6.25, 0.55, 1.15],
      bounds: { x: 5.9, y: -0.25, w: 0.65, h: 1.4, z: 0.65, d: 0.42 },
      collisionGroup: 'roof-attachments',
      library: 'chimneys',
      selected: variant.chimney,
      support: 'roof',
    },
    {
      role: 'window-band',
      kind: 'facade-repeat',
      constellationPoint: [4, 2.45, 0.02],
      bounds: { x: 0.75, y: 2.0, w: 6.5, h: 1.05, z: 0, d: 0.08 },
      collisionGroup: 'facade-openings',
      library: 'facePattern',
      selected: 'facade-bays',
      support: 'house-body',
      excludes: ['door'],
    },
  ];
  return {
    kind: 'architectural-zero-vector-map',
    scale: { pxPerUnitX: Math.round(mass.w / 8), pxPerUnitY: Math.round(mass.h / 5), pxPerUnitZ: Math.round(mass.depth / 2) },
    slots,
    noOverlapAssertions: [
      'door sits inside house-body and reserves its facade opening before window-band repeats',
      'porch and steps share foreground group but stack vertically instead of occupying the same y band',
      'chimney snaps to roof support and does not collide with facade openings',
      'window-band excludes the entry-axis slot occupied by door',
    ],
  };
}

// The whole house assembly is authored in ONE compiler-owned oblique space:
// the facade rect is the shared datum, depth recedes up-right by proj.dx/dy,
// and the porch/steps apron comes toward the viewer by proj.fwd. Nothing here
// uses the generic `solid` path — solids re-anchor under the renderer's own
// camera, which is what detached the roof from the body (mixed projection
// spaces). Flat polygons keep every attachment true by construction.
function houseProjection(mass) {
  const dx = Math.round(mass.depth * 0.58);
  const dy = -Math.round(mass.depth * 0.27);
  return { dx, dy, fwd: { x: -Math.round(dx * 0.32), y: Math.round(-dy * 0.5) + 4 } };
}

function houseLerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function architecturalConstructionMarks({ mass, palette, variant, recipe }) {
  const proj = houseProjection(mass);
  const marks = [];
  const body = houseBodyMarks(mass, palette, proj);
  const roof = houseRoofMarks(mass, palette, variant, proj);
  const windows = houseWindowMarks(mass, palette, variant, roof.gableApex);
  const door = houseDoorMarks(mass, palette, variant);
  const porch = housePorchMarks(mass, palette, variant, door, proj);
  const steps = houseStepMarks(palette, variant, porch, proj);
  const chimney = houseChimneyMarks(mass, palette, variant, roof, proj);
  marks.push(
    { kind: 'rect', role: 'house-sky-ground', x: 0, y: 0, w: recipe.viewBox?.width || 760, h: recipe.viewBox?.height || 520, fill: palette.sky, stroke: 'none', z: 0 },
    { kind: 'rect', role: 'ground-plane', x: 0, y: mass.y + mass.h - 2, w: recipe.viewBox?.width || 760, h: 220, fill: palette.ground, stroke: 'none', opacity: 0.58, z: 1 },
    ...body,
    ...roof.marks,
    ...chimney,
    ...windows,
    ...door,
    ...porch.marks,
    ...steps.marks,
    { kind: 'text', role: 'house-library-label', x: mass.x, y: mass.y + mass.h + 88, value: `HOUSE CONSTRUCTION / ${variant.roof} / ${variant.door} / ${variant.porch}`, size: 12, color: palette.label, family: 'monospace', z: 60 },
  );
  return marks;
}

function houseBodyMarks(mass, palette, proj) {
  const { x, y, w, h } = mass;
  const { dx, dy } = proj;
  return [
    { kind: 'polygon', role: 'house-body', points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill: palette.body, stroke: palette.line, strokeWidth: 1, z: 10 },
    { kind: 'polygon', role: 'house-body-side', points: [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]], fill: palette.bodySide, stroke: palette.line, strokeWidth: 1, z: 9 },
  ];
}

function houseRoofMarks(mass, palette, variant, proj) {
  const { x, y, w } = mass;
  const { dx, dy } = proj;
  if (variant.roof === 'flat-parapet') {
    return {
      gableApex: null,
      slope: null,
      marks: [
        { kind: 'polygon', role: 'roof', points: [[x, y], [x + w, y], [x + w + dx, y + dy], [x + dx, y + dy]], fill: palette.roof, stroke: palette.line, strokeWidth: 1, z: 18 },
        { kind: 'rect', role: 'roof-parapet-band', x: x - 4, y: y - 12, w: w + 8, h: 14, fill: palette.roofDark, stroke: palette.line, z: 21 },
        { kind: 'polygon', role: 'roof-parapet-side', points: [[x + w + 4, y - 12], [x + w + 4 + dx, y - 12 + dy], [x + w + 4 + dx, y + 2 + dy], [x + w + 4, y + 2]], fill: palette.roofDark, stroke: palette.line, strokeWidth: 1, z: 20 },
      ],
    };
  }
  if (variant.roof === 'mansard') {
    const skirtTopY = y - Math.round(w * 0.2);
    const capL = [x + w * 0.2, skirtTopY];
    const capR = [x + w * 0.8, skirtTopY];
    return {
      gableApex: null,
      slope: { front: [capR, [x + w + 12, y + 2]], back: [[capR[0] + dx * 0.7, capR[1] + dy * 0.7], [x + w + 12 + dx * 0.7, y + 2 + dy * 0.7]] },
      marks: [
        { kind: 'polygon', role: 'roof', points: [[x - 12, y + 2], capL, capR, [x + w + 12, y + 2]], fill: palette.roof, stroke: palette.line, strokeWidth: 1, z: 18 },
        { kind: 'polygon', role: 'roof-mansard-side', points: [[x + w + 12, y + 2], [x + w + 12 + dx * 0.7, y + 2 + dy * 0.7], [capR[0] + dx * 0.7, capR[1] + dy * 0.7], capR], fill: palette.roofDark, stroke: palette.line, strokeWidth: 1, z: 17 },
        { kind: 'polygon', role: 'roof-mansard-cap', points: [capL, capR, [capR[0] + dx * 0.7, capR[1] + dy * 0.7], [capL[0] + dx * 0.7, capL[1] + dy * 0.7]], fill: palette.roofDark, stroke: palette.line, strokeWidth: 1, z: 16 },
        { kind: 'array', role: 'roof-dormer-band', count: 3, from: [x + w * 0.26, y - Math.round(w * 0.1)], to: [x + w * 0.74, y - Math.round(w * 0.1)], item: { kind: 'rect', x: -13, y: -12, w: 26, h: 24, fill: palette.bodySide, stroke: palette.line, strokeWidth: 1 }, z: 23 },
      ],
    };
  }
  const steep = /cottage|victorian|farmhouse|colonial/.test(variant.style) ? 0.46 : 0.3;
  const gh = Math.round(w * steep);
  const overhang = 14;
  const apexF = [x + w / 2, y - gh];
  const apexB = [apexF[0] + dx, apexF[1] + dy];
  const eaveL = [x - overhang, y + 6];
  const eaveRF = [x + w + overhang, y + 6];
  const eaveRB = [eaveRF[0] + dx, eaveRF[1] + dy];
  const marks = [
    { kind: 'polygon', role: 'roof-gable-face', points: [eaveL, eaveRF, apexF], fill: palette.body, stroke: palette.line, strokeWidth: 1, z: 15 },
    { kind: 'polygon', role: 'roof', points: [apexF, apexB, eaveRB, eaveRF], fill: palette.roof, stroke: palette.line, strokeWidth: 1, z: 18 },
    { kind: 'line', role: 'roof-barge-left', x1: eaveL[0], y1: eaveL[1], x2: apexF[0], y2: apexF[1], stroke: palette.roof, strokeWidth: 7, z: 19 },
    { kind: 'line', role: 'roof-barge-right', x1: apexF[0], y1: apexF[1], x2: eaveRF[0], y2: eaveRF[1], stroke: palette.roofDark, strokeWidth: 7, z: 19 },
    { kind: 'line', role: 'roof-ridge-cap', x1: apexF[0], y1: apexF[1], x2: apexB[0], y2: apexB[1], stroke: palette.roofDark, strokeWidth: 3, z: 24 },
  ];
  for (const t of [0.3, 0.55, 0.8]) {
    const a = houseLerp(apexF, eaveRF, t);
    const b = houseLerp(apexB, eaveRB, t);
    marks.push({ kind: 'line', role: 'roof-shingle-pattern', x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: palette.trim, strokeWidth: 1, opacity: 0.35, z: 22 });
  }
  return { gableApex: { apexF, gh }, slope: { front: [apexF, eaveRF], back: [apexB, eaveRB] }, marks };
}

function houseWindowMarks(mass, palette, variant, gableApex) {
  const { x, y, w, h } = mass;
  const winW = Math.round(w * 0.16);
  const winH = Math.round(h * 0.26);
  const wy = y + Math.round(h * 0.24);
  const marks = [];
  let first = true;
  for (const cx of [x + Math.round(w * 0.13), x + Math.round(w * 0.71)]) {
    marks.push(
      { kind: 'rect', role: first ? 'window-band' : 'window-band-frame', x: cx - 3, y: wy - 3, w: winW + 6, h: winH + 6, fill: palette.trim, stroke: palette.line, strokeWidth: 1, z: 12 },
      { kind: 'rect', role: 'window-glass', x: cx, y: wy, w: winW, h: winH, fill: palette.glass, stroke: palette.line, strokeWidth: 1, opacity: 0.92, z: 13 },
      { kind: 'line', role: 'window-muntin-v', x1: cx + winW / 2, y1: wy, x2: cx + winW / 2, y2: wy + winH, stroke: palette.trim, strokeWidth: 1.4, z: 14 },
      { kind: 'line', role: 'window-muntin-h', x1: cx, y1: wy + winH / 2, x2: cx + winW, y2: wy + winH / 2, stroke: palette.trim, strokeWidth: 1.4, z: 14 },
    );
    first = false;
  }
  if (gableApex) {
    const gy = gableApex.apexF[1] + Math.round(gableApex.gh * 0.52);
    marks.push(
      { kind: 'circle', role: 'gable-light-ring', cx: x + w / 2, cy: gy, r: 11, fill: palette.trim, stroke: palette.line, strokeWidth: 1, z: 16 },
      { kind: 'circle', role: 'gable-light', cx: x + w / 2, cy: gy, r: 8, fill: palette.glass, stroke: 'none', z: 17 },
    );
  }
  return marks;
}

function houseDoorMarks(mass, palette, variant) {
  const w = variant.door === 'double-panel' ? 76 : 50;
  const h = Math.min(88, Math.round(mass.h * 0.52));
  const x = mass.x + mass.w / 2 - w / 2;
  const y = mass.y + mass.h - h;
  const marks = [
    { kind: 'rect', role: 'door-frame', x: x - 4, y: y - 4, w: w + 8, h: h + 4, fill: palette.trim, stroke: palette.line, strokeWidth: 1, z: 29 },
    { kind: 'rect', role: 'door', x, y, w, h, fill: palette.door, stroke: palette.line, strokeWidth: 1, z: 30 },
    { kind: 'rect', role: 'door-lite', x: x + w * 0.22, y: y + 12, w: w * 0.56, h: 18, fill: palette.glass, stroke: palette.trim, strokeWidth: 1, opacity: 0.82, z: 34 },
    { kind: 'circle', role: 'door-knob', cx: x + w * 0.8, cy: y + h * 0.55, r: 3, fill: palette.trim, stroke: 'none', z: 35 },
  ];
  if (variant.door === 'arched-panel') {
    marks.push({ kind: 'oval', role: 'door-arched-fanlight', cx: x + w / 2, cy: y + 6, rx: w * 0.42, ry: 14, fill: palette.glass, stroke: palette.trim, opacity: 0.5, z: 36 });
  }
  if (variant.door === 'double-panel') {
    marks.push({ kind: 'line', role: 'door-center-seam', x1: x + w / 2, y1: y, x2: x + w / 2, y2: y + h, stroke: palette.trim, strokeWidth: 1, opacity: 0.6, z: 36 });
  }
  return marks;
}

function housePorchMarks(mass, palette, variant, doorMarks, proj) {
  const door = doorMarks.find((m) => m.role === 'door');
  const { fwd } = proj;
  const porchW = variant.porch === 'wraparound' ? Math.round(mass.w * 0.82) : variant.porch === 'stoop' ? door.w + 46 : door.w + 98;
  const px = mass.x + mass.w / 2 - porchW / 2;
  const pyb = mass.y + mass.h;
  const lipH = 10;
  const frontL = [px + fwd.x, pyb + fwd.y];
  const frontR = [px + porchW + fwd.x, pyb + fwd.y];
  const marks = [
    { kind: 'polygon', role: 'porch', points: [[px, pyb], [px + porchW, pyb], frontR, frontL], fill: palette.porch, stroke: palette.line, strokeWidth: 1, z: 32 },
    { kind: 'polygon', role: 'porch-lip', points: [frontL, frontR, [frontR[0], frontR[1] + lipH], [frontL[0], frontL[1] + lipH]], fill: palette.shadow, stroke: palette.line, strokeWidth: 1, opacity: 0.85, z: 32 },
  ];
  if (variant.porch !== 'stoop') {
    const postH = (door.h || 84) + 12;
    const roofAttachY = door.y - 14;
    const postTopY = pyb + fwd.y - postH;
    const posts = variant.porch === 'wraparound'
      ? [frontL[0] + 10, frontL[0] + porchW / 2 - 5, frontR[0] - 20]
      : [frontL[0] + 10, frontR[0] - 20];
    for (const postX of posts) {
      marks.push({ kind: 'rect', role: 'porch-post', x: postX, y: postTopY, w: 10, h: postH, fill: palette.trim, stroke: palette.line, strokeWidth: 1, z: 33 });
    }
    marks.push(
      { kind: 'polygon', role: 'porch-roof', points: [[px - 6, roofAttachY], [px + porchW + 6, roofAttachY], [frontR[0] + 6, postTopY], [frontL[0] - 6, postTopY]], fill: palette.roofDark, stroke: palette.line, strokeWidth: 1, z: 34 },
    );
  }
  return { platform: { frontL, frontR, lipH, porchW }, marks };
}

function houseStepMarks(palette, variant, porch, proj) {
  const { frontL, lipH, porchW } = porch.platform;
  const { fwd } = proj;
  const count = variant.steps === 'terraced' ? 4 : 3;
  const treadW = Math.round(porchW * (variant.steps === 'terraced' ? 0.9 : 0.62));
  const stepFwd = { x: Math.round(fwd.x * 0.55), y: Math.max(6, Math.round(fwd.y * 0.6)) };
  const diag = variant.steps === 'side-stair' ? 26 : 0;
  const marks = [];
  let ax = frontL[0] + Math.round((porchW - treadW) / 2);
  let ay = frontL[1] + lipH;
  for (let i = 0; i < count; i += 1) {
    const bx = ax + stepFwd.x + (diag ? diag : 0);
    const by = ay + stepFwd.y;
    marks.push(
      { kind: 'polygon', role: 'steps', points: [[ax, ay], [ax + treadW, ay], [bx + treadW, by], [bx, by]], fill: palette.porch, stroke: palette.line, strokeWidth: 1, z: 38 },
      { kind: 'polygon', role: 'steps-riser', points: [[bx, by], [bx + treadW, by], [bx + treadW, by + 6], [bx, by + 6]], fill: palette.shadow, stroke: palette.line, strokeWidth: 1, opacity: 0.85, z: 38 },
    );
    ax = bx;
    ay = by + 6;
  }
  return { marks };
}

function houseChimneyMarks(mass, palette, variant, roof, proj) {
  if (variant.chimney === 'none' || !roof.slope) return [];
  const twin = variant.chimney === 'twin-stack';
  const { dx, dy } = proj;
  const stacks = twin ? [0.34, 0.62] : [0.42];
  const marks = [];
  for (const t of stacks) {
    const onFront = houseLerp(roof.slope.front[0], roof.slope.front[1], t);
    const onBack = houseLerp(roof.slope.back[0], roof.slope.back[1], t);
    const base = houseLerp(onFront, onBack, 0.45);
    const cw = 22;
    const ch = 52;
    const bx = base[0] - cw / 2;
    const by = base[1] + 10;
    const sideDx = Math.round(dx * 0.16);
    const sideDy = Math.round(dy * 0.16);
    marks.push(
      { kind: 'polygon', role: 'chimney', points: [[bx, by - ch], [bx + cw, by - ch], [bx + cw, by], [bx, by]], fill: palette.bodySide, stroke: palette.line, strokeWidth: 1, z: 26 },
      { kind: 'polygon', role: 'chimney-side', points: [[bx + cw, by - ch], [bx + cw + sideDx, by - ch + sideDy], [bx + cw + sideDx, by + sideDy], [bx + cw, by]], fill: palette.shadow, stroke: palette.line, strokeWidth: 1, z: 25 },
      { kind: 'rect', role: 'chimney-cap', x: bx - 4, y: by - ch - 8, w: cw + 8 + sideDx, h: 8, fill: palette.roofDark, stroke: palette.line, z: 29 },
    );
    for (let i = 0; i < 3; i += 1) {
      marks.push({ kind: 'line', role: 'chimney-brick-pattern', x1: bx + 3, y1: by - ch + 12 + i * 13, x2: bx + cw - 3, y2: by - ch + 12 + i * 13, stroke: palette.trim, strokeWidth: 1, opacity: 0.45, z: 30 });
    }
  }
  return marks;
}

function compileGarmentTextileRecipe(recipe, pattern) {
  const subject = recipe.subject || `${pattern} garment textile pattern`;
  const title = recipe.title || titleFromSubject(subject);
  const viewBox = recipeViewBox({ ...recipe, viewBox: recipe.viewBox || { width: 760, height: 520 } });
  const swatch = patternSwatchBounds(viewBox);
  const palette = textilePalette(recipe, pattern);
  const motifRole = textileMotifRole(pattern);
  const patternMarks = garmentTextilePatternMarks(pattern, swatch, palette, recipe);
  const textureMarks = recipe.fabricTexture === false
    ? []
    : mandalaFabricTextureMarks(swatch, palette, {
        density: pattern === 'mandalaFabric' ? 11 : 7,
        opacity: pattern === 'mandalaFabric' ? 0.13 : 0.055,
      });

  return {
    title,
    viewBox,
    depiction: {
      paradigm: 'depiction',
      mode: 'related-physical-visual',
      display: { kind: 'single-pattern-swatch', panelCount: 1 },
      panelBlocking: {
        paradigm: 'repeating-textile-grid',
        eyeLine: 'read the field as one aligned repeat, then inspect motif spacing and fabric texture',
      },
      panels: [
        {
          id: 'pattern-swatch',
          concern: pattern,
          constellation: 'does-not-apply',
          bounds: swatch,
        },
      ],
    },
    polygonizer: {
      subject,
      outputStyle: 'pattern-sheet',
      impactPoint: [Math.round(swatch.x + swatch.w / 2), Math.round(swatch.y + swatch.h / 2)],
      concept: { movementConcept: 'repeating surface design', depictionClass: 'garmentPattern' },
      picture: {
        framing: 'flat textile swatch',
        shotAngle: 'orthographic fabric sample',
        cameraDistance: 'full repeat field',
        compositionIntent: 'show repeat cadence, spacing, alignment, and fabric-like optical texture',
      },
      elements: [
        { role: 'repeat-field', importance: 'primary', footprint: 'full swatch', depthBand: 'flat-sheet', blockingNeeded: 'repeat-grid' },
        { role: motifRole, importance: 'primary-detail', footprint: 'repeated tile', depthBand: 'flat-sheet', blockingNeeded: 'aligned motif' },
        { role: 'fabric-mandala', importance: 'secondary', footprint: 'tiny mandala overlay', depthBand: 'surface', blockingNeeded: 'low-opacity micro-repeat' },
      ],
      blockingReality: [
        {
          role: 'repeat-field-block',
          basis: 'lattice',
          footprint: `${pattern} repeat over rectangular swatch`,
          repeats: 'tile rows and columns with locked spacing/alignment',
          depthBand: 'flat-sheet',
          purpose: 'pattern field without hand-enumerating every motif',
        },
        {
          role: 'fabric-mandala-block',
          basis: 'mandala-fractal',
          footprint: 'subtle low-opacity tiny marks over the field',
          repeats: 'micro mandala cells',
          depthBand: 'surface',
          purpose: 'fabric illusion without raster texture',
        },
      ],
      pureMandala: {
        kind: 'flat-textile-repeat-sheet',
        units: 'repeat-cell',
        origin: [swatch.x, swatch.y],
        axes: { x: [1, 0], y: [0, 1] },
        interval: pattern === 'tartan' ? 36 : pattern === 'houndstooth' ? 40 : 48,
        sheet: { width: viewBox.width, height: viewBox.height },
        pattern: {
          kind: pattern,
          repeat: repeatMetrics(pattern),
          alignment: 'orthographic locked grid',
          spacing: 'cell edges and motif accents share the same lattice',
          fabricTexture: recipe.fabricTexture === false ? 'disabled' : 'low-opacity mandala micro-repeat',
        },
      },
      realityFacts: [
        `${pattern} repeat field`,
        'consistent spacing',
        'motifs aligned to a visible lattice',
        'surface texture reads as fabric, not a separate object',
      ],
      minimalAbstractions: [
        'garmentPattern textile recipe = background swatch plus repeated primitive motifs',
        'composition = locked repeat grid, shared spacing interval, and clear edge-to-edge tiling',
        'fabric illusion = tiny low-opacity mandala fractal overlay',
      ],
      recipeAudit: auditRecipe({ ...recipe, kind: 'garmentPattern', style: pattern }),
    },
    scene: {
      renderMode: 'pattern-render',
      view: { direction: [0, 0], baseZ: 10 },
      palette: palette.name,
      light: { direction: [-0.2, -0.8], z: 0.35 },
    },
    marks: [
      { kind: 'rect', role: 'textile-paper-background', x: 0, y: 0, w: viewBox.width, h: viewBox.height, fill: palette.paper, stroke: 'none', z: 0 },
      { kind: 'rect', role: 'repeat-field-ground', ...swatch, fill: palette.base, stroke: palette.edge, strokeWidth: 1, z: 1 },
      ...patternMarks,
      ...textureMarks,
      { kind: 'text', role: 'pattern-label', x: swatch.x, y: viewBox.height - 24, value: `${patternLabel(pattern)} / repeat locked to spacing grid`, size: 13, color: palette.label, family: 'monospace', z: 90 },
    ],
  };
}

function garmentPatternMarks() {
  const cyan = '#7ee7ff';
  const pale = '#bdefff';
  const fill = '#1f4964';
  const weak = '#4fb7d8';
  return [
    { kind: 'rect', role: 'blueprint-background', x: 0, y: 0, w: 900, h: 620, fill: '#102c46', stroke: 'none', z: 0 },
    { kind: 'line', role: 'mandala-grid-x-1', x1: 80, y1: 60, x2: 80, y2: 560, stroke: weak, strokeWidth: 1, opacity: 0.18, z: 1 },
    { kind: 'line', role: 'mandala-grid-x-2', x1: 280, y1: 60, x2: 280, y2: 560, stroke: weak, strokeWidth: 1, opacity: 0.18, z: 1 },
    { kind: 'line', role: 'mandala-grid-x-3', x1: 480, y1: 60, x2: 480, y2: 560, stroke: weak, strokeWidth: 1, opacity: 0.18, z: 1 },
    { kind: 'line', role: 'mandala-grid-x-4', x1: 680, y1: 60, x2: 680, y2: 560, stroke: weak, strokeWidth: 1, opacity: 0.18, z: 1 },
    { kind: 'line', role: 'mandala-grid-y-1', x1: 60, y1: 120, x2: 840, y2: 120, stroke: weak, strokeWidth: 1, opacity: 0.18, z: 1 },
    { kind: 'line', role: 'mandala-grid-y-2', x1: 60, y1: 320, x2: 840, y2: 320, stroke: weak, strokeWidth: 1, opacity: 0.18, z: 1 },
    { kind: 'line', role: 'mandala-grid-y-3', x1: 60, y1: 520, x2: 840, y2: 520, stroke: weak, strokeWidth: 1, opacity: 0.18, z: 1 },
    { kind: 'polygon', role: 'front-leg-pattern-piece', points: [[150, 165], [310, 155], [338, 292], [292, 515], [190, 515], [226, 303]], fill, stroke: cyan, strokeWidth: 1, opacity: 0.72, z: 10 },
    { kind: 'polygon', role: 'back-leg-pattern-piece', points: [[455, 145], [650, 154], [694, 304], [610, 525], [496, 520], [530, 306]], fill, stroke: cyan, strokeWidth: 1, opacity: 0.68, z: 10 },
    { kind: 'polygon', role: 'waistband-pattern-piece', points: [[130, 82], [690, 82], [682, 125], [122, 125]], fill: '#255b7a', stroke: cyan, strokeWidth: 1, opacity: 0.68, z: 11 },
    { kind: 'polygon', role: 'pocket-facing-piece', points: [[724, 340], [820, 348], [798, 456], [732, 430]], fill: '#255b7a', stroke: cyan, strokeWidth: 1, opacity: 0.66, z: 11 },
    { kind: 'line', role: 'front-leg-grain-line', x1: 240, y1: 190, x2: 240, y2: 492, stroke: pale, strokeWidth: 1, opacity: 0.75, z: 20 },
    { kind: 'line', role: 'back-leg-grain-line', x1: 570, y1: 180, x2: 570, y2: 496, stroke: pale, strokeWidth: 1, opacity: 0.75, z: 20 },
    { kind: 'polyline', role: 'front-leg-seam-allowance', points: [[136, 154], [322, 144], [352, 292], [304, 530], [178, 530], [212, 304], [136, 154]], stroke: pale, strokeWidth: 1, opacity: 0.46, z: 19 },
    { kind: 'polyline', role: 'back-leg-seam-allowance', points: [[442, 132], [663, 142], [710, 304], [622, 540], [482, 535], [514, 306], [442, 132]], stroke: pale, strokeWidth: 1, opacity: 0.46, z: 19 },
    { kind: 'array', role: 'labels-and-ticks-notch-ticks', count: 6, from: [150, 160], to: [650, 154], item: { kind: 'line', x1: 0, y1: -8, x2: 0, y2: 8, stroke: pale, strokeWidth: 1 }, z: 24 },
    { kind: 'text', role: 'front-leg-label', x: 205, y: 548, value: 'FRONT LEG', size: 16, color: pale, family: 'monospace', z: 30 },
    { kind: 'text', role: 'back-leg-label', x: 522, y: 548, value: 'BACK LEG', size: 16, color: pale, family: 'monospace', z: 30 },
    { kind: 'text', role: 'waistband-label', x: 360, y: 112, value: 'WAISTBAND CUT 2', size: 15, color: pale, family: 'monospace', anchor: 'middle', z: 30 },
    { kind: 'text', role: 'pocket-facing-label', x: 700, y: 486, value: 'POCKET FACING', size: 13, color: pale, family: 'monospace', z: 30 },
    { kind: 'text', role: 'title-block', x: 60, y: 590, value: 'JEANS PATTERN / GRID-RENDER / RECIPE COMPILED TO PRIMITIVES', size: 13, color: pale, family: 'monospace', z: 30 },
  ];
}

function patternSwatchBounds(viewBox) {
  const margin = 48;
  return {
    x: margin,
    y: 42,
    w: Math.max(240, viewBox.width - margin * 2),
    h: Math.max(220, viewBox.height - 112),
  };
}

function textilePalette(recipe, pattern) {
  const palettes = {
    tartan: {
      name: 'tartan-wool',
      paper: '#f5f1e8',
      base: '#153f36',
      edge: '#10231f',
      label: '#25312c',
      a: '#12312b',
      b: '#9f2635',
      c: '#e7c76f',
      d: '#f2efe3',
      ink: '#101716',
      ghost: '#f4e6b4',
    },
    houndstooth: {
      name: 'houndstooth-wool',
      paper: '#f6f3ed',
      base: '#f2efe7',
      edge: '#24211d',
      label: '#24211d',
      a: '#171717',
      b: '#f2efe7',
      c: '#38342e',
      d: '#d8d1c4',
      ink: '#111111',
      ghost: '#8f8779',
    },
    victorianWallpaper: {
      name: 'victorian-wallpaper',
      paper: '#f4efe6',
      base: '#3f6f61',
      edge: '#233c36',
      label: '#293831',
      a: '#244f45',
      b: '#b8895f',
      c: '#e9c77d',
      d: '#f0dfb9',
      ink: '#1f372f',
      ghost: '#f6d996',
    },
    mandalaFabric: {
      name: 'mandala-fabric',
      paper: '#f4efe8',
      base: '#2d4654',
      edge: '#172a33',
      label: '#22313a',
      a: '#1f3440',
      b: '#5f8fa3',
      c: '#d2b16a',
      d: '#e9dbc0',
      ink: '#16262e',
      ghost: '#e8d49a',
    },
  };
  const base = palettes[pattern] || palettes.tartan;
  return {
    ...base,
    ...(recipe.palette && typeof recipe.palette === 'object' && !Array.isArray(recipe.palette) ? recipe.palette : {}),
  };
}

function garmentTextilePatternMarks(pattern, swatch, palette, recipe) {
  if (pattern === 'tartan') return tartanMarks(swatch, palette, recipe);
  if (pattern === 'houndstooth') return houndstoothMarks(swatch, palette, recipe);
  if (pattern === 'victorianWallpaper') return victorianWallpaperMarks(swatch, palette, recipe);
  return mandalaFieldPatternMarks(swatch, palette, recipe);
}

function textileMotifRole(pattern) {
  if (pattern === 'victorianWallpaper') return 'victorian-motif';
  if (pattern === 'mandalaFabric') return 'mandala-fabric-motif';
  return `${pattern}-motif`;
}

function tartanMarks(swatch, palette, recipe) {
  const step = Number.isFinite(recipe.repeat) ? recipe.repeat : 72;
  const marks = [];
  let i = 0;
  for (let x = swatch.x; x <= swatch.x + swatch.w; x += step) {
    marks.push({ kind: 'rect', role: `tartan-vertical-wide-${i}`, x: x + 6, y: swatch.y, w: 18, h: swatch.h, fill: palette.b, opacity: 0.62, z: 10 });
    marks.push({ kind: 'rect', role: `tartan-vertical-gold-${i}`, x: x + 31, y: swatch.y, w: 5, h: swatch.h, fill: palette.c, opacity: 0.72, z: 12 });
    marks.push({ kind: 'line', role: `tartan-vertical-pin-${i}`, x1: x + 43, y1: swatch.y, x2: x + 43, y2: swatch.y + swatch.h, stroke: palette.d, strokeWidth: 1, opacity: 0.5, z: 13 });
    i++;
  }
  i = 0;
  for (let y = swatch.y; y <= swatch.y + swatch.h; y += step) {
    marks.push({ kind: 'rect', role: `tartan-horizontal-wide-${i}`, x: swatch.x, y: y + 8, w: swatch.w, h: 16, fill: palette.ink, opacity: 0.36, z: 14 });
    marks.push({ kind: 'rect', role: `tartan-horizontal-red-${i}`, x: swatch.x, y: y + 37, w: swatch.w, h: 8, fill: palette.b, opacity: 0.68, z: 15 });
    marks.push({ kind: 'line', role: `tartan-horizontal-pin-${i}`, x1: swatch.x, y1: y + 53, x2: swatch.x + swatch.w, y2: y + 53, stroke: palette.c, strokeWidth: 1, opacity: 0.5, z: 16 });
    i++;
  }
  return marks;
}

function houndstoothMarks(swatch, palette, recipe) {
  const cell = Number.isFinite(recipe.repeat) ? recipe.repeat : 38;
  const marks = [];
  let idx = 0;
  for (let y = swatch.y - cell; y < swatch.y + swatch.h + cell; y += cell) {
    for (let x = swatch.x - cell; x < swatch.x + swatch.w + cell; x += cell) {
      const dark = ((Math.round((x - swatch.x) / cell) + Math.round((y - swatch.y) / cell)) % 2) === 0;
      const fill = dark ? palette.a : palette.b;
      const stroke = dark ? palette.a : palette.d;
      marks.push({
        kind: 'polygon',
        role: `houndstooth-tooth-${idx}`,
        points: [
          [x, y],
          [x + cell * 0.58, y],
          [x + cell * 0.58, y + cell * 0.22],
          [x + cell, y + cell * 0.22],
          [x + cell * 0.72, y + cell * 0.5],
          [x + cell, y + cell],
          [x + cell * 0.42, y + cell],
          [x + cell * 0.42, y + cell * 0.78],
          [x, y + cell * 0.78],
          [x + cell * 0.28, y + cell * 0.5],
        ],
        fill,
        stroke,
        strokeWidth: 0.5,
        opacity: 0.94,
        z: 10 + (dark ? 1 : 0),
      });
      idx++;
    }
  }
  return marks;
}

function victorianWallpaperMarks(swatch, palette, recipe) {
  const cell = Number.isFinite(recipe.repeat) ? recipe.repeat : 92;
  const marks = [];
  let idx = 0;
  for (let y = swatch.y + cell * 0.45; y < swatch.y + swatch.h; y += cell) {
    for (let x = swatch.x + cell * 0.5; x < swatch.x + swatch.w; x += cell) {
      marks.push({ kind: 'oval', role: `victorian-medallion-${idx}`, cx: x, cy: y, rx: cell * 0.25, ry: cell * 0.34, fill: palette.a, stroke: palette.c, strokeWidth: 1, opacity: 0.5, z: 11 });
      marks.push({ kind: 'oval', role: `victorian-petal-top-${idx}`, cx: x, cy: y - cell * 0.22, rx: cell * 0.12, ry: cell * 0.2, fill: palette.d, opacity: 0.38, z: 12 });
      marks.push({ kind: 'wedge', role: `victorian-petal-bottom-${idx}`, cx: x, cy: y + cell * 0.12, r: cell * 0.22, rInner: cell * 0.05, start: 0.37, end: 0.63, fill: palette.d, opacity: 0.34, z: 12 });
      marks.push({ kind: 'polyline', role: `victorian-vine-${idx}`, points: [[x - cell * 0.38, y], [x - cell * 0.16, y - cell * 0.18], [x + cell * 0.16, y + cell * 0.18], [x + cell * 0.38, y]], stroke: palette.c, strokeWidth: 1, opacity: 0.56, z: 13 });
      idx++;
    }
  }
  return marks;
}

function mandalaFieldPatternMarks(swatch, palette, recipe) {
  const cell = Number.isFinite(recipe.repeat) ? recipe.repeat : 64;
  const marks = [];
  let idx = 0;
  for (let y = swatch.y + cell * 0.5; y < swatch.y + swatch.h; y += cell) {
    for (let x = swatch.x + cell * 0.5; x < swatch.x + swatch.w; x += cell) {
      marks.push({ kind: 'circle', role: `mandala-fabric-ring-${idx}`, cx: x, cy: y, r: cell * 0.23, fill: 'none', stroke: palette.c, strokeWidth: 1, opacity: 0.26, z: 10 });
      marks.push({ kind: 'line', role: `mandala-fabric-cross-a-${idx}`, x1: x - cell * 0.22, y1: y, x2: x + cell * 0.22, y2: y, stroke: palette.d, strokeWidth: 1, opacity: 0.22, z: 11 });
      marks.push({ kind: 'line', role: `mandala-fabric-cross-b-${idx}`, x1: x, y1: y - cell * 0.22, x2: x, y2: y + cell * 0.22, stroke: palette.d, strokeWidth: 1, opacity: 0.22, z: 11 });
      idx++;
    }
  }
  return marks;
}

function mandalaFabricTextureMarks(swatch, palette, { density, opacity }) {
  const marks = [];
  const dx = swatch.w / density;
  const dy = swatch.h / Math.max(4, Math.round(density * 0.65));
  let idx = 0;
  for (let y = swatch.y + dy * 0.5; y < swatch.y + swatch.h; y += dy) {
    for (let x = swatch.x + dx * 0.5; x < swatch.x + swatch.w; x += dx) {
      const r = Math.max(2, Math.min(dx, dy) * 0.12);
      marks.push({ kind: 'circle', role: `fabric-mandala-dot-${idx}`, cx: Math.round(x), cy: Math.round(y), r, fill: palette.ghost, opacity, z: 70 });
      marks.push({ kind: 'line', role: `fabric-mandala-thread-${idx}`, x1: Math.round(x - r * 1.8), y1: Math.round(y), x2: Math.round(x + r * 1.8), y2: Math.round(y), stroke: palette.ghost, strokeWidth: 0.7, opacity: opacity * 0.85, z: 71 });
      idx++;
    }
  }
  return marks;
}

function repeatMetrics(pattern) {
  if (pattern === 'tartan') return { x: 72, y: 72, rule: 'crossing bands share a repeat interval' };
  if (pattern === 'houndstooth') return { x: 38, y: 38, rule: 'alternating broken-check tooth cells' };
  if (pattern === 'victorianWallpaper') return { x: 92, y: 92, rule: 'offset medallions and vines on a vertical repeat' };
  return { x: 64, y: 64, rule: 'mandala micro-cells tile the surface' };
}

function patternLabel(pattern) {
  const labels = {
    tartan: 'TARTAN TEXTILE',
    houndstooth: 'HOUNDSTOOTH TEXTILE',
    victorianWallpaper: 'VICTORIAN WALLPAPER REPEAT',
    mandalaFabric: 'MANDALA FABRIC TEXTURE',
  };
  return labels[pattern] || 'GARMENT TEXTILE';
}

function titleFromSubject(subject) {
  return String(subject || 'Recipe sketch')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (ch) => ch.toUpperCase());
}

function buildRecipeDepiction(recipe, defaults) {
  const depiction = recipe.depiction && typeof recipe.depiction === 'object' && !Array.isArray(recipe.depiction)
    ? recipe.depiction
    : {};
  const panelRecipe = recipe.panelRecipe || recipe.panelDepiction || recipe.layoutMode || depiction.panelRecipe || depiction.recipe;
  const display = recipe.display && typeof recipe.display === 'object' && !Array.isArray(recipe.display)
    ? recipe.display
    : depiction.display;
  const panelBlocking = recipe.panelBlocking && typeof recipe.panelBlocking === 'object' && !Array.isArray(recipe.panelBlocking)
    ? recipe.panelBlocking
    : depiction.panelBlocking;
  const panels = Array.isArray(recipe.panels)
    ? recipe.panels
    : Array.isArray(depiction.panels)
      ? depiction.panels
      : panelRecipe
        ? undefined
        : defaults.panels;
  const lettering = recipe.lettering && typeof recipe.lettering === 'object' && !Array.isArray(recipe.lettering)
    ? recipe.lettering
    : recipe.bubbleLetters && typeof recipe.bubbleLetters === 'object' && !Array.isArray(recipe.bubbleLetters)
      ? { carriers: [{ kind: 'handwrittenBubbleLetters', ...recipe.bubbleLetters }] }
    : Array.isArray(recipe.speechBubbles)
      ? { carriers: recipe.speechBubbles }
      : depiction.lettering;
  return {
    paradigm: 'depiction',
    recipe: panelRecipe,
    panelRecipe,
    mode: depiction.mode || defaults.mode,
    display: { ...(!panelRecipe ? defaults.display || {} : {}), ...(display || {}) },
    panelBlocking: { ...(!panelRecipe ? defaults.panelBlocking || {} : {}), ...(panelBlocking || {}) },
    panels,
    lettering,
  };
}

function panelCenter(bounds) {
  return [Math.round(bounds.x + bounds.w / 2), Math.round(bounds.y + bounds.h / 2)];
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function recipeViewBox(recipe) {
  const supplied = recipe.viewBox && typeof recipe.viewBox === 'object' && !Array.isArray(recipe.viewBox)
    ? recipe.viewBox
    : null;
  if (Number.isFinite(supplied?.width) && Number.isFinite(supplied?.height)) {
    return { width: supplied.width, height: supplied.height };
  }
  const panelRecipe = String(recipe.panelRecipe || recipe.panelDepiction || recipe.layoutMode || recipe.depiction?.panelRecipe || recipe.depiction?.recipe || '').toLowerCase();
  if (/time|cover|magazine/.test(panelRecipe)) {
    return { width: 520, height: 720 };
  }
  return { width: 720, height: 520 };
}

function primarySubjectPanel(panels = []) {
  const panel = panels.find((candidate) => /hero|portrait|scene/i.test(candidate.concern || candidate.id || '') && candidate.constellation === 'applies') ||
    panels.find((candidate) => candidate.constellation === 'applies') ||
    panels[0];
  return panel?.bounds;
}
