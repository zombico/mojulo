---
{
  "id": "phone-stand",
  "name": "Phone stand (a part by name)",
  "entry": "mint_solid",
  "family": "object",
  "summary": "A desk stand for a phone or small tablet printed at true size: a groove sized to the device, a backrest at the viewing angle, a strut and an optional cable slot. Name it and get one; give the device's thickness to fit it.",
  "when": "a phone stand; a stand for my phone on the desk; a tablet stand; hold my phone upright while it charges; a phone dock with a slot for the cable; a stand for a phone in a thick case"
}
---

A recipe-book part: name it and the part's builder writes the OpenSCAD program from its params. Mint with
`kind: 'scad'` and `spec: { part: 'phone-stand', params? }`; every param has a default, so `{ part: 'phone-stand' }`
alone stands a phone in an ordinary case. Patch `/params` to change it; a hand edit under `/source` detaches it.

## Params

| param | default | range | what it sets |
|---|---|---|---|
| `device` | 11 | 5–30 mm | the phone's thickness WITH its case; the groove is its leaning footprint plus 1 mm |
| `angle` | 65 | 45–80° | the backrest from the desk: lower to read, higher for a call |
| `width` | 70 | 30–220 mm | across the stand (a tablet wants 120+) |
| `back` | 90 | 40–180 mm | backrest length (a tablet wants 120+) |
| `lip` | 9 | 3–25 mm | front lip height above the groove floor |
| `wall` | 4 | 2.4–8 mm | the section of every member |
| `cable` | true | true, false | a 12 mm slot through the lip and floor for a charging cable |

## Sizing the ask

- **A look:** `{ part: 'phone-stand' }`.
- **A fit:** `device`, which is the one number that matters; measure the phone in its case. A tablet also wants `width` and `back`.

Print it on its side, the profile flat on the bed: no supports, and the layers run along the backrest.
