/**
 * The record for Qin Xianyang and the Lishan works (Guanzhong, the Wei valley), read at c. 212 BCE: the
 * year Epang Palace was begun, with the First Emperor's tomb still building. Format and checks: ../record.js.
 *
 * `confidence`: 'read' = a page stating the fact was fetched and read (most through a model summary of the
 * page, so numbers were read back, not seen in the original); 'secondary' = known through a page that names
 * the source; 'unverified' = a search snippet or the standard account only. The authoritative Lishan source,
 * 秦始皇帝陵园考古报告（2011~2018） (Science Press), was not in hand: the Lishan numbers marked unverified wait on it.
 * The design language these feed: docs/historic/qin/README.md and ../style/qin.js.
 *
 * Settled by the record, read by the layout:
 *  - Xianyang has NO outer city wall in the record. Modern archaeology has found none and scholars disagree
 *    whether one stood. A town drawn with one draws a conjecture, and must say so.
 *  - Roofs are straight. Upswept eaves (form 'curved-eaves') are dated centuries later and disputed in
 *    detail; no source puts them in Qin.
 *  - The Lishan triple que stand on the east–west axis BETWEEN the inner and outer gates, not at the outer gate.
 *  - The Han analogues (Gaoyi que, pottery tower models, the Sichuan market brick) are typed with their real
 *    CE dates, so `inUseAt(-212)` excludes them: a Qin scene may borrow one only by naming it as an analogue.
 *
 * Anachronisms the generator must not use for 212 BCE (each held with its real date): glazed roof tiles
 * (building use from the 5th century CE); upswept eaves; the burning of Xianyang (206 BCE, after); Epang
 * finished (it never was).
 */

