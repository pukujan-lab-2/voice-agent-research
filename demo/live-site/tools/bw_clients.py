"""Brindlewick's fictional client list, for the caller-verification demo: about 500 made-up clients written with Faker
(MIT), each with a made-up return status, into two tables in the Octo workspace's own Postgres:

  bw_clients   id, full name, date of birth, SSN, last four, zip, phone, email; every row has sample = true
  bw_returns   one row per client: tax year, status, what happens next, the preparer (all fictional)

No real person can match: every SSN is in a range the SSA has never issued (area 900-999, 000 or 666), every phone is
a 555-01xx number and every email is at example.com. On purpose, some clients share a name: 10 pairs share only the
name, 3 pairs also the date of birth, and 2 pairs the name, date of birth and last four (only the zip tells them apart).
Deterministic (seeded), and re-running replaces the rows. Usage:
  uv run --with faker==33.1.0 python tools/bw_clients.py
"""
import datetime as dt, json, pathlib, random, sys, unicodedata, urllib.request

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE.parent.parent / "copilot-engine" / "tools"))
import paddle_passages as pp  # noqa: E402  (reads the Octo key/workspace from ~/Documents/projects/.env, never printed)
from faker import Faker  # noqa: E402

BASE = "https://octodb.design-bakery.com/api"
N = 500

SCHEMA = """
create table if not exists bw_clients (
  id text primary key, full_name text not null, first_name text not null, last_name text not null,
  dob date not null, ssn text not null unique, ssn4 text not null, zip text not null, phone text not null, email text not null,
  sample boolean not null default true);
create index if not exists bw_clients_exact on bw_clients (dob, ssn4, zip);
create table if not exists bw_returns (
  client_id text primary key references bw_clients(id) on delete cascade, tax_year int not null, status text not null,
  updated date not null, next_step text not null, preparer text not null, amount text);
"""

STATUSES = [
    ("Accepted by the IRS", "Your refund should arrive within 21 days of acceptance.", "refund"),
    ("Filed, waiting for IRS acceptance", "The IRS usually accepts or rejects an e-filed return within 48 hours.", "refund"),
    ("In preparation", "We're waiting for your Form 1099-B from your broker. Upload it in the client portal when it comes.", None),
    ("Ready for your signature", "Sign Form 8879 so we can e-file. Your preparer has sent it to you.", "due"),
    ("Extension filed", "Your return is due October 15. Your preparer will be in touch in August.", None),
    ("Refund sent", "The IRS sent your refund. Allow five business days for the deposit.", "refund"),
]
PREPARERS = ["Odile Marchetti, EA", "Tobias Wren, CPA", "Priyanka Halloran, EA", "Desmond Achterberg, CPA"]


def octo(path, body):
    e = pp.env()
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + e["octo_db_chatbots"], "Content-Type": "application/json", "User-Agent": "chatbots-rag/0.1"})
    return json.load(urllib.request.urlopen(req, timeout=120))


def sql(text, params=None):
    return octo(f"/workspaces/{pp.env()['octo_db_chatbots_workspace']}/query", {"sql": text, **({"params": params} if params else {})})


def ascii_(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def main():
    fake = Faker(["en_US", "es_MX", "en_IN", "en_GB"])
    Faker.seed(20261031)
    rnd = random.Random(20261031)
    used_ssn = set()

    def ssn():
        while True:
            area = rnd.choice([rnd.randint(900, 999), 0, 666])
            s = f"{area:03d}-{rnd.randint(1, 99):02d}-{rnd.randint(1, 9999):04d}"
            if s not in used_ssn:
                used_ssn.add(s)
                return s

    def person(first=None, last=None, dob=None, last4=None):
        first = first or ascii_(fake.first_name())
        last = last or ascii_(fake.last_name())
        s = ssn()
        if last4:
            s = s[:-4] + last4
            used_ssn.add(s)
        dob = dob or fake.date_of_birth(minimum_age=19, maximum_age=88)
        tag = rnd.randint(10, 99)
        return {"first_name": first, "last_name": last, "full_name": f"{first} {last}", "dob": dob.isoformat(), "ssn": s, "ssn4": s[-4:],
                "zip": f"{rnd.randint(1001, 99950):05d}", "phone": f"555-01{rnd.randint(0, 99):02d}",
                "email": f"{first.lower()}.{last.lower()}{tag}@example.com".replace(" ", "").replace("'", "")}

    people = [person() for _ in range(N - 30)]
    for _ in range(10):  # same name only
        a = person(); people += [a, person(a["first_name"], a["last_name"])]
    for _ in range(3):   # same name and date of birth
        a = person(); people += [a, person(a["first_name"], a["last_name"], dt.date.fromisoformat(a["dob"]))]
    for _ in range(2):   # same name, date of birth and last four: only the zip differs
        a = person()
        b = person(a["first_name"], a["last_name"], dt.date.fromisoformat(a["dob"]), a["ssn4"])
        people += [a, b]
    for i, p in enumerate(people):
        p["id"] = f"BW-{10001 + i}"
    returns = []
    for p in people:
        st, nxt, kind = rnd.choice(STATUSES)
        amt = f"${rnd.randint(80, 6400):,}" if kind else None
        returns.append({"client_id": p["id"], "tax_year": 2025, "status": st, "updated": (dt.date(2026, 3, 1) + dt.timedelta(days=rnd.randint(0, 200))).isoformat(),
                        "next_step": nxt, "preparer": rnd.choice(PREPARERS), "amount": (f"Refund {amt}" if kind == "refund" else f"Balance due {amt}") if amt else None})

    assert all(int(p["ssn"][:3]) >= 900 or p["ssn"][:3] in ("000", "666") for p in people)
    for stmt in SCHEMA.split(";"):
        if stmt.strip():
            sql(stmt)
    sql("delete from bw_clients")
    cols = "id, full_name, first_name, last_name, dob, ssn, ssn4, zip, phone, email"
    sql(f"insert into bw_clients ({cols}) select {cols} from json_populate_recordset(null::bw_clients, $1::json)", [json.dumps(people)])
    sql("insert into bw_returns select * from json_populate_recordset(null::bw_returns, $1::json)", [json.dumps(returns)])
    n = sql("select count(*)::int as n, count(distinct full_name)::int as names, sum((ssn ~ '^(9|000|666)')::int)::int as unissued from bw_clients")["rows"][0]
    print(f"bw_clients: {n['n']} rows, {n['names']} distinct names, {n['unissued']} with never-issued SSN areas; bw_returns: {len(returns)} rows")


if __name__ == "__main__":
    main()
