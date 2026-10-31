// Text helpers shared by the store's search API and the shopping copilot: spoken numbers and prices, words a shopper
// uses for a thing the catalogue calls something else, and correcting misheard or misspelled words against the
// catalogue's own vocabulary ("hiking boats" -> "hiking boots", "blue tooth speaker" -> "bluetooth speaker").
// Pure functions, no I/O: the vocabulary is handed in (the API reads it from Octo).

const ONES: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, a: 1, an: 1 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

// "eighty", "a hundred and fifty", "two thousand", "1,200", "80.50", "eighty five" -> number; anything else unchanged.
// Returns the text with each spelled-out number replaced by digits.
export function wordsToDigits(text: string): string {
  const toks = text.split(/(\s+|-)/);
  const out: string[] = [];
  let i = 0;
  while (i < toks.length) {
    if (/^\s+$|^-$/.test(toks[i]) || !toks[i]) { out.push(toks[i]); i++; continue; }
    let j = i, total = 0, cur = 0, used = false;
    while (j < toks.length) {
      const t = toks[j].toLowerCase();
      if (/^\s+$|^-$/.test(t)) { j++; continue; }
      if (t === 'and' && used && j + 2 < toks.length && /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)$/.test(toks[j + 2]?.toLowerCase() ?? '')) { j++; continue; }
      if (t in ONES && !(t === 'a' || t === 'an') ) { cur += ONES[t]; used = true; j++; continue; }
      if ((t === 'a' || t === 'an') && /^(hundred|thousand)$/i.test(toks[j + 2] ?? '')) { cur += 1; used = true; j++; continue; }
      if (t in TENS) { cur += TENS[t]; used = true; j++; continue; }
      if (t === 'hundred' && used) { cur *= 100; j++; continue; }
      if (t === 'thousand' && used) { total += cur * 1000; cur = 0; j++; continue; }
      break;
    }
    if (used) {
      // keep the whitespace that followed the last number word
      let k = j - 1;
      while (k > i && /^\s+$|^-$/.test(toks[k])) k--;
      out.push(String(total + cur));
      i = k + 1;
    } else { out.push(toks[i]); i++; }
  }
  return out.join('').replace(/(\d),(\d{3})\b/g, '$1$2');
}

export type Budget = { min?: number; max?: number; around?: number };
// A price limit in what was said: "under $80", "less than eighty bucks", "no more than 100", "between 50 and 100",
// "around 60", "80 dollars or less", "max 40", "$30 to $60". Prices are matched only next to a price word or a currency
// sign, so "size 10" or "2 person tent" are not budgets.
export function parseBudget(text: string): Budget | null {
  const t = wordsToDigits(text.toLowerCase()).replace(/(\d+(?:\.\d+)?)\s*k\b/g, (_, x) => String(Math.round(Number(x) * 1000)));
  const n = (s: string) => Number(s.replace(/[$,]/g, ''));
  const money = String.raw`\$?\s?(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?|usd|\$)?`;
  let m = new RegExp(String.raw`\b(?:between|from)\s+${money}\s+(?:and|to|-)\s+${money}`).exec(t)
    ?? new RegExp(String.raw`\$\s?(\d+(?:\.\d{1,2})?)\s*(?:-|to)\s*\$?\s?(\d+(?:\.\d{1,2})?)`).exec(t);
  if (m) { const a = n(m[1]), b = n(m[2]); return { min: Math.min(a, b), max: Math.max(a, b) }; }
  m = new RegExp(String.raw`\b(?:under|below|less than|cheaper than|no more than|not more than|up to|max(?:imum)?|at most|within|budget(?: is| of)?|sub|tops)\s+(?:of\s+)?${money}`).exec(t);
  if (m) return { max: n(m[1]) };
  m = new RegExp(String.raw`\b(?:spend|spending|budget(?: is| of)?)\s+(?:about\s+|around\s+|up to\s+)?${money}`).exec(t);
  if (m) return { max: n(m[1]) };
  m = new RegExp(String.raw`${money}\s+(?:or less|or under|or below|max(?:imum)?|tops|budget|or cheaper)\b`).exec(t);
  if (m) return { max: n(m[1]) };
  m = new RegExp(String.raw`\b(?:over|above|more than|at least|min(?:imum)?|starting at)\s+${money}`).exec(t);
  if (m) return { min: n(m[1]) };
  m = new RegExp(String.raw`\b(?:around|about|roughly|approximately|close to|near)\s+${money}`).exec(t);
  if (m && /\$|dollar|buck|usd|price|cost|spend|budget/.test(t)) return { around: n(m[1]), min: Math.round(n(m[1]) * 0.75), max: Math.round(n(m[1]) * 1.25) };
  m = /\$\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?)\b/.exec(t);
  if (m && /\b(spend|budget|price|cost|for|under)\b/.test(t)) return { max: n(m[1] ?? m[2]) };
  return null;
}