// ── sources ──────────────────────────────────────────────────────────────────────────────────────────
const S = {
  zhXianyangSite: { author: 'Wikipedia (zh)', title: '秦咸阳城遗址', year: 2026, url: 'https://zh.wikipedia.org/wiki/秦咸阳城遗址', via: 'read' },
  zhXianyangPalace: { author: 'Wikipedia (zh)', title: '咸阳宫', year: 2026, url: 'https://zh.wikipedia.org/wiki/咸阳宫', via: 'read; secondary to the works it cites' },
  enXianyangPalace: { author: 'Wikipedia', title: 'Xianyang Palace', year: 2026, url: 'https://en.wikipedia.org/wiki/Xianyang_Palace', via: 'read; secondary to the works it cites' },
  liuChen1976: { author: '刘庆柱, 陈国英', title: '秦都咸阳第一号宫殿建筑遗址简报 (文物 1976.11)', year: 1976, via: 'search snippet only; not read' },
  yang1976: { author: '杨鸿勋', title: '秦咸阳宫第一号遗址复原问题的初步探讨 (文物 1976.11)', year: 1976, via: 'search snippet only; not read' },
  sohuPalace1: { author: 'Sohu (popular article)', title: '咸阳宫一号宫殿遗址', year: 2020, url: 'https://www.sohu.com/a/439150617_695009', via: 'read' },
  sohuComplex: { author: 'Sohu (popular article)', title: '秦咸阳宫遗址', year: 2017, url: 'https://mt.sohu.com/cul/d20170623/151419791_428863.shtml', via: 'read' },
  chinaculture: { author: 'chinaculture.org', title: 'Xianyang Palace site', year: 2008, url: 'http://en.chinaculture.org/library/2008-02/15/content_33579.htm', via: 'read' },
  weiBridge: { author: 'China News', title: '渭桥考古 (厨城门一号桥)', year: 2013, url: 'https://www.chinanews.com/cul/2013/01-14/4486555.shtml', via: 'read; the summary was internally garbled' },
  zhEpang: { author: 'Wikipedia (zh)', title: '阿房宫 (citing 考古学报 for the 2002–2007 excavation)', year: 2026, url: 'https://zh.wikipedia.org/wiki/阿房宫', via: 'read; secondary to the works it cites' },
  thepaperTiles: { author: 'The Paper (popular article)', title: '秦汉瓦当', year: 2018, url: 'https://www.thepaper.cn/newsDetail_forward_2353217', via: 'read; examples from a private museum, Qin vs Han dating unclear' },
  jieshi: { author: 'news.lnd.com.cn', title: '碣石宫夔纹大瓦当', year: 2023, url: 'https://news.lnd.com.cn/system/2023/02/03/030379786.shtml', via: 'read' },
  baikeKui: { author: 'Baidu Baike', title: '秦夔纹大瓦当', year: 2026, via: 'search snippet only' },
  hollowBrick: { author: '163.com (popular article)', title: '秦咸阳宫龙纹空心砖', year: 2020, url: 'https://www.163.com/dy/article/FMDNU3VQ05338UMA.html', via: 'read' },
  snippetsHangtu: { author: 'various (sxlib, Baidu Baike)', title: 'Qin rammed-earth layer thicknesses at Lishan, Epang and the pits', year: 2026, via: 'search snippets only' },
  snippetsLishan: { author: 'various (sxlib, Baidu Baike)', title: 'Lishan enclosure walls, cross wall, sleeping hall, triple que, paving bricks', year: 2026, via: 'search snippets only' },
  enLishan: { author: 'Wikipedia', title: 'Mausoleum of the First Qin Emperor', year: 2026, url: 'https://en.wikipedia.org/wiki/Mausoleum_of_the_First_Qin_Emperor', via: 'read; secondary to the works it cites' },
  zhLishan: { author: 'Wikipedia (zh)', title: '秦始皇陵', year: 2026, url: 'https://zh.wikipedia.org/wiki/秦始皇陵', via: 'read; secondary to the works it cites' },
  dili360: { author: '中国国家地理 (dili360)', title: '秦始皇陵', year: 2026, url: 'https://www.dili360.com', via: 'read' },
  rmzxwGate: { author: '人民政协网', title: '秦始皇帝陵外城东门遗址', year: 2022, url: 'https://www.rmzxw.com.cn/c/2022-01-25/3036481.shtml', via: 'read' },
  enArmy: { author: 'Wikipedia', title: 'Terracotta Army', year: 2026, url: 'https://en.wikipedia.org/wiki/Terracotta_Army', via: 'read; secondary to the works it cites' },
  tcgArmy: { author: 'Travel China Guide', title: 'Terracotta Warriors and Horses', year: 2026, url: 'https://www.travelchinaguide.com/cityguides/xian/terracotta.htm', via: 'read' },
  scalarArmy: { author: 'USC Scalar', title: 'Terracotta Army: Pit 1', year: 2026, url: 'https://scalar.usc.edu', via: 'read' },
  zhGaoyi: { author: 'Wikipedia (zh)', title: '高頤闕', year: 2026, url: 'https://zh.wikipedia.org/wiki/高頤闕', via: 'read' },
  enChineseArch: { author: 'Wikipedia', title: 'Chinese architecture', year: 2026, url: 'https://en.wikipedia.org/wiki/Chinese_architecture', via: 'read' },
  snippetsHan: { author: 'various', title: 'Sichuan market-scene pictorial bricks (Xindu, Guanghan)', year: 2026, via: 'search snippets only' },
  snippetsRoofs: { author: 'various', title: 'dating of upswept eaves and of building-grade glazed tiles (incl. a Palace Museum paper, unread)', year: 2026, via: 'search snippets only' },
  snippetsBrackets: { author: 'lhsr.sh.gov.cn and others', title: 'early bracket sets (Zhongshan bronze table, Pingshan)', year: 2026, via: 'search snippet only' },
  tang2022: { author: 'Tang et al.', title: 'Crop remains at Matengkong, Xi\'an (Frontiers in Ecology and Evolution)', year: 2022, url: 'https://doi.org/10.3389/fevo.2022.992980', via: 'read' },
  zhZhengguo: { author: 'Wikipedia (zh)', title: '郑国渠 (citing 史记·河渠书)', year: 2026, url: 'https://zh.wikipedia.org/wiki/郑国渠', via: 'read; secondary to the Shiji' },
};

/** The year a Qin scene is read at, and the dates around it (BCE negative). */
export const QIN_READ_AT = -212;
export const QIN_DATES = {
  xianyangCapital: -350, lishanBegun: -246, unification: -221, epangBegun: -212, emperorDies: -210, lishanCompleted: -208, xianyangBurned: -206,
};

