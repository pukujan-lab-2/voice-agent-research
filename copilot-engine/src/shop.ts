// The shopping copilot: helps someone find and pick a product by voice on a large store, without touching the screen.
// Every decision is made here in code (no model): what was asked, which filters it means, what to search, what to say.
// The store is reached through Store (the site's own API), so every product fact said aloud comes from the catalogue
// and every policy answer is quoted from the store's help centre with its citation.
//
// Rules it keeps:
// - A vague request gets a clarifying question built from the catalogue's own facets ("a gift for my dad who likes
//   hiking, under $80" -> "the biggest groups are Hiking Backpacks, Headlamps and Water Bottles; which sounds good?").
// - Adding to the cart is read back in full (product, colour, size, quantity, price) and happens only after a yes.
// - It never places an order, pays or submits anything: checkout is handed to the form copilot, which fills the
//   fields with a read-back each, and the shopper presses Place order themselves.
// - Shipping, returns and other policy questions are answered only from the help centre, quoted, with a citation, or
//   not at all.
// - "Go back" returns to the previous list or product.
import { STOP, money, parseBudget, wordsToDigits, type Budget } from './shop-text.ts';

export type Card = { id: string; slug: string; title: string; brand: string; price: number; max_price: number; list_price: number | null; deal: number;
  rating: number | null; review_count: number; in_stock: boolean; colors: string[]; sizes: string[]; category: string; cat_slug: string; dept: string; dept_slug: string };
export type Facet = { label: string; value: string; count: number };
export type SearchResult = { total: number; page: number; pages: number; items: Card[]; query: string; correctedFrom: string | null; relaxed: boolean;
  facets: { categories: Facet[]; brands: Facet[]; colors: Facet[]; sizes: Facet[]; depts: Facet[] } };
export type Variant = { sku: string; color: string | null; size: string | null; price: number; stock: number };
export type Product = Card & { specs: { name: string; value: string }[]; bullets: string[]; variants: Variant[]; dist: { stars: number; count: number }[];
  top_reviews: { stars: number; title: string; body: string }[]; top_questions: { question: string; answer: string }[]; description: string };
export type CartLine = { sku: string; qty: number; title: string; color: string | null; size: string | null; price: number; line_total: number };
export type Cart = { lines: CartLine[]; count: number; subtotal: number; shipping: { id: string; label: string; cost: number; days: string }[]; freeShippingAt?: number };
export type HelpAnswer = { found: boolean; quote?: string[]; cite?: { title: string; section: string; href: string } };

export interface Store {
  search(params: Params): Promise<SearchResult>;
  product(id: string): Promise<Product | null>;
  questions(id: string): Promise<{ question: string; answer: string }[]>;
  cart(): Promise<Cart>;
  addToCart(sku: string, qty: number): Promise<{ ok: boolean; error?: string; cart?: Cart }>;
  help(question: string): Promise<HelpAnswer>;
}

// Search parameters, the same names as the site's /search URL and the store API.
export type Params = { q?: string; cat?: string; dept?: string; brand?: string; color?: string; size?: string; tags?: string; audience?: string;
  minPrice?: number; maxPrice?: number; rating?: number; inStock?: boolean; deal?: boolean; sort?: string; page?: number };
export type Link = { text: string; href: string };
// go: a page to open (the site's own router); checkout: hand the call to the checkout form; cartChanged: refresh it.
export type Reply = { text: string; go?: string; links?: Link[]; checkout?: boolean; cartChanged?: boolean };
export type Context = { path: string }; // the page the shopper is on now (path and query)

export const searchPath = (p: Params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '' && v !== false) u.set(k, v === true ? '1' : String(v));
  return `/search?${u}`;
};
export const productPath = (c: { id: string; slug: string }) => `/p/${c.id}/${c.slug}`;

