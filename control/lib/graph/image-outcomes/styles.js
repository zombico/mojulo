/**
 * Style vocabulary — render-brief tuning presets (the third closed
 * vocabulary, beside cameras.js and poses.js).
 *
 * A freeform `renderBrief.style` string leaves the image model on its
 * over-rendered default register — painterly gradients, photoreal texture,
 * maximum pixel detail. A preset locks a drawing DISCIPLINE instead: line
 * tool, value structure, shading grammar, and what the model must NOT do.
 * Omitting the preset keeps the freeform max-capability path; that is
 * deliberate, not a fallback.
 *
 * Each entry carries brief defaults (style/mood/lighting), `lock` lines
 * (rendered as a "## Style Lock" instruction section), `negative` additions
 * (merged into the brief's Avoid list at normalize time), and `dials` —
 * per-preset tuning axes. Two dial kinds:
 *   - scale: a number in [0, 1] between two named poles; phrased by band.
 *   - enum:  a closed value set; phrased per value.
 * Dial values live on the manifest (`renderBrief.dials`) so the recipe
 * carries the tuning; phrasing is derived here, never stored.
 */

export const STYLE_VOCAB = {
  // G-pen inked shonen manga with screentones. Two dials: stylization
  // (realism pole <-> expressive big-head pole) and palette (flat ink color
  // vs classic black-and-white-with-tones — the palette dial owns the color
  // clause, so the static lock stays palette-neutral).
  'gpen-shonen': {
    name: 'G-pen shonen',
    style:
      'shonen manga page inked with a G-pen — bold tapered linework, solid spot blacks, screentone shading',
    mood: 'kinetic, high-clarity staging',
    lighting: 'graphic ink lighting — light stated by tone shapes and spot blacks, not gradients',
    lock: [
      'linework: G-pen ink — tapered pressure strokes, clean closed contours, confident line-weight variation',
      'shading: screentones (dot and gradient tone) and solid blacks only',
    ],
    negative: [
      'no photorealistic rendering or 3D-render look',
      'no painterly brushwork, soft gradients, or airbrushed shading',
    ],
    dials: {
      stylization: {
        kind: 'scale',
        default: 0.5,
        poles: ['realism', 'stylized expressive big-head'],
        bands: [
          [0.3, 'realism register — grounded anatomy and proportions, restrained expressions, seinen-adjacent faces'],
          [0.7, 'standard shonen register — expressive faces on anatomically grounded bodies'],
          [1, 'stylized expressive register — enlarged heads and eyes, exaggerated transformative expressions; emphasis distortion allowed on emotional beats'],
        ],
      },
      palette: {
        kind: 'enum',
        values: ['ink-color', 'bw-tones'],
        default: 'ink-color',
        phrases: {
          'ink-color': 'flat ink color fills under the tones — limited, confident palette; no painterly blending or airbrush',
          'bw-tones': 'black and white with tones — no color anywhere; every midtone arrives as dot/gradient screentone or hatching over paper white and solid black, never gray airbrush',
        },
      },
    },
  },

  // Sibling of gpen-shonen on the manga branch: shojo register — fine
  // maru-pen line instead of G-pen weight, expression carried by eyes /
  // hair / mouth shape, elongated elegant figures. Two dials: ornament
  // (clean panels <-> full shojo efflorescence) and palette (shared with
  // gpen-shonen: ink-color / bw-tones; the dial owns the color clause).
  'shojo-soft': {
    name: 'shojo soft',
    style:
      'shojo manga page drawn with a fine maru-pen line — delicate open linework, airy negative space, sparse soft screentones',
    mood: 'tender, luminous, interior emotion carried by faces',
    lighting: 'soft diffuse light — halation and white sparkle highlights instead of hard shadow shapes',
    lock: [
      'eyes are the focal instrument — large, luminous, layered iris highlights and reflected light; lashes drawn individually',
      'hair is drawn as flowing strand groups in fine parallel linework — it moves, frames the face, and carries emotion',
      'mouths stay small and delicate — expression lives in subtle shape changes, never wide-open shouts',
      'figures are elongated and graceful — long limbs and necks, slender silhouettes, elegant posture',
      'linework: fine, even, feather-light — heavy solid blacks reserved for hair masses only',
    ],
    negative: [
      'no photorealistic rendering or 3D-render look',
      'no painterly brushwork, soft gradients, or airbrushed shading',
      'no heavy G-pen action linework, speed lines, or dense crosshatching',
    ],
    dials: {
      ornament: {
        kind: 'scale',
        default: 0.5,
        poles: ['restrained', 'full shojo efflorescence'],
        bands: [
          [0.3, 'restrained ornament — clean panels, emotion carried by face and posture alone'],
          [0.7, 'classic shojo ornament — sparkle highlights and soft tone auras on emotional beats'],
          [1, 'full efflorescence — flower fields, starburst sparkles, halation auras, and dissolved panel edges on emotional beats'],
        ],
      },
      palette: {
        kind: 'enum',
        values: ['ink-color', 'bw-tones'],
        default: 'ink-color',
        phrases: {
          'ink-color': 'flat ink color with a soft, light-leaning palette — pastels and gentle contrast under sparse tones',
          'bw-tones': 'black and white with tones — no color anywhere; delicate dot/gradient screentones over paper white, solid black reserved for hair and accents',
        },
      },
    },
  },

  // Classical pulp noir ink: black and white, optional single spot tone.
  'hard-boiled': {
    name: 'hard-boiled',
    style:
      'hard-boiled pulp ink — classical noir brushwork, black and white, figures and sets carved out of solid black',
    mood: 'terse, shadow-heavy, pulp-novel tension',
    lighting: 'hard single-source chiaroscuro — shadows as solid graphic shapes',
    lock: [
      'value structure: pure black and paper white; midtones only as dry-brush, hatching, or coarse tone',
      'shadows are hard-edged shapes, never gradients',
      'inking: heavy brush-and-nib contrast, thick silhouette blacks',
    ],
    negative: [
      'no full-color palette',
      'no soft digital shading or gradients',
      'no photorealism',
    ],
    dials: {
      tone: {
        kind: 'enum',
        values: ['none', 'red', 'yellow', 'blue'],
        default: 'none',
        phrases: {
          none: 'strictly black and white — no color anywhere',
          red: 'exactly one spot-color tone: red — used sparingly as accent; everything else stays pure black and white',
          yellow: 'exactly one spot-color tone: yellow — used sparingly as accent; everything else stays pure black and white',
          blue: 'exactly one spot-color tone: blue — used sparingly as accent; everything else stays pure black and white',
        },
      },
    },
  },

  // 16th-century European ink tradition (Dürer-era drawing / engraving /
  // woodcut): ALL value is line — hatching layered into cross-hatch that
  // follows the form. Three dials: technique (pen / engraving / woodcut),
  // density (airy drawing <-> densely worked plate), ink (black / sepia).
  crosshatch: {
    name: 'crosshatch',
    style:
      '16th-century European master ink drawing — value built entirely from hatching and cross-hatching line systems, in the old-master engraving tradition',
    mood: 'studious, timeless, old-master gravity',
    lighting: 'single motivated light — form turned by hatch direction and density, never by gradients',
    lock: [
      'ALL value is line: parallel hatching layered into cross-hatch; no washes, no flat gray fills, no tones',
      'hatch lines follow the form — strokes curve around volumes like contour maps and change direction at plane breaks',
      'paper white is the only white — highlights are reserved, unmarked paper',
      'a single ink on aged paper; drapery, foliage, and sky each get their own period hatch grammar',
    ],
    negative: [
      'no screentones or halftone dots',
      'no gray washes, gradients, or airbrushed shading',
      'no photorealistic rendering or 3D-render look',
      'no color beyond the single ink',
    ],
    dials: {
      technique: {
        kind: 'enum',
        values: ['pen', 'engraving', 'woodcut'],
        default: 'pen',
        phrases: {
          pen: 'free pen-and-ink hatching — lively hand-drawn strokes, variable spacing, the sketch energy of a master drawing retained',
          engraving: 'copperplate engraving discipline — ordered ranks of swelling-and-tapering parallel lines that curve with the form, burin regularity',
          woodcut: 'woodcut register — bolder, coarser line; white highlights carved out of black masses; strong contour outline',
        },
      },
      density: {
        kind: 'scale',
        default: 0.5,
        poles: ['airy drawing', 'densely worked plate'],
        bands: [
          [0.3, 'airy — sparse open hatching, large paper-white passages, shadow only suggested'],
          [0.7, 'classically worked — a full tonal range built from layered cross-hatch, whites preserved for highlights'],
          [1, 'densely worked — deep blacks from many layered hatch directions, near-total coverage except carved-out highlights'],
        ],
      },
      ink: {
        kind: 'enum',
        values: ['black', 'sepia'],
        default: 'black',
        phrases: {
          black: 'black ink on warm paper',
          sepia: 'sepia / iron-gall brown ink on warm aged paper',
        },
      },
    },
  },

  // Old-master oil painting (Dutch Golden Age + Italian Renaissance).
  // The ONE deliberately painterly preset: where the rest of the shelf
  // bans painterly rendering, this one bans the PHOTOGRAPHIC layer —
  // lens optics, HDR, bloom, bokeh, plastic 3D sheen — and demands period
  // paint handling instead. Three dials: school (dutch / italian), drama
  // (soft daylight <-> deep tenebrism), patina (fresh <-> aged museum
  // surface).
  louvrijks: {
    name: 'louvrijks',
    style:
      'classical old-master oil painting in the Dutch Golden Age and Italian Renaissance tradition — museum-piece paint handling on canvas or panel',
    mood: 'grave, luminous, still — the quiet dignity of a gallery masterwork',
    lighting: 'single motivated source, painted chiaroscuro — warm light, cool halftones, deep transparent shadow',
    lock: [
      'this is OIL PAINT: visible glazing, scumble, and brushwork; period pigments (lead white, ochres, umbers, vermilion, lapis) in an earth-toned harmony',
      'light is painted, not photographed — modeled in warm-cool paint transitions, chiaroscuro and sfumato, never digital gradients',
      'edges behave like paint — lost-and-found contours, soft sfumato turns; nothing razor-crisp',
      'surfaces read as the period painted them: fabric, skin, metal, and glass rendered through observed paint passages, not material shaders',
    ],
    negative: [
      'no photographic rendering — painted realism only, no photo-layer look from modern image training',
      'no lens optics: no HDR, bloom, lens flare, bokeh, or depth-of-field blur',
      'no digital airbrush smoothness or plastic 3D-render surfaces',
      'no synthetic or neon pigments outside the period palette',
    ],
    dials: {
      school: {
        kind: 'enum',
        values: ['dutch', 'italian'],
        default: 'dutch',
        phrases: {
          dutch: 'Dutch Golden Age register — dark warm ground, domestic window light, earthy palette, the intimate observed realism of Rembrandt and Vermeer',
          italian: 'Italian Renaissance register — sfumato modeling, balanced idealized forms, warm Venetian color over drawing-first construction, in the lineage of Leonardo and Titian',
        },
      },
      drama: {
        kind: 'scale',
        default: 0.5,
        poles: ['soft daylight', 'deep tenebrism'],
        bands: [
          [0.3, 'soft daylight — even window light, gentle halftones, shadow stays readable'],
          [0.7, 'classic chiaroscuro — one strong source, deep but transparent shadow masses'],
          [1, 'deep tenebrism — candle-dark field, figures emerging from near-black, highlights burning small'],
        ],
      },
      patina: {
        kind: 'scale',
        default: 0.3,
        poles: ['fresh off the easel', 'aged museum surface'],
        bands: [
          [0.3, 'fresh surface — clean varnish, full pigment saturation'],
          [0.7, 'settled patina — warm amber varnish tone, gently softened contrast'],
          [1, 'aged museum surface — amber-dark varnish, fine craquelure, centuries-old canvas presence'],
        ],
      },
    },
  },

  // Edo-period Japanese woodblock print (Hokusai / Hiroshige lineage):
  // flat registered color planes inside a carved keyblock contour; bokashi
  // gradation is the ONE sanctioned gradient. Two dials: palette (nishiki
  // polychrome / aizuri all-blue / sumi monochrome) and weathering (fresh
  // impression <-> aged Edo print).
  'ukiyo-e': {
    name: 'ukiyo-e',
    style:
      'ukiyo-e woodblock print — flat registered color planes, carved keyblock outline, bokashi gradation, in the Edo-period Japanese print tradition',
    mood: 'poised, decorative, floating-world serenity',
    lighting: 'no cast light — form stated by contour and flat color; at most a bokashi band in sky or water',
    lock: [
      'flat color planes bounded by a confident carved keyblock contour line — no volumetric shading or Western chiaroscuro',
      'bokashi is the only gradient — smooth hand-wiped gradation reserved for sky, water, and ground bands',
      'colors sit side by side as separate registered blocks, never blended or glazed',
      'pattern stands in for texture — textiles, waves, clouds, and foliage render as stylized repeating motifs (seigaiha waves, karakusa scrolls)',
      'depth reads through overlap and color bands, not atmospheric haze',
    ],
    negative: [
      'no photorealistic rendering or 3D-render look',
      'no volumetric, painterly, or airbrushed shading',
      'no lens effects — no depth of field, bloom, or glow',
    ],
    dials: {
      palette: {
        kind: 'enum',
        values: ['nishiki', 'aizuri', 'sumi'],
        default: 'nishiki',
        phrases: {
          nishiki: 'full nishiki-e polychrome — a limited set of mineral and vegetal pigments (indigo, safflower red, ochre, sumi black) laid as flat registered blocks',
          aizuri: 'aizuri-e — the entire print in graded Prussian-blue blocks with a sumi black keyline',
          sumi: 'sumizuri-e — sumi black ink blocks only on paper; monochrome print',
        },
      },
      weathering: {
        kind: 'scale',
        default: 0.3,
        poles: ['fresh impression', 'aged Edo print'],
        bands: [
          [0.3, 'fresh impression — crisp registration, saturated pigment, clean paper'],
          [0.7, 'gently aged — warm-toned washi, slightly softened pigment'],
          [1, 'aged Edo print — toned washi, faded fugitive pigments, faint woodgrain and slight registration drift'],
        ],
      },
    },
  },

  // The maximum-fidelity register the rest of the shelf tunes AWAY from,
  // made deliberate and dialable instead of being the accidental default.
  // One medium dial spans the user's poles: photograph (real optics,
  // captured-not-made) <-> 3d-engine (high-end renderer output that is
  // proudly, clearly CG — AAA key-art polish).
  'photo-realism': {
    name: 'photo realism',
    style:
      'photorealistic image — maximum-fidelity rendering, positioned between true photographic capture and high-end CG by the medium dial',
    mood: 'grounded, believable, production-grade',
    lighting: 'physically plausible light — natural optics or PBR global illumination, per the medium register',
    lock: [
      'full photorealistic fidelity is the goal — this preset opts INTO the maximum-detail register the rest of the shelf tunes away from',
      'light behaves physically — real lens optics or physically-based rendering, as the medium dial positions it',
      'materials read true — skin, metal, fabric, and glass carry correct micro-detail for the chosen medium',
      'commit to the medium dial\'s position — no uncanny half-photo half-CG mixed register',
    ],
    negative: [
      'no illustration, ink, or painterly stylization',
      'no cartoon, cel, or comic rendering',
    ],
    dials: {
      medium: {
        kind: 'scale',
        default: 0.5,
        poles: ['photograph', '3d-engine'],
        bands: [
          [0.3, 'photograph register — real-world optics: natural lens rendering, believable light falloff, photographic grain and imperfection; looks captured, not made'],
          [0.7, 'cinematic hybrid register — photoreal materials under a produced, graded look; sits between capture and render'],
          [1, '3d-engine register — high-end renderer output, clearly CG and proud of it: immaculate PBR surfaces, ray-traced reflections and global illumination, engine-perfect geometry — AAA key-art polish'],
        ],
      },
    },
  },

  // Art nouveau (Mucha-to-Tiffany lineage): whiplash organic line, flat
  // decorative color, ornament as structure. The medium dial runs the
  // user's two poles — lithograph illustration <-> stained glass pane
  // (heavy leading, luminous back-lit color); a gilding dial adds the
  // period gold.
  'art-nouveau': {
    name: 'art nouveau',
    style:
      'art nouveau — whiplash organic line, flat decorative color inside firm contour, ornament as structure, in the Mucha-to-Tiffany lineage',
    mood: 'graceful, ornamental, reverent',
    lighting: 'decorative light — flat fields or translucent panes; never naturalistic cast shadow',
    lock: [
      'the whiplash line rules — long sinuous organic curves; hair, drapery, smoke, and stems flow into ornament',
      'flat decorative color held inside a firm dark contour; modeling minimal and stylized',
      'ornament is structural — botanical motifs, arcs, halos, and framing borders belong to the composition, not decoration added on top',
      'the period palette — muted florals: dusty rose, sage, ochre, cream, deep teal',
    ],
    negative: [
      'no photorealistic rendering or 3D-render look',
      'no airbrushed or painterly modeling',
      'no modern lens effects — no bloom, depth of field, or glow filters',
    ],
    dials: {
      medium: {
        kind: 'scale',
        default: 0.3,
        poles: ['illustration', 'glass-pane'],
        bands: [
          [0.3, 'illustration register — Mucha-manner lithograph poster: delicately modeled faces over flat ornamental fields, soft litho grain, fine gilded linework'],
          [0.7, 'leaded illustration register — poster composition with heavier contour leading and jewel-toned panes emerging'],
          [1, 'glass-pane register — stained glass: heavy dark leading divides the image into discrete translucent panes, luminous back-lit color, subtle glass texture and solder joints'],
        ],
      },
      gilding: {
        kind: 'enum',
        values: ['none', 'gold'],
        default: 'none',
        phrases: {
          none: 'no metallic accents',
          gold: 'gilded accents — gold halos, borders, and line highlights in the period manner',
        },
      },
    },
  },

  // East Asian brush painting: sumi ink on absorbent paper, the loaded
  // brush as the entire vocabulary. One register dial spans the user's two
  // poles — sumi-e (radical stroke economy, vast empty paper) <-> ink-wash
  // (layered tonal washes, misty graded depth); a tint dial allows the
  // pale literati mineral tints. Emptiness is composition: unpainted paper
  // must survive as air, water, and light.
  'ink-brush': {
    name: 'ink brush',
    style:
      'East Asian ink-brush painting — sumi ink on absorbent washi/xuan paper; brush stroke and water wash are the entire vocabulary',
    mood: 'contemplative, breathing, weightless',
    lighting: 'no depicted light — tonal ink gradation and empty paper carry all atmosphere',
    lock: [
      'the brush is the whole instrument — every mark is a loaded-brush stroke on absorbent paper; stroke count is meaningful, nothing is "filled in"',
      'ink tone comes from water — the classical shades from charged black to pale mist; no opaque grays',
      'emptiness is composition — unpainted paper reads as air, water, and light; leave it untouched',
      'edges live in the paper — wet-into-wet bleeds and dry-brush flying-white (kasure), never hard contours',
    ],
    negative: [
      'no photorealistic rendering or 3D-render look',
      'no hard digital lines or vector-crisp edges',
      'no opaque paint, heavy color, or filled backgrounds — untouched paper must remain',
    ],
    dials: {
      register: {
        kind: 'scale',
        default: 0.5,
        poles: ['sumi-e', 'ink-wash'],
        bands: [
          [0.3, 'sumi-e register — radical economy: a few decisive strokes, dry brush, vast untouched paper; the subject caught in a single gesture'],
          [0.7, 'balanced brush register — calligraphic strokes carry the forms while light washes settle atmosphere behind them'],
          [1, 'ink-wash register — layered tonal washes build misty graded depth; mountains and water dissolve into mist, strokes reserved for sharp accents'],
        ],
      },
      tint: {
        kind: 'enum',
        values: ['none', 'pale'],
        default: 'none',
        phrases: {
          none: 'pure ink — no color anywhere',
          pale: 'restrained pale mineral tints (ochre, indigo) breathing under the ink, in the literati manner',
        },
      },
    },
  },

  // Ancient-world artifact styles: the image behaves like a period
  // artifact, not a modern illustration OF antiquity. A tradition dial
  // picks the grammar (Egyptian tomb painting / Paleolithic cave painting /
  // Greco-Roman vase-and-fresco); a surface dial runs fresh commission ->
  // weathered ruin. Depth by convention (registers, overlap, scale
  // hierarchy) — never vanishing-point perspective. Glyph-like framing
  // marks stay decorative and non-legible (the no-readable-text doctrine
  // extends to inscriptions).
  antiquity: {
    name: 'antiquity',
    style:
      'ancient-world artifact style — the pictorial conventions of antiquity, made as the period itself would have made them',
    mood: 'timeless, ceremonial, monumental stillness',
    lighting: 'no depicted light source — flat pigment on a period surface; form carried by contour and convention',
    lock: [
      'the image IS a period artifact — period tools, mineral/earth pigments, and the tradition\'s own pictorial conventions; nothing anachronistic',
      'figures follow the tradition\'s canonical stylization, never naturalistic anatomy or Renaissance modeling',
      'depth by convention — registers, overlap, and hierarchical scale; no vanishing-point perspective, no atmospheric depth',
      'the period surface (wall, rock, vessel, plaster) stays present under the pigment',
      'glyph-like or inscription-like framing marks stay decorative and NON-LEGIBLE — no real writing',
    ],
    negative: [
      'no photorealistic rendering or 3D-render look',
      'no Renaissance-or-later shading — no chiaroscuro, no cast shadows, no modeled volume',
      'no modern digital gradients or lens effects',
      'no legible text or real inscriptions anywhere',
    ],
    dials: {
      tradition: {
        kind: 'enum',
        values: ['egyptian', 'cave', 'greco-roman'],
        default: 'egyptian',
        phrases: {
          egyptian: 'Egyptian tomb-painting register — composite view (head and legs in profile, shoulders frontal), hierarchical scale, figures arranged in horizontal registers on flat ochre ground, flat mineral color inside crisp contour, hieroglyph-like framing kept decorative',
          cave: 'Paleolithic cave-painting register — ochre, charcoal, and hematite on raw rock; animals and hunters as gestural silhouettes and confident outlines; hand stencils and dot marks; the rock face shows through everywhere',
          'greco-roman': 'Greco-Roman register — black-figure/red-figure vase profile drawing and Pompeiian fresco flats; poised contour-line figures, drapery in rhythmic parallel line, meander and acanthus border motifs',
        },
      },
      surface: {
        kind: 'scale',
        default: 0.5,
        poles: ['fresh commission', 'weathered ruin'],
        bands: [
          [0.3, 'fresh commission — intact surface, full saturated pigment'],
          [0.7, 'aged — worn pigment, hairline cracks, settled surface patina'],
          [1, 'weathered ruin — flaked and faded passages, missing fragments, the artifact half-reclaimed by time'],
        ],
      },
    },
  },

  // The foreign cousins of gpen-shonen / shojo-soft: American Silver Age
  // comics — brush-and-nib ink under the limited four-color newsprint
  // palette, Ben-Day dot tone. DELIBERATELY less locked than tv-cartoon
  // (a shorter lock, more latitude for the model). One register dial spans
  // the era's two newsstand poles: romance comics <-> pulp-hero four-color
  // heroics; a print dial carries the newsprint press character.
  'silver-age': {
    name: 'silver age',
    style:
      'silver-age American comic book — brush-inked figures over clean limited four-color flats',
    mood: 'earnest, melodramatic, newsstand vitality',
    lighting: 'ink-stated light — spot blacks and feathered hatching carry the shadows; color stays flat',
    lock: [
      'brush-and-nib ink over pencils — confident feathered strokes, spot blacks for drama; the ink line carries the drawing',
      'the limited four-color palette of the era — color sits under the ink as plain flat fields; Ben-Day dot tone only where a gradation is genuinely needed, and subtle in scale',
      'figures stay plain by default — ordinary builds and everyday styling unless the register asks for heroics',
    ],
    negative: [
      'no photorealistic rendering or 3D-render look',
      'no airbrushed or painterly shading — tone is dots and hatching',
      'no modern digital gradient color',
      'no blanket halftone, print-grain, or aging filter laid over the image',
    ],
    dials: {
      register: {
        kind: 'scale',
        default: 0.5,
        poles: ['romance', 'pulp-hero'],
        bands: [
          [0.3, 'romance register — golden/silver-era romance comics: glamour styling, expressive faces and tearful close-ups, soft brush lines, intimate staging'],
          [0.7, 'everyday register — plain-clothes figures with ordinary builds, grounded staging; drama carried in faces and gesture, not physique'],
          [1, 'pulp-hero register — four-color heroics: square-jawed heroes, foreshortened dynamic action, impact framing and Kirby-energy poses'],
        ],
      },
      print: {
        kind: 'scale',
        default: 0.3,
        poles: ['crisp press', 'aged newsprint'],
        bands: [
          [0.3, 'crisp press — clean registration, bright plain flats, white paper, print texture barely present'],
          [0.7, 'newsstand print — modest Ben-Day tone in places, slight registration drift, warm paper'],
          [1, 'aged newsprint — yellowed pulp paper, faded four-color inks, heavy dot gain and off-register bleed'],
        ],
      },
    },
  },

  // 80s TV cel animation, codified in comic form (motion lives elsewhere —
  // this is the era's ART STYLE as page discipline). The load-bearing
  // invariant: characters stay distinct via their outlines — outlined
  // cel-flat characters over softer painted backgrounds is the cel layer
  // separation itself. Modern finishing layers are welcome ON TOP, but
  // never at the cost of that separation. One dial: register, sitcom-family
  // pole <-> mutant-hero pole (heroes and muscles, held at animation-budget
  // fidelity — that restraint is the rule of the primitive).
  'tv-cartoon': {
    name: 'TV cartoon',
    style:
      '80s television cel-animation style in comic form — outlined cel-flat characters over painted backgrounds, saturated broadcast-era palette',
    mood: 'energetic saturday-morning broadcast warmth',
    lighting: 'flat cel lighting — one shadow tone and one highlight tone per fill; atmosphere lives in the painted background',
    lock: [
      'CHARACTERS STAY DISTINCT VIA THEIR OUTLINES — every character carries a continuous, even-weight cel outline that separates them cleanly from the background at all times',
      'cel discipline on characters: flat paint fills with at most one shadow tone and one highlight tone (the two-tone cel shade)',
      'backgrounds are the painted layer — softer gouache-style environments WITHOUT outlines, so the outlined characters pop in front',
      'era palette: saturated 80s broadcast color — bold primaries and confident secondaries, tuned like a period title card',
      'animation-budget fidelity is the rule: economy of line, simplified detail, silhouettes readable at broadcast resolution — never over-rendered',
      'modern finishing (a subtle grade or glow) may sit on top, but never at the cost of the outline separation',
    ],
    negative: [
      'no photorealistic rendering or 3D-render look',
      'no painterly rendering on characters — cel flats only; painted texture belongs to the background layer',
      'no outline-less characters, and no outlines that merge into the background',
      'no dense comic-book ink shading or crosshatching',
    ],
    dials: {
      register: {
        kind: 'scale',
        default: 0.5,
        poles: ['sitcom-family', 'mutant-hero'],
        bands: [
          [0.3, 'sitcom-family register — rounded everyday character designs, domestic staging, gag timing; expressions and posture do the work'],
          [0.7, 'saturday-action register — adventure staging, capable everyday heroes, action posed in clean readable silhouettes'],
          [1, 'mutant-hero register — heroic anatomy, muscles and costumes, dynamic action poses, held at animation-budget fidelity: clean shapes, simplified musculature, nothing hyper-rendered'],
        ],
      },
    },
  },

  // Classical rubber-hose cartoon: noodle-cylinder bodies, simple eyes,
  // transformative expressions.
  steamboat: {
    name: 'steamboat',
    style:
      'steamboat classical cartoon — rubber-hose ink style: noodle-limb cylinder bodies, simple rounded geometry, thick even outlines, flat fills',
    mood: 'buoyant, elastic, vaudeville energy',
    lighting: 'flat cel lighting — at most one simple shade tone per fill',
    lock: [
      'bodies are bendy cylinders and noodle limbs — no anatomical joints or musculature; hands are simple mitts',
      'eyes stay simple (dots or pie-cut) but expressions are transformative — faces and bodies squash, stretch, and deform to carry emotion',
      'thick uniform ink outline around every shape; flat color fills',
    ],
    negative: [
      'no realistic anatomy or proportions',
      'no rendered or painterly shading',
      'no photorealism',
    ],
    dials: {},
  },
};

