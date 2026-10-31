// The shopping copilot's view of Brambleway: the store's own API (the same calls the site makes), for this shopper.
// Used in the page by the widget and in Node by the tests.
import type { Cart, HelpAnswer, Params, Product, SearchResult, Store } from '../../../copilot-engine/src/shop.ts';

export class HttpStore implements Store {
  private base: string;
  private shopper: () => string;
  constructor(base: string, shopper: () => string) { this.base = base; this.shopper = shopper; }
  private async get<T>(path: string): Promise<T> {
    const r = await fetch(`${this.base}${path}`, { headers: { 'X-Shopper': this.shopper() } });
    if (!r.ok && r.status !== 409) throw new Error(`${path.split('?')[0]} ${r.status}`);
    return r.json();
  }
  private async post<T>(path: string, body: unknown): Promise<{ status: number; body: T }> {
    const r = await fetch(`${this.base}${path}`, { method: 'POST', headers: { 'X-Shopper': this.shopper(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  }
  search(p: Params): Promise<SearchResult> {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '' && v !== false) u.set(k, v === true ? '1' : String(v));
    return this.get(`/api/shop/search?${u}&per=24`);
  }
  async product(id: string): Promise<Product | null> {
    try { return await this.get(`/api/shop/product/${id}`); } catch { return null; }
  }
  async questions(id: string) { return (await this.get<{ questions: { question: string; answer: string }[] }>(`/api/shop/product/${id}/questions`)).questions; }
  cart(): Promise<Cart> { return this.get('/api/shop/cart'); }
  async addToCart(sku: string, qty: number) {
    const r = await this.post<{ error?: string } & Cart>('/api/shop/cart', { sku, qty });
    return r.status === 200 ? { ok: true, cart: r.body } : { ok: false, error: r.body.error };
  }
  async help(question: string): Promise<HelpAnswer> { return (await this.post<HelpAnswer>('/api/help/answer', { question })).body; }
}
