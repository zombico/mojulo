// The roster's FACTS, beside the bauplans and never inside them, so adding a fact never changes a plan's bytes. Each
// worked bug's `about` row is what the encyclopedia entry (entries.js) says about it and how search finds it:
//   common   the name people say, lower case
//   aliases  other words for THIS animal, lower case, unique across the whole roster and never another id; a generic
//            word (bug, insect, spider, beetle, crab, ant …) belongs to ONE species: the one most people picture
//   sci      the binomial;  size  the published size the build is fit to;  source  where the size and the read come from
//   read     what makes it read as itself, one line (the thesis above its roster file, short)
// `wanted`: arthropods people ask for that no roster file builds yet, in the fauna entries' shape (`family`, `near`,
// `aliases`, `note`): the built bug that stands in, the words it is asked by, what the stand-in misses. Building one
// moves its aliases onto its new `about` row. The bug roster joins the animal encyclopedia (fauna/entries.js ROSTERS):
// its family is the class (insect, arachnid, crustacean, myriapod), its stance the order's leg count.

/** order (the bauplan's `order`) → its everyday group, its class and its leg count */
export const ORDERS = {
  Hymenoptera: { label: 'bees and wasps', cls: 'insect', legs: 6 }, Formicidae: { label: 'ants', cls: 'insect', legs: 6 },
  Diptera: { label: 'flies', cls: 'insect', legs: 6 }, Culicidae: { label: 'mosquitoes', cls: 'insect', legs: 6 },
  Coleoptera: { label: 'beetles', cls: 'insect', legs: 6 }, Curculionidae: { label: 'weevils', cls: 'insect', legs: 6 },
  Lepidoptera: { label: 'butterflies and moths', cls: 'insect', legs: 6 }, Orthoptera: { label: 'grasshoppers and crickets', cls: 'insect', legs: 6 },
  Hemiptera: { label: 'true bugs', cls: 'insect', legs: 6 }, Cicadidae: { label: 'cicadas', cls: 'insect', legs: 6 },
  Neuroptera: { label: 'lacewings', cls: 'insect', legs: 6 }, Ephemeroptera: { label: 'mayflies', cls: 'insect', legs: 6 },
  Odonata: { label: 'dragonflies', cls: 'insect', legs: 6 }, Mantodea: { label: 'mantises', cls: 'insect', legs: 6 },
  Phasmida: { label: 'stick insects', cls: 'insect', legs: 6 }, Dermaptera: { label: 'earwigs', cls: 'insect', legs: 6 },
  Blattodea: { label: 'cockroaches', cls: 'insect', legs: 6 }, Siphonaptera: { label: 'fleas', cls: 'insect', legs: 6 },
  Araneae: { label: 'spiders', cls: 'arachnid', legs: 8 }, Opiliones: { label: 'harvestmen', cls: 'arachnid', legs: 8 },
  Ixodida: { label: 'ticks', cls: 'arachnid', legs: 8 }, Scorpiones: { label: 'scorpions', cls: 'arachnid', legs: 8 },
  Xiphosura: { label: 'horseshoe crabs (sea cousins of the arachnids)', cls: 'arachnid', legs: 10 },
  Brachyura: { label: 'crabs', cls: 'crustacean', legs: 10 }, Astacidea: { label: 'clawed lobsters and crayfish', cls: 'crustacean', legs: 10 },
  Achelata: { label: 'spiny and slipper lobsters', cls: 'crustacean', legs: 10 }, Isopoda: { label: 'woodlice', cls: 'crustacean', legs: 14 },
  Chilopoda: { label: 'centipedes', cls: 'myriapod', legs: 30 }, Diplopoda: { label: 'millipedes', cls: 'myriapod', legs: 'many' },
};


