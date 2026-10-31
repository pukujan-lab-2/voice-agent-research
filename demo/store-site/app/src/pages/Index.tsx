import { useEffect, useState } from "react";

const shopper =
  localStorage.getItem("bw-shopper") || crypto.randomUUID();
localStorage.setItem("bw-shopper", shopper);

const paths = [
  "/api/shop/departments",
  "/api/shop/home",
  "/api/shop/search?q=hiking+boats",
  "/api/shop/search?q=hiking+boots&per=2",
  "/api/shop/suggest?q=hik",
  "/api/shop/shipping",
  "/api/shop/cart",
  "/api/shop/orders",
  "/api/shop/account",
  "/api/shop/wishlist",
  "/api/shop/returns",
  "/api/shop/help",
];

const Probe = () => {
  const [log, setLog] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const out: string[] = [];
      for (const p of paths) {
        try {
          const r = await fetch(p, { headers: { "X-Shopper": shopper } });
          const t = await r.text();
          out.push(`== ${p} :: ${r.status} :: ${t.slice(0, 1800)}`);
        } catch (e) {
          out.push(`== ${p} :: ERR ${String(e)}`);
        }
      }
      // product + reviews from a search result id
      try {
        const r = await fetch("/api/shop/search?q=hiking+boots&per=1", {
          headers: { "X-Shopper": shopper },
        });
        const j = await r.json();
        const id = j.items?.[0]?.id;
        out.push(`== first id ${id}`);
        for (const p of [
          `/api/shop/product/${id}`,
          `/api/shop/product/${id}/reviews`,
          `/api/shop/product/${id}/questions`,
          `/api/shop/compare?ids=${id}`,
          `/api/shop/help/${"shipping-and-delivery"}`,
          `/api/shop/help-search?q=return`,
        ]) {
          const rr = await fetch(p, { headers: { "X-Shopper": shopper } });
          const tt = await rr.text();
          out.push(`== ${p} :: ${rr.status} :: ${tt.slice(0, 1800)}`);
        }
      } catch (e) {
        out.push(`== product probe ERR ${String(e)}`);
      }
      for (const line of out) console.log("PROBE " + line);
      setLog(out);
    })();
  }, []);
  return (
    <pre style={{ whiteSpace: "pre-wrap", fontSize: 10 }}>
      {log.join("\n\n")}
    </pre>
  );
};

export default Probe;
