"""Load the generated catalogue into Octo, the store's one database (the workspace's own Postgres, POST /query).

Tables (all prefixed shop_): departments, products (with a weighted full-text column and the indexes search and the
facets use), variants, reviews, questions; the shopper tables (carts, wishlist, orders, returns) are created empty.
Resumable: rows are upserted by primary key, so a re-run fixes a partial load. Usage:
  python3 tools/load_octo.py [--only products,variants,...] [--schema-only]
"""
import concurrent.futures as cf, json, pathlib, re, sys, time

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from octo import sql  # noqa: E402

CAT = pathlib.Path(__file__).resolve().parent.parent / "build" / "catalog"

SCHEMA = """
create table if not exists shop_departments (slug text primary key, name text not null, position int not null, categories jsonb not null);
create table if not exists shop_products (
  id text primary key, slug text not null, title text not null, brand text not null, dept text not null, dept_slug text not null,
  category text not null, cat_slug text not null, kind text not null, noun text not null, audience text not null, tags text[] not null,
  price numeric(10,2) not null, max_price numeric(10,2) not null, list_price numeric(10,2), deal_ends date, rating numeric(2,1),
  review_count int not null, question_count int not null, in_stock boolean not null, colors text[] not null, sizes text[] not null,
  description text not null, bullets jsonb not null, specs jsonb not null, image text not null, popularity int not null, created date not null,
  search_extra text not null,
  tsv tsvector generated always as (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', brand || ' ' || category || ' ' || noun), 'B') ||
    setweight(to_tsvector('english', search_extra), 'C') ||
    setweight(to_tsvector('english', description), 'D')) stored);
create index if not exists shop_products_tsv on shop_products using gin (tsv);
create index if not exists shop_products_cat on shop_products (cat_slug, popularity desc);
create index if not exists shop_products_dept on shop_products (dept_slug, popularity desc);
create index if not exists shop_products_pop on shop_products (popularity desc);
create index if not exists shop_products_price on shop_products (price);
create index if not exists shop_products_brand on shop_products (brand);
create index if not exists shop_products_tags on shop_products using gin (tags);
create index if not exists shop_products_colors on shop_products using gin (colors);
create index if not exists shop_products_deals on shop_products (popularity desc) where list_price is not null;
create table if not exists shop_variants (sku text primary key, product_id text not null, color text, size text, price numeric(10,2) not null, stock int not null);
create index if not exists shop_variants_product on shop_variants (product_id);
create table if not exists shop_reviews (id int primary key, product_id text not null, stars int not null, title text not null, body text not null,
  author text not null, location text not null, date date not null, helpful int not null, variant text);
create index if not exists shop_reviews_product on shop_reviews (product_id, helpful desc);
create table if not exists shop_questions (id int primary key, product_id text not null, question text not null, answer text not null,
  answered_by text not null, votes int not null, date date not null);
create index if not exists shop_questions_product on shop_questions (product_id, votes desc);
create table if not exists shop_carts (shopper text not null, sku text not null, qty int not null check (qty > 0), added_at timestamptz not null default now(),
  primary key (shopper, sku));
create table if not exists shop_wishlist (shopper text not null, product_id text not null, added_at timestamptz not null default now(), primary key (shopper, product_id));
create table if not exists shop_orders (id text primary key, shopper text not null, created_at timestamptz not null default now(), status text not null,
  address jsonb not null, shipping jsonb not null, lines jsonb not null, subtotal numeric(10,2) not null, shipping_cost numeric(10,2) not null,
  tax numeric(10,2) not null, total numeric(10,2) not null, events jsonb not null);
create index if not exists shop_orders_shopper on shop_orders (shopper, created_at desc);
create table if not exists shop_returns (id text primary key, order_id text not null, shopper text not null, lines jsonb not null, reason text not null,
  method text not null, status text not null, created_at timestamptz not null default now());
create index if not exists shop_returns_shopper on shop_returns (shopper, created_at desc);
create table if not exists shop_help (slug text primary key, title text not null, section text not null, summary text not null, body jsonb not null, position int not null);
create table if not exists shop_images (key text primary key, file_id text not null, bytes int not null);
"""

