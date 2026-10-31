# Brambleway: a large, fictional online store for a voice-copilot demo

Build a complete, realistic online department store called **Brambleway**. It exists to show a voice shopping
assistant ("the copilot") helping someone find and buy something without touching the screen. The audience is people
judging whether such an assistant could work on a big retailer's site, so the store itself must feel like a real,
busy, modern marketplace with more than 23,000 products, not a template or a toy. Mostly opened on a phone from a
link; also on laptops.

Everything is fictional: the store, the brands, the products, the reviews and the people. Nothing is sold, charged or
shipped. All data comes from the store's own backend over HTTP (described below); the app has no product data of
its own, no mock data and no fallback data. If a request fails, show a calm error with a Retry button.

## First: a feature checklist (FEATURES.md)

Before building, write `FEATURES.md`: the features that 3 to 5 of the largest general online stores have in common
(search with suggestions, faceted filters, sorting, deals, product pages with variants and specs, ratings and review
histograms, Q&A, comparison, wishlist, cart with free-shipping progress, multi-step checkout, order tracking,
returns, help centre, recently viewed…), as a checklist, and mark which ones this app builds. Name stores only in
that file, never in the app. Then build Brambleway's **own** version: its own name, colours, type, copy and layout.
Nothing may be copied from a real store: no text, logos, images, icons or a layout so close that it reads as any
particular real store. No real brand names anywhere in the app.

## Brand and design direction

- **Brambleway**: a warm, capable everyday store. Wordmark "Brambleway" set in a characterful but readable serif or
  rounded sans, with a simple mark built from shapes (a leaf-and-path or bramble motif), no image file.
- Palette: deep teal `#0f4c4a` as the primary (header, primary buttons), saffron `#e9a23b` as the accent (deal badges,
  the cart count, focus rings, the "Add to cart" button), cream `#fbf7ef` page background, white cards, warm ink
  `#1f2421` for text, a muted sage for borders and secondary text. Not navy and orange, not black and yellow.
- Dense but tidy, like a big marketplace: product grids of 2 columns on a phone, 4–5 on a laptop, compact cards with
  image, title (2 lines), star rating with count, price, list price struck through when on a deal, a saffron deal
  badge ("-23%"), and "Only 3 left" when stock is low. Generous tap targets (at least 44px), inputs at least 16px.
- Product images are SVG illustrations served by the backend at the URLs it returns (`/img/...svg`). Show them on a
  soft square tile with `object-fit: contain`. Use the images it returns; never draw your own product pictures.
- Phone first: 360px to large desktop, the page never scrolls sideways.

## Demo labelling

- A slim bar pinned above the header on every page (`data-testid="demo-banner"`), in the brand's colours, text
  exactly: "Demo store: Brambleway is fictional. Nothing is sold, charged or shipped." Slim and readable at 360px.
- Footer, in small calm type (`data-testid="demo-footer"`): "Brambleway is a fictional store built to demonstrate a
  voice shopping assistant. Products, brands, reviews and answers are generated for this demo."
- Review and Q&A sections carry a small label from the backend (`label`), for example "Demo reviews: fictional,
  generated for this demo store."
- At checkout, next to the Place order button: "Demo: nothing is charged or shipped."
- `document.title` is "<Page> · Brambleway (Demo)". `index.html` has `<meta name="robots" content="noindex, nofollow">`.

## Pages and routes

All internal links use client-side routing (`react-router` `Link`/`navigate`), never full page loads: the voice call
lives in the page and must stay connected while the shopper, or the copilot, moves between pages. Every page with a
list of results keeps its state in the URL (query string), so a link or a refresh shows the same list.

- **Header (every page)**: wordmark, a large search box with suggestions (`data-testid="search-input"`; typing calls
  `/api/shop/suggest` after 150 ms: matching categories and up to 6 products with thumbnails; Enter goes to
  `/search?q=`), a "Departments" menu (all 19 departments with their categories, from `/api/shop/departments`), Help,
  Account, Wishlist (with count), and Cart with its item count badge (`data-testid="cart-count"`). On a phone the
  search box sits on its own row below the logo, and departments open in a drawer.
