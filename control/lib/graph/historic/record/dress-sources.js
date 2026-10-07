/**
 * The pages the dress entries (./dress-*.js) were read from: Wikipedia's clothing articles, read through a model
 * summary of each page (so a date or a claim was read back, not seen in the original), and one or two others. A
 * fact only a search snippet carried is `secondary`; a standard account no page confirmed is `unverified`.
 * Britannica's "dress" article and the Met's timeline essays were refused (403 / 429) and are the next pages to read.
 */
const W = (title, via = 'read') => ({ author: 'Wikipedia', title, year: 2026, url: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`, via });
export const DS = {
  romeClothing: W('Clothing in ancient Rome'), toga: W('Toga'), stola: W('Stola'), calceus: W('Calceus'), exomis: W('Exomis'), paenula: W('Paenula'),
  greeceClothing: W('Clothing in ancient Greece'), peplos: W('Peplos'), chiton: W('Chiton (garment)'), himation: W('Himation'), chlamys: W('Chlamys'), petasos: W('Petasos'),
  egyptClothing: W('Clothing in ancient Egypt'), shendyt: W('Shendyt'),
  kaunakes: W('Kaunakes'), earlyDynastic: W('Early Dynastic Period (Mesopotamia)'), warka: W('Warka Vase'),
  zay: { author: 'The Zay Initiative', title: 'History of Mesopotamian dress: the evolution of costume in ancient Iraq', year: 2026, url: 'https://thezay.org/history-of-mesopotamian-dress_-the-evolution-of-costume-in-ancient-iraq', via: 'read' },
  britannicaDress: { author: 'Encyclopaedia Britannica', title: 'Dress: Mesopotamia', year: 2026, url: 'https://www.britannica.com/topic/dress-clothing', via: 'search snippet (page refused, 403)' },
  hanfu: W('Hanfu'), shenyi: W('Shenyi'), wuling: W('King Wuling of Zhao'),
  baiduBlackHeaded: { author: 'Baidu Baike', title: 'Black-headed People', year: 2026, url: 'https://baike.baidu.com/en/item/Black-headed%20People/51493', via: 'search snippet' },
  baiduQin: { author: 'Baidu Baike', title: 'Clothing of the Qin dynasty', year: 2026, url: 'https://baike.baidu.com/en/item/Clothing%20of%20the%20Qin%20dynasty/1453783', via: 'read' },
};
