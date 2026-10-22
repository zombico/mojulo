/**
 * locale-conventions — what LOCALIZING a game into a language means beyond its words: the conventions players of that
 * language expect from a game. Two halves, both pure data:
 *
 *   the language's own: its script and direction, whether it has case, how its lines break, how it writes numbers,
 *   quotes and punctuation, how many plural forms it has, how a game's system text addresses the player, how long its
 *   text runs against English, how its keyboard prompts read, how proper names cross into its script;
 *
 *   the gamer's: the established words for the things games share (HP, a stage, a level-up, the continue after a
 *   game over), including the ones a language's players keep in English. These are SUGGESTIONS the operator's
 *   translating agent weighs, never enforced: a game with its own voice may choose otherwise.
 *
 * Read by the localization brief (game-languages.js localizationBrief) and by the World page (localeCss: the script's
 * typesetting, under the page's lang). Determinism: nothing here reads Intl or the host; a tag the table lacks reads
 * as a plain left-to-right Latin language with no glossary, and says so.
 *
 *   localeProfile(tag)            → { tag, known, script, name (its own name for itself), dir, caseless, joined, wrap, number, quotes, punct, plural,
 *                                     address, expansion, keys, units, names, glossary: { <term>: { use, note? } } }
 *   glossaryFor(tag, texts)       → [{ term, use, note? }] the entries whose English the given words say
 *   localeCss(tag)                → the page's typesetting for the script ('' for a Latin or Cyrillic language)
 */

const CASED = new Set(['Latn', 'Cyrl', 'Grek']);

