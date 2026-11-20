# Front cards: a game's start screen, as data

A start screen's layout is a card: one JSON file here. A theme card (`../theme-cards/`) says how the screen is drawn;
a front card says what is on it and where. The loader (`loader.js`) reads every card when it loads and checks it, so a
card that loads is a start screen that lays out.

A start screen is a **visual artifact**, not a level: a few subjects (the game's own characters, vehicles and props),
its name and its menu on a graphic ground, entering on beats. The game's shell opens it before any of the engine loads.
It is drawn as pictures of the subjects (the default), or with the same subjects live in 3D over those pictures (the
high-end mode, `front.stage.mode: '3d'`). A card never names a world, a set or a camera path through one.

## A card

```json
{
  "id": "hero-pose",
  "name": "Hero pose",
  "about": "One figure large and off centre…",
  "suits": ["stylish-action", "platformer-3d"],
  "fallback": true,
  "slots": [{ "roles": ["hero", "ally"], "view": "three-quarter", "crop": "full", "anchor": "bottom" }],
  "ground": "theme",
  "frames": {
    "wide": { "subjects": [[50, 4, 46, 96]], "title": { "box": [4, 8, 92, 42], "align": "start", "size": "huge", "behind": true },
              "tagline": { "box": [6, 48, 40, 6], "align": "start" }, "menu": { "box": [6, 58, 32, 34], "align": "start" } },
    "tall": { … }
  },
  "motion": [{ "part": "title", "enter": "letters", "at": 120 }, { "part": "menu", "enter": "stagger", "at": 860 }]
}
```

- `id` is the file's name. `name` and `about` say what it shows.
- `suits` names the genres it is the start screen for (the genres in `gameworld/rails.js`). One card at most is the
  `fallback`: the one a game whose genre no card suits is offered.
- `slots` are what stands on it, most important first. Each takes a subject of one of its `roles` (`hero`, `ally`,
  `foe`, `ride`, `prop`), seen from its `view` (front, three-quarter, profile, back-three-quarter), with its `crop`
  (full, knees, waist, bust) and its `anchor` (bottom, center).
- `ground`: `theme` draws the theme's stage shapes behind; `plain` its ground alone.
- `frames` lays the parts out on a landscape screen (`wide`) and on a phone held upright (`tall`): every box is
  `[x, y, w, h]` in percent of the screen. The title's `behind: true` sets the name behind the subjects, so they stand
  in front of it.
- `motion` is the entrance, a beat per part: `fade`, `rise`, `slide`, `slam`, `wipe`; `letters` (the title, letter by
  letter) and `stagger` (the menu, row by row). `at` is milliseconds from the first frame. A player who turns motion
  down gets fades.

## The cards

| Card | What it shows | Suits |
|---|---|---|
| `hero-pose` | one figure large and off centre, the name huge behind it, the menu as words on the open side | action, platformers, adventure, horror, stealth, runners; the fallback |

Planned: `face-off` (fighters), `showroom` (a vehicle), `hardware` (a gun or an operator), `ensemble` (a party),
`still-life` (a board's pieces).
