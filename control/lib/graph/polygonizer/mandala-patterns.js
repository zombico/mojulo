import { getManjiProgramShelfCard } from '../manji-programs/loader.js';

const MANDALA_PATTERN_LIBRARY = [
  {
    id: 'snowflake-sixfold',
    label: 'Snowflake sixfold',
    family: 'radial-symmetry',
    aliases: ['snowflake', 'sixfold', 'hexflake', 'crystal'],
    topology: { axes: 6, handedness: 'mirrored', cells: 'radial-arms' },
    intents: ['rotation', 'depth-staging'],
    reasoningUse: [
      'branch repeated objects around one center without overlap',
      'place delicate detail on equal angular spokes',
      'reserve alternating arm bands for foreground/background depth',
    ],
    boundaryContract: {
      slots: ['center', 'arm-0', 'arm-1', 'arm-2', 'arm-3', 'arm-4', 'arm-5'],
      collisionGroups: ['radial-arm', 'center'],
      depthBands: ['center', 'spoke-near', 'spoke-far'],
    },
    // Cardinal manji at the center; 6 arm slots on a unit ring (60° apart).
    // Arm positions live on the hexagon read of the spine — a secondary
    // lattice over the primary cardinal lattice (see anchorHexagon in
    // manji.js). Children placed at arm slots are themselves cardinal
    // manjis in their own local frame.
    manjiProgram: {
      spine: {
        bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
        bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' } },
      },
      slotPattern: { id: 'ring-N', params: { n: 6, radius: 1 } },
      slotLabels: ['arm-0', 'arm-1', 'arm-2', 'arm-3', 'arm-4', 'arm-5'],
      centerSlotId: 'center',
    },
  },
  {
    id: 'l-tetrad',
    label: 'L tetrad',
    family: 'orthogonal-rotation',
    aliases: ['l shape', 'l-shaped tetrad', 'tetrad', 'corner-turns'],
    topology: { axes: 4, handedness: 'selectable', cells: 'four-corner-elbows' },
    intents: ['rotation', 'partitioning', 'bilateral'],
    reasoningUse: [
      'turn a path through four corners while preserving clearance',
      'place app-like controls around a center',
      'separate related elements into readable elbow quadrants',
    ],
    boundaryContract: {
      slots: ['center', 'north-east-elbow', 'south-east-elbow', 'south-west-elbow', 'north-west-elbow'],
      collisionGroups: ['elbow-arm', 'center'],
      depthBands: ['clockwise-near', 'counterclockwise-far'],
    },
    // Cardinal manji at the center; 4 elbow slots at the unit-square
    // corners. Label order matches 4-center-square's anchor output
    // (SW, SE, NE, NW). Children placed at elbow slots are themselves
    // cardinal manjis in their own local frame; the L of each elbow is
    // expressed via the child manji's bar1/bar2 fold program.
    manjiProgram: {
      spine: {
        bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
        bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' } },
      },
      slotPattern: { id: '4-center-square', params: { halfWidth: 1 } },
      slotLabels: [
        'south-west-elbow',
        'south-east-elbow',
        'north-east-elbow',
        'north-west-elbow',
      ],
      centerSlotId: 'center',
    },
  },
  {
    id: 'pinwheel-tetrad',
    label: 'Pinwheel tetrad',
    family: 'orthogonal-rotation',
    aliases: ['pinwheel', 'windmill', 'rotating tetrad', 'swirl tetrad'],
    topology: { axes: 4, handedness: 'clockwise-or-counterclockwise', cells: 'rotating-arms' },
    intents: ['rotation', 'partitioning'],
    reasoningUse: [
      'model rotation, cyclic order, and visual flow',
      'alternate handedness without changing the visible primitive library',
      'keep four arms mutually exclusive around a shared hub',
    ],
    boundaryContract: {
      slots: ['hub', 'arm-a', 'arm-b', 'arm-c', 'arm-d'],
      collisionGroups: ['rotor-arm', 'hub'],
      depthBands: ['leading-arm', 'trailing-arm'],
    },
  },
  {
    id: 'seal-grid',
    label: 'Seal grid',
    family: 'orthographic-stamp',
    aliases: ['seal', 'stamp', 'hanko', 'japanese seal', 'sigil grid'],
    topology: { axes: 2, handedness: 'none', cells: 'nested-rectilinear-strokes' },
    intents: ['containment', 'enclosure', 'partitioning', 'negative-space'],
    reasoningUse: [
      'encode dense interior strokes inside a hard outer boundary',
      'snap labels, glyphs, panels, or miniatures into square subcells',
      'preserve legibility by treating empty cuts as first-class spaces',
    ],
    boundaryContract: {
      slots: ['outer-frame', 'inner-stroke-a', 'inner-stroke-b', 'negative-cut', 'corner-stamps'],
      collisionGroups: ['seal-frame', 'seal-stroke', 'negative-space'],
      depthBands: ['ink', 'paper-cut'],
    },
  },
  {
    id: 'radial-eye-gates',
    label: 'Radial eye gates',
    family: 'radial-gate',
    aliases: ['eye', 'mangekyou', 'radial eye', 'iris gates', 'tomoe gates'],
    topology: { axes: 3, handedness: 'curved', cells: 'iris-blades' },
    intents: ['focus-and-orbit', 'sequencing', 'depth-staging'],
    reasoningUse: [
      'place focal objects around a protected center',
      'create three or more gated lanes that curve around an origin',
      'model attention, turn order, or staged reveals without committing pixels',
    ],
    boundaryContract: {
      slots: ['iris-center', 'gate-a', 'gate-b', 'gate-c', 'outer-ring'],
      collisionGroups: ['iris-gate', 'center-lock', 'outer-ring'],
      depthBands: ['focal-center', 'gate-lane', 'outer-orbit'],
    },
  },
  {
    id: 'four-square-grid',
    label: 'Four square grid',
    family: 'quadrant-grid',
    aliases: ['four square', 'app grid', 'four box app', 'quadrants', '2x2'],
    topology: { axes: 2, handedness: 'none', cells: 'quadrants' },
    intents: ['partitioning'],
    reasoningUse: [
      'divide independent concerns into four equal panels or slots',
      'reserve a center gutter as collision space',
      'map UI/app-like structures into stable top-left/top-right/bottom-left/bottom-right roles',
    ],
    boundaryContract: {
      slots: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center-gutter'],
      collisionGroups: ['quadrant-cell', 'gutter'],
      depthBands: ['same-plane'],
    },
  },
  {
    id: 'constellation-chain',
    label: 'Constellation chain',
    family: 'node-edge-map',
    aliases: ['constellation', 'chain', 'node chain', 'route map'],
    topology: { axes: 'path', handedness: 'none', cells: 'nodes-and-edges' },
    intents: ['sequencing', 'support-staging'],
    reasoningUse: [
      'place objects as linked stations before choosing visible geometry',
      'route dependencies around occupied regions',
      'carry support, parent, and depth relationships through a sparse graph',
    ],
    boundaryContract: {
      slots: ['node', 'edge', 'junction', 'reserved-channel'],
      collisionGroups: ['node-body', 'edge-channel'],
      depthBands: ['ordered-by-edge'],
    },
  },
  {
    id: 'nested-rings',
    label: 'Nested rings',
    family: 'radial-depth',
    aliases: ['rings', 'target', 'orbit', 'concentric'],
    topology: { axes: 'radial', handedness: 'none', cells: 'annular-bands' },
    intents: ['depth-staging', 'focus-and-orbit', 'containment'],
    reasoningUse: [
      'stage objects by distance from a center',
      'reserve inner rings for primary objects and outer rings for context',
      'keep circular or spherical forms from collapsing into one another',
    ],
    boundaryContract: {
      slots: ['core', 'inner-ring', 'middle-ring', 'outer-ring'],
      collisionGroups: ['ring-band', 'core'],
      depthBands: ['core', 'inner', 'middle', 'outer'],
    },
  },
  {
    id: 'axis-spine',
    label: 'Axis spine',
    family: 'linear-directional',
    aliases: ['spine', 'street spine', 'procession', 'parade route', 'timeline', 'directed axis'],
    topology: { axes: 1, handedness: 'directed', cells: 'ordered-stations-along-axis' },
    intents: ['sequencing', 'progression', 'support-staging'],
    reasoningUse: [
      'lay ordered stations along one directed axis (street, parade, timeline)',
      'reserve left/right parcel bands flanking the spine for attached content',
      'mark a start-of-axis and end-of-axis terminator so progression has direction',
    ],
    boundaryContract: {
      slots: ['axis-origin', 'axis-terminator', 'spine', 'left-band', 'right-band', 'station-0', 'station-1', 'station-2'],
      collisionGroups: ['spine-channel', 'station-body', 'flank-band'],
      depthBands: ['near-origin', 'midspine', 'near-terminator'],
    },
  },
  {
    id: 'cross-section-stack',
    label: 'Cross-section stack',
    family: 'linear-directional',
    aliases: ['cross section', 'strata', 'horizon stack', 'layer cake', 'geological section', 'atmospheric layers'],
    topology: { axes: 1, handedness: 'vertical', cells: 'horizontal-bands' },
    intents: ['depth-staging', 'partitioning', 'sequencing'],
    reasoningUse: [
      'stack horizontal bands top-to-bottom for strata, horizons, or vertical priority',
      'preserve interface lines between bands as first-class slots (skyline, horizon, soil-line)',
      'attach band-specific detail without bleeding across band interfaces',
    ],
    boundaryContract: {
      slots: ['band-0', 'band-1', 'band-2', 'band-3', 'interface-0-1', 'interface-1-2', 'interface-2-3'],
      collisionGroups: ['band-body', 'interface-line'],
      depthBands: ['top-band', 'middle-bands', 'bottom-band'],
    },
  },
  {
    id: 'meander-path',
    label: 'Meander path',
    family: 'linear-directional',
    aliases: ['meander', 'switchback', 'river bend', 'garden walk', 'serpentine'],
    topology: { axes: 1, handedness: 'alternating', cells: 'alternating-side-pockets-along-curve' },
    intents: ['sequencing', 'progression', 'bilateral'],
    reasoningUse: [
      'guide a curving directed path that turns left, right, left along its length',
      'reserve alternating outer-bend pockets for attached scenery or signage',
      'preserve the directed flow so progression still reads start to end despite the curves',
    ],
    boundaryContract: {
      slots: ['path-origin', 'path-terminator', 'meander-curve', 'left-pocket', 'right-pocket', 'inner-bend', 'outer-bend'],
      collisionGroups: ['path-channel', 'bend-pocket'],
      depthBands: ['near-origin', 'midpath', 'near-terminator'],
    },
  },
  {
    id: 'nested-frames',
    label: 'Nested frames',
    family: 'rectilinear-containment',
    aliases: ['matryoshka', 'frame-within-frame', 'picture-in-picture', 'russian doll', 'recursive frames'],
    topology: { axes: 2, handedness: 'none', cells: 'concentric-rectangles' },
    intents: ['containment', 'depth-staging'],
    reasoningUse: [
      'nest rectangular interiors so each level fully contains the next',
      'reserve the innermost frame for the primary subject and outer frames for context',
      'use frame thickness as a depth/priority signal distinct from circular nesting',
    ],
    boundaryContract: {
      slots: ['outermost-frame', 'middle-frame', 'innermost-frame', 'frame-gap-outer', 'frame-gap-inner', 'core-interior'],
      collisionGroups: ['frame-edge', 'frame-gap', 'core-interior'],
      depthBands: ['outermost', 'middle', 'innermost'],
    },
  },
  {
    id: 'courtyard-enclosure',
    label: 'Courtyard enclosure',
    family: 'rectilinear-containment',
    aliases: ['courtyard', 'atrium', 'cloister', 'food court', 'enclosed plaza'],
    topology: { axes: 2, handedness: 'none', cells: 'outer-ring-and-interior-void' },
    intents: ['containment', 'enclosure', 'focus-and-orbit', 'negative-space'],
    reasoningUse: [
      'build a bounded outer ring around a deliberately open interior void',
      'treat the interior void as a first-class focal slot, not leftover space',
      'orient inward-facing detail along the inner edge of the enclosing ring',
    ],
    boundaryContract: {
      slots: ['outer-perimeter', 'enclosing-ring', 'inward-facade', 'interior-void', 'entry-gate'],
      collisionGroups: ['ring-body', 'inward-facade', 'void-floor'],
      depthBands: ['perimeter', 'inward-facade', 'court-floor'],
    },
  },
  {
    id: 'dendrite-branch',
    label: 'Dendrite branch',
    family: 'recursive-branching',
    aliases: ['dendrite', 'tree', 'river delta', 'vascular', 'root system', 'family tree'],
    topology: { axes: 'recursive', handedness: 'none', cells: 'root-trunk-branches-twigs' },
    intents: ['branching', 'support-staging', 'depth-staging'],
    reasoningUse: [
      'split from a single root into recursive child branches at decreasing scale',
      'preserve parent-to-child support so children inherit position from their parent branch',
      'stage depth by branch generation: root nearest, leaf-tips farthest',
    ],
    boundaryContract: {
      slots: ['root', 'trunk', 'primary-branch', 'secondary-branch', 'twig', 'leaf-tip'],
      collisionGroups: ['branch-body', 'inter-branch-gap', 'leaf-cluster'],
      depthBands: ['root-generation', 'mid-generation', 'tip-generation'],
    },
  },
  {
    id: 'bifurcation-fork',
    label: 'Bifurcation fork',
    family: 'recursive-branching',
    aliases: ['fork', 'y-fork', 'binary split', 'decision point', 'confluence'],
    topology: { axes: 2, handedness: 'mirrored', cells: 'stem-and-two-prongs' },
    intents: ['branching', 'sequencing', 'bilateral'],
    reasoningUse: [
      'split one stem into exactly two prongs at a single decision point',
      'preserve the symmetry axis between prongs so the fork reads as a choice, not noise',
      'use as a simpler atom than full dendrites when only one binary split matters',
    ],
    boundaryContract: {
      slots: ['stem', 'fork-junction', 'prong-left', 'prong-right', 'wedge-interior'],
      collisionGroups: ['stem-channel', 'prong-channel', 'wedge-interior'],
      depthBands: ['pre-fork', 'post-fork'],
    },
  },
  {
    id: 'hex-tessellation',
    label: 'Hex tessellation',
    family: 'region-tiling',
    aliases: ['hex tile', 'honeycomb', 'hex map', 'hexagonal tiling'],
    topology: { axes: 6, handedness: 'none', cells: 'hexagons-edge-to-edge' },
    intents: ['tiling', 'partitioning'],
    reasoningUse: [
      'cover a bounded region with hexagonal cells that share edges, never corners',
      'snap discrete units (game tiles, cells, modular plots) to deterministic neighbors',
      'distinguish region-fill tiling from single-center radial symmetry',
    ],
    boundaryContract: {
      slots: ['hex-cell', 'shared-edge', 'cell-center', 'region-boundary'],
      collisionGroups: ['hex-cell', 'shared-edge'],
      depthBands: ['same-plane'],
    },
  },
  {
    id: 'brick-stagger',
    label: 'Brick stagger',
    family: 'region-tiling',
    aliases: ['brickwork', 'masonry', 'herringbone', 'running bond', 'offset tile'],
    topology: { axes: 2, handedness: 'selectable', cells: 'offset-rectangular-tiles' },
    intents: ['tiling', 'partitioning', 'bilateral'],
    reasoningUse: [
      'cover a bounded region with rectangular tiles whose rows offset against each other',
      'choose half-offset for running bond or 90-degree rotation for herringbone',
      'preserve the stagger axis so seams never align across two adjacent rows',
    ],
    boundaryContract: {
      slots: ['tile', 'row-seam', 'column-seam', 'stagger-offset', 'region-boundary'],
      collisionGroups: ['tile-body', 'row-seam', 'column-seam'],
      depthBands: ['same-plane'],
    },
  },
  {
    id: 'mirror-axis',
    label: 'Mirror axis',
    family: 'bilateral-symmetry',
    aliases: ['mirror', 'bookmatch', 'butterfly', 'bilateral', 'face symmetry'],
    topology: { axes: 1, handedness: 'mirrored', cells: 'left-half-and-right-half' },
    intents: ['bilateral'],
    reasoningUse: [
      'reflect every left-side slot to a right-side counterpart across one axis',
      'reserve the axis itself as a first-class slot for centered features (nose, keystone, mast)',
      'use when single-axis symmetry matters but radial/rotational symmetry does not',
    ],
    boundaryContract: {
      slots: ['mirror-axis', 'left-half', 'right-half', 'axis-feature', 'left-mirror-pair', 'right-mirror-pair'],
      collisionGroups: ['axis-feature', 'half-body', 'mirror-pair'],
      depthBands: ['same-plane'],
    },
  },
];

