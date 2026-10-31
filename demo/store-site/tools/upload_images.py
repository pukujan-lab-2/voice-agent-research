"""Put every product image (build/images/*.svg) in Octo files and record key -> file id in shop_images.
Stored as plain bytes (application/octet-stream, contentType in metadata) so Octo doesn't index them; the site's
/img/<key>.svg route reads them back from Octo. Resumable: keys already in shop_images are skipped.
"""
import concurrent.futures as cf, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from octo import sql, upload  # noqa: E402

IMG = pathlib.Path(__file__).resolve().parent.parent / "build" / "images"


def main():
    sql("create table if not exists shop_images (key text primary key, file_id text not null, bytes int not null)")
    have = {r["key"] for r in sql("select key from shop_images")["rows"]}
    todo = [p for p in sorted(IMG.glob("*.svg")) if p.stem not in have]
    print(f"{len(have)} in Octo, {len(todo)} to upload", flush=True)

    def one(p):
        data = p.read_bytes()
        r = upload(f"shop-img-{p.name}", data, "application/octet-stream", {"contentType": "image/svg+xml", "key": p.stem, "source": "Brambleway demo (original)"})
        sql("insert into shop_images (key, file_id, bytes) values ($1, $2, $3) on conflict (key) do update set file_id = excluded.file_id, bytes = excluded.bytes",
            [p.stem, r["id"], len(data)])
        return p.stem
    n = 0
    with cf.ThreadPoolExecutor(8) as ex:
        for _ in ex.map(one, todo):
            n += 1
            if n % 250 == 0:
                print(f"  {n}/{len(todo)}", flush=True)
    print("done", sql("select count(*) n from shop_images")["rows"][0])


if __name__ == "__main__":
    main()