/** each worked bug's facts (the fauna entries' `about` shape, plus `read`: what makes it read, one line) */
export const about = {
  honeyBee: { common: 'honey bee', aliases: ['bee', 'honeybee', 'worker bee', 'insect'], sci: 'Apis mellifera', size: '12–15 mm long', source: 'Winston 1987, The Biology of the Honey Bee', read: 'amber-and-black banded abdomen, a fuzzy thorax, elbowed antennae, two pairs of clear wings' },
  houseFly: { common: 'house fly', aliases: ['fly', 'housefly', 'common fly'], sci: 'Musca domestica', size: '6–7 mm long', source: 'Hewitt 1914, The House-Fly', read: 'a round head nearly all red eye, a grey striped thorax, one pair of clear wings in a V' },
  grasshopper: { common: 'grasshopper', aliases: ['differential grasshopper', 'hopper'], sci: 'Melanoplus differentialis', size: '28–44 mm long', source: 'Capinera et al. 2004, Field Guide to Grasshoppers, Katydids, and Crickets of the United States', read: 'huge jumping hind legs with the knee high behind, a saddle pronotum, leathery wings along the back' },
  ladybird: { common: 'ladybird', aliases: ['ladybug', 'lady beetle', 'ladybird beetle', 'seven-spot ladybird', 'bug'], sci: 'Coccinella septempunctata', size: '5–8 mm long', source: 'Majerus 1994, Ladybirds', read: 'a red half-dome with seven black spots, a black pronotum with white corners' },
  stagBeetle: { common: 'stag beetle', aliases: ['beetle', 'european stag beetle'], sci: 'Lucanus cervus', size: 'male 35–75 mm with the mandibles', source: 'Harvey et al. 2011, The ecology and conservation of stag beetles', read: 'antler mandibles as long as the head and pronotum, a broad head, chestnut wing cases' },
  monarch: { common: 'monarch butterfly', aliases: ['butterfly', 'monarch'], sci: 'Danaus plexippus', size: 'wingspan 89–102 mm, body ~28 mm', source: 'Oberhauser & Solensky 2004, The Monarch Butterfly', read: 'broad orange wings with black veins and a white-dotted black border, clubbed antennae' },
  carpenterAnt: { common: 'carpenter ant', aliases: ['ant', 'black ant', 'black carpenter ant'], sci: 'Camponotus pennsylvanicus', size: '6–13 mm long', source: 'Hansen & Klotz 2005, Carpenter Ants of the United States and Canada', read: 'three glossy black beads on a string: a big head, a slim thorax, a one-node waist, a round gaster' },
  prayingMantis: { common: 'praying mantis', aliases: ['mantis', 'mantid', 'european mantis'], sci: 'Mantis religiosa', size: '60–75 mm long', source: 'Ehrmann 2002, Mantodea: Gottesanbeterinnen der Welt', read: 'a long neck-like prothorax raised at the front, folded spiny grasping forelegs, a triangular head' },
  dragonfly: { common: 'dragonfly', aliases: ['green darner', 'common green darner', 'darner'], sci: 'Anax junius', size: '68–80 mm long, wingspan to 116 mm', source: 'Paulson 2011, Dragonflies and Damselflies of the East', read: 'a long thin blue abdomen, a green thorax, a head nearly all eye, four clear wings held flat out' },
  gardenSpider: { common: 'garden spider', aliases: ['spider', 'cross spider', 'european garden spider', 'orb weaver', 'orb-weaver'], sci: 'Araneus diadematus', size: 'female body 10–20 mm', source: 'Roberts 1995, Spiders of Britain and Northern Europe', read: 'eight long high-kneed legs on a small front body, a big round abdomen with a white cross' },
  mosquito: { common: 'mosquito', aliases: ['yellow fever mosquito', 'aedes', 'skeeter'], sci: 'Aedes aegypti', size: '4–7 mm long', source: 'Christophers 1960, Aedes aegypti: the Yellow Fever Mosquito', read: 'a tiny humped body slung between very long white-ringed legs, a long piercing proboscis' },
  cockroach: { common: 'cockroach', aliases: ['roach', 'american cockroach', 'palmetto bug'], sci: 'Periplaneta americana', size: '34–53 mm long', source: 'Bell, Roth & Nalepa 2007, Cockroaches', read: 'a flat glossy red-brown oval under a shield that hides the head, whip antennae, splayed running legs' },
  centipede: { common: 'centipede', aliases: ['brown centipede', 'stone centipede'], sci: 'Lithobius forficatus', size: '18–30 mm long', source: 'Lewis 1981, The Biology of Centipedes', read: 'a flat ribbon of fifteen plates, one pair of splayed legs each, poison claws under the head' },
  millipede: { common: 'millipede', aliases: ['giant millipede', 'american giant millipede'], sci: 'Narceus americanus', size: '40–100 mm long', source: 'Hoffman 1999, Checklist of the Millipeds of North and Middle America', read: 'a long round glossy tube of many rings, two pairs of short legs under each in a slow wave' },
  woodlouse: { common: 'woodlouse', aliases: ['sow bug', 'sowbug', 'slater', 'common woodlouse'], sci: 'Oniscus asellus', size: 'up to 16 mm long', source: 'Hopkin 1991, A Key to the Woodlice of Britain and Ireland', read: 'a grey oval dome of seven overlapping plates, flat beneath, elbowed antennae, two tail spikes' },
  scorpion: { common: 'scorpion', aliases: ['bark scorpion', 'arizona bark scorpion'], sci: 'Centruroides sculpturatus', size: '70–80 mm with the tail', source: 'Stockwell 1992, Scorpions of the Southwest', read: 'long pincers held forward and a five-segment tail curled over the back to a sting' },
  greenCrab: { common: 'green crab', aliases: ['crab', 'shore crab', 'european green crab'], sci: 'Carcinus maenas', size: 'carapace to 90 mm wide', source: 'Crothers 1967, The biology of the shore crab', read: 'a broad flat shell wider than long, two claws folded across the face, legs splayed sideways' },
  shieldBug: { common: 'shield bug', aliases: ['green shield bug', 'stink bug', 'stinkbug'], sci: 'Palomena prasina', size: '12–14 mm long', source: 'Southwood & Leston 1959, Land and Water Bugs of the British Isles', read: 'a flat bright-green shield widest at the shoulders, a big triangular scutellum' },
  cicada: { common: 'cicada', aliases: ['periodical cicada', '17-year cicada', 'seventeen-year cicada'], sci: 'Magicicada septendecim', size: 'body 24–33 mm, 33–38 mm to the wing tips', source: 'Marlatt 1907, The Periodical Cicada (USDA Bur. Ent. Bull. 71)', read: 'a stout black body under clear orange-veined wings held as a steep roof, big red eyes' },
  weevil: { common: 'weevil', aliases: ['acorn weevil', 'snout beetle'], sci: 'Curculio glandium', size: '4.5–8 mm without the snout', source: 'Hoffmann 1954, Faune de France 62 (Curculionides)', read: 'a pear-shaped brown beetle with a thin snout as long as its body' },
  lacewing: { common: 'lacewing', aliases: ['green lacewing', 'common green lacewing'], sci: 'Chrysoperla carnea', size: 'body 9–11 mm, forewing 10–13 mm', source: 'Canard, Séméria & New 1984, Biology of Chrysopidae', read: 'a slim pale-green body under big clear green-veined wings held as a tent, golden eyes' },
  mayfly: { common: 'mayfly', aliases: ['green drake', 'green drake mayfly'], sci: 'Ephemera danica', size: 'body 16–24 mm, tails to ~1.5× the body', source: 'Elliott & Humpesch 1983, A key to the adults of the British Ephemeroptera', read: 'big triangular wings upright like a sail, a curved abdomen ending in three long tails' },
  stickInsect: { common: 'stick insect', aliases: ['walking stick', 'stick bug', 'phasmid', 'indian stick insect'], sci: 'Carausius morosus', size: 'female 70–84 mm long', source: 'Brock 1999, Stick and Leaf Insects of Britain and Europe', read: 'a wingless pencil-thin twig of a body, the forelegs stretched straight forward' },
  earwig: { common: 'earwig', aliases: ['common earwig', 'european earwig', 'pincher bug'], sci: 'Forficula auricularia', size: '12–15 mm without the forceps', source: 'Brindle 1977, British Earwigs', read: 'a long flat brown body ending in curved pincers (forceps), short square wing covers' },
  flea: { common: 'flea', aliases: ['cat flea'], sci: 'Ctenocephalides felis', size: 'female 2.5 mm long', source: 'Dryden & Rust 1994, The cat flea (Vet. Parasitol. 52)', read: 'a body flattened side to side, a helmet head, big folded hind legs for the jump' },
  tick: { common: 'tick', aliases: ['sheep tick', 'castor bean tick'], sci: 'Ixodes ricinus', size: '3–4 mm unfed, with the mouthparts', source: 'Hillyard 1996, Ticks of North-West Europe', read: 'a flat teardrop with no head, mouthparts sticking forward, eight legs from the front half' },
  harvestman: { common: 'harvestman', aliases: ['daddy longlegs', 'daddy long legs', 'daddy long-legs', 'harvest spider'], sci: 'Phalangium opilio', size: 'body 4–9 mm, legs to ~40 mm', source: 'Hillyard 2005, Harvestmen (Synopses of the British Fauna 4)', read: 'one small oval body with no waist slung low between eight hair-thin very long legs' },
  lobster: { common: 'lobster', aliases: ['american lobster', 'maine lobster'], sci: 'Homarus americanus', size: '~230 mm long (commonly 200–610 mm)', source: 'NOAA Fisheries, American Lobster species page', read: 'two big unequal claws held forward, a long ringed tail ending in a fan, olive to brown-black' },
  horseshoeCrab: { common: 'horseshoe crab', aliases: ['atlantic horseshoe crab', 'limulus'], sci: 'Limulus polyphemus', size: 'female ~46–48 cm with the tail spike', source: 'Shuster, Barlow & Brockmann 2003, The American Horseshoe Crab', read: 'a low smooth horseshoe-shaped dome hiding every leg, a long straight spike tail' },
  spinyLobster: { common: 'spiny lobster', aliases: ['caribbean spiny lobster', 'rock lobster'], sci: 'Panulirus argus', size: 'commonly ~20 cm, up to 45 cm', source: 'Holthuis 1991, FAO Species Catalogue vol. 13, Marine Lobsters of the World', read: 'no claws: two huge thick spiny antennae in a wide V, horns over the eyes' },
  slipperLobster: { common: 'slipper lobster', aliases: ['mediterranean slipper lobster', 'shovel-nosed lobster', 'locust lobster'], sci: 'Scyllarides latus', size: 'commonly ~30 cm, up to 45 cm', source: 'Holthuis 1991, FAO Species Catalogue vol. 13, Marine Lobsters of the World', read: 'no claws, no whips: a broad flat paving stone of a body with flat antenna plates for a shovel' },
  europeanLobster: { common: 'european lobster', aliases: ['common lobster', 'blue lobster'], sci: 'Homarus gammarus', size: '230–380 mm long, up to 600 mm', source: 'MarLIN / FAO species fact sheet, Homarus gammarus', read: 'the clawed lobster in navy blue-black above, cream beneath, a little slimmer than the American' },
  crayfish: { common: 'crayfish', aliases: ['red swamp crayfish', 'crawfish', 'crawdad', 'mudbug', 'louisiana crawfish'], sci: 'Procambarus clarkii', size: '55–120 mm long', source: 'CABI Invasive Species Compendium, Procambarus clarkii', read: 'a small deep-red lobster shape: a deep grooved carapace, a short tail, equal long narrow claws' },
  langoustine: { common: 'langoustine', aliases: ['norway lobster', 'dublin bay prawn', 'scampi'], sci: 'Nephrops norvegicus', size: 'usually 18–20 cm, at most 24 cm', source: 'Holthuis 1991, FAO Species Catalogue vol. 13, Marine Lobsters of the World', read: 'a slender pale orange-pink lobster with long thin near-equal claws and big black eyes' },
  herculesBeetle: { common: 'hercules beetle', aliases: ['dynastes hercules'], sci: 'Dynastes hercules', size: 'body 50–85 mm, males to ~173 mm with the horns', source: 'Animal Diversity Web, Dynastes hercules', read: 'a pincer of two horns: a long black thoracic horn arching over a head horn curling up to meet it, khaki wing cases' },
  rhinoBeetle: { common: 'rhinoceros beetle', aliases: ['rhino beetle', 'european rhinoceros beetle'], sci: 'Oryctes nasicornis', size: '20–42 mm long', source: 'Wikipedia, European rhinoceros beetle', read: 'a stout glossy chestnut beetle with one horn on the head curving back' },
  goliathBeetle: { common: 'goliath beetle', aliases: ['goliathus'], sci: 'Goliathus goliatus', size: 'males 50–110 mm long', source: 'Wikipedia, Goliathus goliatus', read: 'a massive broad flat beetle, a white pronotum with bold black stripes, a short forked horn' },
  dungBeetle: { common: 'dung beetle', aliases: ['sacred scarab', 'scarab', 'scarab beetle'], sci: 'Scarabaeus sacer', size: '26–40 mm long', source: 'Baraud 1992, Coléoptères Scarabaeoidea d\'Europe', read: 'a broad flat matte-black beetle with a toothed shovel head and raking forelegs' },
  cockchafer: { common: 'cockchafer', aliases: ['may bug', 'maybug', 'common cockchafer'], sci: 'Melolontha melolontha', size: '25–30 mm long', source: 'Harde 1984, A Field Guide in Colour to Beetles', read: 'a stout chestnut barrel, a black head and pronotum, fan antennae, white triangles on the flanks, a pointed tail' },
  firefly: { common: 'firefly', aliases: ['lightning bug', 'common eastern firefly', 'big dipper firefly'], sci: 'Photinus pyralis', size: '10–14 mm long', source: 'Lloyd 1966, Studies on the flash communication system in Photinus fireflies', read: 'a soft narrow dark beetle, a pink shield with a black spot hiding the head, a pale yellow lantern' },
  potatoBeetle: { common: 'colorado potato beetle', aliases: ['potato beetle', 'potato bug', 'colorado beetle'], sci: 'Leptinotarsa decemlineata', size: '6–12 mm long', source: 'Hare 1990, Annu. Rev. Entomol. 35', read: 'a high cream dome with ten black stripes, an orange spotted pronotum' },
  tigerBeetle: { common: 'tiger beetle', aliases: ['green tiger beetle'], sci: 'Cicindela campestris', size: '12–16 mm long', source: 'Luff 2007, The Carabidae of Britain and Ireland (RES Handbook 4/2)', read: 'a metallic-green cream-spotted sprinter on long legs, a head wider than its pronotum, sickle jaws' },
  divingBeetle: { common: 'diving beetle', aliases: ['great diving beetle', 'water beetle'], sci: 'Dytiscus marginalis', size: '27–35 mm long', source: 'Nilsson & Holmen 1995, The Aquatic Adephaga of Fennoscandia and Denmark II', read: 'a smooth flat streamlined dark oval with a yellow rim, hind legs as flat oars' },
  longhornBeetle: { common: 'longhorn beetle', aliases: ['longicorn', 'rosalia longicorn', 'rosalia', 'longhorned beetle'], sci: 'Rosalia alpina', size: '15–38 mm long', source: 'Russo et al. 2017, Rosalia alpina monitoring guidelines (Nature Conservation 20)', read: 'a narrow ash-blue beetle with black velvet bands and ringed antennae twice its length' },
};