export const STYLE_PRESETS = Object.keys(STYLE_VOCAB);

export function isStylePreset(preset) {
  return Object.prototype.hasOwnProperty.call(STYLE_VOCAB, preset);
}

export function styleEntry(preset) {
  const entry = STYLE_VOCAB[preset];
  if (!entry) throw new Error(`unknown style preset: ${preset} (one of: ${STYLE_PRESETS.join(', ')})`);
  return { preset, ...entry };
}

/** Validate caller dials against the entry's dial spec and fill defaults. */
export function normalizeStyleDials(preset, dials) {
  const entry = styleEntry(preset);
  const spec = entry.dials;
  const input = dials ?? {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`style preset '${preset}': dials must be an object`);
  }
  for (const key of Object.keys(input)) {
    if (!spec[key]) {
      throw new Error(`style preset '${preset}': unknown dial '${key}' (one of: ${Object.keys(spec).join(', ') || 'none'})`);
    }
  }
  const out = {};
  for (const [key, dial] of Object.entries(spec)) {
    const value = input[key] ?? dial.default;
    if (dial.kind === 'scale') {
      if (!(Number.isFinite(value) && value >= 0 && value <= 1)) {
        throw new Error(`style preset '${preset}': dial '${key}' must be a number in [0, 1] (${dial.poles[0]} → ${dial.poles[1]})`);
      }
    } else if (dial.kind === 'enum') {
      if (!dial.values.includes(value)) {
        throw new Error(`style preset '${preset}': dial '${key}' must be one of: ${dial.values.join(', ')}`);
      }
    }
    out[key] = value;
  }
  return out;
}