// ── materials ────────────────────────────────────────────────────────────────────────────────────────
const MATERIALS = [
  {
    id: 'loess-hangtu', kind: 'material', name: 'rammed loess (夯土)', confidence: 'unverified',
    attested: { from: -350, to: null, approx: true, where: ['Xianyang palace terraces', 'Epang front hall', 'Lishan walls and mound', 'the army pits\' partitions'] },
    supply: 'the Guanzhong loess, dug on site', role: ['wall', 'foundation', 'structure'], colour: ['#b79065', '#d7b589'],
    notes: 'The one building earth of the town. Long in use before Qin; dated here from the Qin capital. Colours sampled from the reference palette, not measured.',
    sources: [S.snippetsHangtu, S.zhXianyangSite],
  },
  {
    id: 'grey-tile', kind: 'material', name: 'unglazed grey fired tiles: half-round cover (筒瓦), flat pan (板瓦)', confidence: 'unverified',
    attested: { from: -350, to: null, approx: true, where: ['Xianyang', 'Lishan'] },
    supply: 'fired in kilns round the capital', role: ['roof'], colour: ['#7f796f'],
    notes: 'One popular source gives a cover tile 50 cm long and a pan tile 60 × 45 × 2.5 cm; it is weak (private-museum pieces, Qin vs Han dating unclear). No authoritative dimensions found.',
    sources: [S.thepaperTiles],
  },
  {
    id: 'wadang-round', kind: 'material', name: 'round eave-end tile (瓦当), cloud scroll and figured', confidence: 'unverified',
    attested: { from: -350, to: null, approx: true, where: ['Xianyang', 'Lishan'] },
    supply: 'moulded on the end of the eave cover tile', role: ['roof', 'ornament'], colour: ['#7f796f'],
    notes: 'About 16 cm across (Warring States 14–16 cm; inscribed Xianyang pieces 16–17 cm, snippets). Motifs: cloud scroll (the common Qin face), deer, toad (read). A popular article gives 18–19 cm, max 22 cm, from pieces of uncertain date.',
    disputes: ['Diameter: 14–17 cm (snippets) against 18–22 cm (one popular article of uncertain dating).'],
    sources: [S.thepaperTiles],
  },
  {
    id: 'wadang-kui', kind: 'material', name: 'giant kui-pattern half-round eave tile (夔纹大瓦当)', confidence: 'read',
    attested: { from: -215, to: null, approx: true, where: ['Jieshi palace (Suizhong)', 'Lishan, building 2 north of the mound (snippet)'] },
    supply: 'moulded for imperial buildings only', role: ['roof', 'ornament'], colour: ['#7f796f'],
    notes: 'Jieshi: face about 52 cm wide, 37 cm high, 2.5 cm thick, tile body about 68 cm (read). Lishan: 61 cm wide, 48 cm high (snippet). Imperial ridge-and-eave scale; the kit\'s 16 cm disc is the ordinary tile.',
    disputes: ['Jieshi tile-body length: 68 cm (read) against 78 cm (snippets).'],
    sources: [S.jieshi, S.baikeKui],
  },
  {
    id: 'hollow-brick', kind: 'material', name: 'hollow brick (空心砖), dragon, phoenix and geometric patterns', confidence: 'read',
    attested: { from: -350, to: null, approx: true, where: ['Xianyang Palace No. 1 (stair treads)'] },
    supply: 'kiln-fired', role: ['paving'], colour: ['#8a857c'],
    unit: { l: 100, w: 38, h: 16.5 },
    notes: 'The dragon-pattern piece from Palace No. 1 (excavated 1975, National Museum of China): 100 × 38 × 16.5 cm, a stair tread. Colour estimated.',
    sources: [S.hollowBrick],
  },
  {
    id: 'paving-brick', kind: 'material', name: 'solid grey paving bricks, long and square', confidence: 'unverified',
    attested: { from: -246, to: null, approx: true, where: ['Lishan', 'the army pits\' corridor floors'] },
    supply: 'kiln-fired', role: ['paving'], colour: ['#7d7a73'],
    unit: { l: 36, w: 36, h: 5 },
    notes: 'Lishan: long bricks 27 × 13.5 × 6.6, 39 × 19 × 9.5 and 41 × 13.5 × 9 cm; square bricks 36 × 36 × 5 cm (snippet). Pit 1\'s floors are brick-paved (read, enArmy).',
    sources: [S.snippetsLishan, S.enArmy],
  },
  {
    id: 'timber-post', kind: 'material', name: 'timber posts, beams and rafters', confidence: 'unverified',
    attested: { from: -350, to: null, approx: true, where: ['Xianyang Palace No. 1 (central column)', 'Pit 1 (posts and beams)'] },
    supply: 'the Qinling and the hills of Guanzhong', role: ['structure', 'roof'],
    notes: 'Palace No. 1\'s central column (都柱) about 60 cm across (snippet). Pit 1 roofed with timber posts and beams (read, enArmy). Stone plinth sizes not found: the kit\'s 0.8 m base is from the reference drawing.',
    sources: [S.liuChen1976, S.enArmy],
  },
  {
    id: 'red-lacquer', kind: 'material', name: 'red lacquer or red paint on columns', confidence: 'unverified',
    attested: { from: -350, to: null, approx: true, where: [] },
    supply: 'lacquer and cinnabar or iron red', role: ['finish'], colour: ['#9a3d2a'],
    notes: 'CONJECTURE for the columns: no source found states it. What is read is red nearby: Palace No. 1\'s main hall floor coated in cinnabar, and red among the corridor murals\' pigments. The kit keeps red columns as the standard reading, flagged here.',
    sources: [S.sohuPalace1, S.sohuComplex],
  },
  {
    id: 'mural-pigments', kind: 'material', name: 'mineral pigments: red, black, white, vermilion, purple-red, ochre, azurite, malachite', confidence: 'read',
    attested: { from: -350, to: null, approx: true, where: ['Xianyang palace murals', 'the terracotta figures'] },
    supply: 'mineral ores', role: ['finish'], colour: ['#9a3d2a', '#2f5d8a', '#3f7d5a', '#e9e2d0'],
    notes: 'Palace murals (sohuComplex). The figures were painted in iron-oxide red, cinnabar, malachite and azurite among others (enArmy). Colours estimated.',
    sources: [S.sohuComplex, S.enArmy],
  },
  {
    id: 'floor-build-up', kind: 'material', name: 'palace floor: burnt clay, straw mud, chaff mud, pebble-burnished, cinnabar coat', confidence: 'read',
    attested: { from: -350, to: null, approx: true, where: ['Xianyang Palace No. 1'] },
    supply: 'loess, straw, chaff; cinnabar', role: ['paving', 'finish'], colour: ['#a8402e'],
    sources: [S.sohuPalace1],
  },
  {
    id: 'bamboo-mud-wall', kind: 'material', name: 'bamboo-reinforced mud walls and bamboo roof matting', confidence: 'unverified',
    attested: { from: -350, to: null, approx: true, where: ['Xianyang palaces'] },
    supply: 'bamboo, loess', role: ['wall', 'roof'],
    sources: [S.snippetsHangtu],
  },
  {
    id: 'glazed-tile', kind: 'material', name: 'glazed roof tiles, building use — NOT Qin', confidence: 'unverified',
    attested: { from: 450, to: null, approx: true, where: ['Northern Wei Pingcheng (Datong)'] },
    supply: 'lead-glazed fired clay', role: ['roof'],
    notes: 'Han glaze is limited to tomb goods. Building-grade glazed tiles from the Northern Wei, 5th century CE (snippets citing a Palace Museum paper).',
    sources: [S.snippetsRoofs],
  },
];

