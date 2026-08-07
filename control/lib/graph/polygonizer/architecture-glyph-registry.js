/**
 * Architectural glyph registry.
 *
 * This lifts the facade-glyph spike sheets into model-usable concept grammar:
 * structural parts, placement contracts, variation axes, aliases, and example
 * references. The generated SVGs remain examples; this registry is the
 * retrieval surface for varied outcomes.
 */

export const ARCHITECTURE_GLYPH_REGISTRY_VERSION = '0.1.0';

export const ARCHITECTURE_GLYPH_SOURCE_SHEETS = [
  '1-facade-glyph-catalog.svg',
  '4-balcony-pattern-glyphs.svg',
  '6-structural-balcony-allocation.svg',
  '7-low-rise-house-composition.svg',
  '8-architecture-doodad-vocabulary.svg',
  '9-entry-roof-style-vocabulary.svg',
  '10-asian-inspired-curved-roofs.svg',
  '12-roof-top-triangle-repeats.svg',
  '13-torii-gate-vocabulary.svg',
  '14-public-realm-vocabulary.svg',
  '15-sined-pasta-path-vocabulary.svg',
  '16-lamp-and-power-infrastructure.svg',
  '18-four-post-tower-validation.svg',
  '19-under-construction-vocabulary.svg',
  '20-harbor-shipyard-structures.svg',
  '21-stadium-structure-vocabulary.svg',
  '22-oil-refinery-structures.svg',
  '23-farm-structures.svg',
  '24-event-sport-structures.svg',
  '25-urban-street-structures.svg',
  '26-urban-furniture-infrastructure.svg',
];

const FAMILY_DEFAULTS = {
  building: {
    placement: ['building.mass', 'building.radialMass', 'building.frontFace'],
    renderHints: [
      'choose massing topology before facade detail: rectilinear facadeWrap or radialWrap',
      'keep facade skin addressable by floor and bay/segment',
    ],
  },
  facade: {
    placement: ['building.frontFace', 'building.sideFace', 'podium.face'],
    renderHints: ['solve facade UV cells before emitting windows/balconies', 'keep repeated bays addressable'],
  },
  residential: {
    placement: ['lot.pad', 'street.edge', 'compound.innerCourt'],
    renderHints: ['solve body, roof, entry, porch, and steps in a zero-vector element map'],
  },
  roof: {
    placement: ['building.top', 'gate.cap', 'pavilion.top'],
    renderHints: ['roof is a child volume or curved cap, not only a painted outline'],
  },
  urban: {
    placement: ['sidewalk.edge', 'curb.line', 'street.corner', 'plaza.edge'],
    renderHints: ['attach curbside atoms to sidewalk/road surfaces with readable scale cues'],
  },
  infrastructure: {
    placement: ['utility.easement', 'roof.mount', 'field.edge', 'street.serviceZone'],
    renderHints: ['show structural supports first, then equipment boxes, lamps, wires, or antennas'],
  },
  civic: {
    placement: ['plaza.center', 'park.path', 'publicRealm.node'],
    renderHints: ['compose public atoms around paths, plinths, seating, and access edges'],
  },
  industrial: {
    placement: ['yard.grid', 'dock.edge', 'refinery.pipeRack', 'construction.site'],
    renderHints: ['use exposed frames, tanks, pipes, braces, platforms, and repetitive service bays'],
  },
  sport: {
    placement: ['field.perimeter', 'venue.bowl', 'court.edge'],
    renderHints: ['volumize walls or stands; mark field/court geometry as the inner readable surface'],
  },
  transport: {
    placement: ['terminal.apron', 'rail.platform', 'street.edge', 'lot.pad'],
    renderHints: ['reserve circulation surfaces first: platforms, concourses, canopies, runways, tracks, and entry forecourts'],
  },
  farm: {
    placement: ['farmyard.cluster', 'field.edge', 'rural.lot'],
    renderHints: ['cluster service structures around tracks, corrals, silos, towers, and house massing'],
  },
};

function concept({
  id,
  family,
  label,
  aliases,
  parts,
  variationAxes,
  tags = [],
  placement,
  renderHints,
  exampleRefs,
  composeWith = [],
  wrapNet,
}) {
  const defaults = FAMILY_DEFAULTS[family] || {};
  return {
    id,
    family,
    label,
    aliases,
    tags: [...new Set([family, ...tags])],
    parts,
    variationAxes,
    placement: placement || defaults.placement || [],
    renderHints: renderHints || defaults.renderHints || [],
    composeWith,
    exampleRefs,
    wrapNet: wrapNet || null,
  };
}

