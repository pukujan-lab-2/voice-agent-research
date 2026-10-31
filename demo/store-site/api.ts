// Brambleway's backend: the store API and the copilot's server side. Every read and write goes to Octo (the
// workspace's own Postgres through POST /workspaces/<id>/query, and Octo files for the product images); there is no
// local copy of the catalogue and no fallback store. A few reads are cached in memory for a minute or so.
//
// Store (GET unless noted; the shopper is the X-Shopper header, a random id the app keeps in the browser):
//   /api/shop/departments  /api/shop/home  /api/shop/search?q&cat&dept&brand&color&size&tags&audience&minPrice&maxPrice
//   &rating&inStock&deal&sort&page&per  /api/shop/suggest?q  /api/shop/product/:id  /api/shop/product/:id/reviews?page&sort&stars
//   /api/shop/product/:id/questions?page  /api/shop/compare?ids  /api/shop/cart (GET, POST {sku, qty, mode}, DELETE ?sku)
//   /api/shop/wishlist (GET, POST {productId}, DELETE ?productId)  /api/shop/shipping  /api/shop/orders (GET, POST: place a
//   demo order; only the shopper's own click on Place order calls it)  /api/shop/orders/:id  /api/shop/orders/:id/cancel (POST)
//   /api/shop/returns (GET, POST)  /api/shop/help  /api/shop/help/:slug  /api/shop/help-search?q  /api/shop/account
//   /img/<key>.svg (a product image, from Octo files)
// Copilot (POST): /api/help/answer (a help-centre passage chosen by Jev, with its citation), /api/understand (Jev's
//   on-topic gate for a checkout answer), /api/warm, /api/log.
import { JevJudge, OverlapJudge, type Passage } from '../../copilot-engine/src/guide.ts';
import { JevGate, LlamaModel, RuleModel } from '../../copilot-engine/src/models.ts';
import { buildVocab, correctQuery, type Vocab } from '../../copilot-engine/src/shop-text.ts';
import type { Field, FieldKind, Flow, Model } from '../../copilot-engine/src/types.ts';

export type ApiEnv = { OPENROUTER_JEV_KEY?: string; OCTO_KEY?: string; OCTO_WORKSPACE?: string; OCTO_BASE?: string; JEV_URL?: string; LLAMA_URL?: string;
  RATE_PER_MIN?: string; JEV_DAILY_CAP?: string };

