from site_ingest import cli


def test_cli_loads_a_sitemap_and_a_folder_and_prints_the_count(site, octo, tmp_path, monkeypatch, capsys):
    (tmp_path / "guide.md").write_text("# Guide\n\nPlug the base into the wall and wait until the green light stays on, which takes about two minutes.")
    monkeypatch.setattr(cli.Octo, "from_env", classmethod(lambda cls, k, w: octo))
    code = cli.main(["--business", "acme", "--sitemap", site.base + "/sitemap.xml", "--docs", str(tmp_path), "--page-type", "/shipping=product"])
    out = capsys.readouterr().out
    assert code == 0 and "discovered 5: 5 new" in out and "indexed now: 5 pages" in out
    assert octo.sql("select page_type from site_passages where url like '%/shipping'")["rows"][0]["page_type"] == "product"


def test_cli_needs_a_source_and_a_valid_business(capsys):
    import pytest
    with pytest.raises(SystemExit):
        cli.main(["--business", "acme"])
    with pytest.raises(ValueError):
        cli.main(["--business", "irs", "--docs", "."])
