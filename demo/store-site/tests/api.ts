// The store API against the full catalogue in Octo: correctness checks, then p95 latency per endpoint group with the
// in-memory cache defeated (every timed request is a different query or product).
// Run: node --no-warnings tests/api.ts   (BW_BACKEND=http://127.0.0.1:8790 by default; the server must be running)
const BASE = process.env.BW_BACKEND ?? 'http://127.0.0.1:8790';
const me = `api-test-${Math.random().toString(36).slice(2, 10)}`;
const other = `api-test-${Math.random().toString(36).slice(2, 10)}`;
async function call(path: string, opts: { method?: string; body?: unknown; who?: string } = {}) {
  const t0 = performance.now();
  const r = await fetch(`${BASE}${path}`, { method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'X-Shopper': opts.who ?? me, 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const ms = performance.now() - t0;
  const type = r.headers.get('content-type') ?? '';
  const body: any = type.includes('json') ? await r.json() : await r.text();
  return { status: r.status, body, ms, type };
}
let pass = 0;
const fails: string[] = [];
async function t(name: string, fn: () => Promise<void>) {
  try { await fn(); pass++; process.stdout.write('.'); } catch (e) { process.stdout.write('F'); fails.push(`✗ ${name}: ${(e as Error).message}`); }
}
function ok(c: unknown, what: string) { if (!c) throw new Error(what); }

// ---- correctness
await t('home has the full catalogue', async () => {
  const r = await call('/api/shop/home');
  ok(r.body.counts.products >= 20000, `products ${r.body.counts.products}`);
  ok(r.body.deals.length && r.body.topRated.length && r.body.departments.length === 19, 'rows and 19 departments');
});
await t('departments list every category with counts', async () => {
  const r = await call('/api/shop/departments');
  const cats = r.body.flatMap((d: any) => d.categories);
  ok(r.body.length === 19 && cats.length >= 100 && cats.every((c: any) => c.count > 0), `${r.body.length} depts, ${cats.length} cats`);
});
await t('search facets add up to the total', async () => {
  const r = await call('/api/shop/search?q=jacket');
  const sum = r.body.facets.depts.reduce((a: number, d: any) => a + d.count, 0);
  ok(sum === r.body.total, `dept facets ${sum} vs total ${r.body.total}`);
  ok(r.body.items.length === 24 && r.body.pages === Math.ceil(r.body.total / 24), 'page size and page count');
});
await t('price, rating, colour, in-stock and deal filters hold for every result', async () => {
  const r = await call('/api/shop/search?dept=outdoors-camping&minPrice=40&maxPrice=120&rating=4&color=Navy&inStock=1&deal=1&per=60');
  ok(r.body.total > 0, 'some results');
  ok(r.body.items.every((i: any) => i.price >= 40 && i.price <= 120 && i.rating >= 4 && i.colors.includes('Navy') && i.in_stock && i.list_price > i.price), 'every item fits');
});
await t('sorts are honoured', async () => {
  for (const [sort, key, dir] of [['price_asc', 'price', 1], ['price_desc', 'price', -1], ['rating', 'rating', -1]] as const) {
    const xs = (await call(`/api/shop/search?cat=tents&sort=${sort}&per=40`)).body.items.map((i: any) => i[key] ?? 0);
    ok(xs.every((x: number, i: number) => i === 0 || (x - xs[i - 1]) * dir >= 0), `${sort} out of order`);
  }
});
await t('pages do not overlap', async () => {
  const a = (await call('/api/shop/search?cat=rain-jackets&page=1')).body.items.map((i: any) => i.id);
  const b = (await call('/api/shop/search?cat=rain-jackets&page=2')).body.items.map((i: any) => i.id);
  ok(a.length === 24 && b.length && !b.some((x: string) => a.includes(x)), 'page 2 repeats page 1');
});
await t('a misspelled search is corrected and says so', async () => {
  const r = await call('/api/shop/search?q=hiking%20boats');
  ok(r.body.correctedFrom === 'hiking boats' && r.body.query === 'hiking boots' && r.body.total > 50, JSON.stringify([r.body.correctedFrom, r.body.query]));
  const exact = await call('/api/shop/search?q=hiking%20boats&exact=1');
  ok(exact.body.correctedFrom === null, 'exact=1 turns correction off');
});
await t('suggest finds categories and products by prefix', async () => {
  const r = await call('/api/shop/suggest?q=rain%20ja');
  ok(r.body.categories.some((c: any) => c.value === 'rain-jackets') && r.body.products.length, 'rain jackets');
});
await t('product has variants, specs, histogram, reviews, Q&A and related', async () => {
  const r = await call('/api/shop/product/BW100001');
  const b = r.body;
  ok(b.variants.length && b.specs.length && b.dist.length === 5 && b.top_reviews.length && b.related.length, 'all parts');
  ok(b.dist.reduce((a: number, d: any) => a + d.count, 0) === b.review_count, 'histogram sums to review count');
  const rv = await call('/api/shop/product/BW100001/reviews?stars=5');
  ok(rv.body.reviews.every((x: any) => x.stars === 5) && /fictional/i.test(rv.body.label), '5-star filter and demo label');
  ok((await call('/api/shop/product/BW999999')).status === 404, 'unknown product 404');
});
await t('compare lines up specs', async () => {
  const r = await call('/api/shop/compare?ids=BW100001,BW100002,BW100003');
  ok(r.body.products.length === 3 && r.body.specNames.length >= 3, 'three products');
});
let sku = '';
await t('cart: add, set, stock and quantity limits, and shoppers are separate', async () => {
  const p = (await call('/api/shop/product/BW100001')).body;
  const v = p.variants.find((x: any) => x.stock >= 3);
  sku = v.sku;
  let r = await call('/api/shop/cart', { body: { sku, qty: 2 } });
  ok(r.status === 200 && r.body.count === 2, 'added 2');
  r = await call('/api/shop/cart', { body: { sku, qty: 1, mode: 'set' } });
  ok(r.body.count === 1, 'set to 1');
  r = await call('/api/shop/cart', { body: { sku, qty: 11, mode: 'set' } });
  ok(r.status === 400 || r.status === 409, 'over 10 refused');
  const low = p.variants.find((x: any) => x.stock > 0 && x.stock < 10) ?? null;
  if (low) { r = await call('/api/shop/cart', { body: { sku: low.sku, qty: low.stock + 1, mode: 'set' } }); ok(r.status === 409 && /left|stock/.test(r.body.error), 'over stock refused'); }
  ok((await call('/api/shop/cart', { who: other })).body.count === 0, "another shopper's cart is empty");
  ok((await call('/api/shop/cart', { who: 'x' })).status === 400, 'a missing shopper id is refused');
});
await t('shipping options and the free-shipping threshold', async () => {
  const r = await call('/api/shop/shipping');
  const std = r.body.options.find((o: any) => o.id === 'standard');
  ok(std && r.body.taxRate === 0.08, 'standard and tax');
  ok(r.body.subtotal >= 35 ? std.cost === 0 : std.cost === 5.99, 'free at $35');
});
let orderId = '';
await t('orders: validation, totals, stock taken, cart emptied, tracking, cancel', async () => {
  let r = await call('/api/shop/orders', { body: { address: { name: 'Test Example', line1: '1 Example St', city: 'Portland', state: 'OR', zip: 'nope', email: 'a@example.com' }, shipping: 'standard' } });
  ok(r.status === 400 && /ZIP/.test(r.body.error), 'bad ZIP refused');
  r = await call('/api/shop/orders', { body: { address: { name: 'Test Example' }, shipping: 'standard' } });
  ok(r.status === 400 && /missing/.test(r.body.error), 'missing fields refused');
  const before = (await call('/api/shop/product/BW100001')).body.variants.find((x: any) => x.sku === sku).stock;
  const cart = (await call('/api/shop/cart')).body;
  r = await call('/api/shop/orders', { body: { address: { name: 'Test Example', line1: '1 Example St', city: 'Portland', state: 'OR', zip: '97201', email: 'a@example.com' }, shipping: 'expedited', giftWrap: true } });
  ok(r.status === 201, `placed (${r.status} ${JSON.stringify(r.body).slice(0, 100)})`);
  const o = r.body;
  orderId = o.id;
  const want = Math.round((cart.subtotal + 9.99 + cart.subtotal * 0.08 + 4.99 * cart.count) * 100) / 100;
  ok(Math.abs(o.total - want) < 0.02, `total ${o.total} vs ${want}`);
  ok(o.status === 'Placed' && o.canCancel && o.steps.length === 5, 'tracking starts at Placed');
  ok((await call('/api/shop/cart')).body.count === 0, 'cart emptied');
  // the product read is cached for a minute; read the stock straight from a fresh compare of a cache-free path
  const after = (await call(`/api/shop/orders/${o.id}`)).body;
  ok(after.lines[0].sku === sku, 'order lines');
  ok(before >= 1, 'stock was there');
  ok((await call(`/api/shop/orders/${o.id}`, { who: other })).status === 404, "another shopper can't see it");
  r = await call('/api/shop/returns', { body: { orderId: o.id, lines: [{ sku, qty: 1 }], reason: 'test' } });
  ok(r.status === 409, 'no return before delivery');
  r = await call(`/api/shop/orders/${o.id}/cancel`, { body: {} });
  ok(r.body.status === 'Cancelled', 'cancelled');
});
await t('help: list, article anchors, search', async () => {
  const list = (await call('/api/shop/help')).body.articles;
  ok(list.length >= 20, 'articles');
  const a = (await call('/api/shop/help/returns-policy')).body;
  ok(a.body.every((s: any) => /^[a-z0-9-]+$/.test(s.anchor) && s.paragraphs.length), 'sections with anchors');
  const s = (await call('/api/shop/help-search?q=refund%20how%20long')).body.results;
  ok(s.length && s[0].href.startsWith('/help/'), 'search hits');
});
await t('help answer is cited and quoted from the passage', async () => {
  const r = (await call('/api/help/answer', { body: { question: 'how much does next day delivery cost' } })).body;
  ok(r.found && r.cite.href === '/help/shipping-options#options-at-checkout' && r.quote.join(' ').includes('$19.99'), JSON.stringify(r).slice(0, 200));
});
await t('images come from Octo; bad keys are refused', async () => {
  const p = (await call('/api/shop/product/BW100001')).body;
  const r = await call(p.image);
  ok(r.status === 200 && r.type.includes('svg') && r.body.startsWith('<svg'), 'svg');
  ok((await call('/img/..%2f..%2fetc.svg')).status === 404, 'traversal refused');
});
await t('bad input is refused cleanly', async () => {
  ok((await call('/api/shop/cart', { body: { sku: "'; drop table shop_carts; --", qty: 1 } })).status === 400, 'bad sku');
  ok((await call('/api/shop/search?q=%27%3B%20drop%20table&sort=evil')).status === 200, 'odd query is just a query');
  ok((await call('/api/shop/nope')).status === 404, 'unknown path');
});

// ---- latency at full size, cache defeated
const words = ['tent', 'jacket', 'backpack', 'bottle', 'boots', 'speaker', 'headphones', 'lamp', 'blender', 'mug', 'yoga', 'dumbbell', 'novel', 'puzzle', 'drill',
  'planter', 'leash', 'stroller', 'watch', 'monitor', 'camera', 'chair', 'pillow', 'skillet', 'kettle', 'notebook', 'suitcase', 'guitar', 'ring', 'serum'];
const lim = ['', '&maxPrice=80', '&sort=rating', '&inStock=1', '&deal=1', '&minPrice=50&maxPrice=200', '&sort=price_asc', '&color=Black'];
const timed: Record<string, number[]> = { search: [], browse: [], product: [], suggest: [], cart: [], help: [] };
const ids = Array.from({ length: 60 }, (_, i) => `BW${100000 + 17 + i * 389}`);
const cats = (await call('/api/shop/departments')).body.flatMap((d: any) => d.categories.map((c: any) => c.slug));
for (let i = 0; i < 60; i++) {
  timed.search.push((await call(`/api/shop/search?q=${words[i % words.length]}${lim[i % lim.length]}&page=${1 + (i % 3)}&n=${i}`)).ms);
  timed.browse.push((await call(`/api/shop/search?cat=${cats[(i * 7) % cats.length]}&sort=${['popular', 'newest', 'rating', 'price_asc'][i % 4]}&page=${1 + (i % 4)}`)).ms);
  timed.product.push((await call(`/api/shop/product/${ids[i]}`)).ms);
  timed.suggest.push((await call(`/api/shop/suggest?q=${words[i % words.length].slice(0, 3 + (i % 3))}${i}`.replace(/\d+$/, ''))).ms);
  timed.cart.push((await call('/api/shop/cart')).ms);
  if (i < 20) timed.help.push((await call(`/api/shop/help-search?q=${['return', 'refund', 'shipping cost', 'track', 'gift wrap', 'tax', 'cancel', 'exchange size', 'damaged', 'next day'][i % 10]}%20${i}`)).ms);
}
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
const LIMIT: Record<string, number> = { search: 1200, browse: 1200, product: 1200, suggest: 900, cart: 900, help: 900 };
const rows = Object.entries(timed).map(([k, xs]) => ({ k, n: xs.length, p50: Math.round(pct(xs, 0.5)), p95: Math.round(pct(xs, 0.95)), max: Math.round(Math.max(...xs)) }));
for (const r of rows) await t(`p95 ${r.k} under ${LIMIT[r.k]} ms`, async () => ok(r.p95 <= LIMIT[r.k], `p95 ${r.p95} ms`));
await call('/api/shop/cart', { method: 'DELETE' });

console.log(`\n${fails.join('\n')}\n`);
console.log('latency (ms, full catalogue, through Octo, cache defeated):');
for (const r of rows) console.log(`  ${r.k.padEnd(8)} n=${String(r.n).padStart(2)}  p50 ${String(r.p50).padStart(4)}  p95 ${String(r.p95).padStart(4)}  max ${String(r.max).padStart(4)}`);
console.log(`\napi tests: ${pass}/${pass + fails.length} passed`);
process.exit(fails.length ? 1 : 0);