const json = (body: unknown, status = 200, cache = 0) => new Response(JSON.stringify(body), { status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': cache ? `public, max-age=${cache}` : 'no-store' } });
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : '');
const log = (msg: string) => console.error(`${new Date().toISOString()} ${msg.replace(/\s+/g, ' ')}`);
const KINDS: FieldKind[] = ['text', 'name', 'serial', 'choice', 'email', 'phone', 'code'];
const SORTS: Record<string, string> = {
  relevance: 'in_stock desc, rank desc, popularity desc', popular: 'in_stock desc, popularity desc', price_asc: 'price asc, popularity desc', price_desc: 'price desc, popularity desc',
  rating: 'rating desc nulls last, review_count desc', reviews: 'review_count desc, rating desc nulls last', newest: 'created desc, popularity desc',
  discount: '(coalesce(list_price, price) - price) / coalesce(list_price, price) desc, popularity desc',
};
const PRICE_BUCKETS: [string, number, number | null][] = [['Under $25', 0, 25], ['$25 to $50', 25, 50], ['$50 to $100', 50, 100], ['$100 to $200', 100, 200],
  ['$200 to $500', 200, 500], ['$500 and up', 500, null]];
const CARD = `id, slug, title, brand, price::float, max_price::float, list_price::float, deal_ends, rating::float, review_count, question_count, image, in_stock,
  colors, sizes, category, cat_slug, dept, dept_slug, kind, popularity`;
const MAX_QTY = 10;
const TAX = 0.08;
// The demo's clock for order tracking: one business day passes every two minutes, so a demo order moves from
// Placed to Delivered while you watch (help article "Tracking your order" has the statuses).
const DAY_MS = 120_000;

type Ship = { id: string; label: string; days: string; min_days: number; max_days: number; price: number; free_over: number | null };
const FREIGHT: Ship = { id: 'freight', label: 'Freight delivery', days: '5–10 business days, carrier calls to book', min_days: 5, max_days: 10, price: 49, free_over: 499 };

export function createApi(env: ApiEnv) {
  if (!(env.OCTO_KEY && env.OCTO_WORKSPACE)) throw new Error('missing OCTO_KEY or OCTO_WORKSPACE: the store reads everything from Octo');
  const base = env.OCTO_BASE || 'https://octodb.design-bakery.com/api';
  const octo = async (path: string, body?: unknown) => {
    const r = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${env.OCTO_KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'brambleway-demo/0.1' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`octo ${path.split('?')[0]} ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r;
  };
  const sql = async (text: string, params: unknown[] = []): Promise<any[]> =>
    (await (await octo(`/workspaces/${env.OCTO_WORKSPACE}/query`, { sql: text, ...(params.length ? { params } : {}) })).json()).rows ?? [];

  const cache = new Map<string, { at: number; v: any }>();
  const cached = async <T>(key: string, ms: number, get: () => Promise<T>): Promise<T> => {
    const c = cache.get(key);
    if (c && Date.now() - c.at < ms) return c.v;
    const v = await get();
    cache.set(key, { at: Date.now(), v });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return v;
  };
  const card = (r: any) => ({ ...r, image: `/img/${r.image}.svg`, deal: r.list_price ? Math.round((1 - r.price / r.list_price) * 100) : 0 });

  // The words the catalogue uses, from Octo, for correcting misheard and misspelled searches. Built on first search,
  // refreshed hourly.
  let vocab: Promise<Vocab> | null = null;
  let vocabAt = 0;
  const getVocab = () => {
    if (!vocab || Date.now() - vocabAt > 3_600_000) {
      vocabAt = Date.now();
      // one row: Octo returns at most 1000 rows per query
      vocab = sql(`select json_object_agg(w, n) as m from (select w, count(*)::int n from shop_products, regexp_split_to_table(lower(title || ' ' || category || ' ' || noun
        || ' ' || dept || ' ' || search_extra), '[^a-z0-9-]+') w where length(w) >= 2 group by w) x`).then(rows => buildVocab(new Map(Object.entries(rows[0].m as Record<string, number>))));
      vocab.catch(() => { vocab = null; });
    }
    return vocab;
  };

  // ---- search: one round trip for the page of results and every facet
  type Filters = { q: string; cat: string[]; dept: string; brand: string[]; color: string[]; size: string[]; tags: string[]; audience: string[]; ids: string[];
    minPrice?: number; maxPrice?: number; rating?: number; inStock: boolean; deal: boolean; sort: string; page: number; per: number };
  const list = (s: string | null) => (s ?? '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 20);
  const num = (s: string | null) => (s !== null && s !== '' && Number.isFinite(Number(s)) ? Number(s) : undefined);
  const filtersOf = (u: URLSearchParams): Filters => ({
    q: clip(u.get('q'), 200).trim(), cat: list(u.get('cat')), dept: clip(u.get('dept'), 60), brand: list(u.get('brand')), color: list(u.get('color')),
    size: list(u.get('size')), tags: list(u.get('tags')), audience: list(u.get('audience')), ids: list(u.get('ids')),
    minPrice: num(u.get('minPrice')), maxPrice: num(u.get('maxPrice')), rating: num(u.get('rating')),
    inStock: u.get('inStock') === '1', deal: u.get('deal') === '1', sort: SORTS[u.get('sort') ?? ''] ? u.get('sort')! : '',
    page: Math.max(1, Math.min(400, Math.floor(num(u.get('page')) ?? 1))), per: Math.max(1, Math.min(60, Math.floor(num(u.get('per')) ?? 24))),
  });

  async function search(f: Filters, mode: 'and' | 'or' = 'and') {
    const params: unknown[] = [];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    const where: string[] = [];
    let rank = '0';
    if (f.q) {
      const words = f.q.toLowerCase().match(/[a-z0-9]+/g) ?? [];
      const tsq = mode === 'and' ? `websearch_to_tsquery('english', ${p(f.q)})` : `to_tsquery('english', ${p(words.join(' | ') || 'x')})`;
      where.push(`tsv @@ ${tsq}`);
      rank = `ts_rank_cd(tsv, ${tsq}) * (1 + ln(1 + popularity) / 10)`;
    }
    if (f.cat.length) where.push(`cat_slug = any(${p(f.cat)}::text[])`);
    if (f.dept) where.push(`dept_slug = ${p(f.dept)}`);
    if (f.brand.length) where.push(`brand = any(${p(f.brand)}::text[])`);
    if (f.color.length) where.push(`colors && ${p(f.color)}::text[]`);
    if (f.size.length) where.push(`sizes && ${p(f.size)}::text[]`);
    if (f.tags.length) where.push(`tags @> ${p(f.tags)}::text[]`);
    if (f.audience.length) where.push(`audience = any(${p(f.audience)}::text[])`);
    if (f.ids.length) where.push(`id = any(${p(f.ids)}::text[])`);
    if (f.minPrice !== undefined) where.push(`price >= ${p(f.minPrice)}`);
    if (f.maxPrice !== undefined) where.push(`price <= ${p(f.maxPrice)}`);
    if (f.rating !== undefined) where.push(`rating >= ${p(f.rating)}`);
    if (f.inStock) where.push('in_stock');
    if (f.deal) where.push('list_price is not null');
    const order = SORTS[f.sort || (f.q ? 'relevance' : 'popular')];
    const r = (await sql(`with m as (select ${CARD}, ${rank} as rank from shop_products ${where.length ? `where ${where.join(' and ')}` : ''})
      select (select count(*)::int from m) as total,
        (select coalesce(json_agg(x), '[]') from (select * from m order by ${order} limit ${f.per} offset ${(f.page - 1) * f.per}) x) as items,
        (select coalesce(json_agg(x), '[]') from (select dept as label, dept_slug as value, count(*)::int as count from m group by 1, 2 order by 3 desc) x) as depts,
        (select coalesce(json_agg(x), '[]') from (select category as label, cat_slug as value, min(dept) as dept, count(*)::int as count from m group by 1, 2 order by 4 desc limit 30) x) as categories,
        (select coalesce(json_agg(x), '[]') from (select brand as label, brand as value, count(*)::int as count from m group by 1 order by 3 desc limit 25) x) as brands,
        (select coalesce(json_agg(x), '[]') from (select c as label, c as value, count(*)::int as count from m, unnest(colors) c group by 1 order by 3 desc) x) as colors,
        (select coalesce(json_agg(x), '[]') from (select s as label, s as value, count(*)::int as count from m, unnest(sizes) s group by 1 order by 3 desc limit 40) x) as sizes,
        (select coalesce(json_agg(x), '[]') from (select r as value, count(*)::int as count from m, (values (4), (3), (2)) v(r) where rating >= r group by 1 order by 1 desc) x) as ratings,
        (select json_build_object(${PRICE_BUCKETS.map(([l, lo, hi], i) => `'${i}', count(*) filter (where price >= ${lo}${hi ? ` and price < ${hi}` : ''})`).join(', ')}) from m) as prices,
        (select count(*)::int from m where list_price is not null) as deals,
        (select count(*)::int from m where in_stock) as in_stock,
        (select min(price)::float from m) as min_price, (select max(price)::float from m) as max_price`, params))[0];
    return {
      total: r.total, page: f.page, per: f.per, pages: Math.ceil(r.total / f.per), items: r.items.map(card),
      facets: { depts: r.depts, categories: r.categories, brands: r.brands, colors: r.colors, sizes: sortSizes(r.sizes),
        ratings: r.ratings.map((x: any) => ({ label: `${x.value} stars & up`, value: String(x.value), count: x.count })),
        prices: PRICE_BUCKETS.map(([label, lo, hi], i) => ({ label, min: lo, max: hi, count: r.prices[String(i)] })).filter(x => x.count),
        deals: r.deals, inStock: r.in_stock, priceRange: [r.min_price, r.max_price] },
    };
  }

  async function searchRoute(u: URLSearchParams) {
    const f = filtersOf(u);
    const key = `s:${u.toString()}`;
    return cached(key, 60_000, async () => {
      let res = await search(f);
      let query = f.q, correctedFrom: string | null = null, relaxed = false;
      if (f.q && u.get('exact') !== '1') {
        const fix = correctQuery(f.q, await getVocab());
        if (fix.changed.length && fix.text !== f.q.toLowerCase()) {
          const alt = await search({ ...f, q: fix.text });
          if (alt.total > res.total || res.total === 0) { res = alt; correctedFrom = f.q; query = fix.text; }
        }
      }
      if (query && res.total === 0 && (query.match(/[a-z0-9]+/gi)?.length ?? 0) > 1) {
        res = await search({ ...f, q: query }, 'or');
        relaxed = res.total > 0;
      }
      return { ...res, query, correctedFrom, relaxed };
    });
  }

  // ---- product
  async function product(id: string) {
    return cached(`p:${id}`, 60_000, async () => {
      const r = (await sql(`select p.id, p.slug, p.title, p.brand, p.dept, p.dept_slug, p.category, p.cat_slug, p.kind, p.noun, p.audience, p.tags, p.price::float,
          p.max_price::float, p.list_price::float, p.deal_ends, p.rating::float, p.review_count, p.question_count, p.in_stock, p.colors, p.sizes, p.description,
          p.bullets, p.specs, p.image, p.popularity, p.created,
          (select coalesce(json_agg(v order by v.sku), '[]') from (select sku, color, size, price::float, stock from shop_variants where product_id = p.id) v) as variants,
          (select coalesce(json_agg(x), '[]') from (select stars, count(*)::int n from shop_reviews where product_id = p.id group by 1) x) as dist,
          (select coalesce(json_agg(x), '[]') from (select id, stars, title, body, author, location, date, helpful, variant from shop_reviews where product_id = p.id order by helpful desc, id limit 4) x) as top_reviews,
          (select coalesce(json_agg(x), '[]') from (select id, question, answer, answered_by, votes, date from shop_questions where product_id = p.id order by votes desc, id limit 4) x) as top_questions,
          (select coalesce(json_agg(x), '[]') from (select ${CARD} from shop_products r where r.cat_slug = p.cat_slug and r.id <> p.id order by abs(r.price - p.price) / greatest(p.price, 1) + 1.0 / (1 + r.popularity), r.id limit 10) x) as related
        from shop_products p where p.id = $1`, [id]))[0];
      if (!r) return null;
      const dist = [5, 4, 3, 2, 1].map(s => ({ stars: s, count: r.dist.find((d: any) => d.stars === s)?.n ?? 0 }));
      return { ...card(r), dist, variants: r.variants.map((v: any) => ({ ...v, image: `/img/${r.image.replace(/-[a-z-]+$/, '')}-${slug(v.color ?? '')}.svg` })),
        related: r.related.map(card), dist_total: r.review_count, demoNote: 'Fictional product. Reviews and answers are generated for this demo.' };
    });
  }

  // ---- cart and wishlist (the shopper's id is a random string the app keeps in the browser)
  async function cart(shopper: string) {
    const lines = await sql(`select c.sku, c.qty, v.color, v.size, v.price::float, v.stock, p.id as product_id, p.slug, p.title, p.brand, p.image, p.kind, p.category, p.list_price::float
      from shop_carts c join shop_variants v using (sku) join shop_products p on p.id = v.product_id where c.shopper = $1 order by c.added_at, c.sku`, [shopper]);
    const out = lines.map(l => ({ ...l, image: `/img/${l.image.replace(/-[a-z-]+$/, '')}-${slug(l.color ?? '')}.svg`, line_total: round2(l.price * l.qty) }));
    const subtotal = round2(out.reduce((s, l) => s + l.line_total, 0));
    return { lines: out, count: out.reduce((s, l) => s + l.qty, 0), subtotal };
  }
  const isFreight = (l: { kind: string; category: string; size?: string | null }) =>
    l.kind === 'furniture' || l.category === 'Cardio Machines' || /^(55|65) in$/.test(l.size ?? '');
  async function shippingFor(c: Awaited<ReturnType<typeof cart>>) {
    const opts: Ship[] = await cached('ship', 300_000, async () => (await sql(`select value from shop_help_facts where key = 'shipping'`))[0].value);
    const freight = c.lines.some(isFreight);
    const list = freight ? [FREIGHT] : opts;
    return list.map(o => ({ ...o, cost: o.free_over !== null && c.subtotal >= o.free_over ? 0 : o.price,
      note: o.free_over !== null ? `Free on orders of ${o.id === 'freight' ? 'over' : ''} $${o.free_over}${o.id === 'freight' ? '' : ' or more'}`.replace('  ', ' ') : '' }));
  }

  // ---- orders: placed only by the shopper's own click (the copilot never calls this)
  const STEPS = ['Placed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered'];
  function tracking(o: any) {
    const t0 = new Date(o.created_at).getTime();
    const days = o.shipping.min_days ?? 4;
    const at = [0, DAY_MS / 2, DAY_MS, DAY_MS * (days + 0.5), DAY_MS * (days + 1)];
    const now = Date.now();
    const cancelled = o.status === 'Cancelled';
    const reached = cancelled ? 0 : at.filter(x => now - t0 >= x).length - 1;
    return {
      status: cancelled ? 'Cancelled' : STEPS[reached],
      steps: STEPS.map((s, i) => ({ status: s, at: new Date(t0 + at[i]).toISOString(), done: !cancelled && i <= reached })),
      estimate: new Date(t0 + at[4]).toISOString(),
      carrier: 'Bramble Post (demo)', trackingNumber: `BP${o.id.replace(/\D/g, '').slice(-10)}`,
      canCancel: !cancelled && reached === 0, canReturn: !cancelled && reached === 4,
    };
  }
  const orderOut = (o: any) => ({ ...o, subtotal: Number(o.subtotal), shipping_cost: Number(o.shipping_cost), tax: Number(o.tax), total: Number(o.total), ...tracking(o) });

  async function placeOrder(shopper: string, b: any) {
    const a = b?.address ?? {};
    const address = { name: clip(a.name, 80).trim(), line1: clip(a.line1, 120).trim(), line2: clip(a.line2, 120).trim(), city: clip(a.city, 60).trim(),
      state: clip(a.state, 40).trim(), zip: clip(a.zip, 12).trim(), country: clip(a.country, 40).trim() || 'United States', phone: clip(a.phone, 30).trim(), email: clip(a.email, 120).trim() };
    const missing = (['name', 'line1', 'city', 'state', 'zip', 'email'] as const).filter(k => !address[k]);
    if (missing.length) return json({ error: `missing ${missing.join(', ')}` }, 400);
    if (!/^(\d{5}(-\d{4})?|[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d)$/.test(address.zip)) return json({ error: 'ZIP or postal code looks wrong' }, 400);
    const c = await cart(shopper);
    if (!c.lines.length) return json({ error: 'your cart is empty' }, 400);
    const short = c.lines.find(l => l.qty > l.stock);
    if (short) return json({ error: `only ${short.stock} left of ${short.title}` }, 409);
    const ship = (await shippingFor(c)).find(o => o.id === clip(b?.shipping, 20));
    if (!ship) return json({ error: 'choose a shipping option' }, 400);
    const gift = b?.giftWrap === true;
    const giftCost = gift ? round2(4.99 * c.count) : 0;
    const tax = round2(c.subtotal * TAX);
    const total = round2(c.subtotal + ship.cost + tax + giftCost);
    const id = `BW-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const lines = c.lines.map(l => ({ sku: l.sku, product_id: l.product_id, title: l.title, color: l.color, size: l.size, price: l.price, qty: l.qty, image: l.image }));
    // one statement: the order, the stock it takes, and the emptied cart
    const r = await sql(`with o as (insert into shop_orders (id, shopper, status, address, shipping, lines, subtotal, shipping_cost, tax, total, events)
        values ($1, $2, 'Placed', $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10::jsonb) returning *),
      s as (update shop_variants v set stock = greatest(0, v.stock - x.qty) from jsonb_to_recordset($5::jsonb) as x(sku text, qty int) where v.sku = x.sku returning v.sku),
      d as (delete from shop_carts where shopper = $2 returning sku)
      select o.*, (select count(*) from s) as stock_updates, (select count(*) from d) as cleared from o`,
      [id, shopper, JSON.stringify(address), JSON.stringify({ ...ship, giftWrap: gift, giftCost }), JSON.stringify(lines), c.subtotal, ship.cost, tax, total,
        JSON.stringify([{ status: 'Placed', at: new Date().toISOString() }])]);
    cache.clear();
    return json(orderOut(r[0]), 201);
  }

  // ---- help centre (Octo: shop_help, shop_help_passages)
  const HELP_SYN: Record<string, string> = { send: 'return', back: 'return', refund: 'refund', money: 'refund', arrive: 'delivery', deliver: 'delivery', ship: 'shipping',
    shipping: 'shipping', postage: 'shipping', fast: 'expedited', quick: 'expedited', tomorrow: 'next', overnight: 'next', swap: 'exchange', size: 'exchange',
    broken: 'damaged', faulty: 'defective', where: 'tracking', track: 'tracking', cancel: 'cancel', change: 'change', pay: 'payment', card: 'payment',
    tax: 'tax', wrap: 'gift', coupon: 'promo', code: 'promo', discount: 'deals', warranty: 'guarantee', guarantee: 'guarantee', canada: 'canada', international: 'deliver' };
  async function helpCandidates(q: string, k = 6) {
    const words = (q.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(w => !['the', 'and', 'can', 'how', 'what', 'does', 'for', 'you', 'your', 'with', 'this', 'that', 'will', 'are', 'there', 'when', 'long'].includes(w));
    const terms = [...new Set([...words, ...words.map(w => HELP_SYN[w]).filter(Boolean)])].slice(0, 16);
    if (!terms.length) return [];
    return sql(`select p.id, p.slug, p.anchor, p.heading, p.text, h.title, ts_rank_cd(p.tsv, to_tsquery('english', $1)) as r
      from shop_help_passages p join shop_help h using (slug) where p.tsv @@ to_tsquery('english', $1) order by r desc limit ${k}`, [terms.join(' | ')]);
  }

  // ---- copilot server side
  const jevKey = env.OPENROUTER_JEV_KEY;
  const inner: Model = env.LLAMA_URL ? new LlamaModel(env.LLAMA_URL, 'lfm') : new RuleModel();
  const gate = jevKey ? new JevGate(inner, { key: jevKey, url: env.JEV_URL }) : null;
  const jev = jevKey ? new JevJudge({ key: jevKey, url: env.JEV_URL }) : null;
  const overlap = new OverlapJudge();
  let jevDay = '', jevCount = 0;
  const jevAllowed = () => {
    const d = new Date().toISOString().slice(0, 10);
    if (d !== jevDay) { jevDay = d; jevCount = 0; }
    return ++jevCount <= (Number(env.JEV_DAILY_CAP) || 5000);
  };
  let warming: Promise<void> | null = null;

  async function helpAnswer(question: string) {
    const cands = await helpCandidates(question, 6);
    if (!cands.length) return { found: false };
    const ps: Passage[] = cands.map(c => ({ id: c.id, text: c.text }));
    let id = jev && jevAllowed() ? await jev.pick(question, ps) : '';
    if (jev?.lastError || !jev) id = await overlap.pick(question, ps);
    const hit = cands.find(c => c.id === id);
    if (!hit) return { found: false, near: cands.slice(0, 2).map(c => ({ title: c.title, href: `/help/${c.slug}#${c.anchor}` })) };
    const sents = hit.text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/);
    // a short passage is quoted whole (a price or a condition can sit in any sentence); a long one, Jev's sentences
    let idx = sents.length > 3 && jev && !jev.lastError && jevAllowed() ? await jev.sentences(question, sents) : [];
    if (!idx.length) idx = sents.map((_: string, i: number) => i).slice(0, 3);
    const section = String(hit.heading).split(': ').slice(1).join(': ');
    return { found: true, quote: idx.sort((a, b) => a - b).map(i => sents[i]), passage: hit.text,
      cite: { title: hit.title, section, slug: hit.slug, anchor: hit.anchor, href: `/help/${hit.slug}#${hit.anchor}` } };
  }

  // ---- rate limits: browsing is generous; copilot calls (models) are not
  const hits = new Map<string, { at: number; n: number }>();
  const limited = (who: string, per: number) => {
    const now = Date.now();
    const h = hits.get(who);
    if (!h || now - h.at > 60_000) { hits.set(who, { at: now, n: 1 }); if (hits.size > 5000) hits.clear(); return false; }
    return ++h.n > per;
  };

  const images = new Map<string, ArrayBuffer>();
  async function image(key: string): Promise<Response> {
    if (!/^[a-z]+-\d-[a-z-]+$/.test(key)) return new Response('not found', { status: 404 });
    let bytes = images.get(key);
    if (!bytes) {
      const f = (await cached('imgs', 3_600_000, async () => new Map(Object.entries((await sql('select json_object_agg(key, file_id) as m from shop_images'))[0].m as Record<string, string>)))).get(key);
      if (!f) return new Response('not found', { status: 404 });
      bytes = await (await octo(`/files/content?workspaceId=${env.OCTO_WORKSPACE}&fileId=${f}`)).arrayBuffer();
      images.set(key, bytes);
    }
    return new Response(bytes, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=604800, immutable' } });
  }

  async function shopRoute(method: string, path: string, u: URLSearchParams, shopper: string, b: any): Promise<Response> {
    const seg = path.replace(/^\/api\/shop\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const need = () => (shopper ? null : json({ error: 'missing X-Shopper' }, 400));
    switch (seg[0]) {
      case 'departments':
        return json(await cached('depts', 300_000, () => sql('select slug, name, categories from shop_departments order by position')), 200, 300);
      case 'home':
        return json(await cached('home', 120_000, async () => {
          const r = (await sql(`select
            (select coalesce(json_agg(x), '[]') from (select ${CARD} from shop_products where list_price is not null and in_stock order by popularity desc limit 16) x) as deals,
            (select coalesce(json_agg(x), '[]') from (select ${CARD} from shop_products where rating >= 4.5 and review_count >= 12 order by popularity desc limit 16) x) as top_rated,
            (select coalesce(json_agg(x), '[]') from (select ${CARD} from shop_products where created > now() - interval '120 days' order by popularity desc limit 16) x) as new_arrivals,
            (select coalesce(json_agg(x), '[]') from (select distinct on (dept_slug) dept, dept_slug, image from shop_products order by dept_slug, popularity desc) x) as dept_images,
            (select count(*)::int from shop_products) as products, (select count(*)::int from shop_variants) as variants, (select count(*)::int from shop_reviews) as reviews`))[0];
          return { deals: r.deals.map(card), topRated: r.top_rated.map(card), newArrivals: r.new_arrivals.map(card),
            departments: r.dept_images.map((d: any) => ({ name: d.dept, slug: d.dept_slug, image: `/img/${d.image}.svg` })),
            counts: { products: r.products, variants: r.variants, reviews: r.reviews } };
        }), 200, 60);
      case 'search':
        return json(await searchRoute(u), 200, 30);
      case 'suggest': {
        const q = clip(u.get('q'), 60).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
        if (q.length < 2) return json({ categories: [], products: [] });
        const words = q.split(/\s+/).filter(Boolean);
        const tsq = words.map((w, i) => (i === words.length - 1 ? `${w}:*` : w)).join(' & ');
        return json(await cached(`sg:${q}`, 300_000, async () => {
          const r = (await sql(`with m as (select id, title, category, cat_slug, image, popularity from shop_products where tsv @@ to_tsquery('english', $1))
            select (select coalesce(json_agg(x), '[]') from (select category as label, cat_slug as value, count(*)::int as count from m group by 1, 2 order by 3 desc limit 4) x) as categories,
                   (select coalesce(json_agg(x), '[]') from (select id, title, image from m order by popularity desc limit 6) x) as products`, [tsq]))[0];
          return { categories: r.categories, products: r.products.map((p: any) => ({ ...p, image: `/img/${p.image}.svg` })) };
        }), 200, 60);
      }
      case 'product': {
        const id = clip(seg[1], 20);
        if (!/^BW\d+$/.test(id)) return json({ error: 'not found' }, 404);
        if (seg[2] === 'reviews') {
          const page = Math.max(1, Number(u.get('page')) || 1);
          const stars = Number(u.get('stars')) || 0;
          const order = ({ recent: 'date desc', high: 'stars desc, helpful desc', low: 'stars asc, helpful desc' } as Record<string, string>)[u.get('sort') ?? ''] ?? 'helpful desc, id';
          const rows = await sql(`select id, stars, title, body, author, location, date, helpful, variant, count(*) over ()::int as total from shop_reviews
            where product_id = $1 ${stars ? 'and stars = $2' : ''} order by ${order} limit 10 offset ${(page - 1) * 10}`, stars ? [id, stars] : [id]);
          return json({ reviews: rows.map(({ total, ...r }) => r), total: rows[0]?.total ?? 0, page, label: 'Demo reviews: fictional, generated for this demo store.' }, 200, 60);
        }
        if (seg[2] === 'questions') {
          const page = Math.max(1, Number(u.get('page')) || 1);
          const rows = await sql(`select id, question, answer, answered_by, votes, date, count(*) over ()::int as total from shop_questions where product_id = $1
            order by votes desc, id limit 10 offset ${(page - 1) * 10}`, [id]);
          return json({ questions: rows.map(({ total, ...r }) => r), total: rows[0]?.total ?? 0, page, label: 'Demo Q&A: fictional, generated for this demo store.' }, 200, 60);
        }
        const p = await product(id);
        return p ? json(p, 200, 30) : json({ error: 'not found' }, 404);
      }
      case 'compare': {
        const ids = list(u.get('ids')).filter(x => /^BW\d+$/.test(x)).slice(0, 4);
        const ps = (await Promise.all(ids.map(product))).filter(Boolean) as any[];
        const names: string[] = [];
        for (const p of ps) for (const s of p.specs) if (!names.includes(s.name)) names.push(s.name);
        return json({ products: ps, specNames: names }, 200, 30);
      }
      case 'cart': {
        const bad = need(); if (bad) return bad;
        if (method === 'POST') {
          const sku = clip(b?.sku, 20);
          const qty = Math.floor(Number(b?.qty) || 1);
          if (!/^BW\d+-\d+$/.test(sku) || qty < 0 || qty > MAX_QTY) return json({ error: 'bad item or quantity' }, 400);
          const v = (await sql(`select v.stock, coalesce(c.qty, 0) as have from shop_variants v left join shop_carts c on c.sku = v.sku and c.shopper = $2 where v.sku = $1`, [sku, shopper]))[0];
          if (!v) return json({ error: 'no such item' }, 404);
          const want = b?.mode === 'set' ? qty : v.have + qty;
          if (want > MAX_QTY) return json({ error: `You can buy up to ${MAX_QTY} of one item per order.`, cart: await cart(shopper) }, 409);
          if (want > v.stock) return json({ error: v.stock ? `Only ${v.stock} left in stock.` : 'That option is out of stock.', cart: await cart(shopper) }, 409);
          if (want === 0) await sql('delete from shop_carts where shopper = $1 and sku = $2', [shopper, sku]);
          else await sql(`insert into shop_carts (shopper, sku, qty) values ($1, $2, $3) on conflict (shopper, sku) do update set qty = excluded.qty`, [shopper, sku, want]);
        } else if (method === 'DELETE') {
          await sql('delete from shop_carts where shopper = $1 and sku = $2', [shopper, clip(u.get('sku'), 20)]);
        }
        const c = await cart(shopper);
        return json({ ...c, shipping: await shippingFor(c), freeShippingAt: 35 });
      }
      case 'wishlist': {
        const bad = need(); if (bad) return bad;
        if (method === 'POST' && /^BW\d+$/.test(clip(b?.productId, 20))) await sql('insert into shop_wishlist (shopper, product_id) values ($1, $2) on conflict do nothing', [shopper, b.productId]);
        if (method === 'DELETE') await sql('delete from shop_wishlist where shopper = $1 and product_id = $2', [shopper, clip(u.get('productId'), 20)]);
        const items = await sql(`select ${CARD.split(',').map(c => `p.${c.trim()}`).join(', ')}, w.added_at from shop_wishlist w join shop_products p on p.id = w.product_id where w.shopper = $1 order by w.added_at desc`, [shopper]);
        return json({ items: items.map(card) });
      }
      case 'shipping': {
        const bad = need(); if (bad) return bad;
        const c = await cart(shopper);
        return json({ options: await shippingFor(c), subtotal: c.subtotal, taxRate: TAX });
      }
      case 'orders': {
        const bad = need(); if (bad) return bad;
        if (!seg[1]) {
          if (method === 'POST') return placeOrder(shopper, b);
          const rows = await sql('select * from shop_orders where shopper = $1 order by created_at desc limit 50', [shopper]);
          return json({ orders: rows.map(orderOut) });
        }
        const o = (await sql('select * from shop_orders where id = $1 and shopper = $2', [clip(seg[1], 40), shopper]))[0];
        if (!o) return json({ error: 'not found' }, 404);
        if (seg[2] === 'cancel' && method === 'POST') {
          if (!tracking(o).canCancel) return json({ error: 'This order is already packed, so it can no longer be cancelled. You can return it when it arrives.' }, 409);
          const r = (await sql(`update shop_orders set status = 'Cancelled', events = events || $2::jsonb where id = $1 returning *`, [o.id, JSON.stringify([{ status: 'Cancelled', at: new Date().toISOString() }])]))[0];
          return json(orderOut(r));
        }
        const returns = await sql('select * from shop_returns where order_id = $1 order by created_at desc', [o.id]);
        return json({ ...orderOut(o), returns });
      }
      case 'returns': {
        const bad = need(); if (bad) return bad;
        if (method === 'POST') {
          const o = (await sql('select * from shop_orders where id = $1 and shopper = $2', [clip(b?.orderId, 40), shopper]))[0];
          if (!o) return json({ error: 'order not found' }, 404);
          if (!tracking(o).canReturn) return json({ error: 'You can start a return once the order is delivered.' }, 409);
          const want: { sku: string; qty: number }[] = (Array.isArray(b?.lines) ? b.lines : []).slice(0, 20).map((l: any) => ({ sku: clip(l?.sku, 20), qty: Math.floor(Number(l?.qty) || 0) }));
          const lines = want.map(w => { const l = o.lines.find((x: any) => x.sku === w.sku); return l && w.qty > 0 && w.qty <= l.qty ? { ...l, qty: w.qty } : null; });
          if (!lines.length || lines.some(l => !l)) return json({ error: 'choose items from this order' }, 400);
          const method_ = b?.method === 'mail' ? 'Prepaid mail-in label ($4.99 from the refund)' : 'Free drop-off (QR code)';
          const id = `RMA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          const r = (await sql(`insert into shop_returns (id, order_id, shopper, lines, reason, method, status) values ($1, $2, $3, $4::jsonb, $5, $6, 'Return started') returning *`,
            [id, o.id, shopper, JSON.stringify(lines), clip(b?.reason, 200) || 'No reason given', method_]))[0];
          return json(r, 201);
        }
        return json({ returns: await sql('select * from shop_returns where shopper = $1 order by created_at desc limit 50', [shopper]) });
      }
      case 'account': {
        const bad = need(); if (bad) return bad;
        const r = (await sql(`select (select count(*)::int from shop_orders where shopper = $1) as orders, (select count(*)::int from shop_returns where shopper = $1) as returns,
          (select count(*)::int from shop_wishlist where shopper = $1) as wishlist, (select address from shop_orders where shopper = $1 order by created_at desc limit 1) as last_address`, [shopper]))[0];
        return json({ name: 'Guest shopper', ...r, note: 'Demo account: kept for this browser only.' });
      }
      case 'help':
        if (seg[1]) {
          const a = (await cached(`help:${seg[1]}`, 300_000, () => sql('select slug, title, section, summary, body from shop_help where slug = $1', [clip(seg[1], 60)])))[0];
          return a ? json(a, 200, 300) : json({ error: 'not found' }, 404);
        }
        return json({ articles: await cached('help', 300_000, () => sql('select slug, title, section, summary from shop_help order by position')) }, 200, 300);
      case 'help-search': {
        const rows = await helpCandidates(clip(u.get('q'), 200), 8);
        return json({ results: rows.map(r => ({ title: r.title, section: String(r.heading).split(': ').slice(1).join(': '), href: `/help/${r.slug}#${r.anchor}`, snippet: r.text })) });
      }
    }
    return json({ error: 'not found' }, 404);
  }

  async function copilotRoute(path: string, b: any): Promise<Response> {
    if (path === '/api/help/answer') return json(await helpAnswer(clip(b?.question, 300)));
    if (path === '/api/understand') {
      const kind = KINDS.includes(b.field?.kind) ? b.field.kind : 'text';
      const field: Field = { name: clip(b.field?.name, 40) || 'f', label: clip(b.field?.label, 120), question: clip(b.field?.question, 300), kind };
      const flow: Flow = { id: 'remote', business: clip(b.flow?.business, 80), scope: clip(b.flow?.scope, 200), intro: '', doneMessage: '', fields: [field] };
      const values: Record<string, string> = {};
      for (const k of Object.keys(b.values ?? {}).slice(0, 30)) values[clip(k, 40)] = clip(b.values[k], 200);
      const m = gate && jevAllowed() ? gate : inner;
      return json(await m.understand({ flow, field, said: clip(b.said, 500), values }));
    }
    if (path === '/api/warm') {
      if (!env.LLAMA_URL) return json({ ok: true, model: 'rules' });
      const wf: Field = { name: 'warm', label: 'warm-up', question: 'Say hello.', kind: 'text' };
      warming ??= inner.understand({ flow: { id: 'warm', business: 'warm-up', scope: '', intro: '', doneMessage: '', fields: [wf] }, field: wf, said: 'hello', values: {} })
        .then(() => undefined, () => undefined).finally(() => { warming = null; });
      await warming;
      return json({ ok: true, model: 'lfm' });
    }
    if (path === '/api/log') { log(`client ${clip(b.where, 40)}: ${clip(b.message, 300)} | ${clip(b.page, 80)}`); return json({ ok: true }); }
    return json({ error: 'not found' }, 404);
  }

  return {
    mode: `Octo (${env.OCTO_WORKSPACE?.slice(0, 4)}…), ${jev ? 'Jev' : 'no Jev key: word-overlap judge'}${env.LLAMA_URL ? ' + local LFM' : ''}`,
    warm: () => getVocab().then(() => undefined),
    async handle(req: Request, ip = ''): Promise<Response> {
      const url = new URL(req.url);
      const path = url.pathname;
      try {
        if (path === '/api/health') return json({ ok: true });
        if (path.startsWith('/img/')) return await image(path.slice(5).replace(/\.svg$/, ''));
        const shopper = /^[a-z0-9-]{8,64}$/i.test(req.headers.get('x-shopper') ?? '') ? req.headers.get('x-shopper')! : '';
        if (path.startsWith('/api/shop/')) {
          if (limited(`s:${ip}`, Number(env.RATE_PER_MIN) || 900)) return json({ error: 'slow down' }, 429);
          let b: any = null;
          if (req.method === 'POST') {
            const raw = await req.text();
            if (raw.length > 16_000) return json({ error: 'too large' }, 413);
            try { b = raw ? JSON.parse(raw) : {}; } catch { return json({ error: 'bad json' }, 400); }
          }
          return await shopRoute(req.method, path, url.searchParams, shopper, b);
        }
        if (req.method !== 'POST') return json({ error: 'not found' }, 404);
        if (path !== '/api/warm' && limited(`c:${ip}`, 90)) return json({ error: 'slow down' }, 429);
        const raw = await req.text();
        if (raw.length > 32_000) return json({ error: 'too large' }, 413);
        let b: any;
        try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
        return await copilotRoute(path, b);
      } catch (e) {
        log(`${path} failed: ${(e as Error).stack ?? e}`);
        return json({ error: 'backend error' }, 502);
      }
    },
  };
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Twin', 'Full', 'Queen', 'King', 'Small', 'Medium', 'Large'];
function sortSizes(s: { label: string; value: string; count: number }[]) {
  const key = (v: string) => { const i = SIZE_ORDER.indexOf(v); if (i >= 0) return i; const n = parseFloat(v); return Number.isFinite(n) ? 100 + n + (/[CY]$/.test(v) ? (v.endsWith('Y') ? 50 : 20) : 0) : 1000; };
  return [...s].sort((a, b) => key(a.value) - key(b.value));
}
const round2 = (n: number) => Math.round(n * 100) / 100;
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