// the language's own conventions. number: [group, decimal]; quotes: [open, close]; expansion: text length against
// English (a budget for boxes that do not grow); keys: the keyboard layout its players' prompts read in
const LANGS = {
  en: { script: 'Latn', number: [',', '.'], quotes: ['“', '”'], plural: ['one', 'other'], address: 'second person, plain; imperative for prompts', expansion: 1 },
  fr: { script: 'Latn', number: [' ', ','], quotes: ['« ', ' »'], plural: ['one', 'many', 'other'], expansion: 1.2, keys: 'azerty',
    punct: 'a narrow no-break space before ; : ! ? and inside « »; "one" covers 0 and 1',
    address: 'vous in system text and prompts; characters address each other as their relationship says (tu / vous)' },
  de: { script: 'Latn', number: ['.', ','], quotes: ['„', '“'], plural: ['one', 'other'], expansion: 1.3, keys: 'qwertz',
    punct: 'nouns capitalized; compound words run long, so a HUD label may take an abbreviation (LP, EP)',
    address: 'du in system text is the modern convention (Sie reads formal and dated in a game): pick one and keep it' },
  es: { script: 'Latn', number: ['.', ','], quotes: ['«', '»'], plural: ['one', 'many', 'other'], expansion: 1.25,
    punct: 'opening ¿ and ¡ before a question or exclamation', address: 'tú in system text and prompts' },
  it: { script: 'Latn', number: ['.', ','], quotes: ['«', '»'], plural: ['one', 'many', 'other'], expansion: 1.2, address: 'tu in system text and prompts' },
  pt: { script: 'Latn', number: ['.', ','], quotes: ['«', '»'], plural: ['one', 'many', 'other'], expansion: 1.25, address: 'tu (Portugal) / você (Brazil) in system text' },
  nl: { script: 'Latn', number: ['.', ','], quotes: ['“', '”'], plural: ['one', 'other'], expansion: 1.25, address: 'je in system text' },
  sv: { script: 'Latn', number: [' ', ','], quotes: ['”', '”'], plural: ['one', 'other'], expansion: 1.1, address: 'du' },
  da: { script: 'Latn', number: ['.', ','], quotes: ['»', '«'], plural: ['one', 'other'], expansion: 1.1, address: 'du' },
  pl: { script: 'Latn', number: [' ', ','], quotes: ['„', '”'], plural: ['one', 'few', 'many', 'other'], expansion: 1.3,
    address: 'second person singular in system text; avoid gendered past forms for the player (say what happened, not what "you did")' },
  tr: { script: 'Latn', number: ['.', ','], quotes: ['“', '”'], plural: ['one', 'other'], expansion: 1.25,
    punct: 'dotted and dotless i: İ/i and I/ı are different letters, so upper-casing English-style breaks words',
    address: 'sen in prompts, siz in formal system text: pick one and keep it' },
  ru: { script: 'Cyrl', number: [' ', ','], quotes: ['«', '»'], plural: ['one', 'few', 'many', 'other'], expansion: 1.3,
    address: 'вы in system text; avoid gendered past forms for the player', punct: '«ёлочки» for quotes, „лапки“ inside them' },
  uk: { script: 'Cyrl', number: [' ', ','], quotes: ['«', '»'], plural: ['one', 'few', 'many', 'other'], expansion: 1.3, address: 'ви in system text' },
  ar: { script: 'Arab', number: [',', '.'], quotes: ['«', '»'], plural: ['zero', 'one', 'two', 'few', 'many', 'other'], expansion: 1.25,
    punct: 'Arabic comma ، and question mark ؟; Western digits are the norm in game HUDs', address: 'Modern Standard Arabic; masculine singular is the usual default for the player, or a neutral rewording' },
  he: { script: 'Hebr', number: [',', '.'], quotes: ['”', '”'], plural: ['one', 'two', 'other'], expansion: 1.1, address: 'gender-neutral rewordings where the player is addressed (infinitive prompts)' },
  fa: { script: 'Arab', number: ['٬', '٫'], quotes: ['«', '»'], plural: ['one', 'other'], expansion: 1.2, address: 'شما in system text' },
  hi: { script: 'Deva', number: [',', '.'], quotes: ['“', '”'], plural: ['one', 'other'], expansion: 1.2, punct: 'the danda । ends a sentence; numbers group by lakh (1,00,000)', address: 'आप in system text' },
  th: { script: 'Thai', number: [',', '.'], quotes: ['“', '”'], plural: ['other'], expansion: 1.1, punct: 'no spaces between words: a line breaks by dictionary, so keep a label one phrase', address: 'polite neutral; no particles in UI labels' },
  vi: { script: 'Latn', number: ['.', ','], quotes: ['“', '”'], plural: ['other'], expansion: 1.3, address: 'bạn in system text' },
  id: { script: 'Latn', number: ['.', ','], quotes: ['“', '”'], plural: ['other'], expansion: 1.25, address: 'kamu (casual) or Anda (polite) in system text: pick one' },
  ja: { script: 'Jpan', number: [',', '.'], quotes: ['「', '」'], plural: ['other'], expansion: 0.6,
    punct: 'full-width 。、！？; the game ellipsis is …… (two); 「」 for speech, 『』 inside it or for titles; no spaces between words',
    address: 'です/ます in system text and prompts; each character speaks in a voice of their own (role language: an old sage, a rough guard, a polite shopkeeper)' },
  ko: { script: 'Kore', number: [',', '.'], quotes: ['“', '”'], plural: ['other'], expansion: 0.75,
    address: '합니다/해요 in system text and prompts; characters by their relationship (반말 between friends)', punct: 'words are spaced; a line breaks between words, never inside one' },
  zh: { script: 'Hans', number: [',', '.'], quotes: ['“', '”'], plural: ['other'], expansion: 0.55,
    punct: 'full-width ，。！？：; the ellipsis is ……; no spaces between words', address: '你 in system text (您 reads formal)' },
};

// each language in its own name: a language list is read by someone who may not read the language it is in
const AUTONYMS = {
  en: 'English', 'en-US': 'English (US)', 'en-GB': 'English (UK)', fr: 'Français', 'fr-CA': 'Français (Canada)', de: 'Deutsch',
  es: 'Español', 'es-ES': 'Español (España)', 'es-419': 'Español (Latinoamérica)', 'es-MX': 'Español (México)', it: 'Italiano',
  pt: 'Português', 'pt-BR': 'Português (Brasil)', 'pt-PT': 'Português (Portugal)', nl: 'Nederlands', sv: 'Svenska', da: 'Dansk',
  pl: 'Polski', tr: 'Türkçe', ru: 'Русский', uk: 'Українська', ar: 'العربية', he: 'עברית', fa: 'فارسی', hi: 'हिन्दी', th: 'ไทย',
  vi: 'Tiếng Việt', id: 'Bahasa Indonesia', ja: '日本語', ko: '한국어', zh: '中文', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文',
  'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'zh-HK': '繁體中文 (香港)',
};

