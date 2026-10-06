---
{
  "id": "dress-shirt",
  "name": "Dress shirt — open-front shirt with a stand collar, tucked",
  "summary": "A white shirt as two mirrored front halves with a 3 cm button stand, sewn closed at the centre front, long sleeves, a stand collar, hemmed at the waist so trousers or a skirt go over it.",
  "when": "a dress shirt; a white shirt under a suit; a tucked shirt; a button-front shirt on a figure; a formal shirt with a collar",
  "entry": "create_figure"
}
---

The front is the bodice block with `split: "cf"` and `overlap_cm` 3, mirrored into `frontL`, and the `front.cf ↔ frontL.cf` seam closes it (drop that seam for an open shirt, or give it `from: 0.5` to open the top half). `hem: "waist"` is the tuck: the layer worn over it starts where it ends. The sleeve cap is sewn to the armhole; the collar is an outline band on the `neck` chart. The tailor's numbers: +10 at the chest, +8 at the waist, sleeve = bicep + 6, at a 1.25 cm stand-off.