export const ARCHITECTURE_GLYPH_CONCEPTS = [
  concept({
    id: 'building.facade-wrap-tower',
    family: 'building',
    label: 'Rectilinear facade wrap tower',
    aliases: [
      'facade wrap tower',
      'angular tower',
      'rectangular highrise',
      'slab tower',
      'box skyscraper',
      'podium shaft crown tower',
      'city tower with wraparound facade',
    ],
    parts: ['massing shell', 'perimeter tape', 'floor stack', 'podium zone', 'shaft rhythm', 'crown band', 'cores and voids'],
    variationAxes: {
      floors: [16, 44],
      frontBays: [6, 12],
      sideBays: [3, 7],
      rhythm: ['window-window-balcony', 'curtainwall', 'punched-window', 'hotel-balcony-stack'],
      crown: ['flat-parapet', 'mechanical-screen', 'setback-crown'],
    },
    tags: ['building', 'tower', 'highrise', 'wrap-net', 'facade-wrap', 'cityscape'],
    placement: ['building.mass', 'building.frontFace'],
    renderHints: [
      'use facade-wrap-net for floor-aware face+bay planning',
      'plan podium/shaft/crown/core/voids before emitting windows or balconies',
      'can mix with radial-wrap towers in the same city mandala',
    ],
    composeWith: ['building.radial-wrap-tower', 'facade.storefront-podium', 'urban.sidewalk-road'],
    exampleRefs: ['facade-wrap-net/4-condo-wrap-projected.svg', 'facade-wrap-net/5-office-curtainwall-wrap-projected.svg'],
    wrapNet: {
      kind: 'facadeWrap',
      recommendedModule: 'facade-wrap-net.js',
      addressSpace: 'face + bay + floor',
      motifs: ['window', 'balcony', 'curtain-panel', 'shopfront', 'mechanical-screen', 'stairwell'],
    },
  }),
  concept({
    id: 'building.radial-wrap-tower',
    family: 'building',
    label: 'Radial cylindrical wrap tower',
    aliases: [
      'radial tower',
      'cylindrical skyscraper',
      'round tower',
      'glass drum tower',
      'heroic radial tower',
      'avengers-like tower',
      'pinched crown tower',
      'theta wrapped tower',
    ],
    parts: ['cylindrical shell', 'theta tape', 'floor stack', 'vertical fins', 'hero spine', 'sky lobby void', 'tapered crown'],
    variationAxes: {
      floors: [20, 56],
      segments: [20, 44],
      rhythm: ['glass-glass-fin', 'curtainwall', 'lobby-podium', 'crown-louver'],
      radiusProfile: ['straight-cylinder', 'gentle-taper', 'pinched-crown', 'podium-flare'],
      spinePolicy: ['none', 'front-hero-spine', 'service-spine', 'paired-spines'],
    },
    tags: ['building', 'tower', 'highrise', 'radial', 'cylindrical', 'wrap-net', 'cityscape'],
    placement: ['building.radialMass', 'building.mass'],
    renderHints: [
      'use radial-wrap-net for theta-segment+floor planning',
      'treat angular spines and sky-lobby voids as addressable cells, not loose decorations',
      'can mix with rectilinear facade-wrap towers in the same city mandala',
    ],
    composeWith: ['building.facade-wrap-tower', 'urban.sidewalk-road', 'civic.public-realm-kit'],
    exampleRefs: ['radial-wrap-net/4-heroic-radial-tower-projected.svg', 'radial-wrap-net/6-pinched-crown-projected.svg'],
    wrapNet: {
      kind: 'radialWrap',
      recommendedModule: 'radial-wrap-net.js',
      addressSpace: 'theta segment + floor',
      motifs: ['glass', 'fin', 'hero-spine', 'service-spine', 'lobby-glass', 'crown-louver'],
    },
  }),
  concept({
    id: 'facade.condo-grid',
    family: 'facade',
    label: 'Condo facade grid',
    aliases: ['condo building', 'apartment facade', 'repeating windows', 'highrise facade'],
    parts: ['massing shell', 'floor bands', 'window cells', 'balcony cells', 'side-face rhythm'],
    variationAxes: { floors: [4, 16], columns: [3, 10], balconyPolicy: ['none', 'uniform', 'alternating', 'by-column'], palette: ['glass', 'masonry', 'warm concrete'] },
    tags: ['building', 'repeater', 'balcony'],
    composeWith: ['facade.allocated-balcony', 'urban.storefront-podium', 'roof.flat-parapet'],
    exampleRefs: ['1-facade-glyph-catalog.svg', '6-structural-balcony-allocation.svg'],
  }),
  concept({
    id: 'facade.storefront-podium',
    family: 'facade',
    label: 'Storefront podium',
    aliases: ['shopfront', 'storefront facade', 'commercial ground floor', 'market front', 'cafe front'],
    parts: ['podium band', 'sign band', 'display windows', 'entry door', 'upper facade rhythm'],
    variationAxes: { bayCount: [1, 6], signText: ['short label'], awning: ['none', 'stripe', 'flat cap'], entry: ['center', 'left', 'paired'] },
    tags: ['urban', 'commercial', 'street'],
    composeWith: ['urban.sidewalk-road', 'urban.billboard-signage', 'urban.bus-stop-shelter'],
    exampleRefs: ['2-mixed-use-override-glyph.svg', '25-urban-street-structures.svg'],
  }),
  concept({
    id: 'facade.allocated-balcony',
    family: 'facade',
    label: 'Structurally allocated balcony',
    aliases: ['jutting balcony', 'cantilever balcony', 'balcony consumes facade cell', 'projecting balcony'],
    parts: ['reserved facade cell', 'child slab volume', 'front rail', 'side rails', 'shadow/contact line'],
    variationAxes: { allocation: ['uniform', 'alternating', 'stacked', 'sparse'], rail: ['front', 'side', 'glass', 'solid'], projectionDepth: [0.18, 0.55] },
    tags: ['balcony', 'child-volume', 'mandala-allocation'],
    composeWith: ['facade.condo-grid', 'urban.storefront-podium'],
    exampleRefs: ['4-balcony-pattern-glyphs.svg', '6-structural-balcony-allocation.svg'],
  }),
  concept({
    id: 'residential.low-rise-house',
    family: 'residential',
    label: 'Low-rise house composition',
    aliases: ['house', 'bungalow', 'farmhouse', 'side split', 'residential home', 'large house'],
    parts: ['body mass', 'roof', 'entry', 'porch or stoop', 'steps', 'windows', 'chimney optional'],
    variationAxes: { style: ['bungalow', 'side-split', 'prairie', 'farmhouse', 'modern'], roof: ['gable', 'hip', 'flat-parapet', 'low-prairie'], porch: ['none', 'stoop', 'covered', 'wraparound'] },
    tags: ['house', 'entry', 'roof'],
    composeWith: ['entry.arch-gate-door', 'path.sined-pasta', 'farm.corral-yard'],
    exampleRefs: ['7-low-rise-house-composition.svg', '9-entry-roof-style-vocabulary.svg'],
  }),
  concept({
    id: 'entry.arch-gate-door',
    family: 'residential',
    label: 'Entry, arch, gate, and door vocabulary',
    aliases: ['door variations', 'entryway', 'arched entry', 'gate', 'portcullis', 'wall opening'],
    parts: ['door slab or arch', 'side posts', 'lintel or arch band', 'threshold', 'optional gate bars'],
    variationAxes: { profile: ['rectangular', 'round-arch', 'pointed-arch', 'portcullis'], material: ['wood', 'stone', 'iron', 'glass'], scale: ['house', 'wall', 'public gate'] },
    tags: ['door', 'gate', 'wall'],
    composeWith: ['residential.low-rise-house', 'civic.torii-gate', 'civic.wall-path-fence'],
    exampleRefs: ['8-architecture-doodad-vocabulary.svg', '9-entry-roof-style-vocabulary.svg'],
  }),
  concept({
    id: 'roof.curved-asian-tier',
    family: 'roof',
    label: 'Curved Asian-inspired roof tiers',
    aliases: ['pagoda', 'japanese castle roof', 'asian curved roof', 'sined roof', 'hat roof'],
    parts: ['tier body', 'curved eave stroke', 'upturned ends', 'support brackets', 'stacked roof caps'],
    variationAxes: { tiers: [1, 5], eaveCurve: ['gentle', 'deep', 'upturned'], bracketDensity: ['sparse', 'medium', 'dense'], capShape: ['pagoda', 'castle-hat', 'pavilion'] },
    tags: ['pagoda', 'japanese', 'asian', 'curved'],
    composeWith: ['roof.top-triangle-repeat', 'civic.torii-gate', 'residential.low-rise-house'],
    exampleRefs: ['10-asian-inspired-curved-roofs.svg'],
  }),
  concept({
    id: 'roof.top-triangle-repeat',
    family: 'roof',
    label: 'Roof-top triangle repeat',
    aliases: ['repeating roof triangles', 'roof crest triangles', 'roof ornaments', 'rafter triangles'],
    parts: ['roof baseline', 'repeating triangular teeth', 'ridge rhythm', 'optional ribs'],
    variationAxes: { repeatCount: [3, 14], orientation: ['along-ridge', 'down-slope', 'eave-line'], scale: ['tiny crest', 'dormer-like', 'rafter-like'] },
    tags: ['repeat', 'rafter', 'ornament'],
    composeWith: ['roof.curved-asian-tier', 'roof.western-rafter-truss'],
    exampleRefs: ['12-roof-top-triangle-repeats.svg'],
  }),
  concept({
    id: 'roof.western-rafter-truss',
    family: 'roof',
    label: 'Western rafter and truss repeats',
    aliases: ['rafters', 'trusses', 'rafter tails', 'exposed roof beams'],
    parts: ['ridge', 'sloped rafters', 'tails', 'cross tie', 'brackets'],
    variationAxes: { density: ['sparse', 'regular', 'dense'], trussShape: ['simple', 'king-post', 'scissor'], exposure: ['under-eave', 'open-frame', 'construction'] },
    tags: ['rafter', 'western', 'construction'],
    composeWith: ['industrial.under-construction-frame', 'residential.low-rise-house'],
    exampleRefs: ['11-rafter-bracket-vocabulary.svg', '19-under-construction-vocabulary.svg'],
  }),
  concept({
    id: 'civic.torii-gate',
    family: 'civic',
    label: 'Torii gate',
    aliases: ['torii', 'shrine gate', 'japanese gate'],
    parts: ['two posts', 'tie beam', 'upper kasagi cap', 'center plaque optional', 'footing stones'],
    variationAxes: { cap: ['straight', 'curved', 'stone'], postLean: ['none', 'subtle'], plaque: ['none', 'center'], scale: ['path marker', 'large gate'] },
    tags: ['gate', 'japanese', 'public'],
    composeWith: ['path.sined-pasta', 'roof.curved-asian-tier', 'civic.wall-path-fence'],
    exampleRefs: ['13-torii-gate-vocabulary.svg'],
  }),
  concept({
    id: 'civic.public-realm-kit',
    family: 'civic',
    label: 'Public realm furniture kit',
    aliases: ['fountain', 'bench', 'streetlamp', 'trash can', 'pedestal', 'plaza furniture'],
    parts: ['ground node', 'pedestal or base', 'seat/slab/can/lamp body', 'optional water/fixture detail'],
    variationAxes: { object: ['fountain', 'pedestal', 'bench', 'table-bench', 'trash-can', 'streetlamp'], arrangement: ['single', 'paired', 'ring', 'path-edge'] },
    tags: ['plaza', 'park', 'furniture'],
    composeWith: ['path.sined-pasta', 'civic.wall-path-fence'],
    exampleRefs: ['14-public-realm-vocabulary.svg'],
  }),
  concept({
    id: 'path.sined-pasta',
    family: 'civic',
    label: 'Sined pasta path',
    aliases: ['curved pathway', 'sine path', 'pasta path', 'winding sidewalk', 'curved walkway'],
    parts: ['centerline', 'parallel ribbon edges', 'paver repeats', 'optional plaza nodes'],
    variationAxes: { pasta: ['fusilli', 'cavatappi', 'farfalle plaza'], amplitude: [0.1, 0.8], segmentCount: [4, 18], edgeStyle: ['smooth', 'paver', 'curb'] },
    tags: ['path', 'sidewalk', 'curve'],
    composeWith: ['civic.public-realm-kit', 'civic.torii-gate', 'farm.tracted-field'],
    exampleRefs: ['15-sined-pasta-path-vocabulary.svg'],
  }),
  concept({
    id: 'urban.sidewalk-road',
    family: 'urban',
    label: 'Road, sidewalk, and crosswalk system',
    aliases: ['road variations', 'street', 'sidewalk', 'crosswalk', 'lane markings'],
    parts: ['road plane', 'lane dashes', 'sidewalk slabs', 'curb bands', 'crosswalk stripes'],
    variationAxes: { lanes: [1, 4], crosswalk: ['none', 'zebra', 'ladder'], sidewalkSides: ['one', 'both'], roadSurface: ['asphalt', 'concrete', 'brick'] },
    tags: ['street', 'road', 'crosswalk'],
    composeWith: ['urban.traffic-signals', 'urban.bus-stop-shelter', 'facade.storefront-podium'],
    exampleRefs: ['25-urban-street-structures.svg', '26-urban-furniture-infrastructure.svg'],
  }),
  concept({
    id: 'urban.traffic-signals',
    family: 'urban',
    label: 'Traffic signs and signals',
    aliases: ['street signs', 'stoplights', 'stop sign', 'horizontal stoplight', 'vertical stoplight', 'guard arm'],
    parts: ['pole', 'sign plaque or signal housing', 'lamps', 'optional arm', 'guard barrier stripes'],
    variationAxes: { signal: ['vertical', 'horizontal', 'none'], sign: ['stop', 'street-name', 'route', 'warning'], guardArm: ['none', 'raised', 'lowered'] },
    tags: ['signal', 'sign', 'street'],
    composeWith: ['urban.sidewalk-road', 'urban.billboard-signage'],
    exampleRefs: ['25-urban-street-structures.svg'],
  }),
  concept({
    id: 'urban.billboard-signage',
    family: 'urban',
    label: 'Billboard and ad signage',
    aliases: ['billboard', 'ad panel', 'roadside ad', 'large sign'],
    parts: ['support posts', 'panel slab', 'border frame', 'copy block'],
    variationAxes: { supports: [1, 3], panelAspect: ['wide', 'square', 'vertical'], copyDensity: ['iconic', 'short text', 'poster-like'], lighting: ['none', 'top lamps'] },
    tags: ['signage', 'commercial'],
    composeWith: ['urban.sidewalk-road', 'facade.storefront-podium'],
    exampleRefs: ['25-urban-street-structures.svg', '26-urban-furniture-infrastructure.svg'],
  }),
  concept({
    id: 'urban.bus-stop-shelter',
    family: 'urban',
    label: 'Bus stop marker and shelter',
    aliases: ['bus stop', 'bus shelter', 'route sign', 'transit stop'],
    parts: ['route marker', 'platform slab', 'shelter posts', 'roof', 'bench', 'optional glass panel'],
    variationAxes: { shelter: ['marker-only', 'roofed', 'glass-panel'], bench: ['none', 'short', 'long'], routeSign: ['pole', 'on-roof', 'side-panel'] },
    tags: ['transit', 'street-furniture'],
    composeWith: ['urban.sidewalk-road', 'urban.telecom-utility-box'],
    exampleRefs: ['25-urban-street-structures.svg', '26-urban-furniture-infrastructure.svg'],
  }),
  concept({
    id: 'urban.newsstand-vendor',
    family: 'urban',
    label: 'Newsstand and vendor stand',
    aliases: ['newsstand', 'hot dog stand', 'kiosk', 'vendor cart', 'street vendor'],
    parts: ['service box', 'awning or canopy', 'display window', 'paper/food repeats', 'sign copy'],
    variationAxes: { type: ['newsstand', 'hot-dog-cart', 'coffee-kiosk'], canopy: ['flat', 'striped', 'pitched'], display: ['window', 'shelf', 'counter'] },
    tags: ['kiosk', 'commercial', 'street-furniture'],
    composeWith: ['urban.sidewalk-road', 'facade.storefront-podium'],
    exampleRefs: ['26-urban-furniture-infrastructure.svg'],
  }),
  concept({
    id: 'urban.phone-booth',
    family: 'urban',
    label: 'Phone booth',
    aliases: ['phone booth', 'telephone booth', 'glass booth'],
    parts: ['booth frame', 'glass door', 'top sign band', 'phone copy', 'floor slab'],
    variationAxes: { frame: ['red', 'metal', 'glass-heavy'], sign: ['phone', 'icon-only'], openness: ['closed', 'side-open'] },
    tags: ['street-furniture', 'retro'],
    composeWith: ['urban.newsstand-vendor', 'urban.sidewalk-road'],
    exampleRefs: ['26-urban-furniture-infrastructure.svg'],
  }),
  concept({
    id: 'urban.hydrant-utility',
    family: 'urban',
    label: 'Hydrant and telecom utility boxes',
    aliases: ['fire hydrant', 'telecom box', 'utility box', 'green cabinet', 'curb utility'],
    parts: ['curb anchor', 'hydrant barrel/cap/nozzles or cabinet shell', 'vents', 'door split', 'service detail'],
    variationAxes: { type: ['hydrant', 'telecom-cabinet', 'low-utility-box'], height: ['low', 'medium', 'tall'], color: ['red', 'green', 'gray', 'tan'] },
    tags: ['utility', 'curb'],
    composeWith: ['urban.sidewalk-road', 'urban.bus-stop-shelter'],
    exampleRefs: ['26-urban-furniture-infrastructure.svg'],
  }),
  concept({
    id: 'urban.gas-station',
    family: 'urban',
    label: 'Gas station canopy',
    aliases: ['gas station', 'fuel station', 'gas pumps', 'station canopy'],
    parts: ['canopy slab', 'canopy posts', 'pump boxes', 'hoses', 'price sign', 'optional storefront'],
    variationAxes: { pumps: [1, 6], canopy: ['flat', 'thick', 'with-sign-band'], priceSign: ['pole', 'monument', 'none'], lot: ['single island', 'two islands'] },
    tags: ['commercial', 'service', 'street'],
    composeWith: ['urban.sidewalk-road', 'urban.traffic-signals', 'urban.billboard-signage'],
    exampleRefs: ['25-urban-street-structures.svg'],
  }),
  concept({
    id: 'infrastructure.cell-tower',
    family: 'infrastructure',
    label: 'Four-leg cell tower',
    aliases: ['cell tower', 'telecom tower', 'antenna tower', 'four leg tower'],
    parts: ['four footings', 'tapered legs', 'horizontal rings', 'x-braces', 'antenna panels', 'mast'],
    variationAxes: { levels: [3, 8], antennaCount: [2, 10], footprint: ['square', 'narrow-rectangle'], mounting: ['ground', 'roof', 'compound'] },
    tags: ['tower', 'telecom', 'four-post'],
    composeWith: ['urban.hydrant-utility', 'infrastructure.power-tower'],
    exampleRefs: ['26-urban-furniture-infrastructure.svg'],
  }),
  concept({
    id: 'infrastructure.power-tower',
    family: 'infrastructure',
    label: 'Power tower and transformer drums',
    aliases: ['power tower', 'transmission tower', 'utility pole', 'transformer drums', 'sagging lines'],
    parts: ['four-post or pole support', 'crossarms', 'insulators', 'sagging wires', 'transformer drums', 'bracing'],
    variationAxes: { support: ['pole', 'four-post-lattice', 'H-frame'], wireCount: [2, 8], transformers: [0, 3], sag: ['slight', 'medium', 'deep'] },
    tags: ['tower', 'utility', 'wire'],
    composeWith: ['urban.sidewalk-road', 'infrastructure.cell-tower'],
    exampleRefs: ['16-lamp-and-power-infrastructure.svg', '18-four-post-tower-validation.svg'],
  }),
  concept({
    id: 'industrial.under-construction-frame',
    family: 'industrial',
    label: 'Under-construction exposed frame',
    aliases: ['under construction', 'beams', 'scaffolding', 'exposed rafters', 'construction site'],
    parts: ['columns', 'beams', 'rafters', 'scaffold bays', 'temporary barriers', 'rebar or deck lines'],
    variationAxes: { floors: [1, 6], scaffold: ['none', 'one side', 'wraparound'], beamStyle: ['steel', 'wood', 'concrete'], completeness: ['skeleton', 'partial walls', 'roof-framed'] },
    tags: ['construction', 'frame', 'scaffold'],
    composeWith: ['roof.western-rafter-truss', 'industrial.site-structures'],
    exampleRefs: ['19-under-construction-vocabulary.svg'],
  }),
  concept({
    id: 'industrial.site-structures',
    family: 'industrial',
    label: 'Construction site structures',
    aliases: ['crane', 'construction elevator', 'pipes', 'fencing', 'cement site structures'],
    parts: ['site fence', 'pipe racks', 'crane mast/boom', 'elevator cage', 'drums or rollers as site fixtures'],
    variationAxes: { crane: ['none', 'tower', 'gantry'], fencing: ['mesh', 'panel', 'barrier'], pipeRuns: [0, 5], staging: ['compact', 'spread'] },
    tags: ['construction', 'site', 'equipmentless'],
    composeWith: ['industrial.under-construction-frame'],
    exampleRefs: ['19-under-construction-vocabulary.svg'],
  }),
  concept({
    id: 'industrial.harbor-shipyard',
    family: 'industrial',
    label: 'Harbor and shipyard structures',
    aliases: ['dock', 'harbor', 'shipyard', 'drydock', 'gantry', 'pilings'],
    parts: ['dock deck', 'pilings', 'bollards', 'drydock or slipway', 'gantry frame', 'containers', 'harbor fence'],
    variationAxes: { dock: ['straight', 'pier', 'slipway'], gantry: ['none', 'frame', 'container crane'], pilings: [4, 20], containerRows: [0, 5] },
    tags: ['harbor', 'dock', 'shipyard'],
    composeWith: ['industrial.site-structures', 'industrial.pipe-refinery'],
    exampleRefs: ['20-harbor-shipyard-structures.svg'],
  }),
  concept({
    id: 'industrial.pipe-refinery',
    family: 'industrial',
    label: 'Oil and refinery structures',
    aliases: ['oil rig', 'pumpjack', 'sledge pump', 'refinery', 'pipes', 'drums', 'flare stack'],
    parts: ['derrick or pumpjack frame', 'pipe runs', 'vertical columns', 'tanks/drums', 'rack unit', 'flare stack'],
    variationAxes: { type: ['pumpjack', 'derrick', 'refinery-rack', 'tank-farm'], pipeDensity: ['sparse', 'medium', 'dense'], tanks: [1, 8], platforms: ['none', 'catwalk', 'multi-level'] },
    tags: ['oil', 'refinery', 'pipe'],
    composeWith: ['industrial.harbor-shipyard', 'infrastructure.power-tower'],
    exampleRefs: ['22-oil-refinery-structures.svg'],
  }),
  concept({
    id: 'sport.volumized-stadium',
    family: 'sport',
    label: 'Volumized stadium bowl',
    aliases: ['stadium', 'soccer stadium', 'baseball stadium', 'olympic stadium', 'arena walls'],
    parts: ['field or diamond', 'perimeter wall volume', 'deck tiers', 'radial aisles', 'floodlights', 'entry gaps'],
    variationAxes: { venue: ['soccer', 'baseball', 'olympic-track'], wallHeight: ['low', 'medium', 'high'], tiers: [1, 4], lights: [0, 8] },
    tags: ['stadium', 'sports', 'venue'],
    composeWith: ['sport.field-court-kit', 'urban.sidewalk-road'],
    exampleRefs: ['21-stadium-structure-vocabulary.svg'],
  }),
  concept({
    id: 'sport.field-court-kit',
    family: 'sport',
    label: 'Fields, courts, pools, and goals',
    aliases: ['soccer field', 'football field', 'tennis court', 'swimming pool', 'goals', 'sports court'],
    parts: ['bounded surface', 'field/court markings', 'goals or nets', 'pool lane bands', 'edge fixtures'],
    variationAxes: { type: ['soccer', 'football', 'tennis', 'pool'], markings: ['minimal', 'standard', 'dense'], goals: ['none', 'single pair', 'multi'] },
    tags: ['field', 'court', 'pool'],
    composeWith: ['sport.volumized-stadium', 'civic.public-realm-kit'],
    exampleRefs: ['24-event-sport-structures.svg'],
  }),
  concept({
    id: 'sport.bleacher-terraces',
    family: 'sport',
    label: 'Step-by-step bleacher terraces',
    aliases: ['bleachers', 'terraced seats', 'stadium seats', 'crowd seating', 'cheering stands', 'step seats'],
    parts: ['stepped riser stack', 'seat tread bands', 'aisle gaps', 'guard rails', 'optional canopy'],
    variationAxes: { tiers: [3, 12], curvature: ['straight', 'corner-wrapped', 'bowl-arc'], aisleCount: [0, 4], canopy: ['none', 'thin roof', 'truss roof'] },
    tags: ['stadium', 'seating', 'terrace', 'crowd'],
    composeWith: ['sport.volumized-stadium', 'sport.field-court-kit', 'civic.event-stage-podium'],
    exampleRefs: ['21-stadium-structure-vocabulary.svg', '3-stadium-planner-camera-render.svg'],
  }),
  concept({
    id: 'transport.airport-terminal',
    family: 'transport',
    label: 'Airport terminal structures',
    aliases: ['airport', 'airport terminal', 'runway', 'control tower', 'jet bridge', 'airport concourse'],
    parts: ['terminal hall', 'concourse wings', 'control tower', 'runway or taxiway strip', 'jet bridge fingers', 'forecourt canopy'],
    variationAxes: { concourses: [1, 4], tower: ['none', 'short', 'tall'], runway: ['single', 'parallel', 'taxiway-only'], gates: [2, 12] },
    tags: ['airport', 'terminal', 'transport', 'hub'],
    composeWith: ['urban.sidewalk-road', 'urban.traffic-signals', 'infrastructure.power-tower'],
    exampleRefs: ['6-transport-hub-planner-camera-render.svg'],
  }),
  concept({
    id: 'transport.train-station',
    family: 'transport',
    label: 'Train station structures',
    aliases: ['train station', 'rail station', 'railway platform', 'train platform', 'station canopy', 'tracks'],
    parts: ['station hall', 'platform slabs', 'parallel rails', 'canopy roof', 'clock or sign tower', 'entry forecourt'],
    variationAxes: { platforms: [1, 4], trackCount: [1, 6], canopy: ['short', 'long', 'arched', 'none'], hall: ['small depot', 'urban terminal', 'grand hall'] },
    tags: ['train', 'rail', 'transport', 'hub'],
    composeWith: ['urban.sidewalk-road', 'urban.bus-stop-shelter', 'facade.storefront-podium'],
    exampleRefs: ['6-transport-hub-planner-camera-render.svg'],
  }),
  concept({
    id: 'civic.event-stage-podium',
    family: 'civic',
    label: 'Event stage, podium, and lectern',
    aliases: ['podium', 'lectern', 'concert stage', 'stage truss', 'public speaking platform'],
    parts: ['raised deck', 'lectern/podium block', 'back truss', 'speaker/light stands', 'steps'],
    variationAxes: { type: ['podium', 'lectern', 'concert-stage'], truss: ['none', 'side', 'full-back'], deckHeight: ['low', 'medium'] },
    tags: ['event', 'stage', 'public'],
    composeWith: ['civic.public-realm-kit', 'sport.field-court-kit'],
    exampleRefs: ['24-event-sport-structures.svg'],
  }),
  concept({
    id: 'farm.farmyard-core',
    family: 'farm',
    label: 'Farm structures cluster',
    aliases: ['barn', 'grain tower', 'silo', 'water tower', 'farmhouse', 'windmill', 'corral'],
    parts: ['barn gable body', 'silo/grain cylinder', 'water tower legs/tank', 'windmill rotor', 'farmhouse', 'corral fence'],
    variationAxes: { structures: ['barn', 'silo', 'water-tower', 'windmill', 'farmhouse', 'corral'], clusterDensity: ['sparse', 'medium', 'dense'], fencePattern: ['rail', 'post', 'corral'] },
    tags: ['farm', 'rural', 'cluster'],
    composeWith: ['farm.tracted-field', 'residential.low-rise-house'],
    exampleRefs: ['23-farm-structures.svg'],
  }),
  concept({
    id: 'farm.tracted-field',
    family: 'farm',
    label: 'Tracted field and corral planning',
    aliases: ['plowed field', 'field rows', 'tracted field', 'corrals', 'fenced field'],
    parts: ['field plane', 'parallel furrows', 'fence rails', 'gate opening', 'optional path edge'],
    variationAxes: { rows: [4, 24], orientation: ['front-back', 'diagonal', 'curved'], enclosure: ['none', 'partial', 'full-corral'] },
    tags: ['field', 'fence', 'rural'],
    composeWith: ['farm.farmyard-core', 'path.sined-pasta'],
    exampleRefs: ['23-farm-structures.svg'],
  }),
];