- `/` **Home**: a hero for this week's deals, department tiles (image and name from `/api/shop/home`), rows of
  product cards ("Today's deals", "Top rated", "New arrivals") that scroll sideways inside their row, the catalogue's
  size in plain words from `counts` ("23,506 products across 19 departments"), and a short "Shop with your voice"
  panel explaining the assistant.
- `/search?q=&cat=&dept=&brand=&color=&size=&minPrice=&maxPrice=&rating=&inStock=1&deal=1&sort=&page=` **Search and
  browse** (also used for `/d/:dept` and `/c/:cat`, which set `dept`/`cat`): results from `/api/shop/search`.
  - Above the results: "1–24 of 219 results for "hiking boots"". When the response has `correctedFrom`, show
    "Showing results for **hiking boots**. Search instead for *hiking boats*" (the second link adds `exact=1`).
    When `relaxed` is true: "No exact matches. Showing items that match some of your words."
  - A filter sidebar on desktop and a "Filters" bottom sheet on a phone, built only from `facets`: Department,
    Category, Price (the buckets plus min/max inputs), Customer rating, Brand (top 25, searchable), Colour (swatches),
    Size, Deals only, In stock only. Each option shows its count. Applied filters show as removable chips with
    "Clear all". Sort menu (`data-testid="sort"`): Featured (relevance), Best sellers, Price low to high, high to low,
    Top rated, Most reviews, Newest, Biggest discount (values `relevance`, `popular`, `price_asc`, `price_desc`,
    `rating`, `reviews`, `newest`, `discount`).
  - Results grid of product cards (`data-testid="product-card"`, with `data-product-id`), numbered pagination
    (`data-testid="pagination"`), 24 per page. A "Compare" checkbox on each card (up to 4) shows a compare tray.
  - No results: suggestions to check spelling, remove filters, or browse departments.
- `/p/:id/:slug` **Product page** (from `/api/shop/product/:id`): breadcrumb (department › category), image gallery
  (the variant's image changes with the selected colour), title, brand ("Visit the Valewick store" goes to
  `/search?brand=`), rating with review count linking to reviews, price, list price and "You save $X (23%)", deal end
  date, colour swatches and size buttons built from `variants` (an option with `stock` 0 is shown crossed out and
  can't be chosen; the selected variant's stock shows "In stock", "Only 4 left" or "Out of stock"), quantity (1–10),
  **Add to cart** (`data-testid="add-to-cart"`) and **Add to wishlist**, a delivery estimate line, "About this item"
  bullets, a full specifications table (`data-testid="specs"`), the description, a rating histogram from `dist`
  (5 to 1 stars with bars, each bar filters reviews), reviews (`data-testid="reviews"`, paged and sortable from
  `/api/shop/product/:id/reviews`), questions and answers (`data-testid="questions"`, from `.../questions`), and a
  "Similar items" row (`related`). Show `demoNote` in small type under the title. The selected colour and size live
  in the URL (`?sku=`) so a link opens the same variant.
- `/compare?ids=` **Compare** up to 4 products side by side (`/api/shop/compare`): image, price, rating, and every
  spec as a row (`specNames`), with differences highlighted, and Add to cart for each.
- `/cart` **Cart** (`/api/shop/cart`): lines with image, title, colour/size, price, quantity stepper (1–10) and
  Remove; subtotal; a free-shipping progress bar ("Add $12.01 for free standard shipping" when subtotal is under
  `freeShippingAt`); the shipping options with their costs; "Proceed to checkout". Errors from the backend (409, for
  example "Only 3 left in stock.") are shown next to the line. Empty cart: a friendly message and deals row.
- `/checkout` **Checkout**: one page in three clearly numbered sections: **1 Delivery address**, **2 Delivery speed**,
  **3 Payment (demo)**, then an **order review** summary (lines, subtotal, shipping, estimated tax at the `taxRate`
  from `/api/shop/shipping`, gift wrap, total) and **Place order**. The exact form markup is below. Place order
  posts to `/api/shop/orders` and goes to `/orders/:id?placed=1`. Errors from the backend (400/409) appear above the
  button.