// ---- what was said: words for people, interests, colours, sizes, order, yes and no
const AUDIENCE: [RegExp, string, string][] = [
  [/\b(dad|father|daddy|husband|boyfriend|brother|grandpa|grandad|granddad|grandfather|uncle|him|he|man|men|guy|guys|mens|men's|male)\b/, 'men', 'him'],
  [/\b(mom|mum|mother|mommy|wife|girlfriend|sister|grandma|grandmother|nan|aunt|her|she|woman|women|lady|ladies|womens|women's|female)\b/, 'women', 'her'],
  [/\b(baby|newborn|infant)\b/, 'baby', 'the baby'],
  [/\b(son|daughter|kid|kids|child|children|nephew|niece|boy|girl|toddler|teen|teenager|grandson|granddaughter)\b/, 'kids', 'them'],
];
const WHO: [RegExp, string][] = [[/\b(dad|father|daddy)\b/, 'your dad'], [/\b(mom|mum|mother|mommy)\b/, 'your mom'], [/\bwife\b/, 'your wife'], [/\bhusband\b/, 'your husband'],
  [/\b(brother)\b/, 'your brother'], [/\bsister\b/, 'your sister'], [/\b(son)\b/, 'your son'], [/\bdaughter\b/, 'your daughter'], [/\b(grandpa|grandad|granddad|grandfather)\b/, 'your grandpa'],
  [/\b(grandma|grandmother|nan)\b/, 'your grandma'], [/\bboyfriend\b/, 'your boyfriend'], [/\bgirlfriend\b/, 'your girlfriend'], [/\b(friend|coworker|colleague|boss)\b/, 'your $1'],
  [/\b(kid|child|toddler)\b/, 'a child'], [/\bbaby\b/, 'a baby'], [/\b(teen|teenager)\b/, 'a teenager']];
// interest words -> the catalogue's tags
const INTERESTS: [RegExp, string][] = [
  [/\bhik(e|es|er|ers|ing)\b|\btrek(king)?\b|\bbackpack(er|ing)\b/, 'hiking'], [/\bcamp(s|er|ers|ing)?\b/, 'camping'], [/\brun(s|ner|ners|ning)?\b|\bjog(s|ger|ging)?\b|\bmarathon/, 'running'],
  [/\bcook(s|ing)?\b|\bchef\b|\bkitchen\b/, 'cooking'], [/\bbak(e|es|er|ing)\b/, 'baking'], [/\bgarden(s|er|ing)?\b/, 'gardening'], [/\bread(s|er|ers|ing)?\b|\bbookworm\b/, 'reading'],
  [/\bgam(e|es|er|ers|ing)\b|\bvideo ?games?\b/, 'gaming'], [/\bcoffee\b/, 'coffee'], [/\btea\b/, 'tea'], [/\bdogs?\b/, 'dogs'], [/\bcats?\b/, 'cats'], [/\bpets?\b/, 'pets'],
  [/\bphotograph(y|er|ers)?\b|\bcameras?\b/, 'photography'], [/\bcycl(e|es|ist|ing)\b|\bbik(e|es|ing)\b/, 'cycling'], [/\bclimb(s|er|ing)?\b|\bboulder(ing)?\b/, 'climbing'],
  [/\bski(s|er|ing)?\b|\bsnowboard/, 'skiing'], [/\bswim(s|mer|ming)?\b/, 'swimming'], [/\byoga\b/, 'yoga'], [/\bgym\b|\bwork(s|ing)? ?out\b|\blift(s|ing)? weights\b/, 'gym'],
  [/\bfitness\b|\bexercis(e|es|ing)\b/, 'fitness'], [/\bmusic(al|ian)?\b|\bguitar\b|\bsing(s|er|ing)?\b/, 'music'], [/\bart(ist|s|sy)?\b|\bpaint(s|er|ing)?\b|\bdraw(s|ing)?\b/, 'art'],
  [/\bwoodwork(er|ing)?\b|\bcarpent(er|ry)\b/, 'woodworking'], [/\bdiy\b|\bfix(es|ing)? things\b|\btools?\b/, 'diy'], [/\btravel(s|er|ling|ing)?\b|\btrips?\b/, 'travel'],
  [/\bgrill(s|ing)?\b|\bbbq\b|\bbarbecue\b/, 'grilling'], [/\bbirds?\b|\bbird ?watch(ing|er)?\b|\bbirding\b/, 'birdwatching'], [/\bplants?\b/, 'plants'], [/\bcraft(s|y|ing)?\b|\bknit(s|ting)?\b/, 'crafts'],
  [/\bpuzzles?\b/, 'puzzles'], [/\bboard ?games?\b/, 'games'], [/\bmovies?\b|\bfilms?\b/, 'movies'], [/\bsci-?fi\b|\bscience fiction\b/, 'scifi'], [/\bhistory\b/, 'history'],
  [/\bwrit(e|es|er|ing)\b|\bjournal(s|ing)?\b/, 'writing'], [/\bmake ?up\b/, 'makeup'], [/\bskin ?care\b/, 'skincare'], [/\bself[- ]care\b|\bpamper/, 'self-care'],
  [/\bjewel(le)?ry\b/, 'jewelry'], [/\bcars?\b|\bdriv(e|es|ing)\b/, 'cars'], [/\bwalk(s|er|ing)?\b/, 'walking'], [/\bsports?\b/, 'sports'], [/\btech\b|\bgadgets?\b|\bgeek\b/, 'tech'],
  [/\bfashion\b|\bclothes\b|\bstyle\b/, 'fashion'], [/\bsleep(s|ing)?\b/, 'sleep'], [/\bschool\b|\bstudent\b/, 'school'], [/\bstem\b|\bscience\b/, 'stem'], [/\bfragrance|perfume|cologne\b/, 'fragrance'],
];
const COLORS = ['Black', 'Charcoal', 'Slate Grey', 'White', 'Sand', 'Khaki', 'Forest Green', 'Olive', 'Sage', 'Navy', 'Ocean Blue', 'Sky Blue', 'Teal', 'Burgundy', 'Brick Red',
  'Coral', 'Rust', 'Mustard', 'Plum', 'Lavender', 'Blush', 'Brown', 'Cream', 'Red'];
const COLOR_FAMILY: Record<string, string[]> = { grey: ['Slate Grey', 'Charcoal'], gray: ['Slate Grey', 'Charcoal'], green: ['Forest Green', 'Olive', 'Sage'],
  blue: ['Navy', 'Ocean Blue', 'Sky Blue', 'Teal'], red: ['Red', 'Brick Red', 'Burgundy'], pink: ['Blush', 'Coral'], purple: ['Plum', 'Lavender'], yellow: ['Mustard'],
  beige: ['Sand', 'Khaki', 'Cream'], tan: ['Sand', 'Khaki'], orange: ['Rust', 'Coral'], 'dark blue': ['Navy'], 'light blue': ['Sky Blue'], 'off white': ['Cream'], maroon: ['Burgundy'] };
const SIZE_WORDS: [RegExp, string[]][] = [[/\b(extra small|x small|xs)\b/, ['XS']], [/\b(extra extra large|double x l|xxl|2xl)\b/, ['XXL']], [/\b(extra large|x large|xl)\b/, ['XL']],
  [/\b(small)\b/, ['S', 'Small']], [/\b(medium)\b/, ['M', 'Medium']], [/\b(large)\b/, ['L', 'Large']], [/\b(twin)\b/, ['Twin']], [/\b(full|double)\b/, ['Full']],
  [/\b(queen)\b/, ['Queen']], [/\b(king)\b/, ['King']]];
const SAY_SIZE: Record<string, string> = { XS: 'extra small', S: 'small', M: 'medium', L: 'large', XL: 'extra large', XXL: 'double extra large' };
const ORD: [RegExp, number][] = [[/\b(first|1st|number one|top one|option one|#1)\b/, 1], [/\b(second|2nd|number two|option two|#2)\b/, 2], [/\b(third|3rd|number three|option three|#3)\b/, 3],
  [/\b(fourth|4th|number four|#4)\b/, 4], [/\b(fifth|5th|number five|#5)\b/, 5], [/\b(sixth|6th|number six)\b/, 6], [/\b(last)( one)?\b/, -1]];
const YES = /^(yes|yeah|yep|yup|ya|yah|sure|correct|right|that's right|that is right|ok|okay|please do|do it|go ahead|add it|sounds good|perfect|absolutely|definitely|affirmative|confirm|great|good)\b/;
const NO = /^(no|nope|nah|don't|do not|cancel|never ?mind|not now|not yet|stop|hold on|wait)\b/;

const HELP = /\b(ship(ping|s|ped)?|deliver(y|ed|ies)?|arriv(e|es|al)|return(s|ing|ed)?|refund(s|ed)?|exchange|send (it )?back|track(ing)?|where('s| is) my (order|package|parcel)|cancel( my| an| the)? order|warrant(y|ies)|guarantee|payment methods?|pay with|credit card|paypal|sales tax|tax|gift ?wrap(s|ped|ping)?|wrap (it|them)|gift receipt|promo|coupon|discount code|price ?match|damaged|broken|defective|wrong item|missing|privacy|personal data|account|guest checkout|out of stock|back in stock|restock|size guide|sizing|fit guide|how (long|fast|quickly) (does|will|would|is)|payment|pay(ing)? (by|with)|accept|take (cards?|paypal|credit)|next[- ]day|overnight|express|expedited|international|canada|po box|holiday)\b/;
// asks the copilot to place, pay or submit: refused, the shopper does that themselves
export const PLACE = /\b(place|submit|complete|finali[sz]e|confirm|send)( the| my| this)? (order|purchase|checkout)\b|\bpay (for (it|this|that|them|the order)|now|with)\b|\b(buy|order) (it|this|that) (now|for me)\b|\bcharge (my|the) card\b|\bpress (the )?place order\b/;
const CHECKOUT = /\b(check ?out|go to (the )?(checkout|payment)|ready to (pay|order|check ?out|buy)|proceed to (checkout|payment)|that's (all|everything)|i'm done shopping)\b/;
const CART = /\b(what'?s|what is|show( me)?|read( me)?|open|view|go to|how much is|what'?s in|check) (in )?(my |the )?(cart|basket|bag)\b|\bcart total\b|\bmy cart\b/;
const ADD = /\b(add|put|throw|pop|stick)\b.*\b(to|in|into)( my| the)? (cart|basket|bag)\b|\b(add|get|buy|take) (it|this|that|this one|that one|them|those|one|two|three|\d+)\b|\bi'?ll take (it|this|that|one|two|\d+)\b|\badd to cart\b|^(?:please )?(?:add|buy|grab|get me) (?:the |number |option )?(?:first|second|third|fourth|fifth|last|\d|one|two|three)\b/;
const BACK = /^(go |take me )?back( to (the )?(results|list|search|previous( page)?|last (page|list)))?$|\bprevious (page|results|list)\b|\bback to (the )?(results|list|search)\b/;
const COMPARE = /\b(compare|comparison|difference between|versus|vs\.?|which is better)\b/;
const REVIEWS = /\b(reviews?|reviewers?|ratings?|stars?|what (do )?(people|customers|others|buyers) (say|think)|anyone (like|say)|is it (any )?good|worth it)\b/;
const MORE = /\b(more|next page|next ones|others|other ones|show me more|keep going|what else)\b/;
const RESET = /\b(start over|clear (the |all )?(filters|everything)|reset|new search|something else entirely)\b/;
const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening))\b[\s!,.]*$/;
const OFF = /\b(weather|joke|news|stock market|bitcoin|crypto|politic|election|recipe for|meaning of life|who are you|your name|sing|poem)\b/;

const lower = (s: string) => wordsToDigits(s.toLowerCase().replace(/[’‘]/g, "'").replace(/[?!.,;]+/g, ' ').replace(/\s+/g, ' ').trim());

function ordinal(t: string): number | null {
  for (const [re, n] of ORD) if (re.test(t)) return n;
  const m = /\b(?:number|option|item|no\.?|#)\s*(\d)\b/.exec(t) ?? /^(?:the )?(\d)(?: one)?$/.exec(t);
  return m ? Number(m[1]) : null;
}
function colorsIn(t: string): string[] {
  const out: string[] = [];
  let rest = ` ${t} `;
  for (const c of [...COLORS].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${c.toLowerCase()}\\b`);
    if (re.test(rest)) { out.push(c); rest = rest.replace(re, ' '); }
  }
  for (const [w, fam] of Object.entries(COLOR_FAMILY).sort((a, b) => b[0].length - a[0].length)) {
    const re = new RegExp(`\\b${w}\\b`);
    if (re.test(rest)) { out.push(...fam); rest = rest.replace(re, ' '); }
  }
  return [...new Set(out)];
}
function sizesIn(t: string): string[] {
  const out: string[] = [];
  const shoe = /\bsize (\d{1,2})( and a half|\.5| 1\/2)?\b|\b(\d{1,2})( and a half|\.5)? (?:shoe|shoes|boot|boots)\b/.exec(t);
  if (shoe) out.push(`${shoe[1] ?? shoe[3]}${shoe[2] || shoe[4] ? '.5' : ''}`);
  const screen = /\b(24|27|32|43|55|65)[ -]?(inch|in|\")\b/.exec(t);
  if (screen) out.push(`${screen[1]} in`);
  const letter = /\bsize (xs|s|m|l|xl|xxl)\b/.exec(t);
  if (letter) out.push(letter[1].toUpperCase());
  for (const [re, s] of SIZE_WORDS) if (re.test(t)) out.push(...s);
  return [...new Set(out)];
}
const sizeSay = (s: string) => SAY_SIZE[s] ?? s;
function audienceIn(t: string): { audience: string; who: string } | null {
  for (const [re, a] of AUDIENCE) if (re.test(t)) {
    const w = WHO.find(([r]) => r.test(t));
    return { audience: a, who: w ? w[1].replace('$1', (t.match(w[0]) ?? ['', ''])[1] ?? '') : '' };
  }
  return null;
}
function interestsIn(t: string): string[] {
  // only what they like, not the thing being bought ("hiking boots" is a product; "who likes hiking" is an interest)
  const m = /\b(?:likes?|loves?|enjoys?|into|who (?:is|are|'s)? ?(?:a |an )?|fan of|obsessed with|passionate about|that (?:likes?|loves?))\s+(.+)$/.exec(t);
  const scope = m ? m[1] : /\bgifts?|present|for (my|a|an|our)\b/.test(t) ? t : '';
  return [...new Set(INTERESTS.filter(([re]) => re.test(scope)).map(([, tag]) => tag))];
}
const GIFT = /\b(gifts?|present|presents|stocking stuffer|birthday|christmas|anniversary|father's day|mother's day|for (my|our) (dad|mom|mum|father|mother|wife|husband|son|daughter|brother|sister|friend|grandpa|grandma|boyfriend|girlfriend|kid|kids))\b/;
const SORT_WORDS: [RegExp, string][] = [[/\b(cheapest|lowest price|least expensive|cheap(er)? (ones|first)|price low|low to high|sort by price)\b/, 'price_asc'],
  [/\b(most expensive|highest price|high to low|priciest|premium)\b/, 'price_desc'], [/\b(best|top|highest)[- ]rated\b|\bbest reviews\b|\bhighest rating\b|\bsort by (rating|stars|reviews)\b/, 'rating'],
  [/\b(most reviews|most reviewed)\b/, 'reviews'], [/\b(most popular|best sell(ers|ing)|popular)\b/, 'popular'], [/\b(newest|latest|new arrivals|just in)\b/, 'newest'],
  [/\b(biggest (discount|deal|saving)s?|best deals?)\b/, 'discount']];

// Command words speech recognition often mishears ("sought by" for "sort by", "chuck out" for "check out").
const MISHEARD: [RegExp, string][] = [
  [/\b(sought|sort of|sorta|sword|soared|sorted) by\b/g, 'sort by'],
  [/\b(chuck|cheque|czech|jack|chick|chalk) ?out\b/g, 'check out'], [/\bcheck up\b(?! on)/g, 'check out'],
  [/\b(card|caught|cart's|carts|court|kart)\b(?= (total|please)|$)/g, 'cart'], [/\bmy (card|caught|court|kart)\b/g, 'my cart'],
  [/^(please )?(at|ad|and) (.{1,40}?) (to|two|too) (my|the) (cart|card)\b/, 'add $3 to my cart'],
];
export function heard(t: string): string {
  for (const [re, to] of MISHEARD) t = t.replace(re, to);
  return t;
}

// What a request means as search terms: the words left after budget, colours, sizes, people, interests, sort words and
// filler are taken out. Empty means the request named no kind of product.
function productWords(t: string, b: Budget | null): string {
  let s = ` ${t} `;
  if (b) s = s.replace(/\b(between|from|under|below|less than|cheaper than|no more than|not more than|up to|max(imum)?|at most|within|budget( is| of)?|sub|tops|spend(ing)?|over|above|more than|at least|min(imum)?|starting at|around|about|roughly|approximately|close to|near|or less|or under|or below|or cheaper)\b/g, ' ')
    .replace(/\$?\s?\d+(\.\d{1,2})?\s*(dollars?|bucks?|usd|k)?\b/g, ' ').replace(/\b(and|to)\s+(?=\s)/g, ' ');
  s = s.replace(/\bsize \w+( and a half)?\b/g, ' ').replace(/\b(24|27|32|43|55|65)[ -]?(inch|in)\b/g, ' ');
  for (const c of [...COLORS, ...Object.keys(COLOR_FAMILY)].sort((a, b) => b.length - a.length)) s = s.replace(new RegExp(`\\b${c.toLowerCase()}\\b`, 'g'), ' ');
  for (const [re] of SIZE_WORDS) s = s.replace(new RegExp(re.source, 'g'), ' ');
  for (const [re] of SORT_WORDS) s = s.replace(new RegExp(re.source, 'g'), ' ');
  // "who likes hiking", "for my dad"
  s = s.replace(/\b(who|that) (likes?|loves?|enjoys?|is into|are into|is a|is an)\b.*$/g, ' ').replace(/\b(likes?|loves?|enjoys?|into|fan of)\s+\w+(ing)?\b/g, ' ');
  for (const [re] of AUDIENCE) s = s.replace(new RegExp(re.source, 'g'), ' ');
  s = s.replace(GIFT, ' ').replace(/\b(more|next|page|else|others?|keep going|budget|price|cost|money|spend|dollars?|bucks?|she|he|they|them|her|his|their|loves?|likes?|enjoys?|birthday|christmas|anniversary|holiday|gift|gifts|present|presents|idea|ideas|on sale|deals?|in stock|available|cheap|cheaper|affordable|expensive|ones?|stuff|something|anything|items?|products?|options?|recommend(ation)?s?|suggest(ion)?s?|search( for)?|find( me)?|show( me)?|i'?m|i am|looking|look|want|need|buy|get|shopping|shop|help me|can you|could you|would you|please|some|good|nice|great|decent|quality|new|pair of|a pair|for|of|the|my|a|an|me|with|and|or|in|on|at|to)\b/g, ' ');
  return s.split(/\s+/).filter(w => w && !STOP.has(w) && w.length > 1).join(' ');
}

type Pending =
  | { kind: 'add'; product: Product; variant: Variant; qty: number }
  | { kind: 'variant'; product: Product; qty: number; need: 'color' | 'size'; options: string[]; color?: string; size?: string }
  | { kind: 'clarify'; params: Params; options: Facet[]; about: string }
  | { kind: 'gift'; budget: Budget | null; audience: { audience: string; who: string } | null; interests: string[] };

export class Shopper {
  private results: { params: Params; res: SearchResult } | null = null;
  private product: Product | null = null;
  private pending: Pending | null = null;
  private history: string[] = [];
  private here = '';
  private saidFix = ''; // the last search correction already said aloud

  private store: Store;
  private opts: { business?: string };
  constructor(store: Store, opts: { business?: string } = {}) { this.store = store; this.opts = opts; }

  greeting(): string {
    return `Hi, I'm the ${this.opts.business ?? 'store'}'s shopping assistant. Tell me what you're looking for, like "a rain jacket under 100 dollars" or "a gift for my dad who likes hiking". I can compare products, read reviews and specs, add things to your cart, and answer shipping and returns questions. I won't place the order: you do that yourself.`;
  }

  // One turn: what the shopper said, and the page they're on.
  async turn(said: string, ctx: Context): Promise<Reply> {
    const t = heard(lower(said));
    this.here = ctx.path;
    await this.syncPage(ctx.path);
    if (!t) return { text: "Sorry, I didn't catch that. What are you looking for?" };

    if (PLACE.test(t)) return { text: "I can't place the order or pay for you. When you're ready, check the order review and press Place order yourself." };

    const p = this.pending;
    this.pending = null; // each handler sets it again when it asks something new
    if (p?.kind === 'add') { const r = await this.answerAdd(t, p); if (r) return r; }
    if (p?.kind === 'variant') { const r = await this.answerVariant(t, p); if (r) return r; }
    if (p?.kind === 'clarify') { const r = await this.answerClarify(t, p); if (r) return r; }
    if (p?.kind === 'gift') { const r = await this.answerGift(t, p); if (r) return r; }

    if (GREETING.test(t)) return { text: 'Hi! What are you shopping for today?' };
    if ((YES.test(t) || NO.test(t)) && t.split(' ').length <= 3) return { text: "There's nothing waiting for a yes or no right now. What would you like to do?" };
    if (BACK.test(t)) return this.back();
    if (RESET.test(t)) { this.results = null; return { text: 'Okay, starting over. What are you looking for?' }; }
    if (CHECKOUT.test(t)) return this.checkout();
    if (CART.test(t) && !ADD.test(t)) return this.readCart();
    if (HELP.test(t) && !this.looksLikeProductSearch(t)) return this.help(said);
    if (COMPARE.test(t)) return this.compare(t);
    if (ADD.test(t)) return this.add(t);
    if (OFF.test(t)) return { text: "I can only help with shopping here: finding products, comparing them, your cart, and the store's shipping and returns. What are you looking for?" };

    const n = ordinal(t);
    if (n !== null && this.results && /\b(one|item|number|option|open|show|tell|about|details|what|pick|choose|first|second|third|fourth|fifth|last|go with|like)\b|^\S+$/.test(t)) return this.open(n);

    if (this.product && this.onProduct()) {
      const r = await this.aboutProduct(t);
      if (r) return r;
    }
    if (/\b(it|this|that|this one|that one)\b/.test(t) && (REVIEWS.test(t) || /^(what|how|is|does|can|will|are|do)\b/.test(t)) && !this.looksLikeNewSearch(t))
      return { text: this.results ? 'Which one do you mean? Say for example "tell me about the first one".' : "Which product do you mean? Tell me what you're looking for and I'll find it." };
    if (this.results && MORE.test(t) && !productWords(t, null)) return this.more();
    return this.find(t);
  }

  // ---- pages: the shopper may have moved by hand; what's on screen is what "it" and "the first one" mean
  private onProduct() { return /^\/p\/BW\d+/.test(this.here); }
  private async syncPage(path: string) {
    const m = /^\/p\/(BW\d+)/.exec(path);
    if (m && this.product?.id !== m[1]) this.product = await this.store.product(m[1]);
    const s = /^\/search\?(.*)$/.exec(path);
    if (s && (!this.results || searchPath(this.results.params) !== path)) {
      const u = new URLSearchParams(s[1]);
      const params: Params = {};
      for (const [k, v] of u) (params as any)[k] = ['minPrice', 'maxPrice', 'rating', 'page'].includes(k) ? Number(v) : ['inStock', 'deal'].includes(k) ? v === '1' : v;
      this.results = { params, res: await this.store.search(params) };
    }
  }
  private go(path: string): string { if (path !== this.here) this.history.push(this.here); this.here = path; return path; }

  private back(): Reply {
    const prev = this.history.pop();
    if (!prev) return { text: "There's nothing to go back to yet. What are you looking for?" };
    this.here = prev;
    if (prev.startsWith('/search') && this.results) return { text: `Back to the list. ${this.top3(this.results.res)}`, go: prev };
    return { text: 'Going back.', go: prev };
  }

  // ---- finding things
  // "is it waterproof" is a question about a product; "do you have waterproof boots" is a search
  private looksLikeNewSearch(t: string) { return /\b(do you (have|sell|carry)|looking for|show me|find( me)?|search|need|want)\b/.test(t); }
  private looksLikeProductSearch(t: string) {
    return /\b(waterproof|water resistant|shoes?|boots?|jacket|bag|backpack|tent|bottle|speaker|watch|headphones?)\b/.test(t) && !/\b(return|refund|ship|deliver|track|order|policy|exchange)\b/.test(t);
  }

  private async find(t: string, extra: Params = {}): Promise<Reply> {
    const budget = parseBudget(t);
    const who = audienceIn(t);
    const likes = interestsIn(t);
    const gift = GIFT.test(t);
    const words = productWords(t, budget);
    const colors = colorsIn(t);
    const sizes = sizesIn(t);
    const sort = SORT_WORDS.find(([re]) => re.test(t))?.[1];
    const params: Params = { ...extra };
    if (words) params.q = words;
    if (budget?.max !== undefined) params.maxPrice = budget.max;
    if (budget?.min !== undefined) params.minPrice = budget.min;
    if (colors.length) params.color = colors.join(',');
    if (sizes.length) params.size = sizes.join(',');
    if (sort) params.sort = sort;
    if (/\b(on sale|deals?|discount(ed)?)\b/.test(t)) params.deal = true;
    if (/\bin stock\b|\bavailable now\b/.test(t)) params.inStock = true;
    if (who) params.audience = audienceParam(who.audience, gift && !words);
    if (likes.length && (gift || !words)) params.tags = likes.join(',');

    // A refinement of the list on screen: "in blue", "under 50", "cheaper ones", "only in stock".
    if (!words && !likes.length && !who && this.results && (budget || colors.length || sizes.length || sort || params.deal || params.inStock || /\bcheaper\b/.test(t)))
      return this.refine(t, params);

    // A gift with nothing to go on yet: ask who it's for and what they like.
    if (gift && !words && !likes.length && !who) {
      this.pending = { kind: 'gift', budget, audience: null, interests: [] };
      return { text: `Happy to help find a gift. Who's it for, and what do they enjoy? ${budget ? '' : 'And roughly how much would you like to spend?'}`.trim() };
    }
    if (gift && !words && who && !likes.length) {
      this.pending = { kind: 'gift', budget, audience: who, interests: [] };
      return { text: `What does ${who.who || 'they'} enjoy? For example hiking, cooking, reading or gaming.${budget ? '' : ' And roughly what budget?'}` };
    }
    if (!words && !likes.length && !params.color && !who) {
      return { text: "What kind of thing are you looking for? You can say something like \"running shoes under 80 dollars\" or \"a gift for a coffee lover\"." };
    }
    if (gift && !params.q) params.tags = [...new Set([...(params.tags ?? '').split(',').filter(Boolean), 'gift'])].join(',');

    const res = await this.store.search(params);
    if (!res.total) {
      // nothing at that price or in that colour: say what is there instead of a dead end
      if (params.maxPrice !== undefined || params.color || params.size) {
        const loose = await this.store.search({ q: params.q, tags: params.tags, audience: params.audience });
        if (loose.total) {
          const cheapest = Math.min(...loose.items.map(i => i.price));
          return { text: `I couldn't find ${params.q ?? 'anything'}${params.maxPrice !== undefined ? ` under ${money(params.maxPrice)}` : ''}${params.color ? ` in ${params.color.split(',')[0].toLowerCase()}` : ''}${params.size ? ` in size ${sizeSay(params.size.split(',')[0])}` : ''}. There are ${loose.total.toLocaleString('en-US')} without that limit${params.maxPrice !== undefined ? `, from about ${money(cheapest)}` : ''}. Want me to show those?`,
            ...this.offer({ kind: 'clarify', params: { q: params.q, tags: params.tags, audience: params.audience }, options: [], about: 'loosen' }) };
        }
      }
      return { text: `I couldn't find anything for "${words || t}". Could you say it another way, or name the kind of product?` };
    }

    // Vague (no kind of product named): narrow by the catalogue's own biggest categories first.
    if (!params.q && res.facets.categories.length > 1) {
      const options = res.facets.categories.slice(0, 3);
      const about = describe(params, who, likes);
      this.results = { params, res };
      this.pending = { kind: 'clarify', params, options, about };
      return { text: `${cap(about)}: I found ${res.total.toLocaleString('en-US')} ideas. The biggest groups are ${list(options.map(o => o.label))}. Which sounds good? Or tell me something else ${who?.audience === 'men' ? 'he' : who?.audience === 'women' ? 'she' : 'they'} likes.`,
        go: this.go(searchPath(params)) };
    }
    return this.show(params, res);
  }

  // A gift search from what is known so far (from a conversation of several turns).
  private async giftSearch(budget: Budget | null, who: { audience: string; who: string } | null, likes: string[], words: string): Promise<Reply> {
    const params: Params = {};
    if (words) params.q = words;
    if (budget?.max !== undefined) params.maxPrice = budget.max;
    if (budget?.min !== undefined) params.minPrice = budget.min;
    if (who) params.audience = audienceParam(who.audience, !words);
    params.tags = [...likes, ...(words ? [] : ['gift'])].join(',') || undefined;
    const res = await this.store.search(params);
    if (!res.total) return { text: `I couldn't find gifts like that${budget?.max !== undefined ? ` under ${money(budget.max)}` : ''}. Could you tell me something else they like, or a higher budget?` };
    if (!params.q && res.facets.categories.length > 1) {
      const options = res.facets.categories.slice(0, 3);
      const about = describe(params, who, likes);
      this.results = { params, res };
      this.pending = { kind: 'clarify', params, options, about };
      return { text: `${cap(about)}: I found ${res.total.toLocaleString('en-US')} ideas. The biggest groups are ${list(options.map(o => o.label))}. Which sounds good?`, go: this.go(searchPath(params)) };
    }
    return this.show(params, res);
  }

  private offer(p: Pending) { this.pending = p; return {}; }

  private async refine(t: string, add: Params): Promise<Reply> {
    const cur = this.results!;
    const params: Params = { ...cur.params, ...add, page: undefined };
    if (/\bcheaper\b/.test(t) && !add.maxPrice && !add.sort) {
      const top = cur.res.items[0]?.price;
      if (top) params.maxPrice = Math.floor(top * 0.8);
      else params.sort = 'price_asc';
    }
    const res = await this.store.search(params);
    if (!res.total) return { text: `Nothing matches that as well. ${this.top3(cur.res)} Want to try a different filter?` };
    return this.show(params, res);
  }

  private async more(): Promise<Reply> {
    const cur = this.results!;
    const page = (cur.params.page ?? 1) + 1;
    if (page > cur.res.pages) return { text: "That's everything in this list. Want me to widen the search?" };
    const params = { ...cur.params, page };
    return this.show(params, await this.store.search(params), true);
  }

  private show(params: Params, res: SearchResult, next = false): Reply {
    if (res.relaxed && !next) {
      const main = (res.query || params.q || '').split(' ').filter(w => w.length > 2).at(-1) ?? '';
      const stem = main.replace(/(ves|es|s)$/, '').slice(0, 5);
      if (stem && !res.items.slice(0, 3).some(i => i.title.toLowerCase().includes(stem)))
        return { text: `I couldn't find any ${res.query || params.q}. It doesn't look like the store carries them. Could you try a different kind of product?` };
    }
    this.results = { params, res };
    this.product = null;
    const said = this.saidFix;
    this.saidFix = res.correctedFrom ?? '';
    const what = res.query || params.q || (params.cat ? res.facets.categories.find(c => c.value === params.cat)?.label.toLowerCase() : '') || 'items';
    const heard = res.correctedFrom && res.correctedFrom !== said ? `I heard "${res.correctedFrom}" and searched for ${res.query}. ` : '';
    const relaxed = res.relaxed ? `Nothing matched all your words, so these match some of them. ` : '';
    const limits = [params.maxPrice !== undefined ? `under ${money(params.maxPrice)}` : '', params.minPrice !== undefined && params.maxPrice === undefined ? `over ${money(params.minPrice)}` : '',
      params.color ? `in ${params.color.split(',')[0].toLowerCase()}` : '', params.size ? `in size ${sizeSay(params.size.split(',')[0])}` : '', params.deal ? 'on sale' : '', params.inStock ? 'in stock' : ''].filter(Boolean).join(', ');
    const lead = next ? `Here are the next ones.` : `I found ${res.total.toLocaleString('en-US')} ${res.total === 1 ? 'match' : 'matches'} for ${what}${limits ? `, ${limits}` : ''}${sortSay(params.sort)}.`;
    const narrow = res.total > 40 && !next ? ` I can narrow it down by price, colour${res.facets.sizes.length ? ', size' : ''} or brand${params.sort === 'rating' ? '' : ', or sort by rating'}.` : ' Want details on one of them?';
    return { text: `${heard}${relaxed}${lead} ${this.top3(res)}${narrow}`.replace(/\s+/g, ' ').trim(), go: this.go(searchPath(params)) };
  }

  private top3(res: SearchResult): string {
    const items = res.items.slice(0, 3);
    if (!items.length) return '';
    return `${items.length === 1 ? 'The top one is' : `The top ${items.length === 2 ? 'two' : 'three'} are`}: ${items.map((c, i) => `${items.length > 1 ? `${i + 1}, ` : ''}${c.title}, ${priceSay(c)}${c.rating ? `, ${c.rating} stars` : ''}`).join('. ')}.`;
  }

  private async open(n: number): Promise<Reply> {
    const items = this.results!.res.items;
    const i = n === -1 ? items.length - 1 : n - 1;
    const c = items[i];
    if (!c) return { text: `There are only ${items.length} on this page. Which one did you mean?` };
    const p = await this.store.product(c.id);
    if (!p) return { text: "Sorry, I couldn't open that one." };
    this.product = p;
    return { text: this.summary(p), go: this.go(productPath(p)) };
  }

  private summary(p: Product): string {
    const stock = p.variants.some(v => v.stock > 0) ? '' : ' It is out of stock right now.';
    const opts = [p.colors.length > 1 ? `${p.colors.length} colours` : p.colors.length === 1 ? p.colors[0].toLowerCase() : '', p.sizes.length ? `sizes ${p.sizes[0]} to ${p.sizes.at(-1)}` : ''].filter(Boolean).join(' and ');
    const deal = p.list_price ? `, ${p.deal}% off` : '';
    const rating = p.rating ? ` Rated ${p.rating} stars from ${p.review_count} demo reviews.` : ' No reviews yet.';
    const key = p.specs.slice(0, 2).map(s => `${s.name.toLowerCase()} ${s.value}`).join(', ');
    return `${p.title} by ${p.brand}: ${priceSay(p)}${deal}.${rating}${key ? ` ${cap(key)}.` : ''}${opts ? ` It comes in ${opts}.` : ''}${stock} Ask me about the specs or reviews, or say "add it to my cart".`;
  }

  // ---- questions about the product on screen: specs, reviews, Q&A, options, price
  private async aboutProduct(t: string): Promise<Reply | null> {
    const p = this.product!;
    if (REVIEWS.test(t)) return { text: this.reviewSummary(p) };
    if (/\b(what )?(colou?rs?|shades)\b/.test(t) && !colorsIn(t).length) return { text: p.colors.length ? `It comes in ${list(p.colors)}.` : 'It only comes in one colour.' };
    if (/\b(what )?sizes?\b/.test(t) && !sizesIn(t).length) return { text: p.sizes.length ? `Sizes: ${list(p.sizes.map(sizeSay))}.` : "It doesn't come in sizes." };
    const spec = matchSpec(t, p.specs);
    if (spec) return { text: `${spec.name}: ${spec.value}. That's from the product's spec sheet.` };
    if (/\b(price|cost|how much (is|are|does it cost|do they cost|for))\b|^how much$/.test(t)) return { text: `It's ${priceSay(p)}${p.list_price ? `, down from ${money(p.list_price)}` : ''}.` };
    const colors = colorsIn(t), sizes = sizesIn(t);
    if (/\b(in stock|available|have it|any left|sold out)\b/.test(t) || colors.length || sizes.length) {
      const vs = p.variants.filter(v => (!colors.length || colors.includes(v.color ?? '')) && (!sizes.length || sizes.includes(v.size ?? '')));
      if (!vs.length) return { text: `It doesn't come in ${[colors.length ? colors[0].toLowerCase() : '', sizes.length ? `size ${sizeSay(sizes[0])}` : ''].filter(Boolean).join(', ')}. ${p.colors.length ? `Colours: ${list(p.colors)}.` : ''}` };
      const left = vs.reduce((s, v) => s + v.stock, 0);
      return { text: left ? `Yes, ${[colors[0], sizes.length ? `size ${sizeSay(sizes[0])}` : ''].filter(Boolean).join(', ') || 'it'} is in stock${left <= 5 ? `, only ${left} left` : ''}.` : `${[colors[0], sizes.length ? `Size ${sizeSay(sizes[0])}` : ''].filter(Boolean).join(', ') || 'It'} is out of stock right now.` };
    }
    if (/\b(spec(s|ification)?s?|details|features|tell me (more|about it))\b/.test(t))
      return { text: `${p.specs.slice(0, 5).map(s => `${s.name}: ${s.value}`).join('. ')}.` };
    if (/^(what|how|is|does|can|will|are|do)\b/.test(t)) {
      const qs = await this.store.questions(p.id);
      const q = bestQuestion(t, qs);
      if (q) return { text: `Someone asked "${q.question}" The answer was: ${q.answer} (This is demo Q&A.)` };
      return { text: "The listing doesn't say, and I'd rather not guess. You can see everything it lists under Specifications." };
    }
    return null;
  }

  private reviewSummary(p: Product): string {
    if (!p.review_count) return 'It has no reviews yet.';
    const total = p.dist.reduce((s, d) => s + d.count, 0) || p.review_count;
    const good = p.dist.filter(d => d.stars >= 4).reduce((s, d) => s + d.count, 0);
    const low = p.dist.filter(d => d.stars <= 2).reduce((s, d) => s + d.count, 0);
    const top = p.top_reviews.find(r => r.stars >= 4);
    const bad = p.top_reviews.find(r => r.stars <= 2);
    return `${p.rating} stars from ${p.review_count} demo reviews: ${Math.round(good / total * 100)}% gave it 4 or 5 stars${low ? `, ${Math.round(low / total * 100)}% gave 1 or 2` : ''}.${top ? ` The most helpful positive one says "${top.title}".` : ''}${bad ? ` A critical one says "${bad.title}".` : ''} These reviews are fictional, made for this demo.`;
  }

  // ---- compare
  private async compare(t: string): Promise<Reply> {
    if (!this.results) return { text: 'Search for something first, then I can compare the results. What are you looking for?' };
    const items = this.results.res.items;
    const picks = [...t.matchAll(/\b(first|second|third|fourth|fifth|1|2|3|4|5|one|two|three|four|five|last)\b/g)]
      .map(m => ({ first: 1, one: 1, second: 2, two: 2, third: 3, three: 3, fourth: 4, four: 4, fifth: 5, five: 5, last: items.length } as Record<string, number>)[m[1]] ?? Number(m[1]))
      .filter((n, i, a) => n >= 1 && n <= items.length && a.indexOf(n) === i);
    const idx = picks.length >= 2 ? picks.slice(0, 4) : /\b(top|first) (two|2)\b/.test(t) ? [1, 2] : [1, 2, 3].filter(n => n <= items.length);
    if (idx.length < 2) return { text: 'Which ones should I compare? Say for example "compare the first and third".' };
    const ps = (await Promise.all(idx.map(n => this.store.product(items[n - 1].id)))).filter(Boolean) as Product[];
    const cheapest = [...ps].sort((a, b) => a.price - b.price)[0];
    const best = [...ps].filter(p => p.rating).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    const diffs: string[] = [];
    const names = [...new Set(ps.flatMap(p => p.specs.map(s => s.name)))];
    for (const n of names) {
      const vals = ps.map(p => p.specs.find(s => s.name === n)?.value ?? '–');
      if (new Set(vals).size > 1 && diffs.length < 2) diffs.push(`${n}: ${vals.map((v, i) => `${ordWord(idx[i])} ${v}`).join(', ')}`);
    }
    return {
      text: `Comparing ${idx.map(ordWord).join(' and ')}. ${ps.map((p, i) => `${cap(ordWord(idx[i]))}: ${p.title}, ${priceSay(p)}${p.rating ? `, ${p.rating} stars` : ''}`).join('. ')}. The cheapest is the ${ordWord(idx[ps.indexOf(cheapest)])}${best ? `; the best rated is the ${ordWord(idx[ps.indexOf(best)])}` : ''}.${diffs.length ? ` Differences: ${diffs.join('. ')}.` : ''}`,
      go: this.go(`/compare?ids=${ps.map(p => p.id).join(',')}`),
    };
  }

  // ---- cart: everything added is read back first and added only after a yes
  private async add(t: string): Promise<Reply> {
    const n = ordinal(t);
    let p = this.product;
    if (n !== null && this.results) {
      const c = this.results.res.items[n === -1 ? this.results.res.items.length - 1 : n - 1];
      if (c) p = await this.store.product(c.id);
    }
    if (!p) return { text: this.results ? 'Which one should I add? Say for example "add the first one".' : "Let's find something first. What are you looking for?" };
    if (p !== this.product) { this.product = p; }
    const qty = qtyIn(t) ?? 1;
    // what they already chose on the list ("size 10.5", "in green") still holds unless they say otherwise
    const lp = this.results?.params;
    const colors = colorsIn(t).length ? colorsIn(t) : lp?.color ? lp.color.split(',') : [];
    const sizes = sizesIn(t).length ? sizesIn(t) : lp?.size ? lp.size.split(',') : [];
    return this.chooseVariant(p, qty, colors, sizes, productPath(p));
  }

  private async chooseVariant(p: Product, qty: number, colors: string[], sizes: string[], path?: string): Promise<Reply> {
    const go = path && !this.here.startsWith(`/p/${p.id}`) ? this.go(path) : undefined;
    // keep only what this product has; say so when a wish doesn't exist
    const hasC = colors.filter(c => p.variants.some(v => v.color === c));
    const hasS = sizes.filter(z => p.variants.some(v => v.size === z));
    if (colors.length && p.colors.length > 1 && !hasC.length)
      return { text: `It doesn't come in ${colors[0].toLowerCase()}. It comes in ${list(p.colors)}. Which colour?`, go, ...this.offer({ kind: 'variant', product: p, qty, need: 'color', options: p.colors, size: hasS[0] }) };
    if (sizes.length && p.sizes.length > 1 && !hasS.length)
      return { text: `It doesn't come in ${sizeSay(sizes[0])}. Sizes: ${sizeList(p.sizes)}. Which size?`, go, ...this.offer({ kind: 'variant', product: p, qty, need: 'size', options: p.sizes, color: hasC[0] }) };
    colors = hasC; sizes = hasS;
    const fit = p.variants.filter(v => (!colors.length || colors.includes(v.color ?? '')) && (!sizes.length || sizes.includes(v.size ?? '')));
    const colorSet = [...new Set(fit.map(v => v.color).filter(Boolean))] as string[];
    const sizeSet = [...new Set(fit.map(v => v.size).filter(Boolean))] as string[];
    if (colorSet.length > 1) {
      const inStock = colorSet.filter(c => fit.some(v => v.color === c && v.stock > 0));
      const options = inStock.length ? inStock : colorSet;
      return { text: `Which colour would you like? ${options.length < colorSet.length ? 'In stock: ' : 'It comes in '}${list(options)}.`, go, ...this.offer({ kind: 'variant', product: p, qty, need: 'color', options, size: sizes[0] }) };
    }
    if (sizeSet.length > 1) {
      const inStock = sizeSet.filter(s => fit.some(v => v.size === s && v.stock > 0));
      const options = inStock.length ? inStock : sizeSet;
      return { text: `Which size? ${options.length < sizeSet.length ? 'In stock: ' : ''}${sizeList(options)}.`, go, ...this.offer({ kind: 'variant', product: p, qty, need: 'size', options, color: colorSet[0] }) };
    }
    const v = fit[0];
    if (!v) return { text: "That option isn't available.", go };
    if (v.stock <= 0) return { text: `Sorry, ${variantSay(v) || 'that one'} is out of stock. ${p.colors.length > 1 ? `Other colours: ${list(p.colors.filter(c => c !== v.color))}.` : ''}`.trim(), go };
    if (qty > v.stock) return { text: `There are only ${v.stock} left${variantSay(v) ? ` in ${variantSay(v)}` : ''}. How many would you like?`, go, ...this.offer({ kind: 'add', product: p, variant: v, qty: v.stock }) };
    this.pending = { kind: 'add', product: p, variant: v, qty };
    return { text: this.readBack(p, v, qty), go };
  }

  private readBack(p: Product, v: Variant, qty: number) {
    return `To confirm: add ${qty} ${p.title}${variantSay(v) ? `, ${variantSay(v)}` : ''}, at ${money(v.price)}${qty > 1 ? ` each, ${money(v.price * qty)} in total` : ''}, to your cart? Say yes or no.`;
  }

  private async answerAdd(t: string, p: Extract<Pending, { kind: 'add' }>): Promise<Reply | null> {
    if (YES.test(t) && !/\b(but|except|actually|instead|change|make it)\b/.test(t)) {
      this.pending = null;
      const r = await this.store.addToCart(p.variant.sku, p.qty);
      if (!r.ok) return { text: `I couldn't add it: ${r.error ?? 'the store said no'}`, cartChanged: true };
      const c = r.cart;
      const free = c && c.freeShippingAt && c.subtotal < c.freeShippingAt ? ` Add ${money(c.freeShippingAt - c.subtotal)} more for free standard shipping.` : c && c.freeShippingAt ? ' Standard shipping is free on this order.' : '';
      return { text: `Added. Your cart has ${c?.count ?? p.qty} ${c?.count === 1 ? 'item' : 'items'}, ${money(c?.subtotal ?? p.variant.price * p.qty)} so far.${free} Keep shopping, or say "check out".`, cartChanged: true };
    }
    const qty = /\b(make it|change (it|that) to|actually|instead|i want|i'd like|how about|just)\b/.test(t) || /^\d+$/.test(t) ? qtyIn(t) : null;
    const colors = colorsIn(t), sizes = sizesIn(t);
    if (qty || colors.length || sizes.length) {
      this.pending = null;
      return this.chooseVariant(p.product, qty ?? p.qty, colors.length ? colors : p.variant.color ? [p.variant.color] : [], sizes.length ? sizes : p.variant.size ? [p.variant.size] : []);
    }
    if (NO.test(t)) { this.pending = null; return { text: "Okay, I haven't added it. What would you like to do?" }; }
    if (/^(what|huh|sorry|pardon|repeat|say (that|it) again)\b/.test(t)) return { text: this.readBack(p.product, p.variant, p.qty) };
    this.pending = null;
    return null; // something else entirely: answer that instead; nothing was added
  }

  private async answerVariant(t: string, p: Extract<Pending, { kind: 'variant' }>): Promise<Reply | null> {
    if (NO.test(t)) { this.pending = null; return { text: "Okay, I won't add it. What next?" }; }
    const colors = colorsIn(t), sizes = sizesIn(t);
    const n = ordinal(t);
    let c = colors, s = sizes;
    if (!colors.length && !sizes.length && n !== null) {
      const o = p.options[n === -1 ? p.options.length - 1 : n - 1];
      if (o && p.need === 'color') c = [o]; else if (o) s = [o];
    }
    if (p.need === 'size' && !sizes.length) {
      const raw = /^(?:size )?(\d{1,2}(?:\.5)?|xs|s|m|l|xl|xxl)$/.exec(t.replace(/ and a half$/, '.5'));
      if (raw) s = [raw[1].toUpperCase()];
    }
    if (!c.length && !s.length) { this.pending = null; return null; }
    this.pending = null;
    const qty = qtyIn(t) ?? p.qty;
    const r = await this.chooseVariant(p.product, qty, c.length ? c : p.color ? [p.color] : [], s.length ? s : p.size ? [p.size] : []);
    // a size given while the colour was asked (or the other way round) is kept, and said so
    if (this.pending?.kind === 'variant' && this.pending.need === p.need && (p.need === 'color' ? s.length : c.length))
      r.text = `Got it, ${p.need === 'color' ? `size ${sizeSay(s[0])}` : c[0].toLowerCase()}. ${r.text}`;
    return r;
  }

  private async answerClarify(t: string, p: Extract<Pending, { kind: 'clarify' }>): Promise<Reply | null> {
    if (p.about === 'loosen') {
      this.pending = null;
      if (YES.test(t)) return this.show(p.params, await this.store.search(p.params));
      if (NO.test(t)) return { text: 'Okay. What would you like instead?' };
      return null;
    }
    const n = ordinal(t);
    let pick = n !== null ? p.options[n === -1 ? p.options.length - 1 : n - 1] : undefined;
    if (!pick) {
      const words = t.split(' ').filter(w => w.length > 2 && !STOP.has(w));
      pick = p.options.find(o => words.some(w => o.label.toLowerCase().includes(w.replace(/s$/, ''))));
    }
    if (pick) {
      this.pending = null;
      const params: Params = { ...p.params, cat: pick.value, page: undefined };
      return this.show(params, await this.store.search(params));
    }
    // a new detail (budget, another interest, a kind of product): search again with it added
    const more = await this.find(t, { maxPrice: p.params.maxPrice, minPrice: p.params.minPrice, audience: p.params.audience, ...(productWords(t, parseBudget(t)) ? {} : { tags: p.params.tags }) });
    return more;
  }

  private async answerGift(t: string, p: Extract<Pending, { kind: 'gift' }>): Promise<Reply | null> {
    if (NO.test(t) && t.split(' ').length < 3) { this.pending = null; return { text: 'No problem. What would you like to look for?' }; }
    const budget = parseBudget(t) ?? p.budget;
    const who = p.audience?.who ? p.audience : audienceIn(t) ?? p.audience; // "your mom" stays "your mom" when she's later "she"
    const likes = [...new Set([...p.interests, ...interestsIn(`likes ${t}`)])];
    const words = productWords(t, parseBudget(t));
    this.pending = null;
    if (!likes.length && !words) {
      if (who && !p.audience) { this.pending = { kind: 'gift', budget, audience: who, interests: [] }; return { text: `What does ${who.who || 'they'} enjoy? For example hiking, cooking, reading or gaming.` }; }
      if (budget && !p.budget) { this.pending = { kind: 'gift', budget, audience: who, interests: [] }; return { text: 'Got it. And what do they enjoy?' }; }
      return null;
    }
    return this.giftSearch(budget, who, likes, words);
  }

  private async readCart(): Promise<Reply> {
    const c = await this.store.cart();
    if (!c.lines.length) return { text: 'Your cart is empty. What are you looking for?', go: this.go('/cart') };
    const lines = c.lines.slice(0, 4).map(l => `${l.qty} ${l.title}${variantSay(l) ? `, ${variantSay(l)}` : ''}, ${money(l.line_total)}`);
    const std = c.shipping.find(s => s.id === 'standard');
    return { text: `You have ${c.count} ${c.count === 1 ? 'item' : 'items'}: ${lines.join('. ')}${c.lines.length > 4 ? `, and ${c.lines.length - 4} more` : ''}. Subtotal ${money(c.subtotal)}.${std ? std.cost === 0 ? ' Standard shipping is free.' : ` Standard shipping is ${money(std.cost)}.` : ''} Say "check out" when you're ready.`, go: this.go('/cart') };
  }

  private async checkout(): Promise<Reply> {
    const c = await this.store.cart();
    if (!c.lines.length) return { text: "Your cart is empty, so there's nothing to check out yet. What are you looking for?" };
    this.pending = null;
    return { text: `Okay, let's check out your ${c.count} ${c.count === 1 ? 'item' : 'items'}, ${money(c.subtotal)} before shipping and tax.`, go: this.go('/checkout'), checkout: true };
  }

  // ---- help centre: quoted with a citation, or not answered
  private async help(said: string): Promise<Reply> {
    const a = await this.store.help(said);
    if (!a.found || !a.cite || !a.quote?.length) return { text: "I couldn't find that in our help centre, so I won't guess. The Help page lists every topic.", links: [{ text: 'Help page', href: '/help' }] };
    const label = `${a.cite.title}${a.cite.section ? `: ${a.cite.section}` : ''}`;
    return { text: `Our help centre says: ${a.quote.join(' ')} That's from "${label}".`, links: [{ text: label, href: a.cite.href }] };
  }
}

// ---- small helpers
function matchSpec(t: string, specs: { name: string; value: string }[]) {
  const ALIAS: Record<string, string[]> = { weight: ['heavy', 'weigh', 'weighs', 'light', 'lightweight'], 'water resistance': ['waterproof', 'water', 'rain', 'wet'],
    material: ['made of', 'made from', 'fabric', 'material'], capacity: ['hold', 'holds', 'big', 'capacity', 'litre', 'liter', 'volume'], battery: ['battery', 'charge', 'last'],
    'battery life': ['battery', 'charge', 'last', 'hours'], dimensions: ['dimensions', 'big', 'size', 'wide', 'tall', 'long'], warranty: ['warranty', 'guarantee'],
    'laptop sleeve': ['laptop'], 'hip belt': ['hip belt', 'waist'], 'hydration compatible': ['hydration', 'bladder', 'reservoir'], connectivity: ['bluetooth', 'wireless', 'connect'] };
  let best: { s: { name: string; value: string }; score: number } | null = null;
  for (const s of specs) {
    const n = s.name.toLowerCase();
    let score = new RegExp(`\\b${n}\\b`).test(t) ? 3 : n.split(/\s+/).filter(w => w.length > 3 && t.includes(w)).length;
    for (const a of ALIAS[n] ?? []) if (new RegExp(`\\b${a}\\b`).test(t)) score += 2;
    if (score && (!best || score > best.score)) best = { s, score };
  }
  return best?.s ?? null;
}
function bestQuestion(t: string, qs: { question: string; answer: string }[]) {
  const words = new Set(t.split(' ').filter(w => w.length > 3 && !STOP.has(w)));
  let best: { q: { question: string; answer: string }; n: number } | null = null;
  for (const q of qs) {
    const n = q.question.toLowerCase().split(/[^a-z0-9]+/).filter(w => words.has(w)).length;
    if (n >= 2 && (!best || n > best.n)) best = { q, n };
  }
  return best?.q ?? null;
}
function qtyIn(t: string): number | null {
  const m = /\b(\d{1,2})\b(?! (dollars?|bucks|in\b|inch|stars?))/.exec(t.replace(/\bsize \d+(\.5)?\b/, ''));
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 10) return Number(m[1]);
  if (/\b(a pair|a couple)\b/.test(t)) return 2;
  return null;
}
// a long run of sizes is said as a range: "6 to 13"
const sizeList = (xs: string[]) => (xs.length > 6 ? `${sizeSay(xs[0])} to ${sizeSay(xs.at(-1)!)}` : list(xs.map(sizeSay)));
// who a product is for: a man's or woman's item, or a unisex one; for a gift idea, household things too
const audienceParam = (a: string, gift: boolean) => (a === 'men' || a === 'women' ? `${a},unisex${gift ? ',home' : ''}` : a);
const variantSay = (v: { color: string | null; size: string | null }) => [v.color, v.size ? `size ${sizeSay(v.size)}` : ''].filter(Boolean).join(', ');
const priceSay = (c: { price: number; max_price?: number }) => (c.max_price && c.max_price > c.price ? `from ${money(c.price)}` : money(c.price));
const sortSay = (s?: string) => ({ price_asc: ', cheapest first', price_desc: ', most expensive first', rating: ', best rated first', reviews: ', most reviewed first', newest: ', newest first', discount: ', biggest discounts first', popular: ', most popular first' } as Record<string, string>)[s ?? ''] ?? '';
const ordWord = (n: number) => ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'][n] ?? `number ${n}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
function describe(p: Params, who: { who: string } | null, likes: string[]) {
  return [`for ${who?.who || 'them'}`.replace(/^for them$/, likes.length ? 'for someone' : 'gift ideas'), likes.length ? `who likes ${list(likes)}` : '',
    p.maxPrice !== undefined ? `under ${money(p.maxPrice)}` : ''].filter(Boolean).join(' ');
}