// ── methods ──────────────────────────────────────────────────────────────────────────────────────────
const METHODS = [
  {
    id: 'rammed-earth-formwork', kind: 'method', name: 'earth rammed in board formwork (版筑), in thin courses', confidence: 'unverified',
    attested: { from: -350, to: null, approx: true }, materials: ['loess-hangtu'],
    notes: 'Courses: Lishan walls 6–8 cm (rammer head about 8 cm); Epang front hall 7–8 cm; the pit floors about 10 cm in three layers; Qin generally 6–10 cm (snippets). Timber ties inside the wall: not found, so the reference drawing\'s ties are conjecture.',
    sources: [S.snippetsHangtu],
  },
  {
    id: 'terrace-building', kind: 'method', name: 'terrace building (高台建筑): halls stepped up a rammed-earth core', confidence: 'read',
    attested: { from: -350, to: null, approx: true }, materials: ['loess-hangtu', 'timber-post'],
    notes: 'Palace No. 1: the main hall on top, smaller rooms round the lower tiers, a corridor round the lowest (sohuComplex).',
    sources: [S.sohuComplex, S.chinaculture],
  },
  {
    id: 'bracket-block', kind: 'method', name: 'bracket blocks between column and beam', confidence: 'unverified',
    attested: { from: -320, to: null, approx: true }, materials: ['timber-post'],
    notes: 'Earliest image: the Zhongshan bronze table (Pingshan, late 4th c. BCE) with a one-block-two-bearings bracket. No Qin bracket set found; Han ones appear on the Gaoyi que and pottery towers. The kit\'s single block is the plainest reading.',
    sources: [S.snippetsBrackets],
  },
];