// the letters a keyboard layout moves, by the QWERTY key's letter: what a prompt for that key shows its player
export const KEY_LAYOUTS = Object.freeze({
  azerty: Object.freeze({ A: 'Q', Q: 'A', W: 'Z', Z: 'W', M: ',' }),
  qwertz: Object.freeze({ Y: 'Z', Z: 'Y' }),
});

// a tag the list does not name: its language's name and its region as written ('Español (AR)'), else the tag itself
const autonym = (tag) => AUTONYMS[tag] ?? (AUTONYMS[lang(tag)] ? `${AUTONYMS[lang(tag)]} (${tag.split('-').slice(1).join('-')})` : tag);

// a region or script that changes what a player expects (the rest falls back to its language)
const REGIONS = {
  'en-US': { units: 'imperial' },
  'es-419': { quotes: ['“', '”'], number: [',', '.'], address: 'tú in system text (ustedes, never vosotros, for a group)' },
  'es-MX': { quotes: ['“', '”'], number: [',', '.'], address: 'tú in system text (ustedes, never vosotros, for a group)' },
  'pt-BR': { quotes: ['“', '”'], plural: ['one', 'many', 'other'], address: 'você in system text' },
  'zh-Hant': { script: 'Hant', quotes: ['「', '」'], address: '你 in system text' },
  'zh-TW': { script: 'Hant', quotes: ['「', '」'], address: '你 in system text' },
  'zh-HK': { script: 'Hant', quotes: ['「', '」'], address: '你 in system text' },
  'fr-CA': { punct: 'no space before ; ! ? (a space before : and inside « » stays)' },
};

// how a proper name crosses into the script: a personal name is carried by its sound, a descriptive title is translated
const NAMES = {
  Latn: 'keep personal names as written; translate descriptive titles (the Old Mill, Mayor)',
  Cyrl: 'transliterate personal names into Cyrillic; translate descriptive titles',
  Arab: 'carry personal names by their sound in Arabic script; translate descriptive titles',
  Hebr: 'carry personal names by their sound in Hebrew script; translate descriptive titles',
  Deva: 'carry personal names by their sound in Devanagari; translate descriptive titles',
  Thai: 'carry personal names by their sound in Thai script; translate descriptive titles',
  Jpan: 'Western names in katakana by their sound (Ilse → イルゼ); a title goes after the name (Mayor Ilse → イルゼ町長)',
  Kore: 'names in hangul by their sound; a title goes after the name (… 시장 for a mayor)',
  Hans: 'names by their sound in characters chosen for it; a title after the name (Mayor Ilse → 伊尔泽镇长)',
  Hant: 'names by their sound in characters chosen for it; a title after the name',
};

