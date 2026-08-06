# Cover font shelf

Curated open-license (SIL OFL) faces that covers carve text from. A cover names a
face by KEY (see `FONT_SHELF` in [font-shelf.js](font-shelf.js)), never a path, so
a cover recipe carves identically on any host.

## Vendoring a face

Each shelf entry declares a `file` (e.g. `archivo-black.ttf`). Drop that exact
`.ttf` into **this directory** and the loader uses it. Until then, `loadFace`
falls back to a system face during bring-up — the key/role stay stable; only the
bytes change when the real face lands.

Intended faces (all SIL OFL 1.1, safe to commit — unlike the gitignored ONNX
weights, these are small and license-clean):

| key            | face             | file                    | source (fetch the OFL `.ttf`) |
| -------------- | ---------------- | ----------------------- | ------------------------------ |
| `archivo-black`| Archivo Black    | `archivo-black.ttf`     | Google Fonts / fonts.google.com/specimen/Archivo+Black |
| `im-fell`      | IM Fell English  | `im-fell-english.ttf`   | Google Fonts / igino-marini.com |
| `great-vibes`  | Great Vibes      | `great-vibes.ttf`       | Google Fonts / fonts.google.com/specimen/Great+Vibes |
| `inter`        | Inter            | `inter.ttf`             | Google Fonts / rsms.me/inter |

When a face is vendored, add its license text/attribution to `LICENSES.md`.

## Adding a new face

1. Pick an OFL display or text face; add an entry to `FONT_SHELF` (`key`,
   `family`, `role`, `file`, `license`, `fallbacks`).
2. Vendor the `.ttf` here (or leave `fallbacks` to cover bring-up).
3. Note it in `LICENSES.md`.

`role` is advisory: `display-*` faces suit titles/headlines, `text-*` faces suit
subtext (author, cover-lines).