const MANDALA_PATTERN_BY_ID = new Map(MANDALA_PATTERN_LIBRARY.map((pattern) => [pattern.id, pattern]));
const MANDALA_PATTERN_ALIAS = new Map();

for (const pattern of MANDALA_PATTERN_LIBRARY) {
  MANDALA_PATTERN_ALIAS.set(normalizePatternKey(pattern.id), pattern.id);
  MANDALA_PATTERN_ALIAS.set(normalizePatternKey(pattern.label), pattern.id);
  for (const alias of pattern.aliases || []) {
    MANDALA_PATTERN_ALIAS.set(normalizePatternKey(alias), pattern.id);
  }
}

const BLOCK_LAYOUT_LIBRARY = [
  {
    id: 'metropolis-grid',
    label: 'Metropolis grid',
    aliases: ['big city', 'downtown grid', 'city grid', 'urban grid', 'metropolis'],
    scale: 'large-city',
    seeds: ['axis-spine', 'four-square-grid', 'brick-stagger'],
    topology: { streets: 'orthogonal-grid', parcels: 'dense-rectangular-blocks', landmarks: 'corner-and-avenue-nodes' },
    variationKnobs: ['avenueSpacing', 'blockDepth', 'cornerDensity', 'setbackRhythm'],
    layoutContract: {
      spines: ['primary-avenue', 'cross-street'],
      parcelBands: ['left-frontage', 'right-frontage', 'background-frontage'],
      anchors: ['near-corner', 'opposite-corner', 'terminator-block'],
      collisionGroups: ['street-reserve', 'parcel-block', 'sidewalk-band'],
    },
  },
  {
    id: 'small-town-main-street',
    label: 'Small town main street',
    aliases: ['small town', 'main street', 'village street', 'town center', 'high street'],
    scale: 'small-town',
    seeds: ['axis-spine', 'seal-grid', 'nested-frames'],
    topology: { streets: 'single-main-spine', parcels: 'shallow-shopfronts', landmarks: 'porch-sign-civic-node' },
    variationKnobs: ['storefrontWidth', 'porchDepth', 'signRhythm', 'civicSetback'],
    layoutContract: {
      spines: ['main-street'],
      parcelBands: ['left-shopfronts', 'right-shopfronts'],
      anchors: ['foreground-porch', 'midblock-shop', 'civic-background'],
      collisionGroups: ['street-reserve', 'shop-parcel', 'porch-overhang'],
    },
  },
  {
    id: 'old-town-meander',
    label: 'Old town meander',
    aliases: ['old town', 'medieval street', 'curved lane', 'winding street', 'market lane'],
    scale: 'historic-district',
    seeds: ['meander-path', 'courtyard-enclosure', 'nested-frames'],
    topology: { streets: 'curving-spine', parcels: 'irregular-frontages', landmarks: 'gate-courtyard-market-node' },
    variationKnobs: ['bendAmount', 'frontageIrregularity', 'pocketAlternation', 'gateFrequency'],
    layoutContract: {
      spines: ['meander-lane'],
      parcelBands: ['outer-bend-pockets', 'inner-bend-pockets'],
      anchors: ['bend-corner', 'market-pocket', 'terminator-gate'],
      collisionGroups: ['lane-reserve', 'irregular-parcel', 'courtyard-void'],
    },
  },
  {
    id: 'suburban-culdesac',
    label: 'Suburban cul-de-sac',
    aliases: ['suburb', 'cul de sac', 'culdesac', 'residential loop', 'subdivision'],
    scale: 'suburban',
    seeds: ['nested-rings', 'axis-spine', 'mirror-axis'],
    topology: { streets: 'stem-and-loop', parcels: 'radial-lots', landmarks: 'turnaround-center' },
    variationKnobs: ['loopRadius', 'lotFan', 'drivewaySpacing', 'centerIsland'],
    layoutContract: {
      spines: ['entry-stem', 'turnaround-loop'],
      parcelBands: ['left-lots', 'right-lots', 'loop-lots'],
      anchors: ['loop-center', 'near-driveway', 'far-house'],
      collisionGroups: ['road-loop', 'lot-parcel', 'yard-buffer'],
    },
  },
  {
    id: 'industrial-spine',
    label: 'Industrial spine',
    aliases: ['industrial district', 'warehouse street', 'loading dock road', 'factory row'],
    scale: 'industrial',
    seeds: ['axis-spine', 'cross-section-stack', 'brick-stagger'],
    topology: { streets: 'service-spine', parcels: 'deep-warehouse-bays', landmarks: 'loading-dock-nodes' },
    variationKnobs: ['dockRhythm', 'bayDepth', 'serviceLaneWidth', 'yardBuffer'],
    layoutContract: {
      spines: ['service-road', 'loading-lane'],
      parcelBands: ['warehouse-bays', 'yard-buffer', 'utility-edge'],
      anchors: ['loading-dock', 'gatehouse', 'terminator-warehouse'],
      collisionGroups: ['service-reserve', 'dock-parcel', 'yard-buffer'],
    },
  },
];