- `/orders` **Your orders** (`/api/shop/orders`): each order with date, total, status and a small progress tracker
  (Placed → Packed → Shipped → Out for delivery → Delivered, from `steps`).
- `/orders/:id` **Order detail**: tracking timeline with times, carrier and tracking number, estimated delivery,
  address, lines, totals, **Cancel order** when `canCancel` (POST `.../cancel`), **Start a return** when `canReturn`
  (choose lines and quantity, a reason, drop-off or mail-in; POST `/api/shop/returns`), and existing returns. With
  `?placed=1`, show a "Thank you, your demo order is placed" panel at the top.
- `/account` **Account** (`/api/shop/account`): "Guest shopper", links to orders, returns, wishlist, and the demo
  note. No sign-in, no passwords.
- `/wishlist` **Wishlist** (`/api/shop/wishlist`): product cards with Move to cart (goes to the product page when it
  has options) and Remove.
- `/help` **Help centre** (`/api/shop/help`): a search box (`/api/shop/help-search`, results link to
  `/help/:slug#anchor`), and all articles grouped by `section`, each with its summary.
- `/help/:slug` **Help article** (`/api/shop/help/:slug`): the article's `body` is a list of sections
  `[{ anchor, heading, paragraphs: string[] }]`; render each section's heading as an `h2` with `id={anchor}` and its
  paragraphs below it. When the URL has a `#anchor`, scroll to it and briefly highlight that section. Show the full
  text; no truncation, no "read more". A "Related articles" list from the same `section`.
- Recently viewed products (kept in the browser) as a row on home and product pages.

## The shopper id

The backend identifies a shopper by the `X-Shopper` header. On first load create a random id (`crypto.randomUUID()`),
keep it in `localStorage` under `bw-shopper`, and send it on every `/api/shop/` request. The id must be the same one
the copilot uses: read it through `window.bwShopper()` if that function exists, and define `window.bwShopper` (returning
the id) at startup.

## The backend API (same origin; all JSON; GET unless noted)

- `GET /api/shop/departments` → `[{ slug, name, categories: [{ kind, name, slug, count }] }]`
- `GET /api/shop/home` → `{ deals, topRated, newArrivals: Card[], departments: [{ name, slug, image }], counts: { products, variants, reviews } }`
- `Card` = `{ id, slug, title, brand, price, max_price, list_price|null, deal, deal_ends, rating|null, review_count, question_count, image, in_stock, colors: string[], sizes: string[], category, cat_slug, dept, dept_slug }`
  (`deal` is the percentage off, 0 when none; `max_price > price` means "from $price"). Product URL: `/p/${id}/${slug}`.
- `GET /api/shop/search?…` (parameters above, plus `per`) → `{ total, page, per, pages, items: Card[], query, correctedFrom|null, relaxed,
  facets: { depts, categories, brands, colors, sizes: [{ label, value, count }], ratings: [{ label, value, count }],
  prices: [{ label, min, max|null, count }], deals, inStock, priceRange: [min, max] } }`. Multi-value filters are
  comma-separated (`brand=Valewick,Thornford`).
- `GET /api/shop/suggest?q=` → `{ categories: [{ label, value, count }], products: [{ id, title, image }] }`
- `GET /api/shop/product/:id` → Card fields plus `{ description, bullets: string[], specs: [{ name, value }], variants:
  [{ sku, color|null, size|null, price, stock, image }], dist: [{ stars, count }], top_reviews, top_questions, related: Card[], tags, audience, demoNote }`
- `GET /api/shop/product/:id/reviews?page=&sort=helpful|recent|high|low&stars=` → `{ reviews: [{ id, stars, title, body, author, location, date, helpful, variant }], total, page, label }` (10 per page)
- `GET /api/shop/product/:id/questions?page=` → `{ questions: [{ id, question, answer, answered_by, votes, date }], total, page, label }`
- `GET /api/shop/compare?ids=a,b` → `{ products: Product[], specNames: string[] }`
- `GET /api/shop/cart` → `{ lines: [{ sku, qty, color, size, price, stock, product_id, slug, title, brand, image, line_total }], count, subtotal, shipping: ShipOption[], freeShippingAt }`;
  `POST /api/shop/cart { sku, qty, mode?: 'set' }` adds `qty` (or sets it with `mode: 'set'`; qty 0 removes) and returns the cart;
  `DELETE /api/shop/cart?sku=` removes a line. 409 means not enough stock or over 10: `{ error, cart }`.
