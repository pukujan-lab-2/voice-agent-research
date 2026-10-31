"""Brambleway's help centre: the only source the copilot answers shipping, returns and order questions from.

Written for this demo (fictional policies of a fictional store). The checkout's shipping options and the order and
returns pages use the same numbers (api.ts reads SHIPPING from the shop_help_facts row this writes), so an answer and
the page never disagree. Each paragraph is one passage (shop_help_passages) with its article and section anchor, so a
citation links to the exact spot: /help/<slug>#<anchor>.
Usage: python3 tools/help.py   (writes shop_help, shop_help_passages, shop_help_facts in Octo)
"""
import json, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from octo import sql  # noqa: E402

SHIPPING = [
    {"id": "standard", "label": "Standard", "days": "4–6 business days", "min_days": 4, "max_days": 6, "price": 5.99, "free_over": 35},
    {"id": "expedited", "label": "Expedited", "days": "2–3 business days", "min_days": 2, "max_days": 3, "price": 9.99, "free_over": None},
    {"id": "nextday", "label": "Next business day", "days": "1 business day (order by 2 pm)", "min_days": 1, "max_days": 1, "price": 19.99, "free_over": None},
]
RETURN_DAYS = 30

A = [
    ("Shipping & delivery", "shipping-options", "Shipping options and costs", "Standard, Expedited and Next business day: what each costs and how long it takes.", [
        ("Options at checkout", ["Brambleway offers three delivery speeds at checkout. Standard shipping takes 4–6 business days and costs $5.99. Standard shipping is free on orders of $35 or more (the subtotal after discounts, before tax).",
                                 "Expedited shipping takes 2–3 business days and costs $9.99 on any order size.",
                                 "Next business day delivery costs $19.99. Order by 2 pm in your local time zone, Monday to Friday, and it arrives the next business day. Orders placed after 2 pm, or on a weekend, ship the following business day."]),
        ("Where we deliver", ["We deliver to street addresses in the United States and Canada. Next business day delivery is available to the contiguous United States only, and not to PO boxes.",
                              "We can't deliver to freight forwarders or to addresses outside the United States and Canada."]),
        ("Large and heavy items", ["Furniture, cardio machines, televisions 55 inches and larger and patio sets ship by freight. Freight delivery takes 5–10 business days and costs $49, or nothing on orders over $499. The carrier calls you to book a two-hour delivery window. Freight items can't ship Expedited or Next business day."]),
    ]),
    ("Shipping & delivery", "delivery-times", "When will my order arrive?", "How delivery dates are worked out and what can delay them.", [
        ("Delivery estimates", ["The delivery date shown at checkout counts business days (Monday to Friday, not public holidays) from the day your order ships. Most orders ship the same business day if placed before 2 pm, otherwise the next business day.",
                                "If an order has items from more than one warehouse, it may arrive in more than one box on different days. Each box has its own tracking number."]),
        ("Holidays and peak season", ["Between November 20 and December 31 deliveries can take one or two extra business days. To get an order before December 25, place it by December 18 with Standard shipping, December 21 with Expedited, or December 23 with Next business day."]),
        ("Weather and carrier delays", ["Severe weather or carrier problems can delay a delivery. If your package is more than 3 business days later than its estimate, contact us and we'll refund the shipping charge."]),
    ]),
    ("Orders", "track-order", "Tracking your order", "Where to find tracking and what each status means.", [
        ("Where to find tracking", ["Open Account, then Orders, and choose the order. Each order shows its status, the tracking number for each box, and the delivery estimate. We also email you when the order ships."]),
        ("What the statuses mean", ["Placed: we've received your order. Packed: it's boxed at the warehouse and can no longer be changed. Shipped: the carrier has it. Out for delivery: it arrives today. Delivered: the carrier marked it delivered.",
                                    "Tracking can take up to 24 hours to update after an order ships."]),
        ("Delivered but not received", ["If tracking says delivered but you can't find the package, check around your entrance and with neighbours, and wait 48 hours, because carriers sometimes mark a package delivered early. If it still hasn't turned up, contact us and we'll send a replacement or a refund."]),
    ]),
    ("Orders", "change-cancel", "Changing or cancelling an order", "How long you have to change an address or cancel.", [
        ("Cancelling", ["You can cancel an order from Account, Orders while its status is Placed, usually for about 30 minutes after ordering. Once it's Packed it can't be cancelled, but you can return it when it arrives."]),
        ("Changing the address or items", ["You can change the delivery address while an order is Placed. To add or remove items, cancel the order and place a new one. After an order ships, the carrier may be able to redirect it; contact us with the order number."]),
    ]),
    ("Returns & refunds", "returns-policy", "Returns policy", "30 days to return most items, free drop-off returns, and what can't be returned.", [
        ("How long you have", ["You can return most items within 30 days of delivery for a full refund. Items must be unused, in their original condition, with all accessories, manuals and packaging.",
                               "Holiday returns: anything delivered between November 1 and December 24 can be returned until January 31."]),
        ("How to return", ["Start a return from Account, Orders: choose the order, the items and a reason. You'll get a QR code for a free drop-off at a carrier location, or you can choose a prepaid mail-in label. The mail-in label costs $4.99, taken from your refund, unless the item arrived damaged, defective or wrong."]),
        ("Items that can't be returned", ["Some items can't be returned: opened beauty and personal care products, opened earbuds and in-ear headphones, personalised items, gift cards, and underwear or swimwear without their hygiene liner. These can still be returned if they arrive damaged or defective."]),
        ("Electronics", ["Electronics such as phones, laptops, tablets, cameras and watches can be returned within 30 days. They must be reset to factory settings with any accounts removed, and come back with every accessory in the box."]),
    ]),
    ("Returns & refunds", "refunds", "Refunds", "When your refund arrives and how it's paid.", [
        ("When you get your refund", ["We refund within 3–5 business days of receiving your return at our warehouse. Your bank may take a few more days to show it. You'll get an email when the refund is issued."]),
        ("What's refunded", ["We refund the item price and the tax charged on it. Original shipping is refunded only if the item arrived damaged, defective or wrong. If you used a mail-in label, $4.99 is taken from the refund unless the return was our mistake."]),
        ("Price drops", ["If the price of an item you bought drops within 14 days of delivery, contact us and we'll refund the difference once per item. This doesn't apply to lightning deals or to items bought during a sale that ended."]),
    ]),
    ("Returns & refunds", "exchanges", "Exchanges for a different size or colour", "Swap clothing and shoes for a different size or colour at no cost.", [
        ("How exchanges work", ["Clothing, shoes and bedding can be exchanged for a different size or colour of the same item within 30 days of delivery, at no cost. Start an exchange from Account, Orders and choose Exchange. We ship the new size as soon as your drop-off is scanned, with free Standard shipping.",
                                "If the size or colour you want is out of stock, we'll refund the item instead."]),
        ("Choosing the right size", ["Each clothing and shoe page shows a fit note from customer reviews, such as runs small or true to size. If an item runs small, we suggest ordering one size up."]),
    ]),
    ("Returns & refunds", "damaged-items", "Damaged, defective or wrong items", "Report a problem within 7 days for a free replacement or refund.", [
        ("Report it within 7 days", ["If an item arrives damaged, defective or isn't what you ordered, report it within 7 days of delivery from Account, Orders, with a photo. We'll send a free replacement or a full refund including shipping, and the return label is free."]),
        ("Problems after 7 days", ["If an item stops working because of a manufacturing defect after that, it's covered by the Brambleway one-year guarantee."]),
    ]),
    ("Returns & refunds", "guarantee", "Brambleway one-year guarantee", "Every product is guaranteed against manufacturing defects for a year.", [
        ("What's covered", ["Every product sold by Brambleway is guaranteed against defects in materials and workmanship for one year from delivery. We'll repair, replace or refund it. Some products also carry a longer manufacturer warranty, shown in the product's specs."]),
        ("What isn't covered", ["Normal wear and tear, accidental damage, misuse and changes or repairs made by someone else aren't covered."]),
    ]),
    ("Payments & pricing", "payment-methods", "Payment methods", "How payment works on this demo store.", [
        ("Accepted payment methods", ["The only payment method on this demo store is Demo payment: Brambleway doesn't accept cards, PayPal, gift cards or any other real payment, and checkout never asks for card details."]),
        ("Demo payment only", ["Brambleway is a fictional demo store. Checkout uses a demo payment step: no card details are asked for, nothing is charged, and nothing is shipped. The order is saved so you can see the order history, tracking and returns pages."]),
        ("When you're charged", ["In this demo nothing is charged. The order total shown at review is what a real order would cost: items, shipping and estimated sales tax."]),
    ]),
    ("Payments & pricing", "sales-tax", "Sales tax", "How tax is worked out at checkout.", [
        ("Estimated tax", ["Sales tax is estimated at checkout from the delivery address and shown on the order review. In this demo it's a flat 8% of the item subtotal, as an example. Shipping charges aren't taxed in the demo."]),
    ]),
    ("Payments & pricing", "deals-coupons", "Deals and promo codes", "How deals, lightning deals and promo codes work.", [
        ("Deals", ["Items on a deal show the was-price crossed out and the percentage saved. A deal ends at midnight Pacific time on the date shown on the product page, or earlier if the deal's stock sells out."]),
        ("Promo codes", ["You can use one promo code per order, entered on the order review. Promo codes can't be combined with each other or exchanged for cash. This demo store has no live promo codes."]),
    ]),
    ("Payments & pricing", "price-match", "Price matching", "We don't match other stores' prices.", [
        ("Our price policy", ["Brambleway doesn't match prices from other stores. If our own price drops within 14 days of delivery, see Refunds, price drops."]),
    ]),
    ("Gifts", "gift-options", "Gift wrap and gift receipts", "Add gift wrap, a message, or a gift receipt that hides prices.", [
        ("Gift wrap", ["Gift wrap costs $4.99 per item and includes a printed message of up to 200 characters. Choose it on the order review. Freight items can't be gift wrapped."]),
        ("Gift receipts", ["A gift receipt shows the items but not the prices. The person you're giving to can use it to exchange an item or return it for a Brambleway gift card."]),
        ("Shipping to someone else", ["You can ship to any address in the United States or Canada; enter the recipient's name and address at checkout."]),
    ]),
    ("Gifts", "gift-ideas", "Gift ideas by interest", "Browse gifts under $50, under $100 and by hobby.", [
        ("Finding a gift", ["Every product tagged as a gift idea is under $200. On the search page, use the Gift ideas filter, set a price range, and filter by interest such as hiking, cooking, gaming or reading. The copilot can do this for you: tell it who the gift is for, what they like and your budget."]),
    ]),
    ("Account", "account-guest", "Accounts and guest checkout", "You don't need an account to order on this demo.", [
        ("Guest checkout", ["You can check out as a guest. This demo keeps your cart, wishlist and orders for your browser session only, and nothing personal is sent anywhere."]),
        ("Your account pages", ["Account shows your orders, returns, saved addresses and wishlist."]),
    ]),
    ("Account", "wishlist", "Wishlists", "Save items for later and share a list.", [
        ("Saving items", ["Select the heart on any product to save it to your wishlist. Prices on your wishlist update automatically, and items that go on a deal are marked."]),
    ]),
    ("Products", "stock-availability", "Stock and availability", "What in stock, low stock and out of stock mean.", [
        ("Stock levels", ["Product pages show stock for the size and colour you've chosen. Only a few left means 5 or fewer. Out of stock items can be saved to your wishlist."]),
        ("Order limits", ["You can buy up to 10 of any one item per order."]),
    ]),
    ("Products", "reviews-qa", "Reviews and questions", "About the reviews and Q&A on product pages.", [
        ("Demo reviews", ["All reviews and answers on this demo store are fictional and generated for the demo. They're labelled as demo reviews on every product page. Star ratings are the average of the reviews shown."]),
    ]),
    ("Products", "size-guide", "Size guide", "How our clothing and shoe sizes work.", [
        ("Clothing", ["Clothing comes in XS to XXL. As a guide, a chest of 36–38 inches is a medium and 40–42 inches is a large. Check the fit note on each product."]),
        ("Shoes", ["Shoes are in US sizes, 6 to 13 for adults, including half sizes up to 10.5. Kids' shoes run from 10C (little kids) to 4Y (big kids)."]),
    ]),
    ("Using the copilot", "copilot", "Shopping with the voice copilot", "What the copilot does and doesn't do.", [
        ("What it does", ["The copilot can search the store, ask what you're looking for, narrow results with filters, compare products, read specs and reviews, add items to your cart and fill in the checkout form. It reads back every value it fills in and waits for your yes."]),
        ("What it never does", ["The copilot never places an order, never pays and never submits a form. You press Place order yourself. It answers shipping, returns and order questions only from this help centre, and tells you which article it used."]),
    ]),
    ("Privacy", "privacy", "Privacy on this demo", "What this demo stores.", [
        ("What we keep", ["This demo stores your cart, wishlist and demo orders under a random id kept in your browser. Addresses you type at checkout are saved with the demo order only. Clearing your browser data starts a fresh session."]),
    ]),
]