// the gamer's words. Each term: when the English says it, and what each language's players expect to read. A `note`
// carries the tradition (kept in English, two words where English has one). Languages absent from a term have no
// settled convention bundled here: follow the platform holder's terminology.
const TERMS = [
  { term: 'HP', en: /\bHP\b|\bhealth\b|\bhit points\b/i, use: { fr: 'PV', de: 'LP', es: 'PV', it: 'PS', 'pt-BR': 'HP', ru: 'ОЗ', pl: 'PŻ', tr: 'Can', ar: 'الصحة', ja: 'HP', ko: 'HP', zh: '生命值', 'zh-Hant': '生命值' },
    note: { de: 'Lebenspunkte; HP is common too', ru: 'очки здоровья; HP is common too', ko: '체력 in prose' } },
  { term: 'MP', en: /\bMP\b|\bmana\b/i, use: { fr: 'PM', de: 'MP', es: 'PM', it: 'PM', 'pt-BR': 'MP', ru: 'ОМ', pl: 'PM', ja: 'MP', ko: 'MP', zh: '魔法值', 'zh-Hant': '魔力值' } },
  { term: 'XP', en: /\b(?:XP|EXP)\b|\bexperience\b/i, use: { fr: 'XP', de: 'EP', es: 'EXP', it: 'PE', 'pt-BR': 'XP', ru: 'Опыт', pl: 'PD', tr: 'TP', ar: 'الخبرة', ja: '経験値', ko: '경험치', zh: '经验值', 'zh-Hant': '經驗值' } },
  { term: 'Level (a character\'s)', en: /\blevel\b|\bLv\.?\b/i, use: { fr: 'Niveau', de: 'Level', es: 'Nivel', it: 'Livello', 'pt-BR': 'Nível', ru: 'Уровень', pl: 'Poziom', tr: 'Seviye', ar: 'المستوى', ja: 'レベル', ko: '레벨', zh: '等级', 'zh-Hant': '等級' },
    note: { '*': 'English "level" is two things: a character\'s level and a stage of the game. Tell them apart (see Stage)' } },
  { term: 'Stage (a level of the game)', en: /\blevel\b|\bstage\b/i, use: { fr: 'Niveau', de: 'Level', es: 'Nivel', it: 'Livello', 'pt-BR': 'Fase', ru: 'Уровень', pl: 'Poziom', tr: 'Bölüm', ar: 'المرحلة', ja: 'ステージ', ko: '스테이지', zh: '关卡', 'zh-Hant': '關卡' } },
  { term: 'Level up', en: /\blevel(?:led|ed)? up\b|\blevel-up\b/i, use: { fr: 'Niveau supérieur !', de: 'Level-Up!', es: '¡Subes de nivel!', it: 'Livello superiore!', 'pt-BR': 'Subiu de nível!', ru: 'Новый уровень!', pl: 'Nowy poziom!', tr: 'Seviye atladın!', ar: 'ارتفع المستوى!', ja: 'レベルアップ！', ko: '레벨 업!', zh: '升级！', 'zh-Hant': '升級！' } },
  { term: 'Game over', en: /\bgame over\b/i, use: { fr: 'Game Over', de: 'Game Over', es: 'Fin del juego', it: 'Game Over', 'pt-BR': 'Fim de jogo', ru: 'Игра окончена', pl: 'Koniec gry', tr: 'Oyun bitti', ar: 'انتهت اللعبة', ja: 'ゲームオーバー', ko: '게임 오버', zh: '游戏结束', 'zh-Hant': '遊戲結束' },
    note: { fr: 'kept in English by convention', de: 'kept in English by convention', it: 'kept in English by convention' } },
  { term: 'Continue (from a save)', en: /\bcontinue\b/i, use: { fr: 'Continuer', de: 'Fortsetzen', es: 'Continuar', it: 'Continua', 'pt-BR': 'Continuar', ru: 'Продолжить', pl: 'Kontynuuj', tr: 'Devam et', ar: 'متابعة', ja: 'つづきから', ko: '이어하기', zh: '继续游戏', 'zh-Hant': '繼續遊戲' },
    note: { ja: 'the title menu\'s pair is はじめから / つづきから; コンティニュー is the retry after a game over' } },
  { term: 'Continue? (after losing)', en: /\bcontinue\?/i, use: { fr: 'Continuer ?', de: 'Weiterspielen?', es: '¿Continuar?', it: 'Continuare?', 'pt-BR': 'Continuar?', ru: 'Продолжить?', pl: 'Kontynuować?', ja: 'コンティニュー？', ko: '컨티뉴?', zh: '继续？', 'zh-Hant': '繼續？' } },
  { term: 'New game', en: /\bnew game\b|\bstart game\b/i, use: { fr: 'Nouvelle partie', de: 'Neues Spiel', es: 'Nueva partida', it: 'Nuova partita', 'pt-BR': 'Novo jogo', ru: 'Новая игра', pl: 'Nowa gra', tr: 'Yeni oyun', ar: 'لعبة جديدة', ja: 'はじめから', ko: '새 게임', zh: '新游戏', 'zh-Hant': '新遊戲' } },
  { term: 'Press start', en: /\bpress (?:start|any key)\b/i, use: { fr: 'Appuyez sur Start', de: 'Drücke Start', es: 'Pulsa Start', 'es-419': 'Presiona Start', it: 'Premi Start', 'pt-BR': 'Pressione Start', ru: 'Нажмите Start', pl: 'Naciśnij Start', ja: 'PRESS START', ko: 'PRESS START', zh: '按任意键开始', 'zh-Hant': '按任意鍵開始' },
    note: { ja: 'a title screen keeps it in English by tradition', ko: 'a title screen keeps it in English by tradition', '*': 'a button keeps the name the platform prints on it' } },
  { term: 'Boss', en: /\bboss\b/i, use: { fr: 'Boss', de: 'Boss', es: 'Jefe', it: 'Boss', 'pt-BR': 'Chefe', ru: 'Босс', pl: 'Boss', tr: 'Boss', ar: 'الزعيم', ja: 'ボス', ko: '보스', zh: '首领', 'zh-Hant': '頭目' },
    note: { zh: 'BOSS is as common' } },
  { term: 'Checkpoint', en: /\bcheckpoint\b/i, use: { fr: 'Point de contrôle', de: 'Checkpoint', es: 'Punto de control', it: 'Checkpoint', 'pt-BR': 'Checkpoint', ru: 'Контрольная точка', pl: 'Punkt kontrolny', tr: 'Kontrol noktası', ja: 'チェックポイント', ko: '체크포인트', zh: '检查点', 'zh-Hant': '檢查點' } },
  { term: 'Save', en: /\bsave\b/i, use: { fr: 'Sauvegarder', de: 'Speichern', es: 'Guardar', it: 'Salva', 'pt-BR': 'Salvar', pt: 'Guardar', ru: 'Сохранить', pl: 'Zapisz', tr: 'Kaydet', ar: 'حفظ', ja: 'セーブ', ko: '저장', zh: '存档', 'zh-Hant': '存檔' } },
  { term: 'Load', en: /\bload\b/i, use: { fr: 'Charger', de: 'Laden', es: 'Cargar', it: 'Carica', 'pt-BR': 'Carregar', ru: 'Загрузить', pl: 'Wczytaj', tr: 'Yükle', ar: 'تحميل', ja: 'ロード', ko: '불러오기', zh: '读档', 'zh-Hant': '讀檔' } },
  { term: 'Quest', en: /\bquests?\b/i, use: { fr: 'Quête', de: 'Quest', es: 'Misión', it: 'Missione', 'pt-BR': 'Missão', ru: 'Задание', pl: 'Zadanie', tr: 'Görev', ar: 'مهمة', ja: 'クエスト', ko: '퀘스트', zh: '任务', 'zh-Hant': '任務' } },
  { term: 'Inventory', en: /\binventory\b|\bbag\b/i, use: { fr: 'Inventaire', de: 'Inventar', es: 'Inventario', it: 'Inventario', 'pt-BR': 'Inventário', ru: 'Инвентарь', pl: 'Ekwipunek', tr: 'Envanter', ar: 'الحقيبة', ja: '持ち物', ko: '인벤토리', zh: '背包', 'zh-Hant': '背包' } },
  { term: 'Score', en: /\bscore\b|\bpoints\b/i, use: { fr: 'Score', de: 'Punkte', es: 'Puntuación', 'es-419': 'Puntaje', it: 'Punteggio', 'pt-BR': 'Pontuação', ru: 'Очки', pl: 'Wynik', tr: 'Skor', ar: 'النقاط', ja: 'スコア', ko: '점수', zh: '得分', 'zh-Hant': '分數' } },
  { term: 'High score', en: /\bhigh ?score\b|\bbest score\b/i, use: { fr: 'Meilleur score', de: 'Highscore', es: 'Récord', it: 'Record', 'pt-BR': 'Recorde', ru: 'Рекорд', pl: 'Rekord', tr: 'Rekor', ar: 'أعلى نتيجة', ja: 'ハイスコア', ko: '최고 점수', zh: '最高分', 'zh-Hant': '最高分' } },
  { term: 'Paused', en: /\bpause[ds]?\b/i, use: { fr: 'Pause', de: 'Pause', es: 'Pausa', it: 'Pausa', 'pt-BR': 'Pausado', ru: 'Пауза', pl: 'Pauza', tr: 'Duraklatıldı', ar: 'إيقاف مؤقت', ja: 'ポーズ', ko: '일시 정지', zh: '暂停', 'zh-Hant': '暫停' } },
  { term: 'Options', en: /\boptions\b|\bsettings\b/i, use: { fr: 'Options', de: 'Optionen', es: 'Opciones', it: 'Opzioni', 'pt-BR': 'Opções', ru: 'Настройки', pl: 'Opcje', tr: 'Ayarlar', ar: 'الإعدادات', ja: 'オプション', ko: '설정', zh: '设置', 'zh-Hant': '設定' } },
  { term: 'Retry', en: /\bretry\b|\btry again\b/i, use: { fr: 'Réessayer', de: 'Nochmal', es: 'Reintentar', it: 'Riprova', 'pt-BR': 'Tentar de novo', ru: 'Ещё раз', pl: 'Spróbuj ponownie', tr: 'Tekrar dene', ar: 'أعد المحاولة', ja: 'リトライ', ko: '다시 하기', zh: '重试', 'zh-Hant': '重試' } },
  { term: 'Victory', en: /\bvictory\b|\byou win\b/i, use: { fr: 'Victoire !', de: 'Sieg!', es: '¡Victoria!', it: 'Vittoria!', 'pt-BR': 'Vitória!', ru: 'Победа!', pl: 'Zwycięstwo!', tr: 'Zafer!', ar: 'النصر!', ja: '勝利！', ko: '승리!', zh: '胜利！', 'zh-Hant': '勝利！' } },
];

