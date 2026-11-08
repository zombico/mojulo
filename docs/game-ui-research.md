# Game UI breaks the SaaS grid on purpose

The hypothesis is mostly right, with one correction. Game UI's **sizing and hierarchy rules really are different** from the look LLMs produce. Type is sized as a share of screen height, and its floor is close to twice web body text: Xbox's guideline is **26 px body text at 1080p on console**, where the web uses 14 to 16 px. Hierarchy uses a few levels with large jumps, one hero element and one saturated accent against a dimmed scene. The SaaS look builds hierarchy from small ratio steps and grey values. **Spacing differs at the level of the whole screen.** A HUD or menu is one fixed frame, and its space goes to edge-anchored clusters around an open centre inside a 90% title-safe area. It is not a scrolling rhythm of 4 px multiples. Inside a panel, though, games are as tight and as gridded as any dashboard. The correction is this: what LLMs emit is **not the Swiss style but a token file boiled down from it**, namely Tailwind's 4 px unit and gentle type ramp and shadcn's achromatic greys and single 10 px radius. Real Swiss posters had the very scale contrast that games use. Games keep app usability as a floor (feedback within 0.1 s, 4.5:1 text contrast). On top of it they add a second axis, made of emotion, fiction and ceremony, carried by material frames, motion that overshoots and a sound for every input. mana-ui already holds much of the game vocabulary in its theme words: the ▶ marker, snap motion, slam banners, glyph legends and per-seat cursors. Its skeleton is still SaaS: a fixed 14 px body, 11 px grey tracked eyebrow headings, 1 px hairlines, a 2 px focus ring, ease-out fades, no sound, no exits and no tickers. The changes that matter most for the `1108-game-ui-theme-hardening` branch are structural, not cosmetic:

- a type unit tied to screen height, with a floor set by viewing distance
- a legend bar pinned to the bottom
- sound cues the runtime emits
- a halo-or-plate rule for text over the world
- a game-like default motion in the bridges
- choreographed title and results screens

Each fits within the closed theme words, the greybox defaults, the self-contained kernel and the no-device rule. Each can land now, because no shipped page emits mana-ui yet.


> **Where this stands.** This is the research behind the game UI theme hardening of mana-ui (`docs/mana-ui.md`). Its
> P0 rows have landed: the stage unit and the `distance` word, the title-safe frame, the collapsed type ramp, the `halo`,
> the legend bar, the UI's sounds as effects (`cues`), the ▶ as the greybox focus and the `bar` focus, and the rebuilt
> title and attract screens. So have its P1 rows: the juice register and the broadcast's slant in the bridges, `slant`,
> the `transition` cover between screens, count-up numbers with a skip, the results sequence, damage pops, two tiers of
> toasts and the achievement toast, frame weight by level, labels in the ink, pad repeat in the controls host, the flash
> guard and a less-flash channel. The P2 rows below are the work still ahead. The `file:line` references are the
> audit's, from before P0, and have moved since.

## How to read the evidence in this report

The research notes behind this report (not kept in the repository) were written in sessions where **page fetches were blocked by network policy** for most primary hosts: learn.microsoft.com, devdocs.xbox.com, gameaccessibilityguidelines.com, gamedeveloper.com, m3.material.io and most press sites. Most citations below therefore rest on **search-result summaries of the linked pages, not full reads**. The exceptions are the Tailwind v4 theme, the shadcn/ui tokens and Anthropic's frontend-design skill. Those were read from source on raw.githubusercontent.com. The mana-ui audit is a code read of this repo dated 2026-11-08. I spot-checked its line numbers against the tree, and they hold.

Claims are labelled by kind:

| Label | Meaning |
|---|---|
| **[sourced]** | A fact or number from a cited page (usually via search summary) |
| **[intent]** | A designer's stated intent, quoted or paraphrased by the cited outlet |
| **[convention]** | Practitioner convention or researcher synthesis: widely seen in shipped games, but not cited in these sessions |
| **[estimate]** | A starting value from general practice, with no source. Tune it on the board; do not treat it as a standard |

Before any of these numbers is pinned in code or tests, **check it against the primary page**. Doing so matters most for:

