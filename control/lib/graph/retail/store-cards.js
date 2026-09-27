// The seeded concept cards. PURE DATA: every card here is plain JSON (the test round-trips each one),
// so an agent can read one, copy it, and author its own inline in a `store` or `mall` manifest.
// The mall's store types (apparel, electronics, cafe, bookstore, homewares, food, and department for
// the anchors) key into this table by id; `wine-bar` is the card written with no code change.

export const SEEDED_CARDS = Object.freeze({
  apparel: {
    "id": "apparel",
    "label": "Apparel",
    "finishes": { "floor": "floorboards", "floorTint": "#b89a74", "wall": "paint", "paint": "#ebe5da", "sign": "#9c544b" },
    "palette": {
      "merch": ["#c9a06a", "#8a6a9c", "#6a9c8a", "#c98aa0", "#b06a5a"]
    },
    "entry": { "at": 0.5 },
    "cells": [
      { "archetype": "stockRoom" },
      { "archetype": "fittingRoom", "count": 2 }
    ],
    "zones": [
      {
        "role": "window",
        "depth": [0.0, 0.16]
      },
      {
        "role": "browse",
        "depth": [0.16, 0.7]
      },
      {
        "role": "service",
        "depth": [0.7, 1.0]
      }
    ],
    "fixtures": [
      {
        "archetype": "podium",
        "zone": "window",
        "at": [0.18, 0.82]
      },
      {
        "archetype": "rackRun",
        "zone": "browse",
        "run": [0.06, 0.36],
        "rows": 3
      },
      {
        "archetype": "rackRun",
        "zone": "browse",
        "run": [0.52, 0.74],
        "rows": 3
      },
      {
        "archetype": "hangerRun",
        "zone": "browse",
        "wall": "right",
        "run": [0.04, 0.96]
      },
      {
        "archetype": "counter",
        "zone": "service",
        "run": [0.58, 0.9],
        "depth": 0.45
      },
      { "archetype": "plant", "zone": "service", "at": 0.08, "depth": 0.5 }
    ]
  },
  electronics: {
    "id": "electronics",
    "label": "Electronics",
    "finishes": { "floor": "marble", "floorTint": "#d9d8d4", "wall": "paint", "paint": "#e4e6e9", "sign": "#3f5a7a" },
    "palette": {
      "merch": ["#2a3340", "#6a7a8a", "#9aabbc"]
    },
    "entry": { "at": 0.35 },
    "cells": [
      { "archetype": "stockRoom" }
    ],
    "zones": [
      {
        "role": "window",
        "depth": [0.0, 0.15]
      },
      {
        "role": "browse",
        "depth": [0.15, 0.72]
      },
      {
        "role": "service",
        "depth": [0.72, 1.0]
      }
    ],
    "fixtures": [
      {
        "archetype": "podium",
        "zone": "window",
        "at": [0.72, 0.9]
      },
      {
        "archetype": "podium",
        "zone": "browse",
        "grid": [2, 3],
        "run": [0.3, 0.8]
      },
      {
        "archetype": "shelfWall",
        "zone": "browse",
        "wall": "right",
        "run": [0.04, 0.96]
      },
      {
        "archetype": "counter",
        "zone": "service",
        "run": [0.5, 0.88],
        "depth": 0.45,
        "tint": "#39414e"
      },
      {
        "archetype": "wallArt",
        "zone": "service",
        "wall": "back",
        "run": [0.1, 0.4]
      }
    ]
  },
  cafe: {
    "id": "cafe",
    "label": "Cafe",
    "finishes": { "floor": "floorboards", "floorTint": "#8a6a48", "wall": "wainscot", "sign": "#7a5230" },
    "palette": {
      "merch": ["#b9863f", "#7a5230", "#e4d2b0"]
    },
    "entry": { "at": 0.3 },
    "cells": [
      { "archetype": "stockRoom" },
      { "archetype": "restroom" }
    ],
    "zones": [
      {
        "role": "window",
        "depth": [0, 0.12]
      },
      {
        "role": "browse",
        "depth": [0.12, 0.5]
      },
      {
        "role": "service",
        "depth": [0.5, 0.86]
      },
      {
        "role": "back",
        "depth": [0.86, 1.0]
      }
    ],
    "fixtures": [
      { "archetype": "plant", "zone": "window", "at": 0.82 },
      {
        "archetype": "tableSet",
        "zone": "browse",
        "grid": [2, 2],
        "run": [0.5, 0.95]
      },
      {
        "archetype": "counter",
        "zone": "service",
        "run": [0.08, 0.56],
        "depth": 0.6
      },
      { "archetype": "stool", "along": "counter", "pitch": 2.6 },
      {
        "archetype": "backBar",
        "zone": "back",
        "run": [0.08, 0.56]
      },
      {
        "archetype": "pendantRow",
        "zone": "service",
        "run": [0.1, 0.54],
        "pitch": 4.5
      }
    ]
  },
  bookstore: {
    "id": "bookstore",
    "label": "Bookstore",
    "finishes": { "floor": "floorboards", "floorTint": "#9a7b52", "wall": "wallpaper", "sign": "#4f6f4a" },
    "palette": {
      "merch": ["#a55545", "#52805a", "#5a6f9c", "#9c8a4a"]
    },
    "entry": { "at": 0.5 },
    "cells": [
      { "archetype": "stockRoom" }
    ],
    "zones": [
      {
        "role": "window",
        "depth": [0.0, 0.15]
      },
      {
        "role": "browse",
        "depth": [0.15, 0.74]
      },
      {
        "role": "service",
        "depth": [0.74, 1.0]
      }
    ],
    "fixtures": [
      {
        "archetype": "podium",
        "zone": "window",
        "at": [0.2, 0.8]
      },
      {
        "archetype": "gondola",
        "zone": "browse",
        "run": [0.08, 0.38],
        "rows": 3
      },
      {
        "archetype": "gondola",
        "zone": "browse",
        "run": [0.56, 0.8],
        "rows": 3
      },
      {
        "archetype": "shelfWall",
        "zone": "browse",
        "wall": "right",
        "run": [0.04, 0.96]
      },
      {
        "archetype": "counter",
        "zone": "service",
        "run": [0.34, 0.66],
        "depth": 0.3
      },
      { "archetype": "plant", "zone": "service", "at": 0.08 }
    ]
  },
  homewares: {
    "id": "homewares",
    "label": "Homewares",
    "finishes": { "floor": "floorboards", "floorTint": "#c2a67e", "wall": "paint", "paint": "#efe9df", "sign": "#6a5a7a" },
    "palette": {
      "merch": ["#c9bca0", "#9aabbc", "#bcc9a0", "#b98a6a"]
    },
    "entry": { "at": 0.5 },
    "cells": [
      { "archetype": "stockRoom" }
    ],
    "zones": [
      {
        "role": "window",
        "depth": [0.0, 0.16]
      },
      {
        "role": "browse",
        "depth": [0.16, 0.75]
      },
      {
        "role": "service",
        "depth": [0.75, 1.0]
      }
    ],
    "fixtures": [
      {
        "archetype": "podium",
        "zone": "window",
        "at": [0.15, 0.85]
      },
      {
        "archetype": "gondola",
        "zone": "browse",
        "run": [0.1, 0.38],
        "rows": 2
      },
      {
        "archetype": "gondola",
        "zone": "browse",
        "run": [0.58, 0.8],
        "rows": 2
      },
      {
        "archetype": "shelfWall",
        "zone": "browse",
        "wall": "right",
        "run": [0.04, 0.96]
      },
      {
        "archetype": "counter",
        "zone": "service",
        "run": [0.35, 0.65],
        "depth": 0.5
      },
      { "archetype": "plant", "zone": "service", "at": 0.1 }
    ]
  },
  department: {
    "id": "department",
    "label": "Department store",
    "finishes": { "floor": "marble", "wall": "paint", "paint": "#ece6dc", "sign": "#574f6a" },
    "palette": {
      "merch": ["#a56a6a", "#6a9c7a", "#7a8aac", "#c9a0a0", "#7aac9c", "#aa9c6a"]
    },
    "entry": { "at": 0.5, "width": 6 },
    "cells": [
      { "archetype": "fittingRoom", "count": 3 },
      { "archetype": "stockRoom", "minArea": 90 },
      { "archetype": "restroom" }
    ],
    "zones": [
      {
        "role": "window",
        "depth": [0.0, 0.12]
      },
      {
        "role": "browse",
        "depth": [0.12, 0.78]
      },
      {
        "role": "service",
        "depth": [0.78, 1.0]
      }
    ],
    "fixtures": [
      {
        "archetype": "podium",
        "zone": "window",
        "at": [0.15, 0.3, 0.7, 0.85]
      },
      {
        "archetype": "rackRun",
        "zone": "browse",
        "run": [0.06, 0.36],
        "rows": 3
      },
      {
        "archetype": "gondola",
        "zone": "browse",
        "run": [0.6, 0.86],
        "rows": 3
      },
      {
        "archetype": "podium",
        "zone": "browse",
        "grid": [1, 3],
        "run": [0.45, 0.55]
      },
      {
        "archetype": "shelfWall",
        "zone": "browse",
        "wall": "right",
        "run": [0.04, 0.96]
      },
      {
        "archetype": "counter",
        "zone": "service",
        "run": [0.38, 0.62],
        "depth": 0.5
      },
      { "archetype": "plant", "zone": "window", "at": 0.04 },
      { "archetype": "plant", "zone": "window", "at": 0.96 }
    ]
  },
  food: {
    "id": "food",
    "label": "Food counter",
    "finishes": { "floor": "marble", "floorTint": "#d8d0c2", "wall": "brick", "sign": "#9c6a3a" },
    "palette": {
      "merch": ["#c98a4a", "#5a8a4a", "#e0c070"]
    },
    "entry": { "at": 0.5, "width": 5 },
    "cells": [
      { "archetype": "stockRoom" }
    ],
    "zones": [
      {
        "role": "window",
        "depth": [0.0, 0.1]
      },
      {
        "role": "browse",
        "depth": [0.1, 0.68]
      },
      {
        "role": "service",
        "depth": [0.68, 0.88]
      },
      {
        "role": "back",
        "depth": [0.88, 1.0]
      }
    ],
    "fixtures": [
      {
        "archetype": "tableSet",
        "zone": "browse",
        "grid": [2, 2],
        "run": [0.05, 0.95]
      },
      {
        "archetype": "counter",
        "zone": "service",
        "run": [0.1, 0.9],
        "depth": 0.5,
        "tint": "#5a4a3a"
      },
      {
        "archetype": "backBar",
        "zone": "back",
        "run": [0.1, 0.9]
      },
      {
        "archetype": "pendantRow",
        "zone": "service",
        "run": [0.12, 0.88],
        "pitch": 4
      }
    ]
  },
  "wine-bar": {
    "id": "wine-bar",
    "label": "Wine bar",
    "finishes": { "floor": "floorboards", "floorTint": "#5e4331", "wall": "brick", "sign": "#6a2e38", "trim": "#a8864a" },
    "palette": {
      "merch": ["#7a2f3a", "#c9a06a", "#4f6f4a", "#3a2a30", "#b98a5a"]
    },
    "entry": { "at": 0.22 },
    "cells": [
      { "archetype": "stockRoom" },
      { "archetype": "booth", "count": 2 },
      { "archetype": "restroom" }
    ],
    "zones": [
      {
        "role": "window",
        "depth": [0.0, 0.12]
      },
      {
        "role": "browse",
        "depth": [0.12, 0.5]
      },
      {
        "role": "service",
        "depth": [0.5, 0.84]
      },
      {
        "role": "back",
        "depth": [0.84, 1.0]
      }
    ],
    "fixtures": [
      { "archetype": "plant", "zone": "window", "at": 0.92 },
      {
        "archetype": "banquette",
        "zone": "browse",
        "wall": "left",
        "run": [0.3, 0.95],
        "tint": "#6a2e38"
      },
      {
        "archetype": "tableSet",
        "zone": "browse",
        "grid": [2, 1],
        "run": [0.45, 0.95],
        "depth": 0.6
      },
      {
        "archetype": "counter",
        "zone": "service",
        "run": [0.34, 0.9],
        "depth": 0.5,
        "bar": true,
        "tint": "#3a2a24"
      },
      { "archetype": "stool", "along": "counter", "pitch": 2.4 },
      {
        "archetype": "pendantRow",
        "zone": "service",
        "run": [0.36, 0.88],
        "pitch": 4
      },
      {
        "archetype": "backBar",
        "zone": "back",
        "run": [0.3, 0.66]
      },
      {
        "archetype": "fridgeCase",
        "zone": "back",
        "run": [0.68, 0.98]
      },
      {
        "archetype": "wallArt",
        "zone": "service",
        "wall": "left",
        "run": [0.2, 0.7]
      }
    ],
    "cast": [
      {
        "archetype": "mannequin",
        "zone": "window",
        "at": 0.6,
        "sex": "female",
        "pose": "display",
        "outfit": {
          "layers": ["fittedShirt", "vest", "trousersSlim"]
        },
        "form": "#e2ddd3"
      }
    ]
  },
});

/** A card by seeded id, or the card object itself; null for an unknown id. */
export const resolveCard = (c) => (typeof c === 'string' ? SEEDED_CARDS[c] || null : c || null);
