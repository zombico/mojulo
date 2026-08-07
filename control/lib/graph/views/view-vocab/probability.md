---
{
  "id": "probability",
  "name": "Probability",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive PROBABILITY explainer — a GALTON BOARD (quincunx), rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'Galton board / quincunx / binomial / normal distribution / central limit theorem / bell curve'.",
  "retired_tool": "create_probability_view"
}
---

Mint an interactive PROBABILITY explainer — a GALTON BOARD (quincunx), rendered as a live traversable three.js World. Balls drop through a triangle of pegs, bounce LEFT or RIGHT at each row, and pile into bins at the bottom that grow into a BELL CURVE — the Central Limit Theorem made visceral, the sum of many tiny coin-flips converging on the normal before your eyes. The bars are the EXACT binomial distribution; a Gaussian is overlaid on top so you watch the binomial approach the normal as the board grows. Four scenarios: 'few' (6 rows — coarse enough to read C(6,k) straight off the bins), 'classic' (12 rows, the symmetric textbook bell), 'tall' (20 rows — smoother, visibly closer to a continuous normal), 'skew' (biased pegs, p ≠ ½ — the bell SHIFTS off centre and goes asymmetric). Tune `rows` (board height) and `p` (probability a ball goes right) to drive it directly. Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'probability-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'Galton board / quincunx / binomial / normal distribution / central limit theorem / bell curve'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which board (default 'classic'): 'few' (6 rows — read C(6,k) directly), 'classic' (12, the symmetric bell), 'tall' (20, smoother → normal), 'skew' (biased pegs p≠½, the bell shifts and goes asymmetric).
- `rows` (number) — Number of board rows (3–24). More rows → smoother, closer to the continuous normal.
- `p` (number) — Probability a ball bounces right at each peg (0.1–0.9, default 0.5). p ≠ ½ shifts the bell off centre.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
