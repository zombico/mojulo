### The metro's vehicles: civilian, city service and construction, each in its yard

- **A metro keeps its vehicles, each in its yard.** A geocity parked box cars in its car parks and none elsewhere. Now its
  vehicles are the vehicle registry's (`geocity/fleets.js`), each fleet by its role in the city. Every row is read
  through the registry to the realistic body it stands as:
  - **civilian**: the family cars of the car shelf;
  - **bus**: the bus;
  - **delivery**: vans and box trucks;
  - **utility**: works pickups and vans, each with an amber beacon;
  - **garbage**: green box trucks;
  - **construction**: the construction shelf's mixer and tipper trucks, wheel loader, skid steer, telehandler and backhoe.

  The taxi, police car, ambulance and fire engine have no realistic body yet. Each stands for now as the nearest that
  does (a sedan, a van, a box truck), in its livery, marked by its roof: a taxi's sign, red and blue or red light bars.
- **Yards by role.** The metro's design gives each parking block a yard by its own dice (`yards`). Each role takes its
  yards from the parking blocks out of the core first:
  - a bus depot, one for every thirty neighbourhoods or so, its buses in rows under a shed;
  - a works yard, as many, its garbage trucks and works pickups and vans;
  - an emergency station for every dozen, a brick station with its bays, its fire engines, ambulances and police cars;
  - the rest car parks, the registry's cars in their stalls, nose to the aisle.

  The vacant block nearest a neighbourhood's construction sites becomes its contractor's yard, its machines in rows
  behind the fence, a shed at its end. A new law, `yards`, holds a metro with car parks to a depot, a works yard and an
  emergency station.
- **Kerbs and sites.**
  - Every arterial's parking lanes are parked: a car in most stalls, each nose the way its side drives. In the core and
    the frame there is a delivery van or truck now and then; in the core, a taxi.
  - A construction site's mixer stands on the band along its back and its loader on the band beside it, with its
    excavator and tipper as before.
- **How it is drawn.** All of them are drawn near the camera as instanced repeats, each model once (`geotown/cars.js`):
  - a model may now be a realistic loft by its class (`loft:bus`) as well as a card, its paint split from its trim;
  - a roof's extra stands on the same transforms (`ROOF_EXTRAS`).

  A repeat may say `occlude: false`, and the ambient bake then makes no occluders of its instances, on the page and in
  the GLB. The metro's vehicles, its machines and its frontage say so, since a parked car or a window darkens nothing
  the bake needs; a metro's page otherwise ran out of memory expanding them. The page counts its `vehicles`, `machines`
  and `yards`. A default metro parks about 10,000 vehicles and 350 machines.