// What shoppers say -> what the catalogue says. Applied to whole words before search.
export const SYNONYMS: Record<string, string> = {
  trainers: 'sneakers', trainer: 'sneaker', rucksack: 'backpack', knapsack: 'backpack', 'back pack': 'backpack', daypack: 'daypack',
  flask: 'bottle', thermos: 'insulated bottle', torch: 'headlamp', flashlight: 'headlamp', jumper: 'sweater', pullover: 'pullover',
  trousers: 'pants', hoody: 'hoodie', hoodies: 'hoodie', tee: 't-shirt', tees: 't-shirt', tshirt: 't-shirt', 'tee shirt': 't-shirt',
  mobile: 'smartphone', cellphone: 'smartphone', 'cell phone': 'smartphone', 'mobile phone': 'smartphone', telly: 'tv', television: 'tv',
  earphones: 'earbuds', 'ear buds': 'earbuds', 'ear phones': 'earbuds', 'head phones': 'headphones', headset: 'headset',
  'blue tooth': 'bluetooth', 'blue-tooth': 'bluetooth', sneaks: 'sneakers', kicks: 'sneakers', parka: 'parka', 'rain coat': 'rain jacket', raincoat: 'rain jacket',
  'puffer': 'puffer', 'down coat': 'down jacket', 'water proof': 'waterproof', 'light weight': 'lightweight', 'note book': 'notebook',
  'lap top': 'laptop', 'smart watch': 'smartwatch', 'fitness watch': 'fitness tracker', 'frying pan': 'frying pan', skillet: 'skillet', 'fry pan': 'frying pan',
  'coffee machine': 'coffee maker', 'kettle bell': 'kettlebell', 'dumb bells': 'dumbbell', 'dumb bell': 'dumbbell', dumbbells: 'dumbbell',
  'yoga mat': 'yoga mat', 'sleeping bag': 'sleeping bag', 'hydro flask': 'insulated bottle', 'water bottle': 'water bottle', 'suit case': 'suitcase',
  luggage: 'suitcase', 'carry on': 'carry-on', carryon: 'carry-on', 'lego': 'building set', 'legos': 'building set', 'teddy': 'plush bear', 'teddy bear': 'plush bear',
};

// Words that never carry a product meaning in a shopping request, dropped before matching.
export const STOP = new Set(('a an the some any for to of in on with and or but my me i im i\'m we us our you your please can could would will '
  + 'looking look find show get want need buy something thing things one ones stuff kind sort type good nice great best really very just like likes '
  + 'who that which is are be it its this these those there here what how about around maybe also too as at by from into than then so '
  + 'hi hello hey okay ok um uh er well actually basically pretty quite gift gifts present presents idea ideas').split(/\s+/));

// Damerau-Levenshtein (optimal string alignment) distance, stopping early above max.
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

// A rough sound-alike key, so a word heard wrong by speech recognition still finds its catalogue word
// ("vale wick" -> "valewick", "nite stand" ~ "night stand"): vowels after the first letter dropped, similar sounds merged.
export function soundKey(w: string): string {
  let s = w.toLowerCase().replace(/[^a-z]/g, '');
  s = s.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/gh/g, 'g').replace(/kn/g, 'n').replace(/wr/g, 'r').replace(/igh/g, 'i')
    .replace(/[cq]/g, 'k').replace(/z/g, 's').replace(/x/g, 'ks').replace(/v/g, 'f').replace(/dg/g, 'j');
  return s[0] ? s[0] + s.slice(1).replace(/[aeiouyhw]/g, '').replace(/(.)\1+/g, '$1') : '';
}