- `ShipOption` = `{ id: 'standard'|'expedited'|'nextday'|'freight', label, days, price, cost, note }` (`cost` is what this cart pays).
- `GET /api/shop/shipping` → `{ options: ShipOption[], subtotal, taxRate }`
- `GET /api/shop/wishlist` → `{ items: Card[] }`; `POST { productId }`; `DELETE ?productId=`
- `GET /api/shop/orders` → `{ orders: Order[] }`; `POST { address: { name, line1, line2, city, state, zip, country, phone, email }, shipping, giftWrap }` → Order (201) or `{ error }`
- `Order` = `{ id, created_at, status, address, shipping, lines: [{ sku, product_id, title, color, size, price, qty, image }], subtotal, shipping_cost, tax, total,
  steps: [{ status, at, done }], estimate, carrier, trackingNumber, canCancel, canReturn }`; `GET /api/shop/orders/:id` adds `returns`; `POST /api/shop/orders/:id/cancel`
- `GET /api/shop/returns` → `{ returns }`; `POST { orderId, lines: [{ sku, qty }], reason, method: 'dropoff'|'mail' }`
- `GET /api/shop/account` → `{ name, orders, returns, wishlist, last_address, note }`
- `GET /api/shop/help` → `{ articles: [{ slug, title, section, summary }] }`; `GET /api/shop/help/:slug` → `{ slug, title, section, summary, body: [{ anchor, heading, paragraphs }] }`;
  `GET /api/shop/help-search?q=` → `{ results: [{ title, section, href, snippet }] }`
- Images: `/img/<key>.svg` (the URLs in the data, used as they are).

For local development, `vite.config.ts` proxies `/api` and `/img` to `process.env.BW_BACKEND || 'http://127.0.0.1:8790'`.
The app may call only the `/api/shop/` paths above.

## Checkout form: exact markup the copilot reads

