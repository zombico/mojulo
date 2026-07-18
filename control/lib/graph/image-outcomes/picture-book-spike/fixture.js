/**
 * Picture-book render spike — the story fixture.
 *
 * A six-page picture book where every page is a normal `image-outcome`
 * manifest (single shot, no bubbles) sharing one book-level Style Lock and
 * casting one recurring character. Identity rides the substrate's
 * character-sheet primitive (adopted from the comics slice): the character
 * is declared ONCE (`NOA`), minted as a standalone `character-sheet`
 * manifest, and cast into every page via `characters[]` + figure binding —
 * in real minting the pages would carry `characters: [{ ref: 'sk_…' }]`
 * and the tool layer would inline this same block.
 *
 * Captions are BOOK-owned: they live in the publication HTML under each
 * illustration and must never reach render instructions (the lettering
 * invariant, transposed to captions).
 *
 * Pure data — no Date, no dice. See picture-book-render.plan.md.
 */

const W = 1536;
const H = 1024;

// One Style Lock for the whole book — the cross-page style hold is the
// book-level analogue of the per-page preset.
export const BOOK_STYLE = {
  preset: 'ink-brush',
  dials: { register: 0.6, tint: 'pale' },
};

// The character, declared once (the character-sheet primitive's block).
// Identity lives HERE — not in prose bible lines, not in per-page prompts.
export const NOA = {
  id: 'noa',
  name: 'Noa',
  description:
    'a small child of about seven — round face, short black hair cut straight across the brow; always carrying the family lantern, a paper-and-brass storm lantern with a ring handle, about the size of Noa\'s head',
  outfits: [
    {
      id: 'coat',
      description: 'rust-red duffel coat with two toggle buttons, mustard-yellow scarf, dark boots',
    },
  ],
};

// What stays book-level after adopting the character sheet: setting,
// palette, and the continuity ladder — scene truths no single manifest
// carries, rendered into every brief.
export const BOOK_BIBLE = {
  setting: 'a rocky northern harbor village; seawall, beacon tower on the headland, cold sea wind',
  palette: 'ink on pale paper with restrained ochre (coat, lantern light) and indigo (sea, dusk) mineral tints',
  continuity: [
    'dusk deepens page by page: pale afternoon (p1) to full night (p6)',
    'the lantern is UNLIT on pages 1-3, LIT from page 4 on — once lit, its warm ochre glow is the only warm light in the image',
    'the sea wind blows from the left on every page: scarf, spray, and grass all stream the same way',
  ],
};

function noaFigure(x, y, scale, pose) {
  return { id: 'noa', x, y, scale, pose, character: 'noa', outfit: 'coat' };
}

const BRIEF = {
  ...BOOK_STYLE,
  mayInvent: ['rock and water texture', 'gulls', 'village rooftops', 'mist', 'grass and rope details'],
  negative: ['no readable text anywhere', 'no caption or title lettering — captions are typeset outside the image'],
};