const BLOCK_LAYOUT_BY_ID = new Map(BLOCK_LAYOUT_LIBRARY.map((layout) => [layout.id, layout]));
const BLOCK_LAYOUT_ALIAS = new Map();

for (const layout of BLOCK_LAYOUT_LIBRARY) {
  BLOCK_LAYOUT_ALIAS.set(normalizePatternKey(layout.id), layout.id);
  BLOCK_LAYOUT_ALIAS.set(normalizePatternKey(layout.label), layout.id);
  for (const alias of layout.aliases || []) {
    BLOCK_LAYOUT_ALIAS.set(normalizePatternKey(alias), layout.id);
  }
}

const SHOT_GLYPH_LIBRARY = [
  {
    id: 'person-eye-room-window-light',
    label: 'Person-eye room, window key light',
    aliases: ['person eye room', 'bedroom window shot', 'room window light', 'straight doorway room shot'],
    family: 'interior-shot-glyph',
    topology: {
      cameraVector: 'doorway-straight-eye',
      lightEntry: 'back-right-wall-window',
      support: 'floor-depth',
    },
    cameraPrimitive: {
      kind: 'two-point',
      anchor: 'person-eye-camera',
      canonicalAngle: 'doorway-straight-room',
      constraint: 'person-eye-full-room',
      horizonY: 245,
      vanishingPoints: {
        left: [-260, 245],
        right: [1220, 245],
      },
      verticalAxis: [0, -1],
      cropBox: { x: 240, y: 120, width: 500, height: 430 },
      showFullMandala: false,
      keepWorldStable: true,
      roomBasis: { verticalUnit: 24 },
      cameraPoint: {
        kind: 'doorway-straight-eye',
        doorWall: 'front',
        doorCenter: [0, 8, 5.6],
        lookAt: [0, -7, 3.2],
      },
      straightFrame: {
        backWall: { left: 360, right: 620, top: 180, bottom: 360 },
        floorFront: { left: [160, 585], right: [820, 585] },
        ceilingFront: { left: [220, 90], right: [760, 90] },
      },
    },
    cameraWindow: {
      origin: [0, 0, 0],
      terminatorVectors: {
        left: [-0.62, -1, 0],
        right: [0.62, -1, 0],
      },
      depthSteps: 5,
      laneSteps: 5,
      length: 1,
      fitRule: 'full room envelope and required pins must fit between the person-eye terminators',
    },
    roomConcept: {
      kind: 'interior-room',
      localSpace: 'cca-local-space',
      normalization: 'project-after-planning',
      camera: {
        mode: 'predetermined-vector',
        primitive: 'two-point-straight-doorway',
        subjectFraming: 'full-frame-room',
      },
      placementSpace: {
        gravityAxis: 'camera-floor-depth',
        supportPlane: 'room:floor-plane',
        fullFrameBounds: 'room-envelope',
      },
    },
    lightSources: [
      {
        role: 'window-key-light',
        kind: 'directional',
        angleDegrees: -126,
        spreadDegrees: 24,
        intensity: 1.1,
        z: 0.72,
      },
    ],
    boundaryContract: {
      slots: ['eye-point', 'room-envelope', 'floor-support', 'window-light-entry', 'subject-pin'],
      collisionGroups: ['view-wedge', 'floor-objects', 'wall-openings'],
      depthBands: ['near-floor', 'mid-room', 'back-wall'],
    },
  },
  {
    id: 'tabletop-three-quarter-key',
    label: 'Tabletop three-quarter key light',
    aliases: ['tabletop shot', 'three quarter tabletop', 'object on table shot'],
    family: 'object-shot-glyph',
    topology: {
      cameraVector: 'three-quarter-down',
      lightEntry: 'upper-left-key',
      support: 'tabletop-plane',
    },
    cameraWindow: {
      origin: [0, 0, 0],
      terminatorVectors: {
        left: [-0.75, -1, 0],
        right: [0.75, -1, 0],
      },
      depthSteps: 4,
      laneSteps: 4,
      fitRule: 'tabletop subject and support rail must fit inside a shallow shot wedge',
    },
    scene: {
      perspective: {
        mode: 'one-point',
        vanishingPoint: [180, 92],
      },
      view: { direction: [-0.35, -0.25], baseZ: 10 },
    },
    lightSources: [
      {
        role: 'upper-left-key',
        kind: 'directional',
        angleDegrees: -132,
        spreadDegrees: 18,
        intensity: 1,
        z: 0.72,
      },
    ],
    boundaryContract: {
      slots: ['support-rail', 'subject-base', 'cast-shadow-receiver'],
      collisionGroups: ['support-volume', 'subject-volume', 'receiver-shadow'],
      depthBands: ['support', 'subject', 'shadow'],
    },
  },
  {
    id: 'corner-eye-room-diagonal-window-light',
    label: 'Corner-eye room, diagonal window light',
    aliases: ['corner room shot', 'diagonal room shot', 'corner eye bedroom', 'three quarter room window light'],
    family: 'interior-shot-glyph',
    topology: {
      cameraVector: 'corner-eye-diagonal',
      lightEntry: 'side-wall-window',
      support: 'floor-depth',
    },
    cameraPrimitive: {
      kind: 'two-point',
      anchor: 'corner-eye-camera',
      canonicalAngle: 'adult-eye-room-3q',
      constraint: 'corner-eye-full-room',
      horizonY: 245,
      vanishingPoints: {
        left: [-220, 245],
        right: [1180, 245],
      },
      verticalAxis: [0, -1],
      cropBox: { x: 120, y: 60, width: 760, height: 500 },
      showFullMandala: false,
      keepWorldStable: true,
      roomBasis: { verticalUnit: 22 },
      cameraPoint: {
        kind: 'corner-eye',
        doorWall: 'front-left',
        doorCenter: [-14, 8, 5.6],
        lookAt: [1, -10, 3.3],
      },
    },
    cameraWindow: {
      origin: [0, 0, 0],
      terminatorVectors: {
        left: [-0.84, -1, 0],
        right: [0.48, -1, 0],
      },
      depthSteps: 6,
      laneSteps: 5,
      length: 1,
      fitRule: 'diagonal room envelope must fit inside an asymmetric corner-eye wedge',
    },
    roomConcept: {
      kind: 'interior-room',
      localSpace: 'cca-local-space',
      normalization: 'project-after-planning',
      camera: {
        mode: 'predetermined-vector',
        primitive: 'two-point-corner-eye',
        subjectFraming: 'diagonal-room-profile',
      },
      placementSpace: {
        gravityAxis: 'camera-floor-depth',
        supportPlane: 'room:floor-plane',
        fullFrameBounds: 'room-envelope',
      },
    },
    lightSources: [
      {
        role: 'side-window-key-light',
        kind: 'directional',
        angleDegrees: -38,
        spreadDegrees: 32,
        intensity: 1.05,
        z: 0.74,
      },
    ],
    boundaryContract: {
      slots: ['corner-eye-point', 'diagonal-room-envelope', 'floor-support', 'side-window-light-entry', 'subject-pin'],
      collisionGroups: ['asymmetric-view-wedge', 'floor-objects', 'side-wall-openings'],
      depthBands: ['near-corner', 'mid-room', 'far-wall'],
    },
  },
  {
    id: 'person-eye-street-block-light',
    label: 'Person-eye street block, curb-back parcel light',
    aliases: ['person eye street', 'street eye city block', 'avenue eye shot', 'city street shot', 'curb back street shot'],
    family: 'exterior-shot-glyph',
    topology: {
      cameraVector: 'street-eye-bounded-horizon',
      lightEntry: 'upper-left-street-key',
      support: 'vision-pane-street-floor',
    },
    cameraPrimitive: {
      kind: 'two-point',
      anchor: 'person-eye-camera',
      canonicalAngle: 'person-eye-street-block',
      constraint: 'street-visible-slice',
      horizonY: 150,
      vanishingPoints: {
        left: [-360, 150],
        right: [1040, 150],
      },
      verticalAxis: [0, -1],
      cropBox: { x: 120, y: 70, width: 640, height: 390 },
      showFullMandala: false,
      keepWorldStable: true,
      cameraPoint: {
        kind: 'person-eye-street',
        streetCenter: [0, 0, 5.7],
        lookAt: [0, -20, 3.2],
      },
    },
    cameraWindow: {
      origin: [0, 0, 0],
      terminatorVectors: {
        left: [-0.72, -1, 0],
        right: [0.72, -1, 0],
      },
      depthSteps: 6,
      laneSteps: 5,
      length: 1,
      fitRule: 'visible street slice, curb-back parcels, facades, and horizon terminator must fit between person-eye street terminators',
    },
    visionPane: {
      mode: 'road',
      nearEdge: {
        left: [170, 570],
        right: [790, 570],
      },
      horizonBoundary: {
        y: 150,
        leftX: 360,
        rightX: 600,
      },
      features: {
        curbs: true,
        centerline: true,
        depthRows: 6,
      },
    },
    placementSpace: {
      gravityAxis: 'camera-street-depth',
      supportPlane: 'visionPane:street-floor',
      parcelBands: ['left-curb-back-parcels', 'right-curb-back-parcels'],
      buildingBaseRails: ['left-building-base-rail', 'right-building-base-rail'],
      rule: 'building bases land on curb-back parcel rails derived from the same visionPane basis as the street floor',
    },
    lightSources: [
      {
        role: 'street-key-light',
        kind: 'directional',
        angleDegrees: -118,
        spreadDegrees: 28,
        intensity: 1,
        z: 0.74,
      },
    ],
    boundaryContract: {
      slots: ['eye-point', 'street-floor-support', 'left-curb-back-parcel', 'right-curb-back-parcel', 'horizon-boundary', 'facade-face-region'],
      collisionGroups: ['street-reserve', 'sidewalk-band', 'parcel-block', 'facade-skins'],
      depthBands: ['foreground-street', 'mid-parcels', 'horizon-block'],
    },
  },
  {
    id: 'overhead-plan-soft-light',
    label: 'Overhead plan, soft light',
    aliases: ['top down shot', 'overhead plan', 'flat lay'],
    family: 'plan-shot-glyph',
    topology: {
      cameraVector: 'top-down',
      lightEntry: 'soft-north-west',
      support: 'single-plane',
    },
    cameraWindow: {
      origin: [0, 0, 0],
      terminatorVectors: {
        left: [-1, -1, 0],
        right: [1, -1, 0],
      },
      depthSteps: 3,
      laneSteps: 3,
      fitRule: 'top-down composition fits a symmetric planning wedge before projection',
    },
    scene: {
      perspective: {
        mode: 'orthographic-plan',
      },
      view: { direction: [0, 0], baseZ: 10 },
    },
    lightSources: [
      {
        role: 'soft-north-west',
        kind: 'directional',
        angleDegrees: -135,
        spreadDegrees: 45,
        intensity: 0.75,
        z: 0.9,
      },
    ],
    boundaryContract: {
      slots: ['plan-envelope', 'subject-footprint', 'support-plane'],
      collisionGroups: ['footprint', 'clearance'],
      depthBands: ['same-plane'],
    },
  },
  {
    id: 'school-of-athens-central-hall',
    label: 'School of Athens central hall',
    aliases: ['school of athens', 'central hall one point', 'raphael hall', 'one point civic hall', 'axis mundi hall'],
    family: 'civic-interior-shot-glyph',
    topology: {
      cameraVector: 'central-one-point',
      vanishingHub: 'axis-mundi-center',
      lightEntry: 'high-side-ambient',
      support: 'floor-depth-grid',
      staging: 'symmetrical-depth-bands',
    },
    scene: {
      perspective: {
        mode: 'one-point',
        horizonY: 220,
        vanishingPoint: [490, 220],
        depthScale: 320,
      },
      view: { direction: [0, -1], baseZ: 10 },
    },
    cameraWindow: {
      origin: [0, 0, 0],
      terminatorVectors: {
        left: [-0.9, -1, 0],
        right: [0.9, -1, 0],
      },
      screenOrigin: [490, 570],
      unitScale: 170,
      depthSteps: 7,
      laneSteps: 6,
      length: 1,
      fitRule: 'central hall subjects stage symmetrically inside the one-point axis-mundi wedge',
    },
    hallMandala: {
      kind: 'central-one-point-civic-hall',
      vanishingHub: [490, 220],
      horizonY: 220,
      axisMundi: {
        role: 'central-asterisk',
        screen: [490, 220],
        meaning: 'single vanishing hub, horizon anchor, architectural axis, and staging organizer',
      },
      slots: [
        'central-thesis',
        'left-cluster',
        'right-cluster',
        'foreground-left',
        'foreground-right',
        'back-arch',
        'floor-axis',
      ],
      depthBands: ['foreground-steps', 'mid-figures', 'back-arch'],
      symmetry: 'bilateral-around-axis-mundi',
      architecture: ['barrel-vault', 'side-arches', 'central-aperture', 'floor-grid'],
    },
    meru: {
      basis: 'central-hall-meru',
      aliasFor: 'metamandala',
      surfaces: [
        {
          role: 'hall-floor-meru',
          kind: 'axisFloor',
          origin: [490, 520],
          xAxis: [[170, 520], [810, 520]],
          yAxis: [[490, 520], [490, 220]],
          supportRail: 'central-nave-floor',
          debugLaser: false,
        },
      ],
      lightSources: [
        {
          role: 'high-side-ambient',
          kind: 'directional',
          angleDegrees: -118,
          spreadDegrees: 42,
          intensity: 0.9,
          z: 0.8,
        },
      ],
    },
    boundaryContract: {
      slots: ['axis-mundi-hub', 'central-nave', 'left-aisle', 'right-aisle', 'foreground-steps', 'mid-figure-band', 'back-arch-aperture'],
      collisionGroups: ['nave-axis', 'figure-cluster', 'architecture-rib', 'floor-grid'],
      depthBands: ['foreground-steps', 'mid-figures', 'back-arch'],
    },
    // Manji-program shape (3D). Slot ids match boundaryContract.slots so the
    // semantic vocabulary stays consistent — the same names route in both
    // contexts. Walked via walkManjiTree3D and projected through the existing
    // two-point perspective camera (`projectTwoPoint`); see
    // lite-template/integration/0604/polygonizer-manji-tree.plan.md.
    manjiProgram: {
      spine: {
        bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' }, lengthScale: 0.4 },
        bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' }, lengthScale: 0.4 },
        bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'open' }, lengthScale: 0.4 },
      },
      slots: [
        // Central vertical anchor — the axis-mundi the shot glyph builds around.
        { id: 'axis-mundi-hub',     position: { x:  0,  y: -12, z:  0  } },
        // Floor-level depth bands.
        { id: 'foreground-steps',   position: { x:  0,  y:   2, z: -2.5 } },
        { id: 'mid-figure-band',    position: { x:  0,  y: -10, z: -2.5 } },
        { id: 'central-nave',       position: { x:  0,  y: -10, z: -2.5 } },
        // Side aisles — left/right at floor level, anchoring side architecture.
        { id: 'left-aisle',         position: { x: -10, y: -12, z: -2.5 } },
        { id: 'right-aisle',        position: { x:  10, y: -12, z: -2.5 } },
        // Back-arch aperture — the receding terminus the camera looks into.
        { id: 'back-arch-aperture', position: { x:  0,  y: -22, z:  1  } },
      ],
    },
  },
  {
    id: 'wide-landscape-horizon-sweep',
    label: 'Wide landscape horizon sweep',
    aliases: ['landscape shot', 'wide landscape', 'horizon landscape', 'panoramic landscape'],
    family: 'landscape-shot-glyph',
    topology: {
      cameraVector: 'wide-horizon-sweep',
      vanishingHub: 'soft-horizon-axis',
      lightEntry: 'low-side-sun',
      support: 'terrain-depth-bands',
      staging: 'foreground-midground-background',
    },
    scene: {
      perspective: {
        mode: 'one-point',
        horizonY: 210,
        vanishingPoint: [490, 210],
        depthScale: 360,
      },
      view: { direction: [0, -1], baseZ: 8 },
    },
    cameraWindow: {
      origin: [0, 0, 0],
      terminatorVectors: {
        left: [-1.15, -1, 0],
        right: [1.15, -1, 0],
      },
      screenOrigin: [490, 560],
      unitScale: 190,
      depthSteps: 6,
      laneSteps: 8,
      length: 1,
      fitRule: 'landscape terrain bands, horizon, and focal forms stage inside a wide symmetric view wedge',
    },
    hallMandala: {
      kind: 'wide-landscape-mandala',
      vanishingHub: [490, 210],
      horizonY: 210,
      axisMundi: {
        role: 'soft-horizon-axis',
        screen: [490, 210],
        meaning: 'soft vanishing hub and horizon organizer for terrain bands',
      },
      slots: ['foreground-bank', 'midground-field', 'left-mass', 'right-mass', 'distant-horizon', 'sky-vault'],
      depthBands: ['foreground-land', 'midground-land', 'horizon-sky'],
      symmetry: 'loose-landscape-balance',
      architecture: ['terrain-bands', 'horizon-line', 'sky-vault'],
    },
    meru: {
      basis: 'landscape-meru',
      aliasFor: 'metamandala',
      surfaces: [
        {
          role: 'terrain-floor-meru',
          kind: 'axisFloor',
          origin: [490, 540],
          xAxis: [[80, 540], [900, 540]],
          yAxis: [[490, 540], [490, 210]],
          supportRail: 'foreground-terrain',
          debugLaser: false,
        },
      ],
      lightSources: [
        {
          role: 'low-side-sun',
          kind: 'directional',
          angleDegrees: -142,
          spreadDegrees: 36,
          intensity: 0.95,
          z: 0.68,
        },
      ],
    },
    boundaryContract: {
      slots: ['foreground-bank', 'midground-field', 'left-mass', 'right-mass', 'distant-horizon', 'sky-vault'],
      collisionGroups: ['terrain-band', 'focal-landmark', 'sky-negative-space'],
      depthBands: ['foreground-land', 'midground-land', 'horizon-sky'],
    },
  },
  {
    id: 'driver-eye-road-cockpit',
    label: 'Driver-eye road cockpit',
    aliases: ['first person vehicle', 'driver pov', 'vehicle pov', 'windshield road shot', 'cockpit road shot'],
    family: 'first-person-vehicle-shot-glyph',
    topology: {
      cameraVector: 'driver-eye-forward',
      vanishingHub: 'road-center-vanishing-point',
      lightEntry: 'windshield-forward-light',
      support: 'road-lane-depth',
      staging: 'dashboard-foreground-road-depth',
    },
    scene: {
      perspective: {
        mode: 'one-point',
        horizonY: 185,
        vanishingPoint: [490, 185],
        depthScale: 340,
      },
      view: { direction: [0, -1], baseZ: 12 },
    },
    cameraWindow: {
      origin: [0, 0, 0],
      terminatorVectors: {
        left: [-0.78, -1, 0],
        right: [0.78, -1, 0],
      },
      screenOrigin: [490, 560],
      unitScale: 180,
      depthSteps: 7,
      laneSteps: 5,
      length: 1,
      fitRule: 'windshield frame, road lane, horizon, dashboard, and focal route fit inside a driver-eye wedge',
    },
    hallMandala: {
      kind: 'driver-eye-road-mandala',
      vanishingHub: [490, 185],
      horizonY: 185,
      axisMundi: {
        role: 'road-center-hub',
        screen: [490, 185],
        meaning: 'single road vanishing hub through windshield center',
      },
      slots: ['dashboard-foreground', 'windshield-frame', 'road-lane', 'left-roadside', 'right-roadside', 'horizon-route'],
      depthBands: ['dashboard', 'near-road', 'horizon-road'],
      symmetry: 'vehicle-centered-forward-axis',
      architecture: ['windshield-frame', 'dashboard-band', 'road-lane-grid'],
    },
    meru: {
      basis: 'driver-road-meru',
      aliasFor: 'metamandala',
      surfaces: [
        {
          role: 'road-floor-meru',
          kind: 'axisFloor',
          origin: [490, 560],
          xAxis: [[210, 560], [770, 560]],
          yAxis: [[490, 560], [490, 185]],
          supportRail: 'road-lane',
          debugLaser: false,
        },
      ],
      lightSources: [
        {
          role: 'windshield-forward-light',
          kind: 'directional',
          angleDegrees: -96,
          spreadDegrees: 26,
          intensity: 0.85,
          z: 0.72,
        },
      ],
    },
    boundaryContract: {
      slots: ['dashboard-foreground', 'windshield-frame', 'road-lane', 'left-roadside', 'right-roadside', 'horizon-route'],
      collisionGroups: ['cockpit-frame', 'road-reserve', 'roadside-forms'],
      depthBands: ['dashboard', 'near-road', 'horizon-road'],
    },
  },
  // ── Wave 1 manji-program library expansion (2026-06-05) ────────────────
  // 8 manji-program-bearing cards across 5 axes (camera shot, classical
  // composition, architecture, figure, still-life). Minimal cards: no
  // scene/cameraWindow/hallMandala/meru fields — the manji-tree IR doesn't
  // need them. See lite-template/integration/0605/manji-program-library-expansion.plan.md.
  //
  // Wave 2 sub-wave 2.1 (2026-06-05) migrated the 4 camera-shot entries
  // (wide-shot-landscape, medium-shot-figure, close-up-face,
  // over-the-shoulder-two-figure) to the markdown shelf at
  // control/lib/graph/manji-programs/, alongside a new low-angle-hero
  // card. The shelf entries carry rich prose bodies for semantic_search
  // discoverability; the geometry is preserved verbatim from the in-code
  // entries below. The resolver falls through from shot-glyph to shelf
  // so by-name authoring works unchanged. See
  // lite-template/integration/0605/polygonizer-capability-additions.plan.md.
  {
    id: 'triangular-figure-stack',
    label: 'Triangular figure stack',
    aliases: ['triangular composition', 'three figure pyramid', 'classical triad', 'pyramidal arrangement', 'triangle stack'],
    family: 'classical-composition',
    topology: {
      cameraVector: 'eye-level-frontal',
      staging: 'pyramidal',
      reach: 'three-figure-group',
    },
    intents: ['symmetry', 'figure-grouping', 'classical-balance'],
    reasoningUse: [
      'compose three figures with the apex elevated for classical stability',
      'Renaissance triadic figure grouping (Madonna and saints, philosophers)',
      'stable pyramidal arrangement that draws the eye to the apex',
    ],
    boundaryContract: {
      slots: ['apex', 'left-base', 'right-base', 'triangle-center'],
      collisionGroups: ['apex-figure', 'base-figures', 'shared-ground'],
      depthBands: ['apex-near', 'base-band'],
    },
    manjiProgram: {
      spine: {
        bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' }, lengthScale: 0.4 },
        bar2: { axis: 'E-W', tails: { W: 'closed', E: 'closed' }, lengthScale: 0.3 },
        bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'open', Nadir: 'open' }, lengthScale: 0.4 },
      },
      slots: [
        { id: 'apex',            position: { x:  0,    y: -12, z:  3 } },
        { id: 'left-base',       position: { x: -3,    y: -10, z:  1.5 } },
        { id: 'right-base',      position: { x:  3,    y: -10, z:  1.5 } },
        { id: 'triangle-center', position: { x:  0,    y: -10.5, z:  2 } },
      ],
    },
  },
  // cathedral-nave-deep-perspective migrated to the markdown shelf:
  //   control/lib/graph/manji-programs/cathedral-nave-deep-perspective.md
  // The resolver falls through to the shelf after checking the in-code
  // libraries — by-name authoring and discovery continue to work
  // unchanged.
  // standing-figure-canonical migrated to the markdown shelf in Wave 2.3
  // (2026-06-05):
  //   control/lib/graph/manji-programs/standing-figure-canonical.md
  // Geometry preserved verbatim; the shelf card adds the rich prose body
  // for semantic_search discoverability. See
  // lite-template/integration/0605/polygonizer-capability-additions.plan.md.
  {
    id: 'still-life-tabletop-three-objects',
    label: 'Still-life tabletop (three objects)',
    aliases: ['three object still life', 'still life trio', 'three object arrangement', 'tabletop trio', 'still life'],
    family: 'still-life-arrangement',
    topology: {
      cameraVector: 'slight-down-tabletop',
      staging: 'three-object-row',
      reach: 'tabletop-and-back-wall',
    },
    intents: ['object-arrangement', 'compositional-balance', 'tabletop-staging'],
    reasoningUse: [
      'three objects arranged on a horizontal surface with a center focal',
      'classical still-life composition with bilateral balance',
      'tabletop scene that other objects (vase, fruit, book) drop into',
    ],
    boundaryContract: {
      slots: ['object-left', 'object-center', 'object-right', 'tabletop-surface', 'table-edge-front', 'background-wall'],
      collisionGroups: ['object-volumes', 'tabletop-plane', 'back-wall'],
      depthBands: ['table-front', 'object-band', 'back-wall'],
    },
    manjiProgram: {
      spine: {
        bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' }, lengthScale: 0.6 },
        bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' }, lengthScale: 0.4 },
        bar3: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.2 },
      },
      slots: [
        { id: 'object-left',      position: { x: -3,  y: -8,  z:  0.5 } },
        { id: 'object-center',    position: { x:  0,  y: -8,  z:  0.5 } },
        { id: 'object-right',     position: { x:  3,  y: -8,  z:  0.5 } },
        { id: 'tabletop-surface', position: { x:  0,  y: -8,  z:  0 } },
        { id: 'table-edge-front', position: { x:  0,  y: -4,  z:  0 } },
        { id: 'background-wall',  position: { x:  0,  y: -16, z:  3 } },
      ],
    },
  },
];