The copilot reads this form from the page and fills it field by field, reading each value back for a yes. It never
presses Place order. Render exactly these native elements, ids, names, values and attributes (labels may be styled;
don't replace the fields with custom components, and keep the elements in the page at all times):

```html
<form data-copilot-form id="checkout" autocomplete="off">  <!-- onSubmit: preventDefault, reportValidity, then POST /api/shop/orders -->
  <!-- 1 Delivery address -->
  <input id="fullname" name="fullname" autocomplete="name" required data-copilot-spell
         data-copilot-ask="Who is the order going to? Full name, please." placeholder="e.g. Jordan Example">
  <input id="line1" name="line1" autocomplete="address-line1" required data-copilot-ask="What's the street address?" placeholder="e.g. 12 Example Street">
  <input id="line2" name="line2" autocomplete="address-line2" data-copilot-ask="Apartment, suite or unit? Say none if there isn't one." placeholder="Apartment, suite (optional)">
  <input id="city" name="city" autocomplete="address-level2" required data-copilot-ask="Which city?">
  <select id="state" name="state" required data-copilot-ask="Which state?">
    <option value="">Choose a state</option>
    <!-- all 50 states and DC: value = the two-letter code, text = the full name, data-copilot-also = "<code spelled with spaces>" e.g. "o r" for Oregon -->
  </select>
  <input id="zip" name="zip" autocomplete="postal-code" required inputmode="numeric" pattern="\d{5}(-\d{4})?" title="Five digits, like 97201"
         data-copilot-kind="code" data-copilot-ask="And the ZIP code?" placeholder="e.g. 97201">
  <input id="phone" name="phone" type="tel" autocomplete="tel" minlength="10" data-copilot-ask="A phone number for the carrier? Say none to skip." placeholder="e.g. (555) 010-0199">
  <input id="email" name="email" type="email" autocomplete="email" required data-copilot-ask="Which email should the receipt go to?" placeholder="e.g. jordan@example.com">
  <!-- 2 Delivery speed: one radio per option from /api/shop/shipping, in its order, label "<label> · <days> · <cost or Free>" -->
  <fieldset data-copilot-ask="How fast do you need it?">
    <input type="radio" name="shipping" id="ship-standard" value="standard" required data-copilot-also="standard, regular, normal, cheapest, free"> ...
    <input type="radio" name="shipping" id="ship-expedited" value="expedited" data-copilot-also="expedited, faster, two day, 2 day, express"> ...
    <input type="radio" name="shipping" id="ship-nextday" value="nextday" data-copilot-also="next day, tomorrow, overnight, fastest"> ...
    <!-- or only ship-freight (value "freight", also "freight, delivery") when the backend offers freight -->
  </fieldset>
  <select id="giftwrap" name="giftwrap" data-copilot-ask="Should we gift wrap it? It's 4.99 an item.">
    <option value="no" data-copilot-also="no, nope, no thanks, not needed">No gift wrap</option>
    <option value="yes" data-copilot-also="yes, please, gift wrap, wrap it">Gift wrap ($4.99 per item)</option>
  </select>
  <!-- 3 Payment (demo): no card fields of any kind -->
  <select id="payment" name="payment" required data-copilot-ask="This is a demo store, so payment is pretend. Shall I choose demo payment?">
    <option value="">Choose a payment method</option>
    <option value="demo" data-copilot-also="demo, demo payment, yes, pretend, fake">Demo payment (nothing is charged)</option>
  </select>
  <button type="submit" data-testid="place-order">Place order</button>   <!-- next to it: "Demo: nothing is charged or shipped." -->
</form>
```

The order review summary updates as the shipping option and gift wrap change. The field the copilot is asking about
carries the attribute `data-copilot-active`: give it a soft saffron glow ring. Gift wrap `yes` sends `giftWrap: true`.

## The copilot's place in the app

The copilot itself is added after this run (a call bar and panel component plus a script); the app only needs these
hooks, and must not draw its own assistant UI or chat:

1. **A slot**: render `<div id="copilot-root"></div>` once at the end of the root layout, and leave 72px of bottom
   padding on every page on a phone so a call bar there never hides content.
2. **Navigation**: once, inside the router, register the app's client-side navigate:
   `window.copilot?.onNavigate(p => navigate(p))` (if `window.copilot` isn't there yet, wait for the `copilot:ready`
   window event; call the returned unsubscribe on cleanup). The copilot moves between pages this way during a call;
   never reload the page to change route.
3. **Cart changes**: the copilot may add to the cart through the same API. Listen for a `bw:cart-changed` window event
   and refetch the cart (count badge, cart page, checkout summary) when it fires; also dispatch that event yourself
   after any cart change the shopper makes.
4. **Product page facts in the DOM**: on the product page, the root element carries `data-product-id`, and the
   selected variant's SKU is on the Add to cart button as `data-sku`; colour and size options carry `data-color` /
   `data-size`. Spec rows are `<tr data-spec="<name>">`.
5. "Shop with your voice" buttons on home (and an icon button in the header, `data-testid="voice-start"`) call
   `window.copilot?.start({ voice: true })`.

## Test hooks

`demo-banner`, `demo-footer`, `search-input`, `cart-count`, `product-card`, `pagination`, `sort`, `add-to-cart`,
`specs`, `reviews`, `questions`, `place-order`, `voice-start`, plus the checkout field ids above.

## Done means

- Every page above works against the backend on a phone (375px) and a laptop (1280px), looks like a real, busy,
  modern store with its own identity, never scrolls sideways, and shows the demo bar.
- Search for "hiking boats" shows the corrected "hiking boots" results with the correction line; filters and sort
  change the URL and the results; page 3 of a department loads.
- A product page shows variants, specs, the histogram, reviews and Q&A; Add to cart updates the count badge.
- The checkout form renders exactly as specified and Place order creates an order and opens it.
- `npm run build` passes.
