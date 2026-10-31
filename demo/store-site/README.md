# Brambleway: a demo store with a voice shopping copilot

Brambleway is a large fictional online store (about 20,000 products with variants, stock, deals, reviews and Q&A) built to
show the website voice copilot in a shop. A shopper talks; the copilot narrows a vague request with a question,
searches, compares, reads specs and reviews, adds to the cart only after a read-back and a yes, fills the checkout
form one read-back at a time, and answers shipping and returns questions only from the help centre, with a link to the
section it quotes. It never places the order or pays: the shopper presses **Place order** themselves (and payment is a
demo choice with no card fields).

Everything is stored in Octo (workspace `octo_db_chatbots`): catalogue, reviews, carts, wishlists, orders, returns, help
articles and product images. There are no local copies and no fallbacks. See [DATA_LICENSE.md](DATA_LICENSE.md).

## Parts

| Path | What it is |
| --- | --- |
| `api.ts`, `server.ts` | The Node backend (no framework). Every read and write is SQL to Octo; images are Octo files. Also the copilot's routes (`/api/help/answer`, `/api/understand`). |
| `app/` | The React storefront, built by ABA (WorkBuddy, DeepSeek V4.1 Flash) from [aba/spec.md](aba/spec.md), with the copilot call bar added by hand from `copilot-ui/`. |
| `../../copilot-engine/src/shop.ts`, `shop-text.ts` | The shopping copilot's rules: clarifying questions, spoken numbers and prices, misheard words, variant choice, read-backs, help answers. |
| `widget/` | The copilot script the site loads (`/copilot/sdk.js`): the shopper while browsing, and the shared form copilot on `/checkout`. |
| `tools/` | The data generators and Octo loaders (catalogue, images, help centre). |
| `tests/` | `shop-eval.ts` (conversations), `api.ts` (API checks and p95 latency at full size), `store-call.ts` (whole zero-click calls in a browser, desktop and phone, with screenshots). |

## Run it

Octo credentials come from `~/Documents/projects/.env` (names only: `OCTO_KEY`, `OCTO_WORKSPACE`, `OCTO_BASE`).

```bash
node build.ts
```

```bash
PORT=8790 node --no-warnings server.ts
```

Then open http://127.0.0.1:8790.

## Test it

The server must be running on 8790 (the call test starts its own on 8793).

```bash
node --no-warnings tests/run-all.ts
```

Screenshots land in `build/shots/` (home, search, product, cart, and checkout mid-fill, at desktop and phone width).

## Rules the copilot keeps

- Open models only: Jev for passage picking and the form copilot's understanding, through Octo's vault. No Claude, no
  Gemma, never `openrouter/free`.
- Nothing goes in the cart without a read-back ("To confirm: add 1 … at $X … Say yes or no.") and a yes.
- Every checkout answer is read back before it is used. The order is never placed and nothing is ever submitted.
- Shipping, returns, gift wrap and payment questions are answered only by quoting the help centre, with the section
  linked. When the help centre doesn't say, the copilot says so instead of guessing.