export type Vocab = { words: Map<string, number>; byKey: Map<string, string[]>; joins: Map<string, string> };
// words: catalogue word -> how often it appears (titles, categories, brands, colours, spec values). Built once.
export function buildVocab(counts: Record<string, number> | Map<string, number>): Vocab {
  const words = counts instanceof Map ? counts : new Map(Object.entries(counts));
  const byKey = new Map<string, string[]>();
  const joins = new Map<string, string>();
  for (const w of words.keys()) {
    const k = soundKey(w);
    if (k.length >= 2) byKey.set(k, [...(byKey.get(k) ?? []), w]);
    if (w.length >= 7) for (let i = 3; i <= w.length - 3; i++) joins.set(`${w.slice(0, i)} ${w.slice(i)}`, w);
  }
  return { words, byKey, joins };
}

// The closest catalogue word to a word that isn't one: within edit distance 1 (2 for long words), or the same sound
// key; ties go to the more common word. Returns null when nothing is close enough (the word is kept as said).
export function closestWord(w: string, v: Vocab): string | null {
  if (v.words.has(w) || w.length < 3 || /\d/.test(w)) return null;
  const max = w.length >= 7 ? 2 : 1;
  let best: string | null = null, bestScore = Infinity;
  for (const [cand, freq] of v.words) {
    if (Math.abs(cand.length - w.length) > max || cand[0] !== w[0] && max < 2) continue;
    const d = editDistance(w, cand, max);
    if (d > max) continue;
    const score = d * 1000 - Math.log(1 + freq);
    if (score < bestScore) { bestScore = score; best = cand; }
  }
  if (best) return best;
  const sk = soundKey(w);
  const same = (v.byKey.get(sk) ?? []).filter(c => Math.abs(c.length - w.length) <= 3);
  if (sk.length >= 3 && same.length) return same.sort((a, b) => (v.words.get(b) ?? 0) - (v.words.get(a) ?? 0))[0];
  return null;
}

// Fix a whole query: synonyms, split words joined back ("head phones" -> "headphones"), plurals the catalogue doesn't
// use, and misheard words. Returns the fixed text and which words changed (for "Showing results for …").
export function correctQuery(q: string, v: Vocab): { text: string; changed: [string, string][] } {
  let t = ` ${q.toLowerCase().replace(/[^a-z0-9$.\s'-]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const changed: [string, string][] = [];
  for (const [from, to] of Object.entries(SYNONYMS).sort((a, b) => b[0].length - a[0].length)) {
    if (from === to) continue;
    const re = new RegExp(`(?<= )${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?= )`, 'g');
    if (re.test(t)) { t = t.replace(re, to); changed.push([from, to]); }
  }
  let toks = t.trim().split(' ').filter(Boolean);
  // two words heard apart that are one catalogue word
  for (let i = 0; i < toks.length - 1; i++) {
    const pair = `${toks[i]} ${toks[i + 1]}`;
    const joined = v.joins.get(pair) ?? (v.words.has(toks[i] + toks[i + 1]) && !v.words.has(toks[i]) ? toks[i] + toks[i + 1] : undefined)
      ?? (!v.words.has(toks[i]) || !v.words.has(toks[i + 1]) ? closestJoined(toks[i] + toks[i + 1], v) : undefined);
    if (joined) { changed.push([pair, joined]); toks.splice(i, 2, joined); }
  }
  toks = toks.map(w => {
    if (STOP.has(w) || v.words.has(w)) return w;
    const sing = w.endsWith('es') && v.words.has(w.slice(0, -2)) ? w.slice(0, -2) : w.endsWith('s') && v.words.has(w.slice(0, -1)) ? w.slice(0, -1) : null;
    if (sing) return w; // a plural of a catalogue word: full-text search stems it
    const c = closestWord(w, v);
    if (c && c !== w) { changed.push([w, c]); return c; }
    return w;
  });
  return { text: toks.join(' '), changed };
}

function closestJoined(w: string, v: Vocab): string | undefined {
  if (w.length < 7) return undefined;
  const c = closestWord(w, v);
  return c && editDistance(c, w, 1) <= 1 ? c : undefined;
}

export const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
// How a price is said aloud: "$74.99" -> "74 dollars 99"; the text shows "$74.99".
export const sayMoney = (n: number) => money(n);