JSONB = {"categories", "bullets", "specs", "body"}
ARRAYS = {"tags", "colors", "sizes"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def upsert(table, cols, rows, key, chunk):
    def one(part):
        vals, params = [], []
        for r in part:
            ph = []
            for c in cols:
                params.append(json.dumps(r[c], ensure_ascii=False) if c in JSONB else r[c])
                ph.append(f"${len(params)}" + ("::jsonb" if c in JSONB else "::text[]" if c in ARRAYS else ""))
            vals.append("(" + ",".join(ph) + ")")
        keys = key if isinstance(key, tuple) else (key,)
        sets = ",".join(f"{c}=excluded.{c}" for c in cols if c not in keys)
        sql(f"insert into {table} ({','.join(cols)}) values {','.join(vals)} on conflict ({','.join(keys)}) do update set {sets}", params)
        return len(part)
    parts = [rows[i:i + chunk] for i in range(0, len(rows), chunk)]
    done, t = 0, time.time()
    with cf.ThreadPoolExecutor(6) as ex:
        for n in ex.map(one, parts):
            done += n
            if done % (chunk * 20) < chunk or done == len(rows):
                print(f"  {table}: {done}/{len(rows)} ({done / (time.time() - t):.0f}/s)", flush=True)


def image_key(p, color=None):
    return f"{p['shape']}-{p['style']}-{slug(color or (p['colors'][0] if p['colors'] else 'Slate Grey'))}"


def main():
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    for stmt in [s for s in SCHEMA.split(";") if s.strip()]:
        sql(stmt)
    if "--schema-only" in sys.argv:
        return
    want = lambda t: only is None or t in only  # noqa: E731
    if want("departments"):
        depts = json.load(open(CAT / "departments.json"))
        upsert("shop_departments", ["slug", "name", "position", "categories"],
               [{"slug": d["slug"], "name": d["name"], "position": i, "categories": d["categories"]} for i, d in enumerate(depts)], "slug", 50)
    if want("products"):
        rows = []
        for line in open(CAT / "products.jsonl"):
            p = json.loads(line)
            p["image"] = image_key(p)
            p["search_extra"] = " ".join(p["tags"] + p["colors"] + p["sizes"] + [s["value"] for s in p["specs"]] + [p["dept"]])
            rows.append(p)
        cols = ["id", "slug", "title", "brand", "dept", "dept_slug", "category", "cat_slug", "kind", "noun", "audience", "tags", "price", "max_price",
                "list_price", "deal_ends", "rating", "review_count", "question_count", "in_stock", "colors", "sizes", "description", "bullets", "specs",
                "image", "popularity", "created", "search_extra"]
        upsert("shop_products", cols, rows, "id", 250)
    for table, f, cols, key, chunk in [
        ("shop_variants", "variants", ["sku", "product_id", "color", "size", "price", "stock"], "sku", 1500),
        ("shop_reviews", "reviews", ["id", "product_id", "stars", "title", "body", "author", "location", "date", "helpful", "variant"], "id", 800),
        ("shop_questions", "questions", ["id", "product_id", "question", "answer", "answered_by", "votes", "date"], "id", 1200),
    ]:
        if want(f):
            upsert(table, cols, [json.loads(l) for l in open(CAT / f"{f}.jsonl")], key, chunk)
    sql("analyze shop_products; analyze shop_variants; analyze shop_reviews; analyze shop_questions")
    n = sql("select (select count(*) from shop_products) p, (select count(*) from shop_variants) v, (select count(*) from shop_reviews) r, (select count(*) from shop_questions) q")["rows"][0]
    print("Octo:", n)


if __name__ == "__main__":
    main()