const SHOT_GLYPH_BY_ID = new Map(SHOT_GLYPH_LIBRARY.map((glyph) => [glyph.id, glyph]));
const SHOT_GLYPH_ALIAS = new Map();

for (const glyph of SHOT_GLYPH_LIBRARY) {
  SHOT_GLYPH_ALIAS.set(normalizePatternKey(glyph.id), glyph.id);
  SHOT_GLYPH_ALIAS.set(normalizePatternKey(glyph.label), glyph.id);
  for (const alias of glyph.aliases || []) {
    SHOT_GLYPH_ALIAS.set(normalizePatternKey(alias), glyph.id);
  }
}

export function mandalaPatternLibrary() {
  return MANDALA_PATTERN_LIBRARY.map((pattern) => structuredClone(pattern));
}

export function mandalaPatternIds() {
  return MANDALA_PATTERN_LIBRARY.map((pattern) => pattern.id);
}

export function blockLayoutLibrary() {
  return BLOCK_LAYOUT_LIBRARY.map((layout) => structuredClone(layout));
}

export function blockLayoutIds() {
  return BLOCK_LAYOUT_LIBRARY.map((layout) => layout.id);
}

export function shotGlyphLibrary() {
  return SHOT_GLYPH_LIBRARY.map((glyph) => structuredClone(glyph));
}