/** asked-for arthropods not built: the nearest built bug stands in (`near`), and what it misses (`note`) */
export const wanted = {
  wasp: { family: 'insect', near: 'honeyBee', aliases: ['yellowjacket', 'yellow jacket'], note: 'smooth not fuzzy, a thin waist, bright yellow and black' },
  hornet: { family: 'insect', near: 'honeyBee', aliases: [], note: 'bigger, a thin waist, brown and yellow' },
  bumblebee: { family: 'insect', near: 'honeyBee', aliases: ['bumble bee'], note: 'round and furry, broad black and yellow bands' },
  moth: { family: 'insect', near: 'monarch', aliases: ['luna moth', 'moth butterfly'], note: 'feathery antennae, a fat furry body, dull wings laid flat or tented' },
  cricket: { family: 'insect', near: 'grasshopper', aliases: ['house cricket', 'field cricket'], note: 'long thread antennae past the body, flat wings, two tail cerci' },
  katydid: { family: 'insect', near: 'grasshopper', aliases: ['bush cricket'], note: 'leaf-green wings like a leaf, very long antennae' },
  locust: { family: 'insect', near: 'grasshopper', aliases: ['desert locust'], note: 'a swarming grasshopper: much the same body' },
  termite: { family: 'insect', near: 'carpenterAnt', aliases: ['white ant'], note: 'pale and soft, no waist, straight beaded antennae' },
  aphid: { family: 'insect', near: 'shieldBug', aliases: ['greenfly', 'plant louse'], note: 'a tiny soft pear-shaped body, two tail tubes (cornicles)' },
  bedBug: { family: 'arachnid', near: 'tick', aliases: ['bedbug'], note: 'six legs and antennae, a flat red-brown oval with a small head' },
  louse: { family: 'insect', near: 'flea', aliases: ['head louse', 'lice'], note: 'flattened top to bottom, claw legs for gripping hair, no jumping legs' },
  damselfly: { family: 'insect', near: 'dragonfly', aliases: [], note: 'slimmer, the eyes apart, the wings folded together over the back' },
  horsefly: { family: 'insect', near: 'houseFly', aliases: ['horse fly', 'gadfly'], note: 'bigger, banded eyes, a heavier body' },
  gnat: { family: 'insect', near: 'mosquito', aliases: ['midge'], note: 'shorter legs, no long proboscis' },
  caterpillar: { family: 'myriapod', near: 'millipede', aliases: ['larva', 'grub'], note: 'a soft tube with three pairs of true legs and stubby prolegs behind; no larva body yet' },
  silverfish: { family: 'insect', near: 'earwig', aliases: [], note: 'a wingless silver teardrop, three tail bristles, no pincers' },
  junebug: { family: 'insect', near: 'cockchafer', aliases: ['june bug', 'june beetle'], note: 'a smaller brown chafer, short club antennae' },
  tarantula: { family: 'arachnid', near: 'gardenSpider', aliases: ['bird-eating spider', 'birdeater'], note: 'big and hairy, thick legs, a smaller abdomen, the fangs pointing down' },
  blackWidow: { family: 'arachnid', near: 'gardenSpider', aliases: ['widow spider'], note: 'glossy black, a round abdomen with a red hourglass beneath' },
  jumpingSpider: { family: 'arachnid', near: 'gardenSpider', aliases: [], note: 'compact and furry, two huge forward eyes, short stout legs' },
  wolfSpider: { family: 'arachnid', near: 'gardenSpider', aliases: [], note: 'a ground hunter, brown striped, a long abdomen, sturdy legs' },
  mite: { family: 'arachnid', near: 'tick', aliases: ['dust mite', 'spider mite'], note: 'tiny and rounder, the mouthparts small' },
  hermitCrab: { family: 'crustacean', near: 'greenCrab', aliases: [], note: 'a soft curled abdomen tucked into a borrowed snail shell' },
  fiddlerCrab: { family: 'crustacean', near: 'greenCrab', aliases: [], note: 'one huge claw held up, eyes on long stalks' },
  kingCrab: { family: 'crustacean', near: 'greenCrab', aliases: ['red king crab', 'alaskan king crab'], note: 'long spiny legs, a spiny shell, small claws' },
  shrimp: { family: 'crustacean', near: 'langoustine', aliases: ['prawn'], note: 'no big claws, a curved body, long feelers, swimming legs under the tail' },
  krill: { family: 'crustacean', near: 'langoustine', aliases: [], note: 'a small clear shrimp, no claws, feathery legs' },
  pillBug: { family: 'crustacean', near: 'woodlouse', aliases: ['pillbug', 'roly-poly', 'roly poly', 'pill woodlouse'], note: 'a higher dome that rolls into a ball, no tail spikes' },
  trilobite: { family: 'crustacean', near: 'woodlouse', aliases: [], note: 'extinct and its own class, not a crustacean: a three-lobed oval shell, a broad head shield' },
};

/** a worked bug's class (its encyclopedia family) and stance word, from its order */
export const classOf = (order) => ORDERS[order]?.cls;
export function stanceOfOrder(order) {
  const n = ORDERS[order]?.legs;
  return { 6: 'hexapod', 8: 'octopod', 10: 'decapod', 14: 'isopod' }[n] || (n ? 'myriapod' : null);
}
