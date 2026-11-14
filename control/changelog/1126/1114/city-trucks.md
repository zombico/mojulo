### The city's working trucks: medium-duty, Asian city trucks and delivery, realistic

The trucks that carry a city's goods, at their true numbers in the hull kit's language, as the haulers are, and named in
the vehicle registry. Each is a class, not a replica: no maker's face, badge or livery.

- **Six classes** (`car-designer/road-city-truck.js` over `city-truck-kit.js`, `roads/vehicles.js`, [E]):
  - `mediumTruck`, a medium-duty conventional (the haulers' bonneted cab) on its stake bed; `dump` gives it a tub that
    tips about its tail (`tipping`), `flatbed` a bare deck;
  - `lightCabover`, the Asian 2-ton cab-over: a narrow flat-faced cab over its front wheels, its door's low window, on
    small wheels and duals; its drop-side deck behind a gate guard, or by word a wing body (`open` lifts its wings about
    the ridge on its load), an aluminium box, a reefer, a dump tub or a knuckle-boom crane;
  - `wideCabover`, the 4-ton wide cab-over on its wing body, the same words;
  - `miniGoods`, a mini goods carrier, its deck and fixed sides, a tilt over bows `canvas`;
  - `cubeVan`, a cube van: a cutaway van's nose and cab, its box out over the cab's roof, its roll-up rear door
    (`unloading`);
  - `beverageTruck`, a side-bay beverage truck on the wide cab, its shutters rolled up `delivering` on stacked crates.
- **The registry**: rows for the medium duty truck, the 2-ton cab-over, the wing body truck, the mini goods carrier, the
  cube van and the beverage truck. Review: `scripts/render-haul.mjs`.