export function shotGlyphIds() {
  return SHOT_GLYPH_LIBRARY.map((glyph) => glyph.id);
}

export function resolveMandalaPattern(ref) {
  const id = MANDALA_PATTERN_ALIAS.get(normalizePatternKey(ref));
  return id ? structuredClone(MANDALA_PATTERN_BY_ID.get(id)) : null;
}

export function resolveBlockLayout(ref) {
  const id = BLOCK_LAYOUT_ALIAS.get(normalizePatternKey(ref));
  return id ? structuredClone(BLOCK_LAYOUT_BY_ID.get(id)) : null;
}

export function resolveShotGlyph(ref) {
  const id = SHOT_GLYPH_ALIAS.get(normalizePatternKey(ref));
  return id ? structuredClone(SHOT_GLYPH_BY_ID.get(id)) : null;
}

/**
 * Resolve a manji-program reference to the preset its card carries.
 *
 * `programRef` in a manji-tree node looks up the card here. Sources, in
 * priority order:
 *
 *   1. In-code mandala-pattern cards (alias-respected via MANDALA_PATTERN_ALIAS).
 *   2. In-code shot-glyph cards (alias-respected via SHOT_GLYPH_ALIAS).
 *   3. Markdown shelf at `lib/graph/manji-programs/` (id-keyed only).
 *
 * The shelf is the curatorial growth surface: new cards land as
 * markdown files (frontmatter + prose body) rather than as inline JS
 * entries, which keeps mandala-patterns.js bounded as the library
 * expands. See lite-template/integration/0605/manji-program-library-expansion.plan.md.
 *
 * Plug this into `walkManjiTree` / `walkManjiTree3D` / `validateManjiTree`
 * call sites so `programRef`-authored trees resolve to their stored
 * preset geometry rather than failing with "cannot resolve programRef".
 */