// ── types ────────────────────────────────────────────────────────────────────────────────────────────
const TYPES = [
  {
    id: 'xianyang-palace-1', kind: 'type', name: 'Xianyang Palace No. 1 (咸阳宫一号建筑)', confidence: 'read',
    built: { from: -350, to: -206, approx: true }, materials: ['loess-hangtu', 'timber-post', 'grey-tile', 'wadang-round', 'hollow-brick', 'floor-build-up', 'mural-pigments'], methods: ['terrace-building', 'rammed-earth-formwork'],
    dims: { terrace: [60, 45, 6], foundationDepth: 4, complex: [177, 45], mainHall: [13.4, 12], corridor: [32.4, 5] },
    notes: 'The excavated western half: a terrace 60 × 45 m, about 6 m high, rammed about 4 m below ground; the whole paired complex, shaped like 凹, about 177 × 45 m. Main hall 13.4 × 12 m with a cinnabar floor; five rooms on the south (murals and spindle whorls in four, a fireplace and pottery drains in the fifth, a bathroom); a corridor 32.4 × 5 m painted with a chariot procession; drain pools round the terrace and floor drains. Identified with Duke Xiao\'s 冀阙. Yang Hongxun\'s reconstruction (a multi-tier terrace hall) is the standard reading; its roof form is not confirmed in anything read.',
    disputes: ['The 32.4 m corridor may be the western aerial passage linking Palace 1 to Palace 3 (snippets).'],
    sources: [S.sohuPalace1, S.sohuComplex, S.chinaculture, S.enXianyangPalace, S.zhXianyangPalace, S.liuChen1976, S.yang1976],
  },
  {
    id: 'wei-bridge', kind: 'type', name: 'timber pile bridge over the Wei (渭桥)', confidence: 'unverified',
    built: { from: -221, to: null, approx: true }, materials: ['timber-post'],
    dims: { length: 880, width: 15.4 },
    notes: 'The excavated 厨城门一号桥: about 880 m long, about 15.4 m wide, piles 6.2–8.8 m long, "built in Qin, used in Han". It lies north of Han Chang\'an; that it is the Qin crossing to Xianyang is an interpretation, and the source summary was garbled.',
    sources: [S.weiBridge],
  },
  {
    id: 'epang-front-hall', kind: 'type', name: 'Epang Palace front hall terrace (阿房宫前殿), begun, never finished', confidence: 'secondary',
    built: { from: -212, to: -207, approx: true }, materials: ['loess-hangtu'], methods: ['rammed-earth-formwork'],
    dims: { terrace: [1270, 426, 12] },
    notes: 'Begun in the emperor\'s 35th year. The rammed-earth terrace 1,270 × 426 m, 7–12 m high. The 2002–2007 excavation found it unfinished and unburnt. At 212 BCE: a building site only, the terrace rising.',
    disputes: ['Published figures for the terrace vary; 1,320 × 420 m is the whole site, not the front hall.'],
    sources: [S.zhEpang],
  },
  {
    id: 'lishan-mound', kind: 'type', name: 'the First Emperor\'s mound at Lishan, stepped rammed earth', confidence: 'read',
    built: { from: -246, to: -208, approx: true }, materials: ['loess-hangtu'], methods: ['rammed-earth-formwork', 'terrace-building'],
    dims: { base: [350, 345], height: 51, chamber: [80, 50, 15] },
    notes: 'Base about 350 × 345 m. A nine-tier stepped earth structure round the chamber, about 30 m high, steps about 2 m wide (dili360). Chamber about 80 × 50 m, 15 m high (enLishan). Under construction at 212 BCE.',
    disputes: ['Height: 76 m (Wikipedia, an older figure from the lower south side), 51.4 m measured from the north (dili360), 50+ zhang ≈ 115 m (Han Shu), an intended 122 m (zh Wikipedia).', 'Begun 246 BCE (en Wikipedia) or 247 BCE (zh Wikipedia).'],
    sources: [S.enLishan, S.zhLishan, S.dili360],
  },
  {
    id: 'lishan-enclosures', kind: 'type', name: 'Lishan inner and outer enclosure walls, with the inner cross wall', confidence: 'unverified',
    built: { from: -246, to: -208, approx: true }, materials: ['loess-hangtu'], methods: ['rammed-earth-formwork'],
    dims: { outer: [940, 2165], inner: [580, 1355], crossWall: [330, 8] },
    notes: 'Perimeters inner 2.5 km, outer 6.3 km (read). Both long north–south. An east–west wall 330 m long and about 8 m wide splits the inner enclosure; a north–south wall about 8 m wide splits its north part (snippets). The mound in the south part. No moat attested.',
    disputes: ['Outer enclosure 2,165 × 940 m (snippet) against 2,188 × 976 m (dili360, read).'],
    sources: [S.snippetsLishan, S.enLishan, S.dili360],
  },
  {
    id: 'lishan-east-gate', kind: 'type', name: 'Lishan outer east gate', confidence: 'read',
    built: { from: -246, to: -208, approx: true }, materials: ['loess-hangtu'],
    dims: { base: [22.4, 77] },
    notes: 'A rammed-earth gate base 77 m north–south by 22.4 m east–west, one passage, destroyed by fire.',
    sources: [S.rmzxwGate],
  },
  {
    id: 'lishan-triple-que', kind: 'type', name: 'Lishan triple que (三出阙), between inner and outer gates', confidence: 'unverified',
    built: { from: -246, to: -208, approx: true }, materials: ['loess-hangtu'],
    notes: 'A symmetric pair on the east–west axis between the inner and outer gates, on the east side and on the west; the eastern pair slightly larger. Called the earliest physical triple que. Dimensions not found.',
    sources: [S.snippetsLishan],
  },
  {
    id: 'lishan-sleeping-hall', kind: 'type', name: 'Lishan sleeping hall (寝殿) and side halls (便殿)', confidence: 'unverified',
    built: { from: -246, to: -208, approx: true }, materials: ['loess-hangtu', 'timber-post', 'grey-tile'],
    dims: { hall: [62, 57] },
    notes: 'The sleeping hall 62 × 57 m with a surrounding corridor, 53 m north of the mound; the side halls in rows west of the north–south partition in the north zone (snippets). The giant kui tile (wadang-kui) comes from a building here; it is attested only from 215 BCE and when the halls were roofed is not known, so it is not dated into the hall\'s span.',
    sources: [S.snippetsLishan, S.baikeKui],
  },
  {
    id: 'army-pit-1', kind: 'type', name: 'terracotta Pit 1', confidence: 'read',
    built: { from: -246, to: -208, approx: true }, materials: ['loess-hangtu', 'timber-post', 'paving-brick', 'mural-pigments'], methods: ['rammed-earth-formwork'],
    dims: { pit: [230, 62, 5], corridors: 11, partitions: 10, corridorWidth: 3 },
    notes: 'Ten rammed-earth partitions make eleven corridors (nine central, two side), mostly over 3 m wide, with long galleries at the east and west ends; brick floors; timber posts and beams under reed mats, clay, then soil heaped 2–3 m above ground. Five sloping ramps on each of the east and west sides, two side doors north and south. The figures face east: a vanguard of 3 rows of 68 archers and light infantry (204) across the east end; chariots among the columns. Painted when made.',
    disputes: ['Depth 4.5–6.5 m (travelchinaguide) against about 7 m (en Wikipedia); about 5 m is the common figure.', 'Chariots: over 50 in Pit 1 (travelchinaguide) against about 100 across the excavation (en Wikipedia).'],
    sources: [S.enArmy, S.tcgArmy, S.scalarArmy],
  },
  {
    id: 'zhengguo-canal', kind: 'type', name: 'the Zhengguo Canal (郑国渠)', confidence: 'secondary',
    built: { from: -246, to: null, approx: true },
    dims: { length: 125000 },
    notes: 'Begun 246 BCE, finished about ten years later; 300+ li (a modern estimate 124–126 km), irrigating 40,000+ qing north of the Wei.',
    sources: [S.zhZhengguo],
  },
  // Han analogues: real dates, so a Qin scene borrows one only by naming it
  {
    id: 'gaoyi-que', kind: 'type', name: 'Gaoyi que (高頤闕), stone, Ya\'an — a HAN analogue', confidence: 'read',
    built: { from: 209, to: null, approx: true },
    dims: { height: 5.9 },
    notes: 'Eastern Han, for Gao Yi (d. 209 CE). 5.9 m high, a double-eaved hip roof, bracket sets carved in stone. The model for the kit\'s slim gate tower.',
    sources: [S.zhGaoyi],
  },
  {
    id: 'han-pottery-tower', kind: 'type', name: 'pottery tower models (陶楼) — a HAN analogue', confidence: 'read',
    built: { from: 25, to: 220, approx: true },
    notes: 'Eastern Han tomb models of multi-storey towers. The model for the kit\'s tower.',
    sources: [S.enChineseArch],
  },
  {
    id: 'han-market-brick', kind: 'type', name: 'market scene on Sichuan pictorial bricks (市井画像砖) — a HAN analogue', confidence: 'unverified',
    built: { from: 25, to: 220, approx: true },
    notes: 'Eastern Han, from Xindu and Guanghan (Sichuan Museum): a walled market with a two-storey market tower. The model for the kit\'s market.',
    sources: [S.snippetsHan],
  },
];