def anchor(h):
    return re.sub(r"[^a-z0-9]+", "-", h.lower()).strip("-")


def main():
    sql("""create table if not exists shop_help (slug text primary key, title text not null, section text not null, summary text not null, body jsonb not null, position int not null)""")
    sql("""create table if not exists shop_help_passages (id text primary key, slug text not null, seq int not null, heading text not null, anchor text not null, text text not null,
      tsv tsvector generated always as (setweight(to_tsvector('english', heading), 'A') || setweight(to_tsvector('english', text), 'B')) stored)""")
    sql("create index if not exists shop_help_passages_tsv on shop_help_passages using gin (tsv)")
    sql("create table if not exists shop_help_facts (key text primary key, value jsonb not null)")
    sql("delete from shop_help_passages")
    for i, (section, slug, title, summary, parts) in enumerate(A):
        body = [{"heading": h, "anchor": anchor(h), "paragraphs": ps} for h, ps in parts]
        sql("insert into shop_help (slug, title, section, summary, body, position) values ($1,$2,$3,$4,$5::jsonb,$6) on conflict (slug) do update set title=excluded.title, section=excluded.section, summary=excluded.summary, body=excluded.body, position=excluded.position",
            [slug, title, section, summary, json.dumps(body), i])
        seq = 0
        for h, ps in parts:
            for p in ps:
                seq += 1
                sql("insert into shop_help_passages (id, slug, seq, heading, anchor, text) values ($1,$2,$3,$4,$5,$6)", [f"help/{slug}#{seq}", slug, seq, f"{title}: {h}", anchor(h), p])
    sql("insert into shop_help_facts (key, value) values ('shipping', $1::jsonb), ('return_days', $2::jsonb) on conflict (key) do update set value = excluded.value",
        [json.dumps(SHIPPING), json.dumps(RETURN_DAYS)])
    print(sql("select (select count(*) from shop_help) a, (select count(*) from shop_help_passages) p")["rows"][0])


if __name__ == "__main__":
    main()