export function resolveManjiProgramRef(ref) {
  const pattern = resolveMandalaPattern(ref);
  if (pattern?.manjiProgram) return pattern.manjiProgram;
  const shotGlyph = resolveShotGlyph(ref);
  if (shotGlyph?.manjiProgram) return shotGlyph.manjiProgram;
  const shelfCard = getManjiProgramShelfCard(ref);
  if (shelfCard?.manjiProgram) return shelfCard.manjiProgram;
  return null;
}

/**
 * Resolve a manji-program reference to its FULL card (id, label,
 * family, aliases, intents, reasoningUse, boundaryContract,
 * manjiProgram, body). Sibling of `resolveManjiProgramRef`, which only
 * returns the preset's manji program. The full card is what the
 * renderer needs to make role-aware decisions (pick stroke style by
 * family, render figures as silhouettes vs architecture as outlines).
 */
export function resolveManjiProgramCard(ref) {
  const pattern = resolveMandalaPattern(ref);
  if (pattern?.manjiProgram) return pattern;
  const shotGlyph = resolveShotGlyph(ref);
  if (shotGlyph?.manjiProgram) return shotGlyph;
  const shelfCard = getManjiProgramShelfCard(ref);
  if (shelfCard?.manjiProgram) return shelfCard;
  return null;
}