// ── forms ────────────────────────────────────────────────────────────────────────────────────────────
const FORMS = [
  {
    id: 'xianyang-capital', kind: 'form', name: 'Xianyang the Qin capital, on the Wei', confidence: 'read',
    attested: { from: -350, to: -206 },
    notes: 'Duke Xiao moved the capital here in 350 BCE. The palaces stand on the higher ground north of the Wei (the north bank is the standard account, implied by the bridge finds rather than stated in anything read). No outer city wall has been found; four scholarly views on whether one stood.',
    disputes: ['Burned by Xiang Yu in 206 BCE (en Wikipedia) or 207 BCE (zh Wikipedia); he entered in the winter of 207/206.'],
    sources: [S.zhXianyangSite, S.zhXianyangPalace, S.enXianyangPalace],
  },
  {
    id: 'mausoleum-axis', kind: 'form', name: 'mausoleum plan: long N–S enclosures, the mound in the south, halls in the north, four axial gates', confidence: 'unverified',
    attested: { from: -246, to: null, approx: true },
    notes: 'See lishan-enclosures, lishan-sleeping-hall, lishan-triple-que. The plan laid out from these dimensions, not from the reference drawing (drawn near-square).',
    sources: [S.snippetsLishan, S.enLishan],
  },
  {
    id: 'dryland-millet-wheat', kind: 'form', name: 'dryland farming of foxtail millet and wheat on the loess', confidence: 'read',
    attested: { from: -400, to: null, approx: true },
    notes: 'Matengkong (Xi\'an, Warring States to Qin): foxtail millet in every sample (15,490 grains); wheat in 85% (1,612); broomcorn millet 34%; soybean, adzuki bean, barley, a little rice.',
    sources: [S.tang2022],
  },
  {
    id: 'curved-eaves', kind: 'form', name: 'upswept, curved eaves — NOT Qin', confidence: 'unverified',
    attested: { from: 500, to: null, approx: true },
    notes: 'Northern roofs low and straight before Song; a curve likely from about the 6th century CE (snippets).',
    disputes: ['One snippet starts upturned eaves in Han. None puts them in Qin.'],
    sources: [S.snippetsRoofs, S.enChineseArch],
  },
  {
    id: 'xianyang-burned', kind: 'form', name: 'Xianyang\'s palaces burned by Xiang Yu', confidence: 'read',
    attested: { from: -206, to: null },
    sources: [S.enXianyangPalace, S.zhXianyangPalace],
  },
];

export const QIN_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS];
export const QIN_SOURCES = S;
