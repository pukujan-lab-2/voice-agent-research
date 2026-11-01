# Record lookups a business declares

A visitor asks "where is order A-1001?", "when is my next appointment?" or "how much is the blue widget?". These are not
passages on a web page. They are rows in the business's own Octo tables. The copilot answers them through **declared
lookups**: the business says which questions the copilot may answer, and code runs exactly those. (Prose on the site is
searched instead; see [ingest.md](ingest.md) and [retrieval-limits.md](retrieval-limits.md).)

## What the model can and cannot do

- It sees one tool per declared lookup (`lookup_order_status`, ...) with typed parameters. It supplies values only.
- It never writes SQL, a table name, a column or a filter. Every value is checked against its declared type (a pattern, a
  number range, a date, a list of allowed words) before anything runs, then bound as a `$n` parameter of a statement built
  only from the declaration. The statement text is the same for every call (a test checks this).
- It never decides who the caller is. The host passes a `caller` function (verified or not, and the client id);
  a lookup about a person returns only that client's own rows.
- It does not word the answer. Code composes the sentence from the declared fields (`say`, or `label: value` pairs).

## Declaring lookups

```ts
{
  business: 'acme',
  businessColumn: 'business_id',   // optional: when tables are shared, code always adds "and business_id = 'acme'"
  lookups: [
    { id: 'order_status', description: 'Status of an order by its number.', table: 'orders',
      about: 'person', ownerColumn: 'customer_id',           // only the verified caller's own orders
      params: [{ name: 'order_number', column: 'order_number', type: 'string', pattern: '[A-Za-z0-9-]{4,16}', upper: true }],
      fields: [{ column: 'status', label: 'Status' }, { column: 'eta', label: 'Expected' }],   // the only columns that can be read out
      say: 'Order {Status}, expected {Expected}.' },
    { id: 'price', description: 'Price of a product by name.', table: 'prices', about: 'none',
      params: [{ name: 'product', column: 'name', type: 'string' }], fields: [{ column: 'price', label: 'Price' }] },
  ],
}
```

Parameter types: `string` (optional `pattern`, `upper`), `integer`, `number` (optional `min`, `max`), `date` (YYYY-MM-DD),
`enum` (`values`). Each parameter is compared for equality with its `column`. Up to 12 fields and 5 rows per lookup.
`validate()` runs when the declarations are loaded and rejects a bad table or column name, a person lookup with no
`ownerColumn`, a repeated id or label, a bad pattern, and a risk below the person default.

## Risk (decision 0011)

Each lookup has a score from 1 to 100. Default: 5 for a public lookup (price), 45 for one about a person. The business may
raise it; a person lookup cannot score below 45.

| Score | What code does |
|---|---|
| under 56 | Runs, once the declaration's checks pass. |
| 56 to 90 | Asks "Shall I look that up for you?" and runs it only after the caller's recorded yes (the yes runs it directly, with no model call). |
| 91 and up | Never runs; the copilot offers to pass the caller to a person. |
| any score, about a person | Needs a verified caller first. A yes does not stand in for verification. |

## Wiring

`new Desk(flow, { lookups: new Lookups(spec, sql), caller: () => ({ verified, clientId }) })`, where `sql` runs
`{ text, params }` against the business's Octo workspace (`OctoHttp.sql` in `site-search.ts`). Storing the declarations per
business is the per-business config work (#28); until then a host builds them in code.

## Limits

- Equality matches only; no ranges, joins or free text search over records. A lookup is one table.
- Read only. Nothing here writes.
- Verified against SQLite in tests (real parameter binding) and Octo's SQL surface by the evals, not against Postgres in CI.
