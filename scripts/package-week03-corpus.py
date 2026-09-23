#!/usr/bin/env python3
"""Validate the reviewed corpus and optionally create a deterministic ZIP (stdlib only)."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import zipfile
from forum_content_review import validate_review

DEFAULT = Path(__file__).resolve().parents[1] / "data/week03/cross-domain"
LIMIT = 100_000_000


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_file(path):
    return json.loads(path.read_text(encoding="utf-8"))


def json_lines(path):
    return [json.loads(x) for x in path.read_text(encoding="utf-8").split("\n") if x.strip()]


def safe_file(root, name):
    relative = Path(name)
    assert not relative.is_absolute() and ".." not in relative.parts, name
    path = root / relative
    assert path.is_file() and not path.is_symlink(), name
    assert path.resolve().is_relative_to(root.resolve()), name
    return path


def validate(root, check_manifest=True):
    sources = json_file(root / "sources.json")
    summary = json_file(root / "audit/summary.json")
    accepted = [s for s in sources if s["decision"] == "include"]
    assert len({s["source_id"] for s in sources}) == len(sources)
    assert len(accepted) == summary["included_sources"]
    expected = {"README.md", "sources.json", "audit/input-records.jsonl",
                "audit/retrieval.json", "audit/summary.json", "audit/forum-content-review.json"}
    validate_review(root)
    ids, count, pages = set(), 0, 0
    raw_cache = {}
    for s in accepted:
        sid = s["source_id"]
        assert s["license"] in {"CC-BY-3.0", "CC-BY-4.0", "CC-BY-NC-SA-4.0", "PG-US-PUBLIC-DOMAIN"}
        for key in ["raw_file", "text_file", "chunk_file", "license_file"]:
            safe_file(root, s[key])
            expected.add(s[key])
        raw = safe_file(root, s["raw_file"])
        assert sha(raw.read_bytes()) == s["raw_sha256"], sid
        assert sha(safe_file(root, s["text_file"]).read_bytes()) == s["text_sha256"], sid
        text = safe_file(root, s["text_file"]).read_text(encoding="utf-8")
        rows = json_lines(safe_file(root, s["chunk_file"]))
        assert len(rows) == s["chunk_count"] == summary["included_per_source"][sid]
        end = 0
        if s["raw_file"].endswith(".pdf"):
            assert raw.read_bytes().startswith(b"%PDF-")
            pages += s["pdf_pages"]
        else:
            raw_cache[sid] = raw.read_text(encoding="utf-8-sig")
            assert "*** START OF THE PROJECT GUTENBERG" in raw_cache[sid]
            assert "FULL PROJECT GUTENBERG LICENSE" in raw_cache[sid].upper()
        for r in rows:
            assert isinstance(r["id"], str) and r["id"] not in ids, r["id"]
            ids.add(r["id"])
            assert isinstance(r["text"], str) and r["text"].strip()
            assert r["source_id"] == sid and r["source_url"] == s["source_url"]
            assert r["license"] == s["license"] and r["license_url"] == s["license_url"]
            assert r["raw_file"] == s["raw_file"] and r["text_file"] == s["text_file"]
            assert r["title"] and r["author"] and r["locator"] and r["status"]
            start, stop = r["start_char"], r["end_char"]
            assert isinstance(start, int) and isinstance(stop, int) and end <= start < stop <= len(text)
            assert not text[end:start].strip(), (sid, "uncovered text")
            assert text[start:stop] == r["text"], r["id"]
            end = stop
            assert "vector" not in r, "Do not import stale vectors for a new corpus"
            if sid in raw_cache:
                assert raw_cache[sid][r["raw_start_char"]:r["raw_end_char"]] == r["text"]
            else:
                assert 1 <= r["pdf_page"] <= s["pdf_pages"]
                assert r["locator"] == f'PDF page {r["pdf_page"]}'
                page_markers = list(re.finditer(r"\n\n\[PDF page (\d+)\]\n\n", text))
                page_start = page_markers[r["pdf_page"] - 1].start()
                page_end = page_markers[r["pdf_page"]].start() if r["pdf_page"] < len(page_markers) else len(text)
                assert page_start <= start < stop <= page_end
        assert not text[end:].strip(), (sid, "uncovered tail")
        if sid == "B01":
            assert {r["locator"] for r in rows} == {f"Book {x}" for x in ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]}
            assert all(r["role"] == "translated_dialogue" for r in rows)
        if sid == "B01-INTRO":
            assert all(r["role"] == "translator_introduction" for r in rows)
        count += len(rows)
    assert count == summary["included_records"] and pages == summary["included_pdf_pages"]
    audit = json_lines(root / "audit/input-records.jsonl")
    assert len(audit) == summary["input_records_audited"] == 5876
    assert len({r["id"] for r in audit}) == len(audit)
    assert dict(Counter(r["decision"] for r in audit)) == summary["input_decisions"]
    decisions = {s["source_id"]: s["decision"] for s in sources}
    for r in audit:
        assert r["decision"] == decisions[r["source_id"]]
        assert re.fullmatch(r"[0-9a-f]{64}", r["text_sha256"])
        assert "text" not in r and "title" not in r, "Rejected fulltext must not enter audit metadata"
        assert r.get("text_offsets_match") or r.get("snapshot_content_and_identity_match")
    actual = {str(p.relative_to(root)) for p in root.rglob("*") if p.is_file()}
    assert not any(p.is_symlink() for p in root.rglob("*")), "Symlinks are not distributable inputs"
    assert actual - {"manifest.json"} == expected, (actual - expected, expected - actual)
    total = sum(safe_file(root, f).stat().st_size for f in actual)
    assert total < LIMIT, f"Corpus exceeds {LIMIT} bytes"
    if check_manifest:
        manifest = json_file(root / "manifest.json")
        assert manifest["files"].keys() == expected
        for f, meta in manifest["files"].items():
            data = safe_file(root, f).read_bytes()
            assert len(data) == meta["bytes"] and sha(data) == meta["sha256"], f
        assert manifest["included_records"] == count
        assert manifest["payload_bytes"] == sum(m["bytes"] for m in manifest["files"].values())
    return dict(files=len(actual), uncompressed_bytes=total, included_records=count,
                sources=len(accepted), pdf_pages=pages), expected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT)
    parser.add_argument("--seal", action="store_true", help="Write manifest after structural checks; review changes before committing")
    parser.add_argument("--zip", type=Path, help="Output ZIP outside the corpus directory")
    args = parser.parse_args()
    if args.seal:
        result, paths = validate(args.root, check_manifest=False)
        files = {p: dict(bytes=safe_file(args.root, p).stat().st_size,
                         sha256=sha(safe_file(args.root, p).read_bytes())) for p in sorted(paths)}
        manifest = dict(schema_version=1, corpus="week03-cross-domain-20260923", limit_bytes=LIMIT,
                        included_records=result["included_records"], payload_bytes=sum(x["bytes"] for x in files.values()),
                        files=files)
        (args.root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    result, paths = validate(args.root)
    if args.zip:
        assert not args.zip.resolve().is_relative_to(args.root.resolve())
        args.zip.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(args.zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for name in sorted(paths | {"manifest.json"}):
                info = zipfile.ZipInfo("week03-cross-domain/"+name, (2026, 9, 23, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, safe_file(args.root, name).read_bytes(), compresslevel=6)
        with zipfile.ZipFile(args.zip) as archive:
            assert archive.testzip() is None
            assert len(archive.namelist()) == len(paths) + 1
            for name in paths | {"manifest.json"}:
                assert archive.read("week03-cross-domain/"+name) == safe_file(args.root, name).read_bytes()
        result.update(zip_bytes=args.zip.stat().st_size, zip_sha256=sha(args.zip.read_bytes()))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