/** The six pages: { n, caption, manifest } — manifest is a plain image-outcome casting NOA. */
export function bookPages() {
  return [
    {
      n: 1,
      caption: 'The night the harbor light went out, Noa took the old lantern down from its hook.',
      manifest: {
        kind: 'image-outcome',
        title: 'Page 1 — The Dark Harbor',
        intent: 'Establishing shot: the harbor village at the edge of dusk, the beacon tower dark on the headland, Noa standing small on the path holding the unlit lantern.',
        viewBox: { width: W, height: H },
        horizonY: 430,
        camera: { kind: 'wide-establishing', horizonY: 430 },
        characters: [NOA],
        forms: [
          { id: 'sea', role: 'open sea plane', depthBand: 'background', depthRank: 0, preserve: 'loose', polygon: [[0, 330], [W, 330], [W, 560], [0, 560]], materialHint: 'flat indigo wash, unpainted paper as light on the water' },
          { id: 'headland-beacon', role: 'headland with dark beacon tower', depthBand: 'background', depthRank: 1, preserve: 'strict', polygon: [[1150, 240], [1310, 240], [1340, 520], [1120, 520]], materialHint: 'the tower silhouette must read; its lamp room is DARK', notes: 'This is the story object — keep the tower dark and unmistakable.' },
          { id: 'village', role: 'harbor village mass', depthBand: 'midground', depthRank: 2, preserve: 'guided', polygon: [[60, 380], [640, 340], [700, 620], [40, 660]], materialHint: 'clustered rooftops, a few brush strokes each' },
          { id: 'path', role: 'foreground coast path', depthBand: 'foreground', depthRank: 3, preserve: 'strict', polygon: [[300, H], [1000, H], [880, 640], [520, 640]], materialHint: 'dry-brush stony path' },
        ],
        figures: [noaFigure(700, 690, 0.9, 'stand')],
        renderBrief: BRIEF,
      },
    },
    {
      n: 2,
      caption: 'It had not been lit since Grandmother kept the light. "Wind first, then flame," she used to say.',
      manifest: {
        kind: 'image-outcome',
        title: 'Page 2 — The Lantern',
        intent: 'Insert shot: the unlit paper-and-brass lantern held in Noa\'s two small hands, filling the frame. The same lantern as every other page.',
        viewBox: { width: W, height: H },
        camera: { kind: 'insert-close-up' },
        characters: [NOA],
        forms: [
          { id: 'lantern', role: 'the family storm lantern, unlit', depthBand: 'foreground', depthRank: 1, preserve: 'strict', polygon: [[560, 220], [980, 220], [1000, 760], [540, 760]], materialHint: 'paper pane, brass cap and base, ring handle — cold, unlit', notes: 'The story object: this exact lantern recurs on every page and on the character sheet.' },
          { id: 'hands', role: 'Noa\'s hands cradling the lantern', depthBand: 'foreground', depthRank: 2, preserve: 'guided', polygon: [[420, 620], [1120, 620], [1180, H], [360, H]], materialHint: 'small hands, rust-red coat cuffs visible' },
        ],
        renderBrief: BRIEF,
      },
    },
    {
      n: 3,
      caption: 'The sea wind came hard along the wall, and Noa ran with it.',
      manifest: {
        kind: 'image-outcome',
        title: 'Page 3 — Running the Seawall',
        intent: 'Wide cinematic shot: Noa runs left-to-right along the top of the seawall toward the headland, scarf streaming, spray blowing across from the left. Lantern still unlit, held tight.',
        viewBox: { width: W, height: H },
        horizonY: 400,
        camera: { kind: 'wide-cinematic', horizonY: 400 },
        characters: [NOA],
        forms: [
          { id: 'sea-spray', role: 'wind-driven sea and spray', depthBand: 'background', depthRank: 0, preserve: 'loose', polygon: [[0, 260], [W, 300], [W, 620], [0, 560]], materialHint: 'wet-into-wet washes, flying-white spray off the wave tops' },
          { id: 'headland-beacon', role: 'headland with dark beacon tower, nearer now', depthBand: 'background', depthRank: 1, preserve: 'strict', polygon: [[1240, 180], [1420, 180], [1460, 560], [1210, 560]], materialHint: 'tower still dark' },
          { id: 'seawall', role: 'the seawall top Noa runs on', depthBand: 'foreground', depthRank: 2, preserve: 'strict', polygon: [[0, 700], [W, 640], [W, 840], [0, 900]], materialHint: 'long dry-brush stones, a rope rail' },
        ],
        figures: [noaFigure(620, 590, 1.0, 'run')],
        renderBrief: BRIEF,
      },
    },
    {
      n: 4,
      caption: 'At the foot of the tower stair, the little flame caught at last.',
      manifest: {
        kind: 'image-outcome',
        title: 'Page 4 — Wind First, Then Flame',
        intent: 'Low-angle hero shot at the base of the beacon tower: Noa reaches up to hang the lantern on the stair hook — and it is LIT for the first time, the only warm light in the image.',
        viewBox: { width: W, height: H },
        horizonY: 720,
        camera: { kind: 'low-angle-hero', horizonY: 720 },
        characters: [NOA],
        forms: [
          { id: 'tower', role: 'beacon tower rising out of frame', depthBand: 'midground', depthRank: 1, preserve: 'strict', polygon: [[860, 0], [1240, 0], [1300, 860], [820, 860]], materialHint: 'stone courses in ink, the tower door at its base' },
          { id: 'stair', role: 'stone stair up the tower base', depthBand: 'foreground', depthRank: 2, preserve: 'guided', polygon: [[520, 860], [1300, 860], [1300, H], [400, H]], materialHint: 'worn steps' },
          { id: 'lantern-glow', role: 'the lit lantern at the hook', depthBand: 'foreground', depthRank: 3, preserve: 'strict', polygon: [[700, 300], [830, 300], [830, 470], [700, 470]], materialHint: 'FIRST LIGHT: warm ochre glow, unpainted paper as the halo', notes: 'The turn of the story — the lantern is lit from this page on.' },
        ],
        figures: [noaFigure(620, 760, 1.25, 'reach')],
        renderBrief: BRIEF,
      },
    },
    {
      n: 5,
      caption: 'Up the dark stair Noa climbed, sheltering the flame the way Grandmother had shown.',
      manifest: {
        kind: 'image-outcome',
        title: 'Page 5 — Sheltering the Flame',
        intent: 'Close shot inside the tower doorway: Noa crouched over the lit lantern, shielding it from the wind, warm glow on face and coat, indigo night behind.',
        viewBox: { width: W, height: H },
        camera: { kind: 'close-up' },
        characters: [NOA],
        forms: [
          { id: 'doorway', role: 'tower doorway arch framing the shot', depthBand: 'background', depthRank: 0, preserve: 'guided', polygon: [[160, 40], [1380, 40], [1300, H], [240, H]], materialHint: 'heavy ink arch, night sky through the opening' },
          { id: 'lantern-glow', role: 'the lit lantern between Noa\'s feet', depthBand: 'foreground', depthRank: 2, preserve: 'strict', polygon: [[660, 620], [880, 620], [880, 880], [660, 880]], materialHint: 'the same lantern, warm ochre core' },
        ],
        figures: [noaFigure(770, 520, 1.5, 'crouch')],
        renderBrief: BRIEF,
      },
    },
    {
      n: 6,
      caption: 'And the harbor light burned again, all the way out to sea.',
      manifest: {
        kind: 'image-outcome',
        title: 'Page 6 — The Light Returns',
        intent: 'Final establishing shot, full night: the beacon tower LIT, its beam over the dark sea, the village windows warm below, Noa tiny at the tower rail waving toward home.',
        viewBox: { width: W, height: H },
        horizonY: 460,
        camera: { kind: 'wide-establishing', horizonY: 460 },
        characters: [NOA],
        forms: [
          { id: 'night-sea', role: 'night sea under the beam', depthBand: 'background', depthRank: 0, preserve: 'loose', polygon: [[0, 360], [W, 360], [W, 640], [0, 640]], materialHint: 'deep indigo wash' },
          { id: 'beacon-lit', role: 'the beacon tower, lamp room LIT with beam', depthBand: 'midground', depthRank: 1, preserve: 'strict', polygon: [[1080, 120], [1290, 120], [1330, 620], [1050, 620]], materialHint: 'the tower from page 1, now with a warm lamp room and a soft beam of unpainted paper across the sea', notes: 'Mirror of page 1 — same tower, now alight.' },
          { id: 'village-lit', role: 'village below, windows warm', depthBand: 'midground', depthRank: 2, preserve: 'guided', polygon: [[40, 440], [560, 410], [620, 680], [20, 720]], materialHint: 'small ochre window lights' },
          { id: 'foreground-rocks', role: 'dark foreground rocks', depthBand: 'foreground', depthRank: 3, preserve: 'loose', polygon: [[0, 820], [W, 780], [W, H], [0, H]], materialHint: 'charged black ink' },
        ],
        figures: [noaFigure(1180, 260, 0.55, 'wave')],
        renderBrief: BRIEF,
      },
    },
  ];
}

