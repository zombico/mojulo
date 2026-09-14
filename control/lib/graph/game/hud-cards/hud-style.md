---
{ "id": "hud-style", "name": "Game style tokens (theme)", "summary": "One token set skins a whole game: accent, accent2, ink, bg, panel, line (hex) + font (system | mono | serif | display). Declared as a game's `theme` it reaches the shell's menu / setup / score screens AND every level's HUD over game-init; declared as a world's `events.style` it skins a shell-less world game.", "when": "theme the game, game colors, change the accent color, HUD font, monospace HUD, retro font, make the UI gold and black, dark panel color, style the menu and the level the same, game skin, neon look, clean look" }
---

## Tokens

| token | what it paints | default |
|---|---|---|
| `accent` | primary highlight: buttons, selected cards, bar fills, banners | `#5fb0ff` |
| `accent2` | secondary highlight: tags, secondary labels | `#e8b96a` |
| `ink` | text | shell `#cfe3ff` · level `#ffffff` |
| `bg` | the shell's page background (levels paint the world) | `#0b1220` |
| `panel` | card / pill background (made translucent) | shell `rgba(13,19,33,.6)` · level `#0c101a` |
| `line` | borders | shell `#1c2942` · level `#2a3b58` |
| `font` | `system` · `mono` · `serif` · `display` | `system` |

Colors are hex only (`#rgb`, `#rrggbb`, `#rrggbbaa`); anything else is refused at mint and
ignored at emit — a token can never inject into a CSS context. Beside these, a game's `theme`
keeps `style: 'hud' | 'clean'` (the stylized skin with corner brackets and glow, or the plain one).

Semantic colors a widget may name — `harm` (red), `value` (gold), `goal` (green) — are fixed
substrate-wide (the decoration already speaks them: red hazards, gold pickups, green exits).

## Where it goes

```json
// a game (create_game / update_sketch kind:'game')
"theme": { "accent": "#ffd400", "accent2": "#ff5a4d", "ink": "#fff7d6", "panel": "#1a1408", "line": "#5a4a1a", "font": "display", "style": "hud" }

// a shell-less world game (compose_world … events)
"events": { "style": { "accent": "#5fe6d6", "font": "mono" }, "hud": [ … ] }
```

The shell posts its tokens beside `game-init` (a presentation sidecar — unversioned, ignored by
older levels); the level sets them as `--moj-*` custom properties, so the shell's theme wins
over the level's own `events.style`. Absent both, today's look.

## What it does not do

It never gates play, never resolves a ref, and never travels to an engine pack (the ledger says
so: `hud_declared`). Free CSS is not a token — see the hud-guide card for why.