function dialPhrase(dial, value) {
  if (dial.kind === 'scale') {
    for (const [threshold, phrase] of dial.bands) {
      if (value <= threshold) return phrase;
    }
    return dial.bands[dial.bands.length - 1][1];
  }
  return dial.phrases[value];
}

/**
 * Resolve a preset + dial values into brief material: defaults for
 * style/mood/lighting, the Style Lock lines (entry lock + one phrased line
 * per dial), and the negative additions. Pure; same inputs → same output.
 */
export function resolveStyle(preset, dials) {
  const entry = styleEntry(preset);
  const normalizedDials = normalizeStyleDials(preset, dials);
  const lock = [...entry.lock];
  for (const [key, dial] of Object.entries(entry.dials)) {
    lock.push(`${key}: ${dialPhrase(dial, normalizedDials[key])}`);
  }
  return {
    preset,
    name: entry.name,
    style: entry.style,
    mood: entry.mood,
    lighting: entry.lighting,
    lock,
    negative: [...entry.negative],
    dials: normalizedDials,
  };
}

// A small, dependency-free deterministic hash (djb2 → base36) for the styleId
// token. Not cryptographic — only needs to be stable + collision-light across
// the style material an agent authors.
function shortHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * The shared-source TOKEN for a resolved style. Two surfaces are "the same
 * style" iff their styleId matches — this is what makes scene cohesion
 * load-bearing (the plate inherits the cast's styleId), with no post-hoc check.
 * Deterministic: same style material → same token.
 */
export function computeStyleId({ preset, dials, id, material, hasOverrides }) {
  if (preset) {
    const dialStr = dials && Object.keys(dials).length
      ? '#' + Object.keys(dials).sort().map((k) => `${k}=${dials[k]}`).join(',')
      : '';
    return `${preset}${dialStr}${hasOverrides ? `+ovr:${shortHash(material || '')}` : ''}`;
  }
  if (id) return `custom:${id}`;
  if (material) return `custom#${shortHash(material)}`;
  return 'freeform';
}

/**
 * Resolve a full style BRIEF into carry-through material — the shared door for
 * presets (templates), preset+overrides (fork a template), and fully inline
 * CUSTOM styles ({ id, style, mood, lighting, lock[], negative[] }, no preset).
 * Returns { preset?, dials?, id?, styleId, style, mood, lighting, lock[],
 * negative[] }. `defaults` supplies style/mood/lighting/negative when the brief
 * leaves them unset. mustPreserve/mayInvent stay with the caller (kind-specific).
 * Pure; same inputs → same output. This is the MCP-authorable style path — the
 * STYLE_VOCAB presets are templates to start from, never a closed gate.
 */
export function resolveStyleMaterial(brief, defaults = {}) {
  const b = brief || {};
  const ov = b.overrides || {};
  const hasOverrides = !!b.overrides && Object.keys(ov).length > 0;
  const resolved = b.preset != null ? resolveStyle(b.preset, b.dials) : null;

  const style = ov.style || b.style || resolved?.style || defaults.style;
  const mood = ov.mood || b.mood || resolved?.mood || defaults.mood;
  const lighting = ov.lighting || b.lighting || resolved?.lighting || defaults.lighting;

  // Lock = the preset's resolved discipline + fork/custom lines. With a preset,
  // extra lines come ONLY from `overrides.lock` (the explicit fork channel) — a
  // top-level `lock` is the AUTHORED lock only for a fully custom style (no
  // preset). This keeps re-normalization idempotent: a stored brief carries the
  // resolved preset lock in `lock`, which must NOT be re-appended.
  const customLock = resolved ? [] : (Array.isArray(b.lock) ? b.lock : []);
  const overrideLock = Array.isArray(ov.lock) ? ov.lock : [];
  const lock = [...(resolved ? resolved.lock : []), ...customLock, ...overrideLock];

  // Negatives = declared (brief.negative REPLACES defaults) ∪ preset negatives ∪ overrides.
  const baseNeg = b.negative || ov.negative || defaults.negative || [];
  const negSet = new Set(Array.isArray(baseNeg) ? baseNeg : []);
  if (resolved) resolved.negative.forEach((n) => negSet.add(n));
  if (Array.isArray(ov.negative)) ov.negative.forEach((n) => negSet.add(n));
  const negative = [...negSet];

  const styleId = computeStyleId({
    preset: resolved?.preset,
    dials: resolved?.dials,
    id: b.id,
    hasOverrides,
    // material folded into the token so overrides/custom variants get distinct ids
    material: JSON.stringify([style, mood, lighting, lock, negative]),
  });

  return {
    ...(resolved ? { preset: resolved.preset, dials: resolved.dials } : {}),
    ...(b.id ? { id: String(b.id) } : {}),
    styleId,
    style,
    mood,
    lighting,
    lock,
    negative,
  };
}