/**
 * The cover — the P5 shape (picture-book-render.plan.md): a single portrait
 * `image-outcome` casting the same character, sharing the book Style Lock,
 * with PROTECTED zones where the publication layer typesets the title and
 * imprint AFTER generation. Doubles as the P5 pre-gate portrait-viewBox
 * check: every shot so far has been landscape.
 */
export function coverManifest() {
  const CW = 1024;
  const CH = 1536;
  return {
    kind: 'image-outcome',
    title: 'Cover',
    intent: 'Portrait cover shot at full dusk: Noa stands on the foreground coast path holding the LIT lantern, its warm ochre glow the only warm light; the beacon tower rises on the headland behind, lamp room LIT — the story\'s promise on one page. Sea wind from the left.',
    viewBox: { width: CW, height: CH },
    horizonY: 860,
    camera: { kind: 'wide-establishing', horizonY: 860 },
    characters: [NOA],
    forms: [
      { id: 'dusk-sky', role: 'deep dusk sky', depthBand: 'background', depthRank: 0, preserve: 'loose', polygon: [[0, 0], [CW, 0], [CW, 860], [0, 860]], materialHint: 'indigo wash grading darker upward, unpainted paper for the last light at the horizon' },
      { id: 'sea', role: 'darkening sea', depthBand: 'background', depthRank: 1, preserve: 'loose', polygon: [[0, 760], [CW, 760], [CW, 1040], [0, 1040]], materialHint: 'flat indigo, flying-white wind streaks from the left' },
      { id: 'headland-beacon', role: 'headland with the beacon tower, lamp room LIT', depthBand: 'midground', depthRank: 2, preserve: 'strict', polygon: [[620, 400], [820, 400], [860, 940], [590, 940]], materialHint: 'the tower from the pages, warm lamp room and a soft beam of unpainted paper', notes: 'The story object — must read instantly, and it is LIT on the cover.' },
      { id: 'coast-path', role: 'foreground coast path Noa stands on', depthBand: 'foreground', depthRank: 3, preserve: 'strict', polygon: [[140, CH], [900, CH], [740, 1030], [320, 1030]], materialHint: 'dry-brush stony path, wind-bent grass streaming right' },
    ],
    figures: [noaFigure(480, 1100, 1.35, 'stand')],
    protectedZones: [
      { x: 96, y: 96, w: 832, h: 280, label: 'title zone — book typesets the title here' },
      { x: 256, y: 1392, w: 512, h: 96, label: 'imprint zone' },
    ],
    renderBrief: BRIEF,
  };
}

/**
 * The identity lock — the substrate's `character-sheet` primitive (adopted
 * from the comics slice; supersedes this spike's original ad-hoc key).
 * In real minting: `create_sketch { kind: 'character-sheet', ... }` → own
 * `sk_` ref → worker renders → `bind_character_sheet` → every page packet
 * serves the bound PNG as `boundSheet`.
 */
export function characterSheetManifest() {
  return {
    kind: 'character-sheet',
    title: 'Noa — character sheet',
    character: NOA,
    renderBrief: BOOK_STYLE,
  };
}

export function bookFixture() {
  return {
    title: 'The Lantern and the Sea Wind',
    blurb: 'A small book about a small keeper. Six pages, one lantern, one long wind off the sea.\n\nMade as an ink-brush picture book: mojulo directed the shots; an image model held the brush.',
    style: BOOK_STYLE,
    bible: BOOK_BIBLE,
    characterSheet: characterSheetManifest(),
    cover: coverManifest(),
    pages: bookPages(),
  };
}