- the XAG 101, 102, 104 and 118 tables. The 26 px body figure competes with a circulating 28 px figure.
- the Material 3 duration and easing tokens. Only some values were seen, through community ports.
- the Xbox safe-area figures. Action-safe is quoted as 93% (broadcast) and as 95% (Xbox's 4K guidance).

The screen-anatomy timings (stings, toasts, count-ups, press-start pulses) have **no primary source at all** in these notes. Every one of them is an estimate.

## The LLM default is diluted Swiss, and games restore the poster half

The International Typographic Style stressed "simplicity, clarity, readability, and objectivity." Its tools were grids, asymmetric layouts, neutral grotesques such as Akzidenz-Grotesk and Helvetica, and flush-left, ragged-right text ([Wikipedia](https://en.wikipedia.org/wiki/International_Typographic_Style)) **[sourced]**. The SaaS look that LLMs produce keeps the parts that scale to a design system and drops the rest. Tailwind v4 ships a **4 px spacing unit**. Its type steps run 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 px and up, so neighbouring steps in the body range sit only about 1.11 to 1.33 apart. Its radii run 2 to 32 px, and its `shadow-sm` is a pair of 10%-alpha black blurs at offsets of 1 to 3 px ([Tailwind theme.css](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/main/packages/tailwindcss/theme.css)) **[sourced, read from source]**. shadcn/ui puts **one 10 px radius on everything** and a fully achromatic OKLCH palette (chroma 0). Muted foreground is `oklch(0.556 0 0)`, and the dark-mode border is a 10%-alpha white hairline ([shadcn globals.css](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/app/globals.css)) **[sourced, read from source]**. Anthropic's own frontend-design skill now calls the results "defaults rather than choices": "content chopped into identical rounded cards, one border-radius on everything regardless of hierarchy," "Using all caps for labels," and "fade-and-slide-up entrances on each section" ([SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md)) **[sourced]**. Practitioners say the cause is training data: most modern UI code online is Tailwind plus shadcn, so "the model's 'default' is effectively those defaults" ([tyloch blog](https://tyloch-biz-hugo.pages.dev/posts/stop-ai-ui-looking-ai-generated/)). That cause is **asserted, not measured**. No study of LLM UI homogeneity turned up.

The distinction matters for the branch. A Müller-Brockmann concert poster has more scale contrast and more diagonal energy than any dashboard. Much of what reads as "game" is the poster half of Swiss design coming back: huge type against small type, one strong colour, a line that leads the eye. What games reject is the *document* half. The SaaS defaults are tuned for content of unknown length, scrolling, arm's-length reading, hours of calm use and a blank background. A game screen breaks every one of those conditions **[convention]**.

| Trait | Swiss poster (1950s–60s) | SaaS/LLM default | Game UI |
|---|---|---|---|
| Scale contrast | Extreme (headline vs body) | Gentle (1.125–1.25 steps) | Extreme (hero at 3–6× label) **[convention]** |
| Grid | Strict, asymmetric | Strict, 4 px rhythm, reflowing | Safe-area anchors; grids inside panels |
| Colour | One strong colour plus black/white | Achromatic greys, one blue accent | One signature hue plus fixed semantic colours |
| Type | Neutral grotesque | Neutral grotesque (system/Inter) | Two registers: a sturdy functional face and a display face that carries voice |
| Surface | Flat print | Flat, soft 10%-alpha shadows | Material: ink, metal, glass, paper, CRT |
| Medium | A fixed sheet | A scrolling document | A fixed frame over a moving scene |

## Games move friction out of the interface and into the challenge

The deepest difference is purpose, and every visual rule follows from it. Celia Hodent built the framework used during Fortnite's development, and it has two pillars. **Usability** covers "human limitations in terms of perception, attention, and memory", with components such as signs and feedback, form follows function, minimum workload and accessibility. She says this pillar is "close to the heuristics used in other industries." **Engage-ability** rests on motivation, emotion and game flow ([Pocket Gamer.biz](https://www.pocketgamer.biz/celia-hodent-on-the-importance-of-cognitive-science-and-a-ux-framework-to-improve-your-game); [Designative](https://www.designative.info/2019/03/28/the-ux-of-fortnite-celia-hodent/)) **[sourced]**. In her words, "We don't play video games to accomplish a task as we would with software and many apps" ([IxDF](https://ixdf.org/literature/topics/game-ux)) **[intent, secondary]**. The academic heuristics take the same shape. Federoff (2002), HEP (2004), Pinelle et al. (2008, mined from reviews of 108 PC games) and PLAY (2009) all start from Nielsen and then add gameplay, story and mechanics categories that productivity heuristics never had ([ResearchGate, Pinelle](https://www.researchgate.net/publication/200553264_Heuristic_evaluation_for_games_Usability_principles_for_video_game_design); [Semantic Scholar, PLAY](https://www.semanticscholar.org/paper/Game-Usability-Heuristics-(PLAY)-for-Evaluating-and-Desurvire-Wiberg/f3c116678ad19784b4db8c11b26eaaef8dac48f5)) **[sourced]**. The test that separates the two kinds of friction is whether players struggle "with the intentional challenge" or "with the design" ([IxDF](https://ixdf.org/literature/article/why-you-ll-frustrate-players-on-purpose-and-when-you-shouldn-t)) **[sourced, secondary]**.

The designers on record go further and treat the interface as part of the fiction. Persona 5's UI lead Masayoshi Suto says he once treated UI as information layout and now treats it as "graphical entertainment" meant to surprise players ([DT Next/NYT](https://www.dtnext.in/edit/exuberant-video-game-menus-designed-with-da-vinci-in-mind-807823)). Colour came first in building the UI ([Persona Central, CEDEC 2017](https://personacentral.com/persona-5-panel-concept-development-ui/)). Dead Space's Dino Ignacio wanted UI inside the world, "something tangible," and criticised dropdowns as an assumed default ([Kill Screen](https://www.killscreen.com/how-dead-space-3-pulled-dieter-rams-and-instagram/)). Sucker Punch replaced Ghost of Tsushima's minimap with the Guiding Wind, so that players stay "tied into the beauty of Tsushima instead of playing it like a video game." Jason Connell warned that removing HUD makes "the design problem harder" ([TechRadar](https://www.techradar.com/news/ghost-of-tsushima-interview-nature-sprawls-in-ps4s-epic-samurai-swan-song)). All of these are **[intent]**. The cost is acknowledged too. Katsura Hashino says Atlus's menus each run "a whole separate program," that the process is "extremely inefficient," and that Persona 5's menus "[were] impossible to read at first, so we did lots of tweaking" ([PC Gamer](https://pcgamer.com/games/rpg/persona-series-director-says-atluss-flashy-menus-are-actually-really-annoying-to-design); [GamesRadar](https://www.gamesradar.com/games/jrpg/persona-director-and-jrpg-veteran-says-the-amazing-menus-in-metaphor-refantazio-were-really-annoying-to-make-just-as-persona-5s-were-impossible-to-read-at-first)) **[intent]**.

Every one of these departures keeps the usability floor. Dead Space added a floor locator after its diegetic map failed navigation testing ([Beyond the HUD summary, Packt](https://www.oreilly.com/library/view/mastering-ui-development/9781787125520/78296d1f-f5be-4af9-8ed6-b47ece9c8bda.xhtml)). Persona was re-tuned until it was legible, and Tsushima kept its map screen **[sourced]**. For mana-ui this argues for **two tiers of rules**. Legibility, feedback latency, focus visibility and a fallback path are hard rules, measured by the machine gate. Ceremony, fiction and material are words a game opts into **[convention]**.

| Concern | App/SaaS does | Game does | Why |
|---|---|---|---|
| Goal | Finish a task, keep time-to-completion low | Make the player feel something; the challenge is designed | Play is for pleasure, not output (Hodent) **[intent]** |
| Interface stance | Neutral and invisible | Part of the fiction, the brand and the voice | Suto, Ignacio, Ise **[intent]** |
| Efficiency | Always maximised | Traded for ceremony at known moments | The engage-ability pillar **[sourced]** |
| Usability floor | The whole job | Kept as a floor, then tested back in | Dead Space locator, Persona legibility pass **[sourced]** |
| Templating | One component kit | Per-screen layouts (list, grid, dial) | Atlus, Metaphor **[intent]** |
| Ownership | Product designer | UX designer for the wireframe, then a UI artist to the art bible | Studio role split ([Nasty Rodent](https://nastyrodent.com/game-ui-vs-ux/)) **[sourced, secondary]** |

The studio pipeline matches mana-ui's own layering closely. In studios, wireframe and flow are approved before visual polish, then a UI artist styles them to the art bible ([Nasty Rodent](https://nastyrodent.com/game-ui-vs-ux/); [Zach Gamedev](https://zachgamedev.com/2023/08/19/ui-design-101-the-ui-pipeline/)) **[sourced, secondary]**. That is mana-ui's greybox and theme split. Web technology is a shipped game-UI substrate. Coherent Gameface runs HTML/CSS/JS for Civilization VII, but as a **performance subset with flex-only layout, not a browser** ([Gameface docs](https://docs.coherent-labs.com/cpp-gameface/what_is_gfp/overview/)) **[sourced]**. That supports keeping mana-ui away from document-flow and scrolling-page patterns.

## Every school answers one question: what is this panel made of?

The style schools differ in hue, shape and motion, but each starts from the same question: what material is the UI made of? The answer is drawn from the world, and the parameters follow from it. The table below separates what designers stated from what the researcher saw in the games. The traits in the right-hand columns are mostly **[convention]**, and they should be checked against screenshots (Game UI Database, Interface In Game) before any of them becomes a preset.

| School | Stated or sourced anchor | Signature traits (mostly [convention]) |
|---|---|---|
| Classic JRPG window-box (DQ, FF) | FFVII lets the player set the window colour on all four corners, defaulting to blue ([FF Wiki](https://breezewiki.discard.no/finalfantasy/wiki/Config)) **[sourced]** | An opaque framed box, a ▶ or gloved-hand cursor, cascading windows, text that types out with a blip per character |
| Atlus (P5, P3R, Metaphor) | P5 uses red only, with sub-colours only in HP/MP, and a central line to guide the gaze ([Siliconera](https://www.siliconera.com/?p=668266)). P3R is built on Persona 3's blue and the theme of water and bubbles ([Automaton](https://automaton-media.com/en/news/20240207-26873/)). P5's lettering was inspired by ransom-note record covers **[intent]** | Skewed spines, irregular cut polygons, posed 3D characters in the menus, whip-cut wipes, a different layout for each menu depth |
| Fighting/arcade | SF6's UI follows hip-hop and graffiti, with paint tied to the Drive Gauge ([EventHubs](https://www.eventhubs.com/news/2022/jul/09/sf6-influence-hip-hop-graffiti)). Its HUD style became player-selectable in December 2025 ([Push Square](https://www.pushsquare.com/news/2025/12/street-fighter-6s-new-battle-hud-setting-on-ps5-ps4-is-so-simple-yet-so-fun)) **[sourced]** | Mirrored top bars, a centre timer, segmented super gauges, slam banners (ROUND 1, K.O.), a VS split |
| Nintendo | Sakurai: icons, colour and short words over text, legible to children ([Source Gaming](https://sourcegaming.info/2016/06/07/rethinking-your-menus-sakurais-famitsu-column-vol-138/)) **[intent]** | Splatoon ink drips and team colour pairs, Smash's slanted tiles, BotW's near-invisible slate, Animal Crossing's soft pills |
| Western diegetic minimal | Dead Space's RIG and Tsushima's wind **[intent]** | HUD on the body or in the world, fade-after-use, foley-like sound, nothing slams |
| Sci-fi FUI | Destiny avoids UI "as a design crutch" and chose a free cursor ([GDC Vault](https://gdcvault.com/play/1023460/)) **[intent]** | Hairlines, corner brackets, mono numerals, micro-labels, hex cells, glitch cuts |
| Dark fantasy | Elden Ring keeps ornate type "reserved for impact" ([Made Good Designs](https://madegooddesigns.com/fromsoftware-font/)) **[sourced, low authority]** | Sparse serif, black vignette, "YOU DIED" in red serif on a band, carved or filigree frames |
| Gacha anime-tech | ZZZ is "maximally stylized but fairly easy to navigate" ([Cover Story PH](https://coverstory.ph/2024/07/28/zenless-zone-zero-is-right-up-an-amateur-gamers-alley/)) **[sourced, review]** | A rarity colour ladder, theatrical pull reveals, staggered reward tiles with a shimmer sweep |
| Indie material metaphor | Hades II posts ask for menu background loops and screen transitions ([Supergiant](https://www.supergiantgames.com/blog/job-opportunity-ui-illustrator-for-hades-ii)). Hi-Fi Rush's UI animation moves on the beat ([Vice](https://vice.com/en/article/88qyw5/how-a-designer-known-for-horror-made-the-musical-gaming-triumph-hi-fi-rush)). Balatro works to self-imposed palette rules ([Playday](https://playday.one/2024/03/09/there-is-a-lot-more-design-to-explore-within-balatro-an-interview-with-localthunk/)) **[intent]** | One medium carried through every screen: painted vase, CRT casino, beat comic, hand-inked notebook |
| Sports and racing broadcast | No designer source found | Score bugs, lower thirds, replay stingers, italic numerals, combo-like skill chains |

Three cross-cutting facts matter for a runtime. First, **a signature hue owns the game**, and the only other colours are semantic: HP/MP in Persona, rarity ladders elsewhere. App UI spreads neutral greys and adds a blue accent. Second, **in-game registers are a shipped pattern**: FFVII's window colour, FFXIV's "Clear Blue" theme ([TheGamer](https://www.thegamer.com/final-fantasy-14-new-ui-7-remake-blue/)) and SF6's selectable HUD **[sourced]**. That supports mana-ui's theme-as-closed-words design. Third, **diagonal energy** (skewed parallelograms in Smash, Overwatch, P5 and Apex) appears in almost every school except the diegetic and the classic window-box **[convention]**. mana-ui cannot express a skew today.

## Principle by principle, the jumps are bigger and the frame is fixed

The table gives the contrast for each principle. The paragraphs after it carry the numbers and the caveats.

| Principle | App/SaaS does | Game does | Why | Basis |
|---|---|---|---|---|
| Sizing | Fixed px, 14–16 px body, reflow by breakpoint | A reference canvas (often 1920×1080) scaled uniformly; floors at 1080p: 26 px console, 18 px PC/VR | Viewing distance (10 ft vs 2 ft); a fixed frame | XAG 101 **[sourced, verify]**; canvas scaling **[convention]** |
| Hierarchy | Many levels, 1.125–1.25 steps, weight and grey | Few levels, 2×+ jumps, one hero element, brightness or accent against a dimmed scene | Grey steps turn to noise over a moving scene | Persona's single red **[sourced]**; ratios **[convention]** |
| Spacing | 4/8 px rhythm repeated down a page | Allocation in one frame: tight inside clusters, wide gaps between them, centre left open, inside title-safe | No scroll; the centre belongs to play | Safe areas **[sourced]**; allocation **[convention]** |
| Typography | One neutral grotesque at all sizes | Two registers: a sturdy functional face (often condensed) and a display face as image; outline, halo or plate over the world | Unknown backgrounds; voice | GAG, Godot docs **[sourced]**; registers **[convention]** |
| Colour | Achromatic greys, one accent, soft shadows | A world palette, one or two dominant hues, fixed semantic colours (rarity, HP/MP), glows and scrims | Fiction, peripheral reading | Persona, WoW rarity **[sourced]** |
| Shape/framing | One radius, 1 px 10%-alpha border | A material frame that varies with hierarchy: chamfer, nine-slice ornament, brush, brackets | The frame says which world the panel comes from | shadcn, Anthropic skill **[sourced]**; game frames **[convention]** |
| Texture | Removed | Grain, halftone, scanlines, parchment as a material channel | Places the panel in the world | **[convention]** |
| Motion | 150–300 ms decelerate, no overshoot, springs critically damped | Overshoot and elastic, slams, multi-beat ceremonies, shake, tickers, hit-stop | Feel and reward; mode changes are announced | M3 **[sourced, verify]**; Smash hitlag **[sourced]** |
| Sound | Mostly silent | A cue for every input, one sonic family | Menu navigation is abstract, and sound makes it legible | Morphic, bugnet **[sourced, secondary]** |
| Input/focus | Mouse hover, tab-order ring, a modal with an X | Always one focused element, d-pad neighbours, shoulder-button tabs, Back pops a layer, glyph legend, hold-to-confirm | No pointer; couch; controller | CommonUI **[sourced]**; Destiny hold **[sourced]**; rules **[convention]** |

### Sizing: game type follows screen height and a viewing distance

The Xbox Accessibility Guideline 101 table gives a minimum body text height of **26 px for console at 1080p, 52 px at 4K, and 18 px for PC/VR at 1080p** ([XAG 101 deep dive](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-101-text-display.md)) **[sourced, search summary; verify]**. The height is measured from the lowest descender to the highest ascender, not as x-height or cap height. So **CSS `font-size` and XAG "height" are not the same number**, and the check has to be made per face. A **28 px figure** also circulates. The Game Accessibility Guidelines site attributes it to Amazon's 10-foot TV guidance ([GAG](https://gameaccessibilityguidelines.com/?p=3285)). Microsoft's GDK handheld guidance sets a **14 px floor at 1920×1080, with 18 px recommended** ([Microsoft](https://learn.microsoft.com/en-us/gaming/gdk/docs/gdk-dev/pc-dev/handheld/handheld-guidelines-and-testcases)) **[sourced]**. XAG also expects text to scale to **at least 200%** of the default ([XAG 104](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/104)) **[sourced, verify]**. Starfield drew public criticism for "abysmally small" UI text ([Yahoo/GamesRadar](https://malaysia.news.yahoo.com/starfield-taking-heat-accessibility-advocates-234002072.html)). The 26-versus-18 split is the 10-foot versus 2-foot distance written as a rule, and 52 px at 4K shows that size scales with a 1080p reference. As a share of height, **26/1080 is about 2.4% and 18/1080 about 1.7%**. mana-ui's 14 px body is **about 1.3%** of a 1080p screen. That is roughly half the console floor, and below even the handheld recommendation.

### Hierarchy: fewer levels, bigger jumps, one hero

Persona 5 holds to one dominant red with "no sub-colours except in the HP/MP elements." It puts information on the side of the screen that is mostly white, and it changes layout and angle with menu depth so the player can tell how deep they are ([Siliconera](https://www.siliconera.com/?p=668266); [Famitsu](https://www.famitsu.com/news/201711/13145540.html)) **[sourced]**. Anthropic's skill states the general rule: "Let one element be the memorable thing, keep everything around it quiet and disciplined" ([SKILL.md](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md)). The synthesis to harden is **[convention]**: rank by scale first, then by brightness or accent, then by position. **Never rank by grey value alone.** Each screen gets at most one hero. A hero sits at 3 to 6× label size, body text sits at the floor, and almost nothing sits in between. XAG 102 supports this. Text from **52 px at 1080p** counts as large and may use 3:1 contrast, while standard text needs 4.5:1 and high-contrast modes need 7:1 ([XAG 102](https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-102-contrast.md)) **[sourced, verify]**. So titles and banners can be bold in colour, while body text and HUD numbers cannot. These ratios match what mana-ui's `themeAdvice` already checks (ink/panel ≥ 4.5, mid ≥ 3).

### Spacing: the hypothesis holds for the frame, not the panel

Xbox's title-safe area is the **inner 90% (1720×1000 at 1080p)**, and Microsoft warns that persistent system UI may sit at the edges. Action-safe at 4K is the **inner 95%** ([Xbox screen areas](https://devdocs.xbox.com/build/core-features/graphics/overviews/screen-areas)). The broadcast origin, SMPTE ST 2046-1, gives 93% action and 90% title, and Unreal's TV safe-zone tool defaults to 0.9 ([Unreal](https://dev.epicgames.com/documentation/unreal-engine/setting-up-tv-safe-zone-debugging-in-unreal-engine)) **[sourced, verify; the 93/95 conflict is unresolved]**. Inside that frame, HUD elements cluster at corners and edges, the centre stays open for play, and the gaps between clusters run to tens of percent of the screen, while spacing inside a cluster is tight **[convention]**. Corner use is genre-dependent. Caroux and Isbister found HUD composition affects experience differently by expertise and genre ([HAL preprint](https://hal.archives-ouvertes.fr/hal-01455547/file/Caroux&Isbister-IJHCS-InPress-PrePrint.pdf)), and eye-tracking studies conflict ([JAIC review](https://jurnal.polibatam.ac.id/index.php/JAIC/article/view/13341)) **[sourced]**. No "optimal corner" exists. So a runtime should offer anchors, not prescribe one layout. Here is where the hypothesis fails: games **keep grids**, in inventory grids, skill trees, safe-area margins and alignment columns. Breaking the grid is deliberate and local, such as a character overlapping a panel edge **[convention]**. No source documents a game spacing scale. Any spacing number in this report is synthesis.

### Typography: two registers, and nothing over the world goes bare

The Game Accessibility Guidelines say: "Ideally place your text and UI elements on a plain high contrast background, or where that is not possible, use prominent outlines and shadows" ([GAG](https://gameaccessibilityguidelines.com/provide-high-contrast-between-text-ui-and-background)). Godot's docs say outlines and shadows help "when the background color isn't known in advance" ([godot-docs PR 8410](https://github.com/godotengine/godot-docs/pull/8410/files)) **[sourced]**. One practitioner found a plain drop shadow on a HUD looked dated, and that blur or glow halos worked better ([Leadwerks](https://www.leadwerks.com/community/blogs/entry/591-improving-hud-readability)) **[sourced, anecdote]**. For subtitles, GAG recommends **at least 46 px at 1080p, at most 40 characters a line and at most two lines, on a solid or semi-opaque plate** ([GAG](https://gameaccessibilityguidelines.com/if-any-subtitles-captions-are-used-present-them-in-a-clear-easy-to-read-way/)). XAG 104 asks for **player-adjustable background opacity from 0 to 100%** ([XAG 104](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/104)) **[sourced, verify]**. Contrast against a moving 3D scene cannot be measured, so the standards ask for a **backing plate or a halo** instead. That gives mana-ui a measurable rule: contrast against its own plate, and a halo by default for any text not on an opaque plate.

One nuance cuts against the anti-slop checklist. All-caps tracked labels are an "AI tell" on the web, but they are native to the military, sci-fi and sports registers in games. The rule to harden is that caps and tracking belong on **short labels and display lines in a face that carries voice**, never on a neutral grotesque as a reflex **[convention]**.

### Colour, shape and texture: the frame does narrative work

Rarity colour came from Angband through Diablo. World of Warcraft fixed the ladder most games copy: grey, white, green, blue, purple, orange ([Game Informer](https://gameinformer.com/2019/05/18/the-surprising-origins-of-loot-rarity-colors); [Wikipedia](https://en.wikipedia.org/wiki/Loot_(video_games))) **[sourced]**. Semantic colours are fixed and never used as decoration, and colour-blind safety pairs each hue with a shape, pattern or label **[convention]**. mana-ui's pattern-coded bars already do that. On shape, the SaaS rule is one radius. The game rule is that **the frame varies with hierarchy and genre**: chamfers and hexes for sci-fi, nine-slice ornament for fantasy, brush for ink styles, brackets and hazard stripes for tactical. Skeuomorphism never died in games because "a neutral rounded rectangle says web app" **[convention]**. Shadows in games are hard (opaque, offset, little blur) or glows (zero offset, accent colour, wide blur). They are not the soft 10%-alpha card shadow **[convention]**. Behind menus over a 3D view, a scrim, vignette or blur takes the place of the white page **[convention]**.

### Motion: overshoot, ceremony and hit-stop, with separate opt-outs

Material 3's duration tokens run from `short1` = 50 ms through `short4` = 200 ms, `medium2` = 300 ms and `long2` = 500 ms ([M3 tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs)) **[sourced, search summary; verify]**. Community ports give emphasized-decelerate as `cubic-bezier(0.05, 0.7, 0.1, 1.0)` ([hydrolysis-m3](https://docs.rs/crate/hydrolysis-m3/latest/source/src/theme/motion/tokens.rs)) **[secondary; verify]**. M3 now calls those tokens "legacy" and makes springs primary ([M3 overview](https://m3.material.io/styles/motion/overview/specs)). Web guidance reserves bounce for momentum gestures ([userinterface-wiki](https://userinterface-wiki.vercel.app/to-spring-or-not-to-spring)) **[sourced]**. Both camps share **Nielsen's 0.1 s** limit for a response to feel instantaneous ([feelsfast](https://feelsfast.vercel.app/concepts/canonical-thresholds)). They differ in how big the feedback is and how long it lasts. The juice canon is Jonasson and Purho's "Juice It or Lose It" (GDC Europe 2012, [GDC Vault](https://gdcvault.com/play/1016487/Juice-It-or-Lose)) and Nijman's "The Art of Screenshake" ([Game Developer](https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games)). A rebuttal session, "Don't Juice It or Lose It," warns that juice can cost immersion ([GDC Vault](https://gdcvault.com/play/1020861/Don-t-Juice-It-or)). The best-measured number is Smash's hitlag: about **8 to 15 frames (133–250 ms) for a 15% hit** across the series ([SmashWiki](https://www.ssbwiki.com/Hitlag)) **[sourced]**. Persona 5 mixes rotational and horizontal wipes by submenu ([p5ui](https://p5ui.tumblr.com/post/158058845639/transition-animations)) **[sourced, fan archive]**, but **no title's transition timings are documented** in these notes.

Accessibility in games is **channelled, not a single switch**. Cult of the Lamb exposes a screenshake slider and a reduce-camera-motion toggle ([gamepressure](https://www.gamepressure.com/cult-of-the-lamb/accessibility-settings/z9102ae)). Dreamlight Valley added a shake toggle as a motion-sickness fix ([Can I Play That](https://caniplaythat.com/?p=10335)). XAG 118 treats a general flash as a failure above about **3 flashes per second over about 20% of the screen**, with a stricter rule for saturated red. It prefers removing the trigger to showing a warning ([XAG 118](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118)) **[sourced, verify]**.

| Motion concern | App default | Game counterpart | Starting value |
|---|---|---|---|
| Entry curve | Decelerate, no overshoot | Back/overshoot, elastic | Penner easeOutBack s ≈ 1.70158 **[estimate]** |
| Exit | Accelerate, quick | Snap-out, slam, wipe | 150–300 ms **[estimate]** |
| Screen change | Cross-fade or shared axis | Cover (wipe, slam, iris), hold for the load, reveal | Cover 150–300 ms, reveal 200–400 ms **[estimate]** |
| Stagger | Per-section fade-up | 30–60 ms per item with back-out | 5–8 items land in 0.5–0.7 s **[estimate]** |
| Focus | Colour/ring transition | Scale 1.05–1.1 in 80–150 ms, cursor moves on the input frame, idle pulse | Pulse period 1–2 s **[estimate]** |
| Value change | Swap the number | Count-up ticker, ghost bar, pop, float | Count-up 0.5–1.5 s, skippable; ghost holds 0.3–0.6 s, drains 0.3–0.8 s **[estimate]** |
| Hit feedback | None | Hit-stop, shake scaled by magnitude | 2–6 frames small; 8–15 frames heavy **[estimate; top end sourced]** |
| Reduced motion | One global switch | Separate shake, motion and flash channels; flash cap always on; sound kept | XAG 118 cap **[sourced]** |

### Sound: half of feel, absent from the web

The cue roles are consistent across sources. Navigate is "a tick that says the cursor has moved." Confirm is brighter and often rises in pitch. Back falls or dulls ([Morphic](https://morphic.com/resources/sounds/game-ui-sound-effects)). The whole set comes from one sonic family, mixed quieter than you think, and "a pitch family is automatically coherent" ([bugnet](https://bugnet.io/blog/ui-sound-design-for-indie-games)) **[sourced, secondary]**. Balatro pairs each card animation with its own sound ([Indieklem](https://indieklem.substack.com/p/20-a-look-at-100-interface-games)). The Xbox 360 achievement toast won the internal argument with "the notification popup and its happy beep" ([Vince Curley, via videogameforums](https://videogameforums.com/t/microsoft-explains-how-xbox-360-achievements-work.18117/latest)), and the rare tier later got its own sound ([Windows Central forum](https://forums.windowscentral.com/windows-central-news-discussion/441951-heres-video-clip-brand-new-xbox-live-rare-achievement-notification-print.html)) **[sourced]**. The rules that follow are **[estimate]**:

- a pitch jitter of about ±3–5% on high-repeat cues only, never on cues whose pitch carries meaning
- a pitch that steps upward on sequences (tickers, combos), reset for each sequence
- a rate limit of about one tick per 30–50 ms on fast count-ups
- the sound triggered on the same frame as the visual

### Input and focus: one focused element, a layer stack, glyphs by device

Unreal's CommonUI is the engine-level model. Activatable widgets are input-routing nodes, input goes to the top layer only, and lower layers resume when that layer is dismissed. Each screen declares game, menu or both input, and a back handler deactivates its screen rather than destroying it ([Epic CommonUI input guide](https://dev.epicgames.com/documentation/en-us/unreal-engine/commonui-input-technical-guide-for-unreal-engine); [CommonActivatableWidget](https://docs.unrealengine.com/PythonAPI/class/CommonActivatableWidget.html)). Its action bar is **built from the active screen's buttons**, with platform glyphs from a data table ([Epic CommonUI API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Plugins/CommonUI)) **[sourced]**. Confirm sits in a different place on each platform. Xbox A is the bottom button and Nintendo A is the right one. PS5 standardised Cross as the system confirm in 2020, and sources disagree on whether that reaches in-game prompts ([SoraNews24](https://soranews24.com/2020/10/05/sony-switches-x-button-to-confirm-for-playstation-5-worldwide-gamers-in-japan-freak-out/amp/); [GamesRadar](https://gamesradar.com/ps5s-x-and-circle-buttons-are-switching-uses-in-japan-but-only-for-the-hardware)) **[sourced, conflicting]**. Destiny's GDC talk covers **time-gated, hold-to-confirm interactions** ([GDC Vault](https://gdcvault.com/play/1023460/Tenacious-Design-and-The-Interface)) **[sourced; duration not retrieved]**.

The practitioner rules are **[convention]**:

- Exactly one element is focused at all times.
- Lists wrap and grids do not.
- The shoulder buttons switch tabs from anywhere on the screen.
- Back pops one layer and restores the previous focus.
- Destructive actions are held, or default to the safe choice.
- The legend is a strip pinned along the bottom inside title-safe. It updates with focus and swaps glyphs to the last-used device.

## Each screen type has a choreography the web has no word for

Screen anatomy is the weakest-sourced part of the research. Beyond a few anchors, everything here is **[convention]**, and every duration is an **[estimate]**. The anchors are:

- Giant Bomb's and Godot's descriptions of title screens ([Giant Bomb](https://giantbomb.com/wiki/Concepts/Title_Screen); [Godot docs](https://docs.godotengine.org/en/3.2/getting_started/step_by_step/ui_main_menu.html))
- the primary action standing out by size, brightness or accent ([Black Shell Media](https://medium.com/black-shell-media/constructing-flowing-and-alluring-main-menus-40d39a1a46f5))
- Steam's game-settable toast corner ([Facepunch.Steamworks](https://wiki.facepunch.com/steamworks/SteamUtils.SetOverlayNotificationInset))
- FromSoftware's "YOU DIED" as a failure state inside the loop ([wurb.com](https://www.wurb.com/stack/archives/6774))

The sequencing logic is consistent across shipped games, and it is the clearest structural gap between game UI and app UI. **Game screens are timed sequences that the player can skip or speed up but not reorder.** App screens are static states.

| Screen | Closest app analogue | Game anatomy [convention] | Timing [estimate] |
|---|---|---|---|
| Opening (splash, sting) | App launch screen | Legal or engine splash, then publisher and developer stings with audio, then cinematic or attract loop, then title | Each sting 2–4 s, skippable after first boot |
| Title / press start | Landing page hero | Full-bleed key art or live scene, logo lockup, a single pulsing prompt at about 70–80% height, version and legal in a bottom corner, music. "Any button" binds the seat and profile | Pulse 0.5–1 Hz sine (well under the 3 Hz flash cap); attract after 30–60 s idle |
| Main menu | Nav sidebar | A vertical list in the left third over art (AAA), or a centred list (indie/JP), or a hub (tabs top, PLAY bottom-right). Continue pre-focused | Focus move under 100 ms |
| Pause / options / inventory / shop | Settings page, modal | One tabbed shell: shoulder-button tabs, a list, a detail panel, a pinned legend. Settings use `< Value >` spinners; display changes get a revert countdown | Revert countdown about 15 s |
| HUD | Dashboard KPI tiles | Nine-anchor clusters inside title-safe, open centre, visibility policy (always, on change, in combat, hidden), HUD opacity setting | Contextual fade a few seconds after change |
| Notifications | Corner toast with an X | Two tiers: side feeds (pickups, kills) that merge duplicates and cap at 4–6 rows, and a serialised, priority-ordered centre banner for story, objective and level-up, suppressed in cinematics | Feed row 2–4 s; banner 2–4 s; toast in 200–350 ms, hold 3–5 s, out 200–300 ms |
| Results | Summary page | Headline slams, then stat rows count up one by one with ticks, then the rank stamps, then the XP bar fills and overflows into level-up, then unlocks. Confirm fast-forwards; a second press advances | Each row 0.3–1 s |
| Defeat | Error page | "GAME OVER", "YOU DIED", or a CONTINUE? countdown at 1 per second | About 10 s countdown |
| Dialogue | Chat bubble | Bottom box at 60–90% width, a nameplate tab, a portrait, typewriter text that confirm completes, a bouncing ▼ advance | Text speed is a player option |
| Versus / reveal | None | Diagonal split with VS; gacha: rarity telegraphed by colour before the reveal, a burst, a NEW badge, a summary grid | VS 2–4 s |

Two contrasts deserve emphasis. **App toasts and game notifications point in opposite directions.** The app toast is small, sits in a corner, can be dismissed and is mostly silent. The game's important notification is big, centred, brief, serialised, accompanied by a sound and never needs dismissing, because a controller has no pointer to hit an X. And **the title screen is one element on art, not a page of controls.** Its job is ritual and binding a device to a seat.

## Hardening mana-ui: from SaaS skeleton to game frame

The audit found a split identity. The **theme vocabulary already speaks game**: the ▶ `marker` focus, `glow` and `bracket`, the `cut` corner, `heavy`, `double` and `bevel` frames, the hazard, scanline and stitch ornaments, `snap`'s back curve and `stepped` motion, the banner slam with sheen, flash, pop and "+N" gains, ghost chips on bars, couch seat cursors, device-aware glyph legends, a hit-stop hold, and weighted toasts with no close button. The **skeleton under every preset is a SaaS card stack**, because all geometry is fixed px in `css.js` and the default paths (greybox, `modern`, the guide bridge) choose the app options. At the time of the audit no production page emitted mana-ui (`control/changelog/1126/1105/mana-ui.md:13-15`). **Defaults can change now without breaking a shipped byte pin.** After the surfaces migrate, each step must "either draw the same bytes or name the change it makes" (`docs/mana-ui.md:311-313`).

### Defaults that read as SaaS, and what to change them to

Line references are from the audit as of 2026-11-08, and I spot-checked them. "Change to" values marked as estimates are starting points to tune on the board.

| # | Current default (file:line) | Why it reads as SaaS | Change to | Priority |
|---|---|---|---|---|
| 1 | Root `font-size: calc(14px*var(--mana-scale))`, `line-height:1.35` (`css.js:66`); `scale` only 0.9/1/1.12 (`theme.js:173`) | Fixed px body at about 1.3% of 1080p height; the UI never follows resolution or distance | A height-relative unit, `--mana-u` = stage height / 1080, with a type floor set by a new `distance` word (couch 26u, desk 18u, hand: a px floor; XAG/GDK figures **[verify]**); `scale` becomes a player multiplier up to at least 2× (XAG 200%) | P0 |
| 2 | Type roles: `.mana-heading` and `heading` 11px, `label` 11px, `caption` 10px, `numeral` 12px, `title` 19/22px, `display` 40px (`css.js:84-91`) | Many small steps; heading (11) is smaller than body (14); title/body is 1.57 | Fewer levels with jumps of 2× or more: body and label at the floor, caption at the floor (legal/version only), title about 1.7× body, display/hero about 3.5–5×, a hero `numeral` role for combo, score and damage **[estimate]** | P0 |
| 3 | Window heading 11px, weight 700, `.14em` tracked, uppercase, `mid` grey (`css.js:85`) | The SaaS eyebrow label, which Anthropic's skill names as a default | Heading in full `ink` (or accent) at floor size or above; tracking and caps tied to the `case` word *and* a display face that carries voice, never to the system sans | P0 |
| 4 | Labels and captions always `mid` (`css.js:89-90`); `mid`/`soft` = ink-to-panel mixes at .4 and .72 (`theme.js:146-147`) | Grey-value hierarchy | Grey only for disabled and "poor" states; second-level text in ink at a lower weight, or in accent | P1 |
| 5 | Focus `ring`: `outline:2px solid accent; outline-offset:-2px` (`css.js:117`), greybox default (`theme.js:68`) | The web accessibility focus ring | Greybox default becomes `marker` (▶, already a shape and not a colour, which fits "focus is a shape") plus a pop on focus; add a `bar` focus word (a highlight bar that moves on the input frame). Keep `ring` as an option | P0 |
| 6 | Items always `border-radius: calc(radius*.6 + 3px)` (`css.js:113`); `modern` = `round` 12px + `flat` 86% plate (`theme.js:69,163,180`) | One radius on everything; `modern` is shadcn under another name | Drop the +3px floor so `square` is square; let radius and frame weight follow the hierarchy level (hero window, sub-panel, item); redo `modern` as a deliberate "clean glass" (FF clear-blue style) rather than a dashboard | P1 |
| 7 | Fixed `1px solid line` on cells, tracks, icons, badges, keys, slots, minimap and compass (`css.js:127-277`) | Hairline boxes everywhere | Route these through `--mana-frame-w` (already in `GREYBOX_VARS`) or a sibling `--mana-rule-w`, so `heavy`, `double` and `bevel` reach the inner parts | P1 |
| 8 | Spacing: screen padding `max(24px, env(safe-area-inset-*))`, gaps 12/8/3/18px, window padding `10px 12px` (`css.js:70-98`); HUD regions `max-width:40%` (`css.js:198-199`) | A web card-layout rhythm | A `--mana-safe` inset of 5% per side (90% title-safe) in stage units, combined with `max()` over the env insets; gaps in `u`; "tight inside, wide between" (cluster gaps small, region separation by anchor) | P0 |
| 9 | Title screen as a centred column: `display` title, `label` subtitle, ghost list, `caption` version (`idioms-front.js:27-37`); attract is a plain "Press start" button that neither pulses nor takes any button (`idioms-front.js:17-26`) | A landing page | Title: full-bleed art layer, logo lockup, a left-third menu option (`place`), version in the bottom corner. Attract: a pulsing prompt (sine, 0.5–1 Hz **[estimate]**) that accepts any action and emits a seat-bind effect | P0 |
| 10 | Legend is the last flex child, centred (`css.js:161,193-194`), on a few of the screen idioms at the time of audit | Not a game legend bar | A legend pinned to the bottom edge inside the safe frame, right-aligned, on every full screen by default, built from the screen's own actions (CommonUI's action-bar model) | P0 |
| 11 | Greybox motion `none` (160ms fade, `css.js:41`); the guide bridge defaults to `ease` (`mana-theme.js:55`); `ease` = 220ms `cubic-bezier(.2,.7,.2,1)`, 10px rise (`theme.js:169`) | Material-like ease-out | Keep the greybox at `none` (a test requires it), but make the bridges default to `snap` unless a calm register (cozy, storybook, diegetic) asks for `ease`; map the juice register (anime → snap, western → ease or stepped) | P1 |
| 12 | No exit animation and no screen-to-screen transition: `back` re-renders the stack (`css.js:286-335`; `kernel.js:668-672`) | App navigation | A leave phase and a `transition` word (fade, wipe, slam, iris, shutter, stepped) with cover, hold and reveal segments; check first that `mount`'s keyed patching (`kernel.js:851`) can keep a leaving node | P1 |
| 13 | No sound hooks: the runtime emits only `on.*`, `set` and `mana:closed` (`kernel.js:648,665,670,741,757`) | A silent app | Emit cue effects as data on focus move, tab, open, close, back, accept, deny, toggle, slider tick, toast in and ticker tick; carry the register's unused `sound` dial (`register.js:32,47`) across the guide bridge | P0 |
| 14 | No number ticker: values are replaced at once (`kernel.js:462`); playscape has `roll` (`playscape/ui/motion.js:14-23`) | A dashboard number swap | A ticker mark advanced by the host's game clock (mana-ui has no clock of its own), skippable on accept, emitting a pitch-stepped tick cue | P1 |
| 15 | Damage numbers are plated, bordered 12px mono chips at `.94` opacity (`css.js:206,212`); anchors are outside the rise stagger (`css.js:300`) | Tooltip badges | Hero numeral size, a halo or outline in place of the plate, coloured by kind, a pop-rise-fade keyframe in the sheet; crits larger | P1 |
| 16 | `quest-toasts` top-right, 12px text, `padding:4px 10px`, 1px border (`idioms-live.js:183-189`; `css.js:224`), hold 2.5s | A notification-centre chip | Two tiers: a side feed (merge ×N, cap rows) and the existing centre `moments` banner for important events; a `tier` field (standard, rare) that swaps cue, hold and ornament; hold 3–5 s **[estimate]** | P1 |
| 17 | iOS-style 38×22 toggle pill (`css.js:146-149`) | A mobile OS control | Under pad and keys, a `< On / Off >` cycler; the pill only under touch | P2 |
| 18 | Text over the world relies on a plate at `.94` and the reticle halo (`css.js:206,214`); no stroke, outline or glow token (audit Q1) | Web text assumes a blank page | A `halo` word (plate, outline, glow, shadow), applied by default to any text not on an opaque plate; subtitle plate opacity as a player setting (XAG 104) | P0 |
| 19 | Light greybox: panel `#fafafa`, scrim `rgba(255,255,255,.72)` (`css.js:33-34`), while playscape's greybox is dark (`direction.js:51`) and the legacy HUD is dark navy (`hud-widgets.js:182`) | A white page dimming the game | Consider a dark, achromatic greybox (still hue-free, so still "values first"). This is a judgement call, and it must keep the greybox's zero contrast advice (`theme.test.js:55-60`) | P2 |
| 20 | Results is a static display, a stats window, a Rank badge and a ghost list (`idioms-front.js:128-138`) | A summary page | A sequenced reveal: headline slam, rows ticked one after another, rank stamp, legend "Continue · Retry"; confirm fast-forwards | P1 |
| 21 | Dialogue box has no typewriter, no ▼ advance and no nameplate tab (`idioms-rpg.js:112-121`) | A chat panel | A nameplate tab, a host-clocked reveal that confirm completes, a bouncing ▼ advance | P2 |
| 22 | No pad hold-to-repeat (`mana-host.js:53-58`); keyboard OS repeat passes through (`:40-48`) | Long lists and sliders cannot be held | A delay-then-rate repeat in the controls host (outside mana-ui), the same for keys and pad; values tuned by feel, unsourced here | P1 |
| 23 | Hard-coded English ('Back', 'Loading', 'Tip', 'Nothing here'…) (`idioms-front.js:12,44-48`; `idioms-live.js:203`; `kernel.js:145-146`) | Not SaaS as such, but it blocks localised title and results ceremony | Decide the open question: key idiom labels as `game/title-words.js` already does, from `control/messages/` | P2 |

### New words, tokens and idioms the research calls for

Every proposal below is a closed word, a `--mana-*` variable with a greybox default, or an idiom. None is a per-node style. That follows "a look is words, never CSS" (`theme.js:98`) and "style is never a prop" (`kernel.js:86`).

| Kind | Proposal | Values | Research basis |
|---|---|---|---|
| Word | `distance` | `couch` (26u floor), `desk` (18u), `hand` (px floor); a host may hint it from `data-input` the way `[data-input=touch]` already sets the target (`css.js:67`) | XAG 101, GDK handheld **[sourced, verify]** |
| Variable | `--mana-u`, `--mana-safe` | Stage height / 1080; 5% inset per side | 1080p reference; title-safe 90% **[sourced]** |
| Word | `halo` | `none`, `plate`, `outline`, `glow`, `shadow` | GAG, Godot docs **[sourced]** |
| Word | `slant` | `none`, `light`, `hard`: a skew on bars, tabs, the focus bar and banners (also fixes the broadcast's lost slant, `broadcast-mana.js`) | Smash, P5, Overwatch, Apex **[convention]** |
| Word | `focus: bar` | A highlight bar that moves on the input frame, with a scale pop | Nielsen 0.1 s **[sourced]**; bar **[convention]** |
| Word | `transition` | `fade`, `wipe`, `slam`, `iris`, `shutter`, `stepped`; cover, hold and reveal segments | P5 wipes **[sourced]**; vocabulary **[convention]** |
| Motion keys | `out`, `shake`, `pulse`, `tick` added to all four `MOTIONS` rows, with `none` equal to the greybox | `none` row: 0 or paused | Juice canon **[sourced]**; values **[estimate]** |
| Word | `cues` | `silent`, `ticks` (navigate and confirm only), `full`; emitted as data, played by the host | Morphic, bugnet, Xbox beep **[sourced]** |
| Colour tokens | A rarity ladder (`tier-0..5`) and a halo colour, fixed across themes, each paired with a pattern or glyph | Grey, white, green, blue, purple, orange by default | WoW/Diablo **[sourced]** |
| Word | `presence` (HUD) | `always`, `change`, `combat`, `hidden` | Contextual HUD **[convention]** |
| Screen `place` | `left-third`, `hub` beside `center` (`css.js` `[data-place=center]`) | Structure stays the sheet's | Menu archetypes **[convention]** |
| Idioms | `splash-sting`, `game-over` (continue countdown), `achievement-toast` (tiered), `hold-confirm` (a radial fill on the glyph), `credits`, `brightness-calibration`, `difficulty-select`, `language-select`, `tutorial-card`; a sequenced `results` and `title` | Missing at the time of audit (audit Q3) | Destiny hold, Xbox toast **[sourced]**; others **[convention]** |
| Guard | A flash cap | No sheet effect may change luminance by more than about 10% over 20% or more of the stage faster than 3 Hz; red flashes desaturated | XAG 118 **[sourced, verify]** |
| Accessibility channels | `shake`, `motion`, `flash` (cap always on), `sound` kept under reduced motion | `prefers-reduced-motion` sets the default; the player can override in both directions | Cult of the Lamb, HIG **[sourced]** |

### What the audit's constraints imply for doing it

The constraints shape how the work is done more than what is done.

**Closed words.** Unknown keys throw (`theme.js:98`; `theme.test.js:11`). Every new word above needs a table entry in `theme.js`, and the unknown-word test covers it automatically.

**Variables with defaults.** Every `var(--mana-*)` needs a greybox default (`style-rules.test.js:27-30`). No colour literal may appear after the variables line (`:22-26`). Every non-greybox theme must set every colour variable (`:31-35`). So a halo colour and a rarity ladder must either be derived in `theme.js`, the way `harm` and `hp` are today (`theme.js:144-158`), or be added to all six presets.

**Motion rows.** The greybox must "travel nowhere" (`theme.test.js:71-77`). New motion keys therefore go into all four rows, the `none` row is zeroed, and game motion arrives through presets and bridges, not through the greybox.

**Self-contained kernel.** The kernel is emitted by `toString()` (`kernel.js:5-8`; `kernel.test.js:414-419`). Ticker, typewriter and cue helpers must live inside `buildManaUi()`'s closure.

**No clock, no dice, no device.** mana-ui has "no clock of its own" and reads no device (`docs/mana-ui.md:296-301`; `boundary.test.js:24`). Tickers, typewriter reveals, press-start pulses on the game clock and hold-to-confirm must all be **advanced by host-supplied time**, the way `moments` already run on the game clock. Pad repeat belongs in `controls/mana-host.js`. Sound jitter cannot use `Math.random`: derive it from a deterministic index, or leave it to the host. The runtime emits cue *names*, and the host owns the audio buffers, so mana-ui ships no audio bytes and loads nothing.

**No network, no bytes when absent.** "A page and the board load nothing from anywhere" (`kernel.test.js:420-426`), and fonts must be `data:` URLs (`theme.js:131`). Display faces for a voice register must come inlined from the font shelf, as the guide bridge already does (`mana-theme.js:60-67`). A page that uses no mana-ui carries no byte of it, and a theme with `cues: silent` should emit no cue effects.

**Portable to engine backends.** The roadmap goes to Unity UI Toolkit and Godot themes (`docs/mana-ui.md:309-314`). A 1080-reference unit maps directly onto engine canvas scaling. Unity's Canvas Scaler and Unreal's DPI curve are the usual equivalents **[convention, unconfirmed]**. Words such as `slant`, `halo` and `transition` port better than CSS-only tricks. Keep `clip-path` and blend modes as one rendering of a word, not as the word itself.

**Tests to add.** These follow "test the concept, not the catalog":

- the body floor holds at the reference stage for each `distance`, computed from the sheet
- every full-screen idiom carries a legend (in `idioms.deep.test.js`)
- a focus move emits a cue when `cues` is not silent
- the flash guard holds for the slam, sheen and flash keyframes
- the greybox still has zero advice

Run `npm run test:changed` while iterating, because `scripts/test-changed.mjs:52` already declares that `boundary.test.js` reads every mana-ui module. Run `test:critical` only if a pin or guard changes.

**Gates and changelog.** The machine gate covers sizes, contrast advice and the flash guard. The **eyes gate is the board** (`manaUiBoard`, 1280×720 and 390×844 stages, `css.js:338-346`), and only a human can pass it. The 390×844 portrait phone stage will break a naive height unit (390/1080 × 26 ≈ 9 px if keyed on the short side), so `hand` needs its own px floor. Write the theme file as `control/changelog/1126/1108/game-ui-theme-hardening.md`, with its first line `### <title>`, and leave the existing `1105/mana-ui.md` alone.

### The order of work

The table gives a recommended sequence. The first group changes the feel most for the least structure. The later groups depend on it.

| Step | Work | Depends on | Gate that proves it |
|---|---|---|---|
| P0-a | `--mana-u`, `distance`, `--mana-safe`; rebase the type roles and spacing on them; collapse the type ramp; heading to full ink | Nothing | Machine: floor per distance at the reference stage. Eyes: board at 1280×720 and on a 1080p page |
| P0-b | `halo` word with a default for text over the world; subtitle plate opacity | P0-a | Machine: contrast against the plate. Eyes: HUD over a scene |
| P0-c | Pinned legend bar on every full screen, built from the screen's actions | P0-a | Machine: deep test that every full screen has a legend |
| P0-d | Emitted cue effects (navigate, confirm, back, open, close, tab, deny) plus the `cues` word; carry the register's `sound` dial across the bridge | Nothing | Machine: a focus move emits a cue; silent emits none |
| P0-e | Greybox focus `marker` plus a pop; new `focus: bar` | Nothing | Eyes: board, pad-driven |
| P0-f | Title and attract rebuilt: art layer, logo, left-third or centre place, pulsing any-button prompt that binds a seat, version in the corner | P0-a, P0-c, P0-d | Machine: pulse under 3 Hz. Eyes: board |
| P1 | Bridges default to `snap` and map the juice register; `slant`; exit and `transition`; ticker; results sequence; damage pops; two-tier toasts plus achievement toast; frame and radius by level; pad repeat in the host; flash guard and accessibility channels | P0 | Machine: motion rows complete, flash guard. Eyes: board |
| P2 | Remaining idioms (splash, game over, credits, brightness, language, difficulty, tutorial, hold-confirm); dialogue typewriter; cycler under pad; dark-greybox decision; idiom string keys | P1 | Deep idiom test; eyes on the board |

Numbers to verify against primary pages before they are pinned in code or tests:

- XAG 101's 26/52/18 px and how it measures height
- XAG 102's 4.5, 3 and 7 ratios and its 52 px large-text threshold
- XAG 104's 40 characters, 0–100% opacity and 200% scale
- XAG 118's 3 Hz, 20% and 10%
- the Xbox title-safe and action-safe percentages (90%, and 93% versus 95%)
- GAG's 46 px subtitle size
- the Material 3 duration and easing tokens, used only as the calm baseline

## Conclusion

The useful reframe is that mana-ui does not need more *looks*. It needs a different *frame*. Its theme words already reach console, arcade, terminal and storybook registers. But every register sits on the same document skeleton: px-fixed small type, grey eyebrows, hairline boxes and a centred column. That skeleton is what makes a fighting game and a farming sim look like the same app in different colours. The research points to three changes that no amount of colour can fake. The UI must be sized to the screen and the viewing distance. Space must be allocated within a fixed safe frame rather than flowed. And feedback must be multi-sensory and timed: a cue on every input, tickers and slams paced by the game clock. Each fits mana-ui's disciplines, because each is a word, a variable or an emitted effect, never a per-node style or a device read. The window to change defaults is open now, before any surface carries mana-ui bytes.

The second insight concerns how the work is held together. Game UI keeps usability as a measured floor and treats engagement as a stylistic layer. That maps exactly onto mojulo's two gates. Floors, contrast against the plate, flash caps and legend coverage belong to the machine gate, which can be automated and pinned. Whether a title screen *feels* like a game belongs to the eyes gate, at the board. Keeping the two apart lets the branch harden the floor confidently, while leaving the ceremony numbers (stings, pulses, holds, count-ups, all estimates today) as tunable words, not pretend standards.