export function buildShotGlyphPlan(input = {}) {
  return normalizeShotGlyph(input);
}

export function buildMandalaPatternLayer(input = {}) {
  const requested = Array.isArray(input.patterns) ? input.patterns : [];
  const patterns = requested
    .map((pattern) => normalizeLayerPattern(pattern))
    .filter(Boolean);
  const blockLayout = buildBlockLayoutPlan(input.blockLayout || input.layoutPlan || input.streetLayout);
  const shotGlyph = normalizeShotGlyph(input.shotGlyph || input.standardShot || input.shot);

  return {
    kind: 'metaconcept-mandala-pattern-layer',
    coordinateSpace: input.coordinateSpace || 'zero-pixel-3d-mandala-space',
    commitment: 'structured-boundary-before-visible-pixels',
    extensibility: {
      mode: 'open-generative-library',
      rule: 'the model may extend, modify, derive, or combine named seeds when the shot needs a better top-down fit',
      preserve: ['boundaryContract', 'collisionGroups', 'depthBands', 'cameraWindow', 'shotGlyph'],
    },
    cameraWindow: normalizeCameraWindow(input.cameraWindow || shotGlyph?.cameraWindow),
    ...(shotGlyph ? { shotGlyph } : {}),
    contentPolicy: {
      scope: 'camera-visible-required-content',
      rule: 'plan only enough mandala world for the shot; include objects, supports, occluders, and face regions the camera needs to see',
      fitSpace: 'between-left-and-right-terminator-vectors',
    },
    ...(blockLayout ? { blockLayout } : {}),
    patterns,
    resolutionOrder: [
      'derive or select named vector pattern seeds for the shot',
      ...(shotGlyph ? ['lower shot glyph into camera vector, view wedge, light entry, support plane, and subject envelope'] : []),
      ...(blockLayout ? ['choose block layout primitive before visible visionPane lowering'] : []),
      'clip the top-down mandala to the camera window between two terminator vectors',
      'include only camera-required content, supports, occluders, and face regions',
      'instantiate invisible slots and exclusion zones',
      'resolve collision/support/depth in mandala space',
      'bind visible marks only after the boundary contract is coherent',
    ],
  };
}