const CONCEPT_BY_ID = new Map(ARCHITECTURE_GLYPH_CONCEPTS.map((entry) => [entry.id, entry]));

export function listArchitectureGlyphConcepts({ family, tag } = {}) {
  return ARCHITECTURE_GLYPH_CONCEPTS.filter((entry) => {
    if (family && entry.family !== family) return false;
    if (tag && !entry.tags.includes(tag)) return false;
    return true;
  });
}

export function getArchitectureGlyphConcept(id) {
  return CONCEPT_BY_ID.get(id) || null;
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
      if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
      return token;
    });
}

function conceptSearchText(entry) {
  return [
    entry.id,
    entry.family,
    entry.label,
    ...entry.aliases,
    ...entry.tags,
    ...entry.parts,
    ...Object.keys(entry.variationAxes || {}),
  ].join(' ');
}

export function findArchitectureGlyphConceptsForPrompt(prompt, { limit = 8 } = {}) {
  const query = new Set(tokenize(prompt));
  if (query.size === 0) return [];
  const scored = ARCHITECTURE_GLYPH_CONCEPTS.map((entry) => {
    const tokens = tokenize(conceptSearchText(entry));
    let score = 0;
    for (const token of tokens) {
      if (query.has(token)) score += 1;
    }
    for (const alias of entry.aliases) {
      const aliasTokens = tokenize(alias);
      if (aliasTokens.length && aliasTokens.every((token) => query.has(token))) score += 4;
    }
    return { entry, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return scored.slice(0, limit).map((item) => item.entry);
}

function hashSeed(seed) {
  let h = 2166136261;
  for (const ch of String(seed || 'architecture')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickAxisValue(value, random) {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.length === 2 && value.every((n) => typeof n === 'number')) {
      const [min, max] = value;
      const raw = min + (max - min) * random();
      return Number.isInteger(min) && Number.isInteger(max) ? Math.round(raw) : Number(raw.toFixed(2));
    }
    return value[Math.floor(random() * value.length)];
  }
  return value;
}

export function instantiateArchitectureGlyphPlan(conceptIds, { seed = 'architecture', limit = 12 } = {}) {
  const ids = Array.isArray(conceptIds) ? conceptIds : [conceptIds];
  const random = mulberry32(hashSeed(seed));
  const atoms = [];
  for (const id of ids.slice(0, limit)) {
    const conceptEntry = getArchitectureGlyphConcept(id);
    if (!conceptEntry) continue;
    const parameters = {};
    for (const [axis, value] of Object.entries(conceptEntry.variationAxes || {})) {
      parameters[axis] = pickAxisValue(value, random);
    }
    atoms.push({
      id: conceptEntry.id,
      family: conceptEntry.family,
      label: conceptEntry.label,
      parts: conceptEntry.parts,
      placement: conceptEntry.placement[Math.floor(random() * conceptEntry.placement.length)] || null,
      parameters,
      renderHints: conceptEntry.renderHints,
    });
  }
  return {
    registryVersion: ARCHITECTURE_GLYPH_REGISTRY_VERSION,
    seed,
    atoms,
  };
}