const lang = (tag) => tag.split('-')[0];
// the lookup order for a tag: itself, its script variant (zh-TW reads as zh-Hant), its language
const chain = (tag) => {
  const out = [tag];
  if (lang(tag) === 'zh' && REGIONS[tag]?.script === 'Hant' && tag !== 'zh-Hant') out.push('zh-Hant');
  if (/^pt-/.test(tag) && tag !== 'pt-BR') out.push('pt');
  if (/^es-/.test(tag) && tag !== 'es-ES' && REGIONS[tag]) out.push('es-419');
  out.push(lang(tag));
  return out;
};

/** The conventions a player of `tag` expects, region over language; an unknown tag reads as plain Latin LTR. */
export function localeProfile(tag) {
  const base = LANGS[lang(tag)];
  const P = { ...(base ?? LANGS.en), ...(REGIONS[tag] ?? {}) };
  const script = P.script;
  const glossary = {};
  for (const t of TERMS) {
    const hit = chain(tag).find((k) => t.use[k] !== undefined);
    if (hit === undefined) continue;
    const note = chain(tag).map((k) => t.note?.[k]).find(Boolean) ?? t.note?.['*'];
    glossary[t.term] = { use: t.use[hit], ...(note ? { note } : {}) };
  }
  return {
    tag, known: !!base, script, name: autonym(tag),
    dir: script === 'Arab' || script === 'Hebr' ? 'rtl' : 'ltr',
    caseless: !CASED.has(script),
    joined: script === 'Arab' || script === 'Deva',   // letter-spacing breaks the joins (and a Devanagari conjunct)
    wrap: script === 'Jpan' || script === 'Hans' || script === 'Hant' ? 'cjk' : script === 'Kore' ? 'keep-all' : script === 'Thai' ? 'dictionary' : 'spaces',
    number: { group: P.number[0], decimal: P.number[1], ...(lang(tag) === 'hi' ? { lakh: true } : {}) },
    quotes: P.quotes, punct: P.punct ?? null, plural: P.plural, address: P.address, expansion: P.expansion,
    keys: P.keys ?? 'qwerty', units: P.units ?? 'metric', names: NAMES[script],
    glossary,
  };
}

/** The glossary entries whose English the given words say: what a brief shows beside them, so it stays short. */
export function glossaryFor(tag, texts) {
  const P = localeProfile(tag), all = texts.join('\n');
  return TERMS.filter((t) => P.glossary[t.term] && t.en.test(all)).map((t) => ({ term: t.term, ...P.glossary[t.term] }));
}

// the page's fonts know nothing of the script until the page says its language; these say how the script sets
const CSS = {
  caseless: '*{text-transform:none!important}',
  joined: '*{letter-spacing:normal!important}',
  cjk: '*{line-break:strict;word-break:normal;overflow-wrap:anywhere}',
  'keep-all': '*{word-break:keep-all;overflow-wrap:anywhere}',
};

/** The World page's typesetting for a language's script: case it does not have is not forced on it, joined letters are
 * not spaced apart, CJK lines break by its rules (kinsoku) and Korean between words. '' for a cased spaced script. */
export function localeCss(tag) {
  const P = localeProfile(tag);
  return [P.caseless ? CSS.caseless : '', P.joined ? CSS.joined : '', CSS[P.wrap] ?? ''].filter(Boolean).join('\n');
}