function normalizeShotGlyph(input) {
  if (!input) return null;
  const raw = typeof input === 'string' ? { id: input } : input;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const base = resolveShotGlyph(raw.extends || raw.seed || raw.id || raw.kind || raw.ref);
  if (!base) {
    return {
      id: raw.id || 'derived-shot-glyph',
      label: raw.label || raw.id || 'Derived shot glyph',
      family: raw.family || 'derived-shot-glyph',
      topology: raw.topology || {},
      cameraPrimitive: raw.cameraPrimitive,
      cameraWindow: normalizeCameraWindow(raw.cameraWindow),
      roomConcept: raw.roomConcept,
      visionPane: raw.visionPane,
      hallMandala: raw.hallMandala,
      meru: raw.meru,
      placementSpace: raw.placementSpace,
      lightSources: Array.isArray(raw.lightSources) ? raw.lightSources : [],
      scene: raw.scene,
      boundaryContract: raw.boundaryContract || {},
      derivation: {
        kind: 'custom',
        note: raw.note || 'scene-specific shot glyph derived by the model',
      },
    };
  }
  return {
    ...base,
    ...raw,
    id: raw.id && raw.extends ? raw.id : base.id,
    label: raw.label || base.label,
    family: raw.family || base.family,
    topology: { ...(base.topology || {}), ...(raw.topology || {}) },
    cameraPrimitive: deepMerge(base.cameraPrimitive, raw.cameraPrimitive),
    cameraWindow: normalizeCameraWindow(deepMerge(base.cameraWindow, raw.cameraWindow)),
    roomConcept: deepMerge(base.roomConcept, raw.roomConcept),
    visionPane: deepMerge(base.visionPane, raw.visionPane),
    hallMandala: deepMerge(base.hallMandala, raw.hallMandala),
    meru: deepMerge(base.meru, raw.meru),
    placementSpace: deepMerge(base.placementSpace, raw.placementSpace),
    lightSources: Array.isArray(raw.lightSources) ? raw.lightSources : base.lightSources,
    scene: deepMerge(base.scene, raw.scene),
    boundaryContract: {
      ...(base.boundaryContract || {}),
      ...(raw.boundaryContract || {}),
      slots: raw.boundaryContract?.slots || base.boundaryContract?.slots,
      collisionGroups: raw.boundaryContract?.collisionGroups || base.boundaryContract?.collisionGroups,
      depthBands: raw.boundaryContract?.depthBands || base.boundaryContract?.depthBands,
    },
    derivation: {
      kind: raw.extends || raw.seed ? 'modified-shot-glyph' : 'canonical-shot-glyph',
      seed: base.id,
      modifications: raw.modifications,
      note: raw.note,
    },
  };
}

export function buildBlockLayoutPlan(input = {}) {
  if (!input) return null;
  const raw = typeof input === 'string' ? { id: input } : input;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const base = resolveBlockLayout(raw.extends || raw.seed || raw.id || raw.kind || raw.scale);
  if (!base) return null;
  const density = raw.density || raw.scale || base.scale;
  const variation = {
    mode: raw.variationMode || raw.mode || 'deterministic-variation',
    density,
    streetRhythm: raw.streetRhythm || defaultStreetRhythm(base.id),
    parcelRhythm: raw.parcelRhythm || defaultParcelRhythm(base.id),
    landmarkBias: raw.landmarkBias || defaultLandmarkBias(base.id),
    seed: raw.variationSeed || raw.seedName || `${base.id}:${density}`,
  };
  return {
    id: raw.id && raw.extends ? raw.id : base.id,
    label: raw.label || base.label,
    extends: raw.extends || raw.seed ? base.id : undefined,
    scale: raw.scale || base.scale,
    purpose: raw.purpose || 'choose conceptual block layout before visionPane lowering',
    seeds: dedupe([...(base.seeds || []), ...(Array.isArray(raw.seeds) ? raw.seeds : [])]),
    topology: { ...(base.topology || {}), ...(raw.topology || {}) },
    variationKnobs: dedupe([...(base.variationKnobs || []), ...(Array.isArray(raw.variationKnobs) ? raw.variationKnobs : [])]),
    variation,
    layoutContract: {
      ...(base.layoutContract || {}),
      ...(raw.layoutContract || {}),
      spines: raw.layoutContract?.spines || base.layoutContract?.spines,
      parcelBands: raw.layoutContract?.parcelBands || base.layoutContract?.parcelBands,
      anchors: raw.layoutContract?.anchors || base.layoutContract?.anchors,
      collisionGroups: raw.layoutContract?.collisionGroups || base.layoutContract?.collisionGroups,
    },
    loweringHint: {
      target: 'visionPane',
      rule: 'use this block layout to choose nearEdge, parcel bands, anchors, and feature rhythms before visible road/floor lowering',
    },
  };
}

function normalizeLayerPattern(pattern) {
  if (typeof pattern === 'string') return resolveMandalaPattern(pattern);
  if (!pattern || typeof pattern !== 'object' || Array.isArray(pattern)) return null;

  const base = resolveMandalaPattern(pattern.extends || pattern.seed || pattern.id);
  if (!base) {
    return {
      id: pattern.id || 'derived-mandala-pattern',
      label: pattern.label || pattern.id || 'Derived mandala pattern',
      family: pattern.family || 'derived',
      topology: pattern.topology || {},
      intents: Array.isArray(pattern.intents) ? dedupe(pattern.intents) : [],
      reasoningUse: Array.isArray(pattern.reasoningUse) ? pattern.reasoningUse : [],
      boundaryContract: pattern.boundaryContract || {},
      derivation: {
        kind: 'custom',
        note: pattern.note || 'scene-specific pattern derived by the model',
      },
    };
  }

  return {
    ...base,
    ...pattern,
    id: pattern.id || base.id,
    label: pattern.label || base.label,
    family: pattern.family || base.family,
    topology: { ...(base.topology || {}), ...(pattern.topology || {}) },
    intents: dedupe([
      ...(base.intents || []),
      ...(Array.isArray(pattern.intents) ? pattern.intents : []),
    ]),
    reasoningUse: [
      ...(base.reasoningUse || []),
      ...(Array.isArray(pattern.reasoningUse) ? pattern.reasoningUse : []),
    ],
    boundaryContract: {
      ...(base.boundaryContract || {}),
      ...(pattern.boundaryContract || {}),
      slots: pattern.boundaryContract?.slots || base.boundaryContract?.slots,
      collisionGroups: pattern.boundaryContract?.collisionGroups || base.boundaryContract?.collisionGroups,
      depthBands: pattern.boundaryContract?.depthBands || base.boundaryContract?.depthBands,
    },
    derivation: {
      kind: pattern.combineWith ? 'combined-seed' : pattern.extends || pattern.seed ? 'modified-seed' : 'canonical-seed',
      seed: base.id,
      combineWith: pattern.combineWith,
      modifications: pattern.modifications,
      note: pattern.note,
    },
  };
}

function normalizeCameraWindow(cameraWindow) {
  const fallback = {
    kind: 'shot-terminator-wedge',
    terminatorVectors: {
      left: [-1, 0],
      right: [1, 0],
    },
    fitRule: 'visible mandala content must fit between the two terminator vectors for the shot',
  };
  if (!cameraWindow || typeof cameraWindow !== 'object' || Array.isArray(cameraWindow)) return fallback;
  return {
    ...fallback,
    ...cameraWindow,
    terminatorVectors: {
      ...fallback.terminatorVectors,
      ...(cameraWindow.terminatorVectors || {}),
    },
  };
}

function defaultStreetRhythm(id) {
  if (id === 'metropolis-grid') return 'avenue-cross-street-repeat';
  if (id === 'small-town-main-street') return 'single-spine-shopfront-repeat';
  if (id === 'old-town-meander') return 'alternating-bend-pockets';
  if (id === 'suburban-culdesac') return 'stem-to-loop-fan';
  if (id === 'industrial-spine') return 'service-road-loading-bay-repeat';
  return 'layout-default';
}

function defaultParcelRhythm(id) {
  if (id === 'metropolis-grid') return 'dense-deep-parcels';
  if (id === 'small-town-main-street') return 'shallow-varied-shopfronts';
  if (id === 'old-town-meander') return 'irregular-frontage-pockets';
  if (id === 'suburban-culdesac') return 'radial-lot-fan';
  if (id === 'industrial-spine') return 'deep-warehouse-bays';
  return 'balanced-parcels';
}

function defaultLandmarkBias(id) {
  if (id === 'metropolis-grid') return 'corner-node';
  if (id === 'small-town-main-street') return 'civic-terminator';
  if (id === 'old-town-meander') return 'gate-or-market-pocket';
  if (id === 'suburban-culdesac') return 'loop-center';
  if (id === 'industrial-spine') return 'loading-dock';
  return 'primary-anchor';
}

function normalizePatternKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function dedupe(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const key = value.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function deepMerge(base, override) {
  if (override === undefined || override === null) return structuredClone(base);
  if (base === undefined || base === null) return structuredClone(override);
  if (Array.isArray(base) || Array.isArray(override) || typeof base !== 'object' || typeof override !== 'object') {
    return structuredClone(override);
  }
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    out[key] = deepMerge(out[key], value);
  }
  return out;
}
